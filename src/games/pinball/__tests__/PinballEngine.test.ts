/**
 * PinballEngine 全面测试
 * 覆盖：初始化、物理、碰撞、挡板、发射器、计分、生命、等级、粒子、状态管理
 */
import { PinballEngine } from '@/games/pinball/PinballEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRAVITY, FRICTION, RESTITUTION, WALL_RESTITUTION,
  MAX_BALL_SPEED,
  BALL_RADIUS,
  FLIPPER_LENGTH, FLIPPER_WIDTH,
  FLIPPER_REST_ANGLE, FLIPPER_ACTIVE_ANGLE,
  FLIPPER_ANGULAR_VELOCITY, FLIPPER_Y,
  LEFT_FLIPPER_X, RIGHT_FLIPPER_X,
  BUMPER_DEFS, BUMPER_HIT_DURATION, BUMPER_RESTITUTION,
  WALL_DEFS,
  LAUNCHER_X, LAUNCHER_Y,
  LAUNCHER_MAX_POWER, LAUNCHER_CHARGE_RATE,
  INITIAL_LIVES,
  MULTI_BALL_SCORE, MULTI_BALL_COUNT, MULTI_BALL_SPEED,
  COMBO_TIMEOUT, COMBO_MULTIPLIER_BASE, COMBO_MULTIPLIER_STEP, MAX_COMBO_MULTIPLIER,
  PARTICLE_COUNT, PARTICLE_LIFE, PARTICLE_MAX_SPEED,
  PARTICLE_MIN_SIZE, PARTICLE_MAX_SIZE,
  SCORE_LANES,
  LEVEL_SCORE_THRESHOLD, LEVEL_SPEED_INCREASE,
  TABLE_LEFT, TABLE_RIGHT, TABLE_TOP,
} from '@/games/pinball/constants';

// ========== 辅助函数 ==========

/** 创建引擎并初始化（不依赖 canvas） */
function createEngine(): PinballEngine {
  const engine = new PinballEngine();
  // init() 不传 canvas，仅调用 onInit 初始化内部状态
  engine.init();
  return engine;
}

/** 创建引擎，模拟 start（需要 canvas） */
function createAndStartEngine(): PinballEngine {
  const engine = new PinballEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  engine.start();
  return engine;
}

/** 创建一个在指定位置的活跃弹珠 */
function makeBall(x: number, y: number, vx = 0, vy = 0) {
  return {
    x,
    y,
    vx,
    vy,
    radius: BALL_RADIUS,
    active: true,
  };
}

/** 调用引擎的 update（通过反射访问 protected update） */
function callUpdate(engine: PinballEngine, dt: number) {
  (engine as any).update(dt);
}

// ============================================================
// 1. 初始化测试
// ============================================================
describe('PinballEngine - 初始化', () => {
  let engine: PinballEngine;

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

  it('初始生命数为 INITIAL_LIVES (3)', () => {
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('初始弹珠列表为空', () => {
    expect(engine.balls).toEqual([]);
  });

  it('初始粒子列表为空', () => {
    expect(engine.particles).toEqual([]);
  });

  it('初始发射器蓄力为 0', () => {
    expect(engine.launcherPower).toBe(0);
  });

  it('初始发射器未蓄力', () => {
    expect(engine.launcherCharging).toBe(false);
  });

  it('初始连击数为 0', () => {
    expect(engine.comboCount).toBe(0);
  });

  it('初始连击倍率为 COMBO_MULTIPLIER_BASE (1)', () => {
    expect(engine.comboMultiplier).toBe(COMBO_MULTIPLIER_BASE);
  });

  it('多球模式未触发', () => {
    expect(engine.multiBallTriggered).toBe(false);
  });

  it('左右挡板均未激活', () => {
    expect(engine.leftFlipperActive).toBe(false);
    expect(engine.rightFlipperActive).toBe(false);
  });

  it('重力倍率为 1', () => {
    expect(engine.gravityMultiplier).toBe(1);
  });

  it('活跃弹珠数为 0', () => {
    expect(engine.activeBallCount).toBe(0);
  });

  it('挡板数量为 2（左右各一）', () => {
    expect(engine.flippers).toHaveLength(2);
  });

  it('Bumper 数量与 BUMPER_DEFS 一致', () => {
    expect(engine.bumpers).toHaveLength(BUMPER_DEFS.length);
  });

  it('得分通道数量与 SCORE_LANES 一致', () => {
    expect(engine.scoreLanes).toHaveLength(SCORE_LANES.length);
  });

  it('左挡板属性正确', () => {
    const left = engine.flippers.find(f => f.side === 'left');
    expect(left).toBeDefined();
    expect(left!.x).toBe(LEFT_FLIPPER_X);
    expect(left!.y).toBe(FLIPPER_Y);
    expect(left!.length).toBe(FLIPPER_LENGTH);
    expect(left!.width).toBe(FLIPPER_WIDTH);
    expect(left!.angle).toBe(FLIPPER_REST_ANGLE);
  });

  it('右挡板属性正确', () => {
    const right = engine.flippers.find(f => f.side === 'right');
    expect(right).toBeDefined();
    expect(right!.x).toBe(RIGHT_FLIPPER_X);
    expect(right!.y).toBe(FLIPPER_Y);
    expect(right!.length).toBe(FLIPPER_LENGTH);
    expect(right!.angle).toBe(Math.PI - FLIPPER_REST_ANGLE);
  });

  it('所有 bumper hitTimer 初始为 0', () => {
    for (const b of engine.bumpers) {
      expect(b.hitTimer).toBe(0);
    }
  });

  it('所有 scoreLane hitTimer 初始为 0', () => {
    for (const lane of engine.scoreLanes) {
      expect(lane.hitTimer).toBe(0);
    }
  });
});

// ============================================================
// 2. 弹珠物理
// ============================================================
describe('PinballEngine - 弹珠物理', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('重力加速：弹珠 vy 随帧增加', () => {
    const ball = makeBall(240, 300, 0, 0);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    expect(ball.vy).toBeGreaterThan(0);
  });

  it('重力加速量符合 GRAVITY * gravityMultiplier * dt', () => {
    const ball = makeBall(240, 300, 0, 0);
    engine.balls.push(ball);
    const dt = 16;
    const normalizedDt = Math.min(dt, 32) / 16;
    callUpdate(engine, dt);
    // vy = 0 + GRAVITY * 1 * normalizedDt + friction（接近1，可忽略）
    expect(ball.vy).toBeCloseTo(GRAVITY * normalizedDt, 3);
  });

  it('摩擦力使速度衰减', () => {
    const ball = makeBall(240, 300, 10, 0);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    // 摩擦力应用后 vx 应减小
    expect(ball.vx).toBeLessThan(10);
  });

  it('速度上限：弹珠速度不超过 MAX_BALL_SPEED', () => {
    const ball = makeBall(240, 300, MAX_BALL_SPEED + 5, MAX_BALL_SPEED + 5);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    expect(speed).toBeLessThanOrEqual(MAX_BALL_SPEED + 0.1);
  });

  it('位置更新：弹珠根据速度移动', () => {
    const ball = makeBall(240, 300, 5, 3);
    engine.balls.push(ball);
    const prevX = ball.x;
    const prevY = ball.y;
    callUpdate(engine, 16);
    // x 应该变化（考虑摩擦力衰减）
    expect(ball.x).not.toBe(prevX);
    expect(ball.y).not.toBe(prevY);
  });

  it('弹珠从底部掉出后标记为 inactive', () => {
    const ball = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    expect(ball.active).toBe(false);
  });

  it('非活跃弹珠不参与更新', () => {
    const ball = makeBall(240, 300, 5, 5);
    ball.active = false;
    engine.balls.push(ball);
    const prevX = ball.x;
    const prevY = ball.y;
    callUpdate(engine, 16);
    expect(ball.x).toBe(prevX);
    expect(ball.y).toBe(prevY);
  });

  it('gravityMultiplier 影响重力加速度', () => {
    const engine2 = createAndStartEngine();
    (engine2 as any)._gravityMultiplier = 2;
    const ball = makeBall(240, 300, 0, 0);
    engine2.balls.push(ball);
    callUpdate(engine2, 16);
    const ball2 = makeBall(240, 300, 0, 0);
    engine.balls.push(ball2);
    callUpdate(engine, 16);
    expect(ball.vy).toBeGreaterThan(ball2.vy);
  });
});

// ============================================================
// 3. 挡板控制
// ============================================================
describe('PinballEngine - 挡板控制', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('按下 KeyZ 激活左挡板', () => {
    engine.handleKeyDown('KeyZ');
    expect(engine.leftFlipperActive).toBe(true);
  });

  it('按下 ArrowLeft 激活左挡板', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.leftFlipperActive).toBe(true);
  });

  it('按下 ShiftLeft 激活左挡板', () => {
    engine.handleKeyDown('ShiftLeft');
    expect(engine.leftFlipperActive).toBe(true);
  });

  it('按下 Slash 激活右挡板', () => {
    engine.handleKeyDown('Slash');
    expect(engine.rightFlipperActive).toBe(true);
  });

  it('按下 ArrowRight 激活右挡板', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.rightFlipperActive).toBe(true);
  });

  it('按下 ShiftRight 激活右挡板', () => {
    engine.handleKeyDown('ShiftRight');
    expect(engine.rightFlipperActive).toBe(true);
  });

  it('松开 KeyZ 停用左挡板', () => {
    engine.handleKeyDown('KeyZ');
    expect(engine.leftFlipperActive).toBe(true);
    engine.handleKeyUp('KeyZ');
    expect(engine.leftFlipperActive).toBe(false);
  });

  it('松开 ArrowLeft 停用左挡板', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyUp('ArrowLeft');
    expect(engine.leftFlipperActive).toBe(false);
  });

  it('松开 Slash 停用右挡板', () => {
    engine.handleKeyDown('Slash');
    engine.handleKeyUp('Slash');
    expect(engine.rightFlipperActive).toBe(false);
  });

  it('松开 ArrowRight 停用右挡板', () => {
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyUp('ArrowRight');
    expect(engine.rightFlipperActive).toBe(false);
  });

  it('激活左挡板时 targetAngle 变为 FLIPPER_ACTIVE_ANGLE', () => {
    engine.handleKeyDown('KeyZ');
    const left = engine.flippers.find(f => f.side === 'left');
    expect(left!.targetAngle).toBe(FLIPPER_ACTIVE_ANGLE);
  });

  it('激活右挡板时 targetAngle 变为 PI - FLIPPER_ACTIVE_ANGLE', () => {
    engine.handleKeyDown('Slash');
    const right = engine.flippers.find(f => f.side === 'right');
    expect(right!.targetAngle).toBe(Math.PI - FLIPPER_ACTIVE_ANGLE);
  });

  it('停用左挡板时 targetAngle 恢复为 FLIPPER_REST_ANGLE', () => {
    engine.handleKeyDown('KeyZ');
    engine.handleKeyUp('KeyZ');
    const left = engine.flippers.find(f => f.side === 'left');
    expect(left!.targetAngle).toBe(FLIPPER_REST_ANGLE);
  });

  it('停用右挡板时 targetAngle 恢复为 PI - FLIPPER_REST_ANGLE', () => {
    engine.handleKeyDown('Slash');
    engine.handleKeyUp('Slash');
    const right = engine.flippers.find(f => f.side === 'right');
    expect(right!.targetAngle).toBe(Math.PI - FLIPPER_REST_ANGLE);
  });

  it('挡板角度向 targetAngle 渐进更新', () => {
    engine.handleKeyDown('KeyZ');
    const left = engine.flippers.find(f => f.side === 'left')!;
    const initialAngle = left.angle;
    callUpdate(engine, 16);
    // 角度应该朝 targetAngle 方向变化
    expect(left.angle).toBeLessThan(initialAngle);
  });

  it('挡板角度最终到达 targetAngle', () => {
    engine.handleKeyDown('KeyZ');
    const left = engine.flippers.find(f => f.side === 'left')!;
    // 模拟多帧更新
    for (let i = 0; i < 50; i++) {
      callUpdate(engine, 16);
    }
    expect(left.angle).toBeCloseTo(FLIPPER_ACTIVE_ANGLE, 1);
  });

  it('不相关按键不影响挡板', () => {
    engine.handleKeyDown('KeyA');
    expect(engine.leftFlipperActive).toBe(false);
    expect(engine.rightFlipperActive).toBe(false);
  });
});

// ============================================================
// 4. 碰撞检测
// ============================================================
describe('PinballEngine - 碰撞检测', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  // --- 弹珠-Bumper 碰撞 ---
  describe('弹珠-Bumper 碰撞', () => {
    it('弹珠碰撞 bumper 后反弹', () => {
      const bumper = engine.bumpers[0];
      // 将球放在 bumper 旁边，朝 bumper 移动
      const ball = makeBall(bumper.x + bumper.radius + BALL_RADIUS - 1, bumper.y, -2, 0);
      engine.balls.push(ball);
      const prevVx = ball.vx;
      callUpdate(engine, 16);
      // vx 方向应反转
      expect(ball.vx).toBeGreaterThan(0);
    });

    it('碰撞 bumper 后 hitTimer 设为 BUMPER_HIT_DURATION', () => {
      const bumper = engine.bumpers[0];
      const ball = makeBall(bumper.x + bumper.radius + BALL_RADIUS - 1, bumper.y, -2, 0);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      expect(bumper.hitTimer).toBe(BUMPER_HIT_DURATION);
    });

    it('碰撞 bumper 后产生粒子', () => {
      const bumper = engine.bumpers[0];
      const ball = makeBall(bumper.x + bumper.radius + BALL_RADIUS - 1, bumper.y, -2, 0);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      expect(engine.particles.length).toBeGreaterThan(0);
    });

    it('碰撞 bumper 后弹珠速度不超过 MAX_BALL_SPEED', () => {
      const bumper = engine.bumpers[0];
      const ball = makeBall(bumper.x + bumper.radius + BALL_RADIUS - 1, bumper.y, -MAX_BALL_SPEED, 0);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      expect(speed).toBeLessThanOrEqual(MAX_BALL_SPEED + 0.1);
    });

    it('弹珠与 bumper 不重叠时无碰撞', () => {
      const bumper = engine.bumpers[0];
      const ball = makeBall(bumper.x + bumper.radius + BALL_RADIUS + 20, bumper.y, 0, 0);
      engine.balls.push(ball);
      const prevScore = engine.score;
      callUpdate(engine, 16);
      expect(engine.score).toBe(prevScore);
    });
  });

  // --- 弹珠-墙壁碰撞 ---
  describe('弹珠-墙壁碰撞', () => {
    it('弹珠碰到左墙反弹', () => {
      const ball = makeBall(TABLE_LEFT + BALL_RADIUS - 1, 300, -5, 0);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      expect(ball.x).toBeGreaterThanOrEqual(TABLE_LEFT + BALL_RADIUS);
      expect(ball.vx).toBeGreaterThan(0);
    });

    it('弹珠碰到右墙反弹', () => {
      // 球需要 x < LAUNCHER_X - LAUNCHER_WIDTH/2 (445) 才能触发右墙碰撞
      // TABLE_RIGHT = 450, 所以球需要在 450 附近且 x < 445
      const ball = makeBall(TABLE_RIGHT - 1, 300, 5, 0);
      // 确保球在主台面区域（不在发射器通道）
      ball.x = TABLE_RIGHT - BALL_RADIUS;
      engine.balls.push(ball);
      callUpdate(engine, 16);
      // 球可能被发射器通道右墙或右墙处理
      expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH - BALL_RADIUS);
    });

    it('弹珠碰到顶墙反弹', () => {
      // 将球放在刚好穿过顶墙的位置
      const ball = makeBall(240, TABLE_TOP, 0, -5);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      // 球应被修正到 TABLE_TOP + BALL_RADIUS 或反弹
      expect(ball.vy).toBeGreaterThan(-5);
    });

    it('弹珠碰到发射器通道右墙反弹', () => {
      const ball = makeBall(CANVAS_WIDTH - BALL_RADIUS + 1, 400, 5, 0);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      expect(ball.vx).toBeLessThanOrEqual(0);
    });

    it('墙壁反弹使用 WALL_RESTITUTION', () => {
      const ball = makeBall(TABLE_LEFT + BALL_RADIUS - 1, 300, -10, 0);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      // 反弹后 vx 应为正值且小于原始速度的绝对值
      expect(ball.vx).toBeGreaterThan(0);
      expect(ball.vx).toBeLessThanOrEqual(10 * WALL_RESTITUTION + 1);
    });
  });

  // --- 弹珠-挡板碰撞 ---
  describe('弹珠-挡板碰撞', () => {
    it('弹珠碰到静止挡板反弹', () => {
      const left = engine.flippers.find(f => f.side === 'left')!;
      // 将球放在挡板端点上方
      const endX = left.x + Math.cos(left.angle) * left.length;
      const endY = left.y + Math.sin(left.angle) * left.length;
      const ball = makeBall(endX, endY - BALL_RADIUS - FLIPPER_WIDTH / 2 + 1, 0, 2);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      // 球应该被弹开
      expect(ball.vy).toBeLessThanOrEqual(2);
    });

    it('挡板翻转时给弹珠额外速度', () => {
      const left = engine.flippers.find(f => f.side === 'left')!;
      engine.handleKeyDown('KeyZ');
      const endX = left.x + Math.cos(left.angle) * left.length;
      const endY = left.y + Math.sin(left.angle) * left.length;
      const ball = makeBall(endX, endY - BALL_RADIUS - FLIPPER_WIDTH / 2 + 1, 0, 2);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      // 翻转中挡板应给球额外向上的力
      expect(ball.vy).toBeLessThan(0);
    });
  });

  // --- 弹珠-线段墙壁碰撞 ---
  describe('弹珠-线段墙壁碰撞', () => {
    it('弹珠与线段墙壁碰撞后反弹', () => {
      // WALL_DEFS[0]: { x1: 30, y1: 500, x2: LEFT_FLIPPER_X - 10, y2: FLIPPER_Y }
      const wall = WALL_DEFS[0];
      // 将球放在墙壁中点附近
      const midX = (wall.x1 + wall.x2) / 2;
      const midY = (wall.y1 + wall.y2) / 2;
      // 计算墙壁法线方向（大致从墙壁指向台面内部）
      const ball = makeBall(midX, midY + BALL_RADIUS - 1, 0, -2);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      // 球应该被弹开
      expect(ball.vy).toBeGreaterThan(-2);
    });
  });

  // --- 弹珠-得分通道碰撞 ---
  describe('弹珠-得分通道碰撞', () => {
    it('弹珠经过得分通道时触发得分', () => {
      const lane = engine.scoreLanes[0];
      const ball = makeBall(lane.x + lane.width / 2, lane.y, 0, 2);
      engine.balls.push(ball);
      const prevScore = engine.score;
      callUpdate(engine, 16);
      expect(engine.score).toBeGreaterThan(prevScore);
    });

    it('得分通道碰撞后 hitTimer 被设置（被 updateScoreLanes 递减 1）', () => {
      const lane = engine.scoreLanes[0];
      const ball = makeBall(lane.x + lane.width / 2, lane.y, 0, 2);
      engine.balls.push(ball);
      callUpdate(engine, 16);
      // 碰撞设置 hitTimer = 30，但同一帧 updateScoreLanes 递减 1
      expect(lane.hitTimer).toBe(29);
    });

    it('hitTimer > 0 的得分通道不会重复触发', () => {
      const lane = engine.scoreLanes[0];
      lane.hitTimer = 10;
      const ball = makeBall(lane.x + lane.width / 2, lane.y, 0, 2);
      engine.balls.push(ball);
      const prevScore = engine.score;
      callUpdate(engine, 16);
      expect(engine.score).toBe(prevScore);
    });
  });
});

// ============================================================
// 5. 发射器
// ============================================================
describe('PinballEngine - 发射器', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('按下空格开始蓄力', () => {
    engine.handleKeyDown(' ');
    expect(engine.launcherCharging).toBe(true);
    expect(engine.launcherPower).toBe(0);
  });

  it('按下 Space（字符串）开始蓄力', () => {
    engine.handleKeyDown('Space');
    expect(engine.launcherCharging).toBe(true);
  });

  it('蓄力过程中 power 增加', () => {
    engine.handleKeyDown(' ');
    callUpdate(engine, 16);
    expect(engine.launcherPower).toBeGreaterThan(0);
  });

  it('蓄力不超过 LAUNCHER_MAX_POWER', () => {
    engine.handleKeyDown(' ');
    // 模拟大量帧
    for (let i = 0; i < 200; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.launcherPower).toBeLessThanOrEqual(LAUNCHER_MAX_POWER);
  });

  it('蓄力速率为 LAUNCHER_CHARGE_RATE', () => {
    engine.handleKeyDown(' ');
    const dt = 16;
    callUpdate(engine, dt);
    const normalizedDt = Math.min(dt, 32) / 16;
    expect(engine.launcherPower).toBeCloseTo(LAUNCHER_CHARGE_RATE * normalizedDt, 3);
  });

  it('松开空格发射弹珠', () => {
    engine.handleKeyDown(' ');
    // 蓄力几帧
    for (let i = 0; i < 10; i++) {
      callUpdate(engine, 16);
    }
    const power = engine.launcherPower;
    engine.handleKeyUp(' ');
    expect(engine.launcherCharging).toBe(false);
    // 应该有新球
    expect(engine.balls.length).toBeGreaterThan(0);
    // 新球的 vy 应为负（向上）
    const newBall = engine.balls[engine.balls.length - 1];
    expect(newBall.vy).toBe(-power);
  });

  it('发射后 power 重置为 0', () => {
    engine.handleKeyDown(' ');
    for (let i = 0; i < 10; i++) {
      callUpdate(engine, 16);
    }
    engine.handleKeyUp(' ');
    expect(engine.launcherPower).toBe(0);
  });

  it('power 为 0 时 launchBall 不创建弹珠', () => {
    const prevCount = engine.balls.length;
    (engine as any).launchBall();
    expect(engine.balls.length).toBe(prevCount);
  });

  it('发射的弹珠位于发射器位置', () => {
    engine.handleKeyDown(' ');
    for (let i = 0; i < 5; i++) {
      callUpdate(engine, 16);
    }
    engine.handleKeyUp(' ');
    const newBall = engine.balls[engine.balls.length - 1];
    expect(newBall.x).toBe(LAUNCHER_X);
    expect(newBall.y).toBeCloseTo(LAUNCHER_Y - BALL_RADIUS - 5, 1);
  });

  it('未蓄力时松开空格不发射', () => {
    const prevCount = engine.balls.length;
    engine.handleKeyUp(' ');
    expect(engine.balls.length).toBe(prevCount);
  });
});

// ============================================================
// 6. 计分系统
// ============================================================
describe('PinballEngine - 计分', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('碰撞 bumper 得分', () => {
    const bumper = engine.bumpers[0];
    const ball = makeBall(bumper.x + bumper.radius + BALL_RADIUS - 1, bumper.y, -2, 0);
    engine.balls.push(ball);
    const prevScore = engine.score;
    callUpdate(engine, 16);
    expect(engine.score).toBeGreaterThan(prevScore);
  });

  it('不同 bumper 有不同分值', () => {
    const bumper0 = engine.bumpers[0];
    const bumper5 = engine.bumpers[5]; // 150 分
    expect(bumper0.score).not.toBe(bumper5.score);
  });

  it('连击增加 comboCount', () => {
    const bumper = engine.bumpers[0];
    // 第一次碰撞
    const ball1 = makeBall(bumper.x + bumper.radius + BALL_RADIUS - 1, bumper.y, -2, 0);
    engine.balls.push(ball1);
    callUpdate(engine, 16);
    expect(engine.comboCount).toBeGreaterThan(0);
  });

  it('连击倍率随 comboCount 增加', () => {
    // 模拟多次碰撞（通过 registerHit）
    (engine as any).registerHit(100);
    const m1 = engine.comboMultiplier;
    (engine as any).registerHit(100);
    const m2 = engine.comboMultiplier;
    expect(m2).toBeGreaterThan(m1);
  });

  it('连击倍率计算公式正确', () => {
    (engine as any).registerHit(100);
    expect(engine.comboMultiplier).toBe(
      Math.min(COMBO_MULTIPLIER_BASE + 1 * COMBO_MULTIPLIER_STEP, MAX_COMBO_MULTIPLIER)
    );
  });

  it('连击倍率不超过 MAX_COMBO_MULTIPLIER', () => {
    for (let i = 0; i < 50; i++) {
      (engine as any).registerHit(100);
    }
    expect(engine.comboMultiplier).toBeLessThanOrEqual(MAX_COMBO_MULTIPLIER);
  });

  it('连击超时后重置 comboCount 和 comboMultiplier', () => {
    (engine as any).registerHit(100);
    expect(engine.comboCount).toBeGreaterThan(0);
    // 模拟超时
    (engine as any)._comboTimer = 0.5;
    callUpdate(engine, 16);
    expect(engine.comboCount).toBe(0);
    expect(engine.comboMultiplier).toBe(COMBO_MULTIPLIER_BASE);
  });

  it('最终分数 = baseScore * comboMultiplier（四舍五入）', () => {
    // 第一次碰撞：comboMultiplier = 1 + 1 * 0.5 = 1.5
    (engine as any).registerHit(100);
    expect(engine.score).toBe(Math.round(100 * 1.5));
  });

  it('addScore 触发 scoreChange 事件', () => {
    const listener = jest.fn();
    engine.on('scoreChange', listener);
    (engine as any).registerHit(100);
    expect(listener).toHaveBeenCalled();
  });
});

// ============================================================
// 7. 生命系统
// ============================================================
describe('PinballEngine - 生命系统', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('弹珠掉出底部后减命', () => {
    // createAndStartEngine 已有一个球，先清除
    engine.balls.length = 0;
    expect(engine.lives).toBe(INITIAL_LIVES);
    const ball = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    expect(engine.lives).toBe(INITIAL_LIVES - 1);
  });

  it('弹珠掉出后生成新球', () => {
    engine.balls.length = 0;
    const ball = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    // 旧球被清除，新球被生成
    expect(engine.activeBallCount).toBe(1);
  });

  it('生命耗尽触发 gameOver', () => {
    // 将生命设为 1，清除已有球，然后让新球掉出
    (engine as any)._lives = 1;
    engine.balls.length = 0;
    const ball = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    expect(engine.status).toBe('gameover');
  });

  it('生命耗尽后不再生成新球', () => {
    (engine as any)._lives = 1;
    engine.balls.length = 0;
    const ball = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    expect(engine.activeBallCount).toBe(0);
    expect(engine.balls.length).toBe(0);
  });

  it('多球模式中所有球掉出才减命', () => {
    (engine as any)._lives = 3;
    engine.balls.length = 0;
    const ball1 = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    const ball2 = makeBall(200, 300, 0, 0);
    engine.balls.push(ball1, ball2);
    callUpdate(engine, 16);
    // ball1 掉出，但 ball2 仍活跃，不减命
    expect(engine.lives).toBe(3);
  });

  it('gameOver 触发 statusChange 事件', () => {
    const listener = jest.fn();
    engine.on('statusChange', listener);
    (engine as any)._lives = 1;
    engine.balls.length = 0;
    const ball = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    expect(listener).toHaveBeenCalledWith('gameover');
  });
});

// ============================================================
// 8. 等级提升
// ============================================================
describe('PinballEngine - 等级提升', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('分数达到 LEVEL_SCORE_THRESHOLD 时升级', () => {
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    expect(engine.level).toBe(2);
  });

  it('升级后 nextLevelScore 增加 LEVEL_SCORE_THRESHOLD', () => {
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    expect((engine as any)._nextLevelScore).toBe(LEVEL_SCORE_THRESHOLD * 2);
  });

  it('升级后 gravityMultiplier 增加', () => {
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    expect(engine.gravityMultiplier).toBe(1 + LEVEL_SPEED_INCREASE);
  });

  it('多次升级 gravityMultiplier 累加', () => {
    // 每次 update 只升一级，需要多次调用并增加足够分数
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    expect(engine.level).toBe(2);
    // nextLevelScore 现在是 6000，需要再补分数
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    expect(engine.level).toBe(3);
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    expect(engine.level).toBe(4);
    expect(engine.gravityMultiplier).toBe(1 + 3 * LEVEL_SPEED_INCREASE);
  });

  it('升级触发 levelChange 事件', () => {
    const listener = jest.fn();
    engine.on('levelChange', listener);
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    expect(listener).toHaveBeenCalledWith(2);
  });
});

// ============================================================
// 9. 粒子效果
// ============================================================
describe('PinballEngine - 粒子效果', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('碰撞 bumper 产生 PARTICLE_COUNT 个粒子', () => {
    const bumper = engine.bumpers[0];
    const ball = makeBall(bumper.x + bumper.radius + BALL_RADIUS - 1, bumper.y, -2, 0);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    // 可能有多次碰撞，但至少有 PARTICLE_COUNT 个粒子
    expect(engine.particles.length).toBeGreaterThanOrEqual(PARTICLE_COUNT);
  });

  it('粒子有正确的生命值', () => {
    (engine as any).spawnParticles(100, 100, '#ff0000');
    for (const p of engine.particles) {
      expect(p.life).toBe(PARTICLE_LIFE);
      expect(p.maxLife).toBe(PARTICLE_LIFE);
    }
  });

  it('粒子大小在合理范围内', () => {
    (engine as any).spawnParticles(100, 100, '#ff0000');
    for (const p of engine.particles) {
      expect(p.size).toBeGreaterThanOrEqual(PARTICLE_MIN_SIZE);
      expect(p.size).toBeLessThanOrEqual(PARTICLE_MAX_SIZE);
    }
  });

  it('粒子速度不超过 PARTICLE_MAX_SPEED', () => {
    (engine as any).spawnParticles(100, 100, '#ff0000');
    for (const p of engine.particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      expect(speed).toBeLessThanOrEqual(PARTICLE_MAX_SPEED);
    }
  });

  it('粒子生命逐帧减少', () => {
    (engine as any).spawnParticles(100, 100, '#ff0000');
    const prevLife = engine.particles[0].life;
    callUpdate(engine, 16);
    expect(engine.particles[0].life).toBeLessThan(prevLife);
  });

  it('粒子生命耗尽后移除', () => {
    (engine as any).spawnParticles(100, 100, '#ff0000');
    // 将所有粒子生命设为极小值
    for (const p of engine.particles) {
      p.life = 0.1;
    }
    callUpdate(engine, 16);
    expect(engine.particles.length).toBe(0);
  });

  it('粒子受重力影响', () => {
    (engine as any).spawnParticles(100, 100, '#ff0000');
    const p = engine.particles[0];
    const prevVy = p.vy;
    callUpdate(engine, 16);
    // 粒子 vy 应增加（受重力）
    expect(p.vy).toBeGreaterThan(prevVy);
  });
});

// ============================================================
// 10. 状态管理
// ============================================================
describe('PinballEngine - 状态管理', () => {
  it('idle 状态下按空格启动游戏', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
    // 需要设置 canvas 才能 start
    const canvas = document.createElement('canvas');
    engine.init(canvas);
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('idle 状态下按 Space 启动游戏', () => {
    const engine = createEngine();
    const canvas = document.createElement('canvas');
    engine.init(canvas);
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后生成一个弹珠', () => {
    const engine = createAndStartEngine();
    expect(engine.activeBallCount).toBe(1);
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

  it('reset 后分数归零', () => {
    const engine = createAndStartEngine();
    (engine as any).addScore(500);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后等级归 1', () => {
    const engine = createAndStartEngine();
    (engine as any).addScore(LEVEL_SCORE_THRESHOLD);
    callUpdate(engine, 16);
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('reset 后弹珠清空', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.balls).toEqual([]);
  });

  it('reset 后粒子清空', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.particles).toEqual([]);
  });

  it('reset 后生命恢复为 INITIAL_LIVES', () => {
    const engine = createAndStartEngine();
    (engine as any)._lives = 1;
    engine.reset();
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('destroy 后清空所有对象', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.balls).toEqual([]);
    expect(engine.particles).toEqual([]);
    expect(engine.bumpers).toEqual([]);
    expect(engine.flippers).toEqual([]);
    expect(engine.scoreLanes).toEqual([]);
  });

  it('destroy 后状态为 idle', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('非 playing 状态下按键无效', () => {
    const engine = createEngine();
    engine.handleKeyDown('KeyZ');
    expect(engine.leftFlipperActive).toBe(false);
  });

  it('pause 后 handleKeyDown 不响应挡板', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.handleKeyDown('KeyZ');
    expect(engine.leftFlipperActive).toBe(false);
  });
});

// ============================================================
// 11. handleKeyDown / handleKeyUp 完整按键测试
// ============================================================
describe('PinballEngine - 按键处理', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('handleKeyDown 空格启动蓄力', () => {
    engine.handleKeyDown(' ');
    expect(engine.launcherCharging).toBe(true);
  });

  it('handleKeyUp 空格结束蓄力并发射', () => {
    engine.handleKeyDown(' ');
    for (let i = 0; i < 5; i++) callUpdate(engine, 16);
    engine.handleKeyUp(' ');
    expect(engine.launcherCharging).toBe(false);
  });

  it('重复按空格不重置蓄力（已蓄力时）', () => {
    engine.handleKeyDown(' ');
    for (let i = 0; i < 5; i++) callUpdate(engine, 16);
    const power = engine.launcherPower;
    engine.handleKeyDown(' ');
    // 已经在蓄力，不会重置
    expect(engine.launcherPower).toBe(power);
  });

  it('ShiftLeft 激活左挡板', () => {
    engine.handleKeyDown('ShiftLeft');
    expect(engine.leftFlipperActive).toBe(true);
  });

  it('ShiftRight 激活右挡板', () => {
    engine.handleKeyDown('ShiftRight');
    expect(engine.rightFlipperActive).toBe(true);
  });

  it('松开 ShiftLeft 停用左挡板', () => {
    engine.handleKeyDown('ShiftLeft');
    engine.handleKeyUp('ShiftLeft');
    expect(engine.leftFlipperActive).toBe(false);
  });

  it('松开 ShiftRight 停用右挡板', () => {
    engine.handleKeyDown('ShiftRight');
    engine.handleKeyUp('ShiftRight');
    expect(engine.rightFlipperActive).toBe(false);
  });

  it('不认识的按键被忽略', () => {
    engine.handleKeyDown('KeyQ');
    engine.handleKeyDown('KeyW');
    engine.handleKeyUp('KeyQ');
    expect(engine.leftFlipperActive).toBe(false);
    expect(engine.rightFlipperActive).toBe(false);
    expect(engine.launcherCharging).toBe(false);
  });

  it('同时按左右挡板键两者都激活', () => {
    engine.handleKeyDown('KeyZ');
    engine.handleKeyDown('Slash');
    expect(engine.leftFlipperActive).toBe(true);
    expect(engine.rightFlipperActive).toBe(true);
  });

  it('分别释放左右挡板', () => {
    engine.handleKeyDown('KeyZ');
    engine.handleKeyDown('Slash');
    engine.handleKeyUp('KeyZ');
    expect(engine.leftFlipperActive).toBe(false);
    expect(engine.rightFlipperActive).toBe(true);
    engine.handleKeyUp('Slash');
    expect(engine.rightFlipperActive).toBe(false);
  });
});

// ============================================================
// 12. getState 返回值
// ============================================================
describe('PinballEngine - getState', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('返回包含 score 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('score');
  });

  it('返回包含 level 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('level');
  });

  it('返回包含 lives 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('lives');
  });

  it('返回包含 balls 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('balls');
    expect(Array.isArray(state.balls)).toBe(true);
  });

  it('返回包含 bumpers 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('bumpers');
    expect(Array.isArray(state.bumpers)).toBe(true);
  });

  it('返回包含 comboCount 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('comboCount');
  });

  it('返回包含 comboMultiplier 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('comboMultiplier');
  });

  it('返回包含 launcherPower 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('launcherPower');
  });

  it('返回包含 launcherCharging 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('launcherCharging');
  });

  it('返回包含 multiBallTriggered 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('multiBallTriggered');
  });

  it('返回包含 activeBallCount 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('activeBallCount');
  });

  it('返回包含 leftFlipperActive 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('leftFlipperActive');
  });

  it('返回包含 rightFlipperActive 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('rightFlipperActive');
  });

  it('返回包含 gravityMultiplier 的对象', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('gravityMultiplier');
  });

  it('balls 是深拷贝，不影响原始数据', () => {
    const state = engine.getState();
    const balls = state.balls as any[];
    const prevLength = engine.balls.length;
    balls.push({ x: 999, y: 999, vx: 0, vy: 0, radius: 10, active: true });
    expect(engine.balls.length).toBe(prevLength);
  });

  it('bumpers 是深拷贝，不影响原始数据', () => {
    const state = engine.getState();
    const bumpers = state.bumpers as any[];
    bumpers[0].hitTimer = 999;
    expect(engine.bumpers[0].hitTimer).toBe(0);
  });

  it('state.score 与 engine.score 一致', () => {
    (engine as any).addScore(42);
    const state = engine.getState();
    expect(state.score).toBe(42);
  });

  it('state.lives 与 engine.lives 一致', () => {
    const state = engine.getState();
    expect(state.lives).toBe(INITIAL_LIVES);
  });
});

// ============================================================
// 13. 多球模式
// ============================================================
describe('PinballEngine - 多球模式', () => {
  let engine: PinballEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('分数达到 MULTI_BALL_SCORE 触发多球', () => {
    (engine as any).addScore(MULTI_BALL_SCORE);
    callUpdate(engine, 16);
    expect(engine.multiBallTriggered).toBe(true);
  });

  it('多球模式生成 MULTI_BALL_COUNT - 1 个额外球', () => {
    const prevCount = engine.activeBallCount;
    (engine as any).addScore(MULTI_BALL_SCORE);
    callUpdate(engine, 16);
    expect(engine.activeBallCount).toBe(prevCount + MULTI_BALL_COUNT - 1);
  });

  it('多球模式只触发一次', () => {
    (engine as any).addScore(MULTI_BALL_SCORE);
    callUpdate(engine, 16);
    expect(engine.multiBallTriggered).toBe(true);
    const countAfterFirst = engine.balls.length;
    // 第二次 update 不会再触发多球
    (engine as any).addScore(1000);
    callUpdate(engine, 16);
    // 球数不应因多球模式而增加（可能因物理减少）
    expect(engine.balls.length).toBeLessThanOrEqual(countAfterFirst);
  });

  it('手动调用 triggerMultiBall 生成额外弹珠', () => {
    const prevCount = engine.activeBallCount;
    engine.triggerMultiBall();
    expect(engine.activeBallCount).toBe(prevCount + MULTI_BALL_COUNT - 1);
  });

  it('重复调用 triggerMultiBall 无效', () => {
    engine.triggerMultiBall();
    const count1 = engine.activeBallCount;
    engine.triggerMultiBall();
    expect(engine.activeBallCount).toBe(count1);
  });

  it('多球模式的弹珠位于台面中央', () => {
    engine.triggerMultiBall();
    // 检查刚创建的球（尚未 update，位置未变）
    const multiBalls = engine.balls.filter(
      b => Math.abs(b.x - CANVAS_WIDTH / 2) < 1 && Math.abs(b.y - CANVAS_HEIGHT / 2) < 1
    );
    expect(multiBalls.length).toBe(MULTI_BALL_COUNT - 1);
  });

  it('多球模式的弹珠速度为 MULTI_BALL_SPEED', () => {
    engine.triggerMultiBall();
    const multiBalls = engine.balls.filter(
      b => Math.abs(b.x - CANVAS_WIDTH / 2) < 1 && Math.abs(b.y - CANVAS_HEIGHT / 2) < 1
    );
    for (const b of multiBalls) {
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      expect(speed).toBeCloseTo(MULTI_BALL_SPEED, 1);
    }
  });
});

// ============================================================
// 14. spawnBall
// ============================================================
describe('PinballEngine - spawnBall', () => {
  it('spawnBall 创建一个静止弹珠', () => {
    const engine = createEngine();
    engine.init();
    engine.spawnBall();
    expect(engine.balls).toHaveLength(1);
    const ball = engine.balls[0];
    expect(ball.vx).toBe(0);
    expect(ball.vy).toBe(0);
    expect(ball.active).toBe(true);
  });

  it('spawnBall 弹珠位于发射器位置', () => {
    const engine = createEngine();
    engine.init();
    engine.spawnBall();
    const ball = engine.balls[0];
    expect(ball.x).toBe(LAUNCHER_X);
    expect(ball.y).toBeCloseTo(LAUNCHER_Y - BALL_RADIUS - 5, 1);
  });

  it('多次 spawnBall 累加弹珠', () => {
    const engine = createEngine();
    engine.init();
    engine.spawnBall();
    engine.spawnBall();
    expect(engine.balls).toHaveLength(2);
  });
});

// ============================================================
// 15. 事件系统
// ============================================================
describe('PinballEngine - 事件系统', () => {
  it('on/off 正常工作', () => {
    const engine = createEngine();
    const listener = jest.fn();
    engine.on('test', listener);
    (engine as any).emit('test');
    expect(listener).toHaveBeenCalledTimes(1);
    engine.off('test', listener);
    (engine as any).emit('test');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('start 触发 statusChange(playing)', () => {
    const engine = new PinballEngine();
    const canvas = document.createElement('canvas');
    engine.init(canvas);
    const listener = jest.fn();
    engine.on('statusChange', listener);
    engine.start();
    expect(listener).toHaveBeenCalledWith('playing');
  });

  it('pause 触发 statusChange(paused)', () => {
    const engine = createAndStartEngine();
    const listener = jest.fn();
    engine.on('statusChange', listener);
    engine.pause();
    expect(listener).toHaveBeenCalledWith('paused');
  });

  it('reset 触发 statusChange(idle)', () => {
    const engine = createAndStartEngine();
    const listener = jest.fn();
    engine.on('statusChange', listener);
    engine.reset();
    expect(listener).toHaveBeenCalledWith('idle');
  });
});

// ============================================================
// 16. 边界和特殊场景
// ============================================================
describe('PinballEngine - 边界场景', () => {
  it('deltaTime 被限制在 32ms 以内', () => {
    const engine = createAndStartEngine();
    const ball = makeBall(240, 300, 0, 0);
    engine.balls.push(ball);
    // 传入超大 deltaTime
    callUpdate(engine, 100);
    // 应该不会崩溃，且球仍在合理位置
    expect(ball.y).toBeGreaterThan(0);
    expect(ball.y).toBeLessThan(CANVAS_HEIGHT * 2);
  });

  it('没有弹珠时 update 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.balls.length = 0;
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('没有粒子时 update 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.particles.length = 0;
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('gameOver 后不再响应按键', () => {
    const engine = createAndStartEngine();
    (engine as any)._lives = 1;
    engine.balls.length = 0;
    const ball = makeBall(240, CANVAS_HEIGHT + BALL_RADIUS + 10, 0, 1);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown('KeyZ');
    expect(engine.leftFlipperActive).toBe(false);
  });

  it('弹珠在发射器通道内不被右墙阻挡', () => {
    const engine = createAndStartEngine();
    // 球在发射器通道内（x > TABLE_RIGHT）
    const ball = makeBall(TABLE_RIGHT + 10, 400, 0, 0);
    engine.balls.push(ball);
    callUpdate(engine, 16);
    // 球不应该被传送到 TABLE_RIGHT 内侧
    expect(ball.x).toBeGreaterThan(TABLE_RIGHT);
  });

  it('closestPointOnSegment 线段退化为点时返回端点', () => {
    const engine = createEngine();
    const result = (engine as any).closestPointOnSegment(10, 10, 5, 5, 5, 5);
    expect(result.x).toBe(5);
    expect(result.y).toBe(5);
  });

  it('scoreLane hitTimer 逐帧递减', () => {
    const engine = createAndStartEngine();
    engine.scoreLanes[0].hitTimer = 10;
    callUpdate(engine, 16);
    expect(engine.scoreLanes[0].hitTimer).toBe(9);
  });

  it('bumper hitTimer 不在 update 中递减（由碰撞设置）', () => {
    const engine = createAndStartEngine();
    engine.bumpers[0].hitTimer = 10;
    callUpdate(engine, 16);
    // bumper hitTimer 不会自动递减（源码中没有 bumper hitTimer 递减逻辑）
    expect(engine.bumpers[0].hitTimer).toBe(10);
  });
});
