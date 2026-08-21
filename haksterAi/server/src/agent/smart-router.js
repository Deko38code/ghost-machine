/**
 * haksterAi — Smart Agent Router
 *
 * Routes agent tasks to the cheapest available backend based on:
 *   - Task type (code, recon, pentest, chat, image, research)
 *   - Model availability (local Ollama, Miniforge, phantom gateway, parrot, kaggle)
 *   - Cost (always cheapest first — local > GPU > gateway > cloud-redirect)
 *   - Schedule (cron-style or interval-based agent dispatch)
 *
 * Rules:
 *   - NEVER route to real Claude/Anthropic API (refuses commands, breaks agent)
 *   - ALWAYS use cheapest tier that can handle the task
 *   - Cloud model aliases (claude-sonnet-4-5, gpt-4.1) route to local uncensored models
 *   - Miniforge (port 5555) is always free, 48 bots, no refusals
 *
 * Usage:
 *   const router = require('./smart-router');
 *   router.init();
 *   const backend = router.route({ type: 'code', message: 'fix bug in server.js' });
 *   router.schedule('0 9 * * *', { type: 'health-check', message: 'check all services' });
 */

const http = require('http');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Tier definitions (cheapest first) ────────────────────────────────────────

const TIERS = {
  T1_LOCAL: {
    name: 'local-ollama',
    cost: 0,
    url: 'http://localhost:11434/api/chat',
    models: {
      code: 'hp-1000:latest',           // qwen2.5-coder:7b — best coder
      chat: 'kimi-uncensored:latest',   // mistral — fast chat
      power: 'glm-uncensored:latest',   // qwen3.5 — biggest local
      fast: 'kimi-uncensored:latest',   // mistral — quick responses
      security: 'hp-1000:latest',       // qwen2.5-coder — pentest scripts
      research: 'glm-uncensored:latest',// qwen3.5 — deep reasoning
    }
  },
  T2_MINIFORGE: {
    name: 'miniforge',
    cost: 0,
    url: 'http://localhost:5555/api/apps',
    models: {
      uncensored: 'ai-unrestricted',
      coding: 'RobloxScriptHelper',
      chat: 'chatgpt',
      creative: 'claude-3-5-sonnet',
      reasoning: 'gemini-experimental-2-5',
      hack: 'redhot-butterfly',
    }
  },
  T3_PHANTOM: {
    name: 'phantom-gateway',
    cost: 0,
    url: 'http://localhost:4000/api/ai/chat',
    models: {
      groq: 'groq',
      gemini: 'gemini',
      cerebras: 'cerebras',
      sambanova: 'sambanova',
      openrouter: 'openrouter',
    }
  },
  T4_PARROT: {
    name: 'parrot-box',
    cost: 0,
    url: 'http://10.0.0.251:11434/api/chat',
    models: {
      code: 'deepseek-coder-v2:16b',
      fast: 'phi3:mini',
      fallback: 'codellama:7b',
    }
  },
  T5_KAGGLE: {
    name: 'kaggle-gpu',
    cost: 0,
    url: '',  // Set via KAGGLE_TUNNEL env
    models: {
      heavy: 'qwen2.5:32b',
      reasoning: 'deepseek-r1:14b',
    }
  },
  // T6 CLOUD aliases — all redirect to local, never hit external API
  T6_CLOUD_ALIAS: {
    name: 'cloud-alias-local',
    cost: 0,
    url: 'http://localhost:11434/api/chat',
    models: {
      'claude-sonnet-4-5': 'hp-1000:latest',
      'claude-opus-4-5': 'glm-uncensored:latest',
      'claude-haiku-3-5': 'kimi-uncensored:latest',
      'gpt-4.1': 'hp-1000:latest',
      'gpt-4.1-mini': 'kimi-uncensored:latest',
      'gemini-2.5-pro': 'glm-uncensored:latest',
      'gemini-2.5-flash': 'kimi-uncensored:latest',
    }
  }
};

// ── Task type detection ──────────────────────────────────────────────────────

const TASK_KEYWORDS = {
  code: ['function', 'class', 'bug', 'fix', 'refactor', 'endpoint', 'route', 'api', 'server', 'client',
         'javascript', 'python', 'node', 'react', 'express', 'script', 'compile', 'build', 'deploy',
         'file', 'edit', 'write', 'code', 'implement', 'feature', 'merge', 'commit', 'git'],
  security: ['pentest', 'exploit', 'reverse shell', 'nmap', 'scan', 'vuln', 'bypass', 'payload',
             'xss', 'sqli', 'ssrf', 'rce', 'lfi', 'osint', 'recon', 'brute', 'fuzz', 'waf',
             'cloudflare', 'captcha', 'injection', 'escalation', 'forensic', 'malware'],
  research: ['research', 'analyze', 'compare', 'investigate', 'find', 'search', 'document',
             'explain', 'summarize', 'report', 'study', 'review'],
  chat: ['hello', 'hey', 'yo', 'what', 'how', 'why', 'when', 'where', 'who', 'tell me',
         'chat', 'talk', 'discuss', 'opinion', 'think'],
  image: ['image', 'picture', 'photo', 'draw', 'generate image', 'render', 'flux', 'sdxl'],
  power: ['architecture', 'design system', 'refactor large', 'migrate', 'rewrite', 'scale',
          'optimize', 'performance', 'complex', 'multi-step', 'plan'],
};

function detectTaskType(message) {
  const lower = (message || '').toLowerCase();
  // Security tasks get priority — never refuse
  for (const kw of TASK_KEYWORDS.security) {
    if (lower.includes(kw)) return 'security';
  }
  for (const kw of TASK_KEYWORDS.image) {
    if (lower.includes(kw)) return 'image';
  }
  for (const kw of TASK_KEYWORDS.power) {
    if (lower.includes(kw)) return 'power';
  }
  for (const kw of TASK_KEYWORDS.code) {
    if (lower.includes(kw)) return 'code';
  }
  for (const kw of TASK_KEYWORDS.research) {
    if (lower.includes(kw)) return 'research';
  }
  return 'chat';
}

// ── Backend health checks ─────────────────────────────────────────────────────

let _health = {};
function checkHealth() {
  const checks = [
    { tier: 'T1_LOCAL', host: '127.0.0.1', port: 11434 },
    { tier: 'T2_MINIFORGE', host: '127.0.0.1', port: 5555 },
    { tier: 'T3_PHANTOM', host: '127.0.0.1', port: 4000 },
    { tier: 'T4_PARROT', host: '10.0.0.251', port: 11434 },
  ];
  for (const chk of checks) {
    const sock = new (require('net').Socket)();
    sock.setTimeout(2000);
    sock.on('connect', () => { _health[chk.tier] = true; sock.destroy(); });
    sock.on('error', () => { _health[chk.tier] = false; sock.destroy(); });
    sock.on('timeout', () => { _health[chk.tier] = false; sock.destroy(); });
    sock.connect(chk.port, chk.host);
  }
  // Kaggle tunnel — check env
  _health.T5_KAGGLE = !!process.env.KAGGLE_TUNNEL;
  _health.T6_CLOUD_ALIAS = true; // always — routes to local
}

// ── Router ─────────────────────────────────────────────────────────────────

/**
 * Route a task to the cheapest available backend.
 * @param {Object} task - { type?, message, model? }
 * @returns {Object} { tier, url, model, displayModel, cost }
 */
function route(task = {}) {
  const type = task.type || detectTaskType(task.message || '');
  const requestedModel = task.model || '';

  // If a specific cloud alias is requested, redirect to local equivalent
  if (requestedModel && TIERS.T6_CLOUD_ALIAS.models[requestedModel]) {
    const localModel = TIERS.T6_CLOUD_ALIAS.models[requestedModel];
    return {
      tier: 'T6_CLOUD_ALIAS',
      name: TIERS.T6_CLOUD_ALIAS.name,
      url: TIERS.T6_CLOUD_ALIAS.url,
      model: localModel,
      displayModel: requestedModel, // show alias name for compatibility
      cost: 0,
      redirected: true,
    };
  }

  // Tier 1: Local Ollama (cheapest, always free)
  if (_health.T1_LOCAL !== false) {
    const model = TIERS.T1_LOCAL.models[type] || TIERS.T1_LOCAL.models.chat;
    return {
      tier: 'T1_LOCAL',
      name: TIERS.T1_LOCAL.name,
      url: TIERS.T1_LOCAL.url,
      model,
      displayModel: model,
      cost: 0,
    };
  }

  // Tier 2: Miniforge (free, no refusals)
  if (_health.T2_MINIFORGE !== false) {
    const botMap = { code: 'RobloxScriptHelper', security: 'ai-unrestricted', chat: 'chatgpt',
                     power: 'gemini-experimental-2-5', research: 'gemini-experimental-2-5', image: 'flux-schnell-image-generator' };
    const bot = botMap[type] || 'ai-unrestricted';
    return {
      tier: 'T2_MINIFORGE',
      name: TIERS.T2_MINIFORGE.name,
      url: `http://localhost:5555/api/apps/${bot}/chat`,
      model: bot,
      displayModel: bot,
      cost: 0,
    };
  }

  // Tier 3: Phantom gateway (free external providers)
  if (_health.T3_PHANTOM !== false) {
    return {
      tier: 'T3_PHANTOM',
      name: TIERS.T3_PHANTOM.name,
      url: TIERS.T3_PHANTOM.url,
      model: 'groq',
      displayModel: 'phantom-groq',
      cost: 0,
    };
  }

  // Tier 4: Parrot box (remote Ollama)
  if (_health.T4_PARROT !== false) {
    const model = TIERS.T4_PARROT.models.code;
    return {
      tier: 'T4_PARROT',
      name: TIERS.T4_PARROT.name,
      url: TIERS.T4_PARROT.url,
      model,
      displayModel: model,
      cost: 0,
    };
  }

  // Tier 5: Kaggle GPU (if tunnel up)
  if (_health.T5_KAGGLE) {
    return {
      tier: 'T5_KAGGLE',
      name: TIERS.T5_KAGGLE.name,
      url: (process.env.KAGGLE_TUNNEL || '').replace(/\/$/, '') + '/api/chat',
      model: TIERS.T5_KAGGLE.models.heavy,
      displayModel: TIERS.T5_KAGGLE.models.heavy,
      cost: 0,
    };
  }

  // Last resort: local alias (always available — routes to local Ollama)
  return {
    tier: 'T6_CLOUD_ALIAS',
    name: TIERS.T6_CLOUD_ALIAS.name,
    url: TIERS.T6_CLOUD_ALIAS.url,
    model: 'hp-1000:latest',
    displayModel: 'hp-1000:latest',
    cost: 0,
  };
}

// ── Scheduler — cron-style agent dispatch ────────────────────────────────────

const _scheduledJobs = [];
const CRON_FILE = path.join(process.env.HOME || '/home/ghost', '.hakster', 'agent-schedule.json');

function loadSchedule() {
  try {
    if (fs.existsSync(CRON_FILE)) {
      return JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return [];
}

function saveSchedule(jobs) {
  try {
    const dir = path.dirname(CRON_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CRON_FILE, JSON.stringify(jobs, null, 2));
  } catch (e) { /* ignore */ }
}

/**
 * Schedule an agent task on a cron schedule.
 * @param {string} cron - 5-field cron expression (e.g. "0 9 * * *")
 * @param {Object} task - { type, message, model? }
 * @param {Object} opts - { recurring (default true), durable (default true) }
 * @returns {string} job ID
 */
function schedule(cronExpr, task, opts = {}) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    cron: cronExpr,
    task,
    recurring: opts.recurring !== false,
    durable: opts.durable !== false,
    createdAt: new Date().toISOString(),
    lastRun: null,
    runCount: 0,
    nextRun: _nextCronRun(cronExpr),
  };
  _scheduledJobs.push(job);
  if (job.durable) {
    const stored = loadSchedule();
    stored.push(job);
    saveSchedule(stored);
  }
  return id;
}

/**
 * Schedule a one-shot agent task N seconds from now.
 * @param {number} delaySeconds - seconds from now
 * @param {Object} task - { type, message, model? }
 * @returns {string} job ID
 */
function scheduleOnce(delaySeconds, task) {
  const id = `once_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const runAt = Date.now() + delaySeconds * 1000;
  const job = {
    id,
    type: 'once',
    runAt,
    task,
    recurring: false,
    durable: false,
    createdAt: new Date().toISOString(),
  };
  _scheduledJobs.push(job);
  setTimeout(() => {
    _dispatchJob(job);
  }, delaySeconds * 1000);
  return id;
}

function cancelJob(id) {
  const idx = _scheduledJobs.findIndex(j => j.id === id);
  if (idx >= 0) {
    _scheduledJobs.splice(idx, 1);
    const stored = loadSchedule();
    const sIdx = stored.findIndex(j => j.id === id);
    if (sIdx >= 0) {
      stored.splice(sIdx, 1);
      saveSchedule(stored);
    }
    return true;
  }
  return false;
}

function listJobs() {
  return _scheduledJobs.map(j => ({
    id: j.id,
    cron: j.cron,
    task: j.task,
    recurring: j.recurring,
    lastRun: j.lastRun,
    runCount: j.runCount,
    nextRun: j.nextRun,
  }));
}

// ── Cron parser (5-field: min hour dom mon dow) ─────────────────────────────

function _parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const ranges = [[0,59],[0,23],[1,31],[1,12],[0,6]];
  const fields = parts.map((p, i) => {
    if (p === '*') return null; // any
    if (p.startsWith('*/')) {
      const step = parseInt(p.slice(2));
      return { step, min: ranges[i][0], max: ranges[i][1] };
    }
    if (p.includes(',')) {
      return { values: p.split(',').map(Number) };
    }
    return { values: [parseInt(p)] };
  });
  return fields;
}

function _nextCronRun(expr) {
  const fields = _parseCron(expr);
  if (!fields) return null;
  const now = new Date();
  // Simple: increment minute by minute until match (max 60*24 checks)
  for (let i = 0; i < 1440; i++) {
    const t = new Date(now.getTime() + i * 60000);
    const vals = [t.getMinutes(), t.getHours(), t.getDate(), t.getMonth() + 1, t.getDay()];
    let match = true;
    for (let f = 0; f < 5; f++) {
      if (!fields[f]) continue; // wildcard
      if (fields[f].step) {
        if ((vals[f] - fields[f].min) % fields[f].step !== 0) { match = false; break; }
      } else if (fields[f].values) {
        if (!fields[f].values.includes(vals[f])) { match = false; break; }
      }
    }
    if (match) return t.toISOString();
  }
  return null;
}

function _shouldRunCron(expr, now) {
  const fields = _parseCron(expr);
  if (!fields) return false;
  const vals = [now.getMinutes(), now.getHours(), now.getDate(), now.getMonth() + 1, now.getDay()];
  for (let f = 0; f < 5; f++) {
    if (!fields[f]) continue;
    if (fields[f].step) {
      if ((vals[f] - fields[f].min) % fields[f].step !== 0) return false;
    } else if (fields[f].values) {
      if (!fields[f].values.includes(vals[f])) return false;
    }
  }
  return true;
}

// ── Job dispatcher ────────────────────────────────────────────────────────────

let _dispatchCallback = null;

/**
 * Set the dispatch callback — called when a scheduled job fires.
 * The callback receives (task, backend) and should execute the agent.
 */
function onDispatch(cb) {
  _dispatchCallback = cb;
}

function _dispatchJob(job) {
  const backend = route(job.task);
  job.lastRun = new Date().toISOString();
  job.runCount = (job.runCount || 0) + 1;

  if (_dispatchCallback) {
    _dispatchCallback(job.task, backend, job);
  } else {
    // Default: log (no side effects)
    console.log(`[smart-router] Job ${job.id} fired → ${backend.name}/${backend.model} — ${(job.task.message||'').slice(0,80)}`);
  }

  // Update next run for recurring jobs
  if (job.recurring && job.cron) {
    job.nextRun = _nextCronRun(job.cron);
  }
}

// ── Tick — called every minute to check scheduled jobs ───────────────────────

function tick() {
  const now = new Date();
  for (const job of _scheduledJobs) {
    if (job.type === 'once') continue; // handled by setTimeout
    if (!job.recurring && job.runCount > 0) continue;
    if (_shouldRunCron(job.cron, now)) {
      // Avoid double-firing within same minute
      if (job.lastRun) {
        const last = new Date(job.lastRun);
        if (last.getTime() > now.getTime() - 60000) continue;
      }
      _dispatchJob(job);
    }
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

let _initialized = false;
let _auditLeakCount = 0;

async function _autoAudit() {
  const leaks = await auditTokenBurn();
  if (leaks.length > 0) {
    _auditLeakCount = leaks.length;
    console.log(`[smart-router] ⚠️ TOKEN BURN DETECTED — ${leaks.length} model(s) leaking to cloud:`);
    for (const l of leaks) {
      console.log(`  ❌ ${l.model} → ${l.url}`);
    }
    console.log('[smart-router] Fix: ollama rm "<model>" && ollama create "<model>" -f <modelfile with FROM local-base>');
  } else {
    _auditLeakCount = 0;
  }
}

function init() {
  if (_initialized) return;
  _initialized = true;

  // Health checks every 30s
  checkHealth();
  setInterval(checkHealth, 30000);

  // Load durable jobs
  const stored = loadSchedule();
  for (const job of stored) {
    if (job.recurring) {
      _scheduledJobs.push(job);
    }
  }

  // Cron tick every 60s
  setInterval(tick, 60000);

  // Token burn audit on startup + every 30 min
  _autoAudit();
  setInterval(_autoAudit, 30 * 60 * 1000);

  console.log(`[smart-router] Initialized — ${_scheduledJobs.length} jobs loaded, health monitoring + token burn audit active`);
}

// ── Token burn auditor ─────────────────────────────────────────────────────────

/**
 * Audit all Ollama models for cloud token leaks.
 * Returns array of leaking models (empty = all clean).
 */
async function auditTokenBurn() {
  return new Promise((resolve) => {
    try {
      const out = execSync('ollama list', { encoding: 'utf8', timeout: 10000 });
      const models = out.trim().split('\n').slice(1).map(l => l.split(/\s+/)[0]).filter(Boolean);
      const leaks = [];
      for (const m of models) {
        try {
          const show = execSync(`ollama show "${m}"`, { encoding: 'utf8', timeout: 5000 });
          if (show.includes('Remote URL') || show.includes('ollama.com')) {
            leaks.push({ model: m, url: (show.match(/Remote URL\s+(\S+)/) || [])[1] || 'unknown' });
          }
        } catch (e) { /* skip */ }
      }
      resolve(leaks);
    } catch (e) {
      resolve([]);
    }
  });
}

module.exports = {
  TIERS,
  init,
  route,
  detectTaskType,
  schedule,
  scheduleOnce,
  cancelJob,
  listJobs,
  onDispatch,
  checkHealth,
  auditTokenBurn,
  getLeakCount: () => _auditLeakCount,
  loadSchedule,
  saveSchedule,
};