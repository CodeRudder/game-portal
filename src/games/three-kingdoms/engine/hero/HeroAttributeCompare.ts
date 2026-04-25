/**
 * 武将属性对比和构成展开 — 工具类
 *
 * 职责：属性对比（当前等级 vs 模拟等级）、属性构成展开（基础+装备+科技+buff）
 * 功能点：F10.10 属性对比、F10.11 属性构成展开
 *
 * @module engine/hero/HeroAttributeCompare
 */

import type { GeneralStats, GeneralData } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import type { HeroStarSystem } from './HeroStarSystem';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import { getStarMultiplier } from './star-up-config';
import { QUALITY_MULTIPLIERS } from './hero-config';
import { gameLog } from '../../core/logger';

// ── 类型 ──

/** 属性对比结果 */
export interface AttributeComparison {
  /** 武将ID */
  heroId: string;
  /** 武将名称 */
  heroName: string;
  /** 当前属性 */
  current: GeneralStats;
  /** 对比目标属性（模拟等级/星级下的属性） */
  simulated: GeneralStats;
  /** 属性差值（simulated - current） */
  diff: GeneralStats;
  /** 当前等级 */
  currentLevel: number;
  /** 模拟等级 */
  simulatedLevel: number;
}

/** 属性构成项 */
export interface AttributeContribution {
  /** 来源类型 */
  source: 'base' | 'star' | 'equipment' | 'tech' | 'buff';
  /** 来源描述 */
  label: string;
  /** 该来源提供的属性值 */
  stats: GeneralStats;
}

/** 属性构成展开结果 */
export interface AttributeBreakdown {
  /** 武将ID */
  heroId: string;
  /** 武将名称 */
  heroName: string;
  /** 总属性 */
  total: GeneralStats;
  /** 各来源属性构成 */
  contributions: AttributeContribution[];
}

/** 属性对比系统状态 */
export interface AttributeCompareState {
  /** 保留的对比记录（可选） */
  lastComparisonHeroId: string | null;
}

/** 属性对比系统业务依赖 */
export interface AttributeCompareDeps {
  heroSystem: HeroSystem;
  heroStarSystem: HeroStarSystem;
}

// ── 常量 ──

/** 科技加成比例（示例值，后续可配置化） */
const TECH_STAT_BONUS_RATE = 0.05;

/** Buff加成比例（示例值，后续可配置化） */
const BUFF_STAT_BONUS_RATE = 0.03;

// ── HeroAttributeCompare ──

/**
 * 武将属性对比和构成展开工具类
 *
 * 提供属性模拟对比、属性来源展开等辅助功能。
 */
export class HeroAttributeCompare implements ISubsystem {
  readonly name = 'heroAttributeCompare' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: AttributeCompareDeps | null = null;
  private state: AttributeCompareState;

  constructor() {
    this.state = { lastComparisonHeroId: null };
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.coreDeps = deps;
    gameLog.info('[HeroAttributeCompare] initialized');
  }

  update(_dt: number): void {
    // 无需每帧更新
  }

  getState(): AttributeCompareState {
    return { ...this.state };
  }

  reset(): void {
    this.state = { lastComparisonHeroId: null };
  }

  // ── 依赖注入 ──

  /** 注入业务依赖 */
  setAttributeCompareDeps(deps: AttributeCompareDeps): void {
    this.deps = deps;
  }

  // ═══════════════════════════════════════════
  // F10.10: 属性对比
  // ═══════════════════════════════════════════

  /**
   * 属性对比
   *
   * 对比武将当前属性与模拟等级/星级下的属性差异。
   * 如果不传 simulateLevel，默认对比下一级。
   *
   * @param heroId - 武将ID
   * @param simulateLevel - 模拟目标等级（默认当前等级+1）
   * @returns 属性对比结果，或 null（武将不存在）
   */
  compareAttributes(heroId: string, simulateLevel?: number): AttributeComparison | null {
    if (!this.deps) return null;

    const general = this.deps.heroSystem.getGeneral(heroId);
    if (!general) return null;

    const star = this.deps.heroStarSystem.getStar(heroId);
    const currentLevel = general.level;
    const targetLevel = simulateLevel ?? currentLevel + 1;

    const current = this.calculateTotalStats(general, star, currentLevel);
    const simulated = this.calculateTotalStats(general, star, targetLevel);

    this.state.lastComparisonHeroId = heroId;

    return {
      heroId,
      heroName: general.name,
      current,
      simulated,
      diff: {
        attack: simulated.attack - current.attack,
        defense: simulated.defense - current.defense,
        intelligence: simulated.intelligence - current.intelligence,
        speed: simulated.speed - current.speed,
      },
      currentLevel,
      simulatedLevel: targetLevel,
    };
  }

  // ═══════════════════════════════════════════
  // F10.11: 属性构成展开
  // ═══════════════════════════════════════════

  /**
   * 属性构成展开
   *
   * 将武将总属性拆分为基础属性、星级加成、装备加成、科技加成、Buff加成。
   *
   * @param heroId - 武将ID
   * @returns 属性构成展开结果，或 null（武将不存在）
   */
  getAttributeBreakdown(heroId: string): AttributeBreakdown | null {
    if (!this.deps) return null;

    const general = this.deps.heroSystem.getGeneral(heroId);
    if (!general) return null;

    const star = this.deps.heroStarSystem.getStar(heroId);
    const qualityCoeff = QUALITY_MULTIPLIERS[general.quality] ?? 1;
    const starCoeff = getStarMultiplier(star);

    // 1. 基础属性（品质系数）
    const baseStats = this.scaleStats(general.baseStats, qualityCoeff);

    // 2. 星级加成 = 基础属性 × (星级系数 - 1)
    const starBonus = this.scaleStats(baseStats, starCoeff - 1);

    // 3. 装备加成（示例：基础属性的10%，后续对接装备系统）
    const equipmentBonus = this.scaleStats(baseStats, 0.1);

    // 4. 科技加成
    const techBonus = this.scaleStats(baseStats, TECH_STAT_BONUS_RATE);

    // 5. Buff加成
    const buffBonus = this.scaleStats(baseStats, BUFF_STAT_BONUS_RATE);

    const total = this.sumStats(baseStats, starBonus, equipmentBonus, techBonus, buffBonus);

    const contributions: AttributeContribution[] = [
      { source: 'base', label: '基础属性', stats: this.roundStats(baseStats) },
      { source: 'star', label: `星级加成（${star}星）`, stats: this.roundStats(starBonus) },
      { source: 'equipment', label: '装备加成', stats: this.roundStats(equipmentBonus) },
      { source: 'tech', label: '科技加成', stats: this.roundStats(techBonus) },
      { source: 'buff', label: 'Buff加成', stats: this.roundStats(buffBonus) },
    ];

    return {
      heroId,
      heroName: general.name,
      total: this.roundStats(total),
      contributions,
    };
  }

  // ── 内部方法 ──

  /** 计算指定等级/星级下的总属性 */
  private calculateTotalStats(general: GeneralData, star: number, level: number): GeneralStats {
    const qualityCoeff = QUALITY_MULTIPLIERS[general.quality] ?? 1;
    const starCoeff = getStarMultiplier(star);
    const levelCoeff = 1 + level * 0.05;

    const baseStats = this.scaleStats(general.baseStats, qualityCoeff);
    const withStar = this.scaleStats(baseStats, starCoeff);
    const withLevel = this.scaleStats(withStar, levelCoeff);
    const withEquipment = this.scaleStats(withLevel, 1.1); // 装备加成10%
    const withTech = this.scaleStats(withEquipment, 1 + TECH_STAT_BONUS_RATE);
    const withBuff = this.scaleStats(withTech, 1 + BUFF_STAT_BONUS_RATE);

    return this.roundStats(withBuff);
  }

  /** 属性缩放 */
  private scaleStats(stats: GeneralStats, multiplier: number): GeneralStats {
    return {
      attack: Math.floor(stats.attack * multiplier),
      defense: Math.floor(stats.defense * multiplier),
      intelligence: Math.floor(stats.intelligence * multiplier),
      speed: Math.floor(stats.speed * multiplier),
    };
  }

  /** 属性求和 */
  private sumStats(...allStats: GeneralStats[]): GeneralStats {
    return allStats.reduce(
      (acc, s) => ({
        attack: acc.attack + s.attack,
        defense: acc.defense + s.defense,
        intelligence: acc.intelligence + s.intelligence,
        speed: acc.speed + s.speed,
      }),
      { attack: 0, defense: 0, intelligence: 0, speed: 0 },
    );
  }

  /** 四舍五入属性值 */
  private roundStats(stats: GeneralStats): GeneralStats {
    return {
      attack: Math.floor(stats.attack),
      defense: Math.floor(stats.defense),
      intelligence: Math.floor(stats.intelligence),
      speed: Math.floor(stats.speed),
    };
  }
}
