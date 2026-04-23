import { vi } from 'vitest';
/**
 * WorldMapSystem 单元测试 — Part 1: 基础参数 + 区域 + 地形
 */

import { WorldMapSystem } from '../WorldMapSystem';
import type { ISystemDeps } from '../../../core/types';
import type { RegionId, TerrainType } from '../../../core/map';
import {
  MAP_SIZE,
  VIEWPORT_CONFIG,
  DEFAULT_LANDMARKS,
} from '../../../core/map';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createMapSystem(): WorldMapSystem {
  const sys = new WorldMapSystem();
  sys.init(mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('WorldMapSystem 基础与区域地形', () => {
  let mapSys: WorldMapSystem;

  beforeEach(() => {
    mapSys = createMapSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 worldMap', () => {
      expect(mapSys.name).toBe('worldMap');
    });

    it('init 后可正常使用', () => {
      const state = mapSys.getState();
      expect(state.size.cols).toBe(MAP_SIZE.cols);
      expect(state.size.rows).toBe(MAP_SIZE.rows);
    });

    it('reset 恢复初始状态', () => {
      mapSys.setLandmarkOwnership('city-luoyang', 'player');
      mapSys.reset();
      const lm = mapSys.getLandmarkById('city-luoyang');
      expect(lm!.ownership).toBe('neutral');
    });

    it('getState 返回完整状态', () => {
      const state = mapSys.getState();
      expect(state.size).toBeDefined();
      expect(state.tiles.length).toBe(MAP_SIZE.cols * MAP_SIZE.rows);
      expect(state.landmarks.length).toBeGreaterThan(0);
      expect(state.viewport).toBeDefined();
      expect(state.filter).toBeDefined();
    });

    it('update 不抛异常', () => {
      expect(() => mapSys.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 地图基础参数（#9）
  // ═══════════════════════════════════════════
  describe('地图基础参数', () => {
    it('getSize 返回正确尺寸', () => {
      const size = mapSys.getSize();
      expect(size.cols).toBe(60);
      expect(size.rows).toBe(40);
    });

    it('getTotalTiles 返回 2400', () => {
      expect(mapSys.getTotalTiles()).toBe(2400);
    });

    it('isValidPosition 合法坐标', () => {
      expect(mapSys.isValidPosition({ x: 0, y: 0 })).toBe(true);
      expect(mapSys.isValidPosition({ x: 59, y: 39 })).toBe(true);
      expect(mapSys.isValidPosition({ x: 30, y: 20 })).toBe(true);
    });

    it('isValidPosition 非法坐标', () => {
      expect(mapSys.isValidPosition({ x: -1, y: 0 })).toBe(false);
      expect(mapSys.isValidPosition({ x: 0, y: -1 })).toBe(false);
      expect(mapSys.isValidPosition({ x: 60, y: 0 })).toBe(false);
      expect(mapSys.isValidPosition({ x: 0, y: 40 })).toBe(false);
      expect(mapSys.isValidPosition({ x: 100, y: 100 })).toBe(false);
    });

    it('getTileAt 返回正确格子', () => {
      const tile = mapSys.getTileAt({ x: 0, y: 0 });
      expect(tile).not.toBeNull();
      expect(tile!.pos.x).toBe(0);
      expect(tile!.pos.y).toBe(0);
    });

    it('getTileAt 非法坐标返回 null', () => {
      expect(mapSys.getTileAt({ x: -1, y: 0 })).toBeNull();
      expect(mapSys.getTileAt({ x: 60, y: 0 })).toBeNull();
    });

    it('getTileAt 洛阳坐标有城池地标', () => {
      const tile = mapSys.getTileAt({ x: 30, y: 8 });
      expect(tile).not.toBeNull();
      expect(tile!.terrain).toBe('city');
      expect(tile!.landmark).toBeDefined();
      expect(tile!.landmark!.name).toBe('洛阳');
    });

    it('getAllTiles 返回完整副本', () => {
      const tiles = mapSys.getAllTiles();
      expect(tiles.length).toBe(2400);
      tiles[0].terrain = 'water';
      const original = mapSys.getTileAt({ x: 0, y: 0 });
      expect(original!.terrain).not.toBe('water');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 三大区域划分（#10）
  // ═══════════════════════════════════════════
  describe('三大区域划分', () => {
    it('getRegions 返回三个区域', () => {
      const regions = mapSys.getRegions();
      expect(regions.length).toBe(4);
      const ids = regions.map(r => r.id);
      expect(ids).toContain('wei');
      expect(ids).toContain('wu');
      expect(ids).toContain('shu');
    });

    it('getRegionAt 中原坐标', () => {
      const region = mapSys.getRegionAt({ x: 30, y: 10 });
      expect(region).not.toBeNull();
      expect(region!.id).toBe('wei');
    });

    it('getRegionAt 江南坐标', () => {
      const region = mapSys.getRegionAt({ x: 45, y: 30 });
      expect(region).not.toBeNull();
      expect(region!.id).toBe('wu');
    });

    it('getRegionAt 西蜀坐标', () => {
      const region = mapSys.getRegionAt({ x: 10, y: 25 });
      expect(region).not.toBeNull();
      expect(region!.id).toBe('shu');
    });

    it('getRegionAt 非法坐标返回 null', () => {
      expect(mapSys.getRegionAt({ x: -1, y: 0 })).toBeNull();
    });

    it('getTilesByRegion 返回正确格子', () => {
      const centralTiles = mapSys.getTilesByRegion('wei');
      expect(centralTiles.length).toBeGreaterThan(0);
      for (const tile of centralTiles) {
        expect(tile.region).toBe('wei');
      }
    });

    it('getRegionTileCount 三个区域总和等于总格子数', () => {
      const total =
        mapSys.getRegionTileCount('wei') +
        mapSys.getRegionTileCount('wu') +
        mapSys.getRegionTileCount('shu');
      expect(total).toBe(mapSys.getTotalTiles());
    });
  });

  // ═══════════════════════════════════════════
  // 4. 地形类型（#11）
  // ═══════════════════════════════════════════
  describe('地形类型', () => {
    it('getTerrains 返回 6 种地形', () => {
      const terrains = mapSys.getTerrains();
      expect(terrains.length).toBe(6);
      const types = terrains.map(t => t.type);
      expect(types).toContain('plain');
      expect(types).toContain('mountain');
      expect(types).toContain('water');
      expect(types).toContain('forest');
      expect(types).toContain('desert');
      expect(types).toContain('city');
    });

    it('getTerrainAt 返回正确地形', () => {
      const terrain = mapSys.getTerrainAt({ x: 30, y: 8 });
      expect(terrain).not.toBeNull();
      expect(terrain!.type).toBe('city');
    });

    it('getTerrainAt 非法坐标返回 null', () => {
      expect(mapSys.getTerrainAt({ x: -1, y: 0 })).toBeNull();
    });

    it('getTilesByTerrain 返回正确地形格子', () => {
      const plainTiles = mapSys.getTilesByTerrain('plain');
      expect(plainTiles.length).toBeGreaterThan(0);
      for (const tile of plainTiles) {
        expect(tile.terrain).toBe('plain');
      }
    });

    it('所有地形格子总数等于总格子数', () => {
      const types: TerrainType[] = ['plain', 'mountain', 'water', 'forest', 'desert', 'city'];
      const total = types.reduce((sum, t) => sum + mapSys.getTerrainTileCount(t), 0);
      expect(total).toBe(mapSys.getTotalTiles());
    });
  });
});
