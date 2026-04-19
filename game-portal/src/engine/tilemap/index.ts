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

// 地图生成（原有）
export { MapGenerator } from './MapGenerator';
export type { MapGenConfig } from './MapGenerator';

// Biome 配置
export { BiomeType } from './BiomeConfig';
export {
  BIOME_CONFIGS,
  getBiomeConfig,
  getBiomeTerrainType,
  isBiomeBuildable,
  isBiomeWalkable,
  getBuildableBiomes,
  getWalkableBiomes,
} from './BiomeConfig';
export type { BiomeConfig as BiomeConfigType, ResourceYield, DecoTheme } from './BiomeConfig';

// Simplex Noise
export { NoiseGenerator, createSeededRandom } from './SimplexNoiseWrapper';
export type { NoiseConfig } from './SimplexNoiseWrapper';

// 建筑放置
export { BuildingPlacementManager, getLevelVisual, LEVEL_VISUALS } from './BuildingPlacementManager';
export type { PlacementResult, LevelVisualConfig } from './BuildingPlacementManager';

// 装饰层
export { DecoLayer, DEFAULT_DECO_CONFIG } from './DecoLayer';
export type { DecoLayerConfig } from './DecoLayer';

// 地形过渡
export { TerrainTransition, blendColors, DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW, DIR_W, DIR_NW } from './TerrainTransition';
export type { TransitionTile } from './TerrainTransition';

// 地图模板
export {
  TEMPLATE_CHINESE_CAPITAL,
  TEMPLATE_EGYPTIAN_DESERT,
  TEMPLATE_BABYLONIAN_CITY,
  TEMPLATE_INDIAN_JUNGLE,
  MAP_TEMPLATES,
  getTemplate,
  getTemplateIds,
  getAllTemplates,
  generateBuildingDefsFromTemplate,
} from './MapTemplates';
export type { MapTemplate, BiomeWeights, BuildingStyle, DecoTemplateConfig } from './MapTemplates';

// 增强版地图生成
export { EnhancedMapGenerator } from './EnhancedMapGenerator';
export type { EnhancedMapGenConfig, EnhancedMapResult, BiomeWeightConfig } from './EnhancedMapGenerator';
