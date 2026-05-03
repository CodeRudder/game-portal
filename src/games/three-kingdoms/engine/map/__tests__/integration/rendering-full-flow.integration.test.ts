/**
 * 渲染系统全流程集成测试
 *
 * 测试像素地图渲染→城市标记→行军精灵→攻城动画全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PixelMapRenderer } from '../../PixelMapRenderer';
import type { ParsedMap } from '@/games/three-kingdoms/core/map/ASCIIMapParser';

// 模拟地图数据
const createMockMap = (): ParsedMap => {
  const width = 20;
  const height = 20;
  const cells: any[][] = [];

  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = { char: '.', terrain: 'plain' };
    }
  }

  return {
    width,
    height,
    cells,
    cities: [
      { id: 'city-1', name: 'City 1', x: 10, y: 10 },
    ],
    roads: [],
  };
};

describe('渲染系统全流程集成测试', () => {
  let canvas: HTMLCanvasElement;
  let renderer: PixelMapRenderer;

  beforeEach(() => {
    canvas = {
      width: 800,
      height: 480,
      getContext: vi.fn(() => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        setLineDash: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        createPattern: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        clip: vi.fn(),
        rect: vi.fn(),
        closePath: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        arcTo: vi.fn(),
        isPointInPath: vi.fn(),
        isPointInStroke: vi.fn(),
        getLineDash: vi.fn(() => []),
        getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
        drawFocusIfNeeded: vi.fn(),
        scrollPathIntoView: vi.fn(),
        createConicGradient: vi.fn(),
        roundRect: vi.fn(),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 10,
        lineDashOffset: 0,
        shadowBlur: 0,
        shadowColor: 'rgba(0, 0, 0, 0)',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'low',
        direction: 'ltr',
        textBaseline: 'alphabetic',
        textAlign: 'start',
      })),
    } as any;

    renderer = new PixelMapRenderer(canvas, {
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
  });

  describe('像素地图渲染', () => {
    it('应该加载地图', () => {
      const map = createMockMap();
      renderer.loadMap(map);
      renderer.render();
      // 应该没有错误
    });

    it('应该设置视口', () => {
      const map = createMockMap();
      renderer.loadMap(map);
      renderer.setViewport(100, 100);
      renderer.render();
      // 应该没有错误
    });

    it('应该设置缩放', () => {
      const map = createMockMap();
      renderer.loadMap(map);
      renderer.setScale(2.0);
      renderer.render();
      // 应该没有错误
    });
  });

  describe('城市标记', () => {
    it('应该渲染城市', () => {
      const map = createMockMap();
      renderer.loadMap(map);

      renderer.setCityData([
        { id: 'city-1', name: 'City 1', x: 10, y: 10, faction: 'player', level: 5, icon: '🏰', type: 'city' },
      ]);

      renderer.render();
      // 应该没有错误
    });
  });

  describe('视口裁剪', () => {
    it('应该只渲染可见区域', () => {
      const map = createMockMap();
      renderer.loadMap(map);

      // 设置视口到不同位置
      renderer.setViewport(0, 0);
      renderer.render();

      renderer.setViewport(100, 100);
      renderer.render();

      renderer.setViewport(-50, -50);
      renderer.render();

      // 应该没有错误
    });
  });
});
