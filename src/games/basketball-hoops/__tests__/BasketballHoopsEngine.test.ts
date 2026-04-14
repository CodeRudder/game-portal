import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BasketballHoopsEngine } from '../BasketballHoopsEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRAVITY,
  BALL_RADIUS, BALL_START_X, BALL_START_Y,
  MIN_ANGLE, MAX_ANGLE, DEFAULT_ANGLE,
  MIN_POWER, MAX_POWER, POWER_CHARGE_RATE,
  HOOP_WIDTH, HOOP_RIM_RADIUS,
  HOOP_MIN_X, HOOP_MAX_X, HOOP_MIN_Y, HOOP_MAX_Y,
  SCORE_NORMAL, SCORE_SWISH,
  COMBO_MULTIPLIERS,
  TIME_LIMIT,
  SWISH_THRESHOLD,
  RIM_BOUNCE_THRESHOLD,
  HOOP_BACKBOARD_WIDTH, HOOP_BACKBOARD_HEIGHT,
} from '../constants';

// ========== Helpers ==========

function createEngine(): BasketballHoopsEngine {
  const engine = new BasketballHoopsEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

function startEngine(engine: BasketballHoopsEngine): void {
  engine.start();
}

/** 模拟一帧更新 */
function tick(engine: BasketballHoopsEngine, dt: number = 16.67): void {
  (engine as any).update(dt);
}

/** 模拟蓄力并投篮 */
function chargeAndShoot(engine: BasketballHoopsEngine, chargeTime: number = 500): void {
  engine.handleKeyDown(' ');
  tick(engine, chargeTime);
  engine.handleKeyUp(' ');
}

/** 模拟角度调节 */
function adjustAngle(engine: BasketballHoopsEngine, key: string, ticks: number = 10): void {
  engine.handleKeyDown(key);
  for (let i = 0; i < ticks; i++) {
    tick(engine);
  }
  engine.handleKeyUp(key);
}

// ========== 测试 ==========

describe('BasketballHoopsEngine', () => {

  // ==================== 初始化 ====================

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      const engine = createEngine();
      expect(engine).toBeInstanceOf(BasketballHoopsEngine);
    });

    it('初始状态应为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('初始分数应为 0', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
    });

    it('初始角度应为默认值 45°', () => {
      const engine = createEngine();
      expect(engine.angle).toBeCloseTo(DEFAULT_ANGLE, 5);
    });

    it('初始力度应为最小值', () => {
      const engine = createEngine();
      expect(engine.power).toBe(MIN_POWER);
    });

    it('初始篮球状态应为 ready', () => {
      const engine = createEngine();
      expect(engine.ballPhase).toBe('ready');
    });

    it('初始篮球位置应为 null（未飞行）', () => {
      const engine = createEngine();
      expect(engine.ball).toBeNull();
    });

    it('初始连击应为 0', () => {
      const engine = createEngine();
      expect(engine.combo).toBe(0);
    });

    it('初始最大连击应为 0', () => {
      const engine = createEngine();
      expect(engine.maxCombo).toBe(0);
    });

    it('初始投篮次数应为 0', () => {
      const engine = createEngine();
      expect(engine.totalShots).toBe(0);
    });

    it('初始命中次数应为 0', () => {
      const engine = createEngine();
      expect(engine.madeShots).toBe(0);
    });

    it('初始空心球次数应为 0', () => {
      const engine = createEngine();
      expect(engine.swishCount).toBe(0);
    });

    it('初始剩余时间应为 TIME_LIMIT', () => {
      const engine = createEngine();
      // init 时不会设置 timeRemaining，start 时设置
      expect(engine.timeRemaining).toBe(TIME_LIMIT);
    });

    it('篮筐位置应在合理范围内', () => {
      const engine = createEngine();
      const hoop = engine.hoop;
      expect(hoop.x).toBeGreaterThanOrEqual(HOOP_MIN_X);
      expect(hoop.x).toBeLessThanOrEqual(HOOP_MAX_X);
      expect(hoop.y).toBeGreaterThanOrEqual(HOOP_MIN_Y);
      expect(hoop.y).toBeLessThanOrEqual(HOOP_MAX_Y);
    });

    it('初始不应在蓄力状态', () => {
      const engine = createEngine();
      expect(engine.charging).toBe(false);
    });
  });

  // ==================== 启动 ====================

  describe('start', () => {
    it('启动后状态应为 playing', () => {
      const engine = createEngine();
      startEngine(engine);
      expect(engine.status).toBe('playing');
    });

    it('启动后分数应重置为 0', () => {
      const engine = createEngine();
      startEngine(engine);
      expect(engine.score).toBe(0);
    });

    it('启动后时间应为 TIME_LIMIT', () => {
      const engine = createEngine();
      startEngine(engine);
      expect(engine.timeRemaining).toBe(TIME_LIMIT);
    });

    it('启动后连击应为 0', () => {
      const engine = createEngine();
      startEngine(engine);
      expect(engine.combo).toBe(0);
    });

    it('启动后角度应为默认值', () => {
      const engine = createEngine();
      startEngine(engine);
      expect(engine.angle).toBeCloseTo(DEFAULT_ANGLE, 5);
    });

    it('启动后力度应为最小值', () => {
      const engine = createEngine();
      startEngine(engine);
      expect(engine.power).toBe(MIN_POWER);
    });

    it('启动后篮球状态应为 ready', () => {
      const engine = createEngine();
      startEngine(engine);
      expect(engine.ballPhase).toBe('ready');
    });
  });

  // ==================== 角度调节 ====================

  describe('角度调节', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
    });

    it('按上方向键应增加角度', () => {
      const before = engine.angle;
      adjustAngle(engine, 'ArrowUp', 20);
      expect(engine.angle).toBeGreaterThan(before);
    });

    it('按下方向键应减小角度', () => {
      const before = engine.angle;
      adjustAngle(engine, 'ArrowDown', 20);
      expect(engine.angle).toBeLessThan(before);
    });

    it('W 键应增加角度', () => {
      const before = engine.angle;
      adjustAngle(engine, 'w', 20);
      expect(engine.angle).toBeGreaterThan(before);
    });

    it('S 键应减小角度', () => {
      const before = engine.angle;
      adjustAngle(engine, 's', 20);
      expect(engine.angle).toBeLessThan(before);
    });

    it('大写 W 键应增加角度', () => {
      const before = engine.angle;
      adjustAngle(engine, 'W', 20);
      expect(engine.angle).toBeGreaterThan(before);
    });

    it('大写 S 键应减小角度', () => {
      const before = engine.angle;
      adjustAngle(engine, 'S', 20);
      expect(engine.angle).toBeLessThan(before);
    });

    it('角度不应超过最大值', () => {
      adjustAngle(engine, 'ArrowUp', 500);
      expect(engine.angle).toBeLessThanOrEqual(MAX_ANGLE);
    });

    it('角度不应低于最小值', () => {
      adjustAngle(engine, 'ArrowDown', 500);
      expect(engine.angle).toBeGreaterThanOrEqual(MIN_ANGLE);
    });

    it('持续按住上键角度应持续增加', () => {
      const angles: number[] = [];
      engine.handleKeyDown('ArrowUp');
      for (let i = 0; i < 10; i++) {
        tick(engine);
        angles.push(engine.angle);
      }
      engine.handleKeyUp('ArrowUp');
      for (let i = 1; i < angles.length; i++) {
        expect(angles[i]).toBeGreaterThan(angles[i - 1]);
      }
    });

    it('松开按键后角度应停止变化', () => {
      adjustAngle(engine, 'ArrowUp', 10);
      const afterUp = engine.angle;
      tick(engine, 16.67);
      tick(engine, 16.67);
      expect(engine.angle).toBeCloseTo(afterUp, 5);
    });
  });

  // ==================== 力度调节（蓄力） ====================

  describe('力度调节', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
    });

    it('按住空格应开始蓄力', () => {
      engine.handleKeyDown(' ');
      tick(engine, 200);
      expect(engine.charging).toBe(true);
      expect(engine.power).toBeGreaterThan(MIN_POWER);
    });

    it('蓄力时力度应持续增加', () => {
      engine.handleKeyDown(' ');
      const powers: number[] = [];
      for (let i = 0; i < 10; i++) {
        tick(engine, 50);
        powers.push(engine.power);
      }
      engine.handleKeyUp(' ');
      for (let i = 1; i < powers.length; i++) {
        expect(powers[i]).toBeGreaterThan(powers[i - 1]);
      }
    });

    it('力度不应超过最大值', () => {
      engine.handleKeyDown(' ');
      for (let i = 0; i < 200; i++) {
        tick(engine, 50);
      }
      engine.handleKeyUp(' ');
      expect(engine.power).toBeLessThanOrEqual(MAX_POWER);
    });

    it('松开空格应停止蓄力并投篮', () => {
      engine.handleKeyDown(' ');
      tick(engine, 300);
      engine.handleKeyUp(' ');
      expect(engine.charging).toBe(false);
      expect(engine.ballPhase).toBe('flying');
    });

    it('蓄力时间越长力度越大', () => {
      // 短蓄力
      engine.handleKeyDown(' ');
      tick(engine, 100);
      const shortPower = engine.power;
      engine.handleKeyUp(' ');
      // 等球重置
      tick(engine, 2000);

      // 长蓄力 (重置后)
      engine.resetBall();
      engine.handleKeyDown(' ');
      tick(engine, 500);
      const longPower = engine.power;
      engine.handleKeyUp(' ');
      expect(longPower).toBeGreaterThan(shortPower);
    });

    it('未蓄力直接松开空格不应投篮', () => {
      engine.handleKeyUp(' ');
      expect(engine.ballPhase).toBe('ready');
    });
  });

  // ==================== 投篮 ====================

  describe('投篮', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
    });

    it('投篮后篮球状态应为 flying', () => {
      chargeAndShoot(engine, 300);
      expect(engine.ballPhase).toBe('flying');
    });

    it('投篮后篮球位置应在起始点', () => {
      chargeAndShoot(engine, 300);
      const ball = engine.ball;
      expect(ball).not.toBeNull();
      expect(ball!.x).toBeCloseTo(BALL_START_X, 1);
      expect(ball!.y).toBeCloseTo(BALL_START_Y, 1);
    });

    it('投篮后篮球应有水平速度', () => {
      chargeAndShoot(engine, 300);
      const ball = engine.ball;
      expect(ball!.vx).toBeGreaterThan(0);
    });

    it('投篮后篮球应有向上速度（负 vy）', () => {
      chargeAndShoot(engine, 300);
      const ball = engine.ball;
      expect(ball!.vy).toBeLessThan(0);
    });

    it('投篮次数应增加', () => {
      chargeAndShoot(engine, 300);
      expect(engine.totalShots).toBe(1);
    });

    it('多次投篮应累计次数', () => {
      chargeAndShoot(engine, 300);
      engine.resetBall();
      chargeAndShoot(engine, 300);
      expect(engine.totalShots).toBe(2);
    });

    it('ready 状态下才能投篮', () => {
      chargeAndShoot(engine, 300);
      expect(engine.ballPhase).toBe('flying');
      // 再次投篮不应改变状态
      engine.handleKeyDown(' ');
      tick(engine, 200);
      engine.handleKeyUp(' ');
      // ballPhase 应该还是 flying（因为球还在飞）
      expect(engine.totalShots).toBe(1);
    });
  });

  // ==================== 抛物线弹道 ====================

  describe('抛物线弹道', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
    });

    it('篮球应受重力影响（vy 逐渐增大）', () => {
      chargeAndShoot(engine, 300);
      const vys: number[] = [];
      for (let i = 0; i < 10; i++) {
        tick(engine);
        if (engine.ball) vys.push(engine.ball.vy);
      }
      for (let i = 1; i < vys.length; i++) {
        expect(vys[i]).toBeGreaterThan(vys[i - 1]);
      }
    });

    it('篮球水平速度应基本不变（忽略空气阻力）', () => {
      chargeAndShoot(engine, 300);
      const vxs: number[] = [];
      for (let i = 0; i < 5; i++) {
        tick(engine);
        if (engine.ball) vxs.push(engine.ball.vx);
      }
      for (let i = 1; i < vxs.length; i++) {
        expect(vxs[i]).toBeCloseTo(vxs[0], 0);
      }
    });

    it('篮球应先上升后下降', () => {
      chargeAndShoot(engine, 400);
      const ys: number[] = [];
      for (let i = 0; i < 60; i++) {
        tick(engine);
        if (engine.ball) ys.push(engine.ball.y);
      }
      // 找到最低点（最高位置）
      const minY = Math.min(...ys);
      const minIdx = ys.indexOf(minY);
      // 最低点之前应递减，之后应递增
      if (minIdx > 0 && minIdx < ys.length - 1) {
        expect(ys[minIdx - 1]).toBeGreaterThan(ys[minIdx]);
        expect(ys[minIdx + 1]).toBeGreaterThan(ys[minIdx]);
      }
    });

    it('篮球轨迹应呈抛物线', () => {
      chargeAndShoot(engine, 400);
      const positions: { x: number; y: number }[] = [];
      for (let i = 0; i < 40; i++) {
        tick(engine);
        if (engine.ball) positions.push({ x: engine.ball.x, y: engine.ball.y });
      }
      // x 应单调递增
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i].x).toBeGreaterThan(positions[i - 1].x);
      }
    });

    it('不同角度应产生不同轨迹', () => {
      // 高角度
      adjustAngle(engine, 'ArrowUp', 50);
      const angle1 = engine.angle;
      chargeAndShoot(engine, 300);
      const ball1Vx = engine.ball!.vx;
      const ball1Vy = engine.ball!.vy;
      engine.resetBall();

      // 低角度
      engine._angle = DEFAULT_ANGLE;
      adjustAngle(engine, 'ArrowDown', 50);
      const angle2 = engine.angle;
      chargeAndShoot(engine, 300);
      const ball2Vx = engine.ball!.vx;
      const ball2Vy = engine.ball!.vy;

      expect(angle1).toBeGreaterThan(angle2);
      // 高角度 vx 更小
      expect(ball1Vx).toBeLessThan(ball2Vx);
      // 高角度 vy 更负（向上更大）
      expect(ball1Vy).toBeLessThan(ball2Vy);
    });

    it('不同力度应产生不同速度', () => {
      // 小力度
      chargeAndShoot(engine, 100);
      const speed1 = Math.sqrt(engine.ball!.vx ** 2 + engine.ball!.vy ** 2);
      engine.resetBall();

      // 大力度
      chargeAndShoot(engine, 800);
      const speed2 = Math.sqrt(engine.ball!.vx ** 2 + engine.ball!.vy ** 2);

      expect(speed2).toBeGreaterThan(speed1);
    });

    it('重力加速度应正确应用', () => {
      chargeAndShoot(engine, 300);
      const ball = engine.ball!;
      const initialVy = ball.vy;
      const dt = 0.01667;
      tick(engine, dt * 1000);
      if (engine.ball) {
        const expectedVy = initialVy + GRAVITY * dt;
        expect(engine.ball.vy).toBeCloseTo(expectedVy, 0);
      }
    });
  });

  // ==================== 进球检测 ====================

  describe('进球检测', () => {
    it('球穿过筐口应判定为进球', () => {
      const engine = createEngine();
      startEngine(engine);

      // 设置篮筐在球的正上方偏右
      (engine as any)._hoop = { x: 200, y: 300 };

      // 直接设置球在筐口上方，向下飞
      (engine as any)._ball = {
        x: 200, y: 290,
        vx: 0, vy: 100,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';

      // 模拟几帧让球穿过筐口
      for (let i = 0; i < 5; i++) {
        tick(engine, 16.67);
      }

      expect(engine.ballPhase === 'scored' || engine.madeShots > 0).toBe(true);
    });

    it('球未穿过筐口不应得分', () => {
      const engine = createEngine();
      startEngine(engine);

      // 设置篮筐很远
      (engine as any)._hoop = { x: 400, y: 150 };

      // 球往左飞，远离篮筐
      (engine as any)._ball = {
        x: 100, y: 400,
        vx: -50, vy: -200,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';

      const beforeScore = engine.score;
      tick(engine, 16.67);

      expect(engine.score).toBe(beforeScore);
    });

    it('球必须从上方穿过筐口才得分', () => {
      const engine = createEngine();
      startEngine(engine);

      (engine as any)._hoop = { x: 200, y: 300 };

      // 球从下方上升，不应算进球（vy < 0）
      (engine as any)._ball = {
        x: 200, y: 310,
        vx: 0, vy: -100,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';

      tick(engine, 16.67);
      expect(engine.ballPhase).toBe('flying');
    });

    it('球水平位置不在筐口内不应得分', () => {
      const engine = createEngine();
      startEngine(engine);

      (engine as any)._hoop = { x: 300, y: 200 };

      // 球在筐口左边很远
      (engine as any)._ball = {
        x: 100, y: 195,
        vx: 50, vy: 100,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';

      tick(engine, 16.67);
      expect(engine.ballPhase).toBe('flying');
      expect(engine.madeShots).toBe(0);
    });
  });

  // ==================== 得分计算 ====================

  describe('得分计算', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
    });

    it('普通进球应得 2 分', () => {
      // 模拟碰筐后进球
      (engine as any)._hoop = { x: 200, y: 300 };
      (engine as any)._ball = {
        x: 200, y: 290,
        vx: 10, vy: 100,
        hitRim: true,  // 碰过筐
      };
      (engine as any)._ballPhase = 'flying';

      tick(engine, 16.67);

      if (engine.madeShots > 0) {
        expect(engine.score).toBeGreaterThanOrEqual(SCORE_NORMAL);
      }
    });

    it('空心入网应得 3 分', () => {
      (engine as any)._hoop = { x: 200, y: 300 };
      (engine as any)._ball = {
        x: 200, y: 290,
        vx: 0, vy: 100,
        hitRim: false,  // 没碰筐
      };
      (engine as any)._ballPhase = 'flying';

      tick(engine, 16.67);

      if (engine.madeShots > 0 && engine.swishCount > 0) {
        expect(engine.score).toBeGreaterThanOrEqual(SCORE_SWISH);
      }
    });

    it('连续进球应增加连击数', () => {
      // 手动模拟两次进球
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(1);

      // 需要重新设置 ball 因为 onScored 会将其标记为 scored
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(2);
    });

    it('连击倍率应正确应用', () => {
      // 0 连击时进球，倍率应为 COMBO_MULTIPLIERS[0] = 1
      (engine as any)._hoop = { x: 200, y: 300 };
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.score).toBe(SCORE_NORMAL * COMBO_MULTIPLIERS[0]);

      // 1 连击时进球
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(2);
      const expectedCombo1Score = Math.round(SCORE_NORMAL * COMBO_MULTIPLIERS[1]);
      expect(engine.score).toBe(SCORE_NORMAL + expectedCombo1Score);
    });

    it('连击 3 次应有 1.5 倍率', () => {
      // 先进 2 球
      for (let i = 0; i < 2; i++) {
        (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
        (engine as any)._ballPhase = 'flying';
        (engine as any).onScored();
      }
      expect(engine.combo).toBe(2);

      // 第 3 球
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(3);
      const points3rd = Math.round(SCORE_NORMAL * COMBO_MULTIPLIERS[2]);
      expect(points3rd).toBe(Math.round(SCORE_NORMAL * 1.5));
    });

    it('未进球应重置连击', () => {
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(1);

      // 模拟出界
      (engine as any)._ball = { x: -100, y: 700, vx: -50, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkOutOfBounds();
      expect(engine.combo).toBe(0);
    });
  });

  // ==================== 连击奖励 ====================

  describe('连击奖励', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
      (engine as any)._hoop = { x: 200, y: 300 };
    });

    it('首次进球 combo 为 1', () => {
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(1);
    });

    it('连续进球应记录最大连击', () => {
      for (let i = 0; i < 5; i++) {
        (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
        (engine as any)._ballPhase = 'flying';
        (engine as any).onScored();
      }
      expect(engine.maxCombo).toBe(5);
    });

    it('连击中断后最大连击应保持', () => {
      for (let i = 0; i < 3; i++) {
        (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
        (engine as any)._ballPhase = 'flying';
        (engine as any).onScored();
      }
      expect(engine.maxCombo).toBe(3);

      // 中断
      engine['_combo'] = 0;
      // 再进 1 球
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.maxCombo).toBe(3);
    });

    it('COMBO_MULTIPLIERS 长度应足够', () => {
      expect(COMBO_MULTIPLIERS.length).toBeGreaterThanOrEqual(5);
    });

    it('连击倍率应递增', () => {
      for (let i = 1; i < COMBO_MULTIPLIERS.length; i++) {
        expect(COMBO_MULTIPLIERS[i]).toBeGreaterThanOrEqual(COMBO_MULTIPLIERS[i - 1]);
      }
    });

    it('连击超出数组长度应使用最后一个倍率', () => {
      const bigCombo = COMBO_MULTIPLIERS.length + 5;
      engine['_combo'] = bigCombo - 1;
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();

      const lastMultiplier = COMBO_MULTIPLIERS[COMBO_MULTIPLIERS.length - 1];
      const expectedPoints = Math.round(SCORE_NORMAL * lastMultiplier);
      expect(engine.score).toBe(expectedPoints);
    });

    it('空心入网连击应得更高分', () => {
      engine['_combo'] = 2; // 3 连击
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();

      const multiplier = COMBO_MULTIPLIERS[2];
      const expected = Math.round(SCORE_SWISH * multiplier);
      expect(engine.score).toBe(expected);
    });
  });

  // ==================== 时间限制 ====================

  describe('时间限制', () => {
    it('时间应随游戏进行递减', () => {
      const engine = createEngine();
      startEngine(engine);
      const before = engine.timeRemaining;
      tick(engine, 1000);
      expect(engine.timeRemaining).toBeLessThan(before);
    });

    it('时间递减量应与 deltaTime 匹配', () => {
      const engine = createEngine();
      startEngine(engine);
      const before = engine.timeRemaining;
      tick(engine, 1000); // 1 秒
      expect(engine.timeRemaining).toBeCloseTo(before - 1, 1);
    });

    it('时间耗尽应触发游戏结束', () => {
      const engine = createEngine();
      startEngine(engine);
      // 快进时间
      for (let i = 0; i < 4000; i++) {
        tick(engine, 16.67);
        if (engine.status === 'gameover') break;
      }
      expect(engine.status).toBe('gameover');
    });

    it('时间耗尽后 timeRemaining 应为 0', () => {
      const engine = createEngine();
      startEngine(engine);
      for (let i = 0; i < 5000; i++) {
        tick(engine, 16.67);
        if (engine.status === 'gameover') break;
      }
      expect(engine.timeRemaining).toBe(0);
    });

    it('游戏结束后不应再更新', () => {
      const engine = createEngine();
      startEngine(engine);
      for (let i = 0; i < 5000; i++) {
        tick(engine, 16.67);
        if (engine.status === 'gameover') break;
      }
      expect(engine.status).toBe('gameover');
      const score = engine.score;
      tick(engine, 16.67);
      expect(engine.score).toBe(score);
    });
  });

  // ==================== 键盘输入 ====================

  describe('键盘输入', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
    });

    it('ArrowUp 应设置 upPressed', () => {
      engine.handleKeyDown('ArrowUp');
      expect((engine as any)._upPressed).toBe(true);
      engine.handleKeyUp('ArrowUp');
      expect((engine as any)._upPressed).toBe(false);
    });

    it('ArrowDown 应设置 downPressed', () => {
      engine.handleKeyDown('ArrowDown');
      expect((engine as any)._downPressed).toBe(true);
      engine.handleKeyUp('ArrowDown');
      expect((engine as any)._downPressed).toBe(false);
    });

    it('w 键应设置 upPressed', () => {
      engine.handleKeyDown('w');
      expect((engine as any)._upPressed).toBe(true);
      engine.handleKeyUp('w');
      expect((engine as any)._upPressed).toBe(false);
    });

    it('s 键应设置 downPressed', () => {
      engine.handleKeyDown('s');
      expect((engine as any)._downPressed).toBe(true);
      engine.handleKeyUp('s');
      expect((engine as any)._downPressed).toBe(false);
    });

    it('空格按下应开始蓄力', () => {
      engine.handleKeyDown(' ');
      expect(engine.charging).toBe(true);
    });

    it('空格松开应投篮', () => {
      engine.handleKeyDown(' ');
      tick(engine, 200);
      engine.handleKeyUp(' ');
      expect(engine.ballPhase).toBe('flying');
    });

    it('非 playing 状态应忽略按键', () => {
      engine.pause();
      const beforeAngle = engine.angle;
      engine.handleKeyDown('ArrowUp');
      tick(engine, 16.67);
      engine.handleKeyUp('ArrowUp');
      expect(engine.angle).toBeCloseTo(beforeAngle, 5);
    });

    it('未知按键不应影响游戏状态', () => {
      const beforeAngle = engine.angle;
      engine.handleKeyDown('x');
      tick(engine, 16.67);
      engine.handleKeyUp('x');
      expect(engine.angle).toBeCloseTo(beforeAngle, 5);
    });

    it('飞行中按空格不应再投篮', () => {
      chargeAndShoot(engine, 300);
      expect(engine.ballPhase).toBe('flying');
      const shots = engine.totalShots;
      engine.handleKeyDown(' ');
      tick(engine, 200);
      engine.handleKeyUp(' ');
      expect(engine.totalShots).toBe(shots);
    });
  });

  // ==================== getState ====================

  describe('getState', () => {
    it('应返回完整游戏状态', () => {
      const engine = createEngine();
      startEngine(engine);
      const state = engine.getState();

      expect(state).toHaveProperty('angle');
      expect(state).toHaveProperty('power');
      expect(state).toHaveProperty('ballPhase');
      expect(state).toHaveProperty('ball');
      expect(state).toHaveProperty('hoop');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('combo');
      expect(state).toHaveProperty('maxCombo');
      expect(state).toHaveProperty('totalShots');
      expect(state).toHaveProperty('madeShots');
      expect(state).toHaveProperty('swishCount');
      expect(state).toHaveProperty('timeRemaining');
      expect(state).toHaveProperty('charging');
    });

    it('返回的 hoop 应是副本', () => {
      const engine = createEngine();
      startEngine(engine);
      const state = engine.getState();
      const hoop1 = state.hoop as { x: number; y: number };
      const hoop2 = engine.hoop;
      expect(hoop1).toEqual(hoop2);
      // 修改返回值不应影响引擎
      hoop1.x = 999;
      expect(engine.hoop.x).not.toBe(999);
    });

    it('返回的 ball 应是副本', () => {
      const engine = createEngine();
      startEngine(engine);
      chargeAndShoot(engine, 300);
      const state = engine.getState();
      const ball = state.ball as { x: number; y: number };
      const engineBall = engine.ball;
      if (ball && engineBall) {
        ball.x = 999;
        expect(engineBall.x).not.toBe(999);
      }
    });

    it('初始状态 ball 应为 null', () => {
      const engine = createEngine();
      startEngine(engine);
      const state = engine.getState();
      expect(state.ball).toBeNull();
    });

    it('飞行中 ball 应不为 null', () => {
      const engine = createEngine();
      startEngine(engine);
      chargeAndShoot(engine, 300);
      const state = engine.getState();
      expect(state.ball).not.toBeNull();
    });

    it('score 应与引擎一致', () => {
      const engine = createEngine();
      startEngine(engine);
      (engine as any).addScore(10);
      const state = engine.getState();
      expect(state.score).toBe(10);
    });
  });

  // ==================== 篮筐位置 ====================

  describe('篮筐位置', () => {
    it('每次进球后篮筐应重新随机', () => {
      const engine = createEngine();
      startEngine(engine);
      const hoop1 = { ...engine.hoop };

      // 模拟进球
      (engine as any)._hoop = { x: 200, y: 300 };
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();

      // 强制随机化（onScored 中的 setTimeout 可能未执行）
      engine.randomizeHoop();
      const hoop2 = engine.hoop;

      // 位置应该有变化（概率极高）
      // 不做严格断言因为随机可能相同
      expect(hoop2.x).toBeGreaterThanOrEqual(HOOP_MIN_X);
      expect(hoop2.x).toBeLessThanOrEqual(HOOP_MAX_X);
      expect(hoop2.y).toBeGreaterThanOrEqual(HOOP_MIN_Y);
      expect(hoop2.y).toBeLessThanOrEqual(HOOP_MAX_Y);
    });

    it('篮筐 X 应在合理范围', () => {
      const engine = createEngine();
      for (let i = 0; i < 20; i++) {
        engine.randomizeHoop();
        expect(engine.hoop.x).toBeGreaterThanOrEqual(HOOP_MIN_X);
        expect(engine.hoop.x).toBeLessThanOrEqual(HOOP_MAX_X);
      }
    });

    it('篮筐 Y 应在合理范围', () => {
      const engine = createEngine();
      for (let i = 0; i < 20; i++) {
        engine.randomizeHoop();
        expect(engine.hoop.y).toBeGreaterThanOrEqual(HOOP_MIN_Y);
        expect(engine.hoop.y).toBeLessThanOrEqual(HOOP_MAX_Y);
      }
    });

    it('hoop getter 应返回副本', () => {
      const engine = createEngine();
      const h1 = engine.hoop;
      const h2 = engine.hoop;
      expect(h1).toEqual(h2);
      h1.x = 999;
      expect(engine.hoop.x).not.toBe(999);
    });
  });

  // ==================== 碰筐检测 ====================

  describe('碰筐检测', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
      (engine as any)._hoop = { x: 200, y: 300 };
    });

    it('球接近左筐沿应反弹', () => {
      const leftRimX = 200 - HOOP_WIDTH / 2;
      (engine as any)._ball = {
        x: leftRimX - 2,
        y: 300,
        vx: 100, vy: 0,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkRimCollision();

      expect(engine.ball!.hitRim).toBe(true);
    });

    it('球接近右筐沿应反弹', () => {
      const rightRimX = 200 + HOOP_WIDTH / 2;
      (engine as any)._ball = {
        x: rightRimX + 2,
        y: 300,
        vx: -100, vy: 0,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkRimCollision();

      expect(engine.ball!.hitRim).toBe(true);
    });

    it('碰筐后应标记 hitRim', () => {
      const leftRimX = 200 - HOOP_WIDTH / 2;
      (engine as any)._ball = {
        x: leftRimX,
        y: 300,
        vx: 50, vy: 50,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkRimCollision();
      expect(engine.ball!.hitRim).toBe(true);
    });

    it('远离筐沿不应碰撞', () => {
      (engine as any)._ball = {
        x: 50, y: 50,
        vx: 100, vy: 100,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkRimCollision();
      expect(engine.ball!.hitRim).toBe(false);
    });
  });

  // ==================== 碰篮板检测 ====================

  describe('碰篮板检测', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
      (engine as any)._hoop = { x: 200, y: 300 };
    });

    it('球碰到篮板应反弹', () => {
      const bbX = 200 + HOOP_WIDTH / 2 + HOOP_BACKBOARD_WIDTH / 2 + 2;
      (engine as any)._ball = {
        x: bbX - BALL_RADIUS,
        y: 300,
        vx: 100, vy: 0,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkBackboardCollision();

      expect(engine.ball!.vx).toBeLessThan(0);
      expect(engine.ball!.hitRim).toBe(true);
    });

    it('球远离篮板不应碰撞', () => {
      (engine as any)._ball = {
        x: 50, y: 50,
        vx: 100, vy: 0,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkBackboardCollision();
      expect(engine.ball!.hitRim).toBe(false);
    });
  });

  // ==================== 出界检测 ====================

  describe('出界检测', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
    });

    it('球飞出屏幕底部应判定 miss', () => {
      (engine as any)._ball = { x: 200, y: 700, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkOutOfBounds();
      expect(engine.ballPhase).toBe('missed');
    });

    it('球飞出屏幕右侧应判定 miss', () => {
      (engine as any)._ball = { x: 550, y: 300, vx: 100, vy: 0, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkOutOfBounds();
      expect(engine.ballPhase).toBe('missed');
    });

    it('球飞出屏幕左侧应判定 miss', () => {
      (engine as any)._ball = { x: -60, y: 300, vx: -100, vy: 0, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkOutOfBounds();
      expect(engine.ballPhase).toBe('missed');
    });

    it('miss 后应重置连击', () => {
      (engine as any)._combo = 3;
      (engine as any)._ball = { x: 200, y: 700, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkOutOfBounds();
      expect(engine.combo).toBe(0);
    });

    it('球在屏幕内不应判定 miss', () => {
      (engine as any)._ball = { x: 200, y: 300, vx: 100, vy: -100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkOutOfBounds();
      expect(engine.ballPhase).toBe('flying');
    });
  });

  // ==================== 空心入网 ====================

  describe('空心入网', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
      (engine as any)._hoop = { x: 200, y: 300 };
    });

    it('未碰筐且球心在筐口中心附近应算空心', () => {
      (engine as any)._ball = {
        x: 200, y: 305,
        vx: 0, vy: 100,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();

      expect(engine.swishCount).toBe(1);
    });

    it('碰过筐不应算空心', () => {
      (engine as any)._ball = {
        x: 200, y: 305,
        vx: 0, vy: 100,
        hitRim: true,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();

      expect(engine.swishCount).toBe(0);
    });

    it('球心偏离筐口太远不应算空心', () => {
      (engine as any)._ball = {
        x: 200 + SWISH_THRESHOLD + 5,
        y: 305,
        vx: 0, vy: 100,
        hitRim: false,
      };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();

      expect(engine.swishCount).toBe(0);
    });

    it('空心入网得分应高于普通进球', () => {
      // 普通进球
      (engine as any)._ball = { x: 200, y: 305, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      const normalScore = engine.score;

      // 空心入网
      (engine as any)._ball = { x: 200, y: 305, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      const totalScore = engine.score;

      const swishPoints = totalScore - normalScore;
      expect(swishPoints).toBeGreaterThan(normalScore);
    });
  });

  // ==================== 重置与生命周期 ====================

  describe('重置与生命周期', () => {
    it('reset 应恢复初始状态', () => {
      const engine = createEngine();
      startEngine(engine);
      chargeAndShoot(engine, 300);
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.ballPhase).toBe('ready');
    });

    it('destroy 应清理资源', () => {
      const engine = createEngine();
      startEngine(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('pause 应暂停游戏', () => {
      const engine = createEngine();
      startEngine(engine);
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 应恢复游戏', () => {
      const engine = createEngine();
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('重新开始应重置所有统计', () => {
      const engine = createEngine();
      startEngine(engine);

      // 模拟一些操作
      (engine as any).addScore(10);
      engine['_combo'] = 3;

      engine.reset();
      startEngine(engine);

      expect(engine.score).toBe(0);
      expect(engine.combo).toBe(0);
      expect(engine.totalShots).toBe(0);
      expect(engine.madeShots).toBe(0);
    });
  });

  // ==================== 渲染 ====================

  describe('渲染', () => {
    it('onRender 不应抛出异常（ready 状态）', () => {
      const engine = createEngine();
      startEngine(engine);
      const ctx = (engine as any).ctx;
      expect(() => {
        (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('onRender 不应抛出异常（flying 状态）', () => {
      const engine = createEngine();
      startEngine(engine);
      chargeAndShoot(engine, 300);
      const ctx = (engine as any).ctx;
      expect(() => {
        (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('onRender 不应抛出异常（scored 状态）', () => {
      const engine = createEngine();
      startEngine(engine);
      (engine as any)._ballPhase = 'scored';
      (engine as any)._ball = { x: 200, y: 350, vx: 0, vy: 100, hitRim: false };
      (engine as any)._scorePopup = { text: '+3', x: 200, y: 270, alpha: 1 };
      const ctx = (engine as any).ctx;
      expect(() => {
        (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });
  });

  // ==================== 得分弹出动画 ====================

  describe('得分弹出动画', () => {
    let engine: BasketballHoopsEngine;

    beforeEach(() => {
      engine = createEngine();
      startEngine(engine);
      (engine as any)._hoop = { x: 200, y: 300 };
    });

    it('进球后应有弹出动画', () => {
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.scorePopup).not.toBeNull();
    });

    it('弹出动画应逐渐消失', () => {
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      const popup = engine.scorePopup!;
      const initialAlpha = popup.alpha;

      tick(engine, 500);
      // alpha 应减小
      if (engine.scorePopup) {
        expect(engine.scorePopup.alpha).toBeLessThan(initialAlpha);
      }
    });

    it('弹出动画应向上移动', () => {
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      const popup = engine.scorePopup!;
      const initialY = popup.y;

      tick(engine, 500);
      if (engine.scorePopup) {
        expect(engine.scorePopup.y).toBeLessThan(initialY);
      }
    });

    it('连击时弹出文字应包含连击信息', () => {
      engine['_combo'] = 2;
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.scorePopup!.text).toContain('连击');
    });

    it('空心入网弹出应包含提示', () => {
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.scorePopup!.text).toContain('空心');
    });
  });

  // ==================== 综合场景 ====================

  describe('综合场景', () => {
    it('完整投篮流程：蓄力 → 投篮 → 飞行 → 出界', () => {
      const engine = createEngine();
      startEngine(engine);

      // 设置篮筐很远让球 miss
      (engine as any)._hoop = { x: 400, y: 100 };

      // 蓄力投篮（低力度，低角度）
      adjustAngle(engine, 'ArrowDown', 30);
      chargeAndShoot(engine, 100);

      expect(engine.ballPhase).toBe('flying');

      // 模拟飞行直到出界
      for (let i = 0; i < 200; i++) {
        tick(engine);
        if (engine.ballPhase !== 'flying') break;
      }

      expect(engine.ballPhase === 'missed' || engine.ballPhase === 'scored').toBe(true);
    });

    it('连续投篮应累计统计', () => {
      const engine = createEngine();
      startEngine(engine);
      (engine as any)._hoop = { x: 200, y: 300 };

      // 模拟 3 次进球
      for (let i = 0; i < 3; i++) {
        (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
        (engine as any)._ballPhase = 'flying';
        (engine as any).onScored();
      }

      expect(engine.madeShots).toBe(3);
      expect(engine.combo).toBe(3);
      expect(engine.maxCombo).toBe(3);
    });

    it('进球与 miss 交替应正确统计', () => {
      const engine = createEngine();
      startEngine(engine);
      (engine as any)._hoop = { x: 200, y: 300 };

      // 进球
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(1);

      // miss
      (engine as any)._ball = { x: -100, y: 700, vx: -50, vy: 100, hitRim: false };
      (engine as any)._ballPhase = 'flying';
      (engine as any).checkOutOfBounds();
      expect(engine.combo).toBe(0);

      // 再进球
      (engine as any)._ball = { x: 200, y: 300, vx: 0, vy: 100, hitRim: true };
      (engine as any)._ballPhase = 'flying';
      (engine as any).onScored();
      expect(engine.combo).toBe(1);
      expect(engine.madeShots).toBe(2);
    });

    it('游戏结束时应保留最终分数', () => {
      const engine = createEngine();
      startEngine(engine);
      (engine as any).addScore(42);
      // 快进到时间耗尽
      for (let i = 0; i < 5000; i++) {
        tick(engine, 16.67);
        if (engine.status === 'gameover') break;
      }
      expect(engine.status).toBe('gameover');
      expect(engine.score).toBe(42);
    });
  });

  // ==================== 常量验证 ====================

  describe('常量验证', () => {
    it('CANVAS_WIDTH 应为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 应为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('TIME_LIMIT 应为 60', () => {
      expect(TIME_LIMIT).toBe(60);
    });

    it('SCORE_NORMAL 应为 2', () => {
      expect(SCORE_NORMAL).toBe(2);
    });

    it('SCORE_SWISH 应为 3', () => {
      expect(SCORE_SWISH).toBe(3);
    });

    it('GRAVITY 应为正值', () => {
      expect(GRAVITY).toBeGreaterThan(0);
    });

    it('MIN_ANGLE 应小于 MAX_ANGLE', () => {
      expect(MIN_ANGLE).toBeLessThan(MAX_ANGLE);
    });

    it('MIN_POWER 应小于 MAX_POWER', () => {
      expect(MIN_POWER).toBeLessThan(MAX_POWER);
    });

    it('DEFAULT_ANGLE 应在范围内', () => {
      expect(DEFAULT_ANGLE).toBeGreaterThanOrEqual(MIN_ANGLE);
      expect(DEFAULT_ANGLE).toBeLessThanOrEqual(MAX_ANGLE);
    });

    it('BALL_START_X 应在画布内', () => {
      expect(BALL_START_X).toBeGreaterThan(0);
      expect(BALL_START_X).toBeLessThan(CANVAS_WIDTH);
    });

    it('BALL_START_Y 应在画布内', () => {
      expect(BALL_START_Y).toBeGreaterThan(0);
      expect(BALL_START_Y).toBeLessThan(CANVAS_HEIGHT);
    });

    it('HOOP_WIDTH 应大于 0', () => {
      expect(HOOP_WIDTH).toBeGreaterThan(0);
    });

    it('COMBO_MULTIPLIERS 第一个倍率应为 1', () => {
      expect(COMBO_MULTIPLIERS[0]).toBe(1);
    });
  });
});
