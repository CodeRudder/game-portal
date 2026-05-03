/**
 * 大地图性能测试
 *
 * 测试编辑器和渲染器在大地图上的性能表现
 */

import { describe, it, expect } from 'vitest';
import { MapEditor } from '../editor/MapEditor';
import { ASCIIMapParser } from '../../../core/map/ASCIIMapParser';

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
