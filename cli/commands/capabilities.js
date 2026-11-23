'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

function runCapabilities() {
  const r = spawnSync('python3', [path.join(ROOT,'core','run_report.py')], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env,
      PHANTOM_PORT:      process.env.PHANTOM_PORT      || '4000',
      PHANTOM_OWNER:     process.env.PHANTOM_OWNER     || 'deke',
      PHANTOM_WORKSPACE: process.env.PHANTOM_WORKSPACE || process.env.HOME }
  });
  if (r.stderr && r.stderr.trim()) process.stderr.write(r.stderr);
  console.log(r.stdout || '[capabilities] No output — check Python deps (pip install psutil requests)');
}

module.exports = { runCapabilities };
