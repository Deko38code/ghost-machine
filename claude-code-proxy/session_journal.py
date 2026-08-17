#!/usr/bin/env python3
"""
session_journal.py — Conversation Flow Memory

Captures task narratives (what we did, decisions, next steps) into shared memory
with session_flow tags so they surface in brain_recall at next session start.

Usage:
  python3 session_journal.py start "Building brain system" --project haksterai
  python3 session_journal.py decision "Used BM25 instead of vector search for speed"
  python3 session_journal.py complete "Built 6-layer brain system" --files brain_recall.py,curated_snapshot.py --next "wire crash recovery"
  python3 session_journal.py list                    # show recent journal entries
  python3 session_journal.py list --project cinevault
  python3 session_journal.py --json                  # JSON output
"""
import json, os, sys, argparse
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shared_memory as sm

JOURNAL_PREFIX = "journal_"


def journal_start(task, project=None, context=None):
    """Record the start of a task."""
    ts = datetime.now(timezone.utc)
    entry_id = ts.strftime("%Y%m%d_%H%M%S")
    key = f"{JOURNAL_PREFIX}{entry_id}_start"
    value = json.dumps({
        "phase": "start",
        "task": task,
        "context": context or "",
        "started_at": ts.isoformat(),
    })
    tags = ["session_flow", "conversation"]
    if project:
        tags.append(project)
    result = sm.memory_add(key, value, agent="haksterai", category="journal", tags=tags)
    return {"id": entry_id, "key": key, "status": "started", "task": task, **result}


def journal_decision(decision, rationale=None, project=None):
    """Record a decision made during a task."""
    ts = datetime.now(timezone.utc)
    entry_id = ts.strftime("%Y%m%d_%H%M%S")
    key = f"{JOURNAL_PREFIX}{entry_id}_decision"
    value = json.dumps({
        "phase": "decision",
        "decision": decision,
        "rationale": rationale or "",
        "decided_at": ts.isoformat(),
    })
    tags = ["session_flow", "conversation", "decision"]
    if project:
        tags.append(project)
    result = sm.memory_add(key, value, agent="haksterai", category="journal", tags=tags)
    return {"id": entry_id, "key": key, "status": "recorded", "decision": decision, **result}


def journal_complete(task, files=None, outcome=None, next_steps=None, project=None):
    """Record task completion with files touched and next steps."""
    ts = datetime.now(timezone.utc)
    entry_id = ts.strftime("%Y%m%d_%H%M%S")
    key = f"{JOURNAL_PREFIX}{entry_id}_complete"
    value = json.dumps({
        "phase": "complete",
        "task": task,
        "files": files or [],
        "outcome": outcome or "",
        "next_steps": next_steps or "",
        "completed_at": ts.isoformat(),
    })
    tags = ["session_flow", "conversation", "complete"]
    if project:
        tags.append(project)
    result = sm.memory_add(key, value, agent="haksterai", category="journal", tags=tags)
    return {"id": entry_id, "key": key, "status": "completed", "task": task, **result}


def journal_note(note, project=None):
    """Record a general note during a task."""
    ts = datetime.now(timezone.utc)
    entry_id = ts.strftime("%Y%m%d_%H%M%S")
    key = f"{JOURNAL_PREFIX}{entry_id}_note"
    value = json.dumps({
        "phase": "note",
        "note": note,
        "noted_at": ts.isoformat(),
    })
    tags = ["session_flow", "conversation", "note"]
    if project:
        tags.append(project)
    result = sm.memory_add(key, value, agent="haksterai", category="journal", tags=tags)
    return {"id": entry_id, "key": key, "status": "noted", "note": note, **result}


def journal_list(project=None, limit=20):
    """List recent journal entries, optionally filtered by project."""
    store = sm.memory_list()
    entries = []
    for key, entry in store.items():
        if not key.startswith(JOURNAL_PREFIX):
            continue
        tags = entry.get("tags", [])
        if project and project not in tags:
            continue
        try:
            val = json.loads(entry.get("value", "{}"))
        except:
            val = {"raw": entry.get("value", "")}
        entries.append({
            "key": key,
            "timestamp": entry.get("timestamp", "?"),
            "phase": val.get("phase", "?"),
            "task": val.get("task", val.get("decision", val.get("note", "?"))),
            "tags": tags,
            "raw": val,
        })
    entries.sort(key=lambda e: e["timestamp"], reverse=True)
    return entries[:limit]


def format_journal(entries):
    """Format journal entries as markdown."""
    if not entries:
        return "No journal entries found."
    lines = ["## 📝 Session Journal (Recent Task Flow)", ""]
    for e in entries:
        emoji = {"start": "🚀", "decision": "🔀", "complete": "✅", "note": "📌"}.get(e["phase"], "•")
        task = e["task"][:120] if isinstance(e["task"], str) else str(e["task"])[:120]
        tags = f" `#{' #'.join(e.get('tags', []))}`" if e.get("tags") else ""
        lines.append(f"{emoji} **[{e['timestamp'][:19]}]** {task}{tags}")
        raw = e.get("raw", {})
        if raw.get("files"):
            lines.append(f"   Files: {', '.join(raw['files'][:5])}")
        if raw.get("outcome"):
            lines.append(f"   Outcome: {raw['outcome'][:150]}")
        if raw.get("next_steps"):
            lines.append(f"   Next: {raw['next_steps'][:150]}")
        if raw.get("rationale"):
            lines.append(f"   Why: {raw['rationale'][:150]}")
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Session Journal — Conversation Flow Memory")
    sub = parser.add_subparsers(dest="command")
    
    p_start = sub.add_parser("start", help="Record task start")
    p_start.add_argument("task", help="Task description")
    p_start.add_argument("--project", default=None)
    p_start.add_argument("--context", default=None)
    
    p_dec = sub.add_parser("decision", help="Record a decision")
    p_dec.add_argument("decision", help="Decision description")
    p_dec.add_argument("--rationale", default=None)
    p_dec.add_argument("--project", default=None)
    
    p_comp = sub.add_parser("complete", help="Record task completion")
    p_comp.add_argument("task", help="Task description")
    p_comp.add_argument("--files", default=None, help="Comma-separated file list")
    p_comp.add_argument("--outcome", default=None)
    p_comp.add_argument("--next", default=None, help="Next steps")
    p_comp.add_argument("--project", default=None)
    
    p_note = sub.add_parser("note", help="Record a general note")
    p_note.add_argument("note", help="Note text")
    p_note.add_argument("--project", default=None)
    
    p_list = sub.add_parser("list", help="List recent journal entries")
    p_list.add_argument("--project", default=None)
    p_list.add_argument("--limit", type=int, default=20)
    
    parser.add_argument("--json", action="store_true", help="JSON output")
    
    args = parser.parse_args()
    
    if args.command == "start":
        result = journal_start(args.task, args.project, args.context)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"🚀 Task started: {args.task}")
            if args.project:
                print(f"   Project: {args.project}")
            print(f"   ID: {result['id']}")
    
    elif args.command == "decision":
        result = journal_decision(args.decision, args.rationale, args.project)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"🔀 Decision: {args.decision}")
            if args.rationale:
                print(f"   Why: {args.rationale}")
    
    elif args.command == "complete":
        files = args.files.split(",") if args.files else []
        result = journal_complete(args.task, files, args.outcome, args.next, args.project)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"✅ Task complete: {args.task}")
            if files:
                print(f"   Files: {', '.join(files)}")
            if args.outcome:
                print(f"   Outcome: {args.outcome}")
            if args.next:
                print(f"   Next: {args.next}")
    
    elif args.command == "note":
        result = journal_note(args.note, args.project)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"📌 Note: {args.note}")
    
    elif args.command == "list":
        entries = journal_list(args.project, args.limit)
        if args.json:
            print(json.dumps(entries, indent=2))
        else:
            print(format_journal(entries))
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()