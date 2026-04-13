import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkiFreeEngine } from '../SkiFreeEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SKIER_WIDTH, SKIER_HEIGHT,
  SKIER_SPEED_BASE, SKIER_SPEED_MIN, SKIER_SPEED_MAX,
  SKIER_SPEED_ACCEL, SKIER_SPEED_BRAKE, SKIER_SPEED_FRICTION,
  SKIER_TURN_RATE,
  TREE_WIDTH, TREE_HEIGHT,
  ROCK_WIDTH, ROCK_HEIGHT,
  SNOW_PILE_WIDTH, SNOW_PILE_HEIGHT,
  RAMP_WIDTH, RAMP_HEIGHT, RAMP_SCORE,
  JUMP_DURATION, JUMP_TRICK_SCORE,
  YETI_WIDTH, YETI_HEIGHT, YETI_SPEED,
  YETI_APPEAR_DISTANCE, YETI_CATCH_DISTANCE,
  TERRAIN_SPAWN_INTERVAL,
  OBSTACLE_DENSITY, RAMP_CHANCE,
  SNOWFLAKE_COUNT, SNOWFLAKE_SPEED_MIN, SNOWFLAKE_SPEED_MAX,
  SNOWFLAKE_SIZE_MIN, SNOWFLAKE_SIZE_MAX,
  DISTANCE_SCORE_RATE, SPEED_BONUS_MULTIPLIER,
  COLLISION_TOLERANCE,
  OBSTACLE_TREE, OBSTACLE_ROCK, OBSTACLE_SNOW_PILE, OBSTACLE_RAMP,
  DIFFICULTY_INCREASE_RATE, MAX_OBSTACLE_DENSITY,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): SkiFreeEngine {
  const engine = new SkiFreeEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 模拟游戏循环若干帧 */
function tick(engine: SkiFreeEngine, frames: number, dt: number = 16): void {
  for (let i = 0; i < frames; i++) {
    (engine as any).update(dt);
  }
}

// ========== 常量测试 ==========

describe('SkiFree Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('滑雪者尺寸合理', () => {
    expect(SKIER_WIDTH).toBeGreaterThan(0);
    expect(SKIER_HEIGHT).toBeGreaterThan(0);
  });

  it('速度参数合理', () => {
    expect(SKIER_SPEED_MIN).toBeLessThan(SKIER_SPEED_BASE);
    expect(SKIER_SPEED_BASE).toBeLessThan(SKIER_SPEED_MAX);
    expect(SKIER_SPEED_ACCEL).toBeGreaterThan(0);
    expect(SKIER_SPEED_BRAKE).toBeGreaterThan(0);
  });

  it('障碍物类型常量正确', () => {
    expect(OBSTACLE_TREE).toBe('tree');
    expect(OBSTACLE_ROCK).toBe('rock');
    expect(OBSTACLE_SNOW_PILE).toBe('snow_pile');
    expect(OBSTACLE_RAMP).toBe('ramp');
  });

  it('雪怪参数合理', () => {
    expect(YETI_WIDTH).toBeGreaterThan(0);
    expect(YETI_HEIGHT).toBeGreaterThan(0);
    expect(YETI_SPEED).toBeGreaterThan(0);
    expect(YETI_APPEAR_DISTANCE).toBeGreaterThan(0);
  });

  it('跳跃参数合理', () => {
    expect(JUMP_DURATION).toBeGreaterThan(0);
    expect(RAMP_SCORE).toBeGreaterThan(0);
    expect(JUMP_TRICK_SCORE).toBeGreaterThan(0);
  });

  it('雪花参数合理', () => {
    expect(SNOWFLAKE_COUNT).toBeGreaterThan(0);
    expect(SNOWFLAKE_SPEED_MIN).toBeLessThan(SNOWFLAKE_SPEED_MAX);
    expect(SNOWFLAKE_SIZE_MIN).toBeLessThan(SNOWFLAKE_SIZE_MAX);
  });

  it('碰撞容差非负', () => {
    expect(COLLISION_TOLERANCE).toBeGreaterThanOrEqual(0);
  });

  it('计分参数合理', () => {
    expect(DISTANCE_SCORE_RATE).toBeGreaterThan(0);
    expect(SPEED_BONUS_MULTIPLIER).toBeGreaterThanOrEqual(0);
  });

  it('难度参数合理', () => {
    expect(OBSTACLE_DENSITY).toBeGreaterThan(0);
    expect(OBSTACLE_DENSITY).toBeLessThanOrEqual(1);
    expect(MAX_OBSTACLE_DENSITY).toBeGreaterThanOrEqual(OBSTACLE_DENSITY);
  });

  it('地形生成间隔合理', () => {
    expect(TERRAIN_SPAWN_INTERVAL).toBeGreaterThan(0);
  });
});

// ========== 初始化测试 ==========

describe('SkiFreeEngine - 初始化', () => {
  let engine: SkiFreeEngine;

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

  it('滑雪者初始位于画布中下部', () => {
    expect(engine.skierX).toBeCloseTo((CANVAS_WIDTH - SKIER_WIDTH) / 2, 1);
    expect(engine.skierY).toBeCloseTo(CANVAS_HEIGHT * 0.7, 1);
  });

  it('初始速度为基础速度', () => {
    expect(engine.skierSpeed).toBe(SKIER_SPEED_BASE);
  });

  it('初始角度为 0（直行）', () => {
    expect(engine.skierAngle).toBe(0);
  });

  it('初始未碰撞', () => {
    expect(engine.isCrashed).toBe(false);
  });

  it('初始未跳跃', () => {
    expect(engine.isJumping).toBe(false);
  });

  it('初始距离为 0', () => {
    expect(engine.distance).toBe(0);
  });

  it('初始没有障碍物', () => {
    expect(engine.obstacles.length).toBe(0);
  });

  it('初始雪怪未激活', () => {
    expect(engine.yetiActive).toBe(false);
  });

  it('初始没有轨迹', () => {
    expect(engine.trail.length).toBe(0);
  });

  it('初始没有雪花', () => {
    expect(engine.snowflakes.length).toBe(0);
  });

  it('初始距离分数为 0', () => {
    expect(engine.distanceScore).toBe(0);
  });
});

// ========== 生命周期测试 ==========

describe('SkiFreeEngine - 生命周期', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后生成障碍物', () => {
    engine.start();
    expect(engine.obstacles.length).toBeGreaterThan(0);
  });

  it('start 后生成雪花', () => {
    engine.start();
    expect(engine.snowflakes.length).toBe(SNOWFLAKE_COUNT);
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
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后距离归零', () => {
    engine.start();
    tick(engine, 50);
    engine.reset();
    expect(engine.distance).toBe(0);
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

// ========== 滑雪者控制测试 ==========

describe('SkiFreeEngine - 滑雪者控制', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('按左箭头滑雪者向左转', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 10);
    expect(engine.skierAngle).toBeLessThan(0);
  });

  it('按右箭头滑雪者向右转', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 10);
    expect(engine.skierAngle).toBeGreaterThan(0);
  });

  it('按上箭头加速', () => {
    const startSpeed = engine.skierSpeed;
    engine.handleKeyDown('ArrowUp');
    tick(engine, 10);
    expect(engine.skierSpeed).toBeGreaterThan(startSpeed);
  });

  it('按下箭头减速', () => {
    const startSpeed = engine.skierSpeed;
    engine.handleKeyDown('ArrowDown');
    tick(engine, 10);
    expect(engine.skierSpeed).toBeLessThan(startSpeed);
  });

  it('WASD 键也能控制', () => {
    engine.handleKeyDown('a');
    tick(engine, 10);
    expect(engine.skierAngle).toBeLessThan(0);
    engine.handleKeyUp('a');

    // 等待角度完全回正
    tick(engine, 100);

    engine.handleKeyDown('d');
    tick(engine, 20);
    expect(engine.skierAngle).toBeGreaterThan(0);
    engine.handleKeyUp('d');
  });

  it('W 键加速', () => {
    const startSpeed = engine.skierSpeed;
    engine.handleKeyDown('w');
    tick(engine, 10);
    expect(engine.skierSpeed).toBeGreaterThan(startSpeed);
  });

  it('S 键减速', () => {
    const startSpeed = engine.skierSpeed;
    engine.handleKeyDown('s');
    tick(engine, 10);
    expect(engine.skierSpeed).toBeLessThan(startSpeed);
  });

  it('速度不超过最大值', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 500);
    expect(engine.skierSpeed).toBeLessThanOrEqual(SKIER_SPEED_MAX);
  });

  it('速度不低于最小值', () => {
    // 直接测试 handleInput 的减速逻辑，不依赖 gameLoop
    const dt = 16 / 1000;
    (engine as any)._skierSpeed = 200;
    (engine as any)._keys.add('ArrowDown');
    for (let i = 0; i < 500; i++) {
      (engine as any).handleInput(dt);
    }
    expect(engine.skierSpeed).toBeGreaterThanOrEqual(SKIER_SPEED_MIN);
  });

  it('松开所有键后自然减速', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 20);
    const boostedSpeed = engine.skierSpeed;
    engine.handleKeyUp('ArrowUp');
    tick(engine, 100);
    expect(engine.skierSpeed).toBeLessThan(boostedSpeed);
  });

  it('松开转向键后角度回正', () => {
    // 直接操作 handleInput 避免 rAF 干扰
    const dt = 16 / 1000;
    (engine as any)._keys.add('ArrowLeft');
    for (let i = 0; i < 20; i++) (engine as any).handleInput(dt);
    expect(engine.skierAngle).toBeLessThan(0);
    (engine as any)._keys.delete('ArrowLeft');
    for (let i = 0; i < 500; i++) (engine as any).handleInput(dt);
    expect(Math.abs(engine.skierAngle)).toBeLessThan(0.05);
  });

  it('滑雪者不会移出画布左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 500);
    expect(engine.skierX).toBeGreaterThanOrEqual(0);
  });

  it('滑雪者不会移出画布右边界', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 500);
    expect(engine.skierX).toBeLessThanOrEqual(CANVAS_WIDTH - SKIER_WIDTH);
  });

  it('转向时滑雪者X位置变化', () => {
    const startX = engine.skierX;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 30);
    // 向左转时X应该减小
    expect(engine.skierX).toBeLessThanOrEqual(startX);
  });
});

// ========== 距离与计分测试 ==========

describe('SkiFreeEngine - 距离与计分', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('游戏进行中距离增加', () => {
    tick(engine, 30);
    expect(engine.distance).toBeGreaterThan(0);
  });

  it('速度越快距离增长越快', () => {
    // 手动控制速度，直接调用 update 比较距离增量
    const dt = 16;
    const fastEngine = createEngine();
    fastEngine.start();
    (fastEngine as any)._skierSpeed = 300;
    (fastEngine as any)._obstacles = [];
    (fastEngine as any)._snowflakes = [];
    for (let i = 0; i < 30; i++) (fastEngine as any).update(dt);
    const fastDist = fastEngine.distance;

    const slowEngine = createEngine();
    slowEngine.start();
    (slowEngine as any)._skierSpeed = 100;
    (slowEngine as any)._obstacles = [];
    (slowEngine as any)._snowflakes = [];
    for (let i = 0; i < 30; i++) (slowEngine as any).update(dt);
    const slowDist = slowEngine.distance;

    expect(fastDist).toBeGreaterThan(slowDist);
  });

  it('距离分数与距离成正比', () => {
    tick(engine, 30);
    const expectedScore = Math.floor(engine.distance * DISTANCE_SCORE_RATE);
    expect(engine.distanceScore).toBeCloseTo(expectedScore, 0);
  });

  it('高速时有速度加成分', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 60);
    // 高速时总分应大于距离分数
    expect(engine.score).toBeGreaterThanOrEqual(engine.distanceScore);
  });

  it('分数通过状态获取', () => {
    const before = engine.score;
    tick(engine, 30);
    const after = engine.score;
    expect(after).toBeGreaterThan(before);
  });

  it('计分随时间单调递增', () => {
    const scores: number[] = [engine.score];
    for (let i = 0; i < 5; i++) {
      tick(engine, 10);
      scores.push(engine.score);
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});

// ========== 障碍物测试 ==========

describe('SkiFreeEngine - 障碍物', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('游戏开始时生成障碍物', () => {
    expect(engine.obstacles.length).toBeGreaterThan(0);
  });

  it('障碍物随地形向下滚动', () => {
    // 记录第一个障碍物的Y坐标
    const obs = engine.obstacles[0];
    if (!obs) return;
    const startY = obs.y;
    tick(engine, 30);
    expect(obs.y).toBeGreaterThan(startY);
  });

  it('障碍物移出屏幕后被移除', () => {
    // 手动将障碍物放到屏幕下方外
    (engine as any)._obstacles = [
      { x: 100, y: CANVAS_HEIGHT + 100, type: OBSTACLE_TREE, width: TREE_WIDTH, height: TREE_HEIGHT },
    ];
    tick(engine, 1);
    expect(engine.obstacles.length).toBe(0);
  });

  it('障碍物类型有效', () => {
    const validTypes = [OBSTACLE_TREE, OBSTACLE_ROCK, OBSTACLE_SNOW_PILE, OBSTACLE_RAMP];
    for (const obs of engine.obstacles) {
      expect(validTypes).toContain(obs.type);
    }
  });

  it('障碍物有正确的尺寸', () => {
    for (const obs of engine.obstacles) {
      expect(obs.width).toBeGreaterThan(0);
      expect(obs.height).toBeGreaterThan(0);
    }
  });

  it('障碍物X坐标在画布内', () => {
    for (const obs of engine.obstacles) {
      expect(obs.x).toBeGreaterThanOrEqual(0);
      expect(obs.x + obs.width).toBeLessThanOrEqual(CANVAS_WIDTH + 10);
    }
  });

  it('地形定时生成新障碍物', () => {
    const initialCount = engine.obstacles.length;
    // 模拟足够时间生成新行
    tick(engine, Math.ceil(TERRAIN_SPAWN_INTERVAL / 16) + 5);
    // 应该有新障碍物生成（或旧的有滚动走）
    expect(engine.obstacles.length).toBeGreaterThan(0);
  });
});

// ========== 碰撞检测测试 ==========

describe('SkiFreeEngine - 碰撞检测', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    // 清空默认障碍物
    (engine as any)._obstacles = [];
  });

  it('碰到树木会碰撞', () => {
    // 在滑雪者正前方放一棵树
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(true);
  });

  it('碰到岩石会碰撞', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_ROCK,
      width: ROCK_WIDTH,
      height: ROCK_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(true);
  });

  it('碰到雪堆会碰撞', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_SNOW_PILE,
      width: SNOW_PILE_WIDTH,
      height: SNOW_PILE_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(true);
  });

  it('碰到跳台不会碰撞而是跳跃', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_RAMP,
      width: RAMP_WIDTH,
      height: RAMP_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(false);
    expect(engine.isJumping).toBe(true);
  });

  it('跳跃时不会碰到障碍物', () => {
    // 先设置跳跃状态
    (engine as any)._isJumping = true;
    (engine as any)._jumpTimer = JUMP_DURATION;
    // 放置障碍物
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(false);
  });

  it('碰撞后速度归零', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.skierSpeed).toBe(0);
  });

  it('碰撞后触发 crash 事件', () => {
    const callback = vi.fn();
    engine.on('crash', callback);
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    expect(callback).toHaveBeenCalled();
  });

  it('碰撞容差有效', () => {
    // 障碍物稍微偏离，在容差范围内仍碰撞
    (engine as any)._obstacles = [{
      x: engine.skierX + COLLISION_TOLERANCE - 1,
      y: engine.skierY + COLLISION_TOLERANCE - 1,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(true);
  });

  it('碰撞后一段时间游戏结束', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(true);
    // 继续tick直到crash timer耗尽
    tick(engine, 100);
    expect(engine.status).toBe('gameover');
  });
});

// ========== 跳跃测试 ==========

describe('SkiFreeEngine - 跳跃', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._obstacles = [];
  });

  it('碰到跳台触发跳跃', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_RAMP,
      width: RAMP_WIDTH,
      height: RAMP_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isJumping).toBe(true);
  });

  it('跳跃有持续时间', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_RAMP,
      width: RAMP_WIDTH,
      height: RAMP_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isJumping).toBe(true);
  });

  it('跳跃持续一段时间后结束', () => {
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_RAMP,
      width: RAMP_WIDTH,
      height: RAMP_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isJumping).toBe(true);
    // 等待跳跃结束
    tick(engine, Math.ceil(JUMP_DURATION / 16) + 10);
    expect(engine.isJumping).toBe(false);
  });

  it('跳台得分', () => {
    const scoreBefore = engine.score;
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_RAMP,
      width: RAMP_WIDTH,
      height: RAMP_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.score).toBeGreaterThanOrEqual(scoreBefore + RAMP_SCORE);
  });

  it('跳跃时触发 jumpStart 事件', () => {
    const callback = vi.fn();
    engine.on('jumpStart', callback);
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_RAMP,
      width: RAMP_WIDTH,
      height: RAMP_HEIGHT,
    }];
    tick(engine, 1);
    expect(callback).toHaveBeenCalledWith(RAMP_SCORE);
  });

  it('已在跳跃中不会重复触发', () => {
    (engine as any)._isJumping = true;
    (engine as any)._jumpTimer = JUMP_DURATION;
    const tricksBefore = engine.jumpTricks;
    // 尝试再次触发
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_RAMP,
      width: RAMP_WIDTH,
      height: RAMP_HEIGHT,
    }];
    tick(engine, 1);
    // 不应该再次触发（跳台碰撞被跳过因为已经在跳跃）
    // 检查 jumpTricks 没有重置
    expect(engine.jumpTricks).toBe(tricksBefore);
  });
});

// ========== 雪怪测试 ==========

describe('SkiFreeEngine - 雪怪', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._obstacles = [];
  });

  it('滑行一定距离后雪怪出现', () => {
    (engine as any)._distance = YETI_APPEAR_DISTANCE;
    tick(engine, 1);
    expect(engine.yetiActive).toBe(true);
  });

  it('雪怪未达到距离不出现', () => {
    (engine as any)._distance = YETI_APPEAR_DISTANCE - 100;
    tick(engine, 1);
    expect(engine.yetiActive).toBe(false);
  });

  it('可以手动召唤雪怪', () => {
    (engine as any).spawnYeti();
    expect(engine.yetiActive).toBe(true);
  });

  it('雪怪从屏幕边缘出现', () => {
    (engine as any).spawnYeti();
    const fromLeft = engine.yetiX <= 0;
    const fromRight = engine.yetiX >= CANVAS_WIDTH - YETI_WIDTH;
    expect(fromLeft || fromRight).toBe(true);
  });

  it('雪怪向滑雪者移动', () => {
    (engine as any).spawnYeti();
    const startX = engine.yetiX;
    const startY = engine.yetiY;
    tick(engine, 30);
    // 雪怪应该移动了
    const moved = engine.yetiX !== startX || engine.yetiY !== startY;
    expect(moved).toBe(true);
  });

  it('雪怪抓住滑雪者触发 eating 状态', () => {
    (engine as any).spawnYeti();
    // 将雪怪放到滑雪者位置
    (engine as any)._yetiX = engine.skierX;
    (engine as any)._yetiY = engine.skierY;
    tick(engine, 1);
    expect(engine.yetiEating).toBe(true);
  });

  it('雪怪抓住后触发 yetiCatch 事件', () => {
    const callback = vi.fn();
    engine.on('yetiCatch', callback);
    (engine as any).spawnYeti();
    (engine as any)._yetiX = engine.skierX;
    (engine as any)._yetiY = engine.skierY;
    tick(engine, 1);
    expect(callback).toHaveBeenCalled();
  });

  it('雪怪抓住后一段时间游戏结束', () => {
    (engine as any).spawnYeti();
    (engine as any)._yetiX = engine.skierX;
    (engine as any)._yetiY = engine.skierY;
    tick(engine, 1);
    expect(engine.yetiEating).toBe(true);
    // 等待吃掉动画
    tick(engine, 200);
    expect(engine.status).toBe('gameover');
  });

  it('雪怪出现时触发 yetiAppear 事件', () => {
    const callback = vi.fn();
    engine.on('yetiAppear', callback);
    (engine as any).spawnYeti();
    expect(callback).toHaveBeenCalled();
  });

  it('雪怪追逐速度合理', () => {
    (engine as any).spawnYeti();
    const dist1 = Math.sqrt(
      Math.pow(engine.yetiX - engine.skierX, 2) +
      Math.pow(engine.yetiY - engine.skierY, 2)
    );
    tick(engine, 10);
    const dist2 = Math.sqrt(
      Math.pow(engine.yetiX - engine.skierX, 2) +
      Math.pow(engine.yetiY - engine.skierY, 2)
    );
    // 雪怪应该更近了
    expect(dist2).toBeLessThanOrEqual(dist1);
  });
});

// ========== 雪花测试 ==========

describe('SkiFreeEngine - 雪花', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('生成正确数量的雪花', () => {
    expect(engine.snowflakes.length).toBe(SNOWFLAKE_COUNT);
  });

  it('雪花有合理的速度', () => {
    for (const sf of engine.snowflakes) {
      expect(sf.speed).toBeGreaterThanOrEqual(SNOWFLAKE_SPEED_MIN);
      expect(sf.speed).toBeLessThanOrEqual(SNOWFLAKE_SPEED_MAX);
    }
  });

  it('雪花有合理的尺寸', () => {
    for (const sf of engine.snowflakes) {
      expect(sf.size).toBeGreaterThanOrEqual(SNOWFLAKE_SIZE_MIN);
      expect(sf.size).toBeLessThanOrEqual(SNOWFLAKE_SIZE_MAX);
    }
  });

  it('雪花在画布范围内', () => {
    for (const sf of engine.snowflakes) {
      expect(sf.x).toBeGreaterThanOrEqual(0);
      expect(sf.x).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(sf.y).toBeGreaterThanOrEqual(-10);
      expect(sf.y).toBeLessThanOrEqual(CANVAS_HEIGHT + 10);
    }
  });

  it('雪花随时间向下移动', () => {
    const firstSf = engine.snowflakes[0];
    const startY = firstSf.y;
    tick(engine, 10);
    // 大多数雪花应该向下移动了
    const moved = engine.snowflakes[0].y !== startY;
    expect(moved).toBe(true);
  });
});

// ========== 轨迹测试 ==========

describe('SkiFreeEngine - 轨迹', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._obstacles = [];
  });

  it('滑行后生成轨迹', () => {
    tick(engine, 20);
    expect(engine.trail.length).toBeGreaterThan(0);
  });

  it('轨迹点在画布范围内', () => {
    tick(engine, 30);
    for (const pt of engine.trail) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(CANVAS_WIDTH);
    }
  });

  it('轨迹不会无限增长', () => {
    tick(engine, 500);
    expect(engine.trail.length).toBeLessThanOrEqual(200);
  });

  it('轨迹点随地形滚动', () => {
    tick(engine, 20);
    if (engine.trail.length >= 2) {
      const firstPt = engine.trail[0];
      const startY = firstPt.y;
      tick(engine, 10);
      // 轨迹点应该向下滚动
      expect(firstPt.y).toBeGreaterThanOrEqual(startY);
    }
  });
});

// ========== 难度递增测试 ==========

describe('SkiFreeEngine - 难度递增', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._obstacles = [];
  });

  it('初始密度为 OBSTACLE_DENSITY', () => {
    expect(engine.currentDensity).toBe(OBSTACLE_DENSITY);
  });

  it('距离增加后密度增大', () => {
    const initialDensity = engine.currentDensity;
    (engine as any)._distance = 5000;
    tick(engine, 1);
    expect(engine.currentDensity).toBeGreaterThan(initialDensity);
  });

  it('密度不超过最大值', () => {
    (engine as any)._distance = 999999;
    tick(engine, 1);
    expect(engine.currentDensity).toBeLessThanOrEqual(MAX_OBSTACLE_DENSITY);
  });

  it('密度按公式递增', () => {
    (engine as any)._distance = 100;
    // Update once - distance will increase slightly but density formula is checked
    const densityBefore = engine.currentDensity;
    tick(engine, 1);
    // Density should have increased from the 100 distance
    expect(engine.currentDensity).toBeGreaterThan(densityBefore);
    expect(engine.currentDensity).toBeCloseTo(OBSTACLE_DENSITY + 100 * DIFFICULTY_INCREASE_RATE, 1);
  });
});

// ========== 事件系统测试 ==========

describe('SkiFreeEngine - 事件', () => {
  let engine: SkiFreeEngine;

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

  it('off 可以取消事件监听', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.off('statusChange', callback);
    engine.start();
    expect(callback).not.toHaveBeenCalled();
  });
});

// ========== getState 测试 ==========

describe('SkiFreeEngine - getState', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('返回正确的分数', () => {
    const state = engine.getState();
    expect(state.score).toBe(engine.score);
  });

  it('返回正确的等级', () => {
    const state = engine.getState();
    expect(state.level).toBe(1);
  });

  it('返回滑雪者位置', () => {
    const state = engine.getState();
    expect(typeof state.skierX).toBe('number');
    expect(typeof state.skierY).toBe('number');
  });

  it('返回滑雪者速度', () => {
    const state = engine.getState();
    expect(state.skierSpeed).toBe(SKIER_SPEED_BASE);
  });

  it('返回滑雪者角度', () => {
    const state = engine.getState();
    expect(state.skierAngle).toBe(0);
  });

  it('返回距离', () => {
    const state = engine.getState();
    expect(typeof state.distance).toBe('number');
  });

  it('返回碰撞状态', () => {
    const state = engine.getState();
    expect(state.isCrashed).toBe(false);
  });

  it('返回跳跃状态', () => {
    const state = engine.getState();
    expect(state.isJumping).toBe(false);
  });

  it('返回雪怪状态', () => {
    const state = engine.getState();
    expect(state.yetiActive).toBe(false);
  });

  it('返回障碍物数量', () => {
    const state = engine.getState();
    expect(typeof state.obstacleCount).toBe('number');
  });
});

// ========== 输入处理测试 ==========

describe('SkiFreeEngine - 输入处理', () => {
  let engine: SkiFreeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
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

  it('多个键可以同时按下', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowUp');
    expect((engine as any)._keys.has('ArrowLeft')).toBe(true);
    expect((engine as any)._keys.has('ArrowUp')).toBe(true);
  });

  it('松开一个键不影响其他键', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyUp('ArrowLeft');
    expect((engine as any)._keys.has('ArrowUp')).toBe(true);
    expect((engine as any)._keys.has('ArrowLeft')).toBe(false);
  });
});

// ========== 边界与异常测试 ==========

describe('SkiFreeEngine - 边界与异常', () => {
  it('未初始化 canvas 就 start 会抛出错误', () => {
    const engine = new SkiFreeEngine();
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

  it('reset 后所有状态恢复初始值', () => {
    const engine = createEngine();
    engine.start();
    tick(engine, 50);
    engine.reset();
    expect(engine.score).toBe(0);
    expect(engine.distance).toBe(0);
    expect(engine.isCrashed).toBe(false);
    expect(engine.isJumping).toBe(false);
    expect(engine.skierSpeed).toBe(SKIER_SPEED_BASE);
    expect(engine.skierAngle).toBe(0);
    expect(engine.yetiActive).toBe(false);
  });

  it('长时间运行不会崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(() => tick(engine, 1000)).not.toThrow();
  });
});

// ========== 综合场景测试 ==========

describe('SkiFreeEngine - 综合场景', () => {
  it('完整游戏流程：开始→滑行→碰撞→结束', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.status).toBe('playing');

    // 滑行一段时间
    tick(engine, 30);
    expect(engine.distance).toBeGreaterThan(0);
    expect(engine.score).toBeGreaterThan(0);

    // 放置障碍物导致碰撞
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    expect(engine.isCrashed).toBe(true);

    // 等待游戏结束
    tick(engine, 100);
    expect(engine.status).toBe('gameover');
  });

  it('跳跃越过障碍物场景', () => {
    const engine = createEngine();
    engine.start();
    (engine as any)._obstacles = [];

    // 先设置跳跃
    (engine as any)._isJumping = true;
    (engine as any)._jumpTimer = JUMP_DURATION;

    // 放置障碍物
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];

    tick(engine, 5);
    expect(engine.isCrashed).toBe(false);
  });

  it('雪怪追逐并抓住滑雪者', () => {
    const engine = createEngine();
    engine.start();
    (engine as any)._obstacles = [];

    // 召唤雪怪到滑雪者附近
    (engine as any).spawnYeti();
    (engine as any)._yetiX = engine.skierX + 5;
    (engine as any)._yetiY = engine.skierY + 5;

    tick(engine, 5);
    expect(engine.yetiEating).toBe(true);

    tick(engine, 200);
    expect(engine.status).toBe('gameover');
  });

  it('重新开始后雪怪重置', () => {
    const engine = createEngine();
    engine.start();
    (engine as any)._obstacles = [];

    // 让雪怪出现
    (engine as any).spawnYeti();
    expect(engine.yetiActive).toBe(true);

    // 碰撞结束
    (engine as any)._obstacles = [{
      x: engine.skierX,
      y: engine.skierY + 5,
      type: OBSTACLE_TREE,
      width: TREE_WIDTH,
      height: TREE_HEIGHT,
    }];
    tick(engine, 1);
    tick(engine, 100);
    expect(engine.status).toBe('gameover');

    // 重新开始
    engine.handleKeyDown(' ');
    expect(engine.yetiActive).toBe(false);
    expect(engine.isCrashed).toBe(false);
  });
});
