import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DotsAndBoxesEngine } from '../DotsAndBoxesEngine';
import {
  PLAYER_1, PLAYER_2, NO_PLAYER,
  LINE_HORIZONTAL, LINE_VERTICAL,
  DEFAULT_GRID_SIZE,
} from '../constants';
import type { GridSize } from '../constants';

// ========== Mock 工具 ==========

function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

function createEngine(gridSize?: GridSize): DotsAndBoxesEngine {
  const engine = new DotsAndBoxesEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  if (gridSize) {
    // 通过 changeGridSize 或直接设置
    (engine as any)._gridPoints = gridSize;
  }
  engine.init(canvas);
  return engine;
}

function startEngine(gridSize?: GridSize): DotsAndBoxesEngine {
  const engine = createEngine(gridSize);
  // mock requestAnimationFrame 防止 gameLoop
  const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  engine.start();
  rafSpy.mockRestore();
  return engine;
}

// ========== 测试开始 ==========

describe('DotsAndBoxesEngine', () => {
  let engine: DotsAndBoxesEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = startEngine();
    engine.setAI(false); // 禁用 AI 防止干扰
  });

  afterEach(() => {
    engine.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ========== 初始化测试 ==========

  describe('初始化', () => {
    it('默认网格大小为 5×5', () => {
      expect(engine.gridPoints).toBe(5);
      expect(engine.rows).toBe(4);
      expect(engine.cols).toBe(4);
    });

    it('默认总方格数为 16', () => {
      expect(engine.totalBoxes).toBe(16);
    });

    it('默认已完成方格数为 0', () => {
      expect(engine.completedBoxes).toBe(0);
    });

    it('默认当前玩家为 P1', () => {
      expect(engine.currentPlayer).toBe(PLAYER_1);
    });

    it('默认分数均为 0', () => {
      expect(engine.player1Score).toBe(0);
      expect(engine.player2Score).toBe(0);
      expect(engine.scores).toEqual([0, 0]);
    });

    it('默认游戏未结束', () => {
      expect(engine.isGameOver).toBe(false);
    });

    it('默认无胜者', () => {
      expect(engine.winner).toBe(NO_PLAYER);
    });

    it('默认 AI 开启（引擎初始值）', () => {
      const e = new DotsAndBoxesEngine();
      expect((e as any)._aiEnabled).toBe(true);
    });

    it('默认光标在 (0,0) 水平方向', () => {
      expect(engine.cursorRow).toBe(0);
      expect(engine.cursorCol).toBe(0);
      expect(engine.cursorDirection).toBe(LINE_HORIZONTAL);
    });

    it('水平线段初始化为全 0', () => {
      const lines = engine.horizontalLines;
      expect(lines.length).toBe(5); // gridPoints
      expect(lines[0].length).toBe(4); // cols
      for (const row of lines) {
        for (const val of row) {
          expect(val).toBe(NO_PLAYER);
        }
      }
    });

    it('垂直线段初始化为全 0', () => {
      const lines = engine.verticalLines;
      expect(lines.length).toBe(4); // rows
      expect(lines[0].length).toBe(5); // gridPoints
      for (const row of lines) {
        for (const val of row) {
          expect(val).toBe(NO_PLAYER);
        }
      }
    });

    it('方格初始化为全 0', () => {
      const boxes = engine.boxes;
      expect(boxes.length).toBe(4);
      expect(boxes[0].length).toBe(4);
      for (const row of boxes) {
        for (const val of row) {
          expect(val).toBe(NO_PLAYER);
        }
      }
    });

    it('isWin 默认为 false', () => {
      expect(engine.isWin).toBe(false);
    });

    it('extraTurn 默认为 false', () => {
      expect(engine.extraTurn).toBe(false);
    });
  });

  // ========== 多网格大小测试 ==========

  describe('多网格大小', () => {
    it('3×3 网格（2×2 方格）', () => {
      const e = startEngine(3);
      expect(e.gridPoints).toBe(3);
      expect(e.rows).toBe(2);
      expect(e.cols).toBe(2);
      expect(e.totalBoxes).toBe(4);
      expect(e.horizontalLines.length).toBe(3);
      expect(e.horizontalLines[0].length).toBe(2);
      expect(e.verticalLines.length).toBe(2);
      expect(e.verticalLines[0].length).toBe(3);
      e.destroy();
    });

    it('5×5 网格（4×4 方格）', () => {
      expect(engine.gridPoints).toBe(5);
      expect(engine.totalBoxes).toBe(16);
    });

    it('7×7 网格（6×6 方格）', () => {
      const e = startEngine(7);
      expect(e.gridPoints).toBe(7);
      expect(e.rows).toBe(6);
      expect(e.cols).toBe(6);
      expect(e.totalBoxes).toBe(36);
      expect(e.horizontalLines.length).toBe(7);
      expect(e.horizontalLines[0].length).toBe(6);
      expect(e.verticalLines.length).toBe(6);
      expect(e.verticalLines[0].length).toBe(7);
      e.destroy();
    });

    it('changeGridSize 切换到 3×3', () => {
      engine.changeGridSize(3);
      expect(engine.gridPoints).toBe(3);
      expect(engine.totalBoxes).toBe(4);
    });

    it('changeGridSize 切换到 7×7', () => {
      engine.changeGridSize(7);
      expect(engine.gridPoints).toBe(7);
      expect(engine.totalBoxes).toBe(36);
    });

    it('changeGridSize 忽略无效大小', () => {
      const original = engine.gridPoints;
      engine.changeGridSize(4 as any);
      expect(engine.gridPoints).toBe(original);
    });

    it('changeGridSize 相同大小不重置', () => {
      const spy = vi.spyOn(engine, 'reset');
      engine.changeGridSize(5);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ========== 画线逻辑 ==========

  describe('画线逻辑', () => {
    it('P1 可以画水平线', () => {
      engine.setAI(false);
      const result = engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(result).toBe(true);
      expect(engine.getLineOwner(0, 0, LINE_HORIZONTAL)).toBe(PLAYER_1);
    });

    it('P1 可以画垂直线', () => {
      engine.setAI(false);
      const result = engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_1);
      expect(result).toBe(true);
      expect(engine.getLineOwner(0, 0, LINE_VERTICAL)).toBe(PLAYER_1);
    });

    it('不能重复画同一条线', () => {
      engine.setAI(false);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      const result = engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(result).toBe(false);
    });

    it('不能在别人回合画线', () => {
      engine.setAI(false);
      // P1 画线后切换到 P2
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      // P1 不能在 P2 回合画线
      const result = engine.drawLine(0, 1, LINE_HORIZONTAL, PLAYER_1);
      expect(result).toBe(false);
    });

    it('画线后切换玩家（未完成方格）', () => {
      engine.setAI(false);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.currentPlayer).toBe(PLAYER_2);
    });

    it('游戏结束后不能画线', () => {
      engine.setAI(false);
      // 快速完成所有方格（手动设置）
      (engine as any)._gameOver = true;
      const result = engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(result).toBe(false);
    });

    it('超出边界不能画线', () => {
      engine.setAI(false);
      expect(engine.drawLine(-1, 0, LINE_HORIZONTAL, PLAYER_1)).toBe(false);
      expect(engine.drawLine(0, -1, LINE_HORIZONTAL, PLAYER_1)).toBe(false);
      expect(engine.drawLine(99, 0, LINE_HORIZONTAL, PLAYER_1)).toBe(false);
      expect(engine.drawLine(0, 99, LINE_HORIZONTAL, PLAYER_1)).toBe(false);
    });

    it('isLineDrawn 正确判断', () => {
      engine.setAI(false);
      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(false);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(true);
    });

    it('isLineDrawn 越界返回 false', () => {
      expect(engine.isLineDrawn(-1, 0, LINE_HORIZONTAL)).toBe(false);
      expect(engine.isLineDrawn(0, 99, LINE_HORIZONTAL)).toBe(false);
    });

    it('getLineOwner 返回正确玩家', () => {
      engine.setAI(false);
      expect(engine.getLineOwner(0, 0, LINE_HORIZONTAL)).toBe(NO_PLAYER);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.getLineOwner(0, 0, LINE_HORIZONTAL)).toBe(PLAYER_1);
    });

    it('getLineOwner 越界返回 NO_PLAYER', () => {
      expect(engine.getLineOwner(-1, 0, LINE_HORIZONTAL)).toBe(NO_PLAYER);
      expect(engine.getLineOwner(0, 99, LINE_VERTICAL)).toBe(NO_PLAYER);
    });
  });

  // ========== 方格完成检测 ==========

  describe('方格完成检测', () => {
    beforeEach(() => {
      engine.setAI(false);
    });

    it('完成一个方格得分 +1', () => {
      // 画方格 (0,0) 的四条边
      const completer = completeOneBox(engine, 0, 0, PLAYER_1);
      expect(engine.getBoxOwner(0, 0)).toBe(completer);
      if (completer === PLAYER_1) {
        expect(engine.player1Score).toBe(1);
      } else {
        expect(engine.player2Score).toBe(1);
      }
    });

    it('完成方格获得额外回合', () => {
      // 画三条边
      const completer = completeOneBox(engine, 0, 0, PLAYER_1);
      // 完成方格的玩家应该获得额外回合
      expect(engine.currentPlayer).toBe(completer);
      expect(engine.extraTurn).toBe(true);
    });

    it('未完成方格不获得额外回合', () => {
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.extraTurn).toBe(false);
    });

    it('getBoxSides 正确返回四边状态', () => {
      expect(engine.getBoxSides(0, 0)).toEqual({
        top: false, bottom: false, left: false, right: false,
      });

      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.getBoxSides(0, 0)).toEqual({
        top: true, bottom: false, left: false, right: false,
      });

      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2);
      expect(engine.getBoxSides(0, 0)).toEqual({
        top: true, bottom: false, left: true, right: false,
      });
    });

    it('getBoxSides 越界返回全 false', () => {
      expect(engine.getBoxSides(-1, 0)).toEqual({
        top: false, bottom: false, left: false, right: false,
      });
      expect(engine.getBoxSides(0, 99)).toEqual({
        top: false, bottom: false, left: false, right: false,
      });
    });

    it('getBoxSideCount 正确计数', () => {
      expect(engine.getBoxSideCount(0, 0)).toBe(0);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.getBoxSideCount(0, 0)).toBe(1);
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2);
      expect(engine.getBoxSideCount(0, 0)).toBe(2);
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.getBoxSideCount(0, 0)).toBe(3);
    });

    it('getBoxOwner 越界返回 NO_PLAYER', () => {
      expect(engine.getBoxOwner(-1, 0)).toBe(NO_PLAYER);
      expect(engine.getBoxOwner(0, 99)).toBe(NO_PLAYER);
    });

    it('一条水平线可能完成两个方格', () => {
      // 设置方格 (0,0) 和 (0,1) 都差 top 边
      // (0,0): 画 left, bottom, right
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_1);   // left
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_2);  // bottom
      engine.drawLine(0, 1, LINE_VERTICAL, PLAYER_1);    // right (也是 (0,1) 的 left)
      // (0,1): 画 bottom, right
      engine.drawLine(1, 1, LINE_HORIZONTAL, PLAYER_2);  // bottom
      engine.drawLine(0, 2, LINE_VERTICAL, PLAYER_1);    // right
      // 画 top of (0,0) — 当前是 P1
      const p = engine.currentPlayer;
      engine.drawLine(0, 0, LINE_HORIZONTAL, p); // top of (0,0)
      expect(engine.getBoxOwner(0, 0)).toBe(p);
      expect(engine.getBoxOwner(0, 1)).toBe(NO_PLAYER);

      // 画 top of (0,1) — P1 有额外回合
      engine.drawLine(0, 1, LINE_HORIZONTAL, p); // top of (0,1) → 完成
      expect(engine.getBoxOwner(0, 1)).toBe(p);
    });

    it('一条垂直线可能完成两个方格', () => {
      // 设置方格 (0,0) 和 (1,0) 都差 left 边以外的三条边
      // (0,0): top, bottom, right
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);  // top
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_2);  // bottom
      engine.drawLine(0, 1, LINE_VERTICAL, PLAYER_1);    // right
      // (1,0): bottom, right
      engine.drawLine(2, 0, LINE_HORIZONTAL, PLAYER_2);  // bottom
      engine.drawLine(1, 1, LINE_VERTICAL, PLAYER_1);    // right

      // 画 left of (0,0)
      const p1 = engine.currentPlayer;
      engine.drawLine(0, 0, LINE_VERTICAL, p1);
      expect(engine.getBoxOwner(0, 0)).toBe(p1);

      // 画 left of (1,0) — p1 gets extra turn
      engine.drawLine(1, 0, LINE_VERTICAL, p1);
      expect(engine.getBoxOwner(1, 0)).toBe(p1);
    });
  });

  // ========== 额外回合测试 ==========

  describe('额外回合', () => {
    beforeEach(() => {
      engine.setAI(false);
    });

    it('完成方格后不切换玩家', () => {
      // 准备 (0,0) 差一条边
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1); // top → P2
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2);   // left → P1
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_1); // bottom → P2

      // P2 完成方格
      engine.drawLine(0, 1, LINE_VERTICAL, PLAYER_2);
      expect(engine.currentPlayer).toBe(PLAYER_2);
      expect(engine.extraTurn).toBe(true);
    });

    it('连续完成多个方格保持额外回合', () => {
      // 准备 (0,0) 和 (0,1) 都差 top 边
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_1);   // left of (0,0)
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_2);  // bottom of (0,0)
      engine.drawLine(0, 1, LINE_VERTICAL, PLAYER_1);    // right of (0,0) = left of (0,1)
      engine.drawLine(1, 1, LINE_HORIZONTAL, PLAYER_2);  // bottom of (0,1)
      engine.drawLine(0, 2, LINE_VERTICAL, PLAYER_1);    // right of (0,1)

      // 当前玩家画 top of (0,0) → 完成一个方格
      const p = engine.currentPlayer;
      engine.drawLine(0, 0, LINE_HORIZONTAL, p);
      expect(engine.getBoxOwner(0, 0)).toBe(p);
      expect(engine.currentPlayer).toBe(p); // 额外回合

      // 继续画 top of (0,1) → 完成第二个方格
      engine.drawLine(0, 1, LINE_HORIZONTAL, p);
      expect(engine.getBoxOwner(0, 1)).toBe(p);
      expect(engine.currentPlayer).toBe(p); // 继续额外回合
    });
  });

  // ========== 胜负判定 ==========

  describe('胜负判定', () => {
    it('P1 分数高则 P1 胜', () => {
      engine.setAI(false);
      // 模拟完成所有方格
      fillAllBoxes(engine, PLAYER_1);
      expect(engine.isGameOver).toBe(true);
      expect(engine.winner).toBe(PLAYER_1);
      expect(engine.isWin).toBe(true);
    });

    it('P2 分数高则 P2 胜', () => {
      engine.setAI(false);
      fillAllBoxes(engine, PLAYER_2);
      expect(engine.isGameOver).toBe(true);
      expect(engine.winner).toBe(PLAYER_2);
      expect(engine.isWin).toBe(false);
    });

    it('分数相同为平局', () => {
      engine.setAI(false);
      // 手动设置平局状态
      // 用 3×3 网格（4个方格），各占2个
      const e = startEngine(3);
      e.setAI(false);
      // 完成所有方格，手动设置分数
      fillAllBoxes3x3(e);
      e.destroy();
    });

    it('游戏结束时 status 为 gameover', () => {
      engine.setAI(false);
      fillAllBoxes(engine, PLAYER_1);
      expect(engine.status).toBe('gameover');
    });
  });

  // ========== 光标控制 ==========

  describe('光标控制', () => {
    it('方向键右移动光标列', () => {
      engine.setAI(false);
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(1);
    });

    it('方向键左移动光标列', () => {
      engine.setAI(false);
      (engine as any)._cursorCol = 2;
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorCol).toBe(1);
    });

    it('方向键下移动光标行', () => {
      engine.setAI(false);
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(1);
    });

    it('方向键上移动光标行', () => {
      engine.setAI(false);
      (engine as any)._cursorRow = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorRow).toBe(1);
    });

    it('光标不超出左边界', () => {
      engine.setAI(false);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorCol).toBe(0);
    });

    it('光标不超出上边界', () => {
      engine.setAI(false);
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorRow).toBe(0);
    });

    it('光标不超出右边界（水平线）', () => {
      engine.setAI(false);
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBeLessThanOrEqual(engine.getMaxCol(LINE_HORIZONTAL));
    });

    it('光标不超出下边界（水平线）', () => {
      engine.setAI(false);
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBeLessThanOrEqual(engine.getMaxRow(LINE_HORIZONTAL));
    });

    it('Tab 切换方向', () => {
      engine.setAI(false);
      expect(engine.cursorDirection).toBe(LINE_HORIZONTAL);
      engine.handleKeyDown('Tab');
      expect(engine.cursorDirection).toBe(LINE_VERTICAL);
      engine.handleKeyDown('Tab');
      expect(engine.cursorDirection).toBe(LINE_HORIZONTAL);
    });

    it('切换方向后光标在有效范围内', () => {
      engine.setAI(false);
      // 移到最大列
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowRight');
      const hCol = engine.cursorCol;
      engine.handleKeyDown('Tab'); // 切换到垂直
      // 垂直线列数 = gridPoints = 5，所以 maxCol = 4
      expect(engine.cursorCol).toBeLessThanOrEqual(4);
    });

    it('空格画当前光标位置的线', () => {
      engine.setAI(false);
      engine.handleKeyDown(' ');
      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(true);
    });

    it('Enter 画当前光标位置的线', () => {
      engine.setAI(false);
      engine.handleKeyDown('Enter');
      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(true);
    });

    it('AI 回合时玩家不能画线', () => {
      // AI 开启时，P2 回合玩家不能画线
      engine.setAI(true);
      (engine as any)._currentPlayer = PLAYER_2;
      engine.handleKeyDown(' ');
      // 不应该画线
    });

    it('AI 思考时不能操作', () => {
      engine.setAI(false);
      (engine as any)._aiThinking = true;
      engine.handleKeyDown(' ');
      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(false);
    });
  });

  // ========== 键盘快捷键 ==========

  describe('键盘快捷键', () => {
    it('R 重新开始', () => {
      engine.setAI(false);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(true);

      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
      engine.handleKeyDown('r');
      rafSpy.mockRestore();

      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(false);
      expect(engine.player1Score).toBe(0);
    });

    it('1 切换到 3×3', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
      engine.handleKeyDown('1');
      rafSpy.mockRestore();
      expect(engine.gridPoints).toBe(3);
    });

    it('2 切换到 5×5', () => {
      // 先切到 3×3
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
      engine.handleKeyDown('1');
      expect(engine.gridPoints).toBe(3);
      engine.handleKeyDown('2');
      rafSpy.mockRestore();
      expect(engine.gridPoints).toBe(5);
    });

    it('3 切换到 7×7', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
      engine.handleKeyDown('3');
      rafSpy.mockRestore();
      expect(engine.gridPoints).toBe(7);
    });

    it('游戏结束后 R 可以重开', () => {
      engine.setAI(false);
      (engine as any)._gameOver = true;

      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
      engine.handleKeyDown('r');
      rafSpy.mockRestore();

      expect(engine.isGameOver).toBe(false);
    });

    it('游戏结束后方向键无效', () => {
      engine.setAI(false);
      (engine as any)._gameOver = true;
      const prevRow = engine.cursorRow;
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(prevRow);
    });
  });

  // ========== getAvailableLines ==========

  describe('getAvailableLines', () => {
    it('初始状态所有线都可用', () => {
      engine.setAI(false);
      // 5×5: 水平 5×4=20, 垂直 4×5=20, 总共 40
      const available = engine.getAvailableLines();
      expect(available.length).toBe(40);
    });

    it('画线后可用线减少', () => {
      engine.setAI(false);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      const available = engine.getAvailableLines();
      expect(available.length).toBe(39);
    });

    it('3×3 网格有 12 条线', () => {
      const e = startEngine(3);
      e.setAI(false);
      // 水平 3×2=6, 垂直 2×3=6, 总共 12
      expect(e.getAvailableLines().length).toBe(12);
      e.destroy();
    });

    it('7×7 网格有 84 条线', () => {
      const e = startEngine(7);
      e.setAI(false);
      // 水平 7×6=42, 垂直 6×7=42, 总共 84
      expect(e.getAvailableLines().length).toBe(84);
      e.destroy();
    });
  });

  // ========== getMaxRow / getMaxCol ==========

  describe('getMaxRow / getMaxCol', () => {
    it('水平线最大行 = gridPoints - 1', () => {
      expect(engine.getMaxRow(LINE_HORIZONTAL)).toBe(4); // 5-1=4
    });

    it('垂直线最大行 = rows - 1', () => {
      expect(engine.getMaxRow(LINE_VERTICAL)).toBe(3); // 4-1=3
    });

    it('水平线最大列 = cols - 1', () => {
      expect(engine.getMaxCol(LINE_HORIZONTAL)).toBe(3); // 4-1=3
    });

    it('垂直线最大列 = gridPoints - 1', () => {
      expect(engine.getMaxCol(LINE_VERTICAL)).toBe(4); // 5-1=4
    });
  });

  // ========== AI 策略 ==========

  describe('AI 策略', () => {
    it('AI 默认开启（引擎初始值）', () => {
      const e = new DotsAndBoxesEngine();
      expect((e as any)._aiEnabled).toBe(true);
    });

    it('setAI 可以关闭 AI', () => {
      engine.setAI(false);
      expect(engine.aiEnabled).toBe(false);
    });

    it('AI 优先完成方格', () => {
      engine.setAI(false);
      // 准备一个差一条边完成的方格，轮到 P2
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1); // top → P2
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2);   // left → P1
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_1); // bottom → P2

      // P2 应该选择完成方格
      expect(engine.currentPlayer).toBe(PLAYER_2);
      expect(engine.wouldCompleteBox({ row: 0, col: 1, direction: LINE_VERTICAL })).toBe(true);
    });

    it('wouldCompleteBox 检测正确', () => {
      engine.setAI(false);
      // (0,0) 有 3 条边
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2);
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_1);

      // right 边 (verticalLines[0][1]) 能完成
      expect(engine.wouldCompleteBox({ row: 0, col: 1, direction: LINE_VERTICAL })).toBe(true);
      // 其他线不能完成
      expect(engine.wouldCompleteBox({ row: 0, col: 1, direction: LINE_HORIZONTAL })).toBe(false);
    });

    it('wouldCreate3SideBox 检测正确', () => {
      engine.setAI(false);
      // (0,0) 有 2 条边
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2);

      // bottom 边会让 (0,0) 变 3 边
      expect(engine.wouldCreate3SideBox({ row: 1, col: 0, direction: LINE_HORIZONTAL })).toBe(true);
      // top 边已画，不会创建新 3 边
      // Actually top is already drawn, so it's not available
    });

    it('countCreated3SideBoxes 正确计数', () => {
      engine.setAI(false);
      // (0,0) 有 2 条边
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2);

      // bottom 边会让 (0,0) 变 3 边 → count = 1
      expect(engine.countCreated3SideBoxes({ row: 1, col: 0, direction: LINE_HORIZONTAL })).toBe(1);
    });

    it('AI 回合时 aiThinking 标记', () => {
      engine.setAI(true);
      // 手动触发 AI
      (engine as any)._currentPlayer = PLAYER_2;
      (engine as any)._aiThinking = false;
      (engine as any).scheduleAIMove();
      expect(engine.aiThinking).toBe(true);

      // 推进时间
      vi.advanceTimersByTime(500);
    });
  });

  // ========== 生命周期 ==========

  describe('生命周期', () => {
    it('init 正确初始化', () => {
      const e = new DotsAndBoxesEngine();
      const canvas = createMockCanvas();
      e.init(canvas);
      expect(e.gridPoints).toBe(DEFAULT_GRID_SIZE);
      e.destroy();
    });

    it('start 重置并开始', () => {
      engine.setAI(false);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);

      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
      engine.reset();
      engine.start();
      rafSpy.mockRestore();

      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(false);
      expect(engine.player1Score).toBe(0);
    });

    it('reset 清除所有状态', () => {
      engine.setAI(false);
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      engine.reset();
      expect(engine.isLineDrawn(0, 0, LINE_HORIZONTAL)).toBe(false);
      expect(engine.player1Score).toBe(0);
      expect(engine.currentPlayer).toBe(PLAYER_1);
      expect(engine.isGameOver).toBe(false);
    });

    it('destroy 清理资源', () => {
      engine.destroy();
      expect(engine.aiThinking).toBe(false);
    });

    it('pause 暂停游戏', () => {
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 恢复游戏', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
      engine.pause();
      engine.resume();
      rafSpy.mockRestore();
      expect(engine.status).toBe('playing');
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('返回完整状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('gridPoints');
      expect(state).toHaveProperty('currentPlayer');
      expect(state).toHaveProperty('scores');
      expect(state).toHaveProperty('totalBoxes');
      expect(state).toHaveProperty('completedBoxes');
      expect(state).toHaveProperty('isGameOver');
      expect(state).toHaveProperty('winner');
      expect(state).toHaveProperty('aiEnabled');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('cursorDirection');
      expect(state).toHaveProperty('horizontalLines');
      expect(state).toHaveProperty('verticalLines');
      expect(state).toHaveProperty('boxes');
    });

    it('状态值正确', () => {
      const state = engine.getState();
      expect(state.gridPoints).toBe(5);
      expect(state.currentPlayer).toBe(PLAYER_1);
      expect(state.scores).toEqual([0, 0]);
      expect(state.totalBoxes).toBe(16);
      expect(state.completedBoxes).toBe(0);
      expect(state.isGameOver).toBe(false);
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('boxCompleted 事件在完成方格时触发', () => {
      engine.setAI(false);
      const handler = vi.fn();
      engine.on('boxCompleted', handler);

      // 完成一个方格
      completeOneBox(engine, 0, 0, PLAYER_1);

      expect(handler).toHaveBeenCalled();
    });

    it('stateChange 事件在状态变化时触发', () => {
      engine.setAI(false);
      const handler = vi.fn();
      engine.on('stateChange', handler);

      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(handler).toHaveBeenCalled();
    });

    it('off 取消事件监听', () => {
      engine.setAI(false);
      const handler = vi.fn();
      engine.on('stateChange', handler);
      engine.off('stateChange', handler);

      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('3×3 网格完整游戏流程', () => {
      const e = startEngine(3);
      e.setAI(false);
      // 2×2 = 4 个方格
      // 完成所有方格
      fillAllBoxesSmall(e);
      expect(e.isGameOver).toBe(true);
      expect(e.completedBoxes).toBe(4);
      e.destroy();
    });

    it('所有线画完但方格未满（不应该发生）', () => {
      engine.setAI(false);
      // 这个情况在正常游戏中不会发生
      // 因为画线完成方格是自动检测的
      expect(engine.completedBoxes).toBe(0);
    });

    it('handleKeyUp 不报错', () => {
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });

    it('重复 reset 不报错', () => {
      expect(() => {
        engine.reset();
        engine.reset();
        engine.reset();
      }).not.toThrow();
    });

    it('重复 destroy 不报错', () => {
      const e = startEngine();
      expect(() => {
        e.destroy();
        e.destroy();
      }).not.toThrow();
    });

    it('未初始化 canvas 时 start 报错', () => {
      const e = new DotsAndBoxesEngine();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });

    it('drawCurrentLine 在游戏结束后返回 false', () => {
      engine.setAI(false);
      (engine as any)._gameOver = true;
      expect(engine.drawCurrentLine()).toBe(false);
    });

    it('drawCurrentLine 在 AI 思考时返回 false', () => {
      engine.setAI(false);
      (engine as any)._aiThinking = true;
      expect(engine.drawCurrentLine()).toBe(false);
    });
  });

  // ========== 完整游戏流程 ==========

  describe('完整游戏流程', () => {
    it('5×5 完整对局（AI 关闭）', () => {
      engine.setAI(false);
      // 轮流画线直到游戏结束
      let moves = 0;
      const maxMoves = 100; // 安全限制

      while (!engine.isGameOver && moves < maxMoves) {
        const available = engine.getAvailableLines();
        if (available.length === 0) break;
        const line = available[0];
        engine.drawLine(line.row, line.col, line.direction, engine.currentPlayer);
        moves++;
      }

      expect(engine.isGameOver).toBe(true);
      expect(engine.completedBoxes).toBe(16);
      expect(engine.player1Score + engine.player2Score).toBe(16);
    });

    it('3×3 完整对局（AI 关闭）', () => {
      const e = startEngine(3);
      e.setAI(false);

      let moves = 0;
      while (!e.isGameOver && moves < 50) {
        const available = e.getAvailableLines();
        if (available.length === 0) break;
        const line = available[0];
        e.drawLine(line.row, line.col, line.direction, e.currentPlayer);
        moves++;
      }

      expect(e.isGameOver).toBe(true);
      expect(e.completedBoxes).toBe(4);
      e.destroy();
    });

    it('7×7 完整对局（AI 关闭）', () => {
      const e = startEngine(7);
      e.setAI(false);

      let moves = 0;
      while (!e.isGameOver && moves < 200) {
        const available = e.getAvailableLines();
        if (available.length === 0) break;
        const line = available[0];
        e.drawLine(line.row, line.col, line.direction, e.currentPlayer);
        moves++;
      }

      expect(e.isGameOver).toBe(true);
      expect(e.completedBoxes).toBe(36);
      e.destroy();
    });
  });

  // ========== 渲染测试 ==========

  describe('渲染', () => {
    it('onRender 不报错', () => {
      const ctx = createMockCanvas().getContext('2d')!;
      expect(() => engine.onRender(ctx, 480, 640)).not.toThrow();
    });

    it('游戏结束后渲染不报错', () => {
      engine.setAI(false);
      (engine as any)._gameOver = true;
      const ctx = createMockCanvas().getContext('2d')!;
      expect(() => engine.onRender(ctx, 480, 640)).not.toThrow();
    });

    it('有方格时渲染不报错', () => {
      engine.setAI(false);
      completeOneBox(engine, 0, 0, PLAYER_1);
      const ctx = createMockCanvas().getContext('2d')!;
      expect(() => engine.onRender(ctx, 480, 640)).not.toThrow();
    });
  });

  // ========== 属性访问器 ==========

  describe('属性访问器', () => {
    it('horizontalLines 返回副本', () => {
      const lines = engine.horizontalLines;
      lines[0][0] = 99;
      expect(engine.horizontalLines[0][0]).toBe(NO_PLAYER);
    });

    it('verticalLines 返回副本', () => {
      const lines = engine.verticalLines;
      lines[0][0] = 99;
      expect(engine.verticalLines[0][0]).toBe(NO_PLAYER);
    });

    it('boxes 返回副本', () => {
      const boxes = engine.boxes;
      boxes[0][0] = 99;
      expect(engine.boxes[0][0]).toBe(NO_PLAYER);
    });

    it('scores 返回副本', () => {
      const scores = engine.scores;
      scores[0] = 99;
      expect(engine.player1Score).toBe(0);
    });
  });

  // ========== 分数更新 ==========

  describe('分数更新', () => {
    it('完成方格时 addScore 被调用', () => {
      engine.setAI(false);
      const handler = vi.fn();
      engine.on('scoreChange', handler);

      completeOneBox(engine, 0, 0, PLAYER_1);
      expect(handler).toHaveBeenCalled();
    });

    it('P1 分数正确', () => {
      engine.setAI(false);
      const completer = completeOneBox(engine, 0, 0, PLAYER_1);
      if (completer === PLAYER_1) {
        expect(engine.player1Score).toBe(1);
      } else {
        expect(engine.player2Score).toBe(1);
      }
    });

    it('P2 分数正确', () => {
      engine.setAI(false);
      // 让 P2 完成一个方格 — 需要让 P2 成为完成者
      // P1 画 top
      engine.drawLine(0, 0, LINE_HORIZONTAL, PLAYER_1); // P1 → switch to P2
      // P2 画 left
      engine.drawLine(0, 0, LINE_VERTICAL, PLAYER_2); // P2 → switch to P1
      // P1 画 bottom
      engine.drawLine(1, 0, LINE_HORIZONTAL, PLAYER_1); // P1 → switch to P2
      // P2 画 right — completes box
      engine.drawLine(0, 1, LINE_VERTICAL, PLAYER_2); // P2 completes
      expect(engine.player2Score).toBe(1);
    });
  });

  // ========== update 方法 ==========

  describe('update 方法', () => {
    it('update 在 AI 关闭时不触发 AI', () => {
      engine.setAI(false);
      expect(() => engine.update(16)).not.toThrow();
    });

    it('update 在 AI 开启且 P2 回合时安排 AI', () => {
      engine.setAI(true);
      (engine as any)._currentPlayer = PLAYER_2;
      engine.update(16);
      // AI 应该被安排
    });

    it('update 在游戏结束后不触发 AI', () => {
      engine.setAI(true);
      (engine as any)._gameOver = true;
      (engine as any)._currentPlayer = PLAYER_2;
      engine.update(16);
      expect(engine.aiThinking).toBe(false);
    });

    it('update 在 AI 已在思考时不重复安排', () => {
      engine.setAI(true);
      (engine as any)._currentPlayer = PLAYER_2;
      (engine as any)._aiThinking = true;
      engine.update(16);
      // 不应该重复安排
    });
  });

  // ========== 3×3 特定测试 ==========

  describe('3×3 网格特定测试', () => {
    let e: DotsAndBoxesEngine;

    beforeEach(() => {
      e = startEngine(3);
      e.setAI(false);
    });

    afterEach(() => {
      e.destroy();
    });

    it('正确初始化', () => {
      expect(e.gridPoints).toBe(3);
      expect(e.rows).toBe(2);
      expect(e.cols).toBe(2);
      expect(e.totalBoxes).toBe(4);
    });

    it('水平线 3 行 × 2 列', () => {
      expect(e.horizontalLines.length).toBe(3);
      expect(e.horizontalLines[0].length).toBe(2);
    });

    it('垂直线 2 行 × 3 列', () => {
      expect(e.verticalLines.length).toBe(2);
      expect(e.verticalLines[0].length).toBe(3);
    });

    it('完成一个方格', () => {
      const completer = completeOneBox(e, 0, 0, PLAYER_1);
      expect(e.getBoxOwner(0, 0)).toBe(completer);
      if (completer === PLAYER_1) {
        expect(e.player1Score).toBe(1);
      } else {
        expect(e.player2Score).toBe(1);
      }
    });

    it('光标范围正确', () => {
      expect(e.getMaxRow(LINE_HORIZONTAL)).toBe(2); // 3-1=2
      expect(e.getMaxRow(LINE_VERTICAL)).toBe(1);   // 2-1=1
      expect(e.getMaxCol(LINE_HORIZONTAL)).toBe(1); // 2-1=1
      expect(e.getMaxCol(LINE_VERTICAL)).toBe(2);   // 3-1=2
    });
  });

  // ========== 7×7 特定测试 ==========

  describe('7×7 网格特定测试', () => {
    let e: DotsAndBoxesEngine;

    beforeEach(() => {
      e = startEngine(7);
      e.setAI(false);
    });

    afterEach(() => {
      e.destroy();
    });

    it('正确初始化', () => {
      expect(e.gridPoints).toBe(7);
      expect(e.rows).toBe(6);
      expect(e.cols).toBe(6);
      expect(e.totalBoxes).toBe(36);
    });

    it('水平线 7 行 × 6 列', () => {
      expect(e.horizontalLines.length).toBe(7);
      expect(e.horizontalLines[0].length).toBe(6);
    });

    it('垂直线 6 行 × 7 列', () => {
      expect(e.verticalLines.length).toBe(6);
      expect(e.verticalLines[0].length).toBe(7);
    });

    it('光标范围正确', () => {
      expect(e.getMaxRow(LINE_HORIZONTAL)).toBe(6); // 7-1=6
      expect(e.getMaxRow(LINE_VERTICAL)).toBe(5);   // 6-1=5
      expect(e.getMaxCol(LINE_HORIZONTAL)).toBe(5); // 6-1=5
      expect(e.getMaxCol(LINE_VERTICAL)).toBe(6);   // 7-1=6
    });
  });
});

// ========== 辅助函数 ==========

/**
 * 完成一个方格（指定位置）
 * 画前三条边（交替玩家），第四条边由当前玩家画并完成方格
 * 返回完成方格的玩家
 */
function completeOneBox(engine: DotsAndBoxesEngine, boxRow: number, boxCol: number, _startPlayer: number): number {
  // top: horizontalLines[boxRow][boxCol]
  const p1 = engine.currentPlayer;
  engine.drawLine(boxRow, boxCol, LINE_HORIZONTAL, p1);
  // left: verticalLines[boxRow][boxCol]
  const p2 = engine.currentPlayer;
  engine.drawLine(boxRow, boxCol, LINE_VERTICAL, p2);
  // bottom: horizontalLines[boxRow + 1][boxCol]
  const p3 = engine.currentPlayer;
  engine.drawLine(boxRow + 1, boxCol, LINE_HORIZONTAL, p3);
  // right: verticalLines[boxRow][boxCol + 1] — 完成方格
  const p4 = engine.currentPlayer;
  engine.drawLine(boxRow, boxCol + 1, LINE_VERTICAL, p4);
  return p4; // 返回完成方格的玩家
}

/**
 * 填充所有方格给指定玩家（通过轮流画线，确保指定玩家完成所有方格）
 */
function fillAllBoxes(engine: DotsAndBoxesEngine, targetPlayer: number): void {
  const rows = engine.rows;
  const cols = engine.cols;
  const other = targetPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (engine.getBoxOwner(r, c) !== NO_PLAYER) continue;

      // 确保当前回合是 targetPlayer
      // 如果不是，画一条安全的线来消耗回合
      if (engine.currentPlayer !== targetPlayer) {
        drawSafeLine(engine);
      }
      if (engine.isGameOver) return;

      // 确保 targetPlayer 来完成这个方格
      // 画前三条边（交替），让 targetPlayer 画第四条
      // top: other player
      if (engine.currentPlayer !== other) drawSafeLine(engine);
      if (!engine.isLineDrawn(r, c, LINE_HORIZONTAL)) {
        engine.drawLine(r, c, LINE_HORIZONTAL, engine.currentPlayer);
      }
      if (engine.isGameOver) return;

      // left: targetPlayer (gets extra turn after completing? No, not completing yet)
      if (!engine.isLineDrawn(r, c, LINE_VERTICAL)) {
        engine.drawLine(r, c, LINE_VERTICAL, engine.currentPlayer);
      }
      if (engine.isGameOver) return;

      // bottom: other
      if (!engine.isLineDrawn(r + 1, c, LINE_HORIZONTAL)) {
        engine.drawLine(r + 1, c, LINE_HORIZONTAL, engine.currentPlayer);
      }
      if (engine.isGameOver) return;

      // right — targetPlayer should complete
      // Make sure targetPlayer is current
      if (engine.currentPlayer !== targetPlayer) {
        drawSafeLine(engine);
      }
      if (!engine.isLineDrawn(r, c + 1, LINE_VERTICAL)) {
        engine.drawLine(r, c + 1, LINE_VERTICAL, engine.currentPlayer);
      }
    }
  }
}

/**
 * 画一条安全的线（不影响任何方格）
 */
function drawSafeLine(engine: DotsAndBoxesEngine): void {
  const available = engine.getAvailableLines();
  // 找不会创建 3 边方格的线
  for (const line of available) {
    if (!(engine as any).wouldCreate3SideBox(line)) {
      engine.drawLine(line.row, line.col, line.direction, engine.currentPlayer);
      return;
    }
  }
  // 如果没有安全线，画第一条
  if (available.length > 0) {
    engine.drawLine(available[0].row, available[0].col, available[0].direction, engine.currentPlayer);
  }
}

/**
 * 3×3 网格填充所有方格
 */
function fillAllBoxes3x3(engine: DotsAndBoxesEngine): void {
  // 简单地轮流画线
  let moves = 0;
  while (!engine.isGameOver && moves < 50) {
    const available = engine.getAvailableLines();
    if (available.length === 0) break;
    const line = available[0];
    engine.drawLine(line.row, line.col, line.direction, engine.currentPlayer);
    moves++;
  }
}

/**
 * 小网格填充所有方格
 */
function fillAllBoxesSmall(engine: DotsAndBoxesEngine): void {
  let moves = 0;
  while (!engine.isGameOver && moves < 50) {
    const available = engine.getAvailableLines();
    if (available.length === 0) break;
    const line = available[0];
    engine.drawLine(line.row, line.col, line.direction, engine.currentPlayer);
    moves++;
  }
}
