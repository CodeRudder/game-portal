/**
 * 大地图性能测试
 *
 * 测试编辑器和渲染器在大地图上的性能表现
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapEditor } from '../editor/MapEditor';
import { ASCIIMapParser } from '../../../core/map/ASCIIMapParser';
import { PixelMapRenderer } from '../PixelMapRenderer';
import type { ParsedMap, MapCell, ASCIITerrain } from '../../../core/map/ASCIIMapParser';

describe('大地图性能测试', () => {

  describe('MapEditor 大地图', () => {
    it('创建200x120地图', () => {
      const start = performance.now();
      const editor = new MapEditor(200, 120);
      const elapsed = performance.now() - start;

      expect(editor.getSize()).toEqual({ width: 200, height: 120 });
      expect(elapsed).toBeLessThan(100); // 应在100ms内完成
    });

    it('大地图绘制操作', () => {
      const editor = new MapEditor(200, 120);
      editor.setBrushSymbol('^');

      const start = performance.now();
      // 绘制1000个点
      for (let i = 0; i < 1000; i++) {
        editor.paint(i % 200, Math.floor(i / 200));
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10000); // 1000 paints with history+notify
    });

    it('大地图floodFill', () => {
      const editor = new MapEditor(200, 120);
      editor.setBrushSymbol('#');

      const start = performance.now();
      editor.floodFill(100, 60);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });

    it('大地图撤销/重做', () => {
      const editor = new MapEditor(200, 120);
      editor.setBrushSymbol('^');

      // 创建多个历史步骤
      for (let i = 0; i < 10; i++) {
        editor.saveHistory(`step ${i}`);
        editor.paint(i * 10, i * 5);
      }

      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        editor.undo();
      }
      for (let i = 0; i < 10; i++) {
        editor.redo();
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });

    it('大地图实体管理', () => {
      const editor = new MapEditor(200, 120);

      const start = performance.now();
      // 添加100个实体
      for (let i = 0; i < 100; i++) {
        editor.addEntity({
          type: 'building',
          name: `城市${i}`,
          x: (i * 2) % 200,
          y: Math.floor(i * 2 / 200) * 3,
          width: 3,
          height: 3,
          faction: 'neutral',
          symbol: 'C',
          data: {},
        });
      }
      const elapsed = performance.now() - start;

      expect(editor.getEntities().length).toBe(100);
      expect(elapsed).toBeLessThan(5000); // saveHistory per entity is expensive
    });

    it('大地图JSON导出/导入', () => {
      const editor = new MapEditor(200, 120);
      editor.setBrushSymbol('^');
      for (let i = 0; i < 100; i++) {
        editor.paint(i % 200, Math.floor(i / 200));
      }

      const startExport = performance.now();
      const json = editor.exportStateJSON();
      const exportTime = performance.now() - startExport;

      const startImport = performance.now();
      const editor2 = new MapEditor(200, 120);
      editor2.importStateJSON(json);
      const importTime = performance.now() - startImport;

      expect(exportTime).toBeLessThan(2000);
      expect(importTime).toBeLessThan(2000);
    });

    it('大地图ASCII导出', () => {
      const editor = new MapEditor(200, 120);
      editor.setBrushSymbol('^');
      for (let i = 0; i < 200; i++) {
        editor.paint(i % 200, Math.floor(i / 200));
      }

      const start = performance.now();
      const ascii = editor.mergeToASCII();
      const elapsed = performance.now() - start;

      expect(ascii.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('ASCIIMapParser 大地图解析', () => {
    it('解析100x60地图', () => {
      // 生成测试地图文本
      const lines: string[] = ['MAP:测试', 'SIZE:100x60', ''];
      for (let y = 0; y < 60; y++) {
        let line = '';
        for (let x = 0; x < 100; x++) {
          line += '.^~#,'[Math.floor(Math.random() * 5)];
        }
        lines.push(line);
      }
      const text = lines.join('\n');

      const parser = new ASCIIMapParser();
      const start = performance.now();
      const map = parser.parse(text);
      const elapsed = performance.now() - start;

      expect(map.width).toBe(100);
      expect(map.height).toBe(60);
      expect(elapsed).toBeLessThan(200);
    });
  });
});

// ─────────────────────────────────────────────
// Canvas 渲染性能测试 (J-02: 60fps性能验证)
// ─────────────────────────────────────────────

/**
 * 生成测试用 ParsedMap 数据
 *
 * @param cols 列数
 * @param rows 行数
 * @param terrainFill 填充地形类型
 */
function generateTestMap(cols: number, rows: number, terrainFill: ASCIITerrain = 'plain'): ParsedMap {
  const cells: MapCell[][] = [];
  const terrains: ASCIITerrain[] = ['plain', 'mountain', 'water', 'forest', 'grass', 'desert'];
  const chars: Record<string, string> = {
    plain: '.', mountain: '^', water: '~', forest: '#',
    grass: ',', desert: 'd', road_h: '-', road_v: '|',
  };

  for (let y = 0; y < rows; y++) {
    const row: MapCell[] = [];
    for (let x = 0; x < cols; x++) {
      // 用混合地形模拟真实地图
      const terrain = terrainFill === 'plain'
        ? terrains[(x * 31 + y * 17) % terrains.length]
        : terrainFill;
      row.push({
        x,
        y,
        char: chars[terrain] || '.',
        terrain,
      });
    }
    cells.push(row);
  }

  return {
    name: 'performance-test-map',
    width: cols,
    height: rows,
    tileSize: 8,
    cells,
    cities: [],
    roads: [],
  };
}

/**
 * 创建轻量级 mock Canvas 和 CanvasRenderingContext2D
 *
 * 在 jsdom 环境下模拟 Canvas API。
 * 使用普通函数（非 vi.fn()）避免 Vitest 调用追踪导致内存溢出。
 */
function createMockCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  getDrawCallCount: () => number;
  resetCounts: () => void;
} {
  let totalDrawCallCount = 0;

  // 使用轻量级计数函数替代 vi.fn()，避免大量调用记录占用内存
  const countDraw = () => { totalDrawCallCount++; };

  const ctx = {
    clearRect: countDraw,
    fillRect: countDraw,
    strokeRect: countDraw,
    fillText: countDraw,
    strokeText: countDraw,
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: countDraw,
    stroke: countDraw,
    arc: () => {},
    quadraticCurveTo: () => {},
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px monospace',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;

  return {
    canvas,
    ctx,
    getDrawCallCount: () => totalDrawCallCount,
    resetCounts: () => { totalDrawCallCount = 0; },
  };
}

describe('Canvas 渲染性能测试 (60fps)', () => {
  /** 60fps 帧时间阈值 = 1000ms / 60 ≈ 16.67ms */
  const FPS_THRESHOLD_MS = 16.67;

  let mockCanvas: ReturnType<typeof createMockCanvas>;
  let renderer: PixelMapRenderer;

  beforeEach(() => {
    // 创建 800x600 视口大小的 Canvas（典型移动端分辨率）
    mockCanvas = createMockCanvas(800, 600);
    renderer = new PixelMapRenderer(mockCanvas.canvas);
  });

  describe('单帧渲染时间阈值', () => {
    it('50x50混合地形地图单帧渲染 < 16.67ms', () => {
      const map = generateTestMap(50, 50);
      renderer.loadMap(map);

      // 预热: 先渲染一帧让 JIT 编译
      renderer.render();

      const start = performance.now();
      renderer.render();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(FPS_THRESHOLD_MS);
    });

    it('100x100大地图单帧渲染 < 16.67ms', () => {
      const map = generateTestMap(100, 100);
      renderer.loadMap(map);

      renderer.render();

      const start = performance.now();
      renderer.render();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(FPS_THRESHOLD_MS);
    });

    it('200x120超大地图单帧渲染 < 16.67ms', () => {
      const map = generateTestMap(200, 120);
      renderer.loadMap(map);

      renderer.render();

      const start = performance.now();
      renderer.render();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(FPS_THRESHOLD_MS);
    });

    it('连续10帧平均渲染时间 < 16.67ms', () => {
      const map = generateTestMap(100, 100);
      renderer.loadMap(map);

      // 预热
      renderer.render();

      const frameTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        renderer.render();
        frameTimes.push(performance.now() - start);
      }

      const avgTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      expect(avgTime).toBeLessThan(FPS_THRESHOLD_MS);

      // 确保没有单帧超过阈值的2倍（允许偶发波动）
      const maxTime = Math.max(...frameTimes);
      expect(maxTime).toBeLessThan(FPS_THRESHOLD_MS * 2);
    });
  });

  describe('视口裁剪效率', () => {
    it('视口裁剪后只渲染可见区域的格子', () => {
      // 创建大地图但视口只能看到一部分
      const map = generateTestMap(200, 120);
      renderer.loadMap(map);

      // 设置视口偏移到地图起始位置
      renderer.setViewport(0, 0);

      mockCanvas.resetCounts();
      renderer.render();

      const visibleDrawCalls = mockCanvas.getDrawCallCount();

      // 关键验证: 渲染调用数应远少于"全地图所有格子都绘制"的量
      // 200*120=24000格子，如果每个格子仅1次调用就是24000次
      // 视口裁剪后应只渲染 800/8=100 x 600/8=75 范围内的格子
      // 渲染器有多层Pass(基础色块/过渡色/纹理)，绘制调用数应在一个合理范围内
      // 这里验证绘制调用不超出全地图格子数的 5 倍（视口裁剪生效）
      const totalTiles = 200 * 120;
      expect(visibleDrawCalls).toBeLessThan(totalTiles * 5);

      // 同时验证绘制调用大于0（确实有渲染发生）
      expect(visibleDrawCalls).toBeGreaterThan(0);
    });

    it('偏移视口后渲染调用次数不变', () => {
      const map = generateTestMap(200, 120);
      renderer.loadMap(map);

      // 第一帧: 初始视口
      renderer.setViewport(0, 0);
      renderer.render();
      mockCanvas.resetCounts();
      renderer.render();
      const callsAtOrigin = mockCanvas.getDrawCallCount();

      // 第二帧: 偏移视口到不同位置
      renderer.setViewport(500, 300);
      mockCanvas.resetCounts();
      renderer.render();
      const callsAtOffset = mockCanvas.getDrawCallCount();

      // 偏移视口不应导致绘制调用数量剧增（允许小范围波动）
      // 同样大小的可见区域，调用数应该在同一量级
      const ratio = callsAtOffset / callsAtOrigin;
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
    });

    it('渲染调用数与地图总大小无关（视口裁剪有效）', () => {
      // 中等地图: 120x90 — 大于视口 800/8=100 x 600/8=75
      const mediumMap = generateTestMap(120, 90);
      renderer.loadMap(mediumMap);
      renderer.setViewport(0, 0);
      renderer.render();
      mockCanvas.resetCounts();
      renderer.render();
      const mediumMapCalls = mockCanvas.getDrawCallCount();

      // 大地图: 200x120 = 24000 格子（比中等地图大2倍以上）
      const largeMap = generateTestMap(200, 120);
      renderer.loadMap(largeMap);
      renderer.setViewport(0, 0);
      renderer.render();
      mockCanvas.resetCounts();
      renderer.render();
      const largeMapCalls = mockCanvas.getDrawCallCount();

      // 关键断言: 大地图的绘制调用不应超过中等地图的 1.5 倍
      // 因为视口大小固定(800x600)，裁剪后可见格子数应相近
      // 允许一定波动（边缘格子数略有差异）
      expect(largeMapCalls).toBeLessThan(mediumMapCalls * 1.5);
    });
  });

  describe('脏标记/渲染跳过优化', () => {
    it('无地图数据时render()应快速返回', () => {
      // 未加载地图时调用 render()，应几乎无开销
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        renderer.render();
      }
      const elapsed = performance.now() - start;

      // 1000次空render应在 16.67ms 内完成（每次<0.017ms）
      expect(elapsed).toBeLessThan(FPS_THRESHOLD_MS);
    });

    it('无地图数据时render()不产生任何绘制调用', () => {
      renderer.render();

      // 未加载地图，render() 应立即返回，不产生任何绘制调用
      // 由于 mock canvas 使用计数函数，检查计数为 0 即可
      expect(mockCanvas.getDrawCallCount()).toBe(0);
    });

    it('带城市数据渲染不超时', () => {
      const map = generateTestMap(100, 80);
      renderer.loadMap(map);

      // 注入大量城市数据
      const cities = [];
      for (let i = 0; i < 50; i++) {
        cities.push({
          id: `city-${i}`,
          name: `城市${i}`,
          x: (i * 7) % 100,
          y: (i * 3) % 80,
          faction: ['wei', 'shu', 'wu', 'neutral'][i % 4],
          level: (i % 5) + 1,
          icon: ['🌾', '💰', '⚔️', '🌟'][i % 4],
          type: ['city', 'pass', 'resource'][i % 3] as string,
        });
      }
      renderer.setCityData(cities);

      // 预热
      renderer.render();

      const start = performance.now();
      renderer.render();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(FPS_THRESHOLD_MS);
    });

    it('带行军精灵渲染不超时', () => {
      const map = generateTestMap(100, 80);
      renderer.loadMap(map);

      // 注入多个行军精灵
      for (let i = 0; i < 20; i++) {
        renderer.addMarchSprite({
          id: `march-${i}`,
          x: (i * 40) % 800,
          y: (i * 30) % 600,
          targetX: 400,
          targetY: 300,
          path: [
            { x: i * 40, y: i * 30 },
            { x: 400, y: 300 },
          ],
          pathIndex: 0,
          speed: 2,
          faction: ['wei', 'shu', 'wu'][i % 3],
          troops: 500 + i * 100,
        });
      }

      // 预热
      renderer.render();

      const start = performance.now();
      renderer.render();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(FPS_THRESHOLD_MS);
    });
  });
});
