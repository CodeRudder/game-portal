/**
 * L1 内核层 — 统一导出
 *
 * 游戏引擎内核层的统一入口文件。
 * 上层模块只需从此文件导入，无需关心内部的文件组织。
 *
 * 导出内容：
 * - 类型定义（接口、类型别名）
 * - 引擎组件（门面、注册表、生命周期）
 * - 事件系统（事件总线、事件类型）
 * - 配置系统（配置注册表、常量加载器）
 * - 存档系统（存档管理器、序列化器）
 * - 状态管理（工厂函数、类型守卫）
 *
 * @module core
 *
 * @example
 * ```ts
 * // 引擎组件
 * import { GameEngineFacade, EngineError } from '../core';
 *
 * // 类型
 * import type { IGameEngineFacade, ISubsystem, EngineState } from '../core';
 *
 * // 事件
 * import { EventBus, EngineEvents } from '../core';
 *
 * // 配置
 * import { ConfigRegistry, ConstantsLoader } from '../core';
 *
 * // 存档
 * import { SaveManager, StateSerializer } from '../core';
 *
 * // 状态
 * import { createInitialState, isGameState } from '../core';
 * ```
 */

// ─── 类型定义 ─────────────────────────────────────────────────────
export type {
  IEventBus,
  Unsubscribe,
  IConfigRegistry,
  ISubsystem,
  ISystemDeps,
  ISubsystemRegistry,
  IGameState,
  ISaveManager,
  IGameEngineFacade,
  EngineState,
} from './types';

// ─── 引擎组件 ─────────────────────────────────────────────────────
export {
  GameEngineFacade,
  SubsystemRegistry,
  EngineError,
  LifecycleManager,
} from './engine';

// ─── 事件系统 ─────────────────────────────────────────────────────
export { EventBus } from './events';
export {
  EngineEvents,
  ResourceEvents,
  BuildingEvents,
  SaveEvents,
  GameEvents,
} from './events';
export type { EventPayloadMap } from './events';

// ─── 配置系统 ─────────────────────────────────────────────────────
export { ConfigRegistry, ConfigError, ConstantsLoader } from './config';

// ─── 存档系统 ─────────────────────────────────────────────────────
export { SaveManager, StateSerializer, SerializationError } from './save';

// ─── 状态管理 ─────────────────────────────────────────────────────
export {
  createInitialState,
  isGameState,
  hasSubsystemState,
  createSnapshot,
  mergeSubsystemStates,
  updateMetadata,
} from './state';
