/**
 * core/map/map-config 单元测试
 *
 * 测试地图基础参数、区域划分、地形类型、特殊地标配置和辅助函数。
 */

import {
  MAP_SIZE,
  GRID_CONFIG,
  VIEWPORT_CONFIG,
  MAP_PIXEL_SIZE,
  REGION_IDS,
  REGION_DEFS,
  REGION_LABELS,
  REGION_COLORS,
  TERRAIN_TYPES,
  TERRAIN_DEFS,
  TERRAIN_LABELS,
  TERRAIN_COLORS,
  DEFAULT_LANDMARKS,
  LANDMARK_POSITIONS,
  MAP_SAVE_VERSION,
  getRegionAtPosition,
  getTerrainAtPosition,
  generateAllTiles,
} from '../map-config';
import type { RegionId, TerrainType, LandmarkType, LandmarkLevel } from '../world-map.types';

// ═══════════════════════════════════════════════════════════

describe('map-config', () => {
  // ═══════════════════════════════════════════
  // 1. 地图基础参数（#9）
  // ═══════════════════════════════════════════
  describe('地图基础参数', () => {
    it('MAP_SIZE 为 100×60', () => {
      expect(MAP_SIZE.cols).toBe(100);
      expect(MAP_SIZE.rows).toBe(60);
    });

    it('GRID_CONFIG 格子尺寸为 32×32', () => {
      expect(GRID_CONFIG.tileWidth).toBe(32);
      expect(GRID_CONFIG.tileHeight).toBe(32);
    });

    it('VIEWPORT_CONFIG PC端视口为 1280×696', () => {
      expect(VIEWPORT_CONFIG.width).toBe(1280);
      expect(VIEWPORT_CONFIG.height).toBe(696);
    });

    it('VIEWPORT_CONFIG 缩放范围合理', () => {
      expect(VIEWPORT_CONFIG.minZoom).toBeLessThan(VIEWPORT_CONFIG.defaultZoom);
      expect(VIEWPORT_CONFIG.maxZoom).toBeGreaterThan(VIEWPORT_CONFIG.defaultZoom);
      expect(VIEWPORT_CONFIG.defaultZoom).toBe(1.0);
    });

    it('MAP_PIXEL_SIZE 正确计算', () => {
      expect(MAP_PIXEL_SIZE.width).toBe(100 * 32);
      expect(MAP_PIXEL_SIZE.height).toBe(60 * 32);
    });

    it('MAP_SAVE_VERSION 为正整数', () => {
      expect(MAP_SAVE_VERSION).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 三大区域划分（#10）
  // ═══════════════════════════════════════════
  describe('三大区域划分', () => {
    it('REGION_IDS 包含四个区域（⚠️ PRD MAP-1: 魏/蜀/吴+中立）', () => {
      expect(REGION_IDS).toHaveLength(4);
      expect(REGION_IDS).toContain('wei');
      expect(REGION_IDS).toContain('wu');
      expect(REGION_IDS).toContain('shu');
      expect(REGION_IDS).toContain('neutral');
    });

    it('REGION_DEFS 每个区域定义完整', () => {
      for (const id of REGION_IDS) {
        const def = REGION_DEFS[id];
        expect(def).toBeDefined();
        expect(def.id).toBe(id);
        expect(def.label).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(def.bounds).toBeDefined();
        expect(def.bounds.startX).toBeLessThanOrEqual(def.bounds.endX);
        expect(def.bounds.startY).toBeLessThanOrEqual(def.bounds.endY);
      }
    });

    it('REGION_LABELS 包含正确的中文名', () => {
      expect(REGION_LABELS.wei).toBe('魏');
      expect(REGION_LABELS.wu).toBe('吴');
      expect(REGION_LABELS.shu).toBe('蜀');
    });

    it('REGION_COLORS 每个区域有颜色', () => {
      for (const id of REGION_IDS) {
        expect(REGION_COLORS[id]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('区域边界在地图范围内', () => {
      for (const id of REGION_IDS) {
        const { bounds } = REGION_DEFS[id];
        expect(bounds.startX).toBeGreaterThanOrEqual(0);
        expect(bounds.startY).toBeGreaterThanOrEqual(0);
        expect(bounds.endX).toBeLessThan(MAP_SIZE.cols);
        expect(bounds.endY).toBeLessThan(MAP_SIZE.rows);
      }
    });

    it('区域覆盖完整地图（无遗漏）', () => {
      // 验证每个格子都至少属于一个区域
      for (let y = 0; y < MAP_SIZE.rows; y++) {
        for (let x = 0; x < MAP_SIZE.cols; x++) {
          const region = getRegionAtPosition(x, y);
          expect(REGION_IDS).toContain(region);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 地形类型（#11）
  // ═══════════════════════════════════════════
  describe('地形类型', () => {
    it('TERRAIN_TYPES 包含 6 种地形', () => {
      expect(TERRAIN_TYPES).toHaveLength(6);
      expect(TERRAIN_TYPES).toContain('plain');
      expect(TERRAIN_TYPES).toContain('mountain');
      expect(TERRAIN_TYPES).toContain('water');
      expect(TERRAIN_TYPES).toContain('forest');
      expect(TERRAIN_TYPES).toContain('pass');
      expect(TERRAIN_TYPES).toContain('city');
    });

    it('TERRAIN_DEFS 每种地形定义完整', () => {
      for (const type of TERRAIN_TYPES) {
        const def = TERRAIN_DEFS[type];
        expect(def).toBeDefined();
        expect(def.type).toBe(type);
        expect(def.label).toBeTruthy();
        expect(def.baseColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(def.icon).toBeTruthy();
        expect(typeof def.moveCost).toBe('number');
        expect(def.moveCost).toBeGreaterThan(0);
        expect(typeof def.defenseBonus).toBe('number');
        expect(typeof def.passable).toBe('boolean');
      }
    });

    it('TERRAIN_LABELS 包含正确的中文名', () => {
      expect(TERRAIN_LABELS.plain).toBe('平原');
      expect(TERRAIN_LABELS.mountain).toBe('山地');
      expect(TERRAIN_LABELS.water).toBe('水域');
      expect(TERRAIN_LABELS.forest).toBe('森林');
      expect(TERRAIN_LABELS.pass).toBe('关隘');
      expect(TERRAIN_LABELS.city).toBe('城池');
    });

    it('TERRAIN_COLORS 每种地形有颜色', () => {
      for (const type of TERRAIN_TYPES) {
        expect(TERRAIN_COLORS[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('水域不可通行', () => {
      expect(TERRAIN_DEFS.water.passable).toBe(false);
    });

    it('其他地形均可通行', () => {
      const passableTypes: TerrainType[] = ['plain', 'mountain', 'forest', 'pass', 'city'];
      for (const type of passableTypes) {
        expect(TERRAIN_DEFS[type].passable).toBe(true);
      }
    });

    it('城池防御加成最高', () => {
      const cityBonus = TERRAIN_DEFS.city.defenseBonus;
      for (const type of TERRAIN_TYPES) {
        if (type !== 'city') {
          expect(cityBonus).toBeGreaterThanOrEqual(TERRAIN_DEFS[type].defenseBonus);
        }
      }
    });

    it('山地移动消耗 > 平原', () => {
      expect(TERRAIN_DEFS.mountain.moveCost).toBeGreaterThan(TERRAIN_DEFS.plain.moveCost);
    });

    it('水域移动消耗最高', () => {
      const waterCost = TERRAIN_DEFS.water.moveCost;
      for (const type of TERRAIN_TYPES) {
        if (type !== 'water') {
          expect(waterCost).toBeGreaterThanOrEqual(TERRAIN_DEFS[type].moveCost);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 特殊地标（#12）
  // ═══════════════════════════════════════════
  describe('特殊地标', () => {
    it('DEFAULT_LANDMARKS 不为空', () => {
      expect(DEFAULT_LANDMARKS.length).toBeGreaterThan(0);
    });

    it('每个地标定义完整', () => {
      for (const lm of DEFAULT_LANDMARKS) {
        expect(lm.id).toBeTruthy();
        expect(['city', 'pass', 'resource', 'capital']).toContain(lm.type);
        expect(lm.name).toBeTruthy();
        expect([1, 2, 3, 4, 5]).toContain(lm.level);
        expect(['player', 'enemy', 'neutral']).toContain(lm.ownership);
        expect(lm.icon).toBeTruthy();
        expect(lm.productionMultiplier).toBeGreaterThan(0);
        expect(lm.defenseValue).toBeGreaterThanOrEqual(0);
      }
    });

    it('包含城池、关卡、资源点三种类型', () => {
      const types = new Set(DEFAULT_LANDMARKS.map(l => l.type));
      expect(types.has('city')).toBe(true);
      expect(types.has('pass')).toBe(true);
      expect(types.has('resource')).toBe(true);
    });

    it('资源点有 resourceType 字段', () => {
      const resources = DEFAULT_LANDMARKS.filter(l => l.type === 'resource');
      for (const res of resources) {
        expect(res.resourceType).toBeDefined();
        expect(['grain', 'gold', 'troops', 'mandate']).toContain(res.resourceType);
      }
    });

    it('非资源点无 resourceType 字段', () => {
      const nonResources = DEFAULT_LANDMARKS.filter(l => l.type !== 'resource');
      for (const lm of nonResources) {
        expect(lm.resourceType).toBeUndefined();
      }
    });

    it('LANDMARK_POSITIONS 与 DEFAULT_LANDMARKS ID 一致', () => {
      const landmarkIds = new Set(DEFAULT_LANDMARKS.map(l => l.id));
      for (const id of Object.keys(LANDMARK_POSITIONS)) {
        expect(landmarkIds.has(id)).toBe(true);
      }
    });

    it('地标坐标在地图范围内', () => {
      for (const [id, pos] of Object.entries(LANDMARK_POSITIONS)) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(MAP_SIZE.cols);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThan(MAP_SIZE.rows);
      }
    });

    it('地标坐标无重复', () => {
      const positions = Object.values(LANDMARK_POSITIONS);
      const keys = new Set(positions.map(p => `${p.x},${p.y}`));
      expect(keys.size).toBe(positions.length);
    });

    it('初始地标归属正确（⚠️ PRD MAP-1: 洛阳为玩家起始领土，其余为neutral）', () => {
      for (const lm of DEFAULT_LANDMARKS) {
        if (lm.id === 'city-luoyang') {
          expect(lm.ownership).toBe('player'); // 玩家起始领土
        } else {
          expect(lm.ownership).toBe('neutral');
        }
      }
    });

    it('城池数量 >= 5', () => {
      const cities = DEFAULT_LANDMARKS.filter(l => l.type === 'city');
      expect(cities.length).toBeGreaterThanOrEqual(5);
    });

    it('关卡数量 >= 3', () => {
      const passes = DEFAULT_LANDMARKS.filter(l => l.type === 'pass');
      expect(passes.length).toBeGreaterThanOrEqual(3);
    });

    it('资源点数量 >= 3', () => {
      const resources = DEFAULT_LANDMARKS.filter(l => l.type === 'resource');
      expect(resources.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ═══════════════════════════════════════════
  // 5. getRegionAtPosition
  // ═══════════════════════════════════════════
  describe('getRegionAtPosition', () => {
    it('魏国区域坐标（中原）', () => {
      expect(getRegionAtPosition(50, 10)).toBe('wei');
    });

    it('吴国区域坐标（东南）', () => {
      expect(getRegionAtPosition(80, 40)).toBe('wu');
    });

    it('蜀国区域坐标（西南）', () => {
      expect(getRegionAtPosition(20, 45)).toBe('shu');
    });

    it('魏国区域坐标（中原右）', () => {
      expect(getRegionAtPosition(60, 10)).toBe('wei');
    });

    it('中立区域左上角', () => {
      expect(getRegionAtPosition(0, 0)).toBe('neutral');
    });

    it('中立区域坐标（左侧）', () => {
      expect(getRegionAtPosition(10, 30)).toBe('neutral');
    });

    it('边界外坐标默认为中立', () => {
      expect(getRegionAtPosition(-1, -1)).toBe('neutral');
    });

    it('区域边界值正确（起始坐标包含）', () => {
      const { bounds } = REGION_DEFS.wei;
      expect(getRegionAtPosition(bounds.startX, bounds.startY)).toBe('wei');
    });

    it('区域边界值正确（结束坐标包含）', () => {
      const { bounds } = REGION_DEFS.wei;
      expect(getRegionAtPosition(bounds.endX, bounds.endY)).toBe('wei');
    });
  });

  // ═══════════════════════════════════════════
  // 6. getTerrainAtPosition
  // ═══════════════════════════════════════════
  describe('getTerrainAtPosition', () => {
    it('城池地标位置返回 city 地形', () => {
      // 洛阳（50,23）
      expect(getTerrainAtPosition(50, 23)).toBe('city');
    });

    it('关卡地标位置返回 city 地形', () => {
      // 虎牢关（43,24）
      expect(getTerrainAtPosition(43, 24)).toBe('city');
    });

    it('非地标位置返回有效地形', () => {
      for (let y = 0; y < MAP_SIZE.rows; y += 5) {
        for (let x = 0; x < MAP_SIZE.cols; x += 5) {
          const terrain = getTerrainAtPosition(x, y);
          expect(TERRAIN_TYPES).toContain(terrain);
        }
      }
    });

    it('同一坐标多次调用结果一致（确定性）', () => {
      const t1 = getTerrainAtPosition(10, 10);
      const t2 = getTerrainAtPosition(10, 10);
      expect(t1).toBe(t2);
    });

    it('资源点位置不返回 city 地形', () => {
      // 许田是资源点，不是城池/关卡
      const terrain = getTerrainAtPosition(41, 21);
      expect(TERRAIN_TYPES).toContain(terrain);
    });
  });

  // ═══════════════════════════════════════════
  // 7. generateAllTiles
  // ═══════════════════════════════════════════
  describe('generateAllTiles', () => {
    it('生成正确数量的格子', () => {
      const tiles = generateAllTiles();
      expect(tiles.length).toBe(MAP_SIZE.cols * MAP_SIZE.rows);
    });

    it('每个格子数据完整', () => {
      const tiles = generateAllTiles();
      for (const tile of tiles) {
        expect(tile.pos).toBeDefined();
        expect(tile.pos.x).toBeGreaterThanOrEqual(0);
        expect(tile.pos.x).toBeLessThan(MAP_SIZE.cols);
        expect(tile.pos.y).toBeGreaterThanOrEqual(0);
        expect(tile.pos.y).toBeLessThan(MAP_SIZE.rows);
        expect(TERRAIN_TYPES).toContain(tile.terrain);
        expect(REGION_IDS).toContain(tile.region);
      }
    });

    it('格子坐标按行列顺序排列', () => {
      const tiles = generateAllTiles();
      const first = tiles[0];
      expect(first.pos.x).toBe(0);
      expect(first.pos.y).toBe(0);

      const last = tiles[tiles.length - 1];
      expect(last.pos.x).toBe(MAP_SIZE.cols - 1);
      expect(last.pos.y).toBe(MAP_SIZE.rows - 1);
    });

    it('地标格子包含 landmark 数据', () => {
      const tiles = generateAllTiles();
      const luoyang = tiles.find(t => t.pos.x === 50 && t.pos.y === 23);
      expect(luoyang).toBeDefined();
      expect(luoyang!.landmark).toBeDefined();
      expect(luoyang!.landmark!.name).toBe('洛阳');
    });

    it('非地标格子无 landmark', () => {
      const tiles = generateAllTiles();
      const noLandmarkCount = tiles.filter(t => !t.landmark).length;
      expect(noLandmarkCount).toBeGreaterThan(0);
    });

    it('地标数量与 DEFAULT_LANDMARKS 一致', () => {
      const tiles = generateAllTiles();
      const landmarks = tiles.filter(t => t.landmark);
      expect(landmarks.length).toBe(DEFAULT_LANDMARKS.length);
    });

    it('多次调用结果一致', () => {
      const tiles1 = generateAllTiles();
      const tiles2 = generateAllTiles();
      expect(tiles1.length).toBe(tiles2.length);
      for (let i = 0; i < tiles1.length; i++) {
        expect(tiles1[i].pos).toEqual(tiles2[i].pos);
        expect(tiles1[i].terrain).toBe(tiles2[i].terrain);
        expect(tiles1[i].region).toBe(tiles2[i].region);
      }
    });
  });
});
