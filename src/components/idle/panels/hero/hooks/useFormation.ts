/**
 * useFormation — 编队数据 + 推荐 Hook
 *
 * 职责：
 * - 获取当前编队
 * - 提供战力计算回调
 * - 引擎驱动的推荐方案生成（战力最优 / 羁绊最优 / 平衡编队）
 * - 应用推荐编队操作
 *
 * @module components/idle/panels/hero/hooks/useFormation
 */

import { useMemo, useCallback } from 'react';
import type { HeroInfo, RecommendPlan } from '../FormationRecommendPanel';
import type { UseHeroEngineParams, UseFormationReturn } from './hero-hook.types';
import { QUALITY_ORDER, MAX_FORMATION_SLOTS } from './hero-constants';

/**
 * 编队数据 + 推荐 Hook
 *
 * 从引擎 FormationSystem 获取当前编队，结合引擎战力计算和
 * 羁绊检测生成3套推荐方案。
 */
export function useFormation(
  params: UseHeroEngineParams,
  deps: {
    /** 武将详细信息（来自 useHeroList） */
    heroInfos: HeroInfo[];
  },
): UseFormationReturn {
  const { engine, snapshotVersion } = params;
  const { heroInfos } = deps;

  // ── 当前编队 ──
  const currentFormation = useMemo((): (string | null)[] => {
    try {
      const formations = engine.getFormations();
      if (formations.length === 0) return Array(MAX_FORMATION_SLOTS).fill(null);
      const active = formations[0];
      return active.slots.map((s: { heroId?: string | null } | string | null) =>
        (s != null && typeof s === 'object' && 'heroId' in s) ? s.heroId ?? null : typeof s === 'string' ? s : null
      );
    } catch {
      return Array(MAX_FORMATION_SLOTS).fill(null);
    }
  }, [engine, snapshotVersion]);

  // ── 战力计算回调（对接引擎） ──
  const powerCalculator = useCallback(
    (heroes: HeroInfo[]): number => {
      try {
        const heroSystem = engine.getHeroSystem();
        return heroes.reduce((sum, h) => {
          const general = engine.getGeneral(h.id);
          if (general) {
            return sum + heroSystem.calculatePower(general);
          }
          // 回退：简易估算
          const qWeight = QUALITY_ORDER[h.quality] ?? 1;
          const starFactor = 1 + h.stars * 0.15;
          return sum + Math.round(h.level * qWeight * starFactor * 10);
        }, 0);
      } catch {
        return heroes.reduce((sum, h) => {
          const qWeight = QUALITY_ORDER[h.quality] ?? 1;
          return sum + h.level * qWeight * 10;
        }, 0);
      }
    },
    [engine],
  );

  // ── 应用推荐编队 ──
  const applyRecommend = useCallback(
    (heroIds: (string | null)[]) => {
      try {
        const formations = engine.getFormations();
        if (formations.length > 0) {
          const validIds = heroIds.filter((id): id is string => id != null);
          engine.getFormationSystem().setFormation(0, validIds);
        }
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  // ── 引擎驱动的推荐方案生成 ──
  const generateRecommendations = useCallback((): RecommendPlan[] => {
    if (heroInfos.length === 0) return [];

    // 辅助：计算一组武将的实际战力（调用引擎）
    const calcTeamPower = (ids: string[]): number => {
      try {
        const heroSystem = engine.getHeroSystem();
        return ids.reduce((sum, id) => {
          const general = engine.getGeneral(id);
          if (general) return sum + heroSystem.calculatePower(general);
          return sum;
        }, 0);
      } catch {
        return ids.reduce((sum, id) => {
          const h = heroInfos.find((info) => info.id === id);
          if (!h) return sum;
          const qWeight = QUALITY_ORDER[h.quality] ?? 1;
          return sum + Math.round(h.level * qWeight * (1 + h.stars * 0.15) * 10);
        }, 0);
      }
    };

    // 辅助：检测羁绊（调用引擎 BondSystem）
    const detectBondsForHeroes = (ids: string[]): string[] => {
      const bondNames: string[] = [];
      try {
        const bondSystem = engine.getBondSystem();
        const bonds = bondSystem.getActiveBonds(ids);
        for (const bond of bonds) {
          bondNames.push(bond.name);
        }
      } catch {
        // 回退：简易阵营羁绊检测
        const factionCounts: Record<string, number> = {};
        ids.forEach((id) => {
          const h = heroInfos.find((info) => info.id === id);
          if (h) factionCounts[h.faction] = (factionCounts[h.faction] || 0) + 1;
        });
        const factionNames: Record<string, string> = {
          shu: '蜀国羁绊', wei: '魏国羁绊', wu: '吴国羁绊', qun: '群雄羁绊',
        };
        for (const [faction, count] of Object.entries(factionCounts)) {
          if (count >= 2) bondNames.push(`${factionNames[faction] || faction}(${count}人)`);
        }
      }
      return bondNames;
    };

    // 按引擎战力排序
    const sorted = [...heroInfos]
      .map((h) => ({ hero: h, power: calcTeamPower([h.id]) }))
      .sort((a, b) => b.power - a.power);

    const plans: RecommendPlan[] = [];

    // 方案1：战力最优
    const bestCount = Math.min(MAX_FORMATION_SLOTS, sorted.length);
    const bestIds = sorted.slice(0, bestCount).map((h) => h.hero.id);
    const bestPower = calcTeamPower(bestIds);
    const bestBonds = detectBondsForHeroes(bestIds);
    plans.push({
      id: 'best-power',
      name: '战力最优',
      description: `选择战力最高的${bestCount}名武将`,
      heroIds: bestIds,
      estimatedPower: bestPower,
      score: Math.min(100, Math.round(bestPower / 50)),
      bonds: bestBonds,
      basis: '基于引擎战力计算，选取最高战力组合',
    });

    // 方案2：羁绊最优
    if (sorted.length > 2) {
      const factionGroups: Record<string, typeof sorted> = {};
      sorted.forEach((item) => {
        const f = item.hero.faction;
        if (!factionGroups[f]) factionGroups[f] = [];
        factionGroups[f].push(item);
      });

      let bestSynergyIds: string[] = [];
      let bestSynergyBondCount = -1;
      let bestSynergyPower = 0;

      for (const [, items] of Object.entries(factionGroups)) {
        const coreIds = items.slice(0, MAX_FORMATION_SLOTS).map((h) => h.hero.id);
        const coreIdSet = new Set(coreIds);
        const remaining = sorted.filter((h) => !coreIdSet.has(h.hero.id));
        const fullIds = [...coreIds];
        for (const r of remaining) {
          if (fullIds.length >= MAX_FORMATION_SLOTS) break;
          fullIds.push(r.hero.id);
        }

        const bonds = detectBondsForHeroes(fullIds);
        const power = calcTeamPower(fullIds);
        if (
          bonds.length > bestSynergyBondCount ||
          (bonds.length === bestSynergyBondCount && power > bestSynergyPower)
        ) {
          bestSynergyIds = fullIds;
          bestSynergyBondCount = bonds.length;
          bestSynergyPower = power;
        }
      }

      const synergyBonds = detectBondsForHeroes(bestSynergyIds);
      plans.push({
        id: 'best-synergy',
        name: '羁绊最优',
        description: `优先激活羁绊，检测到${synergyBonds.length}个羁绊`,
        heroIds: bestSynergyIds,
        estimatedPower: bestSynergyPower,
        score: Math.min(100, Math.round(bestSynergyPower / 55) + synergyBonds.length * 5),
        bonds: synergyBonds,
        basis: '基于引擎羁绊检测，最大化激活羁绊数量',
      });
    }

    // 方案3：平衡编队
    if (sorted.length > 3) {
      const byQuality: Record<string, typeof sorted> = {};
      sorted.forEach((item) => {
        const q = item.hero.quality;
        if (!byQuality[q]) byQuality[q] = [];
        byQuality[q].push(item);
      });

      const balancedIds: string[] = [];
      for (const q of ['LEGENDARY', 'EPIC', 'RARE', 'FINE', 'COMMON']) {
        const items = byQuality[q] || [];
        for (const item of items) {
          if (balancedIds.length >= MAX_FORMATION_SLOTS) break;
          balancedIds.push(item.hero.id);
        }
        if (balancedIds.length >= MAX_FORMATION_SLOTS) break;
      }

      const balancedPower = calcTeamPower(balancedIds);
      const balancedBonds = detectBondsForHeroes(balancedIds);
      plans.push({
        id: 'balanced',
        name: '平衡编队',
        description: '兼顾品质与覆盖面的均衡阵容',
        heroIds: balancedIds,
        estimatedPower: balancedPower,
        score: Math.min(100, Math.round(balancedPower / 52) + balancedBonds.length * 3),
        bonds: balancedBonds,
        basis: '基于品质分层选取，综合引擎战力与羁绊平衡',
      });
    }

    return plans;
  }, [engine, heroInfos]);

  return {
    currentFormation,
    powerCalculator,
    generateRecommendations,
    applyRecommend,
  };
}
