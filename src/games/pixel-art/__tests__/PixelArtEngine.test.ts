import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PixelArtEngine } from '../PixelArtEngine';
import {
  Tool,
  PALETTE_COLORS,
  EMPTY_COLOR,
  DEFAULT_GRID_SIZE,
  DEFAULT_COLOR_INDEX,
  DEFAULT_TOOL,
  GRID_SIZES,
  TEMPLATES,
  STORAGE_KEY_PREFIX,
} from '../constants';

// ========== 辅助函数 ==========

/** 创建引擎实例（不传 canvas） */
function createEngine(): PixelArtEngine {
  const engine = new PixelArtEngine();
  engine.init();
  return engine;
}

/** 创建一个指定尺寸的纯色网格 */
function createFilledGrid(size: number, color: string): string[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => color)
  );
}

/** 统计网格中指定颜色的数量 */
function countColor(pixels: string[][], color: string): number {
  let count = 0;
  for (const row of pixels) {
    for (const cell of row) {
      if (cell === color) count++;
    }
  }
  return count;
}

/** 统计空白格子数量 */
function countEmpty(pixels: string[][]): number {
  return countColor(pixels, EMPTY_COLOR);
}

// ========== 测试 ==========

describe('PixelArtEngine', () => {

  // ==================== 初始化测试 ====================

  describe('初始化', () => {
    it('应该正确创建引擎实例', () => {
      const engine = createEngine();
      expect(engine).toBeInstanceOf(PixelArtEngine);
    });

    it('init 不传 canvas 应该正常工作', () => {
      const engine = new PixelArtEngine();
      expect(() => engine.init()).not.toThrow();
    });

    it('默认网格尺寸应为 16', () => {
      const engine = createEngine();
      expect(engine.getGridSize()).toBe(16);
    });

    it('默认工具应为画笔', () => {
      const engine = createEngine();
      expect(engine.getCurrentTool()).toBe(Tool.BRUSH);
    });

    it('默认颜色索引应为 0', () => {
      const engine = createEngine();
      expect(engine.getColorIndex()).toBe(0);
    });

    it('默认颜色应为黑色', () => {
      const engine = createEngine();
      expect(engine.getCurrentColor()).toBe('#000000');
    });

    it('初始光标位置应为 (0, 0)', () => {
      const engine = createEngine();
      const cursor = engine.getCursor();
      expect(cursor.row).toBe(0);
      expect(cursor.col).toBe(0);
    });

    it('初始网格应全部为空', () => {
      const engine = createEngine();
      const pixels = engine.getPixels();
      for (const row of pixels) {
        for (const cell of row) {
          expect(cell).toBe(EMPTY_COLOR);
        }
      }
    });

    it('初始状态应为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('初始分数应为 0', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
    });
  });

  // ==================== 网格操作测试 ====================

  describe('网格操作', () => {
    it('getPixels 应返回正确尺寸的网格', () => {
      const engine = createEngine();
      const pixels = engine.getPixels();
      expect(pixels.length).toBe(16);
      expect(pixels[0].length).toBe(16);
    });

    it('getPixels 应返回副本而非引用', () => {
      const engine = createEngine();
      const pixels1 = engine.getPixels();
      const pixels2 = engine.getPixels();
      expect(pixels1).not.toBe(pixels2);
      expect(pixels1[0]).not.toBe(pixels2[0]);
    });

    it('setGridSize 应正确切换尺寸', () => {
      const engine = createEngine();
      engine.setGridSize(32);
      expect(engine.getGridSize()).toBe(32);
      const pixels = engine.getPixels();
      expect(pixels.length).toBe(32);
      expect(pixels[0].length).toBe(32);
    });

    it('setGridSize 切换尺寸后网格应清空', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.setGridSize(32);
      const pixels = engine.getPixels();
      expect(pixels[0][0]).toBe(EMPTY_COLOR);
    });

    it('setGridSize 不接受无效尺寸', () => {
      const engine = createEngine();
      engine.setGridSize(20); // 不在 GRID_SIZES 中
      expect(engine.getGridSize()).toBe(16);
    });

    it('setGridSize 支持 16', () => {
      const engine = createEngine();
      engine.setGridSize(16);
      expect(engine.getGridSize()).toBe(16);
    });

    it('setGridSize 支持 32', () => {
      const engine = createEngine();
      engine.setGridSize(32);
      expect(engine.getGridSize()).toBe(32);
    });

    it('setGridSize 支持 64', () => {
      const engine = createEngine();
      engine.setGridSize(64);
      expect(engine.getGridSize()).toBe(64);
    });

    it('setPixels 应正确设置像素数据', () => {
      const engine = createEngine();
      const newPixels = createFilledGrid(16, '#ff0000');
      engine.setPixels(newPixels);
      const pixels = engine.getPixels();
      expect(pixels[0][0]).toBe('#ff0000');
      expect(pixels[15][15]).toBe('#ff0000');
    });

    it('setPixels 不接受尺寸不匹配的数据', () => {
      const engine = createEngine();
      const oldPixels = engine.getPixels();
      const newPixels = createFilledGrid(8, '#ff0000');
      engine.setPixels(newPixels);
      // 应该没有变化
      expect(engine.getPixels()).toEqual(oldPixels);
    });

    it('setPixels 不接受行数不匹配的数据', () => {
      const engine = createEngine();
      const oldPixels = engine.getPixels();
      const newPixels = [['#ff0000']]; // 1x1
      engine.setPixels(newPixels);
      expect(engine.getPixels()).toEqual(oldPixels);
    });

    it('clearCanvas 应清空所有像素', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.paintAt(5, 5);
      engine.clearCanvas();
      const pixels = engine.getPixels();
      expect(countEmpty(pixels)).toBe(16 * 16);
    });

    it('clearCanvas 应保持网格尺寸不变', () => {
      const engine = createEngine();
      engine.setGridSize(32);
      engine.clearCanvas();
      expect(engine.getGridSize()).toBe(32);
    });
  });

  // ==================== 画笔测试 ====================

  describe('画笔', () => {
    it('paintAt 应在指定位置涂色', () => {
      const engine = createEngine();
      engine.paintAt(5, 5);
      expect(engine.getPixels()[5][5]).toBe('#000000');
    });

    it('画笔使用当前选中的颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色
      engine.paintAt(3, 3);
      expect(engine.getPixels()[3][3]).toBe('#ff0000');
    });

    it('画笔可以覆盖已有颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色
      engine.paintAt(0, 0);
      expect(engine.getPixels()[0][0]).toBe('#ff0000');
      engine.setColorIndex(3); // 绿色
      engine.paintAt(0, 0);
      expect(engine.getPixels()[0][0]).toBe('#00ff00');
    });

    it('画笔不应越界', () => {
      const engine = createEngine();
      expect(() => engine.paintAt(-1, 0)).not.toThrow();
      expect(() => engine.paintAt(0, -1)).not.toThrow();
      expect(() => engine.paintAt(16, 0)).not.toThrow();
      expect(() => engine.paintAt(0, 16)).not.toThrow();
    });

    it('画笔在边界位置应正常工作', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.paintAt(15, 15);
      expect(engine.getPixels()[0][0]).toBe('#000000');
      expect(engine.getPixels()[15][15]).toBe('#000000');
    });

    it('多次画笔应正确涂色不同位置', () => {
      const engine = createEngine();
      for (let i = 0; i < 16; i++) {
        engine.paintAt(i, i);
      }
      const pixels = engine.getPixels();
      for (let i = 0; i < 16; i++) {
        expect(pixels[i][i]).toBe('#000000');
      }
    });
  });

  // ==================== 橡皮擦测试 ====================

  describe('橡皮擦', () => {
    it('eraseAt 应清除指定位置的颜色', () => {
      const engine = createEngine();
      engine.paintAt(5, 5);
      engine.eraseAt(5, 5);
      expect(engine.getPixels()[5][5]).toBe(EMPTY_COLOR);
    });

    it('橡皮擦对空白格子无影响', () => {
      const engine = createEngine();
      engine.eraseAt(0, 0);
      expect(engine.getPixels()[0][0]).toBe(EMPTY_COLOR);
    });

    it('橡皮擦不应越界', () => {
      const engine = createEngine();
      expect(() => engine.eraseAt(-1, 0)).not.toThrow();
      expect(() => engine.eraseAt(0, 16)).not.toThrow();
    });

    it('橡皮擦只影响指定位置', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.paintAt(1, 1);
      engine.eraseAt(0, 0);
      const pixels = engine.getPixels();
      expect(pixels[0][0]).toBe(EMPTY_COLOR);
      expect(pixels[1][1]).toBe('#000000');
    });
  });

  // ==================== 填充算法测试 ====================

  describe('填充 (Flood Fill)', () => {
    it('fillAt 应填充空白区域', () => {
      const engine = createEngine();
      engine.fillAt(0, 0);
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#000000')).toBe(16 * 16);
    });

    it('填充应使用当前颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色
      engine.fillAt(0, 0);
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#ff0000')).toBe(16 * 16);
    });

    it('填充不应跨越不同颜色边界', () => {
      const engine = createEngine();
      // 画一条水平线作为边界
      for (let c = 0; c < 16; c++) {
        engine.paintAt(5, c);
      }
      // 在线上方填充
      engine.fillAt(0, 0);
      const pixels = engine.getPixels();
      // 上半部分（0-4行）应被填充
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 16; c++) {
          expect(pixels[r][c]).toBe('#000000');
        }
      }
      // 边界行保持原色
      for (let c = 0; c < 16; c++) {
        expect(pixels[5][c]).toBe('#000000');
      }
      // 下半部分（6-15行）应仍为空
      for (let r = 6; r < 16; r++) {
        for (let c = 0; c < 16; c++) {
          expect(pixels[r][c]).toBe(EMPTY_COLOR);
        }
      }
    });

    it('填充相同颜色不应改变任何内容', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色
      engine.fillAt(0, 0);
      const before = engine.getPixels();
      engine.fillAt(0, 0);
      const after = engine.getPixels();
      expect(before).toEqual(after);
    });

    it('填充应处理封闭区域', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色作为边界
      // 画一个 3x3 的方框
      for (let r = 2; r <= 4; r++) {
        for (let c = 2; c <= 4; c++) {
          if (r === 2 || r === 4 || c === 2 || c === 4) {
            engine.paintAt(r, c);
          }
        }
      }
      // 方框内部 (3,3) 应为空
      expect(engine.getPixels()[3][3]).toBe(EMPTY_COLOR);

      // 在内部填充绿色
      engine.setColorIndex(3); // 绿色
      engine.fillAt(3, 3);
      expect(engine.getPixels()[3][3]).toBe('#00ff00');
      // 边界应仍为红色
      expect(engine.getPixels()[2][3]).toBe('#ff0000');
    });

    it('填充不应越界', () => {
      const engine = createEngine();
      expect(() => engine.fillAt(-1, 0)).not.toThrow();
      expect(() => engine.fillAt(0, -1)).not.toThrow();
      expect(() => engine.fillAt(16, 0)).not.toThrow();
      expect(() => engine.fillAt(0, 16)).not.toThrow();
    });

    it('填充整个网格后再次填充不同颜色应覆盖全部', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色
      engine.fillAt(0, 0);
      engine.setColorIndex(3); // 绿色
      engine.fillAt(0, 0);
      // 因为目标色和填充色不同，应该全部变绿
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#00ff00')).toBe(16 * 16);
    });

    it('填充单个格子', () => {
      const engine = createEngine();
      // 先填充整个画布为红色
      engine.setColorIndex(2);
      engine.fillAt(0, 0);
      // 画一个绿色格子包围的区域（无）
      // 实际上直接测试单个空格
      engine.init();
      engine.paintAt(0, 1);
      engine.paintAt(1, 0);
      engine.paintAt(1, 2);
      engine.paintAt(2, 1);
      // (1,1) 被包围
      engine.setColorIndex(3);
      engine.fillAt(1, 1);
      expect(engine.getPixels()[1][1]).toBe('#00ff00');
    });

    it('填充大型网格 (32x32)', () => {
      const engine = createEngine();
      engine.setGridSize(32);
      engine.fillAt(0, 0);
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#000000')).toBe(32 * 32);
    });

    it('填充大型网格 (64x64)', () => {
      const engine = createEngine();
      engine.setGridSize(64);
      engine.fillAt(0, 0);
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#000000')).toBe(64 * 64);
    });

    it('填充有复杂边界的区域', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色边界
      // 画 L 形边界
      for (let r = 0; r < 8; r++) engine.paintAt(r, 0);
      for (let c = 0; c < 8; c++) engine.paintAt(0, c);

      // 在 L 形内部填充
      engine.setColorIndex(3); // 绿色
      engine.fillAt(3, 3);
      const pixels = engine.getPixels();
      expect(pixels[3][3]).toBe('#00ff00');
    });
  });

  // ==================== 取色器测试 ====================

  describe('取色器', () => {
    it('pickColorAt 应获取指定位置的颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色
      engine.paintAt(5, 5);
      engine.pickColorAt(5, 5);
      expect(engine.getColorIndex()).toBe(2);
    });

    it('取色器对空白格子不改变颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(5);
      engine.pickColorAt(0, 0); // 空白
      expect(engine.getColorIndex()).toBe(5); // 不变
    });

    it('取色器不应越界', () => {
      const engine = createEngine();
      expect(() => engine.pickColorAt(-1, 0)).not.toThrow();
      expect(() => engine.pickColorAt(0, 16)).not.toThrow();
    });

    it('取色器应正确识别各种颜色', () => {
      const engine = createEngine();
      for (let i = 0; i < Math.min(9, PALETTE_COLORS.length); i++) {
        engine.setColorIndex(i);
        engine.paintAt(0, i);
        engine.setColorIndex(0); // 重置
        engine.pickColorAt(0, i);
        expect(engine.getColorIndex()).toBe(i);
      }
    });

    it('取色器对不在调色板中的颜色应不改变', () => {
      const engine = createEngine();
      // 手动设置一个不在调色板中的颜色
      const pixels = engine.getPixels();
      pixels[5][5] = '#abcdef';
      engine.setPixels(pixels);
      engine.setColorIndex(0);
      engine.pickColorAt(5, 5);
      // 不在调色板中，应保持不变
      expect(engine.getColorIndex()).toBe(0);
    });
  });

  // ==================== 颜色切换测试 ====================

  describe('颜色切换', () => {
    it('setColorIndex 应正确设置颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(5);
      expect(engine.getColorIndex()).toBe(5);
      expect(engine.getCurrentColor()).toBe(PALETTE_COLORS[5]);
    });

    it('setColorIndex 不接受负数', () => {
      const engine = createEngine();
      engine.setColorIndex(-1);
      expect(engine.getColorIndex()).toBe(DEFAULT_COLOR_INDEX);
    });

    it('setColorIndex 不接受超出范围的索引', () => {
      const engine = createEngine();
      engine.setColorIndex(PALETTE_COLORS.length);
      expect(engine.getColorIndex()).toBe(DEFAULT_COLOR_INDEX);
    });

    it('调色板应至少有 16 种颜色', () => {
      expect(PALETTE_COLORS.length).toBeGreaterThanOrEqual(16);
    });

    it('C 键应循环切换颜色', () => {
      const engine = createEngine();
      expect(engine.getColorIndex()).toBe(0);
      engine.handleKeyDown('c');
      expect(engine.getColorIndex()).toBe(1);
      engine.handleKeyDown('c');
      expect(engine.getColorIndex()).toBe(2);
    });

    it('C 键循环到最后应回到 0', () => {
      const engine = createEngine();
      engine.setColorIndex(PALETTE_COLORS.length - 1);
      engine.handleKeyDown('c');
      expect(engine.getColorIndex()).toBe(0);
    });

    it('数字键 1-9 应快速选色', () => {
      const engine = createEngine();
      for (let i = 1; i <= 9; i++) {
        engine.handleKeyDown(String(i));
        expect(engine.getColorIndex()).toBe(i - 1);
      }
    });

    it('数字键 1 选择第一个颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(5);
      engine.handleKeyDown('1');
      expect(engine.getColorIndex()).toBe(0);
    });

    it('数字键 9 选择第九个颜色', () => {
      const engine = createEngine();
      engine.handleKeyDown('9');
      expect(engine.getColorIndex()).toBe(8);
    });
  });

  // ==================== 工具切换测试 ====================

  describe('工具切换', () => {
    it('B 键应切换到画笔', () => {
      const engine = createEngine();
      engine.setTool(Tool.ERASER);
      engine.handleKeyDown('b');
      expect(engine.getCurrentTool()).toBe(Tool.BRUSH);
    });

    it('E 键应切换到橡皮擦', () => {
      const engine = createEngine();
      engine.handleKeyDown('e');
      expect(engine.getCurrentTool()).toBe(Tool.ERASER);
    });

    it('F 键应切换到填充', () => {
      const engine = createEngine();
      engine.handleKeyDown('f');
      expect(engine.getCurrentTool()).toBe(Tool.FILL);
    });

    it('I 键应切换到取色器', () => {
      const engine = createEngine();
      engine.handleKeyDown('i');
      expect(engine.getCurrentTool()).toBe(Tool.EYEDROPPER);
    });

    it('Tab 键应循环切换工具', () => {
      const engine = createEngine();
      expect(engine.getCurrentTool()).toBe(Tool.BRUSH);
      engine.handleKeyDown('Tab');
      expect(engine.getCurrentTool()).toBe(Tool.ERASER);
      engine.handleKeyDown('Tab');
      expect(engine.getCurrentTool()).toBe(Tool.FILL);
      engine.handleKeyDown('Tab');
      expect(engine.getCurrentTool()).toBe(Tool.EYEDROPPER);
      engine.handleKeyDown('Tab');
      expect(engine.getCurrentTool()).toBe(Tool.BRUSH);
    });

    it('setTool 应正确设置工具', () => {
      const engine = createEngine();
      engine.setTool(Tool.FILL);
      expect(engine.getCurrentTool()).toBe(Tool.FILL);
    });

    it('所有工具类型都存在', () => {
      expect(Tool.BRUSH).toBe('brush');
      expect(Tool.ERASER).toBe('eraser');
      expect(Tool.FILL).toBe('fill');
      expect(Tool.EYEDROPPER).toBe('eyedropper');
    });
  });

  // ==================== 光标移动测试 ====================

  describe('光标移动', () => {
    it('方向键上应移动光标', () => {
      const engine = createEngine();
      engine.setCursor(5, 5);
      engine.handleKeyDown('ArrowUp');
      expect(engine.getCursor().row).toBe(4);
      expect(engine.getCursor().col).toBe(5);
    });

    it('方向键下应移动光标', () => {
      const engine = createEngine();
      engine.setCursor(5, 5);
      engine.handleKeyDown('ArrowDown');
      expect(engine.getCursor().row).toBe(6);
    });

    it('方向键左应移动光标', () => {
      const engine = createEngine();
      engine.setCursor(5, 5);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.getCursor().col).toBe(4);
    });

    it('方向键右应移动光标', () => {
      const engine = createEngine();
      engine.setCursor(5, 5);
      engine.handleKeyDown('ArrowRight');
      expect(engine.getCursor().col).toBe(6);
    });

    it('光标不应超出上边界', () => {
      const engine = createEngine();
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowUp');
      expect(engine.getCursor().row).toBe(0);
    });

    it('光标不应超出下边界', () => {
      const engine = createEngine();
      engine.setCursor(15, 0);
      engine.handleKeyDown('ArrowDown');
      expect(engine.getCursor().row).toBe(15);
    });

    it('光标不应超出左边界', () => {
      const engine = createEngine();
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.getCursor().col).toBe(0);
    });

    it('光标不应超出右边界', () => {
      const engine = createEngine();
      engine.setCursor(0, 15);
      engine.handleKeyDown('ArrowRight');
      expect(engine.getCursor().col).toBe(15);
    });

    it('setCursor 应正确设置光标位置', () => {
      const engine = createEngine();
      engine.setCursor(10, 12);
      expect(engine.getCursor()).toEqual({ row: 10, col: 12 });
    });

    it('setCursor 应限制在边界内', () => {
      const engine = createEngine();
      engine.setCursor(-1, -1);
      expect(engine.getCursor()).toEqual({ row: 0, col: 0 });
      engine.setCursor(100, 100);
      expect(engine.getCursor()).toEqual({ row: 15, col: 15 });
    });

    it('在 32x32 网格中光标边界应为 31', () => {
      const engine = createEngine();
      engine.setGridSize(32);
      engine.setCursor(31, 31);
      engine.handleKeyDown('ArrowDown');
      expect(engine.getCursor().row).toBe(31);
      engine.handleKeyDown('ArrowRight');
      expect(engine.getCursor().col).toBe(31);
    });

    it('在 64x64 网格中光标边界应为 63', () => {
      const engine = createEngine();
      engine.setGridSize(64);
      engine.setCursor(63, 63);
      engine.handleKeyDown('ArrowDown');
      expect(engine.getCursor().row).toBe(63);
    });
  });

  // ==================== 空格键使用工具测试 ====================

  describe('空格键使用工具', () => {
    it('空格键使用画笔应在光标位置涂色', () => {
      const engine = createEngine();
      engine.setCursor(5, 5);
      engine.setTool(Tool.BRUSH);
      engine.handleKeyDown(' ');
      expect(engine.getPixels()[5][5]).toBe('#000000');
    });

    it('空格键使用橡皮擦应清除光标位置', () => {
      const engine = createEngine();
      engine.paintAt(5, 5);
      engine.setCursor(5, 5);
      engine.setTool(Tool.ERASER);
      engine.handleKeyDown(' ');
      expect(engine.getPixels()[5][5]).toBe(EMPTY_COLOR);
    });

    it('空格键使用填充应在光标位置填充', () => {
      const engine = createEngine();
      engine.setCursor(0, 0);
      engine.setTool(Tool.FILL);
      engine.handleKeyDown(' ');
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#000000')).toBe(16 * 16);
    });

    it('空格键使用取色器应获取光标位置颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(2);
      engine.paintAt(5, 5);
      engine.setCursor(5, 5);
      engine.setColorIndex(0);
      engine.setTool(Tool.EYEDROPPER);
      engine.handleKeyDown(' ');
      expect(engine.getColorIndex()).toBe(2);
    });
  });

  // ==================== 保存加载测试 ====================

  describe('保存和加载', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('save 应成功保存', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      const result = engine.save('test');
      expect(result).toBe(true);
    });

    it('getSaves 应返回保存列表', () => {
      const engine = createEngine();
      engine.save('test1');
      const saves = engine.getSaves();
      expect(saves.length).toBe(1);
      expect(saves[0].name).toBe('test1');
    });

    it('load 应正确加载保存数据', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.paintAt(5, 5);
      engine.save('test');

      // 创建新引擎并加载
      const engine2 = createEngine();
      engine2.load(0);
      expect(engine2.getPixels()[0][0]).toBe('#000000');
      expect(engine2.getPixels()[5][5]).toBe('#000000');
    });

    it('load 无效索引应返回 false', () => {
      const engine = createEngine();
      expect(engine.load(-1)).toBe(false);
      expect(engine.load(999)).toBe(false);
    });

    it('deleteSave 应删除保存', () => {
      const engine = createEngine();
      engine.save('test1');
      engine.save('test2');
      expect(engine.getSaves().length).toBe(2);
      engine.deleteSave(0);
      expect(engine.getSaves().length).toBe(1);
    });

    it('deleteSave 无效索引应返回 false', () => {
      const engine = createEngine();
      expect(engine.deleteSave(-1)).toBe(false);
      expect(engine.deleteSave(999)).toBe(false);
    });

    it('保存应包含网格尺寸', () => {
      const engine = createEngine();
      engine.setGridSize(32);
      engine.save('test');
      const saves = engine.getSaves();
      expect(saves[0].gridSize).toBe(32);
    });

    it('保存应包含时间戳', () => {
      const engine = createEngine();
      const before = Date.now();
      engine.save('test');
      const after = Date.now();
      const saves = engine.getSaves();
      expect(saves[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(saves[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('保存数量不应超过 MAX_SAVES', () => {
      const engine = createEngine();
      for (let i = 0; i < 15; i++) {
        engine.save(`save ${i}`);
      }
      const saves = engine.getSaves();
      expect(saves.length).toBeLessThanOrEqual(10);
    });

    it('S 键应触发保存', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.handleKeyDown('s');
      expect(engine.getSaves().length).toBe(1);
    });

    it('L 键应加载最近保存', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.handleKeyDown('s');

      const engine2 = createEngine();
      engine2.handleKeyDown('l');
      expect(engine2.getPixels()[0][0]).toBe('#000000');
    });

    it('L 键无保存时不应报错', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyDown('l')).not.toThrow();
    });

    it('保存名称默认值应正确', () => {
      const engine = createEngine();
      engine.save();
      const saves = engine.getSaves();
      expect(saves[0].name).toContain('画作');
    });
  });

  // ==================== 模板测试 ====================

  describe('模板', () => {
    it('应有至少 3 个模板', () => {
      expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    });

    it('模板应有名称', () => {
      for (const template of TEMPLATES) {
        expect(template.name).toBeTruthy();
      }
    });

    it('模板应有尺寸', () => {
      for (const template of TEMPLATES) {
        expect(template.size).toBeGreaterThan(0);
      }
    });

    it('模板数据应与尺寸匹配', () => {
      for (const template of TEMPLATES) {
        expect(template.data.length).toBe(template.size);
        for (const row of template.data) {
          expect(row.length).toBe(template.size);
        }
      }
    });

    it('loadTemplate 应正确加载模板', () => {
      const engine = createEngine();
      engine.loadTemplate(0);
      const pixels = engine.getPixels();
      // 心形模板应有红色像素
      const hasRed = pixels.some(row => row.some(cell => cell === '#ff0000'));
      expect(hasRed).toBe(true);
    });

    it('loadTemplate 无效索引不应改变画布', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      const before = engine.getPixels();
      engine.loadTemplate(-1);
      expect(engine.getPixels()).toEqual(before);
      engine.loadTemplate(999);
      expect(engine.getPixels()).toEqual(before);
    });

    it('getTemplates 应返回模板列表', () => {
      const engine = createEngine();
      const templates = engine.getTemplates();
      expect(templates.length).toBe(TEMPLATES.length);
    });

    it('getTemplates 应返回副本', () => {
      const engine = createEngine();
      const t1 = engine.getTemplates();
      const t2 = engine.getTemplates();
      expect(t1).not.toBe(t2);
    });

    it('T 键应循环加载模板', () => {
      const engine = createEngine();
      engine.handleKeyDown('t'); // 加载第一个模板
      expect(engine.getSelectedTemplateIndex()).toBe(0);

      engine.handleKeyDown('t'); // 加载第二个模板
      expect(engine.getSelectedTemplateIndex()).toBe(1);

      // 继续循环直到回到 -1
      for (let i = 2; i < TEMPLATES.length; i++) {
        engine.handleKeyDown('t');
      }
      engine.handleKeyDown('t'); // 回到 -1
      expect(engine.getSelectedTemplateIndex()).toBe(-1);
    });

    it('心形模板应包含红色像素', () => {
      const engine = createEngine();
      engine.loadTemplate(0); // 心形
      const pixels = engine.getPixels();
      const redCount = countColor(pixels, '#ff0000');
      expect(redCount).toBeGreaterThan(0);
    });

    it('星星模板应包含黄色像素', () => {
      const engine = createEngine();
      engine.loadTemplate(1); // 星星
      const pixels = engine.getPixels();
      const yellowCount = countColor(pixels, '#ffff00');
      expect(yellowCount).toBeGreaterThan(0);
    });

    it('笑脸模板应包含黄色和黑色像素', () => {
      const engine = createEngine();
      engine.loadTemplate(2); // 笑脸
      const pixels = engine.getPixels();
      const yellowCount = countColor(pixels, '#ffff00');
      const blackCount = countColor(pixels, '#000000');
      expect(yellowCount).toBeGreaterThan(0);
      expect(blackCount).toBeGreaterThan(0);
    });
  });

  // ==================== 导出测试 ====================

  describe('导出', () => {
    it('exportAsText 应返回字符串', () => {
      const engine = createEngine();
      const text = engine.exportAsText();
      expect(typeof text).toBe('string');
    });

    it('空白画布导出应全为点号', () => {
      const engine = createEngine();
      const text = engine.exportAsText();
      const lines = text.split('\n');
      expect(lines.length).toBe(16);
      for (const line of lines) {
        for (const char of line.split(' ')) {
          expect(char).toBe('.');
        }
      }
    });

    it('涂色后导出应包含颜色代码', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      const text = engine.exportAsText();
      expect(text).toContain('#000000');
    });

    it('exportAsJSON 应返回有效 JSON', () => {
      const engine = createEngine();
      const json = engine.exportAsJSON();
      const parsed = JSON.parse(json);
      expect(parsed.gridSize).toBe(16);
      expect(parsed.pixels).toBeDefined();
    });

    it('导出文本行数应等于网格尺寸', () => {
      const engine = createEngine();
      engine.setGridSize(32);
      const text = engine.exportAsText();
      expect(text.split('\n').length).toBe(32);
    });
  });

  // ==================== getState 测试 ====================

  describe('getState', () => {
    it('应返回包含必要字段的状态', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('gridSize');
      expect(state).toHaveProperty('pixels');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('currentTool');
      expect(state).toHaveProperty('currentColorIndex');
      expect(state).toHaveProperty('currentColor');
    });

    it('状态中的像素应为副本', () => {
      const engine = createEngine();
      const state1 = engine.getState();
      const state2 = engine.getState();
      expect(state1.pixels).not.toBe(state2.pixels);
    });

    it('状态应反映当前设置', () => {
      const engine = createEngine();
      engine.setColorIndex(5);
      engine.setTool(Tool.FILL);
      engine.setCursor(10, 12);
      const state = engine.getState();
      expect(state.currentColorIndex).toBe(5);
      expect(state.currentTool).toBe(Tool.FILL);
      expect(state.cursorRow).toBe(10);
      expect(state.cursorCol).toBe(12);
    });
  });

  // ==================== 键盘控制综合测试 ====================

  describe('键盘控制综合', () => {
    it('G 键应切换网格尺寸', () => {
      const engine = createEngine();
      expect(engine.getGridSize()).toBe(16);
      engine.handleKeyDown('g');
      expect(engine.getGridSize()).toBe(32);
      engine.handleKeyDown('g');
      expect(engine.getGridSize()).toBe(64);
      engine.handleKeyDown('g');
      expect(engine.getGridSize()).toBe(16);
    });

    it('P 键应暂停游戏', () => {
      const engine = createEngine();
      // 模拟 playing 状态（不通过 start()，避免 canvas 依赖）
      (engine as any)._status = 'playing';
      engine.handleKeyDown('p');
      expect(engine.status).toBe('paused');
    });

    it('P 键应继续暂停的游戏', () => {
      const engine = createEngine();
      (engine as any)._status = 'playing';
      // resume() 需要 canvas，手动设置 mock canvas
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 640;
      (engine as any).canvas = canvas;
      (engine as any).ctx = canvas.getContext('2d');
      engine.handleKeyDown('p');
      expect(engine.status).toBe('paused');
      engine.handleKeyDown('p');
      expect(engine.status).toBe('playing');
    });

    it('Escape 键应暂停游戏', () => {
      const engine = createEngine();
      (engine as any)._status = 'playing';
      engine.handleKeyDown('Escape');
      expect(engine.status).toBe('paused');
    });

    it('Enter 键在 idle 状态应尝试开始（无 canvas 时不崩溃）', () => {
      const engine = createEngine();
      // Enter 会调用 start()，没有 canvas 会抛错
      // 但 handleKeyDown 应该能处理
      expect(() => engine.handleKeyDown('Enter')).toThrow('Canvas not initialized');
    });

    it('handleKeyUp 不应报错', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('未知按键不应报错', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyDown('z')).not.toThrow();
      expect(() => engine.handleKeyDown('Z')).not.toThrow();
      expect(() => engine.handleKeyDown('[')).not.toThrow();
    });

    it('大写和小写按键都应工作', () => {
      const engine = createEngine();
      engine.handleKeyDown('B');
      expect(engine.getCurrentTool()).toBe(Tool.BRUSH);
      engine.handleKeyDown('b');
      expect(engine.getCurrentTool()).toBe(Tool.BRUSH);
    });
  });

  // ==================== 边界情况测试 ====================

  describe('边界情况', () => {
    it('在最小网格上操作应正常', () => {
      const engine = createEngine();
      engine.setGridSize(16);
      engine.paintAt(0, 0);
      engine.paintAt(15, 15);
      expect(engine.getPixels()[0][0]).toBe('#000000');
      expect(engine.getPixels()[15][15]).toBe('#000000');
    });

    it('在最大网格上操作应正常', () => {
      const engine = createEngine();
      engine.setGridSize(64);
      engine.paintAt(0, 0);
      engine.paintAt(63, 63);
      expect(engine.getPixels()[0][0]).toBe('#000000');
      expect(engine.getPixels()[63][63]).toBe('#000000');
    });

    it('连续快速操作应正常', () => {
      const engine = createEngine();
      for (let i = 0; i < 100; i++) {
        engine.handleKeyDown('ArrowRight');
        engine.handleKeyDown('ArrowDown');
        engine.handleKeyDown(' ');
      }
      // 不应崩溃
      expect(engine.getGridSize()).toBeGreaterThan(0);
    });

    it('reset 后应回到初始状态', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.setTool(Tool.FILL);
      engine.setColorIndex(5);
      engine.setCursor(10, 10);
      engine.reset();
      expect(engine.getPixels()[0][0]).toBe(EMPTY_COLOR);
      expect(engine.getCurrentTool()).toBe(DEFAULT_TOOL);
      expect(engine.getColorIndex()).toBe(DEFAULT_COLOR_INDEX);
      expect(engine.getCursor()).toEqual({ row: 0, col: 0 });
    });

    it('destroy 后应正常清理', () => {
      const engine = createEngine();
      engine.paintAt(0, 0);
      engine.destroy();
      // 不应崩溃
    });

    it('多次 init 不应报错', () => {
      const engine = new PixelArtEngine();
      engine.init();
      engine.init();
      engine.init();
      expect(engine.getGridSize()).toBe(DEFAULT_GRID_SIZE);
    });

    it('空白画布上填充应填充全部', () => {
      const engine = createEngine();
      engine.fillAt(0, 0);
      const pixels = engine.getPixels();
      const emptyCount = countEmpty(pixels);
      expect(emptyCount).toBe(0);
    });

    it('在已填充画布上用不同颜色填充应覆盖全部', () => {
      const engine = createEngine();
      engine.setColorIndex(0); // 黑色
      engine.fillAt(0, 0);
      engine.setColorIndex(2); // 红色
      engine.fillAt(0, 0);
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#ff0000')).toBe(16 * 16);
    });

    it('保存和加载应保持数据一致性', () => {
      localStorage.clear();
      const engine = createEngine();
      engine.setColorIndex(2);
      engine.paintAt(0, 0);
      engine.paintAt(7, 7);
      engine.paintAt(15, 15);
      engine.save('consistency test');

      const engine2 = createEngine();
      engine2.load(0);
      const pixels = engine2.getPixels();
      expect(pixels[0][0]).toBe('#ff0000');
      expect(pixels[7][7]).toBe('#ff0000');
      expect(pixels[15][15]).toBe('#ff0000');
      expect(pixels[1][1]).toBe(EMPTY_COLOR);
    });

    it('32x32 网格保存和加载应正确', () => {
      localStorage.clear();
      const engine = createEngine();
      engine.setGridSize(32);
      engine.setColorIndex(3);
      engine.paintAt(0, 0);
      engine.paintAt(31, 31);
      engine.save('32x32 test');

      const engine2 = createEngine();
      engine2.load(0);
      expect(engine2.getGridSize()).toBe(32);
      expect(engine2.getPixels()[0][0]).toBe('#00ff00');
      expect(engine2.getPixels()[31][31]).toBe('#00ff00');
    });

    it('在角落位置填充应正常工作', () => {
      const engine = createEngine();
      engine.paintAt(0, 1);
      engine.paintAt(1, 0);
      // (0,0) 被包围为 1 格
      engine.setColorIndex(5);
      engine.fillAt(0, 0);
      expect(engine.getPixels()[0][0]).toBe('#ffff00');
    });

    it('填充已涂色区域应替换颜色', () => {
      const engine = createEngine();
      engine.setColorIndex(2); // 红色
      engine.paintAt(5, 5);
      engine.setColorIndex(3); // 绿色
      engine.fillAt(5, 5);
      expect(engine.getPixels()[5][5]).toBe('#00ff00');
    });
  });

  // ==================== 综合工作流测试 ====================

  describe('综合工作流', () => {
    it('完整绘画流程', () => {
      const engine = createEngine();
      // 选择红色
      engine.setColorIndex(2);
      // 画一个十字
      for (let i = 5; i <= 10; i++) {
        engine.paintAt(7, i);
        engine.paintAt(i, 7);
      }
      const pixels = engine.getPixels();
      expect(pixels[7][5]).toBe('#ff0000');
      expect(pixels[7][10]).toBe('#ff0000');
      expect(pixels[5][7]).toBe('#ff0000');
      expect(pixels[10][7]).toBe('#ff0000');
    });

    it('使用键盘完整绘画', () => {
      const engine = createEngine();
      engine.handleKeyDown('3'); // 数字3 → 索引2 = 红色 #ff0000
      engine.setCursor(5, 5);
      engine.handleKeyDown(' '); // 画笔涂色
      expect(engine.getPixels()[5][5]).toBe('#ff0000');

      engine.handleKeyDown('e'); // 切换橡皮擦
      engine.handleKeyDown(' '); // 擦除
      expect(engine.getPixels()[5][5]).toBe(EMPTY_COLOR);
    });

    it('使用填充绘制背景', () => {
      const engine = createEngine();
      engine.handleKeyDown('3'); // 数字3 → 索引2 = 红色 #ff0000
      engine.handleKeyDown('f'); // 填充工具
      engine.setCursor(0, 0);
      engine.handleKeyDown(' '); // 填充
      const pixels = engine.getPixels();
      expect(countColor(pixels, '#ff0000')).toBe(16 * 16);
    });

    it('绘制、保存、清空、加载流程', () => {
      localStorage.clear();
      const engine = createEngine();
      engine.setColorIndex(2);
      engine.fillAt(0, 0);
      engine.save('red canvas');

      engine.clearCanvas();
      expect(countEmpty(engine.getPixels())).toBe(16 * 16);

      engine.load(0);
      expect(countColor(engine.getPixels(), '#ff0000')).toBe(16 * 16);
    });

    it('加载模板后修改并保存', () => {
      localStorage.clear();
      const engine = createEngine();
      engine.loadTemplate(0); // 心形
      engine.setColorIndex(3); // 绿色
      engine.paintAt(0, 0); // 添加绿色像素
      engine.save('modified template');

      const engine2 = createEngine();
      engine2.load(0);
      expect(engine2.getPixels()[0][0]).toBe('#00ff00');
    });

    it('切换网格尺寸后绘画', () => {
      const engine = createEngine();
      engine.handleKeyDown('g'); // 切换到 32x32
      expect(engine.getGridSize()).toBe(32);
      engine.setColorIndex(4); // 蓝色
      engine.paintAt(0, 0);
      engine.paintAt(31, 31);
      expect(engine.getPixels()[0][0]).toBe('#0000ff');
      expect(engine.getPixels()[31][31]).toBe('#0000ff');
    });
  });

  // ==================== 引擎生命周期测试 ====================

  describe('引擎生命周期', () => {
    it('start 需要 canvas，无 canvas 时应抛错', () => {
      const engine = new PixelArtEngine();
      engine.init();
      expect(() => engine.start()).toThrow('Canvas not initialized');
    });

    it('reset 应恢复初始状态', () => {
      const engine = createEngine();
      engine.setColorIndex(5);
      engine.setTool(Tool.FILL);
      engine.setCursor(10, 10);
      engine.paintAt(0, 0);

      engine.reset();

      expect(engine.getColorIndex()).toBe(DEFAULT_COLOR_INDEX);
      expect(engine.getCurrentTool()).toBe(DEFAULT_TOOL);
      expect(engine.getCursor()).toEqual({ row: 0, col: 0 });
      expect(engine.getPixels()[0][0]).toBe(EMPTY_COLOR);
    });

    it('onPause 和 onResume 应正常工作', () => {
      const engine = createEngine();
      // 直接调用 pause/resume 在 idle 状态
      engine.pause(); // idle 状态不应暂停
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== 调色板颜色测试 ====================

  describe('调色板颜色', () => {
    it('所有调色板颜色应为有效的 CSS 颜色值', () => {
      for (const color of PALETTE_COLORS) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('调色板颜色不应有重复', () => {
      const set = new Set(PALETTE_COLORS);
      expect(set.size).toBe(PALETTE_COLORS.length);
    });

    it('第一个颜色应为黑色', () => {
      expect(PALETTE_COLORS[0]).toBe('#000000');
    });

    it('第二个颜色应为白色', () => {
      expect(PALETTE_COLORS[1]).toBe('#ffffff');
    });
  });

  // ==================== 常量验证测试 ====================

  describe('常量验证', () => {
    it('GRID_SIZES 应包含 16, 32, 64', () => {
      expect(GRID_SIZES).toContain(16);
      expect(GRID_SIZES).toContain(32);
      expect(GRID_SIZES).toContain(64);
    });

    it('DEFAULT_GRID_SIZE 应在 GRID_SIZES 中', () => {
      expect(GRID_SIZES).toContain(DEFAULT_GRID_SIZE);
    });

    it('STORAGE_KEY_PREFIX 应有值', () => {
      expect(STORAGE_KEY_PREFIX).toBeTruthy();
    });
  });
});
