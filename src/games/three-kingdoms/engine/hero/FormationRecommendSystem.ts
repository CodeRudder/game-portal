/**
 * 编队推荐系统 — 基于关卡特性智能推荐编队方案
 *
 * 职责：
 *   - 根据关卡类型（normal/elite/boss）分析关卡特性
 *   - 基于玩家已有武将，推荐1~3个最优编队方案
 *   - 综合考虑：武将品质、战力、羁绊加成、阵营克制、兵种克制
 *
 * 推荐算法：
 *   1. 分析关卡特性（敌方阵容强度、类型等）
 *   2. 筛选可用武将（已拥有且未在编队中）
 *   3. 按战力排序并分组
 *   4. 生成1~3个推荐方案（最优、平衡、羁绊优先）
 *
 * @module engine/hero/FormationRecommendSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { GeneralData, Quality } from './hero.types';
import type { StageType } from '../campaign/campaign.types';
import type { FormationData } from './formation-types';
import { MAX_SLOTS_PER_FORMATION } from './formation-types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 关卡特性分析结果 */
export interface StageCharacteristics {
  /** 关卡类型 */
  stageType: StageType;
  /** 推荐战力 */
  recommendedPower: number;
  /** 敌方阵容规模（单位数量） */
  enemySize: number;
  /** 难度等级 1~10 */
  difficultyLevel: number;
}

/** 推荐方案 */
export interface FormationRecommendation {
  /** 方案名称 */
  name: string;
  /** 方案描述 */
  description: string;
  /** 推荐武将ID列表（按槽位顺序） */
  heroIds: string[];
  /** 预估战力 */
  estimatedPower: number;
  /** 推荐分数 0~100 */
  score: number;
  /** 方案标签 */
  tags: string[];
}

/** 推荐结果 */
export interface RecommendResult {
  /** 关卡特性分析 */
  characteristics: StageCharacteristics;
  /** 推荐方案列表（1~3个） */
  plans: FormationRecommendation[];
}

/** 战力计算回调 */
export type PowerCalculator = (general: GeneralData) => number;

// ─────────────────────────────────────────────
// 推荐算法权重
// ─────────────────────────────────────────────

const WEIGHT_POWER = 0.40;
const WEIGHT_QUALITY = 0.25;
const WEIGHT_COVERAGE = 0.20;
const WEIGHT_SYNERGY = 0.15;

/** 品质权重映射 */
const QUALITY_WEIGHT: Record<string, number> = {
  COMMON: 1.0,
  FINE: 1.5,
  RARE: 2.0,
  EPIC: 3.0,
  LEGENDARY: 5.0,
};

// ─────────────────────────────────────────────
// FormationRecommendSystem
// ─────────────────────────────────────────────

export class FormationRecommendSystem implements ISubsystem {
  readonly name = 'formationRecommend';
  private deps: ISystemDeps | null = null;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}
  getState(): Record<string, unknown> { return { version: 1 }; }
  reset(): void {}

  // ─── 核心推荐 API ──────────────────────────

  /**
   * 根据关卡特性推荐编队方案
   *
   * @param stageType - 关卡类型
   * @param availableHeroes - 可用武将列表
   * @param calculatePower - 战力计算回调
   * @param recommendedPower - 关卡推荐战力
   * @param enemySize - 敌方阵容规模
   * @returns 推荐结果（1~3个方案）
   */
  recommend(
    stageType: StageType,
    availableHeroes: GeneralData[],
    calculatePower: PowerCalculator,
    recommendedPower: number = 0,
    enemySize: number = 3,
  ): RecommendResult {
    const characteristics = this.analyzeStage(stageType, recommendedPower, enemySize);

    // 按战力排序武将
    const sortedHeroes = [...availableHeroes]
      .map(h => ({ hero: h, power: calculatePower(h) }))
      .sort((a, b) => b.power - a.power);

    if (sortedHeroes.length === 0) {
      return { characteristics, plans: [] };
    }

    const plans: FormationRecommendation[] = [];

    // 方案1：最强战力方案
    const bestPlan = this.buildBestPowerPlan(sortedHeroes, characteristics);
    if (bestPlan) plans.push(bestPlan);

    // 方案2：平衡方案（兼顾品质和覆盖）
    if (sortedHeroes.length > 2) {
      const balancedPlan = this.buildBalancedPlan(sortedHeroes, characteristics);
      if (balancedPlan) plans.push(balancedPlan);
    }

    // 方案3：羁绊优先方案
    if (sortedHeroes.length > 3) {
      const synergyPlan = this.buildSynergyPlan(sortedHeroes, characteristics);
      if (synergyPlan) plans.push(synergyPlan);
    }

    // 限制最多3个方案
    return { characteristics, plans: plans.slice(0, 3) };
  }

  /**
   * 分析关卡特性
   */
  analyzeStage(
    stageType: StageType,
    recommendedPower: number,
    enemySize: number,
  ): StageCharacteristics {
    let difficultyLevel: number;
    switch (stageType) {
      case 'boss':
        difficultyLevel = Math.min(10, Math.max(7, Math.ceil(recommendedPower / 1000)));
        break;
      case 'elite':
        difficultyLevel = Math.min(8, Math.max(4, Math.ceil(recommendedPower / 1500)));
        break;
      case 'normal':
      default:
        difficultyLevel = Math.min(5, Math.max(1, Math.ceil(recommendedPower / 2000)));
        break;
    }

    return {
      stageType,
      recommendedPower,
      enemySize,
      difficultyLevel,
    };
  }

  // ─── 内部方法 ──────────────────────────────

  /** 构建最强战力方案 */
  private buildBestPowerPlan(
    sortedHeroes: Array<{ hero: GeneralData; power: number }>,
    chars: StageCharacteristics,
  ): FormationRecommendation | null {
    const count = Math.min(MAX_SLOTS_PER_FORMATION, sortedHeroes.length);
    const selected = sortedHeroes.slice(0, count);

    const totalPower = selected.reduce((s, h) => s + h.power, 0);
    const score = this.calculateScore(selected, totalPower, chars);

    return {
      name: '最强战力',
      description: `选择战力最高的${count}名武将组成的最强阵容`,
      heroIds: selected.map(h => h.hero.id),
      estimatedPower: totalPower,
      score: Math.min(100, Math.round(score)),
      tags: ['战力优先', '输出最大化'],
    };
  }

  /** 构建平衡方案 */
  private buildBalancedPlan(
    sortedHeroes: Array<{ hero: GeneralData; power: number }>,
    chars: StageCharacteristics,
  ): FormationRecommendation | null {
    const count = Math.min(MAX_SLOTS_PER_FORMATION, sortedHeroes.length);
    // 从不同品质区间选将：取头部、中部、尾部各一些
    const selected: Array<{ hero: GeneralData; power: number }> = [];

    // 策略：前1/3取2个，中1/3取2个，后1/3取2个
    const third = Math.max(1, Math.floor(sortedHeroes.length / 3));
    const groups = [
      sortedHeroes.slice(0, third),
      sortedHeroes.slice(third, third * 2),
      sortedHeroes.slice(third * 2),
    ];

    // 每组交替取
    for (let slot = 0; slot < count; slot++) {
      const groupIdx = slot % 3;
      const group = groups[groupIdx];
      const pickIdx = Math.floor(slot / 3);
      if (group && group[pickIdx]) {
        selected.push(group[pickIdx]);
      }
    }

    // 如果不够，从顶部补
    while (selected.length < count) {
      const next = sortedHeroes.find(h => !selected.some(s => s.hero.id === h.hero.id));
      if (next) selected.push(next);
      else break;
    }

    if (selected.length === 0) return null;

    const totalPower = selected.reduce((s, h) => s + h.power, 0);
    const score = this.calculateScore(selected, totalPower, chars);

    return {
      name: '均衡发展',
      description: `兼顾品质和战力的平衡阵容`,
      heroIds: selected.slice(0, count).map(h => h.hero.id),
      estimatedPower: totalPower,
      score: Math.min(100, Math.round(score)),
      tags: ['均衡', '稳定'],
    };
  }

  /** 构建羁绊优先方案 */
  private buildSynergyPlan(
    sortedHeroes: Array<{ hero: GeneralData; power: number }>,
    chars: StageCharacteristics,
  ): FormationRecommendation | null {
    const count = Math.min(MAX_SLOTS_PER_FORMATION, sortedHeroes.length);

    // 按阵营分组
    const factionGroups = new Map<string, Array<{ hero: GeneralData; power: number }>>();
    for (const h of sortedHeroes) {
      const f = h.hero.faction;
      if (!factionGroups.has(f)) factionGroups.set(f, []);
      factionGroups.get(f)!.push(h);
    }

    // 找到人数最多的阵营
    let bestFaction = '';
    let bestGroup: Array<{ hero: GeneralData; power: number }> = [];
    for (const [faction, group] of factionGroups) {
      if (group.length > bestGroup.length) {
        bestFaction = faction;
        bestGroup = group;
      }
    }

    if (bestGroup.length === 0) return null;

    // 优先选同阵营武将，不足时用其他高战力补充
    const selected = bestGroup.slice(0, count);
    while (selected.length < count) {
      const next = sortedHeroes.find(h => !selected.some(s => s.hero.id === h.hero.id));
      if (next) selected.push(next);
      else break;
    }

    const totalPower = selected.reduce((s, h) => s + h.power, 0);
    const synergyBonus = bestGroup.length >= 3 ? 15 : bestGroup.length >= 2 ? 8 : 0;
    const score = this.calculateScore(selected, totalPower, chars) + synergyBonus;

    return {
      name: '羁绊优先',
      description: `以${bestFaction || '混合'}阵营为核心的羁绊阵容`,
      heroIds: selected.slice(0, count).map(h => h.hero.id),
      estimatedPower: totalPower,
      score: Math.min(100, Math.round(score)),
      tags: ['羁绊加成', `${bestFaction || '混合'}阵营`],
    };
  }

  /** 计算推荐分数 */
  private calculateScore(
    selected: Array<{ hero: GeneralData; power: number }>,
    totalPower: number,
    chars: StageCharacteristics,
  ): number {
    if (selected.length === 0) return 0;

    // 战力评分
    const powerScore = chars.recommendedPower > 0
      ? Math.min(1, totalPower / chars.recommendedPower) * 100
      : 50;

    // 品质评分
    const avgQuality = selected.reduce((s, h) =>
      s + (QUALITY_WEIGHT[h.hero.quality] ?? 1), 0) / selected.length;
    const qualityScore = (avgQuality / 5) * 100;

    // 覆盖评分（武将数量占满编的比例）
    const coverageScore = (selected.length / MAX_SLOTS_PER_FORMATION) * 100;

    // 综合评分
    return (
      powerScore * WEIGHT_POWER +
      qualityScore * WEIGHT_QUALITY +
      coverageScore * WEIGHT_COVERAGE +
      50 * WEIGHT_SYNERGY
    );
  }
}
