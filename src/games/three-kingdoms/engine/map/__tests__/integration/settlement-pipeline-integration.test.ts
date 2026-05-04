/**
 * R14 Task 3: SettlementPipeline 集成测试
 *
 * 验证 SettlementPipeline.execute() 替换 SiegeResultCalculator 后:
 * - Victory 路径: 产生等价于旧 SiegeResultCalculator 的结果
 * - Defeat 路径: 正确处理(无奖励, 有伤亡)
 * - Cancel 路径: 正确处理(无结算, 触发回城)
 * - SiegeRewardProgressive 集成: 奖励值与 SIEGE_REWARD_CONFIG 一致
 * - executedPhases 语义: 各路径的阶段状态正确
 *
 * @module engine/map/__tests__/integration/settlement-pipeline-integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  SettlementPipeline,
  type SettlementResult,
  type PhaseRecord,
} from '../../SettlementPipeline';
import { SiegeResultCalculator } from '../../SiegeResultCalculator';
import type { BattleCompletedEvent } from '../../SiegeBattleSystem';
import type { CasualtyResult } from '../../expedition-types';
import { SIEGE_REWARD_CONFIG } from '../../../../core/map';

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

/** 创建胜利战斗事件 (decisiveVictory: elapsedMs < 10000, remainingDefense === 0) */
function createVictoryEvent(overrides: Partial<BattleCompletedEvent> = {}): BattleCompletedEvent {
  return {
    taskId: 'task-v-001',
    targetId: 'city-luoyang',
    victory: true,
    strategy: 'forceAttack',
    troops: 5000,
    elapsedMs: 8000,
    remainingDefense: 0,
    ...overrides,
  };
}

/** 创建失败战斗事件 (defeat: remainingDefense <= 50) */
function createDefeatEvent(overrides: Partial<BattleCompletedEvent> = {}): BattleCompletedEvent {
  return {
    taskId: 'task-d-001',
    targetId: 'city-xuchang',
    victory: false,
    strategy: 'siege',
    troops: 3000,
    elapsedMs: 60000,
    remainingDefense: 30,
    ...overrides,
  };
}

/** 创建惨败战斗事件 (rout: remainingDefense > 50) */
function createRoutEvent(overrides: Partial<BattleCompletedEvent> = {}): BattleCompletedEvent {
  return {
    taskId: 'task-r-001',
    targetId: 'city-ye',
    victory: false,
    strategy: 'siege',
    troops: 2000,
    elapsedMs: 5000,
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

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('R14 Task 3: SettlementPipeline Integration', () => {
  let pipeline: SettlementPipeline;
  let eventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    pipeline = new SettlementPipeline();
    eventBus = createMockEventBus();
    pipeline.setDependencies({ eventBus });
  });

  // ─── Victory Path: Pipeline vs Old Calculator Equivalence ──────────

  describe('Victory path: 等价于旧 SiegeResultCalculator', () => {
    it('decisiveVictory: Pipeline 与 SiegeResultCalculator outcome 一致', () => {
      const victoryEvent = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-v-001',
        battleEvent: victoryEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 3,
        isFirstCapture: false,
      });

      const pipelineResult = pipeline.execute(ctx);

      // 对照: 旧 SiegeResultCalculator
      const oldCalculator = new SiegeResultCalculator();
      const oldResult = oldCalculator.calculateSettlement(victoryEvent, {
        targetLevel: 3,
        isFirstCapture: false,
      });

      // 验证 outcome 一致(deterministic, 不依赖随机)
      expect(pipelineResult.context.outcome).toBe(oldResult.outcome);
      expect(pipelineResult.context.outcome).toBe('decisiveVictory');

      // 验证伤亡范围合理(decisiveVictory: 10%~20%)
      expect(pipelineResult.context.casualties!.troopsLostPercent).toBeGreaterThanOrEqual(0.10);
      expect(pipelineResult.context.casualties!.troopsLostPercent).toBeLessThanOrEqual(0.20);
      expect(pipelineResult.context.casualties!.troopsLost).toBeGreaterThan(0);
    });

    it('victory: Pipeline 完成全部四阶段且数据正确', () => {
      const victoryEvent = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-v-002',
        battleEvent: victoryEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 3,
        isFirstCapture: false,
      });

      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // 全部四阶段已执行
      expect(result.executedPhases).toEqual([
        { phase: 'validate', status: 'executed' },
        { phase: 'calculate', status: 'executed' },
        { phase: 'distribute', status: 'executed' },
        { phase: 'notify', status: 'executed' },
      ]);

      // 使用 static helper 验证
      expect(SettlementPipeline.isPhaseExecuted(result, 'calculate')).toBe(true);
      expect(SettlementPipeline.isPhaseExecuted(result, 'distribute')).toBe(true);
      expect(SettlementPipeline.getExecutedPhaseNames(result)).toEqual([
        'validate', 'calculate', 'distribute', 'notify',
      ]);

      // 有伤亡
      expect(result.context.casualties).not.toBeNull();
      expect(result.context.casualties!.troopsLost).toBeGreaterThan(0);

      // 有奖励
      expect(result.context.rewards).not.toBeNull();
      expect(result.context.rewards!.rewardMultiplier).toBe(1.5); // decisiveVictory
      expect(result.context.rewards!.resources.grain).toBeGreaterThan(0);
      expect(result.context.rewards!.resources.gold).toBeGreaterThan(0);

      // 事件发射正确
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:complete',
        expect.objectContaining({ victory: true }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:reward',
        expect.objectContaining({ taskId: 'task-v-002' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:return',
        expect.objectContaining({ path: 'victory' }),
      );
    });
  });

  // ─── Defeat Path ──────────────────────────────

  describe('Defeat path: 正确处理(无奖励, 有伤亡)', () => {
    it('defeat: 有伤亡, 无奖励, distribute=skipped', () => {
      const defeatEvent = createDefeatEvent();
      const ctx = pipeline.createDefeatContext({
        taskId: 'task-d-001',
        battleEvent: defeatEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch({ troops: 3000 }),
        troops: 3000,
        targetLevel: 2,
      });

      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);

      // 阶段: calculate=executed, distribute=skipped
      expect(result.executedPhases).toEqual([
        { phase: 'validate', status: 'executed' },
        { phase: 'calculate', status: 'executed' },
        { phase: 'distribute', status: 'skipped' },
        { phase: 'notify', status: 'executed' },
      ]);

      expect(SettlementPipeline.isPhaseExecuted(result, 'distribute')).toBe(false);

      // 有伤亡(失败路径伤亡高)
      expect(result.context.casualties).not.toBeNull();
      expect(result.context.casualties!.troopsLost).toBeGreaterThan(0);
      expect(result.context.casualties!.troopsLostPercent).toBeGreaterThan(0.3);

      // 无奖励
      expect(result.context.rewards).toBeNull();

      // 无 reward 事件
      const rewardCalls = eventBus.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'settlement:reward',
      );
      expect(rewardCalls).toHaveLength(0);

      // 有 complete 事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:complete',
        expect.objectContaining({ victory: false, rewards: null }),
      );
    });

    it('rout: 极高伤亡, 无奖励', () => {
      const routEvent = createRoutEvent();
      const ctx = pipeline.createDefeatContext({
        taskId: 'task-r-001',
        battleEvent: routEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch({ troops: 2000 }),
        troops: 2000,
        targetLevel: 4,
      });

      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.context.outcome).toBe('rout');
      expect(result.context.casualties!.troopsLostPercent).toBeGreaterThanOrEqual(0.80);
      expect(result.context.casualties!.troopsLostPercent).toBeLessThanOrEqual(0.90);
      expect(result.context.rewards).toBeNull();
    });
  });

  // ─── Cancel Path ──────────────────────────────

  describe('Cancel path: 无结算, 触发回城', () => {
    it('cancel: 无伤亡, 无奖励, calculate+distribute=skipped', () => {
      const ctx = pipeline.createCancelContext({
        taskId: 'task-c-001',
        targetId: 'city-ye',
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch({
          fromCityId: 'city-ye',
          troops: 2000,
          general: '张飞',
        }),
      });

      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);

      // 阶段: calculate=skipped, distribute=skipped
      expect(result.executedPhases).toEqual([
        { phase: 'validate', status: 'executed' },
        { phase: 'calculate', status: 'skipped' },
        { phase: 'distribute', status: 'skipped' },
        { phase: 'notify', status: 'executed' },
      ]);

      expect(SettlementPipeline.isPhaseExecuted(result, 'calculate')).toBe(false);
      expect(SettlementPipeline.isPhaseExecuted(result, 'distribute')).toBe(false);

      // 无伤亡, 无奖励
      expect(result.context.casualties).toBeNull();
      expect(result.context.rewards).toBeNull();

      // 取消事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:cancelled',
        expect.objectContaining({ taskId: 'task-c-001' }),
      );

      // 回城事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        'settlement:return',
        expect.objectContaining({ path: 'cancel' }),
      );

      // 无 complete 事件
      const completeCalls = eventBus.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'settlement:complete',
      );
      expect(completeCalls).toHaveLength(0);
    });
  });

  // ─── SiegeRewardProgressive Integration ──────────────────────

  describe('SiegeRewardProgressive 集成: 奖励值匹配渐进系统', () => {
    it('奖励基础值使用 SIEGE_REWARD_CONFIG', () => {
      const victoryEvent = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-reward-001',
        battleEvent: victoryEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 3,
        isFirstCapture: false,
      });

      const result = pipeline.execute(ctx);
      const rewards = result.context.rewards!;

      // decisiveVictory multiplier = 1.5
      const expectedGrain = Math.floor(SIEGE_REWARD_CONFIG.baseGrain * 3 * 1.5);
      const expectedGold = Math.floor(SIEGE_REWARD_CONFIG.baseGold * 3 * 1.5);
      const expectedTroops = Math.floor(SIEGE_REWARD_CONFIG.baseTroops * 3 * 1.5);

      expect(rewards.resources.grain).toBe(expectedGrain);
      expect(rewards.resources.gold).toBe(expectedGold);
      expect(rewards.resources.troops).toBe(expectedTroops);
    });

    it('首次攻占 1.5x 加成', () => {
      const victoryEvent = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-reward-first',
        battleEvent: victoryEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 5,
        isFirstCapture: true,
      });

      const result = pipeline.execute(ctx);
      const rewards = result.context.rewards!;

      // decisiveVictory multiplier=1.5, firstCapture 1.5x => 2.25
      const expectedMultiplier = 1.5 * 1.5;
      expect(rewards.rewardMultiplier).toBeCloseTo(expectedMultiplier, 2);
      expect(rewards.resources.grain).toBe(
        Math.floor(SIEGE_REWARD_CONFIG.baseGrain * 5 * expectedMultiplier),
      );
    });

    it('不同 outcome 不同倍率', () => {
      // narrowVictory: elapsedMs > 40000
      const narrowEvent = createVictoryEvent({ elapsedMs: 45000 });
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-narrow',
        battleEvent: narrowEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 2,
        isFirstCapture: false,
      });

      const result = pipeline.execute(ctx);
      expect(result.context.outcome).toBe('narrowVictory');
      expect(result.context.rewards!.rewardMultiplier).toBe(0.8); // narrowVictory

      const expectedGrain = Math.floor(SIEGE_REWARD_CONFIG.baseGrain * 2 * 0.8);
      expect(result.context.rewards!.resources.grain).toBe(expectedGrain);
    });

    it('reward 事件携带完整奖励数据', () => {
      const victoryEvent = createVictoryEvent();
      const ctx = pipeline.createVictoryContext({
        taskId: 'task-event',
        battleEvent: victoryEvent,
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 5000,
        targetLevel: 3,
        isFirstCapture: false,
      });

      pipeline.execute(ctx);

      const rewardCall = eventBus.emit.mock.calls.find(
        (call: unknown[]) => call[0] === 'settlement:reward',
      );
      expect(rewardCall).toBeDefined();
      expect(rewardCall![1]).toMatchObject({
        taskId: 'task-event',
        targetId: 'city-luoyang',
        rewards: {
          resources: {
            grain: expect.any(Number),
            gold: expect.any(Number),
            troops: expect.any(Number),
          },
          items: expect.any(Array),
          rewardMultiplier: 1.5,
        },
      });
    });
  });

  // ─── Pipeline vs Calculator Outcome Parity ──────────────────────

  describe('Pipeline 与旧 SiegeResultCalculator 结果等价性', () => {
    const testCases: Array<{
      name: string;
      event: BattleCompletedEvent;
      expectedOutcome: string;
    }> = [
      {
        name: 'decisiveVictory (快速攻破)',
        event: createVictoryEvent({ elapsedMs: 5000, remainingDefense: 0 }),
        expectedOutcome: 'decisiveVictory',
      },
      {
        name: 'victory (普通胜利)',
        event: createVictoryEvent({ elapsedMs: 20000, remainingDefense: 0 }),
        expectedOutcome: 'victory',
      },
      {
        name: 'narrowVictory (险胜)',
        event: createVictoryEvent({ elapsedMs: 45000, remainingDefense: 0 }),
        expectedOutcome: 'narrowVictory',
      },
      {
        name: 'defeat (失败)',
        event: createDefeatEvent({ remainingDefense: 30 }),
        expectedOutcome: 'defeat',
      },
      {
        name: 'rout (惨败)',
        event: createDefeatEvent({ remainingDefense: 80 }),
        expectedOutcome: 'rout',
      },
    ];

    for (const tc of testCases) {
      it(tc.name, () => {
        const path = tc.event.victory ? 'victory' : 'defeat';
        const returnMarchInfo = {
          fromCityId: tc.event.targetId,
          toCityId: 'city-changsha',
          troops: tc.event.troops,
          general: '测试将领',
        };

        const settlementCtx = tc.event.victory
          ? pipeline.createVictoryContext({
              taskId: `task-${tc.expectedOutcome}`,
              battleEvent: tc.event,
              sourceId: 'city-changsha',
              returnMarch: returnMarchInfo,
              troops: tc.event.troops,
              targetLevel: 3,
              isFirstCapture: false,
            })
          : pipeline.createDefeatContext({
              taskId: `task-${tc.expectedOutcome}`,
              battleEvent: tc.event,
              sourceId: 'city-changsha',
              returnMarch: returnMarchInfo,
              troops: tc.event.troops,
              targetLevel: 3,
            });

        const pipelineResult = pipeline.execute(settlementCtx);

        // 旧计算器
        const oldCalc = new SiegeResultCalculator();
        const oldResult = oldCalc.calculateSettlement(tc.event, {
          targetLevel: 3,
          isFirstCapture: false,
        });

        // outcome 必须一致
        expect(pipelineResult.context.outcome).toBe(tc.expectedOutcome);
        expect(pipelineResult.context.outcome).toBe(oldResult.outcome);

        // 伤亡率范围一致(由于各自使用独立 Math.random, 具体数值可能不同)
        // 但 outcome 相同意味着伤亡率范围相同
        expect(pipelineResult.context.casualties!.troopsLostPercent).toBeGreaterThan(0);
        expect(pipelineResult.context.casualties!.troopsLost).toBeGreaterThan(0);
        expect(pipelineResult.context.casualties!.heroInjured).toBeDefined();
        expect(pipelineResult.context.casualties!.injuryLevel).toBeDefined();
      });
    }
  });

  // ─── Validation Path ──────────────────────────────

  describe('Validation: 无效输入正确拒绝', () => {
    it('缺少 taskId 验证失败', () => {
      const ctx = pipeline.createCancelContext({
        taskId: '',
        targetId: 'city-ye',
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
      });

      const result = pipeline.execute(ctx);
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'taskId is required' }),
        ]),
      );
      expect(result.executedPhases).toEqual([]);
    });

    it('victory 路径缺少 battleEvent 验证失败', () => {
      const ctx = pipeline.createCancelContext({
        taskId: 'task-bad',
        targetId: 'city-luoyang',
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
      });
      // 手动篡改为 victory 路径但不传 battleEvent
      ctx.path = 'victory';

      const result = pipeline.execute(ctx);
      expect(result.success).toBe(false);
    });
  });

  // ─── PhaseRecord Utility ──────────────────────────────

  describe('PhaseRecord 工具方法', () => {
    it('getExecutedPhaseNames 正确过滤', () => {
      const ctx = pipeline.createCancelContext({
        taskId: 'task-util',
        targetId: 'city-ye',
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
      });

      const result = pipeline.execute(ctx);
      const names = SettlementPipeline.getExecutedPhaseNames(result);

      // cancel: validate + notify executed, calculate + distribute skipped
      expect(names).toEqual(['validate', 'notify']);
    });

    it('isPhaseExecuted 精确查询', () => {
      const ctx = pipeline.createDefeatContext({
        taskId: 'task-util2',
        battleEvent: createDefeatEvent(),
        sourceId: 'city-changsha',
        returnMarch: createReturnMarch(),
        troops: 3000,
        targetLevel: 2,
      });

      const result = pipeline.execute(ctx);

      expect(SettlementPipeline.isPhaseExecuted(result, 'validate')).toBe(true);
      expect(SettlementPipeline.isPhaseExecuted(result, 'calculate')).toBe(true);
      expect(SettlementPipeline.isPhaseExecuted(result, 'distribute')).toBe(false);
      expect(SettlementPipeline.isPhaseExecuted(result, 'notify')).toBe(true);
    });
  });
});
