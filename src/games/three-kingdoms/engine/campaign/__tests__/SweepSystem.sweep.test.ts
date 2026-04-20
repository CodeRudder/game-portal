/**
 * 扫荡系统测试 — 批量扫荡执行 + 扫荡产出 + 自动推图
 *
 * 覆盖：
 * - #8 扫荡规则（选择关卡+次数→直接结算）
 * - #9 扫荡产出（跳过战斗直接获得奖励）
 * - #10 自动推图（循环挑战最远关卡）
 * - 边界情况
 */

import { describe, it, expect, vi } from 'vitest';
import { SweepSystem } from '../SweepSystem';
import type { ICampaignDataProvider, RewardDistributorDeps } from '../campaign.types';
import type { SweepDeps } from '../sweep.types';
import { getChapters, getChapter, getStage, getStagesByChapter } from '../campaign-config';
import { createSweepSystem } from './SweepSystem.test';

// ─────────────────────────────────────────────
// 额外测试辅助
// ─────────────────────────────────────────────

const dataProvider: ICampaignDataProvider = {
  getChapters, getChapter, getStage, getStagesByChapter,
};

const noDropRng = () => 1.0;

function createTrackedDeps() {
  const resources: Record<string, number> = {};
  const fragments: Record<string, number> = {};
  let totalExp = 0;
  return {
    deps: {
      addResource: (type: any, amount: number) => {
        resources[type] = (resources[type] ?? 0) + amount;
        return resources[type];
      },
      addFragment: (generalId: string, count: number) => {
        fragments[generalId] = (fragments[generalId] ?? 0) + count;
      },
      addExp: (exp: number) => { totalExp += exp; },
    } satisfies RewardDistributorDeps,
    resources, fragments,
    get totalExp() { return totalExp; },
  };
}

// ═══════════════════════════════════════════════
// 5. 扫荡规则（#8 选择关卡+次数→直接结算）
// ═══════════════════════════════════════════════

describe('SweepSystem 批量扫荡执行', () => {
  it('成功执行单次扫荡', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 1);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.ticketsUsed).toBe(1);
    expect(result.failureReason).toBeUndefined();
  });

  it('成功执行多次扫荡', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 5);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(5);
    expect(result.results).toHaveLength(5);
    expect(result.ticketsUsed).toBe(5);
  });

  it('扫荡消耗扫荡令', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    system.sweep('chapter1_stage1', 3);
    expect(system.getTicketCount()).toBe(7);
  });

  it('扫荡令不足时失败', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 2 });
    const result = system.sweep('chapter1_stage1', 5);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('扫荡令不足');
    expect(system.getTicketCount()).toBe(2);
  });

  it('未三星通关不可扫荡', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 2 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('三星通关');
  });

  it('扫荡次数为0时失败', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 0);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('大于0');
  });

  it('扫荡次数为负数时失败', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', -1);
    expect(result.success).toBe(false);
  });

  it('超过最大扫荡次数时失败', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 100 });
    const result = system.sweep('chapter1_stage1', 11);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('最大');
  });

  it('不存在的关卡不可扫荡', () => {
    const { system } = createSweepSystem({}, { initialTickets: 10 });
    const result = system.sweep('nonexistent', 1);
    expect(result.success).toBe(false);
  });

  it('自定义 sweepCostPerRun 时正确计算消耗', () => {
    const { system } = createSweepSystem(
      { chapter1_stage1: 3 },
      { initialTickets: 20, config: { sweepCostPerRun: 2 } },
    );
    const result = system.sweep('chapter1_stage1', 5);
    expect(result.success).toBe(true);
    expect(result.ticketsUsed).toBe(10);
    expect(system.getTicketCount()).toBe(10);
  });
});

// ═══════════════════════════════════════════════
// 6. 扫荡产出（#9 跳过战斗直接获得奖励）
// ═══════════════════════════════════════════════

describe('SweepSystem 扫荡产出', () => {
  it('单次扫荡正确计算奖励', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 1);
    expect(result.success).toBe(true);
    const sweepResult = result.results[0];
    expect(sweepResult.stageId).toBe('chapter1_stage1');
    expect(sweepResult.stars).toBe(3);
    expect(sweepResult.reward.starMultiplier).toBeGreaterThan(0);
    expect(sweepResult.reward.isFirstClear).toBe(false);
  });

  it('批量扫荡汇总资源奖励', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 3);
    expect(result.success).toBe(true);
    expect(result.totalResources.grain ?? 0).toBeGreaterThan(0);
    expect(result.totalExp).toBeGreaterThan(0);
  });

  it('批量扫荡汇总等于各次之和', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 3);
    expect(result.success).toBe(true);
    let expectedGrain = 0;
    let expectedExp = 0;
    for (const r of result.results) {
      expectedGrain += r.reward.resources.grain ?? 0;
      expectedExp += r.reward.exp;
    }
    expect(result.totalResources.grain).toBe(expectedGrain);
    expect(result.totalExp).toBe(expectedExp);
  });

  it('扫荡使用历史最高星级计算奖励', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 1);
    expect(result.results[0].stars).toBe(3);
    expect(result.results[0].reward.starMultiplier).toBe(1.5);
  });

  it('二星关卡不可扫荡，即使有扫荡令', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 2 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 1);
    expect(result.success).toBe(false);
    expect(result.executedCount).toBe(0);
    expect(result.ticketsUsed).toBe(0);
  });

  it('多次扫荡结果独立', () => {
    const tracked = createTrackedDeps();
    const deps = {
      simulateBattle: vi.fn(() => ({ victory: true, stars: 3 })),
      getStageStars: vi.fn(() => 3),
      canChallenge: vi.fn(() => true),
      getFarthestStageId: vi.fn(() => null),
      completeStage: vi.fn(),
    } satisfies SweepDeps;

    let callCount = 0;
    const varyingRng = () => { callCount++; return callCount % 2 === 0 ? 0.01 : 0.99; };
    const system = new SweepSystem(dataProvider, tracked.deps, deps, undefined, varyingRng);
    system.addTickets(10);

    const result = system.sweep('chapter1_stage1', 5);
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(5);
    for (const r of result.results) {
      expect(r.stageId).toBe('chapter1_stage1');
      expect(r.reward).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════
// 7. 自动推图（#10 循环挑战最远关卡）
// ═══════════════════════════════════════════════

describe('SweepSystem 自动推图', () => {
  it('没有可挑战关卡时返回空结果', () => {
    const { system } = createSweepSystem({}, { farthestStageId: null });
    const result = system.autoPush();
    expect(result.totalAttempts).toBe(0);
    expect(result.victories).toBe(0);
    expect(result.defeats).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('三星关卡使用扫荡令扫荡', () => {
    const { system } = createSweepSystem(
      { chapter1_stage1: 3 },
      { farthestStageId: 'chapter1_stage1', initialTickets: 10 },
    );
    const result = system.autoPush();
    expect(result.victories).toBeGreaterThan(0);
    expect(result.ticketsUsed).toBeGreaterThan(0);
  });

  it('未三星关卡使用模拟战斗', () => {
    const tracked = createTrackedDeps();
    const deps = {
      simulateBattle: vi.fn((stageId: string) => {
        if (stageId === 'chapter1_stage1') return { victory: true, stars: 3 };
        return { victory: false, stars: 0 };
      }),
      getStageStars: vi.fn(() => 0),
      canChallenge: vi.fn((stageId: string) =>
        stageId === 'chapter1_stage1' || stageId === 'chapter1_stage2'),
      getFarthestStageId: vi.fn(() => 'chapter1_stage1'),
      completeStage: vi.fn(),
    } satisfies SweepDeps;

    const system = new SweepSystem(dataProvider, tracked.deps, deps, undefined, noDropRng);
    system.addTickets(10);

    const result = system.autoPush();
    expect(result.victories).toBeGreaterThanOrEqual(1);
    expect(result.defeats).toBeGreaterThanOrEqual(1);
  });

  it('战斗失败时停止推图', () => {
    const tracked = createTrackedDeps();
    const deps = {
      simulateBattle: vi.fn(() => ({ victory: false, stars: 0 })),
      getStageStars: vi.fn(() => 0),
      canChallenge: vi.fn(() => true),
      getFarthestStageId: vi.fn(() => 'chapter1_stage1'),
      completeStage: vi.fn(),
    } satisfies SweepDeps;

    const system = new SweepSystem(dataProvider, tracked.deps, deps, undefined, noDropRng);
    system.addTickets(10);

    const result = system.autoPush();
    expect(result.victories).toBe(0);
    expect(result.defeats).toBe(1);
    expect(result.totalAttempts).toBe(1);
    expect(result.reachedMaxAttempts).toBe(false);
  });

  it('达到最大尝试次数时停止', () => {
    const tracked = createTrackedDeps();
    const deps = {
      simulateBattle: vi.fn(() => ({ victory: true, stars: 3 })),
      getStageStars: vi.fn(() => 3),
      canChallenge: vi.fn(() => true),
      getFarthestStageId: vi.fn(() => 'chapter1_stage1'),
      completeStage: vi.fn(),
    } satisfies SweepDeps;

    const system = new SweepSystem(
      dataProvider, tracked.deps, deps,
      { autoPushMaxAttempts: 3 }, noDropRng,
    );
    system.addTickets(100);

    const result = system.autoPush();
    expect(result.reachedMaxAttempts).toBe(true);
    expect(result.totalAttempts).toBe(3);
  });

  it('自动推图进度实时更新', () => {
    const tracked = createTrackedDeps();
    const deps = {
      simulateBattle: vi.fn(() => ({ victory: false, stars: 0 })),
      getStageStars: vi.fn(() => 0),
      canChallenge: vi.fn(() => true),
      getFarthestStageId: vi.fn(() => 'chapter1_stage1'),
      completeStage: vi.fn(),
    } satisfies SweepDeps;

    const system = new SweepSystem(dataProvider, tracked.deps, deps, undefined, noDropRng);
    system.addTickets(10);

    expect(system.getAutoPushProgress().isRunning).toBe(false);
    system.autoPush();
    expect(system.getAutoPushProgress().isRunning).toBe(false);
    expect(system.getAutoPushProgress().attempts).toBeGreaterThan(0);
  });

  it('自动推图汇总奖励', () => {
    const tracked = createTrackedDeps();
    const deps = {
      simulateBattle: vi.fn(() => ({ victory: true, stars: 3 })),
      getStageStars: vi.fn(() => 3),
      canChallenge: vi.fn(() => true),
      getFarthestStageId: vi.fn(() => 'chapter1_stage1'),
      completeStage: vi.fn(),
    } satisfies SweepDeps;

    const system = new SweepSystem(
      dataProvider, tracked.deps, deps,
      { autoPushMaxAttempts: 2 }, noDropRng,
    );
    system.addTickets(100);

    const result = system.autoPush();
    if (result.victories > 0) {
      expect(result.totalResources.grain ?? 0).toBeGreaterThan(0);
    }
  });

  it('扫荡令不足时回退到模拟战斗', () => {
    const tracked = createTrackedDeps();
    const deps = {
      simulateBattle: vi.fn((stageId: string) => {
        if (stageId === 'chapter1_stage1') return { victory: true, stars: 3 };
        return { victory: false, stars: 0 };
      }),
      getStageStars: vi.fn(() => 3),
      canChallenge: vi.fn(() => true),
      getFarthestStageId: vi.fn(() => 'chapter1_stage1'),
      completeStage: vi.fn(),
    } satisfies SweepDeps;

    const system = new SweepSystem(dataProvider, tracked.deps, deps, undefined, noDropRng);
    const result = system.autoPush();
    expect(result.victories).toBeGreaterThanOrEqual(1);
    expect(deps.simulateBattle).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 8. 边界情况
// ═══════════════════════════════════════════════

describe('SweepSystem 边界情况', () => {
  it('连续扫荡直到扫荡令耗尽', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 }, { initialTickets: 3 });

    const r1 = system.sweep('chapter1_stage1', 3);
    expect(r1.success).toBe(true);
    expect(system.getTicketCount()).toBe(0);

    const r2 = system.sweep('chapter1_stage1', 1);
    expect(r2.success).toBe(false);
    expect(r2.failureReason).toContain('扫荡令不足');
  });

  it('扫荡失败不消耗扫荡令', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 2 }, { initialTickets: 10 });
    const result = system.sweep('chapter1_stage1', 1);
    expect(result.success).toBe(false);
    expect(system.getTicketCount()).toBe(10);
  });

  it('自定义配置生效', () => {
    const { system } = createSweepSystem(
      { chapter1_stage1: 3 },
      {
        initialTickets: 20,
        config: { dailyTicketReward: 20, sweepCostPerRun: 2, maxSweepCount: 5, autoPushMaxAttempts: 10 },
      },
    );

    expect(system.getRequiredTickets(3)).toBe(6);

    const result = system.sweep('chapter1_stage1', 6);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('最大5次');

    const result2 = system.sweep('chapter1_stage1', 5);
    expect(result2.success).toBe(true);
    expect(result2.ticketsUsed).toBe(10);
  });

  it('每日扫荡令配置可自定义', () => {
    const { system } = createSweepSystem({}, { config: { dailyTicketReward: 20 } });
    const gained = system.claimDailyTickets();
    expect(gained).toBe(20);
    expect(system.getTicketCount()).toBe(20);
  });
});
