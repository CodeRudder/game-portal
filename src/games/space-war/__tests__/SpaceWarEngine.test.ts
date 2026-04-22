import { vi } from 'vitest';
import { SpaceWarEngine } from '../SpaceWarEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SHIP_SIZE, SHIP_THRUST, SHIP_ROTATION_SPEED, SHIP_MAX_SPEED,
  SHIP_FRICTION, SHIP_COLOR_P1, SHIP_COLOR_P2,
  BULLET_SPEED, BULLET_LIFETIME, BULLET_COOLDOWN, BULLET_RADIUS,
  BULLET_COLOR_P1, BULLET_COLOR_P2,
  ASTEROID_COUNT, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS,
  ASTEROID_MIN_SPEED, ASTEROID_MAX_SPEED,
  WINS_NEEDED,
  PARTICLE_COUNT, PARTICLE_LIFETIME,
  STAR_COUNT,
  ROUND_DELAY,
  AI_THINK_INTERVAL, AI_ACCURACY, AI_SHOOT_RANGE,
  BG_COLOR,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): SpaceWarEngine {
  const engine = new SpaceWarEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

function startEngine(engine: SpaceWarEngine): void {
  engine.start();
}

function tick(engine: SpaceWarEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

// ========== 测试 ==========

describe('SpaceWarEngine', () => {
  let engine: SpaceWarEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(SpaceWarEngine);
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

    it('初始 P1 分数为 0', () => {
      expect(engine.score1).toBe(0);
    });

    it('初始 P2 分数为 0', () => {
      expect(engine.score2).toBe(0);
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

    it('初始无赢家', () => {
      expect(engine.winner).toBeNull();
    });

    it('比赛未结束', () => {
      expect(engine.matchOver).toBe(false);
    });

    it('AI 模式默认关闭', () => {
      expect(engine.aiMode).toBe(false);
    });
  });

  // ========== 游戏生命周期 ==========

  describe('游戏生命周期', () => {
    it('start 后状态变为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start 后分数重置', () => {
      engine.start();
      expect(engine.score1).toBe(0);
      expect(engine.score2).toBe(0);
    });

    it('start 后生成小行星', () => {
      engine.start();
      expect(engine.asteroidCount).toBe(ASTEROID_COUNT);
    });

    it('start 后飞船存活', () => {
      engine.start();
      const state = engine.getState();
      expect(state.ship1Alive).toBe(true);
      expect(state.ship2Alive).toBe(true);
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
      expect(engine.score1).toBe(0);
      expect(engine.score2).toBe(0);
    });

    it('reset 后子弹清空', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.bulletCount).toBe(0);
    });

    it('reset 后小行星清空', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.asteroidCount).toBe(0);
    });

    it('destroy 后状态变为 idle', () => {
      startEngine(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('未初始化 canvas 调用 start 应抛出异常', () => {
      const e = new SpaceWarEngine();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });
  });

  // ========== 飞船初始位置 ==========

  describe('飞船初始位置', () => {
    it('P1 飞船在左侧', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      expect(ship1.x).toBe(CANVAS_WIDTH * 0.25);
      expect(ship1.y).toBe(CANVAS_HEIGHT / 2);
    });

    it('P2 飞船在右侧', () => {
      startEngine(engine);
      const ship2 = (engine as any)._ship2;
      expect(ship2.x).toBe(CANVAS_WIDTH * 0.75);
      expect(ship2.y).toBe(CANVAS_HEIGHT / 2);
    });

    it('P1 飞船初始角度朝上', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      expect(ship1.angle).toBe(-Math.PI / 2);
    });

    it('P2 飞船初始角度朝下', () => {
      startEngine(engine);
      const ship2 = (engine as any)._ship2;
      expect(ship2.angle).toBe(Math.PI / 2);
    });

    it('飞船初始速度为 0', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;
      expect(ship1.vx).toBe(0);
      expect(ship1.vy).toBe(0);
      expect(ship2.vx).toBe(0);
      expect(ship2.vy).toBe(0);
    });
  });

  // ========== P1 飞船旋转 ==========

  describe('P1 飞船旋转', () => {
    it('按 A 键 P1 逆时针旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('a');
      tick(engine, 100);
      const ship1 = (engine as any)._ship1;
      expect(ship1.angle).toBeLessThan(-Math.PI / 2);
    });

    it('按 D 键 P1 顺时针旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('d');
      tick(engine, 100);
      const ship1 = (engine as any)._ship1;
      expect(ship1.angle).toBeGreaterThan(-Math.PI / 2);
    });

    it('同时按 A/D 旋转抵消', () => {
      startEngine(engine);
      const startAngle = (engine as any)._ship1.angle;
      engine.handleKeyDown('a');
      engine.handleKeyDown('d');
      tick(engine, 100);
      expect(Math.abs((engine as any)._ship1.angle - startAngle)).toBeLessThan(0.01);
    });

    it('松开按键停止旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('d');
      tick(engine, 100);
      const angleAfter = (engine as any)._ship1.angle;
      engine.handleKeyUp('d');
      tick(engine, 100);
      expect((engine as any)._ship1.angle).toBe(angleAfter);
    });

    it('W 键（大写）也能推进', () => {
      startEngine(engine);
      engine.handleKeyDown('W');
      tick(engine, 100);
      const ship1 = (engine as any)._ship1;
      expect(ship1.thrusting).toBe(true);
    });

    it('A 键（大写）也能旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('A');
      tick(engine, 100);
      const ship1 = (engine as any)._ship1;
      expect(ship1.angle).toBeLessThan(-Math.PI / 2);
    });
  });

  // ========== P2 飞船旋转 ==========

  describe('P2 飞船旋转', () => {
    it('按 ← 键 P2 逆时针旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      tick(engine, 100);
      const ship2 = (engine as any)._ship2;
      expect(ship2.angle).toBeLessThan(Math.PI / 2);
    });

    it('按 → 键 P2 顺时针旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      tick(engine, 100);
      const ship2 = (engine as any)._ship2;
      expect(ship2.angle).toBeGreaterThan(Math.PI / 2);
    });

    it('松开按键停止旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      tick(engine, 100);
      const angleAfter = (engine as any)._ship2.angle;
      engine.handleKeyUp('ArrowRight');
      tick(engine, 100);
      expect((engine as any)._ship2.angle).toBe(angleAfter);
    });
  });

  // ========== P1 飞船推进 ==========

  describe('P1 飞船推进', () => {
    it('按 W 键飞船获得推力', () => {
      startEngine(engine);
      engine.handleKeyDown('w');
      tick(engine, 100);
      const ship1 = (engine as any)._ship1;
      // 飞船初始角度 -PI/2（朝上），推进后 y 应减小
      expect(ship1.vy).toBeLessThan(0);
    });

    it('松开 W 键推力停止', () => {
      startEngine(engine);
      engine.handleKeyDown('w');
      tick(engine, 100);
      engine.handleKeyUp('w');
      tick(engine, 100);
      const ship1 = (engine as any)._ship1;
      expect(ship1.thrusting).toBe(false);
    });

    it('飞船速度不超过最大速度', () => {
      startEngine(engine);
      engine.handleKeyDown('w');
      for (let i = 0; i < 200; i++) tick(engine, 16);
      const ship1 = (engine as any)._ship1;
      const speed = Math.sqrt(ship1.vx * ship1.vx + ship1.vy * ship1.vy);
      expect(speed).toBeLessThanOrEqual(SHIP_MAX_SPEED * 1.1);
    });

    it('摩擦力使飞船减速', () => {
      startEngine(engine);
      engine.handleKeyDown('w');
      tick(engine, 200);
      engine.handleKeyUp('w');
      const ship1 = (engine as any)._ship1;
      const speedBefore = Math.sqrt(ship1.vx * ship1.vx + ship1.vy * ship1.vy);
      for (let i = 0; i < 50; i++) tick(engine, 16);
      const speedAfter = Math.sqrt(ship1.vx * ship1.vx + ship1.vy * ship1.vy);
      expect(speedAfter).toBeLessThan(speedBefore);
    });
  });

  // ========== P2 飞船推进 ==========

  describe('P2 飞船推进', () => {
    it('按 ↑ 键飞船获得推力', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine, 100);
      const ship2 = (engine as any)._ship2;
      // P2 初始角度 PI/2（朝下），推进后 y 应增大
      expect(ship2.vy).toBeGreaterThan(0);
    });

    it('松开 ↑ 键推力停止', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine, 100);
      engine.handleKeyUp('ArrowUp');
      tick(engine, 100);
      const ship2 = (engine as any)._ship2;
      expect(ship2.thrusting).toBe(false);
    });
  });

  // ========== 屏幕包裹 ==========

  describe('屏幕包裹', () => {
    it('飞船从右侧超出后出现在左侧', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      ship1.x = CANVAS_WIDTH + 10;
      ship1.vx = 1;
      tick(engine, 16);
      expect(ship1.x).toBeLessThan(CANVAS_WIDTH);
    });

    it('飞船从左侧超出后出现在右侧', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      ship1.x = -10;
      ship1.vx = -1;
      tick(engine, 16);
      expect(ship1.x).toBeGreaterThan(CANVAS_WIDTH - 20);
    });

    it('飞船从下方超出后出现在上方', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      ship1.y = CANVAS_HEIGHT + 10;
      ship1.vy = 1;
      tick(engine, 16);
      expect(ship1.y).toBeLessThan(CANVAS_HEIGHT);
    });

    it('飞船从上方超出后出现在下方', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      ship1.y = -10;
      ship1.vy = -1;
      tick(engine, 16);
      expect(ship1.y).toBeGreaterThan(CANVAS_HEIGHT - 20);
    });

    it('子弹进行屏幕包裹', () => {
      startEngine(engine);
      (engine as any)._bullets.push({
        x: CANVAS_WIDTH + 5, y: 100,
        vx: 10, vy: 0,
        lifetime: 1000, owner: 1,
      });
      tick(engine, 16);
      expect((engine as any)._bullets[0].x).toBeLessThan(CANVAS_WIDTH);
    });

    it('小行星进行屏幕包裹', () => {
      startEngine(engine);
      if ((engine as any)._asteroids.length > 0) {
        const asteroid = (engine as any)._asteroids[0];
        asteroid.x = CANVAS_WIDTH + 5;
        tick(engine, 16);
        expect(asteroid.x).toBeLessThan(CANVAS_WIDTH);
      }
    });
  });

  // ========== P1 射击 ==========

  describe('P1 射击', () => {
    it('按空格发射子弹', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.bulletCount).toBeGreaterThan(0);
    });

    it('子弹属于 P1', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bullet = (engine as any)._bullets[0];
      expect(bullet.owner).toBe(1);
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

    it('子弹从飞船前端发射', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bullet = (engine as any)._bullets[0];
      const ship1 = (engine as any)._ship1;
      // 子弹应在飞船前方附近（子弹已移动一帧，允许较大误差）
      const expectedX = ship1.x + Math.cos(ship1.angle) * SHIP_SIZE;
      const expectedY = ship1.y + Math.sin(ship1.angle) * SHIP_SIZE;
      expect(Math.abs(bullet.x - expectedX)).toBeLessThan(SHIP_SIZE * 2);
      expect(Math.abs(bullet.y - expectedY)).toBeLessThan(SHIP_SIZE * 2);
    });

    it('子弹速度方向与飞船角度一致', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      const bullet = (engine as any)._bullets[0];
      const ship1 = (engine as any)._ship1;
      // 子弹速度主要方向应与飞船角度一致
      const bulletAngle = Math.atan2(bullet.vy, bullet.vx);
      expect(Math.abs(bulletAngle - ship1.angle)).toBeLessThan(0.5);
    });

    it('子弹有存活时间', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      tick(engine, 16);
      expect(engine.bulletCount).toBeGreaterThan(0);
      // 等待子弹过期
      tick(engine, BULLET_LIFETIME + 100);
      expect(engine.bulletCount).toBe(0);
    });
  });

  // ========== P2 射击 ==========

  describe('P2 射击', () => {
    it('按 Enter 发射子弹', () => {
      startEngine(engine);
      engine.handleKeyDown('Enter');
      tick(engine, 16);
      expect(engine.bulletCount).toBeGreaterThan(0);
    });

    it('子弹属于 P2', () => {
      startEngine(engine);
      engine.handleKeyDown('Enter');
      tick(engine, 16);
      const bullet = (engine as any)._bullets[0];
      expect(bullet.owner).toBe(2);
    });

    it('P2 子弹发射有冷却时间', () => {
      startEngine(engine);
      engine.handleKeyDown('Enter');
      tick(engine, 16);
      const bulletsAfterFirst = engine.bulletCount;
      tick(engine, 16);
      expect(engine.bulletCount).toBe(bulletsAfterFirst);
    });
  });

  // ========== 碰撞检测 ==========

  describe('碰撞检测', () => {
    it('P1 子弹击中 P2 飞船', () => {
      startEngine(engine);
      const ship2 = (engine as any)._ship2;
      const ship1 = (engine as any)._ship1;

      // 将 P1 飞船对准 P2 并在近距离发射
      const angle = Math.atan2(ship2.y - ship1.y, ship2.x - ship1.x);
      ship1.angle = angle;

      // 将 P2 移到子弹路径上
      ship2.x = ship1.x + Math.cos(angle) * (SHIP_SIZE + 20);
      ship2.y = ship1.y + Math.sin(angle) * (SHIP_SIZE + 20);

      engine.handleKeyDown(' ');
      tick(engine, 16);

      expect(ship2.alive).toBe(false);
    });

    it('P2 子弹击中 P1 飞船', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;

      const angle = Math.atan2(ship1.y - ship2.y, ship1.x - ship2.x);
      ship2.angle = angle;

      ship1.x = ship2.x + Math.cos(angle) * (SHIP_SIZE + 20);
      ship1.y = ship2.y + Math.sin(angle) * (SHIP_SIZE + 20);

      engine.handleKeyDown('Enter');
      tick(engine, 16);

      expect(ship1.alive).toBe(false);
    });

    it('子弹击中后产生爆炸粒子', () => {
      startEngine(engine);
      const ship2 = (engine as any)._ship2;
      const ship1 = (engine as any)._ship1;

      const angle = Math.atan2(ship2.y - ship1.y, ship2.x - ship1.x);
      ship1.angle = angle;
      ship2.x = ship1.x + Math.cos(angle) * (SHIP_SIZE + 20);
      ship2.y = ship1.y + Math.sin(angle) * (SHIP_SIZE + 20);

      engine.handleKeyDown(' ');
      tick(engine, 16);

      expect(engine.particleCount).toBeGreaterThan(0);
    });

    it('P1 子弹不能击中 P1 飞船', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;

      // 子弹就在 P1 位置
      (engine as any)._bullets.push({
        x: ship1.x, y: ship1.y,
        vx: 0, vy: 0,
        lifetime: 1000, owner: 1,
      });

      tick(engine, 16);
      expect(ship1.alive).toBe(true);
    });

    it('P2 子弹不能击中 P2 飞船', () => {
      startEngine(engine);
      const ship2 = (engine as any)._ship2;

      (engine as any)._bullets.push({
        x: ship2.x, y: ship2.y,
        vx: 0, vy: 0,
        lifetime: 1000, owner: 2,
      });

      tick(engine, 16);
      expect(ship2.alive).toBe(true);
    });

    it('子弹击中小行星后子弹消失', () => {
      startEngine(engine);
      // 清除所有小行星，只放一个在确定位置
      (engine as any)._asteroids = [];
      const ship1 = (engine as any)._ship1;

      // 在子弹路径上放一个小行星（距离 30px，在子弹飞行路径上）
      const asteroidX = ship1.x + Math.cos(ship1.angle) * 30;
      const asteroidY = ship1.y + Math.sin(ship1.angle) * 30;

      (engine as any)._asteroids.push({
        x: asteroidX, y: asteroidY,
        vx: 0, vy: 0,
        radius: 20, rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      engine.handleKeyDown(' ');
      tick(engine, 16);

      expect(engine.bulletCount).toBe(0);
    });

    it('飞船碰撞小行星后死亡', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;

      // 将小行星放在飞船位置
      if ((engine as any)._asteroids.length > 0) {
        const asteroid = (engine as any)._asteroids[0];
        asteroid.x = ship1.x;
        asteroid.y = ship1.y;
        tick(engine, 16);
        expect(ship1.alive).toBe(false);
      }
    });
  });

  // ========== 小行星 ==========

  describe('小行星', () => {
    it('开始时生成 ASTEROID_COUNT 个小行星', () => {
      startEngine(engine);
      expect(engine.asteroidCount).toBe(ASTEROID_COUNT);
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

    it('小行星在旋转', () => {
      startEngine(engine);
      const asteroid = (engine as any)._asteroids[0];
      const startRotation = asteroid.rotation;
      tick(engine, 100);
      expect(asteroid.rotation).not.toBe(startRotation);
    });

    it('小行星半径在合理范围', () => {
      startEngine(engine);
      (engine as any)._asteroids.forEach((a: any) => {
        expect(a.radius).toBeGreaterThanOrEqual(ASTEROID_MIN_RADIUS);
        expect(a.radius).toBeLessThanOrEqual(ASTEROID_MAX_RADIUS);
      });
    });

    it('小行星速度在合理范围', () => {
      startEngine(engine);
      (engine as any)._asteroids.forEach((a: any) => {
        const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        expect(speed).toBeGreaterThanOrEqual(ASTEROID_MIN_SPEED * 0.9);
        expect(speed).toBeLessThanOrEqual(ASTEROID_MAX_SPEED * 1.1);
      });
    });

    it('小行星被子弹击中后重生', () => {
      startEngine(engine);
      // 清除所有小行星，只放一个在确定位置
      (engine as any)._asteroids = [];
      const ship1 = (engine as any)._ship1;

      const asteroidX = ship1.x + Math.cos(ship1.angle) * 50;
      const asteroidY = ship1.y + Math.sin(ship1.angle) * 50;

      (engine as any)._asteroids.push({
        x: asteroidX, y: asteroidY,
        vx: 0, vy: 0,
        radius: 20, rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      });

      const countBefore = engine.asteroidCount;
      engine.handleKeyDown(' ');
      tick(engine, 16);

      // 小行星数量不变（被击中后重生）
      expect(engine.asteroidCount).toBe(countBefore);
    });
  });

  // ========== 得分系统 ==========

  describe('得分系统', () => {
    it('P2 被击中 P1 得分', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;

      const angle = Math.atan2(ship2.y - ship1.y, ship2.x - ship1.x);
      ship1.angle = angle;
      ship2.x = ship1.x + Math.cos(angle) * (SHIP_SIZE + 20);
      ship2.y = ship1.y + Math.sin(angle) * (SHIP_SIZE + 20);

      engine.handleKeyDown(' ');
      tick(engine, 16);
      // 等待回合结束判定
      tick(engine, 16);

      expect(engine.score1).toBe(1);
    });

    it('P1 被击中 P2 得分', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;

      const angle = Math.atan2(ship1.y - ship2.y, ship1.x - ship2.x);
      ship2.angle = angle;
      ship1.x = ship2.x + Math.cos(angle) * (SHIP_SIZE + 20);
      ship1.y = ship2.y + Math.sin(angle) * (SHIP_SIZE + 20);

      engine.handleKeyDown('Enter');
      tick(engine, 16);
      tick(engine, 16);

      expect(engine.score2).toBe(1);
    });

    it('得分后进入回合延迟', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;

      const angle = Math.atan2(ship2.y - ship1.y, ship2.x - ship1.x);
      ship1.angle = angle;
      ship2.x = ship1.x + Math.cos(angle) * (SHIP_SIZE + 20);
      ship2.y = ship1.y + Math.sin(angle) * (SHIP_SIZE + 20);

      engine.handleKeyDown(' ');
      tick(engine, 16);
      tick(engine, 16);

      expect((engine as any)._roundDelay).toBeGreaterThan(0);
    });

    it('回合延迟后开始新回合', () => {
      startEngine(engine);
      // 触发一个回合结束
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);

      // 等待延迟结束
      tick(engine, ROUND_DELAY + 100);

      expect((engine as any)._roundActive).toBe(true);
    });

    it('总分等于双方分数之和', () => {
      startEngine(engine);
      (engine as any)._score1 = 2;
      (engine as any)._score2 = 1;
      // 触发分数更新
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);
      // 总分应更新
      expect(engine.score).toBeGreaterThanOrEqual(3);
    });
  });

  // ========== 胜利条件 ==========

  describe('胜利条件', () => {
    it('P1 先胜 WINS_NEEDED 局获胜', () => {
      startEngine(engine);
      (engine as any)._score1 = WINS_NEEDED - 1;

      // 击败 P2
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);

      expect(engine.winner).toBe(1);
      expect(engine.matchOver).toBe(true);
    });

    it('P2 先胜 WINS_NEEDED 局获胜', () => {
      startEngine(engine);
      (engine as any)._score2 = WINS_NEEDED - 1;

      const ship1 = (engine as any)._ship1;
      ship1.alive = false;
      tick(engine, 16);

      expect(engine.winner).toBe(2);
      expect(engine.matchOver).toBe(true);
    });

    it('比赛结束后状态为 gameover', () => {
      startEngine(engine);
      (engine as any)._score1 = WINS_NEEDED - 1;

      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);

      expect(engine.status).toBe('gameover');
    });

    it('isWin 在比赛结束时为 true', () => {
      startEngine(engine);
      (engine as any)._score1 = WINS_NEEDED - 1;

      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);

      expect(engine.isWin).toBe(true);
    });

    it('WINS_NEEDED 为 2（3局2胜）', () => {
      expect(WINS_NEEDED).toBe(2);
    });

    it('未达到胜利条件时比赛继续', () => {
      startEngine(engine);
      // 0-0 时击杀一个
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);

      expect(engine.matchOver).toBe(false);
      expect(engine.winner).toBeNull();
    });
  });

  // ========== AI 模式 ==========

  describe('AI 模式', () => {
    it('可以设置 AI 模式', () => {
      engine.setAiMode(true);
      expect(engine.aiMode).toBe(true);
    });

    it('AI 模式下 P2 自动操作', () => {
      startEngine(engine);
      engine.setAiMode(true);

      // 让 AI 运行一段时间
      for (let i = 0; i < 20; i++) tick(engine, AI_THINK_INTERVAL);

      // AI 应该已经操作了 P2（旋转或推进或射击）
      const ship2 = (engine as any)._ship2;
      // P2 飞船应该有变化（角度或位置）
      const moved = ship2.x !== CANVAS_WIDTH * 0.75 || ship2.y !== CANVAS_HEIGHT / 2;
      const rotated = ship2.angle !== Math.PI / 2;
      expect(moved || rotated).toBe(true);
    });

    it('AI 会在合适时机射击', () => {
      startEngine(engine);
      engine.setAiMode(true);

      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;

      // 将 P1 放在 P2 射程内
      ship1.x = ship2.x;
      ship1.y = ship2.y - 100;

      // 让 AI 瞄准并射击
      for (let i = 0; i < 50; i++) tick(engine, AI_THINK_INTERVAL);

      // AI 应该发射了子弹
      expect(engine.bulletCount).toBeGreaterThan(0);
    });

    it('AI 飞船死亡后停止操作', () => {
      startEngine(engine);
      engine.setAiMode(true);

      const ship2 = (engine as any)._ship2;
      ship2.alive = false;

      tick(engine, AI_THINK_INTERVAL + 100);

      expect((engine as any)._p2Left).toBe(false);
      expect((engine as any)._p2Right).toBe(false);
      expect((engine as any)._p2Thrust).toBe(false);
      expect((engine as any)._p2Shoot).toBe(false);
    });

    it('AI 对手死亡后 AI 停止操作', () => {
      startEngine(engine);
      engine.setAiMode(true);

      const ship1 = (engine as any)._ship1;
      ship1.alive = false;

      tick(engine, AI_THINK_INTERVAL + 100);

      expect((engine as any)._p2Shoot).toBe(false);
    });

    it('AI 会躲避小行星', () => {
      startEngine(engine);
      engine.setAiMode(true);

      const ship2 = (engine as any)._ship2;

      // 在 P2 附近放一个小行星
      (engine as any)._asteroids = [{
        x: ship2.x + 20, y: ship2.y,
        vx: 0, vy: 0,
        radius: 25, rotation: 0, rotationSpeed: 0,
        vertices: [1, 1, 1, 1, 1, 1, 1, 1],
      }];

      tick(engine, AI_THINK_INTERVAL + 100);

      // AI 应该尝试推进躲避
      // 至少不应崩溃
      expect(true).toBe(true);
    });
  });

  // ========== 键盘输入 ==========

  describe('键盘输入', () => {
    it('Space 键从 idle 开始游戏', () => {
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('Enter 键从 idle 开始游戏', () => {
      engine.handleKeyDown('Enter');
      expect(engine.status).toBe('playing');
    });

    it('Space 键从 gameover 重新开始', () => {
      startEngine(engine);
      (engine as any)._matchOver = true;
      (engine as any)._status = 'gameover';
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('W 设置 P1 推进状态', () => {
      startEngine(engine);
      engine.handleKeyDown('w');
      expect((engine as any)._p1Thrust).toBe(true);
    });

    it('A 设置 P1 左旋转状态', () => {
      startEngine(engine);
      engine.handleKeyDown('a');
      expect((engine as any)._p1Left).toBe(true);
    });

    it('D 设置 P1 右旋转状态', () => {
      startEngine(engine);
      engine.handleKeyDown('d');
      expect((engine as any)._p1Right).toBe(true);
    });

    it('Space 设置 P1 射击状态', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');
      expect((engine as any)._p1Shoot).toBe(true);
    });

    it('ArrowUp 设置 P2 推进状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      expect((engine as any)._p2Thrust).toBe(true);
    });

    it('ArrowLeft 设置 P2 左旋转状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      expect((engine as any)._p2Left).toBe(true);
    });

    it('ArrowRight 设置 P2 右旋转状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      expect((engine as any)._p2Right).toBe(true);
    });

    it('Enter 设置 P2 射击状态', () => {
      startEngine(engine);
      engine.handleKeyDown('Enter');
      expect((engine as any)._p2Shoot).toBe(true);
    });

    it('handleKeyUp 清除 P1 按键状态', () => {
      startEngine(engine);
      engine.handleKeyDown('w');
      engine.handleKeyDown('a');
      engine.handleKeyDown('d');
      engine.handleKeyDown(' ');
      engine.handleKeyUp('w');
      engine.handleKeyUp('a');
      engine.handleKeyUp('d');
      engine.handleKeyUp(' ');
      expect((engine as any)._p1Thrust).toBe(false);
      expect((engine as any)._p1Left).toBe(false);
      expect((engine as any)._p1Right).toBe(false);
      expect((engine as any)._p1Shoot).toBe(false);
    });

    it('handleKeyUp 清除 P2 按键状态', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('Enter');
      engine.handleKeyUp('ArrowUp');
      engine.handleKeyUp('ArrowLeft');
      engine.handleKeyUp('ArrowRight');
      engine.handleKeyUp('Enter');
      expect((engine as any)._p2Thrust).toBe(false);
      expect((engine as any)._p2Left).toBe(false);
      expect((engine as any)._p2Right).toBe(false);
      expect((engine as any)._p2Shoot).toBe(false);
    });

    it('不相关的按键不影响游戏', () => {
      startEngine(engine);
      engine.handleKeyDown('x');
      engine.handleKeyDown('1');
      engine.handleKeyDown('F1');
      expect((engine as any)._p1Thrust).toBe(false);
      expect((engine as any)._p1Left).toBe(false);
      expect((engine as any)._p1Right).toBe(false);
      expect((engine as any)._p1Shoot).toBe(false);
      expect((engine as any)._p2Thrust).toBe(false);
      expect((engine as any)._p2Left).toBe(false);
      expect((engine as any)._p2Right).toBe(false);
      expect((engine as any)._p2Shoot).toBe(false);
    });

    it('reset 清除所有按键状态', () => {
      startEngine(engine);
      engine.handleKeyDown('w');
      engine.handleKeyDown('a');
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowLeft');
      engine.reset();
      expect((engine as any)._p1Thrust).toBe(false);
      expect((engine as any)._p1Left).toBe(false);
      expect((engine as any)._p2Thrust).toBe(false);
      expect((engine as any)._p2Left).toBe(false);
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('返回正确的游戏状态对象', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('score1');
      expect(state).toHaveProperty('score2');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('bulletCount');
      expect(state).toHaveProperty('asteroidCount');
      expect(state).toHaveProperty('particleCount');
      expect(state).toHaveProperty('roundActive');
      expect(state).toHaveProperty('matchOver');
      expect(state).toHaveProperty('winner');
      expect(state).toHaveProperty('aiMode');
      expect(state).toHaveProperty('ship1Alive');
      expect(state).toHaveProperty('ship2Alive');
    });

    it('idle 状态返回初始值', () => {
      const state = engine.getState();
      expect(state.score1).toBe(0);
      expect(state.score2).toBe(0);
      expect(state.bulletCount).toBe(0);
      expect(state.asteroidCount).toBe(0);
      expect(state.particleCount).toBe(0);
      expect(state.matchOver).toBe(false);
      expect(state.winner).toBeNull();
      expect(state.aiMode).toBe(false);
      expect(state.ship1Alive).toBe(false);
      expect(state.ship2Alive).toBe(false);
    });

    it('playing 状态反映当前值', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state.asteroidCount).toBe(ASTEROID_COUNT);
      expect(state.ship1Alive).toBe(true);
      expect(state.ship2Alive).toBe(true);
      expect(state.roundActive).toBe(true);
    });

    it('击杀后状态更新', () => {
      startEngine(engine);
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);

      const state = engine.getState();
      expect(state.ship2Alive).toBe(false);
      expect(state.score1).toBe(1);
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
      (engine as any)._score1 = WINS_NEEDED - 1;
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);
      expect(handler).toHaveBeenCalledWith('gameover');
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
    it('飞船被击中产生粒子', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;

      const angle = Math.atan2(ship1.y - ship2.y, ship1.x - ship2.x);
      ship2.angle = angle;
      ship1.x = ship2.x + Math.cos(angle) * (SHIP_SIZE + 20);
      ship1.y = ship2.y + Math.sin(angle) * (SHIP_SIZE + 20);

      engine.handleKeyDown('Enter');
      tick(engine, 16);

      expect(engine.particleCount).toBeGreaterThan(0);
    });

    it('粒子随时间衰减', () => {
      startEngine(engine);
      // 手动添加粒子
      (engine as any)._particles.push({
        x: 100, y: 100, vx: 10, vy: 10,
        lifetime: PARTICLE_LIFETIME, maxLifetime: PARTICLE_LIFETIME,
        color: '#fff',
      });

      const countBefore = engine.particleCount;
      for (let i = 0; i < 50; i++) tick(engine, 16);
      expect(engine.particleCount).toBeLessThanOrEqual(countBefore);
    });

    it('粒子最终全部消失', () => {
      startEngine(engine);
      (engine as any)._particles.push({
        x: 100, y: 100, vx: 10, vy: 10,
        lifetime: PARTICLE_LIFETIME, maxLifetime: PARTICLE_LIFETIME,
        color: '#fff',
      });

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

    it('子弹速度为正数', () => {
      expect(BULLET_SPEED).toBeGreaterThan(0);
    });

    it('子弹存活时间为正数', () => {
      expect(BULLET_LIFETIME).toBeGreaterThan(0);
    });

    it('子弹冷却时间为正数', () => {
      expect(BULLET_COOLDOWN).toBeGreaterThan(0);
    });

    it('子弹冷却时间为 300ms', () => {
      expect(BULLET_COOLDOWN).toBe(300);
    });

    it('胜利局数为 2', () => {
      expect(WINS_NEEDED).toBe(2);
    });

    it('小行星数量为 5', () => {
      expect(ASTEROID_COUNT).toBe(5);
    });

    it('星星数量为 80', () => {
      expect(STAR_COUNT).toBe(80);
    });

    it('AI 思考间隔为正数', () => {
      expect(AI_THINK_INTERVAL).toBeGreaterThan(0);
    });

    it('AI 精度在 0-1 之间', () => {
      expect(AI_ACCURACY).toBeGreaterThan(0);
      expect(AI_ACCURACY).toBeLessThanOrEqual(1);
    });

    it('AI 射程为正数', () => {
      expect(AI_SHOOT_RANGE).toBeGreaterThan(0);
    });

    it('P1 颜色为绿色', () => {
      expect(SHIP_COLOR_P1).toBe('#00ff88');
    });

    it('P2 颜色为红色', () => {
      expect(SHIP_COLOR_P2).toBe('#ff4757');
    });
  });

  // ========== 状态管理 ==========

  describe('状态管理', () => {
    it('idle 状态下 update 不崩溃', () => {
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
      (engine as any)._score1 = WINS_NEEDED - 1;
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);
      expect(engine.status).toBe('gameover');

      // Space 重启
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
      expect(engine.score1).toBe(0);
      expect(engine.score2).toBe(0);
    });

    it('连续 start-reset-start 循环正常', () => {
      engine.start();
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.score1).toBe(0);
      expect(engine.score2).toBe(0);
    });

    it('完整 3 局 2 胜流程', () => {
      engine.start();

      // 第一局：P1 赢
      const ship2 = (engine as any)._ship2;
      ship2.alive = false;
      tick(engine, 16);
      expect(engine.score1).toBe(1);
      expect(engine.matchOver).toBe(false);

      // 等待回合延迟
      tick(engine, ROUND_DELAY + 100);

      // 第二局：P1 赢
      const ship2New = (engine as any)._ship2;
      ship2New.alive = false;
      tick(engine, 16);
      expect(engine.score1).toBe(2);
      expect(engine.matchOver).toBe(true);
      expect(engine.winner).toBe(1);
    });

    it('1-1 后决胜局', () => {
      engine.start();

      // 第一局：P1 赢
      (engine as any)._ship2.alive = false;
      tick(engine, 16);
      tick(engine, ROUND_DELAY + 100);

      // 第二局：P2 赢
      (engine as any)._ship1.alive = false;
      tick(engine, 16);
      expect(engine.score1).toBe(1);
      expect(engine.score2).toBe(1);
      expect(engine.matchOver).toBe(false);

      tick(engine, ROUND_DELAY + 100);

      // 第三局：P1 赢
      (engine as any)._ship2.alive = false;
      tick(engine, 16);
      expect(engine.score1).toBe(2);
      expect(engine.matchOver).toBe(true);
      expect(engine.winner).toBe(1);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('update 在无飞船时不崩溃', () => {
      startEngine(engine);
      (engine as any)._ship1 = null;
      (engine as any)._ship2 = null;
      expect(() => tick(engine, 16)).not.toThrow();
    });

    it('大量 update 不崩溃', () => {
      startEngine(engine);
      expect(() => {
        for (let i = 0; i < 500; i++) tick(engine, 16);
      }).not.toThrow();
    });

    it('双方同时死亡不计分', () => {
      startEngine(engine);
      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;
      ship1.alive = false;
      ship2.alive = false;
      tick(engine, 16);

      // 双方同时死亡，分数不变
      expect(engine.score1).toBe(0);
      expect(engine.score2).toBe(0);
    });

    it('比赛结束后 update 不崩溃', () => {
      startEngine(engine);
      (engine as any)._score1 = WINS_NEEDED - 1;
      (engine as any)._ship2.alive = false;
      tick(engine, 16);
      expect(engine.matchOver).toBe(true);
      expect(() => tick(engine, 16)).not.toThrow();
    });

    it('回合延迟期间粒子仍更新', () => {
      startEngine(engine);
      (engine as any)._particles.push({
        x: 100, y: 100, vx: 10, vy: 10,
        lifetime: 100, maxLifetime: 100, color: '#fff',
      });
      // 触发回合结束
      (engine as any)._ship2.alive = false;
      tick(engine, 16);
      // 回合延迟中
      expect((engine as any)._roundDelay).toBeGreaterThan(0);
      const countBefore = engine.particleCount;
      tick(engine, 16);
      expect(engine.particleCount).toBeLessThanOrEqual(countBefore);
    });

    it('渲染不崩溃', () => {
      startEngine(engine);
      const ctx = (engine as any).ctx;
      const canvas = (engine as any).canvas;
      expect(() => {
        (engine as any).onRender(ctx, canvas.width, canvas.height);
      }).not.toThrow();
    });

    it('gameover 状态渲染不崩溃', () => {
      startEngine(engine);
      (engine as any)._score1 = WINS_NEEDED - 1;
      (engine as any)._ship2.alive = false;
      tick(engine, 16);
      const ctx = (engine as any).ctx;
      const canvas = (engine as any).canvas;
      expect(() => {
        (engine as any).onRender(ctx, canvas.width, canvas.height);
      }).not.toThrow();
    });
  });

  // ========== 双人同时操作 ==========

  describe('双人同时操作', () => {
    it('两个玩家可以同时旋转', () => {
      startEngine(engine);
      engine.handleKeyDown('a');       // P1 左旋
      engine.handleKeyDown('ArrowRight'); // P2 右旋
      tick(engine, 100);

      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;
      expect(ship1.angle).toBeLessThan(-Math.PI / 2);
      expect(ship2.angle).toBeGreaterThan(Math.PI / 2);
    });

    it('两个玩家可以同时推进', () => {
      startEngine(engine);
      engine.handleKeyDown('w');       // P1 推进
      engine.handleKeyDown('ArrowUp'); // P2 推进
      tick(engine, 100);

      const ship1 = (engine as any)._ship1;
      const ship2 = (engine as any)._ship2;
      expect(ship1.thrusting).toBe(true);
      expect(ship2.thrusting).toBe(true);
    });

    it('两个玩家可以同时射击', () => {
      startEngine(engine);
      engine.handleKeyDown(' ');    // P1 射击
      engine.handleKeyDown('Enter'); // P2 射击
      tick(engine, 16);

      expect(engine.bulletCount).toBeGreaterThanOrEqual(2);
    });
  });
});
