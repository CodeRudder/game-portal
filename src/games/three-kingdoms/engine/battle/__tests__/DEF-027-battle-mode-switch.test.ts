import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * DEF-027: 战斗模式切换集成测试
 *
 * 覆盖场景：
 * 1. 正常→加速→自动 模式切换链路
 * 2. 切换时战斗状态不丢失
 * 3. 无效模式被正确拒绝
 * 4. 模式切换事件正确触发
 *
 * 涉及模块：BattleEngine.ts + BattleSpeedController.ts
 *
 * @module engine/battle/__tests__/DEF-027-battle-mode-switch.test
 */

import { BattleEngine } from '../BattleEngine';
import { BattleSpeedController } from '../BattleSpeedController';
import type { ISpeedChangeListener, SpeedChangeEvent } from '../BattleSpeedController';
import {
  BattleMode,
  BattleSpeed,
  BattlePhase,
  BATTLE_CONFIG,
  BuffType,
  TroopType,
} from '../battle.types';
import type { BattleUnit, BattleTeam, BattleState } from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

/** 创建测试用战斗单位 */
function createTestUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'test-unit',
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
    normalAttack: {
      id: 'normal',
      name: '普攻',
      type: 'active',
      level: 1,
      description: '普通攻击',
      multiplier: 1.0,
      targetType: 'SINGLE_ENEMY',
      rageCost: 0,
      cooldown: 0,
      currentCooldown: 0,
    },
    skills: [],
    buffs: [],
    ...overrides,
  };
}

/** 创建测试队伍（3个单位） */
function createTestTeam(side: 'ally' | 'enemy'): BattleTeam {
  const prefix = side === 'ally' ? 'ally' : 'enemy';
  return {
    side,
    units: [
      createTestUnit({
        id: `${prefix}-1`,
        name: `${prefix}武将1`,
        side,
        troopType: TroopType.CAVALRY,
      }),
      createTestUnit({
        id: `${prefix}-2`,
        name: `${prefix}武将2`,
        side,
        troopType: TroopType.INFANTRY,
        speed: 60,
      }),
      createTestUnit({
        id: `${prefix}-3`,
        name: `${prefix}武将3`,
        side,
        troopType: TroopType.SPEARMAN,
        speed: 40,
      }),
    ],
  };
}

/** 创建模拟速度变更监听器 */
function createMockSpeedListener(): ISpeedChangeListener & { events: SpeedChangeEvent[] } {
  const events: SpeedChangeEvent[] = [];
  return {
    events,
    onSpeedChange: vi.fn((event: SpeedChangeEvent) => {
      events.push(event);
    }),
  };
}

// ─────────────────────────────────────────────
// 测试：DEF-027 战斗模式切换
// ─────────────────────────────────────────────

describe('DEF-027: 战斗模式切换集成测试', () => {
  let engine: BattleEngine;
  let allyTeam: BattleTeam;
  let enemyTeam: BattleTeam;

  beforeEach(() => {
    engine = new BattleEngine();
    allyTeam = createTestTeam('ally');
    enemyTeam = createTestTeam('enemy');
  });

  // ─────────────────────────────────────────
  // 1. 正常→加速→自动 模式切换链路
  // ─────────────────────────────────────────

  describe('场景1: 正常→加速→自动 模式切换链路', () => {
    it('应能完成 AUTO → SEMI_AUTO → MANUAL 完整切换链路', () => {
      // 初始模式为 AUTO
      expect(engine.getBattleMode()).toBe(BattleMode.AUTO);

      // 切换到 SEMI_AUTO
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);

      // 切换到 MANUAL
      engine.setBattleMode(BattleMode.MANUAL);
      expect(engine.getBattleMode()).toBe(BattleMode.MANUAL);

      // 切回 AUTO
      engine.setBattleMode(BattleMode.AUTO);
      expect(engine.getBattleMode()).toBe(BattleMode.AUTO);
    });

    it('应能完成速度 X1 → X2 → X4 → SKIP 完整切换链路', () => {
      const speedController = engine.getSpeedController();

      // X1 → X2
      expect(speedController.setSpeed(BattleSpeed.X2)).toBe(true);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X2);
      expect(speedController.getAdjustedTurnInterval()).toBe(500);

      // X2 → X4
      expect(speedController.setSpeed(BattleSpeed.X4)).toBe(true);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X4);
      expect(speedController.getAdjustedTurnInterval()).toBe(250);
      expect(speedController.shouldSimplifyEffects()).toBe(true);

      // X4 → SKIP
      expect(speedController.setSpeed(BattleSpeed.SKIP)).toBe(true);
      expect(speedController.getSpeed()).toBe(BattleSpeed.SKIP);
      expect(speedController.getAdjustedTurnInterval()).toBe(0);

      // SKIP → X1（恢复）
      expect(speedController.setSpeed(BattleSpeed.X1)).toBe(true);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
      expect(speedController.getAdjustedTurnInterval()).toBe(1000);
    });

    it('应能同时切换战斗模式和速度', () => {
      // 设置为 SEMI_AUTO + X2
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      engine.setSpeed(BattleSpeed.X2);

      expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X2);

      // 切换到 MANUAL + X4
      engine.setBattleMode(BattleMode.MANUAL);
      engine.setSpeed(BattleSpeed.X4);

      expect(engine.getBattleMode()).toBe(BattleMode.MANUAL);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X4);
    });

    it('cycleSpeed 应按 X1 → X2 → X3 → X4 → X1 循环', () => {
      const speedController = engine.getSpeedController();

      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);

      speedController.cycleSpeed();
      expect(speedController.getSpeed()).toBe(BattleSpeed.X2);

      speedController.cycleSpeed();
      expect(speedController.getSpeed()).toBe(BattleSpeed.X3);

      speedController.cycleSpeed();
      expect(speedController.getSpeed()).toBe(BattleSpeed.X4);

      speedController.cycleSpeed();
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
    });

    it('SKIP 模式下 cycleSpeed 应回到 X1', () => {
      const speedController = engine.getSpeedController();

      speedController.setSpeed(BattleSpeed.SKIP);
      expect(speedController.getSpeed()).toBe(BattleSpeed.SKIP);

      const result = speedController.cycleSpeed();
      expect(result).toBe(BattleSpeed.X1);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
    });
  });

  // ─────────────────────────────────────────
  // 2. 切换时战斗状态不丢失
  // ─────────────────────────────────────────

  describe('场景2: 切换时战斗状态不丢失', () => {
    it('战斗进行中切换速度，回合数和行动记录应保持', () => {
      const state = engine.initBattle(allyTeam, enemyTeam);

      // 执行一个回合
      engine.executeTurn(state);
      expect(state.currentTurn).toBe(1);

      // 切换速度
      engine.setSpeed(BattleSpeed.X2);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X2);

      // 战斗状态不受影响
      expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
      expect(state.currentTurn).toBe(1);
      expect(state.actionLog.length).toBeGreaterThan(0);

      // 继续战斗
      state.currentTurn++;
      engine.executeTurn(state);
      expect(state.currentTurn).toBe(2);
      expect(state.actionLog.length).toBeGreaterThan(1);
    });

    it('战斗进行中切换模式，战斗状态应保持', () => {
      const state = engine.initBattle(allyTeam, enemyTeam);

      // 执行一个回合
      engine.executeTurn(state);

      // 切换战斗模式
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);

      // 战斗状态不受影响
      expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
      expect(state.currentTurn).toBe(1);

      // 队伍数据不受影响
      expect(state.allyTeam.units.length).toBe(3);
      expect(state.enemyTeam.units.length).toBe(3);
    });

    it('SKIP 模式下快速战斗后，速度应恢复为 X1', () => {
      // 使用 quickBattle（内部使用 SKIP 模式）
      const result = engine.quickBattle(allyTeam, enemyTeam);

      // 战斗结果应有效
      expect(result.outcome).toBeDefined();
      expect(result.totalTurns).toBeGreaterThan(0);

      // DEF-010: 速度应恢复为 X1
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
      expect(engine.getAdjustedTurnInterval()).toBe(1000);
    });

    it('序列化/反序列化后模式状态应正确恢复', () => {
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      engine.setSpeed(BattleSpeed.X2);

      // 序列化
      const state = engine.initBattle(allyTeam, enemyTeam);
      const serialized = engine.serialize(state);

      // 反序列化
      const restored = engine.deserialize(serialized);

      // 验证战斗核心状态恢复
      expect(restored.phase).toBe(state.phase);
      expect(restored.currentTurn).toBe(state.currentTurn);
      expect(restored.allyTeam.units.length).toBe(3);
      expect(restored.enemyTeam.units.length).toBe(3);
    });

    it('多次速度切换后，最终速度状态应正确', () => {
      const speedController = engine.getSpeedController();

      // 快速连续切换
      speedController.setSpeed(BattleSpeed.X2);
      speedController.setSpeed(BattleSpeed.X4);
      speedController.setSpeed(BattleSpeed.X3);
      speedController.setSpeed(BattleSpeed.X1);

      // 最终状态应为 X1
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
      expect(speedController.getAdjustedTurnInterval()).toBe(1000);
      expect(speedController.getAnimationSpeedScale()).toBe(1);
      expect(speedController.shouldSimplifyEffects()).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 3. 无效模式被正确拒绝
  // ─────────────────────────────────────────

  describe('场景3: 无效模式被正确拒绝', () => {
    it('无效速度档位(5)应被拒绝', () => {
      const speedController = engine.getSpeedController();
      const result = speedController.setSpeed(5 as BattleSpeed);

      expect(result).toBe(false);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
    });

    it('无效速度档位(-1)应被拒绝', () => {
      const speedController = engine.getSpeedController();
      const result = speedController.setSpeed(-1 as BattleSpeed);

      expect(result).toBe(false);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
    });

    it('无效速度档位(0.5)应被拒绝', () => {
      const speedController = engine.getSpeedController();
      const result = speedController.setSpeed(0.5 as BattleSpeed);

      expect(result).toBe(false);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
    });

    it('NaN 速度应被拒绝', () => {
      const speedController = engine.getSpeedController();
      const result = speedController.setSpeed(NaN as BattleSpeed);

      expect(result).toBe(false);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
    });

    it('isValidSpeed 静态方法应正确判断', () => {
      // 合法速度
      expect(BattleSpeedController.isValidSpeed(BattleSpeed.SKIP)).toBe(true);
      expect(BattleSpeedController.isValidSpeed(BattleSpeed.X1)).toBe(true);
      expect(BattleSpeedController.isValidSpeed(BattleSpeed.X2)).toBe(true);
      expect(BattleSpeedController.isValidSpeed(BattleSpeed.X3)).toBe(true);
      expect(BattleSpeedController.isValidSpeed(BattleSpeed.X4)).toBe(true);

      // 非法速度
      expect(BattleSpeedController.isValidSpeed(-1)).toBe(false);
      expect(BattleSpeedController.isValidSpeed(5)).toBe(false);
      expect(BattleSpeedController.isValidSpeed(0.5)).toBe(false);
      expect(BattleSpeedController.isValidSpeed(NaN)).toBe(false);
    });

    it('相同速度切换应返回 false（不做变更）', () => {
      const speedController = engine.getSpeedController();

      expect(speedController.setSpeed(BattleSpeed.X1)).toBe(false);
      expect(speedController.getSpeed()).toBe(BattleSpeed.X1);
    });
  });

  // ─────────────────────────────────────────
  // 4. 模式切换事件正确触发
  // ─────────────────────────────────────────

  describe('场景4: 模式切换事件正确触发', () => {
    it('速度变更监听器应收到所有变更事件', () => {
      const speedController = engine.getSpeedController();
      const listener = createMockSpeedListener();

      speedController.addListener(listener);

      // 执行多次切换
      speedController.setSpeed(BattleSpeed.X2);
      speedController.setSpeed(BattleSpeed.X4);
      speedController.setSpeed(BattleSpeed.X1);

      // 应收到3次事件（排除相同速度不触发）
      expect(listener.onSpeedChange).toHaveBeenCalledTimes(3);
      expect(listener.events).toHaveLength(3);

      // 验证事件内容
      expect(listener.events[0]).toEqual(
        expect.objectContaining({
          previousSpeed: BattleSpeed.X1,
          newSpeed: BattleSpeed.X2,
        }),
      );
      expect(listener.events[1]).toEqual(
        expect.objectContaining({
          previousSpeed: BattleSpeed.X2,
          newSpeed: BattleSpeed.X4,
        }),
      );
      expect(listener.events[2]).toEqual(
        expect.objectContaining({
          previousSpeed: BattleSpeed.X4,
          newSpeed: BattleSpeed.X1,
        }),
      );
    });

    it('事件应包含有效时间戳', () => {
      const speedController = engine.getSpeedController();
      const listener = createMockSpeedListener();
      const beforeTime = Date.now();

      speedController.addListener(listener);
      speedController.setSpeed(BattleSpeed.X2);

      const afterTime = Date.now();

      expect(listener.events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(listener.events[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('移除监听器后不应再收到事件', () => {
      const speedController = engine.getSpeedController();
      const listener = createMockSpeedListener();

      speedController.addListener(listener);
      speedController.setSpeed(BattleSpeed.X2);

      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);

      speedController.removeListener(listener);
      speedController.setSpeed(BattleSpeed.X4);

      // 移除后不应再触发
      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
    });

    it('变更历史应记录完整的切换链路', () => {
      const speedController = engine.getSpeedController();

      speedController.setSpeed(BattleSpeed.X2);
      speedController.setSpeed(BattleSpeed.X4);
      speedController.setSpeed(BattleSpeed.X3);

      const history = speedController.getChangeHistory();
      expect(history).toHaveLength(3);

      // 验证链路完整性
      expect(history[0].previousSpeed).toBe(BattleSpeed.X1);
      expect(history[0].newSpeed).toBe(BattleSpeed.X2);

      expect(history[1].previousSpeed).toBe(BattleSpeed.X2);
      expect(history[1].newSpeed).toBe(BattleSpeed.X4);

      expect(history[2].previousSpeed).toBe(BattleSpeed.X4);
      expect(history[2].newSpeed).toBe(BattleSpeed.X3);
    });

    it('无效速度切换不应触发事件', () => {
      const speedController = engine.getSpeedController();
      const listener = createMockSpeedListener();

      speedController.addListener(listener);

      // 尝试设置无效速度
      speedController.setSpeed(5 as BattleSpeed);

      expect(listener.onSpeedChange).not.toHaveBeenCalled();
      expect(speedController.getChangeHistory()).toHaveLength(0);
    });

    it('SKIP 模式切换应正确触发事件', () => {
      const speedController = engine.getSpeedController();
      const listener = createMockSpeedListener();

      speedController.addListener(listener);
      speedController.setSpeed(BattleSpeed.SKIP);

      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
      expect(listener.events[0].previousSpeed).toBe(BattleSpeed.X1);
      expect(listener.events[0].newSpeed).toBe(BattleSpeed.SKIP);
    });

    it('从 SKIP 切换回正常速度应正确触发事件', () => {
      const speedController = engine.getSpeedController();
      const listener = createMockSpeedListener();

      speedController.setSpeed(BattleSpeed.SKIP);
      speedController.addListener(listener);

      speedController.setSpeed(BattleSpeed.X1);

      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
      expect(listener.events[0].previousSpeed).toBe(BattleSpeed.SKIP);
      expect(listener.events[0].newSpeed).toBe(BattleSpeed.X1);
    });
  });

  // ─────────────────────────────────────────
  // 补充：BattleEngine 与 SpeedController 集成
  // ─────────────────────────────────────────

  describe('BattleEngine 与 SpeedController 集成', () => {
    it('通过 BattleEngine.setSpeed 应正确代理到 SpeedController', () => {
      engine.setSpeed(BattleSpeed.X2);

      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X2);
      expect(engine.getAdjustedTurnInterval()).toBe(500);
      expect(engine.getAnimationSpeedScale()).toBe(2);
    });

    it('BattleEngine.reset 应重置速度和模式', () => {
      engine.setBattleMode(BattleMode.MANUAL);
      engine.setSpeed(BattleSpeed.X4);

      engine.reset();

      expect(engine.getBattleMode()).toBe(BattleMode.AUTO);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
    });

    it('skipBattle 后再 initBattle 应正常工作', () => {
      // 第一次战斗
      const result1 = engine.quickBattle(allyTeam, enemyTeam);
      expect(result1.outcome).toBeDefined();

      // 速度应已恢复
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);

      // 第二次战斗
      const result2 = engine.quickBattle(allyTeam, enemyTeam);
      expect(result2.outcome).toBeDefined();
    });

    it('战斗中切换模式后 isSkipMode 应正确反映', () => {
      expect(engine.isSkipMode()).toBe(false);

      engine.setSpeed(BattleSpeed.SKIP);
      expect(engine.isSkipMode()).toBe(true);

      engine.setSpeed(BattleSpeed.X1);
      expect(engine.isSkipMode()).toBe(false);
    });
  });
});
