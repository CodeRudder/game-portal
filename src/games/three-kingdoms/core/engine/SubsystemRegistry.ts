/**
 * 子系统注册表实现
 *
 * 集中管理所有游戏子系统的注册、查找和遍历。
 * 维护注册顺序以支持按序初始化和逆序销毁。
 *
 * 设计原则：
 * - 注册时检测重名，防止意外覆盖
 * - 按注册顺序遍历，保证初始化依赖关系
 * - 注销时自动调用子系统 reset() 清理状态
 *
 * @module core/engine/SubsystemRegistry
 */

import type { ISubsystemRegistry, ISubsystem } from '../types/subsystem';

// ─────────────────────────────────────────────
// 异常定义
// ─────────────────────────────────────────────

/**
 * 引擎错误
 *
 * 子系统注册/注销过程中的异常。
 */
export class EngineError extends Error {
  constructor(message: string) {
    super(`[EngineError] ${message}`);
    this.name = 'EngineError';
  }
}

// ─────────────────────────────────────────────
// 子系统注册表
// ─────────────────────────────────────────────

/**
 * 子系统注册表
 *
 * 实现 ISubsystemRegistry 接口，提供子系统的注册、查找和遍历能力。
 * 维护注册顺序列表，支持按序初始化（正序）和逆序销毁。
 *
 * @example
 * ```ts
 * const registry = new SubsystemRegistry();
 * registry.register('building', new BuildingSystem());
 * registry.register('general', new GeneralSystem());
 *
 * // 按注册顺序遍历
 * registry.forEach((sys) => sys.update(dt));
 *
 * // 类型安全获取
 * const building = registry.get<IBuildingSystem>('building');
 * ```
 */
export class SubsystemRegistry implements ISubsystemRegistry {
  /** 子系统名称 → 实例映射 */
  private readonly systems: Map<string, ISubsystem> = new Map();

  /** 注册顺序记录（用于有序遍历） */
  private readonly initOrder: string[] = [];

  // ─── ISubsystemRegistry 接口实现 ──────────────────────────────

  /**
   * 注册子系统
   *
   * 将子系统实例注册到注册表中，并记录注册顺序。
   * 如果 name 已存在，抛出 EngineError 以防止意外覆盖。
   *
   * @param name - 子系统名称，必须全局唯一
   * @param subsystem - 子系统实例
   * @throws {EngineError} 当 name 已被注册时
   */
  register(name: string, subsystem: ISubsystem | object): void {
    if (this.systems.has(name)) {
      throw new EngineError(
        `Subsystem "${name}" is already registered. ` +
          `Use unregister() first if you intend to replace it.`,
      );
    }
    this.systems.set(name, subsystem as ISubsystem);
    this.initOrder.push(name);
  }

  /**
   * 获取子系统
   *
   * 按名称查找子系统，支持泛型以获得类型安全的返回值。
   * 如果子系统不存在，返回 null（不抛异常）。
   *
   * @template T - 子系统具体类型，需继承 ISubsystem
   * @param name - 子系统名称
   * @returns 子系统实例，不存在时返回 null
   */
  get<T extends ISubsystem>(name: string): T {
    const system = this.systems.get(name);
    return (system as T) ?? (null as unknown as T);
  }

  /**
   * 获取所有已注册子系统
   *
   * 返回名称到子系统实例的映射副本。
   * 修改返回值不会影响注册表内部状态。
   *
   * @returns 子系统映射的浅拷贝
   */
  getAll(): Map<string, ISubsystem> {
    return new Map(this.systems);
  }

  /**
   * 检查子系统是否已注册
   *
   * @param name - 子系统名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.systems.has(name);
  }

  /**
   * 注销子系统
   *
   * 从注册表中移除指定子系统，并调用其 reset() 方法清理状态。
   * 同时从注册顺序列表中移除。
   * 如果子系统不存在，静默忽略。
   *
   * @param name - 子系统名称
   */
  unregister(name: string): void {
    const subsystem = this.systems.get(name);
    if (!subsystem) return;

    // 调用 reset() 清理子系统状态
    try {
      subsystem.reset();
    } catch {
      // 注销时 reset 失败不应阻止注销流程
    }

    this.systems.delete(name);
    const index = this.initOrder.indexOf(name);
    if (index !== -1) {
      this.initOrder.splice(index, 1);
    }
  }

  // ─── 扩展方法 ──────────────────────────────────────────────────

  /**
   * 获取注册顺序列表
   *
   * 返回子系统注册顺序的名称数组。
   * 用于按序初始化（正序）和逆序销毁。
   *
   * @returns 注册顺序名称数组的副本
   */
  getInitOrder(): string[] {
    return [...this.initOrder];
  }

  /**
   * 按注册顺序遍历所有子系统
   *
   * 保证回调按注册顺序依次调用。
   *
   * @param callback - 遍历回调函数，接收子系统实例和名称
   */
  forEach(callback: (subsystem: ISubsystem, name: string) => void): void {
    for (const name of this.initOrder) {
      const system = this.systems.get(name);
      if (system) {
        callback(system, name);
      }
    }
  }

  /**
   * 获取已注册子系统的数量
   */
  get size(): number {
    return this.systems.size;
  }

  /**
   * 清空所有子系统
   *
   * 移除全部子系统，不调用 reset()。
   * 用于引擎销毁时的最终清理。
   */
  clear(): void {
    this.systems.clear();
    this.initOrder.length = 0;
  }
}
