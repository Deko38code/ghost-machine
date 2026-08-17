"""
Shared Agent Memory — Replicated notes/memories across all agents.
- Central store on the peer sync hub (port 8084)
- File-backed at /home/ghost/.shared/agent-memory.json
- All agents read/write to the same store
- If one agent dies, others have full copy
- On restart, agent restores from hub
- Supports tags for path-scoped filtering
"""
import json
import os
import time
import fcntl
from datetime import datetime, timezone
from pathlib import Path

SHARED_DIR = Path("/home/ghost/.shared")
SHARED_DIR.mkdir(parents=True, exist_ok=True)

MEMORY_FILE = SHARED_DIR / "agent-memory.json"
NOTES_FILE = SHARED_DIR / "agent-notes.json"
BACKUP_DIR = SHARED_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _load(path: Path) -> dict:
    """Load JSON from file with file locking."""
    if not path.exists():
        return {}
    try:
        with open(path, "r") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            data = json.load(f)
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        return data if isinstance(data, dict) else {}
    except:
        return {}


def _save(path: Path, data: dict) -> None:
    """Save JSON to file with file locking (atomic via tmp+rename)."""
    tmp = str(path) + ".tmp"
    with open(tmp, "w") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        json.dump(data, f, indent=2, sort_keys=True)
        f.flush()
        os.fsync(f.fileno())
        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    os.rename(tmp, str(path))  # atomic rename


# === Memory Store ===

def memory_add(key: str, value: str, agent: str = "unknown", category: str = "general", tags: list = None) -> dict:
    """Add or update a memory entry. Optional tags for path-scoped filtering."""
    store = _load(MEMORY_FILE)
    entry = {
        "value": value,
        "agent": agent,
        "category": category,
        "tags": tags or [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if key in store:
        entry["created_at"] = store[key].get("created_at", entry["timestamp"])
        entry["revision"] = store[key].get("revision", 1) + 1
    else:
        entry["created_at"] = entry["timestamp"]
        entry["revision"] = 1
    store[key] = entry
    _save(MEMORY_FILE, store)
    return {"status": "saved", "key": key, "revision": entry["revision"]}


def memory_get(key: str) -> dict:
    """Get a memory entry by key."""
    store = _load(MEMORY_FILE)
    return store.get(key, {})


def memory_list() -> dict:
    """List all memory entries."""
    return _load(MEMORY_FILE)


def memory_search(query: str, top_n: int = 10) -> list:
    """Simple text search across all memories."""
    store = _load(MEMORY_FILE)
    query_lower = query.lower()
    results = []
    for key, entry in store.items():
        val = entry.get("value", "")
        if isinstance(val, str) and query_lower in val.lower():
            results.append({"key": key, **entry})
        elif isinstance(val, dict):
            text = json.dumps(val)
            if query_lower in text.lower():
                results.append({"key": key, **entry})
    return results[:top_n]


def memory_delete(key: str) -> dict:
    """Delete a memory entry by key."""
    store = _load(MEMORY_FILE)
    if key in store:
        del store[key]
        _save(MEMORY_FILE, store)
        return {"status": "deleted", "key": key}
    return {"status": "not_found", "key": key}


def memory_clear() -> dict:
    """Clear all memory entries."""
    _save(MEMORY_FILE, {})
    return {"status": "cleared"}


def memory_by_tag(tag: str) -> list:
    """Get all memories with a specific tag."""
    store = _load(MEMORY_FILE)
    results = []
    for key, entry in store.items():
        tags = entry.get("tags", [])
        if isinstance(tags, list) and tag in tags:
            results.append({"key": key, **entry})
    return results


def memory_by_agent(agent: str) -> list:
    """Get all memories from a specific agent."""
    store = _load(MEMORY_FILE)
    results = []
    for key, entry in store.items():
        if entry.get("agent") == agent:
            results.append({"key": key, **entry})
    return results


# === Notes Store ===

def notes_add(key: str, value: str, agent: str = "unknown") -> dict:
    """Add a note."""
    store = _load(NOTES_FILE)
    store[key] = {
        "value": value,
        "agent": agent,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _save(NOTES_FILE, store)
    return {"status": "saved", "key": key}


def notes_list() -> dict:
    """List all notes."""
    return _load(NOTES_FILE)


def notes_get(key: str) -> dict:
    """Get a note by key."""
    store = _load(NOTES_FILE)
    return store.get(key, {})


def notes_delete(key: str) -> dict:
    """Delete a note by key."""
    store = _load(NOTES_FILE)
    if key in store:
        del store[key]
        _save(NOTES_FILE, store)
        return {"status": "deleted", "key": key}
    return {"status": "not_found", "key": key}


# === Backup ===

def backup() -> dict:
    """Create a backup of all memory files."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backed_up = []
    for src in [MEMORY_FILE, NOTES_FILE]:
        if src.exists():
            dst = BACKUP_DIR / f"{src.stem}_{ts}.json"
            try:
                dst.write_bytes(src.read_bytes())
                backed_up.append(str(dst))
            except:
                pass
    return {"status": "ok", "backups": backed_up}


# === CLI ===

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 shared_memory.py [list|search <query>|add <key> <value>|delete <key>]")
        sys.exit(1)
    
    cmd = sys.argv[1]
    if cmd == "list":
        store = memory_list()
        print(f"Total memories: {len(store)}")
        for key, entry in list(store.items())[:20]:
            tags = entry.get("tags", [])
            tag_str = f" [{', '.join(tags)}]" if tags else ""
            print(f"  {key}: {entry.get('agent', '?')}/{entry.get('category', '?')}{tag_str}")
    elif cmd == "search" and len(sys.argv) > 2:
        results = memory_search(sys.argv[2])
        print(f"Found {len(results)} results:")
        for r in results:
            print(f"  {r['key']}: {r.get('value', '')[:100]}")
    elif cmd == "add" and len(sys.argv) > 4:
        key, value = sys.argv[2], sys.argv[3]
        tags = sys.argv[4].split(",") if len(sys.argv) > 4 else []
        result = memory_add(key, value, tags=tags)
        print(f"Added: {result}")
    elif cmd == "delete" and len(sys.argv) > 2:
        result = memory_delete(sys.argv[2])
        print(f"Deleted: {result}")
    else:
        print("Unknown command")