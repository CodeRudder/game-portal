/**
 * 核心接口 — 子系统
 *
 * 定义所有游戏子系统的统一契约，以及子系统注册表和依赖注入接口。
 * 每个子系统（建筑、武将、战役等）都必须实现 ISubsystem 接口，
 * 通过 ISubsystemRegistry 注册到引擎中统一管理。
 *
 * @module core/types/subsystem
 */

import type { IEventBus } from './events';
import type { IConfigRegistry } from './config';

// ─────────────────────────────────────────────
// 子系统接口
// ─────────────────────────────────────────────

/**
 * 子系统初始化依赖
 *
 * 在子系统 init 阶段注入的依赖集合。
 * 子系统通过这些依赖访问基础设施，而非自行创建或 import。
 *
 * @example
 * ```ts
 * class BuildingSystem implements ISubsystem {
 *   private deps!: ISystemDeps;
 *   init(deps: ISystemDeps): void {
 *     this.deps = deps;
 *     this.deps.eventBus.on('territory:expanded', (t) => this.unlockBuildings(t));
 *   }
 * }
 * ```
 */
export interface ISystemDeps {
  /** 事件总线 — 子系统间解耦通信 */
  readonly eventBus: IEventBus;
  /** 配置注册表 — 读取运行时配置 */
  readonly config: IConfigRegistry;
  /** 子系统注册表 — 查找其他子系统（谨慎使用，优先用事件总线） */
  readonly registry: ISubsystemRegistry;
}

/**
 * 子系统统一接口
 *
 * 所有游戏子系统（建筑、武将、战役、地图等）必须实现此接口。
 * 引擎通过此接口统一管理子系统的生命周期：初始化、更新、重置。
 *
 * 生命周期：
 * 1. `init(deps)` — 注入依赖，注册事件监听
 * 2. `update(dt)` — 每帧/每回合调用，处理业务逻辑
 * 3. `reset()` — 重置子系统状态到初始值
 *
 * @example
 * ```ts
 * class BuildingSystem implements ISubsystem {
 *   readonly name = 'building';
 *   init(deps: ISystemDeps): void { ... }
 *   update(dt: number): void { ... }
 *   getState(): BuildingState { return this.state; }
 *   reset(): void { this.state = createInitialState(); }
 * }
 * ```
 */
export interface ISubsystem {
  /**
   * 子系统名称标识
   *
   * 用于在注册表中唯一标识子系统，如 'building'、'general'、'campaign'。
   * 必须全局唯一，重复注册会抛出异常。
   */
  readonly name: string;

  /**
   * 初始化子系统
   *
   * 注入依赖并完成子系统初始化工作，如：
   * - 从 ConfigRegistry 读取配置
   * - 在 EventBus 上注册事件监听
   * - 初始化内部状态
   *
   * 此方法仅在子系统注册后调用一次。
   *
   * @param deps - 系统依赖注入集合
   */
  init(deps: ISystemDeps): void;

  /**
   * 更新子系统
   *
   * 每帧或每回合调用，处理子系统的核心业务逻辑。
   * dt 参数为距离上次更新的时间间隔，用于帧率无关的计算。
   *
   * @param dt - 距离上次更新的时间增量（秒）
   */
  update(dt: number): void;

  /**
   * 获取子系统状态快照
   *
   * 返回子系统当前状态的序列化友好表示。
   * 用于存档、UI 渲染、调试等场景。
   *
   * @returns 子系统状态的快照（应为可序列化的纯对象）
   */
  getState(): unknown;

  /**
   * 重置子系统
   *
   * 将子系统状态恢复到初始值，清除所有运行时数据。
   * 用于重新开始游戏或切换存档。
   */
  reset(): void;

  /**
   * 销毁子系统
   *
   * 释放子系统持有的所有资源（事件监听、定时器、外部引用等）。
   * 销毁后子系统不再可用，如需重新使用需调用 init() 重新初始化。
   *
   * 此方法是可选的：仅当子系统在 init 中注册了需要清理的资源时才需要实现。
   */
  destroy?(): void;
}

// ─────────────────────────────────────────────
// 子系统注册表接口
// ─────────────────────────────────────────────

/**
 * 子系统注册表接口
 *
 * 集中管理所有子系统的注册、查找和遍历。
 * 替代原来在 Engine 中直接管理子系统的方式，
 * 提供统一的注册/查找 API。
 *
 * @example
 * ```ts
 * // 注册子系统
 * registry.register('building', new BuildingSystem());
 * registry.register('general', new GeneralSystem());
 *
 * // 查找子系统
 * const building = registry.get<IBuildingSystem>('building');
 *
 * // 遍历所有子系统
 * for (const [name, sys] of registry.getAll()) {
 *   sys.update(dt);
 * }
 * ```
 */
export interface ISubsystemRegistry {
  /**
   * 注册子系统
   *
   * 将子系统实例注册到注册表中。如果 name 已存在，由实现决定
   * 是覆盖还是抛出异常（推荐抛出异常以避免意外覆盖）。
   *
   * @param name - 子系统名称，必须全局唯一
   * @param subsystem - 子系统实例
   * @throws {Error} 当 name 已被注册时（推荐行为）
   */
  register(name: string, subsystem: ISubsystem | object): void;

  /**
   * 获取子系统
   *
   * 按名称查找子系统，支持泛型以获得类型安全的返回值。
   * 如果子系统不存在，由实现决定返回 null/undefined 或抛出异常。
   *
   * @template T - 子系统具体类型，需继承 ISubsystem
   * @param name - 子系统名称
   * @returns 子系统实例
   */
  get<T extends ISubsystem>(name: string): T;

  /**
   * 获取所有已注册子系统
   *
   * 返回名称到子系统实例的映射。用于批量操作，如全量更新、销毁。
   *
   * @returns 子系统映射（建议返回只读视图或副本）
   */
  getAll(): Map<string, ISubsystem>;

  /**
   * 检查子系统是否已注册
   *
   * @param name - 子系统名称
   * @returns 是否存在
   */
  has(name: string): boolean;

  /**
   * 注销子系统
   *
   * 从注册表中移除指定子系统。
   * 注意：此操作不会调用子系统的 destroy 方法，需由调用方负责清理。
   *
   * @param name - 子系统名称
   */
  unregister(name: string): void;
}
