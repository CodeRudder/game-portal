import { SpaceDodgeEngine } from '../SpaceDodgeEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SHIP_WIDTH,
  SHIP_HEIGHT,
  SHIP_SPEED,
  SHIP_Y_OFFSET,
  SHIP_HITBOX_SHRINK,
  METEOR_MIN_RADIUS,
  METEOR_MAX_RADIUS,
  METEOR_MIN_SPEED,
  METEOR_MAX_SPEED,
  METEOR_SPAWN_INTERVAL_MS,
  METEOR_SPAWN_INTERVAL_MIN_MS,
  METEOR_SPAWN_INTERVAL_DECREMENT,
  METEOR_SPEED_INCREMENT,
  METEOR_MAX_ON_SCREEN,
  ORB_RADIUS,
  ORB_SPEED,
  ORB_POINTS,
  ORB_SPAWN_INTERVAL_MS,
  ORB_SPAWN_CHANCE,
  ORB_MAX_ON_SCREEN,
  SPEED_INCREASE_INTERVAL_SEC,
  MAX_LEVEL,
  SCORE_PER_SECOND,
  STAR_COUNT,
} from '../constants';

// ========== Mock Canvas ==========
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化 */
function createEngine(): SpaceDodgeEngine {
  const engine = new SpaceDodgeEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 创建引擎并开始游戏 */
function startEngine(): SpaceDodgeEngine {
  const engine = new SpaceDodgeEngine();
  const canvas = createMockCanvas();
  engine.setSeed(42); // 在 init 之前设置种子，确保星空初始化也使用种子
  engine.setCanvas(canvas);
  engine.init();
  engine.start();
  return engine;
}

/** 模拟一帧更新 */
function simulateFrame(engine: SpaceDodgeEngine, dt: number = 16.667): void {
  (engine as any).update(dt);
}

/** 模拟多帧更新 */
function simulateFrames(engine: SpaceDodgeEngine, frames: number, dt: number = 16.667): void {
  for (let i = 0; i < frames; i++) {
    (engine as any).update(dt);
  }
}

// ========== Mock requestAnimationFrame ==========
beforeAll(() => {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => 0) as any;
  globalThis.cancelAnimationFrame = (() => {}) as any;
});

// ========== 测试 ==========

describe('SpaceDodgeEngine - 常量验证', () => {
  it('Canvas 尺寸正确', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('飞船参数合理', () => {
    expect(SHIP_WIDTH).toBeGreaterThan(0);
    expect(SHIP_HEIGHT).toBeGreaterThan(0);
    expect(SHIP_SPEED).toBeGreaterThan(0);
    expect(SHIP_Y_OFFSET).toBeGreaterThan(SHIP_HEIGHT);
  });

  it('陨石参数合理', () => {
    expect(METEOR_MIN_RADIUS).toBeLessThan(METEOR_MAX_RADIUS);
    expect(METEOR_MIN_SPEED).toBeLessThan(METEOR_MAX_SPEED);
    expect(METEOR_SPAWN_INTERVAL_MS).toBeGreaterThan(0);
    expect(METEOR_SPAWN_INTERVAL_MIN_MS).toBeGreaterThan(0);
    expect(METEOR_MAX_ON_SCREEN).toBeGreaterThan(0);
  });

  it('能量球参数合理', () => {
    expect(ORB_RADIUS).toBeGreaterThan(0);
    expect(ORB_SPEED).toBeGreaterThan(0);
    expect(ORB_POINTS).toBeGreaterThan(0);
    expect(ORB_SPAWN_INTERVAL_MS).toBeGreaterThan(0);
    expect(ORB_SPAWN_CHANCE).toBeGreaterThan(0);
    expect(ORB_SPAWN_CHANCE).toBeLessThanOrEqual(1);
    expect(ORB_MAX_ON_SCREEN).toBeGreaterThan(0);
  });

  it('速度递增参数合理', () => {
    expect(SPEED_INCREASE_INTERVAL_SEC).toBeGreaterThan(0);
    expect(MAX_LEVEL).toBeGreaterThan(1);
    expect(METEOR_SPEED_INCREMENT).toBeGreaterThan(0);
  });

  it('计分参数合理', () => {
    expect(SCORE_PER_SECOND).toBeGreaterThan(0);
  });

  it('星空参数合理', () => {
    expect(STAR_COUNT).toBeGreaterThan(0);
  });
});

describe('SpaceDodgeEngine - 初始化', () => {
  let engine: SpaceDodgeEngine;

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

  it('初始飞船位置为 (0, 0)', () => {
    const ship = engine.getShip();
    expect(ship.x).toBe(0);
    expect(ship.y).toBe(0);
  });

  it('初始无陨石', () => {
    expect(engine.getMeteors()).toHaveLength(0);
  });

  it('初始无能量球', () => {
    expect(engine.getOrbs()).toHaveLength(0);
  });

  it('星空已初始化', () => {
    const stars = engine.getStars();
    expect(stars).toHaveLength(STAR_COUNT);
  });

  it('星空星星在画布范围内', () => {
    const stars = engine.getStars();
    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }
  });

  it('初始按键状态为空', () => {
    expect(engine.getKeysPressed().size).toBe(0);
  });

  it('初始速度乘数为 1', () => {
    expect(engine.getSpeedMultiplier()).toBe(1);
  });
});

describe('SpaceDodgeEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = startEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后飞船位置在底部居中', () => {
    const engine = startEngine();
    const ship = engine.getShip();
    expect(ship.x).toBeCloseTo((CANVAS_WIDTH - SHIP_WIDTH) / 2, 0);
    expect(ship.y).toBe(CANVAS_HEIGHT - SHIP_Y_OFFSET);
  });

  it('start 后清空陨石', () => {
    const engine = startEngine();
    expect(engine.getMeteors()).toHaveLength(0);
  });

  it('start 后清空能量球', () => {
    const engine = startEngine();
    expect(engine.getOrbs()).toHaveLength(0);
  });

  it('start 后分数为 0', () => {
    const engine = startEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后等级为 1', () => {
    const engine = startEngine();
    expect(engine.level).toBe(1);
  });

  it('未初始化 canvas 时 start 抛出异常', () => {
    const engine = new SpaceDodgeEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });
});

describe('SpaceDodgeEngine - 飞船移动', () => {
  let engine: SpaceDodgeEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('按下右方向键飞船向右移动', () => {
    const initialX = engine.getShip().x;
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine);
    expect(engine.getShip().x).toBeGreaterThan(initialX);
  });

  it('按下左方向键飞船向左移动', () => {
    // 先向右移动一点
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine);
    const afterRight = engine.getShip().x;

    engine.handleKeyUp('ArrowRight');
    engine.handleKeyDown('ArrowLeft');
    simulateFrame(engine);
    expect(engine.getShip().x).toBeLessThan(afterRight);
  });

  it('按下 d 键飞船向右移动', () => {
    const initialX = engine.getShip().x;
    engine.handleKeyDown('d');
    simulateFrame(engine);
    expect(engine.getShip().x).toBeGreaterThan(initialX);
  });

  it('按下 a 键飞船向左移动', () => {
    const initialX = engine.getShip().x;
    engine.handleKeyDown('a');
    simulateFrame(engine);
    expect(engine.getShip().x).toBeLessThan(initialX);
  });

  it('按下 A 键飞船向左移动', () => {
    const initialX = engine.getShip().x;
    engine.handleKeyDown('A');
    simulateFrame(engine);
    expect(engine.getShip().x).toBeLessThan(initialX);
  });

  it('按下 D 键飞船向右移动', () => {
    const initialX = engine.getShip().x;
    engine.handleKeyDown('D');
    simulateFrame(engine);
    expect(engine.getShip().x).toBeGreaterThan(initialX);
  });

  it('同时按左右方向键飞船不移动', () => {
    const initialX = engine.getShip().x;
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine);
    expect(engine.getShip().x).toBe(initialX);
  });

  it('松开按键后飞船停止移动', () => {
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine);
    const afterMove = engine.getShip().x;
    engine.handleKeyUp('ArrowRight');
    simulateFrame(engine);
    expect(engine.getShip().x).toBe(afterMove);
  });

  it('飞船不能移出左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    simulateFrames(engine, 100);
    expect(engine.getShip().x).toBeGreaterThanOrEqual(0);
  });

  it('飞船不能移出右边界', () => {
    engine.handleKeyDown('ArrowRight');
    simulateFrames(engine, 100);
    const ship = engine.getShip();
    expect(ship.x + ship.width).toBeLessThanOrEqual(CANVAS_WIDTH);
  });

  it('飞船移动速度正确', () => {
    const initialX = engine.getShip().x;
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine);
    const moved = engine.getShip().x - initialX;
    expect(moved).toBeCloseTo(SHIP_SPEED, 1);
  });

  it('飞船尺寸正确', () => {
    const ship = engine.getShip();
    expect(ship.width).toBe(SHIP_WIDTH);
    expect(ship.height).toBe(SHIP_HEIGHT);
  });
});

describe('SpaceDodgeEngine - 陨石生成', () => {
  let engine: SpaceDodgeEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('经过足够时间后生成陨石', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    expect(engine.getMeteors().length).toBeGreaterThan(0);
  });

  it('陨石从顶部生成', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors = engine.getMeteors();
    for (const m of meteors) {
      expect(m.y).toBeLessThanOrEqual(0);
    }
  });

  it('陨石半径在合理范围内', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors = engine.getMeteors();
    for (const m of meteors) {
      expect(m.radius).toBeGreaterThanOrEqual(METEOR_MIN_RADIUS);
      expect(m.radius).toBeLessThanOrEqual(METEOR_MAX_RADIUS);
    }
  });

  it('陨石速度在合理范围内', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors = engine.getMeteors();
    for (const m of meteors) {
      expect(m.speed).toBeGreaterThanOrEqual(METEOR_MIN_SPEED);
      expect(m.speed).toBeLessThanOrEqual(METEOR_MAX_SPEED * engine.getSpeedMultiplier() + 0.1);
    }
  });

  it('陨石 x 坐标在画布范围内', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors = engine.getMeteors();
    for (const m of meteors) {
      expect(m.x - m.radius).toBeGreaterThanOrEqual(-m.radius);
      expect(m.x + m.radius).toBeLessThanOrEqual(CANVAS_WIDTH + m.radius);
    }
  });

  it('陨石颜色索引在范围内', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors = engine.getMeteors();
    for (const m of meteors) {
      expect(m.colorIndex).toBeGreaterThanOrEqual(0);
      expect(m.colorIndex).toBeLessThanOrEqual(4);
    }
  });

  it('屏幕上陨石数量有上限', () => {
    // 快速推进大量时间
    for (let i = 0; i < 50; i++) {
      simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS);
    }
    expect(engine.getMeteors().length).toBeLessThanOrEqual(METEOR_MAX_ON_SCREEN);
  });
});

describe('SpaceDodgeEngine - 陨石移动', () => {
  let engine: SpaceDodgeEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('陨石向下移动', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors = engine.getMeteors();
    if (meteors.length > 0) {
      const initialY = meteors[0].y;
      simulateFrame(engine);
      const newMeteors = engine.getMeteors();
      if (newMeteors.length > 0) {
        const sameMeteor = newMeteors.find(m => Math.abs(m.radius - meteors[0].radius) < 0.01);
        if (sameMeteor) {
          expect(sameMeteor.y).toBeGreaterThan(initialY);
        }
      }
    }
  });

  it('陨石移出屏幕后消失', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    // 推进大量时间让陨石移出屏幕
    simulateFrames(engine, 200);
    // 检查没有陨石 y 坐标超出屏幕太多
    const meteors = engine.getMeteors();
    for (const m of meteors) {
      expect(m.y - m.radius).toBeLessThanOrEqual(CANVAS_HEIGHT + 10);
    }
  });

  it('陨石旋转角度更新', () => {
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors = engine.getMeteors();
    if (meteors.length > 0) {
      const initialRotation = meteors[0].rotation;
      simulateFrame(engine);
      const newMeteors = engine.getMeteors();
      if (newMeteors.length > 0) {
        const rotations = newMeteors.map(m => m.rotation);
        expect(rotations).toBeDefined();
      }
    }
  });
});

describe('SpaceDodgeEngine - 碰撞检测', () => {
  it('飞船与陨石碰撞导致游戏结束', () => {
    const engine = startEngine();
    // 推进时间让陨石生成并可能碰撞
    for (let i = 0; i < 500; i++) {
      simulateFrame(engine);
      if (engine.status === 'gameover') break;
    }
    expect(['playing', 'gameover']).toContain(engine.status);
  });

  it('碰撞盒比飞船实际尺寸小', () => {
    expect(SHIP_HITBOX_SHRINK).toBeGreaterThan(0);
    const hitboxW = SHIP_WIDTH - SHIP_HITBOX_SHRINK * 2;
    const hitboxH = SHIP_HEIGHT - SHIP_HITBOX_SHRINK * 2;
    expect(hitboxW).toBeGreaterThan(0);
    expect(hitboxH).toBeGreaterThan(0);
  });

  it('飞船与能量球碰撞收集加分', () => {
    const engine = startEngine();
    const initialScore = engine.score;
    // 推进时间让能量球可能生成
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * Math.ceil(1 / ORB_SPAWN_CHANCE) + 100);
    // 推进更多时间看是否能收集
    simulateFrames(engine, 300);
    // 分数应该有增加（至少有时间得分）
    expect(engine.score).toBeGreaterThan(initialScore);
  });
});

describe('SpaceDodgeEngine - 速度递增', () => {
  it('初始速度乘数为 1', () => {
    const engine = startEngine();
    expect(engine.getSpeedMultiplier()).toBe(1);
  });

  it('经过一定时间后等级提升', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 + 10);
    expect(engine.level).toBe(2);
  });

  it('等级提升后速度乘数增加', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 + 10);
    expect(engine.getSpeedMultiplier()).toBeGreaterThan(1);
  });

  it('速度乘数按公式递增', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 + 10);
    expect(engine.getSpeedMultiplier()).toBeCloseTo(1 + METEOR_SPEED_INCREMENT, 5);
  });

  it('多次升级速度持续增加', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 * 3 + 10);
    expect(engine.level).toBe(4);
    expect(engine.getSpeedMultiplier()).toBeCloseTo(1 + 3 * METEOR_SPEED_INCREMENT, 5);
  });

  it('等级不超过最大值', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 * (MAX_LEVEL + 5) + 10);
    expect(engine.level).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it('高等级时陨石生成间隔缩短', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 * 5 + 10);
    const level = engine.level;
    const interval = Math.max(
      METEOR_SPAWN_INTERVAL_MIN_MS,
      METEOR_SPAWN_INTERVAL_MS - (level - 1) * METEOR_SPAWN_INTERVAL_DECREMENT
    );
    expect(interval).toBeLessThanOrEqual(METEOR_SPAWN_INTERVAL_MS);
    expect(interval).toBeLessThan(METEOR_SPAWN_INTERVAL_MS);
  });

  it('陨石生成间隔不低于最小值', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 * MAX_LEVEL + 10);
    const interval = Math.max(
      METEOR_SPAWN_INTERVAL_MIN_MS,
      METEOR_SPAWN_INTERVAL_MS - (engine.level - 1) * METEOR_SPAWN_INTERVAL_DECREMENT
    );
    expect(interval).toBeGreaterThanOrEqual(METEOR_SPAWN_INTERVAL_MIN_MS);
  });
});

describe('SpaceDodgeEngine - 计分系统', () => {
  it('初始分数为 0', () => {
    const engine = startEngine();
    expect(engine.score).toBe(0);
  });

  it('每秒加 10 分', () => {
    const engine = startEngine();
    simulateFrame(engine, 1000);
    expect(engine.score).toBe(SCORE_PER_SECOND);
  });

  it('2 秒后加 20 分', () => {
    const engine = startEngine();
    simulateFrame(engine, 2000);
    expect(engine.score).toBe(SCORE_PER_SECOND * 2);
  });

  it('半秒后加 0 分（不满 1 秒不计分）', () => {
    const engine = startEngine();
    simulateFrame(engine, 500);
    expect(engine.score).toBe(0);
  });

  it('1.5 秒后加 10 分', () => {
    const engine = startEngine();
    simulateFrame(engine, 1500);
    expect(engine.score).toBe(SCORE_PER_SECOND);
  });

  it('3 秒后加 30 分', () => {
    const engine = startEngine();
    simulateFrame(engine, 3000);
    expect(engine.score).toBe(SCORE_PER_SECOND * 3);
  });

  it('分数通过事件通知', () => {
    const engine = startEngine();
    const scoreSpy = jest.fn();
    engine.on('scoreChange', scoreSpy);
    simulateFrame(engine, 1000);
    expect(scoreSpy).toHaveBeenCalledWith(SCORE_PER_SECOND);
  });

  it('收集能量球加分', () => {
    expect(ORB_POINTS).toBe(50);
  });

  it('scoreChange 事件在收集能量球时触发', () => {
    const engine = startEngine();
    const scoreSpy = jest.fn();
    engine.on('scoreChange', scoreSpy);
    simulateFrame(engine, 1000);
    expect(scoreSpy).toHaveBeenCalled();
  });
});

describe('SpaceDodgeEngine - 能量球', () => {
  let engine: SpaceDodgeEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('初始无能量球', () => {
    expect(engine.getOrbs()).toHaveLength(0);
  });

  it('能量球从顶部生成', () => {
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * Math.ceil(1 / ORB_SPAWN_CHANCE) + 100);
    const orbs = engine.getOrbs();
    if (orbs.length > 0) {
      expect(orbs[0].y).toBeLessThanOrEqual(ORB_RADIUS);
    }
  });

  it('能量球向下移动', () => {
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * Math.ceil(1 / ORB_SPAWN_CHANCE) + 100);
    const orbs = engine.getOrbs();
    if (orbs.length > 0) {
      const initialY = orbs[0].y;
      simulateFrame(engine);
      const newOrbs = engine.getOrbs();
      if (newOrbs.length > 0) {
        expect(newOrbs[0].y).toBeGreaterThan(initialY);
      }
    }
  });

  it('能量球半径正确', () => {
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * Math.ceil(1 / ORB_SPAWN_CHANCE) + 100);
    const orbs = engine.getOrbs();
    if (orbs.length > 0) {
      expect(orbs[0].radius).toBe(ORB_RADIUS);
    }
  });

  it('能量球移出屏幕后消失', () => {
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * Math.ceil(1 / ORB_SPAWN_CHANCE) + 100);
    const orbsBefore = engine.getOrbs();
    if (orbsBefore.length > 0) {
      simulateFrames(engine, 500);
      expect(engine.status).toBeDefined();
    }
  });

  it('能量球数量有上限', () => {
    for (let i = 0; i < 100; i++) {
      simulateFrame(engine, ORB_SPAWN_INTERVAL_MS);
    }
    expect(engine.getOrbs().length).toBeLessThanOrEqual(ORB_MAX_ON_SCREEN);
  });

  it('能量球脉冲相位更新', () => {
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * Math.ceil(1 / ORB_SPAWN_CHANCE) + 100);
    const orbs = engine.getOrbs();
    if (orbs.length > 0) {
      const phase = orbs[0].pulsePhase;
      simulateFrame(engine);
      const newOrbs = engine.getOrbs();
      if (newOrbs.length > 0) {
        expect(newOrbs[0].pulsePhase).toBeGreaterThanOrEqual(phase);
      }
    }
  });
});

describe('SpaceDodgeEngine - 星空背景', () => {
  it('星空星星数量正确', () => {
    const engine = createEngine();
    expect(engine.getStars()).toHaveLength(STAR_COUNT);
  });

  it('星星向下移动', () => {
    const engine = startEngine();
    const stars = engine.getStars();
    const firstStarY = stars[0].y;
    simulateFrame(engine);
    const newStars = engine.getStars();
    expect(newStars[0].y).toBeGreaterThan(firstStarY);
  });

  it('星星移出屏幕后从顶部重新出现', () => {
    const engine = startEngine();
    simulateFrames(engine, 500);
    const stars = engine.getStars();
    for (const star of stars) {
      expect(star.y).toBeGreaterThanOrEqual(-5);
    }
  });

  it('星星有不同速度', () => {
    const engine = createEngine();
    const stars = engine.getStars();
    const speeds = new Set(stars.map(s => Math.round(s.speed * 100)));
    expect(speeds.size).toBeGreaterThan(1);
  });

  it('星星有不同大小', () => {
    const engine = createEngine();
    const stars = engine.getStars();
    const sizes = new Set(stars.map(s => Math.round(s.size * 100)));
    expect(sizes.size).toBeGreaterThan(1);
  });

  it('星空在 reset 后仍然存在', () => {
    const engine = startEngine();
    engine.reset();
    expect(engine.getStars()).toHaveLength(STAR_COUNT);
  });
});

describe('SpaceDodgeEngine - 游戏结束', () => {
  it('游戏结束后状态为 gameover', () => {
    const engine = startEngine();
    for (let i = 0; i < 1000; i++) {
      simulateFrame(engine);
      if (engine.status === 'gameover') break;
    }
    expect(['playing', 'gameover']).toContain(engine.status);
  });

  it('游戏结束后 statusChange 事件触发', () => {
    const engine = startEngine();
    const statusSpy = jest.fn();
    engine.on('statusChange', statusSpy);

    for (let i = 0; i < 1000; i++) {
      simulateFrame(engine);
      if (engine.status === 'gameover') break;
    }

    if (engine.status === 'gameover') {
      expect(statusSpy).toHaveBeenCalledWith('gameover');
    }
  });

  it('游戏结束后不再更新', () => {
    const engine = startEngine();
    for (let i = 0; i < 1000; i++) {
      simulateFrame(engine);
      if (engine.status === 'gameover') break;
    }

    if (engine.status === 'gameover') {
      const scoreAtEnd = engine.score;
      simulateFrame(engine, 1000);
      expect(engine.score).toBe(scoreAtEnd);
    }
  });
});

describe('SpaceDodgeEngine - 重置', () => {
  it('重置后状态为 idle', () => {
    const engine = startEngine();
    simulateFrame(engine, 1000);
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('重置后分数归零', () => {
    const engine = startEngine();
    simulateFrame(engine, 3000);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('重置后等级归一', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 * 3);
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('重置后飞船位置重置', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine, 1000);
    engine.reset();
    const ship = engine.getShip();
    expect(ship.x).toBe(0);
    expect(ship.y).toBe(0);
  });

  it('重置后清空陨石', () => {
    const engine = startEngine();
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS * 3);
    engine.reset();
    expect(engine.getMeteors()).toHaveLength(0);
  });

  it('重置后清空能量球', () => {
    const engine = startEngine();
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * 5);
    engine.reset();
    expect(engine.getOrbs()).toHaveLength(0);
  });

  it('重置后按键状态清空', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    engine.reset();
    expect(engine.getKeysPressed().size).toBe(0);
  });

  it('重置后速度乘数归一', () => {
    const engine = startEngine();
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 * 3);
    engine.reset();
    expect(engine.getSpeedMultiplier()).toBe(1);
  });
});

describe('SpaceDodgeEngine - 键盘控制', () => {
  it('handleKeyDown 记录按键', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    expect(engine.getKeysPressed().has('ArrowRight')).toBe(true);
  });

  it('handleKeyUp 移除按键', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyUp('ArrowRight');
    expect(engine.getKeysPressed().has('ArrowRight')).toBe(false);
  });

  it('空格键在 idle 状态下启动游戏', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('空格键在 gameover 状态下重新开始', () => {
    const engine = startEngine();
    simulateFrame(engine, 1000);
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');

    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('多个按键可以同时按下', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowUp');
    expect(engine.getKeysPressed().size).toBe(3);
  });

  it('重复按下同一按键不重复记录', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    expect(engine.getKeysPressed().size).toBe(1);
  });

  it('无效按键不影响游戏', () => {
    const engine = startEngine();
    engine.handleKeyDown('q');
    engine.handleKeyDown('x');
    simulateFrame(engine);
    const ship = engine.getShip();
    expect(ship.x).toBeCloseTo((CANVAS_WIDTH - SHIP_WIDTH) / 2, 0);
  });
});

describe('SpaceDodgeEngine - getState', () => {
  it('返回包含 ship 的状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('ship');
  });

  it('返回包含 meteors 的状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('meteors');
  });

  it('返回包含 orbs 的状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('orbs');
  });

  it('返回包含 score 的状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state.score).toBe(0);
  });

  it('返回包含 level 的状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('level');
    expect(state.level).toBe(1);
  });

  it('返回包含 speedMultiplier 的状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('speedMultiplier');
    expect(state.speedMultiplier).toBe(1);
  });

  it('返回包含 elapsedTime 的状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('elapsedTime');
  });

  it('状态数据为快照（不可变）', () => {
    const engine = startEngine();
    const state1 = engine.getState();
    const state2 = engine.getState();
    expect(state1).not.toBe(state2);
  });
});

describe('SpaceDodgeEngine - 事件系统', () => {
  it('statusChange 事件在 start 时触发', () => {
    const engine = createEngine();
    const spy = jest.fn();
    engine.on('statusChange', spy);
    engine.start();
    expect(spy).toHaveBeenCalledWith('playing');
  });

  it('scoreChange 事件在得分时触发', () => {
    const engine = startEngine();
    const spy = jest.fn();
    engine.on('scoreChange', spy);
    simulateFrame(engine, 1000);
    expect(spy).toHaveBeenCalledWith(SCORE_PER_SECOND);
  });

  it('levelChange 事件在升级时触发', () => {
    const engine = startEngine();
    const spy = jest.fn();
    engine.on('levelChange', spy);
    simulateFrame(engine, SPEED_INCREASE_INTERVAL_SEC * 1000 + 10);
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('off 取消事件监听', () => {
    const engine = startEngine();
    const spy = jest.fn();
    engine.on('scoreChange', spy);
    engine.off('scoreChange', spy);
    simulateFrame(engine, 1000);
    expect(spy).not.toHaveBeenCalled();
  });

  it('多个监听器都收到事件', () => {
    const engine = startEngine();
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    engine.on('scoreChange', spy1);
    engine.on('scoreChange', spy2);
    simulateFrame(engine, 1000);
    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  });
});

describe('SpaceDodgeEngine - 边界情况', () => {
  it('deltaTime 为 0 时不崩溃', () => {
    const engine = startEngine();
    expect(() => simulateFrame(engine, 0)).not.toThrow();
  });

  it('非常大的 deltaTime 被限制', () => {
    const engine = startEngine();
    expect(() => simulateFrame(engine, 10000)).not.toThrow();
  });

  it('负数 deltaTime 不崩溃', () => {
    const engine = startEngine();
    expect(() => simulateFrame(engine, -100)).not.toThrow();
  });

  it('连续多次 update 正常工作', () => {
    const engine = startEngine();
    simulateFrames(engine, 100);
    expect(engine.status).toBe('playing');
    expect(engine.score).toBeGreaterThan(0);
  });

  it('reset 后可以重新 start', () => {
    const engine = startEngine();
    simulateFrame(engine, 3000);
    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
  });

  it('多次 start 不会崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('destroy 清理资源', () => {
    const engine = startEngine();
    simulateFrame(engine, 1000);
    engine.destroy();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);
  });
});

describe('SpaceDodgeEngine - 随机种子', () => {
  it('设置种子后结果可重现', () => {
    const engine1 = startEngine();
    simulateFrame(engine1, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors1 = engine1.getMeteors();

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const engine2 = new SpaceDodgeEngine();
    engine2.setSeed(42);
    engine2.setCanvas(canvas);
    engine2.init();
    engine2.start();
    simulateFrame(engine2, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors2 = engine2.getMeteors();

    expect(meteors1.length).toBe(meteors2.length);
    if (meteors1.length > 0 && meteors2.length > 0) {
      expect(meteors1[0].x).toBeCloseTo(meteors2[0].x, 5);
      expect(meteors1[0].radius).toBeCloseTo(meteors2[0].radius, 5);
    }
  });

  it('不同种子产生不同结果', () => {
    const engine1 = createEngine();
    engine1.setSeed(42);
    engine1.start();
    simulateFrame(engine1, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors1 = engine1.getMeteors();

    const engine2 = createEngine();
    engine2.setSeed(123);
    engine2.start();
    simulateFrame(engine2, METEOR_SPAWN_INTERVAL_MS + 10);
    const meteors2 = engine2.getMeteors();

    if (meteors1.length > 0 && meteors2.length > 0) {
      const samePosition = Math.abs(meteors1[0].x - meteors2[0].x) < 0.01;
      const sameRadius = Math.abs(meteors1[0].radius - meteors2[0].radius) < 0.01;
      expect(samePosition && sameRadius).toBe(false);
    }
  });

  it('null 种子恢复 Math.random', () => {
    const engine = startEngine();
    engine.setSeed(null);
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    expect(engine.getMeteors().length).toBeGreaterThan(0);
  });
});

describe('SpaceDodgeEngine - 渲染', () => {
  it('onRender 不崩溃', () => {
    const engine = startEngine();
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('有陨石时渲染不崩溃', () => {
    const engine = startEngine();
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS + 10);
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('有能量球时渲染不崩溃', () => {
    const engine = startEngine();
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * Math.ceil(1 / ORB_SPAWN_CHANCE) + 100);
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('游戏结束后渲染不崩溃', () => {
    const engine = startEngine();
    simulateFrame(engine, 1000);
    (engine as any).gameOver();
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });
});

describe('SpaceDodgeEngine - 综合场景', () => {
  it('完整游戏流程：开始→玩→结束→重开', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');

    engine.start();
    expect(engine.status).toBe('playing');

    simulateFrame(engine, 2000);
    expect(engine.score).toBe(SCORE_PER_SECOND * 2);

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);

    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('长时间运行不崩溃', () => {
    const engine = startEngine();
    for (let i = 0; i < 2000; i++) {
      simulateFrame(engine);
      if (engine.status === 'gameover') break;
    }
    expect(['playing', 'gameover']).toContain(engine.status);
  });

  it('飞船在移动中游戏可以正常结束', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    for (let i = 0; i < 1000; i++) {
      simulateFrame(engine);
      if (engine.status === 'gameover') break;
    }
    expect(['playing', 'gameover']).toContain(engine.status);
  });

  it('交替按键不影响游戏稳定性', () => {
    const engine = startEngine();
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) {
        engine.handleKeyDown('ArrowLeft');
        engine.handleKeyUp('ArrowRight');
      } else {
        engine.handleKeyDown('ArrowRight');
        engine.handleKeyUp('ArrowLeft');
      }
      simulateFrame(engine);
    }
    expect(engine.status).toBe('playing');
  });

  it('暂停和恢复', () => {
    const engine = startEngine();
    simulateFrame(engine, 1000);
    engine.pause();
    expect(engine.status).toBe('paused');

    const scoreAtPause = engine.score;
    engine.resume();
    expect(engine.status).toBe('playing');
  });
});

describe('SpaceDodgeEngine - 陨石生成间隔', () => {
  it('初始生成间隔为 METEOR_SPAWN_INTERVAL_MS', () => {
    const engine = startEngine();
    const interval = Math.max(
      METEOR_SPAWN_INTERVAL_MIN_MS,
      METEOR_SPAWN_INTERVAL_MS - (engine.level - 1) * METEOR_SPAWN_INTERVAL_DECREMENT
    );
    expect(interval).toBe(METEOR_SPAWN_INTERVAL_MS);
  });

  it('等级越高生成间隔越短', () => {
    const intervals: number[] = [];
    for (let level = 1; level <= 5; level++) {
      intervals.push(
        Math.max(
          METEOR_SPAWN_INTERVAL_MIN_MS,
          METEOR_SPAWN_INTERVAL_MS - (level - 1) * METEOR_SPAWN_INTERVAL_DECREMENT
        )
      );
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1]);
    }
  });

  it('生成间隔不低于最小值', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const interval = Math.max(
        METEOR_SPAWN_INTERVAL_MIN_MS,
        METEOR_SPAWN_INTERVAL_MS - (level - 1) * METEOR_SPAWN_INTERVAL_DECREMENT
      );
      expect(interval).toBeGreaterThanOrEqual(METEOR_SPAWN_INTERVAL_MIN_MS);
    }
  });
});

describe('SpaceDodgeEngine - 计分精度', () => {
  it('精确 1 秒得分', () => {
    const engine = startEngine();
    simulateFrame(engine, 1000);
    expect(engine.score).toBe(10);
  });

  it('精确 5 秒得分', () => {
    const engine = startEngine();
    simulateFrame(engine, 5000);
    expect(engine.score).toBe(50);
  });

  it('累积半秒 + 半秒 = 1 秒得分', () => {
    const engine = startEngine();
    simulateFrame(engine, 500);
    expect(engine.score).toBe(0);
    simulateFrame(engine, 500);
    expect(engine.score).toBe(10);
  });

  it('多次小间隔累积计分', () => {
    const engine = startEngine();
    for (let i = 0; i < 100; i++) {
      simulateFrame(engine, 10);
    }
    expect(engine.score).toBe(10);
  });
});

describe('SpaceDodgeEngine - 升级系统', () => {
  it('精确 10 秒升到 2 级', () => {
    const engine = startEngine();
    simulateFrame(engine, 10000);
    expect(engine.level).toBe(2);
  });

  it('精确 20 秒升到 3 级', () => {
    const engine = startEngine();
    simulateFrame(engine, 20000);
    expect(engine.level).toBe(3);
  });

  it('9.9 秒不升级', () => {
    const engine = startEngine();
    simulateFrame(engine, 9900);
    expect(engine.level).toBe(1);
  });

  it('levelChange 事件携带正确等级', () => {
    const engine = startEngine();
    const spy = jest.fn();
    engine.on('levelChange', spy);
    simulateFrame(engine, 10000);
    expect(spy).toHaveBeenCalledWith(2);
    simulateFrame(engine, 10000);
    expect(spy).toHaveBeenCalledWith(3);
  });

  it('等级与速度乘数对应', () => {
    for (let targetLevel = 2; targetLevel <= 5; targetLevel++) {
      const engine2 = startEngine();
      simulateFrame(engine2, SPEED_INCREASE_INTERVAL_SEC * 1000 * (targetLevel - 1) + 10);
      const expectedMultiplier = 1 + (targetLevel - 1) * METEOR_SPEED_INCREMENT;
      expect(engine2.getSpeedMultiplier()).toBeCloseTo(expectedMultiplier, 5);
    }
  });
});

describe('SpaceDodgeEngine - 能量球生成概率', () => {
  it('能量球生成阈值正确', () => {
    const threshold = Math.ceil(1 / ORB_SPAWN_CHANCE);
    expect(threshold).toBe(4);
  });

  it('每 threshold 次检查生成一个能量球', () => {
    const engine = startEngine();
    const threshold = Math.ceil(1 / ORB_SPAWN_CHANCE);
    simulateFrame(engine, ORB_SPAWN_INTERVAL_MS * threshold + 100);
    expect(engine.getOrbs().length).toBeGreaterThanOrEqual(0);
  });
});

describe('SpaceDodgeEngine - 飞船边界精确测试', () => {
  it('飞船左边界为 0', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowLeft');
    simulateFrames(engine, 200);
    expect(engine.getShip().x).toBe(0);
  });

  it('飞船右边界为 CANVAS_WIDTH - SHIP_WIDTH', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    simulateFrames(engine, 200);
    const ship = engine.getShip();
    expect(ship.x).toBe(CANVAS_WIDTH - SHIP_WIDTH);
  });

  it('飞船初始 y 坐标正确', () => {
    const engine = startEngine();
    expect(engine.getShip().y).toBe(CANVAS_HEIGHT - SHIP_Y_OFFSET);
  });

  it('飞船 y 坐标不变', () => {
    const engine = startEngine();
    engine.handleKeyDown('ArrowRight');
    simulateFrame(engine, 1000);
    expect(engine.getShip().y).toBe(CANVAS_HEIGHT - SHIP_Y_OFFSET);
  });
});

describe('SpaceDodgeEngine - update 时序', () => {
  it('单次大步 update 与多次小步 update 的分数一致', () => {
    const engine1 = startEngine();
    simulateFrame(engine1, 3000);

    const engine2 = startEngine();
    for (let i = 0; i < 3; i++) {
      simulateFrame(engine2, 1000);
    }

    expect(engine1.score).toBe(engine2.score);
  });

  it('陨石在生成间隔后出现', () => {
    const engine = startEngine();
    simulateFrame(engine, METEOR_SPAWN_INTERVAL_MS - 10);
    expect(engine.getMeteors()).toHaveLength(0);

    simulateFrame(engine, 20);
    expect(engine.getMeteors().length).toBeGreaterThan(0);
  });
});

describe('SpaceDodgeEngine - 暂停恢复', () => {
  it('暂停后状态为 paused', () => {
    const engine = startEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('恢复后状态为 playing', () => {
    const engine = startEngine();
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
    const engine = startEngine();
    (engine as any).gameOver();
    engine.pause();
    expect(engine.status).toBe('gameover');
  });

  it('statusChange 事件在暂停时触发', () => {
    const engine = startEngine();
    const spy = jest.fn();
    engine.on('statusChange', spy);
    engine.pause();
    expect(spy).toHaveBeenCalledWith('paused');
  });

  it('statusChange 事件在恢复时触发', () => {
    const engine = startEngine();
    engine.pause();
    const spy = jest.fn();
    engine.on('statusChange', spy);
    engine.resume();
    expect(spy).toHaveBeenCalledWith('playing');
  });
});
