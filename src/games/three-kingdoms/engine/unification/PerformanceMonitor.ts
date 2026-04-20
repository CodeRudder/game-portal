/**
 * 引擎层 — 性能监控器
 *
 * 实时监控 FPS/内存/加载时间，定位瓶颈并生成报告：
 *   - 渲染性能 (#10): FPS 采样+统计+60fps 目标验证
 *   - 内存优化 (#11): 堆内存采样+对象池+GC控制
 *   - 加载优化 (#12): 分阶段计时+缓存命中率+首屏<3s 验证
 *   - 脏矩形管理: 标记变化区域，减少重绘
 *   - 对象池管理: 粒子/飘字/子弹复用
 *
 * @module engine/unification/PerformanceMonitor
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  FPSSample,
  FPSStats,
  FPSAlertLevel,
  FPSThresholds,
  MemorySample,
  MemoryStats,
  MemoryAlertLevel,
  MemoryThresholds,
  LoadingPhase,
  LoadingRecord,
  LoadingStats,
  LoadingThresholds,
  PerformanceBottleneck,
  PerformanceReport,
  PerformanceMonitorConfig,
  ObjectPoolState,
  DirtyRect,
  RenderFrameData,
} from '../../core/unification';

// ─────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────

const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  fpsSampleIntervalMs: 500,
  fpsSampleWindowSize: 60,
  memorySampleIntervalMs: 2000,
  fpsThresholds: { excellent: 60, good: 45, warning: 30, critical: 15 },
  memoryThresholds: { normal: 0.6, elevated: 0.8, high: 0.9, critical: 0.95 },
  loadingThresholds: { firstScreenMaxMs: 3000, interactiveMaxMs: 5000, phaseMaxMs: 1500 },
};

// ─────────────────────────────────────────────
// 对象池实现
// ─────────────────────────────────────────────

/** 对象池条目 */
interface PoolEntry<T> {
  object: T;
  active: boolean;
}

/**
 * 通用对象池
 *
 * 用于粒子、飘字、子弹等高频创建/销毁对象的复用。
 */
export class ObjectPool<T> {
  private pool: PoolEntry<T>[] = [];
  private factory: () => T;
  private resetFn: (obj: T) => void;
  private name: string;
  private totalAllocations = 0;
  private totalDeallocations = 0;
  private hits = 0;
  private misses = 0;

  constructor(name: string, factory: () => T, resetFn: (obj: T) => void, initialSize: number = 10) {
    this.name = name;
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push({ object: this.factory(), active: false });
    }
  }

  /** 分配一个对象 */
  allocate(): T {
    this.totalAllocations++;
    const inactive = this.pool.find(e => !e.active);
    if (inactive) {
      inactive.active = true;
      this.hits++;
      this.resetFn(inactive.object);
      return inactive.object;
    }
    this.misses++;
    const obj = this.factory();
    this.pool.push({ object: obj, active: true });
    return obj;
  }

  /** 回收一个对象 */
  deallocate(obj: T): void {
    const entry = this.pool.find(e => e.object === obj);
    if (entry) {
      entry.active = false;
      this.totalDeallocations++;
      this.resetFn(obj);
    }
  }

  /** 获取池状态 */
  getState(): ObjectPoolState {
    const activeCount = this.pool.filter(e => e.active).length;
    return {
      name: this.name,
      poolSize: this.pool.length,
      activeCount,
      totalAllocations: this.totalAllocations,
      totalDeallocations: this.totalDeallocations,
      hitRate: this.totalAllocations > 0 ? this.hits / this.totalAllocations : 0,
    };
  }

  /** 清空池 */
  clear(): void {
    this.pool = [];
    this.totalAllocations = 0;
    this.totalDeallocations = 0;
    this.hits = 0;
    this.misses = 0;
  }
}

// ─────────────────────────────────────────────
// 脏矩形管理器
// ─────────────────────────────────────────────

/**
 * 脏矩形管理器
 *
 * 跟踪画面变化区域，仅重绘脏区域以优化渲染性能。
 */
export class DirtyRectManager {
  private dirtyRects: DirtyRect[] = [];
  private fullRedrawNeeded = false;

  /** 标记一个区域为脏 */
  markDirty(rect: DirtyRect): void {
    this.dirtyRects.push(rect);
  }

  /** 标记整个画面需要重绘 */
  markFullRedraw(): void {
    this.fullRedrawNeeded = true;
    this.dirtyRects = [];
  }

  /** 获取当前脏矩形 */
  getDirtyRects(): DirtyRect[] {
    return this.fullRedrawNeeded ? [] : [...this.dirtyRects];
  }

  /** 是否需要全量重绘 */
  isFullRedraw(): boolean {
    return this.fullRedrawNeeded;
  }

  /** 检查对象是否在脏矩形内 */
  isObjectDirty(x: number, y: number, width: number, height: number): boolean {
    if (this.fullRedrawNeeded) return true;
    return this.dirtyRects.some(r =>
      r.x < x + width && r.x + r.width > x &&
      r.y < y + height && r.y + r.height > y,
    );
  }

  /** 合并重叠的脏矩形 */
  merge(): DirtyRect[] {
    if (this.fullRedrawNeeded || this.dirtyRects.length === 0) {
      return [];
    }

    const merged: DirtyRect[] = [];
    const sorted = [...this.dirtyRects].sort((a, b) => a.x - b.x || a.y - b.y);

    for (const rect of sorted) {
      const overlap = merged.find(m =>
        m.x < rect.x + rect.width && m.x + m.width > rect.x &&
        m.y < rect.y + rect.height && m.y + m.height > rect.y,
      );
      if (overlap) {
        const x = Math.min(overlap.x, rect.x);
        const y = Math.min(overlap.y, rect.y);
        overlap.x = x;
        overlap.y = y;
        overlap.width = Math.max(overlap.x + overlap.width, rect.x + rect.width) - x;
        overlap.height = Math.max(overlap.y + overlap.height, rect.y + rect.height) - y;
      } else {
        merged.push({ ...rect });
      }
    }

    this.dirtyRects = merged;
    return merged;
  }

  /** 清除所有脏矩形（每帧渲染后调用） */
  clear(): void {
    this.dirtyRects = [];
    this.fullRedrawNeeded = false;
  }
}

// ─────────────────────────────────────────────
// 性能监控器
// ─────────────────────────────────────────────

/**
 * 性能监控器
 *
 * FPS/内存/加载时间实时监控 + 瓶颈定位 + 报告生成。
 */
export class PerformanceMonitor implements ISubsystem {
  readonly name = 'performance-monitor';

  private deps!: ISystemDeps;
  private config: PerformanceMonitorConfig = DEFAULT_CONFIG;
  private running = false;

  // FPS 采样
  private fpsSamples: FPSSample[] = [];
  private lastFrameTime = 0;

  // 内存采样
  private memorySamples: MemorySample[] = [];
  private peakMemory = 0;

  // 加载记录
  private loadingRecords: LoadingRecord[] = [];
  private loadingPhaseStarts = new Map<LoadingPhase, number>();

  // 对象池注册
  private pools = new Map<string, ObjectPool<unknown>>();

  // 脏矩形管理
  private dirtyRectManager = new DirtyRectManager();

  // 渲染帧数据
  private frameData: RenderFrameData[] = [];
  private frameIndex = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    if (!this.running) return;

    // FPS 采样
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const deltaMs = now - this.lastFrameTime;
      const fps = 1000 / deltaMs;

      this.fpsSamples.push({ timestamp: now, deltaMs, fps });

      // 保持窗口大小
      if (this.fpsSamples.length > this.config.fpsSampleWindowSize) {
        this.fpsSamples.shift();
      }
    }
    this.lastFrameTime = now;

    // 内存采样（低频）
    if (this.memorySamples.length === 0 ||
      now - this.memorySamples[this.memorySamples.length - 1].timestamp > this.config.memorySampleIntervalMs) {
      this.sampleMemory(now);
    }
  }

  getState(): {
    running: boolean;
    fpsStats: FPSStats;
    memoryStats: MemoryStats;
    poolStates: ObjectPoolState[];
  } {
    return {
      running: this.running,
      fpsStats: this.getFPSStats(),
      memoryStats: this.getMemoryStats(),
      poolStates: this.getPoolStates(),
    };
  }

  reset(): void {
    this.fpsSamples = [];
    this.memorySamples = [];
    this.loadingRecords = [];
    this.loadingPhaseStarts.clear();
    this.frameData = [];
    this.frameIndex = 0;
    this.lastFrameTime = 0;
    this.peakMemory = 0;
    this.running = false;
    this.pools.clear();
    this.dirtyRectManager.clear();
  }

  // ─── 监控控制 ──────────────────────────────

  /** 开始监控 */
  start(): void {
    this.running = true;
    this.lastFrameTime = performance.now();
  }

  /** 停止监控 */
  stop(): void {
    this.running = false;
  }

  /** 是否正在运行 */
  isRunning(): boolean {
    return this.running;
  }

  /** 更新配置 */
  setConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取配置 */
  getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  // ─── FPS 监控 (#10) ───────────────────────

  /** 获取 FPS 统计 */
  getFPSStats(): FPSStats {
    if (this.fpsSamples.length === 0) {
      return {
        current: 0, average: 0, min: 0, max: 0,
        onePercentLow: 0, frameCount: 0, durationMs: 0,
      };
    }

    const samples = this.fpsSamples;
    const fpsValues = samples.map(s => s.fps);
    const sorted = [...fpsValues].sort((a, b) => a - b);

    const current = samples[samples.length - 1].fps;
    const average = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const onePercentLowIdx = Math.max(0, Math.floor(sorted.length * 0.01));
    const onePercentLow = sorted[onePercentLowIdx];
    const durationMs = samples.length > 1
      ? samples[samples.length - 1].timestamp - samples[0].timestamp
      : 0;

    return {
      current: Math.round(current * 10) / 10,
      average: Math.round(average * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      onePercentLow: Math.round(onePercentLow * 10) / 10,
      frameCount: samples.length,
      durationMs,
    };
  }

  /** 获取 FPS 警报等级 */
  getFPSAlertLevel(): FPSAlertLevel {
    const stats = this.getFPSStats();
    const t = this.config.fpsThresholds;
    if (stats.average >= t.excellent) return 'excellent';
    if (stats.average >= t.good) return 'good';
    if (stats.average >= t.warning) return 'warning';
    return 'critical';
  }

  /** 记录渲染帧数据 */
  recordRenderFrame(totalObjects: number, skippedObjects: number, renderTimeMs: number): void {
    this.frameIndex++;
    this.frameData.push({
      frameIndex: this.frameIndex,
      dirtyRects: this.dirtyRectManager.getDirtyRects(),
      totalObjects,
      skippedObjects,
      renderTimeMs,
    });

    // 保留最近100帧
    if (this.frameData.length > 100) {
      this.frameData.shift();
    }
  }

  // ─── 内存监控 (#11) ───────────────────────

  /** 获取内存统计 */
  getMemoryStats(): MemoryStats {
    if (this.memorySamples.length === 0) {
      return {
        currentUsed: 0, peakUsed: 0, averageUsed: 0,
        limit: 0, usageRatio: 0, gcCount: 0, sampleCount: 0,
      };
    }

    const samples = this.memorySamples;
    const current = samples[samples.length - 1];
    const usedValues = samples.map(s => s.usedHeapSize);
    const averageUsed = usedValues.reduce((a, b) => a + b, 0) / usedValues.length;

    return {
      currentUsed: current.usedHeapSize,
      peakUsed: this.peakMemory,
      averageUsed: Math.floor(averageUsed),
      limit: current.heapSizeLimit,
      usageRatio: current.usageRatio,
      gcCount: 0, // GC 次数无法直接测量
      sampleCount: samples.length,
    };
  }

  /** 获取内存警报等级 */
  getMemoryAlertLevel(): MemoryAlertLevel {
    const stats = this.getMemoryStats();
    const t = this.config.memoryThresholds;
    if (stats.usageRatio >= t.critical) return 'critical';
    if (stats.usageRatio >= t.high) return 'high';
    if (stats.usageRatio >= t.elevated) return 'elevated';
    return 'normal';
  }

  /** 内存采样 */
  private sampleMemory(now: number): void {
    // 使用 performance.memory（Chrome）或模拟
    const perf = performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } };
    if (perf.memory) {
      const m = perf.memory;
      const sample: MemorySample = {
        timestamp: now,
        usedHeapSize: m.usedJSHeapSize,
        totalHeapSize: m.totalJSHeapSize,
        heapSizeLimit: m.jsHeapSizeLimit,
        usageRatio: m.usedJSHeapSize / m.jsHeapSizeLimit,
      };
      this.memorySamples.push(sample);
      this.peakMemory = Math.max(this.peakMemory, m.usedJSHeapSize);
    } else {
      // 无 performance.memory 时使用模拟值
      const estimated = 50 * 1024 * 1024; // 50MB 估算
      const sample: MemorySample = {
        timestamp: now,
        usedHeapSize: estimated,
        totalHeapSize: estimated * 2,
        heapSizeLimit: 512 * 1024 * 1024,
        usageRatio: estimated / (512 * 1024 * 1024),
      };
      this.memorySamples.push(sample);
      this.peakMemory = Math.max(this.peakMemory, estimated);
    }

    // 保留最近 500 个样本
    if (this.memorySamples.length > 500) {
      this.memorySamples.shift();
    }
  }

  // ─── 加载优化 (#12) ───────────────────────

  /** 开始加载阶段计时 */
  startLoadingPhase(phase: LoadingPhase): void {
    this.loadingPhaseStarts.set(phase, performance.now());
  }

  /** 结束加载阶段计时 */
  endLoadingPhase(phase: LoadingPhase, resourceCount: number = 0, totalBytes: number = 0): void {
    const startMs = this.loadingPhaseStarts.get(phase);
    if (startMs === undefined) return;

    const endMs = performance.now();
    this.loadingRecords.push({
      phase,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      resourceCount,
      totalBytes,
    });
    this.loadingPhaseStarts.delete(phase);
  }

  /** 获取加载统计 */
  getLoadingStats(): LoadingStats {
    const phaseDurations: Record<LoadingPhase, number> = {
      initial: 0, assets: 0, engine: 0, ui: 0, first_frame: 0, interactive: 0,
    };

    let totalResources = 0;
    let totalBytes = 0;

    for (const record of this.loadingRecords) {
      phaseDurations[record.phase] = record.durationMs;
      totalResources += record.resourceCount;
      totalBytes += record.totalBytes;
    }

    const firstScreenMs = phaseDurations.initial + phaseDurations.assets + phaseDurations.engine + phaseDurations.ui;
    const interactiveMs = firstScreenMs + phaseDurations.first_frame + phaseDurations.interactive;

    return {
      firstScreenMs,
      interactiveMs,
      phaseDurations,
      totalResources,
      totalBytes,
      cacheHitRate: 0,
    };
  }

  /** 验证加载阈值 */
  validateLoadingThresholds(): { passed: boolean; violations: string[] } {
    const stats = this.getLoadingStats();
    const t = this.config.loadingThresholds;
    const violations: string[] = [];

    if (stats.firstScreenMs > t.firstScreenMaxMs) {
      violations.push(`First screen time ${stats.firstScreenMs.toFixed(0)}ms exceeds ${t.firstScreenMaxMs}ms`);
    }
    if (stats.interactiveMs > t.interactiveMaxMs) {
      violations.push(`Interactive time ${stats.interactiveMs.toFixed(0)}ms exceeds ${t.interactiveMaxMs}ms`);
    }

    for (const [phase, duration] of Object.entries(stats.phaseDurations)) {
      if (duration > t.phaseMaxMs) {
        violations.push(`Phase ${phase} took ${duration.toFixed(0)}ms exceeds ${t.phaseMaxMs}ms`);
      }
    }

    return { passed: violations.length === 0, violations };
  }

  // ─── 对象池管理 ────────────────────────────

  /** 注册对象池 */
  registerPool<T>(name: string, pool: ObjectPool<T>): void {
    this.pools.set(name, pool as ObjectPool<unknown>);
  }

  /** 获取所有池状态 */
  getPoolStates(): ObjectPoolState[] {
    return Array.from(this.pools.values()).map(p => p.getState());
  }

  // ─── 脏矩形管理 ────────────────────────────

  /** 获取脏矩形管理器 */
  getDirtyRectManager(): DirtyRectManager {
    return this.dirtyRectManager;
  }

  // ─── 报告生成 ──────────────────────────────

  /** 生成性能报告 */
  generateReport(): PerformanceReport {
    const fpsStats = this.getFPSStats();
    const memoryStats = this.getMemoryStats();
    const loadingStats = this.getLoadingStats();
    const bottlenecks = this.identifyBottlenecks(fpsStats, memoryStats, loadingStats);

    // 计算综合评分
    let score = 100;
    score -= bottlenecks.filter(b => b.severity === 'high').length * 15;
    score -= bottlenecks.filter(b => b.severity === 'medium').length * 8;
    score -= bottlenecks.filter(b => b.severity === 'low').length * 3;
    score = Math.max(0, Math.min(100, score));

    return {
      id: `perf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      fpsStats,
      memoryStats,
      loadingStats,
      bottlenecks,
      overallScore: score,
    };
  }

  /** 识别瓶颈 */
  private identifyBottlenecks(
    fps: FPSStats,
    memory: MemoryStats,
    loading: LoadingStats,
  ): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];
    const t = this.config;

    // FPS 瓶颈
    if (fps.average < t.fpsThresholds.warning) {
      bottlenecks.push({
        type: 'fps',
        severity: fps.average < t.fpsThresholds.critical ? 'high' : 'medium',
        location: 'Main render loop',
        suggestion: 'Reduce draw calls, enable dirty rect optimization, lower particle count',
        metricValue: fps.average,
        threshold: t.fpsThresholds.warning,
      });
    }

    // 内存瓶颈
    if (memory.usageRatio > t.memoryThresholds.elevated) {
      bottlenecks.push({
        type: 'memory',
        severity: memory.usageRatio > t.memoryThresholds.critical ? 'high' : 'medium',
        location: 'Heap memory',
        suggestion: 'Check for memory leaks, use object pools, reduce texture sizes',
        metricValue: memory.usageRatio,
        threshold: t.memoryThresholds.elevated,
      });
    }

    // 加载瓶颈
    if (loading.firstScreenMs > t.loadingThresholds.firstScreenMaxMs) {
      bottlenecks.push({
        type: 'loading',
        severity: loading.firstScreenMs > t.loadingThresholds.firstScreenMaxMs * 2 ? 'high' : 'medium',
        location: 'First screen loading',
        suggestion: 'Use code splitting, lazy load assets, increase cache hit rate',
        metricValue: loading.firstScreenMs,
        threshold: t.loadingThresholds.firstScreenMaxMs,
      });
    }

    return bottlenecks;
  }
}
