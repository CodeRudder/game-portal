/**
 * SeasonSystem — 放置游戏季节循环系统（P2）
 *
 * 管理季节轮换、产出倍率、效果应用、年度追踪、存档/读档。
 * 零外部依赖，纯回调数组实现事件监听。
 *
 * @module engines/idle/modules/SeasonSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 季节效果 */
export interface SeasonEffect {
  type: 'frost' | 'drought' | 'abundance' | 'storm' | 'calm';
  targetResource: string;
  value: number;
  description: string;
}

/** 季节定义 */
export interface Season {
  id: string;
  name: string;
  icon: string;
  multipliers: Record<string, number>;
  duration: number;
  effects: SeasonEffect[];
  colorTheme: { primary: string; secondary: string; background: string };
}

/** 季节历史记录 */
export interface SeasonRecord {
  seasonId: string;
  year: number;
  startedAt: number;
  endedAt: number;
}

/** 季节系统持久化状态 */
export interface SeasonState {
  current: string;
  elapsed: number;
  year: number;
  history: SeasonRecord[];
}

/** 季节系统事件 */
export interface SeasonEvent {
  type: 'season_changed' | 'season_effect' | 'year_completed';
  data?: Record<string, unknown>;
}

// ============================================================
// SeasonSystem 实现
// ============================================================

/**
 * 季节循环系统 — 管理季节轮换、产出倍率、效果应用
 *
 * 核心机制：
 * - 季节按定义顺序循环轮换，每个季节有独立持续时间
 * - 每个季节可配置资源产出倍率和特殊效果
 * - 完成一整轮（所有季节）后年度 +1
 * - 支持一次性跳过多个季节（大 dt）
 * - 完整的存档/读档支持
 *
 * @example
 * ```typescript
 * const system = new SeasonSystem([
 *   { id: 'spring', name: '春', icon: '🌸', multipliers: { wood: 1.2 }, duration: 30_000,
 *     effects: [{ type: 'abundance', targetResource: 'herb', value: 0.5, description: '草药丰饶' }],
 *     colorTheme: { primary: '#4caf50', secondary: '#81c784', background: '#e8f5e9' } },
 *   { id: 'summer', name: '夏', icon: '☀️', multipliers: { food: 1.3 }, duration: 30_000,
 *     effects: [{ type: 'drought', targetResource: 'water', value: -0.3, description: '干旱' }],
 *     colorTheme: { primary: '#ff9800', secondary: '#ffb74d', background: '#fff3e0' } },
 * ]);
 * system.update(deltaMs);
 * const mul = system.getMultiplier('wood'); // 1.2
 * const unsub = system.onEvent(e => console.log(e));
 * ```
 */
export class SeasonSystem {
  /** 季节定义列表（不可变副本） */
  private readonly seasons: Season[];
  /** 当前季节索引 */
  private currentIndex: number;
  /** 当前季节已消耗时间（毫秒） */
  private elapsed: number;
  /** 当前年度 */
  private year: number;
  /** 季节历史记录 */
  private history: SeasonRecord[];
  /** 当前季节开始的时间戳 */
  private currentSeasonStartedAt: number;
  /** 事件监听器列表 */
  private readonly listeners: Array<(event: SeasonEvent) => void> = [];

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建季节循环系统
   * @param seasons - 季节定义数组（至少 1 个），按顺序循环
   * @throws 当 seasons 为空数组时抛出错误
   */
  constructor(seasons: Season[]) {
    if (!seasons || seasons.length === 0) {
      throw new Error('SeasonSystem requires at least one season definition');
    }
    this.seasons = [...seasons];
    this.currentIndex = 0;
    this.elapsed = 0;
    this.year = 1;
    this.history = [];
    this.currentSeasonStartedAt = Date.now();
  }

  // ============================================================
  // 更新循环
  // ============================================================

  /**
   * 推进季节计时器。当 elapsed 超过当前季节 duration 时自动切换。
   * 完成一整轮后年度 +1。支持一次性跳过多个季节（大 dt）。
   * @param dt - 距上次更新的时间增量（毫秒），必须 > 0
   */
  update(dt: number): void {
    if (dt <= 0) return;
    this.elapsed += dt;

    const currentDuration = this.seasons[this.currentIndex].duration;
    let overflow = this.elapsed - currentDuration;

    // 循环处理：一次 update 可能跨越多个季节
    while (overflow >= 0) {
      // 1. 记录即将结束的季节到历史
      this.history.push({
        seasonId: this.seasons[this.currentIndex].id,
        year: this.year,
        startedAt: this.currentSeasonStartedAt,
        endedAt: Date.now(),
      });

      const fromId = this.seasons[this.currentIndex].id;

      // 2. 推进到下一季节
      this.currentIndex = (this.currentIndex + 1) % this.seasons.length;

      // 3. 如果回到第一个季节 → 完成一年
      if (this.currentIndex === 0) {
        this.year++;
        this.emit({
          type: 'year_completed',
          data: { year: this.year - 1 },
        });
      }

      // 4. 重置计时，保留溢出时间
      this.elapsed = overflow;
      this.currentSeasonStartedAt = Date.now() - overflow;

      const toId = this.seasons[this.currentIndex].id;

      // 5. 触发季节变更事件
      this.emit({
        type: 'season_changed',
        data: {
          seasonId: toId,
          fromSeason: fromId,
          toSeason: toId,
          year: this.year,
        },
      });

      // 6. 触发新季节的所有效果事件
      const newSeason = this.seasons[this.currentIndex];
      for (const effect of newSeason.effects) {
        this.emit({
          type: 'season_effect',
          data: {
            seasonId: newSeason.id,
            effectType: effect.type,
            targetResource: effect.targetResource,
            value: effect.value,
            description: effect.description,
          },
        });
      }

      // 7. 计算新的溢出量
      overflow = this.elapsed - this.seasons[this.currentIndex].duration;
    }
  }

  // ============================================================
  // 查询方法
  // ============================================================

  /** 获取当前季节定义 */
  getCurrent(): Season {
    return this.seasons[this.currentIndex];
  }

  /**
   * 获取当前季节对指定资源的产出倍率
   * @param resourceId - 资源标识符
   * @returns 倍率值，未配置时返回 1.0（无加成）
   */
  getMultiplier(resourceId: string): number {
    return this.seasons[this.currentIndex].multipliers[resourceId] ?? 1.0;
  }

  /**
   * 获取当前季节的进度
   * @returns 0~1 之间的进度值，duration 为 0 时返回 1
   */
  getProgress(): number {
    const duration = this.seasons[this.currentIndex].duration;
    return duration <= 0 ? 1 : Math.min(1, this.elapsed / duration);
  }

  /**
   * 获取下一个季节定义
   * @returns 下一个季节定义，如果只有一个季节则返回 null
   */
  getNext(): Season | null {
    if (this.seasons.length <= 1) return null;
    return this.seasons[(this.currentIndex + 1) % this.seasons.length];
  }

  /**
   * 获取当前季节剩余时间
   * @returns 剩余毫秒数，最小为 0
   */
  getRemainingTime(): number {
    return Math.max(0, this.seasons[this.currentIndex].duration - this.elapsed);
  }

  /**
   * 获取当前年度
   * @returns 当前年度（从 1 开始）
   */
  getYear(): number {
    return this.year;
  }

  /**
   * 获取当前季节效果列表（浅拷贝）
   * @returns 效果数组副本
   */
  getEffects(): SeasonEffect[] {
    return [...this.seasons[this.currentIndex].effects];
  }

  /**
   * 获取季节历史记录（浅拷贝）
   * @returns 历史记录数组副本
   */
  getHistory(): SeasonRecord[] {
    return this.history.map((r) => ({ ...r }));
  }

  /**
   * 获取所有季节定义
   * @returns 季节定义数组副本
   */
  getAllSeasons(): Season[] {
    return [...this.seasons];
  }

  /**
   * 获取当前季节索引
   * @returns 0-based 索引
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  // ============================================================
  // 序列化 / 反序列化
  // ============================================================

  /**
   * 序列化季节系统状态为可存储的 JSON 对象
   * @returns 包含所有运行时状态的普通对象
   */
  serialize(): Record<string, unknown> {
    return {
      currentIndex: this.currentIndex,
      elapsed: this.elapsed,
      year: this.year,
      currentSeasonStartedAt: this.currentSeasonStartedAt,
      history: this.history.map((r) => ({ ...r })),
    };
  }

  /**
   * 从序列化数据恢复状态（季节定义不覆盖，仅恢复运行时状态）
   * @param data - serialize() 输出的数据对象
   */
  deserialize(data: Record<string, unknown>): void {
    // 恢复季节索引
    const idx = data.currentIndex as number | undefined;
    if (typeof idx === 'number' && idx >= 0 && idx < this.seasons.length) {
      this.currentIndex = idx;
    }

    // 恢复已消耗时间
    const el = data.elapsed as number | undefined;
    if (typeof el === 'number' && el >= 0) {
      this.elapsed = el;
    }

    // 恢复年度
    const yr = data.year as number | undefined;
    if (typeof yr === 'number' && yr >= 1) {
      this.year = yr;
    }

    // 恢复季节开始时间戳
    const sa = data.currentSeasonStartedAt as number | undefined;
    if (typeof sa === 'number') {
      this.currentSeasonStartedAt = sa;
    }

    // 恢复历史记录
    this.history = [];
    const arr = data.history as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(arr)) {
      for (const r of arr) {
        if (
          r &&
          typeof r.seasonId === 'string' &&
          typeof r.year === 'number' &&
          typeof r.startedAt === 'number' &&
          typeof r.endedAt === 'number'
        ) {
          this.history.push({
            seasonId: r.seasonId,
            year: r.year,
            startedAt: r.startedAt,
            endedAt: r.endedAt,
          });
        }
      }
    }
  }

  // ============================================================
  // 重置
  // ============================================================

  /**
   * 重置到第一个季节，年度归 1，清空历史。
   * 保留监听器（不取消订阅）。
   */
  reset(): void {
    this.currentIndex = 0;
    this.elapsed = 0;
    this.year = 1;
    this.history = [];
    this.currentSeasonStartedAt = Date.now();
  }

  // ============================================================
  // 事件监听
  // ============================================================

  /**
   * 注册季节事件监听器
   * @param callback - 事件回调函数
   * @returns 取消监听函数（调用即移除该监听器）
   */
  onEvent(callback: (event: SeasonEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const i = this.listeners.indexOf(callback);
      if (i !== -1) this.listeners.splice(i, 1);
    };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 触发事件通知所有监听器
   * 使用 try-catch 保护，防止单个监听器异常影响系统运行
   */
  private emit(event: SeasonEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        /* 静默吞掉监听器异常，保证系统稳定性 */
      }
    }
  }
}
