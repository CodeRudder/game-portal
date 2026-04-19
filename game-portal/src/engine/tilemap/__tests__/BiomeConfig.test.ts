/**
 * BiomeConfig 模块测试
 *
 * 测试 BiomeType 枚举、BiomeConfig 配置、辅助函数等。
 *
 * @module engine/tilemap/__tests__/BiomeConfig.test
 */

import { describe, it, expect } from 'vitest';
import {
  BiomeType,
  BIOME_CONFIGS,
  getBiomeConfig,
  getBiomeTerrainType,
  isBiomeBuildable,
  isBiomeWalkable,
  getBuildableBiomes,
  getWalkableBiomes,
} from '../BiomeConfig';
import { TerrainType } from '../types';

// ---------------------------------------------------------------------------
// BiomeType 枚举
// ---------------------------------------------------------------------------

describe('BiomeType', () => {
  it('应包含 8 种生态群落类型', () => {
    const types = Object.values(BiomeType);
    expect(types).toHaveLength(8);
  });

  it('应包含 plains 类型', () => {
    expect(BiomeType.PLAINS).toBe('plains');
  });

  it('应包含 forest 类型', () => {
    expect(BiomeType.FOREST).toBe('forest');
  });

  it('应包含 desert 类型', () => {
    expect(BiomeType.DESERT).toBe('desert');
  });

  it('应包含 mountain 类型', () => {
    expect(BiomeType.MOUNTAIN).toBe('mountain');
  });

  it('应包含 water 类型', () => {
    expect(BiomeType.WATER).toBe('water');
  });

  it('应包含 swamp 类型', () => {
    expect(BiomeType.SWAMP).toBe('swamp');
  });

  it('应包含 snow 类型', () => {
    expect(BiomeType.SNOW).toBe('snow');
  });

  it('应包含 volcanic 类型', () => {
    expect(BiomeType.VOLCANIC).toBe('volcanic');
  });
});

// ---------------------------------------------------------------------------
// BIOME_CONFIGS
// ---------------------------------------------------------------------------

describe('BIOME_CONFIGS', () => {
  it('应有 8 种 Biome 配置', () => {
    expect(Object.keys(BIOME_CONFIGS)).toHaveLength(8);
  });

  it('每种 Biome 应有必要属性', () => {
    for (const biome of Object.values(BiomeType)) {
      const config = BIOME_CONFIGS[biome];
      expect(config).toBeDefined();
      expect(config.type).toBe(biome);
      expect(config.name).toBeTruthy();
      expect(config.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(config.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof config.walkable).toBe('boolean');
      expect(typeof config.buildable).toBe('boolean');
      expect(typeof config.movementCost).toBe('number');
      expect(config.resources).toBeDefined();
      expect(config.terrainTypes.length).toBeGreaterThan(0);
      expect(config.decoTheme).toBeDefined();
      expect(config.elevationRange).toHaveLength(2);
      expect(typeof config.noiseThreshold).toBe('number');
    }
  });

  it('plains 应可建造可通行', () => {
    const config = BIOME_CONFIGS[BiomeType.PLAINS];
    expect(config.walkable).toBe(true);
    expect(config.buildable).toBe(true);
    expect(config.movementCost).toBe(1);
  });

  it('forest 应可通行但不可建造', () => {
    const config = BIOME_CONFIGS[BiomeType.FOREST];
    expect(config.walkable).toBe(true);
    expect(config.buildable).toBe(false);
    expect(config.movementCost).toBe(2);
  });

  it('water 应不可通行不可建造', () => {
    const config = BIOME_CONFIGS[BiomeType.WATER];
    expect(config.walkable).toBe(false);
    expect(config.buildable).toBe(false);
    expect(config.movementCost).toBe(Infinity);
  });

  it('mountain 应不可通行', () => {
    const config = BIOME_CONFIGS[BiomeType.MOUNTAIN];
    expect(config.walkable).toBe(false);
    expect(config.buildable).toBe(false);
  });

  it('volcanic 应可通行但高消耗', () => {
    const config = BIOME_CONFIGS[BiomeType.VOLCANIC];
    expect(config.walkable).toBe(true);
    expect(config.buildable).toBe(false);
    expect(config.movementCost).toBe(3);
  });

  it('每种 Biome 的资源产出应为非负数', () => {
    for (const biome of Object.values(BiomeType)) {
      const config = BIOME_CONFIGS[biome];
      const { food, wood, stone, gold } = config.resources;
      expect(food).toBeGreaterThanOrEqual(0);
      expect(wood).toBeGreaterThanOrEqual(0);
      expect(stone).toBeGreaterThanOrEqual(0);
      expect(gold).toBeGreaterThanOrEqual(0);
    }
  });

  it('每种 Biome 的海拔范围应合理', () => {
    for (const biome of Object.values(BiomeType)) {
      const config = BIOME_CONFIGS[biome];
      const [min, max] = config.elevationRange;
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it('plains 应映射到 GRASS 或 DIRT 地形', () => {
    const config = BIOME_CONFIGS[BiomeType.PLAINS];
    expect(config.terrainTypes).toContain(TerrainType.GRASS);
  });

  it('forest 应映射到 FOREST 地形', () => {
    const config = BIOME_CONFIGS[BiomeType.FOREST];
    expect(config.terrainTypes).toContain(TerrainType.FOREST);
  });

  it('desert 应映射到 SAND 地形', () => {
    const config = BIOME_CONFIGS[BiomeType.DESERT];
    expect(config.terrainTypes).toContain(TerrainType.SAND);
  });

  it('water 应映射到 WATER 地形', () => {
    const config = BIOME_CONFIGS[BiomeType.WATER];
    expect(config.terrainTypes).toContain(TerrainType.WATER);
  });
});

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

describe('Biome 辅助函数', () => {
  it('getBiomeConfig 应返回正确配置', () => {
    const config = getBiomeConfig(BiomeType.PLAINS);
    expect(config.type).toBe(BiomeType.PLAINS);
    expect(config.name).toBe('平原');
  });

  it('getBiomeTerrainType 应返回主要地形类型', () => {
    expect(getBiomeTerrainType(BiomeType.PLAINS)).toBe(TerrainType.GRASS);
    expect(getBiomeTerrainType(BiomeType.FOREST)).toBe(TerrainType.FOREST);
    expect(getBiomeTerrainType(BiomeType.DESERT)).toBe(TerrainType.SAND);
    expect(getBiomeTerrainType(BiomeType.WATER)).toBe(TerrainType.WATER);
    expect(getBiomeTerrainType(BiomeType.MOUNTAIN)).toBe(TerrainType.MOUNTAIN);
    expect(getBiomeTerrainType(BiomeType.SNOW)).toBe(TerrainType.SNOW);
  });

  it('isBiomeBuildable 应正确判断', () => {
    expect(isBiomeBuildable(BiomeType.PLAINS)).toBe(true);
    expect(isBiomeBuildable(BiomeType.DESERT)).toBe(true);
    expect(isBiomeBuildable(BiomeType.WATER)).toBe(false);
    expect(isBiomeBuildable(BiomeType.MOUNTAIN)).toBe(false);
    expect(isBiomeBuildable(BiomeType.FOREST)).toBe(false);
    expect(isBiomeBuildable(BiomeType.SWAMP)).toBe(false);
    expect(isBiomeBuildable(BiomeType.SNOW)).toBe(false);
    expect(isBiomeBuildable(BiomeType.VOLCANIC)).toBe(false);
  });

  it('isBiomeWalkable 应正确判断', () => {
    expect(isBiomeWalkable(BiomeType.PLAINS)).toBe(true);
    expect(isBiomeWalkable(BiomeType.FOREST)).toBe(true);
    expect(isBiomeWalkable(BiomeType.WATER)).toBe(false);
    expect(isBiomeWalkable(BiomeType.MOUNTAIN)).toBe(false);
  });

  it('getBuildableBiomes 应返回可建造的 Biome 列表', () => {
    const buildable = getBuildableBiomes();
    expect(buildable).toContain(BiomeType.PLAINS);
    expect(buildable).toContain(BiomeType.DESERT);
    expect(buildable).not.toContain(BiomeType.WATER);
    expect(buildable).not.toContain(BiomeType.MOUNTAIN);
  });

  it('getWalkableBiomes 应返回可通行的 Biome 列表', () => {
    const walkable = getWalkableBiomes();
    expect(walkable).toContain(BiomeType.PLAINS);
    expect(walkable).toContain(BiomeType.FOREST);
    expect(walkable).toContain(BiomeType.DESERT);
    expect(walkable).not.toContain(BiomeType.WATER);
    expect(walkable).not.toContain(BiomeType.MOUNTAIN);
  });

  it('每种 Biome 的装饰主题应有颜色配置', () => {
    for (const biome of Object.values(BiomeType)) {
      const config = BIOME_CONFIGS[biome];
      for (const decoType of config.decoTheme.types) {
        expect(config.decoTheme.colors[decoType]).toBeDefined();
      }
    }
  });
});
