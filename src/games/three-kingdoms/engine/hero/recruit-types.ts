/**
 * Hero recruit - types and helper functions
 *
 * Extracted from HeroRecruitSystem.ts.
 */

import type { Quality, GeneralData } from './hero.types';
import { Quality as Q, QUALITY_ORDER } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import type { RecruitType, QualityRate, PityConfig, UpHeroConfig } from './hero-recruit-config';
import { DEFAULT_UP_CONFIG } from './hero-recruit-config';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

export interface RecruitResult {
  general: GeneralData | null;
  /** 是否为重复武将 */
  isDuplicate: boolean;
  /** 转化碎片数（重复时 > 0） */
  fragmentCount: number;
  quality: Quality;
  /** 招募池为空时标记（极端情况） */
  isEmpty?: boolean;
}

/** 招募执行结果（单抽或十连） */
export interface RecruitOutput {
  type: RecruitType;
  results: RecruitResult[];
  cost: { resourceType: string; amount: number };
}

/** 保底计数器状态 */
export interface PityState {
  /** 普通招募已抽次数（自上次出稀有+以来） */
  normalPity: number;
  /** 高级招募已抽次数（自上次出稀有+以来） */
  advancedPity: number;
  /** 普通招募硬保底计数（自上次出史诗+以来） */
  normalHardPity: number;
  /** 高级招募硬保底计数（自上次出史诗+以来） */
  advancedHardPity: number;
}

/** 每日免费招募状态 */
export interface FreeRecruitState {
  /** 今日已使用的免费次数（按招募类型） */
  usedFreeCount: Record<RecruitType, number>;
  /** 上次重置日期（ISO date string: YYYY-MM-DD） */
  lastResetDate: string;
}

/** UP 武将状态 */
export interface UpHeroState {
  /** 当前 UP 武将 ID */
  upGeneralId: string | null;
  /** UP 触发概率 */
  upRate: number;
  /** UP 武将独特描述文本 */
  description: string;
}

/** 招募系统存档数据 */
export interface RecruitSaveData {
  version: number;
  pity: PityState;
  /** 每日免费招募状态 */
  freeRecruit: FreeRecruitState;
  /** UP 武将状态 */
  upHero: UpHeroState;
  /** 招募历史记录（最近20条） */
  history?: RecruitHistoryEntry[];
}

/** 资源消耗回调 */
export type ResourceSpendFn = (resourceType: string, amount: number) => boolean;
/** 资源检查回调 */
export type ResourceCheckFn = (resourceType: string, amount: number) => boolean;

/** 招募历史条目 */
export interface RecruitHistoryEntry {
  /** 招募时间戳 */
  timestamp: number;
  /** 招募类型 */
  type: RecruitType;
  /** 招募结果 */
  results: RecruitResult[];
  /** 消耗 */
  cost: { resourceType: string; amount: number };
}

/** 最大历史记录数 */
export const MAX_HISTORY_SIZE = 20;

/** 招募系统业务依赖（通过回调解耦 ResourceSystem） */
export interface RecruitDeps {
  heroSystem: HeroSystem;
  /** 资源消耗回调 — 返回 true 表示消耗成功 */
  spendResource: ResourceSpendFn;
  /** 资源检查回调 — 返回 true 表示资源充足 */
  canAffordResource: ResourceCheckFn;
  /** 资源添加回调 — 用于碎片溢出转化铜钱等场景 */
  addResource?: (type: string, amount: number) => void;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

export function createEmptyPity(): PityState {
  return { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 };
}

export function createEmptyFreeRecruit(): FreeRecruitState {
  return {
    usedFreeCount: { normal: 0, advanced: 0 },
    lastResetDate: new Date().toISOString().slice(0, 10),
  };
}

export function createDefaultUpHero(): UpHeroState {
  return {
    upGeneralId: DEFAULT_UP_CONFIG.upGeneralId,
    upRate: DEFAULT_UP_CONFIG.upRate,
    description: DEFAULT_UP_CONFIG.description,
  };
}

/** 获取今日日期字符串 (YYYY-MM-DD) */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 累积概率法抽取品质 */
export function rollQuality(rates: readonly QualityRate[], rng: () => number): Quality {
  const roll = rng();
  let cumulative = 0;
  for (const entry of rates) {
    cumulative += entry.rate;
    if (roll < cumulative) return entry.quality;
  }
  return rates[rates.length - 1].quality;
}

/** 保底修正：硬保底（史诗+）优先于十连保底（稀有+） */
export function applyPity(
  baseQuality: Quality,
  pityCount: number,
  hardPityCount: number,
  config: PityConfig,
): Quality {
  if (hardPityCount >= config.hardPityThreshold - 1) {
    if (QUALITY_ORDER[baseQuality] < QUALITY_ORDER[config.hardPityMinQuality]) {
      return config.hardPityMinQuality;
    }
  }
  if (pityCount >= config.tenPullThreshold - 1) {
    if (QUALITY_ORDER[baseQuality] < QUALITY_ORDER[config.tenPullMinQuality]) {
      return config.tenPullMinQuality;
    }
  }
  return baseQuality;
}

/** 按品质从武将定义池中随机选择一个武将ID */
export function pickGeneralByQuality(
  heroSystem: HeroSystem,
  quality: Quality,
  rng: () => number,
): string | null {
  const candidates = heroSystem.getAllGeneralDefs().filter((def) => def.quality === quality);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)].id;
}

// ─────────────────────────────────────────────
// HeroRecruitSystem
// ─────────────────────────────────────────────

/**
 * 武将招募系统
 *
 * 管理普通招募和高级招募的完整流程：
 * - 概率计算与品质抽取（含保底修正）
 * - 保底计数器（10连稀有+、50抽史诗+）
 * - 重复武将自动转化为碎片
 * - 资源消耗通过回调解耦
 *
 * @example
 * ```ts
 * const recruit = new HeroRecruitSystem();
 * recruit.setRecruitDeps({ heroSystem, spendResource, canAffordResource });
 * const result = recruit.recruitSingle('advanced');
 * ```
 */
