/**
 * useHeroDispatch — 派遣数据 + 操作 Hook
 *
 * 职责：
 * - 获取建筑列表及派遣状态
 * - 提供武将派遣/召回操作
 *
 * @module components/idle/panels/hero/hooks/useHeroDispatch
 */

import { useMemo, useCallback } from 'react';
import type { BuildingType } from '@/games/three-kingdoms/shared/types';
import type { BuildingBrief } from '../HeroDispatchPanel';
import type { UseHeroEngineParams, UseHeroDispatchReturn } from './hero-hook.types';

/** HeroDispatchSystem.getState() 返回的派遣状态结构 */
interface DispatchState {
  buildingDispatch?: Record<string, { heroId: string }>;
  heroDispatch?: Record<string, string>;
}

/** 合法建筑类型集合，用于运行时校验 */
const VALID_BUILDING_TYPES: ReadonlySet<string> = new Set<string>([
  'castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall',
]);

/**
 * 安全将字符串转换为 BuildingType
 *
 * UI 层 buildingId 来自 buildingSystem.getAllBuildings() 的 key，
 * 理论上均为合法 BuildingType，但做运行时校验更安全。
 * 不匹配时返回 null，由调用方决定如何处理。
 *
 * 类型断言原因：VALID_BUILDING_TYPES 已在运行时验证 id 为合法值，
 * 此处断言等价于类型收窄，安全可靠。
 */
function toBuildingType(id: string): BuildingType | null {
  return VALID_BUILDING_TYPES.has(id) ? (id as BuildingType) : null;
}

/**
 * 派遣数据 + 操作 Hook
 *
 * 从引擎 BuildingSystem 获取建筑列表及派遣状态，
 * 提供武将派遣和召回操作。
 */
export function useHeroDispatch(params: UseHeroEngineParams): UseHeroDispatchReturn {
  const { engine, snapshotVersion } = params;

  // ── 建筑数据 ──
  const buildings = useMemo((): BuildingBrief[] => {
    try {
      const buildingSystem = engine.building;
      if (!buildingSystem) return [];
      const allBuildings = buildingSystem.getAllBuildings();
      const dispatchSystem = engine.getHeroDispatchSystem();
      // 类型断言原因：getState() 返回 Record<string, unknown>，
      // 我们定义了 DispatchState 接口来提供类型安全的访问，
      // 这是引擎 API 限制下的最佳实践（引擎不提供泛型 getState）
      const dispatchState = dispatchSystem.getState() as DispatchState;

      return Object.entries(allBuildings).map(
        ([id, bld]): BuildingBrief => ({
          id,
          name: buildingSystem.getBuildingDef?.(id)?.name ?? id,
          level: bld.level,
          dispatchHeroId: dispatchState?.buildingDispatch?.[id]?.heroId ?? null,
        }),
      );
    } catch {
      return [];
    }
  }, [engine, snapshotVersion]);

  // ── 派遣操作 ──
  const dispatchHero = useCallback(
    (heroId: string, buildingId: string) => {
      try {
        const dispatchSystem = engine.getHeroDispatchSystem();
        const buildingType = toBuildingType(buildingId);
        if (!buildingType) return; // 无效建筑类型，静默忽略
        dispatchSystem.dispatchHero(heroId, buildingType);
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  // ── 召回操作 ──
  const recallHero = useCallback(
    (buildingId: string) => {
      try {
        const dispatchSystem = engine.getHeroDispatchSystem();
        // 类型断言原因：同上，getState() 返回 Record<string, unknown>
        const state = dispatchSystem.getState() as DispatchState;
        const record = state?.buildingDispatch?.[buildingId];
        if (record?.heroId) {
          dispatchSystem.undispatchHero(record.heroId);
        }
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  return {
    buildings,
    dispatchHero,
    recallHero,
  };
}
