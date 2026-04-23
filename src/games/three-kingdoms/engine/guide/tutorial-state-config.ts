/**
 * Tutorial state machine - config constants
 *
 * Extracted from TutorialStateMachine.ts.
 */

import type { TutorialPhase, TutorialTransition } from '../../core/guide/guide.types';
import { TUTORIAL_PHASE_REWARDS } from '../../core/guide/guide-config';
// ─────────────────────────────────────────────
// 状态转换规则表
// ─────────────────────────────────────────────

const VALID_TRANSITIONS: Record<TutorialPhase, TutorialTransition[]> = {
  not_started: ['first_enter'],
  core_guiding: ['step6_complete', 'skip_to_explore'],
  free_explore: ['explore_done'],
  free_play: ['condition_trigger', 'non_first_enter'],
  mini_tutorial: ['mini_done'],
};

