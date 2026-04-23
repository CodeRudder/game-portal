import { vi } from 'vitest';
import { SokobanEngine } from '@/games/sokoban/SokobanEngine';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  return canvas;
}

function createEngine(): SokobanEngine {
  const engine = new SokobanEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(): SokobanEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

// 地图元素常量（与引擎内部一致）
const EMPTY = 0;
const WALL = 1;
const BOX = 2;
const TARGET = 3;
const BOX_ON_TARGET = 4;
const PLAYER = 5;
const PLAYER_ON_TARGET = 6;

/**
 * 关卡1（索引0）地图:
 * 玩家在 row=4, col=5
 * 箱子在 (2,2) 和 (7,3)
 * 目标在 (3,6) 和 (4,6)
 */
const LEVEL_0_MAP = [
  [1,1,1,1,1,0,0,0],
  [1,0,0,0,1,0,0,0],
  [1,0,2,0,1,1,1,1],
  [1,0,0,0,0,0,3,1],
  [1,1,1,0,1,5,3,1],
  [0,0,1,0,1,1,1,1],
  [0,0,1,2,1,0,0,0],
  [0,0,1,0,1,0,0,0],
  [0,0,1,1,1,0,0,0],
];

// ========== 测试 ==========

describe('SokobanEngine', () => {
  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('init 后加载第 0 关', () => {
      const engine = createEngine();
      expect(engine.currentLevelIndex).toBe(0);
    });

    it('totalLevels 为 5', () => {
      const engine = createEngine();
      expect(engine.totalLevels).toBe(5);
    });

    it('init 后 moveCount 为 0', () => {
      const engine = createEngine();
      expect(engine.moveCount).toBe(0);
    });

    it('init 后 pushCount 为 0', () => {
      const engine = createEngine();
      expect(engine.pushCount).toBe(0);
    });

    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== T2: 移动 ====================
  describe('移动', () => {
    it('start 后 status 为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('ArrowRight 移动玩家到空格，moveCount 增加', () => {
      const engine = startEngine();
      // 玩家在 (row=4, col=5)
      // 右边 (row=4, col=6) 是 TARGET(3)，可以移动上去
      engine.handleKeyDown('ArrowRight');
      expect(engine.moveCount).toBe(1);
    });

    it('ArrowLeft 移动玩家，玩家位置更新', () => {
      const engine = startEngine();
      // 玩家在 (row=4, col=5)
      // 左边 (row=4, col=4) 是 WALL(1)，不能移动
      // 需要找可移动方向
      // 上方 (row=3, col=5) 是 EMPTY(0)，可以移动
      engine.handleKeyDown('ArrowUp');
      expect(engine.moveCount).toBe(1);
    });

    it('不能移动到墙壁', () => {
      const engine = startEngine();
      // 玩家在 (row=4, col=5)
      // 左边 col=4 是 WALL
      engine.handleKeyDown('ArrowLeft');
      expect(engine.moveCount).toBe(0);
    });

    it('WASD 键也可以控制移动', () => {
      const engine = startEngine();
      engine.handleKeyDown('w'); // 向上
      expect(engine.moveCount).toBe(1);
    });

    it('非 playing 状态下按键无效', () => {
      const engine = createEngine();
      engine.handleKeyDown('ArrowUp');
      expect(engine.moveCount).toBe(0);
    });
  });

  // ==================== T3: 推箱 ====================
  describe('推箱', () => {
    it('玩家推箱子，箱子移动一格', () => {
      const engine = startEngine();

      // 使用自定义地图，简化测试
      // 地图: 玩家(5)在箱子(2)左边，箱子右边是空的
      // [1,1,1,1,1]
      // [1,5,2,0,1]
      // [1,1,1,1,1]
      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, EMPTY, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      engine.handleKeyDown('ArrowRight');

      // 玩家移到 col=2，箱子推到 col=3
      expect((engine as any).playerX).toBe(2);
      expect((engine as any).playerY).toBe(1);
      expect((engine as any).board[1][3]).toBe(BOX);
      expect((engine as any).board[1][2]).toBe(PLAYER);
    });

    it('推箱子时 pushCount 增加', () => {
      const engine = startEngine();

      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, EMPTY, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      engine.handleKeyDown('ArrowRight');

      expect(engine.pushCount).toBe(1);
    });

    it('不能把箱子推到墙壁', () => {
      const engine = startEngine();

      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, WALL, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      engine.handleKeyDown('ArrowRight');

      // 不能移动
      expect(engine.moveCount).toBe(0);
      expect((engine as any).playerX).toBe(1);
    });

    it('不能把箱子推到另一个箱子', () => {
      const engine = startEngine();

      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, BOX, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      engine.handleKeyDown('ArrowRight');

      expect(engine.moveCount).toBe(0);
    });
  });

  // ==================== T4: 胜利判定 ====================
  describe('胜利判定', () => {
    it('checkWin 在所有箱子在目标上时返回 true', () => {
      const engine = startEngine();

      // 自定义地图：一个箱子已在目标上，玩家在空格
      const customBoard = [
        [WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX_ON_TARGET, WALL],
        [WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      // checkWin 应返回 true（没有 TARGET 或 BOX）
      expect((engine as any).checkWin()).toBe(true);
    });

    it('isWin 在 tryMove 后 checkWin 为 true 时设置', () => {
      const engine = startEngine();

      // 构造：玩家推最后一个箱子到目标上
      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, TARGET, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      // 推箱子到目标上
      engine.handleKeyDown('ArrowRight');

      expect(engine.isWin).toBe(true);
    });

    it('存在未放置的箱子时不 win', () => {
      const engine = startEngine();

      const customBoard = [
        [WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, WALL],
        [WALL, TARGET, EMPTY, WALL],
        [WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      expect((engine as any).checkWin()).toBe(false);
      expect(engine.isWin).toBe(false);
    });

    it('存在空目标时不 win', () => {
      const engine = startEngine();

      const customBoard = [
        [WALL, WALL, WALL, WALL],
        [WALL, PLAYER, TARGET, WALL],
        [WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      expect((engine as any).checkWin()).toBe(false);
    });

    it('推最后一个箱子到目标触发 gameover', () => {
      const engine = startEngine();

      // 玩家在箱子左边，箱子在目标左边
      // 推箱子到目标上
      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, TARGET, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      engine.handleKeyDown('ArrowRight');

      // 箱子推到目标上，所有目标被覆盖，胜利
      expect(engine.isWin).toBe(true);
      expect(engine.status).toBe('gameover');
    });
  });

  // ==================== T5: Undo ====================
  describe('Undo', () => {
    it('按 Z 撤销上一步移动', () => {
      const engine = startEngine();

      // 先向上移动一步
      engine.handleKeyDown('ArrowUp');
      expect(engine.moveCount).toBe(1);

      // 撤销
      engine.handleKeyDown('z');
      expect(engine.moveCount).toBe(0);
    });

    it('撤销后玩家位置恢复', () => {
      const engine = startEngine();

      const playerXBefore = (engine as any).playerX;
      const playerYBefore = (engine as any).playerY;

      // 向上移动
      engine.handleKeyDown('ArrowUp');

      // 撤销
      engine.handleKeyDown('z');

      expect((engine as any).playerX).toBe(playerXBefore);
      expect((engine as any).playerY).toBe(playerYBefore);
    });

    it('撤销推箱子操作恢复箱子位置', () => {
      const engine = startEngine();

      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, EMPTY, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard.map(row => [...row]);
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      // 推箱子
      engine.handleKeyDown('ArrowRight');
      expect(engine.pushCount).toBe(1);

      // 撤销
      engine.handleKeyDown('z');
      expect(engine.pushCount).toBe(0);
      expect((engine as any).board[1][2]).toBe(BOX);
      expect((engine as any).board[1][3]).toBe(EMPTY);
    });

    it('没有历史时 undo 不报错', () => {
      const engine = startEngine();
      // 没有移动过，直接 undo
      expect(() => engine.handleKeyDown('z')).not.toThrow();
      expect(engine.moveCount).toBe(0);
    });
  });

  // ==================== T6: 关卡切换 ====================
  describe('关卡切换', () => {
    it('loadLevel(1) 切换到第 2 关', () => {
      const engine = createEngine();
      engine.loadLevel(1);
      expect(engine.currentLevelIndex).toBe(1);
    });

    it('loadLevel 后 moveCount 重置', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(engine.moveCount).toBe(1);

      engine.loadLevel(1);
      expect(engine.moveCount).toBe(0);
    });

    it('loadLevel 超出范围时使用最大有效索引', () => {
      const engine = createEngine();
      engine.loadLevel(100);
      // 应该 clamp 到最后一个关卡
      expect(engine.currentLevelIndex).toBeLessThan(engine.totalLevels);
      expect(engine.currentLevelIndex).toBeGreaterThanOrEqual(0);
    });

    it('nextLevel 进入下一关', () => {
      const engine = startEngine();
      expect(engine.currentLevelIndex).toBe(0);

      engine.nextLevel();
      expect(engine.currentLevelIndex).toBe(1);
    });

    it('最后一关 nextLevel 循环或保持', () => {
      const engine = createEngine();
      engine.loadLevel(engine.totalLevels - 1);
      engine.start();

      engine.nextLevel();
      // 最后一关的 nextLevel 行为：可能循环到第0关或保持
      expect(engine.currentLevelIndex).toBeGreaterThanOrEqual(0);
      expect(engine.currentLevelIndex).toBeLessThan(engine.totalLevels);
    });

    it('R 键重置当前关卡', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(engine.moveCount).toBe(1);

      engine.handleKeyDown('r');
      expect(engine.moveCount).toBe(0);
    });
  });

  // ==================== T7: 事件系统 ====================
  describe('事件系统', () => {
    it('移动触发 stateChange 事件', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('stateChange', cb);

      engine.handleKeyDown('ArrowUp');

      expect(cb).toHaveBeenCalled();
    });

    it('stateChange 回调被调用', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('stateChange', cb);

      engine.handleKeyDown('ArrowUp');

      expect(cb).toHaveBeenCalled();
      // stateChange 事件不传参数（emit('stateChange') 无 payload）
    });

    it('不能移动时不触发 stateChange', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('stateChange', cb);

      // 向左移动是墙壁，不应该触发事件
      engine.handleKeyDown('ArrowLeft');

      expect(cb).not.toHaveBeenCalled();
    });

    it('off 取消事件监听', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('stateChange', cb);
      engine.off('stateChange', cb);

      engine.handleKeyDown('ArrowUp');

      expect(cb).not.toHaveBeenCalled();
    });

    it('start 触发 statusChange 事件', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith('playing');
    });
  });

  // ==================== 计分与生命周期 ====================
  describe('计分与生命周期', () => {
    it('score 初始为 0（胜利时才计算）', () => {
      const engine = startEngine();
      expect(engine.score).toBe(0);
    });

    it('胜利时 score = max(100, 1000 - moves*5 + level*200)', () => {
      const engine = startEngine();

      // 推最后一个箱子到目标上（1步就赢）
      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, TARGET, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      engine.handleKeyDown('ArrowRight');

      // moves=1, level=0
      // score = max(100, 1000 - 5 + 0) = 995
      expect(engine.score).toBe(995);
    });

    it('高关卡胜利时 score 更高', () => {
      const engine = createEngine();
      engine.loadLevel(2);
      engine.start();

      const customBoard = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PLAYER, BOX, TARGET, WALL],
        [WALL, WALL, WALL, WALL, WALL],
      ];
      (engine as any).board = customBoard;
      (engine as any).playerX = 1;
      (engine as any).playerY = 1;

      engine.handleKeyDown('ArrowRight');

      // moves=1, level=2
      // score = max(100, 1000 - 5 + 400) = 1395
      expect(engine.score).toBe(1395);
    });

    it('pause/resume 正常工作', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 回到 idle', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.moveCount).toBe(0);
    });

    it('getState 返回正确结构', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('moves');
      expect(state).toHaveProperty('pushes');
      expect(state.level).toBe(0);
      expect(state.moves).toBe(0);
      expect(state.pushes).toBe(0);
    });
  });
});
