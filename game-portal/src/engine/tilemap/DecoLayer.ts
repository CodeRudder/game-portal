/**
 * 地图装饰层系统
 *
 * 根据 BiomeType 自动生成对应装饰物，
 * 支持随机密度和分布控制。
 *
 * @module engine/tilemap/DecoLayer
 */

import { BiomeType, BIOME_CONFIGS, type BiomeConfig, type DecoTheme } from './BiomeConfig';
import type { Tile, MapDecoration, TileMapData } from './types';
import { NoiseGenerator, createSeededRandom } from './SimplexNoiseWrapper';

// ---------------------------------------------------------------------------
// 装饰层配置
// ---------------------------------------------------------------------------

/** 装饰层生成配置 */
export interface DecoLayerConfig {
  /** 全局装饰密度（0~1） */
  density: number;
  /** 随机种子 */
  seed: number;
  /** 是否使用噪声分布（更自然） */
  useNoise: boolean;
  /** 噪声缩放 */
  noiseScale: number;
  /** 排除的地形类型（这些地形不生成装饰） */
  excludedTerrains: string[];
  /** 排除已有建筑的格子 */
  excludeBuildings: boolean;
}

/** 默认装饰层配置 */
export const DEFAULT_DECO_CONFIG: DecoLayerConfig = {
  density: 0.2,
  seed: 42,
  useNoise: true,
  noiseScale: 0.15,
  excludedTerrains: ['water', 'road', 'bridge'],
  excludeBuildings: true,
};

// ---------------------------------------------------------------------------
// 装饰物生成器映射
// ---------------------------------------------------------------------------

/** 特殊装饰物的生成逻辑（按类型自定义） */
const DECO_GENERATORS: Record<string, (x: number, y: number, seed: number) => MapDecoration[]> = {
  // 树木：主树 + 可能的灌木
  tree: (x, y, seed) => {
    const decos: MapDecoration[] = [
      { id: `deco_tree_${x}_${y}_${seed}`, type: 'tree', x, y, color: '#2d7a1e' },
    ];
    return decos;
  },

  // 岩石群
  rock: (x, y, seed) => {
    const rng = createSeededRandom(seed + x * 100 + y);
    const decos: MapDecoration[] = [
      { id: `deco_rock_${x}_${y}_${seed}`, type: 'rock', x, y, color: '#888888' },
    ];
    // 有概率在旁边放小石头
    if (rng() > 0.6 && x + 1 < 1000) {
      decos.push({
        id: `deco_rock_${x + 1}_${y}_${seed}`,
        type: 'rock',
        x: x + 0.3,
        y: y + 0.2,
        color: '#999999',
      });
    }
    return decos;
  },

  // 花丛
  flower: (x, y, seed) => {
    const rng = createSeededRandom(seed + x * 200 + y);
    const colors = ['#e06090', '#ff90b0', '#ff6060', '#ffff60', '#ffffff'];
    return [
      {
        id: `deco_flower_${x}_${y}_${seed}`,
        type: 'flower',
        x,
        y,
        color: colors[Math.floor(rng() * colors.length)],
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// DecoLayer
// ---------------------------------------------------------------------------

export class DecoLayer {
  private config: DecoLayerConfig;
  private noiseGen: NoiseGenerator;

  constructor(config: Partial<DecoLayerConfig> = {}) {
    this.config = { ...DEFAULT_DECO_CONFIG, ...config };
    this.noiseGen = new NoiseGenerator({
      seed: this.config.seed,
      scale: this.config.noiseScale,
      octaves: 2,
    });
  }

  /**
   * 为整个地图生成装饰物
   *
   * @param tiles 瓦片二维数组
   * @param biomeMap Biome 类型映射
   * @param existingBuildings 已有建筑列表（用于排除）
   * @returns 生成的装饰物列表
   */
  generate(
    tiles: Tile[][],
    biomeMap: Map<string, BiomeType>,
    existingBuildings: { x: number; y: number; w: number; h: number }[] = [],
  ): MapDecoration[] {
    const decorations: MapDecoration[] = [];
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;

    // 构建建筑占用集合
    const buildingCells = new Set<string>();
    for (const bld of existingBuildings) {
      for (let dy = 0; dy < bld.h; dy++) {
        for (let dx = 0; dx < bld.w; dx++) {
          buildingCells.add(`${bld.x + dx},${bld.y + dy}`);
        }
      }
    }

    const rng = createSeededRandom(this.config.seed);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];

        // 排除特定地形
        if (this.config.excludedTerrains.includes(tile.terrain)) continue;

        // 排除建筑占用
        if (this.config.excludeBuildings && buildingCells.has(`${x},${y}`)) continue;

        // 排除已有装饰的格子
        if (tile.decoration) continue;

        // 获取 Biome 配置
        const biomeKey = `${x},${y}`;
        const biome = biomeMap.get(biomeKey);
        if (!biome) continue;

        const biomeConfig = BIOME_CONFIGS[biome];
        const theme = biomeConfig.decoTheme;

        // 没有装饰类型的 Biome 跳过
        if (theme.types.length === 0) continue;

        // 计算放置概率
        const densityFactor = theme.densityFactor;
        const effectiveDensity = this.config.density * densityFactor;

        let shouldPlace: boolean;
        if (this.config.useNoise) {
          const noiseVal = this.noiseGen.get(x, y);
          shouldPlace = noiseVal < effectiveDensity;
        } else {
          shouldPlace = rng() < effectiveDensity;
        }

        if (!shouldPlace) continue;

        // 选择装饰类型
        const decoType = this.selectDecoType(theme, rng);
        const decoColor = theme.colors[decoType] ?? '#888888';

        // 使用自定义生成器（如果有）
        const generator = DECO_GENERATORS[decoType];
        if (generator) {
          const decos = generator(x, y, this.config.seed);
          decorations.push(...decos);
        } else {
          decorations.push({
            id: `deco_${biome}_${x}_${y}_${this.config.seed}`,
            type: decoType,
            x,
            y,
            color: decoColor,
          });
        }
      }
    }

    return decorations;
  }

  /**
   * 为单个 Biome 区域生成装饰物
   *
   * @param tiles 瓦片二维数组
   * @param biomeMap Biome 映射
   * @param targetBiome 目标 Biome 类型
   * @returns 装饰物列表
   */
  generateForBiome(
    tiles: Tile[][],
    biomeMap: Map<string, BiomeType>,
    targetBiome: BiomeType,
  ): MapDecoration[] {
    const decorations: MapDecoration[] = [];
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    const biomeConfig = BIOME_CONFIGS[targetBiome];
    const theme = biomeConfig.decoTheme;
    const rng = createSeededRandom(this.config.seed + targetBiome.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const biomeKey = `${x},${y}`;
        if (biomeMap.get(biomeKey) !== targetBiome) continue;

        const tile = tiles[y][x];
        if (this.config.excludedTerrains.includes(tile.terrain)) continue;
        if (tile.decoration) continue;

        const effectiveDensity = this.config.density * theme.densityFactor;

        let shouldPlace: boolean;
        if (this.config.useNoise) {
          shouldPlace = this.noiseGen.get(x, y) < effectiveDensity;
        } else {
          shouldPlace = rng() < effectiveDensity;
        }

        if (!shouldPlace) continue;

        const decoType = this.selectDecoType(theme, rng);
        decorations.push({
          id: `deco_${targetBiome}_${x}_${y}`,
          type: decoType,
          x,
          y,
          color: theme.colors[decoType] ?? '#888888',
        });
      }
    }

    return decorations;
  }

  /**
   * 选择装饰类型（加权随机）
   */
  private selectDecoType(theme: DecoTheme, rng: () => number): string {
    const types = theme.types;
    if (types.length === 0) return 'rock';
    if (types.length === 1) return types[0];

    const idx = Math.floor(rng() * types.length);
    return types[idx];
  }

  /**
   * 计算指定 Biome 的装饰物数量估算
   */
  estimateCount(
    width: number,
    height: number,
    biome: BiomeType,
    biomeMap: Map<string, BiomeType>,
  ): number {
    const biomeConfig = BIOME_CONFIGS[biome];
    const theme = biomeConfig.decoTheme;
    const effectiveDensity = this.config.density * theme.densityFactor;

    let biomeTileCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (biomeMap.get(`${x},${y}`) === biome) {
          biomeTileCount++;
        }
      }
    }

    return Math.floor(biomeTileCount * effectiveDensity);
  }
}
