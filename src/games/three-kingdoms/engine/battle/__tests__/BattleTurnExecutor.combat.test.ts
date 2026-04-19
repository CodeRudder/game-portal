/**
 * 回合执行器 — 单元测试（第2部分：目标选择 + 怒气 + Buff + 回合结束 + DOT + 控制）
 *
 * 覆盖：
 * - 目标选择（前排优先、存活单位、各种目标类型）
 * - 怒气系统更新
 * - Buff/Debuff效果应用和移除
 * - 回合结束处理（冷却、buff持续时间）
 * - DOT伤害处理
 * - 控制状态处理
 *
 * @module engine/battle/__tests__/BattleTurnExecutor.combat.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleTurnExecutor } from '../BattleTurnExecutor';
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
  description: '普通攻击', multiplier: 1.0,
  targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate', name: '大招', type: 'active', level: 1,
  description: '强力技能', multiplier: 2.0,
  targetType: SkillTargetType.ALL_ENEMY,
  rageCost: 100, cooldown: 3, currentCooldown: 0,
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
    id: 'test_battle', phase: BattlePhase.IN_PROGRESS,
    currentTurn: 1, maxTurns: BATTLE_CONFIG.MAX_TURNS,
    allyTeam: { units: [allyUnit], side: 'ally' },
    enemyTeam: { units: [enemyUnit], side: 'enemy' },
    turnOrder: [], currentActorIndex: 0, actionLog: [], result: null,
    ...overrides,
  };
}

function createMockCalculator(overrides: Partial<IDamageCalculator> = {}): IDamageCalculator {
  return {
    calculateDamage: vi.fn((_a, _d, m) => ({
      damage: 100, baseDamage: 100, skillMultiplier: m,
      isCritical: false, criticalMultiplier: 1.0,
      restraintMultiplier: 1.0, randomFactor: 1.0, isMinDamage: false,
    })),
    applyDamage: vi.fn((defender, damage) => {
      const actual = Math.min(damage, defender.hp);
      defender.hp -= actual;
      if (defender.hp <= 0) { defender.hp = 0; defender.isAlive = false; }
      return actual;
    }),
    calculateDotDamage: vi.fn(() => 0),
    isControlled: vi.fn(() => false),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// 1. 目标选择测试
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor 目标选择', () => {
  let executor: BattleTurnExecutor;

  beforeEach(() => {
    executor = new BattleTurnExecutor(createMockCalculator());
  });

  it('should target front-row first for SINGLE_ENEMY', () => {
    const actor = createUnit({ id: 'actor', side: 'ally' });
    const frontEnemy = createUnit({ id: 'front_e', side: 'enemy', position: 'front' });
    const backEnemy = createUnit({ id: 'back_e', side: 'enemy', position: 'back' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [frontEnemy, backEnemy], side: 'enemy' },
    });
    for (let i = 0; i < 10; i++) {
      frontEnemy.hp = 1000; frontEnemy.isAlive = true;
      backEnemy.hp = 1000; backEnemy.isAlive = true;
      const action = executor.executeUnitAction(state, actor);
      expect(action!.targetIds).toContain('front_e');
    }
  });

  it('should target back-row when front-row is dead', () => {
    const actor = createUnit({ id: 'actor', side: 'ally' });
    const frontDead = createUnit({ id: 'front_dead', side: 'enemy', position: 'front', isAlive: false, hp: 0 });
    const backAlive = createUnit({ id: 'back_alive', side: 'enemy', position: 'back' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [frontDead, backAlive], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action!.targetIds).toContain('back_alive');
  });

  it('should target all enemies for ALL_ENEMY skill', () => {
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const e1 = createUnit({ id: 'e1', side: 'enemy' });
    const e2 = createUnit({ id: 'e2', side: 'enemy' });
    const e3 = createUnit({ id: 'e3', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [e1, e2, e3], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action!.targetIds).toHaveLength(3);
  });

  it('should return null when no targets are alive', () => {
    const actor = createUnit({ id: 'actor', side: 'ally' });
    const deadEnemy = createUnit({ id: 'dead', side: 'enemy', isAlive: false, hp: 0 });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [deadEnemy], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action).toBeNull();
  });

  it('should target self for SELF target type', () => {
    const selfSkill: BattleSkill = {
      id: 'self_buff', name: '自我强化', type: 'active', level: 1,
      description: '提升自身攻击', multiplier: 0,
      targetType: SkillTargetType.SELF, rageCost: 50, cooldown: 2, currentCooldown: 0,
    };
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 100, skills: [selfSkill] });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action!.targetIds).toContain('actor');
  });

  it('should target lowest HP ratio ally for SINGLE_ALLY target type', () => {
    const healSkill: BattleSkill = {
      id: 'heal', name: '治疗', type: 'active', level: 1,
      description: '治疗己方单体', multiplier: 0,
      targetType: SkillTargetType.SINGLE_ALLY, rageCost: 50, cooldown: 2, currentCooldown: 0,
    };
    const healer = createUnit({ id: 'healer', side: 'ally', rage: 100, skills: [healSkill] });
    const hurtAlly = createUnit({ id: 'hurt', side: 'ally', hp: 100, maxHp: 1000 });
    const fullAlly = createUnit({ id: 'full', side: 'ally', hp: 1000, maxHp: 1000 });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [healer, hurtAlly, fullAlly], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, healer);
    expect(action!.targetIds).toContain('hurt');
  });

  it('should target all allies for ALL_ALLY target type', () => {
    const teamBuff: BattleSkill = {
      id: 'team_buff', name: '团队增益', type: 'active', level: 1,
      description: '全体增益', multiplier: 0,
      targetType: SkillTargetType.ALL_ALLY, rageCost: 100, cooldown: 3, currentCooldown: 0,
    };
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 100, skills: [teamBuff] });
    const ally2 = createUnit({ id: 'ally2', side: 'ally' });
    const ally3 = createUnit({ id: 'ally3', side: 'ally' });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor, ally2, ally3], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action!.targetIds).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════
// 2. 怒气系统测试
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor 怒气系统', () => {
  let executor: BattleTurnExecutor;

  beforeEach(() => {
    executor = new BattleTurnExecutor(createMockCalculator());
  });

  it('should increase actor rage by RAGE_GAIN_ATTACK after normal attack', () => {
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 0 });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    executor.executeUnitAction(state, actor);
    expect(actor.rage).toBe(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
  });

  it('should increase target rage by RAGE_GAIN_HIT when hit', () => {
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 0 });
    const enemy = createUnit({ id: 'enemy', side: 'enemy', rage: 0 });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    executor.executeUnitAction(state, actor);
    expect(enemy.rage).toBe(BATTLE_CONFIG.RAGE_GAIN_HIT);
  });

  it('should cap rage at maxRage', () => {
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 90, maxRage: 100 });
    const enemy = createUnit({ id: 'enemy', side: 'enemy', rage: 95 });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    executor.executeUnitAction(state, actor);
    expect(actor.rage).toBe(100);
    expect(enemy.rage).toBe(100);
  });
});

// ═══════════════════════════════════════════════
// 3. Buff/Debuff 测试
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor Buff/Debuff', () => {
  let executor: BattleTurnExecutor;

  beforeEach(() => {
    executor = new BattleTurnExecutor(createMockCalculator());
  });

  it('should apply skill buffs to targets', () => {
    const buffSkill: BattleSkill = {
      id: 'buff_skill', name: '增益技能', type: 'active', level: 1,
      description: '附带增益', multiplier: 1.5,
      targetType: SkillTargetType.SINGLE_ENEMY, rageCost: 100, cooldown: 2, currentCooldown: 0,
      buffs: [{ type: BuffType.ATK_DOWN, remainingTurns: 2, value: 0.2, sourceId: '' }],
    };
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 100, skills: [buffSkill] });
    const enemy = createUnit({ id: 'enemy', side: 'enemy', buffs: [] });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    executor.executeUnitAction(state, actor);
    expect(enemy.buffs).toHaveLength(1);
    expect(enemy.buffs[0].type).toBe(BuffType.ATK_DOWN);
    expect(enemy.buffs[0].sourceId).toBe('actor');
  });

  it('should not apply buffs to dead targets', () => {
    const buffSkill: BattleSkill = {
      id: 'buff_skill', name: '增益技能', type: 'active', level: 1,
      description: '附带增益', multiplier: 1.5,
      targetType: SkillTargetType.ALL_ENEMY, rageCost: 100, cooldown: 2, currentCooldown: 0,
      buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: '' }],
    };
    const actor = createUnit({ id: 'actor', side: 'ally', rage: 100, skills: [buffSkill] });
    const aliveEnemy = createUnit({ id: 'alive_e', side: 'enemy', buffs: [] });
    const deadEnemy = createUnit({ id: 'dead_e', side: 'enemy', isAlive: false, hp: 0, buffs: [] });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [aliveEnemy, deadEnemy], side: 'enemy' },
    });
    executor.executeUnitAction(state, actor);
    expect(aliveEnemy.buffs).toHaveLength(1);
    expect(deadEnemy.buffs).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════
// 4. 回合结束处理测试
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor.endTurn', () => {
  let executor: BattleTurnExecutor;

  beforeEach(() => {
    executor = new BattleTurnExecutor(createMockCalculator());
  });

  it('should decrement buff remainingTurns', () => {
    const unit = createUnit({
      id: 'unit', side: 'ally',
      buffs: [
        { type: BuffType.ATK_UP, remainingTurns: 3, value: 0.2, sourceId: 'src' },
        { type: BuffType.DEF_UP, remainingTurns: 1, value: 0.15, sourceId: 'src' },
      ],
    });
    const state = createState({ allyTeam: { units: [unit], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(state);
    expect(unit.buffs[0].remainingTurns).toBe(2);
    // Buff with remainingTurns=1 gets decremented to 0 and removed
    expect(unit.buffs).toHaveLength(1);
  });

  it('should remove expired buffs', () => {
    const unit = createUnit({
      id: 'unit', side: 'ally',
      buffs: [
        { type: BuffType.ATK_UP, remainingTurns: 1, value: 0.2, sourceId: 'src' },
        { type: BuffType.DEF_UP, remainingTurns: 2, value: 0.15, sourceId: 'src' },
      ],
    });
    const state = createState({ allyTeam: { units: [unit], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(state);
    expect(unit.buffs).toHaveLength(1);
    expect(unit.buffs[0].type).toBe(BuffType.DEF_UP);
  });

  it('should decrement skill cooldowns', () => {
    const unit = createUnit({
      id: 'unit', side: 'ally',
      skills: [
        { ...ULTIMATE_SKILL, currentCooldown: 3 },
        { ...ULTIMATE_SKILL, id: 'skill2', currentCooldown: 1 },
      ],
    });
    const state = createState({ allyTeam: { units: [unit], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(state);
    expect(unit.skills[0].currentCooldown).toBe(2);
    expect(unit.skills[1].currentCooldown).toBe(0);
  });

  it('should not decrement cooldown below 0', () => {
    const unit = createUnit({
      id: 'unit', side: 'ally',
      skills: [{ ...ULTIMATE_SKILL, currentCooldown: 0 }],
    });
    const state = createState({ allyTeam: { units: [unit], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(state);
    expect(unit.skills[0].currentCooldown).toBe(0);
  });

  it('should set phase to FINISHED when max turns reached', () => {
    const state = createState({ currentTurn: BATTLE_CONFIG.MAX_TURNS });
    executor.endTurn(state);
    expect(state.phase).toBe(BattlePhase.FINISHED);
  });

  it('should not set phase to FINISHED when turns remain', () => {
    const state = createState({ currentTurn: 1 });
    executor.endTurn(state);
    expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
  });

  it('should handle units with no buffs or skills gracefully', () => {
    const unit = createUnit({ id: 'unit', side: 'ally', buffs: [], skills: [] });
    const state = createState({ allyTeam: { units: [unit], side: 'ally' }, currentTurn: 1 });
    expect(() => executor.endTurn(state)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════
// 5. DOT伤害测试
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor DOT伤害', () => {
  let executor: BattleTurnExecutor;

  beforeEach(() => {
    const calc = createMockCalculator({
      calculateDotDamage: vi.fn((unit) => {
        if (unit.buffs.some(b => b.type === BuffType.BURN)) return Math.floor(unit.maxHp * 0.05);
        return 0;
      }),
    });
    executor = new BattleTurnExecutor(calc);
  });

  it('should apply DOT damage before acting', () => {
    const actor = createUnit({
      id: 'actor', side: 'ally', hp: 200, maxHp: 1000,
      buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: 'src' }],
    });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    executor.executeUnitAction(state, actor);
    expect(actor.hp).toBe(150); // 200 - 50 DOT
  });

  it('should return death action when DOT kills the unit', () => {
    const actor = createUnit({
      id: 'actor', side: 'ally', hp: 30, maxHp: 1000,
      buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: 'src' }],
    });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action).not.toBeNull();
    expect(action!.description).toContain('阵亡');
    expect(actor.isAlive).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// 6. 控制状态测试
// ═══════════════════════════════════════════════

describe('BattleTurnExecutor 控制状态', () => {
  let executor: BattleTurnExecutor;

  beforeEach(() => {
    const calc = createMockCalculator({
      isControlled: vi.fn((unit) =>
        unit.buffs.some(b => b.type === BuffType.STUN || b.type === BuffType.FREEZE),
      ),
    });
    executor = new BattleTurnExecutor(calc);
  });

  it('should skip action when unit is stunned', () => {
    const actor = createUnit({
      id: 'actor', side: 'ally',
      buffs: [{ type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: 'src' }],
    });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action).not.toBeNull();
    expect(action!.description).toContain('被控制');
    expect(action!.skill).toBeNull();
    expect(action!.targetIds).toHaveLength(0);
  });

  it('should skip action when unit is frozen', () => {
    const actor = createUnit({
      id: 'actor', side: 'ally',
      buffs: [{ type: BuffType.FREEZE, remainingTurns: 1, value: 0, sourceId: 'src' }],
    });
    const enemy = createUnit({ id: 'enemy', side: 'enemy' });
    const state = createState({
      allyTeam: { units: [actor], side: 'ally' },
      enemyTeam: { units: [enemy], side: 'enemy' },
    });
    const action = executor.executeUnitAction(state, actor);
    expect(action!.description).toContain('被控制');
  });
});
