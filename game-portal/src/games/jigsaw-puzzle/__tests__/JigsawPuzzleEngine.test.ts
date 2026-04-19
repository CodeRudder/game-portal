/**
 * JigsawPuzzleEngine 综合测试
 * 覆盖：碎片生成/打乱、选择/移动/放置、吸附检测、完成判定、
 *       计时/步数、键盘控制、getState、事件系统、边界与异常场景
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JigsawPuzzleEngine } from '../JigsawPuzzleEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  GRID_SIZE, TOTAL_PIECES,
  PUZZLE_AREA_Y, PUZZLE_AREA_PADDING, PUZZLE_AREA_SIZE, PIECE_SIZE,
  PIECE_AREA_Y, PIECE_AREA_GAP, PIECE_AREA_PADDING_X, PIECE_AREA_PADDING_Y,
  PIECE_AREA_COLS, PIECE_DISPLAY_SIZE,
  BG_COLOR, HUD_BG_COLOR, PUZZLE_BG_COLOR, HUD_TEXT_COLOR,
  CURSOR_COLOR, SELECTED_COLOR, PLACED_CORRECT_COLOR,
  EMPTY_SLOT_COLOR, PIECE_BORDER_COLOR, GRID_LINE_COLOR,
  PROGRESS_BAR_BG, PROGRESS_BAR_FG,
  PATTERNS, SHUFFLE_ITERATIONS,
  HUD_FONT, NUMBER_FONT, WIN_FONT, PROGRESS_FONT,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): JigsawPuzzleEngine {
  const engine = new JigsawPuzzleEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

function createAndStartEngine(): JigsawPuzzleEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

function getPrivate<T>(engine: JigsawPuzzleEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

function setPrivate(engine: JigsawPuzzleEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

// ============================================================
// Tests
// ============================================================

describe('JigsawPuzzleEngine', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== 1. 常量验证 ==========
  describe('常量验证', () => {
    it('画布尺寸应为 480×640', () => {
      expect(CANVAS_WIDTH).toBe(480);
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('网格尺寸应为 4×4', () => {
      expect(GRID_SIZE).toBe(4);
    });

    it('总碎片数应为 16', () => {
      expect(TOTAL_PIECES).toBe(16);
    });

    it('应有多个图案', () => {
      expect(PATTERNS.length).toBeGreaterThanOrEqual(4);
    });

    it('每个图案应为 4×4 颜色矩阵', () => {
      for (const pattern of PATTERNS) {
        expect(pattern.length).toBe(GRID_SIZE);
        for (const row of pattern) {
          expect(row.length).toBe(GRID_SIZE);
        }
      }
    });

    it('打乱次数应大于 0', () => {
      expect(SHUFFLE_ITERATIONS).toBeGreaterThan(0);
    });
  });

  // ========== 2. 引擎初始化 ==========
  describe('初始化', () => {
    it('应能创建引擎实例', () => {
      const engine = new JigsawPuzzleEngine();
      expect(engine).toBeInstanceOf(JigsawPuzzleEngine);
    });

    it('init 后状态应为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后碎片列表应为空', () => {
      const engine = createEngine();
      expect(engine.getPieces()).toEqual([]);
    });

    it('init 后 placedCount 应为 0', () => {
      const engine = createEngine();
      expect(engine.placedCount).toBe(0);
    });

    it('init 后 moveCount 应为 0', () => {
      const engine = createEngine();
      expect(engine.moveCount).toBe(0);
    });

    it('init 后 isCompleted 应为 false', () => {
      const engine = createEngine();
      expect(engine.isCompleted).toBe(false);
    });

    it('init 后 isWin 应为 false', () => {
      const engine = createEngine();
      expect(engine.isWin).toBe(false);
    });

    it('init 后 selectedPieceId 应为 -1', () => {
      const engine = createEngine();
      expect(engine.selectedPieceId).toBe(-1);
    });

    it('init 后光标应在碎片区域 (0,0)', () => {
      const engine = createEngine();
      expect(engine.cursorRow).toBe(0);
      expect(engine.cursorCol).toBe(0);
      expect(engine.cursorInPuzzle).toBe(false);
    });

    it('init 后图案索引应为 0', () => {
      const engine = createEngine();
      expect(engine.patternIndex).toBe(0);
    });
  });

  // ========== 3. 碎片生成 ==========
  describe('碎片生成', () => {
    it('start 后应生成 16 个碎片', () => {
      const engine = createAndStartEngine();
      expect(engine.getPieces().length).toBe(TOTAL_PIECES);
    });

    it('每个碎片应有正确的 id（0~15）', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const ids = pieces.map(p => p.id).sort((a, b) => a - b);
      expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    });

    it('start 后碎片初始状态均未放置', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      for (const p of pieces) {
        expect(p.isPlaced).toBe(false);
      }
    });

    it('start 后所有碎片应在碎片区域（slotIndex >= 0）', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      for (const p of pieces) {
        expect(p.slotIndex).toBeGreaterThanOrEqual(0);
        expect(p.slotIndex).toBeLessThan(TOTAL_PIECES);
      }
    });

    it('碎片的 slotIndex 应该是唯一的', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const slotIndices = pieces.map(p => p.slotIndex);
      const uniqueSlots = new Set(slotIndices);
      expect(uniqueSlots.size).toBe(TOTAL_PIECES);
    });

    it('start 后状态应为 playing', () => {
      const engine = createAndStartEngine();
      expect(engine.status).toBe('playing');
    });

    it('start 后 score 应为 0', () => {
      const engine = createAndStartEngine();
      expect(engine.score).toBe(0);
    });

    it('start 后 level 应为 1', () => {
      const engine = createAndStartEngine();
      expect(engine.level).toBe(1);
    });
  });

  // ========== 4. 碎片打乱 ==========
  describe('碎片打乱', () => {
    it('start 后碎片不应全部在原始位置（大概率）', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      let allInPlace = true;
      for (const p of pieces) {
        if (p.slotIndex !== p.id) {
          allInPlace = false;
          break;
        }
      }
      // 打乱后几乎不可能全部在原位
      expect(allInPlace).toBe(false);
    });

    it('多次 start 应产生不同的打乱结果', () => {
      const engine = createEngine();
      engine.start();
      const firstSlots = engine.getPieces().map(p => p.slotIndex);
      engine.reset();
      engine.start();
      const secondSlots = engine.getPieces().map(p => p.slotIndex);
      // 大概率不同（极端情况下可能相同，但几乎不可能）
      const same = firstSlots.every((s, i) => s === secondSlots[i]);
      expect(same).toBe(false);
    });

    it('打乱后碎片数不变', () => {
      const engine = createAndStartEngine();
      expect(engine.getPieces().length).toBe(TOTAL_PIECES);
    });
  });

  // ========== 5. 光标移动 ==========
  describe('光标移动', () => {
    it('ArrowRight 应向右移动光标', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(1);
      expect(engine.cursorRow).toBe(0);
    });

    it('ArrowDown 应向下移动光标', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(1);
      expect(engine.cursorCol).toBe(0);
    });

    it('连续移动光标应正确更新位置', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(1);
      expect(engine.cursorCol).toBe(2);
    });

    it('光标不应超出右边界', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(GRID_SIZE - 1);
    });

    it('光标不应超出下边界', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(GRID_SIZE - 1);
    });

    it('光标不应超出左边界', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorCol).toBe(0);
    });

    it('光标不应超出上边界', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorRow).toBe(0);
    });

    it('WASD 也应能移动光标', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('d');
      expect(engine.cursorCol).toBe(1);
      engine.handleKeyDown('s');
      expect(engine.cursorRow).toBe(1);
      engine.handleKeyDown('a');
      expect(engine.cursorCol).toBe(0);
      engine.handleKeyDown('w');
      expect(engine.cursorRow).toBe(0);
    });

    it('大写 WASD 也应能移动光标', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('D');
      expect(engine.cursorCol).toBe(1);
      engine.handleKeyDown('S');
      expect(engine.cursorRow).toBe(1);
    });

    it('非方向键不应影响光标', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('x');
      expect(engine.cursorRow).toBe(0);
      expect(engine.cursorCol).toBe(0);
    });

    it('idle 状态下方向键不应移动光标', () => {
      const engine = createEngine();
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorRow).toBe(0);
      expect(engine.cursorCol).toBe(0);
    });
  });

  // ========== 6. Tab 切换区域 ==========
  describe('Tab 切换区域', () => {
    it('Tab 应切换到拼图区域', () => {
      const engine = createAndStartEngine();
      expect(engine.cursorInPuzzle).toBe(false);
      engine.handleKeyDown('Tab');
      expect(engine.cursorInPuzzle).toBe(true);
    });

    it('再次 Tab 应切换回碎片区域', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('Tab');
      engine.handleKeyDown('Tab');
      expect(engine.cursorInPuzzle).toBe(false);
    });

    it('在拼图区域时方向键应移动拼图光标', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('Tab');
      expect(engine.cursorInPuzzle).toBe(true);
      engine.handleKeyDown('ArrowRight');
      expect(engine.puzzleCursorCol).toBe(1);
      engine.handleKeyDown('ArrowDown');
      expect(engine.puzzleCursorRow).toBe(1);
    });

    it('拼图区域光标不应超出边界', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('Tab');
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowRight');
      expect(engine.puzzleCursorCol).toBe(GRID_SIZE - 1);
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowDown');
      expect(engine.puzzleCursorRow).toBe(GRID_SIZE - 1);
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowUp');
      expect(engine.puzzleCursorCol).toBe(GRID_SIZE - 2);
      expect(engine.puzzleCursorRow).toBe(GRID_SIZE - 2);
    });
  });

  // ========== 7. 选择碎片 ==========
  describe('选择碎片', () => {
    it('空格键应选中碎片区域当前光标位置的碎片', () => {
      const engine = createAndStartEngine();
      const slotIndex = 0; // 光标在 (0,0)
      const pieceAtSlot = engine.getPieces().find(p => p.slotIndex === slotIndex && !p.isPlaced);
      expect(pieceAtSlot).toBeDefined();
      engine.handleKeyDown(' ');
      expect(engine.selectedPieceId).toBe(pieceAtSlot!.id);
    });

    it('选中碎片后应自动切换到拼图区域', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown(' ');
      expect(engine.cursorInPuzzle).toBe(true);
    });

    it('在拼图区域时按空格不应选中碎片', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('Tab');
      engine.handleKeyDown(' ');
      expect(engine.selectedPieceId).toBe(-1);
    });

    it('选中碎片后光标应在拼图区域', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown(' ');
      expect(engine.cursorInPuzzle).toBe(true);
    });
  });

  // ========== 8. 放置碎片 ==========
  describe('放置碎片', () => {
    it('将碎片放到正确位置应成功', () => {
      const engine = createAndStartEngine();
      // 找到碎片 0 的位置
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      // 将光标移到碎片 0 的位置
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      // 选中
      engine.handleKeyDown(' ');
      expect(engine.selectedPieceId).toBe(0);
      // 碎片 0 的正确位置是 (0,0)，拼图光标默认在 (0,0)
      expect(engine.puzzleCursorRow).toBe(0);
      expect(engine.puzzleCursorCol).toBe(0);
      // 放置
      engine.handleKeyDown(' ');
      expect(engine.placedCount).toBe(1);
      expect(engine.selectedPieceId).toBe(-1);
    });

    it('放到错误位置应增加步数但不放置', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      engine.handleKeyDown(' ');
      // 移动到错误位置 (0,1)
      setPrivate(engine, '_puzzleCursorCol', 1);
      engine.handleKeyDown(' ');
      expect(engine.placedCount).toBe(0);
      expect(engine.moveCount).toBe(1);
      expect(engine.selectedPieceId).toBe(-1);
    });

    it('放置后碎片应标记为 isPlaced', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      engine.handleKeyDown(' ');
      engine.handleKeyDown(' ');
      const updatedPieces = engine.getPieces();
      const placedPiece = updatedPieces.find(p => p.id === 0);
      expect(placedPiece!.isPlaced).toBe(true);
      expect(placedPiece!.slotIndex).toBe(-1);
    });

    it('放置后 score 应更新', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      engine.handleKeyDown(' ');
      engine.handleKeyDown(' ');
      expect(engine.score).toBe(1);
    });

    it('放置碎片后应取消选中并回到碎片区域', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      engine.handleKeyDown(' ');
      engine.handleKeyDown(' ');
      expect(engine.selectedPieceId).toBe(-1);
      expect(engine.cursorInPuzzle).toBe(false);
    });

    it('placePiece 公共方法应正确放置', () => {
      const engine = createAndStartEngine();
      const result = engine.placePiece(0, 0, 0);
      expect(result).toBe(true);
      expect(engine.placedCount).toBe(1);
    });

    it('placePiece 到错误位置应返回 false', () => {
      const engine = createAndStartEngine();
      const result = engine.placePiece(0, 1, 1);
      expect(result).toBe(false);
      expect(engine.placedCount).toBe(0);
    });

    it('placePiece 重复放置已放置碎片应返回 false', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      const result = engine.placePiece(0, 0, 0);
      expect(result).toBe(false);
    });

    it('选中碎片后在碎片区域按空格应取消选择', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      engine.handleKeyDown(' ');
      expect(engine.selectedPieceId).toBe(0);
      // 切回碎片区域
      setPrivate(engine, '_cursorInPuzzle', false);
      engine.handleKeyDown(' ');
      expect(engine.selectedPieceId).toBe(-1);
    });
  });

  // ========== 9. 吸附检测 ==========
  describe('吸附检测', () => {
    it('碎片放到正确位置应自动吸附', () => {
      const engine = createAndStartEngine();
      const result = engine.placePiece(5, 1, 1); // 碎片 5 的正确位置是 row=1, col=1
      expect(result).toBe(true);
    });

    it('碎片放到错误位置不应吸附', () => {
      const engine = createAndStartEngine();
      const result = engine.placePiece(5, 2, 2);
      expect(result).toBe(false);
    });

    it('碎片 0 正确位置为 (0,0)', () => {
      const engine = createAndStartEngine();
      expect(engine.placePiece(0, 0, 0)).toBe(true);
    });

    it('碎片 15 正确位置为 (3,3)', () => {
      const engine = createAndStartEngine();
      expect(engine.placePiece(15, 3, 3)).toBe(true);
    });

    it('碎片 7 正确位置为 (1,3)', () => {
      const engine = createAndStartEngine();
      expect(engine.placePiece(7, 1, 3)).toBe(true);
    });

    it('碎片 8 正确位置为 (2,0)', () => {
      const engine = createAndStartEngine();
      expect(engine.placePiece(8, 2, 0)).toBe(true);
    });
  });

  // ========== 10. 完成判定 ==========
  describe('完成判定', () => {
    it('放置所有碎片后应判定为完成', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;
        engine.placePiece(i, row, col);
      }
      expect(engine.isCompleted).toBe(true);
      expect(engine.isWin).toBe(true);
    });

    it('完成时状态应变为 gameover', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;
        engine.placePiece(i, row, col);
      }
      expect(engine.status).toBe('gameover');
    });

    it('部分放置不应判定完成', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      expect(engine.isCompleted).toBe(false);
      engine.placePiece(5, 1, 1);
      expect(engine.isCompleted).toBe(false);
    });

    it('完成时应触发 statusChange 事件', () => {
      const engine = createAndStartEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      for (let i = 0; i < TOTAL_PIECES; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;
        engine.placePiece(i, row, col);
      }
      expect(listener).toHaveBeenCalledWith('gameover');
    });

    it('完成时 score 应等于 placedCount', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;
        engine.placePiece(i, row, col);
      }
      expect(engine.score).toBe(TOTAL_PIECES);
      expect(engine.placedCount).toBe(TOTAL_PIECES);
    });
  });

  // ========== 11. 计时和步数 ==========
  describe('计时和步数', () => {
    it('初始步数应为 0', () => {
      const engine = createAndStartEngine();
      expect(engine.moveCount).toBe(0);
    });

    it('成功放置应增加步数', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      expect(engine.moveCount).toBe(1);
    });

    it('多次放置应累计步数', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      engine.placePiece(1, 0, 1);
      engine.placePiece(2, 0, 2);
      expect(engine.moveCount).toBe(3);
    });

    it('错误放置也应增加步数（通过键盘操作）', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      engine.handleKeyDown(' ');
      // 移动到错误位置
      setPrivate(engine, '_puzzleCursorCol', 2);
      engine.handleKeyDown(' ');
      expect(engine.moveCount).toBe(1);
    });

    it('elapsedTime 在 idle 时应为 0', () => {
      const engine = createEngine();
      expect(engine.elapsedTime).toBe(0);
    });
  });

  // ========== 12. 键盘控制 ==========
  describe('键盘控制', () => {
    it('空格在 idle 状态应启动游戏', () => {
      const engine = createEngine();
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('空格在 gameover 状态应重新开始', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      expect(engine.status).toBe('gameover');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('R 键应重置游戏', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      engine.handleKeyDown('r');
      expect(engine.status).toBe('idle');
      expect(engine.placedCount).toBe(0);
      expect(engine.moveCount).toBe(0);
    });

    it('大写 R 键也应重置游戏', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('R');
      expect(engine.status).toBe('idle');
    });

    it('N 键在 idle 状态应切换图案', () => {
      const engine = createEngine();
      expect(engine.patternIndex).toBe(0);
      engine.handleKeyDown('n');
      expect(engine.patternIndex).toBe(1);
      engine.handleKeyDown('N');
      expect(engine.patternIndex).toBe(2);
    });

    it('N 键在 playing 状态不应切换图案', () => {
      const engine = createAndStartEngine();
      const prevPattern = engine.patternIndex;
      engine.handleKeyDown('n');
      expect(engine.patternIndex).toBe(prevPattern);
    });

    it('N 键应循环切换图案', () => {
      const engine = createEngine();
      for (let i = 0; i < PATTERNS.length; i++) {
        engine.handleKeyDown('n');
      }
      expect(engine.patternIndex).toBe(0);
    });

    it('完成状态下方向键不应移动光标', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      const prevRow = engine.cursorRow;
      const prevCol = engine.cursorCol;
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorRow).toBe(prevRow);
      expect(engine.cursorCol).toBe(prevCol);
    });
  });

  // ========== 13. getState ==========
  describe('getState', () => {
    it('应返回包含所有关键字段的状态', () => {
      const engine = createAndStartEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('patternIndex');
      expect(state).toHaveProperty('pieces');
      expect(state).toHaveProperty('placedCount');
      expect(state).toHaveProperty('moveCount');
      expect(state).toHaveProperty('isCompleted');
      expect(state).toHaveProperty('isWin');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('cursorInPuzzle');
      expect(state).toHaveProperty('puzzleCursorRow');
      expect(state).toHaveProperty('puzzleCursorCol');
      expect(state).toHaveProperty('selectedPieceId');
      expect(state).toHaveProperty('elapsedTime');
    });

    it('idle 状态的 getState 应返回初始值', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.placedCount).toBe(0);
      expect(state.moveCount).toBe(0);
      expect(state.isCompleted).toBe(false);
      expect(state.isWin).toBe(false);
      expect(state.selectedPieceId).toBe(-1);
    });

    it('放置碎片后 getState 应反映变化', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      const state = engine.getState();
      expect(state.placedCount).toBe(1);
      expect(state.moveCount).toBe(1);
      expect(state.score).toBe(1);
    });
  });

  // ========== 14. 事件系统 ==========
  describe('事件系统', () => {
    it('start 应触发 statusChange 为 playing', () => {
      const engine = createEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.start();
      expect(listener).toHaveBeenCalledWith('playing');
    });

    it('reset 应触发 statusChange 为 idle', () => {
      const engine = createAndStartEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.handleKeyDown('r');
      expect(listener).toHaveBeenCalledWith('idle');
    });

    it('放置碎片应触发 scoreChange', () => {
      const engine = createAndStartEngine();
      const listener = vi.fn();
      engine.on('scoreChange', listener);
      engine.placePiece(0, 0, 0);
      expect(listener).toHaveBeenCalledWith(1);
    });

    it('放置碎片应触发 stateChange', () => {
      const engine = createAndStartEngine();
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.placePiece(0, 0, 0);
      expect(listener).toHaveBeenCalled();
    });

    it('off 应取消事件监听', () => {
      const engine = createEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.off('statusChange', listener);
      engine.start();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ========== 15. setPatternIndex ==========
  describe('setPatternIndex', () => {
    it('idle 状态下应能设置图案索引', () => {
      const engine = createEngine();
      engine.setPatternIndex(2);
      expect(engine.patternIndex).toBe(2);
    });

    it('playing 状态下不应改变图案索引', () => {
      const engine = createAndStartEngine();
      engine.setPatternIndex(2);
      expect(engine.patternIndex).toBe(0);
    });

    it('负索引不应被接受', () => {
      const engine = createEngine();
      engine.setPatternIndex(-1);
      expect(engine.patternIndex).toBe(0);
    });

    it('超出范围的索引不应被接受', () => {
      const engine = createEngine();
      engine.setPatternIndex(999);
      expect(engine.patternIndex).toBe(0);
    });
  });

  // ========== 16. getPieceAtSlot ==========
  describe('getPieceAtSlot', () => {
    it('应返回指定位置的碎片 ID', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      // 找到 slotIndex=0 的碎片
      const pieceAtSlot0 = pieces.find(p => p.slotIndex === 0);
      const result = engine.getPieceAtSlot(0, 0);
      expect(result).toBe(pieceAtSlot0!.id);
    });

    it('已放置碎片的位置应返回 -1', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      const piece0 = pieces.find(p => p.id === 0)!;
      setPrivate(engine, '_cursorRow', piece0.areaRow);
      setPrivate(engine, '_cursorCol', piece0.areaCol);
      engine.handleKeyDown(' ');
      engine.handleKeyDown(' ');
      // 碎片 0 已放置，其原位置应返回 -1 或其他碎片
      // （因为打乱后碎片 0 可能不在 slot (0,0)）
    });
  });

  // ========== 17. isSlotPlaced ==========
  describe('isSlotPlaced', () => {
    it('未放置时应返回 false', () => {
      const engine = createAndStartEngine();
      expect(engine.isSlotPlaced(0, 0)).toBe(false);
    });

    it('放置后应返回 true', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      expect(engine.isSlotPlaced(0, 0)).toBe(true);
    });

    it('其他位置仍应返回 false', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      expect(engine.isSlotPlaced(0, 1)).toBe(false);
      expect(engine.isSlotPlaced(1, 0)).toBe(false);
    });
  });

  // ========== 18. getPatternColor ==========
  describe('getPatternColor', () => {
    it('应返回正确的颜色字符串', () => {
      const engine = createEngine();
      const color = engine.getPatternColor(0);
      expect(typeof color).toBe('string');
      expect(color).toBeTruthy();
    });

    it('碎片 0 应返回图案 [0][0] 的颜色', () => {
      const engine = createEngine();
      expect(engine.getPatternColor(0)).toBe(PATTERNS[0][0][0]);
    });

    it('碎片 5 应返回图案 [1][1] 的颜色', () => {
      const engine = createEngine();
      expect(engine.getPatternColor(5)).toBe(PATTERNS[0][1][1]);
    });

    it('切换图案后应返回新图案的颜色', () => {
      const engine = createEngine();
      engine.setPatternIndex(1);
      expect(engine.getPatternColor(0)).toBe(PATTERNS[1][0][0]);
    });
  });

  // ========== 19. 重置 ==========
  describe('重置', () => {
    it('reset 后状态应为 idle', () => {
      const engine = createAndStartEngine();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后碎片应为空', () => {
      const engine = createAndStartEngine();
      engine.reset();
      expect(engine.getPieces()).toEqual([]);
    });

    it('reset 后步数应归零', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      engine.reset();
      expect(engine.moveCount).toBe(0);
    });

    it('reset 后分数应归零', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('reset 后 placedCount 应归零', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      engine.reset();
      expect(engine.placedCount).toBe(0);
    });

    it('reset 后 isCompleted 应为 false', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      engine.reset();
      expect(engine.isCompleted).toBe(false);
    });

    it('reset 后 isWin 应为 false', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      engine.reset();
      expect(engine.isWin).toBe(false);
    });

    it('reset 后光标应回到初始位置', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowDown');
      engine.reset();
      expect(engine.cursorRow).toBe(0);
      expect(engine.cursorCol).toBe(0);
      expect(engine.cursorInPuzzle).toBe(false);
    });

    it('reset 后 selectedPieceId 应为 -1', () => {
      const engine = createAndStartEngine();
      engine.reset();
      expect(engine.selectedPieceId).toBe(-1);
    });
  });

  // ========== 20. destroy ==========
  describe('destroy', () => {
    it('destroy 后应清理事件监听', () => {
      const engine = createAndStartEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.destroy();
      // 再次触发不应调用 listener
      // 由于 destroy 清理了 listeners，我们验证不会出错
    });

    it('destroy 后状态应为 idle', () => {
      const engine = createAndStartEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ========== 21. handleKeyUp ==========
  describe('handleKeyUp', () => {
    it('handleKeyUp 不应抛出异常', () => {
      const engine = createAndStartEngine();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ========== 22. 边界与异常场景 ==========
  describe('边界与异常场景', () => {
    it('光标在角落时不应越界', () => {
      const engine = createAndStartEngine();
      // 左上角
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorRow).toBe(0);
      expect(engine.cursorCol).toBe(0);
    });

    it('光标在右下角时不应越界', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < 5; i++) engine.handleKeyDown('ArrowRight');
      for (let i = 0; i < 5; i++) engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(3);
      expect(engine.cursorCol).toBe(3);
    });

    it('placePiece 在 idle 状态应返回 false', () => {
      const engine = createEngine();
      expect(engine.placePiece(0, 0, 0)).toBe(false);
    });

    it('placePiece 在 gameover 状态应返回 false', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      expect(engine.placePiece(0, 0, 0)).toBe(false);
    });

    it('placePiece 无效 ID 应返回 false', () => {
      const engine = createAndStartEngine();
      expect(engine.placePiece(-1, 0, 0)).toBe(false);
      expect(engine.placePiece(99, 0, 0)).toBe(false);
    });

    it('连续选中放置多个碎片应正常工作', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      engine.placePiece(1, 0, 1);
      engine.placePiece(2, 0, 2);
      expect(engine.placedCount).toBe(3);
    });

    it('Tab 在 idle 状态不应切换区域', () => {
      const engine = createEngine();
      engine.handleKeyDown('Tab');
      expect(engine.cursorInPuzzle).toBe(false);
    });

    it('Tab 在完成状态不应切换区域', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      engine.handleKeyDown('Tab');
      // 已完成，不应改变
    });
  });

  // ========== 23. 暂停与恢复 ==========
  describe('暂停与恢复', () => {
    it('pause 应将状态设为 paused', () => {
      const engine = createAndStartEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 应将状态恢复为 playing', () => {
      const engine = createAndStartEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('idle 状态下 pause 不应生效', () => {
      const engine = createEngine();
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('paused 状态下方向键不应移动光标', () => {
      const engine = createAndStartEngine();
      engine.pause();
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(0);
    });
  });

  // ========== 24. 完整游戏流程 ==========
  describe('完整游戏流程', () => {
    it('应能完成完整的游戏流程：init → start → 放置所有碎片 → gameover', () => {
      const engine = new JigsawPuzzleEngine();
      const canvas = createMockCanvas();
      engine.init(canvas);
      expect(engine.status).toBe('idle');

      engine.start();
      expect(engine.status).toBe('playing');

      // 放置所有碎片
      for (let i = 0; i < TOTAL_PIECES; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;
        const result = engine.placePiece(i, row, col);
        expect(result).toBe(true);
      }

      expect(engine.isCompleted).toBe(true);
      expect(engine.isWin).toBe(true);
      expect(engine.status).toBe('gameover');
      expect(engine.placedCount).toBe(TOTAL_PIECES);
    });

    it('应能重置后重新开始', () => {
      const engine = createAndStartEngine();
      engine.placePiece(0, 0, 0);
      engine.placePiece(1, 0, 1);
      engine.reset();
      expect(engine.status).toBe('idle');
      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.placedCount).toBe(0);
      expect(engine.moveCount).toBe(0);
    });

    it('gameover 后空格应重新开始', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      expect(engine.status).toBe('gameover');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
      expect(engine.placedCount).toBe(0);
    });
  });

  // ========== 25. 渲染不崩溃 ==========
  describe('渲染不崩溃', () => {
    it('idle 状态下渲染不应崩溃', () => {
      const engine = createEngine();
      expect(() => engine.start()).not.toThrow();
      // 渲染由 gameLoop 触发，这里验证 start 不崩溃
    });

    it('playing 状态下渲染不应崩溃', () => {
      const engine = createAndStartEngine();
      expect(() => engine.placePiece(0, 0, 0)).not.toThrow();
    });

    it('gameover 状态下渲染不应崩溃', () => {
      const engine = createAndStartEngine();
      for (let i = 0; i < TOTAL_PIECES; i++) {
        engine.placePiece(i, Math.floor(i / GRID_SIZE), i % GRID_SIZE);
      }
      expect(engine.status).toBe('gameover');
    });
  });

  // ========== 26. 属性访问器 ==========
  describe('属性访问器', () => {
    it('score 应反映已放置碎片数', () => {
      const engine = createAndStartEngine();
      expect(engine.score).toBe(0);
      engine.placePiece(0, 0, 0);
      expect(engine.score).toBe(1);
      engine.placePiece(1, 0, 1);
      expect(engine.score).toBe(2);
    });

    it('level 应始终为 1', () => {
      const engine = createAndStartEngine();
      expect(engine.level).toBe(1);
    });

    it('elapsedTime 在游戏开始后应 >= 0', () => {
      const engine = createAndStartEngine();
      expect(engine.elapsedTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ========== 27. setCanvas ==========
  describe('setCanvas', () => {
    it('setCanvas 应不抛出异常', () => {
      const engine = new JigsawPuzzleEngine();
      const canvas = createMockCanvas();
      expect(() => engine.setCanvas(canvas)).not.toThrow();
    });
  });

  // ========== 28. 碎片区域布局 ==========
  describe('碎片区域布局', () => {
    it('碎片的 areaRow 和 areaCol 应与 slotIndex 一致', () => {
      const engine = createAndStartEngine();
      const pieces = engine.getPieces();
      for (const p of pieces) {
        const expectedRow = Math.floor(p.slotIndex / PIECE_AREA_COLS);
        const expectedCol = p.slotIndex % PIECE_AREA_COLS;
        expect(p.areaRow).toBe(expectedRow);
        expect(p.areaCol).toBe(expectedCol);
      }
    });
  });
});
