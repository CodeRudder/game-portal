/**
 * 生态群落（Biome）配置模块
 *
 * 定义 BiomeType 枚举和每种生态群落的配置属性，
 * 包括颜色、通行性、资源产出、装饰主题等。
 *
 * @module engine/tilemap/BiomeConfig
 */

import { TerrainType } from './types';

// ---------------------------------------------------------------------------
// BiomeType 枚举
// ---------------------------------------------------------------------------

/** 生态群落类型 */
export enum BiomeType {
  PLAINS = 'plains',
  FOREST = 'forest',
  DESERT = 'desert',
  MOUNTAIN = 'mountain',
  WATER = 'water',
  SWAMP = 'swamp',
  SNOW = 'snow',
  VOLCANIC = 'volcanic',
}

// ---------------------------------------------------------------------------
// 资源产出
// ---------------------------------------------------------------------------

/** 资源产出配置 */
export interface ResourceYield {
  /** 食物产出 */
  food: number;
  /** 木材产出 */
  wood: number;
  /** 石材产出 */
  stone: number;
  /** 金币产出 */
  gold: number;
}

// ---------------------------------------------------------------------------
// 装饰主题
// ---------------------------------------------------------------------------

/** 装饰主题配置 */
export interface DecoTheme {
  /** 可用的装饰类型列表 */
  types: string[];
  /** 每种装饰的颜色 */
  colors: Record<string, string>;
  /** 装饰密度系数（0~1，乘以全局密度） */
  densityFactor: number;
}

// ---------------------------------------------------------------------------
// BiomeConfig
// ---------------------------------------------------------------------------

/** 单个生态群落的完整配置 */
export interface BiomeConfig {
  /** 群落类型 */
  type: BiomeType;
  /** 可读名称 */
  name: string;
  /** 基础颜色（十六进制 CSS 颜色） */
  color: string;
  /** 次要颜色（用于变体） */
  secondaryColor: string;
  /** 是否可行走 */
  walkable: boolean;
  /** 是否可建造 */
  buildable: boolean;
  /** 移动消耗（1=普通, 2=困难, Infinity=不可通行） */
  movementCost: number;
  /** 资源产出 */
  resources: ResourceYield;
  /** 对应的 TerrainType 映射（用于兼容旧系统） */
  terrainTypes: TerrainType[];
  /** 装饰主题 */
  decoTheme: DecoTheme;
  /** 海拔范围 [min, max] */
  elevationRange: [number, number];
  /** 噪声阈值（用于噪声生成时的分界） */
  noiseThreshold: number;
}

// ---------------------------------------------------------------------------
// 预定义 Biome 配置表
// ---------------------------------------------------------------------------

/** 所有 Biome 的默认配置 */
export const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  [BiomeType.PLAINS]: {
    type: BiomeType.PLAINS,
    name: '平原',
    color: '#4a7c3f',
    secondaryColor: '#5a8c4f',
    walkable: true,
    buildable: true,
    movementCost: 1,
    resources: { food: 2, wood: 0, stone: 0, gold: 0 },
    terrainTypes: [TerrainType.GRASS, TerrainType.DIRT],
    decoTheme: {
      types: ['flower', 'bush', 'fence', 'lamp'],
      colors: { flower: '#e06090', bush: '#3a8a2a', fence: '#a08050', lamp: '#ffd700' },
      densityFactor: 0.3,
    },
    elevationRange: [0, 1],
    noiseThreshold: 0.15,
  },
  [BiomeType.FOREST]: {
    type: BiomeType.FOREST,
    name: '森林',
    color: '#2d5a1e',
    secondaryColor: '#3d6a2e',
    walkable: true,
    buildable: false,
    movementCost: 2,
    resources: { food: 0, wood: 3, stone: 0, gold: 0 },
    terrainTypes: [TerrainType.FOREST],
    decoTheme: {
      types: ['tree', 'bush', 'rock'],
      colors: { tree: '#2d7a1e', bush: '#3a8a2a', rock: '#888888' },
      densityFactor: 0.8,
    },
    elevationRange: [0, 2],
    noiseThreshold: 0.35,
  },
  [BiomeType.DESERT]: {
    type: BiomeType.DESERT,
    name: '沙漠',
    color: '#d4b96a',
    secondaryColor: '#c4a95a',
    walkable: true,
    buildable: true,
    movementCost: 1.5,
    resources: { food: 0, wood: 0, stone: 1, gold: 1 },
    terrainTypes: [TerrainType.SAND],
    decoTheme: {
      types: ['rock', 'cactus', 'skull'],
      colors: { rock: '#b0a080', cactus: '#4a8a2a', skull: '#e0d8c0' },
      densityFactor: 0.15,
    },
    elevationRange: [0, 1],
    noiseThreshold: 0.55,
  },
  [BiomeType.MOUNTAIN]: {
    type: BiomeType.MOUNTAIN,
    name: '山地',
    color: '#6b6b6b',
    secondaryColor: '#7b7b7b',
    walkable: false,
    buildable: false,
    movementCost: Infinity,
    resources: { food: 0, wood: 0, stone: 3, gold: 1 },
    terrainTypes: [TerrainType.MOUNTAIN],
    decoTheme: {
      types: ['rock', 'snow_peak'],
      colors: { rock: '#888888', snow_peak: '#f0f0f8' },
      densityFactor: 0.2,
    },
    elevationRange: [3, 5],
    noiseThreshold: 0.75,
  },
  [BiomeType.WATER]: {
    type: BiomeType.WATER,
    name: '水域',
    color: '#3a7ecf',
    secondaryColor: '#4a8edf',
    walkable: false,
    buildable: false,
    movementCost: Infinity,
    resources: { food: 1, wood: 0, stone: 0, gold: 0 },
    terrainTypes: [TerrainType.WATER],
    decoTheme: {
      types: [],
      colors: {},
      densityFactor: 0,
    },
    elevationRange: [-2, -1],
    noiseThreshold: 0.05,
  },
  [BiomeType.SWAMP]: {
    type: BiomeType.SWAMP,
    name: '沼泽',
    color: '#4a6a3a',
    secondaryColor: '#3a5a2a',
    walkable: true,
    buildable: false,
    movementCost: 3,
    resources: { food: 1, wood: 1, stone: 0, gold: 0 },
    terrainTypes: [TerrainType.DIRT, TerrainType.GRASS],
    decoTheme: {
      types: ['dead_tree', 'mushroom', 'puddle'],
      colors: { dead_tree: '#5a4a30', mushroom: '#c06040', puddle: '#5a8060' },
      densityFactor: 0.4,
    },
    elevationRange: [-1, 0],
    noiseThreshold: 0.1,
  },
  [BiomeType.SNOW]: {
    type: BiomeType.SNOW,
    name: '雪地',
    color: '#e8e8f0',
    secondaryColor: '#d8d8e0',
    walkable: true,
    buildable: false,
    movementCost: 2,
    resources: { food: 0, wood: 0, stone: 0, gold: 0 },
    terrainTypes: [TerrainType.SNOW],
    decoTheme: {
      types: ['snow_pine', 'ice_rock', 'snowman'],
      colors: { snow_pine: '#3a6a4a', ice_rock: '#a0c0e0', snowman: '#f0f0ff' },
      densityFactor: 0.25,
    },
    elevationRange: [1, 3],
    noiseThreshold: 0.65,
  },
  [BiomeType.VOLCANIC]: {
    type: BiomeType.VOLCANIC,
    name: '火山',
    color: '#4a2a1a',
    secondaryColor: '#6a3a2a',
    walkable: true,
    buildable: false,
    movementCost: 3,
    resources: { food: 0, wood: 0, stone: 2, gold: 3 },
    terrainTypes: [TerrainType.DIRT, TerrainType.MOUNTAIN],
    decoTheme: {
      types: ['lava_pool', 'volcanic_rock', 'steam'],
      colors: { lava_pool: '#ff4020', volcanic_rock: '#3a2a1a', steam: '#c0c0c0' },
      densityFactor: 0.3,
    },
    elevationRange: [2, 5],
    noiseThreshold: 0.85,
  },
};

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** 获取 Biome 配置 */
export function getBiomeConfig(biome: BiomeType): BiomeConfig {
  return BIOME_CONFIGS[biome];
}

/** 根据 BiomeType 获取对应的主要 TerrainType */
export function getBiomeTerrainType(biome: BiomeType): TerrainType {
  return BIOME_CONFIGS[biome].terrainTypes[0];
}

/** 检查 Biome 是否可建造 */
export function isBiomeBuildable(biome: BiomeType): boolean {
  return BIOME_CONFIGS[biome].buildable;
}

/** 检查 Biome 是否可通行 */
export function isBiomeWalkable(biome: BiomeType): boolean {
  return BIOME_CONFIGS[biome].walkable;
}

/** 获取所有可建造的 Biome 类型 */
export function getBuildableBiomes(): BiomeType[] {
  return Object.values(BiomeType).filter((b) => BIOME_CONFIGS[b].buildable);
}

/** 获取所有可通行的 Biome 类型 */
export function getWalkableBiomes(): BiomeType[] {
  return Object.values(BiomeType).filter((b) => BIOME_CONFIGS[b].walkable);
}
