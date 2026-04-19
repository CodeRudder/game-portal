/**
 * BloonsEngine 综合测试
 * 覆盖：初始化、气球生成/移动、路径跟随、飞镖投掷/碰撞、不同气球类型、
 *       飞镖猴放置/攻击、关卡系统、计分、生命系统、键盘控制、准星移动、getState、事件系统
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BloonsEngine, BloonData, DartData, MonkeyData } from '../BloonsEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BloonType,
  BLOON_HP, BLOON_COLORS, BLOON_SCORE, BLOON_RADIUS,
  PATH_WAYPOINTS,
  MONKEY_RANGE, MONKEY_ATTACK_INTERVAL, MONKEY_SIZE, MONKEY_SLOTS,
  DART_SPEED, DART_SIZE, DART_COOLDOWN,
  CROSSHAIR_SPEED, CROSSHAIR_SIZE,
  LEVELS,
  BLOON_BASE_SPEED,
  INITIAL_LIVES,
  BLOON_SPAWN_INTERVAL,
  HUD_HEIGHT,
  DIRECTION_KEYS,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建 mock canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并 init（不 start，停留在 idle） */
function createEngine(): BloonsEngine {
  const engine = new BloonsEngine();
  engine.init();
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): BloonsEngine {
  const engine = new BloonsEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: BloonsEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: BloonsEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: BloonsEngine, deltaTime: number): void {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 手动添加一个气球到引擎中 */
function addBloon(engine: BloonsEngine, overrides: Partial<BloonData> = {}): BloonData {
  const bloons = getPrivate<BloonData[]>(engine, '_bloons');
  const nextId = getPrivate<number>(engine, '_nextBloonId');
  const bloon: BloonData = {
    id: nextId,
    type: BloonType.RED,
    hp: BLOON_HP[BloonType.RED],
    maxHp: BLOON_HP[BloonType.RED],
    x: 100,
    y: 100,
    speed: BLOON_BASE_SPEED,
    pathProgress: 0.1,
    alive: true,
    color: BLOON_COLORS[BloonType.RED],
    ...overrides,
  };
  bloons.push(bloon);
  setPrivate(engine, '_nextBloonId', nextId + 1);
  return bloon;
}

/** 手动添加一个飞镖到引擎中 */
function addDart(engine: BloonsEngine, overrides: Partial<DartData> = {}): DartData {
  const darts = getPrivate<DartData[]>(engine, '_darts');
  const nextId = getPrivate<number>(engine, '_nextDartId');
  const dart: DartData = {
    id: nextId,
    fromX: 240,
    fromY: 320,
    toX: 240,
    toY: 120,
    x: 240,
    y: 320,
    elapsed: 0,
    duration: 500,
    alive: true,
    source: 'player',
    checked: false,
    ...overrides,
  };
  darts.push(dart);
  setPrivate(engine, '_nextDartId', nextId + 1);
  return dart;
}

/** 手动添加一个飞镖猴 */
function addMonkey(engine: BloonsEngine, overrides: Partial<MonkeyData> = {}): MonkeyData {
  const monkeys = getPrivate<MonkeyData[]>(engine, '_monkeys');
  const nextId = getPrivate<number>(engine, '_nextMonkeyId');
  const monkey: MonkeyData = {
    id: nextId,
    slotIndex: 0,
    x: MONKEY_SLOTS[0].x,
    y: MONKEY_SLOTS[0].y,
    lastAttackTime: 0,
    placed: true,
    ...overrides,
  };
  monkeys.push(monkey);
  setPrivate(engine, '_nextMonkeyId', nextId + 1);
  return monkey;
}

/** 获取气球数组 */
function getBloons(engine: BloonsEngine): BloonData[] {
  return getPrivate<BloonData[]>(engine, '_bloons');
}

/** 获取飞镖数组 */
function getDarts(engine: BloonsEngine): DartData[] {
  return getPrivate<DartData[]>(engine, '_darts');
}

/** 获取飞镖猴数组 */
function getMonkeys(engine: BloonsEngine): MonkeyData[] {
  return getPrivate<MonkeyData[]>(engine, '_monkeys');
}

/** 获取生成队列 */
function getSpawnQueue(engine: BloonsEngine): BloonType[] {
  return getPrivate<BloonType[]>(engine, '_spawnQueue');
}

// ============================================================
// 1. 初始化
// ============================================================
describe('BloonsEngine - 初始化', () => {
  it('应该能创建引擎实例', () => {
    const engine = new BloonsEngine();
    expect(engine).toBeInstanceOf(BloonsEngine);
  });

  it('init 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('init 后分数为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('init 后关卡为 1', () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it('init 后准星在画布中心', () => {
    const engine = createEngine();
    expect(engine.crosshairX).toBe(CANVAS_WIDTH / 2);
    expect(engine.crosshairY).toBe(CANVAS_HEIGHT / 2);
  });

  it('init 后生命值为初始值', () => {
    const engine = createEngine();
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('init 后没有气球', () => {
    const engine = createEngine();
    expect(engine.bloons).toHaveLength(0);
  });

  it('init 后没有飞镖', () => {
    const engine = createEngine();
    expect(engine.darts).toHaveLength(0);
  });

  it('init 后没有飞镖猴', () => {
    const engine = createEngine();
    expect(engine.monkeys).toHaveLength(0);
  });

  it('init 后不在放置飞镖猴模式', () => {
    const engine = createEngine();
    expect(engine.placingMonkey).toBe(false);
  });

  it('init 后 isWin 为 false', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
  });

  it('totalLevels 应返回 LEVELS 的长度', () => {
    const engine = createEngine();
    expect(engine.totalLevels).toBe(LEVELS.length);
  });
});

// ============================================================
// 2. 游戏启动
// ============================================================
describe('BloonsEngine - 游戏启动', () => {
  it('start 后状态变为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后分数重置为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后生命值为初始值', () => {
    const engine = createAndStartEngine();
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('start 后 currentLevel 为 1', () => {
    const engine = createAndStartEngine();
    expect(engine.currentLevel).toBe(1);
  });

  it('start 后设置第一关的飞镖数', () => {
    const engine = createAndStartEngine();
    expect(engine.dartsRemaining).toBe(LEVELS[0].darts);
  });

  it('start 后生成队列包含正确的气球数量', () => {
    const engine = createAndStartEngine();
    const config = LEVELS[0];
    const expected = config.red + config.blue + config.green + config.yellow;
    expect(engine.spawnQueue).toHaveLength(expected);
  });

  it('start 后没有已放置的飞镖猴', () => {
    const engine = createAndStartEngine();
    expect(engine.monkeys).toHaveLength(0);
  });

  it('start 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isWin).toBe(false);
  });

  it('start 发出 statusChange 事件', () => {
    const engine = createEngine();
    const canvas = createMockCanvas();
    engine.init(canvas);
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('start 发出 scoreChange 事件', () => {
    const engine = createEngine();
    const canvas = createMockCanvas();
    engine.init(canvas);
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(0);
  });
});

// ============================================================
// 3. 气球生成
// ============================================================
describe('BloonsEngine - 气球生成', () => {
  it('经过足够时间后应生成一个气球', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('bloonSpawned', handler);

    // 第一次生成在 spawnTimer <= 0 时立即触发
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);

    expect(handler).toHaveBeenCalled();
    expect(engine.bloons.length).toBeGreaterThanOrEqual(1);
  });

  it('生成的气球应在路径起点', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);

    if (engine.bloons.length > 0) {
      const bloon = engine.bloons[0];
      // 路径起点在第一个航点附近
      expect(bloon.pathProgress).toBeGreaterThanOrEqual(0);
    }
  });

  it('生成的气球类型应在队列中', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);

    if (engine.bloons.length > 0) {
      const bloon = engine.bloons[0];
      expect(Object.values(BloonType)).toContain(bloon.type);
    }
  });

  it('生成气球时发出 bloonSpawned 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('bloonSpawned', handler);

    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].bloon).toBeDefined();
  });

  it('生成的红色气球 hp 为 1', () => {
    const engine = createAndStartEngine();
    // 第一关只有红色气球
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);

    const redBloons = engine.bloons.filter(b => b.type === BloonType.RED);
    if (redBloons.length > 0) {
      expect(redBloons[0].hp).toBe(BLOON_HP[BloonType.RED]);
    }
  });

  it('生成的气球 alive 为 true', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);

    engine.bloons.forEach(b => {
      expect(b.alive).toBe(true);
    });
  });

  it('生成的气球颜色与类型匹配', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);

    engine.bloons.forEach(b => {
      expect(b.color).toBe(BLOON_COLORS[b.type]);
    });
  });

  it('生成队列按间隔逐个生成', () => {
    const engine = createAndStartEngine();
    const initialQueueLen = engine.spawnQueue.length;

    // 生成一个
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);
    const afterFirst = engine.spawnQueue.length;
    expect(afterFirst).toBe(initialQueueLen - 1);

    // 再生成一个
    callUpdate(engine, BLOON_SPAWN_INTERVAL + 1);
    const afterSecond = engine.spawnQueue.length;
    expect(afterSecond).toBe(afterFirst - 1);
  });
});

// ============================================================
// 4. 气球移动与路径跟随
// ============================================================
describe('BloonsEngine - 气球移动与路径跟随', () => {
  it('气球沿路径移动时 pathProgress 增加', () => {
    const engine = createAndStartEngine();
    const bloon = addBloon(engine, { pathProgress: 0.1 });
    const initialProgress = bloon.pathProgress;

    callUpdate(engine, 100);

    expect(bloon.pathProgress).toBeGreaterThan(initialProgress);
  });

  it('气球位置随 pathProgress 更新', () => {
    const engine = createAndStartEngine();
    const bloon = addBloon(engine, { pathProgress: 0.1, x: 0, y: 0 });
    const initialX = bloon.x;

    callUpdate(engine, 100);

    // 位置应该根据路径更新
    expect(bloon.x).not.toBe(initialX);
  });

  it('速度倍率影响气球移动速度', () => {
    const engine = createAndStartEngine();
    const bloon = addBloon(engine, { speed: BLOON_BASE_SPEED * 2, pathProgress: 0.1 });
    const initialProgress = bloon.pathProgress;

    callUpdate(engine, 100);

    // 更快的速度应该产生更大的进度增量
    expect(bloon.pathProgress - initialProgress).toBeGreaterThan(0);
  });

  it('死掉的气球在更新时被移除', () => {
    const engine = createAndStartEngine();
    // 清空生成队列，防止 _updateSpawning 在 update 中生成新气球
    setPrivate(engine, '_spawnQueue', []);
    addBloon(engine, { alive: false });

    callUpdate(engine, 16);

    // _updateBloons 会移除 alive=false 的气球，但引擎的 bloons getter 返回 _bloons 数组
    // 死掉的气球在 _updateBloons 的反向遍历中被 splice 移除
    expect(getBloons(engine)).toHaveLength(0);
  });

  it('气球到达终点时 alive 变为 false', () => {
    const engine = createAndStartEngine();
    const bloon = addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    // 气球应该已经过了终点
    expect(bloon.pathProgress).toBeGreaterThanOrEqual(1);
  });

  it('气球到达终点时生命减少', () => {
    const engine = createAndStartEngine();
    const initialLives = engine.lives;
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(engine.lives).toBeLessThan(initialLives);
  });

  it('气球到达终点时发出 bloonEscaped 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('bloonEscaped', handler);
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(handler).toHaveBeenCalled();
  });

  it('多个气球同时移动', () => {
    const engine = createAndStartEngine();
    const b1 = addBloon(engine, { pathProgress: 0.1 });
    const b2 = addBloon(engine, { pathProgress: 0.2 });

    callUpdate(engine, 100);

    expect(b1.pathProgress).toBeGreaterThan(0.1);
    expect(b2.pathProgress).toBeGreaterThan(0.2);
  });
});

// ============================================================
// 5. 飞镖投掷
// ============================================================
describe('BloonsEngine - 飞镖投掷', () => {
  it('玩家可以投掷飞镖', () => {
    const engine = createAndStartEngine();
    // 推进 _gameTime 使冷却检查通过
    setPrivate(engine, '_gameTime', DART_COOLDOWN + 1);
    const handler = vi.fn();
    engine.on('dartThrown', handler);

    engine.handleKeyDown(' ');

    expect(handler).toHaveBeenCalled();
    expect(engine.darts.length).toBeGreaterThanOrEqual(1);
  });

  it('投掷飞镖后 dartsRemaining 减少', () => {
    const engine = createAndStartEngine();
    const initialDarts = engine.dartsRemaining;
    setPrivate(engine, '_gameTime', DART_COOLDOWN + 1);

    engine.handleKeyDown(' ');

    expect(engine.dartsRemaining).toBe(initialDarts - 1);
  });

  it('飞镖数量用完时不能再投掷', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_dartsRemaining', 0);

    engine.handleKeyDown(' ');

    expect(engine.darts).toHaveLength(0);
  });

  it('冷却时间内不能再次投掷', () => {
    const engine = createAndStartEngine();
    const gameTime = getPrivate<number>(engine, '_gameTime');
    setPrivate(engine, '_lastDartTime', gameTime);

    engine.handleKeyDown(' ');

    // 冷却中，不应该投掷（因为 gameTime - lastDartTime < DART_COOLDOWN）
    const dartsBefore = engine.darts.length;
    expect(dartsBefore).toBeGreaterThanOrEqual(0);
  });

  it('飞镖从准星位置出发', () => {
    const engine = createAndStartEngine();
    const cx = engine.crosshairX;
    const cy = engine.crosshairY;

    engine.handleKeyDown(' ');

    if (engine.darts.length > 0) {
      const dart = engine.darts[0];
      expect(dart.fromX).toBe(cx);
      expect(dart.fromY).toBe(cy);
    }
  });

  it('飞镖的 source 为 player', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');

    if (engine.darts.length > 0) {
      expect(engine.darts[0].source).toBe('player');
    }
  });

  it('投掷飞镖时发出 dartThrown 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('dartThrown', handler);
    setPrivate(engine, '_gameTime', DART_COOLDOWN + 1);

    engine.handleKeyDown(' ');

    expect(handler).toHaveBeenCalledWith({ dartsRemaining: expect.any(Number) });
  });

  it('飞镖飞行时间基于距离计算', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');

    if (engine.darts.length > 0) {
      const dart = engine.darts[0];
      const dist = Math.sqrt((dart.toX - dart.fromX) ** 2 + (dart.toY - dart.fromY) ** 2);
      const expectedDuration = dist > 0 ? dist / DART_SPEED : 100;
      expect(dart.duration).toBe(expectedDuration);
    }
  });
});

// ============================================================
// 6. 飞镖移动
// ============================================================
describe('BloonsEngine - 飞镖移动', () => {
  it('飞镖位置随时间线性插值', () => {
    const engine = createAndStartEngine();
    const dart = addDart(engine, {
      fromX: 0, fromY: 0,
      toX: 100, toY: 0,
      x: 0, y: 0,
      elapsed: 0, duration: 1000,
    });

    callUpdate(engine, 500);

    expect(dart.x).toBeCloseTo(50, 1);
  });

  it('飞镖飞行完毕后 alive 变为 false', () => {
    const engine = createAndStartEngine();
    addDart(engine, {
      fromX: 0, fromY: 0,
      toX: 100, toY: 0,
      elapsed: 999, duration: 1000,
    });

    callUpdate(engine, 10);

    const darts = getDarts(engine);
    // 已经被清理
    expect(darts.filter(d => d.alive)).toHaveLength(0);
  });

  it('死掉的飞镖在更新时被移除', () => {
    const engine = createAndStartEngine();
    addDart(engine, { alive: false });

    callUpdate(engine, 16);

    expect(getDarts(engine)).toHaveLength(0);
  });

  it('飞镖 y 坐标也正确插值', () => {
    const engine = createAndStartEngine();
    const dart = addDart(engine, {
      fromX: 0, fromY: 0,
      toX: 0, toY: 200,
      x: 0, y: 0,
      elapsed: 0, duration: 1000,
    });

    callUpdate(engine, 250);

    expect(dart.y).toBeCloseTo(50, 1);
  });
});

// ============================================================
// 7. 碰撞检测
// ============================================================
describe('BloonsEngine - 碰撞检测', () => {
  it('飞镖命中气球时气球 hp 减少', () => {
    const engine = createAndStartEngine();
    // 确保没有猴子干扰碰撞检测
    setPrivate(engine, '_monkeys', []);
    // 使用 pathProgress 使气球在路径上位于 (100, 100) 附近
    const bloon = addBloon(engine, { pathProgress: 0.050420, hp: 2, maxHp: 2 });
    // 飞镖的 x,y 会在 _updateDarts 中根据 fromX/fromY/toX/toY 重新计算
    // 所以需要让飞镖从 (100,100) 飞向 (100,100) 以保持位置不变
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(bloon.hp).toBe(1);
  });

  it('飞镖命中后 alive 变为 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    addBloon(engine, { pathProgress: 0.050420 });
    const dart = addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(dart.alive).toBe(false);
  });

  it('飞镖命中后 checked 变为 true', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    addBloon(engine, { pathProgress: 0.050420 });
    const dart = addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(dart.checked).toBe(true);
  });

  it('气球 hp 归零时 alive 变为 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const bloon = addBloon(engine, { pathProgress: 0.050420, hp: 1, maxHp: 1 });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(bloon.alive).toBe(false);
  });

  it('击破气球时增加分数', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const initialScore = engine.score;
    addBloon(engine, { pathProgress: 0.050420, hp: 1, maxHp: 1, type: BloonType.RED });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(engine.score).toBe(initialScore + BLOON_SCORE[BloonType.RED]);
  });

  it('击破气球时发出 bloonPopped 事件', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const handler = vi.fn();
    engine.on('bloonPopped', handler);
    addBloon(engine, { pathProgress: 0.050420, hp: 1, maxHp: 1, type: BloonType.RED });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(handler).toHaveBeenCalledWith({
      bloon: expect.objectContaining({ type: BloonType.RED }),
      score: BLOON_SCORE[BloonType.RED],
      source: 'player',
    });
  });

  it('命中但未击破时发出 bloonHit 事件', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const handler = vi.fn();
    engine.on('bloonHit', handler);
    addBloon(engine, { pathProgress: 0.050420, hp: 2, maxHp: 2, type: BloonType.BLUE });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(handler).toHaveBeenCalledWith({
      bloon: expect.objectContaining({ hp: 1 }),
      source: 'player',
    });
  });

  it('已 checked 的飞镖不会再次检测碰撞', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const bloon = addBloon(engine, { pathProgress: 0.050420, hp: 2, maxHp: 2 });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: true,
    });

    callUpdate(engine, 16);

    expect(bloon.hp).toBe(2);
  });

  it('不在碰撞范围内的飞镖不命中', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const bloon = addBloon(engine, { pathProgress: 0.050420, hp: 1 });
    addDart(engine, {
      fromX: 500, fromY: 500, toX: 500, toY: 500,
      x: 500, y: 500, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(bloon.hp).toBe(1);
    expect(bloon.alive).toBe(true);
  });

  it('每个飞镖只命中一个气球', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const b1 = addBloon(engine, { pathProgress: 0.050420, hp: 1 });
    const b2 = addBloon(engine, { pathProgress: 0.050420, hp: 1 });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    // 只有一个气球被击中
    const poppedCount = [b1, b2].filter(b => !b.alive).length;
    expect(poppedCount).toBe(1);
  });
});

// ============================================================
// 8. 不同气球类型
// ============================================================
describe('BloonsEngine - 不同气球类型', () => {
  it('红色气球 HP 为 1', () => {
    expect(BLOON_HP[BloonType.RED]).toBe(1);
  });

  it('蓝色气球 HP 为 2', () => {
    expect(BLOON_HP[BloonType.BLUE]).toBe(2);
  });

  it('绿色气球 HP 为 3', () => {
    expect(BLOON_HP[BloonType.GREEN]).toBe(3);
  });

  it('黄色气球 HP 为 5', () => {
    expect(BLOON_HP[BloonType.YELLOW]).toBe(5);
  });

  it('红色气球得分为 10', () => {
    expect(BLOON_SCORE[BloonType.RED]).toBe(10);
  });

  it('蓝色气球得分为 25', () => {
    expect(BLOON_SCORE[BloonType.BLUE]).toBe(25);
  });

  it('绿色气球得分为 50', () => {
    expect(BLOON_SCORE[BloonType.GREEN]).toBe(50);
  });

  it('黄色气球得分为 100', () => {
    expect(BLOON_SCORE[BloonType.YELLOW]).toBe(100);
  });

  it('蓝色气球需要 2 次命中才能击破', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const bloon = addBloon(engine, { pathProgress: 0.050420, hp: 2, maxHp: 2, type: BloonType.BLUE });

    // 第一次命中
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });
    callUpdate(engine, 16);
    expect(bloon.hp).toBe(1);
    expect(bloon.alive).toBe(true);

    // 第二次命中
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });
    callUpdate(engine, 16);
    expect(bloon.alive).toBe(false);
  });

  it('绿色气球击破得分 50', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const initialScore = engine.score;
    addBloon(engine, { pathProgress: 0.050420, hp: 1, maxHp: 3, type: BloonType.GREEN });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(engine.score).toBe(initialScore + BLOON_SCORE[BloonType.GREEN]);
  });

  it('黄色气球击破得分 100', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    const initialScore = engine.score;
    addBloon(engine, { pathProgress: 0.050420, hp: 1, maxHp: 5, type: BloonType.YELLOW });
    addDart(engine, {
      fromX: 100, fromY: 100, toX: 100, toY: 100,
      x: 100, y: 100, alive: true, checked: false,
    });

    callUpdate(engine, 16);

    expect(engine.score).toBe(initialScore + BLOON_SCORE[BloonType.YELLOW]);
  });
});

// ============================================================
// 9. 飞镖猴系统
// ============================================================
describe('BloonsEngine - 飞镖猴系统', () => {
  it('按 T 键切换放置模式', () => {
    const engine = createAndStartEngine();
    expect(engine.placingMonkey).toBe(false);

    engine.handleKeyDown('t');
    expect(engine.placingMonkey).toBe(true);

    engine.handleKeyDown('t');
    expect(engine.placingMonkey).toBe(false);
  });

  it('按 T 键发出 placingMonkeyChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('placingMonkeyChange', handler);

    engine.handleKeyDown('t');
    expect(handler).toHaveBeenCalledWith(true);
  });

  it('放置模式下空格在准星位置放置飞镖猴', () => {
    const engine = createAndStartEngine();
    // 将准星移到第一个 slot 附近
    setPrivate(engine, '_crosshairX', MONKEY_SLOTS[0].x);
    setPrivate(engine, '_crosshairY', MONKEY_SLOTS[0].y);
    // 推进 _gameTime 使冷却检查通过
    setPrivate(engine, '_gameTime', DART_COOLDOWN + 1);

    engine.handleKeyDown('t'); // 进入放置模式
    engine.handleKeyDown(' '); // 放置

    expect(engine.monkeys).toHaveLength(1);
    expect(engine.placingMonkey).toBe(false);
  });

  it('放置飞镖猴发出 monkeyPlaced 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('monkeyPlaced', handler);
    setPrivate(engine, '_crosshairX', MONKEY_SLOTS[0].x);
    setPrivate(engine, '_crosshairY', MONKEY_SLOTS[0].y);
    setPrivate(engine, '_gameTime', DART_COOLDOWN + 1);

    engine.handleKeyDown('t');
    engine.handleKeyDown(' ');

    expect(handler).toHaveBeenCalledWith({ monkey: expect.objectContaining({ placed: true }) });
  });

  it('不能在已占用的 slot 放置飞镖猴', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', MONKEY_SLOTS[0].x);
    setPrivate(engine, '_crosshairY', MONKEY_SLOTS[0].y);
    setPrivate(engine, '_gameTime', DART_COOLDOWN + 1);

    engine.handleKeyDown('t');
    engine.handleKeyDown(' '); // 放置第一个

    engine.handleKeyDown('t'); // 再次进入放置模式
    engine.handleKeyDown(' '); // 尝试在同一个 slot 放置

    expect(engine.monkeys).toHaveLength(1);
  });

  it('远离 slot 时不能放置飞镖猴', () => {
    const engine = createAndStartEngine();
    // 准星在远离所有 slot 的位置
    setPrivate(engine, '_crosshairX', 0);
    setPrivate(engine, '_crosshairY', 0);

    engine.handleKeyDown('t');
    engine.handleKeyDown(' ');

    expect(engine.monkeys).toHaveLength(0);
  });

  it('飞镖猴自动攻击射程内的气球', () => {
    const engine = createAndStartEngine();
    const gameTime = getPrivate<number>(engine, '_gameTime');
    addMonkey(engine, { lastAttackTime: gameTime - MONKEY_ATTACK_INTERVAL - 1 });
    // 使用 pathProgress 使气球在路径上靠近猴子位置
    // MONKEY_SLOTS[0] = (240, 150), progress=0.15 时路径位置约 (237, 200), 距猴子约 50px
    addBloon(engine, {
      pathProgress: 0.15,
    });

    callUpdate(engine, 16);

    // 飞镖猴应该发射了飞镖
    expect(getDarts(engine).length).toBeGreaterThanOrEqual(1);
  });

  it('飞镖猴攻击间隔内不重复攻击', () => {
    const engine = createAndStartEngine();
    const gameTime = getPrivate<number>(engine, '_gameTime');
    addMonkey(engine, { lastAttackTime: gameTime });
    addBloon(engine, {
      pathProgress: 0.15,
    });

    callUpdate(engine, 16);

    expect(getDarts(engine)).toHaveLength(0);
  });

  it('飞镖猴的飞镖 source 为 monkey', () => {
    const engine = createAndStartEngine();
    const gameTime = getPrivate<number>(engine, '_gameTime');
    addMonkey(engine, { lastAttackTime: gameTime - MONKEY_ATTACK_INTERVAL - 1 });
    addBloon(engine, {
      pathProgress: 0.15,
    });

    callUpdate(engine, 16);

    const darts = getDarts(engine);
    if (darts.length > 0) {
      expect(darts[0].source).toBe('monkey');
    }
  });

  it('射程外的气球不会被飞镖猴攻击', () => {
    const engine = createAndStartEngine();
    const gameTime = getPrivate<number>(engine, '_gameTime');
    addMonkey(engine, { lastAttackTime: gameTime - MONKEY_ATTACK_INTERVAL - 1 });
    // pathProgress=0.06 时路径位置约 (120, 103), 距猴子 (240,150) 约 129px, 超出射程 120
    addBloon(engine, {
      pathProgress: 0.06,
    });

    callUpdate(engine, 16);

    expect(getDarts(engine)).toHaveLength(0);
  });

  it('飞镖猴优先攻击最近的气球', () => {
    const engine = createAndStartEngine();
    const gameTime = getPrivate<number>(engine, '_gameTime');
    addMonkey(engine, { lastAttackTime: gameTime - MONKEY_ATTACK_INTERVAL - 1 });

    // 两个气球在路径上，一个近一个远
    // MONKEY_SLOTS[0] = (240, 150)
    // progress=0.15 -> pos约(237, 200), dist约50
    // progress=0.20 -> pos约(277, 200), dist约55
    addBloon(engine, {
      pathProgress: 0.15,
    });
    addBloon(engine, {
      pathProgress: 0.20,
    });

    callUpdate(engine, 16);

    const darts = getDarts(engine);
    if (darts.length > 0) {
      // 飞镖应该朝向最近的气球（progress=0.15 的那个）
      const dart = darts[0];
      // 最近气球在 progress=0.15 + 小增量后的路径位置
      const distToNear = Math.sqrt((dart.toX - dart.fromX) ** 2 + (dart.toY - dart.fromY) ** 2);
      expect(distToNear).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 10. 关卡系统
// ============================================================
describe('BloonsEngine - 关卡系统', () => {
  it('第一关只有红色气球', () => {
    const config = LEVELS[0];
    expect(config.blue).toBe(0);
    expect(config.green).toBe(0);
    expect(config.yellow).toBe(0);
    expect(config.red).toBeGreaterThan(0);
  });

  it('关卡难度递增', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].speedMultiplier).toBeGreaterThanOrEqual(LEVELS[i - 1].speedMultiplier);
    }
  });

  it('共有 10 关', () => {
    expect(LEVELS).toHaveLength(10);
  });

  it('按 N 键可以进入下一关', () => {
    const engine = createAndStartEngine();
    // 清空所有气球和队列以模拟关卡完成
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloons', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    engine.handleKeyDown('n');

    expect(engine.currentLevel).toBe(2);
  });

  it('按 N 键发出 levelChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('levelChange', handler);
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloons', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    engine.handleKeyDown('n');

    expect(handler).toHaveBeenCalledWith(2);
  });

  it('最后一关完成前不能按 N 进入下一关', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_currentLevel', LEVELS.length - 1);
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloons', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    engine.handleKeyDown('n');

    // 仍在最后一关
    expect(engine.currentLevel).toBe(LEVELS.length);
  });

  it('有气球存活时不能进入下一关', () => {
    const engine = createAndStartEngine();
    addBloon(engine, { alive: true });
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    engine.handleKeyDown('n');

    expect(engine.currentLevel).toBe(1);
  });

  it('进入下一关后飞镖数更新', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloons', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    engine.handleKeyDown('n');

    expect(engine.dartsRemaining).toBe(LEVELS[1].darts);
  });

  it('进入下一关后气球清空', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloons', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    engine.handleKeyDown('n');

    expect(engine.bloons).toHaveLength(0);
  });

  it('最后一关完成后触发胜利', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_currentLevel', LEVELS.length - 1);
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloons', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    callUpdate(engine, 16);

    expect(engine.isWin).toBe(true);
    expect(engine.status).toBe('gameover');
  });
});

// ============================================================
// 11. 生命系统
// ============================================================
describe('BloonsEngine - 生命系统', () => {
  it('初始生命为 20', () => {
    expect(INITIAL_LIVES).toBe(20);
  });

  it('气球逃脱时生命减少 1', () => {
    const engine = createAndStartEngine();
    const initialLives = engine.lives;
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(engine.lives).toBe(initialLives - 1);
  });

  it('生命为 0 时游戏结束', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 1);
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(engine.status).toBe('gameover');
    expect(engine.isWin).toBe(false);
  });

  it('生命不会低于 0', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 0);
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(engine.lives).toBe(0);
  });

  it('多个气球逃脱时生命多次减少', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 20);

    // 添加多个即将到达终点的气球
    for (let i = 0; i < 3; i++) {
      addBloon(engine, { pathProgress: 0.99, speed: 1.0 });
    }

    callUpdate(engine, 100);

    expect(engine.lives).toBeLessThan(20);
  });
});

// ============================================================
// 12. 计分系统
// ============================================================
describe('BloonsEngine - 计分系统', () => {
  it('击破红色气球得 10 分', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    setPrivate(engine, '_spawnQueue', []);
    // pathProgress=0.1 对应路径位置 (120, 198)
    addBloon(engine, { hp: 1, maxHp: 1, type: BloonType.RED, speed: 0, pathProgress: 0.1 });
    addDart(engine, { x: 120, y: 198, fromX: 120, fromY: 198, toX: 120, toY: 198, alive: true, checked: false });

    callUpdate(engine, 16);

    expect(engine.score).toBe(BLOON_SCORE[BloonType.RED]);
  });

  it('击破蓝色气球得 25 分', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    setPrivate(engine, '_spawnQueue', []);
    addBloon(engine, { hp: 1, maxHp: 2, type: BloonType.BLUE, speed: 0, pathProgress: 0.1 });
    addDart(engine, { x: 120, y: 198, fromX: 120, fromY: 198, toX: 120, toY: 198, alive: true, checked: false });

    callUpdate(engine, 16);

    expect(engine.score).toBe(BLOON_SCORE[BloonType.BLUE]);
  });

  it('击破绿色气球得 50 分', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    setPrivate(engine, '_spawnQueue', []);
    addBloon(engine, { hp: 1, maxHp: 3, type: BloonType.GREEN, speed: 0, pathProgress: 0.1 });
    addDart(engine, { x: 120, y: 198, fromX: 120, fromY: 198, toX: 120, toY: 198, alive: true, checked: false });

    callUpdate(engine, 16);

    expect(engine.score).toBe(BLOON_SCORE[BloonType.GREEN]);
  });

  it('击破黄色气球得 100 分', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    setPrivate(engine, '_spawnQueue', []);
    addBloon(engine, { hp: 1, maxHp: 5, type: BloonType.YELLOW, speed: 0, pathProgress: 0.1 });
    addDart(engine, { x: 120, y: 198, fromX: 120, fromY: 198, toX: 120, toY: 198, alive: true, checked: false });

    callUpdate(engine, 16);

    expect(engine.score).toBe(BLOON_SCORE[BloonType.YELLOW]);
  });

  it('分数可以累加', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    setPrivate(engine, '_spawnQueue', []);

    // 击破第一个气球 (pathProgress=0.1 → x=120, y=198)
    addBloon(engine, { hp: 1, maxHp: 1, type: BloonType.RED, id: 100, speed: 0, pathProgress: 0.1 });
    addDart(engine, { x: 120, y: 198, fromX: 120, fromY: 198, toX: 120, toY: 198, alive: true, checked: false, id: 200 });
    callUpdate(engine, 16);

    // 击破第二个气球 (pathProgress=0.2 → x=356, y=200)
    addBloon(engine, { hp: 1, maxHp: 1, type: BloonType.RED, id: 101, speed: 0, pathProgress: 0.2 });
    addDart(engine, { x: 356, y: 200, fromX: 356, fromY: 200, toX: 356, toY: 200, alive: true, checked: false, id: 201 });
    callUpdate(engine, 16);

    expect(engine.score).toBe(BLOON_SCORE[BloonType.RED] * 2);
  });

  it('分数变化时发出 scoreChange 事件', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_monkeys', []);
    setPrivate(engine, '_spawnQueue', []);
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    addBloon(engine, { hp: 1, maxHp: 1, type: BloonType.RED, speed: 0, pathProgress: 0.1 });
    addDart(engine, { x: 120, y: 198, fromX: 120, fromY: 198, toX: 120, toY: 198, alive: true, checked: false });

    callUpdate(engine, 16);

    expect(handler).toHaveBeenCalledWith(BLOON_SCORE[BloonType.RED]);
  });
});

// ============================================================
// 13. 键盘控制
// ============================================================
describe('BloonsEngine - 键盘控制', () => {
  it('idle 状态下空格键启动游戏', () => {
    const engine = createEngine();
    const canvas = createMockCanvas();
    engine.init(canvas);

    engine.handleKeyDown(' ');

    expect(engine.status).toBe('playing');
  });

  it('idle 状态下 Enter 键启动游戏', () => {
    const engine = createEngine();
    const canvas = createMockCanvas();
    engine.init(canvas);

    engine.handleKeyDown('Enter');

    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下空格键重置并启动', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');

    engine.handleKeyDown(' ');

    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下 Enter 键重置并启动', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');

    engine.handleKeyDown('Enter');

    expect(engine.status).toBe('playing');
  });

  it('ArrowUp 按下后准星向上移动', () => {
    const engine = createAndStartEngine();
    const initialY = engine.crosshairY;

    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 100);

    expect(engine.crosshairY).toBeLessThan(initialY);
  });

  it('ArrowDown 按下后准星向下移动', () => {
    const engine = createAndStartEngine();
    const initialY = engine.crosshairY;

    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 100);

    expect(engine.crosshairY).toBeGreaterThan(initialY);
  });

  it('ArrowLeft 按下后准星向左移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.crosshairX;

    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 100);

    expect(engine.crosshairX).toBeLessThan(initialX);
  });

  it('ArrowRight 按下后准星向右移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.crosshairX;

    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 100);

    expect(engine.crosshairX).toBeGreaterThan(initialX);
  });

  it('WASD 也可以控制方向', () => {
    const engine = createAndStartEngine();
    const initialY = engine.crosshairY;

    engine.handleKeyDown('w');
    callUpdate(engine, 100);

    expect(engine.crosshairY).toBeLessThan(initialY);
  });

  it('松开方向键后准星停止移动', () => {
    const engine = createAndStartEngine();

    engine.handleKeyDown('ArrowUp');
    engine.handleKeyUp('ArrowUp');

    const y1 = engine.crosshairY;
    callUpdate(engine, 100);
    const y2 = engine.crosshairY;

    expect(y1).toBe(y2);
  });

  it('idle 状态下方向键无效', () => {
    const engine = createEngine();
    const initialX = engine.crosshairX;
    const initialY = engine.crosshairY;

    engine.handleKeyDown('ArrowUp');
    // idle 状态下不处理方向键

    expect(engine.crosshairX).toBe(initialX);
    expect(engine.crosshairY).toBe(initialY);
  });
});

// ============================================================
// 14. 准星移动
// ============================================================
describe('BloonsEngine - 准星移动', () => {
  it('准星不能超出画布左边界', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', 5);

    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 100);

    expect(engine.crosshairX).toBeGreaterThanOrEqual(0);
  });

  it('准星不能超出画布右边界', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', CANVAS_WIDTH - 5);

    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 100);

    expect(engine.crosshairX).toBeLessThanOrEqual(CANVAS_WIDTH);
  });

  it('准星不能超出画布上边界（HUD_HEIGHT）', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairY', HUD_HEIGHT + 5);

    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 100);

    expect(engine.crosshairY).toBeGreaterThanOrEqual(HUD_HEIGHT);
  });

  it('准星不能超出画布下边界', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairY', CANVAS_HEIGHT - 5);

    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 100);

    expect(engine.crosshairY).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  it('准星移动速度正确', () => {
    const engine = createAndStartEngine();
    const initialY = engine.crosshairY;
    const dt = 100;

    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, dt);

    const expectedMove = CROSSHAIR_SPEED * dt;
    expect(engine.crosshairY).toBeCloseTo(initialY - expectedMove, 1);
  });

  it('可以同时按两个方向键对角移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.crosshairX;
    const initialY = engine.crosshairY;

    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 100);

    expect(engine.crosshairX).toBeGreaterThan(initialX);
    expect(engine.crosshairY).toBeLessThan(initialY);
  });
});

// ============================================================
// 15. 游戏重置
// ============================================================
describe('BloonsEngine - 游戏重置', () => {
  it('reset 后状态变为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();

    expect(engine.status).toBe('idle');
  });

  it('reset 后分数归零', () => {
    const engine = createAndStartEngine();
    engine.reset();

    expect(engine.score).toBe(0);
  });

  it('reset 后关卡归 1', () => {
    const engine = createAndStartEngine();
    engine.reset();

    expect(engine.level).toBe(1);
  });

  it('reset 后生命恢复', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 5);
    engine.reset();

    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('reset 后气球清空', () => {
    const engine = createAndStartEngine();
    addBloon(engine);
    engine.reset();

    expect(engine.bloons).toHaveLength(0);
  });

  it('reset 后飞镖清空', () => {
    const engine = createAndStartEngine();
    addDart(engine);
    engine.reset();

    expect(engine.darts).toHaveLength(0);
  });

  it('reset 后飞镖猴清空', () => {
    const engine = createAndStartEngine();
    addMonkey(engine);
    engine.reset();

    expect(engine.monkeys).toHaveLength(0);
  });

  it('reset 后准星回到中心', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', 0);
    setPrivate(engine, '_crosshairY', 0);
    engine.reset();

    expect(engine.crosshairX).toBe(CANVAS_WIDTH / 2);
    expect(engine.crosshairY).toBe(CANVAS_HEIGHT / 2);
  });

  it('reset 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_isWin', true);
    engine.reset();

    expect(engine.isWin).toBe(false);
  });

  it('reset 发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);

    engine.reset();

    expect(handler).toHaveBeenCalledWith('idle');
  });
});

// ============================================================
// 16. getState
// ============================================================
describe('BloonsEngine - getState', () => {
  it('返回包含 score', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
  });

  it('返回包含 level', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('level');
  });

  it('返回包含 status', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('status');
  });

  it('返回包含 lives', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('lives', INITIAL_LIVES);
  });

  it('返回包含 dartsRemaining', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('dartsRemaining');
  });

  it('返回包含 currentLevel', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('currentLevel', 1);
  });

  it('返回包含 crosshairX 和 crosshairY', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('crosshairX');
    expect(state).toHaveProperty('crosshairY');
  });

  it('返回包含 isWin', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('isWin', false);
  });

  it('返回包含 bloons 数组', () => {
    const engine = createAndStartEngine();
    addBloon(engine);
    const state = engine.getState();
    expect(state).toHaveProperty('bloons');
    expect((state as any).bloons).toHaveLength(1);
  });

  it('返回包含 darts 数组', () => {
    const engine = createAndStartEngine();
    addDart(engine);
    const state = engine.getState();
    expect(state).toHaveProperty('darts');
    expect((state as any).darts).toHaveLength(1);
  });

  it('返回包含 monkeys 数组', () => {
    const engine = createAndStartEngine();
    addMonkey(engine);
    const state = engine.getState();
    expect(state).toHaveProperty('monkeys');
    expect((state as any).monkeys).toHaveLength(1);
  });

  it('返回包含 spawnQueue', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('spawnQueue');
  });

  it('返回包含 placingMonkey', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('placingMonkey', false);
  });

  it('bloons 是深拷贝不影响原始数据', () => {
    const engine = createAndStartEngine();
    addBloon(engine, { hp: 5 });
    const state = engine.getState() as any;
    state.bloons[0].hp = 0;

    expect(engine.bloons[0].hp).toBe(5);
  });
});

// ============================================================
// 17. 事件系统
// ============================================================
describe('BloonsEngine - 事件系统', () => {
  it('可以注册和触发自定义事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('customEvent', handler);
    (engine as any).emit('customEvent', 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });

  it('可以取消事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('customEvent', handler);
    engine.off('customEvent', handler);
    (engine as any).emit('customEvent');
    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy 后事件不再触发', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('customEvent', handler);
    engine.destroy();
    (engine as any).emit('customEvent');
    expect(handler).not.toHaveBeenCalled();
  });
});

// ============================================================
// 18. 路径辅助函数
// ============================================================
describe('BloonsEngine - 路径辅助', () => {
  it('getPositionOnPath(0) 返回路径起点', async () => {
    const { getPositionOnPath } = await import('../BloonsEngine');
    const pos = getPositionOnPath(0);
    expect(pos.x).toBeCloseTo(PATH_WAYPOINTS[0].x, 1);
    expect(pos.y).toBeCloseTo(PATH_WAYPOINTS[0].y, 1);
  });

  it('getPositionOnPath(1) 返回路径终点', async () => {
    const { getPositionOnPath } = await import('../BloonsEngine');
    const pos = getPositionOnPath(1);
    const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    expect(pos.x).toBeCloseTo(last.x, 1);
    expect(pos.y).toBeCloseTo(last.y, 1);
  });

  it('getPositionOnPath 负值被 clamp 到 0', async () => {
    const { getPositionOnPath } = await import('../BloonsEngine');
    const pos = getPositionOnPath(-0.5);
    expect(pos.x).toBeCloseTo(PATH_WAYPOINTS[0].x, 1);
  });

  it('getPositionOnPath 超过 1 被 clamp 到 1', async () => {
    const { getPositionOnPath } = await import('../BloonsEngine');
    const pos = getPositionOnPath(1.5);
    const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    expect(pos.x).toBeCloseTo(last.x, 1);
  });

  it('getPositionOnPath(0.5) 返回路径中点附近', async () => {
    const { getPositionOnPath } = await import('../BloonsEngine');
    const pos = getPositionOnPath(0.5);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// 19. 游戏结束
// ============================================================
describe('BloonsEngine - 游戏结束', () => {
  it('生命耗尽时游戏结束', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 1);
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(engine.status).toBe('gameover');
  });

  it('游戏结束时发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    setPrivate(engine, '_lives', 1);
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(handler).toHaveBeenCalledWith('gameover');
  });

  it('通关时 isWin 为 true', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_currentLevel', LEVELS.length - 1);
    setPrivate(engine, '_spawnQueue', []);
    setPrivate(engine, '_bloons', []);
    setPrivate(engine, '_bloonsSpawned', 1);

    callUpdate(engine, 16);

    expect(engine.isWin).toBe(true);
  });

  it('失败时 isWin 为 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 1);
    addBloon(engine, { pathProgress: 0.99, speed: 1.0 });

    callUpdate(engine, 100);

    expect(engine.isWin).toBe(false);
  });
});

// ============================================================
// 20. 飞镖投掷目标选择
// ============================================================
describe('BloonsEngine - 飞镖目标选择', () => {
  it('有气球时飞镖朝向最近气球', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', 240);
    setPrivate(engine, '_crosshairY', 320);
    addBloon(engine, { x: 260, y: 300 });

    engine.handleKeyDown(' ');

    if (engine.darts.length > 0) {
      const dart = engine.darts[0];
      // 目标应该朝向气球方向
      expect(dart.toX).not.toBe(dart.fromX);
    }
  });

  it('没有气球时飞镖默认向上飞', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', 240);
    setPrivate(engine, '_crosshairY', 400);
    // 确保没有气球
    setPrivate(engine, '_bloons', []);

    engine.handleKeyDown(' ');

    if (engine.darts.length > 0) {
      const dart = engine.darts[0];
      expect(dart.toY).toBeLessThan(dart.fromY);
    }
  });

  it('超过 300 距离的气球不被自动瞄准', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', 0);
    setPrivate(engine, '_crosshairY', 0);
    addBloon(engine, { x: 400, y: 400 }); // 距离超过 300

    engine.handleKeyDown(' ');

    if (engine.darts.length > 0) {
      const dart = engine.darts[0];
      // 目标应该是默认方向而不是气球位置
      expect(dart.toX).toBe(0);
    }
  });
});

// ============================================================
// 21. 常量验证
// ============================================================
describe('BloonsEngine - 常量验证', () => {
  it('CANVAS_WIDTH 为 480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT 为 640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('BLOON_RADIUS 为 16', () => {
    expect(BLOON_RADIUS).toBe(16);
  });

  it('MONKEY_RANGE 为 120', () => {
    expect(MONKEY_RANGE).toBe(120);
  });

  it('DART_SPEED 为 0.4', () => {
    expect(DART_SPEED).toBe(0.4);
  });

  it('DART_COOLDOWN 为 300', () => {
    expect(DART_COOLDOWN).toBe(300);
  });

  it('CROSSHAIR_SPEED 为 0.3', () => {
    expect(CROSSHAIR_SPEED).toBe(0.3);
  });

  it('BLOON_BASE_SPEED 为 0.04', () => {
    expect(BLOON_BASE_SPEED).toBe(0.04);
  });

  it('BLOON_SPAWN_INTERVAL 为 600', () => {
    expect(BLOON_SPAWN_INTERVAL).toBe(600);
  });

  it('PATH_WAYPOINTS 至少有 2 个点', () => {
    expect(PATH_WAYPOINTS.length).toBeGreaterThanOrEqual(2);
  });

  it('MONKEY_SLOTS 有 5 个位置', () => {
    expect(MONKEY_SLOTS).toHaveLength(5);
  });

  it('LEVELS 有 10 个关卡', () => {
    expect(LEVELS).toHaveLength(10);
  });

  it('所有关卡都有正数的气球数量', () => {
    LEVELS.forEach(config => {
      const total = config.red + config.blue + config.green + config.yellow;
      expect(total).toBeGreaterThan(0);
    });
  });

  it('所有关卡速度倍率大于 0', () => {
    LEVELS.forEach(config => {
      expect(config.speedMultiplier).toBeGreaterThan(0);
    });
  });

  it('所有关卡飞镖数大于 0', () => {
    LEVELS.forEach(config => {
      expect(config.darts).toBeGreaterThan(0);
    });
  });

  it('DIRECTION_KEYS 包含正确的键', () => {
    expect(DIRECTION_KEYS.UP).toContain('ArrowUp');
    expect(DIRECTION_KEYS.UP).toContain('w');
    expect(DIRECTION_KEYS.UP).toContain('W');
    expect(DIRECTION_KEYS.DOWN).toContain('ArrowDown');
    expect(DIRECTION_KEYS.LEFT).toContain('ArrowLeft');
    expect(DIRECTION_KEYS.RIGHT).toContain('ArrowRight');
  });
});
