/**
 * renderer/index.ts — 渲染层公共导出
 *
 * 统一导出渲染层的所有公共 API。
 * 外部模块只需从此文件导入。
 *
 * @example
 * ```ts
 * import { GameRenderer, PixiGameCanvas } from '@/renderer';
 * import type { GameRenderState, BuildingRenderData } from '@/renderer';
 * ```
 *
 * @module renderer
 */

// ═══════════════════════════════════════════════════════════════
// 类型导出
// ═══════════════════════════════════════════════════════════════

export type {
  // 配置
  RendererConfig,
  SceneType,
  SceneTransition,
  SceneSwitchOptions,

  // 渲染数据
  BuildingRenderData,
  BuildingState,
  CombatRenderData,
  CombatUnitRenderData,
  CombatFaction,
  DamageNumberData,
  SkillEffectData,
  MapRenderData,
  TerritoryRenderData,
  TechTreeRenderData,
  TechNodeRenderData,
  HeroRenderData,
  ResourceBarRenderData,
  ResourceItemRenderData,
  StageRenderData,
  PrestigeRenderData,

  // 全局状态
  GameRenderState,

  // 事件
  RendererEventMap,
  RendererEvents,

  // 接口
  IScene,
  IAssetManager,
  IAnimationManager,
  ICameraManager,
  CameraBounds,
  IOrientationManager,
  OrientationLayout,
  IGameRenderer,
  LoadProgressCallback,
} from './types';

export { DEFAULT_RENDERER_CONFIG } from './types';

// ═══════════════════════════════════════════════════════════════
// 核心类导出
// ═══════════════════════════════════════════════════════════════

export { GameRenderer } from './GameRenderer';

// ═══════════════════════════════════════════════════════════════
// 场景导出
// ═══════════════════════════════════════════════════════════════

export { BaseScene } from './scenes/BaseScene';
export type { SceneEventBridge } from './scenes/BaseScene';
export { MapScene } from './scenes/MapScene';
export { CombatScene } from './scenes/CombatScene';

// ═══════════════════════════════════════════════════════════════
// 管理器导出
// ═══════════════════════════════════════════════════════════════

export { AssetManager } from './managers/AssetManager';
export { AnimationManager } from './managers/AnimationManager';
export { CameraManager } from './managers/CameraManager';
export { OrientationManager } from './managers/OrientationManager';

// ═══════════════════════════════════════════════════════════════
// React 组件导出
// ═══════════════════════════════════════════════════════════════

export { default as PixiGameCanvas } from './components/PixiGameCanvas';
export type { PixiGameCanvasProps } from './components/PixiGameCanvas';

// ═══════════════════════════════════════════════════════════════
// 通用适配层导出
// ═══════════════════════════════════════════════════════════════

export { PixiGameAdapter } from './PixiGameAdapter';
export type { AdapterEventMap } from './PixiGameAdapter';
export { RenderStrategyRegistry } from './RenderStrategyRegistry';
export { IdleScene } from './scenes/IdleScene';

// 适配层类型导出（已在 types.ts 中定义，此处重新导出方便引用）
export type {
  IdleGameRenderState,
  RenderStrategy,
  PixiGameAdapterConfig,
} from './types';
