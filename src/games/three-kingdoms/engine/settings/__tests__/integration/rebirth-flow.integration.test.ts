/**
 * 集成测试 — 转生流程：条件/倍率/重置/加速/解锁/模拟器/存档
 *
 * 覆盖 §6.1~§6.6 + §10.3~§10.5 + v16.0深化
 * vitest · describe嵌套§编号 · it.skip未实现API
 *
 * R29: 将 mockDeps 替换为 createRealDeps()（基于真实引擎实例）
 *
 * @module engine/settings/__tests__/integration/rebirth-flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../../../prestige/RebirthSystem';
import { createRealDeps } from '../../../../test-utils/test-helpers';
import type { ISystemDeps } from '../../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_ACCELERATION,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
  REBIRTH_COOLDOWN_MS,
} from '../../../../core/prestige';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

/** 创建满足转生条件的RebirthSystem（含可注入的 nowProvider 用于模拟冷却） */
function createReadyRebirth(): RebirthSystem & { advanceTime: (ms: number) => void } {
  const sys = new RebirthSystem();
  sys.init(createRealDeps());
  let now = Date.now();
  const advanceTime = (ms: number) => { now += ms; };
  sys.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    nowProvider: () => now,
  });
  sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
  return Object.assign(sys, { advanceTime });
}

// ═════════════════════════════════════════════════════════════

describe('§6 转生流程 集成测试', () => {
  let rebirth: RebirthSystem;

  beforeEach(() => {
    rebirth = createReadyRebirth();
  });

  // ─── §6.1 转生条件检查 ──────────────────

  describe('§6.1 转生条件检查', () => {
    it('§6.1.1 全部满足后canRebirth为true', () => {
      expect(rebirth.checkRebirthConditions().canRebirth).toBe(true);
    });

    it('§6.1.2 条件详情含7项检查（含通关/成就链/冷却）', () => {
      expect(Object.keys(rebirth.checkRebirthConditions().conditions)).toHaveLength(7);
    });

    it('§6.1.3 每项条件含required/current/met（cooldown除外）', () => {
      const conditions = rebirth.checkRebirthConditions().conditions;
      for (const [key, c] of Object.entries(conditions)) {
        if (key === 'cooldown') {
          expect(c).toHaveProperty('met');
        } else {
          expect(c).toHaveProperty('required');
          expect(c).toHaveProperty('current');
          expect(c).toHaveProperty('met');
        }
      }
    });

    it('§6.1.4 声望等级不足时不满足', () => {
      const sys = new RebirthSystem();
      sys.init(createRealDeps());
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      });
      sys.updatePrestigeLevel(1);
      expect(sys.checkRebirthConditions().conditions.prestigeLevel.met).toBe(false);
    });

    it('§6.1.5 部分不满足时canRebirth为false', () => {
      const sys = new RebirthSystem();
      sys.init(createRealDeps());
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount - 1,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      expect(sys.checkRebirthConditions().canRebirth).toBe(false);
    });

    it('§6.1.6 初始状态不满足转生条件', () => {
      const sys = new RebirthSystem();
      sys.init(createRealDeps());
      expect(sys.checkRebirthConditions().canRebirth).toBe(false);
    });
  });

  // ─── §6.2 转生倍率计算 ──────────────────

  describe('§6.2 转生倍率计算', () => {
    it('§6.2.1 0次转生倍率1.0', () => {
      expect(calcRebirthMultiplier(0)).toBeCloseTo(1.0);
    });

    it('§6.2.2 首次转生倍率=base+perRebirth', () => {
      expect(calcRebirthMultiplier(1)).toBeCloseTo(REBIRTH_MULTIPLIER.base + REBIRTH_MULTIPLIER.perRebirth);
    });

    it('§6.2.3 倍率随次数递增', () => {
      const m1 = calcRebirthMultiplier(1);
      const m3 = calcRebirthMultiplier(3);
      const m5 = calcRebirthMultiplier(5);
      expect(m3).toBeGreaterThan(m1);
      expect(m5).toBeGreaterThan(m3);
    });

    it('§6.2.4 倍率不超过最大值', () => {
      expect(calcRebirthMultiplier(999)).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
    });

    it('§6.2.5 getNextMultiplier返回下一次倍率', () => {
      expect(rebirth.getNextMultiplier()).toBeCloseTo(calcRebirthMultiplier(1));
    });
  });

  // ─── §6.3 转生执行与数据重置 ─────────────

  describe('§6.3 转生执行与数据重置', () => {
    it('§6.3.1 执行转生返回成功', () => {
      expect(rebirth.executeRebirth().success).toBe(true);
    });

    it('§6.3.2 转生后次数+1', () => {
      rebirth.executeRebirth();
      expect(rebirth.getState().rebirthCount).toBe(1);
    });

    it('§6.3.3 转生后倍率更新', () => {
      const r = rebirth.executeRebirth();
      expect(rebirth.getCurrentMultiplier()).toBe(r.multiplier);
    });

    it('§6.3.4 转生记录添加', () => {
      rebirth.executeRebirth();
      const rec = rebirth.getRebirthRecords();
      expect(rec).toHaveLength(1);
      expect(rec[0].rebirthCount).toBe(1);
      expect(rec[0].timestamp).toBeGreaterThan(0);
    });

    it('§6.3.5 连续转生次数递增', () => {
      rebirth.executeRebirth();
      rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
      rebirth.executeRebirth();
      expect(rebirth.getState().rebirthCount).toBe(2);
      expect(rebirth.getRebirthRecords()).toHaveLength(2);
    });

    it('§6.3.6 转生重置回调被调用', () => {
      const cb = vi.fn();
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        onReset: cb,
      });
      rebirth.executeRebirth();
      expect(cb).toHaveBeenCalledWith(expect.arrayContaining([...REBIRTH_RESET_RULES]));
    });
  });

  // ─── §6.4 转生后加速 ─────────────────────

  describe('§6.4 转生后加速', () => {
    it('§6.4.1 转生后加速期激活', () => {
      rebirth.executeRebirth();
      const a = rebirth.getAcceleration();
      expect(a.active).toBe(true);
      expect(a.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    it('§6.4.2 加速期有效倍率含加速乘数', () => {
      rebirth.executeRebirth();
      const eff = rebirth.getEffectiveMultipliers();
      const base = rebirth.getCurrentMultiplier();
      expect(eff.resource).toBeCloseTo(base * REBIRTH_ACCELERATION.resourceMultiplier);
      expect(eff.buildSpeed).toBeCloseTo(base * REBIRTH_ACCELERATION.buildSpeedMultiplier);
    });

    it('§6.4.3 加速期resource倍率高于基础', () => {
      rebirth.executeRebirth();
      expect(rebirth.getEffectiveMultipliers().resource).toBeGreaterThan(rebirth.getCurrentMultiplier());
    });

    it('§6.4.4 加速期exp倍率高于基础', () => {
      rebirth.executeRebirth();
      expect(rebirth.getEffectiveMultipliers().exp).toBeGreaterThan(rebirth.getCurrentMultiplier());
    });
  });

  // ─── §6.5 转生次数解锁内容 ──────────────

  describe('§6.5 转生次数解锁内容', () => {
    it('§6.5.1 解锁内容列表不为空', () => {
      expect(rebirth.getUnlockContents().length).toBeGreaterThan(0);
    });

    it('§6.5.2 初始无已解锁内容', () => {
      expect(rebirth.getUnlockedContents()).toHaveLength(0);
    });

    it('§6.5.3 转生1次后解锁首个内容', () => {
      rebirth.executeRebirth();
      expect(rebirth.getUnlockedContents().length).toBeGreaterThan(0);
    });

    it('§6.5.4 v16解锁内容含天命系统', () => {
      const c = rebirth.getUnlockContentsV16().find(x => x.unlockId === 'mandate_system');
      expect(c).toBeDefined();
      expect(c!.requiredRebirthCount).toBe(1);
    });

    it('§6.5.5 isFeatureUnlocked正确判断', () => {
      expect(rebirth.isFeatureUnlocked('mandate_system')).toBe(false);
      rebirth.executeRebirth();
      expect(rebirth.isFeatureUnlocked('mandate_system')).toBe(true);
    });
  });

  // ─── §6.6 收益模拟器 ─────────────────────

  describe('§6.6 收益模拟器', () => {
    const simParams = { currentPrestigeLevel: 20, currentRebirthCount: 0, dailyOnlineHours: 4, simulateDays: 7 };

    it('§6.6.1 返回估算资源', () => {
      const r = rebirth.simulateEarnings(simParams);
      expect(r.estimatedResources.gold).toBeGreaterThan(0);
      expect(r.estimatedResources.grain).toBeGreaterThan(0);
    });

    it('§6.6.2 返回声望估算', () => {
      expect(rebirth.simulateEarnings(simParams).estimatedPrestigeGain).toBeGreaterThan(0);
    });

    it('§6.6.3 v16含增长曲线', () => {
      expect(rebirth.simulateEarningsV16(simParams).prestigeGrowthCurve).toHaveLength(8);
    });

    it('§6.6.4 v16含推荐建议', () => {
      expect(rebirth.simulateEarningsV16(simParams).recommendation).toBeTruthy();
    });
  });

  // ─── §10.3 转生回滚保护 ──────────────────

  describe('§10.3 转生回滚保护', () => {
    it('§10.3.1 条件不满足执行转生返回失败', () => {
      const sys = new RebirthSystem();
      sys.init(createRealDeps());
      const r = sys.executeRebirth();
      expect(r.success).toBe(false);
      expect(r.reason).toBeTruthy();
    });

    it('§10.3.2 条件不满足时次数不变', () => {
      const sys = new RebirthSystem();
      sys.init(createRealDeps());
      sys.executeRebirth();
      expect(sys.getState().rebirthCount).toBe(0);
    });

    it('§10.3.3 条件不满足时倍率不变', () => {
      const sys = new RebirthSystem();
      sys.init(createRealDeps());
      const before = sys.getCurrentMultiplier();
      sys.executeRebirth();
      expect(sys.getCurrentMultiplier()).toBe(before);
    });
  });

  // ─── §10.5 保留/重置规则 ──────────────────

  describe('§10.5 保留/重置规则', () => {
    it('§10.5.1 保留规则完整', () => {
      const rules = rebirth.getKeepRules();
      expect(rules).toContain('keep_heroes');
      expect(rules).toContain('keep_prestige');
      expect(rules).toContain('keep_achievements');
    });

    it('§10.5.2 重置规则完整', () => {
      const rules = rebirth.getResetRules();
      expect(rules).toContain('reset_buildings');
      expect(rules).toContain('reset_resources');
      expect(rules).toContain('reset_map_progress');
    });
  });

  // ─── v16.0 转生深化 ──────────────────────

  describe('v16.0 转生深化', () => {
    it('转生初始赠送含粮草和铜钱', () => {
      const gift = rebirth.getInitialGift();
      expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
      expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
    });

    it('瞬间建筑配置正确', () => {
      expect(rebirth.getInstantBuildConfig().maxInstantLevel).toBe(REBIRTH_INSTANT_BUILD.maxInstantLevel);
    });

    it('低级建筑升级时间大幅缩短', () => {
      rebirth.executeRebirth();
      expect(rebirth.calculateBuildTime(600, 5)).toBeLessThan(600);
    });

    it('一键重建计划转生后可用', () => {
      expect(rebirth.getAutoRebuildPlan()).toBeNull();
      rebirth.executeRebirth();
      expect(rebirth.getAutoRebuildPlan()).not.toBeNull();
    });
  });

  // ─── 存档恢复 ────────────────────────────

  describe('存档恢复', () => {
    it('加载后解锁内容状态正确', () => {
      rebirth.executeRebirth();
      rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
      rebirth.executeRebirth();
      const state = rebirth.getState();
      const r2 = new RebirthSystem();
      r2.init(createRealDeps());
      r2.loadSaveData({ rebirth: state });
      expect(r2.getState().rebirthCount).toBe(2);
    });

    it('多次转生记录完整保存', () => {
      rebirth.executeRebirth();
      rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
      rebirth.executeRebirth();
      rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
      rebirth.executeRebirth();
      const rec = rebirth.getRebirthRecords();
      expect(rec).toHaveLength(3);
      expect(rec[0].rebirthCount).toBe(1);
      expect(rec[2].rebirthCount).toBe(3);
    });

    it('重置回到初始状态', () => {
      rebirth.executeRebirth();
      rebirth.reset();
      expect(rebirth.getState().rebirthCount).toBe(0);
      expect(rebirth.getState().currentMultiplier).toBe(1.0);
    });
  });
});
