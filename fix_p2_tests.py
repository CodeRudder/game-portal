import os

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
        p1_lines = f.readlines()
    with open(p2_path) as f:
        p2_lines = f.readlines()
    
    p1_describe_start = 0
    for i, line in enumerate(p1_lines):
        if line.strip().startswith('describe('):
            p1_describe_start = i
            break
    
    p1_setup = p1_lines[:p1_describe_start]
    
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
    new_content = ''.join(p1_setup) + ''.join(p2_body)
    
    with open(p2_path, 'w') as f:
        f.write(new_content)
    
    print(f"Fixed: {os.path.basename(p2_path)} (setup={p1_describe_start} lines from p1, body from line {p2_body_start+1})")
