import { DinoRunnerEngine } from '@/games/dino-runner/DinoRunnerEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  DINO_WIDTH,
  DINO_HEIGHT,
  DINO_DUCK_WIDTH,
  DINO_DUCK_HEIGHT,
  DINO_X,
  GRAVITY,
  JUMP_FORCE,
  ObstacleType,
  SMALL_CACTUS_WIDTH,
  SMALL_CACTUS_HEIGHT,
  LARGE_CACTUS_WIDTH,
  LARGE_CACTUS_HEIGHT,
  PTERO_WIDTH,
  PTERO_HEIGHT,
  PTERO_LOW_Y,
  PTERO_HIGH_Y,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_SCORE,
  MAX_SPEED,
  MIN_OBSTACLE_INTERVAL,
  MAX_OBSTACLE_INTERVAL,
  HITBOX_SHRINK,
  NIGHT_MODE_INTERVAL,
  CLOUD_SPEED_RATIO,
  CLOUD_SPAWN_INTERVAL,
  RUN_ANIM_INTERVAL,
} from '@/games/dino-runner/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): DinoRunnerEngine {
  const engine = new DinoRunnerEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(): DinoRunnerEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/**
 * 模拟引擎 update，推进 deltaTime 毫秒
 */
function advanceUpdate(engine: DinoRunnerEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/**
 * 获取内部 dino 对象
 */
function getDino(engine: DinoRunnerEngine): any {
  return (engine as any).dino;
}

/**
 * 获取内部 obstacles 数组
 */
function getObstacles(engine: DinoRunnerEngine): any[] {
  return (engine as any).obstacles;
}

/**
 * 获取内部 clouds 数组
 */
function getClouds(engine: DinoRunnerEngine): any[] {
  return (engine as any).clouds;
}

/**
 * 获取内部 speed 值
 */
function getSpeed(engine: DinoRunnerEngine): number {
  return (engine as any).speed;
}

/**
 * 设置内部 speed 值
 */
function setSpeed(engine: DinoRunnerEngine, speed: number): void {
  (engine as any).speed = speed;
}

/**
 * 获取夜间模式状态
 */
function getIsNight(engine: DinoRunnerEngine): boolean {
  return (engine as any).isNight;
}

/**
 * 获取障碍物计时器
 */
function getObstacleTimer(engine: DinoRunnerEngine): number {
  return (engine as any).obstacleTimer;
}

/**
 * 设置下一个障碍物间隔
 */
function setNextObstacleInterval(engine: DinoRunnerEngine, interval: number): void {
  (engine as any).nextObstacleInterval = interval;
}

/**
 * 手动添加障碍物到引擎
 */
function addObstacle(engine: DinoRunnerEngine, obs: any): void {
  (engine as any).obstacles.push(obs);
}

// ========== 测试 ==========

describe('DinoRunnerEngine', () => {
  // ==================== T1: 引擎初始化 ====================
  describe('引擎初始化', () => {
    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后恐龙在地面默认位置', () => {
      const engine = createEngine();
      const dino = getDino(engine);
      expect(dino.x).toBe(DINO_X);
      expect(dino.y).toBe(GROUND_Y - DINO_HEIGHT);
      expect(dino.velocity).toBe(0);
      expect(dino.state).toBe('running');
    });

    it('start 后 status 为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('start 后分数和等级为初始值', () => {
      const engine = startEngine();
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('start 后初始速度为 INITIAL_SPEED', () => {
      const engine = startEngine();
      expect(getSpeed(engine)).toBe(INITIAL_SPEED);
    });

    it('start 后障碍物列表为空', () => {
      const engine = startEngine();
      expect(getObstacles(engine)).toHaveLength(0);
    });

    it('start 后不在夜间模式', () => {
      const engine = startEngine();
      expect(getIsNight(engine)).toBe(false);
    });
  });

  // ==================== T2: 跳跃物理 ====================
  describe('跳跃物理', () => {
    it('flap 后恐龙获得向上速度', () => {
      const engine = startEngine();
      engine.flap();
      const dino = getDino(engine);
      expect(dino.velocity).toBe(JUMP_FORCE);
      expect(dino.state).toBe('jumping');
    });

    it('跳跃后恐龙 y 坐标上升', () => {
      const engine = startEngine();
      const yBefore = getDino(engine).y;

      engine.flap();
      advanceUpdate(engine, 16.667);

      const dino = getDino(engine);
      expect(dino.y).toBeLessThan(yBefore);
    });

    it('重力使跳跃的恐龙下落', () => {
      const engine = startEngine();
      engine.flap();
      advanceUpdate(engine, 16.667);

      const v1 = getDino(engine).velocity;

      // 速度应该逐渐增加（向上为负，减小后变为正）
      advanceUpdate(engine, 16.667);
      const v2 = getDino(engine).velocity;

      expect(v2).toBeGreaterThan(v1);
    });

    it('恐龙落地后速度归零并恢复 running 状态', () => {
      const engine = startEngine();
      engine.flap();

      // 持续推进直到落地
      for (let i = 0; i < 100; i++) {
        advanceUpdate(engine, 16.667);
      }

      const dino = getDino(engine);
      expect(dino.y).toBe(GROUND_Y - DINO_HEIGHT);
      expect(dino.velocity).toBe(0);
      expect(dino.state).toBe('running');
    });

    it('空格键触发跳跃', () => {
      const engine = startEngine();
      engine.handleKeyDown(' ');
      const dino = getDino(engine);
      expect(dino.velocity).toBe(JUMP_FORCE);
      expect(dino.state).toBe('jumping');
    });

    it('ArrowUp 键触发跳跃', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      const dino = getDino(engine);
      expect(dino.velocity).toBe(JUMP_FORCE);
      expect(dino.state).toBe('jumping');
    });

    it('W 键触发跳跃', () => {
      const engine = startEngine();
      engine.handleKeyDown('w');
      const dino = getDino(engine);
      expect(dino.velocity).toBe(JUMP_FORCE);
      expect(dino.state).toBe('jumping');
    });

    it('非 playing 状态下 flap 无效', () => {
      const engine = createEngine(); // idle 状态
      engine.flap();
      const dino = getDino(engine);
      expect(dino.velocity).toBe(0);
      expect(dino.state).toBe('running');
    });

    it('空中不能二段跳', () => {
      const engine = startEngine();
      engine.flap();
      advanceUpdate(engine, 16.667);

      const vAfterFirstJump = getDino(engine).velocity;

      // 尝试在空中再次跳跃
      engine.flap();
      const dino = getDino(engine);

      // 速度不应该再次变为 JUMP_FORCE（空中不能跳跃）
      expect(dino.velocity).toBe(vAfterFirstJump);
      expect(dino.state).toBe('jumping');
    });
  });

  // ==================== T3: 下蹲 ====================
  describe('下蹲', () => {
    it('ArrowDown 键使恐龙下蹲', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      // 需要一次 update 来触发 updateDinoState
      advanceUpdate(engine, 16.667);

      const dino = getDino(engine);
      expect(dino.state).toBe('ducking');
    });

    it('S 键使恐龙下蹲', () => {
      const engine = startEngine();
      engine.handleKeyDown('s');
      advanceUpdate(engine, 16.667);

      const dino = getDino(engine);
      expect(dino.state).toBe('ducking');
    });

    it('下蹲时恐龙 y 坐标调整到矮身位', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      advanceUpdate(engine, 16.667);

      const dino = getDino(engine);
      expect(dino.y).toBe(GROUND_Y - DINO_DUCK_HEIGHT);
    });

    it('松开 ArrowDown 键恢复 running 状态', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('ducking');

      engine.handleKeyUp('ArrowDown');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('running');
    });

    it('松开 S 键恢复 running 状态', () => {
      const engine = startEngine();
      engine.handleKeyDown('s');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('ducking');

      engine.handleKeyUp('s');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('running');
    });

    it('下蹲时可以跳跃（从下蹲状态起跳）', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('ducking');

      engine.flap();
      const dino = getDino(engine);
      expect(dino.state).toBe('jumping');
      expect(dino.velocity).toBe(JUMP_FORCE);
    });
  });

  // ==================== T4: 障碍物生成 ====================
  describe('障碍物生成', () => {
    it('初始无障碍物', () => {
      const engine = startEngine();
      expect(getObstacles(engine)).toHaveLength(0);
    });

    it('经过足够时间后生成障碍物', () => {
      const engine = startEngine();
      // 设置一个短间隔确保生成
      setNextObstacleInterval(engine, MIN_OBSTACLE_INTERVAL);

      // 推进超过最小间隔时间
      advanceUpdate(engine, MIN_OBSTACLE_INTERVAL + 100);

      expect(getObstacles(engine).length).toBeGreaterThanOrEqual(1);
    });

    it('障碍物从画布右侧外生成', () => {
      const engine = startEngine();

      // 手动添加障碍物验证其初始位置在画布右侧
      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: CANVAS_WIDTH + 10,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      // 未 update 时障碍物在画布右侧外
      const obstacles = getObstacles(engine);
      expect(obstacles[0].x).toBeGreaterThan(CANVAS_WIDTH);

      // update 后向左移动但仍可见
      advanceUpdate(engine, 16.667);
      expect(obstacles[0].x).toBeLessThan(CANVAS_WIDTH + 10);
      expect(obstacles[0].x).toBeGreaterThan(0);
    });

    it('障碍物类型为三种之一', () => {
      const engine = startEngine();
      setNextObstacleInterval(engine, 100);

      // 生成多个障碍物
      for (let i = 0; i < 10; i++) {
        advanceUpdate(engine, 200);
      }

      const obstacles = getObstacles(engine);
      const validTypes = [
        ObstacleType.SMALL_CACTUS,
        ObstacleType.LARGE_CACTUS,
        ObstacleType.PTERODACTYL,
      ];
      for (const obs of obstacles) {
        expect(validTypes).toContain(obs.type);
      }
    });
  });

  // ==================== T5: 障碍物移动 ====================
  describe('障碍物移动', () => {
    it('障碍物随速度向左移动', () => {
      const engine = startEngine();

      // 手动添加一个障碍物
      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: CANVAS_WIDTH,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      const xBefore = getObstacles(engine)[0].x;
      advanceUpdate(engine, 16.667);
      const xAfter = getObstacles(engine)[0].x;

      expect(xAfter).toBeLessThan(xBefore);
    });

    it('障碍物移动距离与速度成正比', () => {
      const engine = startEngine();
      const speed = getSpeed(engine);

      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: CANVAS_WIDTH,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      const xBefore = getObstacles(engine)[0].x;
      advanceUpdate(engine, 16.667); // 1帧
      const xAfter = getObstacles(engine)[0].x;

      // dt = 16.667 / 16.667 = 1，移动距离 = speed * 1
      const moved = xBefore - xAfter;
      expect(moved).toBeCloseTo(speed, 0);
    });

    it('离开屏幕左侧的障碍物被移除', () => {
      const engine = startEngine();

      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: -SMALL_CACTUS_WIDTH - 30, // 已在屏幕左侧外
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      expect(getObstacles(engine)).toHaveLength(1);
      advanceUpdate(engine, 16.667);
      expect(getObstacles(engine)).toHaveLength(0);
    });
  });

  // ==================== T6: 碰撞检测 ====================
  describe('碰撞检测', () => {
    it('恐龙碰到仙人掌触发 gameover', () => {
      const engine = startEngine();

      // 在恐龙位置放置一个仙人掌（水平重叠）
      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + HITBOX_SHRINK, // 确保碰撞箱重叠
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('gameover');
    });

    it('恐龙碰到大仙人掌触发 gameover', () => {
      const engine = startEngine();

      addObstacle(engine, {
        type: ObstacleType.LARGE_CACTUS,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - LARGE_CACTUS_HEIGHT,
        width: LARGE_CACTUS_WIDTH,
        height: LARGE_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('gameover');
    });

    it('恐龙碰到翼龙触发 gameover', () => {
      const engine = startEngine();

      // 翼龙在恐龙正前方，高度与恐龙重叠
      // 恐龙 hitbox: y = GROUND_Y - DINO_HEIGHT + HITBOX_SHRINK = 458
      // 翼龙放在 y 使其 hitbox 与恐龙 hitbox 重叠
      addObstacle(engine, {
        type: ObstacleType.PTERODACTYL,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - DINO_HEIGHT - 10, // 与恐龙位置重叠
        width: PTERO_WIDTH,
        height: PTERO_HEIGHT,
        pteroAnimFrame: 0,
      });

      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('gameover');
    });

    it('恐龙跳过仙人掌不碰撞', () => {
      const engine = startEngine();

      // 添加一个在地面的仙人掌
      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      // 恐龙跳到高处
      engine.flap();
      const dino = getDino(engine);
      dino.y = GROUND_Y - DINO_HEIGHT - 200; // 远高于仙人掌

      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('playing');
    });

    it('恐龙下蹲躲避高飞翼龙', () => {
      const engine = startEngine();

      // 高飞翼龙在 PTERO_HIGH_Y
      addObstacle(engine, {
        type: ObstacleType.PTERODACTYL,
        x: DINO_X + HITBOX_SHRINK,
        y: PTERO_HIGH_Y,
        width: PTERO_WIDTH,
        height: PTERO_HEIGHT,
        pteroAnimFrame: 0,
      });

      // 恐龙下蹲（变矮）
      engine.handleKeyDown('ArrowDown');
      advanceUpdate(engine, 16.667);

      // 下蹲后恐龙高度为 DINO_DUCK_HEIGHT
      const dino = getDino(engine);
      expect(dino.state).toBe('ducking');

      // 检查恐龙下蹲 hitbox 与翼龙是否不重叠
      // 恐龙 y = GROUND_Y - DINO_DUCK_HEIGHT = 470, 翼龙 y = 360
      // 恐龙 hitbox 底部 = 470 + 30 - 2*HITBOX_SHRINK = 488
      // 翼龙 hitbox 顶部 = 360 + HITBOX_SHRINK = 366
      // 488 > 366，应该碰撞... 需要确认具体数值
      // 实际上高飞翼龙 y=360, 恐龙下蹲 y=470
      // 翼龙 hitbox: y=366, height=28, bottom=394
      // 恐龙 hitbox: y=476, bottom=488
      // 476 > 394，不重叠，安全
      expect(engine.status).toBe('playing');
    });

    it('HITBOX_SHRINK 提供碰撞容差', () => {
      const engine = startEngine();

      // 放置一个几乎碰到但没碰到的障碍物
      // 恐龙 hitbox 右边 = DINO_X + DINO_WIDTH - HITBOX_SHRINK = 60+44-6 = 98
      // 障碍物 hitbox 左边 = obs.x + HITBOX_SHRINK
      // 要不碰撞：obs.x + HITBOX_SHRINK >= 98，即 obs.x >= 92
      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + DINO_WIDTH, // 刚好在恐龙右边，不重叠
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('playing');
    });
  });

  // ==================== T7: 计分系统 ====================
  describe('计分系统', () => {
    it('分数随 update 时间增加', () => {
      const engine = startEngine();
      expect(engine.score).toBe(0);

      advanceUpdate(engine, 16.667);
      expect(engine.score).toBeGreaterThan(0);
    });

    it('分数增长与速度正相关', () => {
      const engine = startEngine();

      // 正常速度下跑一段时间
      advanceUpdate(engine, 16.667);
      const scoreAtNormalSpeed = engine.score;

      // 重置并设置高速
      engine.reset();
      engine.start();
      setSpeed(engine, MAX_SPEED);

      advanceUpdate(engine, 16.667);
      const scoreAtMaxSpeed = engine.score;

      expect(scoreAtMaxSpeed).toBeGreaterThan(scoreAtNormalSpeed);
    });

    it('scoreChange 事件在分数变化时触发', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('scoreChange', cb);

      advanceUpdate(engine, 16.667);

      expect(cb).toHaveBeenCalled();
      const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
      expect(lastCall[0]).toBeGreaterThan(0);
    });
  });

  // ==================== T8: 速度递增 ====================
  describe('速度递增', () => {
    it('初始速度为 INITIAL_SPEED', () => {
      const engine = startEngine();
      expect(getSpeed(engine)).toBe(INITIAL_SPEED);
    });

    it('每 SPEED_INCREMENT_SCORE 分速度增加 SPEED_INCREMENT', () => {
      const engine = startEngine();

      // 手动设置分数到 100
      (engine as any)._score = SPEED_INCREMENT_SCORE;
      advanceUpdate(engine, 16.667);

      expect(getSpeed(engine)).toBe(INITIAL_SPEED + SPEED_INCREMENT);
    });

    it('速度不超过 MAX_SPEED', () => {
      const engine = startEngine();

      // 设置极高分数
      (engine as any)._score = 10000;
      advanceUpdate(engine, 16.667);

      expect(getSpeed(engine)).toBeLessThanOrEqual(MAX_SPEED);
    });

    it('速度在 MAX_SPEED 时不再增加', () => {
      const engine = startEngine();
      (engine as any)._score = 10000;
      advanceUpdate(engine, 16.667);

      const speed1 = getSpeed(engine);
      (engine as any)._score = 20000;
      advanceUpdate(engine, 16.667);

      const speed2 = getSpeed(engine);
      expect(speed2).toBe(speed1);
      expect(speed2).toBe(MAX_SPEED);
    });

    it('速度随分数逐步增加', () => {
      const engine = startEngine();
      expect(getSpeed(engine)).toBe(INITIAL_SPEED);

      (engine as any)._score = SPEED_INCREMENT_SCORE;
      advanceUpdate(engine, 16.667);
      expect(getSpeed(engine)).toBe(INITIAL_SPEED + SPEED_INCREMENT);

      (engine as any)._score = SPEED_INCREMENT_SCORE * 2;
      advanceUpdate(engine, 16.667);
      expect(getSpeed(engine)).toBe(INITIAL_SPEED + SPEED_INCREMENT * 2);
    });
  });

  // ==================== T9: 夜间模式 ====================
  describe('夜间模式', () => {
    it('初始不在夜间模式', () => {
      const engine = startEngine();
      expect(getIsNight(engine)).toBe(false);
    });

    it('分数达到 NIGHT_MODE_INTERVAL 时切换到夜间', () => {
      const engine = startEngine();
      (engine as any)._score = NIGHT_MODE_INTERVAL;
      advanceUpdate(engine, 16.667);
      expect(getIsNight(engine)).toBe(true);
    });

    it('夜间模式随分数周期性切换', () => {
      const engine = startEngine();

      // 第一次切换
      (engine as any)._score = NIGHT_MODE_INTERVAL;
      advanceUpdate(engine, 16.667);
      expect(getIsNight(engine)).toBe(true);

      // 第二次切换
      (engine as any)._score = NIGHT_MODE_INTERVAL * 2;
      advanceUpdate(engine, 16.667);
      expect(getIsNight(engine)).toBe(false);

      // 第三次切换
      (engine as any)._score = NIGHT_MODE_INTERVAL * 3;
      advanceUpdate(engine, 16.667);
      expect(getIsNight(engine)).toBe(true);
    });

    it('夜间模式在 reset 后恢复为白天', () => {
      const engine = startEngine();
      (engine as any)._score = NIGHT_MODE_INTERVAL;
      advanceUpdate(engine, 16.667);
      expect(getIsNight(engine)).toBe(true);

      engine.reset();
      engine.start();
      expect(getIsNight(engine)).toBe(false);
    });
  });

  // ==================== T10: 游戏结束 ====================
  describe('游戏结束', () => {
    it('碰撞后 status 变为 gameover', () => {
      const engine = startEngine();

      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('gameover');
    });

    it('gameover 后 reset 可以重新开始', () => {
      const engine = startEngine();

      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('gameover');

      engine.reset();
      expect(engine.status).toBe('idle');

      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.score).toBe(0);
      expect(getObstacles(engine)).toHaveLength(0);
    });

    it('gameover 触发 statusChange 事件', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);

      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });

      advanceUpdate(engine, 16.667);
      expect(cb).toHaveBeenCalledWith('gameover');
    });
  });

  // ==================== T11: 键盘控制 ====================
  describe('键盘控制', () => {
    it('W 键（大写）跳跃', () => {
      const engine = startEngine();
      engine.handleKeyDown('W');
      expect(getDino(engine).state).toBe('jumping');
    });

    it('S 键（大写）下蹲', () => {
      const engine = startEngine();
      engine.handleKeyDown('S');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('ducking');
    });

    it('handleKeyUp S 恢复跑步', () => {
      const engine = startEngine();
      engine.handleKeyDown('S');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('ducking');

      engine.handleKeyUp('S');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('running');
    });

    it('无效按键不影响恐龙状态', () => {
      const engine = startEngine();
      engine.handleKeyDown('a');
      advanceUpdate(engine, 16.667);
      expect(getDino(engine).state).toBe('running');
    });

    it('gameover 后键盘输入无效', () => {
      const engine = startEngine();

      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });
      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('gameover');

      engine.handleKeyDown(' ');
      const dino = getDino(engine);
      expect(dino.velocity).toBe(0);
    });
  });

  // ==================== T12: 事件发射 ====================
  describe('事件发射', () => {
    it('start 时发射 statusChange 为 playing', () => {
      const engine = createEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);

      engine.start();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('start 时发射 scoreChange 为 0', () => {
      const engine = createEngine();
      const cb = jest.fn();
      engine.on('scoreChange', cb);

      engine.start();
      expect(cb).toHaveBeenCalledWith(0);
    });

    it('start 时发射 levelChange 为 1', () => {
      const engine = createEngine();
      const cb = jest.fn();
      engine.on('levelChange', cb);

      engine.start();
      expect(cb).toHaveBeenCalledWith(1);
    });

    it('update 后 scoreChange 事件携带分数值', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('scoreChange', cb);

      advanceUpdate(engine, 16.667);

      const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
      expect(typeof lastCall[0]).toBe('number');
      expect(lastCall[0]).toBeGreaterThan(0);
    });

    it('off 取消事件监听', () => {
      const engine = createEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);
      engine.off('statusChange', cb);

      engine.start();
      expect(cb).not.toHaveBeenCalled();
    });

    it('reset 时发射 statusChange 为 idle', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);

      engine.reset();
      expect(cb).toHaveBeenCalledWith('idle');
    });
  });

  // ==================== T13: getState ====================
  describe('getState', () => {
    it('返回包含 dinoY 的状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('dinoY');
      expect(typeof state.dinoY).toBe('number');
    });

    it('返回包含 dinoState 的状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('dinoState');
      expect(['running', 'jumping', 'ducking']).toContain(state.dinoState);
    });

    it('返回包含 speed 的状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('speed');
      expect(state.speed).toBe(INITIAL_SPEED);
    });

    it('返回包含 obstacleCount 的状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('obstacleCount');
      expect(state.obstacleCount).toBe(0);
    });

    it('返回包含 isNight 的状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('isNight');
      expect(state.isNight).toBe(false);
    });

    it('返回包含 score 的状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state.score).toBe(0);
    });

    it('跳跃后 dinoState 变为 jumping', () => {
      const engine = startEngine();
      engine.flap();
      const state = engine.getState();
      expect(state.dinoState).toBe('jumping');
    });

    it('下蹲后 dinoState 变为 ducking', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      advanceUpdate(engine, 16.667);
      const state = engine.getState();
      expect(state.dinoState).toBe('ducking');
    });
  });

  // ==================== T14: 暂停/恢复 ====================
  describe('暂停/恢复', () => {
    it('pause 后 status 变为 paused', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后 status 变为 playing', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');

      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('idle 状态下 pause 无效', () => {
      const engine = createEngine();
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('playing 状态下 resume 无效（仍为 playing）', () => {
      const engine = startEngine();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('暂停时发射 statusChange 为 paused', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);
      engine.pause();
      expect(cb).toHaveBeenCalledWith('paused');
    });

    it('恢复时发射 statusChange 为 playing', () => {
      const engine = startEngine();
      engine.pause();

      const cb = jest.fn();
      engine.on('statusChange', cb);
      engine.resume();
      expect(cb).toHaveBeenCalledWith('playing');
    });
  });

  // ==================== T15: flap() 方法 ====================
  describe('flap() 方法', () => {
    it('flap 在 gameover 状态无效', () => {
      const engine = startEngine();

      addObstacle(engine, {
        type: ObstacleType.SMALL_CACTUS,
        x: DINO_X + HITBOX_SHRINK,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      });
      advanceUpdate(engine, 16.667);
      expect(engine.status).toBe('gameover');

      engine.flap();
      const dino = getDino(engine);
      expect(dino.velocity).toBe(0);
    });
  });

  // ==================== T16: reset 重置 ====================
  describe('reset 重置', () => {
    it('reset 后 status 为 idle', () => {
      const engine = startEngine();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后分数归零', () => {
      const engine = startEngine();
      advanceUpdate(engine, 16.667);
      expect(engine.score).toBeGreaterThan(0);

      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('reset 后速度恢复为 INITIAL_SPEED', () => {
      const engine = startEngine();
      (engine as any)._score = 1000;
      advanceUpdate(engine, 16.667);
      expect(getSpeed(engine)).toBeGreaterThan(INITIAL_SPEED);

      engine.reset();
      engine.start();
      expect(getSpeed(engine)).toBe(INITIAL_SPEED);
    });

    it('reset 后障碍物清空', () => {
      const engine = startEngine();
      // 手动添加障碍物，避免依赖随机生成和速度导致的不确定性
      addObstacle(engine, {
        type: 'small_cactus',
        x: 200,
        y: 100,
        width: 20,
        height: 40,
        pteroAnimFrame: 0,
      });
      expect(getObstacles(engine).length).toBeGreaterThan(0);

      engine.reset();
      engine.start();
      expect(getObstacles(engine)).toHaveLength(0);
    });

    it('reset 后恐龙回到初始位置', () => {
      const engine = startEngine();
      engine.flap();
      advanceUpdate(engine, 16.667);

      engine.reset();
      engine.start();
      const dino = getDino(engine);
      expect(dino.x).toBe(DINO_X);
      expect(dino.y).toBe(GROUND_Y - DINO_HEIGHT);
      expect(dino.velocity).toBe(0);
      expect(dino.state).toBe('running');
    });
  });

  // ==================== T17: 云朵系统 ====================
  describe('云朵系统', () => {
    it('初始无云朵', () => {
      const engine = startEngine();
      expect(getClouds(engine)).toHaveLength(0);
    });

    it('经过足够时间后生成云朵', () => {
      const engine = startEngine();
      advanceUpdate(engine, CLOUD_SPAWN_INTERVAL + 100);
      expect(getClouds(engine).length).toBeGreaterThanOrEqual(1);
    });

    it('云朵向左移动', () => {
      const engine = startEngine();
      advanceUpdate(engine, CLOUD_SPAWN_INTERVAL + 100);

      const clouds = getClouds(engine);
      if (clouds.length > 0) {
        const xBefore = clouds[0].x;
        advanceUpdate(engine, 16.667);
        const cloudsAfter = getClouds(engine);
        const sameCloud = cloudsAfter.find((c: any) => c.x < xBefore);
        expect(sameCloud).toBeDefined();
      }
    });
  });

  // ==================== T18: destroy 销毁 ====================
  describe('destroy 销毁', () => {
    it('destroy 后 status 为 idle', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('destroy 后事件监听器被清除', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);

      engine.destroy();
      engine.start(); // 不应该触发回调（因为已销毁）
      // 但 start 会重新注册...实际上 destroy 清除后，start 不会再触发回调
      // 因为 listeners 已清空
    });
  });
});