/**
 * OfflineRewardSystem 单元测试
 *
 * 验证离线收益计算、收益递减、回归奖励和离线事件生成。
 */

import { describe, it, expect } from 'vitest';
import { OfflineRewardSystem } from '../OfflineRewardSystem';

describe('OfflineRewardSystem', () => {
  const system = new OfflineRewardSystem();
  const production = { grain: 10, gold: 5, troops: 2 };

  it('短时间离线（<24h）应获得 100% 收益', () => {
    // 离线 12 小时 = 720 分钟
    const reward = system.calculateReward(720, production);
    expect(reward.offlineMinutes).toBe(720);
    expect(reward.isReturnReward).toBe(false);
    expect(reward.returnBonusMultiplier).toBe(1);
    // 12h * 3600s * 10 grain/s = 432000
    expect(reward.resources.grain).toBe(432000);
    // 12h * 3600s * 5 gold/s = 216000
    expect(reward.resources.gold).toBe(216000);
  });

  it('24~48h 离线收益应递减 50%', () => {
    // 离线 36 小时 = 2160 分钟
    // 有效时长 = 24 * 1.0 + 12 * 0.5 = 30 小时
    const reward = system.calculateReward(2160, production);
    expect(reward.isReturnReward).toBe(true);
    expect(reward.returnBonusMultiplier).toBe(3);
    // 30h * 3600s * 10 * 3 = 3,240,000
    expect(reward.resources.grain).toBe(3240000);
  });

  it('超过 48h 离线收益应进一步递减至 10%', () => {
    // 离线 72 小时 = 4320 分钟
    // 有效时长 = 24 * 1.0 + 24 * 0.5 + 24 * 0.1 = 24 + 12 + 2.4 = 38.4 小时
    const reward = system.calculateReward(4320, production);
    expect(reward.isReturnReward).toBe(true);
    // 38.4h * 3600s * 10 * 3 = 4,147,200
    expect(reward.resources.grain).toBe(4147200);
  });

  it('零产出不应产生资源', () => {
    const reward = system.calculateReward(60, {});
    expect(Object.keys(reward.resources)).toHaveLength(0);
  });

  it('离线不足 4 小时不应触发事件', () => {
    const events = system.generateOfflineEvents(120); // 2 小时
    expect(events).toHaveLength(0);
  });

  it('离线 12 小时应触发 3 个事件', () => {
    const events = system.generateOfflineEvents(720); // 12 小时
    expect(events).toHaveLength(3);
    // 每个事件应有描述和奖励
    for (const e of events) {
      expect(e.description).toBeTruthy();
      expect(Object.keys(e.reward).length).toBeGreaterThan(0);
    }
  });

  it('序列化和反序列化应保持配置一致', () => {
    const data = system.serialize();
    const newSystem = new OfflineRewardSystem();
    newSystem.deserialize(data as Record<string, unknown>);
    // 验证反序列化后的系统行为一致
    const reward1 = system.calculateReward(60, production);
    const reward2 = newSystem.calculateReward(60, production);
    expect(reward1.resources.grain).toBe(reward2.resources.grain);
    expect(reward1.resources.gold).toBe(reward2.resources.gold);
  });
});
