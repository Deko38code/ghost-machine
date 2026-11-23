// DOM behaviour check for the PhantomIDE live-server progress panel.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/home/ghost694/phantom-progress-block.html', 'utf8');

const sockets = [];
class FakeWS {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    sockets.push(this);
    setTimeout(() => this.onopen && this.onopen(), 0);
  }
  send() {}
  close() {}
}

const dom = new JSDOM('<!doctype html><html><body>' + html + '</body></html>', {
  runScripts: 'dangerously',
  beforeParse(window) {
    window.WebSocket = FakeWS;
  },
});

const { window } = dom;
const doc = window.document;
const dock = doc.getElementById('phantom-progress-dock');
const label = doc.getElementById('phantom-percent');
const status = doc.getElementById('phantom-status');
const fill = doc.getElementById('phantom-fill');
const track = doc.querySelector('.phantom-track');

let fails = 0;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
  if (!cond) fails++;
};

setTimeout(() => {
  check('socket created', sockets.length === 1, sockets[0] && sockets[0].url);
  check('uses junkalot endpoint', sockets[0] && sockets[0].url === 'wss://junkalot.co/ws/status');
  check('hidden before any event', dock.hidden === true);
  check('API exposed', typeof window.PhantomProgress === 'function');

  const ws = sockets[0];
  ws.onmessage({ data: JSON.stringify({ type: 'progress', percent: 75, message: 'Deploying Junkalot update...' }) });
  check('visible after progress', dock.hidden === false);
  check('percent label', label.textContent === '75%', label.textContent);
  check('message shown', status.textContent === 'Deploying Junkalot update...', status.textContent);
  check('bar width', fill.style.width === '75%', fill.style.width);
  check('aria-valuenow', track.getAttribute('aria-valuenow') === '75', track.getAttribute('aria-valuenow'));

  ws.onmessage({ data: JSON.stringify({ type: 'progress', percent: 100 }) });
  check('done copy', status.textContent === 'Update complete ✓', status.textContent);
  check('done bar full', fill.style.width === '100%', fill.style.width);

  ws.onmessage({ data: 'not json' });
  ws.onmessage({ data: JSON.stringify({ type: 'success', title: 'x', message: 'y' }) });
  check('ignores non-progress events', status.textContent === 'Update complete ✓', status.textContent);

  setTimeout(() => {
    check('auto-hides 8 s after done', dock.hidden === true);
    console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILED');
    process.exit(fails === 0 ? 0 : 1);
  }, 8300);
}, 50);
