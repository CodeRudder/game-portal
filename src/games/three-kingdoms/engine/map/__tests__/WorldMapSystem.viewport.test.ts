/**
 * WorldMapSystem 单元测试 — Part 2: 地标管理 + 视口控制 + 序列化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldMapSystem } from '../WorldMapSystem';
import type { ISystemDeps } from '../../../core/types';
import {
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

describe('WorldMapSystem 地标与视口', () => {
  let mapSys: WorldMapSystem;

  beforeEach(() => {
    mapSys = createMapSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 特殊地标（#12）
  // ═══════════════════════════════════════════
  describe('特殊地标', () => {
    it('getLandmarks 返回所有地标', () => {
      const landmarks = mapSys.getLandmarks();
      expect(landmarks.length).toBe(DEFAULT_LANDMARKS.length);
    });

    it('getLandmarksByType 城池', () => {
      const cities = mapSys.getLandmarksByType('city');
      expect(cities.length).toBeGreaterThan(0);
      for (const c of cities) {
        expect(c.type).toBe('city');
      }
    });

    it('getLandmarksByType 关卡', () => {
      const passes = mapSys.getLandmarksByType('pass');
      expect(passes.length).toBeGreaterThan(0);
      for (const p of passes) {
        expect(p.type).toBe('pass');
      }
    });

    it('getLandmarksByType 资源点', () => {
      const resources = mapSys.getLandmarksByType('resource');
      expect(resources.length).toBeGreaterThan(0);
      for (const r of resources) {
        expect(r.type).toBe('resource');
      }
    });

    it('getLandmarksByOwnership neutral', () => {
      const neutrals = mapSys.getLandmarksByOwnership('neutral');
      expect(neutrals.length).toBe(DEFAULT_LANDMARKS.length);
    });

    it('getLandmarkById 返回正确地标', () => {
      const luoyang = mapSys.getLandmarkById('city-luoyang');
      expect(luoyang).not.toBeNull();
      expect(luoyang!.name).toBe('洛阳');
      expect(luoyang!.type).toBe('city');
    });

    it('getLandmarkById 不存在的 ID 返回 null', () => {
      expect(mapSys.getLandmarkById('non-existent')).toBeNull();
    });

    it('getLandmarkAt 返回坐标处的地标', () => {
      const lm = mapSys.getLandmarkAt({ x: 30, y: 8 });
      expect(lm).not.toBeNull();
      expect(lm!.name).toBe('洛阳');
    });

    it('getLandmarkAt 无地标坐标返回 null', () => {
      const lm = mapSys.getLandmarkAt({ x: 0, y: 0 });
      expect(lm).toBeNull();
    });

    it('setLandmarkOwnership 更新归属', () => {
      expect(mapSys.setLandmarkOwnership('city-luoyang', 'player')).toBe(true);
      const lm = mapSys.getLandmarkById('city-luoyang');
      expect(lm!.ownership).toBe('player');
    });

    it('setLandmarkOwnership 不存在的 ID 返回 false', () => {
      expect(mapSys.setLandmarkOwnership('non-existent', 'player')).toBe(false);
    });

    it('setLandmarkOwnership 同步到 tiles', () => {
      mapSys.setLandmarkOwnership('city-luoyang', 'player');
      const tile = mapSys.getTileAt({ x: 30, y: 8 });
      expect(tile!.landmark!.ownership).toBe('player');
    });

    it('upgradeLandmark 升级地标', () => {
      // 使用初始等级 < 5 的地标（许昌 level=4）
      const before = mapSys.getLandmarkById('city-xuchang');
      const beforeLevel = before!.level;
      const beforeMultiplier = before!.productionMultiplier;

      expect(mapSys.upgradeLandmark('city-xuchang')).toBe(true);

      const after = mapSys.getLandmarkById('city-xuchang');
      expect(after!.level).toBe(beforeLevel + 1);
      expect(after!.productionMultiplier).toBeCloseTo(beforeMultiplier + 0.2, 5);
    });

    it('upgradeLandmark 最高等级不能再升级', () => {
      // 洛阳初始等级为 5（最高等级）
      const lm = mapSys.getLandmarkById('city-luoyang');
      expect(lm!.level).toBe(5);
      expect(mapSys.upgradeLandmark('city-luoyang')).toBe(false);
    });

    it('upgradeLandmark 不存在的 ID 返回 false', () => {
      expect(mapSys.upgradeLandmark('non-existent')).toBe(false);
    });

    it('getPlayerLandmarkCount 初始为 0', () => {
      expect(mapSys.getPlayerLandmarkCount()).toBe(0);
    });

    it('getPlayerLandmarkCount 占领后增加', () => {
      mapSys.setLandmarkOwnership('city-luoyang', 'player');
      expect(mapSys.getPlayerLandmarkCount()).toBe(1);
    });

    it('getTotalLandmarkCount 等于 DEFAULT_LANDMARKS 长度', () => {
      expect(mapSys.getTotalLandmarkCount()).toBe(DEFAULT_LANDMARKS.length);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 视口控制（#13）
  // ═══════════════════════════════════════════
  describe('视口控制', () => {
    it('初始视口状态', () => {
      const vp = mapSys.getViewport();
      expect(vp.offsetX).toBe(0);
      expect(vp.offsetY).toBe(0);
      expect(vp.zoom).toBe(VIEWPORT_CONFIG.defaultZoom);
    });

    it('setViewportOffset 设置偏移', () => {
      mapSys.setViewportOffset(100, 200);
      const vp = mapSys.getViewport();
      expect(vp.offsetX).toBe(100);
      expect(vp.offsetY).toBe(200);
    });

    it('panViewport 平移视口', () => {
      mapSys.panViewport(50, -30);
      const vp = mapSys.getViewport();
      expect(vp.offsetX).toBe(50);
      expect(vp.offsetY).toBe(-30);
    });

    it('panViewport 累加偏移', () => {
      mapSys.panViewport(10, 20);
      mapSys.panViewport(30, 40);
      const vp = mapSys.getViewport();
      expect(vp.offsetX).toBe(40);
      expect(vp.offsetY).toBe(60);
    });

    it('setZoom 设置缩放', () => {
      mapSys.setZoom(1.5);
      expect(mapSys.getViewport().zoom).toBe(1.5);
    });

    it('setZoom 缩放限制在 min~max 范围', () => {
      mapSys.setZoom(0.1);
      expect(mapSys.getViewport().zoom).toBe(VIEWPORT_CONFIG.minZoom);

      mapSys.setZoom(5.0);
      expect(mapSys.getViewport().zoom).toBe(VIEWPORT_CONFIG.maxZoom);
    });

    it('zoomViewport 增量缩放', () => {
      mapSys.zoomViewport(0.3);
      expect(mapSys.getViewport().zoom).toBeCloseTo(1.3, 5);
    });

    it('resetViewport 重置视口', () => {
      mapSys.panViewport(100, 200);
      mapSys.setZoom(1.5);
      mapSys.resetViewport();
      const vp = mapSys.getViewport();
      expect(vp.offsetX).toBe(0);
      expect(vp.offsetY).toBe(0);
      expect(vp.zoom).toBe(VIEWPORT_CONFIG.defaultZoom);
    });

    it('getViewport 返回副本', () => {
      const vp = mapSys.getViewport();
      vp.offsetX = 999;
      expect(mapSys.getViewport().offsetX).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('serialize 初始状态所有地标为 neutral', () => {
      const data = mapSys.serialize();
      for (const ownership of Object.values(data.landmarkOwnerships)) {
        expect(ownership).toBe('neutral');
      }
    });

    it('serialize 包含视口状态', () => {
      mapSys.setViewportOffset(100, 200);
      const data = mapSys.serialize();
      expect(data.viewport.offsetX).toBe(100);
      expect(data.viewport.offsetY).toBe(200);
    });

    it('serialize 包含版本号', () => {
      const data = mapSys.serialize();
      expect(data.version).toBeGreaterThan(0);
    });

    it('deserialize 恢复地标归属', () => {
      mapSys.setLandmarkOwnership('city-luoyang', 'player');
      mapSys.setLandmarkOwnership('city-jianye', 'enemy');
      const data = mapSys.serialize();

      const newSys = createMapSystem();
      newSys.deserialize(data);
      expect(newSys.getLandmarkById('city-luoyang')!.ownership).toBe('player');
      expect(newSys.getLandmarkById('city-jianye')!.ownership).toBe('enemy');
    });

    it('deserialize 恢复地标等级', () => {
      mapSys.upgradeLandmark('city-xuchang');
      const data = mapSys.serialize();

      const newSys = createMapSystem();
      newSys.deserialize(data);
      const lm = newSys.getLandmarkById('city-xuchang');
      expect(lm!.level).toBeGreaterThan(1);
    });

    it('deserialize 恢复视口状态', () => {
      mapSys.setViewportOffset(100, 200);
      mapSys.setZoom(1.5);
      const data = mapSys.serialize();

      const newSys = createMapSystem();
      newSys.deserialize(data);
      const vp = newSys.getViewport();
      expect(vp.offsetX).toBe(100);
      expect(vp.offsetY).toBe(200);
      expect(vp.zoom).toBe(1.5);
    });

    it('deserialize 后 tiles 同步地标数据', () => {
      mapSys.setLandmarkOwnership('city-luoyang', 'player');
      const data = mapSys.serialize();

      const newSys = createMapSystem();
      newSys.deserialize(data);
      const tile = newSys.getTileAt({ x: 30, y: 8 });
      expect(tile!.landmark!.ownership).toBe('player');
    });

    it('序列化-反序列化往返一致', () => {
      mapSys.setLandmarkOwnership('city-luoyang', 'player');
      mapSys.upgradeLandmark('city-xuchang');
      mapSys.setViewportOffset(50, 100);
      mapSys.setZoom(1.3);

      const data1 = mapSys.serialize();

      const newSys = createMapSystem();
      newSys.deserialize(data1);
      const data2 = newSys.serialize();

      expect(data2.landmarkOwnerships).toEqual(data1.landmarkOwnerships);
      expect(data2.landmarkLevels).toEqual(data1.landmarkLevels);
      expect(data2.viewport).toEqual(data1.viewport);
      expect(data2.version).toBe(data1.version);
    });
  });
});
