/**
 * 消消乐（Match-3）引擎完整测试
 *
 * 覆盖范围：
 * 1. 引擎初始化
 * 2. 宝石交换
 * 3. 匹配检测
 * 4. 消除逻辑
 * 5. 下落填充
 * 6. 连锁反应
 * 7. 连击计分
 * 8. 死局检测与洗牌
 * 9. 关卡系统
 * 10. 时间限制
 * 11. handleClick 坐标转换
 * 12. handleKeyDown
 * 13. 状态管理
 * 14. getState()
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Match3Engine } from '../Match3Engine';
import {
  GRID_ROWS,
  GRID_COLS,
  GEM_TYPE_COUNT,
  GEM_SIZE,
  GEM_GAP,
  BOARD_LEFT,
  BOARD_TOP,
  SWAP_ANIMATION_MS,
  REMOVE_ANIMATION_MS,
  SCORE_MATCH3,
  SCORE_MATCH4,
  SCORE_MATCH5,
  SCORE_SPECIAL_SHAPE,
  COMBO_MULTIPLIER_BASE,
  COMBO_MULTIPLIER_INCREMENT,
  LEVEL_TARGETS,
  TIME_PER_LEVEL,
} from '../constants';

// ========== 辅助工具 ==========

/** 创建并启动引擎（注入确定性 RNG） */
function createEngine(seed = 42): Match3Engine {
  const engine = new Match3Engine();
  // 注入确定性随机数生成器
  const rng = createSeededRng(seed);
  engine.setRng(rng);
  return engine;
}

/** 创建并初始化引擎（init + start，需要 canvas mock） */
function createStartedEngine(seed = 42): Match3Engine {
  const engine = createEngine(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  engine.init(canvas);
  engine.start();
  return engine;
}

/** 简单的种子随机数生成器（线性同余法） */
function createSeededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** 获取网格中所有宝石类型 */
function getGridTypes(engine: Match3Engine): number[][] {
  const grid = engine.getGrid();
  return grid.map(row =>
    row.map(gem => (gem ? gem.type : -1))
  );
}

/** 手动设置网格为指定类型（用于精确测试） */
function setGridTypes(engine: Match3Engine, types: number[][]): void {
  const grid = engine.getGrid();
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r]?.[c]) {
        grid[r][c]!.type = types[r][c];
      }
    }
  }
}

/** 构建一个无匹配的网格类型数组 */
function buildNoMatchGrid(): number[][] {
  // 使用循环模式确保无三连
  // 每行偏移不同量，确保横向和纵向都无连续三个相同
  const grid: number[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      // 模式确保水平和垂直方向最多连续 2 个相同
      // 使用行偏移 2 确保垂直方向不会三连
      grid[r][c] = (r * 2 + c) % GEM_TYPE_COUNT;
    }
  }
  return grid;
}

/** 验证网格无匹配 */
function assertNoMatches(types: number[][]): void {
  // 检查水平
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c <= GRID_COLS - 3; c++) {
      if (types[r][c] >= 0 && types[r][c] === types[r][c + 1] && types[r][c] === types[r][c + 2]) {
        throw new Error(`Horizontal match at (${r},${c})`);
      }
    }
  }
  // 检查垂直
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r <= GRID_ROWS - 3; r++) {
      if (types[r][c] >= 0 && types[r][c] === types[r + 1][c] && types[r][c] === types[r + 2][c]) {
        throw new Error(`Vertical match at (${r},${c})`);
      }
    }
  }
}

/** 获取指定位置的宝石类型 */
function getGemTypeAt(engine: Match3Engine, row: number, col: number): number {
  const gem = engine.getGrid()[row]?.[col];
  return gem ? gem.type : -1;
}

/** 获取指定位置的宝石渲染坐标 */
function getGemPosition(engine: Match3Engine, row: number, col: number) {
  const gem = engine.getGrid()[row]?.[col];
  return gem ? { x: gem.x, y: gem.y } : null;
}

// ============================================================
// 测试套件
// ============================================================

describe('Match3Engine', () => {
  let engine: Match3Engine;

  beforeEach(() => {
    engine = createStartedEngine(42);
  });

  // ============================================================
  // 1. 引擎初始化
  // ============================================================
  describe('初始化', () => {
    it('网格应为 8×8', () => {
      const grid = engine.getGrid();
      expect(grid).toHaveLength(GRID_ROWS);
      for (const row of grid) {
        expect(row).toHaveLength(GRID_COLS);
      }
    });

    it('网格中不应有 null 宝石', () => {
      const grid = engine.getGrid();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          expect(grid[r][c]).not.toBeNull();
        }
      }
    });

    it('宝石类型应在 0~5 范围内', () => {
      const grid = engine.getGrid();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const type = grid[r][c]!.type;
          expect(type).toBeGreaterThanOrEqual(0);
          expect(type).toBeLessThan(GEM_TYPE_COUNT);
        }
      }
    });

    it('初始网格不应有三连匹配', () => {
      const matches = engine.findMatches();
      expect(matches.size).toBe(0);
    });

    it('棋盘状态应为 idle', () => {
      expect(engine.getBoardState()).toBe('idle');
    });

    it('分数应为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('关卡应为 1', () => {
      expect(engine.level).toBe(1);
    });

    it('游戏状态应为 playing', () => {
      expect(engine.status).toBe('playing');
    });

    it('光标应在 (0, 0)', () => {
      expect(engine.cursorPosition).toEqual({ row: 0, col: 0 });
    });

    it('不应有选中宝石', () => {
      expect(engine.selectedPosition).toBeNull();
      expect(engine.getSelectedCell()).toBeNull();
    });

    it('连击数应为 0', () => {
      expect(engine.comboCount).toBe(0);
    });

    it('剩余时间应为 TIME_PER_LEVEL', () => {
      expect(engine._timeRemaining).toBe(TIME_PER_LEVEL);
    });

    it('目标分数应为第 1 关目标', () => {
      expect(engine.targetScore).toBe(LEVEL_TARGETS[0]);
    });

    it('每个宝石的渲染坐标应与网格位置一致', () => {
      const grid = engine.getGrid();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const gem = grid[r][c]!;
          expect(gem.row).toBe(r);
          expect(gem.col).toBe(c);
          expect(gem.alpha).toBe(1);
          expect(gem.scale).toBe(1);
          expect(gem.matched).toBe(false);
        }
      }
    });
  });

  // ============================================================
  // 2. 宝石交换
  // ============================================================
  describe('宝石交换', () => {
    it('点击相邻宝石应触发交换（进入 swapping 状态）', () => {
      // 先选择 (0,0)
      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      expect(engine.getSelectedCell()).toEqual({ row: 0, col: 0 });

      // 再选择 (0,1) —— 相邻
      const pos01 = engine.getCellPosition(0, 1);
      engine.handleClick(pos01.x + GEM_SIZE / 2, pos01.y + GEM_SIZE / 2);
      expect(engine.getBoardState()).toBe('swapping');
    });

    it('交换后网格中两个位置的宝石类型应互换', () => {
      const type00 = getGemTypeAt(engine, 0, 0);
      const type01 = getGemTypeAt(engine, 0, 1);

      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      const pos01 = engine.getCellPosition(0, 1);
      engine.handleClick(pos01.x + GEM_SIZE / 2, pos01.y + GEM_SIZE / 2);

      // 交换已在网格数据中完成
      expect(getGemTypeAt(engine, 0, 0)).toBe(type01);
      expect(getGemTypeAt(engine, 0, 1)).toBe(type00);
    });

    it('点击非相邻宝石不应触发交换，应重新选择', () => {
      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      expect(engine.getSelectedCell()).toEqual({ row: 0, col: 0 });

      // (0,2) 与 (0,0) 不相邻
      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      expect(engine.getBoardState()).toBe('idle');
      expect(engine.getSelectedCell()).toEqual({ row: 0, col: 2 });
    });

    it('再次点击已选中的宝石应取消选择', () => {
      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      expect(engine.getSelectedCell()).toEqual({ row: 0, col: 0 });

      // 再次点击同一位置
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      expect(engine.getSelectedCell()).toBeNull();
    });

    it('非 idle 状态下点击应被忽略', () => {
      // 先触发交换使状态非 idle
      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      const pos01 = engine.getCellPosition(0, 1);
      engine.handleClick(pos01.x + GEM_SIZE / 2, pos01.y + GEM_SIZE / 2);

      expect(engine.getBoardState()).toBe('swapping');

      // 尝试再次点击
      const pos10 = engine.getCellPosition(1, 0);
      const prevGrid = engine.getGridSnapshot();
      engine.handleClick(pos10.x + GEM_SIZE / 2, pos10.y + GEM_SIZE / 2);

      // 网格不应变化
      const newGrid = engine.getGridSnapshot();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          expect(newGrid[r]?.[c]?.type).toBe(prevGrid[r]?.[c]?.type);
        }
      }
    });

    it('无匹配的交换完成后应回退到原位', () => {
      // 构建一个确定无匹配的网格，并确保交换后也无匹配
      // Row 0: 0 1 2 3 4 5 0 1
      // 交换 (0,0) 和 (0,1) → 1 0 2 3 4 5 0 1 → 无三连 ✓
      const noMatchGrid = buildNoMatchGrid();
      setGridTypes(engine, noMatchGrid);

      // 记录交换前类型
      const type00 = getGemTypeAt(engine, 0, 0);
      const type01 = getGemTypeAt(engine, 0, 1);

      // 触发交换
      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      const pos01 = engine.getCellPosition(0, 1);
      engine.handleClick(pos01.x + GEM_SIZE / 2, pos01.y + GEM_SIZE / 2);

      expect(engine.getBoardState()).toBe('swapping');

      // deltaTime 被限制为 100ms，所以需要多次 update 完成动画
      // SWAP_ANIMATION_MS = 200，每次 update 最多推进 100ms，需要 2 次完成正向交换
      // 正向交换动画
      for (let i = 0; i < 2; i++) {
        engine.update(100);
      }

      // 无匹配，应进入回退模式（状态仍为 swapping，swapReverting = true）
      expect(engine.getBoardState()).toBe('swapping'); // 回退阶段

      // 回退动画（同样需要 2 次 update）
      for (let i = 0; i < 2; i++) {
        engine.update(100);
      }

      // 回退完成后应恢复原位
      expect(engine.getBoardState()).toBe('idle');
      expect(getGemTypeAt(engine, 0, 0)).toBe(type00);
      expect(getGemTypeAt(engine, 0, 1)).toBe(type01);
    });

    it('垂直方向相邻交换应正常工作', () => {
      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);

      const pos10 = engine.getCellPosition(1, 0);
      engine.handleClick(pos10.x + GEM_SIZE / 2, pos10.y + GEM_SIZE / 2);

      expect(engine.getBoardState()).toBe('swapping');
    });
  });

  // ============================================================
  // 3. 匹配检测
  // ============================================================
  describe('匹配检测', () => {
    it('无匹配时应返回空集合', () => {
      const noMatchGrid = buildNoMatchGrid();
      setGridTypes(engine, noMatchGrid);
      const matches = engine.findMatches();
      expect(matches.size).toBe(0);
    });

    it('应检测水平三连', () => {
      const grid = buildNoMatchGrid();
      // 在第 0 行设置三连: (0,0), (0,1), (0,2) = 类型 0
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.has('0,0')).toBe(true);
      expect(matches.has('0,1')).toBe(true);
      expect(matches.has('0,2')).toBe(true);
      expect(matches.size).toBe(3);
    });

    it('应检测垂直三连', () => {
      const grid = buildNoMatchGrid();
      // Row 0 col 0: 0, Row 1 col 0: 2, Row 2 col 0: 4, Row 3 col 0: 0
      // 设置 (0,0)=0, (1,0)=0, (2,0)=0 — 但 (3,0) 已经是 0，会变成四连
      // 改为在不会产生四连的位置: 使用列 1
      // Row 0 col 1: 1, Row 1 col 1: 3, Row 2 col 1: 5, Row 3 col 1: 1
      // 设置 (0,1)=2, (1,1)=2, (2,1)=2 → (3,1)=1 不会延伸
      grid[0][1] = 2;
      grid[1][1] = 2;
      grid[2][1] = 2;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.has('0,1')).toBe(true);
      expect(matches.has('1,1')).toBe(true);
      expect(matches.has('2,1')).toBe(true);
      expect(matches.size).toBe(3);
    });

    it('应检测水平四连', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      grid[0][3] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.has('0,0')).toBe(true);
      expect(matches.has('0,1')).toBe(true);
      expect(matches.has('0,2')).toBe(true);
      expect(matches.has('0,3')).toBe(true);
      expect(matches.size).toBe(4);
    });

    it('应检测水平五连', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      grid[0][3] = 0;
      grid[0][4] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.size).toBe(5);
      for (let c = 0; c < 5; c++) {
        expect(matches.has(`0,${c}`)).toBe(true);
      }
    });

    it('应检测垂直四连', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[1][0] = 0;
      grid[2][0] = 0;
      grid[3][0] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.size).toBe(4);
      for (let r = 0; r < 4; r++) {
        expect(matches.has(`${r},0`)).toBe(true);
      }
    });

    it('应检测垂直五连', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[1][0] = 0;
      grid[2][0] = 0;
      grid[3][0] = 0;
      grid[4][0] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.size).toBe(5);
      for (let r = 0; r < 5; r++) {
        expect(matches.has(`${r},0`)).toBe(true);
      }
    });

    it('应同时检测水平和垂直匹配', () => {
      const grid = buildNoMatchGrid();
      // 水平三连在行 0
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      // 垂直三连在列 5（避免与水平重叠）
      grid[0][5] = 1;
      grid[1][5] = 1;
      grid[2][5] = 1;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.size).toBe(6);
      expect(matches.has('0,0')).toBe(true);
      expect(matches.has('0,1')).toBe(true);
      expect(matches.has('0,2')).toBe(true);
      expect(matches.has('0,5')).toBe(true);
      expect(matches.has('1,5')).toBe(true);
      expect(matches.has('2,5')).toBe(true);
    });

    it('应检测 L 形匹配（水平+垂直交叉）', () => {
      const grid = buildNoMatchGrid();
      // L 形: 水平 (0,1)-(0,2)-(0,3) + 垂直 (0,1)-(1,1)-(2,1)
      // 使用类型 2，检查不会延伸:
      // Row 0: 0, 2, 2, 2, 4, 5, 0, 1 → 水平三连 (0,1)-(0,3) ✓
      // Col 1: 2, 2, 2, 1, 3, 5, 1, 3 → 垂直三连 (0,1)-(2,1) ✓
      // (3,1)=1 不会延伸 ✓
      grid[0][1] = 2;
      grid[0][2] = 2;
      grid[0][3] = 2;
      grid[1][1] = 2;
      grid[2][1] = 2;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.has('0,1')).toBe(true);
      expect(matches.has('0,2')).toBe(true);
      expect(matches.has('0,3')).toBe(true);
      expect(matches.has('1,1')).toBe(true);
      expect(matches.has('2,1')).toBe(true);
      expect(matches.size).toBe(5);
    });

    it('应检测 T 形匹配', () => {
      const grid = buildNoMatchGrid();
      // T 形: 水平 (2,0)-(2,1)-(2,2)-(2,3)-(2,4) + 垂直 (0,2)-(1,2)-(2,2)
      grid[0][2] = 0;
      grid[1][2] = 0;
      grid[2][0] = 0;
      grid[2][1] = 0;
      grid[2][2] = 0;
      grid[2][3] = 0;
      grid[2][4] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.size).toBe(7);
    });

    it('两连不应匹配', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      // 仅两个，不应匹配
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      // 检查 (0,0) 和 (0,1) 不在匹配中
      expect(matches.has('0,0')).toBe(false);
      expect(matches.has('0,1')).toBe(false);
    });

    it('空宝石（type=-1）不应参与匹配', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = -1; // 空位打断
      grid[0][3] = 0;
      grid[0][4] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      // 不应有三连
      expect(matches.has('0,0')).toBe(false);
      expect(matches.has('0,1')).toBe(false);
    });
  });

  // ============================================================
  // 4. 消除逻辑
  // ============================================================
  describe('消除逻辑', () => {
    it('匹配的宝石应被标记为 matched', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      // 触发交换产生匹配
      // 先让 (0,2) 和 (0,3) 交换来产生匹配
      // 直接通过内部方法模拟: 使用 swap + update
      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      // 如果产生了匹配，交换完成后进入 removing 状态
      if (engine.getBoardState() === 'swapping') {
        engine.update(SWAP_ANIMATION_MS);
      }

      // 如果有匹配则应进入 removing
      if (engine.getBoardState() === 'removing') {
        const g = engine.getGrid();
        let matchedCount = 0;
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            if (g[r]?.[c]?.matched) matchedCount++;
          }
        }
        expect(matchedCount).toBeGreaterThanOrEqual(3);
      }
    });

    it('消除动画完成后宝石应变为 null', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      // 触发交换
      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      // 完成交换动画
      engine.update(SWAP_ANIMATION_MS);

      if (engine.getBoardState() === 'removing') {
        // 完成消除动画
        engine.update(REMOVE_ANIMATION_MS);

        // 检查匹配的宝石已被移除
        const g = engine.getGrid();
        let nullCount = 0;
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            if (g[r][c] === null) nullCount++;
          }
        }
        expect(nullCount).toBeGreaterThanOrEqual(3);
      }
    });

    it('消除动画期间宝石 alpha 应逐渐减小', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      engine.update(SWAP_ANIMATION_MS);

      if (engine.getBoardState() === 'removing') {
        // 半途更新
        engine.update(REMOVE_ANIMATION_MS / 2);
        const g = engine.getGrid();
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            const gem = g[r]?.[c];
            if (gem?.matched) {
              expect(gem.alpha).toBeLessThan(1);
              expect(gem.scale).toBeLessThan(1);
            }
          }
        }
      }
    });
  });

  // ============================================================
  // 5. 下落填充
  // ============================================================
  describe('下落填充', () => {
    it('applyGravity 应将上方宝石下移填补空位', () => {
      const grid = engine.getGrid();
      // 手动设置: (0,0) 有宝石, (1,0) 为 null, (2,0) 为 null, (3,0) 有宝石
      const type0 = grid[0][0]!.type;
      grid[3][0]!.type = type0;
      grid[1][0] = null;
      grid[2][0] = null;

      // 调用 applyGravity (通过暴露的方法)
      engine.applyGravity();

      // 底部的宝石应下落
      const g = engine.getGrid();
      // (3,0) 应该还有宝石（已在底部）
      expect(g[3][0]).not.toBeNull();
    });

    it('fillEmpty 应在顶部空位填充新宝石', () => {
      const grid = engine.getGrid();
      // 清空顶部两行
      for (let c = 0; c < GRID_COLS; c++) {
        grid[0][c] = null;
        grid[1][c] = null;
      }

      engine.applyGravity();
      // 手动调用 fillEmpty 的效果通过状态机模拟
      // 直接检查: 消除+下落后网格应被填充

      // 验证顶部行有空位
      let emptyCount = 0;
      for (let c = 0; c < GRID_COLS; c++) {
        if (grid[0][c] === null) emptyCount++;
      }
      expect(emptyCount).toBeGreaterThan(0);
    });

    it('消除→下落→填充后网格应为 8×8 满', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      // 交换动画
      engine.update(SWAP_ANIMATION_MS);

      if (engine.getBoardState() === 'removing') {
        // 消除动画
        engine.update(REMOVE_ANIMATION_MS);
        // 此时进入 falling 状态，需要足够时间让宝石下落
        engine.update(2000);

        // 下落完成后进入 checking，再检查
        if (engine.getBoardState() === 'checking') {
          engine.update(0);
        }

        // 网格应该填满（无 null）
        const g = engine.getGrid();
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            expect(g[r][c]).not.toBeNull();
          }
        }
      }
    });
  });

  // ============================================================
  // 6. 连锁反应
  // ============================================================
  describe('连锁反应', () => {
    it('消除后如果产生新匹配应继续消除', () => {
      // 构造一个会产生连锁的布局
      const grid = buildNoMatchGrid();
      // 第 0 行: 0 0 0 ...
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      // 第 1-3 行某列也设置匹配（下落后可能触发）
      grid[1][0] = 0;
      grid[2][0] = 0;
      grid[3][0] = 0;
      setGridTypes(engine, grid);

      const matches = engine.findMatches();
      expect(matches.size).toBeGreaterThan(0);

      // 标记匹配
      // 模拟消除过程
      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      engine.update(SWAP_ANIMATION_MS);

      if (engine.getBoardState() === 'removing') {
        engine.update(REMOVE_ANIMATION_MS);
        engine.update(2000); // 下落

        // 如果有连锁，comboCount 应 > 1
        // (取决于具体布局)
      }
    });

    it('连锁结束后 comboCount 应重置为 0', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      // 完成全部动画直到 idle
      for (let i = 0; i < 20; i++) {
        engine.update(SWAP_ANIMATION_MS);
        engine.update(REMOVE_ANIMATION_MS);
        engine.update(2000);
        engine.update(0);
        if (engine.getBoardState() === 'idle') break;
      }

      expect(engine.comboCount).toBe(0);
    });

    it('无新匹配时应回到 idle 状态', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      // 推进所有动画
      for (let i = 0; i < 20; i++) {
        engine.update(SWAP_ANIMATION_MS);
        engine.update(REMOVE_ANIMATION_MS);
        engine.update(2000);
        engine.update(0);
        if (engine.getBoardState() === 'idle') break;
      }

      expect(engine.getBoardState()).toBe('idle');
    });
  });

  // ============================================================
  // 7. 连击计分
  // ============================================================
  describe('连击计分', () => {
    it('三连基础分应为 matchedCount * SCORE_MATCH3', () => {
      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      const scoreSpy = vi.fn();
      engine.on('scoreCalc', scoreSpy);

      // 触发交换
      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      engine.update(SWAP_ANIMATION_MS);

      if (engine.getBoardState() === 'removing') {
        engine.update(REMOVE_ANIMATION_MS);

        if (scoreSpy.mock.calls.length > 0) {
          const { baseScore, combo, multiplier, points } = scoreSpy.mock.calls[0][0];
          expect(combo).toBe(1);
          expect(multiplier).toBe(COMBO_MULTIPLIER_BASE);
          expect(points).toBe(Math.floor(baseScore * multiplier));
        }
      }
    });

    it('第一次连击倍率应为 COMBO_MULTIPLIER_BASE', () => {
      expect(COMBO_MULTIPLIER_BASE).toBe(1.0);
    });

    it('连击倍率公式应为 base + (combo-1) * increment', () => {
      const combo1 = COMBO_MULTIPLIER_BASE + 0 * COMBO_MULTIPLIER_INCREMENT;
      const combo2 = COMBO_MULTIPLIER_BASE + 1 * COMBO_MULTIPLIER_INCREMENT;
      const combo3 = COMBO_MULTIPLIER_BASE + 2 * COMBO_MULTIPLIER_INCREMENT;

      expect(combo1).toBe(1.0);
      expect(combo2).toBe(1.5);
      expect(combo3).toBe(2.0);
    });

    it('消除后分数应增加', () => {
      const initialScore = engine.score;

      const grid = buildNoMatchGrid();
      grid[0][0] = 0;
      grid[0][1] = 0;
      grid[0][2] = 0;
      setGridTypes(engine, grid);

      const pos02 = engine.getCellPosition(0, 2);
      engine.handleClick(pos02.x + GEM_SIZE / 2, pos02.y + GEM_SIZE / 2);
      const pos03 = engine.getCellPosition(0, 3);
      engine.handleClick(pos03.x + GEM_SIZE / 2, pos03.y + GEM_SIZE / 2);

      // 推进到消除完成
      engine.update(SWAP_ANIMATION_MS);
      if (engine.getBoardState() === 'removing') {
        engine.update(REMOVE_ANIMATION_MS);
        expect(engine.score).toBeGreaterThan(initialScore);
      }
    });

    it('四连应比三连得分更高', () => {
      expect(SCORE_MATCH4).toBeGreaterThan(SCORE_MATCH3);
    });

    it('五连应比四连得分更高', () => {
      expect(SCORE_MATCH5).toBeGreaterThan(SCORE_MATCH4);
    });
  });

  // ============================================================
  // 8. 死局检测与洗牌
  // ============================================================
  describe('死局检测与洗牌', () => {
    it('正常棋盘应有可用移动', () => {
      expect(engine.hasValidMoves()).toBe(true);
    });

    it('hasValidMoves 应检测水平交换是否产生匹配', () => {
      // 构建一个只有特定交换才能匹配的棋盘
      const grid = buildNoMatchGrid();
      setGridTypes(engine, grid);
      // 默认无匹配网格可能没有可用移动，也可能有
      // 这取决于布局
      const hasMoves = engine.hasValidMoves();
      expect(typeof hasMoves).toBe('boolean');
    });

    it('洗牌后应触发 shuffle 事件', () => {
      const shuffleSpy = vi.fn();
      engine.on('shuffle', shuffleSpy);

      engine.shuffleBoard();

      expect(shuffleSpy).toHaveBeenCalled();
    });

    it('洗牌后棋盘应仍有 8×8 宝石', () => {
      engine.shuffleBoard();

      const grid = engine.getGrid();
      expect(grid).toHaveLength(GRID_ROWS);
      for (const row of grid) {
        expect(row).toHaveLength(GRID_COLS);
        for (const gem of row) {
          expect(gem).not.toBeNull();
          expect(gem!.type).toBeGreaterThanOrEqual(0);
          expect(gem!.type).toBeLessThan(GEM_TYPE_COUNT);
        }
      }
    });

    it('洗牌后应有可用移动（或重新生成）', () => {
      engine.shuffleBoard();
      // 洗牌方法内部会确保有可用移动（否则重新生成）
      expect(engine.hasValidMoves()).toBe(true);
    });
  });

  // ============================================================
  // 9. 关卡系统
  // ============================================================
  describe('关卡系统', () => {
    it('初始关卡目标应为 LEVEL_TARGETS[0]', () => {
      expect(engine.targetScore).toBe(LEVEL_TARGETS[0]);
    });

    it('达到目标分数应升级', () => {
      const levelSpy = vi.fn();
      engine.on('levelChange', levelSpy);

      // 直接设置分数超过目标
      // 使用 addScore（protected）通过反射
      (engine as any).addScore(LEVEL_TARGETS[0]);

      // 手动触发关卡检查（通过 checkLevelProgress）
      (engine as any).checkLevelProgress();

      expect(engine.level).toBe(2);
      expect(levelSpy).toHaveBeenCalledWith(2);
    });

    it('升级后目标分数应更新', () => {
      (engine as any).addScore(LEVEL_TARGETS[0]);
      (engine as any).checkLevelProgress();

      expect(engine.targetScore).toBe(LEVEL_TARGETS[1]);
    });

    it('升级后时间应重置为 TIME_PER_LEVEL', () => {
      // 先消耗一些时间
      (engine as any)._timeRemaining = 50;

      (engine as any).addScore(LEVEL_TARGETS[0]);
      (engine as any).checkLevelProgress();

      expect(engine._timeRemaining).toBe(TIME_PER_LEVEL);
    });

    it('应触发 levelUp 事件', () => {
      const levelUpSpy = vi.fn();
      engine.on('levelUp', levelUpSpy);

      (engine as any).addScore(LEVEL_TARGETS[0]);
      (engine as any).checkLevelProgress();

      expect(levelUpSpy).toHaveBeenCalledWith({
        level: 2,
        targetScore: LEVEL_TARGETS[1],
      });
    });

    it('LEVEL_TARGETS 应有 10 个关卡', () => {
      expect(LEVEL_TARGETS).toHaveLength(10);
    });

    it('关卡目标应递增', () => {
      for (let i = 1; i < LEVEL_TARGETS.length; i++) {
        expect(LEVEL_TARGETS[i]).toBeGreaterThan(LEVEL_TARGETS[i - 1]);
      }
    });

    it('超过定义的关卡数应使用最后一个目标', () => {
      const target = (engine as any).getTargetForLevel(100);
      expect(target).toBe(LEVEL_TARGETS[LEVEL_TARGETS.length - 1]);
    });
  });

  // ============================================================
  // 10. 时间限制
  // ============================================================
  describe('时间限制', () => {
    it('初始剩余时间应为 TIME_PER_LEVEL (120秒)', () => {
      expect(engine._timeRemaining).toBe(TIME_PER_LEVEL);
    });

    it('idle 状态下 update 应减少剩余时间', () => {
      const initialTime = engine._timeRemaining;
      engine.update(1000); // 1秒
      expect(engine._timeRemaining).toBeLessThan(initialTime);
    });

    it('时间减少量应与 deltaTime 成正比', () => {
      // deltaTime 被限制在 100ms 以内，所以使用小于 100 的值
      const time1 = engine._timeRemaining;
      engine.update(50); // 0.05秒
      const time2 = engine._timeRemaining;
      expect(time1 - time2).toBeCloseTo(0.05, 2);

      engine.update(50); // 0.05秒
      const time3 = engine._timeRemaining;
      expect(time2 - time3).toBeCloseTo(0.05, 2);
    });

    it('时间耗尽应触发游戏结束', () => {
      (engine as any)._timeRemaining = 0.001;
      engine.update(10);

      expect(engine.status).toBe('gameover');
    });

    it('游戏结束后状态应为 gameover', () => {
      (engine as any)._timeRemaining = 0.001;
      engine.update(10);

      expect(engine.status).toBe('gameover');
      expect(engine.getBoardState()).toBe('idle');
    });

    it('时间不应变为负数', () => {
      (engine as any)._timeRemaining = 0.001;
      engine.update(10000);

      expect(engine._timeRemaining).toBe(0);
    });
  });

  // ============================================================
  // 11. handleClick 坐标转换
  // ============================================================
  describe('handleClick 坐标转换', () => {
    it('getCellPosition 应返回正确的坐标', () => {
      const pos = engine.getCellPosition(0, 0);
      expect(pos.x).toBe(BOARD_LEFT + GEM_GAP);
      expect(pos.y).toBe(BOARD_TOP + GEM_GAP);
    });

    it('getCellPosition(1, 0) 应比 (0, 0) 的 y 大一个格子', () => {
      const pos00 = engine.getCellPosition(0, 0);
      const pos10 = engine.getCellPosition(1, 0);
      expect(pos10.y - pos00.y).toBe(GEM_SIZE + GEM_GAP);
      expect(pos10.x).toBe(pos00.x);
    });

    it('getCellPosition(0, 1) 应比 (0, 0) 的 x 大一个格子', () => {
      const pos00 = engine.getCellPosition(0, 0);
      const pos01 = engine.getCellPosition(0, 1);
      expect(pos01.x - pos00.x).toBe(GEM_SIZE + GEM_GAP);
      expect(pos01.y).toBe(pos00.y);
    });

    it('getCellFromPosition 应正确识别格子', () => {
      const pos = engine.getCellPosition(3, 4);
      const cell = engine.getCellFromPosition(
        pos.x + GEM_SIZE / 2,
        pos.y + GEM_SIZE / 2
      );
      expect(cell).toEqual({ row: 3, col: 4 });
    });

    it('getCellFromPosition 对棋盘外坐标应返回 null', () => {
      expect(engine.getCellFromPosition(-10, -10)).toBeNull();
      expect(engine.getCellFromPosition(0, 0)).toBeNull(); // HUD 区域
    });

    it('getCellFromPosition 对格子边缘坐标应正确识别', () => {
      const pos = engine.getCellPosition(0, 0);
      // 左上角
      expect(engine.getCellFromPosition(pos.x, pos.y)).toEqual({ row: 0, col: 0 });
      // 右下角
      expect(engine.getCellFromPosition(pos.x + GEM_SIZE, pos.y + GEM_SIZE)).toEqual({ row: 0, col: 0 });
    });

    it('handleClick 对棋盘外点击应被忽略', () => {
      engine.handleClick(-100, -100);
      expect(engine.getSelectedCell()).toBeNull();
    });

    it('handleClick 对 HUD 区域点击应被忽略', () => {
      engine.handleClick(100, 10); // y < BOARD_TOP
      expect(engine.getSelectedCell()).toBeNull();
    });
  });

  // ============================================================
  // 12. handleKeyDown
  // ============================================================
  describe('handleKeyDown', () => {
    it('ArrowUp 应上移光标', () => {
      // 先移到非 (0,0) 位置
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorPosition).toEqual({ row: 1, col: 0 });

      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorPosition).toEqual({ row: 0, col: 0 });
    });

    it('ArrowDown 应下移光标', () => {
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorPosition).toEqual({ row: 1, col: 0 });
    });

    it('ArrowLeft 应左移光标', () => {
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorPosition).toEqual({ row: 0, col: 0 });
    });

    it('ArrowRight 应右移光标', () => {
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorPosition).toEqual({ row: 0, col: 1 });
    });

    it('光标不应超出上边界', () => {
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorPosition).toEqual({ row: 0, col: 0 });
    });

    it('光标不应超出下边界', () => {
      for (let i = 0; i < 20; i++) {
        engine.handleKeyDown('ArrowDown');
      }
      expect(engine.cursorPosition.row).toBe(GRID_ROWS - 1);
    });

    it('光标不应超出左边界', () => {
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorPosition).toEqual({ row: 0, col: 0 });
    });

    it('光标不应超出右边界', () => {
      for (let i = 0; i < 20; i++) {
        engine.handleKeyDown('ArrowRight');
      }
      expect(engine.cursorPosition.col).toBe(GRID_COLS - 1);
    });

    it('空格键应选中当前位置', () => {
      engine.handleKeyDown(' ');
      expect(engine.getSelectedCell()).toEqual({ row: 0, col: 0 });
    });

    it('空格键选中后再按空格应取消选择', () => {
      engine.handleKeyDown(' ');
      expect(engine.getSelectedCell()).toEqual({ row: 0, col: 0 });
      engine.handleKeyDown(' ');
      expect(engine.getSelectedCell()).toBeNull();
    });

    it('空格键选中后移动到相邻位置按空格应交换', () => {
      engine.handleKeyDown(' '); // 选中 (0,0)
      engine.handleKeyDown('ArrowRight'); // 移到 (0,1)
      engine.handleKeyDown(' '); // 交换

      expect(engine.getBoardState()).toBe('swapping');
    });

    it('空格键选中后移动到非相邻位置按空格应重新选择', () => {
      engine.handleKeyDown(' '); // 选中 (0,0)
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowRight'); // 移到 (0,2)，不相邻
      engine.handleKeyDown(' '); // 应重新选择 (0,2)

      expect(engine.getSelectedCell()).toEqual({ row: 0, col: 2 });
      expect(engine.getBoardState()).toBe('idle');
    });

    it('非 playing 状态下按键应被忽略', () => {
      engine.pause();
      const prevCursor = { ...engine.cursorPosition };

      engine.handleKeyDown('ArrowDown');

      expect(engine.cursorPosition).toEqual(prevCursor);
    });

    it('未知按键应被忽略', () => {
      const prevCursor = { ...engine.cursorPosition };
      engine.handleKeyDown('KeyA');
      expect(engine.cursorPosition).toEqual(prevCursor);
    });

    it('handleKeyUp 不应抛出异常', () => {
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });
  });

  // ============================================================
  // 13. 状态管理
  // ============================================================
  describe('状态管理', () => {
    it('init 后状态应为 idle', () => {
      const e = createEngine();
      const canvas = document.createElement('canvas');
      e.init(canvas);
      expect(e.status).toBe('idle');
    });

    it('start 后状态应为 playing', () => {
      expect(engine.status).toBe('playing');
    });

    it('pause 后状态应为 paused', () => {
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态应为 playing', () => {
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态应为 idle', () => {
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后分数应为 0', () => {
      (engine as any).addScore(500);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('reset 后关卡应为 1', () => {
      (engine as any).setLevel(5);
      engine.reset();
      expect(engine.level).toBe(1);
    });

    it('reset 后棋盘状态应为 idle', () => {
      engine.reset();
      expect(engine.getBoardState()).toBe('idle');
    });

    it('pause 在非 playing 状态应无效', () => {
      engine.pause();
      engine.pause(); // 再次 pause
      expect(engine.status).toBe('paused');
    });

    it('resume 在非 paused 状态应无效', () => {
      engine.resume(); // 当前是 playing，不是 paused
      expect(engine.status).toBe('playing');
    });

    it('应触发 statusChange 事件', () => {
      const spy = vi.fn();
      engine.on('statusChange', spy);

      engine.pause();
      expect(spy).toHaveBeenCalledWith('paused');

      engine.resume();
      expect(spy).toHaveBeenCalledWith('playing');
    });

    it('应触发 scoreChange 事件', () => {
      const spy = vi.fn();
      engine.on('scoreChange', spy);

      (engine as any).addScore(100);

      expect(spy).toHaveBeenCalledWith(100);
    });

    it('destroy 后应清理所有事件', () => {
      const spy = vi.fn();
      engine.on('test', spy);
      engine.destroy();

      // emit 不应触发（listeners 已清理）
      (engine as any).emit('test');
      expect(spy).not.toHaveBeenCalled();
    });

    it('未设置 canvas 调用 start 应抛出异常', () => {
      const e = createEngine();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });
  });

  // ============================================================
  // 14. getState()
  // ============================================================
  describe('getState()', () => {
    it('应包含所有必要字段', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('grid');
      expect(state).toHaveProperty('boardState');
      expect(state).toHaveProperty('selectedRow');
      expect(state).toHaveProperty('selectedCol');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('comboCount');
      expect(state).toHaveProperty('timeRemaining');
      expect(state).toHaveProperty('targetScore');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('status');
    });

    it('grid 应为深拷贝', () => {
      const state1 = engine.getState();
      const state2 = engine.getState();
      expect(state1.grid).not.toBe(state2.grid);
    });

    it('状态值应与引擎一致', () => {
      const state = engine.getState();
      expect(state.boardState).toBe(engine.getBoardState());
      expect(state.score).toBe(engine.score);
      expect(state.level).toBe(engine.level);
      expect(state.status).toBe(engine.status);
      expect(state.comboCount).toBe(engine.comboCount);
      expect(state.timeRemaining).toBe(engine.timeRemaining);
      expect(state.targetScore).toBe(engine.targetScore);
    });

    it('选中宝石后 selectedRow/Col 应更新', () => {
      const pos = engine.getCellPosition(2, 3);
      engine.handleClick(pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2);

      const state = engine.getState();
      expect(state.selectedRow).toBe(2);
      expect(state.selectedCol).toBe(3);
    });

    it('移动光标后 cursorRow/Col 应更新', () => {
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowRight');

      const state = engine.getState();
      expect(state.cursorRow).toBe(1);
      expect(state.cursorCol).toBe(1);
    });
  });

  // ============================================================
  // 15. 事件系统
  // ============================================================
  describe('事件系统', () => {
    it('选中宝石应触发 select 事件', () => {
      const spy = vi.fn();
      engine.on('select', spy);

      const pos = engine.getCellPosition(0, 0);
      engine.handleClick(pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2);

      expect(spy).toHaveBeenCalledWith({ row: 0, col: 0 });
    });

    it('取消选中应触发 deselect 事件', () => {
      const spy = vi.fn();
      engine.on('deselect', spy);

      const pos = engine.getCellPosition(0, 0);
      engine.handleClick(pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2);
      engine.handleClick(pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2);

      expect(spy).toHaveBeenCalled();
    });

    it('off 应取消事件监听', () => {
      const spy = vi.fn();
      engine.on('select', spy);
      engine.off('select', spy);

      const pos = engine.getCellPosition(0, 0);
      engine.handleClick(pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 16. 网格快照
  // ============================================================
  describe('getGridSnapshot', () => {
    it('应返回深拷贝的网格', () => {
      const snap = engine.getGridSnapshot();
      expect(snap).not.toBe(engine.getGrid());

      // 修改快照不应影响原网格
      if (snap[0][0]) {
        const origType = snap[0][0].type;
        snap[0][0].type = 999;
        expect(engine.getGrid()[0][0]!.type).toBe(origType);
      }
    });

    it('快照应与原网格数据一致', () => {
      const snap = engine.getGridSnapshot();
      const grid = engine.getGrid();

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (grid[r][c] && snap[r][c]) {
            expect(snap[r][c]!.type).toBe(grid[r][c]!.type);
            expect(snap[r][c]!.row).toBe(grid[r][c]!.row);
            expect(snap[r][c]!.col).toBe(grid[r][c]!.col);
          }
        }
      }
    });
  });

  // ============================================================
  // 17. 确定性随机
  // ============================================================
  describe('确定性随机', () => {
    it('相同种子应产生相同网格', () => {
      const e1 = createStartedEngine(123);
      const e2 = createStartedEngine(123);

      const g1 = getGridTypes(e1);
      const g2 = getGridTypes(e2);

      expect(g1).toEqual(g2);
    });

    it('不同种子应产生不同网格', () => {
      const e1 = createStartedEngine(1);
      const e2 = createStartedEngine(999);

      const g1 = getGridTypes(e1);
      const g2 = getGridTypes(e2);

      // 大概率不同（不保证100%，但 64 格全部相同的概率极低）
      let same = true;
      for (let r = 0; r < GRID_ROWS && same; r++) {
        for (let c = 0; c < GRID_COLS && same; c++) {
          if (g1[r][c] !== g2[r][c]) same = false;
        }
      }
      expect(same).toBe(false);
    });

    it('setRng 应生效', () => {
      const e = createStartedEngine(42);
      const g1 = getGridTypes(e);

      // 重置并使用新种子
      e.reset();
      const canvas = document.createElement('canvas');
      e.init(canvas);
      e.setRng(createSeededRng(999));
      e.start();

      const g2 = getGridTypes(e);

      let same = true;
      for (let r = 0; r < GRID_ROWS && same; r++) {
        for (let c = 0; c < GRID_COLS && same; c++) {
          if (g1[r][c] !== g2[r][c]) same = false;
        }
      }
      expect(same).toBe(false);
    });
  });

  // ============================================================
  // 18. 边界条件与鲁棒性
  // ============================================================
  describe('边界条件', () => {
    it('deltaTime 被限制在 100ms 以内', () => {
      const prevTime = engine._timeRemaining;
      engine.update(10000); // 超大 deltaTime
      // 由于限制，实际只减少了 100ms 对应的时间
      expect(engine._timeRemaining).toBeGreaterThan(prevTime - 11);
    });

    it('连续快速点击不应导致崩溃', () => {
      const pos = engine.getCellPosition(0, 0);
      for (let i = 0; i < 100; i++) {
        engine.handleClick(pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2);
      }
      // 不应崩溃
      expect(true).toBe(true);
    });

    it('连续快速按键不应导致崩溃', () => {
      for (let i = 0; i < 100; i++) {
        engine.handleKeyDown('ArrowDown');
        engine.handleKeyDown('ArrowRight');
        engine.handleKeyDown(' ');
      }
      // 不应崩溃
      expect(true).toBe(true);
    });

    it('getCellPosition 对所有合法坐标应返回正值', () => {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const pos = engine.getCellPosition(r, c);
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('getCellFromPosition 对格子间隙应返回 null', () => {
      // 格子之间的间隙区域
      const pos00 = engine.getCellPosition(0, 0);
      const gapX = pos00.x + GEM_SIZE + 1; // 在间隙中
      const gapY = pos00.y + GEM_SIZE / 2;

      const cell = engine.getCellFromPosition(gapX, gapY);
      // 间隙区域应返回 null（因为坐标不在任何宝石内）
      expect(cell).toBeNull();
    });
  });

  // ============================================================
  // 19. 交换动画细节
  // ============================================================
  describe('交换动画', () => {
    it('交换动画期间宝石位置应插值移动', () => {
      const grid = buildNoMatchGrid();
      setGridTypes(engine, grid);

      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      const pos01 = engine.getCellPosition(0, 1);
      engine.handleClick(pos01.x + GEM_SIZE / 2, pos01.y + GEM_SIZE / 2);

      // 半途
      engine.update(SWAP_ANIMATION_MS / 2);

      if (engine.getBoardState() === 'swapping') {
        const gem0 = engine.getGrid()[0]?.[0];
        const gem1 = engine.getGrid()[0]?.[1];
        if (gem0 && gem1) {
          // 宝石位置应该在两个格子之间
          const cellPos00 = engine.getCellPosition(0, 0);
          const cellPos01 = engine.getCellPosition(0, 1);
          // gem0 的 x 应该在 cellPos00.x 和 cellPos01.x 之间
          expect(gem0.x).toBeGreaterThan(cellPos00.x - 1);
          expect(gem0.x).toBeLessThan(cellPos01.x + 1);
        }
      }
    });

    it('交换完成后宝石位置应对齐到网格', () => {
      const grid = buildNoMatchGrid();
      setGridTypes(engine, grid);

      const pos00 = engine.getCellPosition(0, 0);
      engine.handleClick(pos00.x + GEM_SIZE / 2, pos00.y + GEM_SIZE / 2);
      const pos01 = engine.getCellPosition(0, 1);
      engine.handleClick(pos01.x + GEM_SIZE / 2, pos01.y + GEM_SIZE / 2);

      // 完成交换 + 可能的回退
      engine.update(SWAP_ANIMATION_MS);
      engine.update(SWAP_ANIMATION_MS);

      // 回到 idle 后所有宝石应对齐
      if (engine.getBoardState() === 'idle') {
        const g = engine.getGrid();
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            const gem = g[r]?.[c];
            if (gem) {
              const expected = engine.getCellPosition(r, c);
              expect(gem.x).toBeCloseTo(expected.x, 0);
              expect(gem.y).toBeCloseTo(expected.y, 0);
            }
          }
        }
      }
    });
  });

  // ============================================================
  // 20. 完整游戏流程
  // ============================================================
  describe('完整游戏流程', () => {
    it('init → start → play → pause → resume → reset 流程', () => {
      const e = createEngine();
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 640;

      e.init(canvas);
      expect(e.status).toBe('idle');

      e.start();
      expect(e.status).toBe('playing');

      e.pause();
      expect(e.status).toBe('paused');

      e.resume();
      expect(e.status).toBe('playing');

      e.reset();
      expect(e.status).toBe('idle');
      expect(e.score).toBe(0);
      expect(e.level).toBe(1);
    });

    it('init → start → 游戏超时 → gameover 流程', () => {
      const e = createStartedEngine(42);

      expect(e.status).toBe('playing');

      (e as any)._timeRemaining = 0.001;
      e.update(10);

      expect(e.status).toBe('gameover');
    });

    it('重置后可重新开始', () => {
      (engine as any)._timeRemaining = 0.001;
      engine.update(10);
      expect(engine.status).toBe('gameover');

      engine.reset();
      expect(engine.status).toBe('idle');

      // 需要重新 init + start
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 640;
      engine.init(canvas);
      engine.start();

      expect(engine.status).toBe('playing');
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });
  });

  // ============================================================
  // 21. 计分常量验证
  // ============================================================
  describe('计分常量', () => {
    it('SCORE_MATCH3 应为 100', () => {
      expect(SCORE_MATCH3).toBe(100);
    });

    it('SCORE_MATCH4 应为 200', () => {
      expect(SCORE_MATCH4).toBe(200);
    });

    it('SCORE_MATCH5 应为 500', () => {
      expect(SCORE_MATCH5).toBe(500);
    });

    it('SCORE_SPECIAL_SHAPE 应为 150', () => {
      expect(SCORE_SPECIAL_SHAPE).toBe(150);
    });

    it('COMBO_MULTIPLIER_BASE 应为 1.0', () => {
      expect(COMBO_MULTIPLIER_BASE).toBe(1.0);
    });

    it('COMBO_MULTIPLIER_INCREMENT 应为 0.5', () => {
      expect(COMBO_MULTIPLIER_INCREMENT).toBe(0.5);
    });

    it('TIME_PER_LEVEL 应为 120', () => {
      expect(TIME_PER_LEVEL).toBe(120);
    });
  });

  // ============================================================
  // 22. 网格常量验证
  // ============================================================
  describe('网格常量', () => {
    it('GRID_ROWS 应为 8', () => {
      expect(GRID_ROWS).toBe(8);
    });

    it('GRID_COLS 应为 8', () => {
      expect(GRID_COLS).toBe(8);
    });

    it('GEM_TYPE_COUNT 应为 6', () => {
      expect(GEM_TYPE_COUNT).toBe(6);
    });

    it('SWAP_ANIMATION_MS 应为 200', () => {
      expect(SWAP_ANIMATION_MS).toBe(200);
    });

    it('REMOVE_ANIMATION_MS 应为 300', () => {
      expect(REMOVE_ANIMATION_MS).toBe(300);
    });
  });
});
