/**
 * 关卡集成流程 — 单元测试（第2部分：解锁链 + 章节切换 + 存档往返 + 进度统计 + 真实配置）
 *
 * 覆盖：
 * - 关卡解锁链（通关前关→解锁后关）
 * - 章节切换
 * - 存档序列化/反序列化往返
 * - 进度统计
 * - 真实配置数据集成
 *
 * @module engine/campaign/__tests__/CampaignIntegration.progress.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignProgressSystem } from '../CampaignProgressSystem';
import { campaignDataProvider } from '../campaign-config';
import type {
  CampaignSaveData,
  Chapter,
  ICampaignDataProvider,
  Stage,
} from '../campaign.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

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
// 1. 关卡解锁链测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 关卡解锁链', () => {
  let progress: CampaignProgressSystem;

  beforeEach(() => {
    progress = new CampaignProgressSystem(createTestDataProvider(createMiniChapters()));
    progress.initProgress();
  });

  it('should have first stage of chapter1 available initially', () => {
    expect(progress.getStageStatus('c1_s1')).toBe('available');
  });

  it('should have second stage locked initially', () => {
    expect(progress.getStageStatus('c1_s2')).toBe('locked');
  });

  it('should unlock second stage after clearing first stage', () => {
    progress.completeStage('c1_s1', 1);
    expect(progress.getStageStatus('c1_s2')).toBe('available');
  });

  it('should unlock third stage after clearing second stage', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s2', 1);
    expect(progress.getStageStatus('c1_s3')).toBe('available');
  });

  it('should keep stages locked when not cleared in order', () => {
    progress.completeStage('c1_s1', 1);
    expect(progress.getStageStatus('c1_s3')).toBe('locked');
  });

  it('should unlock chapter2 first stage after clearing chapter1 boss', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s2', 1);
    progress.completeStage('c1_s3', 1);
    expect(progress.getStageStatus('c2_s1')).toBe('available');
  });

  it('should keep chapter2 locked until chapter1 is fully cleared', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s2', 1);
    expect(progress.getStageStatus('c2_s1')).toBe('locked');
  });

  it('should allow replaying already cleared stages', () => {
    progress.completeStage('c1_s1', 1);
    expect(progress.canChallenge('c1_s1')).toBe(true);
    expect(progress.getStageStatus('c1_s1')).toBe('cleared');
  });

  it('should allow challenging three-starred stages', () => {
    progress.completeStage('c1_s1', 3);
    expect(progress.canChallenge('c1_s1')).toBe(true);
    expect(progress.getStageStatus('c1_s1')).toBe('threeStar');
  });
});

// ═══════════════════════════════════════════════
// 2. 章节切换测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 章节切换', () => {
  let progress: CampaignProgressSystem;

  beforeEach(() => {
    progress = new CampaignProgressSystem(createTestDataProvider(createMiniChapters()));
    progress.initProgress();
  });

  it('should start at chapter1', () => {
    expect(progress.getCurrentChapter()?.id).toBe('chapter1');
  });

  it('should advance to chapter2 after clearing chapter1 last stage', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s2', 1);
    progress.completeStage('c1_s3', 1);
    expect(progress.getCurrentChapter()?.id).toBe('chapter2');
  });

  it('should not advance chapter when clearing non-final stage', () => {
    progress.completeStage('c1_s1', 1);
    expect(progress.getCurrentChapter()?.id).toBe('chapter1');
  });

  it('should stay at last chapter when there is no next chapter', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s2', 1);
    progress.completeStage('c1_s3', 1);
    progress.completeStage('c2_s1', 1);
    progress.completeStage('c2_s2', 1);
    expect(progress.getCurrentChapter()?.id).toBe('chapter2');
  });
});

// ═══════════════════════════════════════════════
// 3. 存档序列化/反序列化往返测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 存档往返', () => {
  let progress: CampaignProgressSystem;
  let dataProvider: ICampaignDataProvider;

  beforeEach(() => {
    dataProvider = createTestDataProvider(createMiniChapters());
    progress = new CampaignProgressSystem(dataProvider);
    progress.initProgress();
  });

  it('should serialize and deserialize with no data loss', () => {
    progress.completeStage('c1_s1', 3);
    progress.completeStage('c1_s2', 2);
    const saved = progress.serialize();
    const restored = new CampaignProgressSystem(dataProvider);
    restored.deserialize(saved);
    expect(restored.getStageStars('c1_s1')).toBe(3);
    expect(restored.getStageStars('c1_s2')).toBe(2);
    expect(restored.isFirstCleared('c1_s1')).toBe(true);
    expect(restored.isFirstCleared('c1_s2')).toBe(true);
  });

  it('should preserve current chapter after round-trip', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s2', 1);
    progress.completeStage('c1_s3', 1);
    const saved = progress.serialize();
    const restored = new CampaignProgressSystem(dataProvider);
    restored.deserialize(saved);
    expect(restored.getCurrentChapter()?.id).toBe('chapter2');
  });

  it('should preserve total stars after round-trip', () => {
    progress.completeStage('c1_s1', 3);
    progress.completeStage('c1_s2', 2);
    const saved = progress.serialize();
    const restored = new CampaignProgressSystem(dataProvider);
    restored.deserialize(saved);
    expect(restored.getTotalStars()).toBe(5);
  });

  it('should throw error when deserializing incompatible version', () => {
    const badData: CampaignSaveData = { version: 999, progress: { currentChapterId: 'chapter1', stageStates: {}, lastClearTime: 0 } };
    expect(() => progress.deserialize(badData)).toThrow('存档版本不兼容');
  });

  it('should handle missing stage states in save data', () => {
    progress.completeStage('c1_s1', 1);
    const saved = progress.serialize();
    delete saved.progress.stageStates['c1_s2'];
    const restored = new CampaignProgressSystem(dataProvider);
    restored.deserialize(saved);
    expect(restored.getStageStars('c1_s2')).toBe(0);
    expect(restored.isFirstCleared('c1_s2')).toBe(false);
  });

  it('should serialize initial state correctly', () => {
    const saved = progress.serialize();
    expect(saved.version).toBe(1);
    expect(saved.progress.currentChapterId).toBe('chapter1');
    expect(saved.progress.lastClearTime).toBe(0);
    const stages = Object.values(saved.progress.stageStates);
    for (const state of stages) {
      expect(state.stars).toBe(0);
      expect(state.firstCleared).toBe(false);
      expect(state.clearCount).toBe(0);
    }
  });

  it('should preserve clear count after multiple clears', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s1', 2);
    progress.completeStage('c1_s1', 3);
    const saved = progress.serialize();
    const restored = new CampaignProgressSystem(dataProvider);
    restored.deserialize(saved);
    expect(restored.getClearCount('c1_s1')).toBe(3);
  });

  it('should preserve lastClearTime after round-trip', () => {
    progress.completeStage('c1_s1', 1);
    const saved = progress.serialize();
    expect(saved.progress.lastClearTime).toBeGreaterThan(0);
    const restored = new CampaignProgressSystem(dataProvider);
    restored.deserialize(saved);
    expect(restored.getProgress().lastClearTime).toBe(saved.progress.lastClearTime);
  });
});

// ═══════════════════════════════════════════════
// 4. 进度统计集成测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 进度统计', () => {
  let progress: CampaignProgressSystem;

  beforeEach(() => {
    progress = new CampaignProgressSystem(createTestDataProvider(createMiniChapters()));
    progress.initProgress();
  });

  it('should track total stars across all stages', () => {
    progress.completeStage('c1_s1', 3);
    progress.completeStage('c1_s2', 2);
    expect(progress.getTotalStars()).toBe(5);
  });

  it('should return 0 total stars initially', () => {
    expect(progress.getTotalStars()).toBe(0);
  });

  it('should track clear count per stage', () => {
    progress.completeStage('c1_s1', 1);
    progress.completeStage('c1_s1', 2);
    progress.completeStage('c1_s1', 3);
    expect(progress.getClearCount('c1_s1')).toBe(3);
  });

  it('should return 0 clear count for non-existent stage', () => {
    expect(progress.getClearCount('nonexistent')).toBe(0);
  });

  it('should return 0 stars for non-existent stage', () => {
    expect(progress.getStageStars('nonexistent')).toBe(0);
  });

  it('should return false for isFirstCleared of non-existent stage', () => {
    expect(progress.isFirstCleared('nonexistent')).toBe(false);
  });

  it('should return deep copy from getProgress', () => {
    progress.completeStage('c1_s1', 3);
    const p1 = progress.getProgress();
    const p2 = progress.getProgress();
    p1.stageStates['c1_s1'].stars = 0;
    expect(p2.stageStates['c1_s1'].stars).toBe(3);
  });

  it('should reset progress correctly', () => {
    progress.completeStage('c1_s1', 3);
    progress.completeStage('c1_s2', 2);
    progress.reset();
    expect(progress.getTotalStars()).toBe(0);
    expect(progress.getStageStars('c1_s1')).toBe(0);
    expect(progress.isFirstCleared('c1_s1')).toBe(false);
    expect(progress.getStageStatus('c1_s1')).toBe('available');
  });

  it('should throw error when completing non-existent stage', () => {
    expect(() => progress.completeStage('nonexistent', 1)).toThrow('关卡不存在');
  });

  it('should clamp stars to valid range', () => {
    progress.completeStage('c1_s1', 5);
    expect(progress.getStageStars('c1_s1')).toBe(3);
    progress.reset();
    progress.initProgress();
    progress.completeStage('c1_s1', -1);
    expect(progress.getStageStars('c1_s1')).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 5. 真实配置数据集成测试
// ═══════════════════════════════════════════════

describe('CampaignIntegration 真实配置数据', () => {
  let progress: CampaignProgressSystem;

  beforeEach(() => {
    progress = new CampaignProgressSystem(campaignDataProvider);
    progress.initProgress();
  });

  it('should initialize with all chapters from real config', () => {
    const chapters = campaignDataProvider.getChapters();
    expect(chapters.length).toBeGreaterThanOrEqual(3);
  });

  it('should have chapter1_stage1 available initially', () => {
    expect(progress.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('should have chapter1_stage2 locked initially', () => {
    expect(progress.getStageStatus('chapter1_stage2')).toBe('locked');
  });

  it('should unlock chapter1_stage2 after clearing chapter1_stage1', () => {
    progress.completeStage('chapter1_stage1', 1);
    expect(progress.getStageStatus('chapter1_stage2')).toBe('available');
  });

  it('should track progress through real chapter1 stages', () => {
    const stages = campaignDataProvider.getStagesByChapter('chapter1');
    expect(stages.length).toBeGreaterThan(0);
    for (const stage of stages) {
      progress.completeStage(stage.id, 3);
      expect(progress.isFirstCleared(stage.id)).toBe(true);
      expect(progress.getStageStars(stage.id)).toBe(3);
    }
  });

  it('should advance to chapter2 after clearing chapter1', () => {
    const stages = campaignDataProvider.getStagesByChapter('chapter1');
    for (const stage of stages) progress.completeStage(stage.id, 3);
    expect(progress.getCurrentChapter()?.id).toBe('chapter2');
  });
});
