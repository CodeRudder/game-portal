/**
 * useHeroList — 武将列表数据 Hook
 *
 * 职责：
 * - 从引擎获取所有武将数据
 * - 提供已拥有武将ID列表
 * - 生成武将简要数据（HeroBrief）和详细信息（HeroInfo）
 *
 * @module components/idle/panels/hero/hooks/useHeroList
 */

import { useMemo } from 'react';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import type { HeroBrief } from '../HeroDispatchPanel';
import type { HeroInfo } from '../FormationRecommendPanel';
import type { HeroStarSystemLike } from '../hero-ui.types';
import type { UseHeroEngineParams, UseHeroListReturn } from './hero-hook.types';

/**
 * 武将列表数据 Hook
 *
 * 从引擎提取武将列表、简要数据和详细信息。
 * 所有计算均使用 useMemo 缓存，依赖 snapshotVersion 触发更新。
 */
export function useHeroList(params: UseHeroEngineParams): UseHeroListReturn {
  const { engine, snapshotVersion } = params;

  // ── 1. 获取所有武将 ──
  const allGenerals = useMemo(() => {
    void snapshotVersion;
    try {
      const raw = engine?.getGenerals?.() ?? [];
      return Array.isArray(raw) ? raw : raw ? Object.values(raw as Record<string, GeneralData>) : [];
    } catch {
      return [];
    }
  }, [engine, snapshotVersion]);

  const ownedHeroIds = useMemo(
    () => allGenerals.map((g) => g.id),
    [allGenerals],
  );

  // ── 2. 武将简要数据（HeroBrief） ──
  const heroBriefs = useMemo((): HeroBrief[] => {
    let starSystem: HeroStarSystemLike | null = null;
    try {
      starSystem = (engine as unknown as { getHeroStarSystem(): HeroStarSystemLike }).getHeroStarSystem() ?? null;
    } catch { /* 引擎未初始化 */ }

    return allGenerals.map((g): HeroBrief => ({
      id: g.id,
      name: g.name,
      level: g.level,
      quality: g.quality as string,
      stars: starSystem?.getStar(g.id) ?? 1,
    }));
  }, [allGenerals, engine]);

  // ── 3. 武将详细信息（HeroInfo） ──
  const heroInfos = useMemo((): HeroInfo[] => {
    let starSystem: HeroStarSystemLike | null = null;
    try {
      starSystem = (engine as unknown as { getHeroStarSystem(): HeroStarSystemLike }).getHeroStarSystem() ?? null;
    } catch { /* 引擎未初始化 */ }

    return allGenerals.map((g): HeroInfo => ({
      id: g.id,
      name: g.name,
      level: g.level,
      quality: g.quality as string,
      stars: starSystem?.getStar(g.id) ?? 1,
      faction: g.faction as string,
    }));
  }, [allGenerals, engine]);

  return {
    allGenerals,
    ownedHeroIds,
    heroBriefs,
    heroInfos,
  };
}
