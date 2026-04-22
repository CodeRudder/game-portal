import { vi } from 'vitest';
import { LunarLanderEngine } from '../LunarLanderEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  LANDER_WIDTH, LANDER_HEIGHT, LANDER_START_X, LANDER_START_Y,
  GRAVITY, MAIN_THRUST, ROTATION_SPEED,
  MAX_SAFE_VY, MAX_SAFE_VX, MAX_SAFE_ANGLE,
  INITIAL_FUEL, FUEL_CONSUMPTION_THRUST, FUEL_CONSUMPTION_ROTATE, FUEL_BONUS_PER_LEVEL,
  TERRAIN_SEGMENTS, TERRAIN_MIN_Y, TERRAIN_MAX_Y,
  BASE_LANDING_ZONE_WIDTH, LANDING_ZONE_WIDTH_DECREASE, MIN_LANDING_ZONE_WIDTH,
  LANDING_ZONE_MARKER_HEIGHT, MAX_LEVELS,
  STAR_COUNT, FUEL_LOW_THRESHOLD,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): LunarLanderEngine {
  const engine = new LunarLanderEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 直接调用一次 update（绕过 requestAnimationFrame） */
function tick(engine: LunarLanderEngine, frames: number = 1, dt: number = 16): void {
  for (let i = 0; i < frames; i++) {
    (engine as any).update(dt);
  }
}

/** 将着陆器移到接近地面的位置 */
function moveLanderNearGround(engine: LunarLanderEngine, offsetX: number = 0): void {
  const terrainY = engine.getTerrainHeightAt(engine.landerX + offsetX);
  // 放到着陆区底部上方一个像素
  (engine as any)._landerY = terrainY - LANDER_HEIGHT / 2 - 1;
  (engine as any)._landerX = engine.landerX + offsetX;
}

/**
 * 将着陆器放置在指定 x 处的地形上（底部刚好接触地形）。
 * 下一帧重力会让 landerBottom 超过 terrainY，触发着陆检测。
 */
function placeOnTerrain(engine: LunarLanderEngine, x: number): void {
  const terrainY = engine.getTerrainHeightAt(x);
  (engine as any)._landerX = x;
  // landerBottom = landerY + LANDER_HEIGHT / 2，设置刚好在地形上
  (engine as any)._landerY = terrainY - LANDER_HEIGHT / 2;
}

/** 强制设置着陆器位置 */
function setLanderPos(engine: LunarLanderEngine, x: number, y: number): void {
  (engine as any)._landerX = x;
  (engine as any)._landerY = y;
}

/** 强制设置速度 */
function setLanderVel(engine: LunarLanderEngine, vx: number, vy: number): void {
  (engine as any)._landerVX = vx;
  (engine as any)._landerVY = vy;
}

/** 强制设置角度 */
function setLanderAngle(engine: LunarLanderEngine, angle: number): void {
  (engine as any)._landerAngle = angle;
}

/** 强制设置燃料 */
function setFuel(engine: LunarLanderEngine, fuel: number): void {
  (engine as any)._fuel = fuel;
}

// ========== 常量测试 ==========

describe('Lunar Lander Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('登陆舱尺寸合理', () => {
    expect(LANDER_WIDTH).toBe(20);
    expect(LANDER_HEIGHT).toBe(24);
  });

  it('登陆舱起始位置在画布顶部中央', () => {
    expect(LANDER_START_X).toBe(CANVAS_WIDTH / 2);
    expect(LANDER_START_Y).toBe(60);
  });

  it('物理参数为正值', () => {
    expect(GRAVITY).toBeGreaterThan(0);
    expect(MAIN_THRUST).toBeGreaterThan(0);
    expect(ROTATION_SPEED).toBeGreaterThan(0);
  });

  it('安全着陆速度阈值为正', () => {
    expect(MAX_SAFE_VY).toBeGreaterThan(0);
    expect(MAX_SAFE_VX).toBeGreaterThan(0);
    expect(MAX_SAFE_ANGLE).toBeGreaterThan(0);
  });

  it('燃料参数合理', () => {
    expect(INITIAL_FUEL).toBeGreaterThan(0);
    expect(FUEL_CONSUMPTION_THRUST).toBeGreaterThan(0);
    expect(FUEL_CONSUMPTION_ROTATE).toBeGreaterThan(0);
    expect(FUEL_BONUS_PER_LEVEL).toBeGreaterThan(0);
  });

  it('地形参数合理', () => {
    expect(TERRAIN_SEGMENTS).toBeGreaterThan(0);
    expect(TERRAIN_MIN_Y).toBeLessThan(TERRAIN_MAX_Y);
    expect(BASE_LANDING_ZONE_WIDTH).toBeGreaterThan(0);
    expect(MIN_LANDING_ZONE_WIDTH).toBeGreaterThan(0);
  });

  it('关卡数量为正', () => {
    expect(MAX_LEVELS).toBeGreaterThan(0);
  });

  it('星星数量为正', () => {
    expect(STAR_COUNT).toBeGreaterThan(0);
  });

  it('着陆区标记高度为正', () => {
    expect(LANDING_ZONE_MARKER_HEIGHT).toBeGreaterThan(0);
  });

  it('燃料低阈值合理', () => {
    expect(FUEL_LOW_THRESHOLD).toBeGreaterThan(0);
    expect(FUEL_LOW_THRESHOLD).toBeLessThan(INITIAL_FUEL);
  });
});

// ========== 初始化测试 ==========

describe('LunarLanderEngine - 初始化', () => {
  let engine: LunarLanderEngine;

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

  it('初始着陆器位置在起始点', () => {
    expect(engine.landerX).toBe(LANDER_START_X);
    expect(engine.landerY).toBe(LANDER_START_Y);
  });

  it('初始速度为 0', () => {
    expect(engine.landerVX).toBe(0);
    expect(engine.landerVY).toBe(0);
  });

  it('初始角度为 0（正直）', () => {
    expect(engine.landerAngle).toBe(0);
  });

  it('初始燃料为 INITIAL_FUEL', () => {
    expect(engine.fuel).toBe(INITIAL_FUEL);
  });

  it('初始未推进', () => {
    expect(engine.isThrusting).toBe(false);
  });

  it('初始未旋转', () => {
    expect(engine.isRotatingLeft).toBe(false);
    expect(engine.isRotatingRight).toBe(false);
  });

  it('初始无着陆结果', () => {
    expect(engine.landingResult).toBeNull();
  });

  it('初始未着陆', () => {
    expect(engine.landed).toBe(false);
  });

  it('初始已完成关卡为 0', () => {
    expect(engine.completedLevels).toBe(0);
  });

  it('初始无爆炸粒子', () => {
    expect(engine.explosionParticles.length).toBe(0);
  });

  it('初始化时生成星星', () => {
    expect(engine.stars.length).toBe(STAR_COUNT);
  });

  it('初始化时生成地形', () => {
    expect(engine.terrain.length).toBeGreaterThan(0);
  });

  it('初始化时有着陆区', () => {
    expect(engine.landingZone).not.toBeNull();
  });

  it('星星属性合理', () => {
    for (const star of engine.stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.size).toBeGreaterThan(0);
      expect(star.brightness).toBeGreaterThan(0);
      expect(star.brightness).toBeLessThanOrEqual(1);
    }
  });

  it('地形点数量等于 TERRAIN_SEGMENTS + 1', () => {
    expect(engine.terrain.length).toBe(TERRAIN_SEGMENTS + 1);
  });

  it('地形点 x 坐标从 0 到 CANVAS_WIDTH', () => {
    const terrain = engine.terrain;
    expect(terrain[0].x).toBe(0);
    expect(terrain[terrain.length - 1].x).toBe(CANVAS_WIDTH);
  });

  it('地形点 y 坐标在合理范围内', () => {
    for (const p of engine.terrain) {
      expect(p.y).toBeGreaterThanOrEqual(TERRAIN_MIN_Y);
      expect(p.y).toBeLessThanOrEqual(TERRAIN_MAX_Y);
    }
  });

  it('着陆区在画布范围内', () => {
    const lz = engine.landingZone!;
    expect(lz.leftX).toBeGreaterThanOrEqual(0);
    expect(lz.rightX).toBeLessThanOrEqual(CANVAS_WIDTH);
    expect(lz.y).toBeGreaterThanOrEqual(TERRAIN_MIN_Y);
    expect(lz.y).toBeLessThanOrEqual(TERRAIN_MAX_Y);
  });
});

// ========== 生命周期测试 ==========

describe('LunarLanderEngine - 生命周期', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后分数归零', () => {
    engine.start();
    expect(engine.score).toBe(0);
  });

  it('start 后等级为 1', () => {
    engine.start();
    expect(engine.level).toBe(1);
  });

  it('start 后着陆器回到起始位置', () => {
    engine.start();
    // 模拟一些移动
    engine.handleKeyDown('ArrowUp');
    tick(engine, 10);
    // 重新 start
    engine.start();
    expect(engine.landerX).toBe(LANDER_START_X);
    expect(engine.landerY).toBe(LANDER_START_Y);
  });

  it('start 后速度归零', () => {
    engine.start();
    expect(engine.landerVX).toBe(0);
    expect(engine.landerVY).toBe(0);
  });

  it('start 后角度归零', () => {
    engine.start();
    expect(engine.landerAngle).toBe(0);
  });

  it('start 后燃料恢复', () => {
    engine.start();
    expect(engine.fuel).toBe(INITIAL_FUEL);
  });

  it('start 后推进和旋转状态重置', () => {
    engine.start();
    expect(engine.isThrusting).toBe(false);
    expect(engine.isRotatingLeft).toBe(false);
    expect(engine.isRotatingRight).toBe(false);
  });

  it('start 后着陆结果清除', () => {
    engine.start();
    expect(engine.landingResult).toBeNull();
    expect(engine.landed).toBe(false);
  });

  it('start 后重新生成地形', () => {
    const terrainBefore = [...engine.terrain];
    engine.start();
    // 地形应该重新生成（可能相同也可能不同，但至少长度一致）
    expect(engine.terrain.length).toBe(TERRAIN_SEGMENTS + 1);
  });

  it('start 后爆炸粒子清空', () => {
    engine.start();
    expect(engine.explosionParticles.length).toBe(0);
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

  it('reset 后已完成关卡归零', () => {
    engine.start();
    engine.reset();
    expect(engine.completedLevels).toBe(0);
  });

  it('reset 后着陆器回到初始状态', () => {
    engine.start();
    engine.reset();
    expect(engine.landerX).toBe(LANDER_START_X);
    expect(engine.landerY).toBe(LANDER_START_Y);
    expect(engine.landerVX).toBe(0);
    expect(engine.landerVY).toBe(0);
    expect(engine.landerAngle).toBe(0);
    expect(engine.fuel).toBe(INITIAL_FUEL);
  });

  it('destroy 后状态为 idle', () => {
    engine.start();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });
});

// ========== 重力测试 ==========

describe('LunarLanderEngine - 重力', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('每帧着陆器受重力影响向下加速', () => {
    const vyBefore = engine.landerVY;
    tick(engine, 1);
    expect(engine.landerVY).toBeGreaterThan(vyBefore);
  });

  it('重力加速度等于 GRAVITY', () => {
    tick(engine, 1);
    expect(engine.landerVY).toBeCloseTo(GRAVITY, 5);
  });

  it('多帧后速度持续增加', () => {
    tick(engine, 10);
    expect(engine.landerVY).toBeCloseTo(GRAVITY * 10, 5);
  });

  it('着陆器随重力向下移动', () => {
    const yBefore = engine.landerY;
    tick(engine, 10);
    expect(engine.landerY).toBeGreaterThan(yBefore);
  });
});

// ========== 推进器物理测试 ==========

describe('LunarLanderEngine - 推进器物理', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('按上箭头开启推进', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.isThrusting).toBe(true);
  });

  it('松开上箭头关闭推进', () => {
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyUp('ArrowUp');
    expect(engine.isThrusting).toBe(false);
  });

  it('W 键也能开启推进', () => {
    engine.handleKeyDown('w');
    expect(engine.isThrusting).toBe(true);
  });

  it('大写 W 键也能开启推进', () => {
    engine.handleKeyDown('W');
    expect(engine.isThrusting).toBe(true);
  });

  it('推进时向上减速（角度为 0 时）', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    // 角度为 0，推力向上，所以 VY 应减小
    expect(engine.landerVY).toBeLessThan(GRAVITY);
  });

  it('推进时消耗燃料', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    expect(engine.fuel).toBeLessThan(fuelBefore);
  });

  it('推进每帧消耗 FUEL_CONSUMPTION_THRUST', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    expect(engine.fuel).toBeCloseTo(fuelBefore - FUEL_CONSUMPTION_THRUST, 5);
  });

  it('倾斜时推进产生水平分量', () => {
    // 设置角度为 90 度（向右倾斜）
    setLanderAngle(engine, 90);
    setLanderVel(engine, 0, 0);
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    // 角度 90 度时，推力水平向左
    expect(engine.landerVX).toBeLessThan(0);
  });

  it('倾斜推进时垂直分量随角度变化', () => {
    setLanderAngle(engine, 45);
    setLanderVel(engine, 0, 0);
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    // 45 度时垂直分量和水平分量都存在
    expect(engine.landerVX).not.toBe(0);
    // VY 应为 GRAVITY - MAIN_THRUST * cos(45°)
    const expectedVY = GRAVITY - MAIN_THRUST * Math.cos(Math.PI / 4);
    expect(engine.landerVY).toBeCloseTo(expectedVY, 5);
  });

  it('推力可以对抗重力（悬停）', () => {
    // MAIN_THRUST > GRAVITY，所以推力可以对抗重力
    expect(MAIN_THRUST).toBeGreaterThan(GRAVITY);
  });
});

// ========== 旋转测试 ==========

describe('LunarLanderEngine - 旋转', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('按左箭头开启左旋转', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.isRotatingLeft).toBe(true);
  });

  it('按右箭头开启右旋转', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.isRotatingRight).toBe(true);
  });

  it('A 键也能左旋转', () => {
    engine.handleKeyDown('a');
    expect(engine.isRotatingLeft).toBe(true);
  });

  it('D 键也能右旋转', () => {
    engine.handleKeyDown('d');
    expect(engine.isRotatingRight).toBe(true);
  });

  it('大写 A 键也能左旋转', () => {
    engine.handleKeyDown('A');
    expect(engine.isRotatingLeft).toBe(true);
  });

  it('大写 D 键也能右旋转', () => {
    engine.handleKeyDown('D');
    expect(engine.isRotatingRight).toBe(true);
  });

  it('松开左箭头停止左旋转', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyUp('ArrowLeft');
    expect(engine.isRotatingLeft).toBe(false);
  });

  it('松开右箭头停止右旋转', () => {
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyUp('ArrowRight');
    expect(engine.isRotatingRight).toBe(false);
  });

  it('左旋转使角度减小', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    expect(engine.landerAngle).toBeLessThan(0);
  });

  it('右旋转使角度增大', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 1);
    expect(engine.landerAngle).toBeGreaterThan(0);
  });

  it('旋转速度为 ROTATION_SPEED', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    expect(engine.landerAngle).toBe(-ROTATION_SPEED);
  });

  it('旋转消耗燃料', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    expect(engine.fuel).toBeLessThan(fuelBefore);
  });

  it('旋转每帧消耗 FUEL_CONSUMPTION_ROTATE', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    expect(engine.fuel).toBeCloseTo(fuelBefore - FUEL_CONSUMPTION_ROTATE, 5);
  });

  it('同时左右旋转时两个方向都消耗燃料', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    tick(engine, 1);
    expect(engine.fuel).toBeCloseTo(fuelBefore - 2 * FUEL_CONSUMPTION_ROTATE, 5);
  });

  it('同时左右旋转时角度抵消', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    tick(engine, 1);
    expect(engine.landerAngle).toBe(0);
  });

  it('多帧旋转角度持续变化', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 5);
    expect(engine.landerAngle).toBe(ROTATION_SPEED * 5);
  });
});

// ========== 燃料管理测试 ==========

describe('LunarLanderEngine - 燃料管理', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('燃料耗尽后推进无效', () => {
    setFuel(engine, 0);
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    // 没有推力效果，只有重力
    expect(engine.landerVY).toBeCloseTo(GRAVITY, 5);
  });

  it('燃料耗尽后旋转无效', () => {
    setFuel(engine, 0);
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    expect(engine.landerAngle).toBe(0);
  });

  it('燃料不会变为负数（推进）', () => {
    setFuel(engine, 0.1);
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    expect(engine.fuel).toBeGreaterThanOrEqual(0);
  });

  it('燃料不会变为负数（旋转）', () => {
    setFuel(engine, 0.01);
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    expect(engine.fuel).toBeGreaterThanOrEqual(0);
  });

  it('多帧推进持续消耗燃料', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowUp');
    tick(engine, 10);
    expect(engine.fuel).toBeCloseTo(fuelBefore - 10 * FUEL_CONSUMPTION_THRUST, 2);
  });

  it('多帧旋转持续消耗燃料', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 10);
    expect(engine.fuel).toBeCloseTo(fuelBefore - 10 * FUEL_CONSUMPTION_ROTATE, 2);
  });

  it('getInitialFuelForLevel 返回正确的燃料', () => {
    expect(engine.getInitialFuelForLevel()).toBe(INITIAL_FUEL);
  });

  it('getInitialFuelForLevel 随已完成关卡增加', () => {
    (engine as any)._completedLevels = 3;
    expect(engine.getInitialFuelForLevel()).toBe(INITIAL_FUEL + 3 * FUEL_BONUS_PER_LEVEL);
  });

  it('推进和旋转同时消耗燃料', () => {
    const fuelBefore = engine.fuel;
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    const expected = fuelBefore - FUEL_CONSUMPTION_THRUST - FUEL_CONSUMPTION_ROTATE;
    expect(engine.fuel).toBeCloseTo(expected, 5);
  });
});

// ========== 着陆判定测试 ==========

describe('LunarLanderEngine - 着陆判定', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('安全速度范围内 isSpeedSafe 返回 true', () => {
    setLanderVel(engine, 0, 0);
    expect(engine.isSpeedSafe()).toBe(true);
  });

  it('垂直速度超过阈值 isSpeedSafe 返回 false', () => {
    setLanderVel(engine, 0, MAX_SAFE_VY + 0.1);
    expect(engine.isSpeedSafe()).toBe(false);
  });

  it('水平速度超过阈值 isSpeedSafe 返回 false', () => {
    setLanderVel(engine, MAX_SAFE_VX + 0.1, 0);
    expect(engine.isSpeedSafe()).toBe(false);
  });

  it('恰好等于阈值 isSpeedSafe 返回 true', () => {
    setLanderVel(engine, MAX_SAFE_VX, MAX_SAFE_VY);
    expect(engine.isSpeedSafe()).toBe(true);
  });

  it('负速度绝对值在阈值内 isSpeedSafe 返回 true', () => {
    setLanderVel(engine, -MAX_SAFE_VX, -MAX_SAFE_VY);
    expect(engine.isSpeedSafe()).toBe(true);
  });

  it('安全角度内 isAngleSafe 返回 true', () => {
    setLanderAngle(engine, 0);
    expect(engine.isAngleSafe()).toBe(true);
  });

  it('角度超过阈值 isAngleSafe 返回 false', () => {
    setLanderAngle(engine, MAX_SAFE_ANGLE + 1);
    expect(engine.isAngleSafe()).toBe(false);
  });

  it('恰好等于角度阈值 isAngleSafe 返回 true', () => {
    setLanderAngle(engine, MAX_SAFE_ANGLE);
    expect(engine.isAngleSafe()).toBe(true);
  });

  it('负角度超过阈值 isAngleSafe 返回 false', () => {
    setLanderAngle(engine, -(MAX_SAFE_ANGLE + 1));
    expect(engine.isAngleSafe()).toBe(false);
  });

  it('成功着陆：在着陆区 + 安全速度 + 安全角度', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.landingResult).toBe('success');
    expect(engine.landed).toBe(true);
  });

  it('成功着陆触发 landingSuccess 事件', () => {
    const callback = vi.fn();
    engine.on('landingSuccess', callback);
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        level: expect.any(Number),
        fuel: expect.any(Number),
        score: expect.any(Number),
      }),
    );
  });

  it('成功着陆后游戏结束', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('着陆后速度归零', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0.5, 0.5);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.landerVX).toBe(0);
    expect(engine.landerVY).toBe(0);
  });
});

// ========== 坠毁测试 ==========

describe('LunarLanderEngine - 坠毁', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('速度过快导致坠毁', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, MAX_SAFE_VY + 1);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.landingResult).toBe('crash');
  });

  it('角度过大导致坠毁', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, MAX_SAFE_ANGLE + 5);
    tick(engine, 1);
    expect(engine.landingResult).toBe('crash');
  });

  it('不在着陆区内导致坠毁', () => {
    // 放在着陆区外
    const lz = engine.landingZone!;
    const outsideX = lz.leftX - 20;
    placeOnTerrain(engine, outsideX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.landingResult).toBe('crash');
  });

  it('坠毁触发 landingCrash 事件', () => {
    const callback = vi.fn();
    engine.on('landingCrash', callback);
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, MAX_SAFE_VY + 1);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        vx: expect.any(Number),
        vy: expect.any(Number),
        angle: expect.any(Number),
        inZone: expect.any(Boolean),
      }),
    );
  });

  it('坠毁生成爆炸粒子', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, MAX_SAFE_VY + 1);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.explosionParticles.length).toBeGreaterThan(0);
  });

  it('坠毁后游戏结束', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, MAX_SAFE_VY + 1);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('爆炸粒子随时间衰减', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, MAX_SAFE_VY + 1);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    const countAfterCrash = engine.explosionParticles.length;
    tick(engine, 60);
    expect(engine.explosionParticles.length).toBeLessThan(countAfterCrash);
  });

  it('着陆后不再更新位置', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    const yAfterLand = engine.landerY;
    const xAfterLand = engine.landerX;
    tick(engine, 10);
    expect(engine.landerY).toBe(yAfterLand);
    expect(engine.landerX).toBe(xAfterLand);
  });
});

// ========== 地形测试 ==========

describe('LunarLanderEngine - 地形', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('getTerrainHeightAt 返回合理值', () => {
    const h = engine.getTerrainHeightAt(CANVAS_WIDTH / 2);
    expect(h).toBeGreaterThanOrEqual(TERRAIN_MIN_Y);
    expect(h).toBeLessThanOrEqual(TERRAIN_MAX_Y);
  });

  it('getTerrainHeightAt 在边界返回地形值', () => {
    const h0 = engine.getTerrainHeightAt(0);
    const hEnd = engine.getTerrainHeightAt(CANVAS_WIDTH);
    expect(h0).toBeGreaterThanOrEqual(TERRAIN_MIN_Y);
    expect(hEnd).toBeGreaterThanOrEqual(TERRAIN_MIN_Y);
  });

  it('getTerrainHeightAt 超出左边界返回首点值', () => {
    const hLeft = engine.getTerrainHeightAt(-100);
    const hFirst = engine.getTerrainHeightAt(0);
    expect(hLeft).toBe(hFirst);
  });

  it('getTerrainHeightAt 超出右边界返回末点值', () => {
    const hRight = engine.getTerrainHeightAt(CANVAS_WIDTH + 100);
    const hLast = engine.getTerrainHeightAt(CANVAS_WIDTH);
    expect(hRight).toBe(hLast);
  });

  it('getTerrainHeightAt 在两点间线性插值', () => {
    const terrain = engine.terrain;
    if (terrain.length >= 2) {
      const p1 = terrain[0];
      const p2 = terrain[1];
      const midX = (p1.x + p2.x) / 2;
      const expectedY = (p1.y + p2.y) / 2;
      const actualY = engine.getTerrainHeightAt(midX);
      expect(actualY).toBeCloseTo(expectedY, 1);
    }
  });

  it('着陆区是平坦的', () => {
    const lz = engine.landingZone!;
    const midX = (lz.leftX + lz.rightX) / 2;
    const hLeft = engine.getTerrainHeightAt(lz.leftX);
    const hMid = engine.getTerrainHeightAt(midX);
    const hRight = engine.getTerrainHeightAt(lz.rightX);
    expect(hLeft).toBe(lz.y);
    expect(hMid).toBe(lz.y);
    expect(hRight).toBe(lz.y);
  });

  it('着陆区宽度不小于最小宽度', () => {
    const lz = engine.landingZone!;
    const width = lz.rightX - lz.leftX;
    expect(width).toBeGreaterThanOrEqual(MIN_LANDING_ZONE_WIDTH);
  });
});

// ========== 关卡测试 ==========

describe('LunarLanderEngine - 关卡', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('getLandingZoneWidth 第 1 关为基础宽度', () => {
    expect(engine.getLandingZoneWidth()).toBe(BASE_LANDING_ZONE_WIDTH);
  });

  it('getLandingZoneWidth 随关卡递减', () => {
    (engine as any)._level = 2;
    const w2 = engine.getLandingZoneWidth();
    expect(w2).toBe(BASE_LANDING_ZONE_WIDTH - LANDING_ZONE_WIDTH_DECREASE);
  });

  it('getLandingZoneWidth 不小于最小宽度', () => {
    (engine as any)._level = 100;
    expect(engine.getLandingZoneWidth()).toBe(MIN_LANDING_ZONE_WIDTH);
  });

  it('nextLevel 在未成功着陆时无效', () => {
    engine.nextLevel();
    expect(engine.level).toBe(1);
  });

  it('nextLevel 成功着陆后可以进入下一关', () => {
    // 先成功着陆
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.landingResult).toBe('success');

    engine.nextLevel();
    expect(engine.level).toBe(2);
  });

  it('nextLevel 增加 completedLevels', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    engine.nextLevel();
    expect(engine.completedLevels).toBe(1);
  });

  it('nextLevel 重置着陆器位置', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    engine.nextLevel();
    expect(engine.landerX).toBe(LANDER_START_X);
    expect(engine.landerY).toBe(LANDER_START_Y);
  });

  it('nextLevel 重置速度和角度', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    engine.nextLevel();
    expect(engine.landerVX).toBe(0);
    expect(engine.landerVY).toBe(0);
    expect(engine.landerAngle).toBe(0);
  });

  it('nextLevel 增加燃料（有关卡奖励）', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    engine.nextLevel();
    expect(engine.fuel).toBe(INITIAL_FUEL + 1 * FUEL_BONUS_PER_LEVEL);
  });

  it('nextLevel 后状态为 playing', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    engine.nextLevel();
    expect(engine.status).toBe('playing');
  });

  it('nextLevel 重新生成地形', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    engine.nextLevel();
    expect(engine.terrain.length).toBe(TERRAIN_SEGMENTS + 1);
    expect(engine.landingZone).not.toBeNull();
  });

  it('达到最大关卡后 nextLevel 触发 gameOver', () => {
    (engine as any)._level = MAX_LEVELS;
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    engine.nextLevel();
    expect(engine.status).toBe('gameover');
  });
});

// ========== 计分测试 ==========

describe('LunarLanderEngine - 计分', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('成功着陆获得分数', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.score).toBeGreaterThan(0);
  });

  it('得分包含关卡奖励（level * 100）', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    const levelBonus = engine.level * 100;
    expect(engine.score).toBeGreaterThanOrEqual(levelBonus);
  });

  it('得分包含燃料奖励（fuel * 10）', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    // 满油着陆 = level*100 + INITIAL_FUEL*10
    const levelBonus = engine.level * 100;
    const fuelBonus = Math.floor(INITIAL_FUEL) * 10;
    expect(engine.score).toBeGreaterThanOrEqual(levelBonus + fuelBonus);
  });

  it('剩余燃料越多得分越高', () => {
    // 满油着陆
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    const fullFuelScore = engine.score;

    // 重来，低油着陆
    engine.start();
    const lz2 = engine.landingZone!;
    const centerX2 = (lz2.leftX + lz2.rightX) / 2;
    placeOnTerrain(engine, centerX2);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    setFuel(engine, 10);
    tick(engine, 1);
    const lowFuelScore = engine.score;
    expect(fullFuelScore).toBeGreaterThan(lowFuelScore);
  });

  it('坠毁不得分', () => {
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, MAX_SAFE_VY + 1);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.score).toBe(0);
  });
});

// ========== 状态管理测试 ==========

describe('LunarLanderEngine - 状态管理', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('idle 状态按空格开始游戏', () => {
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态按空格重新开始', () => {
    engine.start();
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('Space 键也能开始游戏', () => {
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });

  it('gameover 后按空格重置已完成关卡', () => {
    engine.start();
    (engine as any)._completedLevels = 5;
    (engine as any).gameOver();
    engine.handleKeyDown(' ');
    // start() 会重置 score 和 level，但 completedLevels 在 reset() 中才清零
    // handleKeyDown(' ') 在 gameover 时调用 reset() + start()
    expect(engine.completedLevels).toBe(0);
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

  it('idle 状态 pause 无效', () => {
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态 resume 无效', () => {
    engine.resume();
    expect(engine.status).toBe('idle');
  });

  it('playing 状态 resume 无效', () => {
    engine.start();
    engine.resume();
    expect(engine.status).toBe('playing');
  });
});

// ========== 边界测试 ==========

describe('LunarLanderEngine - 边界', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('着陆器不能超出左边界', () => {
    setLanderPos(engine, -10, 100);
    tick(engine, 1);
    expect(engine.landerX).toBeGreaterThanOrEqual(0);
  });

  it('着陆器不能超出右边界', () => {
    setLanderPos(engine, CANVAS_WIDTH + 10, 100);
    tick(engine, 1);
    expect(engine.landerX).toBeLessThanOrEqual(CANVAS_WIDTH);
  });

  it('着陆器不能超出顶部', () => {
    setLanderPos(engine, 240, -10);
    tick(engine, 1);
    expect(engine.landerY).toBeGreaterThanOrEqual(0);
  });

  it('碰到左边界时水平速度归零', () => {
    setLanderPos(engine, -1, 100);
    setLanderVel(engine, -5, 0);
    tick(engine, 1);
    expect(engine.landerVX).toBe(0);
  });

  it('碰到右边界时水平速度归零', () => {
    setLanderPos(engine, CANVAS_WIDTH + 1, 100);
    setLanderVel(engine, 5, 0);
    tick(engine, 1);
    expect(engine.landerVX).toBe(0);
  });

  it('碰到顶部时垂直速度归零', () => {
    setLanderPos(engine, 240, -1);
    setLanderVel(engine, 0, -5);
    tick(engine, 1);
    expect(engine.landerVY).toBe(0);
  });
});

// ========== 键盘输入测试 ==========

describe('LunarLanderEngine - 键盘输入', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('ArrowUp 设置 isThrusting', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.isThrusting).toBe(true);
    engine.handleKeyUp('ArrowUp');
    expect(engine.isThrusting).toBe(false);
  });

  it('w 设置 isThrusting', () => {
    engine.handleKeyDown('w');
    expect(engine.isThrusting).toBe(true);
    engine.handleKeyUp('w');
    expect(engine.isThrusting).toBe(false);
  });

  it('W 设置 isThrusting', () => {
    engine.handleKeyDown('W');
    expect(engine.isThrusting).toBe(true);
    engine.handleKeyUp('W');
    expect(engine.isThrusting).toBe(false);
  });

  it('ArrowLeft 设置 isRotatingLeft', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.isRotatingLeft).toBe(true);
    engine.handleKeyUp('ArrowLeft');
    expect(engine.isRotatingLeft).toBe(false);
  });

  it('ArrowRight 设置 isRotatingRight', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.isRotatingRight).toBe(true);
    engine.handleKeyUp('ArrowRight');
    expect(engine.isRotatingRight).toBe(false);
  });

  it('a 设置 isRotatingLeft', () => {
    engine.handleKeyDown('a');
    expect(engine.isRotatingLeft).toBe(true);
    engine.handleKeyUp('a');
    expect(engine.isRotatingLeft).toBe(false);
  });

  it('d 设置 isRotatingRight', () => {
    engine.handleKeyDown('d');
    expect(engine.isRotatingRight).toBe(true);
    engine.handleKeyUp('d');
    expect(engine.isRotatingRight).toBe(false);
  });

  it('A 设置 isRotatingLeft', () => {
    engine.handleKeyDown('A');
    expect(engine.isRotatingLeft).toBe(true);
  });

  it('D 设置 isRotatingRight', () => {
    engine.handleKeyDown('D');
    expect(engine.isRotatingRight).toBe(true);
  });

  it('不相关的键不改变状态', () => {
    engine.handleKeyDown('Enter');
    expect(engine.isThrusting).toBe(false);
    expect(engine.isRotatingLeft).toBe(false);
    expect(engine.isRotatingRight).toBe(false);
  });
});

// ========== getState 测试 ==========

describe('LunarLanderEngine - getState', () => {
  let engine: LunarLanderEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('返回正确的分数', () => {
    const state = engine.getState();
    expect(state.score).toBe(0);
  });

  it('返回正确的等级', () => {
    const state = engine.getState();
    expect(state.level).toBe(1);
  });

  it('返回着陆器位置', () => {
    const state = engine.getState();
    expect(state.landerX).toBe(LANDER_START_X);
    expect(state.landerY).toBe(LANDER_START_Y);
  });

  it('返回着陆器速度', () => {
    const state = engine.getState();
    expect(state.landerVX).toBe(0);
    expect(state.landerVY).toBe(0);
  });

  it('返回着陆器角度', () => {
    const state = engine.getState();
    expect(state.landerAngle).toBe(0);
  });

  it('返回燃料', () => {
    const state = engine.getState();
    expect(state.fuel).toBe(INITIAL_FUEL);
  });

  it('返回推进状态', () => {
    engine.handleKeyDown('ArrowUp');
    const state = engine.getState();
    expect(state.isThrusting).toBe(true);
    expect(state.isRotatingLeft).toBe(false);
    expect(state.isRotatingRight).toBe(false);
  });

  it('返回着陆结果', () => {
    const state = engine.getState();
    expect(state.landingResult).toBeNull();
    expect(state.landed).toBe(false);
  });

  it('返回已完成关卡', () => {
    const state = engine.getState();
    expect(state.completedLevels).toBe(0);
  });

  it('返回地形数据', () => {
    const state = engine.getState();
    expect(Array.isArray(state.terrain)).toBe(true);
    expect((state.terrain as any[]).length).toBe(TERRAIN_SEGMENTS + 1);
  });

  it('返回着陆区数据', () => {
    const state = engine.getState();
    expect(state.landingZone).not.toBeNull();
  });

  it('状态随游戏更新', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 5);
    const state = engine.getState();
    expect(state.fuel).toBeLessThan(INITIAL_FUEL);
    // 推力对抗重力，但仍有位移
    expect(state.landerVY).not.toBe(0);
  });
});

// ========== 事件测试 ==========

describe('LunarLanderEngine - 事件', () => {
  let engine: LunarLanderEngine;

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

  it('成功着陆触发 landingSuccess 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('landingSuccess', callback);
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('坠毁触发 landingCrash 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('landingCrash', callback);
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, MAX_SAFE_VY + 1);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('nextLevel 触发 statusChange 事件', () => {
    engine.start();
    const lz = engine.landingZone!;
    const centerX = (lz.leftX + lz.rightX) / 2;
    placeOnTerrain(engine, centerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);

    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.nextLevel();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('addScore 触发 scoreChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('scoreChange', callback);
    (engine as any).addScore(500);
    expect(callback).toHaveBeenCalledWith(500);
  });
});

// ========== 边界与异常测试 ==========

describe('LunarLanderEngine - 边界与异常', () => {
  it('未初始化 canvas 就 start 会抛出错误', () => {
    const engine = new LunarLanderEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('重复 start 不会出错', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
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

  it('getTerrainHeightAt 空地形返回 CANVAS_HEIGHT', () => {
    const engine = createEngine();
    (engine as any)._terrain = [];
    expect(engine.getTerrainHeightAt(100)).toBe(CANVAS_HEIGHT);
  });

  it('getTerrainHeightAt 单点地形返回 CANVAS_HEIGHT', () => {
    const engine = createEngine();
    (engine as any)._terrain = [{ x: 0, y: 500 }];
    expect(engine.getTerrainHeightAt(100)).toBe(CANVAS_HEIGHT);
  });

  it('着陆区为 null 时不在着陆区', () => {
    const engine = createEngine();
    engine.start();
    (engine as any)._landingZone = null;
    // 通过坠毁检测间接测试 isInLandingZone
    // 放在地形上但不在着陆区
    placeOnTerrain(engine, engine.landerX);
    setLanderVel(engine, 0, 0);
    setLanderAngle(engine, 0);
    tick(engine, 1);
    expect(engine.landingResult).toBe('crash');
  });

  it('多次 reset 不出错', () => {
    const engine = createEngine();
    engine.start();
    engine.reset();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('destroy 后事件监听被清除', () => {
    const engine = createEngine();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    // destroy 内部调用 reset，reset 触发 statusChange('idle')
    // 所以 callback 会被调用一次（destroy 过程中）
    engine.destroy();
    callback.mockClear();
    // 重新 init 和 start
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    engine.init(canvas);
    engine.start();
    // callback 不应该被调用（destroy 清除了监听）
    expect(callback).not.toHaveBeenCalled();
  });
});
