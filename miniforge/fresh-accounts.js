#!/usr/bin/env node
/**
 * Fresh account creator for miniapps.ai
 * Generates 50 new accounts with random emails, each getting 100 credits.
 * Saves credentials to accounts.json for the rotator to use.
 */
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const API = 'api.miniapps.ai';
let cookieJar = '';

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        ...opts.headers,
        'Cookie': cookieJar,
      }
    }, (res) => {
      const setCookies = res.headers['set-cookie'] || [];
      setCookies.forEach(c => {
        const parts = c.split(';')[0];
        if (cookieJar) cookieJar += '; ' + parts;
        else cookieJar = parts;
      });
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

async function getCsrf() {
  cookieJar = ''; // Reset cookies for fresh CSRF session
  const r = await fetch(`https://${API}/auth/csrf`);
  try {
    const data = JSON.parse(r.body);
    return data.csrfToken || data.token || '';
  } catch {
    return '';
  }
}

async function register(username, email) {
  const csrf = await getCsrf();
  const r = await fetch(`https://${API}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrf,
    },
    body: JSON.stringify({ username, email, password: 'Test12345!' })
  });
  try {
    const data = JSON.parse(r.body);
    return { status: r.status, credits: data.credits, message: data.message, userId: data.id, email, apiKey: data.apiKey || data.api_key || data.token };
  } catch {
    return { status: r.status, credits: null, message: r.body.slice(0, 200), email };
  }
}

async function main() {
  const COUNT = 50;
  const accounts = [];
  let success = 0;
  let failed = 0;

  // Load existing accounts if any
  try {
    const existing = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
    accounts.push(...existing);
    console.log(`[registrar] Loaded ${existing.length} existing accounts`);
  } catch {
    // No existing file
  }

  console.log(`[registrar] Creating ${COUNT} fresh accounts with random emails...`);

  for (let i = 0; i < COUNT; i++) {
    // Generate random email using various domains
    const domains = ['protonmail.com', 'gmail.com', 'outlook.com', 'yahoo.com', 'mail.ru', 'yandex.com'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const rand = crypto.randomBytes(6).toString('hex');
    const email = `hak_${rand}@${domain}`;
    const username = `hak_${rand}`;

    const start = Date.now();
    const result = await register(username, email);
    const elapsed = Date.now() - start;

    if (result.status === 200 || result.status === 201) {
      success++;
      accounts.push({
        email,
        username,
        apiKey: result.apiKey,
        credits: result.credits || 100,
        created: new Date().toISOString()
      });
      console.log(`[${i+1}] ✅ ${email} credits=${result.credits || 100} (${elapsed}ms) total: ${success}`);
    } else if (result.status === 429) {
      console.log(`[${i+1}] ⏳ Rate limited, waiting 60s...`);
      await new Promise(r => setTimeout(r, 60000));
      i--; // retry this one
      continue;
    } else {
      failed++;
      console.log(`[${i+1}] ❌ status=${result.status} ${result.message?.slice(0, 80)}`);
    }

    // Small delay between registrations
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
  }

  // Save all accounts
  fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 2));
  console.log(`\n[registrar] Done! ${success} new accounts created, ${failed} failed`);
  console.log(`[registrar] Total accounts: ${accounts.length}`);
  console.log(`[registrar] Saved to accounts.json`);
}

main().catch(console.error);