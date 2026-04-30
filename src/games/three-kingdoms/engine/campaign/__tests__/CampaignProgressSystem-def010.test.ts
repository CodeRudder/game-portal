/**
 * DEF-010 回归测试: completeStage stars=NaN 导致星级异常
 *
 * 验证 completeStage 在接收到 NaN / undefined / Infinity 等非法星级时：
 * - 不抛出异常
 * - 星级被修正为 0
 * - 不影响其他状态（clearCount / firstCleared 仍正常更新）
 */

import { describe, it, expect } from 'vitest';
import { CampaignProgressSystem } from '../CampaignProgressSystem';
import type { ICampaignDataProvider } from '../campaign.types';
import { getChapters, getChapter, getStage, getStagesByChapter } from '../campaign-config';

const dataProvider: ICampaignDataProvider = {
  getChapters,
  getChapter,
  getStage,
  getStagesByChapter,
};

// ─────────────────────────────────────────────
// DEF-010 回归测试
// ─────────────────────────────────────────────

describe('DEF-010: completeStage stars=NaN 防御', () => {
  let system: CampaignProgressSystem;

  beforeEach(() => {
    system = new CampaignProgressSystem(dataProvider);
  });

  it('stars=NaN 时星级被修正为 0', () => {
    system.completeStage('chapter1_stage1', NaN);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
  });

  it('stars=NaN 时仍标记为首通', () => {
    system.completeStage('chapter1_stage1', NaN);
    expect(system.isFirstCleared('chapter1_stage1')).toBe(true);
  });

  it('stars=NaN 时通关次数仍累加', () => {
    system.completeStage('chapter1_stage1', NaN);
    expect(system.getClearCount('chapter1_stage1')).toBe(1);
  });

  it('stars=NaN 时仍解锁下一关', () => {
    system.completeStage('chapter1_stage1', NaN);
    expect(system.getStageStatus('chapter1_stage2')).toBe('available');
  });

  it('stars=NaN 后可正常补充通关提升星级', () => {
    system.completeStage('chapter1_stage1', NaN);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);

    // 再次通关，正常星级
    system.completeStage('chapter1_stage1', 3);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
    expect(system.getStageStatus('chapter1_stage1')).toBe('threeStar');
  });

  it('stars=NaN 多次通关不累积异常星级', () => {
    system.completeStage('chapter1_stage1', NaN);
    system.completeStage('chapter1_stage1', NaN);
    system.completeStage('chapter1_stage1', NaN);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
    expect(system.getClearCount('chapter1_stage1')).toBe(3);
  });

  it('stars=Infinity 时被 Math.min 截断为 3（原有逻辑）', () => {
    system.completeStage('chapter1_stage1', Infinity);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('stars=-Infinity 时被 Math.max 截断为 0（原有逻辑）', () => {
    system.completeStage('chapter1_stage1', -Infinity);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
  });

  it('stars=4 时仍被原有 Math.max/min 截断为 3', () => {
    system.completeStage('chapter1_stage1', 4);
    expect(system.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('stars=-1 时被原有 Math.max/min 截断为 0', () => {
    system.completeStage('chapter1_stage1', -1);
    expect(system.getStageStars('chapter1_stage1')).toBe(0);
  });

  it('stars=NaN 不影响总星数统计', () => {
    system.completeStage('chapter1_stage1', NaN);
    expect(system.getTotalStars()).toBe(0);
  });

  it('stars=NaN 和正常星级交替使用正常', () => {
    system.completeStage('chapter1_stage1', 2);
    expect(system.getStageStars('chapter1_stage1')).toBe(2);

    system.completeStage('chapter1_stage1', NaN);
    // NaN 被修正为 0，不降级已有星级
    expect(system.getStageStars('chapter1_stage1')).toBe(2);
  });

  it('stars=NaN 时 lastClearTime 仍更新', () => {
    const before = Date.now();
    system.completeStage('chapter1_stage1', NaN);
    const progress = system.getProgress();
    expect(progress.lastClearTime).toBeGreaterThanOrEqual(before);
  });
});
