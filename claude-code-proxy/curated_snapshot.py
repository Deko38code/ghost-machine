#!/usr/bin/env python3
"""
curated_snapshot.py — Lightweight System State Capture

Captures: PM2 processes, listening ports, git status of key repos,
disk usage, memory usage, key file checksums, recent log errors.
Stores as timestamped JSON in /home/ghost/.shared/snapshots/

Designed to be fast (<2s) and low-resource — no parallel subprocesses,
no heavy tools, just quick reads of /proc and pm2 list.

Usage:
  python3 curated_snapshot.py              # capture + store
  python3 curated_snapshot.py --list       # list recent snapshots
  python3 curated_snapshot.py --diff <id>  # diff against a past snapshot
  python3 curated_snapshot.py --json       # output as JSON
"""
import json, os, sys, time, hashlib, subprocess, argparse
from pathlib import Path
from datetime import datetime, timezone

SNAPSHOT_DIR = Path("/home/ghost/.shared/snapshots")
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

KEY_REPOS = [
    Path("/home/ghost/haksterAi"),
    Path("/home/ghost/cine-vault-live"),
    Path("/home/ghost/miniforge"),
    Path("/home/ghost/phantom"),
    Path("/home/ghost/claude-code-proxy"),
]

KEY_FILES = [
    Path("/home/ghost/claude-code-proxy/shared_memory.py"),
    Path("/home/ghost/claude-code-proxy/brain_recall.py"),
    Path("/home/ghost/claude-code-proxy/fast_brain_bridge.py"),
    Path("/home/ghost/claude-code-proxy/brain_inject.js"),
    Path("/home/ghost/cine-vault-live/server.js"),
    Path("/home/ghost/cine-vault-live/js/app.js"),
]


def quick_cmd(cmd, timeout=3):
    """Run a command with strict timeout, return stdout or error string."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else f"ERR:{r.returncode}"
    except subprocess.TimeoutExpired:
        return "TIMEOUT"
    except Exception as e:
        return f"ERR:{e}"


def capture_pm2():
    """Capture PM2 process list as structured data."""
    out = quick_cmd(["pm2", "list", "--no-colors"], timeout=4)
    if out.startswith("ERR") or out == "TIMEOUT":
        return []
    processes = []
    for line in out.split("\n"):
        line = line.strip()
        if not line or line.startswith("┌") or line.startswith("├") or line.startswith("└") or line.startswith("│"):
            continue
        parts = [p.strip() for p in line.split("│") if p.strip()]
        if len(parts) >= 4 and parts[0] not in ("name", "id"):
            processes.append({
                "name": parts[0],
                "status": parts[1] if len(parts) > 1 else "?",
                "pid": parts[3] if len(parts) > 3 else "?",
            })
    return processes


def capture_ports():
    """Capture listening ports from /proc/net/tcp (no ss/netstat needed)."""
    ports = []
    try:
        with open("/proc/net/tcp") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 4 and parts[3] == "0A":  # LISTEN state
                    local = parts[1]
                    port_hex = local.split(":")[-1]
                    port = int(port_hex, 16)
                    if port > 0:
                        ports.append(port)
    except:
        pass
    # Also check tcp6
    try:
        with open("/proc/net/tcp6") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 4 and parts[3] == "0A":
                    local = parts[1]
                    port_hex = local.split(":")[-1]
                    port = int(port_hex, 16)
                    if port > 0 and port not in ports:
                        ports.append(port)
    except:
        pass
    return sorted(set(ports))


def capture_git_status(repo_path):
    """Capture git branch + dirty status for a repo."""
    if not (repo_path / ".git").exists():
        return None
    branch = quick_cmd(["git", "-C", str(repo_path), "rev-parse", "--abbrev-ref", "HEAD"], timeout=2)
    dirty = quick_cmd(["git", "-C", str(repo_path), "status", "--porcelain"], timeout=2)
    return {
        "branch": branch if not branch.startswith("ERR") else "?",
        "dirty": len(dirty.split("\n")) if dirty and not dirty.startswith("ERR") else 0,
    }


def capture_disk():
    """Capture disk usage for / only."""
    try:
        st = os.statvfs("/")
        total = st.f_blocks * st.f_frsize
        free = st.f_bavail * st.f_frsize
        used_pct = round((1 - free / total) * 100, 1) if total > 0 else 0
        return {"total_gb": round(total / 1e9, 1), "free_gb": round(free / 1e9, 1), "used_pct": used_pct}
    except:
        return {}


def capture_memory():
    """Capture RAM + swap from /proc/meminfo (no free command needed)."""
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.strip().split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = int(parts[1].strip().split()[0]) * 1024  # bytes
                    info[key] = val
        total = info.get("MemTotal", 0)
        avail = info.get("MemAvailable", 0)
        swap_total = info.get("SwapTotal", 0)
        swap_free = info.get("SwapFree", 0)
        return {
            "ram_total_gb": round(total / 1e9, 1),
            "ram_avail_gb": round(avail / 1e9, 1),
            "ram_used_pct": round((1 - avail / total) * 100, 1) if total > 0 else 0,
            "swap_total_gb": round(swap_total / 1e9, 1),
            "swap_free_gb": round(swap_free / 1e9, 1),
        }
    except:
        return {}


def capture_file_checksums():
    """Quick md5 of key files to detect changes."""
    checksums = {}
    for f in KEY_FILES:
        if f.exists():
            try:
                h = hashlib.md5(f.read_bytes()).hexdigest()
                checksums[str(f)] = h[:12]  # short hash
            except:
                checksums[str(f)] = "ERR"
    return checksums


def capture_load():
    """Capture load average from /proc/loadavg."""
    try:
        with open("/proc/loadavg") as f:
            parts = f.read().strip().split()
            return {"1min": float(parts[0]), "5min": float(parts[1]), "15min": float(parts[2])}
    except:
        return {}


def capture_snapshot():
    """Capture full system snapshot. Single-pass, no parallelism."""
    ts = datetime.now(timezone.utc)
    snapshot = {
        "timestamp": ts.isoformat(),
        "epoch": int(ts.timestamp()),
        "id": ts.strftime("%Y%m%d_%H%M%S"),
        "pm2": capture_pm2(),
        "ports": capture_ports(),
        "git": {str(r): capture_git_status(r) for r in KEY_REPOS},
        "disk": capture_disk(),
        "memory": capture_memory(),
        "load": capture_load(),
        "file_checksums": capture_file_checksums(),
    }
    return snapshot


def save_snapshot(snapshot):
    """Save snapshot to JSON file."""
    path = SNAPSHOT_DIR / f"snapshot_{snapshot['id']}.json"
    path.write_text(json.dumps(snapshot, indent=2))
    return path


def list_snapshots(limit=20):
    """List recent snapshots."""
    snaps = sorted(SNAPSHOT_DIR.glob("snapshot_*.json"), reverse=True)
    results = []
    for s in snaps[:limit]:
        try:
            data = json.loads(s.read_text())
            results.append({
                "id": data["id"],
                "timestamp": data["timestamp"],
                "pm2_count": len(data.get("pm2", [])),
                "ports": len(data.get("ports", [])),
                "ram_used_pct": data.get("memory", {}).get("ram_used_pct", "?"),
                "disk_used_pct": data.get("disk", {}).get("used_pct", "?"),
                "load_1min": data.get("load", {}).get("1min", "?"),
            })
        except:
            pass
    return results


def diff_snapshots(current_id, past_id):
    """Diff two snapshots by ID."""
    cur_path = SNAPSHOT_DIR / f"snapshot_{current_id}.json"
    past_path = SNAPSHOT_DIR / f"snapshot_{past_id}.json"
    if not cur_path.exists() or not past_path.exists():
        return {"error": "Snapshot not found"}
    cur = json.loads(cur_path.read_text())
    past = json.loads(past_path.read_text())
    
    diffs = []
    
    # PM2 diff
    cur_pm2 = {p["name"]: p for p in cur.get("pm2", [])}
    past_pm2 = {p["name"]: p for p in past.get("pm2", [])}
    for name in set(cur_pm2) | set(past_pm2):
        if name in cur_pm2 and name not in past_pm2:
            diffs.append(f"+ PM2: {name} started")
        elif name not in cur_pm2 and name in past_pm2:
            diffs.append(f"- PM2: {name} stopped")
        elif name in cur_pm2 and name in past_pm2:
            if cur_pm2[name].get("status") != past_pm2[name].get("status"):
                diffs.append(f"~ PM2: {name} {past_pm2[name].get('status')} → {cur_pm2[name].get('status')}")
    
    # Port diff
    cur_ports = set(cur.get("ports", []))
    past_ports = set(past.get("ports", []))
    for p in cur_ports - past_ports:
        diffs.append(f"+ Port {p} opened")
    for p in past_ports - cur_ports:
        diffs.append(f"- Port {p} closed")
    
    # File checksum diff
    cur_cs = cur.get("file_checksums", {})
    past_cs = past.get("file_checksums", {})
    for f in set(cur_cs) | set(past_cs):
        if f in cur_cs and f not in past_cs:
            diffs.append(f"+ File: {f} (new)")
        elif f not in cur_cs and f in past_cs:
            diffs.append(f"- File: {f} (removed)")
        elif cur_cs[f] != past_cs[f]:
            diffs.append(f"~ File: {f} (modified)")
    
    # Memory diff
    cur_ram = cur.get("memory", {}).get("ram_used_pct", 0)
    past_ram = past.get("memory", {}).get("ram_used_pct", 0)
    if abs(cur_ram - past_ram) > 5:
        diffs.append(f"~ RAM: {past_ram}% → {cur_ram}%")
    
    return {
        "current": current_id,
        "past": past_id,
        "changes": diffs,
        "change_count": len(diffs),
    }


def main():
    parser = argparse.ArgumentParser(description="Curated System Snapshots")
    parser.add_argument("--list", action="store_true", help="List recent snapshots")
    parser.add_argument("--diff", nargs=2, metavar=("CURRENT", "PAST"), help="Diff two snapshots")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--quiet", action="store_true", help="Minimal output")
    args = parser.parse_args()
    
    if args.list:
        snaps = list_snapshots()
        if args.json:
            print(json.dumps(snaps, indent=2))
        else:
            print(f"Recent snapshots ({len(snaps)}):")
            for s in snaps:
                print(f"  {s['id']} | RAM:{s['ram_used_pct']}% | Disk:{s['disk_used_pct']}% | Load:{s['load_1min']} | PM2:{s['pm2_count']} | Ports:{s['ports']}")
        return
    
    if args.diff:
        result = diff_snapshots(args.diff[0], args.diff[1])
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Diff: {args.diff[1]} → {args.diff[0]}")
            print(f"Changes: {result.get('change_count', 0)}")
            for c in result.get("changes", []):
                print(f"  {c}")
        return
    
    # Default: capture snapshot
    t0 = time.time()
    snapshot = capture_snapshot()
    path = save_snapshot(snapshot)
    elapsed = time.time() - t0
    
    if args.quiet:
        print(f"snapshot_{snapshot['id']}.json ({elapsed:.1f}s)")
    elif args.json:
        print(json.dumps(snapshot, indent=2))
    else:
        print(f"📸 Snapshot saved: {path.name} ({elapsed:.1f}s)")
        print(f"  PM2: {len(snapshot['pm2'])} processes")
        print(f"  Ports: {len(snapshot['ports'])} listening")
        print(f"  RAM: {snapshot['memory']['ram_used_pct']}% used ({snapshot['memory']['ram_avail_gb']}GB free)")
        print(f"  Disk: {snapshot['disk']['used_pct']}% used ({snapshot['disk']['free_gb']}GB free)")
        print(f"  Load: {snapshot['load']['1min']} (1min)")
        print(f"  Git repos: {sum(1 for v in snapshot['git'].values() if v)} tracked")
        print(f"  File checksums: {len(snapshot['file_checksums'])} files")


if __name__ == "__main__":
    main()