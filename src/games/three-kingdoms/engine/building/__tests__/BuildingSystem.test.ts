import { vi } from 'vitest';
/**
 * BuildingSystem 单元测试
 * 覆盖：初始化、升级检查、升级执行、取消升级、解锁系统、队列管理、产出计算、特殊属性、序列化/反序列化、reset
 */

import { BuildingSystem } from '../BuildingSystem';
import type { BuildingType, BuildingState, BuildingSaveData, Resources } from '../../../shared/types';
import { BUILDING_TYPES } from '../building.types';
import { BUILDING_DEFS, BUILDING_MAX_LEVELS, BUILDING_UNLOCK_LEVELS, BUILDING_SAVE_VERSION, CANCEL_REFUND_RATIO } from '../building-config';
import { gameLog } from '../../../core/logger';

const RICH: Resources = { grain: 1e9, gold: 1e9, troops: 1e9, mandate: 0 };
const ZERO: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0 };

function mockNow(base: number, offset: number) {
  vi.spyOn(Date, 'now').mockReturnValue(base + offset);
}

function makeSave(overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {}): BuildingSaveData {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) {
    buildings[t] = { type: t, level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null, ...overrides[t] };
  }
  return { version: BUILDING_SAVE_VERSION, buildings };
}

describe('BuildingSystem', () => {
  let sys: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('11座建筑全部存在', () => {
      const all = sys.getAllBuildings();
      expect(Object.keys(all)).toHaveLength(11);
      for (const t of BUILDING_TYPES) expect(all[t]).toBeDefined();
    });

    it('主城和农田初始等级1、状态idle；其余按解锁条件初始化', () => {
      for (const t of BUILDING_TYPES) {
        const b = sys.getBuilding(t);
        if (BUILDING_UNLOCK_LEVELS[t] === 0) {
          expect(b.level).toBe(1);
          expect(b.status).toBe('idle');
        } else {
          expect(b.level).toBe(0);
          expect(b.status).toBe('locked');
        }
      }
    });

    it('getCastleLevel() 返回 1', () => { expect(sys.getCastleLevel()).toBe(1); });
    it('初始队列为空', () => { expect(sys.getUpgradeQueue()).toHaveLength(0); });
  });

  // ═══════════════════════════════════════════
  // 2. 升级检查 checkUpgrade
  // ═══════════════════════════════════════════
  describe('checkUpgrade', () => {
    it('资源不足时 canUpgrade=false', () => {
      const r = sys.checkUpgrade('castle', ZERO);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons.length).toBeGreaterThan(0);
    });

    it('达到等级上限时 canUpgrade=false', () => {
      sys.deserialize(makeSave({ farmland: { level: BUILDING_MAX_LEVELS.farmland } }));
      const r = sys.checkUpgrade('farmland', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain(`已达等级上限 Lv${BUILDING_MAX_LEVELS.farmland}`);
    });

    it('非主城建筑等级不能超过主城等级+1', () => {
      // 初始状态：主城 Lv1，农田 Lv1，农田 level(1) <= 主城 level(1) + 1，所以可以升级
      // 需要先让农田等级 > 主城等级 + 1 才会触发限制
      // 设置主城 Lv1，农田 Lv3（超过主城+1=2）
      sys.deserialize(makeSave({ castle: { level: 1 }, farmland: { level: 3 } }));
      const r = sys.checkUpgrade('farmland', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('建筑等级不能超过主城等级+1 (当前主城 Lv1)');
    });

    it('队列满时 canUpgrade=false', () => {
      sys.deserialize(makeSave({ castle: { level: 3 } }));
      sys.startUpgrade('farmland', RICH);
      const r = sys.checkUpgrade('market', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('升级队列已满');
    });

    it('条件满足时 canUpgrade=true', () => {
      expect(sys.checkUpgrade('castle', RICH).canUpgrade).toBe(true);
    });

    it('建筑正在升级中不能再次升级', () => {
      sys.startUpgrade('castle', RICH);
      const r = sys.checkUpgrade('castle', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('建筑正在升级中');
    });

    it('锁定建筑不能升级', () => {
      const r = sys.checkUpgrade('barracks', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('建筑尚未解锁');
    });

    it('主城 Lv4→5 需要至少一座其他建筑达到 Lv4', () => {
      sys.deserialize(makeSave({ castle: { level: 4 } }));
      const r = sys.checkUpgrade('castle', RICH);
      expect(r.canUpgrade).toBe(false);
      expect(r.reasons).toContain('需要至少一座其他建筑达到 Lv4');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 升级执行 startUpgrade
  // ═══════════════════════════════════════════
  describe('startUpgrade', () => {
    it('升级后状态变为 upgrading', () => {
      sys.startUpgrade('castle', RICH);
      expect(sys.getBuilding('castle').status).toBe('upgrading');
    });

    it('升级后队列增加一条记录', () => {
      sys.startUpgrade('castle', RICH);
      const q = sys.getUpgradeQueue();
      expect(q).toHaveLength(1);
      expect(q[0].buildingType).toBe('castle');
    });

    it('升级费用返回值匹配配置', () => {
      const cost = sys.startUpgrade('castle', RICH);
      const expected = BUILDING_DEFS.castle.levelTable[1].upgradeCost;
      expect(cost.grain).toBe(expected.grain);
      expect(cost.gold).toBe(expected.gold);
      expect(cost.troops).toBe(expected.troops);
      expect(cost.timeSeconds).toBe(expected.timeSeconds);
    });

    it('条件不满足时抛出错误', () => {
      expect(() => sys.startUpgrade('castle', ZERO)).toThrow('无法升级');
    });

    it('升级计时器正确设置', () => {
      const cost = sys.startUpgrade('castle', RICH);
      const b = sys.getBuilding('castle');
      expect(b.upgradeStartTime).toBe(base);
      expect(b.upgradeEndTime).toBe(base + cost.timeSeconds * 1000);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 取消升级 cancelUpgrade
  // ═══════════════════════════════════════════
  describe('cancelUpgrade', () => {
    it('取消后状态返回 idle', () => {
      sys.startUpgrade('castle', RICH);
      sys.cancelUpgrade('castle');
      expect(sys.getBuilding('castle').status).toBe('idle');
    });

    it('取消后返还 80% 资源', () => {
      const cost = sys.startUpgrade('castle', RICH);
      const refund = sys.cancelUpgrade('castle')!;
      expect(refund.grain).toBe(Math.round(cost.grain * CANCEL_REFUND_RATIO));
      expect(refund.gold).toBe(Math.round(cost.gold * CANCEL_REFUND_RATIO));
      expect(refund.troops).toBe(Math.round(cost.troops * CANCEL_REFUND_RATIO));
      expect(refund.timeSeconds).toBe(0);
    });

    it('取消后队列移除该建筑', () => {
      sys.startUpgrade('castle', RICH);
      sys.cancelUpgrade('castle');
      expect(sys.getUpgradeQueue()).toHaveLength(0);
    });

    it('非升级状态取消返回 null', () => {
      expect(sys.cancelUpgrade('castle')).toBeNull();
    });

    it('取消后时间戳清空', () => {
      sys.startUpgrade('castle', RICH);
      sys.cancelUpgrade('castle');
      const b = sys.getBuilding('castle');
      expect(b.upgradeStartTime).toBeNull();
      expect(b.upgradeEndTime).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 解锁系统
  // ═══════════════════════════════════════════
  describe('解锁系统', () => {
    it('主城Lv2时解锁兵营', () => {
      const buildings = {} as Record<BuildingType, BuildingState>;
      for (const t of BUILDING_TYPES) buildings[t] = { type: t, level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null };
      buildings.castle = { type: 'castle', level: 2, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.farmland = { type: 'farmland', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.market = { type: 'market', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.mine = { type: 'mine', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.lumberMill = { type: 'lumberMill', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      sys.deserialize({ version: BUILDING_SAVE_VERSION, buildings });

      expect(sys.getBuilding('barracks').status).toBe('idle');
      expect(sys.getBuilding('barracks').level).toBe(1);
    });

    it('主城Lv3时解锁铁匠铺和书院', () => {
      const buildings = {} as Record<BuildingType, BuildingState>;
      for (const t of BUILDING_TYPES) buildings[t] = { type: t, level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null };
      buildings.castle = { type: 'castle', level: 3, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.farmland = { type: 'farmland', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.market = { type: 'market', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.mine = { type: 'mine', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.lumberMill = { type: 'lumberMill', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      buildings.barracks = { type: 'barracks', level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      sys.deserialize({ version: BUILDING_SAVE_VERSION, buildings });

      expect(sys.getBuilding('workshop').status).toBe('idle');
      expect(sys.getBuilding('academy').status).toBe('idle');
    });

    it('主城Lv5时解锁城墙', () => {
      sys.deserialize(makeSave({ castle: { level: 5 }, wall: { level: 0, status: 'locked' } }));
      expect(sys.getBuilding('wall').status).toBe('idle');
      expect(sys.getBuilding('wall').level).toBe(1);
    });

    it('checkUnlock 已解锁建筑返回 true', () => {
      expect(sys.checkUnlock('castle')).toBe(true);
      expect(sys.checkUnlock('farmland')).toBe(true);
    });

    it('checkUnlock 未解锁建筑返回 false', () => {
      expect(sys.checkUnlock('barracks')).toBe(false);
      expect(sys.checkUnlock('wall')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 升级计时 tick
  // ═══════════════════════════════════════════
  describe('tick', () => {
    it('升级完成后等级+1', () => {
      const cost = sys.startUpgrade('castle', RICH);
      mockNow(base, cost.timeSeconds * 1000 + 1);
      expect(sys.tick()).toContain('castle');
      expect(sys.getLevel('castle')).toBe(2);
    });

    it('升级完成后状态回到 idle', () => {
      const cost = sys.startUpgrade('castle', RICH);
      mockNow(base, cost.timeSeconds * 1000 + 1);
      sys.tick();
      expect(sys.getBuilding('castle').status).toBe('idle');
    });

    it('升级未完成时不改变等级', () => {
      sys.startUpgrade('castle', RICH);
      mockNow(base, 100);
      expect(sys.tick()).toHaveLength(0);
      expect(sys.getLevel('castle')).toBe(1);
    });

    it('主城升级完成后自动解锁新建筑', () => {
      const cost = sys.startUpgrade('castle', RICH);
      mockNow(base, cost.timeSeconds * 1000 + 1);
      sys.tick();
      // 主城 Lv2 解锁兵营
      expect(sys.getBuilding('barracks').status).toBe('idle');
      expect(sys.getBuilding('barracks').level).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 队列管理
  // ═══════════════════════════════════════════
  describe('队列管理', () => {
    it('主城 Lv1~5 时默认 1 个队列槽位', () => { expect(sys.getMaxQueueSlots()).toBe(1); });

    it('主城 Lv6~10 时 2 个队列槽位', () => {
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      expect(sys.getMaxQueueSlots()).toBe(2);
    });

    it('队列满时 isQueueFull=true', () => {
      expect(sys.isQueueFull()).toBe(false);
      sys.startUpgrade('castle', RICH);
      expect(sys.isQueueFull()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 产出计算
  // ═══════════════════════════════════════════
  describe('产出计算', () => {
    it('农田 Lv1 产出正确', () => {
      expect(sys.getProduction('farmland')).toBe(BUILDING_DEFS.farmland.levelTable[0].production);
    });

    it('指定等级产出正确', () => {
      expect(sys.getProduction('farmland', 5)).toBe(BUILDING_DEFS.farmland.levelTable[4].production);
    });

    it('Lv0 产出为 0', () => { expect(sys.getProduction('market', 0)).toBe(0); });

    it('主城 Lv1 加成为 0%，乘数 1.0', () => {
      expect(sys.getCastleBonusPercent()).toBe(0);
      expect(sys.getCastleBonusMultiplier()).toBe(1);
    });

    it('主城 Lv2 加成为 2%，乘数 1.02', () => {
      sys.deserialize(makeSave({ castle: { level: 2 } }));
      expect(sys.getCastleBonusPercent()).toBe(2);
      expect(sys.getCastleBonusMultiplier()).toBeCloseTo(1.02);
    });

    it('calculateTotalProduction 汇总非主城建筑产出', () => {
      const total = sys.calculateTotalProduction();
      expect(total.grain).toBe(0.8);
      expect(total.gold).toBeCloseTo(0.6);
      expect(total.ore).toBeCloseTo(0.8);
      expect(total.wood).toBeCloseTo(0.8);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 特殊属性
  // ═══════════════════════════════════════════
  describe('特殊属性', () => {
    it('城墙未解锁时城防值为 0', () => { expect(sys.getWallDefense()).toBe(0); });

    it('城墙 Lv1 城防值正确', () => {
      sys.deserialize(makeSave({}));
      expect(sys.getWallDefense()).toBe(BUILDING_DEFS.wall.levelTable[0].specialValue);
    });

    it('getAppearanceStage 按等级返回正确阶段', () => {
      expect(sys.getAppearanceStage('castle')).toBe('humble');
      sys.deserialize(makeSave({ castle: { level: 6 } }));
      expect(sys.getAppearanceStage('castle')).toBe('orderly');
    });

    it('医馆恢复速率正确', () => {
      sys.deserialize(makeSave({}));
      expect(sys.getClinicRecoveryRate()).toBe(BUILDING_DEFS.clinic.levelTable[0].production);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('往返一致', () => {
      const original = sys.serialize();
      const sys2 = new BuildingSystem();
      sys2.deserialize(original);
      const restored = sys2.serialize();
      for (const t of BUILDING_TYPES) {
        expect(restored.buildings[t].level).toBe(original.buildings[t].level);
        expect(restored.buildings[t].status).toBe(original.buildings[t].status);
      }
    });

    it('离线期间升级完成处理', () => {
      const cost = sys.startUpgrade('castle', RICH);
      const saved = sys.serialize();
      mockNow(base, cost.timeSeconds * 1000 + 10000);
      const sys2 = new BuildingSystem();
      sys2.deserialize(saved);
      expect(sys2.getLevel('castle')).toBe(2);
      expect(sys2.getBuilding('castle').status).toBe('idle');
      expect(sys2.getUpgradeQueue()).toHaveLength(0);
    });

    it('离线期间升级未完成时恢复队列', () => {
      sys.startUpgrade('castle', RICH);
      const saved = sys.serialize();
      mockNow(base, 1000);
      const sys2 = new BuildingSystem();
      sys2.deserialize(saved);
      expect(sys2.getBuilding('castle').status).toBe('upgrading');
      expect(sys2.getUpgradeQueue()).toHaveLength(1);
    });

    it('版本不匹配时仍能加载（打印警告）', () => {
      const spy = vi.spyOn(gameLog, 'warn').mockImplementation(() => {});
      sys.deserialize({ version: 999, buildings: makeSave().buildings });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════
  // 11. getUpgradeCost
  // ═══════════════════════════════════════════
  describe('getUpgradeCost', () => {
    it('主城 Lv1→2 费用正确', () => {
      const cost = sys.getUpgradeCost('castle')!;
      const e = BUILDING_DEFS.castle.levelTable[1].upgradeCost;
      expect(cost.grain).toBe(e.grain);
      expect(cost.gold).toBe(e.gold);
    });

    it('满级建筑返回 null', () => {
      const buildings = {} as Record<BuildingType, BuildingState>;
      for (const t of BUILDING_TYPES) buildings[t] = { type: t, level: BUILDING_MAX_LEVELS[t], status: 'idle', upgradeStartTime: null, upgradeEndTime: null };
      sys.deserialize({ version: BUILDING_SAVE_VERSION, buildings });
      expect(sys.getUpgradeCost('castle')).toBeNull();
    });

    it('未解锁建筑（Lv0）返回 null', () => { expect(sys.getUpgradeCost('barracks')).toBeNull(); });
  });

  // ═══════════════════════════════════════════
  // 12. 升级进度与剩余时间
  // ═══════════════════════════════════════════
  describe('升级进度与剩余时间', () => {
    it('非升级状态进度为 0', () => {
      expect(sys.getUpgradeProgress('castle')).toBe(0);
      expect(sys.getUpgradeRemainingTime('castle')).toBe(0);
    });

    it('升级中进度在 0~1 之间', () => {
      const cost = sys.startUpgrade('castle', RICH);
      mockNow(base, (cost.timeSeconds * 1000) / 2);
      const p = sys.getUpgradeProgress('castle');
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });

    it('升级完成时进度为 1', () => {
      const cost = sys.startUpgrade('castle', RICH);
      mockNow(base, cost.timeSeconds * 1000);
      expect(sys.getUpgradeProgress('castle')).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 13. reset
  // ═══════════════════════════════════════════
  describe('reset', () => {
    it('重置后恢复初始状态', () => {
      sys.startUpgrade('castle', RICH);
      sys.reset();
      expect(sys.getCastleLevel()).toBe(1);
      expect(sys.getBuilding('castle').status).toBe('idle');
      expect(sys.getUpgradeQueue()).toHaveLength(0);
      expect(sys.getBuilding('barracks').status).toBe('locked');
    });
  });

  // ═══════════════════════════════════════════
  // 14. ISubsystem 接口适配
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 属性为 building', () => { expect(sys.name).toBe('building'); });

    it('getState() 返回序列化数据', () => {
      const state = sys.getState() as BuildingSaveData;
      expect(state.version).toBe(BUILDING_SAVE_VERSION);
      expect(state.buildings.castle.level).toBe(1);
    });

    it('update() 内部调用 tick() 处理升级完成', () => {
      const cost = sys.startUpgrade('castle', RICH);
      mockNow(base, cost.timeSeconds * 1000 + 1);
      sys.update(0);
      expect(sys.getLevel('castle')).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 15. 等级映射 & isUnlocked
  // ═══════════════════════════════════════════
  describe('等级映射与解锁查询', () => {
    it('getBuildingLevels 返回所有建筑等级', () => {
      const levels = sys.getBuildingLevels();
      for (const t of BUILDING_TYPES) expect(levels[t]).toBe(sys.getLevel(t));
    });

    it('getProductionBuildingLevels 排除主城', () => {
      const levels = sys.getProductionBuildingLevels();
      expect(levels.castle).toBeUndefined();
      for (const t of BUILDING_TYPES) {
        if (t !== 'castle') expect(levels[t]).toBe(sys.getLevel(t));
      }
    });

    it('isUnlocked 已解锁建筑返回 true', () => {
      expect(sys.isUnlocked('castle')).toBe(true);
      expect(sys.isUnlocked('farmland')).toBe(true);
    });

    it('isUnlocked 未解锁建筑返回 false', () => {
      expect(sys.isUnlocked('barracks')).toBe(false);
    });
  });
});
