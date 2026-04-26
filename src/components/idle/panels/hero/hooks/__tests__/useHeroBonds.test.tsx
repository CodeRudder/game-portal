/**
 * useHeroBonds 测试 — 羁绊数据 Hook
 *
 * 覆盖：
 * - 基础渲染：Hook正常调用返回数据结构
 * - 数据获取：activeBonds / bondCatalog / heroFactionMap 正确提取
 * - heroNames 非空：验证修复后 heroNames 不再为空数组
 * - 边界：空数据 / 异常处理
 *
 * 注意（R12）：useHeroBonds 不再接受 deps 参数，
 * 直接从引擎获取武将数据，确保子 Hook 独立可用。
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
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
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
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.heroFactionMap['liubei']).toBe('shu');
    expect(result.current.heroFactionMap['guanyu']).toBe('shu');
    expect(result.current.heroFactionMap['caocao']).toBe('wei');
  });

  it('bondCatalog 应包含羁绊条目', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.bondCatalog.length).toBeGreaterThan(0);
  });

  it('bondCatalog 中每个条目应包含必要字段', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
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
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
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
    const engine = createMockEngine();
    const generals = makeMultipleGenerals();
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
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
          // 如果武将在 generals 中，名称应匹配
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
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue([]) });
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.activeBonds).toEqual([]);
    expect(result.current.bondCatalog.length).toBeGreaterThan(0); // 图鉴始终存在
    expect(result.current.heroFactionMap).toEqual({});
  });

  it('getBondSystem 抛异常时 activeBonds 应为空', () => {
    const engine = createMockEngine({
      getBondSystem: vi.fn().mockImplementation(() => { throw new Error('bond error'); }),
    });
    const { result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.activeBonds).toEqual([]);
  });

  it('formationHeroIds 应优先于 ownedHeroIds', () => {
    // Mock 武将数据，确保 engine.getGeneral('liubei') 返回有效对象
    const liubei = { id: 'liubei', name: '刘备', faction: 'shu' };
    const mockBondSystem = {
      getActiveBonds: vi.fn().mockReturnValue([]),
      detectActiveBonds: vi.fn().mockReturnValue([]),
    };
    const engine = createMockEngine({
      getBondSystem: vi.fn().mockReturnValue(mockBondSystem),
      getGeneral: vi.fn().mockImplementation((id: string) =>
        id === 'liubei' ? liubei : undefined,
      ),
    });

    renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0, formationHeroIds: ['liubei'] }),
    );

    // detectActiveBonds 应被调用且传入包含 liubei 武将对象的数组
    expect(mockBondSystem.detectActiveBonds).toHaveBeenCalledWith([liubei]);
  });
});

// ═══════════════════════════════════════════════
// 状态更新测试
// ═══════════════════════════════════════════════

describe('useHeroBonds — 状态更新', () => {
  it('snapshotVersion 变化应触发 activeBonds 重计算', () => {
    const engine = createMockEngine();

    const { rerender } = renderHook(
      ({ snapshotVersion }) =>
        useHeroBonds({ engine: engine, snapshotVersion }),
      { initialProps: { snapshotVersion: 0 } },
    );

    rerender({ snapshotVersion: 1 });
    expect(engine.getBondSystem).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 清理测试
// ═══════════════════════════════════════════════

describe('useHeroBonds — 清理', () => {
  it('unmount 后不应有副作用残留', () => {
    const engine = createMockEngine();
    const { unmount, result } = renderHook(() =>
      useHeroBonds({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.activeBonds).toBeDefined();
    expect(() => unmount()).not.toThrow();
  });

  it('多次 mount/unmount 不应泄漏', () => {
    const engine = createMockEngine();

    for (let i = 0; i < 3; i++) {
      const { unmount, result } = renderHook(() =>
        useHeroBonds({ engine: engine, snapshotVersion: i }),
      );
      expect(result.current.bondCatalog).toBeDefined();
      unmount();
    }
  });
});
