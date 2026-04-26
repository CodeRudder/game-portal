/**
 * 引导系统增强测试 — 交互式引导功能
 *
 * 覆盖功能点（20+ 测试用例）：
 *   - targetElement 正确返回
 *   - tooltipPosition 正确返回
 *   - highlightStyle 正确返回
 *   - 步骤提示信息获取 (getStepHint)
 *   - 引导跳转功能 (getCurrentStepAction)
 *   - 引导统计 (getTutorialStats)
 *
 * @module engine/tutorial/__tests__/tutorial-system-enhanced.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialSystem } from '../tutorial-system';
import {
  TUTORIAL_GUIDE_STEPS,
  TUTORIAL_GUIDE_STEP_MAP,
} from '../tutorial-config';
import type { TutorialGuideStepId } from '../tutorial-config';

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

/** 按顺序完成指定数量的步骤 */
function completeSteps(system: TutorialSystem, count: number): void {
  const actions = ['claim_newbie_pack', 'first_recruit', 'view_hero', 'add_to_formation'];
  for (let i = 0; i < count && i < actions.length; i++) {
    system.completeCurrentStep(actions[i]);
  }
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('TutorialSystem 增强功能', () => {
  let system: TutorialSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    system = new TutorialSystem();
    deps = createMockDeps();
    system.init(deps as unknown as Record<string, unknown>);
  });

  // ═══════════════════════════════════════════
  // 1. targetElement 正确返回
  // ═══════════════════════════════════════════

  describe('targetElement 正确返回', () => {
    it('步骤1的 targetElement 应为 "btn-claim-pack"', () => {
      const step = system.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step!.targetElement).toBe('btn-claim-pack');
    });

    it('步骤2的 targetElement 应为 "btn-recruit"', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const step = system.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step!.targetElement).toBe('btn-recruit');
    });

    it('步骤3的 targetElement 应为 "btn-hero-list"', () => {
      completeSteps(system, 2);
      const step = system.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step!.targetElement).toBe('btn-hero-list');
    });

    it('步骤4的 targetElement 应为 "btn-formation"', () => {
      completeSteps(system, 3);
      const step = system.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step!.targetElement).toBe('btn-formation');
    });

    it('所有步骤都配置了 targetElement', () => {
      TUTORIAL_GUIDE_STEPS.forEach(step => {
        expect(step.targetElement).toBeDefined();
        expect(typeof step.targetElement).toBe('string');
        expect(step.targetElement!.length).toBeGreaterThan(0);
      });
    });

    it('getStepById 返回的步骤包含正确的 targetElement', () => {
      const step = system.getStepById('first_recruit');
      expect(step).not.toBeNull();
      expect(step!.targetElement).toBe('btn-recruit');
    });
  });

  // ═══════════════════════════════════════════
  // 2. tooltipPosition 正确返回
  // ═══════════════════════════════════════════

  describe('tooltipPosition 正确返回', () => {
    it('步骤1的 tooltipPosition 应为 "bottom"', () => {
      const step = system.getCurrentStep();
      expect(step!.tooltipPosition).toBe('bottom');
    });

    it('步骤2的 tooltipPosition 应为 "right"', () => {
      system.completeCurrentStep('claim_newbie_pack');
      expect(system.getCurrentStep()!.tooltipPosition).toBe('right');
    });

    it('步骤3的 tooltipPosition 应为 "left"', () => {
      completeSteps(system, 2);
      expect(system.getCurrentStep()!.tooltipPosition).toBe('left');
    });

    it('步骤4的 tooltipPosition 应为 "top"', () => {
      completeSteps(system, 3);
      expect(system.getCurrentStep()!.tooltipPosition).toBe('top');
    });

    it('所有步骤的 tooltipPosition 都是合法值', () => {
      const validPositions = ['top', 'bottom', 'left', 'right'];
      TUTORIAL_GUIDE_STEPS.forEach(step => {
        expect(validPositions).toContain(step.tooltipPosition);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 3. highlightStyle 正确返回
  // ═══════════════════════════════════════════

  describe('highlightStyle 正确返回', () => {
    it('步骤1的 highlightStyle 应为 "pulse"', () => {
      const step = system.getCurrentStep();
      expect(step!.highlightStyle).toBe('pulse');
    });

    it('步骤2的 highlightStyle 应为 "glow"', () => {
      system.completeCurrentStep('claim_newbie_pack');
      expect(system.getCurrentStep()!.highlightStyle).toBe('glow');
    });

    it('步骤3的 highlightStyle 应为 "border"', () => {
      completeSteps(system, 2);
      expect(system.getCurrentStep()!.highlightStyle).toBe('border');
    });

    it('步骤4的 highlightStyle 应为 "pulse"', () => {
      completeSteps(system, 3);
      expect(system.getCurrentStep()!.highlightStyle).toBe('pulse');
    });

    it('所有步骤的 highlightStyle 都是合法值', () => {
      const validStyles = ['pulse', 'border', 'glow'];
      TUTORIAL_GUIDE_STEPS.forEach(step => {
        expect(validStyles).toContain(step.highlightStyle);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 4. getStepHint — 步骤提示信息
  // ═══════════════════════════════════════════

  describe('getStepHint', () => {
    it('步骤1返回正确的提示信息', () => {
      const hint = system.getStepHint('claim_newbie_pack');
      expect(hint).toBe('点击闪烁的领取按钮即可获得丰厚新手奖励！');
    });

    it('步骤2返回正确的提示信息', () => {
      const hint = system.getStepHint('first_recruit');
      expect(hint).toBe('点击招募按钮，消耗招贤令招募一位武将吧！');
    });

    it('步骤3返回正确的提示信息', () => {
      const hint = system.getStepHint('view_hero');
      expect(hint).toBe('打开武将列表，查看你刚招募到的武将属性和技能！');
    });

    it('步骤4返回正确的提示信息', () => {
      const hint = system.getStepHint('add_to_formation');
      expect(hint).toBe('将武将拖入编队槽位，组建你的第一支战斗队伍！');
    });

    it('不存在的步骤ID返回 null', () => {
      const hint = system.getStepHint('nonexistent' as TutorialGuideStepId);
      expect(hint).toBeNull();
    });

    it('所有步骤都配置了 hint', () => {
      TUTORIAL_GUIDE_STEPS.forEach(step => {
        const hint = system.getStepHint(step.id);
        expect(hint).not.toBeNull();
        expect(typeof hint).toBe('string');
        expect(hint!.length).toBeGreaterThan(0);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 5. getCurrentStepAction — 引导跳转功能
  // ═══════════════════════════════════════════

  describe('getCurrentStepAction', () => {
    it('初始状态返回 "claim_newbie_pack"', () => {
      // 调用 getCurrentStep 以触发 startedAt 记录
      system.getCurrentStep();
      expect(system.getCurrentStepAction()).toBe('claim_newbie_pack');
    });

    it('完成步骤1后返回 "first_recruit"', () => {
      system.completeCurrentStep('claim_newbie_pack');
      expect(system.getCurrentStepAction()).toBe('first_recruit');
    });

    it('完成步骤2后返回 "view_hero"', () => {
      completeSteps(system, 2);
      expect(system.getCurrentStepAction()).toBe('view_hero');
    });

    it('完成步骤3后返回 "add_to_formation"', () => {
      completeSteps(system, 3);
      expect(system.getCurrentStepAction()).toBe('add_to_formation');
    });

    it('全部完成后返回 null', () => {
      completeSteps(system, 4);
      expect(system.getCurrentStepAction()).toBeNull();
    });

    it('跳过后返回 null', () => {
      system.skipTutorial();
      expect(system.getCurrentStepAction()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 6. getTutorialStats — 引导统计
  // ═══════════════════════════════════════════

  describe('getTutorialStats', () => {
    it('初始状态：总步骤4、完成0、跳过率0、平均时间0', () => {
      const stats = system.getTutorialStats();
      expect(stats.totalSteps).toBe(4);
      expect(stats.completedSteps).toBe(0);
      expect(stats.skipRate).toBe(0);
      expect(stats.avgCompletionTimeMs).toBe(0);
    });

    it('完成1步后 completedSteps 为 1', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const stats = system.getTutorialStats();
      expect(stats.completedSteps).toBe(1);
      expect(stats.totalSteps).toBe(4);
    });

    it('完成全部步骤后 completedSteps 等于 totalSteps', () => {
      completeSteps(system, 4);
      const stats = system.getTutorialStats();
      expect(stats.completedSteps).toBe(4);
      expect(stats.totalSteps).toBe(4);
    });

    it('跳过后 skipRate 为 1', () => {
      system.skipTutorial();
      const stats = system.getTutorialStats();
      expect(stats.skipRate).toBe(1);
      expect(stats.completedSteps).toBe(0);
    });

    it('未跳过时 skipRate 为 0', () => {
      completeSteps(system, 2);
      const stats = system.getTutorialStats();
      expect(stats.skipRate).toBe(0);
    });

    it('完成步骤后平均完成时间大于等于 0', () => {
      system.completeCurrentStep('claim_newbie_pack');
      const stats = system.getTutorialStats();
      expect(stats.avgCompletionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('reset 后统计恢复初始值', () => {
      completeSteps(system, 2);
      system.reset();
      const stats = system.getTutorialStats();
      expect(stats.completedSteps).toBe(0);
      expect(stats.skipRate).toBe(0);
      expect(stats.avgCompletionTimeMs).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 综合交互式引导场景
  // ═══════════════════════════════════════════

  describe('综合交互式引导场景', () => {
    it('每步都包含完整的交互信息（target + position + style + hint）', () => {
      const steps = system.getAllSteps();
      steps.forEach(step => {
        expect(step.targetElement).toBeDefined();
        expect(step.tooltipPosition).toBeDefined();
        expect(step.highlightStyle).toBeDefined();
        // hint 通过 getStepHint 验证
        const hint = system.getStepHint(step.id);
        expect(hint).not.toBeNull();
      });
    });

    it('引导过程中逐步获取交互信息的一致性', () => {
      const actions = ['claim_newbie_pack', 'first_recruit', 'view_hero', 'add_to_formation'];
      const expectedTargets = ['btn-claim-pack', 'btn-recruit', 'btn-hero-list', 'btn-formation'];
      const expectedPositions = ['bottom', 'right', 'left', 'top'] as const;
      const expectedStyles = ['pulse', 'glow', 'border', 'pulse'] as const;

      for (let i = 0; i < 4; i++) {
        const current = system.getCurrentStep();
        expect(current).not.toBeNull();
        expect(current!.targetElement).toBe(expectedTargets[i]);
        expect(current!.tooltipPosition).toBe(expectedPositions[i]);
        expect(current!.highlightStyle).toBe(expectedStyles[i]);
        expect(system.getCurrentStepAction()).toBe(actions[i]);
        system.completeCurrentStep(actions[i]);
      }

      // 全部完成
      expect(system.getCurrentStep()).toBeNull();
      expect(system.getCurrentStepAction()).toBeNull();
      const stats = system.getTutorialStats();
      expect(stats.completedSteps).toBe(4);
      expect(stats.skipRate).toBe(0);
    });
  });
});
