/**
 * 引擎模块 — 统一导出
 *
 * L1 内核层引擎子模块的入口文件。
 * 导出子系统注册表、生命周期管理器和引擎门面。
 *
 * @module core/engine
 *
 * @example
 * ```ts
 * import { GameEngineFacade, SubsystemRegistry, LifecycleManager } from '../engine';
 *
 * const engine = new GameEngineFacade();
 * engine.init();
 * engine.start();
 * ```
 */

export { SubsystemRegistry, EngineError } from './SubsystemRegistry';
export { LifecycleManager } from './LifecycleManager';
export { GameEngineFacade } from './GameEngineFacade';
export type { EngineState } from '../types/engine';
