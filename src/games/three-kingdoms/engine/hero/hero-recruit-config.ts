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
 * - normal: 普通招募（招贤令），消耗招贤令×1
 * - advanced: 高级招募（求贤令），消耗求贤令×100
 */
export type RecruitType = 'normal' | 'advanced';

// ─────────────────────────────────────────────
// 2. 消耗配置
// ─────────────────────────────────────────────

/**
 * 招募消耗配置
 *
 * 普通招募：1 招贤令/次（v2.0 修正：原铜钱×100）
 * 高级招募：100 求贤令/次（v2.0 修正：原×1）
 *
 * 消耗通过回调函数解耦，此处定义消耗参数。
 */
export const RECRUIT_COSTS: Record<RecruitType, { resourceType: string; amount: number }> = {
  normal: {
    /** 普通招募消耗招贤令（R3 修正：1→5，解决经济通胀问题） */
    resourceType: 'recruitToken',
    amount: 1, // v2: 从5降为1，配合初始30个招贤令让新玩家充分体验招募
  },
  advanced: {
    /** 高级招募消耗求贤令（v2.0 修正：×1 → ×100） */
    resourceType: 'recruitToken',
    amount: 10, // v2: 从100降为10，让玩家也能体验高级招募
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
 * 来源：PRD HER-heroes-prd.md — [60, 30, 8, 2, 0]
 * 普通(Uncommon) 60% / 精良(Rare) 30% / 稀有(Epic) 8% / 史诗(Legendary) 2% / 传说(Mythic) 0%
 *
 * 品质映射：COMMON↔Uncommon, FINE↔Rare, RARE↔Epic, EPIC↔Legendary, LEGENDARY↔Mythic
 */
export const NORMAL_RATES: readonly QualityRate[] = [
  { quality: Q.COMMON, rate: 0.60 },
  { quality: Q.FINE, rate: 0.30 },
  { quality: Q.RARE, rate: 0.08 },
  { quality: Q.EPIC, rate: 0.02 },
  { quality: Q.LEGENDARY, rate: 0 },
] as const;

/**
 * 高级招募概率表
 *
 * 来源：PRD HER-heroes-prd.md — [20, 40, 25, 13, 2]
 * 普通(Uncommon) 20% / 精良(Rare) 40% / 稀有(Epic) 25% / 史诗(Legendary) 13% / 传说(Mythic) 2%
 *
 * 品质映射：COMMON↔Uncommon, FINE↔Rare, RARE↔Epic, EPIC↔Legendary, LEGENDARY↔Mythic
 */
export const ADVANCED_RATES: readonly QualityRate[] = [
  { quality: Q.COMMON, rate: 0.20 },
  { quality: Q.FINE, rate: 0.40 },
  { quality: Q.RARE, rate: 0.25 },
  { quality: Q.EPIC, rate: 0.13 },
  { quality: Q.LEGENDARY, rate: 0.02 },
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
 * 来源：v2.0-招贤纳士.md（修正后）
 * - 10 连必出稀有+
 * - 100 抽必出传说(LEGENDARY)+
 *
 * 每种招募类型独立计数。
 */
export interface PityConfig {
  /** 十连保底：每累计 10 次未出稀有+，第 10 次必出稀有+品质 */
  tenPullThreshold: number;
  /** 十连保底最低品质 */
  tenPullMinQuality: Quality;
  /** 硬保底：每累计 50 次未出史诗+，第 50 次必出史诗(EPIC)+品质 */
  hardPityThreshold: number;
  /** 硬保底最低品质 */
  hardPityMinQuality: Quality;
}

/** 普通招募保底配置（PRD: 普通招贤无保底，仅保留十连保底） */
export const NORMAL_PITY: PityConfig = {
  tenPullThreshold: 10,
  tenPullMinQuality: Q.RARE,
  hardPityThreshold: Infinity, // PRD: 普通池无硬保底
  hardPityMinQuality: Q.LEGENDARY,
};

/** 高级招募保底配置（v2.0 修正：100抽必出LEGENDARY+） */
export const ADVANCED_PITY: PityConfig = {
  tenPullThreshold: 10,
  tenPullMinQuality: Q.RARE,
  hardPityThreshold: 100,
  hardPityMinQuality: Q.LEGENDARY,
};

/** 按招募类型索引保底配置 */
export const RECRUIT_PITY: Record<RecruitType, PityConfig> = {
  normal: NORMAL_PITY,
  advanced: ADVANCED_PITY,
};

// ─────────────────────────────────────────────
// 5. UP 武将配置
// ─────────────────────────────────────────────

/**
 * UP 武将配置
 *
 * 来源：HER-heroes-prd.md [HER-2] 保底机制
 * - UP 武将概率：出 Legendary 时 50% 为本期 UP 武将
 * - 仅高级招募生效
 */
export interface UpHeroConfig {
  /** 本期 UP 武将 ID */
  upGeneralId: string | null;
  /** UP 武将触发概率（出 LEGENDARY 品质时） */
  upRate: number;
  /** UP 武将独特描述文本（展示用，如历史典故、个人特点等） */
  description: string;
}

/**
 * 预定义 UP 武将独特描述模板
 *
 * 当设置 UP 武将时，可从此模板中选取对应描述，
 * 也可自定义描述文本。
 */
export const UP_HERO_DESCRIPTIONS: Record<string, string> = {
  // ── 蜀国 ──
  liubei: '仁德之主，三顾茅庐请卧龙出山，以德服人，蜀汉开国之君。本期UP概率提升！',
  guanyu: '武圣关公，温酒斩华雄，过五关斩六将，忠义无双，威震华夏。本期UP概率提升！',
  zhangfei: '万人敌张翼德，长坂桥一声怒吼，吓退曹军百万，勇猛无双。本期UP概率提升！',
  zhugeliang: '卧龙先生，三顾茅庐出山，草船借箭，七擒孟获，鞠躬尽瘁。本期UP概率提升！',
  zhaoyun: '常山赵子龙，长坂坡七进七出，单骑救主，一身是胆。本期UP概率提升！',
  // ── 魏国 ──
  caocao: '魏武帝曹操，挟天子以令诸侯，统一北方，文武兼备的一代枭雄。本期UP概率提升！',
  simayi: '隐忍谋略家司马懿，鹰视狼顾，与诸葛亮多次交锋，终成大业。本期UP概率提升！',
  // ── 吴国 ──
  zhouyu: '东吴大都督周公瑾，赤壁之战火烧连环船，雅量高致。本期UP概率提升！',
  // ── 群雄 ──
  lvbu: '天下第一猛将吕布，辕门射戟，三英战吕布，勇冠三军。本期UP概率提升！',
};

/** 默认 UP 武将配置（无 UP 武将） */
export const DEFAULT_UP_CONFIG: UpHeroConfig = {
  upGeneralId: null,
  upRate: 0.50,
  description: '',
};

// ─────────────────────────────────────────────
// 6. 每日免费招募配置
// ─────────────────────────────────────────────

/**
 * 每日免费招募配置
 *
 * 来源：HER-heroes-prd.md [HER-2] 招募方式
 * - 普通招贤：每日免费 1 次
 * - 高级招贤：无免费次数
 */
export const DAILY_FREE_CONFIG: Record<RecruitType, { freeCount: number }> = {
  normal: { freeCount: 1 },
  advanced: { freeCount: 0 },
} as const;

// ─────────────────────────────────────────────
// 7. 重复武将碎片转化表（从 hero-config.ts 统一导出）
// ─────────────────────────────────────────────

/**
 * 重复武将按品质转化为碎片数量
 *
 * 来源：v2.0-招贤纳士.md 功能点8
 * 统一使用 hero-config.ts 中的 DUPLICATE_FRAGMENT_COUNT，
 * 此处提供别名以保持向后兼容。
 */
export { DUPLICATE_FRAGMENT_COUNT as DUPLICATE_FRAGMENT_REWARD } from './hero-config';

// ─────────────────────────────────────────────
// 6. 招募存档版本
// ─────────────────────────────────────────────

/** 招募系统存档数据版本号 */
export const RECRUIT_SAVE_VERSION = 1;
