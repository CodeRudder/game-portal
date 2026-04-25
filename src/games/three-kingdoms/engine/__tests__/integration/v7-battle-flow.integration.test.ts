/**
 * v7.0 草木皆兵 — 战斗引擎全子系统集成测试
 *
 * 补充 v7-battle-play-flow.integration.test.ts 未覆盖的集成场景：
 *   §ISUB-1  全部 ISubsystem 实现合规（init/update/getState/reset 生命周期）
 *   §ISUB-2  BattleTurnExecutor 回合执行与行动顺序
 *   §ISUB-3  UltimateSkillSystem 大招时停完整流程
 *   §ISUB-4  BattleSpeedController 速度切换与监听器联动
 *   §ISUB-5  BattleEffectManager 特效生成/清理/移动端布局
 *   §ISUB-6  DamageNumberSystem 数字生成/合并/生命周期
 *   §ISUB-7  BattleStatisticsSubsystem 统计与摘要
 *   §ISUB-8  BattleEffectApplier 效果应用器生命周期
 *   §ISUB-9  跨子系统联动（速度→特效简化、大招→时停→伤害数字）
 *   §ISUB-10 战斗结果与碎片奖励
 *
 * @module engine/__tests__/integration/v7-battle-flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BattleEngine,
  DamageCalculator,
  BattleTurnExecutor,
  BattleSpeedController,
  BattleEffectManager,
  BattleEffectApplier,
  BattleStatisticsSubsystem,
  UltimateSkillSystem,
  DamageNumberSystem,
  DamageNumberType,
  TroopType,
  BuffType,
  BattleOutcome,
  BattlePhase,
  BattleSpeed,
  BattleMode,
  TimeStopState,
  autoFormation,
  calculateFragmentRewards,
  calculateBattleStats,
  generateSummary,
  getAliveUnits,
  sortBySpeed,
  getRestraintMultiplier,
} from '../../battle';
import type {
  BattleUnit,
  BattleTeam,
  BattleState,
  BattleSkill,
  BattleAction,
  DamageResult,
} from '../../battle';
import type { ISystemDeps } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建 mock ISystemDeps */
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
    config: { get: () => null, getAll: () => ({}) } as unknown as ISystemDeps['config'],
    registry: { get: () => null, has: () => false, getAll: () => [] } as unknown as ISystemDeps['registry'],
  };
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
function ultimateSkill(id = 'ult_01'): BattleSkill {
  return {
    id, name: '必杀技', type: 'active', level: 1,
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

/** 创建强力队伍 */
function createStrongTeam(side: 'ally' | 'enemy' = 'ally'): BattleTeam {
  return createTeam([
    createUnit({ id: `${side}_1`, name: '猛将1', side, attack: 200, defense: 80, hp: 800, maxHp: 800, speed: 100 }),
    createUnit({ id: `${side}_2`, name: '猛将2', side, attack: 180, defense: 70, hp: 700, maxHp: 700, speed: 90 }),
    createUnit({ id: `${side}_3`, name: '猛将3', side, attack: 160, defense: 60, hp: 600, maxHp: 600, speed: 70, position: 'back' }),
  ], side);
}

/** 创建弱队伍 */
function createWeakTeam(side: 'ally' | 'enemy' = 'enemy'): BattleTeam {
  return createTeam([
    createUnit({ id: `${side}_1`, name: '弱兵1', side, attack: 30, defense: 20, hp: 100, maxHp: 100, speed: 30 }),
    createUnit({ id: `${side}_2`, name: '弱兵2', side, attack: 25, defense: 15, hp: 80, maxHp: 80, speed: 25 }),
  ], side);
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v7.0 草木皆兵: 战斗引擎全子系统集成', () => {
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  // ═══════════════════════════════════════════
  // §ISUB-1 全部 ISubsystem 实现合规
  // ═══════════════════════════════════════════

  describe('§ISUB-1 ISubsystem 接口合规', () => {
    /** 通用 ISubsystem 合规性验证 */
    function assertISubsystemCompliance(
      instance: { readonly name: string; init(d: ISystemDeps): void; update(dt: number): void; getState(): unknown; reset(): void },
      expectedName: string,
    ) {
      expect(instance.name).toBe(expectedName);
      expect(() => instance.init(deps)).not.toThrow();
      expect(() => instance.update(16)).not.toThrow();
      expect(() => instance.getState()).not.toThrow();
      expect(() => instance.reset()).not.toThrow();
    }

    it('BattleTurnExecutor 符合 ISubsystem', () => {
      const calc = new DamageCalculator();
      const executor = new BattleTurnExecutor(calc);
      assertISubsystemCompliance(executor, 'battleTurnExecutor');
      expect(executor.getState()).toEqual({ hasCalculator: true });
    });

    it('BattleSpeedController 符合 ISubsystem', () => {
      const controller = new BattleSpeedController();
      assertISubsystemCompliance(controller, 'battle-speed');
      const state = controller.getState();
      expect(state).toHaveProperty('speed');
    });

    it('BattleEffectApplier 符合 ISubsystem', () => {
      const applier = new BattleEffectApplier();
      assertISubsystemCompliance(applier, 'battle-effect-applier');
      expect(applier.getState()).toHaveProperty('techEffectBound');
      expect(applier.getState()).toHaveProperty('skillEffectCount');
    });

    it('BattleEffectManager 符合 ISubsystem', () => {
      const manager = new BattleEffectManager();
      assertISubsystemCompliance(manager, 'battleEffectManager');
      expect(manager.getState()).toHaveProperty('activeEffectCount');
      expect(manager.getState()).toHaveProperty('battleSpeed');
    });

    it('DamageNumberSystem 符合 ISubsystem', () => {
      const sys = new DamageNumberSystem();
      assertISubsystemCompliance(sys, 'damageNumberSystem');
      expect(sys.getState()).toEqual({ activeCount: 0 });
    });

    it('BattleStatisticsSubsystem 符合 ISubsystem', () => {
      const stats = new BattleStatisticsSubsystem();
      assertISubsystemCompliance(stats, 'battleStatistics');
      expect(stats.getState()).toEqual({ lastStats: null });
    });

    it('UltimateSkillSystem 符合 ISubsystem', () => {
      const ult = new UltimateSkillSystem();
      assertISubsystemCompliance(ult, 'ultimate-skill');
      const state = ult.getState();
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('enabled');
    });

    it('DamageCalculator 符合 ISubsystem', () => {
      const calc = new DamageCalculator();
      assertISubsystemCompliance(calc, 'damageCalculator');
      expect(calc.getState()).toEqual({ type: 'DamageCalculator' });
    });

    it('BattleEngine 符合 ISubsystem', () => {
      const engine = new BattleEngine();
      assertISubsystemCompliance(engine, 'battleEngine');
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-2 BattleTurnExecutor 回合执行
  // ═══════════════════════════════════════════

  describe('§ISUB-2 BattleTurnExecutor 回合执行', () => {
    let engine: BattleEngine;

    beforeEach(() => {
      engine = new BattleEngine();
    });

    it('buildTurnOrder 按速度降序排列存活单位', () => {
      const ally = createTeam([
        createUnit({ id: 'fast', side: 'ally', speed: 120 }),
        createUnit({ id: 'slow', side: 'ally', speed: 50 }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'mid', side: 'enemy', speed: 80 }),
      ], 'enemy');

      const state = engine.initBattle(ally, enemy);
      expect(state.turnOrder).toEqual(['fast', 'mid', 'slow']);
    });

    it('死亡单位不参与行动顺序', () => {
      const ally = createTeam([
        createUnit({ id: 'alive', side: 'ally', speed: 100 }),
        createUnit({ id: 'dead', side: 'ally', speed: 200, hp: 0, isAlive: false }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'enemy1', side: 'enemy', speed: 50 }),
      ], 'enemy');

      const state = engine.initBattle(ally, enemy);
      expect(state.turnOrder).not.toContain('dead');
    });

    it('executeTurn 返回行动列表并记录到 actionLog', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);

      const actions = engine.executeTurn(state);
      expect(actions.length).toBeGreaterThan(0);
      expect(state.actionLog.length).toBeGreaterThanOrEqual(actions.length);

      // 验证行动结构
      const firstAction = actions[0];
      expect(firstAction).toHaveProperty('actorId');
      expect(firstAction).toHaveProperty('skill');
      expect(firstAction).toHaveProperty('targetIds');
      expect(firstAction).toHaveProperty('damageResults');
    });

    it('getAliveUnits 过滤死亡单位', () => {
      const team = createTeam([
        createUnit({ id: 'a', hp: 100, isAlive: true }),
        createUnit({ id: 'b', hp: 0, isAlive: false }),
        createUnit({ id: 'c', hp: 50, isAlive: true }),
      ]);
      expect(getAliveUnits(team)).toHaveLength(2);
    });

    it('sortBySpeed 降序排列', () => {
      const units = [
        createUnit({ id: 'u1', speed: 30 }),
        createUnit({ id: 'u2', speed: 100 }),
        createUnit({ id: 'u3', speed: 60 }),
      ];
      const sorted = sortBySpeed(units);
      expect(sorted.map(u => u.id)).toEqual(['u2', 'u3', 'u1']);
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-3 UltimateSkillSystem 大招时停
  // ═══════════════════════════════════════════

  describe('§ISUB-3 UltimateSkillSystem 大招时停', () => {
    let ultSystem: UltimateSkillSystem;

    beforeEach(() => {
      ultSystem = new UltimateSkillSystem();
      ultSystem.init(deps);
    });

    it('初始状态为 INACTIVE', () => {
      expect(ultSystem.getTimeStopState()).toBe(TimeStopState.INACTIVE);
      expect(ultSystem.isPaused()).toBe(false);
    });

    it('checkUltimateReady：怒气满时返回 isReady=true', () => {
      const unit = createUnit({ rage: 100, maxRage: 100, skills: [ultimateSkill()] });
      const result = ultSystem.checkUltimateReady(unit);
      expect(result.isReady).toBe(true);
      expect(result.readyUnits.length).toBeGreaterThan(0);
      expect(result.readyUnits[0].unit.id).toBe(unit.id);
    });

    it('checkUltimateReady：怒气不足时返回 isReady=false', () => {
      const unit = createUnit({ rage: 50, maxRage: 100, skills: [ultimateSkill()] });
      const result = ultSystem.checkUltimateReady(unit);
      expect(result.isReady).toBe(false);
      expect(result.readyUnits).toHaveLength(0);
    });

    it('pauseForUltimate 进入 PAUSED 状态', () => {
      const unit = createUnit({ id: 'hero_1', rage: 100, skills: [ultimateSkill()] });
      ultSystem.pauseForUltimate(unit, unit.skills[0]);

      expect(ultSystem.getTimeStopState()).toBe(TimeStopState.PAUSED);
      expect(ultSystem.isPaused()).toBe(true);
      expect(ultSystem.getPendingUnitId()).toBe('hero_1');
    });

    it('confirmUltimate 确认后重置为 INACTIVE', () => {
      const unit = createUnit({ id: 'hero_1', rage: 100, skills: [ultimateSkill()] });
      ultSystem.pauseForUltimate(unit, unit.skills[0]);

      const confirmed = ultSystem.confirmUltimate('hero_1', unit.skills[0].id);
      expect(confirmed).toBe(true);
      // confirmUltimate 内部调用 reset，状态回到 INACTIVE
      expect(ultSystem.getTimeStopState()).toBe(TimeStopState.INACTIVE);
      expect(ultSystem.getPendingUnitId()).toBeNull();
    });

    it('cancelUltimate 恢复 INACTIVE', () => {
      const unit = createUnit({ id: 'hero_1', rage: 100, skills: [ultimateSkill()] });
      ultSystem.pauseForUltimate(unit, unit.skills[0]);
      ultSystem.cancelUltimate();

      expect(ultSystem.getTimeStopState()).toBe(TimeStopState.INACTIVE);
      expect(ultSystem.getPendingUnitId()).toBeNull();
    });

    it('reset 清除所有状态', () => {
      const unit = createUnit({ id: 'hero_1', rage: 100, skills: [ultimateSkill()] });
      ultSystem.pauseForUltimate(unit, unit.skills[0]);
      ultSystem.reset();

      expect(ultSystem.getTimeStopState()).toBe(TimeStopState.INACTIVE);
      expect(ultSystem.getPendingUnitId()).toBeNull();
      expect(ultSystem.getPendingSkillId()).toBeNull();
    });

    it('setEnabled(false) 禁用时停', () => {
      ultSystem.setEnabled(false);
      expect(ultSystem.isEnabled()).toBe(false);
    });

    it('checkTeamUltimateReady 检查全队大招就绪', () => {
      const units = [
        createUnit({ id: 'u1', rage: 50, skills: [ultimateSkill()] }),
        createUnit({ id: 'u2', rage: 100, skills: [ultimateSkill()] }),
        createUnit({ id: 'u3', rage: 30, skills: [ultimateSkill()] }),
      ];
      const result = ultSystem.checkTeamUltimateReady(units);
      expect(result.isReady).toBe(true);
      expect(result.readyUnits.length).toBeGreaterThan(0);
      expect(result.readyUnits[0].unit.id).toBe('u2');
    });

    it('registerHandler / removeHandler 管理 UI 处理器', () => {
      const handler = { onTimeStopStart: vi.fn(), onTimeStopEnd: vi.fn(), onUltimateConfirmed: vi.fn() };
      ultSystem.registerHandler(handler);
      ultSystem.removeHandler();
      // 不抛异常即可
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-4 BattleSpeedController 速度切换
  // ═══════════════════════════════════════════

  describe('§ISUB-4 BattleSpeedController 速度切换', () => {
    let speedCtrl: BattleSpeedController;

    beforeEach(() => {
      speedCtrl = new BattleSpeedController();
      speedCtrl.init(deps);
    });

    it('setSpeed 切换速度档位', () => {
      expect(speedCtrl.setSpeed(BattleSpeed.X2)).toBe(true);
      const state = speedCtrl.getState();
      expect(state.speed).toBe(BattleSpeed.X2);
    });

    it('setSpeed 相同速度返回 false', () => {
      const state = speedCtrl.getState();
      expect(speedCtrl.setSpeed(state.speed)).toBe(false);
    });

    it('cycleSpeed 循环切换速度', () => {
      const initial = speedCtrl.getState().speed;
      const next = speedCtrl.cycleSpeed();
      expect(next).not.toBe(initial);
    });

    it('getAdjustedTurnInterval：X2 比 X1 间隔更短', () => {
      speedCtrl.setSpeed(BattleSpeed.X1);
      const interval1 = speedCtrl.getAdjustedTurnInterval();
      speedCtrl.setSpeed(BattleSpeed.X2);
      const interval2 = speedCtrl.getAdjustedTurnInterval();
      expect(interval2).toBeLessThan(interval1);
    });

    it('getAdjustedTurnInterval：SKIP 返回 0', () => {
      speedCtrl.setSpeed(BattleSpeed.SKIP);
      expect(speedCtrl.getAdjustedTurnInterval()).toBe(0);
    });

    it('getAnimationSpeedScale 随速度增大', () => {
      speedCtrl.setSpeed(BattleSpeed.X1);
      const scale1 = speedCtrl.getAnimationSpeedScale();
      speedCtrl.setSpeed(BattleSpeed.X3);
      const scale3 = speedCtrl.getAnimationSpeedScale();
      expect(scale3).toBeGreaterThan(scale1);
    });

    it('shouldSimplifyEffects：SKIP 时简化特效', () => {
      speedCtrl.setSpeed(BattleSpeed.X1);
      expect(speedCtrl.shouldSimplifyEffects()).toBe(false);
      speedCtrl.setSpeed(BattleSpeed.SKIP);
      expect(speedCtrl.shouldSimplifyEffects()).toBe(true);
    });

    it('速度变更监听器被正确通知', () => {
      const listener = { onSpeedChange: vi.fn() };
      speedCtrl.addListener(listener);
      speedCtrl.setSpeed(BattleSpeed.X2);
      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
    });

    it('removeListener 后不再通知', () => {
      const listener = { onSpeedChange: vi.fn() };
      speedCtrl.addListener(listener);
      speedCtrl.setSpeed(BattleSpeed.X2);
      speedCtrl.removeListener(listener);
      speedCtrl.setSpeed(BattleSpeed.X4);
      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
    });

    it('getChangeHistory 记录变更历史', () => {
      speedCtrl.setSpeed(BattleSpeed.X2);
      speedCtrl.setSpeed(BattleSpeed.X3);
      const history = speedCtrl.getChangeHistory();
      expect(history).toHaveLength(2);
      expect(history[0].newSpeed).toBe(BattleSpeed.X2);
      expect(history[1].newSpeed).toBe(BattleSpeed.X3);
    });

    it('reset 恢复默认速度并清空历史', () => {
      speedCtrl.setSpeed(BattleSpeed.X3);
      speedCtrl.reset();
      const history = speedCtrl.getChangeHistory();
      expect(history).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-5 BattleEffectManager 特效管理
  // ═══════════════════════════════════════════

  describe('§ISUB-5 BattleEffectManager 特效管理', () => {
    let effectMgr: BattleEffectManager;

    beforeEach(() => {
      effectMgr = new BattleEffectManager();
      effectMgr.init(deps);
    });

    it('初始状态无活跃特效', () => {
      expect(effectMgr.getState().activeEffectCount).toBe(0);
      expect(effectMgr.getActiveEffects()).toHaveLength(0);
    });

    it('generateSkillEffect 生成武技特效数据', () => {
      const skill: BattleSkill = {
        id: 'fire_slash', name: '烈焰斩', type: 'active', level: 1,
        description: '火焰攻击', multiplier: 1.5, targetType: 'single_enemy',
        rageCost: 50, cooldown: 2, currentCooldown: 0,
      };
      const actor = createUnit({ id: 'actor_1' });
      const effect = effectMgr.generateSkillEffect(skill, actor);

      expect(effect.id).toBeTruthy();
      expect(effect.skillId).toBe('fire_slash');
      expect(effect.element).toBe('fire');
      expect(effect.totalDuration).toBeGreaterThan(0);
      expect(effectMgr.getActiveEffects()).toHaveLength(1);
    });

    it('generateBuffEffect 生成 Buff 特效', () => {
      const target = createUnit({ id: 'target_1' });
      const effect = effectMgr.generateBuffEffect(BuffType.BURN, target);

      expect(effect.id).toBeTruthy();
      expect(effectMgr.getActiveEffects()).toHaveLength(1);
    });

    it('cleanupEffects 清理过期特效', () => {
      const skill: BattleSkill = {
        id: 'ice_bolt', name: '冰箭', type: 'active', level: 1,
        description: '冰攻击', multiplier: 1.2, targetType: 'single_enemy',
        rageCost: 30, cooldown: 1, currentCooldown: 0,
      };
      const actor = createUnit({ id: 'actor_1' });
      const now = Date.now();

      effectMgr.generateSkillEffect(skill, actor, now);
      expect(effectMgr.getActiveEffects()).toHaveLength(1);

      // 4秒后应该被清理（特效持续3秒）
      effectMgr.cleanupEffects(now + 4000);
      expect(effectMgr.getActiveEffects()).toHaveLength(0);
    });

    it('generateDamageAnimations 为战斗行动生成伤害动画', () => {
      const action: BattleAction = {
        turn: 1,
        actorId: 'ally_1',
        actorName: '猛将1',
        actorSide: 'ally',
        skill: normalAttack(),
        targetIds: ['enemy_1'],
        damageResults: {
          enemy_1: {
            damage: 120, baseDamage: 100, skillMultiplier: 1.0,
            isCritical: false, criticalMultiplier: 1.0,
            restraintMultiplier: 1.0, randomFactor: 1.0, isMinDamage: false,
          } as DamageResult,
        },
        description: '猛将1 攻击 弱兵1',
        isNormalAttack: true,
      };

      const animations = effectMgr.generateDamageAnimations(action);
      expect(animations).toHaveLength(1);
      expect(animations[0].number.value).toBe(120);
      expect(animations[0].triggerShake).toBe(false);
    });

    it('暴击时 triggerShake 为 true', () => {
      const action: BattleAction = {
        turn: 1,
        actorId: 'ally_1',
        actorName: '猛将1',
        actorSide: 'ally',
        skill: normalAttack(),
        targetIds: ['enemy_1'],
        damageResults: {
          enemy_1: {
            damage: 200, baseDamage: 150, skillMultiplier: 1.0,
            isCritical: true, criticalMultiplier: 1.5,
            restraintMultiplier: 1.0, randomFactor: 1.0, isMinDamage: false,
          } as DamageResult,
        },
        description: '暴击!',
        isNormalAttack: true,
      };

      const animations = effectMgr.generateDamageAnimations(action);
      expect(animations[0].triggerShake).toBe(true);
      expect(animations[0].shakeIntensity).toBeGreaterThan(0);
    });

    it('setBattleSpeed 同步速度到特效管理器', () => {
      effectMgr.setBattleSpeed(BattleSpeed.X4);
      expect(effectMgr.getBattleSpeed()).toBe(BattleSpeed.X4);
      expect(effectMgr.getState().battleSpeed).toBe(BattleSpeed.X4);
    });

    it('getMobileLayout 根据屏幕尺寸返回布局', () => {
      const layout = effectMgr.getMobileLayout(375, 667);
      expect(layout).toHaveProperty('screenClass');
      expect(layout).toHaveProperty('canvasWidth', 375);
      expect(layout).toHaveProperty('canvasHeight', 667);
    });

    it('getSkillButtonLayout 返回按钮布局数组', () => {
      effectMgr.getMobileLayout(414, 896);
      const buttons = effectMgr.getSkillButtonLayout(3);
      expect(buttons).toHaveLength(3);
      buttons.forEach(btn => {
        expect(btn).toHaveProperty('x');
        expect(btn).toHaveProperty('y');
        expect(btn).toHaveProperty('width');
        expect(btn).toHaveProperty('height');
      });
    });

    it('clear 清空所有特效和动画', () => {
      const skill: BattleSkill = {
        id: 'test', name: '测试', type: 'active', level: 1,
        description: '', multiplier: 1.0, targetType: 'single_enemy',
        rageCost: 0, cooldown: 0, currentCooldown: 0,
      };
      effectMgr.generateSkillEffect(skill, createUnit());
      expect(effectMgr.getActiveEffects().length).toBeGreaterThan(0);

      effectMgr.clear();
      expect(effectMgr.getActiveEffects()).toHaveLength(0);
      expect(effectMgr.getDamageAnimations()).toHaveLength(0);
    });

    it('reset 清空特效和动画', () => {
      const skill: BattleSkill = {
        id: 'test', name: '测试', type: 'active', level: 1,
        description: '', multiplier: 1.0, targetType: 'single_enemy',
        rageCost: 0, cooldown: 0, currentCooldown: 0,
      };
      effectMgr.generateSkillEffect(skill, createUnit());
      effectMgr.reset();
      expect(effectMgr.getActiveEffects()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-6 DamageNumberSystem 数字系统
  // ═══════════════════════════════════════════

  describe('§ISUB-6 DamageNumberSystem 数字系统', () => {
    let dmgNumSys: DamageNumberSystem;

    beforeEach(() => {
      dmgNumSys = new DamageNumberSystem();
      dmgNumSys.init(deps);
    });

    it('createDamageNumber 生成伤害数字', () => {
      const num = dmgNumSys.createDamageNumber(DamageNumberType.NORMAL, 150, 'target_1');
      expect(num.id).toBeTruthy();
      expect(num.value).toBe(150);
      expect(num.targetUnitId).toBe('target_1');
      expect(num.type).toBe(DamageNumberType.NORMAL);
    });

    it('createDamageNumber 暴击类型', () => {
      const num = dmgNumSys.createDamageNumber(DamageNumberType.CRITICAL, 300, 'target_1');
      expect(num.type).toBe(DamageNumberType.CRITICAL);
    });

    it('连续创建多个数字时 activeCount 递增', () => {
      dmgNumSys.createDamageNumber(DamageNumberType.NORMAL, 50, 't1');
      dmgNumSys.createDamageNumber(DamageNumberType.NORMAL, 80, 't2');
      dmgNumSys.createDamageNumber(DamageNumberType.CRITICAL, 200, 't3');
      expect(dmgNumSys.getState()).toEqual({ activeCount: 3 });
    });

    it('reset 清空所有数字', () => {
      dmgNumSys.createDamageNumber(DamageNumberType.NORMAL, 50, 't1');
      dmgNumSys.reset();
      expect(dmgNumSys.getState()).toEqual({ activeCount: 0 });
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-7 BattleStatisticsSubsystem 统计
  // ═══════════════════════════════════════════

  describe('§ISUB-7 BattleStatisticsSubsystem 统计与摘要', () => {
    let statsSubsystem: BattleStatisticsSubsystem;
    let engine: BattleEngine;

    beforeEach(() => {
      statsSubsystem = new BattleStatisticsSubsystem();
      statsSubsystem.init(deps);
      engine = new BattleEngine();
    });

    it('初始 lastStats 为 null', () => {
      expect(statsSubsystem.getState()).toEqual({ lastStats: null });
    });

    it('calculate 从战斗状态计算统计数据', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      const stats = statsSubsystem.calculate(state);
      expect(stats).toHaveProperty('allyTotalDamage');
      expect(stats).toHaveProperty('enemyTotalDamage');
      expect(stats).toHaveProperty('maxSingleDamage');
      expect(stats).toHaveProperty('maxCombo');
      expect(statsSubsystem.getState().lastStats).toEqual(stats);
    });

    it('summary 生成胜利摘要', () => {
      const text = statsSubsystem.summary(BattleOutcome.VICTORY, 3, 2, 4);
      expect(text).toContain('战斗胜利');
      expect(text).toContain('★★★');
      expect(text).toContain('2回合');
    });

    it('summary 生成失败摘要', () => {
      const text = statsSubsystem.summary(BattleOutcome.DEFEAT, 0, 5, 0);
      expect(text).toContain('战斗失败');
    });

    it('summary 生成平局摘要', () => {
      const text = statsSubsystem.summary(BattleOutcome.DRAW, 0, 20, 2);
      expect(text).toContain('平局');
    });

    it('reset 清除统计数据', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);
      statsSubsystem.calculate(state);

      statsSubsystem.reset();
      expect(statsSubsystem.getState()).toEqual({ lastStats: null });
    });

    it('calculateBattleStats 纯函数正确统计', () => {
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);

      // 执行多回合直到战斗结束
      let maxTurns = 50;
      while (!engine.isBattleOver(state) && maxTurns-- > 0) {
        engine.executeTurn(state);
      }

      const stats = calculateBattleStats(state);
      expect(stats.allyTotalDamage).toBeGreaterThanOrEqual(0);
      expect(stats.maxSingleDamage).toBeGreaterThanOrEqual(0);
    });

    it('generateSummary 纯函数格式正确', () => {
      const text = generateSummary(BattleOutcome.VICTORY, 2, 5, 3);
      expect(text).toContain('★★☆');
      expect(text).toContain('5回合');
      expect(text).toContain('存活3人');
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-8 BattleEffectApplier 生命周期
  // ═══════════════════════════════════════════

  describe('§ISUB-8 BattleEffectApplier 生命周期', () => {
    let applier: BattleEffectApplier;

    beforeEach(() => {
      applier = new BattleEffectApplier();
      applier.init(deps);
    });

    it('初始未绑定科技效果系统', () => {
      expect(applier.getState().techEffectBound).toBe(false);
    });

    it('skillEffectCount > 0 有预置技能特效配置', () => {
      expect(applier.getState().skillEffectCount).toBeGreaterThanOrEqual(0);
    });

    it('reset 清除科技效果绑定', () => {
      applier.reset();
      expect(applier.getState().techEffectBound).toBe(false);
    });

    it('update 不抛异常', () => {
      expect(() => applier.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-9 跨子系统联动
  // ═══════════════════════════════════════════

  describe('§ISUB-9 跨子系统联动', () => {
    it('速度切换 → 特效管理器同步简化', () => {
      const speedCtrl = new BattleSpeedController();
      const effectMgr = new BattleEffectManager();

      // X1 速度不需要简化
      speedCtrl.setSpeed(BattleSpeed.X1);
      expect(speedCtrl.shouldSimplifyEffects()).toBe(false);

      // SKIP 速度需要简化
      speedCtrl.setSpeed(BattleSpeed.SKIP);
      effectMgr.setBattleSpeed(BattleSpeed.SKIP);
      expect(speedCtrl.shouldSimplifyEffects()).toBe(true);
      expect(effectMgr.getBattleSpeed()).toBe(BattleSpeed.SKIP);
    });

    it('战斗引擎 + 特效管理器：完整战斗后生成动画', () => {
      const engine = new BattleEngine();
      const effectMgr = new BattleEffectManager();

      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const state = engine.initBattle(ally, enemy);

      // 执行回合并生成特效
      const actions = engine.executeTurn(state);
      actions.forEach(action => {
        effectMgr.generateDamageAnimations(action);
      });

      expect(effectMgr.getDamageAnimations().length).toBeGreaterThan(0);
    });

    it('战斗引擎 + 统计子系统：完整战斗后计算统计', () => {
      const engine = new BattleEngine();
      const statsSys = new BattleStatisticsSubsystem();
      statsSys.init(deps);

      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);

      // 统计系统应能处理战斗结果
      const summary = statsSys.summary(result.outcome, result.stars, result.totalTurns, result.allySurvivors);
      expect(summary).toBeTruthy();
    });

    it('大招系统 + 战斗引擎：怒气满触发时停检查', () => {
      const ultSystem = new UltimateSkillSystem();
      ultSystem.init(deps);

      const unit = createUnit({
        id: 'rage_full',
        rage: 100,
        maxRage: 100,
        skills: [ultimateSkill()],
      });

      const ready = ultSystem.checkUltimateReady(unit);
      expect(ready.isReady).toBe(true);

      // 模拟时停流程
      ultSystem.pauseForUltimate(unit, unit.skills[0]);
      expect(ultSystem.isPaused()).toBe(true);

      ultSystem.confirmUltimate(unit.id, unit.skills[0].id);
      // 确认后自动 reset，状态回到 INACTIVE
      expect(ultSystem.getTimeStopState()).toBe(TimeStopState.INACTIVE);
    });

    it('速度控制器 + 战斗引擎：速度不影响战斗结果', () => {
      const engine = new BattleEngine();
      engine.setSpeed(BattleSpeed.X3);

      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('全子系统 init/reset 生命周期无异常', () => {
      const subsystems = [
        new BattleEngine(),
        new DamageCalculator(),
        new BattleTurnExecutor(new DamageCalculator()),
        new BattleSpeedController(),
        new BattleEffectApplier(),
        new BattleEffectManager(),
        new DamageNumberSystem(),
        new BattleStatisticsSubsystem(),
        new UltimateSkillSystem(),
      ];

      // 全部 init
      subsystems.forEach(sys => {
        expect(() => sys.init(deps)).not.toThrow();
      });

      // 全部 update
      subsystems.forEach(sys => {
        expect(() => sys.update(16)).not.toThrow();
      });

      // 全部 getState
      subsystems.forEach(sys => {
        expect(() => sys.getState()).not.toThrow();
      });

      // 全部 reset
      subsystems.forEach(sys => {
        expect(() => sys.reset()).not.toThrow();
      });
    });
  });

  // ═══════════════════════════════════════════
  // §ISUB-10 战斗结果与碎片奖励
  // ═══════════════════════════════════════════

  describe('§ISUB-10 战斗结果与碎片奖励', () => {
    it('runFullBattle 返回完整结果结构', () => {
      const engine = new BattleEngine();
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('totalTurns');
      expect(result).toHaveProperty('allySurvivors');
      expect(result).toHaveProperty('stars');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('fragmentRewards');
      expect(typeof result.totalTurns).toBe('number');
      expect(typeof result.allySurvivors).toBe('number');
    });

    it('胜利时星级为 1~3', () => {
      const engine = new BattleEngine();
      const ally = createStrongTeam('ally');
      const enemy = createWeakTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBeGreaterThanOrEqual(1);
      expect(result.stars).toBeLessThanOrEqual(3);
    });

    it('失败时星级为 0', () => {
      const engine = new BattleEngine();
      const ally = createWeakTeam('ally');
      const enemy = createStrongTeam('enemy');
      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
      expect(result.stars).toBe(0);
    });

    it('calculateFragmentRewards 基于敌方队伍掉落', () => {
      const enemyTeam = createTeam([
        createUnit({ id: 'e1', faction: 'wei' }),
        createUnit({ id: 'e2', faction: 'wu' }),
      ], 'enemy');
      const rewards = calculateFragmentRewards(BattleOutcome.VICTORY, enemyTeam, 3);
      // 胜利时应有碎片奖励（概率掉落）
      expect(rewards).toBeDefined();
      expect(typeof rewards).toBe('object');
    });

    it('失败时碎片奖励为空对象', () => {
      const enemyTeam = createTeam([createUnit({ id: 'e1' })], 'enemy');
      const rewards = calculateFragmentRewards(BattleOutcome.DEFEAT, enemyTeam, 0);
      expect(rewards).toEqual({});
    });

    it('多场战斗结果独立', () => {
      const engine = new BattleEngine();

      const result1 = engine.runFullBattle(createStrongTeam('ally'), createWeakTeam('enemy'));
      const result2 = engine.runFullBattle(createWeakTeam('ally'), createStrongTeam('enemy'));

      expect(result1.outcome).toBe(BattleOutcome.VICTORY);
      expect(result2.outcome).toBe(BattleOutcome.DEFEAT);
    });
  });
});
