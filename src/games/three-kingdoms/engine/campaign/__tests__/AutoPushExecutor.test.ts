/**
 * AutoPushExecutor 单元测试
 *
 * 覆盖自动推图执行器：
 * - 初始化与进度查询
 * - 执行自动推图（扫荡+模拟战斗）
 * - 最大尝试次数限制
 * - 扫荡令管理
 * - 进度重置
 * - ISubsystem 接口
 */

import { describe, it, expect, vi } from 'vitest';
import { AutoPushExecutor } from '../AutoPushExecutor';
import { RewardDistributor } from '../RewardDistributor';
import type { ICampaignDataProvider, Chapter, Stage } from '../campaign.types';
import type { SweepDeps, SweepConfig } from '../sweep.types';
import { DEFAULT_SWEEP_CONFIG } from '../sweep.types';

// ─────────────────────────────────────────────
// 辅助：创建测试用数据
// ─────────────────────────────────────────────

function createStage(id: string, chapterId: string, order: number): Stage {
  return {
    id,
    name: `关卡${id}`,
    type: order % 3 === 0 ? 'boss' : order % 2 === 0 ? 'elite' : 'normal',
    chapterId,
    order,
    enemyFormation: { id: `ef_${id}`, name: `ef_${id}`, units: [], recommendedPower: 100 * order },
    baseRewards: { grain: 100 * order, gold: 50 * order },
    baseExp: 50 * order,
    firstClearRewards: { gold: 20 },
    firstClearExp: 10,
    threeStarBonusMultiplier: 2.0,
    dropTable: [],
    recommendedPower: 100 * order,
    description: '',
  };
}

function createDataProvider(): ICampaignDataProvider {
  const chapter1: Chapter = {
    id: 'chapter1',
    name: '测试章1',
    subtitle: '',
    order: 1,
    stages: [
      createStage('s1', 'chapter1', 1),
      createStage('s2', 'chapter1', 2),
      createStage('s3', 'chapter1', 3),
    ],
    prerequisiteChapterId: null,
    description: '',
  };
  const chapter2: Chapter = {
    id: 'chapter2',
    name: '测试章2',
    subtitle: '',
    order: 2,
    stages: [
      createStage('s4', 'chapter2', 1),
      createStage('s5', 'chapter2', 2),
    ],
    prerequisiteChapterId: 'chapter1',
    description: '',
  };
  const chapters = [chapter1, chapter2];
  return {
    getChapters: () => chapters,
    getChapter: (id: string) => chapters.find(c => c.id === id),
    getStage: (id: string) => {
      for (const c of chapters) {
        const s = c.stages.find(st => st.id === id);
        if (s) return s;
      }
      return undefined;
    },
    getStagesByChapter: (chapterId: string) => chapters.find(c => c.id === chapterId)?.stages ?? [],
  };
}

function createRewardDistributor(provider: ICampaignDataProvider): RewardDistributor {
  return new RewardDistributor(
    provider,
    {
      addResource: vi.fn().mockReturnValue(0),
      addFragment: vi.fn(),
      addExp: vi.fn(),
    },
    () => 0.5, // 固定随机
  );
}

function createSweepDeps(overrides?: Partial<SweepDeps>): SweepDeps {
  return {
    simulateBattle: vi.fn().mockReturnValue({ victory: true, stars: 3 }),
    getStageStars: vi.fn().mockReturnValue(3),
    canChallenge: vi.fn().mockReturnValue(true),
    getFarthestStageId: vi.fn().mockReturnValue('s1'),
    completeStage: vi.fn(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 1. 初始化与进度
// ─────────────────────────────────────────────

describe('AutoPushExecutor 初始化与进度', () => {
  it('初始进度全为默认值', () => {
    const provider = createDataProvider();
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      createSweepDeps(),
      DEFAULT_SWEEP_CONFIG,
    );
    const progress = executor.getProgress();
    expect(progress.isRunning).toBe(false);
    expect(progress.startStageId).toBe('');
    expect(progress.currentStageId).toBe('');
    expect(progress.attempts).toBe(0);
    expect(progress.victories).toBe(0);
    expect(progress.defeats).toBe(0);
  });

  it('ISubsystem: name 属性', () => {
    const provider = createDataProvider();
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      createSweepDeps(),
      DEFAULT_SWEEP_CONFIG,
    );
    expect(executor.name).toBe('autoPushExecutor');
  });

  it('ISubsystem: update 不抛异常', () => {
    const provider = createDataProvider();
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      createSweepDeps(),
      DEFAULT_SWEEP_CONFIG,
    );
    expect(() => executor.update(16)).not.toThrow();
  });

  it('ISubsystem: getState 返回进度快照', () => {
    const provider = createDataProvider();
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      createSweepDeps(),
      DEFAULT_SWEEP_CONFIG,
    );
    const state = executor.getState();
    expect(state.isRunning).toBe(false);
  });

  it('resetProgress 恢复初始进度', () => {
    const provider = createDataProvider();
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      createSweepDeps(),
      DEFAULT_SWEEP_CONFIG,
    );
    executor.resetProgress();
    const progress = executor.getProgress();
    expect(progress.isRunning).toBe(false);
    expect(progress.attempts).toBe(0);
  });

  it('reset (ISubsystem) 等同于 resetProgress', () => {
    const provider = createDataProvider();
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      createSweepDeps(),
      DEFAULT_SWEEP_CONFIG,
    );
    executor.reset();
    expect(executor.getProgress().isRunning).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 2. 执行自动推图
// ─────────────────────────────────────────────

describe('AutoPushExecutor 执行', () => {
  it('无最远关卡时返回空结果', () => {
    const provider = createDataProvider();
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      createSweepDeps({ getFarthestStageId: () => null }),
      DEFAULT_SWEEP_CONFIG,
    );
    const { result, ticketsUsed } = executor.execute(10);
    expect(result.totalAttempts).toBe(0);
    expect(result.victories).toBe(0);
    expect(ticketsUsed).toBe(0);
  });

  it('三星关卡使用扫荡令', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 3, // 三星
      canChallenge: () => true,
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 1 },
    );
    const { result, ticketsUsed } = executor.execute(10);
    expect(result.victories).toBe(1);
    expect(ticketsUsed).toBe(1); // sweepCostPerRun=1
    expect(result.results).toHaveLength(1);
    expect(result.results[0].stageId).toBe('s1');
  });

  it('扫荡令不足时模拟战斗', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 3,
      canChallenge: () => true,
      simulateBattle: vi.fn().mockReturnValue({ victory: true, stars: 3 }),
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 1 },
    );
    const { result, ticketsUsed } = executor.execute(0); // 0张扫荡令
    expect(result.victories).toBe(1);
    expect(ticketsUsed).toBe(0);
    expect(sweepDeps.simulateBattle).toHaveBeenCalledWith('s1');
  });

  it('未三星关卡使用模拟战斗', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 1, // 未三星
      canChallenge: () => true,
      simulateBattle: vi.fn().mockReturnValue({ victory: true, stars: 2 }),
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 1 },
    );
    const { result } = executor.execute(10);
    expect(result.victories).toBe(1);
    expect(sweepDeps.simulateBattle).toHaveBeenCalledWith('s1');
    expect(sweepDeps.completeStage).toHaveBeenCalledWith('s1', 2);
  });

  it('模拟战斗失败时停止', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 1,
      canChallenge: () => true,
      simulateBattle: vi.fn().mockReturnValue({ victory: false, stars: 0 }),
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 5 },
    );
    const { result } = executor.execute(10);
    expect(result.defeats).toBe(1);
    expect(result.victories).toBe(0);
    expect(result.totalAttempts).toBe(1);
  });

  it('达到最大尝试次数时停止', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 3,
      canChallenge: () => true,
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 2 },
    );
    const { result } = executor.execute(10);
    expect(result.reachedMaxAttempts).toBe(true);
    expect(result.totalAttempts).toBe(2);
  });

  it('关卡不可挑战时停止', () => {
    const provider = createDataProvider();
    let callCount = 0;
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 3,
      canChallenge: () => {
        callCount++;
        return callCount <= 1;
      },
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 5 },
    );
    const { result } = executor.execute(10);
    expect(result.totalAttempts).toBeLessThanOrEqual(2);
  });

  it('推图到下一章', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's3', // chapter1 最后一关
      getStageStars: () => 3,
      canChallenge: () => true,
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 2 },
    );
    const { result } = executor.execute(10);
    // 应从 s3 推进到 s4 (chapter2 第一关)
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.endStageId).toBeDefined();
  });

  it('执行后进度标记为非运行中', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 3,
      canChallenge: () => true,
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );
    executor.execute(10);
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('汇总资源和碎片', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 3,
      canChallenge: () => true,
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 1 },
    );
    const { result } = executor.execute(10);
    expect(result.totalResources).toBeDefined();
    expect(result.totalExp).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// 3. 边界条件
// ─────────────────────────────────────────────

describe('AutoPushExecutor 边界条件', () => {
  it('autoPushMaxAttempts=0 时返回空结果', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 0 },
    );
    const { result } = executor.execute(10);
    expect(result.totalAttempts).toBe(0);
    expect(result.victories).toBe(0);
  });

  it('最后一关无下一关时停止', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's5', // chapter2 最后一关
      getStageStars: () => 3,
      canChallenge: () => true,
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 10 },
    );
    const { result } = executor.execute(10);
    expect(result.endStageId).toBe('s5');
    // 只有一关可推（s5之后无下一关）
    expect(result.totalAttempts).toBe(1);
  });

  it('多次执行不累积进度（每次重新初始化）', () => {
    const provider = createDataProvider();
    const sweepDeps = createSweepDeps({
      getFarthestStageId: () => 's1',
      getStageStars: () => 3,
      canChallenge: () => true,
    });
    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 1 },
    );
    executor.execute(10);
    executor.execute(10);
    // 进度应反映最后一次执行
    const progress = executor.getProgress();
    expect(progress.attempts).toBe(1);
  });
});
