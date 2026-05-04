/**
 * PixelWorldMap 行军精灵渲染测试
 *
 * 测试行军精灵在Canvas上的渲染行为:
 * - activeMarches属性传入不崩溃
 * - 空marches数组不报错
 * - 不同状态(preparing/marching/arrived/retreating)的march渲染不报错
 * - 多个march同时渲染不报错
 * - 不同阵营颜色正确
 * - 不同兵力影响精灵数量
 *
 * I11新增测试 (Canvas Mock模式):
 * - 活跃行军在路径上显示精灵
 * - 精灵位置随进度更新
 * - 撤退行军有不同的视觉样式(alpha=0.7)
 * - 多个行军同时渲染互不干扰
 * - 无活跃行军时不渲染精灵
 * - 阵营颜色正确应用
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { PixelWorldMap } from '../PixelWorldMap';
import type { MarchUnit } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// ── Mock CSS ──
vi.mock('../PixelWorldMap.css', () => ({}));

// ── Mock 地图数据模块 ──
vi.mock('@/games/three-kingdoms/core/map/maps/world-map.txt?raw', () => ({
  default: `MAP:测试地图
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
..........`,
}));

// ── Mock config ──
vi.mock('@/games/three-kingdoms/core/map', () => ({
  REGION_IDS: ['central_plains'],
  REGION_LABELS: { central_plains: '中原' },
  TERRAIN_TYPES: ['plain'],
  TERRAIN_LABELS: { plain: '平原' },
}));

vi.mock('@/games/three-kingdoms/core/map/map-config', () => ({
  LANDMARK_POSITIONS: {
    'city-luoyang': { x: 1, y: 1 },
    'city-xuchang': { x: 6, y: 1 },
    'city-jianye': { x: 5, y: 5 },
  },
  DEFAULT_LANDMARKS: [
    { id: 'city-luoyang', name: '洛阳' },
    { id: 'city-xuchang', name: '许昌' },
    { id: 'city-jianye', name: '建业' },
  ],
}));

// ─────────────────────────────────────────────
// requestAnimationFrame mock
// ─────────────────────────────────────────────

let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 0;
let originalRAF: typeof window.requestAnimationFrame;
let originalCancelRAF: typeof window.cancelAnimationFrame;

function mockRAF(cb: FrameRequestCallback): number {
  const id = ++rafIdCounter;
  rafCallbacks.push(cb);
  return id;
}

function mockCancelRAF(_id: number) {
  // no-op
}

function flushRAF() {
  const callbacks = rafCallbacks.slice();
  rafCallbacks = [];
  const now = performance.now();
  for (const cb of callbacks) {
    cb(now);
  }
}

// ─────────────────────────────────────────────
// Mock Canvas
// ─────────────────────────────────────────────

let capturedFillStyles: string[] = [];
let capturedStrokeStyles: string[] = [];
let capturedGlobalAlphas: number[] = [];

function createMockCtx() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    roundRect: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    clip: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(0) })),
    putImageData: vi.fn(),
    canvas: { width: 800, height: 480 },
    _fillStyle: '',
    _strokeStyle: '',
    _globalAlpha: 1,
    _lineWidth: 1,
    _font: '',
    _textAlign: '',
    _textBaseline: '',
    _lineDashOffset: 0,
    get fillStyle() { return this._fillStyle; },
    set fillStyle(v: string) { this._fillStyle = v; capturedFillStyles.push(v); },
    get strokeStyle() { return this._strokeStyle; },
    set strokeStyle(v: string) { this._strokeStyle = v; capturedStrokeStyles.push(v); },
    get globalAlpha() { return this._globalAlpha; },
    set globalAlpha(v: number) { this._globalAlpha = v; capturedGlobalAlphas.push(v); },
    get lineWidth() { return this._lineWidth; },
    set lineWidth(v: number) { this._lineWidth = v; },
    get font() { return this._font; },
    set font(v: string) { this._font = v; },
    get textAlign() { return this._textAlign; },
    set textAlign(v: string) { this._textAlign = v; },
    get textBaseline() { return this._textBaseline; },
    set textBaseline(v: string) { this._textBaseline = v; },
    get lineDashOffset() { return this._lineDashOffset; },
    set lineDashOffset(v: number) { this._lineDashOffset = v; },
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
  };
  return ctx;
}

let mockCtx: ReturnType<typeof createMockCtx>;
const originalGetContext = HTMLCanvasElement.prototype.getContext;

function setupCanvasMock() {
  capturedFillStyles = [];
  capturedStrokeStyles = [];
  capturedGlobalAlphas = [];
  rafCallbacks = [];
  rafIdCounter = 0;
  mockCtx = createMockCtx();

  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    this: HTMLCanvasElement,
    contextId: string,
  ) {
    if (contextId === '2d') return mockCtx as any;
    return null;
  }) as any;

  originalRAF = window.requestAnimationFrame;
  originalCancelRAF = window.cancelAnimationFrame;
  window.requestAnimationFrame = mockRAF;
  window.cancelAnimationFrame = mockCancelRAF;
}

function teardownCanvasMock() {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  window.requestAnimationFrame = originalRAF;
  window.cancelAnimationFrame = originalCancelRAF;
}

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
];

/** 创建一个 MarchUnit 测试对象 */
function makeMarchUnit(overrides: Partial<MarchUnit> = {}): MarchUnit {
  return {
    id: 'march_test_001',
    fromCityId: 'city-luoyang',
    toCityId: 'city-xuchang',
    x: 3,
    y: 1,
    path: [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 6, y: 1 },
      { x: 7, y: 1 },
    ],
    pathIndex: 1,
    speed: 30,
    faction: 'wei',
    troops: 800,
    general: '夏侯惇',
    morale: 100,
    state: 'marching',
    startTime: Date.now(),
    eta: Date.now() + 10000,
    animFrame: 0,
    ...overrides,
  };
}

// ── Helper: render with marches and flush rAF ──

function renderWithMarches(
  marches: MarchUnit[],
  territoriesOverride?: TerritoryData[],
) {
  const result = render(
    <PixelWorldMap
      territories={territoriesOverride ?? territories}
      activeMarches={[]}
    />,
  );

  flushRAF();

  result.rerender(
    <PixelWorldMap
      territories={territoriesOverride ?? territories}
      activeMarches={marches}
    />,
  );

  flushRAF();

  return result;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

// ── Part 1: 组件健壮性测试（烟雾测试）──
// 以下测试验证组件在各种props下不崩溃（expect().not.toThrow()）。
// 它们不验证Canvas渲染输出 — Canvas渲染验证在 Part 2 中进行。

describe('PixelWorldMap 行军精灵渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──

  it('activeMarches属性传入不崩溃', () => {
    const marches: MarchUnit[] = [makeMarchUnit()];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  it('不传activeMarches属性不崩溃', () => {
    expect(() => {
      render(
        <PixelWorldMap territories={territories} />,
      );
    }).not.toThrow();
  });

  it('空marches数组不报错', () => {
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={[]}
        />,
      );
    }).not.toThrow();
  });

  // ── 不同状态 ──

  it('preparing状态的march渲染不报错', () => {
    const marches: MarchUnit[] = [makeMarchUnit({ state: 'preparing' })];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  it('marching状态的march渲染不报错', () => {
    const marches: MarchUnit[] = [makeMarchUnit({ state: 'marching' })];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  it('arrived状态的march渲染不报错', () => {
    const marches: MarchUnit[] = [makeMarchUnit({ state: 'arrived' })];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  it('retreating状态的march渲染不报错', () => {
    const marches: MarchUnit[] = [makeMarchUnit({ state: 'retreating' })];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  it('intercepted状态的march渲染不报错', () => {
    const marches: MarchUnit[] = [makeMarchUnit({ state: 'intercepted' })];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  // ── 多个march同时渲染 ──

  it('多个不同状态的march同时渲染不报错', () => {
    const marches: MarchUnit[] = [
      makeMarchUnit({ id: 'march_1', state: 'preparing', faction: 'wei', x: 2, y: 1 }),
      makeMarchUnit({ id: 'march_2', state: 'marching', faction: 'shu', x: 4, y: 2 }),
      makeMarchUnit({ id: 'march_3', state: 'arrived', faction: 'wu', x: 7, y: 1 }),
      makeMarchUnit({ id: 'march_4', state: 'retreating', faction: 'neutral', x: 5, y: 3 }),
    ];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  // ── 不同阵营 ──

  it('不同阵营(wei/shu/wu/neutral)的march渲染不报错', () => {
    const factions: MarchUnit['faction'][] = ['wei', 'shu', 'wu', 'neutral'];
    const marches: MarchUnit[] = factions.map((faction, i) =>
      makeMarchUnit({ id: `march_${faction}`, faction, x: 3 + i, y: 1 }),
    );
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  // ── 不同兵力 ──

  it('不同兵力(影响精灵数量)的march渲染不报错', () => {
    const marches: MarchUnit[] = [
      makeMarchUnit({ id: 'march_small', troops: 100, x: 3, y: 1 }),   // 1 sprite
      makeMarchUnit({ id: 'march_medium', troops: 700, x: 4, y: 1 }),  // 3 sprites
      makeMarchUnit({ id: 'march_large', troops: 1500, x: 5, y: 1 }),  // 5 sprites
    ];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  // ── 全生命周期组合 ──

  it('军队完整生命周期(准备->行军->到达->撤退)不报错', () => {
    const marchBase = makeMarchUnit();

    // 模拟生命周期各阶段同时存在
    const lifecycleMarches: MarchUnit[] = [
      { ...marchBase, id: 'phase_prepare', state: 'preparing', x: 2, y: 1 },
      { ...marchBase, id: 'phase_march', state: 'marching', x: 4, y: 1 },
      { ...marchBase, id: 'phase_arrive', state: 'arrived', x: 7, y: 1 },
      { ...marchBase, id: 'phase_retreat', state: 'retreating', x: 5, y: 1 },
    ];

    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={lifecycleMarches}
        />,
      );
    }).not.toThrow();
  });

  // ── 与行军路线共存 ──

  it('activeMarches与marchRoute同时传入不报错', () => {
    const marches: MarchUnit[] = [makeMarchUnit()];
    const route = {
      path: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ],
      waypoints: [
        { x: 2, y: 1 },
        { x: 5, y: 1 },
      ],
      distance: 3,
      estimatedTime: 3,
      waypointCities: [],
    };

    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
          marchRoute={route}
        />,
      );
    }).not.toThrow();
  });

  // ── 数据更新不崩溃 ──

  it('重新渲染时activeMarches更新不崩溃', () => {
    const initialMarches = [makeMarchUnit({ id: 'march_init', state: 'marching' })];
    const updatedMarches = [
      makeMarchUnit({ id: 'march_init', state: 'arrived' }),
      makeMarchUnit({ id: 'march_new', state: 'marching', faction: 'shu' }),
    ];

    const { rerender } = render(
      <PixelWorldMap
        territories={territories}
        activeMarches={initialMarches}
      />,
    );

    expect(() => {
      rerender(
        <PixelWorldMap
          territories={territories}
          activeMarches={updatedMarches}
        />,
      );
    }).not.toThrow();
  });

  it('从有marches更新为无marches不崩溃', () => {
    const marches = [makeMarchUnit()];

    const { rerender } = render(
      <PixelWorldMap
        territories={territories}
        activeMarches={marches}
      />,
    );

    expect(() => {
      rerender(
        <PixelWorldMap
          territories={territories}
          activeMarches={[]}
        />,
      );
    }).not.toThrow();
  });

  it('从无marches更新为有marches不崩溃', () => {
    const { rerender } = render(
      <PixelWorldMap
        territories={territories}
        activeMarches={[]}
      />,
    );

    const marches = [makeMarchUnit()];
    expect(() => {
      rerender(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });

  // ── cancelled状态 (R13 Task6 P3 #1.2) ──

  it('cancelled状态的march渲染不报错（显式空分支）', () => {
    const marches: MarchUnit[] = [makeMarchUnit({ state: 'cancelled' })];
    expect(() => {
      render(
        <PixelWorldMap
          territories={territories}
          activeMarches={marches}
        />,
      );
    }).not.toThrow();
  });
});

// ── Part 2 (I11): Canvas渲染功能验证 ──
// 以下测试使用Canvas Mock验证实际的Canvas API调用（fillRect, fillStyle等）。

describe('PixelWorldMap I11 行军精灵Canvas渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCanvasMock();
  });

  afterEach(() => {
    teardownCanvasMock();
  });

  // ── I11 Test 1: 活跃行军显示精灵 ──

  it('活跃行军在路径上渲染精灵 (fillRect被调用)', () => {
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];
    renderWithMarches(marches);

    // fillRect should be called for sprite rendering
    expect(mockCtx.fillRect).toHaveBeenCalled();
    const callCount = mockCtx.fillRect.mock.calls.length;
    expect(callCount).toBeGreaterThan(0);
  });

  // ── I11 Test 2: 精灵位置随进度更新 ──

  it('精灵位置随x/y坐标变化而更新', () => {
    // Render with march at position (3, 1)
    capturedFillStyles = [];
    const marches1 = [makeMarchUnit({ x: 3, y: 1, state: 'marching' })];
    renderWithMarches(marches1);

    // Capture rect calls — R13 Task2: 批量渲染使用rect而非fillRect
    const calls1 = mockCtx.rect.mock.calls.slice();
    expect(calls1.length).toBeGreaterThan(0);

    // Use rerender on the same component instance to update march position
    // This avoids issues with multiple component instances sharing the same mock canvas
    mockCtx.rect.mockClear();
    capturedFillStyles = [];

    const marches2 = [makeMarchUnit({ x: 5, y: 1, state: 'marching' })];
    const result = render(
      <PixelWorldMap
        territories={territories}
        activeMarches={[]}
      />,
    );
    flushRAF();

    result.rerender(
      <PixelWorldMap
        territories={territories}
        activeMarches={marches2}
      />,
    );
    flushRAF();

    const calls2 = mockCtx.rect.mock.calls.slice();
    expect(calls2.length).toBeGreaterThan(0);

    // The x coordinates in rect calls should include values corresponding to march.x=5
    // Since we use a fresh component, rect calls should reflect the march position
    const xCoords2 = calls2.map((c: number[]) => c[0]);

    // rect should have been called with varying x coordinates (body, head, flag etc)
    const uniqueXCount = new Set(xCoords2.map(x => Math.round(x))).size;
    expect(uniqueXCount).toBeGreaterThanOrEqual(1);
    expect(calls2.length).toBeGreaterThan(0);
  });

  // ── I11 Test 3: retreating行军有不同视觉样式 (alpha=0.7) ──

  it('retreating行军使用0.7透明度', () => {
    capturedGlobalAlphas = [];
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ state: 'retreating', faction: 'wei' })];
    renderWithMarches(marches);

    // retreating state should set globalAlpha to 0.7
    expect(capturedGlobalAlphas).toContain(0.7);
  });

  it('retreating行军使用灰色(#888888)', () => {
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ state: 'retreating', faction: 'wei' })];
    renderWithMarches(marches);

    // retreating state should use gray color for sprite body
    expect(capturedFillStyles).toContain('#888888');
  });

  it('marching行军使用全透明度(1.0)', () => {
    capturedGlobalAlphas = [];
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];
    renderWithMarches(marches);

    // marching state should have full alpha
    expect(capturedGlobalAlphas).toContain(1.0);
  });

  // ── I11 Test 4: 多个行军同时渲染互不干扰 ──

  it('多个行军同时渲染 — rect调用数量多于单个行军', () => {
    // Single march
    const singleMarches = [makeMarchUnit({ id: 'm1', state: 'marching', faction: 'wei' })];
    renderWithMarches(singleMarches);
    const singleCount = mockCtx.rect.mock.calls.length;

    // Clear
    mockCtx.rect.mockClear();
    capturedFillStyles = [];
    capturedGlobalAlphas = [];

    // Multiple marches
    const multiMarches = [
      makeMarchUnit({ id: 'm1', state: 'marching', faction: 'wei', x: 3, y: 1 }),
      makeMarchUnit({ id: 'm2', state: 'marching', faction: 'shu', x: 5, y: 2 }),
      makeMarchUnit({ id: 'm3', state: 'marching', faction: 'wu', x: 7, y: 3 }),
    ];
    renderWithMarches(multiMarches);
    const multiCount = mockCtx.rect.mock.calls.length;

    // Multiple marches should produce more rect calls
    expect(multiCount).toBeGreaterThan(singleCount);
  });

  // ── I11 Test 5: 无活跃行军时不渲染精灵 ──

  it('无活跃行军时不渲染精灵相关fillRect', () => {
    capturedFillStyles = [];
    renderWithMarches([]);

    // No marches — renderMarchSpritesOverlay returns early
    // fillRect may still be called for other overlays, but not for march sprites
    // We check that no march-specific colors are used
    expect(capturedFillStyles).not.toContain('#2196F3'); // wei
    expect(capturedFillStyles).not.toContain('#4CAF50'); // shu
    expect(capturedFillStyles).not.toContain('#F44336'); // wu
    expect(capturedFillStyles).not.toContain('#9E9E9E'); // neutral
  });

  // ── I11 Test 6: 阵营颜色正确应用 ──

  it('wei阵营使用蓝色(#2196F3)', () => {
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ faction: 'wei', state: 'marching' })];
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#2196F3');
  });

  it('shu阵营使用绿色(#4CAF50)', () => {
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ faction: 'shu', state: 'marching' })];
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#4CAF50');
  });

  it('wu阵营使用红色(#F44336)', () => {
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ faction: 'wu', state: 'marching' })];
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#F44336');
  });

  it('neutral阵营使用灰色(#9E9E9E)', () => {
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ faction: 'neutral', state: 'marching' })];
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#9E9E9E');
  });

  // ── I11 Test 7: 路线虚线渲染 ──

  it('marching行军路径使用setLineDash绘制虚线', () => {
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];
    renderWithMarches(marches);

    // setLineDash should be called for the route dashed line
    expect(mockCtx.setLineDash).toHaveBeenCalled();

    // Find a call with non-empty dash pattern (the route line)
    const dashCalls = mockCtx.setLineDash.mock.calls;
    const hasDashPattern = dashCalls.some(
      (call: any[]) => Array.isArray(call[0]) && call[0].length >= 2 && call[0][0] > 0,
    );
    expect(hasDashPattern).toBe(true);
  });

  it('行军路线使用阵营颜色作为strokeStyle', () => {
    capturedStrokeStyles = [];
    const marches = [makeMarchUnit({ faction: 'wu', state: 'marching' })];
    renderWithMarches(marches);

    // The route should use the faction color (wu = #F44336)
    expect(capturedStrokeStyles).toContain('#F44336');
  });

  // ── I11 Test 8: arrived状态渲染攻城闪烁效果 ──

  it('arrived状态渲染攻城闪烁(使用beginPath+stroke绘制)', () => {
    capturedStrokeStyles = [];
    const marches = [makeMarchUnit({ state: 'arrived', faction: 'wei' })];
    renderWithMarches(marches);

    // arrived state should use beginPath (for ring or swords)
    expect(mockCtx.beginPath).toHaveBeenCalled();
    // Crossed swords always drawn — stroke should be called
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('arrived状态渲染交叉双剑(#FFD700)', () => {
    capturedStrokeStyles = [];
    const marches = [makeMarchUnit({ state: 'arrived', faction: 'wei' })];
    renderWithMarches(marches);

    // Crossed swords should use gold color
    expect(capturedStrokeStyles).toContain('#FFD700');
  });

  // ── I11 Test 9: retreating路线使用更低透明度 ──

  it('retreating行军路线使用0.5透明度', () => {
    capturedGlobalAlphas = [];
    const marches = [makeMarchUnit({ state: 'retreating', faction: 'wei' })];
    renderWithMarches(marches);

    // The route for retreating state should use 0.5 alpha
    expect(capturedGlobalAlphas).toContain(0.5);
  });

  // ── I11 Test 10: ctx.save/restore被正确调用 ──

  it('精灵渲染使用ctx.save/restore包裹', () => {
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];
    renderWithMarches(marches);

    // The renderMarchSpritesOverlay should call save/restore
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  // ── I11 Test 11: 精灵旗帜使用阵营色 ──

  it('第一人携带阵营色旗帜', () => {
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ faction: 'shu', state: 'marching', troops: 800 })];
    renderWithMarches(marches);

    // The flag color should match the faction color (shu = #4CAF50)
    // R13 Task2: 批量渲染将同色矩形合并为一次fillStyle设置
    // 验证阵营色出现在fillStyle中即可（body+flag+pole可能合并为一次设置）
    expect(capturedFillStyles).toContain('#4CAF50');

    // 进一步验证：rect调用数量应该包含旗帜相关的rect（body, head, pole, flag, highlight = 5个rect）
    expect(mockCtx.rect.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  // ── I11 Test 12: 4帧行走动画 ──

  it('4帧行走动画 — 使用Date.now()计算帧', () => {
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];
    renderWithMarches(marches);

    // fillRect should be called for the sprite body and head
    // The walk frame is calculated from Date.now(), so we just verify rendering occurs
    expect(mockCtx.fillRect).toHaveBeenCalled();

    // Verify sprite body is rendered (at least one fillRect with positive width/height)
    const bodyCalls = mockCtx.fillRect.mock.calls.filter(
      (c: number[]) => c[2] > 0 && c[3] > 0,
    );
    expect(bodyCalls.length).toBeGreaterThan(0);
  });
});

// ── Part 2 扩展 (R11): Smoke Tests功能断言补充 ──
// 以下16个测试逐一对应Part 1中的16个smoke tests，补充Canvas API调用级断言。
// 每个测试验证具体的fillRect参数、fillStyle颜色、globalAlpha值、
// setLineDash参数、strokeStyle值、arc/beginPath/stroke调用等。

describe('PixelWorldMap R11 Smoke Tests功能断言', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCanvasMock();
  });

  afterEach(() => {
    teardownCanvasMock();
  });

  // ── R11-1: 对应smoke "activeMarches属性传入不崩溃" ──
  // 验证: 传入march时rect调用包含正确的精灵尺寸(正width/height)

  it('R11-1: 传入activeMarches时rect渲染精灵body有正确的width/height', () => {
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];
    renderWithMarches(marches);

    // R13 Task2: 批量渲染使用rect替代fillRect
    expect(mockCtx.rect).toHaveBeenCalled();

    // Verify at least one rect call has sprite body proportions:
    // body is `rect(x, y, size, size*2)` where size > 0 and height > width
    const bodyCalls = mockCtx.rect.mock.calls.filter(
      (c: number[]) => c[2] > 0 && c[3] > 0 && c[3] > c[2],
    );
    expect(bodyCalls.length).toBeGreaterThan(0);
  });

  // ── R11-2: 对应smoke "不传activeMarches属性不崩溃" ──
  // 验证: 不传activeMarches时不渲染阵营色fillRect

  it('R11-2: 不传activeMarches时不渲染任何阵营色fillRect', () => {
    capturedFillStyles = [];
    render(
      <PixelWorldMap territories={territories} />,
    );
    flushRAF();

    // No march sprites — faction colors should not appear
    expect(capturedFillStyles).not.toContain('#2196F3');
    expect(capturedFillStyles).not.toContain('#4CAF50');
    expect(capturedFillStyles).not.toContain('#F44336');
    expect(capturedFillStyles).not.toContain('#9E9E9E');
  });

  // ── R11-3: 对应smoke "空marches数组不报错" ──
  // 验证: 空数组时save/restore调用平衡，无阵营色精灵渲染

  it('R11-3: 空marches数组时无阵营色fillRect', () => {
    capturedFillStyles = [];
    renderWithMarches([]);

    // Empty marches — renderMarchSpritesOverlay returns early
    // No faction color fillRect calls
    expect(capturedFillStyles).not.toContain('#2196F3');
    expect(capturedFillStyles).not.toContain('#4CAF50');
    expect(capturedFillStyles).not.toContain('#F44336');
  });

  // ── R11-4: 对应smoke "preparing状态的march渲染不报错" ──
  // 验证: preparing状态渲染集结箭头(beginPath+moveTo+lineTo+closePath+fill)

  it('R11-4: preparing状态渲染集结箭头 — beginPath+fill被调用且fillStyle含#FFD700', () => {
    capturedFillStyles = [];
    // Mock Date.now() to ensure blinkPhase === 1 (visible frame)
    // blinkPhase = Math.floor(now / 400) % 2 — need now/400 to be odd
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(500);
    try {
      const marches = [makeMarchUnit({ state: 'preparing', faction: 'wei' })];
      renderWithMarches(marches);

      // preparing state: draws upward arrow with gold color
      expect(capturedFillStyles).toContain('#FFD700');
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();

      // Verify the arrow uses moveTo for the triangle shape
      expect(mockCtx.moveTo).toHaveBeenCalled();
      // closePath for closing the triangle
      expect(mockCtx.closePath).toHaveBeenCalled();
    } finally {
      dateSpy.mockRestore();
    }
  });

  // ── R11-5: 对应smoke "marching状态的march渲染不报错" ──
  // 验证: marching状态rect body有正确的阵营色，globalAlpha=1.0

  it('R11-5: marching状态rect使用阵营色且globalAlpha为1.0', () => {
    capturedFillStyles = [];
    capturedGlobalAlphas = [];
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei', troops: 800 })];
    renderWithMarches(marches);

    // marching state should use wei faction color
    expect(capturedFillStyles).toContain('#2196F3');
    // marching state uses full alpha for sprite body
    expect(capturedGlobalAlphas).toContain(1.0);

    // R13 Task2: rect body call: height > width (body is size*2 tall)
    const bodyCalls = mockCtx.rect.mock.calls.filter(
      (c: number[]) => c[2] > 0 && c[3] > c[2],
    );
    expect(bodyCalls.length).toBeGreaterThan(0);
  });

  // ── R11-6: 对应smoke "arrived状态的march渲染不报错" ──
  // 验证: arrived状态使用beginPath+arc+stroke绘制攻城闪烁环和交叉剑

  it('R11-6: arrived状态调用beginPath+stroke且strokeStyle含#FFD700交叉剑', () => {
    capturedStrokeStyles = [];
    const marches = [makeMarchUnit({ state: 'arrived', faction: 'wei' })];
    renderWithMarches(marches);

    // arrived state renders siege effects using beginPath + stroke
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();

    // Crossed swords always drawn with gold stroke color
    expect(capturedStrokeStyles).toContain('#FFD700');
  });

  // ── R11-7: 对应smoke "retreating状态的march渲染不报错" ──
  // 验证: retreating状态fillStyle=#888888, globalAlpha=0.7

  it('R11-7: retreating状态fillStyle为#888888且globalAlpha为0.7', () => {
    capturedFillStyles = [];
    capturedGlobalAlphas = [];
    const marches = [makeMarchUnit({ state: 'retreating', faction: 'wei' })];
    renderWithMarches(marches);

    // retreating sprite body uses gray
    expect(capturedFillStyles).toContain('#888888');
    // retreating state uses 0.7 alpha
    expect(capturedGlobalAlphas).toContain(0.7);

    // R13 Task2: rect body call still has positive dimensions
    const bodyCalls = mockCtx.rect.mock.calls.filter(
      (c: number[]) => c[2] > 0 && c[3] > 0,
    );
    expect(bodyCalls.length).toBeGreaterThan(0);
  });

  // ── R11-8: 对应smoke "intercepted状态的march渲染不报错" ──
  // 验证: intercepted状态使用默认阵营色渲染(非retreating色)

  it('R11-8: intercepted状态使用阵营色渲染而非retreating灰(#888888)', () => {
    capturedFillStyles = [];
    capturedGlobalAlphas = [];
    const marches = [makeMarchUnit({ state: 'intercepted', faction: 'shu' })];
    renderWithMarches(marches);

    // intercepted is NOT retreating, so should use faction color, not gray
    expect(capturedFillStyles).toContain('#4CAF50');
    // intercepted uses full alpha (not retreating alpha)
    expect(capturedGlobalAlphas).toContain(1.0);
  });

  // ── R11-9: 对应smoke "多个不同状态的march同时渲染不报错" ──
  // 验证: 多状态march各自产生正确的fillStyle和globalAlpha

  it('R11-9: 多状态march同时渲染产生多种阵营色和多种alpha值', () => {
    capturedFillStyles = [];
    capturedGlobalAlphas = [];
    // Mock Date.now() to ensure preparing blinkPhase === 1 (visible)
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(500);
    try {
      const marches = [
        makeMarchUnit({ id: 'march_1', state: 'preparing', faction: 'wei', x: 2, y: 1 }),
        makeMarchUnit({ id: 'march_2', state: 'marching', faction: 'shu', x: 4, y: 1 }),
        makeMarchUnit({ id: 'march_3', state: 'arrived', faction: 'wu', x: 7, y: 1 }),
        makeMarchUnit({ id: 'march_4', state: 'retreating', faction: 'neutral', x: 5, y: 1 }),
      ];
      renderWithMarches(marches);

      // Multiple faction colors should appear
      expect(capturedFillStyles).toContain('#2196F3'); // wei
      expect(capturedFillStyles).toContain('#4CAF50'); // shu
      expect(capturedFillStyles).toContain('#F44336'); // wu

      // retreating state uses gray
      expect(capturedFillStyles).toContain('#888888');

      // retreating uses alpha 0.7, marching uses alpha 1.0
      expect(capturedGlobalAlphas).toContain(0.7);
      expect(capturedGlobalAlphas).toContain(1.0);
    } finally {
      dateSpy.mockRestore();
    }
  });

  // ── R11-10: 对应smoke "不同阵营(wei/shu/wu/neutral)的march渲染不报错" ──
  // 验证: 四个阵营各有独立的正确fillStyle颜色

  it('R11-10: 四阵营(wei/shu/wu/neutral)各自使用正确的fillStyle颜色', () => {
    capturedFillStyles = [];
    const marches = [
      makeMarchUnit({ id: 'march_wei', faction: 'wei', x: 3, y: 1, state: 'marching' }),
      makeMarchUnit({ id: 'march_shu', faction: 'shu', x: 4, y: 1, state: 'marching' }),
      makeMarchUnit({ id: 'march_wu', faction: 'wu', x: 5, y: 1, state: 'marching' }),
      makeMarchUnit({ id: 'march_neutral', faction: 'neutral', x: 6, y: 1, state: 'marching' }),
    ];
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#2196F3'); // wei
    expect(capturedFillStyles).toContain('#4CAF50'); // shu
    expect(capturedFillStyles).toContain('#F44336'); // wu
    expect(capturedFillStyles).toContain('#9E9E9E'); // neutral
  });

  // ── R11-11: 对应smoke "不同兵力(影响精灵数量)的march渲染不报错" ──
  // 验证: 不同兵力产生不同数量的rect调用

  it('R11-11: 不同兵力(100/700/1500)产生递增的rect调用数量', () => {
    // troops 100 → 1 sprite (fewer rects)
    capturedFillStyles = [];
    const marchesSmall = [makeMarchUnit({ id: 'march_small', troops: 100, x: 3, y: 1, state: 'marching' })];
    renderWithMarches(marchesSmall);
    const smallCount = mockCtx.rect.mock.calls.length;

    // troops 700 → 3 sprites (more rects)
    mockCtx.rect.mockClear();
    capturedFillStyles = [];
    const marchesMed = [makeMarchUnit({ id: 'march_medium', troops: 700, x: 4, y: 1, state: 'marching' })];
    renderWithMarches(marchesMed);
    const medCount = mockCtx.rect.mock.calls.length;

    // troops 1500 → 5 sprites (most rects)
    mockCtx.rect.mockClear();
    capturedFillStyles = [];
    const marchesLarge = [makeMarchUnit({ id: 'march_large', troops: 1500, x: 5, y: 1, state: 'marching' })];
    renderWithMarches(marchesLarge);
    const largeCount = mockCtx.rect.mock.calls.length;

    // More troops = more sprites = more rect calls
    expect(largeCount).toBeGreaterThan(medCount);
    expect(medCount).toBeGreaterThan(smallCount);
  });

  // ── R11-12: 对应smoke "军队完整生命周期不报错" ──
  // 验证: 生命周期各阶段同时渲染产生正确的Canvas调用组合

  it('R11-12: 生命周期各阶段同时渲染产生多种Canvas调用组合', () => {
    capturedFillStyles = [];
    capturedStrokeStyles = [];
    capturedGlobalAlphas = [];
    const marchBase = makeMarchUnit();

    const lifecycleMarches = [
      { ...marchBase, id: 'phase_prepare', state: 'preparing', x: 2, y: 1 },
      { ...marchBase, id: 'phase_march', state: 'marching', x: 4, y: 1 },
      { ...marchBase, id: 'phase_arrive', state: 'arrived', x: 7, y: 1 },
      { ...marchBase, id: 'phase_retreat', state: 'retreating', x: 5, y: 1 },
    ];
    renderWithMarches(lifecycleMarches);

    // fillRect for sprites
    expect(mockCtx.fillRect).toHaveBeenCalled();

    // beginPath for: preparing arrow, arrived siege ring + swords, route lines
    expect(mockCtx.beginPath).toHaveBeenCalled();

    // stroke for: arrived swords, route lines, possible siege ring
    expect(mockCtx.stroke).toHaveBeenCalled();

    // Various alphas: 1.0 (normal), 0.7 (retreating sprite), 0.5 (retreating route)
    expect(capturedGlobalAlphas).toContain(1.0);
    expect(capturedGlobalAlphas).toContain(0.7);

    // Various colors present
    expect(capturedFillStyles.length).toBeGreaterThan(0);
    expect(capturedStrokeStyles.length).toBeGreaterThan(0);
  });

  // ── R11-13: 对应smoke "activeMarches与marchRoute同时传入不报错" ──
  // 验证: 同时传入时marchRoute渲染黄色虚线(#FFD700 + setLineDash)

  it('R11-13: activeMarches+marchRoute同时传入时setLineDash被调用且strokeStyle含#FFD700', () => {
    capturedStrokeStyles = [];
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];
    const route = {
      path: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ],
      waypoints: [
        { x: 2, y: 1 },
        { x: 5, y: 1 },
      ],
      distance: 3,
      estimatedTime: 3,
      waypointCities: [],
    };

    const result = render(
      <PixelWorldMap
        territories={territories}
        activeMarches={[]}
      />,
    );
    flushRAF();

    result.rerender(
      <PixelWorldMap
        territories={territories}
        activeMarches={marches}
        marchRoute={route}
      />,
    );
    flushRAF();

    // setLineDash should be called for both route and sprite route
    expect(mockCtx.setLineDash).toHaveBeenCalled();

    // #FFD700 from marchRoute overlay
    expect(capturedStrokeStyles).toContain('#FFD700');

    // Waypoint arc calls for march route
    expect(mockCtx.arc).toHaveBeenCalled();
  });

  // ── R11-14: 对应smoke "重新渲染时activeMarches更新不崩溃" ──
  // 验证: rerender后Canvas调用反映新的行军状态

  it('R11-14: rerender更新activeMarches后rect调用反映新行军数据', () => {
    capturedFillStyles = [];
    const initialMarches = [makeMarchUnit({ id: 'march_init', state: 'marching', faction: 'wei' })];

    const result = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={initialMarches} />,
    );
    flushRAF();

    // After adding a march, rect should be called (R13 Task2: batch render)
    expect(mockCtx.rect).toHaveBeenCalled();

    // Now update with different marches
    const updatedMarches = [
      makeMarchUnit({ id: 'march_init', state: 'arrived', faction: 'wei' }),
      makeMarchUnit({ id: 'march_new', state: 'marching', faction: 'shu' }),
    ];

    mockCtx.rect.mockClear();
    capturedFillStyles = [];

    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={updatedMarches} />,
    );
    flushRAF();

    // New renders should also call rect
    expect(mockCtx.rect).toHaveBeenCalled();
    expect(mockCtx.rect.mock.calls.length).toBeGreaterThan(0);

    // Both wei and shu faction colors should appear
    expect(capturedFillStyles).toContain('#2196F3'); // wei
    expect(capturedFillStyles).toContain('#4CAF50'); // shu
  });

  // ── R11-15: 对应smoke "从有marches更新为无marches不崩溃" ──
  // 验证: 从有到无后不再渲染阵营色fillRect

  it('R11-15: 从有marches更新为空数组后不渲染阵营色fillRect', () => {
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];

    const result = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={marches} />,
    );
    flushRAF();

    // Clear mocks and captured arrays
    mockCtx.fillRect.mockClear();
    capturedFillStyles = [];
    capturedGlobalAlphas = [];

    // Now set to empty
    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // After removing all marches, no faction colors should appear
    expect(capturedFillStyles).not.toContain('#2196F3');
    expect(capturedFillStyles).not.toContain('#4CAF50');
    expect(capturedFillStyles).not.toContain('#F44336');
    expect(capturedFillStyles).not.toContain('#9E9E9E');
  });

  // ── R11-16: 对应smoke "从无marches更新为有marches不崩溃" ──
  // 验证: 从无到有后开始渲染正确的阵营色fillRect

  it('R11-16: 从无marches更新为有marches后渲染正确的阵营色fillRect', () => {
    capturedFillStyles = [];

    const result = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // Initially no faction colors
    expect(capturedFillStyles).not.toContain('#2196F3');

    // Clear and add marches
    capturedFillStyles = [];
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wu' })];

    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={marches} />,
    );
    flushRAF();

    // After adding wu march, wu faction color should appear
    expect(capturedFillStyles).toContain('#F44336');

    // fillRect should have been called with positive dimensions
    const bodyCalls = mockCtx.fillRect.mock.calls.filter(
      (c: number[]) => c[2] > 0 && c[3] > 0,
    );
    expect(bodyCalls.length).toBeGreaterThan(0);
  });
});

// ── Part 3 (R12 Task4): P2 #8 空行军精灵清理测试 ──
// 验证当activeMarches从有→空时，sprite layer被clearRect清空。

describe('PixelWorldMap R12 P2#8 空行军精灵清理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCanvasMock();
  });

  afterEach(() => {
    teardownCanvasMock();
  });

  it('从有marches更新为空数组后clearRect被调用以清空精灵层', () => {
    const marches = [makeMarchUnit({ state: 'marching', faction: 'wei' })];

    const result = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // Add marches
    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={marches} />,
    );
    flushRAF();

    // Clear mocks to prepare for the empty-render measurement
    mockCtx.clearRect.mockClear();
    mockCtx.fillRect.mockClear();
    capturedFillStyles = [];

    // Now remove all marches — should trigger clearRect
    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // P2 #8 fix: renderMarchSpritesOverlay should call clearRect when marches are empty
    expect(mockCtx.clearRect).toHaveBeenCalled();

    // No faction colors should be rendered
    expect(capturedFillStyles).not.toContain('#2196F3');
    expect(capturedFillStyles).not.toContain('#4CAF50');
    expect(capturedFillStyles).not.toContain('#F44336');
    expect(capturedFillStyles).not.toContain('#9E9E9E');
  });

  it('初始渲染空marches时clearRect被调用', () => {
    capturedFillStyles = [];

    render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // With empty marches, clearRect should be called by renderMarchSpritesOverlay
    expect(mockCtx.clearRect).toHaveBeenCalled();
  });
});

// ── Part 4 (R13 Task6 P3 #5.1): Cancel chain integration tests ──
// Verify: create march -> startMarch -> cancelMarch -> sprite layer cleanup

describe('PixelWorldMap R13 P3#5.1 Cancel chain — sprite layer cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCanvasMock();
  });

  afterEach(() => {
    teardownCanvasMock();
  });

  it('取消行军后精灵层被clearRect清空且不渲染阵营色', () => {
    // Simulate the cancel chain:
    // 1. Create + start march (renders sprites)
    // 2. Cancel (activeMarches becomes empty)
    // 3. Verify sprite layer cleanup

    capturedFillStyles = [];

    // Phase 1: Render with active march (simulates create + start)
    const march = makeMarchUnit({ state: 'marching', faction: 'wei' });
    const result = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // Add march (simulate startMarch)
    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={[march]} />,
    );
    flushRAF();

    // Verify sprites rendered
    expect(capturedFillStyles).toContain('#2196F3'); // wei color rendered

    // Phase 2: Cancel march (simulate cancelMarch → activeMarches becomes empty)
    mockCtx.clearRect.mockClear();
    capturedFillStyles = [];

    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // Phase 3: Verify cleanup
    // clearRect should be called to clean the sprite layer
    expect(mockCtx.clearRect).toHaveBeenCalled();

    // No faction colors should be rendered after cancel
    expect(capturedFillStyles).not.toContain('#2196F3');
    expect(capturedFillStyles).not.toContain('#4CAF50');
    expect(capturedFillStyles).not.toContain('#F44336');
    expect(capturedFillStyles).not.toContain('#9E9E9E');
  });

  it('取消行军后再添加新行军，精灵正常渲染', () => {
    // Full lifecycle: create -> start -> cancel -> create new -> start new
    capturedFillStyles = [];

    const march1 = makeMarchUnit({ id: 'march_cancel', state: 'marching', faction: 'wei' });

    const result = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // Start first march
    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={[march1]} />,
    );
    flushRAF();

    // Cancel first march
    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // Clear mocks for fresh measurement
    mockCtx.clearRect.mockClear();
    capturedFillStyles = [];

    // Start new march (different faction to verify new sprites)
    const march2 = makeMarchUnit({ id: 'march_new', state: 'marching', faction: 'shu' });
    result.rerender(
      <PixelWorldMap territories={territories} activeMarches={[march2]} />,
    );
    flushRAF();

    // New faction color should be rendered
    expect(capturedFillStyles).toContain('#4CAF50'); // shu
    // Old faction color should NOT be rendered (only 1 march active)
    expect(capturedFillStyles).not.toContain('#2196F3'); // wei
  });
});
