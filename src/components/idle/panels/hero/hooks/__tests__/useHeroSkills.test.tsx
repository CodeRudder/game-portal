/**
 * useHeroSkills 测试 — 技能数据 + 升级操作 Hook
 *
 * 覆盖：
 * - 基础渲染：Hook正常调用返回数据结构
 * - 数据获取：skills / skillBookAmount / goldAmount 正确提取
 * - 操作方法：upgradeSkill 调用引擎方法
 * - 边界：空数据 / 未选中武将 / 异常处理
 *
 * @module components/idle/panels/hero/hooks/__tests__/useHeroSkills.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHeroSkills } from '../useHeroSkills';
import { createMockEngine, makeGeneralData } from './hero-hooks-test-utils';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';

// ═══════════════════════════════════════════════
// 基础渲染测试
// ═══════════════════════════════════════════════

describe('useHeroSkills — 基础渲染', () => {
  it('应正常调用并返回数据结构', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('skills');
    expect(result.current).toHaveProperty('skillBookAmount');
    expect(result.current).toHaveProperty('goldAmount');
    expect(result.current).toHaveProperty('upgradeSkill');
  });

  it('未选中武将时 skills 应为空数组', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0 }),
    );

    expect(result.current.skills).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// 数据获取测试
// ═══════════════════════════════════════════════

describe('useHeroSkills — 数据获取', () => {
  it('应返回选中武将的技能列表', () => {
    const general = makeGeneralData({
      id: 'guanyu',
      skills: [
        { id: 's1', name: '青龙偃月', type: 'active', level: 1, description: '主动技能' },
        { id: 's2', name: '武圣', type: 'passive', level: 2, description: '被动技能' },
      ],
    });
    const mockStarSystem = {
      getStar: vi.fn().mockReturnValue(3),
      getLevelCap: vi.fn().mockReturnValue(100),
      getBreakthroughStage: vi.fn().mockReturnValue(0),
    };
    const engine = createMockEngine({
      getGeneral: vi.fn().mockReturnValue(general),
      getHeroStarSystem: vi.fn().mockReturnValue(mockStarSystem),
    });

    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    expect(result.current.skills).toHaveLength(2);
    expect(result.current.skills[0].id).toBe('s1');
    expect(result.current.skills[1].id).toBe('s2');
  });

  it('应正确提取技能升级消耗', () => {
    const general = makeGeneralData({
      id: 'guanyu',
      skills: [
        { id: 's1', name: '技能1', type: 'active', level: 1, description: '描述' },
      ],
    });
    const mockStarSystem = {
      getStar: vi.fn().mockReturnValue(3),
      getLevelCap: vi.fn().mockReturnValue(100),
      getBreakthroughStage: vi.fn().mockReturnValue(0),
    };
    const engine = createMockEngine({
      getGeneral: vi.fn().mockReturnValue(general),
      getHeroStarSystem: vi.fn().mockReturnValue(mockStarSystem),
    });

    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    const skill = result.current.skills[0];
    expect(skill.upgradeCost).toBeDefined();
    expect(skill.upgradeCost?.skillBook).toBe(1); // level 1 → skillBook: 1
    expect(skill.upgradeCost?.gold).toBe(500);    // level 1 → copper: 500
  });

  it('应正确获取资源数量', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    expect(result.current.skillBookAmount).toBe(1000);
    expect(result.current.goldAmount).toBe(1000);
  });

  it('技能应包含 cooldown 字段', () => {
    const general = makeGeneralData({
      id: 'guanyu',
      skills: [
        { id: 's1', name: '主动技', type: 'active', level: 1, description: '描述' },
        { id: 's2', name: '被动技', type: 'passive', level: 1, description: '描述' },
      ],
    });
    const mockStarSystem = {
      getStar: vi.fn().mockReturnValue(3),
      getLevelCap: vi.fn().mockReturnValue(100),
      getBreakthroughStage: vi.fn().mockReturnValue(0),
    };
    const engine = createMockEngine({
      getGeneral: vi.fn().mockReturnValue(general),
      getHeroStarSystem: vi.fn().mockReturnValue(mockStarSystem),
    });

    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    // 主动技能默认 cooldown=8，被动技能默认 cooldown=0
    expect(result.current.skills[0].cooldown).toBe(8);
    expect(result.current.skills[1].cooldown).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 操作方法测试
// ═══════════════════════════════════════════════

describe('useHeroSkills — 操作方法', () => {
  it('upgradeSkill 应调用引擎 skillUpgradeSystem', () => {
    const general = makeGeneralData({
      id: 'guanyu',
      skills: [{ id: 's1', name: '技能', type: 'active', level: 1, description: '描述' }],
    });
    const mockSkillSystem = { upgradeSkill: vi.fn() };
    const engine = createMockEngine({
      getGeneral: vi.fn().mockReturnValue(general),
      getSkillUpgradeSystem: vi.fn().mockReturnValue(mockSkillSystem),
    });

    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    act(() => {
      result.current.upgradeSkill('guanyu', 0);
    });

    expect(mockSkillSystem.upgradeSkill).toHaveBeenCalledWith('guanyu', 0, {
      skillBook: 1,
      copper: 500,
    });
  });
});

// ═══════════════════════════════════════════════
// 边界测试
// ═══════════════════════════════════════════════

describe('useHeroSkills — 边界条件', () => {
  it('getGeneral 返回 undefined 时 skills 应为空', () => {
    const engine = createMockEngine({ getGeneral: vi.fn().mockReturnValue(undefined) });
    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'nonexistent' }),
    );

    expect(result.current.skills).toEqual([]);
  });

  it('getHeroStarSystem 抛异常时 skills 应为空（catch 兜底）', () => {
    const general = makeGeneralData({
      id: 'guanyu',
      skills: [{ id: 's1', name: '技能', type: 'active', level: 1, description: '描述' }],
    });
    const engine = createMockEngine({
      getGeneral: vi.fn().mockReturnValue(general),
      getHeroStarSystem: vi.fn().mockImplementation(() => { throw new Error('no star'); }),
    });

    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    // 整个 skills useMemo 被 try-catch 包裹，异常时返回空数组
    expect(result.current.skills).toEqual([]);
  });

  it('资源系统异常时应返回 0', () => {
    const engine = createMockEngine({
      resource: { getAmount: vi.fn().mockImplementation(() => { throw new Error('no resource'); }) },
    });
    const { result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    expect(result.current.skillBookAmount).toBe(0);
    expect(result.current.goldAmount).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 状态更新测试
// ═══════════════════════════════════════════════

describe('useHeroSkills — 状态更新', () => {
  it('selectedHeroId 变化应更新技能列表', () => {
    const guanyu = makeGeneralData({
      id: 'guanyu',
      skills: [{ id: 's1', name: '青龙偃月', type: 'active', level: 1, description: '描述' }],
    });
    const liubei = makeGeneralData({
      id: 'liubei',
      skills: [{ id: 's2', name: '仁德', type: 'active', level: 2, description: '描述' }],
    });
    const mockStarSystem = {
      getStar: vi.fn().mockReturnValue(3),
      getLevelCap: vi.fn().mockReturnValue(100),
      getBreakthroughStage: vi.fn().mockReturnValue(0),
    };
    const engine = createMockEngine({
      getGeneral: vi.fn().mockImplementation((id: string) =>
        id === 'guanyu' ? guanyu : id === 'liubei' ? liubei : undefined,
      ),
      getHeroStarSystem: vi.fn().mockReturnValue(mockStarSystem),
    });

    const { result, rerender } = renderHook(
      ({ selectedHeroId }) =>
        useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId }),
      { initialProps: { selectedHeroId: 'guanyu' as string | undefined } },
    );

    expect(result.current.skills[0].id).toBe('s1');

    // 切换到刘备
    rerender({ selectedHeroId: 'liubei' });
    expect(result.current.skills[0].id).toBe('s2');

    // 取消选择
    rerender({ selectedHeroId: undefined });
    expect(result.current.skills).toEqual([]);
  });

  it('snapshotVersion 变化应触发资源数据重计算', () => {
    const engine = createMockEngine();

    const { rerender } = renderHook(
      ({ snapshotVersion }) =>
        useHeroSkills({ engine: engine, snapshotVersion, selectedHeroId: 'guanyu' }),
      { initialProps: { snapshotVersion: 0 } },
    );

    rerender({ snapshotVersion: 1 });
    // resource.getAmount 应被调用
    expect(engine.resource.getAmount).toHaveBeenCalled();
  });
})

// ═══════════════════════════════════════════════
// 清理测试
// ═══════════════════════════════════════════════

describe('useHeroSkills — 清理', () => {
  it('unmount 后不应有副作用残留', () => {
    const engine = createMockEngine();
    const { unmount, result } = renderHook(() =>
      useHeroSkills({ engine: engine, snapshotVersion: 0, selectedHeroId: 'guanyu' }),
    );

    expect(result.current.skills).toBeDefined();
    expect(() => unmount()).not.toThrow();
  });

  it('多次 mount/unmount 不应泄漏', () => {
    for (let i = 0; i < 3; i++) {
      const engine = createMockEngine();
      const { unmount, result } = renderHook(() =>
        useHeroSkills({ engine: engine, snapshotVersion: i, selectedHeroId: 'guanyu' }),
      );
      expect(result.current.skills).toBeDefined();
      unmount();
    }
  });
});
