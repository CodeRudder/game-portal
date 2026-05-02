/**
 * C19 建筑升级路线推荐测试
 *
 * 覆盖：newbie/development/late 三种阶段推荐、
 * 已满级建筑跳过、未解锁建筑跳过、正在升级的建筑跳过
 */

import { describe, it, expect } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';

describe('C19 建筑升级路线推荐 (recommendUpgradePath)', () => {
  it('newbie 阶段主城排在第一位', () => {
    const bs = new BuildingSystem();
    const result = bs.recommendUpgradePath('newbie');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe('castle');
    expect(result[0].reason).toContain('主城');
  });

  it('development 阶段铁匠铺在推荐列表中（如果已解锁）', () => {
    const bs = new BuildingSystem();
    // 铁匠铺需要主城 Lv3 解锁
    const data = bs.serialize();
    data.buildings.castle.level = 3;
    data.buildings.castle.status = 'idle';
    bs.deserialize(data);

    const result = bs.recommendUpgradePath('development');
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].type).toBe('castle');
    const workshopRec = result.find((r) => r.type === 'workshop');
    expect(workshopRec).toBeDefined();
  });

  it('late 阶段城墙在推荐列表中（如果已解锁）', () => {
    const bs = new BuildingSystem();
    // 城墙需要主城 Lv5 解锁，初始状态未解锁
    // 先提升主城到 Lv5 以解锁城墙
    const data = bs.serialize();
    data.buildings.castle.level = 5;
    data.buildings.castle.status = 'idle';
    bs.deserialize(data);

    const result = bs.recommendUpgradePath('late');
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].type).toBe('castle');
    // 城墙已解锁，应在列表中
    const wallRec = result.find((r) => r.type === 'wall');
    expect(wallRec).toBeDefined();
  });

  it('每项推荐包含 type 和 reason', () => {
    const bs = new BuildingSystem();
    const result = bs.recommendUpgradePath('newbie');
    for (const item of result) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('reason');
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });

  it('未解锁建筑不在推荐列表中', () => {
    const bs = new BuildingSystem();
    // 初始状态：market 需要主城 Lv2 才解锁
    const market = bs.getBuilding('market');
    // 如果 market 未解锁（status=locked），不应出现在推荐中
    if (market.status === 'locked') {
      const result = bs.recommendUpgradePath('newbie');
      const marketRec = result.find((r) => r.type === 'market');
      expect(marketRec).toBeUndefined();
    }
  });

  it('推荐列表中不包含已满级建筑', () => {
    const bs = new BuildingSystem();
    // 初始建筑都是 Lv1，不会满级
    // 序列化一个满级状态来测试
    const data = bs.serialize();
    // 主城设为满级 30
    data.buildings.castle.level = 30;
    data.buildings.castle.status = 'idle';
    bs.deserialize(data);

    const result = bs.recommendUpgradePath('newbie');
    const castleRec = result.find((r) => r.type === 'castle');
    expect(castleRec).toBeUndefined();
  });

  it('正在升级的建筑不在推荐列表中', () => {
    const bs = new BuildingSystem();
    // 手动设置一个建筑为 upgrading 状态
    const data = bs.serialize();
    data.buildings.farmland.status = 'upgrading';
    data.buildings.farmland.upgradeStartTime = Date.now();
    data.buildings.farmland.upgradeEndTime = Date.now() + 60000;
    bs.deserialize(data);

    const result = bs.recommendUpgradePath('newbie');
    const farmlandRec = result.find((r) => r.type === 'farmland');
    expect(farmlandRec).toBeUndefined();
  });

  it('三种阶段推荐列表都至少包含主城（如果未满级）', () => {
    const bs = new BuildingSystem();
    for (const ctx of ['newbie', 'development', 'late'] as const) {
      const result = bs.recommendUpgradePath(ctx);
      const castleRec = result.find((r) => r.type === 'castle');
      expect(castleRec).toBeDefined();
    }
  });

  it('推荐顺序符合阶段策略', () => {
    const bs = new BuildingSystem();
    const newbie = bs.recommendUpgradePath('newbie');
    const types = newbie.map((r) => r.type);

    // newbie 阶段：主城排第一
    expect(types[0]).toBe('castle');
    // 农田应排在前列（初始解锁）
    expect(types).toContain('farmland');
  });
});
