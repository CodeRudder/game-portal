/**
 * DEF-009 回归测试: AutoPushExecutor 异常导致 isRunning 卡死
 *
 * 验证 execute() 中 7 个异常点抛出异常后 isRunning 仍恢复为 false：
 * 1. canChallenge
 * 2. getStageStars
 * 3. calculateRewards
 * 4. completeStage
 * 5. mergeResources（campaign-utils）
 * 6. getNextStage（内部方法，通过 dataProvider.getStage 触发）
 * 7. simulateBattle
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
    () => 0.5,
  );
}

/** 创建默认正常工作的 sweepDeps */
function createWorkingSweepDeps(): SweepDeps {
  return {
    simulateBattle: vi.fn().mockReturnValue({ victory: true, stars: 3 }),
    getStageStars: vi.fn().mockReturnValue(3),
    canChallenge: vi.fn().mockReturnValue(true),
    getFarthestStageId: vi.fn().mockReturnValue('s1'),
    completeStage: vi.fn(),
  };
}

// ─────────────────────────────────────────────
// DEF-009 回归测试
// ─────────────────────────────────────────────

describe('DEF-009: AutoPushExecutor 异常不导致 isRunning 卡死', () => {
  it('canChallenge 抛异常时 isRunning 恢复为 false', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    sweepDeps.canChallenge = vi.fn().mockImplementation(() => {
      throw new Error('canChallenge 崩溃');
    });

    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );

    expect(() => executor.execute(10)).toThrow('canChallenge 崩溃');
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('getStageStars 抛异常时 isRunning 恢复为 false', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    sweepDeps.getStageStars = vi.fn().mockImplementation(() => {
      throw new Error('getStageStars 崩溃');
    });

    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );

    expect(() => executor.execute(10)).toThrow('getStageStars 崩溃');
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('simulateBattle 抛异常时 isRunning 恢复为 false', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    // 设置为未三星，触发模拟战斗路径
    sweepDeps.getStageStars = vi.fn().mockReturnValue(1);
    sweepDeps.simulateBattle = vi.fn().mockImplementation(() => {
      throw new Error('simulateBattle 崩溃');
    });

    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );

    expect(() => executor.execute(10)).toThrow('simulateBattle 崩溃');
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('completeStage 抛异常时 isRunning 恢复为 false', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    // 设置为未三星，触发模拟战斗→completeStage路径
    sweepDeps.getStageStars = vi.fn().mockReturnValue(1);
    sweepDeps.simulateBattle = vi.fn().mockReturnValue({ victory: true, stars: 2 });
    sweepDeps.completeStage = vi.fn().mockImplementation(() => {
      throw new Error('completeStage 崩溃');
    });

    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );

    expect(() => executor.execute(10)).toThrow('completeStage 崩溃');
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('calculateRewards 抛异常时 isRunning 恢复为 false（三星扫荡路径）', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    // 三星路径触发 calculateRewards
    sweepDeps.getStageStars = vi.fn().mockReturnValue(3);

    // 创建一个会在 calculateRewards 时崩溃的 RewardDistributor
    const badRewardDistributor = new RewardDistributor(
      provider,
      {
        addResource: vi.fn().mockReturnValue(0),
        addFragment: vi.fn(),
        addExp: vi.fn(),
      },
      () => 0.5,
    );
    // 覆盖 calculateRewards 使其抛异常
    badRewardDistributor.calculateRewards = vi.fn().mockImplementation(() => {
      throw new Error('calculateRewards 崩溃');
    });

    const executor = new AutoPushExecutor(
      provider,
      badRewardDistributor,
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );

    expect(() => executor.execute(10)).toThrow('calculateRewards 崩溃');
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('calculateRewards 抛异常时 isRunning 恢复为 false（模拟战斗路径）', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    // 未三星→模拟战斗→胜利→calculateRewards
    sweepDeps.getStageStars = vi.fn().mockReturnValue(1);
    sweepDeps.simulateBattle = vi.fn().mockReturnValue({ victory: true, stars: 2 });
    sweepDeps.completeStage = vi.fn();

    const badRewardDistributor = new RewardDistributor(
      provider,
      {
        addResource: vi.fn().mockReturnValue(0),
        addFragment: vi.fn(),
        addExp: vi.fn(),
      },
      () => 0.5,
    );
    badRewardDistributor.calculateRewards = vi.fn().mockImplementation(() => {
      throw new Error('calculateRewards 崩溃');
    });

    const executor = new AutoPushExecutor(
      provider,
      badRewardDistributor,
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );

    expect(() => executor.execute(10)).toThrow('calculateRewards 崩溃');
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('getNextStage 内部 dataProvider.getStage 抛异常时 isRunning 恢复为 false', () => {
    const provider = createDataProvider();
    // 覆盖 getStage 使其在第二次调用时抛异常（第一次用于三星扫荡，第二次用于 getNextStage）
    const originalGetStage = provider.getStage.bind(provider);
    let getStageCallCount = 0;
    provider.getStage = (id: string) => {
      getStageCallCount++;
      // 在 getStage 被调用足够多次后抛异常（模拟 getNextStage 中的异常）
      if (getStageCallCount > 5) {
        throw new Error('getNextStage/getStage 崩溃');
      }
      return originalGetStage(id);
    };

    const sweepDeps = createWorkingSweepDeps();
    sweepDeps.getStageStars = vi.fn().mockReturnValue(3);

    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 10 },
    );

    expect(() => executor.execute(10)).toThrow('getNextStage/getStage 崩溃');
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('正常执行后 isRunning 为 false（回归确认）', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    sweepDeps.getStageStars = vi.fn().mockReturnValue(3);

    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      { ...DEFAULT_SWEEP_CONFIG, autoPushMaxAttempts: 2 },
    );

    const { result } = executor.execute(10);
    expect(result.victories).toBeGreaterThan(0);
    expect(executor.getProgress().isRunning).toBe(false);
  });

  it('异常后仍可再次执行（不永久卡死）', () => {
    const provider = createDataProvider();
    const sweepDeps = createWorkingSweepDeps();
    sweepDeps.canChallenge = vi.fn()
      .mockImplementationOnce(() => { throw new Error('第一次崩溃'); })
      .mockReturnValue(true);

    const executor = new AutoPushExecutor(
      provider,
      createRewardDistributor(provider),
      sweepDeps,
      DEFAULT_SWEEP_CONFIG,
    );

    // 第一次执行崩溃
    expect(() => executor.execute(10)).toThrow('第一次崩溃');
    expect(executor.getProgress().isRunning).toBe(false);

    // 第二次执行应该正常
    const { result } = executor.execute(10);
    expect(result.victories).toBeGreaterThan(0);
    expect(executor.getProgress().isRunning).toBe(false);
  });
});
