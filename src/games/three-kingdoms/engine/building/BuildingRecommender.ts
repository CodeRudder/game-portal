/**
 * 建筑升级推荐 — 纯函数模块
 *
 * 职责：根据建筑状态与资源，生成升级推荐列表。
 *       所有数据通过参数传入，不持有可变状态。
 * 规则：可引用 building-config 和 building.types，禁止引用 BuildingSystem
 */

import type { BuildingType, BuildingState, UpgradeCost } from './building.types';
import { BUILDING_TYPES, BUILDING_LABELS } from './building.types';
import {
  BUILDING_DEFS,
  BUILDING_MAX_LEVELS,
} from './building-config';
import type { Resources } from '../resource/resource.types';

// ── 辅助类型 ──

/** 建筑快照：函数所需的全部建筑状态 */
export type BuildingSnapshot = Record<BuildingType, BuildingState>;

/** 获取指定建筑当前产出的回调 */
export type GetProductionFn = (type: BuildingType) => number;

/** 获取指定建筑升级费用的回调 */
export type GetUpgradeCostFn = (type: BuildingType) => UpgradeCost | null;

// ── 1. C19 建筑升级路线推荐（按游戏阶段） ──

/**
 * 建筑升级路线推荐（按游戏阶段）
 *
 * 根据当前建筑状态和游戏阶段，返回推荐的建筑升级顺序列表。
 * - newbie（新手期）：主城 → 农田 → 市集 → 兵营
 * - development（发展期）：主城 → 铁匠铺 → 书院 → 兵营 → 产出建筑
 * - late（后期）：主城 → 城墙 → 医馆 → 均衡提升
 *
 * @param buildings - 当前全部建筑状态快照
 * @param context - 游戏阶段
 * @returns 推荐的建筑升级顺序列表
 */
export function recommendUpgradePath(
  buildings: Readonly<BuildingSnapshot>,
  context: 'newbie' | 'development' | 'late',
): Array<{ type: BuildingType; reason: string }> {
  type Recommendation = { type: BuildingType; reason: string };

  const newbieOrder: BuildingType[] = ['castle', 'farmland', 'market', 'barracks', 'workshop', 'academy', 'clinic', 'wall'];
  const developmentOrder: BuildingType[] = ['castle', 'workshop', 'academy', 'barracks', 'farmland', 'market', 'wall', 'clinic'];
  const lateOrder: BuildingType[] = ['castle', 'wall', 'clinic', 'barracks', 'workshop', 'academy', 'farmland', 'market'];

  const orderMap: Record<string, BuildingType[]> = {
    newbie: newbieOrder,
    development: developmentOrder,
    late: lateOrder,
  };

  const order = orderMap[context] ?? newbieOrder;
  const reasons: Record<BuildingType, string> = {
    castle: '主城升级解锁新建筑并提升全资源加成',
    farmland: '农田提升粮草产出，保障基础资源',
    market: '市集提升铜钱产出，加速发展',
    mine: '矿场提升矿石产出，支撑装备锻造',
    lumberMill: '伐木场提升木材产出，支撑建筑升级',
    barracks: '兵营提升兵力产出，增强军力',
    workshop: '工坊提升锻造效率，强化装备品质',
    academy: '书院加速科技研究，解锁高级科技',
    clinic: '医馆提升恢复速率，减少战损',
    wall: '城墙提升城防值，增强防御能力',
    tavern: '酒馆提升招募概率，获取强力武将',
  };

  const result: Recommendation[] = [];

  for (const t of order) {
    const state = buildings[t];
    // 跳过已满级或正在升级的
    const maxLv = BUILDING_MAX_LEVELS[t];
    if (state.level >= maxLv) continue;
    if (state.status === 'upgrading') continue;
    // 跳过未解锁的
    if (state.status === 'locked') continue;

    result.push({ type: t, reason: reasons[t] });
  }

  return result;
}

// ── 2. 根据当前状态推荐升级路线 ──

/** 根据当前建筑状态推荐升级路线。策略：优先主城 → 产出建筑 → 功能建筑 */
export function getUpgradeRouteRecommendation(
  buildings: Readonly<BuildingSnapshot>,
  getProduction: GetProductionFn,
  getUpgradeCost: GetUpgradeCostFn,
  resources?: Readonly<Resources>,
): Array<{
  type: BuildingType;
  priority: number;
  reason: string;
  estimatedBenefit: string;
}> {
  const recommendations: Array<{
    type: BuildingType;
    priority: number;
    reason: string;
    estimatedBenefit: string;
  }> = [];

  for (const t of BUILDING_TYPES) {
    const state = buildings[t];
    if (state.status === 'locked' || state.status === 'upgrading') continue;
    if (state.level >= BUILDING_MAX_LEVELS[t]) continue;
    const levelOk = t === 'castle' || state.level < buildings.castle.level;
    if (!levelOk) continue;

    let priority = 0;
    let reason = '';
    let benefit = '';

    if (t === 'castle') {
      priority = 100;
      reason = '主城升级解锁新建筑并提升全资源加成';
      const nextBonus = BUILDING_DEFS.castle.levelTable[state.level]?.production ?? 0;
      benefit = `全资源加成 +${nextBonus}%`;
    } else {
      const def = BUILDING_DEFS[t];
      const currentProd = getProduction(t);
      const nextProd = def.levelTable[state.level]?.production ?? currentProd;
      const prodGain = nextProd - currentProd;
      if (def.production) {
        priority = 50 + Math.round(prodGain * 10);
        reason = `${BUILDING_LABELS[t]}产出提升`;
        benefit = `产出 +${prodGain.toFixed(1)}/s`;
      } else {
        priority = 30;
        reason = `${BUILDING_LABELS[t]}功能强化`;
        const specialVal = def.levelTable[state.level]?.specialValue ?? 0;
        benefit = specialVal > 0 ? `属性值 +${specialVal}` : '等级提升';
      }
    }

    if (resources) {
      const cost = getUpgradeCost(t);
      if (cost && (resources.grain < cost.grain || resources.gold < cost.gold)) {
        priority -= 20;
      }
    }

    recommendations.push({ type: t, priority, reason, estimatedBenefit: benefit });
  }

  return recommendations.sort((a, b) => b.priority - a.priority);
}

// ── 3. 建筑升级路线推荐（简化版） ──

/**
 * 建筑升级路线推荐（简化版）
 *
 * 返回当前可升级建筑的推荐顺序，按优先级从高到低排列。
 * 综合考虑：主城优先 → 产出增益 → 资源充足度。
 *
 * @param buildings - 当前全部建筑状态快照
 * @param getProduction - 获取指定建筑当前产出的回调
 * @param getUpgradeCost - 获取指定建筑升级费用的回调
 * @param resources - 当前资源（可选，影响优先级调整）
 * @returns 推荐的建筑升级顺序列表
 */
export function getUpgradeRecommendation(
  buildings: Readonly<BuildingSnapshot>,
  getProduction: GetProductionFn,
  getUpgradeCost: GetUpgradeCostFn,
  resources?: Readonly<Resources>,
): Array<{
  type: BuildingType;
  reason: string;
}> {
  return getUpgradeRouteRecommendation(buildings, getProduction, getUpgradeCost, resources).map((r) => ({
    type: r.type,
    reason: `${r.reason}（${r.estimatedBenefit}）`,
  }));
}
