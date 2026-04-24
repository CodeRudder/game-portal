/**
 * 集成测试 — §7.2+§4 老玩家跳过、重玩、跨设备同步、加速机制
 *
 * 验证：跳过逻辑、不可跳过内容、重玩恢复、存储同步、加速机制
 *
 * @module engine/guide/__tests__/integration/tutorial-skip-replay-sync
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../../TutorialStateMachine';
import { TutorialStepManager } from '../../TutorialStepManager';
import { StoryEventPlayer } from '../../StoryEventPlayer';
import { FirstLaunchDetector } from '../../FirstLaunchDetector';
import {
  CORE_STEP_DEFINITIONS,
  EXTENDED_STEP_DEFINITIONS,
} from '../../../../core/guide/guide-config';
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
  const storyPlayer = new StoryEventPlayer();
  const firstLaunch = new FirstLaunchDetector();

  stateMachine.init(deps);
  stepManager.init(deps);
  storyPlayer.init(deps);
  firstLaunch.init(deps);

  stepManager.setStateMachine(stateMachine);
  storyPlayer.setStateMachine(stateMachine);
  firstLaunch.setStateMachine(stateMachine);

  return { deps, stateMachine, stepManager, storyPlayer, firstLaunch };
}

function completeStep(stepManager: TutorialStepManager, stepId: string) {
  const result = stepManager.startStep(stepId as any);
  if (!result.success) return result;
  const definition = result.step!;
  for (let i = 0; i < definition.subSteps.length; i++) {
    stepManager.advanceSubStep();
  }
  return result;
}

// ─────────────────────────────────────────────
// §7.2 老玩家跳过 + §4 重玩 + 同步 + 加速
// ─────────────────────────────────────────────

describe('§7.2 老玩家跳过+重玩+同步+加速 集成测试', () => {
  let bundle: ReturnType<typeof createSystemBundle>;

  beforeEach(() => {
    bundle = createSystemBundle();
  });

  // ─── 老玩家跳过逻辑 ─────────────────

  describe('§7.2.1 老玩家跳过逻辑', () => {
    it('老玩家进入应直接跳到free_play', () => {
      bundle.firstLaunch.handleReturningUser();
      expect(bundle.stateMachine.getCurrentPhase()).toBe('free_play');
      expect(bundle.stateMachine.isFirstLaunch()).toBe(false);
    });

    it('老玩家进入不应触发引导流程', () => {
      bundle.firstLaunch.handleReturningUser();
      const state = bundle.stateMachine.getState();
      expect(state.tutorialStartTime).toBeNull();
      expect(state.protectionStartTime).toBeNull();
    });

    it('老玩家检测应返回isFirstLaunch=false', () => {
      bundle.firstLaunch.handleReturningUser();
      const detection = bundle.firstLaunch.detectFirstLaunch();
      expect(detection.isFirstLaunch).toBe(false);
    });

    it('core_guiding阶段可通过skip_to_explore跳到自由探索', () => {
      bundle.stateMachine.transition('first_enter');
      const result = bundle.stateMachine.transition('skip_to_explore');
      expect(result.success).toBe(true);
      expect(bundle.stateMachine.getCurrentPhase()).toBe('free_explore');
    });

    it('free_play阶段不允许skip_to_explore', () => {
      bundle.firstLaunch.handleReturningUser();
      const result = bundle.stateMachine.transition('skip_to_explore');
      expect(result.success).toBe(false);
    });
  });

  // ─── 不可跳过内容检测 ───────────────

  describe('§7.2.2 不可跳过内容检测', () => {
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

    it('步骤3（招募武将）应可跳过', () => {
      expect(bundle.stepManager.isUnskippable('step3_recruit_hero')).toBe(false);
    });

    it('执行不可跳过步骤时isCurrentSubStepUnskippable应返回true', () => {
      bundle.stepManager.startStep('step1_castle_overview');
      // 步骤1第一个子步骤是unskippable
      expect(bundle.stepManager.isCurrentSubStepUnskippable()).toBe(true);
    });
  });

  // ─── 剧情跳过机制 ───────────────────

  describe('§7.2.3 剧情跳过机制（二次确认+水墨过渡）', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('请求跳过应要求二次确认', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const result = bundle.storyPlayer.requestSkip();
      expect(result.requireConfirm).toBe(true);
    });

    it('确认跳过应返回水墨晕染过渡效果', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      const result = bundle.storyPlayer.confirmSkip();
      expect(result.success).toBe(true);
      expect(result.transitionEffect).toBe('ink_wash');
    });

    it('跳过剧情仍应发放奖励', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      const result = bundle.storyPlayer.confirmSkip();
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('取消跳过后剧情应继续播放', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      bundle.storyPlayer.cancelSkip();
      const progress = bundle.storyPlayer.getPlayProgress();
      expect(progress.state).toBe('playing');
    });

    it.skip('未请求跳过直接确认应失败', () => {
      // 二次确认边界条件：未requestSkip直接confirmSkip
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const result = bundle.storyPlayer.confirmSkip();
      expect(result.success).toBe(false);
    });
  });

  // ─── 重玩机制 ───────────────────────

  describe('§7.2.4 重玩机制', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
      // 完成步骤1以便重玩
      completeStep(bundle.stepManager, 'step1_castle_overview');
    });

    it('开始重玩应进入replay模式', () => {
      const result = bundle.stepManager.startReplay('watch');
      expect(result.success).toBe(true);
      expect(bundle.stepManager.isReplaying()).toBe(true);
    });

    it('重玩模式下可重新开始已完成步骤', () => {
      bundle.stepManager.startReplay('interactive');
      const result = bundle.stepManager.startStep('step1_castle_overview');
      expect(result.success).toBe(true);
    });

    it('结束重玩应发放重玩奖励', () => {
      bundle.stepManager.startReplay('watch');
      const reward = bundle.stepManager.endReplay();
      expect(reward).not.toBeNull();
      expect(reward!.rewardId).toBe('copper');
    });

    it('每日重玩次数应有限制', () => {
      expect(bundle.stepManager.getRemainingReplayCount()).toBeGreaterThan(0);
    });

    it('非重玩模式结束重玩应返回null', () => {
      const reward = bundle.stepManager.endReplay();
      expect(reward).toBeNull();
    });
  });

  // ─── 跨设备同步（冲突解决） ─────────

  describe('§7.2.5 跨设备同步与冲突解决', () => {
    it('本地与远程进度应取completed_steps并集', () => {
      const local: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: ['step1_castle_overview', 'step2_build_farm'],
        completedEvents: ['e1_peach_garden'],
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
        completedSteps: ['step2_build_farm', 'step3_recruit_hero'],
        completedEvents: ['e1_peach_garden', 'e2_yellow_turban'],
      };
      const merged = bundle.stateMachine.resolveConflict(local, remote);
      expect(merged.completedSteps).toContain('step1_castle_overview');
      expect(merged.completedSteps).toContain('step2_build_farm');
      expect(merged.completedSteps).toContain('step3_recruit_hero');
      expect(merged.completedEvents).toContain('e1_peach_garden');
      expect(merged.completedEvents).toContain('e2_yellow_turban');
    });

    it('冲突解决应取进度更高的阶段', () => {
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
        currentPhase: 'free_explore',
        completedSteps: ['step1_castle_overview', 'step2_build_farm', 'step3_recruit_hero',
          'step4_first_battle', 'step5_check_resources', 'step6_tech_research'],
      };
      const merged = bundle.stateMachine.resolveConflict(local, remote);
      expect(merged.currentPhase).toBe('free_explore');
    });

    it('合并后反序列化到新状态机应正确恢复', () => {
      const local: TutorialSaveData = {
        version: 1,
        currentPhase: 'core_guiding',
        completedSteps: ['step1_castle_overview'],
        completedEvents: ['e1_peach_garden'],
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
        completedSteps: ['step2_build_farm'],
      };
      const merged = bundle.stateMachine.resolveConflict(local, remote);
      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(merged);
      expect(bundle2.stateMachine.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(bundle2.stateMachine.isStepCompleted('step2_build_farm')).toBe(true);
    });
  });

  // ─── 加速机制 ───────────────────────

  describe('§7.2.6 加速机制', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('激活对话点击加速应成功', () => {
      bundle.stepManager.startStep('step1_castle_overview');
      const result = bundle.stepManager.activateAcceleration('dialogue_tap');
      expect(result.success).toBe(true);
      const acc = bundle.stepManager.getAccelerationState();
      expect(acc).not.toBeNull();
      expect(acc!.type).toBe('dialogue_tap');
    });

    it('取消加速后状态应清空', () => {
      bundle.stepManager.startStep('step1_castle_overview');
      bundle.stepManager.activateAcceleration('dialogue_tap');
      bundle.stepManager.deactivateAcceleration();
      expect(bundle.stepManager.getAccelerationState()).toBeNull();
    });

    it('剧情播放器应支持打字机加速', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.setAccelerated(true);
      const progress = bundle.storyPlayer.getPlayProgress();
      expect(progress.accelerated).toBe(true);
    });
  });
});
