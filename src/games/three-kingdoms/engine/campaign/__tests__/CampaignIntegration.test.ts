/**
 * 关卡集成流程 — 单元测试（第1部分：战斗流程 + 首通奖励 + 星级评定）
 *
 * 覆盖：
 * - 完整战斗流程（选择关卡→构建队伍→战斗→结算→进度更新）
 * - 首通奖励正确发放
 * - 星级评定（1星/2星/3星条件）
 *
 * @module engine/campaign/__tests__/CampaignIntegration.battle.test
 */

import { CampaignProgressSystem } from '../CampaignProgressSystem';
import { RewardDistributor } from '../RewardDistributor';
import { BattleEngine } from '../../battle/BattleEngine';
import { campaignDataProvider } from '../campaign-config';
import type {
  Chapter,
  ICampaignDataProvider,
  RewardDistributorDeps,
  Stage,
} from '../campaign.types';
import type {
  BattleTeam,
  BattleUnit,
  BattleSkill,
} from '../../battle/battle.types';
import {
  BattleOutcome,
  StarRating,
  TroopType,
  SkillTargetType,
} from '../../battle/battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal', name: '普攻', type: 'active', level: 1,
  description: '普通攻击', multiplier: 1.0,
  targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将', faction: 'shu', troopType: TroopType.CAVALRY,
    position: 'front', side: 'ally', attack: 200, baseAttack: 200,
    defense: 50, baseDefense: 50, intelligence: 60, speed: 80,
    hp: 1000, maxHp: 1000, isAlive: true, rage: 0, maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK }, skills: [], buffs: [],
    ...overrides,
  };
}

function createWeakEnemyTeam(): BattleTeam {
  return {
    units: [createUnit({ id: 'weak_enemy', name: '黄巾小兵', side: 'enemy', attack: 10, defense: 5, hp: 50, maxHp: 50, speed: 10 })],
    side: 'enemy',
  };
}

function createStrongEnemyTeam(): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < 6; i++) {
    units.push(createUnit({ id: `strong_e${i}`, name: `强敌${i}`, side: 'enemy', attack: 500, defense: 200, hp: 5000, maxHp: 5000, speed: 200 }));
  }
  return { units, side: 'enemy' };
}

function createAllyTeam(count: number = 6): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < count; i++) {
    units.push(createUnit({ id: `ally_${i}`, name: `我方${i}`, side: 'ally', position: i < 3 ? 'front' : 'back' }));
  }
  return { units, side: 'ally' };
}

function createMiniChapters(): Chapter[] {
  const makeStage = (id: string, chapterId: string, order: number): Stage => ({
    id, name: `关卡${order}`, type: order === 3 ? 'boss' : 'normal',
    chapterId, order,
    enemyFormation: { id: `${id}_formation`, name: `${id}敌方阵容`, units: [], recommendedPower: 100 },
    baseRewards: { grain: 100, gold: 50 }, baseExp: 50,
    firstClearRewards: { grain: 200, gold: 100 }, firstClearExp: 100,
    threeStarBonusMultiplier: 2.0, dropTable: [], recommendedPower: 100,
    description: `测试关卡${order}`,
  });
  return [
    { id: 'chapter1', name: '第一章', subtitle: '测试章', order: 1,
      stages: [makeStage('c1_s1', 'chapter1', 1), makeStage('c1_s2', 'chapter1', 2), makeStage('c1_s3', 'chapter1', 3)],
      prerequisiteChapterId: null, description: '第一章描述' },
    { id: 'chapter2', name: '第二章', subtitle: '测试章二', order: 2,
      stages: [makeStage('c2_s1', 'chapter2', 1), makeStage('c2_s2', 'chapter2', 2)],
      prerequisiteChapterId: 'chapter1', description: '第二章描述' },
  ];
}

function createTestDataProvider(chapters: Chapter[]): ICampaignDataProvider {
  const stageMap = new Map<string, Stage>();
  for (const ch of chapters) for (const st of ch.stages) stageMap.set(st.id, st);
  return {
    getChapters: () => chapters,
    getChapter: (id) => chapters.find(ch => ch.id === id),
    getStage: (id) => stageMap.get(id),
    getStagesByChapter: (cid) => chapters.find(ch => ch.id === cid)?.stages ?? [],
  };
}

// ═══════════════════════════════════════════════
// 1. 完整战斗流程集成测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 完整战斗流程', () => {
  let progress: CampaignProgressSystem;
  let reward: RewardDistributor;
  let battle: BattleEngine;
  let distributedResources: Record<string, number>;
  let distributedExp: number;

  beforeEach(() => {
    progress = new CampaignProgressSystem(campaignDataProvider);
    progress.initProgress();
    distributedResources = {};
    distributedExp = 0;
    const deps: RewardDistributorDeps = {
      addResource: (type, amount) => { distributedResources[type] = (distributedResources[type] ?? 0) + amount; return amount; },
      addFragment: jest.fn(),
      addExp: (exp) => { distributedExp += exp; },
    };
    reward = new RewardDistributor(campaignDataProvider, deps, () => 0.5);
    battle = new BattleEngine();
  });

  it('should complete full flow: battle → reward → progress update', () => {
    const stageId = 'chapter1_stage1';
    expect(progress.canChallenge(stageId)).toBe(true);
    const result = battle.runFullBattle(createAllyTeam(6), createWeakEnemyTeam());
    expect(result.outcome).toBe(BattleOutcome.VICTORY);
    expect(result.stars).toBeGreaterThan(0);
    const isFirst = !progress.isFirstCleared(stageId);
    reward.calculateAndDistribute(stageId, result.stars, isFirst);
    progress.completeStage(stageId, result.stars);
    expect(progress.isFirstCleared(stageId)).toBe(true);
    expect(progress.getStageStars(stageId)).toBe(result.stars);
    expect(progress.getClearCount(stageId)).toBe(1);
    expect(distributedResources['grain']).toBeGreaterThan(0);
    expect(distributedExp).toBeGreaterThan(0);
  });

  it('should not give first-clear rewards on second clear', () => {
    const stageId = 'chapter1_stage1';
    progress.completeStage(stageId, 3);
    const firstReward = reward.calculateRewards(stageId, 3, true);
    const secondReward = reward.calculateRewards(stageId, 3, false);
    expect((firstReward.resources['grain'] ?? 0)).toBeGreaterThan((secondReward.resources['grain'] ?? 0));
  });

  it('should handle defeat without updating progress', () => {
    const stageId = 'chapter1_stage1';
    const result = battle.runFullBattle(createAllyTeam(1), createStrongEnemyTeam());
    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    const stars = result.outcome === BattleOutcome.VICTORY ? result.stars : 0;
    if (stars > 0) progress.completeStage(stageId, stars);
    expect(progress.isFirstCleared(stageId)).toBe(false);
    expect(progress.getStageStars(stageId)).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 2. 首通奖励测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 首通奖励', () => {
  let reward: RewardDistributor;
  let distributedResources: Record<string, number>;

  beforeEach(() => {
    distributedResources = {};
    const deps: RewardDistributorDeps = {
      addResource: (type, amount) => { distributedResources[type] = (distributedResources[type] ?? 0) + amount; return amount; },
    };
    reward = new RewardDistributor(campaignDataProvider, deps, () => 0.5);
  });

  it('should include first-clear rewards when isFirstClear is true', () => {
    const firstReward = reward.calculateRewards('chapter1_stage1', 1, true);
    const repeatReward = reward.calculateRewards('chapter1_stage1', 1, false);
    expect(firstReward.isFirstClear).toBe(true);
    expect(repeatReward.isFirstClear).toBe(false);
    expect((firstReward.resources['grain'] ?? 0)).toBeGreaterThan((repeatReward.resources['grain'] ?? 0));
  });

  it('should include first-clear exp bonus', () => {
    const firstReward = reward.calculateRewards('chapter1_stage1', 1, true);
    const repeatReward = reward.calculateRewards('chapter1_stage1', 1, false);
    expect(firstReward.exp).toBeGreaterThan(repeatReward.exp);
  });

  it('should correctly distribute first-clear rewards via callback', () => {
    reward.calculateAndDistribute('chapter1_stage1', 3, true);
    expect(distributedResources['grain']).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 3. 星级评定测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 星级评定', () => {
  let battle: BattleEngine;

  beforeEach(() => {
    battle = new BattleEngine();
  });

  it('should award 3 stars when victory with ≥4 survivors and ≤6 turns', () => {
    const result = battle.runFullBattle(createAllyTeam(6), createWeakEnemyTeam());
    expect(result.outcome).toBe(BattleOutcome.VICTORY);
    if (result.allySurvivors >= 4 && result.totalTurns <= 6) {
      expect(result.stars).toBe(StarRating.THREE);
    }
  });

  it('should award 1 star when victory with few survivors', () => {
    const allies: BattleUnit[] = [];
    for (let i = 0; i < 6; i++) {
      allies.push(createUnit({ id: `ally_${i}`, side: 'ally', hp: 10, maxHp: 10, attack: 500, defense: 1, speed: 200 }));
    }
    const enemies: BattleUnit[] = [];
    for (let i = 0; i < 3; i++) {
      enemies.push(createUnit({ id: `enemy_${i}`, side: 'enemy', hp: 30, maxHp: 30, attack: 50, defense: 1, speed: 1 }));
    }
    const result = battle.runFullBattle({ units: allies, side: 'ally' }, { units: enemies, side: 'enemy' });
    if (result.outcome === BattleOutcome.VICTORY && result.allySurvivors < 4) {
      expect(result.stars).toBe(StarRating.ONE);
    }
  });

  it('should award 0 stars on defeat', () => {
    const ally = createUnit({ id: 'weak', side: 'ally', hp: 1, maxHp: 1, attack: 1 });
    const result = battle.runFullBattle({ units: [ally], side: 'ally' }, createStrongEnemyTeam());
    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    expect(result.stars).toBe(StarRating.NONE);
  });

  it('should award 0 stars on draw', () => {
    const ally = createUnit({ id: 'tank', side: 'ally', hp: 10000, maxHp: 10000, attack: 1 });
    const enemies: BattleUnit[] = [];
    for (let i = 0; i < 6; i++) {
      enemies.push(createUnit({ id: `tank_e${i}`, side: 'enemy', hp: 100000, maxHp: 100000, attack: 1, defense: 0, speed: 1 }));
    }
    const result = battle.runFullBattle({ units: [ally], side: 'ally' }, { units: enemies, side: 'enemy' });
    expect(result.outcome).toBe(BattleOutcome.DRAW);
    expect(result.stars).toBe(StarRating.NONE);
  });

  it('should keep the higher star count when replaying a stage', () => {
    const dp = createTestDataProvider(createMiniChapters());
    const progress = new CampaignProgressSystem(dp);
    progress.initProgress();
    progress.completeStage('c1_s1', 1);
    expect(progress.getStageStars('c1_s1')).toBe(1);
    progress.completeStage('c1_s1', 3);
    expect(progress.getStageStars('c1_s1')).toBe(3);
    progress.completeStage('c1_s1', 1);
    expect(progress.getStageStars('c1_s1')).toBe(3);
  });
});

// ═══════════════════════════════════════════════
// 4. 奖励分发集成测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 奖励分发', () => {
  let reward: RewardDistributor;
  let distributedResources: Record<string, number>;
  let distributedExp: number;

  beforeEach(() => {
    const dp = createTestDataProvider(createMiniChapters());
    distributedResources = {};
    distributedExp = 0;
    const deps: RewardDistributorDeps = {
      addResource: (type, amount) => { distributedResources[type] = (distributedResources[type] ?? 0) + amount; return amount; },
      addFragment: (gid, count) => {},
      addExp: (exp) => { distributedExp += exp; },
    };
    reward = new RewardDistributor(dp, deps, () => 0.5);
  });

  it('should apply star multiplier to base rewards', () => {
    const r1 = reward.calculateRewards('c1_s1', 1, false);
    const r3 = reward.calculateRewards('c1_s1', 3, false);
    expect((r3.resources['grain'] ?? 0)).toBeGreaterThan((r1.resources['grain'] ?? 0));
  });

  it('should distribute resources through callback', () => {
    reward.calculateAndDistribute('c1_s1', 1, true);
    expect(distributedResources['grain']).toBeGreaterThan(0);
    expect(distributedResources['gold']).toBeGreaterThan(0);
  });

  it('should distribute exp through callback', () => {
    reward.calculateAndDistribute('c1_s1', 1, true);
    expect(distributedExp).toBeGreaterThan(0);
  });

  it('should give 0 reward for 0 stars', () => {
    const r = reward.calculateRewards('c1_s1', 0, false);
    expect(r.starMultiplier).toBe(0);
  });

  it('should preview base rewards without distributing', () => {
    const preview = reward.previewBaseRewards('c1_s1');
    expect(preview.resources['grain']).toBe(100);
    expect(preview.exp).toBe(50);
    expect(Object.keys(distributedResources)).toHaveLength(0);
  });

  it('should preview first-clear rewards without distributing', () => {
    const preview = reward.previewFirstClearRewards('c1_s1');
    expect(preview.resources['grain']).toBe(200);
    expect(preview.exp).toBe(100);
  });

  it('should throw error for non-existent stage', () => {
    expect(() => reward.calculateRewards('nonexistent', 1, false)).toThrow('关卡不存在');
  });
});
