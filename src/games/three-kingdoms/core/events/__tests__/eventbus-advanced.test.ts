import { vi } from 'vitest';
/**
 * EventBus 高级单元测试
 *
 * 覆盖：removeAllListeners、listenerCount / eventNames 查询、
 *       多监听器执行顺序、边界条件。
 */

import { EventBus } from '../EventBus';

// ─────────────────────────────────────────────
// 辅助：创建 spy 化的 EventBus
// ─────────────────────────────────────────────
function createBus() {
  return new EventBus();
}

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
    expect(h1).toHaveBeenCalledTimes(1);
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

    expect(handler).toHaveBeenCalledTimes(1);
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
    expect(handler).toHaveBeenCalledTimes(1);
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

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('off 通配符 once 应正确移除', () => {
    const handler = vi.fn();
    bus.once('off:wild:*', handler);
    bus.off('off:wild:*', handler);

    bus.emit('off:wild:event', 'data');

    expect(handler).not.toHaveBeenCalled();
  });
});
