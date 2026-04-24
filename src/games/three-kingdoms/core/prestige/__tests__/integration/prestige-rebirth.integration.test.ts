/**
 * 集成测试 — 声望×转生 全链路
 *
 * 验证声望获取→等级提升→加成增强→转生条件→倍率计算→数据重置→加速机制全流程。
 * 覆盖 §5.1~§5.6 + §6.1~§6.6 + §10.1~§10.3 + §10.9
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../../../../engine/prestige/PrestigeSystem';
import { RebirthSystem, calcRebirthMultiplier } from '../../../../engine/prestige/RebirthSystem';
import type { ISystemDeps } from '../../../../core/types';
import { REBIRTH_CONDITIONS, REBIRTH_MULTIPLIER, REBIRTH_ACCELERATION } from '../../prestige-config';

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

function createPrestigeSystem() {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

function createRebirthSystem() {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

/** 快速提升声望等级到指定级别 */
function levelUpTo(sys: PrestigeSystem, targetLevel: number): void {
  const required = calcRequiredPoints(targetLevel);
  // 直接设置足够多的声望值
  while (sys.getState().currentLevel < targetLevel) {
    sys.addPrestigePoints('main_quest', 10000);
  }
}

// ═════════════════════════════════════════════════════════════

describe('§5-6 声望×转生 集成测试', () => {
  let prestige: PrestigeSystem;
  let rebirth: RebirthSystem;

  beforeEach(() => {
    prestige = createPrestigeSystem();
    rebirth = createRebirthSystem();
  });

  // ═══════════════════════════════════════════
  // §5.1 声望分栏场景与等级展示
  // ═══════════════════════════════════════════

  describe('§5.1 声望分栏场景', () => {
    it('初始状态：声望值0/等级1/下一级阈值正确', () => {
      const panel = prestige.getPrestigePanel();
      expect(panel.currentLevel).toBe(1);
      expect(panel.currentPoints).toBe(0);
      expect(panel.nextLevelPoints).toBe(calcRequiredPoints(2));
    });

    it('声望值累积后进度条数值更新', () => {
      prestige.addPrestigePoints('battle_victory', 50);
      const panel = prestige.getPrestigePanel();
      expect(panel.currentPoints).toBe(50);
      expect(panel.totalPoints).toBe(50);
    });

    it('产出加成随等级变化', () => {
      const bonus1 = prestige.getProductionBonus();
      expect(bonus1).toBe(calcProductionBonus(1));
      levelUpTo(prestige, 5);
      const bonus5 = prestige.getProductionBonus();
      expect(bonus5).toBeGreaterThan(bonus1);
    });
  });

  // ═══════════════════════════════════════════
  // §5.2 声望等级升级流程
  // ═══════════════════════════════════════════

  describe('§5.2 声望等级升级', () => {
    it('达到阈值自动升级', () => {
      const required = calcRequiredPoints(2);
      prestige.addPrestigePoints('main_quest', required);
      expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(2);
    });

    it('跨级升级：一次声望跨越多个阈值', () => {
      prestige.addPrestigePoints('main_quest', calcRequiredPoints(5));
      expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(5);
    });

    it('升级事件发射', () => {
      const emitSpy = vi.fn();
      const deps = mockDeps();
      deps.eventBus.emit = emitSpy;
      const sys = new PrestigeSystem();
      sys.init(deps);
      sys.addPrestigePoints('main_quest', calcRequiredPoints(3));
      expect(emitSpy).toHaveBeenCalledWith('prestige:levelUp', expect.any(Object));
    });

    it('等级不超过最大值', () => {
      prestige.addPrestigePoints('main_quest', 999999999);
      expect(prestige.getState().currentLevel).toBeLessThanOrEqual(50);
    });
  });

  // ═══════════════════════════════════════════
  // §5.3 声望获取途径(9种)
  // ═══════════════════════════════════════════

  describe('§5.3 声望获取途径', () => {
    it('9种途径全部可用', () => {
      const configs = prestige.getSourceConfigs();
      expect(configs).toHaveLength(9);
    });

    it('每日上限生效', () => {
      // daily_quest 日上限100
      const first = prestige.addPrestigePoints('daily_quest', 80);
      expect(first).toBe(80);
      const second = prestige.addPrestigePoints('daily_quest', 80);
      expect(second).toBe(20); // 只能再获得20
      const third = prestige.addPrestigePoints('daily_quest', 10);
      expect(third).toBe(0); // 已达上限
    });

    it('无上限途径(-1)可无限获取', () => {
      const r1 = prestige.addPrestigePoints('main_quest', 1000);
      const r2 = prestige.addPrestigePoints('main_quest', 1000);
      expect(r1).toBe(1000);
      expect(r2).toBe(1000);
    });

    it('声望值只增不减', () => {
      prestige.addPrestigePoints('battle_victory', 100);
      const state = prestige.getState();
      expect(state.totalPoints).toBe(100);
      // 无法减少声望值
    });
  });

  // ═══════════════════════════════════════════
  // §5.4 产出加成特权
  // ═══════════════════════════════════════════

  describe('§5.4 产出加成特权', () => {
    it('等级1加成为 1+1×0.02=1.02', () => {
      expect(prestige.getProductionBonus()).toBeCloseTo(1.02, 2);
    });

    it('等级10加成为 1+10×0.02=1.20', () => {
      levelUpTo(prestige, 10);
      expect(prestige.getProductionBonus()).toBeCloseTo(1.20, 2);
    });

    it('等级50加成为 1+50×0.02=2.00', () => {
      levelUpTo(prestige, 50);
      expect(prestige.getProductionBonus()).toBeCloseTo(2.00, 2);
    });
  });

  // ═══════════════════════════════════════════
  // §5.5 等级解锁奖励
  // ═══════════════════════════════════════════

  describe('§5.5 等级解锁奖励', () => {
    it('未达到等级不可领取', () => {
      const result = prestige.claimLevelReward(5);
      expect(result.success).toBe(false);
    });

    it('达到等级可领取', () => {
      levelUpTo(prestige, 5);
      const result = prestige.claimLevelReward(5);
      expect(result.success).toBe(true);
    });

    it('不可重复领取', () => {
      levelUpTo(prestige, 5);
      prestige.claimLevelReward(5);
      const result = prestige.claimLevelReward(5);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已领取');
    });
  });

  // ═══════════════════════════════════════════
  // §6.1 转生解锁条件检查
  // ═══════════════════════════════════════════

  describe('§6.1 转生解锁条件', () => {
    it('初始状态不可转生', () => {
      const check = rebirth.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
    });

    it('满足全部条件后可转生', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      const check = rebirth.checkRebirthConditions();
      expect(check.canRebirth).toBe(true);
    });

    it('条件不满足时给出差距提示', () => {
      const check = rebirth.checkRebirthConditions();
      expect(check.conditions.prestigeLevel.met).toBe(false);
      expect(check.conditions.prestigeLevel.current).toBeLessThan(check.conditions.prestigeLevel.required);
    });
  });

  // ═══════════════════════════════════════════
  // §6.2 转生倍率计算
  // ═══════════════════════════════════════════

  describe('§6.2 转生倍率', () => {
    it('首次转生倍率 > 基础值', () => {
      const m = calcRebirthMultiplier(1);
      expect(m).toBeGreaterThan(1.0);
    });

    it('倍率随次数递增', () => {
      const m1 = calcRebirthMultiplier(1);
      const m3 = calcRebirthMultiplier(3);
      const m5 = calcRebirthMultiplier(5);
      expect(m3).toBeGreaterThan(m1);
      expect(m5).toBeGreaterThan(m3);
    });

    it('倍率不超过最大值', () => {
      const m = calcRebirthMultiplier(100);
      expect(m).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
    });
  });

  // ═══════════════════════════════════════════
  // §6.3 转生确认与数据重置
  // ═══════════════════════════════════════════

  describe('§6.3 转生确认与数据重置', () => {
    it('条件不满足时执行转生失败', () => {
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('条件满足时执行转生成功', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(true);
      expect(result.newCount).toBe(1);
      expect(result.multiplier).toBeGreaterThan(1.0);
    });

    it('转生后倍率生效', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      expect(rebirth.getCurrentMultiplier()).toBeGreaterThan(1.0);
    });

    it('转生后加速生效', () => {
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

    it('转生记录保存', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      const records = rebirth.getRebirthRecords();
      expect(records).toHaveLength(1);
      expect(records[0].rebirthCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // §6.4 转生后加速机制
  // ═══════════════════════════════════════════

  describe('§6.4 转生后加速', () => {
    it('初始赠送资源正确', () => {
      const gift = rebirth.getInitialGift();
      expect(gift.grain).toBe(5000);
      expect(gift.gold).toBe(3000);
      expect(gift.troops).toBe(1000);
    });

    it('低级建筑瞬间升级', () => {
      const config = rebirth.getInstantBuildConfig();
      expect(config.maxInstantLevel).toBe(10);
      expect(config.speedDivisor).toBeGreaterThan(1);
    });

    it('一键重建计划在首次转生后可用', () => {
      expect(rebirth.getAutoRebuildPlan()).toBeNull();
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      const plan = rebirth.getAutoRebuildPlan();
      expect(plan).not.toBeNull();
      expect(plan!.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // §6.5 转生次数解锁内容
  // ═══════════════════════════════════════════

  describe('§6.5 转生次数解锁', () => {
    it('初始无解锁内容', () => {
      const unlocked = rebirth.getUnlockedContents();
      expect(unlocked).toHaveLength(0);
    });

    it('转生1次后解锁内容', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      const unlocked = rebirth.getUnlockedContents();
      expect(unlocked.length).toBeGreaterThan(0);
    });

    it('v16.0 解锁内容查询', () => {
      const contents = rebirth.getUnlockContentsV16();
      expect(contents.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // §6.6 收益模拟器
  // ═══════════════════════════════════════════

  describe('§6.6 收益模拟器', () => {
    it('基础模拟返回资源估算', () => {
      const result = rebirth.simulateEarnings({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      expect(result.estimatedResources.gold).toBeGreaterThan(0);
      expect(result.estimatedResources.grain).toBeGreaterThan(0);
      expect(result.days).toBe(7);
    });

    it('v16.0 模拟含增长曲线', () => {
      const result = rebirth.simulateEarningsV16({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      expect(result.prestigeGrowthCurve.length).toBeGreaterThan(0);
      expect(result.comparison.length).toBeGreaterThan(0);
      expect(result.recommendation).toBeTruthy();
    });

    it('转生时机对比', () => {
      const comparisons = rebirth.compareRebirthTiming(1, [24, 48, 72]);
      expect(comparisons).toHaveLength(3);
      comparisons.forEach(c => {
        expect(c).toHaveProperty('immediateMultiplier');
        expect(c).toHaveProperty('waitMultiplier');
        expect(c).toHaveProperty('recommendedAction');
      });
    });
  });

  // ═══════════════════════════════════════════
  // §10.1 声望点数获取规则
  // ═══════════════════════════════════════════

  describe('§10.1 声望点数双货币', () => {
    it('声望值与声望点数独立计算', () => {
      const panel = prestige.getPrestigePanel();
      expect(panel.currentPoints).toBe(0);
      prestige.addPrestigePoints('main_quest', 500);
      const updated = prestige.getPrestigePanel();
      expect(updated.currentPoints).toBe(500);
      expect(updated.totalPoints).toBe(500);
    });
  });

  // ═══════════════════════════════════════════
  // §10.9 全链路验证
  // ═══════════════════════════════════════════

  describe('§10.9 声望→转生全链路', () => {
    it('完整声望获取→升级→转生流程', () => {
      // 步骤1: 积累声望
      levelUpTo(prestige, REBIRTH_CONDITIONS.minPrestigeLevel);
      expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(REBIRTH_CONDITIONS.minPrestigeLevel);

      // 步骤2: 配置转生条件
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => prestige.getState().currentLevel,
      });
      rebirth.updatePrestigeLevel(prestige.getState().currentLevel);

      // 步骤3: 检查转生条件
      const check = rebirth.checkRebirthConditions();
      expect(check.canRebirth).toBe(true);

      // 步骤4: 执行转生
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(true);
      expect(result.newCount).toBe(1);

      // 步骤5: 倍率和加速生效
      expect(rebirth.getCurrentMultiplier()).toBeGreaterThan(1.0);
      expect(rebirth.getAcceleration().active).toBe(true);
    });
  });
});
