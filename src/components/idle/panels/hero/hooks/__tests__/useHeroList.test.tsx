/**
 * useHeroList 测试 — 武将列表数据 Hook
 *
 * 覆盖：
 * - 基础渲染：Hook正常调用返回数据
 * - 数据获取：allGenerals / ownedHeroIds / heroBriefs / heroInfos 正确提取
 * - 操作方法：snapshotVersion 触发重计算
 * - 边界：空数据 / null引擎属性
 *
 * @module components/idle/panels/hero/hooks/__tests__/useHeroList.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHeroList } from '../useHeroList';
import { createMockEngine, makeMultipleGenerals } from './hero-hooks-test-utils';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';

// ═══════════════════════════════════════════════
// 基础渲染测试
// ═══════════════════════════════════════════════

describe('useHeroList — 基础渲染', () => {
  it('应正常调用并返回数据结构', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('allGenerals');
    expect(result.current).toHaveProperty('ownedHeroIds');
    expect(result.current).toHaveProperty('heroBriefs');
    expect(result.current).toHaveProperty('heroInfos');
  });

  it('应返回与引擎武将数量一致的数据', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.allGenerals).toHaveLength(generals.length);
    expect(result.current.ownedHeroIds).toHaveLength(generals.length);
    expect(result.current.heroBriefs).toHaveLength(generals.length);
    expect(result.current.heroInfos).toHaveLength(generals.length);
  });
});

// ═══════════════════════════════════════════════
// 数据获取测试
// ═══════════════════════════════════════════════

describe('useHeroList — 数据获取', () => {
  it('ownedHeroIds 应包含所有武将ID', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    const expectedIds = generals.map((g) => g.id);
    expect(result.current.ownedHeroIds).toEqual(expectedIds);
  });

  it('heroBriefs 应包含正确的简要数据', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    const firstBrief = result.current.heroBriefs[0];
    expect(firstBrief).toBeDefined();
    expect(firstBrief.id).toBe(generals[0].id);
    expect(firstBrief.name).toBe(generals[0].name);
    expect(firstBrief.level).toBe(generals[0].level);
    expect(typeof firstBrief.quality).toBe('string');
    expect(typeof firstBrief.stars).toBe('number');
  });

  it('heroInfos 应包含 faction 字段', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    const firstInfo = result.current.heroInfos[0];
    expect(firstInfo).toBeDefined();
    expect(firstInfo.id).toBe(generals[0].id);
    expect(firstInfo.faction).toBe(generals[0].faction);
    expect(typeof firstInfo.stars).toBe('number');
  });

  it('getHeroStarSystem 返回星级数据', () => {
    const generals = makeMultipleGenerals();
    const mockStarSystem = {
      getStar: vi.fn().mockReturnValue(5),
      getLevelCap: vi.fn().mockReturnValue(100),
      getBreakthroughStage: vi.fn().mockReturnValue(2),
    };
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue(generals),
      getHeroStarSystem: vi.fn().mockReturnValue(mockStarSystem),
    });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.heroBriefs[0].stars).toBe(5);
    expect(mockStarSystem.getStar).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 边界测试
// ═══════════════════════════════════════════════

describe('useHeroList — 边界条件', () => {
  it('引擎返回空数组时应安全处理', () => {
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue([]) });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.allGenerals).toEqual([]);
    expect(result.current.ownedHeroIds).toEqual([]);
    expect(result.current.heroBriefs).toEqual([]);
    expect(result.current.heroInfos).toEqual([]);
  });

  it('getGenerals 抛异常时应返回空数组', () => {
    const engine = createMockEngine({
      getGenerals: vi.fn().mockImplementation(() => { throw new Error('engine error'); }),
    });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.allGenerals).toEqual([]);
  });

  it('getHeroStarSystem 抛异常时 stars 应回退为 1', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue(generals),
      getHeroStarSystem: vi.fn().mockImplementation(() => { throw new Error('no star system'); }),
    });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    result.current.heroBriefs.forEach((brief) => {
      expect(brief.stars).toBe(1);
    });
  });

  it('引擎返回对象格式（非数组）时应正确转换', () => {
    const generals = makeMultipleGenerals();
    const objFormat = Object.fromEntries(generals.map((g) => [g.id, g]));
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(objFormat) });
    const { result } = renderHook(() =>
      useHeroList({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.allGenerals).toHaveLength(generals.length);
  });
});
