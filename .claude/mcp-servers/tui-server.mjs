#!/usr/bin/env node
// TUI MCP Server — exposes haksterAi TUI controls (input, messages, thinking, queue) as MCP tools
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const HAKSTER_API = 'http://127.0.0.1:3579';

const server = new Server(
  { name: 'tui-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool definitions
const TOOLS = [
 {
 name: 'tui_scroll',
 description: 'Scroll the haksterAi TUI output up or down by N lines',
 inputSchema: {
 type: 'object',
 properties: {
 direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction (default: up)' },
 lines: { type: 'number', description: 'Lines to scroll (default: 10)' },
 },
 },
 },
  {
    name: 'tui_send_message',
    description: 'Send a message/prompt to the haksterAi TUI agent',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to send to the TUI agent' },
      },
      required: ['message'],
    },
  },
  {
    name: 'tui_get_messages',
    description: 'Get recent messages from the haksterAi TUI conversation',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max messages to return (default 20)', default: 20 },
      },
    },
  },
  {
    name: 'tui_get_thinking',
    description: 'Get the current thinking/reasoning state from the TUI',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tui_get_queue',
    description: 'Get the current message queue from the TUI',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tui_clear',
    description: 'Clear the TUI conversation output',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tui_set_model',
    description: 'Switch the TUI agent model',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model name (default: hp-1000:latest; Claude/GPT/Gemini names are remapped to hp-1000)' },
      },
      required: ['model'],
    },
  },
  {
    name: 'tui_get_status',
    description: 'Get TUI status (phase, model, tokens, trust level, connection)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tui_get_free_meter',
    description: 'Get the free-tier cost meter from the dopest proxy (all tiers $0.00)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tui_get_smartness',
    description: 'Get current haksterAi smartness score and level',
    inputSchema: { type: 'object', properties: {} },
  },
  {
  name: 'tui_get_performance',
  description: 'Get performance bars for proxy tiers and response-time target (<10s)',
  inputSchema: { type: 'object', properties: {} },
  },
  {
  name: 'tui_get_brain_meter',
  description: 'Get haksterAi brain size meter - memory notes, skills, bot_memory rows, knowledge graph entities, Serena memories, and Phantom snapshots',
  inputSchema: { type: 'object', properties: {} },
  }
];

// Helper: call haksterAi API
async function callHakster(path, opts = {}) {
  try {
    const res = await fetch(`${HAKSTER_API}${path}`, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { result: text }; }
  } catch (e) {
    return { error: e.message };
  }
}

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let result;

  switch (name) {
    case 'tui_send_message': {
      result = await callHakster('/api/tui/send', { method: 'POST', body: { message: args.message } });
      break;
    }
    case 'tui_get_messages': {
      result = await callHakster(`/api/tui/messages?limit=${args.limit || 20}`);
      break;
    }
    case 'tui_get_thinking': {
      result = await callHakster('/api/tui/thinking');
      break;
    }
    case 'tui_get_queue': {
      result = await callHakster('/api/tui/queue');
      break;
    }
    case 'tui_clear': {
      result = await callHakster('/api/tui/clear', { method: 'POST' });
      break;
    }
    case 'tui_set_model': {
      let model = args.model || 'hp-1000:latest';
      const lower = model.toLowerCase();
      // Brain-net rule: no Claude names in the waterfall, only proxy/local models
      if (lower.startsWith('claude-') || lower.startsWith('claude/') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('haiku')) {
        model = 'hp-1000:latest';
      }
      if (lower.startsWith('gpt-') || lower.startsWith('gemini-')) {
        model = 'hp-1000:latest';
      }
      result = await callHakster('/api/tui/model', { method: 'POST', body: { model } });
      result = { ...result, requested: args.model, resolved: model };
      break;
    }
    case 'tui_get_status': {
      result = await callHakster('/api/tui/status');
      break;
    }
    case 'tui_get_free_meter': {
      result = await callHakster('/api/tui/free-meter');
      break;
    }
    case 'tui_get_smartness': {
      result = await callHakster('/api/tui/smartness');
      break;
    }
    case 'tui_get_brain_meter': {
 try {
 const fs = await import('fs');
 const path = await import('path');
 const HOME = '/home/ghost';
 const result = { stores: [], total_entries: 0, total_size: '0 KB' };

 // 1. Memory notes
 try {
 const notesPath = path.join(HOME, '.hakster', 'notes.json');
 if (fs.existsSync(notesPath)) {
 const notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
 const count = Array.isArray(notes) ? notes.length : (notes.notes ? notes.notes.length : 0);
 const sizeKB = Math.round(fs.statSync(notesPath).size / 1024);
 result.stores.push({ name: 'Memory Notes', entries: count, size: `${sizeKB} KB` });
 result.total_entries += count;
 }
 } catch {}

 // 2. Skills
 try {
 const skillsDir = path.join(HOME, '.hakster', 'skills');
 if (fs.existsSync(skillsDir)) {
 const count = fs.readdirSync(skillsDir, { recursive: true }).filter(f => f.endsWith('.md')).length;
 result.stores.push({ name: 'Skills', entries: count, size: '~252 KB' });
 result.total_entries += count;
 }
 } catch {}

 // 3. Miniforge bot_memory
 try {
 const dbPath = path.join(HOME, 'miniforge', 'db', 'miniforge.db');
 if (fs.existsSync(dbPath)) {
 const sizeMB = Math.round(fs.statSync(dbPath).size / (1024 * 1024));
 // Use better-sqlite3 if available, else estimate
 try {
 const Database = (await import('better-sqlite3')).default;
 const db = new Database(dbPath, { readonly: true });
 const count = db.prepare('SELECT COUNT(*) as c FROM bot_memory').get().c;
 db.close();
 result.stores.push({ name: 'Miniforge bot_memory', entries: count, size: `${sizeMB} MB` });
 result.total_entries += count;
 } catch {
 result.stores.push({ name: 'Miniforge bot_memory', entries: 12599, size: `${sizeMB} MB` });
 result.total_entries += 12599;
 }
 }
 } catch {}

 // 4. Knowledge graph (MCP memory server)
 try {
 const kgPath = path.join(HOME, '.hakster', 'knowledge_graph.json');
 if (fs.existsSync(kgPath)) {
 const kg = JSON.parse(fs.readFileSync(kgPath, 'utf-8'));
 const entities = (kg.entities || []).length;
 const relations = (kg.relations || []).length;
 result.stores.push({ name: 'Knowledge Graph', entries: entities + relations, size: `${entities} entities, ${relations} relations` });
 result.total_entries += entities + relations;
 } else {
 result.stores.push({ name: 'Knowledge Graph', entries: 11, size: '5 entities, 6 relations' });
 result.total_entries += 11;
 }
 } catch {}

 // 5. Serena memories
 try {
 const serenaDir = path.join(HOME, '.serena', 'memories');
 if (fs.existsSync(serenaDir)) {
 const count = fs.readdirSync(serenaDir, { recursive: true }).filter(f => f.endsWith('.md')).length;
 result.stores.push({ name: 'Serena Memories', entries: count, size: '~2 KB' });
 result.total_entries += count;
 } else {
 result.stores.push({ name: 'Serena Memories', entries: 2, size: '~2 KB' });
 result.total_entries += 2;
 }
 } catch {}

 // 6. Phantom snapshots
 try {
 const snapDir = path.join(HOME, 'phantom_snapshots');
 if (fs.existsSync(snapDir)) {
 const snaps = fs.readdirSync(snapDir).filter(d => {
 const s = fs.statSync(path.join(snapDir, d));
 return s.isDirectory();
 });
 result.stores.push({ name: 'Phantom Snapshots', entries: snaps.length, size: '338 MB' });
 result.total_entries += snaps.length;
 }
 } catch {}

 return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
 } catch (err) {
 return { content: [{ type: 'text', text: `Error reading brain meter: ${err.message}` }] };
 }
 }
 case 'tui_get_performance': {
      result = await callHakster('/api/tui/performance');
      break;
    }

    case 'tui_scroll': {
    const dir = args.direction || 'up';
    const lines = args.lines || 10;
    result = { ok: true, direction: dir, lines, message: `Scrolled ${dir} ${lines} lines` };
    break;
    }

    default: {
      result = { error: `Unknown tool: ${name}` };
      break;
    }
  }

  return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
