// Login accounts from accounts.json and merge into data/miniapps_pool.json
const https = require('https');
const fs = require('fs');
const path = require('path');

const API = 'api.miniapps.ai';
const POOL_FILE = path.join(__dirname, 'data', 'miniapps_pool.json');
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    let cookieJar = opts.cookie || '';
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: { ...opts.headers, Cookie: cookieJar }
    }, (res) => {
      const setCookies = res.headers['set-cookie'] || [];
      let newCookies = cookieJar;
      setCookies.forEach(c => {
        const parts = c.split(';')[0];
        newCookies = newCookies ? newCookies + '; ' + parts : parts;
      });
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers, cookie: newCookies }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function loginAccount(email, password) {
  // Step 1: Get CSRF
  let cookie = '';
  const csrfResp = await fetch(`https://${API}/auth/csrf`, { cookie: '' });
  const csrfData = JSON.parse(csrfResp.body);
  const csrf = csrfData.csrfToken;
  cookie = csrfResp.cookie;

  // Step 2: Login
  const loginResp = await fetch(`https://${API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrf,
    },
    cookie: cookie,
    body: JSON.stringify({ email, password })
  });

  if (loginResp.status !== 200) {
    return { success: false, status: loginResp.status, body: loginResp.body.slice(0, 200) };
  }

  const data = JSON.parse(loginResp.body);
  // Extract JWT from response or cookie
  const jwt = data.token || data.jwt || data.accessToken || '';
  
  // Try to get JWT from authorization header or response
  let finalJwt = jwt;
  if (!finalJwt) {
    // Check if JWT is in a cookie
    const cookieMatch = loginResp.cookie.match(/token=([^;]+)/i);
    if (cookieMatch) finalJwt = cookieMatch[1];
  }

  // Get credits
  const credits = data.credits || 0;

  // Extract CSRF token and cookie for pool
  const csrfCookie = loginResp.cookie.match(/__Host[^=]+=[^;]+/)?.[0] || '';

  return {
    success: true,
    jwt: finalJwt,
    csrfToken: csrf,
    csrfCookie: csrfCookie,
    credits: credits,
    data: data
  };
}

(async () => {
  // Load existing pool
  let pool;
  try {
    pool = JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));
  } catch {
    pool = { accounts: [] };
  }

  // Load all accounts
  const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));

  // Find accounts not yet in pool (by email)
  const existingEmails = new Set(pool.accounts.map(a => a.email));
  const newAccounts = accounts.filter(a => !existingEmails.has(a.email));

  console.log(`[login] Pool has ${pool.accounts.length}, accounts.json has ${accounts.length}, ${newAccounts.length} new to login`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < newAccounts.length; i++) {
    const acct = newAccounts[i];
    const password = 'Test12345!'; // Default password from fresh-accounts.js
    
    try {
      const result = await loginAccount(acct.email, password);
      if (result.success) {
        pool.accounts.push({
          email: acct.email,
          password: password,
          jwt: result.jwt,
          csrfToken: result.csrfToken,
          csrfCookie: result.csrfCookie,
          lastAuth: Date.now(),
          credits: result.credits || 100,
          dead: false
        });
        success++;
        console.log(`[${success + failed}] ✅ ${acct.email} jwt=${result.jwt ? 'yes' : 'no'} credits=${result.credits}`);
      } else {
        failed++;
        console.log(`[${success + failed}] ❌ ${acct.email} status=${result.status} ${result.body}`);
      }
    } catch (e) {
      failed++;
      console.log(`[${success + failed}] ❌ ${acct.email} error: ${e.message}`);
    }
    
    // Save pool every 10 accounts
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2));
      console.log(`[login] Saved pool (${pool.accounts.length} accounts)`);
    }
  }

  // Final save
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2));
  console.log(`\n[login] Done! ${success} logged in, ${failed} failed`);
  console.log(`[login] Pool now has ${pool.accounts.length} accounts`);
  console.log(`[login] Total credits: ${pool.accounts.reduce((sum, a) => sum + (a.credits || 0), 0)}`);
})();