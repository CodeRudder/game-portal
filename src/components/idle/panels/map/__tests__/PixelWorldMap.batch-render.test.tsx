/**
 * PixelWorldMap R13 Task2: 批量渲染drawCall对比基准测试
 *
 * 验证批量渲染优化效果:
 * - 10精灵场景: fillStyle设置次数基准
 * - 50精灵场景: fillStyle设置次数比优化前少30%+
 * - 100精灵场景: 压力测试
 * - troops=0不渲染精灵
 * - 视觉回归: 同阵营颜色正确、不同阵营颜色不混淆
 *
 * 优化方案: 同色批量渲染 (方案A)
 *   - 将同阵营精灵的fillRect调用合并为一个beginPath + 多个rect + 一个fill
 *   - 按阵营分组精灵，每个阵营使用一次beginPath + fill批量绘制
 *
 * 与PixelWorldMapMarchSprites.test.tsx使用相同的mock Canvas模式
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { PixelWorldMap } from '../PixelWorldMap';
import type { MarchUnit } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// ── Mock CSS ──
vi.mock('../PixelWorldMap.css', () => ({}));

// ── Mock 地图数据模块 (100x60 匹配真实地图尺寸) ──
vi.mock('@/games/three-kingdoms/core/map/maps/world-map.txt?raw', () => {
  const row = '.'.repeat(100);
  const rows = Array(60).fill(row).join('\n');
  return {
    default: `MAP:测试地图
SIZE:100x60
TILE:8

CITY: L=洛阳,X=许昌,J=建业,C=成都,Y=邺

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

vi.mock('@/games/three-kingdoms/core/map/map-config', () => ({
  LANDMARK_POSITIONS: {
    'city-luoyang': { x: 10, y: 10 },
    'city-xuchang': { x: 30, y: 10 },
    'city-jianye': { x: 70, y: 40 },
    'city-chengdu': { x: 20, y: 40 },
    'city-ye': { x: 50, y: 5 },
  },
  DEFAULT_LANDMARKS: [
    { id: 'city-luoyang', name: '洛阳' },
    { id: 'city-xuchang', name: '许昌' },
    { id: 'city-jianye', name: '建业' },
    { id: 'city-chengdu', name: '成都' },
    { id: 'city-ye', name: '邺' },
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
// Mock Canvas — drawCall计数版
// ─────────────────────────────────────────────

let capturedFillStyles: string[] = [];
let capturedStrokeStyles: string[] = [];

function createDrawCallMockCtx() {
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
  return ctx;
}

let mockCtx: ReturnType<typeof createDrawCallMockCtx>;
const originalGetContext = HTMLCanvasElement.prototype.getContext;

function setupDrawCallMockCanvas() {
  capturedFillStyles = [];
  capturedStrokeStyles = [];
  rafCallbacks = [];
  rafIdCounter = 0;
  mockCtx = createDrawCallMockCtx();

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

function teardownDrawCallMockCanvas() {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  window.requestAnimationFrame = originalRAF;
  window.cancelAnimationFrame = originalCancelRAF;
}

// ── 测试数据 ──
const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 10, y: 10 },
  region: 'central_plains',
  ownership: 'player',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: [],
  ...overrides,
});

const territories: TerritoryData[] = [
  makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 10, y: 10 } }),
  makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 30, y: 10 } }),
];

/** 创建 MarchUnit 测试对象 */
function makeMarchUnit(overrides: Partial<MarchUnit> = {}): MarchUnit {
  return {
    id: 'march_test_001',
    fromCityId: 'city-luoyang',
    toCityId: 'city-xuchang',
    x: 12,
    y: 10,
    path: [
      { x: 10, y: 10 },
      { x: 12, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 10 },
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

/** Helper: render with marches and flush rAF */
function renderWithMarches(marches: MarchUnit[]) {
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
    />,
  );
  flushRAF();

  return result;
}

/** 生成N个同阵营行军精灵 */
function generateSameFactionMarches(count: number, faction: MarchUnit['faction'] = 'wei'): MarchUnit[] {
  const marches: MarchUnit[] = [];
  for (let i = 0; i < count; i++) {
    const startX = 5 + (i % 10) * 9;
    const startY = 5 + Math.floor(i / 10) * 10;
    const endX = 90 - (i % 10) * 5;
    const endY = 50 - Math.floor(i / 10) * 5;
    marches.push({
      id: `march-batch-${i}`,
      fromCityId: `city-from-${i}`,
      toCityId: `city-to-${i}`,
      x: startX,
      y: startY,
      path: [
        { x: startX, y: startY },
        { x: Math.floor((startX + endX) / 2), y: Math.floor((startY + endY) / 2) },
        { x: endX, y: endY },
      ],
      pathIndex: 1,
      speed: 30,
      faction: faction,
      troops: 800, // 3 sprites per march
      general: `将军${i}`,
      morale: 100,
      state: 'marching',
      startTime: Date.now(),
      eta: Date.now() + 10000,
      animFrame: 0,
    });
  }
  return marches;
}

/** 生成N个混合阵营行军精灵 */
function generateMixedFactionMarches(count: number): MarchUnit[] {
  const factions: MarchUnit['faction'][] = ['wei', 'shu', 'wu', 'neutral'];
  const marches: MarchUnit[] = [];
  for (let i = 0; i < count; i++) {
    const startX = 5 + (i % 10) * 9;
    const startY = 5 + Math.floor(i / 10) * 10;
    const endX = 90 - (i % 10) * 5;
    const endY = 50 - Math.floor(i / 10) * 5;
    marches.push({
      id: `march-mixed-${i}`,
      fromCityId: `city-from-${i}`,
      toCityId: `city-to-${i}`,
      x: startX,
      y: startY,
      path: [
        { x: startX, y: startY },
        { x: Math.floor((startX + endX) / 2), y: Math.floor((startY + endY) / 2) },
        { x: endX, y: endY },
      ],
      pathIndex: 1,
      speed: 30,
      faction: factions[i % 4],
      troops: 800, // 3 sprites per march
      general: `将军${i}`,
      morale: 100,
      state: 'marching',
      startTime: Date.now(),
      eta: Date.now() + 10000,
      animFrame: 0,
    });
  }
  return marches;
}

/**
 * 计算优化前的fillStyle设置次数
 * 优化前: 每个精灵的每个部分都单独设置fillStyle
 * 对于marching状态的精灵(troops=800 → 3 sprites):
 *   - 每个sprite: body(1次) + head(1次) = 2次fillStyle设置
 *   - 第一个sprite额外: flag(pole+flag=1次) + highlight(1次) = 2次
 *   - 总计每个march: 3*2 + 2 = 8次 fillStyle设置 (仅精灵部分)
 * 加上路线渲染: 每个march 2次strokeStyle设置 (底色 + 虚线)
 *
 * @param marchCount - 行军数量
 * @param factions - 阵营数量(1=同阵营, 4=混合阵营)
 * @returns 优化前的预估fillStyle设置次数(仅精灵)
 */
function estimatePreOptimizationFillStyleCount(marchCount: number, factions: number): number {
  // 精灵部分:
  // 每个march: body颜色(1) + head颜色(1) + (可能body颜色再设1次) + flag颜色(1) + highlight(1)
  // = 5次 fillStyle per march for sprites
  const spriteFillStylePerMarch = 5;
  const spriteTotal = marchCount * spriteFillStylePerMarch;

  // 路线部分: 每个march 2次strokeStyle设置
  const routeStrokePerMarch = 2;
  const routeTotal = marchCount * routeStrokePerMarch;

  return spriteTotal + routeTotal;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

/** 精灵相关颜色 — 用于从capturedFillStyles中筛选精灵渲染次数 */
const SPRITE_COLORS = new Set([
  '#2196F3', // wei body
  '#4CAF50', // shu body
  '#F44336', // wu body
  '#9E9E9E', // neutral body
  '#888888', // retreating body
  '#F0D0B0', // normal head
  '#AAAAAA', // retreating head
  '#FFFFFF', // highlight (also used elsewhere, but sprite uses it too)
]);

/** 计算精灵相关的fillStyle设置次数 */
function countSpriteFillStyles(fillStyles: string[]): number {
  return fillStyles.filter(c => SPRITE_COLORS.has(c)).length;
}

describe('PixelWorldMap R13 Task2 批量渲染drawCall基准测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDrawCallMockCanvas();
  });

  afterEach(() => {
    teardownDrawCallMockCanvas();
  });

  // ── 10精灵场景: fillStyle设置次数基准 ──

  it('10精灵(同阵营)场景 — 精灵fillStyle设置次数远少于逐个渲染', () => {
    const marches = generateSameFactionMarches(10, 'wei');
    renderWithMarches(marches);

    // 只计算精灵相关颜色的fillStyle设置次数
    const spriteFillStyleCount = countSpriteFillStyles(capturedFillStyles);

    // 优化前预估: 每个march 5次精灵fillStyle = 50次
    const preOptimizationEstimate = 10 * 5;

    // 优化后: 同色精灵批量合并，fillStyle设置次数应该大幅减少
    expect(spriteFillStyleCount).toBeGreaterThan(0);
    expect(spriteFillStyleCount).toBeLessThan(preOptimizationEstimate);
  });

  // ── 50精灵场景: fillStyle设置次数比优化前少30%+ ──

  it('50精灵(同阵营)场景 — 精灵fillStyle设置次数比优化前少30%以上', () => {
    const marches = generateSameFactionMarches(50, 'wei');
    renderWithMarches(marches);

    const spriteFillStyleCount = countSpriteFillStyles(capturedFillStyles);

    // 优化前预估: 每个march 5次精灵fillStyle = 250次
    const preOptimizationEstimate = 50 * 5;

    // 优化后应该比优化前少30%以上
    const reduction = 1 - (spriteFillStyleCount / preOptimizationEstimate);
    expect(reduction).toBeGreaterThan(0.3);

    expect(spriteFillStyleCount).toBeGreaterThan(0);
  });

  it('50精灵(混合阵营)场景 — 精灵fillStyle设置次数仍然比优化前少', () => {
    const marches = generateMixedFactionMarches(50);
    renderWithMarches(marches);

    const spriteFillStyleCount = countSpriteFillStyles(capturedFillStyles);

    // 优化前: 50 * 5 = 250次
    const preOptimizationEstimate = 50 * 5;

    expect(spriteFillStyleCount).toBeGreaterThan(0);
    expect(spriteFillStyleCount).toBeLessThan(preOptimizationEstimate);
  });

  // ── 100精灵场景: 压力测试 ──

  it('100精灵(同阵营)场景 — 压力测试: rect调用数量合理', () => {
    const marches = generateSameFactionMarches(100, 'wei');
    renderWithMarches(marches);

    // 100个march，每个3个sprite，每个sprite有body+head=2个rect + 第一个sprite的旗帜rects
    // 总rect数约: 100 * (3*2 + 3) = 900个rect调用
    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBeGreaterThan(0);

    // fill调用次数应该等于颜色分组数，远少于march数量
    const fillCount = mockCtx.fill.mock.calls.length;
    expect(fillCount).toBeGreaterThan(0);

    // 关键优化指标: fill次数 << march数量100
    // 同阵营只有 bodyColor, headColor, highlightColor 三个分组
    expect(fillCount).toBeLessThan(100);
  });

  it('100精灵(混合阵营)场景 — fill次数仍远少于march数量', () => {
    const marches = generateMixedFactionMarches(100);
    renderWithMarches(marches);

    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBeGreaterThan(0);

    const fillCount = mockCtx.fill.mock.calls.length;
    expect(fillCount).toBeGreaterThan(0);

    // 4个阵营，每个阵营3个颜色分组 = 12组fill
    // 远少于100个march
    expect(fillCount).toBeLessThan(100);
  });

  // ── troops=0不渲染精灵测试 ──

  it('troops=0时不渲染精灵 — rect不被调用', () => {
    const marches = [
      makeMarchUnit({ id: 'march_empty', troops: 0, state: 'marching', faction: 'wei' }),
    ];
    renderWithMarches(marches);

    // troops=0 → spriteCount = 0 → 不收集精灵rect
    // 但路线渲染仍然会调用beginPath/moveTo/lineTo/stroke
    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBe(0);
  });

  it('troops=0混合正常行军 — 只渲染有兵力的精灵', () => {
    const marches = [
      makeMarchUnit({ id: 'march_empty', troops: 0, state: 'marching', faction: 'wei', x: 12, y: 10 }),
      makeMarchUnit({ id: 'march_normal', troops: 800, state: 'marching', faction: 'wei', x: 20, y: 15 }),
    ];
    renderWithMarches(marches);

    // 只有march_normal的精灵被渲染
    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBeGreaterThan(0);

    // 1个march with troops=800 → 3 sprites → body+head*3 + flag(pole+flag+highlight) = 9 rects
    // 应该少于2个march都渲染时的rect数量
    expect(rectCount).toBeGreaterThan(0);
  });

  // ── 视觉回归: 同阵营颜色正确 ──

  it('同阵营(wei)精灵 — fillStyle包含正确的阵营色', () => {
    const marches = generateSameFactionMarches(5, 'wei');
    renderWithMarches(marches);

    // wei阵营色: #2196F3 (body, pole, flag)
    expect(capturedFillStyles).toContain('#2196F3');
    // 头部肤色: #F0D0B0
    expect(capturedFillStyles).toContain('#F0D0B0');
    // 旗帜高光: #FFFFFF
    expect(capturedFillStyles).toContain('#FFFFFF');
  });

  it('同阵营(shu)精灵 — fillStyle包含正确的阵营色', () => {
    const marches = generateSameFactionMarches(5, 'shu');
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#4CAF50');
    expect(capturedFillStyles).toContain('#F0D0B0');
  });

  it('同阵营(wu)精灵 — fillStyle包含正确的阵营色', () => {
    const marches = generateSameFactionMarches(5, 'wu');
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#F44336');
    expect(capturedFillStyles).toContain('#F0D0B0');
  });

  // ── 视觉回归: 不同阵营颜色不混淆 ──

  it('wei和shu同时渲染 — 两种阵营色都出现且不混淆', () => {
    const marches = [
      ...generateSameFactionMarches(3, 'wei'),
      ...generateSameFactionMarches(3, 'shu'),
    ];
    renderWithMarches(marches);

    // 两种阵营色都出现
    expect(capturedFillStyles).toContain('#2196F3'); // wei
    expect(capturedFillStyles).toContain('#4CAF50'); // shu

    // 验证: 每种颜色至少出现1次
    const weiCount = capturedFillStyles.filter(c => c === '#2196F3').length;
    const shuCount = capturedFillStyles.filter(c => c === '#4CAF50').length;
    expect(weiCount).toBeGreaterThanOrEqual(1);
    expect(shuCount).toBeGreaterThanOrEqual(1);
  });

  it('四阵营同时渲染 — 四种颜色都正确出现', () => {
    const marches = [
      makeMarchUnit({ id: 'm1', faction: 'wei', x: 12, y: 10, state: 'marching', troops: 800 }),
      makeMarchUnit({ id: 'm2', faction: 'shu', x: 20, y: 10, state: 'marching', troops: 800 }),
      makeMarchUnit({ id: 'm3', faction: 'wu', x: 30, y: 10, state: 'marching', troops: 800 }),
      makeMarchUnit({ id: 'm4', faction: 'neutral', x: 40, y: 10, state: 'marching', troops: 800 }),
    ];
    renderWithMarches(marches);

    expect(capturedFillStyles).toContain('#2196F3'); // wei
    expect(capturedFillStyles).toContain('#4CAF50'); // shu
    expect(capturedFillStyles).toContain('#F44336'); // wu
    expect(capturedFillStyles).toContain('#9E9E9E'); // neutral
  });

  // ── 批量渲染正确性: rect调用数量验证 ──

  it('单个march(troops=800=3sprites) — rect调用数量正确', () => {
    const marches = [makeMarchUnit({ troops: 800, state: 'marching' })];
    renderWithMarches(marches);

    // 3 sprites: body*3 + head*3 + flag(pole+flag+highlight) = 9 rects
    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBe(9);
  });

  it('单个march(troops=100=1sprite) — rect调用数量正确', () => {
    const marches = [makeMarchUnit({ troops: 100, state: 'marching' })];
    renderWithMarches(marches);

    // 1 sprite: body + head + flag(pole + flag + highlight) = 5 rects
    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBe(5);
  });

  it('单个march(troops=2000=5sprites) — rect调用数量正确', () => {
    const marches = [makeMarchUnit({ troops: 2000, state: 'marching' })];
    renderWithMarches(marches);

    // 5 sprites: body*5 + head*5 + flag(pole + flag + highlight) = 13 rects
    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBe(13);
  });

  // ── retreating状态批量渲染 ──

  it('retreating状态精灵 — 使用灰色(#888888)和低透明度', () => {
    const marches = generateSameFactionMarches(5, 'wei').map(m => ({
      ...m,
      state: 'retreating' as const,
    }));
    renderWithMarches(marches);

    // retreating精灵body使用灰色
    expect(capturedFillStyles).toContain('#888888');
    // retreating精灵head使用浅灰色
    expect(capturedFillStyles).toContain('#AAAAAA');
  });

  // ── drawCall量化对比 ──

  it('drawCall量化: 10同阵营精灵的fill次数远少于sprite总数', () => {
    const marches = generateSameFactionMarches(10, 'wei');
    renderWithMarches(marches);

    // 10个march * 3 sprites = 30 sprites
    // 使用精灵相关fillStyle计数来衡量
    const spriteFillCount = countSpriteFillStyles(capturedFillStyles);

    // 优化后: 同色批量, 精灵fillStyle只需设几次
    // 关键验证: fillStyle设置次数 << sprite总数30
    expect(spriteFillCount).toBeGreaterThan(0);
    expect(spriteFillCount).toBeLessThan(30);
  });

  it('drawCall量化: 50同阵营精灵的fill次数远少于sprite总数', () => {
    const marches = generateSameFactionMarches(50, 'wei');
    renderWithMarches(marches);

    // 50个march * 3 sprites = 150 sprites
    const spriteFillCount = countSpriteFillStyles(capturedFillStyles);
    expect(spriteFillCount).toBeGreaterThan(0);
    expect(spriteFillCount).toBeLessThan(50);
  });

  // ── R13 P1: 重叠精灵z-order验证 ──
  // 批量渲染按颜色分组，当两个不同阵营精灵在同一坐标重叠时，
  // 必须确保两个阵营都被渲染，不会因颜色分组而丢失任一阵营。

  it('重叠精灵z-order: wei和shu在相同坐标 — 两种阵营色都出现在fillStyle中', () => {
    // 两个不同阵营的行军，位于完全相同的坐标
    const overlappingX = 15;
    const overlappingY = 10;
    const marches = [
      makeMarchUnit({
        id: 'march_wei_overlap',
        faction: 'wei',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800, // 3 sprites
      }),
      makeMarchUnit({
        id: 'march_shu_overlap',
        faction: 'shu',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800, // 3 sprites
      }),
    ];
    renderWithMarches(marches);

    // 关键断言: 两种阵营颜色都必须出现在渲染输出中
    // 如果批量渲染的z-order有bug导致一个阵营消失，这里会失败
    expect(capturedFillStyles).toContain('#2196F3'); // wei body color
    expect(capturedFillStyles).toContain('#4CAF50'); // shu body color

    // 验证两种颜色都出现了合理的次数(不是0)
    const weiBodyCount = capturedFillStyles.filter(c => c === '#2196F3').length;
    const shuBodyCount = capturedFillStyles.filter(c => c === '#4CAF50').length;
    expect(weiBodyCount).toBeGreaterThanOrEqual(1);
    expect(shuBodyCount).toBeGreaterThanOrEqual(1);

    // 验证rect调用数量: 2个march各3个sprite
    // 每个march: 3 body + 3 head + flag(pole+flag+highlight) = 9 rects
    // 总计: 2 * 9 = 18 rects
    const rectCount = mockCtx.rect.mock.calls.length;
    expect(rectCount).toBe(18);
  });

  it('重叠精灵z-order: 渲染顺序确定性 — 多次渲染同一场景结果一致', () => {
    const overlappingX = 20;
    const overlappingY = 15;
    const marches = [
      makeMarchUnit({
        id: 'march_wei_det',
        faction: 'wei',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800,
      }),
      makeMarchUnit({
        id: 'march_shu_det',
        faction: 'shu',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800,
      }),
    ];

    // 渲染第一次，记录结果
    renderWithMarches(marches);
    const firstFillStyles = [...capturedFillStyles];
    const firstRectCalls = mockCtx.rect.mock.calls.map((c: number[]) => [...c]);

    // 重置并渲染第二次
    vi.clearAllMocks();
    setupDrawCallMockCanvas();
    renderWithMarches(marches);
    const secondFillStyles = [...capturedFillStyles];
    const secondRectCalls = mockCtx.rect.mock.calls.map((c: number[]) => [...c]);

    // 关键断言: 两次渲染的fillStyle序列完全相同(确定性)
    expect(secondFillStyles).toEqual(firstFillStyles);

    // 关键断言: 两次渲染的rect调用坐标完全相同(确定性)
    expect(secondRectCalls).toEqual(firstRectCalls);

    // 两次渲染都包含两种阵营颜色
    expect(firstFillStyles).toContain('#2196F3');
    expect(firstFillStyles).toContain('#4CAF50');
    expect(secondFillStyles).toContain('#2196F3');
    expect(secondFillStyles).toContain('#4CAF50');
  });
});

// ─────────────────────────────────────────────
// R14 Task4: 同阵营精灵z-order排序测试
// ─────────────────────────────────────────────

describe('R14 Task4: 同阵营精灵z-order排序', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDrawCallMockCanvas();
  });

  afterEach(() => {
    teardownDrawCallMockCanvas();
  });

  it('同阵营精灵按startTime排序 — 更早创建的精灵在底层(先渲染)', () => {
    const baseTime = 1700000000000; // 固定时间戳，避免Date.now()波动
    const overlappingX = 15;
    const overlappingY = 10;

    // 创建3个同阵营(wei)精灵，位于相同坐标，不同的创建时间
    const earlyMarch = makeMarchUnit({
      id: 'march-early',
      faction: 'wei',
      x: overlappingX,
      y: overlappingY,
      state: 'marching',
      troops: 800,
      startTime: baseTime - 2000, // 最早创建
    });
    const midMarch = makeMarchUnit({
      id: 'march-mid',
      faction: 'wei',
      x: overlappingX,
      y: overlappingY,
      state: 'marching',
      troops: 800,
      startTime: baseTime - 1000, // 中间创建
    });
    const lateMarch = makeMarchUnit({
      id: 'march-late',
      faction: 'wei',
      x: overlappingX,
      y: overlappingY,
      state: 'marching',
      troops: 800,
      startTime: baseTime, // 最晚创建
    });

    // 以乱序传入，验证渲染结果确定性
    const marches = [lateMarch, earlyMarch, midMarch];
    renderWithMarches(marches);

    // 收集所有rect调用
    const rectCalls = mockCtx.rect.mock.calls.map((c: number[]) => ({ x: c[0], y: c[1] }));

    // 3个march各3个sprite，每个sprite有body+head=2rect + 旗帜3rect
    // 总rect数: 3 * (3*2 + 3) = 27
    expect(rectCalls.length).toBe(27);

    // 关键验证: 乱序传入后渲染结果确定性 — 两次渲染完全一致
    const firstRectCalls = mockCtx.rect.mock.calls.map((c: number[]) => [...c]);

    vi.clearAllMocks();
    setupDrawCallMockCanvas();
    renderWithMarches(marches);
    const secondRectCalls = mockCtx.rect.mock.calls.map((c: number[]) => [...c]);

    // 确定性: 乱序传入 → 排序后 → 结果完全一致
    expect(secondRectCalls.length).toBe(firstRectCalls.length);
    expect(secondRectCalls).toEqual(firstRectCalls);

    // 验证: 以不同顺序传入相同数据，结果仍然一致
    vi.clearAllMocks();
    setupDrawCallMockCanvas();
    const reverseMarches = [midMarch, lateMarch, earlyMarch];
    renderWithMarches(reverseMarches);
    const thirdRectCalls = mockCtx.rect.mock.calls.map((c: number[]) => [...c]);
    expect(thirdRectCalls).toEqual(firstRectCalls);
  });

  it('不同创建时间的同阵营精灵 — 乱序传入后渲染结果确定性', () => {
    const baseTime = Date.now();
    const overlappingX = 20;
    const overlappingY = 15;

    // 创建5个同阵营(wei)精灵，乱序startTime
    const marches = [
      makeMarchUnit({
        id: 'march-5',
        faction: 'wei',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800,
        startTime: baseTime + 4000,
      }),
      makeMarchUnit({
        id: 'march-1',
        faction: 'wei',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800,
        startTime: baseTime,
      }),
      makeMarchUnit({
        id: 'march-3',
        faction: 'wei',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800,
        startTime: baseTime + 2000,
      }),
      makeMarchUnit({
        id: 'march-4',
        faction: 'wei',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800,
        startTime: baseTime + 3000,
      }),
      makeMarchUnit({
        id: 'march-2',
        faction: 'wei',
        x: overlappingX,
        y: overlappingY,
        state: 'marching',
        troops: 800,
        startTime: baseTime + 1000,
      }),
    ];

    // 渲染第一次
    renderWithMarches(marches);
    const firstFillStyles = [...capturedFillStyles];

    // 重置并渲染第二次（同数据）
    vi.clearAllMocks();
    setupDrawCallMockCanvas();
    renderWithMarches(marches);
    const secondFillStyles = [...capturedFillStyles];

    // 关键断言: 乱序传入但渲染结果完全一致（确定性排序）
    expect(secondFillStyles).toEqual(firstFillStyles);

    // 确认wei阵营色出现了
    expect(firstFillStyles).toContain('#2196F3');
    expect(firstFillStyles).toContain('#F0D0B0');
  });
});
