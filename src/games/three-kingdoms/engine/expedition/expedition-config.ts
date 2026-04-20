/**
 * 远征系统 — 配置常量
 *
 * 所有远征相关的硬编码配置集中管理
 *
 * @module engine/expedition/expedition-config
 */

import type {
  ExpeditionRegion,
  ExpeditionRoute,
  MilestoneConfig,
} from '../../core/expedition/expedition.types';
import {
  RouteDifficulty,
  NodeType,
  NodeStatus,
  MilestoneType,
} from '../../core/expedition/expedition.types';

// ─────────────────────────────────────────────
// 1. 远征战斗配置
// ─────────────────────────────────────────────

/** 远征战斗最大回合数 */
export const EXPEDITION_MAX_TURNS = 10;

/** 阵型克制加成比例 */
export const FORMATION_COUNTER_BONUS = 0.10;

/** 掉落概率配置 */
export const DROP_RATES = {
  /** 普通节点掉率 */
  normal: {
    equip_fragment: 0.30,
    hero_fragment: 0.05,
    skill_book: 0.02,
    rare_material: 0,
    legendary_equip: 0,
  },
  /** BOSS节点掉率 */
  boss: {
    equip_fragment: 0.60,
    hero_fragment: 0.15,
    skill_book: 0.10,
    rare_material: 0.08,
    legendary_equip: 0.01,
  },
  /** 奇袭路线BOSS掉率 */
  ambushBoss: {
    equip_fragment: 0.80,
    hero_fragment: 0.25,
    skill_book: 0.20,
    rare_material: 0.15,
    legendary_equip: 0.03,
  },
} as const;

/** 基础奖励表（按路线难度） */
export const BASE_REWARDS: Record<RouteDifficulty, {
  grain: number; gold: number; iron: number; equipFragments: number; exp: number;
}> = {
  [RouteDifficulty.EASY]: { grain: 200, gold: 400, iron: 1, equipFragments: 1, exp: 500 },
  [RouteDifficulty.NORMAL]: { grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200 },
  [RouteDifficulty.HARD]: { grain: 600, gold: 1200, iron: 4, equipFragments: 4, exp: 2500 },
  [RouteDifficulty.AMBUSH]: { grain: 1000, gold: 2000, iron: 6, equipFragments: 6, exp: 5000 },
};

/** 首通奖励 */
export const FIRST_CLEAR_REWARD = {
  heroFragment: 1,
  gems: 50,
  reputation: 20,
};

/** 推荐战力倍率 */
export const POWER_MULTIPLIERS: Record<RouteDifficulty, number> = {
  [RouteDifficulty.EASY]: 1.0,
  [RouteDifficulty.NORMAL]: 1.5,
  [RouteDifficulty.HARD]: 2.0,
  [RouteDifficulty.AMBUSH]: 3.0,
};

/** 行军时长范围（秒） */
export const MARCH_DURATION: Record<RouteDifficulty, { min: number; max: number }> = {
  [RouteDifficulty.EASY]: { min: 1800, max: 2700 },     // 30~45min
  [RouteDifficulty.NORMAL]: { min: 2700, max: 5400 },    // 45min~1.5h
  [RouteDifficulty.HARD]: { min: 3600, max: 7200 },      // 1~2h
  [RouteDifficulty.AMBUSH]: { min: 7200, max: 10800 },   // 2~3h
};

// ─────────────────────────────────────────────
// 2. 里程碑配置
// ─────────────────────────────────────────────

export const MILESTONE_CONFIGS: MilestoneConfig[] = [
  {
    type: MilestoneType.FIRST_CLEAR,
    name: '初出茅庐',
    requiredClears: 1,
    reward: { grain: 0, gold: 1000, iron: 0, equipFragments: 0, exp: 0, drops: [] },
  },
  {
    type: MilestoneType.TEN_CLEARS,
    name: '百战之师',
    requiredClears: 10,
    reward: { grain: 0, gold: 0, iron: 0, equipFragments: 0, exp: 0, drops: [] },
  },
  {
    type: MilestoneType.THIRTY_CLEARS,
    name: '远征名将',
    requiredClears: 30,
    reward: { grain: 0, gold: 0, iron: 0, equipFragments: 0, exp: 0, drops: [] },
  },
  {
    type: MilestoneType.ALL_CLEARS,
    name: '天下布武',
    requiredClears: -1, // 特殊值：全部路线
    reward: { grain: 0, gold: 0, iron: 0, equipFragments: 0, exp: 0, drops: [] },
  },
];

// ─────────────────────────────────────────────
// 3. 连续失败暂停阈值
// ─────────────────────────────────────────────

/** 连续失败暂停阈值 */
export const CONSECUTIVE_FAILURE_LIMIT = 2;

/** 休息点恢复兵力百分比 */
export const REST_HEAL_PERCENT = 0.20;

// ─────────────────────────────────────────────
// 4. 预设区域与路线（示例配置）
// ─────────────────────────────────────────────

/** 创建默认区域 */
export function createDefaultRegions(): Record<string, ExpeditionRegion> {
  return {
    'region_hulao': { id: 'region_hulao', name: '虎牢关', order: 1, routeIds: ['route_hulao_easy', 'route_hulao_normal', 'route_hulao_hard'] },
    'region_yishui': { id: 'region_yishui', name: '汜水关', order: 2, routeIds: ['route_yishui_easy', 'route_yishui_normal', 'route_yishui_hard'] },
    'region_luoyang': { id: 'region_luoyang', name: '洛阳', order: 3, routeIds: ['route_luoyang_easy', 'route_luoyang_normal', 'route_luoyang_hard', 'route_luoyang_ambush'] },
  };
}

/** 创建示例路线节点 */
function createRouteNodes(
  routeId: string,
  difficulty: RouteDifficulty,
  basePower: number,
): { nodes: Record<string, import('../../core/expedition/expedition.types').ExpeditionNode>; startNodeId: string; endNodeId: string } {
  const mult = POWER_MULTIPLIERS[difficulty];
  const nodes: Record<string, import('../../core/expedition/expedition.types').ExpeditionNode> = {};
  const prefix = routeId;

  // 节点序列：山贼 -> (天险|宝箱) -> 山贼 -> Boss
  const nodeDefs: Array<{ id: string; type: NodeType; name: string; powerMult: number }> = [
    { id: `${prefix}_n1`, type: NodeType.BANDIT, name: '山贼前哨', powerMult: 0.6 },
    { id: `${prefix}_n2`, type: NodeType.HAZARD, name: '险峻山路', powerMult: 0.8 },
    { id: `${prefix}_n3`, type: NodeType.TREASURE, name: '隐藏宝箱', powerMult: 0 },
    { id: `${prefix}_n4`, type: NodeType.BANDIT, name: '山贼主力', powerMult: 1.0 },
    { id: `${prefix}_n5`, type: NodeType.REST, name: '休整营地', powerMult: 0 },
    { id: `${prefix}_n6`, type: NodeType.BOSS, name: '守关大将', powerMult: 1.2 },
  ];

  for (let i = 0; i < nodeDefs.length; i++) {
    const def = nodeDefs[i];
    const nextIds = i < nodeDefs.length - 1 ? [nodeDefs[i + 1].id] : [];
    nodes[def.id] = {
      id: def.id,
      type: def.type,
      name: def.name,
      status: NodeStatus.LOCKED,
      nextNodeIds: nextIds,
      recommendedPower: def.powerMult > 0 ? Math.round(basePower * mult * def.powerMult) : 0,
      healPercent: def.type === NodeType.REST ? REST_HEAL_PERCENT : undefined,
    };
  }

  return { nodes, startNodeId: nodeDefs[0].id, endNodeId: nodeDefs[nodeDefs.length - 1].id };
}

/** 创建默认路线 */
export function createDefaultRoutes(basePower: number = 1000): Record<string, ExpeditionRoute> {
  const routes: Record<string, ExpeditionRoute> = {};
  const routeDefs: Array<{
    id: string; name: string; regionId: string; difficulty: RouteDifficulty;
    requireHardClear?: boolean; requiredRegionId?: string;
  }> = [
    // 虎牢关
    { id: 'route_hulao_easy', name: '虎牢关·简', regionId: 'region_hulao', difficulty: RouteDifficulty.EASY },
    { id: 'route_hulao_normal', name: '虎牢关·普', regionId: 'region_hulao', difficulty: RouteDifficulty.NORMAL },
    { id: 'route_hulao_hard', name: '虎牢关·难', regionId: 'region_hulao', difficulty: RouteDifficulty.HARD },
    // 汜水关（需通关虎牢关）
    { id: 'route_yishui_easy', name: '汜水关·简', regionId: 'region_yishui', difficulty: RouteDifficulty.EASY, requiredRegionId: 'region_hulao' },
    { id: 'route_yishui_normal', name: '汜水关·普', regionId: 'region_yishui', difficulty: RouteDifficulty.NORMAL, requiredRegionId: 'region_hulao' },
    { id: 'route_yishui_hard', name: '汜水关·难', regionId: 'region_yishui', difficulty: RouteDifficulty.HARD, requiredRegionId: 'region_hulao' },
    // 洛阳（需通关汜水关）
    { id: 'route_luoyang_easy', name: '洛阳·简', regionId: 'region_luoyang', difficulty: RouteDifficulty.EASY, requiredRegionId: 'region_yishui' },
    { id: 'route_luoyang_normal', name: '洛阳·普', regionId: 'region_luoyang', difficulty: RouteDifficulty.NORMAL, requiredRegionId: 'region_yishui' },
    { id: 'route_luoyang_hard', name: '洛阳·难', regionId: 'region_luoyang', difficulty: RouteDifficulty.HARD, requiredRegionId: 'region_yishui' },
    { id: 'route_luoyang_ambush', name: '洛阳·奇袭', regionId: 'region_luoyang', difficulty: RouteDifficulty.AMBUSH, requiredRegionId: 'region_yishui', requireHardClear: true },
  ];

  for (const def of routeDefs) {
    const { nodes, startNodeId, endNodeId } = createRouteNodes(def.id, def.difficulty, basePower);
    routes[def.id] = {
      id: def.id,
      name: def.name,
      regionId: def.regionId,
      difficulty: def.difficulty,
      startNodeId,
      endNodeId,
      nodes,
      powerMultiplier: POWER_MULTIPLIERS[def.difficulty],
      marchDurationSeconds: (MARCH_DURATION[def.difficulty].min + MARCH_DURATION[def.difficulty].max) / 2,
      unlocked: !def.requiredRegionId,
      requiredRegionId: def.requiredRegionId,
      requireHardClear: def.requireHardClear,
    };
  }

  return routes;
}
