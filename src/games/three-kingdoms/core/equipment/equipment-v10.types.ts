/**
 * 装备域 — v10.0 扩展类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 涵盖：炼制系统、强化系统、套装系统、推荐系统
 *
 * 功能覆盖：
 *   #6 基础炼制 / #7 高级炼制 / #8 定向炼制 / #9 保底机制
 *   #10 成功率曲线 / #11 降级规则 / #12 保护符 / #13 自动强化 / #14 强化转移 / #15 一键强化
 *   #16 三层属性 / #17 套装效果
 *   #19 一键推荐
 *
 * @module core/equipment/equipment-v10.types
 */

import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
} from './equipment.types';

// ─────────────────────────────────────────────
// 1. 炼制系统（#6 ~ #9）
// ─────────────────────────────────────────────

/** 炼制类型 */
export type ForgeType =
  | 'basic'       // 基础炼制 — 低成本，随机品质
  | 'advanced'    // 高级炼制 — 高成本，保底蓝品+
  | 'targeted';   // 定向炼制 — 指定部位，高成本

/** 炼制材料 */
export interface ForgeMaterials {
  /** 铜钱消耗 */
  copper: number;
  /** 强化石消耗 */
  enhanceStone: number;
  /** 精炼石消耗（高级/定向） */
  refineStone: number;
}

/** 炼制配置 */
export interface ForgeConfig {
  /** 炼制类型 */
  type: ForgeType;
  /** 材料消耗 */
  cost: ForgeMaterials;
  /** 品质权重 */
  rarityWeights: Record<EquipmentRarity, number>;
  /** 指定部位（仅定向炼制） */
  targetSlot: EquipmentSlot | null;
}

/** 炼制结果 */
export interface ForgeResult {
  /** 是否成功 */
  success: boolean;
  /** 产出的装备（null=失败） */
  equipment: EquipmentInstance | null;
  /** 消耗的材料 */
  cost: ForgeMaterials;
  /** 保底计数器是否触发 */
  pityTriggered: boolean;
}

/** 保底状态 */
export interface ForgePityState {
  /** 基础炼制连续未出蓝品次数 */
  basicBluePity: number;
  /** 高级炼制连续未出紫品次数 */
  advancedPurplePity: number;
  /** 定向炼制连续未出金品次数 */
  targetedGoldPity: number;
}

/** 炼制系统存档 */
export interface ForgeSaveData {
  pityState: ForgePityState;
  /** 别名，兼容旧接口 */
  pity?: ForgePityState;
  totalForgeCount: number;
}

// ─────────────────────────────────────────────
// 2. 强化系统（#10 ~ #15）
// ─────────────────────────────────────────────

/** 强化结果类型 */
export type EnhanceOutcome = 'success' | 'fail' | 'downgrade';

/** 强化结果 */
export interface EnhanceResult {
  /** 结果类型 */
  outcome: EnhanceOutcome;
  /** 强化前等级 */
  previousLevel: number;
  /** 强化后等级 */
  currentLevel: number;
  /** 消耗铜钱 */
  copperCost: number;
  /** 消耗强化石 */
  stoneCost: number;
  /** 是否使用了保护符 */
  protectionUsed: boolean;
  /** 当次成功率 */
  successRate: number;
}

/** 强化消耗配置 */
export interface EnhanceCostConfig {
  /** 基础铜钱消耗 */
  baseCopper: number;
  /** 铜钱消耗随等级增长系数 */
  copperGrowth: number;
  /** 基础强化石消耗 */
  baseStone: number;
  /** 强化石消耗随等级增长系数 */
  stoneGrowth: number;
}

/** 强化配置 */
export interface EnhanceConfig {
  /** 最大强化等级 */
  maxLevel: number;
  /** 安全等级（此等级前不降级） */
  safeLevel: number;
  /** 成功率曲线：[等级] → 成功率 */
  successRates: number[];
  /** 降级概率（失败时降级概率） */
  downgradeChance: number;
  /** 保护符消耗（按等级） */
  protectionCost: Record<number, number>;
  /** 消耗配置 */
  costConfig: EnhanceCostConfig;
}

/** 自动强化配置 */
export interface AutoEnhanceConfig {
  /** 目标等级 */
  targetLevel: number;
  /** 最大铜钱消耗 */
  maxCopper: number;
  /** 最大强化石消耗 */
  maxStone: number;
  /** 是否使用保护符 */
  useProtection: boolean;
  /** 保护符阈值（>=此等级时使用保护符） */
  protectionThreshold: number;
}

/** 自动强化结果 */
export interface AutoEnhanceResult {
  /** 每次强化结果 */
  steps: EnhanceResult[];
  /** 最终等级 */
  finalLevel: number;
  /** 总铜钱消耗 */
  totalCopper: number;
  /** 总强化石消耗 */
  totalStone: number;
  /** 总保护符消耗 */
  totalProtection: number;
}

/** 强化转移结果 */
export interface EnhanceTransferResult {
  /** 是否成功 */
  success: boolean;
  /** 源装备UID */
  sourceUid: string;
  /** 目标装备UID */
  targetUid: string;
  /** 转移等级 */
  transferredLevel: number;
  /** 转移费用 */
  cost: number;
}

/** 强化系统存档 */
export interface EnhanceSaveData {
  /** 保护符库存 */
  protectionCount: number;
}

// ─────────────────────────────────────────────
// 3. 套装系统（#17）
// ─────────────────────────────────────────────

/** 套装ID */
export type SetId =
  | 'warrior'     // 战神套
  | 'guardian'    // 守护套
  | 'scholar'     // 谋士套
  | 'swift'       // 疾风套
  | 'dragon'      // 龙魂套
  | 'phoenix'     // 凤翼套
  | 'overlord';   // 霸王套

/** 套装效果等级 */
export type SetBonusTier = 2 | 4;

/** 套装效果定义 */
export interface SetBonusEffect {
  /** 效果描述 */
  description: string;
  /** 属性加成 */
  bonuses: Record<string, number>;
}

/** 套装定义 */
export interface EquipmentSetDef {
  /** 套装ID */
  id: SetId;
  /** 套装名称 */
  name: string;
  /** 套装描述 */
  description: string;
  /** 套装图标 */
  icon: string;
  /** 2件套效果 */
  bonus2: SetBonusEffect;
  /** 4件套效果 */
  bonus4: SetBonusEffect;
  /** 套装品质要求（最低品质） */
  minRarity: EquipmentRarity;
}

/** 角色已激活的套装效果 */
export interface ActiveSetBonus {
  /** 套装ID */
  setId: SetId;
  /** 当前件数 */
  count: number;
  /** 已激活的等级 */
  activeTiers: SetBonusTier[];
  /** 总属性加成 */
  totalBonuses: Record<string, number>;
}

// ─────────────────────────────────────────────
// 4. 推荐系统（#19）
// ─────────────────────────────────────────────

/** 推荐评分 */
export interface EquipRecommendation {
  /** 装备UID */
  uid: string;
  /** 装备实例 */
  equipment: EquipmentInstance;
  /** 推荐部位 */
  slot: EquipmentSlot;
  /** 综合评分 */
  score: number;
  /** 评分明细 */
  breakdown: {
    /** 主属性评分 */
    mainStat: number;
    /** 副属性评分 */
    subStats: number;
    /** 套装加成评分 */
    setBonus: number;
    /** 品质评分 */
    rarity: number;
    /** 强化等级评分 */
    enhanceLevel: number;
  };
}

/** 一键推荐结果 */
export interface RecommendResult {
  /** 各部位推荐装备 */
  slots: Record<EquipmentSlot, EquipRecommendation | null>;
  /** 总评分 */
  totalScore: number;
  /** 套装建议 */
  setSuggestions: string[];
}

// ─────────────────────────────────────────────
// 5. 装备图鉴（#18）
// ─────────────────────────────────────────────

/** 图鉴条目 */
export interface CodexEntry {
  /** 模板ID */
  templateId: string;
  /** 是否已发现 */
  discovered: boolean;
  /** 最高品质获得记录 */
  bestRarity: EquipmentRarity | null;
  /** 获得次数 */
  obtainCount: number;
}

/** 图鉴存档 */
export interface CodexSaveData {
  entries: Record<string, CodexEntry>;
}

// ─────────────────────────────────────────────
// 6. 穿戴系统（#20）
// ─────────────────────────────────────────────

/** 穿戴操作结果 */
export interface EquipResult {
  success: boolean;
  reason?: string;
  /** 被替换的装备UID（如有） */
  replacedUid?: string;
}

/** 角色装备栏 */
export interface HeroEquipSlots {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
  mount: string | null;
}

/** 穿戴系统存档 */
export interface EquipSlotsSaveData {
  /** heroId → 装备栏 */
  heroEquips: Record<string, HeroEquipSlots>;
}
