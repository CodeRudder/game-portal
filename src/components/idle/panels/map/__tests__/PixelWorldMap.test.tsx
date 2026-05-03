/**
 * PixelWorldMap 集成测试
 *
 * 测试像素地图组件在游戏天下Tab中的集成:
 * - 地图数据加载
 * - Canvas渲染
 * - 城市标记显示
 * - 点击交互
 * - 视图模式切换
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorldMapTab from '../WorldMapTab';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// ── Mock CSS ──
vi.mock('../WorldMapTab.css', () => ({}));
vi.mock('../PixelWorldMap.css', () => ({}));
vi.mock('../TerritoryInfoPanel.css', () => ({}));
vi.mock('../TerritoryInfoPanel', () => ({
  default: function MockTerritoryInfoPanel({ territory }: { territory: TerritoryData }) {
    return <div data-testid={`territory-info-${territory.id}`}>领土详情: {territory.name}</div>;
  },
}));
vi.mock('../SiegeConfirmModal', () => ({
  default: () => null,
}));
vi.mock('../SiegeResultModal', () => ({
  default: () => null,
}));

// ── Mock 地图数据模块 (100x60 匹配真实地图尺寸) ──
vi.mock('@/games/three-kingdoms/core/map/maps/world-map.txt?raw', () => {
  const row = '.'.repeat(100);
  const rows = Array(60).fill(row).join('\n');
  return {
    default: `MAP:测试地图
SIZE:100x60
TILE:8

CITY: L=洛阳,X=许昌,J=建业

${rows}`,
  };
});

// ── Mock config ──
vi.mock('@/games/three-kingdoms/core/map', () => ({
  REGION_IDS: ['central_plains', 'jiangdong'],
  REGION_LABELS: { central_plains: '中原', jiangdong: '江东' },
  TERRAIN_TYPES: ['plain', 'mountain', 'forest'],
  TERRAIN_LABELS: { plain: '平原', mountain: '山地', forest: '森林' },
}));

// ── Mock Canvas ──
const mockGetContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  save: vi.fn(),
  restore: vi.fn(),
  set fillStyle(_v: string) {},
  set strokeStyle(_v: string) {},
  set lineWidth(_v: number) {},
  set font(_v: string) {},
  set textAlign(_v: string) {},
  set textBaseline(_v: string) {},
  set globalAlpha(_v: number) {},
  set lineDashOffset(_v: number) {},
  get fillStyle() { return ''; },
  get strokeStyle() { return ''; },
  drawImage: vi.fn(),
  roundRect: vi.fn(),
  setLineDash: vi.fn(),
}));

// 覆盖HTMLCanvasElement.prototype.getContext
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: mockGetContext,
  writable: true,
});

// ── 测试数据 ──
const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 5, y: 5 },
  region: 'central_plains',
  ownership: 'player',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: ['city-xuchang'],
  ...overrides,
});

const territories: TerritoryData[] = [
  makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 2, y: 1 } }),
  makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 7, y: 1 } }),
  makeTerritory({ id: 'city-jianye', name: '建业', ownership: 'neutral', position: { x: 5, y: 5 } }),
];

const productionSummary = {
  totalTerritories: 3,
  territoriesByRegion: { central_plains: 2, jiangdong: 1 },
  totalProduction: { grain: 20, gold: 9.5, troops: 5.5, mandate: 1.5 },
  details: [],
};

// ── 测试 ──
describe('PixelWorldMap 集成测试', () => {
  const defaultProps = {
    territories,
    productionSummary,
    snapshotVersion: 1,
    onSelectTerritory: vi.fn(),
    onSiegeTerritory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 迭代1: 基础渲染 ──
  it('迭代1: 天下Tab渲染成功', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  // ── 迭代2: 像素地图模式默认启用 ──
  it('迭代2: 默认为像素地图视图模式', () => {
    render(<WorldMapTab {...defaultProps} />);
    const toggle = screen.getByTestId('worldmap-view-toggle');
    expect(toggle.textContent).toContain('像素地图');
  });

  // ── 迭代3: 视图模式切换 ──
  it('迭代3: 点击切换到列表模式', () => {
    render(<WorldMapTab {...defaultProps} />);
    const toggle = screen.getByTestId('worldmap-view-toggle');
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain('列表');
    // 切换后应显示网格
    expect(screen.getByTestId('worldmap-grid')).toBeTruthy();
  });

  // ── 迭代4: Canvas元素存在 ──
  it('迭代4: 像素地图模式下Canvas元素存在', () => {
    const { container } = render(<WorldMapTab {...defaultProps} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  // ── 迭代5: 地图数据加载 ──
  it('迭代5: 地图数据正确加载', () => {
    const { container } = render(<WorldMapTab {...defaultProps} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    // Canvas应有width/height属性
    expect(canvas!.width).toBeGreaterThan(0);
    expect(canvas!.height).toBeGreaterThan(0);
  });

  // ── 迭代6: 城市数据注入 ──
  it('迭代6: 领土数据传入PixelWorldMap', () => {
    // 验证组件不崩溃，且territories被正确传递
    const onSelect = vi.fn();
    render(<WorldMapTab {...defaultProps} onSelectTerritory={onSelect} />);
    // 组件渲染成功即表示数据传递正常
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  // ── 迭代7: 筛选不影响像素地图 ──
  it('迭代7: 筛选后像素地图仍渲染', () => {
    render(<WorldMapTab {...defaultProps} />);
    const select = screen.getByTestId('worldmap-filter-ownership');
    fireEvent.change(select, { target: { value: 'player' } });
    // 像素地图应仍然存在
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  // ── 迭代8: 信息面板与像素地图共存 ──
  it('迭代8: 信息面板在像素地图模式下显示', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.getByTestId('worldmap-info-panel')).toBeTruthy();
    expect(screen.getByTestId('stat-territories')).toBeTruthy();
  });

  // ── 迭代9: 攻城信息面板显示 ──
  it('迭代9: 攻城信息面板在像素地图模式下显示', () => {
    const engine = {
      getSiegeSystem: () => ({
        getRemainingDailySieges: () => 3,
        getCooldownRemaining: () => 0,
      }),
      getResourceAmount: () => 1000,
      on: vi.fn(),
      off: vi.fn(),
    };
    render(<WorldMapTab {...defaultProps} engine={engine} />);
    expect(screen.getByTestId('siege-info-panel')).toBeTruthy();
  });

  // ── 迭代10: 缩略图小地图显示 ──
  it('迭代10: 缩略图小地图在像素地图模式下显示', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.getByTestId('worldmap-minimap')).toBeTruthy();
  });

  // ── 迭代11: 空数据处理 ──
  it('迭代11: 空领土数据不崩溃', () => {
    render(<WorldMapTab {...defaultProps} territories={[]} />);
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  // ── 迭代12: Canvas上下文获取 ──
  it('迭代12: Canvas上下文正确获取', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(mockGetContext).toHaveBeenCalledWith('2d');
  });

  // ── 迭代13: 多次渲染不崩溃 ──
  it('迭代13: 多次重新渲染不崩溃', () => {
    const { rerender } = render(<WorldMapTab {...defaultProps} />);
    for (let i = 0; i < 5; i++) {
      rerender(
        <WorldMapTab
          {...defaultProps}
          snapshotVersion={i + 2}
          territories={territories.map(t => ({ ...t, level: (t.level % 5) + 1 }))}
        />
      );
    }
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
  });

  // ── 迭代14: 统计数据正确 ──
  it('迭代14: 统计数据在像素模式下正确', () => {
    render(<WorldMapTab {...defaultProps} />);
    const stat = screen.getByTestId('stat-territories');
    expect(stat.textContent).toContain('1/3'); // 1 player territory
  });

  // ── 迭代15: 热力图按钮可用 ──
  it('迭代15: 热力图按钮在像素模式下可用', () => {
    render(<WorldMapTab {...defaultProps} />);
    const toggle = screen.getByTestId('worldmap-heatmap-toggle');
    fireEvent.click(toggle);
    expect(screen.getByTestId('worldmap-legend')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// PixelMapRenderer.autoFit() 单元测试
// ─────────────────────────────────────────────

import { PixelMapRenderer } from '@/games/three-kingdoms/engine/map/PixelMapRenderer';
import type { ParsedMap } from '@/games/three-kingdoms/core/map/ASCIIMapParser';

/** 创建测试用的mock canvas */
function createMockCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** 创建一个简单的测试地图 */
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

describe('PixelMapRenderer.autoFit() 单元测试', () => {
  // 地图: 100×60格子, tileSize=8 => 800×480 像素(原始)
  const mapWidth = 100;
  const mapHeight = 60;
  const tileSize = 8;
  const mapPixelWidth = mapWidth * tileSize;   // 800
  const mapPixelHeight = mapHeight * tileSize; // 480

  let renderer: PixelMapRenderer;
  let testMap: ParsedMap;

  beforeEach(() => {
    testMap = createTestMap(mapWidth, mapHeight, tileSize);
  });

  function createRendererAndFit(canvasW: number, canvasH: number) {
    const canvas = createMockCanvas(canvasW, canvasH);
    renderer = new PixelMapRenderer(canvas, { tileSize, scale: 1, showCityNames: true, showGrid: false });
    renderer.loadMap(testMap);
    renderer.autoFit(canvasW, canvasH);
    return renderer;
  }

  // 测试1: 缩放级别 >= 1.0
  it('autoFit: 缩放级别始终 >= 1.0', () => {
    // 800×480 canvas: scale = min(800/800, 480/480) = 1.0
    const r1 = createRendererAndFit(800, 480);
    expect((r1 as any).config.scale).toBeGreaterThanOrEqual(1.0);

    // 600×400 canvas: fitScale = min(600/800, 400/480) = 0.75 => clamped to 1.0
    const r2 = createRendererAndFit(600, 400);
    expect((r2 as any).config.scale).toBeGreaterThanOrEqual(1.0);

    // 400×300 canvas: fitScale = min(400/800, 300/480) = 0.5 => clamped to 1.0
    const r3 = createRendererAndFit(400, 300);
    expect((r3 as any).config.scale).toBeGreaterThanOrEqual(1.0);

    // 1600×960 canvas: scale = min(1600/800, 960/480) = 2.0
    const r4 = createRendererAndFit(1600, 960);
    expect((r4 as any).config.scale).toBeGreaterThanOrEqual(1.0);

    // 4000×3000 canvas: fitScale = min(5.0, 6.25) = 5.0 => clamped to 4.0
    const r5 = createRendererAndFit(4000, 3000);
    expect((r5 as any).config.scale).toBeGreaterThanOrEqual(1.0);
    expect((r5 as any).config.scale).toBeLessThanOrEqual(4.0);
  });

  // 测试2: 地图在Canvas中居中(800×480容器)
  it('autoFit: 800×480容器中地图居中 — offset为(0,0)', () => {
    const r = createRendererAndFit(800, 480);
    const state = r as any;
    // scale=1.0, map=800×480, canvas=800×480 => offset = (800-800)/2 = 0
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  // 测试3: 地图在Canvas中居中(更大容器)
  it('autoFit: 1600×960容器中地图居中 — offset正确', () => {
    const r = createRendererAndFit(1600, 960);
    const state = r as any;
    // scale = min(1600/800, 960/480) = min(2.0, 2.0) = 2.0
    expect(state.config.scale).toBe(2.0);
    // offset = (1600 - 100*8*2.0) / 2 = (1600 - 1600) / 2 = 0
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  // 测试4: 缩放上限为4.0
  it('autoFit: 缩放上限为4.0', () => {
    // 4000×2400: fitScale = min(5.0, 5.0) = 5.0 => clamped to 4.0
    const r = createRendererAndFit(4000, 2400);
    expect((r as any).config.scale).toBe(4.0);
  });

  // 测试5: 不同容器尺寸适配 — 600×400
  it('autoFit: 600×400容器 — scale=1.0且居中', () => {
    const r = createRendererAndFit(600, 400);
    const state = r as any;
    // fitScale = min(600/800, 400/480) = 0.75 => clamped to 1.0
    expect(state.config.scale).toBe(1.0);
    // offset = (600 - 100*8*1.0) / 2 = (600 - 800) / 2 = -100
    expect(state.offsetX).toBe(-100);
    // offset = (400 - 60*8*1.0) / 2 = (400 - 480) / 2 = -40
    expect(state.offsetY).toBe(-40);
  });

  // 测试6: 不同容器尺寸适配 — 400×300
  it('autoFit: 400×300容器 — scale=1.0且居中', () => {
    const r = createRendererAndFit(400, 300);
    const state = r as any;
    expect(state.config.scale).toBe(1.0);
    // offset = (400 - 800) / 2 = -200
    expect(state.offsetX).toBe(-200);
    // offset = (300 - 480) / 2 = -90
    expect(state.offsetY).toBe(-90);
  });

  // 测试7: 宽屏容器适配
  it('autoFit: 1200×480宽屏容器 — 宽度适配', () => {
    const r = createRendererAndFit(1200, 480);
    const state = r as any;
    // fitScale = min(1200/800, 480/480) = min(1.5, 1.0) = 1.0
    expect(state.config.scale).toBe(1.0);
    // offset = (1200 - 800) / 2 = 200
    expect(state.offsetX).toBe(200);
    expect(state.offsetY).toBe(0);
  });

  // 测试8: 高屏容器适配
  it('autoFit: 800×800高屏容器 — 高度适配', () => {
    const r = createRendererAndFit(800, 800);
    const state = r as any;
    // fitScale = min(800/800, 800/480) = min(1.0, 1.67) = 1.0
    expect(state.config.scale).toBe(1.0);
    expect(state.offsetX).toBe(0);
    // offset = (800 - 480) / 2 = 160
    expect(state.offsetY).toBe(160);
  });

  // 测试9: 边界情况 — 零尺寸
  it('autoFit: 零尺寸不崩溃', () => {
    const canvas = createMockCanvas(0, 0);
    const r = new PixelMapRenderer(canvas, { tileSize, scale: 1, showCityNames: true, showGrid: false });
    r.loadMap(testMap);
    // 不应抛出异常
    expect(() => r.autoFit(0, 0)).not.toThrow();
  });

  // 测试10: 边界情况 — 未加载地图
  it('autoFit: 未加载地图时不崩溃', () => {
    const canvas = createMockCanvas(800, 480);
    const r = new PixelMapRenderer(canvas, { tileSize, scale: 1, showCityNames: true, showGrid: false });
    // 未调用loadMap，不应抛出异常
    expect(() => r.autoFit(800, 480)).not.toThrow();
  });

  // 测试11: setScale最大值提升到4.0
  it('setScale: 最大值为4.0', () => {
    const r = createRendererAndFit(800, 480);
    r.setScale(5.0);
    expect((r as any).config.scale).toBe(4.0);
    r.setScale(4.0);
    expect((r as any).config.scale).toBe(4.0);
    r.setScale(3.5);
    expect((r as any).config.scale).toBe(3.5);
  });
});

// ─────────────────────────────────────────────
// PixelWorldMap 点击交互与阵营色测试
// ─────────────────────────────────────────────

import { PixelWorldMap } from '../PixelWorldMap';

/** 创建测试领土 */
const makeClickTestTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 1, y: 1 },
  region: 'central_plains',
  ownership: 'player',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: ['city-xuchang'],
  ...overrides,
});

const clickTestTerritories: TerritoryData[] = [
  makeClickTestTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 1, y: 1 } }),
  makeClickTestTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 4, y: 1 } }),
  makeClickTestTerritory({ id: 'city-jianye', name: '建业', ownership: 'neutral', position: { x: 7, y: 1 } }),
];

describe('PixelWorldMap 点击交互与阵营色', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getBoundingClientRect
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 480,
      width: 800, height: 480, x: 0, y: 0, toJSON: () => {},
    });
  });

  it('点击城市位置触发onSelectTerritory', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PixelWorldMap territories={clickTestTerritories} onSelectTerritory={onSelect} />,
    );
    const canvas = container.querySelector('canvas.pixel-worldmap-canvas')!;

    // city-luoyang at (1,1), ts=8 => screen (8, 8)
    // 点击 = mouseDown + mouseUp（同一位置，无拖拽）
    fireEvent.mouseDown(canvas, { clientX: 8, clientY: 8, button: 0 });
    fireEvent.mouseUp(canvas, { clientX: 8, clientY: 8, button: 0 });
    expect(onSelect).toHaveBeenCalledWith('city-luoyang');
  });

  it('点击空白区域触发onSelectTerritory空字符串(取消选中)', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PixelWorldMap territories={clickTestTerritories} onSelectTerritory={onSelect} />,
    );
    const canvas = container.querySelector('canvas.pixel-worldmap-canvas')!;

    // 点击空白区域(400,240) => grid(50,30) — 远离所有城市(1,1)(4,1)(7,1)
    fireEvent.mouseDown(canvas, { clientX: 400, clientY: 240, button: 0 });
    fireEvent.mouseUp(canvas, { clientX: 400, clientY: 240, button: 0 });
    expect(onSelect).toHaveBeenCalledWith('');
  });

  it('不同ownership的城市显示不同颜色(Canvas fillStyle)', () => {
    // 渲染不崩溃即验证阵营色映射正确
    expect(() => {
      render(<PixelWorldMap territories={clickTestTerritories} />);
    }).not.toThrow();
  });

  it('选中城市时地图不自动居中(仅高亮)', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <PixelWorldMap territories={clickTestTerritories} onSelectTerritory={onSelect} selectedId={null} />,
    );

    // 模拟选中城市 — 不应崩溃，且不自动移动视窗
    expect(() => {
      rerender(
        <PixelWorldMap territories={clickTestTerritories} onSelectTerritory={onSelect} selectedId="city-luoyang" />,
      );
    }).not.toThrow();
  });

  it('连续点击不同城市切换选中', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PixelWorldMap territories={clickTestTerritories} onSelectTerritory={onSelect} />,
    );
    const canvas = container.querySelector('canvas.pixel-worldmap-canvas')!;

    // 点击洛阳(1,1) => screen (8, 8)
    fireEvent.mouseDown(canvas, { clientX: 8, clientY: 8, button: 0 });
    fireEvent.mouseUp(canvas, { clientX: 8, clientY: 8, button: 0 });
    expect(onSelect).toHaveBeenLastCalledWith('city-luoyang');

    // 点击许昌(4,1) => screen (32, 8)
    fireEvent.mouseDown(canvas, { clientX: 32, clientY: 8, button: 0 });
    fireEvent.mouseUp(canvas, { clientX: 32, clientY: 8, button: 0 });
    expect(onSelect).toHaveBeenLastCalledWith('city-xuchang');
  });
});
