#!/usr/bin/env python3
"""
brain_import.py — Import Resolution for Brain Files (L8)

Resolves @path/to/file import syntax in .local-brain.md and .brain-rules/rules.md
files. When a brain file contains @path/to/file, the content of that file is
inlined at that position during brain building.

Usage:
  python3 brain_import.py /home/ghost/haksterAi/.local-brain.md          # resolve and print
  python3 brain_import.py /home/ghost/haksterAi/.local-brain.md --json   # JSON output
  python3 brain_import.py /home/ghost/haksterAi/.brain-rules/rules.md    # resolve rules
"""
import re, os, sys, json, argparse
from pathlib import Path

IMPORT_PATTERN = re.compile(r'^@([^\s]+)\s*$', re.MULTILINE)
MAX_DEPTH = 5  # prevent circular imports
MAX_FILE_SIZE = 50000  # 50KB max per imported file


def resolve_imports(file_path, depth=0, seen=None):
    """Resolve @import syntax in a file, returning the expanded content."""
    if depth > MAX_DEPTH:
        return f"<!-- max import depth reached -->"
    
    if seen is None:
        seen = set()
    
    file_path = Path(file_path).resolve()
    if file_path in seen:
        return f"<!-- circular import: {file_path} -->"
    seen.add(file_path)
    
    if not file_path.exists():
        return f"<!-- file not found: {file_path} -->"
    
    content = file_path.read_text()
    
    def replace_import(match):
        import_path = match.group(1)
        
        # Resolve relative to the file's directory, or absolute
        if import_path.startswith('/'):
            resolved = Path(import_path)
        else:
            resolved = file_path.parent / import_path
        
        resolved = resolved.resolve()
        
        if not resolved.exists():
            return f"<!-- import not found: @{import_path} -->"
        
        if resolved.stat().st_size > MAX_FILE_SIZE:
            return f"<!-- import too large: @{import_path} ({resolved.stat().st_size} bytes) -->"
        
        # Recursively resolve imports in the imported file
        imported_content = resolve_imports(resolved, depth + 1, seen)
        
        # Wrap with a comment showing the source
        return f"<!-- @import {import_path} -->\n{imported_content}\n<!-- @end {import_path} -->"
    
    return IMPORT_PATTERN.sub(replace_import, content)


def find_imports(file_path):
    """Find all @import references in a file without resolving them."""
    file_path = Path(file_path)
    if not file_path.exists():
        return []
    
    content = file_path.read_text()
    imports = []
    for match in IMPORT_PATTERN.finditer(content):
        imports.append({
            "import": match.group(1),
            "line": content[:match.start()].count('\n') + 1,
        })
    return imports


def main():
    parser = argparse.ArgumentParser(description="Brain Import Resolver (L8)")
    parser.add_argument("file", help="Path to brain file to resolve imports in")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument("--list", action="store_true", help="List imports without resolving")
    args = parser.parse_args()
    
    if args.list:
        imports = find_imports(args.file)
        if args.json:
            print(json.dumps(imports, indent=2))
        else:
            if not imports:
                print("No imports found.")
            else:
                print(f"Imports in {args.file}:")
                for imp in imports:
                    print(f"  Line {imp['line']}: @{imp['import']}")
        return
    
    resolved = resolve_imports(args.file)
    
    if args.json:
        print(json.dumps({
            "file": args.file,
            "resolved": resolved,
            "import_count": resolved.count("<!-- @import"),
        }, indent=2))
    else:
        print(resolved)


if __name__ == "__main__":
    main()