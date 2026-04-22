import { vi } from 'vitest';
/**
 * EventBus 核心单元测试
 *
 * 覆盖：on/emit 基本功能、once 一次性监听、off 取消订阅、
 *       Unsubscribe 函数、通配符匹配、emit 异常隔离。
 */

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

    expect(handler).toHaveBeenCalledTimes(1);
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

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
    expect(h3).toHaveBeenCalledTimes(1);
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

    expect(handler).toHaveBeenCalledTimes(1);
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
    expect(oneTime).toHaveBeenCalledTimes(1);
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

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'barracks' });
  });

  it('building:* 应匹配 building:upgrade-started', () => {
    const handler = vi.fn();
    bus.on('building:*', handler);

    bus.emit('building:upgrade-started', { type: 'farm' });

    expect(handler).toHaveBeenCalledTimes(1);
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

    expect(wildcard).toHaveBeenCalledTimes(1);
    expect(exact).toHaveBeenCalledTimes(1);
  });

  it('once 通配符应只触发一次', () => {
    const handler = vi.fn();
    bus.once('building:*', handler);

    bus.emit('building:upgraded', 1);
    bus.emit('building:level-changed', 2);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('多个通配符前缀可以匹配同一事件', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('building:*', h1);
    bus.on('building:up:*', h2);

    bus.emit('building:up:test', 'payload');

    // 'building:up:test' startsWith 'building:' => true
    expect(h1).toHaveBeenCalledTimes(1);
    // 'building:up:test' startsWith 'building:up:' => true
    expect(h2).toHaveBeenCalledTimes(1);
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
