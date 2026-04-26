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
import type { BuildingBrief } from '../HeroDispatchPanel';
import type { UseHeroEngineParams, UseHeroDispatchReturn } from './hero-hook.types';

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
      const dispatchState = dispatchSystem.getState() as {
        buildingDispatch?: Record<string, { heroId: string }>;
      };

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
        dispatchSystem.dispatchHero(heroId, buildingId as import('@/games/three-kingdoms/shared/types').BuildingType);
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
        const state = dispatchSystem.getState() as {
          buildingDispatch?: Record<string, { heroId: string }>;
        };
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
