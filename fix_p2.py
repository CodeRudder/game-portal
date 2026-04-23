#!/usr/bin/env python3
"""
Fix truncated p2 test files by extracting headers from p1 files.

The problem: p2 files were created by splitting original test files,
but the header (JSDoc, imports, helper functions, variable declarations)
was lost. The p2 files start with truncated content.

Strategy:
1. From p1, extract everything before the first describe() call
   (this includes JSDoc, imports, helper functions, const/let declarations)
2. Remove duplicate imports from p2
3. Prepend p1 header to p2 content
"""
import os
import re
import glob


def extract_p1_header(p1_lines):
    """Extract everything from p1 before the first top-level describe()."""
    for i, line in enumerate(p1_lines):
        stripped = line.strip()
        # Match top-level describe (no leading whitespace or minimal)
        if re.match(r"^describe\s*\(", stripped):
            return p1_lines[:i], i
    return p1_lines, len(p1_lines)


def find_content_start(p2_lines):
    """Find where the actual test content starts in p2 (after broken imports)."""
    i = 0
    last_import_end = 0
    
    while i < len(p2_lines):
        stripped = p2_lines[i].strip()
        
        if stripped.startswith("import "):
            # Check if this is a complete import (ends with ; or has closing })
            if ";" in stripped:
                last_import_end = i + 1
                i += 1
            elif stripped.endswith("{"):
                # Truncated import like "import {"
                # Skip it and any following lines that look like import continuations
                i += 1
                while i < len(p2_lines):
                    next_stripped = p2_lines[i].strip()
                    if next_stripped.startswith("import ") or next_stripped == "":
                        # Another import or blank line - could be another truncated import
                        if next_stripped == "" and last_import_end > 0:
                            break
                        i += 1
                    else:
                        break
                last_import_end = i
            else:
                i += 1
                last_import_end = i
        elif stripped == "" and i > 0:
            # Blank line - check if we're past imports
            if last_import_end > 0:
                # Check if next line is test content
                if i + 1 < len(p2_lines):
                    next_stripped = p2_lines[i + 1].strip()
                    if not next_stripped.startswith("import"):
                        return i + 1
            i += 1
        else:
            # Non-import, non-empty line - this is content
            return i
    
    return i


def fix_p2_file(p1_path, p2_path):
    """Fix a p2 test file using its p1 counterpart."""
    with open(p1_path, 'r') as f:
        p1_lines = f.readlines()
    
    with open(p2_path, 'r') as f:
        p2_lines = f.readlines()
    
    # Extract header from p1 (everything before first describe)
    header, describe_idx = extract_p1_header(p1_lines)
    
    # Find where p2's actual test content starts
    content_start = find_content_start(p2_lines)
    
    # Get p2 test content (everything after broken imports)
    p2_content = p2_lines[content_start:]
    
    # Build new file: p1 header + p2 content
    new_content = []
    
    # Add p1 header
    for line in header:
        new_content.append(line)
    
    # Ensure there's a blank line between header and content
    if new_content and new_content[-1].strip() != "":
        new_content.append("\n")
    
    # Add p2 content
    for line in p2_content:
        new_content.append(line)
    
    with open(p2_path, 'w') as f:
        f.writelines(new_content)
    
    return True, len(header), content_start


def main():
    p2_files = sorted(glob.glob("src/games/three-kingdoms/**/*-p2.test.ts", recursive=True))
    print(f"Found {len(p2_files)} p2 files\n")
    
    fixed = 0
    errors = []
    
    for p2_path in p2_files:
        base = os.path.basename(p2_path).replace("-p2.test.ts", "")
        dirn = os.path.dirname(p2_path)
        p1_path = os.path.join(dirn, f"{base}-p1.test.ts")
        
        if not os.path.exists(p1_path):
            print(f"  SKIP (no p1): {p2_path}")
            continue
        
        try:
            success, header_lines, skipped_lines = fix_p2_file(p1_path, p2_path)
            if success:
                fixed += 1
                print(f"  FIXED: {p2_path} (header={header_lines} lines, skipped={skipped_lines} broken lines)")
        except Exception as e:
            errors.append((p2_path, str(e)))
            print(f"  ERROR: {p2_path} - {e}")
    
    print(f"\nFixed: {fixed}/{len(p2_files)}")
    if errors:
        print(f"\nErrors:")
        for path, err in errors:
            print(f"  {path}: {err}")


if __name__ == "__main__":
    main()
