/**
 * 程序化地图生成器
 *
 * 使用简化的 Value Noise 算法生成地形，
 * 支持河流、道路、装饰物等地图元素的自动放置。
 *
 * @module engine/tilemap/MapGenerator
 */

import { TerrainType } from './types';
import type { TileMapData, Tile, PlacedBuilding, MapDecoration } from './types';

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

/** 地图生成配置 */
export interface MapGenConfig {
  /** 地图宽度（格数） */
  width: number;
  /** 地图高度（格数） */
  height: number;
  /** 每格像素大小 */
  tileSize: number;
  /** 随机种子 */
  seed?: number;
  /** 地形权重（未指定的地形权重为 0） */
  terrainWeights: Partial<Record<TerrainType, number>>;
  /** 可建造位置数量（预留平地） */
  buildingSlots?: number;
  /** 装饰物密度 0~1 */
  decorationDensity?: number;
  /** 河流数量 */
  riverCount?: number;
  /** 道路数量 */
  roadCount?: number;
}

// ---------------------------------------------------------------------------
// MapGenerator
// ---------------------------------------------------------------------------

export class MapGenerator {
  /**
   * 生成随机地图
   *
   * @param config 生成配置
   * @returns 完整的 TileMapData
   */
  static generate(config: MapGenConfig): TileMapData {
    const {
      width,
      height,
      tileSize,
      seed = Date.now(),
      terrainWeights,
      decorationDensity = 0.1,
      riverCount = 0,
      roadCount = 0,
    } = config;

    // 1. 生成基础地形
    const tiles = MapGenerator.generateTerrain(width, height, seed, terrainWeights);

    // 2. 生成河流
    for (let i = 0; i < riverCount; i++) {
      MapGenerator.generateRiver(tiles, width, height, seed + i * 1000);
    }

    // 3. 放置建筑（预留位置）
    const buildings = MapGenerator.placeBuildings(tiles, config.buildingSlots ?? 0, seed);

    // 4. 生成道路连接建筑
    if (roadCount > 0 && buildings.length > 0) {
      MapGenerator.generateRoads(tiles, buildings);
    }

    // 5. 放置装饰物
    const decorations = MapGenerator.placeDecorations(tiles, decorationDensity, seed);

    return {
      width,
      height,
      tileSize,
      tiles,
      buildings,
      decorations,
    };
  }

  // -----------------------------------------------------------------------
  // 地形生成
  // -----------------------------------------------------------------------

  /** 使用 Value Noise 生成基础地形 */
  private static generateTerrain(
    width: number,
    height: number,
    seed: number,
    weights: Partial<Record<TerrainType, number>>,
  ): Tile[][] {
    // 构建加权地形选择表
    const entries = Object.entries(weights) as [TerrainType, number][];
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

    // 默认为草地
    if (totalWeight === 0) {
      entries.push([TerrainType.GRASS, 1]);
    }

    const tiles: Tile[][] = [];

    for (let y = 0; y < height; y++) {
      tiles[y] = [];
      for (let x = 0; x < width; x++) {
        // 使用噪声值选择地形
        const noiseVal = MapGenerator.noise(x, y, seed);
        const terrain = MapGenerator.selectTerrain(noiseVal, entries, totalWeight);

        tiles[y][x] = {
          x,
          y,
          terrain,
          elevation: Math.floor(MapGenerator.noise(x, y, seed + 500) * 3),
          variant: Math.floor(Math.abs(MapGenerator.noise(x * 3, y * 3, seed + 100)) * 4),
        };
      }
    }

    return tiles;
  }

  /** 根据噪声值和权重表选择地形 */
  private static selectTerrain(
    noiseVal: number,
    entries: [TerrainType, number][],
    totalWeight: number,
  ): TerrainType {
    // 将 [0,1) 映射到权重区间
    let threshold = noiseVal * totalWeight;
    for (const [terrain, weight] of entries) {
      threshold -= weight;
      if (threshold <= 0) return terrain;
    }
    return entries[entries.length - 1][0];
  }

  // -----------------------------------------------------------------------
  // 河流生成
  // -----------------------------------------------------------------------

  /** 生成一条河流（从地图边缘蜿蜒到另一侧） */
  private static generateRiver(
    tiles: Tile[][],
    width: number,
    height: number,
    seed: number,
  ): void {
    // 从顶部某处开始
    let x = Math.floor(MapGenerator.noise(seed, 0, seed) * width);
    let y = 0;

    while (y < height) {
      // 标记当前格及相邻格为水域
      if (x >= 0 && x < width) {
        tiles[y][x].terrain = TerrainType.WATER;
        tiles[y][x].elevation = -1;
        // 加宽河流
        if (x + 1 < width) {
          tiles[y][x + 1].terrain = TerrainType.WATER;
          tiles[y][x + 1].elevation = -1;
        }
      }

      // 蜿蜒前进
      const drift = MapGenerator.noise(x, y, seed + 200) - 0.5;
      x += Math.round(drift * 2);
      x = Math.max(0, Math.min(width - 1, x));
      y++;
    }
  }

  // -----------------------------------------------------------------------
  // 建筑放置
  // -----------------------------------------------------------------------

  /** 在可建造位置放置建筑 */
  private static placeBuildings(
    tiles: Tile[][],
    count: number,
    seed: number,
  ): PlacedBuilding[] {
    const buildings: PlacedBuilding[] = [];
    if (count <= 0) return buildings;

    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;

    // 收集所有可建造的格子
    const buildable: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (
          tiles[y][x].terrain !== TerrainType.WATER &&
          tiles[y][x].terrain !== TerrainType.MOUNTAIN
        ) {
          buildable.push({ x, y });
        }
      }
    }

    // 随机选取位置放置建筑
    let placed = 0;
    const usedPositions = new Set<string>();

    for (let attempt = 0; attempt < count * 10 && placed < count; attempt++) {
      const idx = Math.floor(
        Math.abs(MapGenerator.noise(attempt, 0, seed + 300)) * buildable.length,
      );
      const pos = buildable[idx % buildable.length];
      const key = `${pos.x},${pos.y}`;

      if (usedPositions.has(key)) continue;
      usedPositions.add(key);

      // 标记该格为道路（建筑入口）
      tiles[pos.y][pos.x].terrain = TerrainType.ROAD;

      buildings.push({
        id: `building_${placed}`,
        defId: 'house',
        x: pos.x,
        y: pos.y,
        level: 1,
        state: 'active',
        buildProgress: 1,
      });

      placed++;
    }

    return buildings;
  }

  // -----------------------------------------------------------------------
  // 道路生成
  // -----------------------------------------------------------------------

  /** 在建筑之间生成道路（简单直线连接） */
  private static generateRoads(
    tiles: Tile[][],
    buildings: PlacedBuilding[],
  ): void {
    if (buildings.length < 2) return;

    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;

    for (let i = 0; i < buildings.length - 1; i++) {
      const a = buildings[i];
      const b = buildings[i + 1];

      // 简单 L 形路径
      let cx = a.x;
      let cy = a.y;

      // 水平移动
      while (cx !== b.x) {
        cx += cx < b.x ? 1 : -1;
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
          if (tiles[cy][cx].terrain !== TerrainType.WATER) {
            tiles[cy][cx].terrain = TerrainType.ROAD;
          }
        }
      }

      // 垂直移动
      while (cy !== b.y) {
        cy += cy < b.y ? 1 : -1;
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
          if (tiles[cy][cx].terrain !== TerrainType.WATER) {
            tiles[cy][cx].terrain = TerrainType.ROAD;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 装饰物放置
  // -----------------------------------------------------------------------

  /** 在可建造格子上随机放置装饰物 */
  private static placeDecorations(
    tiles: Tile[][],
    density: number,
    seed: number,
  ): MapDecoration[] {
    const decorations: MapDecoration[] = [];
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;

    const decoTypes = ['tree', 'rock', 'flower', 'bush', 'fence', 'lamp', 'well'];
    let id = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];

        // 只在特定地形放置装饰
        if (tile.terrain === TerrainType.WATER || tile.terrain === TerrainType.ROAD) continue;
        if (tile.buildingId) continue;

        // 基于噪声决定是否放置
        const chance = MapGenerator.noise(x * 7, y * 7, seed + 400);
        if (chance > density) continue;

        // 森林地形更倾向放树
        let decoType: string;
        if (tile.terrain === TerrainType.FOREST) {
          decoType = 'tree';
        } else {
          const typeIdx = Math.floor(chance * decoTypes.length * 10) % decoTypes.length;
          decoType = decoTypes[typeIdx];
        }

        decorations.push({
          id: `deco_${id++}`,
          type: decoType,
          x,
          y,
        });
      }
    }

    return decorations;
  }

  // -----------------------------------------------------------------------
  // 噪声函数
  // -----------------------------------------------------------------------

  /**
   * 简化的 Value Noise
   *
   * 基于哈希的伪随机 + 双线性插值，
   * 返回 [0, 1) 区间的值。
   */
  private static noise(x: number, y: number, seed: number): number {
    // 哈希函数
    const hash = (a: number, b: number, s: number): number => {
      let h = s;
      h = ((h << 5) - h + a) | 0;
      h = ((h << 5) - h + b) | 0;
      h = ((h >> 16) ^ h) * 0x45d9f3b;
      h = ((h >> 16) ^ h) * 0x45d9f3b;
      h = (h >> 16) ^ h;
      return (h & 0x7fffffff) / 0x7fffffff;
    };

    // 整数网格点
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // 平滑插值因子（smoothstep）
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    // 四角值
    const n00 = hash(ix, iy, seed);
    const n10 = hash(ix + 1, iy, seed);
    const n01 = hash(ix, iy + 1, seed);
    const n11 = hash(ix + 1, iy + 1, seed);

    // 双线性插值
    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;

    return nx0 + (nx1 - nx0) * sy;
  }
}
