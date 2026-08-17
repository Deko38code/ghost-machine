#!/usr/bin/env python3
"""
brain_compact.py — Memory Compaction for the Sonnet Brain (L8)

When the shared memory store gets too large, summarize old entries
instead of truncating. Groups entries by category, keeps most recent
and highest-scoring, compresses the rest into summary entries.

Usage:
  python3 brain_compact.py                    # compact if over threshold
  python3 brain_compact.py --threshold 800    # custom max entries
  python3 brain_compact.py --dry-run          # preview without writing
  python3 brain_compact.py --json             # JSON output
"""
import json, os, sys, argparse
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shared_memory as sm

DEFAULT_THRESHOLD = 500  # compact when store exceeds this
KEEP_RECENT = 50         # always keep most recent N per category
KEEP_TAGGED = 50         # always keep tagged/important entries
SUMMARY_PREFIX = "compact_summary_"


def categorize_entry(key, entry):
    """Determine entry category for grouping."""
    if key.startswith("journal_"):
        return "journal"
    if key.startswith("snapshot_"):
        return "snapshot"
    if key.startswith("compact_summary_"):
        return "summary"
    if key.startswith(SUMMARY_PREFIX):
        return "summary"
    cat = entry.get("category", "general")
    if cat in ("error", "pattern", "lesson"):
        return cat
    return "general"


def compact_store(threshold=DEFAULT_THRESHOLD, dry_run=False):
    """Compact the memory store if it exceeds threshold."""
    store = sm.memory_list()
    total = len(store)
    
    if total <= threshold:
        return {
            "action": "skip",
            "reason": f"Store has {total} entries, under threshold {threshold}",
            "total": total,
            "compacted": 0,
        }
    
    # Group entries by category
    categories = defaultdict(list)
    for key, entry in store.items():
        cat = categorize_entry(key, entry)
        categories[cat].append((key, entry))
    
    # For each category, decide what to keep and what to compact
    to_keep = []
    to_compact = []
    
    for cat, entries in categories.items():
        # Sort by timestamp (newest first)
        entries.sort(key=lambda x: x[1].get("timestamp", ""), reverse=True)
        
        # Always keep summaries
        if cat == "summary":
            to_keep.extend(entries)
            continue
        
        # Always keep journal entries (they're the conversation flow)
        if cat == "journal":
            to_keep.extend(entries[:KEEP_RECENT])
            to_compact.extend(entries[KEEP_RECENT:])
            continue
        
        # Always keep snapshots (they're small and rotate already)
        if cat == "snapshot":
            to_keep.extend(entries[:20])
            to_compact.extend(entries[20:])
            continue
        
        # For errors, patterns, lessons, general:
        # Keep recent + tagged entries, compact the rest
        recent = entries[:KEEP_RECENT]
        older = entries[KEEP_RECENT:]
        
        for key, entry in older:
            tags = entry.get("tags", [])
            # Keep if it has important tags
            if any(t in tags for t in ["important", "pinned", "critical", "decision"]):
                to_keep.append((key, entry))
            else:
                to_compact.append((key, entry))
        
        to_keep.extend(recent)
    
    if not to_compact:
        return {
            "action": "skip",
            "reason": "Nothing to compact after filtering",
            "total": total,
            "compacted": 0,
        }
    
    # Build summary entries from compacted data
    summaries = defaultdict(list)
    for key, entry in to_compact:
        cat = categorize_entry(key, entry)
        text = entry.get("value", "")
        if isinstance(text, str) and len(text) > 200:
            text = text[:200] + "..."
        summaries[cat].append({
            "key": key,
            "text": text,
            "timestamp": entry.get("timestamp", ""),
            "tags": entry.get("tags", []),
        })
    
    # Create compact summary entries
    ts = datetime.now(timezone.utc)
    summary_entries = []
    for cat, items in summaries.items():
        if not items:
            continue
        summary_key = f"{SUMMARY_PREFIX}{cat}_{ts.strftime('%Y%m%d_%H%M%S')}"
        summary_value = json.dumps({
            "category": cat,
            "count": len(items),
            "compacted_at": ts.isoformat(),
            "items": [{"k": i["key"], "t": i["text"][:100], "ts": i["timestamp"]} for i in items[:50]],
        })
        summary_entries.append((summary_key, summary_value, cat))
    
    if dry_run:
        return {
            "action": "dry_run",
            "total": total,
            "keep": len(to_keep),
            "compact": len(to_compact),
            "summaries": len(summary_entries),
            "summary_details": [{"key": k, "category": c, "count": len(summaries[c])} for k, v, c in summary_entries],
        }
    
    # Execute compaction
    # 1. Remove old entries
    removed = 0
    for key, entry in to_compact:
        try:
            sm.memory_remove(key)
            removed += 1
        except:
            pass
    
    # 2. Add summary entries
    added = 0
    for key, value, cat in summary_entries:
        try:
            sm.memory_add(key, value, agent="brain_compact", category="compact_summary", tags=["compacted", cat])
            added += 1
        except:
            pass
    
    return {
        "action": "compacted",
        "total_before": total,
        "removed": removed,
        "summaries_added": added,
        "total_after": len(sm.memory_list()),
    }


def main():
    parser = argparse.ArgumentParser(description="Brain Memory Compaction (L8)")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD, help="Max entries before compaction triggers")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()
    
    result = compact_store(threshold=args.threshold, dry_run=args.dry_run)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result["action"] == "skip":
            print(f"⏭️  {result['reason']}")
        elif result["action"] == "dry_run":
            print(f"🔍 DRY RUN: {result['total']} entries")
            print(f"   Keep: {result['keep']}")
            print(f"   Compact: {result['compact']}")
            print(f"   Summaries: {result['summaries']}")
            for s in result.get("summary_details", []):
                print(f"     {s['category']}: {s['count']} entries → 1 summary")
        elif result["action"] == "compacted":
            print(f"✅ Compacted: {result['total_before']} → {result['total_after']} entries")
            print(f"   Removed: {result['removed']}")
            print(f"   Summaries added: {result['summaries_added']}")


if __name__ == "__main__":
    main()