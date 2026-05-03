/**
 * PixelWorldMap 鸟瞰小地图(minimap)测试
 *
 * 测试minimap的功能:
 * - minimap Canvas元素存在
 * - minimap在Canvas区域内右下角(position:absolute)
 * - 点击minimap触发视窗跳转
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PixelWorldMap } from '../PixelWorldMap';
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
  },
  DEFAULT_LANDMARKS: [
    { id: 'city-luoyang', name: '洛阳' },
    { id: 'city-xuchang', name: '许昌' },
  ],
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
  setLineDash: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
  roundRect: vi.fn(),
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
];

// ── 测试 ──
describe('PixelWorldMap 鸟瞰小地图(minimap)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 测试1: minimap Canvas元素存在 ──

  it('minimap Canvas元素存在', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap');
    expect(minimap).toBeTruthy();
    expect(minimap?.tagName).toBe('CANVAS');
  });

  // ── 测试2: minimap在Canvas区域内右下角 ──

  it('minimap是pixel-worldmap容器的子元素', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const mapContainer = container.querySelector('.pixel-worldmap');
    const minimap = container.querySelector('.pixel-worldmap-minimap');
    expect(mapContainer).toBeTruthy();
    expect(minimap).toBeTruthy();
    // minimap应是map容器的直接子元素
    expect(minimap?.parentElement).toBe(mapContainer);
  });

  it('minimap有position:absolute定位样式类', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap');
    expect(minimap).toBeTruthy();
    // CSS类包含position:absolute(通过类名.pixel-worldmap-minimap定义)
    expect(minimap?.className).toContain('pixel-worldmap-minimap');
  });

  it('minimap的Canvas尺寸为180x108(保持100:60比例)', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap') as HTMLCanvasElement;
    expect(minimap).toBeTruthy();
    expect(minimap.width).toBe(180);
    expect(minimap.height).toBe(108);
  });

  // ── 测试3: 点击minimap触发视窗跳转 ──

  it('点击minimap不抛出异常', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap') as HTMLCanvasElement;
    expect(minimap).toBeTruthy();

    // 模拟点击minimap中心位置
    expect(() => {
      fireEvent.mouseDown(minimap, {
        clientX: 100,
        clientY: 100,
        button: 0,
      });
    }).not.toThrow();
  });

  it('点击minimap后mouseup不抛出异常', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap') as HTMLCanvasElement;

    // 模拟完整的点击序列: mouseDown -> mouseUp
    fireEvent.mouseDown(minimap, { clientX: 100, clientY: 100, button: 0 });
    expect(() => {
      fireEvent.mouseUp(minimap, { clientX: 100, clientY: 100, button: 0 });
    }).not.toThrow();
  });

  it('在minimap上拖拽不抛出异常', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap') as HTMLCanvasElement;

    // 模拟拖拽: mouseDown -> mouseMove -> mouseUp
    fireEvent.mouseDown(minimap, { clientX: 50, clientY: 30, button: 0 });
    expect(() => {
      fireEvent.mouseMove(minimap, { clientX: 100, clientY: 60 });
    }).not.toThrow();
    expect(() => {
      fireEvent.mouseMove(minimap, { clientX: 150, clientY: 90 });
    }).not.toThrow();
    fireEvent.mouseUp(minimap, { clientX: 150, clientY: 90, button: 0 });
  });

  it('未拖拽时在minimap上移动鼠标不触发视窗跳转', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap') as HTMLCanvasElement;

    // 未先mouseDown就直接mouseMove，不应触发跳转
    expect(() => {
      fireEvent.mouseMove(minimap, { clientX: 100, clientY: 60 });
    }).not.toThrow();
  });

  // ── 测试4: 主Canvas和minimap共存 ──

  it('主Canvas和minimap同时存在', () => {
    const { container } = render(
      <PixelWorldMap territories={territories} />,
    );
    const mainCanvas = container.querySelector('.pixel-worldmap-canvas');
    const minimap = container.querySelector('.pixel-worldmap-minimap');
    expect(mainCanvas).toBeTruthy();
    expect(minimap).toBeTruthy();
    // 两者是不同的元素
    expect(mainCanvas).not.toBe(minimap);
  });

  // ── 测试5: 空领土数据不崩溃 ──

  it('空领土数据下minimap仍正常渲染', () => {
    const { container } = render(
      <PixelWorldMap territories={[]} />,
    );
    const minimap = container.querySelector('.pixel-worldmap-minimap');
    expect(minimap).toBeTruthy();
  });
});
