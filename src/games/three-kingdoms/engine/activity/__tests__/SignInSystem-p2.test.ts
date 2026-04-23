import {
  SignInSystem,
  createDefaultSignInData,
  DEFAULT_SIGN_IN_REWARDS,
  DEFAULT_SIGN_IN_CONFIG,
  SIGN_IN_CYCLE_DAYS,
} from '../SignInSystem';

import type { SignInData, SignInReward, SignInConfig } from '../../../core/activity/activity.types';

function dayOffset(base: number, days: number): number {
  return base + days * 24 * 60 * 60 * 1000;
}

const BASE_TIME = new Date('2024-01-01T00:00:00Z').getTime();

// 模块级 system 实例，供所有 describe 块共享
let system: SignInSystem;
beforeEach(() => {
  system = new SignInSystem();
});

describe('奖励查询', () => {
  // system 由模块级 beforeEach 提供

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
