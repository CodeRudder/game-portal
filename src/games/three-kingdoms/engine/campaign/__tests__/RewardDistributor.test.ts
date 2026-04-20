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
    // baseExp = 30
    expect(r1.exp).toBe(30);
    expect(r3.exp).toBe(45); // 30 * 1.5
  });

  it('BOSS关3星倍率为2.0', () => {
    const reward = distributor.calculateRewards('chapter1_stage8', 3, false);
    expect(reward.starMultiplier).toBe(2.0);
    // baseRewards: { grain: 400, gold: 200, troops: 80, mandate: 15 }
    // BOSS关有概率1.0的掉落（即使rng=1.0也会触发，因为 1.0 > 1.0 为 false）
    // 所以 grain = 800 + drop(200~350) = 1000~1150
    expect(reward.resources.grain).toBeGreaterThanOrEqual(800);
    expect(reward.resources.gold).toBeGreaterThanOrEqual(400);
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

    // baseExp = 30, firstClearExp = 80
    expect(normal.exp).toBe(30);
    expect(first.exp).toBe(110); // 30 + 80
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
    const reward = distributor.calculateRewards('chapter1_stage8', 1, false);
    // chapter1_stage8 dropTable前两项概率1.0
    expect(reward.resources.grain).toBeGreaterThan(400); // base 400 + drop
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
    // chapter1_stage3 有 guanyu 碎片掉落 probability: 0.1
    expect(reward.fragments['guanyu']).toBeGreaterThanOrEqual(1);
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

    // guanyu 碎片
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

// ─────────────────────────────────────────────
// 5. 预览
// ─────────────────────────────────────────────

describe('RewardDistributor 预览', () => {
  let distributor: RewardDistributor;

  beforeEach(() => {
    distributor = new RewardDistributor(dataProvider, createTrackedDeps().deps, fixedRng(0.5));
  });

  it('previewBaseRewards 返回基础奖励', () => {
    const preview = distributor.previewBaseRewards('chapter1_stage1');
    expect(preview.resources.grain).toBe(80);
    expect(preview.resources.gold).toBe(40);
    expect(preview.exp).toBe(30);
  });

  it('previewFirstClearRewards 返回首通奖励', () => {
    const preview = distributor.previewFirstClearRewards('chapter1_stage1');
    expect(preview.resources.grain).toBe(200);
    expect(preview.resources.gold).toBe(100);
    expect(preview.exp).toBe(80);
  });

  it('preview 不存在的关卡抛出异常', () => {
    expect(() => distributor.previewBaseRewards('nonexistent')).toThrow('关卡不存在');
    expect(() => distributor.previewFirstClearRewards('nonexistent')).toThrow('关卡不存在');
  });
});

// ─────────────────────────────────────────────
// 6. 综合场景
// ─────────────────────────────────────────────

describe('RewardDistributor 综合场景', () => {
  it('3星首通BOSS获得最大奖励', () => {
    const tracked = createTrackedDeps();
    // rng=0 触发所有掉落
    const distributor = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0));

    const reward = distributor.calculateRewards('chapter1_stage8', 3, true);

    // 3星: multiplier = 2.0
    // baseRewards: { grain: 400, gold: 200, troops: 80, mandate: 15 }
    // base * 2.0 = { grain: 800, gold: 400, troops: 160, mandate: 30 }
    // firstClearRewards: { grain: 1000, gold: 500, troops: 200, mandate: 30 }
    // + drops (rng=0 triggers all)
    expect(reward.resources.grain).toBeGreaterThanOrEqual(1800); // 800 + 1000 + drops
    expect(reward.isFirstClear).toBe(true);
    expect(reward.starMultiplier).toBe(2.0);
    // exp: baseExp * 2.0 + firstClearExp = 200 * 2 + 500 = 900
    expect(reward.exp).toBe(900);
  });

  it('重复通关（非首通）奖励较少', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, noDropRng);

    const first = distributor.calculateRewards('chapter1_stage1', 1, true);
    const repeat = distributor.calculateRewards('chapter1_stage1', 1, false);

    expect(first.resources.grain).toBeGreaterThan(repeat.resources.grain ?? 0);
    expect(first.exp).toBeGreaterThan(repeat.exp);
  });

  it('不同关卡奖励不同', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, noDropRng);

    const r1 = distributor.calculateRewards('chapter1_stage1', 1, false);
    const r2 = distributor.calculateRewards('chapter1_stage2', 1, false);

    // chapter1_stage2 基础奖励更高
    expect(r2.resources.grain).toBeGreaterThan(r1.resources.grain!);
    expect(r2.exp).toBeGreaterThan(r1.exp);
  });
});

// ─────────────────────────────────────────────
// 7. 星级加成边界
// ─────────────────────────────────────────────

describe('RewardDistributor 星级加成边界', () => {
  let distributor: RewardDistributor;

  beforeEach(() => {
    distributor = new RewardDistributor(dataProvider, createTrackedDeps().deps, noDropRng);
  });

  it('0星无奖励（倍率为0）', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 0, false);
    expect(reward.starMultiplier).toBe(0);
    expect(reward.resources.grain).toBe(0);
    expect(reward.resources.gold).toBe(0);
    expect(reward.exp).toBe(0);
  });

  it('星级超出3被截断为3星倍率', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 5, false);
    expect(reward.starMultiplier).toBe(1.5);
  });

  it('负星级按0星处理', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', -1, false);
    expect(reward.starMultiplier).toBe(0);
  });

  it('小数星级被截断', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 2.9, false);
    expect(reward.starMultiplier).toBe(1.0); // 截断为2星
  });

  it('1星和2星倍率相同', () => {
    const r1 = distributor.calculateRewards('chapter1_stage1', 1, false);
    const r2 = distributor.calculateRewards('chapter1_stage1', 2, false);
    expect(r1.starMultiplier).toBe(r2.starMultiplier);
  });
});

// ─────────────────────────────────────────────
// 8. 掉落表详细测试
// ─────────────────────────────────────────────

describe('RewardDistributor 掉落表详细', () => {
  it('rng=0 触发所有概率>0的掉落', () => {
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      fixedRng(0),
    );
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    // chapter1_stage1 dropTable: grain(prob 0.8), gold(prob 0.7)
    // rng=0 < 0.8 and 0.7, both trigger
    expect(reward.resources.grain).toBeGreaterThan(80); // base + drop
    expect(reward.resources.gold).toBeGreaterThan(40);
  });

  it('掉落资源正确合并到resources', () => {
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      fixedRng(0),
    );
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    // 掉落的grain合并到resources.grain中
    expect(reward.resources.grain).toBeGreaterThan(80);
  });

  it('无掉落时fragments为空对象', () => {
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      noDropRng,
    );
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    expect(Object.keys(reward.fragments)).toHaveLength(0);
  });

  it('固定rng=0.5 部分掉落触发', () => {
    const distributor = new RewardDistributor(
      dataProvider,
      createTrackedDeps().deps,
      fixedRng(0.5),
    );
    // chapter1_stage1 dropTable: grain(prob 0.8), gold(prob 0.7)
    // 0.5 < 0.8 → grain drops, 0.5 < 0.7 → gold drops
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    expect(reward.resources.grain).toBeGreaterThan(80);
    expect(reward.resources.gold).toBeGreaterThan(40);
  });
});

// ─────────────────────────────────────────────
// 9. 分发回调详细测试
// ─────────────────────────────────────────────

describe('RewardDistributor 分发回调详细', () => {
  it('0星奖励不调用addResource', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, noDropRng);
    const reward = distributor.calculateRewards('chapter1_stage1', 0, false);
    distributor.distribute(reward);
    // 0星倍率为0，资源为0，不应分发
    expect(Object.keys(tracked.resources)).toHaveLength(0);
  });

  it('经验为0时不调用addExp', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, noDropRng);
    const reward = distributor.calculateRewards('chapter1_stage1', 0, false);
    distributor.distribute(reward);
    expect(tracked.totalExp).toBe(0);
  });

  it('无addExp回调时不分发经验', () => {
    const deps: RewardDistributorDeps = {
      addResource: (_type: any, _amount: number) => _amount,
    };
    const distributor = new RewardDistributor(dataProvider, deps, noDropRng);
    const reward = distributor.calculateRewards('chapter1_stage1', 1, false);
    expect(() => distributor.distribute(reward)).not.toThrow();
  });

  it('calculateAndDistribute 返回值与手动计算一致', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, noDropRng);

    const calculated = distributor.calculateRewards('chapter1_stage1', 1, false);
    const distributed = distributor.calculateAndDistribute('chapter1_stage1', 1, false);

    expect(distributed.resources.grain).toBe(calculated.resources.grain);
    expect(distributed.resources.gold).toBe(calculated.resources.gold);
    expect(distributed.exp).toBe(calculated.exp);
  });

  it('多次分发累加正确', () => {
    const tracked = createTrackedDeps();
    const distributor = new RewardDistributor(dataProvider, tracked.deps, noDropRng);

    distributor.calculateAndDistribute('chapter1_stage1', 1, false);
    distributor.calculateAndDistribute('chapter1_stage1', 1, false);

    expect(tracked.resources['grain']).toBe(160); // 80 * 2
  });
});

// ─────────────────────────────────────────────
// 10. 预览详细测试
// ─────────────────────────────────────────────

describe('RewardDistributor 预览详细', () => {
  let distributor: RewardDistributor;

  beforeEach(() => {
    distributor = new RewardDistributor(dataProvider, createTrackedDeps().deps, fixedRng(0.5));
  });

  it('previewBaseRewards 不受星级影响', () => {
    const preview = distributor.previewBaseRewards('chapter1_stage1');
    // 返回的是原始配置值，不含星级倍率
    expect(preview.resources.grain).toBe(80);
  });

  it('previewFirstClearRewards 返回原始首通配置', () => {
    const preview = distributor.previewFirstClearRewards('chapter1_stage1');
    expect(preview.resources.grain).toBe(200);
    expect(preview.exp).toBe(80);
  });

  it('BOSS关预览包含troops和mandate', () => {
    const preview = distributor.previewBaseRewards('chapter1_stage8');
    expect(preview.resources.troops).toBeDefined();
    expect(preview.resources.mandate).toBeDefined();
  });

  it('预览不触发分发回调', () => {
    const tracked = createTrackedDeps();
    const dist = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0.5));
    dist.previewBaseRewards('chapter1_stage1');
    dist.previewFirstClearRewards('chapter1_stage1');
    expect(Object.keys(tracked.resources)).toHaveLength(0);
    expect(tracked.totalExp).toBe(0);
  });
});

// ─────────────────────────────────────────────
// 11. 不同关卡类型奖励对比
// ─────────────────────────────────────────────

describe('RewardDistributor 关卡类型对比', () => {
  let distributor: RewardDistributor;

  beforeEach(() => {
    distributor = new RewardDistributor(dataProvider, createTrackedDeps().deps, noDropRng);
  });

  it('BOSS关基础奖励高于普通关', () => {
    const normal = distributor.calculateRewards('chapter1_stage1', 1, false);
    const boss = distributor.calculateRewards('chapter1_stage8', 1, false);
    expect(boss.resources.grain!).toBeGreaterThan(normal.resources.grain!);
  });

  it('精英关经验高于普通关', () => {
    const normal = distributor.calculateRewards('chapter1_stage1', 1, false);
    const elite = distributor.calculateRewards('chapter1_stage7', 1, false);
    expect(elite.exp).toBeGreaterThan(normal.exp);
  });

  it('BOSS关3星首通获得最多资源', () => {
    const tracked = createTrackedDeps();
    const dist = new RewardDistributor(dataProvider, tracked.deps, fixedRng(0));
    const reward = dist.calculateRewards('chapter1_stage8', 3, true);
    const normalReward = distributor.calculateRewards('chapter1_stage1', 1, false);
    expect(reward.resources.grain!).toBeGreaterThan(normalReward.resources.grain! * 10);
  });
});
