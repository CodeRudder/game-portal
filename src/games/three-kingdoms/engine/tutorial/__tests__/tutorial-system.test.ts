/**
 * 引擎层测试 — 新手引导系统 (TutorialSystem)
 *
 * 覆盖功能点（30+ 测试用例）：
 *   - 初始状态验证
 *   - 按顺序完成步骤
 *   - 不能跳步
 *   - 完成最后一步后引导结束
 *   - 每步奖励正确
 *   - 进度计算
 *   - 跳过引导
 *   - 序列化 / 反序列化
 *   - ISubsystem 接口
 *   - 查询 API
 *
 * @module engine/tutorial/__tests__/tutorial-system.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialSystem } from '../tutorial-system';
import type { CompleteStepResult } from '../tutorial-system';
import {
  TUTORIAL_GUIDE_TOTAL_STEPS,
  TUTORIAL_GUIDE_STEPS,
  TUTORIAL_GUIDE_STEP_MAP,
} from '../tutorial-config';
import type { TutorialGuideSaveData } from '../tutorial-config';

// ─────────────────────────────────────────────
// Mock 依赖
// ─────────────────────────────────────────────

/** 创建模拟系统依赖 */
function createMockDeps() {
  const listeners = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
        return () => {
          const arr = listeners.get(event);
          if (arr) {
            const idx = arr.indexOf(handler);
            if (idx >= 0) arr.splice(idx, 1);
          }
        };
      }),
      emit: vi.fn((event: string, payload?: unknown) => {
        const handlers = listeners.get(event);
        if (handlers) handlers.forEach(h => h(payload));
      }),
      once: vi.fn(),
      off: vi.fn(),
    },
    config: {
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
    },
    registry: {
      get: vi.fn(),
      register: vi.fn(),
      getAll: vi.fn(() => new Map()),
      has: vi.fn(),
      unregister: vi.fn(),
    },
  };
}

/** 获取 emit 调用记录 */
function getEmitCalls(deps: ReturnType<typeof createMockDeps>, event: string): unknown[] {
  return deps.eventBus.emit.mock.calls
    .filter((call: unknown[]) => call[0] === event)
    .map((call: unknown[]) => call[1]);
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('TutorialSystem', () => {
  let system: TutorialSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    system = new TutorialSystem();
    deps = createMockDeps();
    system.init(deps as unknown as Record<string, unknown>);
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口测试
  // ═══════════════════════════════════════════

  describe('ISubsystem 接口', () => {
    it('name 应为 "tutorial-guide"', () => {
      expect(system.name).toBe('tutorial-guide');
    });

    it('init() 应正常注入依赖', () => {
      expect(() => system.init(deps as unknown as Record<string, unknown>)).not.toThrow();
    });

    it('update() 应正常调用不抛异常', () => {
      expect(() => system.update(0.016)).not.toThrow();
    });

    it('getState() 应返回状态快照', () => {
      const state = system.getState();
      expect(state).toHaveProperty('completedSteps');
      expect(state).toHaveProperty('skipped');
    });

    it('reset() 应将状态恢复到初始值', () => {
      // 先完成一个步骤
      system.completeCurrentStep('claim_newbie_pack');
      expect(system.getCurrentStep()?.id).toBe('first_recruit');

      system.reset();
      expect(system.getCurrentStep()?.id).toBe('claim_newbie_pack');
      expect(system.isSkipped()).toBe(false);
      expect(system.isTutorialComplete()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 初始状态
  // ═══════════════════════════════════════════

  describe('初始状态', () => {
    it('第一步应为 claim_newbie_pack', () => {
      const step = system.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step!.id).toBe('claim_newbie_pack');
      expect(step!.order).toBe(1);
      expect(step!.title).toBe('领取新手礼包');
    });

    it('引导未完成', () => {
      expect(system.isTutorialComplete()).toBe(false);
    });

    it('未跳过', () => {
      expect(system.isSkipped()).toBe(false);
    });

    it('初始进度应为 0/4', () => {
      const progress = system.getProgress();
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(0);
    });

    it('getAllSteps() 返回4个步骤，全部未完成', () => {
      const steps = system.getAllSteps();
      expect(steps).toHaveLength(4);
      steps.forEach(step => {
        expect(step.isCompleted).toBe(false);
      });
    });

    it('当前步骤序号应为 1', () => {
      expect(system.getCurrentStepOrder()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 按顺序完成步骤
  // ═══════════════════════════════════════════

  describe('按顺序完成步骤', () => {
    it('步骤1：领取新手礼包', () => {
      const result = system.completeCurrentStep('claim_newbie_pack');
      expect(result.success).toBe(true);
      expect(result.step!.id).toBe('claim_newbie_pack');
      expect(result.rewards).toEqual([
        { resource: 'recruitToken', amount: 100 },
        { resource: 'copper', amount: 5000 },
        { resource: 'skillBook', amount: 1 },
      ]);
      expect(result.nextStep!.id).toBe('first_recruit');
    });

    it('步骤2：首次招募', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const result = system.completeCurrentStep('first_recruit');
      expect(result.success).toBe(true);
      expect(result.step!.id).toBe('first_recruit');
      expect(result.rewards).toEqual([]);
      expect(result.nextStep!.id).toBe('view_hero');
    });

    it('步骤3：查看武将', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      const result = system.completeCurrentStep('view_hero');
      expect(result.success).toBe(true);
      expect(result.step!.id).toBe('view_hero');
      expect(result.rewards).toEqual([]);
      expect(result.nextStep!.id).toBe('add_to_formation');
    });

    it('步骤4：编队上阵 — 完成后引导结束', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      const result = system.completeCurrentStep('add_to_formation');
      expect(result.success).toBe(true);
      expect(result.step!.id).toBe('add_to_formation');
      expect(result.nextStep).toBeNull();
      expect(system.isTutorialComplete()).toBe(true);
    });

    it('完成全部步骤后 getCurrentStep() 返回 null', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      expect(system.getCurrentStep()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 不能跳步
  // ═══════════════════════════════════════════

  describe('不能跳步', () => {
    it('不能直接完成步骤2（需要先完成步骤1）', () => {
      const result = system.completeCurrentStep('first_recruit');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('claim_newbie_pack');
    });

    it('不能直接完成步骤3', () => {
      const result = system.completeCurrentStep('view_hero');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('claim_newbie_pack');
    });

    it('不能直接完成步骤4', () => {
      const result = system.completeCurrentStep('add_to_formation');
      expect(result.success).toBe(false);
    });

    it('使用错误的 action 不能完成当前步骤', () => {
      const result = system.completeCurrentStep('wrong_action');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('claim_newbie_pack');
    });

    it('不能重复完成已完成的步骤', () => {
      system.completeCurrentStep('claim_newbie_pack');
      // 当前步骤是 first_recruit，尝试再次完成 claim_newbie_pack
      const result = system.completeCurrentStep('claim_newbie_pack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('first_recruit');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 奖励正确性
  // ═══════════════════════════════════════════

  describe('奖励正确性', () => {
    it('步骤1奖励：100招贤令+5000铜钱+1本技能书', () => {
      const result = system.completeCurrentStep('claim_newbie_pack');
      expect(result.rewards).toHaveLength(3);
      expect(result.rewards).toContainEqual({ resource: 'recruitToken', amount: 100 });
      expect(result.rewards).toContainEqual({ resource: 'copper', amount: 5000 });
      expect(result.rewards).toContainEqual({ resource: 'skillBook', amount: 1 });
    });

    it('步骤2无奖励', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const result = system.completeCurrentStep('first_recruit');
      expect(result.rewards).toHaveLength(0);
    });

    it('步骤3无奖励', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      const result = system.completeCurrentStep('view_hero');
      expect(result.rewards).toHaveLength(0);
    });

    it('步骤4无奖励', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      const result = system.completeCurrentStep('add_to_formation');
      expect(result.rewards).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 进度计算
  // ═══════════════════════════════════════════

  describe('进度计算', () => {
    it('完成1步后进度为 1/4 (25%)', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const progress = system.getProgress();
      expect(progress.completed).toBe(1);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(25);
    });

    it('完成2步后进度为 2/4 (50%)', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      const progress = system.getProgress();
      expect(progress.completed).toBe(2);
      expect(progress.percentage).toBe(50);
    });

    it('完成3步后进度为 3/4 (75%)', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      const progress = system.getProgress();
      expect(progress.completed).toBe(3);
      expect(progress.percentage).toBe(75);
    });

    it('完成4步后进度为 4/4 (100%)', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      const progress = system.getProgress();
      expect(progress.completed).toBe(4);
      expect(progress.percentage).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 跳过引导
  // ═══════════════════════════════════════════

  describe('跳过引导', () => {
    it('跳过后 isSkipped() 返回 true', () => {
      system.skipTutorial();
      expect(system.isSkipped()).toBe(true);
    });

    it('跳过后 getCurrentStep() 返回 null', () => {
      system.skipTutorial();
      expect(system.getCurrentStep()).toBeNull();
    });

    it('跳过后不能完成任何步骤', () => {
      system.skipTutorial();
      const result = system.completeCurrentStep('claim_newbie_pack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('跳过');
    });

    it('跳过后进度保持不变', () => {
      system.skipTutorial();
      const progress = system.getProgress();
      expect(progress.completed).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('跳过后 isTutorialComplete() 返回 false', () => {
      system.skipTutorial();
      expect(system.isTutorialComplete()).toBe(false);
    });

    it('跳过后 getCurrentStepOrder() 返回 -2', () => {
      system.skipTutorial();
      expect(system.getCurrentStepOrder()).toBe(-2);
    });

    it('跳过引导后发射 skipped 事件', () => {
      system.skipTutorial();
      const calls = getEmitCalls(deps, 'tutorial-guide:skipped');
      expect(calls).toHaveLength(1);
      expect(calls[0]).toHaveProperty('timestamp');
    });

    it('引导已完成时跳过无效', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      system.skipTutorial();
      // 已完成不应被标记为跳过
      expect(system.isSkipped()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 事件发射
  // ═══════════════════════════════════════════

  describe('事件发射', () => {
    it('完成步骤时发射 stepCompleted 事件', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const calls = getEmitCalls(deps, 'tutorial-guide:stepCompleted');
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        stepId: 'claim_newbie_pack',
        timestamp: expect.any(Number),
      });
    });

    it('完成全部步骤时发射 completed 事件', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      const calls = getEmitCalls(deps, 'tutorial-guide:completed');
      expect(calls).toHaveLength(1);
      expect(calls[0]).toHaveProperty('timestamp');
    });

    it('未完成全部步骤时不发射 completed 事件', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const calls = getEmitCalls(deps, 'tutorial-guide:completed');
      expect(calls).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化 / 反序列化
  // ═══════════════════════════════════════════

  describe('序列化 / 反序列化', () => {
    it('初始状态序列化正确', () => {
      const data = system.serialize();
      expect(data.version).toBe(1);
      expect(data.completedSteps).toEqual([]);
      expect(data.skipped).toBe(false);
    });

    it('部分完成后序列化正确', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      const data = system.serialize();
      expect(data.completedSteps).toEqual(['claim_newbie_pack', 'first_recruit']);
      expect(data.skipped).toBe(false);
    });

    it('全部完成后序列化正确', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      const data = system.serialize();
      expect(data.completedSteps).toHaveLength(4);
      expect(data.skipped).toBe(false);
    });

    it('跳过后序列化正确', () => {
      system.skipTutorial();
      const data = system.serialize();
      expect(data.completedSteps).toEqual([]);
      expect(data.skipped).toBe(true);
    });

    it('反序列化恢复完成状态', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      const data = system.serialize();

      const newSystem = new TutorialSystem();
      newSystem.init(deps as unknown as Record<string, unknown>);
      newSystem.loadSaveData(data);

      expect(newSystem.getCurrentStep()?.id).toBe('view_hero');
      expect(newSystem.isTutorialComplete()).toBe(false);
    });

    it('反序列化恢复跳过状态', () => {
      system.skipTutorial();
      const data = system.serialize();

      const newSystem = new TutorialSystem();
      newSystem.init(deps as unknown as Record<string, unknown>);
      newSystem.loadSaveData(data);

      expect(newSystem.isSkipped()).toBe(true);
      expect(newSystem.getCurrentStep()).toBeNull();
    });

    it('反序列化恢复全部完成状态', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      const data = system.serialize();

      const newSystem = new TutorialSystem();
      newSystem.init(deps as unknown as Record<string, unknown>);
      newSystem.loadSaveData(data);

      expect(newSystem.isTutorialComplete()).toBe(true);
      expect(newSystem.getCurrentStep()).toBeNull();
    });

    it('序列化数据是快照（修改不影响原系统）', () => {
      const data = system.serialize();
      data.completedSteps.push('claim_newbie_pack' as unknown as string);
      data.skipped = true;

      // 原系统不受影响
      expect(system.isSkipped()).toBe(false);
      expect(system.getCurrentStep()?.id).toBe('claim_newbie_pack');
    });
  });

  // ═══════════════════════════════════════════
  // 10. 查询 API
  // ═══════════════════════════════════════════

  describe('查询 API', () => {
    it('isStepCompleted() 正确返回步骤完成状态', () => {
      expect(system.isStepCompleted('claim_newbie_pack')).toBe(false);
      system.completeCurrentStep('claim_newbie_pack');
      expect(system.isStepCompleted('claim_newbie_pack')).toBe(true);
      expect(system.isStepCompleted('first_recruit')).toBe(false);
    });

    it('getStepById() 返回步骤定义', () => {
      const step = system.getStepById('claim_newbie_pack');
      expect(step).not.toBeNull();
      expect(step!.title).toBe('领取新手礼包');
    });

    it('getStepById() 对不存在的ID返回 null', () => {
      const step = system.getStepById('nonexistent' as unknown as string);
      expect(step).toBeNull();
    });

    it('getStepStatus() 返回正确的步骤状态', () => {
      // 初始状态
      expect(system.getStepStatus('claim_newbie_pack')).toBe('current');
      expect(system.getStepStatus('first_recruit')).toBe('locked');
      expect(system.getStepStatus('view_hero')).toBe('locked');
      expect(system.getStepStatus('add_to_formation')).toBe('locked');

      // 完成步骤1后
      system.completeCurrentStep('claim_newbie_pack');
      expect(system.getStepStatus('claim_newbie_pack')).toBe('completed');
      expect(system.getStepStatus('first_recruit')).toBe('current');
      expect(system.getStepStatus('view_hero')).toBe('locked');
    });

    it('getStepStatus() 全部完成后所有步骤为 completed', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      TUTORIAL_GUIDE_STEPS.forEach(step => {
        expect(system.getStepStatus(step.id)).toBe('completed');
      });
    });

    it('getCurrentStepOrder() 随完成进度递增', () => {
      expect(system.getCurrentStepOrder()).toBe(1);
      system.completeCurrentStep('claim_newbie_pack');
      expect(system.getCurrentStepOrder()).toBe(2);
      system.completeCurrentStep('first_recruit');
      expect(system.getCurrentStepOrder()).toBe(3);
      system.completeCurrentStep('view_hero');
      expect(system.getCurrentStepOrder()).toBe(4);
      system.completeCurrentStep('add_to_formation');
      expect(system.getCurrentStepOrder()).toBe(-1);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 边界情况
  // ═══════════════════════════════════════════

  describe('边界情况', () => {
    it('引导完成后不能再次完成步骤', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');

      const result = system.completeCurrentStep('claim_newbie_pack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已完成');
    });

    it('引导完成后 getCurrentStepOrder() 返回 -1', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.completeCurrentStep('first_recruit');
      system.completeCurrentStep('view_hero');
      system.completeCurrentStep('add_to_formation');
      expect(system.getCurrentStepOrder()).toBe(-1);
    });

    it('多次 reset() 不会出错', () => {
      system.completeCurrentStep('claim_newbie_pack');
      system.reset();
      system.reset();
      system.reset();
      expect(system.getCurrentStep()?.id).toBe('claim_newbie_pack');
    });

    it('getAllSteps() 返回的步骤按 order 排列', () => {
      const steps = system.getAllSteps();
      for (let i = 0; i < steps.length - 1; i++) {
        expect(steps[i].order).toBeLessThan(steps[i + 1].order);
      }
    });

    it('TUTORIAL_GUIDE_TOTAL_STEPS 等于步骤配置长度', () => {
      expect(TUTORIAL_GUIDE_TOTAL_STEPS).toBe(TUTORIAL_GUIDE_STEPS.length);
    });
  });
});
