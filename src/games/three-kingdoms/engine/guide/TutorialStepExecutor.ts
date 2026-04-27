/**
 * 引擎层 — 引导步骤执行器
 *
 * 管理引导步骤的加速机制、不可跳过检测、重玩功能和触发条件评估：
 *   #10 加速机制 — 4种加速方式
 *   #11 不可跳过内容 — 强制步骤
 *   #13 引导重玩 — 观看模式+奖励
 *   #7  扩展引导触发检测
 *
 * 从 TutorialStepManager 中拆分，保持单一职责。
 *
 * @module engine/guide/TutorialStepExecutor
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TutorialStepId,
  TutorialStepDefinition,
  TutorialReward,
  TutorialStepTriggerCondition,
  ReplayMode,
} from '../../core/guide';
import {
  UNSKIPPABLE_STEPS,
  ANIMATION_SPEED_MULTIPLIER,
  GUIDE_REPLAY_DAILY_LIMIT,
  GUIDE_REPLAY_REWARD,
  EXTENDED_STEP_DEFINITIONS,
} from '../../core/guide';
import type { TutorialStateMachine } from './TutorialStateMachine';
import type { AccelerationState, TutorialGameState } from './TutorialStepManager';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 步骤执行器所需的内部状态切片 */
export interface StepExecutorStateSlice {
  activeStepId: TutorialStepId | null;
  currentSubStepIndex: number;
  acceleration: AccelerationState | null;
  dailyReplayCount: number;
  lastReplayDate: string;
  replayMode: ReplayMode | null;
}

// ─────────────────────────────────────────────
// TutorialStepExecutor 类
// ─────────────────────────────────────────────

/**
 * 引导步骤执行器
 *
 * 管理加速机制、不可跳过检测、重玩功能和触发条件评估。
 * 通过共享状态切片与 TutorialStepManager 协作。
 */
export class TutorialStepExecutor implements ISubsystem {
  readonly name = 'TutorialStepExecutor' as const;

  private deps!: ISystemDeps;
  private _stateMachine: TutorialStateMachine | null = null;

  // ─── 依赖注入 ───────────────────────────

  /** 注入系统依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 注入状态机 */
  setStateMachine(sm: TutorialStateMachine): void {
    this._stateMachine = sm;
  }

  // ─── ISubsystem 接口实现 ──────────────────

  /** 每帧更新（步骤执行器无帧级逻辑，保留空实现） */
  update(_dt: number): void {
    // 步骤执行器由 TutorialStepManager 驱动，无需帧级更新
  }

  /** 获取状态快照（步骤执行器为无状态服务，返回空对象） */
  getState(): Record<string, never> {
    return {};
  }

  /** 重置（步骤执行器无内部状态，无需重置） */
  reset(): void {
    // 步骤执行器通过共享状态切片工作，重置由 TutorialStepManager 管理
  }

  // ─── 加速机制 API (#10) ───────────────────

  /**
   * 触发加速
   */
  activateAcceleration(
    state: StepExecutorStateSlice,
    type: AccelerationState['type'],
  ): { success: boolean; reason?: string } {
    const stepId = state.activeStepId;
    if (!stepId) {
      return { success: false, reason: '没有正在进行的步骤' };
    }

    // 检查是否不可跳过 (#11)
    if (this.isUnskippable(stepId)) {
      if (type === 'story_skip' || type === 'quick_complete') {
        return { success: false, reason: '当前步骤不可跳过' };
      }
    }

    const multiplier = type === 'animation_speed' ? ANIMATION_SPEED_MULTIPLIER : 1;

    state.acceleration = {
      active: true,
      type,
      multiplier,
    };

    this.deps.eventBus.emit('tutorial:accelerated', { type });

    return { success: true };
  }

  /**
   * 取消加速
   */
  deactivateAcceleration(state: StepExecutorStateSlice): void {
    state.acceleration = null;
  }

  /**
   * 获取当前加速状态
   */
  getAccelerationState(state: StepExecutorStateSlice): AccelerationState | null {
    return state.acceleration;
  }

  // ─── 不可跳过检测 (#11) ───────────────────

  /**
   * 检查步骤是否不可跳过
   */
  isUnskippable(stepId: TutorialStepId): boolean {
    return UNSKIPPABLE_STEPS.includes(stepId);
  }

  /**
   * 检查当前子步骤是否不可跳过
   */
  isCurrentSubStepUnskippable(
    state: StepExecutorStateSlice,
    getSubStep: (stepId: TutorialStepId, index: number) => { unskippable?: boolean } | undefined,
  ): boolean {
    const stepId = state.activeStepId;
    if (!stepId) return false;

    const subStep = getSubStep(stepId, state.currentSubStepIndex);
    return subStep?.unskippable ?? false;
  }

  // ─── 扩展引导触发检测 (#7) ───────────────

  /**
   * 检查扩展引导是否应该触发
   */
  checkExtendedStepTriggers(gameState: TutorialGameState): TutorialStepDefinition | null {
    if (!this._stateMachine) return null;
    for (const step of EXTENDED_STEP_DEFINITIONS) {
      if (this._stateMachine.isStepCompleted(step.stepId)) continue;
      if (!step.triggerCondition) continue;

      if (this.evaluateTriggerCondition(step.triggerCondition, gameState)) {
        return step;
      }
    }
    return null;
  }

  // ─── 引导重玩 API (#13) ───────────────────

  /**
   * 开始重玩
   */
  startReplay(state: StepExecutorStateSlice, mode: ReplayMode): { success: boolean; reason?: string } {
    // 检查每日限制
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastReplayDate !== today) {
      state.dailyReplayCount = 0;
      state.lastReplayDate = today;
    }

    if (state.dailyReplayCount >= GUIDE_REPLAY_DAILY_LIMIT) {
      return { success: false, reason: '今日重玩次数已达上限' };
    }

    state.replayMode = mode;
    state.dailyReplayCount++;

    return { success: true };
  }

  /**
   * 结束重玩
   */
  endReplay(state: StepExecutorStateSlice): TutorialReward | null {
    const wasReplaying = state.replayMode !== null;
    state.replayMode = null;
    state.activeStepId = null;
    state.currentSubStepIndex = 0;

    if (wasReplaying) {
      // 发放重玩奖励
      this.deps.eventBus.emit('tutorial:rewardGranted', {
        rewards: [GUIDE_REPLAY_REWARD],
        source: 'replay',
      });
      return GUIDE_REPLAY_REWARD;
    }
    return null;
  }

  /**
   * 获取今日剩余重玩次数
   */
  getRemainingReplayCount(state: StepExecutorStateSlice): number {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastReplayDate !== today) {
      return GUIDE_REPLAY_DAILY_LIMIT;
    }
    return GUIDE_REPLAY_DAILY_LIMIT - state.dailyReplayCount;
  }

  /**
   * 是否处于重玩模式
   */
  isReplaying(state: StepExecutorStateSlice): boolean {
    return state.replayMode !== null;
  }

  // ─── 内部方法 ───────────────────────────

  /** 评估触发条件 */
  private evaluateTriggerCondition(
    condition: TutorialStepTriggerCondition,
    gameState: TutorialGameState,
  ): boolean {
    switch (condition.type) {
      case 'building_level':
        return gameState.castleLevel >= Number(condition.value);
      case 'hero_count':
        return gameState.heroCount >= Number(condition.value);
      case 'battle_count':
        return gameState.battleCount >= Number(condition.value);
      case 'tech_count':
        return gameState.techCount >= Number(condition.value);
      case 'alliance_joined':
        return gameState.allianceJoined;
      default:
        return false;
    }
  }
}
