'use strict';
//
// haksterAi MCP stdio client
// Real MCP client: reads ~/.hakster/mcp.json, spawns each server, does the
// JSON-RPC 2.0 handshake (initialize -> tools/list), then proxies tools/call.
//
// Usage:
//   const mcp = require('./mcp-client');
//   await mcp.connectAll();          // load config + spawn + handshake
//   mcp.listTools();                 // [{server, name, description, inputSchema}]
//   await mcp.callTool('fs.read', {path:'/tmp'});
//   await mcp.closeAll();
//

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATHS = [
  process.env.HAKSTER_MCP_CONFIG,
  path.join(os.homedir(), '.hakster', 'mcp.json'),
  path.join(process.cwd(), '.hakster', 'mcp.json'),
].filter(Boolean);

const DEFAULT_TIMEOUT = 30000;

function log(...a) {
  if (process.env.HAKSTER_MCP_DEBUG) console.error('[mcp]', ...a);
}

function loadConfig() {
  for (const p of CONFIG_PATHS) {
    try {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        const servers = raw.mcpServers || raw.servers || {};
        log('config from', p, Object.keys(servers).length, 'servers');
        return { path: p, servers };
      }
    } catch (e) {
      log('bad config', p, e.message);
    }
  }
  return { path: null, servers: {} };
}

// One MCP server connection over stdio.
class McpConnection {
  constructor(name, cfg) {
    this.name = name;
    this.cfg = cfg || {};
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map();
    this.buf = '';
    this.tools = [];
    this.serverInfo = null;
    this.alive = false;
  }

  spawnProc() {
    const { command, args = [], env = {}, cwd } = this.cfg;
    if (!command) throw new Error(`server "${this.name}" has no command`);

    this.proc = spawn(command, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (d) => this._onData(d));
    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (d) => log(this.name, 'stderr:', String(d).trim().slice(0, 300)));
    this.proc.on('exit', (code, sig) => {
      this.alive = false;
      log(this.name, 'exited', code, sig);
      for (const [, p] of this.pending) p.reject(new Error(`${this.name} exited (${code})`));
      this.pending.clear();
    });
    this.proc.on('error', (e) => {
      this.alive = false;
      log(this.name, 'spawn error', e.message);
      for (const [, p] of this.pending) p.reject(e);
      this.pending.clear();
    });
  }

  _onData(chunk) {
    this.buf += chunk;
    // MCP stdio uses newline-delimited JSON
    let idx;
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        log(this.name, 'non-json line:', line.slice(0, 200));
        continue;
      }
      this._onMessage(msg);
    }
  }

  _onMessage(msg) {
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject, timer } = this.pending.get(msg.id);
      clearTimeout(timer);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    // server-initiated notifications (logging etc.) - ignore safely
    if (msg.method) log(this.name, 'notify', msg.method);
  }

  request(method, params, timeoutMs = DEFAULT_TIMEOUT) {
    if (!this.proc || !this.alive) return Promise.reject(new Error(`${this.name} not connected`));
    const id = this.nextId++;
    const payload = { jsonrpc: '2.0', id, method, params: params || {} };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.name}: ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.proc.stdin.write(JSON.stringify(payload) + '\n');
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  notify(method, params) {
    if (!this.proc || !this.alive) return;
    try {
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params: params || {} }) + '\n');
    } catch (e) {
      log(this.name, 'notify failed', e.message);
    }
  }

  async connect(timeoutMs = DEFAULT_TIMEOUT) {
    this.spawnProc();
    this.alive = true;

    const init = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, resources: {}, prompts: {} },
      clientInfo: { name: 'haksterai-cli', version: '0.1.0' },
    }, timeoutMs);

    this.serverInfo = (init && init.serverInfo) || { name: this.name };
    this.notify('notifications/initialized');

    try {
      const tl = await this.request('tools/list', {}, timeoutMs);
      this.tools = (tl && tl.tools) || [];
    } catch (e) {
      log(this.name, 'tools/list failed:', e.message);
      this.tools = [];
    }
    return this;
  }

  async callTool(name, args, timeoutMs = DEFAULT_TIMEOUT) {
    const res = await this.request('tools/call', { name, arguments: args || {} }, timeoutMs);
    if (res && res.isError) {
      const text = (res.content || []).map((c) => c.text || '').join('\n');
      throw new Error(text || `${this.name}: tool ${name} returned error`);
    }
    return res;
  }

  close() {
    this.alive = false;
    if (this.proc) {
      try { this.proc.stdin.end(); } catch {}
      try { this.proc.kill('SIGTERM'); } catch {}
      this.proc = null;
    }
  }
}

class McpManager {
  constructor() {
    this.connections = new Map();
    this.configPath = null;
    this.lastErrors = [];
  }

  async connectAll(opts = {}) {
    const cfg = loadConfig();
    this.configPath = cfg.path;
    this.lastErrors = [];
    const names = Object.keys(cfg.servers);
    if (!names.length) return { connected: [], failed: [], configPath: cfg.path };

    const timeout = opts.timeoutMs || DEFAULT_TIMEOUT;
    const results = await Promise.allSettled(
      names.map(async (name) => {
        const conn = new McpConnection(name, cfg.servers[name]);
        await conn.connect(timeout);
        this.connections.set(name, conn);
        return name;
      })
    );

    const connected = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') connected.push(r.value);
      else {
        failed.push({ name: names[i], error: r.reason && r.reason.message });
        this.lastErrors.push(`${names[i]}: ${r.reason && r.reason.message}`);
      }
    });
    return { connected, failed, configPath: cfg.path };
  }

  listTools() {
    const out = [];
    for (const [server, conn] of this.connections) {
      for (const t of conn.tools) {
        out.push({
          server,
          name: t.name,
          qualified: `${server}.${t.name}`,
          description: t.description || '',
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        });
      }
    }
    return out;
  }

  // Accepts "server.tool" or a bare tool name (first match wins).
  async callTool(qualified, args, timeoutMs) {
    let server;
    let tool = qualified;
    const dot = qualified.indexOf('.');
    if (dot !== -1 && this.connections.has(qualified.slice(0, dot))) {
      server = qualified.slice(0, dot);
      tool = qualified.slice(dot + 1);
    } else {
      for (const [s, conn] of this.connections) {
        if (conn.tools.some((t) => t.name === tool)) { server = s; break; }
      }
    }
    if (!server) throw new Error(`no MCP server provides tool "${qualified}"`);
    const conn = this.connections.get(server);
    return conn.callTool(tool, args, timeoutMs);
  }

  status() {
    return Array.from(this.connections.entries()).map(([name, c]) => ({
      name,
      connected: c.alive,
      tools: c.tools.length,
      serverInfo: c.serverInfo,
    }));
  }

  closeAll() {
    for (const [, c] of this.connections) c.close();
    this.connections.clear();
  }
}

// Convert MCP tools into OpenAI-style function/tool definitions for the agent loop.
function toOpenAITools(mcpManager) {
  return mcpManager.listTools().map((t) => ({
    type: 'function',
    function: {
      name: t.qualified.replace(/[^a-zA-Z0-9_-]/g, '_'),
      description: `[mcp:${t.server}] ${t.description}`.slice(0, 1024),
      parameters: t.inputSchema,
    },
  }));
}

module.exports = {
  McpManager,
  McpConnection,
  loadConfig,
  toOpenAITools,
  singleton: new McpManager(),
};
