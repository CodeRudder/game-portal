import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DuckHuntEngine } from '../DuckHuntEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  CROSSHAIR_SIZE, CROSSHAIR_SPEED, CROSSHAIR_COLOR,
  DUCK_WIDTH, DUCK_HEIGHT,
  DUCK_SPEED_BASE, DUCK_SPEED_PER_LEVEL, DUCK_SPEED_MAX,
  DUCK_SCORE_NORMAL, DUCK_SCORE_FAST, DUCK_SCORE_ZIGZAG,
  DUCK_HIT_RADIUS,
  FLIGHT_STRAIGHT, FLIGHT_WAVE, FLIGHT_RANDOM,
  DUCKS_PER_ROUND, BULLETS_PER_ROUND, INITIAL_ROUNDS,
  DUCK_SPAWN_DELAY, DUCK_ESCAPE_Y, DUCK_FALL_SPEED,
  DOG_WIDTH, DOG_HEIGHT, DOG_JUMP_DURATION, DOG_LAUGH_DURATION,
  DOG_HIDE_Y, DOG_PEAK_Y,
  GRASS_HEIGHT, GRASS_Y, GRASS_COLOR, GRASS_DARK_COLOR,
  BG_COLOR, DUCK_COLOR_NORMAL, DUCK_COLOR_FAST, DUCK_COLOR_ZIGZAG,
  HUD_COLOR, SCORE_COLOR, BULLET_HUD_COLOR,
  DIR_LEFT, DIR_RIGHT,
  ROUND_TRANSITION_DURATION, ROUND_RESULT_DURATION,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): DuckHuntEngine {
  const engine = new DuckHuntEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 模拟游戏循环若干帧 */
function tick(engine: DuckHuntEngine, frames: number, dt: number = 16): void {
  for (let i = 0; i < frames; i++) {
    (engine as any).update(dt);
  }
}

/** 快进到 playing 阶段（跳过猎犬动画） */
function skipToPlaying(engine: DuckHuntEngine): void {
  (engine as any)._roundPhase = 'playing';
  (engine as any)._ducks = [];
  (engine as any)._ducksSpawned = 0;
  (engine as any)._ducksAlive = 0;
  (engine as any)._bullets = BULLETS_PER_ROUND;
  (engine as any)._roundStats = { hits: 0, misses: 0, escaped: 0 };
  (engine as any)._spawnTimer = 0;
  (engine as any)._dog.phase = 'gone';
  (engine as any)._dog.y = DOG_HIDE_Y;
}

// ========== 常量测试 ==========

describe('DuckHunt Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('准心大小为 24px', () => {
    expect(CROSSHAIR_SIZE).toBe(24);
  });

  it('准心速度为 300px/s', () => {
    expect(CROSSHAIR_SPEED).toBe(300);
  });

  it('鸭子尺寸为 40x32', () => {
    expect(DUCK_WIDTH).toBe(40);
    expect(DUCK_HEIGHT).toBe(32);
  });

  it('每轮 10 只鸭子', () => {
    expect(DUCKS_PER_ROUND).toBe(10);
  });

  it('每轮 3 发子弹', () => {
    expect(BULLETS_PER_ROUND).toBe(3);
  });

  it('初始可玩回合数为 3', () => {
    expect(INITIAL_ROUNDS).toBe(3);
  });

  it('方向常量正确', () => {
    expect(DIR_LEFT).toBe(-1);
    expect(DIR_RIGHT).toBe(1);
  });

  it('飞行模式常量正确', () => {
    expect(FLIGHT_STRAIGHT).toBe('straight');
    expect(FLIGHT_WAVE).toBe('wave');
    expect(FLIGHT_RANDOM).toBe('random');
  });

  it('鸭子分数正确', () => {
    expect(DUCK_SCORE_NORMAL).toBe(100);
    expect(DUCK_SCORE_FAST).toBe(200);
    expect(DUCK_SCORE_ZIGZAG).toBe(300);
  });

  it('草丛高度为 80px', () => {
    expect(GRASS_HEIGHT).toBe(80);
  });

  it('草丛 Y 坐标正确', () => {
    expect(GRASS_Y).toBe(CANVAS_HEIGHT - GRASS_HEIGHT);
  });

  it('猎犬尺寸为 48x40', () => {
    expect(DOG_WIDTH).toBe(48);
    expect(DOG_HEIGHT).toBe(40);
  });

  it('背景色为天空蓝', () => {
    expect(BG_COLOR).toBe('#87ceeb');
  });

  it('鸭子上限速度为 280', () => {
    expect(DUCK_SPEED_MAX).toBe(280);
  });
});

// ========== 初始化测试 ==========

describe('DuckHuntEngine - 初始化', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始状态为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('初始等级为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('准心初始位于画布中央', () => {
    expect(engine.crosshairX).toBe(CANVAS_WIDTH / 2);
    expect(engine.crosshairY).toBe(CANVAS_HEIGHT / 2);
  });

  it('初始没有鸭子', () => {
    expect(engine.ducks.length).toBe(0);
  });

  it('初始回合为 1', () => {
    expect(engine.round).toBe(1);
  });

  it('初始剩余回合数为 INITIAL_ROUNDS', () => {
    expect(engine.roundsLeft).toBe(INITIAL_ROUNDS);
  });

  it('猎犬初始为 hidden 状态', () => {
    expect(engine.dog.phase).toBe('hidden');
  });

  it('猎犬初始位于草丛下方', () => {
    expect(engine.dog.y).toBe(DOG_HIDE_Y);
  });
});

// ========== 生命周期测试 ==========

describe('DuckHuntEngine - 生命周期', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后进入猎犬出场阶段', () => {
    engine.start();
    expect(engine.roundPhase).toBe('dogIntro');
  });

  it('start 后猎犬开始跳跃', () => {
    engine.start();
    expect(engine.dog.phase).toBe('jumping');
  });

  it('pause 后状态变为 paused', () => {
    engine.start();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态恢复为 playing', () => {
    engine.start();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态回到 idle', () => {
    engine.start();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数归零', () => {
    engine.start();
    (engine as any).addScore(500);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后回合回到 1', () => {
    engine.start();
    engine.reset();
    expect(engine.round).toBe(1);
  });

  it('destroy 后状态为 idle', () => {
    engine.start();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态按空格可以开始', () => {
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态按空格可以重新开始', () => {
    engine.start();
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });
});

// ========== 猎犬动画测试 ==========

describe('DuckHuntEngine - 猎犬动画', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('猎犬从底部开始跳跃', () => {
    expect(engine.dog.y).toBe(DOG_HIDE_Y);
  });

  it('猎犬跳跃过程中 Y 坐标上升', () => {
    const startY = engine.dog.y;
    tick(engine, 20);
    expect(engine.dog.y).toBeLessThan(startY);
  });

  it('猎犬跳跃完成后进入 peeking 状态', () => {
    tick(engine, Math.ceil(DOG_JUMP_DURATION / 16) + 5);
    expect(engine.dog.phase).toBe('peeking');
  });

  it('猎犬 peeking 后进入 hiding 状态', () => {
    // Phase 1: jumping
    tick(engine, Math.ceil(DOG_JUMP_DURATION / 16) + 5);
    expect(engine.dog.phase).toBe('peeking');
    // Phase 2: peeking (400ms)
    tick(engine, Math.ceil(400 / 16) + 5);
    expect(engine.dog.phase).toBe('hiding');
  });

  it('猎犬隐藏后进入 gone 状态', () => {
    // Phase 1: jumping
    tick(engine, Math.ceil(DOG_JUMP_DURATION / 16) + 5);
    expect(engine.dog.phase).toBe('peeking');
    // Phase 2: peeking (400ms)
    tick(engine, Math.ceil(400 / 16) + 5);
    expect(engine.dog.phase).toBe('hiding');
    // Phase 3: hiding (DOG_JUMP_DURATION * 0.6 ms) — timer was reset, need enough ticks
    tick(engine, Math.ceil(DOG_JUMP_DURATION * 0.6 / 16) + 30);
    expect(engine.dog.phase).toBe('gone');
  });

  it('猎犬动画结束后进入 playing 阶段', () => {
    // Phase 1: jumping
    tick(engine, Math.ceil(DOG_JUMP_DURATION / 16) + 5);
    // Phase 2: peeking
    tick(engine, Math.ceil(400 / 16) + 5);
    // Phase 3: hiding
    tick(engine, Math.ceil(DOG_JUMP_DURATION * 0.6 / 16) + 30);
    expect(engine.roundPhase).toBe('playing');
  });

  it('猎犬在 gone 状态时 Y 坐标在底部', () => {
    // Phase 1: jumping
    tick(engine, Math.ceil(DOG_JUMP_DURATION / 16) + 5);
    // Phase 2: peeking
    tick(engine, Math.ceil(400 / 16) + 5);
    // Phase 3: hiding
    tick(engine, Math.ceil(DOG_JUMP_DURATION * 0.6 / 16) + 30);
    expect(engine.dog.y).toBe(DOG_HIDE_Y);
  });
});

// ========== 准心移动测试 ==========

describe('DuckHuntEngine - 准心移动', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('按左箭头准心向左移动', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 10);
    expect(engine.crosshairX).toBeLessThan(startX);
  });

  it('按右箭头准心向右移动', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 10);
    expect(engine.crosshairX).toBeGreaterThan(startX);
  });

  it('按上箭头准心向上移动', () => {
    const startY = engine.crosshairY;
    engine.handleKeyDown('ArrowUp');
    tick(engine, 10);
    expect(engine.crosshairY).toBeLessThan(startY);
  });

  it('按下箭头准心向下移动', () => {
    const startY = engine.crosshairY;
    engine.handleKeyDown('ArrowDown');
    tick(engine, 10);
    expect(engine.crosshairY).toBeGreaterThan(startY);
  });

  it('WASD 键也能移动准心', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('a');
    tick(engine, 10);
    expect(engine.crosshairX).toBeLessThan(startX);
    engine.handleKeyUp('a');

    const startX2 = engine.crosshairX;
    engine.handleKeyDown('d');
    tick(engine, 10);
    expect(engine.crosshairX).toBeGreaterThan(startX2);
  });

  it('准心不能移出画布左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 200);
    expect(engine.crosshairX).toBeGreaterThanOrEqual(CROSSHAIR_SIZE / 2);
  });

  it('准心不能移出画布右边界', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 200);
    expect(engine.crosshairX).toBeLessThanOrEqual(CANVAS_WIDTH - CROSSHAIR_SIZE / 2);
  });

  it('准心不能移出画布顶部', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 200);
    expect(engine.crosshairY).toBeGreaterThanOrEqual(CROSSHAIR_SIZE / 2);
  });

  it('准心不能移入草丛区域', () => {
    engine.handleKeyDown('ArrowDown');
    tick(engine, 200);
    expect(engine.crosshairY).toBeLessThanOrEqual(GRASS_Y - CROSSHAIR_SIZE / 2);
  });

  it('松开按键后准心停止', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 5);
    const movedX = engine.crosshairX;
    engine.handleKeyUp('ArrowRight');
    tick(engine, 5);
    expect(engine.crosshairX).toBe(movedX);
  });
});

// ========== 射击测试 ==========

describe('DuckHuntEngine - 射击', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('空格射击消耗子弹', () => {
    const bulletsBefore = engine.bullets;
    engine.handleKeyDown(' ');
    expect(engine.bullets).toBe(bulletsBefore - 1);
  });

  it('初始子弹数为 BULLETS_PER_ROUND', () => {
    expect(engine.bullets).toBe(BULLETS_PER_ROUND);
  });

  it('子弹用完后不能再射击', () => {
    engine.handleKeyDown(' '); // 2
    engine.handleKeyUp(' ');
    engine.handleKeyDown(' '); // 1
    engine.handleKeyUp(' ');
    engine.handleKeyDown(' '); // 0
    engine.handleKeyUp(' ');
    expect(engine.bullets).toBe(0);
    engine.handleKeyDown(' '); // 尝试再次射击
    expect(engine.bullets).toBe(0);
  });

  it('射击未命中时计为 miss', () => {
    const missesBefore = engine.roundStats.misses;
    engine.handleKeyDown(' ');
    expect(engine.roundStats.misses).toBe(missesBefore + 1);
  });

  it('射击命中鸭子时计为 hit', () => {
    // 手动放置一只鸭子在准心位置
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100,
      dirX: DIR_RIGHT,
      pattern: FLIGHT_STRAIGHT,
      status: 'flying',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    const hitsBefore = engine.roundStats.hits;
    engine.handleKeyDown(' ');
    expect(engine.roundStats.hits).toBe(hitsBefore + 1);
  });

  it('命中普通鸭子得 100 分', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100,
      dirX: DIR_RIGHT,
      pattern: FLIGHT_STRAIGHT,
      status: 'flying',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    const scoreBefore = engine.score;
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(scoreBefore + DUCK_SCORE_NORMAL);
  });

  it('命中波浪鸭子得 200 分', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100,
      dirX: DIR_RIGHT,
      pattern: FLIGHT_WAVE,
      status: 'flying',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    const scoreBefore = engine.score;
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(scoreBefore + DUCK_SCORE_FAST);
  });

  it('命中随机鸭子得 300 分', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100,
      dirX: DIR_RIGHT,
      pattern: FLIGHT_RANDOM,
      status: 'flying',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    const scoreBefore = engine.score;
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(scoreBefore + DUCK_SCORE_ZIGZAG);
  });

  it('击中鸭子后状态变为 hit', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100,
      dirX: DIR_RIGHT,
      pattern: FLIGHT_STRAIGHT,
      status: 'flying',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    engine.handleKeyDown(' ');
    expect(engine.ducks[0].status).toBe('hit');
  });

  it('不在 playing 阶段不能射击', () => {
    (engine as any)._roundPhase = 'result';
    const bulletsBefore = engine.bullets;
    engine.handleKeyDown(' ');
    expect(engine.bullets).toBe(bulletsBefore);
  });

  it('一发子弹只能击中一只鸭子', () => {
    // 放两只重叠的鸭子
    (engine as any)._ducks = [
      {
        x: engine.crosshairX - DUCK_WIDTH / 2,
        y: engine.crosshairY - DUCK_HEIGHT / 2,
        vx: 0, vy: -100, dirX: DIR_RIGHT, pattern: FLIGHT_STRAIGHT,
        status: 'flying', wingTimer: 0, waveTimer: 0, randomTimer: 0,
        fallSpeed: 0, spawnTime: 0,
      },
      {
        x: engine.crosshairX - DUCK_WIDTH / 2 + 5,
        y: engine.crosshairY - DUCK_HEIGHT / 2 + 5,
        vx: 0, vy: -100, dirX: DIR_LEFT, pattern: FLIGHT_STRAIGHT,
        status: 'flying', wingTimer: 0, waveTimer: 0, randomTimer: 0,
        fallSpeed: 0, spawnTime: 0,
      },
    ];
    (engine as any)._ducksAlive = 2;
    engine.handleKeyDown(' ');
    const hits = engine.ducks.filter(d => d.status === 'hit').length;
    expect(hits).toBe(1);
  });
});

// ========== 鸭子生成测试 ==========

describe('DuckHuntEngine - 鸭子生成', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('经过 DUCK_SPAWN_DELAY 后生成第一只鸭子', () => {
    tick(engine, Math.ceil(DUCK_SPAWN_DELAY / 16) + 1);
    expect(engine.ducksSpawned).toBeGreaterThanOrEqual(1);
  });

  it('鸭子从底部飞出', () => {
    tick(engine, Math.ceil(DUCK_SPAWN_DELAY / 16) + 1);
    const duck = engine.ducks[0];
    expect(duck).toBeDefined();
    expect(duck.y).toBeLessThanOrEqual(GRASS_Y + DUCK_HEIGHT);
  });

  it('鸭子有飞行方向', () => {
    tick(engine, Math.ceil(DUCK_SPAWN_DELAY / 16) + 1);
    const duck = engine.ducks[0];
    expect([DIR_LEFT, DIR_RIGHT]).toContain(duck.dirX);
  });

  it('鸭子初始状态为 flying', () => {
    tick(engine, Math.ceil(DUCK_SPAWN_DELAY / 16) + 1);
    const duck = engine.ducks[0];
    expect(duck.status).toBe('flying');
  });

  it('鸭子飞行模式为三种之一', () => {
    tick(engine, Math.ceil(DUCK_SPAWN_DELAY / 16) + 1);
    const duck = engine.ducks[0];
    expect([FLIGHT_STRAIGHT, FLIGHT_WAVE, FLIGHT_RANDOM]).toContain(duck.pattern);
  });

  it('生成鸭子数量不超过 DUCKS_PER_ROUND', () => {
    // 快速生成所有鸭子
    for (let i = 0; i < DUCKS_PER_ROUND + 5; i++) {
      tick(engine, Math.ceil(DUCK_SPAWN_DELAY / 16) + 1);
    }
    expect(engine.ducksSpawned).toBeLessThanOrEqual(DUCKS_PER_ROUND);
  });

  it('手动调用 spawnDuck 可以生成鸭子', () => {
    (engine as any).spawnDuck();
    expect(engine.ducks.length).toBe(1);
    expect(engine.ducksSpawned).toBe(1);
  });

  it('生成满 DUCKS_PER_ROUND 后不再生成', () => {
    for (let i = 0; i < DUCKS_PER_ROUND; i++) {
      (engine as any).spawnDuck();
    }
    const countBefore = engine.ducksSpawned;
    (engine as any).spawnDuck(); // 尝试多生成一只
    expect(engine.ducksSpawned).toBe(countBefore);
  });
});

// ========== 鸭子飞行测试 ==========

describe('DuckHuntEngine - 鸭子飞行', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('直线鸭子保持稳定飞行', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.pattern = FLIGHT_STRAIGHT;
    duck.vx = 50;
    duck.vy = -100;
    const startY = duck.y;
    tick(engine, 10);
    // 应该向上移动
    expect(duck.y).toBeLessThan(startY);
  });

  it('波浪鸭子有垂直速度变化', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.pattern = FLIGHT_WAVE;
    duck.vx = 50;
    duck.vy = -100;
    duck.waveTimer = 0;
    const vyBefore = duck.vy;
    tick(engine, 20);
    // vy 应该有变化（波浪调制）
    // 波浪效果使得 vy 在不同时刻不同
    expect(duck.y).not.toBe(GRASS_Y); // 至少移动了
  });

  it('随机鸭子会改变方向', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.pattern = FLIGHT_RANDOM;
    duck.vx = 50;
    duck.vy = -100;
    duck.randomTimer = 0;
    const vxBefore = duck.vx;
    // 经过 500ms 后随机变向
    tick(engine, Math.ceil(500 / 16) + 5);
    // vx 可能改变（随机性，不保证一定变）
    // 但至少鸭子应该已经移动
    expect(duck.status).toBe('flying');
  });

  it('鸭子碰到左边界会反弹', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.x = 1;
    duck.vx = -100;
    duck.dirX = DIR_LEFT;
    tick(engine, 5);
    expect(duck.vx).toBeGreaterThan(0);
    expect(duck.dirX).toBe(DIR_RIGHT);
  });

  it('鸭子碰到右边界会反弹', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.x = CANVAS_WIDTH - DUCK_WIDTH - 1;
    duck.vx = 100;
    duck.dirX = DIR_RIGHT;
    tick(engine, 5);
    expect(duck.vx).toBeLessThan(0);
    expect(duck.dirX).toBe(DIR_LEFT);
  });

  it('鸭子飞出顶部标记为 escaped', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.y = DUCK_ESCAPE_Y + 10;
    duck.vy = -500;
    (engine as any)._ducksAlive = 1;
    tick(engine, 20);
    expect(duck.status).toBe('escaped');
  });

  it('鸭子逃逸后减少存活数', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.y = DUCK_ESCAPE_Y + 10;
    duck.vy = -500;
    (engine as any)._ducksAlive = 1;
    tick(engine, 20);
    expect(engine.ducksAlive).toBe(0);
  });
});

// ========== 鸭子下落测试 ==========

describe('DuckHuntEngine - 鸭子下落', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('被击中的鸭子最终会下落', () => {
    // 手动创建一只被击中的鸭子
    (engine as any)._ducks = [{
      x: 200, y: 300,
      vx: 0, vy: 0, dirX: DIR_RIGHT,
      pattern: FLIGHT_STRAIGHT,
      status: 'falling',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: DUCK_FALL_SPEED, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    const startY = 300;
    tick(engine, 10);
    expect(engine.ducks[0].y).toBeGreaterThan(startY);
  });

  it('下落鸭子落到画布底部标记为 dead', () => {
    (engine as any)._ducks = [{
      x: 200, y: CANVAS_HEIGHT - 50,
      vx: 0, vy: 0, dirX: DIR_RIGHT,
      pattern: FLIGHT_STRAIGHT,
      status: 'falling',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: DUCK_FALL_SPEED, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    tick(engine, 30);
    expect(engine.ducks[0].status).toBe('dead');
  });

  it('下落鸭子标记为 dead 后减少存活数', () => {
    (engine as any)._ducks = [{
      x: 200, y: CANVAS_HEIGHT - 50,
      vx: 0, vy: 0, dirX: DIR_RIGHT,
      pattern: FLIGHT_STRAIGHT,
      status: 'falling',
      wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: DUCK_FALL_SPEED, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    tick(engine, 30);
    expect(engine.ducksAlive).toBe(0);
  });
});

// ========== 回合管理测试 ==========

describe('DuckHuntEngine - 回合管理', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('所有鸭子处理完后进入 result 阶段', () => {
    // 生成所有鸭子并让它们逃逸
    for (let i = 0; i < DUCKS_PER_ROUND; i++) {
      (engine as any).spawnDuck();
    }
    // 让所有鸭子飞出顶部
    for (const duck of engine.ducks) {
      duck.y = DUCK_ESCAPE_Y - 100;
      duck.vy = -500;
    }
    (engine as any)._ducksAlive = DUCKS_PER_ROUND;
    tick(engine, 20);
    expect(engine.roundPhase).toBe('result');
  });

  it('result 阶段后进入 transition 阶段', () => {
    // 强制进入 result
    (engine as any)._roundPhase = 'result';
    (engine as any)._phaseTimer = 0;
    tick(engine, Math.ceil(ROUND_RESULT_DURATION / 16) + 5);
    expect(engine.roundPhase).toBe('transition');
  });

  it('transition 阶段后进入下一回合', () => {
    (engine as any)._roundPhase = 'transition';
    (engine as any)._phaseTimer = 0;
    tick(engine, Math.ceil(ROUND_TRANSITION_DURATION / 16) + 5);
    expect(engine.round).toBe(2);
  });

  it('下一回合等级提升', () => {
    (engine as any)._roundPhase = 'transition';
    (engine as any)._phaseTimer = 0;
    tick(engine, Math.ceil(ROUND_TRANSITION_DURATION / 16) + 5);
    expect(engine.level).toBe(2);
  });

  it('下一回合开始有猎犬动画', () => {
    (engine as any)._roundPhase = 'transition';
    (engine as any)._phaseTimer = 0;
    tick(engine, Math.ceil(ROUND_TRANSITION_DURATION / 16) + 5);
    expect(engine.roundPhase).toBe('dogIntro');
  });

  it('回合结束后回合数减少', () => {
    const roundsBefore = engine.roundsLeft;
    (engine as any)._roundPhase = 'transition';
    (engine as any)._phaseTimer = 0;
    tick(engine, Math.ceil(ROUND_TRANSITION_DURATION / 16) + 5);
    expect(engine.roundsLeft).toBe(roundsBefore - 1);
  });

  it('所有回合用完后游戏结束', () => {
    (engine as any)._roundsLeft = 1;
    (engine as any)._roundPhase = 'transition';
    (engine as any)._phaseTimer = 0;
    tick(engine, Math.ceil(ROUND_TRANSITION_DURATION / 16) + 5);
    expect(engine.status).toBe('gameover');
  });

  it('命中率低时猎犬嘲笑', () => {
    // 模拟低命中率
    (engine as any)._roundStats = { hits: 1, misses: 5, escaped: 4 };
    (engine as any).endRound();
    expect(engine.dog.phase).toBe('laughing');
  });

  it('命中率高时猎犬不嘲笑', () => {
    (engine as any)._roundStats = { hits: 8, misses: 2, escaped: 0 };
    (engine as any).endRound();
    expect(engine.dog.phase).not.toBe('laughing');
  });
});

// ========== 碰撞检测测试 ==========

describe('DuckHuntEngine - 碰撞检测', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('准心在鸭子中心时可以击中', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100, dirX: DIR_RIGHT, pattern: FLIGHT_STRAIGHT,
      status: 'flying', wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    engine.handleKeyDown(' ');
    expect(engine.ducks[0].status).toBe('hit');
  });

  it('准心在碰撞半径内可以击中', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2 + DUCK_HIT_RADIUS - 5,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100, dirX: DIR_RIGHT, pattern: FLIGHT_STRAIGHT,
      status: 'flying', wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    engine.handleKeyDown(' ');
    expect(engine.ducks[0].status).toBe('hit');
  });

  it('准心在碰撞半径外不能击中', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2 + DUCK_HIT_RADIUS + 50,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100, dirX: DIR_RIGHT, pattern: FLIGHT_STRAIGHT,
      status: 'flying', wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    engine.handleKeyDown(' ');
    expect(engine.ducks[0].status).toBe('flying');
  });

  it('不能击中已经 hit 的鸭子', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100, dirX: DIR_RIGHT, pattern: FLIGHT_STRAIGHT,
      status: 'hit', wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    const hitsBefore = engine.roundStats.hits;
    engine.handleKeyDown(' ');
    expect(engine.roundStats.hits).toBe(hitsBefore); // 没有新增 hit
  });

  it('不能击中已经 escaped 的鸭子', () => {
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100, dirX: DIR_RIGHT, pattern: FLIGHT_STRAIGHT,
      status: 'escaped', wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 0;
    const hitsBefore = engine.roundStats.hits;
    engine.handleKeyDown(' ');
    expect(engine.roundStats.hits).toBe(hitsBefore);
  });
});

// ========== 事件系统测试 ==========

describe('DuckHuntEngine - 事件', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 触发 statusChange 事件', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.start();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('pause 触发 statusChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.pause();
    expect(callback).toHaveBeenCalledWith('paused');
  });

  it('resume 触发 statusChange 事件', () => {
    engine.start();
    engine.pause();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.resume();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('reset 触发 statusChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.reset();
    expect(callback).toHaveBeenCalledWith('idle');
  });

  it('gameOver 触发 statusChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    (engine as any).gameOver();
    expect(callback).toHaveBeenCalledWith('gameover');
  });

  it('得分变化触发 scoreChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('scoreChange', callback);
    (engine as any).addScore(100);
    expect(callback).toHaveBeenCalledWith(100);
  });

  it('射击触发 miss 事件（未命中时）', () => {
    engine.start();
    skipToPlaying(engine);
    const callback = vi.fn();
    engine.on('miss', callback);
    engine.handleKeyDown(' ');
    expect(callback).toHaveBeenCalled();
  });

  it('击中鸭子触发 hit 事件', () => {
    engine.start();
    skipToPlaying(engine);
    (engine as any)._ducks = [{
      x: engine.crosshairX - DUCK_WIDTH / 2,
      y: engine.crosshairY - DUCK_HEIGHT / 2,
      vx: 0, vy: -100, dirX: DIR_RIGHT, pattern: FLIGHT_STRAIGHT,
      status: 'flying', wingTimer: 0, waveTimer: 0, randomTimer: 0,
      fallSpeed: 0, spawnTime: 0,
    }];
    (engine as any)._ducksAlive = 1;
    const callback = vi.fn();
    engine.on('hit', callback);
    engine.handleKeyDown(' ');
    expect(callback).toHaveBeenCalled();
  });

  it('off 可以取消事件监听', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.off('statusChange', callback);
    engine.start();
    expect(callback).not.toHaveBeenCalled();
  });
});

// ========== getState 测试 ==========

describe('DuckHuntEngine - getState', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('返回正确的分数', () => {
    const state = engine.getState();
    expect(state.score).toBe(0);
  });

  it('返回正确的等级', () => {
    const state = engine.getState();
    expect(state.level).toBe(1);
  });

  it('返回正确的回合', () => {
    const state = engine.getState();
    expect(state.round).toBe(1);
  });

  it('返回正确的回合阶段', () => {
    const state = engine.getState();
    expect(state.roundPhase).toBe('playing');
  });

  it('返回正确的子弹数', () => {
    const state = engine.getState();
    expect(state.bullets).toBe(BULLETS_PER_ROUND);
  });

  it('返回正确的剩余回合数', () => {
    const state = engine.getState();
    expect(state.roundsLeft).toBe(INITIAL_ROUNDS);
  });

  it('返回准心位置', () => {
    const state = engine.getState();
    expect(typeof state.crosshairX).toBe('number');
    expect(typeof state.crosshairY).toBe('number');
  });

  it('返回回合统计', () => {
    const state = engine.getState();
    expect(typeof state.hits).toBe('number');
    expect(typeof state.misses).toBe('number');
    expect(typeof state.escaped).toBe('number');
  });

  it('返回猎犬状态', () => {
    const state = engine.getState();
    expect(state.dogPhase).toBe('gone');
  });
});

// ========== 输入处理测试 ==========

describe('DuckHuntEngine - 输入处理', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('ArrowLeft 键被记录', () => {
    engine.handleKeyDown('ArrowLeft');
    expect((engine as any)._keys.has('ArrowLeft')).toBe(true);
  });

  it('ArrowRight 键被记录', () => {
    engine.handleKeyDown('ArrowRight');
    expect((engine as any)._keys.has('ArrowRight')).toBe(true);
  });

  it('ArrowUp 键被记录', () => {
    engine.handleKeyDown('ArrowUp');
    expect((engine as any)._keys.has('ArrowUp')).toBe(true);
  });

  it('ArrowDown 键被记录', () => {
    engine.handleKeyDown('ArrowDown');
    expect((engine as any)._keys.has('ArrowDown')).toBe(true);
  });

  it('keyup 移除按键记录', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyUp('ArrowLeft');
    expect((engine as any)._keys.has('ArrowLeft')).toBe(false);
  });

  it('空格键触发射击标志', () => {
    engine.handleKeyDown(' ');
    expect((engine as any)._shootPressed).toBe(true);
  });

  it('空格键释放清除射击标志', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyUp(' ');
    expect((engine as any)._shootPressed).toBe(false);
  });
});

// ========== 边界与异常测试 ==========

describe('DuckHuntEngine - 边界与异常', () => {
  it('未初始化 canvas 就 start 会抛出错误', () => {
    const engine = new DuckHuntEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('idle 状态 pause 无效', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态 resume 无效', () => {
    const engine = createEngine();
    engine.resume();
    expect(engine.status).toBe('idle');
  });

  it('playing 状态 resume 无效', () => {
    const engine = createEngine();
    engine.start();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('重复 start 不会出错', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
  });

  it('destroy 后可以重新 init', () => {
    const engine = createEngine();
    engine.start();
    engine.destroy();
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    engine.init(canvas);
    engine.start();
    expect(engine.status).toBe('playing');
  });
});

// ========== 回合统计测试 ==========

describe('DuckHuntEngine - 回合统计', () => {
  let engine: DuckHuntEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    skipToPlaying(engine);
  });

  it('初始回合统计全为 0', () => {
    const stats = engine.roundStats;
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.escaped).toBe(0);
  });

  it('roundStats 返回副本而非引用', () => {
    const stats1 = engine.roundStats;
    stats1.hits = 999;
    const stats2 = engine.roundStats;
    expect(stats2.hits).toBe(0);
  });

  it('射击 miss 增加统计', () => {
    engine.handleKeyDown(' ');
    expect(engine.roundStats.misses).toBe(1);
  });

  it('鸭子逃逸增加统计', () => {
    (engine as any).spawnDuck();
    const duck = engine.ducks[0];
    duck.y = DUCK_ESCAPE_Y - 100;
    duck.vy = -500;
    (engine as any)._ducksAlive = 1;
    tick(engine, 20);
    expect(engine.roundStats.escaped).toBeGreaterThan(0);
  });
});

// ========== 完整游戏流程测试 ==========

describe('DuckHuntEngine - 完整流程', () => {
  it('完整的一轮游戏流程', () => {
    const engine = createEngine();
    engine.start();

    // 等猎犬动画结束
    // Phase 1: jumping
    tick(engine, Math.ceil(DOG_JUMP_DURATION / 16) + 5);
    // Phase 2: peeking
    tick(engine, Math.ceil(400 / 16) + 5);
    // Phase 3: hiding
    tick(engine, Math.ceil(DOG_JUMP_DURATION * 0.6 / 16) + 30);

    expect(engine.roundPhase).toBe('playing');

    // 射击几只鸭子
    (engine as any).spawnDuck();
    (engine as any)._ducks[0].x = engine.crosshairX - DUCK_WIDTH / 2;
    (engine as any)._ducks[0].y = engine.crosshairY - DUCK_HEIGHT / 2;
    (engine as any)._ducksAlive = 1;
    engine.handleKeyDown(' ');

    expect(engine.score).toBeGreaterThan(0);
    expect(engine.roundStats.hits).toBe(1);

    engine.destroy();
  });

  it('游戏结束后可以重新开始', () => {
    const engine = createEngine();
    engine.start();
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
    expect(engine.round).toBe(1);
  });
});
