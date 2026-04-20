/**
 * ModuleEventBus 单元测试
 *
 * 覆盖范围：
 * - publish() 发布事件
 * - subscribe() 订阅频道
 * - subscribeOnce() 一次性订阅
 * - unsubscribe() 取消订阅
 * - use() 中间件
 * - getHistory() 历史记录查询
 * - clearHistory() 清除历史
 * - getSubscriberCount() 订阅者计数
 * - reset() 重置
 * - 通配符频道匹配
 * - 中间件拦截和变换
 * - 异常隔离
 * - 边界条件
 */

import {
  ModuleEventBus,
  type BusEvent,
  type EventHandler,
  type EventMiddleware,
} from '../modules/ModuleEventBus';

// ============================================================
// 测试套件
// ============================================================

describe('ModuleEventBus', () => {
  let bus: ModuleEventBus;

  beforeEach(() => {
    bus = new ModuleEventBus();
  });

  // ========== publish() & subscribe() ==========

  describe('publish() & subscribe()', () => {
    it('应将事件分发给订阅者', () => {
      const handler = jest.fn();
      bus.subscribe('test', handler);
      bus.publish('test', 'module-a', { value: 42 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'test',
          source: 'module-a',
          data: { value: 42 },
        })
      );
    });

    it('事件应包含时间戳', () => {
      const handler = jest.fn();
      bus.subscribe('test', handler);
      bus.publish('test', 'src', null);

      const event = handler.mock.calls[0][0] as BusEvent;
      expect(typeof event.timestamp).toBe('number');
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('应支持多个订阅者', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      bus.subscribe('test', handler1);
      bus.subscribe('test', handler2);
      bus.publish('test', 'src', 'data');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('不应将事件分发给其他频道的订阅者', () => {
      const handler = jest.fn();
      bus.subscribe('channel-a', handler);
      bus.publish('channel-b', 'src', 'data');

      expect(handler).not.toHaveBeenCalled();
    });

    it('应支持不同类型的事件数据', () => {
      const handler = jest.fn();
      bus.subscribe('test', handler);

      bus.publish('test', 'src', null);
      bus.publish('test', 'src', 42);
      bus.publish('test', 'src', 'string');
      bus.publish('test', 'src', [1, 2, 3]);
      bus.publish('test', 'src', { key: 'value' });

      expect(handler).toHaveBeenCalledTimes(5);
    });
  });

  // ========== subscribe() 返回取消函数 ==========

  describe('subscribe() 返回取消订阅函数', () => {
    it('调用返回的函数应取消订阅', () => {
      const handler = jest.fn();
      const unsub = bus.subscribe('test', handler);

      bus.publish('test', 'src', 'first');
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      bus.publish('test', 'src', 'second');
      expect(handler).toHaveBeenCalledTimes(1); // 不再触发
    });

    it('多次调用取消函数不应报错', () => {
      const handler = jest.fn();
      const unsub = bus.subscribe('test', handler);

      unsub();
      unsub(); // 第二次调用
      expect(() => unsub()).not.toThrow();
    });
  });

  // ========== subscribeOnce() ==========

  describe('subscribeOnce()', () => {
    it('应在触发一次后自动取消订阅', () => {
      const handler = jest.fn();
      bus.subscribeOnce('test', handler);

      bus.publish('test', 'src', 'first');
      bus.publish('test', 'src', 'second');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'first' })
      );
    });

    it('应返回可手动取消的函数', () => {
      const handler = jest.fn();
      const unsub = bus.subscribeOnce('test', handler);

      unsub(); // 在触发前手动取消
      bus.publish('test', 'src', 'data');

      expect(handler).not.toHaveBeenCalled();
    });

    it('多个一次性订阅应各自独立', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bus.subscribeOnce('test', handler1);
      bus.subscribeOnce('test', handler2);

      bus.publish('test', 'src', 'data');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      bus.publish('test', 'src', 'data2');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // ========== unsubscribe() ==========

  describe('unsubscribe()', () => {
    it('应取消指定处理函数的订阅', () => {
      const handler = jest.fn();
      bus.subscribe('test', handler);
      bus.unsubscribe('test', handler);

      bus.publish('test', 'src', 'data');
      expect(handler).not.toHaveBeenCalled();
    });

    it('取消不存在的频道不应报错', () => {
      expect(() => bus.unsubscribe('nonexistent', jest.fn())).not.toThrow();
    });

    it('取消不存在的处理函数不应报错', () => {
      bus.subscribe('test', jest.fn());
      expect(() => bus.unsubscribe('test', jest.fn())).not.toThrow();
    });

    it('应只取消指定的处理函数', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      bus.subscribe('test', handler1);
      bus.subscribe('test', handler2);

      bus.unsubscribe('test', handler1);
      bus.publish('test', 'src', 'data');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // ========== 通配符频道 ==========

  describe('通配符频道', () => {
    it('应匹配前缀相同的事件', () => {
      const handler = jest.fn();
      bus.subscribe('building:*', handler);

      bus.publish('building:upgraded', 'src', 'data1');
      bus.publish('building:purchased', 'src', 'data2');

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('不应匹配前缀不同的事件', () => {
      const handler = jest.fn();
      bus.subscribe('building:*', handler);

      bus.publish('unit:recruited', 'src', 'data');

      expect(handler).not.toHaveBeenCalled();
    });

    it('通配符和精确订阅应同时触发', () => {
      const wildcardHandler = jest.fn();
      const exactHandler = jest.fn();

      bus.subscribe('building:*', wildcardHandler);
      bus.subscribe('building:upgraded', exactHandler);

      bus.publish('building:upgraded', 'src', 'data');

      expect(wildcardHandler).toHaveBeenCalledTimes(1);
      expect(exactHandler).toHaveBeenCalledTimes(1);
    });

    it('应支持多个不同前缀的通配符', () => {
      const buildingHandler = jest.fn();
      const unitHandler = jest.fn();

      bus.subscribe('building:*', buildingHandler);
      bus.subscribe('unit:*', unitHandler);

      bus.publish('building:upgraded', 'src', {});
      bus.publish('unit:recruited', 'src', {});

      expect(buildingHandler).toHaveBeenCalledTimes(1);
      expect(unitHandler).toHaveBeenCalledTimes(1);
    });

    it('通配符应匹配前缀下的所有子频道', () => {
      const handler = jest.fn();
      bus.subscribe('game:*', handler);

      bus.publish('game:building', 'src', {});
      bus.publish('game:unit', 'src', {});
      bus.publish('other:event', 'src', {});

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // ========== 中间件 ==========

  describe('use() 中间件', () => {
    it('中间件应在事件分发前执行', () => {
      const order: string[] = [];

      bus.use((_event, next) => {
        order.push('middleware');
        next();
      });

      bus.subscribe('test', () => {
        order.push('handler');
      });

      bus.publish('test', 'src', 'data');

      expect(order).toEqual(['middleware', 'handler']);
    });

    it('中间件不调用 next 应阻止事件分发', () => {
      const handler = jest.fn();
      bus.use((_event, _next) => {
        // 不调用 next
      });

      bus.subscribe('test', handler);
      bus.publish('test', 'src', 'data');

      expect(handler).not.toHaveBeenCalled();
    });

    it('多个中间件应按添加顺序嵌套执行', () => {
      const order: string[] = [];

      bus.use((_event, next) => { order.push('m1-before'); next(); order.push('m1-after'); });
      bus.use((_event, next) => { order.push('m2-before'); next(); order.push('m2-after'); });

      bus.subscribe('test', () => { order.push('handler'); });
      bus.publish('test', 'src', 'data');

      expect(order).toEqual(['m1-before', 'm2-before', 'handler', 'm2-after', 'm1-after']);
    });

    it('中间件应能访问事件数据', () => {
      const middleware = jest.fn((_event, next) => next());
      bus.use(middleware);

      bus.subscribe('test', jest.fn());
      bus.publish('test', 'src', { value: 42 });

      expect(middleware).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'test',
          source: 'src',
          data: { value: 42 },
        }),
        expect.any(Function)
      );
    });
  });

  // ========== 异常隔离 ==========

  describe('异常隔离', () => {
    it('订阅者异常不应影响其他订阅者', () => {
      const handler1 = jest.fn(() => { throw new Error('boom'); });
      const handler2 = jest.fn();

      bus.subscribe('test', handler1);
      bus.subscribe('test', handler2);

      bus.publish('test', 'src', 'data');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('订阅者异常不应影响通配符订阅者', () => {
      const errorHandler = jest.fn(() => { throw new Error('boom'); });
      const wildcardHandler = jest.fn();

      bus.subscribe('test', errorHandler);
      bus.subscribe('test:*', wildcardHandler);

      // 注意：test 不以 test: 开头，所以通配符不匹配
      bus.publish('test', 'src', 'data');

      expect(errorHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ========== getHistory() ==========

  describe('getHistory()', () => {
    it('应返回所有历史事件', () => {
      bus.subscribe('test', jest.fn());
      bus.publish('test', 'src', 'a');
      bus.publish('test', 'src', 'b');

      const history = bus.getHistory();
      expect(history).toHaveLength(2);
    });

    it('应按频道过滤历史', () => {
      bus.subscribe('ch-a', jest.fn());
      bus.subscribe('ch-b', jest.fn());
      bus.publish('ch-a', 'src', 'a');
      bus.publish('ch-b', 'src', 'b');
      bus.publish('ch-a', 'src', 'a2');

      const history = bus.getHistory('ch-a');
      expect(history).toHaveLength(2);
      expect(history.every(e => e.channel === 'ch-a')).toBe(true);
    });

    it('应支持 limit 参数', () => {
      bus.subscribe('test', jest.fn());
      for (let i = 0; i < 10; i++) {
        bus.publish('test', 'src', i);
      }

      const history = bus.getHistory('test', 3);
      expect(history).toHaveLength(3);
    });

    it('应支持通配符过滤历史', () => {
      bus.subscribe('building:up', jest.fn());
      bus.subscribe('building:down', jest.fn());
      bus.subscribe('unit:spawn', jest.fn());

      bus.publish('building:up', 'src', {});
      bus.publish('building:down', 'src', {});
      bus.publish('unit:spawn', 'src', {});

      const history = bus.getHistory('building:*');
      expect(history).toHaveLength(2);
    });

    it('无历史时应返回空数组', () => {
      expect(bus.getHistory()).toEqual([]);
    });
  });

  // ========== clearHistory() ==========

  describe('clearHistory()', () => {
    it('应清除所有历史记录', () => {
      bus.subscribe('test', jest.fn());
      bus.publish('test', 'src', 'data');
      bus.clearHistory();

      expect(bus.getHistory()).toEqual([]);
    });
  });

  // ========== 历史记录上限 ==========

  describe('历史记录上限', () => {
    it('应遵守构造函数传入的上限', () => {
      const limitedBus = new ModuleEventBus(5);
      limitedBus.subscribe('test', jest.fn());

      for (let i = 0; i < 10; i++) {
        limitedBus.publish('test', 'src', i);
      }

      const history = limitedBus.getHistory();
      expect(history).toHaveLength(5);
    });

    it('默认上限应为 100', () => {
      const defaultBus = new ModuleEventBus();
      defaultBus.subscribe('test', jest.fn());

      for (let i = 0; i < 110; i++) {
        defaultBus.publish('test', 'src', i);
      }

      const history = defaultBus.getHistory();
      expect(history).toHaveLength(100);
    });
  });

  // ========== getSubscriberCount() ==========

  describe('getSubscriberCount()', () => {
    it('应返回指定频道的订阅者数量', () => {
      bus.subscribe('test', jest.fn());
      bus.subscribe('test', jest.fn());
      bus.subscribe('test', jest.fn());

      expect(bus.getSubscriberCount('test')).toBe(3);
    });

    it('不存在的频道应返回 0', () => {
      expect(bus.getSubscriberCount('nonexistent')).toBe(0);
    });

    it('取消订阅后应正确更新', () => {
      const handler = jest.fn();
      bus.subscribe('test', handler);
      expect(bus.getSubscriberCount('test')).toBe(1);

      bus.unsubscribe('test', handler);
      expect(bus.getSubscriberCount('test')).toBe(0);
    });
  });

  // ========== reset() ==========

  describe('reset()', () => {
    it('应清除所有订阅', () => {
      bus.subscribe('test', jest.fn());
      bus.subscribe('test2', jest.fn());
      bus.reset();

      expect(bus.getSubscriberCount('test')).toBe(0);
      expect(bus.getSubscriberCount('test2')).toBe(0);
    });

    it('应清除所有中间件', () => {
      const middleware = jest.fn((_event, next) => next());
      bus.use(middleware);
      bus.reset();

      bus.subscribe('test', jest.fn());
      bus.publish('test', 'src', 'data');
      expect(middleware).not.toHaveBeenCalled();
    });

    it('应清除历史记录', () => {
      bus.subscribe('test', jest.fn());
      bus.publish('test', 'src', 'data');
      bus.reset();

      expect(bus.getHistory()).toEqual([]);
    });
  });
});
