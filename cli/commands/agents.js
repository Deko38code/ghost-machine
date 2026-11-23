'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');

function agentsList() {
  const data    = JSON.parse(fs.readFileSync(path.join(ROOT,'config','agents.json'),'utf8'));
  const agents  = data.agents;
  const cats    = {};
  agents.forEach(a => { cats[a.category] = cats[a.category]||[]; cats[a.category].push(a); });

  console.log('\n  \x1b[95m👻 Phantom Agents\x1b[0m\n');
  for (const [cat, list] of Object.entries(cats)) {
    console.log(`\x1b[36m  [${cat}]\x1b[0m`);
    list.forEach(a => console.log(`    \x1b[92m${a.id.padEnd(20)}\x1b[0m ${a.name.padEnd(28)} \x1b[90m${a.description}\x1b[0m`));
  }
  console.log(`\n  Total: ${agents.length} agents\n`);
}

function agentsRun(agentId, prompt, opts={}) {
  if (!agentId || !prompt) { console.error('Usage: phantom agents run <id> "<prompt>"'); process.exit(1); }
  const uid     = opts.userId || process.env.PHANTOM_USER || 'default';
  const tier    = opts.tier   || process.env.PHANTOM_TIER || 'free';
  const verbose = opts.verbose ? '1' : '0';
  console.log(`\n  \x1b[95m👻 Agent: ${agentId}\x1b[0m  tier:${tier}  user:${uid}\n`);
  spawnSync('python3',[path.join(ROOT,'core','run_agent.py'), agentId, prompt, uid, tier, verbose],
    { cwd:ROOT, encoding:'utf8', stdio:'inherit', env:{...process.env} });
}

module.exports = { agentsList, agentsRun };
