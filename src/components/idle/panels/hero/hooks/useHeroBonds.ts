/**
 * useHeroBonds — 羁绊数据 Hook
 *
 * 职责：
 * - 获取已激活羁绊列表
 * - 生成羁绊图鉴数据（阵营羁绊 + 搭档羁绊）
 * - 提供武将→阵营映射
 *
 * @module components/idle/panels/hero/hooks/useHeroBonds
 */

import { useMemo } from 'react';
import type { ActiveBond } from '@/games/three-kingdoms/engine/hero/BondSystem';
import type { BondCatalogItem } from '../BondCollectionPanel';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import type { UseHeroEngineParams, UseHeroBondsReturn } from './hero-hook.types';
import { BondType, FACTION_BONDS, PARTNER_BONDS } from '@/games/three-kingdoms/engine/hero/bond-config';
import { adaptBondEffects as adaptEffects } from '../hero-ui.types';
import { STAT_LABELS } from './hero-constants';

/**
 * 羁绊数据 Hook
 *
 * 从引擎 BondSystem 获取激活羁绊，并结合配置表
 * 生成完整的羁绊图鉴数据。
 */
export function useHeroBonds(
  params: UseHeroEngineParams,
  deps: {
    /** 所有武将数据（来自 useHeroList） */
    allGenerals: GeneralData[];
    /** 已拥有武将ID列表（来自 useHeroList） */
    ownedHeroIds: string[];
  },
): UseHeroBondsReturn {
  const { engine, snapshotVersion, formationHeroIds } = params;
  const { allGenerals, ownedHeroIds } = deps;

  // ── 武将→阵营映射 ──
  const heroFactionMap = useMemo(() => {
    const map: Record<string, string> = {};
    allGenerals.forEach((g) => {
      map[g.id] = g.faction as string;
    });
    return map;
  }, [allGenerals]);

  // ── 已激活羁绊 ──
  const activeBonds = useMemo((): ActiveBond[] => {
    try {
      const bondSystem = engine.getBondSystem();
      const ids = formationHeroIds ?? allGenerals.map((g) => g.id);
      return bondSystem.getActiveBonds(ids);
    } catch {
      return [];
    }
  }, [engine, formationHeroIds, allGenerals, snapshotVersion]);

  // ── 武将ID→名称映射（从 allGenerals 构建） ──
  const heroNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    allGenerals.forEach((g) => {
      map[g.id] = g.name;
    });
    return map;
  }, [allGenerals]);

  // ── 羁绊图鉴 ──
  const bondCatalog = useMemo((): BondCatalogItem[] => {
    const items: BondCatalogItem[] = [];
    const activeBondIds = new Set(activeBonds.map((b) => b.bondId));
    const ids = formationHeroIds ?? ownedHeroIds;

    // 阵营羁绊
    for (const fb of FACTION_BONDS) {
      const isActive = activeBondIds.has(fb.id);
      const activeBond = activeBonds.find((b) => b.bondId === fb.id);
      const highestTier = fb.tiers[fb.tiers.length - 1];

      // 过滤出属于该阵营的已拥有武将
      const factionHeroIds = ids.filter((heroId) => heroFactionMap[heroId] === fb.faction);
      // 将武将ID映射为名称
      const factionHeroNames = factionHeroIds.map((id) => heroNameMap[id] ?? id);

      const desc = fb.tiers.map((t) =>
        `${t.requiredCount}人: ${t.effects.map((e) => `${STAT_LABELS[e.stat] ?? e.stat}+${Math.round(e.value * 100)}%`).join(', ')}`
      ).join(' | ');

      items.push({
        id: fb.id,
        name: fb.name,
        type: BondType.FACTION,
        faction: fb.faction,
        heroIds: factionHeroIds,
        heroNames: factionHeroNames,
        description: desc,
        level: activeBond?.level ?? 0,
        effects: adaptEffects(highestTier.effects),
        isActive,
        minRequired: fb.tiers[0]?.requiredCount ?? 2,
      });
    }

    // 搭档羁绊
    for (const pb of PARTNER_BONDS) {
      const isActive = activeBondIds.has(pb.id);
      const activeBond = activeBonds.find((b) => b.bondId === pb.id);

      const desc = pb.effects.map((e) =>
        `${STAT_LABELS[e.stat] ?? e.stat}+${Math.round(e.value * 100)}%`
      ).join(', ');

      // 将搭档武将ID映射为名称
      const partnerHeroNames = pb.generalIds.map((id) => heroNameMap[id] ?? id);

      items.push({
        id: pb.id,
        name: pb.name,
        type: BondType.PARTNER,
        heroIds: [...pb.generalIds],
        heroNames: partnerHeroNames,
        description: desc,
        level: activeBond?.level ?? 0,
        effects: adaptEffects(pb.effects),
        isActive,
        minRequired: pb.minRequired,
      });
    }

    return items;
  }, [activeBonds, formationHeroIds, ownedHeroIds, heroFactionMap, heroNameMap]);

  return {
    activeBonds,
    bondCatalog,
    heroFactionMap,
  };
}
