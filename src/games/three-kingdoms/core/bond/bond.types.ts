/**
 * 核心层 — 武将羁绊系统类型定义
 *
 * 定义阵营羁绊效果、羁绊可视化数据、武将故事事件等类型。
 * 规则：只有 interface/type/enum，零逻辑
 *
 * 功能覆盖：
 *   #1 阵营羁绊效果 — 同乡之谊(2同)/同仇敌忾(3同)/众志成城(6同)/混搭协作(3+3)
 *   #2 羁绊可视化 — 编队界面实时显示激活羁绊+属性加成预览
 *   #3 武将故事事件 — 好感度触发专属剧情+历史典故+奖励
 *
 * @module core/bond/bond.types
 */

import type { Faction } from '../../engine/hero/hero.types';
import type { GeneralStats } from '../../engine/hero/hero.types';

// ─────────────────────────────────────────────
// 1. 阵营羁绊类型 (#1)
// ─────────────────────────────────────────────

/** 羁绊类型标识 */
export type BondType =
  | 'faction_2'     // 同乡之谊 — 2同阵营
  | 'faction_3'     // 同仇敌忾 — 3同阵营
  | 'faction_6'     // 众志成城 — 6同阵营
  | 'mixed_3_3';    // 混搭协作 — 3+3不同阵营

/** 羁绊名称映射 */
export const BOND_NAMES: Record<BondType, string> = {
  faction_2: '同乡之谊',
  faction_3: '同仇敌忾',
  faction_6: '众志成城',
  mixed_3_3: '混搭协作',
};

/** 羁绊描述映射 */
export const BOND_DESCRIPTIONS: Record<BondType, string> = {
  faction_2: '2名同阵营武将上阵，攻击+5%',
  faction_3: '3名同阵营武将上阵，攻击+15%',
  faction_6: '6名同阵营武将上阵，攻击+25%+防御+15%',
  mixed_3_3: '3+3名不同阵营武将上阵，攻击+10%+技能伤害+5%',
};

/** 羁绊效果定义 */
export interface BondEffect {
  /** 羁绊类型 */
  type: BondType;
  /** 羁绊名称 */
  name: string;
  /** 羁绊描述 */
  description: string;
  /** 属性加成（百分比，0.05 = 5%） */
  bonuses: Partial<GeneralStats>;
  /** 触发条件描述 */
  condition: string;
  /** 羁绊图标 */
  icon: string;
}

/** 阵营羁绊激活状态 */
export interface ActiveBond {
  /** 羁绊类型 */
  type: BondType;
  /** 触发的阵营 */
  faction: Faction;
  /** 满足条件的武将数量 */
  heroCount: number;
  /** 羁绊效果 */
  effect: BondEffect;
}

// ─────────────────────────────────────────────
// 2. 羁绊可视化 (#2)
// ─────────────────────────────────────────────

/** 编队羁绊预览数据 */
export interface FormationBondPreview {
  /** 编队ID */
  formationId: string;
  /** 当前激活的羁绊列表 */
  activeBonds: ActiveBond[];
  /** 总属性加成 */
  totalBonuses: Partial<GeneralStats>;
  /** 阵营分布 */
  factionDistribution: Record<Faction, number>;
  /** 可激活但未激活的羁绊提示 */
  potentialBonds: BondPotentialTip[];
}

/** 潜在羁绊提示 */
export interface BondPotentialTip {
  /** 羁绊类型 */
  type: BondType;
  /** 还差几名武将 */
  missingCount: number;
  /** 建议添加的阵营 */
  suggestedFaction: Faction;
  /** 激活后可获得的加成 */
  bonuses: Partial<GeneralStats>;
}

// ─────────────────────────────────────────────
// 3. 武将故事事件 (#3)
// ─────────────────────────────────────────────

/** 故事事件触发条件 */
export interface StoryEventCondition {
  /** 事件ID */
  eventId: string;
  /** 关联武将ID列表 */
  heroIds: string[];
  /** 最低好感度阈值 */
  minFavorability: number;
  /** 最低武将等级 */
  minLevel: number;
  /** 前置事件ID（可选） */
  prerequisiteEventId?: string;
}

/** 故事事件奖励 */
export interface StoryEventReward {
  /** 好感度增加 */
  favorability: number;
  /** 武将碎片 */
  fragments: Record<string, number>;
  /** 声望值 */
  prestigePoints: number;
}

/** 故事事件定义 */
export interface StoryEventDef {
  /** 事件ID */
  id: string;
  /** 事件标题 */
  title: string;
  /** 事件描述（历史典故） */
  description: string;
  /** 事件类型 */
  category: 'friendship' | 'rivalry' | 'mentor' | 'historical';
  /** 触发条件 */
  condition: StoryEventCondition;
  /** 奖励 */
  rewards: StoryEventReward;
  /** 是否可重复触发 */
  repeatable: boolean;
}

/** 武将好感度数据 */
export interface HeroFavorability {
  /** 武将ID */
  heroId: string;
  /** 当前好感度 */
  value: number;
  /** 已触发的故事事件ID列表 */
  triggeredEvents: string[];
}

// ─────────────────────────────────────────────
// 4. 羁绊系统状态
// ─────────────────────────────────────────────

/** 羁绊系统存档数据 */
export interface BondSaveData {
  /** 版本号 */
  version: number;
  /** 武将好感度数据 heroId → HeroFavorability */
  favorabilities: Record<string, HeroFavorability>;
  /** 已完成的故事事件ID列表 */
  completedStoryEvents: string[];
}

/** 羁绊系统存档版本 */
export const BOND_SAVE_VERSION = 1;
