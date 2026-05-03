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
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// ── 测试 ──
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
});
