/**
 * 核心接口 — 事件总线
 *
 * 定义发布/订阅模式的统一接口，供子系统间解耦通信使用。
 * 所有子系统通过 IEventBus 交互，避免直接 import 彼此。
 *
 * @module core/types/events
 */

// ─────────────────────────────────────────────
// 通用类型
// ─────────────────────────────────────────────

/**
 * 取消订阅函数
 *
 * 调用后移除对应的事件监听器，防止内存泄漏。
 * 建议在 React useEffect 清理函数或对象 destroy 方法中调用。
 *
 * @example
 * ```ts
 * const unsub = eventBus.on('resource:changed', handler);
 * // 清理时
 * unsub();
 * ```
 */
export type Unsubscribe = () => void;

// ─────────────────────────────────────────────
// 事件总线接口
// ─────────────────────────────────────────────

/**
 * 事件总线接口
 *
 * 提供发布/订阅机制，是 L1 内核层的基础设施之一。
 * 子系统通过 emit 发布事件，通过 on/once 订阅事件，
 * 实现子系统间完全解耦的通信方式。
 *
 * @template T - 事件载荷类型，默认 unknown
 *
 * @example
 * ```ts
 * // 发布事件
 * eventBus.emit('building:upgraded', { type: 'barracks', level: 5 });
 *
 * // 订阅事件
 * const unsub = eventBus.on<{ type: string; level: number }>(
 *   'building:upgraded',
 *   (payload) => console.log(`${payload.type} reached level ${payload.level}`)
 * );
 * ```
 */
export interface IEventBus {
  /**
   * 订阅事件
   *
   * 注册一个持久监听器，每次事件触发时都会执行。
   * 同一个 handler 可以注册多次，每次注册都会独立触发。
   *
   * @param event - 事件名称，建议使用 `domain:action` 格式（如 `building:upgraded`）
   * @param handler - 事件处理函数，接收事件载荷作为参数
   * @returns 取消订阅函数
   */
  on<T = unknown>(event: string, handler: (payload: T) => void): Unsubscribe;

  /**
   * 订阅事件（仅触发一次）
   *
   * 注册一个一次性监听器，事件首次触发后自动移除。
   * 适用于初始化、一次性响应等场景。
   *
   * @param event - 事件名称
   * @param handler - 事件处理函数，仅执行一次
   * @returns 取消订阅函数（可在触发前手动取消）
   */
  once<T = unknown>(event: string, handler: (payload: T) => void): Unsubscribe;

  /**
   * 发布事件
   *
   * 通知所有订阅了该事件的监听器，按注册顺序同步执行。
   * 如果某个监听器抛出异常，不应影响后续监听器的执行。
   *
   * @param event - 事件名称
   * @param payload - 事件载荷数据
   */
  emit<T = unknown>(event: string, payload: T): void;

  /**
   * 取消订阅
   *
   * 移除指定事件的指定监听器。
   * 优先使用 `on()` 返回的 Unsubscribe 函数，此方法作为备选方案。
   *
   * @param event - 事件名称
   * @param handler - 需要移除的事件处理函数（需与注册时为同一引用）
   */
  off<T = unknown>(event: string, handler: (payload: T) => void): void;

  /**
   * 移除所有监听器
   *
   * 如果指定 event 参数，仅移除该事件的所有监听器；
   * 如果不传参数，移除所有事件的所有监听器。
   * 通常在引擎销毁（destroy）时调用。
   *
   * @param event - 可选，指定只移除某个事件的监听器
   */
  removeAllListeners(event?: string): void;
}
