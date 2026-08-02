#!/usr/bin/env python3
"""
Stalker Portal Stream Extractor + VLC Headless
Extracts real stream URLs from a Stalker portal and plays them via VLC with zero lag.
"""

import requests
import subprocess
import sys
import re
import json
import time
import hashlib
import random
import string

class StalkerStream:
    """Minimal Stalker portal handshake to extract stream URLs."""
    
    def __init__(self, portal_url, mac):
        self.portal_url = portal_url.rstrip('/')
        self.mac = mac.upper()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': self.portal_url + '/c/'
        })
        
        # Generate fake device IDs (same format as real STB)
        raw = self.mac.replace(':', '')
        self.device_id = hashlib.md5(raw.encode()).hexdigest().upper()
        self.serial = ''.join(random.choices(string.ascii_uppercase + string.digits, k=13))
        
    def handshake(self):
        """Complete the Stalker portal handshake and get token."""
        base = f"{self.portal_url}/stalker_portal/server/load.php"
        
        # Step 1: Get token
        params = {
            'type': 'account_info',
            'action': 'get_main_info',
            'JsHttpRequest': '1-xml'
        }
        cookies = {
            'mac': self.mac,
            'serial': self.serial,
            'device_id': self.device_id,
            'device_id2': self.device_id
        }
        
        r = self.session.get(base, params=params, cookies=cookies, timeout=15)
        data = r.json()
        
        if 'token' not in data.get('js', {}):
            print(f"[-] Handshake failed. Response: {data}")
            return False
            
        self.token = data['js']['token']
        self.session.headers['Authorization'] = f'Bearer {self.token}'
        print(f"[+] Handshake OK — token acquired")
        return True
    
    def get_channels(self):
        """Fetch all live channels from the portal."""
        base = f"{self.portal_url}/stalker_portal/server/load.php"
        
        params = {
            'type': 'itv',
            'action': 'get_all_channels',
            'JsHttpRequest': '1-xml'
        }
        cookies = {
            'mac': self.mac,
            'token': self.token,
            'serial': self.serial,
            'device_id': self.device_id,
            'device_id2': self.device_id
        }
        
        r = self.session.get(base, params=params, cookies=cookies, timeout=30)
        data = r.json()
        
        channels = data.get('js', {}).get('data', [])
        print(f"[+] Found {len(channels)} channels")
        return channels
    
    def get_stream_url(self, channel_id):
        """Resolve the actual streaming URL for a channel."""
        base = f"{self.portal_url}/stalker_portal/server/load.php"
        
        params = {
            'type': 'itv',
            'action': 'create_link',
            'JsHttpRequest': '1-xml'
        }
        data = {
            'cmd': f'ffmpeg http://{self.portal_url}/stalker_portal/server/tools/playlist.php?cmd=ffmpeg%20http://{self.portal_url}/stalker_portal/server/tools/playlist.php?cmd=ffmpeg',
            'type': 'itv',
            'uid': channel_id,
            'priority': '1'
        }
        cookies = {
            'mac': self.mac,
            'token': self.token,
            'serial': self.serial,
            'device_id': self.device_id,
            'device_id2': self.device_id
        }
        
        r = self.session.post(base, params=params, data=data, cookies=cookies, timeout=15)
        result = r.json().get('js', {})
        
        # The stream URL is usually in the 'cmd' field
        cmd = result.get('cmd', '')
        # Extract URL from ffmpeg command
        urls = re.findall(r'http[s]?://[^\s]+\.(?:m3u8|ts|m3u)', cmd)
        if urls:
            return urls[0]
        return cmd
    
    def generate_m3u(self, channels):
        """Generate M3U content from channel list."""
        m3u = ['#EXTM3U']
        total = len(channels)
        
        for i, ch in enumerate(channels, 1):
            name = ch.get('name', f'Channel {i}')
            ch_id = ch.get('id')
            
            print(f"  [{i}/{total}] Resolving: {name}...", end=' ', flush=True)
            stream_url = self.get_stream_url(ch_id)
            
            if stream_url and stream_url.startswith('http'):
                m3u.append(f'#EXTINF:-1,{name}')
                m3u.append(stream_url)
                print('OK')
            else:
                print(f'FAILED ({stream_url[:50]})')
            
            # Small delay to avoid rate limiting
            time.sleep(0.3)
        
        return '\n'.join(m3u)


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 stalker2vlc.py <portal_url> <mac_address>")
        print("  python3 stalker2vlc.py http://yourportal.com 00:1A:78:AB:CD:EF")
        sys.exit(1)
    
    portal_url = sys.argv[1]
    mac = sys.argv[2]
    
    print(f"[*] Connecting to portal: {portal_url}")
    print(f"[*] Using MAC: {mac}")
    
    # Handshake
    stalker = StalkerStream(portal_url, mac)
    if not stalker.handshake():
        print("[-] Handshake failed — check MAC/portal")
        sys.exit(1)
    
    # Get channels
    channels = stalker.get_channels()
    if not channels:
        print("[-] No channels found")
        sys.exit(1)
    
    # Generate M3U
    m3u_content = stalker.generate_m3u(channels)
    
    # Save to file
    m3u_file = f"stalker_{mac.replace(':', '')}.m3u"
    with open(m3u_file, 'w') as f:
        f.write(m3u_content)
    print(f"\n[+] M3U saved: {m3u_file}")
    
    # Launch VLC headless with no lag
    print(f"[+] Launching VLC headless with optimized caching...")
    subprocess.run([
        'vlc', '--network-caching=3000',
        '--file-caching=3000',
        '--live-caching=3000',
        '--no-video-title-show',
        m3u_file
    ])


if __name__ == '__main__':
    main()