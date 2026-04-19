/**
 * OfflineRewardCalculator — 放置游戏离线收益计算器
 *
 * 统一管理玩家离线期间的资源收益计算，支持多种产出源、
 * 最大离线时间封顶、效率衰减、声望加成和速度倍率。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 可插拔的产出源架构，各子系统（建筑、领土、科技等）可独立注册
 * - 效率衰减机制鼓励玩家回归，防止无限累积
 * - 结果包含详细收益明细，便于 UI 展示来源分解
 *
 * @module engines/idle/modules/OfflineRewardCalculator
 */

// ============================================================
// 类型定义
// ============================================================

/** 产出源定义 */
export interface ProductionSource {
  /** 产出源唯一标识 */
  id: string;
  /** 产出源名称（用于 UI 展示） */
  name: string;
  /** 基础产出 { resourceId: amountPerHour } */
  baseOutput: Record<string, number>;
  /** 产出倍率（默认 1） */
  multiplier?: number;
}

/** 离线收益配置 */
export interface OfflineRewardConfig {
  /** 最大离线时长（小时），默认 24 */
  maxOfflineHours: number;
  /** 效率衰减率（0-1），默认 0（无衰减） */
  efficiencyDecayRate?: number;
  /** 最低效率（0-1），默认 0.5 */
  minEfficiency?: number;
  /** 声望加成倍率 */
  prestigeBonus?: number;
  /** 全局速度倍率 */
  speedMultiplier?: number;
}

/** 单个产出源的收益明细 */
export interface SourceBreakdown {
  /** 产出源 ID */
  sourceId: string;
  /** 产出源名称 */
  sourceName: string;
  /** 该产出源的资源收益 { resourceId: amount } */
  resources: Record<string, number>;
}

/** 离线收益计算结果 */
export interface OfflineRewardResult {
  /** 实际计算时长（毫秒） */
  totalDuration: number;
  /** 封顶后时长（毫秒） */
  cappedDuration: number;
  /** 实际效率（0-1） */
  efficiency: number;
  /** 总收益 { resourceId: amount } */
  resources: Record<string, number>;
  /** 收益来源分解 */
  breakdown: Record<string, SourceBreakdown>;
}

// ============================================================
// OfflineRewardCalculator 实现
// ============================================================

/**
 * 离线收益计算器 — 统一管理离线期间的资源收益计算
 *
 * 核心公式：
 * - 效率衰减：efficiency = max(minEfficiency, 1 - (elapsedHours / maxOfflineHours) * decayRate)
 * - 单产出源收益：resource += baseOutput * sourceMultiplier * speedMultiplier * prestigeBonus * efficiency * hours
 * - 当 decayRate = 0 时，效率始终为 1（无衰减）
 *
 * @example
 * ```typescript
 * const calculator = new OfflineRewardCalculator({
 *   maxOfflineHours: 24,
 *   efficiencyDecayRate: 0.5,
 *   minEfficiency: 0.5,
 * });
 *
 * calculator.addSource({
 *   id: 'lumberMill',
 *   name: '伐木场',
 *   baseOutput: { wood: 100, gold: 10 },
 *   multiplier: 2,
 * });
 *
 * const result = calculator.calculate(12 * 3600 * 1000); // 12 小时
 * console.log(result.resources); // { wood: ..., gold: ... }
 * console.log(result.breakdown['lumberMill']); // 伐木场的收益明细
 * ```
 */
export class OfflineRewardCalculator {

  // ========== 内部数据 ==========

  /** 离线收益配置 */
  private config: OfflineRewardConfig;

  /** 已注册的产出源映射（id → source） */
  private sources: Map<string, ProductionSource> = new Map();

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建离线收益计算器实例
   *
   * @param config - 离线收益配置参数
   */
  constructor(config: OfflineRewardConfig) {
    this.config = {
      maxOfflineHours: config.maxOfflineHours,
      efficiencyDecayRate: config.efficiencyDecayRate ?? 0,
      minEfficiency: config.minEfficiency ?? 0.5,
      prestigeBonus: config.prestigeBonus ?? 1,
      speedMultiplier: config.speedMultiplier ?? 1,
    };
  }

  // ============================================================
  // 产出源管理
  // ============================================================

  /**
   * 注册产出源
   *
   * 如果产出源 ID 已存在，将覆盖原有产出源。
   *
   * @param source - 产出源定义
   */
  addSource(source: ProductionSource): void {
    this.sources.set(source.id, { ...source });
  }

  /**
   * 移除产出源
   *
   * @param sourceId - 要移除的产出源 ID
   * @returns 是否成功移除（false 表示产出源不存在）
   */
  removeSource(sourceId: string): boolean {
    return this.sources.delete(sourceId);
  }

  /**
   * 获取已注册的产出源数量
   *
   * @returns 产出源数量
   */
  getSourceCount(): number {
    return this.sources.size;
  }

  /**
   * 获取所有已注册的产出源
   *
   * 返回产出源的浅拷贝数组，外部修改不会影响内部状态。
   *
   * @returns 产出源数组
   */
  getSources(): ProductionSource[] {
    return Array.from(this.sources.values()).map((s) => ({ ...s }));
  }

  // ============================================================
  // 核心计算
  // ============================================================

  /**
   * 计算离线收益
   *
   * 计算流程：
   * 1. 处理边界条件（零/负时长返回空结果）
   * 2. 对离线时长进行封顶（不超过 maxOfflineHours）
   * 3. 根据衰减公式计算实际效率
   * 4. 遍历所有产出源，计算每种资源的收益
   * 5. 汇总总收益和来源分解
   *
   * @param offlineMs - 离线时长（毫秒）
   * @returns 离线收益计算结果
   */
  calculate(offlineMs: number): OfflineRewardResult {
    // 边界条件：零或负时长
    if (offlineMs <= 0) {
      return {
        totalDuration: offlineMs,
        cappedDuration: 0,
        efficiency: 0,
        resources: {},
        breakdown: {},
      };
    }

    // 封顶离线时长
    const maxOfflineMs = this.config.maxOfflineHours * 3600 * 1000;
    const cappedMs = Math.min(offlineMs, maxOfflineMs);
    const cappedHours = cappedMs / (3600 * 1000);

    // 计算效率衰减
    const efficiency = this.calculateEfficiency(cappedHours);

    // 获取全局倍率
    const speedMultiplier = this.config.speedMultiplier ?? 1;
    const prestigeBonus = this.config.prestigeBonus ?? 1;

    // 汇总结果
    const resources: Record<string, number> = {};
    const breakdown: Record<string, SourceBreakdown> = {};

    for (const source of this.sources.values()) {
      const sourceMultiplier = source.multiplier ?? 1;
      const sourceResources: Record<string, number> = {};

      for (const [resourceId, amountPerHour] of Object.entries(source.baseOutput)) {
        // 单项资源收益 = 基础产出 × 产出源倍率 × 速度倍率 × 声望加成 × 效率 × 小时数
        const amount = amountPerHour * sourceMultiplier * speedMultiplier * prestigeBonus * efficiency * cappedHours;
        sourceResources[resourceId] = amount;

        // 累加到总收益
        resources[resourceId] = (resources[resourceId] ?? 0) + amount;
      }

      breakdown[source.id] = {
        sourceId: source.id,
        sourceName: source.name,
        resources: sourceResources,
      };
    }

    return {
      totalDuration: offlineMs,
      cappedDuration: cappedMs,
      efficiency,
      resources,
      breakdown,
    };
  }

  // ============================================================
  // 配置管理
  // ============================================================

  /**
   * 更新离线收益配置
   *
   * 支持部分更新：仅更新传入的字段，未传入的字段保持当前值。
   *
   * @param config - 要更新的配置字段
   */
  updateConfig(config: Partial<OfflineRewardConfig>): void {
    if (config.maxOfflineHours !== undefined) {
      this.config.maxOfflineHours = config.maxOfflineHours;
    }
    if (config.efficiencyDecayRate !== undefined) {
      this.config.efficiencyDecayRate = config.efficiencyDecayRate;
    }
    if (config.minEfficiency !== undefined) {
      this.config.minEfficiency = config.minEfficiency;
    }
    if (config.prestigeBonus !== undefined) {
      this.config.prestigeBonus = config.prestigeBonus;
    }
    if (config.speedMultiplier !== undefined) {
      this.config.speedMultiplier = config.speedMultiplier;
    }
  }

  /**
   * 获取当前配置的只读快照
   *
   * @returns 离线收益配置对象
   */
  getConfig(): OfflineRewardConfig {
    return { ...this.config };
  }

  // ============================================================
  // 重置
  // ============================================================

  /**
   * 重置所有产出源
   *
   * 清空所有已注册的产出源，配置保持不变。
   */
  reset(): void {
    this.sources.clear();
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /**
   * 计算效率衰减
   *
   * 线性衰减公式：efficiency = max(minEfficiency, 1 - (elapsedHours / maxOfflineHours) * decayRate)
   * 当 decayRate = 0 时，效率始终为 1（无衰减）。
   *
   * @param elapsedHours - 已经过的小时数（已封顶）
   * @returns 效率值（0-1）
   */
  private calculateEfficiency(elapsedHours: number): number {
    const decayRate = this.config.efficiencyDecayRate ?? 0;
    const minEfficiency = this.config.minEfficiency ?? 0.5;

    // 无衰减模式
    if (decayRate <= 0) {
      return 1;
    }

    // 线性衰减
    const efficiency = 1 - (elapsedHours / this.config.maxOfflineHours) * decayRate;
    return Math.max(minEfficiency, Math.min(1, efficiency));
  }
}
