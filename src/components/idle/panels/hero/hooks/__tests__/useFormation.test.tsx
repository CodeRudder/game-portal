/**
 * useFormation 测试 — 编队数据 + 推荐 Hook
 *
 * 覆盖：
 * - 基础渲染：Hook正常调用返回数据结构
 * - 数据获取：currentFormation / powerCalculator 正确工作
 * - 操作方法：applyRecommend / generateRecommendations
 * - 边界：空数据 / 异常处理
 *
 * 注意（R12）：useFormation 不再接受 deps 参数，
 * 直接从引擎获取武将数据，确保子 Hook 独立可用。
 *
 * @module components/idle/panels/hero/hooks/__tests__/useFormation.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormation } from '../useFormation';
import { createMockEngine, makeMultipleGenerals } from './hero-hooks-test-utils';
import type { HeroInfo } from '../../FormationRecommendPanel';
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';

// ═══════════════════════════════════════════════
// 测试数据
// ═══════════════════════════════════════════════

function makeHeroInfos(): HeroInfo[] {
  return [
    { id: 'liubei', name: '刘备', level: 20, quality: 'EPIC', stars: 3, faction: 'shu' },
    { id: 'guanyu', name: '关羽', level: 30, quality: 'LEGENDARY', stars: 5, faction: 'shu' },
    { id: 'zhangfei', name: '张飞', level: 25, quality: 'EPIC', stars: 4, faction: 'shu' },
    { id: 'caocao', name: '曹操', level: 28, quality: 'LEGENDARY', stars: 4, faction: 'wei' },
  ];
}

/** 创建返回武将数据的 mock 引擎（getGenerals 返回完整武将列表） */
function createMockEngineWithGenerals(overrides: Record<string, unknown> = {}) {
  const generals: GeneralData[] = [
    {
      id: 'liubei', name: '刘备', quality: Quality.EPIC,
      baseStats: { attack: 80, defense: 70, intelligence: 90, speed: 60 },
      level: 20, exp: 0, faction: 'shu',
      skills: [],
    },
    {
      id: 'guanyu', name: '关羽', quality: Quality.LEGENDARY,
      baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
      level: 30, exp: 0, faction: 'shu',
      skills: [],
    },
    {
      id: 'zhangfei', name: '张飞', quality: Quality.EPIC,
      baseStats: { attack: 100, defense: 60, intelligence: 40, speed: 70 },
      level: 25, exp: 0, faction: 'shu',
      skills: [],
    },
    {
      id: 'caocao', name: '曹操', quality: Quality.LEGENDARY,
      baseStats: { attack: 95, defense: 85, intelligence: 100, speed: 75 },
      level: 28, exp: 0, faction: 'wei',
      skills: [],
    },
  ];

  return createMockEngine({
    getGenerals: vi.fn().mockReturnValue(generals),
    ...overrides,
  });
}

// ═══════════════════════════════════════════════
// 基础渲染测试
// ═══════════════════════════════════════════════

describe('useFormation — 基础渲染', () => {
  it('应正常调用并返回数据结构', () => {
    const engine = createMockEngineWithGenerals();
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('currentFormation');
    expect(result.current).toHaveProperty('powerCalculator');
    expect(result.current).toHaveProperty('generateRecommendations');
    expect(result.current).toHaveProperty('applyRecommend');
  });
});

// ═══════════════════════════════════════════════
// 数据获取测试
// ═══════════════════════════════════════════════

describe('useFormation — 数据获取', () => {
  it('currentFormation 默认应为 6 个 null 槽位', () => {
    const engine = createMockEngineWithGenerals({
      getFormations: vi.fn().mockReturnValue([]),
    });
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.currentFormation).toHaveLength(6);
    result.current.currentFormation.forEach((slot) => {
      expect(slot).toBeNull();
    });
  });

  it('应从引擎编队数据中提取武将ID', () => {
    const engine = createMockEngineWithGenerals({
      getFormations: vi.fn().mockReturnValue([
        { slots: [{ heroId: 'guanyu' }, { heroId: 'liubei' }, null, null, null, null] },
      ]),
    });
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.currentFormation[0]).toBe('guanyu');
    expect(result.current.currentFormation[1]).toBe('liubei');
    expect(result.current.currentFormation[2]).toBeNull();
  });

  it('powerCalculator 应返回正数战力', () => {
    const engine = createMockEngineWithGenerals();
    const heroInfos = makeHeroInfos();
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    const power = result.current.powerCalculator(heroInfos);
    expect(power).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 推荐方案测试
// ═══════════════════════════════════════════════

describe('useFormation — 推荐方案', () => {
  it('generateRecommendations 应返回推荐方案列表', () => {
    const engine = createMockEngineWithGenerals();
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    const plans = result.current.generateRecommendations();
    expect(plans.length).toBeGreaterThan(0);
    // 第一个方案应为"战力最优"
    expect(plans[0].id).toBe('best-power');
  });

  it('无武将时不应返回推荐方案', () => {
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue([]) });
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    const plans = result.current.generateRecommendations();
    expect(plans).toEqual([]);
  });

  it('推荐方案应包含必要字段', () => {
    const engine = createMockEngineWithGenerals();
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    const plans = result.current.generateRecommendations();
    plans.forEach((plan) => {
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('heroIds');
      expect(plan).toHaveProperty('estimatedPower');
      expect(plan).toHaveProperty('score');
      expect(plan).toHaveProperty('bonds');
    });
  });
});

// ═══════════════════════════════════════════════
// 操作方法测试
// ═══════════════════════════════════════════════

describe('useFormation — 操作方法', () => {
  it('applyRecommend 应调用引擎 setFormation', () => {
    const mockFormationSystem = { setFormation: vi.fn() };
    const engine = createMockEngineWithGenerals({
      getFormations: vi.fn().mockReturnValue([{ slots: [] }]),
      getFormationSystem: vi.fn().mockReturnValue(mockFormationSystem),
    });
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.applyRecommend(['guanyu', 'liubei', null]);
    });

    expect(mockFormationSystem.setFormation).toHaveBeenCalledWith('0', ['guanyu', 'liubei']);
  });

  it('applyRecommend 无编队时不应调用 setFormation', () => {
    const mockFormationSystem = { setFormation: vi.fn() };
    const engine = createMockEngineWithGenerals({
      getFormations: vi.fn().mockReturnValue([]),
      getFormationSystem: vi.fn().mockReturnValue(mockFormationSystem),
    });
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.applyRecommend(['guanyu']);
    });

    expect(mockFormationSystem.setFormation).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 边界测试
// ═══════════════════════════════════════════════

describe('useFormation — 边界条件', () => {
  it('getFormations 抛异常时 currentFormation 应为 6 个 null', () => {
    const engine = createMockEngineWithGenerals({
      getFormations: vi.fn().mockImplementation(() => { throw new Error('formation error'); }),
    });
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.currentFormation).toHaveLength(6);
    result.current.currentFormation.forEach((slot) => {
      expect(slot).toBeNull();
    });
  });

  it('powerCalculator 引擎异常时应使用回退计算', () => {
    const engine = createMockEngineWithGenerals({
      getHeroSystem: vi.fn().mockImplementation(() => { throw new Error('hero system error'); }),
    });
    const heroInfos = makeHeroInfos();
    const { result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    const power = result.current.powerCalculator(heroInfos);
    // 回退计算应返回正数
    expect(power).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 状态更新测试
// ═══════════════════════════════════════════════

describe('useFormation — 状态更新', () => {
  it('snapshotVersion 变化应触发编队数据重计算', () => {
    const engine = createMockEngineWithGenerals({
      getFormations: vi.fn().mockReturnValue([
        { slots: [{ heroId: 'guanyu' }, null, null, null, null, null] },
      ]),
    });

    const { result, rerender } = renderHook(
      ({ snapshotVersion }) =>
        useFormation({ engine: engine, snapshotVersion }),
      { initialProps: { snapshotVersion: 0 } },
    );

    expect(result.current.currentFormation[0]).toBe('guanyu');

    // 更新 snapshotVersion
    rerender({ snapshotVersion: 1 });
    expect(engine.getFormations).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 清理测试
// ═══════════════════════════════════════════════

describe('useFormation — 清理', () => {
  it('unmount 后不应有副作用残留', () => {
    const engine = createMockEngineWithGenerals();
    const { unmount, result } = renderHook(() =>
      useFormation({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.currentFormation).toBeDefined();
    expect(() => unmount()).not.toThrow();
  });

  it('多次 mount/unmount 不应泄漏', () => {
    const engine = createMockEngineWithGenerals();

    for (let i = 0; i < 3; i++) {
      const { unmount, result } = renderHook(() =>
        useFormation({ engine: engine, snapshotVersion: i }),
      );
      expect(result.current.currentFormation).toBeDefined();
      unmount();
    }
  });
});
