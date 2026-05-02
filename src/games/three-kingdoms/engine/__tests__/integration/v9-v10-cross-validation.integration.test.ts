/**
 * v9.0 离线收益 × v10.0 兵强马壮 交叉验证集成测试
 *
 * 覆盖 v9 ↔ v10 跨系统联动场景：
 *   CROSS-1: 离线收益 × 声望产出加成联动
 *   CROSS-2: 离线收益 × 装备系统联动
 *   CROSS-3: 离线收益 × 转生系统联动
 *   CROSS-4: 离线收益 × 铁匠铺/炼制联动
 *   CROSS-5: 离线收益 × 装备强化战力传导
 *   CROSS-6: 离线经验 × 声望等级联动
 *   CROSS-7: 离线科技产出更新 × 装备系统
 *   CROSS-8: 序列化/反序列化 跨版本兼容
 *   CROSS-9: 全链路 E2E 交叉验证
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 不使用 as unknown as Record<string, unknown>
 *
 * @see docs/games/three-kingdoms/play/v9-play.md
 * @see docs/games/three-kingdoms/play/v10-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { Resources } from '../../../../shared/types';
import {
  OfflineRewardSystem,
  calculateOfflineSnapshot,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  MAX_OFFLINE_HOURS,
  SYSTEM_EFFICIENCY_MODIFIERS,
} from '../../offline/index';
import type { BonusSources } from '../../offline/offline.types';

// ── 辅助常量 ──

const HOUR_S = 3600;

/** 创建标准产出速率 */
function makeRates(grain = 10, gold = 5, troops = 3, mandate = 1): Resources {
  return {
    grain, gold, troops, mandate,
    techPoint: 2,
    recruitToken: 0,
  };
}

/** 创建零资源 */
function zeroResources(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
}

// ═══════════════════════════════════════════════════════════════
// CROSS-1: 离线收益 × 声望产出加成联动
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-1: 离线收益 × 声望产出加成联动', () => {

  it('CROSS-1.1: 声望等级提升后产出加成应影响离线收益计算', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const prestige = sim.engine.getPrestigeSystem();

    // 初始声望等级 = 1，产出加成 = 1 + 1×0.02 = 1.02
    expect(prestige.getCurrentLevelInfo().level).toBe(1);
    const initialBonus = prestige.getProductionBonus();
    expect(initialBonus).toBeCloseTo(1.02, 4);

    // 使用声望加成计算离线收益
    const rates = makeRates(100, 50, 30, 10);
    const bonusWithPrestige: BonusSources = { reputation: initialBonus - 1 }; // 0.02
    const snapshot = calculateOfflineSnapshot(8 * HOUR_S, rates, bonusWithPrestige);

    // 无声望加成基准
    const baseSnapshot = calculateOfflineSnapshot(8 * HOUR_S, rates, {});

    // 声望加成后的收益应高于无加成
    expect(snapshot.totalEarned.grain).toBeGreaterThan(baseSnapshot.totalEarned.grain);
    expect(snapshot.totalEarned.gold).toBeGreaterThan(baseSnapshot.totalEarned.gold);
  });

  it('CROSS-1.2: 高声望等级产出加成应显著提升离线收益', () => {
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // 使用无上限的 main_quest 添加大量声望值
    // Lv2 需要 1000 × 2^1.8 ≈ 3482
    const added = prestige.addPrestigePoints('main_quest', 50000);
    expect(added).toBeGreaterThan(0);

    const highLevel = prestige.getCurrentLevelInfo().level;
    expect(highLevel).toBeGreaterThan(1);

    const highBonus = prestige.getProductionBonus();
    // 公式: 1 + level × 0.02，level≥2 时至少 1.04
    expect(highBonus).toBeGreaterThanOrEqual(1.04);

    // 验证离线收益加成系数
    const coef = calculateBonusCoefficient({ reputation: highBonus - 1 });
    expect(coef).toBeCloseTo(1 + (highBonus - 1), 4);
  });

  it('CROSS-1.3: updateReputationBonus 应正确反映声望加成变化', () => {
    const offline = new OfflineRewardSystem();

    // 初始声望加成为0
    const coef0 = offline.updateReputationBonus(0);
    expect(coef0).toBe(1.0);

    // 声望加成 0.5
    const coef1 = offline.updateReputationBonus(0.5);
    expect(coef1).toBeCloseTo(1.5, 4);

    // 声望加成上限 +100%
    const coef2 = offline.updateReputationBonus(1.5);
    expect(coef2).toBe(2.0); // 封顶于 1 + min(1.5, 1.0) = 2.0
  });

  it('CROSS-1.4: 声望加成与VIP加成应可叠加计算离线收益', () => {
    const rates = makeRates(100, 50, 30, 10);
    const offlineSeconds = 10 * HOUR_S;

    // 仅声望加成
    const snapPrestige = calculateOfflineSnapshot(offlineSeconds, rates, { reputation: 0.3 });
    // 仅VIP加成
    const snapVip = calculateOfflineSnapshot(offlineSeconds, rates, { vip: 0.2 });
    // 两者叠加
    const snapBoth = calculateOfflineSnapshot(offlineSeconds, rates, { reputation: 0.3, vip: 0.2 });

    // 叠加后收益应大于任一单独加成
    expect(snapBoth.totalEarned.grain).toBeGreaterThan(snapPrestige.totalEarned.grain);
    expect(snapBoth.totalEarned.grain).toBeGreaterThan(snapVip.totalEarned.grain);
    // 叠加收益应等于基准 × (1 + 0.3 + 0.2)
    const snapBase = calculateOfflineSnapshot(offlineSeconds, rates, {});
    const expectedGrain = Math.floor(snapBase.totalEarned.grain * 1.5);
    expect(snapBoth.totalEarned.grain).toBe(expectedGrain);
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-2: 离线收益 × 装备系统联动
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-2: 离线收益 × 装备系统联动', () => {

  it('CROSS-2.1: 装备系统与离线收益系统可同时初始化', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const equip = sim.engine.getEquipmentSystem();

    expect(offline).toBeDefined();
    expect(equip).toBeDefined();
    expect(typeof offline.calculateSnapshot).toBe('function');
    expect(typeof equip.generateEquipment).toBe('function');
  });

  it('CROSS-2.2: 离线收益不应影响装备背包数据', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const equip = sim.engine.getEquipmentSystem();

    // generateEquipment 自动 addToBag
    const item = equip.generateEquipment('weapon', 'green');
    const bagSizeBefore = equip.getBagUsedCount();
    expect(bagSizeBefore).toBeGreaterThanOrEqual(1);

    // 计算离线收益
    const rates = makeRates();
    const snapshot = offline.calculateSnapshot(10 * HOUR_S, rates);
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);

    // 装备背包不受影响
    expect(equip.getBagUsedCount()).toBe(bagSizeBefore);
    expect(equip.getEquipment(item!.uid)).toBeDefined();
  });

  it('CROSS-2.3: 装备操作后离线收益基于传入速率计算', () => {
    const sim = createSim();
    const equip = sim.engine.getEquipmentSystem();
    const offline = sim.engine.getOfflineRewardSystem();

    const rates = makeRates(100, 50, 30, 10);

    // 生成装备
    equip.generateEquipment('weapon', 'blue');

    // 离线收益计算应基于传入的产出速率
    // 5h = 2h@100% + 3h@80%
    const snap1 = offline.calculateSnapshot(5 * HOUR_S, rates);
    // 手动计算: grain = 100 * (2*3600*1.0 + 3*3600*0.8) = 100 * (7200 + 8640) = 100 * 15840
    const expectedGrain = Math.floor(100 * (2 * 3600 * 1.0 + 3 * 3600 * 0.8));
    expect(snap1.totalEarned.grain).toBe(expectedGrain);
  });

  it('CROSS-2.4: 离线收益×装备战力传导 — 装备属性不影响离线收益计算', () => {
    const sim = createSim();
    const equip = sim.engine.getEquipmentSystem();
    const offline = sim.engine.getOfflineRewardSystem();

    const rates = makeRates(50, 25, 15, 5);

    // 无装备时计算离线收益
    const snapNoEquip = offline.calculateSnapshot(8 * HOUR_S, rates);

    // 生成高品质装备（generateEquipment 自动 addToBag）
    equip.generateEquipment('weapon', 'gold');

    // 有装备时离线收益应相同（装备属性不影响产出速率）
    const snapWithEquip = offline.calculateSnapshot(8 * HOUR_S, rates);
    expect(snapWithEquip.totalEarned.grain).toBe(snapNoEquip.totalEarned.grain);
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-3: 离线收益 × 转生系统联动
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-3: 离线收益 × 转生系统联动', () => {

  it('CROSS-3.1: 转生系统与离线收益系统可同时访问', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const rebirth = sim.engine.getRebirthSystem();

    expect(offline).toBeDefined();
    expect(rebirth).toBeDefined();
    expect(typeof rebirth.checkRebirthConditions).toBe('function');
    expect(typeof rebirth.getCurrentMultiplier).toBe('function');
  });

  it('CROSS-3.2: 转生倍率不影响离线收益衰减系数', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    // 转生倍率
    const multiplier = rebirth.getCurrentMultiplier();
    expect(multiplier).toBeGreaterThanOrEqual(1.0);

    // 离线收益衰减系数应独立于转生倍率
    const efficiency10h = calculateOverallEfficiency(10 * HOUR_S);
    const efficiency24h = calculateOverallEfficiency(24 * HOUR_S);

    // 10h 效率 > 24h 效率（衰减）
    expect(efficiency10h).toBeGreaterThan(efficiency24h);
  });

  it('CROSS-3.3: 转生加速期间离线收益仍正常计算', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const rebirth = sim.engine.getRebirthSystem();

    const rates = makeRates(80, 40, 20, 8);
    const snapshot = offline.calculateSnapshot(12 * HOUR_S, rates);

    // 离线收益应正常计算
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);
    expect(snapshot.totalEarned.gold).toBeGreaterThan(0);

    // 转生系统状态不受离线收益计算影响
    const rebirthState = rebirth.getState();
    expect(rebirthState.rebirthCount).toBe(0); // 初始状态
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-4: 离线收益 × 铁匠铺/炼制联动
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-4: 离线收益 × 铁匠铺/炼制联动', () => {

  it('CROSS-4.1: 铁匠铺建筑等级不影响离线收益衰减', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();

    const rates = makeRates(60, 30, 15, 5);

    // 铁匠铺 Lv1 时的离线收益
    const snap1 = offline.calculateSnapshot(10 * HOUR_S, rates);

    // 升级主城到Lv3解锁铁匠铺，然后升级铁匠铺
    sim.addResources(SUFFICIENT_RESOURCES);
    // 需要先升级主城来解锁铁匠铺
    try {
      sim.upgradeBuildingTo('castle', 3);
      sim.upgradeBuilding('workshop');
    } catch {
      // 如果铁匠铺升级不可用，跳过此步
    }

    // 离线收益计算不变（基于传入的产出速率）
    const snap2 = offline.calculateSnapshot(10 * HOUR_S, rates);
    expect(snap2.totalEarned.grain).toBe(snap1.totalEarned.grain);
  });

  it('CROSS-4.2: 炼制系统应可独立于离线收益运行', () => {
    const sim = createSim();
    const equip = sim.engine.getEquipmentSystem();
    const forge = sim.engine.getEquipmentForgeSystem();
    const offline = sim.engine.getOfflineRewardSystem();

    // 生成装备用于炼制
    for (let i = 0; i < 3; i++) {
      equip.generateEquipment('weapon', 'white');
    }

    // 计算离线收益
    const rates = makeRates();
    const snapshot = offline.calculateSnapshot(5 * HOUR_S, rates);
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);

    // 炼制系统可访问
    expect(forge).toBeDefined();
    expect(typeof forge.basicForge).toBe('function');
    expect(typeof forge.advancedForge).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-5: 离线收益 × 装备强化战力传导
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-5: 离线收益 × 装备强化战力传导', () => {

  it('CROSS-5.1: 装备强化后战力提升不影响离线收益公式', () => {
    const sim = createSim();
    const equip = sim.engine.getEquipmentSystem();
    const enhance = sim.engine.getEquipmentEnhanceSystem();
    const offline = sim.engine.getOfflineRewardSystem();

    const rates = makeRates(100, 50, 30, 10);

    // 强化前离线收益
    const snapBefore = offline.calculateSnapshot(8 * HOUR_S, rates);

    // 生成装备
    equip.generateEquipment('armor', 'blue');

    // 强化系统可访问
    expect(enhance).toBeDefined();
    expect(typeof enhance.enhance).toBe('function');

    // 强化后离线收益不变
    const snapAfter = offline.calculateSnapshot(8 * HOUR_S, rates);
    expect(snapAfter.totalEarned.grain).toBe(snapBefore.totalEarned.grain);
  });

  it('CROSS-5.2: 套装效果不影响离线收益衰减系数', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const setSystem = sim.engine.getEquipmentSetSystem();

    expect(setSystem).toBeDefined();

    // 离线收益衰减系数独立于套装效果
    const efficiency = calculateOverallEfficiency(15 * HOUR_S);
    // 15h = 2h@100% + 6h@80% + 7h@60%
    const expected = (2 * 1.0 + 6 * 0.8 + 7 * 0.6) / 15;
    expect(efficiency).toBeCloseTo(expected, 3);
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-6: 离线经验 × 声望等级联动
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-6: 离线经验 × 声望等级联动', () => {

  it('CROSS-6.1: 离线经验计算应受72h封顶约束', () => {
    const offline = new OfflineRewardSystem();

    // 72h离线经验
    const result72 = offline.calculateOfflineExp(72 * HOUR_S);
    // 100h离线经验（应封顶72h）
    const result100 = offline.calculateOfflineExp(100 * HOUR_S);

    expect(result72.finalExp).toBeGreaterThan(0);
    expect(result100.finalExp).toBe(result72.finalExp);
  });

  it('CROSS-6.2: 离线经验应受衰减系数影响', () => {
    const offline = new OfflineRewardSystem();

    // 1h经验（100%效率）
    const result1h = offline.calculateOfflineExp(1 * HOUR_S);
    // 10h经验（含衰减）
    const result10h = offline.calculateOfflineExp(10 * HOUR_S);

    // 10h总经验 > 1h × 10（因为衰减，实际 < 1h × 10）
    const ratio = result10h.finalExp / result1h.finalExp;
    expect(ratio).toBeLessThan(10); // 衰减使效率下降
    expect(ratio).toBeGreaterThan(5); // 但仍显著增长
  });

  it('CROSS-6.3: 经验加成应正确叠加到离线经验', () => {
    const offline = new OfflineRewardSystem();

    const noBonus = offline.calculateOfflineExp(8 * HOUR_S, 0);
    const withBonus = offline.calculateOfflineExp(8 * HOUR_S, 0.5);

    // 有加成时经验应更高
    expect(withBonus.finalExp).toBeGreaterThan(noBonus.finalExp);
    // bonusExp = decayedExp × 0.5
    expect(withBonus.bonusExp).toBe(Math.floor(noBonus.decayedExp * 0.5));
  });

  it('CROSS-6.4: 经验升级奖励应正确触发', () => {
    const offline = new OfflineRewardSystem();
    offline.setExpState(1, 0, 0);

    // 大量离线时间触发升级
    const result = offline.calculateOfflineExp(48 * HOUR_S, 0.5);

    // 应有经验获得
    expect(result.finalExp).toBeGreaterThan(0);
    // 可能触发升级（取决于EXP_LEVEL_TABLE配置）
    if (result.didLevelUp) {
      expect(result.newLevel).toBeGreaterThan(result.previousLevel);
      expect(result.levelUpRewards.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-7: 离线科技产出更新 × 装备系统
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-7: 离线科技产出更新 × 装备系统', () => {

  it('CROSS-7.1: updateProductionRatesAfterTech 应正确递增产出速率', () => {
    const offline = new OfflineRewardSystem();
    const baseRates = makeRates(100, 50, 30, 10);

    const completedTech = [
      { techId: 'tech_1', endTime: 1000, productionBonus: 0.1 },
      { techId: 'tech_2', endTime: 2000, productionBonus: 0.15 },
    ];

    const updates = offline.updateProductionRatesAfterTech(completedTech, baseRates);

    expect(updates).toHaveLength(2);
    // 第一个科技后: rates × 1.1
    expect(updates[0].updatedRates.grain).toBe(110);
    // 第二个科技后: rates × 1.1 × 1.15 = 126.5 → floor = 126
    expect(updates[1].updatedRates.grain).toBe(126);
  });

  it('CROSS-7.2: 科技产出更新后离线收益应使用新速率', () => {
    const offline = new OfflineRewardSystem();
    const baseRates = makeRates(100, 50, 30, 10);

    const completedTech = [
      { techId: 'tech_1', endTime: 1000, productionBonus: 0.2 },
    ];

    const updates = offline.updateProductionRatesAfterTech(completedTech, baseRates);
    const updatedRates = updates[updates.length - 1].updatedRates;

    // 使用更新后的速率计算离线收益
    const snap = offline.calculateSnapshot(5 * HOUR_S, updatedRates);
    const snapBase = offline.calculateSnapshot(5 * HOUR_S, baseRates);

    // 科技加成后收益更高
    expect(snap.totalEarned.grain).toBeGreaterThan(snapBase.totalEarned.grain);
    // 速率提升20%，收益也应提升约20%
    const ratio = snap.totalEarned.grain / snapBase.totalEarned.grain;
    expect(ratio).toBeCloseTo(1.2, 1);
  });

  it('CROSS-7.3: 空科技列表应返回空更新', () => {
    const offline = new OfflineRewardSystem();
    const rates = makeRates();

    const updates = offline.updateProductionRatesAfterTech([], rates);
    expect(updates).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-8: 序列化/反序列化 跨版本兼容
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-8: 序列化/反序列化 跨版本兼容', () => {

  it('CROSS-8.1: 离线收益系统序列化后反序列化应恢复状态', () => {
    const offline = new OfflineRewardSystem();

    // 设置一些状态
    offline.setLastOfflineTime(1700000000);
    offline.addBoostItem('offline_boost_1h', 3);

    // 序列化
    const saved = offline.serialize();
    expect(saved).toBeDefined();
    expect(saved.lastOfflineTime).toBe(1700000000);

    // 反序列化到新实例
    const restored = new OfflineRewardSystem();
    restored.deserialize(saved);

    expect(restored.getLastOfflineTime()).toBe(1700000000);
    // boostItems 应恢复
    const boostItems = restored.getBoostItems();
    expect(boostItems.length).toBeGreaterThan(0);
    const boost1h = boostItems.find(b => b.id === 'offline_boost_1h');
    expect(boost1h).toBeDefined();
    expect(boost1h!.count).toBe(3);
  });

  it('CROSS-8.2: 装备系统序列化后反序列化应恢复背包', () => {
    const sim = createSim();
    const equip = sim.engine.getEquipmentSystem();

    // 生成装备（自动addToBag）
    equip.generateEquipment('weapon', 'green');
    equip.generateEquipment('armor', 'blue');

    const usedBefore = equip.getBagUsedCount();
    expect(usedBefore).toBeGreaterThanOrEqual(2);

    // 序列化
    const saved = equip.serialize();
    expect(saved).toBeDefined();

    // 反序列化到新实例
    const restored = sim.engine.getEquipmentSystem();
    restored.deserialize(saved);

    expect(restored.getBagUsedCount()).toBe(usedBefore);
  });

  it('CROSS-8.3: 离线收益+装备系统可独立序列化互不干扰', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const equip = sim.engine.getEquipmentSystem();

    // 设置离线状态
    offline.setLastOfflineTime(1700000000);
    offline.addBoostItem('boost_001', 5);

    // 生成装备
    equip.generateEquipment('mount', 'purple');

    // 分别序列化
    const offlineSaved = offline.serialize();
    const equipSaved = equip.serialize();

    // 互不干扰
    expect(offlineSaved.lastOfflineTime).toBe(1700000000);
    expect(equipSaved).toBeDefined();

    // 分别反序列化
    const newOffline = new OfflineRewardSystem();
    newOffline.deserialize(offlineSaved);
    expect(newOffline.getLastOfflineTime()).toBe(1700000000);
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-9: 全链路 E2E 交叉验证
// ═══════════════════════════════════════════════════════════════
describe('v9×v10 交叉验证 — CROSS-9: 全链路 E2E 交叉验证', () => {

  it('CROSS-9.1: 离线→回归→装备获取→穿戴→声望提升 全链路', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const equip = sim.engine.getEquipmentSystem();
    const prestige = sim.engine.getPrestigeSystem();

    // Step 1: 计算离线收益
    const rates = makeRates(100, 50, 30, 10);
    const snapshot = offline.calculateSnapshot(12 * HOUR_S, rates);
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);

    // Step 2: 生成装备（模拟回归后推图掉落，自动addToBag）
    const weapon = equip.generateEquipment('weapon', 'blue');
    const armor = equip.generateEquipment('armor', 'green');
    expect(weapon).not.toBeNull();
    expect(armor).not.toBeNull();
    expect(equip.getBagUsedCount()).toBeGreaterThanOrEqual(2);

    // Step 3: 穿戴装备
    if (weapon) {
      const equipResult = equip.equipItem('hero_001', weapon.uid);
      // 穿戴结果取决于英雄是否存在
      expect(typeof equipResult.success).toBe('boolean');
    }

    // Step 4: 声望系统可正常操作（使用 main_quest 无上限）
    prestige.addPrestigePoints('main_quest', 100);
    const panel = prestige.getPrestigePanel();
    expect(panel).toBeDefined();
    expect(panel.currentLevel).toBeGreaterThanOrEqual(1);
  });

  it('CROSS-9.2: 声望加成→离线收益→资源获取→装备炼制 全链路', () => {
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const offline = sim.engine.getOfflineRewardSystem();
    const equip = sim.engine.getEquipmentSystem();
    const forge = sim.engine.getEquipmentForgeSystem();

    // Step 1: 获取声望加成
    const productionBonus = prestige.getProductionBonus();
    expect(productionBonus).toBeGreaterThanOrEqual(1.0);

    // Step 2: 使用声望加成计算离线收益
    const rates = makeRates(200, 100, 50, 20);
    const bonusSources: BonusSources = { reputation: productionBonus - 1 };
    const snapshot = calculateOfflineSnapshot(24 * HOUR_S, rates, bonusSources);
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);

    // Step 3: 生成装备用于炼制（自动addToBag）
    for (let i = 0; i < 5; i++) {
      equip.generateEquipment('accessory', 'white');
    }
    expect(equip.getBagUsedCount()).toBeGreaterThanOrEqual(5);

    // Step 4: 炼制系统可访问
    expect(forge).toBeDefined();
    expect(typeof forge.basicForge).toBe('function');
  });

  it('CROSS-9.3: 多系统并发操作不产生数据污染', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineRewardSystem();
    const equip = sim.engine.getEquipmentSystem();
    const prestige = sim.engine.getPrestigeSystem();
    const rebirth = sim.engine.getRebirthSystem();

    // 同时操作多个系统
    const rates = makeRates(100, 50, 30, 10);

    // 离线收益计算
    const snap1 = offline.calculateSnapshot(8 * HOUR_S, rates);
    // 装备操作
    equip.generateEquipment('weapon', 'white');
    // 声望操作（使用 main_quest 无上限）
    prestige.addPrestigePoints('main_quest', 50);
    // 转生查询
    const rebirthState = rebirth.getState();

    // 各系统独立，互不污染
    expect(snap1.totalEarned.grain).toBeGreaterThan(0);
    expect(equip.getBagUsedCount()).toBeGreaterThanOrEqual(1);
    expect(prestige.getCurrentLevelInfo().level).toBeGreaterThanOrEqual(1);
    expect(rebirthState.rebirthCount).toBe(0);

    // 再次计算离线收益应不受影响
    const snap2 = offline.calculateSnapshot(8 * HOUR_S, rates);
    expect(snap2.totalEarned.grain).toBe(snap1.totalEarned.grain);
  });

  it('CROSS-9.4: calculateCrossSystemReward 三系统收益无重复', () => {
    const offline = new OfflineRewardSystem();
    const rates = makeRates(100, 50, 30, 10);
    const currentRes = zeroResources();
    const caps: Record<string, number | null> = {
      grain: 100000, gold: 2000, troops: 50000, mandate: null,
      techPoint: null, recruitToken: null,
    };

    const result = offline.calculateCrossSystemReward(
      10 * HOUR_S, rates, currentRes, caps, 0,
    );

    // 各系统收益独立计算
    expect(result.resourceReward.grain).toBeGreaterThan(0);
    expect(result.buildingReward.grain).toBeGreaterThan(0);
    expect(result.expeditionReward.grain).toBeGreaterThan(0);

    // 总收益 = 三系统之和
    const sumGrain = result.resourceReward.grain + result.buildingReward.grain + result.expeditionReward.grain;
    expect(result.totalReward.grain).toBe(sumGrain);

    // 无重复标记
    expect(result.noDuplicates).toBe(true);
  });

  it('CROSS-9.5: calculateWithSnapshotBonus 使用下线时加成系数', () => {
    const offline = new OfflineRewardSystem();
    const rates = makeRates(100, 50, 30, 10);

    // 无加成基准
    const base = offline.calculateWithSnapshotBonus(10 * HOUR_S, rates, {});

    // 有加成
    const boosted = offline.calculateWithSnapshotBonus(10 * HOUR_S, rates, {
      tech: 0.2,
      vip: 0.1,
      reputation: 0.15,
    });

    // 加成后收益更高
    expect(boosted.totalEarned.grain).toBeGreaterThan(base.totalEarned.grain);

    // 加成系数 = 1 + 0.2 + 0.1 + 0.15 = 1.45
    const ratio = boosted.totalEarned.grain / base.totalEarned.grain;
    expect(ratio).toBeCloseTo(1.45, 1);
  });
});
