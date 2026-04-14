/**
 * StatisticsTracker — 统计追踪子系统
 *
 * 提供完整的游戏统计数据管理功能，包括统计项定义、聚合更新、
 * 时间序列记录、会话摘要、成就进度回调与序列化/反序列化。
 * 适用于放置游戏中所有场景的统计需求（战斗次数、资源产出、成就进度等）。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 支持 5 种聚合方式（sum / max / min / last / count）
 * - 内置时间序列记录，支持按时间范围查询
 * - 支持成就进度回调，可接入外部成就系统
 * - 完整的序列化 / 反序列化支持
 * - 所有统计项均有类型定义，运行时校验
 *
 * @module engines/idle/modules/StatisticsTracker
 */

// ============================================================
// 类型定义
// ============================================================

/** 统计值类型 */
export type StatValue = number | string | boolean;

/** 聚合方式 */
export type AggregationType = "sum" | "max" | "min" | "last" | "count";

/** 统计项定义 */
export interface StatDefinition {
  /** 统计项唯一标识 */
  id: string;
  /** 显示名称 */
  displayName: string;
  /** 所属类别 */
  category: string;
  /** 值类型 */
  valueType: "number" | "string" | "boolean";
  /** 聚合方式 */
  aggregation: AggregationType;
  /** 初始值 */
  initialValue: StatValue;
  /** 关联的成就 ID 列表 */
  linkedAchievementIds: string[];
  /** 是否持久化（影响序列化策略） */
  persistent: boolean;
}

/** 统计记录（运行时状态） */
export interface StatRecord {
  /** 统计项 ID */
  statId: string;
  /** 当前值 */
  value: StatValue;
  /** 最后更新时间戳（ms） */
  lastUpdated: number;
  /** 累计更新次数 */
  updateCount: number;
}

/** 时间序列数据点 */
export interface TimeSeriesPoint {
  /** 时间戳（ms） */
  timestamp: number;
  /** 数值 */
  value: number;
}

/** 成就进度回调类型 */
export type AchievementProgressCallback = (
  statId: string,
  currentValue: StatValue,
  linkedAchievementIds: string[]
) => void;

// ============================================================
// 内部辅助：序列化数据结构
// ============================================================

/** 序列化用的统计记录结构 */
interface SerializedStatRecord {
  statId: string;
  value: StatValue;
  lastUpdated: number;
  updateCount: number;
}

/** 序列化用的时间序列结构 */
interface SerializedTimeSeries {
  statId: string;
  points: TimeSeriesPoint[];
}

/** 序列化用的完整数据结构 */
interface SerializedData {
  records: SerializedStatRecord[];
  timeSeries: SerializedTimeSeries[];
  sessionStart: number;
  totalUpdates: number;
}

// ============================================================
// StatisticsTracker 实现
// ============================================================

/**
 * 统计追踪子系统
 *
 * 负责管理所有统计项的生命周期：
 * 1. 根据 StatDefinition 初始化统计项
 * 2. 根据 aggregation 类型自动聚合更新
 * 3. 记录时间序列数据（仅 number 类型）
 * 4. 触发成就进度回调
 * 5. 提供序列化 / 反序列化支持
 */
export class StatisticsTracker {
  // ----------------------------------------------------------
  // 私有属性
  // ----------------------------------------------------------

  /** 统计项定义映射（id → definition） */
  private definitions: Map<string, StatDefinition> = new Map();

  /** 统计记录映射（id → record） */
  private records: Map<string, StatRecord> = new Map();

  /** 时间序列映射（id → points） */
  private timeSeries: Map<string, TimeSeriesPoint[]> = new Map();

  /** 成就进度回调列表 */
  private progressCallbacks: AchievementProgressCallback[] = [];

  /** 会话开始时间戳（ms） */
  private sessionStart: number;

  /** 总更新次数 */
  private totalUpdates: number;

  /** 时间序列最大保留点数 */
  private readonly MAX_TIME_SERIES_POINTS = 1000;

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  /**
   * 创建 StatisticsTracker 实例
   *
   * 根据 StatDefinition 数组初始化所有统计项。
   * 每个统计项获得初始值，时间序列为空。
   *
   * @param definitions  统计项定义数组
   */
  constructor(definitions: StatDefinition[]) {
    this.sessionStart = Date.now();
    this.totalUpdates = 0;
    this.definitions = new Map();
    this.records = new Map();
    this.timeSeries = new Map();
    this.progressCallbacks = [];

    for (let i = 0; i < definitions.length; i++) {
      const def = definitions[i];
      this.definitions.set(def.id, def);

      // 初始化记录
      this.records.set(def.id, {
        statId: def.id,
        value: def.initialValue,
        lastUpdated: this.sessionStart,
        updateCount: 0,
      });

      // 初始化时间序列（仅 number 类型）
      if (def.valueType === "number") {
        this.timeSeries.set(def.id, []);
      }
    }
  }

  // ----------------------------------------------------------
  // 公共方法
  // ----------------------------------------------------------

  /**
   * 更新统计项
   *
   * 根据 StatDefinition 中定义的聚合方式处理新值：
   * - sum:   对 number 类型累加
   * - max:   取最大值（number 类型）
   * - min:   取最小值（number 类型）
   * - last:  直接替换为新值
   * - count: 忽略传入值，仅递增计数
   *
   * 更新成功后会触发成就进度回调。
   *
   * @param statId     统计项 ID
   * @param newValue   新值
   * @returns 操作结果 { ok, error? }
   */
  update(statId: string, newValue: StatValue): { ok: boolean; error?: string } {
    const def = this.definitions.get(statId);
    if (!def) {
      return { ok: false, error: `StatDefinition "${statId}" not found` };
    }

    // 类型校验
    if (!this.validateType(newValue, def.valueType)) {
      return {
        ok: false,
        error: `Type mismatch for "${statId}": expected ${def.valueType}, got ${typeof newValue}`,
      };
    }

    const record = this.records.get(statId)!;
    let aggregatedValue: StatValue = newValue;

    switch (def.aggregation) {
      case "sum": {
        if (typeof newValue === "number" && typeof record.value === "number") {
          aggregatedValue = record.value + newValue;
        }
        break;
      }

      case "max": {
        if (typeof newValue === "number" && typeof record.value === "number") {
          aggregatedValue = Math.max(record.value, newValue);
        }
        break;
      }

      case "min": {
        if (typeof newValue === "number" && typeof record.value === "number") {
          aggregatedValue = Math.min(record.value, newValue);
        }
        break;
      }

      case "last": {
        aggregatedValue = newValue;
        break;
      }

      case "count": {
        // count 模式：值始终为递增的数字
        if (typeof record.value === "number") {
          aggregatedValue = record.value + 1;
        } else {
          aggregatedValue = 1;
        }
        break;
      }

      default: {
        aggregatedValue = newValue;
        break;
      }
    }

    // 更新记录
    record.value = aggregatedValue;
    record.lastUpdated = Date.now();
    record.updateCount += 1;
    this.totalUpdates += 1;

    // 记录时间序列（仅 number 类型）
    if (def.valueType === "number" && typeof aggregatedValue === "number") {
      this.appendTimeSeriesPoint(statId, record.lastUpdated, aggregatedValue);
    }

    // 触发成就进度回调
    this.notifyProgress(statId, aggregatedValue, def.linkedAchievementIds);

    return { ok: true };
  }

  /**
   * 增量更新快捷方式
   *
   * 等价于 update(statId, current + delta)。
   * 仅适用于 number 类型的统计项，且聚合方式为 sum。
   * 对于非 number 类型或非 sum 聚合方式，将返回错误。
   *
   * @param statId  统计项 ID
   * @param delta   增量值，默认 1
   * @returns 操作结果 { ok, error? }
   */
  increment(statId: string, delta: number = 1): { ok: boolean; error?: string } {
    const def = this.definitions.get(statId);
    if (!def) {
      return { ok: false, error: `StatDefinition "${statId}" not found` };
    }

    if (def.valueType !== "number") {
      return {
        ok: false,
        error: `Cannot increment non-number stat "${statId}" (type: ${def.valueType})`,
      };
    }

    // increment 适用于 sum 聚合，也兼容 count（count 时忽略 delta）
    if (def.aggregation === "count") {
      return this.update(statId, 0);
    }

    return this.update(statId, delta);
  }

  /**
   * 获取统计项当前值
   *
   * @param statId  统计项 ID
   * @returns 当前值，未找到返回 undefined
   */
  get(statId: string): StatValue | undefined {
    const record = this.records.get(statId);
    return record !== undefined ? record.value : undefined;
  }

  /**
   * 获取统计项完整记录
   *
   * @param statId  统计项 ID
   * @returns 完整记录，未找到返回 undefined
   */
  getRecord(statId: string): StatRecord | undefined {
    const record = this.records.get(statId);
    if (record === undefined) return undefined;
    // 返回副本，防止外部修改内部状态
    return {
      statId: record.statId,
      value: record.value,
      lastUpdated: record.lastUpdated,
      updateCount: record.updateCount,
    };
  }

  /**
   * 按类别获取统计记录
   *
   * @param category  类别名称
   * @returns 该类别下所有统计记录
   */
  getByCategory(category: string): StatRecord[] {
    const result: StatRecord[] = [];
    this.definitions.forEach((def, id) => {
      if (def.category === category) {
        const record = this.records.get(id);
        if (record !== undefined) {
          result.push({
            statId: record.statId,
            value: record.value,
            lastUpdated: record.lastUpdated,
            updateCount: record.updateCount,
          });
        }
      }
    });
    return result;
  }

  /**
   * 获取时间序列数据
   *
   * 仅 number 类型的统计项有时间序列数据。
   * 可通过 since 参数过滤指定时间之后的数据点。
   *
   * @param statId  统计项 ID
   * @param since   起始时间戳（ms），可选
   * @returns 时间序列数据点数组
   */
  getTimeSeries(statId: string, since?: number): TimeSeriesPoint[] {
    const points = this.timeSeries.get(statId);
    if (!points) return [];

    if (since !== undefined) {
      const filtered: TimeSeriesPoint[] = [];
      for (let i = 0; i < points.length; i++) {
        if (points[i].timestamp >= since) {
          filtered.push({
            timestamp: points[i].timestamp,
            value: points[i].value,
          });
        }
      }
      return filtered;
    }

    // 返回副本
    return points.map((p) => ({ timestamp: p.timestamp, value: p.value }));
  }

  /**
   * 获取会话摘要
   *
   * 包含会话时长、总更新次数和 top N 统计项。
   * topStats 按更新次数降序排列，取前 10 个。
   *
   * @returns 会话摘要数据
   */
  getSessionSummary(): {
    sessionDuration: number;
    totalUpdates: number;
    topStats: Array<{ statId: string; displayName: string; value: StatValue }>;
  } {
    const now = Date.now();
    const sessionDuration = now - this.sessionStart;

    // 收集所有统计记录并按 updateCount 降序排序
    const allStats: Array<{
      statId: string;
      displayName: string;
      value: StatValue;
      updateCount: number;
    }> = [];

    this.records.forEach((record, statId) => {
      const def = this.definitions.get(statId);
      if (def) {
        allStats.push({
          statId,
          displayName: def.displayName,
          value: record.value,
          updateCount: record.updateCount,
        });
      }
    });

    // 按 updateCount 降序排序
    allStats.sort((a, b) => b.updateCount - a.updateCount);

    // 取前 10 个
    const topStats = allStats.slice(0, 10).map((s) => ({
      statId: s.statId,
      displayName: s.displayName,
      value: s.value,
    }));

    return {
      sessionDuration,
      totalUpdates: this.totalUpdates,
      topStats,
    };
  }

  /**
   * 注册成就进度回调
   *
   * 每当统计项更新时，如果该统计项关联了成就 ID，
   * 将调用此回调通知外部系统检查成就进度。
   *
   * @param callback  回调函数
   * @returns 取消注册的函数
   */
  onProgress(callback: AchievementProgressCallback): () => void {
    this.progressCallbacks.push(callback);

    // 返回取消函数
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index !== -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 序列化为 JSON 字符串
   *
   * 仅保存 persistent 为 true 的统计项数据和时间序列。
   * 非持久化统计项（如临时会话统计）不会被保存。
   *
   * @returns JSON 字符串
   */
  serialize(): string {
    const serializedRecords: SerializedStatRecord[] = [];
    const serializedTimeSeries: SerializedTimeSeries[] = [];

    this.records.forEach((record, statId) => {
      const def = this.definitions.get(statId);
      // 仅持久化 persistent 为 true 的统计项
      if (def && def.persistent) {
        serializedRecords.push({
          statId: record.statId,
          value: record.value,
          lastUpdated: record.lastUpdated,
          updateCount: record.updateCount,
        });

        // 序列化时间序列
        const points = this.timeSeries.get(statId);
        if (points && points.length > 0) {
          serializedTimeSeries.push({
            statId,
            points: points.map((p) => ({ timestamp: p.timestamp, value: p.value })),
          });
        }
      }
    });

    const data: SerializedData = {
      records: serializedRecords,
      timeSeries: serializedTimeSeries,
      sessionStart: this.sessionStart,
      totalUpdates: this.totalUpdates,
    };

    return JSON.stringify(data);
  }

  /**
   * 从 JSON 字符串恢复状态
   *
   * 仅恢复 persistent 为 true 的统计项数据。
   * 如果 JSON 格式错误或数据不合法，返回错误信息。
   *
   * @param json  serialize() 输出的 JSON 字符串
   * @returns 操作结果 { ok, error? }
   */
  deserialize(json: string): { ok: boolean; error?: string } {
    let data: SerializedData;
    try {
      data = JSON.parse(json) as SerializedData;
    } catch (e) {
      return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
    }

    // 校验基本结构
    if (!data || !Array.isArray(data.records)) {
      return { ok: false, error: "Invalid data structure: missing records array" };
    }

    // 恢复统计记录
    for (let i = 0; i < data.records.length; i++) {
      const rec = data.records[i];
      const def = this.definitions.get(rec.statId);
      if (!def) {
        // 忽略不存在的统计项（可能是旧版本数据）
        continue;
      }

      if (!def.persistent) {
        // 忽略非持久化统计项
        continue;
      }

      // 类型校验
      if (!this.validateType(rec.value, def.valueType)) {
        continue;
      }

      const record = this.records.get(rec.statId);
      if (record) {
        record.value = rec.value;
        record.lastUpdated = rec.lastUpdated;
        record.updateCount = rec.updateCount;
      }
    }

    // 恢复时间序列
    if (Array.isArray(data.timeSeries)) {
      for (let i = 0; i < data.timeSeries.length; i++) {
        const ts = data.timeSeries[i];
        if (ts.statId && Array.isArray(ts.points)) {
          const def = this.definitions.get(ts.statId);
          if (def && def.persistent && def.valueType === "number") {
            this.timeSeries.set(
              ts.statId,
              ts.points.map((p) => ({ timestamp: p.timestamp, value: p.value }))
            );
          }
        }
      }
    }

    // 恢复会话元数据
    if (typeof data.sessionStart === "number") {
      this.sessionStart = data.sessionStart;
    }
    if (typeof data.totalUpdates === "number") {
      this.totalUpdates = data.totalUpdates;
    }

    return { ok: true };
  }

  /**
   * 重置所有统计项到初始值
   *
   * 清空时间序列数据，重置会话计时器，
   * 但保留统计项定义和回调注册。
   */
  reset(): void {
    this.sessionStart = Date.now();
    this.totalUpdates = 0;

    this.definitions.forEach((def, id) => {
      this.records.set(id, {
        statId: id,
        value: def.initialValue,
        lastUpdated: this.sessionStart,
        updateCount: 0,
      });

      if (def.valueType === "number") {
        this.timeSeries.set(id, []);
      }
    });

    // 清除非 number 类型的时间序列
    this.timeSeries.forEach((_points, id) => {
      const def = this.definitions.get(id);
      if (!def || def.valueType !== "number") {
        this.timeSeries.delete(id);
      }
    });
  }

  /**
   * 获取所有统计项定义
   *
   * @returns 统计项定义数组
   */
  getAllDefinitions(): StatDefinition[] {
    const result: StatDefinition[] = [];
    this.definitions.forEach((def) => {
      result.push({ ...def });
    });
    return result;
  }

  /**
   * 获取所有类别名称
   *
   * @returns 去重后的类别名称数组
   */
  getCategories(): string[] {
    const categorySet = new Set<string>();
    this.definitions.forEach((def) => {
      categorySet.add(def.category);
    });
    return Array.from(categorySet);
  }

  // ----------------------------------------------------------
  // 私有方法
  // ----------------------------------------------------------

  /**
   * 校验值类型是否匹配
   *
   * @param value     待校验的值
   * @param expected  期望的值类型名称
   * @returns 是否匹配
   */
  private validateType(value: StatValue, expected: string): boolean {
    return typeof value === expected;
  }

  /**
   * 追加时间序列数据点
   *
   * 自动限制最大点数，超出时移除最旧的点。
   *
   * @param statId     统计项 ID
   * @param timestamp  时间戳（ms）
   * @param value      数值
   */
  private appendTimeSeriesPoint(statId: string, timestamp: number, value: number): void {
    let points = this.timeSeries.get(statId);
    if (!points) {
      points = [];
      this.timeSeries.set(statId, points);
    }

    points.push({ timestamp, value });

    // 超出最大点数时移除最旧的
    if (points.length > this.MAX_TIME_SERIES_POINTS) {
      const excess = points.length - this.MAX_TIME_SERIES_POINTS;
      points.splice(0, excess);
    }
  }

  /**
   * 通知成就进度回调
   *
   * @param statId               统计项 ID
   * @param currentValue         当前值
   * @param linkedAchievementIds 关联的成就 ID 列表
   */
  private notifyProgress(
    statId: string,
    currentValue: StatValue,
    linkedAchievementIds: string[]
  ): void {
    if (linkedAchievementIds.length === 0) return;

    for (let i = 0; i < this.progressCallbacks.length; i++) {
      try {
        this.progressCallbacks[i](statId, currentValue, linkedAchievementIds);
      } catch (_e) {
        // 回调异常不应影响统计更新流程
      }
    }
  }
}
