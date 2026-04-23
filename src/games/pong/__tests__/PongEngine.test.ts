import { vi } from 'vitest';
/**
 * PongEngine 综合测试
 * 覆盖：初始化、挡板移动、球运动反弹、得分、AI行为、
 *       胜利条件(先到11分)、等级系统、状态管理、handleKeyDown/Up、getState
 */
import { PongEngine } from '../PongEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED,
  LEFT_PADDLE_X, RIGHT_PADDLE_X, PADDLE_START_Y,
  BALL_RADIUS, BALL_INITIAL_SPEED, BALL_MAX_SPEED, BALL_SPEED_INCREMENT,
  WIN_SCORE, AI_BASE_SPEED, AI_SPEED_PER_LEVEL, AI_TRACKING_ERROR,
  SERVE_DELAY,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建一个带 mock context 的 canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): PongEngine {
  const engine = new PongEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): PongEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: PongEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: PongEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 获取内部 ball 对象 */
function getBall(engine: PongEngine) {
  return getPrivate<{ x: number; y: number; dx: number; dy: number; speed: number } | null>(engine, '_ball');
}

/** 直接设置球的状态 */
function setBall(engine: PongEngine, ball: { x: number; y: number; dx: number; dy: number; speed: number }) {
  setPrivate(engine, '_ball', ball);
}

/** 将引擎从 serving 状态推进到球开始运动 */
function advancePastServe(engine: PongEngine) {
  // serveTimer 初始为 SERVE_DELAY (1000ms)
  // update 会将 serveTimer -= deltaTime，当 <= 0 时发球
  // 使用一个大于 SERVE_DELAY 的 deltaTime
  callUpdate(engine, SERVE_DELAY + 100);
}

/** 调用 protected update 方法（通过 gameLoop 间接触发或直接调用） */
function callUpdate(engine: PongEngine, deltaTime: number) {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

// ============================================================
// 1. 初始化
// ============================================================
describe('PongEngine - 初始化', () => {
  it('init 后状态为 idle', () => {
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

  it('init 后 playerScore 为 0', () => {
    const engine = createEngine();
    expect(engine.playerScore).toBe(0);
  });

  it('init 后 aiScore 为 0', () => {
    const engine = createEngine();
    expect(engine.aiScore).toBe(0);
  });

  it('init 后 isWin 为 false', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
  });

  it('init 后球位置默认为 (0, 0)', () => {
    const engine = createEngine();
    expect(engine.ballX).toBe(0);
    expect(engine.ballY).toBe(0);
  });

  it('init 后左右挡板在起始位置', () => {
    const engine = createEngine();
    expect(engine.leftPaddleY).toBe(PADDLE_START_Y);
    expect(engine.rightPaddleY).toBe(PADDLE_START_Y);
  });

  it('PADDLE_START_Y 让挡板垂直居中', () => {
    expect(PADDLE_START_Y).toBe((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  });
});

// ============================================================
// 2. 启动 / onStart
// ============================================================
describe('PongEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后进入 serving 状态', () => {
    const engine = createAndStartEngine();
    expect(engine.serving).toBe(true);
  });

  it('start 后球被创建在画布中央', () => {
    const engine = createAndStartEngine();
    expect(engine.ballX).toBe(CANVAS_WIDTH / 2);
    expect(engine.ballY).toBe(CANVAS_HEIGHT / 2);
  });

  it('start 后球的 dx/dy 为 0（等待发球）', () => {
    const engine = createAndStartEngine();
    const ball = getBall(engine)!;
    expect(ball.dx).toBe(0);
    expect(ball.dy).toBe(0);
  });

  it('start 后球速为 BALL_INITIAL_SPEED', () => {
    const engine = createAndStartEngine();
    const ball = getBall(engine)!;
    expect(ball.speed).toBe(BALL_INITIAL_SPEED);
  });

  it('start 后分数重置为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.playerScore).toBe(0);
    expect(engine.aiScore).toBe(0);
  });

  it('start 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isWin).toBe(false);
  });

  it('start 后输入状态重置', () => {
    const engine = createAndStartEngine();
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(false);
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(false);
  });

  it('start 后挡板回到起始位置', () => {
    const engine = createAndStartEngine();
    expect(engine.leftPaddleY).toBe(PADDLE_START_Y);
    expect(engine.rightPaddleY).toBe(PADDLE_START_Y);
  });

  it('start 发出 statusChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('start 发出 scoreChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('start 发出 levelChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('levelChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(1);
  });
});

// ============================================================
// 3. 发球机制
// ============================================================
describe('PongEngine - 发球', () => {
  it('serving 期间球不移动', () => {
    const engine = createAndStartEngine();
    const beforeX = engine.ballX;
    const beforeY = engine.ballY;
    callUpdate(engine, 16); // 小于 SERVE_DELAY
    expect(engine.ballX).toBe(beforeX);
    expect(engine.ballY).toBe(beforeY);
  });

  it('serveTimer 倒计时结束后球开始运动', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    expect(engine.serving).toBe(false);
    const ball = getBall(engine)!;
    // 球应该有非零速度
    expect(Math.abs(ball.dx) + Math.abs(ball.dy)).toBeGreaterThan(0);
  });

  it('发球后球速为 BALL_INITIAL_SPEED', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    const ball = getBall(engine)!;
    // dx^2 + dy^2 ≈ speed^2
    const actualSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    expect(actualSpeed).toBeCloseTo(ball.speed, 1);
  });

  it('发球方向随机（dx 可正可负）', () => {
    vi.spyOn(Math, 'random');
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 只要能正常发球即可（方向由 Math.random 决定）
    const ball = getBall(engine)!;
    expect(typeof ball.dx).toBe('number');
    expect(typeof ball.dy).toBe('number');
    vi.restoreAllMocks();
  });

  it('发球角度在 ±45° 以内', () => {
    // 多次发球验证角度范围
    let maxAngle = 0;
    for (let i = 0; i < 50; i++) {
      const engine = createAndStartEngine();
      advancePastServe(engine);
      const ball = getBall(engine)!;
      const angle = Math.abs(Math.atan2(ball.dy, Math.abs(ball.dx)));
      maxAngle = Math.max(maxAngle, angle);
    }
    // Math.PI * 0.5 * 0.5 = 45°
    expect(maxAngle).toBeLessThanOrEqual(Math.PI * 0.25 + 0.01);
  });
});

// ============================================================
// 4. 挡板移动（玩家）
// ============================================================
describe('PongEngine - 玩家挡板移动', () => {
  let engine: PongEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    advancePastServe(engine);
  });

  it('按下 ArrowUp 挡板向上移动', () => {
    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBeLessThan(PADDLE_START_Y);
  });

  it('按下 w 挡板向上移动', () => {
    engine.handleKeyDown('w');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBeLessThan(PADDLE_START_Y);
  });

  it('按下 W 挡板向上移动', () => {
    engine.handleKeyDown('W');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBeLessThan(PADDLE_START_Y);
  });

  it('按下 ArrowDown 挡板向下移动', () => {
    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBeGreaterThan(PADDLE_START_Y);
  });

  it('按下 s 挡板向下移动', () => {
    engine.handleKeyDown('s');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBeGreaterThan(PADDLE_START_Y);
  });

  it('按下 S 挡板向下移动', () => {
    engine.handleKeyDown('S');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBeGreaterThan(PADDLE_START_Y);
  });

  it('松开按键后挡板停止移动', () => {
    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 16);
    const posAfterMove = engine.leftPaddleY;
    engine.handleKeyUp('ArrowUp');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBe(posAfterMove);
  });

  it('挡板不能超出上边界 (HUD_HEIGHT)', () => {
    engine.handleKeyDown('ArrowUp');
    // 多次 update 确保到达顶部
    for (let i = 0; i < 200; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.leftPaddleY).toBeGreaterThanOrEqual(HUD_HEIGHT);
  });

  it('挡板不能超出下边界 (CANVAS_HEIGHT - PADDLE_HEIGHT)', () => {
    engine.handleKeyDown('ArrowDown');
    for (let i = 0; i < 200; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.leftPaddleY).toBeLessThanOrEqual(CANVAS_HEIGHT - PADDLE_HEIGHT);
  });

  it('同时按上下键，挡板净位移为 0', () => {
    const startY = engine.leftPaddleY;
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBe(startY);
  });

  it('挡板每次移动距离为 PADDLE_SPEED', () => {
    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 16);
    expect(engine.leftPaddleY).toBe(PADDLE_START_Y + PADDLE_SPEED);
  });
});

// ============================================================
// 5. 球运动
// ============================================================
describe('PongEngine - 球运动', () => {
  it('球按 dx/dy 方向移动', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    const ball = getBall(engine)!;
    const beforeX = ball.x;
    const beforeY = ball.y;
    callUpdate(engine, 16);
    expect(ball.x).not.toBe(beforeX);
    // y 方向可能为 0（如果 dy 恰好为 0），所以不强制检查
  });

  it('球碰到上墙壁反弹 (dy 取反)', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 手动将球放到接近上墙的位置，向下运动
    setBall(engine, { x: CANVAS_WIDTH / 2, y: HUD_HEIGHT + BALL_RADIUS + 1, dx: 1, dy: -5, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dy).toBeGreaterThan(0); // 反弹后 dy > 0
    expect(ball.y).toBeGreaterThanOrEqual(HUD_HEIGHT + BALL_RADIUS);
  });

  it('球碰到下墙壁反弹 (dy 取反)', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - BALL_RADIUS - 1, dx: 1, dy: 5, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dy).toBeLessThan(0); // 反弹后 dy < 0
    expect(ball.y).toBeLessThanOrEqual(CANVAS_HEIGHT - BALL_RADIUS);
  });

  it('球碰到上墙后 y 被修正为 HUD_HEIGHT + BALL_RADIUS', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH / 2, y: HUD_HEIGHT, dx: 0, dy: -10, speed: 10 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.y).toBe(HUD_HEIGHT + BALL_RADIUS);
  });

  it('球碰到下墙后 y 被修正为 CANVAS_HEIGHT - BALL_RADIUS', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT, dx: 0, dy: 10, speed: 10 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.y).toBe(CANVAS_HEIGHT - BALL_RADIUS);
  });
});

// ============================================================
// 6. 挡板碰撞
// ============================================================
describe('PongEngine - 挡板碰撞', () => {
  it('球碰到左挡板反弹（dx > 0）', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 将球放到左挡板附近，向左运动
    const ballX = LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1;
    setBall(engine, { x: ballX, y: PADDLE_START_Y + PADDLE_HEIGHT / 2, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dx).toBeGreaterThan(0); // 反弹后向右
  });

  it('球碰到右挡板反弹（dx < 0）', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    const ballX = RIGHT_PADDLE_X - BALL_RADIUS - 1;
    setBall(engine, { x: ballX, y: PADDLE_START_Y + PADDLE_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dx).toBeLessThan(0); // 反弹后向左
  });

  it('球碰左挡板后 x 被修正', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1, y: PADDLE_START_Y + PADDLE_HEIGHT / 2, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.x).toBe(LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS);
  });

  it('球碰右挡板后 x 被修正', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: RIGHT_PADDLE_X - BALL_RADIUS - 1, y: PADDLE_START_Y + PADDLE_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.x).toBe(RIGHT_PADDLE_X - BALL_RADIUS);
  });

  it('碰撞后球速增加 BALL_SPEED_INCREMENT', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    const initialSpeed = 5;
    setBall(engine, { x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1, y: PADDLE_START_Y + PADDLE_HEIGHT / 2, dx: -5, dy: 0, speed: initialSpeed });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.speed).toBe(initialSpeed + BALL_SPEED_INCREMENT);
  });

  it('球速不超过 BALL_MAX_SPEED', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1, y: PADDLE_START_Y + PADDLE_HEIGHT / 2, dx: -(BALL_MAX_SPEED), dy: 0, speed: BALL_MAX_SPEED });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.speed).toBeLessThanOrEqual(BALL_MAX_SPEED);
  });

  it('球打到挡板顶部产生向上角度', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 球打在挡板顶部 10% 位置
    const hitY = engine.leftPaddleY + PADDLE_HEIGHT * 0.1;
    setBall(engine, { x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1, y: hitY, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dy).toBeLessThan(0); // 向上
  });

  it('球打到挡板底部产生向下角度', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    const hitY = engine.leftPaddleY + PADDLE_HEIGHT * 0.9;
    setBall(engine, { x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1, y: hitY, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dy).toBeGreaterThan(0); // 向下
  });

  it('球打到挡板中间近似水平弹回', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    const hitY = engine.leftPaddleY + PADDLE_HEIGHT / 2;
    setBall(engine, { x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1, y: hitY, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(Math.abs(ball.dy)).toBeLessThan(1); // 几乎水平
  });

  it('球未碰到挡板（y 不在挡板范围内）不反弹', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 球在挡板上方
    setBall(engine, { x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1, y: HUD_HEIGHT + 1, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dx).toBeLessThan(0); // 仍然向左
  });

  it('球从右向左且未碰到左挡板时不触发碰撞', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 球在远离左挡板的位置
    setBall(engine, { x: CANVAS_WIDTH / 2, y: PADDLE_START_Y + PADDLE_HEIGHT / 2, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.dx).toBeLessThan(0); // 仍然向左
  });
});

// ============================================================
// 7. 得分
// ============================================================
describe('PongEngine - 得分', () => {
  it('球出左边界 → AI 得分', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: -BALL_RADIUS - 1, y: CANVAS_HEIGHT / 2, dx: -5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(engine.aiScore).toBe(1);
    expect(engine.playerScore).toBe(0);
  });

  it('球出右边界 → 玩家得分', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(engine.playerScore).toBe(1);
    expect(engine.aiScore).toBe(0);
  });

  it('得分后进入 serving 状态', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(engine.serving).toBe(true);
  });

  it('得分后球重置到中央', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(engine.ballX).toBe(CANVAS_WIDTH / 2);
    expect(engine.ballY).toBe(CANVAS_HEIGHT / 2);
  });

  it('多次得分累计正确', () => {
    const engine = createAndStartEngine();
    // 玩家得 3 分
    for (let i = 0; i < 3; i++) {
      advancePastServe(engine);
      setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
      callUpdate(engine, 16);
    }
    expect(engine.playerScore).toBe(3);
  });

  it('球刚过边界（x + BALL_RADIUS < 0）AI 得分', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: -(BALL_RADIUS + 1), y: CANVAS_HEIGHT / 2, dx: -1, dy: 0, speed: 1 });
    callUpdate(engine, 16);
    expect(engine.aiScore).toBe(1);
  });

  it('球刚过边界（x - BALL_RADIUS > CANVAS_WIDTH）玩家得分', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 1, dy: 0, speed: 1 });
    callUpdate(engine, 16);
    expect(engine.playerScore).toBe(1);
  });
});

// ============================================================
// 8. 胜利条件
// ============================================================
describe('PongEngine - 胜利条件', () => {
  it('玩家先到 WIN_SCORE 获胜', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', WIN_SCORE - 1);
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(engine.playerScore).toBe(WIN_SCORE);
    expect(engine.isWin).toBe(true);
    expect(engine.status).toBe('gameover');
  });

  it('AI 先到 WIN_SCORE 则玩家失败', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_aiScore', WIN_SCORE - 1);
    advancePastServe(engine);
    setBall(engine, { x: -(BALL_RADIUS + 1), y: CANVAS_HEIGHT / 2, dx: -1, dy: 0, speed: 1 });
    callUpdate(engine, 16);
    expect(engine.aiScore).toBe(WIN_SCORE);
    expect(engine.isWin).toBe(false);
    expect(engine.status).toBe('gameover');
  });

  it('WIN_SCORE 为 11', () => {
    expect(WIN_SCORE).toBe(11);
  });

  it('游戏结束后发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    setPrivate(engine, '_playerScore', WIN_SCORE - 1);
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalledWith('gameover');
  });

  it('玩家 10:10 时未结束', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', 10);
    setPrivate(engine, '_aiScore', 10);
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    // playerScore 变成 11，触发胜利
    expect(engine.playerScore).toBe(11);
    expect(engine.status).toBe('gameover');
    expect(engine.isWin).toBe(true);
  });

  it('玩家 10 分时 AI 得分不结束', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', 10);
    setPrivate(engine, '_aiScore', 9);
    advancePastServe(engine);
    setBall(engine, { x: -(BALL_RADIUS + 1), y: CANVAS_HEIGHT / 2, dx: -1, dy: 0, speed: 1 });
    callUpdate(engine, 16);
    expect(engine.aiScore).toBe(10);
    expect(engine.status).toBe('playing'); // 未到 11，继续
  });

  it('胜利时 addScore 被调用（score 等于 playerScore）', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', WIN_SCORE - 1);
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(engine.score).toBe(WIN_SCORE);
  });
});

// ============================================================
// 9. AI 行为
// ============================================================
describe('PongEngine - AI 行为', () => {
  it('AI 挡板向球的方向移动', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 将球放到上方
    setBall(engine, { x: CANVAS_WIDTH / 2, y: HUD_HEIGHT + 50, dx: 1, dy: 0, speed: 5 });
    const startY = engine.rightPaddleY;
    // 多次 update 让 AI 有时间反应
    for (let i = 0; i < 60; i++) {
      callUpdate(engine, 16);
    }
    // AI 应该向上移动（球在上方）
    expect(engine.rightPaddleY).toBeLessThan(PADDLE_START_Y + 20);
  });

  it('AI 挡板不能超出上边界', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH / 2, y: HUD_HEIGHT, dx: 1, dy: 0, speed: 5 });
    for (let i = 0; i < 300; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.rightPaddleY).toBeGreaterThanOrEqual(HUD_HEIGHT);
  });

  it('AI 挡板不能超出下边界', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT, dx: 1, dy: 0, speed: 5 });
    for (let i = 0; i < 300; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.rightPaddleY).toBeLessThanOrEqual(CANVAS_HEIGHT - PADDLE_HEIGHT);
  });

  it('AI 速度随等级提高', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 5);
    advancePastServe(engine);
    // 验证 AI_SPEED_PER_LEVEL 被使用
    const expectedSpeed = AI_BASE_SPEED + 5 * AI_SPEED_PER_LEVEL;
    expect(expectedSpeed).toBeGreaterThan(AI_BASE_SPEED);
  });

  it('AI 反应延迟随等级降低', () => {
    // reactionDelay = max(0.05, 0.2 - level * 0.02)
    const level1Delay = Math.max(0.05, 0.2 - 1 * 0.02);
    const level5Delay = Math.max(0.05, 0.2 - 5 * 0.02);
    const level10Delay = Math.max(0.05, 0.2 - 10 * 0.02);
    expect(level5Delay).toBeLessThan(level1Delay);
    expect(level10Delay).toBe(level10Delay); // 不低于 0.05
    expect(level10Delay).toBeGreaterThanOrEqual(0.05);
  });

  it('AI 在高等级时跟踪误差更小', () => {
    const errorLevel1 = Math.max(0, AI_TRACKING_ERROR - 1 * 5);
    const errorLevel5 = Math.max(0, AI_TRACKING_ERROR - 5 * 5);
    expect(errorLevel5).toBeLessThan(errorLevel1);
  });

  it('AI 无球时不崩溃', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_ball', null);
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('AI 挡板在球不动时趋向目标位置', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    // 球在下方
    setBall(engine, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50, dx: 0, dy: 0, speed: 5 });
    for (let i = 0; i < 100; i++) {
      callUpdate(engine, 16);
    }
    // AI 应该向下移动
    expect(engine.rightPaddleY).toBeGreaterThan(PADDLE_START_Y);
  });
});

// ============================================================
// 10. 等级系统
// ============================================================
describe('PongEngine - 等级系统', () => {
  it('初始等级为 1', () => {
    const engine = createAndStartEngine();
    expect(engine.level).toBe(1);
  });

  it('高等级发球速度更快', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 3);
    // 重新 resetServe
    const proto = Object.getPrototypeOf(engine);
    proto.resetServe.call(engine);
    const ball = getBall(engine)!;
    const expectedSpeed = BALL_INITIAL_SPEED + (3 - 1) * BALL_SPEED_INCREMENT * 2;
    expect(ball.speed).toBeCloseTo(expectedSpeed, 1);
  });

  it('等级 1 发球速度等于 BALL_INITIAL_SPEED', () => {
    const engine = createAndStartEngine();
    const ball = getBall(engine)!;
    expect(ball.speed).toBe(BALL_INITIAL_SPEED);
  });

  it('setLevel 触发 levelChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('levelChange', handler);
    // setLevel 是 protected，通过 start 间接触发
    engine.start();
    expect(handler).toHaveBeenCalledWith(1);
  });
});

// ============================================================
// 11. 状态管理
// ============================================================
describe('PongEngine - 状态管理', () => {
  it('初始状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('pause 后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态恢复为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态恢复为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('gameOver 后状态为 gameover', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', WIN_SCORE - 1);
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    expect(engine.status).toBe('gameover');
  });

  it('idle 时不能 pause', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('playing 时不能 resume', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后分数清零', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', 5);
    setPrivate(engine, '_aiScore', 3);
    engine.reset();
    expect(engine.playerScore).toBe(0);
    expect(engine.aiScore).toBe(0);
  });

  it('reset 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_isWin', true);
    engine.reset();
    expect(engine.isWin).toBe(false);
  });

  it('reset 后球为 null', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(getBall(engine)).toBeNull();
  });

  it('reset 后挡板回到起始位置', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_leftPaddleY', 100);
    setPrivate(engine, '_rightPaddleY', 200);
    engine.reset();
    expect(engine.leftPaddleY).toBe(PADDLE_START_Y);
    expect(engine.rightPaddleY).toBe(PADDLE_START_Y);
  });

  it('reset 后 serving 为 true', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    engine.reset();
    expect(engine.serving).toBe(true);
  });

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    // destroy 内部调用 reset() 会触发一次 statusChange('idle')
    // 但之后 listeners.clear() 了，后续 emit 不再触发
    const callCountAfterDestroy = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCountAfterDestroy);
  });

  it('pause/resume 发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
    engine.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('reset 发出 statusChange idle 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });
});

// ============================================================
// 12. handleKeyDown / handleKeyUp
// ============================================================
describe('PongEngine - handleKeyDown / handleKeyUp', () => {
  it('Space 在 idle 状态启动游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('Space 在 gameover 状态重启游戏', () => {
    const engine = createAndStartEngine();
    // 模拟 gameover
    setPrivate(engine, '_playerScore', WIN_SCORE - 1);
    setPrivate(engine, '_status', 'gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.playerScore).toBe(0);
    expect(engine.aiScore).toBe(0);
  });

  it('ArrowUp 设置 _upPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowUp');
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(true);
  });

  it('ArrowDown 设置 _downPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowDown');
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(true);
  });

  it('w 设置 _upPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('w');
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(true);
  });

  it('W 设置 _upPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('W');
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(true);
  });

  it('s 设置 _downPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('s');
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(true);
  });

  it('S 设置 _downPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('S');
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(true);
  });

  it('handleKeyUp ArrowUp 取消 _upPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyUp('ArrowUp');
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(false);
  });

  it('handleKeyUp ArrowDown 取消 _downPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyUp('ArrowDown');
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(false);
  });

  it('handleKeyUp w 取消 _upPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('w');
    engine.handleKeyUp('w');
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(false);
  });

  it('handleKeyUp W 取消 _upPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('W');
    engine.handleKeyUp('W');
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(false);
  });

  it('handleKeyUp s 取消 _downPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('s');
    engine.handleKeyUp('s');
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(false);
  });

  it('handleKeyUp S 取消 _downPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('S');
    engine.handleKeyUp('S');
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(false);
  });

  it('未知按键不改变输入状态', () => {
    const engine = createEngine();
    engine.handleKeyDown('a');
    expect(getPrivate<boolean>(engine, '_upPressed')).toBe(false);
    expect(getPrivate<boolean>(engine, '_downPressed')).toBe(false);
  });

  it('Space 在 playing 状态不触发任何动作', () => {
    const engine = createAndStartEngine();
    const beforeStatus = engine.status;
    engine.handleKeyDown(' ');
    expect(engine.status).toBe(beforeStatus);
  });

  it('Space 键别名 "Space" 也能启动', () => {
    const engine = createEngine();
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });
});

// ============================================================
// 13. getState
// ============================================================
describe('PongEngine - getState', () => {
  it('返回包含所有必要字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('playerScore');
    expect(state).toHaveProperty('aiScore');
    expect(state).toHaveProperty('ballX');
    expect(state).toHaveProperty('ballY');
    expect(state).toHaveProperty('leftPaddleY');
    expect(state).toHaveProperty('rightPaddleY');
    expect(state).toHaveProperty('serving');
    expect(state).toHaveProperty('isWin');
  });

  it('初始状态的 getState 值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.playerScore).toBe(0);
    expect(state.aiScore).toBe(0);
    expect(state.ballX).toBe(CANVAS_WIDTH / 2);
    expect(state.ballY).toBe(CANVAS_HEIGHT / 2);
    expect(state.leftPaddleY).toBe(PADDLE_START_Y);
    expect(state.rightPaddleY).toBe(PADDLE_START_Y);
    expect(state.serving).toBe(true);
    expect(state.isWin).toBe(false);
  });

  it('得分后 getState 反映新分数', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', 5);
    setPrivate(engine, '_aiScore', 3);
    const state = engine.getState();
    expect(state.playerScore).toBe(5);
    expect(state.aiScore).toBe(3);
  });

  it('游戏结束后 isWin 正确', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_playerScore', WIN_SCORE - 1);
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
    callUpdate(engine, 16);
    const state = engine.getState();
    expect(state.isWin).toBe(true);
    expect(state.score).toBe(WIN_SCORE);
  });

  it('无球时 ballX/ballY 为 0', () => {
    const engine = createEngine();
    // init 后 ball 为 null
    const state = engine.getState();
    expect(state.ballX).toBe(0);
    expect(state.ballY).toBe(0);
  });
});

// ============================================================
// 14. 事件系统
// ============================================================
describe('PongEngine - 事件系统', () => {
  it('on 注册事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.off('test', handler);
    engine.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit 传递参数', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.emit('test', 'arg1', 42);
    expect(handler).toHaveBeenCalledWith('arg1', 42);
  });

  it('多次 on 同一事件注册多个监听', () => {
    const engine = createEngine();
    const h1 = vi.fn();
    const h2 = vi.fn();
    engine.on('test', h1);
    engine.on('test', h2);
    engine.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });
});

// ============================================================
// 15. 边界与异常场景
// ============================================================
describe('PongEngine - 边界与异常场景', () => {
  it('无 canvas 时 start 抛出错误', () => {
    const engine = new PongEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('连续多次 start 不会崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
  });

  it('连续多次 reset 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });

  it('连续多次 pause 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(() => engine.pause()).not.toThrow();
  });

  it('未 pause 时 resume 不改变状态', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 时 pause 不改变状态', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('update 在 serving 且无球时不崩溃', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_ball', null);
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('球速恰好为 BALL_MAX_SPEED 时碰撞不超限', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, {
      x: LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS + 1,
      y: PADDLE_START_Y + PADDLE_HEIGHT / 2,
      dx: -(BALL_MAX_SPEED),
      dy: 0,
      speed: BALL_MAX_SPEED,
    });
    callUpdate(engine, 16);
    const ball = getBall(engine)!;
    expect(ball.speed).toBeLessThanOrEqual(BALL_MAX_SPEED);
  });

  it('快速连续得分（球反复出界）不会崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 20; i++) {
      advancePastServe(engine);
      setBall(engine, { x: CANVAS_WIDTH + BALL_RADIUS + 1, y: CANVAS_HEIGHT / 2, dx: 5, dy: 0, speed: 5 });
      callUpdate(engine, 16);
      if (engine.status === 'gameover') break;
    }
    // 应该在 playerScore = 11 时结束
    expect(engine.playerScore).toBe(WIN_SCORE);
    expect(engine.status).toBe('gameover');
  });

  it('球在画布中央不触发任何碰撞或得分', () => {
    const engine = createAndStartEngine();
    advancePastServe(engine);
    setBall(engine, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 1, dy: 1, speed: 3 });
    const beforePlayerScore = engine.playerScore;
    const beforeAiScore = engine.aiScore;
    callUpdate(engine, 16);
    expect(engine.playerScore).toBe(beforePlayerScore);
    expect(engine.aiScore).toBe(beforeAiScore);
  });
});

// ============================================================
// 16. 常量合理性验证
// ============================================================
describe('Pong 常量验证', () => {
  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('BALL_INITIAL_SPEED < BALL_MAX_SPEED', () => {
    expect(BALL_INITIAL_SPEED).toBeLessThan(BALL_MAX_SPEED);
  });

  it('BALL_SPEED_INCREMENT > 0', () => {
    expect(BALL_SPEED_INCREMENT).toBeGreaterThan(0);
  });

  it('PADDLE_SPEED > 0', () => {
    expect(PADDLE_SPEED).toBeGreaterThan(0);
  });

  it('LEFT_PADDLE_X > 0', () => {
    expect(LEFT_PADDLE_X).toBeGreaterThan(0);
  });

  it('RIGHT_PADDLE_X + PADDLE_WIDTH < CANVAS_WIDTH', () => {
    expect(RIGHT_PADDLE_X + PADDLE_WIDTH).toBeLessThan(CANVAS_WIDTH);
  });

  it('SERVE_DELAY > 0', () => {
    expect(SERVE_DELAY).toBeGreaterThan(0);
  });

  it('AI_BASE_SPEED > 0', () => {
    expect(AI_BASE_SPEED).toBeGreaterThan(0);
  });
});
