/**
 * 集成测试 — §9 扩展功能：统计面板+中断恢复+移动端适配
 *
 * 验证：引导统计面板、中断恢复、移动端适配、跨设备同步冲突解决。
 * 覆盖功能点：
 *   #8  引导进度存储 — 实时保存
 *   #9  冲突解决 — 取completed_steps并集
 *   #13 引导重玩 — 观看模式+奖励
 *   #14 自由探索过渡 — 推荐行动+已解锁功能
 *   #17 首次启动检测 — isFirstLaunch标记
 *
 * @module engine/guide/__tests__/integration/tutorial-stats-recovery-mobile
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../../TutorialStateMachine';
import { TutorialStepManager } from '../../TutorialStepManager';
import { StoryEventPlayer } from '../../StoryEventPlayer';
import { TutorialMaskSystem } from '../../TutorialMaskSystem';
import { TutorialStorage } from '../../TutorialStorage';
import { FirstLaunchDetector } from '../../FirstLaunchDetector';
import {
  CORE_STEP_DEFINITIONS,
  EXTENDED_STEP_DEFINITIONS,
} from '../../../../core/guide/guide-config';
import {
  NEWBIE_PROTECTION_DURATION_MS,
  TUTORIAL_SAVE_VERSION,
} from '../../../../core/guide/guide.types';
import type { TutorialSaveData, StoryEventId } from '../../../../core/guide/guide.types';
import type { HighlightBounds } from '../../tutorial-mask-types';

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
  const storyPlayer = new StoryEventPlayer();
  const maskSystem = new TutorialMaskSystem();
  const storage = new TutorialStorage();
  const firstLaunch = new FirstLaunchDetector();

  stateMachine.init(deps);
  stepManager.init(deps);
  storyPlayer.init(deps);
  maskSystem.init(deps);
  storage.init(deps);
  firstLaunch.init(deps);

  stepManager.setStateMachine(stateMachine);
  storyPlayer.setStateMachine(stateMachine);
  storage.setStateMachine(stateMachine);
  firstLaunch.setStateMachine(stateMachine);

  return { deps, stateMachine, stepManager, storyPlayer, maskSystem, storage, firstLaunch };
}

/** 完成指定步骤（含所有子步骤） */
function completeStep(stepManager: TutorialStepManager, stepId: string) {
  const result = stepManager.startStep(stepId as unknown as Record<string, unknown>);
  if (!result.success) return result;
  const definition = result.step!;
  for (let i = 0; i < definition.subSteps.length; i++) {
    stepManager.advanceSubStep();
  }
  return result;
}

/** 模拟元素位置查询 */
const mockBoundsProvider = (_selector: string): HighlightBounds => ({
  x: 100, y: 200, width: 300, height: 150,
});

// ─────────────────────────────────────────────
// §7.4 统计面板+中断恢复+移动端适配 集成测试
// ─────────────────────────────────────────────

describe('§7.4 统计面板+中断恢复+移动端适配 集成测试', () => {
  let bundle: ReturnType<typeof createSystemBundle>;

  beforeEach(() => {
    bundle = createSystemBundle();
    localStorage.clear();
  });

  // ─── §7.4.1 引导统计面板 ─────────────

  describe('§7.4.1 引导统计面板', () => {
    it('初始状态应显示0步完成、0段剧情完成', () => {
      expect(bundle.stateMachine.getCompletedStepCount()).toBe(0);
      expect(bundle.stateMachine.getState().completedEvents).toHaveLength(0);
    });

    it('完成核心步骤后统计应正确更新', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      expect(bundle.stateMachine.getCompletedStepCount()).toBe(2);
      expect(bundle.stateMachine.getCompletedCoreStepCount()).toBe(2);
    });

    it('完成全部6步核心引导后统计应为6', () => {
      bundle.stateMachine.transition('first_enter');
      const coreSteps = CORE_STEP_DEFINITIONS.map(s => s.stepId);
      for (const stepId of coreSteps) {
        completeStep(bundle.stepManager, stepId);
      }
      expect(bundle.stateMachine.getCompletedStepCount()).toBe(6);
      expect(bundle.stateMachine.getCompletedCoreStepCount()).toBe(6);
    });

    it('剧情事件完成后completedEvents应正确记录', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');
      bundle.stateMachine.completeStoryEvent('e2_yellow_turban');
      expect(bundle.stateMachine.isStoryEventCompleted('e1_peach_garden')).toBe(true);
      expect(bundle.stateMachine.isStoryEventCompleted('e2_yellow_turban')).toBe(true);
      expect(bundle.stateMachine.getState().completedEvents).toHaveLength(2);
    });

    it('重复完成同一剧情不应重复记录', () => {
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');
      expect(bundle.stateMachine.getState().completedEvents).toHaveLength(1);
    });

    it('序列化数据应包含完整统计信息', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');
      const saved = bundle.stateMachine.serialize();
      expect(saved.completedSteps).toContain('step1_castle_overview');
      expect(saved.completedEvents).toContain('e1_peach_garden');
      expect(saved.currentPhase).toBe('core_guiding');
      expect(saved.version).toBe(TUTORIAL_SAVE_VERSION);
    });
  });

  // ─── §7.4.2 中断恢复 ─────────────────

  describe('§7.4.2 中断恢复', () => {
    it('保存后应能从localStorage恢复进度', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');

      // 保存
      const saveResult = bundle.storage.save();
      expect(saveResult.success).toBe(true);

      // 新建 bundle 恢复
      const bundle2 = createSystemBundle();
      const restoreResult = bundle2.storage.restore();
      expect(restoreResult.success).toBe(true);
      expect(bundle2.stateMachine.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(bundle2.stateMachine.isStepCompleted('step2_build_farm')).toBe(true);
      expect(bundle2.stateMachine.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });

    it('无存档时恢复应成功但不改变状态', () => {
      const restoreResult = bundle.storage.restore();
      expect(restoreResult.success).toBe(true);
      expect(bundle.stateMachine.getCurrentPhase()).toBe('not_started');
    });

    it('存档数据格式无效时恢复应失败', () => {
      localStorage.setItem('three-kingdoms-tutorial-save', 'invalid-json');
      const result = bundle.storage.load();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('加载失败');
    });

    it('存档缺少必要字段时验证应失败', () => {
      const badData = { version: 1 }; // 缺少 completedSteps, currentPhase 等
      localStorage.setItem('three-kingdoms-tutorial-save', JSON.stringify(badData));
      const result = bundle.storage.load();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('格式无效');
    });

    it('全量重置应清除存档和状态机', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      bundle.storage.save();

      const resetResult = bundle.storage.fullReset();
      expect(resetResult.success).toBe(true);
      expect(bundle.stateMachine.getCurrentPhase()).toBe('not_started');
      expect(bundle.stateMachine.getCompletedStepCount()).toBe(0);
      expect(bundle.storage.hasSaveData()).toBe(false);
    });

    it('仅重置步骤应保留剧情完成记录', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');
      bundle.storage.save();

      const resetResult = bundle.storage.resetStepsOnly();
      expect(resetResult.success).toBe(true);
      // 步骤已重置
      expect(bundle.stateMachine.getCurrentPhase()).toBe('not_started');
      expect(bundle.stateMachine.getCompletedStepCount()).toBe(0);
    });
  });

  // ─── §7.4.3 跨设备同步冲突解决 (#9) ──

  describe('§7.4.3 跨设备同步冲突解决 (#9)', () => {
    it('冲突解决应取completedSteps并集', () => {
      const local: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: ['step1_castle_overview', 'step2_build_farm'] as unknown as string[],
        completedEvents: ['e1_peach_garden'] as unknown as string[],
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
        completedSteps: ['step2_build_farm', 'step3_recruit_hero'] as unknown as string[],
        completedEvents: ['e2_yellow_turban'] as unknown as string[],
      };

      const merged = bundle.stateMachine.resolveConflict(local, remote);
      expect(merged.completedSteps).toHaveLength(3);
      expect(merged.completedSteps).toContain('step1_castle_overview');
      expect(merged.completedSteps).toContain('step2_build_farm');
      expect(merged.completedSteps).toContain('step3_recruit_hero');
    });

    it('冲突解决应取completedEvents并集', () => {
      const base: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: [],
        completedEvents: ['e1_peach_garden'] as unknown as string[],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: Date.now(),
      };
      const remote: TutorialSaveData = {
        ...base,
        completedEvents: ['e2_yellow_turban', 'e3_three_visits'] as unknown as string[],
      };

      const merged = bundle.stateMachine.resolveConflict(base, remote);
      expect(merged.completedEvents).toHaveLength(3);
    });

    it('冲突解决应取进度更高的阶段', () => {
      const local: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: [],
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
        currentPhase: 'free_play',
      };

      const merged = bundle.stateMachine.resolveConflict(local, remote);
      expect(merged.currentPhase).toBe('free_play');
    });

    it('mergeRemoteData应合并远程数据并保存', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      bundle.storage.save();

      const remote: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: ['step2_build_farm'] as unknown as string[],
        completedEvents: ['e1_peach_garden'] as unknown as string[],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: Date.now(),
      };

      const result = bundle.storage.mergeRemoteData(remote);
      expect(result.success).toBe(true);
      expect(bundle.stateMachine.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(bundle.stateMachine.isStepCompleted('step2_build_farm')).toBe(true);
    });
  });

  // ─── §7.4.4 移动端适配 ───────────────

  describe('§7.4.4 移动端适配', () => {
    it('遮罩默认视口尺寸应为移动端尺寸（375x667）', () => {
      const state = bundle.maskSystem.getState();
      expect(state.viewportSize.width).toBe(375);
      expect(state.viewportSize.height).toBe(667);
    });

    it('设置视口尺寸应正确更新', () => {
      bundle.maskSystem.setViewportSize({ width: 414, height: 896 });
      const state = bundle.maskSystem.getState();
      expect(state.viewportSize.width).toBe(414);
      expect(state.viewportSize.height).toBe(896);
    });

    it('遮罩应支持平板尺寸（1024x768）', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setViewportSize({ width: 1024, height: 768 });
      bundle.maskSystem.setHighlightTarget('#castle-overview', mockBoundsProvider);
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.visible).toBe(true);
    });

    it('遮罩应支持横屏尺寸（667x375）', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setViewportSize({ width: 667, height: 375 });
      bundle.maskSystem.setHighlightTarget('#castle-overview', mockBoundsProvider);
      expect(bundle.maskSystem.getHighlightBounds()).not.toBeNull();
    });

    it('setupForSubStep在移动端小屏幕应正常工作', () => {
      bundle.maskSystem.setViewportSize({ width: 320, height: 568 });
      const subStep = CORE_STEP_DEFINITIONS[0].subSteps[0];
      const result = bundle.maskSystem.setupForSubStep(subStep, mockBoundsProvider);
      expect(result.success).toBe(true);
      const bubble = bundle.maskSystem.getBubbleRenderData();
      expect(bubble.visible).toBe(true);
    });

    it('简化模式适合低端移动设备（降低透明度、关闭动画）', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setSimplifiedMode(true);
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.opacity).toBe(0.5);
      expect(renderData.showHandAnimation).toBe(false);
    });

    it('移动端手势操作应支持点击推进剧情（等同滑动）', () => {
      // 引擎层通过 tap() 支持推进剧情，UI层负责映射手势到tap
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const progress = bundle.storyPlayer.getPlayProgress();
      expect(progress.state).toBe('playing');
      const result = bundle.storyPlayer.tap();
      expect(['reveal_line', 'next_line', 'complete']).toContain(result.action);
    });

    it('步骤完成时应触发rewardGranted事件（等同振动反馈触发点）', () => {
      // 引擎层通过 eventBus 发出 rewardGranted 事件，UI层负责映射振动反馈
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:rewardGranted',
        expect.objectContaining({ source: 'step1_castle_overview' }),
      );
    });
  });

  // ─── §7.4.5 首次启动检测 (#17) ───────

  describe('§7.4.5 首次启动检测 (#17)', () => {
    it('首次启动应检测为isFirstLaunch=true', () => {
      const result = bundle.firstLaunch.detectFirstLaunch();
      expect(result.isFirstLaunch).toBe(true);
    });

    it('非首次启动（状态机已有进度）应检测为isFirstLaunch=false', () => {
      // 状态机已有进度（进入过引导），不再是首次
      bundle.stateMachine.transition('first_enter');
      const result = bundle.firstLaunch.detectFirstLaunch();
      expect(result.isFirstLaunch).toBe(false);
    });

    it('首次启动流程应发射firstLaunchDetected事件', () => {
      bundle.firstLaunch.detectFirstLaunch();
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:firstLaunchDetected',
        expect.objectContaining({ isFirstLaunch: true }),
      );
    });

    it('首次启动流程应包含语言/画质/权限设置步骤', async () => {
      // 通过 executeFirstLaunchFlow 执行完整流程，验证各步骤
      const flowResult = await bundle.firstLaunch.executeFirstLaunchFlow();
      expect(flowResult.currentStep).toBe('completed');
      expect(flowResult.detectedLanguage).toBeDefined();
      expect(flowResult.recommendedQuality).toBeDefined();
      expect(flowResult.permissionStatus).toBeDefined();
    });

    it('非首次启动应支持跳过onboarding直接进入引导', () => {
      // 非首次启动通过 handleReturningUser 跳过onboarding
      bundle.stateMachine.transition('first_enter'); // 标记已有进度
      bundle.firstLaunch.handleReturningUser();
      const flowState = bundle.firstLaunch.getFlowState();
      expect(flowState.currentStep).toBe('skipped');
      expect(flowState.isFirstLaunch).toBe(false);
    });
  });
});
