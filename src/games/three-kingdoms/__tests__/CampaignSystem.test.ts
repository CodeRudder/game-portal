/**
 * CampaignSystem 测试
 */
import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_STAGES,
  type CampaignStage,
  type CampaignStageStatus,
  type VictoryCondition,
} from '../CampaignSystem';

describe('CampaignSystem', () => {
  it('should have 6 campaign stages', () => {
    expect(CAMPAIGN_STAGES).toHaveLength(6);
  });

  it('should have correct stage order', () => {
    const orders = CAMPAIGN_STAGES.map(s => s.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('should have prerequisite chain', () => {
    expect(CAMPAIGN_STAGES[0].prerequisiteStageId).toBeNull();
    for (let i = 1; i < CAMPAIGN_STAGES.length; i++) {
      expect(CAMPAIGN_STAGES[i].prerequisiteStageId).toBe(CAMPAIGN_STAGES[i - 1].id);
    }
  });

  it('should have unique stage IDs', () => {
    const ids = CAMPAIGN_STAGES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have unique target territories', () => {
    const territories = CAMPAIGN_STAGES.map(s => s.targetTerritoryId);
    expect(new Set(territories).size).toBe(territories.length);
  });

  it('should have enemy commanders with dialogue', () => {
    for (const stage of CAMPAIGN_STAGES) {
      const cmd = stage.enemyCommander;
      expect(cmd.name).toBeTruthy();
      expect(cmd.hp).toBeGreaterThan(0);
      expect(cmd.attack).toBeGreaterThan(0);
      expect(cmd.dialogue.opening).toBeTruthy();
      expect(cmd.dialogue.defeat).toBeTruthy();
    }
  });

  it('should have enemy units for each stage', () => {
    for (const stage of CAMPAIGN_STAGES) {
      expect(stage.enemyUnits.length).toBeGreaterThan(0);
      for (const unit of stage.enemyUnits) {
        expect(unit.count).toBeGreaterThan(0);
        expect(unit.hpPerUnit).toBeGreaterThan(0);
      }
    }
  });

  it('should have map layouts with deployment zones', () => {
    for (const stage of CAMPAIGN_STAGES) {
      const map = stage.mapLayout;
      expect(map.width).toBeGreaterThan(0);
      expect(map.height).toBeGreaterThan(0);
      expect(map.deploymentZone.width).toBeGreaterThan(0);
      expect(map.deploymentZone.height).toBeGreaterThan(0);
    }
  });

  it('should have first stage easiest and last stage hardest', () => {
    const firstHp = CAMPAIGN_STAGES[0].enemyCommander.hp;
    const lastHp = CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1].enemyCommander.hp;
    expect(lastHp).toBeGreaterThan(firstHp);
  });

  it('should have star thresholds', () => {
    for (const stage of CAMPAIGN_STAGES) {
      expect(stage.starThresholds.threeStar).toBeGreaterThan(stage.starThresholds.twoStar);
    }
  });

  it('should have various victory conditions', () => {
    const conditions = CAMPAIGN_STAGES.map(s => s.victoryCondition);
    const uniqueConditions = new Set(conditions);
    expect(uniqueConditions.size).toBeGreaterThanOrEqual(3);
  });

  it('should have story progression (subtitles)', () => {
    const subtitles = CAMPAIGN_STAGES.map(s => s.subtitle);
    expect(subtitles[0]).toContain('第一章');
    expect(subtitles[subtitles.length - 1]).toContain('终章');
  });

  it('should have rewards with territory', () => {
    for (const stage of CAMPAIGN_STAGES) {
      expect(stage.rewards.territory).toBeTruthy();
      expect(stage.rewards.resources).toBeDefined();
    }
  });

  it('should unlock heroes in early stages', () => {
    const heroStages = CAMPAIGN_STAGES.filter(s => s.rewards.unlockHero);
    expect(heroStages.length).toBeGreaterThanOrEqual(3);
  });
});
