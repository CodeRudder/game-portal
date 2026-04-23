/**
 * 集成测试：核心循环验证（§5.1 ~ §5.3）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 3 个流程：
 *   §5.1 完整流程串联：选择关卡→布阵→战斗→结算→奖励→解锁→下一关
 *   §5.2 章节推进：完成当前章所有关卡→解锁下一章
 *   §5.3 交叉验证：资源系统、武将系统、关卡系统数据一致性
 *
 * 测试策略：串联 CampaignProgressSystem + RewardDistributor + ResourceSystem + HeroSystem，
 * 使用真实配置数据，验证从选关到解锁的完整核心循环。
 */

import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import { RewardDistributor } from '../../RewardDistributor';
import { ResourceSystem } from '../../../resource/ResourceSystem';
import { HeroSystem } from '../../../hero/HeroSystem';
import { BattleStatisticsSubsystem } from '../../../battle/BattleStatistics';
import {
  BattleOutcome,
  StarRating,
  BattlePhase,
} from '../../../battle/battle.types';
import type {
  RewardDistributorDeps,
  StageReward,
  CampaignProgress,
} from '../../campaign.types';
import { MAX_STARS } from '../../campaign.types';
import {
  campaignDataProvider,
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
} from '../../campaign-config';
import type { ResourceType } from '../../../shared/types';

// ─────────────────────────────────────────────
// 核心循环编排器
// ─────────────────────────────────────────────

/**
 * 模拟一次完整的战斗→结算→奖励→解锁流程
 *
 * @param progress  - 关卡进度系统
 * @param resource  - 资源系统
 * @param hero      - 武将系统
 * @param stageId   - 关卡ID
 * @param stars     - 通关星级
 * @returns 结算数据
 */
function simulateBattle(
  progress: CampaignProgressSystem,
  resource: ResourceSystem,
  hero: HeroSystem,
  stageId: string,
  stars: number,
): StageReward {
  // 1. 检查关卡是否可挑战
  if (!progress.canChallenge(stageId)) {
    throw new Error(`关卡 ${stageId} 不可挑战`);
  }

  // 2. 判断是否首通
  const isFirstClear = !progress.isFirstCleared(stageId);

  // 3. 构建奖励分发依赖（连接 ResourceSystem + HeroSystem）
  const rewardDeps: RewardDistributorDeps = {
    addResource: (type: ResourceType, amount: number) =>
      resource.addResource(type, amount),
    addFragment: (generalId: string, count: number) =>
      hero.addFragment(generalId, count),
    addExp: (exp: number) => {
      // 将经验分配给所有已拥有武将
      const generals = hero.getGeneralsSortedByPower();
      if (generals.length > 0) {
        hero.addExp(generals[0].id, exp);
      }
    },
  };

  // 4. 计算并分发奖励
  const distributor = new RewardDistributor(campaignDataProvider, rewardDeps);
  const reward = distributor.calculateAndDistribute(stageId, stars, isFirstClear);

  // 5. 更新进度（解锁下一关）
  if (stars > 0) {
    progress.completeStage(stageId, stars);
  }

  return reward;
}

/** 创建完整的核心循环测试环境 */
function createTestEnvironment() {
  const progress = new CampaignProgressSystem(campaignDataProvider);
  const resource = new ResourceSystem();
  const hero = new HeroSystem();
  const battleStats = new BattleStatisticsSubsystem();

  return { progress, resource, hero, battleStats };
}

// ═══════════════════════════════════════════════
// §5.1 完整流程串联
// ═══════════════════════════════════════════════

describe('§5.1 完整流程串联', () => {
  let env: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  it('should complete full flow: select → battle → reward → unlock', () => {
    const { progress, resource, hero } = env;

    // Step 1: 选择关卡 — stage1 应该可用
    expect(progress.canChallenge('chapter1_stage1')).toBe(true);

    // Step 2: 记录初始资源
    const grainBefore = resource.getAmount('grain');
    const goldBefore = resource.getAmount('gold');

    // Step 3: 模拟战斗并结算
    const reward = simulateBattle(progress, resource, hero, 'chapter1_stage1', 3);

    // Step 4: 验证奖励已入账
    expect(reward.isFirstClear).toBe(true);
    expect(reward.exp).toBeGreaterThan(0);
    expect(resource.getAmount('grain')).toBeGreaterThan(grainBefore);
    expect(resource.getAmount('gold')).toBeGreaterThan(goldBefore);

    // Step 5: 验证关卡已解锁
    expect(progress.isFirstCleared('chapter1_stage1')).toBe(true);
    expect(progress.getStageStars('chapter1_stage1')).toBe(3);
    expect(progress.getStageStatus('chapter1_stage1')).toBe('threeStar');

    // Step 6: 验证下一关已解锁
    expect(progress.canChallenge('chapter1_stage2')).toBe(true);
  });

  it('should chain multiple stages sequentially', () => {
    const { progress, resource, hero } = env;
    const stages = getStagesByChapter('chapter1');

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      // 确认当前关卡可挑战
      expect(progress.canChallenge(stage.id)).toBe(true);

      // 通关
      const reward = simulateBattle(progress, resource, hero, stage.id, 3);

      expect(reward).toBeDefined();
      expect(reward.exp).toBeGreaterThan(0);

      // 确认已通关
      expect(progress.isFirstCleared(stage.id)).toBe(true);
    }
  });

  it('should allow replaying cleared stages', () => {
    const { progress, resource, hero } = env;

    // 首次通关
    simulateBattle(progress, resource, hero, 'chapter1_stage1', 3);
    expect(progress.getClearCount('chapter1_stage1')).toBe(1);

    // 重复通关
    const reward2 = simulateBattle(progress, resource, hero, 'chapter1_stage1', 2);
    expect(progress.getClearCount('chapter1_stage1')).toBe(2);
    expect(reward2.isFirstClear).toBe(false); // 非首通

    // 星级不降低
    expect(progress.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('should generate valid reward data at each step', () => {
    const { progress, resource, hero } = env;
    const stages = getStagesByChapter('chapter1');

    for (const stage of stages) {
      const reward = simulateBattle(progress, resource, hero, stage.id, 3);

      // 奖励数据完整性
      expect(reward.resources).toBeDefined();
      expect(typeof reward.exp).toBe('number');
      expect(reward.starMultiplier).toBeGreaterThan(0);

      // 资源值应为非负
      for (const [key, value] of Object.entries(reward.resources)) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should accumulate resources across multiple clears', () => {
    const { progress, resource, hero } = env;
    const stages = getStagesByChapter('chapter1');

    const grainBefore = resource.getAmount('grain');
    const goldBefore = resource.getAmount('gold');

    // 通关 chapter1 所有关卡
    for (const stage of stages) {
      simulateBattle(progress, resource, hero, stage.id, 3);
    }

    // 资源应累积增长
    expect(resource.getAmount('grain')).toBeGreaterThan(grainBefore);
    expect(resource.getAmount('gold')).toBeGreaterThan(goldBefore);
  });
});

// ═══════════════════════════════════════════════
// §5.2 章节推进
// ═══════════════════════════════════════════════

describe('§5.2 章节推进', () => {
  let env: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  it('should unlock next chapter after clearing all stages in current chapter', () => {
    const { progress, resource, hero } = env;
    const ch1Stages = getStagesByChapter('chapter1');

    // 通关 chapter1 所有关卡
    for (const stage of ch1Stages) {
      simulateBattle(progress, resource, hero, stage.id, 3);
    }

    // chapter2 第一关应解锁
    const ch2Stages = getStagesByChapter('chapter2');
    expect(ch2Stages.length).toBeGreaterThan(0);
    expect(progress.canChallenge(ch2Stages[0].id)).toBe(true);
  });

  it('should update current chapter after clearing last stage', () => {
    const { progress, resource, hero } = env;

    // 初始章节应为 chapter1
    const currentCh1 = progress.getCurrentChapter();
    expect(currentCh1?.id).toBe('chapter1');

    // 通关 chapter1 所有关卡
    const ch1Stages = getStagesByChapter('chapter1');
    for (const stage of ch1Stages) {
      simulateBattle(progress, resource, hero, stage.id, 3);
    }

    // 当前章节应推进到 chapter2
    const currentCh2 = progress.getCurrentChapter();
    expect(currentCh2?.id).toBe('chapter2');
  });

  it('should not unlock chapter3 without clearing chapter2', () => {
    const { progress, resource, hero } = env;

    // 通关 chapter1
    const ch1Stages = getStagesByChapter('chapter1');
    for (const stage of ch1Stages) {
      simulateBattle(progress, resource, hero, stage.id, 3);
    }

    // chapter3 第一关应仍锁定
    const ch3Stages = getStagesByChapter('chapter3');
    expect(ch3Stages.length).toBeGreaterThan(0);
    expect(progress.getStageStatus(ch3Stages[0].id)).toBe('locked');
  });

  it('should progress through all 6 chapters sequentially', () => {
    const { progress, resource, hero } = env;
    const chapters = getChapters();

    for (const chapter of chapters) {
      const stages = getStagesByChapter(chapter.id);

      // 章节第一关应可挑战
      expect(progress.canChallenge(stages[0].id)).toBe(true);

      // 通关该章所有关卡
      for (const stage of stages) {
        simulateBattle(progress, resource, hero, stage.id, 3);
      }
    }

    // 验证所有章节都已通关
    for (const chapter of chapters) {
      const stages = getStagesByChapter(chapter.id);
      for (const stage of stages) {
        expect(progress.isFirstCleared(stage.id)).toBe(true);
      }
    }
  });

  it('should track total stars across all chapters', () => {
    const { progress, resource, hero } = env;

    // 通关 chapter1 所有关卡（3星）
    const ch1Stages = getStagesByChapter('chapter1');
    for (const stage of ch1Stages) {
      simulateBattle(progress, resource, hero, stage.id, 3);
    }

    const totalStars = progress.getTotalStars();
    expect(totalStars).toBe(ch1Stages.length * 3);
  });

  it('should maintain progress integrity after serialization round-trip', () => {
    const { progress, resource, hero } = env;

    // 通关 chapter1
    const ch1Stages = getStagesByChapter('chapter1');
    for (const stage of ch1Stages) {
      simulateBattle(progress, resource, hero, stage.id, 3);
    }

    // 序列化
    const saveData = progress.serialize();

    // 创建新系统并反序列化
    const progress2 = new CampaignProgressSystem(campaignDataProvider);
    progress2.deserialize(saveData);

    // 验证进度一致
    for (const stage of ch1Stages) {
      expect(progress2.isFirstCleared(stage.id)).toBe(true);
      expect(progress2.getStageStars(stage.id)).toBe(3);
    }

    // chapter2 第一关应仍可用
    const ch2Stages = getStagesByChapter('chapter2');
    expect(progress2.canChallenge(ch2Stages[0].id)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// §5.3 交叉验证：资源系统、武将系统、关卡系统数据一致性
// ═══════════════════════════════════════════════

describe('§5.3 交叉验证：多系统数据一致性', () => {
  let env: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  it('should have consistent resource totals matching reward calculations', () => {
    const { progress, resource, hero } = env;

    const grainBefore = resource.getAmount('grain');
    const goldBefore = resource.getAmount('gold');

    // 手动计算预期奖励
    const stage = getStage('chapter1_stage1')!;
    const rewardDeps: RewardDistributorDeps = {
      addResource: (type, amount) => resource.addResource(type, amount),
    };
    const distributor = new RewardDistributor(campaignDataProvider, rewardDeps);
    const reward = distributor.calculateAndDistribute('chapter1_stage1', 3, true);

    // 更新进度
    progress.completeStage('chapter1_stage1', 3);

    // 验证资源系统余额变化与奖励一致
    const grainDelta = resource.getAmount('grain') - grainBefore;
    const goldDelta = resource.getAmount('gold') - goldBefore;

    // 资源系统增加量应等于奖励中的资源量
    expect(grainDelta).toBe(reward.resources.grain ?? 0);
    expect(goldDelta).toBe(reward.resources.gold ?? 0);
  });

  it('should have consistent clear count and star rating in progress', () => {
    const { progress, resource, hero } = env;

    // 第一次通关 1 星
    simulateBattle(progress, resource, hero, 'chapter1_stage1', 1);
    expect(progress.getClearCount('chapter1_stage1')).toBe(1);
    expect(progress.getStageStars('chapter1_stage1')).toBe(1);
    expect(progress.getStageStatus('chapter1_stage1')).toBe('cleared');

    // 第二次通关 3 星
    simulateBattle(progress, resource, hero, 'chapter1_stage1', 3);
    expect(progress.getClearCount('chapter1_stage1')).toBe(2);
    expect(progress.getStageStars('chapter1_stage1')).toBe(3);
    expect(progress.getStageStatus('chapter1_stage1')).toBe('threeStar');

    // 第三次通关 2 星（星级不降低）
    simulateBattle(progress, resource, hero, 'chapter1_stage1', 2);
    expect(progress.getClearCount('chapter1_stage1')).toBe(3);
    expect(progress.getStageStars('chapter1_stage1')).toBe(3);
    expect(progress.getStageStatus('chapter1_stage1')).toBe('threeStar');
  });

  it('should have consistent chapter progress and stage statuses', () => {
    const { progress, resource, hero } = env;
    const chapters = getChapters();

    // 初始状态：只有 chapter1_stage1 可用
    const ch1Stages = getStagesByChapter('chapter1');
    expect(progress.getStageStatus(ch1Stages[0].id)).toBe('available');
    for (let i = 1; i < ch1Stages.length; i++) {
      expect(progress.getStageStatus(ch1Stages[i].id)).toBe('locked');
    }

    // 通关第一关后
    simulateBattle(progress, resource, hero, ch1Stages[0].id, 3);
    expect(progress.getStageStatus(ch1Stages[0].id)).toBe('threeStar');
    if (ch1Stages.length > 1) {
      expect(progress.getStageStatus(ch1Stages[1].id)).toBe('available');
    }
  });

  it('should have consistent total stars count', () => {
    const { progress, resource, hero } = env;
    const ch1Stages = getStagesByChapter('chapter1');

    let expectedStars = 0;
    for (const stage of ch1Stages) {
      simulateBattle(progress, resource, hero, stage.id, 2);
      expectedStars += 2;
    }

    expect(progress.getTotalStars()).toBe(expectedStars);
  });

  it('should track resource changes across multiple stage clears', () => {
    const { progress, resource, hero } = env;

    // 设置足够高的上限，避免截断
    resource.setCap('grain', 100000);
    resource.setCap('troops', 100000);

    const snapshots: { grain: number; gold: number; stageId: string }[] = [];

    const ch1Stages = getStagesByChapter('chapter1');
    for (const stage of ch1Stages) {
      simulateBattle(progress, resource, hero, stage.id, 3);
      snapshots.push({
        grain: resource.getAmount('grain'),
        gold: resource.getAmount('gold'),
        stageId: stage.id,
      });
    }

    // 验证资源严格递增（gold 无上限，grain 已设高上限）
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].gold).toBeGreaterThan(snapshots[i - 1].gold);
      // grain 可能因掉落随机性导致某些关卡不掉落 grain，但至少不应减少
      expect(snapshots[i].grain).toBeGreaterThanOrEqual(snapshots[i - 1].grain);
    }
  });

  it('should have consistent first clear flag across progress and reward system', () => {
    const { progress, resource, hero } = env;

    // 首通
    const reward1 = simulateBattle(progress, resource, hero, 'chapter1_stage1', 3);
    expect(reward1.isFirstClear).toBe(true);
    expect(progress.isFirstCleared('chapter1_stage1')).toBe(true);

    // 重复通关
    const reward2 = simulateBattle(progress, resource, hero, 'chapter1_stage1', 3);
    expect(reward2.isFirstClear).toBe(false);
    expect(progress.getClearCount('chapter1_stage1')).toBe(2);
  });
});
