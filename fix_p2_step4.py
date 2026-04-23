#!/usr/bin/env python3
"""Add system variable to each describe block that needs it in ActivitySystem-p2."""
import re

BASE = 'src/games/three-kingdoms'

# Fix ActivitySystem-p2: Add system to each describe block that uses `system.`
filepath = f'{BASE}/engine/activity/__tests__/ActivitySystem-p2.test.ts'
with open(filepath, 'r') as f:
    content = f.read()

# Find all top-level describe blocks
# Pattern: describe('name', () => {
# We need to check if the block uses `system.` and doesn't have `let system`
lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    # Check for top-level describe (not indented)
    if stripped.startswith('describe(') and not line.startswith(' ') and not line.startswith('\t'):
        # Find the block's content (until matching });
        block_start = i
        brace_count = 0
        block_end = i
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                block_end = j
                break
        
        # Check if this block uses `system.` 
        block_content = '\n'.join(lines[block_start:block_end+1])
        uses_system = 'system.' in block_content or 'system,' in block_content
        has_system_decl = 'let system:' in block_content
        
        if uses_system and not has_system_decl:
            # Add `let system: ActivitySystem;` and `beforeEach` after the describe line
            # Find the opening brace line
            insert_line = i + 1  # Line after describe('...', () => {
            
            # Check if there's already content on the next line
            # Insert system declaration
            lines.insert(insert_line, '')
            lines.insert(insert_line + 1, '  let system: ActivitySystem;')
            lines.insert(insert_line + 2, '')
            lines.insert(insert_line + 3, '  beforeEach(() => {')
            lines.insert(insert_line + 4, '    system = new ActivitySystem();')
            lines.insert(insert_line + 5, '  });')
            
            # Skip past the inserted lines
            i += 6
            print(f"  Added system to describe at original line {block_start+1}")
    
    i += 1

content = '\n'.join(lines)
with open(filepath, 'w') as f:
    f.write(content)
print(f"  Fixed: ActivitySystem-p2.test.ts")


# Fix SignInSystem-p2: Add system to each describe block that uses `system.`
filepath = f'{BASE}/engine/activity/__tests__/SignInSystem-p2.test.ts'
with open(filepath, 'r') as f:
    content = f.read()

lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    if stripped.startswith('describe(') and not line.startswith(' ') and not line.startswith('\t'):
        block_start = i
        brace_count = 0
        block_end = i
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                block_end = j
                break
        
        block_content = '\n'.join(lines[block_start:block_end+1])
        uses_system = 'system.' in block_content or 'system,' in block_content
        has_system_decl = 'let system:' in block_content
        
        if uses_system and not has_system_decl:
            insert_line = i + 1
            lines.insert(insert_line, '')
            lines.insert(insert_line + 1, '  let system: SignInSystem;')
            lines.insert(insert_line + 2, '')
            lines.insert(insert_line + 3, '  beforeEach(() => {')
            lines.insert(insert_line + 4, '    system = new SignInSystem();')
            lines.insert(insert_line + 5, '  });')
            i += 6
            print(f"  Added system to describe at original line {block_start+1}")
    
    i += 1

content = '\n'.join(lines)
with open(filepath, 'w') as f:
    f.write(content)
print(f"  Fixed: SignInSystem-p2.test.ts")


# Fix EquipmentSystem-p2: Add sys to each describe block that uses `sys.`
filepath = f'{BASE}/engine/equipment/__tests__/EquipmentSystem-p2.test.ts'
with open(filepath, 'r') as f:
    content = f.read()

lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    if stripped.startswith('describe(') and not line.startswith(' ') and not line.startswith('\t'):
        block_start = i
        brace_count = 0
        block_end = i
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                block_end = j
                break
        
        block_content = '\n'.join(lines[block_start:block_end+1])
        uses_sys = ('sys.' in block_content or 'sys)' in block_content) and 'sys:' not in block_content.split('describe')[0]
        has_sys_decl = 'let sys:' in block_content
        
        if uses_sys and not has_sys_decl:
            insert_line = i + 1
            lines.insert(insert_line, '')
            lines.insert(insert_line + 1, '  let sys: EquipmentSystem;')
            lines.insert(insert_line + 2, '')
            lines.insert(insert_line + 3, '  beforeEach(() => {')
            lines.insert(insert_line + 4, '    resetUidCounter();')
            lines.insert(insert_line + 5, '    sys = createSystem();')
            lines.insert(insert_line + 6, '  });')
            i += 7
            print(f"  Added sys to describe at original line {block_start+1}")
    
    i += 1

content = '\n'.join(lines)
with open(filepath, 'w') as f:
    f.write(content)
print(f"  Fixed: EquipmentSystem-p2.test.ts")


# Fix TouchInputSystem-p2: Add system to each describe block that uses `system.`
filepath = f'{BASE}/engine/responsive/__tests__/TouchInputSystem-p2.test.ts'
with open(filepath, 'r') as f:
    content = f.read()

lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    if stripped.startswith('describe(') and not line.startswith(' ') and not line.startswith('\t'):
        block_start = i
        brace_count = 0
        block_end = i
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                block_end = j
                break
        
        block_content = '\n'.join(lines[block_start:block_end+1])
        uses_system = 'system.' in block_content or 'system,' in block_content
        has_system_decl = 'let system:' in block_content
        
        if uses_system and not has_system_decl:
            insert_line = i + 1
            lines.insert(insert_line, '')
            lines.insert(insert_line + 1, '  let system: TouchInputSystem;')
            lines.insert(insert_line + 2, '')
            lines.insert(insert_line + 3, '  beforeEach(() => {')
            lines.insert(insert_line + 4, '    system = new TouchInputSystem();')
            lines.insert(insert_line + 5, '  });')
            i += 6
            print(f"  Added system to describe at original line {block_start+1}")
    
    i += 1

content = '\n'.join(lines)
with open(filepath, 'w') as f:
    f.write(content)
print(f"  Fixed: TouchInputSystem-p2.test.ts")


# Fix PrdChecker-p2: Add checker to each describe block that uses `checker.`
filepath = f'{BASE}/tests/ui-review/__tests__/PrdChecker-p2.test.ts'
with open(filepath, 'r') as f:
    content = f.read()

lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    if stripped.startswith('describe(') and not line.startswith(' ') and not line.startswith('\t'):
        block_start = i
        brace_count = 0
        block_end = i
        for j in range(i, len(lines)):
            brace_count += lines[j].count('{') - lines[j].count('}')
            if brace_count == 0 and j > i:
                block_end = j
                break
        
        block_content = '\n'.join(lines[block_start:block_end+1])
        uses_checker = 'checker.' in block_content
        has_checker_decl = 'let checker:' in block_content
        
        if uses_checker and not has_checker_decl:
            insert_line = i + 1
            lines.insert(insert_line, '')
            lines.insert(insert_line + 1, '  let checker: PrdChecker;')
            lines.insert(insert_line + 2, '')
            lines.insert(insert_line + 3, '  beforeEach(() => {')
            lines.insert(insert_line + 4, '    checker = new PrdChecker();')
            lines.insert(insert_line + 5, '  });')
            i += 6
            print(f"  Added checker to describe at original line {block_start+1}")
    
    i += 1

content = '\n'.join(lines)
with open(filepath, 'w') as f:
    f.write(content)
print(f"  Fixed: PrdChecker-p2.test.ts")


print("\nAll variable fixes applied!")
