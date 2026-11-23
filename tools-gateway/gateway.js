#!/usr/bin/env node
/**
 * haksterAi Tools Gateway — OpenAI-compatible harness around ALL local LLMs
 * + the ollama brain boxes (dell 127.0.0.1:11434, parrot 10.0.0.251:11434),
 * wired to the haksterAi MCP fleet (filesystem, memory, sequential-thinking,
 * playwright, phantom IDE ops, kiro, hivemind, miniforge hack-squad, sqlite…).
 *
 * POST /v1/chat/completions — OpenAI shapes in/out; native tool-call loop
 * POST /v1/combine          — fan one prompt to Phantom + crush + omp CLIs
 * GET  /v1/models           — merged model list from both boxes
 * GET  /tools | /health
 *
 * Snappy defaults: heavyweight CLIs gated behind `allow_heavy`, 25s per-tool
 * timeout, 90s call budget, crush serialized (single crush.db), CLIs isolated.
 */
const express = require('express');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const MCP_ROOTS = ['/home/ghost/haksterAi/.hakster', '/home/ghost/.hakster'];
const BOXES = (process.env.HARNESS_BOXES || 'http://127.0.0.1:11434,http://10.0.0.251:11434')
  .split(',').map(s => s.trim()).filter(Boolean);
const PORT = Number(process.env.HARNESS_PORT || 5599);
const MAX_TOOL_ROUNDS = Number(process.env.HARNESS_ROUNDS || 6);
const TOOL_TIMEOUT_MS = Number(process.env.HARNESS_TOOL_TIMEOUT_MS || 25000);
const CALL_BUDGET_MS = Number(process.env.HARNESS_BUDGET_MS || 90000);
const COMBINE_TIMEOUT_MS = Number(process.env.HARNESS_COMBINE_MS || 150000);
const HEAVY_MCP = /mcp__(kiro|claude_code|codex|subagents|squad|hermes|hivemind|bounty_platforms|writeup_search)__/;

class Mutex {
  constructor() { this._p = Promise.resolve(); }
  lock(fn) { const run = this._p.then(fn, fn); this._p = run.catch(() => {}); return run; }
}
const crushMutex = new Mutex();

function runCli(cmd, args, { timeoutMs = COMBINE_TIMEOUT_MS, cwd = '/tmp/wk-combine', env = {} } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let out = '', err = '', done = false;
    try { fs.mkdirSync(cwd, { recursive: true }); } catch {}
    const child = spawn(cmd, args, {
      cwd, env: { ...process.env, ...env, HOME: '/home/ghost', TERM: 'xterm-256color' },
      timeout: timeoutMs, killSignal: 'SIGKILL',
    });
    child.stdout.on('data', (d) => { out += d; if (out.length > 200000) child.kill('SIGKILL'); });
    child.stderr.on('data', (d) => { err += d; if (err.length > 40000) err = err.slice(-40000); });
    child.on('error', (e) => { if (!done) { done = true; resolve({ ok: false, error: e.message, ms: Date.now() - started }); } });
    child.on('close', (code, sig) => { if (!done) { done = true; resolve({ ok: code === 0, code, killed: sig === 'SIGKILL', out: out.slice(0, 12000), err: err.slice(0, 4000), ms: Date.now() - started }); } });
  });
}

(async () => {
  const mcp = require('/home/ghost/haksterAi/server/src/agent/mcp.js');
  mcp.setLogFn((m) => console.log(m));

  const toolDefs = [];
  async function loadFleet() {
    try {
      const { tools } = await mcp.loadMcpServers(MCP_ROOTS);
      const seen = new Set();
      for (const t of tools) {
        const def = (typeof t === 'string') ? { type: 'function', function: { name: t, parameters: {} } } : t;
        const n = (def.function || {}).name;
        if (!n || seen.has(n)) continue;
        seen.add(n); toolDefs.push(def);
      }
      console.log(`[gateway] MCP fleet loaded: ${toolDefs.length} unique tools`);
    } catch (e) {
      console.error('[gateway] MCP load failed (continuing without):', e.message);
    }
  }
  const fleetReady = loadFleet();
  const whenReady = (timeoutMs = 90000) => Promise.race([
    fleetReady,
    new Promise((_, rej) => setTimeout(() => rej(new Error('mcp-load-timeout')), timeoutMs)),
  ]);

  async function listBoxModels(box) {
    try {
      const r = await fetch(box + '/api/tags', { signal: AbortSignal.timeout(4000) });
      const j = await r.json();
      return (j.models || []).map(m => m.name);
    } catch { return []; }
  }

  async function resolveModel(model) {
    for (const box of BOXES) {
      if ((await listBoxModels(box)).includes(model)) return box;
    }
    return BOXES[0];
  }

  async function ollamaChat(box, body, timeoutMs = 180000) {
    const { model, messages, tools, options } = body;
    const payload = { model, messages, stream: false };
    if (tools && tools.length) payload.tools = tools.map((t) => ({ type: 'function', function: t.function || { name: t.name, parameters: t.parameters || {} } }));
    if (options) payload.options = options;
    const r = await fetch(box + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return r.json();
  }

  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/tools', async (_req, res) => {
    await whenReady().catch(() => {});
    res.json({ count: toolDefs.length, tools: toolDefs.map(t => (t.function || {}).name).sort() });
  });

  app.get('/health', async (_req, res) => {
    const boxes = await Promise.all(BOXES.map(async b => ({ box: b, ok: (await listBoxModels(b)).length > 0 })));
    res.json({ ok: boxes.some(b => b.ok), boxes, tools: toolDefs.length });
  });

  app.get('/v1/models', async (_req, res) => {
    await whenReady().catch(() => {});
    const all = (await Promise.all(BOXES.map(b => listBoxModels(b)))).flat();
    const seen = new Set();
    res.json({
      object: 'list',
      data: all.filter(n => (seen.has(n) ? false : (seen.add(n), true))).map(n => ({
        id: n, object: 'model', created: 1700000000, owned_by: 'hakster-ollama-infra',
      })),
    });
  });

  app.post('/v1/combine', async (req, res) => {
    const prompt = String(req.body?.prompt || '').slice(0, 8000);
    if (!prompt) return res.status(400).json({ error: { message: 'missing prompt' } });
    const t0 = Date.now();
    const esc = prompt.replace(/'/g, `'\\''`);
    const [phantom, crush, omp] = await Promise.all([
      runCli('phantom', ['-c', prompt], { timeoutMs: COMBINE_TIMEOUT_MS }),
      crushMutex.lock(() => runCli('/home/ghost/.local/bin/crush', ['run', '--quiet', esc, '--cwd', '/tmp/wk-crush'], { timeoutMs: COMBINE_TIMEOUT_MS })),
      runCli('omp', ['-p', '--no-session', '--no-pty', '--approval-mode', 'yolo', '--max-time', '120', esc], { timeoutMs: COMBINE_TIMEOUT_MS + 10000, cwd: '/tmp/wk-omp' }),
    ]);
    res.json({
      phantom: { ok: phantom.ok, ms: phantom.ms, out: phantom.out || phantom.error },
      crush:   { ok: crush.ok,   ms: crush.ms,   out: crush.out   || crush.err || crush.error },
      omp:     { ok: omp.ok,     ms: omp.ms,     out: omp.out     || omp.err || omp.error },
      ms: Date.now() - t0,
    });
  });

  app.post('/v1/chat/completions', async (req, res) => {
    const { model = 'glm-5.3-flash:cloud', messages = [], tools, stream } = req.body || {};
    await whenReady().catch(() => {});
    const box = await resolveModel(model);
    const id = 'chatgw-' + Date.now().toString(36);
    const created = Math.floor(Date.now() / 1000);

    const heavyOk = req.body.allow_heavy === true;
    const harnessTools = tools && tools.length
      ? toolDefs.filter(t => heavyOk || !HEAVY_MCP.test((t.function || {}).name || ''))
      : [];
    const deadline = Date.now() + CALL_BUDGET_MS;
    const loopMessages = [...messages];
    const callLedger = [];
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS + 1; round++) {
        if (Date.now() > deadline) break;
        const j = await ollamaChat(box, { model, messages: loopMessages, tools: harnessTools, options: req.body.options });
        const msg = j.message || {};
        if (msg.tool_calls && msg.tool_calls.length && harnessTools.length) {
          loopMessages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
          for (const tc of msg.tool_calls) {
            const fnName = (tc.function && tc.function.name) || tc.name;
            let fnArgs = (tc.function && tc.function.arguments) || tc.arguments || '{}';
            let args; try { args = typeof fnArgs === 'string' ? JSON.parse(fnArgs || '{}') : (fnArgs || {}); } catch { args = {}; }
            let out; let timedOut = false;
            out = await Promise.race([
              mcp.callMcpTool(fnName, args).catch(e => 'Error: ' + e.message),
              new Promise(resolve => setTimeout(() => { timedOut = true; resolve('[tool timeout] >' + (TOOL_TIMEOUT_MS / 1000) + 's — pick a faster tool'); }, TOOL_TIMEOUT_MS)),
            ]);
            if (timedOut) console.log(`[gateway] tool timeout: ${fnName}`);
            if (typeof out !== 'string') out = JSON.stringify(out).slice(0, 8000);
            callLedger.push({ tool: fnName, out_len: (out || '').length });
            loopMessages.push({ role: 'tool', tool_call_id: tc.id || (tc.function && tc.id) || fnName + '_' + callLedger.length, content: String(out).slice(0, 8000) });
          }
          continue;
        }
        const finalText = msg.content || '';
        if (stream) {
          res.setHeader('content-type', 'text/event-stream');
          const chunk = (delta, finish) => res.write('data: ' + JSON.stringify({
            id, object: 'chat.completion.chunk', created, model,
            choices: [{ index: 0, delta, finish_reason: finish || null }],
          }) + '\n\n');
          chunk({ role: 'assistant' }); chunk({ content: finalText }, 'stop');
          res.write('data: [DONE]\n\n'); res.end();
        } else {
          res.json({
            id, object: 'chat.completion', created, model,
            choices: [{ index: 0, message: { role: 'assistant', content: finalText }, finish_reason: 'stop' }],
            usage: { tool_calls: callLedger.length },
            _harness: { box, tool_calls: callLedger },
          });
        }
        return;
      }
      const j = await ollamaChat(box, { model, messages: [{ role: 'user', content: 'Summarize your progress in two sentences.' }], options: req.body.options });
      res.json({ id, object: 'chat.completion', created, model, choices: [{ index: 0, message: { role: 'assistant', content: (j.message || {}).content || '' }, finish_reason: 'length' }], _harness: { box, tool_calls: callLedger } });
    } catch (e) {
      res.status(502).json({ error: { message: String(e.message || e).slice(0, 300), type: 'harness_error' } });
    }
  });

  http.createServer(app).listen(PORT, () =>
    console.log(`[gateway] tools harness on :${PORT} — boxes=${BOXES.join(', ')}`));
})();