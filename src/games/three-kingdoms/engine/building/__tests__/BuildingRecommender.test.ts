/**
 * 建筑升级推荐测试
 *
 * 覆盖：recommendUpgradePath、getUpgradeRouteRecommendation、getUpgradeRecommendation
 * 正常路径 + 边界条件 + 异常路径
 */

import { describe, it, expect } from 'vitest';
import {
  recommendUpgradePath,
  getUpgradeRouteRecommendation,
  getUpgradeRecommendation,
} from '../BuildingRecommender';
import type { BuildingSnapshot, GetProductionFn, GetUpgradeCostFn } from '../BuildingRecommender';
import type { BuildingType, BuildingState, UpgradeCost } from '../../shared/types';
import { BUILDING_MAX_LEVELS } from '../building-config';

// ── 辅助函数 ──

/** 创建建筑状态 */
function makeState(type: BuildingType, overrides: Partial<BuildingState> = {}): BuildingState {
  return {
    type,
    level: 1,
    status: 'idle',
    upgradeStartTime: null,
    upgradeEndTime: null,
    ...overrides,
  };
}

/** 创建全部建筑快照（所有建筑初始解锁，Lv1） */
function makeAllBuildings(overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {}): BuildingSnapshot {
  const allTypes: BuildingType[] = ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'];
  const result = {} as BuildingSnapshot;
  for (const t of allTypes) {
    result[t] = makeState(t, overrides[t]);
  }
  return result;
}

/** 默认产出回调 */
const defaultGetProduction: GetProductionFn = () => 10;

/** 默认升级费用回调 */
const defaultGetUpgradeCost: GetUpgradeCostFn = () => ({ grain: 100, gold: 50, troops: 10, timeSeconds: 30 });

// ── recommendUpgradePath ──

describe('BuildingRecommender — recommendUpgradePath', () => {
  describe('newbie 阶段', () => {
    it('主城排在推荐列表第一位', () => {
      const buildings = makeAllBuildings();
      const result = recommendUpgradePath(buildings, 'newbie');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('castle');
    });

    it('推荐顺序为 castle → farmland → market → barracks ...', () => {
      const buildings = makeAllBuildings();
      const result = recommendUpgradePath(buildings, 'newbie');
      const types = result.map((r) => r.type);

      expect(types.indexOf('castle')).toBeLessThan(types.indexOf('farmland'));
      expect(types.indexOf('farmland')).toBeLessThan(types.indexOf('market'));
      expect(types.indexOf('market')).toBeLessThan(types.indexOf('barracks'));
    });

    it('每项推荐包含 reason 且不为空', () => {
      const buildings = makeAllBuildings();
      const result = recommendUpgradePath(buildings, 'newbie');

      for (const item of result) {
        expect(item.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe('development 阶段', () => {
    it('主城排在推荐列表第一位', () => {
      const buildings = makeAllBuildings();
      const result = recommendUpgradePath(buildings, 'development');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('castle');
    });

    it('铁匠铺排在兵营前面', () => {
      const buildings = makeAllBuildings();
      const result = recommendUpgradePath(buildings, 'development');
      const types = result.map((r) => r.type);

      if (types.includes('smithy') && types.includes('barracks')) {
        expect(types.indexOf('smithy')).toBeLessThan(types.indexOf('barracks'));
      }
    });
  });

  describe('late 阶段', () => {
    it('主城排在推荐列表第一位', () => {
      const buildings = makeAllBuildings();
      const result = recommendUpgradePath(buildings, 'late');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('castle');
    });

    it('城墙排在前列', () => {
      const buildings = makeAllBuildings();
      const result = recommendUpgradePath(buildings, 'late');
      const types = result.map((r) => r.type);

      expect(types.indexOf('wall')).toBeLessThan(4);
    });
  });

  describe('过滤逻辑', () => {
    it('已满级建筑不在推荐列表中', () => {
      const buildings = makeAllBuildings({
        castle: { level: BUILDING_MAX_LEVELS.castle },
      });
      const result = recommendUpgradePath(buildings, 'newbie');

      const castleRec = result.find((r) => r.type === 'castle');
      expect(castleRec).toBeUndefined();
    });

    it('正在升级的建筑不在推荐列表中', () => {
      const buildings = makeAllBuildings({
        farmland: { status: 'upgrading', upgradeStartTime: Date.now(), upgradeEndTime: Date.now() + 60000 },
      });
      const result = recommendUpgradePath(buildings, 'newbie');

      const farmlandRec = result.find((r) => r.type === 'farmland');
      expect(farmlandRec).toBeUndefined();
    });

    it('未解锁（locked）建筑不在推荐列表中', () => {
      const buildings = makeAllBuildings({
        wall: { status: 'locked', level: 0 },
      });
      const result = recommendUpgradePath(buildings, 'newbie');

      const wallRec = result.find((r) => r.type === 'wall');
      expect(wallRec).toBeUndefined();
    });
  });

  describe('边界条件', () => {
    it('所有建筑满级时返回空列表', () => {
      const buildings = makeAllBuildings();
      for (const t of Object.keys(buildings) as BuildingType[]) {
        buildings[t] = makeState(t, { level: BUILDING_MAX_LEVELS[t] });
      }

      const result = recommendUpgradePath(buildings, 'newbie');
      expect(result).toHaveLength(0);
    });

    it('无效的 context 参数回退到 newbie', () => {
      const buildings = makeAllBuildings();
      // @ts-expect-error 测试无效参数
      const result = recommendUpgradePath(buildings, 'invalid_context');

      // 应该回退到 newbie 的行为：主城第一
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('castle');
    });
  });
});

// ── getUpgradeRouteRecommendation ──

describe('BuildingRecommender — getUpgradeRouteRecommendation', () => {
  it('主城获得最高优先级 100', () => {
    const buildings = makeAllBuildings();
    const result = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    const castle = result.find((r) => r.type === 'castle');
    expect(castle).toBeDefined();
    expect(castle!.priority).toBe(100);
  });

  it('结果按优先级从高到低排序', () => {
    const buildings = makeAllBuildings();
    const result = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].priority).toBeGreaterThanOrEqual(result[i].priority);
    }
  });

  it('locked 建筑不在推荐列表中', () => {
    const buildings = makeAllBuildings({
      wall: { status: 'locked', level: 0 },
    });
    const result = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    const wall = result.find((r) => r.type === 'wall');
    expect(wall).toBeUndefined();
  });

  it('upgrading 建筑不在推荐列表中', () => {
    const buildings = makeAllBuildings({
      farmland: { status: 'upgrading' },
    });
    const result = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    const farmland = result.find((r) => r.type === 'farmland');
    expect(farmland).toBeUndefined();
  });

  it('已满级建筑不在推荐列表中', () => {
    const buildings = makeAllBuildings({
      castle: { level: BUILDING_MAX_LEVELS.castle },
    });
    const result = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    const castle = result.find((r) => r.type === 'castle');
    expect(castle).toBeUndefined();
  });

  it('非主城建筑等级超过主城时不在推荐列表中', () => {
    const buildings = makeAllBuildings({
      farmland: { level: 5 },
      castle: { level: 3 },
    });
    const result = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    const farmland = result.find((r) => r.type === 'farmland');
    expect(farmland).toBeUndefined();
  });

  it('资源不足时优先级降低 20', () => {
    const buildings = makeAllBuildings();
    // 不传 resources
    const resultNoResources = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    // 传 resources 但不足以支付
    const resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
    const resultWithResources = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost, resources);

    // 找到非主城建筑对比优先级
    const nonCastleNoRes = resultNoResources.find((r) => r.type !== 'castle');
    const nonCastleWithRes = resultWithResources.find((r) => r.type !== 'castle');

    if (nonCastleNoRes && nonCastleWithRes && nonCastleNoRes.type === nonCastleWithRes.type) {
      expect(nonCastleWithRes.priority).toBe(nonCastleNoRes.priority - 20);
    }
  });

  it('每项推荐包含 type、priority、reason、estimatedBenefit', () => {
    const buildings = makeAllBuildings();
    const result = getUpgradeRouteRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    for (const item of result) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('priority');
      expect(item).toHaveProperty('reason');
      expect(item).toHaveProperty('estimatedBenefit');
      expect(typeof item.priority).toBe('number');
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });
});

// ── getUpgradeRecommendation ──

describe('BuildingRecommender — getUpgradeRecommendation', () => {
  it('返回简化版推荐（仅 type 和 reason）', () => {
    const buildings = makeAllBuildings();
    const result = getUpgradeRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    for (const item of result) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('reason');
      // reason 中应包含 estimatedBenefit 信息
      expect(item.reason).toContain('（');
      expect(item.reason).toContain('）');
    }
  });

  it('推荐列表不为空（初始状态有可升级建筑）', () => {
    const buildings = makeAllBuildings();
    const result = getUpgradeRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    expect(result.length).toBeGreaterThan(0);
  });

  it('主城在推荐列表中', () => {
    const buildings = makeAllBuildings();
    const result = getUpgradeRecommendation(buildings, defaultGetProduction, defaultGetUpgradeCost);

    const castle = result.find((r) => r.type === 'castle');
    expect(castle).toBeDefined();
  });
});
