/**
 * useHeroGuide 测试 — 引导操作 Hook
 *
 * 覆盖：
 * - 基础渲染：Hook正常调用返回 handleGuideAction
 * - 操作方法：recruit / enhance / formation / detail 各引导动作
 * - 边界：引擎异常时静默处理
 *
 * @module components/idle/panels/hero/hooks/__tests__/useHeroGuide.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHeroGuide } from '../useHeroGuide';
import { createMockEngine, makeMultipleGenerals } from './hero-hooks-test-utils';

// ═══════════════════════════════════════════════
// 基础渲染测试
// ═══════════════════════════════════════════════

describe('useHeroGuide — 基础渲染', () => {
  it('应正常调用并返回 handleGuideAction', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() => useHeroGuide(engine as any));

    expect(result.current).toBeDefined();
    expect(typeof result.current.handleGuideAction).toBe('function');
  });
});

// ═══════════════════════════════════════════════
// 操作方法测试
// ═══════════════════════════════════════════════

describe('useHeroGuide — recruit 动作', () => {
  it('应调用引擎 recruit 方法', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() => useHeroGuide(engine as any));

    act(() => {
      result.current.handleGuideAction({
        type: 'recruit',
        stepIndex: 0,
        stepId: 'recruit',
      });
    });

    expect(engine.recruit).toHaveBeenCalledWith('normal', 1);
  });
});

describe('useHeroGuide — enhance 动作', () => {
  it('应调用引擎 enhanceHero 方法（第一个武将）', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue(generals),
    });
    const { result } = renderHook(() => useHeroGuide(engine as any));

    act(() => {
      result.current.handleGuideAction({
        type: 'enhance',
        stepIndex: 1,
        stepId: 'enhance',
      });
    });

    expect(engine.enhanceHero).toHaveBeenCalledWith(generals[0].id, 1);
  });

  it('无武将时不应调用 enhanceHero', () => {
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue([]),
    });
    const { result } = renderHook(() => useHeroGuide(engine as any));

    act(() => {
      result.current.handleGuideAction({
        type: 'enhance',
        stepIndex: 1,
        stepId: 'enhance',
      });
    });

    expect(engine.enhanceHero).not.toHaveBeenCalled();
  });
});

describe('useHeroGuide — formation 动作', () => {
  it('应调用引擎 setFormation 方法', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue(generals),
    });
    const { result } = renderHook(() => useHeroGuide(engine as any));

    act(() => {
      result.current.handleGuideAction({
        type: 'formation',
        stepIndex: 2,
        stepId: 'formation',
      });
    });

    expect(engine.setFormation).toHaveBeenCalledWith('0', expect.any(Array));
    // 编队不应超过6人
    const calledIds = (engine.setFormation as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(calledIds.length).toBeLessThanOrEqual(6);
  });

  it('无武将时不应调用 setFormation', () => {
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue([]),
    });
    const { result } = renderHook(() => useHeroGuide(engine as any));

    act(() => {
      result.current.handleGuideAction({
        type: 'formation',
        stepIndex: 2,
        stepId: 'formation',
      });
    });

    expect(engine.setFormation).not.toHaveBeenCalled();
  });
});

describe('useHeroGuide — detail 动作', () => {
  it('detail 动作不应调用任何引擎方法', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() => useHeroGuide(engine as any));

    act(() => {
      result.current.handleGuideAction({
        type: 'detail',
        stepIndex: 3,
        stepId: 'detail',
      });
    });

    expect(engine.recruit).not.toHaveBeenCalled();
    expect(engine.enhanceHero).not.toHaveBeenCalled();
    expect(engine.setFormation).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 边界测试
// ═══════════════════════════════════════════════

describe('useHeroGuide — 边界条件', () => {
  it('引擎方法抛异常时应静默处理', () => {
    const engine = createMockEngine({
      recruit: vi.fn().mockImplementation(() => { throw new Error('recruit fail'); }),
    });
    const { result } = renderHook(() => useHeroGuide(engine as any));

    // 不应抛出异常
    expect(() => {
      act(() => {
        result.current.handleGuideAction({
          type: 'recruit',
          stepIndex: 0,
          stepId: 'recruit',
        });
      });
    }).not.toThrow();
  });

  it('enhanceHero 抛异常时应静默处理', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue(generals),
      enhanceHero: vi.fn().mockImplementation(() => { throw new Error('enhance fail'); }),
    });
    const { result } = renderHook(() => useHeroGuide(engine as any));

    expect(() => {
      act(() => {
        result.current.handleGuideAction({
          type: 'enhance',
          stepIndex: 1,
          stepId: 'enhance',
        });
      });
    }).not.toThrow();
  });
});
