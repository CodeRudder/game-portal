/**
 * tutorial-state-config 单元测试
 *
 * 验证教程状态机配置常量的正确性：
 * - VALID_TRANSITIONS 状态转换规则完整性
 * - 通过 TutorialStateMachine 间接验证
 */
import { describe, it, expect, vi } from 'vitest';
import { TutorialStateMachine } from '../TutorialStateMachine';

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
    },
    config: {
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
    },
    registry: {
      get: vi.fn(),
    },
    storage: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  };
}

function createMachine(): TutorialStateMachine {
  const tsm = new TutorialStateMachine();
  tsm.init(createMockDeps() as any);
  return tsm;
}

describe('tutorial-state-config', () => {
  it('should import module without error (type-level validation)', async () => {
    const mod = await import('../tutorial-state-config');
    expect(mod).toBeDefined();
  });

  it('should have initial phase as not_started', () => {
    const tsm = createMachine();
    expect(tsm.getCurrentPhase()).toBe('not_started');
  });

  it('should transition from not_started via first_enter', () => {
    const tsm = createMachine();
    const result = tsm.transition('first_enter');
    expect(result.success).toBe(true);
    expect(tsm.getCurrentPhase()).toBe('core_guiding');
  });

  it('should transition from core_guiding via skip_to_explore', () => {
    const tsm = createMachine();
    tsm.transition('first_enter');
    const result = tsm.transition('skip_to_explore');
    expect(result.success).toBe(true);
    expect(tsm.getCurrentPhase()).toBe('free_explore');
  });

  it('should transition from core_guiding via step6_complete', () => {
    const tsm = createMachine();
    tsm.transition('first_enter');
    const result = tsm.transition('step6_complete');
    expect(result.success).toBe(true);
    expect(tsm.getCurrentPhase()).toBe('free_explore');
  });

  it('should transition free_explore -> free_play via explore_done', () => {
    const tsm = createMachine();
    tsm.transition('first_enter');
    tsm.transition('step6_complete');
    const result = tsm.transition('explore_done');
    expect(result.success).toBe(true);
    expect(tsm.getCurrentPhase()).toBe('free_play');
  });

  it('should transition free_play -> mini_tutorial via condition_trigger', () => {
    const tsm = createMachine();
    tsm.transition('first_enter');
    tsm.transition('step6_complete');
    tsm.transition('explore_done');
    const result = tsm.transition('condition_trigger');
    expect(result.success).toBe(true);
    expect(tsm.getCurrentPhase()).toBe('mini_tutorial');
  });

  it('should transition mini_tutorial -> free_play via mini_done', () => {
    const tsm = createMachine();
    tsm.transition('first_enter');
    tsm.transition('step6_complete');
    tsm.transition('explore_done');
    tsm.transition('condition_trigger');
    const result = tsm.transition('mini_done');
    expect(result.success).toBe(true);
    expect(tsm.getCurrentPhase()).toBe('free_play');
  });

  it('should reject invalid transition from not_started', () => {
    const tsm = createMachine();
    const result = tsm.transition('step6_complete');
    expect(result.success).toBe(false);
    expect(tsm.getCurrentPhase()).toBe('not_started');
  });

  it('should reject invalid transition from core_guiding', () => {
    const tsm = createMachine();
    tsm.transition('first_enter');
    const result = tsm.transition('explore_done');
    expect(result.success).toBe(false);
    expect(tsm.getCurrentPhase()).toBe('core_guiding');
  });
});
