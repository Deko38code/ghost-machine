'use strict';
/**
 * PHANTOM MCP BRIDGE — Connects Phantom CLI to all MCP servers & HaksterAI skills
 * Usage: phantom mcp list          — List available MCP servers
 *        phantom mcp call <server> <tool> <args>  — Call MCP tool
 *        phantom mcp skills        — List loaded HaksterAI skills
 *        phantom mcp skill <name>  — Load a HaksterAI skill into context
 *        phantom mcp status        — Health check all servers
 */
const { spawn, execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http  = require('http');
const HOME  = process.env.HOME || '/home/ghost';

// ── MCP Config ──────────────────────────────────────────────
const MCP_CONFIG_PATHS = [
  path.join(HOME, 'mcp.json'),
  path.join(HOME, '.hakster', 'mcp.json'),
  path.join(HOME, '.hakster', 'mcp-servers.json'),
  path.join(HOME, '.claude', 'mcp.json'),
];

function loadMcpConfig() {
  const merged = { mcpServers: {} };
  for (const p of MCP_CONFIG_PATHS) {
    try {
      const c = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (c.mcpServers) Object.assign(merged.mcpServers, c.mcpServers);
    } catch {}
  }
  return merged;
}

// ── Skills ──────────────────────────────────────────────────
const SKILLS_DIRS = [
  path.join(HOME, '.hakster', 'skills'),
  path.join(HOME, 'haksterAi', 'skills'),
  path.join(HOME, 'phantom-team'),
];

function loadSkills() {
  const skills = [];
  for (const dir of SKILLS_DIRS) {
    try {
      if (!fs.existsSync(dir)) continue;
      const walk = (d, prefix = '') => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) {
            walk(full, prefix ? `${prefix}/${entry.name}` : entry.name);
          } else if (entry.name.endsWith('.md')) {
            try {
              const content = fs.readFileSync(full, 'utf8');
              const cat = prefix || 'general';
              skills.push({
                name: entry.name.replace(/\.md$/, ''),
                category: cat,
                path: full,
                preview: content.slice(0, 200).replace(/\n/g, ' '),
                size: content.length,
              });
            } catch {}
          }
        }
      };
      walk(dir);
    } catch {}
  }
  return skills;
}

// ── MCP Server Discovery ────────────────────────────────────
function listServers() {
  const config = loadMcpConfig();
  const servers = Object.entries(config.mcpServers || {});
  if (!servers.length) {
    console.log('\n  \x1b[33m⚠ No MCP servers found\x1b[0m');
    console.log('  Checked paths:');
    MCP_CONFIG_PATHS.forEach(p => console.log(`    ${p}`));
    return;
  }
  console.log('\n  \x1b[95m🔌 MCP Servers\x1b[0m\n');
  for (const [name, cfg] of servers) {
    const cmd = cfg.command || 'unknown';
    const tier = cfg.tier || '—';
    const running = isServerRunning(name);
    const statusIcon = running ? '\x1b[92m●\x1b[0m' : '\x1b[90m○\x1b[0m';
    const tierColor = tier === 1 ? '\x1b[92m' : tier === 2 ? '\x1b[93m' : tier === 3 ? '\x1b[91m' : '\x1b[90m';
    console.log(`  ${statusIcon} \x1b[1m${name.padEnd(22)}\x1b[0m ${cmd.padEnd(40)} ${tierColor}tier:${tier}\x1b[0m`);
    if (cfg.args) console.log(`    ${' '.repeat(22)} args: ${cfg.args.join(' ').slice(0, 60)}`);
  }
  console.log(`\n  Total: ${servers.length} servers\n`);
}

function isServerRunning(name) {
  try {
    const out = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf8', timeout: 3000 });
    return out.includes(name);
  } catch {}
  return false;
}

// ── MCP Server Status ────────────────────────────────────────
async function status() {
  const config = loadMcpConfig();
  const servers = Object.entries(config.mcpServers || {});
  console.log('\n  \x1b[95m📡 MCP Server Health Check\x1b[0m\n');

  for (const [name, cfg] of servers) {
    const cmd = cfg.command || '';
    try {
      // Check if command exists
      const which = execSync(`which ${cmd.split(' ')[0]} 2>/dev/null`, { encoding: 'utf8' }).trim();
      console.log(`  \x1b[92m✓\x1b[0m \x1b[1m${name}\x1b[0m — binary found: ${which.split('/').pop()}`);
    } catch {
      console.log(`  \x1b[91m✗\x1b[0m \x1b[1m${name}\x1b[0m — binary NOT found: ${cmd}`);
    }
  }

  // Check Phantom server
  try {
    const res = await httpGet('http://localhost:4000/api/health', 2000);
    console.log(`  \x1b[92m✓\x1b[0m \x1b[1mphantom-server\x1b[0m — running on :4000`);
  } catch {
    console.log(`  \x1b[91m✗\x1b[0m \x1b[1mphantom-server\x1b[0m — NOT responding on :4000`);
  }

  // Check Ollama
  try {
    const res = await httpGet('http://localhost:11434/api/tags', 2000);
    const models = JSON.parse(res);
    const count = models?.models?.length || 0;
    console.log(`  \x1b[92m✓\x1b[0m \x1b[1mollama\x1b[0m — ${count} models loaded`);
  } catch {
    console.log(`  \x1b[91m✗\x1b[0m \x1b[1mollama\x1b[0m — NOT responding`);
  }

  console.log('');
}

function httpGet(url, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Skills ──────────────────────────────────────────────────
function listSkills() {
  const skills = loadSkills();
  if (!skills.length) {
    console.log('\n  \x1b[33m⚠ No HaksterAI skills found\x1b[0m');
    return;
  }
  console.log('\n  \x1b[95m🧠 HaksterAI Skills\x1b[0m\n');
  const byCategory = {};
  for (const s of skills) {
    (byCategory[s.category] = byCategory[s.category] || []).push(s);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    console.log(`\x1b[36m  [${cat}]\x1b[0m`);
    for (const s of items) {
      console.log(`    \x1b[92m${s.name.padEnd(30)}\x1b[0m ${s.size.toLocaleString()} bytes`);
    }
  }
  console.log(`\n  Total: ${skills.length} skills\n`);
}

function showSkill(name) {
  const skills = loadSkills();
  const skill = skills.find(s => s.name === name || s.name.includes(name));
  if (!skill) {
    console.log(`\n  \x1b[91m✗ Skill "${name}" not found\x1b[0m`);
    console.log('  Use \x1b[1mphantom mcp skills\x1b[0m to list available skills\n');
    return;
  }
  console.log(`\n  \x1b[95m📖 ${skill.name}\x1b[0m (${skill.category})`);
  console.log(`  Path: ${skill.path}`);
  console.log(`  Size: ${skill.size.toLocaleString()} bytes\n`);
  console.log(fs.readFileSync(skill.path, 'utf8'));
}

// ── MCP Tool Call (stdin/stdout bridge) ──────────────────────
async function callTool(serverName, toolName, argsJson = '{}') {
  const config = loadMcpConfig();
  const serverCfg = config.mcpServers?.[serverName];
  if (!serverCfg) {
    console.error(`\n  \x1b[91m✗ MCP server "${serverName}" not found\x1b[0m`);
    console.log('  Use \x1b[1mphantom mcp list\x1b[0m to see available servers\n');
    process.exit(1);
  }

  const cmd = serverCfg.command;
  const serverArgs = serverCfg.args || [];
  const env = { ...process.env, ...(serverCfg.env || {}) };

  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson,
    }
  };

  console.log(`\n  \x1b[95m🔌 Calling\x1b[0m \x1b[1m${serverName}\x1b[0m.\x1b[1m${toolName}\x1b[0m`);
  console.log(`  Command: ${cmd} ${serverArgs.join(' ')}\n`);

  const child = spawn(cmd, serverArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });

  // Send JSON-RPC request
  const requestStr = JSON.stringify(request) + '\n';
  child.stdin.write(requestStr);
  child.stdin.end();

  let stdout = '', stderr = '';
  child.stdout.on('data', d => stdout += d);
  child.stderr.on('data', d => stderr += d);

  return new Promise((resolve) => {
    child.on('close', (code) => {
      // Parse JSON-RPC response (may have interleaved non-JSON lines)
      const lines = stdout.split('\n');
      let result = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result) { result = parsed.result; break; }
        } catch {}
      }
      if (result) {
        const content = result.content || [];
        console.log('  \x1b[92m✓ Result:\x1b[0m');
        for (const c of content) {
          if (c.type === 'text') console.log(c.text);
        }
      } else {
        console.log('  \x1b[93m⚠ Raw output:\x1b[0m');
        console.log(stdout.slice(0, 2000));
        if (stderr) console.log('\n  \x1b[91mstderr:\x1b[0m', stderr.slice(0, 500));
      }
      console.log('');
      resolve(result);
    });

    setTimeout(() => {
      child.kill('SIGTERM');
      resolve(null);
    }, 30000);
  });
}

// ── List tools from a server ────────────────────────────────
async function listTools(serverName) {
  const config = loadMcpConfig();
  const serverCfg = config.mcpServers?.[serverName];
  if (!serverCfg) {
    console.error(`\n  \x1b[91m✗ MCP server "${serverName}" not found\x1b[0m\n`);
    process.exit(1);
  }

  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  const child = spawn(serverCfg.command, serverCfg.args || [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...(serverCfg.env || {}) },
  });

  child.stdin.write(JSON.stringify(request) + '\n');
  child.stdin.end();

  let stdout = '';
  child.stdout.on('data', d => stdout += d);

  return new Promise((resolve) => {
    child.on('close', () => {
      const lines = stdout.split('\n');
      let tools = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result?.tools) { tools = parsed.result.tools; break; }
        } catch {}
      }
      if (tools.length) {
        console.log(`\n  \x1b[95m🔧 ${serverName} — ${tools.length} tools\x1b[0m\n`);
        for (const t of tools) {
          const desc = (t.description || '').slice(0, 60);
          console.log(`  \x1b[92m${t.name.padEnd(35)}\x1b[0m ${desc}`);
        }
        console.log('');
      } else {
        console.log(`\n  \x1b[33m⚠ Could not list tools for ${serverName}\x1b[0m`);
        console.log(`  Raw output:\n${stdout.slice(0, 500)}\n`);
      }
      resolve(tools);
    });
    setTimeout(() => { child.kill(); resolve([]); }, 10000);
  });
}

// ── Export ───────────────────────────────────────────────────
module.exports = { listServers, status, listSkills, showSkill, callTool, listTools, loadMcpConfig, loadSkills };