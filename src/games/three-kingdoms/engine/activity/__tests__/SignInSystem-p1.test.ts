/**
 * SignInSystem 单元测试
 *
 * 覆盖：
 * 1. 7天循环签到
 * 2. 连续签到加成
 * 3. 补签机制
 * 4. 序列化/反序列化（由 ActivitySystem 覆盖）
 * 5. 边界条件
 */

import {
  SignInSystem,
  createDefaultSignInData,
  DEFAULT_SIGN_IN_REWARDS,
  DEFAULT_SIGN_IN_CONFIG,
  SIGN_IN_CYCLE_DAYS,
} from '../SignInSystem';

import type { SignInData, SignInReward, SignInConfig } from '../../../core/activity/activity.types';

// ─── 辅助 ────────────────────────────────────

/** 创建时间戳（从基准时间偏移 N 天） */
function dayOffset(base: number, days: number): number {
  return base + days * 24 * 60 * 60 * 1000;
}

/** 基准时间：2024-01-01 00:00:00 UTC */
const BASE_TIME = new Date('2024-01-01T00:00:00Z').getTime();

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('SignInSystem', () => {
  let system: SignInSystem;
  beforeEach(() => {
    system = new SignInSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 默认数据与常量
  // ═══════════════════════════════════════════
  describe('默认数据与常量', () => {
    it('createDefaultSignInData 返回正确默认值', () => {
      const data = createDefaultSignInData();
      expect(data.consecutiveDays).toBe(0);
      expect(data.todaySigned).toBe(false);
      expect(data.lastSignInTime).toBe(0);
      expect(data.weeklyRetroactiveCount).toBe(0);
      expect(data.lastRetroactiveResetWeek).toBe(0);
    });

    it('SIGN_IN_CYCLE_DAYS 为 7', () => {
      expect(SIGN_IN_CYCLE_DAYS).toBe(7);
    });

    it('DEFAULT_SIGN_IN_REWARDS 有 7 天奖励', () => {
      expect(DEFAULT_SIGN_IN_REWARDS).toHaveLength(7);
      for (let i = 0; i < 7; i++) {
        expect(DEFAULT_SIGN_IN_REWARDS[i].day).toBe(i + 1);
      }
    });

    it('DEFAULT_SIGN_IN_CONFIG 配置正确', () => {
      expect(DEFAULT_SIGN_IN_CONFIG.retroactiveCostGold).toBe(50);
      expect(DEFAULT_SIGN_IN_CONFIG.weeklyRetroactiveLimit).toBe(2);
      expect(DEFAULT_SIGN_IN_CONFIG.consecutive3Bonus).toBe(20);
      expect(DEFAULT_SIGN_IN_CONFIG.consecutive7Bonus).toBe(50);
    });

    it('getCycleDays 返回 7', () => {
      expect(system.getCycleDays()).toBe(7);
    });

    it('getConfig 返回配置副本', () => {
      const config = system.getConfig();
      expect(config.retroactiveCostGold).toBe(50);
      // 修改副本不影响原配置
      config.retroactiveCostGold = 999;
      expect(system.getConfig().retroactiveCostGold).toBe(50);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 7天循环签到
  // ═══════════════════════════════════════════
  describe('7天循环签到', () => {
    it('首次签到 consecutiveDays = 1', () => {
      const data = createDefaultSignInData();
      const result = system.signIn(data, BASE_TIME);
      expect(result.data.consecutiveDays).toBe(1);
      expect(result.data.todaySigned).toBe(true);
    });

    it('第1天签到获得第1天奖励', () => {
      const data = createDefaultSignInData();
      const result = system.signIn(data, BASE_TIME);
      expect(result.reward.day).toBe(1);
      expect(result.reward.description).toBe('铜钱×1000');
      expect(result.reward.rewards).toEqual({ copper: 1000 });
    });

    it('连续7天签到获得对应天数的奖励', () => {
      let data = createDefaultSignInData();
      const rewards: SignInReward[] = [];

      for (let day = 0; day < 7; day++) {
        // 模拟引擎每日重置 todaySigned
        data = { ...data, todaySigned: false };
        const result = system.signIn(data, dayOffset(BASE_TIME, day));
        rewards.push(result.reward);
        data = result.data;
      }

      // 验证每天奖励
      for (let i = 0; i < 7; i++) {
        expect(rewards[i].day).toBe(i + 1);
      }
      expect(data.consecutiveDays).toBe(7);
    });

    it('第8天循环回第1天奖励', () => {
      let data = createDefaultSignInData();
      // 连续签到7天
      for (let day = 0; day < 7; day++) {
        data = { ...data, todaySigned: false };
        const result = system.signIn(data, dayOffset(BASE_TIME, day));
        data = result.data;
      }
      // 第8天
      data = { ...data, todaySigned: false };
      const result = system.signIn(data, dayOffset(BASE_TIME, 7));
      expect(result.reward.day).toBe(1);
      expect(result.data.consecutiveDays).toBe(8);
    });

    it('getCycleDay 正确计算循环天数', () => {
      expect(system.getCycleDay(1)).toBe(1);
      expect(system.getCycleDay(7)).toBe(7);
      expect(system.getCycleDay(8)).toBe(1);
      expect(system.getCycleDay(14)).toBe(7);
      expect(system.getCycleDay(15)).toBe(1);
    });

    it('getCycleDay 0 或负数返回 1', () => {
      expect(system.getCycleDay(0)).toBe(1);
      expect(system.getCycleDay(-1)).toBe(1);
    });

    it('重复签到抛异常', () => {
      const data = createDefaultSignInData();
      const result = system.signIn(data, BASE_TIME);
      expect(() => {
        system.signIn(result.data, BASE_TIME);
      }).toThrow('今日已签到');
    });

    it('签到后 lastSignInTime 更新', () => {
      const data = createDefaultSignInData();
      const result = system.signIn(data, BASE_TIME);
      expect(result.data.lastSignInTime).toBe(BASE_TIME);
    });

    it('连续签到 consecutiveDays 递增', () => {
      let data = createDefaultSignInData();
      for (let day = 0; day < 5; day++) {
        data = { ...data, todaySigned: false };
        const result = system.signIn(data, dayOffset(BASE_TIME, day));
        expect(result.data.consecutiveDays).toBe(day + 1);
        data = result.data;
      }
    });

    it('断签后重新从1开始', () => {
      let data = createDefaultSignInData();
      // 签到3天
      for (let day = 0; day < 3; day++) {
        data = { ...data, todaySigned: false };
        const result = system.signIn(data, dayOffset(BASE_TIME, day));
        data = result.data;
      }
      expect(data.consecutiveDays).toBe(3);

      // 跳过2天（第4天不签，第5天签），间隔超过1天
      data = { ...data, todaySigned: false };
      const result = system.signIn(data, dayOffset(BASE_TIME, 5));
      expect(result.data.consecutiveDays).toBe(1);
      expect(result.reward.day).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 连续签到加成
  // ═══════════════════════════════════════════
  describe('连续签到加成', () => {
    it('连续1-2天无加成', () => {
      expect(system.getConsecutiveBonus(1)).toBe(0);
      expect(system.getConsecutiveBonus(2)).toBe(0);
    });

    it('连续3-6天加成20%', () => {
      expect(system.getConsecutiveBonus(3)).toBe(20);
      expect(system.getConsecutiveBonus(4)).toBe(20);
      expect(system.getConsecutiveBonus(5)).toBe(20);
      expect(system.getConsecutiveBonus(6)).toBe(20);
    });

    it('连续7天及以上加成50%', () => {
      expect(system.getConsecutiveBonus(7)).toBe(50);
      expect(system.getConsecutiveBonus(8)).toBe(50);
      expect(system.getConsecutiveBonus(14)).toBe(50);
      expect(system.getConsecutiveBonus(100)).toBe(50);
    });

    it('签到返回正确的加成百分比', () => {
      let data = createDefaultSignInData();
      // 第1天：0%
      data = { ...data, todaySigned: false };
      const r1 = system.signIn(data, dayOffset(BASE_TIME, 0));
      expect(r1.bonusPercent).toBe(0);
      data = r1.data;

      // 第2天：0%
      data = { ...data, todaySigned: false };
      const r2 = system.signIn(data, dayOffset(BASE_TIME, 1));
      expect(r2.bonusPercent).toBe(0);
      data = r2.data;

      // 第3天：20%
      data = { ...data, todaySigned: false };
      const r3 = system.signIn(data, dayOffset(BASE_TIME, 2));
      expect(r3.bonusPercent).toBe(20);
      data = r3.data;

      // 第7天：50%
      data = { ...data, todaySigned: false };
      const r4 = system.signIn(data, dayOffset(BASE_TIME, 3));
      data = { ...r4.data, todaySigned: false };
      const r5 = system.signIn(data, dayOffset(BASE_TIME, 4));
      data = { ...r5.data, todaySigned: false };
      const r6 = system.signIn(data, dayOffset(BASE_TIME, 5));
      data = { ...r6.data, todaySigned: false };
      const r7 = system.signIn(data, dayOffset(BASE_TIME, 6));
      expect(r7.bonusPercent).toBe(50);
    });

    it('自定义加成配置生效', () => {
      const custom = new SignInSystem({
        consecutive3Bonus: 30,
        consecutive7Bonus: 80,
      });
      expect(custom.getConsecutiveBonus(3)).toBe(30);
      expect(custom.getConsecutiveBonus(7)).toBe(80);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 补签机制
  // ═══════════════════════════════════════════
  describe('补签机制', () => {
    it('补签成功消耗元宝并标记已签到', () => {
      const data = createDefaultSignInData();
      const result = system.retroactive(data, BASE_TIME, 100);
      expect(result.goldCost).toBe(50);
      expect(result.data.todaySigned).toBe(true);
      expect(result.data.consecutiveDays).toBe(1);
    });

    it('补签后 consecutiveDays 递增', () => {
      let data = createDefaultSignInData();
      // 先签到2天
      data = system.signIn(data, dayOffset(BASE_TIME, 0)).data;
      data = system.signIn(data, dayOffset(BASE_TIME, 1)).data;
      expect(data.consecutiveDays).toBe(2);

      // 第3天不签，第4天补签
      const result = system.retroactive(data, dayOffset(BASE_TIME, 3), 100);
      expect(result.data.consecutiveDays).toBe(3);
    });

    it('今日已签到时补签抛异常', () => {
      const data = createDefaultSignInData();
      const signedData = system.signIn(data, BASE_TIME).data;
