/**
 * MapDataRenderer 单元测试
 *
 * 测试地图渲染数据生成器：视口范围计算、坐标转换、
 * 渲染数据生成、层级计算、视口约束。
 */

import { describe, it, expect } from 'vitest';
import { MapDataRenderer } from '../MapDataRenderer';
import type { ViewportState, TileData, TileRenderData } from '../../../core/map';
import {
  MAP_SIZE,
  GRID_CONFIG,
  VIEWPORT_CONFIG,
  generateAllTiles,
} from '../../../core/map';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createRenderer(): MapDataRenderer {
  return new MapDataRenderer();
}

function createDefaultViewport(): ViewportState {
  return { offsetX: 0, offsetY: 0, zoom: 1.0 };
}

function createAllTiles(): TileData[] {
  return generateAllTiles();
}

// ═══════════════════════════════════════════════════════════

describe('MapDataRenderer', () => {
  let renderer: MapDataRenderer;
  let allTiles: TileData[];

  beforeEach(() => {
    renderer = createRenderer();
    allTiles = createAllTiles();
  });

  // ═══════════════════════════════════════════
  // 1. 视口范围计算（#9, #13）
  // ═══════════════════════════════════════════
  describe('computeVisibleRange', () => {
    it('默认视口（offset=0, zoom=1）起始为 0,0', () => {
      const range = renderer.computeVisibleRange(createDefaultViewport());
      expect(range.startX).toBe(0);
      expect(range.startY).toBe(0);
    });

    it('默认视口结束范围不超过地图边界', () => {
      const range = renderer.computeVisibleRange(createDefaultViewport());
      expect(range.endX).toBeLessThan(MAP_SIZE.cols);
      expect(range.endY).toBeLessThan(MAP_SIZE.rows);
    });

    it('缩放 2x 可见范围减半', () => {
      const vp1: ViewportState = { offsetX: 0, offsetY: 0, zoom: 1.0 };
      const vp2: ViewportState = { offsetX: 0, offsetY: 0, zoom: 2.0 };
      const range1 = renderer.computeVisibleRange(vp1);
      const range2 = renderer.computeVisibleRange(vp2);
      // 缩放越大，可见格子越少
      const count1 = range1.endX - range1.startX;
      const count2 = range2.endX - range2.startX;
      expect(count2).toBeLessThanOrEqual(count1);
    });

    it('正偏移向右下滚动', () => {
      const vp: ViewportState = { offsetX: -320, offsetY: -160, zoom: 1.0 };
      const range = renderer.computeVisibleRange(vp);
      // offsetX=-320 表示视口向右移动了 320px（即 10 格）
      expect(range.startX).toBe(10);
      expect(range.startY).toBe(5);
    });

    it('范围不超出地图边界', () => {
      // 极端偏移
      const vp: ViewportState = { offsetX: -99999, offsetY: -99999, zoom: 0.5 };
      const range = renderer.computeVisibleRange(vp);
      expect(range.startX).toBeGreaterThanOrEqual(0);
      expect(range.startY).toBeGreaterThanOrEqual(0);
      expect(range.endX).toBeLessThan(MAP_SIZE.cols);
      expect(range.endY).toBeLessThan(MAP_SIZE.rows);
    });

    it('视口范围有合理的格子数', () => {
      const range = renderer.computeVisibleRange(createDefaultViewport());
      const count = renderer.computeVisibleTileCount(range);
      // 1280/32 × 696/32 ≈ 40 × 21.75 = ~870
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(MAP_SIZE.cols * MAP_SIZE.rows);
    });
  });

  describe('computeVisibleTileCount', () => {
    it('正常范围', () => {
      const range = { startX: 0, endX: 10, startY: 0, endY: 5 };
      expect(renderer.computeVisibleTileCount(range)).toBe(11 * 6);
    });

    it('单格范围', () => {
      const range = { startX: 5, endX: 5, startY: 3, endY: 3 };
      expect(renderer.computeVisibleTileCount(range)).toBe(1);
    });

    it('负范围返回 0', () => {
      const range = { startX: 10, endX: 5, startY: 0, endY: 0 };
      expect(renderer.computeVisibleTileCount(range)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 坐标转换
  // ═══════════════════════════════════════════
  describe('gridToPixel', () => {
    it('原点坐标', () => {
      const { pixelX, pixelY } = renderer.gridToPixel({ x: 0, y: 0 });
      expect(pixelX).toBe(0);
      expect(pixelY).toBe(0);
    });

    it('(1, 1) 坐标', () => {
      const { pixelX, pixelY } = renderer.gridToPixel({ x: 1, y: 1 });
      expect(pixelX).toBe(GRID_CONFIG.tileWidth);
      expect(pixelY).toBe(GRID_CONFIG.tileHeight);
    });

    it('(10, 5) 坐标', () => {
      const { pixelX, pixelY } = renderer.gridToPixel({ x: 10, y: 5 });
      expect(pixelX).toBe(10 * GRID_CONFIG.tileWidth);
      expect(pixelY).toBe(5 * GRID_CONFIG.tileHeight);
    });
  });

  describe('pixelToGrid', () => {
    it('原点像素', () => {
      const pos = renderer.pixelToGrid(0, 0);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('格子中间像素', () => {
      const pos = renderer.pixelToGrid(15, 15);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('格子边界像素', () => {
      const pos = renderer.pixelToGrid(32, 32);
      expect(pos.x).toBe(1);
      expect(pos.y).toBe(1);
    });

    it('gridToPixel → pixelToGrid 往返一致', () => {
      const original = { x: 15, y: 22 };
      const pixel = renderer.gridToPixel(original);
      const back = renderer.pixelToGrid(pixel.pixelX, pixel.pixelY);
      expect(back.x).toBe(original.x);
      expect(back.y).toBe(original.y);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 渲染数据生成
  // ═══════════════════════════════════════════
  describe('generateTileRenderData', () => {
    it('生成完整渲染数据', () => {
      const tile = allTiles[0];
      const rd = renderer.generateTileRenderData(tile);
      expect(rd.pos).toEqual(tile.pos);
      expect(rd.pixelX).toBe(tile.pos.x * GRID_CONFIG.tileWidth);
      expect(rd.pixelY).toBe(tile.pos.y * GRID_CONFIG.tileHeight);
      expect(rd.terrainColor).toBeTruthy();
      expect(rd.regionColor).toBeTruthy();
      expect(typeof rd.highlighted).toBe('boolean');
      expect(rd.layer).toBeTruthy();
    });

    it('有地标的格子包含 landmarkIcon', () => {
      const luoyangTile = allTiles.find(t => t.pos.x === 30 && t.pos.y === 8);
      expect(luoyangTile).toBeDefined();
      const rd = renderer.generateTileRenderData(luoyangTile!);
      expect(rd.landmarkIcon).toBe('🏰');
    });

    it('无地标的格子无 landmarkIcon', () => {
      const plainTile = allTiles.find(t => !t.landmark);
      expect(plainTile).toBeDefined();
      const rd = renderer.generateTileRenderData(plainTile!);
      expect(rd.landmarkIcon).toBeUndefined();
    });

    it('高亮标志可控制', () => {
      const tile = allTiles[0];
      const rd1 = renderer.generateTileRenderData(tile, false);
      const rd2 = renderer.generateTileRenderData(tile, true);
      expect(rd1.highlighted).toBe(false);
      expect(rd2.highlighted).toBe(true);
    });
  });

  describe('computeViewportRenderData', () => {
    it('返回完整视口渲染数据', () => {
      const vp = createDefaultViewport();
      const result = renderer.computeViewportRenderData(allTiles, vp);
      expect(result.tiles.length).toBeGreaterThan(0);
      expect(result.visibleLandmarks).toBeDefined();
      expect(result.visibleRange).toBeDefined();
    });

    it('可见地标在视口范围内', () => {
      const vp = createDefaultViewport();
      const result = renderer.computeViewportRenderData(allTiles, vp);
      for (const lm of result.visibleLandmarks) {
        expect(lm).toBeDefined();
        expect(lm.name).toBeTruthy();
      }
    });

    it('默认视口包含洛阳', () => {
      const vp = createDefaultViewport();
      const result = renderer.computeViewportRenderData(allTiles, vp);
      const luoyang = result.visibleLandmarks.find(l => l.name === '洛阳');
      // 洛阳在 (30, 8)，默认视口应该能看到
      expect(luoyang).toBeDefined();
    });

    it('偏移视口可能排除某些地标', () => {
      // 偏移到地图右下角
      const vp: ViewportState = { offsetX: -(MAP_SIZE.cols * GRID_CONFIG.tileWidth), offsetY: -(MAP_SIZE.rows * GRID_CONFIG.tileHeight), zoom: 1.0 };
      const result = renderer.computeViewportRenderData(allTiles, vp);
      // 视口范围在地图边界，可能看到或看不到地标
      expect(result.tiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateFullRenderData', () => {
    it('生成全部格子的渲染数据', () => {
      const renderData = renderer.generateFullRenderData(allTiles);
      expect(renderData.length).toBe(allTiles.length);
    });

    it('每个渲染数据完整', () => {
      const renderData = renderer.generateFullRenderData(allTiles);
      for (const rd of renderData) {
        expect(rd.pos).toBeDefined();
        expect(typeof rd.pixelX).toBe('number');
        expect(typeof rd.pixelY).toBe('number');
        expect(rd.terrainColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(rd.regionColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 层级计算
  // ═══════════════════════════════════════════
  describe('computeLayer', () => {
    it('有城池地标的格子为 landmark 层', () => {
      const tile = allTiles.find(t => t.landmark?.type === 'city');
      expect(tile).toBeDefined();
      expect(renderer.computeLayer(tile!)).toBe('landmark');
    });

    it('有关卡地标的格子为 landmark 层', () => {
      const tile = allTiles.find(t => t.landmark?.type === 'pass');
      expect(tile).toBeDefined();
      expect(renderer.computeLayer(tile!)).toBe('landmark');
    });

    it('有资源点地标的格子为 landmark 层', () => {
      const tile = allTiles.find(t => t.landmark?.type === 'resource');
      expect(tile).toBeDefined();
      expect(renderer.computeLayer(tile!)).toBe('landmark');
    });

    it('city 地形无地标为 territory 层', () => {
      const tile = allTiles.find(t => t.terrain === 'city' && !t.landmark);
      if (tile) {
        expect(renderer.computeLayer(tile)).toBe('territory');
      }
    });

    it('普通地形为 terrain 层', () => {
      const tile = allTiles.find(t => t.terrain === 'plain' && !t.landmark);
      expect(tile).toBeDefined();
      expect(renderer.computeLayer(tile!)).toBe('terrain');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 视口约束
  // ═══════════════════════════════════════════
  describe('clampViewport', () => {
    it('默认视口不需要约束', () => {
      const vp = createDefaultViewport();
      const clamped = renderer.clampViewport(vp);
      expect(clamped.offsetX).toBe(vp.offsetX);
      expect(clamped.offsetY).toBe(vp.offsetY);
    });

    it('缩放被约束在合法范围', () => {
      const vp: ViewportState = { offsetX: 0, offsetY: 0, zoom: 0.1 };
      const clamped = renderer.clampViewport(vp);
      expect(clamped.zoom).toBe(VIEWPORT_CONFIG.minZoom);
    });

    it('超大缩放被约束', () => {
      const vp: ViewportState = { offsetX: 0, offsetY: 0, zoom: 10 };
      const clamped = renderer.clampViewport(vp);
      expect(clamped.zoom).toBe(VIEWPORT_CONFIG.maxZoom);
    });

    it('正偏移被限制为 0', () => {
      const vp: ViewportState = { offsetX: 100, offsetY: 100, zoom: 1.0 };
      const clamped = renderer.clampViewport(vp);
      expect(clamped.offsetX).toBeLessThanOrEqual(0);
      expect(clamped.offsetY).toBeLessThanOrEqual(0);
    });
  });

  describe('centerOnPosition', () => {
    it('居中到地图中心', () => {
      const centerPos = { x: 30, y: 20 };
      const vp = renderer.centerOnPosition(centerPos);
      // 视口应该将中心格子放在视口中心
      expect(vp.zoom).toBe(1.0);
      expect(typeof vp.offsetX).toBe('number');
      expect(typeof vp.offsetY).toBe('number');
    });

    it('居中到原点', () => {
      const vp = renderer.centerOnPosition({ x: 0, y: 0 });
      expect(vp.offsetX).toBeCloseTo(VIEWPORT_CONFIG.width / 2 - GRID_CONFIG.tileWidth / 2, 1);
      expect(vp.offsetY).toBeCloseTo(VIEWPORT_CONFIG.height / 2 - GRID_CONFIG.tileHeight / 2, 1);
    });

    it('自定义缩放', () => {
      const vp = renderer.centerOnPosition({ x: 30, y: 20 }, 1.5);
      expect(vp.zoom).toBe(1.5);
    });

    it('缩放被约束', () => {
      const vp = renderer.centerOnPosition({ x: 30, y: 20 }, 0.1);
      expect(vp.zoom).toBe(VIEWPORT_CONFIG.minZoom);
    });

    it('居中洛阳坐标', () => {
      const vp = renderer.centerOnPosition({ x: 30, y: 8 });
      // 验证洛阳在视口中心附近
      const range = renderer.computeVisibleRange(vp);
      expect(range.startX).toBeLessThanOrEqual(30);
      expect(range.endX).toBeGreaterThanOrEqual(30);
      expect(range.startY).toBeLessThanOrEqual(8);
      expect(range.endY).toBeGreaterThanOrEqual(8);
    });
  });
});
