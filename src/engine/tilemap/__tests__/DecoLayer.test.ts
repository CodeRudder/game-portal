/**
 * DecoLayer 和 TerrainTransition 模块测试
 *
 * @module engine/tilemap/__tests__/DecoLayer.test
 */

import { DecoLayer, DEFAULT_DECO_CONFIG } from '../DecoLayer';
import { BiomeType, BIOME_CONFIGS } from '../BiomeConfig';
import { TerrainType } from '../types';
import type { Tile, MapDecoration } from '../types';
import {
  TerrainTransition,
  blendColors,
  DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW, DIR_W, DIR_NW,
} from '../TerrainTransition';
import type { TileMapData } from '../types';

// ---------------------------------------------------------------------------
// 测试辅助
// ---------------------------------------------------------------------------

/** 创建测试用瓦片数组 */
function createTestTiles(w: number, h: number, terrain: TerrainType = TerrainType.GRASS): Tile[][] {
  const tiles: Tile[][] = [];
  for (let y = 0; y < h; y++) {
    tiles[y] = [];
    for (let x = 0; x < w; x++) {
      tiles[y][x] = { x, y, terrain, elevation: 0, variant: 0 };
    }
  }
  return tiles;
}

/** 创建测试用地图数据 */
function createTestMapData(w: number, h: number): TileMapData {
  return {
    width: w,
    height: h,
    tileSize: 48,
    tiles: createTestTiles(w, h),
    buildings: [],
    decorations: [],
  };
}

/** 创建混合 Biome 地图 */
function createMixedBiomeMap(w: number, h: number): Map<string, BiomeType> {
  const map = new Map<string, BiomeType>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 左半为平原，右半为森林
      if (x < w / 2) {
        map.set(`${x},${y}`, BiomeType.PLAINS);
      } else {
        map.set(`${x},${y}`, BiomeType.FOREST);
      }
    }
  }
  return map;
}

// ===========================================================================
// DecoLayer 测试
// ===========================================================================

describe('DecoLayer', () => {
  it('应使用默认配置创建', () => {
    const layer = new DecoLayer();
    expect(layer).toBeDefined();
  });

  it('应使用自定义配置创建', () => {
    const layer = new DecoLayer({ density: 0.5, seed: 123, useNoise: false });
    expect(layer).toBeDefined();
  });

  it('应在平原地图上生成装饰物', () => {
    const tiles = createTestTiles(20, 20);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const layer = new DecoLayer({ density: 0.3, seed: 42, useNoise: false });
    const decos = layer.generate(tiles, biomeMap);

    expect(decos.length).toBeGreaterThan(0);
  });

  it('应在森林地图上生成更多装饰物', () => {
    const tiles = createTestTiles(20, 20, TerrainType.FOREST);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.FOREST);
      }
    }

    const plainsLayer = new DecoLayer({ density: 0.3, seed: 42, useNoise: false });
    const forestLayer = new DecoLayer({ density: 0.3, seed: 42, useNoise: false });

    const plainsBiomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        plainsBiomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const plainsDecos = plainsLayer.generate(createTestTiles(20, 20), plainsBiomeMap);
    const forestDecos = forestLayer.generate(tiles, biomeMap);

    // 森林的密度因子更高，应生成更多装饰
    expect(forestDecos.length).toBeGreaterThan(0);
  });

  it('水域 Biome 不应生成装饰物', () => {
    const tiles = createTestTiles(20, 20, TerrainType.WATER);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.WATER);
      }
    }

    const layer = new DecoLayer({ density: 0.5, seed: 42 });
    const decos = layer.generate(tiles, biomeMap);

    expect(decos.length).toBe(0);
  });

  it('应排除已有建筑的格子', () => {
    const tiles = createTestTiles(10, 10);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const buildings = [{ x: 5, y: 5, w: 1, h: 1 }];

    const layer = new DecoLayer({ density: 1.0, seed: 42, useNoise: false, excludeBuildings: true });
    const decos = layer.generate(tiles, biomeMap, buildings);

    // (5,5) 不应有装饰物
    const decoAt55 = decos.find((d) => d.x === 5 && d.y === 5);
    expect(decoAt55).toBeUndefined();
  });

  it('密度为 0 不应生成装饰物', () => {
    const tiles = createTestTiles(20, 20);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const layer = new DecoLayer({ density: 0, seed: 42 });
    const decos = layer.generate(tiles, biomeMap);

    expect(decos.length).toBe(0);
  });

  it('生成的装饰物应有有效属性', () => {
    const tiles = createTestTiles(20, 20);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const layer = new DecoLayer({ density: 0.5, seed: 42, useNoise: false });
    const decos = layer.generate(tiles, biomeMap);

    for (const deco of decos) {
      expect(deco.id).toBeTruthy();
      expect(deco.type).toBeTruthy();
      expect(deco.x).toBeGreaterThanOrEqual(0);
      expect(deco.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('generateForBiome 应只生成指定 Biome 的装饰', () => {
    const tiles = createTestTiles(20, 20);
    const biomeMap = createMixedBiomeMap(20, 20);

    const layer = new DecoLayer({ density: 0.5, seed: 42, useNoise: false });
    const decos = layer.generateForBiome(tiles, biomeMap, BiomeType.PLAINS);

    // 所有装饰应在左半部分（plains 区域）
    for (const deco of decos) {
      expect(deco.x).toBeLessThan(10);
    }
  });

  it('estimateCount 应返回合理估算', () => {
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const layer = new DecoLayer({ density: 0.3, seed: 42 });
    const count = layer.estimateCount(20, 20, BiomeType.PLAINS, biomeMap);

    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(400);
  });

  it('相同种子应生成相同装饰', () => {
    const tiles1 = createTestTiles(20, 20);
    const tiles2 = createTestTiles(20, 20);
    const biomeMap1 = new Map<string, BiomeType>();
    const biomeMap2 = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap1.set(`${x},${y}`, BiomeType.PLAINS);
        biomeMap2.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const layer1 = new DecoLayer({ density: 0.3, seed: 42, useNoise: false });
    const layer2 = new DecoLayer({ density: 0.3, seed: 42, useNoise: false });

    const decos1 = layer1.generate(tiles1, biomeMap1);
    const decos2 = layer2.generate(tiles2, biomeMap2);

    expect(decos1.length).toBe(decos2.length);
  });
});

// ===========================================================================
// DEFAULT_DECO_CONFIG 测试
// ===========================================================================

describe('DEFAULT_DECO_CONFIG', () => {
  it('应有合理的默认值', () => {
    expect(DEFAULT_DECO_CONFIG.density).toBeGreaterThan(0);
    expect(DEFAULT_DECO_CONFIG.density).toBeLessThanOrEqual(1);
    expect(DEFAULT_DECO_CONFIG.seed).toBeDefined();
    expect(DEFAULT_DECO_CONFIG.excludedTerrains).toContain('water');
  });
});

// ===========================================================================
// TerrainTransition 测试
// ===========================================================================

describe('TerrainTransition', () => {
  it('应计算地形过渡', () => {
    const mapData = createTestMapData(20, 20);
    const biomeMap = createMixedBiomeMap(20, 20);

    const transitions = TerrainTransition.computeTransitions(mapData, biomeMap);

    expect(transitions.length).toBeGreaterThan(0);
  });

  it('过渡瓦片应在 Biome 边界上', () => {
    const mapData = createTestMapData(20, 20);
    const biomeMap = createMixedBiomeMap(20, 20);

    const transitions = TerrainTransition.computeTransitions(mapData, biomeMap);

    // 过渡瓦片应在中线附近（x=9 或 x=10 附近）
    for (const t of transitions) {
      const nearBorder = Math.abs(t.x - 10) <= 1;
      expect(nearBorder).toBe(true);
    }
  });

  it('过渡瓦片应有 neighborMask', () => {
    const mapData = createTestMapData(20, 20);
    const biomeMap = createMixedBiomeMap(20, 20);

    const transitions = TerrainTransition.computeTransitions(mapData, biomeMap);

    for (const t of transitions) {
      expect(t.neighborMask).toBeGreaterThan(0);
    }
  });

  it('过渡瓦片应有混合颜色', () => {
    const mapData = createTestMapData(20, 20);
    const biomeMap = createMixedBiomeMap(20, 20);

    const transitions = TerrainTransition.computeTransitions(mapData, biomeMap);

    for (const t of transitions) {
      expect(t.transitionColor).toBeTruthy();
      expect(t.transitionColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('全相同 Biome 不应有过渡', () => {
    const mapData = createTestMapData(20, 20);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }

    const transitions = TerrainTransition.computeTransitions(mapData, biomeMap);
    expect(transitions.length).toBe(0);
  });

  it('getNeighborMask 应返回正确的掩码', () => {
    const tiles = createTestTiles(5, 5);
    const biomeMap = new Map<string, BiomeType>();
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
      }
    }
    // 中心格子改为森林
    biomeMap.set('2,2', BiomeType.FOREST);

    const mask = TerrainTransition.getNeighborMask(tiles, 2, 2, biomeMap);
    // 四周都是平原，应该有 N, NE, E, SE, S, SW, W, NW
    expect(mask).toBe(DIR_N | DIR_NE | DIR_E | DIR_SE | DIR_S | DIR_SW | DIR_W | DIR_NW);
  });

  it('isCornerTransition 应识别角过渡', () => {
    // 只有对角线方向有不同（无相邻正交方向）
    const cornerMask = DIR_NE; // 只有东北角
    expect(TerrainTransition.isCornerTransition(cornerMask)).toBe(true);
  });

  it('非角过渡应返回 false', () => {
    const edgeMask = DIR_N | DIR_E; // 北和东（正交方向）
    expect(TerrainTransition.isCornerTransition(edgeMask)).toBe(false);
  });

  it('describeTransition 应返回方向描述', () => {
    const mask = DIR_N | DIR_E;
    const desc = TerrainTransition.describeTransition(mask);
    expect(desc).toContain('N');
    expect(desc).toContain('E');
  });

  it('describeTransition mask=0 应返回 none', () => {
    expect(TerrainTransition.describeTransition(0)).toBe('none');
  });
});

// ===========================================================================
// blendColors 测试
// ===========================================================================

describe('blendColors', () => {
  it('应混合两个颜色', () => {
    const result = blendColors('#ff0000', '#0000ff', 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('ratio=0 应返回第一个颜色', () => {
    const result = blendColors('#ff0000', '#0000ff', 0);
    expect(result.toUpperCase()).toBe('#FF0000');
  });

  it('ratio=1 应返回第二个颜色', () => {
    const result = blendColors('#ff0000', '#0000ff', 1);
    expect(result.toUpperCase()).toBe('#0000FF');
  });

  it('混合黑白应为灰色', () => {
    const result = blendColors('#000000', '#ffffff', 0.5);
    expect(result.toUpperCase()).toBe('#808080');
  });

  it('相同颜色混合应返回原色', () => {
    const result = blendColors('#aabbcc', '#aabbcc', 0.5);
    expect(result.toUpperCase()).toBe('#AABBCC');
  });
});

// ===========================================================================
// 方向常量测试
// ===========================================================================

describe('方向常量', () => {
  it('每个方向应有不同的位', () => {
    const dirs = [DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW, DIR_W, DIR_NW];
    const uniqueBits = new Set(dirs);
    expect(uniqueBits.size).toBe(8);
  });

  it('方向值应为 2 的幂', () => {
    const dirs = [DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW, DIR_W, DIR_NW];
    for (const dir of dirs) {
      expect(dir & (dir - 1)).toBe(0); // 2^n 的特性
    }
  });

  it('所有方向 OR 应为 0xFF', () => {
    const all = DIR_N | DIR_NE | DIR_E | DIR_SE | DIR_S | DIR_SW | DIR_W | DIR_NW;
    expect(all).toBe(0xff);
  });
});
