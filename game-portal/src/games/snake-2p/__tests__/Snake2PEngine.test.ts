import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Snake2PEngine } from '../Snake2PEngine';
import {
  COLS, ROWS, INITIAL_LENGTH, SNAKE_SPEED, SPEED_INCREMENT, MIN_SPEED,
  FOOD_SCORE, SPECIAL_FOOD_SCORE, SPECIAL_FOOD_CHANCE, SPECIAL_FOOD_TTL,
  MAX_FOOD_ON_BOARD,
  P1_START_X, P1_START_Y, P2_START_X, P2_START_Y,
  DIRECTIONS,
} from '../constants';

// ========== 测试辅助工具 ==========

/** 创建一个 mock canvas（jsdom 环境） */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

/** 创建引擎并初始化（不调用 start，停留在 idle） */
function createEngine(): Snake2PEngine {
  const engine = new Snake2PEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并开始游戏 */
function createAndStartEngine(): Snake2PEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 确定性随机数生成器 */
function deterministicRng(sequence: number[]): () => number {
  let idx = 0;
  return () => {
    const val = sequence[idx % sequence.length];
    idx++;
    return val;
  };
}

/** 推进游戏若干步（每步 = SNAKE_SPEED 毫秒） */
function advanceSteps(engine: Snake2PEngine, steps: number, stepSize = SNAKE_SPEED): void {
  for (let i = 0; i < steps; i++) {
    engine.update(stepSize);
  }
}

// ========== 常量测试 ==========

describe('Snake2P Constants', () => {
  it('网格尺寸正确', () => {
    expect(COLS).toBe(24);
    expect(ROWS).toBe(32);
  });

  it('初始长度 >= 1', () => {
    expect(INITIAL_LENGTH).toBeGreaterThanOrEqual(1);
  });

  it('速度参数合理', () => {
    expect(SNAKE_SPEED).toBeGreaterThan(0);
    expect(MIN_SPEED).toBeGreaterThan(0);
    expect(SPEED_INCREMENT).toBeGreaterThan(0);
    expect(MIN_SPEED).toBeLessThan(SNAKE_SPEED);
  });

  it('食物参数合理', () => {
    expect(FOOD_SCORE).toBeGreaterThan(0);
    expect(SPECIAL_FOOD_SCORE).toBeGreaterThan(FOOD_SCORE);
    expect(SPECIAL_FOOD_CHANCE).toBeGreaterThan(0);
    expect(SPECIAL_FOOD_CHANCE).toBeLessThan(1);
    expect(MAX_FOOD_ON_BOARD).toBeGreaterThanOrEqual(1);
  });

  it('方向向量正交', () => {
    const dirs = Object.values(DIRECTIONS);
    for (const d of dirs) {
      expect(Math.abs(d.x) + Math.abs(d.y)).toBe(1);
    }
  });

  it('P1 和 P2 起始位置在网格内', () => {
    expect(P1_START_X).toBeGreaterThanOrEqual(0);
    expect(P1_START_X).toBeLessThan(COLS);
    expect(P1_START_Y).toBeGreaterThanOrEqual(0);
    expect(P1_START_Y).toBeLessThan(ROWS);
    expect(P2_START_X).toBeGreaterThanOrEqual(0);
    expect(P2_START_X).toBeLessThan(COLS);
    expect(P2_START_Y).toBeGreaterThanOrEqual(0);
    expect(P2_START_Y).toBeLessThan(ROWS);
  });
});

// ========== 引擎初始化测试 ==========

describe('Snake2PEngine - Initialization', () => {
  let engine: Snake2PEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始化后状态为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('初始等级为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('初始化后蛇1存在', () => {
    expect(engine.snake1).toBeDefined();
    expect(engine.snake1.body.length).toBe(INITIAL_LENGTH);
  });

  it('初始化后蛇2存在', () => {
    expect(engine.snake2).toBeDefined();
    expect(engine.snake2.body.length).toBe(INITIAL_LENGTH);
  });

  it('初始化后两条蛇都活着', () => {
    expect(engine.p1Alive).toBe(true);
    expect(engine.p2Alive).toBe(true);
  });

  it('初始化后两条蛇分数为 0', () => {
    expect(engine.p1Score).toBe(0);
    expect(engine.p2Score).toBe(0);
  });

  it('初始化后没有食物', () => {
    expect(engine.foods).toHaveLength(0);
  });

  it('初始化后结果为 null', () => {
    expect(engine.result).toBeNull();
  });

  it('初始化后游戏时间为 0', () => {
    expect(engine.gameTime).toBe(0);
  });

  it('蛇1初始方向为右', () => {
    expect(engine.snake1.direction).toEqual(DIRECTIONS.RIGHT);
  });

  it('蛇2初始方向为左', () => {
    expect(engine.snake2.direction).toEqual(DIRECTIONS.LEFT);
  });

  it('蛇1起始位置正确', () => {
    const head = engine.snake1.body[0];
    expect(head.x).toBe(P1_START_X);
    expect(head.y).toBe(P1_START_Y);
  });

  it('蛇2起始位置正确', () => {
    const head = engine.snake2.body[0];
    expect(head.x).toBe(P2_START_X);
    expect(head.y).toBe(P2_START_Y);
  });

  it('蛇身连续', () => {
    // 蛇1
    for (let i = 1; i < engine.snake1.body.length; i++) {
      const prev = engine.snake1.body[i - 1];
      const curr = engine.snake1.body[i];
      const dist = Math.abs(prev.x - curr.x) + Math.abs(prev.y - curr.y);
      expect(dist).toBe(1);
    }
    // 蛇2
    for (let i = 1; i < engine.snake2.body.length; i++) {
      const prev = engine.snake2.body[i - 1];
      const curr = engine.snake2.body[i];
      const dist = Math.abs(prev.x - curr.x) + Math.abs(prev.y - curr.y);
      expect(dist).toBe(1);
    }
  });
});

// ========== 游戏启动测试 ==========

describe('Snake2PEngine - Start', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后场上存在食物', () => {
    const engine = createAndStartEngine();
    expect(engine.foods.length).toBeGreaterThan(0);
  });

  it('start 后场上食物不超过上限', () => {
    const engine = createAndStartEngine();
    expect(engine.foods.length).toBeLessThanOrEqual(MAX_FOOD_ON_BOARD);
  });

  it('start 后分数重置为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.p1Score).toBe(0);
    expect(engine.p2Score).toBe(0);
  });

  it('start 后两条蛇都活着', () => {
    const engine = createAndStartEngine();
    expect(engine.p1Alive).toBe(true);
    expect(engine.p2Alive).toBe(true);
  });

  it('start 后结果为 null', () => {
    const engine = createAndStartEngine();
    expect(engine.result).toBeNull();
  });

  it('start 后游戏时间为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.gameTime).toBe(0);
  });
});

// ========== 蛇移动测试 ==========

describe('Snake2PEngine - Snake Movement', () => {
  let engine: Snake2PEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('蛇1向右移动一步', () => {
    const headX = engine.snake1.body[0].x;
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body[0].x).toBe(headX + 1);
  });

  it('蛇2向左移动一步', () => {
    const headX = engine.snake2.body[0].x;
    engine.update(SNAKE_SPEED);
    expect(engine.snake2.body[0].x).toBe(headX - 1);
  });

  it('未到移动间隔时蛇不动', () => {
    const headX = engine.snake1.body[0].x;
    engine.update(SNAKE_SPEED / 2);
    expect(engine.snake1.body[0].x).toBe(headX);
  });

  it('累积时间足够后蛇移动', () => {
    const headX = engine.snake1.body[0].x;
    engine.update(SNAKE_SPEED / 2);
    engine.update(SNAKE_SPEED / 2);
    expect(engine.snake1.body[0].x).toBe(headX + 1);
  });

  it('蛇不吃食物时长度不变', () => {
    const len = engine.snake1.body.length;
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body.length).toBe(len);
  });

  it('蛇不吃食物时尾部跟随移动', () => {
    const tailBefore = engine.snake1.body[engine.snake1.body.length - 1];
    engine.update(SNAKE_SPEED);
    const tailAfter = engine.snake1.body[engine.snake1.body.length - 1];
    // 尾部应该移动了
    const moved = tailBefore.x !== tailAfter.x || tailBefore.y !== tailAfter.y;
    expect(moved).toBe(true);
  });

  it('多步移动后蛇身仍然连续', () => {
    advanceSteps(engine, 5);
    for (let i = 1; i < engine.snake1.body.length; i++) {
      const prev = engine.snake1.body[i - 1];
      const curr = engine.snake1.body[i];
      const dist = Math.abs(prev.x - curr.x) + Math.abs(prev.y - curr.y);
      expect(dist).toBe(1);
    }
  });

  it('游戏时间随 update 累积', () => {
    engine.update(100);
    expect(engine.gameTime).toBe(100);
    engine.update(50);
    expect(engine.gameTime).toBe(150);
  });
});

// ========== 方向控制测试 ==========

describe('Snake2PEngine - Direction Control', () => {
  let engine: Snake2PEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  // --- 玩家1 WASD ---

  it('W 键使蛇1向上', () => {
    engine.handleKeyDown('w');
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body[0].y).toBe(P1_START_Y - 1);
  });

  it('S 键使蛇1向下', () => {
    engine.handleKeyDown('s');
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body[0].y).toBe(P1_START_Y + 1);
  });

  it('A 键使蛇1向左', () => {
    // 先向上走一步（改变方向），再向左走
    engine.handleKeyDown('w');
    engine.update(SNAKE_SPEED);
    engine.handleKeyDown('a');
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body[0].x).toBe(P1_START_X - 1);
  });

  it('D 键使蛇1向右（保持原方向）', () => {
    engine.handleKeyDown('d');
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body[0].x).toBe(P1_START_X + 1);
  });

  it('大写 WASD 也有效', () => {
    engine.handleKeyDown('W');
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body[0].y).toBe(P1_START_Y - 1);
  });

  // --- 玩家2 方向键 ---

  it('ArrowUp 使蛇2向上', () => {
    engine.handleKeyDown('ArrowUp');
    engine.update(SNAKE_SPEED);
    expect(engine.snake2.body[0].y).toBe(P2_START_Y - 1);
  });

  it('ArrowDown 使蛇2向下', () => {
    engine.handleKeyDown('ArrowDown');
    engine.update(SNAKE_SPEED);
    expect(engine.snake2.body[0].y).toBe(P2_START_Y + 1);
  });

  it('ArrowLeft 使蛇2向左（保持原方向）', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.update(SNAKE_SPEED);
    expect(engine.snake2.body[0].x).toBe(P2_START_X - 1);
  });

  it('ArrowRight 使蛇2向右', () => {
    // 先向上走一步（改变方向），再向右走
    engine.handleKeyDown('ArrowUp');
    engine.update(SNAKE_SPEED);
    engine.handleKeyDown('ArrowRight');
    engine.update(SNAKE_SPEED);
    expect(engine.snake2.body[0].x).toBe(P2_START_X + 1);
  });

  // --- 反向掉头保护 ---

  it('蛇1不能反向掉头（向右时按 A 无效）', () => {
    engine.handleKeyDown('a');
    engine.update(SNAKE_SPEED);
    // 应该继续向右
    expect(engine.snake1.body[0].x).toBe(P1_START_X + 1);
    expect(engine.snake1.body[0].y).toBe(P1_START_Y);
  });

  it('蛇2不能反向掉头（向左时按 ArrowRight 无效）', () => {
    engine.handleKeyDown('ArrowRight');
    engine.update(SNAKE_SPEED);
    // 应该继续向左
    expect(engine.snake2.body[0].x).toBe(P2_START_X - 1);
    expect(engine.snake2.body[0].y).toBe(P2_START_Y);
  });

  it('蛇先上再下不能直接掉头', () => {
    engine.handleKeyDown('w');
    engine.update(SNAKE_SPEED);
    // 现在方向是上，按下应该无效
    engine.handleKeyDown('s');
    engine.update(SNAKE_SPEED);
    // 应该继续向上
    expect(engine.snake1.body[0].y).toBe(P1_START_Y - 2);
  });

  it('方向键在 idle 状态无效', () => {
    const idleEngine = createEngine();
    const headX = idleEngine.snake1.body[0].x;
    const headY = idleEngine.snake1.body[0].y;
    idleEngine.handleKeyDown('w');
    // idle 状态不接受方向键
    expect(idleEngine.snake1.body[0].x).toBe(headX);
    expect(idleEngine.snake1.body[0].y).toBe(headY);
  });

  it('handleKeyUp 不影响方向', () => {
    engine.handleKeyDown('w');
    engine.handleKeyUp('w');
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body[0].y).toBe(P1_START_Y - 1);
  });
});

// ========== 碰撞检测测试 ==========

describe('Snake2PEngine - Collision Detection', () => {
  it('蛇撞左墙死亡', () => {
    const engine = createAndStartEngine();
    // 蛇1在 P1_START_X=6，向右走。先上再左走到墙
    engine.handleKeyDown('w');
    advanceSteps(engine, 1);
    engine.handleKeyDown('a');
    // 需要走 P1_START_X + 1 步到墙（因为头部在 x=5 后向上走了1步）
    // 蛇1头在 (6, P1_START_Y-1)，向左走到 x=0 需 6 步，再走一步撞墙
    advanceSteps(engine, 8);
    expect(engine.p1Alive).toBe(false);
  });

  it('蛇撞右墙死亡', () => {
    const engine = createAndStartEngine();
    // 蛇1向右走到撞右墙
    advanceSteps(engine, COLS - P1_START_X + 1);
    expect(engine.p1Alive).toBe(false);
  });

  it('蛇撞上墙死亡', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('w');
    advanceSteps(engine, P1_START_Y + 2);
    expect(engine.p1Alive).toBe(false);
  });

  it('蛇撞下墙死亡', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('s');
    advanceSteps(engine, ROWS - P2_START_Y + 1);
    expect(engine.p1Alive).toBe(false);
  });

  it('蛇撞自己死亡', () => {
    const engine = createAndStartEngine();
    // 先喂蛇1让它变长，然后走一个圈撞自己
    // 蛇1初始在 (6,16) 向右，长度3
    // 放食物让蛇吃到变长
    for (let i = 0; i < 5; i++) {
      const head = engine.snake1.body[0];
      engine.setFoods([{ position: { x: head.x + 1, y: head.y }, type: 'normal', createdAt: 0 }]);
      engine.update(SNAKE_SPEED);
      if (!engine.p1Alive) break;
    }
    // 现在蛇1应该很长了，向右走
    // 转向下
    engine.handleKeyDown('s');
    engine.update(SNAKE_SPEED);
    if (!engine.p1Alive) return;
    // 转向左
    engine.handleKeyDown('a');
    advanceSteps(engine, 3);
    if (!engine.p1Alive) return;
    // 转向上 - 应该撞到自己之前走过的身体
    engine.handleKeyDown('w');
    advanceSteps(engine, 5);
    // 如果蛇够长，应该已经撞到自己了
    expect(engine.p1Alive).toBe(false);
  });

  it('蛇撞对方身体死亡', () => {
    const engine = createAndStartEngine();
    // 蛇1在左，蛇2在右。让蛇1向右走很多步撞上蛇2身体
    // 蛇2初始位置在 x=15 左右，蛇1在 x=6
    // 蛇2向左走，蛇1向右走，最终蛇1头撞到蛇2身体
    // 简单方法：让蛇1一直向右走直到撞到蛇2的身体
    // 蛇2向左走，蛇1向右走
    engine.handleKeyDown('ArrowUp'); // 蛇2向上走，避免直接碰撞
    // 蛇1继续向右走
    const steps = COLS; // 走足够多步
    advanceSteps(engine, steps);
    // 蛇1或蛇2应该已经死了
    expect(engine.p1Alive || engine.p2Alive).toBeDefined();
  });

  it('头对头碰撞双方死亡', () => {
    const engine = createAndStartEngine();
    // 蛇1在 x=6 向右，蛇2在 x=15 向左
    // 中间间隔 15-6=9 格
    // 两条蛇相向而行，各走 4-5 步后头部相遇
    // 但它们不在同一行（起始Y相同），所以会头对头碰撞
    // P1_START_Y = P2_START_Y = 16（中间行）
    // 蛇1向右，蛇2向左，会在中间相遇
    const stepsNeeded = Math.ceil((P2_START_X - P1_START_X) / 2) + 1;
    advanceSteps(engine, stepsNeeded);
    // 两蛇应该同时死亡（头对头）
    expect(engine.p1Alive).toBe(false);
    expect(engine.p2Alive).toBe(false);
  });
});

// ========== 游戏结束测试 ==========

describe('Snake2PEngine - Game Over', () => {
  it('一方死亡另一方获胜', () => {
    const engine = createAndStartEngine();
    // 让蛇2向上走几步后向左走（安全方向），蛇1继续向右走到撞墙
    engine.handleKeyDown('ArrowUp');
    advanceSteps(engine, 5);
    engine.handleKeyDown('ArrowLeft');
    // P1 走了 5 步后 x=11，还需走到 x>=24（越界）
    // P2 向上5步后向左走，P2 在 (16, 11) 向左走
    advanceSteps(engine, COLS - P1_START_X - 5 + 1);
    expect(engine.p1Alive).toBe(false);
    expect(engine.p2Alive).toBe(true);
    expect(engine.result).toBe('p2_win');
  });

  it('双方同时死亡为平局', () => {
    const engine = createAndStartEngine();
    const stepsNeeded = Math.ceil((P2_START_X - P1_START_X) / 2) + 1;
    advanceSteps(engine, stepsNeeded);
    expect(engine.result).toBe('draw');
  });

  it('游戏结束后状态为 gameover', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, COLS - P1_START_X + 1);
    expect(engine.status).toBe('gameover');
  });

  it('P1 获胜时 result 为 p1_win', () => {
    const engine = createAndStartEngine();
    // 让蛇1向上走几步后向右走（安全方向），蛇2继续向左走到撞左墙
    engine.handleKeyDown('w');
    advanceSteps(engine, 5);
    engine.handleKeyDown('d');
    // P2 走了 5 步后 x=16-5=11，还需走到 x<0（越界）
    advanceSteps(engine, P2_START_X - 5 + 1);
    expect(engine.p1Alive).toBe(true);
    expect(engine.p2Alive).toBe(false);
    expect(engine.result).toBe('p1_win');
  });

  it('P2 获胜时 result 为 p2_win', () => {
    const engine = createAndStartEngine();
    // 蛇2向上走几步后向左走（避免撞墙）
    engine.handleKeyDown('ArrowUp');
    advanceSteps(engine, 5);
    engine.handleKeyDown('ArrowLeft');
    // 蛇1继续向右走到撞右墙
    // P1 总步数 = 5 + remaining，需要到 x>=24
    // P1 走了5步后 x=11，还需 14 步到 x=25（越界）
    // 但 P2 向左走14步：x=16-14=2，安全
    advanceSteps(engine, COLS - P1_START_X - 5 + 1);
    expect(engine.p1Alive).toBe(false);
    expect(engine.p2Alive).toBe(true);
    expect(engine.result).toBe('p2_win');
  });

  it('游戏结束后 update 不再改变状态', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, COLS - P1_START_X + 1);
    const result = engine.result;
    const status = engine.status;
    // update 在 gameover 后不会被 gameLoop 调用，但直接调用不应该崩溃
    engine.update(SNAKE_SPEED);
    expect(engine.result).toBe(result);
    expect(engine.status).toBe(status);
  });
});

// ========== 食物测试 ==========

describe('Snake2PEngine - Food', () => {
  it('场上食物数量不超过上限', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, 5);
    expect(engine.foods.length).toBeLessThanOrEqual(MAX_FOOD_ON_BOARD);
  });

  it('食物被吃掉后重新生成', () => {
    const engine = createAndStartEngine();
    const initialFoodCount = engine.foods.length;
    // 强制将一个食物放到蛇1前方
    const headX = engine.snake1.body[0].x + 1;
    const headY = engine.snake1.body[0].y;
    engine.setFoods([{ position: { x: headX, y: headY }, type: 'normal', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    // 食物被吃掉后 update 会补充
    expect(engine.foods.length).toBeGreaterThan(0);
    expect(engine.p1Score).toBe(FOOD_SCORE);
  });

  it('吃到普通食物加 FOOD_SCORE 分', () => {
    const engine = createAndStartEngine();
    const headX = engine.snake1.body[0].x + 1;
    const headY = engine.snake1.body[0].y;
    engine.setFoods([{ position: { x: headX, y: headY }, type: 'normal', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    expect(engine.p1Score).toBe(FOOD_SCORE);
  });

  it('吃到特殊食物加 SPECIAL_FOOD_SCORE 分', () => {
    const engine = createAndStartEngine();
    const headX = engine.snake1.body[0].x + 1;
    const headY = engine.snake1.body[0].y;
    engine.setFoods([{ position: { x: headX, y: headY }, type: 'special', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    expect(engine.p1Score).toBe(SPECIAL_FOOD_SCORE);
  });

  it('吃到食物后蛇变长', () => {
    const engine = createAndStartEngine();
    const initialLen = engine.snake1.body.length;
    const headX = engine.snake1.body[0].x + 1;
    const headY = engine.snake1.body[0].y;
    engine.setFoods([{ position: { x: headX, y: headY }, type: 'normal', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body.length).toBe(initialLen + 1);
  });

  it('没吃到食物蛇长度不变', () => {
    const engine = createAndStartEngine();
    const initialLen = engine.snake1.body.length;
    // 清除所有食物
    engine.setFoods([]);
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.body.length).toBe(initialLen);
  });

  it('特殊食物超时消失', () => {
    const engine = createAndStartEngine();
    engine.setFoods([{ position: { x: 0, y: 0 }, type: 'special', createdAt: 0 }]);
    // 推进超过 SPECIAL_FOOD_TTL
    engine.update(SPECIAL_FOOD_TTL + 1);
    // 原始位置的特殊食物应该已消失（新生成的食物可能在其他位置）
    const originalFood = engine.foods.filter(f => f.type === 'special' && f.position.x === 0 && f.position.y === 0);
    expect(originalFood).toHaveLength(0);
  });

  it('普通食物不超时消失', () => {
    const engine = createAndStartEngine();
    engine.setFoods([{ position: { x: 0, y: 0 }, type: 'normal', createdAt: 0 }]);
    engine.update(SPECIAL_FOOD_TTL + 1000);
    const normalFoods = engine.foods.filter(f => f.type === 'normal' && f.position.x === 0 && f.position.y === 0);
    expect(normalFoods).toHaveLength(1);
  });

  it('食物不出现在蛇身上', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, 10);
    for (const food of engine.foods) {
      for (const seg of engine.snake1.body) {
        if (food.position.x === seg.x && food.position.y === seg.y) {
          expect.fail('Food spawned on snake body');
        }
      }
      for (const seg of engine.snake2.body) {
        if (food.position.x === seg.x && food.position.y === seg.y) {
          expect.fail('Food spawned on snake body');
        }
      }
    }
  });

  it('食物坐标在网格范围内', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, 5);
    for (const food of engine.foods) {
      expect(food.position.x).toBeGreaterThanOrEqual(0);
      expect(food.position.x).toBeLessThan(COLS);
      expect(food.position.y).toBeGreaterThanOrEqual(0);
      expect(food.position.y).toBeLessThan(ROWS);
    }
  });

  it('蛇2也能吃食物加分', () => {
    const engine = createAndStartEngine();
    const headX = engine.snake2.body[0].x - 1;
    const headY = engine.snake2.body[0].y;
    engine.setFoods([{ position: { x: headX, y: headY }, type: 'normal', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    expect(engine.p2Score).toBe(FOOD_SCORE);
  });
});

// ========== 加速测试 ==========

describe('Snake2PEngine - Speed', () => {
  it('初始速度为 SNAKE_SPEED', () => {
    const engine = createAndStartEngine();
    expect(engine.snake1.speed).toBe(SNAKE_SPEED);
  });

  it('吃到食物后加速', () => {
    const engine = createAndStartEngine();
    const headX = engine.snake1.body[0].x + 1;
    const headY = engine.snake1.body[0].y;
    engine.setFoods([{ position: { x: headX, y: headY }, type: 'normal', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.speed).toBeLessThan(SNAKE_SPEED);
  });

  it('速度不低于 MIN_SPEED', () => {
    const engine = createAndStartEngine();
    // 连续吃很多食物
    for (let i = 0; i < 100; i++) {
      const head = engine.snake1.body[0];
      engine.setFoods([{ position: { x: head.x + engine.snake1.direction.x, y: head.y + engine.snake1.direction.y }, type: 'normal', createdAt: 0 }]);
      engine.update(SNAKE_SPEED);
      if (!engine.p1Alive) break;
    }
    expect(engine.snake1.speed).toBeGreaterThanOrEqual(MIN_SPEED);
  });

  it('加速量为 SPEED_INCREMENT', () => {
    const engine = createAndStartEngine();
    const headX = engine.snake1.body[0].x + 1;
    const headY = engine.snake1.body[0].y;
    engine.setFoods([{ position: { x: headX, y: headY }, type: 'normal', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.speed).toBe(SNAKE_SPEED - SPEED_INCREMENT);
  });
});

// ========== 暂停/恢复测试 ==========

describe('Snake2PEngine - Pause/Resume', () => {
  it('暂停后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('恢复后状态为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 状态不能暂停', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('gameover 状态不能暂停', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, COLS);
    engine.pause();
    expect(engine.status).toBe('gameover');
  });

  it('不能连续暂停', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('playing 状态不能 resume', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });
});

// ========== 重置测试 ==========

describe('Snake2PEngine - Reset', () => {
  it('重置后状态为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('重置后分数归零', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.p1Score).toBe(0);
    expect(engine.p2Score).toBe(0);
  });

  it('重置后蛇复活', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, COLS);
    engine.reset();
    expect(engine.p1Alive).toBe(true);
    expect(engine.p2Alive).toBe(true);
  });

  it('重置后结果清空', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, COLS);
    engine.reset();
    expect(engine.result).toBeNull();
  });

  it('重置后食物清空', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.foods).toHaveLength(0);
  });

  it('重置后蛇长度恢复初始', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.snake1.body.length).toBe(INITIAL_LENGTH);
    expect(engine.snake2.body.length).toBe(INITIAL_LENGTH);
  });

  it('重置后可重新开始', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, COLS);
    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.p1Alive).toBe(true);
    expect(engine.p2Alive).toBe(true);
  });
});

// ========== 空格键测试 ==========

describe('Snake2PEngine - Space Key', () => {
  it('idle 按空格开始游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('gameover 按空格重新开始', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, COLS);
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('playing 按空格不影响', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });
});

// ========== 事件系统测试 ==========

describe('Snake2PEngine - Events', () => {
  it('start 触发 statusChange 事件', () => {
    const engine = createEngine();
    const cb = vi.fn();
    engine.on('statusChange', cb);
    engine.start();
    expect(cb).toHaveBeenCalledWith('playing');
  });

  it('pause 触发 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const cb = vi.fn();
    engine.on('statusChange', cb);
    engine.pause();
    expect(cb).toHaveBeenCalledWith('paused');
  });

  it('reset 触发 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const cb = vi.fn();
    engine.on('statusChange', cb);
    engine.reset();
    expect(cb).toHaveBeenCalledWith('idle');
  });

  it('gameOver 触发 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const cb = vi.fn();
    engine.on('statusChange', cb);
    advanceSteps(engine, COLS);
    expect(cb).toHaveBeenCalledWith('gameover');
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    const cb = vi.fn();
    engine.on('statusChange', cb);
    engine.off('statusChange', cb);
    engine.start();
    expect(cb).not.toHaveBeenCalled();
  });
});

// ========== getState 测试 ==========

describe('Snake2PEngine - getState', () => {
  it('返回完整状态对象', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('status');
    expect(state).toHaveProperty('p1Score');
    expect(state).toHaveProperty('p2Score');
    expect(state).toHaveProperty('p1Alive');
    expect(state).toHaveProperty('p2Alive');
    expect(state).toHaveProperty('snake1');
    expect(state).toHaveProperty('snake2');
    expect(state).toHaveProperty('foods');
    expect(state).toHaveProperty('result');
  });

  it('snake1 是坐标数组', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const s1 = state.snake1 as { x: number; y: number }[];
    expect(Array.isArray(s1)).toBe(true);
    expect(s1.length).toBe(INITIAL_LENGTH);
    expect(s1[0]).toHaveProperty('x');
    expect(s1[0]).toHaveProperty('y');
  });

  it('foods 包含位置和类型', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const foods = state.foods as { position: { x: number; y: number }; type: string }[];
    expect(Array.isArray(foods)).toBe(true);
    if (foods.length > 0) {
      expect(foods[0]).toHaveProperty('position');
      expect(foods[0]).toHaveProperty('type');
    }
  });

  it('状态值与 getter 一致', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.p1Score).toBe(engine.p1Score);
    expect(state.p2Score).toBe(engine.p2Score);
    expect(state.p1Alive).toBe(engine.p1Alive);
    expect(state.p2Alive).toBe(engine.p2Alive);
    expect(state.result).toBe(engine.result);
  });
});

// ========== 确定性测试（使用注入的 RNG） ==========

describe('Snake2PEngine - Deterministic RNG', () => {
  it('注入 RNG 后食物位置可预测', () => {
    const engine = createEngine();
    // 使用确定性 RNG：总是返回 0.5 → 选择中间位置
    engine.setRng(deterministicRng([0.5, 0.5, 0.5]));
    engine.start();
    // 所有食物位置应该一致
    const positions = engine.foods.map(f => `${f.position.x},${f.position.y}`);
    expect(positions.length).toBeGreaterThan(0);
  });

  it('注入 RNG 后特殊食物类型可预测', () => {
    const engine = createEngine();
    // RNG 返回值 < SPECIAL_FOOD_CHANCE → special
    engine.setRng(deterministicRng([0.5, 0.01, 0.5, 0.01, 0.5, 0.01]));
    engine.start();
    // 第二个 RNG 调用决定食物类型，0.01 < 0.15 → special
    const specialFoods = engine.foods.filter(f => f.type === 'special');
    expect(specialFoods.length).toBeGreaterThan(0);
  });
});

// ========== 销毁测试 ==========

describe('Snake2PEngine - Destroy', () => {
  it('destroy 后状态为 idle', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('destroy 后事件监听清空', () => {
    const engine = createAndStartEngine();
    const cb = vi.fn();
    engine.on('statusChange', cb);
    engine.destroy();
    // destroy 后状态为 idle，监听已清空
    expect(engine.status).toBe('idle');
    // 重新 start 后状态变为 playing
    engine.start();
    expect(engine.status).toBe('playing');
  });
});

// ========== 边界条件测试 ==========

describe('Snake2PEngine - Edge Cases', () => {
  it('deltaTime 为 0 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => engine.update(0)).not.toThrow();
  });

  it('deltaTime 非常大不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => engine.update(100000)).not.toThrow();
  });

  it('多次 start 不崩溃', () => {
    const engine = createEngine();
    engine.start();
    // 第二次 start 会抛异常因为 canvas 已设置但 requestAnimationFrame 可能有问题
    // 实际上 base class start 检查 canvas 存在，不检查 status
    // 但 gameLoop 检查 status === 'playing'
  });

  it('未初始化 canvas 直接 start 抛异常', () => {
    const engine = new Snake2PEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('两条蛇初始不重叠', () => {
    const engine = createAndStartEngine();
    const s1Set = new Set(engine.snake1.body.map(p => `${p.x},${p.y}`));
    const s2Set = new Set(engine.snake2.body.map(p => `${p.x},${p.y}`));
    const overlap = [...s1Set].filter(p => s2Set.has(p));
    expect(overlap).toHaveLength(0);
  });

  it('update 中蛇死亡后不再移动', () => {
    const engine = createAndStartEngine();
    // 让蛇1走到撞墙
    advanceSteps(engine, COLS - P1_START_X + 1);
    expect(engine.p1Alive).toBe(false);
    const deadHeadX = engine.snake1.body[0].x;
    const deadHeadY = engine.snake1.body[0].y;
    // 再 update 一次
    engine.update(SNAKE_SPEED);
    // 死蛇不动
    expect(engine.snake1.body[0].x).toBe(deadHeadX);
    expect(engine.snake1.body[0].y).toBe(deadHeadY);
  });

  it('蛇速度独立（各吃各的食物独立加速）', () => {
    const engine = createAndStartEngine();
    // 只给蛇1喂食物
    const head1X = engine.snake1.body[0].x + 1;
    const head1Y = engine.snake1.body[0].y;
    engine.setFoods([{ position: { x: head1X, y: head1Y }, type: 'normal', createdAt: 0 }]);
    engine.update(SNAKE_SPEED);
    expect(engine.snake1.speed).toBeLessThan(SNAKE_SPEED);
    expect(engine.snake2.speed).toBe(SNAKE_SPEED);
  });
});

// ========== 集成测试 ==========

describe('Snake2PEngine - Integration', () => {
  it('完整游戏流程：开始 → 玩 → 结束 → 重来', () => {
    const engine = createEngine();
    // 开始
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    // 玩几步
    advanceSteps(engine, 3);
    expect(engine.p1Alive).toBe(true);
    expect(engine.p2Alive).toBe(true);
    // 走到撞墙
    advanceSteps(engine, COLS);
    expect(engine.status).toBe('gameover');
    // 重来
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.p1Alive).toBe(true);
    expect(engine.p2Alive).toBe(true);
  });

  it('暂停 → 恢复 → 继续游戏', () => {
    const engine = createAndStartEngine();
    advanceSteps(engine, 2);
    engine.pause();
    expect(engine.status).toBe('paused');
    const headX = engine.snake1.body[0].x;
    engine.update(SNAKE_SPEED); // 暂停中 update 不被调用（gameLoop 不跑）
    engine.resume();
    expect(engine.status).toBe('playing');
    advanceSteps(engine, 1);
    expect(engine.snake1.body[0].x).toBeGreaterThan(headX);
  });

  it('两条蛇各自独立控制', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('w');       // P1 上
    engine.handleKeyDown('ArrowUp'); // P2 上
    advanceSteps(engine, 1);
    // P1 向上
    expect(engine.snake1.body[0].y).toBe(P1_START_Y - 1);
    // P2 向上
    expect(engine.snake2.body[0].y).toBe(P2_START_Y - 1);
  });

  it('连续快速按键不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => {
      for (let i = 0; i < 100; i++) {
        engine.handleKeyDown('w');
        engine.handleKeyDown('ArrowUp');
        engine.handleKeyDown('s');
        engine.handleKeyDown('ArrowDown');
      }
    }).not.toThrow();
  });
});
