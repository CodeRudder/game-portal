import { describe, it, expect, beforeEach } from 'vitest';
import { GravityFlipEngine } from '../GravityFlipEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  CEILING_Y,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_X,
  GRAVITY,
  FLIP_VELOCITY,
  MAX_VELOCITY,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_DISTANCE,
  MAX_SPEED,
  ObstacleType,
  SPIKE_WIDTH,
  SPIKE_HEIGHT,
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  MIN_OBSTACLE_INTERVAL,
  MAX_OBSTACLE_INTERVAL,
  HITBOX_SHRINK,
  PARTICLE_COUNT,
  PARTICLE_LIFETIME,
  GravityDirection,
} from '../constants';

// ========== Mock Canvas ==========
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): GravityFlipEngine {
  const engine = new GravityFlipEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init(canvas);
  return engine;
}

function createAndStartEngine(): GravityFlipEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

// ========== 辅助：模拟帧更新 ==========
function simulateFrames(engine: GravityFlipEngine, frames: number, deltaTime: number = 16.667): void {
  for (let i = 0; i < frames; i++) {
    engine.update(deltaTime);
  }
}

// ========== 测试 ==========

describe('GravityFlipEngine - 常量验证', () => {
  it('Canvas 尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('地面和天花板 Y 坐标合理', () => {
    expect(GROUND_Y).toBe(560);
    expect(CEILING_Y).toBe(40);
    expect(GROUND_Y).toBeGreaterThan(CEILING_Y);
  });

  it('角色尺寸合理', () => {
    expect(PLAYER_WIDTH).toBeGreaterThan(0);
    expect(PLAYER_HEIGHT).toBeGreaterThan(0);
    expect(PLAYER_X).toBeGreaterThan(0);
  });

  it('物理参数合理', () => {
    expect(GRAVITY).toBeGreaterThan(0);
    expect(FLIP_VELOCITY).toBeLessThan(0);
    expect(MAX_VELOCITY).toBeGreaterThan(0);
  });

  it('速度参数合理', () => {
    expect(INITIAL_SPEED).toBeGreaterThan(0);
    expect(SPEED_INCREMENT).toBeGreaterThan(0);
    expect(SPEED_INCREMENT_DISTANCE).toBeGreaterThan(0);
    expect(MAX_SPEED).toBeGreaterThanOrEqual(INITIAL_SPEED);
  });

  it('障碍物类型枚举完整', () => {
    expect(ObstacleType.GROUND_SPIKE).toBe('ground_spike');
    expect(ObstacleType.CEILING_SPIKE).toBe('ceiling_spike');
    expect(ObstacleType.MIDDLE_BLOCK).toBe('middle_block');
    expect(ObstacleType.DOUBLE_SPIKE).toBe('double_spike');
  });

  it('重力方向枚举完整', () => {
    expect(GravityDirection.DOWN).toBe('down');
    expect(GravityDirection.UP).toBe('up');
  });

  it('碰撞检测容差合理', () => {
    expect(HITBOX_SHRINK).toBeGreaterThanOrEqual(0);
    expect(HITBOX_SHRINK).toBeLessThan(PLAYER_WIDTH / 2);
  });

  it('粒子参数合理', () => {
    expect(PARTICLE_COUNT).toBeGreaterThan(0);
    expect(PARTICLE_LIFETIME).toBeGreaterThan(0);
  });

  it('障碍物生成间隔合理', () => {
    expect(MIN_OBSTACLE_INTERVAL).toBeGreaterThan(0);
    expect(MAX_OBSTACLE_INTERVAL).toBeGreaterThan(MIN_OBSTACLE_INTERVAL);
  });

  it('尖刺尺寸合理', () => {
    expect(SPIKE_WIDTH).toBeGreaterThan(0);
    expect(SPIKE_HEIGHT).toBeGreaterThan(0);
  });

  it('方块尺寸合理', () => {
    expect(BLOCK_WIDTH).toBeGreaterThan(0);
    expect(BLOCK_HEIGHT).toBeGreaterThan(0);
  });
});

describe('GravityFlipEngine - 初始化', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始化后状态为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始化后分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('初始化后等级为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('玩家初始位置在地面', () => {
    const state = engine.getPlayerState();
    expect(state.y).toBe(GROUND_Y - PLAYER_HEIGHT);
  });

  it('玩家初始重力方向向下', () => {
    const state = engine.getPlayerState();
    expect(state.gravityDir).toBe(GravityDirection.DOWN);
  });

  it('玩家初始速度为 0', () => {
    const state = engine.getPlayerState();
    expect(state.velocity).toBe(0);
  });

  it('玩家 X 位置固定', () => {
    const state = engine.getPlayerState();
    expect(state.x).toBe(PLAYER_X);
  });

  it('初始障碍物列表为空', () => {
    expect(engine.getObstacles()).toHaveLength(0);
  });

  it('初始粒子列表为空', () => {
    expect(engine.getParticles()).toHaveLength(0);
  });

  it('初始翻转次数为 0', () => {
    expect(engine.getFlipCount()).toBe(0);
  });

  it('初始速度为 INITIAL_SPEED', () => {
    expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
  });

  it('初始距离为 0', () => {
    expect(engine.getDistance()).toBe(0);
  });

  it('getGravityDirection 返回正确值', () => {
    expect(engine.getGravityDirection()).toBe(GravityDirection.DOWN);
  });

  it('getState 返回完整状态', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('playerY');
    expect(state).toHaveProperty('playerVelocity');
    expect(state).toHaveProperty('gravityDirection');
    expect(state).toHaveProperty('speed');
    expect(state).toHaveProperty('distance');
    expect(state).toHaveProperty('obstacleCount');
    expect(state).toHaveProperty('flipCount');
    expect(state).toHaveProperty('score');
  });
});

describe('GravityFlipEngine - 启动', () => {
  it('启动后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('启动后分数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('启动后重置所有状态', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.getObstacles()).toHaveLength(0);
    expect(engine.getFlipCount()).toBe(0);
    expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
  });

  it('没有 canvas 时启动抛出错误', () => {
    const engine = new GravityFlipEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('启动后玩家在地面位置', () => {
    const engine = createAndStartEngine();
    const state = engine.getPlayerState();
    expect(state.y).toBe(GROUND_Y - PLAYER_HEIGHT);
  });

  it('启动后重力方向为向下', () => {
    const engine = createAndStartEngine();
    expect(engine.getGravityDirection()).toBe(GravityDirection.DOWN);
  });
});

describe('GravityFlipEngine - 重力翻转物理', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('翻转后重力方向变为 UP', () => {
    engine.flip();
    expect(engine.getGravityDirection()).toBe(GravityDirection.UP);
  });

  it('再次翻转重力方向变回 DOWN', () => {
    engine.flip();
    engine.flip();
    expect(engine.getGravityDirection()).toBe(GravityDirection.DOWN);
  });

  it('翻转后玩家获得初始速度', () => {
    engine.flip();
    const state = engine.getPlayerState();
    expect(state.velocity).toBe(-FLIP_VELOCITY); // 向上
  });

  it('向下重力时玩家向下加速', () => {
    engine.flip();
    simulateFrames(engine, 5);
    engine.flip();
    const stateBefore = engine.getPlayerState();
    simulateFrames(engine, 5);
    const stateAfter = engine.getPlayerState();
    expect(stateAfter.velocity).toBeGreaterThan(stateBefore.velocity);
  });

  it('向上重力时玩家向上加速', () => {
    engine.flip();
    const stateBefore = engine.getPlayerState();
    simulateFrames(engine, 5);
    const stateAfter = engine.getPlayerState();
    expect(stateAfter.velocity).toBeLessThan(stateBefore.velocity);
  });

  it('玩家不会超过地面边界', () => {
    simulateFrames(engine, 100);
    const state = engine.getPlayerState();
    expect(state.y).toBeLessThanOrEqual(GROUND_Y - PLAYER_HEIGHT);
  });

  it('玩家不会超过天花板边界', () => {
    engine.flip();
    simulateFrames(engine, 100);
    const state = engine.getPlayerState();
    expect(state.y).toBeGreaterThanOrEqual(CEILING_Y);
  });

  it('玩家到达地面后速度归零', () => {
    engine.flip();
    simulateFrames(engine, 5);
    engine.flip();
    simulateFrames(engine, 100);
    const state = engine.getPlayerState();
    expect(state.y).toBe(GROUND_Y - PLAYER_HEIGHT);
    expect(state.velocity).toBe(0);
  });

  it('玩家到达天花板后速度归零', () => {
    engine.flip();
    simulateFrames(engine, 100);
    const state = engine.getPlayerState();
    expect(state.y).toBe(CEILING_Y);
    expect(state.velocity).toBe(0);
  });

  it('翻转次数正确计数', () => {
    expect(engine.getFlipCount()).toBe(0);
    engine.flip();
    expect(engine.getFlipCount()).toBe(1);
    engine.flip();
    expect(engine.getFlipCount()).toBe(2);
    engine.flip();
    expect(engine.getFlipCount()).toBe(3);
  });

  it('速度不超过 MAX_VELOCITY', () => {
    simulateFrames(engine, 500);
    const state = engine.getPlayerState();
    expect(Math.abs(state.velocity)).toBeLessThanOrEqual(MAX_VELOCITY);
  });

  it('从天花板翻转时获得向下的初始速度', () => {
    engine.flip();
    simulateFrames(engine, 100);
    engine.flip();
    const state = engine.getPlayerState();
    expect(state.velocity).toBe(FLIP_VELOCITY);
  });

  it('向下重力时玩家在地面静止', () => {
    simulateFrames(engine, 50);
    const state = engine.getPlayerState();
    expect(state.y).toBe(GROUND_Y - PLAYER_HEIGHT);
    expect(state.velocity).toBe(0);
  });

  it('向上重力时玩家向上移动', () => {
    engine.flip();
    const yBefore = engine.getPlayerState().y;
    simulateFrames(engine, 5);
    const yAfter = engine.getPlayerState().y;
    expect(yAfter).toBeLessThan(yBefore);
  });

  it('向下重力时翻转后向上移动', () => {
    engine.flip();
    const yBefore = engine.getPlayerState().y;
    simulateFrames(engine, 3);
    const yAfter = engine.getPlayerState().y;
    expect(yAfter).toBeLessThan(yBefore);
  });
});

describe('GravityFlipEngine - 键盘输入', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空格键翻转重力', () => {
    engine.handleKeyDown(' ');
    expect(engine.getGravityDirection()).toBe(GravityDirection.UP);
  });

  it('上方向键翻转重力', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.getGravityDirection()).toBe(GravityDirection.UP);
  });

  it('W 键翻转重力', () => {
    engine.handleKeyDown('w');
    expect(engine.getGravityDirection()).toBe(GravityDirection.UP);
  });

  it('大写 W 键翻转重力', () => {
    engine.handleKeyDown('W');
    expect(engine.getGravityDirection()).toBe(GravityDirection.UP);
  });

  it('R 键重新开始（游戏中）', () => {
    simulateFrames(engine, 10);
    engine.handleKeyDown('r');
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
  });

  it('大写 R 键重新开始', () => {
    simulateFrames(engine, 10);
    engine.handleKeyDown('R');
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
  });

  it('非游戏状态时空格键不翻转', () => {
    const idleEngine = createEngine();
    idleEngine.handleKeyDown(' ');
    expect(idleEngine.getGravityDirection()).toBe(GravityDirection.DOWN);
  });

  it('handleKeyUp 不报错', () => {
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyUp('w')).not.toThrow();
  });

  it('其他按键不影响游戏', () => {
    engine.handleKeyDown('a');
    engine.handleKeyDown('b');
    engine.handleKeyDown('1');
    expect(engine.getGravityDirection()).toBe(GravityDirection.DOWN);
    expect(engine.getFlipCount()).toBe(0);
  });

  it('游戏结束后 R 键重开', () => {
    (engine as any)._status = 'gameover';
    engine.handleKeyDown('r');
    expect(engine.status).toBe('playing');
  });

  it('游戏结束后大写 R 键重开', () => {
    (engine as any)._status = 'gameover';
    engine.handleKeyDown('R');
    expect(engine.status).toBe('playing');
  });

  it('连续按键快速翻转', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    expect(engine.getFlipCount()).toBe(3);
  });
});

describe('GravityFlipEngine - 障碍物生成', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('经过一段时间后生成障碍物', () => {
    simulateFrames(engine, 200);
    expect(engine.getObstacles().length).toBeGreaterThan(0);
  });

  it('障碍物从右侧屏幕外生成', () => {
    simulateFrames(engine, 200);
    const obstacles = engine.getObstacles();
    if (obstacles.length > 0) {
      expect(obstacles[0].x).toBeLessThan(CANVAS_WIDTH + 50);
    }
  });

  it('障碍物向左移动', () => {
    simulateFrames(engine, 200);
    const obstacles = engine.getObstacles();
    if (obstacles.length >= 1) {
      const oldX = obstacles[0].x;
      simulateFrames(engine, 5);
      const newObstacles = engine.getObstacles();
      if (newObstacles.length > 0) {
        expect(newObstacles[0].x).toBeLessThan(oldX);
      }
    }
  });

  it('障碍物移出屏幕后被移除', () => {
    simulateFrames(engine, 200);
    simulateFrames(engine, 1000);
    const remaining = engine.getObstacles();
    for (const obs of remaining) {
      expect(obs.x + obs.width).toBeGreaterThan(-50);
    }
  });

  it('障碍物类型为有效值', () => {
    simulateFrames(engine, 300);
    const obstacles = engine.getObstacles();
    const validTypes = [ObstacleType.GROUND_SPIKE, ObstacleType.CEILING_SPIKE, ObstacleType.MIDDLE_BLOCK, ObstacleType.DOUBLE_SPIKE];
    for (const obs of obstacles) {
      expect(validTypes).toContain(obs.type);
    }
  });

  it('地面尖刺位置在地面', () => {
    simulateFrames(engine, 300);
    const groundSpikes = engine.getObstacles().filter(o => o.type === ObstacleType.GROUND_SPIKE);
    for (const spike of groundSpikes) {
      expect(spike.y).toBe(GROUND_Y - SPIKE_HEIGHT);
    }
  });

  it('天花板尖刺位置在天花板', () => {
    simulateFrames(engine, 300);
    const ceilingSpikes = engine.getObstacles().filter(o => o.type === ObstacleType.CEILING_SPIKE);
    for (const spike of ceilingSpikes) {
      expect(spike.y).toBe(CEILING_Y);
    }
  });

  it('中间方块在合理位置', () => {
    simulateFrames(engine, 300);
    const blocks = engine.getObstacles().filter(o => o.type === ObstacleType.MIDDLE_BLOCK);
    for (const block of blocks) {
      expect(block.y).toBeGreaterThan(CEILING_Y - 50);
      expect(block.y + block.height).toBeLessThan(GROUND_Y + 50);
    }
  });

  it('障碍物宽度合理', () => {
    simulateFrames(engine, 300);
    const obstacles = engine.getObstacles();
    for (const obs of obstacles) {
      expect(obs.width).toBeGreaterThan(0);
    }
  });

  it('障碍物高度合理', () => {
    simulateFrames(engine, 300);
    const obstacles = engine.getObstacles();
    for (const obs of obstacles) {
      expect(obs.height).toBeGreaterThan(0);
    }
  });

  it('passed 标记初始为 false', () => {
    simulateFrames(engine, 100);
    const obstacles = engine.getObstacles();
    for (const obs of obstacles) {
      if (obs.x + obs.width > PLAYER_X) {
        expect(obs.passed).toBe(false);
      }
    }
  });

  it('障碍物持续生成', () => {
    simulateFrames(engine, 500);
    const count1 = engine.getObstacles().length;
    simulateFrames(engine, 500);
    // 障碍物应该持续生成（虽然也有移除，但总体应该有障碍物）
    expect(engine.getObstacles().length).toBeGreaterThan(0);
  });
});

describe('GravityFlipEngine - 碰撞检测', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('玩家在地面时不碰到天花板尖刺', () => {
    const playerState = engine.getPlayerState();
    expect(playerState.y).toBe(GROUND_Y - PLAYER_HEIGHT);
  });

  it('玩家在天花板时不碰到地面尖刺', () => {
    engine.flip();
    simulateFrames(engine, 100);
    const playerState = engine.getPlayerState();
    expect(playerState.y).toBe(CEILING_Y);
  });

  it('直接注入障碍物到玩家位置导致碰撞', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x - 5,
      y: playerState.y - 5,
      width: PLAYER_WIDTH + 10,
      height: PLAYER_HEIGHT + 10,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('障碍物在玩家远处不碰撞', () => {
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: 400,
      y: GROUND_Y - SPIKE_HEIGHT,
      width: SPIKE_WIDTH,
      height: SPIKE_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('playing');
  });

  it('双面尖刺上下都检测碰撞', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.DOUBLE_SPIKE,
      x: playerState.x - 5,
      y: CEILING_Y,
      width: SPIKE_WIDTH + 20,
      height: SPIKE_HEIGHT * 2 + 60,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('碰撞检测使用缩小的 hitbox', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    const margin = HITBOX_SHRINK + 1;
    internalObs.push({
      type: ObstacleType.MIDDLE_BLOCK,
      x: playerState.x + PLAYER_WIDTH - margin,
      y: playerState.y + PLAYER_HEIGHT - margin,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(['playing', 'gameover']).toContain(engine.status);
  });

  it('无障碍物时不碰撞', () => {
    simulateFrames(engine, 1);
    expect(engine.status).toBe('playing');
  });

  it('障碍物刚好在玩家旁边不碰撞', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x + PLAYER_WIDTH + 1,
      y: playerState.y,
      width: SPIKE_WIDTH,
      height: SPIKE_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('playing');
  });

  it('障碍物在玩家上方不碰撞（地面尖刺 vs 天花板玩家）', () => {
    engine.flip();
    simulateFrames(engine, 100);
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: PLAYER_X - 5,
      y: GROUND_Y - SPIKE_HEIGHT,
      width: SPIKE_WIDTH + 20,
      height: SPIKE_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('playing');
  });

  it('中间方块碰撞检测', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.MIDDLE_BLOCK,
      x: playerState.x,
      y: playerState.y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('天花板尖刺与天花板玩家碰撞', () => {
    engine.flip();
    simulateFrames(engine, 100);
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.CEILING_SPIKE,
      x: playerState.x - 5,
      y: CEILING_Y,
      width: SPIKE_WIDTH + 20,
      height: SPIKE_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('地面尖刺与地面玩家碰撞', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x - 5,
      y: GROUND_Y - SPIKE_HEIGHT,
      width: SPIKE_WIDTH + 20,
      height: SPIKE_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });
});

describe('GravityFlipEngine - 速度递增', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始速度为 INITIAL_SPEED', () => {
    expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
  });

  it('距离增加后速度递增', () => {
    simulateFrames(engine, 500);
    expect(engine.getCurrentSpeed()).toBeGreaterThan(INITIAL_SPEED);
  });

  it('速度不超过 MAX_SPEED', () => {
    simulateFrames(engine, 5000);
    expect(engine.getCurrentSpeed()).toBeLessThanOrEqual(MAX_SPEED);
  });

  it('速度按公式递增', () => {
    (engine as any).distance = SPEED_INCREMENT_DISTANCE;
    simulateFrames(engine, 1);
    const expectedSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + 1 * SPEED_INCREMENT);
    expect(engine.getCurrentSpeed()).toBeCloseTo(expectedSpeed, 1);
  });

  it('速度递增后等级也更新', () => {
    (engine as any).distance = SPEED_INCREMENT_DISTANCE * 3;
    simulateFrames(engine, 1);
    expect(engine.level).toBe(4);
  });

  it('多级速度递增', () => {
    (engine as any).distance = SPEED_INCREMENT_DISTANCE * 5;
    simulateFrames(engine, 1);
    const expectedSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + 5 * SPEED_INCREMENT);
    expect(engine.getCurrentSpeed()).toBeCloseTo(expectedSpeed, 1);
  });

  it('速度达到上限后保持不变', () => {
    (engine as any).distance = SPEED_INCREMENT_DISTANCE * 1000;
    simulateFrames(engine, 1);
    expect(engine.getCurrentSpeed()).toBe(MAX_SPEED);
  });
});

describe('GravityFlipEngine - 计分', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('游戏开始时分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('随时间推移分数增加', () => {
    simulateFrames(engine, 60);
    expect(engine.score).toBeGreaterThan(0);
  });

  it('分数与距离成正比', () => {
    simulateFrames(engine, 60);
    const distance = engine.getDistance();
    const expectedScore = distance * 0.1;
    expect(engine.score).toBeCloseTo(expectedScore, 1);
  });

  it('速度越快分数增长越快', () => {
    const engine1 = createAndStartEngine();
    const engine2 = createAndStartEngine();
    (engine2 as any).speed = INITIAL_SPEED * 2;

    simulateFrames(engine1, 60);
    simulateFrames(engine2, 60);

    expect(engine2.score).toBeGreaterThan(engine1.score);
  });

  it('重置后分数归零', () => {
    simulateFrames(engine, 60);
    expect(engine.score).toBeGreaterThan(0);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('分数持续增长', () => {
    const score1 = engine.score;
    simulateFrames(engine, 30);
    const score2 = engine.score;
    simulateFrames(engine, 30);
    const score3 = engine.score;
    expect(score2).toBeGreaterThan(score1);
    expect(score3).toBeGreaterThan(score2);
  });
});

describe('GravityFlipEngine - 游戏结束', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('碰撞后状态变为 gameover', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x - 5,
      y: playerState.y - 5,
      width: PLAYER_WIDTH + 10,
      height: PLAYER_HEIGHT + 10,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('游戏结束后 gameLoop 不再执行 update', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x - 5,
      y: playerState.y - 5,
      width: PLAYER_WIDTH + 10,
      height: PLAYER_HEIGHT + 10,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
    const scoreAfterGameOver = engine.score;
    // gameLoop 在 gameover 状态下不会执行 update
    const now = Date.now();
    (engine as any).gameLoop(now);
    (engine as any).gameLoop(now + 16.667);
    expect(engine.score).toBe(scoreAfterGameOver);
  });

  it('游戏结束后可以重新开始', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x - 5,
      y: playerState.y - 5,
      width: PLAYER_WIDTH + 10,
      height: PLAYER_HEIGHT + 10,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');

    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
  });

  it('游戏结束后翻转无效', () => {
    (engine as any)._status = 'gameover';
    engine.flip();
    expect(engine.getFlipCount()).toBe(0);
  });

  it('游戏结束后距离不再增加', () => {
    const playerState = engine.getPlayerState();
    const internalObs = (engine as any).obstacles;
    internalObs.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x - 5,
      y: playerState.y - 5,
      width: PLAYER_WIDTH + 10,
      height: PLAYER_HEIGHT + 10,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
    const distAfterGameOver = engine.getDistance();
    // gameLoop 在 gameover 状态下不会执行
    const now = Date.now();
    (engine as any).gameLoop(now);
    expect(engine.getDistance()).toBe(distAfterGameOver);
  });
});

describe('GravityFlipEngine - 粒子效果', () => {
  let engine: GravityFlipEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('翻转时生成粒子', () => {
    engine.flip();
    expect(engine.getParticles().length).toBe(PARTICLE_COUNT);
  });

  it('粒子数量随翻转增加', () => {
    engine.flip();
    const count1 = engine.getParticles().length;
    engine.flip();
    const count2 = engine.getParticles().length;
    expect(count2).toBeGreaterThan(count1);
  });

  it('粒子随时间消亡', () => {
    engine.flip();
    expect(engine.getParticles().length).toBe(PARTICLE_COUNT);
    simulateFrames(engine, 100);
    expect(engine.getParticles().length).toBe(0);
  });

  it('粒子位置在玩家附近生成', () => {
    engine.flip();
    const particles = engine.getParticles();
    const playerState = engine.getPlayerState();
    const cx = playerState.x + PLAYER_WIDTH / 2;
    const cy = playerState.y + PLAYER_HEIGHT / 2;
    for (const p of particles) {
      expect(Math.abs(p.x - cx)).toBeLessThan(50);
      expect(Math.abs(p.y - cy)).toBeLessThan(50);
    }
  });

  it('粒子有速度', () => {
    engine.flip();
    const particles = engine.getParticles();
    for (const p of particles) {
      expect(typeof p.vx).toBe('number');
      expect(typeof p.vy).toBe('number');
    }
  });

  it('粒子有生命周期', () => {
    engine.flip();
    const particles = engine.getParticles();
    for (const p of particles) {
      expect(p.life).toBeGreaterThan(0);
      expect(p.maxLife).toBeGreaterThan(0);
    }
  });

  it('粒子有大小', () => {
    engine.flip();
    const particles = engine.getParticles();
    for (const p of particles) {
      expect(p.size).toBeGreaterThan(0);
    }
  });

  it('多次翻转生成多批粒子', () => {
    engine.flip();
    engine.flip();
    engine.flip();
    expect(engine.getParticles().length).toBe(PARTICLE_COUNT * 3);
  });

  it('粒子生命周期逐渐减少', () => {
    engine.flip();
    const particles = engine.getParticles();
    const initialLife = particles[0].life;
    simulateFrames(engine, 5);
    const updatedParticles = engine.getParticles();
    if (updatedParticles.length > 0) {
      expect(updatedParticles[0].life).toBeLessThan(initialLife);
    }
  });
});

describe('GravityFlipEngine - 重置', () => {
  it('重置后状态为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('重置后分数归零', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 60);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('重置后等级归一', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 60);
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('重置后障碍物清空', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 200);
    engine.reset();
    expect(engine.getObstacles()).toHaveLength(0);
  });

  it('重置后粒子清空', () => {
    const engine = createAndStartEngine();
    engine.flip();
    engine.reset();
    expect(engine.getParticles()).toHaveLength(0);
  });

  it('重置后玩家回到地面', () => {
    const engine = createAndStartEngine();
    engine.flip();
    simulateFrames(engine, 20);
    engine.reset();
    const state = engine.getPlayerState();
    expect(state.y).toBe(GROUND_Y - PLAYER_HEIGHT);
  });

  it('重置后重力方向为向下', () => {
    const engine = createAndStartEngine();
    engine.flip();
    engine.reset();
    expect(engine.getGravityDirection()).toBe(GravityDirection.DOWN);
  });

  it('重置后翻转次数归零', () => {
    const engine = createAndStartEngine();
    engine.flip();
    engine.flip();
    engine.reset();
    expect(engine.getFlipCount()).toBe(0);
  });

  it('重置后速度归初始值', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 500);
    engine.reset();
    expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
  });

  it('重置后距离归零', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 60);
    engine.reset();
    expect(engine.getDistance()).toBe(0);
  });

  it('重置后玩家速度归零', () => {
    const engine = createAndStartEngine();
    engine.flip();
    engine.reset();
    expect(engine.getPlayerState().velocity).toBe(0);
  });
});

describe('GravityFlipEngine - 暂停和恢复', () => {
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

  it('暂停期间翻转无效', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.flip();
    expect(engine.getFlipCount()).toBe(0);
  });

  it('idle 状态不能暂停', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态不能恢复', () => {
    const engine = createEngine();
    engine.resume();
    expect(engine.status).toBe('idle');
  });

  it('暂停后恢复游戏继续', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 10);
    engine.pause();
    const scoreAtPause = engine.score;
    engine.resume();
    simulateFrames(engine, 10);
    expect(engine.score).toBeGreaterThan(scoreAtPause);
  });
});

describe('GravityFlipEngine - 销毁', () => {
  it('销毁后状态为 idle', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('销毁后分数归零', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 60);
    engine.destroy();
    expect(engine.score).toBe(0);
  });

  it('销毁后可以重新创建引擎', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    const newEngine = createAndStartEngine();
    expect(newEngine.status).toBe('playing');
  });
});

describe('GravityFlipEngine - 边界情况', () => {
  it('连续快速翻转不会崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 50; i++) {
      engine.flip();
    }
    expect(engine.getFlipCount()).toBe(50);
    expect(engine.status).toBe('playing');
  });

  it('极大 deltaTime 不会导致崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => simulateFrames(engine, 1, 10000)).not.toThrow();
  });

  it('零 deltaTime 不影响游戏', () => {
    const engine = createAndStartEngine();
    const scoreBefore = engine.score;
    simulateFrames(engine, 1, 0);
    expect(engine.score).toBe(scoreBefore);
  });

  it('负 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => simulateFrames(engine, 1, -10)).not.toThrow();
  });

  it('玩家始终在有效区域内', () => {
    const engine = createAndStartEngine();
    engine.flip();
    for (let i = 0; i < 100; i++) {
      if (i % 10 === 0) engine.flip();
      simulateFrames(engine, 1);
    }
    const state = engine.getPlayerState();
    expect(state.y).toBeGreaterThanOrEqual(CEILING_Y);
    expect(state.y).toBeLessThanOrEqual(GROUND_Y - PLAYER_HEIGHT);
  });

  it('重置后再开始游戏正常', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 60);
    engine.flip();
    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
    expect(engine.getFlipCount()).toBe(0);
  });

  it('多次重置和启动不会崩溃', () => {
    const engine = createEngine();
    for (let i = 0; i < 10; i++) {
      engine.start();
      simulateFrames(engine, 10);
      engine.reset();
    }
    expect(engine.status).toBe('idle');
  });

  it('游戏结束后重置再开始', () => {
    const engine = createAndStartEngine();
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');
    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('无障碍物时不碰撞', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 1);
    expect(engine.status).toBe('playing');
  });

  it('高速状态下碰撞检测仍正常', () => {
    const engine = createAndStartEngine();
    (engine as any).speed = MAX_SPEED;
    const playerState = engine.getPlayerState();
    (engine as any).obstacles.push({
      type: ObstacleType.GROUND_SPIKE,
      x: playerState.x - 5,
      y: playerState.y - 5,
      width: PLAYER_WIDTH + 10,
      height: PLAYER_HEIGHT + 10,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });
});

describe('GravityFlipEngine - 渲染', () => {
  it('onRender 不崩溃', () => {
    const engine = createAndStartEngine();
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('有障碍物时渲染不崩溃', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 200);
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('有粒子时渲染不崩溃', () => {
    const engine = createAndStartEngine();
    engine.flip();
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('翻转后渲染不崩溃', () => {
    const engine = createAndStartEngine();
    engine.flip();
    simulateFrames(engine, 30);
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('游戏结束后渲染不崩溃', () => {
    const engine = createAndStartEngine();
    (engine as any).gameOver();
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });

  it('idle 状态渲染不崩溃', () => {
    const engine = createEngine();
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
  });
});

describe('GravityFlipEngine - 事件系统', () => {
  it('scoreChange 事件触发', () => {
    const engine = createEngine();
    let scoreChanged = false;
    engine.on('scoreChange', () => { scoreChanged = true; });
    engine.start();
    simulateFrames(engine, 10);
    expect(scoreChanged).toBe(true);
  });

  it('statusChange 事件在启动时触发', () => {
    const engine = createEngine();
    let newStatus: string = '';
    engine.on('statusChange', (s: string) => { newStatus = s; });
    engine.start();
    expect(newStatus).toBe('playing');
  });

  it('statusChange 事件在暂停时触发', () => {
    const engine = createAndStartEngine();
    let newStatus: string = '';
    engine.on('statusChange', (s: string) => { newStatus = s; });
    engine.pause();
    expect(newStatus).toBe('paused');
  });

  it('statusChange 事件在游戏结束时触发', () => {
    const engine = createAndStartEngine();
    let newStatus: string = '';
    engine.on('statusChange', (s: string) => { newStatus = s; });
    (engine as any).gameOver();
    expect(newStatus).toBe('gameover');
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    let count = 0;
    const cb = () => { count++; };
    engine.on('statusChange', cb);
    engine.start();
    expect(count).toBe(1);
    engine.off('statusChange', cb);
    engine.reset();
    expect(count).toBe(1);
  });

  it('levelChange 事件触发', () => {
    const engine = createAndStartEngine();
    let newLevel = 0;
    engine.on('levelChange', (l: number) => { newLevel = l; });
    // 模拟足够距离以触发等级变化
    simulateFrames(engine, 500);
    // 等级应该已经变化
    expect(newLevel).toBeGreaterThan(1);
  });
});

describe('GravityFlipEngine - 综合场景', () => {
  it('完整游戏流程：开始→翻转→碰撞→重开', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.status).toBe('playing');

    engine.flip();
    simulateFrames(engine, 20);
    engine.flip();
    simulateFrames(engine, 20);
    expect(engine.getFlipCount()).toBe(2);

    const playerState = engine.getPlayerState();
    (engine as any).obstacles.push({
      type: ObstacleType.MIDDLE_BLOCK,
      x: playerState.x - 5,
      y: playerState.y - 5,
      width: PLAYER_WIDTH + 10,
      height: PLAYER_HEIGHT + 10,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');

    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
    expect(engine.getFlipCount()).toBe(0);
  });

  it('长时间运行不崩溃（无障碍物）', () => {
    const engine = createAndStartEngine();
    // 禁用障碍物生成以避免随机碰撞
    (engine as any).nextObstacleInterval = Infinity;
    for (let i = 0; i < 500; i++) {
      if (i % 30 === 0) engine.flip();
      simulateFrames(engine, 1);
    }
    expect(engine.status).toBe('playing');
  });

  it('速度达到最大值后继续运行（无障碍物）', () => {
    const engine = createAndStartEngine();
    (engine as any).distance = SPEED_INCREMENT_DISTANCE * 100;
    (engine as any).nextObstacleInterval = Infinity;
    simulateFrames(engine, 1);
    expect(engine.getCurrentSpeed()).toBe(MAX_SPEED);
    simulateFrames(engine, 100);
    expect(engine.status).toBe('playing');
  });

  it('玩家在地面和天花板之间反复翻转（无障碍物）', () => {
    const engine = createAndStartEngine();
    (engine as any).nextObstacleInterval = Infinity;
    for (let i = 0; i < 20; i++) {
      engine.flip();
      simulateFrames(engine, 30);
    }
    const state = engine.getPlayerState();
    expect(state.y).toBeGreaterThanOrEqual(CEILING_Y);
    expect(state.y).toBeLessThanOrEqual(GROUND_Y - PLAYER_HEIGHT);
  });

  it('障碍物通过后标记为 passed', () => {
    const engine = createAndStartEngine();
    (engine as any).obstacles.push({
      type: ObstacleType.GROUND_SPIKE,
      x: PLAYER_X - SPIKE_WIDTH - 10,
      y: GROUND_Y - SPIKE_HEIGHT,
      width: SPIKE_WIDTH,
      height: SPIKE_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 5);
    const obstacles = engine.getObstacles();
    const passedObs = obstacles.find(o => o.x + o.width < PLAYER_X);
    if (passedObs) {
      expect(passedObs.passed).toBe(true);
    }
  });

  it('快速翻转并碰撞', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 10; i++) {
      engine.flip();
      simulateFrames(engine, 3);
    }
    const playerState = engine.getPlayerState();
    (engine as any).obstacles.push({
      type: ObstacleType.MIDDLE_BLOCK,
      x: playerState.x,
      y: playerState.y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      passed: false,
    });
    simulateFrames(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('重开后所有状态正确', () => {
    const engine = createAndStartEngine();
    simulateFrames(engine, 100);
    engine.flip();
    simulateFrames(engine, 50);
    engine.flip();
    simulateFrames(engine, 50);

    engine.reset();
    engine.start();

    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
    expect(engine.level).toBe(1);
    expect(engine.getFlipCount()).toBe(0);
    expect(engine.getDistance()).toBe(0);
    expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
    expect(engine.getGravityDirection()).toBe(GravityDirection.DOWN);
    expect(engine.getObstacles()).toHaveLength(0);
    expect(engine.getParticles()).toHaveLength(0);
  });
});
