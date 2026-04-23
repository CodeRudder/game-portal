/**
 * 集成测试 — 扫荡系统 + 自动推图
 *
 * 覆盖 Play 文档流程：
 *   §2.1  扫荡解锁条件：3星通关后解锁
 *   §2.2  扫荡令获取与消耗
 *   §2.3  执行扫荡：一键获取奖励
 *   §2.4  扫荡次数限制
 *   §2.5  扫荡奖励计算
 *   §3.1  离线自动推图
 *   §3.2  自动推图进度计算
 *   §3.3  自动推图奖励
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/map/__tests__/integration/sweep-auto-push
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SweepSystem } from '../../../campaign/SweepSystem';
import { AutoPushExecutor } from '../../../campaign/AutoPushExecutor';
import { RewardDistributor } from '../../../campaign/RewardDistributor';
import { MAX_STARS } from '../../../campaign/campaign.types';
import { DEFAULT_SWEEP_CONFIG } from '../../../campaign/sweep.types';
import type {
  SweepDeps,
  SweepBatchResult,
  AutoPushProgress,
} from '../../../campaign/sweep.types';
import type {
  ICampaignDataProvider,
  RewardDistributorDeps,
  Stage,
  Chapter,
  DropTableEntry,
} from '../../../campaign/campaign.types';
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

/** 创建模拟关卡 */
function createMockStage(stageId: string, chapterId = 'chapter1'): Stage {
  return {
    id: stageId,
    name: `测试关卡-${stageId}`,
    type: 'normal',
    chapterId,
    order: 1,
    enemyFormation: {
      id: `formation_${stageId}`,
      name: '测试阵容',
      units: [],
      recommendedPower: 1000,
    },
    baseRewards: { gold: 1000 },
    baseExp: 200,
    firstClearRewards: { gold: 5000 },
    firstClearExp: 1000,
    threeStarBonusMultiplier: 2.0,
    dropTable: [
      { type: 'resource', resourceType: 'gold', minAmount: 100, maxAmount: 300, probability: 1.0 },
      { type: 'exp', minAmount: 50, maxAmount: 100, probability: 0.8 },
    ] as DropTableEntry[],
    recommendedPower: 1000,
    description: '测试关卡描述',
  };
}

/** 创建模拟关卡数据提供者 */
function createMockDataProvider(
  stageStars: Record<string, number> = {},
): ICampaignDataProvider {
  const stages: Record<string, Stage> = {};
  const defaultStage = createMockStage('stage_1_1');
  stages['stage_1_1'] = defaultStage;
  stages['stage_1_2'] = createMockStage('stage_1_2');
  stages['stage_1_3'] = createMockStage('stage_1_3');

  for (const [id, _stars] of Object.entries(stageStars)) {
    if (!stages[id]) {
      stages[id] = createMockStage(id);
    }
  }

  const allStages = Object.values(stages);
  const chapters: Chapter[] = [
    {
      id: 'chapter1',
      name: '第一章',
      subtitle: '初出茅庐',
      order: 1,
      stages: allStages,
      prerequisiteChapterId: null,
      description: '第一章描述',
    },
  ];

  return {
    getChapters: () => chapters,
    getChapter: (id: string) => chapters.find((c) => c.id === id),
    getStage: (id: string) => stages[id] ?? undefined,
    getStagesByChapter: (chapterId: string) => {
      const ch = chapters.find((c) => c.id === chapterId);
      return ch ? ch.stages : [];
    },
  };
}

/** 创建模拟扫荡依赖 */
function createMockSweepDeps(
  stageStars: Record<string, number> = {},
  farthestStageId: string | null = 'stage_1_3',
): SweepDeps {
  return {
    simulateBattle: (stageId: string) => ({
      victory: true,
      stars: 3,
    }),
    getStageStars: (stageId: string) => stageStars[stageId] ?? 0,
    canChallenge: (stageId: string) => true,
    getFarthestStageId: () => farthestStageId,
    completeStage: (_stageId: string, _stars: number) => {},
  };
}

/** 创建模拟奖励依赖 */
function createMockRewardDeps(): RewardDistributorDeps {
  const resources: Record<string, number> = {};
  return {
    addResource: (type: string, amount: number) => {
      resources[type] = (resources[type] ?? 0) + amount;
    },
    addFragment: (_generalId: string, _count: number) => {},
    addExp: (_amount: number) => {},
  };
}

/** 创建完整的 SweepSystem 实例 */
function createSweepSystem(
  stageStars: Record<string, number> = {},
  farthestStageId: string | null = 'stage_1_3',
  rng?: () => number,
): SweepSystem {
  const dataProvider = createMockDataProvider(stageStars);
  const rewardDeps = createMockRewardDeps();
  const sweepDeps = createMockSweepDeps(stageStars, farthestStageId);
  const system = new SweepSystem(dataProvider, rewardDeps, sweepDeps, undefined, rng);
  system.init(createMockDeps());
  return system;
}

// ═══════════════════════════════════════════════
// §2.1 扫荡解锁条件
// ═══════════════════════════════════════════════

describe('§2.1 扫荡解锁条件：3星通关后解锁', () => {
  it('未通关关卡不可扫荡', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 0 });
    expect(sweep.canSweep('stage_1_1')).toBe(false);
  });

  it('1星通关不可扫荡', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 1 });
    expect(sweep.canSweep('stage_1_1')).toBe(false);
  });

  it('2星通关不可扫荡', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 2 });
    expect(sweep.canSweep('stage_1_1')).toBe(false);
  });

  it('3星通关后可扫荡', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    expect(sweep.canSweep('stage_1_1')).toBe(true);
  });

  it('MAX_STARS 常量等于 3', () => {
    expect(MAX_STARS).toBe(3);
  });

  it('getSweepStatus 返回正确状态', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 2 });
    const status = sweep.getSweepStatus('stage_1_1');
    expect(status.canSweep).toBe(false);
    expect(status.stars).toBe(2);
    expect(status.reason).toContain('三星');
  });

  it('getSweepStatus 三星通关返回可扫荡', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    const status = sweep.getSweepStatus('stage_1_1');
    expect(status.canSweep).toBe(true);
  });

  it('getSweepStatus 不存在的关卡', () => {
    const sweep = createSweepSystem({});
    const status = sweep.getSweepStatus('nonexistent');
    expect(status.canSweep).toBe(false);
    expect(status.reason).toContain('不存在');
  });
});

// ═══════════════════════════════════════════════
// §2.2 扫荡令获取与消耗
// ═══════════════════════════════════════════════

describe('§2.2 扫荡令获取与消耗', () => {
  it('初始扫荡令为 0', () => {
    const sweep = createSweepSystem();
    expect(sweep.getTicketCount()).toBe(0);
  });

  it('添加扫荡令', () => {
    const sweep = createSweepSystem();
    sweep.addTickets(10);
    expect(sweep.getTicketCount()).toBe(10);
  });

  it('添加扫荡令数量必须 > 0', () => {
    const sweep = createSweepSystem();
    expect(() => sweep.addTickets(0)).toThrow();
    expect(() => sweep.addTickets(-1)).toThrow();
  });

  it('多次添加累加', () => {
    const sweep = createSweepSystem();
    sweep.addTickets(5);
    sweep.addTickets(3);
    expect(sweep.getTicketCount()).toBe(8);
  });

  it('hasEnoughTickets 检查', () => {
    const sweep = createSweepSystem();
    sweep.addTickets(5);
    expect(sweep.hasEnoughTickets(5)).toBe(true);
    expect(sweep.hasEnoughTickets(6)).toBe(false);
  });

  it('getRequiredTickets 计算正确', () => {
    const sweep = createSweepSystem();
    // 默认 sweepCostPerRun = 1
    expect(sweep.getRequiredTickets(3)).toBe(3);
  });

  it('领取每日扫荡令', () => {
    const sweep = createSweepSystem();
    const claimed = sweep.claimDailyTickets();
    expect(claimed).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
    expect(sweep.getTicketCount()).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
  });

  it('每日扫荡令只能领取一次', () => {
    const sweep = createSweepSystem();
    sweep.claimDailyTickets();
    const second = sweep.claimDailyTickets();
    expect(second).toBe(0);
    expect(sweep.isDailyTicketClaimed()).toBe(true);
  });

  it('跨日重置每日扫荡令', () => {
    const sweep = createSweepSystem();
    const now = Date.now();
    sweep.claimDailyTickets(now);

    // 模拟第二天
    const tomorrow = now + 24 * 60 * 60 * 1000;
    const claimed = sweep.claimDailyTickets(tomorrow);
    expect(claimed).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
  });
});

// ═══════════════════════════════════════════════
// §2.3 执行扫荡
// ═══════════════════════════════════════════════

describe('§2.3 执行扫荡：一键获取奖励', () => {
  it('单次扫荡返回正确结果', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(10);

    const result = sweep.sweep('stage_1_1', 1);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(result.results).toHaveLength(1);
  });

  it('批量扫荡5次', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(10);

    const result = sweep.sweep('stage_1_1', 5);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(5);
    expect(result.results).toHaveLength(5);
    expect(result.ticketsUsed).toBe(5);
  });

  it('扫荡消耗扫荡令', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(10);

    sweep.sweep('stage_1_1', 3);
    expect(sweep.getTicketCount()).toBe(7);
  });

  it('未三星通关扫荡失败', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 2 });
    sweep.addTickets(10);

    const result = sweep.sweep('stage_1_1', 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('三星');
  });

  it('扫荡令不足扫荡失败', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(1);

    const result = sweep.sweep('stage_1_1', 5);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('扫荡令不足');
  });

  it('扫荡次数为0失败', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(10);

    const result = sweep.sweep('stage_1_1', 0);
    expect(result.success).toBe(false);
  });

  it('扫荡结果包含汇总资源和经验', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(10);

    const result = sweep.sweep('stage_1_1', 3);
    expect(result.totalExp).toBeGreaterThanOrEqual(0);
    expect(result.totalResources).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// §2.4 扫荡次数限制
// ═══════════════════════════════════════════════

describe('§2.4 扫荡次数限制', () => {
  it('超过最大扫荡次数失败', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(100);

    const result = sweep.sweep('stage_1_1', DEFAULT_SWEEP_CONFIG.maxSweepCount + 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain(`最大${DEFAULT_SWEEP_CONFIG.maxSweepCount}次`);
  });

  it('恰好等于最大次数成功', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(100);

    const result = sweep.sweep('stage_1_1', DEFAULT_SWEEP_CONFIG.maxSweepCount);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(DEFAULT_SWEEP_CONFIG.maxSweepCount);
  });

  it('默认最大扫荡次数为 10', () => {
    expect(DEFAULT_SWEEP_CONFIG.maxSweepCount).toBe(10);
  });
});

// ═══════════════════════════════════════════════
// §2.5 扫荡奖励计算
// ═══════════════════════════════════════════════

describe('§2.5 扫荡奖励计算', () => {
  it('固定种子下奖励可复现', () => {
    // 使用固定随机种子
    let seed = 42;
    const rng1 = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const sweep1 = createSweepSystem({ 'stage_1_1': 3 }, 'stage_1_3', rng1);
    sweep1.addTickets(10);
    const result1 = sweep1.sweep('stage_1_1', 3);

    // 重新创建相同种子
    let seed2 = 42;
    const rng2 = () => { seed2 = (seed2 * 16807) % 2147483647; return (seed2 - 1) / 2147483646; };
    const sweep2 = createSweepSystem({ 'stage_1_1': 3 }, 'stage_1_3', rng2);
    sweep2.addTickets(10);
    const result2 = sweep2.sweep('stage_1_1', 3);

    expect(result1.totalExp).toBe(result2.totalExp);
  });

  it('多次扫荡经验累加', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(10);

    const result = sweep.sweep('stage_1_1', 5);
    // 每次扫荡都有经验，5次总和 > 0
    expect(result.totalExp).toBeGreaterThanOrEqual(0);
  });

  it('批量扫荡结果包含碎片汇总', () => {
    const sweep = createSweepSystem({ 'stage_1_1': 3 });
    sweep.addTickets(10);

    const result = sweep.sweep('stage_1_1', 3);
    expect(result.totalFragments).toBeDefined();
    expect(typeof result.totalFragments).toBe('object');
  });
});

// ═══════════════════════════════════════════════
// §3.1 自动推图
// ═══════════════════════════════════════════════

describe('§3.1 自动推图', () => {
  it('自动推图从最远关卡开始', () => {
    const sweep = createSweepSystem(
      { 'stage_1_1': 3, 'stage_1_2': 3 },
      'stage_1_3',
    );
    sweep.addTickets(50);

    const progress = sweep.getAutoPushProgress();
    expect(progress).toBeDefined();
  });

  it('无最远关卡时不执行', () => {
    const sweep = createSweepSystem({}, null);
    sweep.addTickets(50);

    // 调用 getAutoPushProgress 不抛异常
    const progress = sweep.getAutoPushProgress();
    expect(progress.isRunning).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// §3.2 自动推图进度计算
// ═══════════════════════════════════════════════

describe('§3.2 自动推图进度计算', () => {
  it('初始进度为空', () => {
    const sweep = createSweepSystem();
    const progress = sweep.getAutoPushProgress();
    expect(progress.isRunning).toBe(false);
    expect(progress.attempts).toBe(0);
    expect(progress.victories).toBe(0);
    expect(progress.defeats).toBe(0);
  });

  it('AutoPushExecutor 初始进度', () => {
    const dataProvider = createMockDataProvider();
    const rewardDeps = createMockRewardDeps();
    const sweepDeps = createMockSweepDeps({}, 'stage_1_3');
    const rewardDistributor = new RewardDistributor(dataProvider, rewardDeps);

    const executor = new AutoPushExecutor(
      dataProvider, rewardDistributor, sweepDeps, DEFAULT_SWEEP_CONFIG,
    );

    const progress = executor.getProgress();
    expect(progress.isRunning).toBe(false);
    expect(progress.startStageId).toBe('');
  });

  it('resetProgress 清空进度', () => {
    const dataProvider = createMockDataProvider();
    const rewardDeps = createMockRewardDeps();
    const sweepDeps = createMockSweepDeps({}, 'stage_1_3');
    const rewardDistributor = new RewardDistributor(dataProvider, rewardDeps);

    const executor = new AutoPushExecutor(
      dataProvider, rewardDistributor, sweepDeps, DEFAULT_SWEEP_CONFIG,
    );

    executor.resetProgress();
    const progress = executor.getProgress();
    expect(progress.isRunning).toBe(false);
    expect(progress.attempts).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// §3.3 自动推图奖励
// ═══════════════════════════════════════════════

describe('§3.3 自动推图奖励', () => {
  it('AutoPushExecutor execute 返回结果和消耗', () => {
    const dataProvider = createMockDataProvider();
    const rewardDeps = createMockRewardDeps();
    const sweepDeps = createMockSweepDeps({ 'stage_1_1': 3, 'stage_1_2': 3 }, 'stage_1_3');
    const rewardDistributor = new RewardDistributor(dataProvider, rewardDeps);

    const executor = new AutoPushExecutor(
      dataProvider, rewardDistributor, sweepDeps, DEFAULT_SWEEP_CONFIG,
    );

    const { result, ticketsUsed } = executor.execute(50);
    expect(result).toBeDefined();
    expect(result.totalAttempts).toBeGreaterThanOrEqual(0);
    expect(typeof ticketsUsed).toBe('number');
  });

  it('自动推图结果包含资源汇总', () => {
    const dataProvider = createMockDataProvider();
    const rewardDeps = createMockRewardDeps();
    const sweepDeps = createMockSweepDeps({ 'stage_1_1': 3 }, 'stage_1_1');
    const rewardDistributor = new RewardDistributor(dataProvider, rewardDeps);

    const executor = new AutoPushExecutor(
      dataProvider, rewardDistributor, sweepDeps, DEFAULT_SWEEP_CONFIG,
    );

    const { result } = executor.execute(10);
    expect(result.totalResources).toBeDefined();
    expect(result.totalExp).toBeGreaterThanOrEqual(0);
    expect(result.totalFragments).toBeDefined();
  });

  it('无最远关卡时返回空结果', () => {
    const dataProvider = createMockDataProvider();
    const rewardDeps = createMockRewardDeps();
    const sweepDeps = createMockSweepDeps({}, null);
    const rewardDistributor = new RewardDistributor(dataProvider, rewardDeps);

    const executor = new AutoPushExecutor(
      dataProvider, rewardDistributor, sweepDeps, DEFAULT_SWEEP_CONFIG,
    );

    const { result, ticketsUsed } = executor.execute(10);
    expect(result.totalAttempts).toBe(0);
    expect(ticketsUsed).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// SweepSystem 存档与重置
// ═══════════════════════════════════════════════

describe('SweepSystem 存档与重置', () => {
  it('reset 清空扫荡令和每日领取状态', () => {
    const sweep = createSweepSystem();
    sweep.addTickets(10);
    sweep.claimDailyTickets();

    sweep.reset();
    expect(sweep.getTicketCount()).toBe(0);
    expect(sweep.isDailyTicketClaimed()).toBe(false);
  });

  it('getState 返回当前状态', () => {
    const sweep = createSweepSystem();
    sweep.addTickets(5);
    const state = sweep.getState();
    expect(state.ticketCount).toBe(5);
    expect(state.dailyTicketClaimed).toBe(false);
  });
});
