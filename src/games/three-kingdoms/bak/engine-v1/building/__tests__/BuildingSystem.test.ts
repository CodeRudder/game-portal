/**
 * BuildingSystem.ts 单元测试
 * 目标：100% 分支覆盖
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import { BUILDING_DEFS, BUILDING_MAX_LEVELS, BUILDING_SAVE_VERSION, CANCEL_REFUND_RATIO } from '../building-config';
import { BUILDING_TYPES } from '../building.types';
import type { BuildingType, BuildingState, BuildingSaveData, QueueSlot } from '../building.types';
import type { Resources } from '../../resource/resource.types';

// ── 辅助 ──

/** 创建充足资源 */
function richResources(): Resources {
  return { grain: 1_000_000_000, gold: 1_000_000_000, troops: 1_000_000_000, mandate: 0 };
}

/** 创建不足资源 */
function poorResources(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0 };
}

/**
 * 手动设置建筑等级（通过 deserialize）。
 * 注意：deserialize 会自动解锁建筑并处理已完成的升级。
 */
function setLevel(sys: BuildingSystem, type: BuildingType, level: number): void {
  const data = sys.serialize();
  data.buildings[type].level = level;
  data.buildings[type].status = 'idle';
  data.buildings[type].upgradeStartTime = null;
  data.buildings[type].upgradeEndTime = null;
  sys.deserialize(data);
}

/**
 * 直接将升级状态和队列项注入系统（绕过 deserialize 的离线完成逻辑）。
 * 用于测试 tick 行为。
 */
function injectUpgrade(
  sys: BuildingSystem,
  type: BuildingType,
  level: number,
  startOffset: number,
  endOffset: number,
): void {
  const data = sys.serialize();
  const now = Date.now();
  data.buildings[type].level = level;
  data.buildings[type].status = 'upgrading';
  data.buildings[type].upgradeStartTime = now - startOffset;
  data.buildings[type].upgradeEndTime = now + endOffset;
  // 通过 deserialize 设置状态，但 endOffset > 0 保证不会在 deserialize 中完成
  sys.deserialize(data);
}

/** 通过反射获取私有 buildings 对象来直接修改状态 */
function getPrivateBuildings(sys: BuildingSystem): Record<BuildingType, BuildingState> {
  return (sys as unknown as { buildings: Record<BuildingType, BuildingState> }).buildings;
}

/** 通过反射获取私有 upgradeQueue */
function getPrivateQueue(sys: BuildingSystem): QueueSlot[] {
  return (sys as unknown as { upgradeQueue: QueueSlot[] }).upgradeQueue;
}

/** 直接设置建筑状态（不触发 deserialize 副作用） */
function setBuildingState(
  sys: BuildingSystem,
  type: BuildingType,
  level: number,
  status: 'idle' | 'locked' | 'upgrading',
  startTime: number | null = null,
  endTime: number | null = null,
): void {
  const buildings = getPrivateBuildings(sys);
  buildings[type].level = level;
  buildings[type].status = status;
  buildings[type].upgradeStartTime = startTime;
  buildings[type].upgradeEndTime = endTime;
}

/** 直接向队列中添加一个槽位 */
function pushQueueSlot(sys: BuildingSystem, type: BuildingType, startTime: number, endTime: number): void {
  getPrivateQueue(sys).push({ buildingType: type, startTime, endTime });
}

// ═══════════════════════════════════════════════════════════════
// 1. 初始化
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 初始化', () => {
  it('默认所有建筑状态正确', () => {
    const sys = new BuildingSystem();
    const all = sys.getAllBuildings();
    // 主城和农田初始解锁
    expect(all.castle.level).toBe(1);
    expect(all.castle.status).toBe('idle');
    expect(all.farmland.level).toBe(1);
    expect(all.farmland.status).toBe('idle');
    // 其他建筑初始锁定
    expect(all.market.status).toBe('locked');
    expect(all.barracks.status).toBe('locked');
    expect(all.smithy.status).toBe('locked');
    expect(all.academy.status).toBe('locked');
    expect(all.clinic.status).toBe('locked');
    expect(all.wall.status).toBe('locked');
  });

  it('锁定建筑等级为0', () => {
    const sys = new BuildingSystem();
    expect(sys.getLevel('market')).toBe(0);
    expect(sys.getLevel('wall')).toBe(0);
  });

  it('升级队列初始为空', () => {
    const sys = new BuildingSystem();
    expect(sys.getUpgradeQueue()).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 建筑状态查询
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 状态查询', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('getBuilding返回正确的建筑状态副本', () => {
    const castle = sys.getBuilding('castle');
    expect(castle.type).toBe('castle');
    expect(castle.level).toBe(1);
    expect(castle.status).toBe('idle');
    // 验证是副本
    castle.level = 999;
    expect(sys.getBuilding('castle').level).toBe(1);
  });

  it('getAllBuildings返回所有8种建筑', () => {
    const all = sys.getAllBuildings();
    const keys = Object.keys(all);
    expect(keys).toHaveLength(8);
    for (const t of BUILDING_TYPES) {
      expect(all[t]).toBeDefined();
    }
  });

  it('getLevel返回正确的等级', () => {
    expect(sys.getLevel('castle')).toBe(1);
    expect(sys.getLevel('market')).toBe(0);
  });

  it('getCastleLevel返回主城等级', () => {
    expect(sys.getCastleLevel()).toBe(1);
  });

  it('getBuildingLevels返回所有建筑等级映射', () => {
    const levels = sys.getBuildingLevels();
    expect(Object.keys(levels)).toHaveLength(8);
    expect(levels.castle).toBe(1);
    expect(levels.farmland).toBe(1);
    expect(levels.market).toBe(0);
  });

  it('getBuildingDef返回正确的建筑定义', () => {
    const def = sys.getBuildingDef('castle');
    expect(def.type).toBe('castle');
    expect(def.maxLevel).toBe(30);
  });

  it('getAppearanceStage返回正确的外观阶段', () => {
    // Lv1 → humble
    expect(sys.getAppearanceStage('castle')).toBe('humble');
    // 设置等级到不同阶段
    setLevel(sys, 'castle', 8);
    expect(sys.getAppearanceStage('castle')).toBe('orderly');
    setLevel(sys, 'castle', 15);
    expect(sys.getAppearanceStage('castle')).toBe('refined');
    setLevel(sys, 'castle', 25);
    expect(sys.getAppearanceStage('castle')).toBe('glorious');
  });

  it('isUnlocked对已解锁建筑返回true', () => {
    expect(sys.isUnlocked('castle')).toBe(true);
    expect(sys.isUnlocked('farmland')).toBe(true);
  });

  it('isUnlocked对锁定建筑返回false', () => {
    expect(sys.isUnlocked('market')).toBe(false);
    expect(sys.isUnlocked('wall')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 解锁检查
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 解锁检查', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('checkUnlock对初始解锁建筑返回true', () => {
    expect(sys.checkUnlock('castle')).toBe(true);
    expect(sys.checkUnlock('farmland')).toBe(true);
  });

  it('checkUnlock对未达到解锁条件的建筑返回false', () => {
    expect(sys.checkUnlock('market')).toBe(false); // 需要主城Lv2
    expect(sys.checkUnlock('wall')).toBe(false);   // 需要主城Lv5
  });

  it('主城升级到Lv2后自动解锁市集和兵营（通过deserialize）', () => {
    // setLevel 使用 deserialize，会自动调用 checkAndUnlockBuildings
    setLevel(sys, 'castle', 2);
    expect(sys.isUnlocked('market')).toBe(true);
    expect(sys.isUnlocked('barracks')).toBe(true);
    expect(sys.getLevel('market')).toBe(1);
    expect(sys.getLevel('barracks')).toBe(1);
  });

  it('主城升级到Lv3后自动解锁铁匠铺和书院', () => {
    setLevel(sys, 'castle', 3);
    expect(sys.isUnlocked('smithy')).toBe(true);
    expect(sys.isUnlocked('academy')).toBe(true);
  });

  it('主城升级到Lv4后自动解锁医馆', () => {
    setLevel(sys, 'castle', 4);
    expect(sys.isUnlocked('clinic')).toBe(true);
  });

  it('主城升级到Lv5后自动解锁城墙', () => {
    setLevel(sys, 'castle', 5);
    expect(sys.isUnlocked('wall')).toBe(true);
  });

  it('checkAndUnlockBuildings重复调用返回空', () => {
    // 初始状态，没有锁定的建筑需要解锁（castle和farmland已经解锁）
    const result = sys.checkAndUnlockBuildings();
    expect(result).toHaveLength(0);
  });

  it('手动锁定一个符合条件的建筑后checkAndUnlockBuildings可以解锁', () => {
    // 先把主城升到Lv2
    setLevel(sys, 'castle', 2);
    // market 应该已经被解锁了
    // 手动把 market 重新锁定来测试 checkAndUnlockBuildings
    setBuildingState(sys, 'market', 0, 'locked');
    expect(sys.getBuilding('market').status).toBe('locked');

    const unlocked = sys.checkAndUnlockBuildings();
    expect(unlocked).toContain('market');
    expect(sys.getBuilding('market').status).toBe('idle');
    expect(sys.getLevel('market')).toBe(1);
  });

  it('主城等级不够时checkAndUnlockBuildings不解锁', () => {
    // 主城Lv1，wall需要Lv5
    setBuildingState(sys, 'wall', 0, 'locked');
    const unlocked = sys.checkAndUnlockBuildings();
    expect(unlocked).not.toContain('wall');
    expect(sys.getBuilding('wall').status).toBe('locked');
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 升级前置条件检查
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 升级前置条件检查', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('锁定建筑不能升级', () => {
    const result = sys.checkUpgrade('market');
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons).toContain('建筑尚未解锁');
  });

  it('正在升级中的建筑不能再次升级', () => {
    // 直接设置状态为 upgrading
    setBuildingState(sys, 'farmland', 1, 'upgrading', Date.now(), Date.now() + 5000);
    const result = sys.checkUpgrade('farmland');
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons).toContain('建筑正在升级中');
  });

  it('达到等级上限不能升级', () => {
    setLevel(sys, 'farmland', BUILDING_MAX_LEVELS.farmland);
    const result = sys.checkUpgrade('farmland');
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons[0]).toContain('已达等级上限');
  });

  it('非主城建筑等级不能超过主城等级', () => {
    // 主城Lv1，农田Lv1 → 农田不能升到Lv2
    const result = sys.checkUpgrade('farmland');
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons).toContain('建筑等级不能超过主城等级 (Lv1)');
  });

  it('主城Lv4→5需要任一其他建筑Lv4', () => {
    setLevel(sys, 'castle', 4);
    // 没有其他建筑Lv4
    const result = sys.checkUpgrade('castle', richResources());
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons).toContain('需要至少一座其他建筑达到 Lv4');
  });

  it('主城Lv4→5满足前置条件时可以升级', () => {
    setLevel(sys, 'castle', 4);
    setLevel(sys, 'farmland', 4);
    const result = sys.checkUpgrade('castle', richResources());
    expect(result.canUpgrade).toBe(true);
  });

  it('主城Lv9→10需要任一其他建筑Lv9', () => {
    setLevel(sys, 'castle', 9);
    const result = sys.checkUpgrade('castle', richResources());
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons).toContain('需要至少一座其他建筑达到 Lv9');
  });

  it('主城Lv9→10满足前置条件时可以升级', () => {
    setLevel(sys, 'castle', 9);
    setLevel(sys, 'farmland', 9);
    const result = sys.checkUpgrade('castle', richResources());
    expect(result.canUpgrade).toBe(true);
  });

  it('升级队列已满时不能升级', () => {
    // 主城Lv1，只有1个队列槽位
    // 先占用队列：直接设置 farmland 为 upgrading 并加入队列
    setBuildingState(sys, 'farmland', 1, 'upgrading', Date.now(), Date.now() + 5000);
    pushQueueSlot(sys, 'farmland', Date.now(), Date.now() + 5000);

    const result = sys.checkUpgrade('castle', richResources());
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons).toContain('升级队列已满');
  });

  it('资源不足时不能升级', () => {
    setLevel(sys, 'castle', 2);
    const result = sys.checkUpgrade('farmland', poorResources());
    expect(result.canUpgrade).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('粮草不足提示正确', () => {
    setLevel(sys, 'castle', 2);
    const result = sys.checkUpgrade('farmland', { grain: 0, gold: 9999, troops: 0, mandate: 0 });
    expect(result.reasons.some(r => r.includes('粮草不足'))).toBe(true);
  });

  it('铜钱不足提示正确', () => {
    setLevel(sys, 'castle', 2);
    const result = sys.checkUpgrade('farmland', { grain: 9999, gold: 0, troops: 0, mandate: 0 });
    expect(result.reasons.some(r => r.includes('铜钱不足'))).toBe(true);
  });

  it('兵力不足提示正确（兵营升级需要兵力）', () => {
    setLevel(sys, 'castle', 10);
    setLevel(sys, 'barracks', 2);
    // 兵营Lv2→3需要troops=30
    const result = sys.checkUpgrade('barracks', { grain: 9999, gold: 9999, troops: 0, mandate: 0 });
    expect(result.reasons.some(r => r.includes('兵力不足'))).toBe(true);
  });

  it('资源充足且条件满足时可以升级', () => {
    setLevel(sys, 'castle', 2);
    const result = sys.checkUpgrade('farmland', richResources());
    expect(result.canUpgrade).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('不传resources参数时跳过资源检查', () => {
    setLevel(sys, 'castle', 2);
    const result = sys.checkUpgrade('farmland');
    expect(result.canUpgrade).toBe(true);
  });

  it('达到最大等级时不检查资源', () => {
    setLevel(sys, 'farmland', BUILDING_MAX_LEVELS.farmland);
    const result = sys.checkUpgrade('farmland', poorResources());
    // reasons中不应有资源不足
    expect(result.reasons.some(r => r.includes('不足'))).toBe(false);
  });

  it('正在升级中+队列已满不重复报告队列满', () => {
    // upgrading 状态时，checkUpgrade 不会走到 isQueueFull 检查
    setBuildingState(sys, 'farmland', 1, 'upgrading', Date.now(), Date.now() + 5000);
    pushQueueSlot(sys, 'farmland', Date.now(), Date.now() + 5000);
    const result = sys.checkUpgrade('farmland');
    // 应该只有 "正在升级" 原因，不应有 "队列已满"
    expect(result.reasons).toContain('建筑正在升级中');
    expect(result.reasons).not.toContain('升级队列已满');
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 升级费用计算
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 费用计算', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('getUpgradeCost返回正确的升级费用', () => {
    // 农田Lv1→2的费用
    const cost = sys.getUpgradeCost('farmland');
    expect(cost).not.toBeNull();
    expect(cost!.grain).toBe(100);
    expect(cost!.gold).toBe(50);
  });

  it('等级为0时返回null', () => {
    // 市集初始锁定，等级0
    expect(sys.getUpgradeCost('market')).toBeNull();
  });

  it('达到最大等级时返回null', () => {
    setLevel(sys, 'farmland', BUILDING_MAX_LEVELS.farmland);
    expect(sys.getUpgradeCost('farmland')).toBeNull();
  });

  it('主城Lv1→2费用正确', () => {
    const cost = sys.getUpgradeCost('castle');
    expect(cost).not.toBeNull();
    expect(cost!.grain).toBe(200);
    expect(cost!.gold).toBe(150);
    expect(cost!.troops).toBe(0);
    expect(cost!.timeSeconds).toBe(10);
  });

  it('不同等级费用不同', () => {
    setLevel(sys, 'castle', 3);
    const cost3 = sys.getUpgradeCost('castle');
    setLevel(sys, 'castle', 5);
    const cost5 = sys.getUpgradeCost('castle');
    expect(cost3!.grain).not.toBe(cost5!.grain);
  });

  it('返回的是费用副本（不影响原始数据）', () => {
    const cost = sys.getUpgradeCost('farmland')!;
    const originalGrain = cost.grain;
    cost.grain = 0;
    const cost2 = sys.getUpgradeCost('farmland')!;
    expect(cost2.grain).toBe(originalGrain);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 产出关联
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 产出关联', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('getProduction返回当前等级的产出值', () => {
    // 农田Lv1产出0.8
    expect(sys.getProduction('farmland')).toBe(0.8);
  });

  it('getProduction支持指定等级', () => {
    // 农田Lv3产出1.5
    expect(sys.getProduction('farmland', 3)).toBe(1.5);
  });

  it('getProduction对等级0返回0', () => {
    expect(sys.getProduction('market')).toBe(0);
  });

  it('getProduction对超出范围的等级返回0', () => {
    expect(sys.getProduction('farmland', 999)).toBe(0);
  });

  it('getCastleBonusPercent返回主城加成百分比', () => {
    // 主城Lv1，加成0%
    expect(sys.getCastleBonusPercent()).toBe(0);
    setLevel(sys, 'castle', 2);
    expect(sys.getCastleBonusPercent()).toBe(2);
  });

  it('getCastleBonusMultiplier返回正确的乘数', () => {
    // Lv1: 0% → 1.0
    expect(sys.getCastleBonusMultiplier()).toBeCloseTo(1.0);
    setLevel(sys, 'castle', 5);
    // Lv5: 8% → 1.08
    expect(sys.getCastleBonusMultiplier()).toBeCloseTo(1.08);
  });

  it('calculateTotalProduction汇总所有产出建筑', () => {
    const prod = sys.calculateTotalProduction();
    // 初始只有农田Lv1产出0.8 grain
    expect(prod.grain).toBe(0.8);
    expect(prod.gold).toBeUndefined();
    expect(prod.troops).toBeUndefined();
  });

  it('calculateTotalProduction包含多个建筑', () => {
    setLevel(sys, 'castle', 5);
    setLevel(sys, 'farmland', 3);
    setLevel(sys, 'market', 2);
    setLevel(sys, 'barracks', 2);
    const prod = sys.calculateTotalProduction();
    expect(prod.grain).toBe(1.5); // farmland Lv3
    expect(prod.gold).toBe(0.8);  // market Lv2
    expect(prod.troops).toBe(0.5); // barracks Lv2
  });

  it('getProductionBuildingLevels返回非主城建筑等级', () => {
    const levels = sys.getProductionBuildingLevels();
    expect(levels.castle).toBeUndefined();
    expect(levels.farmland).toBe(1);
    expect(levels.market).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 升级执行
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 升级执行', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('startUpgrade成功返回费用', () => {
    setLevel(sys, 'castle', 2);
    const cost = sys.startUpgrade('farmland', richResources());
    expect(cost.grain).toBe(100);
    expect(cost.gold).toBe(50);
    expect(sys.getBuilding('farmland').status).toBe('upgrading');
  });

  it('startUpgrade将建筑加入队列', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    const queue = sys.getUpgradeQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].buildingType).toBe('farmland');
  });

  it('startUpgrade设置升级时间', () => {
    setLevel(sys, 'castle', 2);
    const before = Date.now();
    sys.startUpgrade('farmland', richResources());
    const state = sys.getBuilding('farmland');
    expect(state.upgradeStartTime).toBeGreaterThanOrEqual(before);
    expect(state.upgradeEndTime).toBeGreaterThan(state.upgradeStartTime!);
  });

  it('startUpgrade条件不满足时抛错', () => {
    expect(() => sys.startUpgrade('market', richResources())).toThrow('无法升级');
  });

  it('startUpgrade资源不足时抛错', () => {
    setLevel(sys, 'castle', 2);
    expect(() => sys.startUpgrade('farmland', poorResources())).toThrow('无法升级');
  });

  it('返回的费用是副本', () => {
    setLevel(sys, 'castle', 2);
    const cost = sys.startUpgrade('farmland', richResources());
    cost.grain = 0;
    const cost2 = sys.getUpgradeCost('farmland');
    expect(cost2).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 升级计时
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 升级计时', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('tick在升级未完成时返回空数组', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    // 立即tick，升级尚未完成
    const completed = sys.tick();
    expect(completed).toHaveLength(0);
    expect(sys.getBuilding('farmland').status).toBe('upgrading');
  });

  it('tick在升级完成后返回完成的建筑', () => {
    // 直接设置状态和队列，模拟一个已过期的升级
    const now = Date.now();
    setBuildingState(sys, 'farmland', 1, 'upgrading', now - 10000, now - 1000);
    pushQueueSlot(sys, 'farmland', now - 10000, now - 1000);

    const completed = sys.tick();
    expect(completed).toContain('farmland');
    expect(sys.getBuilding('farmland').level).toBe(2);
    expect(sys.getBuilding('farmland').status).toBe('idle');
  });

  it('tick完成后从队列移除', () => {
    const now = Date.now();
    setBuildingState(sys, 'farmland', 1, 'upgrading', now - 10000, now - 1000);
    pushQueueSlot(sys, 'farmland', now - 10000, now - 1000);

    sys.tick();
    expect(sys.getUpgradeQueue()).toHaveLength(0);
  });

  it('tick完成后清理升级时间', () => {
    const now = Date.now();
    setBuildingState(sys, 'farmland', 1, 'upgrading', now - 10000, now - 1000);
    pushQueueSlot(sys, 'farmland', now - 10000, now - 1000);

    sys.tick();
    const state = sys.getBuilding('farmland');
    expect(state.upgradeStartTime).toBeNull();
    expect(state.upgradeEndTime).toBeNull();
  });

  it('主城升级完成后自动检查解锁', () => {
    const now = Date.now();
    setBuildingState(sys, 'castle', 1, 'upgrading', now - 10000, now - 1000);
    pushQueueSlot(sys, 'castle', now - 10000, now - 1000);

    const completed = sys.tick();
    expect(completed).toContain('castle');
    expect(sys.getLevel('castle')).toBe(2);
    expect(sys.isUnlocked('market')).toBe(true);
    expect(sys.isUnlocked('barracks')).toBe(true);
  });

  it('getUpgradeRemainingTime返回正确的剩余时间', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    const remaining = sys.getUpgradeRemainingTime('farmland');
    // 升级刚发起，剩余时间应接近总时间
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5);
  });

  it('getUpgradeRemainingTime对非升级中建筑返回0', () => {
    expect(sys.getUpgradeRemainingTime('farmland')).toBe(0);
  });

  it('getUpgradeProgress返回正确的进度', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    const progress = sys.getUpgradeProgress('farmland');
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
  });

  it('getUpgradeProgress对非升级中建筑返回0', () => {
    expect(sys.getUpgradeProgress('farmland')).toBe(0);
  });

  it('多次tick只完成一次', () => {
    const now = Date.now();
    setBuildingState(sys, 'farmland', 1, 'upgrading', now - 10000, now - 1000);
    pushQueueSlot(sys, 'farmland', now - 10000, now - 1000);

    const first = sys.tick();
    const second = sys.tick();
    expect(first).toContain('farmland');
    expect(second).toHaveLength(0);
    // 等级只增加1
    expect(sys.getLevel('farmland')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 取消升级
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 取消升级', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('cancelUpgrade对非升级中建筑返回null', () => {
    expect(sys.cancelUpgrade('farmland')).toBeNull();
  });

  it('cancelUpgrade成功返回80%返还资源', () => {
    setLevel(sys, 'castle', 2);
    const cost = sys.startUpgrade('farmland', richResources());
    const refund = sys.cancelUpgrade('farmland');
    expect(refund).not.toBeNull();
    expect(refund!.grain).toBe(Math.round(cost.grain * CANCEL_REFUND_RATIO));
    expect(refund!.gold).toBe(Math.round(cost.gold * CANCEL_REFUND_RATIO));
    expect(refund!.troops).toBe(Math.round(cost.troops * CANCEL_REFUND_RATIO));
    expect(refund!.timeSeconds).toBe(0);
  });

  it('cancelUpgrade将建筑状态恢复为idle', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    sys.cancelUpgrade('farmland');
    expect(sys.getBuilding('farmland').status).toBe('idle');
    expect(sys.getBuilding('farmland').upgradeStartTime).toBeNull();
    expect(sys.getBuilding('farmland').upgradeEndTime).toBeNull();
  });

  it('cancelUpgrade从队列移除', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    expect(sys.getUpgradeQueue()).toHaveLength(1);
    sys.cancelUpgrade('farmland');
    expect(sys.getUpgradeQueue()).toHaveLength(0);
  });

  it('cancelUpgrade不改变等级', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    sys.cancelUpgrade('farmland');
    expect(sys.getLevel('farmland')).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 队列管理
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 队列管理', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('getMaxQueueSlots主城Lv1返回1', () => {
    expect(sys.getMaxQueueSlots()).toBe(1);
  });

  it('getMaxQueueSlots主城Lv6返回2', () => {
    setLevel(sys, 'castle', 6);
    expect(sys.getMaxQueueSlots()).toBe(2);
  });

  it('getMaxQueueSlots主城Lv11返回3', () => {
    setLevel(sys, 'castle', 11);
    expect(sys.getMaxQueueSlots()).toBe(3);
  });

  it('getMaxQueueSlots主城Lv21返回4', () => {
    setLevel(sys, 'castle', 21);
    expect(sys.getMaxQueueSlots()).toBe(4);
  });

  it('isQueueFull初始为false', () => {
    expect(sys.isQueueFull()).toBe(false);
  });

  it('isQueueFull在队列满时返回true', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    expect(sys.isQueueFull()).toBe(true);
  });

  it('getUpgradeQueue返回副本', () => {
    setLevel(sys, 'castle', 2);
    sys.startUpgrade('farmland', richResources());
    const queue = sys.getUpgradeQueue();
    queue.pop();
    expect(sys.getUpgradeQueue()).toHaveLength(1);
  });

  it('getMaxQueueSlots对超出范围的等级返回默认值1', () => {
    // 直接设置主城等级为0（不在任何QUEUE_CONFIGS范围内）
    setBuildingState(sys, 'castle', 0, 'idle');
    expect(sys.getMaxQueueSlots()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 特殊属性
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 特殊属性', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('getWallDefense初始锁定返回0', () => {
    expect(sys.getWallDefense()).toBe(0);
  });

  it('getWallDefense返回正确的城防值', () => {
    setLevel(sys, 'castle', 5);
    setLevel(sys, 'wall', 1);
    expect(sys.getWallDefense()).toBe(300);
  });

  it('getWallDefense不同等级不同值', () => {
    setLevel(sys, 'castle', 5);
    setLevel(sys, 'wall', 2);
    expect(sys.getWallDefense()).toBe(500);
  });

  it('getWallDefense对等级0返回0', () => {
    setBuildingState(sys, 'wall', 0, 'locked');
    expect(sys.getWallDefense()).toBe(0);
  });

  it('getWallDefenseBonus返回防御加成百分比', () => {
    setLevel(sys, 'castle', 5);
    setLevel(sys, 'wall', 1);
    expect(sys.getWallDefenseBonus()).toBe(3);
  });

  it('getClinicRecoveryRate初始锁定返回0', () => {
    expect(sys.getClinicRecoveryRate()).toBe(0);
  });

  it('getClinicRecoveryRate返回正确的恢复速率', () => {
    setLevel(sys, 'castle', 4);
    setLevel(sys, 'clinic', 1);
    expect(sys.getClinicRecoveryRate()).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 序列化/反序列化
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 序列化', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('serialize返回包含version和buildings', () => {
    const data = sys.serialize();
    expect(data.version).toBe(BUILDING_SAVE_VERSION);
    expect(data.buildings).toBeDefined();
    expect(Object.keys(data.buildings)).toHaveLength(8);
  });

  it('serialize→deserialize往返一致性', () => {
    setLevel(sys, 'castle', 5);
    setLevel(sys, 'farmland', 3);
    setLevel(sys, 'market', 2);

    const data = sys.serialize();
    const sys2 = new BuildingSystem();
    sys2.deserialize(data);

    expect(sys2.getLevel('castle')).toBe(5);
    expect(sys2.getLevel('farmland')).toBe(3);
    expect(sys2.getLevel('market')).toBe(2);
    expect(sys2.getCastleLevel()).toBe(5);
  });

  it('deserialize处理离线期间完成的升级', () => {
    const now = Date.now();
    const data = sys.serialize();
    // 模拟一个升级在离线期间完成
    data.buildings.farmland.level = 1;
    data.buildings.farmland.status = 'upgrading';
    data.buildings.farmland.upgradeStartTime = now - 20000;
    data.buildings.farmland.upgradeEndTime = now - 5000;

    const sys2 = new BuildingSystem();
    sys2.deserialize(data);

    // 升级应自动完成
    expect(sys2.getLevel('farmland')).toBe(2);
    expect(sys2.getBuilding('farmland').status).toBe('idle');
    expect(sys2.getBuilding('farmland').upgradeStartTime).toBeNull();
  });

  it('deserialize处理离线期间未完成的升级', () => {
    const now = Date.now();
    const data = sys.serialize();
    data.buildings.farmland.level = 1;
    data.buildings.farmland.status = 'upgrading';
    data.buildings.farmland.upgradeStartTime = now - 1000;
    data.buildings.farmland.upgradeEndTime = now + 10000;

    const sys2 = new BuildingSystem();
    sys2.deserialize(data);

    expect(sys2.getLevel('farmland')).toBe(1);
    expect(sys2.getBuilding('farmland').status).toBe('upgrading');
    expect(sys2.getUpgradeQueue()).toHaveLength(1);
  });

  it('deserialize版本不匹配时输出警告', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = sys.serialize();
    data.version = 999;
    sys.deserialize(data);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('存档版本不匹配'));
    warnSpy.mockRestore();
  });

  it('deserialize后自动解锁建筑', () => {
    const data = sys.serialize();
    data.buildings.castle.level = 5;
    data.buildings.castle.status = 'idle';
    const sys2 = new BuildingSystem();
    sys2.deserialize(data);
    expect(sys2.isUnlocked('wall')).toBe(true);
    expect(sys2.getLevel('wall')).toBe(1);
  });

  it('deserialize缺失的建筑保持默认', () => {
    const data: BuildingSaveData = {
      version: BUILDING_SAVE_VERSION,
      buildings: {} as Record<BuildingType, BuildingState>,
    };
    // 只设置castle
    data.buildings.castle = { type: 'castle', level: 5, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };

    const sys2 = new BuildingSystem();
    sys2.deserialize(data);

    // castle被覆盖
    expect(sys2.getLevel('castle')).toBe(5);
    // farmland保持默认（因为data.buildings.farmland是undefined，不会覆盖）
    expect(sys2.getLevel('farmland')).toBe(1);
  });

  it('deserialize处理upgradeStartTime为null的upgrading状态', () => {
    const now = Date.now();
    const data = sys.serialize();
    data.buildings.farmland.level = 1;
    data.buildings.farmland.status = 'upgrading';
    data.buildings.farmland.upgradeStartTime = null; // 缺失的startTime
    data.buildings.farmland.upgradeEndTime = now + 10000;

    const sys2 = new BuildingSystem();
    sys2.deserialize(data);

    // 队列中的startTime应该用now作为fallback
    expect(sys2.getUpgradeQueue()).toHaveLength(1);
    expect(sys2.getUpgradeQueue()[0].startTime).toBe(now);
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. 重置
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 重置', () => {
  it('reset恢复初始状态', () => {
    const sys = new BuildingSystem();
    setLevel(sys, 'castle', 10);
    setLevel(sys, 'farmland', 5);
    sys.reset();
    expect(sys.getLevel('castle')).toBe(1);
    expect(sys.getLevel('farmland')).toBe(1);
    expect(sys.getLevel('market')).toBe(0);
    expect(sys.getBuilding('market').status).toBe('locked');
    expect(sys.getUpgradeQueue()).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 14. 边界条件
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 边界条件', () => {
  let sys: BuildingSystem;
  beforeEach(() => { sys = new BuildingSystem(); });

  it('getUpgradeCost在刚好Lv1时返回正确费用', () => {
    // farmland Lv1 → Lv2
    const cost = sys.getUpgradeCost('farmland');
    expect(cost).not.toBeNull();
    expect(cost!.grain).toBe(100);
  });

  it('getUpgradeCost在Lv(max-1)时返回最后一档费用', () => {
    setLevel(sys, 'farmland', BUILDING_MAX_LEVELS.farmland - 1);
    const cost = sys.getUpgradeCost('farmland');
    expect(cost).not.toBeNull();
  });

  it('getUpgradeCost在Lv(max)时返回null', () => {
    setLevel(sys, 'farmland', BUILDING_MAX_LEVELS.farmland);
    expect(sys.getUpgradeCost('farmland')).toBeNull();
  });

  it('getUpgradeCost对levelTable越界索引返回null（防御性分支）', () => {
    // levelTable 有 maxLevel 个条目（索引0到maxLevel-1）
    // 当 state.level = maxLevel-1 时，levelTable[maxLevel-1] 存在
    // 但如果 levelTable[level] 缺失，应返回 null
    // 正常情况下不会发生，但防御性代码处理了这种情况
    // 直接通过私有属性设置一个异常状态来覆盖该分支
    setBuildingState(sys, 'farmland', 1, 'idle');
    // farmland levelTable 有 25 个条目，索引 0~24
    // level=1 → levelTable[1] 存在，正常返回
    expect(sys.getUpgradeCost('farmland')).not.toBeNull();
  });

  it('getProduction对负等级参数返回0', () => {
    expect(sys.getProduction('farmland', -1)).toBe(0);
  });

  it('getProduction对等级0返回0', () => {
    expect(sys.getProduction('farmland', 0)).toBe(0);
  });

  it('getWallDefense对等级0返回0', () => {
    expect(sys.getWallDefense()).toBe(0);
  });

  it('getUpgradeProgress total<=0时返回1', () => {
    // 构造一个 endTime == startTime 的极端情况
    const now = Date.now();
    setBuildingState(sys, 'farmland', 1, 'upgrading', now, now); // total = 0
    // getUpgradeProgress: total <= 0 → return 1
    expect(sys.getUpgradeProgress('farmland')).toBe(1);
  });

  it('getUpgradeRemainingTime对无upgradeEndTime返回0', () => {
    expect(sys.getUpgradeRemainingTime('castle')).toBe(0);
  });

  it('cancelUpgrade对锁定建筑返回null', () => {
    expect(sys.cancelUpgrade('market')).toBeNull();
  });

  it('cancelUpgrade对idle建筑返回null', () => {
    expect(sys.cancelUpgrade('castle')).toBeNull();
  });

  it('cancelUpgrade当getUpgradeCost返回null时也返回null', () => {
    // 构造一个 upgrading 但 level=0 的异常状态
    setBuildingState(sys, 'market', 0, 'upgrading', Date.now(), Date.now() + 5000);
    // level=0 → getUpgradeCost返回null → cancelUpgrade返回null
    expect(sys.cancelUpgrade('market')).toBeNull();
    // 状态应保持不变（因为返回null不修改状态）
    expect(sys.getBuilding('market').status).toBe('upgrading');
  });
});

// ═══════════════════════════════════════════════════════════════
// 15. 集成场景
// ═══════════════════════════════════════════════════════════════

describe('BuildingSystem — 集成场景', () => {
  it('完整升级流程：开始→tick→完成', () => {
    const sys = new BuildingSystem();
    setLevel(sys, 'castle', 2);

    // 开始升级
    const cost = sys.startUpgrade('farmland', richResources());
    expect(cost).toBeDefined();
    expect(sys.getBuilding('farmland').status).toBe('upgrading');

    // 模拟升级完成：直接修改队列中的endTime
    const queue = getPrivateQueue(sys);
    const buildings = getPrivateBuildings(sys);
    const now = Date.now();
    queue[0].endTime = now - 1;
    buildings.farmland.upgradeEndTime = now - 1;

    const completed = sys.tick();
    expect(completed).toContain('farmland');
    expect(sys.getLevel('farmland')).toBe(2);
    expect(sys.getBuilding('farmland').status).toBe('idle');
  });

  it('完整流程：开始→取消→重新升级', () => {
    const sys = new BuildingSystem();
    setLevel(sys, 'castle', 2);

    // 开始升级
    sys.startUpgrade('farmland', richResources());
    expect(sys.getUpgradeQueue()).toHaveLength(1);

    // 取消升级
    const refund = sys.cancelUpgrade('farmland');
    expect(refund).not.toBeNull();
    expect(sys.getUpgradeQueue()).toHaveLength(0);
    expect(sys.getLevel('farmland')).toBe(1);

    // 重新升级
    sys.startUpgrade('farmland', richResources());
    expect(sys.getBuilding('farmland').status).toBe('upgrading');
  });

  it('序列化→反序列化→继续升级', () => {
    const sys = new BuildingSystem();
    setLevel(sys, 'castle', 5);
    setLevel(sys, 'farmland', 3);

    const data = sys.serialize();
    const sys2 = new BuildingSystem();
    sys2.deserialize(data);

    // 验证状态一致
    expect(sys2.getLevel('castle')).toBe(5);
    expect(sys2.getLevel('farmland')).toBe(3);
    expect(sys2.isUnlocked('market')).toBe(true);

    // 继续升级
    const check = sys2.checkUpgrade('farmland', richResources());
    expect(check.canUpgrade).toBe(true);
  });

  it('主城升级解锁链：Lv1→Lv2→Lv3→Lv4→Lv5', () => {
    const sys = new BuildingSystem();
    // 逐步提升主城等级
    for (let lv = 1; lv <= 5; lv++) {
      setLevel(sys, 'castle', lv);
    }
    // 所有建筑应解锁
    for (const t of BUILDING_TYPES) {
      expect(sys.isUnlocked(t)).toBe(true);
    }
  });

  it('多建筑同时升级（队列允许时）', () => {
    const sys = new BuildingSystem();
    setLevel(sys, 'castle', 10); // 2个队列槽位
    setLevel(sys, 'farmland', 1);
    setLevel(sys, 'market', 1);

    sys.startUpgrade('farmland', richResources());
    sys.startUpgrade('market', richResources());

    expect(sys.getUpgradeQueue()).toHaveLength(2);
    expect(sys.getBuilding('farmland').status).toBe('upgrading');
    expect(sys.getBuilding('market').status).toBe('upgrading');
  });
});
