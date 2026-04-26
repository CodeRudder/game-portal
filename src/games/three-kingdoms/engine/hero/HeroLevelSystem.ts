/**
 * 武将升级系统 — 聚合根
 * 职责：经验管理、升级消耗计算、属性成长、一键强化、批量强化
 * 规则：依赖 HeroSystem，通过回调解耦 ResourceSystem
 * 功能点：经验获取(9)、升级消耗(10)、一键强化(11)、一键强化全部(12)
 * @module engine/hero/HeroLevelSystem
 */

import type { GeneralData, GeneralStats } from './hero.types';
import { QUALITY_ORDER } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from './hero-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ── 类型 ──

export type ResourceSpendFn = (resourceType: string, amount: number) => boolean;
export type ResourceCheckFn = (resourceType: string, amount: number) => boolean;
export type ResourceGetFn = (resourceType: string) => number;

/** 升级系统业务依赖（通过回调解耦 ResourceSystem / HeroStarSystem） */
export interface LevelDeps {
  heroSystem: HeroSystem;
  spendResource: ResourceSpendFn;
  canAffordResource: ResourceCheckFn;
  getResourceAmount: ResourceGetFn;
  /**
   * 获取武将当前等级上限（由突破阶段决定）。
   * 返回值：50 / 60 / 70 / 80 / 100。
   * 如未注入，fallback 到 HERO_MAX_LEVEL(50)。
   */
  getLevelCap?: (generalId: string) => number;
}

/** 属性变化快照 */
export interface StatsDiff { before: GeneralStats; after: GeneralStats; }

/** 单次升级结果 */
export interface LevelUpResult {
  general: GeneralData;
  levelsGained: number;
  goldSpent: number;
  expSpent: number;
  statsDiff: StatsDiff;
}

/** 强化预览信息 */
export interface EnhancePreview {
  generalId: string;
  generalName: string;
  currentLevel: number;
  targetLevel: number;
  totalExp: number;
  totalGold: number;
  statsDiff: StatsDiff;
  powerBefore: number;
  powerAfter: number;
  affordable: boolean;
}

/** 批量强化结果 */
export interface BatchEnhanceResult {
  results: LevelUpResult[];
  totalGoldSpent: number;
  totalExpSpent: number;
  totalPowerGain: number;
}

/** 升级系统存档数据 */
export interface LevelSaveData { version: number; }

// ── 常量 ──

const GOLD_TYPE = 'gold';
const EXP_TYPE = 'grain';
const LEVEL_SAVE_VERSION = 1;
/** 每级属性成长率 3% */
const STAT_GROWTH_RATE = 0.03;

// ── 辅助函数 ──

/** 查表获取升到下一级所需经验（PRD HER-3）
 *  1~70 级均有分段配置，超出范围使用最后一段的系数 */
function lookupExpRequired(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.expPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
}

/** 查表获取升级所需铜钱（PRD HER-3）
 *  1~70 级均有分段配置，超出范围使用最后一段的系数 */
function lookupGoldRequired(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.goldPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
}

/** 从 fromLevel 到 toLevel 的总经验 */
function totalExpBetween(from: number, to: number): number {
  let t = 0;
  for (let lv = from; lv < to; lv++) t += lookupExpRequired(lv);
  return t;
}

/** 从 fromLevel 到 toLevel 的总铜钱 */
function totalGoldBetween(from: number, to: number): number {
  let t = 0;
  for (let lv = from; lv < to; lv++) t += lookupGoldRequired(lv);
  return t;
}

/** 计算指定等级的属性：baseStats × (1 + (level-1) × 0.03) */
function statsAtLevel(base: GeneralStats, level: number): GeneralStats {
  const m = 1 + (level - 1) * STAT_GROWTH_RATE;
  return {
    attack: Math.floor(base.attack * m),
    defense: Math.floor(base.defense * m),
    intelligence: Math.floor(base.intelligence * m),
    speed: Math.floor(base.speed * m),
  };
}

/** 按战力降序 + 品质降序排列（PRD HER-3 优先级） */
function sortByPriority(hs: HeroSystem, list: GeneralData[]): GeneralData[] {
  return [...list].sort((a, b) => {
    const d = hs.calculatePower(b) - hs.calculatePower(a);
    return d !== 0 ? d : (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0);
  });
}

// ── HeroLevelSystem ──

/**
 * 武将升级系统
 *
 * 管理武将经验获取、升级消耗、属性成长、一键强化和批量强化。
 * 通过回调解耦资源系统，不直接依赖 ResourceSystem。
 *
 * @example
 * ```ts
 * const ls = new HeroLevelSystem();
 * ls.setLevelDeps({ heroSystem, spendResource, canAffordResource, getResourceAmount });
 * ls.quickEnhance('guanyu', 20); // 一键强化到 20 级
 * ```
 */
export class HeroLevelSystem implements ISubsystem {
  readonly name = 'heroLevel' as const;
  private deps: ISystemDeps | null = null;
  private levelDeps: LevelDeps | null = null;

  // ── ISubsystem ──

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留 */ }
  getState(): unknown { return this.serialize(); }
  reset(): void { /* 无额外状态 */ }

  /** 设置业务依赖 */
  setLevelDeps(deps: LevelDeps): void { this.levelDeps = deps; }

  // ── 动态等级上限 ──

  /**
   * 获取武将的当前等级上限。
   *
   * 优先从 HeroStarSystem.getLevelCap() 动态获取（突破阶段决定），
   * 若未注入回调则 fallback 到 HERO_MAX_LEVEL(50)。
   *
   * 突破阶段 → 等级上限：0→50, 1→60, 2→70, 3→80, 4→100
   */
  private getMaxLevel(generalId: string): number {
    if (this.levelDeps?.getLevelCap) {
      return this.levelDeps.getLevelCap(generalId);
    }
    return HERO_MAX_LEVEL;
  }

  /** 获取武将的等级上限（公开方法，供外部查询） */
  getHeroMaxLevel(generalId: string): number {
    return this.getMaxLevel(generalId);
  }

  // ── 1. 消耗计算（纯函数） ──

  /** 升到下一级所需经验；满级返回 0 */
  calculateExpToNextLevel(level: number, generalId?: string): number {
    const cap = generalId ? this.getMaxLevel(generalId) : HERO_MAX_LEVEL;
    return level >= cap ? 0 : lookupExpRequired(level);
  }

  /** 升到下一级所需铜钱；满级返回 0 */
  calculateLevelUpCost(level: number, generalId?: string): number {
    const cap = generalId ? this.getMaxLevel(generalId) : HERO_MAX_LEVEL;
    return level >= cap ? 0 : lookupGoldRequired(level);
  }

  /** 从 fromLevel 到 toLevel 的总经验 */
  calculateTotalExp(from: number, to: number, generalId?: string): number {
    const cap = generalId ? this.getMaxLevel(generalId) : HERO_MAX_LEVEL;
    if (to <= from || from >= cap) return 0;
    return totalExpBetween(from, Math.min(to, cap));
  }

  /** 从 fromLevel 到 toLevel 的总铜钱 */
  calculateTotalGold(from: number, to: number, generalId?: string): number {
    const cap = generalId ? this.getMaxLevel(generalId) : HERO_MAX_LEVEL;
    if (to <= from || from >= cap) return 0;
    return totalGoldBetween(from, Math.min(to, cap));
  }

  // ── 2. 经验获取（功能点9） ──

  /**
   * 给武将添加经验，自动逐级检查升级
   * 铜钱不足则停在耗尽的那级，剩余经验保留在经验条中
   */
  addExp(generalId: string, amount: number): LevelUpResult | null {
    if (!this.levelDeps || amount <= 0) return null;
    const { heroSystem } = this.levelDeps;
    const general = heroSystem.getGeneral(generalId);
    const maxLevel = this.getMaxLevel(generalId);
    if (!general || general.level >= maxLevel) return null;

    const beforeLevel = general.level;
    const beforeStats = statsAtLevel(general.baseStats, beforeLevel);
    let curLv = general.level, curExp = general.exp, rem = amount;
    let goldSpent = 0, gained = 0;

    while (rem > 0 && curLv < maxLevel) {
      const expReq = lookupExpRequired(curLv);
      const goldReq = lookupGoldRequired(curLv);
      const acc = curExp + rem;

      if (acc >= expReq) {
        if (!this.levelDeps.canAffordResource(GOLD_TYPE, goldReq)) {
          curExp = acc; rem = 0; break;
        }
        if (!this.levelDeps.spendResource(GOLD_TYPE, goldReq)) {
          curExp = acc; rem = 0; break;
        }
        goldSpent += goldReq;
        rem = acc - expReq;
        curLv += 1; curExp = 0; gained += 1;
      } else {
        curExp = acc; rem = 0;
      }
    }

    if (gained === 0 && curExp === general.exp) return null;
    this.syncToHeroSystem(heroSystem, generalId, curLv, curExp);

    return {
      general: heroSystem.getGeneral(generalId)!,
      levelsGained: gained,
      goldSpent: goldSpent,
      expSpent: amount - Math.max(0, curExp - general.exp),
      statsDiff: { before: beforeStats, after: statsAtLevel(general.baseStats, curLv) },
    };
  }

  // ── 3. 升级操作（功能点10） ──

  /** 升一级，前提：经验 >= expRequired 且铜钱充足 */
  levelUp(generalId: string): LevelUpResult | null {
    if (!this.levelDeps) return null;
    const { heroSystem } = this.levelDeps;
    const general = heroSystem.getGeneral(generalId);
    const maxLevel = this.getMaxLevel(generalId);
    if (!general || general.level >= maxLevel) return null;

    const expReq = this.calculateExpToNextLevel(general.level);
    const goldReq = this.calculateLevelUpCost(general.level);
    if (general.exp < expReq) return null;
    if (!this.levelDeps.canAffordResource(GOLD_TYPE, goldReq)) return null;

    const beforeStats = statsAtLevel(general.baseStats, general.level);
    this.levelDeps.spendResource(GOLD_TYPE, goldReq);
    const newLv = general.level + 1;
    this.syncToHeroSystem(heroSystem, generalId, newLv, general.exp - expReq);

    return {
      general: heroSystem.getGeneral(generalId)!,
      levelsGained: 1, goldSpent: goldReq, expSpent: expReq,
      statsDiff: { before: beforeStats, after: statsAtLevel(general.baseStats, newLv) },
    };
  }

  // ── 4. 一键强化（功能点11） ──

  /** 获取强化预览（不执行实际操作），targetLevel 超上限自动截断 */
  getEnhancePreview(generalId: string, targetLevel: number): EnhancePreview | null {
    if (!this.levelDeps) return null;
    const { heroSystem } = this.levelDeps;
    const general = heroSystem.getGeneral(generalId);
    if (!general) return null;

    const maxLevel = this.getMaxLevel(generalId);
    const capped = Math.min(targetLevel, maxLevel);
    const cur = general.level;

    if (cur >= capped) {
      const s = statsAtLevel(general.baseStats, cur);
      const pwr = heroSystem.calculatePower(general);
      return {
        generalId, generalName: general.name, currentLevel: cur, targetLevel: cur,
        totalExp: 0, totalGold: 0, statsDiff: { before: s, after: s },
        powerBefore: pwr, powerAfter: pwr, affordable: true,
      };
    }

    const totalExp = Math.max(0, totalExpBetween(cur, capped) - general.exp);
    const totalGold = totalGoldBetween(cur, capped);
    const affordable =
      this.levelDeps.canAffordResource(EXP_TYPE, totalExp)
      && this.levelDeps.canAffordResource(GOLD_TYPE, totalGold);

    const tempG: GeneralData = { ...general, level: capped };
    return {
      generalId, generalName: general.name, currentLevel: cur, targetLevel: capped,
      totalExp, totalGold,
      statsDiff: { before: statsAtLevel(general.baseStats, cur), after: statsAtLevel(general.baseStats, capped) },
      powerBefore: heroSystem.calculatePower(general),
      powerAfter: heroSystem.calculatePower(tempG),
      affordable,
    };
  }

  /** 一键强化到目标等级，资源不足时强化到允许的最高等级 */
  quickEnhance(generalId: string, targetLevel?: number): LevelUpResult | null {
    if (!this.levelDeps) return null;
    const { heroSystem } = this.levelDeps;
    const general = heroSystem.getGeneral(generalId);
    const maxLevel = this.getMaxLevel(generalId);
    if (!general || general.level >= maxLevel) return null;

    const maxLv = this.calculateMaxAffordableLevel(general);
    const final = targetLevel !== undefined
      ? Math.min(targetLevel, maxLv, maxLevel) : maxLv;
    if (final <= general.level) return null;

    const beforeLv = general.level;
    const beforeStats = statsAtLevel(general.baseStats, beforeLv);
    const goldNeed = totalGoldBetween(beforeLv, final);
    const expNeed = Math.max(0, totalExpBetween(beforeLv, final) - general.exp);

    if (goldNeed > 0 && !this.levelDeps.spendResource(GOLD_TYPE, goldNeed)) return null;
    if (expNeed > 0 && !this.levelDeps.spendResource(EXP_TYPE, expNeed)) return null;
    this.syncToHeroSystem(heroSystem, generalId, final, 0);

    return {
      general: heroSystem.getGeneral(generalId)!,
      levelsGained: final - beforeLv, goldSpent: goldNeed, expSpent: expNeed,
      statsDiff: { before: beforeStats, after: statsAtLevel(general.baseStats, final) },
    };
  }

  // ── 5. 一键强化全部（功能点12） ──

  /** 批量强化所有武将，按优先级排序，资源不足自动跳过 */
  quickEnhanceAll(targetLevel?: number): BatchEnhanceResult {
    const empty: BatchEnhanceResult = { results: [], totalGoldSpent: 0, totalExpSpent: 0, totalPowerGain: 0 };
    if (!this.levelDeps) return empty;

    const { heroSystem } = this.levelDeps;
    const sorted = sortByPriority(
      heroSystem, heroSystem.getAllGenerals().filter((g) => g.level < this.getMaxLevel(g.id)),
    );
    if (sorted.length === 0) return empty;

    const results: LevelUpResult[] = [];
    let totalGold = 0, totalExp = 0, totalPower = 0;

    for (const g of sorted) {
      const pwrBefore = heroSystem.calculatePower(g);
      const r = this.quickEnhance(g.id, targetLevel);
      if (r && r.levelsGained > 0) {
        results.push(r);
        totalGold += r.goldSpent;
        totalExp += r.expSpent;
        const updated = heroSystem.getGeneral(g.id);
        totalPower += (updated ? heroSystem.calculatePower(updated) : pwrBefore) - pwrBefore;
      }
    }

    return { results, totalGoldSpent: totalGold, totalExpSpent: totalExp, totalPowerGain: totalPower };
  }

  // ── 5b. B13 批量升级（按指定 ID 列表） ──

  /**
   * 批量升级指定武将列表
   *
   * 按列表顺序依次尝试升级，跳过不存在/满级/资源不足的武将。
   * 返回成功列表、跳过列表及汇总统计。
   */
  batchUpgrade(
    heroIds: string[],
    targetLevel?: number,
  ): BatchEnhanceResult & { skipped: string[] } {
    const empty: BatchEnhanceResult & { skipped: string[] } = {
      results: [], totalGoldSpent: 0, totalExpSpent: 0, totalPowerGain: 0, skipped: [],
    };
    if (!this.levelDeps) return empty;

    const { heroSystem } = this.levelDeps;
    const results: LevelUpResult[] = [];
    const skipped: string[] = [];
    let totalGold = 0, totalExp = 0, totalPower = 0;

    for (const id of heroIds) {
      const general = heroSystem.getGeneral(id);
      if (!general || general.level >= this.getMaxLevel(id)) {
        skipped.push(id);
        continue;
      }

      const pwrBefore = heroSystem.calculatePower(general);
      const r = this.quickEnhance(id, targetLevel);
      if (r && r.levelsGained > 0) {
        results.push(r);
        totalGold += r.goldSpent;
        totalExp += r.expSpent;
        const updated = heroSystem.getGeneral(id);
        totalPower += (updated ? heroSystem.calculatePower(updated) : pwrBefore) - pwrBefore;
      } else {
        skipped.push(id);
      }
    }

    return { results, totalGoldSpent: totalGold, totalExpSpent: totalExp, totalPowerGain: totalPower, skipped };
  }

  /** 批量强化预览（默认前5个） */
  getBatchEnhancePreview(targetLevel?: number, limit = 5): EnhancePreview[] {
    if (!this.levelDeps) return [];
    const { heroSystem } = this.levelDeps;
    const sorted = sortByPriority(
      heroSystem, heroSystem.getAllGenerals().filter((g) => g.level < this.getMaxLevel(g.id)),
    );
    const previews: EnhancePreview[] = [];
    for (const g of sorted) {
      if (previews.length >= limit) break;
      const t = targetLevel ?? this.calculateMaxAffordableLevel(g);
      const p = this.getEnhancePreview(g.id, t);
      if (p && p.currentLevel < p.targetLevel) previews.push(p);
    }
    return previews;
  }

  // ── 6. 查询 ──

  /** 计算资源允许的最高可达等级 */
  calculateMaxAffordableLevel(general: GeneralData): number {
    const maxLevel = this.getMaxLevel(general.id);
    if (!this.levelDeps || general.level >= maxLevel) return general.level;
    let remExp = this.levelDeps.getResourceAmount(EXP_TYPE) + general.exp;
    let remGold = this.levelDeps.getResourceAmount(GOLD_TYPE);
    let lv = general.level;

    while (lv < maxLevel) {
      const eR = lookupExpRequired(lv), gR = lookupGoldRequired(lv);
      if (remExp < eR || remGold < gR) break;
      remExp -= eR; remGold -= gR; lv += 1;
    }
    return lv;
  }

  /** 获取武将经验进度 */
  getExpProgress(generalId: string): { current: number; required: number; percentage: number } | null {
    if (!this.levelDeps) return null;
    const g = this.levelDeps.heroSystem.getGeneral(generalId);
    if (!g) return null;
    const maxLevel = this.getMaxLevel(generalId);
    if (g.level >= maxLevel) return { current: 0, required: 0, percentage: 100 };
    const req = this.calculateExpToNextLevel(g.level, generalId);
    return {
      current: g.exp, required: req,
      percentage: req > 0 ? Math.min(100, Math.floor((g.exp / req) * 100)) : 0,
    };
  }

  /** 检查武将是否可升级 */
  canLevelUp(generalId: string): boolean {
    if (!this.levelDeps) return false;
    const g = this.levelDeps.heroSystem.getGeneral(generalId);
    const maxLevel = this.getMaxLevel(generalId);
    if (!g || g.level >= maxLevel) return false;
    return g.exp >= this.calculateExpToNextLevel(g.level, generalId)
      && this.levelDeps.canAffordResource(GOLD_TYPE, this.calculateLevelUpCost(g.level, generalId));
  }

  /** 获取所有可升级的武将ID */
  getUpgradableGeneralIds(): string[] {
    if (!this.levelDeps) return [];
    return this.levelDeps.heroSystem.getAllGenerals()
      .filter((g) => g.level < this.getMaxLevel(g.id) && this.canLevelUp(g.id))
      .map((g) => g.id);
  }

  // ── 7. 序列化 ──

  serialize(): LevelSaveData { return { version: LEVEL_SAVE_VERSION }; }
  deserialize(_data: LevelSaveData): void { /* 预留 */ }

  // ── 8. 内部方法 ──

  /** 将等级和经验同步到 HeroSystem */
  private syncToHeroSystem(hs: HeroSystem, id: string, newLv: number, newExp: number): void {
    const g = hs.getGeneral(id);
    if (!g) return;
    if (newLv <= g.level && newExp === g.exp) return;

    // 直接设置等级和经验，避免 addExp 的自动升级逻辑导致经验计算偏差
    hs.setLevelAndExp(id, newLv, newExp);
  }
}
