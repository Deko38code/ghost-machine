Orebolt — real mining business site skeleton
---------------------------------------------
No fake returns. No fake balances. No fake payouts.

This is a real, honest skeleton for the future Orebolt mining site.
It will support real mining hardware, real mining pools, real wallet payouts.

Current supported / planned hardware:
- NMAxe (Bitaxe-compatible BM1366)
- NMAxe Gamma (Bitaxe Gamma-compatible BM1370)
- NMQAxe++ (ESP32-S3 + BM1370)

To run:
pm2 start /home/ghost/orebolt-real/ecosystem.config.cjs
pm2 save

Local URL:
http://localhost:8215/

Real pool setup:
- Edit /home/ghost/orebolt-real/data/pool.json
- Set provider, apiUrl, apiToken, wallet
- The site will then use real pool data instead of showing "not-configured".

Pages:
/hardware.html   Planned and supported NMAxe hardware
/pool.html       Live pool status once connected
/payout.html     Payout schedule once configured
