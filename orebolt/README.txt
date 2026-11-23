Orebolt — Fleet Mining Dashboard (:8214)
=========================================

MODERN FLEET DASHBOARD — SIMULATED TELEMETRY, REAL SPEC SHEETS.

Live on pm2 (Dell), port 8214:  http://localhost:8214

What's inside
-------------
* Machine posters: Antminer S19 Pro / S19j Pro / S19 XP / S19 XP Hydro /
  S21 / S21 Pro / S21 XP / S21 Hydro / T19, Whatsminer M30S++ / M50,
  AvalonMiner A1466, NMAxe gear (BM1366/BM1370, ESP32-S3)
  - spec-sheet numbers are real published specs
  - "live" hashrates are SIMULATED (SIM badge) until real hardware/pool is wired
* Rentals tab: energy-based estimate demo (no payments, no billing, no offer)
* Network tab: real explorer + CoinGecko links
* Pools tab: real solo pool links (ckpool/mempool solo, Public Pool, Kano)
  and team pool links (Foundry, Antpool, F2Pool, ViaBTC, Braiins, SpiderPool)
* Security tab: live anomaly engine (IP bursts, scan storms, suspicious paths,
  slow requests, error spikes) + session/IP auth panel + Google button stub
* Logs tab: live access log from logs/requests.jsonl (also orebolt-access.jsonl,
  orebolt-security.jsonl)
* Overview: fleet chart, dials, block banner (sim), demo wallet factory

API
---
GET /api/telemetry   live sim fleet snapshot (server ticks 1s)
GET /api/machines    machine catalog + rental estimates
GET /api/btcprice    CoinGecko BTC price (60s cache, falls back stale/offline)
GET /api/btcnet      mempool.space tip height / retarget / fees (5min cache)
GET /api/security    anomaly engine summary + events
GET /api/logs?n=     recent access log entries
GET /api/clientinfo  your IP + auth status
GET /api/health      uptime
GET /auth/google     stubbed 501 (wire OAuth later)

Auth gate (wire later)
----------------------
data/auth.json  ->  {"enabled":false,"allowedIps":["1.2.3.4"]}
Set enabled:true + your IPs to hard-gate everything except /auth/*.
Google button = placeholder until you wire OAuth.

Pool (wire later)
-----------------
data/pool.json  ->  {"provider":"","apiUrl":"","apiToken":"","wallet":""}

Files
-----
index.html            UI (single file, no deps)
serve.js              server: static + API + logging + anomalies
index.html.pre-fleet  backup of first mock UI
serve.js.pre-fleet    backup of first mock server

Backups: index.html.orig (initial mock), *.pre-fleet (mock v1)
Built on ghost-Inspiron-7348 · pm2 · :8214

Multiple-Account Detection
---------------------------
* clientId via localStorage; sessions on logs/sessions.jsonl
* flags: multi_accounts_same_ip, account_multi_ip, fingerprint_mismatch, account_farm
* /api/sessions -> sybil report + sessions table (Security tab)
* expected stubs (/api/pool/stats 503, /auth/google 501) excluded from risk score
