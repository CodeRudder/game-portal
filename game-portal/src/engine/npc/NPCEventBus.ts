/**
 * NPC 事件总线
 *
 * 提供 NPC 系统内部及与外部系统的事件通信机制。
 * 支持注册、注销、触发事件，解耦各模块间的依赖。
 *
 * @module engine/npc/NPCEventBus
 */

export class NPCEventBus {
  private listeners: Map<string, Function[]> = new Map();

  /**
   * 注册事件监听器
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: Function): void {
    const list = this.listeners.get(event) ?? [];
    list.push(callback);
    this.listeners.set(event, list);
  }

  /**
   * 注销事件监听器
   * @param event - 事件名称
   * @param callback - 要移除的回调函数
   */
  off(event: string, callback: Function): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
  }

  /**
   * 触发事件
   * @param event - 事件名称
   * @param args - 传递给监听器的参数
   */
  emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const cb of list) {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[NPCEventBus] Error in listener for "${event}":`, err);
      }
    }
  }

  /**
   * 移除指定事件的所有监听器
   * @param event - 事件名称
   */
  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  /** 清空所有监听器 */
  clear(): void {
    this.listeners.clear();
  }
}
