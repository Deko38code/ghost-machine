# Stalker Middleware Source Reference (MIT License)

## Key API Endpoints (portal.php)
- `?type=stb&action=handshake&token=` → get auth token
- `?type=itv&action=get_ordered_list&page=N&sortby=number&JsHttpRequest=1-xml` → paginated channels (14/page)
- `?type=itv&action=get_all_channels&JsHttpRequest=1-xml` → ALL channels (16MB, avoid)
- `?type=itv&action=get_genres&JsHttpRequest=1-xml` → genre list
- `?type=itv&action=create_link&cmd=ffhttp+<url>&JsHttpRequest=1-xml` → resolve stream URL
- `?type=itv&action=get_link&ch_id=ID&JsHttpRequest=1-xml` → alt link resolution
- `?type=stb&action=get_profile` → STB profile info

## create_link Protocol
1. Client sends `cmd=ffhttp http://localhost/ch/<ID>_<extra>`
2. Server regex: `preg_match("/\/ch\/(\d+)(.*)/", cmd)` → extracts channel ID + extra
3. Server looks up `ch_links` table for real URL
4. Returns `{ id, cmd: resolved_url+extra, streamer_id, link_id, load, error }`

## Channel Data Fields (from prepareData)
- `cmd` = first stream URL from ch_links (ffmpeg http://localhost/ch/ID_)
- `cmds` = array of all available stream URLs with metadata
- `use_http_tmp_link` = temp token flag
- `wowza_tmp_link` = wowza token flag  
- `nginx_secure_link` = nginx hash flag
- `use_load_balancing` = load balancer flag
- `open` = 1 if channel has streams, 0 if limit/error
- `cur_playing` = current EPG program
- `pvr` = PVR allowed
- `mc_cmd` = multicast cmd (1 if set)

## Stream Types
- `nginx_secure_link=1` → URL gets hash token appended via `?token=<hash>`
- `flussonic_tmp_link=1` → temp token via `/get/token/` redirect
- `stream_proxy` set → all streams proxied through redirect server
- Direct URLs (rtp://, udp://, http://) → play as-is

## Authentication
- Token from handshake → sent as `Authorization: Bearer <token>`
- MAC sent as Cookie: `mac=<mac>`
- SN derived from MAC hash

## Pagination
- Default `max_page_items = 14` (from config.ini)
- `page` param is 1-indexed
- `sortby` param: number, name, fav
- Response includes: `total_items`, `cur_page`, `selected_item`, `max_page_items`

## Known Portals
- streamtv.to:8080/c/ → portal.php type, 16K+ channels
- portal.siptv.app → stalker_portal type (dead)
- Most portals use /stalker_portal/server/load.php or /portal.php

## MAC Prefixes (from brute force data)
- 00:1A:79: (Infomir MAG)
- 00:1A:78: (Infomir MAG)
- 00:1A:2B: (Infomir MAG)
- D4:CF:F9: (various)
- 00:2A:01: (various)