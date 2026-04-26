/**
 * useHeroBonds 测试 — 羁绊数据 Hook
 *
 * 覆盖：
 * - 基础渲染：Hook正常调用返回数据结构
 * - 数据获取：activeBonds / bondCatalog / heroFactionMap 正确提取
 * - heroNames 非空：验证修复后 heroNames 不再为空数组
 * - 边界：空数据 / 异常处理
 *
 * @module components/idle/panels/hero/hooks/__tests__/useHeroBonds.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHeroBonds } from '../useHeroBonds';
import { createMockEngine, makeMultipleGenerals } from './hero-hooks-test-utils';

// ═══════════════════════════════════════════════
// 基础渲染测试
// ═══════════════════════════════════════════════

describe('useHeroBonds — 基础渲染', () => {
  it('应正常调用并返回数据结构', () => {
    const engine = createMockEngine();
    const generals = makeMultipleGenerals();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('activeBonds');
    expect(result.current).toHaveProperty('bondCatalog');
    expect(result.current).toHaveProperty('heroFactionMap');
  });
});

// ═══════════════════════════════════════════════
// 数据获取测试
// ═══════════════════════════════════════════════

describe('useHeroBonds — 数据获取', () => {
  it('heroFactionMap 应正确映射武将→阵营', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    expect(result.current.heroFactionMap['liubei']).toBe('shu');
    expect(result.current.heroFactionMap['guanyu']).toBe('shu');
    expect(result.current.heroFactionMap['caocao']).toBe('wei');
  });

  it('bondCatalog 应包含羁绊条目', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    expect(result.current.bondCatalog.length).toBeGreaterThan(0);
  });

  it('bondCatalog 中每个条目应包含必要字段', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    result.current.bondCatalog.forEach((item) => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('heroIds');
      expect(item).toHaveProperty('heroNames');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('isActive');
    });
  });
});

// ═══════════════════════════════════════════════
// heroNames 修复验证（问题3）
// ═══════════════════════════════════════════════

describe('useHeroBonds — heroNames 不应为空', () => {
  it('阵营羁绊的 heroNames 应包含武将名称', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    // 找到蜀国阵营羁绊
    const shuBond = result.current.bondCatalog.find(
      (b) => b.faction === 'shu',
    );
    if (shuBond && shuBond.heroIds.length > 0) {
      // heroNames 不应为空数组
      expect(shuBond.heroNames.length).toBeGreaterThan(0);
      // heroNames 长度应与 heroIds 一致
      expect(shuBond.heroNames).toHaveLength(shuBond.heroIds.length);
    }
  });

  it('搭档羁绊的 heroNames 应包含武将名称', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    // 找到搭档羁绊（type 为 PARTNER）
    const partnerBonds = result.current.bondCatalog.filter(
      (b) => b.type === 2, // BondType.PARTNER = 2
    );

    partnerBonds.forEach((bond) => {
      if (bond.heroIds.length > 0) {
        // heroNames 长度应与 heroIds 一致
        expect(bond.heroNames).toHaveLength(bond.heroIds.length);
        // heroNames 不应全为 ID（应该有中文名）
        bond.heroNames.forEach((name, i) => {
          // 如果武将在 allGenerals 中，名称应匹配
          const general = generals.find((g) => g.id === bond.heroIds[i]);
          if (general) {
            expect(name).toBe(general.name);
          }
        });
      }
    });
  });
});

// ═══════════════════════════════════════════════
// 边界测试
// ═══════════════════════════════════════════════

describe('useHeroBonds — 边界条件', () => {
  it('空武将列表时应安全处理', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: [], ownedHeroIds: [] },
      ),
    );

    expect(result.current.activeBonds).toEqual([]);
    expect(result.current.bondCatalog.length).toBeGreaterThan(0); // 图鉴始终存在
    expect(result.current.heroFactionMap).toEqual({});
  });

  it('getBondSystem 抛异常时 activeBonds 应为空', () => {
    const engine = createMockEngine({
      getBondSystem: vi.fn().mockImplementation(() => { throw new Error('bond error'); }),
    });
    const generals = makeMultipleGenerals();
    const { result } = renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0 },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    expect(result.current.activeBonds).toEqual([]);
  });

  it('formationHeroIds 应优先于 ownedHeroIds', () => {
    const generals = makeMultipleGenerals();
    const mockBondSystem = {
      getActiveBonds: vi.fn().mockReturnValue([]),
    };
    const engine = createMockEngine({
      getBondSystem: vi.fn().mockReturnValue(mockBondSystem),
    });

    renderHook(() =>
      useHeroBonds(
        { engine: engine as any, snapshotVersion: 0, formationHeroIds: ['liubei'] },
        { allGenerals: generals, ownedHeroIds: generals.map((g) => g.id) },
      ),
    );

    // getActiveBonds 应被调用且传入 formationHeroIds
    expect(mockBondSystem.getActiveBonds).toHaveBeenCalledWith(['liubei']);
  });
});
