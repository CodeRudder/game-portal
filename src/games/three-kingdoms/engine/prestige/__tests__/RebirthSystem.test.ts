/**
 * RebirthSystem 单元测试
 *
 * 覆盖转生系统所有功能：
 * - #8 转生解锁条件
 * - #9 转生倍率公式
 * - #10 保留/重置规则
 * - #11 转生后加速
 * - #12 次数解锁内容
 * - #13 收益模拟器
 */

import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../RebirthSystem';
import type { ISystemDeps } from '../../../core/types';
import { REBIRTH_CONDITIONS, REBIRTH_MULTIPLIER, REBIRTH_ACCELERATION } from '../../../core/prestige';

// ─────────────────────────────────────────────
// 辅助工具
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

function createSystem(): RebirthSystem {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

/** 创建满足转生条件的系统 */
function createReadySystem(): { sys: RebirthSystem; resetFn: vi.Mock } {
  const sys = createSystem();
  const resetFn = vi.fn();
  sys.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    onReset: resetFn,
  });
  sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
  return { sys, resetFn };
}

// ═══════════════════════════════════════════════════════════

describe('RebirthSystem', () => {
  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════

  describe('ISubsystem', () => {
    test('name 为 rebirth', () => {
      const sys = createSystem();
      expect(sys.name).toBe('rebirth');
    });

    test('初始状态正确', () => {
      const sys = createSystem();
      const state = sys.getState();
      expect(state.rebirthCount).toBe(0);
      expect(state.currentMultiplier).toBe(1.0);
      expect(state.rebirthRecords).toHaveLength(0);
      expect(state.accelerationDaysLeft).toBe(0);
    });

    test('reset 恢复初始状态', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      expect(sys.getState().rebirthCount).toBeGreaterThan(0);
      sys.reset();
      expect(sys.getState().rebirthCount).toBe(0);
      expect(sys.getState().currentMultiplier).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 转生倍率公式 (#9)
  // ═══════════════════════════════════════════

  describe('转生倍率公式', () => {
    test('calcRebirthMultiplier: 0次 → base', () => {
      expect(calcRebirthMultiplier(0)).toBeCloseTo(REBIRTH_MULTIPLIER.base);
    });

    test('calcRebirthMultiplier: 1次 → base + perRebirth', () => {
      const expected = REBIRTH_MULTIPLIER.base + 1 * REBIRTH_MULTIPLIER.perRebirth;
      expect(calcRebirthMultiplier(1)).toBeCloseTo(expected);
    });

    test('calcRebirthMultiplier: 不超过 max', () => {
      // 给一个很大的次数 — 对数衰减曲线下高转生次数不会线性失控
      const result = calcRebirthMultiplier(999);
      expect(result).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
      // 对数曲线：count=999 时 multiplier ≈ base + perRebirth * ln(1000)/ln(2) ≈ 1 + 0.5*9.97 ≈ 5.98
      expect(result).toBeGreaterThan(REBIRTH_MULTIPLIER.base);
      expect(result).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
    });

    test('倍率随次数递增', () => {
      let prev = 0;
      for (let i = 0; i <= 20; i++) {
        const m = calcRebirthMultiplier(i);
        expect(m).toBeGreaterThanOrEqual(prev);
        prev = m;
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 转生解锁条件 (#8)
  // ═══════════════════════════════════════════

  describe('转生解锁条件', () => {
    test('不满足条件时不能转生', () => {
      const sys = createSystem();
      // 默认状态：声望等级1，不满足条件
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      expect(check.conditions.prestigeLevel.met).toBe(false);
    });

    test('部分条件满足仍不能转生', () => {
      const sys = createSystem();
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => 0, // 不满足
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      expect(check.conditions.heroCount.met).toBe(false);
    });

    test('全部条件满足可以转生', () => {
      const { sys } = createReadySystem();
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(true);
      expect(check.conditions.prestigeLevel.met).toBe(true);
      expect(check.conditions.castleLevel.met).toBe(true);
      expect(check.conditions.heroCount.met).toBe(true);
      expect(check.conditions.totalPower.met).toBe(true);
    });

    test('条件检查返回当前值和所需值', () => {
      const sys = createSystem();
      const check = sys.checkRebirthConditions();
      expect(check.conditions.prestigeLevel.current).toBe(1);
      expect(check.conditions.prestigeLevel.required).toBe(REBIRTH_CONDITIONS.minPrestigeLevel);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 执行转生 (#9, #10, #11)
  // ═══════════════════════════════════════════

  describe('执行转生', () => {
    test('条件不满足时返回失败', () => {
      const sys = createSystem();
      const result = sys.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toBeDefined();
    });

    test('条件满足时成功转生', () => {
      const { sys } = createReadySystem();
      const result = sys.executeRebirth();
      expect(result.success).toBe(true);
      expect(result.newCount).toBe(1);
      expect(result.multiplier).toBeCloseTo(
        REBIRTH_MULTIPLIER.base + REBIRTH_MULTIPLIER.perRebirth,
      );
    });

    test('转生触发重置回调 (#10)', () => {
      const { sys, resetFn } = createReadySystem();
      sys.executeRebirth();
      expect(resetFn).toHaveBeenCalledTimes(1);
      expect(resetFn).toHaveBeenCalledWith(expect.arrayContaining(['reset_buildings']));
    });

    test('转生后加速天数生效 (#11)', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      expect(sys.getState().accelerationDaysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    test('转生记录被保存', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      expect(records).toHaveLength(1);
      expect(records[0].rebirthCount).toBe(1);
      expect(records[0].timestamp).toBeGreaterThan(0);
    });

    test('多次转生累计次数', () => {
      const { sys, resetFn } = createReadySystem();
      const result1 = sys.executeRebirth();
      expect(result1.newCount).toBe(1);

      // 第二次转生
      const result2 = sys.executeRebirth();
      expect(result2.newCount).toBe(2);
      expect(resetFn).toHaveBeenCalledTimes(2);
    });

    test('转生发射 completed 事件', () => {
      const deps = mockDeps();
      const emitSpy = vi.spyOn(deps.eventBus, 'emit');
      const sys = new RebirthSystem();
      sys.init(deps);
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

      sys.executeRebirth();
      expect(emitSpy).toHaveBeenCalledWith('rebirth:completed', expect.objectContaining({
        count: 1,
      }));
    });
  });

  // ═══════════════════════════════════════════
  // 5. 保留/重置规则 (#10)
  // ═══════════════════════════════════════════

  describe('保留/重置规则', () => {
    test('保留规则包含关键项', () => {
      const sys = createSystem();
      const rules = sys.getKeepRules();
      expect(rules).toContain('keep_heroes');
      expect(rules).toContain('keep_prestige');
      expect(rules).toContain('keep_achievements');
    });

    test('重置规则包含关键项', () => {
      const sys = createSystem();
      const rules = sys.getResetRules();
      expect(rules).toContain('reset_buildings');
      expect(rules).toContain('reset_resources');
    });

    test('返回副本而非引用', () => {
      const sys = createSystem();
      const rules1 = sys.getKeepRules();
      const rules2 = sys.getKeepRules();
      expect(rules1).not.toBe(rules2);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 转生后加速 (#11)
  // ═══════════════════════════════════════════

  describe('转生后加速', () => {
    test('初始无加速', () => {
      const sys = createSystem();
      const accel = sys.getAcceleration();
      expect(accel.active).toBe(false);
      expect(accel.daysLeft).toBe(0);
    });

    test('转生后加速激活', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const accel = sys.getAcceleration();
      expect(accel.active).toBe(true);
      expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    test('加速配置正确', () => {
      const sys = createSystem();
      const accel = sys.getAcceleration();
      expect(accel.config.buildSpeedMultiplier).toBe(REBIRTH_ACCELERATION.buildSpeedMultiplier);
      expect(accel.config.resourceMultiplier).toBe(REBIRTH_ACCELERATION.resourceMultiplier);
    });

    test('有效倍率含转生倍率叠加', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const mults = sys.getEffectiveMultipliers();
      const rebirthMult = sys.getCurrentMultiplier();
      // 加速期内: buildSpeed = rebirthMult * buildSpeedMultiplier
      expect(mults.buildSpeed).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.buildSpeedMultiplier);
      expect(mults.resource).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.resourceMultiplier);
      expect(mults.exp).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.expMultiplier);
    });

    test('每日tick减少加速天数', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const daysBefore = sys.getState().accelerationDaysLeft;

      // 模拟 calendar:dayChanged 事件
      const deps = mockDeps();
      const sys2 = new RebirthSystem();
      sys2.init(deps);
      sys2.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      sys2.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      sys2.executeRebirth();

      // 获取注册的 dayChanged 回调
      const onCalls = (deps.eventBus.on as vi.Mock).mock.calls;
      const dayChangedCall = onCalls.find((c: string[]) => c[0] === 'calendar:dayChanged');
      expect(dayChangedCall).toBeDefined();
      const dayChangedCb = dayChangedCall![1];

      dayChangedCb();
      expect(sys2.getState().accelerationDaysLeft).toBe(REBIRTH_ACCELERATION.durationDays - 1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 次数解锁内容 (#12)
  // ═══════════════════════════════════════════

  describe('次数解锁内容', () => {
    test('初始无解锁内容', () => {
      const sys = createSystem();
      const unlocked = sys.getUnlockedContents();
      expect(unlocked).toHaveLength(0);
    });

    test('解锁内容列表包含所有条目', () => {
      const sys = createSystem();
      const contents = sys.getUnlockContents();
      expect(contents.length).toBeGreaterThan(0);
    });

    test('转生1次解锁转生商店', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const unlocked = sys.getUnlockedContents();
      const hasShop = unlocked.some((c) => c.unlockId === 'rebirth_shop');
      expect(hasShop).toBe(true);
    });

    test('转生10次解锁帝王之路', () => {
      const { sys } = createReadySystem();
      for (let i = 0; i < 10; i++) {
        sys.executeRebirth();
      }
      const unlocked = sys.getUnlockedContents();
      expect(unlocked.some((c) => c.unlockId === 'emperor_road')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 收益模拟器 (#13)
  // ═══════════════════════════════════════════

  describe('收益模拟器', () => {
    test('返回估算结果', () => {
      const sys = createSystem();
      const result = sys.simulateEarnings({
        currentRebirthCount: 0,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      expect(result.estimatedResources.gold).toBeGreaterThan(0);
      expect(result.estimatedResources.grain).toBeGreaterThan(0);
      expect(result.estimatedPrestigeGain).toBeGreaterThan(0);
      expect(result.days).toBe(7);
    });

    test('更多在线时间收益更高', () => {
      const sys = createSystem();
      const r1 = sys.simulateEarnings({ currentRebirthCount: 0, simulateDays: 7, dailyOnlineHours: 2 });
      const r2 = sys.simulateEarnings({ currentRebirthCount: 0, simulateDays: 7, dailyOnlineHours: 8 });
      expect(r2.estimatedResources.gold).toBeGreaterThan(r1.estimatedResources.gold);
    });

    test('更多转生次数收益更高', () => {
      const sys = createSystem();
      const r1 = sys.simulateEarnings({ currentRebirthCount: 0, simulateDays: 7, dailyOnlineHours: 4 });
      const r2 = sys.simulateEarnings({ currentRebirthCount: 5, simulateDays: 7, dailyOnlineHours: 4 });
      expect(r2.estimatedResources.gold).toBeGreaterThan(r1.estimatedResources.gold);
    });

    test('加速期奖励不为零', () => {
      const sys = createSystem();
      const result = sys.simulateEarnings({ currentRebirthCount: 0, simulateDays: 7, dailyOnlineHours: 4 });
      expect(result.rebirthAccelerationBonus.gold).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 倍率相关 API
  // ═══════════════════════════════════════════

  describe('倍率 API', () => {
    test('初始倍率为 1.0', () => {
      const sys = createSystem();
      expect(sys.getCurrentMultiplier()).toBeCloseTo(1.0);
    });

    test('下一次预览倍率大于当前', () => {
      const { sys } = createReadySystem();
      const current = sys.getCurrentMultiplier();
      const next = sys.getNextMultiplier();
      expect(next).toBeGreaterThan(current);
    });

    test('转生后倍率更新', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      expect(sys.getCurrentMultiplier()).toBeCloseTo(
        REBIRTH_MULTIPLIER.base + REBIRTH_MULTIPLIER.perRebirth,
      );
    });
  });

  // ═══════════════════════════════════════════
  // 10. 存档
  // ═══════════════════════════════════════════

  describe('存档', () => {
    test('存档和读档一致', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const state = sys.getState();

      const newSys = createSystem();
      newSys.loadSaveData({ rebirth: state });
      const loaded = newSys.getState();

      expect(loaded.rebirthCount).toBe(state.rebirthCount);
      expect(loaded.currentMultiplier).toBeCloseTo(state.currentMultiplier);
      expect(loaded.rebirthRecords).toHaveLength(state.rebirthRecords.length);
    });
  });
});
