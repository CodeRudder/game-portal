/**
 * 世界地图配置 — 单元测试
 *
 * 覆盖：地图参数、区域划分、地形类型、地标配置、辅助函数
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
} from '../../../core/map';

// ═══════════════════════════════════════════════
// #9 地图基础参数
// ═══════════════════════════════════════════════
describe('地图基础参数 (#9)', () => {
  describe('MAP_SIZE', () => {
    it('尺寸为 60×40', () => {
      expect(MAP_SIZE.cols).toBe(60);
      expect(MAP_SIZE.rows).toBe(40);
    });
  });

  describe('GRID_CONFIG', () => {
    it('格子尺寸为 32×32', () => {
      expect(GRID_CONFIG.tileWidth).toBe(32);
      expect(GRID_CONFIG.tileHeight).toBe(32);
    });
  });

  describe('VIEWPORT_CONFIG', () => {
    it('PC端视口为 1280×696', () => {
      expect(VIEWPORT_CONFIG.width).toBe(1280);
      expect(VIEWPORT_CONFIG.height).toBe(696);
    });

    it('缩放范围合理', () => {
      expect(VIEWPORT_CONFIG.minZoom).toBeLessThan(VIEWPORT_CONFIG.defaultZoom);
      expect(VIEWPORT_CONFIG.maxZoom).toBeGreaterThan(VIEWPORT_CONFIG.defaultZoom);
      expect(VIEWPORT_CONFIG.defaultZoom).toBe(1.0);
    });
  });

  describe('MAP_PIXEL_SIZE', () => {
    it('总像素尺寸 = 格子数 × 格子尺寸', () => {
      expect(MAP_PIXEL_SIZE.width).toBe(60 * 32);
      expect(MAP_PIXEL_SIZE.height).toBe(40 * 32);
    });
  });

  describe('MAP_SAVE_VERSION', () => {
    it('版本号 > 0', () => {
      expect(MAP_SAVE_VERSION).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════
// #10 三大区域划分
// ═══════════════════════════════════════════════
describe('三大区域划分 (#10)', () => {
  describe('REGION_IDS', () => {
    it('包含3个区域', () => {
      expect(REGION_IDS).toHaveLength(3);
    });

    it('包含中原/江南/西蜀', () => {
      expect(REGION_IDS).toContain('central_plains');
      expect(REGION_IDS).toContain('jiangnan');
      expect(REGION_IDS).toContain('western_shu');
    });
  });

  describe('REGION_DEFS', () => {
    it('每个区域有完整定义', () => {
      for (const id of REGION_IDS) {
        const def = REGION_DEFS[id];
        expect(def.id).toBe(id);
        expect(def.label).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(def.bounds).toBeDefined();
        expect(def.bounds.startX).toBeLessThanOrEqual(def.bounds.endX);
        expect(def.bounds.startY).toBeLessThanOrEqual(def.bounds.endY);
      }
    });

    it('中原位于中央', () => {
      const cp = REGION_DEFS.central_plains.bounds;
      expect(cp.startX).toBeGreaterThanOrEqual(10);
      expect(cp.endX).toBeLessThanOrEqual(50);
    });

    it('江南位于东南', () => {
      const jn = REGION_DEFS.jiangnan.bounds;
      expect(jn.startY).toBeGreaterThan(15);
      expect(jn.startX).toBeGreaterThan(25);
    });

    it('西蜀位于西部', () => {
      const ws = REGION_DEFS.western_shu.bounds;
      expect(ws.startX).toBeLessThanOrEqual(5);
      expect(ws.startY).toBeGreaterThan(15);
    });
  });

  describe('REGION_LABELS', () => {
    it('区域名称映射正确', () => {
      expect(REGION_LABELS.central_plains).toBe('中原');
      expect(REGION_LABELS.jiangnan).toBe('江南');
      expect(REGION_LABELS.western_shu).toBe('西蜀');
    });
  });

  describe('REGION_COLORS', () => {
    it('每个区域有颜色', () => {
      for (const id of REGION_IDS) {
        expect(REGION_COLORS[id]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('getRegionAtPosition', () => {
    it('中原区域的坐标返回 central_plains', () => {
      expect(getRegionAtPosition(30, 10)).toBe('central_plains');
    });

    it('江南区域的坐标返回 jiangnan', () => {
      expect(getRegionAtPosition(45, 30)).toBe('jiangnan');
    });

    it('西蜀区域的坐标返回 western_shu', () => {
      expect(getRegionAtPosition(10, 25)).toBe('western_shu');
    });

    it('边界坐标也能正确识别', () => {
      // 中原左上角
      const cp = REGION_DEFS.central_plains.bounds;
      expect(getRegionAtPosition(cp.startX, cp.startY)).toBe('central_plains');
    });
  });
});

// ═══════════════════════════════════════════════
// #11 地形类型
// ═══════════════════════════════════════════════
describe('地形类型 (#11)', () => {
  describe('TERRAIN_TYPES', () => {
    it('包含6种地形', () => {
      expect(TERRAIN_TYPES).toHaveLength(6);
    });

    it('包含平原/山地/水域/森林/沙漠/城池', () => {
      expect(TERRAIN_TYPES).toContain('plain');
      expect(TERRAIN_TYPES).toContain('mountain');
      expect(TERRAIN_TYPES).toContain('water');
      expect(TERRAIN_TYPES).toContain('forest');
      expect(TERRAIN_TYPES).toContain('desert');
      expect(TERRAIN_TYPES).toContain('city');
    });
  });

  describe('TERRAIN_DEFS', () => {
    it('每种地形有完整定义', () => {
      for (const type of TERRAIN_TYPES) {
        const def = TERRAIN_DEFS[type];
        expect(def.type).toBe(type);
        expect(def.label).toBeTruthy();
        expect(def.baseColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(def.icon).toBeTruthy();
        expect(typeof def.moveCost).toBe('number');
        expect(typeof def.defenseBonus).toBe('number');
        expect(typeof def.passable).toBe('boolean');
      }
    });

    it('平原移动消耗最低', () => {
      expect(TERRAIN_DEFS.plain.moveCost).toBe(1.0);
    });

    it('水域不可通行', () => {
      expect(TERRAIN_DEFS.water.passable).toBe(false);
    });

    it('城池防御加成最高', () => {
      const cityDefense = TERRAIN_DEFS.city.defenseBonus;
      for (const type of TERRAIN_TYPES) {
        if (type !== 'city') {
          expect(cityDefense).toBeGreaterThanOrEqual(TERRAIN_DEFS[type].defenseBonus);
        }
      }
    });
  });

  describe('TERRAIN_LABELS', () => {
    it('地形名称映射正确', () => {
      expect(TERRAIN_LABELS.plain).toBe('平原');
      expect(TERRAIN_LABELS.mountain).toBe('山地');
      expect(TERRAIN_LABELS.water).toBe('水域');
      expect(TERRAIN_LABELS.forest).toBe('森林');
      expect(TERRAIN_LABELS.desert).toBe('沙漠');
      expect(TERRAIN_LABELS.city).toBe('城池');
    });
  });

  describe('TERRAIN_COLORS', () => {
    it('每种地形有颜色', () => {
      for (const type of TERRAIN_TYPES) {
        expect(TERRAIN_COLORS[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('getTerrainAtPosition', () => {
    it('返回有效地形类型', () => {
      const terrain = getTerrainAtPosition(30, 10);
      expect(TERRAIN_TYPES).toContain(terrain);
    });

    it('城池位置返回 city', () => {
      // 洛阳位于 (30, 8)
      expect(getTerrainAtPosition(30, 8)).toBe('city');
    });

    it('不同区域地形分布不同', () => {
      // 统计各区域地形分布
      const centralTerrains = new Set<string>();
      const jiangnanTerrains = new Set<string>();
      const westernShuTerrains = new Set<string>();

      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 60; x++) {
          const region = getRegionAtPosition(x, y);
          const terrain = getTerrainAtPosition(x, y);
          if (region === 'central_plains') centralTerrains.add(terrain);
          else if (region === 'jiangnan') jiangnanTerrains.add(terrain);
          else if (region === 'western_shu') westernShuTerrains.add(terrain);
        }
      }

      // 每个区域至少有2种不同地形
      expect(centralTerrains.size).toBeGreaterThanOrEqual(2);
      expect(jiangnanTerrains.size).toBeGreaterThanOrEqual(2);
      expect(westernShuTerrains.size).toBeGreaterThanOrEqual(2);
    });
  });
});

// ═══════════════════════════════════════════════
// #12 特殊地标
// ═══════════════════════════════════════════════
describe('特殊地标 (#12)', () => {
  describe('DEFAULT_LANDMARKS', () => {
    it('包含城池地标', () => {
      const cities = DEFAULT_LANDMARKS.filter(l => l.type === 'city');
      expect(cities.length).toBeGreaterThanOrEqual(4);
    });

    it('包含关卡地标', () => {
      const passes = DEFAULT_LANDMARKS.filter(l => l.type === 'pass');
      expect(passes.length).toBeGreaterThanOrEqual(2);
    });

    it('包含资源点地标', () => {
      const resources = DEFAULT_LANDMARKS.filter(l => l.type === 'resource');
      expect(resources.length).toBeGreaterThanOrEqual(2);
    });

    it('每个地标有完整数据', () => {
      for (const lm of DEFAULT_LANDMARKS) {
        expect(lm.id).toBeTruthy();
        expect(lm.name).toBeTruthy();
        expect(lm.level).toBeGreaterThanOrEqual(1);
        expect(lm.level).toBeLessThanOrEqual(5);
        expect(lm.ownership).toBeTruthy();
        expect(lm.icon).toBeTruthy();
        expect(lm.productionMultiplier).toBeGreaterThan(0);
        expect(lm.defenseValue).toBeGreaterThanOrEqual(0);
      }
    });

    it('资源点有资源类型', () => {
      const resources = DEFAULT_LANDMARKS.filter(l => l.type === 'resource');
      for (const res of resources) {
        expect(res.resourceType).toBeDefined();
        expect(['grain', 'gold', 'troops', 'mandate']).toContain(res.resourceType);
      }
    });

    it('初始所有地标为中立', () => {
      for (const lm of DEFAULT_LANDMARKS) {
        expect(lm.ownership).toBe('neutral');
      }
    });
  });

  describe('LANDMARK_POSITIONS', () => {
    it('每个地标有坐标', () => {
      for (const lm of DEFAULT_LANDMARKS) {
        const pos = LANDMARK_POSITIONS[lm.id];
        expect(pos).toBeDefined();
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(MAP_SIZE.cols);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThan(MAP_SIZE.rows);
      }
    });

    it('地标坐标不重复', () => {
      const positions = Object.values(LANDMARK_POSITIONS);
      const keys = positions.map(p => `${p.x},${p.y}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('generateAllTiles', () => {
    it('生成正确数量的格子', () => {
      const tiles = generateAllTiles();
      expect(tiles.length).toBe(60 * 40);
    });

    it('每个格子有完整数据', () => {
      const tiles = generateAllTiles();
      for (const tile of tiles) {
        expect(tile.pos).toBeDefined();
        expect(tile.pos.x).toBeGreaterThanOrEqual(0);
        expect(tile.pos.y).toBeGreaterThanOrEqual(0);
        expect(TERRAIN_TYPES).toContain(tile.terrain);
        expect(REGION_IDS).toContain(tile.region);
      }
    });

    it('地标位置的格子包含地标数据', () => {
      const tiles = generateAllTiles();
      const tilesWithLandmarks = tiles.filter(t => t.landmark);
      expect(tilesWithLandmarks.length).toBe(DEFAULT_LANDMARKS.length);
    });

    it('非地标位置格子无地标数据', () => {
      const tiles = generateAllTiles();
      const totalTiles = tiles.length;
      const tilesWithLandmarks = tiles.filter(t => t.landmark).length;
      expect(totalTiles - tilesWithLandmarks).toBe(totalTiles - DEFAULT_LANDMARKS.length);
    });
  });
});
