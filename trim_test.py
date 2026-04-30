import re

filepath = 'src/games/three-kingdoms/engine/bond/__tests__/BondAdversarial.test.ts'
content = open(filepath).read()
lines = content.split('\n')
new_lines = []
for line in lines:
    stripped = line.strip()
    # Remove decorative separator comment lines
    if stripped.startswith('//'):
        after = stripped[2:].strip()
        if after and len(after) > 10:
            sep_count = sum(1 for c in after if c in '\u2500\u2550')
            if len(after) > 0 and sep_count / len(after) > 0.7:
                continue
    new_lines.append(line)

print(f'Original: {len(lines)} lines, After: {len(new_lines)} lines')
with open(filepath, 'w') as f:
    f.write('\n'.join(new_lines))
