/**
 * BuildQueueTechLink.test.ts — P0 覆盖缺口补全测试
 *
 * 三大 P0 缺口：
 * 1. 建造选择弹窗逻辑（前置条件检查、资源扣减、队列满判断）
 * 2. 队列顺序逻辑（槽位上限、FIFO完成、加速推进、取消退还、序列化）
 * 3. 科技联动加成（TechLinkSystem 与 BuildingSystem 的联动验证）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import type { BuildingType, BuildingState, Resources, BuildingSaveData } from '../../../shared/types';
import { BUILDING_TYPES, BUILDING_LABELS } from '../building.types';
import {
  BUILDING_DEFS, BUILDING_MAX_LEVELS, BUILDING_UNLOCK_LEVELS,
  BUILDING_SAVE_VERSION, QUEUE_CONFIGS, CANCEL_REFUND_RATIO,
} from '../building-config';
import { TechLinkSystem } from '../../tech/TechLinkSystem';
import type { TechLinkEffect } from '../../tech/TechLinkSystem';

const RICH: Resources = { grain: 1e9, gold: 1e9, troops: 1e9, mandate: 0 };
const ZERO: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0 };

function mockNow(base: number, offset: number) {
  vi.spyOn(Date, 'now').mockReturnValue(base + offset);
}

function makeSave(
  overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {},
): BuildingSaveData {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) {
    buildings[t] = {
      type: t, level: 1, status: 'idle',
      upgradeStartTime: null, upgradeEndTime: null,
      ...overrides[t],
    };
  }
  return { version: BUILDING_SAVE_VERSION, buildings };
}

/** 创建已解锁多个建筑的 save（主城 Lv5） */
function makeUnlockedSave(
  overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {},
): BuildingSaveData {
  return makeSave({
    castle: { level: 5, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    farmland: { level: 3, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    market: { level: 2, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    barracks: { level: 2, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    workshop: { level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    academy: { level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    clinic: { level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    wall: { level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════
// 1. 建造选择弹窗逻辑
// ═══════════════════════════════════════════════════════════════

describe('P0-1: 建造选择弹窗逻辑', () => {
  let sys: BuildingSystem;
  let base: number;
  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  // ── 1.1 可用建筑列表 ──
  describe('1.1 可用建筑列表（弹窗渲染数据源）', () => {
    it('初始状态只有主城和农田可用', () => {
      const available = BUILDING_TYPES.filter((t) =>
        sys.isUnlocked(t) && sys.checkUpgrade(t, RICH).canUpgrade,
      );
      expect(available).toContain('castle');
      expect(available).toContain('farmland');
      expect(available).not.toContain('barracks');
      expect(available).not.toContain('wall');
    });

    it('主城升级后新建筑出现在可用列表中', () => {
      sys.deserialize(makeSave({ castle: { level: 2 } }));
      const available = BUILDING_TYPES.filter((t) =>
        sys.isUnlocked(t) && sys.checkUpgrade(t, RICH).canUpgrade,
      );
      expect(available).toContain('market');
      expect(available).toContain('barracks');
    });

    it('主城 Lv5 时所有建筑均已解锁', () => {
      sys.deserialize(makeUnlockedSave());
      const unlockedTypes = BUILDING_TYPES.filter((t) => sys.isUnlocked(t));
      expect(unlockedTypes).toHaveLength(11);
    });

    it('弹窗中已解锁建筑显示正确的图标和名称', () => {
      for (const t of BUILDING_TYPES) {
        expect(BUILDING_LABELS[t]).toBeDefined();
        expect(typeof BUILDING_LABELS[t]).toBe('string');
        expect(BUILDING_LABELS[t].length).toBeGreaterThan(0);
      }
    });
  });

  // ── 1.2 前置条件检查 ──
  describe('1.2 建筑前置条件检查', () => {
    it('锁定建筑不可升级', () => {
      const r = sys.checkUpgrade('barracks', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('建筑尚未解锁');
    });

    it('建筑正在升级中不可再次升级', () => {
      sys.startUpgrade('castle', RICH);
      const r = sys.checkUpgrade('castle', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('建筑正在升级中');
    });

    it('达到等级上限不可升级', () => {
      sys.deserialize(makeSave({ farmland: { level: BUILDING_MAX_LEVELS.farmland } }));
      const r = sys.checkUpgrade('farmland', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain(`已达等级上限 Lv${BUILDING_MAX_LEVELS.farmland}`);
    });

    it('非主城建筑等级不能超过主城等级', () => {
      sys.deserialize(makeSave({ castle: { level: 1 }, farmland: { level: 3 } }));
      const r = sys.checkUpgrade('farmland', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('建筑等级不能超过主城等级+1 (当前主城 Lv1)');
    });

    it('主城 Lv4→5 需要至少一座其他建筑达到 Lv4', () => {
      sys.deserialize(makeSave({ castle: { level: 4 } }));
      const r = sys.checkUpgrade('castle', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('需要至少一座其他建筑达到 Lv4');
    });

    it('主城 Lv4→5 条件满足时可以升级', () => {
      sys.deserialize(makeSave({ castle: { level: 4 }, farmland: { level: 4 } }));
      expect(sys.checkUpgrade('castle', RICH).canUpgrade).toBe(true);
    });
  });

  // ── 1.3 资源不足时建造按钮 disabled ──
  describe('1.3 资源不足时建造按钮 disabled', () => {
    it('粮草不足时 canUpgrade=false', () => {
      const cost = sys.getUpgradeCost('castle')!;
      const poor: Resources = { grain: cost.grain - 1, gold: 1e9, troops: 1e9, mandate: 0 };
      const r = sys.checkUpgrade('castle', poor);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons.some((msg) => msg.includes('粮草不足'))).toBe(true);
    });

    it('铜钱不足时 canUpgrade=false', () => {
      const cost = sys.getUpgradeCost('castle')!;
      const poor: Resources = { grain: 1e9, gold: cost.gold - 1, troops: 1e9, mandate: 0 };
      const r = sys.checkUpgrade('castle', poor);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons.some((msg) => msg.includes('铜钱不足'))).toBe(true);
    });

    it('兵力不足时 canUpgrade=false', () => {
      sys.deserialize(makeSave({ castle: { level: 2 } }));
      const cost = sys.getUpgradeCost('castle')!;
      if (cost.troops > 0) {
        const poor: Resources = { grain: 1e9, gold: 1e9, troops: cost.troops - 1, mandate: 0 };
        const r = sys.checkUpgrade('castle', poor);
        expect(r.canUpgrade).toBe(false);
        expect(r.reasons.some((msg) => msg.includes('兵力不足'))).toBe(true);
      }
    });

    it('资源恰好等于消耗时 canUpgrade=true', () => {
      const cost = sys.getUpgradeCost('castle')!;
      const exact: Resources = { grain: cost.grain, gold: cost.gold, troops: cost.troops, mandate: 0 };
      expect(sys.checkUpgrade('castle', exact).canUpgrade).toBe(true);
    });

    it('不传 resources 参数时跳过资源检查', () => {
      expect(sys.checkUpgrade('castle').canUpgrade).toBe(true);
    });
  });

  // ── 1.4 建造确认交互（资源扣减） ──
  describe('1.4 建造确认交互（资源扣减验证）', () => {
    it('startUpgrade 返回的费用与 getUpgradeCost 一致', () => {
      const expected = sys.getUpgradeCost('castle')!;
      const actual = sys.startUpgrade('castle', RICH);
      expect(actual.grain).toBe(expected.grain);
      expect(actual.gold).toBe(expected.gold);
      expect(actual.troops).toBe(expected.troops);
      expect(actual.timeSeconds).toBe(expected.timeSeconds);
    });

    it('startUpgrade 后建筑状态变为 upgrading', () => {
      sys.startUpgrade('castle', RICH);
      const b = sys.getBuilding('castle');
      expect(b.status).toBe('upgrading');
      expect(b.upgradeStartTime).not.toBeNull();
      expect(b.upgradeEndTime).not.toBeNull();
    });

    it('startUpgrade 后 upgradeEndTime = startTime + timeSeconds * 1000', () => {
      const cost = sys.getUpgradeCost('castle')!;
      sys.startUpgrade('castle', RICH);
      const b = sys.getBuilding('castle');
      expect(b.upgradeEndTime! - b.upgradeStartTime!).toBe(cost.timeSeconds * 1000);
    });

    it('资源不足时 startUpgrade 抛出错误', () => {
      expect(() => sys.startUpgrade('castle', ZERO)).toThrow('无法升级');
    });

    it('升级队列已满时 startUpgrade 抛出错误', () => {
      sys.startUpgrade('farmland', RICH);
      expect(() => sys.startUpgrade('castle', RICH)).toThrow('升级队列已满');
    });
  });

  // ── 1.5 建造成功后资源扣减 ──
  describe('1.5 建造成功后资源扣减', () => {
    it('startUpgrade 返回的扣减值精确匹配配置', () => {
      sys.deserialize(makeUnlockedSave());
      const cost = sys.getUpgradeCost('farmland')!;
      const deducted = sys.startUpgrade('farmland', RICH);
      expect(deducted.grain).toBe(cost.grain);
      expect(deducted.gold).toBe(cost.gold);
      expect(deducted.troops).toBe(cost.troops);
    });

    it('升级完成后建筑等级+1且状态恢复idle', () => {
      sys.startUpgrade('castle', RICH);
      const cost = sys.getUpgradeCost('castle')!;
      mockNow(base, cost.timeSeconds * 1000 + 1);
      const completed = sys.tick();
      expect(completed).toContain('castle');
      const b = sys.getBuilding('castle');
      expect(b.level).toBe(2);
      expect(b.status).toBe('idle');
      expect(b.upgradeStartTime).toBeNull();
      expect(b.upgradeEndTime).toBeNull();
    });
  });

  // ── 1.6 建造队列已满时不可新建 ──
  describe('1.6 建造队列已满时不可新建', () => {
    it('主城 Lv1-5 时队列只有1个槽位', () => {
      expect(sys.getMaxQueueSlots()).toBe(1);
    });

    it('队列满后 checkUpgrade 返回 "升级队列已满"', () => {
      sys.startUpgrade('castle', RICH);
      const r = sys.checkUpgrade('farmland', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('升级队列已满');
    });

    it('主城 Lv6-10 时队列有2个槽位', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      expect(sys.getMaxQueueSlots()).toBe(2);
    });

    it('主城 Lv11-20 时队列有3个槽位', () => {
      sys.deserialize(makeSave({ castle: { level: 15 } }));
      expect(sys.getMaxQueueSlots()).toBe(3);
    });

    it('主城 Lv21-30 时队列有4个槽位', () => {
      sys.deserialize(makeSave({ castle: { level: 25 } }));
      expect(sys.getMaxQueueSlots()).toBe(4);
    });

    it('QUEUE_CONFIGS 覆盖主城1-30级全范围无间隙', () => {
      expect(QUEUE_CONFIGS[0].castleLevelMin).toBe(1);
      expect(QUEUE_CONFIGS[QUEUE_CONFIGS.length - 1].castleLevelMax).toBe(30);
      for (let i = 1; i < QUEUE_CONFIGS.length; i++) {
        expect(QUEUE_CONFIGS[i].castleLevelMin).toBe(QUEUE_CONFIGS[i - 1].castleLevelMax + 1);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 队列顺序逻辑
// ═══════════════════════════════════════════════════════════════

describe('P0-2: 队列顺序逻辑', () => {
  let sys: BuildingSystem;
  let base: number;
  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  // ── 2.1 队列最大槽位数 ──
  describe('2.1 队列最大槽位数', () => {
    it('每个主城等级段的槽位数正确', () => {
      const cases: [number, number][] = [
        [1, 1], [3, 1], [5, 1], [6, 2], [8, 2], [10, 2],
        [11, 3], [15, 3], [20, 3], [21, 4], [25, 4], [30, 4],
      ];
      for (const [lv, expected] of cases) {
        sys.deserialize(makeSave({ castle: { level: lv } }));
        expect(sys.getMaxQueueSlots()).toBe(expected);
      }
    });

    it('isQueueFull 在队列为空时返回 false', () => {
      expect(sys.isQueueFull()).toBe(false);
    });

    it('isQueueFull 在队列达到上限时返回 true', () => {
      sys.startUpgrade('castle', RICH);
      expect(sys.isQueueFull()).toBe(true);
    });
  });

  // ── 2.2 多个建筑同时升级的队列管理 ──
  describe('2.2 多个建筑同时升级的队列管理', () => {
    it('2个槽位时可以同时升级2个建筑', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      sys.startUpgrade('farmland', RICH);
      sys.startUpgrade('market', RICH);
      expect(sys.getUpgradeQueue()).toHaveLength(2);
      expect(sys.isQueueFull()).toBe(true);
    });

    it('2个槽位时第3个建筑不可升级', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      sys.startUpgrade('farmland', RICH);
      sys.startUpgrade('market', RICH);
      expect(() => sys.startUpgrade('barracks', RICH)).toThrow('升级队列已满');
    });

    it('队列中每个建筑的 startTime 和 endTime 独立', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      sys.startUpgrade('farmland', RICH);
      mockNow(base, 100);
      sys.startUpgrade('market', RICH);
      const queue = sys.getUpgradeQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].startTime).not.toBe(queue[1].startTime);
    });
  });

  // ── 2.3 队列完成顺序（先入先出） ──
  describe('2.3 队列完成顺序（先入先出）', () => {
    it('先加入队列的建筑先完成', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      const farmCost = sys.getUpgradeCost('farmland')!;
      sys.startUpgrade('farmland', RICH);
      mockNow(base, 100);
      sys.startUpgrade('market', RICH);
      // 快进到农田完成但市集未完成
      mockNow(base, farmCost.timeSeconds * 1000 + 1);
      const completed1 = sys.tick();
      expect(completed1).toContain('farmland');
      expect(completed1).not.toContain('market');
      expect(sys.getBuilding('market').status).toBe('upgrading');
    });

    it('两个建筑同时到期时同时完成', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      sys.startUpgrade('farmland', RICH);
      sys.startUpgrade('market', RICH);
      const farm = sys.getBuilding('farmland');
      const market = sys.getBuilding('market');
      const maxEnd = Math.max(farm.upgradeEndTime!, market.upgradeEndTime!);
      mockNow(base, (maxEnd - base) + 1);
      const completed = sys.tick();
      expect(completed).toHaveLength(2);
      expect(completed).toContain('farmland');
      expect(completed).toContain('market');
    });

    it('升级完成后队列自动清空对应项', () => {
      sys.startUpgrade('castle', RICH);
      const cost = sys.getUpgradeCost('castle')!;
      mockNow(base, cost.timeSeconds * 1000 + 1);
      sys.tick();
      expect(sys.getUpgradeQueue()).toHaveLength(0);
    });
  });

  // ── 2.4 加速完成后队列状态更新 ──
  describe('2.4 加速完成后队列状态更新', () => {
    it('完成一个升级后队列空出槽位可以新建升级', () => {
      sys.startUpgrade('castle', RICH);
      expect(sys.isQueueFull()).toBe(true);
      expect(sys.checkUpgrade('farmland', RICH).canUpgrade).toBe(false);
      const cost = sys.getUpgradeCost('castle')!;
      mockNow(base, cost.timeSeconds * 1000 + 1);
      sys.tick();
      expect(sys.isQueueFull()).toBe(false);
      expect(sys.checkUpgrade('farmland', RICH).canUpgrade).toBe(true);
    });

    it('forceCompleteUpgrades 即时完成所有升级', () => {
      sys.deserialize(makeUnlockedSave({
        castle: { level: 6, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
      }));
      sys.startUpgrade('farmland', RICH);
      sys.startUpgrade('market', RICH);
      const completed = sys.forceCompleteUpgrades();
      expect(completed).toContain('farmland');
      expect(completed).toContain('market');
      expect(sys.getUpgradeQueue()).toHaveLength(0);
      expect(sys.getLevel('farmland')).toBe(4);
      expect(sys.getLevel('market')).toBe(3);
    });

    it('forceCompleteUpgrades 后队列完全清空', () => {
      sys.startUpgrade('castle', RICH);
      sys.forceCompleteUpgrades();
      expect(sys.getUpgradeQueue()).toHaveLength(0);
      expect(sys.isQueueFull()).toBe(false);
    });
  });

  // ── 2.5 取消队列项后资源退还 ──
  describe('2.5 取消队列项后资源退还', () => {
    it('cancelUpgrade 返回 80% 资源', () => {
      const cost = sys.getUpgradeCost('castle')!;
      sys.startUpgrade('castle', RICH);
      const refund = sys.cancelUpgrade('castle');
      expect(refund).not.toBeNull();
      expect(refund!.grain).toBe(Math.round(cost.grain * CANCEL_REFUND_RATIO));
      expect(refund!.gold).toBe(Math.round(cost.gold * CANCEL_REFUND_RATIO));
      expect(refund!.troops).toBe(Math.round(cost.troops * CANCEL_REFUND_RATIO));
      expect(refund!.timeSeconds).toBe(0);
    });

    it('cancelUpgrade 后建筑状态恢复为 idle', () => {
      sys.startUpgrade('castle', RICH);
      sys.cancelUpgrade('castle');
      const b = sys.getBuilding('castle');
      expect(b.status).toBe('idle');
      expect(b.upgradeStartTime).toBeNull();
      expect(b.upgradeEndTime).toBeNull();
    });

    it('cancelUpgrade 后从队列中移除', () => {
      sys.startUpgrade('castle', RICH);
      expect(sys.getUpgradeQueue()).toHaveLength(1);
      sys.cancelUpgrade('castle');
      expect(sys.getUpgradeQueue()).toHaveLength(0);
    });

    it('cancelUpgrade 后空出槽位可以新建升级', () => {
      sys.startUpgrade('castle', RICH);
      expect(sys.isQueueFull()).toBe(true);
      sys.cancelUpgrade('castle');
      expect(sys.isQueueFull()).toBe(false);
      expect(() => sys.startUpgrade('farmland', RICH)).not.toThrow();
    });

    it('取消非升级中的建筑返回 null', () => {
      expect(sys.cancelUpgrade('castle')).toBeNull();
    });

    it('多队列时取消其中一个不影响其他', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      sys.startUpgrade('farmland', RICH);
      sys.startUpgrade('market', RICH);
      sys.cancelUpgrade('farmland');
      expect(sys.getUpgradeQueue()).toHaveLength(1);
      expect(sys.getUpgradeQueue()[0].buildingType).toBe('market');
      expect(sys.getBuilding('farmland').status).toBe('idle');
      expect(sys.getBuilding('market').status).toBe('upgrading');
    });
  });

  // ── 2.6 队列状态序列化/反序列化 ──
  describe('2.6 队列状态序列化/反序列化', () => {
    it('序列化后反序列化能恢复建筑状态', () => {
      sys.deserialize(makeUnlockedSave());
      sys.startUpgrade('farmland', RICH);
      const saved = sys.serialize();
      const sys2 = new BuildingSystem();
      sys2.deserialize(saved);
      expect(sys2.getBuilding('farmland').status).toBe('upgrading');
      expect(sys2.getBuilding('farmland').level).toBe(3);
      expect(sys2.getUpgradeQueue()).toHaveLength(1);
      expect(sys2.getUpgradeQueue()[0].buildingType).toBe('farmland');
    });

    it('离线期间升级完成时反序列化自动处理', () => {
      sys.deserialize(makeUnlockedSave());
      const cost = sys.getUpgradeCost('farmland')!;
      sys.startUpgrade('farmland', RICH);
      const saved = sys.serialize();
      const offlineTime = base + cost.timeSeconds * 1000 + 60000;
      vi.spyOn(Date, 'now').mockReturnValue(offlineTime);
      const sys2 = new BuildingSystem();
      sys2.deserialize(saved);
      expect(sys2.getBuilding('farmland').status).toBe('idle');
      expect(sys2.getBuilding('farmland').level).toBe(4);
      expect(sys2.getUpgradeQueue()).toHaveLength(0);
    });

    it('离线期间部分升级完成时只处理已完成的', () => {
      sys.deserialize(makeUnlockedSave({
        castle: { level: 6, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
      }));
      sys.startUpgrade('farmland', RICH);
      mockNow(base, 100);
      sys.startUpgrade('market', RICH);
      const saved = sys.serialize();
      const farmEndTime = saved.buildings.farmland.upgradeEndTime!;
      vi.spyOn(Date, 'now').mockReturnValue(farmEndTime + 1000);
      const sys2 = new BuildingSystem();
      sys2.deserialize(saved);
      expect(sys2.getBuilding('farmland').status).toBe('idle');
      expect(sys2.getBuilding('farmland').level).toBe(4);
      const marketBuilding = sys2.getBuilding('market');
      const queue = sys2.getUpgradeQueue();
      if (marketBuilding.status === 'upgrading') {
        expect(queue).toHaveLength(1);
        expect(queue[0].buildingType).toBe('market');
      } else {
        expect(queue).toHaveLength(0);
        expect(marketBuilding.level).toBe(3);
      }
    });

    it('版本不匹配时仍然加载', () => {
      const badSave = { version: 999, buildings: makeSave().buildings };
      expect(() => sys.deserialize(badSave as BuildingSaveData)).not.toThrow();
    });

    it('空队列序列化后反序列化仍为空', () => {
      sys.deserialize(makeUnlockedSave());
      const saved = sys.serialize();
      const sys2 = new BuildingSystem();
      sys2.deserialize(saved);
      expect(sys2.getUpgradeQueue()).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 科技联动加成
// ═══════════════════════════════════════════════════════════════

describe('P0-3: 科技联动加成', () => {
  let buildingSys: BuildingSystem;
  let linkSys: TechLinkSystem;
  let base: number;
  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    buildingSys = new BuildingSystem();
    linkSys = new TechLinkSystem();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  // ── 3.1 科技完成后建筑产出加成生效 ──
  describe('3.1 科技完成后建筑产出加成生效', () => {
    it('未完成科技时建筑联动加成为0', () => {
      const bonus = linkSys.getBuildingLinkBonus('farm');
      expect(bonus.productionBonus).toBe(0);
      expect(bonus.buildingType).toBe('farm');
    });

    it('完成 eco_t1_farming 后农田产出加成 +20%', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getBuildingLinkBonus('farm').productionBonus).toBe(20);
    });

    it('完成 eco_t1_trade 后市集产出加成 +20%', () => {
      linkSys.addCompletedTech('eco_t1_trade');
      expect(linkSys.getBuildingLinkBonus('market').productionBonus).toBe(20);
    });

    it('syncCompletedTechIds 批量同步后加成正确', () => {
      linkSys.syncCompletedTechIds(['eco_t1_farming', 'eco_t2_irrigation']);
      expect(linkSys.getBuildingLinkBonus('farm').productionBonus).toBe(45);
    });

    it('getTechBonus 统一接口返回建筑加成', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
    });

    it('getTechBonusMultiplier 返回正确的乘数', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonusMultiplier('building', 'farm')).toBeCloseTo(1.2);
    });
  });

  // ── 3.2 不同科技对不同建筑类型的加成 ──
  describe('3.2 不同科技对不同建筑类型的加成', () => {
    it('农田加成不影响市集', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getBuildingLinkBonus('farm').productionBonus).toBe(20);
      expect(linkSys.getBuildingLinkBonus('market').productionBonus).toBe(0);
    });

    it('市集加成不影响农田', () => {
      linkSys.addCompletedTech('eco_t1_trade');
      expect(linkSys.getBuildingLinkBonus('market').productionBonus).toBe(20);
      expect(linkSys.getBuildingLinkBonus('farm').productionBonus).toBe(0);
    });

    it('兵营加成包含 unlockFeature', () => {
      linkSys.addCompletedTech('mil_t1_attack');
      const bonus = linkSys.getBuildingLinkBonus('barracks');
      expect(bonus.productionBonus).toBe(15);
      expect(bonus.unlockFeature).toBe(true);
      expect(bonus.unlockDescription).toContain('高级兵种');
    });

    it('书院加成来自文化路线科技', () => {
      linkSys.addCompletedTech('cul_t2_academy');
      expect(linkSys.getBuildingLinkBonus('academy').productionBonus).toBe(15);
    });

    it('未关联的建筑类型加成为0', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getBuildingLinkBonus('wall').productionBonus).toBe(0);
      expect(linkSys.getBuildingLinkBonus('clinic').productionBonus).toBe(0);
    });

    it('getAllBuildingBonuses 返回所有有联动的建筑', () => {
      linkSys.syncCompletedTechIds(['eco_t1_farming', 'eco_t1_trade']);
      const all = linkSys.getAllBuildingBonuses();
      const types = all.map((b) => b.buildingType);
      expect(types).toContain('farm');
      expect(types).toContain('market');
    });
  });

  // ── 3.3 科技加成与建筑等级加成叠加 ──
  describe('3.3 科技加成与建筑等级加成叠加计算', () => {
    it('建筑自身产出随等级增长', () => {
      buildingSys.deserialize(makeSave({ farmland: { level: 1 } }));
      const prod1 = buildingSys.getProduction('farmland');
      buildingSys.deserialize(makeSave({ farmland: { level: 5 } }));
      const prod5 = buildingSys.getProduction('farmland');
      expect(prod5).toBeGreaterThan(prod1);
    });

    it('主城加成乘数随等级增长', () => {
      buildingSys.deserialize(makeSave({ castle: { level: 1 } }));
      const mult1 = buildingSys.getCastleBonusMultiplier();
      buildingSys.deserialize(makeSave({ castle: { level: 5 } }));
      const mult5 = buildingSys.getCastleBonusMultiplier();
      expect(mult5).toBeGreaterThan(mult1);
    });

    it('科技加成乘数与主城加成乘数可叠加', () => {
      buildingSys.deserialize(makeSave({ castle: { level: 5 }, farmland: { level: 5 } }));
      linkSys.addCompletedTech('eco_t1_farming');
      const baseProd = buildingSys.getProduction('farmland');
      const castleMult = buildingSys.getCastleBonusMultiplier();
      const techMult = linkSys.getTechBonusMultiplier('building', 'farm');
      const finalProd = baseProd * castleMult * techMult;
      expect(finalProd).toBeGreaterThan(baseProd);
      expect(techMult).toBeCloseTo(1.2);
      expect(castleMult).toBeCloseTo(1.08);
    });

    it('calculateTotalProduction 不含主城加成', () => {
      buildingSys.deserialize(makeSave({ farmland: { level: 5 } }));
      const total = buildingSys.calculateTotalProduction();
      expect(total['castle']).toBeUndefined();
      expect(total['grain']).toBeGreaterThan(0);
    });
  });

  // ── 3.4 科技加成数值精确验证 ──
  describe('3.4 科技加成数值精确验证', () => {
    it('精耕细作（eco_t1_farming）→ 农田 +20%', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
    });

    it('水利灌溉（eco_t2_irrigation）→ 农田 +25%', () => {
      linkSys.addCompletedTech('eco_t2_irrigation');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(25);
    });

    it('两个农田科技叠加 → 农田 +45%', () => {
      linkSys.syncCompletedTechIds(['eco_t1_farming', 'eco_t2_irrigation']);
      expect(linkSys.getTechBonus('building', 'farm')).toBe(45);
    });

    it('商路开拓（eco_t1_trade）→ 市集 +20%', () => {
      linkSys.addCompletedTech('eco_t1_trade');
      expect(linkSys.getTechBonus('building', 'market')).toBe(20);
    });

    it('铸币术（eco_t2_minting）→ 市集 +25%', () => {
      linkSys.addCompletedTech('eco_t2_minting');
      expect(linkSys.getTechBonus('building', 'market')).toBe(25);
    });

    it('锐兵术（mil_t1_attack）→ 兵营 +15% + 解锁高级训练', () => {
      linkSys.addCompletedTech('mil_t1_attack');
      const bonus = linkSys.getBuildingLinkBonus('barracks');
      expect(bonus.productionBonus).toBe(15);
      expect(bonus.unlockFeature).toBe(true);
    });

    it('书院扩建（cul_t2_academy）→ 书院 +15%', () => {
      linkSys.addCompletedTech('cul_t2_academy');
      expect(linkSys.getTechBonus('building', 'academy')).toBe(15);
    });

    it('getTechBonusMultiplier 精确到小数点后10位', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonusMultiplier('building', 'farm')).toBeCloseTo(1.2, 10);
    });
  });

  // ── 3.5 取消科技后建筑产出回退 ──
  describe('3.5 取消科技后建筑产出回退', () => {
    it('removeCompletedTech 后加成归零', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
      linkSys.removeCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(0);
    });

    it('移除一个科技后叠加值减少', () => {
      linkSys.syncCompletedTechIds(['eco_t1_farming', 'eco_t2_irrigation']);
      expect(linkSys.getTechBonus('building', 'farm')).toBe(45);
      linkSys.removeCompletedTech('eco_t2_irrigation');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
    });

    it('reset 后所有加成归零', () => {
      linkSys.syncCompletedTechIds(['eco_t1_farming', 'eco_t1_trade']);
      linkSys.reset();
      expect(linkSys.getTechBonus('building', 'farm')).toBe(0);
      expect(linkSys.getTechBonus('building', 'market')).toBe(0);
    });

    it('重复 addCompletedTech 不叠加', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
    });

    it('syncCompletedTechIds 完全替换而非追加', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
      linkSys.syncCompletedTechIds(['eco_t1_trade']);
      expect(linkSys.getTechBonus('building', 'farm')).toBe(0);
      expect(linkSys.getTechBonus('building', 'market')).toBe(20);
    });
  });

  // ── 3.6 联动效果注册与查询 ──
  describe('3.6 联动效果注册与查询', () => {
    it('registerLink 添加自定义联动效果', () => {
      const customLink: TechLinkEffect = {
        id: 'custom_wall_1', techId: 'custom_tech_wall',
        target: 'building', targetSub: 'wall',
        description: '自定义城墙加成+30%', value: 30,
      };
      linkSys.registerLink(customLink);
      linkSys.addCompletedTech('custom_tech_wall');
      expect(linkSys.getTechBonus('building', 'wall')).toBe(30);
    });

    it('unregisterLink 移除联动效果', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
      linkSys.unregisterLink('link_building_farm_1');
      expect(linkSys.getTechBonus('building', 'farm')).toBe(0);
    });

    it('registerLinks 批量注册', () => {
      const links: TechLinkEffect[] = [
        { id: 'batch_1', techId: 't1', target: 'building', targetSub: 'workshop', description: '批量1', value: 10 },
        { id: 'batch_2', techId: 't2', target: 'building', targetSub: 'clinic', description: '批量2', value: 15 },
      ];
      linkSys.registerLinks(links);
      linkSys.syncCompletedTechIds(['t1', 't2']);
      expect(linkSys.getTechBonus('building', 'workshop')).toBe(10);
      expect(linkSys.getTechBonus('building', 'clinic')).toBe(15);
    });

    it('getState 返回正确的联动系统状态', () => {
      linkSys.addCompletedTech('eco_t1_farming');
      const state = linkSys.getState();
      expect(state.totalLinks).toBeGreaterThan(0);
      expect(state.activeLinks).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 端到端联动场景
// ═══════════════════════════════════════════════════════════════

describe('P0-E2E: 建筑×科技联动端到端场景', () => {
  let buildingSys: BuildingSystem;
  let linkSys: TechLinkSystem;
  let base: number;
  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    buildingSys = new BuildingSystem();
    linkSys = new TechLinkSystem();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('完整流程：建筑升级 → 科技研究 → 产出叠加验证', () => {
    buildingSys.deserialize(makeSave({ castle: { level: 5 }, farmland: { level: 3 } }));
    const baseProd = buildingSys.getProduction('farmland');
    // 升级农田到 Lv4
    buildingSys.startUpgrade('farmland', RICH);
    const cost = buildingSys.getUpgradeCost('farmland')!;
    mockNow(base, cost.timeSeconds * 1000 + 1);
    buildingSys.tick();
    expect(buildingSys.getLevel('farmland')).toBe(4);
    const prodAfterUpgrade = buildingSys.getProduction('farmland');
    expect(prodAfterUpgrade).toBeGreaterThan(baseProd);
    // 完成科技
    linkSys.addCompletedTech('eco_t1_farming');
    expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
    // 叠加计算
    const castleMult = buildingSys.getCastleBonusMultiplier();
    const techMult = linkSys.getTechBonusMultiplier('building', 'farm');
    const finalProd = prodAfterUpgrade * castleMult * techMult;
    expect(finalProd).toBeGreaterThan(prodAfterUpgrade);
    expect(finalProd).toBeCloseTo(prodAfterUpgrade * castleMult * 1.2, 5);
  });

  it('完整流程：多科技叠加 → 取消一个 → 产出回退', () => {
    buildingSys.deserialize(makeSave({ farmland: { level: 5 } }));
    linkSys.syncCompletedTechIds(['eco_t1_farming', 'eco_t2_irrigation']);
    expect(linkSys.getTechBonus('building', 'farm')).toBe(45);
    linkSys.removeCompletedTech('eco_t2_irrigation');
    expect(linkSys.getTechBonus('building', 'farm')).toBe(20);
    expect(linkSys.getTechBonusMultiplier('building', 'farm')).toBeCloseTo(1.2);
  });

  it('完整流程：队列满 → 取消 → 新建 → 完成', () => {
    buildingSys.deserialize(makeSave({ castle: { level: 5 } }));
    buildingSys.startUpgrade('farmland', RICH);
    expect(buildingSys.isQueueFull()).toBe(true);
    const refund = buildingSys.cancelUpgrade('farmland');
    expect(refund).not.toBeNull();
    expect(buildingSys.isQueueFull()).toBe(false);
    buildingSys.startUpgrade('castle', RICH);
    const cost = buildingSys.getUpgradeCost('castle')!;
    mockNow(base, cost.timeSeconds * 1000 + 1);
    const completed = buildingSys.tick();
    expect(completed).toContain('castle');
    expect(buildingSys.getLevel('castle')).toBe(6);
    expect(buildingSys.getMaxQueueSlots()).toBe(2);
  });

  it('完整流程：序列化 → 离线 → 反序列化 → 科技加成验证', () => {
    buildingSys.deserialize(makeSave({ castle: { level: 5 }, farmland: { level: 3 } }));
    buildingSys.startUpgrade('farmland', RICH);
    const saved = buildingSys.serialize();
    const cost = BUILDING_DEFS.farmland.levelTable[3]?.upgradeCost;
    const offlineTime = base + (cost?.timeSeconds ?? 100) * 1000 + 60000;
    vi.spyOn(Date, 'now').mockReturnValue(offlineTime);
    const sys2 = new BuildingSystem();
    sys2.deserialize(saved);
    expect(sys2.getLevel('farmland')).toBe(4);
    linkSys.addCompletedTech('eco_t1_farming');
    const prod = sys2.getProduction('farmland');
    const techMult = linkSys.getTechBonusMultiplier('building', 'farm');
    expect(prod * techMult).toBeCloseTo(prod * 1.2, 5);
  });
});
