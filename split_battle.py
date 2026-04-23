#!/usr/bin/env python3
"""Split BattleTurnExecutor: extract helper functions to battle-helpers.ts"""

filepath = 'src/games/three-kingdoms/engine/battle/BattleTurnExecutor.ts'

with open(filepath, 'r') as f:
    content = f.read()

lines = content.split('\n')

# Find key line indices
import_start = None
helpers_end = None
for i, line in enumerate(lines):
    if line.startswith('import type {') and import_start is None:
        import_start = i
    if 'BattleTurnExecutor' in line and helpers_end is None and import_start is not None:
        # This is the section comment before the class
        helpers_end = i
        break

print(f'import_start={import_start}, helpers_end={helpers_end}')

new_imports = """import type {
  BattleAction,
  BattleSkill,
  BattleState,
  BattleUnit,
  BuffEffect,
  DamageResult,
  IDamageCalculator,
} from './battle.types';
import { BattlePhase } from './battle.types';
import { BATTLE_CONFIG } from './battle-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import {
  getAliveUnits,
  getAliveFrontUnits,
  getAliveBackUnits,
  sortBySpeed,
  getEnemyTeam,
  getAllyTeam,
} from './battle-helpers';

// 重导出辅助函数，保持向后兼容
export {
  getAliveUnits,
  getAliveFrontUnits,
  getAliveBackUnits,
  sortBySpeed,
  getEnemyTeam,
  getAllyTeam,
  findUnitInTeam,
  findUnit,
} from './battle-helpers';"""

new_lines = lines[:import_start] + [new_imports] + [''] + lines[helpers_end:]
new_content = '\n'.join(new_lines)

with open(filepath, 'w') as f:
    f.write(new_content)

# Verify
with open(filepath, 'r') as f:
    new_lines_count = len(f.readlines())
print(f'New line count: {new_lines_count}')
