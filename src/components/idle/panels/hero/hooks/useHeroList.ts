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
import type { GeneralData, HeroStarSystem } from '@/games/three-kingdoms/engine';
import type { Faction } from '@/games/three-kingdoms/shared/types';
import { FACTIONS } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { HeroBrief } from '../HeroDispatchPanel';
import type { HeroInfo } from '../FormationRecommendPanel';
import type { UseHeroEngineParams, UseHeroListReturn } from './hero-hook.types';

/** FACTIONS 只读数组，用于 Set 快速查找 */
const FACTION_SET: ReadonlySet<string> = new Set(FACTIONS);

/**
 * 将引擎枚举/联合类型安全转换为字符串
 *
 * Quality 枚举值为字符串字面量（如 'COMMON'），
 * Faction 为联合类型（如 'shu'），均可用 String() 转换。
 */
function toString(value: string): string {
  return String(value);
}

/**
 * 安全判断值是否为合法 Faction
 */
function toFactionString(value: string): string {
  return FACTION_SET.has(value) ? value : String(value);
}

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
      if (Array.isArray(raw)) return raw;
      // 引擎可能返回 Record<string, GeneralData>，手动提取 values
      // 类型断言原因：getGenerals() 返回类型为 Readonly<GeneralData>[]，
      // 但运行时可能返回 Record 格式（旧版存档兼容），此处已通过
      // typeof raw === 'object' 校验，断言安全
      if (raw && typeof raw === 'object') {
        return Object.values(raw as Record<string, GeneralData>);
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

  // ── 2. 武将简要数据（HeroBrief） ──
  const heroBriefs = useMemo((): HeroBrief[] => {
    let starSystem: HeroStarSystem | null = null;
    try {
      starSystem = engine.getHeroStarSystem() ?? null;
    } catch { /* 引擎未初始化 */ }

    return allGenerals.map((g): HeroBrief => ({
      id: g.id,
      name: g.name,
      level: g.level,
      quality: toString(g.quality),
      stars: starSystem?.getStar(g.id) ?? 1,
    }));
  }, [allGenerals, engine]);

  // ── 3. 武将详细信息（HeroInfo） ──
  const heroInfos = useMemo((): HeroInfo[] => {
    let starSystem: HeroStarSystem | null = null;
    try {
      starSystem = engine.getHeroStarSystem() ?? null;
    } catch { /* 引擎未初始化 */ }

    return allGenerals.map((g): HeroInfo => ({
      id: g.id,
      name: g.name,
      level: g.level,
      quality: toString(g.quality),
      stars: starSystem?.getStar(g.id) ?? 1,
      faction: toFactionString(g.faction),
    }));
  }, [allGenerals, engine]);

  return {
    allGenerals,
    ownedHeroIds,
    heroBriefs,
    heroInfos,
  };
}
