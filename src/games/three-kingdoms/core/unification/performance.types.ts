/**
 * 核心层 — v20.0 性能监控类型定义
 *
 * 涵盖 PerformanceMonitor 的所有类型：
 *   - 渲染性能 (#10)
 *   - 内存优化 (#11)
 *   - 加载优化 (#12)
 *
 * @module core/unification/performance.types
 */

// ─────────────────────────────────────────────
// 1. FPS 监控
// ─────────────────────────────────────────────

/** FPS 帧采样数据 */
export interface FPSSample {
  /** 时间戳 (ms) */
  timestamp: number;
  /** 帧间隔 (ms) */
  deltaMs: number;
  /** 计算得出的 FPS */
  fps: number;
}

/** FPS 统计数据 */
export interface FPSStats {
  /** 当前 FPS */
  current: number;
  /** 平均 FPS */
  average: number;
  /** 最低 FPS */
  min: number;
  /** 最高 FPS */
  max: number;
  /** 1% Low FPS */
  onePercentLow: number;
  /** 帧数 */
  frameCount: number;
  /** 采样时长 (ms) */
  durationMs: number;
}

/** FPS 警戒等级 */
export type FPSAlertLevel = 'excellent' | 'good' | 'warning' | 'critical';

/** FPS 阈值配置 */
export interface FPSThresholds {
  /** 优秀 (≥60fps) */
  excellent: number;
  /** 良好 (≥45fps) */
  good: number;
  /** 警告 (≥30fps) */
  warning: number;
  /** 临界 (<30fps) */
  critical: number;
}

// ─────────────────────────────────────────────
// 2. 内存监控
// ─────────────────────────────────────────────

/** 内存采样数据 */
export interface MemorySample {
  /** 时间戳 (ms) */
  timestamp: number;
  /** 已使用堆内存 (bytes) */
  usedHeapSize: number;
  /** 总堆内存 (bytes) */
  totalHeapSize: number;
  /** 堆内存限制 (bytes) */
  heapSizeLimit: number;
  /** 使用率 (0~1) */
  usageRatio: number;
}

/** 内存统计 */
export interface MemoryStats {
  /** 当前使用量 (bytes) */
  currentUsed: number;
  /** 峰值使用量 (bytes) */
  peakUsed: number;
  /** 平均使用量 (bytes) */
  averageUsed: number;
  /** 内存限制 (bytes) */
  limit: number;
  /** 当前使用率 (0~1) */
  usageRatio: number;
  /** GC 触发次数 */
  gcCount: number;
  /** 采样数 */
  sampleCount: number;
}

/** 内存警报等级 */
export type MemoryAlertLevel = 'normal' | 'elevated' | 'high' | 'critical';

/** 内存阈值配置 */
export interface MemoryThresholds {
  /** 正常 (<60%) */
  normal: number;
  /** 升高 (60~80%) */
  elevated: number;
  /** 高 (80~90%) */
  high: number;
  /** 临界 (>90%) */
  critical: number;
}

// ─────────────────────────────────────────────
// 3. 加载时间监控
// ─────────────────────────────────────────────

/** 加载阶段 */
export type LoadingPhase =
  | 'initial'      // 初始化
  | 'assets'       // 资源加载
  | 'engine'       // 引擎初始化
  | 'ui'           // UI 渲染
  | 'first_frame'  // 首帧渲染
  | 'interactive'; // 可交互

/** 加载时间记录 */
export interface LoadingRecord {
  /** 阶段 */
  phase: LoadingPhase;
  /** 开始时间 (ms) */
  startMs: number;
  /** 结束时间 (ms) */
  endMs: number;
  /** 耗时 (ms) */
  durationMs: number;
  /** 加载资源数 */
  resourceCount: number;
  /** 总字节数 */
  totalBytes: number;
}

/** 加载统计 */
export interface LoadingStats {
  /** 首屏时间 (ms) */
  firstScreenMs: number;
  /** 可交互时间 (ms) */
  interactiveMs: number;
  /** 各阶段耗时 */
  phaseDurations: Record<LoadingPhase, number>;
  /** 总资源数 */
  totalResources: number;
  /** 总字节数 */
  totalBytes: number;
  /** 缓存命中率 */
  cacheHitRate: number;
}

/** 加载阈值配置 */
export interface LoadingThresholds {
  /** 首屏时间上限 (ms) */
  firstScreenMaxMs: number;
  /** 可交互时间上限 (ms) */
  interactiveMaxMs: number;
  /** 单阶段时间上限 (ms) */
  phaseMaxMs: number;
}

// ─────────────────────────────────────────────
// 4. 性能报告
// ─────────────────────────────────────────────

/** 性能瓶颈 */
export interface PerformanceBottleneck {
  /** 瓶颈类型 */
  type: 'fps' | 'memory' | 'loading';
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high';
  /** 位置描述 */
  location: string;
  /** 建议优化方案 */
  suggestion: string;
  /** 关联指标值 */
  metricValue: number;
  /** 阈值 */
  threshold: number;
}

/** 性能报告 */
export interface PerformanceReport {
  /** 报告 ID */
  id: string;
  /** 生成时间戳 */
  timestamp: number;
  /** FPS 统计 */
  fpsStats: FPSStats;
  /** 内存统计 */
  memoryStats: MemoryStats;
  /** 加载统计 */
  loadingStats: LoadingStats;
  /** 瓶颈列表 */
  bottlenecks: PerformanceBottleneck[];
  /** 总体评分 (0~100) */
  overallScore: number;
}

/** 性能监控配置 */
export interface PerformanceMonitorConfig {
  /** FPS 采样间隔 (ms) */
  fpsSampleIntervalMs: number;
  /** FPS 采样窗口大小 */
  fpsSampleWindowSize: number;
  /** 内存采样间隔 (ms) */
  memorySampleIntervalMs: number;
  /** FPS 阈值 */
  fpsThresholds: FPSThresholds;
  /** 内存阈值 */
  memoryThresholds: MemoryThresholds;
  /** 加载阈值 */
  loadingThresholds: LoadingThresholds;
}

// ─────────────────────────────────────────────
// 5. 对象池 & 脏矩形
// ─────────────────────────────────────────────

/** 对象池状态 */
export interface ObjectPoolState {
  /** 池名称 */
  name: string;
  /** 当前池大小 */
  poolSize: number;
  /** 活跃对象数 */
  activeCount: number;
  /** 总分配次数 */
  totalAllocations: number;
  /** 总回收次数 */
  totalDeallocations: number;
  /** 命中率 */
  hitRate: number;
}

/** 脏矩形数据 */
export interface DirtyRect {
  /** X 坐标 */
  x: number;
  /** Y 坐标 */
  y: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
}

/** 渲染帧数据 */
export interface RenderFrameData {
  /** 帧序号 */
  frameIndex: number;
  /** 脏矩形列表 */
  dirtyRects: DirtyRect[];
  /** 总渲染对象数 */
  totalObjects: number;
  /** 跳过渲染对象数（不在脏矩形内） */
  skippedObjects: number;
  /** 渲染耗时 (ms) */
  renderTimeMs: number;
}
