/**
 * SiegeBattleSystem 单元测试
 *
 * 覆盖：
 *   初始化 / 自定义配置
 *   创建战斗会话 / 策略修正 / 重复拒绝
 *   战斗更新（时间衰减、胜利判定、事件触发）
 *   取消战斗
 *   查询（活跃列表 / taskId）
 *   策略持续时间修正
 *   序列化/反序列化
 *   边界条件（dt=0 / reset / 默认城防值）
 *
 * @module engine/map/__tests__/SiegeBattleSystem.test
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  SiegeBattleSystem,
  STRATEGY_DURATION_MODIFIER,
  type BattleSession,
} from '../SiegeBattleSystem';
import type { ISystemDeps } from '../../../core/types';

// ─────────────────────────────────────────────
// 常量（与 SiegeBattleSystem DEFAULT_CONFIG 对齐）
// ─────────────────────────────────────────────

const DEFAULT_MIN_DURATION_MS = 10_000;
const DEFAULT_MAX_DURATION_MS = 60_000;
const DEFAULT_BASE_DURATION_MS = 15_000;
const DEFAULT_BASE_DEFENSE_VALUE = 100;

// ─────────────────────────────────────────────
// Mock 工具
// ─────────────────────────────────────────────

const createMockDeps = (): ISystemDeps => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    once: vi.fn(() => () => {}),
    removeAllListeners: vi.fn(),
  } as any,
  config: { get: vi.fn(), set: vi.fn() } as any,
  registry: { get: vi.fn(() => null) } as any,
});

// ============================================================
// 测试
// ============================================================

describe('SiegeBattleSystem', () => {
  let system: SiegeBattleSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new SiegeBattleSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ────────────────────────────────────────────
  // 初始化
  // ────────────────────────────────────────────

  describe('初始化', () => {
    it('应正确初始化', () => {
      const sys = new SiegeBattleSystem();
      sys.init(createMockDeps());
      expect(sys.name).toBe('siegeBattle');
      expect(sys.getState().activeBattles).toHaveLength(0);
    });

    it('应使用自定义配置', () => {
      const sys = new SiegeBattleSystem({ baseDurationMs: 20000, baseDefenseValue: 200 });
      sys.init(createMockDeps());

      const battle = sys.createBattle({
        taskId: 't1',
        targetId: 'city-xuchang',
        troops: 1000,
        strategy: 'forceAttack',
        targetDefenseLevel: 1,
        targetX: 10,
        targetY: 20,
        faction: 'wei',
      });

      // baseDefenseValue=200, level=1 => maxDefense=200
      expect(battle.maxDefense).toBe(200);
      // baseDurationMs=20000 + forceAttack(-5000) = 15000, clamped to [10000,60000] => 15000
      expect(battle.estimatedDurationMs).toBe(15000);
    });
  });

  // ────────────────────────────────────────────
  // 创建战斗
  // ────────────────────────────────────────────

  describe('创建战斗', () => {
    it('应创建战斗会话', () => {
      const battle = system.createBattle({
        taskId: 'task-001',
        targetId: 'city-luoyang',
        troops: 5000,
        strategy: 'forceAttack',
        targetX: 25,
        targetY: 15,
        faction: 'wei',
      });

      expect(battle).toBeDefined();
      expect(battle.taskId).toBe('task-001');
      expect(battle.targetId).toBe('city-luoyang');
      expect(battle.troops).toBe(5000);
      expect(battle.strategy).toBe('forceAttack');
      expect(battle.status).toBe('active');
      expect(battle.victory).toBeNull();
      expect(battle.elapsedMs).toBe(0);
      // attackPower should exist and be calculated
      expect(battle.attackPower).toBeDefined();
      expect(typeof battle.attackPower).toBe('number');

      // Should emit battle:started event with new fields
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'battle:started',
        expect.objectContaining({
          taskId: 'task-001',
          targetId: 'city-luoyang',
          strategy: 'forceAttack',
          troops: 5000,
          maxDefense: battle.maxDefense,
          estimatedDurationMs: battle.estimatedDurationMs,
          targetX: 25,
          targetY: 15,
          faction: 'wei',
        }),
      );
    });

    it('应根据策略计算不同战斗时间', () => {
      const b1 = system.createBattle({
        taskId: 't-force',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      const b2 = system.createBattle({
        taskId: 't-siege',
        targetId: 'target-2',
        troops: 1000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'shu',
      });

      // siege(+15000) > forceAttack(-5000)
      expect(b2.estimatedDurationMs).toBeGreaterThan(b1.estimatedDurationMs);
    });

    it('应限制战斗时间在[min, max]范围内', () => {
      // siege: base 15000 + 15000 = 30000, 在 [10000, 60000] 内
      const siegeBattle = system.createBattle({
        taskId: 't-siege',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      expect(siegeBattle.estimatedDurationMs).toBeGreaterThanOrEqual(DEFAULT_MIN_DURATION_MS);
      expect(siegeBattle.estimatedDurationMs).toBeLessThanOrEqual(DEFAULT_MAX_DURATION_MS);

      // forceAttack: base 15000 - 5000 = 10000, 在边界
      const forceBattle = system.createBattle({
        taskId: 't-force',
        targetId: 'target-2',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      expect(forceBattle.estimatedDurationMs).toBeGreaterThanOrEqual(DEFAULT_MIN_DURATION_MS);
    });

    it('应根据城防等级计算初始城防值', () => {
      const battle = system.createBattle({
        taskId: 't-def',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetDefenseLevel: 5,
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      // baseDefenseValue(100) * level(5) = 500
      expect(battle.defenseValue).toBe(500);
      expect(battle.maxDefense).toBe(500);
      // attackPower = maxDefense / (estimatedDurationMs / 1000)
      // forceAttack: 15000 - 5000 = 10000ms => 10s
      // attackPower = 500 / 10 = 50
      expect(battle.attackPower).toBe(50);
    });

    it('应拒绝重复创建同一taskId的战斗', () => {
      system.createBattle({
        taskId: 't-dup',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      expect(() =>
        system.createBattle({
          taskId: 't-dup',
          targetId: 'target-2',
          troops: 2000,
          strategy: 'siege',
          targetX: 0,
          targetY: 0,
          faction: 'wei',
        }),
      ).toThrow(/already exists/);
    });
  });

  // ────────────────────────────────────────────
  // 战斗更新
  // ────────────────────────────────────────────

  describe('战斗更新', () => {
    it('应按时间衰减城防值', () => {
      const battle = system.createBattle({
        taskId: 't-decay',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'siege',
        targetDefenseLevel: 1,
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      const initialDefense = battle.defenseValue;
      // siege: 15000 + 15000 = 30000ms estimated
      const durationSec = battle.estimatedDurationMs / 1000; // 30s

      // attackPower = maxDefense / durationSeconds = 100 / 30 = 3.333...
      // 推进一半时间 (15s): defenseDelta = attackPower * dt = 3.333 * 15 = 50
      // defenseValue = 100 - 50 = 50
      system.update(durationSec / 2);
      expect(battle.defenseValue).toBeLessThan(initialDefense);
      expect(battle.defenseValue).toBeGreaterThan(0);
    });

    it('应在城防值降为0时标记胜利完成', () => {
      system.createBattle({
        taskId: 't-victory',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetDefenseLevel: 1,
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      // forceAttack: 15000 - 5000 = 10000ms, attackPower = 100/10 = 10
      // Push past estimated duration to ensure completion
      const durationSec = 10 + 1; // 11s
      system.update(durationSec);

      // After completion, battle is DELETED from the map
      const battle = system.getBattle('t-victory');
      expect(battle).toBeNull();

      // Check completion via emitted event
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'battle:completed',
        expect.objectContaining({
          taskId: 't-victory',
          targetId: 'target-1',
          victory: true,
        }),
      );
    });

    it('应在达到预估时间时结束战斗', () => {
      system.createBattle({
        taskId: 't-timeup',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      // forceAttack: 10000ms
      const durationSec = 10;
      system.update(durationSec);

      // After completion, battle is DELETED from the map
      const battle = system.getBattle('t-timeup');
      expect(battle).toBeNull();

      // Check completion via emitted event
      const completedCalls = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: any[]) => call[0] === 'battle:completed',
      );
      expect(completedCalls).toHaveLength(1);
      expect(completedCalls[0][1]).toEqual(
        expect.objectContaining({
          taskId: 't-timeup',
          targetId: 'target-1',
          victory: true,
        }),
      );
    });

    it('应在update中累加elapsed时间', () => {
      const battle = system.createBattle({
        taskId: 't-elapsed',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      system.update(5); // 5 秒 = 5000ms
      expect(battle.elapsedMs).toBe(5000);

      system.update(3); // 再 3 秒 = 3000ms
      expect(battle.elapsedMs).toBe(8000);
    });

    it('应在战斗完成时emit battle:completed', () => {
      system.createBattle({
        taskId: 't-emit',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      const durationSec = (DEFAULT_BASE_DURATION_MS + STRATEGY_DURATION_MODIFIER.forceAttack) / 1000;
      system.update(durationSec + 1);

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'battle:completed',
        expect.objectContaining({
          taskId: 't-emit',
          targetId: 'target-1',
          victory: true,
          strategy: 'forceAttack',
          troops: 1000,
          elapsedMs: expect.any(Number),
          remainingDefense: expect.any(Number),
        }),
      );
    });
  });

  // ────────────────────────────────────────────
  // 取消战斗
  // ────────────────────────────────────────────

  describe('取消战斗', () => {
    it('应取消活跃战斗', () => {
      system.createBattle({
        taskId: 't-cancel',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      system.cancelBattle('t-cancel');

      // After cancel, battle is DELETED from the map
      const battle = system.getBattle('t-cancel');
      expect(battle).toBeNull();
    });

    it('取消时应emit battle:cancelled', () => {
      system.createBattle({
        taskId: 't-cancel-emit',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      system.cancelBattle('t-cancel-emit');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'battle:cancelled',
        expect.objectContaining({
          taskId: 't-cancel-emit',
          targetId: 'target-1',
          strategy: 'forceAttack',
          elapsedMs: 0,
        }),
      );
    });

    it('取消不存在的战斗应安全处理', () => {
      expect(() => system.cancelBattle('non-existent')).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // 查询
  // ────────────────────────────────────────────

  describe('查询', () => {
    it('应返回活跃战斗列表', () => {
      system.createBattle({
        taskId: 't-active-1',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      system.createBattle({
        taskId: 't-active-2',
        targetId: 'target-2',
        troops: 2000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      const state = system.getState();
      expect(state.activeBattles).toHaveLength(2);
      expect(state.activeBattles.map((b) => b.taskId).sort()).toEqual(['t-active-1', 't-active-2']);
    });

    it('应通过taskId查询战斗', () => {
      system.createBattle({
        taskId: 't-query',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      const battle = system.getBattle('t-query');
      expect(battle).not.toBeNull();
      expect(battle!.taskId).toBe('t-query');

      const notFound = system.getBattle('non-existent');
      expect(notFound).toBeNull();
    });
  });

  // ────────────────────────────────────────────
  // 策略修正
  // ────────────────────────────────────────────

  describe('策略修正', () => {
    it('forceAttack策略应缩短战斗时间(-5s)', () => {
      const battle = system.createBattle({
        taskId: 't-force',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      // baseDurationMs(15000) + modifier(-5000) = 10000
      expect(battle.estimatedDurationMs).toBe(10000);
    });

    it('siege策略应延长战斗时间(+15s)', () => {
      const battle = system.createBattle({
        taskId: 't-siege',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      // baseDurationMs(15000) + modifier(15000) = 30000
      expect(battle.estimatedDurationMs).toBe(30000);
    });

    it('nightRaid策略应缩短战斗时间(-3s)', () => {
      const battle = system.createBattle({
        taskId: 't-night',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'nightRaid',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      // baseDurationMs(15000) + modifier(-3000) = 12000
      expect(battle.estimatedDurationMs).toBe(12000);
    });

    it('insider策略应延长战斗时间(+5s)', () => {
      const battle = system.createBattle({
        taskId: 't-insider',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'insider',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      // baseDurationMs(15000) + modifier(5000) = 20000
      expect(battle.estimatedDurationMs).toBe(20000);
    });
  });

  // ────────────────────────────────────────────
  // 序列化
  // ────────────────────────────────────────────

  describe('序列化', () => {
    it('应正确序列化活跃战斗', () => {
      system.createBattle({
        taskId: 't-serial-1',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      system.createBattle({
        taskId: 't-serial-2',
        targetId: 'target-2',
        troops: 2000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      const data = system.serialize();
      expect(data.version).toBe(1);
      expect(data.activeBattles).toHaveLength(2);
      expect(data.activeBattles.map((b) => b.taskId).sort()).toEqual(['t-serial-1', 't-serial-2']);
    });

    it('应正确反序列化恢复战斗', () => {
      system.createBattle({
        taskId: 't-deser',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      // 推进一部分时间
      system.update(3);

      const data = system.serialize();
      system.reset();
      expect(system.getState().activeBattles).toHaveLength(0);

      system.deserialize(data);
      const battle = system.getBattle('t-deser');
      expect(battle).not.toBeNull();
      expect(battle!.taskId).toBe('t-deser');
      expect(battle!.elapsedMs).toBe(3000);
    });

    it('序列化往返应保持一致', () => {
      system.createBattle({
        taskId: 't-roundtrip',
        targetId: 'target-1',
        troops: 5000,
        strategy: 'nightRaid',
        targetDefenseLevel: 3,
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      system.update(7);

      const data = system.serialize();

      const sys2 = new SiegeBattleSystem();
      sys2.init(createMockDeps());
      sys2.deserialize(data);

      const data2 = sys2.serialize();
      expect(data2).toEqual(data);
    });
  });

  // ────────────────────────────────────────────
  // 边界条件
  // ────────────────────────────────────────────

  describe('边界条件', () => {
    it('dt=0时不应修改战斗状态', () => {
      const battle = system.createBattle({
        taskId: 't-dt0',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetDefenseLevel: 1,
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      const defenseBefore = battle.defenseValue;
      const elapsedBefore = battle.elapsedMs;

      system.update(0);

      // With dt=0: elapsedMs += 0, defenseDelta = attackPower * 0 = 0
      // So defenseValue and elapsedMs are unchanged
      expect(battle.defenseValue).toBe(defenseBefore);
      expect(battle.elapsedMs).toBe(elapsedBefore);
    });

    it('应在reset时清空所有战斗', () => {
      system.createBattle({
        taskId: 't-reset-1',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      system.createBattle({
        taskId: 't-reset-2',
        targetId: 'target-2',
        troops: 2000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });

      expect(system.getState().activeBattles).toHaveLength(2);

      system.reset();

      expect(system.getState().activeBattles).toHaveLength(0);
      expect(system.getBattle('t-reset-1')).toBeNull();
      expect(system.getBattle('t-reset-2')).toBeNull();
    });

    it('不指定城防等级时应使用默认值1', () => {
      const battle = system.createBattle({
        taskId: 't-def-default',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
        // targetDefenseLevel omitted => defaults to 1
      });

      // targetDefenseLevel defaults to 1: maxDefense = 1 * 100 = 100
      expect(battle.maxDefense).toBe(DEFAULT_BASE_DEFENSE_VALUE);
      expect(battle.defenseValue).toBe(DEFAULT_BASE_DEFENSE_VALUE);
    });
  });

  // ────────────────────────────────────────────
  // 生命周期: destroy (R6 C-06)
  // ────────────────────────────────────────────

  describe('生命周期: destroy', () => {
    it('destroy() 应清除所有活跃战斗', () => {
      system.createBattle({
        taskId: 't-destroy-1',
        targetId: 'target-1',
        troops: 1000,
        strategy: 'forceAttack',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      system.createBattle({
        taskId: 't-destroy-2',
        targetId: 'target-2',
        troops: 2000,
        strategy: 'siege',
        targetX: 0,
        targetY: 0,
        faction: 'wei',
      });
      expect(system.getState().activeBattles).toHaveLength(2);

      system.destroy();

      expect(system.getState().activeBattles).toHaveLength(0);
      expect(system.getBattle('t-destroy-1')).toBeNull();
      expect(system.getBattle('t-destroy-2')).toBeNull();
    });
  });
});
