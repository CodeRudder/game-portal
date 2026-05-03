/**
 * PixelMapRenderer 测试
 *
 * 测试渲染器的数据处理、视口控制、配置管理。
 * Canvas渲染通过mock验证方法调用。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PixelMapRenderer } from '../PixelMapRenderer';
import type { ParsedMap, MapCell, ASCIITerrain } from '../../../core/map/ASCIIMapParser';

// Mock Canvas
function createMockCanvas(): HTMLCanvasElement {
  const mockCtx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    save: vi.fn(),
    restore: vi.fn(),
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
    get fillStyle() { return ''; },
    get strokeStyle() { return ''; },
  };

  return {
    width: 800,
    height: 480,
    getContext: vi.fn(() => mockCtx),
  } as unknown as HTMLCanvasElement;
}

// 创建测试地图
function createTestMap(width: number, height: number, terrain: ASCIITerrain = 'plain'): ParsedMap {
  const cells: MapCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: MapCell[] = [];
    for (let x = 0; x < width; x++) {
      const charMap: Record<ASCIITerrain, string> = {
        plain: '.', mountain: '^', water: '~', forest: '#',
        road_h: '-', road_v: '|', road_cross: '+', road_diag: '/',
        path: ':', pass: '=', desert: '*', grass: ',', mud: '_',
        wall_h: '─', wall_v: '│', wall_tl: '┌', wall_tr: '┐',
        wall_bl: '└', wall_br: '┘', wall_t: '├', wall_t_r: '┤',
        wall_t_d: '┬', wall_t_u: '┴', wall_cross: '┼',
        city: 'C', resource: 'r', outpost: '0', player: '@',
        event: '!', unknown: '?', ruins: '%', chest: '&',
        caravan: '$', empty: ' ',
      };
      row.push({ x, y, char: charMap[terrain] || '.', terrain });
    }
    cells.push(row);
  }

  return {
    name: '测试地图',
    width,
    height,
    tileSize: 8,
    cells,
    cityMap: {},
    cities: [],
    roads: [],
  };
}

describe('PixelMapRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: PixelMapRenderer;

  beforeEach(() => {
    canvas = createMockCanvas();
    renderer = new PixelMapRenderer(canvas, {
      tileSize: 8,
      scale: 1,
      showCityNames: false,
      showGrid: false,
    });
  });

  // ── 基础配置 ─────────────────────────────────

  describe('基础配置', () => {
    it('默认配置正确', () => {
      const config = (renderer as any).config;
      expect(config.tileSize).toBe(8);
      expect(config.scale).toBe(1);
      expect(config.showCityNames).toBe(false);
      expect(config.showGrid).toBe(false);
    });

    it('自定义配置覆盖默认值', () => {
      const r = new PixelMapRenderer(canvas, {
        tileSize: 16,
        scale: 2,
        showCityNames: true,
        showGrid: true,
      });
      const config = (r as any).config;
      expect(config.tileSize).toBe(16);
      expect(config.scale).toBe(2);
      expect(config.showCityNames).toBe(true);
      expect(config.showGrid).toBe(true);
    });
  });

  // ── 地图加载 ─────────────────────────────────

  describe('地图加载', () => {
    it('loadMap加载地图数据', () => {
      const map = createTestMap(10, 8);
      renderer.loadMap(map);

      expect((renderer as any).map).toBe(map);
    });

    it('loadMap更新tileSize', () => {
      const map = createTestMap(10, 8);
      map.tileSize = 16;
      renderer.loadMap(map);

      expect((renderer as any).config.tileSize).toBe(16);
    });
  });

  // ── 视口控制 ─────────────────────────────────

  describe('视口控制', () => {
    it('setViewport设置偏移', () => {
      renderer.setViewport(100, 200);
      expect((renderer as any).offsetX).toBe(100);
      expect((renderer as any).offsetY).toBe(200);
    });

    it('setScale设置缩放', () => {
      renderer.setScale(2);
      expect((renderer as any).config.scale).toBe(2);
    });

    it('setScale限制范围', () => {
      renderer.setScale(0.1);
      expect((renderer as any).config.scale).toBe(0.5);

      renderer.setScale(10);
      expect((renderer as any).config.scale).toBe(4);
    });

    it('centerOn居中到指定坐标', () => {
      const map = createTestMap(100, 60);
      renderer.loadMap(map);
      renderer.centerOn(50, 30);

      const ts = 8; // tileSize * scale
      expect((renderer as any).offsetX).toBe(50 * ts - 400); // 50*ts - canvas.width/2
      expect((renderer as any).offsetY).toBe(30 * ts - 240); // 30*ts - canvas.height/2
    });
  });

  // ── 坐标转换 ─────────────────────────────────

  describe('坐标转换', () => {
    it('screenToGrid转换屏幕坐标到网格坐标', () => {
      const map = createTestMap(100, 60);
      renderer.loadMap(map);

      const grid = renderer.screenToGrid(4, 4);
      expect(grid).toEqual({ x: 0, y: 0 });
    });

    it('screenToGrid考虑偏移', () => {
      const map = createTestMap(100, 60);
      renderer.loadMap(map);
      renderer.setViewport(8, 8); // 偏移一个tileSize

      const grid = renderer.screenToGrid(0, 0);
      expect(grid).toEqual({ x: 1, y: 1 });
    });

    it('screenToGrid超出范围返回null', () => {
      const map = createTestMap(100, 60);
      renderer.loadMap(map);

      const grid = renderer.screenToGrid(-1, -1);
      expect(grid).toBeNull();
    });

    it('gridToScreen转换网格坐标到屏幕坐标', () => {
      const map = createTestMap(100, 60);
      renderer.loadMap(map);

      const screen = renderer.gridToScreen(5, 3);
      expect(screen).toEqual({ x: 40, y: 24 }); // 5*8, 3*8
    });

    it('gridToScreen考虑偏移', () => {
      const map = createTestMap(100, 60);
      renderer.loadMap(map);
      renderer.setViewport(16, 16);

      const screen = renderer.gridToScreen(5, 3);
      expect(screen).toEqual({ x: 40 - 16, y: 24 - 16 });
    });
  });

  // ── 城市数据 ─────────────────────────────────

  describe('城市数据', () => {
    it('setCityData设置城市渲染数据', () => {
      renderer.setCityData([
        { id: 'luoyang', name: '洛阳', x: 10, y: 10, faction: 'wei', level: 3 },
        { id: 'chang-an', name: '长安', x: 20, y: 10, faction: 'shu', level: 2 },
      ]);

      const cityData = (renderer as any).cityData;
      expect(cityData.size).toBe(2);
      expect(cityData.get('luoyang')?.name).toBe('洛阳');
    });

    it('setCityData清除旧数据', () => {
      renderer.setCityData([
        { id: 'luoyang', name: '洛阳', x: 10, y: 10, faction: 'wei', level: 3 },
      ]);

      renderer.setCityData([
        { id: 'chang-an', name: '长安', x: 20, y: 10, faction: 'shu', level: 2 },
      ]);

      const cityData = (renderer as any).cityData;
      expect(cityData.size).toBe(1);
      expect(cityData.has('luoyang')).toBe(false);
      expect(cityData.has('chang-an')).toBe(true);
    });
  });

  // ── 行军精灵 ─────────────────────────────────

  describe('行军精灵', () => {
    it('addMarchSprite添加精灵', () => {
      renderer.addMarchSprite({
        id: 'march-1',
        x: 100, y: 100,
        targetX: 200, targetY: 200,
        path: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        pathIndex: 0,
        speed: 2,
        faction: 'wei',
        troops: 1000,
      });

      expect((renderer as any).marchSprites.length).toBe(1);
    });

    it('removeMarchSprite移除精灵', () => {
      renderer.addMarchSprite({
        id: 'march-1',
        x: 100, y: 100,
        targetX: 200, targetY: 200,
        path: [],
        pathIndex: 0,
        speed: 2,
        faction: 'wei',
        troops: 1000,
      });

      renderer.removeMarchSprite('march-1');
      expect((renderer as any).marchSprites.length).toBe(0);
    });

    it('clearMarchSprites清空所有精灵', () => {
      renderer.addMarchSprite({
        id: 'march-1', x: 0, y: 0, targetX: 100, targetY: 100,
        path: [], pathIndex: 0, speed: 2, faction: 'wei', troops: 500,
      });
      renderer.addMarchSprite({
        id: 'march-2', x: 0, y: 0, targetX: 100, targetY: 100,
        path: [], pathIndex: 0, speed: 2, faction: 'shu', troops: 300,
      });

      renderer.clearMarchSprites();
      expect((renderer as any).marchSprites.length).toBe(0);
    });
  });

  // ── 渲染 ─────────────────────────────────────

  describe('渲染', () => {
    it('无地图时render不崩溃', () => {
      expect(() => renderer.render()).not.toThrow();
    });

    it('有地图时render调用clearRect', () => {
      const map = createTestMap(10, 8);
      renderer.loadMap(map);

      renderer.render();

      const ctx = canvas.getContext('2d') as any;
      expect(ctx.clearRect).toHaveBeenCalled();
    });

    it('render调用fillRect绘制地形', () => {
      const map = createTestMap(10, 8, 'mountain');
      renderer.loadMap(map);

      renderer.render();

      const ctx = canvas.getContext('2d') as any;
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('网格模式调用stroke方法', () => {
      const map = createTestMap(10, 8);
      renderer.loadMap(map);

      const r = new PixelMapRenderer(canvas, { showGrid: true });
      r.loadMap(map);
      r.render();

      const ctx = canvas.getContext('2d') as any;
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  // ── getCellAt ─────────────────────────────────

  describe('getCellAt', () => {
    it('获取指定位置的单元格', () => {
      const map = createTestMap(10, 8, 'mountain');
      renderer.loadMap(map);

      const cell = renderer.getCellAt(3, 4);
      expect(cell).toBeTruthy();
      expect(cell?.terrain).toBe('mountain');
    });

    it('超出范围返回null', () => {
      const map = createTestMap(10, 8);
      renderer.loadMap(map);

      expect(renderer.getCellAt(100, 100)).toBeNull();
      expect(renderer.getCellAt(-1, -1)).toBeNull();
    });
  });

  // ── 资源点渲染 ─────────────────────────────────

  describe('资源点渲染', () => {
    it('CityRenderData支持icon和type字段', () => {
      renderer.setCityData([
        { id: 'res-grain1', name: '许田', x: 10, y: 10, faction: 'neutral', level: 2, icon: '🌾', type: 'resource' },
        { id: 'city-luoyang', name: '洛阳', x: 20, y: 20, faction: 'player', level: 5, icon: '🏰', type: 'city' },
      ]);

      const cityData = (renderer as any).cityData;
      expect(cityData.get('res-grain1')?.icon).toBe('🌾');
      expect(cityData.get('res-grain1')?.type).toBe('resource');
      expect(cityData.get('city-luoyang')?.icon).toBe('🏰');
      expect(cityData.get('city-luoyang')?.type).toBe('city');
    });

    it('资源点通过fillText渲染图标', () => {
      const map = createTestMap(20, 20);
      renderer.loadMap(map);

      // 注入资源点数据(不在建筑框架中)
      renderer.setCityData([
        { id: 'res-grain1', name: '许田', x: 5, y: 5, faction: 'neutral', level: 2, icon: '🌾', type: 'resource' },
      ]);

      renderer.render();

      const ctx = canvas.getContext('2d') as any;
      // fillText应被调用来绘制资源点图标和名称
      expect(ctx.fillText).toHaveBeenCalled();

      // 验证fillText的调用包含资源图标
      const fillTextCalls = ctx.fillText.mock.calls;
      const iconCall = fillTextCalls.find((call: any[]) => call[0] === '🌾');
      expect(iconCall).toBeTruthy();
    });

    it('资源点通过fillRect绘制背景色块', () => {
      const map = createTestMap(20, 20);
      renderer.loadMap(map);

      renderer.setCityData([
        { id: 'res-gold1', name: '金矿场', x: 8, y: 8, faction: 'neutral', level: 2, icon: '💰', type: 'resource' },
      ]);

      renderer.render();

      const ctx = canvas.getContext('2d') as any;
      // fillRect应被调用来绘制资源点背景
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('资源点通过strokeRect绘制边框', () => {
      const map = createTestMap(20, 20);
      renderer.loadMap(map);

      renderer.setCityData([
        { id: 'res-troops1', name: '兵营', x: 10, y: 10, faction: 'neutral', level: 2, icon: '⚔️', type: 'resource' },
      ]);

      renderer.render();

      const ctx = canvas.getContext('2d') as any;
      // strokeRect应被调用来绘制资源点边框
      expect(ctx.strokeRect).toHaveBeenCalled();
    });

    it('无icon的资源点不崩溃', () => {
      const map = createTestMap(20, 20);
      renderer.loadMap(map);

      renderer.setCityData([
        { id: 'res-unknown', name: '未知资源', x: 5, y: 5, faction: 'neutral', level: 1 },
      ]);

      expect(() => renderer.render()).not.toThrow();
    });

    it('多个资源点同时渲染不崩溃', () => {
      const map = createTestMap(50, 50);
      renderer.loadMap(map);

      renderer.setCityData([
        { id: 'res-grain1', name: '许田', x: 10, y: 10, faction: 'neutral', level: 2, icon: '🌾', type: 'resource' },
        { id: 'res-gold1', name: '金矿场', x: 20, y: 20, faction: 'neutral', level: 2, icon: '💰', type: 'resource' },
        { id: 'res-grain2', name: '稻田', x: 30, y: 30, faction: 'neutral', level: 3, icon: '🌾', type: 'resource' },
        { id: 'res-troops1', name: '兵营', x: 40, y: 40, faction: 'neutral', level: 2, icon: '⚔️', type: 'resource' },
        { id: 'res-mandate1', name: '天命台', x: 5, y: 45, faction: 'neutral', level: 2, icon: '🌟', type: 'resource' },
      ]);

      expect(() => renderer.render()).not.toThrow();
    });

    it('资源点和城市混合渲染不崩溃', () => {
      const map = createTestMap(50, 50);
      // 添加一个建筑框架城市到map.cities
      map.cities.push({ id: 'city-luoyang', char: '┌', x: 2, y: 2 });
      renderer.loadMap(map);

      renderer.setCityData([
        { id: 'city-luoyang', name: '洛阳', x: 2, y: 2, faction: 'player', level: 5, icon: '🏰', type: 'city' },
        { id: 'res-grain1', name: '许田', x: 15, y: 15, faction: 'neutral', level: 2, icon: '🌾', type: 'resource' },
      ]);

      expect(() => renderer.render()).not.toThrow();
    });

    it('资源点名称在showCityNames=true时渲染', () => {
      const map = createTestMap(20, 20);
      renderer.loadMap(map);

      const r = new PixelMapRenderer(canvas, {
        tileSize: 8,
        scale: 1,
        showCityNames: true,
        showGrid: false,
      });
      r.loadMap(map);
      r.setCityData([
        { id: 'res-grain1', name: '许田', x: 5, y: 5, faction: 'neutral', level: 2, icon: '🌾', type: 'resource' },
      ]);

      r.render();

      const ctx = canvas.getContext('2d') as any;
      const fillTextCalls = ctx.fillText.mock.calls;
      // 应该包含资源点名称"许田"
      const nameCall = fillTextCalls.find((call: any[]) => call[0] === '许田');
      expect(nameCall).toBeTruthy();
    });
  });
});
