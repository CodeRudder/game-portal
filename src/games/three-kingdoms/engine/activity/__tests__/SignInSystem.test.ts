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
      expect(() => {
        system.retroactive(signedData, BASE_TIME, 100);
      }).toThrow('今日已签到');
    });

    it('元宝不足时补签抛异常', () => {
      const data = createDefaultSignInData();
      expect(() => {
        system.retroactive(data, BASE_TIME, 30); // 需要50，只有30
      }).toThrow('元宝不足');
    });

    it('补签次数达到每周上限抛异常', () => {
      let data = createDefaultSignInData();
      // 补签2次（默认每周上限2次）
      data = system.retroactive(data, dayOffset(BASE_TIME, 0), 100).data;
      // 第二天补签
      data.todaySigned = false; // 模拟新的一天未签到
      data = system.retroactive(data, dayOffset(BASE_TIME, 1), 100).data;

      // 第三次补签
      data.todaySigned = false;
      expect(() => {
        system.retroactive(data, dayOffset(BASE_TIME, 2), 100);
      }).toThrow('本周补签次数已用完');
    });

    it('canSignIn 未签到返回 true', () => {
      const data = createDefaultSignInData();
      expect(system.canSignIn(data)).toBe(true);
    });

    it('canSignIn 已签到返回 false', () => {
      const data = system.signIn(createDefaultSignInData(), BASE_TIME).data;
      expect(system.canSignIn(data)).toBe(false);
    });

    it('canRetroactive 正常情况返回可以补签', () => {
      const data = createDefaultSignInData();
      const result = system.canRetroactive(data, BASE_TIME, 100);
      expect(result.canRetroactive).toBe(true);
      expect(result.reason).toBe('');
    });

    it('canRetroactive 已签到返回不可补签', () => {
      const data = system.signIn(createDefaultSignInData(), BASE_TIME).data;
      const result = system.canRetroactive(data, BASE_TIME, 100);
      expect(result.canRetroactive).toBe(false);
      expect(result.reason).toContain('已签到');
    });

    it('canRetroactive 元宝不足返回不可补签', () => {
      const data = createDefaultSignInData();
      const result = system.canRetroactive(data, BASE_TIME, 30);
      expect(result.canRetroactive).toBe(false);
      expect(result.reason).toContain('元宝不足');
    });

    it('getRemainingRetroactive 初始返回每周上限', () => {
      const data = createDefaultSignInData();
      expect(system.getRemainingRetroactive(data, BASE_TIME)).toBe(2);
    });

    it('getRemainingRetroactive 补签后减少', () => {
      let data = createDefaultSignInData();
      data = system.retroactive(data, BASE_TIME, 100).data;
      expect(system.getRemainingRetroactive(data, BASE_TIME)).toBe(1);
    });

    it('自定义补签配置生效', () => {
      const custom = new SignInSystem({
        retroactiveCostGold: 100,
        weeklyRetroactiveLimit: 5,
      });
      const config = custom.getConfig();
      expect(config.retroactiveCostGold).toBe(100);
      expect(config.weeklyRetroactiveLimit).toBe(5);
    });

    it('补签消耗正确金额', () => {
      const data = createDefaultSignInData();
      const result = system.retroactive(data, BASE_TIME, 100);
      expect(result.goldCost).toBe(50);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 奖励查询
  // ═══════════════════════════════════════════
  describe('奖励查询', () => {
    it('getReward 返回指定天数奖励', () => {
      const reward = system.getReward(1);
      expect(reward.day).toBe(1);
      expect(reward.rewards).toEqual({ copper: 1000 });
    });

    it('getReward 第7天奖励正确', () => {
      const reward = system.getReward(7);
      expect(reward.day).toBe(7);
      expect(reward.rewards).toEqual({ heroFragment: 5 });
      expect(reward.tokenReward).toBe(50);
    });

    it('getReward 第3天有代币奖励', () => {
      const reward = system.getReward(3);
      expect(reward.tokenReward).toBe(10);
    });

    it('getReward 第6天有代币奖励', () => {
      const reward = system.getReward(6);
      expect(reward.tokenReward).toBe(20);
    });

    it('getReward 超出范围返回最后一天', () => {
      const reward = system.getReward(100);
      expect(reward.day).toBe(7);
    });

    it('getReward 0或负数返回第1天', () => {
      const reward = system.getReward(0);
      expect(reward.day).toBe(1);
    });

    it('getAllRewards 返回全部7天奖励', () => {
      const rewards = system.getAllRewards();
      expect(rewards).toHaveLength(7);
    });

    it('getAllRewards 返回副本', () => {
      const rewards1 = system.getAllRewards();
      const rewards2 = system.getAllRewards();
      expect(rewards1).not.toBe(rewards2);
      expect(rewards1).toEqual(rewards2);
    });

    it('自定义奖励列表生效', () => {
      const customRewards: SignInReward[] = [
        { day: 1, description: '自定义奖励', rewards: { custom: 999 }, tokenReward: 0 },
      ];
      const custom = new SignInSystem(undefined, customRewards);
      expect(custom.getAllRewards()).toHaveLength(1);
      expect(custom.getReward(1).description).toBe('自定义奖励');
    });
  });

  // ═══════════════════════════════════════════
  // 6. 签到完整流程
  // ═══════════════════════════════════════════
  describe('签到完整流程', () => {
    it('完整7天签到流程', () => {
      let data = createDefaultSignInData();
      const allRewards: SignInReward[] = [];
      const allBonuses: number[] = [];

      for (let day = 0; day < 7; day++) {
        data = { ...data, todaySigned: false };
        const result = system.signIn(data, dayOffset(BASE_TIME, day));
        allRewards.push(result.reward);
        allBonuses.push(result.bonusPercent);
        data = result.data;
      }

      // 验证连续天数
      expect(data.consecutiveDays).toBe(7);
      expect(data.todaySigned).toBe(true);

      // 验证奖励递增
      expect(allRewards[0].day).toBe(1);
      expect(allRewards[6].day).toBe(7);

      // 验证加成递增
      expect(allBonuses[0]).toBe(0);  // 第1天
      expect(allBonuses[1]).toBe(0);  // 第2天
      expect(allBonuses[2]).toBe(20); // 第3天
      expect(allBonuses[6]).toBe(50); // 第7天
    });

    it('签到-断签-重新签到流程', () => {
      let data = createDefaultSignInData();

      // 签到3天
      data = { ...data, todaySigned: false };
      data = system.signIn(data, dayOffset(BASE_TIME, 0)).data;
      data = { ...data, todaySigned: false };
      data = system.signIn(data, dayOffset(BASE_TIME, 1)).data;
      data = { ...data, todaySigned: false };
      data = system.signIn(data, dayOffset(BASE_TIME, 2)).data;
      expect(data.consecutiveDays).toBe(3);

      // 断签2天，然后重新签到
      data = { ...data, todaySigned: false };
      const result = system.signIn(data, dayOffset(BASE_TIME, 5));
      expect(result.data.consecutiveDays).toBe(1);
      expect(result.bonusPercent).toBe(0);
    });

    it('签到-补签流程', () => {
      let data = createDefaultSignInData();

      // 签到第1天
      data = system.signIn(data, dayOffset(BASE_TIME, 0)).data;
      expect(data.consecutiveDays).toBe(1);

      // 第2天补签
      data.todaySigned = false; // 模拟新一天未签
      const retroResult = system.retroactive(data, dayOffset(BASE_TIME, 1), 100);
      expect(retroResult.data.consecutiveDays).toBe(2);
      expect(retroResult.goldCost).toBe(50);
    });

    it('跨周补签次数重置', () => {
      let data = createDefaultSignInData();

      // 在第1周补签2次（达到上限）
      data = system.retroactive(data, dayOffset(BASE_TIME, 0), 100).data;
      data.todaySigned = false;
      data = system.retroactive(data, dayOffset(BASE_TIME, 1), 100).data;

      // 同周不能再补签
      data.todaySigned = false;
      expect(() => {
        system.retroactive(data, dayOffset(BASE_TIME, 2), 100);
      }).toThrow('本周补签次数已用完');

      // 跨到下一周，补签次数应重置
      const nextWeekTime = dayOffset(BASE_TIME, 8); // 跨周
      data.todaySigned = false;
      const result = system.retroactive(data, nextWeekTime, 100);
      expect(result.goldCost).toBe(50);
      expect(result.data.weeklyRetroactiveCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 边界条件
  // ═══════════════════════════════════════════
  describe('边界条件', () => {
    it('getReward 返回副本（外层对象独立）', () => {
      const reward = system.getReward(1);
      reward.description = 'modified';
      const reward2 = system.getReward(1);
      expect(reward2.description).toBe('铜钱×1000');
    });

    it('getConsecutiveBonus(0) 返回 0', () => {
      expect(system.getConsecutiveBonus(0)).toBe(0);
    });

    it('getConsecutiveBonus 负数返回 0', () => {
      expect(system.getConsecutiveBonus(-5)).toBe(0);
    });

    it('连续签到14天完成两个完整循环', () => {
      let data = createDefaultSignInData();
      for (let day = 0; day < 14; day++) {
        const result = system.signIn(data, dayOffset(BASE_TIME, day));
        data = result.data;
      }
      expect(data.consecutiveDays).toBe(14);
      // 第14天 = 第二个循环的第7天
      expect(system.getCycleDay(14)).toBe(7);
    });

    it('签到返回的 reward 是副本', () => {
      const data = createDefaultSignInData();
      const result = system.signIn(data, BASE_TIME);
      result.reward.rewards.copper = 0;
      const reward2 = system.getReward(1);
      expect(reward2.rewards.copper).toBe(1000);
    });

    it('元宝刚好够补签', () => {
      const data = createDefaultSignInData();
      const result = system.retroactive(data, BASE_TIME, 50); // 刚好50
      expect(result.goldCost).toBe(50);
    });

    it('元宝差1不够补签', () => {
      const data = createDefaultSignInData();
      expect(() => {
        system.retroactive(data, BASE_TIME, 49);
      }).toThrow('元宝不足');
    });
  });
});
