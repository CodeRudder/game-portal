import { vi } from 'vitest';
/**
 * 渲染层核心逻辑测试
 *
 * 覆盖：RenderLoop 调度、RenderStateBridge 桥接
 * 不依赖 PixiJS DOM 渲染，仅测试纯逻辑
 */

import { RenderLoop, type IRendererRegistration } from '../core/RenderLoop';
import { RenderStateBridge } from '../adapters/RenderStateBridge';

// ─────────────────────────────────────────────
// Mock 渲染器（不依赖 PIXI）
// ─────────────────────────────────────────────

function createMockRenderer(overrides: Partial<{ visible: boolean }> = {}): {
  renderer: {
    init: vi.Mock;
    update: vi.Mock;
    destroy: vi.Mock;
    visible: boolean;
  };
} {
  return {
    renderer: {
      init: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
      visible: overrides.visible ?? true,
    },
  };
}

// Mock IRenderStateAdapter
function createMockAdapter() {
  const listeners: Array<(state: any) => void> = [];
  let currentState: any = { timestamp: 0 };

  return {
    subscribe: vi.fn((cb: (state: any) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }),
    getRenderState: vi.fn(() => currentState),
    setState: (state: any) => {
      currentState = state;
      listeners.forEach((cb) => cb(state));
    },
  };
}

// ═══════════════════════════════════════════════
// RenderLoop 测试
// ═══════════════════════════════════════════════

describe('RenderLoop', () => {
  let loop: RenderLoop;

  beforeEach(() => {
    loop = new RenderLoop();
  });

  it('注册渲染器后 size 增加', () => {
    const { renderer } = createMockRenderer();
    expect(loop.size).toBe(0);
    loop.register({ name: 'test', renderer });
    expect(loop.size).toBe(1);
  });

  it('注销渲染器后 size 减少', () => {
    const { renderer } = createMockRenderer();
    loop.register({ name: 'test', renderer });
    loop.unregister('test');
    expect(loop.size).toBe(0);
  });

  it('注销不存在的渲染器不报错', () => {
    expect(() => loop.unregister('nonexistent')).not.toThrow();
  });

  it('update 调用所有可见渲染器的 update', () => {
    const { renderer: r1 } = createMockRenderer();
    const { renderer: r2 } = createMockRenderer({ visible: false });
    loop.register({ name: 'visible', renderer: r1 });
    loop.register({ name: 'hidden', renderer: r2 });

    loop.update(0.016);

    expect(r1.update).toHaveBeenCalledWith(0.016);
    expect(r2.update).not.toHaveBeenCalled();
  });

  it('按优先级顺序调用渲染器', () => {
    const order: string[] = [];
    const { renderer: r1 } = createMockRenderer();
    const { renderer: r2 } = createMockRenderer();
    const { renderer: r3 } = createMockRenderer();

    r1.update = vi.fn(() => order.push('r1'));
    r2.update = vi.fn(() => order.push('r2'));
    r3.update = vi.fn(() => order.push('r3'));

    // 注册顺序与优先级顺序不同
    loop.register({ name: 'r1', renderer: r1, priority: 10 });
    loop.register({ name: 'r2', renderer: r2, priority: 0 });
    loop.register({ name: 'r3', renderer: r3, priority: 5 });

    loop.update(1);

    expect(order).toEqual(['r2', 'r3', 'r1']);
  });

  it('暂停时不调用渲染器 update', () => {
    const { renderer } = createMockRenderer();
    loop.register({ name: 'test', renderer });
    loop.pause();
    loop.update(0.016);
    expect(renderer.update).not.toHaveBeenCalled();
  });

  it('恢复后重新调用渲染器 update', () => {
    const { renderer } = createMockRenderer();
    loop.register({ name: 'test', renderer });
    loop.pause();
    loop.update(0.016);
    expect(renderer.update).not.toHaveBeenCalled();

    loop.resume();
    loop.update(0.016);
    expect(renderer.update).toHaveBeenCalledWith(0.016);
  });

  it('paused 属性正确反映状态', () => {
    expect(loop.paused).toBe(false);
    loop.pause();
    expect(loop.paused).toBe(true);
    loop.resume();
    expect(loop.paused).toBe(false);
  });

  it('单个渲染器异常不影响其他渲染器', () => {
    const { renderer: good } = createMockRenderer();
    const { renderer: bad } = createMockRenderer();
    bad.update = vi.fn(() => { throw new Error('渲染错误'); });

    loop.register({ name: 'bad', renderer: bad, priority: 0 });
    loop.register({ name: 'good', renderer: good, priority: 1 });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loop.update(0.016);
    warnSpy.mockRestore();

    expect(bad.update).toHaveBeenCalled();
    expect(good.update).toHaveBeenCalled();
  });

  it('getRenderer 返回已注册的渲染器', () => {
    const { renderer } = createMockRenderer();
    loop.register({ name: 'test', renderer });
    expect(loop.getRenderer('test')).toBe(renderer);
  });

  it('getRenderer 对未注册的返回 undefined', () => {
    expect(loop.getRenderer('nonexistent')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════
// RenderStateBridge 测试
// ═══════════════════════════════════════════════

describe('RenderStateBridge', () => {
  let bridge: RenderStateBridge;
  let adapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    adapter = createMockAdapter();
    bridge = new RenderStateBridge(adapter as any);
  });

  afterEach(() => {
    bridge.destroy();
  });

  it('注册渲染器后 size 增加', () => {
    const cb = vi.fn();
    bridge.register('map', cb);
    expect(bridge.size).toBe(1);
  });

  it('注销渲染器后 size 减少', () => {
    const cb = vi.fn();
    bridge.register('map', cb);
    bridge.unregister('map');
    expect(bridge.size).toBe(0);
  });

  it('start 后订阅 adapter', () => {
    bridge.start();
    expect(adapter.subscribe).toHaveBeenCalled();
    expect(bridge.started).toBe(true);
  });

  it('stop 后取消订阅', () => {
    bridge.start();
    bridge.stop();
    expect(bridge.started).toBe(false);
  });

  it('start 重复调用不会重复订阅', () => {
    bridge.start();
    bridge.start();
    expect(adapter.subscribe).toHaveBeenCalledTimes(1);
  });

  it('状态变更时分发到所有已注册渲染器', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bridge.register('map', cb1);
    bridge.register('battle', cb2);
    bridge.start();

    const state = { timestamp: 1000 };
    adapter.setState(state);

    expect(cb1).toHaveBeenCalledWith(state);
    expect(cb2).toHaveBeenCalledWith(state);
  });

  it('未启动时状态变更不分发', () => {
    const cb = vi.fn();
    bridge.register('map', cb);
    adapter.setState({ timestamp: 1000 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('flush 手动触发一次状态分发', () => {
    const cb = vi.fn();
    bridge.register('map', cb);
    bridge.flush();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('单个渲染器回调异常不影响其他', () => {
    const badCb = vi.fn(() => { throw new Error('回调错误'); });
    const goodCb = vi.fn();
    bridge.register('bad', badCb);
    bridge.register('good', goodCb);
    bridge.start();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    adapter.setState({ timestamp: 1000 });
    warnSpy.mockRestore();

    expect(badCb).toHaveBeenCalled();
    expect(goodCb).toHaveBeenCalled();
  });

  it('destroy 清空所有注册并停止监听', () => {
    const cb = vi.fn();
    bridge.register('map', cb);
    bridge.start();
    bridge.destroy();
    expect(bridge.size).toBe(0);
    expect(bridge.started).toBe(false);
  });
});
