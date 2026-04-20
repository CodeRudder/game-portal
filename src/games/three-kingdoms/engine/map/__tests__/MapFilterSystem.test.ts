/**
 * MapFilterSystem — 单元测试
 *
 * 覆盖：区域筛选、地形筛选、占领状态筛选、地标类型筛选、组合筛选、统计
 */

import { MapFilterSystem } from '../MapFilterSystem';
import { generateAllTiles, DEFAULT_LANDMARKS } from '../../../core/map';
import type { TileData, LandmarkData } from '../../../core/map';

describe('MapFilterSystem', () => {
  const allTiles = generateAllTiles();
  const allLandmarks: LandmarkData[] = DEFAULT_LANDMARKS.map(l => ({ ...l }));

  // ═══════════════════════════════════════════
  // #14 按区域筛选
  // ═══════════════════════════════════════════
  describe('按区域筛选 (#14)', () => {
    it('筛选中原区域', () => {
      const result = MapFilterSystem.filterByRegion(allTiles, ['central_plains']);
      expect(result.length).toBeGreaterThan(0);
      for (const tile of result) {
        expect(tile.region).toBe('central_plains');
      }
    });

    it('筛选江南区域', () => {
      const result = MapFilterSystem.filterByRegion(allTiles, ['jiangnan']);
      expect(result.length).toBeGreaterThan(0);
      for (const tile of result) {
        expect(tile.region).toBe('jiangnan');
      }
    });

    it('筛选西蜀区域', () => {
      const result = MapFilterSystem.filterByRegion(allTiles, ['western_shu']);
      expect(result.length).toBeGreaterThan(0);
      for (const tile of result) {
        expect(tile.region).toBe('western_shu');
      }
    });

    it('筛选多个区域', () => {
      const result = MapFilterSystem.filterByRegion(allTiles, ['central_plains', 'jiangnan']);
      for (const tile of result) {
        expect(['central_plains', 'jiangnan']).toContain(tile.region);
      }
    });

    it('空数组返回全部', () => {
      const result = MapFilterSystem.filterByRegion(allTiles, []);
      expect(result.length).toBe(allTiles.length);
    });

    it('三区域之和 = 总数', () => {
      const cp = MapFilterSystem.filterByRegion(allTiles, ['central_plains']);
      const jn = MapFilterSystem.filterByRegion(allTiles, ['jiangnan']);
      const ws = MapFilterSystem.filterByRegion(allTiles, ['western_shu']);
      expect(cp.length + jn.length + ws.length).toBe(allTiles.length);
    });
  });

  // ═══════════════════════════════════════════
  // 按地形筛选
  // ═══════════════════════════════════════════
  describe('按地形筛选', () => {
    it('筛选平原', () => {
      const result = MapFilterSystem.filterByTerrain(allTiles, ['plain']);
      expect(result.length).toBeGreaterThan(0);
      for (const tile of result) {
        expect(tile.terrain).toBe('plain');
      }
    });

    it('筛选山地', () => {
      const result = MapFilterSystem.filterByTerrain(allTiles, ['mountain']);
      expect(result.length).toBeGreaterThan(0);
      for (const tile of result) {
        expect(tile.terrain).toBe('mountain');
      }
    });

    it('筛选水域', () => {
      const result = MapFilterSystem.filterByTerrain(allTiles, ['water']);
      for (const tile of result) {
        expect(tile.terrain).toBe('water');
      }
    });

    it('筛选多种地形', () => {
      const result = MapFilterSystem.filterByTerrain(allTiles, ['plain', 'mountain']);
      for (const tile of result) {
        expect(['plain', 'mountain']).toContain(tile.terrain);
      }
    });

    it('空数组返回全部', () => {
      const result = MapFilterSystem.filterByTerrain(allTiles, []);
      expect(result.length).toBe(allTiles.length);
    });
  });

  // ═══════════════════════════════════════════
  // 按占领状态筛选
  // ═══════════════════════════════════════════
  describe('按占领状态筛选', () => {
    it('筛选中立地标', () => {
      const result = MapFilterSystem.filterByOwnership(allLandmarks, ['neutral']);
      expect(result.length).toBe(allLandmarks.length);
    });

    it('筛选玩家地标（初始为空）', () => {
      const result = MapFilterSystem.filterByOwnership(allLandmarks, ['player']);
      expect(result.length).toBe(0);
    });

    it('筛选多种状态', () => {
      const modifiedLandmarks = allLandmarks.map(l => ({ ...l }));
      modifiedLandmarks[0].ownership = 'player';
      modifiedLandmarks[1].ownership = 'enemy';

      const result = MapFilterSystem.filterByOwnership(modifiedLandmarks, ['player', 'enemy']);
      expect(result.length).toBe(2);
    });

    it('空数组返回全部', () => {
      const result = MapFilterSystem.filterByOwnership(allLandmarks, []);
      expect(result.length).toBe(allLandmarks.length);
    });
  });

  // ═══════════════════════════════════════════
  // 按地标类型筛选
  // ═══════════════════════════════════════════
  describe('按地标类型筛选', () => {
    it('筛选城池', () => {
      const result = MapFilterSystem.filterByLandmarkType(allLandmarks, ['city']);
      expect(result.length).toBeGreaterThan(0);
      for (const lm of result) {
        expect(lm.type).toBe('city');
      }
    });

    it('筛选关卡', () => {
      const result = MapFilterSystem.filterByLandmarkType(allLandmarks, ['pass']);
      expect(result.length).toBeGreaterThan(0);
      for (const lm of result) {
        expect(lm.type).toBe('pass');
      }
    });

    it('筛选资源点', () => {
      const result = MapFilterSystem.filterByLandmarkType(allLandmarks, ['resource']);
      expect(result.length).toBeGreaterThan(0);
      for (const lm of result) {
        expect(lm.type).toBe('resource');
      }
    });

    it('筛选多种类型', () => {
      const result = MapFilterSystem.filterByLandmarkType(allLandmarks, ['city', 'pass']);
      for (const lm of result) {
        expect(['city', 'pass']).toContain(lm.type);
      }
    });

    it('空数组返回全部', () => {
      const result = MapFilterSystem.filterByLandmarkType(allLandmarks, []);
      expect(result.length).toBe(allLandmarks.length);
    });
  });

  // ═══════════════════════════════════════════
  // 组合筛选
  // ═══════════════════════════════════════════
  describe('组合筛选', () => {
    it('无筛选条件返回全部', () => {
      const result = MapFilterSystem.filter(allTiles, allLandmarks, {});
      expect(result.totalTiles).toBe(allTiles.length);
      expect(result.totalLandmarks).toBe(allLandmarks.length);
    });

    it('单条件筛选', () => {
      const result = MapFilterSystem.filter(allTiles, allLandmarks, {
        regions: ['central_plains'],
      });
      expect(result.totalTiles).toBeLessThan(allTiles.length);
      for (const tile of result.tiles) {
        expect(tile.region).toBe('central_plains');
      }
    });

    it('多条件叠加', () => {
      const result = MapFilterSystem.filter(allTiles, allLandmarks, {
        regions: ['central_plains'],
        terrains: ['plain'],
        ownerships: ['neutral'],
      });
      expect(result.totalTiles).toBeGreaterThan(0);
      for (const tile of result.tiles) {
        expect(tile.region).toBe('central_plains');
        expect(tile.terrain).toBe('plain');
      }
      for (const lm of result.landmarks) {
        expect(lm.ownership).toBe('neutral');
      }
    });

    it('空数组条件不筛选', () => {
      const result = MapFilterSystem.filter(allTiles, allLandmarks, {
        regions: [],
        terrains: [],
      });
      expect(result.totalTiles).toBe(allTiles.length);
    });
  });

  // ═══════════════════════════════════════════
  // 地标格子筛选
  // ═══════════════════════════════════════════
  describe('地标格子筛选', () => {
    it('getTilesWithLandmarks 返回含地标的格子', () => {
      const result = MapFilterSystem.getTilesWithLandmarks(allTiles);
      expect(result.length).toBe(DEFAULT_LANDMARKS.length);
      for (const tile of result) {
        expect(tile.landmark).toBeDefined();
      }
    });

    it('getTilesWithoutLandmarks 返回不含地标的格子', () => {
      const result = MapFilterSystem.getTilesWithoutLandmarks(allTiles);
      expect(result.length).toBe(allTiles.length - DEFAULT_LANDMARKS.length);
      for (const tile of result) {
        expect(tile.landmark).toBeUndefined();
      }
    });

    it('有地标 + 无地标 = 全部', () => {
      const withLm = MapFilterSystem.getTilesWithLandmarks(allTiles);
      const withoutLm = MapFilterSystem.getTilesWithoutLandmarks(allTiles);
      expect(withLm.length + withoutLm.length).toBe(allTiles.length);
    });
  });

  // ═══════════════════════════════════════════
  // 统计
  // ═══════════════════════════════════════════
  describe('统计', () => {
    it('countByRegion 统计正确', () => {
      const counts = MapFilterSystem.countByRegion(allTiles);
      const total = counts.central_plains + counts.jiangnan + counts.western_shu;
      expect(total).toBe(allTiles.length);
      expect(counts.central_plains).toBeGreaterThan(0);
      expect(counts.jiangnan).toBeGreaterThan(0);
      expect(counts.western_shu).toBeGreaterThan(0);
    });

    it('countByTerrain 统计正确', () => {
      const counts = MapFilterSystem.countByTerrain(allTiles);
      const total = counts.plain + counts.mountain + counts.water + counts.forest + counts.desert + counts.city;
      expect(total).toBe(allTiles.length);
    });

    it('countByOwnership 统计正确', () => {
      const counts = MapFilterSystem.countByOwnership(allLandmarks);
      const total = counts.player + counts.enemy + counts.neutral;
      expect(total).toBe(allLandmarks.length);
      expect(counts.neutral).toBe(allLandmarks.length);
    });

    it('countByRegion 与 filterByRegion 一致', () => {
      const counts = MapFilterSystem.countByRegion(allTiles);
      for (const region of ['central_plains', 'jiangnan', 'western_shu'] as const) {
        const filtered = MapFilterSystem.filterByRegion(allTiles, [region]);
        expect(counts[region]).toBe(filtered.length);
      }
    });

    it('countByTerrain 与 filterByTerrain 一致', () => {
      const counts = MapFilterSystem.countByTerrain(allTiles);
      const terrains = ['plain', 'mountain', 'water', 'forest', 'desert', 'city'] as const;
      for (const terrain of terrains) {
        const filtered = MapFilterSystem.filterByTerrain(allTiles, [terrain]);
        expect(counts[terrain]).toBe(filtered.length);
      }
    });
  });
});
