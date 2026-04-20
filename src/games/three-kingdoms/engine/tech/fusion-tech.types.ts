/**
 * 科技域 — 融合科技类型定义
 *
 * 融合科技：跨路线组合解锁高级科技
 * 当玩家在两条不同路线各完成指定节点后，触发融合科技解锁
 *
 * 规则：只有 interface/type/const，零逻辑
 *
 * @module core/tech/fusion-tech.types
 */

import type { TechPath, TechEffect } from './tech.types';

export type { TechEffect } from './tech.types';

// ─────────────────────────────────────────────
// 1. 融合科技定义
// ─────────────────────────────────────────────

/** 融合科技路线组合 */
export type FusionPathPair = [TechPath, TechPath];

/** 融合科技节点状态 */
export type FusionTechStatus = 'locked' | 'available' | 'researching' | 'completed';

/** 融合科技前置条件（来自两条路线的节点 ID） */
export interface FusionPrerequisite {
  /** 第一条路线所需完成的节点 ID */
  pathA: string;
  /** 第二条路线所需完成的节点 ID */
  pathB: string;
}

/** 融合科技节点定义（静态配置） */
export interface FusionTechDef {
  /** 节点唯一 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description: string;
  /** 融合的两条路线 */
  pathPair: FusionPathPair;
  /** 前置条件（两条路线各需完成的节点） */
  prerequisites: FusionPrerequisite;
  /** 研究消耗科技点 */
  costPoints: number;
  /** 研究耗时（秒） */
  researchTime: number;
  /** 融合科技效果 */
  effects: TechEffect[];
  /** 节点图标 */
  icon: string;
}

/** 融合科技节点运行时状态 */
export interface FusionTechState {
  /** 节点 ID */
  id: string;
  /** 节点状态 */
  status: FusionTechStatus;
  /** 研究开始时间戳（ms），仅 researching 状态有值 */
  researchStartTime: number | null;
  /** 研究完成时间戳（ms），仅 researching 状态有值 */
  researchEndTime: number | null;
}

/** 融合科技系统完整状态 */
export interface FusionTechSystemState {
  /** 所有融合科技节点状态 */
  nodes: Record<string, FusionTechState>;
}

/** 融合科技存档数据 */
export interface FusionTechSaveData {
  /** 存档版本 */
  version: number;
  /** 已完成的融合科技 ID 列表 */
  completedFusionIds: string[];
}

// ─────────────────────────────────────────────
// 2. 融合科技配置数据
// ─────────────────────────────────────────────

/** 融合科技节点定义列表 */
export const FUSION_TECH_DEFS: FusionTechDef[] = [
  // ── 军事 + 经济 融合 ──
  {
    id: 'fusion_mil_eco_1',
    name: '兵精粮足',
    description: '军事与经济融合：全军攻击+15%，粮草产出+15%',
    pathPair: ['military', 'economy'],
    prerequisites: { pathA: 'mil_t2_charge', pathB: 'eco_t2_irrigation' },
    costPoints: 400,
    researchTime: 900,
    effects: [
      { type: 'troop_attack', target: 'all', value: 15 },
      { type: 'resource_production', target: 'grain', value: 15 },
    ],
    icon: '⚔️🌾',
  },
  {
    id: 'fusion_mil_eco_2',
    name: '铁骑商路',
    description: '军事与经济融合：骑兵攻击+20%，铜钱产出+20%',
    pathPair: ['military', 'economy'],
    prerequisites: { pathA: 'mil_t3_blitz', pathB: 'eco_t3_marketplace' },
    costPoints: 600,
    researchTime: 1200,
    effects: [
      { type: 'troop_attack', target: 'cavalry', value: 20 },
      { type: 'resource_production', target: 'gold', value: 20 },
    ],
    icon: '🐴🏪',
  },

  // ── 军事 + 文化 融合 ──
  {
    id: 'fusion_mil_cul_1',
    name: '兵法大家',
    description: '军事与文化融合：全军防御+15%，武将经验+15%',
    pathPair: ['military', 'culture'],
    prerequisites: { pathA: 'mil_t2_fortify', pathB: 'cul_t2_academy' },
    costPoints: 400,
    researchTime: 900,
    effects: [
      { type: 'troop_defense', target: 'all', value: 15 },
      { type: 'hero_exp', target: 'all', value: 15 },
    ],
    icon: '🛡️📚',
  },
  {
    id: 'fusion_mil_cul_2',
    name: '名将传承',
    description: '军事与文化融合：步兵生命+20%，研究速度+15%',
    pathPair: ['military', 'culture'],
    prerequisites: { pathA: 'mil_t3_endurance', pathB: 'cul_t3_scholar' },
    costPoints: 600,
    researchTime: 1200,
    effects: [
      { type: 'troop_hp', target: 'infantry', value: 20 },
      { type: 'research_speed', target: 'all', value: 15 },
    ],
    icon: '💪📖',
  },

  // ── 经济 + 文化 融合 ──
  {
    id: 'fusion_eco_cul_1',
    name: '文景之治',
    description: '经济与文化融合：全资源产出+15%，武将经验+15%',
    pathPair: ['economy', 'culture'],
    prerequisites: { pathA: 'eco_t2_irrigation', pathB: 'cul_t2_academy' },
    costPoints: 400,
    researchTime: 900,
    effects: [
      { type: 'resource_production', target: 'all', value: 15 },
      { type: 'hero_exp', target: 'all', value: 15 },
    ],
    icon: '💰📜',
  },
  {
    id: 'fusion_eco_cul_2',
    name: '盛世华章',
    description: '经济与文化融合：铜钱产出+25%，招募折扣+15%',
    pathPair: ['economy', 'culture'],
    prerequisites: { pathA: 'eco_t3_marketplace', pathB: 'cul_t3_general' },
    costPoints: 600,
    researchTime: 1200,
    effects: [
      { type: 'resource_production', target: 'gold', value: 25 },
      { type: 'recruit_discount', target: 'gold', value: 15 },
    ],
    icon: '✨🏆',
  },
];

/** 按 ID 索引的融合科技节点映射 */
export const FUSION_TECH_MAP: ReadonlyMap<string, FusionTechDef> = new Map(
  FUSION_TECH_DEFS.map((def) => [def.id, def]),
);
