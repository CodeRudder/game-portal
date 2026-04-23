/**
 * 装备域 — 掉落权重配置
 *
 * 从 EquipmentSystem 中提取的关卡掉落权重和来源稀有度权重。
 *
 * @module engine/equipment/EquipmentDropWeights
 */

import type { EquipmentRarity, CampaignType } from '../../core/equipment';

// ─────────────────────────────────────────────
// 关卡掉落权重
// ─────────────────────────────────────────────

/** 关卡类型 → 稀有度权重 */
export const CAMPAIGN_DROP_WEIGHTS: Record<CampaignType, Record<EquipmentRarity, number>> = {
  normal: { white: 60, green: 30, blue: 8, purple: 2, gold: 0 },
  elite: { white: 30, green: 40, blue: 22, purple: 7, gold: 1 },
  boss: { white: 10, green: 25, blue: 35, purple: 22, gold: 8 },
};

/** 来源 → 稀有度权重 */
export const SOURCE_RARITY_WEIGHTS: Record<string, Record<EquipmentRarity, number>> = {
  equipment_box: { white: 0, green: 0, blue: 20, purple: 55, gold: 25 },
  event: { white: 0, green: 0, blue: 40, purple: 45, gold: 15 },
};
