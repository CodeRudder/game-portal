/**
 * 对抗式测试 — Tutorial R1 P0 修复验证 + F-Error 维度补充
 *
 * 覆盖：
 *   - FIX-601: loadSaveData(null) 防护
 *   - FIX-602: loadSaveData completedSteps undefined/非法值 防护
 *   - FIX-603: loadSaveData 恢复 stepCompletionTimes/startedAt
 *   - FIX-604: serialize 持久化 stepCompletionTimes/startedAt
 *   - F-Error 维度：null/undefined/非法输入
 *   - F-Cross 补充：双重序列化、重复 loadSaveData
 *
 * @module engine/tutorial/__tests__/tutorial-adversarial-r1.test
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
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: {
      get: vi.fn(),
      register: vi.fn(),
      getAll: vi.fn(() => new Map()),
      has: vi.fn(),
      unregister: vi.fn(),
    },
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('Tutorial R1 对抗式测试', () => {
  let system: TutorialSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    system = new TutorialSystem();
    deps = createMockDeps();
    system.init(deps as unknown as Record<string, unknown>);
  });

  // ═══════════════════════════════════════════
  // FIX-601: loadSaveData null/undefined 防护
  // ═══════════════════════════════════════════

  describe('FIX-601: loadSaveData null 防护', () => {
    it('loadSaveData(null) 不崩溃，重置为初始状态', () => {
      expect(() => system.loadSaveData(null as unknown as TutorialGuideSaveData)).not.toThrow();
      expect(system.getCurrentStep()?.id).toBe('claim_newbie_pack');
      expect(system.isSkipped()).toBe(false);
      expect(system.isTutorialComplete()).toBe(false);
    });

    it('loadSaveData(undefined) 不崩溃', () => {
      expect(() => system.loadSaveData(undefined as unknown as TutorialGuideSaveData)).not.toThrow();
      expect(system.getCurrentStep()?.id).toBe('claim_newbie_pack');
    });

    it('loadSaveData({}) 不崩溃（空对象）', () => {
      expect(() => system.loadSaveData({} as TutorialGuideSaveData)).not.toThrow();
      expect(system.getCurrentStep()?.id).toBe('claim_newbie_pack');
      expect(system.isSkipped()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // FIX-602: completedSteps 内容校验
  // ═══════════════════════════════════════════

  describe('FIX-602: completedSteps 校验', () => {
    it('completedSteps=undefined 时不崩溃，回退为空数组', () => {
      expect(() =>
        system.loadSaveData({
          version: 1,
          completedSteps: undefined as unknown as TutorialGuideSaveData['completedSteps'],
          skipped: false,
        }),
      ).not.toThrow();
      expect(system.isTutorialComplete()).toBe(false);
    });

    it('completedSteps 含非法 stepId 时被过滤', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['hack_step', 'claim_newbie_pack', 'another_hack'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      expect(system.isStepCompleted('claim_newbie_pack')).toBe(true);
      expect(system.isStepCompleted('hack_step' as any)).toBe(false);
      expect(system.isStepCompleted('first_recruit')).toBe(false);
    });

    it('completedSteps 全部非法时不误判完成', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['a', 'b', 'c', 'd'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      expect(system.isTutorialComplete()).toBe(false);
      expect(system.getCurrentStep()?.id).toBe('claim_newbie_pack');
    });

    it('completedSteps 含重复合法ID时保留有效项', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'claim_newbie_pack', 'first_recruit'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      expect(system.isStepCompleted('claim_newbie_pack')).toBe(true);
      expect(system.isStepCompleted('first_recruit')).toBe(true);
    });

    it('completedSteps=null 时不崩溃', () => {
      expect(() =>
        system.loadSaveData({
          version: 1,
          completedSteps: null as unknown as TutorialGuideSaveData['completedSteps'],
          skipped: false,
        }),
      ).not.toThrow();
      expect(system.isTutorialComplete()).toBe(false);
    });

    it('skipped=undefined 时默认为 false', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [],
        skipped: undefined as unknown as boolean,
      });
      expect(system.isSkipped()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // FIX-603: loadSaveData 恢复 stepCompletionTimes/startedAt
  // ═══════════════════════════════════════════

  describe('FIX-603: stepCompletionTimes/startedAt 恢复', () => {
    it('loadSaveData 恢复 stepCompletionTimes 并计算正确的平均完成时间', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'first_recruit'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: 1000, first_recruit: 2000 },
        startedAt: 500,
      });
      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBeGreaterThan(0);
      // avg = ((1000-500) + (2000-500)) / 2 = 1000
      expect(stats.avgCompletionTimeMs).toBe(1000);
    });

    it('旧存档无 stepCompletionTimes 时不崩溃，avgCompletionTimeMs=0', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBe(0);
      expect(stats.completedSteps).toBe(1);
    });

    it('loadSaveData 恢复 startedAt', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: 3000 },
        startedAt: 1000,
      });
      const state = system.getState();
      expect(state.startedAt).toBe(1000);
    });

    it('旧存档 startedAt=null 时正确处理', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [],
        skipped: false,
        startedAt: null,
      });
      const state = system.getState();
      expect(state.startedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // FIX-604: serialize 持久化 stepCompletionTimes/startedAt
  // ═══════════════════════════════════════════

  describe('FIX-604: serialize 包含完整状态', () => {
    it('serialize 包含 stepCompletionTimes', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const data = system.serialize();
      expect(data.stepCompletionTimes).toBeDefined();
      expect(data.stepCompletionTimes!['claim_newbie_pack']).toBeTypeOf('number');
    });

    it('serialize 包含 startedAt', () => {
      system.getCurrentStep(); // 触发 startedAt 记录
      system.completeCurrentStep('claim_newbie_pack');
      const data = system.serialize();
      expect(data.startedAt).toBeDefined();
      expect(data.startedAt).toBeTypeOf('number');
    });

    it('初始状态 serialize 的 stepCompletionTimes 为空对象', () => {
      const data = system.serialize();
      expect(data.stepCompletionTimes).toEqual({});
      expect(data.startedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 错误路径补充
  // ═══════════════════════════════════════════

  describe('F-Error: 错误路径', () => {
    it('completeCurrentStep(空字符串) 返回失败', () => {
      const result = system.completeCurrentStep('');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('claim_newbie_pack');
    });

    it('getStepStatus 在 skipped 状态下返回 locked', () => {
      system.skipTutorial();
      expect(system.getStepStatus('claim_newbie_pack')).toBe('locked');
      expect(system.getStepStatus('first_recruit')).toBe('locked');
    });

    it('getStepStatus 在 skipped+已完成 状态下返回 completed', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.skipTutorial();
      expect(system.getStepStatus('claim_newbie_pack')).toBe('completed');
      expect(system.getStepStatus('first_recruit')).toBe('locked');
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统链路补充
  // ═══════════════════════════════════════════

  describe('F-Cross: 跨系统链路', () => {
    it('FC-07: serialize → loadSaveData → serialize 双重序列化一致', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');

      const data1 = system.serialize();

      const system2 = new TutorialSystem();
      system2.init(deps as unknown as Record<string, unknown>);
      system2.loadSaveData(data1);

      const data2 = system2.serialize();

      expect(data2.completedSteps).toEqual(data1.completedSteps);
      expect(data2.skipped).toEqual(data1.skipped);
      expect(data2.stepCompletionTimes).toEqual(data1.stepCompletionTimes);
      expect(data2.startedAt).toEqual(data1.startedAt);
    });

    it('FC-11: 重复 loadSaveData 状态正确覆盖', () => {
      // 第一次加载：完成2步
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'first_recruit'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: 1000, first_recruit: 2000 },
        startedAt: 500,
      });
      expect(system.getCurrentStep()?.id).toBe('view_hero');

      // 第二次加载：完成1步
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      expect(system.getCurrentStep()?.id).toBe('first_recruit');
      expect(system.isStepCompleted('first_recruit')).toBe(false);
    });

    it('FC-06: loadSaveData 不发射事件', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      expect(deps.eventBus.emit).not.toHaveBeenCalled();
    });

    it('完整 save/load 循环保留统计数据', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');

      const stats1 = system.getTutorialStats();
      expect(stats1.completedSteps).toBe(2);

      const data = system.serialize();
      const system2 = new TutorialSystem();
      system2.init(deps as unknown as Record<string, unknown>);
      system2.loadSaveData(data);

      const stats2 = system2.getTutorialStats();
      expect(stats2.completedSteps).toBe(2);
      expect(stats2.totalSteps).toBe(4);
      expect(stats2.skipRate).toBe(0);
      expect(stats2.avgCompletionTimeMs).toBe(stats1.avgCompletionTimeMs);
    });
  });

  // ═══════════════════════════════════════════
  // 综合边界场景
  // ═══════════════════════════════════════════

  describe('综合边界场景', () => {
    it('loadSaveData 后 completeCurrentStep 正常工作', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'first_recruit'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      const result = system.completeCurrentStep('view_hero');
      expect(result.success).toBe(true);
      expect(result.nextStep?.id).toBe('add_to_formation');
    });

    it('loadSaveData 跳过状态后不能完成步骤', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: [],
        skipped: true,
      });
      expect(system.isSkipped()).toBe(true);
      const result = system.completeCurrentStep('claim_newbie_pack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('跳过');
    });

    it('loadSaveData 完成状态后 isTutorialComplete=true', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'first_recruit', 'view_hero', 'add_to_formation'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
      });
      expect(system.isTutorialComplete()).toBe(true);
      expect(system.getCurrentStep()).toBeNull();
    });

    it('reset 清除 loadSaveData 恢复的状态', () => {
      system.loadSaveData({
        version: 1,
        completedSteps: ['claim_newbie_pack', 'first_recruit'] as unknown as TutorialGuideSaveData['completedSteps'],
        skipped: false,
        stepCompletionTimes: { claim_newbie_pack: 1000 },
        startedAt: 500,
      });
      system.reset();
      const state = system.getState();
      expect(state.completedSteps).toEqual([]);
      expect(state.stepCompletionTimes).toEqual({});
      expect(state.startedAt).toBeNull();
    });
  });
});
