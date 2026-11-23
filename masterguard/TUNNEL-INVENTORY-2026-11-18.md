# MASTERGUARD — CLOUDFLARE TUNNEL INVENTORY (READ-ONLY)

**Status: FROZEN. Nothing was stopped, restarted, reconfigured, cleaned, deleted or re-routed.**
**Observed:** 2026-11-18, Dell `ghost-Inspiron-7348` and Parrot `10.0.0.251`. No credential value is reproduced anywhere in this document.

---

## 1. Connectors

| # | Box | Supervisor | Process | Tunnel (short id) | Config file | Edge connections at sample |
|---|---|---|---|---|---|---|
| C1 | Dell | PM2 `flixchill-tunnel` (parent pm2 daemon 1382) | `/usr/local/bin/cloudflared … --config ~/.cloudflared/flixchill-config.yml` | `a05db82a…` | `~/.cloudflared/flixchill-config.yml` | 0 sampled — **site answers 200**, treat as sampling artifact, not evidence of failure |
| C2 | Dell | PM2 `rmt-auth-tunnel` | `… --protocol http2 --config ~/.cloudflared/rmt-auth-dell.yml` | `d22d362a…` | `~/.cloudflared/rmt-auth-dell.yml` | 5 TCP |
| C3 | Dell | PM2 `haksterai-dell-tunnel` | `… --protocol http2 --config ~/.cloudflared/haksterai-dell.yml` | `c5e39c69…` | `~/.cloudflared/haksterai-dell.yml` | 4 TCP |
| C4 | Parrot | **systemd** `cloudflared.service` (active, enabled) | `/usr/bin/cloudflared --no-autoupdate --config ~/.cloudflared/config.yml tunnel run` | `f9f970fe-212b-4faf-82fb-8523463c3a96` | `~/.cloudflared/config.yml` | 0 TCP / 0 UDP at sample |
| C5 | Parrot | **userland** process pid 1778, same config | `/usr/local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run` | same as C4 | same as C4 | 1 TCP |

Parrot hostnames resolve correctly end-to-end, so at least one Parrot connector is carrying traffic. The duplication (C4 + C5) is **reported and left running** — it is not proof that either instance is unnecessary.

**Dormant / unused configuration present:**

- `/etc/cloudflared/config.yml` — tunnel **`41222e05-0584-4c1c-b0f8-b4f7da0fd33c`**, serving `phantomide.com` / `www.phantomide.com` → `localhost:4000`, catch-all 404. The systemd unit does **not** use this file. Different tunnel ID from the live one. Left in place.
- `~/.cloudflared/dash-config.yml` — `dash.phantomide.com` → `127.0.0.1:5173`, catch-all 404. No process was seen using it; `dash.phantomide.com` is already in the live `config.yml`. Left in place.

---

## 2. Hostname → origin map (all live routes)

| Hostname | Served by | Tunnel | Origin service | Origin `GET /` | Public `GET /` | Note |
|---|---|---|---|---|---|---|
| junkalot.co | Cloudflare → tunnel | C4/C5 | `127.0.0.1:5006` next-server (pid 2109726) | 200 | **200** | live Junkalot build |
| www.junkalot.co | same | C4/C5 | `:5006` | 200 | **200** | first probe returned 000, retry 200 (transient) |
| junkalotjunkremoval.com | **Wix** (`x-wix-cache-control`) | *(rule exists, unused)* | n/a | — | 404 | DNS does **not** point at the tunnel; the ingress rule is dormant |
| www.junkalotjunkremoval.com | **Wix** | *(rule exists, unused)* | n/a | — | 404 | same |
| phantomide.com | Cloudflare → tunnel | C4/C5 | `127.0.0.1:4000` phantom-server (pid 1294653) | 200 | **200** | |
| www.phantomide.com | same | C4/C5 | `:4000` | 200 | **200** | |
| dash.phantomide.com | Cloudflare → tunnel | C4/C5 | `127.0.0.1:5173` — **nothing listening** | connection refused | **530 (error 1033)** | live failure: tunnel cannot reach an origin |
| haksterai.com | Cloudflare → tunnel | C3 | `127.0.0.1:3579` hakster | 200 | **200** | |
| www.haksterai.com | same | C3 | `:3579` | 200 | **200** | first probe 000, retry 200 |
| topreels-3230f40cc3.haksterai.com | same | C3 | `:3579` | 200 | **200** | HEAD→404, GET→200 (app does not answer HEAD at `/`) |
| rmt.haksterai.com | Cloudflare → tunnel | C2 | `127.0.0.1:8112` | 200 | **200** | |
| rentmytrailer.haksterai.com | Cloudflare → tunnel | C2 | `:8112` | **404** | **404** | origin itself 404s for this Host — app maps only `rmt.haksterai.com` |
| `*.haksterai.com` (wildcard) | Cloudflare → tunnel | C2 | `:8112` | 404 for any other Host | — | wildcard makes RMT the default owner of every unclaimed subdomain |
| flixchill.link | Cloudflare → tunnel | C1 | `127.0.0.1:8081` | 200 | **200** | |
| www.flixchill.link | same | C1 | `:8081` | 200 | **200** | |
| email-monitor-3230f40cc3.haksterai.com | Cloudflare → tunnel | C4/C5 | `127.0.0.1:9191` | 200 | **200** | origin is a node pid outside PM2 (email-monitor's PM2 entry is stopped) |

**Correction to the earlier audit:** the `404`s seen on HEAD are HEAD-method behaviour on rmt/topreels/email-monitor — `GET` returns 200. They are **not** outages. Only `dash.phantomide.com` is genuinely down.

---

## 3. Dependencies that act on tunnels (do not disturb)

| Dependency | What it does | Trigger | Effect on tunnels |
|---|---|---|---|
| PM2 `tunnel-watchdog` (Dell, online) | curls `https://haksterai.com/api/health`; on failure `pm2 restart haksterai-dell-tunnel` | continuous, 120 s cooldown, log `~/.pm2/logs/tunnel-watchdog.log` | **can restart C3 on its own** |
| PM2 `ensure-up` (Dell, online, cwd `~/haksterAi`) | starts any of `hakster rmt cinevault miniforge haksterai-dell-tunnel rmt-auth-tunnel flixchill-tunnel hakterm claude-code-proxy` that are down, then `pm2 save` | its own pass | **can start any tunnel + rewrite the PM2 dump** |
| systemd `cloudflared.service` (Parrot) | runs C4 | boot + manual | enabling/disabling changes whether C4 runs |
| Junkalot guard (HaksterAI) | probes `https://junkalot.co/api/version` every 3 min | timer | read-only against the tunnel path; no restart |

Any future tunnel investigation must account for `tunnel-watchdog` and `ensure-up` acting independently within seconds to minutes.

---

## 4. Rollback procedure (documented, NOT executed)

**Dell connector:** config `~/.cloudflared/<tunnel>.yml`; supervision is the PM2 app of the same name; the PM2 definition lives in the pm2 dump. Rollback = restore the previous config file, then restart that one app. **Does not require touching the others.**

**Parrot connector:** config `~/.cloudflared/config.yml`; supervision is `cloudflared.service` **plus** the independent userland process pid 1778. A correct rollback must restore the config and restart **both**, or the two instances serve different configs.

**Before any such action:** capture the current config file verbatim and its SHA-256, record `systemctl cat cloudflared`, and record `pm2 describe` for the three Dell apps.

**Gap:** tunnel configuration files and credentials are **not** in the 2026-11-18 backup set (it covers repositories only), and the encrypted secret backup remains unverified. A rollback today would depend on files that have no verified copy.

---

## 5. Findings — reported, nothing changed

1. **`dash.phantomide.com` is down (Cloudflare 1033):** the ingress is live, the origin on `:5173` is not. **Owner decision 2026-11-18: leave it.** The origin is `/home/ghost694/phantom-dashboard`, a React/Vite "command centre" prototype scaffolded 2026-10-16 (twelve panels wired through a Socket.IO relay on `:4300` to the real IDE on `:4000`; `vite.config.js` dev port 5173). Never built, never supervised, last ran 2026-10-16 11:14, superseded by the dashboard inside `phantom-ide.html`. Not an outage; known and intentional — no action, no tunnel change.
2. **`rentmytrailer.haksterai.com` returns 404 from the origin itself:** routing is correct; the RMT application only serves `rmt.haksterai.com`.
3. **`junkalotjunkremoval.com` is served by Wix, not the tunnel:** two ingress rules exist for hostnames that DNS points elsewhere. Harmless, but they make the config read as if the tunnel serves that site.
4. **Wildcard `*.haksterai.com` on the RMT tunnel:** every unclaimed subdomain defaults to the RMT app's 404.
5. **Two Parrot connectors on one config, and a second config with a different tunnel ID for the same hostnames:** left running per the freeze.
6. **Junkalot production reachable through two hostnames** (`junkalot.co`, and `junkalotjunkremoval.com` by rule though not by DNS) — relevant to isolation, not to routing today.

---

## 6. Authorization

| Field | Value |
|---|---|
| Finding set | tunnel inventory, read-only |
| Owning projects | Junkalot (Parrot), PhantomIDE (Parrot), HaksterAI (Dell), RMT/FlixChill (Dell) |
| Authorization | **AUDIT AND REPORT ONLY** |
| Implementation | **NONE** |
| Live verification | all hostnames probed by GET; results in §2 |
| Outcome label | **PARTIALLY VERIFIED** — hostname→origin mapping confirmed from both ends; DNS zone records not inspected (no zone access, DNS commands prohibited) |
