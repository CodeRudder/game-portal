/**
 * 引擎层 — 引导状态机
 *
 * 管理新手引导的5个状态及其转换规则：
 *   #1 引导状态机 — 未开始→核心引导中→自由探索过渡→自由游戏→Mini-tutorial
 *   #8 引导进度存储 — 实时保存
 *   #9 冲突解决 — 取completed_steps并集
 *   #14 自由探索过渡 — 推荐行动+已解锁功能
 *
 * @module engine/guide/TutorialStateMachine
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TutorialPhase,
  TutorialTransition,
  TutorialTransitionLog,
  TutorialStepId,
  StoryEventId,
  TutorialSaveData,
  FreeExploreData,
  RecommendedAction,
  UnlockedFeature,
  TutorialReward,
} from '../../core/guide';
import {
  TUTORIAL_SAVE_VERSION,
  DEFAULT_RECOMMENDED_ACTIONS,
  TUTORIAL_PHASE_REWARDS,
  NEWBIE_PROTECTION_DURATION_MS,
} from '../../core/guide';
import {
  VALID_TRANSITIONS,
  TRANSITION_TARGETS,
  type TutorialStateMachineState,
} from './TutorialTransitions';

// ─────────────────────────────────────────────
// TutorialStateMachine 类
// ─────────────────────────────────────────────

/**
 * 引导状态机
 *
 * 管理引导的5个状态和转换逻辑，跟踪完成进度。
 */
export class TutorialStateMachine implements ISubsystem {
  readonly name = 'tutorial-state';

  private deps!: ISystemDeps;
  private state: TutorialStateMachineState = this.createInitialState();

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 检查新手保护是否过期
    this.checkProtectionExpiry();
  }

  getState(): TutorialStateMachineState {
    return { ...this.state };
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  // ─── 状态转换 API (#1) ───────────────────

  /**
   * 尝试状态转换
   *
   * @param event - 转换事件
   * @returns 转换是否成功
   */
  transition(event: TutorialTransition): { success: boolean; reason?: string } {
    const currentPhase = this.state.currentPhase;
    const allowedTransitions = VALID_TRANSITIONS[currentPhase];

    if (!allowedTransitions.includes(event)) {
      return {
        success: false,
        reason: `状态 ${currentPhase} 不允许通过事件 ${event} 转换`,
      };
    }

    const targetPhase = TRANSITION_TARGETS[event];
    const log: TutorialTransitionLog = {
      from: currentPhase,
      to: targetPhase,
      event,
      timestamp: Date.now(),
    };

    this.state.currentPhase = targetPhase;
    this.state.transitionLogs.push(log);

    // 特殊处理：首次进入时记录开始时间和开启新手保护
    if (event === 'first_enter') {
      this.state.tutorialStartTime = Date.now();
      this.state.protectionStartTime = Date.now();
    }

    // 发射状态转换事件
    this.deps.eventBus.emit('tutorial:phaseChanged', log);

    // 特殊处理：引导完成
    if (targetPhase === 'free_play' && event === 'explore_done') {
      this.deps.eventBus.emit('tutorial:completed', { timestamp: Date.now() });
    }

    return { success: true };
  }

  /**
   * 非首次进入，直接跳到自由游戏
   */
  enterAsReturning(): void {
    this.state.currentPhase = 'free_play';
    this.state.tutorialStartTime = null;
    this.state.protectionStartTime = null;
  }

  // ─── 进度管理 API (#8) ───────────────────

  /**
   * 记录步骤完成
   */
  completeStep(stepId: TutorialStepId): void {
    if (!this.state.completedSteps.includes(stepId)) {
      this.state.completedSteps.push(stepId);
      this.deps.eventBus.emit('tutorial:stepCompleted', {
        stepId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 记录剧情事件完成
   */
  completeStoryEvent(eventId: StoryEventId, skipped: boolean = false): void {
    if (!this.state.completedEvents.includes(eventId)) {
      this.state.completedEvents.push(eventId);
      this.deps.eventBus.emit('tutorial:storyCompleted', { eventId, skipped });
    }
  }

  /**
   * 设置当前步骤
   */
  setCurrentStep(stepId: TutorialStepId | null, subStepIndex: number = 0): void {
    this.state.currentStepId = stepId;
    this.state.currentSubStepIndex = subStepIndex;
  }

  /**
   * 推进子步骤索引
   */
  advanceSubStep(totalSubSteps: number): { completed: boolean; newIndex: number } {
    const nextIndex = this.state.currentSubStepIndex + 1;
    if (nextIndex >= totalSubSteps) {
      return { completed: true, newIndex: this.state.currentSubStepIndex };
    }
    this.state.currentSubStepIndex = nextIndex;
    return { completed: false, newIndex: nextIndex };
  }

  // ─── 查询 API ───────────────────────────

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): TutorialPhase {
    return this.state.currentPhase;
  }

  /**
   * 是否已完成指定步骤
   */
  isStepCompleted(stepId: TutorialStepId): boolean {
    return this.state.completedSteps.includes(stepId);
  }

  /**
   * 是否已完成指定剧情事件
   */
  isStoryEventCompleted(eventId: StoryEventId): boolean {
    return this.state.completedEvents.includes(eventId);
  }

  /**
   * 获取已完成步骤数
   */
  getCompletedStepCount(): number {
    return this.state.completedSteps.length;
  }

  /**
   * 获取已完成核心步骤数
   */
  getCompletedCoreStepCount(): number {
    const coreSteps: TutorialStepId[] = [
      'step1_castle_overview', 'step2_build_farm', 'step3_recruit_hero',
      'step4_first_battle', 'step5_check_resources', 'step6_tech_research',
    ];
    return coreSteps.filter(id => this.state.completedSteps.includes(id)).length;
  }

  /**
   * 是否处于新手保护期 (#18)
   */
  isNewbieProtectionActive(): boolean {
    if (!this.state.protectionStartTime) return false;
    return Date.now() - this.state.protectionStartTime < NEWBIE_PROTECTION_DURATION_MS;
  }

  /**
   * 获取新手保护剩余时间（毫秒）
   */
  getProtectionRemainingMs(): number {
    if (!this.state.protectionStartTime) return 0;
    const remaining = NEWBIE_PROTECTION_DURATION_MS - (Date.now() - this.state.protectionStartTime);
    return Math.max(0, remaining);
  }

  /**
   * 是否是首次进入
   */
  isFirstLaunch(): boolean {
    return this.state.currentPhase === 'not_started';
  }

  /**
   * 获取自由探索过渡数据 (#14)
   */
  getFreeExploreData(): FreeExploreData {
    // 获取步骤6的阶段奖励
    const phaseReward = TUTORIAL_PHASE_REWARDS.find(
      r => r.triggerStepId === 'step6_tech_research',
    )!;

    // 构建已解锁功能列表
    const unlockedFeatures: UnlockedFeature[] = [
      { id: 'building', name: '建筑系统', icon: 'building' },
      { id: 'hero', name: '武将系统', icon: 'hero' },
      { id: 'campaign', name: '战役系统', icon: 'campaign' },
      { id: 'resource', name: '资源系统', icon: 'resource' },
      { id: 'tech', name: '科技系统', icon: 'tech' },
    ];

    return {
      recommendedActions: DEFAULT_RECOMMENDED_ACTIONS,
      unlockedFeatures,
      phaseReward,
    };
  }

  // ─── 序列化 (#8) ───────────────────────────

  /**
   * 序列化存档数据
   */
  serialize(): TutorialSaveData {
    return {
      version: TUTORIAL_SAVE_VERSION,
      currentPhase: this.state.currentPhase,
      completedSteps: [...this.state.completedSteps],
      completedEvents: [...this.state.completedEvents],
      currentStepId: this.state.currentStepId,
      currentSubStepIndex: this.state.currentSubStepIndex,
      tutorialStartTime: this.state.tutorialStartTime,
      transitionLogs: [...this.state.transitionLogs],
      dailyReplayCount: 0,
      lastReplayDate: '',
      protectionStartTime: this.state.protectionStartTime,
    };
  }

  /**
   * 从存档数据恢复
   */
  loadSaveData(data: TutorialSaveData): void {
    this.state.currentPhase = data.currentPhase;
    this.state.completedSteps = [...data.completedSteps];
    this.state.completedEvents = [...data.completedEvents];
    this.state.currentStepId = data.currentStepId;
    this.state.currentSubStepIndex = data.currentSubStepIndex;
    this.state.tutorialStartTime = data.tutorialStartTime;
    this.state.transitionLogs = [...data.transitionLogs];
    this.state.protectionStartTime = data.protectionStartTime;
  }

  /**
   * 冲突解决 — 取并集最大进度 (#9)
   */
  resolveConflict(localData: TutorialSaveData, remoteData: TutorialSaveData): TutorialSaveData {
    const localSteps = new Set(localData.completedSteps);
    const remoteSteps = new Set(remoteData.completedSteps);
    const mergedSteps = [...new Set([...localSteps, ...remoteSteps])];

    const localEvents = new Set(localData.completedEvents);
    const remoteEvents = new Set(remoteData.completedEvents);
    const mergedEvents = [...new Set([...localEvents, ...remoteEvents])];

    // 取进度更高的阶段
    const phaseOrder: TutorialPhase[] = [
      'not_started', 'core_guiding', 'free_explore', 'mini_tutorial', 'free_play',
    ];
    const localIdx = phaseOrder.indexOf(localData.currentPhase);
    const remoteIdx = phaseOrder.indexOf(remoteData.currentPhase);
    const betterPhase = localIdx >= remoteIdx ? localData.currentPhase : remoteData.currentPhase;

    return {
      version: TUTORIAL_SAVE_VERSION,
      currentPhase: betterPhase,
      completedSteps: mergedSteps as TutorialStepId[],
      completedEvents: mergedEvents as StoryEventId[],
      currentStepId: localIdx >= remoteIdx ? localData.currentStepId : remoteData.currentStepId,
      currentSubStepIndex: localIdx >= remoteIdx ? localData.currentSubStepIndex : remoteData.currentSubStepIndex,
      tutorialStartTime: localData.tutorialStartTime ?? remoteData.tutorialStartTime,
      transitionLogs: localData.transitionLogs,
      dailyReplayCount: Math.max(localData.dailyReplayCount, remoteData.dailyReplayCount),
      lastReplayDate: localData.lastReplayDate || remoteData.lastReplayDate,
      protectionStartTime: localData.protectionStartTime ?? remoteData.protectionStartTime,
    };
  }

  // ─── 内部方法 ───────────────────────────

  /** 创建初始状态 */
  private createInitialState(): TutorialStateMachineState {
    return {
      currentPhase: 'not_started',
      completedSteps: [],
      completedEvents: [],
      currentStepId: null,
      currentSubStepIndex: 0,
      tutorialStartTime: null,
      transitionLogs: [],
      protectionStartTime: null,
    };
  }

  /** 检查新手保护过期 */
  private checkProtectionExpiry(): void {
    if (this.state.protectionStartTime && this.isNewbieProtectionActive()) {
      // 保护仍然有效，无需操作
      return;
    }
    if (this.state.protectionStartTime && !this.isNewbieProtectionActive()) {
      // 保护刚过期，发射事件
      this.state.protectionStartTime = null;
      this.deps.eventBus.emit('tutorial:protectionChanged', {
        active: false,
        remainingMs: 0,
      });
    }
  }
}
