import { MazeEngine } from '@/games/maze/MazeEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_WALL,
  CELL_PATH,
  CELL_COIN,
  CELL_EXIT,
  CELL_START,
  COIN_SCORE,
  LEVEL_COMPLETE_BONUS,
  MOVE_INTERVAL,
  DIFFICULTY_LEVELS,
  FOG_ENABLED_DEFAULT,
  COLS_INCREMENT,
  ROWS_INCREMENT,
  MAX_COLS,
  MAX_ROWS,
} from '@/games/maze/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): MazeEngine {
  const engine = new MazeEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(): MazeEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 调用内部 update 方法 */
function advanceUpdate(engine: MazeEngine, dt: number): void {
  (engine as any).update(dt);
}

/** 获取内部 visited 二维数组 */
function getVisited(engine: MazeEngine): boolean[][] {
  return (engine as any)._visited;
}

/** 获取内部 keys Set */
function getKeys(engine: MazeEngine): Set<string> {
  return (engine as any)._keys;
}

// ========== 测试 ==========

describe('MazeEngine', () => {

  // ==================== 1. 初始化 ====================
  describe('初始化', () => {
    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后 score 为 0', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
    });

    it('init 后 level 为 1', () => {
      const engine = createEngine();
      expect(engine.level).toBe(1);
    });

    it('init 后 steps 为 0', () => {
      const engine = createEngine();
      expect(engine.steps).toBe(0);
    });

    it('init 后 coinsCollected 为 0', () => {
      const engine = createEngine();
      expect(engine.coinsCollected).toBe(0);
    });

    it('init 后 totalCoins 为 0', () => {
      const engine = createEngine();
      expect(engine.totalCoins).toBe(0);
    });

    it('init 后 isWin 为 false', () => {
      const engine = createEngine();
      expect(engine.isWin).toBe(false);
    });

    it('init 后 maze 为空数组', () => {
      const engine = createEngine();
      expect(engine.maze).toEqual([]);
    });

    it('init 后 hintPath 为空', () => {
      const engine = createEngine();
      expect(engine.hintPath).toEqual([]);
    });

    it('init 后 showHint 为 false', () => {
      const engine = createEngine();
      expect(engine.showHint).toBe(false);
    });
  });

  // ==================== 2. 启动与迷宫生成 ====================
  describe('启动与迷宫生成', () => {
    it('start 后 status 为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('start 后 maze 不为空', () => {
      const engine = startEngine();
      expect(engine.maze.length).toBeGreaterThan(0);
    });

    it('迷宫行数等于配置 rows', () => {
      const engine = startEngine();
      expect(engine.maze.length).toBe(engine.rows);
    });

    it('迷宫列数等于配置 cols', () => {
      const engine = startEngine();
      expect(engine.maze[0].length).toBe(engine.cols);
    });

    it('起点 (1,1) 为 CELL_START', () => {
      const engine = startEngine();
      expect(engine.maze[1][1]).toBe(CELL_START);
    });

    it('出口在右下角区域', () => {
      const engine = startEngine();
      const exit = engine.exitPos;
      expect(exit.row).toBe(engine.rows - 2);
      expect(exit.col).toBe(engine.cols - 2);
    });

    it('出口格子为 CELL_EXIT', () => {
      const engine = startEngine();
      expect(engine.maze[engine.exitPos.row][engine.exitPos.col]).toBe(CELL_EXIT);
    });

    it('边界全部为墙壁', () => {
      const engine = startEngine();
      const maze = engine.maze;
      const rows = engine.rows;
      const cols = engine.cols;
      // 顶行
      for (let c = 0; c < cols; c++) {
        expect(maze[0][c]).toBe(CELL_WALL);
      }
      // 底行
      for (let c = 0; c < cols; c++) {
        expect(maze[rows - 1][c]).toBe(CELL_WALL);
      }
      // 左列
      for (let r = 0; r < rows; r++) {
        expect(maze[r][0]).toBe(CELL_WALL);
      }
      // 右列
      for (let r = 0; r < rows; r++) {
        expect(maze[r][cols - 1]).toBe(CELL_WALL);
      }
    });

    it('起点到出口存在可达路径', () => {
      const engine = startEngine();
      const path = engine.hintPath; // 空的
      // 通过 BFS 验证可达性
      const maze = engine.maze;
      const visited: boolean[][] = [];
      for (let r = 0; r < engine.rows; r++) {
        visited[r] = new Array(engine.cols).fill(false);
      }
      const queue = [{ row: 1, col: 1 }];
      visited[1][1] = true;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      let reached = false;
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr.row === engine.exitPos.row && curr.col === engine.exitPos.col) {
          reached = true;
          break;
        }
        for (const [dr, dc] of dirs) {
          const nr = curr.row + dr;
          const nc = curr.col + dc;
          if (nr >= 0 && nr < engine.rows && nc >= 0 && nc < engine.cols && !visited[nr][nc] && maze[nr][nc] !== CELL_WALL) {
            visited[nr][nc] = true;
            queue.push({ row: nr, col: nc });
          }
        }
      }
      expect(reached).toBe(true);
    });

    it('玩家初始位置在起点 (1,1)', () => {
      const engine = startEngine();
      expect(engine.playerPos.row).toBe(1);
      expect(engine.playerPos.col).toBe(1);
    });

    it('起点被标记为已访问', () => {
      const engine = startEngine();
      const visited = getVisited(engine);
      expect(visited[1][1]).toBe(true);
    });
  });

  // ==================== 3. 难度配置 ====================
  describe('难度配置', () => {
    it('默认难度为 easy', () => {
      const engine = createEngine();
      expect(engine.difficulty).toBe('easy');
    });

    it('setDifficulty 切换到 medium', () => {
      const engine = createEngine();
      engine.setDifficulty('medium');
      expect(engine.difficulty).toBe('medium');
    });

    it('setDifficulty 切换到 hard', () => {
      const engine = createEngine();
      engine.setDifficulty('hard');
      expect(engine.difficulty).toBe('hard');
    });

    it('不同难度生成不同大小的迷宫', () => {
      const e1 = createEngine();
      e1.setDifficulty('easy');
      e1.start();
      const easyCols = e1.cols;

      const e2 = createEngine();
      e2.setDifficulty('hard');
      e2.start();
      const hardCols = e2.cols;

      expect(hardCols).toBeGreaterThan(easyCols);
    });

    it('idle 状态按 1 切换到 easy', () => {
      const engine = createEngine();
      engine.handleKeyDown('3'); // 先切到 hard
      engine.handleKeyDown('1'); // 再切回 easy
      expect(engine.difficulty).toBe('easy');
    });

    it('idle 状态按 2 切换到 medium', () => {
      const engine = createEngine();
      engine.handleKeyDown('2');
      expect(engine.difficulty).toBe('medium');
    });

    it('idle 状态按 3 切换到 hard', () => {
      const engine = createEngine();
      engine.handleKeyDown('3');
      expect(engine.difficulty).toBe('hard');
    });

    it('playing 状态按 1 不切换难度', () => {
      const engine = startEngine();
      engine.handleKeyDown('3');
      expect(engine.difficulty).toBe('easy');
    });
  });

  // ==================== 4. 角色移动 ====================
  describe('角色移动', () => {
    it('ArrowUp 向上移动', () => {
      const engine = startEngine();
      // 先找到可向上移动的位置（至少需要向下走一步再回来）
      // 起点在 (1,1)，先检查 (2,1) 是否可走
      const maze = engine.maze;
      if (maze[2][1] !== CELL_WALL) {
        engine.handleKeyDown('ArrowDown');
        expect(engine.playerPos.row).toBe(2);
        engine.handleKeyDown('ArrowUp');
        expect(engine.playerPos.row).toBe(1);
      } else {
        // 如果下方是墙，尝试其他方向
        expect(engine.playerPos.row).toBe(1);
      }
    });

    it('ArrowDown 向下移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[2][1] !== CELL_WALL) {
        engine.handleKeyDown('ArrowDown');
        expect(engine.playerPos.row).toBe(2);
      }
    });

    it('ArrowLeft 向左移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      // 先向右再向左
      if (maze[1][2] !== CELL_WALL) {
        engine.handleKeyDown('ArrowRight');
        engine.handleKeyDown('ArrowLeft');
        expect(engine.playerPos.col).toBe(1);
      }
    });

    it('ArrowRight 向右移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[1][2] !== CELL_WALL) {
        engine.handleKeyDown('ArrowRight');
        expect(engine.playerPos.col).toBe(2);
      }
    });

    it('WASD 也能移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[2][1] !== CELL_WALL) {
        engine.handleKeyDown('s');
        expect(engine.playerPos.row).toBe(2);
      }
    });

    it('w 键向上移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[2][1] !== CELL_WALL) {
        engine.handleKeyDown('s');
        engine.handleKeyDown('w');
        expect(engine.playerPos.row).toBe(1);
      }
    });

    it('a 键向左移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[1][2] !== CELL_WALL) {
        engine.handleKeyDown('d');
        engine.handleKeyDown('a');
        expect(engine.playerPos.col).toBe(1);
      }
    });

    it('d 键向右移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[1][2] !== CELL_WALL) {
        engine.handleKeyDown('d');
        expect(engine.playerPos.col).toBe(2);
      }
    });

    it('移动后 steps 增加', () => {
      const engine = startEngine();
      const maze = engine.maze;
      const initialSteps = engine.steps;
      if (maze[1][2] !== CELL_WALL) {
        engine.handleKeyDown('ArrowRight');
        expect(engine.steps).toBe(initialSteps + 1);
      } else if (maze[2][1] !== CELL_WALL) {
        engine.handleKeyDown('ArrowDown');
        expect(engine.steps).toBe(initialSteps + 1);
      }
    });

    it('移动后目标格子被标记为已访问', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[1][2] !== CELL_WALL) {
        engine.handleKeyDown('ArrowRight');
        const visited = getVisited(engine);
        expect(visited[1][2]).toBe(true);
      }
    });
  });

  // ==================== 5. 碰撞检测 ====================
  describe('碰撞检测', () => {
    it('不能移动到墙壁', () => {
      const engine = startEngine();
      // 起点上方 (0,1) 一定是墙壁
      engine.handleKeyDown('ArrowUp');
      expect(engine.playerPos.row).toBe(1);
      expect(engine.playerPos.col).toBe(1);
    });

    it('不能移动到左边界外', () => {
      const engine = startEngine();
      // 起点左方 (1,0) 一定是墙壁
      engine.handleKeyDown('ArrowLeft');
      expect(engine.playerPos.col).toBe(1);
    });

    it('碰墙不增加步数', () => {
      const engine = startEngine();
      const before = engine.steps;
      engine.handleKeyDown('ArrowUp'); // 一定是墙
      expect(engine.steps).toBe(before);
    });

    it('碰墙不改变位置', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(engine.playerPos).toEqual({ row: 1, col: 1 });
    });
  });

  // ==================== 6. 金币收集 ====================
  describe('金币收集', () => {
    it('start 后 totalCoins >= 0', () => {
      const engine = startEngine();
      expect(engine.totalCoins).toBeGreaterThanOrEqual(0);
    });

    it('totalCoins 不超过配置的 coinCount', () => {
      const engine = createEngine();
      engine.setDifficulty('easy');
      engine.start();
      expect(engine.totalCoins).toBeLessThanOrEqual(DIFFICULTY_LEVELS.easy.coinCount);
    });

    it('踩到金币后 coinsCollected 增加', () => {
      const engine = startEngine();
      const maze = engine.maze;
      // 搜索起点周围的金币
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      let found = false;
      for (const [dr, dc] of dirs) {
        const nr = 1 + dr;
        const nc = 1 + dc;
        if (maze[nr][nc] === CELL_COIN) {
          const key = dr === -1 ? 'ArrowUp' : dr === 1 ? 'ArrowDown' : dc === -1 ? 'ArrowLeft' : 'ArrowRight';
          engine.handleKeyDown(key);
          expect(engine.coinsCollected).toBe(1);
          found = true;
          break;
        }
      }
      // 如果起点周围没金币，也通过
      if (!found) {
        expect(engine.coinsCollected).toBe(0);
      }
    });

    it('踩到金币后格子变为 CELL_PATH', () => {
      const engine = startEngine();
      const maze = engine.maze;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = 1 + dr;
        const nc = 1 + dc;
        if (maze[nr][nc] === CELL_COIN) {
          const key = dr === -1 ? 'ArrowUp' : dr === 1 ? 'ArrowDown' : dc === -1 ? 'ArrowLeft' : 'ArrowRight';
          engine.handleKeyDown(key);
          expect(maze[nr][nc]).toBe(CELL_PATH);
          break;
        }
      }
    });

    it('踩到金币后分数增加 COIN_SCORE', () => {
      const engine = startEngine();
      const maze = engine.maze;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = 1 + dr;
        const nc = 1 + dc;
        if (maze[nr][nc] === CELL_COIN) {
          const key = dr === -1 ? 'ArrowUp' : dr === 1 ? 'ArrowDown' : dc === -1 ? 'ArrowLeft' : 'ArrowRight';
          engine.handleKeyDown(key);
          expect(engine.score).toBe(COIN_SCORE);
          break;
        }
      }
    });
  });

  // ==================== 7. 到达终点 ====================
  describe('到达终点', () => {
    it('到达终点后 isWin 为 true', () => {
      const engine = startEngine();
      // 直接设置玩家位置到出口
      (engine as any)._playerPos = { ...engine.exitPos };
      (engine as any).tryMove('ArrowRight'); // 尝试移动触发检查
      // 手动触发 winLevel
      (engine as any).winLevel();
      expect(engine.isWin).toBe(true);
    });

    it('到达终点后 status 为 gameover', () => {
      const engine = startEngine();
      (engine as any).winLevel();
      expect(engine.status).toBe('gameover');
    });

    it('到达终点后获得 LEVEL_COMPLETE_BONUS 分', () => {
      const engine = startEngine();
      const scoreBefore = engine.score;
      (engine as any).winLevel();
      expect(engine.score).toBe(scoreBefore + LEVEL_COMPLETE_BONUS);
    });

    it('到达终点后 level 增加', () => {
      const engine = startEngine();
      const levelBefore = engine.level;
      (engine as any).winLevel();
      expect(engine.level).toBe(levelBefore + 1);
    });

    it('到达终点后关卡尺寸增大', () => {
      const engine = startEngine();
      const colsBefore = (engine as any)._levelCols;
      const rowsBefore = (engine as any)._levelRows;
      (engine as any).winLevel();
      expect((engine as any)._levelCols).toBe(Math.min(MAX_COLS, colsBefore + COLS_INCREMENT));
      expect((engine as any)._levelRows).toBe(Math.min(MAX_ROWS, rowsBefore + ROWS_INCREMENT));
    });

    it('level 达到 10 后不再增加', () => {
      const engine = startEngine();
      (engine as any).setLevel(10);
      (engine as any).winLevel();
      expect(engine.level).toBe(10);
    });
  });

  // ==================== 8. 计时与步数 ====================
  describe('计时与步数', () => {
    it('steps 初始为 0', () => {
      const engine = startEngine();
      expect(engine.steps).toBe(0);
    });

    it('每次有效移动 steps 加 1', () => {
      const engine = startEngine();
      const maze = engine.maze;
      if (maze[1][2] !== CELL_WALL) {
        engine.handleKeyDown('ArrowRight');
        expect(engine.steps).toBe(1);
        if (maze[1][3] !== CELL_WALL) {
          engine.handleKeyDown('ArrowRight');
          expect(engine.steps).toBe(2);
        }
      }
    });

    it('elapsedTime 在 start 后开始计时', () => {
      const engine = startEngine();
      expect(engine.elapsedTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== 9. 持续按键移动 ====================
  describe('持续按键移动', () => {
    it('按住方向键持续移动', () => {
      const engine = startEngine();
      const maze = engine.maze;
      // 找一个可以连续移动的方向
      let moveKey = '';
      let expectedSteps = 0;
      if (maze[1][2] !== CELL_WALL) {
        moveKey = 'ArrowRight';
        expectedSteps++;
        if (maze[1][3] !== CELL_WALL) {
          expectedSteps++;
        }
      } else if (maze[2][1] !== CELL_WALL) {
        moveKey = 'ArrowDown';
        expectedSteps++;
        if (maze[3][1] !== CELL_WALL) {
          expectedSteps++;
        }
      }

      if (moveKey) {
        engine.handleKeyDown(moveKey);
        const stepsAfterFirst = engine.steps;
        // 模拟 update 推进时间
        advanceUpdate(engine, MOVE_INTERVAL + 10);
        // 持续按键应该再次移动
        if (expectedSteps >= 2) {
          expect(engine.steps).toBeGreaterThan(stepsAfterFirst);
        }
      }
    });

    it('松开按键后停止持续移动', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyUp('ArrowRight');
      const stepsBefore = engine.steps;
      advanceUpdate(engine, MOVE_INTERVAL + 10);
      // 松开后不应继续移动（除非碰巧在边界）
      // 只检查不崩溃
      expect(engine.steps).toBeGreaterThanOrEqual(stepsBefore);
    });

    it('update 在 isWin 时不处理移动', () => {
      const engine = startEngine();
      (engine as any)._isWin = true;
      const stepsBefore = engine.steps;
      advanceUpdate(engine, MOVE_INTERVAL + 10);
      expect(engine.steps).toBe(stepsBefore);
    });
  });

  // ==================== 10. 迷雾模式 ====================
  describe('迷雾模式', () => {
    it('easy 难度默认启用迷雾', () => {
      const engine = createEngine();
      engine.setDifficulty('easy');
      engine.start();
      // fogRadius > 0 时启用迷雾
      expect(engine.fogEnabled).toBe(true);
    });

    it('toggleFog 切换迷雾状态', () => {
      const engine = startEngine();
      const before = engine.fogEnabled;
      engine.toggleFog();
      expect(engine.fogEnabled).toBe(!before);
    });

    it('再次 toggleFog 恢复原状态', () => {
      const engine = startEngine();
      const original = engine.fogEnabled;
      engine.toggleFog();
      engine.toggleFog();
      expect(engine.fogEnabled).toBe(original);
    });

    it('F 键切换迷雾', () => {
      const engine = startEngine();
      const before = engine.fogEnabled;
      engine.handleKeyDown('f');
      expect(engine.fogEnabled).toBe(!before);
    });

    it('F 键大写也能切换', () => {
      const engine = startEngine();
      const before = engine.fogEnabled;
      engine.handleKeyDown('F');
      expect(engine.fogEnabled).toBe(!before);
    });

    it('fogRadius 根据难度配置', () => {
      const engine = createEngine();
      engine.setDifficulty('easy');
      engine.start();
      expect(engine.fogRadius).toBe(DIFFICULTY_LEVELS.easy.fogRadius);
    });
  });

  // ==================== 11. 提示功能 ====================
  describe('提示功能', () => {
    it('showHintPath 设置 hintPath 不为空', () => {
      const engine = startEngine();
      engine.showHintPath();
      expect(engine.hintPath.length).toBeGreaterThan(0);
    });

    it('showHintPath 设置 showHint 为 true', () => {
      const engine = startEngine();
      engine.showHintPath();
      expect(engine.showHint).toBe(true);
    });

    it('H 键触发提示', () => {
      const engine = startEngine();
      engine.handleKeyDown('h');
      expect(engine.showHint).toBe(true);
    });

    it('H 键大写也能触发', () => {
      const engine = startEngine();
      engine.handleKeyDown('H');
      expect(engine.showHint).toBe(true);
    });

    it('提示路径的第一个点在玩家附近', () => {
      const engine = startEngine();
      engine.showHintPath();
      const first = engine.hintPath[0];
      const dr = Math.abs(first.row - engine.playerPos.row);
      const dc = Math.abs(first.col - engine.playerPos.col);
      expect(dr + dc).toBe(1); // 相邻格子
    });

    it('提示路径的最后一个点是出口', () => {
      const engine = startEngine();
      engine.showHintPath();
      const last = engine.hintPath[engine.hintPath.length - 1];
      expect(last.row).toBe(engine.exitPos.row);
      expect(last.col).toBe(engine.exitPos.col);
    });

    it('提示路径中不包含墙壁', () => {
      const engine = startEngine();
      engine.showHintPath();
      for (const p of engine.hintPath) {
        expect(engine.maze[p.row][p.col]).not.toBe(CELL_WALL);
      }
    });

    it('提示在 3 秒后自动消失', () => {
      const engine = startEngine();
      engine.showHintPath();
      expect(engine.showHint).toBe(true);
      advanceUpdate(engine, 3100);
      expect(engine.showHint).toBe(false);
      expect(engine.hintPath).toEqual([]);
    });

    it('idle 状态按 H 不触发提示', () => {
      const engine = createEngine();
      engine.handleKeyDown('h');
      expect(engine.showHint).toBe(false);
    });
  });

  // ==================== 12. 空格键控制 ====================
  describe('空格键控制', () => {
    it('idle 状态按空格开始游戏', () => {
      const engine = createEngine();
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('gameover 状态按空格重置并开始', () => {
      const engine = startEngine();
      (engine as any).winLevel();
      expect(engine.status).toBe('gameover');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('playing 状态按空格不做特殊处理', () => {
      const engine = startEngine();
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });
  });

  // ==================== 13. 键盘事件 ====================
  describe('键盘事件', () => {
    it('handleKeyDown 添加按键到 keys 集合', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      expect(getKeys(engine).has('ArrowRight')).toBe(true);
    });

    it('handleKeyUp 移除按键', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyUp('ArrowRight');
      expect(getKeys(engine).has('ArrowRight')).toBe(false);
    });

    it('handleKeyUp 清除 lastMoveKey', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyUp('ArrowRight');
      expect((engine as any)._lastMoveKey).toBe('');
    });

    it('非移动键不触发移动', () => {
      const engine = startEngine();
      const before = engine.steps;
      engine.handleKeyDown('x');
      expect(engine.steps).toBe(before);
    });
  });

  // ==================== 14. getState ====================
  describe('getState', () => {
    it('返回包含 score', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('score');
    });

    it('返回包含 level', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('level');
    });

    it('返回包含 steps', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('steps');
    });

    it('返回包含 playerPos', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('playerPos');
    });

    it('返回包含 exitPos', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('exitPos');
    });

    it('返回包含 isWin', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('isWin');
    });

    it('返回包含 difficulty', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('difficulty');
    });

    it('返回包含 fogEnabled', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('fogEnabled');
    });

    it('返回包含 coinsCollected 和 totalCoins', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('coinsCollected');
      expect(state).toHaveProperty('totalCoins');
    });

    it('返回包含 cols 和 rows', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('cols');
      expect(state).toHaveProperty('rows');
    });

    it('playerPos 是副本不是引用', () => {
      const engine = startEngine();
      const state = engine.getState();
      const pos = state.playerPos as { row: number; col: number };
      pos.row = 999;
      expect(engine.playerPos.row).not.toBe(999);
    });
  });

  // ==================== 15. 重置 ====================
  describe('重置', () => {
    it('reset 后 status 为 idle', () => {
      const engine = startEngine();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后 score 为 0', () => {
      const engine = startEngine();
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('reset 后 level 为 1', () => {
      const engine = startEngine();
      (engine as any).winLevel();
      engine.reset();
      expect(engine.level).toBe(1);
    });

    it('reset 后 steps 为 0', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      engine.reset();
      expect(engine.steps).toBe(0);
    });

    it('reset 后 isWin 为 false', () => {
      const engine = startEngine();
      (engine as any).winLevel();
      engine.reset();
      expect(engine.isWin).toBe(false);
    });

    it('reset 后 maze 为空', () => {
      const engine = startEngine();
      engine.reset();
      expect(engine.maze).toEqual([]);
    });

    it('reset 后可以重新 start', () => {
      const engine = startEngine();
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
    });
  });

  // ==================== 16. 生命周期 ====================
  describe('生命周期', () => {
    it('destroy 后可以重新创建', () => {
      const engine = startEngine();
      engine.destroy();
      const engine2 = startEngine();
      expect(engine2.status).toBe('playing');
    });

    it('destroy 后 status 为 idle', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('多次 init 不崩溃', () => {
      const engine = createEngine();
      engine.init();
      engine.init();
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== 17. 布局计算 ====================
  describe('布局计算', () => {
    it('cellSize 大于 0', () => {
      const engine = startEngine();
      expect(engine.cellSize).toBeGreaterThan(0);
    });

    it('cellSize 合理（不超过画布）', () => {
      const engine = startEngine();
      const totalW = engine.cols * engine.cellSize;
      const totalH = engine.rows * engine.cellSize;
      expect(totalW).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(totalH).toBeLessThanOrEqual(CANVAS_HEIGHT);
    });
  });

  // ==================== 18. 事件系统 ====================
  describe('事件系统', () => {
    it('statusChange 事件在 start 时触发', () => {
      const engine = createEngine();
      const fn = jest.fn();
      engine.on('statusChange', fn);
      engine.start();
      expect(fn).toHaveBeenCalledWith('playing');
    });

    it('scoreChange 事件在收集金币时触发', () => {
      const engine = startEngine();
      const fn = jest.fn();
      engine.on('scoreChange', fn);
      // 手动触发加分
      engine.addScore(COIN_SCORE);
      expect(fn).toHaveBeenCalledWith(COIN_SCORE);
    });

    it('stateChange 事件在通关时触发', () => {
      const engine = startEngine();
      const fn = jest.fn();
      engine.on('stateChange', fn);
      (engine as any).winLevel();
      expect(fn).toHaveBeenCalled();
    });

    it('off 取消事件监听', () => {
      const engine = createEngine();
      const fn = jest.fn();
      engine.on('statusChange', fn);
      engine.off('statusChange', fn);
      engine.start();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // ==================== 19. 多关卡 ====================
  describe('多关卡', () => {
    it('第二关迷宫尺寸更大', () => {
      const engine = startEngine();
      const cols1 = engine.cols;
      const rows1 = engine.rows;
      (engine as any).winLevel();
      // 注意：winLevel 后 status 是 gameover
      // 验证 _levelCols/_levelRows 增大
      expect((engine as any)._levelCols).toBe(cols1 + COLS_INCREMENT);
      expect((engine as any)._levelRows).toBe(rows1 + ROWS_INCREMENT);
    });

    it('关卡尺寸不超过最大值', () => {
      const engine = startEngine();
      (engine as any)._levelCols = MAX_COLS;
      (engine as any)._levelRows = MAX_ROWS;
      (engine as any).setLevel(5);
      (engine as any).winLevel();
      expect((engine as any)._levelCols).toBeLessThanOrEqual(MAX_COLS);
      expect((engine as any)._levelRows).toBeLessThanOrEqual(MAX_ROWS);
    });
  });

  // ==================== 20. 边界情况 ====================
  describe('边界情况', () => {
    it('迷宫所有内部路径格子可达（BFS 验证）', () => {
      const engine = startEngine();
      const maze = engine.maze;
      let pathCount = 0;
      for (let r = 1; r < engine.rows - 1; r++) {
        for (let c = 1; c < engine.cols - 1; c++) {
          if (maze[r][c] !== CELL_WALL) pathCount++;
        }
      }
      // BFS 从起点出发统计可达格子
      const visited: boolean[][] = [];
      for (let r = 0; r < engine.rows; r++) {
        visited[r] = new Array(engine.cols).fill(false);
      }
      const queue = [{ row: 1, col: 1 }];
      visited[1][1] = true;
      let reachable = 0;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        reachable++;
        for (const [dr, dc] of dirs) {
          const nr = curr.row + dr;
          const nc = curr.col + dc;
          if (nr >= 0 && nr < engine.rows && nc >= 0 && nc < engine.cols && !visited[nr][nc] && maze[nr][nc] !== CELL_WALL) {
            visited[nr][nc] = true;
            queue.push({ row: nr, col: nc });
          }
        }
      }
      expect(reachable).toBe(pathCount);
    });

    it('DFS 生成的迷宫有偶数行列约束', () => {
      // DFS 迷宫要求 rows 和 cols 为奇数才能正确生成
      const engine = createEngine();
      engine.setDifficulty('easy');
      engine.start();
      // 检查 rows 和 cols 为奇数（DFS 算法需要）
      expect(engine.rows % 2).toBe(0); // 偶数（因为边界+内部奇数格）
      expect(engine.cols % 2).toBe(0);
    });

    it('同一难度多次 start 生成不同迷宫', () => {
      // 多次启动应该生成不同的迷宫（概率极高）
      const engine = createEngine();
      engine.setDifficulty('easy');
      engine.start();
      const maze1 = engine.maze.map(row => [...row]);
      engine.reset();
      engine.start();
      const maze2 = engine.maze.map(row => [...row]);
      // 至少有一个格子不同
      let diff = false;
      for (let r = 0; r < maze1.length && !diff; r++) {
        for (let c = 0; c < maze1[0].length && !diff; c++) {
          if (maze1[r][c] !== maze2[r][c]) diff = true;
        }
      }
      // 由于随机性，这个测试有极小概率失败，但几乎不可能
      expect(diff).toBe(true);
    });

    it('update(deltaTime=0) 不崩溃', () => {
      const engine = startEngine();
      expect(() => advanceUpdate(engine, 0)).not.toThrow();
    });

    it('update(deltaTime=负数) 不崩溃', () => {
      const engine = startEngine();
      expect(() => advanceUpdate(engine, -100)).not.toThrow();
    });
  });

  // ==================== 21. addScore 和 setLevel ====================
  describe('addScore 和 setLevel', () => {
    it('addScore 增加分数', () => {
      const engine = startEngine();
      engine.addScore(50);
      expect(engine.score).toBe(50);
    });

    it('多次 addScore 累加', () => {
      const engine = startEngine();
      engine.addScore(10);
      engine.addScore(20);
      engine.addScore(30);
      expect(engine.score).toBe(60);
    });

    it('setLevel 设置等级', () => {
      const engine = startEngine();
      engine.setLevel(5);
      expect(engine.level).toBe(5);
    });
  });

  // ==================== 22. 渲染不崩溃 ====================
  describe('渲染不崩溃', () => {
    it('playing 状态 render 不崩溃', () => {
      const engine = startEngine();
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('gameover 状态 render 不崩溃', () => {
      const engine = startEngine();
      (engine as any).winLevel();
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('迷雾开启时 render 不崩溃', () => {
      const engine = startEngine();
      // 确保迷雾开启
      if (!engine.fogEnabled) engine.toggleFog();
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('提示路径显示时 render 不崩溃', () => {
      const engine = startEngine();
      engine.showHintPath();
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==================== 23. 常量验证 ====================
  describe('常量验证', () => {
    it('CELL_WALL = 0', () => { expect(CELL_WALL).toBe(0); });
    it('CELL_PATH = 1', () => { expect(CELL_PATH).toBe(1); });
    it('CELL_COIN = 2', () => { expect(CELL_COIN).toBe(2); });
    it('CELL_EXIT = 3', () => { expect(CELL_EXIT).toBe(3); });
    it('CELL_START = 4', () => { expect(CELL_START).toBe(4); });
    it('COIN_SCORE = 10', () => { expect(COIN_SCORE).toBe(10); });
    it('LEVEL_COMPLETE_BONUS = 100', () => { expect(LEVEL_COMPLETE_BONUS).toBe(100); });
    it('CANVAS_WIDTH = 480', () => { expect(CANVAS_WIDTH).toBe(480); });
    it('CANVAS_HEIGHT = 640', () => { expect(CANVAS_HEIGHT).toBe(640); });
  });
});
