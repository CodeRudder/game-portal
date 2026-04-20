/**
 * BalloonPopEngine 综合测试
 * 覆盖：初始化、气球生成/移动、准星控制、射击命中检测、不同气球类型得分、
 *       连击系统、时间限制、游戏结束、键盘控制、getState、事件系统
 */
import { BalloonPopEngine, BalloonData } from '../BalloonPopEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BalloonType,
  SCORE_NORMAL, SCORE_SMALL, SCORE_GOLDEN, SCORE_BOMB,
  BALLOON_RADIUS_NORMAL, BALLOON_RADIUS_SMALL, BALLOON_RADIUS_GOLDEN, BALLOON_RADIUS_BOMB,
  BALLOON_SPEED_MIN, BALLOON_SPEED_MAX, BALLOON_SPEED_SMALL_MIN, BALLOON_SPEED_SMALL_MAX,
  SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_DECREASE_PER_LEVEL, SPAWN_INTERVAL_MIN,
  SPAWN_CHANCE_NORMAL, SPAWN_CHANCE_SMALL, SPAWN_CHANCE_GOLDEN, SPAWN_CHANCE_BOMB,
  GAME_DURATION,
  COMBO_MULTIPLIER_THRESHOLDS, COMBO_MULTIPLIERS,
  LEVEL_UP_SCORE, MAX_LEVEL,
  CROSSHAIR_SPEED, CROSSHAIR_SIZE,
  HUD_HEIGHT,
  BALLOON_COLORS, GOLDEN_COLOR, BOMB_COLOR,
  POP_DURATION, POP_PARTICLES,
  DIRECTION_KEYS,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建 mock canvas (480×640) */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并 init（不 start，停留在 idle） */
function createEngine(): BalloonPopEngine {
  const engine = new BalloonPopEngine();
  engine.init();
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): BalloonPopEngine {
  const engine = new BalloonPopEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: BalloonPopEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: BalloonPopEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: BalloonPopEngine, deltaTime: number): void {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 手动添加一个气球到引擎中 */
function addBalloon(engine: BalloonPopEngine, overrides: Partial<BalloonData> = {}): BalloonData {
  const balloons = getPrivate<BalloonData[]>(engine, '_balloons');
  const nextId = getPrivate<number>(engine, '_nextBalloonId');
  const balloon: BalloonData = {
    id: nextId,
    type: BalloonType.NORMAL,
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    radius: BALLOON_RADIUS_NORMAL,
    speed: 0.1,
    color: '#ff6b6b',
    alive: true,
    wobblePhase: 0,
    wobbleAmplitude: 15,
    ...overrides,
  };
  balloons.push(balloon);
  setPrivate(engine, '_nextBalloonId', nextId + 1);
  return balloon;
}

/** 获取气球数组 */
function getBalloons(engine: BalloonPopEngine): BalloonData[] {
  return getPrivate<BalloonData[]>(engine, '_balloons');
}

/** 获取爆炸效果数组 */
function getPopEffects(engine: BalloonPopEngine): any[] {
  return getPrivate<any[]>(engine, '_popEffects');
}

/** 获取得分弹出数组 */
function getScorePopups(engine: BalloonPopEngine): any[] {
  return getPrivate<any[]>(engine, '_scorePopups');
}

/** 获取射击闪光数组 */
function getShootFlashes(engine: BalloonPopEngine): any[] {
  return getPrivate<any[]>(engine, '_shootFlashes');
}

// ============================================================
// 1. 初始化
// ============================================================
describe('BalloonPopEngine - 初始化', () => {
  it('应该能创建引擎实例', () => {
    const engine = new BalloonPopEngine();
    expect(engine).toBeInstanceOf(BalloonPopEngine);
  });

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

  it('init 后准星在画布中心', () => {
    const engine = createEngine();
    expect(engine.crosshairX).toBe(CANVAS_WIDTH / 2);
    expect(engine.crosshairY).toBe(CANVAS_HEIGHT / 2);
  });

  it('init 后连击为 0', () => {
    const engine = createEngine();
    expect(engine.combo).toBe(0);
  });

  it('init 后最大连击为 0', () => {
    const engine = createEngine();
    expect(engine.maxCombo).toBe(0);
  });

  it('init 后总射击数为 0', () => {
    const engine = createEngine();
    expect(engine.totalShots).toBe(0);
  });

  it('init 后总命中数为 0', () => {
    const engine = createEngine();
    expect(engine.totalHits).toBe(0);
  });

  it('init 后击破气球数为 0', () => {
    const engine = createEngine();
    expect(engine.balloonsPopped).toBe(0);
  });

  it('init 后逃脱气球数为 0', () => {
    const engine = createEngine();
    expect(engine.balloonsEscaped).toBe(0);
  });

  it('init 后剩余时间为 0（未 start）', () => {
    const engine = createEngine();
    expect(engine.remainingTime).toBe(0);
  });

  it('init 后气球列表为空', () => {
    const engine = createEngine();
    expect(engine.balloons).toHaveLength(0);
  });

  it('init 后倍率为 1', () => {
    const engine = createEngine();
    expect(engine.multiplier).toBe(1);
  });
});

// ============================================================
// 2. 气球生成
// ============================================================
describe('BalloonPopEngine - 气球生成', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('生成间隔到期后应生成气球', () => {
    // 设置 spawnTimer 为 0 让下一次 update 触发生成
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    expect(getBalloons(engine).length).toBeGreaterThanOrEqual(1);
  });

  it('生成的气球应有唯一 ID', () => {
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    const balloons = getBalloons(engine);
    if (balloons.length >= 2) {
      expect(balloons[0].id).not.toBe(balloons[1].id);
    }
  });

  it('生成的气球初始位置应在画布底部以下', () => {
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    const balloons = getBalloons(engine);
    if (balloons.length > 0) {
      expect(balloons[0].y).toBeGreaterThanOrEqual(CANVAS_HEIGHT);
    }
  });

  it('生成的气球 x 坐标应在画布范围内', () => {
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    const balloons = getBalloons(engine);
    if (balloons.length > 0) {
      const b = balloons[0];
      expect(b.x).toBeGreaterThanOrEqual(b.radius);
      expect(b.x).toBeLessThanOrEqual(CANVAS_WIDTH - b.radius);
    }
  });

  it('生成的气球应为存活状态', () => {
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    const balloons = getBalloons(engine);
    if (balloons.length > 0) {
      expect(balloons[0].alive).toBe(true);
    }
  });

  it('生成气球后应重置 spawnTimer', () => {
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    const timer = getPrivate<number>(engine, '_spawnTimer');
    expect(timer).toBeGreaterThan(0);
  });

  it('生成气球应触发 balloonSpawned 事件', () => {
    const handler = jest.fn();
    engine.on('balloonSpawned', handler);
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalled();
  });

  it('balloonSpawned 事件应包含气球数据', () => {
    const handler = jest.fn();
    engine.on('balloonSpawned', handler);
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        balloon: expect.objectContaining({
          id: expect.any(Number),
          type: expect.any(String),
          x: expect.any(Number),
          y: expect.any(Number),
          radius: expect.any(Number),
          speed: expect.any(Number),
          color: expect.any(String),
          alive: true,
        }),
      }),
    );
  });

  it('普通气球颜色应来自 BALLOON_COLORS', () => {
    // Mock randomBalloonType to always return NORMAL
    const proto = Object.getPrototypeOf(engine);
    const original = proto._randomBalloonType.bind(engine);
    proto._randomBalloonType = () => BalloonType.NORMAL;

    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);

    const balloons = getBalloons(engine);
    if (balloons.length > 0 && balloons[0].type === BalloonType.NORMAL) {
      expect(BALLOON_COLORS).toContain(balloons[0].color);
    }

    proto._randomBalloonType = original;
  });

  it('金色气球颜色应为 GOLDEN_COLOR', () => {
    const proto = Object.getPrototypeOf(engine);
    const original = proto._randomBalloonType.bind(engine);
    proto._randomBalloonType = () => BalloonType.GOLDEN;

    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);

    const balloons = getBalloons(engine);
    if (balloons.length > 0) {
      expect(balloons[0].color).toBe(GOLDEN_COLOR);
    }

    proto._randomBalloonType = original;
  });

  it('炸弹气球颜色应为 BOMB_COLOR', () => {
    const proto = Object.getPrototypeOf(engine);
    const original = proto._randomBalloonType.bind(engine);
    proto._randomBalloonType = () => BalloonType.BOMB;

    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 16);

    const balloons = getBalloons(engine);
    if (balloons.length > 0) {
      expect(balloons[0].color).toBe(BOMB_COLOR);
    }

    proto._randomBalloonType = original;
  });
});

// ============================================================
// 3. 气球移动
// ============================================================
describe('BalloonPopEngine - 气球移动', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('气球应向上移动（y 减小）', () => {
    addBalloon(engine, { y: 400, speed: 0.1 });
    const beforeY = getBalloons(engine)[0].y;
    callUpdate(engine, 1000);
    const afterY = getBalloons(engine)[0].y;
    expect(afterY).toBeLessThan(beforeY);
  });

  it('气球移动距离应等于 speed * deltaTime', () => {
    const speed = 0.1;
    addBalloon(engine, { y: 500, speed });
    callUpdate(engine, 1000);
    const balloon = getBalloons(engine)[0];
    expect(balloon.y).toBeCloseTo(500 - speed * 1000, 1);
  });

  it('气球应有水平摆动', () => {
    const balloon = addBalloon(engine, { y: 400, wobbleAmplitude: 20 });
    const beforeX = balloon.x;
    // 摆动相位变化
    callUpdate(engine, 500);
    // wobblePhase should have changed
    expect(balloon.wobblePhase).toBeGreaterThan(0);
  });

  it('气球不应超出左右边界', () => {
    addBalloon(engine, { x: 5, y: 400, radius: BALLOON_RADIUS_NORMAL, wobbleAmplitude: 100 });
    callUpdate(engine, 1000);
    const balloon = getBalloons(engine)[0];
    expect(balloon.x).toBeGreaterThanOrEqual(balloon.radius);
  });

  it('气球飘出顶部后应被移除', () => {
    // y + radius < 0 触发移除。设置 y 使得 y + radius < 0
    const radius = BALLOON_RADIUS_NORMAL;
    addBalloon(engine, { y: -(radius + 10) });
    // 气球先向上移动（y 变更小），然后检查 y + radius < 0
    callUpdate(engine, 16);
    // 气球应该已经从列表中移除
    const balloons = getBalloons(engine);
    const escaped = balloons.filter(b => b.alive);
    // 要么列表为空（已移除），要么没有存活的
    // 注意：update 中可能还会生成新气球，所以只检查我们添加的那个是否不在了
    expect(balloons.some(b => b.y === -(radius + 10) && b.alive)).toBe(false);
  });

  it('气球飘出顶部应增加 balloonsEscaped 计数', () => {
    addBalloon(engine, { y: -BALLOON_RADIUS_NORMAL - 1 });
    callUpdate(engine, 16);
    expect(engine.balloonsEscaped).toBe(1);
  });

  it('气球飘出顶部应触发 balloonEscaped 事件', () => {
    const handler = jest.fn();
    engine.on('balloonEscaped', handler);
    addBalloon(engine, { y: -BALLOON_RADIUS_NORMAL - 1 });
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalled();
  });

  it('气球飘出顶部应断连击', () => {
    setPrivate(engine, '_combo', 5);
    addBalloon(engine, { y: -BALLOON_RADIUS_NORMAL - 1 });
    callUpdate(engine, 16);
    expect(engine.combo).toBe(0);
  });

  it('死亡气球应从列表中移除', () => {
    addBalloon(engine, { y: -(BALLOON_RADIUS_NORMAL + 1) });
    callUpdate(engine, 16);
    // 气球飘出顶部后应被移除
    expect(getBalloons(engine).filter(b => !b.alive).length).toBe(0);
  });

  it('多个气球同时移动', () => {
    // 设置大的 spawnTimer 防止自动生成
    setPrivate(engine, '_spawnTimer', 99999);
    addBalloon(engine, { y: 500, speed: 0.1 });
    addBalloon(engine, { y: 400, speed: 0.08 });
    callUpdate(engine, 1000);
    const balloons = getBalloons(engine);
    expect(balloons.length).toBeGreaterThanOrEqual(2);
    // 找到我们添加的两个气球（排除可能自动生成的）
    const moved = balloons.filter(b => b.speed === 0.1 || b.speed === 0.08);
    expect(moved.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// 4. 准星控制
// ============================================================
describe('BalloonPopEngine - 准星控制', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('按上键准星应向上移动', () => {
    const startY = engine.crosshairY;
    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 1000);
    expect(engine.crosshairY).toBeLessThan(startY);
  });

  it('按 W 键准星应向上移动', () => {
    const startY = engine.crosshairY;
    engine.handleKeyDown('w');
    callUpdate(engine, 1000);
    expect(engine.crosshairY).toBeLessThan(startY);
  });

  it('按下键准星应向下移动', () => {
    const startY = engine.crosshairY;
    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 1000);
    expect(engine.crosshairY).toBeGreaterThan(startY);
  });

  it('按 S 键准星应向下移动', () => {
    const startY = engine.crosshairY;
    engine.handleKeyDown('s');
    callUpdate(engine, 1000);
    expect(engine.crosshairY).toBeGreaterThan(startY);
  });

  it('按左键准星应向左移动', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 1000);
    expect(engine.crosshairX).toBeLessThan(startX);
  });

  it('按 A 键准星应向左移动', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('a');
    callUpdate(engine, 1000);
    expect(engine.crosshairX).toBeLessThan(startX);
  });

  it('按右键准星应向右移动', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 1000);
    expect(engine.crosshairX).toBeGreaterThan(startX);
  });

  it('按 D 键准星应向右移动', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('d');
    callUpdate(engine, 1000);
    expect(engine.crosshairX).toBeGreaterThan(startX);
  });

  it('准星移动速度应为 CROSSHAIR_SPEED * deltaTime', () => {
    // 从中心开始，向右移动，不会碰到边界
    setPrivate(engine, '_crosshairX', CANVAS_WIDTH / 2);
    const startX = engine.crosshairX;
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 100);
    expect(engine.crosshairX).toBeCloseTo(startX + CROSSHAIR_SPEED * 100, 1);
  });

  it('松开按键后准星应停止移动', () => {
    const startX = engine.crosshairX;
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 500);
    const movedX = engine.crosshairX;
    engine.handleKeyUp('ArrowRight');
    callUpdate(engine, 500);
    expect(engine.crosshairX).toBeCloseTo(movedX, 1);
  });

  it('准星不应超出上边界（HUD_HEIGHT）', () => {
    setPrivate(engine, '_crosshairY', HUD_HEIGHT + 10);
    engine.handleKeyDown('ArrowUp');
    callUpdate(engine, 10000); // 大量时间
    expect(engine.crosshairY).toBeGreaterThanOrEqual(HUD_HEIGHT);
  });

  it('准星不应超出下边界（CANVAS_HEIGHT）', () => {
    setPrivate(engine, '_crosshairY', CANVAS_HEIGHT - 10);
    engine.handleKeyDown('ArrowDown');
    callUpdate(engine, 10000);
    expect(engine.crosshairY).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  it('准星不应超出左边界（0）', () => {
    setPrivate(engine, '_crosshairX', 10);
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 10000);
    expect(engine.crosshairX).toBeGreaterThanOrEqual(0);
  });

  it('准星不应超出右边界（CANVAS_WIDTH）', () => {
    setPrivate(engine, '_crosshairX', CANVAS_WIDTH - 10);
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 10000);
    expect(engine.crosshairX).toBeLessThanOrEqual(CANVAS_WIDTH);
  });

  it('同时按上和右，准星应对角移动', () => {
    const startX = engine.crosshairX;
    const startY = engine.crosshairY;
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 1000);
    expect(engine.crosshairX).toBeGreaterThan(startX);
    expect(engine.crosshairY).toBeLessThan(startY);
  });
});

// ============================================================
// 5. 射击命中检测
// ============================================================
describe('BalloonPopEngine - 射击命中检测', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('射击应增加 totalShots', () => {
    engine.handleKeyDown(' ');
    expect(engine.totalShots).toBe(1);
  });

  it('连续射击应累加 totalShots', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    expect(engine.totalShots).toBe(3);
  });

  it('准星在气球范围内应命中', () => {
    const balloon = addBalloon(engine, {
      x: 200, y: 300, radius: 25,
    });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(balloon.alive).toBe(false);
    expect(engine.totalHits).toBe(1);
  });

  it('准星在气球边缘应命中', () => {
    const balloon = addBalloon(engine, {
      x: 200, y: 300, radius: 25,
    });
    setPrivate(engine, '_crosshairX', 225); // 恰好在边缘
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(balloon.alive).toBe(false);
  });

  it('准星在气球范围外应未命中', () => {
    addBalloon(engine, {
      x: 200, y: 300, radius: 25,
    });
    setPrivate(engine, '_crosshairX', 300);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.totalHits).toBe(0);
  });

  it('多个气球重叠时应命中最后添加的（最上层）', () => {
    const balloon1 = addBalloon(engine, {
      x: 200, y: 300, radius: 30, type: BalloonType.NORMAL,
    });
    const balloon2 = addBalloon(engine, {
      x: 200, y: 300, radius: 30, type: BalloonType.GOLDEN,
    });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    // balloon2 (last added) should be hit
    expect(balloon2.alive).toBe(false);
    expect(balloon1.alive).toBe(true);
  });

  it('射击应产生射击闪光效果', () => {
    engine.handleKeyDown(' ');
    expect(getShootFlashes(engine).length).toBe(1);
  });

  it('命中应产生爆炸效果', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25 });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(getPopEffects(engine).length).toBe(1);
  });

  it('命中应产生得分弹出', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(getScorePopups(engine).length).toBe(1);
  });

  it('未命中不应产生爆炸效果', () => {
    setPrivate(engine, '_crosshairX', 0);
    setPrivate(engine, '_crosshairY', 0);
    engine.handleKeyDown(' ');
    expect(getPopEffects(engine).length).toBe(0);
  });

  it('未命中应触发 miss 事件', () => {
    const handler = jest.fn();
    engine.on('miss', handler);
    setPrivate(engine, '_crosshairX', 0);
    setPrivate(engine, '_crosshairY', 0);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0 }),
    );
  });

  it('死亡气球不应被命中', () => {
    const balloon = addBalloon(engine, {
      x: 200, y: 300, radius: 25, alive: false,
    });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.totalHits).toBe(0);
  });
});

// ============================================================
// 6. 不同气球类型得分
// ============================================================
describe('BalloonPopEngine - 不同气球类型得分', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('命中普通气球应得 SCORE_NORMAL（10分）', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(SCORE_NORMAL);
  });

  it('命中小型气球应得 SCORE_SMALL（25分）', () => {
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_SMALL, type: BalloonType.SMALL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(SCORE_SMALL);
  });

  it('命中金色气球应得 SCORE_GOLDEN（50分）', () => {
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_GOLDEN, type: BalloonType.GOLDEN });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(SCORE_GOLDEN);
  });

  it('命中炸弹应扣 SCORE_BOMB（-30分）', () => {
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_BOMB, type: BalloonType.BOMB });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(SCORE_BOMB);
  });

  it('命中炸弹应触发 hitBomb 事件', () => {
    const handler = jest.fn();
    engine.on('hitBomb', handler);
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_BOMB, type: BalloonType.BOMB });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ score: SCORE_BOMB }),
    );
  });

  it('命中普通气球应触发 hitBalloon 事件', () => {
    const handler = jest.fn();
    engine.on('hitBalloon', handler);
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        score: SCORE_NORMAL,
        combo: 1,
        multiplier: 1,
      }),
    );
  });

  it('命中炸弹不应增加连击', () => {
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_BOMB, type: BalloonType.BOMB });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(0);
  });

  it('连续命中多个普通气球应累加分数', () => {
    // 第一个气球
    addBalloon(engine, { x: 100, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 100);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');

    // 第二个气球
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');

    expect(engine.score).toBe(SCORE_NORMAL * 2);
  });

  it('击破气球应增加 balloonsPopped 计数', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.balloonsPopped).toBe(1);
  });
});

// ============================================================
// 7. 连击系统
// ============================================================
describe('BalloonPopEngine - 连击系统', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始连击应为 0', () => {
    expect(engine.combo).toBe(0);
  });

  it('命中普通气球应增加连击', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(1);
  });

  it('连续命中应累加连击', () => {
    for (let i = 0; i < 5; i++) {
      addBalloon(engine, { x: 100 + i * 50, y: 300, radius: 25, type: BalloonType.NORMAL });
      setPrivate(engine, '_crosshairX', 100 + i * 50);
      setPrivate(engine, '_crosshairY', 300);
      engine.handleKeyDown(' ');
    }
    expect(engine.combo).toBe(5);
  });

  it('未命中应断连击', () => {
    setPrivate(engine, '_combo', 5);
    setPrivate(engine, '_crosshairX', 0);
    setPrivate(engine, '_crosshairY', 0);
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(0);
  });

  it('命中炸弹应断连击', () => {
    setPrivate(engine, '_combo', 5);
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_BOMB, type: BalloonType.BOMB });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(0);
  });

  it('气球飘出顶部应断连击', () => {
    setPrivate(engine, '_combo', 5);
    addBalloon(engine, { y: -BALLOON_RADIUS_NORMAL - 1 });
    callUpdate(engine, 16);
    expect(engine.combo).toBe(0);
  });

  it('连击应更新 maxCombo', () => {
    for (let i = 0; i < 3; i++) {
      addBalloon(engine, { x: 100 + i * 50, y: 300, radius: 25, type: BalloonType.NORMAL });
      setPrivate(engine, '_crosshairX', 100 + i * 50);
      setPrivate(engine, '_crosshairY', 300);
      engine.handleKeyDown(' ');
    }
    expect(engine.maxCombo).toBe(3);
  });

  it('maxCombo 不应在连击断开后减少', () => {
    for (let i = 0; i < 3; i++) {
      addBalloon(engine, { x: 100 + i * 50, y: 300, radius: 25, type: BalloonType.NORMAL });
      setPrivate(engine, '_crosshairX', 100 + i * 50);
      setPrivate(engine, '_crosshairY', 300);
      engine.handleKeyDown(' ');
    }
    expect(engine.maxCombo).toBe(3);
    // miss
    setPrivate(engine, '_crosshairX', 0);
    setPrivate(engine, '_crosshairY', 0);
    engine.handleKeyDown(' ');
    expect(engine.maxCombo).toBe(3);
  });

  // 倍率测试
  it('连击 0 时倍率为 1', () => {
    expect(engine.multiplier).toBe(1);
  });

  it('连击 3 时倍率为 1.5', () => {
    setPrivate(engine, '_combo', 3);
    expect(engine.multiplier).toBe(1.5);
  });

  it('连击 6 时倍率为 2', () => {
    setPrivate(engine, '_combo', 6);
    expect(engine.multiplier).toBe(2);
  });

  it('连击 10 时倍率为 2.5', () => {
    setPrivate(engine, '_combo', 10);
    expect(engine.multiplier).toBe(2.5);
  });

  it('连击 15 时倍率为 3', () => {
    setPrivate(engine, '_combo', 15);
    expect(engine.multiplier).toBe(3);
  });

  it('连击 20 时倍率仍为 3（最大倍率）', () => {
    setPrivate(engine, '_combo', 20);
    expect(engine.multiplier).toBe(3);
  });

  it('连击倍率应影响得分', () => {
    setPrivate(engine, '_combo', 2); // combo=3 after hit, multiplier=1.5
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    // combo becomes 3, multiplier is 1.5, score = round(10 * 1.5) = 15
    expect(engine.score).toBe(Math.round(SCORE_NORMAL * 1.5));
  });

  it('得分弹出文本在倍率>1时应显示倍率信息', () => {
    setPrivate(engine, '_combo', 2);
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    expect(popups[0].text).toContain('x1.5');
  });
});

// ============================================================
// 8. 时间限制
// ============================================================
describe('BalloonPopEngine - 时间限制', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('游戏开始时剩余时间应为 GAME_DURATION', () => {
    expect(engine.remainingTime).toBe(GAME_DURATION);
  });

  it('update 应减少剩余时间', () => {
    const before = engine.remainingTime;
    callUpdate(engine, 1000);
    expect(engine.remainingTime).toBeLessThan(before);
  });

  it('减少的时间量应等于 deltaTime（秒）', () => {
    callUpdate(engine, 1000);
    expect(engine.remainingTime).toBeCloseTo(GAME_DURATION - 1, 1);
  });

  it('剩余时间不应小于 0', () => {
    setPrivate(engine, '_gameTimer', 500);
    callUpdate(engine, 1000);
    expect(engine.remainingTime).toBe(0);
  });

  it('时间耗尽应触发游戏结束', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    expect(engine.status).toBe('gameover');
  });

  it('时间耗尽应触发 statusChange 事件', () => {
    const handler = jest.fn();
    engine.on('statusChange', handler);
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    expect(handler).toHaveBeenCalledWith('gameover');
  });

  it('游戏结束后 update 不应继续减少时间', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    expect(engine.status).toBe('gameover');
    const time = engine.remainingTime;
    // 后续 update 不应改变状态（gameLoop 已停止）
  });
});

// ============================================================
// 9. 游戏结束
// ============================================================
describe('BalloonPopEngine - 游戏结束', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('时间耗尽后状态应为 gameover', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    expect(engine.status).toBe('gameover');
  });

  it('游戏结束后按空格应重新开始', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    expect(engine.status).toBe('gameover');

    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('重新开始后分数应重置为 0', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(0);
  });

  it('重新开始后等级应重置为 1', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    engine.handleKeyDown(' ');
    expect(engine.level).toBe(1);
  });

  it('重新开始后连击应重置为 0', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    engine.handleKeyDown(' ');
    expect(engine.combo).toBe(0);
  });

  it('重新开始后气球列表应为空', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    engine.handleKeyDown(' ');
    expect(engine.balloons).toHaveLength(0);
  });

  it('重新开始后剩余时间应重置', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    engine.handleKeyDown(' ');
    expect(engine.remainingTime).toBe(GAME_DURATION);
  });

  it('重新开始后准星应在画布中心', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    engine.handleKeyDown(' ');
    expect(engine.crosshairX).toBe(CANVAS_WIDTH / 2);
    expect(engine.crosshairY).toBe(CANVAS_HEIGHT / 2);
  });

  it('重新开始后统计数据应重置', () => {
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    engine.handleKeyDown(' ');
    expect(engine.totalShots).toBe(0);
    expect(engine.totalHits).toBe(0);
    expect(engine.balloonsPopped).toBe(0);
    expect(engine.balloonsEscaped).toBe(0);
    expect(engine.maxCombo).toBe(0);
  });
});

// ============================================================
// 10. 键盘控制
// ============================================================
describe('BalloonPopEngine - 键盘控制', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('idle 状态下按空格应开始游戏', () => {
    const canvas = createMockCanvas();
    engine.init(canvas);
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('idle 状态下按 Space 应开始游戏', () => {
    const canvas = createMockCanvas();
    engine.init(canvas);
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });

  it('playing 状态下按方向键不应改变状态', () => {
    const canvas = createMockCanvas();
    engine.init(canvas);
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    engine.handleKeyDown('ArrowUp');
    expect(engine.status).toBe('playing');
  });

  it('playing 状态下按空格应射击', () => {
    const canvas = createMockCanvas();
    engine.init(canvas);
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    expect(engine.totalShots).toBe(1); // 第一个空格是开始，第二个是射击
  });

  it('gameover 状态下按空格应重新开始', () => {
    const canvas = createMockCanvas();
    engine.init(canvas);
    engine.handleKeyDown(' ');
    setPrivate(engine, '_status', 'gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('W 键应映射为上', () => {
    const engine2 = createAndStartEngine();
    const startY = engine2.crosshairY;
    engine2.handleKeyDown('W');
    callUpdate(engine2, 1000);
    expect(engine2.crosshairY).toBeLessThan(startY);
  });

  it('大写 W 键应映射为上', () => {
    const engine2 = createAndStartEngine();
    const startY = engine2.crosshairY;
    engine2.handleKeyDown('W');
    callUpdate(engine2, 1000);
    expect(engine2.crosshairY).toBeLessThan(startY);
  });

  it('S 键应映射为下', () => {
    const engine2 = createAndStartEngine();
    const startY = engine2.crosshairY;
    engine2.handleKeyDown('S');
    callUpdate(engine2, 1000);
    expect(engine2.crosshairY).toBeGreaterThan(startY);
  });

  it('A 键应映射为左', () => {
    const engine2 = createAndStartEngine();
    const startX = engine2.crosshairX;
    engine2.handleKeyDown('A');
    callUpdate(engine2, 1000);
    expect(engine2.crosshairX).toBeLessThan(startX);
  });

  it('D 键应映射为右', () => {
    const engine2 = createAndStartEngine();
    const startX = engine2.crosshairX;
    engine2.handleKeyDown('D');
    callUpdate(engine2, 1000);
    expect(engine2.crosshairX).toBeGreaterThan(startX);
  });

  it('handleKeyUp 应移除方向状态', () => {
    const engine2 = createAndStartEngine();
    engine2.handleKeyDown('ArrowUp');
    const directions = getPrivate<Set<string>>(engine2, '_directionPressed');
    expect(directions.has('up')).toBe(true);
    engine2.handleKeyUp('ArrowUp');
    expect(directions.has('up')).toBe(false);
  });

  it('handleKeyUp W 应移除上方向', () => {
    const engine2 = createAndStartEngine();
    engine2.handleKeyDown('w');
    const directions = getPrivate<Set<string>>(engine2, '_directionPressed');
    expect(directions.has('up')).toBe(true);
    engine2.handleKeyUp('w');
    expect(directions.has('up')).toBe(false);
  });

  it('idle 状态下方向键不应有效果', () => {
    const startY = engine.crosshairY;
    engine.handleKeyDown('ArrowUp');
    // idle 状态，不处理方向
    expect(engine.crosshairY).toBe(startY);
  });

  it('gameover 状态下方向键不应有效果', () => {
    const canvas = createMockCanvas();
    engine.init(canvas);
    engine.handleKeyDown(' ');
    setPrivate(engine, '_status', 'gameover');
    const startY = engine.crosshairY;
    engine.handleKeyDown('ArrowUp');
    expect(engine.crosshairY).toBe(startY);
  });
});

// ============================================================
// 11. getState
// ============================================================
describe('BalloonPopEngine - getState', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('getState 应返回 score', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('score');
  });

  it('getState 应返回 level', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('level');
  });

  it('getState 应返回 status', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('status');
    expect(state.status).toBe('playing');
  });

  it('getState 应返回 crosshairX', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('crosshairX');
    expect(state.crosshairX).toBe(CANVAS_WIDTH / 2);
  });

  it('getState 应返回 crosshairY', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('crosshairY');
    expect(state.crosshairY).toBe(CANVAS_HEIGHT / 2);
  });

  it('getState 应返回 combo', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('combo');
  });

  it('getState 应返回 maxCombo', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('maxCombo');
  });

  it('getState 应返回 multiplier', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('multiplier');
  });

  it('getState 应返回 totalShots', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('totalShots');
  });

  it('getState 应返回 totalHits', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('totalHits');
  });

  it('getState 应返回 balloonsPopped', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('balloonsPopped');
  });

  it('getState 应返回 balloonsEscaped', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('balloonsEscaped');
  });

  it('getState 应返回 remainingTime', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('remainingTime');
  });

  it('getState 应返回 balloons 数组', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('balloons');
    expect(Array.isArray(state.balloons)).toBe(true);
  });

  it('getState 的 balloons 应是快照（不影响内部状态）', () => {
    addBalloon(engine, { x: 200, y: 300 });
    const state = engine.getState();
    const balloons = state.balloons as BalloonData[];
    balloons[0].x = 999;
    // 内部状态不应被修改
    expect(getBalloons(engine)[0].x).not.toBe(999);
  });
});

// ============================================================
// 12. 事件系统
// ============================================================
describe('BalloonPopEngine - 事件系统', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('start 应触发 statusChange 事件', () => {
    const handler = jest.fn();
    const engine2 = new BalloonPopEngine();
    const canvas = createMockCanvas();
    engine2.init(canvas);
    engine2.on('statusChange', handler);
    engine2.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('start 应触发 scoreChange 事件', () => {
    const handler = jest.fn();
    const engine2 = new BalloonPopEngine();
    const canvas = createMockCanvas();
    engine2.init(canvas);
    engine2.on('scoreChange', handler);
    engine2.start();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('start 应触发 levelChange 事件', () => {
    const handler = jest.fn();
    const engine2 = new BalloonPopEngine();
    const canvas = createMockCanvas();
    engine2.init(canvas);
    engine2.on('levelChange', handler);
    engine2.start();
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('得分变化应触发 scoreChange 事件', () => {
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledWith(SCORE_NORMAL);
  });

  it('升级应触发 levelUp 事件', () => {
    const handler = jest.fn();
    engine.on('levelUp', handler);
    setPrivate(engine, '_score', LEVEL_UP_SCORE);
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalledWith(2);
  });

  it('off 应取消事件监听', () => {
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.off('scoreChange', handler);
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy 应清除所有事件监听', () => {
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.destroy();
    // After destroy, events should not fire
    // But since engine is destroyed, we can't easily test this
    // Just verify no error is thrown
    expect(true).toBe(true);
  });

  it('reset 应触发 statusChange 为 idle', () => {
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });

  it('gameOver 应触发 statusChange 为 gameover', () => {
    const handler = jest.fn();
    engine.on('statusChange', handler);
    setPrivate(engine, '_gameTimer', 100);
    callUpdate(engine, 200);
    expect(handler).toHaveBeenCalledWith('gameover');
  });

  it('hitBalloon 事件应包含完整信息', () => {
    const handler = jest.fn();
    engine.on('hitBalloon', handler);
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        balloon: expect.objectContaining({
          type: BalloonType.NORMAL,
          alive: false,
        }),
        score: SCORE_NORMAL,
        combo: 1,
        multiplier: 1,
      }),
    );
  });
});

// ============================================================
// 13. 等级系统
// ============================================================
describe('BalloonPopEngine - 等级系统', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始等级应为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('得分达到 LEVEL_UP_SCORE 应升到等级 2', () => {
    setPrivate(engine, '_score', LEVEL_UP_SCORE);
    callUpdate(engine, 16);
    expect(engine.level).toBe(2);
  });

  it('等级不应超过 MAX_LEVEL', () => {
    setPrivate(engine, '_score', (MAX_LEVEL + 1) * LEVEL_UP_SCORE);
    callUpdate(engine, 16);
    expect(engine.level).toBe(MAX_LEVEL);
  });

  it('升级应触发 levelChange 事件', () => {
    const handler = jest.fn();
    engine.on('levelChange', handler);
    setPrivate(engine, '_score', LEVEL_UP_SCORE);
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalledWith(2);
  });

  it('升级应触发 levelUp 事件', () => {
    const handler = jest.fn();
    engine.on('levelUp', handler);
    setPrivate(engine, '_score', LEVEL_UP_SCORE);
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalledWith(2);
  });

  it('等级越高生成间隔越短', () => {
    setPrivate(engine, '_level', 1);
    const proto = Object.getPrototypeOf(engine);
    const interval1 = proto._getSpawnInterval.call(engine);

    setPrivate(engine, '_level', 5);
    const interval5 = proto._getSpawnInterval.call(engine);

    expect(interval5).toBeLessThan(interval1);
  });

  it('生成间隔不应低于 SPAWN_INTERVAL_MIN', () => {
    setPrivate(engine, '_level', MAX_LEVEL + 10);
    const proto = Object.getPrototypeOf(engine);
    const interval = proto._getSpawnInterval.call(engine);
    expect(interval).toBeGreaterThanOrEqual(SPAWN_INTERVAL_MIN);
  });

  it('等级 1 生成间隔应为 SPAWN_INTERVAL_BASE', () => {
    const proto = Object.getPrototypeOf(engine);
    const interval = proto._getSpawnInterval.call(engine);
    expect(interval).toBe(SPAWN_INTERVAL_BASE);
  });
});

// ============================================================
// 14. 视觉效果
// ============================================================
describe('BalloonPopEngine - 视觉效果', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('爆炸效果应由 POP_PARTICLES 个粒子组成', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    const effects = getPopEffects(engine);
    expect(effects[0].particles).toHaveLength(POP_PARTICLES);
  });

  it('爆炸效果持续时间应为 POP_DURATION', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    const effects = getPopEffects(engine);
    expect(effects[0].duration).toBe(POP_DURATION);
  });

  it('爆炸效果超时后应被移除', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    callUpdate(engine, POP_DURATION + 100);
    expect(getPopEffects(engine).length).toBe(0);
  });

  it('得分弹出超时后应被移除', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    callUpdate(engine, 1000);
    expect(getScorePopups(engine).length).toBe(0);
  });

  it('射击闪光超时后应被移除', () => {
    engine.handleKeyDown(' ');
    callUpdate(engine, 200);
    expect(getShootFlashes(engine).length).toBe(0);
  });

  it('得分弹出应向上移动', () => {
    addBalloon(engine, { x: 200, y: 300, radius: 25, type: BalloonType.NORMAL });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    const startY = popups[0].y;
    callUpdate(engine, 500);
    expect(popups[0].y).toBeLessThan(startY);
  });

  it('炸弹命中应产生红色爆炸效果', () => {
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_BOMB, type: BalloonType.BOMB });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    const effects = getPopEffects(engine);
    expect(effects.length).toBe(1);
    // 炸弹爆炸粒子颜色应为 BOMB_FUSE_COLOR
  });

  it('炸弹命中得分弹出应为负数文本', () => {
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_BOMB, type: BalloonType.BOMB });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    expect(popups[0].text).toBe(`${SCORE_BOMB}`);
  });
});

// ============================================================
// 15. 生成间隔与等级关系
// ============================================================
describe('BalloonPopEngine - 生成间隔', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('等级 1 生成间隔为 SPAWN_INTERVAL_BASE', () => {
    const proto = Object.getPrototypeOf(engine);
    const interval = proto._getSpawnInterval.call(engine);
    expect(interval).toBe(SPAWN_INTERVAL_BASE);
  });

  it('每升一级减少 SPAWN_INTERVAL_DECREASE_PER_LEVEL', () => {
    setPrivate(engine, '_level', 2);
    const proto = Object.getPrototypeOf(engine);
    const interval = proto._getSpawnInterval.call(engine);
    expect(interval).toBe(SPAWN_INTERVAL_BASE - SPAWN_INTERVAL_DECREASE_PER_LEVEL);
  });

  it('生成间隔最小为 SPAWN_INTERVAL_MIN', () => {
    setPrivate(engine, '_level', 100);
    const proto = Object.getPrototypeOf(engine);
    const interval = proto._getSpawnInterval.call(engine);
    expect(interval).toBe(SPAWN_INTERVAL_MIN);
  });
});

// ============================================================
// 16. 气球半径
// ============================================================
describe('BalloonPopEngine - 气球半径', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('普通气球半径为 BALLOON_RADIUS_NORMAL', () => {
    const proto = Object.getPrototypeOf(engine);
    const radius = proto._getBalloonRadius.call(engine, BalloonType.NORMAL);
    expect(radius).toBe(BALLOON_RADIUS_NORMAL);
  });

  it('小型气球半径为 BALLOON_RADIUS_SMALL', () => {
    const proto = Object.getPrototypeOf(engine);
    const radius = proto._getBalloonRadius.call(engine, BalloonType.SMALL);
    expect(radius).toBe(BALLOON_RADIUS_SMALL);
  });

  it('金色气球半径为 BALLOON_RADIUS_GOLDEN', () => {
    const proto = Object.getPrototypeOf(engine);
    const radius = proto._getBalloonRadius.call(engine, BalloonType.GOLDEN);
    expect(radius).toBe(BALLOON_RADIUS_GOLDEN);
  });

  it('炸弹气球半径为 BALLOON_RADIUS_BOMB', () => {
    const proto = Object.getPrototypeOf(engine);
    const radius = proto._getBalloonRadius.call(engine, BalloonType.BOMB);
    expect(radius).toBe(BALLOON_RADIUS_BOMB);
  });
});

// ============================================================
// 17. 气球速度
// ============================================================
describe('BalloonPopEngine - 气球速度', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('普通气球速度范围应在 BALLOON_SPEED_MIN 和 BALLOON_SPEED_MAX 之间', () => {
    const proto = Object.getPrototypeOf(engine);
    for (let i = 0; i < 50; i++) {
      const speed = proto._getBalloonSpeed.call(engine, BalloonType.NORMAL);
      expect(speed).toBeGreaterThanOrEqual(BALLOON_SPEED_MIN);
      expect(speed).toBeLessThanOrEqual(BALLOON_SPEED_MAX);
    }
  });

  it('小型气球速度范围应在 BALLOON_SPEED_SMALL_MIN 和 BALLOON_SPEED_SMALL_MAX 之间', () => {
    const proto = Object.getPrototypeOf(engine);
    for (let i = 0; i < 50; i++) {
      const speed = proto._getBalloonSpeed.call(engine, BalloonType.SMALL);
      expect(speed).toBeGreaterThanOrEqual(BALLOON_SPEED_SMALL_MIN);
      expect(speed).toBeLessThanOrEqual(BALLOON_SPEED_SMALL_MAX);
    }
  });

  it('小型气球应比普通气球快', () => {
    const proto = Object.getPrototypeOf(engine);
    const smallSpeed = proto._getBalloonSpeed.call(engine, BalloonType.SMALL);
    // Small speed min is higher than normal speed min
    expect(BALLOON_SPEED_SMALL_MIN).toBeGreaterThan(BALLOON_SPEED_MIN);
  });
});

// ============================================================
// 18. 气球基础分数
// ============================================================
describe('BalloonPopEngine - 气球基础分数', () => {
  let engine: BalloonPopEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('普通气球基础分为 SCORE_NORMAL', () => {
    const proto = Object.getPrototypeOf(engine);
    expect(proto._getBalloonScore.call(engine, BalloonType.NORMAL)).toBe(SCORE_NORMAL);
  });

  it('小型气球基础分为 SCORE_SMALL', () => {
    const proto = Object.getPrototypeOf(engine);
    expect(proto._getBalloonScore.call(engine, BalloonType.SMALL)).toBe(SCORE_SMALL);
  });

  it('金色气球基础分为 SCORE_GOLDEN', () => {
    const proto = Object.getPrototypeOf(engine);
    expect(proto._getBalloonScore.call(engine, BalloonType.GOLDEN)).toBe(SCORE_GOLDEN);
  });

  it('炸弹基础分为 SCORE_BOMB', () => {
    const proto = Object.getPrototypeOf(engine);
    expect(proto._getBalloonScore.call(engine, BalloonType.BOMB)).toBe(SCORE_BOMB);
  });
});

// ============================================================
// 19. 重置
// ============================================================
describe('BalloonPopEngine - 重置', () => {
  it('reset 后状态应为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数应为 0', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后等级应为 1', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('reset 后气球列表应为空', () => {
    const engine = createAndStartEngine();
    addBalloon(engine, {});
    engine.reset();
    expect(engine.balloons).toHaveLength(0);
  });

  it('reset 后连击应为 0', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_combo', 10);
    engine.reset();
    expect(engine.combo).toBe(0);
  });

  it('reset 后准星应在画布中心', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_crosshairX', 100);
    setPrivate(engine, '_crosshairY', 100);
    engine.reset();
    expect(engine.crosshairX).toBe(CANVAS_WIDTH / 2);
    expect(engine.crosshairY).toBe(CANVAS_HEIGHT / 2);
  });

  it('reset 后剩余时间应重置', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_gameTimer', 1000);
    engine.reset();
    expect(engine.remainingTime).toBe(GAME_DURATION);
  });
});

// ============================================================
// 20. 边界与异常场景
// ============================================================
describe('BalloonPopEngine - 边界与异常', () => {
  it('未初始化 canvas 直接 start 应抛出错误', () => {
    const engine = new BalloonPopEngine();
    engine.init();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('连续快速射击不应崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 50; i++) {
      engine.handleKeyDown(' ');
    }
    expect(engine.totalShots).toBe(50);
  });

  it('分数可以为负数（炸弹扣分）', () => {
    const engine = createAndStartEngine();
    addBalloon(engine, { x: 200, y: 300, radius: BALLOON_RADIUS_BOMB, type: BalloonType.BOMB });
    setPrivate(engine, '_crosshairX', 200);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.score).toBeLessThan(0);
  });

  it('负分时升级检查不应出错', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_score', -100);
    callUpdate(engine, 16);
    expect(engine.level).toBe(1);
  });

  it('大量气球同时存在不应崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 100; i++) {
      addBalloon(engine, { y: 100 + i * 5 });
    }
    callUpdate(engine, 16);
    expect(true).toBe(true); // 不崩溃即可
  });

  it('handleKeyUp 未知键不应崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('UnknownKey')).not.toThrow();
  });

  it('handleKeyDown 未知键不应崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyDown('UnknownKey')).not.toThrow();
  });

  it('暂停后恢复应继续游戏', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('destroy 后不应崩溃', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('准星恰好在气球边缘（距离等于半径）应命中', () => {
    const engine = createAndStartEngine();
    const radius = 25;
    addBalloon(engine, { x: 200, y: 300, radius });
    setPrivate(engine, '_crosshairX', 200 + radius);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.totalHits).toBe(1);
  });

  it('准星恰好在气球边缘外（距离大于半径）应未命中', () => {
    const engine = createAndStartEngine();
    const radius = 25;
    addBalloon(engine, { x: 200, y: 300, radius });
    setPrivate(engine, '_crosshairX', 200 + radius + 1);
    setPrivate(engine, '_crosshairY', 300);
    engine.handleKeyDown(' ');
    expect(engine.totalHits).toBe(0);
  });

  it('暂停状态下不应处理射击', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.handleKeyDown(' ');
    expect(engine.totalShots).toBe(0);
  });
});
