/**
 * EventSystem 活动系统 — 单元测试
 *
 * 覆盖范围：
 * - 注册活动
 * - 参与活动
 * - 添加积分 / 代币
 * - 领取里程碑奖励
 * - 代币兑换
 * - 活动状态更新（未开始 / 进行中 / 已结束）
 * - 排名等级计算
 * - 序列化 / 反序列化
 *
 * @module engines/idle/modules/__tests__/EventSystem.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventSystem,
  type GameEvent,
  type EventShopItem,
  type EventMilestone,
  type EventReward,
  type EventSystemEvent,
} from '../EventSystem';

// ============================================================
// 测试数据工厂
// ============================================================

const NOW = 1_000_000_000_000; // 固定时间基准

/** 创建一个默认活动 */
function makeEvent(overrides?: Partial<GameEvent>): GameEvent {
  return {
    id: 'spring_fest',
    name: '春节活动',
    description: '限时春节庆典',
    status: 'active',
    startsAt: NOW - 1000,
    endsAt: NOW + 86400000 * 7,
    rewards: [],
    shop: [],
    milestones: [],
    playerPoints: 0,
    playerTokens: 0,
    ...overrides,
  };
}

/** 创建带商店和里程碑的活动 */
function makeFullEvent(): GameEvent {
  const shop: EventShopItem[] = [
    { id: 'item_a', name: '强化石', cost: 50, reward: { stone: 1 }, stock: 5, purchased: 0 },
    { id: 'item_b', name: '金币袋', cost: 30, reward: { gold: 500 }, stock: -1, purchased: 0 },
  ];

  const milestones: EventMilestone[] = [
    { points: 100, reward: { gold: 200 }, claimed: false },
    { points: 300, reward: { gold: 500, gem: 10 }, claimed: false },
    { points: 600, reward: { gem: 50 }, claimed: false },
  ];

  const rewards: EventReward[] = [
    { id: 'r1', name: '铜牌奖励', resources: { gold: 100 }, tier: 'bronze' },
    { id: 'r2', name: '金牌奖励', resources: { gem: 50 }, tier: 'gold' },
  ];

  return makeEvent({
    id: 'full_event',
    shop,
    milestones,
    rewards,
  });
}

/** 创建系统实例并注册活动 */
function createSystem(...events: GameEvent[]): EventSystem {
  const sys = new EventSystem();
  for (const e of events) sys.registerEvent(e);
  return sys;
}

// ============================================================
// 测试套件
// ============================================================

describe('EventSystem', () => {
  let system: EventSystem;

  beforeEach(() => {
    system = createSystem(makeEvent(), makeFullEvent());
  });

  // ----------------------------------------------------------
  // 注册活动
  // ----------------------------------------------------------
  describe('注册活动', () => {
    it('应成功注册活动', () => {
      const fresh = new EventSystem();
      fresh.registerEvent(makeEvent());
      expect(fresh.getActiveEvents()).toHaveLength(1);
    });

    it('注册活动时应触发 event_registered 事件', () => {
      const events: EventSystemEvent[] = [];
      const fresh = new EventSystem();
      fresh.on('event_registered', (e) => events.push(e));
      fresh.registerEvent(makeEvent({ id: 'test_evt' }));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'event_registered', eventId: 'test_evt' });
    });
  });

  // ----------------------------------------------------------
  // 参与活动
  // ----------------------------------------------------------
  describe('参与活动', () => {
    it('active 状态活动可参与', () => {
      expect(system.participateEvent('spring_fest')).toBe(true);
    });

    it('upcoming 状态活动不可参与', () => {
      system.registerEvent(makeEvent({ id: 'upcoming_evt', status: 'upcoming' }));
      expect(system.participateEvent('upcoming_evt')).toBe(false);
    });

    it('ended 状态活动不可参与', () => {
      system.registerEvent(makeEvent({ id: 'ended_evt', status: 'ended' }));
      expect(system.participateEvent('ended_evt')).toBe(false);
    });

    it('不存在的活动返回 false', () => {
      expect(system.participateEvent('nonexistent')).toBe(false);
    });

    it('参与活动应触发事件', () => {
      const events: EventSystemEvent[] = [];
      system.on('event_participated', (e) => events.push(e));
      system.participateEvent('spring_fest');
      expect(events[0].type).toBe('event_participated');
    });
  });

  // ----------------------------------------------------------
  // 添加积分 / 代币
  // ----------------------------------------------------------
  describe('添加积分与代币', () => {
    it('应正确累加活动积分', () => {
      system.addPoints('spring_fest', 100);
      system.addPoints('spring_fest', 50);
      const evt = system.serialize() as Record<string, GameEvent>;
      expect(evt['spring_fest'].playerPoints).toBe(150);
    });

    it('应正确累加活动代币', () => {
      system.addTokens('spring_fest', 80);
      const evt = system.serialize() as Record<string, GameEvent>;
      expect(evt['spring_fest'].playerTokens).toBe(80);
    });

    it('不存在的活动应静默忽略', () => {
      expect(() => system.addPoints('nonexistent', 10)).not.toThrow();
      expect(() => system.addTokens('nonexistent', 10)).not.toThrow();
    });

    it('添加积分应触发事件', () => {
      const events: EventSystemEvent[] = [];
      system.on('event_points_added', (e) => events.push(e));
      system.addPoints('spring_fest', 42);
      expect(events[0]).toEqual({ type: 'event_points_added', eventId: 'spring_fest', points: 42 });
    });
  });

  // ----------------------------------------------------------
  // 领取里程碑奖励
  // ----------------------------------------------------------
  describe('领取里程碑奖励', () => {
    it('积分达标时可领取里程碑', () => {
      system.addPoints('full_event', 150);
      const reward = system.claimMilestone('full_event', 0);
      expect(reward).toEqual({ gold: 200 });
    });

    it('积分不足时不可领取', () => {
      system.addPoints('full_event', 50);
      expect(system.claimMilestone('full_event', 0)).toBeNull();
    });

    it('已领取的里程碑不可重复领取', () => {
      system.addPoints('full_event', 500);
      system.claimMilestone('full_event', 0);
      expect(system.claimMilestone('full_event', 0)).toBeNull();
    });

    it('越界索引返回 null', () => {
      expect(system.claimMilestone('full_event', -1)).toBeNull();
      expect(system.claimMilestone('full_event', 99)).toBeNull();
    });

    it('不存在的活动返回 null', () => {
      expect(system.claimMilestone('nonexistent', 0)).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 代币兑换
  // ----------------------------------------------------------
  describe('代币兑换', () => {
    it('代币充足时可兑换商品', () => {
      system.addTokens('full_event', 100);
      const reward = system.exchangeToken('full_event', 'item_a');
      expect(reward).toEqual({ stone: 1 });
    });

    it('兑换后应扣除代币', () => {
      system.addTokens('full_event', 100);
      system.exchangeToken('full_event', 'item_a'); // cost 50
      const evt = system.serialize() as Record<string, GameEvent>;
      expect(evt['full_event'].playerTokens).toBe(50);
    });

    it('代币不足时不可兑换', () => {
      system.addTokens('full_event', 10);
      expect(system.exchangeToken('full_event', 'item_a')).toBeNull();
    });

    it('库存耗尽时不可兑换', () => {
      system.addTokens('full_event', 1000);
      // item_a stock = 5
      for (let i = 0; i < 5; i++) system.exchangeToken('full_event', 'item_a');
      expect(system.exchangeToken('full_event', 'item_a')).toBeNull();
    });

    it('stock = -1 表示无限库存', () => {
      system.addTokens('full_event', 1000);
      for (let i = 0; i < 20; i++) system.exchangeToken('full_event', 'item_b');
      // item_b stock = -1, 全部成功
      const evt = system.serialize() as Record<string, GameEvent>;
      expect(evt['full_event'].shop.find((s) => s.id === 'item_b')!.purchased).toBe(20);
    });

    it('不存在的商品返回 null', () => {
      system.addTokens('full_event', 999);
      expect(system.exchangeToken('full_event', 'nonexistent')).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 活动状态更新
  // ----------------------------------------------------------
  describe('活动状态更新', () => {
    it('应正确将活动标记为 upcoming / active / ended', () => {
      const fresh = new EventSystem();
      fresh.registerEvent(makeEvent({
        id: 'timeline_evt',
        status: 'upcoming',
        startsAt: 1000,
        endsAt: 2000,
      }));

      fresh.updateEventStatuses(500);  // 未开始
      expect(fresh.getUpcomingEvents()).toHaveLength(1);
      expect(fresh.getActiveEvents()).toHaveLength(0);

      fresh.updateEventStatuses(1500); // 进行中
      expect(fresh.getActiveEvents()).toHaveLength(1);
      expect(fresh.getUpcomingEvents()).toHaveLength(0);

      fresh.updateEventStatuses(3000); // 已结束
      expect(fresh.getActiveEvents()).toHaveLength(0);
    });

    it('状态变化时应触发 event_status_changed 事件', () => {
      const events: EventSystemEvent[] = [];
      const fresh = new EventSystem();
      fresh.registerEvent(makeEvent({
        id: 'status_evt',
        status: 'upcoming',
        startsAt: 1000,
        endsAt: 2000,
      }));
      fresh.on('event_status_changed', (e) => events.push(e));

      fresh.updateEventStatuses(1500); // upcoming → active
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('event_status_changed');
      if (events[0].type === 'event_status_changed') {
        expect(events[0].status).toBe('active');
      }
    });

    it('状态未变化时不触发事件', () => {
      const events: EventSystemEvent[] = [];
      const fresh = new EventSystem();
      fresh.registerEvent(makeEvent({
        id: 'stable_evt',
        status: 'active',
        startsAt: 1000,
        endsAt: 2000,
      }));
      fresh.on('event_status_changed', (e) => events.push(e));

      fresh.updateEventStatuses(1500); // 仍然是 active
      expect(events).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // 排名等级
  // ----------------------------------------------------------
  describe('排名等级计算', () => {
    it('积分 < 200 为 bronze', () => {
      system.addPoints('spring_fest', 50);
      expect(system.getEventRanking('spring_fest')).toBe('bronze');
    });

    it('积分 >= 200 为 silver', () => {
      system.addPoints('spring_fest', 200);
      expect(system.getEventRanking('spring_fest')).toBe('silver');
    });

    it('积分 >= 500 为 gold', () => {
      system.addPoints('spring_fest', 500);
      expect(system.getEventRanking('spring_fest')).toBe('gold');
    });

    it('积分 >= 1000 为 diamond', () => {
      system.addPoints('spring_fest', 1000);
      expect(system.getEventRanking('spring_fest')).toBe('diamond');
    });

    it('不存在的活动返回 bronze', () => {
      expect(system.getEventRanking('nonexistent')).toBe('bronze');
    });
  });

  // ----------------------------------------------------------
  // 序列化 / 反序列化
  // ----------------------------------------------------------
  describe('序列化与反序列化', () => {
    it('serialize 应导出完整活动状态', () => {
      system.addPoints('spring_fest', 100);
      system.addTokens('spring_fest', 50);

      const data = system.serialize() as Record<string, GameEvent>;
      expect(data['spring_fest']).toBeDefined();
      expect(data['spring_fest'].playerPoints).toBe(100);
      expect(data['spring_fest'].playerTokens).toBe(50);
    });

    it('deserialize 应恢复活动状态', () => {
      system.addPoints('full_event', 300);
      system.addTokens('full_event', 100);
      const saved = system.serialize();

      const fresh = new EventSystem();
      fresh.deserialize(saved);
      fresh.updateEventStatuses(NOW); // 恢复 active 状态

      expect(fresh.getActiveEvents()).toHaveLength(2);
      const data = fresh.serialize() as Record<string, GameEvent>;
      expect(data['full_event'].playerPoints).toBe(300);
      expect(data['full_event'].playerTokens).toBe(100);
    });

    it('序列化结果为深拷贝，修改不影响原系统', () => {
      const saved = system.serialize() as Record<string, GameEvent>;
      saved['spring_fest'].playerPoints = 9999;

      const current = system.serialize() as Record<string, GameEvent>;
      expect(current['spring_fest'].playerPoints).toBe(0);
    });
  });
});
