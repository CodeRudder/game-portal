/**
 * 装备推荐系统 — 一键推荐最优装备
 *
 * 职责：
 *   - 对每个部位评估背包中所有可用装备
 *   - 综合评分：主属性 + 副属性 + 套装加成 + 品质 + 强化等级
 *   - 一键推荐：为4个部位选择最优装备组合
 *   - 套装建议：推荐凑套装的方案
 *
 * @module engine/equipment/EquipmentRecommendSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
} from '../../core/equipment/equipment.types';
import type {
  EquipRecommendation,
  RecommendResult,
  SetId,
} from '../../core/equipment/equipment-forge.types';
import {
  EQUIPMENT_SLOTS,
  RARITY_ORDER,
} from '../../core/equipment/equipment.types';
import {
  TEMPLATE_MAP,
  RARITY_MAIN_STAT_MULTIPLIER,
  SET_MAP,
} from '../../core/equipment/equipment-config';
import type { EquipmentSystem } from './EquipmentSystem';
import type { EquipmentSetSystem } from './EquipmentSetSystem';

// ─────────────────────────────────────────────
// 评分权重
// ─────────────────────────────────────────────

const WEIGHT_MAIN_STAT = 0.30;
const WEIGHT_SUB_STATS = 0.20;
const WEIGHT_SET_BONUS = 0.20;
const WEIGHT_RARITY = 0.15;
const WEIGHT_ENHANCE = 0.15;

// ─────────────────────────────────────────────
// EquipmentRecommendSystem
// ─────────────────────────────────────────────

export class EquipmentRecommendSystem implements ISubsystem {
  readonly name = 'equipmentRecommend';
  private deps: ISystemDeps | null = null;
  private readonly equipmentSystem: EquipmentSystem;
  private readonly setSystem: EquipmentSetSystem;

  constructor(equipmentSystem: EquipmentSystem, setSystem: EquipmentSetSystem) {
    this.equipmentSystem = equipmentSystem;
    this.setSystem = setSystem;
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}
  getState(): Record<string, unknown> { return {}; }
  reset(): void {}

  // ── 单件评分 ──

  /** 评估单件装备的综合评分 */
  evaluateEquipment(equipment: EquipmentInstance, heroId: string): EquipRecommendation {
    const mainStatScore = this.scoreMainStat(equipment);
    const subStatsScore = this.scoreSubStats(equipment);
    const setBonusScore = this.scoreSetBonus(equipment, heroId);
    const rarityScore = this.scoreRarity(equipment.rarity);
    const enhanceScore = this.scoreEnhance(equipment.enhanceLevel);

    const totalScore =
      mainStatScore * WEIGHT_MAIN_STAT +
      subStatsScore * WEIGHT_SUB_STATS +
      setBonusScore * WEIGHT_SET_BONUS +
      rarityScore * WEIGHT_RARITY +
      enhanceScore * WEIGHT_ENHANCE;

    return {
      uid: equipment.uid,
      equipment,
      slot: equipment.slot,
      score: Math.round(totalScore * 100) / 100,
      breakdown: {
        mainStat: Math.round(mainStatScore * 100) / 100,
        subStats: Math.round(subStatsScore * 100) / 100,
        setBonus: Math.round(setBonusScore * 100) / 100,
        rarity: Math.round(rarityScore * 100) / 100,
        enhanceLevel: Math.round(enhanceScore * 100) / 100,
      },
    };
  }

  // ── 一键推荐（#19） ──

  /** 为角色推荐4个部位的最优装备 */
  recommendForHero(heroId: string): RecommendResult {
    const slots: Record<EquipmentSlot, EquipRecommendation | null> = {
      weapon: null,
      armor: null,
      accessory: null,
      mount: null,
    };

    // 获取所有未穿戴装备
    const unequipped = this.equipmentSystem.getFilteredEquipments({
      slot: null,
      rarity: null,
      unequippedOnly: true,
      setOnly: false,
    });

    // 加上当前已穿戴的装备（允许保留）
    const currentEquips = this.equipmentSystem.getHeroEquipments(heroId);
    const candidates = [...unequipped, ...currentEquips];

    // 按部位分组评分
    for (const slot of EQUIPMENT_SLOTS) {
      const slotItems = candidates.filter(e => e.slot === slot);
      if (slotItems.length === 0) continue;

      let best: EquipRecommendation | null = null;
      for (const eq of slotItems) {
        const rec = this.evaluateEquipment(eq, heroId);
        if (!best || rec.score > best.score) {
          best = rec;
        }
      }
      slots[slot] = best;
    }

    // 计算总评分
    const totalScore = EQUIPMENT_SLOTS.reduce(
      (sum, slot) => sum + (slots[slot]?.score ?? 0),
      0,
    );

    // 套装建议
    const setSuggestions = this.generateSetSuggestions(heroId, slots);

    return { slots, totalScore: Math.round(totalScore * 100) / 100, setSuggestions };
  }

  // ── 评分子项 ──

  /** 主属性评分：归一化到 0~100 */
  private scoreMainStat(eq: EquipmentInstance): number {
    return Math.min(100, eq.mainStat.value / 2);
  }

  /** 副属性评分：数量和总值 */
  private scoreSubStats(eq: EquipmentInstance): number {
    if (eq.subStats.length === 0) return 0;
    const totalValue = eq.subStats.reduce((sum, s) => sum + s.value, 0);
    return Math.min(100, totalValue * 2);
  }

  /** 套装评分：根据所属套装的品质和已有件数 */
  private scoreSetBonus(eq: EquipmentInstance, heroId: string): number {
    const template = TEMPLATE_MAP.get(eq.templateId);
    if (!template?.setId) return 0;

    const setDef = SET_MAP.get(template.setId);
    if (!setDef) return 0;

    // 品质越高的套装基础分越高
    const rarityBase = RARITY_ORDER[setDef.minRarity] * 10;

    // 检查角色是否已有同套装装备
    const currentEquips = this.equipmentSystem.getHeroEquipments(heroId);
    let sameSetCount = 0;
    for (const item of currentEquips) {
      const t = TEMPLATE_MAP.get(item.templateId);
      if (t?.setId === template.setId) sameSetCount++;
    }

    // 已有同套装件数越多，推荐分越高
    return Math.min(100, rarityBase + sameSetCount * 20);
  }

  /** 品质评分 */
  private scoreRarity(rarity: EquipmentRarity): number {
    return RARITY_ORDER[rarity] * 20; // white=20, green=40, blue=60, purple=80, gold=100
  }

  /** 强化等级评分 */
  private scoreEnhance(level: number): number {
    return Math.min(100, level * (100 / 15));
  }

  // ── 套装建议 ──

  private generateSetSuggestions(
    heroId: string,
    slots: Record<EquipmentSlot, EquipRecommendation | null>,
  ): string[] {
    const suggestions: string[] = [];

    // 统计推荐装备的套装
    const setCounts = new Map<string, number>();
    for (const slot of EQUIPMENT_SLOTS) {
      const rec = slots[slot];
      if (!rec) continue;
      const template = TEMPLATE_MAP.get(rec.equipment.templateId);
      if (template?.setId) {
        setCounts.set(template.setId, (setCounts.get(template.setId) ?? 0) + 1);
      }
    }

    // 检查接近激活的套装
    for (const [setId, count] of setCounts) {
      const def = SET_MAP.get(setId as SetId);
      if (!def) continue;
      if (count === 2) {
        suggestions.push(`${def.name}已凑齐2件，激活${def.bonus2.description}`);
      }
      if (count >= 4) {
        suggestions.push(`${def.name}已凑齐4件，激活全部效果！`);
      }
      if (count === 3) {
        suggestions.push(`${def.name}已凑齐3件，再集1件可激活4件套效果`);
      }
      if (count === 1) {
        suggestions.push(`${def.name}已凑齐1件，再集1件可激活2件套效果`);
      }
    }

    return suggestions;
  }
}
