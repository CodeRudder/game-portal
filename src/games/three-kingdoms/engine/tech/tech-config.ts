/**
 * 科技域 — 科技树数据配置
 *
 * 规则：零逻辑，只有常量和数据结构
 * 三条路线各 4 层，每层 2~3 个节点，含互斥分支
 *
 * @module engine/tech/tech-config
 */

import type { TechNodeDef, TechEdge } from './tech.types';

// ─────────────────────────────────────────────
// 1. 全局配置
// ─────────────────────────────────────────────

export const TECH_SAVE_VERSION = 1;
export const BASE_RESEARCH_QUEUE_SIZE = 1;

export const ACADEMY_QUEUE_SIZE_MAP: Record<number, number> = { 1: 1, 5: 2, 10: 3, 15: 4, 20: 5 };

/** 书院每级科技点产出（每秒） */
export const ACADEMY_TECH_POINT_PRODUCTION: Record<number, number> = {
  1: 0.01, 2: 0.02, 3: 0.03, 4: 0.05, 5: 0.08,
  6: 0.11, 7: 0.15, 8: 0.20, 9: 0.26, 10: 0.33,
  11: 0.41, 12: 0.50, 13: 0.60, 14: 0.72, 15: 0.85,
  16: 1.00, 17: 1.16, 18: 1.34, 19: 1.54, 20: 1.76,
};

export const MANDATE_SPEEDUP_SECONDS_PER_POINT = 60;
export const INGOT_SPEEDUP_SECONDS_PER_UNIT = 600;

// ─────────────────────────────────────────────
// Sprint 3: 书院研究系统配置
// ─────────────────────────────────────────────

/** 铜钱加速：每次消耗铜钱数 */
export const COPPER_SPEEDUP_COST = 1000;

/** 铜钱加速：每次进度增量（百分比，如 10 表示 +10%） */
export const COPPER_SPEEDUP_PROGRESS_PERCENT = 10;

/** 铜钱加速：每日最大加速次数 */
export const COPPER_SPEEDUP_MAX_DAILY = 10;

/** 研究启动消耗铜钱数 */
export const RESEARCH_START_COPPER_COST = 5000;

/** 研究启动消耗科技点倍率（techPoint × 此值） */
export const RESEARCH_START_TECH_POINT_MULTIPLIER = 10;

/**
 * 可研究科技上限 = 书院等级 × 此系数
 * XI-005: 书院等级 → 可研究科技上限
 */
export const ACADEMY_TECH_CAP_MULTIPLIER = 2;

/**
 * 书院研究速度加成 = 1 + 书院等级 × 此系数
 * XI-005: 书院等级 → 研究速度加成
 */
export const ACADEMY_RESEARCH_SPEED_PER_LEVEL = 0.1;

/**
 * 科技完成 → 建筑产出加成（%/级）
 * XI-016: TECH → BLD 产出加成
 */
export const TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL = 5;

/**
 * 科技完成 → 资源产出加成（%/级）
 * XI-016: TECH → 资源产出加成
 */
export const TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL = 3;

/**
 * 科技完成 → 战斗属性加成（%/级）
 * XI-016: TECH → 战斗属性加成
 */
export const TECH_BATTLE_STAT_BONUS_PER_LEVEL = 2;

// ─────────────────────────────────────────────
// 2. 互斥组 ID 辅助
// ─────────────────────────────────────────────
const M = (path: string, tier: number) => `${path}_t${tier}`;

// ─────────────────────────────────────────────
// 3. 科技节点定义
// ─────────────────────────────────────────────

const n = (
  id: string, name: string, desc: string, path: TechNodeDef['path'],
  tier: number, prereqs: string[], mutex: string, pts: number,
  time: number, effects: TechNodeDef['effects'], icon: string,
): TechNodeDef => ({ id, name, description: desc, path, tier, prerequisites: prereqs, mutexGroup: mutex, costPoints: pts, researchTime: time, effects, icon });

/** 军事路线节点 */
const MIL: TechNodeDef[] = [
  n('mil_t1_attack', '锐兵术', '提升全军攻击力10%', 'military', 1, [], M('mil', 1), 50, 120, [{ type: 'troop_attack', target: 'all', value: 10 }], '🗡️'),
  n('mil_t1_defense', '铁壁术', '提升全军防御力10%', 'military', 1, [], M('mil', 1), 50, 120, [{ type: 'troop_defense', target: 'all', value: 10 }], '🛡️'),
  n('mil_t2_charge', '冲锋战术', '骑兵攻击力+15%，行军速度+5%', 'military', 2, ['mil_t1_attack'], '', 120, 300, [{ type: 'troop_attack', target: 'cavalry', value: 15 }, { type: 'march_speed', target: 'all', value: 5 }], '🐴'),
  n('mil_t2_fortify', '固守战术', '步兵防御力+15%，城防+10%', 'military', 2, ['mil_t1_defense'], '', 120, 300, [{ type: 'troop_defense', target: 'infantry', value: 15 }, { type: 'troop_hp', target: 'infantry', value: 10 }], '🏰'),
  n('mil_t3_blitz', '闪电战', '全军攻击+20%，但防御-5%', 'military', 3, ['mil_t2_charge'], M('mil', 3), 300, 720, [{ type: 'troop_attack', target: 'all', value: 20 }, { type: 'troop_defense', target: 'all', value: -5 }], '⚡'),
  n('mil_t3_endurance', '持久战', '全军生命+20%，防御+10%', 'military', 3, ['mil_t2_fortify'], M('mil', 3), 300, 720, [{ type: 'troop_hp', target: 'all', value: 20 }, { type: 'troop_defense', target: 'all', value: 10 }], '💪'),
  n('mil_t4_dominance', '霸王之师', '全军攻击+25%，防御+15%，生命+15%', 'military', 4, ['mil_t3_blitz'], '', 800, 1800, [{ type: 'troop_attack', target: 'all', value: 25 }, { type: 'troop_defense', target: 'all', value: 15 }, { type: 'troop_hp', target: 'all', value: 15 }], '👑'),
  n('mil_t4_fortress', '铜墙铁壁', '全军防御+25%，生命+25%', 'military', 4, ['mil_t3_endurance'], '', 800, 1800, [{ type: 'troop_defense', target: 'all', value: 25 }, { type: 'troop_hp', target: 'all', value: 25 }], '🏯'),
];

/** 经济路线节点 */
const ECO: TechNodeDef[] = [
  n('eco_t1_farming', '精耕细作', '粮草产出+15%', 'economy', 1, [], M('eco', 1), 50, 120, [{ type: 'resource_production', target: 'grain', value: 15 }], '🌾'),
  n('eco_t1_trade', '商路开拓', '铜钱产出+15%', 'economy', 1, [], M('eco', 1), 50, 120, [{ type: 'resource_production', target: 'gold', value: 15 }], '🏪'),
  n('eco_t2_irrigation', '水利灌溉', '粮草产出+20%，粮草上限+15%', 'economy', 2, ['eco_t1_farming'], '', 120, 300, [{ type: 'resource_production', target: 'grain', value: 20 }, { type: 'resource_cap', target: 'grain', value: 15 }], '💧'),
  n('eco_t2_minting', '铸币术', '铜钱产出+20%', 'economy', 2, ['eco_t1_trade'], '', 120, 300, [{ type: 'resource_production', target: 'gold', value: 20 }], '🪙'),
  n('eco_t3_granary', '大粮仓', '粮草产出+30%，粮草上限+25%', 'economy', 3, ['eco_t2_irrigation'], M('eco', 3), 300, 720, [{ type: 'resource_production', target: 'grain', value: 30 }, { type: 'resource_cap', target: 'grain', value: 25 }], '🏛️'),
  n('eco_t3_marketplace', '大集市', '铜钱产出+30%，全资源产出+10%', 'economy', 3, ['eco_t2_minting'], M('eco', 3), 300, 720, [{ type: 'resource_production', target: 'gold', value: 30 }, { type: 'resource_production', target: 'all', value: 10 }], '🏬'),
  n('eco_t4_prosperity', '天下粮仓', '全资源产出+25%，上限+20%', 'economy', 4, ['eco_t3_granary'], '', 800, 1800, [{ type: 'resource_production', target: 'all', value: 25 }, { type: 'resource_cap', target: 'all', value: 20 }], '🌟'),
  n('eco_t4_golden_age', '黄金时代', '铜钱产出+40%，全资源产出+15%', 'economy', 4, ['eco_t3_marketplace'], '', 800, 1800, [{ type: 'resource_production', target: 'gold', value: 40 }, { type: 'resource_production', target: 'all', value: 15 }], '✨'),
];

/** 文化路线节点 */
const CUL: TechNodeDef[] = [
  n('cul_t1_education', '兴学令', '武将经验获取+15%', 'culture', 1, [], M('cul', 1), 50, 120, [{ type: 'hero_exp', target: 'all', value: 15 }], '📖'),
  n('cul_t1_recruit', '招贤令', '招募消耗铜钱-10%', 'culture', 1, [], M('cul', 1), 50, 120, [{ type: 'recruit_discount', target: 'gold', value: 10 }], '🎯'),
  n('cul_t2_academy', '书院扩建', '研究速度+15%', 'culture', 2, ['cul_t1_education'], '', 120, 300, [{ type: 'research_speed', target: 'all', value: 15 }], '🏫'),
  n('cul_t2_talent', '唯才是举', '招募消耗-15%，武将经验+10%', 'culture', 2, ['cul_t1_recruit'], '', 120, 300, [{ type: 'recruit_discount', target: 'gold', value: 15 }, { type: 'hero_exp', target: 'all', value: 10 }], '🏅'),
  n('cul_t3_scholar', '百家争鸣', '研究速度+25%，武将经验+20%', 'culture', 3, ['cul_t2_academy'], M('cul', 3), 300, 720, [{ type: 'research_speed', target: 'all', value: 25 }, { type: 'hero_exp', target: 'all', value: 20 }], '📚'),
  n('cul_t3_general', '名将荟萃', '招募消耗-25%，武将经验+15%', 'culture', 3, ['cul_t2_talent'], M('cul', 3), 300, 720, [{ type: 'recruit_discount', target: 'gold', value: 25 }, { type: 'hero_exp', target: 'all', value: 15 }], '⚔️'),
  n('cul_t4_wisdom', '天下归心', '研究速度+30%，全属性+10%', 'culture', 4, ['cul_t3_scholar'], '', 800, 1800, [{ type: 'research_speed', target: 'all', value: 30 }, { type: 'hero_exp', target: 'all', value: 10 }], '🌈'),
  n('cul_t4_legacy', '千秋万代', '招募消耗-30%，武将经验+30%', 'culture', 4, ['cul_t3_general'], '', 800, 1800, [{ type: 'recruit_discount', target: 'gold', value: 30 }, { type: 'hero_exp', target: 'all', value: 30 }], '🏆'),
];

// ─────────────────────────────────────────────
// 4. 汇总
// ─────────────────────────────────────────────

/** 全部科技节点定义 */
export const TECH_NODE_DEFS: TechNodeDef[] = [...MIL, ...ECO, ...CUL];

/** 按 ID 索引的节点定义映射 */
export const TECH_NODE_MAP: ReadonlyMap<string, TechNodeDef> = new Map(
  TECH_NODE_DEFS.map((nd) => [nd.id, nd]),
);

// ─────────────────────────────────────────────
// 5. 连线数据
// ─────────────────────────────────────────────

function buildEdges(): TechEdge[] {
  const edges: TechEdge[] = [];
  const groups = new Map<string, string[]>();

  for (const nd of TECH_NODE_DEFS) {
    for (const preId of nd.prerequisites) {
      edges.push({ from: preId, to: nd.id, type: 'prerequisite' });
    }
    if (nd.mutexGroup) {
      const list = groups.get(nd.mutexGroup) ?? [];
      list.push(nd.id);
      groups.set(nd.mutexGroup, list);
    }
  }

  for (const [, ids] of groups) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        edges.push({ from: ids[i], to: ids[j], type: 'mutex' });
      }
    }
  }

  return edges;
}

export const TECH_EDGES: TechEdge[] = buildEdges();

// ─────────────────────────────────────────────
// 6. 查询辅助
// ─────────────────────────────────────────────

export function getNodesByPath(path: string): TechNodeDef[] {
  return TECH_NODE_DEFS.filter((nd) => nd.path === path);
}

export function getNodesByTier(path: string, tier: number): TechNodeDef[] {
  return TECH_NODE_DEFS.filter((nd) => nd.path === path && nd.tier === tier);
}

export function getMutexGroups(): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const nd of TECH_NODE_DEFS) {
    if (!nd.mutexGroup) continue;
    const list = groups.get(nd.mutexGroup) ?? [];
    list.push(nd.id);
    groups.set(nd.mutexGroup, list);
  }
  return groups;
}

export function getQueueSizeForAcademyLevel(level: number): number {
  let size = BASE_RESEARCH_QUEUE_SIZE;
  for (const [lvl, s] of Object.entries(ACADEMY_QUEUE_SIZE_MAP)) {
    if (Number(lvl) <= level) size = s;
  }
  return size;
}

export function getTechPointProduction(academyLevel: number): number {
  let production = 0;
  for (const [lvl, prod] of Object.entries(ACADEMY_TECH_POINT_PRODUCTION)) {
    if (Number(lvl) <= academyLevel) production = prod;
  }
  return production;
}

// ─────────────────────────────────────────────
// Sprint 3: 书院研究辅助函数
// ─────────────────────────────────────────────

/**
 * 获取可研究科技上限（书院等级 × 2）
 * XI-005: 书院等级 → 可研究科技上限
 */
export function getMaxResearchableTechCount(academyLevel: number): number {
  if (!Number.isFinite(academyLevel) || academyLevel <= 0) return 0;
  return Math.floor(academyLevel * ACADEMY_TECH_CAP_MULTIPLIER);
}

/**
 * 获取书院研究速度加成倍率（1 + 书院等级 × 0.1）
 * XI-005: 书院等级 → 研究速度加成
 */
export function getAcademyResearchSpeedMultiplier(academyLevel: number): number {
  if (!Number.isFinite(academyLevel) || academyLevel <= 0) return 1;
  return 1 + academyLevel * ACADEMY_RESEARCH_SPEED_PER_LEVEL;
}
