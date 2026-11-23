'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const CFG  = path.join(ROOT,'config','agents.json');

function configAgents() {
  const editor = process.env.EDITOR || 'nano';
  if (process.stdout.isTTY) {
    spawnSync(editor, [CFG], { stdio:'inherit' });
  } else {
    const d = JSON.parse(fs.readFileSync(CFG,'utf8'));
    console.log(`  Config: ${CFG}\n  Agents: ${d.agents.length}`);
  }
}

module.exports = { configAgents };
