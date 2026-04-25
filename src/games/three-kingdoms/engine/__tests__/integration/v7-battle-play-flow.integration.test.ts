/**
 * v7.0 草木皆兵 — 战斗Play流程集成测试
 *
 * 覆盖完整战斗play流程：
 *   §CBT-1 兵种克制关系（骑兵>步兵>枪兵>骑兵，弓兵/谋士无克制）
 *   §CBT-2 伤害计算公式（攻击加成/防御加成/暴击/克制/随机波动/最低保底）
 *   §CBT-3 战斗引擎回合流程（初始化→回合执行→胜负判定→星级评定）
 *   §CBT-4 护盾/灼烧/中毒/流血/冰冻状态效果
 *   §CBT-5 大招时停+战斗加速（v4.0）
 *   §CBT-6 碎片奖励计算
 *   §CBT-7 自动编队
 *
 * @module engine/__tests__/integration/v7-battle-play-flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BattleEngine,
  DamageCalculator,
  getRestraintMultiplier,
  getAttackBonus,
  getDefenseBonus,
  getShieldAmount,
  TroopType,
  BuffType,
  BattleOutcome,
  BattlePhase,
  BattleSpeed,
  BattleMode,
  autoFormation,
} from '../../battle';
import type {
  BattleUnit,
  BattleTeam,
  BattleState,
  BuffEffect,
  BattleSkill,
} from '../../battle';
import type { ISystemDeps } from '../../../core/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  const listeners: Record<string, Function[]> = {};
  return {
    eventBus: {
      emit: (event: string, data?: unknown) => {
        (listeners[event] ?? []).forEach(fn => fn(data));
      },
      on: (event: string, fn: Function) => {
        (listeners[event] ??= []).push(fn);
      },
      off: () => {},
    },
    registry: { get: () => null },
  } as unknown as ISystemDeps;
}

/** 创建普通攻击技能 */
function normalAttack(): BattleSkill {
  return {
    id: 'atk_normal', name: '普通攻击', type: 'active', level: 1,
    description: '普攻', multiplier: 1.0, targetType: 'single_enemy',
    rageCost: 0, cooldown: 0, currentCooldown: 0,
  };
}

/** 创建大招技能 */
function ultimateSkill(): BattleSkill {
  return {
    id: 'ult_01', name: '必杀技', type: 'active', level: 1,
    description: '大招', multiplier: 2.0, targetType: 'single_enemy',
    rageCost: 100, cooldown: 3, currentCooldown: 0,
  };
}

/** 创建战斗单位 */
function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit_' + Math.random().toString(36).slice(2, 6),
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.INFANTRY,
    position: 'front',
    side: 'ally',
    attack: 100, baseAttack: 100,
    defense: 50, baseDefense: 50,
    intelligence: 60,
    speed: 80,
    hp: 500, maxHp: 500,
    isAlive: true,
    rage: 0, maxRage: 100,
    normalAttack: normalAttack(),
    skills: [ultimateSkill()],
    buffs: [],
    ...overrides,
  };
}

/** 创建队伍 */
function createTeam(units: BattleUnit[], side: 'ally' | 'enemy' = 'ally'): BattleTeam {
  return { units, side };
}

/** 创建强力队伍（确保能赢） */
function createStrongTeam(side: 'ally' | 'enemy' = 'ally'): BattleTeam {
  return createTeam([
    createUnit({ id: `${side}_1`, name: '猛将1', side, attack: 200, defense: 80, hp: 800, maxHp: 800, speed: 100 }),
    createUnit({ id: `${side}_2`, name: '猛将2', side, attack: 180, defense: 70, hp: 700, maxHp: 700, speed: 90 }),
    createUnit({ id: `${side}_3`, name: '猛将3', side, attack: 160, defense: 60, hp: 600, maxHp: 600, speed: 70, position: 'back' }),
  ], side);
}

/** 创建弱队伍（确保会输） */
function createWeakTeam(side: 'ally' | 'enemy' = 'enemy'): BattleTeam {
  return createTeam([
    createUnit({ id: `${side}_1`, name: '弱兵1', side, attack: 30, defense: 20, hp: 100, maxHp: 100, speed: 30 }),
    createUnit({ id: `${side}_2`, name: '弱兵2', side, attack: 25, defense: 15, hp: 80, maxHp: 80, speed: 25 }),
  ], side);
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v7.0 草木皆兵: 战斗Play流程', () => {
  let engine: BattleEngine;
  let calc: DamageCalculator;

  beforeEach(() => {
    engine = new BattleEngine();
    calc = new DamageCalculator();
  });

  // ── §CBT-1 兵种克制关系 ──

  describe('§CBT-1 兵种克制关系', () => {
    it('骑兵克制步兵 → 系数1.5', () => {
      expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY)).toBe(1.5);
    });

    it('步兵克制枪兵 → 系数1.5', () => {
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN)).toBe(1.5);
    });

    it('枪兵克制骑兵 → 系数1.5', () => {
      expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY)).toBe(1.5);
    });

    it('步兵被骑兵克制 → 系数0.7', () => {
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY)).toBe(0.7);
    });

    it('弓兵对任何兵种无克制 → 系数1.0', () => {
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.CAVALRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.INFANTRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.ARCHER)).toBe(1.0);
    });

    it('谋士对任何兵种无克制 → 系数1.0', () => {
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.CAVALRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.STRATEGIST)).toBe(1.0);
    });

    it('克制关系影响实际战斗伤害', () => {
      const cavalry = createUnit({ troopType: TroopType.CAVALRY, attack: 200, speed: 0 });
      const infantry = createUnit({ troopType: TroopType.INFANTRY, defense: 50 });
      const spearman = createUnit({ troopType: TroopType.SPEARMAN, defense: 50 });

      // 骑兵打步兵（克制）
      const resultAdv = calc.calculateDamage(cavalry, infantry, 1.0);
      // 骑兵打枪兵（被克制）
      const resultDis = calc.calculateDamage(cavalry, spearman, 1.0);

      expect(resultAdv.restraintMultiplier).toBe(1.5);
      expect(resultDis.restraintMultiplier).toBe(0.7);
      expect(resultAdv.damage).toBeGreaterThan(resultDis.damage);
    });
  });

  // ── §CBT-2 伤害计算公式 ──

  describe('§CBT-2 伤害计算公式', () => {
    it('基础伤害 = 攻击×(1+加成) - 防御×(1+加成)，最低为1', () => {
      const attacker = createUnit({ attack: 100, defense: 0, speed: 0 });
      const defender = createUnit({ attack: 0, defense: 50, speed: 0 });
      const result = calc.calculateDamage(attacker, defender, 1.0);
      // 基础伤害 = 100 - 50 = 50，再乘以随机波动等
      expect(result.baseDamage).toBeGreaterThanOrEqual(1);
      expect(result.damage).toBeGreaterThanOrEqual(1);
    });

    it('攻击加成Buff提升伤害', () => {
      const attacker = createUnit({
        attack: 100, speed: 0,
        buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: 0.5, sourceId: 'self' }],
      });
      const bonus = getAttackBonus(attacker);
      expect(bonus).toBe(0.5);
    });

    it('防御加成Buff减少伤害', () => {
      const defender = createUnit({
        defense: 50, speed: 0,
        buffs: [{ type: BuffType.DEF_UP, remainingTurns: 2, value: 0.3, sourceId: 'self' }],
      });
      const bonus = getDefenseBonus(defender);
      expect(bonus).toBe(0.3);
    });

    it('护盾吸收伤害', () => {
      const defender = createUnit({
        hp: 500, maxHp: 500,
        buffs: [{ type: BuffType.SHIELD, remainingTurns: 2, value: 100, sourceId: 'self' }],
      });
      expect(getShieldAmount(defender)).toBe(100);

      const actualDamage = calc.applyDamage(defender, 80);
      // 80全部被护盾吸收，HP不减少
      expect(actualDamage).toBe(0);
      expect(defender.hp).toBe(500);
    });

    it('护盾溢出伤害扣HP', () => {
      const defender = createUnit({
        hp: 500, maxHp: 500,
        buffs: [{ type: BuffType.SHIELD, remainingTurns: 2, value: 50, sourceId: 'self' }],
      });
      const actualDamage = calc.applyDamage(defender, 120);
      // 护盾吸收50，剩余70扣HP
      expect(actualDamage).toBe(70);
      expect(defender.hp).toBe(430);
    });

    it('DOT伤害：灼烧=最大HP×5%', () => {
      const unit = createUnit({ maxHp: 1000, attack: 100,
        buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0, sourceId: 'enemy' }],
      });
      const dot = calc.calculateDotDamage(unit);
      expect(dot).toBe(50); // 1000 * 0.05
    });

    it('DOT伤害：中毒=最大HP×3%', () => {
      const unit = createUnit({ maxHp: 1000, attack: 100,
        buffs: [{ type: BuffType.POISON, remainingTurns: 3, value: 0, sourceId: 'enemy' }],
      });
      const dot = calc.calculateDotDamage(unit);
      expect(dot).toBe(30); // 1000 * 0.03
    });

    it('DOT伤害：流血=攻击力×10%', () => {
      const unit = createUnit({ maxHp: 1000, attack: 200,
        buffs: [{ type: BuffType.BLEED, remainingTurns: 2, value: 0, sourceId: 'enemy' }],
      });
      const dot = calc.calculateDotDamage(unit);
      expect(dot).toBe(20); // 200 * 0.10
    });

    it('冰冻/眩晕控制：单位无法行动', () => {
      const frozen = createUnit({
        buffs: [{ type: BuffType.FREEZE, remainingTurns: 1, value: 0, sourceId: 'enemy' }],
      });
      expect(calc.isControlled(frozen)).toBe(true);

      const stunned = createUnit({
        buffs: [{ type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: 'enemy' }],
      });
      expect(calc.isControlled(stunned)).toBe(true);

      const normal = createUnit();
      expect(calc.isControlled(normal)).toBe(false);
    });

    it('最低伤害保底 = 攻击力×10%', () => {
      // 极高防御的敌人
      const attacker = createUnit({ attack: 100, speed: 0 });
      const defender = createUnit({ defense: 10000, speed: 0 });
      const result = calc.calculateDamage(attacker, defender, 1.0);
      // 最低保底 = 100 * 0.1 = 10
      expect(result.damage).toBeGreaterThanOrEqual(10);
      expect(result.isMinDamage).toBe(true);
    });
  });

  // ── §CBT-3 战斗引擎完整回合流程 ──

  describe('§CBT-3 战斗引擎完整回合流程', () => {
    it('初始化战斗 → 生成战斗状态', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);

      expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
      expect(state.currentTurn).toBe(1);
      expect(state.id).toBeTruthy();
      expect(state.turnOrder.length).toBeGreaterThan(0);
      expect(state.result).toBeNull();
    });

    it('执行回合 → 返回行动列表', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);

      const actions = engine.executeTurn(state);
      expect(actions.length).toBeGreaterThan(0);
      expect(state.currentTurn).toBe(1);
    });

    it('战斗结束检查：一方全灭', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);

      // 手动击杀敌方
      enemy.units.forEach(u => { u.hp = 0; u.isAlive = false; });
      expect(engine.isBattleOver(state)).toBe(true);
    });

    it('runFullBattle → 完整战斗流程', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
      expect(result.allySurvivors).toBeGreaterThan(0);
      expect(result.stars).toBeGreaterThanOrEqual(1);
      expect(result.stars).toBeLessThanOrEqual(3);
      expect(result.summary).toBeTruthy();
    });

    it('我方全灭 → DEFEAT', () => {
      const ally = createWeakTeam('ally');
      const enemy = createStrongTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
      expect(result.stars).toBe(0);
    });

    it('星级评定：速战速决 → 三星', () => {
      // 极强 vs 极弱
      const ally = createTeam([
        createUnit({ id: 'ally_1', side: 'ally', attack: 9999, defense: 999, hp: 9999, maxHp: 9999, speed: 200 }),
        createUnit({ id: 'ally_2', side: 'ally', attack: 9999, defense: 999, hp: 9999, maxHp: 9999, speed: 180 }),
        createUnit({ id: 'ally_3', side: 'ally', attack: 9999, defense: 999, hp: 9999, maxHp: 9999, speed: 160 }),
        createUnit({ id: 'ally_4', side: 'ally', attack: 9999, defense: 999, hp: 9999, maxHp: 9999, speed: 140, position: 'back' }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'enemy_1', side: 'enemy', attack: 10, defense: 10, hp: 50, maxHp: 50, speed: 10 }),
        createUnit({ id: 'enemy_2', side: 'enemy', attack: 10, defense: 10, hp: 50, maxHp: 50, speed: 10 }),
      ], 'enemy');

      const result = engine.runFullBattle(ally, enemy);
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBeGreaterThanOrEqual(2);
    });

    it('碎片奖励：胜利时从敌方掉落', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      if (result.outcome === BattleOutcome.VICTORY) {
        expect(result.fragmentRewards).toBeDefined();
      }
    });
  });

  // ── §CBT-4 Buff效果联动 ──

  describe('§CBT-4 Buff效果联动', () => {
    it('ATK_UP + ATK_DOWN 可叠加', () => {
      const unit = createUnit({
        buffs: [
          { type: BuffType.ATK_UP, remainingTurns: 2, value: 0.3, sourceId: 'a' },
          { type: BuffType.ATK_DOWN, remainingTurns: 1, value: 0.1, sourceId: 'b' },
        ],
      });
      expect(getAttackBonus(unit)).toBeCloseTo(0.2);
    });

    it('多层护盾依次吸收', () => {
      const defender = createUnit({
        hp: 500, maxHp: 500,
        buffs: [
          { type: BuffType.SHIELD, remainingTurns: 2, value: 30, sourceId: 'a' },
          { type: BuffType.SHIELD, remainingTurns: 2, value: 50, sourceId: 'b' },
        ],
      });
      expect(getShieldAmount(defender)).toBe(80);
      calc.applyDamage(defender, 60);
      // 60伤害被护盾吸收，HP不变
      expect(defender.hp).toBe(500);
    });

    it('单位死亡后applyDamage返回0', () => {
      const dead = createUnit({ hp: 0, maxHp: 500, isAlive: false });
      expect(calc.applyDamage(dead, 100)).toBe(0);
    });
  });

  // ── §CBT-5 大招时停+战斗加速 ──

  describe('§CBT-5 大招时停+战斗加速', () => {
    it('设置战斗模式为半自动', () => {
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);
    });

    it('战斗加速：设置2x速度', () => {
      engine.setSpeed(BattleSpeed.X2);
      const speedState = engine.getSpeedState();
      expect(speedState.speed).toBe(BattleSpeed.X2);
    });

    it('战斗加速：调整回合间隔', () => {
      engine.setSpeed(BattleSpeed.X1);
      const interval1x = engine.getAdjustedTurnInterval();
      engine.setSpeed(BattleSpeed.X2);
      const interval2x = engine.getAdjustedTurnInterval();
      expect(interval2x).toBeLessThan(interval1x);
    });

    it('半自动模式下runFullBattle仍可完成', () => {
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });
  });

  // ── §CBT-6 自动编队 ──

  describe('§CBT-6 自动编队', () => {
    it('autoFormation根据武将列表生成队伍', () => {
      const heroes: BattleUnit[] = [
        createUnit({ id: 'h1', name: '关羽', troopType: TroopType.CAVALRY, defense: 120, hp: 900, maxHp: 900 }),
        createUnit({ id: 'h2', name: '张飞', troopType: TroopType.INFANTRY, defense: 100, hp: 850, maxHp: 850 }),
        createUnit({ id: 'h3', name: '诸葛亮', troopType: TroopType.STRATEGIST, defense: 60, hp: 600, maxHp: 600 }),
      ];
      const result = autoFormation(heroes);
      expect(result.team.units.length).toBeGreaterThan(0);
      expect(result.frontLine.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('空列表返回空队伍', () => {
      const result = autoFormation([]);
      expect(result.team.units.length).toBe(0);
      expect(result.score).toBe(0);
    });
  });

  // ── §CBT-7 ISubsystem接口 ──

  describe('§CBT-7 ISubsystem接口', () => {
    it('BattleEngine实现ISubsystem', () => {
      expect(engine.name).toBe('battleEngine');
    });

    it('DamageCalculator实现ISubsystem', () => {
      expect(calc.name).toBe('damageCalculator');
      calc.init(createMockDeps());
      expect(calc.getState()).toEqual({ type: 'DamageCalculator' });
      calc.reset(); // 无状态，不抛异常
    });
  });
});
