import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PacmanEngine } from '@/games/pacman/PacmanEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  COLS, ROWS, GRID_SIZE,
  WALL, DOT, POWER_PELLET, EMPTY,
  PLAYER_SPEED, INITIAL_LIVES,
  GHOST_SPEED, GHOST_COUNT, FRIGHTENED_DURATION,
  DOT_SCORE, POWER_PELLET_SCORE, GHOST_SCORE,
  DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_NONE,
  MAZE_TEMPLATE, GHOST_COLORS,
} from '@/games/pacman/constants';

const mockCtx = {
  fillRect: vi.fn(), clearRect: vi.fn(), fillText: vi.fn(),
  beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  strokeRect: vi.fn(), stroke: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
};

const mockCanvas = {
  width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
  getContext: vi.fn(() => mockCtx),
} as unknown as HTMLCanvasElement;

function createEngine(): PacmanEngine {
  const engine = new PacmanEngine();
  engine.init(mockCanvas);
  return engine;
}

describe('PacmanEngine', () => {
  // ========== 初始化 ==========
  describe('初始化', () => {
    it('init 后状态为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后分数为 0', () => {
      expect(createEngine().score).toBe(0);
    });

    it('init 后等级为 1', () => {
      expect(createEngine().level).toBe(1);
    });

    it('init 后生命数为 INITIAL_LIVES', () => {
      expect(createEngine().lives).toBe(INITIAL_LIVES);
    });

    it('init 后玩家在起始位置', () => {
      const engine = createEngine();
      expect(engine.playerX).toBe(9);
      expect(engine.playerY).toBe(15);
    });

    it('init 后玩家方向为 NONE', () => {
      expect(createEngine().playerDir).toBe(DIR_NONE);
    });

    it('init 后幽灵数量正确', () => {
      expect(createEngine().ghosts.length).toBe(GHOST_COUNT);
    });

    it('迷宫尺寸正确', () => {
      const engine = createEngine();
      expect(engine.maze.length).toBe(ROWS);
      expect(engine.maze[0].length).toBe(COLS);
    });

    it('迷宫有豆子', () => {
      const engine = createEngine();
      expect(engine.totalDots).toBeGreaterThan(0);
    });

    it('初始已收集豆子为 0', () => {
      expect(createEngine().dotCount).toBe(0);
    });

    it('幽灵有不同颜色', () => {
      const engine = createEngine();
      const colors = engine.ghosts.map(g => g.color);
      expect(new Set(colors).size).toBe(GHOST_COUNT);
    });
  });

  // ========== 游戏状态 ==========
  describe('游戏状态', () => {
    it('start 后状态为 playing', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('pause 后状态为 paused', () => {
      const engine = createEngine();
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态为 playing', () => {
      const engine = createEngine();
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态为 idle', () => {
      const engine = createEngine();
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
    });
  });

  // ========== 玩家移动 ==========
  describe('玩家移动', () => {
    it('按方向键设置下一方向', () => {
      const engine = createEngine();
      engine.handleKeyDown('ArrowUp');
      expect((engine as any)._nextDir).toBe(DIR_UP);
    });

    it('WASD 也可控制方向', () => {
      const engine = createEngine();
      engine.handleKeyDown('w');
      expect((engine as any)._nextDir).toBe(DIR_UP);
      engine.handleKeyDown('s');
      expect((engine as any)._nextDir).toBe(DIR_DOWN);
      engine.handleKeyDown('a');
      expect((engine as any)._nextDir).toBe(DIR_LEFT);
      engine.handleKeyDown('d');
      expect((engine as any)._nextDir).toBe(DIR_RIGHT);
    });

    it('update 后玩家向设定方向移动', () => {
      const engine = createEngine();
      engine.start();
      const startX = engine.playerX;
      engine.handleKeyDown('ArrowLeft');
      // Run enough updates for one move
      for (let i = 0; i < 20; i++) engine.update(100);
      expect(engine.playerX).toBeLessThan(startX);
    });

    it('玩家不能穿墙', () => {
      const engine = createEngine();
      engine.start();
      // Player at (9,15), wall above at row14 col9
      engine.handleKeyDown('ArrowUp');
      for (let i = 0; i < 20; i++) engine.update(100);
      const cell = MAZE_TEMPLATE[engine.playerY][engine.playerX];
      expect(cell).not.toBe(WALL);
    });

    it('吃豆子后 dotCount 增加', () => {
      const engine = createEngine();
      engine.start();
      const before = engine.dotCount;
      engine.handleKeyDown('ArrowLeft');
      for (let i = 0; i < 20; i++) engine.update(100);
      expect(engine.dotCount).toBeGreaterThan(before);
    });

    it('吃豆子得分', () => {
      const engine = createEngine();
      engine.start();
      const before = engine.score;
      engine.handleKeyDown('ArrowLeft');
      for (let i = 0; i < 20; i++) engine.update(100);
      if (engine.dotCount > 0) {
        expect(engine.score).toBeGreaterThan(before);
      }
    });
  });

  // ========== 大力丸 ==========
  describe('大力丸', () => {
    it('吃大力丸后幽灵进入 frightened', () => {
      const engine = createEngine();
      engine.start();
      // Manually place player on a power pellet and collect
      // Power pellets at (1,2), (17,2), (1,15), (17,15) in MAZE_TEMPLATE
      (engine as any)._playerX = 1;
      (engine as any)._playerY = 2;
      (engine as any).collectDot();
      expect(engine.frightenedTimer).toBeGreaterThan(0);
      const frightened = engine.ghosts.some(g => g.frightened);
      expect(frightened).toBe(true);
    });

    it('frightened 超时后幽灵恢复', () => {
      const engine = createEngine();
      engine.start();
      (engine as any)._playerX = 1;
      (engine as any)._playerY = 2;
      (engine as any).collectDot();
      // Advance time past frightened duration
      for (let i = 0; i < 100; i++) engine.update(FRIGHTENED_DURATION / 50);
      expect(engine.frightenedTimer).toBe(0);
      expect(engine.ghosts.every(g => !g.frightened)).toBe(true);
    });
  });

  // ========== 碰撞 ==========
  describe('碰撞检测', () => {
    it('碰到普通幽灵失去生命', () => {
      const engine = createEngine();
      engine.start();
      const before = engine.lives;
      // Place player on ghost
      const ghost = engine.ghosts[0];
      (engine as any)._playerX = ghost.x;
      (engine as any)._playerY = ghost.y;
      (engine as any).checkCollisions();
      expect(engine.lives).toBeLessThan(before);
    });

    it('碰到 frightened 幽灵吃掉幽灵', () => {
      const engine = createEngine();
      engine.start();
      const ghost = engine.ghosts[0];
      ghost.frightened = true;
      ghost.homeTimer = 0;
      (engine as any)._playerX = ghost.x;
      (engine as any)._playerY = ghost.y;
      (engine as any).checkCollisions();
      expect(ghost.eaten).toBe(true);
    });

    it('吃幽灵得分 200', () => {
      const engine = createEngine();
      engine.start();
      const ghost = engine.ghosts[0];
      ghost.frightened = true;
      ghost.homeTimer = 0;
      (engine as any)._playerX = ghost.x;
      (engine as any)._playerY = ghost.y;
      const before = engine.score;
      (engine as any).checkCollisions();
      expect(engine.score).toBe(before + GHOST_SCORE);
    });

    it('连续吃幽灵分数翻倍', () => {
      const engine = createEngine();
      engine.start();
      // Eat first ghost
      const g0 = engine.ghosts[0];
      g0.frightened = true; g0.homeTimer = 0;
      (engine as any)._playerX = g0.x;
      (engine as any)._playerY = g0.y;
      (engine as any).checkCollisions();
      expect(g0.eaten).toBe(true);
      // Eat second ghost
      const g1 = engine.ghosts[1];
      g1.frightened = true; g1.homeTimer = 0;
      (engine as any)._playerX = g1.x;
      (engine as any)._playerY = g1.y;
      const before = engine.score;
      (engine as any).checkCollisions();
      expect(engine.score).toBe(before + GHOST_SCORE * 2);
    });

    it('3 条命全部用完 game over', () => {
      const engine = createEngine();
      engine.start();
      for (let i = 0; i < INITIAL_LIVES; i++) {
        const ghost = engine.ghosts.find(g => !g.eaten && !g.frightened);
        if (ghost) {
          (engine as any)._playerX = ghost.x;
          (engine as any)._playerY = ghost.y;
          (engine as any).checkCollisions();
        }
      }
      expect(engine.status).toBe('gameover');
    });
  });

  // ========== 过关 ==========
  describe('过关', () => {
    it('吃完所有豆子进入下一关', () => {
      const engine = createEngine();
      engine.start();
      // Set dotCount to totalDots
      (engine as any)._dotCount = engine.totalDots;
      engine.update(16);
      expect(engine.level).toBe(2);
    });

    it('过关后迷宫重建', () => {
      const engine = createEngine();
      engine.start();
      (engine as any)._dotCount = engine.totalDots;
      engine.update(16);
      expect(engine.dotCount).toBe(0);
      expect(engine.totalDots).toBeGreaterThan(0);
    });
  });

  // ========== 事件 ==========
  describe('事件', () => {
    it('start 触发 statusChange', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('吃幽灵触发 eatGhost', () => {
      const engine = createEngine();
      engine.start();
      const handler = vi.fn();
      engine.on('eatGhost', handler);
      const ghost = engine.ghosts[0];
      ghost.frightened = true; ghost.homeTimer = 0;
      (engine as any)._playerX = ghost.x;
      (engine as any)._playerY = ghost.y;
      (engine as any).checkCollisions();
      expect(handler).toHaveBeenCalled();
    });

    it('失去生命触发 loseLife', () => {
      const engine = createEngine();
      engine.start();
      const handler = vi.fn();
      engine.on('loseLife', handler);
      const ghost = engine.ghosts[0];
      ghost.homeTimer = 0;
      (engine as any)._playerX = ghost.x;
      (engine as any)._playerY = ghost.y;
      (engine as any).checkCollisions();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ========== getState ==========
  describe('getState', () => {
    it('返回正确的初始状态', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.lives).toBe(INITIAL_LIVES);
      expect(state.dotCount).toBe(0);
    });
  });

  // ========== 重置与销毁 ==========
  describe('重置与销毁', () => {
    it('reset 恢复初始状态', () => {
      const engine = createEngine();
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.lives).toBe(INITIAL_LIVES);
    });

    it('destroy 清理', () => {
      const engine = createEngine();
      engine.start();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });
});
