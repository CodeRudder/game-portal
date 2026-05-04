/**
 * 双路径结算架构验证测试
 *
 * 验证 SettlementPipeline 统一处理三条路径:
 *   Path A (Victory): validate → calculate → distribute → notify
 *   Path B (Defeat):  validate → calculate → skip distribute → notify
 *   Path C (Cancel):  validate → skip calculate → skip distribute → notify
 *
 * @module engine/map/__tests__/SettlementArchitecture.test
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  SettlementPipeline,
  type SettlementContext,
  type SettlementPath,
  type SettlementResult,
} from '../SettlementPipeline';
import type { BattleCompletedEvent } from '../SiegeBattleSystem';
import { SIEGE_REWARD_CONFIG } from '../../../core/map';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** 创建 mock eventBus */
function createMockEventBus() {
  return {
    emit: vi.fn(),
    on: vi.fn().mockReturnValue(vi.fn()),
    off: vi.fn(),
  };
}

/** 创建胜利战斗事件 */
function createVictoryEvent(overrides: Partial<BattleCompletedEvent> = {}): BattleCompletedEvent {
  return {
    taskId: 'task-001',
    targetId: 'city-luoyang',
    victory: true,
    strategy: 'forceAttack',
    troops: 5000,
    elapsedMs: 8000,
    remainingDefense: 0,
    ...overrides,
  };
}

/** 创建失败战斗事件 */
function createDefeatEvent(overrides: Partial<BattleCompletedEvent> = {}): BattleCompletedEvent {
  return {
    taskId: 'task-002',
    targetId: 'city-xuchang',
    victory: false,
    strategy: 'siege',
    troops: 3000,
    elapsedMs: 60000,
    remainingDefense: 80,
    ...overrides,
  };
}

/** 创建基础回城信息 */
function createReturnMarch(overrides = {}) {
  return {
    fromCityId: 'city-luoyang',
    toCityId: 'city-changsha',
    troops: 5000,
    general: '关羽',
    ...overrides,
  };
}

/** Seeded PRNG (mulberry32) */
function seededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('SettlementArchitecture: 双路径结算架构验证', () => {
  let pipeline: SettlementPipeline;
  let eventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    pipeline = new SettlementPipeline();
    eventBus = createMockEventBus();
    pipeline.setDependencies({ eventBus });
  });

  // ─── Path A: Victory ──────────────────────

  describe('Path A: Victory 路径 (战斗胜利)', () => {
    it('应完成完整四阶段流水线: validate → calculate → distribute → notify', () => {
      const victoryEvent = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-001',
        battleEvent: victoryEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 3,
        isFirstCapture: false,
      });

      const result = pipeline.execute(ctx);

      // 验证成功
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // 验证四个阶段全部执行
      expect(result.executedPhases).toEqual([
        { phase: 'validate', status: 'executed' },
        { phase: 'calculate', status: 'executed' },
        { phase: 'distribute', status: 'executed' },
        { phase: 'notify', status: 'executed' },
      ]);

      // 验证伤亡已计算
      expect(result.context.casualties).not.toBeNull();
      expect(result.context.casualties!.troopsLost).toBeGreaterThan(0);
      expect(result.context.casualties!.troopsLostPercent).toBeGreaterThan(0);
      expect(result.context.casualties!.troopsLostPercent).toBeLessThanOrEqual(0.3);

      // 验证 outcome 已判定
      expect(result.context.outcome).toBe('decisiveVictory');

      // 验证奖励已计算
      expect(result.context.rewards).not.toBeNull();
      expect(result.context.rewards!.rewardMultiplier).toBe(1.5); // decisiveVictory 倍率
      expect(result.context.rewards!.resources.grain).toBeGreaterThan(0);
      expect(result.context.rewards!.resources.gold).toBeGreaterThan(0);

      // 验证事件发射
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:complete',
        expect.objectContaining({
          taskId: 'task-001',
          path: 'victory',
          victory: true,
        }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:reward',
        expect.objectContaining({
          taskId: 'task-001',
        }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:return',
        expect.objectContaining({
          taskId: 'task-001',
        }),
      );
    });

    it('首次攻占应获得 1.5x 奖励加成', () => {
      const victoryEvent = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-first',
        battleEvent: victoryEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 3,
        isFirstCapture: true,
      });

      const result = pipeline.execute(ctx);
      expect(result.success).toBe(true);

      // decisiveVictory multiplier=1.5, firstCapture=1.5x => 2.25
      expect(result.context.rewards!.rewardMultiplier).toBeCloseTo(2.25, 2);
      // baseGrain from SIEGE_REWARD_CONFIG = 50
      expect(result.context.rewards!.resources.grain).toBe(
        Math.floor(SIEGE_REWARD_CONFIG.baseGrain * 3 * 2.25),
      );
    });
  });

  // ─── Path B: Defeat ──────────────────────

  describe('Path B: Defeat 路径 (战斗失败)', () => {
    it('应跳过 distribute 阶段, 不发放奖励但计算伤亡', () => {
      const defeatEvent = createDefeatEvent();
      const ctx = pipeline.createDefeatContext({
        taskId: 'task-002',
        battleEvent: defeatEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch({ troops: 3000 }),
        troops: 3000,
        targetLevel: 2,
      });

      const result = pipeline.execute(ctx);

      // 验证成功
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // 验证阶段记录: calculate=executed, distribute=skipped
      expect(result.executedPhases).toEqual([
        { phase: 'validate', status: 'executed' },
        { phase: 'calculate', status: 'executed' },
        { phase: 'distribute', status: 'skipped' },
        { phase: 'notify', status: 'executed' },
      ]);

      // 验证伤亡已计算(失败伤亡应更高)
      expect(result.context.casualties).not.toBeNull();
      expect(result.context.casualties!.troopsLost).toBeGreaterThan(0);
      // defeat 路径伤亡率应较高 (0.4~0.7 或 0.8~0.9)
      expect(result.context.casualties!.troopsLostPercent).toBeGreaterThan(0.3);

      // 验证无奖励
      expect(result.context.rewards).toBeNull();

      // 验证无 settlement:reward 事件
      const rewardCalls = eventBus.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'settlement:reward',
      );
      expect(rewardCalls).toHaveLength(0);

      // 验证 settlement:complete 事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:complete',
        expect.objectContaining({
          taskId: 'task-002',
          path: 'defeat',
          victory: false,
          rewards: null,
        }),
      );

      // 验证回城事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:return',
        expect.objectContaining({
          taskId: 'task-002',
          path: 'defeat',
        }),
      );
    });
  });

  // ─── Path C: Cancel ──────────────────────

  describe('Path C: Cancel 路径 (取消行军)', () => {
    it('应跳过 calculate 和 distribute, 直接回城无结算', () => {
      const ctx = pipeline.createCancelContext({
        taskId: 'task-003',
        targetId: 'city-ye',
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch({
          fromCityId: 'city-ye',
          troops: 2000,
          general: '张飞',
        }),
      });

      const result = pipeline.execute(ctx);

      // 验证成功
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // 验证阶段记录: calculate=skipped, distribute=skipped
      expect(result.executedPhases).toEqual([
        { phase: 'validate', status: 'executed' },
        { phase: 'calculate', status: 'skipped' },
        { phase: 'distribute', status: 'skipped' },
        { phase: 'notify', status: 'executed' },
      ]);

      // 验证无伤亡
      expect(result.context.casualties).toBeNull();

      // 验证无奖励
      expect(result.context.rewards).toBeNull();

      // 验证发射 settlement:cancelled 事件(而非 settlement:complete)
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:cancelled',
        expect.objectContaining({
          taskId: 'task-003',
          targetId: 'city-ye',
        }),
      );

      // 验证无 settlement:complete 事件
      const completeCalls = eventBus.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'settlement:complete',
      );
      expect(completeCalls).toHaveLength(0);

      // 验证回城事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:return',
        expect.objectContaining({
          taskId: 'task-003',
          path: 'cancel',
        }),
      );
    });
  });

  // ─── 验证阶段 ────────────────────────────

  describe('validate 阶段验证', () => {
    it('缺少 taskId 应验证失败', () => {
      const ctx: SettlementContext = {
        taskId: '',
        targetId: 'city-luoyang',
        sourceId: 'city-changsha',
        path: 'cancel',
        battleEvent: null,
        outcome: null,
        casualties: null,
        rewards: null,
        returnMarch: createReturnMarch(),
        timestamp: Date.now(),
      };

      const result = pipeline.execute(ctx);
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'taskId is required' }),
        ]),
      );
    });

    it('victory 路径缺少 battleEvent 应验证失败', () => {
      const ctx: SettlementContext = {
        taskId: 'task-bad',
        targetId: 'city-luoyang',
        sourceId: 'city-changsha',
        path: 'victory',
        battleEvent: null,
        outcome: null,
        casualties: null,
        rewards: null,
        returnMarch: createReturnMarch(),
        timestamp: Date.now(),
      };

      const result = pipeline.execute(ctx);
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'battleEvent is required for victory/defeat paths' }),
        ]),
      );
    });

    it('victory 路径 battleEvent.victory=false 应验证失败', () => {
      const defeatEvent = createDefeatEvent();
      const ctx: SettlementContext = {
        taskId: 'task-mismatch',
        targetId: 'city-xuchang',
        sourceId: 'city-changsha',
        path: 'victory',
        battleEvent: defeatEvent,
        outcome: null,
        casualties: null,
        rewards: null,
        returnMarch: createReturnMarch(),
        timestamp: Date.now(),
        troops: 3000,
      };

      const result = pipeline.execute(ctx);
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'battleEvent.victory must be true for victory path' }),
        ]),
      );
    });
  });

  // ─── 工厂方法 ─────────────────────────────

  describe('工厂方法', () => {
    it('createVictoryContext 应正确构造上下文', () => {
      const event = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-factory',
        battleEvent: event,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 3,
        isFirstCapture: true,
        forceId: 'force-1',
        heroId: 'hero-guanyu',
      });

      expect(ctx.path).toBe('victory');
      expect(ctx.taskId).toBe('task-factory');
      expect(ctx.targetId).toBe('city-luoyang');
      expect(ctx.battleEvent).toBe(event);
      expect(ctx.outcome).toBeNull();
      expect(ctx.casualties).toBeNull();
      expect(ctx.rewards).toBeNull();
      expect(ctx.isFirstCapture).toBe(true);
      expect(ctx.forceId).toBe('force-1');
      expect(ctx.heroId).toBe('hero-guanyu');
    });

    it('createDefeatContext 应正确构造上下文', () => {
      const event = createDefeatEvent();
      const ctx = pipeline.createDefeatContext({
        taskId: 'task-defeat-factory',
        battleEvent: event,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 3000,
      });

      expect(ctx.path).toBe('defeat');
      expect(ctx.battleEvent).toBe(event);
      expect(ctx.outcome).toBeNull();
    });

    it('createCancelContext 应正确构造上下文', () => {
      const ctx = pipeline.createCancelContext({
        taskId: 'task-cancel-factory',
        targetId: 'city-ye',
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
      });

      expect(ctx.path).toBe('cancel');
      expect(ctx.battleEvent).toBeNull();
      expect(ctx.targetId).toBe('city-ye');
    });
  });

  // ─── 无依赖降级 ──────────────────────────

  describe('无依赖降级', () => {
    it('未设置依赖时 notify 不抛异常', () => {
      const noDepsPipeline = new SettlementPipeline();
      const ctx = noDepsPipeline.createCancelContext({
        taskId: 'task-no-deps',
        targetId: 'city-ye',
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
      });

      expect(() => noDepsPipeline.execute(ctx)).not.toThrow();
    });
  });

  // ─── 三路径对比 ──────────────────────────

  describe('三路径对比验证', () => {
    it('victory 有奖励, defeat 无奖励, cancel 无奖励且无伤亡', () => {
      // Victory
      const victoryResult = pipeline.execute(
        pipeline.createVictoryContext({
          taskId: 't-v',
          battleEvent: createVictoryEvent(),
          sourceId: 'city-changsha',
          returnMarch: createReturnMarch(),
          troops: 5000,
          targetLevel: 3,
        }),
      );

      // Defeat
      const defeatResult = pipeline.execute(
        pipeline.createDefeatContext({
          taskId: 't-d',
          battleEvent: createDefeatEvent(),
          sourceId: 'city-changsha',
          returnMarch: createReturnMarch(),
          troops: 3000,
          targetLevel: 2,
        }),
      );

      // Cancel
      const cancelResult = pipeline.execute(
        pipeline.createCancelContext({
          taskId: 't-c',
          targetId: 'city-ye',
          sourceId: 'city-changsha',
          returnMarch: createReturnMarch(),
        }),
      );

      // 全部成功
      expect(victoryResult.success).toBe(true);
      expect(defeatResult.success).toBe(true);
      expect(cancelResult.success).toBe(true);

      // Victory: 有伤亡 + 有奖励
      expect(victoryResult.context.casualties).not.toBeNull();
      expect(victoryResult.context.rewards).not.toBeNull();

      // Defeat: 有伤亡 + 无奖励
      expect(defeatResult.context.casualties).not.toBeNull();
      expect(defeatResult.context.rewards).toBeNull();

      // Cancel: 无伤亡 + 无奖励
      expect(cancelResult.context.casualties).toBeNull();
      expect(cancelResult.context.rewards).toBeNull();

      // Defeat 伤亡 > Victory 伤亡
      expect(defeatResult.context.casualties!.troopsLostPercent).toBeGreaterThan(
        victoryResult.context.casualties!.troopsLostPercent,
      );
    });
  });
});
