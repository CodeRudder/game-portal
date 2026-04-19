/**
 * 核心接口 — 引擎门面
 *
 * 定义游戏引擎的统一入口接口（Facade 模式）。
 * 上层（UI、渲染）通过 IGameEngineFacade 访问所有引擎能力，
 * 无需了解内部子系统的组织细节。
 *
 * @module core/types/engine
 */

import type { IEventBus } from './events';
import type { ISubsystemRegistry } from './subsystem';
import type { IConfigRegistry } from './config';
import type { ISaveManager } from './save';
import type { IGameState } from './state';
import type { ISubsystem } from './subsystem';
import type { Unsubscribe } from './events';

// ─────────────────────────────────────────────
// 引擎状态
// ─────────────────────────────────────────────

/**
 * 引擎运行状态枚举
 *
 * 描述引擎门面的生命周期状态，状态机转换规则：
 *
 * ```
 * idle ──init()──→ idle (initialized)
 *   │                  │
 *   │               start()
 *   │                  ↓
 *   └───────→ running ←──── resume()
 *                  │
 *               pause()
 *                  ↓
 *               paused
 *                  │
 *               resume()
 *                  ↓
 *              running
 *                  │
 *              destroy()
 *                  ↓
 *             destroyed (终态)
 * ```
 */
export type EngineState = 'idle' | 'running' | 'paused' | 'destroyed';

// ─────────────────────────────────────────────
// 引擎门面接口
// ─────────────────────────────────────────────

/**
 * 游戏引擎门面接口
 *
 * 作为游戏引擎的唯一入口，提供以下能力：
 * - 访问基础设施（事件总线、配置、注册表、存档）
 * - 管理引擎生命周期（初始化、启动、暂停、销毁）
 * - 获取子系统实例和全局状态
 * - 订阅引擎级错误
 *
 * L3 UI 层和 L4 渲染层通过此接口与引擎交互，
 * 不直接 import 任何子系统或基础设施的具体实现。
 *
 * @example
 * ```ts
 * // L3 UI 层使用示例
 * const engine: IGameEngineFacade = useGameEngine();
 * const building = engine.getSystem<IBuildingSystem>('building');
 * const resources = building.getBuildings();
 *
 * // 监听引擎错误
 * engine.onError((err) => {
 *   console.error('Engine error:', err);
 *   showToast('游戏发生错误，请重试');
 * });
 * ```
 */
export interface IGameEngineFacade {
  /**
   * 事件总线实例
   *
   * 提供发布/订阅能力，用于子系统间通信和 UI 层事件监听。
   */
  readonly eventBus: IEventBus;

  /**
   * 子系统注册表实例
   *
   * 提供子系统的注册、查找和遍历能力。
   */
  readonly registry: ISubsystemRegistry;

  /**
   * 配置注册表实例
   *
   * 提供运行时配置的读写能力。
   */
  readonly config: IConfigRegistry;

  /**
   * 存档管理器实例
   *
   * 提供游戏存档的保存、加载和删除能力。
   */
  readonly save: ISaveManager;

  /**
   * 引擎当前状态
   *
   * 反映引擎门面的生命周期阶段。
   */
  readonly state: EngineState;

  /**
   * 获取子系统实例
   *
   * 类型安全地按名称获取已注册的子系统。
   * 是 `registry.get()` 的便捷方法。
   *
   * @template T - 子系统具体类型
   * @param name - 子系统名称（如 'building'、'general'）
   * @returns 子系统实例
   */
  getSystem<T extends ISubsystem>(name: string): T;

  /**
   * 获取游戏全局状态快照
   *
   * 汇总所有子系统的当前状态，生成完整的游戏状态快照。
   * 用于存档、调试或 UI 渲染。
   *
   * @returns 包含所有子系统状态的游戏状态对象
   */
  getGameState(): IGameState;

  // ─────────────────────────────────────────
  // 生命周期方法
  // ─────────────────────────────────────────

  /**
   * 初始化引擎
   *
   * 按依赖顺序注册所有子系统，注入依赖，触发子系统初始化。
   * 必须在 start() 之前调用。
   */
  init(): void;

  /**
   * 启动游戏
   *
   * 开始游戏主循环，子系统开始接收 update 调用。
   * 仅在 init() 之后调用有效。
   */
  start(): void;

  /**
   * 暂停游戏
   *
   * 暂停游戏主循环，子系统停止接收 update 调用。
   * 可通过 resume() 恢复。
   */
  pause(): void;

  /**
   * 恢复游戏
   *
   * 从暂停状态恢复游戏主循环。
   * dt 参数会自动补偿暂停期间的时间差。
   */
  resume(): void;

  /**
   * 重置游戏
   *
   * 将所有子系统状态恢复到初始值，等同于重新开始游戏。
   * 引擎状态回到 idle。
   */
  reset(): void;

  /**
   * 销毁引擎
   *
   * 停止游戏主循环，逆序销毁所有子系统，释放所有资源。
   * 销毁后引擎不可再使用（终态 destroyed）。
   */
  destroy(): void;

  // ─────────────────────────────────────────
  // 错误处理
  // ─────────────────────────────────────────

  /**
   * 订阅引擎级错误
   *
   * 注册全局错误处理器，捕获子系统 update 中的异常，
   * 防止单个子系统的错误导致整个引擎崩溃。
   *
   * @param handler - 错误处理函数
   * @returns 取消订阅函数
   */
  onError(handler: (error: Error) => void): Unsubscribe;
}
