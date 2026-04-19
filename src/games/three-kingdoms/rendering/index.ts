/**
 * L4 渲染层 — 统一导出
 *
 * 三国霸业渲染层的统一入口文件。
 * 上层模块只需从此文件导入，无需关心内部的文件组织。
 *
 * 架构分层：
 *   L1 core/     — 内核层（状态、事件、配置）
 *   L2 engine/   — 引擎层（游戏逻辑子系统）
 *   L3 ui/       — UI 层（React 组件）
 *   L4 rendering/ — 渲染层（PixiJS 渲染，本模块）
 *
 * 依赖规则：
 *   L4 只依赖 L1（core/），不依赖 L2（engine/）或 L3（ui/）
 *
 * @module rendering
 *
 * @example
 * ```ts
 * // 核心组件
 * import { PixiApp, RenderLoop, TextureManager } from '../rendering';
 *
 * // 地图渲染
 * import { MapRenderer, TileRenderer, TerritoryRenderer } from '../rendering';
 *
 * // 武将渲染
 * import { GeneralPortraitRenderer } from '../rendering';
 *
 * // 战斗渲染
 * import { BattleEffectRenderer, DamageNumberRenderer } from '../rendering';
 *
 * // UI 覆盖层
 * import { FloatingTextRenderer, ParticleRenderer } from '../rendering';
 *
 * // 状态桥接
 * import { RenderStateBridge, type IRenderer } from '../rendering';
 * ```
 */

// ─── 核心 ────────────────────────────────────────────────────────
export { PixiApp } from './core/PixiApp';
export type { IPixiAppConfig } from './core/PixiApp';

export { RenderLoop } from './core/RenderLoop';
export type { IRendererRegistration } from './core/RenderLoop';

export { TextureManager } from './core/TextureManager';
export type { ITextureLoadResult, ITexturePreloadEntry } from './core/TextureManager';

// ─── 地图渲染 ────────────────────────────────────────────────────
export { MapRenderer } from './map/MapRenderer';
export type { IMapRenderConfig, IViewport } from './map/MapRenderer';

export { TileRenderer, TileType } from './map/TileRenderer';
export type { ITileRenderData } from './map/TileRenderer';

export { TerritoryRenderer } from './map/TerritoryRenderer';
export type { IFactionColor, ITerritoryData } from './map/TerritoryRenderer';

// ─── 武将渲染 ────────────────────────────────────────────────────
export { GeneralPortraitRenderer, PortraitExpression } from './general/GeneralPortraitRenderer';
export type { IGeneralPortraitData, IPortraitAnimationConfig } from './general/GeneralPortraitRenderer';

// ─── 战斗渲染 ────────────────────────────────────────────────────
export { BattleEffectRenderer, EffectType } from './battle/BattleEffectRenderer';
export type { IEffectParams } from './battle/BattleEffectRenderer';

export { DamageNumberRenderer, DamageNumberType } from './battle/DamageNumberRenderer';
export type { IDamageNumberParams } from './battle/DamageNumberRenderer';

// ─── UI 覆盖层 ───────────────────────────────────────────────────
export { FloatingTextRenderer, FloatingTextStyle } from './ui-overlay/FloatingTextRenderer';
export type { IFloatingTextParams } from './ui-overlay/FloatingTextRenderer';

export { ParticleRenderer, ParticlePreset } from './ui-overlay/ParticleRenderer';
export type { IParticleEmitterConfig } from './ui-overlay/ParticleRenderer';

// ─── 状态桥接 ────────────────────────────────────────────────────
export { RenderStateBridge } from './adapters/RenderStateBridge';
export type {
  IRenderer,
  RenderStateCallback,
  IRenderState,
  IRenderStateAdapter,
  IBuildingRenderData,
  IResourceRenderData,
  IRenderEffect,
} from './adapters/RenderStateBridge';
