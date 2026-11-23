#!/usr/bin/env python3
"""
Freebuff auto-account creator.
Uses curl --socks5-hostname for Tor routing (no pysocks needed).
- Rotates Tor circuit for fresh IP each run
- Generates unique machine fingerprint
- Creates temp email via guerrillamail (through Tor)
- Sends magic link through Tor
- Polls guerrillamail for the verification link
- Visits the verification link through Tor
- Polls freebuff CLI auth status for the token
- Saves credentials to ~/.config/manicode/credentials.json
"""

import hashlib
import json
import os
import random
import re
import socket
import string
import subprocess
import sys
import time
import urllib.parse
import urllib.request

TOR_SOCKS_HOST = "10.0.0.210"
TOR_SOCKS_PORT = "9050"
TOR_CONTROL_HOST = "127.0.0.1"
TOR_CONTROL_PORT = 9051
TOR_COOKIE_FILE = "/tmp/tordata/control_auth_cookie"
FREEBUFF_BASE = "https://freebuff.com"
CREDS_PATH = os.path.expanduser("~/.config/manicode/credentials.json")
GUERRILLA_API = "https://api.guerrillamail.com/ajax.php"

def rotate_tor_circuit():
    try:
        cookie = open(TOR_COOKIE_FILE, "rb").read().hex()
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect((TOR_CONTROL_HOST, TOR_CONTROL_PORT))
        s.send(f"AUTHENTICATE {cookie}\r\n".encode())
        resp = s.recv(1024).decode().strip()
        if "250" not in resp:
            print(f"[tor] Auth failed: {resp}")
            s.close()
            return False
        s.send(b"SIGNAL NEWNYM\r\n")
        resp = s.recv(1024).decode().strip()
        s.send(b"QUIT\r\n")
        s.close()
        if "250" in resp:
            print("[tor] Circuit rotated")
            time.sleep(3)
            return True
        return False
    except Exception as e:
        print(f"[tor] Rotation error: {e}")
        return False

def tor_curl(url, data=None, method="GET", timeout=30, follow_redirects=True):
    """Use curl with SOCKS5 hostname proxy for Tor routing."""
    cmd = [
        "curl", "-s",
        "--socks5-hostname", f"{TOR_SOCKS_HOST}:{TOR_SOCKS_PORT}",
        "--max-time", str(timeout),
        "-w", "\n__HTTP_STATUS__%{http_code}",
        "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
    ]
    if not follow_redirects:
        cmd.append("-D", "-")  # dump headers to see redirects
    if data:
        cmd.extend(["-X", "POST", "-d", data])
        if "=" in data and "&" in data:
            cmd.extend(["-H", "Content-Type: application/x-www-form-urlencoded"])
    if method == "POST" and not data:
        cmd.extend(["-X", "POST"])
    cmd.append(url)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        output = result.stdout
        # Extract status code
        status = 0
        if "__HTTP_STATUS__" in output:
            parts = output.rsplit("__HTTP_STATUS__", 1)
            output = parts[0]
            try:
                status = int(parts[1].strip())
            except:
                pass
        return status, output
    except Exception as e:
        return 0, str(e)

def plain_curl(url, data=None, method="GET", timeout=30, json_data=None):
    """Curl without Tor for local/direct requests."""
    cmd = [
        "curl", "-s",
        "--max-time", str(timeout),
        "-w", "\n__HTTP_STATUS__%{http_code}",
        "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
    ]
    if json_data:
        cmd.extend(["-X", "POST", "-d", json.dumps(json_data), "-H", "Content-Type: application/json"])
    elif data:
        cmd.extend(["-X", "POST", "-d", data, "-H", "Content-Type: application/x-www-form-urlencoded"])
    cmd.append(url)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        output = result.stdout
        status = 0
        if "__HTTP_STATUS__" in output:
            parts = output.rsplit("__HTTP_STATUS__", 1)
            output = parts[0]
            try:
                status = int(parts[1].strip())
            except:
                pass
        return status, output
    except Exception as e:
        return 0, str(e)

def get_tor_ip():
    status, body = tor_curl("https://check.torproject.org/api/ip", timeout=15)
    try:
        data = json.loads(body)
        return data.get("IP", "unknown")
    except:
        return f"parse error: {body[:100]}"

def generate_fingerprint():
    random_suffix = "".join(random.choices(string.ascii_letters + string.digits, k=44))
    fp_id = f"enhanced-{random_suffix}"
    seed = f"{time.time()}{random.random()}{os.getpid()}".encode()
    fp_hash = hashlib.sha256(seed).hexdigest()
    return fp_id, fp_hash

def create_temp_email():
    """Create temp email via guerrillamail through Tor."""
    status, body = tor_curl(f"{GUERRILLA_API}?f=get_email_address", timeout=15)
    if status != 200:
        # Try without Tor
        status, body = plain_curl(f"{GUERRILLA_API}?f=get_email_address", timeout=15)
    try:
        data = json.loads(body)
        email = data.get("email_addr", "")
        token = data.get("sid_token", "")
        sid = data.get("sid_token", "")
        if email and token:
            print(f"[email] Created: {email}")
            return email, token, sid
        print(f"[email] Bad response: {body[:200]}")
        return None, None, None
    except Exception as e:
        print(f"[email] Parse error: {e}, body: {body[:200]}")
        return None, None, None

def check_inbox(token, sid, max_wait=120):
    start = time.time()
    while time.time() - start < max_wait:
        try:
            url = f"{GUERRILLA_API}?f=get_email_list&offset=0&email_token={token}&sid_token={sid}"
            status, body = tor_curl(url, timeout=10)
            if status != 200:
                status, body = plain_curl(url, timeout=10)
            data = json.loads(body)
            emails = data.get("list", [])
            if emails:
                print(f"[email] Got {len(emails)} email(s)")
                # Skip guerrillamail welcome emails, look for freebuff
                for mail in emails:
                    sender = mail.get("mail_from", "").lower()
                    subject = mail.get("mail_subject", "").lower()
                    if "guerrilla" in sender or "welcome" in subject or "disposable" in subject:
                        continue
                    mail_id = mail.get("mail_id")
                    if not mail_id:
                        continue
                    print(f"[email] Checking: from={sender} subject={subject[:50]}")
                    body_url = f"{GUERRILLA_API}?f=fetch_email&email_id={mail_id}&email_token={token}&sid_token={sid}"
                    s2, body2 = tor_curl(body_url, timeout=10)
                    if s2 != 200:
                        s2, body2 = plain_curl(body_url, timeout=10)
                    body_data = json.loads(body2)
                    mail_body = body_data.get("mail_body", "")
                    links = re.findall(r'https?://[^\s<>"\']+', mail_body)
                    freebuff_links = [l for l in links if "freebuff.com" in l or "callback" in l or "verify" in l]
                    if freebuff_links:
                        print("[email] Found verification link")
                        return freebuff_links[0]
                    links = re.findall(r'href="(https?://[^"]*)"', mail_body)
                    freebuff_links = [l for l in links if "freebuff.com" in l]
                    if freebuff_links:
                        return freebuff_links[0]
                    verify_links = re.findall(r'(https?://[^\s<>"\']+(?:verify|confirm|callback|auth|signin|click)[^\s<>"\']*)', mail_body, re.I)
                    if verify_links:
                        return verify_links[0]
                    print(f"[email] No freebuff link in this email, body preview:\n{mail_body[:300]}")
            time.sleep(5)
            elapsed = int(time.time() - start)
            if elapsed % 15 == 0:
                print(f"[email] Waiting... ({elapsed}s)")
        except Exception as e:
            print(f"[email] Poll error: {e}")
            time.sleep(5)
    print("[email] Timeout")
    return None

def get_csrf_token():
    """Get CSRF token from freebuff via Tor."""
    status, body = tor_curl(f"{FREEBUFF_BASE}/api/auth/csrf", timeout=10)
    if status != 200:
        status, body = plain_curl(f"{FREEBUFF_BASE}/api/auth/csrf", timeout=10)
    try:
        data = json.loads(body)
        token = data.get("csrfToken", "")
        print("[freebuff] CSRF token acquired")
        return token
    except:
        print(f"[freebuff] CSRF parse error: {body[:200]}")
        return None

def send_magic_link(email, csrf_token):
    """Send magic link email via Tor."""
    data = urllib.parse.urlencode({
        "email": email,
        "csrfToken": csrf_token,
        "callbackUrl": FREEBUFF_BASE,
    })
    status, body = tor_curl(
        f"{FREEBUFF_BASE}/api/auth/signin/email",
        data=data,
        method="POST",
        timeout=15,
    )
    print(f"[freebuff] Magic link sent (status {status})")
    return status in (200, 302)

def visit_verification_link(link):
    """Visit the verification link through Tor."""
    status, body = tor_curl(link, timeout=20)
    print(f"[freebuff] Verification link visited (status {status})")
    return status in (200, 302)

def get_cli_login_code(fingerprint_id):
    """Get CLI login code from freebuff."""
    json_data = json.dumps({"fingerprintId": fingerprint_id})
    status, body = plain_curl(
        f"{FREEBUFF_BASE}/api/auth/cli/code",
        json_data={"fingerprintId": fingerprint_id},
        timeout=15,
    )
    if status != 200:
        # Try via Tor
        status, body = tor_curl(
            f"{FREEBUFF_BASE}/api/auth/cli/code",
            data=json_data,
            method="POST",
            timeout=15,
        )
    try:
        data = json.loads(body)
        return data
    except:
        print(f"[freebuff] CLI code parse error: {body[:200]}")
        return None

def poll_cli_auth_status(fingerprint_id, fingerprint_hash, expires_at, max_wait=60):
    """Poll the CLI auth status endpoint for the auth token."""
    params = urllib.parse.urlencode({
        "fingerprintId": fingerprint_id,
        "fingerprintHash": fingerprint_hash,
        "expiresAt": str(expires_at),
    })
    url = f"{FREEBUFF_BASE}/api/auth/cli/status?{params}"
    start = time.time()
    while time.time() - start < max_wait:
        try:
            status, body = plain_curl(url, timeout=10)
            data = json.loads(body)
            user = data.get("user")
            if user:
                print(f"[freebuff] Auth success! User: {user.get('email', '?')}")
                return user
            time.sleep(3)
        except Exception as e:
            print(f"[freebuff] Poll error: {e}")
            time.sleep(3)
    print("[freebuff] Auth poll timeout")
    return None

def save_credentials(user):
    os.makedirs(os.path.dirname(CREDS_PATH), exist_ok=True)
    existing = {}
    if os.path.exists(CREDS_PATH):
        try:
            with open(CREDS_PATH) as f:
                existing = json.load(f)
        except:
            pass
    existing["default"] = user
    with open(CREDS_PATH, "w") as f:
        json.dump(existing, f, indent=2)
    os.chmod(CREDS_PATH, 0o600)
    print(f"[creds] Saved to {CREDS_PATH}")

def create_account():
    print("=== Freebuff Auto-Account Creator ===\n")

    print("[1/8] Rotating Tor circuit...")
    rotate_tor_circuit()
    ip = get_tor_ip()
    print(f"      Exit IP: {ip}\n")

    print("[2/8] Generating machine fingerprint...")
    fp_id, fp_hash = generate_fingerprint()
    print(f"      Fingerprint: {fp_id[:30]}...\n")

    print("[3/8] Creating temp email...")
    email, email_token, sid = create_temp_email()
    if not email:
        return False
    print()

    print("[4/8] Getting CLI login code...")
    cli_resp = get_cli_login_code(fp_id)
    if not cli_resp:
        return False
    login_url = cli_resp.get("loginUrl", "")
    fingerprint_hash = cli_resp.get("fingerprintHash", fp_hash)
    expires_at = cli_resp.get("expiresAt", int(time.time() * 1000) + 3600000)
    print(f"      Login URL: {login_url[:60]}...\n")

    print("[5/8] Getting CSRF + sending magic link...")
    csrf = get_csrf_token()
    if not csrf:
        return False
    if not send_magic_link(email, csrf):
        return False
    print()

    print("[6/8] Waiting for verification email...")
    link = check_inbox(email_token, sid, max_wait=120)
    if not link:
        print("Failed: no verification email received")
        return False
    print()

    print("[7/8] Completing verification...")
    if isinstance(link, str) and link.startswith("http"):
        visit_verification_link(link)
    else:
        print(f"Unexpected link format: {str(link)[:200]}")
        return False
    print()

    print("[8/8] Polling for auth token...")
    user = poll_cli_auth_status(fp_id, fingerprint_hash, expires_at, max_wait=60)
    if not user:
        print("Failed: no auth token received")
        return False

    save_credentials(user)
    print(f"\n=== SUCCESS ===")
    print(f"Email: {email}")
    print(f"IP: {ip}")
    print(f"Fingerprint: {fp_id[:30]}...")
    print(f"Credentials: {CREDS_PATH}")
    return True

if __name__ == "__main__":
    success = create_account()
    sys.exit(0 if success else 1)