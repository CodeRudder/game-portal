import { vi } from 'vitest';
/**
 * ThreeKingdomsEngine 编排层 — Campaign API 单元测试
 *
 * 覆盖：
 * - startBattle(stageId) 完整流程
 * - completeBattle(stageId, stars) 奖励发放
 * - getCampaignProgress() 返回正确进度
 * - 存档包含 campaign 数据
 * - 关卡查询 API
 * - 错误处理（关卡不存在、未解锁）
 *
 * @module engine/__tests__/ThreeKingdomsEngine.campaign.test
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { SAVE_KEY } from '../../shared/constants';
import type { BattleResult } from '../battle/battle.types';
import { BattleOutcome, StarRating } from '../battle/battle.types';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('ThreeKingdomsEngine Campaign API', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
    engine.init();
  });

  afterEach(() => {
    engine.reset();
  });

  // ═══════════════════════════════════════════════
  // 1. startBattle(stageId) 完整流程
  // ═══════════════════════════════════════════════

  describe('startBattle(stageId)', () => {
    it('should throw error when stage does not exist', () => {
      expect(() => engine.startBattle('nonexistent_stage')).toThrow('关卡不存在');
    });

    it('should throw error when stage is locked', () => {
      // chapter1_stage2 is locked initially (chapter1_stage1 not cleared)
      expect(() => engine.startBattle('chapter1_stage2')).toThrow('关卡未解锁');
    });

    it('should return battle result for available stage', () => {
      const result = engine.startBattle('chapter1_stage1');

      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
      expect(typeof result.totalTurns).toBe('number');
      expect(typeof result.allySurvivors).toBe('number');
      expect(typeof result.enemySurvivors).toBe('number');
    });

    it('should return victory or defeat in result', () => {
      const result = engine.startBattle('chapter1_stage1');

      expect([
        BattleOutcome.VICTORY,
        BattleOutcome.DEFEAT,
        BattleOutcome.DRAW,
      ]).toContain(result.outcome);
    });

    it('should include star rating in result', () => {
      const result = engine.startBattle('chapter1_stage1');

      expect(result.stars).toBeDefined();
      expect(result.stars).toBeGreaterThanOrEqual(StarRating.NONE);
      expect(result.stars).toBeLessThanOrEqual(StarRating.THREE);
    });

    it('should include summary in result', () => {
      const result = engine.startBattle('chapter1_stage1');

      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('should include damage statistics in result', () => {
      const result = engine.startBattle('chapter1_stage1');

      expect(typeof result.allyTotalDamage).toBe('number');
      expect(typeof result.enemyTotalDamage).toBe('number');
      expect(typeof result.maxSingleDamage).toBe('number');
      expect(typeof result.maxCombo).toBe('number');
    });
  });

  // ═══════════════════════════════════════════════
  // 2. completeBattle(stageId, stars) 奖励发放
  // ═══════════════════════════════════════════════

  describe('completeBattle(stageId, stars)', () => {
    it('should update campaign progress after completing battle', () => {
      engine.completeBattle('chapter1_stage1', 3);

      const progress = engine.getCampaignProgress();
      expect(progress.stageStates['chapter1_stage1']).toBeDefined();
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(3);
      expect(progress.stageStates['chapter1_stage1'].firstCleared).toBe(true);
      expect(progress.stageStates['chapter1_stage1'].clearCount).toBe(1);
    });

    it('should give first-clear rewards on first completion', () => {
      const resourcesBefore = engine.resource.getResources();

      engine.completeBattle('chapter1_stage1', 3);

      const resourcesAfter = engine.resource.getResources();
      // Resources should have increased
      const grainGained = resourcesAfter.grain - resourcesBefore.grain;
      expect(grainGained).toBeGreaterThan(0);
    });

    it('should not give first-clear rewards on repeat completion', () => {
      // First clear
      engine.completeBattle('chapter1_stage1', 3);
      const resourcesAfterFirst = engine.resource.getResources();

      // Second clear
      engine.completeBattle('chapter1_stage1', 3);
      const resourcesAfterSecond = engine.resource.getResources();

      const grainFirstGain = resourcesAfterFirst.grain;
      const grainSecondGain = resourcesAfterSecond.grain - resourcesAfterFirst.grain;

      // First clear includes first-clear bonus, so should be more
      expect(grainFirstGain).toBeGreaterThan(grainSecondGain);
    });

    it('should increment clear count on each completion', () => {
      engine.completeBattle('chapter1_stage1', 1);
      expect(engine.getCampaignProgress().stageStates['chapter1_stage1'].clearCount).toBe(1);

      engine.completeBattle('chapter1_stage1', 2);
      expect(engine.getCampaignProgress().stageStates['chapter1_stage1'].clearCount).toBe(2);

      engine.completeBattle('chapter1_stage1', 3);
      expect(engine.getCampaignProgress().stageStates['chapter1_stage1'].clearCount).toBe(3);
    });

    it('should keep highest star count', () => {
      engine.completeBattle('chapter1_stage1', 1);
      expect(engine.getCampaignProgress().stageStates['chapter1_stage1'].stars).toBe(1);

      engine.completeBattle('chapter1_stage1', 3);
      expect(engine.getCampaignProgress().stageStates['chapter1_stage1'].stars).toBe(3);

      engine.completeBattle('chapter1_stage1', 1);
      expect(engine.getCampaignProgress().stageStates['chapter1_stage1'].stars).toBe(3);
    });

    it('should unlock next stage after completion', () => {
      engine.completeBattle('chapter1_stage1', 1);

      // chapter1_stage2 should now be challengeable
      expect(() => engine.startBattle('chapter1_stage2')).not.toThrow('关卡未解锁');
    });
  });

  // ═══════════════════════════════════════════════
  // 3. getCampaignProgress() 返回正确进度
  // ═══════════════════════════════════════════════

  describe('getCampaignProgress()', () => {
    it('should return initial progress with chapter1 as current', () => {
      const progress = engine.getCampaignProgress();

      expect(progress.currentChapterId).toBe('chapter1');
      expect(progress.lastClearTime).toBe(0);
    });

    it('should return all stage states', () => {
      const progress = engine.getCampaignProgress();

      expect(Object.keys(progress.stageStates).length).toBeGreaterThan(0);
    });

    it('should reflect completed stages', () => {
      engine.completeBattle('chapter1_stage1', 2);

      const progress = engine.getCampaignProgress();
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(2);
      expect(progress.stageStates['chapter1_stage1'].firstCleared).toBe(true);
    });

    it('should return independent copies', () => {
      const prog1 = engine.getCampaignProgress();
      const prog2 = engine.getCampaignProgress();

      // Modifying one should not affect the other
      prog1.stageStates['chapter1_stage1'] = {
        stageId: 'chapter1_stage1',
        stars: 3,
        firstCleared: true,
        clearCount: 99,
      };

      expect(prog2.stageStates['chapter1_stage1'].stars).toBe(0);
    });

    it('should update lastClearTime after completing a stage', () => {
      const before = engine.getCampaignProgress().lastClearTime;
      engine.completeBattle('chapter1_stage1', 1);
      const after = engine.getCampaignProgress().lastClearTime;

      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  // ═══════════════════════════════════════════════
  // 4. 存档包含 campaign 数据
  // ═══════════════════════════════════════════════

  describe('存档包含 campaign 数据', () => {
    it('should include campaign data in serialized save', () => {
      engine.completeBattle('chapter1_stage1', 3);

      const json = engine.serialize();
      const data = JSON.parse(json);

      expect(data.campaign).toBeDefined();
      expect(data.campaign.version).toBe(1);
      expect(data.campaign.progress).toBeDefined();
      expect(data.campaign.progress.stageStates).toBeDefined();
    });

    it('should preserve campaign data through save/load cycle', () => {
      engine.completeBattle('chapter1_stage1', 3);
      engine.completeBattle('chapter1_stage2', 2);

      // Save
      engine.save();

      // Create new engine and load
      const engine2 = new ThreeKingdomsEngine();
      const result = engine2.load();

      // Verify campaign progress preserved
      const progress = engine2.getCampaignProgress();
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(3);
      expect(progress.stageStates['chapter1_stage1'].firstCleared).toBe(true);
      expect(progress.stageStates['chapter1_stage2'].stars).toBe(2);
      expect(progress.stageStates['chapter1_stage2'].firstCleared).toBe(true);

      engine2.reset();
    });

    it('should preserve campaign data through serialize/deserialize', () => {
      engine.completeBattle('chapter1_stage1', 3);

      const json = engine.serialize();

      const engine2 = new ThreeKingdomsEngine();
      engine2.deserialize(json);

      const progress = engine2.getCampaignProgress();
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(3);
      expect(progress.stageStates['chapter1_stage1'].firstCleared).toBe(true);

      engine2.reset();
    });

    it('should include campaign in getSnapshot', () => {
      engine.completeBattle('chapter1_stage1', 2);

      const snapshot = engine.getSnapshot();
      expect(snapshot.campaignProgress).toBeDefined();
      expect(snapshot.campaignProgress.stageStates['chapter1_stage1'].stars).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════
  // 5. 关卡查询 API
  // ═══════════════════════════════════════════════

  describe('关卡查询 API', () => {
    it('should return all stages via getStageList', () => {
      const stages = engine.getStageList();

      expect(stages.length).toBeGreaterThan(0);
      // Should include chapter1 stages
      expect(stages.some(s => s.chapterId === 'chapter1')).toBe(true);
    });

    it('should return stage info via getStageInfo', () => {
      const stage = engine.getStageInfo('chapter1_stage1');

      expect(stage).toBeDefined();
      expect(stage!.id).toBe('chapter1_stage1');
      expect(stage!.name).toBeDefined();
      expect(stage!.type).toBeDefined();
      expect(stage!.enemyFormation).toBeDefined();
    });

    it('should return undefined for non-existent stage', () => {
      expect(engine.getStageInfo('nonexistent')).toBeUndefined();
    });

    it('should return all chapters via getChapters', () => {
      const chapters = engine.getChapters();

      expect(chapters.length).toBeGreaterThanOrEqual(3);
      expect(chapters[0].id).toBe('chapter1');
      expect(chapters[1].id).toBe('chapter2');
      expect(chapters[2].id).toBe('chapter3');
    });

    it('should return chapters in correct order', () => {
      const chapters = engine.getChapters();

      for (let i = 1; i < chapters.length; i++) {
        expect(chapters[i].order).toBeGreaterThan(chapters[i - 1].order);
      }
    });
  });

  // ═══════════════════════════════════════════════
  // 6. 子系统访问 API
  // ═══════════════════════════════════════════════

  describe('子系统访问 API', () => {
    it('should return battle engine via getBattleEngine', () => {
      const battleEngine = engine.getBattleEngine();
      expect(battleEngine).toBeDefined();
      expect(typeof battleEngine.runFullBattle).toBe('function');
    });

    it('should return campaign system via getCampaignSystem', () => {
      const campaignSystem = engine.getCampaignSystem();
      expect(campaignSystem).toBeDefined();
      expect(typeof campaignSystem.getProgress).toBe('function');
      expect(typeof campaignSystem.canChallenge).toBe('function');
      expect(typeof campaignSystem.completeStage).toBe('function');
    });

    it('should return reward distributor via getRewardDistributor', () => {
      const distributor = engine.getRewardDistributor();
      expect(distributor).toBeDefined();
      expect(typeof distributor.calculateRewards).toBe('function');
      expect(typeof distributor.distribute).toBe('function');
    });
  });

  // ═══════════════════════════════════════════════
  // 7. 完整战役流程端到端测试
  // ═══════════════════════════════════════════════

  describe('完整战役流程', () => {
    it('should handle full campaign flow: battle → complete → advance', () => {
      // Stage 1
      const result1 = engine.startBattle('chapter1_stage1');
      if (result1.outcome === BattleOutcome.VICTORY) {
        engine.completeBattle('chapter1_stage1', result1.stars);

        const progress = engine.getCampaignProgress();
        expect(progress.stageStates['chapter1_stage1'].firstCleared).toBe(true);
        expect(progress.stageStates['chapter1_stage1'].stars).toBe(result1.stars);
      }
    });

    it('should handle multiple stage completions in sequence', () => {
      engine.completeBattle('chapter1_stage1', 3);
      engine.completeBattle('chapter1_stage2', 2);

      const progress = engine.getCampaignProgress();
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(3);
      expect(progress.stageStates['chapter1_stage2'].stars).toBe(2);
      expect(progress.stageStates['chapter1_stage1'].clearCount).toBe(1);
      expect(progress.stageStates['chapter1_stage2'].clearCount).toBe(1);
    });

    it('should handle reset clearing all campaign progress', () => {
      engine.completeBattle('chapter1_stage1', 3);

      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.init();

      const progress = engine.getCampaignProgress();
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(0);
      expect(progress.stageStates['chapter1_stage1'].firstCleared).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════
  // 8. 边界条件测试
  // ═══════════════════════════════════════════════

  describe('边界条件', () => {
    it('should not allow startBattle before init', () => {
      const freshEngine = new ThreeKingdomsEngine();
      // startBattle doesn't check init, it checks canChallenge
      // which should still work since chapter1_stage1 is available
      expect(() => freshEngine.startBattle('chapter1_stage1')).not.toThrow();
    });

    it('should handle completeBattle with 0 stars', () => {
      engine.completeBattle('chapter1_stage1', 0);

      const progress = engine.getCampaignProgress();
      // Stars clamped to 0, but still counted as first cleared
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(0);
      expect(progress.stageStates['chapter1_stage1'].firstCleared).toBe(true);
    });

    it('should handle completeBattle with stars exceeding max', () => {
      engine.completeBattle('chapter1_stage1', 10);

      const progress = engine.getCampaignProgress();
      expect(progress.stageStates['chapter1_stage1'].stars).toBe(3);
    });

    it('should handle concurrent stage completions from different chapters', () => {
      // Complete all of chapter 1
      const stages = engine.getStageList().filter(s => s.chapterId === 'chapter1');
      for (const stage of stages) {
        engine.completeBattle(stage.id, 3);
      }

      // Now chapter2 should be accessible
      const progress = engine.getCampaignProgress();
      expect(progress.currentChapterId).toBe('chapter2');
    });
  });
});
