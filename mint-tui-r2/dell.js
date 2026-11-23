'use strict';
//
// Dell remote provider for haksterAi CLI
// The heavy/cheap models live on the Dell box (10.0.0.131) behind a
// LiteLLM/Anthropic-compatible proxy on :8082, plus the `claude` CLI itself.
//
// Two access paths:
//   1. HTTP  - OpenAI-compatible /v1/chat/completions on the Dell proxy
//   2. CLI   - `ssh ghost@dell claude -p "<prompt>"` (uses the CLI's own routing)
//
// Config resolution order:
//   env  HAKSTER_DELL_HOST / HAKSTER_DELL_PORT / HAKSTER_DELL_MODEL
//   file ~/.hakster/dell.json  { host, port, model, apiKey }
//   defaults
//

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const CONFIG_FILE = path.join(os.homedir(), '.hakster', 'dell.json');

const DEFAULTS = {
  host: '10.0.0.131',        // Dell box (ssh target + proxy host)
  user: 'ghost',
  port: 8082,                // claude-code-proxy on the Dell (loopback only)
  ollamaHost: '10.0.0.251',  // Ollama backend, directly reachable on the LAN
  ollamaPort: 11434,
  backend: 'ollama',         // 'ollama' (native, fast) | 'proxy' (Anthropic /v1/messages)
  model: 'deepseek-coder-v2:16b',
  apiKey: '',
  scheme: 'http',
};

function loadDellConfig() {
  let file = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) file = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { /* ignore bad config */ }

  const cfg = {
    ...DEFAULTS,
    ...file,
    host: process.env.HAKSTER_DELL_HOST || file.host || DEFAULTS.host,
    port: Number(process.env.HAKSTER_DELL_PORT || file.port || DEFAULTS.port),
    model: process.env.HAKSTER_DELL_MODEL || file.model || DEFAULTS.model,
    apiKey: process.env.HAKSTER_DELL_API_KEY || file.apiKey || DEFAULTS.apiKey,
    scheme: process.env.HAKSTER_DELL_SCHEME || file.scheme || DEFAULTS.scheme,
    ollamaHost: process.env.HAKSTER_OLLAMA_HOST || file.ollamaHost || DEFAULTS.ollamaHost,
    ollamaPort: Number(process.env.HAKSTER_OLLAMA_PORT || file.ollamaPort || DEFAULTS.ollamaPort),
    backend: process.env.HAKSTER_DELL_BACKEND || file.backend || DEFAULTS.backend,
  };
  cfg.baseUrl = `${cfg.scheme}://${cfg.host}:${cfg.port}`;
  cfg.ollamaUrl = `${cfg.scheme}://${cfg.ollamaHost}:${cfg.ollamaPort}`;
  return cfg;
}

function saveDellConfig(patch) {
  let cur = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) cur = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { /* ignore */ }
  const next = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n');
  return next;
}

async function httpJson(url, opts = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) {
      const msg = (body && body.error && (body.error.message || body.error)) || text;
      throw new Error(`HTTP ${res.status}: ${String(msg).slice(0, 300)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// Discover models the Dell proxy exposes. Returns [] when unreachable.
async function listModels(cfg = loadDellConfig()) {
  // Ollama native /api/tags
  try {
    const data = await httpJson(`${cfg.ollamaUrl}/api/tags`, {}, 8000);
    const arr = (data && data.models) || [];
    const names = arr.map((m) => (typeof m === 'string' ? m : m.name || m.model)).filter(Boolean);
    if (names.length) return names;
  } catch { /* fall through to proxy */ }

  const headers = cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
  try {
    const data = await httpJson(`${cfg.baseUrl}/v1/models`, { headers }, 8000);
    const arr = (data && (data.data || data.models)) || [];
    return arr.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
  } catch {
    return [];
  }
}

// Prefer a cheap/fast model when the user hasn't pinned one.
const CHEAP_HINTS = ['flash', 'haiku', 'mini', 'small', 'lite', 'cheap', 'fast', '8b', '7b', '3b'];

function pickCheapModel(models) {
  if (!models.length) return '';
  for (const hint of CHEAP_HINTS) {
    const hit = models.find((m) => String(m).toLowerCase().includes(hint));
    if (hit) return hit;
  }
  return models[0];
}

async function resolveModel(cfg) {
  if (cfg.model) return cfg.model;
  const models = await listModels(cfg);
  const picked = pickCheapModel(models);
  if (picked) saveDellConfig({ model: picked });
  return picked;
}

async function health(cfg = loadDellConfig()) {
  const out = { ollamaUrl: cfg.ollamaUrl, baseUrl: cfg.baseUrl, backend: cfg.backend };
  try {
    await httpJson(`${cfg.ollamaUrl}/api/tags`, {}, 6000);
    out.ollama = 'up';
  } catch (e) { out.ollama = `down: ${e.message}`; }

  try {
    await httpJson(`${cfg.baseUrl}/health`, {}, 6000);
    out.proxy = 'up';
  } catch (e) { out.proxy = `down: ${e.message}`; }

  out.ok = out.ollama === 'up' || out.proxy === 'up';
  return out;
}

// Chat via Ollama native /api/chat (OpenAI-ish tools supported), with
// Anthropic /v1/messages fallback through the Dell proxy.
async function chat(messages, opts = {}) {
  const cfg = { ...loadDellConfig(), ...(opts.config || {}) };
  const model = opts.model || cfg.model || (await resolveModel(cfg));
  if (!model) throw new Error(`no model available (ollama ${cfg.ollamaUrl} / proxy ${cfg.baseUrl})`);

  const backend = opts.backend || cfg.backend;

  // ---------- Ollama native ----------
  if (backend === 'ollama') {
    const body = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content ?? '' })),
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxTokens ?? 4096,
      },
    };
    if (opts.tools && opts.tools.length) body.tools = opts.tools;

    const data = await httpJson(`${cfg.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, opts.timeoutMs || 180000);

    const msg = (data && data.message) || {};
    return {
      model: data.model || model,
      content: msg.content || '',
      toolCalls: msg.tool_calls || [],
      finishReason: data.done_reason || (data.done ? 'stop' : null),
      usage: {
        prompt_tokens: data.prompt_eval_count,
        completion_tokens: data.eval_count,
      },
      backend: 'ollama',
      raw: data,
    };
  }

  // ---------- Dell proxy (Anthropic messages API) ----------
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  const body = {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    messages: rest.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content ?? '' })),
  };
  if (sys) body.system = sys;

  const headers = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (cfg.apiKey) headers['x-api-key'] = cfg.apiKey;

  const data = await httpJson(`${cfg.baseUrl}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, opts.timeoutMs || 180000);

  const blocks = (data && data.content) || [];
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const toolCalls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({
    id: b.id,
    type: 'function',
    function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
  }));

  return {
    model: data.model || model,
    content: text,
    toolCalls,
    finishReason: data.stop_reason,
    usage: data.usage,
    backend: 'proxy',
    raw: data,
  };
}

// Run the Dell's own `claude` CLI over SSH (non-interactive print mode).
function claudeCli(prompt, opts = {}) {
  const cfg = loadDellConfig();
  const remoteCmd = opts.raw
    ? prompt
    : `claude -p ${JSON.stringify(prompt)}${opts.model ? ` --model ${opts.model}` : ''}`;
  return new Promise((resolve, reject) => {
    execFile(
      'ssh',
      ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=no',
       `${cfg.user}@${cfg.host}`, remoteCmd],
      { timeout: opts.timeoutMs || 180000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`${err.message}\n${String(stderr).slice(0, 500)}`));
        resolve(String(stdout).trim());
      }
    );
  });
}

module.exports = {
  loadDellConfig,
  saveDellConfig,
  listModels,
  pickCheapModel,
  resolveModel,
  health,
  chat,
  claudeCli,
  CONFIG_FILE,
};
