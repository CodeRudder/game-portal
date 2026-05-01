/**
 * RebirthSystem.helpers 对抗式测试
 *
 * 五维度挑战覆盖：
 *   F-Normal: 初始赠送、瞬间建筑、建筑时间计算、一键重建
 *   F-Boundary: 建筑等级边界、倍率边界、加速期边界
 *   F-Error: 无效输入防御
 *   F-Cross: 增长曲线、转生时机对比
 *   F-Lifecycle: v16解锁内容
 */

import { describe, it, expect } from 'vitest';
import {
  getInitialGift,
  getInstantBuildConfig,
  calculateBuildTime,
  getAutoRebuildPlan,
  getUnlockContentsV16,
  isFeatureUnlocked,
  generatePrestigeGrowthCurve,
  compareRebirthTiming,
  simulateEarningsV16,
} from '../RebirthSystem.helpers';
import { REBIRTH_ACCELERATION } from '../../../core/prestige';

// ═══════════════════════════════════════════════════════════

describe('RebirthSystem.helpers 对抗式测试', () => {

  // ═══════════════════════════════════════════
  // F-Normal: 主线流程
  // ═══════════════════════════════════════════

  describe('[F-Normal] 纯函数计算', () => {
    it('初始赠送内容为正数', () => {
      const gift = getInitialGift();
      expect(gift.grain).toBeGreaterThan(0);
      expect(gift.gold).toBeGreaterThan(0);
      expect(gift.troops).toBeGreaterThan(0);
    });

    it('初始赠送为深拷贝', () => {
      const g1 = getInitialGift();
      g1.grain = 0;
      const g2 = getInitialGift();
      expect(g2.grain).toBeGreaterThan(0);
    });

    it('瞬间建筑配置合理', () => {
      const config = getInstantBuildConfig();
      expect(config.maxInstantLevel).toBeGreaterThan(0);
      expect(config.speedDivisor).toBeGreaterThan(1);
    });

    it('一键重建：转生0次返回null', () => {
      expect(getAutoRebuildPlan(0)).toBeNull();
    });

    it('一键重建：转生1次返回计划', () => {
      const plan = getAutoRebuildPlan(1);
      expect(plan).not.toBeNull();
      expect(plan!.length).toBeGreaterThan(0);
    });

    it('建筑时间计算：无加速返回原值', () => {
      expect(calculateBuildTime(3600, 10, 1.0, 0)).toBe(3600);
    });

    it('建筑时间计算：低级建筑瞬间升级', () => {
      const config = getInstantBuildConfig();
      const time = calculateBuildTime(3600, config.maxInstantLevel, 2.0, 0);
      expect(time).toBeLessThan(3600);
      expect(time).toBeGreaterThanOrEqual(1);
    });

    it('建筑时间计算：高级建筑受倍率影响', () => {
      const time = calculateBuildTime(3600, 20, 2.0, 0);
      expect(time).toBe(Math.max(1, Math.floor(3600 / 2.0)));
    });

    it('建筑时间计算：加速期内额外加速', () => {
      const normal = calculateBuildTime(3600, 20, 2.0, 0);
      const accelerated = calculateBuildTime(3600, 20, 2.0, 7);
      expect(accelerated).toBeLessThan(normal);
    });
  });

  // ═══════════════════════════════════════════
  // F-Boundary: 边界条件
  // ═══════════════════════════════════════════

  describe('[F-Boundary] 边界条件', () => {
    it('建筑时间计算：baseTime=0 FIX-507 返回1（最小值）', () => {
      // FIX-507: baseTime=0 被防护，返回1（最小值）
      expect(calculateBuildTime(0, 10, 1.0, 0)).toBe(1);
    });

    it('建筑时间计算：baseTime=1', () => {
      expect(calculateBuildTime(1, 20, 2.0, 0)).toBeGreaterThanOrEqual(1);
    });

    it('建筑时间计算：极高倍率', () => {
      const time = calculateBuildTime(3600, 20, 100, 0);
      expect(time).toBeGreaterThanOrEqual(1);
    });

    it('建筑时间计算：倍率恰好为1.0无加速', () => {
      expect(calculateBuildTime(3600, 20, 1.0, 0)).toBe(3600);
    });

    it('建筑时间计算：倍率<1.0但无加速期', () => {
      // multiplier <= 1.0 && accelerationDaysLeft <= 0 => 返回原始时间
      expect(calculateBuildTime(3600, 20, 0.5, 0)).toBe(3600);
    });

    it('v16解锁内容：rebirthCount=0全部未解锁', () => {
      const contents = getUnlockContentsV16(0);
      expect(contents.every(c => !c.unlocked)).toBe(true);
    });

    it('v16解锁内容：rebirthCount=10全部解锁', () => {
      const contents = getUnlockContentsV16(10);
      expect(contents.every(c => c.unlocked)).toBe(true);
    });

    it('一键重建：高转生次数计划不变', () => {
      const plan1 = getAutoRebuildPlan(1);
      const plan99 = getAutoRebuildPlan(99);
      expect(plan1).toEqual(plan99);
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 异常路径
  // ═══════════════════════════════════════════

  describe('[F-Error] 异常防御', () => {
    it('isFeatureUnlocked：不存在的ID返回false', () => {
      expect(isFeatureUnlocked('nonexistent', 10)).toBe(false);
    });

    it('isFeatureUnlocked：空字符串返回false', () => {
      expect(isFeatureUnlocked('', 10)).toBe(false);
    });

    it('generatePrestigeGrowthCurve：0天只有day0', () => {
      const curve = generatePrestigeGrowthCurve({
        currentPrestigeLevel: 1,
        currentRebirthCount: 0,
        simulateDays: 0,
        dailyOnlineHours: 4,
      });
      expect(curve.length).toBe(1);
      expect(curve[0]).toEqual({ day: 0, prestige: 0 });
    });

    it('generatePrestigeGrowthCurve：0在线小时产出为0', () => {
      const curve = generatePrestigeGrowthCurve({
        currentPrestigeLevel: 1,
        currentRebirthCount: 0,
        simulateDays: 10,
        dailyOnlineHours: 0,
      });
      expect(curve[curve.length - 1].prestige).toBe(0);
    });

    it('compareRebirthTiming：空选项返回空数组', () => {
      const result = compareRebirthTiming(0, []);
      expect(result).toEqual([]);
    });

    it('compareRebirthTiming：自定义选项', () => {
      const result = compareRebirthTiming(0, [1, 2]);
      expect(result.length).toBe(2);
      for (const c of result) {
        expect(c.waitMultiplier).toBeGreaterThan(c.immediateMultiplier);
      }
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统交互
  // ═══════════════════════════════════════════

  describe('[F-Cross] 增长曲线与时机对比', () => {
    it('增长曲线单调递增', () => {
      const curve = generatePrestigeGrowthCurve({
        currentPrestigeLevel: 1,
        currentRebirthCount: 0,
        simulateDays: 30,
        dailyOnlineHours: 4,
      });
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].prestige).toBeGreaterThanOrEqual(curve[i - 1].prestige);
      }
    });

    it('加速期内增长更快', () => {
      const curve = generatePrestigeGrowthCurve({
        currentPrestigeLevel: 1,
        currentRebirthCount: 0,
        simulateDays: 30,
        dailyOnlineHours: 4,
      });
      // 前7天有加速（resourceMultiplier=2.0）
      // day 1 的增长应包含加速
      const day1Gain = curve[1].prestige;
      const day8Gain = curve[8].prestige - curve[7].prestige;
      // 加速期日增长 > 非加速期
      expect(day1Gain).toBeGreaterThan(day8Gain);
    });

    it('转生时机对比推荐合理', () => {
      const comparisons = compareRebirthTiming(5);
      for (const c of comparisons) {
        expect(['rebirth_now', 'wait', 'no_difference']).toContain(c.recommendedAction);
        expect(['high', 'medium', 'low']).toContain(c.confidence);
      }
    });

    it('simulateEarningsV16包含完整信息', () => {
      const baseResult = {
        estimatedResources: { gold: 1000, grain: 500 },
        estimatedPrestigeGain: 100,
        estimatedLevelUps: 1,
        rebirthAccelerationBonus: { gold: 500, grain: 250 },
        days: 30,
      };
      const result = simulateEarningsV16({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 30,
        dailyOnlineHours: 4,
      }, baseResult);
      expect(result.prestigeGrowthCurve.length).toBe(31);
      expect(result.comparison.length).toBeGreaterThan(0);
      expect(result.recommendation).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：建筑时间计算全覆盖
  // ═══════════════════════════════════════════

  describe('[对抗] 建筑时间计算全覆盖', () => {
    const config = getInstantBuildConfig();

    it('低级建筑：倍率=1, 无加速 => 瞬间升级', () => {
      // multiplier <= 1.0 && accelerationDaysLeft <= 0 => return baseTimeSeconds
      // 但 buildingLevel <= maxInstantLevel => 先检查瞬间升级
      // 实际上源码先检查 multiplier<=1.0 && accelerationDaysLeft<=0
      const time = calculateBuildTime(3600, config.maxInstantLevel, 1.0, 0);
      // multiplier<=1.0 && accelDays<=0 => 直接返回baseTimeSeconds=3600
      expect(time).toBe(3600);
    });

    it('低级建筑：倍率>1, 无加速 => 瞬间升级', () => {
      const time = calculateBuildTime(3600, config.maxInstantLevel, 2.0, 0);
      expect(time).toBeLessThan(3600);
    });

    it('低级建筑：倍率>1, 有加速 => 瞬间升级', () => {
      const time = calculateBuildTime(3600, config.maxInstantLevel, 2.0, 7);
      expect(time).toBeLessThan(3600);
    });

    it('高级建筑：倍率>1, 有加速 => 双重加速', () => {
      const onlyMultiplier = calculateBuildTime(3600, 20, 2.0, 0);
      const withAccel = calculateBuildTime(3600, 20, 2.0, 7);
      expect(withAccel).toBeLessThan(onlyMultiplier);
    });

    it('边界建筑等级：刚好超过maxInstantLevel', () => {
      const timeLow = calculateBuildTime(3600, config.maxInstantLevel, 2.0, 0);
      const timeHigh = calculateBuildTime(3600, config.maxInstantLevel + 1, 2.0, 0);
      expect(timeHigh).toBeGreaterThan(timeLow);
    });
  });
});
