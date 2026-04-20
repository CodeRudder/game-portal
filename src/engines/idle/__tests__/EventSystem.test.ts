/**
 * EventSystem 单元测试
 */

import {
  EventSystem,
  type GameEvent,
  type EventSystemEvent,
} from '../modules/EventSystem';

function createGameEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  const now = Date.now();
  return {
    id: 'spring_fest',
    name: '春节活动',
    description: '欢度春节',
    status: 'active',
    startsAt: now - 1000,
    endsAt: now + 86400000 * 7,
    rewards: [{
      id: 'r1',
      name: '活动奖励',
      resources: { gold: 100 },
      tier: 'gold',
    }],
    shop: [{
      id: 'item1',
      name: '宝箱',
      cost: 5,
      reward: { chest: 1 },
      stock: 3,
      purchased: 0,
    }],
    milestones: [{
      points: 100,
      reward: { gold: 50 },
      claimed: false,
    }],
    playerPoints: 0,
    playerTokens: 0,
    ...overrides,
  };
}

describe('EventSystem', () => {
  let system: EventSystem;

  beforeEach(() => {
    system = new EventSystem();
  });

  it('应正确注册活动', () => {
    system.registerEvent(createGameEvent());
    expect(system.getActiveEvents()).toHaveLength(1);
  });

  it('activeEvents 应返回进行中的活动', () => {
    system.registerEvent(createGameEvent());
    expect(system.getActiveEvents()).toHaveLength(1);
  });

  it('已结束的活动不应出现在 activeEvents', () => {
    const now = Date.now();
    system.registerEvent(createGameEvent({ status: 'ended', startsAt: now - 200000, endsAt: now - 1000 }));
    expect(system.getActiveEvents()).toHaveLength(0);
  });

  it('getEventRanking 应根据积分返回正确等级', () => {
    system.registerEvent(createGameEvent());
    expect(system.getEventRanking('spring_fest')).toBe('bronze');
    system.addPoints('spring_fest', 200);
    expect(system.getEventRanking('spring_fest')).toBe('silver');
    system.addPoints('spring_fest', 300);
    expect(system.getEventRanking('spring_fest')).toBe('gold');
    system.addPoints('spring_fest', 500);
    expect(system.getEventRanking('spring_fest')).toBe('diamond');
  });

  it('participateEvent 应成功参与活动', () => {
    system.registerEvent(createGameEvent());
    expect(system.participateEvent('spring_fest')).toBe(true);
  });

  it('未开始的活动不能参与', () => {
    const now = Date.now();
    system.registerEvent(createGameEvent({ status: 'upcoming', startsAt: now + 100000, endsAt: now + 200000 }));
    expect(system.participateEvent('spring_fest')).toBe(false);
  });

  it('已结束的活动不能参与', () => {
    const now = Date.now();
    system.registerEvent(createGameEvent({ status: 'ended', startsAt: now - 200000, endsAt: now - 1000 }));
    expect(system.participateEvent('spring_fest')).toBe(false);
  });

  it('addPoints 应正确增加活动积分', () => {
    system.registerEvent(createGameEvent());
    system.addPoints('spring_fest', 50);
    // Verify via ranking: 50 points = bronze
    expect(system.getEventRanking('spring_fest')).toBe('bronze');
    system.addPoints('spring_fest', 150);
    // 200 total = silver
    expect(system.getEventRanking('spring_fest')).toBe('silver');
  });

  it('addTokens 应正确增加活动代币', () => {
    system.registerEvent(createGameEvent());
    system.addTokens('spring_fest', 10);
    // Now we should be able to exchange item costing 5 tokens
    const result = system.exchangeToken('spring_fest', 'item1');
    expect(result).not.toBeNull();
  });

  it('claimMilestone 应正确领取里程碑奖励', () => {
    system.registerEvent(createGameEvent());
    system.addPoints('spring_fest', 100);
    const reward = system.claimMilestone('spring_fest', 0);
    expect(reward).toEqual({ gold: 50 });
  });

  it('积分不足时领取里程碑应返回 null', () => {
    system.registerEvent(createGameEvent());
    const reward = system.claimMilestone('spring_fest', 0);
    expect(reward).toBeNull();
  });

  it('重复领取里程碑应返回 null', () => {
    system.registerEvent(createGameEvent());
    system.addPoints('spring_fest', 100);
    system.claimMilestone('spring_fest', 0);
    const reward = system.claimMilestone('spring_fest', 0);
    expect(reward).toBeNull();
  });

  it('exchangeToken 应正确兑换', () => {
    system.registerEvent(createGameEvent());
    system.addTokens('spring_fest', 10);
    const result = system.exchangeToken('spring_fest', 'item1');
    expect(result).toEqual({ chest: 1 });
  });

  it('代币不足时兑换应失败', () => {
    system.registerEvent(createGameEvent());
    const result = system.exchangeToken('spring_fest', 'item1');
    expect(result).toBeNull();
  });

  it('库存限制应生效', () => {
    system.registerEvent(createGameEvent());
    system.addTokens('spring_fest', 100);
    for (let i = 0; i < 3; i++) {
      const r = system.exchangeToken('spring_fest', 'item1');
      expect(r).not.toBeNull();
    }
    // 4th exchange should fail (stock=3)
    expect(system.exchangeToken('spring_fest', 'item1')).toBeNull();
  });

  it('updateEventStatuses 应根据时间更新状态', () => {
    const now = Date.now();
    system.registerEvent(createGameEvent({ status: 'upcoming', startsAt: now + 10000, endsAt: now + 86400000 }));
    expect(system.getActiveEvents()).toHaveLength(0);
    // Advance time past start
    system.updateEventStatuses(now + 20000);
    expect(system.getActiveEvents()).toHaveLength(1);
  });

  it('getUpcomingEvents 应返回未开始的活动', () => {
    const now = Date.now();
    system.registerEvent(createGameEvent({ status: 'upcoming', startsAt: now + 10000, endsAt: now + 86400000 }));
    expect(system.getUpcomingEvents()).toHaveLength(1);
  });

  it('应正确触发事件', () => {
    system.registerEvent(createGameEvent());
    const handler = jest.fn();
    system.on('event_participated', handler);
    system.participateEvent('spring_fest');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'event_participated' }));
  });

  it('serialize/deserialize 应正确工作', () => {
    system.registerEvent(createGameEvent());
    system.addPoints('spring_fest', 100);
    system.addTokens('spring_fest', 20);
    const saved = system.serialize();

    const newSystem = new EventSystem();
    newSystem.deserialize(saved);
    // Verify ranking reflects restored points (100 = bronze, need 200 for silver)
    expect(newSystem.getEventRanking('spring_fest')).toBe('bronze');
    // Verify tokens restored by exchanging
    const result = newSystem.exchangeToken('spring_fest', 'item1');
    expect(result).toEqual({ chest: 1 });
  });

  it('无效活动 ID 应安全返回', () => {
    expect(system.participateEvent('nonexistent')).toBe(false);
    expect(system.claimMilestone('nonexistent', 0)).toBeNull();
    expect(system.exchangeToken('nonexistent', 'item1')).toBeNull();
    expect(system.getEventRanking('nonexistent')).toBe('bronze');
  });
});
