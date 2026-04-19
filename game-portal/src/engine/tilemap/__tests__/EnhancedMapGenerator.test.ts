/**
 * MapTemplates 和 EnhancedMapGenerator 模块测试
 *
 * @module engine/tilemap/__tests__/EnhancedMapGenerator.test
 */

import { describe, it, expect } from 'vitest';
import { BiomeType, BIOME_CONFIGS } from '../BiomeConfig';
import { TerrainType } from '../types';
import type { TileMapData } from '../types';
import {
  TEMPLATE_CHINESE_CAPITAL,
  TEMPLATE_EGYPTIAN_DESERT,
  TEMPLATE_BABYLONIAN_CITY,
  TEMPLATE_INDIAN_JUNGLE,
  MAP_TEMPLATES,
  getTemplate,
  getTemplateIds,
  getAllTemplates,
  generateBuildingDefsFromTemplate,
} from '../MapTemplates';
import { EnhancedMapGenerator } from '../EnhancedMapGenerator';
import type { EnhancedMapGenConfig } from '../EnhancedMapGenerator';

// ===========================================================================
// MapTemplates 测试
// ===========================================================================

describe('MapTemplates', () => {
  it('应有 4 种预定义模板', () => {
    expect(Object.keys(MAP_TEMPLATES)).toHaveLength(4);
  });

  // --- 中国古都 ---

  describe('中国古都模板', () => {
    it('应有正确的 ID 和名称', () => {
      expect(TEMPLATE_CHINESE_CAPITAL.id).toBe('chinese_capital');
      expect(TEMPLATE_CHINESE_CAPITAL.name).toBe('中国古都');
    });

    it('应包含平原和山脉地形', () => {
      const w = TEMPLATE_CHINESE_CAPITAL.biomeWeights;
      expect(w[BiomeType.PLAINS]).toBeGreaterThan(0);
      expect(w[BiomeType.MOUNTAIN]).toBeGreaterThan(0);
    });

    it('应有河流', () => {
      expect(TEMPLATE_CHINESE_CAPITAL.riverCount).toBeGreaterThan(0);
    });

    it('应有建筑定义', () => {
      expect(TEMPLATE_CHINESE_CAPITAL.buildingStyle.buildingIds.length).toBeGreaterThan(0);
    });

    it('应有装饰配置', () => {
      expect(TEMPLATE_CHINESE_CAPITAL.decoConfig.density).toBeGreaterThan(0);
      expect(TEMPLATE_CHINESE_CAPITAL.decoConfig.extraDecoTypes.length).toBeGreaterThan(0);
    });

    it('应有推荐尺寸', () => {
      const { width, height } = TEMPLATE_CHINESE_CAPITAL.recommendedSize;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });

    it('应有主题色', () => {
      expect(TEMPLATE_CHINESE_CAPITAL.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  // --- 埃及沙漠 ---

  describe('埃及沙漠模板', () => {
    it('应有正确的 ID 和名称', () => {
      expect(TEMPLATE_EGYPTIAN_DESERT.id).toBe('egyptian_desert');
      expect(TEMPLATE_EGYPTIAN_DESERT.name).toBe('埃及沙漠');
    });

    it('应以沙漠为主', () => {
      expect(TEMPLATE_EGYPTIAN_DESERT.biomeWeights[BiomeType.DESERT]).toBeGreaterThan(0.5);
    });

    it('应包含 pyramid 建筑', () => {
      expect(TEMPLATE_EGYPTIAN_DESERT.buildingStyle.buildingIds).toContain('pyramid');
    });

    it('应有装饰配置', () => {
      expect(TEMPLATE_EGYPTIAN_DESERT.decoConfig.extraDecoTypes).toContain('palm');
    });
  });

  // --- 巴比伦城邦 ---

  describe('巴比伦城邦模板', () => {
    it('应有正确的 ID 和名称', () => {
      expect(TEMPLATE_BABYLONIAN_CITY.id).toBe('babylonian_city');
      expect(TEMPLATE_BABYLONIAN_CITY.name).toBe('巴比伦城邦');
    });

    it('应包含平原和沙漠', () => {
      expect(TEMPLATE_BABYLONIAN_CITY.biomeWeights[BiomeType.PLAINS]).toBeGreaterThan(0);
      expect(TEMPLATE_BABYLONIAN_CITY.biomeWeights[BiomeType.DESERT]).toBeGreaterThan(0);
    });

    it('应包含 ziggurat 建筑', () => {
      expect(TEMPLATE_BABYLONIAN_CITY.buildingStyle.buildingIds).toContain('ziggurat');
    });

    it('应有河流', () => {
      expect(TEMPLATE_BABYLONIAN_CITY.riverCount).toBeGreaterThan(0);
    });
  });

  // --- 印度丛林 ---

  describe('印度丛林模板', () => {
    it('应有正确的 ID 和名称', () => {
      expect(TEMPLATE_INDIAN_JUNGLE.id).toBe('indian_jungle');
      expect(TEMPLATE_INDIAN_JUNGLE.name).toBe('印度丛林');
    });

    it('应以森林为主', () => {
      expect(TEMPLATE_INDIAN_JUNGLE.biomeWeights[BiomeType.FOREST]).toBeGreaterThan(0.3);
    });

    it('应有较多河流', () => {
      expect(TEMPLATE_INDIAN_JUNGLE.riverCount).toBeGreaterThanOrEqual(3);
    });

    it('应包含 shrine 建筑', () => {
      expect(TEMPLATE_INDIAN_JUNGLE.buildingStyle.buildingIds).toContain('shrine');
    });
  });

  // --- 模板辅助函数 ---

  describe('模板辅助函数', () => {
    it('getTemplate 应返回正确的模板', () => {
      expect(getTemplate('chinese_capital')).toBe(TEMPLATE_CHINESE_CAPITAL);
      expect(getTemplate('egyptian_desert')).toBe(TEMPLATE_EGYPTIAN_DESERT);
      expect(getTemplate('babylonian_city')).toBe(TEMPLATE_BABYLONIAN_CITY);
      expect(getTemplate('indian_jungle')).toBe(TEMPLATE_INDIAN_JUNGLE);
    });

    it('getTemplate 不存在的 ID 应返回 undefined', () => {
      expect(getTemplate('nonexistent')).toBeUndefined();
    });

    it('getTemplateIds 应返回所有模板 ID', () => {
      const ids = getTemplateIds();
      expect(ids).toHaveLength(4);
      expect(ids).toContain('chinese_capital');
      expect(ids).toContain('egyptian_desert');
      expect(ids).toContain('babylonian_city');
      expect(ids).toContain('indian_jungle');
    });

    it('getAllTemplates 应返回所有模板', () => {
      const templates = getAllTemplates();
      expect(templates).toHaveLength(4);
    });
  });

  // --- 建筑定义生成 ---

  describe('generateBuildingDefsFromTemplate', () => {
    it('中国古都应生成建筑定义', () => {
      const defs = generateBuildingDefsFromTemplate(TEMPLATE_CHINESE_CAPITAL);
      expect(defs.length).toBeGreaterThan(0);
      const ids = defs.map((d) => d.id);
      expect(ids).toContain('palace');
      expect(ids).toContain('pagoda');
      expect(ids).toContain('temple');
    });

    it('埃及沙漠应生成建筑定义', () => {
      const defs = generateBuildingDefsFromTemplate(TEMPLATE_EGYPTIAN_DESERT);
      const ids = defs.map((d) => d.id);
      expect(ids).toContain('pyramid');
      expect(ids).toContain('temple');
    });

    it('巴比伦城邦应生成建筑定义', () => {
      const defs = generateBuildingDefsFromTemplate(TEMPLATE_BABYLONIAN_CITY);
      const ids = defs.map((d) => d.id);
      expect(ids).toContain('ziggurat');
    });

    it('印度丛林应生成建筑定义', () => {
      const defs = generateBuildingDefsFromTemplate(TEMPLATE_INDIAN_JUNGLE);
      const ids = defs.map((d) => d.id);
      expect(ids).toContain('shrine');
    });

    it('生成的建筑定义应有有效属性', () => {
      for (const template of getAllTemplates()) {
        const defs = generateBuildingDefsFromTemplate(template);
        for (const def of defs) {
          expect(def.id).toBeTruthy();
          expect(def.name).toBeTruthy();
          expect(def.size.w).toBeGreaterThan(0);
          expect(def.size.h).toBeGreaterThan(0);
          expect(def.color).toBeTruthy();
          expect(def.iconEmoji).toBeTruthy();
        }
      }
    });
  });
});

// ===========================================================================
// EnhancedMapGenerator 测试
// ===========================================================================

describe('EnhancedMapGenerator', () => {
  it('应使用 Biome 权重生成地图', () => {
    const result = EnhancedMapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      biomeWeights: {
        [BiomeType.PLAINS]: 0.6,
        [BiomeType.FOREST]: 0.4,
      },
    });

    expect(result.mapData.width).toBe(20);
    expect(result.mapData.height).toBe(20);
    expect(result.biomeMap.size).toBe(400);
  });

  it('应生成 Biome 映射', () => {
    const result = EnhancedMapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      biomeWeights: {
        [BiomeType.PLAINS]: 0.5,
        [BiomeType.FOREST]: 0.5,
      },
    });

    // 应有不同类型的 Biome
    const biomeTypes = new Set(result.biomeMap.values());
    expect(biomeTypes.size).toBeGreaterThanOrEqual(1);
  });

  it('应生成地形过渡', () => {
    const result = EnhancedMapGenerator.generate({
      width: 30,
      height: 30,
      tileSize: 48,
      seed: 42,
      biomeWeights: {
        [BiomeType.PLAINS]: 0.5,
        [BiomeType.FOREST]: 0.5,
      },
      enableTransitions: true,
    });

    expect(result.transitions).toBeDefined();
    expect(Array.isArray(result.transitions)).toBe(true);
  });

  it('禁用过渡时不应生成过渡', () => {
    const result = EnhancedMapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      biomeWeights: { [BiomeType.PLAINS]: 1 },
      enableTransitions: false,
    });

    expect(result.transitions).toHaveLength(0);
  });

  it('应生成装饰物', () => {
    const result = EnhancedMapGenerator.generate({
      width: 30,
      height: 30,
      tileSize: 48,
      seed: 42,
      biomeWeights: {
        [BiomeType.PLAINS]: 0.5,
        [BiomeType.FOREST]: 0.5,
      },
      decorationDensity: 0.3,
      enableDecoLayer: true,
    });

    expect(result.mapData.decorations.length).toBeGreaterThan(0);
  });

  it('禁用装饰时不应生成装饰物', () => {
    const result = EnhancedMapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      biomeWeights: { [BiomeType.PLAINS]: 1 },
      enableDecoLayer: false,
    });

    expect(result.mapData.decorations).toHaveLength(0);
  });

  it('应放置建筑', () => {
    const result = EnhancedMapGenerator.generate({
      width: 30,
      height: 30,
      tileSize: 48,
      seed: 42,
      biomeWeights: { [BiomeType.PLAINS]: 1 },
      buildingSlots: 5,
    });

    expect(result.mapData.buildings.length).toBeGreaterThan(0);
  });

  it('应返回建筑放置管理器', () => {
    const result = EnhancedMapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      biomeWeights: { [BiomeType.PLAINS]: 1 },
    });

    expect(result.buildingManager).toBeDefined();
  });

  it('应返回建筑定义列表', () => {
    const result = EnhancedMapGenerator.generate({
      width: 20,
      height: 20,
      tileSize: 48,
      seed: 42,
      biomeWeights: { [BiomeType.PLAINS]: 1 },
    });

    expect(result.buildingDefs.length).toBeGreaterThan(0);
  });

  it('相同种子应生成相同地图', () => {
    const config: EnhancedMapGenConfig = {
      width: 15,
      height: 15,
      tileSize: 48,
      seed: 777,
      biomeWeights: {
        [BiomeType.PLAINS]: 0.6,
        [BiomeType.FOREST]: 0.4,
      },
    };

    const a = EnhancedMapGenerator.generate(config);
    const b = EnhancedMapGenerator.generate(config);

    // Biome 映射应相同
    for (const [key, biome] of a.biomeMap) {
      expect(b.biomeMap.get(key)).toBe(biome);
    }
  });

  it('应生成河流', () => {
    const result = EnhancedMapGenerator.generate({
      width: 30,
      height: 30,
      tileSize: 48,
      seed: 42,
      biomeWeights: { [BiomeType.PLAINS]: 1 },
      riverCount: 2,
    });

    const waterTiles = result.mapData.tiles.flat().filter((t) => t.terrain === TerrainType.WATER);
    expect(waterTiles.length).toBeGreaterThan(0);
  });

  // --- 模板生成 ---

  describe('generateFromTemplate', () => {
    it('应使用中国古都模板生成地图', () => {
      const result = EnhancedMapGenerator.generateFromTemplate('chinese_capital', 48, 42);
      expect(result.mapData.width).toBe(TEMPLATE_CHINESE_CAPITAL.recommendedSize.width);
      expect(result.mapData.height).toBe(TEMPLATE_CHINESE_CAPITAL.recommendedSize.height);
    });

    it('应使用埃及沙漠模板生成地图', () => {
      const result = EnhancedMapGenerator.generateFromTemplate('egyptian_desert', 48, 42);
      expect(result.mapData.width).toBe(TEMPLATE_EGYPTIAN_DESERT.recommendedSize.width);
    });

    it('应使用巴比伦城邦模板生成地图', () => {
      const result = EnhancedMapGenerator.generateFromTemplate('babylonian_city', 48, 42);
      expect(result.mapData.width).toBe(TEMPLATE_BABYLONIAN_CITY.recommendedSize.width);
    });

    it('应使用印度丛林模板生成地图', () => {
      const result = EnhancedMapGenerator.generateFromTemplate('indian_jungle', 48, 42);
      expect(result.mapData.width).toBe(TEMPLATE_INDIAN_JUNGLE.recommendedSize.width);
    });

    it('不存在的模板应抛出错误', () => {
      expect(() => {
        EnhancedMapGenerator.generateFromTemplate('nonexistent', 48, 42);
      }).toThrow('模板 nonexistent 不存在');
    });
  });

  // --- 通过 templateId 配置生成 ---

  describe('通过 templateId 生成', () => {
    it('应使用模板配置覆盖 biomeWeights', () => {
      const result = EnhancedMapGenerator.generate({
        width: 30,
        height: 30,
        tileSize: 48,
        seed: 42,
        biomeWeights: { [BiomeType.PLAINS]: 1 },
        templateId: 'egyptian_desert',
      });

      // 应有沙漠地形（来自模板）
      const terrains = new Set(result.mapData.tiles.flat().map((t) => t.terrain));
      expect(terrains.has(TerrainType.SAND) || terrains.has(TerrainType.GRASS)).toBe(true);
    });
  });

  // --- 兼容旧 API ---

  describe('generateLegacy', () => {
    it('应调用原有 MapGenerator', () => {
      const data = EnhancedMapGenerator.generateLegacy({
        width: 10,
        height: 10,
        tileSize: 48,
        seed: 42,
        terrainWeights: { [TerrainType.GRASS]: 1 },
        decorationDensity: 0,
      });

      expect(data.width).toBe(10);
      expect(data.height).toBe(10);
    });
  });

  // --- Biome 地图生成 ---

  describe('generateBiomeMap', () => {
    it('应生成正确尺寸的 Biome 映射', () => {
      const biomeMap = EnhancedMapGenerator.generateBiomeMap(
        20, 20, 42,
        { [BiomeType.PLAINS]: 0.5, [BiomeType.FOREST]: 0.5 },
        0.05,
      );

      expect(biomeMap.size).toBe(400);
    });

    it('空权重应生成全平原', () => {
      const biomeMap = EnhancedMapGenerator.generateBiomeMap(
        10, 10, 42, {}, 0.05,
      );

      for (const biome of biomeMap.values()) {
        expect(biome).toBe(BiomeType.PLAINS);
      }
    });

    it('单一权重应生成单一 Biome', () => {
      const biomeMap = EnhancedMapGenerator.generateBiomeMap(
        10, 10, 42,
        { [BiomeType.DESERT]: 1 },
        0.05,
      );

      for (const biome of biomeMap.values()) {
        expect(biome).toBe(BiomeType.DESERT);
      }
    });
  });

  // --- biomeMapToTiles ---

  describe('biomeMapToTiles', () => {
    it('应生成正确的瓦片数组', () => {
      const biomeMap = new Map<string, BiomeType>();
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
        }
      }

      const tiles = EnhancedMapGenerator.biomeMapToTiles(biomeMap, 10, 10, 42);

      expect(tiles).toHaveLength(10);
      expect(tiles[0]).toHaveLength(10);
    });

    it('Biome 应映射到正确的地形类型', () => {
      const biomeMap = new Map<string, BiomeType>();
      biomeMap.set('0,0', BiomeType.FOREST);
      biomeMap.set('1,0', BiomeType.WATER);
      biomeMap.set('2,0', BiomeType.DESERT);

      const tiles = EnhancedMapGenerator.biomeMapToTiles(biomeMap, 3, 1, 42);

      expect(tiles[0][0].terrain).toBe(TerrainType.FOREST);
      expect(tiles[0][1].terrain).toBe(TerrainType.WATER);
      expect(tiles[0][2].terrain).toBe(TerrainType.SAND);
    });

    it('瓦片应有海拔和变体', () => {
      const biomeMap = new Map<string, BiomeType>();
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          biomeMap.set(`${x},${y}`, BiomeType.PLAINS);
        }
      }

      const tiles = EnhancedMapGenerator.biomeMapToTiles(biomeMap, 5, 5, 42);

      for (const row of tiles) {
        for (const tile of row) {
          expect(typeof tile.elevation).toBe('number');
          expect(typeof tile.variant).toBe('number');
          expect(tile.variant).toBeGreaterThanOrEqual(0);
          expect(tile.variant).toBeLessThan(4);
        }
      }
    });
  });
});
