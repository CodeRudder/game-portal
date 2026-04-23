import { vi } from 'vitest';
/**
 * TutorialStepExecutor 单元测试
 * 覆盖：#10 加速机制、#11 不可跳过内容、#13 引导重玩
 */

import type { ISystemDeps } from '../../../core/types';
import { TutorialStepExecutor } from '../TutorialStepExecutor';
import type { StepExecutorStateSlice } from '../TutorialStepExecutor';
import { TutorialStepManager } from '../TutorialStepManager';
import { TutorialStateMachine } from '../TutorialStateMachine';

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 创建测试用的 state slice */
function createStateSlice(overrides?: Partial<StepExecutorStateSlice>): StepExecutorStateSlice {
  return {
    activeStepId: null,
    currentSubStepIndex: 0,
    acceleration: null,
    dailyReplayCount: 0,
    lastReplayDate: '',
    replayMode: null,
    ...overrides,
  };
}

describe('TutorialStepExecutor', () => {
  let executor: TutorialStepExecutor;
  let sm: TutorialStateMachine;
  let deps: ISystemDeps;

  beforeEach(() => {
    vi.restoreAllMocks();
    executor = new TutorialStepExecutor();
    sm = new TutorialStateMachine();
    deps = mockDeps();

    sm.init(deps);
    executor.init(deps);
    executor.setStateMachine(sm);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 加速机制 (#10)
  // ═══════════════════════════════════════════
  describe('加速机制', () => {
    it('对话点击加速', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview' });
      const result = executor.activateAcceleration(state, 'dialogue_tap');
      expect(result.success).toBe(true);
      expect(state.acceleration).not.toBeNull();
      expect(state.acceleration!.type).toBe('dialogue_tap');
    });

    it('动画加速设置×3倍率', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview' });
      const result = executor.activateAcceleration(state, 'animation_speed');
      expect(result.success).toBe(true);
      expect(state.acceleration!.multiplier).toBe(3);
    });

    it('一键完成加速', () => {
      const state = createStateSlice({ activeStepId: 'step5_check_resources' });
      const result = executor.activateAcceleration(state, 'quick_complete');
      expect(result.success).toBe(true);
    });

    it('没有活跃步骤时加速失败', () => {
      const state = createStateSlice();
      const result = executor.activateAcceleration(state, 'dialogue_tap');
      expect(result.success).toBe(false);
    });

    it('加速发射 accelerated 事件', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview' });
      executor.activateAcceleration(state, 'animation_speed');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:accelerated',
        expect.objectContaining({ type: 'animation_speed' }),
      );
    });

    it('取消加速', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview' });
      executor.activateAcceleration(state, 'dialogue_tap');
      executor.deactivateAcceleration(state);
      expect(state.acceleration).toBeNull();
    });

    it('获取加速状态', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview' });
      expect(executor.getAccelerationState(state)).toBeNull();
      executor.activateAcceleration(state, 'dialogue_tap');
      expect(executor.getAccelerationState(state)).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 不可跳过检测 (#11)
  // ═══════════════════════════════════════════
  describe('不可跳过检测', () => {
    it('步骤1-1主城概览不可跳过', () => {
      expect(executor.isUnskippable('step1_castle_overview')).toBe(true);
    });

    it('步骤2-3确认建造不可跳过', () => {
      expect(executor.isUnskippable('step2_build_farm')).toBe(true);
    });

    it('步骤4-4首次战斗不可跳过', () => {
      expect(executor.isUnskippable('step4_first_battle')).toBe(true);
    });

    it('其他步骤可跳过', () => {
      expect(executor.isUnskippable('step3_recruit_hero')).toBe(false);
      expect(executor.isUnskippable('step5_check_resources')).toBe(false);
      expect(executor.isUnskippable('step6_tech_research')).toBe(false);
    });

    it('不可跳过步骤禁止 story_skip 加速', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview' });
      const result = executor.activateAcceleration(state, 'story_skip');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不可跳过');
    });

    it('不可跳过步骤禁止 quick_complete 加速', () => {
      const state = createStateSlice({ activeStepId: 'step4_first_battle' });
      const result = executor.activateAcceleration(state, 'quick_complete');
      expect(result.success).toBe(false);
    });

    it('不可跳过步骤允许 dialogue_tap 加速', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview' });
      const result = executor.activateAcceleration(state, 'dialogue_tap');
      expect(result.success).toBe(true);
    });

    it('不可跳过步骤允许 animation_speed 加速', () => {
      const state = createStateSlice({ activeStepId: 'step2_build_farm' });
      const result = executor.activateAcceleration(state, 'animation_speed');
      expect(result.success).toBe(true);
    });

    it('子步骤不可跳过检测', () => {
      const state = createStateSlice({ activeStepId: 'step1_castle_overview', currentSubStepIndex: 0 });
      const result = executor.isCurrentSubStepUnskippable(state, (stepId, index) => {
        if (stepId === 'step1_castle_overview' && index === 0) {
          return { unskippable: true };
        }
        return undefined;
      });
      expect(result).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 引导重玩 (#13)
  // ═══════════════════════════════════════════
  describe('引导重玩', () => {
    it('开始重玩', () => {
      const state = createStateSlice();
      const result = executor.startReplay(state, 'watch');
      expect(result.success).toBe(true);
      expect(state.replayMode).toBe('watch');
    });

    it('重玩增加每日计数', () => {
      const state = createStateSlice();
      executor.startReplay(state, 'watch');
      expect(state.dailyReplayCount).toBe(1);
    });

    it('每日最多重玩3次', () => {
      const state = createStateSlice();
      for (let i = 0; i < 3; i++) {
        executor.startReplay(state, 'watch');
        executor.endReplay(state);
      }
      const result = executor.startReplay(state, 'watch');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('上限');
    });

    it('跨日重置重玩次数', () => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = '2020-01-01';
      const state = createStateSlice({ dailyReplayCount: 3, lastReplayDate: yesterday });
      const result = executor.startReplay(state, 'watch');
      expect(result.success).toBe(true);
      expect(state.dailyReplayCount).toBe(1);
      expect(state.lastReplayDate).toBe(today);
    });

    it('结束重玩发放奖励', () => {
      const state = createStateSlice();
      executor.startReplay(state, 'watch');
      const reward = executor.endReplay(state);
      expect(reward).not.toBeNull();
      expect(reward!.rewardId).toBe('copper');
      expect(reward!.amount).toBe(100);
    });

    it('结束重玩发射奖励事件', () => {
      const state = createStateSlice();
      executor.startReplay(state, 'watch');
      executor.endReplay(state);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:rewardGranted',
        expect.objectContaining({
          rewards: expect.arrayContaining([
            expect.objectContaining({ rewardId: 'copper', amount: 100 }),
          ]),
        }),
      );
    });

    it('获取剩余重玩次数', () => {
      const state = createStateSlice();
      expect(executor.getRemainingReplayCount(state)).toBe(3);
      executor.startReplay(state, 'watch');
      expect(executor.getRemainingReplayCount(state)).toBe(2);
    });

    it('是否处于重玩模式', () => {
      const state = createStateSlice();
      expect(executor.isReplaying(state)).toBe(false);
      executor.startReplay(state, 'interactive');
      expect(executor.isReplaying(state)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 通过 TutorialStepManager 委托测试
  // ═══════════════════════════════════════════
  describe('TutorialStepManager 委托', () => {
    let stepMgr: TutorialStepManager;

    beforeEach(() => {
      stepMgr = new TutorialStepManager();
      stepMgr.init(deps);
      stepMgr.setStateMachine(sm);
    });

    it('通过 stepManager 委托加速', () => {
      stepMgr.startStep('step1_castle_overview');
      const result = stepMgr.activateAcceleration('dialogue_tap');
      expect(result.success).toBe(true);
    });

    it('通过 stepManager 委托不可跳过检测', () => {
      expect(stepMgr.isUnskippable('step1_castle_overview')).toBe(true);
    });

    it('通过 stepManager 委托重玩', () => {
      const result = stepMgr.startReplay('watch');
      expect(result.success).toBe(true);
      expect(stepMgr.isReplaying()).toBe(true);
    });

    it('通过 stepManager 结束重玩', () => {
      stepMgr.startReplay('watch');
      const reward = stepMgr.endReplay();
      expect(reward).not.toBeNull();
      expect(stepMgr.isReplaying()).toBe(false);
    });

    it('通过 stepManager 获取剩余重玩次数', () => {
      expect(stepMgr.getRemainingReplayCount()).toBe(3);
    });
  });
});
