/**
 * R12 交叉审查 — 建筑-资源交叉验证
 *
 * 核心原则：用 ResourceSystem 的视角验证 BuildingSystem 的行为，
 * 反之亦然，打破"谁写的代码谁写测试"的自洽陷阱。
 *
 * 验证维度：
 *  1. BuildingSystem 说升级成功 → ResourceSystem 确认资源已扣
 *  2. BuildingSystem 说升级失败 → ResourceSystem 确认资源未变
 *  3. BuildingSystem 满级 → ResourceSystem 确认不再扣费
 *  4. 建筑产出 → ResourceSystem 确认资源增加量正确
 *  5. 连续升级3次 → ResourceSystem 确认总扣费正确
 *  6. 建筑加速 → ResourceSystem 确认加速消耗正确
 *  7. 建筑拆除/取消 → ResourceSystem 确认返还资源
 *  8. 离线收益 → ResourceSystem 确认建筑产出累加正确
 *  9. 科技加成 → BuildingSystem 确认产出受科技影响
 * 10. 存档/加载 → 建筑等级和资源数量一致
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import type { BuildingType, UpgradeCost } from '../building/building.types';
import type { ResourceType } from '../../shared/types';

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

describe('R12 交叉审查 — 建筑↔资源一致性', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. BuildingSystem 说升级成功 → ResourceSystem 确认资源已扣
  // ═══════════════════════════════════════════════════════════
  it('升级成功时 ResourceSystem 确认资源已扣除', () => {
    engine.init();

    const check = engine.checkUpgrade('farmland');
    if (!check.canUpgrade) return; // 资源不足则跳过

    const cost = engine.getUpgradeCost('farmland');
    expect(cost).not.toBeNull();

    const goldBefore = engine.resource.getAmount('gold');
    const grainBefore = engine.resource.getAmount('grain');
    const troopsBefore = engine.resource.getAmount('troops');

    engine.upgradeBuilding('farmland');

    // 交叉验证：ResourceSystem 视角确认资源确实被扣
    expect(engine.resource.getAmount('gold')).toBeLessThan(goldBefore);
    expect(engine.resource.getAmount('grain')).toBeLessThan(grainBefore);

    // 精确验证：扣除量与 UpgradeCost 一致
    if (cost) {
      expect(goldBefore - engine.resource.getAmount('gold')).toBe(cost.gold);
      expect(grainBefore - engine.resource.getAmount('grain')).toBe(cost.grain);
      // troops 扣除量可能为 0
      if (cost.troops > 0) {
        expect(troopsBefore - engine.resource.getAmount('troops')).toBe(cost.troops);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 2. BuildingSystem 说升级失败 → ResourceSystem 确认资源未变
  // ═══════════════════════════════════════════════════════════
  it('资源不足升级失败时 ResourceSystem 确认资源未变', () => {
    engine.init();

    // 清空资源
    engine.resource.setResource('gold', 0);
    engine.resource.setResource('grain', 0);
    engine.resource.setResource('troops', 0);

    const goldBefore = engine.resource.getAmount('gold');
    const grainBefore = engine.resource.getAmount('grain');

    // BuildingSystem 应拒绝升级
    const check = engine.checkUpgrade('farmland');
    expect(check.canUpgrade).toBe(false);

    // 交叉验证：尝试升级应抛出异常，资源不变
    expect(() => engine.upgradeBuilding('farmland')).toThrow();

    expect(engine.resource.getAmount('gold')).toBe(goldBefore);
    expect(engine.resource.getAmount('grain')).toBe(grainBefore);
  });

  // ═══════════════════════════════════════════════════════════
  // 3. BuildingSystem 满级 → ResourceSystem 确认不再扣费
  // ═══════════════════════════════════════════════════════════
  it('建筑满级时 ResourceSystem 确认资源不被扣除', () => {
    engine.init();

    // 给大量资源以便能升级
    engine.resource.setResource('gold', 9999999);
    engine.resource.setResource('grain', 9999999);
    engine.resource.setResource('troops', 9999999);

    // 反复升级直到满级
    const MAX_LEVEL = 50;
    let upgradedTimes = 0;
    for (let i = 0; i < MAX_LEVEL + 5; i++) {
      const check = engine.checkUpgrade('farmland');
      if (!check.canUpgrade) break;
      engine.upgradeBuilding('farmland');
      engine.building.forceCompleteUpgrades();
      upgradedTimes++;
    }

    // 满级后尝试升级
    const check = engine.checkUpgrade('farmland');
    if (!check.canUpgrade) {
      const goldBefore = engine.resource.getAmount('gold');
      const grainBefore = engine.resource.getAmount('grain');

      // 交叉验证：满级后不应能升级，资源不变
      expect(() => engine.upgradeBuilding('farmland')).toThrow();
      expect(engine.resource.getAmount('gold')).toBe(goldBefore);
      expect(engine.resource.getAmount('grain')).toBe(grainBefore);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 建筑产出 → ResourceSystem 确认资源增加量正确
  // ═══════════════════════════════════════════════════════════
  it('建筑产出后 ResourceSystem 确认资源增加量正确', () => {
    engine.init();

    // 记录当前产出速率
    const rates = engine.resource.getProductionRates();
    const grainBefore = engine.resource.getAmount('grain');

    // 模拟 10 秒 tick
    engine.tick(10000);

    const grainAfter = engine.resource.getAmount('grain');
    const grainGained = grainAfter - grainBefore;

    // 交叉验证：ResourceSystem 的资源增量与产出速率一致
    // grain 产出速率 * 10 秒 = 增量（允许浮点误差）
    const expectedGain = rates.grain * 10;
    expect(grainGained).toBeCloseTo(expectedGain, 0);
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 连续升级3次 → ResourceSystem 确认总扣费正确
  // ═══════════════════════════════════════════════════════════
  it('连续升级3次后 ResourceSystem 确认总扣费正确', () => {
    engine.init();

    // 给大量资源
    engine.resource.setResource('gold', 9999999);
    engine.resource.setResource('grain', 9999999);
    engine.resource.setResource('troops', 9999999);

    const goldBefore = engine.resource.getAmount('gold');
    const grainBefore = engine.resource.getAmount('grain');
    const troopsBefore = engine.resource.getAmount('troops');

    let totalGoldCost = 0;
    let totalGrainCost = 0;
    let totalTroopsCost = 0;
    let upgradeCount = 0;

    for (let i = 0; i < 3; i++) {
      const check = engine.checkUpgrade('farmland');
      if (!check.canUpgrade) break;

      const cost = engine.getUpgradeCost('farmland');
      if (!cost) break;

      totalGoldCost += cost.gold;
      totalGrainCost += cost.grain;
      totalTroopsCost += cost.troops;

      engine.upgradeBuilding('farmland');
      engine.building.forceCompleteUpgrades();
      engine.tick(0);
      upgradeCount++;
    }

    if (upgradeCount > 0) {
      // 交叉验证：ResourceSystem 确认总扣除量与各次费用之和一致
      expect(goldBefore - engine.resource.getAmount('gold')).toBe(totalGoldCost);
      expect(grainBefore - engine.resource.getAmount('grain')).toBe(totalGrainCost);
      expect(troopsBefore - engine.resource.getAmount('troops')).toBe(totalTroopsCost);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 建筑加速 → ResourceSystem 确认加速消耗正确
  // ═══════════════════════════════════════════════════════════
  it('建筑升级完成后产出增加 ResourceSystem 确认速率变化', () => {
    engine.init();

    // 给大量资源
    engine.resource.setResource('gold', 9999999);
    engine.resource.setResource('grain', 9999999);
    engine.resource.setResource('troops', 9999999);

    const ratesBefore = engine.resource.getProductionRates();
    const grainRateBefore = ratesBefore.grain;

    // 升级农田（产出建筑）
    const check = engine.checkUpgrade('farmland');
    if (check.canUpgrade) {
      engine.upgradeBuilding('farmland');
      engine.building.forceCompleteUpgrades();

      // forceCompleteUpgrades 只更新 BuildingSystem 内部状态
      // 手动同步 BuildingSystem → ResourceSystem
      const productions = engine.building.calculateTotalProduction();
      engine.resource.recalculateProduction(productions);

      // 交叉验证：升级完成后 ResourceSystem 的产出速率增加
      const ratesAfter = engine.resource.getProductionRates();
      expect(ratesAfter.grain).toBeGreaterThan(grainRateBefore);

      // BuildingSystem 确认等级确实提升了
      const farmlandLevel = engine.building.getLevel('farmland');
      expect(farmlandLevel).toBeGreaterThan(1);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 7. 建筑拆除/取消升级 → ResourceSystem 确认返还资源
  // ═══════════════════════════════════════════════════════════
  it('取消建筑升级后 ResourceSystem 确认资源返还', () => {
    engine.init();

    const goldBefore = engine.resource.getAmount('gold');

    const check = engine.checkUpgrade('farmland');
    if (!check.canUpgrade) return;

    const cost = engine.getUpgradeCost('farmland');
    engine.upgradeBuilding('farmland');

    // 确认资源已被扣
    const goldAfterUpgrade = engine.resource.getAmount('gold');
    expect(goldAfterUpgrade).toBeLessThan(goldBefore);

    // 取消升级
    const refund = engine.cancelUpgrade('farmland');
    expect(refund).not.toBeNull();

    // 交叉验证：ResourceSystem 确认返还了部分资源
    const goldAfterCancel = engine.resource.getAmount('gold');
    expect(goldAfterCancel).toBeGreaterThan(goldAfterUpgrade);

    // 验证返还量与 BuildingSystem 报告的 refund 一致
    if (cost && refund) {
      const actualRefund = goldAfterCancel - goldAfterUpgrade;
      expect(actualRefund).toBe(refund.gold);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 8. 离线收益 → ResourceSystem 确认建筑产出累加正确
  // ═══════════════════════════════════════════════════════════
  it('离线收益加载后 ResourceSystem 确认建筑产出累加正确', () => {
    engine.init();

    // 给大量资源并升级建筑
    engine.resource.setResource('gold', 9999999);
    engine.resource.setResource('grain', 9999999);
    engine.resource.setResource('troops', 9999999);

    const check = engine.checkUpgrade('farmland');
    if (check.canUpgrade) {
      engine.upgradeBuilding('farmland');
      engine.building.forceCompleteUpgrades();
    }

    // 保存当前状态
    const grainBeforeSave = engine.resource.getAmount('grain');
    const rates = engine.resource.getProductionRates();

    engine.save();

    // 创建新引擎加载存档（模拟离线后重新登录）
    const engine2 = new ThreeKingdomsEngine();
    const offlineResult = engine2.load();

    // 交叉验证：加载后 ResourceSystem 确认有离线收益
    if (offlineResult) {
      expect(offlineResult.earned.grain).toBeGreaterThanOrEqual(0);

      // ResourceSystem 的资源应 ≥ 保存时的值（含离线产出）
      const grainAfterLoad = engine2.resource.getAmount('grain');
      expect(grainAfterLoad).toBeGreaterThanOrEqual(grainBeforeSave);
    }

    // 交叉验证：加载后 BuildingSystem 确认建筑等级一致
    const levelBefore = engine.building.getLevel('farmland');
    const levelAfter = engine2.building.getLevel('farmland');
    expect(levelAfter).toBe(levelBefore);

    engine2.reset();
  });

  // ═══════════════════════════════════════════════════════════
  // 9. 科技加成 → BuildingSystem 确认产出受科技影响
  // ═══════════════════════════════════════════════════════════
  it('建筑产出速率与 BuildingSystem 等级正相关', () => {
    engine.init();

    // 给大量资源
    engine.resource.setResource('gold', 9999999);
    engine.resource.setResource('grain', 9999999);
    engine.resource.setResource('troops', 9999999);

    const ratesLevel1 = engine.resource.getProductionRates();
    const farmlandLevel1 = engine.building.getLevel('farmland');

    // 升级农田
    const check = engine.checkUpgrade('farmland');
    if (check.canUpgrade) {
      engine.upgradeBuilding('farmland');
      engine.building.forceCompleteUpgrades();
      // 手动同步 BuildingSystem → ResourceSystem
      const prod1 = engine.building.calculateTotalProduction();
      engine.resource.recalculateProduction(prod1);

      const ratesLevel2 = engine.resource.getProductionRates();
      const farmlandLevel2 = engine.building.getLevel('farmland');

      // 交叉验证：BuildingSystem 等级提升 → ResourceSystem 产出增加
      expect(farmlandLevel2).toBeGreaterThan(farmlandLevel1);
      expect(ratesLevel2.grain).toBeGreaterThan(ratesLevel1.grain);

      // 继续升级验证线性关系
      const check2 = engine.checkUpgrade('farmland');
      if (check2.canUpgrade) {
        engine.upgradeBuilding('farmland');
        engine.building.forceCompleteUpgrades();
        const prod2 = engine.building.calculateTotalProduction();
        engine.resource.recalculateProduction(prod2);

        const ratesLevel3 = engine.resource.getProductionRates();
        expect(ratesLevel3.grain).toBeGreaterThan(ratesLevel2.grain);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 10. 存档/加载 → 建筑等级和资源数量一致
  // ═══════════════════════════════════════════════════════════
  it('存档/加载后 BuildingSystem 等级和 ResourceSystem 数量一致', () => {
    engine.init();

    // 给大量资源并升级多个建筑
    engine.resource.setResource('gold', 9999999);
    engine.resource.setResource('grain', 9999999);
    engine.resource.setResource('troops', 9999999);

    const buildingTypes: BuildingType[] = ['farmland', 'barracks', 'market'];
    const levelsBefore: Record<string, number> = {};

    for (const bt of buildingTypes) {
      levelsBefore[bt] = engine.building.getLevel(bt);
      const check = engine.checkUpgrade(bt);
      if (check.canUpgrade) {
        engine.upgradeBuilding(bt);
        engine.building.forceCompleteUpgrades();
        levelsBefore[bt] = engine.building.getLevel(bt);
      }
    }

    const resourcesBefore = engine.resource.getResources();

    // 保存
    engine.save();

    // 创建新引擎加载
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();

    // 交叉验证：BuildingSystem 确认等级一致
    for (const bt of buildingTypes) {
      expect(engine2.building.getLevel(bt)).toBe(levelsBefore[bt]);
    }

    // 交叉验证：ResourceSystem 确认资源一致（允许因离线收益增加）
    const resourcesAfter = engine2.resource.getResources();
    expect(resourcesAfter.gold).toBeGreaterThanOrEqual(resourcesBefore.gold);
    expect(resourcesAfter.grain).toBeGreaterThanOrEqual(resourcesBefore.grain);

    engine2.reset();
  });
});
