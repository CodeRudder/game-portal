/**
 * 武将招募域 — 数值配置
 *
 * 规则：零逻辑，只有常量和数据结构
 * 数值来源：v2.0-招贤纳士.md 功能点5~8
 *
 * @module engine/hero/hero-recruit-config
 */

import type { Quality } from './hero.types';
import { Quality as Q } from './hero.types';

// ─────────────────────────────────────────────
// 1. 招募类型
// ─────────────────────────────────────────────

/**
 * 招募方式
 *
 * - normal: 普通招募（招贤榜），消耗铜钱
 * - advanced: 高级招募（求贤令），消耗求贤令
 */
export type RecruitType = 'normal' | 'advanced';

// ─────────────────────────────────────────────
// 2. 消耗配置
// ─────────────────────────────────────────────

/**
 * 招募消耗配置
 *
 * 普通招募：100 铜钱/次
 * 高级招募：1 求贤令/次
 *
 * 消耗通过回调函数解耦，此处定义消耗参数。
 */
export const RECRUIT_COSTS: Record<RecruitType, { resourceType: string; amount: number }> = {
  normal: {
    /** 普通招募消耗铜钱 */
    resourceType: 'gold',
    amount: 100,
  },
  advanced: {
    /** 高级招募消耗求贤令 */
    resourceType: 'recruitToken',
    amount: 1,
  },
} as const;

/** 十连招募折扣（1.0 = 无折扣，0.9 = 九折） */
export const TEN_PULL_DISCOUNT = 1.0;

// ─────────────────────────────────────────────
// 3. 概率表
// ─────────────────────────────────────────────

/**
 * 品质概率条目
 */
export interface QualityRate {
  /** 品质 */
  quality: Quality;
  /** 出现概率 (0~1) */
  rate: number;
}

/**
 * 普通招募概率表
 *
 * 来源：v2.0-招贤纳士.md 功能点6
 * 普通 60% / 精良 25% / 稀有 10% / 史诗 4% / 传说 1%
 */
export const NORMAL_RATES: readonly QualityRate[] = [
  { quality: Q.COMMON, rate: 0.60 },
  { quality: Q.FINE, rate: 0.25 },
  { quality: Q.RARE, rate: 0.10 },
  { quality: Q.EPIC, rate: 0.04 },
  { quality: Q.LEGENDARY, rate: 0.01 },
] as const;

/**
 * 高级招募概率表
 *
 * 来源：v2.0-招贤纳士.md 功能点6
 * 普通 30% / 精良 35% / 稀有 22% / 史诗 10% / 传说 3%
 */
export const ADVANCED_RATES: readonly QualityRate[] = [
  { quality: Q.COMMON, rate: 0.30 },
  { quality: Q.FINE, rate: 0.35 },
  { quality: Q.RARE, rate: 0.22 },
  { quality: Q.EPIC, rate: 0.10 },
  { quality: Q.LEGENDARY, rate: 0.03 },
] as const;

/** 按招募类型索引概率表 */
export const RECRUIT_RATES: Record<RecruitType, readonly QualityRate[]> = {
  normal: NORMAL_RATES,
  advanced: ADVANCED_RATES,
};

// ─────────────────────────────────────────────
// 4. 保底配置
// ─────────────────────────────────────────────

/**
 * 保底阈值配置
 *
 * 来源：v2.0-招贤纳士.md 功能点7
 * - 10 连必出稀有+
 * - 50 抽必出史诗+
 *
 * 每种招募类型独立计数。
 */
export interface PityConfig {
  /** 十连保底：每累计 10 次未出稀有+，第 10 次必出稀有+品质 */
  tenPullThreshold: number;
  /** 十连保底最低品质 */
  tenPullMinQuality: Quality;
  /** 硬保底：每累计 50 次未出史诗+，第 50 次必出史诗+品质 */
  hardPityThreshold: number;
  /** 硬保底最低品质 */
  hardPityMinQuality: Quality;
}

/** 普通招募保底配置 */
export const NORMAL_PITY: PityConfig = {
  tenPullThreshold: 10,
  tenPullMinQuality: Q.RARE,
  hardPityThreshold: 50,
  hardPityMinQuality: Q.EPIC,
};

/** 高级招募保底配置 */
export const ADVANCED_PITY: PityConfig = {
  tenPullThreshold: 10,
  tenPullMinQuality: Q.RARE,
  hardPityThreshold: 50,
  hardPityMinQuality: Q.EPIC,
};

/** 按招募类型索引保底配置 */
export const RECRUIT_PITY: Record<RecruitType, PityConfig> = {
  normal: NORMAL_PITY,
  advanced: ADVANCED_PITY,
};

// ─────────────────────────────────────────────
// 5. 重复武将碎片转化表
// ─────────────────────────────────────────────

/**
 * 重复武将按品质转化为碎片数量
 *
 * 来源：v2.0-招贤纳士.md 功能点8
 * 此处与 hero-config.ts 的 DUPLICATE_FRAGMENT_COUNT 保持一致。
 * 招募系统内部使用此表，实际碎片写入由 HeroSystem.handleDuplicate 完成。
 */
export const DUPLICATE_FRAGMENT_REWARD: Record<Quality, number> = {
  [Q.COMMON]: 5,
  [Q.FINE]: 10,
  [Q.RARE]: 20,
  [Q.EPIC]: 40,
  [Q.LEGENDARY]: 80,
};

// ─────────────────────────────────────────────
// 6. 招募存档版本
// ─────────────────────────────────────────────

/** 招募系统存档数据版本号 */
export const RECRUIT_SAVE_VERSION = 1;
