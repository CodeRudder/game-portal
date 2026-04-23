#!/usr/bin/env python3
"""
Phase 2 fix: Handle the remaining issues after initial import fix.
1. Remove bare code (code before first describe that references p1 variables)
2. Wrap inner describes in a top-level describe if needed, or fix indentation
3. Handle p1 files with empty trailing describe blocks
"""

import os
import re

def find_first_describe(lines):
    """Find the line index of the first describe() call."""
    for i, line in enumerate(lines):
        if line.strip().startswith('describe('):
            return i
    return -1

def find_last_closing_brace(lines):
    """Find the last }); in the file."""
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == '});':
            return i
    return -1

def count_braces(text):
    """Count open and close braces to check balance."""
    opens = text.count('{')
    closes = text.count('}')
    return opens, closes

def fix_p2_file(p2_path):
    """Fix a p2 file that has structural issues."""
    p1_path = p2_path.replace('-p2.test.ts', '-p1.test.ts')
    
    with open(p2_path, 'r') as f:
        content = f.read()
    lines = content.split('\n')
    
    modified = False
    
    # 1. Find and remove bare code before first describe
    first_desc = find_first_describe(lines)
    if first_desc > 0:
        # Check if there's bare code (not comments, not imports, not helper defs)
        bare_start = -1
        for i in range(first_desc):
            s = lines[i].strip()
            if s and not s.startswith('//') and not s.startswith('/*') and not s.startswith('*') and not s.startswith('import ') and not s.startswith('function ') and not s.startswith('const ') and not s.startswith('type ') and not s.startswith('interface ') and not s.startswith('let ') and not s.startswith('export '):
                # This looks like bare code
                if not s.startswith('describe('):
                    bare_start = i
                    break
        
        if bare_start >= 0:
            # Find where bare code ends (at the first describe or at a blank line before describe)
            bare_end = bare_start
            for i in range(bare_start, first_desc):
                s = lines[i].strip()
                if s.startswith('describe('):
                    bare_end = i
                    break
                bare_end = i + 1
            
            print(f"  Removing bare code L{bare_start+1}-L{bare_end} in {os.path.basename(p2_path)}")
            lines = lines[:bare_start] + lines[bare_end:]
            first_desc = find_first_describe(lines)
            modified = True
    
    # 2. Check if describes are indented (inner describes without outer wrapper)
    if first_desc >= 0:
        indent = len(lines[first_desc]) - len(lines[first_desc].lstrip())
        if indent > 0:
            # All inner describes need to be wrapped or de-indented
            # Find the common indent of all describe blocks
            min_indent = float('inf')
            for i, line in enumerate(lines):
                if line.strip().startswith('describe('):
                    ind = len(line) - len(line.lstrip())
                    min_indent = min(min_indent, ind)
            
            if min_indent > 0:
                # De-indent all lines from first_desc onwards by min_indent spaces
                print(f"  De-indenting by {int(min_indent)} spaces in {os.path.basename(p2_path)}")
                for i in range(first_desc, len(lines)):
                    if len(lines[i]) >= min_indent and lines[i][:int(min_indent)].strip() == '':
                        lines[i] = lines[i][int(min_indent):]
                    elif lines[i].strip() == '':
                        pass  # keep empty lines
                modified = True
    
    # 3. Check brace balance
    opens, closes = count_braces('\n'.join(lines))
    if opens != closes:
        diff = opens - closes
        print(f"  Brace imbalance in {os.path.basename(p2_path)}: {opens} opens, {closes} closes (diff: {diff})")
        if diff > 0:
            # Need to add closing braces at the end
            lines.extend(['});'] * diff)
            print(f"    Added {diff} closing braces")
            modified = True
        elif diff < 0:
            # Need to remove extra closing braces from the end
            to_remove = -diff
            removed = 0
            for i in range(len(lines) - 1, -1, -1):
                if lines[i].strip() == '});' and removed < to_remove:
                    lines[i] = ''
                    removed += 1
            print(f"    Removed {removed} extra closing braces")
            modified = True
    
    if modified:
        with open(p2_path, 'w') as f:
            f.write('\n'.join(lines))
    
    return modified

def fix_p1_trailing(p1_path):
    """Fix p1 files that have empty trailing describe blocks."""
    if not os.path.exists(p1_path):
        return False
    
    with open(p1_path, 'r') as f:
        content = f.read()
    lines = content.split('\n')
    
    # Check if the file ends with multiple }); that might be empty shells
    # Find the last describe block
    last_desc = -1
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip().startswith('describe('):
            last_desc = i
            break
    
    if last_desc >= 0:
        # Check if this describe block is empty (only has }); after it)
        block_content = '\n'.join(lines[last_desc:]).strip()
        # Remove the closing }); 
        if block_content.endswith('});'):
            inner = block_content[block_content.index('{') + 1:-(3)].strip()
            if not inner or inner == '':
                # Empty describe block - remove it
                print(f"  Removing empty trailing describe in {os.path.basename(p1_path)}")
                lines = lines[:last_desc]
                with open(p1_path, 'w') as f:
                    f.write('\n'.join(lines))
                return True
    
    return False

def main():
    with open('p2files.txt') as f:
        p2_files = [l.strip() for l in f if l.strip()]
    
    fixed = 0
    for f in p2_files:
        if fix_p2_file(f):
            fixed += 1
        
        # Also fix p1 trailing
        p1 = f.replace('-p2.test.ts', '-p1.test.ts')
        fix_p1_trailing(p1)
    
    print(f"\nFixed {fixed} p2 files")

if __name__ == '__main__':
    main()
