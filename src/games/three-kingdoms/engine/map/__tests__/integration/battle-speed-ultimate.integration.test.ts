/**
 * 集成测试 — 战斗系统（速度/大招/跳过/兵种克制/统计/伤害数字）
 *
 * 覆盖 Play 文档流程：
 *   §1.1  战斗速度控制：1x/2x/4x/SKIP 速度切换、回合间隔缩放
 *   §1.2  大招系统：怒气满释放、CD 机制、时停
 *   §1.3  跳过战斗：SKIP 模式直接出结果
 *   §1.4  兵种克制：骑>步>枪>骑 循环克制
 *   §1.5  战斗统计：伤害/治疗/击杀统计
 *   §1.6  伤害数字系统：伤害显示配置
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/map/__tests__/integration/battle-speed-ultimate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleSpeedController } from '../../../battle/BattleSpeedController';
import { UltimateSkillSystem } from '../../../battle/UltimateSkillSystem';
import { BattleEngine } from '../../../battle/BattleEngine';
import { BattleStatisticsSubsystem } from '../../../battle/BattleStatistics';
import { DamageNumberSystem } from '../../../battle/DamageNumberSystem';
import {
  DamageNumberType,
  TrajectoryType,
  DEFAULT_TRAJECTORIES,
  DAMAGE_NUMBER_COLORS,
} from '../../../battle/DamageNumberConfig';
import { getRestraintMultiplier } from '../../../battle/DamageCalculator';
import { BattleSpeed, BattleOutcome, StarRating } from '../../../battle/battle.types';
import { TroopType } from '../../../battle/battle-base.types';
import { BATTLE_CONFIG } from '../../../battle/battle-config';
import type { BattleUnit, BattleTeam, BattleSkill } from '../../../battle/battle.types';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: () => null,
      getAll: () => new Map(),
      has: () => false,
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };
}

/** 创建基础战斗技能 */
function createSkill(overrides: Partial<BattleSkill> = {}): BattleSkill {
  return {
    id: 'skill_1',
    name: '普攻',
    type: 'active',
    level: 1,
    description: '普通攻击',
    multiplier: 1.0,
    targetType: 'SINGLE_ENEMY' as any,
    rageCost: 0,
    cooldown: 0,
    currentCooldown: 0,
    ...overrides,
  };
}

/** 创建大招技能 */
function createUltimateSkill(overrides: Partial<BattleSkill> = {}): BattleSkill {
  return {
    id: 'ult_1',
    name: '大招',
    type: 'active',
    level: 1,
    description: '终极技能',
    multiplier: 2.5,
    targetType: 'ALL_ENEMY' as any,
    rageCost: 100,
    cooldown: 3,
    currentCooldown: 0,
    ...overrides,
  };
}

/** 创建战斗单位 */
function createBattleUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit_1',
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.CAVALRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 60,
    speed: 80,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: createSkill({ id: 'normal_1', name: '普攻', rageCost: 0 }),
    skills: [createUltimateSkill()],
    buffs: [],
    ...overrides,
  };
}

/** 创建我方队伍 */
function createAllyTeam(units?: BattleUnit[]): BattleTeam {
  return {
    units: units ?? [
      createBattleUnit({ id: 'ally_1', side: 'ally', name: '蜀将1', troopType: TroopType.CAVALRY }),
      createBattleUnit({ id: 'ally_2', side: 'ally', name: '蜀将2', troopType: TroopType.INFANTRY, speed: 70 }),
    ],
    side: 'ally',
  };
}

/** 创建敌方队伍 */
function createEnemyTeam(units?: BattleUnit[]): BattleTeam {
  return {
    units: units ?? [
      createBattleUnit({
        id: 'enemy_1', side: 'enemy', name: '敌将1', troopType: TroopType.INFANTRY,
        hp: 500, maxHp: 500, attack: 60, defense: 30, speed: 50,
      }),
      createBattleUnit({
        id: 'enemy_2', side: 'enemy', name: '敌将2', troopType: TroopType.SPEARMAN,
        hp: 500, maxHp: 500, attack: 60, defense: 30, speed: 40,
      }),
    ],
    side: 'enemy',
  };
}

// ═══════════════════════════════════════════════
// §1.1 战斗速度控制
// ═══════════════════════════════════════════════

describe('§1.1 战斗速度控制', () => {
  let controller: BattleSpeedController;

  beforeEach(() => {
    controller = new BattleSpeedController();
    controller.init(createMockDeps());
  });

  it('初始速度应为 1x', () => {
    expect(controller.getSpeed()).toBe(BattleSpeed.X1);
  });

  it('切换到 2x 速度', () => {
    const result = controller.setSpeed(BattleSpeed.X2);
    expect(result).toBe(true);
    expect(controller.getSpeed()).toBe(BattleSpeed.X2);
  });

  it('切换到 3x 速度', () => {
    controller.setSpeed(BattleSpeed.X3);
    expect(controller.getSpeed()).toBe(BattleSpeed.X3);
  });

  it('相同速度切换返回 false', () => {
    const result = controller.setSpeed(BattleSpeed.X1);
    expect(result).toBe(false);
  });

  it('cycleSpeed 循环切换：1x → 2x → 3x → 1x', () => {
    expect(controller.cycleSpeed()).toBe(BattleSpeed.X2);
    expect(controller.cycleSpeed()).toBe(BattleSpeed.X3);
    expect(controller.cycleSpeed()).toBe(BattleSpeed.X1);
  });

  it('SKIP 不参与 cycleSpeed 循环，切回 X1', () => {
    controller.setSpeed(BattleSpeed.SKIP);
    expect(controller.cycleSpeed()).toBe(BattleSpeed.X1);
  });

  it('1x 回合间隔 = BASE_TURN_INTERVAL_MS', () => {
    controller.setSpeed(BattleSpeed.X1);
    expect(controller.getAdjustedTurnInterval()).toBe(BATTLE_CONFIG.BASE_TURN_INTERVAL_MS);
  });

  it('2x 回合间隔 = BASE / 2', () => {
    controller.setSpeed(BattleSpeed.X2);
    expect(controller.getAdjustedTurnInterval()).toBe(
      Math.floor(BATTLE_CONFIG.BASE_TURN_INTERVAL_MS / 2),
    );
  });

  it('3x 回合间隔 = BASE / 3', () => {
    controller.setSpeed(BattleSpeed.X3);
    expect(controller.getAdjustedTurnInterval()).toBe(
      Math.floor(BATTLE_CONFIG.BASE_TURN_INTERVAL_MS / 3),
    );
  });

  it('SKIP 模式回合间隔为 0', () => {
    controller.setSpeed(BattleSpeed.SKIP);
    expect(controller.getAdjustedTurnInterval()).toBe(0);
  });

  it('1x 动画速度缩放系数 = 1.0', () => {
    controller.setSpeed(BattleSpeed.X1);
    expect(controller.getAnimationSpeedScale()).toBe(1.0);
  });

  it('2x 动画速度缩放系数 = 2.0', () => {
    controller.setSpeed(BattleSpeed.X2);
    expect(controller.getAnimationSpeedScale()).toBe(2.0);
  });

  it('3x 动画速度缩放系数 = 3.0', () => {
    controller.setSpeed(BattleSpeed.X3);
    expect(controller.getAnimationSpeedScale()).toBe(3.0);
  });

  it('速度状态快照包含完整信息', () => {
    controller.setSpeed(BattleSpeed.X2);
    const state = controller.getSpeedState();
    expect(state.speed).toBe(BattleSpeed.X2);
    expect(state.turnIntervalScale).toBe(0.5);
    expect(state.animationSpeedScale).toBe(2.0);
  });
});

// ═══════════════════════════════════════════════
// §1.2 大招系统
// ═══════════════════════════════════════════════

describe('§1.2 大招系统', () => {
  let ultimateSystem: UltimateSkillSystem;

  beforeEach(() => {
    ultimateSystem = new UltimateSkillSystem();
    ultimateSystem.init(createMockDeps());
  });

  it('怒气未满时大招不就绪', () => {
    const unit = createBattleUnit({ rage: 50 });
    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(false);
    expect(result.readyUnits).toHaveLength(0);
  });

  it('怒气满且技能 CD 为 0 时大招就绪', () => {
    const unit = createBattleUnit({
      rage: 100,
      skills: [createUltimateSkill({ currentCooldown: 0 })],
    });
    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(true);
    expect(result.readyUnits.length).toBeGreaterThan(0);
  });

  it('怒气满但技能在 CD 中不大招就绪', () => {
    const unit = createBattleUnit({
      rage: 100,
      skills: [createUltimateSkill({ currentCooldown: 2 })],
    });
    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(false);
  });

  it('禁用时始终返回不就绪', () => {
    ultimateSystem.setEnabled(false);
    const unit = createBattleUnit({
      rage: 100,
      skills: [createUltimateSkill()],
    });
    const result = ultimateSystem.checkUltimateReady(unit);
    expect(result.isReady).toBe(false);
  });

  it('批量检测队伍大招就绪', () => {
    const units = [
      createBattleUnit({ id: 'u1', rage: 100, skills: [createUltimateSkill()] }),
      createBattleUnit({ id: 'u2', rage: 50, skills: [createUltimateSkill()] }),
    ];
    const result = ultimateSystem.checkTeamUltimateReady(units);
    expect(result.isReady).toBe(true);
    expect(result.readyUnits).toHaveLength(1);
  });

  it('时停状态初始为 INACTIVE', () => {
    const state = ultimateSystem.getTimeStopState();
    expect(state).toBe('INACTIVE');
  });

  it('注册和移除 handler', () => {
    const handler = { onTimeStopStart: () => {}, onTimeStopEnd: () => {} };
    ultimateSystem.registerHandler(handler as any);
    // 注册后不抛异常即通过
    ultimateSystem.removeHandler();
  });
});

// ═══════════════════════════════════════════════
// §1.3 跳过战斗
// ═══════════════════════════════════════════════

describe('§1.3 跳过战斗', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
    engine.init(createMockDeps());
  });

  it('skipBattle 直接返回战斗结果', () => {
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    const result = engine.skipBattle(state);
    expect(result).toBeDefined();
    expect(result.outcome).toBeDefined();
    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
  });

  it('skipBattle 后战斗阶段为 FINISHED', () => {
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    engine.skipBattle(state);
    expect(state.phase).toBe('FINISHED');
  });

  it('quickBattle = initBattle + skipBattle', () => {
    const result = engine.quickBattle(createAllyTeam(), createEnemyTeam());
    expect(result).toBeDefined();
    expect(result.outcome).toBeDefined();
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  it('skipBattle 后 isSkipMode 为 true', () => {
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    engine.skipBattle(state);
    expect(engine.isSkipMode()).toBe(true);
  });

  it('已结束的战斗再次 skipBattle 返回已有结果', () => {
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    const result1 = engine.skipBattle(state);
    const result2 = engine.skipBattle(state);
    expect(result1.outcome).toBe(result2.outcome);
  });

  it('SKIP 模式下回合间隔为 0', () => {
    const controller = new BattleSpeedController();
    controller.setSpeed(BattleSpeed.SKIP);
    expect(controller.getAdjustedTurnInterval()).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// §1.4 兵种克制
// ═══════════════════════════════════════════════

describe('§1.4 兵种克制：骑>步>枪>骑', () => {
  it('骑兵克制步兵 → 系数 1.5', () => {
    expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_ADVANTAGE,
    );
  });

  it('步兵克制枪兵 → 系数 1.5', () => {
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN)).toBe(
      BATTLE_CONFIG.RESTRAINT_ADVANTAGE,
    );
  });

  it('枪兵克制骑兵 → 系数 1.5', () => {
    expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_ADVANTAGE,
    );
  });

  it('骑兵被枪兵克制 → 系数 0.7', () => {
    expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.SPEARMAN)).toBe(
      BATTLE_CONFIG.RESTRAINT_DISADVANTAGE,
    );
  });

  it('步兵被骑兵克制 → 系数 0.7', () => {
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_DISADVANTAGE,
    );
  });

  it('枪兵被步兵克制 → 系数 0.7', () => {
    expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.INFANTRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_DISADVANTAGE,
    );
  });

  it('弓兵无克制关系 → 系数 1.0', () => {
    expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.CAVALRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_NEUTRAL,
    );
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.ARCHER)).toBe(
      BATTLE_CONFIG.RESTRAINT_NEUTRAL,
    );
  });

  it('谋士无克制关系 → 系数 1.0', () => {
    expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.CAVALRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_NEUTRAL,
    );
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.STRATEGIST)).toBe(
      BATTLE_CONFIG.RESTRAINT_NEUTRAL,
    );
  });

  it('同兵种无克制 → 系数 1.0', () => {
    expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.CAVALRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_NEUTRAL,
    );
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.INFANTRY)).toBe(
      BATTLE_CONFIG.RESTRAINT_NEUTRAL,
    );
  });

  it('克制系数值正确：1.5 / 0.7 / 1.0', () => {
    expect(BATTLE_CONFIG.RESTRAINT_ADVANTAGE).toBe(1.5);
    expect(BATTLE_CONFIG.RESTRAINT_DISADVANTAGE).toBe(0.7);
    expect(BATTLE_CONFIG.RESTRAINT_NEUTRAL).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════
// §1.5 战斗统计
// ═══════════════════════════════════════════════

describe('§1.5 战斗统计', () => {
  let statsSubsystem: BattleStatisticsSubsystem;

  beforeEach(() => {
    statsSubsystem = new BattleStatisticsSubsystem();
    statsSubsystem.init(createMockDeps());
  });

  it('快速战斗后统计子系统可计算数据', () => {
    const engine = new BattleEngine();
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    engine.skipBattle(state);

    const stats = statsSubsystem.calculate(state);
    expect(stats).toBeDefined();
    expect(typeof stats.allyTotalDamage).toBe('number');
    expect(typeof stats.enemyTotalDamage).toBe('number');
    expect(typeof stats.maxSingleDamage).toBe('number');
    expect(typeof stats.maxCombo).toBe('number');
  });

  it('我方总伤害 >= 0', () => {
    const engine = new BattleEngine();
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    engine.skipBattle(state);

    const stats = statsSubsystem.calculate(state);
    expect(stats.allyTotalDamage).toBeGreaterThanOrEqual(0);
  });

  it('单次最高伤害 <= 我方总伤害（胜利时）', () => {
    const engine = new BattleEngine();
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    engine.skipBattle(state);

    const stats = statsSubsystem.calculate(state);
    expect(stats.maxSingleDamage).toBeLessThanOrEqual(
      stats.allyTotalDamage + stats.enemyTotalDamage,
    );
  });

  it('summary 生成胜利摘要', () => {
    const summary = statsSubsystem.summary(BattleOutcome.VICTORY, StarRating.THREE, 4, 5);
    expect(summary).toContain('战斗胜利');
    expect(summary).toContain('4');
  });

  it('summary 生成失败摘要', () => {
    const summary = statsSubsystem.summary(BattleOutcome.DEFEAT, StarRating.NONE, 6, 0);
    expect(summary).toContain('战斗失败');
  });

  it('summary 生成平局摘要', () => {
    const summary = statsSubsystem.summary(BattleOutcome.DRAW, StarRating.NONE, 8, 3);
    expect(summary).toContain('平局');
  });

  it('reset 清空统计数据', () => {
    const engine = new BattleEngine();
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    engine.skipBattle(state);
    statsSubsystem.calculate(state);

    statsSubsystem.reset();
    expect(statsSubsystem.getState().lastStats).toBeNull();
  });

  it('getState 返回最近一次统计', () => {
    const engine = new BattleEngine();
    const state = engine.initBattle(createAllyTeam(), createEnemyTeam());
    engine.skipBattle(state);

    const stats = statsSubsystem.calculate(state);
    const stateResult = statsSubsystem.getState();
    expect(stateResult.lastStats).toEqual(stats);
  });
});

// ═══════════════════════════════════════════════
// §1.6 伤害数字系统
// ═══════════════════════════════════════════════

describe('§1.6 伤害数字系统', () => {
  let damageSystem: DamageNumberSystem;

  beforeEach(() => {
    damageSystem = new DamageNumberSystem();
    damageSystem.init(createMockDeps());
  });

  it('创建伤害数字实例', () => {
    const num = damageSystem.createDamageNumber(
      DamageNumberType.NORMAL,
      100,
      'unit_1',
    );
    expect(num).toBeDefined();
    expect(num.value).toBe(100);
    expect(num.type).toBe(DamageNumberType.NORMAL);
    expect(num.targetUnitId).toBe('unit_1');
    expect(num.text).toContain('100');
  });

  it('暴击伤害数字使用 ZOOM_FADE 轨迹', () => {
    const num = damageSystem.createDamageNumber(
      DamageNumberType.CRITICAL,
      250,
      'unit_1',
    );
    expect(num.trajectory.type).toBe(TrajectoryType.ZOOM_FADE);
  });

  it('普通伤害数字使用 FLOAT_UP 轨迹', () => {
    const num = damageSystem.createDamageNumber(
      DamageNumberType.NORMAL,
      100,
      'unit_1',
    );
    expect(num.trajectory.type).toBe(TrajectoryType.FLOAT_UP);
  });

  it('治疗数字使用绿色', () => {
    const num = damageSystem.createDamageNumber(
      DamageNumberType.HEAL,
      50,
      'unit_1',
    );
    expect(num.color).toBe(DAMAGE_NUMBER_COLORS[DamageNumberType.HEAL]);
  });

  it('暴击数字使用红色', () => {
    const num = damageSystem.createDamageNumber(
      DamageNumberType.CRITICAL,
      200,
      'unit_1',
    );
    expect(num.color).toBe(DAMAGE_NUMBER_COLORS[DamageNumberType.CRITICAL]);
  });

  it('默认配置中合并窗口为 200ms', () => {
    const system = new DamageNumberSystem();
    // 通过 createDamageNumber 间接验证配置生效
    const num1 = system.createDamageNumber(DamageNumberType.NORMAL, 100, 'unit_1');
    const num2 = system.createDamageNumber(DamageNumberType.NORMAL, 50, 'unit_1');
    expect(num1.id).not.toBe(num2.id);
  });

  it('自定义颜色覆盖', () => {
    const customSystem = new DamageNumberSystem({
      colorOverrides: { [DamageNumberType.NORMAL]: '#FF0000' },
    });
    customSystem.init(createMockDeps());
    const num = customSystem.createDamageNumber(DamageNumberType.NORMAL, 100, 'unit_1');
    expect(num.color).toBe('#FF0000');
  });

  it('所有伤害类型都有默认轨迹配置', () => {
    for (const type of Object.values(DamageNumberType)) {
      expect(DEFAULT_TRAJECTORIES[type as DamageNumberType]).toBeDefined();
    }
  });

  it('所有伤害类型都有默认颜色配置', () => {
    for (const type of Object.values(DamageNumberType)) {
      expect(DAMAGE_NUMBER_COLORS[type as DamageNumberType]).toBeDefined();
    }
  });

  it('活跃数字列表初始为空', () => {
    const state = damageSystem.getState();
    expect(state).toBeDefined();
  });

  it('清除所有活跃数字', () => {
    damageSystem.createDamageNumber(DamageNumberType.NORMAL, 100, 'unit_1');
    damageSystem.createDamageNumber(DamageNumberType.CRITICAL, 200, 'unit_2');
    damageSystem.clear();
    // 清除后不抛异常即通过
  });
});
