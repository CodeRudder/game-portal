/**
 * useHeroDispatch 测试 — 派遣数据 + 操作 Hook
 *
 * 覆盖：
 * - 基础渲染：Hook正常调用返回数据结构
 * - 数据获取：buildings 正确提取建筑列表和派遣状态
 * - 操作方法：dispatchHero / recallHero 调用引擎方法
 * - 边界：空数据 / 异常处理
 *
 * @module components/idle/panels/hero/hooks/__tests__/useHeroDispatch.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHeroDispatch } from '../useHeroDispatch';
import { createMockEngine } from './hero-hooks-test-utils';

// ═══════════════════════════════════════════════
// 基础渲染测试
// ═══════════════════════════════════════════════

describe('useHeroDispatch — 基础渲染', () => {
  it('应正常调用并返回数据结构', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('buildings');
    expect(result.current).toHaveProperty('dispatchHero');
    expect(result.current).toHaveProperty('recallHero');
  });
});

// ═══════════════════════════════════════════════
// 数据获取测试
// ═══════════════════════════════════════════════

describe('useHeroDispatch — 数据获取', () => {
  it('应返回建筑列表', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.buildings.length).toBeGreaterThan(0);
  });

  it('建筑条目应包含必要字段', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    const firstBuilding = result.current.buildings[0];
    expect(firstBuilding).toHaveProperty('id');
    expect(firstBuilding).toHaveProperty('name');
    expect(firstBuilding).toHaveProperty('level');
    expect(firstBuilding).toHaveProperty('dispatchHeroId');
  });

  it('应正确显示已派遣武将', () => {
    const mockDispatchSystem = {
      dispatchHero: vi.fn(),
      undeployHero: vi.fn(),
      getState: vi.fn().mockReturnValue({
        buildingDispatch: {
          farmland: { heroId: 'guanyu' },
        },
      }),
    };
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockReturnValue(mockDispatchSystem),
    });

    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    const farm = result.current.buildings.find((b) => b.id === 'farmland');
    expect(farm?.dispatchHeroId).toBe('guanyu');
  });

  it('未派遣建筑 dispatchHeroId 应为 null', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    result.current.buildings.forEach((b) => {
      expect(b.dispatchHeroId).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════
// 操作方法测试
// ═══════════════════════════════════════════════

describe('useHeroDispatch — 操作方法', () => {
  it('dispatchHero 应调用引擎派遣方法', () => {
    const mockDispatchSystem = {
      dispatchHero: vi.fn(),
      undeployHero: vi.fn(),
      getState: vi.fn().mockReturnValue({}),
    };
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockReturnValue(mockDispatchSystem),
    });

    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.dispatchHero('guanyu', 'farmland');
    });

    expect(mockDispatchSystem.dispatchHero).toHaveBeenCalledWith('guanyu', 'farmland');
  });

  it('recallHero 应调用引擎召回方法', () => {
    const mockDispatchSystem = {
      dispatchHero: vi.fn(),
      undeployHero: vi.fn(),
      getState: vi.fn().mockReturnValue({
        buildingDispatch: {
          farmland: { heroId: 'guanyu' },
        },
      }),
    };
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockReturnValue(mockDispatchSystem),
    });

    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.recallHero('farmland');
    });

    expect(mockDispatchSystem.undeployHero).toHaveBeenCalledWith('guanyu');
  });

  it('无效建筑类型应被静默忽略', () => {
    const mockDispatchSystem = {
      dispatchHero: vi.fn(),
      undeployHero: vi.fn(),
      getState: vi.fn().mockReturnValue({}),
    };
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockReturnValue(mockDispatchSystem),
    });

    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.dispatchHero('guanyu', 'invalid_building_type');
    });

    // 无效建筑类型不应调用引擎
    expect(mockDispatchSystem.dispatchHero).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 边界测试
// ═══════════════════════════════════════════════

describe('useHeroDispatch — 边界条件', () => {
  it('building 为 null 时应返回空数组', () => {
    const engine = createMockEngine({
      building: null,
    });
    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.buildings).toEqual([]);
  });

  it('getHeroDispatchSystem 抛异常时 buildings 应为空', () => {
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockImplementation(() => { throw new Error('dispatch error'); }),
    });
    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.buildings).toEqual([]);
  });

  it('recallHero 无派遣记录时不应调用 undeployHero', () => {
    const mockDispatchSystem = {
      dispatchHero: vi.fn(),
      undeployHero: vi.fn(),
      getState: vi.fn().mockReturnValue({
        buildingDispatch: {},
      }),
    };
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockReturnValue(mockDispatchSystem),
    });

    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.recallHero('farmland');
    });

    expect(mockDispatchSystem.undeployHero).not.toHaveBeenCalled();
  });

  it('dispatchHero 引擎异常时应静默处理', () => {
    const mockDispatchSystem = {
      dispatchHero: vi.fn().mockImplementation(() => { throw new Error('fail'); }),
      undeployHero: vi.fn(),
      getState: vi.fn().mockReturnValue({}),
    };
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockReturnValue(mockDispatchSystem),
    });

    const { result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    // 不应抛出异常
    expect(() => {
      act(() => {
        result.current.dispatchHero('guanyu', 'farmland');
      });
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════
// 状态更新测试
// ═══════════════════════════════════════════════

describe('useHeroDispatch — 状态更新', () => {
  it('snapshotVersion 变化应触发建筑数据重计算', () => {
    const engine = createMockEngine();

    const { result, rerender } = renderHook(
      ({ snapshotVersion }) =>
        useHeroDispatch({ engine: engine, snapshotVersion }),
      { initialProps: { snapshotVersion: 0 } },
    );

    const firstBuildings = result.current.buildings;
    expect(firstBuildings.length).toBeGreaterThan(0);

    rerender({ snapshotVersion: 1 });
    // 应重新获取数据
    expect(engine.getHeroDispatchSystem).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 清理测试
// ═══════════════════════════════════════════════

describe('useHeroDispatch — 清理', () => {
  it('unmount 后不应有副作用残留', () => {
    const engine = createMockEngine();
    const { unmount, result } = renderHook(() =>
      useHeroDispatch({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.buildings).toBeDefined();
    expect(() => unmount()).not.toThrow();
  });

  it('多次 mount/unmount 不应泄漏', () => {
    const engine = createMockEngine();

    for (let i = 0; i < 3; i++) {
      const { unmount, result } = renderHook(() =>
        useHeroDispatch({ engine: engine, snapshotVersion: i }),
      );
      expect(result.current.buildings).toBeDefined();
      unmount();
    }
  });
});
