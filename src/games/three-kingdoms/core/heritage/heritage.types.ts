/**
 * 传承域 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 涵盖：武将传承、装备传承、经验传承、传承规则
 *
 * 功能覆盖 (v16.0):
 *   #18 转生后加速机制 — 初始资源赠送 + 低级建筑瞬间 + 一键重建
 *   #19 转生次数解锁内容 — 1次天命/2次专属科技/3次神话武将/5次跨服
 *   #20 收益模拟器 — 预测声望增长 + 推荐转生时机 + 倍率对比
 *
 * @module core/heritage/heritage.types
 */

import type { Faction } from '../../shared/types';
import type { EquipmentRarity, EquipmentSlot } from '../equipment/equipment.types';

// ─────────────────────────────────────────────
// 1. 传承类型
// ─────────────────────────────────────────────

/** 传承类型枚举 */
export type HeritageType =
  | 'hero'      // 武将传承 — 将源武将属性/经验传给目标武将
  | 'equipment' // 装备传承 — 将源装备强化等级传给目标装备
  | 'experience'; // 经验传承 — 将源武将经验传给目标武将

/** 传承结果 */
export interface HeritageResult {
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  reason?: string;
  /** 传承类型 */
  type: HeritageType;
  /** 传承效率 (0~1) */
  efficiency: number;
  /** 消耗的铜钱 */
  copperCost: number;
  /** 传承前源数据摘要 */
  sourceBefore: HeritageDataSummary;
  /** 传承后源数据摘要 */
  sourceAfter: HeritageDataSummary;
  /** 传承前目标数据摘要 */
  targetBefore: HeritageDataSummary;
  /** 传承后目标数据摘要 */
  targetAfter: HeritageDataSummary;
}

/** 数据摘要（用于传承前后对比） */
export interface HeritageDataSummary {
  /** 关联ID（武将ID或装备UID） */
  id: string;
  /** 等级/强化等级 */
  level: number;
  /** 经验值（武将）或强化值（装备） */
  value: number;
}

// ─────────────────────────────────────────────
// 2. 武将传承
// ─────────────────────────────────────────────

/** 武将传承请求 */
export interface HeroHeritageRequest {
  /** 源武将ID（被传承者，将被消耗） */
  sourceHeroId: string;
  /** 目标武将ID（接收者） */
  targetHeroId: string;
  /** 传承选项 */
  options: HeroHeritageOptions;
}

/** 武将传承选项 */
export interface HeroHeritageOptions {
  /** 是否传承等级经验 */
  transferExp: boolean;
  /** 是否传承好感度 */
  transferFavorability: boolean;
  /** 是否传承技能等级 */
  transferSkillLevels: boolean;
  /** 经验传承效率 (0~1, 受品质影响) */
  expEfficiency: number;
}

/** 武将传承规则 */
export interface HeroHeritageRule {
  /** 源武将最低品质要求 */
  minSourceQuality: number;
  /** 目标武将最低品质要求 */
  minTargetQuality: number;
  /** 同阵营加成效率 */
  sameFactionBonus: number;
  /** 不同阵营惩罚 */
  diffFactionPenalty: number;
  /** 铜钱消耗系数 */
  copperCostFactor: number;
  /** 源武将被传承后状态 */
  sourceAfterState: 'consumed' | 'reset' | 'unchanged';
}

// ─────────────────────────────────────────────
// 3. 装备传承
// ─────────────────────────────────────────────

/** 装备传承请求 */
export interface EquipmentHeritageRequest {
  /** 源装备UID */
  sourceUid: string;
  /** 目标装备UID */
  targetUid: string;
  /** 传承选项 */
  options: EquipmentHeritageOptions;
}

/** 装备传承选项 */
export interface EquipmentHeritageOptions {
  /** 是否传承强化等级 */
  transferEnhanceLevel: boolean;
  /** 是否传承副属性 */
  transferSubStats: boolean;
  /** 是否传承特殊词条 */
  transferSpecialEffect: boolean;
  /** 强化等级传承效率 (0~1) */
  enhanceEfficiency: number;
}

/** 装备传承规则 */
export interface EquipmentHeritageRule {
  /** 源和目标必须同部位 */
  mustSameSlot: boolean;
  /** 强化等级传承损耗 */
  levelLoss: number;
  /** 品质差异加成/惩罚 */
  rarityDiffModifier: number;
  /** 铜钱消耗系数 */
  copperCostFactor: number;
  /** 源装备被传承后状态 */
  sourceAfterState: 'consumed' | 'reset' | 'unchanged';
}

// ─────────────────────────────────────────────
// 4. 经验传承
// ─────────────────────────────────────────────

/** 经验传承请求 */
export interface ExperienceHeritageRequest {
  /** 源武将ID */
  sourceHeroId: string;
  /** 目标武将ID */
  targetHeroId: string;
  /** 传承经验比例 (0~1) */
  expRatio: number;
}

/** 经验传承规则 */
export interface ExperienceHeritageRule {
  /** 最大传承比例 */
  maxExpRatio: number;
  /** 效率系数 */
  efficiency: number;
  /** 铜钱消耗系数 */
  copperCostFactor: number;
  /** 最低源武将等级 */
  minSourceLevel: number;
}

// ─────────────────────────────────────────────
// 5. 传承系统状态
// ─────────────────────────────────────────────

/** 传承系统状态 */
export interface HeritageState {
  /** 武将传承次数 */
  heroHeritageCount: number;
  /** 装备传承次数 */
  equipmentHeritageCount: number;
  /** 经验传承次数 */
  experienceHeritageCount: number;
  /** 今日传承次数 */
  dailyHeritageCount: number;
  /** 上次每日重置日期 */
  lastDailyReset: string;
  /** 传承历史记录 */
  heritageHistory: HeritageRecord[];
}

/** 传承记录 */
export interface HeritageRecord {
  /** 传承类型 */
  type: HeritageType;
  /** 源ID */
  sourceId: string;
  /** 目标ID */
  targetId: string;
  /** 传承效率 */
  efficiency: number;
  /** 铜钱消耗 */
  copperCost: number;
  /** 时间戳 */
  timestamp: number;
}

/** 传承系统存档数据 */
export interface HeritageSaveData {
  /** 存档版本号 */
  version: number;
  /** 传承状态 */
  state: HeritageState;
  /** 转生后加速状态 */
  accelState?: RebirthAccelerationState;
}

// ─────────────────────────────────────────────
// 6. 转生后加速机制 (#18)
// ─────────────────────────────────────────────

/** 转生后初始资源赠送 */
export interface RebirthInitialGift {
  /** 粮草数量 */
  grain: number;
  /** 铜钱数量 */
  copper: number;
  /** 强化石数量 */
  enhanceStone: number;
}

/** 一键重建配置 */
export interface RebirthRebuildConfig {
  /** 建筑升级优先级列表 */
  buildingPriority: string[];
  /** 自动升级的建筑最大等级 */
  maxAutoLevel: number;
  /** 是否自动升级资源建筑 */
  autoUpgradeResources: boolean;
  /** 是否自动升级军事建筑 */
  autoUpgradeMilitary: boolean;
}

/** 转生后加速状态 */
export interface RebirthAccelerationState {
  /** 是否已领取初始资源 */
  initialGiftClaimed: boolean;
  /** 一键重建是否已完成 */
  rebuildCompleted: boolean;
  /** 低级建筑瞬间升级剩余次数 */
  instantUpgradeCount: number;
  /** 已瞬间升级的建筑列表 */
  instantUpgradedBuildings: string[];
}

// ─────────────────────────────────────────────
// 7. 收益模拟器 (#20)
// ─────────────────────────────────────────────

/** 收益模拟输入参数 */
export interface HeritageSimulationParams {
  /** 当前声望等级 */
  currentPrestigeLevel: number;
  /** 当前转生次数 */
  currentRebirthCount: number;
  /** 模拟等待小时数 */
  waitHours: number;
  /** 每日在线时长(小时) */
  dailyOnlineHours: number;
}

/** 收益模拟结果 */
export interface HeritageSimulationResult {
  /** 立即转生倍率 */
  immediateMultiplier: number;
  /** 等待后转生倍率 */
  waitMultiplier: number;
  /** 立即转生预估收益 */
  immediateEarnings: Record<string, number>;
  /** 等待后转生预估收益 */
  waitEarnings: Record<string, number>;
  /** 推荐转生时机 (小时) */
  recommendedWaitHours: number;
  /** 边际收益递减拐点 */
  diminishingReturnHour: number;
  /** 置信度 (0~1) */
  confidence: number;
}
