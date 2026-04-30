/**
 * 集成测试 — §3 遮罩跳过
 *
 * 覆盖：步骤高亮、遮罩聚焦、跳过机制、重玩、中断恢复、新手保护
 * 验证：TutorialMaskSystem + TutorialStateMachine + TutorialStepManager + FirstLaunchDetector 联动
 *
 * @module engine/guide/__tests__/integration/tutorial-mask-skip
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../../TutorialStateMachine';
import { TutorialStepManager } from '../../TutorialStepManager';
import { TutorialMaskSystem } from '../../TutorialMaskSystem';
import { FirstLaunchDetector } from '../../FirstLaunchDetector';
import { CORE_STEP_DEFINITIONS } from '../../../../core/guide/guide-config';
import type { TutorialSaveData } from '../../../../core/guide/guide.types';

// ─────────────────────────────────────────────
// 测试基础设施
// ─────────────────────────────────────────────

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

function createSystemBundle() {
  const deps = createMockDeps();
  const stateMachine = new TutorialStateMachine();
  const stepManager = new TutorialStepManager();
  const maskSystem = new TutorialMaskSystem();
  const firstLaunch = new FirstLaunchDetector();

  stateMachine.init(deps);
  stepManager.init(deps);
  maskSystem.init(deps);
  firstLaunch.init(deps);

  stepManager.setStateMachine(stateMachine);
  firstLaunch.setStateMachine(stateMachine);

  return { deps, stateMachine, stepManager, maskSystem, firstLaunch };
}

function completeStep(stepManager: TutorialStepManager, stepId: string) {
  const result = stepManager.startStep(stepId as unknown as Record<string, unknown>);
  if (!result.success) return result;
  const definition = result.step!;
  for (let i = 0; i < definition.subSteps.length; i++) {
    stepManager.advanceSubStep();
  }
  return result;
}

/** 模拟元素位置查询回调 */
const mockBoundsProvider = (selector: string) => {
  const boundsMap: Record<string, { x: number; y: number; width: number; height: number }> = {
    '#main-castle': { x: 50, y: 100, width: 300, height: 200 },
    '#resource-bar': { x: 0, y: 0, width: 400, height: 50 },
    '#nav-tab': { x: 0, y: 600, width: 400, height: 60 },
    '#building-area': { x: 20, y: 80, width: 360, height: 500 },
    '#empty-plot': { x: 100, y: 200, width: 80, height: 80 },
    '#building-farm': { x: 100, y: 200, width: 80, height: 80 },
    '#confirm-build': { x: 150, y: 400, width: 100, height: 40 },
    '#tavern': { x: 200, y: 150, width: 100, height: 100 },
    '#campaign-btn': { x: 300, y: 500, width: 80, height: 40 },
    '#tech-btn': { x: 350, y: 100, width: 40, height: 40 },
    '#tech-tree': { x: 0, y: 50, width: 400, height: 550 },
  };
  return boundsMap[selector] ?? null;
};

// ─────────────────────────────────────────────
// §3 遮罩跳过集成测试
// ─────────────────────────────────────────────

describe('§3 遮罩跳过集成测试', () => {
  let bundle: ReturnType<typeof createSystemBundle>;

  beforeEach(() => {
    bundle = createSystemBundle();
  });

  // ─── §3.1 步骤高亮与遮罩聚焦 ─────────────

  describe('§3.1 步骤高亮与遮罩聚焦', () => {
    it('激活遮罩后应处于active状态', () => {
      bundle.maskSystem.activate();
      expect(bundle.maskSystem.isActive()).toBe(true);
    });

    it('停用遮罩后应处于inactive状态', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.deactivate();
      expect(bundle.maskSystem.isActive()).toBe(false);
    });

    it('设置高亮目标应正确记录selector和bounds', () => {
      bundle.maskSystem.activate();
      const result = bundle.maskSystem.setHighlightTarget('#main-castle', mockBoundsProvider);
      expect(result.success).toBe(true);
      expect(bundle.maskSystem.getTargetSelector()).toBe('#main-castle');
      const bounds = bundle.maskSystem.getHighlightBounds();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBe(50 - 8); // padding=8 applied
    });

    it('未激活遮罩时设置高亮目标应失败', () => {
      const result = bundle.maskSystem.setHighlightTarget('#main-castle', mockBoundsProvider);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('遮罩未激活');
    });

    it('不存在的元素应返回失败', () => {
      bundle.maskSystem.activate();
      const result = bundle.maskSystem.setHighlightTarget('#nonexistent', mockBoundsProvider);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无法获取元素');
    });

    it('清除高亮目标应重置selector和bounds', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setHighlightTarget('#main-castle', mockBoundsProvider);
      bundle.maskSystem.clearHighlightTarget();
      expect(bundle.maskSystem.getTargetSelector()).toBeNull();
      expect(bundle.maskSystem.getHighlightBounds()).toBeNull();
    });

    it('setupForSubStep应一次性完成遮罩激活+高亮+气泡', () => {
      const subStep = CORE_STEP_DEFINITIONS[0].subSteps[0];
      const result = bundle.maskSystem.setupForSubStep(subStep, mockBoundsProvider);
      expect(result.success).toBe(true);
      expect(bundle.maskSystem.isActive()).toBe(true);
      expect(bundle.maskSystem.getTargetSelector()).toBe(subStep.targetSelector);
    });

    it('遮罩渲染数据应包含正确的opacity和borderRadius', () => {
      bundle.maskSystem.activate({ opacity: 0.6, borderRadius: 12 });
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.opacity).toBe(0.6);
      expect(renderData.borderRadius).toBe(12);
    });

    it('高亮区域应包含padding扩展', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setHighlightTarget('#main-castle', mockBoundsProvider);
      const bounds = bundle.maskSystem.getHighlightBounds()!;
      // 原始: x=50, width=300, padding=8
      expect(bounds.x).toBe(42); // 50 - 8
      expect(bounds.width).toBe(316); // 300 + 16
    });
  });

  // ─── §3.2 跳过机制 ─────────────────────

  describe('§3.2 跳过机制', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('步骤1（主城概览）应标记为不可跳过', () => {
      expect(bundle.stepManager.isUnskippable('step1_castle_overview')).toBe(true);
    });

    it('步骤2（建造农田）应标记为不可跳过', () => {
      expect(bundle.stepManager.isUnskippable('step2_build_farm')).toBe(true);
    });

    it('步骤4（首次出征）应标记为不可跳过', () => {
      expect(bundle.stepManager.isUnskippable('step4_first_battle')).toBe(true);
    });

    it('不可跳过步骤不允许story_skip加速', () => {
      bundle.stepManager.startStep('step1_castle_overview');
      const result = bundle.stepManager.activateAcceleration('story_skip');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不可跳过');
    });

    it('不可跳过步骤不允许quick_complete加速', () => {
      bundle.stepManager.startStep('step1_castle_overview');
      const result = bundle.stepManager.activateAcceleration('quick_complete');
      expect(result.success).toBe(false);
    });

    it('可跳过步骤允许dialogue_tap加速', () => {
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      bundle.stepManager.startStep('step3_recruit_hero');
      const result = bundle.stepManager.activateAcceleration('dialogue_tap');
      expect(result.success).toBe(true);
    });

    it('加速激活后状态应正确反映', () => {
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      bundle.stepManager.startStep('step3_recruit_hero');
      bundle.stepManager.activateAcceleration('animation_speed');
      const acc = bundle.stepManager.getAccelerationState();
      expect(acc).not.toBeNull();
      expect(acc!.active).toBe(true);
      expect(acc!.type).toBe('animation_speed');
      expect(acc!.multiplier).toBe(3); // ANIMATION_SPEED_MULTIPLIER
    });

    it('取消加速后状态应清空', () => {
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      bundle.stepManager.startStep('step3_recruit_hero');
      bundle.stepManager.activateAcceleration('dialogue_tap');
      bundle.stepManager.deactivateAcceleration();
      expect(bundle.stepManager.getAccelerationState()).toBeNull();
    });
  });

  // ─── §3.3 重玩机制 ─────────────────────

  describe('§3.3 重玩机制', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
    });

    it('watch模式重玩应成功启动', () => {
      const result = bundle.stepManager.startReplay('watch');
      expect(result.success).toBe(true);
      expect(bundle.stepManager.isReplaying()).toBe(true);
    });

    it('interactive模式重玩应成功启动', () => {
      const result = bundle.stepManager.startReplay('interactive');
      expect(result.success).toBe(true);
    });

    it('重玩模式下可重新开始已完成步骤', () => {
      bundle.stepManager.startReplay('interactive');
      const result = bundle.stepManager.startStep('step1_castle_overview');
      expect(result.success).toBe(true);
    });

    it('结束重玩应发放铜钱100奖励', () => {
      bundle.stepManager.startReplay('watch');
      const reward = bundle.stepManager.endReplay();
      expect(reward).not.toBeNull();
      expect(reward!.rewardId).toBe('copper');
      expect(reward!.amount).toBe(100);
    });

    it('结束重玩后应退出replay模式', () => {
      bundle.stepManager.startReplay('watch');
      bundle.stepManager.endReplay();
      expect(bundle.stepManager.isReplaying()).toBe(false);
    });

    it('每日重玩次数应有上限（3次）', () => {
      expect(bundle.stepManager.getRemainingReplayCount()).toBeLessThanOrEqual(3);
      expect(bundle.stepManager.getRemainingReplayCount()).toBeGreaterThan(0);
    });
  });

  // ─── §3.4 中断恢复 ─────────────────────

  describe('§3.4 中断恢复', () => {
    it('步骤执行中断电后应能通过存档恢复', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      // 序列化
      const saved = bundle.stateMachine.serialize();

      // 新建bundle模拟重新启动
      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(saved);
      expect(bundle2.stateMachine.getCurrentPhase()).toBe('core_guiding');
      expect(bundle2.stateMachine.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(bundle2.stateMachine.isStepCompleted('step2_build_farm')).toBe(true);
      // 可以继续步骤3
      const result = bundle2.stepManager.startStep('step3_recruit_hero');
      expect(result.success).toBe(true);
    });

    it('自由探索阶段中断应能恢复', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.stateMachine.transition('step6_complete');
      const saved = bundle.stateMachine.serialize();

      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(saved);
      expect(bundle2.stateMachine.getCurrentPhase()).toBe('free_explore');
      // 可以继续完成探索
      const result = bundle2.stateMachine.transition('explore_done');
      expect(result.success).toBe(true);
      expect(bundle2.stateMachine.getCurrentPhase()).toBe('free_play');
    });

    it('遮罩状态应在步骤恢复时重新激活', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      // 恢复后开始步骤2，遮罩应能重新激活
      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(bundle.stateMachine.serialize());
      bundle2.stepManager.startStep('step2_build_farm');
      bundle2.maskSystem.activate();
      expect(bundle2.maskSystem.isActive()).toBe(true);
    });

    it('跨设备冲突解决后应能正确恢复', () => {
      const local: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: ['step1_castle_overview'],
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: Date.now(),
      };
      const remote: TutorialSaveData = {
        ...local,
        completedSteps: ['step1_castle_overview', 'step2_build_farm', 'step3_recruit_hero'],
      };
      const merged = bundle.stateMachine.resolveConflict(local, remote);
      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(merged);
      expect(bundle2.stateMachine.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(bundle2.stateMachine.isStepCompleted('step2_build_farm')).toBe(true);
      expect(bundle2.stateMachine.isStepCompleted('step3_recruit_hero')).toBe(true);
    });
  });

  // ─── §3.5 新手保护 ─────────────────────

  describe('§3.5 新手保护', () => {
    it('首次进入应开启新手保护', () => {
      bundle.stateMachine.transition('first_enter');
      expect(bundle.stateMachine.isNewbieProtectionActive()).toBe(true);
    });

    it('新手保护期间资源消耗应减半', () => {
      bundle.stateMachine.transition('first_enter');
      const discount = bundle.firstLaunch.getResourceCostDiscount();
      expect(discount).toBe(0.5);
    });

    it('新手保护期间战斗难度应降低', () => {
      bundle.stateMachine.transition('first_enter');
      const factor = bundle.firstLaunch.getBattleDifficultyFactor();
      expect(factor).toBe(0.7);
    });

    it('新手保护期间仅允许正面事件', () => {
      bundle.stateMachine.transition('first_enter');
      expect(bundle.firstLaunch.isPositiveEventsOnly()).toBe(true);
    });

    it('applyResourceDiscount应正确计算折扣', () => {
      bundle.stateMachine.transition('first_enter');
      const result = bundle.firstLaunch.applyResourceDiscount(100);
      expect(result).toBe(50); // 100 * 0.5
    });

    it('applyBattleDifficulty应正确调整难度', () => {
      bundle.stateMachine.transition('first_enter');
      const result = bundle.firstLaunch.applyBattleDifficulty(100);
      expect(result).toBe(70); // 100 * 0.7
    });

    it('老用户不应有新手保护', () => {
      bundle.firstLaunch.handleReturningUser();
      expect(bundle.stateMachine.isNewbieProtectionActive()).toBe(false);
      expect(bundle.firstLaunch.getResourceCostDiscount()).toBe(1);
      expect(bundle.firstLaunch.getBattleDifficultyFactor()).toBe(1);
    });
  });

  // ─── §3.6 简化模式（重放用遮罩） ─────────

  describe('§3.6 简化模式（重放用遮罩）', () => {
    it('简化模式应降低遮罩透明度', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setSimplifiedMode(true);
      expect(bundle.maskSystem.isSimplifiedMode()).toBe(true);
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.opacity).toBe(0.5);
    });

    it('简化模式应隐藏手指动画', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setSimplifiedMode(true);
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.showHandAnimation).toBe(false);
    });

    it('简化模式不应阻止非目标区域点击', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setSimplifiedMode(true);
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.blockNonTargetClicks).toBe(false);
    });

    it('非简化模式应阻止非目标区域点击', () => {
      bundle.maskSystem.activate();
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.blockNonTargetClicks).toBe(true);
    });
  });
});
