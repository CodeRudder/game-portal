# -*- coding: utf-8 -*-
import re
from pathlib import Path

def rf(p):
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()

def wf(p, c):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)

NL = chr(10)

# BondSystem: extract BOND_EFFECTS + STORY_EVENTS constants
def split_bond():
    fp = Path('src/games/three-kingdoms/engine/bond/BondSystem.ts')
    content = rf(fp)
    lines = content.split(NL)
    
    # Find const BOND_EFFECTS and const STORY_EVENTS
    be_start = None
    se_start = None
    class_line = None
    
    for i, ln in enumerate(lines):
        if ln.startswith('const BOND_EFFECTS'):
            be_start = i
        if ln.startswith('const STORY_EVENTS'):
            se_start = i
        if 'export class BondSystem' in ln:
            class_line = i
            break
    
    if not be_start or not se_start or not class_line:
        print('  SKIP: could not find markers')
        return False
    
    # Find end of each block
    be_end = se_start  # STORY_EVENTS starts right after BOND_EFFECTS
    # Find end of STORY_EVENTS
    se_end = None
    brace_count = 0
    for j in range(se_start, class_line):
        brace_count += lines[j].count('[') - lines[j].count(']')
        if '[' in lines[j]:
            pass
        if brace_count <= 0 and j > se_start:
            se_end = j + 1
            break
    
    if not se_end:
        print('  SKIP: could not find STORY_EVENTS end')
        return False
    
    # Extract the constants
    extracted = NL.join(lines[be_start:se_end])
    
    # Get imports
    imports = [ln for ln in lines[:be_start] if ln.startswith('import ') or ln.strip().startswith('//')]
    
    # Create new file
    new_content = '/**' + NL + ' * Bond system - config constants' + NL + ' *' + NL + ' * Extracted from BondSystem.ts.' + NL + ' */' + NL + NL
    new_content += NL.join(imports) + NL + NL + extracted + NL
    wf(fp.parent / 'bond-config.ts', new_content)
    
    # Update original
    new_lines = lines[:9]
    new_lines.append("import { BOND_EFFECTS, STORY_EVENTS } from './bond-config';")
    new_lines.append('')
    new_lines.extend(lines[:be_start][9:])  # remaining imports between header and BOND_EFFECTS
    new_lines.extend(lines[se_end:])
    wf(fp, NL.join(new_lines))
    
    print('  OK BondSystem.ts: ' + str(len(lines)) + ' -> ' + str(len(new_lines)) + ' lines')
    return True

# TutorialStateMachine: extract VALID_TRANSITIONS + TRANSITION_TARGETS
def split_tutorial():
    fp = Path('src/games/three-kingdoms/engine/guide/TutorialStateMachine.ts')
    content = rf(fp)
    lines = content.split(NL)
    
    vt_start = None
    class_line = None
    
    for i, ln in enumerate(lines):
        if ln.startswith('const VALID_TRANSITIONS'):
            vt_start = i
        if 'export class TutorialStateMachine' in ln:
            class_line = i
            break
    
    if not vt_start or not class_line:
        print('  SKIP: could not find markers')
        return False
    
    # Find end of TRANSITION_TARGETS block
    block_end = None
    brace_count = 0
    found_second = False
    for j in range(vt_start, class_line):
        brace_count += lines[j].count('{') - lines[j].count('}')
        if '{' in lines[j]:
            pass
        if brace_count <= 0 and j > vt_start + 2:
            if not found_second:
                found_second = True
            else:
                block_end = j + 1
                break
    
    if not block_end:
        # Try simpler: find end of second const block
        for j in range(vt_start + 1, class_line):
            if lines[j].startswith('const ') and j > vt_start + 3:
                # This is the second const, find its end
                bc = 0
                for k in range(j, class_line):
                    bc += lines[k].count('{') - lines[k].count('}')
                    if bc <= 0 and k > j:
                        block_end = k + 1
                        break
                break
    
    if not block_end:
        print('  SKIP: could not find block end')
        return False
    
    extracted = NL.join(lines[vt_start:block_end])
    
    # Get imports
    imports = [ln for ln in lines[:vt_start] if ln.startswith('import ') or ln.strip().startswith('//')]
    
    new_content = '/**' + NL + ' * Tutorial state machine - config constants' + NL + ' *' + NL + ' * Extracted from TutorialStateMachine.ts.' + NL + ' */' + NL + NL
    new_content += NL.join(imports) + NL + NL + extracted + NL
    wf(fp.parent / 'tutorial-state-config.ts', new_content)
    
    new_lines = lines[:9]
    new_lines.append("import { VALID_TRANSITIONS, TRANSITION_TARGETS } from './tutorial-state-config';")
    new_lines.append('')
    new_lines.extend(lines[:vt_start][9:])
    new_lines.extend(lines[block_end:])
    wf(fp, NL.join(new_lines))
    
    print('  OK TutorialStateMachine.ts: ' + str(len(lines)) + ' -> ' + str(len(new_lines)) + ' lines')
    return True

# CalendarSystem: extract CN_DIGITS
def split_calendar():
    fp = Path('src/games/three-kingdoms/engine/calendar/CalendarSystem.ts')
    content = rf(fp)
    lines = content.split(NL)
    
    cn_start = None
    class_line = None
    
    for i, ln in enumerate(lines):
        if ln.startswith('const CN_DIGITS'):
            cn_start = i
        if 'export class CalendarSystem' in ln:
            class_line = i
            break
    
    if not cn_start or not class_line:
        print('  SKIP: could not find markers')
        return False
    
    # Find end of CN_DIGITS
    cn_end = None
    for j in range(cn_start, class_line):
        if lines[j].rstrip().endswith('] as const;'):
            cn_end = j + 1
            break
    
    if not cn_end:
        print('  SKIP: could not find CN_DIGITS end')
        return False
    
    extracted = NL.join(lines[cn_start:cn_end])
    imports = [ln for ln in lines[:cn_start] if ln.startswith('import ') or ln.strip().startswith('//')]
    
    new_content = '/**' + NL + ' * Calendar - config constants' + NL + ' *' + NL + ' * Extracted from CalendarSystem.ts.' + NL + ' */' + NL + NL
    new_content += NL.join(imports) + NL + NL + extracted + NL
    wf(fp.parent / 'calendar-config.ts', new_content)
    
    new_lines = lines[:9]
    new_lines.append("import { CN_DIGITS } from './calendar-config';")
    new_lines.append('')
    new_lines.extend(lines[:cn_start][9:])
    new_lines.extend(lines[cn_end:])
    wf(fp, NL.join(new_lines))
    
    print('  OK CalendarSystem.ts: ' + str(len(lines)) + ' -> ' + str(len(new_lines)) + ' lines')
    return True

# EquipmentSystem: extract re-exports
def split_equipment():
    fp = Path('src/games/three-kingdoms/engine/equipment/EquipmentSystem.ts')
    content = rf(fp)
    lines = content.split(NL)
    
    class_line = None
    first_reexport = None
    
    for i, ln in enumerate(lines):
        if ln.startswith('export {') and first_reexport is None:
            first_reexport = i
        if 'export class EquipmentSystem' in ln:
            class_line = i
            break
    
    if not first_reexport or not class_line or first_reexport >= class_line - 3:
        print('  SKIP: no extractable re-exports')
        return False
    
    # Find end of re-export block
    reexport_end = class_line
    for j in range(first_reexport, class_line):
        if not lines[j].startswith('export {') and not lines[j].startswith('export type {') and lines[j].strip() != '' and not lines[j].strip().startswith('//'):
            reexport_end = j
            break
    
    extracted = NL.join(lines[first_reexport:reexport_end])
    
    imports = [ln for ln in lines[:first_reexport] if ln.startswith('import ') or ln.strip().startswith('//')]
    
    new_content = '/**' + NL + ' * Equipment - re-exports' + NL + ' *' + NL + ' * Extracted from EquipmentSystem.ts.' + NL + ' */' + NL + NL
    new_content += NL.join(imports) + NL + NL + extracted + NL
    wf(fp.parent / 'equipment-reexports.ts', new_content)
    
    new_lines = lines[:9]
    new_lines.append("export { generateUid, resetUidCounter, weightedPickRarity } from './equipment-reexports';")
    # Check what was exported
    reexports = re.findall(r'export\s+(?:type\s+)?\{([^}]+)\}', extracted)
    for r in reexports:
        names = [n.strip() for n in r.split(',') if n.strip()]
        types_in_it = [n for n in names if n.startswith('type ')]
        if types_in_it:
            new_lines.append("export type { " + ', '.join([n.replace('type ', '') for n in types_in_it]) + " } from './equipment-reexports';")
    new_lines.append('')
    new_lines.extend(lines[:first_reexport][9:])
    new_lines.extend(lines[reexport_end:])
    wf(fp, NL.join(new_lines))
    
    print('  OK EquipmentSystem.ts: ' + str(len(lines)) + ' -> ' + str(len(new_lines)) + ' lines')
    return True

print('[1] BondSystem...')
try: split_bond()
except Exception as e: print('  ERROR: ' + str(e))

print('')
print('[2] TutorialStateMachine...')
try: split_tutorial()
except Exception as e: print('  ERROR: ' + str(e))

print('')
print('[3] CalendarSystem...')
try: split_calendar()
except Exception as e: print('  ERROR: ' + str(e))

print('')
print('[4] EquipmentSystem...')
try: split_equipment()
except Exception as e: print('  ERROR: ' + str(e))

print('')
print('=== Round 3 complete ===')
