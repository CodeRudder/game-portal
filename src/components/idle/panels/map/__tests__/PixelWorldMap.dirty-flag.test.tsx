/**
 * PixelWorldMap D3-2 脏标记渲染机制测试
 *
 * 测试分层脏标记机制:
 * - 无变化时重渲染 → Canvas调用次数不增加(除首次)
 * - 仅activeMarches变化 → 仅精灵层重绘
 * - 仅territories变化 → 仅地形层重绘
 * - 仅marchRoute变化 → 仅路线层重绘
 * - 仅activeSiegeAnims变化 → 仅特效层重绘
 * - 首次渲染必须完整渲染
 * - 脏标记在渲染后正确重置
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { PixelWorldMap, getDirtyFlagsForTest } from '../PixelWorldMap';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import type { MarchUnit } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import type { SiegeAnimationState } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';

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
  },
  DEFAULT_LANDMARKS: [
    { id: 'city-luoyang', name: '洛阳' },
    { id: 'city-xuchang', name: '许昌' },
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

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    rect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
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
    set fillStyle(v: string) { this._fillStyle = v; },
    get strokeStyle() { return this._strokeStyle; },
    set strokeStyle(v: string) { this._strokeStyle = v; },
    get globalAlpha() { return this._globalAlpha; },
    set globalAlpha(v: number) { this._globalAlpha = v; },
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
}

let mockCtx: ReturnType<typeof createMockCtx>;
const originalGetContext = HTMLCanvasElement.prototype.getContext;

function setupCanvasMock() {
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

// ─────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────

const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
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

const territories: TerritoryData[] = [
  makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 1, y: 1 } }),
  makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 6, y: 1 } }),
];

function makeMarchUnit(overrides: Partial<MarchUnit> = {}): MarchUnit {
  return {
    id: 'march_test_001',
    fromCityId: 'city-luoyang',
    toCityId: 'city-xuchang',
    x: 3,
    y: 1,
    path: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 6, y: 1 },
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

function makeSiegeAnim(overrides: Partial<SiegeAnimationState> = {}): SiegeAnimationState {
  return {
    taskId: 'task-001',
    targetCityId: 'city-xuchang',
    targetX: 6,
    targetY: 1,
    phase: 'assembly',
    assemblyElapsedMs: 0,
    strategy: 'forceAttack',
    defenseRatio: 1.0,
    faction: 'wei',
    troops: 2000,
    startTimeMs: Date.now() - 1500,
    victory: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('PixelWorldMap D3-2 脏标记渲染机制', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCanvasMock();
  });

  afterEach(() => {
    teardownCanvasMock();
  });

  // ── Test 1: 首次渲染必须完整渲染 ──

  it('首次渲染必须完整渲染 — fillRect被调用', () => {
    render(<PixelWorldMap territories={territories} />);
    flushRAF();

    // 首次渲染：所有脏标记为true，Canvas应该被绘制
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
  });

  // ── Test 2: 无变化时重渲染 → Canvas调用次数不增加(除首次) ──

  it('无变化时重渲染 → fillRect调用次数不显著增加', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} />,
    );
    flushRAF();

    const firstRenderCount = mockCtx.fillRect.mock.calls.length;
    expect(firstRenderCount).toBeGreaterThan(0);

    // 用完全相同的props重新渲染
    mockCtx.fillRect.mockClear();
    rerender(<PixelWorldMap territories={territories} />);
    flushRAF();

    // 无变化 → 脏标记已重置，不应有新的Canvas渲染
    const secondRenderCount = mockCtx.fillRect.mock.calls.length;
    expect(secondRenderCount).toBe(0);
  });

  // ── Test 3: 无变化时连续多帧 → Canvas调用次数为0 ──

  it('无变化时连续多帧 → fillRect调用次数为0', () => {
    render(<PixelWorldMap territories={territories} />);
    flushRAF(); // 首帧渲染

    // 清空调用记录
    mockCtx.fillRect.mockClear();

    // 连续3帧，无数据变化
    flushRAF();
    flushRAF();
    flushRAF();

    // 无变化 → 所有脏标记在首帧后已重置，不应有新的渲染
    expect(mockCtx.fillRect.mock.calls.length).toBe(0);
  });

  // ── Test 4: 仅activeMarches变化 → 精灵层重绘 ──

  it('仅activeMarches变化 → Canvas有新的fillRect调用', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF();

    // 首帧渲染后清空
    mockCtx.fillRect.mockClear();

    // 仅更新activeMarches
    const marches = [makeMarchUnit({ state: 'marching' })];
    rerender(
      <PixelWorldMap territories={territories} activeMarches={marches} />,
    );
    flushRAF();

    // 精灵层脏 → 应有新的rect调用 (R13 Task2: 批量渲染使用rect+fill替代fillRect)
    expect(mockCtx.rect.mock.calls.length).toBeGreaterThan(0);
  });

  // ── Test 5: 仅territories变化 → 地形层重绘 ──

  it('仅territories变化 → Canvas有新的fillRect调用', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} />,
    );
    flushRAF();

    // 首帧渲染后清空
    mockCtx.fillRect.mockClear();

    // 仅更新territories（改变level）
    const updatedTerritories = territories.map(t => ({ ...t, level: t.level + 1 }));
    rerender(
      <PixelWorldMap territories={updatedTerritories} />,
    );
    flushRAF();

    // 地形层脏 → 应有新的fillRect调用
    expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
  });

  // ── Test 6: 仅marchRoute变化 → 路线层重绘 ──

  it('仅marchRoute变化 → Canvas有新的stroke调用（路线绘制）', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} />,
    );
    flushRAF();

    // 首帧渲染后清空
    mockCtx.stroke.mockClear();
    mockCtx.beginPath.mockClear();

    // 添加行军路线
    const route = {
      path: [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 6, y: 1 },
      ],
      waypoints: [
        { x: 1, y: 1 },
        { x: 6, y: 1 },
      ],
      distance: 5,
      estimatedTime: 5,
      waypointCities: [],
    };

    rerender(
      <PixelWorldMap territories={territories} marchRoute={route} />,
    );
    flushRAF();

    // 路线层脏 → 应有stroke/beginPath调用
    expect(mockCtx.beginPath.mock.calls.length).toBeGreaterThan(0);
    expect(mockCtx.stroke.mock.calls.length).toBeGreaterThan(0);
  });

  // ── Test 7: 仅activeSiegeAnims变化 → 特效层重绘 ──

  it('仅activeSiegeAnims变化 → Canvas有新的fillRect调用', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} activeSiegeAnims={[]} />,
    );
    flushRAF();

    // 首帧渲染后清空
    mockCtx.fillRect.mockClear();

    // 添加攻城动画
    const anims = [makeSiegeAnim({ phase: 'assembly' })];
    rerender(
      <PixelWorldMap territories={territories} activeSiegeAnims={anims} />,
    );
    flushRAF();

    // 特效层脏 → 应有新的fillRect调用（攻城动画渲染）
    expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
  });

  // ── Test 8: 脏标记在渲染后正确重置 ──

  it('渲染后脏标记重置 — 无活跃动画时再次flush无Canvas调用', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF(); // 首帧
    mockCtx.fillRect.mockClear();

    // 仅改变territories(地形层)，不引入行军精灵
    const updatedTerritories = territories.map(t => ({ ...t, level: t.level + 1 }));
    rerender(
      <PixelWorldMap territories={updatedTerritories} activeMarches={[]} />,
    );
    flushRAF(); // 渲染地形层

    const afterDirtyRender = mockCtx.fillRect.mock.calls.length;
    expect(afterDirtyRender).toBeGreaterThan(0);

    // 再次flush — 无活跃动画，脏标记已重置，不应有新的Canvas调用
    mockCtx.fillRect.mockClear();
    flushRAF();
    expect(mockCtx.fillRect.mock.calls.length).toBe(0);
  });

  // ── Test 9: 选中ID变化 → 触发地形层重绘 ──

  it('selectedId变化 → Canvas有新的调用（选中高亮重绘）', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} selectedId={null} />,
    );
    flushRAF();
    mockCtx.fillRect.mockClear();

    // 改变selectedId
    rerender(
      <PixelWorldMap territories={territories} selectedId="city-luoyang" />,
    );
    flushRAF();

    // 地形层脏 → 选中高亮重绘
    expect(mockCtx.fillRect.mock.calls.length + mockCtx.strokeRect.mock.calls.length).toBeGreaterThan(0);
  });

  // ── Test 10: 无活跃动画时的静态场景 → 连续帧不重绘 ──

  it('无活跃动画+无数据变化 → 连续10帧无Canvas调用', () => {
    render(<PixelWorldMap territories={territories} />);
    flushRAF(); // 首帧
    mockCtx.fillRect.mockClear();

    // 连续10帧
    for (let i = 0; i < 10; i++) {
      flushRAF();
    }

    // 无变化 → 无Canvas调用
    expect(mockCtx.fillRect.mock.calls.length).toBe(0);
  });

  // ── Test 11: 多层数据同时变化 → 所有层重绘 ──

  it('多层数据同时变化 → Canvas有完整的渲染', () => {
    const { rerender } = render(
      <PixelWorldMap
        territories={territories}
        activeMarches={[]}
        activeSiegeAnims={[]}
      />,
    );
    flushRAF();
    mockCtx.fillRect.mockClear();

    // 同时变化多层数据
    rerender(
      <PixelWorldMap
        territories={territories.map(t => ({ ...t, level: t.level + 1 }))}
        activeMarches={[makeMarchUnit()]}
        activeSiegeAnims={[makeSiegeAnim()]}
      />,
    );
    flushRAF();

    // 所有层脏 → 大量Canvas调用
    expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
  });

  // ── Test 12: getDirtyFlagsForTest 返回正确的初始脏状态 ──

  it('getDirtyFlagsForTest — 首次渲染后所有脏标记为true', () => {
    render(<PixelWorldMap territories={territories} />);

    // 组件创建后，flush前，脏标记应该都是true
    const flags = getDirtyFlagsForTest();
    expect(flags).not.toBeNull();
    expect(flags!.terrain).toBe(true);
    expect(flags!.sprites).toBe(true);
    expect(flags!.effects).toBe(true);
    expect(flags!.route).toBe(true);
  });

  // ── Test 13: getDirtyFlagsForTest — 渲染后脏标记重置 ──

  it('getDirtyFlagsForTest — 渲染后脏标记被重置为false', () => {
    render(<PixelWorldMap territories={territories} />);
    flushRAF(); // 首帧渲染

    const flags = getDirtyFlagsForTest();
    expect(flags).not.toBeNull();
    // 渲染后，脏标记应被重置
    expect(flags!.terrain).toBe(false);
    expect(flags!.sprites).toBe(false);
    expect(flags!.effects).toBe(false);
    expect(flags!.route).toBe(false);
  });

  // ── Test 14: getDirtyFlagsForTest — activeMarches变化仅标记sprites层脏 ──

  it('getDirtyFlagsForTest — activeMarches变化仅标记sprites层脏', () => {
    const { rerender } = render(
      <PixelWorldMap territories={territories} activeMarches={[]} />,
    );
    flushRAF(); // 首帧渲染，所有脏标记重置

    // 仅更新activeMarches
    rerender(
      <PixelWorldMap territories={territories} activeMarches={[makeMarchUnit()]} />,
    );

    // 在flush前检查脏标记 — 仅sprites层应为脏
    const flags = getDirtyFlagsForTest();
    expect(flags).not.toBeNull();
    expect(flags!.sprites).toBe(true); // 精灵层应被标记
    expect(flags!.terrain).toBe(false); // 地形层不应被标记
    expect(flags!.effects).toBe(false); // 特效层不应被标记
    expect(flags!.route).toBe(false); // 路线层不应被标记
  });
});
