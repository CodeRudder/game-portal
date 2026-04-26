/**
 * 武将升星 + 突破 — 数值配置
 *
 * 规则：零逻辑，只有常量和数据结构
 * 数值设计参考同类手游升星/突破系统
 *
 * @module engine/hero/star-up-config
 */

import type { BreakthroughTier } from './star-up.types';

// 从 hero-config 重新导出升星相关常量（统一入口）
export { STAR_UP_FRAGMENT_COST, MAX_STAR_LEVEL, SYNTHESIZE_REQUIRED_FRAGMENTS } from './hero-config';

// ─────────────────────────────────────────────
// 1. 升星配置
// ─────────────────────────────────────────────

/**
 * 各星级升星所需铜钱
 *
 * 星级越高，铜钱消耗越大
 */
export const STAR_UP_GOLD_COST: readonly number[] = [
  0,      // 0→1 星（初始，无消耗）
  5000,   // 1→2 星
  10000,  // 2→3 星
  20000,  // 3→4 星
  50000,  // 4→5 星
  100000, // 5→6 星
];

/**
 * 星级属性倍率表
 *
 * 每升一星，属性乘以此倍率。
 * 公式：实际属性 = 基础属性 × starMultiplier[star]
 *
 * 设计思路：
 * - 1星（默认）：1.0x
 * - 2星：1.15x
 * - 3星：1.35x
 * - 4星：1.6x
 * - 5星：2.0x
 * - 6星（满星）：2.5x
 */
export const STAR_MULTIPLIERS: readonly number[] = [
  1.0,   // 1 星
  1.0,   // 1 星（索引0占位）
  1.15,  // 2 星
  1.35,  // 3 星
  1.6,   // 4 星
  2.0,   // 5 星
  2.5,   // 6 星
];

/** 获取指定星级的属性倍率 */
export function getStarMultiplier(star: number): number {
  if (star < 1) return STAR_MULTIPLIERS[0];
  if (star >= STAR_MULTIPLIERS.length) return STAR_MULTIPLIERS[STAR_MULTIPLIERS.length - 1];
  return STAR_MULTIPLIERS[star];
}

// ─────────────────────────────────────────────
// 2. 突破配置
// ─────────────────────────────────────────────

/**
 * 突破阶段配置表
 *
 * 突破机制：武将等级达到当前上限后，需突破才能继续升级
 * 共 4 个突破阶段，每次突破提升等级上限
 *
 * 突破石：通过关卡扫荡、活动获得
 */
export const BREAKTHROUGH_TIERS: readonly BreakthroughTier[] = [
  {
    name: '一阶突破',
    levelCapBefore: 50,
    levelCapAfter: 60,
    fragmentCost: 30,
    goldCost: 20000,
    breakthroughStoneCost: 5,
  },
  {
    name: '二阶突破',
    levelCapBefore: 60,
    levelCapAfter: 70,
    fragmentCost: 50,
    goldCost: 50000,
    breakthroughStoneCost: 10,
  },
  {
    name: '三阶突破',
    levelCapBefore: 70,
    levelCapAfter: 80,
    fragmentCost: 80,
    goldCost: 100000,
    breakthroughStoneCost: 20,
  },
  {
    name: '四阶突破',
    levelCapBefore: 80,
    levelCapAfter: 100,
    fragmentCost: 120,
    goldCost: 200000,
    breakthroughStoneCost: 40,
  },
] as const;

/** 最大突破阶段数 */
export const MAX_BREAKTHROUGH_STAGE = BREAKTHROUGH_TIERS.length;

/** 初始等级上限（未突破）— PRD v1.5: 初始50级 */
export const INITIAL_LEVEL_CAP = 50;

/** 最终等级上限（全部突破后） */
export const FINAL_LEVEL_CAP = BREAKTHROUGH_TIERS[BREAKTHROUGH_TIERS.length - 1].levelCapAfter;

// ─────────────────────────────────────────────
// 3. 关卡碎片掉落配置
// ─────────────────────────────────────────────

/**
 * 关卡碎片掉落配置
 *
 * 不同章节掉落不同武将的碎片
 */
export interface StageDropConfig {
  /** 关卡ID */
  stageId: string;
  /** 掉落武将ID */
  generalId: string;
  /** 掉落数量范围 */
  dropRange: { min: number; max: number };
}

/**
 * 关卡碎片掉落表（示例数据）
 *
 * 后续可从配置文件加载
 */
export const STAGE_FRAGMENT_DROPS: readonly StageDropConfig[] = [
  { stageId: 'stage_1_1', generalId: 'minbingduizhang', dropRange: { min: 1, max: 3 } },
  { stageId: 'stage_1_2', generalId: 'minbingduizhang', dropRange: { min: 2, max: 5 } },
  { stageId: 'stage_2_1', generalId: 'junshou', dropRange: { min: 1, max: 3 } },
  { stageId: 'stage_2_2', generalId: 'dianwei', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_3_1', generalId: 'liubei', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_3_2', generalId: 'zhangfei', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_4_1', generalId: 'guanyu', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_4_2', generalId: 'zhugeliang', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_5_1', generalId: 'caocao', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_5_2', generalId: 'simayi', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_6_1', generalId: 'zhouyu', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_7_1', generalId: 'zhaoyun', dropRange: { min: 1, max: 2 } },
  { stageId: 'stage_8_1', generalId: 'lvbu', dropRange: { min: 1, max: 2 } },
];

// ─────────────────────────────────────────────
// 4. 商店兑换配置
// ─────────────────────────────────────────────

/**
 * 商店碎片兑换配置
 *
 * 使用通用货币兑换指定武将碎片
 */
export interface ShopExchangeConfig {
  /** 武将ID */
  generalId: string;
  /** 每个碎片价格（铜钱） */
  pricePerFragment: number;
  /** 每日限购数量 */
  dailyLimit: number;
}

/**
 * 商店碎片兑换表
 */
export const SHOP_FRAGMENT_EXCHANGE: readonly ShopExchangeConfig[] = [
  { generalId: 'guanyu', pricePerFragment: 5000, dailyLimit: 5 },
  { generalId: 'zhugeliang', pricePerFragment: 5000, dailyLimit: 5 },
  { generalId: 'zhaoyun', pricePerFragment: 5000, dailyLimit: 5 },
  { generalId: 'caocao', pricePerFragment: 5000, dailyLimit: 5 },
  { generalId: 'lvbu', pricePerFragment: 5000, dailyLimit: 5 },
  { generalId: 'liubei', pricePerFragment: 3000, dailyLimit: 10 },
  { generalId: 'zhangfei', pricePerFragment: 3000, dailyLimit: 10 },
  { generalId: 'simayi', pricePerFragment: 3000, dailyLimit: 10 },
  { generalId: 'zhouyu', pricePerFragment: 3000, dailyLimit: 10 },
  { generalId: 'dianwei', pricePerFragment: 2000, dailyLimit: 20 },
  { generalId: 'junshou', pricePerFragment: 1000, dailyLimit: 30 },
  { generalId: 'xiaowei', pricePerFragment: 1000, dailyLimit: 30 },
  { generalId: 'minbingduizhang', pricePerFragment: 500, dailyLimit: 50 },
  { generalId: 'xiangyongtoumu', pricePerFragment: 500, dailyLimit: 50 },
];

// ─────────────────────────────────────────────
// 5. 存档版本
// ─────────────────────────────────────────────

/** 升星系统存档版本号 */
export const STAR_SYSTEM_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 6. 资源类型常量
// ─────────────────────────────────────────────

/** 铜钱资源类型 */
export const RESOURCE_TYPE_GOLD = 'gold';

/** 突破石资源类型 */
export const RESOURCE_TYPE_BREAKTHROUGH_STONE = 'breakthroughStone';
