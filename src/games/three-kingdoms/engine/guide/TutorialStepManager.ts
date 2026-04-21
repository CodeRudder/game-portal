/**
 * 引擎层 — 引导步骤管理器
 *
 * 管理6+6引导步骤的定义、执行、完成判定和奖励发放：
 *   #2  6步核心引导 — 主城概览/建造农田/招募武将/首次出征/查看资源/科技研究
 *   #3  6步扩展引导 — 军师建议/半自动战斗/借将系统/背包管理/科技分支/联盟系统
 *   #4  阶段奖励 — 步骤6「初出茅庐」礼包+步骤12「新手毕业」称号+中间奖励
 *
 * 加速机制(#10)、不可跳过检测(#11)、重玩机制(#13)、触发条件评估(#7)
 * 已拆分至 TutorialStepExecutor。
 *
 * @module engine/guide/TutorialStepManager
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TutorialStepId,
  TutorialStepDefinition,
  TutorialSubStep,
  TutorialReward,
  ReplayMode,
} from '../../core/guide';
import {
  QUICK_COMPLETE_THRESHOLD_MS,
  GUIDE_REPLAY_DAILY_LIMIT,
  CORE_STEP_DEFINITIONS,
  EXTENDED_STEP_DEFINITIONS,
  ALL_STEP_DEFINITIONS,
  STEP_DEFINITION_MAP,
  TUTORIAL_PHASE_REWARDS,
} from '../../core/guide';
import type { TutorialStateMachine } from './TutorialStateMachine';
import { TutorialStepExecutor } from './TutorialStepExecutor';
import type { StepExecutorStateSlice } from './TutorialStepExecutor';

// ─────────────────────────────────────────────
// 类型定义（公共导出）
// ─────────────────────────────────────────────

/** 游戏状态条件（用于触发条件检测） */
export interface TutorialGameState {
  castleLevel: number;
  heroCount: number;
  battleCount: number;
  techCount: number;
  allianceJoined: boolean;
}

/** 加速状态 */
export interface AccelerationState {
  active: boolean;
  type: 'dialogue_tap' | 'story_skip' | 'animation_speed' | 'quick_complete';
  multiplier: number;
}

/** 步骤执行结果 */
export interface StepExecutionResult {
  completed: boolean;
  stepId: TutorialStepId;
  subStepIndex: number;
  rewards: TutorialReward[];
}

// ─────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────

/** 步骤管理器内部状态 */
interface StepManagerInternalState {
  activeStepId: TutorialStepId | null;
  currentSubStepIndex: number;
  stepStartTime: number | null;
  acceleration: AccelerationState | null;
  dailyReplayCount: number;
  lastReplayDate: string;
  replayMode: ReplayMode | null;
}

// ─────────────────────────────────────────────
// TutorialStepManager 类
// ─────────────────────────────────────────────

/**
 * 引导步骤管理器
 *
 * 管理引导步骤的执行、完成判定和奖励发放。
 * 加速、不可跳过检测和重玩功能委托给 TutorialStepExecutor。
 */
export class TutorialStepManager implements ISubsystem {
  readonly name = 'tutorial-steps';

  private deps!: ISystemDeps;
  private _stateMachine!: TutorialStateMachine;
  private state: StepManagerInternalState = this.createInitialState();

  /** 步骤执行器 — 加速/不可跳过/重玩/触发检测 */
  readonly executor = new TutorialStepExecutor();

  // ─── 依赖注入 ───────────────────────────

  /** 注入状态机（由引擎引导模块在 init 之后调用） */
  setStateMachine(sm: TutorialStateMachine): void {
    this._stateMachine = sm;
    this.executor.setStateMachine(sm);
  }

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.executor.init(deps);
  }

  update(dt: number): void {
    this.checkQuickComplete();
  }

  getState(): StepManagerInternalState {
    return { ...this.state };
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  // ─── 步骤执行 API (#2, #3) ───────────────

  /** 获取下一个应该执行的步骤 */
  getNextStep(): TutorialStepDefinition | null {
    for (const step of CORE_STEP_DEFINITIONS) {
      if (!this._stateMachine.isStepCompleted(step.stepId)) {
        if (step.prerequisite && !this._stateMachine.isStepCompleted(step.prerequisite)) {
          continue;
        }
        return step;
      }
    }
    for (const step of EXTENDED_STEP_DEFINITIONS) {
      if (!this._stateMachine.isStepCompleted(step.stepId)) {
        return step;
      }
    }
    return null;
  }

  /** 获取下一个核心步骤 */
  getNextCoreStep(): TutorialStepDefinition | null {
    for (const step of CORE_STEP_DEFINITIONS) {
      if (!this._stateMachine.isStepCompleted(step.stepId)) {
        if (step.prerequisite && !this._stateMachine.isStepCompleted(step.prerequisite)) {
          continue;
        }
        return step;
      }
    }
    return null;
  }

  /** 开始执行一个步骤 */
  startStep(stepId: TutorialStepId): { success: boolean; reason?: string; step?: TutorialStepDefinition } {
    const definition = STEP_DEFINITION_MAP[stepId];
    if (!definition) {
      return { success: false, reason: `步骤 ${stepId} 不存在` };
    }
    if (definition.prerequisite && !this._stateMachine.isStepCompleted(definition.prerequisite)) {
      return { success: false, reason: `前置步骤 ${definition.prerequisite} 未完成` };
    }
    if (this._stateMachine.isStepCompleted(stepId) && !this.state.replayMode) {
      return { success: false, reason: `步骤 ${stepId} 已完成` };
    }

    this.state.activeStepId = stepId;
    this.state.currentSubStepIndex = 0;
    this.state.stepStartTime = Date.now();
    this.state.acceleration = null;
    this._stateMachine.setCurrentStep(stepId, 0);

    return { success: true, step: definition };
  }

  /** 完成当前子步骤，推进到下一个 */
  advanceSubStep(): StepExecutionResult {
    const stepId = this.state.activeStepId;
    if (!stepId) {
      return { completed: false, stepId: '' as TutorialStepId, subStepIndex: 0, rewards: [] };
    }
    const definition = STEP_DEFINITION_MAP[stepId];
    if (!definition) {
      return { completed: false, stepId, subStepIndex: 0, rewards: [] };
    }

    const totalSubSteps = definition.subSteps.length;
    const result = this._stateMachine.advanceSubStep(totalSubSteps);

    if (result.completed) {
      return this.completeCurrentStep();
    }

    this.state.currentSubStepIndex = result.newIndex;
    return { completed: false, stepId, subStepIndex: result.newIndex, rewards: [] };
  }

  /** 完成当前步骤 */
  completeCurrentStep(): StepExecutionResult {
    const stepId = this.state.activeStepId;
    if (!stepId) {
      return { completed: false, stepId: '' as TutorialStepId, subStepIndex: 0, rewards: [] };
    }

    const definition = STEP_DEFINITION_MAP[stepId];

    if (!this.state.replayMode) {
      this._stateMachine.completeStep(stepId);
    }

    const rewards = [...definition.rewards];
    const phaseReward = TUTORIAL_PHASE_REWARDS.find(r => r.triggerStepId === stepId);
    if (phaseReward) {
      rewards.push(...phaseReward.rewards);
    }

    if (rewards.length > 0) {
      this.deps.eventBus.emit('tutorial:rewardGranted', { rewards, source: stepId });
    }

    this.state.activeStepId = null;
    this.state.currentSubStepIndex = 0;
    this.state.stepStartTime = null;
    this.state.acceleration = null;

    return { completed: true, stepId, subStepIndex: definition.subSteps.length - 1, rewards };
  }

  // ─── 委托方法：加速/不可跳过/重玩/触发检测 ──

  /** 触发加速（委托给 executor） */
  activateAcceleration(type: AccelerationState['type']): { success: boolean; reason?: string } {
    return this.executor.activateAcceleration(this.state, type);
  }

  /** 取消加速 */
  deactivateAcceleration(): void {
    this.executor.deactivateAcceleration(this.state);
  }

  /** 获取当前加速状态 */
  getAccelerationState(): AccelerationState | null {
    return this.executor.getAccelerationState(this.state);
  }

  /** 检查步骤是否不可跳过 */
  isUnskippable(stepId: TutorialStepId): boolean {
    return this.executor.isUnskippable(stepId);
  }

  /** 检查当前子步骤是否不可跳过 */
  isCurrentSubStepUnskippable(): boolean {
    return this.executor.isCurrentSubStepUnskippable(this.state, (stepId, index) => {
      const def = STEP_DEFINITION_MAP[stepId];
      return def?.subSteps[index];
    });
  }

  /** 检查扩展引导是否应该触发 */
  checkExtendedStepTriggers(gameState: TutorialGameState): TutorialStepDefinition | null {
    return this.executor.checkExtendedStepTriggers(gameState);
  }

  /** 开始重玩 */
  startReplay(mode: ReplayMode): { success: boolean; reason?: string } {
    return this.executor.startReplay(this.state, mode);
  }

  /** 结束重玩 */
  endReplay(): TutorialReward | null {
    return this.executor.endReplay(this.state);
  }

  /** 获取今日剩余重玩次数 */
  getRemainingReplayCount(): number {
    return this.executor.getRemainingReplayCount(this.state);
  }

  /** 是否处于重玩模式 */
  isReplaying(): boolean {
    return this.executor.isReplaying(this.state);
  }

  // ─── 查询 API ───────────────────────────

  /** 获取当前子步骤 */
  getCurrentSubStep(): TutorialSubStep | null {
    const stepId = this.state.activeStepId;
    if (!stepId) return null;
    const definition = STEP_DEFINITION_MAP[stepId];
    if (!definition) return null;
    return definition.subSteps[this.state.currentSubStepIndex] ?? null;
  }

  /** 获取步骤定义 */
  getStepDefinition(stepId: TutorialStepId): TutorialStepDefinition | null {
    return STEP_DEFINITION_MAP[stepId] ?? null;
  }

  /** 获取所有步骤定义 */
  getAllStepDefinitions(): TutorialStepDefinition[] {
    return ALL_STEP_DEFINITIONS;
  }

  /** 获取核心步骤定义列表 */
  getCoreStepDefinitions(): TutorialStepDefinition[] {
    return CORE_STEP_DEFINITIONS;
  }

  /** 获取扩展步骤定义列表 */
  getExtendedStepDefinitions(): TutorialStepDefinition[] {
    return EXTENDED_STEP_DEFINITIONS;
  }

  /** 获取阶段奖励配置 */
  getPhaseRewards() {
    return TUTORIAL_PHASE_REWARDS;
  }

  // ─── 内部方法 ───────────────────────────

  private createInitialState(): StepManagerInternalState {
    return {
      activeStepId: null,
      currentSubStepIndex: 0,
      stepStartTime: null,
      acceleration: null,
      dailyReplayCount: 0,
      lastReplayDate: '',
      replayMode: null,
    };
  }

  private checkQuickComplete(): void {
    if (!this.state.stepStartTime || !this.state.activeStepId) return;
    if (this.state.acceleration) return;
    const elapsed = Date.now() - this.state.stepStartTime;
    if (elapsed >= QUICK_COMPLETE_THRESHOLD_MS) {
      // UI层会检测并显示「快速完成」按钮
    }
  }
}
