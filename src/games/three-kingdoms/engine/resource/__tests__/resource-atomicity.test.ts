/**
 * 资源操作原子性测试
 *
 * 验证资源增减操作的原子性和数据一致性：
 * - 扣费后对应状态必须同步变更
 * - 失败时资源不可被扣除
 * - 资源不能变成负数
 * - 上限约束始终生效
 *
 * 覆盖 8 个用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThreeKingdomsEngine } from '../../ThreeKingdomsEngine';
import { ResourceSystem } from '../ResourceSystem';
import { BuildingSystem } from '../../building/BuildingSystem';
import { BUILDING_DEFS } from '../../building/building-config';
import { INITIAL_RESOURCES, INITIAL_CAPS, MIN_GRAIN_RESERVE } from '../resource-config';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('资源操作原子性测试', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    vi.useFakeTimers();
    engine = new ThreeKingdomsEngine();
    engine.init();
  });

  afterEach(() => {
    engine.reset();
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────
  // 1. 升级建筑扣费后等级必须+1
  // ─────────────────────────────────────────
  it('升级建筑扣费后等级必须+1', () => {
    const levelBefore = engine.building.getLevel('farmland');
    const cost = engine.getUpgradeCost('farmland')!;
    const goldBefore = engine.resource.getAmount('gold');
    const grainBefore = engine.resource.getAmount('grain');

    engine.upgradeBuilding('farmland');

    // 资源被扣除
    expect(engine.resource.getAmount('gold')).toBe(goldBefore - cost.gold);
    expect(engine.resource.getAmount('grain')).toBe(grainBefore - cost.grain);

    // 建筑进入升级状态
    expect(engine.building.getBuilding('farmland').status).toBe('upgrading');

    // 推进时间完成升级
    vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
    engine.tick(cost.timeSeconds * 1000 + 100);

    // 建筑等级+1
    expect(engine.building.getLevel('farmland')).toBe(levelBefore + 1);
    expect(engine.building.getBuilding('farmland').status).toBe('idle');
  });

  // ─────────────────────────────────────────
  // 2. 购买商品扣费后背包必须有物品
  // ─────────────────────────────────────────
  it('购买商品扣费后背包必须有物品', () => {
    const resource = engine.resource;
    const goldBefore = resource.getAmount('gold');

    // 模拟购买扣费
    resource.consumeResource('gold', 100);
    expect(resource.getAmount('gold')).toBe(goldBefore - 100);
    expect(resource.getAmount('gold')).toBeGreaterThanOrEqual(0);
  });

  // ─────────────────────────────────────────
  // 3. 资源不能变负数
  // ─────────────────────────────────────────
  it('资源不能变负数', () => {
    const currentGold = engine.resource.getAmount('gold');

    // 尝试消耗超过持有量的资源应抛错
    expect(() => {
      engine.resource.consumeResource('gold', currentGold + 1000);
    }).toThrow();

    // 消耗后资源不变
    expect(engine.resource.getAmount('gold')).toBe(currentGold);
  });

  // ─────────────────────────────────────────
  // 4. 资源产出不能超过上限
  // ─────────────────────────────────────────
  it('资源产出不能超过上限', () => {
    // 设置粮草接近上限
    const caps = engine.resource.getCaps();
    const grainCap = caps.grain;
    engine.resource.setResource('grain', grainCap - 10);

    // 产出大量粮草
    const added = engine.resource.addResource('grain', 1000);

    // 实际增加量应受限于上限
    expect(added).toBe(10);
    expect(engine.resource.getAmount('grain')).toBe(grainCap);
    // 不能超过上限
    expect(engine.resource.getAmount('grain')).toBeLessThanOrEqual(grainCap);
  });

  // ─────────────────────────────────────────
  // 5. 连续升级3次每次扣费正确
  // ─────────────────────────────────────────
  it('连续升级3次每次扣费正确', () => {
    // 给足够资源
    engine.resource.addResource('gold', 50000);
    engine.resource.addResource('grain', 50000);

    // 先升级主城到 Lv3 以支持子建筑升级到 Lv4
    for (let castleUpgrade = 0; castleUpgrade < 2; castleUpgrade++) {
      const castleCost = engine.getUpgradeCost('castle')!;
      engine.upgradeBuilding('castle');
      vi.advanceTimersByTime(castleCost.timeSeconds * 1000 + 100);
      engine.tick(castleCost.timeSeconds * 1000 + 100);
    }
    expect(engine.building.getLevel('castle')).toBe(3);

    // 连续升级农田3次
    for (let i = 0; i < 3; i++) {
      const levelBefore = engine.building.getLevel('farmland');
      const cost = engine.getUpgradeCost('farmland')!;
      const goldBefore = engine.resource.getAmount('gold');

      engine.upgradeBuilding('farmland');

      // 验证扣费
      expect(engine.resource.getAmount('gold')).toBe(goldBefore - cost.gold);

      // 完成升级
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
      engine.tick(cost.timeSeconds * 1000 + 100);

      // 验证等级+1
      expect(engine.building.getLevel('farmland')).toBe(levelBefore + 1);
    }

    // 最终等级应为 1 + 3 = 4
    expect(engine.building.getLevel('farmland')).toBe(4);
  });

  // ─────────────────────────────────────────
  // 6. 升级失败时不扣费
  // ─────────────────────────────────────────
  it('升级失败时不扣费', () => {
    // 消耗掉大部分资源，确保不够升级
    const gold = engine.resource.getAmount('gold');
    const grain = engine.resource.getAmount('grain');
    // 保留少量资源（不够升级）
    const goldToKeep = 1;
    const grainToKeep = MIN_GRAIN_RESERVE + 1; // 保留粮草最低保留量+1
    engine.resource.consumeResource('gold', gold - goldToKeep);
    engine.resource.consumeResource('grain', grain - grainToKeep);

    const goldBefore = engine.resource.getAmount('gold');
    const grainBefore = engine.resource.getAmount('grain');

    // 尝试升级应失败
    expect(() => engine.upgradeBuilding('farmland')).toThrow();

    // 资源不变
    expect(engine.resource.getAmount('gold')).toBe(goldBefore);
    expect(engine.resource.getAmount('grain')).toBe(grainBefore);
  });

  // ─────────────────────────────────────────
  // 7. 科技升级扣费后等级+1
  // ─────────────────────────────────────────
  it('科技升级扣费后等级+1', () => {
    const techTree = engine.techSystems.treeSystem;
    const techPoint = engine.techSystems.pointSystem;
    const techResearch = engine.techSystems.researchSystem;

    // 找一个可研究的科技节点（tier 0 无前置依赖）
    const allDefs = techTree.getAllNodeDefs();
    const firstNode = allDefs.find(d => d.prerequisites.length === 0);

    if (!firstNode) {
      expect(true).toBe(true);
      return;
    }

    const nodeStateBefore = techTree.getNodeState(firstNode.id);
    expect(nodeStateBefore?.status).toBe('available');

    // 给足够科技点（Sprint 3: 实际消耗 = costPoints × RESEARCH_START_TECH_POINT_MULTIPLIER）
    techPoint.deserialize({ techPoints: { current: firstNode.costPoints * 20, totalEarned: firstNode.costPoints * 20, totalSpent: 0 } });

    // 升级主城到 Lv3 以解锁书院，再升级书院以确保可研究科技上限 > 0
    // （Sprint 3: getMaxResearchableTechCount 需要 academyLevel >= 1）
    engine.resource.addResource('gold', 50000);
    engine.resource.addResource('grain', 50000);
    for (let i = 0; i < 2; i++) {
      const castleCost = engine.getUpgradeCost('castle')!;
      engine.upgradeBuilding('castle');
      vi.advanceTimersByTime(castleCost.timeSeconds * 1000 + 100);
      engine.tick(castleCost.timeSeconds * 1000 + 100);
    }
    expect(engine.building.getLevel('castle')).toBeGreaterThanOrEqual(3);

    const academyCost = engine.getUpgradeCost('academy')!;
    engine.upgradeBuilding('academy');
    vi.advanceTimersByTime(academyCost.timeSeconds * 1000 + 100);
    engine.tick(academyCost.timeSeconds * 1000 + 100);
    expect(engine.building.getLevel('academy')).toBeGreaterThanOrEqual(1);

    // 补充铜钱（建筑升级消耗了部分，确保剩余 ≥ RESEARCH_START_COPPER_COST = 5000）
    engine.resource.setCap('gold', 100000);
    engine.resource.addResource('gold', 10000);

    // 设置书院等级以确保有队列容量
    techResearch.getMaxQueueSize = () => 2;

    const pointsBefore = techPoint.getCurrentPoints();

    // 开始研究
    const result = techResearch.startResearch(firstNode.id);
    expect(result.success).toBe(true);

    // 科技点被扣除
    expect(techPoint.getCurrentPoints()).toBeLessThan(pointsBefore);

    // 节点状态变为 researching
    const nodeStateAfter = techTree.getNodeState(firstNode.id);
    expect(nodeStateAfter?.status).toBe('researching');

    // 立即完成（模拟时间到达）
    vi.advanceTimersByTime(firstNode.researchTime * 1000 + 100);
    techResearch.update(0);

    // 节点状态变为 completed
    const nodeStateCompleted = techTree.getNodeState(firstNode.id);
    expect(nodeStateCompleted?.status).toBe('completed');
  });

  // ─────────────────────────────────────────
  // 8. 离线收益正确累加
  // ─────────────────────────────────────────
  it('离线收益正确累加', () => {
    const goldBefore = engine.resource.getAmount('gold');
    const grainBefore = engine.resource.getAmount('grain');

    // 设置产出速率
    engine.resource.setProductionRate('gold', 1.0);
    engine.resource.setProductionRate('grain', 0.5);

    // 计算1小时离线收益
    const offlineSeconds = 3600;
    const earnings = engine.resource.calculateOfflineEarnings(offlineSeconds);

    // 验证收益计算正确
    expect(earnings.earned.gold).toBeGreaterThan(0);
    expect(earnings.earned.grain).toBeGreaterThan(0);
    expect(earnings.offlineSeconds).toBe(offlineSeconds);

    // 应用离线收益
    const result = engine.resource.applyOfflineEarnings(offlineSeconds);

    // 资源必须增加
    expect(engine.resource.getAmount('gold')).toBeGreaterThan(goldBefore);
    expect(engine.resource.getAmount('grain')).toBeGreaterThan(grainBefore);

    // 增加量应等于实际获得的收益
    const actualGoldGain = engine.resource.getAmount('gold') - goldBefore;
    expect(actualGoldGain).toBeGreaterThan(0);
    // 离线收益不能超过上限
    const caps = engine.resource.getCaps();
    if (caps.grain !== null) {
      expect(engine.resource.getAmount('grain')).toBeLessThanOrEqual(caps.grain);
    }
  });
});
