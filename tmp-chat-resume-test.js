// Behaviour check for the ChatButton auto-resume store helpers.
// The helper block is lifted verbatim from ChatButton.tsx (types stripped) and run
// against a fake localStorage, so the TTL / filtering / cap / clear rules are the
// real ones shipping in the component.
const fs = require('fs');

const path = process.argv[2] || '/home/ghost694/junkalot/src/components/ChatButton.tsx';
const src = fs.readFileSync(path, 'utf8');

const start = src.indexOf('const STORE_KEY');
const end = src.indexOf('export default function ChatButton');
if (start === -1 || end === -1) {
  console.log('FAIL could not locate helper block');
  process.exit(1);
}
let block = src.slice(start, end);
block = block
  .replace(/type StoredSession =[^\n]*\n/, '')
  .replace(/: StoredSession/g, '')
  .replace(/: Message\[\]/g, '')
  .replace(/readonly /g, '');

const store = new Map();
const fakeStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
global.localStorage = fakeStorage;

const fn = new Function(block + '\nreturn { readStoredSession, writeStoredSession, clearStoredSession, STORE_KEY, MAX_STORED_MESSAGES };');
const api = fn();

let fails = 0;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
  if (!cond) fails++;
};

// 1. empty store
check('empty store resumes nothing', api.readStoredSession().length === 0);

// 2. write + read roundtrip
api.writeStoredSession([
  { role: 'user', content: '2 couches and a fridge' },
  { role: 'assistant', content: 'Call (510) 435-4721 for a free estimate.' },
]);
const back = api.readStoredSession();
check('roundtrip keeps both turns', back.length === 2 && back[0].role === 'user');

// 3. junk entries are dropped on read
const raw = JSON.parse(store.get(api.STORE_KEY));
raw.messages.push({ role: 'system', content: 'drop me' }, { role: 'user', content: '   ' }, null);
store.set(api.STORE_KEY, JSON.stringify(raw));
const cleaned = api.readStoredSession();
check('invalid entries filtered', cleaned.length === 2, cleaned.map((m) => m.role));

// 4. malformed JSON
store.set(api.STORE_KEY, '{not json');
check('malformed JSON resumes nothing', api.readStoredSession().length === 0);

// 5. TTL
store.set(api.STORE_KEY, JSON.stringify({ at: Date.now() - 8 * 24 * 60 * 60 * 1000, messages: [{ role: 'user', content: 'old' }] }));
check('stale thread dropped after 7 days', api.readStoredSession().length === 0 && !store.has(api.STORE_KEY));

// 6. cap at MAX_STORED_MESSAGES
const many = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i }));
api.writeStoredSession(many);
const capped = api.readStoredSession();
check('cap holds', capped.length === api.MAX_STORED_MESSAGES && capped[capped.length - 1].content === 'm59', capped.length);

// 7. clear
api.clearStoredSession();
check('clear empties the store', api.readStoredSession().length === 0);

// 8. quota failure must not throw
global.localStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => {},
};
let threw = false;
try { api.writeStoredSession([{ role: 'user', content: 'x' }]); } catch { threw = true; }
check('quota failure swallowed', threw === false);

console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILED');
process.exit(fails === 0 ? 0 : 1);
