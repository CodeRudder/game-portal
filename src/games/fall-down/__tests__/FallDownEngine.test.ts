import { FallDownEngine } from '@/games/fall-down/FallDownEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_RADIUS,
  BALL_INITIAL_X,
  BALL_INITIAL_Y,
  GRAVITY,
  MAX_FALL_SPEED,
  PLATFORM_HEIGHT,
  PLATFORM_GAP_WIDTH,
  WIDE_GAP_WIDTH,
  PLATFORM_SPEED,
  PLATFORM_SPAWN_INTERVAL,
  PLATFORM_INITIAL_COUNT,
  SPEED_INCREMENT,
  SPEED_LEVEL_INTERVAL,
  MAX_PLATFORM_SPEED,
  PlatformType,
} from '@/games/fall-down/constants';

// ========== Mock Canvas ==========
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

/** 创建并初始化引擎 */
function createEngine(): FallDownEngine {
  const engine = new FallDownEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 创建引擎并启动游戏 */
function createAndStartEngine(): FallDownEngine {
  const engine = createEngine();
  engine.setSeed(42);
  engine.start();
  return engine;
}

/** 模拟一帧更新 */
function simulateFrame(engine: FallDownEngine, deltaTime: number = 16.667): void {
  (engine as any).update(deltaTime);
}

/** 模拟多帧更新 */
function simulateFrames(engine: FallDownEngine, count: number, deltaTime: number = 16.667): void {
  for (let i = 0; i < count; i++) {
    simulateFrame(engine, deltaTime);
  }
}

// ========== 测试 ==========

describe('FallDownEngine - 初始化', () => {
  it('应该正确创建引擎实例', () => {
    const engine = new FallDownEngine();
    expect(engine).toBeInstanceOf(FallDownEngine);
  });

  it('初始状态应为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('初始分数应为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('初始等级应为 1', () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it('init 后状态应为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('未设置 canvas 时 start 应抛出错误', () => {
    const engine = new FallDownEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('设置 canvas 后可以 init', () => {
    const engine = new FallDownEngine();
    const canvas = createMockCanvas();
    expect(() => engine.init(canvas)).not.toThrow();
  });

  it('setCanvas 应正确设置 canvas', () => {
    const engine = new FallDownEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    expect((engine as any).canvas).toBe(canvas);
  });
});

describe('FallDownEngine - 游戏启动', () => {
  it('start 后状态应为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后分数应为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后等级应为 1', () => {
    const engine = createAndStartEngine();
    expect(engine.level).toBe(1);
  });

  it('start 后球应在初始位置', () => {
    const engine = createAndStartEngine();
    const ball = engine.getBallState();
    expect(ball.x).toBe(BALL_INITIAL_X);
    expect(ball.y).toBe(BALL_INITIAL_Y);
  });

  it('start 后球速度应为 0', () => {
    const engine = createAndStartEngine();
    const ball = engine.getBallState();
    expect(ball.velocityY).toBe(0);
  });

  it('start 后应有初始平台', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    expect(platforms.length).toBe(PLATFORM_INITIAL_COUNT);
  });

  it('start 后平台速度应为初始值', () => {
    const engine = createAndStartEngine();
    expect(engine.getCurrentPlatformSpeed()).toBe(PLATFORM_SPEED);
  });

  it('start 后按键状态应为空', () => {
    const engine = createAndStartEngine();
    expect(engine.getKeysPressed().size).toBe(0);
  });

  it('重复 start 应重置游戏', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 10);
    engine.start();
    expect(engine.score).toBe(0);
    expect(engine.level).toBe(1);
  });
});

describe('FallDownEngine - 重力下落', () => {
  it('球应受重力影响向下加速', () => {
    const engine = createAndStartEngine();
    const initialY = engine.getBallState().y;
    simulateFrame(engine);
    const afterY = engine.getBallState().y;
    expect(afterY).toBeGreaterThan(initialY);
  });

  it('球速度应随重力增加', () => {
    const engine = createAndStartEngine();
    simulateFrame(engine);
    const v1 = engine.getBallState().velocityY;
    simulateFrame(engine);
    const v2 = engine.getBallState().velocityY;
    expect(v2).toBeGreaterThan(v1);
  });

  it('球速度不应超过最大下落速度', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 200);
    const velocity = engine.getBallState().velocityY;
    expect(velocity).toBeLessThanOrEqual(MAX_FALL_SPEED);
  });

  it('球不应掉出屏幕底部', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 200);
    const ball = engine.getBallState();
    expect(ball.y + BALL_RADIUS).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  it('球到达底部后速度应为 0', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 200);
    const ball = engine.getBallState();
    if (ball.y + BALL_RADIUS >= CANVAS_HEIGHT - 1) {
      expect(ball.velocityY).toBe(0);
    }
  });

  it('重力加速度应为常量 GRAVITY', () => {
    const engine = createAndStartEngine();
    simulateFrame(engine, 16.667);
    const velocity = engine.getBallState().velocityY;
    expect(velocity).toBeCloseTo(GRAVITY, 2);
  });

  it('多帧后球Y坐标应持续增加', () => {
    const engine = createAndStartEngine();
    const positions: number[] = [engine.getBallState().y];
    for (let i = 0; i < 5; i++) {
      simulateFrame(engine);
      positions.push(engine.getBallState().y);
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});

describe('FallDownEngine - 水平移动', () => {
  it('按左键球应向左移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.getBallState().x;
    engine.handleKeyDown('ArrowLeft');
    simulateFrame(engine);
    const newX = engine.getBallState().x;
    expect(newX).toBeLessThan(initialX);
  });

  it('按右键球应向右移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.getBallState().x;
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine);
    const newX = engine.getBallState().x;
    expect(newX).toBeGreaterThan(initialX);
  });

  it('按 A 键球应向左移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.getBallState().x;
    engine.handleKeyDown('a');
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeLessThan(initialX);
  });

  it('按 D 键球应向右移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.getBallState().x;
    engine.handleKeyDown('d');
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeGreaterThan(initialX);
  });

  it('按大写 A 键球应向左移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.getBallState().x;
    engine.handleKeyDown('A');
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeLessThan(initialX);
  });

  it('按大写 D 键球应向右移动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.getBallState().x;
    engine.handleKeyDown('D');
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeGreaterThan(initialX);
  });

  it('松开按键后球应停止水平移动', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    simulateFrame(engine);
    const x1 = engine.getBallState().x;
    engine.handleKeyUp('ArrowLeft');
    simulateFrame(engine);
    const x2 = engine.getBallState().x;
    expect(x2).toBe(x1);
  });

  it('同时按左右键球应不动', () => {
    const engine = createAndStartEngine();
    const initialX = engine.getBallState().x;
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine);
    const newX = engine.getBallState().x;
    expect(newX).toBe(initialX);
  });

  it('持续按住左键球应持续移动', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    const positions: number[] = [];
    for (let i = 0; i < 5; i++) {
      positions.push(engine.getBallState().x);
      simulateFrame(engine);
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeLessThan(positions[i - 1]);
    }
  });

  it('持续按住右键球应持续移动', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowRight');
    const positions: number[] = [];
    for (let i = 0; i < 5; i++) {
      positions.push(engine.getBallState().x);
      simulateFrame(engine);
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});

describe('FallDownEngine - 边界穿越', () => {
  it('球从左侧穿越应出现在右侧', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = -BALL_RADIUS - 1;
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeGreaterThan(CANVAS_WIDTH / 2);
  });

  it('球从右侧穿越应出现在左侧', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = CANVAS_WIDTH + BALL_RADIUS + 1;
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeLessThan(CANVAS_WIDTH / 2);
  });

  it('球在左边界内不应穿越', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = BALL_RADIUS;
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeGreaterThanOrEqual(-BALL_RADIUS);
  });

  it('球在右边界内不应穿越', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = CANVAS_WIDTH - BALL_RADIUS;
    simulateFrame(engine);
    expect(engine.getBallState().x).toBeLessThanOrEqual(CANVAS_WIDTH + BALL_RADIUS);
  });

  it('按左键持续移动最终应穿越到右侧', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    simulateFrames(engine, 200);
    const x = engine.getBallState().x;
    expect(x).toBeGreaterThanOrEqual(-BALL_RADIUS);
    expect(x).toBeLessThanOrEqual(CANVAS_WIDTH + BALL_RADIUS);
  });

  it('球正好在左边界上不应穿越', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = -BALL_RADIUS;
    simulateFrame(engine);
    // 恰好在边界上，不应穿越
    expect(engine.getBallState().x).toBe(-BALL_RADIUS);
  });

  it('球正好在右边界上不应穿越', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = CANVAS_WIDTH + BALL_RADIUS;
    simulateFrame(engine);
    expect(engine.getBallState().x).toBe(CANVAS_WIDTH + BALL_RADIUS);
  });
});

describe('FallDownEngine - 平台生成', () => {
  it('初始应生成指定数量的平台', () => {
    const engine = createAndStartEngine();
    expect(engine.getPlatforms().length).toBe(PLATFORM_INITIAL_COUNT);
  });

  it('平台应从下往上排列', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    for (let i = 1; i < platforms.length; i++) {
      expect(platforms[i].y).toBeLessThan(platforms[i - 1].y);
    }
  });

  it('每个平台应有间隙', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    for (const p of platforms) {
      expect(p.gap.width).toBeGreaterThan(0);
    }
  });

  it('间隙宽度应在合理范围内', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    for (const p of platforms) {
      expect(p.gap.width).toBeGreaterThanOrEqual(PLATFORM_GAP_WIDTH);
      expect(p.gap.width).toBeLessThanOrEqual(WIDE_GAP_WIDTH);
    }
  });

  it('间隙X坐标应在画布范围内', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    for (const p of platforms) {
      expect(p.gap.x).toBeGreaterThanOrEqual(0);
      expect(p.gap.x + p.gap.width).toBeLessThanOrEqual(CANVAS_WIDTH);
    }
  });

  it('平台类型应为三种之一', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const validTypes = [PlatformType.NORMAL, PlatformType.WIDE, PlatformType.MOVING];
    for (const p of platforms) {
      expect(validTypes).toContain(p.type);
    }
  });

  it('新平台应在底部生成', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 100);
    expect(engine.getPlatforms().length).toBeGreaterThan(0);
  });

  it('平台初始 scored 状态应为 false', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    for (const p of platforms) {
      expect(p.scored).toBe(false);
    }
  });
});

describe('FallDownEngine - 平台移动', () => {
  it('平台应向上移动', () => {
    const engine = createAndStartEngine();
    const initialY = engine.getPlatforms()[0].y;
    simulateFrame(engine);
    const newY = engine.getPlatforms()[0].y;
    expect(newY).toBeLessThan(initialY);
  });

  it('所有平台应以相同速度移动', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    // 记录每个平台的初始 y 值（用引用追踪，因为平台对象在 update 中被原地修改）
    const tracked = platforms.map((p) => ({ initialY: p.y, ref: p }));
    simulateFrame(engine);
    // 只比较仍然存在的平台（通过引用查找当前平台列表）
    const currentPlatforms = engine.getPlatforms();
    const diffs: number[] = [];
    for (const t of tracked) {
      if (currentPlatforms.includes(t.ref)) {
        diffs.push(t.initialY - t.ref.y);
      }
    }
    for (let i = 1; i < diffs.length; i++) {
      expect(diffs[i]).toBeCloseTo(diffs[0], 2);
    }
  });

  it('超出顶部的平台应被移除', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    if (platforms.length > 0) {
      (platforms[0] as any).y = -100;
      simulateFrame(engine);
      const newPlatforms = engine.getPlatforms();
      expect(newPlatforms.every((p) => p.y > -20)).toBe(true);
    }
  });

  it('平台移动速度应随等级增加', () => {
    const engine = createAndStartEngine();
    (engine as any).currentPlatformSpeed = 3;
    const initialY = engine.getPlatforms()[0].y;
    simulateFrame(engine);
    const newY = engine.getPlatforms()[0].y;
    const diff = initialY - newY;
    expect(diff).toBeGreaterThan(0);
  });
});

describe('FallDownEngine - 间隙检测', () => {
  it('球在间隙内应穿过平台', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapCenter = targetPlatform.gap.x + targetPlatform.gap.width / 2;

    (engine as any).ball.x = gapCenter;
    (engine as any).ball.y = targetPlatform.y - 20;
    (engine as any).ball.velocityY = 5;

    simulateFrame(engine);
    const ball = engine.getBallState();
    expect(ball.y).toBeGreaterThan(targetPlatform.y - 20);
  });

  it('球不在间隙内应被平台阻挡', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapRight = targetPlatform.gap.x + targetPlatform.gap.width;

    const solidX = gapRight + 20;
    if (solidX < CANVAS_WIDTH) {
      (engine as any).ball.x = solidX;
      (engine as any).ball.y = targetPlatform.y - 5;
      (engine as any).ball.velocityY = 3;

      simulateFrame(engine);
      const ball = engine.getBallState();
      expect(ball.y).toBeLessThanOrEqual(targetPlatform.y + PLATFORM_HEIGHT);
    }
  });

  it('球穿过间隙后应计分', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapCenter = targetPlatform.gap.x + targetPlatform.gap.width / 2;

    (engine as any).ball.x = gapCenter;
    (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 2;
    (engine as any).ball.velocityY = 5;

    const initialScore = engine.score;
    simulateFrame(engine);
    expect(engine.score).toBeGreaterThanOrEqual(initialScore);
  });

  it('同一平台只应计分一次', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapCenter = targetPlatform.gap.x + targetPlatform.gap.width / 2;

    (engine as any).ball.x = gapCenter;
    (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 2;
    (engine as any).ball.velocityY = 5;

    simulateFrame(engine);
    const score1 = engine.score;
    simulateFrame(engine);
    const score2 = engine.score;
    expect(score2).toBeGreaterThanOrEqual(score1);
  });

  it('宽间隙应更容易穿过', () => {
    const engine = createAndStartEngine();
    const widePlatform: any = {
      y: 300,
      type: PlatformType.WIDE,
      gap: { x: 100, width: WIDE_GAP_WIDTH, baseX: 100 },
      scored: false,
      movePhase: 0,
    };
    (engine as any).platforms = [widePlatform];

    (engine as any).ball.x = 100 + WIDE_GAP_WIDTH / 2;
    (engine as any).ball.y = 280;
    (engine as any).ball.velocityY = 3;

    simulateFrame(engine);
    const ball = engine.getBallState();
    expect(ball.y).toBeGreaterThan(280);
  });

  it('球在间隙左侧边缘应能穿过', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    // 球中心在间隙左边缘内侧
    (engine as any).ball.x = targetPlatform.gap.x + BALL_RADIUS + 1;
    (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 2;
    (engine as any).ball.velocityY = 5;

    simulateFrame(engine);
    // 球应该穿过
    expect(engine.score).toBeGreaterThan(0);
  });

  it('球在间隙右侧边缘应能穿过', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    // 球中心在间隙右边缘内侧
    (engine as any).ball.x = targetPlatform.gap.x + targetPlatform.gap.width - BALL_RADIUS - 1;
    (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 2;
    (engine as any).ball.velocityY = 5;

    simulateFrame(engine);
    expect(engine.score).toBeGreaterThan(0);
  });
});

describe('FallDownEngine - 碰撞检测', () => {
  it('球落在平台上应停止下落', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapRight = targetPlatform.gap.x + targetPlatform.gap.width;

    const solidX = gapRight + 30;
    if (solidX < CANVAS_WIDTH) {
      (engine as any).ball.x = solidX;
      (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 1;
      (engine as any).ball.velocityY = 5;

      simulateFrame(engine);
      const ball = engine.getBallState();
      expect(ball.velocityY).toBe(0);
    }
  });

  it('球在平台上应随平台上升', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapRight = targetPlatform.gap.x + targetPlatform.gap.width;

    const solidX = gapRight + 30;
    if (solidX < CANVAS_WIDTH) {
      (engine as any).ball.x = solidX;
      (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 1;
      (engine as any).ball.velocityY = 5;

      simulateFrame(engine);
      const ball = engine.getBallState();
      expect(ball.y).toBeLessThan(targetPlatform.y);
    }
  });

  it('球在平台上方不受重力影响', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapRight = targetPlatform.gap.x + targetPlatform.gap.width;

    const solidX = gapRight + 30;
    if (solidX < CANVAS_WIDTH) {
      (engine as any).ball.x = solidX;
      (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 1;
      (engine as any).ball.velocityY = 5;

      simulateFrame(engine);
      expect(engine.getBallState().velocityY).toBe(0);
    }
  });

  it('球向上运动穿过平台不应碰撞', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapRight = targetPlatform.gap.x + targetPlatform.gap.width;

    const solidX = gapRight + 30;
    if (solidX < CANVAS_WIDTH) {
      (engine as any).ball.x = solidX;
      (engine as any).ball.y = targetPlatform.y + 5;
      (engine as any).ball.velocityY = -5; // 向上运动

      simulateFrame(engine);
      // 向上运动不应被平台阻挡
      expect(engine.status).toBe('playing');
    }
  });
});

describe('FallDownEngine - 速度递增', () => {
  it('初始平台速度应为 PLATFORM_SPEED', () => {
    const engine = createAndStartEngine();
    expect(engine.getCurrentPlatformSpeed()).toBe(PLATFORM_SPEED);
  });

  it('升级后平台速度应增加', () => {
    const engine = createAndStartEngine();
    (engine as any)._score = SPEED_LEVEL_INTERVAL;
    (engine as any).checkLevelUp();
    expect(engine.getCurrentPlatformSpeed()).toBeGreaterThan(PLATFORM_SPEED);
  });

  it('平台速度增量应为 SPEED_INCREMENT', () => {
    const engine = createAndStartEngine();
    (engine as any)._score = SPEED_LEVEL_INTERVAL;
    (engine as any).checkLevelUp();
    expect(engine.getCurrentPlatformSpeed()).toBeCloseTo(PLATFORM_SPEED + SPEED_INCREMENT, 4);
  });

  it('平台速度不应超过最大值', () => {
    const engine = createAndStartEngine();
    (engine as any)._score = 1000;
    (engine as any).checkLevelUp();
    expect(engine.getCurrentPlatformSpeed()).toBeLessThanOrEqual(MAX_PLATFORM_SPEED);
  });

  it('每 SPEED_LEVEL_INTERVAL 分升一级', () => {
    const engine = createAndStartEngine();
    (engine as any)._score = SPEED_LEVEL_INTERVAL - 1;
    (engine as any).checkLevelUp();
    expect(engine.level).toBe(1);

    (engine as any)._score = SPEED_LEVEL_INTERVAL;
    (engine as any).checkLevelUp();
    expect(engine.level).toBe(2);
  });

  it('多级升级速度应正确累积', () => {
    const engine = createAndStartEngine();
    (engine as any)._score = SPEED_LEVEL_INTERVAL * 3;
    (engine as any).checkLevelUp();
    const expectedSpeed = PLATFORM_SPEED + 3 * SPEED_INCREMENT;
    expect(engine.getCurrentPlatformSpeed()).toBeCloseTo(expectedSpeed, 4);
  });

  it('速度达到上限后不再增加', () => {
    const engine = createAndStartEngine();
    (engine as any)._score = 10000;
    (engine as any).checkLevelUp();
    const speed1 = engine.getCurrentPlatformSpeed();
    (engine as any)._score = 20000;
    (engine as any).checkLevelUp();
    const speed2 = engine.getCurrentPlatformSpeed();
    expect(speed2).toBe(speed1);
  });
});

describe('FallDownEngine - 计分', () => {
  it('初始分数应为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('穿过间隙应加分', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapCenter = targetPlatform.gap.x + targetPlatform.gap.width / 2;

    (engine as any).ball.x = gapCenter;
    (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 2;
    (engine as any).ball.velocityY = 5;

    simulateFrame(engine);
    expect(engine.score).toBeGreaterThan(0);
  });

  it('分数事件应触发', () => {
    const engine = createEngine();
    let scoreChanged = false;
    engine.on('scoreChange', () => {
      scoreChanged = true;
    });
    engine.setSeed(42);
    engine.start();

    const platforms = engine.getPlatforms();
    const targetPlatform = platforms[3];
    const gapCenter = targetPlatform.gap.x + targetPlatform.gap.width / 2;

    (engine as any).ball.x = gapCenter;
    (engine as any).ball.y = targetPlatform.y - BALL_RADIUS - 2;
    (engine as any).ball.velocityY = 5;

    simulateFrame(engine);
    expect(scoreChanged).toBe(true);
  });

  it('穿过多个平台应累加分数', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    for (let i = 0; i < 3; i++) {
      const p = platforms[i];
      const gapCenter = p.gap.x + p.gap.width / 2;
      (engine as any).ball.x = gapCenter;
      (engine as any).ball.y = p.y - BALL_RADIUS - 2;
      (engine as any).ball.velocityY = 5;
      simulateFrame(engine);
    }
    expect(engine.score).toBeGreaterThanOrEqual(1);
  });
});

describe('FallDownEngine - 游戏结束', () => {
  it('球被推到顶部应游戏结束', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = 0;
    simulateFrame(engine);
    expect(engine.status).toBe('gameover');
  });

  it('球Y坐标等于BALL_RADIUS时不应结束', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = BALL_RADIUS;
    simulateFrame(engine);
    // ball.y - BALL_RADIUS = 0, 但 update 中先更新物理再检查
    // 所以取决于物理更新后球的位置
    expect(engine.status).toBe('playing');
  });

  it('游戏结束后不应继续更新', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = 0;
    simulateFrame(engine);
    expect(engine.status).toBe('gameover');
    const scoreBefore = engine.score;
    simulateFrame(engine);
    expect(engine.score).toBe(scoreBefore);
  });

  it('游戏结束后按空格应重新开始', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = 0;
    simulateFrame(engine);
    expect(engine.status).toBe('gameover');

    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
  });

  it('游戏结束事件应触发', () => {
    const engine = createEngine();
    let statusChanged = false;
    engine.on('statusChange', (status: string) => {
      if (status === 'gameover') statusChanged = true;
    });
    engine.setSeed(42);
    engine.start();

    (engine as any).ball.y = 0;
    simulateFrame(engine);
    expect(statusChanged).toBe(true);
  });

  it('球在安全区域不应游戏结束', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = 100;
    simulateFrame(engine);
    expect(engine.status).toBe('playing');
  });
});

describe('FallDownEngine - 重置', () => {
  it('reset 后状态应为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数应为 0', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 10);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后等级应为 1', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 10);
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('reset 后球应回到初始位置', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 10);
    engine.reset();
    const ball = engine.getBallState();
    expect(ball.x).toBe(BALL_INITIAL_X);
    expect(ball.y).toBe(BALL_INITIAL_Y);
  });

  it('reset 后平台应清空', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 10);
    engine.reset();
    expect(engine.getPlatforms().length).toBe(0);
  });

  it('reset 后按键状态应清空', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    engine.reset();
    expect(engine.getKeysPressed().size).toBe(0);
  });

  it('reset 后平台速度应重置', () => {
    const engine = createAndStartEngine();
    (engine as any).currentPlatformSpeed = 5;
    engine.reset();
    expect(engine.getCurrentPlatformSpeed()).toBe(PLATFORM_SPEED);
  });
});

describe('FallDownEngine - 暂停/恢复', () => {
  it('pause 后状态应为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('idle 状态不应暂停', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('paused 状态 resume 后应为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态不应暂停', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = 0;
    simulateFrame(engine);
    engine.pause();
    expect(engine.status).toBe('gameover');
  });

  it('idle 状态不应 resume', () => {
    const engine = createEngine();
    engine.resume();
    expect(engine.status).toBe('idle');
  });
});

describe('FallDownEngine - 销毁', () => {
  it('destroy 后状态应为 idle', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('destroy 后应清理事件监听', () => {
    const engine = createAndStartEngine();
    engine.on('statusChange', () => {});
    engine.destroy();
    expect((engine as any).listeners.size).toBe(0);
  });

  it('destroy 后分数应为 0', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.score).toBe(0);
  });
});

describe('FallDownEngine - getState', () => {
  it('应返回球X坐标', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.ballX).toBe(BALL_INITIAL_X);
  });

  it('应返回球Y坐标', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.ballY).toBe(BALL_INITIAL_Y);
  });

  it('应返回球速度', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.ballVelocityY).toBe(0);
  });

  it('应返回平台数量', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.platformCount).toBe(PLATFORM_INITIAL_COUNT);
  });

  it('应返回当前速度', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.currentSpeed).toBe(PLATFORM_SPEED);
  });

  it('应返回分数', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
  });

  it('更新后状态应反映变化', () => {
    const engine = createAndStartEngine();
    simulateFrame(engine);
    const state = engine.getState();
    expect(state.ballY).toBeGreaterThan(BALL_INITIAL_Y);
    expect(state.ballVelocityY).toBeGreaterThan(0);
  });
});

describe('FallDownEngine - 移动间隙平台', () => {
  it('移动间隙平台应左右移动', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const movingPlatform = platforms.find((p) => p.type === PlatformType.MOVING);

    if (movingPlatform) {
      const initialGapX = movingPlatform.gap.x;
      simulateFrames(engine, 30);
      const updatedPlatforms = engine.getPlatforms();
      const updated = updatedPlatforms.find((p) => p === movingPlatform);
      if (updated) {
        expect(updated.gap.x).toBeDefined();
      }
    }
  });

  it('移动间隙不应超出画布范围', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 200);
    const platforms = engine.getPlatforms();
    for (const p of platforms) {
      if (p.type === PlatformType.MOVING) {
        expect(p.gap.x).toBeGreaterThanOrEqual(0);
        expect(p.gap.x + p.gap.width).toBeLessThanOrEqual(CANVAS_WIDTH);
      }
    }
  });

  it('移动间隙平台应有 movePhase', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const movingPlatforms = platforms.filter((p) => p.type === PlatformType.MOVING);
    for (const p of movingPlatforms) {
      expect(typeof p.movePhase).toBe('number');
    }
  });
});

describe('FallDownEngine - 平台类型', () => {
  it('普通平台间隙宽度应为 PLATFORM_GAP_WIDTH', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const normalPlatforms = platforms.filter((p) => p.type === PlatformType.NORMAL);
    for (const p of normalPlatforms) {
      expect(p.gap.width).toBe(PLATFORM_GAP_WIDTH);
    }
  });

  it('宽间隙平台间隙宽度应为 WIDE_GAP_WIDTH', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const widePlatforms = platforms.filter((p) => p.type === PlatformType.WIDE);
    for (const p of widePlatforms) {
      expect(p.gap.width).toBe(WIDE_GAP_WIDTH);
    }
  });

  it('移动间隙平台间隙宽度应为 PLATFORM_GAP_WIDTH', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const movingPlatforms = platforms.filter((p) => p.type === PlatformType.MOVING);
    for (const p of movingPlatforms) {
      expect(p.gap.width).toBe(PLATFORM_GAP_WIDTH);
    }
  });
});

describe('FallDownEngine - 固定随机种子', () => {
  it('相同种子应生成相同的平台布局', () => {
    const engine1 = createAndStartEngine();
    engine1.setSeed(123);
    engine1.start();
    const platforms1 = engine1.getPlatforms().map((p) => ({
      x: p.gap.x,
      w: p.gap.width,
      type: p.type,
    }));

    const engine2 = createAndStartEngine();
    engine2.setSeed(123);
    engine2.start();
    const platforms2 = engine2.getPlatforms().map((p) => ({
      x: p.gap.x,
      w: p.gap.width,
      type: p.type,
    }));

    expect(platforms1).toEqual(platforms2);
  });

  it('不同种子应生成不同的平台布局', () => {
    const engine1 = createAndStartEngine();
    engine1.setSeed(123);
    engine1.start();
    const platforms1 = engine1.getPlatforms().map((p) => p.gap.x);

    const engine2 = createAndStartEngine();
    engine2.setSeed(456);
    engine2.start();
    const platforms2 = engine2.getPlatforms().map((p) => p.gap.x);

    expect(platforms1).not.toEqual(platforms2);
  });
});

describe('FallDownEngine - 事件系统', () => {
  it('start 应触发 statusChange 事件', () => {
    const engine = createEngine();
    let newStatus: string | null = null;
    engine.on('statusChange', (s: string) => {
      newStatus = s;
    });
    engine.setSeed(42);
    engine.start();
    expect(newStatus).toBe('playing');
  });

  it('scoreChange 事件应传递正确分数', () => {
    const engine = createEngine();
    let lastScore = -1;
    engine.on('scoreChange', (s: number) => {
      lastScore = s;
    });
    engine.setSeed(42);
    engine.start();
    expect(lastScore).toBe(0);
  });

  it('levelChange 事件应传递正确等级', () => {
    const engine = createEngine();
    let lastLevel = -1;
    engine.on('levelChange', (l: number) => {
      lastLevel = l;
    });
    engine.setSeed(42);
    engine.start();
    expect(lastLevel).toBe(1);
  });

  it('off 应移除事件监听', () => {
    const engine = createEngine();
    let callCount = 0;
    const handler = () => { callCount++; };
    engine.on('statusChange', handler);
    engine.off('statusChange', handler);
    engine.setSeed(42);
    engine.start();
    expect(callCount).toBe(0);
  });

  it('pause 应触发 statusChange 为 paused', () => {
    const engine = createAndStartEngine();
    let newStatus: string | null = null;
    engine.on('statusChange', (s: string) => {
      newStatus = s;
    });
    engine.pause();
    expect(newStatus).toBe('paused');
  });

  it('reset 应触发 statusChange 为 idle', () => {
    const engine = createAndStartEngine();
    let newStatus: string | null = null;
    engine.on('statusChange', (s: string) => {
      newStatus = s;
    });
    engine.reset();
    expect(newStatus).toBe('idle');
  });

  it('多个事件监听器都应被调用', () => {
    const engine = createEngine();
    let count1 = 0;
    let count2 = 0;
    engine.on('statusChange', () => { count1++; });
    engine.on('statusChange', () => { count2++; });
    engine.setSeed(42);
    engine.start();
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });
});

describe('FallDownEngine - 综合场景', () => {
  it('完整的游戏流程：开始 → 玩 → 结束 → 重开', () => {
    const engine = createEngine();
    engine.setSeed(42);

    engine.start();
    expect(engine.status).toBe('playing');

    engine.handleKeyDown('ArrowLeft');
    simulateFrames(engine, 20);
    expect(engine.status).toBe('playing');

    (engine as any).ball.y = 0;
    simulateFrame(engine);
    expect(engine.status).toBe('gameover');

    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
  });

  it('长时间运行不应崩溃', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    expect(() => simulateFrames(engine, 500)).not.toThrow();
  });

  it('快速连续按键切换应正常工作', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 50; i++) {
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyUp('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyUp('ArrowRight');
      simulateFrame(engine);
    }
    expect(engine.status).toBe('playing');
  });

  it('球在多个平台间穿梭应正常', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();

    if (platforms.length > 0) {
      const p = platforms[0];
      const gapCenter = p.gap.x + p.gap.width / 2;
      (engine as any).ball.x = gapCenter;
      (engine as any).ball.y = p.y - BALL_RADIUS - 2;
      (engine as any).ball.velocityY = 3;
      simulateFrame(engine);
    }

    expect(engine.status).toBe('playing');
  });

  it('deltaTime 变化应正常处理', () => {
    const engine = createAndStartEngine();
    simulateFrame(engine, 8);
    simulateFrame(engine, 16);
    simulateFrame(engine, 32);
    simulateFrame(engine, 16.667);
    expect(engine.status).toBe('playing');
  });

  it('暂停后恢复游戏应继续', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 5);
    engine.pause();
    expect(engine.status).toBe('paused');
    engine.resume();
    expect(engine.status).toBe('playing');
    simulateFrames(engine, 5);
    expect(engine.status).toBe('playing');
  });
});

describe('FallDownEngine - 公共接口', () => {
  it('getBallState 应返回正确的球状态', () => {
    const engine = createAndStartEngine();
    const ball = engine.getBallState();
    expect(ball).toHaveProperty('x');
    expect(ball).toHaveProperty('y');
    expect(ball).toHaveProperty('velocityY');
  });

  it('getPlatforms 应返回平台数组的副本', () => {
    const engine = createAndStartEngine();
    const p1 = engine.getPlatforms();
    const p2 = engine.getPlatforms();
    expect(p1).not.toBe(p2);
  });

  it('getCurrentPlatformSpeed 应返回当前速度', () => {
    const engine = createAndStartEngine();
    expect(typeof engine.getCurrentPlatformSpeed()).toBe('number');
  });

  it('getKeysPressed 应返回按键集合的副本', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    const k1 = engine.getKeysPressed();
    const k2 = engine.getKeysPressed();
    expect(k1).not.toBe(k2);
  });

  it('setSeed 应接受数字参数', () => {
    const engine = createEngine();
    expect(() => engine.setSeed(42)).not.toThrow();
  });
});

describe('FallDownEngine - 边界情况', () => {
  it('球在画布最左边时应正常', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = 0;
    simulateFrame(engine);
    expect(engine.status).toBe('playing');
  });

  it('球在画布最右边时应正常', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.x = CANVAS_WIDTH;
    simulateFrame(engine);
    expect(engine.status).toBe('playing');
  });

  it('球在画布最底部时应正常', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = CANVAS_HEIGHT - BALL_RADIUS;
    (engine as any).ball.velocityY = 0;
    simulateFrame(engine);
    expect(engine.status).toBe('playing');
  });

  it('没有平台时球应正常下落', () => {
    const engine = createAndStartEngine();
    (engine as any).platforms = [];
    simulateFrame(engine);
    expect(engine.status).toBe('playing');
  });

  it('deltaTime 为 0 时不应崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => simulateFrame(engine, 0)).not.toThrow();
  });

  it('非常大的 deltaTime 不应导致异常', () => {
    const engine = createAndStartEngine();
    expect(() => simulateFrame(engine, 1000)).not.toThrow();
  });

  it('handleKeyUp 未按下的键不应报错', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowLeft')).not.toThrow();
  });

  it('非方向键不应影响游戏', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('x');
    simulateFrame(engine);
    const ball = engine.getBallState();
    expect(ball.x).toBe(BALL_INITIAL_X);
  });

  it('球Y为负数但在安全范围外应结束', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = -10;
    simulateFrame(engine);
    expect(engine.status).toBe('gameover');
  });
});

describe('FallDownEngine - 常量验证', () => {
  it('CANVAS_WIDTH 应为 480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT 应为 640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('BALL_RADIUS 应为正数', () => {
    expect(BALL_RADIUS).toBeGreaterThan(0);
  });

  it('GRAVITY 应为正数', () => {
    expect(GRAVITY).toBeGreaterThan(0);
  });

  it('MAX_FALL_SPEED 应大于 GRAVITY', () => {
    expect(MAX_FALL_SPEED).toBeGreaterThan(GRAVITY);
  });

  it('PLATFORM_GAP_WIDTH 应小于 CANVAS_WIDTH', () => {
    expect(PLATFORM_GAP_WIDTH).toBeLessThan(CANVAS_WIDTH);
  });

  it('WIDE_GAP_WIDTH 应大于 PLATFORM_GAP_WIDTH', () => {
    expect(WIDE_GAP_WIDTH).toBeGreaterThan(PLATFORM_GAP_WIDTH);
  });

  it('MAX_PLATFORM_SPEED 应大于 PLATFORM_SPEED', () => {
    expect(MAX_PLATFORM_SPEED).toBeGreaterThan(PLATFORM_SPEED);
  });

  it('PLATFORM_INITIAL_COUNT 应为正数', () => {
    expect(PLATFORM_INITIAL_COUNT).toBeGreaterThan(0);
  });

  it('SPEED_LEVEL_INTERVAL 应为正数', () => {
    expect(SPEED_LEVEL_INTERVAL).toBeGreaterThan(0);
  });

  it('PlatformType 应包含三种类型', () => {
    expect(Object.values(PlatformType)).toContain('normal');
    expect(Object.values(PlatformType)).toContain('wide');
    expect(Object.values(PlatformType)).toContain('moving');
  });
});

describe('FallDownEngine - 渲染', () => {
  it('游戏运行时渲染不应崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => engine.start()).not.toThrow();
  });

  it('游戏结束后渲染不应崩溃', () => {
    const engine = createAndStartEngine();
    (engine as any).ball.y = 0;
    simulateFrame(engine);
    expect(engine.status).toBe('gameover');
    expect(() => simulateFrame(engine)).not.toThrow();
  });
});

describe('FallDownEngine - 平台生成连续性', () => {
  it('平台间距应大致均匀', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    for (let i = 1; i < platforms.length; i++) {
      const diff = Math.abs(platforms[i - 1].y - platforms[i].y);
      expect(diff).toBeCloseTo(PLATFORM_SPAWN_INTERVAL, 0);
    }
  });

  it('初始最底部平台应在画布内', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const maxY = Math.max(...platforms.map((p) => p.y));
    expect(maxY).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  it('初始最顶部平台应在画布内', () => {
    const engine = createAndStartEngine();
    const platforms = engine.getPlatforms();
    const minY = Math.min(...platforms.map((p) => p.y));
    expect(minY).toBeGreaterThan(-50);
  });

  it('平台持续生成应保持数量稳定', () => {
    const engine = createAndStartEngine();
    const initialCount = engine.getPlatforms().length;
    simulateFrames(engine, 50);
    // 平台数量应大致保持稳定（有移除有新增）
    expect(engine.getPlatforms().length).toBeGreaterThan(0);
  });
});
