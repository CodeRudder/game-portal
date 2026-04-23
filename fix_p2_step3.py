#!/usr/bin/env python3
"""Add missing variable declarations to p2 test files."""
import os

BASE = 'src/games/three-kingdoms'

def add_var_to_describe(filepath, describe_name, var_line, beforeEach_line):
    """Add variable declaration and beforeEach to the first describe block."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Find the describe block
    target = f"describe('{describe_name}', () => {{"
    idx = content.find(target)
    if idx == -1:
        print(f"  WARNING: Could not find '{describe_name}' in {os.path.basename(filepath)}")
        return
    
    # Find the end of the describe line + opening brace
    after_describe = idx + len(target)
    
    # Check if variable already exists right after
    next_50 = content[after_describe:after_describe+100]
    if var_line.strip() in next_50:
        print(f"  SKIP: {os.path.basename(filepath)} already has {var_line.strip()}")
        return
    
    # Insert after the opening brace
    insert_pos = after_describe
    insertion = f"\n  {var_line}\n\n  beforeEach(() => {{\n    {beforeEach_line}\n  }});\n"
    
    content = content[:insert_pos] + insertion + content[insert_pos:]
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"  Fixed: {os.path.basename(filepath)} - added {var_line.strip()}")


# 1. ActivitySystem-p2: needs `system`
add_var_to_describe(
    f'{BASE}/engine/activity/__tests__/ActivitySystem-p2.test.ts',
    '里程碑奖励',
    'let system: ActivitySystem;',
    'system = new ActivitySystem();'
)

# 2. SignInSystem-p2: needs `system`
add_var_to_describe(
    f'{BASE}/engine/activity/__tests__/SignInSystem-p2.test.ts',
    '奖励查询',
    'let system: SignInSystem;',
    'system = new SignInSystem();'
)

# 6. EquipmentSystem-p2: needs `sys` with resetUidCounter
add_var_to_describe(
    f'{BASE}/engine/equipment/__tests__/EquipmentSystem-p2.test.ts',
    '查询',
    'let sys: EquipmentSystem;',
    'resetUidCounter(); sys = createSystem();'
)

# 9. TouchInputSystem-p2: needs `system`
add_var_to_describe(
    f'{BASE}/engine/responsive/__tests__/TouchInputSystem-p2.test.ts',
    '触控反馈配置',
    'let system: TouchInputSystem;',
    'system = new TouchInputSystem();'
)

# 10. PrdChecker-p2: needs `checker`
add_var_to_describe(
    f'{BASE}/tests/ui-review/__tests__/PrdChecker-p2.test.ts',
    '覆盖率计算',
    'let checker: PrdChecker;',
    'checker = new PrdChecker();'
)

print("\nAll variable fixes applied!")
