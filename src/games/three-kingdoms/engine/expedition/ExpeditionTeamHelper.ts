/**
 * 远征队伍管理 — 辅助模块
 *
 * 从 ExpeditionSystem 拆分出的队伍编成、校验、战力计算逻辑。
 * 包含：创建队伍、校验编队、阵营羁绊、战力计算、智能编队
 *
 * @module engine/expedition/ExpeditionTeamHelper
 */

import type { ExpeditionTeam, FormationType } from '../../core/expedition/expedition.types';
import {
  FACTION_BOND_THRESHOLD,
  FACTION_BOND_BONUS,
  MAX_HEROES_PER_TEAM,
  TROOP_COST,
  FORMATION_EFFECTS,
} from '../../core/expedition/expedition.types';
import type { Faction } from '../hero/hero.types';

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 武将简要信息（用于编队计算） */
export interface HeroBrief {
  id: string;
  faction: Faction;
  power: number;
}

/** 编队校验结果 */
export interface TeamValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  factionBond: boolean;
  totalPower: number;
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一ID */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────
// 队伍管理类
// ─────────────────────────────────────────────

/**
 * 远征队伍管理器
 *
 * 提供队伍创建、校验、战力计算、智能编队等静态方法。
 * 被 ExpeditionSystem 委托调用。
 */
export class ExpeditionTeamHelper {
  /** 校验队伍编成 */
  static validateTeam(
    heroIds: string[],
    formation: FormationType,
    heroDataMap: Record<string, HeroBrief>,
    activeTeams: ExpeditionTeam[],
  ): TeamValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 武将数量
    if (heroIds.length === 0) {
      errors.push('至少需要1名武将');
    }
    if (heroIds.length > MAX_HEROES_PER_TEAM) {
      errors.push(`武将数量不能超过${MAX_HEROES_PER_TEAM}名`);
    }

    // 武将互斥检查
    const activeHeroIds = new Set<string>();
    for (const team of activeTeams) {
      for (const hid of team.heroIds) {
        activeHeroIds.add(hid);
      }
    }
    for (const hid of heroIds) {
      if (activeHeroIds.has(hid)) {
        errors.push(`武将${hid}已在其他远征队伍中`);
      }
    }

    // 检查武将是否存在
    for (const hid of heroIds) {
      if (!heroDataMap[hid]) {
        errors.push(`武将${hid}不存在`);
      }
    }

    // 阵营羁绊
    const factionBond = ExpeditionTeamHelper.checkFactionBond(heroIds, heroDataMap);
    if (heroIds.length >= FACTION_BOND_THRESHOLD && !factionBond) {
      warnings.push('当前编队未触发阵营羁绊');
    }

    const totalPower = ExpeditionTeamHelper.calculateTeamPower(heroIds, heroDataMap, formation);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      factionBond,
      totalPower,
    };
  }

  /** 检查阵营羁绊 */
  static checkFactionBond(heroIds: string[], heroDataMap: Record<string, HeroBrief>): boolean {
    const factionCounts: Record<string, number> = {};
    for (const hid of heroIds) {
      const hero = heroDataMap[hid];
      if (hero) {
        factionCounts[hero.faction] = (factionCounts[hero.faction] ?? 0) + 1;
      }
    }
    return Object.values(factionCounts).some(count => count >= FACTION_BOND_THRESHOLD);
  }

  /** 计算队伍总战力 */
  static calculateTeamPower(
    heroIds: string[],
    heroDataMap: Record<string, HeroBrief>,
    formation: FormationType,
  ): number {
    let totalPower = 0;
    const effect = FORMATION_EFFECTS[formation];
    const hasBond = ExpeditionTeamHelper.checkFactionBond(heroIds, heroDataMap);
    const bondMultiplier = hasBond ? (1 + FACTION_BOND_BONUS) : 1;

    for (const hid of heroIds) {
      const hero = heroDataMap[hid];
      if (hero) {
        const avgMod = (effect.attackMod + effect.defenseMod + effect.speedMod + effect.intelligenceMod) / 4;
        totalPower += hero.power * (1 + avgMod) * bondMultiplier;
      }
    }

    return Math.round(totalPower);
  }

  /** 智能编队 — 基于战力+阵营羁绊自动填充 */
  static autoComposeTeam(
    availableHeroes: HeroBrief[],
    activeHeroIds: Set<string>,
    formation: FormationType,
    maxHeroes: number = MAX_HEROES_PER_TEAM,
  ): string[] {
    const candidates = availableHeroes
      .filter(h => !activeHeroIds.has(h.id))
      .sort((a, b) => b.power - a.power);

    if (candidates.length === 0) return [];

    // 尝试触发阵营羁绊
    const factionGroups: Record<string, HeroBrief[]> = {};
    for (const hero of candidates) {
      if (!factionGroups[hero.faction]) {
        factionGroups[hero.faction] = [];
      }
      factionGroups[hero.faction].push(hero);
    }

    // 找到最多同阵营的英雄组
    let bestFaction: string | null = null;
    let bestCount = 0;
    for (const [faction, heroes] of Object.entries(factionGroups)) {
      if (heroes.length >= FACTION_BOND_THRESHOLD && heroes.length > bestCount) {
        bestFaction = faction;
        bestCount = heroes.length;
      }
    }

    const selected: HeroBrief[] = [];

    if (bestFaction && bestCount >= FACTION_BOND_THRESHOLD) {
      const factionHeroes = factionGroups[bestFaction]
        .sort((a, b) => b.power - a.power)
        .slice(0, Math.min(FACTION_BOND_THRESHOLD, maxHeroes));
      selected.push(...factionHeroes);

      const remaining = maxHeroes - selected.length;
      if (remaining > 0) {
        const selectedIds = new Set(selected.map(h => h.id));
        const others = candidates
          .filter(h => !selectedIds.has(h.id))
          .sort((a, b) => b.power - a.power)
          .slice(0, remaining);
        selected.push(...others);
      }
    } else {
      selected.push(...candidates.slice(0, maxHeroes));
    }

    return selected.map(h => h.id);
  }

  /** 计算出征兵力消耗 */
  static calculateTroopCost(heroCount: number): number {
    return heroCount * TROOP_COST.expeditionPerHero;
  }
}
