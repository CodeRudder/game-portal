# -*- coding: utf-8 -*-
import re, os
from pathlib import Path

def rf(p):
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()

def wf(p, c):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)

NL = chr(10)

def split_file(src_rel, new_name, doc):
    fp = Path(src_rel)
    content = rf(fp)
    lines = content.split(NL)
    cl = None
    for i, ln in enumerate(lines):
        if 'export class ' in ln and cl is None:
            cl = i
            break
    if cl is None:
        print('  SKIP: no class in ' + src_rel)
        return False
    fe = None
    for i, ln in enumerate(lines):
        if i >= cl:
            break
        if ln.startswith('export ') and not ln.startswith('export {') and not ln.startswith('export default'):
            if fe is None:
                fe = i
    if fe is None or fe >= cl - 3:
        print('  SKIP: too few exports in ' + src_rel)
        return False
    imports = [ln for ln in lines[:fe] if ln.startswith('import ') or ln.strip().startswith('//')]
    extracted = NL.join(lines[fe:cl])
    new_path = fp.parent / new_name
    hdr = '/**' + NL + ' * ' + doc + NL + ' *' + NL + ' * Extracted from ' + fp.name + '.' + NL + ' */' + NL + NL
    new_content = hdr + NL.join(imports) + NL + NL + extracted + NL
    wf(new_path, new_content)
    all_exp = re.findall(r'export\s+(?:type|interface|enum|const|function)\s+(\w+)', extracted)
    if not all_exp:
        print('  SKIP: no named exports in ' + src_rel)
        os.remove(new_path)
        return False
    type_exp = re.findall(r'export\s+(?:type|interface)\s+(\w+)', extracted)
    val_exp = [e for e in all_exp if e not in type_exp]
    imp_parts = []
    mod_name = './' + new_name.replace('.ts', '')
    if type_exp:
        imp_parts.append('import type {' + NL + '  ' + (',' + NL + '  ').join(type_exp) + ',' + NL + '} from ' + repr(mod_name) + ';')
    if val_exp:
        imp_parts.append('import {' + NL + '  ' + (',' + NL + '  ').join(val_exp) + ',' + NL + '} from ' + repr(mod_name) + ';')
    needs_isys = 'ISubsystem' in content[content.find('export class'):]
    if needs_isys:
        imp_parts.insert(0, "import type { ISubsystem, ISystemDeps } from '../../core/types';")
    new_imports = NL.join(imp_parts)
    new_lines = lines[:9]
    new_lines.append(new_imports)
    new_lines.append('')
    new_lines.extend(lines[cl:])
    wf(fp, NL.join(new_lines))
    print('  OK ' + fp.name + ': ' + str(len(lines)) + ' -> ' + str(len(new_lines)) + ' lines')
    return True

splits = [
    ('src/games/three-kingdoms/engine/hero/HeroFormation.ts', 'formation-types.ts', 'Formation - types and constants'),
    ('src/games/three-kingdoms/engine/tech/TechEffectSystem.ts', 'tech-effect-types.ts', 'Tech effect - types'),
    ('src/games/three-kingdoms/engine/event/EventChainSystem.ts', 'event-chain-reexports.ts', 'Event chain - re-exports'),
    ('src/games/three-kingdoms/engine/settings/CloudSaveSystem.ts', 'cloud-save-reexports.ts', 'Cloud save - re-exports'),
    ('src/games/three-kingdoms/engine/bond/BondSystem.ts', 'bond-config.ts', 'Bond - inline config'),
]

ok = 0
for i, (fp, nf, doc) in enumerate(splits):
    print('')
    print('[' + str(i+1) + '] ' + fp + '...')
    try:
        if split_file(fp, nf, doc):
            ok += 1
    except Exception as e:
        print('  ERROR: ' + str(e))
        import traceback
        traceback.print_exc()

print('')
print('=== Split complete: ' + str(ok) + '/' + str(len(splits)) + ' files split ===')
