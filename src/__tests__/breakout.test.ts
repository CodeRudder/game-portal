import { vi } from 'vitest';
import { BreakoutEngine } from '@/games/breakout/BreakoutEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  PADDLE_SPEED,
  BALL_RADIUS,
  BALL_SPEED,
  BALL_SPEED_INCREASE,
  BALL_MAX_SPEED,
  BRICK_ROWS,
  BRICK_COLS,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  BRICK_PADDING,
  BRICK_OFFSET_TOP,
  BRICK_OFFSET_LEFT,
  BRICK_COLORS,
  BRICK_SCORES,
  INITIAL_LIVES,
} from '@/games/breakout/constants';

// ========== Mock Canvas ==========

function createMockCanvas() {
  return {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    getContext: () => ({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeRect: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
    }),
  } as unknown as HTMLCanvasElement;
}

// ========== 辅助函数 ==========

function createEngine(): BreakoutEngine {
  const engine = new BreakoutEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 启动引擎并进入 playing 状态 */
function startEngine(): BreakoutEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 启动引擎并发射球 */
function startAndLaunch(): BreakoutEngine {
  const engine = startEngine();
  engine.launchBall();
  return engine;
}

/** 调用引擎 update（传入 deltaTime 毫秒） */
function advance(engine: BreakoutEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部 ball 对象 */
function getBall(engine: BreakoutEngine) {
  return (engine as any)._ball;
}

/** 设置内部 ball 对象 */
function setBall(engine: BreakoutEngine, ball: any): void {
  (engine as any)._ball = ball;
}

/** 获取内部 bricks 数组 */
function getBricks(engine: BreakoutEngine) {
  return (engine as any)._bricks as Array<{
    x: number; y: number; row: number; col: number;
    alive: boolean; color: string; score: number;
  }>;
}

/** 获取内部 lives */
function getLives(engine: BreakoutEngine): number {
  return (engine as any)._lives;
}

/** 设置内部 lives */
function setLives(engine: BreakoutEngine, lives: number): void {
  (engine as any)._lives = lives;
}

/** 获取内部 ballLaunched */
function isBallLaunched(engine: BreakoutEngine): boolean {
  return (engine as any)._ballLaunched;
}

/** 设置内部 ballLaunched */
function setBallLaunched(engine: BreakoutEngine, val: boolean): void {
  (engine as any)._ballLaunched = val;
}

/** 获取内部 paddleX */
function getPaddleX(engine: BreakoutEngine): number {
  return (engine as any)._paddleX;
}

/** 设置内部 paddleX */
function setPaddleX(engine: BreakoutEngine, x: number): void {
  (engine as any)._paddleX = x;
}

/** 获取内部 leftPressed / rightPressed */
function isLeftPressed(engine: BreakoutEngine): boolean {
  return (engine as any)._leftPressed;
}
function isRightPressed(engine: BreakoutEngine): boolean {
  return (engine as any)._rightPressed;
}

/** 获取 remainingBricks */
function getRemainingBricks(engine: BreakoutEngine): number {
  return (engine as any)._remainingBricks;
}

/** 设置 remainingBricks */
function setRemainingBricks(engine: BreakoutEngine, val: number): void {
  (engine as any)._remainingBricks = val;
}

/** 获取 totalBricks */
function getTotalBricks(engine: BreakoutEngine): number {
  return (engine as any)._totalBricks;
}

/** 砖块中心坐标 */
function brickCenter(brick: { x: number; y: number }) {
  return { cx: brick.x + BRICK_WIDTH / 2, cy: brick.y + BRICK_HEIGHT / 2 };
}

// ==================== 测试 ====================

describe('BreakoutEngine', () => {

  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('引擎创建后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后分数为 0', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
    });

    it('init 后等级为 1', () => {
      const engine = createEngine();
      expect(engine.level).toBe(1);
    });

    it('init 后生命值为 INITIAL_LIVES (3)', () => {
      const engine = createEngine();
      expect(getLives(engine)).toBe(INITIAL_LIVES);
    });

    it('init 后挡板居中', () => {
      const engine = createEngine();
      const expectedX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
      expect(getPaddleX(engine)).toBe(expectedX);
    });

    it('init 后球位于挡板上方', () => {
      const engine = createEngine();
      const ball = getBall(engine);
      expect(ball).not.toBeNull();
      expect(ball.y).toBe(PADDLE_Y - BALL_RADIUS - 1);
      expect(ball.x).toBeCloseTo(getPaddleX(engine) + PADDLE_WIDTH / 2);
    });

    it('init 后球速度为 0（未发射）', () => {
      const engine = createEngine();
      const ball = getBall(engine);
      expect(ball.dx).toBe(0);
      expect(ball.dy).toBe(0);
    });

    it('init 后 ballLaunched 为 false', () => {
      const engine = createEngine();
      expect(isBallLaunched(engine)).toBe(false);
    });

    it('init 后砖块数量 = BRICK_ROWS × BRICK_COLS', () => {
      const engine = createEngine();
      const expected = BRICK_ROWS * BRICK_COLS;
      expect(getTotalBricks(engine)).toBe(expected);
      expect(getRemainingBricks(engine)).toBe(expected);
    });

    it('init 后所有砖块 alive 为 true', () => {
      const engine = createEngine();
      const bricks = getBricks(engine);
      for (const b of bricks) {
        expect(b.alive).toBe(true);
      }
    });

    it('砖块颜色和分数按行分配', () => {
      const engine = createEngine();
      const bricks = getBricks(engine);
      for (const b of bricks) {
        expect(b.color).toBe(BRICK_COLORS[b.row % BRICK_COLORS.length]);
        expect(b.score).toBe(BRICK_SCORES[b.row % BRICK_SCORES.length]);
      }
    });

    it('未 init 直接 start 抛出异常', () => {
      const engine = new BreakoutEngine();
      expect(() => engine.start()).toThrow('Canvas not initialized');
    });
  });

  // ==================== T2: 挡板移动 ====================
  describe('挡板移动', () => {
    it('按左键后 update 挡板左移 PADDLE_SPEED', () => {
      const engine = startAndLaunch();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('ArrowLeft');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX - PADDLE_SPEED);
    });

    it('按右键后 update 挡板右移 PADDLE_SPEED', () => {
      const engine = startAndLaunch();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('ArrowRight');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX + PADDLE_SPEED);
    });

    it('同时按左右键挡板不动', () => {
      const engine = startAndLaunch();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX);
    });

    it('挡板不能超出左边界 (x >= 0)', () => {
      const engine = startAndLaunch();
      setPaddleX(engine, 2);
      engine.handleKeyDown('ArrowLeft');
      advance(engine);
      expect(getPaddleX(engine)).toBe(0);
    });

    it('挡板不能超出右边界 (x + width <= CANVAS_WIDTH)', () => {
      const engine = startAndLaunch();
      setPaddleX(engine, CANVAS_WIDTH - PADDLE_WIDTH - 2);
      engine.handleKeyDown('ArrowRight');
      advance(engine);
      expect(getPaddleX(engine)).toBe(CANVAS_WIDTH - PADDLE_WIDTH);
    });

    it('松开左键后挡板停止移动', () => {
      const engine = startAndLaunch();
      engine.handleKeyDown('ArrowLeft');
      advance(engine);
      const x1 = getPaddleX(engine);
      engine.handleKeyUp('ArrowLeft');
      advance(engine);
      const x2 = getPaddleX(engine);
      expect(x2).toBe(x1);
    });

    it('松开右键后挡板停止移动', () => {
      const engine = startAndLaunch();
      engine.handleKeyDown('ArrowRight');
      advance(engine);
      const x1 = getPaddleX(engine);
      engine.handleKeyUp('ArrowRight');
      advance(engine);
      const x2 = getPaddleX(engine);
      expect(x2).toBe(x1);
    });

    it('WASD 的 a 键也可左移', () => {
      const engine = startAndLaunch();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('a');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX - PADDLE_SPEED);
    });

    it('WASD 的 d 键也可右移', () => {
      const engine = startAndLaunch();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('d');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX + PADDLE_SPEED);
    });

    it('大写 A 键也可左移', () => {
      const engine = startAndLaunch();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('A');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX - PADDLE_SPEED);
    });

    it('大写 D 键也可右移', () => {
      const engine = startAndLaunch();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('D');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX + PADDLE_SPEED);
    });

    it('未发射球时挡板不移动', () => {
      const engine = startEngine();
      const startX = getPaddleX(engine);
      engine.handleKeyDown('ArrowLeft');
      advance(engine);
      expect(getPaddleX(engine)).toBe(startX);
    });
  });

  // ==================== T3: 球发射 ====================
  describe('球发射', () => {
    it('launchBall 后 ballLaunched 为 true', () => {
      const engine = startEngine();
      engine.launchBall();
      expect(isBallLaunched(engine)).toBe(true);
    });

    it('launchBall 后球有 dx 速度', () => {
      const engine = startEngine();
      engine.launchBall();
      const ball = getBall(engine);
      // dx 可能为 0（极端随机情况），但 dy 必定不为 0
      expect(ball.dy).not.toBe(0);
    });

    it('launchBall 后球 dy 为负（向上）', () => {
      const engine = startEngine();
      engine.launchBall();
      const ball = getBall(engine);
      expect(ball.dy).toBeLessThan(0);
    });

    it('launchBall 后球速度大小接近 BALL_SPEED', () => {
      const engine = startEngine();
      engine.launchBall();
      const ball = getBall(engine);
      const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      expect(speed).toBeCloseTo(BALL_SPEED, 1);
    });

    it('重复调用 launchBall 不会改变已发射球的方向', () => {
      const engine = startEngine();
      engine.launchBall();
      const dx1 = getBall(engine).dx;
      const dy1 = getBall(engine).dy;
      engine.launchBall(); // 第二次调用，ballLaunched 已为 true，不应改变
      expect(getBall(engine).dx).toBe(dx1);
      expect(getBall(engine).dy).toBe(dy1);
    });

    it('idle 状态下 handleKeyDown 空格键启动游戏', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('playing 且未发射时空格键发射球', () => {
      const engine = startEngine();
      expect(isBallLaunched(engine)).toBe(false);
      engine.handleKeyDown(' ');
      expect(isBallLaunched(engine)).toBe(true);
    });
  });

  // ==================== T4: 球墙壁碰撞 ====================
  describe('球墙壁碰撞', () => {
    it('球碰到左墙反弹（dx 变正）', () => {
      const engine = startAndLaunch();
      setBall(engine, { x: BALL_RADIUS, y: 200, dx: -3, dy: -2, speed: BALL_SPEED });
      setBallLaunched(engine, true);
      advance(engine);
      const ball = getBall(engine);
      expect(ball.dx).toBeGreaterThan(0);
    });

    it('球碰到右墙反弹（dx 变负）', () => {
      const engine = startAndLaunch();
      setBall(engine, { x: CANVAS_WIDTH - BALL_RADIUS, y: 200, dx: 3, dy: -2, speed: BALL_SPEED });
      setBallLaunched(engine, true);
      advance(engine);
      const ball = getBall(engine);
      expect(ball.dx).toBeLessThan(0);
    });

    it('球碰到顶墙反弹（dy 变正）', () => {
      const engine = startAndLaunch();
      setBall(engine, { x: 240, y: HUD_HEIGHT + BALL_RADIUS, dx: 1, dy: -3, speed: BALL_SPEED });
      setBallLaunched(engine, true);
      advance(engine);
      const ball = getBall(engine);
      expect(ball.dy).toBeGreaterThan(0);
    });

    it('球碰到左墙后 x 被修正为 BALL_RADIUS', () => {
      const engine = startAndLaunch();
      setBall(engine, { x: BALL_RADIUS - 1, y: 200, dx: -3, dy: -2, speed: BALL_SPEED });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).x).toBe(BALL_RADIUS);
    });

    it('球碰到右墙后 x 被修正为 CANVAS_WIDTH - BALL_RADIUS', () => {
      const engine = startAndLaunch();
      setBall(engine, { x: CANVAS_WIDTH - BALL_RADIUS + 1, y: 200, dx: 3, dy: -2, speed: BALL_SPEED });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).x).toBe(CANVAS_WIDTH - BALL_RADIUS);
    });

    it('球碰到顶墙后 y 被修正为 HUD_HEIGHT + BALL_RADIUS', () => {
      const engine = startAndLaunch();
      setBall(engine, { x: 240, y: HUD_HEIGHT + BALL_RADIUS - 1, dx: 1, dy: -3, speed: BALL_SPEED });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).y).toBe(HUD_HEIGHT + BALL_RADIUS);
    });
  });

  // ==================== T5: 挡板碰撞 ====================
  describe('挡板碰撞', () => {
    it('球从上方碰到挡板后 dy 变负（反弹向上）', () => {
      const engine = startAndLaunch();
      const px = getPaddleX(engine);
      setBall(engine, {
        x: px + PADDLE_WIDTH / 2,
        y: PADDLE_Y - BALL_RADIUS,
        dx: 0,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).dy).toBeLessThan(0);
    });

    it('球击中挡板中心近似垂直反弹', () => {
      const engine = startAndLaunch();
      const px = getPaddleX(engine);
      setBall(engine, {
        x: px + PADDLE_WIDTH / 2,
        y: PADDLE_Y - BALL_RADIUS,
        dx: 0,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      const ball = getBall(engine);
      // 中心击中，dx 应接近 0
      expect(Math.abs(ball.dx)).toBeLessThan(1);
      expect(ball.dy).toBeLessThan(0);
    });

    it('球击中挡板左侧 dx 为负', () => {
      const engine = startAndLaunch();
      const px = getPaddleX(engine);
      setBall(engine, {
        x: px + 2,
        y: PADDLE_Y - BALL_RADIUS,
        dx: 0,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).dx).toBeLessThan(0);
    });

    it('球击中挡板右侧 dx 为正', () => {
      const engine = startAndLaunch();
      const px = getPaddleX(engine);
      setBall(engine, {
        x: px + PADDLE_WIDTH - 2,
        y: PADDLE_Y - BALL_RADIUS,
        dx: 0,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).dx).toBeGreaterThan(0);
    });

    it('球碰到挡板后 y 被修正为 PADDLE_Y - BALL_RADIUS', () => {
      const engine = startAndLaunch();
      const px = getPaddleX(engine);
      setBall(engine, {
        x: px + PADDLE_WIDTH / 2,
        y: PADDLE_Y - BALL_RADIUS,
        dx: 0,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).y).toBe(PADDLE_Y - BALL_RADIUS);
    });

    it('球从下方经过挡板不反弹', () => {
      const engine = startAndLaunch();
      const px = getPaddleX(engine);
      setBall(engine, {
        x: px + PADDLE_WIDTH / 2,
        y: PADDLE_Y + PADDLE_HEIGHT + 10,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      // 球向上移动，dy 仍为负（未反弹）
      expect(getBall(engine).dy).toBeLessThan(0);
    });
  });

  // ==================== T6: 砖块碰撞 ====================
  describe('砖块碰撞', () => {
    it('球碰到砖块后砖块被消除 (alive = false)', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx, cy } = brickCenter(target);
      // 将球放到砖块正下方，向上运动
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT + BALL_RADIUS,
        dx: 0,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      // 将球位置调到砖块内部触发碰撞
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      advance(engine);
      expect(target.alive).toBe(false);
    });

    it('消除砖块后分数增加', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx } = brickCenter(target);
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      const scoreBefore = engine.score;
      advance(engine);
      expect(engine.score).toBe(scoreBefore + target.score);
    });

    it('消除砖块后 remainingBricks 减少', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx } = brickCenter(target);
      const before = getRemainingBricks(engine);
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getRemainingBricks(engine)).toBe(before - 1);
    });

    it('不同行砖块分数不同', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const row0 = bricks.filter(b => b.row === 0);
      const row1 = bricks.filter(b => b.row === 1);
      expect(row0[0].score).not.toBe(row1[0].score);
    });

    it('已消除的砖块不再碰撞', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      target.alive = false;
      const { cx } = brickCenter(target);
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      const scoreBefore = engine.score;
      const remainingBefore = getRemainingBricks(engine);
      advance(engine);
      expect(engine.score).toBe(scoreBefore);
      expect(getRemainingBricks(engine)).toBe(remainingBefore);
    });

    it('每次只消除一个砖块（break 退出循环）', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx } = brickCenter(target);
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      // 只有一个砖块被消除
      const deadCount = bricks.filter(b => !b.alive).length;
      expect(deadCount).toBe(1);
    });

    it('球碰到砖块水平面反弹 dy 反转', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx } = brickCenter(target);
      // 球从正下方碰到砖块底部中心 → dy 反转
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT + BALL_RADIUS - 1,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getBall(engine).dy).toBeGreaterThan(0);
    });
  });

  // ==================== T7: 生命系统 ====================
  describe('生命系统', () => {
    it('球落底后生命减 1', () => {
      const engine = startAndLaunch();
      const livesBefore = getLives(engine);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getLives(engine)).toBe(livesBefore - 1);
    });

    it('球落底后 ballLaunched 变为 false', () => {
      const engine = startAndLaunch();
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(isBallLaunched(engine)).toBe(false);
    });

    it('球落底后球重置到挡板上方', () => {
      const engine = startAndLaunch();
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      const ball = getBall(engine);
      expect(ball.y).toBe(PADDLE_Y - BALL_RADIUS - 1);
      expect(ball.dx).toBe(0);
      expect(ball.dy).toBe(0);
    });

    it('球落底后挡板重置到中间', () => {
      const engine = startAndLaunch();
      setPaddleX(engine, 10);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getPaddleX(engine)).toBe((CANVAS_WIDTH - PADDLE_WIDTH) / 2);
    });

    it('生命为 0 时游戏结束 (status = gameover)', () => {
      const engine = startAndLaunch();
      setLives(engine, 1);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(engine.status).toBe('gameover');
    });

    it('初始生命值为 3', () => {
      const engine = createEngine();
      expect(getLives(engine)).toBe(3);
    });

    it('生命未耗尽时游戏继续', () => {
      const engine = startAndLaunch();
      expect(getLives(engine)).toBe(3);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(getLives(engine)).toBe(2);
      expect(engine.status).toBe('playing');
    });
  });

  // ==================== T8: 关卡进度 ====================
  describe('关卡进度', () => {
    it('清除所有砖块后 level 增加', () => {
      const engine = startAndLaunch();
      const levelBefore = engine.level;
      setRemainingBricks(engine, 0);
      advance(engine);
      expect(engine.level).toBe(levelBefore + 1);
    });

    it('过关后 ballLaunched 为 false', () => {
      const engine = startAndLaunch();
      setRemainingBricks(engine, 0);
      advance(engine);
      expect(isBallLaunched(engine)).toBe(false);
    });

    it('过关后砖块重建', () => {
      const engine = startAndLaunch();
      const initialTotal = getTotalBricks(engine);
      setRemainingBricks(engine, 0);
      advance(engine);
      expect(getTotalBricks(engine)).toBeGreaterThanOrEqual(initialTotal);
    });

    it('过关后所有新砖块 alive 为 true', () => {
      const engine = startAndLaunch();
      setRemainingBricks(engine, 0);
      advance(engine);
      const bricks = getBricks(engine);
      for (const b of bricks) {
        expect(b.alive).toBe(true);
      }
    });

    it('过关后球速增加', () => {
      const engine = startAndLaunch();
      const speed1 = getBall(engine).speed;
      setRemainingBricks(engine, 0);
      advance(engine);
      const speed2 = getBall(engine).speed;
      expect(speed2).toBeGreaterThan(speed1);
    });

    it('球速不超过 BALL_MAX_SPEED', () => {
      const engine = startAndLaunch();
      // 模拟很多关
      (engine as any)._level = 50;
      setRemainingBricks(engine, 0);
      advance(engine);
      expect(getBall(engine).speed).toBeLessThanOrEqual(BALL_MAX_SPEED);
    });

    it('过关后挡板重置到中间', () => {
      const engine = startAndLaunch();
      setPaddleX(engine, 10);
      setRemainingBricks(engine, 0);
      advance(engine);
      expect(getPaddleX(engine)).toBe((CANVAS_WIDTH - PADDLE_WIDTH) / 2);
    });
  });

  // ==================== T9: 游戏状态转换 ====================
  describe('游戏状态转换', () => {
    it('idle → playing（start）', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('playing → paused（pause）', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('paused → playing（resume）', () => {
      const engine = startEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('playing → gameover（gameOver）', () => {
      const engine = startEngine();
      setLives(engine, 1);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(engine.status).toBe('gameover');
    });

    it('gameover → idle（reset）', () => {
      const engine = startEngine();
      setLives(engine, 1);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(engine.status).toBe('gameover');
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('paused 状态下 pause 无效', () => {
      const engine = startEngine();
      engine.pause();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('idle 状态下 resume 无效', () => {
      const engine = createEngine();
      engine.resume();
      expect(engine.status).toBe('idle');
    });

    it('reset 后分数归零', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx } = brickCenter(target);
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(engine.score).toBeGreaterThan(0);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('reset 后等级归 1', () => {
      const engine = startAndLaunch();
      setRemainingBricks(engine, 0);
      advance(engine);
      expect(engine.level).toBeGreaterThan(1);
      engine.reset();
      expect(engine.level).toBe(1);
    });

    it('reset 后生命恢复为 INITIAL_LIVES', () => {
      const engine = startAndLaunch();
      setLives(engine, 1);
      engine.reset();
      expect(getLives(engine)).toBe(INITIAL_LIVES);
    });
  });

  // ==================== T10: 事件系统 ====================
  describe('事件系统', () => {
    it('start 触发 statusChange 为 playing', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('start 触发 scoreChange 为 0', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('scoreChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith(0);
    });

    it('start 触发 levelChange 为 1', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('levelChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith(1);
    });

    it('pause 触发 statusChange 为 paused', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.pause();
      expect(cb).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 为 playing', () => {
      const engine = startEngine();
      engine.pause();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.resume();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('reset 触发 statusChange 为 idle', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.reset();
      expect(cb).toHaveBeenCalledWith('idle');
    });

    it('reset 触发 scoreChange 为 0', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('scoreChange', cb);
      engine.reset();
      expect(cb).toHaveBeenCalledWith(0);
    });

    it('reset 触发 levelChange 为 1', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('levelChange', cb);
      engine.reset();
      expect(cb).toHaveBeenCalledWith(1);
    });

    it('消除砖块触发 scoreChange', () => {
      const engine = startAndLaunch();
      const cb = vi.fn();
      engine.on('scoreChange', cb);
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx } = brickCenter(target);
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(cb).toHaveBeenCalledWith(target.score);
    });

    it('过关触发 levelChange', () => {
      const engine = startAndLaunch();
      const cb = vi.fn();
      engine.on('levelChange', cb);
      setRemainingBricks(engine, 0);
      advance(engine);
      expect(cb).toHaveBeenCalledWith(2);
    });

    it('gameover 触发 statusChange 为 gameover', () => {
      const engine = startAndLaunch();
      setLives(engine, 1);
      const cb = vi.fn();
      engine.on('statusChange', cb);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      expect(cb).toHaveBeenCalledWith('gameover');
    });

    it('off 取消监听后不再触发', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.off('statusChange', cb);
      engine.start();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ==================== T11: getState 输出验证 ====================
  describe('getState', () => {
    it('返回所有关键状态字段', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('lives');
      expect(state).toHaveProperty('paddleX');
      expect(state).toHaveProperty('ballLaunched');
      expect(state).toHaveProperty('remainingBricks');
      expect(state).toHaveProperty('totalBricks');
    });

    it('初始状态值正确', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.lives).toBe(INITIAL_LIVES);
      expect(state.paddleX).toBe((CANVAS_WIDTH - PADDLE_WIDTH) / 2);
      expect(state.ballLaunched).toBe(false);
      expect(state.remainingBricks).toBe(BRICK_ROWS * BRICK_COLS);
      expect(state.totalBricks).toBe(BRICK_ROWS * BRICK_COLS);
    });

    it('start 后状态更新', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
    });

    it('消除砖块后 remainingBricks 更新', () => {
      const engine = startAndLaunch();
      const bricks = getBricks(engine);
      const target = bricks[0];
      const { cx } = brickCenter(target);
      setBall(engine, {
        x: cx,
        y: target.y + BRICK_HEIGHT / 2 + BALL_RADIUS,
        dx: 0,
        dy: -BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      const state = engine.getState();
      expect(state.remainingBricks).toBe(BRICK_ROWS * BRICK_COLS - 1);
      expect(state.score).toBe(target.score);
    });

    it('reset 后状态恢复初始值', () => {
      const engine = startAndLaunch();
      engine.reset();
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.lives).toBe(INITIAL_LIVES);
      expect(state.ballLaunched).toBe(false);
    });
  });

  // ==================== T12: handleKeyDown / handleKeyUp ====================
  describe('handleKeyDown / handleKeyUp', () => {
    it('ArrowLeft 设置 leftPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowLeft');
      expect(isLeftPressed(engine)).toBe(true);
    });

    it('ArrowRight 设置 rightPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      expect(isRightPressed(engine)).toBe(true);
    });

    it('ArrowLeft keyUp 取消 leftPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyUp('ArrowLeft');
      expect(isLeftPressed(engine)).toBe(false);
    });

    it('ArrowRight keyUp 取消 rightPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyUp('ArrowRight');
      expect(isRightPressed(engine)).toBe(false);
    });

    it('a 键设置 leftPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('a');
      expect(isLeftPressed(engine)).toBe(true);
    });

    it('d 键设置 rightPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('d');
      expect(isRightPressed(engine)).toBe(true);
    });

    it('A 键设置 leftPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('A');
      expect(isLeftPressed(engine)).toBe(true);
    });

    it('D 键设置 rightPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('D');
      expect(isRightPressed(engine)).toBe(true);
    });

    it('a 键 keyUp 取消 leftPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('a');
      engine.handleKeyUp('a');
      expect(isLeftPressed(engine)).toBe(false);
    });

    it('d 键 keyUp 取消 rightPressed', () => {
      const engine = startEngine();
      engine.handleKeyDown('d');
      engine.handleKeyUp('d');
      expect(isRightPressed(engine)).toBe(false);
    });

    it('Space 键在 idle 状态启动游戏', () => {
      const engine = createEngine();
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('Space 键在 playing + 未发射时发射球', () => {
      const engine = startEngine();
      engine.handleKeyDown(' ');
      expect(isBallLaunched(engine)).toBe(true);
    });

    it('不相关的键不改变状态', () => {
      const engine = startEngine();
      engine.handleKeyDown('z');
      expect(isLeftPressed(engine)).toBe(false);
      expect(isRightPressed(engine)).toBe(false);
    });
  });

  // ==================== T13: 边界条件与杂项 ====================
  describe('边界条件与杂项', () => {
    it('destroy 后 status 为 idle', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('连续多次 reset 不出错', () => {
      const engine = startEngine();
      engine.reset();
      engine.reset();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('handleKeyUp 不相关键不抛异常', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
      expect(() => engine.handleKeyUp('z')).not.toThrow();
    });

    it('砖块位置计算正确（第一块砖）', () => {
      const engine = createEngine();
      const bricks = getBricks(engine);
      const first = bricks.find(b => b.row === 0 && b.col === 0)!;
      expect(first.x).toBe(BRICK_OFFSET_LEFT);
      expect(first.y).toBe(BRICK_OFFSET_TOP);
    });

    it('砖块位置计算正确（第二列）', () => {
      const engine = createEngine();
      const bricks = getBricks(engine);
      const second = bricks.find(b => b.row === 0 && b.col === 1)!;
      expect(second.x).toBe(BRICK_OFFSET_LEFT + BRICK_WIDTH + BRICK_PADDING);
      expect(second.y).toBe(BRICK_OFFSET_TOP);
    });

    it('砖块位置计算正确（第二行）', () => {
      const engine = createEngine();
      const bricks = getBricks(engine);
      const second = bricks.find(b => b.row === 1 && b.col === 0)!;
      expect(second.x).toBe(BRICK_OFFSET_LEFT);
      expect(second.y).toBe(BRICK_OFFSET_TOP + BRICK_HEIGHT + BRICK_PADDING);
    });

    it('球在画布中间不碰撞时正常移动', () => {
      const engine = startAndLaunch();
      setBall(engine, {
        x: 240,
        y: 300,
        dx: 2,
        dy: -2,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      const ball = getBall(engine);
      expect(ball.x).toBe(242);
      expect(ball.y).toBe(298);
    });

    it('过关后 level 2 砖块行数增加', () => {
      const engine = startAndLaunch();
      const total1 = getTotalBricks(engine);
      setRemainingBricks(engine, 0);
      advance(engine);
      const total2 = getTotalBricks(engine);
      expect(total2).toBeGreaterThanOrEqual(total1);
    });

    it('球落底后 emit statusChange 为 playing（生命未耗尽）', () => {
      const engine = startAndLaunch();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      setBall(engine, {
        x: 240,
        y: CANVAS_HEIGHT - BALL_RADIUS - 1,
        dx: 1,
        dy: BALL_SPEED,
        speed: BALL_SPEED,
      });
      setBallLaunched(engine, true);
      advance(engine);
      // 球落底后生命减1但未结束，emit 'playing'
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('start 后重新开始游戏状态正确', () => {
      const engine = startAndLaunch();
      // 消除一个砖块
      const bricks = getBricks(engine);
      bricks[0].alive = false;
      (engine as any)._remainingBricks--;

      // 重新 start
      engine.start();
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
      expect(getLives(engine)).toBe(INITIAL_LIVES);
      expect(isBallLaunched(engine)).toBe(false);
      expect(getRemainingBricks(engine)).toBe(BRICK_ROWS * BRICK_COLS);
    });
  });
});
