/**
 * 攻城略地关卡系统测试
 *
 * 覆盖：
 * - 关卡数据完整性（6关都有数据）
 * - 解锁逻辑测试
 * - 战斗计算测试（各种战力对比）
 * - 星级计算测试
 * - 奖励发放测试
 * - 序列化/反序列化
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CAMPAIGN_STAGE_DEFINITIONS,
  DIFFICULTY_DISPLAY,
  ERA_COLORS,
  type CampaignStage,
  type CampaignEra,
  type StarRating,
} from '../ThreeKingdomsCampaign';
import {
  ThreeKingdomsCampaignManager,
  STAR_THRESHOLDS,
  TOTAL_STAGE_COUNT,
  formatPower,
  getDifficultyInfo,
} from '../ThreeKingdomsCampaignManager';

// ═══════════════════════════════════════════════════════════════
// 关卡数据完整性测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaign - 关卡数据完整性', () => {
  it('should have exactly 6 campaign stages', () => {
    expect(CAMPAIGN_STAGE_DEFINITIONS).toHaveLength(6);
  });

  it('should have unique stage IDs', () => {
    const ids = CAMPAIGN_STAGE_DEFINITIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have sequential stage IDs from stage_1 to stage_6', () => {
    const ids = CAMPAIGN_STAGE_DEFINITIONS.map(s => s.id);
    expect(ids).toEqual(['stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5', 'stage_6']);
  });

  it('should have all required fields for each stage', () => {
    for (const stage of CAMPAIGN_STAGE_DEFINITIONS) {
      expect(stage.id).toBeTruthy();
      expect(stage.name).toBeTruthy();
      expect(stage.description).toBeTruthy();
      expect(stage.era).toBeTruthy();
      expect(stage.difficulty).toBeGreaterThanOrEqual(1);
      expect(stage.difficulty).toBeLessThanOrEqual(5);
      expect(stage.enemyFaction).toBeTruthy();
      expect(stage.enemyLeader).toBeTruthy();
      expect(stage.requiredPower).toBeGreaterThan(0);
      expect(stage.rewards).toBeDefined();
    }
  });

  it('should have increasing difficulty and power requirements', () => {
    for (let i = 1; i < CAMPAIGN_STAGE_DEFINITIONS.length; i++) {
      const prev = CAMPAIGN_STAGE_DEFINITIONS[i - 1];
      const curr = CAMPAIGN_STAGE_DEFINITIONS[i];
      expect(curr.requiredPower).toBeGreaterThan(prev.requiredPower);
      expect(curr.difficulty).toBeGreaterThanOrEqual(prev.difficulty);
    }
  });

  it('should cover all 6 historical eras', () => {
    const eras = CAMPAIGN_STAGE_DEFINITIONS.map(s => s.era);
    const expectedEras: CampaignEra[] = ['黄巾', '董卓', '群雄', '官渡', '赤壁', '三国'];
    expect(eras).toEqual(expectedEras);
  });

  it('should have meaningful names matching historical battles', () => {
    const names = CAMPAIGN_STAGE_DEFINITIONS.map(s => s.name);
    expect(names).toContain('黄巾之乱');
    expect(names).toContain('讨伐董卓');
    expect(names).toContain('群雄割据');
    expect(names).toContain('官渡之战');
    expect(names).toContain('赤壁之战');
    expect(names).toContain('三分天下');
  });

  it('should have rewards for every stage', () => {
    for (const stage of CAMPAIGN_STAGE_DEFINITIONS) {
      const rewardValues = Object.values(stage.rewards).filter(v => v !== undefined);
      expect(rewardValues.length).toBeGreaterThan(0);
    }
  });

  it('should have at least one stage with hero reward', () => {
    const stagesWithHero = CAMPAIGN_STAGE_DEFINITIONS.filter(s => s.rewards.heroId);
    expect(stagesWithHero.length).toBeGreaterThanOrEqual(1);
  });

  it('should have difficulty display config for levels 1-5', () => {
    for (let i = 1; i <= 5; i++) {
      expect(DIFFICULTY_DISPLAY[i]).toBeDefined();
      expect(DIFFICULTY_DISPLAY[i].label).toBeTruthy();
      expect(DIFFICULTY_DISPLAY[i].color).toBeTruthy();
      expect(DIFFICULTY_DISPLAY[i].stars).toBeTruthy();
    }
  });

  it('should have era colors for all eras', () => {
    const eras: CampaignEra[] = ['黄巾', '董卓', '群雄', '官渡', '赤壁', '三国'];
    for (const era of eras) {
      expect(ERA_COLORS[era]).toBeDefined();
      expect(ERA_COLORS[era]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// CampaignManager 基础功能测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaignManager - 基础功能', () => {
  let manager: ThreeKingdomsCampaignManager;

  beforeEach(() => {
    manager = new ThreeKingdomsCampaignManager();
  });

  it('should return 6 stages', () => {
    expect(manager.getStages()).toHaveLength(6);
  });

  it('should have stage count equal to 6', () => {
    expect(manager.getStageCount()).toBe(6);
    expect(TOTAL_STAGE_COUNT).toBe(6);
  });

  it('should have only first stage unlocked initially', () => {
    const stages = manager.getStages();
    expect(stages[0].unlocked).toBe(true);
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].unlocked).toBe(false);
    }
  });

  it('should have no completed stages initially', () => {
    expect(manager.getCompletedCount()).toBe(0);
    expect(manager.getTotalStars()).toBe(0);
  });

  it('should return correct stage by ID', () => {
    const stage = manager.getStage('stage_1');
    expect(stage).toBeDefined();
    expect(stage!.name).toBe('黄巾之乱');
    expect(stage!.era).toBe('黄巾');
  });

  it('should return undefined for non-existent stage', () => {
    expect(manager.getStage('nonexistent')).toBeUndefined();
  });

  it('should return recommended power for a stage', () => {
    expect(manager.getRecommendedPower('stage_1')).toBe(1000);
    expect(manager.getRecommendedPower('stage_6')).toBe(100000);
    expect(manager.getRecommendedPower('nonexistent')).toBe(0);
  });

  it('should return next available stage', () => {
    const next = manager.getNextAvailableStage();
    expect(next).toBeDefined();
    expect(next!.id).toBe('stage_1');
  });

  it('should not be all completed initially', () => {
    expect(manager.isAllCompleted()).toBe(false);
  });

  it('should have max stars = 18 (6 stages × 3 stars)', () => {
    expect(manager.getMaxStars()).toBe(18);
  });
});

// ═══════════════════════════════════════════════════════════════
// 解锁逻辑测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaignManager - 解锁逻辑', () => {
  let manager: ThreeKingdomsCampaignManager;

  beforeEach(() => {
    manager = new ThreeKingdomsCampaignManager();
  });

  it('should unlock stage_2 after completing stage_1', () => {
    expect(manager.getStage('stage_2')!.unlocked).toBe(false);

    manager.challenge('stage_1', 1000); // Win with equal power

    expect(manager.getStage('stage_2')!.unlocked).toBe(true);
  });

  it('should not unlock stage_3 without completing stage_2', () => {
    manager.challenge('stage_1', 1000);
    expect(manager.getStage('stage_3')!.unlocked).toBe(false);
  });

  it('should unlock all stages sequentially', () => {
    const powers = [1000, 5000, 15000, 30000, 50000, 100000];

    for (let i = 0; i < 6; i++) {
      const stageId = `stage_${i + 1}`;
      expect(manager.getStage(stageId)!.unlocked).toBe(true);
      manager.challenge(stageId, powers[i]);
    }

    expect(manager.isAllCompleted()).toBe(true);
  });

  it('should return false when trying to unlock after last stage', () => {
    manager.challenge('stage_6', 100000);
    // stage_6 is last, no next stage to unlock
    const result = manager.unlockNext('stage_6');
    expect(result).toBe(false);
  });

  it('should return false when unlocking non-existent stage', () => {
    const result = manager.unlockNext('nonexistent');
    expect(result).toBe(false);
  });

  it('should not allow challenging locked stages', () => {
    const result = manager.challenge('stage_3', 99999);
    expect(result.won).toBe(false);
    expect(result.stars).toBe(0);
    expect(result.rewards).toEqual({});
  });

  it('should not allow challenging non-existent stages', () => {
    const result = manager.challenge('stage_99', 99999);
    expect(result.won).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 星级计算测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaignManager - 星级计算', () => {
  let manager: ThreeKingdomsCampaignManager;

  beforeEach(() => {
    manager = new ThreeKingdomsCampaignManager();
  });

  it('should return 0 stars when player power is less than enemy power', () => {
    expect(manager.calculateStars(500, 1000)).toBe(0);
    expect(manager.calculateStars(999, 1000)).toBe(0);
  });

  it('should return 1 star when player power equals enemy power', () => {
    expect(manager.calculateStars(1000, 1000)).toBe(1);
    expect(manager.calculateStars(1199, 1000)).toBe(1);
  });

  it('should return 2 stars when player power >= 1.2x enemy power', () => {
    expect(manager.calculateStars(1200, 1000)).toBe(2);
    expect(manager.calculateStars(1499, 1000)).toBe(2);
  });

  it('should return 3 stars when player power >= 1.5x enemy power', () => {
    expect(manager.calculateStars(1500, 1000)).toBe(3);
    expect(manager.calculateStars(2000, 1000)).toBe(3);
    expect(manager.calculateStars(99999, 1000)).toBe(3);
  });

  it('should handle edge cases at exact thresholds', () => {
    // Exactly 1.0x
    expect(manager.calculateStars(1000, 1000)).toBe(1);
    // Exactly 1.2x
    expect(manager.calculateStars(1200, 1000)).toBe(2);
    // Exactly 1.5x
    expect(manager.calculateStars(1500, 1000)).toBe(3);
  });

  it('should handle zero enemy power', () => {
    expect(manager.calculateStars(0, 0)).toBe(3);
    expect(manager.calculateStars(100, 0)).toBe(3);
  });

  it('should verify star threshold constants', () => {
    expect(STAR_THRESHOLDS.ONE_STAR).toBe(1.0);
    expect(STAR_THRESHOLDS.TWO_STAR).toBe(1.2);
    expect(STAR_THRESHOLDS.THREE_STAR).toBe(1.5);
  });
});

// ═══════════════════════════════════════════════════════════════
// 战斗计算测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaignManager - 战斗计算', () => {
  let manager: ThreeKingdomsCampaignManager;

  beforeEach(() => {
    manager = new ThreeKingdomsCampaignManager();
  });

  it('should win with equal power (1 star)', () => {
    const result = manager.challenge('stage_1', 1000);
    expect(result.won).toBe(true);
    expect(result.stars).toBe(1);
  });

  it('should win with 1.2x power (2 stars)', () => {
    const result = manager.challenge('stage_1', 1200);
    expect(result.won).toBe(true);
    expect(result.stars).toBe(2);
  });

  it('should win with 1.5x power (3 stars)', () => {
    const result = manager.challenge('stage_1', 1500);
    expect(result.won).toBe(true);
    expect(result.stars).toBe(3);
  });

  it('should lose with insufficient power', () => {
    const result = manager.challenge('stage_1', 500);
    expect(result.won).toBe(false);
    expect(result.stars).toBe(0);
  });

  it('should lose with just below required power', () => {
    const result = manager.challenge('stage_1', 999);
    expect(result.won).toBe(false);
    expect(result.stars).toBe(0);
  });

  it('should not complete stage when losing', () => {
    manager.challenge('stage_1', 500);
    const stage = manager.getStage('stage_1')!;
    expect(stage.completed).toBe(false);
    expect(stage.stars).toBe(0);
  });

  it('should complete stage when winning', () => {
    manager.challenge('stage_1', 1000);
    const stage = manager.getStage('stage_1')!;
    expect(stage.completed).toBe(true);
    expect(stage.stars).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 奖励发放测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaignManager - 奖励发放', () => {
  let manager: ThreeKingdomsCampaignManager;

  beforeEach(() => {
    manager = new ThreeKingdomsCampaignManager();
  });

  it('should give rewards on victory', () => {
    const result = manager.challenge('stage_1', 1000);
    expect(result.won).toBe(true);
    expect(result.rewards.gold).toBe(500);
    expect(result.rewards.food).toBe(800);
    expect(result.rewards.iron).toBe(100);
    expect(result.rewards.reputation).toBe(10);
    expect(result.rewards.heroId).toBe('liubei');
  });

  it('should give no rewards on defeat', () => {
    const result = manager.challenge('stage_1', 500);
    expect(result.won).toBe(false);
    expect(result.rewards).toEqual({});
  });

  it('should give correct rewards for stage_2', () => {
    manager.challenge('stage_1', 1500); // Complete stage 1 to unlock stage 2
    const result = manager.challenge('stage_2', 5000);
    expect(result.won).toBe(true);
    expect(result.rewards.gold).toBe(2000);
    expect(result.rewards.heroId).toBe('guanyu');
  });

  it('should give correct rewards for stage_4 (no hero)', () => {
    // Progress to stage 4
    manager.challenge('stage_1', 1500);
    manager.challenge('stage_2', 7500);
    manager.challenge('stage_3', 22500);
    const result = manager.challenge('stage_4', 30000);
    expect(result.won).toBe(true);
    expect(result.rewards.gold).toBe(10000);
    expect(result.rewards.heroId).toBeUndefined();
  });

  it('should give correct rewards for final stage', () => {
    // Complete all stages
    manager.challenge('stage_1', 1500);
    manager.challenge('stage_2', 7500);
    manager.challenge('stage_3', 22500);
    manager.challenge('stage_4', 45000);
    manager.challenge('stage_5', 75000);
    const result = manager.challenge('stage_6', 150000);
    expect(result.won).toBe(true);
    expect(result.rewards.gold).toBe(50000);
    expect(result.rewards.reputation).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// 进度和序列化测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaignManager - 进度和序列化', () => {
  let manager: ThreeKingdomsCampaignManager;

  beforeEach(() => {
    manager = new ThreeKingdomsCampaignManager();
  });

  it('should track completed count correctly', () => {
    expect(manager.getCompletedCount()).toBe(0);
    manager.challenge('stage_1', 1000);
    expect(manager.getCompletedCount()).toBe(1);
    manager.challenge('stage_2', 5000);
    expect(manager.getCompletedCount()).toBe(2);
  });

  it('should track total stars correctly', () => {
    expect(manager.getTotalStars()).toBe(0);
    manager.challenge('stage_1', 1500); // 3 stars
    expect(manager.getTotalStars()).toBe(3);
    manager.challenge('stage_2', 5000); // 1 star
    expect(manager.getTotalStars()).toBe(4);
  });

  it('should update to higher stars on re-challenge', () => {
    manager.challenge('stage_1', 1000); // 1 star
    expect(manager.getStage('stage_1')!.stars).toBe(1);

    manager.challenge('stage_1', 1500); // 3 stars
    expect(manager.getStage('stage_1')!.stars).toBe(3);
  });

  it('should not downgrade stars on re-challenge with lower power', () => {
    manager.challenge('stage_1', 1500); // 3 stars
    manager.challenge('stage_1', 1000); // 1 star attempt
    expect(manager.getStage('stage_1')!.stars).toBe(3); // stays 3
  });

  it('should serialize and deserialize correctly', () => {
    manager.challenge('stage_1', 1500);   // 3 stars (1.5x)
    manager.challenge('stage_2', 6000);   // 2 stars (1.2x)

    const data = manager.serialize();

    const newManager = new ThreeKingdomsCampaignManager();
    newManager.deserialize(data);

    expect(newManager.getStage('stage_1')!.completed).toBe(true);
    expect(newManager.getStage('stage_1')!.stars).toBe(3);
    expect(newManager.getStage('stage_2')!.completed).toBe(true);
    expect(newManager.getStage('stage_2')!.stars).toBe(2);
    expect(newManager.getStage('stage_3')!.unlocked).toBe(true);
    expect(newManager.getStage('stage_3')!.completed).toBe(false);
    expect(newManager.getCompletedCount()).toBe(2);
    expect(newManager.getTotalStars()).toBe(5);
  });

  it('should handle deserialize with empty data', () => {
    const newManager = new ThreeKingdomsCampaignManager();
    expect(() => newManager.deserialize({})).not.toThrow();
    expect(() => newManager.deserialize({ stages: undefined })).not.toThrow();
  });

  it('should reset all stages', () => {
    manager.challenge('stage_1', 1500);
    manager.challenge('stage_2', 7500);
    expect(manager.getCompletedCount()).toBe(2);

    manager.reset();

    expect(manager.getCompletedCount()).toBe(0);
    expect(manager.getTotalStars()).toBe(0);
    expect(manager.getStage('stage_1')!.unlocked).toBe(true);
    expect(manager.getStage('stage_2')!.unlocked).toBe(false);
  });

  it('should detect all completed state', () => {
    const powers = [1500, 7500, 22500, 45000, 75000, 150000];
    for (let i = 0; i < 6; i++) {
      expect(manager.isAllCompleted()).toBe(false);
      manager.challenge(`stage_${i + 1}`, powers[i]);
    }
    expect(manager.isAllCompleted()).toBe(true);
  });

  it('should update next available stage after each completion', () => {
    expect(manager.getNextAvailableStage()!.id).toBe('stage_1');

    manager.challenge('stage_1', 1500);
    expect(manager.getNextAvailableStage()!.id).toBe('stage_2');

    manager.challenge('stage_2', 7500);
    expect(manager.getNextAvailableStage()!.id).toBe('stage_3');
  });
});

// ═══════════════════════════════════════════════════════════════
// 工具函数测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsCampaign - 工具函数', () => {
  it('should format power with commas', () => {
    expect(formatPower(1000)).toBe('1,000');
    expect(formatPower(50000)).toBe('50,000');
    expect(formatPower(100000)).toBe('100,000');
    expect(formatPower(0)).toBe('0');
  });

  it('should floor power before formatting', () => {
    expect(formatPower(1000.7)).toBe('1,000');
  });

  it('should return difficulty info for valid levels', () => {
    const info = getDifficultyInfo(1);
    expect(info.label).toBe('入门');
    expect(info.color).toBe('#4ade80');
  });

  it('should return default difficulty info for invalid levels', () => {
    const info = getDifficultyInfo(99);
    expect(info.label).toBe('入门'); // defaults to level 1
  });
});
