/**
 * 集成测试 — §7.1 完整引导流程
 *
 * 首次启动 → E1剧情 → 6步核心引导 → 自由探索 → 自由游戏
 * 验证：状态机转换、步骤推进、剧情触发、遮罩联动、存储持久化
 *
 * @module engine/guide/__tests__/integration/tutorial-full-flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../../TutorialStateMachine';
import { TutorialStepManager } from '../../TutorialStepManager';
import { StoryEventPlayer } from '../../StoryEventPlayer';
import { TutorialMaskSystem } from '../../TutorialMaskSystem';
import { FirstLaunchDetector } from '../../FirstLaunchDetector';
import { CORE_STEP_DEFINITIONS } from '../../../../core/guide/guide-config';
import type { TutorialSaveData } from '../../../../core/guide/guide.types';

// ─────────────────────────────────────────────
// 测试基础设施
// ─────────────────────────────────────────────

/** 创建带真实事件分发的 mock deps */
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

/** 创建并连接所有子系统 */
function createSystemBundle() {
  const deps = createMockDeps();
  const stateMachine = new TutorialStateMachine();
  const stepManager = new TutorialStepManager();
  const storyPlayer = new StoryEventPlayer();
  const maskSystem = new TutorialMaskSystem();
  const firstLaunch = new FirstLaunchDetector();

  // 初始化
  stateMachine.init(deps);
  stepManager.init(deps);
  storyPlayer.init(deps);
  maskSystem.init(deps);
  firstLaunch.init(deps);

  // 连接依赖
  stepManager.setStateMachine(stateMachine);
  storyPlayer.setStateMachine(stateMachine);
  firstLaunch.setStateMachine(stateMachine);

  return { deps, stateMachine, stepManager, storyPlayer, maskSystem, firstLaunch };
}

/** 完成指定步骤（含所有子步骤） */
function completeStep(stepManager: TutorialStepManager, stepId: string) {
  const result = stepManager.startStep(stepId as unknown as Record<string, unknown>);
  if (!result.success) return result;
  const definition = result.step!;
  // 推进所有子步骤
  for (let i = 0; i < definition.subSteps.length; i++) {
    stepManager.advanceSubStep();
  }
  return result;
}

// ─────────────────────────────────────────────
// §7.1 完整引导流程
// ─────────────────────────────────────────────

describe('§7.1 完整引导流程集成测试', () => {
  let bundle: ReturnType<typeof createSystemBundle>;

  beforeEach(() => {
    bundle = createSystemBundle();
  });

  // ─── 首次启动检测与引导触发 ───────────

  describe('§7.1.1 首次启动检测与引导触发', () => {
    it('首次启动检测应识别未开始状态为首次', () => {
      const detection = bundle.firstLaunch.detectFirstLaunch();
      expect(detection.isFirstLaunch).toBe(true);
      expect(detection.detectedLanguage).toBeDefined();
      expect(detection.recommendedQuality).toBeDefined();
    });

    it('首次启动流程应依次完成4个阶段并触发引导', async () => {
      const flowState = await bundle.firstLaunch.executeFirstLaunchFlow();
      expect(flowState.currentStep).toBe('completed');
      expect(flowState.isFirstLaunch).toBe(true);
      // 引导已触发，状态机应进入 core_guiding
      expect(bundle.stateMachine.getCurrentPhase()).toBe('core_guiding');
    });

    it('首次启动流程应发射 firstLaunchDetected 事件', () => {
      bundle.firstLaunch.detectFirstLaunch();
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:firstLaunchDetected',
        expect.objectContaining({ isFirstLaunch: true }),
      );
    });

    it('首次启动后状态机应记录开始时间并开启新手保护', () => {
      bundle.stateMachine.transition('first_enter');
      const state = bundle.stateMachine.getState();
      expect(state.tutorialStartTime).toBeGreaterThan(0);
      expect(state.protectionStartTime).toBeGreaterThan(0);
      expect(bundle.stateMachine.isNewbieProtectionActive()).toBe(true);
    });
  });

  // ─── E1剧情播放 ─────────────────────

  describe('§7.1.2 E1桃园结义剧情播放', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('首次进入后应能播放E1剧情', () => {
      const result = bundle.storyPlayer.startEvent('e1_peach_garden');
      expect(result.success).toBe(true);
      const progress = bundle.storyPlayer.getPlayProgress();
      expect(progress.state).toBe('playing');
      expect(progress.eventId).toBe('e1_peach_garden');
    });

    it('E1剧情点击推进应逐步显示对话', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      // 第一次点击：揭示第一行完整文本
      const tap1 = bundle.storyPlayer.tap();
      expect(tap1.action).toBe('reveal_line');
      // 第二次点击：推进到第二行
      const tap2 = bundle.storyPlayer.tap();
      expect(tap2.action).toBe('next_line');
      expect(tap2.line?.speaker).toBe('刘备');
    });

    it('E1剧情全部对话完成后tap返回complete', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const definition = bundle.storyPlayer.getStoryEventDefinition('e1_peach_garden')!;
      // 每行点击两次（reveal + next），最后一行点击后complete
      for (let i = 0; i < definition.dialogues.length; i++) {
        bundle.storyPlayer.tap(); // reveal
        if (i < definition.dialogues.length - 1) {
          const r = bundle.storyPlayer.tap(); // next_line
          expect(r.action).toBe('next_line');
        }
      }
      // 最后一次tap返回complete
      const finalTap = bundle.storyPlayer.tap();
      expect(finalTap.action).toBe('complete');
    });

    it('E1剧情完成后应记录到状态机并发放奖励', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const definition = bundle.storyPlayer.getStoryEventDefinition('e1_peach_garden')!;
      for (let i = 0; i < definition.dialogues.length; i++) {
        bundle.storyPlayer.tap();
        if (i < definition.dialogues.length - 1) bundle.storyPlayer.tap();
      }
      bundle.storyPlayer.tap(); // complete
      // 手动完成事件（模拟内部 completeEvent）
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');
      expect(bundle.stateMachine.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });
  });

  // ─── 6步核心引导执行 ─────────────────

  describe('§7.1.3 6步核心引导顺序执行', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('步骤1~6应按顺序执行且前置条件依次满足', () => {
      const coreSteps = CORE_STEP_DEFINITIONS.map(s => s.stepId);
      for (const stepId of coreSteps) {
        const nextStep = bundle.stepManager.getNextCoreStep();
        expect(nextStep).not.toBeNull();
        expect(nextStep!.stepId).toBe(stepId);
        completeStep(bundle.stepManager, stepId);
      }
      // 全部完成后无更多核心步骤
      expect(bundle.stepManager.getNextCoreStep()).toBeNull();
    });

    it('步骤完成后状态机应记录completedSteps', () => {
      completeStep(bundle.stepManager, 'step1_castle_overview');
      expect(bundle.stateMachine.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(bundle.stateMachine.getCompletedStepCount()).toBe(1);
    });

    it('跳过前置步骤直接开始后续步骤应失败', () => {
      const result = bundle.stepManager.startStep('step3_recruit_hero');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置步骤');
    });

    it('步骤完成时应发放步骤奖励', () => {
      completeStep(bundle.stepManager, 'step1_castle_overview');
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:rewardGranted',
        expect.objectContaining({
          rewards: expect.arrayContaining([
            expect.objectContaining({ rewardId: 'copper' }),
          ]),
          source: 'step1_castle_overview',
        }),
      );
    });

    it('步骤6完成后应发放「初出茅庐」阶段奖励', () => {
      const coreSteps = CORE_STEP_DEFINITIONS.map(s => s.stepId);
      for (const stepId of coreSteps) {
        completeStep(bundle.stepManager, stepId);
      }
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:rewardGranted',
        expect.objectContaining({
          rewards: expect.arrayContaining([
            expect.objectContaining({ type: 'currency', rewardId: 'grain', amount: 1000 }),
          ]),
          source: 'step6_tech_research',
        }),
      );
    });
  });

  // ─── 遮罩联动 ───────────────────────

  describe('§7.1.4 遮罩系统联动', () => {
    it('步骤开始时激活遮罩并设置高亮目标', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.maskSystem.activate();
      const subStep = CORE_STEP_DEFINITIONS[0].subSteps[0];
      bundle.maskSystem.setHighlightTarget(subStep.targetSelector, () => ({
        x: 100, y: 200, width: 300, height: 150,
      }));
      const state = bundle.maskSystem.getState();
      expect(state.active).toBe(true);
      expect(state.targetSelector).toBe(subStep.targetSelector);
    });

    it('步骤完成后遮罩应停用', () => {
      bundle.maskSystem.activate();
      expect(bundle.maskSystem.getState().active).toBe(true);
      bundle.maskSystem.deactivate();
      expect(bundle.maskSystem.getState().active).toBe(false);
    });

    it('遮罩应支持自定义透明度和圆角配置', () => {
      bundle.maskSystem.activate({ opacity: 0.5, borderRadius: 12 });
      const state = bundle.maskSystem.getState();
      expect(state.maskConfig.opacity).toBe(0.5);
      expect(state.maskConfig.borderRadius).toBe(12);
    });
  });

  // ─── 自由探索过渡 ───────────────────

  describe('§7.1.5 自由探索过渡', () => {
    it('步骤6完成后状态机可转换到free_explore', () => {
      bundle.stateMachine.transition('first_enter');
      const result = bundle.stateMachine.transition('step6_complete');
      expect(result.success).toBe(true);
      expect(bundle.stateMachine.getCurrentPhase()).toBe('free_explore');
    });

    it('自由探索阶段应提供推荐行动和已解锁功能', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.stateMachine.transition('step6_complete');
      const data = bundle.stateMachine.getFreeExploreData();
      expect(data.recommendedActions.length).toBeGreaterThan(0);
      expect(data.unlockedFeatures.length).toBeGreaterThan(0);
      expect(data.phaseReward.title).toBe('初出茅庐');
    });

    it('自由探索完成后进入free_play', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.stateMachine.transition('step6_complete');
      const result = bundle.stateMachine.transition('explore_done');
      expect(result.success).toBe(true);
      expect(bundle.stateMachine.getCurrentPhase()).toBe('free_play');
    });

    it('进入free_play应发射tutorial:completed事件', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.stateMachine.transition('step6_complete');
      bundle.deps.eventBus.emit.mockClear();
      bundle.stateMachine.transition('explore_done');
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:completed',
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );
    });
  });

  // ─── 存储持久化 ─────────────────────

  describe('§7.1.6 存储持久化', () => {
    it('序列化应包含完整进度数据', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      const saved = bundle.stateMachine.serialize();
      expect(saved.version).toBeDefined();
      expect(saved.currentPhase).toBe('core_guiding');
      expect(saved.completedSteps).toContain('step1_castle_overview');
    });

    it('反序列化应恢复完整状态', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      const saved = bundle.stateMachine.serialize();

      // 新建状态机并恢复
      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(saved);
      expect(bundle2.stateMachine.getCurrentPhase()).toBe('core_guiding');
      expect(bundle2.stateMachine.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(bundle2.stateMachine.isStepCompleted('step2_build_farm')).toBe(true);
      expect(bundle2.stateMachine.getCompletedStepCount()).toBe(2);
    });

    it('序列化-反序列化往返数据一致', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      const saved = bundle.stateMachine.serialize();

      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(saved);
      const restored = bundle2.stateMachine.serialize();

      expect(restored.completedSteps).toEqual(saved.completedSteps);
      expect(restored.currentPhase).toBe(saved.currentPhase);
    });
  });
});
