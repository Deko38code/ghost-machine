// Read-only verification for the Junkalot toast service (127.0.0.1:3001).
// The key is read from the owner's key file and never printed.
const fs = require('fs');
const path = require('path');
const { WebSocket } = require(process.env.WS_MODULE || '/home/ghost694/junkalot/node_modules/ws');

const base = 'http://127.0.0.1:3001';
const key = fs.readFileSync('/home/ghost694/.junkalot-toast-key', 'utf8').trim();

const post = async (body, header) => {
  const res = await fetch(base + '/api/toast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...header },
    body: JSON.stringify(body),
  });
  return res.status;
};

(async () => {
  const health = await fetch(base + '/healthz').then((r) => r.json());
  console.log('healthz            ', JSON.stringify(health));

  console.log('POST no key        ', await post({ type: 'info', title: 'x', message: 'y' }, {}), '(expect 401)');
  console.log('POST wrong key     ', await post({ type: 'info', title: 'x', message: 'y' }, { 'x-toast-api-key': 'nope-' + key.length }), '(expect 401)');

  const ws = new WebSocket('ws://127.0.0.1:3001/ws/status');
  const got = [];
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ws connect timeout')), 5000);
    ws.on('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.on('error', reject);
    ws.on('message', (m) => got.push(JSON.parse(String(m))));
  });
  console.log('ws connected        ', 'yes');

  console.log('POST toast (key)   ', await post({ type: 'success', title: 'Junkalot Updated', message: 'Production deployment completed.' }, { 'x-toast-api-key': key }), '(expect 200)');
  console.log('POST progress (key)', await post({ type: 'progress', percent: 75, message: 'Deploying Junkalot update...' }, { 'x-toast-api-key': key }), '(expect 200)');
  console.log('POST progress bad  ', await post({ type: 'progress', percent: 180, message: 'x' }, { 'x-toast-api-key': key }), '(expect 400)');
  console.log('POST bad type      ', await post({ type: 'nope', title: 'x', message: 'y' }, { 'x-toast-api-key': key }), '(expect 400)');

  await new Promise((r) => setTimeout(r, 600));
  ws.close();
  console.log('ws events received ', got.length);
  for (const e of got) console.log('   ', JSON.stringify(e));
})();
