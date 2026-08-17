#!/usr/bin/env python3
"""
Fast Sonnet Brain Bridge — Direct File I/O (no HTTP, no slow POST loops)
Reads all memory sources directly from disk, writes unified brain file to all agents.

Features:
  - Aggregates from shared bank, hakster banks, phantom memory, claude memories
  - Reads .brain-rules/ directories for path-scoped rules
  - Appends .local-brain.md content per-project (hierarchical brain)
  - Writes to all 4 agent brain files
"""
import json, os, sys, time
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shared_memory as sm
import brain_import
import brain_compact

HAKSTER = Path("/home/ghost/haksterAi/.hakster")
HAKSTER_MEMORIES = HAKSTER / "memories"
HAKSTER_BANKS = HAKSTER_MEMORIES / "banks"
HAKSTER_SKILLS = HAKSTER / "skills"
HAKSTER_MEMORY_MD = HAKSTER / "MEMORY.md"
HAKSTER_MEMORY_DIR = HAKSTER / "memory"

PHANTOM = Path("/home/ghost/phantom")
PHANTOM_MEM_JSON = PHANTOM / ".phantom-memory.json"
PHANTOM_KNOWLEDGE = PHANTOM / "phantom-knowledge.md"
PHANTOM_AGENT_KNOWLEDGE = PHANTOM / "phantom-agent-knowledge"

CLAUDE_PROXY = Path("/home/ghost/claude-code-proxy")
CLAUDE_MEMORIES = CLAUDE_PROXY / "memories"

# All agent brain targets + their project dirs for local brain + brain rules
AGENT_TARGETS = [
    {
        "brain_file": HAKSTER_MEMORY_DIR / "shared_agent_brain.md",
        "project_dir": Path("/home/ghost/haksterAi"),
        "project_name": "haksterai",
    },
    {
        "brain_file": PHANTOM / ".phantom-shared-brain.md",
        "project_dir": PHANTOM,
        "project_name": "phantom",
    },
    {
        "brain_file": Path("/home/ghost/miniforge/.miniforge-shared-brain.md"),
        "project_dir": Path("/home/ghost/miniforge"),
        "project_name": "miniforge",
    },
    {
        "brain_file": Path("/home/ghost/cine-vault-live/.cinevault-shared-brain.md"),
        "project_dir": Path("/home/ghost/cine-vault-live"),
        "project_name": "cinevault",
    },
]


def build_brain():
    # L8: Auto-compact memory if over threshold
    try:
        brain_compact.compact_store(threshold=500)
    except:
        pass
    """Read all memory sources and build unified brain content."""
    stats = {
        "hakster_entries": 0,
        "phantom_entries": 0,
        "phantom_skills": 0,
        "shared_entries": 0,
        "claude_entries": 0,
        "brain_rules": 0,
        "local_brain": 0,
        "total": 0,
    }

    sections = []
    sections.append("# 🧠 Sonnet Brain Unified Agent Memory")
    sections.append(f"_Built: {datetime.now(timezone.utc).isoformat()}_")
    sections.append("")

    # === HAKSTER MEMORY.md ===
    sections.append("## HaksterAI Core Memory")
    if HAKSTER_MEMORY_MD.exists():
        try:
            content = HAKSTER_MEMORY_MD.read_text()
            sections.append(content[:2000])
            stats["hakster_entries"] += 1
        except:
            pass
    sections.append("")

    # === HAKSTER MEMORY BANKS ===
    sections.append("## HaksterAI Memory Banks")
    if HAKSTER_BANKS.exists():
        for bank_file in HAKSTER_BANKS.glob("*.json"):
            try:
                data = json.loads(bank_file.read_text())
                if isinstance(data, list):
                    for entry in data[:20]:
                        if isinstance(entry, dict):
                            what = entry.get("what", entry.get("error", entry.get("name", str(entry)[:200])))
                            sections.append(f"- 📌 {what[:200]}")
                            stats["hakster_entries"] += 1
            except:
                pass
    sections.append("")

    # === HAKSTER RAW MEMORIES ===
    sections.append("## HaksterAI Raw Memories")
    if HAKSTER_MEMORIES.exists():
        for mem_file in HAKSTER_MEMORIES.glob("*.json"):
            try:
                data = json.loads(mem_file.read_text())
                if isinstance(data, list):
                    for entry in data[:10]:
                        if isinstance(entry, dict):
                            what = entry.get("what", entry.get("error", str(entry)[:200]))
                            sections.append(f"- 📌 {what[:200]}")
                            stats["hakster_entries"] += 1
            except:
                pass
    sections.append("")

    # === HAKSTER SKILLS ===
    sections.append("## HaksterAI Skills")
    if HAKSTER_SKILLS.exists():
        for skill_file in HAKSTER_SKILLS.glob("*.md"):
            try:
                content = skill_file.read_text()[:300]
                sections.append(f"- 🔧 **{skill_file.stem}**: {content[:200]}")
                stats["hakster_entries"] += 1
            except:
                pass
    sections.append("")

    # === PHANTOM MEMORY ===
    sections.append("## Phantom Agent Memory")
    if PHANTOM_MEM_JSON.exists():
        try:
            data = json.loads(PHANTOM_MEM_JSON.read_text())
            if isinstance(data, dict):
                for key, val in list(data.items())[:30]:
                    if isinstance(val, str):
                        sections.append(f"- 👻 **{key}**: {val[:200]}")
                    elif isinstance(val, dict):
                        desc = val.get("what", val.get("error", str(val)[:200]))
                        sections.append(f"- 👻 **{key}**: {desc[:200]}")
                    stats["phantom_entries"] += 1
        except:
            pass
    sections.append("")

    # === PHANTOM KNOWLEDGE ===
    sections.append("## Phantom Agent Knowledge")
    if PHANTOM_KNOWLEDGE.exists():
        try:
            content = PHANTOM_KNOWLEDGE.read_text()
            sections.append(content[:2000])
            stats["phantom_entries"] += 1
        except:
            pass
    sections.append("")

    # === PHANTOM AGENT SKILLS ===
    sections.append("## Phantom Agent Skills")
    if PHANTOM_AGENT_KNOWLEDGE.exists():
        for md in PHANTOM_AGENT_KNOWLEDGE.glob("*.md"):
            try:
                content = md.read_text()[:300]
                sections.append(f"- 🔧 **{md.stem}**: {content[:200]}")
                stats["phantom_skills"] += 1
            except:
                pass
    sections.append("")

    # === SHARED BANK (all agents) ===
    sections.append("## Shared Agent Bank (All Agents)")
    shared_mem = sm.memory_list()
    for key, entry in list(shared_mem.items())[:80]:
        cat = entry.get("category", "?")
        agent = entry.get("agent", "?")
        value = entry.get("value", "")
        tags = entry.get("tags", [])
        try:
            val_data = json.loads(value) if isinstance(value, str) else value
            desc = val_data.get("what", val_data.get("error", val_data.get("name", str(val_data)[:200])))
        except:
            desc = str(value)[:200]
        emoji = "✅" if cat == "pattern" else "❌" if cat == "error" else "📌"
        tag_str = f" `#{' #'.join(tags)}`" if tags else ""
        sections.append(f"- {emoji} **[{agent}]** {desc[:200]}{tag_str}")
        stats["shared_entries"] += 1
    sections.append("")

    # === CLAUDE CODE PROXY MEMORIES ===
    sections.append("## Claude Code Proxy Memories")
    if CLAUDE_MEMORIES.exists():
        for mem_file in CLAUDE_MEMORIES.glob("*.json"):
            try:
                data = json.loads(mem_file.read_text())
                if isinstance(data, list):
                    for entry in data[:10]:
                        if isinstance(entry, dict):
                            what = entry.get("what", str(entry)[:200])
                            sections.append(f"- 📌 {what[:200]}")
                            stats["claude_entries"] += 1
            except:
                pass
    sections.append("")

    # === PATH-SCOPED BRAIN RULES (from all projects) ===
    sections.append("## Path-Scoped Brain Rules (All Projects)")
    for target in AGENT_TARGETS:
        rules_dir = target["project_dir"] / ".brain-rules"
        if rules_dir.exists():
            for rule_file in rules_dir.glob("*.md"):
                try:
                    content = rule_file.read_text()[:500]
                    sections.append(f"- 📋 **[{target['project_name']}] {rule_file.stem}**: {content[:300]}")
                    stats["brain_rules"] += 1
                except:
                    pass
    sections.append("")

    # === CURATED SNAPSHOTS ===
    sections.append("## Curated System Snapshots")
    snapshot_dir = Path("/home/ghost/.shared/snapshots")
    if snapshot_dir.exists():
        snaps = sorted(snapshot_dir.glob("snapshot_*.json"), reverse=True)[:3]
        for snap_path in snaps:
            try:
                data = json.loads(snap_path.read_text())
                pm2_count = len(data.get("pm2", []))
                ports = data.get("ports", [])
                ram = data.get("memory", {}).get("ram_used_pct", "?")
                disk = data.get("disk", {}).get("used_pct", "?")
                load = data.get("load", {}).get("1min", "?")
                sections.append(f"- 📸 **{data.get('id','?')}**: PM2={pm2_count} Ports={len(ports)} RAM={ram}% Disk={disk}% Load={load}")
                stats["snapshot_entries"] = stats.get("snapshot_entries", 0) + 1
            except:
                pass
    sections.append("")

    # === SESSION JOURNAL (conversation flow) ===
    sections.append("## Session Journal (Recent Task Flow)")
    try:
        store = sm.memory_list()
        journal_items = []
        for key, entry in store.items():
            if not key.startswith("journal_"):
                continue
            try:
                val = json.loads(entry.get("value", "{}"))
            except:
                continue
            journal_items.append((entry.get("timestamp", ""), val))
        journal_items.sort(key=lambda x: x[0], reverse=True)
        for ts, val in journal_items[:10]:
            phase = val.get("phase", "?")
            emoji = {"start": "🚀", "decision": "🔀", "complete": "✅", "note": "📌"}.get(phase, "•")
            task = val.get("task", val.get("decision", val.get("note", "?")))
            sections.append(f"- {emoji} **[{ts[:19]}]** {str(task)[:150]}")
            if val.get("outcome"):
                sections.append(f"  → {val['outcome'][:150]}")
            if val.get("next_steps"):
                sections.append(f"  → Next: {val['next_steps'][:150]}")
            stats["journal_entries"] = stats.get("journal_entries", 0) + 1
    except:
        pass
    sections.append("")

    # === FILE-TYPE-SCOPED RULES ===
    sections.append("## File-Type-Scoped Rules")
    for target in AGENT_TARGETS:
        proj_dir = target["project_dir"]
        proj_name = target.get("name", target.get("agent", str(proj_dir)))
        rules_dir = proj_dir / ".brain-rules"
        if not rules_dir.exists():
            continue
        for rule_file in sorted(rules_dir.glob("*.md")):
            ftype = rule_file.stem
            try:
                content = brain_import.resolve_imports(rule_file)
                sections.append(f"### {ftype} ({proj_name})")
                sections.append(content[:1000])
                sections.append("")
                stats["filetype_rules"] = stats.get("filetype_rules", 0) + 1
            except:
                pass
    sections.append("")

    stats["total"] = (
        stats["hakster_entries"]
        + stats["phantom_entries"]
        + stats["phantom_skills"]
        + stats["shared_entries"]
        + stats["claude_entries"]
        + stats["brain_rules"]
        + stats.get("snapshot_entries", 0)
        + stats.get("journal_entries", 0)
    )

    return "\n".join(sections), stats


def build_local_brain(project_dir, project_name):
    """Read .local-brain.md for a specific project. Returns content or empty string."""
    local_brain = project_dir / ".local-brain.md"
    if local_brain.exists():
        try:
            content = brain_import.resolve_imports(local_brain)
            if content.strip():
                return f"\n\n## Local Brain: {project_name}\n\n{content}\n"
        except:
            pass
    return ""


def write_brain():
    """Write unified brain to all agent locations, with per-project local brain appended."""
    content, stats = build_brain()

    for target in AGENT_TARGETS:
        try:
            # Append local brain content for this specific project
            local_content = build_local_brain(target["project_dir"], target["project_name"])
            full_content = content + local_content

            target["brain_file"].parent.mkdir(parents=True, exist_ok=True)
            target["brain_file"].write_text(full_content)

            if local_content:
                stats["local_brain"] += 1
        except:
            pass

    return stats


if __name__ == "__main__":
    stats = write_brain()
    print(f"🧠 Sonnet Brain built!")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    print(f"  Written to {len(AGENT_TARGETS)} agent brain files")