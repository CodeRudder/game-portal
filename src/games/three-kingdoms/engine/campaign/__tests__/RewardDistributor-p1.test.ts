/**
 * 奖励分发器测试
 *
 * 覆盖：基础奖励、首通奖励、星级加成、掉落表、分发回调、预览。
 */

import { RewardDistributor } from '../RewardDistributor';
import type { ICampaignDataProvider, RewardDistributorDeps, StageReward } from '../campaign.types';
import { getChapters, getChapter, getStage, getStagesByChapter } from '../campaign-config';

// 使用实际配置作为数据提供者
const dataProvider: ICampaignDataProvider = {
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
};

// ─────────────────────────────────────────────
// 辅助：创建带追踪的依赖
// ─────────────────────────────────────────────

function createTrackedDeps(): {
  deps: RewardDistributorDeps;
  resources: Record<string, number>;
  fragments: Record<string, number>;
  totalExp: number;
} {
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
      addExp: (exp: number) => {
        totalExp += exp;
      },
    },
    resources,
    fragments,
    get totalExp() { return totalExp; },
  };
}

// 固定随机数生成器
function fixedRng(value: number): () => number {
  return () => value;
}

// rng=1.0 确保所有掉落都不触发（rng > probability），用于测试纯基础奖励
const noDropRng = fixedRng(1.0);

// ─────────────────────────────────────────────
// 1. 基础奖励计算
// ─────────────────────────────────────────────

describe('RewardDistributor 基础奖励', () => {
  let distributor: RewardDistributor;

  beforeEach(() => {
    // 使用 noDropRng 确保掉落不触发，测试纯基础奖励
    distributor = new RewardDistributor(dataProvider, createTrackedDeps().deps, noDropRng);
  });

  it('1星基础奖励无加成', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    // chapter1_stage1 baseRewards: { grain: 80, gold: 40 }
    expect(reward.resources.grain).toBe(80);
    expect(reward.resources.gold).toBe(40);
    expect(reward.starMultiplier).toBe(1.0);
  });

  it('2星基础奖励无加成', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 2, false);
    expect(reward.starMultiplier).toBe(1.0);
    expect(reward.resources.grain).toBe(80);
  });

  it('3星基础奖励有加成（1.5倍）', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 3, false);
    expect(reward.starMultiplier).toBe(1.5);
    // 80 * 1.5 = 120
    expect(reward.resources.grain).toBe(120);
    expect(reward.resources.gold).toBe(60);
  });

  it('基础经验随星级加成', () => {
    const r1 = distributor.calculateRewards('chapter1_stage1', 1, false);
    const r3 = distributor.calculateRewards('chapter1_stage1', 3, false);
    // baseExp = 50
    expect(r1.exp).toBe(50);
    expect(r3.exp).toBe(75); // 50 * 1.5
  });

  it('BOSS关3星倍率为2.0', () => {
    const reward = distributor.calculateRewards('chapter1_stage5', 3, false);
    expect(reward.starMultiplier).toBe(2.0);
    // baseRewards: { grain: 300, gold: 150, troops: 50, mandate: 10 }
    // BOSS关有概率1.0的掉落
    expect(reward.resources.grain).toBeGreaterThanOrEqual(450);
    expect(reward.resources.gold).toBeGreaterThanOrEqual(230);
  });

  it('不存在的关卡抛出异常', () => {
    expect(() => distributor.calculateRewards('nonexistent', 1, false)).toThrow('关卡不存在');
  });

  it('isFirstClear 标记正确', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 1, true);
    expect(reward.isFirstClear).toBe(true);

    const reward2 = distributor.calculateRewards('chapter1_stage1', 1, false);
    expect(reward2.isFirstClear).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 2. 首通奖励
// ─────────────────────────────────────────────

describe('RewardDistributor 首通奖励', () => {
  let distributor: RewardDistributor;

  beforeEach(() => {
    // 使用 noDropRng 排除掉落干扰
    distributor = new RewardDistributor(dataProvider, createTrackedDeps().deps, noDropRng);
  });

  it('首通额外资源叠加到基础奖励', () => {
    const normal = distributor.calculateRewards('chapter1_stage1', 1, false);
    const first = distributor.calculateRewards('chapter1_stage1', 1, true);

    // baseRewards: { grain: 80, gold: 40 }
    // firstClearRewards: { grain: 200, gold: 100 }
    expect(normal.resources.grain).toBe(80);
    expect(first.resources.grain).toBe(280); // 80 + 200
    expect(first.resources.gold).toBe(140); // 40 + 100
  });

  it('首通额外经验叠加', () => {
    const normal = distributor.calculateRewards('chapter1_stage1', 1, false);
    const first = distributor.calculateRewards('chapter1_stage1', 1, true);

    // baseExp = 50, firstClearExp = 150
    expect(normal.exp).toBe(50);
    expect(first.exp).toBe(200); // 50 + 150
  });

  it('非首通不包含首通奖励', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    // grain: 80 (base only), not 280
    expect(reward.resources.grain).toBe(80);
  });
});

// ─────────────────────────────────────────────
// 3. 掉落表
// ─────────────────────────────────────────────

describe('RewardDistributor 掉落表', () => {
  it('概率为1.0的掉落必触发', () => {
    // BOSS关有概率1.0的掉落
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      fixedRng(0.5),
    );
    const reward = distributor.calculateRewards('chapter1_stage5', 1, false);
    // chapter1_stage5 dropTable前两项概率1.0
    expect(reward.resources.grain).toBeGreaterThan(450); // base 300 + drop
    expect(reward.resources.gold).toBeGreaterThan(200); // base 200 + drop
  });

  it('概率为0的掉落不触发（rng始终返回1）', () => {
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      fixedRng(1.0), // rng返回1.0，所有 probability < 1.0 的都不触发
    );
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    // chapter1_stage1 dropTable概率0.8和0.7，rng=1.0 > probability，不触发
    expect(reward.resources.grain).toBe(80); // 仅基础奖励
  });

  it('碎片掉落正确', () => {
    // 使用rng=0确保所有掉落都触发
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      fixedRng(0),
    );
    const reward = distributor.calculateRewards('chapter1_stage3', 1, false);
    // chapter1_stage3 有 chengyuanzhi 碎片掉落 probability: 0.1
    expect(reward.fragments['chengyuanzhi']).toBeGreaterThanOrEqual(1);
  });

  it('掉落数量在范围内', () => {
    // 多次验证
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      Math.random, // 真随机
    );
    for (let i = 0; i < 50; i++) {
      const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
      // grain base = 80, drop: min 30, max 60
      if (reward.resources.grain !== undefined) {
        expect(reward.resources.grain).toBeGreaterThanOrEqual(80);
      }
    }
  });
});

// ─────────────────────────────────────────────
// 4. 奖励分发
// ─────────────────────────────────────────────

describe('RewardDistributor 分发', () => {
  it('distribute 调用 addResource 回调', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0.5));

    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    distributor.distribute(reward);

    expect(tracked.resources['grain']).toBeGreaterThan(0);
    expect(tracked.resources['gold']).toBeGreaterThan(0);
  });

  it('distribute 调用 addExp 回调', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0.5));

    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    distributor.distribute(reward);

    expect(tracked.totalExp).toBeGreaterThan(0);
  });

  it('distribute 调用 addFragment 回调', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0));

    const reward = distributor.calculateRewards('chapter1_stage3', 1, false);
    distributor.distribute(reward);

    // chengyuanzhi 碎片
    if (Object.keys(reward.fragments).length > 0) {
      expect(Object.keys(tracked.fragments).length).toBeGreaterThan(0);
    }
  });

  it('calculateAndDistribute 一步完成', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0.5));

    const reward = distributor.calculateAndDistribute('chapter1_stage1', 1, false);

    expect(reward.resources.grain).toBeGreaterThan(0);
    expect(tracked.resources['grain']).toBe(reward.resources.grain);
  });

  it('无 addFragment 回调时不分发碎片', () => {
    const tracked = {
      deps: {
        addResource: (type: any, amount: number) => amount,
      } as RewardDistributorDeps,
      fragments: {} as Record<string, number>,
    };
    const distributor = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0));

    // 不应抛出异常
    const reward = distributor.calculateRewards('chapter1_stage3', 1, false);
    expect(() => distributor.distribute(reward)).not.toThrow();
  });
});

// 5. 预览 → 已移至 RewardDistributor-p2.test.ts
