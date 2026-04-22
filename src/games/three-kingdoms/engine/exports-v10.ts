/**
 * v10.0 装备域导出补充 — 兵强马壮
 *
 * 仅导出 index.ts 中未包含的装备类型（系统类已在 index.ts 中导出）
 * @module engine/exports-v10
 */

// ── 核心类型（从 core/equipment 重导出，index.ts 中缺少的类型） ──
export type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  EquipmentSource,
  MainStat,
  SubStat,
  SpecialEffect,
  BagSortMode,
  BagFilter,
  BagOperationResult,
  DecomposeResult,
  BatchDecomposeResult,
  EquipmentSaveData,
  HeroEquipSlots,
  EquipResult,
  CodexEntry,
} from '../core/equipment';

export type {
  SetId,
  SetBonusTier,
  ActiveSetBonus,
  EquipmentSetDef,
  SetBonusEffect,
  EnhanceResult,
  EnhanceOutcome,
  AutoEnhanceConfig,
  AutoEnhanceResult,
  EnhanceTransferResult,
  ForgeResult,
  ForgeType,
  ForgeSaveData,
  EquipRecommendation,
  RecommendResult,
} from '../core/equipment';
