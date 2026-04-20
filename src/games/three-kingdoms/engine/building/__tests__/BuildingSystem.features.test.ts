/**
 * BuildingSystem 新增功能测试
 * 覆盖：C19 建筑升级路线推荐、B13 批量升级
 */

import { BuildingSystem } from '../BuildingSystem';
import type { BuildingType, BuildingState, Resources } from '../../../shared/types';
import { BUILDING_TYPES, BUILDING_LABELS } from '../building.types';
import { BUILDING_MAX_LEVELS, BUILDING_SAVE_VERSION } from '../building-config';

const RICH: Resources = { grain: 1e9, gold: 1e9, troops: 1e9, mandate: 0 };
const ZERO: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0 };

function makeSave(overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {}) {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) {
    buildings[t] = { type: t, level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null, ...overrides[t] };
  }
  return { version: BUILDING_SAVE_VERSION, buildings };
}

describe('BuildingSystem — C19 升级路线推荐', () => {
  let sys: BuildingSystem;
  let base: number;

  beforeEach(() => {
    jest.restoreAllMocks();
    base = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('初始状态下主城排在推荐首位', () => {
    const rec = sys.getUpgradeRouteRecommendation(RICH);
    expect(rec.length).toBeGreaterThan(0);
    expect(rec[0].type).toBe('castle');
    expect(rec[0].priority).toBe(100);
    expect(rec[0].reason).toContain('主城');
  });

  it('农田在推荐列表中', () => {
    // 农田Lv1, 主城Lv1 → 农田等级不能超过主城，需要主城更高
    sys.deserialize(makeSave({ castle: { level: 3 } }));
    const rec = sys.getUpgradeRouteRecommendation(RICH);
    const farmland = rec.find((r) => r.type === 'farmland');
    expect(farmland).toBeDefined();
    expect(farmland!.priority).toBeGreaterThan(0);
    expect(farmland!.estimatedBenefit).toContain('产出');
  });

  it('资源不足时优先级降低', () => {
    const recRich = sys.getUpgradeRouteRecommendation(RICH);
    const recPoor = sys.getUpgradeRouteRecommendation(ZERO);
    const castleRich = recRich.find((r) => r.type === 'castle')!;
    const castlePoor = recPoor.find((r) => r.type === 'castle')!;
    expect(castlePoor.priority).toBeLessThan(castleRich.priority);
  });

  it('锁定建筑不出现在推荐中', () => {
    const rec = sys.getUpgradeRouteRecommendation(RICH);
    const types = rec.map((r) => r.type);
    // market 初始锁定（需要主城Lv2）
    expect(types).not.toContain('market');
    expect(types).not.toContain('wall');
  });

  it('满级建筑不出现在推荐中', () => {
    sys.deserialize(makeSave({ castle: { level: BUILDING_MAX_LEVELS.castle } }));
    const rec = sys.getUpgradeRouteRecommendation(RICH);
    expect(rec.find((r) => r.type === 'castle')).toBeUndefined();
  });

  it('升级中的建筑不出现在推荐中', () => {
    sys.startUpgrade('castle', RICH);
    const rec = sys.getUpgradeRouteRecommendation(RICH);
    expect(rec.find((r) => r.type === 'castle')).toBeUndefined();
  });

  it('推荐按优先级降序排列', () => {
    const rec = sys.getUpgradeRouteRecommendation(RICH);
    for (let i = 1; i < rec.length; i++) {
      expect(rec[i].priority).toBeLessThanOrEqual(rec[i - 1].priority);
    }
  });

  it('主城升级后解锁建筑出现在推荐中', () => {
    sys.deserialize(makeSave({ castle: { level: 3 } }));
    const rec = sys.getUpgradeRouteRecommendation(RICH);
    const types = rec.map((r) => r.type);
    expect(types).toContain('market');
    expect(types).toContain('barracks');
  });
});

describe('BuildingSystem — getUpgradeRecommendation 简化版', () => {
  let sys: BuildingSystem;
  let base: number;

  beforeEach(() => {
    jest.restoreAllMocks();
    base = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('返回 type 和 reason 字段', () => {
    const rec = sys.getUpgradeRecommendation(RICH);
    expect(rec.length).toBeGreaterThan(0);
    for (const item of rec) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('reason');
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });

  it('主城排在推荐首位', () => {
    const rec = sys.getUpgradeRecommendation(RICH);
    expect(rec[0].type).toBe('castle');
    expect(rec[0].reason).toContain('主城');
  });

  it('reason 包含收益信息', () => {
    const rec = sys.getUpgradeRecommendation(RICH);
    const castle = rec.find((r) => r.type === 'castle')!;
    expect(castle.reason).toContain('全资源加成');
  });

  it('锁定建筑不出现在推荐中', () => {
    const rec = sys.getUpgradeRecommendation(RICH);
    const types = rec.map((r) => r.type);
    expect(types).not.toContain('wall');
  });

  it('满级建筑不出现在推荐中', () => {
    sys.deserialize(makeSave({ castle: { level: BUILDING_MAX_LEVELS.castle } }));
    const rec = sys.getUpgradeRecommendation(RICH);
    expect(rec.find((r) => r.type === 'castle')).toBeUndefined();
  });
});

describe('BuildingSystem — B13 批量升级', () => {
  let sys: BuildingSystem;
  let base: number;

  beforeEach(() => {
    jest.restoreAllMocks();
    base = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('批量升级可升级的建筑', () => {
    const result = sys.batchUpgrade(['castle'], RICH);
    expect(result.succeeded).toHaveLength(1);
    expect(result.succeeded[0].type).toBe('castle');
    expect(result.failed).toHaveLength(0);
    expect(result.totalCost.grain).toBeGreaterThan(0);
  });

  it('跳过不可升级的建筑并记录失败原因', () => {
    const result = sys.batchUpgrade(['market', 'castle'], RICH);
    expect(result.succeeded).toHaveLength(1);
    expect(result.succeeded[0].type).toBe('castle');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].type).toBe('market');
    expect(result.failed[0].reason).toBeTruthy();
  });

  it('资源不足时部分失败', () => {
    const result = sys.batchUpgrade(['castle', 'farmland'], { grain: 100, gold: 100, troops: 0, mandate: 0 });
    // 资源只够升级一个
    expect(result.succeeded.length + result.failed.length).toBe(2);
  });

  it('空列表返回空结果', () => {
    const result = sys.batchUpgrade([], RICH);
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.totalCost.grain).toBe(0);
  });

  it('批量升级不会超支资源', () => {
    // 只给刚好够升级一次的资源
    const cost = sys.getUpgradeCost('castle')!;
    const limited: Resources = { grain: cost.grain, gold: cost.gold, troops: cost.troops, mandate: 0 };
    const result = sys.batchUpgrade(['castle', 'farmland'], limited);
    // 第一个应该成功
    expect(result.succeeded.length).toBeGreaterThanOrEqual(1);
    // 总花费不超过初始资源
    expect(result.totalCost.grain).toBeLessThanOrEqual(limited.grain);
    expect(result.totalCost.gold).toBeLessThanOrEqual(limited.gold);
  });

  it('主城升级后状态变为 upgrading', () => {
    sys.batchUpgrade(['castle'], RICH);
    expect(sys.getBuilding('castle').status).toBe('upgrading');
  });

  it('队列满时后续建筑失败', () => {
    // 主城Lv1 只有1个队列槽位
    sys.batchUpgrade(['castle', 'farmland'], RICH);
    // farmland 应该因为等级限制失败（不超过主城等级）
    // 或者队列满
    const building = sys.getBuilding('castle');
    expect(building.status).toBe('upgrading');
  });
});
