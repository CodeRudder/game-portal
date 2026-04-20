/**
 * 传承域 — 配置常量
 *
 * 传承系统的所有配置数据：武将传承规则、装备传承规则、
 * 经验传承规则、转生后加速配置、收益模拟器参数
 *
 * 规则：纯数据配置，零逻辑
 *
 * @module core/heritage/heritage-config
 */

import type {
  HeroHeritageRule,
  EquipmentHeritageRule,
  ExperienceHeritageRule,
  RebirthInitialGift,
  RebirthRebuildConfig,
} from './heritage.types';

// ─────────────────────────────────────────────
// 1. 武将传承配置
// ─────────────────────────────────────────────

/** 武将传承规则 */
export const HERO_HERITAGE_RULE: HeroHeritageRule = {
  minSourceQuality: 2,       // 源武将最低精良
  minTargetQuality: 3,       // 目标武将最低稀有
  sameFactionBonus: 0.1,     // 同阵营额外+10%效率
  diffFactionPenalty: 0.1,   // 不同阵营-10%效率
  copperCostFactor: 500,     // 每级500铜钱
  sourceAfterState: 'reset', // 源武将等级重置为1
};

/** 品质对应的经验传承效率 */
export const QUALITY_EXP_EFFICIENCY: Record<number, number> = {
  1: 0.3,   // 普通 → 30%
  2: 0.4,   // 精良 → 40%
  3: 0.5,   // 稀有 → 50%
  4: 0.65,  // 史诗 → 65%
  5: 0.8,   // 传说 → 80%
};

// ─────────────────────────────────────────────
// 2. 装备传承配置
// ─────────────────────────────────────────────

/** 装备传承规则 */
export const EQUIPMENT_HERITAGE_RULE: EquipmentHeritageRule = {
  mustSameSlot: true,         // 必须同部位
  levelLoss: 1,              // 等级损耗-1
  rarityDiffModifier: 0.05,  // 品质差每级±5%
  copperCostFactor: 200,     // 每级200铜钱
  sourceAfterState: 'consumed', // 源装备被消耗
};

/** 品质差异对传承效率的影响 */
export const RARITY_DIFF_EFFICIENCY: Record<string, number> = {
  'same': 1.0,       // 同品质 → 100%
  'higher_1': 0.9,   // 目标高1品质 → 90%
  'higher_2': 0.75,  // 目标高2品质 → 75%
  'lower_1': 1.1,    // 目标低1品质 → 110%
  'lower_2': 1.2,    // 目标低2品质 → 120%
};

// ─────────────────────────────────────────────
// 3. 经验传承配置
// ─────────────────────────────────────────────

/** 经验传承规则 */
export const EXPERIENCE_HERITAGE_RULE: ExperienceHeritageRule = {
  maxExpRatio: 0.8,          // 最大传承80%经验
  efficiency: 0.7,           // 效率70%
  copperCostFactor: 100,     // 每级100铜钱
  minSourceLevel: 10,        // 源武将最低10级
};

// ─────────────────────────────────────────────
// 4. 转生后加速配置 (#18)
// ─────────────────────────────────────────────

/** 转生后初始资源赠送 */
export const REBIRTH_INITIAL_GIFT: RebirthInitialGift = {
  grain: 5000,
  copper: 3000,
  enhanceStone: 10,
};

/** 一键重建默认配置 */
export const DEFAULT_REBUILD_CONFIG: RebirthRebuildConfig = {
  buildingPriority: ['castle', 'farm', 'lumber', 'barracks', 'academy'],
  maxAutoLevel: 10,
  autoUpgradeResources: true,
  autoUpgradeMilitary: false,
};

/** 低级建筑瞬间升级上限 */
export const INSTANT_UPGRADE_MAX_LEVEL = 10;

/** 瞬间升级次数（基于转生次数） */
export const INSTANT_UPGRADE_COUNT_PER_REBIRTH = 5;

// ─────────────────────────────────────────────
// 5. 转生次数解锁内容 (#19)
// ─────────────────────────────────────────────

/** 转生次数解锁内容 (v16.0 细化) */
export const HERITAGE_REBIRTH_UNLOCKS = [
  { rebirthCount: 1, description: '天命系统解锁', type: 'feature', unlockId: 'mandate_system' },
  { rebirthCount: 2, description: '专属科技路线', type: 'tech', unlockId: 'exclusive_tech' },
  { rebirthCount: 3, description: '神话武将招募池', type: 'hero', unlockId: 'mythic_hero_pool' },
  { rebirthCount: 5, description: '跨服竞技场', type: 'feature', unlockId: 'cross_server_arena' },
] as const;

// ─────────────────────────────────────────────
// 6. 收益模拟器参数 (#20)
// ─────────────────────────────────────────────

/** 模拟器基础每日收益 */
export const SIMULATION_BASE_DAILY = {
  gold: 200,
  grain: 100,
  prestige: 30,
};

/** 模拟器边际收益递减阈值（小时） */
export const SIMULATION_DIMINISHING_THRESHOLD = 24;

/** 模拟器最大模拟天数 */
export const SIMULATION_MAX_DAYS = 30;

// ─────────────────────────────────────────────
// 7. 传承系统限制
// ─────────────────────────────────────────────

/** 每日传承次数上限 */
export const DAILY_HERITAGE_LIMIT = 10;

/** 传承系统存档版本 */
export const HERITAGE_SAVE_VERSION = 1;
