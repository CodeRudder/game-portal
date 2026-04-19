/**
 * 核心接口 — 统一导出
 *
 * L1 内核层所有接口的统一入口文件。
 * 上层模块只需从此文件导入接口，无需关心具体的文件组织。
 *
 * @module core/types
 *
 * @example
 * ```ts
 * // 从统一入口导入
 * import type {
 *   IGameEngineFacade,
 *   IEventBus,
 *   ISubsystem,
 *   ISubsystemRegistry,
 *   ISystemDeps,
 *   IConfigRegistry,
 *   ISaveManager,
 *   IGameState,
 *   EngineState,
 *   Unsubscribe,
 * } from '../core/types';
 * ```
 */

// 事件总线
export type { IEventBus, Unsubscribe } from './events';

// 配置注册表
export type { IConfigRegistry } from './config';

// 子系统
export type { ISubsystem, ISystemDeps, ISubsystemRegistry } from './subsystem';

// 游戏状态
export type { IGameState } from './state';

// 存档管理
export type { ISaveManager } from './save';

// 引擎门面
export type { IGameEngineFacade, EngineState } from './engine';
