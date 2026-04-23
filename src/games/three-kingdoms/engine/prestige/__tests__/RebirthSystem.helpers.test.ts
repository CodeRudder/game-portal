/**
 * RebirthSystem v16.0 扩展 — 传承系统深化测试
 *
 * 覆盖：
 *   #18 转生后加速机制 — 初始资源赠送+低级建筑瞬间+一键重建
 *   #19 转生次数解锁内容 — 天命/专属科技/神话武将/跨服
 *   #20 收益模拟器深化 — 声望增长预测+推荐转生时机+倍率对比
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../RebirthSystem';
import type { ISystemDeps } from '../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_ACCELERATION,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
  REBIRTH_UNLOCK_CONTENTS_V16,
} from '../../../core/prestige';

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
    } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn(), set: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createSystem(): RebirthSystem {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

function createReadySystem(): { sys: RebirthSystem; resetFn: ReturnType<typeof vi.fn> } {
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

describe('RebirthSystem v16.0 传承系统深化', () => {
  // ═══════════════════════════════════════════
  // #18 转生后加速机制
  // ═══════════════════════════════════════════

  describe('#18 转生后加速机制', () => {
    it('获取初始资源赠送配置', () => {
      const sys = createSystem();
      const gift = sys.getInitialGift();
      expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
      expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
      expect(gift.troops).toBe(REBIRTH_INITIAL_GIFT.troops);
    });

    it('初始赠送粮草5000+铜钱3000', () => {
      const sys = createSystem();
      const gift = sys.getInitialGift();
      expect(gift.grain).toBe(5000);
      expect(gift.gold).toBe(3000);
    });

    it('获取低级建筑瞬间升级配置', () => {
      const sys = createSystem();
      const config = sys.getInstantBuildConfig();
      expect(config.maxInstantLevel).toBe(REBIRTH_INSTANT_BUILD.maxInstantLevel);
      expect(config.speedDivisor).toBe(REBIRTH_INSTANT_BUILD.speedDivisor);
    });

    it('低级建筑升级时间大幅缩短', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      // 10级以下建筑，基础时间3600秒
      const time = sys.calculateBuildTime(3600, 5);
      // 加速期内：3600 / speedDivisor = 360
      expect(time).toBeLessThan(3600);
    });

    it('高级建筑正常加速', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      // 15级建筑，基础时间36000秒
      const time = sys.calculateBuildTime(36000, 15);
      // 不在瞬间升级范围内，正常加速
      expect(time).toBeLessThan(36000);
      expect(time).toBeGreaterThan(0);
    });

    it('无加速时建筑升级时间不变', () => {
      const sys = createSystem();
      const time = sys.calculateBuildTime(3600, 5);
      // 无转生加速，倍率为1.0，无加速期
      expect(time).toBe(3600);
    });

    it('一键重建返回建筑优先级列表', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const plan = sys.getAutoRebuildPlan();
      expect(plan).toBeDefined();
      expect(plan).toContain('castle');
      expect(plan).toContain('farmland');
    });

    it('未转生时一键重建返回null', () => {
      const sys = createSystem();
      const plan = sys.getAutoRebuildPlan();
      expect(plan).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // #19 转生次数解锁内容 (v16.0)
  // ═══════════════════════════════════════════

  describe('#19 转生次数解锁内容', () => {
    it('初始无解锁内容', () => {
      const sys = createSystem();
      const unlocked = sys.getUnlockedContentsV16();
      expect(unlocked).toHaveLength(0);
    });

    it('解锁内容列表包含4项', () => {
      const sys = createSystem();
      const contents = sys.getUnlockContentsV16();
      expect(contents).toHaveLength(REBIRTH_UNLOCK_CONTENTS_V16.length);
    });

    it('转生1次解锁天命系统', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const unlocked = sys.getUnlockedContentsV16();
      expect(unlocked.some(c => c.unlockId === 'mandate_system')).toBe(true);
    });

    it('转生2次解锁专属科技路线', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      sys.executeRebirth();
      const unlocked = sys.getUnlockedContentsV16();
      expect(unlocked.some(c => c.unlockId === 'exclusive_tech')).toBe(true);
    });

    it('转生3次解锁神话武将招募池', () => {
      const { sys } = createReadySystem();
      for (let i = 0; i < 3; i++) sys.executeRebirth();
      const unlocked = sys.getUnlockedContentsV16();
      expect(unlocked.some(c => c.unlockId === 'mythic_hero_pool')).toBe(true);
    });

    it('转生5次解锁跨服竞技场', () => {
      const { sys } = createReadySystem();
      for (let i = 0; i < 5; i++) sys.executeRebirth();
      const unlocked = sys.getUnlockedContentsV16();
      expect(unlocked.some(c => c.unlockId === 'cross_server_arena')).toBe(true);
    });

    it('isFeatureUnlocked 正确检查功能解锁', () => {
      const sys = createSystem();
      expect(sys.isFeatureUnlocked('mandate_system')).toBe(false);

      const { sys: readySys } = createReadySystem();
      readySys.executeRebirth();
      expect(readySys.isFeatureUnlocked('mandate_system')).toBe(true);
      expect(readySys.isFeatureUnlocked('cross_server_arena')).toBe(false);
    });

    it('解锁内容标记 unlocked 状态', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const contents = sys.getUnlockContentsV16();
      const mandate = contents.find(c => c.unlockId === 'mandate_system');
      expect(mandate).toBeDefined();
      expect(mandate!.unlocked).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // #20 收益模拟器深化
  // ═══════════════════════════════════════════

  describe('#20 收益模拟器深化', () => {
    it('声望增长预测曲线包含正确天数', () => {
      const sys = createSystem();
      const curve = sys.generatePrestigeGrowthCurve({
        currentPrestigeLevel: 20,
        currentRebirthCount: 0,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      expect(curve).toHaveLength(8); // day 0 ~ day 7
      expect(curve[0].day).toBe(0);
      expect(curve[7].day).toBe(7);
    });

    it('声望增长曲线单调递增', () => {
      const sys = createSystem();
      const curve = sys.generatePrestigeGrowthCurve({
        currentPrestigeLevel: 20,
        currentRebirthCount: 1,
        simulateDays: 14,
        dailyOnlineHours: 4,
      });
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].prestige).toBeGreaterThan(curve[i - 1].prestige);
      }
    });

    it('倍率对比返回多个选项', () => {
      const sys = createSystem();
      const comparisons = sys.compareRebirthTiming(0);
      expect(comparisons.length).toBeGreaterThan(0);
    });

    it('倍率对比包含推荐行动', () => {
      const sys = createSystem();
      const comparisons = sys.compareRebirthTiming(0);
      for (const c of comparisons) {
        expect(['rebirth_now', 'wait', 'no_difference']).toContain(c.recommendedAction);
        expect(['high', 'medium', 'low']).toContain(c.confidence);
      }
    });

    it('完整收益模拟包含所有字段', () => {
      const sys = createSystem();
      const result = sys.simulateEarningsV16({
        currentPrestigeLevel: 20,
        currentRebirthCount: 0,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });

      expect(result.estimatedResources.gold).toBeGreaterThan(0);
      expect(result.estimatedPrestigeGain).toBeGreaterThan(0);
      expect(result.prestigeGrowthCurve).toBeDefined();
      expect(result.prestigeGrowthCurve.length).toBeGreaterThan(0);
      expect(result.comparison).toBeDefined();
      expect(result.recommendation).toBeTruthy();
    });

    it('推荐转生时机包含描述', () => {
      const sys = createSystem();
      const result = sys.simulateEarningsV16({
        currentPrestigeLevel: 20,
        currentRebirthCount: 0,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      expect(result.recommendation).toBeTruthy();
      expect(typeof result.recommendation).toBe('string');
    });

    it('高转生次数收益更高', () => {
      const sys = createSystem();
      const r1 = sys.simulateEarningsV16({
        currentPrestigeLevel: 20,
        currentRebirthCount: 0,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      const r2 = sys.simulateEarningsV16({
        currentPrestigeLevel: 20,
        currentRebirthCount: 5,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      expect(r2.estimatedResources.gold).toBeGreaterThan(r1.estimatedResources.gold);
    });
  });
});
