import sys
with open(sys.argv[1]) as f:
    lines = f.readlines()
code = [l for l in lines if l.strip() and not l.strip().startswith('//')]
print(f'Code: {len(code)}, Total: {len(lines)}')
