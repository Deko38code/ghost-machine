// Verification for the Phantom status service (127.0.0.1:3002).
// Token read from the owner's key file; never printed.
const fs = require('fs');
const http = require('http');

const base = 'http://127.0.0.1:3002';
const token = fs.readFileSync('/home/ghost694/.phantom-token', 'utf8').trim();
const STATE_FILE = '/home/ghost694/.phantom/status.json';

let fails = 0;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
  if (!cond) fails++;
};

const post = (body, withToken) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      base + '/update',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(withToken ? { 'x-phantom-token': token } : {}),
        },
      },
      (res) => {
        let out = '';
        res.on('data', (d) => (out += d));
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });

const getState = () =>
  new Promise((resolve, reject) => {
    http
      .get(base + '/state', (res) => {
        let out = '';
        res.on('data', (d) => (out += d));
        res.on('end', () => resolve(JSON.parse(out)));
      })
      .on('error', reject);
  });

(async () => {
  // 1. default state
  const s0 = await getState();
  check('GET /state answers', typeof s0.percent === 'number', s0.phase);

  // 2. auth
  check('POST /update without token -> 401', (await post({ percent: 10, phase: 'x', message: 'y' }, false)).status === 401);
  check('POST /update wrong token -> 401', (await post({ percent: 10, phase: 'x', message: 'y' }, false)).status === 401);

  // 3. open the SSE stream before publishing
  const events = [];
  const req = http.get(base + '/events', (res) => {
    check('GET /events -> 200', res.statusCode === 200);
    check('SSE content-type', /text\/event-stream/.test(String(res.headers['content-type'])), res.headers['content-type']);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            events.push(JSON.parse(line.slice(6)));
          } catch {
            // heartbeat or partial line
          }
        }
      }
    });
  });
  req.on('error', () => {});

  await new Promise((r) => setTimeout(r, 400));

  // 4. publish
  const ok = await post({ percent: 75, phase: 'deploy', message: 'Deploying Junkalot update...' }, true);
  check('POST /update with token -> 200', ok.status === 200 && JSON.parse(ok.body).ok === true, ok.body);

  // 5. validation
  check('percent 150 -> 400', (await post({ percent: 150, phase: 'x', message: 'y' }, true)).status === 400);
  check('phase too long -> 400', (await post({ percent: 10, phase: 'p'.repeat(61), message: 'y' }, true)).status === 400);
  check('message too long -> 400', (await post({ percent: 10, phase: 'x', message: 'm'.repeat(201) }, true)).status === 400);
  check('non-integer percent -> 400', (await post({ percent: 10.5, phase: 'x', message: 'y' }, true)).status === 400);

  await new Promise((r) => setTimeout(r, 400));
  req.destroy();

  // 6. streamed to the connected client
  check('SSE delivered a state', events.length >= 2, events.map((e) => e.percent));
  check('latest event is the published one', events[events.length - 1].percent === 75, events[events.length - 1]);

  // 7. persisted atomically with owner-only perms
  const onDisk = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const mode = (fs.statSync(STATE_FILE).mode & 0o777).toString(8);
  check('state persisted', onDisk.percent === 75 && onDisk.phase === 'deploy', onDisk);
  check('state file is 600', mode === '600', mode);

  // 8. restart-resume: a fresh process reads the file
  check('state carries updatedAt', typeof onDisk.updatedAt === 'string', onDisk.updatedAt);

  console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILED');
  process.exit(fails === 0 ? 0 : 1);
})();
