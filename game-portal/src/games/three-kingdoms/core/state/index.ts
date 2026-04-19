/**
 * 状态模块 — 统一导出
 *
 * L1 内核层状态子模块的入口文件。
 * 导出游戏状态工厂函数、类型守卫和渲染状态适配器。
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

export {
  RenderStateAdapter,
  createRenderStateAdapter,
} from './RenderStateAdapter';

export type {
  IRenderState,
  IRenderStateAdapter,
  IBuildingRenderData,
  IResourceRenderData,
  IRenderEffect,
  BuildingExtractor,
  ResourceExtractor,
  EffectExtractor,
} from './RenderStateAdapter';
