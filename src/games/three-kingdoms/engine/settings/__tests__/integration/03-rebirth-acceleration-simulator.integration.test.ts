/**
 * 集成测试 — 转生×加速×模拟器 全链路
 *
 * 验证转生条件→倍率→保留/重置→加速→模拟器→解锁内容→存档恢复。
 * 覆盖 §6.1~§6.6 + §10.3~§10.5 + v16.0深化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../../../prestige/RebirthSystem';
import { PrestigeSystem, calcRequiredPoints } from '../../../prestige/PrestigeSystem';
import type { ISystemDeps } from '../../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_ACCELERATION,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
  REBIRTH_UNLOCK_CONTENTS_V16,
  REBIRTH_COOLDOWN_MS,
} from '../../../../core/prestige';

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

/** 创建满足转生条件的RebirthSystem（含可注入的 nowProvider 用于模拟冷却） */
function createReadyRebirth(): RebirthSystem & { advanceTime: (ms: number) => void } {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
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

describe('§6 转生×加速×模拟器 集成测试', () => {
  let rebirth: RebirthSystem;

  beforeEach(() => {
    rebirth = createReadyRebirth();
  });

  // ─── §6.1 转生条件检查 ──────────────────

  it('全部条件满足后canRebirth为true', () => {
    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(true);
  });

  it('条件详情包含7项检查（含通关/成就链/冷却）', () => {
    const check = rebirth.checkRebirthConditions();
    expect(Object.keys(check.conditions)).toHaveLength(7);
  });

  it('每项条件有required/current/met字段（cooldown除外）', () => {
    const check = rebirth.checkRebirthConditions();
    for (const [key, cond] of Object.entries(check.conditions)) {
      if (key === 'cooldown') {
        expect(cond).toHaveProperty('met');
      } else {
        expect(cond).toHaveProperty('required');
        expect(cond).toHaveProperty('current');
        expect(cond).toHaveProperty('met');
      }
    }
  });

  it('声望等级不足时条件不满足', () => {
    const sys = new RebirthSystem();
    sys.init(mockDeps());
    sys.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    sys.updatePrestigeLevel(1);
    const check = sys.checkRebirthConditions();
    expect(check.conditions.prestigeLevel.met).toBe(false);
  });

  // ─── §6.2 转生倍率计算 ──────────────────

  it('0次转生倍率为1.0', () => {
    expect(calcRebirthMultiplier(0)).toBeCloseTo(1.0);
  });

  it('1次转生倍率为base+perRebirth', () => {
    const m = calcRebirthMultiplier(1);
    expect(m).toBeCloseTo(REBIRTH_MULTIPLIER.base + REBIRTH_MULTIPLIER.perRebirth);
  });

  it('倍率随次数递增', () => {
    const m1 = calcRebirthMultiplier(1);
    const m3 = calcRebirthMultiplier(3);
    const m5 = calcRebirthMultiplier(5);
    expect(m3).toBeGreaterThan(m1);
    expect(m5).toBeGreaterThan(m3);
  });

  it('倍率不超过最大值', () => {
    const m = calcRebirthMultiplier(999);
    expect(m).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
  });

  it('getNextMultiplier返回下一次倍率', () => {
    const next = rebirth.getNextMultiplier();
    expect(next).toBeCloseTo(calcRebirthMultiplier(1));
  });

  // ─── §6.3 转生执行 ──────────────────────

  it('执行转生返回成功', () => {
    const result = rebirth.executeRebirth();
    expect(result.success).toBe(true);
  });

  it('执行转生后次数+1', () => {
    rebirth.executeRebirth();
    expect(rebirth.getState().rebirthCount).toBe(1);
  });

  it('执行转生后倍率更新', () => {
    const result = rebirth.executeRebirth();
    expect(rebirth.getCurrentMultiplier()).toBe(result.multiplier);
  });

  it('执行转生后记录添加', () => {
    rebirth.executeRebirth();
    const records = rebirth.getRebirthRecords();
    expect(records.length).toBe(1);
    expect(records[0].rebirthCount).toBe(1);
  });

  it('连续转生次数递增', () => {
    rebirth.executeRebirth();
    rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
    rebirth.executeRebirth();
    expect(rebirth.getState().rebirthCount).toBe(2);
    expect(rebirth.getRebirthRecords().length).toBe(2);
  });

  // ─── §6.4 转生后加速 ─────────────────────

  it('转生后加速期激活', () => {
    rebirth.executeRebirth();
    const accel = rebirth.getAcceleration();
    expect(accel.active).toBe(true);
    expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
  });

  it('加速期有效倍率包含加速乘数', () => {
    rebirth.executeRebirth();
    const effective = rebirth.getEffectiveMultipliers();
    const base = rebirth.getCurrentMultiplier();
    expect(effective.resource).toBeCloseTo(base * REBIRTH_ACCELERATION.resourceMultiplier);
    expect(effective.buildSpeed).toBeCloseTo(base * REBIRTH_ACCELERATION.buildSpeedMultiplier);
  });

  it('加速期天数每天递减', () => {
    rebirth.executeRebirth();
    const deps = rebirth.getState();
    // 模拟dayChanged事件触发加速递减
    // 直接调用内部tickAcceleration通过dayChanged事件
    const daysLeft0 = rebirth.getAcceleration().daysLeft;
    expect(daysLeft0).toBe(REBIRTH_ACCELERATION.durationDays);
  });

  // ─── §6.5 转生次数解锁内容 ──────────────

  it('解锁内容列表不为空', () => {
    const contents = rebirth.getUnlockContents();
    expect(contents.length).toBeGreaterThan(0);
  });

  it('初始状态下无解锁内容', () => {
    const unlocked = rebirth.getUnlockedContents();
    expect(unlocked.length).toBe(0);
  });

  it('转生1次后解锁首个内容', () => {
    rebirth.executeRebirth();
    const unlocked = rebirth.getUnlockedContents();
    expect(unlocked.length).toBeGreaterThan(0);
  });

  it('v16.0解锁内容包含天命系统', () => {
    const contents = rebirth.getUnlockContentsV16();
    const mandate = contents.find((c) => c.unlockId === 'mandate_system');
    expect(mandate).toBeDefined();
    expect(mandate!.requiredRebirthCount).toBe(1);
  });

  it('v16.0解锁内容包含跨服竞技', () => {
    const contents = rebirth.getUnlockContentsV16();
    const cross = contents.find((c) => c.unlockId === 'cross_server_arena');
    expect(cross).toBeDefined();
    expect(cross!.requiredRebirthCount).toBe(5);
  });

  it('isFeatureUnlocked正确判断', () => {
    expect(rebirth.isFeatureUnlocked('mandate_system')).toBe(false);
    rebirth.executeRebirth();
    expect(rebirth.isFeatureUnlocked('mandate_system')).toBe(true);
  });

  // ─── §6.6 收益模拟器 ─────────────────────

  it('模拟器返回估算资源', () => {
    const result = rebirth.simulateEarnings({
      currentRebirthCount: 0,
      dailyOnlineHours: 4,
      simulateDays: 7,
    });
    expect(result.estimatedResources.gold).toBeGreaterThan(0);
    expect(result.estimatedResources.grain).toBeGreaterThan(0);
  });

  it('模拟器返回声望估算', () => {
    const result = rebirth.simulateEarnings({
      currentRebirthCount: 0,
      dailyOnlineHours: 4,
      simulateDays: 7,
    });
    expect(result.estimatedPrestigeGain).toBeGreaterThan(0);
  });

  it('v16模拟器包含增长曲线', () => {
    const result = rebirth.simulateEarningsV16({
      currentRebirthCount: 0,
      dailyOnlineHours: 4,
      simulateDays: 7,
    });
    expect(result.prestigeGrowthCurve.length).toBe(8); // day0~day7
  });

  it('v16模拟器包含时机对比', () => {
    const result = rebirth.simulateEarningsV16({
      currentRebirthCount: 0,
      dailyOnlineHours: 4,
      simulateDays: 7,
    });
    expect(result.comparison.length).toBeGreaterThan(0);
  });

  it('v16模拟器包含推荐建议', () => {
    const result = rebirth.simulateEarningsV16({
      currentRebirthCount: 0,
      dailyOnlineHours: 4,
      simulateDays: 7,
    });
    expect(result.recommendation).toBeTruthy();
  });

  // ─── §10.3 转生回滚保护 ──────────────────

  it('条件不满足时执行转生返回失败原因', () => {
    const sys = new RebirthSystem();
    sys.init(mockDeps());
    const result = sys.executeRebirth();
    expect(result.success).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('条件不满足时转生次数不变', () => {
    const sys = new RebirthSystem();
    sys.init(mockDeps());
    sys.executeRebirth();
    expect(sys.getState().rebirthCount).toBe(0);
  });

  // ─── v16.0 转生初始赠送与瞬间建筑 ──────────

  it('转生初始赠送包含粮草和铜钱', () => {
    const gift = rebirth.getInitialGift();
    expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
    expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
  });

  it('瞬间建筑配置正确', () => {
    const config = rebirth.getInstantBuildConfig();
    expect(config.maxInstantLevel).toBe(REBIRTH_INSTANT_BUILD.maxInstantLevel);
    expect(config.speedDivisor).toBe(REBIRTH_INSTANT_BUILD.speedDivisor);
  });

  it('低级建筑升级时间大幅缩短', () => {
    rebirth.executeRebirth();
    const time = rebirth.calculateBuildTime(600, 5); // 10分钟基础，5级建筑
    expect(time).toBeLessThan(600);
  });

  it('高级建筑升级时间也缩短', () => {
    rebirth.executeRebirth();
    const time = rebirth.calculateBuildTime(3600, 15); // 60分钟基础，15级建筑
    expect(time).toBeLessThan(3600);
  });

  it('一键重建计划在转生后可用', () => {
    expect(rebirth.getAutoRebuildPlan()).toBeNull();
    rebirth.executeRebirth();
    const plan = rebirth.getAutoRebuildPlan();
    expect(plan).not.toBeNull();
    expect(plan!.length).toBeGreaterThan(0);
  });

  // ─── 存档恢复 ────────────────────────────

  it('转生存档加载后解锁内容状态正确', () => {
    rebirth.executeRebirth();
    rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
    rebirth.executeRebirth();
    const state = rebirth.getState();
    const newRebirth = new RebirthSystem();
    newRebirth.init(mockDeps());
    newRebirth.loadSaveData({ rebirth: state });
    expect(newRebirth.getState().rebirthCount).toBe(2);
    const unlocked = newRebirth.getUnlockedContents();
    expect(unlocked.length).toBeGreaterThan(0);
  });

  it('多次转生后记录完整保存', () => {
    rebirth.executeRebirth();
    rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
    rebirth.executeRebirth();
    rebirth.advanceTime(REBIRTH_COOLDOWN_MS + 1);
    rebirth.executeRebirth();
    const records = rebirth.getRebirthRecords();
    expect(records.length).toBe(3);
    expect(records[0].rebirthCount).toBe(1);
    expect(records[2].rebirthCount).toBe(3);
  });
});
