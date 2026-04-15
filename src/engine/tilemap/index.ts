/**
 * TileMap 引擎模块入口
 *
 * 统一导出所有 TileMap 引擎组件，供外部使用。
 *
 * @example
 * ```ts
 * import { MapGenerator, PathFinder, TileMapRenderer } from '@/engine/tilemap';
 * ```
 *
 * @module engine/tilemap
 */

// 类型
export type {
  TerrainDef,
  Tile,
  BuildingDef,
  PlacedBuilding,
  BuildingState,
  MapDecoration,
  TileMapData,
  Viewport,
  TileMapEvent,
  TileClickEvent,
  TileHoverEvent,
  BuildingClickEvent,
  BuildingHoverEvent,
  ViewportChangeEvent,
  DecorationClickEvent,
} from './types';

export { TerrainType } from './types';

// 渲染器
export { TileMapRenderer } from './TileMapRenderer';

// 寻路
export { PathFinder } from './PathFinder';
export type { PathFindOptions } from './PathFinder';

// 地图生成
export { MapGenerator } from './MapGenerator';
export type { MapGenConfig } from './MapGenerator';
