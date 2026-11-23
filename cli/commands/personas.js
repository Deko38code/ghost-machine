
/**
 * PHANTOM PERSONAS — ONE unified path for ALL agent wrappers.
 * Registry verified on disk 2026-11-06 via `file`:
 *   claude    → symlink /home/ghost/.local/share/claude/versions/2.1.319 (ELF)
 *   codex     → symlink /home/ghost/.codex/packages/standalone/current/bin/codex
 *   hermes    → sh script → /home/ghost/.hermes/hermes-agent/.hermes/bin/hermes
 *   hakster   → symlink /home/ghost/haksterAi/cli/index.js
 *   haksterai → symlink /home/ghost/.local/share/hakster-cli/cli/index.js
 *   crush     → ELF 64-bit Go binary (static)
 *   phantom   → Node.js script /usr/local/bin/phantom
 * Every persona resolves + launches through this SAME module.
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');

const PERSONAS = {
  claude:    { bin: '/home/ghost/.local/bin/claude',    type: 'symlink->ELF' },
  codex:     { bin: '/home/ghost/.local/bin/codex',     type: 'symlink->bin' },
  hermes:    { bin: '/home/ghost/.local/bin/hermes',    type: 'sh-script' },
  hakster:   { bin: '/home/ghost/.local/bin/hakster',   type: 'symlink->js' },
  haksterai: { bin: '/home/ghost/.local/bin/haksterai', type: 'symlink->js' },
  crush:     { bin: '/home/ghost/.local/bin/crush',     type: 'ELF-go' },
  phantom:   { bin: '/usr/local/bin/phantom',           type: 'node-script' }
};

function list() {
  console.log('\n\x1b[95m👤 phantom personas — unified agent registry\x1b[0m\n');
  for (const [name, p] of Object.entries(PERSONAS)) {
    const ok = fs.existsSync(p.bin) ? '✅' : '❌';
    console.log(`  ${ok} ${name.padEnd(10)} ${p.type.padEnd(13)} ${p.bin}`);
  }
  console.log('\n  All personas route through the SAME agentic path.\n');
}

function run(name, argsStr, opts = {}) {
  const p = PERSONAS[name];
  if (!p) { console.error(`[personas] unknown persona: ${name}`); list(); process.exit(1); }
  if (!fs.existsSync(p.bin)) { console.error(`[personas] ${name} binary missing: ${p.bin}`); process.exit(1); }
  if (opts.verbose) console.log(`[personas] unified path → ${name} (${p.bin})`);
  const args = argsStr ? argsStr.split(' ').filter(Boolean) : [];
  const r = spawnSync(p.bin, args, { stdio: 'inherit' });
  process.exit(r.status || 0);
}

function help() {
  console.log(`
  \x1b[95m👤 phantom personas — all wrappers, one path\x1b[0m

  \x1b[1mUsage:\x1b[0m
    phantom personas list               List all personas + status
    phantom personas run <name> <args>  Run any persona through the unified path
`);
}

module.exports = { PERSONAS, list, run, help };
