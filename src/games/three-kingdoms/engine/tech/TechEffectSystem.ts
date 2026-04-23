/**
 * 科技域 — 科技效果统一管理与分发
 *
 * 职责：
 * - 聚合所有已完成科技的效果
 * - 按路线分类查询加成（军事/经济/文化）
 * - 提供统一的效果查询接口 getEffectBonus(category, stat)
 * - 支持按 target（兵种/资源类型等）精确查询
 * - 效果缓存机制，科技完成时刷新
 */
import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EffectCategory,
  MilitaryStat,
  EconomyStat,
  CultureStat,
  EffectStat,
  EffectCache,
} from './tech-effect-types';
import {
  MILITARY_EFFECT_MAP,
  ECONOMY_EFFECT_MAP,
  CULTURE_EFFECT_MAP,
} from './tech-effect-types';
import type { TechTreeSystem } from './TechTreeSystem';
import type { TechEffect, TechEffectType, TechNodeDef } from './tech.types';
import { TECH_NODE_DEFS } from './tech-config';

export type {
  EffectCategory,
  MilitaryStat,
  EconomyStat,
  CultureStat,
  EffectStat,
} from './tech-effect-types';

export class TechEffectSystem implements ISubsystem {
  readonly name = 'tech-effect' as const;
  private deps: ISystemDeps | null = null;

  /** 引用科技树系统以获取完成状态 */
  private techTree: TechTreeSystem | null = null;

  /** 效果缓存 */
  private cache: EffectCache;

  constructor() {
    this.cache = this.createEmptyCache();
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 效果系统不需要每帧更新
  }

  getState(): Record<string, unknown> {
    this.ensureCache();
    return {
      military: Object.fromEntries(this.cache.military.stats),
      economy: Object.fromEntries(this.cache.economy.stats),
      culture: Object.fromEntries(this.cache.culture.stats),
      global: Object.fromEntries(this.cache.global),
    };
  }

  reset(): void {
    this.cache = this.createEmptyCache();
    this.techTree = null;
  }

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入科技树系统引用 */
  setTechTree(techTree: TechTreeSystem): void {
    this.techTree = techTree;
    this.invalidateCache();
  }

  // ─────────────────────────────────────────
  // 缓存管理
  // ─────────────────────────────────────────

  /** 使缓存失效（科技完成时调用） */
  invalidateCache(): void {
    this.cache.valid = false;
  }

  /** 确保缓存有效 */
  private ensureCache(): void {
    if (this.cache.valid) return;
    this.rebuildCache();
    this.cache.valid = true;
  }

  // ─────────────────────────────────────────
  // 核心查询接口
  // ─────────────────────────────────────────

  /**
   * 统一效果查询接口
   *
   * @param category - 效果大类（military/economy/culture）
   * @param stat - 统计项名称
   * @returns 加成值（百分比，如 10 表示 +10%）
   *
   * @example
   * ```ts
   * // 查询军事路线攻击力加成
   * const atkBonus = system.getEffectBonus('military', 'attack');
   * // 查询经济路线资源产出加成
   * const prodBonus = system.getEffectBonus('economy', 'production');
   * ```
   */
  getEffectBonus(category: EffectCategory, stat: EffectStat): number {
    this.ensureCache();
    const pathCache = this.cache[category];
    return pathCache.stats.get(stat) ?? 0;
  }

  /**
   * 获取全局效果加成（合并所有路线）
   *
   * @param stat - 统计项名称
   * @returns 全局加成值
   */
  getGlobalBonus(stat: EffectStat): number {
    this.ensureCache();
    return this.cache.global.get(stat) ?? 0;
  }

  /**
   * 按目标类型精确查询效果值
   *
   * @param effectType - 科技效果类型
   * @param target - 目标（如 'cavalry', 'grain', 'all'）
   * @returns 匹配 target 和 'all' 的效果值之和
   */
  getEffectValueByTarget(effectType: TechEffectType, target: string): number {
    if (!this.techTree) return 0;
    return this.techTree.getEffectValue(effectType, target);
  }

  /**
   * 获取指定路线的所有效果汇总
   *
   * @param category - 效果大类
   * @returns 该路线所有统计项的汇总
   */
  getPathBonuses(category: EffectCategory): Record<string, number> {
    this.ensureCache();
    const pathCache = this.cache[category];
    const result: Record<string, number> = {};
    for (const [stat, value] of pathCache.stats) {
      result[stat] = value;
    }
    return result;
  }

  /**
   * 获取所有路线的完整效果汇总
   */
  getAllBonuses(): Record<EffectCategory, Record<string, number>> {
    this.ensureCache();
    return {
      military: this.getPathBonuses('military'),
      economy: this.getPathBonuses('economy'),
      culture: this.getPathBonuses('culture'),
    };
  }

  // ─────────────────────────────────────────
  // 军事效果快捷方法
  // ─────────────────────────────────────────

  /** 获取攻击力加成 % */
  getAttackBonus(target: string = 'all'): number {
    return this.getEffectValueByTarget('troop_attack', target);
  }

  /** 获取防御力加成 % */
  getDefenseBonus(target: string = 'all'): number {
    return this.getEffectValueByTarget('troop_defense', target);
  }

  /** 获取生命值加成 % */
  getHpBonus(target: string = 'all'): number {
    return this.getEffectValueByTarget('troop_hp', target);
  }

  /** 获取行军速度加成 % */
  getMarchSpeedBonus(): number {
    return this.getEffectValueByTarget('march_speed', 'all');
  }

  // ─────────────────────────────────────────
  // 经济效果快捷方法
  // ─────────────────────────────────────────

  /** 获取资源产出加成 % */
  getProductionBonus(target: string = 'all'): number {
    return this.getEffectValueByTarget('resource_production', target);
  }

  /** 获取资源上限加成 % */
  getStorageBonus(target: string = 'all'): number {
    return this.getEffectValueByTarget('resource_cap', target);
  }

  // ─────────────────────────────────────────
  // 文化效果快捷方法
  // ─────────────────────────────────────────

  /** 获取经验加成 % */
  getExpBonus(): number {
    return this.getEffectValueByTarget('hero_exp', 'all');
  }

  /** 获取研究速度加成 % */
  getResearchSpeedBonus(): number {
    return this.getEffectValueByTarget('research_speed', 'all');
  }

  /** 获取招募折扣 % */
  getRecruitDiscount(): number {
    return this.getEffectValueByTarget('recruit_discount', 'gold');
  }

  // ─────────────────────────────────────────
  // 乘数接口（返回 1 + bonus/100 的系数）
  // ─────────────────────────────────────────

  /** 获取攻击力乘数（1 + bonus%） */
  getAttackMultiplier(target: string = 'all'): number {
    return 1 + this.getAttackBonus(target) / 100;
  }

  /** 获取防御力乘数（1 + bonus%） */
  getDefenseMultiplier(target: string = 'all'): number {
    return 1 + this.getDefenseBonus(target) / 100;
  }

  /** 获取产出乘数（1 + bonus%） */
  getProductionMultiplier(target: string = 'all'): number {
    return 1 + this.getProductionBonus(target) / 100;
  }

  /** 获取经验乘数（1 + bonus%） */
  getExpMultiplier(): number {
    return 1 + this.getExpBonus() / 100;
  }

  /** 获取研究速度乘数（1 + bonus%） */
  getResearchSpeedMultiplier(): number {
    return 1 + this.getResearchSpeedBonus() / 100;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 创建空缓存 */
  private createEmptyCache(): EffectCache {
    return {
      military: { stats: new Map(), byTarget: new Map(), raw: [] },
      economy: { stats: new Map(), byTarget: new Map(), raw: [] },
      culture: { stats: new Map(), byTarget: new Map(), raw: [] },
      global: new Map(),
      valid: false,
    };
  }

  /** 重建缓存 */
  private rebuildCache(): void {
    this.cache = this.createEmptyCache();

    if (!this.techTree) return;

    // 收集所有已完成科技的效果
    const completedEffects = this.techTree.getAllCompletedEffects();

    // 按路线分类聚合
    for (const effect of completedEffects) {
      const nodeDef = this.findNodeDefByEffect(effect);
      if (!nodeDef) continue;

      const category = nodeDef.path as EffectCategory;
      const pathCache = this.cache[category];

      // 存储原始效果
      pathCache.raw.push(effect);

      // 按 target 分组
      const targetKey = effect.target;
      const targetList = pathCache.byTarget.get(targetKey) ?? [];
      targetList.push(effect);
      pathCache.byTarget.set(targetKey, targetList);

      // 映射到统计项并聚合
      const stat = this.mapEffectToStat(category, effect.type);
      if (stat) {
        const currentVal = pathCache.stats.get(stat) ?? 0;
        pathCache.stats.set(stat, currentVal + effect.value);

        // 同时更新全局缓存
        const globalVal = this.cache.global.get(stat) ?? 0;
        this.cache.global.set(stat, globalVal + effect.value);
      }
    }
  }

  /** 将效果类型映射到统计项 */
  private mapEffectToStat(category: EffectCategory, effectType: string): EffectStat | null {
    switch (category) {
      case 'military':
        return MILITARY_EFFECT_MAP[effectType] ?? null;
      case 'economy':
        return ECONOMY_EFFECT_MAP[effectType] ?? null;
      case 'culture':
        return CULTURE_EFFECT_MAP[effectType] ?? null;
      default:
        return null;
    }
  }

  /** 查找效果所属的节点定义 */
  private findNodeDefByEffect(effect: TechEffect): TechNodeDef | undefined {
    return TECH_NODE_DEFS.find((def) =>
      def.effects.some((e) => e.type === effect.type && e.target === effect.target && e.value === effect.value),
    );
  }
}
