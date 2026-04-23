/**
 * 回合执行器 — 单元测试
 *
 * 覆盖：
 * - 速度排序正确性
 * - 行动选择逻辑（普攻/技能选择）
 * - 目标选择（前排优先/后排/全体/自身/己方）
 * - 怒气系统（攻击获得/受击获得/上限）
 * - Buff/Debuff效果应用和移除
 * - 回合结束处理（冷却、buff持续时间）
 * - DOT伤害处理
 * - 控制状态处理
 * - 技能冷却
 * - 行动记录生成
 *
 * @module engine/battle/__tests__/BattleTurnExecutor.test
 */

import {
  BattleTurnExecutor,
  getAliveUnits,
  getAliveFrontUnits,
  getAliveBackUnits,
  sortBySpeed,
  getEnemyTeam,
  getAllyTeam,
  findUnitInTeam,
  findUnit,
} from '../BattleTurnExecutor';
import type {
  BattleState,
  BattleTeam,
  BattleUnit,
  BattleSkill,
  IDamageCalculator,
} from '../battle.types';
import {
  BattlePhase,
  BuffType,
  TroopType,
  SkillTargetType,
} from '../battle.types';
import { BATTLE_CONFIG } from '../battle-config';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal', name: '普攻', type: 'active', level: 1,
  description: '普通攻击', multiplier: 1.0, targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate', name: '大招', type: 'active', level: 1,
  description: '强力技能', multiplier: 2.0, targetType: SkillTargetType.ALL_ENEMY,
  rageCost: 100, cooldown: 3, currentCooldown: 0,
};

const SINGLE_TARGET_SKILL: BattleSkill = {
  id: 'single_skill', name: '单体技能', type: 'active', level: 1,
  description: '单体攻击', multiplier: 1.8, targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 100, cooldown: 2, currentCooldown: 0,
};

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将', faction: 'shu', troopType: TroopType.CAVALRY,
    position: 'front', side: 'ally', attack: 100, baseAttack: 100,
    defense: 50, baseDefense: 50, intelligence: 60, speed: 80,
    hp: 1000, maxHp: 1000, isAlive: true, rage: 0, maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK }, skills: [], buffs: [],
    ...overrides,
  };
}

function createState(overrides: Partial<BattleState> = {}): BattleState {
  const allyUnit = createUnit({ id: 'ally1', side: 'ally', name: '我方武将' });
  const enemyUnit = createUnit({ id: 'enemy1', side: 'enemy', name: '敌方武将' });
  return {
    id: 'test_battle', phase: BattlePhase.IN_PROGRESS, currentTurn: 1,
    maxTurns: BATTLE_CONFIG.MAX_TURNS,
    allyTeam: { units: [allyUnit], side: 'ally' },
    enemyTeam: { units: [enemyUnit], side: 'enemy' },
    turnOrder: [], currentActorIndex: 0, actionLog: [], result: null,
    ...overrides,
  };
}

function createMockCalculator(overrides: Partial<IDamageCalculator> = {}): IDamageCalculator {
  return {
    calculateDamage: jest.fn((_a, _d, m) => ({
      damage: 100, baseDamage: 100, skillMultiplier: m, isCritical: false,
      criticalMultiplier: 1.0, restraintMultiplier: 1.0, randomFactor: 1.0, isMinDamage: false,
    })),
    applyDamage: jest.fn((d, dmg) => {
      const actual = Math.min(dmg, d.hp);
      d.hp -= actual;
      if (d.hp <= 0) { d.hp = 0; d.isAlive = false; }
      return actual;
    }),
    calculateDotDamage: jest.fn(() => 0),
    isControlled: jest.fn(() => false),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// 1. 工具函数
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor 工具函数', () => {
  it('getAliveUnits: mixed alive/dead', () => {
    const team: BattleTeam = { units: [
      createUnit({ id: 'a1', isAlive: true }),
      createUnit({ id: 'a2', isAlive: false }),
    ], side: 'ally' };
    expect(getAliveUnits(team)).toHaveLength(1);
  });

  it('getAliveUnits: all dead → empty', () => {
    const team: BattleTeam = { units: [
      createUnit({ id: 'd1', isAlive: false }),
      createUnit({ id: 'd2', isAlive: false }),
    ], side: 'ally' };
    expect(getAliveUnits(team)).toHaveLength(0);
  });

  it('getAliveUnits: all alive → all', () => {
    const team: BattleTeam = { units: [
      createUnit({ id: 'u1' }), createUnit({ id: 'u2' }),
    ], side: 'ally' };
    expect(getAliveUnits(team)).toHaveLength(2);
  });

  it('getAliveFrontUnits: filters front + alive', () => {
    const team: BattleTeam = { units: [
      createUnit({ id: 'f1', position: 'front', isAlive: true }),
      createUnit({ id: 'f2', position: 'front', isAlive: false }),
      createUnit({ id: 'b1', position: 'back', isAlive: true }),
    ], side: 'ally' };
    expect(getAliveFrontUnits(team)).toHaveLength(1);
  });

  it('getAliveBackUnits: filters back + alive', () => {
    const team: BattleTeam = { units: [
      createUnit({ id: 'b1', position: 'back', isAlive: true }),
      createUnit({ id: 'b2', position: 'back', isAlive: false }),
      createUnit({ id: 'f1', position: 'front', isAlive: true }),
    ], side: 'ally' };
    expect(getAliveBackUnits(team)).toHaveLength(1);
  });

  it('sortBySpeed: descending order', () => {
    const r = sortBySpeed([
      createUnit({ id: 'slow', speed: 50 }),
      createUnit({ id: 'fast', speed: 120 }),
      createUnit({ id: 'mid', speed: 80 }),
    ]);
    expect(r.map(u => u.id)).toEqual(['fast', 'mid', 'slow']);
  });

  it('sortBySpeed: stable by ID on tie', () => {
    const r = sortBySpeed([
      createUnit({ id: 'beta', speed: 80 }),
      createUnit({ id: 'alpha', speed: 80 }),
    ]);
    expect(r[0].id).toBe('alpha');
  });

  it('sortBySpeed: does not mutate original', () => {
    const orig = [createUnit({ id: 'u1', speed: 50 }), createUnit({ id: 'u2', speed: 100 })];
    sortBySpeed(orig);
    expect(orig[0].id).toBe('u1');
  });

  it('getEnemyTeam: ally→enemy', () => {
    const s = createState();
    expect(getEnemyTeam(s, 'ally')).toBe(s.enemyTeam);
  });

  it('getEnemyTeam: enemy→ally', () => {
    const s = createState();
    expect(getEnemyTeam(s, 'enemy')).toBe(s.allyTeam);
  });

  it('getAllyTeam: ally→ally', () => {
    const s = createState();
    expect(getAllyTeam(s, 'ally')).toBe(s.allyTeam);
  });

  it('getAllyTeam: enemy→enemy', () => {
    const s = createState();
    expect(getAllyTeam(s, 'enemy')).toBe(s.enemyTeam);
  });

  it('findUnitInTeam: found', () => {
    const u = createUnit({ id: 't' });
    expect(findUnitInTeam({ units: [u], side: 'ally' }, 't')).toBe(u);
  });

  it('findUnitInTeam: not found', () => {
    expect(findUnitInTeam({ units: [createUnit({ id: 'x' })], side: 'ally' }, 'miss')).toBeUndefined();
  });

  it('findUnit: in ally team', () => {
    const a = createUnit({ id: 'ah', side: 'ally' });
    const s = createState({ allyTeam: { units: [a], side: 'ally' } });
    expect(findUnit(s, 'ah')).toBe(a);
  });

  it('findUnit: in enemy team', () => {
    const e = createUnit({ id: 'eh', side: 'enemy' });
    const s = createState({ enemyTeam: { units: [e], side: 'enemy' } });
    expect(findUnit(s, 'eh')).toBe(e);
  });

  it('findUnit: not found', () => {
    expect(findUnit(createState(), 'nope')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════
// 2. buildTurnOrder
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor buildTurnOrder', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('orders by speed descending', () => {
    const s = createState({
      allyTeam: { units: [createUnit({ id: 'slow', side: 'ally', speed: 30 })], side: 'ally' },
      enemyTeam: { units: [createUnit({ id: 'fast', side: 'enemy', speed: 150 })], side: 'enemy' },
    });
    executor.buildTurnOrder(s);
    expect(s.turnOrder).toEqual(['fast', 'slow']);
  });

  it('excludes dead units', () => {
    const s = createState({
      allyTeam: { units: [
        createUnit({ id: 'alive', side: 'ally', speed: 50 }),
        createUnit({ id: 'dead', side: 'ally', speed: 200, isAlive: false }),
      ], side: 'ally' },
      enemyTeam: { units: [createUnit({ id: 'e1', side: 'enemy', speed: 10 })], side: 'enemy' },
    });
    executor.buildTurnOrder(s);
    expect(s.turnOrder).not.toContain('dead');
  });

  it('resets currentActorIndex', () => {
    const s = createState();
    s.currentActorIndex = 5;
    executor.buildTurnOrder(s);
    expect(s.currentActorIndex).toBe(0);
  });

  it('handles multiple units from both teams', () => {
    const s = createState({
      allyTeam: { units: [createUnit({ id: 'a1', side: 'ally', speed: 100 }), createUnit({ id: 'a2', side: 'ally', speed: 50 })], side: 'ally' },
      enemyTeam: { units: [createUnit({ id: 'e1', side: 'enemy', speed: 80 }), createUnit({ id: 'e2', side: 'enemy', speed: 120 })], side: 'enemy' },
    });
    executor.buildTurnOrder(s);
    expect(s.turnOrder).toEqual(['e2', 'a1', 'e1', 'a2']);
  });

  it('empty teams → empty order', () => {
    const s = createState({ allyTeam: { units: [], side: 'ally' }, enemyTeam: { units: [], side: 'enemy' } });
    executor.buildTurnOrder(s);
    expect(s.turnOrder).toHaveLength(0);
  });

  it('all dead → empty order', () => {
    const s = createState({
      allyTeam: { units: [createUnit({ id: 'da', side: 'ally', isAlive: false })], side: 'ally' },
      enemyTeam: { units: [createUnit({ id: 'de', side: 'enemy', isAlive: false })], side: 'enemy' },
    });
    executor.buildTurnOrder(s);
    expect(s.turnOrder).toHaveLength(0);
  });

  it('equal speed sorted by ID', () => {
    const s = createState({
      allyTeam: { units: [createUnit({ id: 'alpha', side: 'ally', speed: 100 }), createUnit({ id: 'gamma', side: 'ally', speed: 100 })], side: 'ally' },
      enemyTeam: { units: [createUnit({ id: 'beta', side: 'enemy', speed: 100 })], side: 'enemy' },
    });
    executor.buildTurnOrder(s);
    expect(s.turnOrder).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('6v6 → 12 entries', () => {
    const allies = Array.from({ length: 6 }, (_, i) => createUnit({ id: `a${i}`, side: 'ally' as const, speed: 50 + i * 10 }));
    const enemies = Array.from({ length: 6 }, (_, i) => createUnit({ id: `e${i}`, side: 'enemy' as const, speed: 55 + i * 10 }));
    const s = createState({ allyTeam: { units: allies, side: 'ally' }, enemyTeam: { units: enemies, side: 'enemy' } });
    executor.buildTurnOrder(s);
    expect(s.turnOrder).toHaveLength(12);
  });
});

// ═══════════════════════════════════════════════
// 3. 技能选择
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor 技能选择', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('rage < 100 → normal attack', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 50, skills: [{ ...ULTIMATE_SKILL }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.isNormalAttack).toBe(true);
  });

  it('rage = 100 + skill available → ultimate', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.isNormalAttack).toBe(false);
    expect(action!.skill!.name).toBe('大招');
    // Rage consumed (100→0), then updateRage adds RAGE_GAIN_ATTACK
    expect(actor.rage).toBe(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
  });

  it('skill on cooldown → normal attack', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL, currentCooldown: 2 }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.isNormalAttack).toBe(true);
    expect(actor.rage).toBe(100); // not consumed
  });

  it('no skills → normal attack', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.isNormalAttack).toBe(true);
  });

  it('rage exactly 99 → normal attack', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 99, skills: [{ ...ULTIMATE_SKILL }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.isNormalAttack).toBe(true);
  });

  it('selects first available active skill', () => {
    const sk1: BattleSkill = { id: 's1', name: 'S1', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.SINGLE_ENEMY, rageCost: 100, cooldown: 0, currentCooldown: 0 };
    const sk2: BattleSkill = { id: 's2', name: 'S2', type: 'active', level: 1, description: '', multiplier: 2.0, targetType: SkillTargetType.ALL_ENEMY, rageCost: 100, cooldown: 0, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk1, sk2] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.skill!.name).toBe('S1');
  });

  it('skips passive skills', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ id: 'p', name: '被动', type: 'passive', level: 1, description: '', multiplier: 0, targetType: SkillTargetType.SELF, rageCost: 0, cooldown: 0, currentCooldown: 0 }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.isNormalAttack).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 4. 目标选择
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor 目标选择', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('SINGLE_ENEMY → front-row first', () => {
    const actor = createUnit({ id: 'a', side: 'ally' });
    const front = createUnit({ id: 'fe', side: 'enemy', position: 'front' });
    const back = createUnit({ id: 'be', side: 'enemy', position: 'back' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [front, back], side: 'enemy' } });
    for (let i = 0; i < 10; i++) {
      front.hp = 1000; front.isAlive = true; back.hp = 1000; back.isAlive = true;
      expect(executor.executeUnitAction(s, actor)!.targetIds).toContain('fe');
    }
  });

  it('SINGLE_ENEMY → back-row when front dead', () => {
    const actor = createUnit({ id: 'a', side: 'ally' });
    const s = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [createUnit({ id: 'fd', side: 'enemy', position: 'front', isAlive: false, hp: 0 }), createUnit({ id: 'ba', side: 'enemy', position: 'back' })], side: 'enemy' },
    });
    expect(executor.executeUnitAction(s, actor)!.targetIds).toContain('ba');
  });

  it('ALL_ENEMY → all alive enemies', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e1', side: 'enemy' }), createUnit({ id: 'e2', side: 'enemy' }), createUnit({ id: 'e3', side: 'enemy' })], side: 'enemy' } });
    const t = executor.executeUnitAction(s, actor)!.targetIds;
    expect(t).toHaveLength(3);
  });

  it('no alive targets → null', () => {
    const actor = createUnit({ id: 'a', side: 'ally' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'd', side: 'enemy', isAlive: false, hp: 0 })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)).toBeNull();
  });

  it('SELF → targets self', () => {
    const sk: BattleSkill = { id: 'sb', name: '自我', type: 'active', level: 1, description: '', multiplier: 0, targetType: SkillTargetType.SELF, rageCost: 50, cooldown: 2, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.targetIds).toContain('a');
  });

  it('SINGLE_ALLY → lowest HP ally', () => {
    const sk: BattleSkill = { id: 'h', name: '治疗', type: 'active', level: 1, description: '', multiplier: 0, targetType: SkillTargetType.SINGLE_ALLY, rageCost: 50, cooldown: 2, currentCooldown: 0 };
    const healer = createUnit({ id: 'healer', side: 'ally', rage: 100, skills: [sk] });
    const hurt = createUnit({ id: 'hurt', side: 'ally', hp: 100, maxHp: 1000 });
    const full = createUnit({ id: 'full', side: 'ally', hp: 1000, maxHp: 1000 });
    const s = createState({ allyTeam: { units: [healer, hurt, full], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, healer)!.targetIds).toContain('hurt');
  });

  it('ALL_ALLY → all alive allies', () => {
    const sk: BattleSkill = { id: 'tb', name: '团队', type: 'active', level: 1, description: '', multiplier: 0, targetType: SkillTargetType.ALL_ALLY, rageCost: 100, cooldown: 3, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const s = createState({ allyTeam: { units: [actor, createUnit({ id: 'a2', side: 'ally' }), createUnit({ id: 'a3', side: 'ally' })], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.targetIds).toHaveLength(3);
  });

  it('FRONT_ROW → all front enemies', () => {
    const sk: BattleSkill = { id: 'fs', name: '前排', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.FRONT_ROW, rageCost: 100, cooldown: 2, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'f1', side: 'enemy', position: 'front' }), createUnit({ id: 'f2', side: 'enemy', position: 'front' }), createUnit({ id: 'b1', side: 'enemy', position: 'back' })], side: 'enemy' } });
    const t = executor.executeUnitAction(s, actor)!.targetIds;
    expect(t).toHaveLength(2);
    expect(t).toContain('f1'); expect(t).toContain('f2');
  });

  it('FRONT_ROW → falls back to back when front dead', () => {
    const sk: BattleSkill = { id: 'fs', name: '前排', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.FRONT_ROW, rageCost: 100, cooldown: 2, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'f1', side: 'enemy', position: 'front', isAlive: false, hp: 0 }), createUnit({ id: 'b1', side: 'enemy', position: 'back' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.targetIds).toContain('b1');
  });

  it('BACK_ROW → all back enemies', () => {
    const sk: BattleSkill = { id: 'bs', name: '后排', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.BACK_ROW, rageCost: 100, cooldown: 2, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'f1', side: 'enemy', position: 'front' }), createUnit({ id: 'b1', side: 'enemy', position: 'back' }), createUnit({ id: 'b2', side: 'enemy', position: 'back' })], side: 'enemy' } });
    const t = executor.executeUnitAction(s, actor)!.targetIds;
    expect(t).toHaveLength(2);
});
});
