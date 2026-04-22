/**
 * 引擎层 — 羁绊系统
 *
 * 管理武将羁绊的检测、激活和效果计算：
 *   #1 阵营羁绊效果 — 同乡之谊(2同)/同仇敌忾(3同)/众志成城(6同)/混搭协作(3+3)
 *   #2 羁绊可视化 — 编队界面实时显示激活羁绊+属性加成预览
 *
 * @module engine/hero/BondSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { Faction } from './hero.types';
import type {
  BondId,
  BondDefinition,
  BondBonus,
  ActiveBond,
  BondPreview,
  PotentialBond,
} from '../../core/heritage';
import { BOND_DEFINITIONS, BOND_MAP } from '../../core/heritage';

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 编队中的武将信息（羁绊计算所需） */
export interface FormationHero {
  /** 武将ID */
  heroId: string;
  /** 武将阵营 */
  faction: Faction;
}

// ─────────────────────────────────────────────
// BondSystem 类
// ─────────────────────────────────────────────

/**
 * 羁绊系统
 *
 * 检测编队中的阵营羁绊，计算属性加成，提供羁绊预览。
 */
export class BondSystem implements ISubsystem {
  readonly name = 'bond';

  private deps!: ISystemDeps;

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 羁绊系统不依赖帧更新
  }

  getState(): { version: number } {
    return { version: 1 };
  }

  reset(): void {
    // 羁绊系统无状态，无需重置
  }

  // ─── 核心 API ───────────────────────────

  /**
   * 检测编队羁绊 (#1)
   * 根据编队中的武将阵营分布，返回激活的羁绊列表
   *
   * @param heroes - 编队中的武将列表
   * @returns 激活的羁绊列表
   */
  detectBonds(heroes: FormationHero[]): ActiveBond[] {
    const factionCounts = this.countFactions(heroes);
    const activeBonds: ActiveBond[] = [];

    for (const bond of BOND_DEFINITIONS) {
      const results = this.checkBondCondition(bond, factionCounts, heroes);
      activeBonds.push(...results);
    }

    return activeBonds;
  }

  /**
   * 编队羁绊预览 (#2)
   * 返回当前激活羁绊 + 总属性加成 + 潜在羁绊提示
   *
   * @param heroes - 编队中的武将列表
   * @returns 羁绊预览结果
   */
  previewBonds(heroes: FormationHero[]): BondPreview {
    const factionCounts = this.countFactions(heroes);
    const activeBonds = this.detectBonds(heroes);
    const totalBonuses = this.aggregateBonuses(activeBonds);
    const potentialBonds = this.findPotentialBonds(factionCounts, heroes.length);

    return {
      activeBonds,
      totalBonuses,
      factionCounts,
      potentialBonds,
    };
  }

  /**
   * 计算羁绊属性加成
   * 将所有激活羁绊的属性加成汇总
   *
   * @param activeBonds - 激活的羁绊列表
   * @returns 总属性加成
   */
  aggregateBonuses(activeBonds: ActiveBond[]): BondBonus {
    const total: BondBonus = {};

    for (const bond of activeBonds) {
      const bonuses = bond.bonuses;
      if (bonuses.attack) {
        total.attack = (total.attack ?? 0) + bonuses.attack;
      }
      if (bonuses.defense) {
        total.defense = (total.defense ?? 0) + bonuses.defense;
      }
      if (bonuses.intelligence) {
        total.intelligence = (total.intelligence ?? 0) + bonuses.intelligence;
      }
      if (bonuses.speed) {
        total.speed = (total.speed ?? 0) + bonuses.speed;
      }
    }

    return total;
  }

  /**
   * 获取所有羁绊定义
   */
  getAllBondDefinitions(): BondDefinition[] {
    return [...BOND_DEFINITIONS];
  }

  /**
   * 根据ID获取羁绊定义
   */
  getBondDefinition(id: BondId): BondDefinition | undefined {
    return BOND_MAP.get(id);
  }

  // ─── 内部方法 ───────────────────────────

  /** 统计各阵营武将数量 */
  private countFactions(heroes: FormationHero[]): Record<Faction, number> {
    const counts: Record<Faction, number> = { shu: 0, wei: 0, wu: 0, qun: 0 };
    for (const hero of heroes) {
      counts[hero.faction]++;
    }
    return counts;
  }

  /** 检查单个羁绊条件是否满足，返回所有匹配的激活羁绊 */
  private checkBondCondition(
    bond: BondDefinition,
    factionCounts: Record<Faction, number>,
    heroes: FormationHero[],
  ): ActiveBond[] {
    const { condition } = bond;
    const results: ActiveBond[] = [];

    if (condition.type === 'same_faction') {
      // 同阵营羁绊：找到所有满足数量的阵营，每个阵营各产生一个激活羁绊
      const minCount = condition.minSameFaction ?? 0;
      for (const faction of ['shu', 'wei', 'wu', 'qun'] as Faction[]) {
        if (factionCounts[faction] >= minCount) {
          results.push({
            bond,
            matchingFaction: faction,
            heroCount: factionCounts[faction],
            bonuses: bond.bonuses,
          });
        }
      }
    } else if (condition.type === 'mixed_factions') {
      // 混搭羁绊：检查是否有2个阵营各≥3人
      const groups = condition.factionGroups ?? [];
      if (groups.length >= 2) {
        const allMet = groups.every(
          g => factionCounts[g.faction] >= g.minCount,
        );
        if (allMet) {
          results.push({
            bond,
            matchingFaction: 'qun', // 混搭无特定阵营
            heroCount: groups.reduce(
              (sum, g) => sum + factionCounts[g.faction], 0,
            ),
            bonuses: bond.bonuses,
          });
        }
      }
    }

    return results;
  }

  /** 查找潜在可激活的羁绊 */
  private findPotentialBonds(
    factionCounts: Record<Faction, number>,
    totalHeroes: number,
  ): PotentialBond[] {
    const potentials: PotentialBond[] = [];

    for (const bond of BOND_DEFINITIONS) {
      const { condition } = bond;

      if (condition.type === 'same_faction') {
        const minCount = condition.minSameFaction ?? 0;
        // 找到数量最多但不足的阵营
        let maxFaction: Faction = 'shu';
        let maxCount = 0;
        for (const f of ['shu', 'wei', 'wu', 'qun'] as Faction[]) {
          if (factionCounts[f] > maxCount) {
            maxCount = factionCounts[f];
            maxFaction = f;
          }
        }

        if (maxCount < minCount && maxCount > 0) {
          const remaining = minCount - maxCount;
          potentials.push({
            bond,
            remainingCount: remaining,
            hint: `再上阵${remaining}名${maxFaction === 'shu' ? '蜀' : maxFaction === 'wei' ? '魏' : maxFaction === 'wu' ? '吴' : '群'}阵营武将可激活「${bond.name}」`,
          });
        }
      }
    }

    return potentials;
  }
}
