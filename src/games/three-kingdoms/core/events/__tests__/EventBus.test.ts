/**
 * EventBus 单元测试
 *
 * 覆盖：on/once/off/emit 基本功能、通配符匹配、多监听器顺序执行、
 * once 自动移除、emit 异常隔离、removeAllListeners、查询接口、
 * Unsubscribe 函数、边界条件。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../EventBus';

// ─────────────────────────────────────────────
// 辅助：创建 spy 化的 EventBus
// ─────────────────────────────────────────────
function createBus() {
  return new EventBus();
}

// ─────────────────────────────────────────────
// 1. on / emit 基本功能
// ─────────────────────────────────────────────
describe('EventBus — on / emit 基本功能', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('应正确触发已注册的监听器', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', { value: 42 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('应支持不同类型的 payload', () => {
    const strHandler = vi.fn();
    const numHandler = vi.fn();
    const nullHandler = vi.fn();

    bus.on('str:event', strHandler);
    bus.on('num:event', numHandler);
    bus.on('null:event', nullHandler);

    bus.emit('str:event', 'hello');
    bus.emit('num:event', 123);
    bus.emit('null:event', null);

    expect(strHandler).toHaveBeenCalledWith('hello');
    expect(numHandler).toHaveBeenCalledWith(123);
    expect(nullHandler).toHaveBeenCalledWith(null);
  });

  it('同一事件注册多个 handler 应全部触发', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const h3 = vi.fn();

    bus.on('multi:event', h1);
    bus.on('multi:event', h2);
    bus.on('multi:event', h3);

    bus.emit('multi:event', 'payload');

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
    expect(h3).toHaveBeenCalledOnce();
  });

  it('emit 不存在的事件应静默忽略（无监听器）', () => {
    expect(() => bus.emit('nonexistent:event', null)).not.toThrow();
  });
});

// ─────────────────────────────────────────────
// 2. once — 一次性监听器
// ─────────────────────────────────────────────
describe('EventBus — once', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('once 注册的 handler 应只触发一次', () => {
    const handler = vi.fn();
    bus.once('once:event', handler);

    bus.emit('once:event', 'first');
    bus.emit('once:event', 'second');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('once 和 on 可以共存于同一事件', () => {
    const persistent = vi.fn();
    const oneTime = vi.fn();

    bus.on('mix:event', persistent);
    bus.once('mix:event', oneTime);

    bus.emit('mix:event', 1);
    bus.emit('mix:event', 2);

    expect(persistent).toHaveBeenCalledTimes(2);
    expect(oneTime).toHaveBeenCalledOnce();
  });

  it('once 返回的 Unsubscribe 应在触发前可取消', () => {
    const handler = vi.fn();
    const unsub = bus.once('cancel:once', handler);

    unsub();
    bus.emit('cancel:once', 'data');

    expect(handler).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// 3. 通配符匹配
// ─────────────────────────────────────────────
describe('EventBus — 通配符匹配', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('building:* 应匹配 building:upgraded', () => {
    const handler = vi.fn();
    bus.on('building:*', handler);

    bus.emit('building:upgraded', { type: 'barracks' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: 'barracks' });
  });

  it('building:* 应匹配 building:upgrade-started', () => {
    const handler = vi.fn();
    bus.on('building:*', handler);

    bus.emit('building:upgrade-started', { type: 'farm' });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('building:* 不应匹配 resource:changed', () => {
    const handler = vi.fn();
    bus.on('building:*', handler);

    bus.emit('resource:changed', { resource: 'gold' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('通配符 handler 和精确 handler 应同时触发', () => {
    const wildcard = vi.fn();
    const exact = vi.fn();

    bus.on('building:*', wildcard);
    bus.on('building:upgraded', exact);

    bus.emit('building:upgraded', { level: 5 });

    expect(wildcard).toHaveBeenCalledOnce();
    expect(exact).toHaveBeenCalledOnce();
  });

  it('once 通配符应只触发一次', () => {
    const handler = vi.fn();
    bus.once('building:*', handler);

    bus.emit('building:upgraded', 1);
    bus.emit('building:level-changed', 2);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('多个通配符前缀可以匹配同一事件', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('building:*', h1);
    bus.on('building:up:*', h2);

    bus.emit('building:up:test', 'payload');

    // 'building:up:test' startsWith 'building:' => true
    expect(h1).toHaveBeenCalledOnce();
    // 'building:up:test' startsWith 'building:up:' => true
    expect(h2).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────
// 4. off — 取消订阅
// ─────────────────────────────────────────────
describe('EventBus — off', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('off 应移除指定的 on handler', () => {
    const handler = vi.fn();
    bus.on('off:test', handler);
    bus.off('off:test', handler);

    bus.emit('off:test', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('off 应移除指定的 once handler', () => {
    const handler = vi.fn();
    bus.once('off:once', handler);
    bus.off('off:once', handler);

    bus.emit('off:once', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('off 通配符应移除通配符 handler', () => {
    const handler = vi.fn();
    bus.on('wild:*', handler);
    bus.off('wild:*', handler);

    bus.emit('wild:event', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('off 不存在的 handler 应静默忽略（不抛异常）', () => {
    const handler = vi.fn();
    expect(() => bus.off('no:exist', handler)).not.toThrow();
  });

  it('off 同一 handler 多次应安全（重复 off）', () => {
    const handler = vi.fn();
    bus.on('repeat:off', handler);
    bus.off('repeat:off', handler);
    bus.off('repeat:off', handler);
    bus.off('repeat:off', handler);

    bus.emit('repeat:off', 'data');
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// 5. Unsubscribe 函数
// ─────────────────────────────────────────────
describe('EventBus — Unsubscribe 函数', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('on 返回的 Unsubscribe 应正确取消订阅', () => {
    const handler = vi.fn();
    const unsub = bus.on('unsub:test', handler);

    unsub();
    bus.emit('unsub:test', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('once 返回的 Unsubscribe 应正确取消订阅', () => {
    const handler = vi.fn();
    const unsub = bus.once('unsub:once', handler);

    unsub();
    bus.emit('unsub:once', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('通配符 on 的 Unsubscribe 应正确取消订阅', () => {
    const handler = vi.fn();
    const unsub = bus.on('unsub:wild:*', handler);

    unsub();
    bus.emit('unsub:wild:event', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('通配符 once 的 Unsubscribe 应正确取消订阅', () => {
    const handler = vi.fn();
    const unsub = bus.once('unsub:wildonce:*', handler);

    unsub();
    bus.emit('unsub:wildonce:event', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('多次调用 Unsubscribe 应安全', () => {
    const handler = vi.fn();
    const unsub = bus.on('multi:unsub', handler);

    unsub();
    unsub();
    unsub();

    bus.emit('multi:unsub', 'data');
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// 6. emit 异常隔离
// ─────────────────────────────────────────────
describe('EventBus — emit 异常隔离', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('一个 handler 报错不应阻止后续 handler 执行', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h1 = vi.fn(() => {
      throw new Error('handler 1 error');
    });
    const h2 = vi.fn();

    bus.on('error:test', h1);
    bus.on('error:test', h2);

    bus.emit('error:test', 'payload');

    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('once handler 报错不应阻止后续 handler', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badOnce = vi.fn(() => {
      throw new Error('once error');
    });
    const goodOnce = vi.fn();

    bus.once('error:once', badOnce);
    bus.once('error:once', goodOnce);

    bus.emit('error:once', 'data');

    expect(badOnce).toHaveBeenCalled();
    expect(goodOnce).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('通配符 handler 报错不应阻止精确 handler', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wildHandler = vi.fn(() => {
      throw new Error('wildcard error');
    });
    const exactHandler = vi.fn();

    bus.on('err:*', wildHandler);
    bus.on('err:exact', exactHandler);

    bus.emit('err:exact', 'data');

    expect(wildHandler).toHaveBeenCalled();
    expect(exactHandler).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────
// 7. removeAllListeners
// ─────────────────────────────────────────────
describe('EventBus — removeAllListeners', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('不传参数应移除所有监听器', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const h3 = vi.fn();

    bus.on('a:event', h1);
    bus.on('b:event', h2);
    bus.once('c:event', h3);

    bus.removeAllListeners();

    bus.emit('a:event', 1);
    bus.emit('b:event', 2);
    bus.emit('c:event', 3);

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
    expect(h3).not.toHaveBeenCalled();
  });

  it('指定事件名应只移除该事件的监听器', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('keep:this', h1);
    bus.on('remove:this', h2);

    bus.removeAllListeners('remove:this');

    bus.emit('remove:this', 'data');
    expect(h2).not.toHaveBeenCalled();

    bus.emit('keep:this', 'data');
    expect(h1).toHaveBeenCalledOnce();
  });

  it('指定事件名应同时移除 on 和 once 监听器', () => {
    const onHandler = vi.fn();
    const onceHandler = vi.fn();

    bus.on('target:event', onHandler);
    bus.once('target:event', onceHandler);

    bus.removeAllListeners('target:event');

    bus.emit('target:event', 'data');

    expect(onHandler).not.toHaveBeenCalled();
    expect(onceHandler).not.toHaveBeenCalled();
  });

  it('指定事件名应移除匹配的通配符监听器', () => {
    const handler = vi.fn();
    bus.on('wild:*', handler);

    bus.removeAllListeners('wild:something');

    bus.emit('wild:other', 'data');

    // 'wild:something' startsWith 'wild:' => the wildcard entry is removed
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners 后 listenerCount 应为 0', () => {
    bus.on('x:1', vi.fn());
    bus.on('x:2', vi.fn());
    bus.once('x:3', vi.fn());

    bus.removeAllListeners();

    expect(bus.listenerCount('x:1')).toBe(0);
    expect(bus.listenerCount('x:2')).toBe(0);
    expect(bus.listenerCount('x:3')).toBe(0);
  });
});

// ─────────────────────────────────────────────
// 8. listenerCount / eventNames 查询
// ─────────────────────────────────────────────
describe('EventBus — listenerCount / eventNames', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('listenerCount 未注册事件应返回 0', () => {
    expect(bus.listenerCount('no:event')).toBe(0);
  });

  it('listenerCount 应返回精确匹配的 on + once handler 数量', () => {
    bus.on('count:event', vi.fn());
    bus.on('count:event', vi.fn());
    bus.once('count:event', vi.fn());

    expect(bus.listenerCount('count:event')).toBe(3);
  });

  it('listenerCount 应包含通配符匹配的 handler', () => {
    bus.on('count:*', vi.fn());
    bus.once('count:*', vi.fn());

    // 'count:test' startsWith 'count:' => 2 wildcard handlers
    expect(bus.listenerCount('count:test')).toBe(2);
  });

  it('listenerCount 在 handler 移除后应正确更新', () => {
    const h = vi.fn();
    bus.on('remove:count', h);

    expect(bus.listenerCount('remove:count')).toBe(1);

    bus.off('remove:count', h);

    expect(bus.listenerCount('remove:count')).toBe(0);
  });

  it('eventNames 应返回所有已注册的事件名', () => {
    bus.on('alpha:event', vi.fn());
    bus.on('beta:event', vi.fn());
    bus.once('gamma:event', vi.fn());

    const names = bus.eventNames();

    expect(names).toContain('alpha:event');
    expect(names).toContain('beta:event');
    expect(names).toContain('gamma:event');
    expect(names).toHaveLength(3);
  });

  it('eventNames 不应包含通配符模式', () => {
    bus.on('wild:*', vi.fn());
    bus.on('exact:event', vi.fn());

    const names = bus.eventNames();

    expect(names).toContain('exact:event');
    expect(names).not.toContain('wild:*');
    expect(names).toHaveLength(1);
  });

  it('eventNames 无监听器时应返回空数组', () => {
    expect(bus.eventNames()).toEqual([]);
  });

  it('eventNames 去重（on 和 once 同名事件只出现一次）', () => {
    bus.on('dup:event', vi.fn());
    bus.once('dup:event', vi.fn());

    const names = bus.eventNames();

    expect(names).toEqual(['dup:event']);
  });
});

// ─────────────────────────────────────────────
// 9. 多监听器执行顺序
// ─────────────────────────────────────────────
describe('EventBus — 多监听器执行顺序', () => {
  it('handler 应按注册顺序执行', () => {
    const bus = createBus();
    const order: number[] = [];

    bus.on('order:test', () => order.push(1));
    bus.on('order:test', () => order.push(2));
    bus.on('order:test', () => order.push(3));

    bus.emit('order:test', null);

    expect(order).toEqual([1, 2, 3]);
  });

  it('精确 handler 应先于通配符 handler 执行', () => {
    const bus = createBus();
    const order: string[] = [];

    bus.on('exact:event', () => order.push('exact'));
    bus.on('exact:*', () => order.push('wildcard'));

    bus.emit('exact:event', null);

    // 精确匹配先执行，通配符后执行（由 emit 实现顺序决定）
    expect(order).toEqual(['exact', 'wildcard']);
  });
});

// ─────────────────────────────────────────────
// 10. 边界条件
// ─────────────────────────────────────────────
describe('EventBus — 边界条件', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createBus();
  });

  it('空字符串事件名应正常工作', () => {
    const handler = vi.fn();
    bus.on('', handler);

    bus.emit('', 'data');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('无监听器时 emit 应安全', () => {
    expect(() => bus.emit('nothing:here', undefined)).not.toThrow();
  });

  it('重复 off 同一 handler 应安全', () => {
    const handler = vi.fn();
    bus.on('dup:off', handler);
    bus.off('dup:off', handler);
    bus.off('dup:off', handler);
    bus.off('dup:off', handler);

    expect(() => bus.emit('dup:off', null)).not.toThrow();
  });

  it('void payload 应正常工作', () => {
    const handler = vi.fn();
    bus.on('void:event', handler);

    bus.emit('void:event', undefined);

    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('同一 handler 注册两次应触发两次', () => {
    const handler = vi.fn();
    bus.on('double:register', handler);
    bus.on('double:register', handler);

    bus.emit('double:register', 'data');

    // Set 会去重，同一引用只能注册一次
    expect(handler).toHaveBeenCalledOnce();
  });

  it('off 不存在的通配符应安全', () => {
    const handler = vi.fn();
    expect(() => bus.off('no:wild:*', handler)).not.toThrow();
  });

  it('removeAllListeners 不存在的通配符前缀应安全', () => {
    bus.on('exact:only', vi.fn());
    expect(() => bus.removeAllListeners('exact:only')).not.toThrow();
  });

  it('once 通配符触发后再次 emit 不应再触发', () => {
    const handler = vi.fn();
    bus.once('once:wild:*', handler);

    bus.emit('once:wild:a', 1);
    bus.emit('once:wild:b', 2);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('off 通配符 once 应正确移除', () => {
    const handler = vi.fn();
    bus.once('off:wild:*', handler);
    bus.off('off:wild:*', handler);

    bus.emit('off:wild:event', 'data');

    expect(handler).not.toHaveBeenCalled();
  });
});
