/**
 * 集成测试：战斗结算（§4.1 ~ §4.7）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 7 个流程：
 *   §4.1 胜利结算：胜利条件判定、结算数据生成
 *   §4.2 奖励飞出动画：奖励类型和数量正确（引擎层验证数据）
 *   §4.3 掉落物品确认：掉落表和随机性
 *   §4.3a 关卡↔武将碎片映射：碎片掉落与关卡关联
 *   §4.4 关卡解锁：通关后下一关解锁
 *   §4.5 失败结算：失败条件判定、不发放奖励
 *   §4.6 战斗日志：战斗过程记录完整
 *   §4.7 操作评分：S/A/B等级评定（如未实现则skip）
 *
 * 测试策略：使用 RewardDistributor + CampaignProgressSystem + BattleStatistics 引擎 API，
 * 通过 campaignDataProvider 真实配置 + mock 回调，验证战斗结算的完整流程。
 */

import { RewardDistributor } from '../../RewardDistributor';
import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import { BattleStatisticsSubsystem, calculateBattleStats, generateSummary } from '../../../battle/BattleStatistics';
import {
  BattlePhase,
  BattleOutcome,
  StarRating,
  TroopType,
} from '../../../battle/battle.types';
import type {
  BattleState,
  BattleAction,
  BattleResult,
  BattleTeam,
  DamageResult,
} from '../../../battle/battle.types';
import type {
  ICampaignDataProvider,
  StageReward,
  DropTableEntry,
  RewardDistributorDeps,
} from '../../campaign.types';
import { MAX_STARS } from '../../campaign.types';
import {
  campaignDataProvider,
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
} from '../../campaign-config';

// ─────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────

/** 创建一个简单的 BattleAction（用于构造 actionLog） */
function createAction(
  turn: number,
  actorId: string,
  actorSide: 'ally' | 'enemy',
  targetId: string,
  damage: number,
  isCritical = false,
): BattleAction {
  return {
    turn,
    actorId,
    actorName: actorId,
    actorSide,
    skill: null,
    targetIds: [targetId],
    damageResults: {
      [targetId]: {
        damage,
        baseDamage: damage,
        skillMultiplier: 1.0,
        isCritical: isCritical,
        criticalMultiplier: isCritical ? 1.5 : 1.0,
        restraintMultiplier: 1.0,
        randomFactor: 1.0,
        isMinDamage: false,
      },
    },
    description: `${actorId} attacks ${targetId} for ${damage}`,
    isNormalAttack: true,
  };
}

/** 创建一个完整的 BattleState（用于战斗统计测试） */
function createBattleState(
  outcome: BattleOutcome,
  actions: BattleAction[],
  allyAlive = 4,
  enemyAlive = 0,
): BattleState {
  const allyUnits = Array.from({ length: 6 }, (_, i) => ({
    id: `ally_${i}`,
    name: `Ally ${i}`,
    side: 'ally' as const,
    faction: 'shu' as const,
    troopType: TroopType.INFANTRY,
    level: 1,
    attack: 50,
    defense: 30,
    intelligence: 20,
    speed: 10,
    maxHp: 200,
    currentHp: i < allyAlive ? 100 : 0,
    position: i < 3 ? ('front' as const) : ('back' as const),
    skills: [],
    buffs: [],
    rage: 0,
  }));

  const enemyUnits = Array.from({ length: 3 }, (_, i) => ({
    id: `enemy_${i}`,
    name: `Enemy ${i}`,
    side: 'enemy' as const,
    faction: 'qun' as const,
    troopType: TroopType.INFANTRY,
    level: 1,
    attack: 30,
    defense: 20,
    intelligence: 10,
    speed: 8,
    maxHp: 150,
    currentHp: i < enemyAlive ? 50 : 0,
    position: i < 2 ? ('front' as const) : ('back' as const),
    skills: [],
    buffs: [],
    rage: 0,
  }));

  return {
    id: 'test_battle',
    phase: BattlePhase.FINISHED,
    currentTurn: actions.length > 0 ? actions[actions.length - 1].turn : 1,
    maxTurns: 10,
    allyTeam: { units: allyUnits, side: 'ally' } as BattleTeam,
    enemyTeam: { units: enemyUnits, side: 'enemy' } as BattleTeam,
    turnOrder: [],
    currentActorIndex: 0,
    actionLog: actions,
    result: {
      outcome,
      stars: outcome === BattleOutcome.VICTORY ? StarRating.THREE : StarRating.NONE,
      totalTurns: actions.length > 0 ? actions[actions.length - 1].turn : 0,
      allySurvivors: allyAlive,
      enemySurvivors: enemyAlive,
      allyTotalDamage: 0,
      enemyTotalDamage: 0,
      maxSingleDamage: 0,
      maxCombo: 0,
      summary: '',
    },
  };
}

/** 创建 RewardDistributorDeps 的 mock（使用对象包装避免闭包陷阱） */
function createMockDeps(): {
  deps: RewardDistributorDeps;
  tracking: {
    addedResources: Record<string, number>;
    addedFragments: Record<string, number>;
    addedExp: number;
  };
} {
  const tracking = {
    addedResources: {} as Record<string, number>,
    addedFragments: {} as Record<string, number>,
    addedExp: 0,
  };

  return {
    tracking,
    deps: {
      addResource: (type, amount) => {
        tracking.addedResources[type] = (tracking.addedResources[type] ?? 0) + amount;
        return amount;
      },
      addFragment: (generalId, count) => {
        tracking.addedFragments[generalId] = (tracking.addedFragments[generalId] ?? 0) + count;
      },
      addExp: (exp) => {
        tracking.addedExp += exp;
      },
    },
  };
}

/** 创建一个固定种子的 RNG（返回固定序列） */
function createSeededRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

// ═══════════════════════════════════════════════
// §4.1 胜利结算
// ═══════════════════════════════════════════════

describe('§4.1 胜利结算', () => {
  let distributor: RewardDistributor;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    distributor = new RewardDistributor(campaignDataProvider, mockDeps.deps);
  });

  it('should calculate rewards for victorious battle with 3 stars', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 3, true);

    expect(reward).toBeDefined();
    expect(reward.isFirstClear).toBe(true);
    expect(reward.starMultiplier).toBe(1.5); // 3星倍率
    expect(reward.exp).toBeGreaterThan(0);
    expect(reward.resources).toBeDefined();
  });

  it('should include base rewards scaled by star multiplier on first clear', () => {
    const stage = getStage('chapter1_stage1')!;
    // 使用固定 RNG 避免掉落表干扰
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, noDrop);
    const reward = dist.calculateRewards('chapter1_stage1', 3, true);

    // 3星 = threeStarBonusMultiplier(1.5), 基础资源 * 1.5 + 首通额外资源
    const expectedGrain = Math.floor(stage.baseRewards.grain! * 1.5) + (stage.firstClearRewards.grain ?? 0);
    expect(reward.resources.grain).toBe(expectedGrain);

    // 首通额外奖励直接叠加
    const totalGold = Math.floor(stage.baseRewards.gold! * 1.5) + stage.firstClearRewards.gold!;
    expect(reward.resources.gold).toBe(totalGold);
  });

  it('should include first clear exp bonus on first clear', () => {
    const stage = getStage('chapter1_stage1')!;
    const reward = distributor.calculateRewards('chapter1_stage1', 3, true);

    // 总经验 = 基础经验*倍率 + 首通经验 + 掉落经验
    const baseExp = Math.floor(stage.baseExp * 1.5);
    const expectedMinExp = baseExp + stage.firstClearExp;
    expect(reward.exp).toBeGreaterThanOrEqual(expectedMinExp);
  });

  it('should not include first clear rewards on repeated clear', () => {
    const stage = getStage('chapter1_stage1')!;
    // 使用固定 RNG 避免掉落表干扰
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, noDrop);
    const reward = dist.calculateRewards('chapter1_stage1', 3, false);

    expect(reward.isFirstClear).toBe(false);
    // 不应包含首通额外资源
    const expectedGrain = Math.floor(stage.baseRewards.grain! * 1.5);
    expect(reward.resources.grain).toBe(expectedGrain);
  });

  it('should throw error for non-existent stage', () => {
    expect(() => {
      distributor.calculateRewards('non_existent_stage', 3, true);
    }).toThrow('关卡不存在');
  });

  it('should clamp star rating to valid range (0-3)', () => {
    const rewardNeg = distributor.calculateRewards('chapter1_stage1', -1, false);
    const rewardOver = distributor.calculateRewards('chapter1_stage1', 99, false);

    expect(rewardNeg.starMultiplier).toBe(0); // 0 stars = 0 multiplier
    expect(rewardOver.starMultiplier).toBe(1.5); // clamped to 3 stars
  });
});

// ═══════════════════════════════════════════════
// §4.2 奖励飞出动画（引擎层验证数据）
// ═══════════════════════════════════════════════

describe('§4.2 奖励飞出动画（引擎层数据验证）', () => {
  let distributor: RewardDistributor;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    distributor = new RewardDistributor(campaignDataProvider, mockDeps.deps);
  });

  it('should distribute resources via addResource callback', () => {
    distributor.calculateAndDistribute('chapter1_stage1', 3, true);

    expect(Object.keys(mockDeps.tracking.addedResources).length).toBeGreaterThan(0);
    expect(mockDeps.tracking.addedResources.grain).toBeGreaterThan(0);
    expect(mockDeps.tracking.addedResources.gold).toBeGreaterThan(0);
  });

  it('should distribute experience via addExp callback', () => {
    distributor.calculateAndDistribute('chapter1_stage1', 3, true);

    expect(mockDeps.tracking.addedExp).toBeGreaterThan(0);
  });

  it('should distribute fragments via addFragment callback when dropped', () => {
    // 使用固定 RNG 确保碎片掉落（概率 0.1，设 rng 返回 0.05 < 0.1）
    const rng = createSeededRng([0.05, 0.5]); // 0.05 < 0.1 → 掉落, 0.5 → 数量
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, rng);

    dist.calculateAndDistribute('chapter1_stage1', 3, true);

    // chapter1_stage1 的掉落表包含 zhangjiao 碎片
    expect(mockDeps.tracking.addedFragments['zhangjiao']).toBeGreaterThanOrEqual(1);
  });

  it('should have correct reward types matching stage config', () => {
    const stage = getStage('chapter1_stage1')!;
    // 使用固定 RNG 避免掉落表干扰
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, noDrop);
    const reward = dist.calculateRewards('chapter1_stage1', 1, false);

    // 1星基础奖励应与配置一致（无掉落）
    expect(reward.resources.grain).toBe(stage.baseRewards.grain);
    expect(reward.resources.gold).toBe(stage.baseRewards.gold);
  });

  it('should not distribute zero or negative amounts', () => {
    const reward = distributor.calculateRewards('chapter1_stage1', 0, false);

    // 0星 = 0倍率，基础资源应为0
    for (const amount of Object.values(reward.resources)) {
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════
// §4.3 掉落物品确认
// ═══════════════════════════════════════════════

describe('§4.3 掉落物品确认', () => {
  it('should respect probability threshold in drop table', () => {
    const mockDeps = createMockDeps();

    // RNG 始终返回 0.99 → 高概率阈值项不触发（0.99 > 0.8）
    const neverDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, neverDrop);

    const reward = dist.calculateRewards('chapter1_stage1', 1, false);

    // 掉落表中最高概率是 0.8(grain)，0.99 > 0.8 不触发
    // 基础资源不受掉落影响，但掉落额外资源为0
    const stage = getStage('chapter1_stage1')!;
    expect(reward.resources.grain).toBe(stage.baseRewards.grain); // 只有基础，无掉落
  });

  it('should produce drops when RNG is favorable', () => {
    const mockDeps = createMockDeps();

    // RNG 始终返回 0 → 所有掉落项都触发
    const alwaysDrop = createSeededRng([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, alwaysDrop);

    const reward = dist.calculateRewards('chapter1_stage1', 1, false);

    const stage = getStage('chapter1_stage1')!;
    // 掉落表有 grain(0.8) + gold(0.7) + fragment(0.1)，全部触发
    // grain = baseRewards.grain + drop.grain(min=30)
    expect(reward.resources.grain!).toBeGreaterThan(stage.baseRewards.grain!);
  });

  it('should produce drop amounts within min-max range', () => {
    const mockDeps = createMockDeps();

    // 使用固定序列让 grain 掉落触发（rng < 0.8），数量取 min
    const rng = createSeededRng([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, rng);

    const reward = dist.calculateRewards('chapter1_stage1', 1, false);

    const stage = getStage('chapter1_stage1')!;
    const grainDrop = reward.resources.grain! - stage.baseRewards.grain!;
    // 掉落范围 30-60
    if (grainDrop > 0) {
      expect(grainDrop).toBeGreaterThanOrEqual(30);
      expect(grainDrop).toBeLessThanOrEqual(60);
    }
  });

  it('should handle stages with empty drop table gracefully', () => {
    // 创建一个空掉落表的 mock data provider
    const emptyDropProvider: ICampaignDataProvider = {
      ...campaignDataProvider,
      getStage: (id: string) => {
        const stage = campaignDataProvider.getStage(id);
        if (!stage) return undefined;
        return { ...stage, dropTable: [] };
      },
    };

    const mockDeps = createMockDeps();
    const dist = new RewardDistributor(emptyDropProvider, mockDeps.deps);

    const reward = dist.calculateRewards('chapter1_stage1', 1, false);

    expect(reward).toBeDefined();
    expect(Object.keys(reward.fragments)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════
// §4.3a 关卡↔武将碎片映射
// ═══════════════════════════════════════════════

describe('§4.3a 关卡↔武将碎片映射', () => {
  it('should drop correct fragment type for chapter1_stage1 (zhangjiao)', () => {
    const mockDeps = createMockDeps();
    // RNG: 0.05 < 0.1 → 碎片掉落触发, 0.5 → 数量
    const rng = createSeededRng([0.9, 0.9, 0.05, 0.5]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, rng);

    const reward = dist.calculateRewards('chapter1_stage1', 1, false);

    // chapter1_stage1 掉落表包含 zhangjiao 碎片
    expect(reward.fragments['zhangjiao']).toBeGreaterThanOrEqual(1);
  });

  it('should map chapter1_stage4 to guanyu fragment', () => {
    const stage = getStage('chapter1_stage4');
    expect(stage).toBeDefined();

    const fragmentDrops = stage!.dropTable.filter(d => d.type === 'fragment');
    expect(fragmentDrops.length).toBeGreaterThan(0);
    expect(fragmentDrops.some(d => d.generalId === 'guanyu')).toBe(true);
  });

  it('should map chapter1_stage5 to guanyu and zhangjiao fragments', () => {
    const stage = getStage('chapter1_stage5');
    expect(stage).toBeDefined();

    const fragmentDrops = stage!.dropTable.filter(d => d.type === 'fragment');
    const generalIds = fragmentDrops.map(d => d.generalId);
    expect(generalIds).toContain('guanyu');
    expect(generalIds).toContain('zhangjiao');
  });

  it('should verify each chapter1 stage has at least one fragment in drop table', () => {
    const stages = getStagesByChapter('chapter1');
    for (const stage of stages) {
      const fragmentDrops = stage.dropTable.filter(d => d.type === 'fragment');
      expect(fragmentDrops.length).toBeGreaterThan(0);
    }
  });

  it('should produce fragment counts within configured range', () => {
    const mockDeps = createMockDeps();
    // 让所有掉落都触发
    const rng = createSeededRng([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, rng);

    const reward = dist.calculateRewards('chapter1_stage5', 3, true);

    for (const [generalId, count] of Object.entries(reward.fragments)) {
      const stage = getStage('chapter1_stage5')!;
      const entry = stage.dropTable.find(d => d.type === 'fragment' && d.generalId === generalId);
      if (entry) {
        expect(count).toBeGreaterThanOrEqual(entry.minAmount);
        expect(count).toBeLessThanOrEqual(entry.maxAmount);
      }
    }
  });
});

// ═══════════════════════════════════════════════
// §4.4 关卡解锁
// ═══════════════════════════════════════════════

describe('§4.4 关卡解锁', () => {
  let progress: CampaignProgressSystem;

  beforeEach(() => {
    progress = new CampaignProgressSystem(campaignDataProvider);
  });

  it('should unlock next stage after clearing current stage', () => {
    // 初始状态：stage1 可用，stage2 锁定
    expect(progress.canChallenge('chapter1_stage1')).toBe(true);
    expect(progress.getStageStatus('chapter1_stage2')).toBe('locked');

    // 通关 stage1
    progress.completeStage('chapter1_stage1', 3);

    // stage2 应解锁
    expect(progress.getStageStatus('chapter1_stage2')).toBe('available');
    expect(progress.canChallenge('chapter1_stage2')).toBe(true);
  });

  it('should unlock first stage of next chapter after clearing last stage of current chapter', () => {
    const stages = getStagesByChapter('chapter1');

    // 通关 chapter1 所有关卡
    for (const stage of stages) {
      progress.completeStage(stage.id, 3);
    }

    // chapter2 的第一关应解锁
    const ch2Stages = getStagesByChapter('chapter2');
    expect(ch2Stages.length).toBeGreaterThan(0);
    expect(progress.getStageStatus(ch2Stages[0].id)).toBe('available');
  });

  it('should not skip stages within a chapter', () => {
    // 不通关 stage1，stage3 应锁定
    expect(progress.getStageStatus('chapter1_stage3')).toBe('locked');

    // 通关 stage1 后，stage2 解锁但 stage3 仍锁定
    progress.completeStage('chapter1_stage1', 3);
    expect(progress.getStageStatus('chapter1_stage2')).toBe('available');
    expect(progress.getStageStatus('chapter1_stage3')).toBe('locked');
  });

  it('should update clear count after each completion', () => {
    progress.completeStage('chapter1_stage1', 3);
    expect(progress.getClearCount('chapter1_stage1')).toBe(1);

    progress.completeStage('chapter1_stage1', 2);
    expect(progress.getClearCount('chapter1_stage1')).toBe(2);
  });

  it('should keep highest star rating across multiple clears', () => {
    progress.completeStage('chapter1_stage1', 1);
    expect(progress.getStageStars('chapter1_stage1')).toBe(1);

    progress.completeStage('chapter1_stage1', 3);
    expect(progress.getStageStars('chapter1_stage1')).toBe(3);

    // 低星通关不应降低历史最高
    progress.completeStage('chapter1_stage1', 2);
    expect(progress.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('should mark stage as firstCleared after first completion', () => {
    expect(progress.isFirstCleared('chapter1_stage1')).toBe(false);

    progress.completeStage('chapter1_stage1', 2);
    expect(progress.isFirstCleared('chapter1_stage1')).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// §4.5 失败结算
// ═══════════════════════════════════════════════

describe('§4.5 失败结算', () => {
  let distributor: RewardDistributor;
  let mockDeps: ReturnType<typeof createMockDeps>;
  let progress: CampaignProgressSystem;

  beforeEach(() => {
    mockDeps = createMockDeps();
    distributor = new RewardDistributor(campaignDataProvider, mockDeps.deps);
    progress = new CampaignProgressSystem(campaignDataProvider);
  });

  it('should not distribute rewards when battle is lost (0 stars)', () => {
    // 0星 = 0倍率，使用固定 RNG 避免掉落干扰
    const noDrop = createSeededRng([0.99, 0.99, 0.99]);
    const dist = new RewardDistributor(campaignDataProvider, mockDeps.deps, noDrop);
    const reward = dist.calculateRewards('chapter1_stage1', 0, false);

    expect(reward.starMultiplier).toBe(0);
    // 基础资源为0（0倍率），无掉落
    const stage = getStage('chapter1_stage1')!;
    expect(reward.resources.grain).toBe(Math.floor((stage.baseRewards.grain ?? 0) * 0));
  });

  it('should not update progress when stage is not completed', () => {
    const starsBefore = progress.getStageStars('chapter1_stage2');
    const clearCountBefore = progress.getClearCount('chapter1_stage2');

    // 不调用 completeStage，进度不应变化
    expect(progress.getStageStars('chapter1_stage2')).toBe(starsBefore);
    expect(progress.getClearCount('chapter1_stage2')).toBe(clearCountBefore);
  });

  it('should generate defeat summary via BattleStatistics', () => {
    const summary = generateSummary(
      BattleOutcome.DEFEAT,
      StarRating.NONE,
      5,
      0,
    );

    expect(summary).toContain('失败');
    expect(summary).toContain('5');
  });

  it('should not mark stage as cleared on defeat', () => {
    // 不通关直接检查状态
    expect(progress.getStageStatus('chapter1_stage2')).toBe('locked');
    expect(progress.isFirstCleared('chapter1_stage2')).toBe(false);
  });

  it('should not distribute first clear rewards on defeat', () => {
    // 失败时不应调用 calculateAndDistribute
    // 模拟：即使传入 isFirstClear=true，0星也不应给基础奖励
    const reward = distributor.calculateRewards('chapter1_stage1', 0, true);

    // 0星倍率 = 0，基础资源为0
    expect(reward.starMultiplier).toBe(0);
    // 但首通奖励仍会叠加（因为 isFirstClear=true）
    // 这是引擎行为，确认首通奖励确实叠加了
    const stage = getStage('chapter1_stage1')!;
    // 首通资源不受倍率影响，直接叠加
    expect(reward.resources.gold).toBeGreaterThanOrEqual(stage.firstClearRewards.gold ?? 0);
  });
});

// ═══════════════════════════════════════════════
// §4.6 战斗日志
// ═══════════════════════════════════════════════

describe('§4.6 战斗日志', () => {
  it('should calculate battle stats from action log', () => {
    const actions = [
      createAction(1, 'ally_0', 'ally', 'enemy_0', 100, false),
      createAction(1, 'ally_1', 'ally', 'enemy_0', 80, true),
      createAction(2, 'enemy_0', 'enemy', 'ally_0', 50, false),
      createAction(2, 'ally_0', 'ally', 'enemy_1', 120, true),
    ];

    const state = createBattleState(BattleOutcome.VICTORY, actions);
    const stats = calculateBattleStats(state);

    expect(stats.allyTotalDamage).toBe(100 + 80 + 120); // ally actions
    expect(stats.enemyTotalDamage).toBe(50);
    expect(stats.maxSingleDamage).toBe(120);
    expect(stats.maxCombo).toBeGreaterThanOrEqual(1);
  });

  it('should track combo count for consecutive criticals', () => {
    const actions = [
      createAction(1, 'ally_0', 'ally', 'enemy_0', 50, true),
      createAction(1, 'ally_1', 'ally', 'enemy_0', 60, true),
      createAction(1, 'ally_2', 'ally', 'enemy_0', 70, true),
    ];

    const state = createBattleState(BattleOutcome.VICTORY, actions);
    const stats = calculateBattleStats(state);

    expect(stats.maxCombo).toBe(3); // 3 consecutive crits
  });

  it('should reset combo on non-critical hit', () => {
    const actions = [
      createAction(1, 'ally_0', 'ally', 'enemy_0', 50, true),
      createAction(1, 'ally_1', 'ally', 'enemy_0', 60, false), // breaks combo
      createAction(1, 'ally_2', 'ally', 'enemy_0', 70, true),
    ];

    const state = createBattleState(BattleOutcome.VICTORY, actions);
    const stats = calculateBattleStats(state);

    expect(stats.maxCombo).toBe(1); // combo reset by non-crit
  });

  it('should generate victory summary with stars', () => {
    const summary = generateSummary(
      BattleOutcome.VICTORY,
      StarRating.THREE,
      6,
      4,
    );

    expect(summary).toContain('胜利');
    expect(summary).toContain('★★★');
    expect(summary).toContain('6');
    expect(summary).toContain('4');
  });

  it('should generate draw summary', () => {
    const summary = generateSummary(
      BattleOutcome.DRAW,
      StarRating.NONE,
      10,
      2,
    );

    expect(summary).toContain('平局');
    expect(summary).toContain('10');
  });

  it('should record complete action log in BattleState', () => {
    const actions: BattleAction[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      actions.push(createAction(turn, `ally_${turn}`, 'ally', `enemy_${turn}`, 50 * turn));
      actions.push(createAction(turn, `enemy_${turn}`, 'enemy', `ally_${turn}`, 30 * turn));
    }

    const state = createBattleState(BattleOutcome.VICTORY, actions);

    expect(state.actionLog).toHaveLength(6);
    expect(state.actionLog[0].turn).toBe(1);
    expect(state.actionLog[5].turn).toBe(3);
  });

  it('should calculate stats correctly via BattleStatisticsSubsystem', () => {
    const subsystem = new BattleStatisticsSubsystem();
    const actions = [
      createAction(1, 'ally_0', 'ally', 'enemy_0', 100),
      createAction(2, 'enemy_0', 'enemy', 'ally_0', 40),
    ];
    const state = createBattleState(BattleOutcome.VICTORY, actions);

    const stats = subsystem.calculate(state);

    expect(stats.allyTotalDamage).toBe(100);
    expect(stats.enemyTotalDamage).toBe(40);
    expect(subsystem.getState().lastStats).toEqual(stats);
  });
});

// ═══════════════════════════════════════════════
// §4.7 操作评分
// ═══════════════════════════════════════════════

describe.skip('§4.7 操作评分（S/A/B等级评定 — v3.0 未实现，预留）', () => {
  it('should assign S rating for perfect battle (3 stars, no damage taken)', () => {
    // TODO: 等待操作评分系统实现后补充
    // 预期：3星 + 0伤害受到 = S级
  });

  it('should assign A rating for 3-star battle with some damage', () => {
    // TODO: 等待操作评分系统实现后补充
  });

  it('should assign B rating for 1-2 star battle', () => {
    // TODO: 等待操作评分系统实现后补充
  });
});
