#!/usr/bin/env python3
"""
Auto-fix p2 test files by extracting imports and helpers from p1 files.
Strategy:
1. Read p1 file, extract import block and helper definitions
2. Read p2 file, find where broken imports end and real test code begins
3. Replace broken header with proper imports + helpers from p1
"""

import os
import re
import sys

def extract_import_block(lines):
    """Extract the complete import block from a list of lines.
    Returns (import_lines, end_index) where end_index is the line AFTER the last import."""
    import_start = -1
    import_end = 0
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith('import '):
            if import_start == -1:
                import_start = i
            # Find the end of this import statement
            j = i
            while j < len(lines):
                if lines[j].rstrip().endswith(';'):
                    import_end = j + 1
                    break
                j += 1
            i = j + 1
        else:
            if import_start >= 0 and s and not s.startswith('//') and not s.startswith('*') and not s.startswith('/*'):
                # We've left the import region
                break
            i += 1
    
    if import_start == -1:
        return [], 0
    return lines[import_start:import_end], import_end


def extract_helpers(lines, start):
    """Extract helper definitions (functions, consts, types) between imports and first describe."""
    helpers = []
    i = start
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith('describe('):
            break
        helpers.append(lines[i])
        i += 1
    return helpers


def find_broken_import_end(lines):
    """Find where broken import lines end in p2 file."""
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith('import ') and not s.endswith(';'):
            # This is a broken import - skip it
            i += 1
        elif s == '' and i > 0 and any(lines[j].strip().startswith('import ') and not lines[j].strip().endswith(';') for j in range(max(0, i-5), i)):
            # Empty line after broken import
            i += 1
        else:
            break
    return i


def find_first_describe_or_real_code(lines, start):
    """Find the first describe block or the first line that looks like real test code."""
    for i in range(start, len(lines)):
        s = lines[i].strip()
        if s.startswith('describe(') or s.startswith("describe('") or s.startswith('describe("'):
            return i
        # Check for bare test code (it, test, expect, etc.) that's not inside a describe
        if s.startswith('it(') or s.startswith('test(') or s.startswith('expect(') or s.startswith('beforeEach('):
            return i
        if s.startswith('const ') or s.startswith('let ') or s.startswith('function '):
            return i
    return len(lines)


def fix_p2_file(p2_path):
    """Fix a single p2 file."""
    p1_path = p2_path.replace('-p2.test.ts', '-p1.test.ts')
    
    if not os.path.exists(p1_path):
        print(f"  SKIP: No p1 file found: {p1_path}")
        return False
    
    with open(p2_path, 'r') as f:
        p2_lines = f.readlines()
    
    with open(p1_path, 'r') as f:
        p1_lines = f.readlines()
    
    # Check if p2 has broken imports
    has_broken = any(
        l.strip().startswith('import ') and not l.strip().endswith(';')
        for l in p2_lines
    )
    
    if not has_broken:
        print(f"  SKIP: No broken imports in {os.path.basename(p2_path)}")
        return False
    
    print(f"  FIXING: {os.path.basename(p2_path)}")
    
    # Extract from p1
    p1_imports, p1_import_end = extract_import_block(p1_lines)
    p1_helpers = extract_helpers(p1_lines, p1_import_end)
    
    # Find where broken imports end in p2
    broken_end = find_broken_import_end(p2_lines)
    
    # Check if p2 has its own valid imports after the broken ones
    # (some p2 files have a mix of broken and valid imports)
    p2_valid_imports = []
    i = broken_end
    while i < len(p2_lines):
        s = p2_lines[i].strip()
        if s.startswith('import ') and s.endswith(';'):
            # Complete single-line import
            p2_valid_imports.append(p2_lines[i])
            i += 1
        elif s.startswith('import ') and not s.endswith(';'):
            # Multi-line import - find the end
            j = i
            while j < len(p2_lines) and not p2_lines[j].rstrip().endswith(';'):
                j += 1
            if j < len(p2_lines):
                p2_valid_imports.extend(p2_lines[i:j+1])
                i = j + 1
            else:
                break
        elif s == '':
            i += 1
        else:
            break
    
    # Now find where the real test code starts (after all imports)
    # This might be bare code from a truncated describe block
    real_code_start = i
    
    # Check if there's bare code before the first describe that needs to be removed
    # (code that references variables from p1's describe blocks)
    first_describe = -1
    for j in range(real_code_start, len(p2_lines)):
        s = p2_lines[j].strip()
        if s.startswith('describe('):
            first_describe = j
            break
    
    # Determine the body of p2 (the part we keep)
    if first_describe >= 0:
        # There's a describe block - keep from there
        p2_body = p2_lines[first_describe:]
    else:
        # No describe block - this p2 has bare code that references p1 variables
        # We need to wrap it or figure out what's happening
        # For now, keep from real_code_start
        p2_body = p2_lines[real_code_start:]
    
    # Build the fixed p2 file
    fixed_lines = []
    
    # Add p1 imports (these are the complete, working imports)
    fixed_lines.extend(p1_imports)
    fixed_lines.append('\n')
    
    # Add p1 helpers
    helpers_text = ''.join(p1_helpers).strip()
    if helpers_text:
        fixed_lines.append(helpers_text + '\n\n')
    
    # Add p2 body
    fixed_lines.extend(p2_body)
    
    # Write back
    with open(p2_path, 'w') as f:
        f.writelines(fixed_lines)
    
    print(f"    Extracted {len(p1_imports)} import lines from p1")
    print(f"    Extracted {len(p1_helpers)} helper lines from p1")
    print(f"    Removed {broken_end} broken lines from p2 header")
    print(f"    Kept {len(p2_body)} lines of test code")
    
    return True


def main():
    with open('p2files.txt') as f:
        p2_files = [l.strip() for l in f if l.strip()]
    
    fixed_count = 0
    for f in p2_files:
        if fix_p2_file(f):
            fixed_count += 1
    
    print(f"\nFixed {fixed_count} files")


if __name__ == '__main__':
    main()
