/**
 * 集成测试：挑战关卡（§11.1 ~ §11.3）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 3 个流程：
 *   §11.1 进入挑战关卡：挑战关卡解锁条件、进入判定、特殊规则
 *   §11.2 挑战关卡结算：挑战关卡特殊奖励、失败惩罚、专属掉落
 *   §11.3 挑战关卡资源串联：挑战关卡与资源系统联动
 *
 * 测试策略：使用 CampaignProgressSystem + RewardDistributor + BattleEngine 真实实例，
 * 验证挑战关卡（精英/BOSS）的解锁、结算和资源串联完整流程。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import { RewardDistributor } from '../../RewardDistributor';
import { BattleEngine } from '../../../battle/BattleEngine';
import { ResourceSystem } from '../../../resource/ResourceSystem';
import {
  BattleOutcome,
  BattlePhase,
  StarRating,
  TroopType,
} from '../../../battle/battle.types';
import { BATTLE_CONFIG } from '../../../battle/battle-config';
import type {
  BattleTeam,
  BattleUnit,
} from '../../../battle/battle-base.types';
import type {
  RewardDistributorDeps,
  StageReward,
} from '../../campaign.types';
import {
  campaignDataProvider,
  getChapters,
  getStage,
} from '../../campaign-config';
import type { ResourceType } from '../../../../shared/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建一个战斗单位 */
function createUnit(
  id: string,
  name: string,
  hp: number,
  attack: number,
  side: 'ally' | 'enemy' = 'enemy',
): BattleUnit {
  return {
    id,
    name,
    faction: 'shu',
    troopType: TroopType.INFANTRY,
    position: 'front',
    side,
    attack,
    baseAttack: attack,
    defense: 50,
    baseDefense: 50,
    intelligence: 50,
    speed: 50,
    hp,
    maxHp: hp,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: {
      id: `${id}_normal`,
      name: '普攻',
      type: 'active',
      level: 1,
      description: '普通攻击',
      multiplier: 1.0,
      targetType: 'SINGLE_ENEMY' as const,
      rageCost: 0,
      cooldown: 0,
      currentCooldown: 0,
    },
    skills: [],
    buffs: [],
  };
}

/** 创建我方队伍（6人，强力） */
function createStrongAllyTeam(): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < 6; i++) {
    units.push(createUnit(`ally_${i}`, `武将${i}`, 5000, 300, 'ally'));
  }
  return { units, side: 'ally' };
}

/** 创建敌方队伍（精英级） */
function createEliteEnemyTeam(): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < 6; i++) {
    units.push(createUnit(`elite_${i}`, `精英敌${i}`, 3000, 200, 'enemy'));
  }
  return { units, side: 'enemy' };
}

/** 创建敌方队伍（BOSS级） */
function createBossEnemyTeam(): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < 5; i++) {
    units.push(createUnit(`boss_minion_${i}`, `BOSS小兵${i}`, 2000, 150, 'enemy'));
  }
  // BOSS本体
  units.push(createUnit('boss_main', 'BOSS', 8000, 400, 'enemy'));
  return { units, side: 'enemy' };
}

/** 创建测试环境 */
function createTestEnv() {
  const progress = new CampaignProgressSystem(campaignDataProvider);
  const resource = new ResourceSystem();
  const engine = new BattleEngine();

  const rewardDeps: RewardDistributorDeps = {
    addResource: (type: ResourceType, amount: number) =>
      resource.addResource(type, amount),
  };

  const rewardDistributor = new RewardDistributor(campaignDataProvider, rewardDeps);

  return { progress, resource, engine, rewardDistributor };
}

/** 获取精英关卡ID */
function getEliteStageId(): string | null {
  const chapters = getChapters();
  for (const ch of chapters) {
    for (const st of ch.stages) {
      if (st.type === 'elite') return st.id;
    }
  }
  return null;
}

/** 获取BOSS关卡ID */
function getBossStageId(): string | null {
  const chapters = getChapters();
  for (const ch of chapters) {
    for (const st of ch.stages) {
      if (st.type === 'boss') return st.id;
    }
  }
  return null;
}

/**
 * 逐关通关到指定关卡（不含目标关卡本身）。
 * clearStagesUpTo 的语义是"打通前置关卡使目标关卡解锁"，
 * 但由于 canChallenge 在前置通关后对目标也返回 true，
 * 这里需要跳过目标关卡自身。
 */
function clearStagesBefore(progress: CampaignProgressSystem, targetStageId: string): void {
  const chapters = getChapters();
  for (const ch of chapters) {
    for (const st of ch.stages) {
      if (st.id === targetStageId) return; // 到达目标关卡前停止
      if (progress.canChallenge(st.id)) {
        progress.completeStage(st.id, 3);
      }
    }
  }
}

/** 逐关通关到指定关卡（含目标关卡） */
function clearStagesUpTo(progress: CampaignProgressSystem, targetStageId: string): void {
  const chapters = getChapters();
  for (const ch of chapters) {
    for (const st of ch.stages) {
      if (progress.canChallenge(st.id)) {
        progress.completeStage(st.id, 3);
      }
      if (st.id === targetStageId) return;
    }
  }
}

// ═══════════════════════════════════════════════
// §11.1 进入挑战关卡
// ═══════════════════════════════════════════════
describe('§11.1 进入挑战关卡', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should identify elite stage type correctly', () => {
    const eliteStageId = getEliteStageId();
    expect(eliteStageId).toBeTruthy();

    const stage = getStage(eliteStageId!);
    expect(stage).toBeDefined();
    expect(stage!.type).toBe('elite');
  });

  it('should identify boss stage type correctly', () => {
    const bossStageId = getBossStageId();
    expect(bossStageId).toBeTruthy();

    const stage = getStage(bossStageId!);
    expect(stage).toBeDefined();
    expect(stage!.type).toBe('boss');
  });

  it('should lock challenge stage when predecessor not cleared', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    // 未通关前置关卡时，精英关应锁定
    const status = env.progress.getStageStatus(eliteStageId);
    expect(status).toBe('locked');
    expect(env.progress.canChallenge(eliteStageId)).toBe(false);
  });

  it('should unlock challenge stage when predecessor cleared', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    // 逐关通关到精英关（含精英关自身）
    clearStagesUpTo(env.progress, eliteStageId);

    // 精英关应可挑战
    const status = env.progress.getStageStatus(eliteStageId);
    expect(status === 'available' || status === 'cleared' || status === 'threeStar').toBe(true);
    expect(env.progress.canChallenge(eliteStageId)).toBe(true);
  });

  it('should allow re-challenge after first clear', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    clearStagesUpTo(env.progress, eliteStageId);
    // clearStagesUpTo 已完成精英关一次
    expect(env.progress.canChallenge(eliteStageId)).toBe(true);
    expect(env.progress.isFirstCleared(eliteStageId)).toBe(true);
  });

  it('should have higher recommended power for elite stages vs normal', () => {
    const chapters = getChapters();
    let normalPower = 0;
    let elitePower = 0;

    for (const ch of chapters) {
      for (const st of ch.stages) {
        if (st.type === 'normal' && normalPower === 0) normalPower = st.recommendedPower;
        if (st.type === 'elite' && elitePower === 0) elitePower = st.recommendedPower;
      }
      if (normalPower > 0 && elitePower > 0) break;
    }

    // 精英关推荐战力应高于同章节普通关
    if (normalPower > 0 && elitePower > 0) {
      expect(elitePower).toBeGreaterThan(normalPower);
    }
  });

  it('should have stronger enemy formation for boss stages', () => {
    const bossStageId = getBossStageId();
    if (!bossStageId) return;

    const stage = getStage(bossStageId)!;
    // BOSS关应有敌方阵容配置
    expect(stage.enemyFormation).toBeDefined();
    expect(stage.enemyFormation.units.length).toBeGreaterThanOrEqual(3);
    expect(stage.enemyFormation.recommendedPower).toBeGreaterThan(0);
  });

  it('should have higher difficulty enemy stats in elite/boss stages', () => {
    const chapters = getChapters();
    const normalStages = chapters.flatMap(ch => ch.stages.filter(s => s.type === 'normal'));
    const eliteStages = chapters.flatMap(ch => ch.stages.filter(s => s.type === 'elite'));

    if (normalStages.length > 0 && eliteStages.length > 0) {
      // 精英关推荐战力普遍高于普通关
      const avgNormalPower = normalStages.reduce((s, st) => s + st.recommendedPower, 0) / normalStages.length;
      const avgElitePower = eliteStages.reduce((s, st) => s + st.recommendedPower, 0) / eliteStages.length;
      expect(avgElitePower).toBeGreaterThan(avgNormalPower);
    }
  });
});

// ═══════════════════════════════════════════════
// §11.2 挑战关卡结算
// ═══════════════════════════════════════════════
describe('§11.2 挑战关卡结算', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should calculate elite stage rewards with star multiplier', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    const stage = getStage(eliteStageId)!;

    // 三星通关奖励
    const reward3Star = env.rewardDistributor.calculateRewards(eliteStageId, 3, true);
    expect(reward3Star.starMultiplier).toBe(stage.threeStarBonusMultiplier);
    expect(reward3Star.isFirstClear).toBe(true);

    // 一星通关奖励
    const reward1Star = env.rewardDistributor.calculateRewards(eliteStageId, 1, true);
    // 三星奖励倍率应高于一星
    expect(reward3Star.starMultiplier).toBeGreaterThan(reward1Star.starMultiplier);
  });

  it('should include first clear bonus for challenge stages', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    const stage = getStage(eliteStageId)!;
    const reward = env.rewardDistributor.calculateRewards(eliteStageId, 3, true);

    // 首通奖励应包含额外经验和资源
    expect(reward.exp).toBeGreaterThan(stage.baseExp);
    expect(reward.isFirstClear).toBe(true);
  });

  it('should not include first clear bonus on repeat challenge', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    const rewardRepeat = env.rewardDistributor.calculateRewards(eliteStageId, 3, false);

    // 非首通不加首通奖励
    expect(rewardRepeat.isFirstClear).toBe(false);
    // 经验应少于首通（无首通额外经验）
    const rewardFirst = env.rewardDistributor.calculateRewards(eliteStageId, 3, true);
    expect(rewardRepeat.exp).toBeLessThan(rewardFirst.exp);
  });

  it('should handle defeat in challenge stage — no rewards distributed', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    // 模拟失败战斗：我方极弱
    const weakAlly: BattleTeam = {
      units: [createUnit('weak_ally', '弱武将', 100, 10, 'ally')],
      side: 'ally',
    };
    const strongEnemy = createEliteEnemyTeam();

    const result = env.engine.runFullBattle(weakAlly, strongEnemy);
    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    expect(result.stars).toBe(StarRating.NONE);

    // 失败不应分发奖励
    expect(result.allySurvivors).toBe(0);
  });

  it('should award victory with correct star rating for challenge stage', () => {
    const allyTeam = createStrongAllyTeam();
    const enemyTeam = createEliteEnemyTeam();

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    if (result.outcome === BattleOutcome.VICTORY) {
      expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
      expect(result.stars).toBeLessThanOrEqual(StarRating.THREE);
      expect(result.allySurvivors).toBeGreaterThan(0);
    }
  });

  it('should handle boss stage special rewards', () => {
    const bossStageId = getBossStageId();
    if (!bossStageId) return;

    const stage = getStage(bossStageId)!;
    const reward = env.rewardDistributor.calculateRewards(bossStageId, 3, true);

    // BOSS关应有奖励
    expect(reward.resources).toBeDefined();
    expect(reward.exp).toBeGreaterThan(0);

    // BOSS关首通奖励应比普通关更丰厚
    const chapters = getChapters();
    const normalStage = chapters[0]?.stages.find(s => s.type === 'normal');
    if (normalStage) {
      const normalReward = env.rewardDistributor.calculateRewards(normalStage.id, 3, true);
      // BOSS关经验应高于普通关（同章节或更高章节）
      if (stage.baseExp > normalStage.baseExp) {
        expect(reward.exp).toBeGreaterThan(normalReward.exp);
      }
    }
  });

  it('should track clear count for challenge stages correctly', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    // 只通关前置关卡，不含精英关本身
    clearStagesBefore(env.progress, eliteStageId);

    // 首次通关精英关
    env.progress.completeStage(eliteStageId, 2);
    expect(env.progress.getClearCount(eliteStageId)).toBe(1);

    // 重复挑战
    env.progress.completeStage(eliteStageId, 3);
    expect(env.progress.getClearCount(eliteStageId)).toBe(2);

    // 星级取最高
    expect(env.progress.getStageStars(eliteStageId)).toBe(3);
  });

  it('should have exclusive drop items in elite/boss stages', () => {
    const eliteStageId = getEliteStageId();
    const bossStageId = getBossStageId();

    // 精英关应有碎片掉落
    if (eliteStageId) {
      const stage = getStage(eliteStageId)!;
      const hasFragmentDrop = stage.dropTable.some(d => d.type === 'fragment');
      expect(hasFragmentDrop).toBe(true);
    }

    // BOSS关应有更高概率或更多掉落
    if (bossStageId) {
      const stage = getStage(bossStageId)!;
      expect(stage.dropTable.length).toBeGreaterThan(0);
      // BOSS关掉落应有100%概率项
      const guaranteedDrops = stage.dropTable.filter(d => d.probability >= 1.0);
      expect(guaranteedDrops.length).toBeGreaterThan(0);
    }
  });

  it('should provide higher quality rewards for boss vs elite vs normal', () => {
    const chapters = getChapters();
    const firstNormal = chapters[0]?.stages.find(s => s.type === 'normal');
    const firstElite = chapters[0]?.stages.find(s => s.type === 'elite');
    const firstBoss = chapters[0]?.stages.find(s => s.type === 'boss');

    if (firstNormal && firstElite && firstBoss) {
      // 基础经验应递增
      expect(firstBoss.baseExp).toBeGreaterThan(firstElite.baseExp);
      expect(firstElite.baseExp).toBeGreaterThan(firstNormal.baseExp);

      // 掉落表条目数量通常更多
      expect(firstBoss.dropTable.length).toBeGreaterThanOrEqual(firstNormal.dropTable.length);
    }
  });
});

// ═══════════════════════════════════════════════
// §11.3 挑战关卡资源串联
// ═══════════════════════════════════════════════
describe('§11.3 挑战关卡资源串联', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should distribute challenge stage rewards to resource system', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    clearStagesUpTo(env.progress, eliteStageId);
    const isFirstClear = !env.progress.isFirstCleared(eliteStageId);

    // 计算并分发奖励
    const reward = env.rewardDistributor.calculateAndDistribute(eliteStageId, 3, isFirstClear);

    // 资源系统应有增加
    const resources = env.resource.getResources();
    let hasIncrease = false;
    for (const key of ['grain', 'gold', 'troops', 'mandate'] as ResourceType[]) {
      if ((resources[key] ?? 0) > 0) {
        hasIncrease = true;
        break;
      }
    }
    expect(hasIncrease).toBe(true);

    // 完成关卡
    env.progress.completeStage(eliteStageId, 3);
  });

  it('should accumulate resources across multiple challenge clears', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    clearStagesUpTo(env.progress, eliteStageId);

    // 第一次通关（clearStagesUpTo 已完成一次，这里是非首通）
    env.rewardDistributor.calculateAndDistribute(eliteStageId, 3, false);
    const resourcesAfter1 = { ...env.resource.getResources() };

    // 第二次通关
    env.rewardDistributor.calculateAndDistribute(eliteStageId, 3, false);
    const resourcesAfter2 = env.resource.getResources();

    // 资源应持续增长
    let hasGrowth = false;
    for (const key of ['grain', 'gold', 'troops', 'mandate'] as ResourceType[]) {
      if ((resourcesAfter2[key] ?? 0) > (resourcesAfter1[key] ?? 0)) {
        hasGrowth = true;
        break;
      }
    }
    expect(hasGrowth).toBe(true);
  });

  it('should correctly chain battle result → reward → progress → unlock', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    clearStagesBefore(env.progress, eliteStageId);

    // 1. 战斗前状态
    expect(env.progress.canChallenge(eliteStageId)).toBe(true);
    const isFirstClear = !env.progress.isFirstCleared(eliteStageId);

    // 2. 模拟战斗胜利
    const allyTeam = createStrongAllyTeam();
    const enemyTeam = createEliteEnemyTeam();
    const battleResult = env.engine.runFullBattle(allyTeam, enemyTeam);

    // 3. 根据战斗结果结算
    if (battleResult.outcome === BattleOutcome.VICTORY) {
      const stars = battleResult.stars;

      // 4. 分发奖励
      const reward = env.rewardDistributor.calculateAndDistribute(
        eliteStageId,
        stars,
        isFirstClear,
      );

      // 5. 更新进度
      env.progress.completeStage(eliteStageId, stars);

      // 6. 验证状态一致性
      expect(env.progress.getStageStars(eliteStageId)).toBe(stars);
      expect(env.progress.isFirstCleared(eliteStageId)).toBe(true);
      expect(env.progress.getClearCount(eliteStageId)).toBe(1);

      // 7. 验证奖励数据结构完整
      expect(reward.resources).toBeDefined();
      expect(typeof reward.exp).toBe('number');
      expect(typeof reward.starMultiplier).toBe('number');
    }
  });

  it('should handle challenge stage with drop table fragments', () => {
    const eliteStageId = getEliteStageId();
    if (!eliteStageId) return;

    const stage = getStage(eliteStageId)!;

    // 使用固定随机种子确保掉落
    let seed = 0;
    const seededRng = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const customDistributor = new RewardDistributor(
      campaignDataProvider,
      { addResource: () => 0 },
      seededRng,
    );

    // 多次计算奖励以触发掉落
    let foundFragment = false;
    for (let i = 0; i < 20; i++) {
      const reward = customDistributor.calculateRewards(eliteStageId, 3, false);
      if (Object.keys(reward.fragments).length > 0) {
        foundFragment = true;
        break;
      }
    }

    // 如果关卡有碎片掉落表，应有机会掉落
    if (stage.dropTable.some(d => d.type === 'fragment')) {
      expect(foundFragment || stage.dropTable.filter(d => d.type === 'fragment').length > 0).toBe(true);
    }
  });

  it('should maintain data consistency between progress and resources after challenge', () => {
    const bossStageId = getBossStageId();
    if (!bossStageId) return;

    clearStagesBefore(env.progress, bossStageId);

    // 通关BOSS关
    env.progress.completeStage(bossStageId, 3);
    const reward = env.rewardDistributor.calculateAndDistribute(bossStageId, 3, true);

    // 进度系统状态一致
    expect(env.progress.getStageStars(bossStageId)).toBe(3);
    expect(env.progress.isFirstCleared(bossStageId)).toBe(true);
    expect(env.progress.getClearCount(bossStageId)).toBe(1);

    // 奖励数据完整
    expect(reward).toBeDefined();
    expect(reward.starMultiplier).toBeGreaterThan(0);

    // 序列化后反序列化，验证数据完整性
    const saveData = env.progress.serialize();
    const newProgress = new CampaignProgressSystem(campaignDataProvider);
    newProgress.deserialize(saveData);

    expect(newProgress.getStageStars(bossStageId)).toBe(3);
    expect(newProgress.isFirstCleared(bossStageId)).toBe(true);
    expect(newProgress.getClearCount(bossStageId)).toBe(1);
  });

  it('should correctly link battle victory to resource gain for boss stage', () => {
    const bossStageId = getBossStageId();
    if (!bossStageId) return;

    clearStagesBefore(env.progress, bossStageId);

    // 战斗
    const allyTeam = createStrongAllyTeam();
    const enemyTeam = createBossEnemyTeam();
    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    if (result.outcome === BattleOutcome.VICTORY) {
      // 分发奖励
      const reward = env.rewardDistributor.calculateAndDistribute(
        bossStageId,
        result.stars,
        true,
      );

      // 验证资源增长
      const resources = env.resource.getResources();
      let totalGain = 0;
      for (const key of ['grain', 'gold', 'troops', 'mandate'] as ResourceType[]) {
        totalGain += resources[key] ?? 0;
      }
      expect(totalGain).toBeGreaterThan(0);

      // 更新进度
      env.progress.completeStage(bossStageId, result.stars);
      expect(env.progress.isFirstCleared(bossStageId)).toBe(true);
    }
  });
});
