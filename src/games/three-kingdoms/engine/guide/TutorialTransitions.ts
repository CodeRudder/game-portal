/**
 * 引导状态机 — 状态转换规则与内部类型
 *
 * 从 TutorialStateMachine 中提取的转换规则表和内部状态接口。
 *
 * @module engine/guide/TutorialTransitions
 */

import type {
  TutorialPhase,
  TutorialTransition,
  TutorialTransitionLog,
  TutorialStepId,
  StoryEventId,
} from '../../core/guide';

// ─────────────────────────────────────────────
// 状态转换规则表
// ─────────────────────────────────────────────

/** 合法状态转换映射 */
export const VALID_TRANSITIONS: Record<TutorialPhase, TutorialTransition[]> = {
  not_started: ['first_enter'],
  core_guiding: ['step6_complete', 'skip_to_explore'],
  free_explore: ['explore_done'],
  free_play: ['condition_trigger', 'non_first_enter'],
  mini_tutorial: ['mini_done'],
};

/** 状态转换目标映射 */
export const TRANSITION_TARGETS: Record<TutorialTransition, TutorialPhase> = {
  first_enter: 'core_guiding',
  step6_complete: 'free_explore',
  skip_to_explore: 'free_explore',
  explore_done: 'free_play',
  condition_trigger: 'mini_tutorial',
  mini_done: 'free_play',
  non_first_enter: 'free_play',
};

// ─────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────

/** 状态机内部状态 */
export interface TutorialStateMachineState {
  /** 当前引导阶段 */
  currentPhase: TutorialPhase;
  /** 已完成的步骤ID列表 */
  completedSteps: TutorialStepId[];
  /** 已完成的剧情事件ID列表 */
  completedEvents: StoryEventId[];
  /** 当前步骤ID */
  currentStepId: TutorialStepId | null;
  /** 当前子步骤索引 */
  currentSubStepIndex: number;
  /** 引导开始时间戳 */
  tutorialStartTime: number | null;
  /** 状态转换日志 */
  transitionLogs: TutorialTransitionLog[];
  /** 新手保护开始时间 */
  protectionStartTime: number | null;
}
