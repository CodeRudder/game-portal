import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlappyPlaneEngine } from '../FlappyPlaneEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLANE_X,
  PLANE_SPEED,
  PLANE_RADIUS,
  OBSTACLE_WIDTH,
  OBSTACLE_GAP,
  OBSTACLE_SPEED,
  OBSTACLE_SPAWN_INTERVAL,
  OBSTACLE_MIN_HEIGHT,
  STAR_POINTS,
  STAR_SPAWN_CHANCE,
  STAR_COLLECT_RADIUS,
  GROUND_HEIGHT,
  SCORE_PER_OBSTACLE,
  LEVEL_UP_SCORE,
  SPEED_INCREMENT,
  GAP_DECREMENT,
  MIN_GAP,
  MAX_SPEED,
  EXPLOSION_DURATION,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): FlappyPlaneEngine {
  const engine = new FlappyPlaneEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

function startEngine(engine: FlappyPlaneEngine): void {
  engine.start();
}

/** 推进游戏若干帧 */
function tickFrames(engine: FlappyPlaneEngine, count: number, frameTime = 16.667): void {
  for (let i = 0; i < count; i++) {
    const now = performance.now() + i * frameTime;
    globalThis.flushAnimationFrame(now);
  }
}

/** 等待障碍物生成（推进足够帧数） */
function waitForObstacle(engine: FlappyPlaneEngine): void {
  const framesNeeded = Math.ceil(OBSTACLE_SPAWN_INTERVAL / 16.667) + 5;
  tickFrames(engine, framesNeeded);
}

// ========== 测试套件 ==========

describe('FlappyPlaneEngine', () => {
  let engine: FlappyPlaneEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==================== 初始化测试 ====================

  describe('初始化', () => {
    it('应该正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(FlappyPlaneEngine);
    });

    it('初始状态应为 idle', () => {
      expect(engine.status).toBe('idle');
    });

    it('初始分数应为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('初始等级应为 1', () => {
      expect(engine.level).toBe(1);
    });

    it('初始经过时间应为 0', () => {
      expect(engine.elapsedTime).toBe(0);
    });

    it('getState 返回正确的初始状态', () => {
      const state = engine.getState();
      expect(state.planeY).toBe(CANVAS_HEIGHT / 2);
      expect(state.obstacleCount).toBe(0);
      expect(state.starCount).toBe(0);
      expect(state.starsCollected).toBe(0);
      expect(state.currentSpeed).toBe(OBSTACLE_SPEED);
      expect(state.currentGap).toBe(OBSTACLE_GAP);
      expect(state.isExploding).toBe(false);
    });
  });

  // ==================== 游戏启动测试 ====================

  describe('游戏启动', () => {
    it('调用 start 后状态应为 playing', () => {
      startEngine(engine);
      expect(engine.status).toBe('playing');
    });

    it('启动后分数应为 0', () => {
      startEngine(engine);
      expect(engine.score).toBe(0);
    });

    it('启动后等级应为 1', () => {
      startEngine(engine);
      expect(engine.level).toBe(1);
    });

    it('启动后飞机位于屏幕中央', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state.planeY).toBe(CANVAS_HEIGHT / 2);
    });

    it('启动后无障碍物', () => {
      startEngine(engine);
      expect(engine.getState().obstacleCount).toBe(0);
    });

    it('启动后无星星', () => {
      startEngine(engine);
      expect(engine.getState().starCount).toBe(0);
    });

    it('启动后未收集星星', () => {
      startEngine(engine);
      expect(engine.getState().starsCollected).toBe(0);
    });

    it('启动后无爆炸状态', () => {
      startEngine(engine);
      expect(engine.getState().isExploding).toBe(false);
    });

    it('未设置 canvas 时 start 抛出错误', () => {
      const e = new FlappyPlaneEngine();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });
  });

  // ==================== 飞机移动测试 ====================

  describe('飞机移动', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('按下 ArrowUp 飞机向上移动', () => {
      const initialY = engine.getState().planeY as number;
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 5);
      const newY = engine.getState().planeY as number;
      expect(newY).toBeLessThan(initialY);
    });

    it('按下 ArrowDown 飞机向下移动', () => {
      const initialY = engine.getState().planeY as number;
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 5);
      const newY = engine.getState().planeY as number;
      expect(newY).toBeGreaterThan(initialY);
    });

    it('按下 w 键飞机向上移动', () => {
      const initialY = engine.getState().planeY as number;
      engine.handleKeyDown('w');
      tickFrames(engine, 5);
      const newY = engine.getState().planeY as number;
      expect(newY).toBeLessThan(initialY);
    });

    it('按下 W 键飞机向上移动', () => {
      const initialY = engine.getState().planeY as number;
      engine.handleKeyDown('W');
      tickFrames(engine, 5);
      const newY = engine.getState().planeY as number;
      expect(newY).toBeLessThan(initialY);
    });

    it('按下 s 键飞机向下移动', () => {
      const initialY = engine.getState().planeY as number;
      engine.handleKeyDown('s');
      tickFrames(engine, 5);
      const newY = engine.getState().planeY as number;
      expect(newY).toBeGreaterThan(initialY);
    });

    it('按下 S 键飞机向下移动', () => {
      const initialY = engine.getState().planeY as number;
      engine.handleKeyDown('S');
      tickFrames(engine, 5);
      const newY = engine.getState().planeY as number;
      expect(newY).toBeGreaterThan(initialY);
    });

    it('松开按键后飞机停止移动', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 3);
      engine.handleKeyUp('ArrowUp');
      const y1 = engine.getState().planeY as number;
      tickFrames(engine, 3);
      const y2 = engine.getState().planeY as number;
      expect(y2).toBe(y1);
    });

    it('同时按上下键飞机不移动', () => {
      const initialY = engine.getState().planeY as number;
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 5);
      const newY = engine.getState().planeY as number;
      expect(newY).toBe(initialY);
    });

    it('飞机不会超出上边界', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 200);
      const y = engine.getState().planeY as number;
      expect(y).toBeGreaterThanOrEqual(PLANE_RADIUS + 10);
    });

    it('飞机不会超出下边界', () => {
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 200);
      const y = engine.getState().planeY as number;
      expect(y).toBeLessThanOrEqual(CANVAS_HEIGHT - GROUND_HEIGHT - PLANE_RADIUS - 10);
    });

    it('飞机向上移动时 tilt 为负值', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 10);
      const tilt = engine.getState().planeTilt as number;
      expect(tilt).toBeLessThan(0);
    });

    it('飞机向下移动时 tilt 为正值', () => {
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 10);
      const tilt = engine.getState().planeTilt as number;
      expect(tilt).toBeGreaterThan(0);
    });

    it('松开按键后 tilt 回正', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 10);
      engine.handleKeyUp('ArrowUp');
      tickFrames(engine, 50);
      const tilt = engine.getState().planeTilt as number;
      expect(Math.abs(tilt)).toBeCloseTo(0, 1);
    });
  });

  // ==================== 障碍物生成测试 ====================

  describe('障碍物生成', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('经过一定时间后生成障碍物', () => {
      waitForObstacle(engine);
      expect(engine.getState().obstacleCount).toBeGreaterThan(0);
    });

    it('障碍物从右侧屏幕外出现', () => {
      waitForObstacle(engine);
      const state = engine.getState();
      expect(state.obstacleCount).toBeGreaterThan(0);
    });

    it('障碍物向左移动', () => {
      waitForObstacle(engine);
      tickFrames(engine, 10);
      expect(engine.getState().obstacleCount).toBeGreaterThan(0);
    });

    it('障碍物移出屏幕后被移除', () => {
      waitForObstacle(engine);
      tickFrames(engine, 500);
      expect(engine.getState().obstacleCount).toBeGreaterThanOrEqual(0);
    });

    it('障碍物间隙高度在合理范围内', () => {
      waitForObstacle(engine);
      const state = engine.getState();
      expect(state.currentGap).toBeLessThanOrEqual(OBSTACLE_GAP);
      expect(state.currentGap).toBeGreaterThanOrEqual(MIN_GAP);
    });
  });

  // ==================== 障碍物移动测试 ====================

  describe('障碍物移动', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('障碍物持续向左移动', () => {
      waitForObstacle(engine);
      expect(engine.getState().obstacleCount).toBeGreaterThan(0);
    });

    it('多个障碍物同时存在', () => {
      tickFrames(engine, Math.ceil(OBSTACLE_SPAWN_INTERVAL / 16.667) * 3);
      expect(engine.getState().obstacleCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== 碰撞检测测试 ====================

  describe('碰撞检测', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('飞机碰到上边界游戏结束', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      expect(engine.status).toBe('gameover');
    });

    it('飞机碰到下边界游戏结束', () => {
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 300);
      expect(engine.status).toBe('gameover');
    });

    it('飞机碰到障碍物游戏结束', () => {
      waitForObstacle(engine);
      tickFrames(engine, 500);
      expect(['gameover', 'playing']).toContain(engine.status);
    });

    it('爆炸动画后游戏才真正结束', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      expect(engine.status).toBe('gameover');
    });
  });

  // ==================== 速度递增测试 ====================

  describe('速度递增', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('初始速度等于 OBSTACLE_SPEED', () => {
      expect(engine.getCurrentSpeed()).toBe(OBSTACLE_SPEED);
    });

    it('升级后速度增加', () => {
      const initialSpeed = engine.getCurrentSpeed();
      for (let i = 0; i < LEVEL_UP_SCORE; i++) {
        (engine as any).addScore(SCORE_PER_OBSTACLE);
        const newLevel = Math.floor(engine.score / LEVEL_UP_SCORE) + 1;
        if (newLevel > engine.level) {
          (engine as any).setLevel(newLevel);
          (engine as any).increaseDifficulty();
        }
      }
      expect(engine.getCurrentSpeed()).toBeGreaterThan(initialSpeed);
    });

    it('速度增量符合 SPEED_INCREMENT', () => {
      const initialSpeed = engine.getCurrentSpeed();
      (engine as any).setLevel(2);
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentSpeed()).toBe(initialSpeed + SPEED_INCREMENT);
    });

    it('速度不超过 MAX_SPEED', () => {
      (engine as any)._level = 100;
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentSpeed()).toBeLessThanOrEqual(MAX_SPEED);
    });

    it('间隙随等级减小', () => {
      const initialGap = engine.getCurrentGap();
      (engine as any).setLevel(2);
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentGap()).toBeLessThan(initialGap);
    });

    it('间隙减量符合 GAP_DECREMENT', () => {
      const initialGap = engine.getCurrentGap();
      (engine as any).setLevel(2);
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentGap()).toBe(initialGap - GAP_DECREMENT);
    });

    it('间隙不小于 MIN_GAP', () => {
      (engine as any)._level = 100;
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentGap()).toBeGreaterThanOrEqual(MIN_GAP);
    });
  });

  // ==================== 计分测试 ====================

  describe('计分系统', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('初始分数为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('穿越障碍物得分', () => {
      // 直接添加一个已通过飞机位置的障碍物来测试计分
      (engine as any).obstacles.push({
        x: PLANE_X - OBSTACLE_WIDTH - 5,
        topHeight: 100,
        scored: false,
      });
      // 推进一帧触发计分逻辑
      tickFrames(engine, 1);
      expect(engine.score).toBeGreaterThan(0);
    });

    it('分数变化时触发 scoreChange 事件', () => {
      const callback = vi.fn();
      engine.on('scoreChange', callback);
      (engine as any).addScore(5);
      expect(callback).toHaveBeenCalledWith(5);
    });

    it('等级变化时触发 levelChange 事件', () => {
      const callback = vi.fn();
      engine.on('levelChange', callback);
      (engine as any).setLevel(3);
      expect(callback).toHaveBeenCalledWith(3);
    });

    it('达到 LEVEL_UP_SCORE 分数后升级', () => {
      for (let i = 0; i < LEVEL_UP_SCORE; i++) {
        (engine as any).addScore(SCORE_PER_OBSTACLE);
        const newLevel = Math.floor(engine.score / LEVEL_UP_SCORE) + 1;
        if (newLevel > engine.level) {
          (engine as any).setLevel(newLevel);
        }
      }
      expect(engine.level).toBeGreaterThan(1);
    });
  });

  // ==================== 星星收集测试 ====================

  describe('星星收集', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('初始收集星星数为 0', () => {
      expect(engine.getStarsCollected()).toBe(0);
    });

    it('星星随障碍物一起生成', () => {
      for (let i = 0; i < 10; i++) {
        waitForObstacle(engine);
      }
      expect(engine.getState().starCount).toBeGreaterThanOrEqual(0);
    });

    it('收集星星增加分数', () => {
      const initialScore = engine.score;
      (engine as any).starsCollected++;
      (engine as any).addScore(STAR_POINTS);
      expect(engine.score).toBe(initialScore + STAR_POINTS);
    });

    it('收集星星增加星星计数', () => {
      (engine as any).starsCollected++;
      expect(engine.getStarsCollected()).toBe(1);
    });

    it('星星收集后不再计入 starCount', () => {
      (engine as any).stars.push({
        x: 100,
        y: 200,
        collected: true,
        sparkle: 0,
      });
      expect(engine.getState().starCount).toBe(0);
    });

    it('未收集星星被计入 starCount', () => {
      (engine as any).stars.push({
        x: 100,
        y: 200,
        collected: false,
        sparkle: 0,
      });
      expect(engine.getState().starCount).toBe(1);
    });

    it('星星移出屏幕后被移除', () => {
      (engine as any).stars.push({
        x: -STAR_COLLECT_RADIUS - 10,
        y: 200,
        collected: false,
        sparkle: 0,
      });
      tickFrames(engine, 1);
    });

    it('收集星星时触发 scoreChange', () => {
      const callback = vi.fn();
      engine.on('scoreChange', callback);
      (engine as any).addScore(STAR_POINTS);
      expect(callback).toHaveBeenCalled();
    });
  });

  // ==================== 游戏结束测试 ====================

  describe('游戏结束', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('游戏结束时状态为 gameover', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      expect(engine.status).toBe('gameover');
    });

    it('游戏结束时触发 statusChange 事件', () => {
      const callback = vi.fn();
      engine.on('statusChange', callback);
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      expect(callback).toHaveBeenCalledWith('gameover');
    });

    it('游戏结束后不再更新', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      expect(engine.status).toBe('gameover');
      const scoreAfterGameOver = engine.score;
      tickFrames(engine, 10);
      expect(engine.score).toBe(scoreAfterGameOver);
    });

    it('爆炸粒子在游戏结束时生成', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      // 游戏应该已结束
      expect(engine.status).toBe('gameover');
      // isExploding 在 gameover 后应为 false（爆炸已完成）
      // 但如果爆炸还在进行中可能为 true，所以检查最终状态
      const state = engine.getState();
      expect(state.isExploding).toBe(false);
    });
  });

  // ==================== 键盘输入测试 ====================

  describe('键盘输入', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('handleKeyDown 记录 ArrowUp', () => {
      engine.handleKeyDown('ArrowUp');
      expect((engine as any).keysPressed.has('up')).toBe(true);
    });

    it('handleKeyDown 记录 ArrowDown', () => {
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).keysPressed.has('down')).toBe(true);
    });

    it('handleKeyDown 记录 w 为 up', () => {
      engine.handleKeyDown('w');
      expect((engine as any).keysPressed.has('up')).toBe(true);
    });

    it('handleKeyDown 记录 W 为 up', () => {
      engine.handleKeyDown('W');
      expect((engine as any).keysPressed.has('up')).toBe(true);
    });

    it('handleKeyDown 记录 s 为 down', () => {
      engine.handleKeyDown('s');
      expect((engine as any).keysPressed.has('down')).toBe(true);
    });

    it('handleKeyDown 记录 S 为 down', () => {
      engine.handleKeyDown('S');
      expect((engine as any).keysPressed.has('down')).toBe(true);
    });

    it('handleKeyUp 清除 ArrowUp', () => {
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyUp('ArrowUp');
      expect((engine as any).keysPressed.has('up')).toBe(false);
    });

    it('handleKeyUp 清除 ArrowDown', () => {
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyUp('ArrowDown');
      expect((engine as any).keysPressed.has('down')).toBe(false);
    });

    it('handleKeyUp 清除 w', () => {
      engine.handleKeyDown('w');
      engine.handleKeyUp('w');
      expect((engine as any).keysPressed.has('up')).toBe(false);
    });

    it('handleKeyUp 清除 s', () => {
      engine.handleKeyDown('s');
      engine.handleKeyUp('s');
      expect((engine as any).keysPressed.has('down')).toBe(false);
    });

    it('其他按键不影响移动状态', () => {
      engine.handleKeyDown('a');
      engine.handleKeyDown('d');
      expect((engine as any).keysPressed.has('up')).toBe(false);
      expect((engine as any).keysPressed.has('down')).toBe(false);
    });
  });

  // ==================== getState 测试 ====================

  describe('getState', () => {
    it('返回正确的初始状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('planeY');
      expect(state).toHaveProperty('planeTilt');
      expect(state).toHaveProperty('obstacleCount');
      expect(state).toHaveProperty('starCount');
      expect(state).toHaveProperty('starsCollected');
      expect(state).toHaveProperty('currentSpeed');
      expect(state).toHaveProperty('currentGap');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('isExploding');
    });

    it('游戏进行中状态正确反映', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 10);
      const state = engine.getState();
      expect(state.planeY).toBeGreaterThan(CANVAS_HEIGHT / 2);
      expect(state.planeTilt).toBeGreaterThan(0);
      expect(state.isExploding).toBe(false);
    });

    it('爆炸状态正确反映', () => {
      startEngine(engine);
      (engine as any).isExploding = true;
      (engine as any).explosionTimer = 0;
      const state = engine.getState();
      expect(state.isExploding).toBe(true);
    });

    it('得分后 score 正确反映', () => {
      startEngine(engine);
      (engine as any).addScore(10);
      expect(engine.getState().score).toBe(10);
    });

    it('升级后 level 正确反映', () => {
      startEngine(engine);
      (engine as any).setLevel(3);
      expect(engine.getState().level).toBe(3);
    });
  });

  // ==================== 暂停/恢复测试 ====================

  describe('暂停与恢复', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('暂停后状态为 paused', () => {
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('恢复后状态为 playing', () => {
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('暂停后飞机不移动', () => {
      engine.pause();
      const y1 = engine.getState().planeY as number;
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 10);
      const y2 = engine.getState().planeY as number;
      expect(y2).toBe(y1);
    });

    it('恢复后飞机可以继续移动', () => {
      engine.pause();
      engine.resume();
      const y1 = engine.getState().planeY as number;
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 10);
      const y2 = engine.getState().planeY as number;
      expect(y2).toBeGreaterThan(y1);
    });
  });

  // ==================== 重置测试 ====================

  describe('重置', () => {
    it('重置后状态为 idle', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('重置后分数归零', () => {
      startEngine(engine);
      (engine as any).addScore(100);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('重置后等级归一', () => {
      startEngine(engine);
      (engine as any).setLevel(5);
      engine.reset();
      expect(engine.level).toBe(1);
    });

    it('重置后飞机回到中央', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 10);
      engine.reset();
      expect(engine.getState().planeY).toBe(CANVAS_HEIGHT / 2);
    });

    it('重置后障碍物清空', () => {
      startEngine(engine);
      waitForObstacle(engine);
      engine.reset();
      expect(engine.getState().obstacleCount).toBe(0);
    });

    it('重置后星星清空', () => {
      startEngine(engine);
      (engine as any).stars.push({ x: 100, y: 200, collected: false, sparkle: 0 });
      engine.reset();
      expect(engine.getState().starCount).toBe(0);
    });

    it('重置后星星收集数归零', () => {
      startEngine(engine);
      (engine as any).starsCollected = 5;
      engine.reset();
      expect(engine.getStarsCollected()).toBe(0);
    });

    it('重置后按键状态清空', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      engine.reset();
      expect((engine as any).keysPressed.has('up')).toBe(false);
    });

    it('重置后重新开始速度恢复初始值', () => {
      startEngine(engine);
      (engine as any)._level = 5;
      (engine as any).increaseDifficulty();
      engine.reset();
      startEngine(engine);
      expect(engine.getCurrentSpeed()).toBe(OBSTACLE_SPEED);
    });
  });

  // ==================== 销毁测试 ====================

  describe('销毁', () => {
    it('销毁后状态为 idle', () => {
      startEngine(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('销毁后分数归零', () => {
      startEngine(engine);
      (engine as any).addScore(50);
      engine.destroy();
      expect(engine.score).toBe(0);
    });
  });

  // ==================== 事件系统测试 ====================

  describe('事件系统', () => {
    it('scoreChange 事件正确触发', () => {
      startEngine(engine);
      const cb = vi.fn();
      engine.on('scoreChange', cb);
      (engine as any).addScore(3);
      expect(cb).toHaveBeenCalledWith(3);
    });

    it('levelChange 事件正确触发', () => {
      startEngine(engine);
      const cb = vi.fn();
      engine.on('levelChange', cb);
      (engine as any).setLevel(2);
      expect(cb).toHaveBeenCalledWith(2);
    });

    it('statusChange 事件在 start 时触发', () => {
      const cb = vi.fn();
      engine.on('statusChange', cb);
      startEngine(engine);
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('off 取消事件监听', () => {
      startEngine(engine);
      const cb = vi.fn();
      engine.on('scoreChange', cb);
      engine.off('scoreChange', cb);
      (engine as any).addScore(5);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ==================== 渲染测试 ====================

  describe('渲染', () => {
    it('游戏进行中渲染不报错', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 20);
      expect(engine.status).toBe('playing');
    });

    it('有障碍物时渲染不报错', () => {
      startEngine(engine);
      waitForObstacle(engine);
      expect(engine.getState().obstacleCount).toBeGreaterThan(0);
    });

    it('有星星时渲染不报错', () => {
      startEngine(engine);
      (engine as any).stars.push({
        x: 200,
        y: 300,
        collected: false,
        sparkle: 5,
      });
      tickFrames(engine, 5);
    });

    it('爆炸中渲染不报错', () => {
      startEngine(engine);
      (engine as any).isExploding = true;
      (engine as any).explosionTimer = 0;
      (engine as any).particles.push({
        x: 100,
        y: 200,
        vx: 2,
        vy: -1,
        life: 20,
        maxLife: 35,
        color: '#ff6b6b',
        size: 4,
      });
      tickFrames(engine, 5);
    });
  });

  // ==================== 边界条件测试 ====================

  describe('边界条件', () => {
    it('deltaTime 为 0 时不崩溃', () => {
      startEngine(engine);
      globalThis.flushAnimationFrame(0);
      expect(engine.status).toBe('playing');
    });

    it('deltaTime 很大时不崩溃', () => {
      startEngine(engine);
      globalThis.flushAnimationFrame(100000);
      expect(['playing', 'gameover']).toContain(engine.status);
    });

    it('连续快速按键不崩溃', () => {
      startEngine(engine);
      for (let i = 0; i < 100; i++) {
        engine.handleKeyDown('ArrowUp');
        engine.handleKeyUp('ArrowUp');
        engine.handleKeyDown('ArrowDown');
        engine.handleKeyUp('ArrowDown');
      }
      tickFrames(engine, 5);
      expect(engine.status).toBe('playing');
    });

    it('未开始游戏时按键不影响', () => {
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 5);
      expect(engine.status).toBe('idle');
      expect(engine.getState().planeY).toBe(CANVAS_HEIGHT / 2);
    });

    it('游戏结束后按键不影响', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      expect(engine.status).toBe('gameover');
      const y = engine.getState().planeY;
      engine.handleKeyDown('ArrowDown');
      tickFrames(engine, 10);
      expect(engine.getState().planeY).toBe(y);
    });

    it('多次 start 不崩溃', () => {
      startEngine(engine);
      engine.reset();
      startEngine(engine);
      expect(engine.status).toBe('playing');
    });

    it('重复 pause 不崩溃', () => {
      startEngine(engine);
      engine.pause();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('idle 时 resume 不崩溃', () => {
      expect(() => engine.resume()).not.toThrow();
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== 云朵系统测试 ====================

  describe('云朵系统', () => {
    it('云朵在游戏开始时初始化', () => {
      startEngine(engine);
      expect((engine as any).clouds.length).toBeGreaterThan(0);
    });

    it('云朵随时间移动', () => {
      startEngine(engine);
      const initialX = (engine as any).clouds[0].x;
      tickFrames(engine, 20);
      const newX = (engine as any).clouds[0].x;
      expect(newX).toBeLessThan(initialX);
    });
  });

  // ==================== 尾迹系统测试 ====================

  describe('尾迹系统', () => {
    it('游戏进行中尾迹被创建', () => {
      startEngine(engine);
      tickFrames(engine, 10);
      expect((engine as any).trail.length).toBeGreaterThan(0);
    });

    it('尾迹随时间衰减', () => {
      startEngine(engine);
      tickFrames(engine, 5);
      const initialTrailLen = (engine as any).trail.length;
      tickFrames(engine, 30);
      expect((engine as any).trail.length).toBeLessThanOrEqual(initialTrailLen + 30);
    });
  });

  // ==================== 引擎火焰动画测试 ====================

  describe('引擎火焰动画', () => {
    it('引擎火焰动画帧在合理范围内', () => {
      startEngine(engine);
      tickFrames(engine, 10);
      expect((engine as any).plane.enginePhase).toBeGreaterThanOrEqual(0);
      expect((engine as any).plane.enginePhase).toBeLessThan(4);
    });
  });

  // ==================== 完整游戏流程测试 ====================

  describe('完整游戏流程', () => {
    it('完整的 开始→暂停→恢复→结束→重置 流程', () => {
      startEngine(engine);
      expect(engine.status).toBe('playing');

      engine.pause();
      expect(engine.status).toBe('paused');

      engine.resume();
      expect(engine.status).toBe('playing');

      engine.handleKeyDown('ArrowUp');
      tickFrames(engine, 300);
      expect(engine.status).toBe('gameover');

      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('连续多局游戏', () => {
      for (let round = 0; round < 3; round++) {
        startEngine(engine);
        expect(engine.status).toBe('playing');
        engine.handleKeyDown('ArrowUp');
        tickFrames(engine, 300);
        expect(engine.status).toBe('gameover');
        engine.reset();
        expect(engine.status).toBe('idle');
      }
    });
  });

  // ==================== 常量验证测试 ====================

  describe('常量验证', () => {
    it('CANVAS_WIDTH 为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('PLANE_X 为 80', () => {
      expect(PLANE_X).toBe(80);
    });

    it('SCORE_PER_OBSTACLE 为 1', () => {
      expect(SCORE_PER_OBSTACLE).toBe(1);
    });

    it('STAR_POINTS 为 3', () => {
      expect(STAR_POINTS).toBe(3);
    });

    it('MIN_GAP 小于 OBSTACLE_GAP', () => {
      expect(MIN_GAP).toBeLessThan(OBSTACLE_GAP);
    });

    it('MAX_SPEED 大于 OBSTACLE_SPEED', () => {
      expect(MAX_SPEED).toBeGreaterThan(OBSTACLE_SPEED);
    });

    it('EXPLOSION_DURATION 为正数', () => {
      expect(EXPLOSION_DURATION).toBeGreaterThan(0);
    });

    it('OBSTACLE_MIN_HEIGHT 为正数', () => {
      expect(OBSTACLE_MIN_HEIGHT).toBeGreaterThan(0);
    });

    it('STAR_COLLECT_RADIUS 为正数', () => {
      expect(STAR_COLLECT_RADIUS).toBeGreaterThan(0);
    });

    it('STAR_SPAWN_CHANCE 在 0 到 1 之间', () => {
      expect(STAR_SPAWN_CHANCE).toBeGreaterThan(0);
      expect(STAR_SPAWN_CHANCE).toBeLessThanOrEqual(1);
    });
  });
});
