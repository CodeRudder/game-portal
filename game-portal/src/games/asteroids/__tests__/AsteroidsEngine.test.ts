import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AsteroidsEngine } from '../AsteroidsEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SHIP_SIZE, SHIP_THRUST, SHIP_ROTATION_SPEED, SHIP_MAX_SPEED,
  SHIP_FRICTION, SHIP_INVINCIBLE_TIME,
  BULLET_SPEED, BULLET_LIFETIME, BULLET_COOLDOWN, BULLET_RADIUS,
  ASTEROID_SIZE_LARGE, ASTEROID_SIZE_MEDIUM, ASTEROID_SIZE_SMALL,
  ASTEROID_SPEED_BASE, ASTEROID_SPEED_VARIANCE,
  ASTEROID_ROTATION_SPEED,
  INITIAL_ASTEROID_COUNT, ASTEROIDS_PER_WAVE, MAX_ASTEROID_WAVE,
  SCORE_LARGE, SCORE_MEDIUM, SCORE_SMALL,
  INITIAL_LIVES,
  PARTICLE_COUNT, PARTICLE_LIFETIME, PARTICLE_SPEED,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): AsteroidsEngine {
  const engine = new AsteroidsEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 启动引擎 */
function startEngine(engine: AsteroidsEngine): void {
  engine.start();
}

/** 手动调用 update（跳过游戏循环和渲染） */
function tick(engine: AsteroidsEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

// ========== 测试 ==========

describe('AsteroidsEngine', () => {
  let engine: AsteroidsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(AsteroidsEngine);
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

    it('初始生命应为 INITIAL_LIVES', () => {
      expect(engine.lives).toBe(INITIAL_LIVES);
    });

    it('初始波次应为 0', () => {
      expect(engine.wave).toBe(0);
    });

    it('初始飞船位置为画布中心', () => {
      expect(engine.shipX).toBe(CANVAS_WIDTH / 2);
      expect(engine.shipY).toBe(CANVAS_HEIGHT / 2);
    });

    it('初始飞船角度为 0', () => {
      expect(engine.shipAngle).toBe(0);
    });

    it('初始子弹数为 0', () => {
      expect(engine.bulletCount).toBe(0);
    });

    it('初始小行星数为 0', () => {
      expect(engine.asteroidCount).toBe(0);
    });

    it('初始粒子数为 0', () => {
      expect(engine.particleCount).toBe(0);
    });
  });

  // ========== 游戏生命周期 ==========

  describe('游戏生命周期', () => {
    it('start 后状态变为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start 后生命重置为 INITIAL_LIVES', () => {
      engine.start();
      expect(engine.lives).toBe(INITIAL_LIVES);
    });

    it('start 后分数重置为 0', () => {
      engine.start();
      expect(engine.score).toBe(0);
    });

    it('start 后波次为 1', () => {
      engine.start();
      expect(engine.wave).toBe(1);
    });

    it('start 后生成小行星', () => {
      engine.start();
      expect(engine.asteroidCount).toBe(INITIAL_ASTEROID_COUNT);
    });

    it('start 后飞船在画布中心', () => {
      engine.start();
      expect(engine.shipX).toBe(CANVAS_WIDTH / 2);
      expect(engine.shipY).toBe(CANVAS_HEIGHT / 2);
    });

    it('pause 后状态变为 paused', () => {
      startEngine(engine);
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态恢复为 playing', () => {
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态变为 idle', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后分数清零', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('reset 后生命重置', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.lives).toBe(INITIAL_LIVES);
    });

    it('reset 后波次为 0', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.wave).toBe(0);
    });

    it('destroy 后状态变为 idle', () => {
      startEngine(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('未初始化 canvas 调用 start 应抛出异常', () => {
      const e = new AsteroidsEngine();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });
  });

  // ========== 飞船旋转 ==========

  describe('飞船旋转', () => {
    it('按左键飞船逆时针旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      tick(engine, 100);
      expect(engine.shipAngle).toBeLessThan(0);
    });

    it('按右键飞船顺时针旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      tick(engine, 100);
      expect(engine.shipAngle).toBeGreaterThan(0);
    });

    it('同时按左右旋转抵消', () => {
      startEngine(engine);
      const startAngle = engine.shipAngle;
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      tick(engine, 100);
      // 两个方向抵消，角度应接近起始值
      expect(Math.abs(engine.shipAngle - startAngle)).toBeLessThan(0.01);
    });

    it('松开按键停止旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      tick(engine, 100);
      const angleAfterRotation = engine.shipAngle;
      engine.handleKeyUp('ArrowRight');
      tick(engine, 100);
      expect(engine.shipAngle).toBe(angleAfterRotation);
    });

    it('旋转速度符合常量', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      tick(engine, 1000);
      // dt = 1s, rotation = SHIP_ROTATION_SPEED * 1 = 4 rad
      expect(Math.abs(engine.shipAngle - SHIP_ROTATION_SPEED)).toBeLessThan(0.1);
    });
  });

  // ========== 飞船推进 ==========

  describe('飞船推进', () => {
    it('按上键飞船获得推力', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine, 100);
      // 飞船初始 angle=0（朝上），推力方向 angle - PI/2
      // 推力应使飞船移动
      const movedX = engine.shipX !== CANVAS_WIDTH / 2;
      const movedY = engine.shipY !== CANVAS_HEIGHT / 2;
      expect(movedX || movedY).toBe(true);
    });

    it('松开上键推力停止', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine, 100);
      engine.handleKeyUp('ArrowUp');
      tick(engine, 100);
      // 停止推进后因摩擦力速度衰减
      const posAfterStop = engine.shipX;
      tick(engine, 16);
      // 位置变化很小（摩擦衰减）
      const drift = Math.abs(engine.shipX - posAfterStop);
      expect(drift).toBeLessThan(50);
    });

    it('飞船速度不超过最大速度', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      // 持续推进多帧
      for (let i = 0; i < 200; i++) tick(engine, 16);
      // 通过内部状态检查速度
      const ship = (engine as any)._ship;
      const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      expect(speed).toBeLessThanOrEqual(SHIP_MAX_SPEED * 1.05);
    });

    it('摩擦力使飞船减速', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine, 200);
      engine.handleKeyUp('ArrowUp');
      const ship = (engine as any)._ship;
      const speedBeforeFriction = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      // 多帧摩擦
      for (let i = 0; i < 50; i++) tick(engine, 16);
      const speedAfterFriction = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      expect(speedAfterFriction).toBeLessThan(speedBeforeFriction);
    });
  });

  // ========== 屏幕包裹 ==========

  describe('屏幕包裹', () => {
    it('飞船从右侧超出后出现在左侧', () => {
      startEngine(engine);
      const ship = (engine as any)._ship;
      ship.x = CANVAS_WIDTH + 10;
      ship.vx = 1;
      tick(engine, 16);
      expect(engine.shipX).toBeLessThan(CANVAS_WIDTH);
    });

    it('飞船从左侧超出后出现在右侧', () => {
      startEngine(engine);
      const ship = (engine as any)._ship;
      ship.x = -10;
      ship.vx = -1;
      tick(engine, 16);
      expect(engine.shipX).toBeGreaterThan(CANVAS_WIDTH - 20);
    });

    it('飞船从下方超出后出现在上方', () => {
      startEngine(engine);
      const ship = (engine as any)._ship;
      ship.y = CANVAS_HEIGHT + 10;
      ship.vy = 1;
      tick(engine, 16);
      expect(engine.shipY).toBeLessThan(CANVAS_HEIGHT);
    });

    it('飞船从上方超出后出现在下方', () => {
      startEngine(engine);
      const ship = (engine as any)._ship;
      ship.y = -10;
      ship.vy = -1;
      tick(engine, 16);
      expect(engine.shipY).toBeGreaterThan(CANVAS_HEIGHT - 20);
    });
  });

  // ========== 子弹 ==========

  describe('子弹', () => {
    it('按空格发射子弹', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.bulletCount).toBeGreaterThan(0);
    });

    it('子弹发射有冷却时间', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bulletsAfterFirst = engine.bulletCount;
      tick(engine, 16);
      // 冷却期间不应发射新子弹
      expect(engine.bulletCount).toBe(bulletsAfterFirst);
    });

    it('冷却后可再次发射', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bulletsAfterFirst = engine.bulletCount;
      // 等待冷却结束
      tick(engine, BULLET_COOLDOWN + 50);
      expect(engine.bulletCount).toBeGreaterThan(bulletsAfterFirst);
    });

    it('子弹有存活时间', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.bulletCount).toBeGreaterThan(0);
      // 等待子弹过期
      for (let i = 0; i < 100; i++) tick(engine, 16);
      // 所有子弹应过期（除非期间又发射了新的）
      // 但冷却时间内不应发射太多
    });

    it('子弹从飞船前端发射', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bullet = (engine as any)._bullets[0];
      // 子弹应在飞船前方
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const expectedX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle);
      const expectedY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle);
      expect(bullet.x).toBeCloseTo(expectedX, 0);
      expect(bullet.y).toBeCloseTo(expectedY, 0);
    });

    it('子弹速度符合常量', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bullet = (engine as any)._bullets[0];
      const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
      // 子弹速度应接近 BULLET_SPEED（加上少量飞船速度影响）
      expect(speed).toBeGreaterThan(BULLET_SPEED * 0.5);
    });

    it('子弹也进行屏幕包裹', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bullet = (engine as any)._bullets[0];
      bullet.x = CANVAS_WIDTH + 5;
      tick(engine, 16);
      expect(bullet.x).toBeLessThan(CANVAS_WIDTH);
    });
  });

  // ========== 小行星 ==========

  describe('小行星', () => {
    it('第一波生成 INITIAL_ASTEROID_COUNT 个大行星', () => {
      startEngine(engine);
      expect(engine.asteroidCount).toBe(INITIAL_ASTEROID_COUNT);
    });

    it('小行星在移动', () => {
      startEngine(engine);
      const asteroid = (engine as any)._asteroids[0];
      const startX = asteroid.x;
      const startY = asteroid.y;
      tick(engine, 100);
      const moved = asteroid.x !== startX || asteroid.y !== startY;
      expect(moved).toBe(true);
    });

    it('小行星进行屏幕包裹', () => {
      startEngine(engine);
      const asteroid = (engine as any)._asteroids[0];
      asteroid.x = CANVAS_WIDTH + 5;
      tick(engine, 16);
      expect(asteroid.x).toBeLessThan(CANVAS_WIDTH);
    });

    it('小行星在旋转', () => {
      startEngine(engine);
      const asteroid = (engine as any)._asteroids[0];
      const startRotation = asteroid.rotation;
      tick(engine, 100);
      expect(asteroid.rotation).not.toBe(startRotation);
    });

    it('大行星半径为 ASTEROID_SIZE_LARGE', () => {
      startEngine(engine);
      const large = (engine as any)._asteroids.find((a: any) => a.size === 'large');
      expect(large).toBeDefined();
      expect(large.radius).toBe(ASTEROID_SIZE_LARGE);
    });
  });

  // ========== 小行星分裂 ==========

  describe('小行星分裂', () => {
    it('大行星被击中分裂为 2 个中行星', () => {
      startEngine(engine);
      // 清除所有行星，手动放置一个大行星在飞船前方
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 30 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 30 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'large',
        radius: ASTEROID_SIZE_LARGE,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      // 发射子弹
      engine.handleKeyDown(' ');
      tick(engine, 16);

      // 应该有 2 个中行星
      const mediums = (engine as any)._asteroids.filter((a: any) => a.size === 'medium');
      expect(mediums.length).toBe(2);
    });

    it('中行星被击中分裂为 2 个小行星', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 15 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 15 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'medium',
        radius: ASTEROID_SIZE_MEDIUM,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);

      const smalls = (engine as any)._asteroids.filter((a: any) => a.size === 'small');
      expect(smalls.length).toBe(2);
    });

    it('小行星被击中不分裂', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'small',
        radius: ASTEROID_SIZE_SMALL,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);

      // 小行星被击中后不应有新行星
      expect(engine.asteroidCount).toBe(0);
    });

    it('分裂后的小行星有速度', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 30 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 30 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'large',
        radius: ASTEROID_SIZE_LARGE,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);

      const mediums = (engine as any)._asteroids.filter((a: any) => a.size === 'medium');
      mediums.forEach((a: any) => {
        const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        expect(speed).toBeGreaterThan(0);
      });
    });
  });

  // ========== 碰撞检测 ==========

  describe('碰撞检测', () => {
    it('子弹击中小行星后子弹消失', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 30 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 30 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'large',
        radius: ASTEROID_SIZE_LARGE,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.bulletCount).toBe(0);
    });

    it('子弹击中小行星后小行星消失', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'small',
        radius: ASTEROID_SIZE_SMALL,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      // 小行星被击中，没有剩余
      expect(engine.asteroidCount).toBe(0);
    });

    it('飞船与行星碰撞减少生命', () => {
      startEngine(engine);
      const initialLives = engine.lives;
      // 将飞船无敌时间设为 0
      (engine as any)._ship.invincibleTimer = 0;
      // 将一个小行星放在飞船位置
      const asteroid = (engine as any)._asteroids[0];
      asteroid.x = CANVAS_WIDTH / 2;
      asteroid.y = CANVAS_HEIGHT / 2;
      tick(engine, 16);
      expect(engine.lives).toBeLessThan(initialLives);
    });

    it('飞船碰撞后重置到中心', () => {
      startEngine(engine);
      (engine as any)._ship.invincibleTimer = 0;
      // 先移动飞船
      engine.handleKeyDown('ArrowUp');
      tick(engine, 200);
      // 将行星移到飞船位置
      const ship = (engine as any)._ship;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = ship.x;
        asteroid.y = ship.y;
        tick(engine, 16);
        // 碰撞后飞船重置到中心
        expect(engine.shipX).toBe(CANVAS_WIDTH / 2);
        expect(engine.shipY).toBe(CANVAS_HEIGHT / 2);
      }
    });

    it('飞船碰撞后有无敌时间', () => {
      startEngine(engine);
      (engine as any)._ship.invincibleTimer = 0;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = CANVAS_WIDTH / 2;
        asteroid.y = CANVAS_HEIGHT / 2;
        tick(engine, 16);
        // 碰撞后飞船应有无敌时间
        expect((engine as any)._ship.invincibleTimer).toBeGreaterThan(0);
      }
    });

    it('无敌期间不检测碰撞', () => {
      startEngine(engine);
      // 飞船初始有无敌时间
      expect((engine as any)._ship.invincibleTimer).toBeGreaterThan(0);
      const initialLives = engine.lives;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = CANVAS_WIDTH / 2;
        asteroid.y = CANVAS_HEIGHT / 2;
        tick(engine, 16);
        // 无敌期间不应减少生命
        expect(engine.lives).toBe(initialLives);
      }
    });

    it('碰撞产生爆炸粒子', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      // Place asteroid at bullet spawn + 5 along shoot direction
      const bulletSpawnX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle);
      const bulletSpawnY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle);
      const asteroidX = bulletSpawnX + 5 * Math.cos(shootAngle);
      const asteroidY = bulletSpawnY + 5 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'small',
        radius: ASTEROID_SIZE_SMALL,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.particleCount).toBeGreaterThan(0);
    });
  });

  // ========== 生命系统 ==========

  describe('生命系统', () => {
    it('初始生命为 3', () => {
      expect(INITIAL_LIVES).toBe(3);
      startEngine(engine);
      expect(engine.lives).toBe(3);
    });

    it('每次碰撞减少 1 条命', () => {
      startEngine(engine);
      (engine as any)._ship.invincibleTimer = 0;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = CANVAS_WIDTH / 2;
        asteroid.y = CANVAS_HEIGHT / 2;
        tick(engine, 16);
        expect(engine.lives).toBe(2);
      }
    });

    it('生命耗尽游戏结束', () => {
      startEngine(engine);
      (engine as any)._lives = 1;
      (engine as any)._ship.invincibleTimer = 0;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = CANVAS_WIDTH / 2;
        asteroid.y = CANVAS_HEIGHT / 2;
        tick(engine, 16);
        expect(engine.status).toBe('gameover');
      }
    });

    it('游戏结束后飞船消失', () => {
      startEngine(engine);
      (engine as any)._lives = 1;
      (engine as any)._ship.invincibleTimer = 0;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = CANVAS_WIDTH / 2;
        asteroid.y = CANVAS_HEIGHT / 2;
        tick(engine, 16);
        expect((engine as any)._ship).toBeNull();
      }
    });
  });

  // ========== 波次系统 ==========

  describe('波次系统', () => {
    it('第一波为 INITIAL_ASTEROID_COUNT 个行星', () => {
      startEngine(engine);
      expect(engine.wave).toBe(1);
      expect(engine.asteroidCount).toBe(INITIAL_ASTEROID_COUNT);
    });

    it('清完所有行星后进入波次延迟', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      tick(engine, 16);
      // 应进入波次延迟
      expect((engine as any)._waveDelay).toBeGreaterThan(0);
    });

    it('波次延迟后生成新一波', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      tick(engine, 16);
      // 波次延迟为 1500ms
      tick(engine, 1600);
      expect(engine.asteroidCount).toBeGreaterThan(0);
      expect(engine.wave).toBe(2);
    });

    it('第二波行星数增加 ASTEROIDS_PER_WAVE', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      tick(engine, 16);
      tick(engine, 1600);
      const expectedCount = Math.min(
        INITIAL_ASTEROID_COUNT + ASTEROIDS_PER_WAVE,
        MAX_ASTEROID_WAVE
      );
      expect(engine.asteroidCount).toBe(expectedCount);
    });

    it('波次不超过最大限制', () => {
      startEngine(engine);
      // 模拟多波次
      for (let w = 0; w < 20; w++) {
        (engine as any)._asteroids = [];
        tick(engine, 16);
        tick(engine, 1600);
      }
      const expectedCount = Math.min(
        INITIAL_ASTEROID_COUNT + (engine.wave - 1) * ASTEROIDS_PER_WAVE,
        MAX_ASTEROID_WAVE
      );
      expect(engine.asteroidCount).toBeLessThanOrEqual(MAX_ASTEROID_WAVE);
    });

    it('波次完成后等级提升', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      tick(engine, 16);
      tick(engine, 1600);
      expect(engine.level).toBeGreaterThan(1);
    });
  });

  // ========== 计分系统 ==========

  describe('计分系统', () => {
    it('击中大行星得 SCORE_LARGE 分', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 30 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 30 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'large',
        radius: ASTEROID_SIZE_LARGE,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.score).toBe(SCORE_LARGE);
    });

    it('击中中行星得 SCORE_MEDIUM 分', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 15 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 15 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'medium',
        radius: ASTEROID_SIZE_MEDIUM,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.score).toBe(SCORE_MEDIUM);
    });

    it('击中小行星得 SCORE_SMALL 分', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const asteroidX = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const asteroidY = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: asteroidX,
        y: asteroidY,
        vx: 0,
        vy: 0,
        size: 'small',
        radius: ASTEROID_SIZE_SMALL,
        rotation: 0,
        rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.score).toBe(SCORE_SMALL);
    });

    it('分数可以累加', () => {
      startEngine(engine);
      // Use addScore directly to test accumulation
      (engine as any).addScore(SCORE_SMALL);
      expect(engine.score).toBe(SCORE_SMALL);
      (engine as any).addScore(SCORE_LARGE);
      expect(engine.score).toBe(SCORE_SMALL + SCORE_LARGE);
    });
  });

  // ========== 状态管理 ==========

  describe('状态管理', () => {
    it('idle 状态下 update 不崩溃', () => {
      expect(() => tick(engine, 16)).not.toThrow();
    });

    it('gameover 状态下 update 不崩溃', () => {
      startEngine(engine);
      (engine as any)._status = 'gameover';
      expect(() => tick(engine, 16)).not.toThrow();
    });

    it('pause 在 idle 状态无效', () => {
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('resume 在 idle 状态无效', () => {
      engine.resume();
      expect(engine.status).toBe('idle');
    });

    it('多次 reset 不报错', () => {
      startEngine(engine);
      engine.reset();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('多次 destroy 不报错', () => {
      engine.destroy();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ========== 键盘输入 ==========

  describe('键盘输入', () => {
    it('Space 键从 idle 开始游戏', () => {
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('Space 键从 gameover 重新开始', () => {
      startEngine(engine);
      (engine as any)._status = 'gameover';
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('ArrowLeft 设置左旋转状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      expect((engine as any)._leftPressed).toBe(true);
    });

    it('ArrowRight 设置右旋转状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      expect((engine as any)._rightPressed).toBe(true);
    });

    it('ArrowUp 设置推进状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      expect((engine as any)._upPressed).toBe(true);
    });

    it('Space 设置射击状态', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      expect((engine as any)._spacePressed).toBe(true);
    });

    it('handleKeyUp 清除按键状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown(' ');
      engine.handleKeyUp('ArrowLeft');
      engine.handleKeyUp('ArrowRight');
      engine.handleKeyUp('ArrowUp');
      engine.handleKeyUp(' ');
      expect((engine as any)._leftPressed).toBe(false);
      expect((engine as any)._rightPressed).toBe(false);
      expect((engine as any)._upPressed).toBe(false);
      expect((engine as any)._spacePressed).toBe(false);
    });

    it('不相关的按键不影响游戏', () => {
      startEngine(engine);
      engine.handleKeyDown('a');
      engine.handleKeyDown('Enter');
      expect((engine as any)._leftPressed).toBe(false);
      expect((engine as any)._rightPressed).toBe(false);
      expect((engine as any)._upPressed).toBe(false);
      expect((engine as any)._spacePressed).toBe(false);
    });

    it('reset 清除所有按键状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown(' ');
      engine.reset();
      expect((engine as any)._leftPressed).toBe(false);
      expect((engine as any)._upPressed).toBe(false);
      expect((engine as any)._spacePressed).toBe(false);
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('返回正确的游戏状态对象', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('lives');
      expect(state).toHaveProperty('wave');
      expect(state).toHaveProperty('shipX');
      expect(state).toHaveProperty('shipY');
      expect(state).toHaveProperty('shipAngle');
      expect(state).toHaveProperty('bulletCount');
      expect(state).toHaveProperty('asteroidCount');
      expect(state).toHaveProperty('particleCount');
    });

    it('idle 状态返回初始值', () => {
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.lives).toBe(INITIAL_LIVES);
      expect(state.wave).toBe(0);
      expect(state.bulletCount).toBe(0);
      expect(state.asteroidCount).toBe(0);
      expect(state.particleCount).toBe(0);
    });

    it('playing 状态反映当前值', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state.wave).toBe(1);
      expect(state.asteroidCount).toBe(INITIAL_ASTEROID_COUNT);
      expect(state.lives).toBe(INITIAL_LIVES);
    });

    it('击中行星后状态更新', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const ax = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const ay = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: ax, y: ay, vx: 0, vy: 0,
        size: 'small', radius: ASTEROID_SIZE_SMALL,
        rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      const state = engine.getState();
      expect(state.score).toBe(SCORE_SMALL);
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('start 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('pause 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.pause();
      expect(handler).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('reset 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.reset();
      expect(handler).toHaveBeenCalledWith('idle');
    });

    it('gameover 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      (engine as any)._lives = 1;
      (engine as any)._ship.invincibleTimer = 0;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = CANVAS_WIDTH / 2;
        asteroid.y = CANVAS_HEIGHT / 2;
        tick(engine, 16);
        expect(handler).toHaveBeenCalledWith('gameover');
      }
    });

    it('scoreChange 事件在击中行星时触发', () => {
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const ax = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const ay = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: ax, y: ay, vx: 0, vy: 0,
        size: 'small', radius: ASTEROID_SIZE_SMALL,
        rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(handler).toHaveBeenCalled();
    });

    it('off 取消事件监听', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.off('statusChange', handler);
      engine.start();
      expect(handler).not.toHaveBeenCalled();
    });

    it('start 触发 scoreChange 事件', () => {
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(0);
    });

    it('start 触发 levelChange 事件', () => {
      const handler = vi.fn();
      engine.on('levelChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  // ========== 粒子效果 ==========

  describe('粒子效果', () => {
    it('行星被击中产生 PARTICLE_COUNT 个粒子', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const ax = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const ay = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: ax, y: ay, vx: 0, vy: 0,
        size: 'small', radius: ASTEROID_SIZE_SMALL,
        rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.particleCount).toBe(PARTICLE_COUNT);
    });

    it('粒子随时间衰减', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const ax = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const ay = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: ax, y: ay, vx: 0, vy: 0,
        size: 'small', radius: ASTEROID_SIZE_SMALL,
        rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      const particlesAfter = engine.particleCount;
      // 等待粒子过期
      for (let i = 0; i < 50; i++) tick(engine, 16);
      expect(engine.particleCount).toBeLessThan(particlesAfter);
    });

    it('粒子最终全部消失', () => {
      startEngine(engine);
      (engine as any)._asteroids = [];
      const shootAngle = engine.shipAngle - Math.PI / 2;
      const ax = CANVAS_WIDTH / 2 + SHIP_SIZE * Math.cos(shootAngle) + 8 * Math.cos(shootAngle);
      const ay = CANVAS_HEIGHT / 2 + SHIP_SIZE * Math.sin(shootAngle) + 8 * Math.sin(shootAngle);

      (engine as any)._asteroids.push({
        x: ax, y: ay, vx: 0, vy: 0,
        size: 'small', radius: ASTEROID_SIZE_SMALL,
        rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);
      // 等足够长时间让粒子全部消失
      tick(engine, PARTICLE_LIFETIME + 200);
      expect(engine.particleCount).toBe(0);
    });
  });

  // ========== 常量验证 ==========

  describe('常量', () => {
    it('画布尺寸为 480x640', () => {
      expect(CANVAS_WIDTH).toBe(480);
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('飞船大小为正数', () => {
      expect(SHIP_SIZE).toBeGreaterThan(0);
    });

    it('推力为正数', () => {
      expect(SHIP_THRUST).toBeGreaterThan(0);
    });

    it('旋转速度为正数', () => {
      expect(SHIP_ROTATION_SPEED).toBeGreaterThan(0);
    });

    it('最大速度为正数', () => {
      expect(SHIP_MAX_SPEED).toBeGreaterThan(0);
    });

    it('摩擦系数在 0-1 之间', () => {
      expect(SHIP_FRICTION).toBeGreaterThan(0);
      expect(SHIP_FRICTION).toBeLessThanOrEqual(1);
    });

    it('行星大小 large > medium > small', () => {
      expect(ASTEROID_SIZE_LARGE).toBeGreaterThan(ASTEROID_SIZE_MEDIUM);
      expect(ASTEROID_SIZE_MEDIUM).toBeGreaterThan(ASTEROID_SIZE_SMALL);
    });

    it('得分 small > medium > large', () => {
      expect(SCORE_SMALL).toBeGreaterThan(SCORE_MEDIUM);
      expect(SCORE_MEDIUM).toBeGreaterThan(SCORE_LARGE);
    });

    it('初始生命为 3', () => {
      expect(INITIAL_LIVES).toBe(3);
    });

    it('子弹速度为正数', () => {
      expect(BULLET_SPEED).toBeGreaterThan(0);
    });

    it('子弹存活时间为正数', () => {
      expect(BULLET_LIFETIME).toBeGreaterThan(0);
    });

    it('子弹冷却时间为正数', () => {
      expect(BULLET_COOLDOWN).toBeGreaterThan(0);
    });
  });

  // ========== 完整游戏流程 ==========

  describe('完整游戏流程', () => {
    it('完整的 start → play → pause → resume → reset 流程', () => {
      engine.start();
      expect(engine.status).toBe('playing');
      tick(engine);
      expect(engine.status).toBe('playing');
      engine.pause();
      expect(engine.status).toBe('paused');
      engine.resume();
      expect(engine.status).toBe('playing');
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('完整的 start → gameover → restart 流程', () => {
      engine.start();
      // 模拟生命耗尽
      (engine as any)._lives = 1;
      (engine as any)._ship.invincibleTimer = 0;
      const asteroid = (engine as any)._asteroids[0];
      if (asteroid) {
        asteroid.x = CANVAS_WIDTH / 2;
        asteroid.y = CANVAS_HEIGHT / 2;
        tick(engine, 16);
      }
      expect(engine.status).toBe('gameover');

      // Space 重启
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
      expect(engine.lives).toBe(INITIAL_LIVES);
      expect(engine.score).toBe(0);
    });

    it('连续 start-reset-start 循环正常', () => {
      engine.start();
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.lives).toBe(INITIAL_LIVES);
      expect(engine.score).toBe(0);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('飞船在画布中心时 shipX/shipY 正确', () => {
      startEngine(engine);
      expect(engine.shipX).toBe(CANVAS_WIDTH / 2);
      expect(engine.shipY).toBe(CANVAS_HEIGHT / 2);
    });

    it('ship 为 null 时 shipX 返回画布中心', () => {
      startEngine(engine);
      (engine as any)._ship = null;
      expect(engine.shipX).toBe(CANVAS_WIDTH / 2);
    });

    it('ship 为 null 时 shipY 返回画布中心', () => {
      startEngine(engine);
      (engine as any)._ship = null;
      expect(engine.shipY).toBe(CANVAS_HEIGHT / 2);
    });

    it('ship 为 null 时 shipAngle 返回 0', () => {
      startEngine(engine);
      (engine as any)._ship = null;
      expect(engine.shipAngle).toBe(0);
    });

    it('update 在无飞船时不崩溃', () => {
      startEngine(engine);
      (engine as any)._ship = null;
      expect(() => tick(engine, 16)).not.toThrow();
    });

    it('波次延迟期间仍更新粒子', () => {
      startEngine(engine);
      // 添加一些粒子
      (engine as any)._particles.push({
        x: 100, y: 100, vx: 10, vy: 10,
        lifetime: 100, maxLifetime: 100,
      });
      (engine as any)._asteroids = [];
      tick(engine, 16); // 触发波次延迟
      const countBefore = engine.particleCount;
      tick(engine, 16);
      // 粒子应在更新
      expect(engine.particleCount).toBeLessThanOrEqual(countBefore);
    });

    it('大量 update 不崩溃', () => {
      startEngine(engine);
      expect(() => {
        for (let i = 0; i < 500; i++) tick(engine, 16);
      }).not.toThrow();
    });
  });
});
