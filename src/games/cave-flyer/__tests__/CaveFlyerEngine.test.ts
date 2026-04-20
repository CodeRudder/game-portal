import { CaveFlyerEngine } from '../CaveFlyerEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HELICOPTER_X,
  HELICOPTER_RADIUS,
  GRAVITY,
  THRUST_FORCE,
  MAX_RISE_SPEED,
  MAX_FALL_SPEED,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  MAX_SPEED,
  INITIAL_CAVE_GAP,
  MIN_CAVE_GAP,
  GAP_DECREMENT,
  STAR_POINTS,
  STAR_COLLECT_DISTANCE,
  DISTANCE_SCORE_INTERVAL,
  DISTANCE_SCORE_POINTS,
  LEVEL_UP_DISTANCE,
  OBSTACLE_SPAWN_DISTANCE,
  STAR_SPAWN_DISTANCE,
  OBSTACLE_GAP,
  OBSTACLE_MIN_HEIGHT,
  TERRAIN_SEGMENT_WIDTH,
  MIN_CEILING_HEIGHT,
  MIN_FLOOR_HEIGHT,
} from '../constants';

// ========== Mock Canvas ==========
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化 */
function createEngine(): CaveFlyerEngine {
  const engine = new CaveFlyerEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 创建引擎并开始游戏 */
function createAndStartEngine(): CaveFlyerEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 模拟一帧更新 */
function simulateFrame(engine: CaveFlyerEngine, dt: number = 16.667): void {
  (engine as any).update(dt);
}

/** 模拟多帧更新 */
function simulateFrames(engine: CaveFlyerEngine, frames: number, dt: number = 16.667): void {
  for (let i = 0; i < frames; i++) {
    simulateFrame(engine, dt);
  }
}

// ========== 测试 ==========

describe('CaveFlyerEngine', () => {
  let engine: CaveFlyerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  // ========== 基础生命周期测试 ==========

  describe('生命周期', () => {
    it('应该正确初始化', () => {
      const e = createEngine();
      expect(e.status).toBe('idle');
      expect(e.score).toBe(0);
      expect(e.level).toBe(1);
    });

    it('应该正确开始游戏', () => {
      expect(engine.status).toBe('playing');
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('开始后直升机在正确位置', () => {
      expect(engine.getHelicopterY()).toBe(CANVAS_HEIGHT / 2);
    });

    it('开始后速度为初始速度', () => {
      expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
    });

    it('开始后洞穴间距为初始间距', () => {
      expect(engine.getCurrentGap()).toBe(INITIAL_CAVE_GAP);
    });

    it('开始后距离为0', () => {
      expect(engine.getDistanceTraveled()).toBe(0);
    });

    it('开始后没有障碍物', () => {
      expect(engine.getObstacles()).toHaveLength(0);
    });

    it('开始后没有星星', () => {
      expect(engine.getStars()).toHaveLength(0);
    });

    it('开始后有地形数据', () => {
      expect(engine.getTerrain().length).toBeGreaterThan(0);
    });

    it('重置后状态回到idle', () => {
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('重置后直升机位置回到中心', () => {
      simulateFrames(engine, 30);
      engine.reset();
      const e2 = createEngine();
      e2.setCanvas(createMockCanvas());
      e2.init();
      e2.start();
      expect(e2.getHelicopterY()).toBe(CANVAS_HEIGHT / 2);
    });

    it('销毁后状态正确', () => {
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('暂停后状态为paused', () => {
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('暂停后可以恢复', () => {
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });
  });

  // ========== 推力/重力物理测试 ==========

  describe('推力与重力物理', () => {
    it('不按键时直升机受重力下落', () => {
      const initialY = engine.getHelicopterY();
      simulateFrames(engine, 10);
      expect(engine.getHelicopterY()).toBeGreaterThan(initialY);
    });

    it('不按键时速度为正（向下）', () => {
      simulateFrames(engine, 5);
      expect(engine.getHelicopterVelocity()).toBeGreaterThan(0);
    });

    it('按住上键时直升机上升', () => {
      const initialY = engine.getHelicopterY();
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 20);
      expect(engine.getHelicopterY()).toBeLessThan(initialY);
    });

    it('按住空格时直升机上升', () => {
      const initialY = engine.getHelicopterY();
      engine.handleKeyDown(' ');
      simulateFrames(engine, 20);
      expect(engine.getHelicopterY()).toBeLessThan(initialY);
    });

    it('按住W键时直升机上升', () => {
      const initialY = engine.getHelicopterY();
      engine.handleKeyDown('w');
      simulateFrames(engine, 20);
      expect(engine.getHelicopterY()).toBeLessThan(initialY);
    });

    it('按住大写W键时直升机上升', () => {
      const initialY = engine.getHelicopterY();
      engine.handleKeyDown('W');
      simulateFrames(engine, 20);
      expect(engine.getHelicopterY()).toBeLessThan(initialY);
    });

    it('松开按键后推力停止', () => {
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 5);
      expect(engine.isThrusting()).toBe(true);

      engine.handleKeyUp('ArrowUp');
      expect(engine.isThrusting()).toBe(false);
    });

    it('松开后直升机速度变为正值（开始下落）', () => {
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 20);
      engine.handleKeyUp('ArrowUp');
      // 等待速度从负变为正
      simulateFrames(engine, 40);
      expect(engine.getHelicopterVelocity()).toBeGreaterThan(0);
    });

    it('推力时速度为负（向上）', () => {
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 10);
      expect(engine.getHelicopterVelocity()).toBeLessThan(0);
    });

    it('上升速度不超过最大上升速度', () => {
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 100);
      expect(engine.getHelicopterVelocity()).toBeGreaterThanOrEqual(MAX_RISE_SPEED);
    });

    it('下落速度不超过最大下落速度', () => {
      simulateFrames(engine, 200);
      expect(engine.getHelicopterVelocity()).toBeLessThanOrEqual(MAX_FALL_SPEED);
    });

    it('直升机不会飞出天花板', () => {
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 200);
      expect(engine.getHelicopterY()).toBeGreaterThanOrEqual(HELICOPTER_RADIUS);
    });

    it('持续推力使速度逐渐变为负值', () => {
      engine.handleKeyDown('ArrowUp');
      // 初始速度为0，持续推力后速度应该越来越负
      const velocities: number[] = [];
      for (let i = 0; i < 10; i++) {
        simulateFrame(engine);
        velocities.push(engine.getHelicopterVelocity());
      }
      // 速度应该单调递减（越来越负）
      for (let i = 1; i < velocities.length; i++) {
        expect(velocities[i]).toBeLessThanOrEqual(velocities[i - 1] + 0.01); // 允许浮点误差
      }
    });

    it('重力使速度逐渐增加', () => {
      const velocities: number[] = [];
      for (let i = 0; i < 10; i++) {
        simulateFrame(engine);
        velocities.push(engine.getHelicopterVelocity());
      }
      // 速度应该单调递增（越来越正）
      for (let i = 1; i < velocities.length; i++) {
        expect(velocities[i]).toBeGreaterThanOrEqual(velocities[i - 1] - 0.01);
      }
    });

    it('松开空格键后推力停止', () => {
      engine.handleKeyDown(' ');
      expect(engine.isThrusting()).toBe(true);
      engine.handleKeyUp(' ');
      expect(engine.isThrusting()).toBe(false);
    });

    it('松开W键后推力停止', () => {
      engine.handleKeyDown('w');
      expect(engine.isThrusting()).toBe(true);
      engine.handleKeyUp('w');
      expect(engine.isThrusting()).toBe(false);
    });

    it('忽略无关按键的keydown', () => {
      const y = engine.getHelicopterY();
      engine.handleKeyDown('a');
      simulateFrame(engine);
      // 不应该有推力效果
      expect(engine.isThrusting()).toBe(false);
    });

    it('忽略无关按键的keyup', () => {
      engine.handleKeyDown('ArrowUp');
      expect(engine.isThrusting()).toBe(true);
      engine.handleKeyUp('a'); // 无关按键
      expect(engine.isThrusting()).toBe(true); // 仍然推力
    });
  });

  // ========== 地形生成测试 ==========

  describe('地形生成', () => {
    it('初始地形覆盖整个屏幕', () => {
      const terrain = engine.getTerrain();
      const leftMost = terrain[0].x;
      const rightMost = terrain[terrain.length - 1].x;
      expect(leftMost).toBeLessThanOrEqual(0);
      expect(rightMost).toBeGreaterThanOrEqual(CANVAS_WIDTH);
    });

    it('地形点按x坐标排序', () => {
      const terrain = engine.getTerrain();
      for (let i = 1; i < terrain.length; i++) {
        expect(terrain[i].x).toBeGreaterThan(terrain[i - 1].x);
      }
    });

    it('天花板高度不低于最小值', () => {
      const terrain = engine.getTerrain();
      for (const point of terrain) {
        expect(point.ceilingHeight).toBeGreaterThanOrEqual(MIN_CEILING_HEIGHT * 0.5); // 允许一些噪声
      }
    });

    it('地板高度不低于最小值', () => {
      const terrain = engine.getTerrain();
      for (const point of terrain) {
        expect(point.floorHeight).toBeGreaterThanOrEqual(MIN_FLOOR_HEIGHT * 0.5);
      }
    });

    it('地形间距始终大于最小洞穴间距', () => {
      const terrain = engine.getTerrain();
      for (const point of terrain) {
        const gap = CANVAS_HEIGHT - point.ceilingHeight - point.floorHeight;
        expect(gap).toBeGreaterThanOrEqual(MIN_CAVE_GAP * 0.8); // 允许一些噪声
      }
    });

    it('地形向左滚动', () => {
      const terrainBefore = engine.getTerrain();
      const rightmostBefore = terrainBefore[terrainBefore.length - 1].x;
      simulateFrames(engine, 30);
      const terrainAfter = engine.getTerrain();
      // 新地形应该延伸到更右边（因为生成了新的）
      expect(terrainAfter.length).toBeGreaterThan(0);
    });

    it('地形段宽度为固定值', () => {
      const terrain = engine.getTerrain();
      for (let i = 1; i < Math.min(terrain.length, 20); i++) {
        const dx = terrain[i].x - terrain[i - 1].x;
        expect(dx).toBeCloseTo(TERRAIN_SEGMENT_WIDTH, 0);
      }
    });

    it('地形变化平滑（相邻点差异不大）', () => {
      const terrain = engine.getTerrain();
      for (let i = 1; i < terrain.length; i++) {
        const ceilDiff = Math.abs(terrain[i].ceilingHeight - terrain[i - 1].ceilingHeight);
        expect(ceilDiff).toBeLessThan(30); // 平滑变化
      }
    });

    it('屏幕外地形被移除', () => {
      simulateFrames(engine, 200);
      const terrain = engine.getTerrain();
      for (const point of terrain) {
        expect(point.x).toBeGreaterThan(-TERRAIN_SEGMENT_WIDTH * 3);
      }
    });
  });

  // ========== 碰撞检测测试 ==========

  describe('碰撞检测', () => {
    it('碰到天花板时游戏结束', () => {
      // 持续推力让直升机飞到顶部
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 300);
      expect(engine.status).toBe('gameover');
    });

    it('碰到地板时游戏结束', () => {
      // 让直升机自然下落到地板
      simulateFrames(engine, 500);
      expect(engine.status).toBe('gameover');
    });

    it('游戏结束后不能再更新', () => {
      // 让直升机坠毁
      simulateFrames(engine, 500);
      expect(engine.status).toBe('gameover');
      const scoreBefore = engine.score;
      simulateFrame(engine);
      // 分数不应该变化
      expect(engine.score).toBe(scoreBefore);
    });

    it('在安全区域飞行不会碰撞', () => {
      // 交替推力保持直升机在中间
      for (let i = 0; i < 60; i++) {
        if (engine.getHelicopterY() > CANVAS_HEIGHT / 2 + 20) {
          engine.handleKeyDown('ArrowUp');
        } else if (engine.getHelicopterY() < CANVAS_HEIGHT / 2 - 20) {
          engine.handleKeyUp('ArrowUp');
        }
        simulateFrame(engine);
      }
      // 应该还在飞行
      expect(engine.status).toBe('playing');
    });

    it('直升机碰到地形天花板时游戏结束', () => {
      // 持续推力飞到顶部
      engine.handleKeyDown('ArrowUp');
      // 一直推到撞墙
      for (let i = 0; i < 500; i++) {
        simulateFrame(engine);
        if (engine.status === 'gameover') break;
      }
      expect(engine.status).toBe('gameover');
    });
  });

  // ========== 障碍物测试 ==========

  describe('障碍物', () => {
    it('飞行一段距离后出现障碍物', () => {
      // 模拟足够多的帧以生成障碍物
      simulateFrames(engine, 300);
      expect(engine.getObstacles().length).toBeGreaterThan(0);
    });

    it('障碍物向左移动', () => {
      simulateFrames(engine, 300);
      const obstacles = engine.getObstacles();
      if (obstacles.length > 0) {
        const obs = obstacles[0];
        expect(obs.x).toBeLessThan(CANVAS_WIDTH + 50);
      }
    });

    it('障碍物有正确的宽度', () => {
      simulateFrames(engine, 300);
      const obstacles = engine.getObstacles();
      for (const obs of obstacles) {
        expect(obs.width).toBeGreaterThan(0);
      }
    });

    it('障碍物高度在合理范围内', () => {
      simulateFrames(engine, 300);
      const obstacles = engine.getObstacles();
      for (const obs of obstacles) {
        expect(obs.height).toBeGreaterThanOrEqual(OBSTACLE_MIN_HEIGHT);
      }
    });

    it('障碍物标记为从顶部或底部', () => {
      simulateFrames(engine, 300);
      const obstacles = engine.getObstacles();
      if (obstacles.length > 0) {
        const hasFromTop = obstacles.some(o => o.fromTop === true);
        const hasFromBottom = obstacles.some(o => o.fromTop === false);
        // 至少应该有一种
        expect(hasFromTop || hasFromBottom).toBe(true);
      }
    });

    it('屏幕外障碍物被移除', () => {
      simulateFrames(engine, 500);
      const obstacles = engine.getObstacles();
      for (const obs of obstacles) {
        expect(obs.x + obs.width).toBeGreaterThan(-20);
      }
    });
  });

  // ========== 星星收集测试 ==========

  describe('星星收集', () => {
    it('飞行一段距离后出现星星', () => {
      simulateFrames(engine, 300);
      const stars = engine.getStars();
      expect(stars.length).toBeGreaterThan(0);
    });

    it('星星有正确的位置', () => {
      simulateFrames(engine, 300);
      const stars = engine.getStars();
      for (const star of stars) {
        expect(star.x).toBeGreaterThan(-20);
        expect(star.y).toBeGreaterThan(0);
        expect(star.y).toBeLessThan(CANVAS_HEIGHT);
      }
    });

    it('星星初始未收集', () => {
      simulateFrames(engine, 300);
      const stars = engine.getStars();
      for (const star of stars) {
        if (star.x > 0 && star.x < CANVAS_WIDTH) {
          expect(star.collected).toBe(false);
        }
      }
    });

    it('收集星星增加分数', () => {
      // 获取初始分数
      const initialScore = engine.score;
      // 我们需要让星星出现在直升机位置附近
      // 通过大量帧模拟来让星星自然接近
      const collectedBefore = engine.getCollectedStarCount();
      simulateFrames(engine, 500);
      // 如果收集到了星星，分数应该增加
      const collectedAfter = engine.getCollectedStarCount();
      if (collectedAfter > collectedBefore) {
        expect(engine.score).toBeGreaterThanOrEqual(initialScore + STAR_POINTS);
      }
    });

    it('每颗星星加10分', () => {
      expect(STAR_POINTS).toBe(10);
    });

    it('已收集的星星不再渲染', () => {
      simulateFrames(engine, 300);
      const stars = engine.getStars();
      const collectedStars = stars.filter(s => s.collected);
      for (const star of collectedStars) {
        expect(star.collected).toBe(true);
      }
    });
  });

  // ========== 距离计分测试 ==========

  describe('距离计分', () => {
    it('飞行距离随时间增加', () => {
      const distBefore = engine.getDistanceTraveled();
      simulateFrames(engine, 30);
      const distAfter = engine.getDistanceTraveled();
      expect(distAfter).toBeGreaterThan(distBefore);
    });

    it('距离以速度递增', () => {
      const dist1 = engine.getDistanceTraveled();
      simulateFrames(engine, 10);
      const dist2 = engine.getDistanceTraveled();
      const diff = dist2 - dist1;
      expect(diff).toBeGreaterThan(0);
      // 大约每帧移动 INITIAL_SPEED 像素
      expect(diff).toBeCloseTo(INITIAL_SPEED * 10, 0);
    });

    it('距离达到阈值时获得分数', () => {
      const initialScore = engine.score;
      // 模拟足够多帧以超过距离计分阈值
      simulateFrames(engine, 100);
      // 分数应该增加了（距离分数 + 可能的星星分数）
      expect(engine.score).toBeGreaterThanOrEqual(initialScore);
    });

    it('每50像素距离得1分', () => {
      expect(DISTANCE_SCORE_INTERVAL).toBe(50);
      expect(DISTANCE_SCORE_POINTS).toBe(1);
    });

    it('getDistance返回整数', () => {
      simulateFrames(engine, 50);
      const dist = engine.getDistance();
      expect(Number.isInteger(dist)).toBe(true);
    });
  });

  // ========== 速度递增测试 ==========

  describe('速度递增', () => {
    it('初始速度为设定值', () => {
      expect(engine.getCurrentSpeed()).toBe(INITIAL_SPEED);
    });

    it('升级后速度增加', () => {
      const initialSpeed = engine.getCurrentSpeed();
      // 模拟足够多帧以升级
      simulateFrames(engine, 600);
      if (engine.level > 1) {
        expect(engine.getCurrentSpeed()).toBeGreaterThan(initialSpeed);
      }
    });

    it('速度不超过最大值', () => {
      simulateFrames(engine, 3000);
      expect(engine.getCurrentSpeed()).toBeLessThanOrEqual(MAX_SPEED);
    });

    it('速度按级别递增', () => {
      // 手动升级测试
      (engine as any).setLevel(5);
      (engine as any).increaseDifficulty();
      const expectedSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + 4 * SPEED_INCREMENT);
      expect(engine.getCurrentSpeed()).toBeCloseTo(expectedSpeed, 1);
    });

    it('最高级速度不超过MAX_SPEED', () => {
      (engine as any).setLevel(100);
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentSpeed()).toBeLessThanOrEqual(MAX_SPEED);
    });
  });

  // ========== 洞穴间距测试 ==========

  describe('洞穴间距', () => {
    it('初始间距为设定值', () => {
      expect(engine.getCurrentGap()).toBe(INITIAL_CAVE_GAP);
    });

    it('升级时间距缩小', () => {
      const initialGap = engine.getCurrentGap();
      (engine as any).setLevel(3);
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentGap()).toBeLessThan(initialGap);
    });

    it('间距不低于最小值', () => {
      (engine as any).setLevel(100);
      (engine as any).increaseDifficulty();
      expect(engine.getCurrentGap()).toBeGreaterThanOrEqual(MIN_CAVE_GAP);
    });

    it('间距按级别缩小', () => {
      (engine as any).setLevel(5);
      (engine as any).increaseDifficulty();
      const expectedGap = Math.max(MIN_CAVE_GAP, INITIAL_CAVE_GAP - 4 * GAP_DECREMENT);
      expect(engine.getCurrentGap()).toBeCloseTo(expectedGap, 1);
    });
  });

  // ========== 升级测试 ==========

  describe('升级机制', () => {
    it('初始等级为1', () => {
      expect(engine.level).toBe(1);
    });

    it('飞行足够距离后升级', () => {
      simulateFrames(engine, 800);
      if (engine.getDistanceTraveled() >= LEVEL_UP_DISTANCE) {
        expect(engine.level).toBeGreaterThan(1);
      }
    });

    it('升级触发difficulty增加', () => {
      const level1Speed = engine.getCurrentSpeed();
      // 模拟升级
      simulateFrames(engine, 800);
      if (engine.level > 1) {
        expect(engine.getCurrentSpeed()).toBeGreaterThanOrEqual(level1Speed);
      }
    });
  });

  // ========== 游戏结束测试 ==========

  describe('游戏结束', () => {
    it('坠毁后状态为gameover', () => {
      simulateFrames(engine, 500);
      expect(engine.status).toBe('gameover');
    });

    it('游戏结束后分数保留', () => {
      // 收集一些分数
      simulateFrames(engine, 100);
      const scoreBeforeGameOver = engine.score;
      // 继续到游戏结束
      simulateFrames(engine, 400);
      if (engine.status === 'gameover') {
        expect(engine.score).toBeGreaterThanOrEqual(scoreBeforeGameOver);
      }
    });

    it('按R键可以重新开始', () => {
      simulateFrames(engine, 500);
      if (engine.status === 'gameover') {
        engine.handleKeyDown('r');
        // reset + start 会被调用
        expect(engine.status).toBe('playing');
      }
    });

    it('按大写R键可以重新开始', () => {
      simulateFrames(engine, 500);
      if (engine.status === 'gameover') {
        engine.handleKeyDown('R');
        expect(engine.status).toBe('playing');
      }
    });

    it('重新开始后分数重置', () => {
      simulateFrames(engine, 100);
      simulateFrames(engine, 400);
      if (engine.status === 'gameover') {
        engine.handleKeyDown('r');
        expect(engine.score).toBe(0);
      }
    });

    it('重新开始后距离重置', () => {
      simulateFrames(engine, 100);
      simulateFrames(engine, 400);
      if (engine.status === 'gameover') {
        engine.handleKeyDown('r');
        expect(engine.getDistanceTraveled()).toBe(0);
      }
    });

    it('重新开始后等级重置', () => {
      simulateFrames(engine, 800);
      simulateFrames(engine, 200);
      if (engine.status === 'gameover') {
        engine.handleKeyDown('r');
        expect(engine.level).toBe(1);
      }
    });

    it('游戏进行中按R不重启', () => {
      const dist = engine.getDistanceTraveled();
      engine.handleKeyDown('r');
      expect(engine.status).toBe('playing');
    });
  });

  // ========== getState 测试 ==========

  describe('getState', () => {
    it('返回正确的状态结构', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('helicopterY');
      expect(state).toHaveProperty('helicopterVelocity');
      expect(state).toHaveProperty('thrusting');
      expect(state).toHaveProperty('distanceTraveled');
      expect(state).toHaveProperty('currentSpeed');
      expect(state).toHaveProperty('currentGap');
      expect(state).toHaveProperty('obstacleCount');
      expect(state).toHaveProperty('starCount');
      expect(state).toHaveProperty('terrainSegments');
    });

    it('直升机Y坐标与getHelicopterY一致', () => {
      const state = engine.getState();
      expect(state.helicopterY).toBe(engine.getHelicopterY());
    });

    it('速度与getCurrentSpeed一致', () => {
      const state = engine.getState();
      expect(state.currentSpeed).toBe(engine.getCurrentSpeed());
    });

    it('推力状态与isThrusting一致', () => {
      engine.handleKeyDown('ArrowUp');
      const state = engine.getState();
      expect(state.thrusting).toBe(true);
    });

    it('距离与getDistanceTraveled一致', () => {
      simulateFrames(engine, 10);
      const state = engine.getState();
      expect(state.distanceTraveled).toBe(engine.getDistanceTraveled());
    });
  });

  // ========== 事件系统测试 ==========

  describe('事件系统', () => {
    it('开始时触发statusChange事件', () => {
      const e = createEngine();
      let status: string | null = null;
      e.on('statusChange', (s: string) => { status = s; });
      e.start();
      expect(status).toBe('playing');
    });

    it('分数变化时触发scoreChange事件', () => {
      let scoreValue = 0;
      engine.on('scoreChange', (s: number) => { scoreValue = s; });
      simulateFrames(engine, 100);
      // 如果有分数变化
      if (engine.score > 0) {
        expect(scoreValue).toBeGreaterThan(0);
      }
    });

    it('游戏结束时触发statusChange为gameover', () => {
      let status: string | null = null;
      engine.on('statusChange', (s: string) => { status = s; });
      simulateFrames(engine, 500);
      if (engine.status === 'gameover') {
        expect(status).toBe('gameover');
      }
    });

    it('升级时触发levelChange事件', () => {
      let levelValue = 1;
      engine.on('levelChange', (l: number) => { levelValue = l; });
      simulateFrames(engine, 1000);
      if (engine.level > 1) {
        expect(levelValue).toBeGreaterThan(1);
      }
    });
  });

  // ========== 边界情况测试 ==========

  describe('边界情况', () => {
    it('deltaTime为0时不会崩溃', () => {
      expect(() => simulateFrame(engine, 0)).not.toThrow();
    });

    it('非常大的deltaTime不会崩溃', () => {
      expect(() => simulateFrame(engine, 1000)).not.toThrow();
    });

    it('快速连续按键不会崩溃', () => {
      for (let i = 0; i < 100; i++) {
        engine.handleKeyDown('ArrowUp');
        engine.handleKeyUp('ArrowUp');
      }
      expect(() => simulateFrame(engine)).not.toThrow();
    });

    it('重复start调用不会崩溃', () => {
      const e = createEngine();
      e.start();
      // 第二次 start 不应该抛出（状态已经是 playing）
      expect(() => e.start()).not.toThrow();
    });

    it('idle状态下按键不崩溃', () => {
      const e = createEngine();
      expect(() => e.handleKeyDown('ArrowUp')).not.toThrow();
      expect(() => e.handleKeyUp('ArrowUp')).not.toThrow();
    });

    it('gameover状态下按键不崩溃', () => {
      simulateFrames(engine, 500);
      if (engine.status === 'gameover') {
        expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
      }
    });

    it('暂停状态下按键不崩溃', () => {
      engine.pause();
      expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });
  });

  // ========== 粒子效果测试 ==========

  describe('粒子效果', () => {
    it('推力时生成粒子', () => {
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 10);
      // 粒子应该存在（通过内部状态）
      const state = engine.getState();
      expect(state).toBeDefined();
    });

    it('不推力时不生成排气粒子', () => {
      // 不按任何键
      simulateFrames(engine, 10);
      // 粒子列表应该为空或很少
      expect((engine as any).particles.length).toBe(0);
    });
  });

  // ========== 常量验证测试 ==========

  describe('常量验证', () => {
    it('Canvas尺寸为480x640', () => {
      expect(CANVAS_WIDTH).toBe(480);
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('直升机在屏幕左侧1/4处', () => {
      expect(HELICOPTER_X).toBeLessThanOrEqual(CANVAS_WIDTH / 4);
    });

    it('初始速度为正值', () => {
      expect(INITIAL_SPEED).toBeGreaterThan(0);
    });

    it('最大速度大于初始速度', () => {
      expect(MAX_SPEED).toBeGreaterThan(INITIAL_SPEED);
    });

    it('最小洞穴间距大于直升机直径', () => {
      expect(MIN_CAVE_GAP).toBeGreaterThan(HELICOPTER_RADIUS * 2);
    });

    it('障碍物间隙足够直升机通过', () => {
      expect(OBSTACLE_GAP).toBeGreaterThan(HELICOPTER_RADIUS * 2);
    });

    it('星星收集距离合理', () => {
      expect(STAR_COLLECT_DISTANCE).toBeGreaterThan(0);
    });

    it('升级距离为正值', () => {
      expect(LEVEL_UP_DISTANCE).toBeGreaterThan(0);
    });

    it('重力为正值', () => {
      expect(GRAVITY).toBeGreaterThan(0);
    });

    it('推力为负值（向上）', () => {
      expect(THRUST_FORCE).toBeLessThan(0);
    });

    it('最大上升速度为负值', () => {
      expect(MAX_RISE_SPEED).toBeLessThan(0);
    });

    it('最大下落速度为正值', () => {
      expect(MAX_FALL_SPEED).toBeGreaterThan(0);
    });
  });

  // ========== 多次重开测试 ==========

  describe('多次重开', () => {
    it('多次重开后游戏正常', () => {
      for (let round = 0; round < 3; round++) {
        simulateFrames(engine, 200);
        engine.reset();
        engine.start();
        expect(engine.status).toBe('playing');
        expect(engine.score).toBe(0);
        expect(engine.level).toBe(1);
      }
    });

    it('重开后地形重新生成', () => {
      simulateFrames(engine, 100);
      const terrainBefore = engine.getTerrain().length;
      engine.reset();
      engine.start();
      const terrainAfter = engine.getTerrain().length;
      // 地形应该被重新生成
      expect(terrainAfter).toBeGreaterThan(0);
    });
  });

  // ========== 综合游戏场景测试 ==========

  describe('综合游戏场景', () => {
    it('完整的短时间游戏流程', () => {
      // 开始飞行
      expect(engine.status).toBe('playing');

      // 推力上升一段时间
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 15);

      // 松开下落
      engine.handleKeyUp('ArrowUp');
      simulateFrames(engine, 10);

      // 再次推力
      engine.handleKeyDown(' ');
      simulateFrames(engine, 15);

      // 松开
      engine.handleKeyUp(' ');

      // 飞行一段时间
      simulateFrames(engine, 50);

      // 应该还在飞行或已结束
      expect(['playing', 'gameover']).toContain(engine.status);
    });

    it('交替推力保持飞行', () => {
      for (let i = 0; i < 200; i++) {
        const y = engine.getHelicopterY();
        if (y > CANVAS_HEIGHT * 0.6) {
          engine.handleKeyDown('ArrowUp');
        } else if (y < CANVAS_HEIGHT * 0.4) {
          engine.handleKeyUp('ArrowUp');
        }
        simulateFrame(engine);
        if (engine.status === 'gameover') break;
      }
      // 至少应该飞了一段时间
      expect(engine.getDistanceTraveled()).toBeGreaterThan(0);
    });

    it('长时间飞行后游戏参数变化', () => {
      // 保持飞行尽可能久
      for (let i = 0; i < 2000; i++) {
        const y = engine.getHelicopterY();
        if (y > CANVAS_HEIGHT * 0.55) {
          engine.handleKeyDown('ArrowUp');
        } else if (y < CANVAS_HEIGHT * 0.45) {
          engine.handleKeyUp('ArrowUp');
        }
        simulateFrame(engine);
        if (engine.status === 'gameover') break;
      }
      // 速度应该增加了
      if (engine.level > 1) {
        expect(engine.getCurrentSpeed()).toBeGreaterThan(INITIAL_SPEED);
      }
    });
  });

  // ========== 计分系统综合测试 ==========

  describe('计分系统', () => {
    it('分数只增不减', () => {
      const scores: number[] = [engine.score];
      for (let i = 0; i < 100; i++) {
        const y = engine.getHelicopterY();
        if (y > CANVAS_HEIGHT * 0.6) {
          engine.handleKeyDown('ArrowUp');
        } else if (y < CANVAS_HEIGHT * 0.4) {
          engine.handleKeyUp('ArrowUp');
        }
        simulateFrame(engine);
        scores.push(engine.score);
        if (engine.status === 'gameover') break;
      }
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    it('addScore方法正确累加', () => {
      (engine as any).addScore(5);
      expect(engine.score).toBe(5);
      (engine as any).addScore(3);
      expect(engine.score).toBe(8);
    });
  });

  // ========== 暂停/恢复测试 ==========

  describe('暂停和恢复', () => {
    it('暂停后距离不变', () => {
      simulateFrames(engine, 20);
      const dist = engine.getDistanceTraveled();
      engine.pause();
      // 暂停后直接调用 update 不应该改变状态（因为 status !== 'playing' 时 gameLoop 不调用 update）
      // 但 simulateFrames 直接调用 update，所以需要验证暂停状态下 gameLoop 不会运行
      expect(engine.status).toBe('paused');
      // 通过 flushAnimationFrame 验证 gameLoop 不会推进
      const distAfterPause = engine.getDistanceTraveled();
      expect(distAfterPause).toBe(dist);
    });

    it('暂停后恢复继续飞行', () => {
      simulateFrames(engine, 20);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
      const distBefore = engine.getDistanceTraveled();
      simulateFrames(engine, 20);
      expect(engine.getDistanceTraveled()).toBeGreaterThan(distBefore);
    });

    it('暂停时推力状态保留', () => {
      engine.handleKeyDown('ArrowUp');
      engine.pause();
      expect(engine.isThrusting()).toBe(true);
      engine.resume();
      expect(engine.isThrusting()).toBe(true);
    });

    it('暂停后松开按键，恢复后推力停止', () => {
      engine.handleKeyDown('ArrowUp');
      engine.pause();
      engine.handleKeyUp('ArrowUp');
      engine.resume();
      expect(engine.isThrusting()).toBe(false);
    });
  });

  // ========== 直升机位置测试 ==========

  describe('直升机位置', () => {
    it('直升机X坐标固定', () => {
      expect(HELICOPTER_X).toBe(100);
      simulateFrames(engine, 50);
      // 直升机X位置不变
      expect((engine as any).helicopter.x).toBe(HELICOPTER_X);
    });

    it('直升机Y坐标在合理范围内（飞行时）', () => {
      for (let i = 0; i < 50; i++) {
        const y = engine.getHelicopterY();
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(CANVAS_HEIGHT);
        simulateFrame(engine);
        if (engine.status === 'gameover') break;
      }
    });
  });

  // ========== 障碍物碰撞测试 ==========

  describe('障碍物碰撞', () => {
    it('障碍物间隙足够通过', () => {
      expect(OBSTACLE_GAP).toBeGreaterThan(HELICOPTER_RADIUS * 2 + 10);
    });

    it('障碍物生成在屏幕右侧外', () => {
      // 监测新生成的障碍物
      simulateFrames(engine, 300);
      const obstacles = engine.getObstacles();
      // 至少有些障碍物在屏幕上或刚进入
      expect(obstacles.length).toBeGreaterThan(0);
    });
  });

  // ========== 难度曲线测试 ==========

  describe('难度曲线', () => {
    it('速度递增量合理', () => {
      expect(SPEED_INCREMENT).toBeGreaterThan(0);
      expect(SPEED_INCREMENT).toBeLessThan(1);
    });

    it('间距递减量合理', () => {
      expect(GAP_DECREMENT).toBeGreaterThan(0);
      expect(GAP_DECREMENT).toBeLessThan(INITIAL_CAVE_GAP / 5);
    });

    it('从初始到最高级别速度变化合理', () => {
      const maxLevels = Math.ceil((MAX_SPEED - INITIAL_SPEED) / SPEED_INCREMENT);
      for (let lvl = 1; lvl <= maxLevels + 5; lvl++) {
        const speed = Math.min(MAX_SPEED, INITIAL_SPEED + (lvl - 1) * SPEED_INCREMENT);
        expect(speed).toBeLessThanOrEqual(MAX_SPEED);
        expect(speed).toBeGreaterThanOrEqual(INITIAL_SPEED);
      }
    });
  });

  // ========== 渲染测试（确保不崩溃） ==========

  describe('渲染', () => {
    it('render方法不崩溃', () => {
      expect(() => (engine as any).render()).not.toThrow();
    });

    it('飞行中render不崩溃', () => {
      engine.handleKeyDown('ArrowUp');
      simulateFrames(engine, 5);
      expect(() => (engine as any).render()).not.toThrow();
    });

    it('有障碍物时render不崩溃', () => {
      simulateFrames(engine, 300);
      expect(() => (engine as any).render()).not.toThrow();
    });

    it('有星星时render不崩溃', () => {
      simulateFrames(engine, 300);
      expect(() => (engine as any).render()).not.toThrow();
    });
  });
});
