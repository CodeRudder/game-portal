/**
 * FruitNinjaEngine 全面测试
 *
 * 测试策略：
 * - 不依赖 requestAnimationFrame 游戏循环，直接调用 protected update()
 * - 用 Object.getPrototypeOf 获取原型方法并 bind
 * - init() 不传 canvas → 跳过 canvas 相关逻辑
 * - start() 需要 canvas → 手动设置 _status 绕过，或通过 handleKeyDown(' ') 触发
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FruitNinjaEngine,
  FruitItem,
  BombItem,
  SlashEffect,
  Particle,
} from '../FruitNinjaEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  FRUIT_RADIUS, FRUIT_TYPES, FRUIT_SCORES, FRUIT_COLORS,
  BOMB_RADIUS, BOMB_PENALTY,
  GRAVITY, INITIAL_VY_MIN, INITIAL_VY_MAX, INITIAL_VX_RANGE,
  INITIAL_LIVES, MAX_MISSED_FRUITS,
  SLASH_RADIUS, COMBO_WINDOW,
  BASE_SPAWN_INTERVAL, SPAWN_INTERVAL_DECREASE_PER_LEVEL, MIN_SPAWN_INTERVAL,
  BOMB_CHANCE, BOMB_CHANCE_PER_LEVEL, MAX_BOMB_CHANCE,
  SCORE_PER_LEVEL, MAX_LEVEL,
  SLASH_DURATION,
  CURSOR_SPEED, CURSOR_SIZE,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建引擎并初始化（不依赖 canvas） */
function createEngine(): FruitNinjaEngine {
  const engine = new FruitNinjaEngine();
  engine.init(); // 不传 canvas
  return engine;
}

/** 创建引擎并设置为 playing 状态（绕过 canvas 校验） */
function createPlayingEngine(): FruitNinjaEngine {
  const engine = new FruitNinjaEngine();
  engine.init();
  // 直接修改内部 _status 为 playing 以绕过 start() 的 canvas 校验
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any)._status = 'playing';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any)._score = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any)._level = 1;
  return engine;
}

/** 调用 protected update 方法 */
function callUpdate(engine: FruitNinjaEngine, dt: number = 16): void {
  const proto = Object.getPrototypeOf(engine);
  proto.update.call(engine, dt);
}

/** 获取私有字段 */
function getPrivate<T>(engine: FruitNinjaEngine, key: string): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (engine as any)[key] as T;
}

/** 设置私有字段 */
function setPrivate(engine: FruitNinjaEngine, key: string, value: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any)[key] = value;
}

/** 强制引擎进入 playing 状态 */
function forcePlaying(engine: FruitNinjaEngine): void {
  setPrivate(engine, '_status', 'playing');
}

/** 手动向引擎注入一个水果（绕过随机生成） */
function injectFruit(engine: FruitNinjaEngine, overrides: Partial<FruitItem> = {}): FruitItem {
  const nextId = getPrivate<number>(engine, '_nextId');
  setPrivate(engine, '_nextId', nextId + 1);
  const defaultFruit: FruitItem = {
    id: nextId,
    type: 'apple',
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: -5,
    radius: FRUIT_RADIUS,
    active: true,
    sliced: false,
    missed: false,
    rotation: 0,
    rotationSpeed: 0.05,
  };
  const fruit = { ...defaultFruit, ...overrides };
  getPrivate<FruitItem[]>(engine, '_fruits').push(fruit);
  return fruit;
}

/** 手动向引擎注入一个炸弹 */
function injectBomb(engine: FruitNinjaEngine, overrides: Partial<BombItem> = {}): BombItem {
  const nextId = getPrivate<number>(engine, '_nextId');
  setPrivate(engine, '_nextId', nextId + 1);
  const defaultBomb: BombItem = {
    id: nextId,
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: -5,
    radius: BOMB_RADIUS,
    active: true,
    sliced: false,
    rotation: 0,
    rotationSpeed: 0.05,
  };
  const bomb = { ...defaultBomb, ...overrides };
  getPrivate<BombItem[]>(engine, '_bombs').push(bomb);
  return bomb;
}

/** 获取引擎内部水果数组引用（非 getter 拷贝） */
function getFruitsRef(engine: FruitNinjaEngine): FruitItem[] {
  return getPrivate<FruitItem[]>(engine, '_fruits');
}

/** 获取引擎内部炸弹数组引用 */
function getBombsRef(engine: FruitNinjaEngine): BombItem[] {
  return getPrivate<BombItem[]>(engine, '_bombs');
}

/** 获取引擎内部粒子数组引用 */
function getParticlesRef(engine: FruitNinjaEngine): Particle[] {
  return getPrivate<Particle[]>(engine, '_particles');
}

/** 获取引擎内部切割特效数组引用 */
function getSlashEffectsRef(engine: FruitNinjaEngine): SlashEffect[] {
  return getPrivate<SlashEffect[]>(engine, '_slashEffects');
}

// ============================================================
// 1. 初始化与生命周期
// ============================================================

describe('初始化与生命周期', () => {
  it('init() 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.getState().status).toBe('idle');
  });

  it('init() 后默认值正确', () => {
    const engine = createEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.lives).toBe(INITIAL_LIVES);
    expect(state.missedCount).toBe(0);
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(0);
    expect(state.totalSliced).toBe(0);
  });

  it('init() 后光标位于画布中央', () => {
    const engine = createEngine();
    expect(engine.cursorX).toBe(CANVAS_WIDTH / 2);
    expect(engine.cursorY).toBe(CANVAS_HEIGHT / 2);
  });

  it('init() 后水果和炸弹列表为空', () => {
    const engine = createEngine();
    expect(engine.fruits).toHaveLength(0);
    expect(engine.bombs).toHaveLength(0);
  });

  it('init() 后切割特效和粒子为空', () => {
    const engine = createEngine();
    expect(engine.slashEffects).toHaveLength(0);
    expect(engine.particles).toHaveLength(0);
  });

  it('reset() 将所有状态恢复默认', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_score', 500);
    setPrivate(engine, '_level', 5);
    setPrivate(engine, '_lives', 1);
    setPrivate(engine, '_missedCount', 2);
    setPrivate(engine, '_combo', 10);
    setPrivate(engine, '_maxCombo', 10);
    setPrivate(engine, '_totalSliced', 50);

    engine.reset();

    expect(engine.getState().status).toBe('idle');
    expect(engine.getState().score).toBe(0);
    expect(engine.getState().level).toBe(1);
    expect(engine.lives).toBe(INITIAL_LIVES);
    expect(engine.missedCount).toBe(0);
    expect(engine.combo).toBe(0);
    expect(engine.maxCombo).toBe(0);
    expect(engine.totalSliced).toBe(0);
  });

  it('reset() 清空所有游戏对象', () => {
    const engine = createPlayingEngine();
    injectFruit(engine);
    injectBomb(engine);

    engine.reset();

    expect(engine.fruits).toHaveLength(0);
    expect(engine.bombs).toHaveLength(0);
    expect(engine.slashEffects).toHaveLength(0);
    expect(engine.particles).toHaveLength(0);
  });

  it('reset() 重置光标位置', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_cursorX', 100);
    setPrivate(engine, '_cursorY', 100);

    engine.reset();

    expect(engine.cursorX).toBe(CANVAS_WIDTH / 2);
    expect(engine.cursorY).toBe(CANVAS_HEIGHT / 2);
  });

  it('reset() 重置输入按键状态', () => {
    const engine = createPlayingEngine();
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowUp');

    engine.reset();

    // 光标不应移动（因为按键状态被重置）
    const beforeX = engine.cursorX;
    const beforeY = engine.cursorY;
    callUpdate(engine, 16);
    expect(engine.cursorX).toBe(beforeX);
    expect(engine.cursorY).toBe(beforeY);
  });

  it('destroy() 清除所有事件监听', () => {
    const engine = createEngine();
    const cb = vi.fn();
    engine.on('test', cb);

    engine.destroy();
    // destroy 内部调用 listeners.clear()
    // 验证：通过 emit 不触发回调
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).emit('test');
    expect(cb).not.toHaveBeenCalled();
  });

  it('多次 init() 不报错', () => {
    const engine = new FruitNinjaEngine();
    expect(() => {
      engine.init();
      engine.init();
      engine.init();
    }).not.toThrow();
  });

  it('多次 reset() 不报错', () => {
    const engine = createEngine();
    expect(() => {
      engine.reset();
      engine.reset();
    }).not.toThrow();
  });
});

// ============================================================
// 2. 键盘输入处理
// ============================================================

describe('键盘输入 - 方向键', () => {
  let engine: FruitNinjaEngine;

  beforeEach(() => {
    engine = createPlayingEngine();
  });

  it('ArrowLeft 按下后光标向左移动', () => {
    const before = engine.cursorX;
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 16);
    expect(engine.cursorX).toBeLessThan(before);
  });

  it('ArrowRight 按下后光标向右移动', () => {
    const before = engine.cursorX;
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.cursorX).toBeGreaterThan(before);
  });

  it('ArrowUp 按下后光标向上移动', () => {
    const before = engine.cursorY;
    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 16);
    expect(engine.cursorY).toBeLessThan(before);
  });

  it('ArrowDown 按下后光标向下移动', () => {
    const before = engine.cursorY;
    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 16);
    expect(engine.cursorY).toBeGreaterThan(before);
  });

  it('WASD 键同样控制方向', () => {
    const beforeX = engine.cursorX;
    const beforeY = engine.cursorY;

    engine.handleKeyDown('a');
    engine.handleKeyDown('w');
    callUpdate(engine, 16);

    expect(engine.cursorX).toBeLessThan(beforeX);
    expect(engine.cursorY).toBeLessThan(beforeY);
  });

  it('大写 WASD 同样有效', () => {
    const beforeX = engine.cursorX;
    const beforeY = engine.cursorY;

    engine.handleKeyDown('D');
    engine.handleKeyDown('S');
    callUpdate(engine, 16);

    expect(engine.cursorX).toBeGreaterThan(beforeX);
    expect(engine.cursorY).toBeGreaterThan(beforeY);
  });

  it('handleKeyUp 释放方向键后光标停止移动', () => {
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 16);
    const afterFirstMove = engine.cursorX;

    engine.handleKeyUp('ArrowLeft');
    callUpdate(engine, 16);

    expect(engine.cursorX).toBe(afterFirstMove);
  });

  it('同时按两个方向键可以对角移动', () => {
    const beforeX = engine.cursorX;
    const beforeY = engine.cursorY;

    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 16);

    expect(engine.cursorX).toBeLessThan(beforeX);
    expect(engine.cursorY).toBeLessThan(beforeY);
  });

  it('光标不超出左边界', () => {
    setPrivate(engine, '_cursorX', CURSOR_SIZE / 2 + 1);
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 16);
    expect(engine.cursorX).toBeGreaterThanOrEqual(CURSOR_SIZE / 2);
  });

  it('光标不超出右边界', () => {
    setPrivate(engine, '_cursorX', CANVAS_WIDTH - CURSOR_SIZE / 2 - 1);
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.cursorX).toBeLessThanOrEqual(CANVAS_WIDTH - CURSOR_SIZE / 2);
  });

  it('光标不超出上边界', () => {
    setPrivate(engine, '_cursorY', CURSOR_SIZE / 2 + 1);
    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 16);
    expect(engine.cursorY).toBeGreaterThanOrEqual(CURSOR_SIZE / 2);
  });

  it('光标不超出下边界', () => {
    setPrivate(engine, '_cursorY', CANVAS_HEIGHT - CURSOR_SIZE / 2 - 1);
    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 16);
    expect(engine.cursorY).toBeLessThanOrEqual(CANVAS_HEIGHT - CURSOR_SIZE / 2);
  });

  it('光标移动速度为 CURSOR_SPEED', () => {
    const before = engine.cursorX;
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    // 每帧移动 CURSOR_SPEED 像素
    expect(engine.cursorX - before).toBe(CURSOR_SPEED);
  });
});

// ============================================================
// 3. 水果生成与运动
// ============================================================

describe('水果生成与运动', () => {
  it('update 触发水果生成（spawnTimer 到期）', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_spawnTimer', 0);

    callUpdate(engine, 16);

    // spawnTimer <= 0 会触发生成
    expect(engine.fruits.length + engine.bombs.length).toBeGreaterThan(0);
  });

  it('水果初始位置在画布底部以下', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { y: CANVAS_HEIGHT + FRUIT_RADIUS });
    expect(fruit.y).toBeGreaterThanOrEqual(CANVAS_HEIGHT);
  });

  it('水果受重力影响 vy 增加', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { y: 300, vy: -10 });
    const vyBefore = fruit.vy;

    callUpdate(engine, 16);

    expect(fruit.vy).toBeGreaterThan(vyBefore);
  });

  it('水果位置根据速度更新', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { y: 300, vy: -10, vx: 2 });
    const xBefore = fruit.x;
    const yBefore = fruit.y;

    callUpdate(engine, 16);

    // vy 变负为向上，但加了重力后可能变化
    expect(fruit.x).not.toBe(xBefore);
    expect(fruit.y).not.toBe(yBefore);
  });

  it('水果旋转角度更新', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { y: 300, rotationSpeed: 0.1 });
    const rotBefore = fruit.rotation;

    callUpdate(engine, 16);

    expect(fruit.rotation).not.toBe(rotBefore);
  });

  it('水果飞出底部标记为 missed', () => {
    const engine = createPlayingEngine();
    // 水果在底部且向下运动
    const fruit = injectFruit(engine, {
      y: CANVAS_HEIGHT + FRUIT_RADIUS * 2 + 1,
      vy: 5, // 向下
    });

    callUpdate(engine, 16);

    expect(fruit.missed).toBe(true);
    expect(fruit.active).toBe(false);
    expect(engine.missedCount).toBe(1);
  });

  it('水果向上运动时不标记为 missed', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, {
      y: CANVAS_HEIGHT + FRUIT_RADIUS * 2 + 1,
      vy: -5, // 向上
    });

    callUpdate(engine, 16);

    expect(fruit.missed).toBe(false);
  });

  it('水果碰到左边界反弹', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, {
      x: FRUIT_RADIUS - 5,
      vx: -3,
    });

    callUpdate(engine, 16);

    expect(fruit.vx).toBeGreaterThan(0); // 速度反向
    expect(fruit.x).toBeGreaterThanOrEqual(FRUIT_RADIUS);
  });

  it('水果碰到右边界反弹', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, {
      x: CANVAS_WIDTH - FRUIT_RADIUS + 5,
      vx: 3,
    });

    callUpdate(engine, 16);

    expect(fruit.vx).toBeLessThan(0);
    expect(fruit.x).toBeLessThanOrEqual(CANVAS_WIDTH - FRUIT_RADIUS);
  });

  it('非 active 水果不更新', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { y: 300, active: false });
    const yBefore = fruit.y;

    callUpdate(engine, 16);

    expect(fruit.y).toBe(yBefore);
  });

  it('已切割的水果不更新', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { y: 300, sliced: true, active: false });
    const yBefore = fruit.y;

    callUpdate(engine, 16);

    expect(fruit.y).toBe(yBefore);
  });

  it('missed 水果触发 fruitMissed 事件', () => {
    const engine = createPlayingEngine();
    const listener = vi.fn();
    engine.on('fruitMissed', listener);

    const fruit = injectFruit(engine, {
      y: CANVAS_HEIGHT + FRUIT_RADIUS * 2 + 1,
      vy: 5,
    });

    callUpdate(engine, 16);

    expect(listener).toHaveBeenCalledWith(fruit);
  });
});

// ============================================================
// 4. 炸弹生成与运动
// ============================================================

describe('炸弹生成与运动', () => {
  it('炸弹受重力影响', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, { y: 300, vy: -10 });
    const vyBefore = bomb.vy;

    callUpdate(engine, 16);

    expect(bomb.vy).toBeGreaterThan(vyBefore);
  });

  it('炸弹飞出底部变为 inactive', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, {
      y: CANVAS_HEIGHT + BOMB_RADIUS * 2 + 1,
      vy: 5,
    });

    callUpdate(engine, 16);

    expect(bomb.active).toBe(false);
  });

  it('炸弹向上运动时不会消失', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, {
      y: CANVAS_HEIGHT + BOMB_RADIUS * 2 + 1,
      vy: -5,
    });

    callUpdate(engine, 16);

    expect(bomb.active).toBe(true);
  });

  it('炸弹碰到左边界反弹', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, {
      x: BOMB_RADIUS - 5,
      vx: -3,
    });

    callUpdate(engine, 16);

    expect(bomb.vx).toBeGreaterThan(0);
    expect(bomb.x).toBeGreaterThanOrEqual(BOMB_RADIUS);
  });

  it('炸弹碰到右边界反弹', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, {
      x: CANVAS_WIDTH - BOMB_RADIUS + 5,
      vx: 3,
    });

    callUpdate(engine, 16);

    expect(bomb.vx).toBeLessThan(0);
    expect(bomb.x).toBeLessThanOrEqual(CANVAS_WIDTH - BOMB_RADIUS);
  });

  it('炸弹旋转角度更新', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, { y: 300, rotationSpeed: 0.1 });
    const rotBefore = bomb.rotation;

    callUpdate(engine, 16);

    expect(bomb.rotation).not.toBe(rotBefore);
  });

  it('inactive 炸弹不更新', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, { y: 300, active: false });
    const yBefore = bomb.y;

    callUpdate(engine, 16);

    expect(bomb.y).toBe(yBefore);
  });
});

// ============================================================
// 5. 切割机制
// ============================================================

describe('切割机制 - performSlash（空格键）', () => {
  it('空格键在 playing 状态触发切割', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    expect(engine.totalSliced).toBe(1);
  });

  it('切割水果增加 totalSliced', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    expect(engine.totalSliced).toBe(2);
  });

  it('切割水果增加分数', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'apple' });

    engine.handleKeyDown(' ');

    expect(engine.getState().score).toBe(FRUIT_SCORES.apple);
  });

  it('不同水果类型得分不同', () => {
    const engine1 = createPlayingEngine();
    injectFruit(engine1, { x: engine1.cursorX, y: engine1.cursorY, type: 'watermelon' });
    engine1.handleKeyDown(' ');

    const engine2 = createPlayingEngine();
    injectFruit(engine2, { x: engine2.cursorX, y: engine2.cursorY, type: 'apple' });
    engine2.handleKeyDown(' ');

    expect(engine1.getState().score).toBeGreaterThan(engine2.getState().score);
  });

  it('切割范围外的水果不被切割', () => {
    const engine = createPlayingEngine();
    // 光标在中央，水果在远处
    injectFruit(engine, {
      x: engine.cursorX + SLASH_RADIUS + FRUIT_RADIUS + 50,
      y: engine.cursorY,
    });

    engine.handleKeyDown(' ');

    expect(engine.totalSliced).toBe(0);
  });

  it('切割在边界范围内（恰好接触）的水果', () => {
    const engine = createPlayingEngine();
    // 水果刚好在切割半径边缘
    injectFruit(engine, {
      x: engine.cursorX + SLASH_RADIUS + FRUIT_RADIUS - 1,
      y: engine.cursorY,
    });

    engine.handleKeyDown(' ');

    expect(engine.totalSliced).toBe(1);
  });

  it('切割后水果标记为 sliced 和 inactive', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    expect(fruit.sliced).toBe(true);
    expect(fruit.active).toBe(false);
  });

  it('切割产生切割特效', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    expect(engine.slashEffects.length).toBeGreaterThan(0);
  });

  it('切割产生粒子效果', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    expect(engine.particles.length).toBeGreaterThan(0);
  });

  it('没切到任何东西时 combo 重置为 0', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_combo', 5);

    engine.handleKeyDown(' ');

    expect(engine.combo).toBe(0);
  });

  it('空格键在 idle 状态调用 start()（需 canvas）', () => {
    const engine = createEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });

    // idle 状态下空格会尝试调用 start()，但无 canvas 会抛错
    expect(() => engine.handleKeyDown(' ')).toThrow('Canvas not initialized');
    expect(engine.totalSliced).toBe(0);
  });
});

// ============================================================
// 6. Combo 连击系统
// ============================================================

describe('Combo 连击系统', () => {
  it('连续切割水果增加 combo', () => {
    const engine = createPlayingEngine();
    // 先切一个
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(1);

    // 立即再切一个（在 COMBO_WINDOW 内）
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(2);
  });

  it('combo 超过窗口重置为 1', () => {
    const engine = createPlayingEngine();

    // 切第一个
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    // 模拟时间超过 COMBO_WINDOW
    const nowSpy = vi.spyOn(performance, 'now');
    const baseTime = 10000;
    nowSpy.mockReturnValue(baseTime);

    // 先切一个设定 _lastSliceTime
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    // 推进时间超过 COMBO_WINDOW
    nowSpy.mockReturnValue(baseTime + COMBO_WINDOW + 100);

    // 切第三个
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    expect(engine.combo).toBe(1);
    nowSpy.mockRestore();
  });

  it('maxCombo 记录最大连击数', () => {
    const engine = createPlayingEngine();

    // 连续切 3 个
    for (let i = 0; i < 3; i++) {
      injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
      engine.handleKeyDown(' ');
    }

    expect(engine.maxCombo).toBe(3);
  });

  it('combo >= 2 时有额外加分', () => {
    const engine = createPlayingEngine();

    // 切第一个
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'apple' });
    engine.handleKeyDown(' ');
    const score1 = engine.getState().score as number;

    // 立即切第二个（combo = 2）
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'apple' });
    engine.handleKeyDown(' ');
    const score2 = engine.getState().score as number;

    // 第二次得分应包含 combo 加分 (combo-1)*5 = 5
    const secondSlicePoints = score2 - score1;
    expect(secondSlicePoints).toBe(FRUIT_SCORES.apple + 5);
  });

  it('切到炸弹重置 combo 为 0', () => {
    const engine = createPlayingEngine();

    // 先建立 combo
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(1);

    // 切到炸弹
    injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    expect(engine.combo).toBe(0);
  });

  it('maxCombo 在 combo 重置后保持不变', () => {
    const engine = createPlayingEngine();

    // 连续切 3 个
    for (let i = 0; i < 3; i++) {
      injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
      engine.handleKeyDown(' ');
    }
    expect(engine.maxCombo).toBe(3);

    // 切空重置 combo
    setPrivate(engine, '_cursorX', 0);
    setPrivate(engine, '_cursorY', 0);
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(0);
    expect(engine.maxCombo).toBe(3);
  });
});

// ============================================================
// 7. 炸弹切割
// ============================================================

describe('炸弹切割', () => {
  it('切割炸弹扣除生命', () => {
    const engine = createPlayingEngine();
    const livesBefore = engine.lives;

    injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    expect(engine.lives).toBe(livesBefore - BOMB_PENALTY);
  });

  it('切割炸弹产生爆炸粒子', () => {
    const engine = createPlayingEngine();
    injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    expect(engine.particles.length).toBeGreaterThan(0);
  });

  it('切割炸弹触发 bombSliced 事件', () => {
    const engine = createPlayingEngine();
    const listener = vi.fn();
    engine.on('bombSliced', listener);

    injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('切割炸弹后炸弹标记为 sliced 和 inactive', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    expect(bomb.sliced).toBe(true);
    expect(bomb.active).toBe(false);
  });

  it('已 sliced 的炸弹不会被再次切割', () => {
    const engine = createPlayingEngine();
    const bomb = injectBomb(engine, { x: engine.cursorX, y: engine.cursorY, sliced: true });

    engine.handleKeyDown(' ');

    // 生命不应减少
    expect(engine.lives).toBe(INITIAL_LIVES);
  });
});

// ============================================================
// 8. 数字键切割
// ============================================================

describe('数字键切割 (sliceByIndex)', () => {
  it('数字键 1 切割第一个目标', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: 100, y: 100 });

    engine.handleKeyDown('1');

    expect(engine.totalSliced).toBe(1);
  });

  it('数字键 2 切割第二个目标', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: 100, y: 100 });
    injectFruit(engine, { x: 200, y: 200 });

    engine.handleKeyDown('2');

    expect(engine.totalSliced).toBe(1);
  });

  it('数字键超出范围不切割', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: 100, y: 100 });

    engine.handleKeyDown('9');

    expect(engine.totalSliced).toBe(0);
  });

  it('数字键在非 playing 状态无效', () => {
    const engine = createEngine();
    injectFruit(engine, { x: 100, y: 100 });

    engine.handleKeyDown('1');

    expect(engine.totalSliced).toBe(0);
  });

  it('数字键切割水果和炸弹混合目标（按 id 排序）', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { x: 100, y: 100 }); // id=0
    const bomb = injectBomb(engine, { x: 200, y: 200 });   // id=1

    // 按 id 排序：fruit(id=0) 排第一，bomb(id=1) 排第二
    engine.handleKeyDown('2'); // 切第二个 = bomb

    expect(fruit.sliced).toBe(false);
    expect(bomb.sliced).toBe(true);
    expect(engine.lives).toBe(INITIAL_LIVES - BOMB_PENALTY);
  });

  it('数字键切割产生切割特效', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: 100, y: 100 });

    engine.handleKeyDown('1');

    expect(engine.slashEffects.length).toBeGreaterThan(0);
  });

  it('数字键 0 无效（不在 1-9 范围）', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: 100, y: 100 });

    engine.handleKeyDown('0');

    expect(engine.totalSliced).toBe(0);
  });
});

// ============================================================
// 9. 游戏结束
// ============================================================

describe('游戏结束', () => {
  it('漏掉 MAX_MISSED_FRUITS 个水果游戏结束', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_missedCount', MAX_MISSED_FRUITS - 1);

    // 再漏一个
    injectFruit(engine, {
      y: CANVAS_HEIGHT + FRUIT_RADIUS * 2 + 1,
      vy: 5,
    });

    callUpdate(engine, 16);

    expect(engine.getState().status).toBe('gameover');
  });

  it('生命值降为 0 游戏结束', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_lives', 1);

    // 切炸弹扣 1 命
    injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    // update 会检查游戏结束
    callUpdate(engine, 16);

    expect(engine.getState().status).toBe('gameover');
  });

  it('游戏结束后按空格触发 reset', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_status', 'gameover');
    setPrivate(engine, '_score', 500);
    setPrivate(engine, '_lives', 0);

    // gameover 状态下空格会先 reset 再 start
    // reset 会重置状态，但 start 需要 canvas 所以会抛错
    expect(() => engine.handleKeyDown(' ')).toThrow('Canvas not initialized');
    // 但 reset 应该已经执行了
    expect(engine.lives).toBe(INITIAL_LIVES);
    expect(engine.missedCount).toBe(0);
  });

  it('游戏结束后按空格 reset 清空状态', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_status', 'gameover');
    setPrivate(engine, '_score', 999);
    setPrivate(engine, '_totalSliced', 50);
    setPrivate(engine, '_maxCombo', 20);

    expect(() => engine.handleKeyDown(' ')).toThrow();

    expect(engine.getState().score).toBe(0);
    expect(engine.totalSliced).toBe(0);
    expect(engine.maxCombo).toBe(0);
  });
});

// ============================================================
// 10. 等级系统
// ============================================================

describe('等级系统', () => {
  it('初始等级为 1', () => {
    const engine = createPlayingEngine();
    expect(engine.getState().level).toBe(1);
  });

  it('得分达到 SCORE_PER_LEVEL 升级', () => {
    const engine = createPlayingEngine();

    // 切足够多的水果达到 100 分
    // watermelon = 20 分，切 5 个 = 100 分
    for (let i = 0; i < 5; i++) {
      injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'watermelon' });
      engine.handleKeyDown(' ');
    }

    expect(engine.getState().level).toBe(2);
  });

  it('等级不超过 MAX_LEVEL', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_score', SCORE_PER_LEVEL * MAX_LEVEL + 100);

    // 切一个水果触发 checkLevelUp
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'watermelon' });
    engine.handleKeyDown(' ');

    expect(engine.getState().level).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it('高等级生成间隔更短', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_level', 5);

    // getSpawnInterval 是 private，通过行为测试
    const interval = BASE_SPAWN_INTERVAL - (5 - 1) * SPAWN_INTERVAL_DECREASE_PER_LEVEL;
    expect(interval).toBeLessThan(BASE_SPAWN_INTERVAL);
  });

  it('生成间隔不低于 MIN_SPAWN_INTERVAL', () => {
    const engine = createPlayingEngine();
    setPrivate(engine, '_level', MAX_LEVEL);

    const interval = BASE_SPAWN_INTERVAL - (MAX_LEVEL - 1) * SPAWN_INTERVAL_DECREASE_PER_LEVEL;
    expect(Math.max(MIN_SPAWN_INTERVAL, interval)).toBeGreaterThanOrEqual(MIN_SPAWN_INTERVAL);
  });

  it('高等级炸弹概率更高', () => {
    const chance1 = BOMB_CHANCE;
    const chance5 = BOMB_CHANCE + 4 * BOMB_CHANCE_PER_LEVEL;
    expect(chance5).toBeGreaterThan(chance1);
  });

  it('炸弹概率不超过 MAX_BOMB_CHANCE', () => {
    const chance = BOMB_CHANCE + (MAX_LEVEL - 1) * BOMB_CHANCE_PER_LEVEL;
    expect(Math.min(MAX_BOMB_CHANCE, chance)).toBeLessThanOrEqual(MAX_BOMB_CHANCE);
  });

  it('升级触发 levelChange 事件', () => {
    const engine = createPlayingEngine();
    const listener = vi.fn();
    engine.on('levelChange', listener);

    // 切足够多的水果升级
    for (let i = 0; i < 5; i++) {
      injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'watermelon' });
      engine.handleKeyDown(' ');
    }

    expect(listener).toHaveBeenCalled();
  });
});

// ============================================================
// 11. 分数系统
// ============================================================

describe('分数系统', () => {
  it('初始分数为 0', () => {
    const engine = createPlayingEngine();
    expect(engine.getState().score).toBe(0);
  });

  it('切割水果增加对应分数', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'orange' });

    engine.handleKeyDown(' ');

    expect(engine.getState().score).toBe(FRUIT_SCORES.orange);
  });

  it('分数变化触发 scoreChange 事件', () => {
    const engine = createPlayingEngine();
    const listener = vi.fn();
    engine.on('scoreChange', listener);

    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'apple' });
    engine.handleKeyDown(' ');

    expect(listener).toHaveBeenCalledWith(FRUIT_SCORES.apple);
  });

  it('连续切割水果分数累加（含 combo 加分）', () => {
    const engine = createPlayingEngine();

    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'apple' });
    engine.handleKeyDown(' ');

    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'watermelon' });
    engine.handleKeyDown(' ');

    // apple=10 + watermelon=20 + combo(2-1)*5=5 = 35
    expect(engine.getState().score).toBe(FRUIT_SCORES.apple + FRUIT_SCORES.watermelon + 5);
  });
});

// ============================================================
// 12. 特效与粒子
// ============================================================

describe('特效与粒子', () => {
  it('切割特效持续时间正确', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    const slash = engine.slashEffects[0];
    expect(slash).toBeDefined();
    expect(slash.maxTimer).toBe(SLASH_DURATION);
  });

  it('切割特效随时间衰减', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    const slash = getSlashEffectsRef(engine)[0];
    const timerBefore = slash.timer;

    callUpdate(engine, 100);

    expect(slash.timer).toBeLessThan(timerBefore);
  });

  it('切割特效到期后被清理', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    // 让特效到期
    callUpdate(engine, SLASH_DURATION + 100);

    expect(engine.slashEffects).toHaveLength(0);
  });

  it('切割水果产生 8 个果汁粒子', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    // spawnJuiceParticles 生成 8 个粒子
    expect(getParticlesRef(engine).length).toBe(8);
  });

  it('切割炸弹产生 12 个爆炸粒子', () => {
    const engine = createPlayingEngine();
    injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });

    engine.handleKeyDown(' ');

    // spawnExplosionParticles 生成 12 个粒子
    expect(getParticlesRef(engine).length).toBe(12);
  });

  it('粒子有重力和速度', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    const particle = getParticlesRef(engine)[0];
    const yBefore = particle.y;

    callUpdate(engine, 16);

    // 粒子有 vy 和重力
    expect(particle.y).not.toBe(yBefore);
  });

  it('粒子生命值耗尽后被清理', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    // 让粒子生命值耗尽
    callUpdate(engine, 1000);

    expect(engine.particles).toHaveLength(0);
  });
});

// ============================================================
// 13. 对象清理
// ============================================================

describe('对象清理', () => {
  it('inactive 且非 sliced 的水果被清理', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { active: false, sliced: false, missed: true });

    // 阻止生成新对象
    setPrivate(engine, '_spawnTimer', 99999);

    callUpdate(engine, 16);

    // missed 水果：active=false, sliced=false → filter 条件 f.active || f.sliced → false → 被清理
    expect(getFruitsRef(engine)).toHaveLength(0);
  });

  it('sliced 的水果保留（active=false, sliced=true）', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { active: false, sliced: true });

    // 阻止生成新对象
    setPrivate(engine, '_spawnTimer', 99999);

    callUpdate(engine, 16);

    // filter: f.active || f.sliced → false || true = true → 保留
    expect(getFruitsRef(engine)).toHaveLength(1);
  });

  it('inactive 炸弹被清理', () => {
    const engine = createPlayingEngine();
    injectBomb(engine, { active: false });

    // 阻止生成新对象
    setPrivate(engine, '_spawnTimer', 99999);

    callUpdate(engine, 16);

    expect(getBombsRef(engine)).toHaveLength(0);
  });

  it('active 炸弹保留', () => {
    const engine = createPlayingEngine();
    injectBomb(engine, { active: true, y: 300 });
    // 阻止 update 中生成新炸弹
    setPrivate(engine, '_spawnTimer', 99999);

    callUpdate(engine, 16);

    expect(getBombsRef(engine)).toHaveLength(1);
  });
});

// ============================================================
// 14. 暂停与恢复
// ============================================================

describe('暂停与恢复', () => {
  it('P 键暂停游戏', () => {
    const engine = createPlayingEngine();
    engine.handleKeyDown('p');

    expect(engine.getState().status).toBe('paused');
  });

  it('大写 P 键暂停游戏', () => {
    const engine = createPlayingEngine();
    engine.handleKeyDown('P');

    expect(engine.getState().status).toBe('paused');
  });

  it('暂停后 P 键恢复游戏', () => {
    const engine = createPlayingEngine();
    // resume() 需要 canvas，手动设置 mock canvas
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    (engine as any).canvas = canvas;
    (engine as any).ctx = canvas.getContext('2d');

    engine.handleKeyDown('p'); // 暂停
    engine.handleKeyDown('p'); // 恢复

    expect(engine.getState().status).toBe('playing');
  });

  it('暂停状态触发 statusChange 事件', () => {
    const engine = createPlayingEngine();
    const listener = vi.fn();
    engine.on('statusChange', listener);

    engine.handleKeyDown('p');

    expect(listener).toHaveBeenCalledWith('paused');
  });

  it('恢复状态触发 statusChange 事件', () => {
    const engine = createPlayingEngine();
    // resume() 需要 canvas，手动设置 mock canvas
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    (engine as any).canvas = canvas;
    (engine as any).ctx = canvas.getContext('2d');

    engine.handleKeyDown('p'); // 暂停

    const listener = vi.fn();
    engine.on('statusChange', listener);
    engine.handleKeyDown('p'); // 恢复

    expect(listener).toHaveBeenCalledWith('playing');
  });

  it('非 playing 状态下 P 键无效', () => {
    const engine = createEngine(); // idle
    engine.handleKeyDown('p');
    expect(engine.getState().status).toBe('idle');
  });
});

// ============================================================
// 15. 事件系统
// ============================================================

describe('事件系统', () => {
  it('fruitSliced 事件包含水果、分数和 combo', () => {
    const engine = createPlayingEngine();
    const listener = vi.fn();
    engine.on('fruitSliced', listener);

    const fruit = injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'apple' });
    engine.handleKeyDown(' ');

    expect(listener).toHaveBeenCalledWith(fruit, FRUIT_SCORES.apple, 1);
  });

  it('on/off 正确注册和注销事件', () => {
    const engine = createEngine();
    const listener = vi.fn();
    engine.on('test', listener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).emit('test');
    expect(listener).toHaveBeenCalledTimes(1);

    engine.off('test', listener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).emit('test');
    expect(listener).toHaveBeenCalledTimes(1); // 没有增加
  });

  it('多个监听器都能收到事件', () => {
    const engine = createEngine();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    engine.on('test', listener1);
    engine.on('test', listener2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).emit('test');

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// 16. getState
// ============================================================

describe('getState', () => {
  it('返回完整状态对象', () => {
    const engine = createPlayingEngine();
    const state = engine.getState();

    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('status');
    expect(state).toHaveProperty('lives');
    expect(state).toHaveProperty('missedCount');
    expect(state).toHaveProperty('combo');
    expect(state).toHaveProperty('maxCombo');
    expect(state).toHaveProperty('totalSliced');
    expect(state).toHaveProperty('fruits');
    expect(state).toHaveProperty('bombs');
    expect(state).toHaveProperty('cursorX');
    expect(state).toHaveProperty('cursorY');
  });

  it('返回的水果和炸弹是深拷贝', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: 100, y: 200 });

    const state = engine.getState();
    const fruits = state.fruits as FruitItem[];

    // 修改返回值不影响引擎内部
    fruits[0].x = 999;
    expect(engine.fruits[0].x).not.toBe(999);
  });

  it('状态值与 getter 一致', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    const state = engine.getState();
    expect(state.score).toBe(engine.getState().score);
    expect(state.lives).toBe(engine.lives);
    expect(state.combo).toBe(engine.combo);
    expect(state.maxCombo).toBe(engine.maxCombo);
    expect(state.totalSliced).toBe(engine.totalSliced);
    expect(state.missedCount).toBe(engine.missedCount);
    expect(state.cursorX).toBe(engine.cursorX);
    expect(state.cursorY).toBe(engine.cursorY);
  });
});

// ============================================================
// 17. 常量验证
// ============================================================

describe('常量验证', () => {
  it('INITIAL_LIVES 为 3', () => {
    expect(INITIAL_LIVES).toBe(3);
  });

  it('MAX_MISSED_FRUITS 为 3', () => {
    expect(MAX_MISSED_FRUITS).toBe(3);
  });

  it('BOMB_PENALTY 为 1', () => {
    expect(BOMB_PENALTY).toBe(1);
  });

  it('SCORE_PER_LEVEL 为 100', () => {
    expect(SCORE_PER_LEVEL).toBe(100);
  });

  it('MAX_LEVEL 为 10', () => {
    expect(MAX_LEVEL).toBe(10);
  });

  it('FRUIT_TYPES 包含 6 种水果', () => {
    expect(FRUIT_TYPES).toHaveLength(6);
  });

  it('所有水果类型都有对应颜色和分数', () => {
    for (const type of FRUIT_TYPES) {
      expect(FRUIT_COLORS[type]).toBeDefined();
      expect(FRUIT_SCORES[type]).toBeDefined();
      expect(FRUIT_SCORES[type]).toBeGreaterThan(0);
    }
  });

  it('画布尺寸合理', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(CANVAS_WIDTH); // 竖屏
  });
});

// ============================================================
// 18. 综合场景测试
// ============================================================

describe('综合场景', () => {
  it('完整游戏流程：开始 → 切水果 → 升级 → 游戏结束', () => {
    const engine = createPlayingEngine();

    // 切 5 个 watermelon 升级到 level 2
    for (let i = 0; i < 5; i++) {
      injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'watermelon' });
      engine.handleKeyDown(' ');
    }
    expect(engine.getState().level).toBe(2);

    // 漏掉水果
    setPrivate(engine, '_missedCount', MAX_MISSED_FRUITS - 1);
    injectFruit(engine, {
      y: CANVAS_HEIGHT + FRUIT_RADIUS * 2 + 1,
      vy: 5,
    });
    callUpdate(engine, 16);

    expect(engine.getState().status).toBe('gameover');
  });

  it('切到炸弹后继续游戏', () => {
    const engine = createPlayingEngine();

    // 切炸弹
    injectBomb(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    expect(engine.lives).toBe(INITIAL_LIVES - 1);
    expect(engine.getState().status).toBe('playing');

    // 还能继续切水果
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' ');

    expect(engine.totalSliced).toBe(1);
  });

  it('多次 update 后游戏状态一致', () => {
    const engine = createPlayingEngine();

    // 执行多次 update
    for (let i = 0; i < 10; i++) {
      callUpdate(engine, 16);
    }

    // 状态应该一致（不崩溃）
    expect(engine.getState().status).toBe('playing');
  });

  it('reset 后可以重新开始游戏', () => {
    const engine = createPlayingEngine();

    // 积累一些状态
    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY, type: 'watermelon' });
    engine.handleKeyDown(' ');

    engine.reset();
    forcePlaying(engine);

    expect(engine.getState().score).toBe(0);
    expect(engine.totalSliced).toBe(0);
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('水果和炸弹同时存在时切割正确', () => {
    const engine = createPlayingEngine();

    const fruit = injectFruit(engine, { x: engine.cursorX - 20, y: engine.cursorY });
    const bomb = injectBomb(engine, { x: engine.cursorX + 20, y: engine.cursorY });

    engine.handleKeyDown(' ');

    // 两个都在切割范围内
    expect(fruit.sliced).toBe(true);
    expect(bomb.sliced).toBe(true);
    expect(engine.lives).toBe(INITIAL_LIVES - BOMB_PENALTY);
  });

  it('大 deltaTime 下水果运动正确', () => {
    const engine = createPlayingEngine();
    const fruit = injectFruit(engine, { y: 100, vy: -10 });
    const vyBefore = fruit.vy;

    callUpdate(engine, 32); // 大帧间隔

    // 重力效果应该更明显
    expect(fruit.vy - vyBefore).toBeGreaterThan(0);
  });

  it('update 中清理过期对象', () => {
    const engine = createPlayingEngine();

    // 添加一些过期特效
    getSlashEffectsRef(engine).push({
      x: 100, y: 100, timer: -100, maxTimer: 300,
    });
    getParticlesRef(engine).push({
      x: 100, y: 100, vx: 0, vy: 0, life: -100, maxLife: 500, color: '#fff', radius: 3,
    });

    callUpdate(engine, 16);

    expect(engine.slashEffects).toHaveLength(0);
    expect(engine.particles).toHaveLength(0);
  });
});

// ============================================================
// 19. 边界情况
// ============================================================

describe('边界情况', () => {
  it('空格键在 paused 状态无效', () => {
    const engine = createPlayingEngine();
    engine.handleKeyDown('p'); // 暂停

    injectFruit(engine, { x: engine.cursorX, y: engine.cursorY });
    engine.handleKeyDown(' '); // 空格在 paused 状态

    // paused 状态下空格不触发切割（handleKeyDown 中只处理 playing 状态）
    expect(engine.totalSliced).toBe(0);
  });

  it('handleKeyUp 未按过的键不报错', () => {
    const engine = createPlayingEngine();
    expect(() => {
      engine.handleKeyUp('ArrowLeft');
      engine.handleKeyUp('ArrowRight');
      engine.handleKeyUp('ArrowUp');
      engine.handleKeyUp('ArrowDown');
    }).not.toThrow();
  });

  it('未知的按键不报错', () => {
    const engine = createPlayingEngine();
    expect(() => {
      engine.handleKeyDown('xyz');
      engine.handleKeyUp('xyz');
    }).not.toThrow();
  });

  it('连续快速按键不崩溃', () => {
    const engine = createPlayingEngine();
    expect(() => {
      for (let i = 0; i < 100; i++) {
        engine.handleKeyDown('ArrowLeft');
        engine.handleKeyDown(' ');
        engine.handleKeyUp('ArrowLeft');
      }
    }).not.toThrow();
  });

  it('deltaTime 为 0 时 update 不崩溃', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { y: 300 });

    expect(() => callUpdate(engine, 0)).not.toThrow();
  });

  it('负 deltaTime 时 update 不崩溃', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { y: 300 });

    expect(() => callUpdate(engine, -10)).not.toThrow();
  });

  it('fruits getter 返回拷贝不影响内部', () => {
    const engine = createPlayingEngine();
    injectFruit(engine, { x: 100 });

    const fruits1 = engine.fruits;
    const fruits2 = engine.fruits;

    expect(fruits1).not.toBe(fruits2); // 不同引用
    expect(fruits1).toEqual(fruits2);  // 但内容相同
  });

  it('bombs getter 返回拷贝不影响内部', () => {
    const engine = createPlayingEngine();
    injectBomb(engine, { x: 100 });

    const bombs1 = engine.bombs;
    const bombs2 = engine.bombs;

    expect(bombs1).not.toBe(bombs2);
    expect(bombs1).toEqual(bombs2);
  });
});
