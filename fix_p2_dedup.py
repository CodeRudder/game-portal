import os
import re

base = 'src/games/three-kingdoms'
pairs = []
for root, dirs, files in os.walk(base):
    for f in files:
        if '-p2.test.' in f:
            p2 = os.path.join(root, f)
            p1 = p2.replace('-p2.test.', '-p1.test.')
            if os.path.exists(p1):
                pairs.append((p2, p1))

for p2_path, p1_path in sorted(pairs):
    with open(p1_path) as f:
        p1_content = f.read()
    with open(p2_path) as f:
        p2_content = f.read()

    p1_lines = p1_content.split('\n')
    p1_describe_start = 0
    for i, line in enumerate(p1_lines):
        if line.strip().startswith('describe('):
            p1_describe_start = i
            break
    p1_setup = p1_lines[:p1_describe_start]

    declared = set()
    for line in p1_setup:
        m = re.match(r'\s*const\s+(\w+)', line)
        if m:
            declared.add(m.group(1))
        m = re.match(r'\s*function\s+(\w+)', line)
        if m:
            declared.add(m.group(1))
        m = re.match(r'\s*let\s+(\w+)', line)
        if m:
            declared.add(m.group(1))

    p2_lines = p2_content.split('\n')
    in_import = True
    p2_body_start = 0
    for i, line in enumerate(p2_lines):
        stripped = line.strip()
        if in_import:
            if stripped.startswith('import ') or stripped.startswith('//') or stripped == '' or stripped.startswith('*'):
                continue
            else:
                in_import = False
                p2_body_start = i
                break

    if p2_body_start == 0:
        p2_body_start = 1

    p2_body = p2_lines[p2_body_start:]

    filtered_body = []
    for line in p2_body:
        stripped = line.strip()
        skip = False
        for ident in declared:
            if stripped == f'const {ident} =' or stripped == f'const {ident};':
                skip = True
                break
            if stripped.startswith(f'const {ident} ') or stripped.startswith(f'const {ident}='):
                skip = True
                break
            if stripped.startswith(f'function {ident}(') or stripped.startswith(f'function {ident} ('):
                skip = True
                break
            if stripped.startswith(f'let {ident} ') or stripped.startswith(f'let {ident}=') or stripped.startswith(f'let {ident};'):
                skip = True
                break
        if not skip:
            filtered_body.append(line)

    new_content = '\n'.join(p1_setup) + '\n' + '\n'.join(filtered_body)

    with open(p2_path, 'w') as f:
        f.write(new_content)

    removed = len(p2_body) - len(filtered_body)
    print(f"Fixed: {os.path.basename(p2_path)} (setup={p1_describe_start}, removed {removed} duplicate declarations)")
