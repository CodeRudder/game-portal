import re, sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()
# Remove decorative separator comment lines
content = re.sub(r'^// ──.*──$\n?', '', content, flags=re.MULTILINE)
content = re.sub(r'^// ─────────────────────────────────────────────$\n?', '', content, flags=re.MULTILINE)
# Compress multi-line JSDoc to single-line where possible
def compress_jsdoc(match):
    lines = match.group(1).strip().split('\n')
    cleaned = [re.sub(r'^\s*\*\s?', '', l).strip() for l in lines]
    cleaned = [l for l in cleaned if l]
    if len(cleaned) == 1:
        return f'/** {cleaned[0]} */'
    return match.group(0)
content = re.sub(r'/\*\*\n((?:\s*\*.*\n)*?)\s*\*/', compress_jsdoc, content)
# Remove double blank lines
content = re.sub(r'\n\n\n+', '\n\n', content)
with open(path, 'w') as f:
    f.write(content)
