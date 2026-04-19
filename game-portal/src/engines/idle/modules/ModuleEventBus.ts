/**
 * ModuleEventBus — 模块间事件总线
 *
 * 提供模块间解耦通信能力，支持频道订阅/发布、通配符匹配、
 * 事件拦截器（中间件）和事件历史记录。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 频道订阅/发布模式，完全解耦模块间通信
 * - 支持通配符频道（`prefix:*` 匹配所有以 `prefix:` 开头的事件）
 * - 中间件机制，支持事件拦截、变换和日志
 * - 事件历史记录，方便调试和回溯
 * - 返回取消订阅函数，防止内存泄漏
 *
 * @module engines/idle/modules/ModuleEventBus
 */

// ============================================================
// 类型定义
// ============================================================

/** 事件对象 */
export interface BusEvent {
  /** 事件频道 */
  channel: string;
  /** 来源模块 ID */
  source: string;
  /** 事件数据 */
  data: unknown;
  /** 事件时间戳（ms） */
  timestamp: number;
}

/** 事件处理函数 */
export type EventHandler = (event: BusEvent) => void;

/** 事件中间件函数（拦截器） */
export type EventMiddleware = (event: BusEvent, next: () => void) => void;

// ============================================================
// 常量
// ============================================================

/** 默认事件历史记录上限 */
const DEFAULT_HISTORY_LIMIT = 100;

/** 通配符后缀 */
const WILDCARD_SUFFIX = ':*';

// ============================================================
// ModuleEventBus 实现
// ============================================================

/**
 * 模块间事件总线
 *
 * 所有模块通过事件总线进行解耦通信。发布者无需知道订阅者的存在，
 * 订阅者也无需知道发布者的身份。通配符频道允许订阅一类事件。
 *
 * @example
 * ```typescript
 * const bus = new ModuleEventBus();
 *
 * // 订阅特定频道
 * const unsub = bus.subscribe('building:upgraded', (event) => {
 *   console.log('建筑升级:', event.data);
 * });
 *
 * // 通配符订阅
 * bus.subscribe('building:*', (event) => {
 *   console.log('建筑事件:', event.channel);
 * });
 *
 * // 发布事件
 * bus.publish('building:upgraded', 'building-system', { id: 'mine', level: 5 });
 *
 * // 取消订阅
 * unsub();
 * ```
 */
export class ModuleEventBus {
  /** 频道 → 订阅者列表的映射 */
  private readonly subscribers: Map<string, Set<EventHandler>> = new Map();

  /** 中间件链（按添加顺序执行） */
  private readonly middlewares: EventMiddleware[] = [];

  /** 事件历史记录 */
  private readonly history: BusEvent[] = [];

  /** 历史记录上限 */
  private historyLimit: number;

  /**
   * @param historyLimit - 事件历史记录上限（默认 100）
   */
  constructor(historyLimit: number = DEFAULT_HISTORY_LIMIT) {
    this.historyLimit = historyLimit;
  }

  // ========== 发布 ==========

  /**
   * 发布事件到指定频道
   *
   * 事件将依次经过所有中间件处理后，分发给精确匹配和通配符匹配的订阅者。
   *
   * @param channel - 事件频道
   * @param source - 来源模块 ID
   * @param data - 事件数据
   */
  publish(channel: string, source: string, data: unknown): void {
    const event: BusEvent = {
      channel,
      source,
      data,
      timestamp: Date.now(),
    };

    // 通过中间件链处理
    this.processWithMiddlewares(event, () => {
      this.dispatchEvent(event);
    });
  }

  /**
   * 通过中间件链处理事件
   *
   * 中间件按添加顺序嵌套执行，第一个中间件最先执行，
   * 最后一个中间件调用 next() 后执行最终回调。
   *
   * @param event - 事件对象
   * @param finalHandler - 最终处理函数
   */
  private processWithMiddlewares(event: BusEvent, finalHandler: () => void): void {
    if (this.middlewares.length === 0) {
      finalHandler();
      return;
    }

    // 从第一个中间件（index=0）开始，依次嵌套调用
    const run = (i: number): void => {
      if (i >= this.middlewares.length) {
        finalHandler();
        return;
      }
      const middleware = this.middlewares[i];
      middleware(event, () => run(i + 1));
    };
    run(0);
  }

  /**
   * 将事件分发给匹配的订阅者
   *
   * @param event - 事件对象
   */
  private dispatchEvent(event: BusEvent): void {
    // 精确匹配
    const exactHandlers = this.subscribers.get(event.channel);
    if (exactHandlers) {
      for (const handler of exactHandlers) {
        try {
          handler(event);
        } catch {
          // 防止单个订阅者异常影响其他订阅者
        }
      }
    }

    // 通配符匹配：查找所有 prefix:* 形式的频道
    for (const [pattern, handlers] of this.subscribers) {
      if (pattern.endsWith(WILDCARD_SUFFIX)) {
        const prefix = pattern.slice(0, -WILDCARD_SUFFIX.length);
        // 精确匹配的频道已经处理过，跳过
        if (pattern !== event.channel && event.channel.startsWith(prefix + ':')) {
          for (const handler of handlers) {
            try {
              handler(event);
            } catch {
              // 防止单个订阅者异常影响其他订阅者
            }
          }
        }
      }
    }

    // 记录历史
    this.addToHistory(event);
  }

  /**
   * 将事件添加到历史记录
   *
   * 超过上限时移除最早的记录。
   *
   * @param event - 事件对象
   */
  private addToHistory(event: BusEvent): void {
    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }

  // ========== 订阅 ==========

  /**
   * 订阅频道
   *
   * @param channel - 频道名称（支持通配符后缀 `:*`）
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  subscribe(channel: string, handler: EventHandler): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.unsubscribe(channel, handler);
    };
  }

  /**
   * 一次性订阅
   *
   * 事件触发一次后自动取消订阅。
   *
   * @param channel - 频道名称
   * @param handler - 事件处理函数
   * @returns 取消订阅函数（可在触发前手动取消）
   */
  subscribeOnce(channel: string, handler: EventHandler): () => void {
    const wrapper: EventHandler = (event) => {
      // 先取消订阅，再调用处理函数
      this.unsubscribe(channel, wrapper);
      handler(event);
    };

    return this.subscribe(channel, wrapper);
  }

  /**
   * 取消订阅
   *
   * @param channel - 频道名称
   * @param handler - 要移除的事件处理函数
   */
  unsubscribe(channel: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      // 清理空的订阅者集合
      if (handlers.size === 0) {
        this.subscribers.delete(channel);
      }
    }
  }

  // ========== 中间件 ==========

  /**
   * 添加事件中间件
   *
   * 中间件按添加顺序执行，每个中间件必须调用 next() 才能继续传递事件。
   * 中间件可以拦截事件（不调用 next()）、变换事件数据或记录日志。
   *
   * @param middleware - 中间件函数
   */
  use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }

  // ========== 历史记录 ==========

  /**
   * 获取事件历史记录
   *
   * @param channel - 可选，按频道过滤（支持通配符）
   * @param limit - 可选，返回的最大记录数（默认全部）
   * @returns 事件列表（按时间正序排列）
   */
  getHistory(channel?: string, limit?: number): BusEvent[] {
    let result = this.history;

    if (channel) {
      if (channel.endsWith(WILDCARD_SUFFIX)) {
        // 通配符过滤
        const prefix = channel.slice(0, -WILDCARD_SUFFIX.length);
        result = result.filter(e => e.channel.startsWith(prefix + ':'));
      } else {
        // 精确过滤
        result = result.filter(e => e.channel === channel);
      }
    }

    if (limit !== undefined && limit >= 0) {
      result = result.slice(-limit);
    }

    return [...result];
  }

  /**
   * 清除所有历史记录
   */
  clearHistory(): void {
    this.history.length = 0;
  }

  // ========== 统计 ==========

  /**
   * 获取指定频道的订阅者数量
   *
   * @param channel - 频道名称
   * @returns 订阅者数量
   */
  getSubscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size ?? 0;
  }

  // ========== 重置 ==========

  /**
   * 重置事件总线
   *
   * 清除所有订阅者、中间件和历史记录。
   */
  reset(): void {
    this.subscribers.clear();
    this.middlewares.length = 0;
    this.history.length = 0;
  }
}
