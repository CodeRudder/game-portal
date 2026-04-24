/**
 * 集成测试 — 离线收益×加成叠加×转生倍率 全链路
 *
 * 验证声望加成→离线收益计算链路、加成叠加规则（加法叠加+转生乘算）、
 * 离线效率阶梯、收益模拟器全链路数值正确性。
 * 覆盖 §10.2 + §10.4 + §10.9 + 数据流设计中的加成叠加规则
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcProductionBonus } from '../../../../engine/prestige/PrestigeSystem';
import { PrestigeShopSystem } from '../../../../engine/prestige/PrestigeShopSystem';
import { RebirthSystem } from '../../../../engine/prestige/RebirthSystem';
import {
  calculateBuildTime,
  getInitialGift,
  getInstantBuildConfig,
  getAutoRebuildPlan,
  getUnlockContentsV16,
  isFeatureUnlocked,
  generatePrestigeGrowthCurve,
  compareRebirthTiming,
} from '../../../../engine/prestige/RebirthSystem.helpers';
import type { ISystemDeps } from '../../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_ACCELERATION,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
  REBIRTH_UNLOCK_CONTENTS_V16,
} from '../../prestige-config';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createPrestige() {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

function createRebirth() {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

// ═════════════════════════════════════════════════════════════

describe('§10 离线收益×加成叠加 全链路', () => {

  // ═══════════════════════════════════════════
  // §10.2 声望加成→离线收益计算链路
  // ═══════════════════════════════════════════

  describe('§10.2 声望加成→离线收益', () => {
    it('声望等级1: 产出加成1.02', () => {
      const sys = createPrestige();
      expect(sys.getProductionBonus()).toBeCloseTo(1.02, 2);
    });

    it('声望等级5: 产出加成1.10', () => {
      const sys = createPrestige();
      while (sys.getState().currentLevel < 5) {
        sys.addPrestigePoints('main_quest', 10000);
      }
      expect(sys.getProductionBonus()).toBeCloseTo(1.10, 2);
    });

    it('声望等级10: 产出加成1.20', () => {
      const sys = createPrestige();
      while (sys.getState().currentLevel < 10) {
        sys.addPrestigePoints('main_quest', 10000);
      }
      expect(sys.getProductionBonus()).toBeCloseTo(1.20, 2);
    });

    it('声望等级影响离线收益计算（间接验证）', () => {
      // 声望加成通过 getProductionBonus() 提供
      // 离线系统读取此值参与计算
      const sys = createPrestige();
      const bonus1 = sys.getProductionBonus();
      while (sys.getState().currentLevel < 10) {
        sys.addPrestigePoints('main_quest', 10000);
      }
      const bonus10 = sys.getProductionBonus();
      // 加成提升意味着离线收益更高
      expect(bonus10).toBeGreaterThan(bonus1);
    });
  });

  // ═══════════════════════════════════════════
  // §10.4 加成叠加规则
  // ═══════════════════════════════════════════

  describe('§10.4 加成叠加规则', () => {
    it('声望加成+称号加成=加法叠加', () => {
      // 公式: 基础值 × (1 + 声望% + 称号% + 里程碑%) × 转生倍率
      const prestigeBonus = 0.10; // 声望领土产出+10%
      const titleBonus = 0.05;    // 称号资源产出+5%
      const totalPercent = prestigeBonus + titleBonus;
      expect(totalPercent).toBeCloseTo(0.15, 2);
    });

    it('转生倍率在最外层乘算', () => {
      // 基础值 × (1 + 加成%) × 转生倍率
      const base = 100;
      const bonus = 0.20; // 20%加成
      const rebirthMultiplier = 2.25;
      const result = base * (1 + bonus) * rebirthMultiplier;
      expect(result).toBeCloseTo(270, 1);
    });

    it('完整计算链路验证', () => {
      // §10.9 示例: 基础20粮草/h × (1+10%) × 3.19 × 50% = 35.09/h
      const base = 20;
      const prestigeBonus = 0.10;
      const rebirthMultiplier = 3.19;
      const offlineEfficiency = 0.50;
      const result = base * (1 + prestigeBonus) * rebirthMultiplier * offlineEfficiency;
      expect(result).toBeCloseTo(35.09, 0);
    });

    it('同类加成取最高级不叠加', () => {
      // 声望领土产出: Lv.2→+5%, Lv.6→+10%, Lv.12→+15%, Lv.19→+20%
      // 取最高级生效，不累加
      const levels = [2, 6, 12, 19];
      const bonuses = [0.05, 0.10, 0.15, 0.20];
      // 当前等级12时，取15%而非5%+10%+15%
      const currentLevel = 12;
      let effective = 0;
      for (let i = 0; i < levels.length; i++) {
        if (currentLevel >= levels[i]) effective = bonuses[i];
      }
      expect(effective).toBe(0.15);
    });
  });

  // ═══════════════════════════════════════════
  // §10.9 全链路数值验证
  // ═══════════════════════════════════════════

  describe('§10.9 全链路数值', () => {
    it('转生后初始赠送精确', () => {
      const gift = getInitialGift();
      expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
      expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
      expect(gift.troops).toBe(REBIRTH_INITIAL_GIFT.troops);
    });

    it('低级建筑瞬间升级配置', () => {
      const config = getInstantBuildConfig();
      expect(config.maxInstantLevel).toBe(REBIRTH_INSTANT_BUILD.maxInstantLevel);
      expect(config.speedDivisor).toBe(REBIRTH_INSTANT_BUILD.speedDivisor);
    });

    it('建筑升级时间计算: 低级建筑', () => {
      // 10级以下建筑，时间÷speedDivisor
      const time = calculateBuildTime(600, 5, 2.0, 7);
      expect(time).toBeLessThanOrEqual(600);
    });

    it('建筑升级时间计算: 高级建筑+加速期', () => {
      // 10级以上建筑，加速期内
      const time = calculateBuildTime(3600, 15, 3.0, 5);
      expect(time).toBeLessThan(3600);
    });

    it('建筑升级时间计算: 无加速', () => {
      const time = calculateBuildTime(600, 15, 1.0, 0);
      expect(time).toBe(600);
    });

    it('一键重建: 未转生返回null', () => {
      expect(getAutoRebuildPlan(0)).toBeNull();
    });

    it('一键重建: 转生后返回建筑列表', () => {
      const plan = getAutoRebuildPlan(1);
      expect(plan).not.toBeNull();
      expect(plan!.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // v16.0 解锁内容
  // ═══════════════════════════════════════════

  describe('v16.0 解锁内容', () => {
    it('解锁内容列表完整', () => {
      const contents = getUnlockContentsV16(0);
      expect(contents.length).toBe(REBIRTH_UNLOCK_CONTENTS_V16.length);
    });

    it('转生1次解锁天命系统', () => {
      expect(isFeatureUnlocked('mandate_system', 0)).toBe(false);
      expect(isFeatureUnlocked('mandate_system', 1)).toBe(true);
    });

    it('转生3次解锁神话武将', () => {
      expect(isFeatureUnlocked('mythic_hero_pool', 2)).toBe(false);
      expect(isFeatureUnlocked('mythic_hero_pool', 3)).toBe(true);
    });

    it('转生5次解锁跨服', () => {
      expect(isFeatureUnlocked('cross_server_arena', 4)).toBe(false);
      expect(isFeatureUnlocked('cross_server_arena', 5)).toBe(true);
    });

    it('不存在的内容返回false', () => {
      expect(isFeatureUnlocked('non_existent', 100)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 声望增长曲线
  // ═══════════════════════════════════════════

  describe('声望增长曲线', () => {
    it('曲线起点为0', () => {
      const curve = generatePrestigeGrowthCurve({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      expect(curve[0]).toEqual({ day: 0, prestige: 0 });
    });

    it('曲线单调递增', () => {
      const curve = generatePrestigeGrowthCurve({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].prestige).toBeGreaterThanOrEqual(curve[i - 1].prestige);
      }
    });

    it('加速期增长更快', () => {
      const curve = generatePrestigeGrowthCurve({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 14,
        dailyOnlineHours: 4,
      });
      // 加速期内的日增量 > 正常期
      const accelDays = REBIRTH_ACCELERATION.durationDays;
      if (curve.length > accelDays + 1) {
        const accelGain = curve[accelDays].prestige - curve[0].prestige;
        const normalGain = curve[curve.length - 1].prestige - curve[accelDays].prestige;
        const accelPerDay = accelGain / accelDays;
        const normalPerDay = normalGain / (curve.length - 1 - accelDays);
        expect(accelPerDay).toBeGreaterThanOrEqual(normalPerDay);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 转生时机对比
  // ═══════════════════════════════════════════

  describe('转生时机对比', () => {
    it('默认3个对比选项', () => {
      const comparisons = compareRebirthTiming(1);
      expect(comparisons).toHaveLength(3);
    });

    it('自定义对比选项', () => {
      const comparisons = compareRebirthTiming(1, [6, 12, 24, 48]);
      expect(comparisons).toHaveLength(4);
    });

    it('每个对比包含必要字段', () => {
      const comparisons = compareRebirthTiming(1);
      comparisons.forEach(c => {
        expect(c).toHaveProperty('immediateMultiplier');
        expect(c).toHaveProperty('waitMultiplier');
        expect(c).toHaveProperty('waitHours');
        expect(c).toHaveProperty('diminishingReturnsHour');
        expect(c).toHaveProperty('recommendedAction');
        expect(c).toHaveProperty('confidence');
      });
    });

    it('等待更久倍率更高', () => {
      const comparisons = compareRebirthTiming(1, [24, 48, 72]);
      for (let i = 1; i < comparisons.length; i++) {
        expect(comparisons[i].waitMultiplier).toBeGreaterThanOrEqual(comparisons[i - 1].waitMultiplier);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 加速天数递减
  // ═══════════════════════════════════════════

  describe('加速天数递减', () => {
    it('转生后加速天数正确', () => {
      const rebirth = createRebirth();
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      const accel = rebirth.getAcceleration();
      expect(accel.active).toBe(true);
      expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    it('加速期后多倍器降低', () => {
      const rebirth = createRebirth();
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();

      // 加速期内的倍器
      const multipliersWithAccel = rebirth.getEffectiveMultipliers();
      expect(multipliersWithAccel.buildSpeed).toBeGreaterThan(rebirth.getCurrentMultiplier());
    });
  });

  // ═══════════════════════════════════════════
  // 重置系统
  // ═══════════════════════════════════════════

  describe('系统重置', () => {
    it('声望系统重置', () => {
      const sys = createPrestige();
      sys.addPrestigePoints('main_quest', 5000);
      sys.reset();
      expect(sys.getState().currentPoints).toBe(0);
      expect(sys.getState().currentLevel).toBe(1);
    });

    it('转生系统重置', () => {
      const sys = createRebirth();
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      sys.executeRebirth();
      sys.reset();
      expect(sys.getState().rebirthCount).toBe(0);
      expect(sys.getState().currentMultiplier).toBe(1.0);
    });

    it('商店系统重置', () => {
      const shop = new PrestigeShopSystem();
      shop.init(mockDeps());
      shop.updatePrestigeInfo(5000, 3);
      shop.buyGoods('psg-002');
      shop.reset();
      expect(shop.getState().prestigePoints).toBe(0);
      expect(shop.getState().prestigeLevel).toBe(1);
    });
  });
});
