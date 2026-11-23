'use strict';
/**
 * PHANTOM HIVEMIND — Combines ALL AI brains into one unified response
 * 
 * Queries multiple providers in parallel, merges responses into one answer.
 * Uses Phantom's existing LLM routing + hivemind shared brain for context.
 * 
 * Usage: phantom hivemind <prompt>       — All brains on a prompt
 *        phantom hivemind --quick <p>    — Fast brains only (Ollama + Groq)
 *        phantom hivemind --deep <p>      — Deep brains (Claude + GPT + Ollama)
 *        phantom hivemind --local <p>    — Local only (Ollama hp-1000)
 *        phantom hivemind --status        — Check which brains are alive
 *        phantom hivemind --brain          — Hivemind shared brain status
 */
const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execSync, spawn } = require('child_process');

const HOME    = process.env.HOME || '/home/ghost';
const SERVER  = process.env.PHANTOM_PORT || 4000;

const C = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  green: s => `\x1b[92m${s}\x1b[0m`,
  red: s => `\x1b[91m${s}\x1b[0m`,
  yellow: s => `\x1b[93m${s}\x1b[0m`,
  cyan: s => `\x1b[96m${s}\x1b[0m`,
  purple: s => `\x1b[95m${s}\x1b[0m`,
  gray: s => `\x1b[90m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
};

// ── Brain Definitions ──────────────────────────────────────────
// Each brain = an LLM provider endpoint
const BRAINS = {
  // Local — always available
  ollama:       { name: 'Ollama (hp-1000)',   type: 'local',  speed: 'deep',  url: 'http://localhost:11434/api/chat', model: 'hp-1000:latest' },
  ollama_fast:  { name: 'Ollama (fast)',       type: 'local',  speed: 'fast',  url: 'http://localhost:11434/api/chat', model: 'hp-1000:latest' },
  miniforge:    { name: 'Miniforge Bot',       type: 'free',   speed: 'fast',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'chatgpt' },
  
  // Cloud — Phantom server proxies
  groq:         { name: 'Groq',                type: 'cloud',  speed: 'fast',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'openai/gpt-oss-120b' },
  gemini:       { name: 'Gemini 2.5 Flash',    type: 'cloud',  speed: 'fast',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'gemini-2.5-flash' },
  openrouter:   { name: 'OpenRouter',          type: 'cloud',  speed: 'deep',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'qwen/qwen3-235b-a22b:free' },
  anthropic:    { name: 'Claude Sonnet',       type: 'cloud',  speed: 'deep',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'claude-sonnet-4-6' },
  openai:       { name: 'OpenAI GPT-4o',      type: 'cloud',  speed: 'deep',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'gpt-4o' },
  deepseek:     { name: 'DeepSeek V3',         type: 'cloud',  speed: 'deep',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'deepseek-ai/DeepSeek-V3' },
  cerebras:     { name: 'Cerebras',            type: 'free',   speed: 'fast',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'gpt-oss-120b' },
  pollinations: { name: 'Pollinations (free)', type: 'free',   speed: 'fast',  url: `http://localhost:${SERVER}/api/ai/chat`, model: 'openai' },
};

// ── Load API keys from Phantom config ─────────────────────────
function loadApiKeys() {
  const keys = {};
  // Try Phantom server AI config
  try {
    const cfgPath = path.join(HOME, '.phantom-ai-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.ai) {
        if (cfg.ai.groq?.key) keys.groq = cfg.ai.groq.key;
        if (cfg.ai.anthropic?.key) keys.anthropic = cfg.ai.anthropic.key;
        if (cfg.ai.openai?.key) keys.openai = cfg.ai.openai.key;
        if (cfg.ai.gemini?.key) keys.gemini = cfg.ai.gemini.key;
        if (cfg.ai.openrouter?.key) keys.openrouter = cfg.ai.openrouter.key;
      }
    }
  } catch {}
  // Try .env
  try {
    const env = fs.readFileSync(path.join(HOME, '.env'), 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^(GROQ_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|OPENROUTER_API_KEY|DEEPSEEK_API_KEY)=(.+)/);
      if (m) keys[m[1].replace('_API_KEY','').toLowerCase()] = m[2].trim().replace(/["']/g,'');
    }
  } catch {}
  return keys;
}

// ── Hivemind shared brain (file-based fallback when not logged in) ──
function getSharedBrainContext() {
  const graphDir = path.join(HOME, '.deeplake', 'memory', 'graph');
  const info = { graphReady: false, rules: 0, memories: 0, skills: 0 };
  
  try {
    if (fs.existsSync(graphDir)) {
      info.graphReady = true;
      // Count entries
      const walk = (d, depth = 0) => {
        if (depth > 3) return;
        try {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
            else { if (e.name.endsWith('.md')) info.memories++; }
          }
        } catch {}
      };
      walk(graphDir);
    }
  } catch {}

  // Try hivemind CLI
  try {
    const result = execSync('hivemind whoami 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    info.loggedIn = !result.includes('Not logged in');
  } catch { info.loggedIn = false; }

  // Load Phantom lessons & memory
  try {
    const lessons = path.join(HOME, '.phantom-lessons.json');
    const memory = path.join(HOME, '.phantom-memory.json');
    if (fs.existsSync(lessons)) info.skills += Object.keys(JSON.parse(fs.readFileSync(lessons,'utf8'))).length;
    if (fs.existsSync(memory)) info.memories += Object.keys(JSON.parse(fs.readFileSync(memory,'utf8'))).length;
  } catch {}

  // Hakster skills
  try {
    const skillsDir = path.join(HOME, '.hakster', 'skills');
    if (fs.existsSync(skillsDir)) {
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (e.isDirectory()) walk(path.join(d, e.name));
          else if (e.name.endsWith('.md')) info.skills++;
        }
      };
      walk(skillsDir);
    }
  } catch {}

  return info;
}

// ── Query a single brain ──────────────────────────────────────
function queryBrain(brainId, prompt, timeout = 60000) {
  return new Promise((resolve) => {
    const brain = BRAINS[brainId];
    if (!brain) return resolve({ id: brainId, ok: false, error: 'unknown brain' });

    const startTime = Date.now();
    
    // Ollama — direct HTTP
    if (brainId === 'ollama' || brainId === 'ollama_fast') {
      const body = JSON.stringify({
        model: brain.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { num_predict: brainId === 'ollama_fast' ? 1024 : 4096 },
      });
      const req = http.request(brain.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout,
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            const content = j.message?.content || j.response || '';
            resolve({ id: brainId, name: brain.name, ok: !!content, content, thinking: j.message?.thinking || '', time: Date.now() - startTime, model: brain.model });
          } catch { resolve({ id: brainId, name: brain.name, ok: false, error: data.slice(0, 200), time: Date.now() - startTime }); }
        });
      });
      req.on('error', e => resolve({ id: brainId, name: brain.name, ok: false, error: e.message, time: Date.now() - startTime }));
      req.on('timeout', () => { req.destroy(); resolve({ id: brainId, name: brain.name, ok: false, error: 'timeout', time: Date.now() - startTime }); });
      req.write(body);
      req.end();
      return;
    }

    // Cloud — via Phantom server proxy
    const body = JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 2048, provider: brainId });
    const req = http.request(brain.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const content = j.choices?.[0]?.message?.content || j.content || j.response || '';
          resolve({ id: brainId, name: brain.name, ok: !!content, content, time: Date.now() - startTime, model: brain.model });
        } catch { resolve({ id: brainId, name: brain.name, ok: false, error: data.slice(0, 200), time: Date.now() - startTime }); }
      });
    });
    req.on('error', e => resolve({ id: brainId, name: brain.name, ok: false, error: e.message, time: Date.now() - startTime }));
    req.on('timeout', () => { req.destroy(); resolve({ id: brainId, name: brain.name, ok: false, error: 'timeout', time: Date.now() - startTime }); });
    req.write(body);
    req.end();
  });
}

// ── Synthesize hivemind response ──────────────────────────────
function synthesize(results, prompt) {
  const successful = results.filter(r => r.ok);
  if (!successful.length) return `No brains responded. Check your providers and try again.`;
  
  if (successful.length === 1) return successful[0].content;

  // Build synthesis with consensus + unique insights
  let out = '';
  out += `${C.purple('╔══ 👻 HIVEMIND — ' + successful.length + ' Brains Unified ══╗')}\n\n`;
  out += `${C.bold('Prompt:')} ${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}\n\n`;
  
  // Find consensus (common themes)
  const responses = successful.map(r => ({ name: r.name, content: r.content.slice(0, 300), time: r.time, model: r.model }));
  
  // Present each brain's contribution
  for (const r of successful) {
    const timeStr = r.time < 5000 ? C.green(`${(r.time/1000).toFixed(1)}s`) : r.time < 15000 ? C.yellow(`${(r.time/1000).toFixed(1)}s`) : C.red(`${(r.time/1000).toFixed(1)}s`);
    out += `${C.cyan('┌─ ' + r.name + ' ──────')} ${timeStr} ${C.gray(r.model || '')}\n`;
    // Take first 600 chars, smart truncation at sentence boundary
    let preview = r.content.slice(0, 600);
    const lastDot = preview.lastIndexOf('.', 600);
    if (lastDot > 300) preview = preview.slice(0, lastDot + 1);
    out += `${C.dim(preview)}\n`;
    if (r.content.length > 600) out += `${C.gray('  [...] ' + (r.content.length - 600) + ' more chars')}\n`;
    out += `${C.cyan('└─────────────────────────────────────────')}\n\n`;
  }
  
  // Merged answer — pick the best one (prefer fastest with good content)
  const best = successful.sort((a, b) => {
    // Prefer longer, more complete answers that came back reasonably fast
    const aScore = a.content.length * (a.time < 10000 ? 1.5 : 1);
    const bScore = b.content.length * (b.time < 10000 ? 1.5 : 1);
    return bScore - aScore;
  })[0];
  
  out += `${C.purple('══ 🧠 Best Answer (' + best.name + ') ══')}\n\n`;
  out += best.content;
  out += `\n\n${C.gray('─'.repeat(50))}`;
  out += `\n${C.gray(`${successful.length}/${results.length} brains responded`)} | ${C.gray(`Best: ${best.name} (${(best.time/1000).toFixed(1)}s)`)}`;
  
  return out;
}

// ── Status ────────────────────────────────────────────────────
async function status() {
  console.log(`\n  ${C.purple('🧠 Hivemind — Brain Status')}\n`);
  
  const brainInfo = getSharedBrainContext();
  const keys = loadApiKeys();
  
  console.log(`  ${C.bold('Shared Brain:')}`);
  console.log(`    Graph:    ${brainInfo.graphReady ? C.green('mounted') : C.yellow('not mounted')}`);
  console.log(`    Logged in: ${brainInfo.loggedIn ? C.green('yes') : C.yellow('no — run hivemind login')}`);
  console.log(`    Memories: ${brainInfo.memories}`);
  console.log(`    Skills:   ${brainInfo.skills}`);
  
  console.log(`\n  ${C.bold('API Keys:')}`);
  for (const [name, key] of Object.entries(keys)) {
    console.log(`    ${C.green('●')} ${name.padEnd(14)} ${key.slice(0, 8)}...${key.slice(-4)}`);
  }
  
  console.log(`\n  ${C.bold('Brains (probe):')}`);
  const probes = [
    ['Ollama', 'http://localhost:11434/api/tags'],
    ['Phantom', `http://localhost:${SERVER}/api/health`],
    ['Miniforge', 'http://localhost:5555/health'],
  ];
  for (const [name, url] of probes) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 2000 }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
      console.log(`    ${C.green('●')} ${name.padEnd(14)} ${C.green('alive')}`);
    } catch {
      console.log(`    ${C.red('●')} ${name.padEnd(14)} ${C.red('down')}`);
    }
  }
  
  console.log(`\n  ${C.bold('Available Brains:')}`);
  for (const [id, b] of Object.entries(BRAINS)) {
    const icon = b.type === 'local' ? C.green('●') : b.type === 'free' ? C.cyan('●') : C.yellow('●');
    console.log(`    ${icon} ${id.padEnd(14)} ${b.name.padEnd(24)} ${b.speed} ${C.gray(b.type)}`);
  }
  console.log('');
}

// ── Brain ─────────────────────────────────────────────────────
function brain() {
  const info = getSharedBrainContext();
  console.log(`\n  ${C.purple('🧠 Shared Brain Status')}\n`);
  console.log(`  Graph mounted:   ${info.graphReady ? C.green('yes') : C.yellow('no')}`);
  console.log(`  HiveMind auth:   ${info.loggedIn ? C.green('logged in') : C.yellow('not logged in')}`);
  console.log(`  Memory entries:  ${info.memories}`);
  console.log(`  Skills loaded:   ${info.skills}`);
  
  if (!info.loggedIn) {
    console.log(`\n  ${C.yellow('⚠ Not logged in to Hivemind cloud brain.')}`);
    console.log(`  Run ${C.bold('hivemind login')} to enable shared brain sync.`);
  }
  if (!info.graphReady) {
    console.log(`\n  ${C.yellow('⚠ Deeplake graph not mounted.')}`);
  }
  
  // Show local knowledge
  const localPaths = [
    path.join(HOME, '.phantom-memory.json'),
    path.join(HOME, '.phantom-lessons.json'),
    path.join(HOME, '.hakster', 'MEMORY.md'),
    path.join(HOME, '.hakster', 'brain_autolearn.db'),
    path.join(HOME, 'phantom-knowledge.md'),
  ];
  console.log(`\n  ${C.bold('Local Knowledge Bases:')}`);
  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      const size = fs.statSync(p).size;
      const name = path.basename(p);
      console.log(`    ${C.green('●')} ${name.padEnd(30)} ${(size/1024).toFixed(1)}KB`);
    }
  }
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  
  if (!args.length || args[0] === '--status' || args[0] === 'status') {
    return status();
  }
  if (args[0] === '--brain' || args[0] === 'brain') {
    return brain();
  }
  
  // Determine mode
  let mode = 'all'; // all, quick, deep, local
  let prompt = '';
  for (const arg of args) {
    if (arg === '--quick') mode = 'quick';
    else if (arg === '--deep') mode = 'deep';
    else if (arg === '--local') mode = 'local';
    else if (arg === '--status') { return status(); }
    else if (arg === '--brain') { return brain(); }
    else prompt += (prompt ? ' ' : '') + arg;
  }
  
  if (!prompt) {
    console.log(`\n  ${C.purple('👻 Hivemind — All Brains, One Answer')}\n`);
    console.log(`  ${C.bold('Usage:')}`);
    console.log(`    phantom hivemind <prompt>       All brains attack`);
    console.log(`    phantom hivemind --quick <p>    Fast brains (Ollama + Groq)`);
    console.log(`    phantom hivemind --deep <p>      Deep brains (Claude + GPT)`);
    console.log(`    phantom hivemind --local <p>    Local only (Ollama)`);
    console.log(`    phantom hivemind --status        Check brain health`);
    console.log(`    phantom hivemind --brain         Shared brain status\n`);
    return;
  }
  
  // Select brains by mode
  const modeBrains = {
    all:    ['ollama', 'miniforge', 'groq', 'gemini', 'openrouter', 'anthropic', 'openai', 'deepseek', 'cerebras', 'pollinations'],
    quick:  ['ollama_fast', 'miniforge', 'groq', 'cerebras', 'pollinations'],
    deep:   ['ollama', 'anthropic', 'openai', 'gemini', 'openrouter', 'deepseek'],
    local:  ['ollama'],
  };
  const selected = modeBrains[mode] || modeBrains.all;
  
  console.log(`\n  ${C.purple('👻 Hivemind — ' + selected.length + ' Brains')}`);
  console.log(`  ${C.gray('Mode: ' + mode + ' | Querying: ' + selected.map(id => BRAINS[id]?.name || id).join(', '))}`);
  console.log(`  ${C.gray('Prompt: ' + prompt.slice(0, 80) + (prompt.length > 80 ? '...' : ''))}\n`);
  
  // Load shared brain context for enrichment
  const brainInfo = getSharedBrainContext();
  const enrichedPrompt = prompt + (brainInfo.skills ? `\n\n[Context: ${brainInfo.skills} skills loaded, ${brainInfo.memories} memory entries]` : '');
  
  // Fire all brains in parallel
  const startTime = Date.now();
  const results = await Promise.allSettled(
    selected.map(id => queryBrain(id, enrichedPrompt).then(r => r))
  );
  
  const elapsed = Date.now() - startTime;
  const successful = results.filter(r => r.status === 'fulfilled' && r.value?.ok).map(r => r.value);
  const failed = results.filter(r => r.status === 'rejected' || !r.value?.ok);
  
  console.log(`${C.green(`${successful.length}/${selected.length}`)} brains responded in ${(elapsed/1000).toFixed(1)}s`);
  
  // Synthesize
  console.log(synthesize(successful.length ? successful : results.filter(r => r.status === 'fulfilled').map(r => r.value), prompt));
  console.log('');
}

main().catch(e => { console.error(e.message); process.exit(1); });