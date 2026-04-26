/**
 * hero-hooks-test-utils — 武将子Hook测试的共享工具
 *
 * 提供：
 * - mock 引擎工厂函数
 * - mock 武将数据工厂
 * - renderHook 辅助函数
 *
 * @module components/idle/panels/hero/hooks/__tests__/hero-hooks-test-utils
 */

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';

// ═══════════════════════════════════════════════
// 数据工厂
// ═══════════════════════════════════════════════

/** 创建 mock 武将数据 */
export function makeGeneralData(overrides: Partial<GeneralData> = {}): GeneralData {
  return {
    id: 'guanyu',
    name: '关羽',
    quality: Quality.LEGENDARY,
    baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
    level: 10,
    exp: 500,
    faction: 'shu',
    skills: [
      { id: 'skill-1', name: '青龙偃月', type: 'active', level: 1, description: '对敌方造成大量伤害' },
    ],
    ...overrides,
  };
}

/** 创建多个 mock 武将 */
export function makeMultipleGenerals(): GeneralData[] {
  return [
    makeGeneralData({ id: 'liubei', name: '刘备', faction: 'shu', quality: Quality.EPIC }),
    makeGeneralData({ id: 'guanyu', name: '关羽', faction: 'shu', quality: Quality.LEGENDARY }),
    makeGeneralData({ id: 'zhangfei', name: '张飞', faction: 'shu', quality: Quality.EPIC }),
    makeGeneralData({ id: 'caocao', name: '曹操', faction: 'wei', quality: Quality.LEGENDARY }),
  ];
}

// ═══════════════════════════════════════════════
// Mock 引擎工厂
// ═══════════════════════════════════════════════

/**
 * 创建最小化的 mock 引擎
 *
 * 包含所有子Hook所需的基本方法。
 * 每个测试可按需覆盖特定方法的返回值。
 */
export function createMockEngine(overrides: Record<string, unknown> = {}) {
  const generals = makeMultipleGenerals();

  const mockHeroStarSystem = {
    getStar: vi.fn().mockReturnValue(3),
    getLevelCap: vi.fn().mockReturnValue(100),
    getBreakthroughStage: vi.fn().mockReturnValue(0),
    getFragmentProgress: vi.fn().mockReturnValue(null),
  };

  const mockResource = {
    getAmount: vi.fn().mockReturnValue(1000),
  };

  const mockBuilding = {
    getAllBuildings: vi.fn().mockReturnValue({
      farm: { level: 3 },
      lumber: { level: 2 },
    }),
    getBuildingDef: vi.fn().mockReturnValue({ name: '农田' }),
  };

  const mockBondSystem = {
    getActiveBonds: vi.fn().mockReturnValue([]),
  };

  const mockSkillUpgradeSystem = {
    upgradeSkill: vi.fn(),
  };

  const mockHeroDispatchSystem = {
    dispatchHero: vi.fn(),
    undispatchHero: vi.fn(),
    getState: vi.fn().mockReturnValue({}),
  };

  const mockHeroSystem = {
    calculatePower: vi.fn().mockReturnValue(500),
  };

  const mockFormationSystem = {
    setFormation: vi.fn(),
  };

  const mockFormation = {
    getAllFormations: vi.fn().mockReturnValue([]),
    getActiveFormationId: vi.fn().mockReturnValue(null),
  };

  const engine = {
    getGenerals: vi.fn().mockReturnValue(generals),
    getGeneral: vi.fn().mockImplementation((id: string) =>
      generals.find((g) => g.id === id),
    ),
    getHeroStarSystem: vi.fn().mockReturnValue(mockHeroStarSystem),
    resource: mockResource,
    building: mockBuilding,
    getBondSystem: vi.fn().mockReturnValue(mockBondSystem),
    getSkillUpgradeSystem: vi.fn().mockReturnValue(mockSkillUpgradeSystem),
    getHeroDispatchSystem: vi.fn().mockReturnValue(mockHeroDispatchSystem),
    getHeroSystem: vi.fn().mockReturnValue(mockHeroSystem),
    getFormationSystem: vi.fn().mockReturnValue(mockFormationSystem),
    getFormations: vi.fn().mockReturnValue([]),
    recruit: vi.fn().mockReturnValue({ success: true, general: generals[0] }),
    enhanceHero: vi.fn().mockReturnValue({ success: true }),
    setFormation: vi.fn().mockReturnValue({ id: '0', slots: [] }),
    ...overrides,
  };

  return engine;
}

/**
 * renderHook 辅助 — 包装 Hook 并提供 act 支持
 */
export function renderHookWithEngine<T>(
  hookFn: () => T,
): ReturnType<typeof renderHook<T>> {
  return renderHook(hookFn);
}
