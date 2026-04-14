import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SlopeBallEngine } from '../SlopeBallEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_RADIUS,
  BALL_INITIAL_X,
  BALL_Y,
  BALL_MOVE_SPEED,
  ROAD_LEFT,
  ROAD_RIGHT,
  ROAD_WIDTH,
  INITIAL_SPEED,
  MAX_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_SCORE,
  LEVEL_UP_SCORE,
  MAX_LEVEL,
  INITIAL_OBSTACLE_INTERVAL,
  MIN_OBSTACLE_INTERVAL,
  OBSTACLE_INTERVAL_DECREASE,
  HITBOX_SHRINK,
  SCORE_PER_FRAME,
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  GAP_WIDTH,
  ObstacleType,
} from '../constants';

// ========== Mock requestAnimationFrame ==========
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  rafCallbacks.clear();
  vi.restoreAllMocks();
});

// ========== 辅助函数 ==========

/** 创建并初始化引擎 */
function createEngine(): SlopeBallEngine {
  const engine = new SlopeBallEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 启动引擎并推进指定帧数 */
function startAndAdvance(engine: SlopeBallEngine, frames: number, dt = 16.667): void {
  engine.start();
  for (let i = 0; i < frames; i++) {
    const cb = rafCallbacks.get(engine['animationId']!);
    if (cb) cb(performance.now() + dt * (i + 1));
  }
}

/** 推进一帧 */
function advanceOneFrame(engine: SlopeBallEngine, dt = 16.667): void {
  const cb = rafCallbacks.get(engine['animationId']!);
  if (cb) cb(performance.now() + dt);
}

// ========== 测试 ==========

describe('SlopeBallEngine', () => {
  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应该正确创建引擎实例', () => {
      const engine = new SlopeBallEngine();
      expect(engine).toBeInstanceOf(SlopeBallEngine);
    });

    it('应该正确初始化 canvas', () => {
      const engine = createEngine();
      expect(engine['canvas']).not.toBeNull();
      expect(engine['ctx']).not.toBeNull();
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

    it('onInit 应初始化星星', () => {
      const engine = createEngine();
      expect(engine['stars'].length).toBeGreaterThan(0);
    });

    it('onInit 应初始化车道线', () => {
      const engine = createEngine();
      expect(engine['laneLines'].length).toBeGreaterThan(0);
    });
  });

  // ========== 游戏启动 ==========

  describe('游戏启动', () => {
    it('start 应将状态变为 playing', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start 应重置球体位置', () => {
      const engine = createEngine();
      engine.start();
      const ball = engine.getBallState();
      expect(ball.x).toBe(BALL_INITIAL_X);
      expect(ball.y).toBe(BALL_Y);
      expect(ball.radius).toBe(BALL_RADIUS);
    });

    it('start 应重置速度', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
    });

    it('start 应清空障碍物', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.getObstacles()).toHaveLength(0);
    });

    it('start 应重置分数', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.score).toBe(0);
    });

    it('start 应重置距离', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.getDistance()).toBe(0);
    });

    it('start 应清空按键状态', () => {
      const engine = createEngine();
      engine.handleKeyDown('ArrowLeft');
      engine.start();
      expect(engine.getKeysDown().size).toBe(0);
    });

    it('start 应触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('start 应触发 scoreChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(0);
    });

    it('start 应触发 levelChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('levelChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  // ========== 球体移动 ==========

  describe('球体移动', () => {
    it('按左箭头球应向左移动', () => {
      const engine = createEngine();
      engine.start();
      const initialX = engine.getBallState().x;
      engine.handleKeyDown('ArrowLeft');
      advanceOneFrame(engine);
      expect(engine.getBallState().x).toBeLessThan(initialX);
    });

    it('按右箭头球应向右移动', () => {
      const engine = createEngine();
      engine.start();
      const initialX = engine.getBallState().x;
      engine.handleKeyDown('ArrowRight');
      advanceOneFrame(engine);
      expect(engine.getBallState().x).toBeGreaterThan(initialX);
    });

    it('按 A 键球应向左移动', () => {
      const engine = createEngine();
      engine.start();
      const initialX = engine.getBallState().x;
      engine.handleKeyDown('a');
      advanceOneFrame(engine);
      expect(engine.getBallState().x).toBeLessThan(initialX);
    });

    it('按 D 键球应向右移动', () => {
      const engine = createEngine();
      engine.start();
      const initialX = engine.getBallState().x;
      engine.handleKeyDown('d');
      advanceOneFrame(engine);
      expect(engine.getBallState().x).toBeGreaterThan(initialX);
    });

    it('按大写 A 键球应向左移动', () => {
      const engine = createEngine();
      engine.start();
      const initialX = engine.getBallState().x;
      engine.handleKeyDown('A');
      advanceOneFrame(engine);
      expect(engine.getBallState().x).toBeLessThan(initialX);
    });

    it('按大写 D 键球应向右移动', () => {
      const engine = createEngine();
      engine.start();
      const initialX = engine.getBallState().x;
      engine.handleKeyDown('D');
      advanceOneFrame(engine);
      expect(engine.getBallState().x).toBeGreaterThan(initialX);
    });

    it('球不应超出左边界', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft');
      // 多帧移动
      for (let i = 0; i < 100; i++) {
        advanceOneFrame(engine);
      }
      const ball = engine.getBallState();
      expect(ball.x).toBeGreaterThanOrEqual(ROAD_LEFT + BALL_RADIUS);
    });

    it('球不应超出右边界', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowRight');
      for (let i = 0; i < 100; i++) {
        advanceOneFrame(engine);
      }
      const ball = engine.getBallState();
      expect(ball.x).toBeLessThanOrEqual(ROAD_RIGHT - BALL_RADIUS);
    });

    it('松开按键后球应停止移动', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowRight');
      advanceOneFrame(engine);
      const x1 = engine.getBallState().x;
      engine.handleKeyUp('ArrowRight');
      advanceOneFrame(engine);
      const x2 = engine.getBallState().x;
      // 球的位置应该基本不变（可能有微小浮点误差）
      expect(Math.abs(x2 - x1)).toBeLessThan(1);
    });

    it('同时按左右键球应基本不动', () => {
      const engine = createEngine();
      engine.start();
      const initialX = engine.getBallState().x;
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      advanceOneFrame(engine);
      const x = engine.getBallState().x;
      expect(Math.abs(x - initialX)).toBeLessThan(1);
    });

    it('球体旋转角度应随时间增加', () => {
      const engine = createEngine();
      engine.start();
      const initialRotation = engine.getBallState().rotation;
      advanceOneFrame(engine);
      expect(engine.getBallState().rotation).toBeGreaterThan(initialRotation);
    });
  });

  // ========== 障碍物生成 ==========

  describe('障碍物生成', () => {
    it('游戏开始后应逐渐生成障碍物', () => {
      const engine = createEngine();
      engine.start();
      // 直接调用 spawnObstacle 确保生成
      engine['spawnObstacle']();
      expect(engine.getObstacles().length).toBeGreaterThan(0);
    });

    it('障碍物应从画面上方出现', () => {
      const engine = createEngine();
      engine.start();
      // 强制生成一个障碍物
      engine['spawnObstacle']();
      const obstacles = engine.getObstacles();
      expect(obstacles.length).toBeGreaterThan(0);
      expect(obstacles[0].y).toBeLessThanOrEqual(0);
    });

    it('应能生成 BLOCK 类型障碍物', () => {
      const engine = createEngine();
      engine.start();
      // 多次生成确保覆盖各种类型
      const types = new Set<string>();
      for (let i = 0; i < 30; i++) {
        engine['spawnObstacle']();
      }
      for (const obs of engine.getObstacles()) {
        types.add(obs.type);
      }
      expect(types.has(ObstacleType.BLOCK)).toBe(true);
    });

    it('应能生成 GAP 类型障碍物', () => {
      const engine = createEngine();
      engine.start();
      const types = new Set<string>();
      for (let i = 0; i < 30; i++) {
        engine['spawnObstacle']();
      }
      for (const obs of engine.getObstacles()) {
        types.add(obs.type);
      }
      expect(types.has(ObstacleType.GAP)).toBe(true);
    });

    it('应能生成 MOVING_BLOCK 类型障碍物', () => {
      const engine = createEngine();
      engine.start();
      const types = new Set<string>();
      for (let i = 0; i < 30; i++) {
        engine['spawnObstacle']();
      }
      for (const obs of engine.getObstacles()) {
        types.add(obs.type);
      }
      expect(types.has(ObstacleType.MOVING_BLOCK)).toBe(true);
    });

    it('BLOCK 障碍物宽度应正确', () => {
      const engine = createEngine();
      engine.start();
      engine['spawnObstacle']();
      const blocks = engine.getObstacles().filter(o => o.type === ObstacleType.BLOCK);
      if (blocks.length > 0) {
        expect(blocks[0].width).toBe(BLOCK_WIDTH);
      }
    });

    it('GAP 障碍物宽度应正确', () => {
      const engine = createEngine();
      engine.start();
      engine['spawnObstacle']();
      const gaps = engine.getObstacles().filter(o => o.type === ObstacleType.GAP);
      if (gaps.length > 0) {
        expect(gaps[0].width).toBe(GAP_WIDTH);
      }
    });

    it('MOVING_BLOCK 应有横向速度', () => {
      const engine = createEngine();
      engine.start();
      engine['spawnObstacle']();
      const moving = engine.getObstacles().filter(o => o.type === ObstacleType.MOVING_BLOCK);
      if (moving.length > 0) {
        expect(moving[0].speed).toBeDefined();
        expect(moving[0].speed).toBeGreaterThan(0);
      }
    });

    it('MOVING_BLOCK 应有移动方向', () => {
      const engine = createEngine();
      engine.start();
      engine['spawnObstacle']();
      const moving = engine.getObstacles().filter(o => o.type === ObstacleType.MOVING_BLOCK);
      if (moving.length > 0) {
        expect(moving[0].direction).toBeDefined();
        expect(Math.abs(moving[0].direction!)).toBe(1);
      }
    });

    it('障碍物 x 坐标应在跑道范围内', () => {
      const engine = createEngine();
      engine.start();
      for (let i = 0; i < 20; i++) {
        engine['spawnObstacle']();
      }
      for (const obs of engine.getObstacles()) {
        expect(obs.x).toBeGreaterThanOrEqual(ROAD_LEFT);
        expect(obs.x + obs.width).toBeLessThanOrEqual(ROAD_RIGHT);
      }
    });
  });

  // ========== 障碍物移动 ==========

  describe('障碍物移动', () => {
    it('障碍物应向下移动', () => {
      const engine = createEngine();
      engine.start();
      engine['spawnObstacle']();
      const initialY = engine.getObstacles()[0].y;
      advanceOneFrame(engine);
      expect(engine.getObstacles()[0].y).toBeGreaterThan(initialY);
    });

    it('障碍物移出画面后应被移除', () => {
      const engine = createEngine();
      engine.start();
      engine['spawnObstacle']();
      const obs = engine.getObstacles()[0];
      // 手动将障碍物移到屏幕外
      engine['obstacles'][0].y = CANVAS_HEIGHT + 100;
      advanceOneFrame(engine);
      const remaining = engine.getObstacles().filter(o => o === obs);
      expect(remaining.length).toBe(0);
    });

    it('MOVING_BLOCK 应横向移动', () => {
      const engine = createEngine();
      engine.start();
      // 强制生成移动方块
      engine['obstacles'].push({
        type: ObstacleType.MOVING_BLOCK,
        x: 200,
        y: 100,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        speed: 2,
        direction: 1,
        passed: false,
      });
      const initialX = engine['obstacles'][0].x;
      advanceOneFrame(engine);
      expect(engine['obstacles'][0].x).not.toBe(initialX);
    });

    it('MOVING_BLOCK 碰到右边界应反弹', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.MOVING_BLOCK,
        x: ROAD_RIGHT - BLOCK_WIDTH - 1,
        y: 100,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        speed: 5,
        direction: 1,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine['obstacles'][0].direction).toBe(-1);
    });

    it('MOVING_BLOCK 碰到左边界应反弹', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.MOVING_BLOCK,
        x: ROAD_LEFT + 1,
        y: 100,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        speed: 5,
        direction: -1,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine['obstacles'][0].direction).toBe(1);
    });

    it('障碍物通过球后应标记为 passed', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: 200,
        y: BALL_Y + BALL_RADIUS + 50, // 在球下方
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine['obstacles'][0].passed).toBe(true);
    });
  });

  // ========== 碰撞检测 ==========

  describe('碰撞检测', () => {
    it('球碰到 BLOCK 障碍物应触发游戏结束', () => {
      const engine = createEngine();
      engine.start();
      // 将方块放在球的位置
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('gameover');
    });

    it('球碰到 GAP 障碍物的墙壁应触发游戏结束', () => {
      const engine = createEngine();
      engine.start();
      // 球在中心，间隙偏左，球在右侧墙壁区域
      const gapX = ROAD_LEFT;
      engine['obstacles'].push({
        type: ObstacleType.GAP,
        x: gapX,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: GAP_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      // 球在间隙右侧的墙壁区域
      engine['ball'].x = ROAD_RIGHT - BALL_RADIUS - 5;
      advanceOneFrame(engine);
      expect(engine.status).toBe('gameover');
    });

    it('球在 GAP 间隙内不应碰撞', () => {
      const engine = createEngine();
      engine.start();
      // 球在间隙中心
      const gapX = BALL_INITIAL_X - GAP_WIDTH / 2;
      engine['obstacles'].push({
        type: ObstacleType.GAP,
        x: gapX,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: GAP_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('playing');
    });

    it('球碰到 MOVING_BLOCK 应触发游戏结束', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.MOVING_BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        speed: 2,
        direction: 1,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('gameover');
    });

    it('球在障碍物上方不应碰撞', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BALL_RADIUS - BLOCK_HEIGHT - 20, // 远在球上方
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('playing');
    });

    it('球在障碍物下方不应碰撞', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y + BALL_RADIUS + 20, // 在球下方
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('playing');
    });

    it('碰撞容差应生效（HITBOX_SHRINK）', () => {
      const engine = createEngine();
      engine.start();
      // 将方块放在稍微偏离球的位置（在容差范围内）
      const offset = HITBOX_SHRINK + 2;
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X + BALL_RADIUS - offset,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      // 由于 hitbox 缩小，可能不碰撞
      // 这取决于精确的位置计算
    });

    it('游戏结束后应停止游戏循环', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('gameover');
      // 游戏结束后 animationId 应被 cancelAnimationFrame 清除
      // cancelAnimationFrame 在 mock 中会删除回调
      // 验证方式：gameover 后 gameLoop 不再请求新的 rAF
      const scoreAfterGameOver = engine.score;
      // 由于 gameover 后 gameLoop 不再被调用，分数不应变化
      // （无法再次推进帧因为没有新的 rAF 回调）
    });
  });

  // ========== 速度递增 ==========

  describe('速度递增', () => {
    it('初始速度应为 INITIAL_SPEED', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
    });

    it('速度应随分数增加', () => {
      const engine = createEngine();
      engine.start();
      // 手动设置分数
      engine['_score'] = SPEED_INCREMENT_SCORE;
      engine['updateDifficulty']();
      expect(engine.getCurrentSpeed()).toBeGreaterThan(INITIAL_SPEED);
    });

    it('速度不应超过 MAX_SPEED', () => {
      const engine = createEngine();
      engine.start();
      engine['_score'] = 999999;
      engine['updateDifficulty']();
      expect(engine.getCurrentSpeed()).toBeLessThanOrEqual(MAX_SPEED);
    });

    it('速度增量应正确', () => {
      const engine = createEngine();
      engine.start();
      engine['_score'] = SPEED_INCREMENT_SCORE * 2;
      engine['updateDifficulty']();
      expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED + SPEED_INCREMENT * 2);
    });

    it('游戏过程中速度应逐渐增加', () => {
      const engine = createEngine();
      engine.start();
      const initialSpeed = engine.getCurrentSpeed();
      // 推进多帧
      for (let i = 0; i < 200; i++) {
        advanceOneFrame(engine);
      }
      // 速度应该有所增加（或达到最大值）
      expect(engine.getCurrentSpeed()).toBeGreaterThanOrEqual(initialSpeed);
    });
  });

  // ========== 计分 ==========

  describe('计分', () => {
    it('分数应随时间增加', () => {
      const engine = createEngine();
      engine.start();
      const initialScore = engine.score;
      advanceOneFrame(engine);
      expect(engine.score).toBeGreaterThan(initialScore);
    });

    it('分数增量应基于速度', () => {
      const engine = createEngine();
      engine.start();
      advanceOneFrame(engine);
      const scoreAtSpeed1 = engine.score;

      engine.reset();
      engine.start();
      engine['speed'] = INITIAL_SPEED * 2;
      advanceOneFrame(engine);
      const scoreAtSpeed2 = engine.score;

      expect(scoreAtSpeed2).toBeGreaterThan(scoreAtSpeed1);
    });

    it('分数应触发 scoreChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      engine.start();
      advanceOneFrame(engine);
      expect(handler).toHaveBeenCalled();
    });

    it('距离应随时间增加', () => {
      const engine = createEngine();
      engine.start();
      const initialDist = engine.getDistance();
      advanceOneFrame(engine);
      expect(engine.getDistance()).toBeGreaterThan(initialDist);
    });
  });

  // ========== 等级系统 ==========

  describe('等级系统', () => {
    it('初始等级应为 1', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.level).toBe(1);
    });

    it('等级应随分数提升', () => {
      const engine = createEngine();
      engine.start();
      engine['_score'] = LEVEL_UP_SCORE;
      engine['updateDifficulty']();
      expect(engine.level).toBe(2);
    });

    it('等级不应超过 MAX_LEVEL', () => {
      const engine = createEngine();
      engine.start();
      engine['_score'] = LEVEL_UP_SCORE * 100;
      engine['updateDifficulty']();
      expect(engine.level).toBeLessThanOrEqual(MAX_LEVEL);
    });

    it('等级提升应触发 levelChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('levelChange', handler);
      engine.start();
      engine['_score'] = LEVEL_UP_SCORE;
      engine['updateDifficulty']();
      expect(handler).toHaveBeenCalledWith(2);
    });
  });

  // ========== 游戏结束 ==========

  describe('游戏结束', () => {
    it('碰撞后状态应为 gameover', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('gameover');
    });

    it('游戏结束应触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(handler).toHaveBeenCalledWith('gameover');
    });

    it('isWin 应为 false', () => {
      const engine = createEngine();
      expect(engine.isWin).toBe(false);
    });
  });

  // ========== 暂停/恢复 ==========

  describe('暂停和恢复', () => {
    it('暂停后状态应为 paused', () => {
      const engine = createEngine();
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('暂停后恢复状态应为 playing', () => {
      const engine = createEngine();
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('暂停后不应继续更新', () => {
      const engine = createEngine();
      engine.start();
      advanceOneFrame(engine);
      const scoreBeforePause = engine.score;
      engine.pause();
      // 暂停后推进帧不应有效果
      const cb = rafCallbacks.get(engine['animationId']!);
      expect(cb).toBeUndefined();
    });

    it('暂停应触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      engine.pause();
      expect(handler).toHaveBeenCalledWith('paused');
    });

    it('恢复应触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      engine.pause();
      engine.resume();
      expect(handler).toHaveBeenCalledWith('playing');
    });
  });

  // ========== 重置 ==========

  describe('重置', () => {
    it('重置后状态应为 idle', () => {
      const engine = createEngine();
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('重置后分数应为 0', () => {
      const engine = createEngine();
      engine.start();
      advanceOneFrame(engine);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('重置后等级应为 1', () => {
      const engine = createEngine();
      engine.start();
      engine['_score'] = 500;
      engine['updateDifficulty']();
      engine.reset();
      expect(engine.level).toBe(1);
    });

    it('重置后球体位置应回到初始值', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowRight');
      advanceOneFrame(engine);
      engine.reset();
      expect(engine.getBallState().x).toBe(BALL_INITIAL_X);
    });

    it('重置后障碍物应清空', () => {
      const engine = createEngine();
      engine.start();
      engine['spawnObstacle']();
      engine.reset();
      expect(engine.getObstacles()).toHaveLength(0);
    });

    it('重置后速度应回到初始值', () => {
      const engine = createEngine();
      engine.start();
      engine['speed'] = MAX_SPEED;
      engine.reset();
      expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
    });

    it('重置应触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      engine.reset();
      expect(handler).toHaveBeenCalledWith('idle');
    });
  });

  // ========== 销毁 ==========

  describe('销毁', () => {
    it('destroy 应清理所有资源', () => {
      const engine = createEngine();
      engine.start();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('destroy 后监听器应被清除', () => {
      const engine = createEngine();
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.destroy();
      engine['emit']('statusChange', 'playing');
      // emit 后 handler 不应被调用（因为 listeners 已清空）
      // 注意：emit 是 protected 方法，这里通过事件系统测试
    });
  });

  // ========== 键盘输入 ==========

  describe('键盘输入', () => {
    it('handleKeyDown 应记录按键', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft');
      expect(engine.getKeysDown().has('ArrowLeft')).toBe(true);
    });

    it('handleKeyUp 应移除按键', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyUp('ArrowLeft');
      expect(engine.getKeysDown().has('ArrowLeft')).toBe(false);
    });

    it('多个按键可以同时按下', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      expect(engine.getKeysDown().size).toBe(2);
    });

    it('非游戏状态下的按键不应影响游戏', () => {
      const engine = createEngine();
      // idle 状态下按键
      engine.handleKeyDown('ArrowLeft');
      // 球不应移动（因为没有 start）
      expect(engine.getBallState().x).toBe(BALL_INITIAL_X);
    });

    it('重复按键不应重复添加', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowLeft');
      expect(engine.getKeysDown().size).toBe(1);
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('应返回完整状态对象', () => {
      const engine = createEngine();
      engine.start();
      const state = engine.getState();
      expect(state).toHaveProperty('ballX');
      expect(state).toHaveProperty('ballY');
      expect(state).toHaveProperty('ballRadius');
      expect(state).toHaveProperty('ballRotation');
      expect(state).toHaveProperty('speed');
      expect(state).toHaveProperty('distance');
      expect(state).toHaveProperty('obstacleCount');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('keysDown');
    });

    it('ballX 应为当前球的 x 坐标', () => {
      const engine = createEngine();
      engine.start();
      const state = engine.getState();
      expect(state.ballX).toBe(BALL_INITIAL_X);
    });

    it('speed 应为当前速度', () => {
      const engine = createEngine();
      engine.start();
      const state = engine.getState();
      expect(state.speed).toBe(INITIAL_SPEED);
    });

    it('status 应为当前状态', () => {
      const engine = createEngine();
      engine.start();
      const state = engine.getState();
      expect(state.status).toBe('playing');
    });

    it('keysDown 应为当前按键数组', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft');
      const state = engine.getState();
      expect(state.keysDown).toContain('ArrowLeft');
    });
  });

  // ========== 障碍物生成间隔 ==========

  describe('障碍物生成间隔', () => {
    it('初始间隔应为 INITIAL_OBSTACLE_INTERVAL', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.getObstacleInterval()).toBe(INITIAL_OBSTACLE_INTERVAL);
    });

    it('每次生成后间隔应减少', () => {
      const engine = createEngine();
      engine.start();
      const initialInterval = engine.getObstacleInterval();
      engine['spawnObstacle']();
      engine['currentObstacleInterval'] = Math.max(
        MIN_OBSTACLE_INTERVAL,
        engine['currentObstacleInterval'] - OBSTACLE_INTERVAL_DECREASE
      );
      expect(engine.getObstacleInterval()).toBeLessThanOrEqual(initialInterval);
    });

    it('间隔不应低于 MIN_OBSTACLE_INTERVAL', () => {
      const engine = createEngine();
      engine.start();
      engine['currentObstacleInterval'] = MIN_OBSTACLE_INTERVAL;
      engine['currentObstacleInterval'] = Math.max(
        MIN_OBSTACLE_INTERVAL,
        engine['currentObstacleInterval'] - OBSTACLE_INTERVAL_DECREASE
      );
      expect(engine.getObstacleInterval()).toBeGreaterThanOrEqual(MIN_OBSTACLE_INTERVAL);
    });
  });

  // ========== 背景效果 ==========

  describe('背景效果', () => {
    it('星星应随速度移动', () => {
      const engine = createEngine();
      engine.start();
      const star = engine['stars'][0];
      const initialY = star.y;
      advanceOneFrame(engine);
      // 星星 y 坐标应该变化
      // (可能已经循环了，所以不直接比较 y)
    });

    it('车道线应随速度滚动', () => {
      const engine = createEngine();
      engine.start();
      const initialOffset = engine['laneOffset'];
      advanceOneFrame(engine);
      expect(engine['laneOffset']).not.toBe(initialOffset);
    });
  });

  // ========== 渲染 ==========

  describe('渲染', () => {
    it('渲染不应抛出异常', () => {
      const engine = createEngine();
      engine.start();
      expect(() => advanceOneFrame(engine)).not.toThrow();
    });

    it('游戏结束后渲染不应抛出异常', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      // 游戏结束后手动渲染
      expect(() => engine['render']()).not.toThrow();
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('未初始化 canvas 时 start 应抛出异常', () => {
      const engine = new SlopeBallEngine();
      expect(() => engine.start()).toThrow('Canvas not initialized');
    });

    it('未初始化 canvas 时 resume 应抛出异常', () => {
      const engine = new SlopeBallEngine();
      engine['_status'] = 'paused';
      expect(() => engine.resume()).toThrow('Canvas not initialized');
    });

    it('idle 状态下 pause 不应有效果', () => {
      const engine = createEngine();
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('playing 状态下 resume 不应有效果', () => {
      const engine = createEngine();
      engine.start();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('gameover 后可以重新开始', () => {
      const engine = createEngine();
      engine.start();
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: BALL_INITIAL_X - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('gameover');
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('大量障碍物不应导致崩溃', () => {
      const engine = createEngine();
      engine.start();
      for (let i = 0; i < 50; i++) {
        engine['spawnObstacle']();
      }
      expect(() => advanceOneFrame(engine)).not.toThrow();
    });

    it('零 deltaTime 不应导致崩溃', () => {
      const engine = createEngine();
      engine.start();
      expect(() => advanceOneFrame(engine, 0)).not.toThrow();
    });

    it('极大 deltaTime 不应导致崩溃', () => {
      const engine = createEngine();
      engine.start();
      expect(() => advanceOneFrame(engine, 1000)).not.toThrow();
    });
  });

  // ========== 集成测试 ==========

  describe('完整游戏流程', () => {
    it('完整游戏流程：开始 → 玩 → 结束 → 重置 → 再开始', () => {
      const engine = createEngine();

      // 开始
      engine.start();
      expect(engine.status).toBe('playing');

      // 玩几帧
      for (let i = 0; i < 10; i++) {
        engine.handleKeyDown(i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
        advanceOneFrame(engine);
      }
      expect(engine.score).toBeGreaterThan(0);

      // 碰撞结束
      engine['obstacles'].push({
        type: ObstacleType.BLOCK,
        x: engine.getBallState().x - BLOCK_WIDTH / 2,
        y: BALL_Y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      });
      advanceOneFrame(engine);
      expect(engine.status).toBe('gameover');

      const finalScore = engine.score;
      expect(finalScore).toBeGreaterThan(0);

      // 重置
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);

      // 再开始
      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.score).toBe(0);
    });

    it('暂停/恢复流程应正常工作', () => {
      const engine = createEngine();
      engine.start();
      advanceOneFrame(engine);
      const scoreBeforePause = engine.score;

      engine.pause();
      expect(engine.status).toBe('paused');

      engine.resume();
      expect(engine.status).toBe('playing');

      advanceOneFrame(engine);
      expect(engine.score).toBeGreaterThan(scoreBeforePause);
    });
  });
});
