'use strict';
/**
 * PHANTOM BOOST COMMAND — Full system status with all 20 MCP servers + skills + agents
 * Usage: phantom boost          — Full status
 *        phantom boost mcp      — 20 MCP servers detail
 *        phantom boost skills   — Skills listing
 *        phantom boost routes   — LLM routing
 *        phantom boost run <id> — Run a skill
 */
const fs       = require('fs');
const path     = require('path');
const http     = require('http');
const { execSync } = require('child_process');
const HOME     = (process.env.HOME === '/root' || !process.env.HOME) ? '/home/ghost' : process.env.HOME;

const C = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  green: s => `\x1b[92m${s}\x1b[0m`,
  red: s => `\x1b[91m${s}\x1b[0m`,
  yellow: s => `\x1b[93m${s}\x1b[0m`,
  cyan: s => `\x1b[96m${s}\x1b[0m`,
  purple: s => `\x1b[95m${s}\x1b[0m`,
  gray: s => `\x1b[90m${s}\x1b[0m`,
};

// ── Load ALL 20 MCP servers from 3 config sources ─────────────
function loadMcpServers() {
  const paths = [
    path.join(HOME, 'mcp.json'),                     // 17 base servers
    path.join(HOME, '.hakster', 'mcp.json'),          // tui-server, hivemind
    path.join(HOME, '.hakster', 'mcp-servers.json'),  // 18 incl. hakster-bypass
  ];
  const servers = {};
  const sources = {};
  for (const p of paths) {
    try {
      const c = JSON.parse(fs.readFileSync(p, 'utf8'));
      const name = path.basename(p);
      const count = Object.keys(c.mcpServers || {}).length;
      sources[name] = count;
      if (c.mcpServers) Object.assign(servers, c.mcpServers);
    } catch {}
  }
  return { servers, sources, total: Object.keys(servers).length };
}

// ── Load Skills ──────────────────────────────────────────────
function loadSkills() {
  const dirs = [
    path.join(HOME, '.hakster', 'skills'),
    path.join(HOME, 'haksterAi', 'skills'),
  ];
  const skills = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d, prefix = '') => {
      try {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) walk(full, prefix ? `${prefix}/${e.name}` : e.name);
          else if (e.name.endsWith('.md')) {
            const content = fs.readFileSync(full, 'utf8');
            skills.push({ name: e.name.replace(/\.md$/, ''), category: prefix || 'general', path: full, size: content.length });
          }
        }
      } catch {}
    };
    walk(dir);
  }
  return skills;
}

// ── Load 54 Agent Roster ─────────────────────────────────────
function loadAgents() {
  try { return JSON.parse(fs.readFileSync(path.join(HOME, 'config', 'agents.json'), 'utf8')).agents || []; }
  catch { return []; }
}

function httpGet(url, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function binExists(name) {
  try { execSync(`which ${name.split('/')[0]} 2>/dev/null`, { encoding: 'utf8' }); return true; }
  catch { return false; }
}

// ── FULL STATUS ──────────────────────────────────────────────
async function fullStatus() {
  console.log(`\n  ${C.purple('🚀 Phantom Boost — Full System Status')}\n`);

  // PM2
  console.log(`  ${C.bold('📡 Services (PM2)')}`);
  try {
    const pm2 = JSON.parse(execSync('pm2 jlist 2>/dev/null', { encoding: 'utf8', timeout: 3000 }));
    for (const p of pm2) {
      const ok = p.pm2_env?.status === 'online' ? C.green('●') : C.red('●');
      const mem = (p.monit?.memory / 1048576).toFixed(1);
      console.log(`  ${ok} ${C.bold((p.name||'unknown').padEnd(22))} ${C.gray(`mem:${mem}MB`)}`);
    }
  } catch { console.log(`  ${C.red('✗')} PM2 not responding`); }

  // Ollama
  console.log(`\n  ${C.bold('🧠 Ollama (local LLM)')}`);
  try {
    const tags = JSON.parse(await httpGet('http://localhost:11434/api/tags'));
    for (const m of (tags.models||[]).slice(0,6)) {
      const size = (m.size / 1e9).toFixed(1);
      console.log(`  ${C.green('●')} ${m.name.padEnd(42)} ${C.gray(`${size}GB`)}`);
    }
  } catch { console.log(`  ${C.red('●')} Not responding`); }

  // 20 MCP Servers
  console.log(`\n  ${C.bold('🔌 MCP Servers (20)')}`);
  const { servers, sources, total } = loadMcpServers();
  for (const [name, cfg] of Object.entries(servers)) {
    const cmd = (cfg.command || '').split('/').pop();
    const exists = binExists(cfg.command?.split(' ')[0] || '');
    const icon = exists ? C.green('●') : C.yellow('○');
    const tier = cfg.tier ? `t${cfg.tier}` : 't?';
    console.log(`  ${icon} ${C.bold(name.padEnd(22))} ${C.gray(cmd.padEnd(20))} ${C.gray(tier)}`);
  }
  console.log(`  ${C.gray(`${total} servers from ${Object.keys(sources).length} configs: ${Object.entries(sources).map(([k,v])=>`${k}(${v})`).join(', ')}`)}`);

  // Skills
  console.log(`\n  ${C.bold('🧪 Skills')}`);
  const skills = loadSkills();
  const byCat = {};
  for (const s of skills) (byCat[s.category] = byCat[s.category] || []).push(s);
  for (const [cat, items] of Object.entries(byCat)) {
    console.log(`  ${C.cyan(`[${cat}]`)} ${items.map(s => s.name).join(', ')}`);
  }
  console.log(`  ${C.gray(`Total: ${skills.length} skills`)}`);

  // 54 Agents
  console.log(`\n  ${C.bold('🤖 Agents (54)')}`);
  const agents = loadAgents();
  const cats = {};
  for (const a of agents) (cats[a.category] = cats[a.category] || []).push(a);
  for (const [cat, items] of Object.entries(cats)) {
    console.log(`  ${C.cyan(`[${cat}]`)} ${items.map(a => a.id).join(', ')}`);
  }
  console.log(`  ${C.gray(`Total: ${agents.length} agents`)}`);

  // LLM Providers
  console.log(`\n  ${C.bold('⚡ LLM Providers')}`);
  const providers = [
    ['Ollama', 'http://localhost:11434/api/tags'],
    ['Phantom API', 'http://localhost:4000/api/health'],
    ['Miniforge Bot', 'http://localhost:5555/health'],
  ];
  for (const [name, url] of providers) {
    try { await httpGet(url, 1500); console.log(`  ${C.green('●')} ${C.bold(name.padEnd(18))} running`); }
    catch { console.log(`  ${C.red('●')} ${C.bold(name.padEnd(18))} down`); }
  }

  // API Keys
  const envFile = path.join(HOME, '.env');
  if (fs.existsSync(envFile)) {
    const env = fs.readFileSync(envFile, 'utf8');
    console.log(`\n  ${C.bold('🔑 API Keys')}`);
    for (const k of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GROQ_API_KEY','GEMINI_API_KEY','OPENROUTER_API_KEY']) {
      const has = env.includes(k) && !env.includes(`${k}=""`) && !env.includes(`${k}=your-`);
      console.log(`  ${has ? C.green('●') : C.yellow('○')} ${k.padEnd(28)} ${has ? C.green('set') : C.gray('—')}`);
    }
  }

  console.log(`\n  ${C.purple('──────────────────────────────────────────────────')}`);
  console.log(`  ${C.bold('Commands:')}`);
  console.log(`  ${C.cyan('phantom boost mcp')}        — 20 MCP servers detail`);
  console.log(`  ${C.cyan('phantom boost skills')}    — Skills listing`);
  console.log(`  ${C.cyan('phantom boost routes')}    — LLM routing detail`);
  console.log(`  ${C.cyan('phantom boost run <id>')}  — Run a skill\n`);
}

// ── MCP detail ───────────────────────────────────────────────
async function mcpStatus() {
  console.log(`\n  ${C.purple('🔌 MCP Servers — 20 Servers Detail')}\n`);
  const { servers, sources, total } = loadMcpServers();
  for (const [name, cfg] of Object.entries(servers)) {
    const cmd = cfg.command || '';
    const exists = binExists(cmd.split(' ')[0] || cmd);
    const icon = exists ? C.green('✓') : C.red('✗');
    const args = (cfg.args || []).join(' ').slice(0, 70);
    const tier = cfg.tier || '—';
    console.log(`  ${icon} ${C.bold(name)}`);
    console.log(`    Command: ${cmd} ${args}`);
    console.log(`    Tier: ${tier}   Binary: ${exists ? C.green('found') : C.red('missing')}`);
    if (cfg.env && Object.keys(cfg.env).length) {
      const envKeys = Object.keys(cfg.env).join(', ');
      console.log(`    Env: ${C.gray(envKeys)}`);
    }
    console.log('');
  }
  console.log(`  ${C.gray(`${total} servers from ${Object.keys(sources).length} config files`)}`);
  console.log(`  ${C.gray(`Sources: ${Object.entries(sources).map(([k,v])=>`${k}(${v})`).join(', ')}`)}`);
  console.log('');
}

// ── Skills ───────────────────────────────────────────────────
function skillsStatus() {
  console.log(`\n  ${C.purple('🧪 HaksterAI Skills')}\n`);
  const skills = loadSkills();
  const byCat = {};
  for (const s of skills) (byCat[s.category] = byCat[s.category] || []).push(s);
  for (const [cat, items] of Object.entries(byCat)) {
    console.log(`  ${C.cyan(`[${cat}]`)}`);
    for (const s of items) {
      console.log(`    ${C.green(s.name.padEnd(30))} ${C.gray(`${s.size.toLocaleString()}b`)}`);
    }
  }
  console.log(`\n  Total: ${skills.length} skills across ${Object.keys(byCat).length} categories\n`);
}

// ── LLM Routes ───────────────────────────────────────────────
async function routesStatus() {
  console.log(`\n  ${C.purple('⚡ LLM Routing Status')}\n`);
  for (const [name, url] of [
    ['Ollama (localhost:11434)', 'http://localhost:11434/api/tags'],
    ['Phantom API (localhost:4000)', 'http://localhost:4000/api/health'],
    ['Miniforge (localhost:5555)', 'http://localhost:5555/health'],
  ]) {
    try {
      const d = await httpGet(url, 1500);
      try { const m = JSON.parse(d); console.log(`  ${C.green('●')} ${C.bold(name.padEnd(36))} ${C.green(`${(m.models||[]).length} models`)}`); }
      catch { console.log(`  ${C.green('●')} ${C.bold(name.padEnd(36))} ${C.green('running')}`); }
    } catch { console.log(`  ${C.red('●')} ${C.bold(name.padEnd(36))} ${C.red('down')}`); }
  }

  try {
    const cfg = fs.readFileSync(path.join(HOME, '.hakster', 'hakster.config.js'), 'utf8');
    const mainModel = cfg.match(/main:\s*["']([^"']+)["']/)?.[1];
    const shadowMode = cfg.match(/shadow:\s*(true|false)/)?.[1];
    console.log(`\n  ${C.bold('Provider Routing:')}`);
    console.log(`    Primary:     ${C.bold(mainModel || 'hp-1000:latest')}`);
    console.log(`    Shadow mode: ${shadowMode === 'true' ? C.green('ON') : C.gray('OFF')}`);
    const providerLines = cfg.match(/providers:\s*\{([^}]+)\}/s);
    if (providerLines) {
      const enabled = [...providerLines[1].matchAll(/(\w+):\s*(true|false)/g)].map(m => `    ${m[1]}: ${m[2] === 'true' ? C.green('✓') : C.gray('✗')}`);
      console.log(enabled.join('\n'));
    }
  } catch { console.log(`    ${C.yellow('Config not readable')}`); }
  console.log('');
}

// ── Run skill ────────────────────────────────────────────────
function runSkill(name) {
  const skills = loadSkills();
  const skill = skills.find(s => s.name === name || s.name.includes(name));
  if (!skill) {
    console.log(`\n  ${C.red(`✗ Skill "${name}" not found`)}`);
    console.log(`  Use ${C.bold('phantom boost skills')} to list available skills\n`);
    process.exit(1);
  }
  console.log(`\n  ${C.purple('📖 ' + skill.name)} (${skill.category})`);
  console.log(`  Path: ${skill.path}\n`);
  console.log(fs.readFileSync(skill.path, 'utf8'));
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const sub = process.argv[2] || 'status';
  switch (sub) {
    case 'mcp':     return mcpStatus();
    case 'skills':  return skillsStatus();
    case 'routes':  return routesStatus();
    case 'run':     return runSkill(process.argv[3] || '');
    case 'status':
    default:        return fullStatus();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });