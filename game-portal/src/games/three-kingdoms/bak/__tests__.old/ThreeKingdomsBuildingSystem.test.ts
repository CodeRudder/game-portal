/**
 * ThreeKingdomsBuildingSystem 单元测试
 *
 * 覆盖建筑系统的所有 public 方法：
 *   - 初始状态
 *   - 费用查询（精确值 + 动态计算）
 *   - 产出计算（含主城加成）
 *   - 升级操作（校验链）
 *   - 升级计时器
 *   - 序列化/反序列化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ThreeKingdomsBuildingSystem,
  type BuildingType,
  type BuildingState,
  type Resources,
} from '../ThreeKingdomsBuildingSystem';

// ═══════════════════════════════════════════════════════════
// 辅助
// ═══════════════════════════════════════════════════════════

/** 创建 canAfford 回调 */
function makeCanAfford(available: Partial<Resources>): (cost: Partial<Resources>) => boolean {
  return (cost) => {
    for (const key of Object.keys(cost) as (keyof Resources)[]) {
      if ((cost[key] ?? 0) > (available[key] ?? 0)) return false;
    }
    return true;
  };
}

const ALWAYS_AFFORD = makeCanAfford({ food: Infinity, wood: Infinity, iron: Infinity, gold: Infinity });
const NEVER_AFFORD = () => false;

describe('ThreeKingdomsBuildingSystem', () => {
  let bs: ThreeKingdomsBuildingSystem;

  beforeEach(() => {
    bs = new ThreeKingdomsBuildingSystem();
  });

  // ═══════════════════════════════════════════════════════════
  // 初始状态
  // ═══════════════════════════════════════════════════════════

  describe('初始状态', () => {
    it('主城初始 Lv1', () => {
      expect(bs.getBuilding('castle').level).toBe(1);
    });

    it('农田初始 Lv1', () => {
      expect(bs.getBuilding('farm').level).toBe(1);
    });

    it('其余建筑初始 Lv0', () => {
      const types: BuildingType[] = ['market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'];
      for (const type of types) {
        expect(bs.getBuilding(type).level).toBe(0);
      }
    });

    it('所有建筑初始不在升级中', () => {
      for (const b of bs.getAllBuildings()) {
        expect(b.isUpgrading).toBe(false);
        expect(b.upgradeStartTime).toBe(0);
        expect(b.upgradeDuration).toBe(0);
      }
    });

    it('getAllBuildings 应返回 8 座建筑', () => {
      expect(bs.getAllBuildings()).toHaveLength(8);
    });

    it('getCastleLevel 初始为 1', () => {
      expect(bs.getCastleLevel()).toBe(1);
    });

    it('getCastleBonusPercent Lv1 时为 0', () => {
      expect(bs.getCastleBonusPercent()).toBe(0);
    });

    it('getMaxLevel 正确', () => {
      expect(bs.getMaxLevel('castle')).toBe(30);
      expect(bs.getMaxLevel('farm')).toBe(25);
      expect(bs.getMaxLevel('market')).toBe(25);
      expect(bs.getMaxLevel('barracks')).toBe(25);
      expect(bs.getMaxLevel('smithy')).toBe(20);
      expect(bs.getMaxLevel('academy')).toBe(20);
      expect(bs.getMaxLevel('clinic')).toBe(20);
      expect(bs.getMaxLevel('wall')).toBe(20);
    });

    it('getUnlockCastleLevel 正确映射', () => {
      expect(bs.getUnlockCastleLevel('castle')).toBe(1);
      expect(bs.getUnlockCastleLevel('farm')).toBe(1);
      expect(bs.getUnlockCastleLevel('market')).toBe(2);
      expect(bs.getUnlockCastleLevel('barracks')).toBe(2);
      expect(bs.getUnlockCastleLevel('smithy')).toBe(3);
      expect(bs.getUnlockCastleLevel('academy')).toBe(3);
      expect(bs.getUnlockCastleLevel('clinic')).toBe(4);
      expect(bs.getUnlockCastleLevel('wall')).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 费用查询 — 精确值
  // ═══════════════════════════════════════════════════════════

  describe('getUpgradeCost() — 精确值', () => {
    it('主城 Lv1→2: food=200, gold=150', () => {
      const cost = bs.getUpgradeCost('castle', 2);
      expect(cost.food).toBe(200);
      expect(cost.gold).toBe(150);
      expect(cost.iron).toBeUndefined();
    });

    it('主城 Lv2→3: food=500, gold=400, iron=50', () => {
      const cost = bs.getUpgradeCost('castle', 3);
      expect(cost.food).toBe(500);
      expect(cost.gold).toBe(400);
      expect(cost.iron).toBe(50);
    });

    it('主城 Lv9→10: food=40000, gold=32000, iron=8000', () => {
      const cost = bs.getUpgradeCost('castle', 10);
      expect(cost.food).toBe(40000);
      expect(cost.gold).toBe(32000);
      expect(cost.iron).toBe(8000);
    });

    it('农田 Lv1→2: food=100, gold=50', () => {
      const cost = bs.getUpgradeCost('farm', 2);
      expect(cost.food).toBe(100);
      expect(cost.gold).toBe(50);
      expect(cost.iron).toBeUndefined();
    });

    it('农田 Lv4→5: food=1000, gold=500', () => {
      const cost = bs.getUpgradeCost('farm', 5);
      expect(cost.food).toBe(1000);
      expect(cost.gold).toBe(500);
    });

    it('市集 Lv1→2: food=80, gold=100', () => {
      const cost = bs.getUpgradeCost('market', 2);
      expect(cost.food).toBe(80);
      expect(cost.gold).toBe(100);
    });

    it('兵营 Lv1→2: food=120, gold=80', () => {
      const cost = bs.getUpgradeCost('barracks', 2);
      expect(cost.food).toBe(120);
      expect(cost.gold).toBe(80);
      expect(cost.iron).toBeUndefined();
    });

    it('兵营 Lv4→5: food=1200, gold=800, iron=200', () => {
      const cost = bs.getUpgradeCost('barracks', 5);
      expect(cost.food).toBe(1200);
      expect(cost.gold).toBe(800);
      expect(cost.iron).toBe(200);
    });

    it('铁匠铺 Lv1→2: food=200, gold=300', () => {
      const cost = bs.getUpgradeCost('smithy', 2);
      expect(cost.food).toBe(200);
      expect(cost.gold).toBe(300);
    });

    it('书院 Lv1→2: food=150, gold=200', () => {
      const cost = bs.getUpgradeCost('academy', 2);
      expect(cost.food).toBe(150);
      expect(cost.gold).toBe(200);
    });

    it('医馆 Lv1→2: food=100, gold=150', () => {
      const cost = bs.getUpgradeCost('clinic', 2);
      expect(cost.food).toBe(100);
      expect(cost.gold).toBe(150);
    });

    it('城墙 Lv1→2: food=300, gold=200, iron=100', () => {
      const cost = bs.getUpgradeCost('wall', 2);
      expect(cost.food).toBe(300);
      expect(cost.gold).toBe(200);
      expect(cost.iron).toBe(100);
    });

    it('城墙 Lv2→3: food=800, gold=500, iron=250', () => {
      const cost = bs.getUpgradeCost('wall', 3);
      expect(cost.food).toBe(800);
      expect(cost.gold).toBe(500);
      expect(cost.iron).toBe(250);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 费用查询 — 动态计算
  // ═══════════════════════════════════════════════════════════

  describe('getUpgradeCost() — 动态计算', () => {
    it('农田 Lv5→6 应按 x1.8 乘数计算', () => {
      const cost = bs.getUpgradeCost('farm', 6);
      expect(cost.food).toBe(1800);
      expect(cost.gold).toBe(900);
    });

    it('农田 Lv10→11 应按 x1.6 乘数计算', () => {
      const cost = bs.getUpgradeCost('farm', 11);
      expect(cost.food).toBe(30236);
      expect(cost.gold).toBe(15119);
    });

    it('主城 Lv10→11 应按 x1.8 计算', () => {
      const cost = bs.getUpgradeCost('castle', 11);
      expect(cost.food).toBe(72000);
      expect(cost.gold).toBe(57600);
      expect(cost.iron).toBe(14400);
    });

    it('铁匠铺 Lv3→4 应按 x2.0 计算', () => {
      const cost = bs.getUpgradeCost('smithy', 4);
      expect(cost.food).toBe(1000);
      expect(cost.gold).toBe(1600);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 升级时间查询
  // ═══════════════════════════════════════════════════════════

  describe('getUpgradeTime()', () => {
    it('主城 Lv1→2: 10s', () => {
      expect(bs.getUpgradeTime('castle', 2)).toBe(10);
    });

    it('主城 Lv9→10: 7200s', () => {
      expect(bs.getUpgradeTime('castle', 10)).toBe(7200);
    });

    it('农田 Lv1→2: 5s', () => {
      expect(bs.getUpgradeTime('farm', 2)).toBe(5);
    });

    it('农田 Lv4→5: 60s', () => {
      expect(bs.getUpgradeTime('farm', 5)).toBe(60);
    });

    it('农田 Lv5→6 应按 x1.6 计算', () => {
      expect(bs.getUpgradeTime('farm', 6)).toBe(96);
    });

    it('兵营 Lv1→2: 8s', () => {
      expect(bs.getUpgradeTime('barracks', 2)).toBe(8);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 产出计算
  // ═══════════════════════════════════════════════════════════

  describe('getBuildingProduction()', () => {
    it('农田 Lv1 应产出 food', () => {
      const prod = bs.getBuildingProduction('farm', 1);
      expect(prod.food).toBeCloseTo(0.8, 2);
    });

    it('农田 Lv5 应正确计算', () => {
      const prod = bs.getBuildingProduction('farm', 5);
      expect(prod.food).toBeCloseTo(7.84, 2);
    });

    it('主城 Lv5 时农田 Lv5 应有 +8% 加成', () => {
      for (let i = 0; i < 4; i++) bs.completeUpgrade('castle');
      expect(bs.getCastleBonusPercent()).toBe(8);
      const prod = bs.getBuildingProduction('farm', 5);
      expect(prod.food).toBeCloseTo(8.4672, 2);
    });

    it('非产出建筑应返回空对象', () => {
      expect(bs.getBuildingProduction('castle', 5)).toEqual({});
      expect(bs.getBuildingProduction('barracks', 5)).toEqual({});
      expect(bs.getBuildingProduction('smithy', 5)).toEqual({});
      expect(bs.getBuildingProduction('academy', 5)).toEqual({});
      expect(bs.getBuildingProduction('clinic', 5)).toEqual({});
      expect(bs.getBuildingProduction('wall', 5)).toEqual({});
    });

    it('Lv0 应返回空对象', () => {
      expect(bs.getBuildingProduction('market', 0)).toEqual({});
    });

    it('市集 Lv1 应产出 gold', () => {
      const prod = bs.getBuildingProduction('market', 1);
      expect(prod.gold).toBeCloseTo(0.6, 2);
    });
  });

  describe('getTotalProduction()', () => {
    it('初始状态只有农田产出 food', () => {
      const total = bs.getTotalProduction();
      expect(total.food).toBeCloseTo(0.8, 2);
      expect(total.gold).toBe(0);
      expect(total.wood).toBe(0);
      expect(total.iron).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 主城加成
  // ═══════════════════════════════════════════════════════════

  describe('主城加成', () => {
    it('Lv1=0%, Lv2=2%, Lv5=8%, Lv10=18%', () => {
      expect(bs.getCastleBonusPercent()).toBe(0);
      bs.completeUpgrade('castle');
      expect(bs.getCastleBonusPercent()).toBe(2);
      bs.completeUpgrade('castle');
      bs.completeUpgrade('castle');
      bs.completeUpgrade('castle');
      expect(bs.getCastleBonusPercent()).toBe(8);
      for (let i = 0; i < 5; i++) bs.completeUpgrade('castle');
      expect(bs.getCastleBonusPercent()).toBe(18);
    });

    it('Lv30=58%', () => {
      for (let i = 0; i < 29; i++) bs.completeUpgrade('castle');
      expect(bs.getCastleLevel()).toBe(30);
      expect(bs.getCastleBonusPercent()).toBe(58);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 升级操作 — 校验链
  // ═══════════════════════════════════════════════════════════

  describe('upgradeBuilding()', () => {
    it('主城 Lv1→2 资源充足时应成功', () => {
      const result = bs.upgradeBuilding('castle', ALWAYS_AFFORD);
      expect(result.success).toBe(true);
      expect(bs.getBuilding('castle').isUpgrading).toBe(true);
    });

    it('资源不足时应失败', () => {
      const result = bs.upgradeBuilding('castle', NEVER_AFFORD);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('资源不足');
    });

    it('市集 Lv0→1 需要主城 Lv2', () => {
      const result = bs.upgradeBuilding('market', ALWAYS_AFFORD);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('主城 Lv2');
    });

    it('市集在主城 Lv2 后可升级', () => {
      bs.completeUpgrade('castle');
      const result = bs.upgradeBuilding('market', ALWAYS_AFFORD);
      expect(result.success).toBe(true);
    });

    it('建筑等级不能超过主城', () => {
      const result = bs.upgradeBuilding('farm', ALWAYS_AFFORD);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不能超过主城');
    });

    it('主城升级后农田可继续升', () => {
      bs.completeUpgrade('castle');
      const result = bs.upgradeBuilding('farm', ALWAYS_AFFORD);
      expect(result.success).toBe(true);
    });

    it('已在升级中不能重复升级', () => {
      bs.upgradeBuilding('castle', ALWAYS_AFFORD);
      const result = bs.upgradeBuilding('castle', ALWAYS_AFFORD);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('升级中');
    });

    it('达到最高等级后不能继续升级', () => {
      for (let i = 0; i < 20; i++) bs.completeUpgrade('wall');
      expect(bs.getBuilding('wall').level).toBe(20);
      const result = bs.upgradeBuilding('wall', ALWAYS_AFFORD);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('最高等级');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 升级计时器
  // ═══════════════════════════════════════════════════════════

  describe('升级计时器', () => {
    it('升级开始后 isUpgrading=true', () => {
      bs.upgradeBuilding('castle', ALWAYS_AFFORD);
      const state = bs.getBuilding('castle');
      expect(state.isUpgrading).toBe(true);
      expect(state.upgradeStartTime).toBeGreaterThan(0);
      expect(state.upgradeDuration).toBe(10);
    });

    it('getUpgradeRemainingTime 应返回剩余秒数', () => {
      bs.upgradeBuilding('castle', ALWAYS_AFFORD);
      const remaining = bs.getUpgradeRemainingTime('castle');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(10);
    });

    it('未升级的建筑 getUpgradeRemainingTime 返回 0', () => {
      expect(bs.getUpgradeRemainingTime('castle')).toBe(0);
    });

    it('completeUpgrade 后等级+1，计时器重置', () => {
      bs.upgradeBuilding('castle', ALWAYS_AFFORD);
      bs.completeUpgrade('castle');
      const state = bs.getBuilding('castle');
      expect(state.level).toBe(2);
      expect(state.isUpgrading).toBe(false);
      expect(state.upgradeStartTime).toBe(0);
      expect(state.upgradeDuration).toBe(0);
    });

    it('checkUpgradeCompletion 未到期不完成', () => {
      bs.upgradeBuilding('castle', ALWAYS_AFFORD);
      const completed = bs.checkUpgradeCompletion();
      expect(completed).toHaveLength(0);
      expect(bs.getBuilding('castle').isUpgrading).toBe(true);
    });

    it('checkUpgradeCompletion 到期后自动完成', () => {
      const state = (bs as any).buildings.get('castle');
      state.isUpgrading = true;
      state.upgradeStartTime = Date.now() - 20000;
      state.upgradeDuration = 10;

      const completed = bs.checkUpgradeCompletion();
      expect(completed).toContain('castle');
      expect(bs.getBuilding('castle').level).toBe(2);
      expect(bs.getBuilding('castle').isUpgrading).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 序列化 / 反序列化
  // ═══════════════════════════════════════════════════════════

  describe('serialize() / deserialize()', () => {
    it('serialize 应包含 8 座建筑', () => {
      const data = bs.serialize();
      expect(Object.keys(data.buildings)).toHaveLength(8);
    });

    it('serialize 初始数据正确', () => {
      const data = bs.serialize();
      expect(data.buildings.castle.level).toBe(1);
      expect(data.buildings.farm.level).toBe(1);
      expect(data.buildings.market.level).toBe(0);
    });

    it('deserialize 应恢复状态', () => {
      bs.completeUpgrade('castle');
      bs.completeUpgrade('farm');
      const saved = bs.serialize();

      const bs2 = new ThreeKingdomsBuildingSystem();
      bs2.deserialize(saved);
      expect(bs2.getBuilding('castle').level).toBe(2);
      expect(bs2.getBuilding('farm').level).toBe(2);
      expect(bs2.getBuilding('market').level).toBe(0);
    });

    it('deserialize null 不崩溃', () => {
      expect(() => bs.deserialize(null)).not.toThrow();
      expect(bs.getBuilding('castle').level).toBe(1);
    });

    it('deserialize 空对象不崩溃', () => {
      expect(() => bs.deserialize({})).not.toThrow();
    });

    it('deserialize 缺失建筑使用默认值', () => {
      bs.deserialize({ buildings: { castle: { level: 5 } } });
      expect(bs.getBuilding('castle').level).toBe(5);
      expect(bs.getBuilding('farm').level).toBe(1);
    });

    it('deserialize 非法等级修正', () => {
      bs.deserialize({
        buildings: {
          castle: { level: -1 },
          farm: { level: NaN },
        },
      });
      expect(bs.getBuilding('castle').level).toBe(1);
      expect(bs.getBuilding('farm').level).toBe(1);
    });

    it('round-trip 应一致', () => {
      bs.completeUpgrade('castle');
      bs.completeUpgrade('castle');
      bs.completeUpgrade('farm');
      const saved = bs.serialize();

      const bs2 = new ThreeKingdomsBuildingSystem();
      bs2.deserialize(saved);
      const saved2 = bs2.serialize();
      expect(saved.buildings.castle.level).toBe(saved2.buildings.castle.level);
      expect(saved.buildings.farm.level).toBe(saved2.buildings.farm.level);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // reset
  // ═══════════════════════════════════════════════════════════

  describe('reset()', () => {
    it('应恢复到初始状态', () => {
      bs.completeUpgrade('castle');
      bs.completeUpgrade('farm');
      bs.reset();
      expect(bs.getBuilding('castle').level).toBe(1);
      expect(bs.getBuilding('farm').level).toBe(1);
      expect(bs.getBuilding('market').level).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 资源死锁防护 — PRD BLD-5
  // ═══════════════════════════════════════════════════════════

  describe('资源死锁防护', () => {
    it('主城升级不需要 wood', () => {
      for (let lv = 2; lv <= 10; lv++) {
        const cost = bs.getUpgradeCost('castle', lv);
        expect(cost.wood).toBeUndefined();
      }
    });

    it('农田升级不需要 wood/iron', () => {
      for (let lv = 2; lv <= 5; lv++) {
        const cost = bs.getUpgradeCost('farm', lv);
        expect(cost.wood).toBeUndefined();
        expect(cost.iron).toBeUndefined();
      }
    });

    it('市集升级不需要 wood/iron', () => {
      for (let lv = 2; lv <= 5; lv++) {
        const cost = bs.getUpgradeCost('market', lv);
        expect(cost.wood).toBeUndefined();
        expect(cost.iron).toBeUndefined();
      }
    });

    it('铁匠铺升级不需要 wood', () => {
      const cost = bs.getUpgradeCost('smithy', 2);
      expect(cost.wood).toBeUndefined();
    });

    it('城墙升级消耗 iron 但不消耗 wood', () => {
      const cost = bs.getUpgradeCost('wall', 2);
      expect(cost.wood).toBeUndefined();
      expect(cost.iron).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 不可变性
  // ═══════════════════════════════════════════════════════════

  describe('不可变性', () => {
    it('getBuilding 返回副本，修改不影响内部', () => {
      const state = bs.getBuilding('castle');
      state.level = 99;
      expect(bs.getBuilding('castle').level).toBe(1);
    });
  });
});
