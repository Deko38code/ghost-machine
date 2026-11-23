#!/usr/bin/env node
// Restart the phantom pm2 app with its CURRENT environment preserved plus the
// support-bridge flag. Reads the live process env from /proc/<pid>/environ and
// passes it to pm2 --update-env, so no key is dropped and no value is printed.
const fs = require('fs');
const { spawnSync } = require('child_process');

const PM2 = '/home/ghost694/.npm-global/lib/node_modules/pm2/bin/pm2';
const pid = Number(process.argv[2]);
if (!pid) { console.error('usage: restart-phantom-preserve-env.js <pid>'); process.exit(2); }

const cmdline = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').join(' ');
if (!cmdline.includes('phantom-server.js')) { console.error('pid is not phantom-server.js'); process.exit(2); }

const env = {};
for (const kv of fs.readFileSync('/proc/' + pid + '/environ', 'utf8').split('\0')) {
  if (!kv) continue;
  const i = kv.indexOf('=');
  if (i > 0) env[kv.slice(0, i)] = kv.slice(i + 1);
}
const keysBefore = Object.keys(env).length;
env.PHANTOM_SUPPORT_BRIDGE = '1';
env.PHANTOM_SUPPORT_PRESENCE_MINUTES = '15';

const run = (args) => spawnSync(PM2, args, { env: { ...process.env, ...env }, stdio: 'inherit' }).status;
console.log('env keys preserved:', keysBefore, '-> adding PHANTOM_SUPPORT_BRIDGE=1');
const restart = run(['restart', 'phantom', '--update-env']);
console.log('restart exit:', restart);
if (restart !== 0) process.exit(restart);
const save = run(['save']);
console.log('save exit:', save);
process.exit(save || 0);
