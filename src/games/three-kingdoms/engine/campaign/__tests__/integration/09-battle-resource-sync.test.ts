/**
 * 集成测试：战斗↔资源串联（§7.1 ~ §7.5）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 5 个流程：
 *   §7.1 战斗消耗→资源扣减：体力/兵力消耗正确
 *   §7.2 战斗奖励→资源入账：金币/经验/材料入账
 *   §7.3 首通奖励→资源暴击：首次通关额外奖励
 *   §7.4 重复奖励→日常资源获取：重复通关奖励递减或固定
 *   §7.5 兵力/粮草资源获取与恢复：兵力恢复机制
 *
 * 测试策略：使用 ResourceSystem + RewardDistributor + CampaignProgressSystem 真实实例，
 * 验证战斗→资源的完整串联，重点关注资源数值的正确性。
 */

import { ResourceSystem } from '../../../resource/ResourceSystem';
import { RewardDistributor } from '../../RewardDistributor';
import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import type {
  RewardDistributorDeps,
  StageReward,
  DropTableEntry,
} from '../../campaign.types';
import { MAX_STARS } from '../../campaign.types';
import {
  campaignDataProvider,
  getStage,
  getStagesByChapter,
  getChapters,
} from '../../campaign-config';
import type { ResourceType, Resources } from '../../../shared/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建完整的资源追踪 mock */
function createTrackedDeps(): {
  deps: RewardDistributorDeps;
  resourceLog: Array<{ type: string; amount: number }>;
  fragmentLog: Array<{ generalId: string; count: number }>;
  expLog: number[];
} {
  const resourceLog: Array<{ type: string; amount: number }> = [];
  const fragmentLog: Array<{ generalId: string; count: number }> = [];
  const expLog: number[] = [];

  return {
    resourceLog,
    fragmentLog,
    expLog,
    deps: {
      addResource: (type, amount) => {
        resourceLog.push({ type, amount });
        return amount;
      },
      addFragment: (generalId, count) => {
        fragmentLog.push({ generalId, count });
      },
      addExp: (exp) => {
        expLog.push(exp);
      },
    },
  };
}

/** 创建固定种子 RNG */
function createSeededRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

/** 创建测试环境 */
function createEnv() {
  const resource = new ResourceSystem();
  const progress = new CampaignProgressSystem(campaignDataProvider);
  return { resource, progress };
}

/** 使用 ResourceSystem 真实实例执行奖励分发 */
function distributeRewards(
  resource: ResourceSystem,
  stageId: string,
  stars: number,
  isFirstClear: boolean,
  rng?: () => number,
): StageReward {
  const deps: RewardDistributorDeps = {
    addResource: (type, amount) => resource.addResource(type, amount),
  };
  const dist = new RewardDistributor(campaignDataProvider, deps, rng);
  return dist.calculateAndDistribute(stageId, stars, isFirstClear);
}

// ═══════════════════════════════════════════════
// §7.1 战斗消耗→资源扣减
// ═══════════════════════════════════════════════

describe('§7.1 战斗消耗→资源扣减', () => {
  let resource: ResourceSystem;

  beforeEach(() => {
    resource = new ResourceSystem();
  });

  it('should deduct troops when consuming for battle', () => {
    const troopsBefore = resource.getAmount('troops');

    // 消耗兵力
    resource.consumeResource('troops', 10);

    expect(resource.getAmount('troops')).toBe(troopsBefore - 10);
  });

  it('should throw error when troops are insufficient', () => {
    const troopsAvailable = resource.getAmount('troops');

    expect(() => {
      resource.consumeResource('troops', troopsAvailable + 100);
    }).toThrow();
  });

  it('should deduct grain when consuming for battle', () => {
    const grainBefore = resource.getAmount('grain');

    // 消耗粮草（需考虑 MIN_GRAIN_RESERVE 保护）
    const available = grainBefore - 100; // MIN_GRAIN_RESERVE
    if (available > 0) {
      resource.consumeResource('grain', Math.min(available, 50));
      expect(resource.getAmount('grain')).toBeLessThan(grainBefore);
    }
  });

  it('should enforce grain reserve protection (MIN_GRAIN_RESERVE=10)', () => {
    // MIN_GRAIN_RESERVE = 10, 可用 = grain - 10
    resource.setResource('grain', 50);

    // 可用 = 50 - 10 = 40, 消耗 40 应成功
    resource.consumeResource('grain', 40);
    expect(resource.getAmount('grain')).toBe(10);

    // 消耗超过可用量应抛出异常
    expect(() => {
      resource.consumeResource('grain', 1);
    }).toThrow();
  });

  it('should check affordability before consuming', () => {
    const result = resource.canAfford({
      grain: 10,
      gold: 10,
      troops: 0,
      mandate: 0,
      techPoint: 0,
    });

    // 初始资源 500grain/300gold，应该能负担
    expect(result.canAfford).toBe(true);
  });

  it('should report shortages when resources insufficient', () => {
    const result = resource.canAfford({
      grain: 99999,
      gold: 0,
      troops: 0,
      mandate: 0,
      techPoint: 0,
    });

    expect(result.canAfford).toBe(false);
    expect(result.shortages.grain).toBeDefined();
  });

  it('should perform atomic batch consumption', () => {
    const grainBefore = resource.getAmount('grain');
    const goldBefore = resource.getAmount('gold');

    resource.consumeBatch({
      grain: 50,
      gold: 30,
      troops: 0,
      mandate: 0,
      techPoint: 0,
    });

    expect(resource.getAmount('grain')).toBe(grainBefore - 50);
    expect(resource.getAmount('gold')).toBe(goldBefore - 30);
  });

  it('should rollback all on batch consumption failure', () => {
    const grainBefore = resource.getAmount('grain');
    const goldBefore = resource.getAmount('gold');

    expect(() => {
      resource.consumeBatch({
        grain: 10,
        gold: 99999, // 超出
        troops: 0,
        mandate: 0,
        techPoint: 0,
      });
    }).toThrow();

    // 批量消耗失败，不应扣除任何资源
    expect(resource.getAmount('grain')).toBe(grainBefore);
    expect(resource.getAmount('gold')).toBe(goldBefore);
  });
});

// ═══════════════════════════════════════════════
// §7.2 战斗奖励→资源入账
// ═══════════════════════════════════════════════

describe('§7.2 战斗奖励→资源入账', () => {
  let resource: ResourceSystem;
  let progress: CampaignProgressSystem;

  beforeEach(() => {
    ({ resource, progress } = createEnv());
  });

  it('should add gold to resource system after battle', () => {
    const goldBefore = resource.getAmount('gold');

    distributeRewards(resource, 'chapter1_stage1', 3, true);

    expect(resource.getAmount('gold')).toBeGreaterThan(goldBefore);
  });

  it('should add grain to resource system after battle', () => {
    const grainBefore = resource.getAmount('grain');

    distributeRewards(resource, 'chapter1_stage1', 3, true);

    expect(resource.getAmount('grain')).toBeGreaterThan(grainBefore);
  });

  it('should add correct base reward amounts for 1-star clear', () => {
    const stage = getStage('chapter1_stage1')!;
    const goldBefore = resource.getAmount('gold');
    const grainBefore = resource.getAmount('grain');

    // 使用不触发掉落的 RNG
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const reward = distributeRewards(resource, 'chapter1_stage1', 1, false, noDrop);

    // 1星 = 1.0倍率，无首通
    const expectedGold = stage.baseRewards.gold!;
    const expectedGrain = stage.baseRewards.grain!;

    expect(resource.getAmount('gold') - goldBefore).toBe(expectedGold);
    expect(resource.getAmount('grain') - grainBefore).toBe(expectedGrain);
  });

  it('should apply 3-star multiplier (2.0x) to base rewards', () => {
    const stage = getStage('chapter1_stage1')!;
    const goldBefore = resource.getAmount('gold');

    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const reward = distributeRewards(resource, 'chapter1_stage1', 3, false, noDrop);

    const expectedGold = Math.floor(stage.baseRewards.gold! * 2.0);
    expect(resource.getAmount('gold') - goldBefore).toBe(expectedGold);
  });

  it('should include drop table resources in total income', () => {
    const grainBefore = resource.getAmount('grain');
    const stage = getStage('chapter1_stage1')!;

    // 使用触发所有掉落的 RNG
    const allDrop = createSeededRng([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    distributeRewards(resource, 'chapter1_stage1', 1, false, allDrop);

    // grain 应包含基础 + 掉落
    const grainDrop = stage.dropTable.find(d => d.type === 'resource' && d.resourceType === 'grain');
    if (grainDrop) {
      const minExpected = stage.baseRewards.grain! + grainDrop.minAmount;
      expect(resource.getAmount('grain') - grainBefore).toBeGreaterThanOrEqual(minExpected);
    }
  });

  it('should respect resource caps when adding rewards', () => {
    // 设置一个较低的上限
    resource.setCap('grain', 100);
    resource.setResource('grain', 99);

    // 添加大量 grain 奖励
    const added = resource.addResource('grain', 500);

    // 应被截断到上限
    expect(added).toBe(1); // 100 - 99 = 1
    expect(resource.getAmount('grain')).toBe(100);
  });
});

// ═══════════════════════════════════════════════
// §7.3 首通奖励→资源暴击
// ═══════════════════════════════════════════════

describe('§7.3 首通奖励→资源暴击', () => {
  let resource: ResourceSystem;
  let tracked: ReturnType<typeof createTrackedDeps>;

  beforeEach(() => {
    resource = new ResourceSystem();
    tracked = createTrackedDeps();
  });

  it('should grant first clear bonus resources on initial clear', () => {
    const stage = getStage('chapter1_stage1')!;
    const dist = new RewardDistributor(campaignDataProvider, tracked.deps, createSeededRng([0.99, 0.99, 0.99]));

    const reward = dist.calculateRewards('chapter1_stage1', 3, true);

    // 首通资源应包含 firstClearRewards
    const expectedGrain = Math.floor(stage.baseRewards.grain! * 2.0) + (stage.firstClearRewards.grain ?? 0);
    expect(reward.resources.grain).toBe(expectedGrain);
  });

  it('should grant first clear experience bonus', () => {
    const stage = getStage('chapter1_stage1')!;
    const dist = new RewardDistributor(campaignDataProvider, tracked.deps, createSeededRng([0.99, 0.99, 0.99]));

    const reward = dist.calculateRewards('chapter1_stage1', 3, true);

    // 总经验 = 基础经验*2.0 + 首通经验
    const baseExp = Math.floor(stage.baseExp * 2.0);
    const expectedMinExp = baseExp + stage.firstClearExp;
    expect(reward.exp).toBeGreaterThanOrEqual(expectedMinExp);
  });

  it('should NOT grant first clear bonus on repeated clear', () => {
    const stage = getStage('chapter1_stage1')!;
    const dist = new RewardDistributor(campaignDataProvider, tracked.deps, createSeededRng([0.99, 0.99, 0.99]));

    const reward = dist.calculateRewards('chapter1_stage1', 3, false);

    // 非首通不应包含 firstClearRewards
    const expectedGrain = Math.floor(stage.baseRewards.grain! * 2.0);
    expect(reward.resources.grain).toBe(expectedGrain);
    expect(reward.isFirstClear).toBe(false);
  });

  it('should have first clear rewards significantly higher than repeat rewards', () => {
    const dist = new RewardDistributor(campaignDataProvider, tracked.deps, createSeededRng([0.99, 0.99, 0.99]));

    const firstReward = dist.calculateRewards('chapter1_stage1', 3, true);
    const repeatReward = dist.calculateRewards('chapter1_stage1', 3, false);

    // 首通奖励应明显高于重复奖励
    const firstGold = firstReward.resources.gold ?? 0;
    const repeatGold = repeatReward.resources.gold ?? 0;
    expect(firstGold).toBeGreaterThan(repeatGold);
  });

  it('should correctly identify first clear via CampaignProgressSystem', () => {
    const progress = new CampaignProgressSystem(campaignDataProvider);

    expect(progress.isFirstCleared('chapter1_stage1')).toBe(false);

    progress.completeStage('chapter1_stage1', 3);

    expect(progress.isFirstCleared('chapter1_stage1')).toBe(true);
  });

  it('should only give first clear bonus once per stage', () => {
    const progress = new CampaignProgressSystem(campaignDataProvider);
    const resource = new ResourceSystem();

    // 第一次通关（首通）
    const isFirst1 = !progress.isFirstCleared('chapter1_stage1');
    distributeRewards(resource, 'chapter1_stage1', 3, isFirst1);
    progress.completeStage('chapter1_stage1', 3);

    const goldAfterFirst = resource.getAmount('gold');

    // 第二次通关（非首通）
    const isFirst2 = !progress.isFirstCleared('chapter1_stage1');
    expect(isFirst2).toBe(false);
    distributeRewards(resource, 'chapter1_stage1', 3, isFirst2);

    // 第二次增加的金币应少于第一次
    const goldAfterSecond = resource.getAmount('gold');
    const firstGain = goldAfterFirst - 300; // 初始 gold
    const secondGain = goldAfterSecond - goldAfterFirst;
    expect(firstGain).toBeGreaterThan(secondGain);
  });
});

// ═══════════════════════════════════════════════
// §7.4 重复奖励→日常资源获取
// ═══════════════════════════════════════════════

describe('§7.4 重复奖励→日常资源获取', () => {
  it('should give consistent base rewards on repeated clears', () => {
    const tracked = createTrackedDeps();
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, tracked.deps, noDrop);

    // 多次重复通关（非首通）
    const rewards: StageReward[] = [];
    for (let i = 0; i < 5; i++) {
      const reward = dist.calculateRewards('chapter1_stage1', 3, false);
      rewards.push(reward);
    }

    // 所有重复通关的基础奖励应相同
    for (let i = 1; i < rewards.length; i++) {
      expect(rewards[i].resources.grain).toBe(rewards[0].resources.grain);
      expect(rewards[i].resources.gold).toBe(rewards[0].resources.gold);
      expect(rewards[i].exp).toBe(rewards[0].exp);
    }
  });

  it('should give same star multiplier for same star rating on repeat', () => {
    const tracked = createTrackedDeps();
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, tracked.deps, noDrop);

    const reward1 = dist.calculateRewards('chapter1_stage1', 3, false);
    const reward2 = dist.calculateRewards('chapter1_stage1', 3, false);

    expect(reward1.starMultiplier).toBe(reward2.starMultiplier);
    expect(reward1.starMultiplier).toBe(2.0);
  });

  it('should give lower rewards for lower star rating', () => {
    const tracked = createTrackedDeps();
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, tracked.deps, noDrop);

    const reward3star = dist.calculateRewards('chapter1_stage1', 3, false);
    const reward1star = dist.calculateRewards('chapter1_stage1', 1, false);

    // 3星倍率 2.0 > 1星倍率 1.0
    expect(reward3star.resources.grain!).toBeGreaterThan(reward1star.resources.grain!);
    expect(reward3star.exp).toBeGreaterThan(reward1star.exp);
  });

  it('should accumulate resources correctly over multiple repeats', () => {
    const resource = new ResourceSystem();
    const progress = new CampaignProgressSystem(campaignDataProvider);

    // 首通
    distributeRewards(resource, 'chapter1_stage1', 3, true);
    progress.completeStage('chapter1_stage1', 3);

    const goldAfterFirst = resource.getAmount('gold');

    // 重复通关 10 次
    for (let i = 0; i < 10; i++) {
      distributeRewards(resource, 'chapter1_stage1', 3, false);
    }

    const goldAfterRepeats = resource.getAmount('gold');
    const repeatGain = goldAfterRepeats - goldAfterFirst;

    // 每次重复通关都应增加金币
    expect(repeatGain).toBeGreaterThan(0);
  });

  it('should track clear count incrementing on each repeat', () => {
    const progress = new CampaignProgressSystem(campaignDataProvider);

    progress.completeStage('chapter1_stage1', 3);
    expect(progress.getClearCount('chapter1_stage1')).toBe(1);

    for (let i = 2; i <= 10; i++) {
      progress.completeStage('chapter1_stage1', 3);
      expect(progress.getClearCount('chapter1_stage1')).toBe(i);
    }
  });
});

// ═══════════════════════════════════════════════
// §7.5 兵力/粮草资源获取与恢复
// ═══════════════════════════════════════════════

describe('§7.5 兵力/粮草资源获取与恢复', () => {
  let resource: ResourceSystem;

  beforeEach(() => {
    resource = new ResourceSystem();
  });

  it('should gain troops from battle rewards when troops in drop table', () => {
    // 找一个掉落兵力的关卡
    const chapters = getChapters();
    let stageWithTroops: string | null = null;

    for (const chapter of chapters) {
      for (const stage of chapter.stages) {
        const hasTroopDrop = stage.dropTable.some(
          d => d.type === 'resource' && d.resourceType === 'troops'
        );
        const hasTroopReward = (stage.baseRewards.troops ?? 0) > 0;
        if (hasTroopDrop || hasTroopReward) {
          stageWithTroops = stage.id;
          break;
        }
      }
      if (stageWithTroops) break;
    }

    if (stageWithTroops) {
      const troopsBefore = resource.getAmount('troops');
      distributeRewards(resource, stageWithTroops, 3, true);
      expect(resource.getAmount('troops')).toBeGreaterThanOrEqual(troopsBefore);
    }
  });

  it('should respect troops cap when adding troop rewards', () => {
    resource.setCap('troops', 200);
    resource.setResource('troops', 195);

    const added = resource.addResource('troops', 50);

    expect(added).toBe(5); // 200 - 195
    expect(resource.getAmount('troops')).toBe(200);
  });

  it('should recover grain via production tick', () => {
    resource.setResource('grain', 100);
    const grainBefore = resource.getAmount('grain');

    // 模拟 1 秒产出（初始速率 grain: 0.8/s）
    resource.tick(1000);

    expect(resource.getAmount('grain')).toBeGreaterThan(grainBefore);
  });

  it('should not exceed grain cap during production', () => {
    resource.setCap('grain', 500);
    resource.setResource('grain', 499.9);

    resource.tick(10000); // 10秒，产出约 8 grain

    expect(resource.getAmount('grain')).toBeLessThanOrEqual(500);
  });

  it('should update caps via updateCaps method', () => {
    // 初始上限
    const capsBefore = resource.getCaps();

    // 更新上限（粮仓等级1，兵营等级1）
    resource.updateCaps(1, 1);

    const capsAfter = resource.getCaps();
    expect(capsAfter.grain).toBeGreaterThan(0);
    expect(capsAfter.troops).toBeGreaterThan(0);
  });

  it('should truncate resources when cap is lowered', () => {
    // 设置大量资源
    resource.setResource('grain', 5000);
    resource.setResource('troops', 3000);

    // 降低上限
    resource.updateCaps(1, 1);

    // 资源应被截断到上限
    const caps = resource.getCaps();
    expect(resource.getAmount('grain')).toBeLessThanOrEqual(caps.grain!);
    expect(resource.getAmount('troops')).toBeLessThanOrEqual(caps.troops!);
  });

  it('should provide cap warnings when resources are near capacity', () => {
    resource.setCap('grain', 1000);
    resource.setResource('grain', 950);

    const warnings = resource.getCapWarnings();
    expect(warnings.length).toBeGreaterThan(0);

    const grainWarning = warnings.find(w => w.resourceType === 'grain');
    expect(grainWarning).toBeDefined();
  });

  it('should handle resource addition with null cap (no limit)', () => {
    // gold 和 mandate 上限为 null
    const goldBefore = resource.getAmount('gold');

    resource.addResource('gold', 100000);
    expect(resource.getAmount('gold')).toBe(goldBefore + 100000);
  });

  it('should produce grain continuously via tick over time', () => {
    resource.setResource('grain', 0);
    resource.setCap('grain', 10000);

    // 模拟 60 秒产出
    for (let i = 0; i < 60; i++) {
      resource.tick(1000);
    }

    // 0.8 grain/s * 60s ≈ 48 grain
    const grain = resource.getAmount('grain');
    expect(grain).toBeGreaterThan(40);
    expect(grain).toBeLessThan(60);
  });
});
