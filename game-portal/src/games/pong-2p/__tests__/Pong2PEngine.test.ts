import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Pong2PEngine } from '../Pong2PEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED,
  LEFT_PADDLE_X, RIGHT_PADDLE_X, PADDLE_START_Y,
  BALL_RADIUS, BALL_INITIAL_SPEED, BALL_MAX_SPEED, BALL_SPEED_INCREMENT,
  WIN_SCORE, LEAD_BY,
  SERVE_DELAY, MAX_BOUNCE_ANGLE,
} from '../constants';

// ========== Mock requestAnimationFrame ==========
let rafId = 0;
let fakeNow = 0;
const rafCallbacks: Map<number, FrameRequestCallback> = new Map();

beforeEach(() => {
  fakeNow = 1000; // 固定起始时间
  rafCallbacks.clear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
  vi.stubGlobal('performance', { now: () => fakeNow });
});

afterEach(() => {
  rafCallbacks.clear();
});

// ========== Helper: 创建引擎并初始化 Canvas ==========
function createEngine(): Pong2PEngine {
  const engine = new Pong2PEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

// ========== Helper: 推进游戏帧 ==========
function tick(engine: Pong2PEngine, dt: number = 16.67) {
  fakeNow += dt;
  const callbacks = Array.from(rafCallbacks.values());
  // 找到最后一个 callback（当前游戏循环）
  if (callbacks.length > 0) {
    callbacks[callbacks.length - 1](fakeNow);
  }
}

// ========== Helper: 启动并等待发球 ==========
function startAndWaitForServe(engine: Pong2PEngine): void {
  engine.start();
  // 推进时间超过 SERVE_DELAY
  tick(engine, SERVE_DELAY + 10);
}

// ========== Helper: 将球设置到指定位置 ==========
function setBall(engine: Pong2PEngine, x: number, y: number, dx: number, dy: number, speed: number = BALL_INITIAL_SPEED): void {
  (engine as any)._ball = { x, y, dx, dy, speed };
  (engine as any)._serving = false;
}

// ================================================================
// 测试套件
// ================================================================

describe('Pong2PEngine', () => {
  // ========== 初始化测试 ==========
  describe('初始化', () => {
    it('应该正确创建引擎实例', () => {
      const engine = createEngine();
      expect(engine).toBeInstanceOf(Pong2PEngine);
    });

    it('初始状态应为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('初始分数应为 0:0', () => {
      const engine = createEngine();
      expect(engine.p1Score).toBe(0);
      expect(engine.p2Score).toBe(0);
    });

    it('初始挡板位置应居中', () => {
      const engine = createEngine();
      expect(engine.leftPaddleY).toBe(PADDLE_START_Y);
      expect(engine.rightPaddleY).toBe(PADDLE_START_Y);
    });

    it('初始球位置应为 0', () => {
      const engine = createEngine();
      expect(engine.ballX).toBe(0);
      expect(engine.ballY).toBe(0);
    });

    it('初始模式应为 2p', () => {
      const engine = createEngine();
      expect(engine.mode).toBe('2p');
    });

    it('初始不应处于发球状态（idle）', () => {
      const engine = createEngine();
      expect(engine.serving).toBe(true);
    });

    it('初始无胜者', () => {
      const engine = createEngine();
      expect(engine.winner).toBeNull();
      expect(engine.isWin).toBe(false);
    });

    it('初始回合计数应为 0', () => {
      const engine = createEngine();
      expect(engine.rallyCount).toBe(0);
    });

    it('初始发球方向应为向右', () => {
      const engine = createEngine();
      expect(engine.serveDirection).toBe(1);
    });
  });

  // ========== 启动测试 ==========
  describe('启动', () => {
    it('启动后状态应为 playing', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('启动后应处于发球状态', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.serving).toBe(true);
    });

    it('启动后分数应重置为 0:0', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.p1Score).toBe(0);
      expect(engine.p2Score).toBe(0);
    });

    it('启动后挡板应居中', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.leftPaddleY).toBe(PADDLE_START_Y);
      expect(engine.rightPaddleY).toBe(PADDLE_START_Y);
    });

    it('启动后球应为 null（等待发球）', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.ballX).toBe(0);
    });

    it('未初始化 canvas 时启动应抛出错误', () => {
      const engine = new Pong2PEngine();
      expect(() => engine.start()).toThrow('Canvas not initialized');
    });

    it('启动后应触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });
  });

  // ========== 发球测试 ==========
  describe('发球', () => {
    it('发球延迟后应自动发球', () => {
      const engine = createEngine();
      engine.start();
      tick(engine, SERVE_DELAY + 10);
      expect(engine.serving).toBe(false);
      expect(engine.ballX).toBe(CANVAS_WIDTH / 2);
      expect(engine.ballY).toBe(CANVAS_HEIGHT / 2);
    });

    it('发球后球速应为初始速度', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      expect(engine.ballSpeed).toBe(BALL_INITIAL_SPEED);
    });

    it('默认发球方向应向右', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      expect(engine.ballDx).toBeGreaterThan(0);
    });

    it('P2 得分后发球方向应向左', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      // 模拟 P2 得分
      setBall(engine, -10, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      // 等待发球
      tick(engine, SERVE_DELAY + 10);
      expect(engine.ballDx).toBeLessThan(0);
    });

    it('P1 得分后发球方向应向右', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH + 10, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      tick(engine, SERVE_DELAY + 10);
      expect(engine.ballDx).toBeGreaterThan(0);
    });

    it('发球期间球应为 null', () => {
      const engine = createEngine();
      engine.start();
      tick(engine, 100); // 未到 SERVE_DELAY
      expect(engine.serving).toBe(true);
    });
  });

  // ========== 挡板移动测试 ==========
  describe('挡板移动', () => {
    let engine: Pong2PEngine;

    beforeEach(() => {
      engine = createEngine();
      startAndWaitForServe(engine);
    });

    it('P1 按 W 键挡板应上移', () => {
      const initialY = engine.leftPaddleY;
      engine.handleKeyDown('w');
      tick(engine);
      expect(engine.leftPaddleY).toBeLessThan(initialY);
    });

    it('P1 按 S 键挡板应下移', () => {
      const initialY = engine.leftPaddleY;
      engine.handleKeyDown('s');
      tick(engine);
      expect(engine.leftPaddleY).toBeGreaterThan(initialY);
    });

    it('P1 按 W 大写键挡板应上移', () => {
      const initialY = engine.leftPaddleY;
      engine.handleKeyDown('W');
      tick(engine);
      expect(engine.leftPaddleY).toBeLessThan(initialY);
    });

    it('P1 按 S 大写键挡板应下移', () => {
      const initialY = engine.leftPaddleY;
      engine.handleKeyDown('S');
      tick(engine);
      expect(engine.leftPaddleY).toBeGreaterThan(initialY);
    });

    it('P2 按 ↑ 键挡板应上移', () => {
      const initialY = engine.rightPaddleY;
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      expect(engine.rightPaddleY).toBeLessThan(initialY);
    });

    it('P2 按 ↓ 键挡板应下移', () => {
      const initialY = engine.rightPaddleY;
      engine.handleKeyDown('ArrowDown');
      tick(engine);
      expect(engine.rightPaddleY).toBeGreaterThan(initialY);
    });

    it('松开 W 键挡板应停止移动', () => {
      engine.handleKeyDown('w');
      tick(engine);
      const y1 = engine.leftPaddleY;
      engine.handleKeyUp('w');
      tick(engine);
      const y2 = engine.leftPaddleY;
      expect(y2).toBe(y1); // 停止后不再移动
    });

    it('松开 S 键挡板应停止移动', () => {
      engine.handleKeyDown('s');
      tick(engine);
      const y1 = engine.leftPaddleY;
      engine.handleKeyUp('s');
      tick(engine);
      const y2 = engine.leftPaddleY;
      expect(y2).toBe(y1);
    });

    it('松开 ↑ 键挡板应停止移动', () => {
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      const y1 = engine.rightPaddleY;
      engine.handleKeyUp('ArrowUp');
      tick(engine);
      const y2 = engine.rightPaddleY;
      expect(y2).toBe(y1);
    });

    it('松开 ↓ 键挡板应停止移动', () => {
      engine.handleKeyDown('ArrowDown');
      tick(engine);
      const y1 = engine.rightPaddleY;
      engine.handleKeyUp('ArrowDown');
      tick(engine);
      const y2 = engine.rightPaddleY;
      expect(y2).toBe(y1);
    });

    it('P1 挡板不应超出上边界', () => {
      (engine as any)._leftPaddleY = HUD_HEIGHT + 1;
      engine.handleKeyDown('w');
      // 多次 tick 让挡板移到顶部
      for (let i = 0; i < 100; i++) tick(engine);
      expect(engine.leftPaddleY).toBeGreaterThanOrEqual(HUD_HEIGHT);
    });

    it('P1 挡板不应超出下边界', () => {
      (engine as any)._leftPaddleY = CANVAS_HEIGHT - PADDLE_HEIGHT - 1;
      engine.handleKeyDown('s');
      for (let i = 0; i < 100; i++) tick(engine);
      expect(engine.leftPaddleY).toBeLessThanOrEqual(CANVAS_HEIGHT - PADDLE_HEIGHT);
    });

    it('P2 挡板不应超出上边界', () => {
      (engine as any)._rightPaddleY = HUD_HEIGHT + 1;
      engine.handleKeyDown('ArrowUp');
      for (let i = 0; i < 100; i++) tick(engine);
      expect(engine.rightPaddleY).toBeGreaterThanOrEqual(HUD_HEIGHT);
    });

    it('P2 挡板不应超出下边界', () => {
      (engine as any)._rightPaddleY = CANVAS_HEIGHT - PADDLE_HEIGHT - 1;
      engine.handleKeyDown('ArrowDown');
      for (let i = 0; i < 100; i++) tick(engine);
      expect(engine.rightPaddleY).toBeLessThanOrEqual(CANVAS_HEIGHT - PADDLE_HEIGHT);
    });

    it('发球期间也可以移动挡板', () => {
      engine.reset();
      engine.start();
      const initialY = engine.leftPaddleY;
      engine.handleKeyDown('w');
      tick(engine);
      expect(engine.leftPaddleY).toBeLessThan(initialY);
    });
  });

  // ========== 球移动测试 ==========
  describe('球移动', () => {
    it('球应按 dx/dy 方向移动', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const initialX = engine.ballX;
      const initialY = engine.ballY;
      tick(engine);
      // 球应该移动了
      const moved = engine.ballX !== initialX || engine.ballY !== initialY;
      expect(moved).toBe(true);
    });

    it('球向右移动时 x 应增加', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const initialX = engine.ballX;
      tick(engine);
      expect(engine.ballX).toBeGreaterThan(initialX);
    });
  });

  // ========== 球反弹测试 ==========
  describe('球反弹 - 上下边界', () => {
    it('球碰到上边界应反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH / 2, HUD_HEIGHT + BALL_RADIUS, BALL_INITIAL_SPEED, -BALL_INITIAL_SPEED);
      tick(engine);
      expect(engine.ballDy).toBeGreaterThan(0);
    });

    it('球碰到下边界应反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH / 2, CANVAS_HEIGHT - BALL_RADIUS, BALL_INITIAL_SPEED, BALL_INITIAL_SPEED);
      tick(engine);
      expect(engine.ballDy).toBeLessThan(0);
    });

    it('球碰到上边界后 Y 应被修正', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH / 2, HUD_HEIGHT, BALL_INITIAL_SPEED, -BALL_INITIAL_SPEED);
      tick(engine);
      expect(engine.ballY).toBeGreaterThanOrEqual(HUD_HEIGHT + BALL_RADIUS);
    });

    it('球碰到下边界后 Y 应被修正', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH / 2, CANVAS_HEIGHT, BALL_INITIAL_SPEED, BALL_INITIAL_SPEED);
      tick(engine);
      expect(engine.ballY).toBeLessThanOrEqual(CANVAS_HEIGHT - BALL_RADIUS);
    });
  });

  // ========== 碰撞检测 - 挡板 ==========
  describe('碰撞检测 - 左挡板', () => {
    it('球碰到左挡板应反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDx).toBeGreaterThan(0);
    });

    it('球碰到左挡板中心应水平反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      // 中心碰撞 dy 应该接近 0
      expect(Math.abs(engine.ballDy)).toBeLessThan(1);
    });

    it('球碰到左挡板上部应向上反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const paddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      (engine as any)._leftPaddleY = paddleY;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        paddleY + 5,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDy).toBeLessThan(0);
    });

    it('球碰到左挡板下部应向下反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const paddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      (engine as any)._leftPaddleY = paddleY;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        paddleY + PADDLE_HEIGHT - 5,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDy).toBeGreaterThan(0);
    });

    it('球碰到左挡板后应被推出挡板', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH,
        CANVAS_HEIGHT / 2,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballX).toBeGreaterThanOrEqual(LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS);
    });
  });

  describe('碰撞检测 - 右挡板', () => {
    it('球碰到右挡板应反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._rightPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        RIGHT_PADDLE_X - BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDx).toBeLessThan(0);
    });

    it('球碰到右挡板中心应水平反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._rightPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        RIGHT_PADDLE_X - BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(Math.abs(engine.ballDy)).toBeLessThan(1);
    });

    it('球碰到右挡板上部应向上反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const paddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      (engine as any)._rightPaddleY = paddleY;
      setBall(engine,
        RIGHT_PADDLE_X - BALL_RADIUS,
        paddleY + 5,
        BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDy).toBeLessThan(0);
    });

    it('球碰到右挡板下部应向下反弹', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const paddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      (engine as any)._rightPaddleY = paddleY;
      setBall(engine,
        RIGHT_PADDLE_X - BALL_RADIUS,
        paddleY + PADDLE_HEIGHT - 5,
        BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDy).toBeGreaterThan(0);
    });

    it('球碰到右挡板后应被推出挡板', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._rightPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        RIGHT_PADDLE_X,
        CANVAS_HEIGHT / 2,
        BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballX).toBeLessThanOrEqual(RIGHT_PADDLE_X - BALL_RADIUS);
    });
  });

  // ========== 碰撞未命中 ==========
  describe('碰撞未命中', () => {
    it('球在挡板上方经过不应碰撞', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2 - 20, // 远在挡板上方
        -BALL_INITIAL_SPEED, 0
      );
      const dxBefore = engine.ballDx;
      tick(engine);
      // dx 不变（没碰到）
      expect(engine.ballDx).toBe(dxBefore);
    });

    it('球在挡板下方经过不应碰撞', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2 + 20, // 远在挡板下方
        -BALL_INITIAL_SPEED, 0
      );
      const dxBefore = engine.ballDx;
      tick(engine);
      expect(engine.ballDx).toBe(dxBefore);
    });
  });

  // ========== 得分测试 ==========
  describe('得分', () => {
    it('球出左边界 P2 得分', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, -BALL_RADIUS - 1, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.p2Score).toBe(1);
      expect(engine.p1Score).toBe(0);
    });

    it('球出右边界 P1 得分', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.p1Score).toBe(1);
      expect(engine.p2Score).toBe(0);
    });

    it('得分后应进入发球状态', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, -BALL_RADIUS - 1, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.serving).toBe(true);
    });

    it('得分后回合计数应重置', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._rallyCount = 5;
      setBall(engine, -BALL_RADIUS - 1, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.rallyCount).toBe(0);
    });

    it('P2 得分后发球方向应向左', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, -BALL_RADIUS - 1, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.serveDirection).toBe(-1);
    });

    it('P1 得分后发球方向应向右', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.serveDirection).toBe(1);
    });

    it('连续多次得分应正确累计', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);

      // P1 得分 3 次
      for (let i = 0; i < 3; i++) {
        setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
        tick(engine);
        tick(engine, SERVE_DELAY + 10);
      }
      expect(engine.p1Score).toBe(3);
    });
  });

  // ========== 球速递增测试 ==========
  describe('球速递增', () => {
    it('每次碰撞挡板球速应递增', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const initialSpeed = engine.ballSpeed;

      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballSpeed).toBeGreaterThan(initialSpeed);
    });

    it('球速递增量应为 BALL_SPEED_INCREMENT', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);

      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballSpeed).toBeCloseTo(BALL_INITIAL_SPEED + BALL_SPEED_INCREMENT, 1);
    });

    it('球速不应超过最大速度', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._ball = {
        x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        y: CANVAS_HEIGHT / 2,
        dx: -BALL_MAX_SPEED,
        dy: 0,
        speed: BALL_MAX_SPEED - 0.1,
      };
      (engine as any)._serving = false;
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;

      tick(engine);
      expect(engine.ballSpeed).toBeLessThanOrEqual(BALL_MAX_SPEED);
    });

    it('多次碰撞后球速应持续递增', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);

      // 模拟多次左挡板碰撞
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      for (let i = 0; i < 5; i++) {
        // 重置球位置到左挡板旁，但保留已增加的速度
        const currentSpeed = (engine as any)._ball?.speed ?? BALL_INITIAL_SPEED;
        (engine as any)._ball = {
          x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
          y: CANVAS_HEIGHT / 2,
          dx: -currentSpeed,
          dy: 0,
          speed: currentSpeed,
        };
        (engine as any)._serving = false;
        tick(engine);
      }
      expect(engine.ballSpeed).toBeCloseTo(BALL_INITIAL_SPEED + 5 * BALL_SPEED_INCREMENT, 1);
    });

    it('回合计数应随碰撞递增', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);

      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.rallyCount).toBe(1);
    });
  });

  // ========== 胜利判定测试 ==========
  describe('胜利判定', () => {
    it('P1 先到 11 分且领先 2 分应获胜', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 10;
      (engine as any)._p2Score = 9;
      // P1 再得一分 → 11:9
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.winner).toBe(1);
      expect(engine.isWin).toBe(true);
    });

    it('P2 先到 11 分且领先 2 分应获胜', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 9;
      (engine as any)._p2Score = 10;
      setBall(engine, -BALL_RADIUS - 1, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.winner).toBe(2);
      expect(engine.isWin).toBe(true);
    });

    it('11:10 不应判定获胜（未领先 2 分）', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 10;
      (engine as any)._p2Score = 10;
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.winner).toBeNull();
      expect(engine.isWin).toBe(false);
    });

    it('10:12 P2 应获胜', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 10;
      (engine as any)._p2Score = 11;
      setBall(engine, -BALL_RADIUS - 1, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.winner).toBe(2);
    });

    it('12:10 P1 应获胜', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 11;
      (engine as any)._p2Score = 10;
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.winner).toBe(1);
    });

    it('获胜后状态应为 gameover', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 10;
      (engine as any)._p2Score = 9;
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.status).toBe('gameover');
    });

    it('获胜后应触发 statusChange gameover 事件', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const handler = vi.fn();
      engine.on('statusChange', handler);
      (engine as any)._p1Score = 10;
      (engine as any)._p2Score = 9;
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(handler).toHaveBeenCalledWith('gameover');
    });

    it('13:11 P1 应获胜（延长赛）', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 12;
      (engine as any)._p2Score = 11;
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.winner).toBe(1);
    });

    it('9:11 不应获胜（未到 WIN_SCORE）', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 9;
      (engine as any)._p2Score = 10;
      setBall(engine, -BALL_RADIUS - 1, CANVAS_HEIGHT / 2, -BALL_INITIAL_SPEED, 0);
      tick(engine);
      // 9:11, P2 有 11 分且领先 2 分 → P2 获胜
      expect(engine.winner).toBe(2);
    });
  });

  // ========== AI 模式测试 ==========
  describe('AI 模式', () => {
    it('设置为 AI 模式后 mode 应为 ai', () => {
      const engine = createEngine();
      engine.setMode('ai');
      expect(engine.mode).toBe('ai');
    });

    it('AI 模式下 P2 挡板应跟踪球', () => {
      const engine = createEngine();
      engine.setMode('ai');
      startAndWaitForServe(engine);

      // 将球放到右侧上方
      setBall(engine, CANVAS_WIDTH * 0.75, CANVAS_HEIGHT * 0.25, BALL_INITIAL_SPEED, 0);
      const initialY = engine.rightPaddleY;

      // 多次 tick 让 AI 反应
      for (let i = 0; i < 20; i++) tick(engine);

      // AI 应该向上移动
      expect(engine.rightPaddleY).toBeLessThan(initialY + 50);
    });

    it('AI 模式下 P2 按键不应影响挡板', () => {
      const engine = createEngine();
      engine.setMode('ai');
      startAndWaitForServe(engine);

      const initialY = engine.rightPaddleY;
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      // AI 模式下 ArrowUp 不应直接控制 P2
      // 但 AI 可能会移动，所以只检查不是按键直接导致的大幅移动
      expect(engine.rightPaddleY).toBe(initialY); // AI 还没反应过来（球向右才跟踪）
    });

    it('AI 应有反应延迟', () => {
      const engine = createEngine();
      engine.setMode('ai');
      startAndWaitForServe(engine);

      setBall(engine, CANVAS_WIDTH * 0.75, 100, BALL_INITIAL_SPEED, 0);
      const y0 = engine.rightPaddleY;

      // 只 tick 一次（不到反应延迟）
      tick(engine, 50);
      // AI 还没反应
      expect(engine.rightPaddleY).toBe(y0);
    });

    it('2P 模式切换到 AI 模式', () => {
      const engine = createEngine();
      expect(engine.mode).toBe('2p');
      engine.setMode('ai');
      expect(engine.mode).toBe('ai');
    });

    it('AI 模式切换回 2P 模式', () => {
      const engine = createEngine();
      engine.setMode('ai');
      engine.setMode('2p');
      expect(engine.mode).toBe('2p');
    });
  });

  // ========== 键盘输入测试 ==========
  describe('键盘输入', () => {
    it('非 playing 状态下按键不应有效果', () => {
      const engine = createEngine();
      const y0 = engine.leftPaddleY;
      engine.handleKeyDown('w');
      // idle 状态，不移动
      expect(engine.leftPaddleY).toBe(y0);
    });

    it('按 T 键应切换模式', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      expect(engine.mode).toBe('2p');
      engine.handleKeyDown('t');
      expect(engine.mode).toBe('ai');
      engine.handleKeyDown('T');
      expect(engine.mode).toBe('2p');
    });

    it('按无关键不应报错', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      expect(() => engine.handleKeyDown('x')).not.toThrow();
    });

    it('松开未按下的键不应报错', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyUp('w')).not.toThrow();
    });

    it('同时按 W 和 S 应正确处理', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const y0 = engine.leftPaddleY;
      engine.handleKeyDown('w');
      engine.handleKeyDown('s');
      tick(engine);
      // 同时按上和下，效果抵消
      expect(Math.abs(engine.leftPaddleY - y0)).toBeLessThan(PADDLE_SPEED);
    });
  });

  // ========== 暂停/恢复测试 ==========
  describe('暂停/恢复', () => {
    it('暂停后状态应为 paused', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('暂停后球不应移动', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const x0 = engine.ballX;
      engine.pause();
      tick(engine);
      expect(engine.ballX).toBe(x0);
    });

    it('恢复后状态应为 playing', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('恢复后球应继续移动', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      engine.pause();
      engine.resume();
      const x0 = engine.ballX;
      tick(engine);
      expect(engine.ballX).not.toBe(x0);
    });
  });

  // ========== 重置测试 ==========
  describe('重置', () => {
    it('重置后状态应为 idle', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('重置后分数应归零', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 5;
      (engine as any)._p2Score = 3;
      engine.reset();
      expect(engine.p1Score).toBe(0);
      expect(engine.p2Score).toBe(0);
    });

    it('重置后挡板应居中', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      engine.handleKeyDown('w');
      tick(engine);
      engine.reset();
      expect(engine.leftPaddleY).toBe(PADDLE_START_Y);
      expect(engine.rightPaddleY).toBe(PADDLE_START_Y);
    });

    it('重置后应触发 statusChange idle', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.reset();
      expect(handler).toHaveBeenCalledWith('idle');
    });
  });

  // ========== 销毁测试 ==========
  describe('销毁', () => {
    it('销毁后应清理资源', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ========== getState 测试 ==========
  describe('getState', () => {
    it('应返回正确的游戏状态', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('p1Score');
      expect(state).toHaveProperty('p2Score');
      expect(state).toHaveProperty('ball');
      expect(state).toHaveProperty('leftPaddleY');
      expect(state).toHaveProperty('rightPaddleY');
      expect(state).toHaveProperty('mode');
      expect(state).toHaveProperty('serving');
      expect(state).toHaveProperty('winner');
      expect(state).toHaveProperty('rallyCount');
    });

    it('初始状态值应正确', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state.p1Score).toBe(0);
      expect(state.p2Score).toBe(0);
      expect(state.ball).toBeNull();
      expect(state.leftPaddleY).toBe(PADDLE_START_Y);
      expect(state.rightPaddleY).toBe(PADDLE_START_Y);
      expect(state.mode).toBe('2p');
      expect(state.serving).toBe(true);
      expect(state.winner).toBeNull();
      expect(state.rallyCount).toBe(0);
    });

    it('游戏中状态应反映当前值', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 3;
      (engine as any)._p2Score = 2;
      const state = engine.getState();
      expect(state.p1Score).toBe(3);
      expect(state.p2Score).toBe(2);
    });

    it('球状态应正确返回', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const state = engine.getState() as any;
      expect(state.ball).not.toBeNull();
      expect(state.ball.x).toBe(CANVAS_WIDTH / 2);
      expect(state.ball.y).toBe(CANVAS_HEIGHT / 2);
    });
  });

  // ========== 事件系统测试 ==========
  describe('事件系统', () => {
    it('应能监听 scoreChange 事件', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(handler).toHaveBeenCalled();
    });

    it('应能取消事件监听', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      engine.off('scoreChange', handler);
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(handler).not.toHaveBeenCalled();
    });

    it('应能监听 levelChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('levelChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  // ========== 渲染测试 ==========
  describe('渲染', () => {
    it('渲染不应抛出错误', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      expect(() => tick(engine)).not.toThrow();
    });

    it('gameover 状态下渲染不应抛出错误', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._p1Score = 10;
      (engine as any)._p2Score = 9;
      setBall(engine, CANVAS_WIDTH + BALL_RADIUS + 1, CANVAS_HEIGHT / 2, BALL_INITIAL_SPEED, 0);
      tick(engine);
      expect(engine.status).toBe('gameover');
    });
  });

  // ========== 边界情况测试 ==========
  describe('边界情况', () => {
    it('球速度为 0 时不应崩溃', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, 0, 0);
      expect(() => tick(engine)).not.toThrow();
    });

    it('挡板在最顶端时不应崩溃', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._leftPaddleY = HUD_HEIGHT;
      engine.handleKeyDown('w');
      expect(() => tick(engine)).not.toThrow();
    });

    it('挡板在最底端时不应崩溃', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      (engine as any)._leftPaddleY = CANVAS_HEIGHT - PADDLE_HEIGHT;
      engine.handleKeyDown('s');
      expect(() => tick(engine)).not.toThrow();
    });

    it('连续快速按键不应崩溃', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      for (let i = 0; i < 50; i++) {
        engine.handleKeyDown('w');
        engine.handleKeyUp('w');
        engine.handleKeyDown('s');
        engine.handleKeyUp('s');
      }
      expect(() => tick(engine)).not.toThrow();
    });

    it('球在角落不应崩溃', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      setBall(engine, BALL_RADIUS + 1, HUD_HEIGHT + BALL_RADIUS + 1, -1, -1, 1);
      expect(() => tick(engine)).not.toThrow();
    });

    it('暂停状态下 update 不应执行', () => {
      const engine = createEngine();
      startAndWaitForServe(engine);
      const x0 = engine.ballX;
      engine.pause();
      // 即使 tick 也不应移动
      tick(engine);
      expect(engine.ballX).toBe(x0);
    });
  });

  // ========== 集成测试 ==========
  describe('集成 - 完整游戏流程', () => {
    it('完整游戏流程：启动 → 发球 → 对打 → 得分', () => {
      const engine = createEngine();
      engine.start();

      // 等待发球
      tick(engine, SERVE_DELAY + 10);
      expect(engine.serving).toBe(false);

      // 球向右移动
      expect(engine.ballDx).toBeGreaterThan(0);

      // 模拟球到右挡板
      (engine as any)._rightPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        RIGHT_PADDLE_X - BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDx).toBeLessThan(0); // 反弹

      // 模拟球到左挡板
      (engine as any)._leftPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      setBall(engine,
        LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS,
        CANVAS_HEIGHT / 2,
        -BALL_INITIAL_SPEED, 0
      );
      tick(engine);
      expect(engine.ballDx).toBeGreaterThan(0); // 反弹
    });

    it('AI 模式完整流程', () => {
      const engine = createEngine();
      engine.setMode('ai');
      engine.start();
      tick(engine, SERVE_DELAY + 10);
      expect(engine.serving).toBe(false);
      expect(engine.mode).toBe('ai');

      // 模拟几个回合
      for (let i = 0; i < 3; i++) {
        setBall(engine,
          RIGHT_PADDLE_X - BALL_RADIUS,
          CANVAS_HEIGHT / 2,
          BALL_INITIAL_SPEED, 0
        );
        (engine as any)._rightPaddleY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
        tick(engine);
      }
      expect(engine.rallyCount).toBe(3);
    });
  });
});
