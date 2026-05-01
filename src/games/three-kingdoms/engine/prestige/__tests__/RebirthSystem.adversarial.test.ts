/**
 * RebirthSystem 对抗式测试
 *
 * 五维度挑战覆盖：
 *   F-Normal: 转生条件检查、执行转生、倍率计算、加速效果
 *   F-Boundary: 转生次数边界、倍率上限、加速天数边界
 *   F-Error: 条件不满足时转生、无效回调
 *   F-Cross: 与PrestigeSystem联动、事件发射、存档交互
 *   F-Lifecycle: 转生记录持久化、加速效果衰减
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../RebirthSystem';
import type { ISystemDeps } from '../../../core/types';
import { REBIRTH_CONDITIONS, REBIRTH_ACCELERATION, REBIRTH_KEEP_RULES, REBIRTH_RESET_RULES } from '../../../core/prestige';

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

function createRebirthSystem(): RebirthSystem {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

/** 设置满足转生条件的回调 */
function setupMetConditions(sys: RebirthSystem, timeProvider?: () => number): void {
  sys.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
    achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
    ...(timeProvider ? { nowProvider: timeProvider } : {}),
  });
  sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
}

// ═══════════════════════════════════════════════════════════

describe('RebirthSystem 对抗式测试', () => {
  let sys: RebirthSystem;

  beforeEach(() => {
    sys = createRebirthSystem();
  });

  // ═══════════════════════════════════════════
  // F-Normal: 主线流程
  // ═══════════════════════════════════════════

  describe('[F-Normal] 转生执行', () => {
    it('满足条件时可以转生', () => {
      setupMetConditions(sys);
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(true);
    });

    it('转生成功返回正确数据', () => {
      setupMetConditions(sys);
      const result = sys.executeRebirth();
      expect(result.success).toBe(true);
      expect(result.newCount).toBe(1);
      expect(result.multiplier).toBeGreaterThan(1);
      expect(result.acceleration).toBeDefined();
    });

    it('转生后倍率增加', () => {
      setupMetConditions(sys);
      const before = sys.getCurrentMultiplier();
      sys.executeRebirth();
      const after = sys.getCurrentMultiplier();
      expect(after).toBeGreaterThan(before);
    });

    it('转生记录被正确保存', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      expect(records.length).toBe(1);
      expect(records[0].rebirthCount).toBe(1);
      expect(records[0].timestamp).toBeGreaterThan(0);
    });

    it('多次转生倍率递增', () => {
      let currentTime = Date.now();
      setupMetConditions(sys, () => currentTime);
      const COOLDOWN_MS = 72 * 60 * 60 * 1000;
      const multipliers: number[] = [];
      for (let i = 0; i < 5; i++) {
        sys.executeRebirth();
        multipliers.push(sys.getCurrentMultiplier());
        currentTime += COOLDOWN_MS + 1;
      }
      for (let i = 1; i < multipliers.length; i++) {
        expect(multipliers[i]).toBeGreaterThan(multipliers[i - 1]);
      }
    });

    it('转生后加速效果激活', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      const accel = sys.getAcceleration();
      expect(accel.active).toBe(true);
      expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    it('有效倍率含加速加成', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      const eff = sys.getEffectiveMultipliers();
      expect(eff.buildSpeed).toBeGreaterThan(1);
      expect(eff.resource).toBeGreaterThan(1);
      expect(eff.exp).toBeGreaterThan(1);
    });

    it('保留和重置规则正确', () => {
      expect(sys.getKeepRules()).toEqual([...REBIRTH_KEEP_RULES]);
      expect(sys.getResetRules()).toEqual([...REBIRTH_RESET_RULES]);
    });

    it('resetCallback被调用', () => {
      const resetCb = vi.fn();
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        onReset: resetCb,
        campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
        achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      sys.executeRebirth();
      expect(resetCb).toHaveBeenCalledWith([...REBIRTH_RESET_RULES]);
    });
  });

  // ═══════════════════════════════════════════
  // F-Boundary: 边界条件
  // ═══════════════════════════════════════════

  describe('[F-Boundary] 边界条件', () => {
    it('转生次数0时倍率为1', () => {
      expect(calcRebirthMultiplier(0)).toBe(1.0);
    });

    it('倍率不超过最大值10.0', () => {
      const mult = calcRebirthMultiplier(100);
      expect(mult).toBeLessThanOrEqual(10.0);
    });

    it('下一次转生倍率预览', () => {
      setupMetConditions(sys);
      const next = sys.getNextMultiplier();
      expect(next).toBeGreaterThan(1);
      sys.executeRebirth();
      expect(sys.getCurrentMultiplier()).toBe(next);
    });

    it('条件刚好满足（边界值）', () => {
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
        achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(true);
    });

    it('条件差1不满足', () => {
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel - 1,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
        achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      expect(check.conditions.castleLevel.met).toBe(false);
    });

    it('解锁内容按转生次数正确解锁', () => {
      let currentTime = Date.now();
      setupMetConditions(sys, () => currentTime);
      const COOLDOWN_MS = 72 * 60 * 60 * 1000;
      expect(sys.getUnlockedContents().length).toBe(0);

      sys.executeRebirth(); // count=1
      expect(sys.getUnlockedContents().length).toBeGreaterThanOrEqual(1);

      currentTime += COOLDOWN_MS + 1;
      sys.executeRebirth(); // count=2
      const contents = sys.getUnlockedContents();
      expect(contents.some(c => c.unlockId === 'hero_legend')).toBe(true);
    });

    it('加速天数衰减到0', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      expect(sys.getAcceleration().daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);

      // 模拟日变更
      const deps = mockDeps();
      const sys2 = new RebirthSystem();
      sys2.init(deps);
      setupMetConditions(sys2);
      sys2.executeRebirth();

      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const dayHandler = onCalls.find((c: string[]) => c[0] === 'calendar:dayChanged');

      if (dayHandler) {
        for (let i = 0; i < REBIRTH_ACCELERATION.durationDays; i++) {
          (dayHandler[1] as () => void)();
        }
        expect(sys2.getAcceleration().active).toBe(false);
        expect(sys2.getAcceleration().daysLeft).toBe(0);
      }
    });

    it('加速期结束后有效倍率不含加速', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      const withAccel = sys.getEffectiveMultipliers();

      // 手动清零加速
      const state = sys.getState();
      // 加速结束后（通过tick消耗完）
      // 使用新系统模拟
      const sys2 = createRebirthSystem();
      setupMetConditions(sys2);
      sys2.executeRebirth();
      // 直接加载一个无加速的状态
      sys2.loadSaveData({
        rebirth: {
          ...sys2.getState(),
          accelerationDaysLeft: 0,
        },
      });
      const withoutAccel = sys2.getEffectiveMultipliers();
      expect(withoutAccel.buildSpeed).toBeLessThan(withAccel.buildSpeed);
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 异常路径
  // ═══════════════════════════════════════════

  describe('[F-Error] 异常路径', () => {
    it('条件不满足时转生失败', () => {
      // 默认条件都不满足
      const result = sys.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('条件不满足');
    });

    it('条件检查时回调未设置', () => {
      // 没有设置回调，使用默认值0
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      expect(check.conditions.castleLevel.current).toBe(0);
    });

    it('部分条件不满足时给出具体原因', () => {
      sys.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => 0, // 不满足
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
        achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
      });
      sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      const result = sys.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('heroCount');
    });

    it('转生条件检查结果详细', () => {
      const check = sys.checkRebirthConditions();
      expect(check.conditions.prestigeLevel).toBeDefined();
      expect(check.conditions.castleLevel).toBeDefined();
      expect(check.conditions.heroCount).toBeDefined();
      expect(check.conditions.totalPower).toBeDefined();
      expect(check.conditions.campaignProgress).toBeDefined();
      expect(check.conditions.achievementChain).toBeDefined();
      expect(check.conditions.cooldown).toBeDefined();
      // 基础条件都有 required/current/met
      for (const key of ['prestigeLevel', 'castleLevel', 'heroCount', 'totalPower', 'campaignProgress'] as const) {
        const cond = check.conditions[key];
        expect(cond).toHaveProperty('required');
        expect(cond).toHaveProperty('current');
        expect(cond).toHaveProperty('met');
      }
      // achievementChain 有额外 chainId
      expect(check.conditions.achievementChain).toHaveProperty('chainId');
      // cooldown 有 remainingMs 和 description
      expect(check.conditions.cooldown).toHaveProperty('remainingMs');
      expect(check.conditions.cooldown).toHaveProperty('description');
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统交互
  // ═══════════════════════════════════════════

  describe('[F-Cross] 跨系统交互', () => {
    it('转生完成事件正确发射', () => {
      const deps = mockDeps();
      const sys2 = new RebirthSystem();
      sys2.init(deps);
      setupMetConditions(sys2);
      sys2.executeRebirth();
      expect(deps.eventBus.emit).toHaveBeenCalledWith('rebirth:completed', expect.objectContaining({
        count: 1,
        multiplier: expect.any(Number),
        acceleration: REBIRTH_ACCELERATION,
      }));
    });

    it('加速结束事件正确发射', () => {
      const deps = mockDeps();
      const sys2 = new RebirthSystem();
      sys2.init(deps);
      setupMetConditions(sys2);
      sys2.executeRebirth();

      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const dayHandler = onCalls.find((c: string[]) => c[0] === 'calendar:dayChanged');

      if (dayHandler) {
        for (let i = 0; i < REBIRTH_ACCELERATION.durationDays; i++) {
          (dayHandler[1] as () => void)();
        }
        expect(deps.eventBus.emit).toHaveBeenCalledWith('rebirth:accelerationEnded', expect.objectContaining({
          rebirthCount: 1,
        }));
      }
    });

    it('收益模拟器结果合理', () => {
      const result = sys.simulateEarnings({
        currentPrestigeLevel: 20,
        currentRebirthCount: 1,
        simulateDays: 30,
        dailyOnlineHours: 4,
      });
      expect(result.estimatedResources.gold).toBeGreaterThan(0);
      expect(result.estimatedResources.grain).toBeGreaterThan(0);
      expect(result.estimatedPrestigeGain).toBeGreaterThan(0);
      expect(result.days).toBe(30);
    });

    it('v16收益模拟器含增长曲线', () => {
      const result = sys.simulateEarningsV16({
        currentPrestigeLevel: 20,
        currentRebirthCount: 1,
        simulateDays: 30,
        dailyOnlineHours: 4,
      });
      expect(result.prestigeGrowthCurve.length).toBe(31); // day 0~30
      expect(result.comparison.length).toBeGreaterThan(0);
      expect(result.recommendation).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════
  // F-Lifecycle: 数据生命周期
  // ═══════════════════════════════════════════

  describe('[F-Lifecycle] 存档与加载', () => {
    it('存档数据完整', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      const state = sys.getState();
      expect(state.rebirthCount).toBe(1);
      expect(state.currentMultiplier).toBeGreaterThan(1);
      expect(state.rebirthRecords.length).toBe(1);
      expect(state.accelerationDaysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });

    it('加载存档恢复状态', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      const state = sys.getState();

      const sys2 = createRebirthSystem();
      sys2.loadSaveData({ rebirth: state });
      const loaded = sys2.getState();
      expect(loaded.rebirthCount).toBe(1);
      expect(loaded.currentMultiplier).toBe(state.currentMultiplier);
    });

    it('reset恢复初始状态', () => {
      setupMetConditions(sys);
      sys.executeRebirth();
      sys.reset();
      const state = sys.getState();
      expect(state.rebirthCount).toBe(0);
      expect(state.currentMultiplier).toBe(1.0);
      expect(state.rebirthRecords.length).toBe(0);
      expect(state.accelerationDaysLeft).toBe(0);
    });

    it('多次转生存档后加载完整', () => {
      let currentTime = Date.now();
      setupMetConditions(sys, () => currentTime);
      const COOLDOWN_MS = 72 * 60 * 60 * 1000;
      for (let i = 0; i < 3; i++) {
        sys.executeRebirth();
        currentTime += COOLDOWN_MS + 1;
      }
      const state = sys.getState();
      const sys2 = createRebirthSystem();
      sys2.loadSaveData({ rebirth: state });
      expect(sys2.getState().rebirthCount).toBe(3);
      expect(sys2.getState().rebirthRecords.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：转生倍率极限测试
  // ═══════════════════════════════════════════

  describe('[对抗] 转生倍率极限测试', () => {
    it('倍率曲线单调递增', () => {
      for (let i = 0; i < 20; i++) {
        expect(calcRebirthMultiplier(i + 1)).toBeGreaterThanOrEqual(calcRebirthMultiplier(i));
      }
    });

    it('高转生次数倍率不超过max', () => {
      for (let i = 0; i <= 100; i++) {
        expect(calcRebirthMultiplier(i)).toBeLessThanOrEqual(10.0);
      }
    });

    it('转生倍率计算公式一致性', () => {
      // calcRebirthMultiplier(1) 应该 > 1.0
      expect(calcRebirthMultiplier(1)).toBeGreaterThan(1.0);
      // calcRebirthMultiplier(0) = 1.0
      expect(calcRebirthMultiplier(0)).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：v16.0 深化功能
  // ═══════════════════════════════════════════

  describe('[对抗] v16.0 深化功能', () => {
    it('转生初始赠送内容正确', () => {
      const gift = sys.getInitialGift();
      expect(gift.grain).toBeGreaterThan(0);
      expect(gift.gold).toBeGreaterThan(0);
      expect(gift.troops).toBeGreaterThan(0);
    });

    it('瞬间建筑配置合理', () => {
      const config = sys.getInstantBuildConfig();
      expect(config.maxInstantLevel).toBeGreaterThan(0);
      expect(config.speedDivisor).toBeGreaterThan(1);
    });

    it('建筑升级时间计算', () => {
      // 注意：RebirthSystem.calculateBuildTime 只接受2个参数
      // 它使用内部 state.currentMultiplier 和 state.accelerationDaysLeft
      // 初始状态：multiplier=1.0, accelerationDaysLeft=0
      const initial = sys.calculateBuildTime(3600, 20);
      expect(initial).toBe(3600); // multiplier<=1.0, no acceleration

      // 低级建筑瞬间升级（需要 multiplier > 1.0）
      setupMetConditions(sys);
      sys.executeRebirth();
      // 执行转生后：multiplier > 1.0, accelerationDaysLeft > 0
      const fast = sys.calculateBuildTime(3600, 5);
      expect(fast).toBeLessThan(3600);

      // 高级建筑受倍率和加速影响
      const accelerated = sys.calculateBuildTime(3600, 20);
      expect(accelerated).toBeLessThan(3600);
    });

    it('一键重建计划在转生后可用', () => {
      expect(sys.getAutoRebuildPlan()).toBeNull();
      setupMetConditions(sys);
      sys.executeRebirth();
      expect(sys.getAutoRebuildPlan()).not.toBeNull();
      expect(sys.getAutoRebuildPlan()!.length).toBeGreaterThan(0);
    });

    it('v16解锁内容按转生次数解锁', () => {
      const contents = sys.getUnlockContentsV16();
      expect(contents.length).toBeGreaterThan(0);
      expect(contents.every(c => !c.unlocked)).toBe(true);

      setupMetConditions(sys);
      sys.executeRebirth();
      const after = sys.getUnlockContentsV16();
      expect(after.some(c => c.unlocked)).toBe(true);
    });

    it('isFeatureUnlocked检查', () => {
      expect(sys.isFeatureUnlocked('mandate_system')).toBe(false);
      setupMetConditions(sys);
      sys.executeRebirth();
      expect(sys.isFeatureUnlocked('mandate_system')).toBe(true);
      expect(sys.isFeatureUnlocked('non_existent')).toBe(false);
    });

    it('声望增长曲线从day 0开始', () => {
      const curve = sys.generatePrestigeGrowthCurve({
        currentPrestigeLevel: 1,
        currentRebirthCount: 0,
        simulateDays: 10,
        dailyOnlineHours: 4,
      });
      expect(curve[0]).toEqual({ day: 0, prestige: 0 });
      expect(curve.length).toBe(11);
    });

    it('转生时机对比提供推荐', () => {
      const comparisons = sys.compareRebirthTiming(0);
      expect(comparisons.length).toBe(3);
      for (const c of comparisons) {
        expect(c).toHaveProperty('recommendedAction');
        expect(c).toHaveProperty('confidence');
        expect(c.waitMultiplier).toBeGreaterThan(c.immediateMultiplier);
      }
    });
  });
});
