#!/usr/bin/env python3
"""Fix missing 'describe' and extra '});' in all 10 p2 files."""
import os

BASE = 'src/games/three-kingdoms'

files = [
    f'{BASE}/engine/activity/__tests__/ActivitySystem-p2.test.ts',
    f'{BASE}/engine/activity/__tests__/SignInSystem-p2.test.ts',
    f'{BASE}/engine/alliance/__tests__/AllianceSystem-p2.test.ts',
    f'{BASE}/engine/battle/__tests__/BattleEffectManager-p2.test.ts',
    f'{BASE}/engine/battle/__tests__/BattleEngine-p2.test.ts',
    f'{BASE}/engine/equipment/__tests__/EquipmentSystem-p2.test.ts',
    f'{BASE}/engine/heritage/__tests__/HeritageSystem-p2.test.ts',
    f'{BASE}/engine/pvp/__tests__/ArenaSystem-p2.test.ts',
    f'{BASE}/engine/responsive/__tests__/TouchInputSystem-p2.test.ts',
    f'{BASE}/tests/ui-review/__tests__/PrdChecker-p2.test.ts',
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix 1: Add 'describe' before the first orphaned '(' that starts a test block
    # Pattern: line starts with '(' followed by a string (the describe name)
    lines = content.split('\n')
    fixed_describe = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("('") or stripped.startswith('("') or stripped.startswith("('") or stripped.startswith('(`'):
            # This is the orphaned describe call - add 'describe' before '('
            indent = line[:len(line) - len(line.lstrip())]
            lines[i] = indent + 'describe' + stripped
            fixed_describe = True
            print(f"  {os.path.basename(filepath)}: Added 'describe' at line {i+1}")
            break
    
    if not fixed_describe:
        print(f"  WARNING: {os.path.basename(filepath)}: No orphaned describe found!")
        continue
    
    content = '\n'.join(lines)
    
    # Fix 2: Remove the last '});' which is the extra closing brace
    # Find the last line that is just '});'
    lines = content.split('\n')
    # Find last '});'
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == '});':
            lines[i] = ''  # Remove the extra closing
            print(f"  {os.path.basename(filepath)}: Removed extra '}});' at line {i+1}")
            break
    
    # Remove trailing empty lines
    while lines and lines[-1] == '':
        lines.pop()
    lines.append('')  # Add single trailing newline
    
    content = '\n'.join(lines)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("\nAll fixes applied!")
