#!/usr/bin/env python3
"""Fix all 10 p2 test files with truncated imports."""
import os

BASE = 'src/games/three-kingdoms'

def fix_file(filepath, old_bad_prefix, new_header):
    """Replace truncated import prefix with proper header."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    if content.startswith(old_bad_prefix):
        content = new_header + content[len(old_bad_prefix):]
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  Fixed: {filepath}")
    else:
        print(f"  WARNING: prefix mismatch in {filepath}")
        print(f"  Starts with: {repr(content[:80])}")


# ============================================================
# File 1: ActivitySystem-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/activity/__tests__/ActivitySystem-p2.test.ts',
    'import {\ndescribe',
    """import {
  ActivitySystem,
  createDefaultActivityState,
  createMilestone,
} from '../ActivitySystem';

import type {
  ActivityDef,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityState,
} from '../../../core/activity/activity.types';

import {
  ActivityType,
  ActivityTaskType,
  MilestoneStatus,
} from '../../../core/activity/activity.types';

// ─── 辅助 ────────────────────────────────────

function createActivityDef(
  id: string,
  type: ActivityType,
  overrides?: Partial<ActivityDef>,
): ActivityDef {
  return {
    id,
    name: `活动_${id}`,
    description: `测试活动 ${id}`,
    type,
    startTime: Date.now() - 1000,
    endTime: Date.now() + 86400000,
    icon: `icon_${id}`,
    ...overrides,
  };
}

function createTaskDef(
  id: string,
  taskType: ActivityTaskType,
  overrides?: Partial<ActivityTaskDef>,
): ActivityTaskDef {
  return {
    id,
    name: `任务_${id}`,
    description: `测试任务 ${id}`,
    taskType,
    targetCount: 10,
    tokenReward: 5,
    pointReward: 20,
    resourceReward: { copper: 100 },
    ...overrides,
  };
}

function createStandardTaskDefs(): ActivityTaskDef[] {
  const daily = Array.from({ length: 5 }, (_, i) =>
    createTaskDef(`daily_${i + 1}`, ActivityTaskType.DAILY, {
      targetCount: 5 + i,
      pointReward: 10,
      tokenReward: 2,
    }),
  );
  const challenge = Array.from({ length: 3 }, (_, i) =>
    createTaskDef(`challenge_${i + 1}`, ActivityTaskType.CHALLENGE, {
      targetCount: 20 + i * 10,
      pointReward: 50,
      tokenReward: 10,
    }),
  );
  const cumulative = [
    createTaskDef('cumulative_1', ActivityTaskType.CUMULATIVE, {
      targetCount: 100,
      pointReward: 100,
      tokenReward: 30,
    }),
  ];
  return [...daily, ...challenge, ...cumulative];
}

function createStandardMilestones(): ActivityMilestone[] {
  return [
    createMilestone('ms_1', 50, { copper: 500 }),
    createMilestone('ms_2', 150, { gold: 10 }),
    createMilestone('ms_3', 300, { heroFragment: 3 }),
    createMilestone('ms_final', 500, { legendaryChest: 1 }, true),
  ];
}

function createStartedState(
  activityId: string,
  type: ActivityType,
  now: number,
  taskDefs?: ActivityTaskDef[],
  milestones?: ActivityMilestone[],
): ActivityState {
  const system = new ActivitySystem();
  const state = createDefaultActivityState();
  const def = createActivityDef(activityId, type);
  const tasks = taskDefs ?? createStandardTaskDefs();
  const ms = milestones ?? createStandardMilestones();
  return system.startActivity(state, def, tasks, ms, now);
}

const NOW = Date.now();

"""
)

# ============================================================
# File 2: SignInSystem-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/activity/__tests__/SignInSystem-p2.test.ts',
    'import {\ndescribe',
    """import {
  SignInSystem,
  createDefaultSignInData,
  DEFAULT_SIGN_IN_REWARDS,
  DEFAULT_SIGN_IN_CONFIG,
  SIGN_IN_CYCLE_DAYS,
} from '../SignInSystem';

import type { SignInData, SignInReward, SignInConfig } from '../../../core/activity/activity.types';

function dayOffset(base: number, days: number): number {
  return base + days * 24 * 60 * 60 * 1000;
}

const BASE_TIME = new Date('2024-01-01T00:00:00Z').getTime();

"""
)

# ============================================================
# File 3: AllianceSystem-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/alliance/__tests__/AllianceSystem-p2.test.ts',
    'import {\ndescribe',
    """import {
  AllianceSystem,
} from '../AllianceSystem';
import {
  ALLIANCE_LEVEL_CONFIGS,
  createDefaultAlliancePlayerState,
  createAllianceData,
} from '../alliance-constants';
import { ApplicationStatus, AllianceRole } from '../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
} from '../../../core/alliance/alliance.types';

const NOW = 1000000;

function createState(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return {
    allianceId: null,
    role: AllianceRole.NONE,
    joinTime: 0,
    dailyDonation: 0,
    ...overrides,
  } as AlliancePlayerState;
}

function createTestAlliance(
  overrides?: Partial<AllianceData>,
): AllianceData {
  return {
    id: 'a1',
    name: '测试联盟',
    leaderId: 'p1',
    members: [],
    level: 1,
    exp: 0,
    announcement: '',
    channels: [],
    ...overrides,
  } as AllianceData;
}

function createAllianceWithMembers(): AllianceData {
  return createTestAlliance({
    members: [
      { playerId: 'p1', name: '刘备', role: AllianceRole.LEADER, joinTime: NOW - 1000, dailyDonation: 0 },
      { playerId: 'p2', name: '诸葛亮', role: AllianceRole.VICE_LEADER, joinTime: NOW - 500, dailyDonation: 0 },
      { playerId: 'p3', name: '关羽', role: AllianceRole.MEMBER, joinTime: NOW - 200, dailyDonation: 0 },
    ],
  });
}

"""
)

# ============================================================
# File 4: BattleEffectManager-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/battle/__tests__/BattleEffectManager-p2.test.ts',
    "import { BattleEffectManager } from '../BattleEffectManager';\nimport type {\ndescribe",
    """import { BattleEffectManager } from '../BattleEffectManager';
import type {
  SkillEffectData,
  MobileLayoutConfig,
  DamageAnimationData,
  EffectElement,
} from '../BattleEffectManager';
import type { BattleUnit, BattleSkill, BattleAction, DamageResult } from '../battle.types';
import { TroopType, BuffType, SkillTargetType } from '../battle.types';
import { BattleSpeed } from '../battle-v4.types';
import { DamageNumberType } from '../DamageNumberSystem';

function createTestSkill(overrides: Partial<BattleSkill> = {}): BattleSkill {
  return {
    id: 'skill_1',
    name: '测试技能',
    damage: 100,
    rageCost: 0,
    targetType: SkillTargetType.SINGLE_ENEMY,
    effects: [],
    ...overrides,
  };
}

function createTestUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit_1',
    name: '测试单位',
    hp: 1000,
    maxHp: 1000,
    attack: 100,
    defense: 50,
    speed: 100,
    rage: 0,
    troopType: TroopType.INFANTRY,
    skills: [createTestSkill()],
    buffs: [],
    ...overrides,
  };
}

function createDamageResult(overrides: Partial<DamageResult> = {}): DamageResult {
  return {
    attackerId: 'unit_1',
    targetId: 'unit_2',
    damage: 100,
    isCritical: false,
    ...overrides,
  };
}

function createTestAction(overrides: Partial<BattleAction> = {}): BattleAction {
  return {
    actorId: 'unit_1',
    skillId: 'skill_1',
    targetIds: ['unit_2'],
    damageResults: [createDamageResult()],
    ...overrides,
  };
}

"""
)

# ============================================================
# File 5: BattleEngine-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/battle/__tests__/BattleEngine-p2.test.ts',
    "import { BattleEngine } from '../BattleEngine';\nimport type {\ndescribe",
    """import { BattleEngine } from '../BattleEngine';
import type {
  BattleTeam,
  BattleUnit,
  BattleSkill,
  BattleState,
} from '../battle.types';
import {
  BATTLE_CONFIG,
  BattleOutcome,
  BattlePhase,
  BuffType,
  StarRating,
  TroopType,
} from '../battle.types';

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal_attack',
  name: '普通攻击',
  damage: 0,
  rageCost: 0,
  targetType: 0,
  effects: [],
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate',
  name: '大招',
  damage: 0,
  rageCost: 100,
  targetType: 0,
  effects: [],
};

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit_1',
    name: '测试武将',
    hp: 1000,
    maxHp: 1000,
    attack: 100,
    defense: 50,
    speed: 100,
    rage: 0,
    troopType: TroopType.INFANTRY,
    skills: [NORMAL_ATTACK, ULTIMATE_SKILL],
    buffs: [],
    ...overrides,
  };
}

function createTeam(
  side: string,
  count: number,
  overrides?: Partial<BattleUnit>,
): BattleTeam {
  const units = Array.from({ length: count }, (_, i) =>
    createUnit({
      id: `${side}_${i + 1}`,
      name: `${side}_武将${i + 1}`,
      ...overrides,
    }),
  );
  return { side: side as 'ally' | 'enemy', units };
}

"""
)

# ============================================================
# File 6: EquipmentSystem-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/equipment/__tests__/EquipmentSystem-p2.test.ts',
    "import { EquipmentSystem, resetUidCounter } from '../EquipmentSystem';\nimport type {\n  describe",
    """import { EquipmentSystem, resetUidCounter } from '../EquipmentSystem';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  BagFilter,
  BagSortMode,
} from '../../../core/equipment';
import type { ISystemDeps } from '../../../core/types/subsystem';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
  RARITY_ENHANCE_CAP,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_SUB_STAT_MULTIPLIER,
  DEFAULT_BAG_CAPACITY,
  BAG_EXPAND_INCREMENT,
} from '../../../core/equipment';

function createMockDeps(): ISystemDeps {
  const listeners: Record<string, Function[]> = {};
  return {
    eventBus: {
      on: (event: string, cb: Function) => { (listeners[event] ??= []).push(cb); },
      off: (event: string, cb: Function) => { listeners[event] = (listeners[event] ?? []).filter(fn => fn !== cb); },
      emit: (event: string, ...args: any[]) => { (listeners[event] ?? []).forEach(fn => fn(...args)); },
    },
  } as ISystemDeps;
}

function getInternalDeps(sys: EquipmentSystem): ISystemDeps {
  return (sys as unknown as { deps: ISystemDeps }).deps;
}

function createSystem(): EquipmentSystem {
  return new EquipmentSystem(createMockDeps());
}

function addRandomEquipment(
  sys: EquipmentSystem,
  slot?: EquipmentSlot,
  rarity?: EquipmentRarity,
): EquipmentInstance {
  const s = slot ?? EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)];
  const r = rarity ?? EQUIPMENT_RARITIES[Math.floor(Math.random() * EQUIPMENT_RARITIES.length)];
  return sys.generateEquipment(s, r);
}

"""
)

# ============================================================
# File 7: HeritageSystem-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/heritage/__tests__/HeritageSystem-p2.test.ts',
    "import { HeritageSystem } from '../HeritageSystem';\nimport type {\ndescribe",
    """import { HeritageSystem } from '../HeritageSystem';
import type {
  HeroHeritageRequest,
  EquipmentHeritageRequest,
  ExperienceHeritageRequest,
} from '../../../core/heritage';
import type { ISystemDeps } from '../../../core/types/subsystem';
import {
  HERO_HERITAGE_RULE,
  EQUIPMENT_HERITAGE_RULE,
  EXPERIENCE_HERITAGE_RULE,
  DAILY_HERITAGE_LIMIT,
} from '../../../core/heritage';

interface MockHero {
  id: string;
  level: number;
  exp: number;
  skills: string[];
  affection: number;
}

interface MockEquip {
  uid: string;
  slot: string;
  rarity: string;
  enhanceLevel: number;
}

function createSystem() {
  const sys = new HeritageSystem();
  const heroes: Record<string, MockHero> = {};
  const resources: Record<string, number> = { copper: 10000, gold: 100 };
  const upgradedBuildings: string[] = [];
  return { sys, heroes, resources, upgradedBuildings };
}

function mockHero(overrides: Partial<MockHero> & { id: string }): MockHero {
  return {
    level: 1,
    exp: 0,
    skills: [],
    affection: 0,
    ...overrides,
  };
}

function mockEquip(overrides: Partial<MockEquip> & { uid: string }): MockEquip {
  return {
    slot: 'weapon',
    rarity: 'rare',
    enhanceLevel: 0,
    ...overrides,
  };
}

"""
)

# ============================================================
# File 8: ArenaSystem-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/pvp/__tests__/ArenaSystem-p2.test.ts',
    'import {\ndescribe',
    """import {
  ArenaSystem,
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
} from '../ArenaSystem';
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';
import type { ArenaOpponent, ArenaPlayerState } from '../../../core/pvp/pvp.types';
import type { Faction } from '../../hero/hero.types';

"""
)

# ============================================================
# File 9: TouchInputSystem-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/engine/responsive/__tests__/TouchInputSystem-p2.test.ts',
    'import {\n  describe',
    """import {
  GestureType,
  GESTURE_THRESHOLDS,
  FormationTouchAction,
  DesktopInteractionType,
  TouchFeedbackType,
} from '../../../core/responsive/responsive.types';
import { TouchInputSystem } from '../TouchInputSystem';

"""
)

# ============================================================
# File 10: PrdChecker-p2.test.ts
# ============================================================
fix_file(
    f'{BASE}/tests/ui-review/__tests__/PrdChecker-p2.test.ts',
    "import { describe, it, expect } from 'vitest';\nimport {\ndescribe",
    """import { describe, it, expect } from 'vitest';
import {
  PrdChecker,
  type PrdDocument,
  type PrdRequirement,
  type PrdCheckResult,
} from '../PrdChecker';

const MOCK_SOURCE_FILES = [
  'src/engine/resource/ResourceSystem.ts',
  'src/engine/resource/ResourceTypes.ts',
];

function createMockSourceContents(): Map<string, string> {
  const map = new Map<string, string>();
  map.set('src/engine/resource/ResourceSystem.ts', 'export class ResourceSystem { /* ... */ }');
  map.set('src/engine/resource/ResourceTypes.ts', 'export interface Resource { id: string; }');
  return map;
}

"""
)

print("\nAll files processed!")
