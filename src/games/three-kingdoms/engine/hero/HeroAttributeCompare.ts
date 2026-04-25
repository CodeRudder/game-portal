/**
 * 武将属性对比和构成展开 — 工具类
 *
 * 职责：属性对比（当前等级 vs 模拟等级）、属性构成展开（基础+装备+科技+buff）
 * 功能点：F10.10 属性对比、F10.11 属性构成展开
 *
 * @module engine/hero/HeroAttributeCompare
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import { gameLog } from '../../core/logger';

// ── 类型 ──

/** 属性对比结果 */
export interface AttributeComparison {
  /** 武将ID */
  heroId: string;
  /** 当前属性 */
  current: Record<string, number>;
  /** 对比目标属性（模拟等级下的属性） */
  simulated: Record<string, number>;
  /** 属性差值（simulated - current） */
  diff: Record<string, number>;
}

/** 属性构成项 */
export interface AttributeContribution {
  /** 来源类型 */
  source: 'base' | 'equipment' | 'tech' | 'buff';
  /** 来源描述 */
  label: string;
  /** 该来源提供的属性值 */
  stats: Record<string, number>;
}

/** 属性构成展开结果 */
export interface AttributeBreakdown {
  /** 武将ID */
  heroId: string;
  /** 基础属性 */
  base: Record<string, number>;
  /** 装备加成 */
  equipment: Record<string, number>;
  /** 科技加成 */
  tech: Record<string, number>;
  /** Buff加成 */
  buff: Record<string, number>;
  /** 总属性 */
  total: Record<string, number>;
}

/** 属性对比系统状态 */
export interface AttributeCompareState {
  /** 保留的对比记录 */
  lastComparisonHeroId: string | null;
}

/** 属性对比系统业务依赖 */
export interface AttributeCompareDeps {
  /** 获取武将当前属性 */
  getHeroAttrs: (heroId: string) => Record<string, number>;
  /** 获取装备加成 */
  getEquipBonus: (heroId: string) => Record<string, number>;
  /** 获取科技加成 */
  getTechBonus: (heroId: string) => Record<string, number>;
  /** 获取Buff加成 */
  getBuffBonus: (heroId: string) => Record<string, number>;
  /** 模拟指定等级下的属性 */
  simulateLevel: (heroId: string, level: number) => Record<string, number>;
}

// ── HeroAttributeCompare ──

/**
 * 武将属性对比和构成展开工具类
 *
 * 提供属性模拟对比、属性来源展开等辅助功能。
 */
export class HeroAttributeCompare implements ISubsystem {
  readonly name = 'heroAttributeCompare' as const;
  private coreDeps: ISystemDeps | null = null;
  private deps: AttributeCompareDeps;
  private state: AttributeCompareState;

  constructor() {
    this.state = { lastComparisonHeroId: null };
    // 默认空实现，等待业务依赖注入
    this.deps = {
      getHeroAttrs: () => ({}),
      getEquipBonus: () => ({}),
      getTechBonus: () => ({}),
      getBuffBonus: () => ({}),
      simulateLevel: () => ({}),
    };
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
    this.deps = {
      getHeroAttrs: () => ({}),
      getEquipBonus: () => ({}),
      getTechBonus: () => ({}),
      getBuffBonus: () => ({}),
      simulateLevel: () => ({}),
    };
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
   * 对比武将当前属性与模拟等级下的属性差异。
   * 如果不传 simulateLevel，则 current === simulated，diff 全为 0。
   *
   * @param heroId - 武将ID
   * @param simulateLevel - 模拟目标等级
   * @returns 属性对比结果
   */
  compareAttributes(heroId: string, simulateLevel?: number): AttributeComparison {
    const current = this.deps.getHeroAttrs(heroId);
    const simulated = simulateLevel
      ? this.deps.simulateLevel(heroId, simulateLevel)
      : current;

    const diff: Record<string, number> = {};
    for (const key of Object.keys({ ...current, ...simulated })) {
      diff[key] = (simulated[key] || 0) - (current[key] || 0);
    }

    this.state.lastComparisonHeroId = heroId;

    return { heroId, current, simulated, diff };
  }

  // ═══════════════════════════════════════════
  // F10.11: 属性构成展开
  // ═══════════════════════════════════════════

  /**
   * 属性构成展开
   *
   * 将武将总属性拆分为基础属性、装备加成、科技加成、Buff加成。
   *
   * @param heroId - 武将ID
   * @returns 属性构成展开结果
   */
  getAttributeBreakdown(heroId: string): AttributeBreakdown {
    const base = this.deps.getHeroAttrs(heroId);
    const equipment = this.deps.getEquipBonus(heroId);
    const tech = this.deps.getTechBonus(heroId);
    const buff = this.deps.getBuffBonus(heroId);

    const total: Record<string, number> = {};
    for (const key of Object.keys({ ...base, ...equipment, ...tech, ...buff })) {
      total[key] = (base[key] || 0) + (equipment[key] || 0) + (tech[key] || 0) + (buff[key] || 0);
    }

    return { heroId, base, equipment, tech, buff, total };
  }
}
