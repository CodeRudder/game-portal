/**
 * 装备域 — 统一导出入口
 *
 * v10.0「兵强马壮」装备系统
 * 5个子系统 + 辅助模块
 *
 * @module engine/equipment
 */

export { EquipmentSystem } from './EquipmentSystem';
export { EquipmentForgeSystem } from './EquipmentForgeSystem';
export { EquipmentEnhanceSystem } from './EquipmentEnhanceSystem';
export { EquipmentSetSystem } from './EquipmentSetSystem';
export { EquipmentRecommendSystem } from './EquipmentRecommendSystem';
export { EquipmentBagManager } from './EquipmentBagManager';
export { ForgePityManager } from './ForgePityManager';
export {
  generateUid,
  resetUidCounter,
  generateBySlot,
  generateByTemplate,
  genMainStat,
  genSubStats,
  genSpecialEffect,
  isSlot as isEquipmentSlot,
  weightedPickRarity,
} from './EquipmentGenerator';

// 核心类型（从core层重新导出）
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
} from '../../core/equipment';
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
} from '../../core/equipment';
