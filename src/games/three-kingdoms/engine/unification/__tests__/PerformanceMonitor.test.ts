/**
 * PerformanceMonitor 测试
 *
 * 覆盖性能监控的3大维度：
 *   - 渲染性能 (#10): FPS 采样+统计
 *   - 内存优化 (#11): 内存采样+对象池
 *   - 加载优化 (#12): 分阶段计时+阈值验证
 *   - 脏矩形管理
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor, ObjectPool, DirtyRectManager } from '../PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(monitor.name).toBe('performance-monitor');
    });

    it('init 不应抛错', () => {
      const mockDeps = {
        eventBus: { on: () => {}, emit: () => {}, off: () => {} },
        config: { get: () => null },
        registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
      };
      expect(() => monitor.init(mockDeps as any)).not.toThrow();
    });

    it('reset 应清除所有数据', () => {
      monitor.start();
      monitor.update(16);
      monitor.reset();
      expect(monitor.isRunning()).toBe(false);
      const state = monitor.getState();
      expect(state.fpsStats.frameCount).toBe(0);
    });

    it('getState 应返回状态', () => {
      const state = monitor.getState();
      expect(state).toHaveProperty('running');
      expect(state).toHaveProperty('fpsStats');
      expect(state).toHaveProperty('memoryStats');
      expect(state).toHaveProperty('poolStates');
    });
  });

  describe('监控控制', () => {
    it('start/stop 应控制运行状态', () => {
      expect(monitor.isRunning()).toBe(false);
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('setConfig 应更新配置', () => {
      monitor.setConfig({ fpsSampleIntervalMs: 1000 });
      const config = monitor.getConfig();
      expect(config.fpsSampleIntervalMs).toBe(1000);
    });
  });

  describe('#10 FPS 监控', () => {
    it('未启动时 FPS 应为 0', () => {
      const stats = monitor.getFPSStats();
      expect(stats.current).toBe(0);
      expect(stats.average).toBe(0);
    });

    it('启动后 update 应采样 FPS', () => {
      monitor.start();
      monitor.update(16);
      monitor.update(16);
      monitor.update(16);
      const stats = monitor.getFPSStats();
      expect(stats.frameCount).toBeGreaterThan(0);
    });

    it('应计算 FPS 统计指标', () => {
      monitor.start();
      for (let i = 0; i < 10; i++) {
        monitor.update(16);
      }
      const stats = monitor.getFPSStats();
      expect(stats.current).toBeGreaterThan(0);
      expect(stats.average).toBeGreaterThan(0);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
      expect(stats.frameCount).toBeGreaterThan(0);
    });

    it('应返回正确的 FPS 警报等级', () => {
      const level = monitor.getFPSAlertLevel();
      expect(level).toMatch(/^(excellent|good|warning|critical)$/);
    });

    it('应记录渲染帧数据', () => {
      monitor.recordRenderFrame(100, 20, 5.5);
      monitor.recordRenderFrame(100, 10, 4.2);
      // 不应抛错
      expect(true).toBe(true);
    });
  });

  describe('#11 内存监控', () => {
    it('应返回内存统计', () => {
      monitor.start();
      monitor.update(16);
      const stats = monitor.getMemoryStats();
      expect(stats).toHaveProperty('currentUsed');
      expect(stats).toHaveProperty('peakUsed');
      expect(stats).toHaveProperty('usageRatio');
    });

    it('应返回内存警报等级', () => {
      const level = monitor.getMemoryAlertLevel();
      expect(level).toMatch(/^(normal|elevated|high|critical)$/);
    });
  });

  describe('#12 加载优化', () => {
    it('应记录加载阶段', () => {
      monitor.startLoadingPhase('initial');
      monitor.endLoadingPhase('initial', 5, 1024000);

      monitor.startLoadingPhase('assets');
      monitor.endLoadingPhase('assets', 20, 5120000);

      const stats = monitor.getLoadingStats();
      expect(stats.phaseDurations.initial).toBeGreaterThan(0);
      expect(stats.phaseDurations.assets).toBeGreaterThan(0);
      expect(stats.totalResources).toBe(25);
      expect(stats.totalBytes).toBe(6144000);
    });

    it('应计算首屏和可交互时间', () => {
      monitor.startLoadingPhase('initial');
      monitor.endLoadingPhase('initial');
      monitor.startLoadingPhase('assets');
      monitor.endLoadingPhase('assets');
      monitor.startLoadingPhase('engine');
      monitor.endLoadingPhase('engine');
      monitor.startLoadingPhase('ui');
      monitor.endLoadingPhase('ui');

      const stats = monitor.getLoadingStats();
      expect(stats.firstScreenMs).toBeGreaterThan(0);
    });

    it('应验证加载阈值', () => {
      monitor.startLoadingPhase('initial');
      monitor.endLoadingPhase('initial');
      const result = monitor.validateLoadingThresholds();
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('violations');
      expect(Array.isArray(result.violations)).toBe(true);
    });
  });

  describe('报告生成', () => {
    it('应生成性能报告', () => {
      monitor.start();
      for (let i = 0; i < 5; i++) {
        monitor.update(16);
      }
      const report = monitor.generateReport();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.fpsStats).toBeDefined();
      expect(report.memoryStats).toBeDefined();
      expect(report.loadingStats).toBeDefined();
      expect(Array.isArray(report.bottlenecks)).toBe(true);
    });
  });
});

describe('ObjectPool', () => {
  interface TestObj { x: number; y: number; active: boolean; }

  it('应预分配对象', () => {
    const pool = new ObjectPool<TestObj>(
      'test',
      () => ({ x: 0, y: 0, active: false }),
      (obj) => { obj.x = 0; obj.y = 0; obj.active = false; },
      5,
    );
    const state = pool.getState();
    expect(state.poolSize).toBe(5);
    expect(state.activeCount).toBe(0);
  });

  it('应分配和回收对象', () => {
    const pool = new ObjectPool<TestObj>(
      'test',
      () => ({ x: 0, y: 0, active: false }),
      (obj) => { obj.x = 0; obj.y = 0; obj.active = false; },
      2,
    );

    const obj1 = pool.allocate();
    obj1.x = 10;
    expect(obj1.x).toBe(10);

    pool.deallocate(obj1);
    expect(obj1.x).toBe(0); // resetFn should have reset it
  });

  it('应扩容当池耗尽', () => {
    const pool = new ObjectPool<TestObj>(
      'test',
      () => ({ x: 0, y: 0, active: false }),
      (obj) => { obj.x = 0; obj.y = 0; obj.active = false; },
      1,
    );

    pool.allocate();
    pool.allocate();
    pool.allocate();

    const state = pool.getState();
    expect(state.poolSize).toBeGreaterThanOrEqual(3);
    expect(state.activeCount).toBe(3);
  });

  it('应计算命中率', () => {
    const pool = new ObjectPool<TestObj>(
      'test',
      () => ({ x: 0, y: 0, active: false }),
      (obj) => { obj.x = 0; obj.y = 0; obj.active = false; },
      5,
    );

    const obj1 = pool.allocate();
    pool.deallocate(obj1);
    pool.allocate(); // 应命中池

    const state = pool.getState();
    expect(state.hitRate).toBeGreaterThan(0);
    expect(state.totalAllocations).toBe(2);
    expect(state.totalDeallocations).toBe(1);
  });

  it('clear 应清空池', () => {
    const pool = new ObjectPool<TestObj>(
      'test',
      () => ({ x: 0, y: 0, active: false }),
      (obj) => { obj.x = 0; obj.y = 0; obj.active = false; },
      5,
    );

    pool.allocate();
    pool.allocate();
    pool.clear();

    const state = pool.getState();
    expect(state.poolSize).toBe(0);
    expect(state.totalAllocations).toBe(0);
  });
});

describe('DirtyRectManager', () => {
  let manager: DirtyRectManager;

  beforeEach(() => {
    manager = new DirtyRectManager();
  });

  it('应标记脏矩形', () => {
    manager.markDirty({ x: 10, y: 10, width: 50, height: 50 });
    const rects = manager.getDirtyRects();
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: 10, y: 10, width: 50, height: 50 });
  });

  it('应标记全量重绘', () => {
    manager.markDirty({ x: 10, y: 10, width: 50, height: 50 });
    manager.markFullRedraw();
    expect(manager.isFullRedraw()).toBe(true);
    expect(manager.getDirtyRects()).toHaveLength(0);
  });

  it('应检查对象是否在脏矩形内', () => {
    manager.markDirty({ x: 0, y: 0, width: 100, height: 100 });
    expect(manager.isObjectDirty(10, 10, 20, 20)).toBe(true);
    expect(manager.isObjectDirty(200, 200, 20, 20)).toBe(false);
  });

  it('全量重绘时所有对象都应标记为脏', () => {
    manager.markFullRedraw();
    expect(manager.isObjectDirty(500, 500, 10, 10)).toBe(true);
  });

  it('merge 应合并重叠矩形', () => {
    manager.markDirty({ x: 0, y: 0, width: 50, height: 50 });
    manager.markDirty({ x: 30, y: 30, width: 50, height: 50 });
    const merged = manager.merge();
    expect(merged.length).toBeLessThanOrEqual(2);
  });

  it('clear 应清除所有脏矩形', () => {
    manager.markDirty({ x: 0, y: 0, width: 50, height: 50 });
    manager.markFullRedraw();
    manager.clear();
    expect(manager.getDirtyRects()).toHaveLength(0);
    expect(manager.isFullRedraw()).toBe(false);
  });
});
