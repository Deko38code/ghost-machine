#!/usr/bin/env node
/**
 * MCP<->Kiro bridge (DISABLED stub).
 * kiro-cli opens a browser GUI which hangs headless environments.
 * This stub responds to MCP protocol cleanly without spawning kiro-cli.
 * Prevents MCP startup hang while keeping the server "connected".
 */
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'initialize') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'kiro-bridge', version: '2.0.0' } } }));
    } else if (msg.method === 'tools/list') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } }));
    } else if (msg.method === 'tools/call') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'kiro bridge disabled (prevents headless hang)' } }));
    } else if (msg.method === 'shutdown') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }));
      process.exit(0);
    } else {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }));
    }
  } catch (e) {
    // Ignore malformed lines
  }
});

// Keep process alive — don't exit until stdin closes or shutdown received