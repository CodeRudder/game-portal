/**
 * 羁绊域 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 涵盖：阵营羁绊、羁绊效果、多级羁绊、编队羁绊预览
 *
 * 功能覆盖 (v16.0 模块A):
 *   #1 阵营羁绊效果 — 同乡之谊(2同)/同仇敌忾(3同)/众志成城(6同)/混搭协作(3+3)
 *   #2 羁绊可视化 — 编队界面实时显示激活羁绊+属性加成预览
 *
 * @module core/heritage/bond.types
 */

import type { Faction } from '../../engine/hero/hero.types';

// ─────────────────────────────────────────────
// 1. 羁绊定义
// ─────────────────────────────────────────────

/** 羁绊ID */
export type BondId =
  | 'fellowship'      // 同乡之谊 — 2同阵营
  | 'solidarity'      // 同仇敌忾 — 3同阵营
  | 'unity'           // 众志成城 — 6同阵营
  | 'diversity';      // 混搭协作 — 3+3不同阵营

/** 羁绊等级 */
export type BondTier = 'minor' | 'major' | 'ultimate';

/** 属性加成类型 */
export interface BondBonus {
  /** 攻击加成比例 */
  attack?: number;
  /** 防御加成比例 */
  defense?: number;
  /** 智力加成比例 */
  intelligence?: number;
  /** 速度加成比例 */
  speed?: number;
  /** 特效加成描述 */
  specialEffect?: string;
}

/** 羁绊定义 */
export interface BondDefinition {
  /** 羁绊ID */
  id: BondId;
  /** 羁绊名称 */
  name: string;
  /** 羁绊描述 */
  description: string;
  /** 羁绊图标 */
  icon: string;
  /** 羁绊等级 */
  tier: BondTier;
  /** 激活条件 */
  condition: BondCondition;
  /** 属性加成 */
  bonuses: BondBonus;
}

// ─────────────────────────────────────────────
// 2. 羁绊激活条件
// ─────────────────────────────────────────────

/** 羁绊激活条件类型 */
export type BondConditionType =
  | 'same_faction'      // 同阵营数量
  | 'mixed_factions';   // 多阵营混搭

/** 羁绊激活条件 */
export interface BondCondition {
  /** 条件类型 */
  type: BondConditionType;
  /** 同阵营最少数量 (same_faction) */
  minSameFaction?: number;
  /** 阵营要求 (mixed_factions) */
  factionGroups?: { faction: Faction; minCount: number }[];
}

// ─────────────────────────────────────────────
// 3. 羁绊激活结果
// ─────────────────────────────────────────────

/** 编队中激活的羁绊 */
export interface ActiveBond {
  /** 羁绊定义 */
  bond: BondDefinition;
  /** 满足条件的阵营 */
  matchingFaction: Faction;
  /** 匹配的武将数量 */
  heroCount: number;
  /** 实际加成 */
  bonuses: BondBonus;
}

/** 编队羁绊预览结果 */
export interface BondPreview {
  /** 当前激活的羁绊列表 */
  activeBonds: ActiveBond[];
  /** 总属性加成 */
  totalBonuses: BondBonus;
  /** 编队中各阵营武将数量 */
  factionCounts: Record<Faction, number>;
  /** 未激活羁绊提示 */
  potentialBonds: PotentialBond[];
}

/** 潜在羁绊（差几个武将可激活） */
export interface PotentialBond {
  /** 羁绊定义 */
  bond: BondDefinition;
  /** 还差的数量 */
  remainingCount: number;
  /** 提示文本 */
  hint: string;
}
