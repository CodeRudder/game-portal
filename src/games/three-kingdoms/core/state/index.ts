/**
 * 状态模块 — 统一导出
 *
 * L1 内核层状态子模块的入口文件。
 * 导出游戏状态工厂函数和类型守卫。
 *
 * @module core/state
 */

export {
  createInitialState,
  isGameState,
  hasSubsystemState,
  createSnapshot,
  mergeSubsystemStates,
  updateMetadata,
} from './GameState';
