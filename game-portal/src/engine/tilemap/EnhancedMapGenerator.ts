/**
 * 增强版地图生成器
 *
 * 在原有 MapGenerator 基础上，支持：
 * - BiomeType 生态群落地形生成
 * - Simplex Noise 自然地形分布
 * - 地形过渡
 * - 建筑放置管理
 * - 装饰层系统
 * - 地图模板
 *
 * 保持与原有 MapGenerator API 的完全兼容。
 *
 * @module engine/tilemap/EnhancedMapGenerator
 */

import { BiomeType, BIOME_CONFIGS, getBiomeTerrainType } from './BiomeConfig';
import { MapGenerator } from './MapGenerator';
import type { MapGenConfig } from './MapGenerator';
import { NoiseGenerator, createSeededRandom } from './SimplexNoiseWrapper';
import { BuildingPlacementManager } from './BuildingPlacementManager';
import { DecoLayer, type DecoLayerConfig } from './DecoLayer';
import { TerrainTransition, type TransitionTile } from './TerrainTransition';
import {
  type MapTemplate,
  getTemplate,
  generateBuildingDefsFromTemplate,
  TEMPLATE_CHINESE_CAPITAL,
  TEMPLATE_EGYPTIAN_DESERT,
  TEMPLATE_BABYLONIAN_CITY,
  TEMPLATE_INDIAN_JUNGLE,
} from './MapTemplates';
import { TerrainType } from './types';
import type { TileMapData, Tile, PlacedBuilding, MapDecoration, BuildingDef } from './types';

// ---------------------------------------------------------------------------
// 增强版生成配置
// ---------------------------------------------------------------------------

/** Biome 地形权重 */
export interface BiomeWeightConfig {
  [key: string]: number;
}

/** 增强版地图生成配置 */
export interface EnhancedMapGenConfig {
  /** 地图宽度 */
  width: number;
  /** 地图高度 */
  height: number;
  /** 每格像素大小 */
  tileSize: number;
  /** 随机种子 */
  seed?: number;
  /** Biome 权重分布 */
  biomeWeights: Partial<Record<BiomeType, number>>;
  /** 噪声缩放 */
  noiseScale?: number;
  /** 装饰密度 */
  decorationDensity?: number;
  /** 河流数量 */
  riverCount?: number;
  /** 建筑数量 */
  buildingSlots?: number;
  /** 是否启用地形过渡 */
  enableTransitions?: boolean;
  /** 是否启用装饰层 */
  enableDecoLayer?: boolean;
  /** 地图模板 ID（可选，覆盖 biomeWeights） */
  templateId?: string;
}

// ---------------------------------------------------------------------------
// 增强版生成结果
// ---------------------------------------------------------------------------

/** 增强版地图生成结果 */
export interface EnhancedMapResult {
  /** 地图数据 */
  mapData: TileMapData;
  /** Biome 映射（tile key → BiomeType） */
  biomeMap: Map<string, BiomeType>;
  /** 过渡瓦片列表 */
  transitions: TransitionTile[];
  /** 建筑放置管理器 */
  buildingManager: BuildingPlacementManager;
  /** 建筑定义列表 */
  buildingDefs: BuildingDef[];
}

// ---------------------------------------------------------------------------
// EnhancedMapGenerator
// ---------------------------------------------------------------------------

export class EnhancedMapGenerator {
  /**
   * 使用增强版配置生成地图
   *
   * @param config 增强版配置
   * @returns 生成结果（包含 mapData、biomeMap、transitions 等）
   */
  static generate(config: EnhancedMapGenConfig): EnhancedMapResult {
    const {
      width,
      height,
      tileSize,
      seed = Date.now(),
      biomeWeights,
      noiseScale = 0.05,
      decorationDensity = 0.2,
      riverCount = 0,
      buildingSlots = 0,
      enableTransitions = true,
      enableDecoLayer = true,
      templateId,
    } = config;

    // 1. 如果指定了模板，使用模板配置
    let effectiveBiomeWeights = biomeWeights;
    let effectiveNoiseScale = noiseScale;
    let effectiveRiverCount = riverCount;
    let effectiveBuildingSlots = buildingSlots;
    let effectiveDecoDensity = decorationDensity;
    let template: MapTemplate | undefined;

    if (templateId) {
      template = getTemplate(templateId);
      if (template) {
        effectiveBiomeWeights = template.biomeWeights as Partial<Record<BiomeType, number>>;
        effectiveNoiseScale = template.noiseScale;
        effectiveRiverCount = template.riverCount;
        effectiveBuildingSlots = Math.floor(
          (template.recommendedSize.width * template.recommendedSize.height) *
          template.buildingStyle.density,
        );
        effectiveDecoDensity = template.decoConfig.density;
      }
    }

    // 2. 使用 Simplex Noise 生成 Biome 分布
    const biomeMap = EnhancedMapGenerator.generateBiomeMap(
      width,
      height,
      seed,
      effectiveBiomeWeights,
      effectiveNoiseScale,
    );

    // 3. 将 Biome 映射转换为 Tile 数组
    const tiles = EnhancedMapGenerator.biomeMapToTiles(biomeMap, width, height, seed);

    // 4. 生成河流
    for (let i = 0; i < effectiveRiverCount; i++) {
      EnhancedMapGenerator.generateRiver(tiles, biomeMap, width, height, seed + i * 1000);
    }

    // 5. 放置建筑
    const buildingDefs = template
      ? generateBuildingDefsFromTemplate(template)
      : EnhancedMapGenerator.getDefaultBuildingDefs();
    const buildingManager = new BuildingPlacementManager();
    buildingManager.registerBuildingDefs(buildingDefs);

    const mapData: TileMapData = {
      width,
      height,
      tileSize,
      tiles,
      buildings: [],
      decorations: [],
    };

    buildingManager.setMapData(mapData, biomeMap);

    // 自动放置建筑
    EnhancedMapGenerator.autoPlaceBuildings(
      buildingManager,
      buildingDefs,
      tiles,
      biomeMap,
      effectiveBuildingSlots,
      seed,
    );

    // 6. 生成装饰
    let decorations: MapDecoration[] = [];
    if (enableDecoLayer) {
      const decoConfig: Partial<DecoLayerConfig> = {
        density: effectiveDecoDensity,
        seed: seed + 999,
        useNoise: true,
      };
      const decoLayer = new DecoLayer(decoConfig);

      const buildingPositions = mapData.buildings.map((b) => {
        const def = buildingDefs.find((d) => d.id === b.defId);
        return { x: b.x, y: b.y, w: def?.size.w ?? 1, h: def?.size.h ?? 1 };
      });

      decorations = decoLayer.generate(tiles, biomeMap, buildingPositions);
      mapData.decorations = decorations;
    }

    // 7. 计算地形过渡
    let transitions: TransitionTile[] = [];
    if (enableTransitions) {
      transitions = TerrainTransition.computeTransitions(mapData, biomeMap);
    }

    return {
      mapData,
      biomeMap,
      transitions,
      buildingManager,
      buildingDefs,
    };
  }

  // -----------------------------------------------------------------------
  // Biome 地图生成
  // -----------------------------------------------------------------------

  /**
   * 使用 Simplex Noise 生成 Biome 分布
   */
  static generateBiomeMap(
    width: number,
    height: number,
    seed: number,
    weights: Partial<Record<BiomeType, number>>,
    noiseScale: number,
  ): Map<string, BiomeType> {
    const biomeMap = new Map<string, BiomeType>();

    // 创建噪声生成器
    const noiseGen = new NoiseGenerator({
      seed,
      scale: noiseScale,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2,
    });

    // 第二层噪声（用于湿度/温度变化）
    const moistureGen = new NoiseGenerator({
      seed: seed + 5000,
      scale: noiseScale * 0.8,
      octaves: 3,
      persistence: 0.6,
      lacunarity: 2,
    });

    // 构建权重阈值表
    const entries = Object.entries(weights) as [BiomeType, number][];
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

    if (totalWeight === 0) {
      // 默认全平原
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
        }
      }
      return biomeMap;
    }

    // 归一化阈值
    const thresholds: { biome: BiomeType; threshold: number }[] = [];
    let cumulative = 0;
    for (const [biome, weight] of entries) {
      cumulative += weight / totalWeight;
      thresholds.push({ biome, threshold: cumulative });
    }

    // 生成 Biome 分布
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elevationNoise = noiseGen.get(x, y);
        const moistureNoise = moistureGen.get(x, y);

        // 使用组合噪声值选择 Biome
        const combinedNoise = elevationNoise * 0.7 + moistureNoise * 0.3;

        let selectedBiome = thresholds[thresholds.length - 1].biome;
        for (const { biome, threshold } of thresholds) {
          if (combinedNoise < threshold) {
            selectedBiome = biome;
            break;
          }
        }

        biomeMap.set(`${x},${y}`, selectedBiome);
      }
    }

    return biomeMap;
  }

  /**
   * 将 Biome 映射转换为 Tile 数组
   */
  static biomeMapToTiles(
    biomeMap: Map<string, BiomeType>,
    width: number,
    height: number,
    seed: number,
  ): Tile[][] {
    const tiles: Tile[][] = [];
    const rng = createSeededRandom(seed + 200);

    for (let y = 0; y < height; y++) {
      tiles[y] = [];
      for (let x = 0; x < width; x++) {
        const biome = biomeMap.get(`${x},${y}`) ?? BiomeType.PLAINS;
        const config = BIOME_CONFIGS[biome];

        // 根据 Biome 选择对应的 TerrainType
        const terrainType = getBiomeTerrainType(biome);

        // 海拔范围
        const [minElev, maxElev] = config.elevationRange;
        const elevation = minElev + Math.floor(rng() * (maxElev - minElev + 1));

        // 变体
        const variant = Math.floor(rng() * 4);

        tiles[y][x] = {
          x,
          y,
          terrain: terrainType,
          elevation,
          variant,
        };
      }
    }

    return tiles;
  }

  // -----------------------------------------------------------------------
  // 河流生成（增强版，考虑 Biome）
  // -----------------------------------------------------------------------

  /**
   * 生成河流（从高处流向低处，优先穿过平原和森林）
   */
  private static generateRiver(
    tiles: Tile[][],
    biomeMap: Map<string, BiomeType>,
    width: number,
    height: number,
    seed: number,
  ): void {
    const rng = createSeededRandom(seed);
    let x = Math.floor(rng() * width);
    let y = 0;

    while (y < height) {
      if (x >= 0 && x < width) {
        tiles[y][x].terrain = TerrainType.WATER;
        tiles[y][x].elevation = -1;
        biomeMap.set(`${x},${y}`, BiomeType.WATER);

        // 加宽河流
        if (x + 1 < width) {
          tiles[y][x + 1].terrain = TerrainType.WATER;
          tiles[y][x + 1].elevation = -1;
          biomeMap.set(`${x + 1},${y}`, BiomeType.WATER);
        }
      }

      // 蜿蜒前进
      const drift = rng() - 0.5;
      x += Math.round(drift * 3);
      x = Math.max(0, Math.min(width - 1, x));
      y++;
    }
  }

  // -----------------------------------------------------------------------
  // 自动建筑放置
  // -----------------------------------------------------------------------

  /**
   * 自动放置建筑
   */
  private static autoPlaceBuildings(
    manager: BuildingPlacementManager,
    defs: BuildingDef[],
    tiles: Tile[][],
    biomeMap: Map<string, BiomeType>,
    count: number,
    seed: number,
  ): void {
    if (count <= 0 || defs.length === 0) return;

    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    const rng = createSeededRandom(seed + 300);
    let placed = 0;

    // 收集可建造位置
    const buildablePositions: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const biome = biomeMap.get(`${x},${y}`);
        if (biome && BIOME_CONFIGS[biome].buildable) {
          buildablePositions.push({ x, y });
        }
      }
    }

    // 随机放置
    for (let attempt = 0; attempt < count * 20 && placed < count; attempt++) {
      const posIdx = Math.floor(rng() * buildablePositions.length);
      const pos = buildablePositions[posIdx];
      if (!pos) continue;

      // 随机选择建筑类型
      const defIdx = Math.floor(rng() * defs.length);
      const def = defs[defIdx];

      const result = manager.canPlace(def.id, pos.x, pos.y);
      if (result.canPlace) {
        const bld = manager.place(def.id, pos.x, pos.y, 1);
        if (bld) {
          bld.state = 'active';
          bld.buildProgress = 1;
          placed++;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 默认建筑定义
  // -----------------------------------------------------------------------

  private static getDefaultBuildingDefs(): BuildingDef[] {
    return [
      {
        id: 'house', name: '民居', type: 'house',
        size: { w: 1, h: 1 }, color: '#8B8682', iconEmoji: '🏠',
        clickable: true, description: '普通民居', levels: 3,
      },
      {
        id: 'market', name: '市场', type: 'market',
        size: { w: 2, h: 2 }, color: '#DAA520', iconEmoji: '🏪',
        clickable: true, description: '贸易市场', levels: 3,
      },
      {
        id: 'temple', name: '神殿', type: 'temple',
        size: { w: 2, h: 2 }, color: '#9370DB', iconEmoji: '⛩️',
        clickable: true, description: '宗教神殿', levels: 5,
      },
    ];
  }

  // -----------------------------------------------------------------------
  // 兼容旧 API
  // -----------------------------------------------------------------------

  /**
   * 使用旧版 MapGenConfig 生成地图（兼容性包装）
   *
   * 内部调用原有 MapGenerator.generate()。
   */
  static generateLegacy(config: MapGenConfig): TileMapData {
    return MapGenerator.generate(config);
  }

  /**
   * 从模板生成地图
   *
   * @param templateId 模板 ID
   * @param tileSize 瓦片大小
   * @param seed 随机种子
   * @returns 增强版生成结果
   */
  static generateFromTemplate(
    templateId: string,
    tileSize: number = 48,
    seed?: number,
  ): EnhancedMapResult {
    const template = getTemplate(templateId);
    if (!template) {
      throw new Error(`模板 ${templateId} 不存在`);
    }

    return EnhancedMapGenerator.generate({
      width: template.recommendedSize.width,
      height: template.recommendedSize.height,
      tileSize,
      seed: seed ?? Date.now(),
      biomeWeights: template.biomeWeights as Partial<Record<BiomeType, number>>,
      noiseScale: template.noiseScale,
      decorationDensity: template.decoConfig.density,
      riverCount: template.riverCount,
      templateId,
    });
  }
}
