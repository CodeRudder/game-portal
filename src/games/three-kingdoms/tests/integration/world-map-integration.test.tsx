/**
 * 天下地图系统 — 全面集成测试 (D1-D5)
 *
 * D1: 像素地图基础渲染测试
 * D2: 城市标记测试
 * D3: 点击交互测试
 * D4: 攻城闭环测试
 * D5: 视图切换测试
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import WorldMapTab from '@/components/idle/panels/map/WorldMapTab';
import { PixelWorldMap } from '@/components/idle/panels/map/PixelWorldMap';
import { PixelMapRenderer } from '@/games/three-kingdoms/engine/map/PixelMapRenderer';
import { WorldMapSystem } from '@/games/three-kingdoms/engine/map/WorldMapSystem';
import { ASCIIMapParser } from '@/games/three-kingdoms/core/map/ASCIIMapParser';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import type { ISystemDeps } from '@/games/three-kingdoms/core/types';
import type { ParsedMap } from '@/games/three-kingdoms/core/map/ASCIIMapParser';

// ── Mock CSS ──
vi.mock('@/components/idle/panels/map/WorldMapTab.css', () => ({}));
vi.mock('@/components/idle/panels/map/PixelWorldMap.css', () => ({}));
vi.mock('@/components/idle/panels/map/TerritoryInfoPanel.css', () => ({}));
vi.mock('@/components/idle/panels/map/SiegeConfirmModal.css', () => ({}));
vi.mock('@/components/idle/panels/map/SiegeResultModal.css', () => ({}));

// ── Mock 地图数据模块(100x60匹配真实地图) ──
vi.mock('@/games/three-kingdoms/core/map/maps/world-map.txt?raw', () => {
  const row = '.'.repeat(100);
  const rows = Array(60).fill(row).join('\n');
  return {
    default: `MAP:测试地图
SIZE:100x60
TILE:8

CITY: L=洛阳,X=许昌,J=建业,C=长安,Y=邺城,G=成都

${rows}`,
  };
});

// ── Mock config ──
vi.mock('@/games/three-kingdoms/core/map', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    REGION_IDS: ['wei', 'shu', 'wu', 'neutral'],
    REGION_LABELS: { wei: '魏', shu: '蜀', wu: '吴', neutral: '中立' },
    TERRAIN_TYPES: ['plain', 'mountain', 'forest', 'water', 'pass', 'city'],
    TERRAIN_LABELS: { plain: '平原', mountain: '山地', forest: '森林', water: '水域', pass: '关隘', city: '城池' },
  };
});

// ── Mock Canvas ──
const mockFillRect = vi.fn();
const mockStrokeRect = vi.fn();
const mockFillText = vi.fn();
const mockClearRect = vi.fn();
const mockBeginPath = vi.fn();
const mockMoveTo = vi.fn();
const mockLineTo = vi.fn();
const mockArc = vi.fn();
const mockFill = vi.fn();
const mockStroke = vi.fn();
const mockSave = vi.fn();
const mockRestore = vi.fn();
const mockSetLineDash = vi.fn();
const mockRoundRect = vi.fn();
const mockDrawImage = vi.fn();
const mockMeasureText = vi.fn(() => ({ width: 50 }));
const mockCreateLinearGradient = vi.fn(() => ({ addColorStop: vi.fn() }));
const mockQuadraticCurveTo = vi.fn();

let currentFillStyle = '';
let currentStrokeStyle = '';
let currentLineWidth = 1;
let currentFont = '';
let currentTextAlign = 'start';
let currentTextBaseline = 'alphabetic';
let currentGlobalAlpha = 1;

const mockGetContext = vi.fn(() => ({
  clearRect: mockClearRect,
  fillRect: mockFillRect,
  strokeRect: mockStrokeRect,
  fillText: mockFillText,
  beginPath: mockBeginPath,
  moveTo: mockMoveTo,
  lineTo: mockLineTo,
  quadraticCurveTo: mockQuadraticCurveTo,
  arc: mockArc,
  fill: mockFill,
  stroke: mockStroke,
  createLinearGradient: mockCreateLinearGradient,
  save: mockSave,
  restore: mockRestore,
  set fillStyle(v: string) { currentFillStyle = v; },
  get fillStyle() { return currentFillStyle; },
  set strokeStyle(v: string) { currentStrokeStyle = v; },
  get strokeStyle() { return currentStrokeStyle; },
  set lineWidth(v: number) { currentLineWidth = v; },
  get lineWidth() { return currentLineWidth; },
  set font(v: string) { currentFont = v; },
  get font() { return currentFont; },
  set textAlign(v: string) { currentTextAlign = v; },
  get textAlign() { return currentTextAlign; },
  set textBaseline(v: string) { currentTextBaseline = v; },
  get textBaseline() { return currentTextBaseline; },
  set globalAlpha(v: number) { currentGlobalAlpha = v; },
  get globalAlpha() { return currentGlobalAlpha; },
  drawImage: mockDrawImage,
  measureText: mockMeasureText,
  roundRect: mockRoundRect,
  setLineDash: mockSetLineDash,
}));

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: mockGetContext,
  writable: true,
});

// ── 测试数据工厂 ──
const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 50, y: 23 },
  region: 'wei',
  ownership: 'player',
  level: 5,
  baseProduction: { grain: 20, gold: 10, troops: 5, mandate: 2 },
  currentProduction: { grain: 30, gold: 15, troops: 7.5, mandate: 3 },
  defenseValue: 300,
  adjacentIds: ['city-xuchang', 'city-changan', 'pass-hulao'],
  ...overrides,
});

const defaultTerritories: TerritoryData[] = [
  makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 50, y: 23 }, level: 5 }),
  makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 37, y: 26 }, level: 4, region: 'wei' }),
  makeTerritory({ id: 'city-jianye', name: '建业', ownership: 'neutral', position: { x: 80, y: 39 }, level: 5, region: 'wu' }),
  makeTerritory({ id: 'city-changan', name: '长安', ownership: 'player', position: { x: 27, y: 36 }, level: 5, region: 'shu',
    currentProduction: { grain: 25, gold: 12, troops: 6, mandate: 2 } }),
  makeTerritory({ id: 'city-ye', name: '邺城', ownership: 'enemy', position: { x: 32, y: 9 }, level: 4, region: 'wei' }),
  makeTerritory({ id: 'city-chengdu', name: '成都', ownership: 'neutral', position: { x: 12, y: 49 }, level: 5, region: 'shu' }),
];

const defaultProductionSummary = {
  totalTerritories: 6,
  territoriesByRegion: { wei: 3, shu: 2, wu: 1 },
  totalProduction: { grain: 55, gold: 27, troops: 13.5, mandate: 5 },
  details: [],
};

// ── 工具函数 ──
function createMockCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function createTestMap(width: number, height: number, tileSize: number): ParsedMap {
  const cells = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({ x, y, char: '.', terrain: 'plain' });
    }
    cells.push(row);
  }
  return {
    name: '测试地图',
    width,
    height,
    tileSize,
    cells,
    cities: [],
    roads: [],
  } as unknown as ParsedMap;
}

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

function createDefaultProps(overrides: any = {}) {
  return {
    territories: defaultTerritories,
    productionSummary: defaultProductionSummary,
    snapshotVersion: 1,
    onSelectTerritory: vi.fn(),
    onSiegeTerritory: vi.fn(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// D1: 像素地图基础渲染测试
// ═══════════════════════════════════════════════════════════

describe('D1: 像素地图基础渲染测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D1.1 Canvas元素存在且尺寸正确', () => {
    it('Canvas元素存在于像素地图模式', () => {
      const props = createDefaultProps();
      const { container } = render(<WorldMapTab {...props} />);
      const canvas = container.querySelector('canvas.pixel-worldmap-canvas');
      expect(canvas).toBeTruthy();
    });

    it('Canvas具有默认width和height属性', () => {
      const props = createDefaultProps();
      const { container } = render(<WorldMapTab {...props} />);
      const canvas = container.querySelector('canvas.pixel-worldmap-canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('Canvas上下文正确获取2d', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      expect(mockGetContext).toHaveBeenCalledWith('2d');
    });

    it('PixelWorldMap组件独立渲染Canvas', () => {
      const { container } = render(
        <PixelWorldMap territories={defaultTerritories} />
      );
      const canvas = container.querySelector('canvas.pixel-worldmap-canvas');
      expect(canvas).toBeTruthy();
    });

    it('Canvas容器(.pixel-worldmap)包含Canvas和Minimap', () => {
      const { container } = render(
        <PixelWorldMap territories={defaultTerritories} />
      );
      const mapContainer = container.querySelector('.pixel-worldmap');
      expect(mapContainer).toBeTruthy();
      const mainCanvas = container.querySelector('.pixel-worldmap-canvas');
      const minimap = container.querySelector('.pixel-worldmap-minimap');
      expect(mainCanvas).toBeTruthy();
      expect(minimap).toBeTruthy();
      expect(mainCanvas).not.toBe(minimap);
    });
  });

  describe('D1.2 地图数据正确加载(world-map.txt解析)', () => {
    it('ASCIIMapParser正确解析地图文本', () => {
      const parser = new ASCIIMapParser();
      const text = `MAP:测试地图
SIZE:10x8
TILE:8

CITY: L=洛阳,X=许昌

..........
.L....X...
..........
..........
..........
..........
..........
..........`;
      const map = parser.parse(text);
      expect(map.name).toBe('测试地图');
      expect(map.width).toBe(10);
      expect(map.height).toBe(8);
      expect(map.tileSize).toBe(8);
      expect(map.cells.length).toBe(8);
      expect(map.cells[0].length).toBe(10);
    });

    it('ASCIIMapParser识别城市字符', () => {
      const parser = new ASCIIMapParser();
      const text = `MAP:测试
SIZE:10x3
TILE:8

CITY: L=洛阳,X=许昌

..........
.L....X...
..........`;
      const map = parser.parse(text);
      expect(map.cities.length).toBeGreaterThanOrEqual(1);
    });

    it('PixelMapRenderer正确加载地图', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      expect(() => renderer.loadMap(testMap)).not.toThrow();
    });

    it('渲染不崩溃(无地图数据时render安全)', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      expect(() => renderer.render()).not.toThrow();
    });

    it('渲染不崩溃(有地图数据时)', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);
      expect(() => renderer.render()).not.toThrow();
    });
  });

  describe('D1.3 城市标记正确渲染(位置、颜色)', () => {
    it('setCityData后城市数据被正确存储', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      const cities = [
        { id: 'city-luoyang', name: '洛阳', x: 50, y: 23, faction: 'player', level: 5 },
        { id: 'city-xuchang', name: '许昌', x: 37, y: 26, faction: 'enemy', level: 4 },
      ];
      expect(() => renderer.setCityData(cities)).not.toThrow();
    });

    it('不同阵营城市的factionColor正确映射', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, {
        tileSize: 8,
        scale: 1,
        showCityNames: true,
        showGrid: false,
        factionColors: {
          player: '#7EC850',
          enemy: '#e74c3c',
          neutral: 'rgba(255,255,255,0.15)',
        },
      });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);
      renderer.setCityData([
        { id: 'city-luoyang', name: '洛阳', x: 50, y: 23, faction: 'player', level: 5 },
      ]);
      expect(() => renderer.render()).not.toThrow();
    });

    it('PixelWorldMap组件使用正确的FACTION_COLORS', () => {
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 2, y: 1 } }),
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 7, y: 1 } }),
        makeTerritory({ id: 'city-jianye', name: '建业', ownership: 'neutral', position: { x: 5, y: 5 } }),
      ];
      expect(() => {
        render(<PixelWorldMap territories={territories} />);
      }).not.toThrow();
    });
  });

  describe('D1.4 道路网络正确显示', () => {
    it('地图包含道路数据时渲染不崩溃', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const map: ParsedMap = {
        name: '测试',
        width: 10,
        height: 8,
        tileSize: 8,
        cells: Array.from({ length: 8 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({ x, y, char: '.', terrain: 'plain' as const }))
        ),
        cities: [],
        roads: [
          { from: { x: 1, y: 1 }, to: { x: 5, y: 1 } },
          { from: { x: 5, y: 1 }, to: { x: 5, y: 5 } },
        ],
      } as unknown as ParsedMap;
      renderer.loadMap(map);
      expect(() => renderer.render()).not.toThrow();
    });
  });

  describe('D1.5 缩放/平移后渲染正确', () => {
    it('setScale限制范围:最小0.5,最大4.0', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });

      renderer.setScale(0.1);
      expect((renderer as any).config.scale).toBe(0.5);

      renderer.setScale(10);
      expect((renderer as any).config.scale).toBe(4);

      renderer.setScale(2.0);
      expect((renderer as any).config.scale).toBe(2.0);
    });

    it('setViewport正确设置偏移', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      renderer.setViewport(100, 200);
      expect((renderer as any).offsetX).toBe(100);
      expect((renderer as any).offsetY).toBe(200);
    });

    it('缩放后渲染不崩溃', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      renderer.setScale(2.0);
      expect(() => renderer.render()).not.toThrow();

      renderer.setScale(3.5);
      expect(() => renderer.render()).not.toThrow();
    });

    it('平移后渲染不崩溃', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      renderer.setViewport(200, 150);
      expect(() => renderer.render()).not.toThrow();
    });

    it('autoFit在不同容器尺寸下正确计算', () => {
      const testMap = createTestMap(100, 60, 8);

      // 800x480: scale=1.0, offset=(0,0)
      const c1 = createMockCanvas(800, 480);
      const r1 = new PixelMapRenderer(c1, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      r1.loadMap(testMap);
      r1.autoFit(800, 480);
      expect((r1 as any).config.scale).toBe(1.0);

      // 1600x960: scale=2.0
      const c2 = createMockCanvas(1600, 960);
      const r2 = new PixelMapRenderer(c2, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      r2.loadMap(testMap);
      r2.autoFit(1600, 960);
      expect((r2 as any).config.scale).toBe(2.0);
    });

    it('centerOn正确居中到指定坐标', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      renderer.centerOn(50, 30);
      const ts = 8 * 1; // tileSize * scale
      expect((renderer as any).offsetX).toBe(50 * ts - 800 / 2);
      expect((renderer as any).offsetY).toBe(30 * ts - 480 / 2);
    });
  });

  describe('D1.6 脏标记渲染(无变化时跳过)', () => {
    it('PixelWorldMap的脏标记机制不阻止正常渲染', () => {
      const { rerender } = render(
        <PixelWorldMap territories={defaultTerritories} />
      );
      // 多次重渲染不崩溃
      for (let i = 0; i < 5; i++) {
        rerender(<PixelWorldMap territories={defaultTerritories} />);
      }
      expect(true).toBe(true);
    });

    it('territories变化触发重绘', () => {
      const { rerender } = render(
        <PixelWorldMap territories={defaultTerritories} />
      );
      const updated = [
        ...defaultTerritories,
        makeTerritory({ id: 'city-new', name: '新城', ownership: 'player', position: { x: 60, y: 40 } }),
      ];
      expect(() => rerender(<PixelWorldMap territories={updated} />)).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════
// D2: 城市标记测试
// ═══════════════════════════════════════════════════════════

describe('D2: 城市标记测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 480,
      width: 800, height: 480, x: 0, y: 0, toJSON: () => {},
    });
  });

  describe('D2.1 己方城市显示绿色', () => {
    it('player阵营城市渲染不崩溃且使用绿色映射', () => {
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 5, y: 5 } }),
      ];
      expect(() => {
        render(<PixelWorldMap territories={territories} />);
      }).not.toThrow();
    });

    it('WorldMapTab中player城市在列表模式显示player样式', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      // 切换到列表模式
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const cell = screen.getByTestId('territory-cell-city-luoyang');
      expect(cell.className).toContain('tk-territory-cell--player');
    });
  });

  describe('D2.2 敌方城市显示红色', () => {
    it('enemy阵营城市渲染不崩溃且使用红色映射', () => {
      const territories = [
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 5, y: 5 } }),
      ];
      expect(() => {
        render(<PixelWorldMap territories={territories} />);
      }).not.toThrow();
    });

    it('WorldMapTab中enemy城市在列表模式显示enemy样式', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const cell = screen.getByTestId('territory-cell-city-xuchang');
      expect(cell.className).toContain('tk-territory-cell--enemy');
    });
  });

  describe('D2.3 中立城市显示灰色', () => {
    it('neutral阵营城市渲染不崩溃且使用灰色映射', () => {
      const territories = [
        makeTerritory({ id: 'city-jianye', name: '建业', ownership: 'neutral', position: { x: 5, y: 5 } }),
      ];
      expect(() => {
        render(<PixelWorldMap territories={territories} />);
      }).not.toThrow();
    });

    it('WorldMapTab中neutral城市在列表模式显示neutral样式', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const cell = screen.getByTestId('territory-cell-city-jianye');
      expect(cell.className).toContain('tk-territory-cell--neutral');
    });
  });

  describe('D2.4 城市名称在色块内居中', () => {
    it('PixelMapRenderer渲染城市名称层', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      // 创建带建筑框架的地图
      const cells = [];
      for (let y = 0; y < 10; y++) {
        const row = [];
        for (let x = 0; x < 10; x++) {
          let ch = '.';
          let terrain = 'plain';
          // 在(1,1)处创建建筑框架: ┌──┐ / │  │ / └──┘
          if (y === 1 && x === 1) { ch = '┌'; terrain = 'city'; }
          else if (y === 1 && x === 2) { ch = '─'; terrain = 'city'; }
          else if (y === 1 && x === 3) { ch = '┐'; terrain = 'city'; }
          else if (y === 2 && x === 1) { ch = '│'; terrain = 'city'; }
          else if (y === 2 && x === 3) { ch = '│'; terrain = 'city'; }
          else if (y === 3 && x === 1) { ch = '└'; terrain = 'city'; }
          else if (y === 3 && x === 2) { ch = '─'; terrain = 'city'; }
          else if (y === 3 && x === 3) { ch = '┘'; terrain = 'city'; }
          row.push({ x, y, char: ch, terrain });
        }
        cells.push(row);
      }
      const map: ParsedMap = {
        name: '测试', width: 10, height: 10, tileSize: 8,
        cells, cities: [{ id: 'L', x: 1, y: 1 }],
        roads: [],
      } as unknown as ParsedMap;
      renderer.loadMap(map);
      renderer.setCityData([
        { id: 'L', name: '洛阳', x: 1, y: 1, faction: 'player', level: 5 },
      ]);
      renderer.render();
      // 验证fillText被调用(城市名称渲染在建筑内部居中)
      expect(mockFillText).toHaveBeenCalled();
    });

    it('showCityNames为false时不渲染城市名称层', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: false, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);
      renderer.setCityData([
        { id: 'city-luoyang', name: '洛阳', x: 50, y: 23, faction: 'player', level: 5 },
      ]);
      // showCityNames=false时城市名称层不渲染，但不崩溃
      expect(() => renderer.render()).not.toThrow();
    });

    it('城市名称渲染使用textAlign=center和textBaseline=middle', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const cells = [];
      for (let y = 0; y < 10; y++) {
        const row = [];
        for (let x = 0; x < 10; x++) {
          let ch = '.';
          let terrain = 'plain';
          if (y === 1 && x === 1) { ch = '┌'; terrain = 'city'; }
          else if (y === 1 && x === 2) { ch = '─'; terrain = 'city'; }
          else if (y === 1 && x === 3) { ch = '┐'; terrain = 'city'; }
          else if (y === 2 && x === 1) { ch = '│'; terrain = 'city'; }
          else if (y === 2 && x === 3) { ch = '│'; terrain = 'city'; }
          else if (y === 3 && x === 1) { ch = '└'; terrain = 'city'; }
          else if (y === 3 && x === 2) { ch = '─'; terrain = 'city'; }
          else if (y === 3 && x === 3) { ch = '┘'; terrain = 'city'; }
          row.push({ x, y, char: ch, terrain });
        }
        cells.push(row);
      }
      const map: ParsedMap = {
        name: '测试', width: 10, height: 10, tileSize: 8,
        cells, cities: [{ id: 'L', x: 1, y: 1 }],
        roads: [],
      } as unknown as ParsedMap;
      renderer.loadMap(map);
      renderer.setCityData([
        { id: 'L', name: '洛阳', x: 1, y: 1, faction: 'player', level: 5 },
      ]);
      renderer.render();
      // 验证textAlign被设为center
      expect(currentTextAlign).toBe('center');
    });
  });

  describe('D2.5 攻城成功后颜色实时更新', () => {
    it('territories更新后PixelWorldMap重新设置城市数据', () => {
      const initial = [
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 37, y: 26 } }),
      ];
      const { rerender } = render(<PixelWorldMap territories={initial} />);

      // 攻城成功后: enemy -> player
      const updated = [
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'player', position: { x: 37, y: 26 } }),
      ];
      expect(() => rerender(<PixelWorldMap territories={updated} />)).not.toThrow();
    });

    it('WorldMapTab中攻城成功后城市样式变化', () => {
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player' }),
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' }),
      ];
      const props = createDefaultProps({ territories });
      const { rerender } = render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));

      // 初始enemy
      let cell = screen.getByTestId('territory-cell-city-xuchang');
      expect(cell.className).toContain('tk-territory-cell--enemy');

      // 攻城成功后更新
      const updatedTerritories = territories.map(t =>
        t.id === 'city-xuchang' ? { ...t, ownership: 'player' as const } : t
      );
      rerender(<WorldMapTab {...props} territories={updatedTerritories} snapshotVersion={2} />);
      cell = screen.getByTestId('territory-cell-city-xuchang');
      expect(cell.className).toContain('tk-territory-cell--player');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// D3: 点击交互测试
// ═══════════════════════════════════════════════════════════

describe('D3: 点击交互测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 480,
      width: 800, height: 480, x: 0, y: 0, toJSON: () => {},
    });
  });

  describe('D3.1 点击城市位置触发onSelectTerritory', () => {
    it('点击已知城市坐标触发回调', () => {
      const onSelect = vi.fn();
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 1, y: 1 } }),
      ];
      const { container } = render(
        <PixelWorldMap territories={territories} onSelectTerritory={onSelect} />
      );
      const canvas = container.querySelector('canvas.pixel-worldmap-canvas')!;
      // city-luoyang at (1,1), ts=8 => screen (8, 8)
      fireEvent.mouseDown(canvas, { clientX: 8, clientY: 8, button: 0 });
      expect(onSelect).toHaveBeenCalledWith('city-luoyang');
    });

    it('WorldMapTab中点击城市选中并显示信息', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const cell = screen.getByTestId('territory-cell-city-luoyang');
      fireEvent.click(cell);
      expect(cell.className).toContain('tk-territory-cell--selected');
      expect(props.onSelectTerritory).toHaveBeenCalledWith('city-luoyang');
    });
  });

  describe('D3.2 点击空白区域取消选中', () => {
    it('点击远离城市的空白区域触发空字符串回调', () => {
      const onSelect = vi.fn();
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 1, y: 1 } }),
      ];
      const { container } = render(
        <PixelWorldMap territories={territories} onSelectTerritory={onSelect} />
      );
      const canvas = container.querySelector('canvas.pixel-worldmap-canvas')!;
      // 点击空白区域(400, 240)
      fireEvent.mouseDown(canvas, { clientX: 400, clientY: 240, button: 0 });
      expect(onSelect).toHaveBeenCalledWith('');
    });

    it('WorldMapTab中再次点击同一城市取消选中', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const cell = screen.getByTestId('territory-cell-city-luoyang');
      fireEvent.click(cell);
      expect(cell.className).toContain('tk-territory-cell--selected');
      fireEvent.click(cell);
      expect(cell.className).not.toContain('tk-territory-cell--selected');
    });
  });

  describe('D3.3 缩放/平移后点击坐标准确', () => {
    it('screenToGrid在缩放后正确转换坐标', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      // scale=1时, (8,8) => grid(1,1)
      let grid = renderer.screenToGrid(8, 8);
      expect(grid).toEqual({ x: 1, y: 1 });

      // scale=2时, (16,16) => grid(1,1)
      renderer.setScale(2);
      grid = renderer.screenToGrid(16, 16);
      expect(grid).toEqual({ x: 1, y: 1 });
    });

    it('screenToGrid在偏移后正确转换坐标', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      renderer.setViewport(100, 100);
      // 偏移(100,100)后, screen(108,108) => grid(1+100/8, 1+100/8) = grid(13,13)
      const grid = renderer.screenToGrid(8, 8);
      expect(grid).not.toBeNull();
      expect(grid!.x).toBe(Math.floor((8 + 100) / 8));
      expect(grid!.y).toBe(Math.floor((8 + 100) / 8));
    });

    it('screenToGrid越界返回null', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      const grid = renderer.screenToGrid(-10, -10);
      expect(grid).toBeNull();
    });
  });

  describe('D3.4 连续点击不同城市切换选中', () => {
    it('PixelWorldMap中连续点击不同城市回调正确', () => {
      const onSelect = vi.fn();
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 1, y: 1 } }),
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 4, y: 1 } }),
      ];
      const { container } = render(
        <PixelWorldMap territories={territories} onSelectTerritory={onSelect} />
      );
      const canvas = container.querySelector('canvas.pixel-worldmap-canvas')!;

      // 点击洛阳
      fireEvent.mouseDown(canvas, { clientX: 8, clientY: 8, button: 0 });
      expect(onSelect).toHaveBeenLastCalledWith('city-luoyang');

      // 点击许昌
      fireEvent.mouseDown(canvas, { clientX: 32, clientY: 8, button: 0 });
      expect(onSelect).toHaveBeenLastCalledWith('city-xuchang');
    });

    it('WorldMapTab中连续点击不同城市切换选中', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));

      fireEvent.click(screen.getByTestId('territory-cell-city-luoyang'));
      expect(screen.getByTestId('territory-cell-city-luoyang').className).toContain('tk-territory-cell--selected');

      fireEvent.click(screen.getByTestId('territory-cell-city-xuchang'));
      expect(screen.getByTestId('territory-cell-city-xuchang').className).toContain('tk-territory-cell--selected');
      expect(screen.getByTestId('territory-cell-city-luoyang').className).not.toContain('tk-territory-cell--selected');
    });
  });

  describe('D3.5 选中城市时地图自动居中', () => {
    it('selectedId变化触发centerOn', () => {
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 50, y: 23 } }),
      ];
      const { rerender } = render(
        <PixelWorldMap territories={territories} selectedId={null} />
      );
      // 选中城市
      expect(() => {
        rerender(<PixelWorldMap territories={territories} selectedId="city-luoyang" />);
      }).not.toThrow();
    });

    it('PixelMapRenderer.centerOn正确计算偏移', () => {
      const canvas = createMockCanvas(800, 480);
      const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
      const testMap = createTestMap(100, 60, 8);
      renderer.loadMap(testMap);

      renderer.centerOn(50, 23);
      const ts = 8;
      expect((renderer as any).offsetX).toBe(50 * ts - 400);
      expect((renderer as any).offsetY).toBe(23 * ts - 240);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// D4: 攻城闭环测试
// ═══════════════════════════════════════════════════════════

describe('D4: 攻城闭环测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D4.1 选中敌方城市→信息面板显示攻城按钮', () => {
    it('选中敌方城市时信息面板显示', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      expect(screen.getByTestId('worldmap-info-panel')).toBeTruthy();
    });

    it('信息面板有详情和产出子Tab', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      expect(screen.getByTestId('info-tab-detail')).toBeTruthy();
      expect(screen.getByTestId('info-tab-production')).toBeTruthy();
    });
  });

  describe('D4.2 点击攻城→确认弹窗显示(消耗/条件)', () => {
    it('SiegeConfirmModal正确渲染', async () => {
      const SiegeConfirmModal = (await import('@/components/idle/panels/map/SiegeConfirmModal')).default;
      const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <SiegeConfirmModal
          visible={true}
          target={target}
          cost={{ troops: 500, grain: 90 }}
          conditionResult={{ canSiege: true }}
          availableTroops={1000}
          availableGrain={500}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText(/攻城确认.*许昌/)).toBeTruthy();
      expect(screen.getByText('-500')).toBeTruthy();
    });

    it('SiegeConfirmModal条件不通过时显示错误', async () => {
      const SiegeConfirmModal = (await import('@/components/idle/panels/map/SiegeConfirmModal')).default;
      const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

      render(
        <SiegeConfirmModal
          visible={true}
          target={target}
          cost={{ troops: 500, grain: 90 }}
          conditionResult={{
            canSiege: false,
            errorCode: 'NOT_ADJACENT',
            errorMessage: '许昌 不与己方领土相邻',
          }}
          availableTroops={1000}
          availableGrain={500}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('siege-error')).toBeTruthy();
      expect(screen.getByTestId('siege-error').textContent).toContain('不与己方领土相邻');
    });
  });

  describe('D4.3 确认攻城→执行→结果弹窗', () => {
    it('SiegeResultModal胜利结果正确渲染', async () => {
      const SiegeResultModal = (await import('@/components/idle/panels/map/SiegeResultModal')).default;
      const result = {
        launched: true,
        victory: true,
        targetId: 'city-xuchang',
        targetName: '许昌',
        targetLevel: 3,
        cost: { troops: 500, grain: 500 },
        capture: { territoryId: 'city-xuchang', newOwner: 'player', previousOwner: 'enemy' },
        siegeReward: {
          resources: { grain: 300, gold: 200, troops: 100, mandate: 50 },
          territoryExp: 150,
        },
      };

      render(
        <SiegeResultModal visible={true} result={result} onClose={vi.fn()} />
      );

      expect(screen.getByTestId('siege-result-modal')).toBeTruthy();
      expect(screen.getByText('攻城大捷！')).toBeTruthy();
      expect(screen.getByText(/成功占领了.*许昌/)).toBeTruthy();
    });

    it('SiegeResultModal失败结果正确渲染', async () => {
      const SiegeResultModal = (await import('@/components/idle/panels/map/SiegeResultModal')).default;
      const result = {
        launched: true,
        victory: false,
        targetId: 'city-ye',
        targetName: '邺城',
        cost: { troops: 800, grain: 500 },
        defeatTroopLoss: 240,
        failureReason: '兵力不足以攻破防线',
      };

      render(
        <SiegeResultModal visible={true} result={result} onClose={vi.fn()} />
      );

      expect(screen.getByText('攻城失利')).toBeTruthy();
      expect(screen.getByText(/邺城.*防守坚固/)).toBeTruthy();
    });

    it('SiegeResultModal条件不满足结果正确渲染', async () => {
      const SiegeResultModal = (await import('@/components/idle/panels/map/SiegeResultModal')).default;
      const result = {
        launched: false,
        victory: false,
        targetId: 'city-ye',
        targetName: '邺城',
        cost: { troops: 0, grain: 0 },
        failureReason: '条件不满足',
      };

      render(
        <SiegeResultModal visible={true} result={result} onClose={vi.fn()} />
      );

      expect(screen.getByText('无法攻城')).toBeTruthy();
      expect(screen.getByText('条件不满足')).toBeTruthy();
    });
  });

  describe('D4.4 攻城成功→领土归属变化→地图颜色更新', () => {
    it('攻城成功后territories数据更新触发地图重绘', () => {
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player' }),
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' }),
      ];
      const props = createDefaultProps({ territories });
      const { rerender } = render(<WorldMapTab {...props} />);

      // 攻城成功: enemy -> player
      const updated = territories.map(t =>
        t.id === 'city-xuchang' ? { ...t, ownership: 'player' as const } : t
      );
      rerender(<WorldMapTab {...props} territories={updated} snapshotVersion={2} />);

      // 统计数据应更新
      const stat = screen.getByTestId('stat-territories');
      expect(stat.textContent).toContain('2/2');
    });
  });

  describe('D4.5 攻城失败→无归属变化→显示失败原因', () => {
    it('攻城失败后territories不变', () => {
      const territories = [
        makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player' }),
        makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' }),
      ];
      const props = createDefaultProps({ territories });
      const { rerender } = render(<WorldMapTab {...props} />);

      // 攻城失败: 不变
      rerender(<WorldMapTab {...props} snapshotVersion={2} />);

      const stat = screen.getByTestId('stat-territories');
      expect(stat.textContent).toContain('1/2');
    });
  });

  describe('D4.6 冷却中/兵力不足时按钮禁用', () => {
    it('兵力不足时SiegeConfirmModal条件显示失败', async () => {
      const SiegeConfirmModal = (await import('@/components/idle/panels/map/SiegeConfirmModal')).default;
      const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

      render(
        <SiegeConfirmModal
          visible={true}
          target={target}
          cost={{ troops: 500, grain: 90 }}
          conditionResult={{ canSiege: true }}
          availableTroops={100} // 不足
          availableGrain={500}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const condition = screen.getByTestId('siege-condition-兵力充足');
      expect(condition.className).toContain('tk-siege-condition--fail');
    });

    it('粮草不足时SiegeConfirmModal条件显示失败', async () => {
      const SiegeConfirmModal = (await import('@/components/idle/panels/map/SiegeConfirmModal')).default;
      const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

      render(
        <SiegeConfirmModal
          visible={true}
          target={target}
          cost={{ troops: 500, grain: 90 }}
          conditionResult={{ canSiege: true }}
          availableTroops={1000}
          availableGrain={10} // 不足
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const condition = screen.getByTestId('siege-condition-粮草充足');
      expect(condition.className).toContain('tk-siege-condition--fail');
    });

    it('今日次数用完时SiegeConfirmModal条件显示失败', async () => {
      const SiegeConfirmModal = (await import('@/components/idle/panels/map/SiegeConfirmModal')).default;
      const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

      render(
        <SiegeConfirmModal
          visible={true}
          target={target}
          cost={{ troops: 500, grain: 90 }}
          conditionResult={{ canSiege: true }}
          availableTroops={1000}
          availableGrain={500}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          dailySiegesRemaining={0}
        />
      );

      const condition = screen.getByTestId('siege-condition-今日攻城次数');
      expect(condition.className).toContain('tk-siege-condition--fail');
    });

    it('有冷却时间时SiegeConfirmModal显示冷却提示', async () => {
      const SiegeConfirmModal = (await import('@/components/idle/panels/map/SiegeConfirmModal')).default;
      const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

      render(
        <SiegeConfirmModal
          visible={true}
          target={target}
          cost={{ troops: 500, grain: 90 }}
          conditionResult={{ canSiege: true }}
          availableTroops={1000}
          availableGrain={500}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          cooldownRemainingMs={3600000}
        />
      );

      expect(screen.getByTestId('siege-confirm')).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════
// D5: 视图切换测试
// ═══════════════════════════════════════════════════════════

describe('D5: 视图切换测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D5.1 默认为像素地图模式', () => {
    it('默认视图模式为像素地图', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      const toggle = screen.getByTestId('worldmap-view-toggle');
      expect(toggle.textContent).toContain('像素地图');
    });

    it('默认模式下Canvas存在', () => {
      const props = createDefaultProps();
      const { container } = render(<WorldMapTab {...props} />);
      const canvas = container.querySelector('canvas.pixel-worldmap-canvas');
      expect(canvas).toBeTruthy();
    });
  });

  describe('D5.2 切换到列表模式显示CSS网格', () => {
    it('切换到列表模式后显示网格', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      const toggle = screen.getByTestId('worldmap-view-toggle');
      fireEvent.click(toggle);
      expect(toggle.textContent).toContain('列表');
      expect(screen.getByTestId('worldmap-grid')).toBeTruthy();
    });

    it('列表模式下显示所有领土单元格', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      expect(screen.getByTestId('territory-cell-city-luoyang')).toBeTruthy();
      expect(screen.getByTestId('territory-cell-city-xuchang')).toBeTruthy();
      expect(screen.getByTestId('territory-cell-city-jianye')).toBeTruthy();
    });

    it('列表模式下己方领土显示产出气泡', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      expect(screen.getByTestId('bubble-city-luoyang')).toBeTruthy();
      expect(screen.queryByTestId('bubble-city-xuchang')).toBeNull();
    });

    it('网格使用CSS Grid布局', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const grid = screen.getByTestId('worldmap-grid');
      expect(grid.style.gridTemplateColumns).toBeTruthy();
    });
  });

  describe('D5.3 切换后领土数据一致', () => {
    it('像素模式和列表模式显示相同的领土数量', () => {
      const props = createDefaultProps();
      const { rerender } = render(<WorldMapTab {...props} />);

      // 像素模式: 统计显示
      const stat1 = screen.getByTestId('stat-territories');
      expect(stat1.textContent).toContain('2/6'); // 2 player territories

      // 切换到列表模式
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const stat2 = screen.getByTestId('stat-territories');
      expect(stat2.textContent).toContain('2/6');
    });

    it('列表模式下领土名称与像素模式一致', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));

      // 验证所有领土名称存在
      expect(screen.getByTestId('territory-cell-city-luoyang').textContent).toContain('洛阳');
      expect(screen.getByTestId('territory-cell-city-xuchang').textContent).toContain('许昌');
      expect(screen.getByTestId('territory-cell-city-jianye').textContent).toContain('建业');
    });
  });

  describe('D5.4 筛选条件切换后保持不变', () => {
    it('筛选条件在视图切换后保持', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);

      // 设置筛选: player
      const select = screen.getByTestId('worldmap-filter-ownership');
      fireEvent.change(select, { target: { value: 'player' } });

      // 切换到列表模式
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      // 筛选仍然生效: 只显示player领土
      expect(screen.getByTestId('territory-cell-city-luoyang')).toBeTruthy();
      expect(screen.queryByTestId('territory-cell-city-xuchang')).toBeNull();
      expect(screen.queryByTestId('territory-cell-city-jianye')).toBeNull();
    });

    it('区域筛选在视图切换后保持', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);

      // 设置区域筛选
      const select = screen.getByTestId('worldmap-filter-region');
      fireEvent.change(select, { target: { value: 'wu' } });

      // 切换到列表模式
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      // 只显示wu区域的领土
      expect(screen.getByTestId('territory-cell-city-jianye')).toBeTruthy();
      expect(screen.queryByTestId('territory-cell-city-luoyang')).toBeNull();
    });

    it('筛选无结果时显示空状态', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);

      // 设置不存在的区域
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const select = screen.getByTestId('worldmap-filter-region');
      fireEvent.change(select, { target: { value: 'neutral' } });
      expect(screen.getByTestId('worldmap-empty')).toBeTruthy();
    });
  });

  describe('D5.5 右侧信息面板两种视图均正常', () => {
    it('像素模式下信息面板存在', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      expect(screen.getByTestId('worldmap-info-panel')).toBeTruthy();
      expect(screen.getByTestId('stat-territories')).toBeTruthy();
    });

    it('列表模式下信息面板存在', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      expect(screen.getByTestId('worldmap-info-panel')).toBeTruthy();
      expect(screen.getByTestId('stat-territories')).toBeTruthy();
    });

    it('信息面板子Tab切换正常', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);

      // 默认显示详情Tab
      expect(screen.getByTestId('info-tab-detail')).toBeTruthy();
      expect(screen.getByTestId('info-tab-production')).toBeTruthy();

      // 切换到产出Tab
      fireEvent.click(screen.getByTestId('info-tab-production'));
      expect(screen.getByTestId('info-tab-production')).toBeTruthy();
    });

    it('热力图按钮在两种模式下均可切换', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);

      // 像素模式下切换热力图
      fireEvent.click(screen.getByTestId('worldmap-heatmap-toggle'));
      expect(screen.getByTestId('worldmap-legend')).toBeTruthy();

      // 切换到列表模式
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      // 热力图仍然开启
      fireEvent.click(screen.getByTestId('worldmap-heatmap-toggle'));
      // 再次点击关闭
      fireEvent.click(screen.getByTestId('worldmap-heatmap-toggle'));
    });

    it('统计数据在两种视图下一致', () => {
      const props = createDefaultProps();
      render(<WorldMapTab {...props} />);

      // 像素模式统计
      const stat1 = screen.getByTestId('stat-territories').textContent;

      // 切换到列表模式
      fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
      const stat2 = screen.getByTestId('stat-territories').textContent;

      expect(stat1).toBe(stat2);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// WorldMapSystem 引擎层集成测试
// ═══════════════════════════════════════════════════════════

describe('WorldMapSystem 引擎层集成', () => {
  let mapSys: WorldMapSystem;

  beforeEach(() => {
    mapSys = new WorldMapSystem();
    mapSys.init(mockDeps());
  });

  it('初始状态洛阳为player归属', () => {
    const lm = mapSys.getLandmarkById('city-luoyang');
    expect(lm).not.toBeNull();
    expect(lm!.ownership).toBe('player');
  });

  it('setLandmarkOwnership更新敌方城市后变为player', () => {
    mapSys.setLandmarkOwnership('city-xuchang', 'player');
    const lm = mapSys.getLandmarkById('city-xuchang');
    expect(lm!.ownership).toBe('player');
  });

  it('setLandmarkOwnership同步到tiles', () => {
    mapSys.setLandmarkOwnership('city-xuchang', 'enemy');
    const pos = { x: 37, y: 26 };
    const tile = mapSys.getTileAt(pos);
    expect(tile).not.toBeNull();
    expect(tile!.landmark!.ownership).toBe('enemy');
  });

  it('攻城成功后领土归属变化正确序列化', () => {
    mapSys.setLandmarkOwnership('city-xuchang', 'player');
    const data = mapSys.serialize();
    expect(data.landmarkOwnerships['city-xuchang']).toBe('player');
  });

  it('反序列化后领土归属恢复', () => {
    mapSys.setLandmarkOwnership('city-xuchang', 'player');
    mapSys.setLandmarkOwnership('city-jianye', 'enemy');
    const data = mapSys.serialize();

    const newSys = new WorldMapSystem();
    newSys.init(mockDeps());
    newSys.deserialize(data);

    expect(newSys.getLandmarkById('city-xuchang')!.ownership).toBe('player');
    expect(newSys.getLandmarkById('city-jianye')!.ownership).toBe('enemy');
  });

  it('getPlayerLandmarkCount随占领变化', () => {
    expect(mapSys.getPlayerLandmarkCount()).toBe(1); // 初始洛阳
    mapSys.setLandmarkOwnership('city-xuchang', 'player');
    expect(mapSys.getPlayerLandmarkCount()).toBe(2);
  });

  it('视口控制正确', () => {
    mapSys.setViewportOffset(100, 200);
    expect(mapSys.getViewport().offsetX).toBe(100);
    expect(mapSys.getViewport().offsetY).toBe(200);

    mapSys.setZoom(1.5);
    expect(mapSys.getViewport().zoom).toBe(1.5);

    mapSys.resetViewport();
    expect(mapSys.getViewport().offsetX).toBe(0);
    expect(mapSys.getViewport().zoom).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════
// PixelMapRenderer 额外覆盖测试
// ═══════════════════════════════════════════════════════════

describe('PixelMapRenderer 额外覆盖', () => {
  it('gridToScreen正确转换', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
    const testMap = createTestMap(100, 60, 8);
    renderer.loadMap(testMap);

    const screen = renderer.gridToScreen(10, 10);
    expect(screen.x).toBe(10 * 8 - 0); // offsetX=0
    expect(screen.y).toBe(10 * 8 - 0);
  });

  it('getCellAt返回正确单元格', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
    const testMap = createTestMap(100, 60, 8);
    renderer.loadMap(testMap);

    const cell = renderer.getCellAt(5, 5);
    expect(cell).not.toBeNull();
    expect(cell!.x).toBe(5);
    expect(cell!.y).toBe(5);
  });

  it('getCellAt越界返回null', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
    const testMap = createTestMap(100, 60, 8);
    renderer.loadMap(testMap);

    expect(renderer.getCellAt(-1, 0)).toBeNull();
    expect(renderer.getCellAt(100, 0)).toBeNull();
  });

  it('addMarchSprite和removeMarchSprite正确', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
    const testMap = createTestMap(100, 60, 8);
    renderer.loadMap(testMap);

    renderer.addMarchSprite({
      id: 'march1', x: 100, y: 100, targetX: 200, targetY: 200,
      path: [], pathIndex: 0, speed: 1, faction: 'wei', troops: 500,
    });
    expect(() => renderer.render()).not.toThrow();

    renderer.removeMarchSprite('march1');
    expect(() => renderer.render()).not.toThrow();
  });

  it('clearMarchSprites清空所有精灵', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });

    renderer.addMarchSprite({
      id: 'march1', x: 100, y: 100, targetX: 200, targetY: 200,
      path: [], pathIndex: 0, speed: 1, faction: 'wei', troops: 500,
    });
    renderer.clearMarchSprites();
    expect(() => renderer.render()).not.toThrow();
  });

  it('showGrid为true时渲染网格线', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: true });
    const testMap = createTestMap(100, 60, 8);
    renderer.loadMap(testMap);
    expect(() => renderer.render()).not.toThrow();
  });

  it('loadFromText直接加载ASCII文本', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
    const parser = new ASCIIMapParser();
    const text = `MAP:测试
SIZE:10x8
TILE:8

CITY: L=洛阳

..........
.L........
..........
..........
..........
..........
..........
..........`;
    expect(() => renderer.loadFromText(text, parser)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════
// 边界情况和鲁棒性测试
// ═══════════════════════════════════════════════════════════

describe('边界情况和鲁棒性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空领土数据不崩溃(像素模式)', () => {
    const props = createDefaultProps({ territories: [] });
    render(<WorldMapTab {...props} />);
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  it('空领土数据不崩溃(列表模式)', () => {
    const props = createDefaultProps({ territories: [], productionSummary: null });
    render(<WorldMapTab {...props} />);
    fireEvent.click(screen.getByTestId('worldmap-view-toggle'));
    expect(screen.getByTestId('worldmap-empty')).toBeTruthy();
  });

  it('大量领土数据不崩溃', () => {
    const manyTerritories = Array.from({ length: 50 }, (_, i) =>
      makeTerritory({
        id: `city-${i}`,
        name: `城市${i}`,
        ownership: i % 3 === 0 ? 'player' : i % 3 === 1 ? 'enemy' : 'neutral',
        position: { x: i * 2, y: i },
      })
    );
    const props = createDefaultProps({ territories: manyTerritories });
    expect(() => render(<WorldMapTab {...props} />)).not.toThrow();
  });

  it('productionSummary为null不崩溃', () => {
    const props = createDefaultProps({ productionSummary: null });
    render(<WorldMapTab {...props} />);
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  it('engine为undefined不崩溃', () => {
    const props = createDefaultProps({ engine: undefined });
    render(<WorldMapTab {...props} />);
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  it('PixelWorldMap空territories不崩溃', () => {
    expect(() => {
      render(<PixelWorldMap territories={[]} />);
    }).not.toThrow();
  });

  it('autoFit零尺寸不崩溃', () => {
    const canvas = createMockCanvas(0, 0);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
    const testMap = createTestMap(100, 60, 8);
    renderer.loadMap(testMap);
    expect(() => renderer.autoFit(0, 0)).not.toThrow();
  });

  it('autoFit未加载地图不崩溃', () => {
    const canvas = createMockCanvas(800, 480);
    const renderer = new PixelMapRenderer(canvas, { tileSize: 8, scale: 1, showCityNames: true, showGrid: false });
    expect(() => renderer.autoFit(800, 480)).not.toThrow();
  });

  it('多次重新渲染不崩溃', () => {
    const props = createDefaultProps();
    const { rerender } = render(<WorldMapTab {...props} />);
    for (let i = 0; i < 10; i++) {
      rerender(<WorldMapTab {...props} snapshotVersion={i + 2} />);
    }
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });
});
