/**
 * 对抗式测试 — Tutorial R2 P0/P1 修复验证
 *
 * 覆盖：
 *   - FIX-T07 (P0-7): skipTutorial 未初始化防护
 *   - FIX-T08 (P1-4): loadSaveData stepCompletionTimes 值类型校验
 *   - FIX-T09 (P1-5): loadSaveData startedAt 值合理性校验
 *   - FIX-T10 (P2-1): loadSaveData completedSteps 去重
 *
 * @module engine/tutorial/__tests__/tutorial-adversarial-r2.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialSystem } from '../tutorial-system';
import type { TutorialGuideSaveData } from '../tutorial-config';

// ─────────────────────────────────────────────
// Mock 依赖
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
    },
  };
}

describe('Tutorial R2 Adversarial Tests', () => {
  let system: TutorialSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    system = new TutorialSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ── FIX-T07 (P0-7): skipTutorial 未初始化防护 ──
  describe('FIX-T07: skipTutorial 未初始化防护', () => {
    it('未调用 init() 时 skipTutorial 不崩溃', () => {
      const raw = new TutorialSystem();
      // 不调用 init(deps)
      expect(() => raw.skipTutorial()).not.toThrow();
    });

    it('未调用 init() 时 skipTutorial 不改变状态（安全退出）', () => {
      const raw = new TutorialSystem();
      raw.skipTutorial();
      // FIX-T07: 无 deps 时安全退出，不修改 state
      expect(raw.isSkipped()).toBe(false);
    });

    it('未调用 init() 时 skipTutorial 不 emit 事件', () => {
      const raw = new TutorialSystem();
      raw.skipTutorial();
      // 走到这里说明没有 crash（FIX-T07 生效）
      expect(raw.isSkipped()).toBe(false);
    });
  });

  // ── FIX-T08 (P1-4): loadSaveData stepCompletionTimes 值类型校验 ──
  describe('FIX-T08: stepCompletionTimes 值类型校验', () => {
    it('过滤 NaN 值', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: NaN },
        startedAt: 1000,
      } as TutorialGuideSaveData);

      const stats = system.getTutorialStats();
      // NaN 值应被过滤，times 为空数组
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('过滤 Infinity 值', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: Infinity },
        startedAt: 1000,
      } as TutorialGuideSaveData);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('过滤字符串值', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: 'not-a-number' } as any,
        startedAt: 1000,
      } as TutorialGuideSaveData);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('保留合法数值', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: 2000 },
        startedAt: 1000,
      } as TutorialGuideSaveData);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(1000);
    });

    it('混合合法与非法值只保留合法', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'first_recruit'],
        skipped: false,
        stepCompletionTimes: {
          claim_newbie_pack: 2000,
          first_recruit: NaN,
        } as any,
        startedAt: 1000,
      } as TutorialGuideSaveData);

      const stats = system.getTutorialStats();
      // 只有 claim_newbie_pack=2000 被保留
      expect(stats.avgCompletionTimeMs).toBe(1000);
    });
  });

  // ── FIX-T09 (P1-5): loadSaveData startedAt 值合理性校验 ──
  describe('FIX-T09: startedAt 值合理性校验', () => {
    it('startedAt=NaN → 回退为 null', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [],
        skipped: false,
        startedAt: NaN,
      } as any);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('startedAt=Infinity → 回退为 null', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [],
        skipped: false,
        startedAt: Infinity,
      } as any);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('startedAt=-1 → 回退为 null（负值不合法）', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [],
        skipped: false,
        startedAt: -1,
      } as any);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('startedAt=0 → 回退为 null', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [],
        skipped: false,
        startedAt: 0,
      } as any);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('startedAt=合法正数 → 保留', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: 2000 },
        startedAt: 1000,
      } as TutorialGuideSaveData);

      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(1000);
    });
  });

  // ── FIX-T10 (P2-1): loadSaveData completedSteps 去重 ──
  describe('FIX-T10: completedSteps 去重', () => {
    it('重复 stepId 只保留一个', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'claim_newbie_pack', 'claim_newbie_pack'],
        skipped: false,
      } as TutorialGuideSaveData);

      const progress = system.getProgress();
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(25);
    });

    it('多个重复 ID 混合 → 正确去重', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [
          'claim_newbie_pack', 'first_recruit',
          'claim_newbie_pack', 'first_recruit',
          'view_hero',
        ],
        skipped: false,
      } as TutorialGuideSaveData);

      const progress = system.getProgress();
      expect(progress.completed).toBe(3);
      expect(progress.percentage).toBe(75);
    });

    it('4步全部重复 → isTutorialComplete 仍为 true', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [
          'claim_newbie_pack', 'first_recruit', 'view_hero', 'add_to_formation',
          'claim_newbie_pack', 'first_recruit',
        ],
        skipped: false,
      } as TutorialGuideSaveData);

      const progress = system.getProgress();
      expect(progress.completed).toBe(4);
      expect(progress.percentage).toBe(100);
    });
  });
});
