/**
 * MapEventSystem 单元测试
 *
 * 覆盖：
 * 1. 事件触发（checkAndTrigger）
 * 2. 事件解决（resolveEvent）
 * 3. 过期清理（cleanExpiredEvents）
 * 4. 事件查询
 * 5. 序列化
 */

import { MapEventSystem } from '../MapEventSystem';

describe('MapEventSystem', () => {
  let system: MapEventSystem;

  beforeEach(() => {
    system = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
  });

  // ─── ISubsystem ───────────────────────────

  describe('ISubsystem 接口', () => {
    it('name 应为 mapEventSystem', () => {
      expect(system.name).toBe('mapEventSystem');
    });

    it('reset 应清除所有状态', () => {
      system.checkAndTrigger(Date.now());
      system.reset();
      expect(system.getActiveEventCount()).toBe(0);
      expect(system.getResolvedCount()).toBe(0);
    });
  });

  // ─── 事件触发 ─────────────────────────────

  describe('事件触发', () => {
    it('forceTrigger 应创建指定类型事件', () => {
      const event = system.forceTrigger('bandit', 1000);
      expect(event.eventType).toBe('bandit');
      expect(event.status).toBe('active');
      expect(event.isCombat).toBe(true);
    });

    it('checkAndTrigger 应在概率命中时创建事件', () => {
      // rng返回0.5，BASE_TRIGGER_CHANCE=0.1，0.5 > 0.1，不触发
      let event = system.checkAndTrigger(1000);
      expect(event).toBeNull();

      // rng返回0.05，触发
      const triggerSystem = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 });
      event = triggerSystem.checkAndTrigger(1000);
      expect(event).not.toBeNull();
    });

    it('达到最大事件数不应再创建', () => {
      for (let i = 0; i < 5; i++) {
        system.forceTrigger('bandit', i * 1000);
      }
      expect(system.getActiveEventCount()).toBe(3); // MAX_ACTIVE_EVENTS = 3
    });

    it('forceTrigger 不存在的类型应抛错', () => {
      expect(() => system.forceTrigger('nonexistent' as unknown as string)).toThrow();
    });
  });

  // ─── 事件查询 ─────────────────────────────

  describe('事件查询', () => {
    beforeEach(() => {
      system.forceTrigger('bandit', 1000);
      system.forceTrigger('caravan', 2000);
    });

    it('getActiveEvents 应返回所有活跃事件', () => {
      expect(system.getActiveEvents().length).toBe(2);
    });

    it('getEventById 应返回指定事件', () => {
      const events = system.getActiveEvents();
      const found = system.getEventById(events[0].id);
      expect(found).toBeDefined();
    });

    it('getEventsByType 应按类型过滤', () => {
      expect(system.getEventsByType('bandit').length).toBe(1);
      expect(system.getEventsByType('caravan').length).toBe(1);
    });

    it('getResolvedCount 初始应为0', () => {
      expect(system.getResolvedCount()).toBe(0);
    });
  });

  // ─── 事件解决 ─────────────────────────────

  describe('事件解决', () => {
    it('强攻战斗类事件应触发战斗', () => {
      const event = system.forceTrigger('bandit', 1000);
      const result = system.resolveEvent(event.id, 'attack');
      expect(result.success).toBe(true);
      expect(result.triggeredBattle).toBe(true);
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('谈判应获得奖励但不触发战斗', () => {
      const event = system.forceTrigger('bandit', 1000);
      const result = system.resolveEvent(event.id, 'negotiate');
      expect(result.success).toBe(true);
      expect(result.triggeredBattle).toBe(false);
    });

    it('忽略应获得少量奖励', () => {
      const event = system.forceTrigger('bandit', 1000);
      const result = system.resolveEvent(event.id, 'ignore');
      expect(result.success).toBe(true);
    });

    it('不存在的事件应返回失败', () => {
      const result = system.resolveEvent('nonexistent', 'attack');
      expect(result.success).toBe(false);
    });

    it('解决后应从活跃列表移除', () => {
      const event = system.forceTrigger('bandit', 1000);
      system.resolveEvent(event.id, 'attack');
      expect(system.getActiveEventCount()).toBe(0);
      expect(system.getResolvedCount()).toBe(1);
    });
  });

  // ─── 过期处理 ─────────────────────────────

  describe('过期处理', () => {
    it('过期事件应被清理', () => {
      // 创建事件，然后时间推进使其过期
      system.forceTrigger('bandit', 1000);
      const cleaned = system.cleanExpiredEvents(999999999999);
      expect(cleaned).toBeGreaterThan(0);
      expect(system.getActiveEventCount()).toBe(0);
    });

    it('未过期事件不应被清理', () => {
      system.forceTrigger('bandit', 1000);
      const cleaned = system.cleanExpiredEvents(2000);
      expect(cleaned).toBe(0);
    });
  });

  // ─── 序列化 ───────────────────────────────

  describe('序列化', () => {
    it('应正确序列化和反序列化', () => {
      system.forceTrigger('bandit', 1000);
      system.forceTrigger('caravan', 2000);
      const data = system.serialize();

      const system2 = new MapEventSystem();
      system2.deserialize(data);
      expect(system2.getActiveEventCount()).toBe(2);
      expect(system2.getResolvedCount()).toBe(0);
    });

    it('版本不匹配应忽略', () => {
      const system2 = new MapEventSystem();
      system2.deserialize({ version: 999, activeEvents: [], resolvedCount: 0, lastCheckTime: 0 });
      expect(system2.getActiveEventCount()).toBe(0);
    });
  });
});
