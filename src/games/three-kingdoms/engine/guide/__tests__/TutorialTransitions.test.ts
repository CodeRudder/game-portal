/**
 * 引导状态转换规则测试
 *
 * 覆盖：VALID_TRANSITIONS 合法性、TRANSITION_TARGETS 目标映射、
 * TutorialStateMachineState 类型完整性
 */

import { describe, it, expect } from 'vitest';
import {
  VALID_TRANSITIONS,
  TRANSITION_TARGETS,
} from '../TutorialTransitions';
import type { TutorialStateMachineState } from '../TutorialTransitions';

// ── VALID_TRANSITIONS ──

describe('TutorialTransitions — VALID_TRANSITIONS', () => {
  it('包含所有5个引导阶段', () => {
    const phases = Object.keys(VALID_TRANSITIONS);
    expect(phases).toContain('not_started');
    expect(phases).toContain('core_guiding');
    expect(phases).toContain('free_explore');
    expect(phases).toContain('free_play');
    expect(phases).toContain('mini_tutorial');
    expect(phases).toHaveLength(5);
  });

  it('not_started 只能转换到 core_guiding（通过 first_enter）', () => {
    expect(VALID_TRANSITIONS.not_started).toEqual(['first_enter']);
  });

  it('core_guiding 可以通过 step6_complete 或 skip_to_explore 转换', () => {
    expect(VALID_TRANSITIONS.core_guiding).toContain('step6_complete');
    expect(VALID_TRANSITIONS.core_guiding).toContain('skip_to_explore');
  });

  it('free_explore 只能通过 explore_done 转换', () => {
    expect(VALID_TRANSITIONS.free_explore).toEqual(['explore_done']);
  });

  it('free_play 可以通过 condition_trigger 或 non_first_enter 转换', () => {
    expect(VALID_TRANSITIONS.free_play).toContain('condition_trigger');
    expect(VALID_TRANSITIONS.free_play).toContain('non_first_enter');
  });

  it('mini_tutorial 只能通过 mini_done 转换', () => {
    expect(VALID_TRANSITIONS.mini_tutorial).toEqual(['mini_done']);
  });

  it('每个阶段的转换列表不为空', () => {
    for (const transitions of Object.values(VALID_TRANSITIONS)) {
      expect(transitions.length).toBeGreaterThan(0);
    }
  });
});

// ── TRANSITION_TARGETS ──

describe('TutorialTransitions — TRANSITION_TARGETS', () => {
  it('包含所有7种转换', () => {
    const transitions = Object.keys(TRANSITION_TARGETS);
    expect(transitions).toHaveLength(7);
    expect(transitions).toContain('first_enter');
    expect(transitions).toContain('step6_complete');
    expect(transitions).toContain('skip_to_explore');
    expect(transitions).toContain('explore_done');
    expect(transitions).toContain('condition_trigger');
    expect(transitions).toContain('mini_done');
    expect(transitions).toContain('non_first_enter');
  });

  it('first_enter 目标为 core_guiding', () => {
    expect(TRANSITION_TARGETS.first_enter).toBe('core_guiding');
  });

  it('step6_complete 目标为 free_explore', () => {
    expect(TRANSITION_TARGETS.step6_complete).toBe('free_explore');
  });

  it('skip_to_explore 目标为 free_explore', () => {
    expect(TRANSITION_TARGETS.skip_to_explore).toBe('free_explore');
  });

  it('explore_done 目标为 free_play', () => {
    expect(TRANSITION_TARGETS.explore_done).toBe('free_play');
  });

  it('condition_trigger 目标为 mini_tutorial', () => {
    expect(TRANSITION_TARGETS.condition_trigger).toBe('mini_tutorial');
  });

  it('mini_done 目标为 free_play', () => {
    expect(TRANSITION_TARGETS.mini_done).toBe('free_play');
  });

  it('non_first_enter 目标为 free_play', () => {
    expect(TRANSITION_TARGETS.non_first_enter).toBe('free_play');
  });

  it('所有转换目标都是合法的引导阶段', () => {
    const validPhases = ['not_started', 'core_guiding', 'free_explore', 'free_play', 'mini_tutorial'];
    for (const target of Object.values(TRANSITION_TARGETS)) {
      expect(validPhases).toContain(target);
    }
  });
});

// ── 一致性校验 ──

describe('TutorialTransitions — 一致性', () => {
  it('VALID_TRANSITIONS 中的每个转换都有对应的 TRANSITION_TARGETS', () => {
    for (const transitions of Object.values(VALID_TRANSITIONS)) {
      for (const t of transitions) {
        expect(TRANSITION_TARGETS).toHaveProperty(t);
      }
    }
  });

  it('TRANSITION_TARGETS 中的每个转换都出现在某个阶段的 VALID_TRANSITIONS 中', () => {
    const allValidTransitions = new Set<string>();
    for (const transitions of Object.values(VALID_TRANSITIONS)) {
      for (const t of transitions) {
        allValidTransitions.add(t);
      }
    }

    for (const t of Object.keys(TRANSITION_TARGETS)) {
      expect(allValidTransitions.has(t)).toBe(true);
    }
  });
});

// ── TutorialStateMachineState 接口验证（类型级别） ──

describe('TutorialTransitions — TutorialStateMachineState', () => {
  it('可以构造完整的内部状态对象', () => {
    const state: TutorialStateMachineState = {
      currentPhase: 'not_started',
      completedSteps: [],
      completedEvents: [],
      currentStepId: null,
      currentSubStepIndex: 0,
      tutorialStartTime: null,
      transitionLogs: [],
      protectionStartTime: null,
    };

    expect(state.currentPhase).toBe('not_started');
    expect(state.completedSteps).toEqual([]);
    expect(state.completedEvents).toEqual([]);
    expect(state.currentStepId).toBeNull();
    expect(state.currentSubStepIndex).toBe(0);
    expect(state.tutorialStartTime).toBeNull();
    expect(state.transitionLogs).toEqual([]);
    expect(state.protectionStartTime).toBeNull();
  });

  it('可以设置各阶段状态', () => {
    const phases: TutorialStateMachineState['currentPhase'][] = [
      'not_started',
      'core_guiding',
      'free_explore',
      'free_play',
      'mini_tutorial',
    ];

    for (const phase of phases) {
      const state: TutorialStateMachineState = {
        currentPhase: phase,
        completedSteps: [],
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [{ from: 'not_started', to: phase, transition: 'first_enter', timestamp: Date.now() }],
        protectionStartTime: null,
      };
      expect(state.currentPhase).toBe(phase);
    }
  });
});
