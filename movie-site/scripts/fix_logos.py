#!/usr/bin/env python3
"""
Fix CineVault channel logos — replace broken Wikipedia .svg.png thumbnail URLs
with working ones from Wikipedia's pageimages API. Uses rate limiting and retries.
"""

import json
import re
import urllib.request
import urllib.parse
import time
import sys

CHANNELS_JS_PATH = "/home/ghost/movie-site/js/channels.js"

# Channel key -> Wikipedia page title mapping
WIKI_TITLE_MAP = {
    "abc": "American_Broadcasting_Company",
    "cbs": "CBS",
    "nbc": "NBC",
    "fox": "Fox_Broadcasting_Company",
    "pbs": "PBS",
    "thecw": "The_CW",
    "mynetworktv": "MyNetworkTV",
    "cnn": "CNN",
    "foxnews": "Fox_News",
    "msnbc": "MSNBC",
    "hln": "HLN_(TV_network)",
    "bbcworld": "BBC_News_(TV_channel)",
    "cnbc": "CNBC",
    "bloomberg": "Bloomberg_Television",
    "foxbusiness": "Fox_Business",
    "weatherchannel": "The_Weather_Channel",
    "espn": "ESPN",
    "espn2": "ESPN2",
    "espnews": "ESPNews",
    "espnu": "ESPNU",
    "foxsports1": "FS1",
    "foxsports2": "Fox_Sports_2",
    "nbcsports": "NBC_Sports",
    "tbs_sports": "TBS_(American_TV_channel)",
    "tnt_sports": "TNT_(American_TV_channel)",
    "nflnetwork": "NFL_Network",
    "mlbnetwork": "MLB_Network",
    "nbanetwork": "NBA_TV",
    "nbcsn": "NBCSN",
    "usa": "USA_Network",
    "tnt": "TNT_(American_TV_channel)",
    "tbs": "TBS_(American_TV_channel)",
    "amc": "AMC_(TV_channel)",
    "fx": "FX_(TV_channel)",
    "fxx": "FXX",
    "hallmark": "Hallmark_Channel",
    "lifetime": "Lifetime_(TV_channel)",
    "syfy": "Syfy",
    "trutv": "TruTV",
    "bravo": "Bravo_(American_TV_channel)",
    "eentertainment": "E!",
    "oxygen": "Oxygen_(TV_channel)",
    "aetv": "A%26E_(TV_channel)",
    "freeform": "Freeform_(TV_channel)",
    "discovery": "Discovery_Channel",
    "discovery_science": "Science_Channel",
    "animalplanet": "Animal_Planet",
    "tlc": "TLC_(American_TV_channel)",
    "hgtv": "HGTV",
    "foodnetwork": "Food_Network",
    "cookingchannel": "Cooking_Channel",
    "trvl": "Travel_Channel",
    "investigation_discovery": "Investigation_Discovery",
    "discovery_life": "Discovery_Life",
    "own": "Oprah_Winfrey_Network",
    "magnolia": "Magnolia_Network",
    "hbo": "HBO",
    "hbomax": "Max_(streaming_service)",
    "hbo2": "HBO",
    "showtime": "Showtime_(TV_channel)",
    "stars": "Starz",
    "cinemax": "Cinemax",
    "nickelodeon": "Nickelodeon",
    "nickjr": "Nick_Jr.",
    "nicktoons": "Nicktoons",
    "disneychannel": "Disney_Channel",
    "disneyxd": "Disney_XD",
    "disneyjr": "Disney_Junior",
    "cartoonnetwork": "Cartoon_Network",
    "pbskids": "PBS_Kids",
    "mtv": "MTV",
    "vh1": "VH1",
    "bet": "BET",
    "cmt": "CMT_(American_TV_channel)",
    "natgeo": "National_Geographic_(American_TV_channel)",
    "natgeowild": "Nat_Geo_Wild",
    "history": "History_(American_TV_channel)",
    "smithsonian": "Smithsonian_Channel",
    "comedycentral": "Comedy_Central",
    "adultswim": "Adult_Swim",
    "trutv_comedy": "TruTV",
    "bravo_lifestyle": "Bravo_(American_TV_channel)",
    "mt_": "MTV",
    "univision": "Univision",
    "telemundo": "Telemundo",
    "galavision": "Galavisión",
    "unimas": "UniMás",
    "netflix": "Netflix",
    "amazon": "Amazon_Prime_Video",
    "disneyplus": "Disney%2B",
    "hulumax": "Hulu",
    "appletv": "Apple_TV%2B",
    "peacock": "Peacock_(streaming_service)",
    "paramount": "Paramount%2B",
}


def get_wiki_thumbnail(page_title, size=200, max_retries=3):
    """Fetch thumbnail URL from Wikipedia pageimages API with retries and rate limiting."""
    encoded = urllib.parse.quote(page_title, safe='')
    url = (
        f"https://en.wikipedia.org/w/api.php?"
        f"action=query&titles={encoded}&prop=pageimages&format=json&pithumbsize={size}"
    )
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CineVaultLogoFixer/1.0 (educational project)"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                if page_id == "-1":
                    return None
                thumb = page_data.get("thumbnail", {}).get("source")
                if thumb:
                    return thumb
            return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 2 ** (attempt + 2)  # exponential backoff: 4, 8, 16
                print(f"  RATE LIMITED, retrying in {wait}s...", end=" ", flush=True)
                time.sleep(wait)
                continue
            else:
                print(f"  HTTP Error {e.code} for {page_title}", file=sys.stderr)
                return None
        except Exception as e:
            print(f"  ERROR {type(e).__name__}: {e}", file=sys.stderr)
            time.sleep(2)
            continue
    return None


def make_svg_data_uri(name, color="#e50914"):
    """Generate a simple SVG data URI fallback for channels without Wikipedia logos."""
    initials = re.sub(r'[^A-Za-z0-9]', '', name)[:3].upper()
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">'
        f'<rect width="80" height="80" rx="12" fill="{color}"/>'
        f'<text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" '
        f'fill="white" font-family="Inter,system-ui,sans-serif" font-size="22" '
        f'font-weight="800">{initials}</text></svg>'
    )
    encoded = urllib.parse.quote(svg, safe='')
    return f"data:image/svg+xml,{encoded}"


def main():
    print("Reading channels.js...")
    with open(CHANNELS_JS_PATH, "r") as f:
        content = f.read()

    # First, restore the original content since the previous run may have replaced things with SVG fallbacks
    # Read from git if available, otherwise we'll just work with what we have
    
    # Parse channel blocks
    channel_pattern = re.compile(r"^\s+(\w+):\s*\{", re.MULTILINE)
    channel_keys = [m.group(1) for m in channel_pattern.finditer(content)]

    # Extract current logo URLs per channel key
    logo_data = {}
    for key in channel_keys:
        # Find: key: { ... logo: 'URL'
        block_pattern = re.compile(rf"^{re.escape(key)}:\s*\{{", re.MULTILINE)
        block_match = block_pattern.search(content)
        if not block_match:
            continue
        
        # Find logo line within ~500 chars after key
        block_start = block_match.start()
        block_text = content[block_start:block_start+500]
        logo_match = re.search(r"logo:\s*'([^']+)'", block_text)
        if logo_match:
            logo_data[key] = logo_match.group(1)

    print(f"Found {len(logo_data)} channel logos to update")
    print()

    # Fetch Wikipedia thumbnails with rate limiting
    new_urls = {}
    failed = []
    success_count = 0

    items = list(logo_data.items())
    for i, (channel_key, old_url) in enumerate(items):
        wiki_title = WIKI_TITLE_MAP.get(channel_key)
        if not wiki_title:
            print(f"  [{i+1}/{len(items)}] {channel_key}: No Wikipedia mapping, will use SVG fallback")
            channel_name_match = re.search(rf"{re.escape(channel_key)}:\s*\{{[^}}]*?name:\s*'([^']+)'", content, re.DOTALL)
            color_match = re.search(rf"{re.escape(channel_key)}:\s*\{{[^}}]*?color:\s*'([^']+)'", content, re.DOTALL)
            ch_name = channel_name_match.group(1) if channel_name_match else channel_key
            ch_color = color_match.group(1) if color_match else "#e50914"
            new_urls[channel_key] = make_svg_data_uri(ch_name, ch_color)
            failed.append(channel_key)
            continue

        print(f"  [{i+1}/{len(items)}] {channel_key} -> {wiki_title}...", end=" ", flush=True)
        new_url = get_wiki_thumbnail(wiki_title)
        
        if new_url:
            print(f"OK -> {new_url[:60]}...")
            new_urls[channel_key] = new_url
            success_count += 1
        else:
            print(f"NO THUMBNAIL, using SVG fallback")
            channel_name_match = re.search(rf"{re.escape(channel_key)}:\s*\{{[^}}]*?name:\s*'([^']+)'", content, re.DOTALL)
            color_match = re.search(rf"{re.escape(channel_key)}:\s*\{{[^}}]*?color:\s*'([^']+)'", content, re.DOTALL)
            ch_name = channel_name_match.group(1) if channel_name_match else channel_key
            ch_color = color_match.group(1) if color_match else "#e50914"
            new_urls[channel_key] = make_svg_data_uri(ch_name, ch_color)
            failed.append(channel_key)
        
        # Rate limit: wait 1 second between requests
        time.sleep(1)

    # Replace logos in file
    print(f"\nReplacing logos in channels.js...")
    replacements_made = 0

    for channel_key, new_url in new_urls.items():
        block_pattern = re.compile(
            rf"({re.escape(channel_key)}:\s*\{{[^}}]*?logo:\s*')([^']+)(')",
            re.DOTALL
        )
        match = block_pattern.search(content)
        if match:
            old_url = match.group(2)
            if old_url != new_url:
                content = content[:match.start(2)] + new_url + content[match.end(2):]
                replacements_made += 1

    # Write updated file
    with open(CHANNELS_JS_PATH, "w") as f:
        f.write(content)

    print(f"Made {replacements_made} replacements")
    print(f"\nDone! Updated {CHANNELS_JS_PATH}")
    print(f"  Successful Wikipedia lookups: {success_count}")
    print(f"  SVG fallbacks: {len(failed)}")
    if failed:
        print(f"  Channels using SVG fallback: {', '.join(failed)}")


if __name__ == "__main__":
    main()