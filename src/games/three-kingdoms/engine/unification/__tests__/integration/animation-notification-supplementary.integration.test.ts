/**
 * 集成测试 — §7 补充验证：动画降级 + 通知系统 + 边界条件
 *
 * 验证动画/画质/性能/视觉一致性系统的集成行为：
 *   §7.1 动画降级 — AnimationAuditor 规范注册/审查 + GraphicsQualityManager 画质降级
 *   §7.2 通知系统 — PerformanceMonitor FPS/内存/加载监控 + 事件通知
 *   §7.3 视觉一致性 — VisualConsistencyChecker 动画+配色综合审查
 *   §7.4 边界条件 — ObjectPool/DirtyRectManager 极端场景
 *
 * 未实现的API使用 it.skip 标注。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnimationAuditor, type RegisteredAnimation } from '../../AnimationAuditor';
import { GraphicsQualityManager } from '../../GraphicsQualityManager';
import { PerformanceMonitor } from '../../PerformanceMonitor';
import { ObjectPool } from '../../ObjectPool';
import { DirtyRectManager } from '../../DirtyRectManager';
import { VisualConsistencyChecker } from '../../VisualConsistencyChecker';
import { InteractionAuditor } from '../../InteractionAuditor';
import { BalanceValidator } from '../../BalanceValidator';
import { GraphicsPreset } from '../../../../core/settings';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { AnimationCategory, AnimationSpec } from '../../../../../core/unification';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockReturnValue(false),
      unregister: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

// ═════════════════════════════════════════════════════════════

describe('§7 补充验证 — 动画降级+通知系统+边界条件 集成测试', () => {

  // ─── §7.1 动画降级 — AnimationAuditor + GraphicsQualityManager ──────

  describe('§7.1 动画降级', () => {
    let auditor: AnimationAuditor;
    let gfxManager: GraphicsQualityManager;

    beforeEach(() => {
      auditor = new AnimationAuditor();
      gfxManager = new GraphicsQualityManager();
      gfxManager.init(mockDeps());
    });

    it('AnimationAuditor注册动画实例后计数正确', () => {
      auditor.registerAnimation('anim-1', 'transition', 300, 'ease-in-out');
      auditor.registerAnimation('anim-2', 'state', 150, 'ease-out');
      expect(auditor.getAnimationCount()).toBe(2);
    });

    it('AnimationAuditor重复注册同一ID不增加计数', () => {
      auditor.registerAnimation('anim-1', 'transition', 300, 'ease-in-out');
      auditor.registerAnimation('anim-1', 'transition', 300, 'ease-in-out');
      expect(auditor.getAnimationCount()).toBe(1);
    });

    it('AnimationAuditor注销动画后计数减少', () => {
      auditor.registerAnimation('anim-1', 'transition', 300, 'ease-in-out');
      auditor.registerAnimation('anim-2', 'state', 150, 'ease-out');
      auditor.unregisterAnimation('anim-1');
      expect(auditor.getAnimationCount()).toBe(1);
    });

    it('GraphicsQualityManager低画质关闭粒子特效和阴影', () => {
      gfxManager.setPreset(GraphicsPreset.Low);
      const config = gfxManager.getPresetConfig();
      expect(config.particleEffects).toBe(false);
      expect(config.realtimeShadows).toBe(false);
      expect(config.antiAliasing).toBe(false);
      expect(config.showAdvancedOptions).toBe(false);
    });

    it('GraphicsQualityManager高画质开启全部特效', () => {
      gfxManager.setPreset(GraphicsPreset.High);
      const config = gfxManager.getPresetConfig();
      expect(config.particleEffects).toBe(true);
      expect(config.realtimeShadows).toBe(true);
      expect(config.inkWash).toBe(true);
      expect(config.antiAliasing).toBe(true);
    });

    it('GraphicsQualityManager切换档位触发水墨过渡', () => {
      const event = gfxManager.setPreset(GraphicsPreset.High);
      expect(event.needsTransition).toBe(true);
      expect(event.newPreset).toBe(GraphicsPreset.High);
      expect(gfxManager.isInkTransitionActive()).toBe(true);
    });

    it('GraphicsQualityManager水墨过渡在update后完成', () => {
      gfxManager.setPreset(GraphicsPreset.High);
      expect(gfxManager.isInkTransitionActive()).toBe(true);
      // 0.6s = 600ms
      gfxManager.update(0.7);
      expect(gfxManager.isInkTransitionActive()).toBe(false);
    });

    it('GraphicsQualityManager自动模式检测设备能力', () => {
      const result = gfxManager.detectDeviceCapability();
      expect(result).toHaveProperty('cpuCores');
      expect(result).toHaveProperty('memoryGB');
      expect(result).toHaveProperty('recommendedPreset');
      expect(result).toHaveProperty('detectedAt');
    });

    it('GraphicsQualityManager高级选项独立控制', () => {
      gfxManager.setParticleEffects(false);
      gfxManager.setRealtimeShadows(true);
      const options = gfxManager.getAdvancedOptions();
      expect(options.particleEffects).toBe(false);
      expect(options.realtimeShadows).toBe(true);
    });

    it('GraphicsQualityManager reset恢复默认', () => {
      gfxManager.setPreset(GraphicsPreset.Low);
      gfxManager.reset();
      expect(gfxManager.getPreset()).toBe(GraphicsPreset.Auto);
    });
  });

  // ─── §7.2 通知系统 — PerformanceMonitor 监控 ──────────

  describe('§7.2 通知系统 — PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
      monitor.init(mockDeps());
    });

    it('PerformanceMonitor启动后isRunning为true', () => {
      expect(monitor.isRunning()).toBe(false);
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
    });

    it('PerformanceMonitor停止后isRunning为false', () => {
      monitor.start();
      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('PerformanceMonitor update采集FPS样本', () => {
      monitor.start();
      monitor.update(0.016);
      monitor.update(0.016);
      const stats = monitor.getFPSStats();
      expect(stats.frameCount).toBeGreaterThan(0);
    });

    it('PerformanceMonitor无样本时FPS统计返回0', () => {
      const stats = monitor.getFPSStats();
      expect(stats.current).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });

    it('PerformanceMonitor加载阶段计时正确', () => {
      monitor.startLoadingPhase('initial');
      monitor.endLoadingPhase('initial', 10, 50000);
      const stats = monitor.getLoadingStats();
      expect(stats.phaseDurations.initial).toBeGreaterThanOrEqual(0);
      expect(stats.totalResources).toBe(10);
      expect(stats.totalBytes).toBe(50000);
    });

    it('PerformanceMonitor生成报告包含完整结构', () => {
      monitor.start();
      monitor.update(0.016);
      const report = monitor.generateReport();
      expect(report.id).toMatch(/^perf_\d+_/);
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.fpsStats).toBeDefined();
      expect(report.memoryStats).toBeDefined();
      expect(report.loadingStats).toBeDefined();
      expect(report.bottlenecks).toBeDefined();
    });

    it('PerformanceMonitor reset清除所有数据', () => {
      monitor.start();
      monitor.update(0.016);
      monitor.reset();
      expect(monitor.isRunning()).toBe(false);
      expect(monitor.getFPSStats().frameCount).toBe(0);
    });

    it('PerformanceMonitor对象池注册和状态查询', () => {
      const pool = new ObjectPool('test-pool', () => ({ val: 0 }), (obj) => { obj.val = 0; }, 5);
      monitor.registerPool('test', pool);
      const states = monitor.getPoolStates();
      expect(states).toHaveLength(1);
      expect(states[0].name).toBe('test-pool');
    });

    it('PerformanceMonitor配置更新生效', () => {
      monitor.setConfig({ fpsSampleIntervalMs: 1000 });
      const config = monitor.getConfig();
      expect(config.fpsSampleIntervalMs).toBe(1000);
    });
  });

  // ─── §7.3 视觉一致性 — VisualConsistencyChecker ──────────

  describe('§7.3 视觉一致性', () => {
    let checker: VisualConsistencyChecker;

    beforeEach(() => {
      checker = new VisualConsistencyChecker();
      checker.init(mockDeps());
    });

    it('VisualConsistencyChecker初始化后包含默认动画规范', () => {
      const specs = checker.getAnimationSpecs();
      expect(specs.length).toBeGreaterThan(0);
    });

    it('VisualConsistencyChecker注册动画实例后计数正确', () => {
      checker.registerAnimation('v-anim-1', 'transition', 300, 'ease-in-out');
      const state = checker.getState();
      expect(state.animationCount).toBe(1);
    });

    it('VisualConsistencyChecker reset清除所有注册', () => {
      checker.registerAnimation('v-anim-1', 'transition', 300, 'ease-in-out');
      checker.addAnimationSpec({ id: 'custom-spec', category: 'feedback', defaultDurationMs: 200, defaultEasing: 'ease-out', toleranceMs: 50 });
      checker.reset();
      const state = checker.getState();
      expect(state.animationCount).toBe(0);
    });

    it('InteractionAuditor初始化后包含默认规则', () => {
      const auditor = new InteractionAuditor();
      auditor.init(mockDeps());
      const state = auditor.getState();
      expect(state.ruleCount).toBeGreaterThan(0);
      expect(state.componentCount).toBe(0);
    });

    it('InteractionAuditor reset恢复默认规则', () => {
      const auditor = new InteractionAuditor();
      auditor.init(mockDeps());
      auditor.reset();
      const state = auditor.getState();
      expect(state.ruleCount).toBeGreaterThan(0);
      expect(state.componentCount).toBe(0);
      expect(state.lastReport).toBeNull();
    });
  });

  // ─── §7.4 边界条件 — ObjectPool/DirtyRectManager ──────────

  describe('§7.4 边界条件', () => {
    it('ObjectPool初始预分配数量正确', () => {
      const pool = new ObjectPool('test', () => ({ v: 0 }), (o) => { o.v = 0; }, 10);
      const state = pool.getState();
      expect(state.poolSize).toBe(10);
      expect(state.activeCount).toBe(0);
    });

    it('ObjectPool分配超过初始大小时自动扩容', () => {
      const pool = new ObjectPool('test', () => ({ v: 0 }), (o) => { o.v = 0; }, 2);
      pool.allocate();
      pool.allocate();
      pool.allocate(); // 超出初始大小
      const state = pool.getState();
      expect(state.activeCount).toBe(3);
      expect(state.poolSize).toBe(3);
    });

    it('ObjectPool回收后可复用', () => {
      const pool = new ObjectPool('test', () => ({ v: 0 }), (o) => { o.v = 0; }, 2);
      const obj = pool.allocate();
      pool.deallocate(obj);
      const state = pool.getState();
      expect(state.activeCount).toBe(0);
      expect(state.totalDeallocations).toBe(1);
    });

    it('ObjectPool命中率统计正确', () => {
      const pool = new ObjectPool('test', () => ({ v: 0 }), (o) => { o.v = 0; }, 2);
      pool.allocate(); // hit from pre-allocated
      pool.allocate(); // hit from pre-allocated
      const state = pool.getState();
      expect(state.hitRate).toBeGreaterThan(0);
      expect(state.totalAllocations).toBe(2);
    });

    it('DirtyRectManager标记和查询脏矩形', () => {
      const drm = new DirtyRectManager();
      drm.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      expect(drm.isObjectDirty(50, 30, 10, 10)).toBe(true);
      expect(drm.isObjectDirty(200, 200, 10, 10)).toBe(false);
    });

    it('DirtyRectManager全量重绘模式', () => {
      const drm = new DirtyRectManager();
      drm.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      drm.markFullRedraw();
      expect(drm.isFullRedraw()).toBe(true);
      expect(drm.getDirtyRects()).toHaveLength(0);
      expect(drm.isObjectDirty(0, 0, 1, 1)).toBe(true);
    });

    it('DirtyRectManager合并重叠矩形', () => {
      const drm = new DirtyRectManager();
      drm.markDirty({ x: 0, y: 0, width: 100, height: 100 });
      drm.markDirty({ x: 50, y: 50, width: 100, height: 100 });
      const merged = drm.merge();
      expect(merged.length).toBe(1);
      expect(merged[0].x).toBe(0);
      expect(merged[0].y).toBe(0);
      expect(merged[0].width).toBe(150);
      expect(merged[0].height).toBe(150);
    });

    it('DirtyRectManager clear清除所有状态', () => {
      const drm = new DirtyRectManager();
      drm.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      drm.markFullRedraw();
      drm.clear();
      expect(drm.isFullRedraw()).toBe(false);
      expect(drm.getDirtyRects()).toHaveLength(0);
    });

    it('BalanceValidator与PerformanceMonitor并行初始化无冲突', () => {
      const balance = new BalanceValidator();
      balance.init(mockDeps());
      const perf = new PerformanceMonitor();
      perf.init(mockDeps());

      const report = balance.validateAll();
      perf.start();
      perf.update(0.016);

      expect(report.entries.length).toBeGreaterThan(0);
      expect(perf.isRunning()).toBe(true);
    });
  });

  // ─── §7.5 未实现功能 (it.skip) ──────────

  describe('§7.5 未实现功能', () => {
    it.skip('动画降级：低画质下动画时长自动缩短（未实现自动降级API）', () => {
      // 需要 GraphicsQualityManager 提供动画降级回调
      const auditor = new AnimationAuditor();
      const gfx = new GraphicsQualityManager();
      gfx.init(mockDeps());
      gfx.setPreset(GraphicsPreset.Low);
      // 期望：auditor 能根据画质档位自动调整动画时长
      expect(true).toBe(false);
    });

    it.skip('通知系统：FPS低于阈值自动发出性能警报事件（未实现事件通知API）', () => {
      // 需要 PerformanceMonitor 在 FPS 低于阈值时自动 emit 事件
      const monitor = new PerformanceMonitor();
      monitor.init(mockDeps());
      monitor.start();
      // 期望：monitor.getFPSAlertLevel() === 'critical' 时自动触发事件
      expect(true).toBe(false);
    });

    it.skip('视觉一致性：配色自动修复建议（未实现自动修复API）', () => {
      // 需要 VisualConsistencyChecker 提供自动修复建议
      const checker = new VisualConsistencyChecker();
      checker.init(mockDeps());
      // 期望：checker.generateFixSuggestions() 返回修复建议列表
      expect(true).toBe(false);
    });
  });
});
