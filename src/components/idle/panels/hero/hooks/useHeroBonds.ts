/**
 * useHeroBonds — 羁绊数据 Hook
 *
 * 职责：
 * - 获取已激活羁绊列表
 * - 生成羁绊图鉴数据（阵营羁绊 + 搭档羁绊）
 * - 提供武将→阵营映射
 *
 * 解耦说明（R12）：
 * - 不再依赖 useHeroList 的返回值（allGenerals、ownedHeroIds）
 * - 直接从引擎获取武将数据，确保子 Hook 独立可用
 *
 * @module components/idle/panels/hero/hooks/useHeroBonds
 */

import { useMemo } from 'react';
import type { ActiveBond } from '@/games/three-kingdoms/engine/hero/BondSystem';
import type { BondCatalogItem } from '../BondCollectionPanel';
import type { UseHeroEngineParams, UseHeroBondsReturn } from './hero-hook.types';
import { BondType, FACTION_BONDS, PARTNER_BONDS } from '@/games/three-kingdoms/engine/hero/bond-config';
import { adaptBondEffects as adaptEffects } from '../hero-ui.types';
import { STAT_LABELS } from './hero-constants';
import { FACTIONS } from '@/games/three-kingdoms/engine/hero/hero.types';

/** FACTIONS 只读数组，用于 Set 快速查找 */
const FACTION_SET: ReadonlySet<string> = new Set(FACTIONS);

/**
 * 羁绊数据 Hook
 *
 * 从引擎获取武将和羁绊数据，生成完整的羁绊图鉴。
 * 不依赖其他子 Hook 的返回值，直接从引擎获取所需数据。
 */
export function useHeroBonds(
  params: UseHeroEngineParams,
): UseHeroBondsReturn {
  const { engine, snapshotVersion, formationHeroIds } = params;

  // ── 从引擎直接获取武将数据（不依赖 useHeroList） ──
  const allGenerals = useMemo(() => {
    try {
      const raw = engine?.getGenerals?.() ?? [];
      if (Array.isArray(raw)) return raw;
      // 类型断言原因：getGenerals() 返回类型为 Readonly<GeneralData>[]，
      // 但运行时可能返回 Record 格式（旧版存档兼容），此处已通过
      // typeof raw === 'object' 校验，断言安全
      if (raw && typeof raw === 'object') {
        return Object.values(raw as Record<string, typeof raw[number]>);
      }
      return [];
    } catch {
      return [];
    }
  }, [engine, snapshotVersion]);

  const ownedHeroIds = useMemo(
    () => allGenerals.map((g) => g.id),
    [allGenerals],
  );

  // ── 武将→阵营映射 ──
  const heroFactionMap = useMemo(() => {
    const map: Record<string, string> = {};
    allGenerals.forEach((g) => {
      // Faction 为联合类型，直接取值
      map[g.id] = FACTION_SET.has(g.faction) ? g.faction : String(g.faction);
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

  // ── 武将ID→名称映射（从引擎数据构建） ──
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
