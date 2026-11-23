'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

function usageShow(userId) {
  const uid = userId || process.env.PHANTOM_USER || 'default';
  spawnSync('python3',[path.join(ROOT,'core','run_usage.py'), uid],
    { cwd:ROOT, encoding:'utf8', stdio:'inherit', env:{...process.env} });
}

module.exports = { usageShow };
