#!/usr/bin/env python3
"""
brain_recall.py — Active Recall Injection for the Sonnet Brain

Takes a task description, searches all memory sources for relevant past knowledge,
returns a formatted context block for injection into new sessions.

Features:
  --project <name>   Filter/prioritize by project tags (cinevault, haksterai, etc.)
  --inspect          Show what would be injected without modifying prompt
  --json             Output as JSON
  --top N            Max results (default 8)

Usage:
  python3 brain_recall.py "fix port conflict on 8084"
  python3 brain_recall.py "deploy cinevault" --project cinevault
  python3 brain_recall.py "phantom routing" --inspect
"""
import json, os, sys, re, math, argparse
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brain_import
import brain_autolearn

# === Memory Sources ===
SHARED_MEMORY = Path("/home/ghost/.shared/agent-memory.json")
HAKSTER_PATTERNS = Path("/home/ghost/haksterAi/.hakster/memories/banks/patterns.json")
HAKSTER_ERRORS = Path("/home/ghost/haksterAi/.hakster/memories/banks/errors.json")
HAKSTER_MEMORY_MD = Path("/home/ghost/haksterAi/.hakster/MEMORY.md")
PHANTOM_KNOWLEDGE = Path("/home/ghost/phantom/phantom-knowledge.md")
SNAPSHOT_DIR = Path("/home/ghost/.shared/snapshots")

# === Project directories for .local-brain.md ===
PROJECT_DIRS = {
    "haksterai": Path("/home/ghost/haksterAi"),
    "phantom": Path("/home/ghost/phantom"),
    "miniforge": Path("/home/ghost/miniforge"),
    "cinevault": Path("/home/ghost/cine-vault-live"),
}

# === Project tag mapping ===
PROJECT_TAGS = {
    "cinevault": ["cinevault", "streaming", "tmdb", "channels", "nodejs", "all"],
    "haksterai": ["haksterai", "cli", "proxy", "agents", "all"],
    "phantom": ["phantom", "ide", "workspace", "all"],
    "miniforge": ["miniforge", "bots", "categories", "all"],
}


def tokenize(text):
    """Simple tokenizer for BM25-like scoring."""
    if not text:
        return []
    return re.findall(r'[a-z0-9]+', text.lower())


def bm25_score(query_tokens, doc_tokens, doc_len, avg_doc_len, idf_map, k1=1.5, b=0.75):
    """BM25 scoring function."""
    score = 0.0
    tf_map = Counter(doc_tokens)
    for qt in query_tokens:
        tf = tf_map.get(qt, 0)
        if tf == 0:
            continue
        idf = idf_map.get(qt, 0)
        norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * doc_len / max(avg_doc_len, 1)))
        score += idf * norm
    return score


def load_shared_memory():
    """Load all entries from shared memory bank."""
    entries = []
    if not SHARED_MEMORY.exists():
        return entries
    try:
        data = json.loads(SHARED_MEMORY.read_text())
        if isinstance(data, dict):
            for key, entry in data.items():
                if isinstance(entry, dict):
                    val = entry.get("value", "")
                    try:
                        val_data = json.loads(val) if isinstance(val, str) else val
                        if isinstance(val_data, dict):
                            text = val_data.get("what", val_data.get("error", val_data.get("name", str(val_data))))
                        else:
                            text = str(val_data)
                    except:
                        text = str(val)
                    entries.append({
                        "key": key,
                        "text": text,
                        "agent": entry.get("agent", "?"),
                        "category": entry.get("category", "?"),
                        "tags": entry.get("tags", []),
                        "source": "shared",
                        "raw": entry,
                    })
    except:
        pass
    return entries


def load_hakster_banks():
    """Load hakster pattern/error banks."""
    entries = []
    for bank_path, cat in [(HAKSTER_PATTERNS, "pattern"), (HAKSTER_ERRORS, "error")]:
        if not bank_path.exists():
            continue
        try:
            data = json.loads(bank_path.read_text())
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        text = item.get("what", item.get("error", item.get("name", str(item))))
                        entries.append({
                            "key": f"hakster_{cat}_{item.get('id', '')}",
                            "text": text,
                            "agent": "haksterai",
                            "category": cat,
                            "tags": item.get("tags", []),
                            "source": "hakster_bank",
                            "raw": item,
                        })
        except:
            pass
    return entries


def load_local_brain(project=None):
    """Load .local-brain.md content for a specific project."""
    if not project or project not in PROJECT_DIRS:
        return []
    entries = []
    local_brain = PROJECT_DIRS[project] / ".local-brain.md"
    if local_brain.exists():
        try:
            content = brain_import.resolve_imports(local_brain)
            # Split into sections by ## headers
            for section in re.split(r'\n(?=## )', content):
                section = section.strip()
                if section and len(section) > 10:
                    entries.append({
                        "key": f"local_brain_{project}",
                        "text": section,
                        "agent": project,
                        "category": "local_rule",
                        "tags": PROJECT_TAGS.get(project, []),
                        "source": "local_brain",
                        "raw": {"section": section[:200]},
                    })
        except:
            pass
    return entries


def load_filetype_rules(filetype=None):
    """Load file-type-scoped rules from .brain-rules/ directories."""
    if not filetype:
        return []
    entries = []
    for project, proj_dir in PROJECT_DIRS.items():
        rules_dir = proj_dir / ".brain-rules"
        if not rules_dir.exists():
            continue
        rule_file = rules_dir / f"{filetype}.md"
        if rule_file.exists():
            try:
                content = brain_import.resolve_imports(rule_file)
                for section in re.split(r'\n(?=## )', content):
                    section = section.strip()
                    if section and len(section) > 10:
                        entries.append({
                            "key": f"filetype_rule_{project}_{filetype}",
                            "text": section,
                            "agent": project,
                            "category": "filetype_rule",
                            "tags": ["filetype_rule", filetype, project],
                            "source": "filetype_rule",
                        })
            except:
                pass
    return entries

def load_snapshots(top_n=5):
    """Load recent curated snapshots as searchable entries."""
    entries = []
    if not SNAPSHOT_DIR.exists():
        return entries
    snaps = sorted(SNAPSHOT_DIR.glob("snapshot_*.json"), reverse=True)[:top_n]
    for snap_path in snaps:
        try:
            data = json.loads(snap_path.read_text())
            # Build searchable text from snapshot
            pm2_names = [p.get("name", "?") for p in data.get("pm2", [])]
            ports = data.get("ports", [])
            ram = data.get("memory", {}).get("ram_used_pct", "?")
            disk = data.get("disk", {}).get("used_pct", "?")
            load = data.get("load", {}).get("1min", "?")
            text = f"Snapshot {data.get('id','?')}: PM2={pm2_names} Ports={ports} RAM={ram}% Disk={disk}% Load={load}"
            entries.append({
                "key": f"snapshot_{data.get('id','?')}",
                "text": text,
                "agent": "system",
                "category": "snapshot",
                "tags": ["snapshot", "system", "all"],
                "source": "snapshot",
                "raw": data,
            })
        except:
            pass
    return entries


def load_journal(top_n=10):
    """Load recent session journal entries for conversation flow."""
    entries = []
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import shared_memory as sm
        store = sm.memory_list()
        journal_items = []
        for key, entry in store.items():
            if not key.startswith("journal_"):
                continue
            try:
                val = json.loads(entry.get("value", "{}"))
            except:
                continue
            phase = val.get("phase", "?")
            task = val.get("task", val.get("decision", val.get("note", "?")))
            text = f"Journal [{phase}]: {task}"
            if val.get("outcome"):
                text += f" → {val['outcome']}"
            if val.get("next_steps"):
                text += f" | Next: {val['next_steps']}"
            journal_items.append({
                "key": key,
                "text": text,
                "agent": entry.get("agent", "haksterai"),
                "category": "journal",
                "tags": entry.get("tags", ["session_flow"]),
                "source": "journal",
                "raw": val,
                "timestamp": entry.get("timestamp", ""),
            })
        # Sort by timestamp, take most recent
        journal_items.sort(key=lambda e: e["timestamp"], reverse=True)
        entries = journal_items[:top_n]
    except:
        pass
    return entries


def search_memories(query, top_n=8, project=None, filetype=None):
    """Search all memory sources and return ranked results."""
    all_entries = []
    all_entries.extend(load_shared_memory())
    all_entries.extend(load_hakster_banks())
    all_entries.extend(load_local_brain(project))
    all_entries.extend(load_snapshots())
    all_entries.extend(load_journal())
    if filetype:
        all_entries.extend(load_filetype_rules(filetype))
    # Always load auto-learned rules
    all_entries.extend(load_filetype_rules('auto-learned'))

    if not all_entries:
        return []
    # Deduplicate by text content (first 100 chars, lowercased)
    seen = set()
    unique = []
    for entry in all_entries:
        dedup_key = entry["text"][:100].lower().strip()
        if dedup_key not in seen:
            seen.add(dedup_key)
            unique.append(entry)
    all_entries = unique

    # Build BM25 index
    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    docs = [tokenize(e["text"]) for e in all_entries]
    doc_lens = [len(d) for d in docs]
    avg_doc_len = sum(doc_lens) / max(len(doc_lens), 1)

    # Build IDF map
    N = len(docs)
    df_map = Counter()
    for doc in docs:
        for term in set(doc):
            df_map[term] += 1
    idf_map = {}
    for term, df in df_map.items():
        idf_map[term] = math.log((N - df + 0.5) / (df + 0.5) + 1)

    # Score and rank
    scored = []
    project_tags = set(PROJECT_TAGS.get(project, [])) if project else set()
    for i, entry in enumerate(all_entries):
        if score > 0:
            # Apply memory decay scoring
            decay = brain_autolearn.decay_score(entry)
            score *= decay
            # Project tag boost: if entry has matching tags, boost score
            if project_tags and entry.get("tags"):
                entry_tags = set(entry["tags"]) if isinstance(entry.get("tags"), list) else set()
                overlap = project_tags & entry_tags
                if overlap:
                    score *= 1.0 + 0.3 * len(overlap)  # 30% boost per matching tag
                else:
                    score *= 0.7  # 30% penalty for non-matching entries when project is specified

            # Local brain entries get a boost
            if entry["source"] == "local_brain":
                score *= 1.5

            scored.append((score, entry))

    scored.sort(key=lambda x: -x[0])
    return [(s, e) for s, e in scored[:top_n]]


def format_results(results, query, project=None):
    """Format results as markdown for injection."""
    if not results:
        return ""

    lines = []
    header = "## 🧠 Relevant Past Knowledge (Auto-Injected)"
    if project:
        header += f" [Project: {project}]"
    lines.append(header)
    lines.append(f"_Searched {len(results)} matches for: \"{query}\"_")
    lines.append("")

    for score, entry in results:
        emoji = "✅" if entry["category"] == "pattern" else "❌" if entry["category"] == "error" else "📌"
        tags_str = f" `#{' #'.join(entry.get('tags', []))}`" if entry.get("tags") else ""
        lines.append(f"{score:.2f}. {emoji} **[{entry['agent']}]** {entry['text'][:200]}{tags_str}")
        lines.append(f" _Source: {entry['source']} | Score: {score:.4f}_")
        lines.append("")

    return "\n".join(lines)


def format_inspect(results, query, project=None):
    """Format results as an inspection report (like /context)."""
    lines = []
    lines.append("## 🔍 Brain Injection Inspection Report")
    lines.append(f"_Query: \"{query}\"_")
    if project:
        lines.append(f"_Project filter: {project}_")
        lines.append(f"_Project tags: {', '.join(PROJECT_TAGS.get(project, []))}_")
    lines.append("")

    if not results:
        lines.append("❌ No matching memories found.")
        return "\n".join(lines)

    total_tokens = 0
    lines.append(f"### Would Inject {len(results)} Memories:")
    lines.append("")
    lines.append("| # | Score | Source | Agent | Category | Tags | Text (preview) | ~Tokens |")
    lines.append("|---|-------|--------|-------|----------|------|----------------|---------|")
    for i, (score, entry) in enumerate(results, 1):
        text_preview = entry["text"][:80].replace("|", "\\|")
        tags = ", ".join(entry.get("tags", [])) or "—"
        token_est = len(entry["text"]) // 4
        total_tokens += token_est
        lines.append(f"| {i} | {score:.4f} | {entry['source']} | {entry['agent']} | {entry['category']} | {tags} | {text_preview} | ~{token_est} |")

    lines.append("")
    lines.append(f"**Total estimated tokens: ~{total_tokens}**")
    lines.append(f"**Sources searched:** shared bank, hakster banks, local brain")
    if project:
        local_brain_path = PROJECT_DIRS.get(project, Path(".")) / ".local-brain.md"
        lines.append(f"**Local brain:** {local_brain_path} ({'✅ found' if local_brain_path.exists() else '❌ not found'})")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Sonnet Brain Active Recall")
    parser.add_argument("query", nargs="?", default="", help="Search query")
    parser.add_argument("--project", default=None, help="Filter by project (cinevault, haksterai, phantom, miniforge)")
    parser.add_argument("--inspect", action="store_true", help="Show what would be injected (no prompt modification)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--top", type=int, default=8, help="Max results")
    parser.add_argument("--filetype", default=None, help="File type for scoped rules (sh, py, tsx, etc.)")
    args = parser.parse_args()

    if not args.query:
        print("Usage: python3 brain_recall.py \"your query\" [--project NAME] [--inspect] [--json] [--top N]")
        sys.exit(1)

    results = search_memories(args.query, top_n=args.top, project=args.project, filetype=args.filetype)

    if args.inspect:
        if args.json:
            output = {
                "query": args.query,
                "project": args.project,
                "result_count": len(results),
                "results": [
                    {"score": s, "agent": e["agent"], "category": e["category"],
                     "source": e["source"], "text": e["text"][:200], "tags": e.get("tags", [])}
                    for s, e in results
                ],
                "total_estimated_tokens": sum(len(e["text"]) // 4 for _, e in results),
            }
            print(json.dumps(output, indent=2))
        else:
            print(format_inspect(results, args.query, args.project))
    else:
        if args.json:
            output = {
                "query": args.query,
                "project": args.project,
                "result_count": len(results),
                "augmented_prompt": format_results(results, args.query, args.project),
                "results": [
                    {"score": s, "agent": e["agent"], "text": e["text"][:200]}
                    for s, e in results
                ],
            }
            print(json.dumps(output, indent=2))
        else:
            print(format_results(results, args.query, args.project))


if __name__ == "__main__":
    main()