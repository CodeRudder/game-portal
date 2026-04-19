/**
 * 事件总线实现
 *
 * 基于发布/订阅模式的解耦通信基础设施。
 * 所有子系统通过 EventBus 交互，避免直接 import 彼此。
 *
 * 特性：
 *   - 完整的 on / once / off / emit / removeAllListeners 接口
 *   - 通配符支持：on('building:*', handler) 匹配 building:upgraded 等
 *   - listenerCount / eventNames 查询接口
 *   - emit 时异常隔离：单个 handler 报错不影响后续 handler
 *
 * @module core/events/EventBus
 */

import type { IEventBus, Unsubscribe } from '../types/events';

/** 通用事件处理函数签名 */
type AnyHandler = (payload: unknown) => void;

/**
 * 事件总线
 *
 * L1 内核层的核心通信设施。子系统通过 emit 发布事件，
 * 通过 on / once 订阅事件，实现完全解耦的通信方式。
 *
 * @example
 * ```ts
 * const bus = new EventBus();
 * const unsub = bus.on('building:upgraded', (p) => console.log(p));
 * bus.on('building:*', (p) => console.log('wildcard', p));
 * bus.emit('building:upgraded', { type: 'barracks', level: 5 });
 * unsub();
 * ```
 */
export class EventBus implements IEventBus {
  private readonly handlers: Map<string, Set<AnyHandler>> = new Map();
  private readonly onceHandlers: Map<string, Set<AnyHandler>> = new Map();
  private readonly wildcardHandlers: Map<string, Set<AnyHandler>> = new Map();
  private readonly wildcardOnceHandlers: Map<string, Set<AnyHandler>> = new Map();

  // ─────────────────────────────────────────
  // 公共 API
  // ─────────────────────────────────────────

  /** 订阅事件（持久）。支持 `domain:*` 通配符模式。 */
  on<T = unknown>(event: string, handler: (payload: T) => void): Unsubscribe {
    const h = handler as AnyHandler;
    if (this.isWildcard(event)) {
      const prefix = event.slice(0, -1);
      this.add(this.wildcardHandlers, prefix, h);
      return () => this.remove(this.wildcardHandlers, prefix, h);
    }
    this.add(this.handlers, event, h);
    return () => this.remove(this.handlers, event, h);
  }

  /** 订阅事件（仅触发一次）。支持通配符。 */
  once<T = unknown>(event: string, handler: (payload: T) => void): Unsubscribe {
    const h = handler as AnyHandler;
    if (this.isWildcard(event)) {
      const prefix = event.slice(0, -1);
      this.add(this.wildcardOnceHandlers, prefix, h);
      return () => this.remove(this.wildcardOnceHandlers, prefix, h);
    }
    this.add(this.onceHandlers, event, h);
    return () => this.remove(this.onceHandlers, event, h);
  }

  /**
   * 发布事件
   *
   * 按注册顺序同步调用所有匹配的监听器（精确 + 通配符）。
   * 单个监听器抛出异常时，会被捕获并 console.error，不影响后续监听器。
   * 一次性监听器触发后自动移除。
   */
  emit<T = unknown>(event: string, payload: T): void {
    const p = payload as unknown;

    // 1. 精确匹配 — 持久监听器
    this.invokeSet(this.handlers.get(event), p);

    // 2. 精确匹配 — 一次性监听器（触发后清空）
    const onceSet = this.onceHandlers.get(event);
    if (onceSet) {
      this.invokeSet(onceSet, p);
      this.onceHandlers.delete(event);
    }

    // 3. 通配符匹配 — 持久监听器
    for (const [prefix, set] of this.wildcardHandlers) {
      if (event.startsWith(prefix)) this.invokeSet(set, p);
    }

    // 4. 通配符匹配 — 一次性监听器（触发后移除匹配前缀）
    for (const [prefix, set] of this.wildcardOnceHandlers) {
      if (event.startsWith(prefix)) {
        this.invokeSet(set, p);
        this.wildcardOnceHandlers.delete(prefix);
      }
    }
  }

  /**
   * 取消订阅
   *
   * 同时搜索持久和一次性监听器。也处理通配符模式。
   * 优先使用 on() 返回的 Unsubscribe 函数，此方法作为备选。
   */
  off<T = unknown>(event: string, handler: (payload: T) => void): void {
    const h = handler as AnyHandler;
    this.remove(this.handlers, event, h);
    this.remove(this.onceHandlers, event, h);
    if (this.isWildcard(event)) {
      const prefix = event.slice(0, -1);
      this.remove(this.wildcardHandlers, prefix, h);
      this.remove(this.wildcardOnceHandlers, prefix, h);
    }
  }

  /**
   * 移除所有监听器
   *
   * 指定 event 时仅移除该事件（含通配符匹配）；
   * 不传参数时移除全部。通常在引擎 destroy 时调用。
   */
  removeAllListeners(event?: string): void {
    if (event === undefined) {
      this.handlers.clear();
      this.onceHandlers.clear();
      this.wildcardHandlers.clear();
      this.wildcardOnceHandlers.clear();
      return;
    }
    this.handlers.delete(event);
    this.onceHandlers.delete(event);
    this.cleanWildcardFor(this.wildcardHandlers, event);
    this.cleanWildcardFor(this.wildcardOnceHandlers, event);
  }

  // ─────────────────────────────────────────
  // 查询接口
  // ─────────────────────────────────────────

  /** 查询某事件的监听器数量（精确 + 通配符匹配） */
  listenerCount(event: string): number {
    let count = 0;
    count += this.handlers.get(event)?.size ?? 0;
    count += this.onceHandlers.get(event)?.size ?? 0;
    for (const [prefix, set] of this.wildcardHandlers) {
      if (event.startsWith(prefix)) count += set.size;
    }
    for (const [prefix, set] of this.wildcardOnceHandlers) {
      if (event.startsWith(prefix)) count += set.size;
    }
    return count;
  }

  /** 返回所有已注册的事件名（不含通配符模式） */
  eventNames(): string[] {
    const names = new Set<string>();
    for (const key of this.handlers.keys()) names.add(key);
    for (const key of this.onceHandlers.keys()) names.add(key);
    return Array.from(names);
  }

  // ─────────────────────────────────────────
  // 私有工具方法
  // ─────────────────────────────────────────

  /** 判断是否为通配符模式（以 :* 结尾） */
  private isWildcard(event: string): boolean {
    return event.endsWith(':*');
  }

  /** 向 Map<string, Set> 中添加元素 */
  private add(map: Map<string, Set<AnyHandler>>, key: string, handler: AnyHandler): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(handler);
  }

  /** 从 Map<string, Set> 中移除元素，Set 为空时清理 Map 条目 */
  private remove(map: Map<string, Set<AnyHandler>>, key: string, handler: AnyHandler): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) map.delete(key);
  }

  /** 安全地调用 Set 中的所有 handler，异常隔离 */
  private invokeSet(set: Set<AnyHandler> | undefined, payload: unknown): void {
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        console.error('[EventBus] handler error:', err);
      }
    }
  }

  /** 移除所有匹配 event 前缀的通配符条目 */
  private cleanWildcardFor(map: Map<string, Set<AnyHandler>>, event: string): void {
    for (const prefix of map.keys()) {
      if (event.startsWith(prefix)) map.delete(prefix);
    }
  }
}
