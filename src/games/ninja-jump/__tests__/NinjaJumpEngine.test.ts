import { vi } from 'vitest';
import { NinjaJumpEngine } from '../NinjaJumpEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPEED, JUMP_VELOCITY, GRAVITY,
  INITIAL_LIVES,
  PLATFORM_WIDTH, PLATFORM_HEIGHT,
  PLATFORM_COLOR_NORMAL, PLATFORM_COLOR_MOVING, PLATFORM_COLOR_FRAGILE,
  PLATFORM_COLOR_SPRING, PLATFORM_SPACING, PLATFORMS_ON_SCREEN,
  MOVING_PLATFORM_SPEED, MOVING_PLATFORM_RANGE, SPRING_JUMP_MULTIPLIER,
  POWERUP_SIZE,
  POWERUP_DART_DURATION, POWERUP_SHIELD_DURATION, POWERUP_MAGNET_DURATION,
  POWERUP_MAGNET_RANGE, POWERUP_MAGNET_FORCE,
  POWERUP_SPAWN_CHANCE,
  DART_WIDTH, DART_HEIGHT, DART_SPEED, MAX_DARTS,
  ENEMY_FLYING_SIZE, ENEMY_FLYING_SPEED, ENEMY_FLYING_COLOR,
  ENEMY_ROCK_SIZE, ENEMY_ROCK_SPEED, ENEMY_ROCK_COLOR,
  ENEMY_SPAWN_INTERVAL_BASE, ENEMY_SPAWN_INTERVAL_MIN, ENEMY_SCORE,
  DIFFICULTY_INTERVAL, MAX_DIFFICULTY_LEVEL,
  HEIGHT_SCORE_MULTIPLIER,
  DIR_LEFT, DIR_RIGHT,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): NinjaJumpEngine {
  const engine = new NinjaJumpEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 模拟游戏循环若干帧 */
function tick(engine: NinjaJumpEngine, frames: number, dt: number = 16): void {
  for (let i = 0; i < frames; i++) {
    (engine as any).update(dt);
  }
}

/** 启动引擎并返回 */
function startEngine(): NinjaJumpEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

// ========== 常量测试 ==========

describe('NinjaJump Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('玩家尺寸为 32x32', () => {
    expect(PLAYER_WIDTH).toBe(32);
    expect(PLAYER_HEIGHT).toBe(32);
  });

  it('跳跃速度为负值（向上）', () => {
    expect(JUMP_VELOCITY).toBeLessThan(0);
  });

  it('重力为正值（向下）', () => {
    expect(GRAVITY).toBeGreaterThan(0);
  });

  it('初始生命数为 3', () => {
    expect(INITIAL_LIVES).toBe(3);
  });

  it('平台尺寸正确', () => {
    expect(PLATFORM_WIDTH).toBe(70);
    expect(PLATFORM_HEIGHT).toBe(12);
  });

  it('弹簧跳跃倍率大于 1', () => {
    expect(SPRING_JUMP_MULTIPLIER).toBeGreaterThan(1);
  });

  it('道具大小为 20', () => {
    expect(POWERUP_SIZE).toBe(20);
  });

  it('飞镖尺寸和速度正确', () => {
    expect(DART_WIDTH).toBe(8);
    expect(DART_HEIGHT).toBe(16);
    expect(DART_SPEED).toBe(500);
  });

  it('最大飞镖数为 3', () => {
    expect(MAX_DARTS).toBe(3);
  });

  it('敌人尺寸正确', () => {
    expect(ENEMY_FLYING_SIZE).toBe(28);
    expect(ENEMY_ROCK_SIZE).toBe(24);
  });

  it('方向常量正确', () => {
    expect(DIR_LEFT).toBe(-1);
    expect(DIR_RIGHT).toBe(1);
  });

  it('难度间隔为 2000', () => {
    expect(DIFFICULTY_INTERVAL).toBe(2000);
  });

  it('最大难度等级为 10', () => {
    expect(MAX_DIFFICULTY_LEVEL).toBe(10);
  });

  it('敌人基础生成间隔大于最小间隔', () => {
    expect(ENEMY_SPAWN_INTERVAL_BASE).toBeGreaterThan(ENEMY_SPAWN_INTERVAL_MIN);
  });

  it('道具生成概率在 0-1 之间', () => {
    expect(POWERUP_SPAWN_CHANCE).toBeGreaterThan(0);
    expect(POWERUP_SPAWN_CHANCE).toBeLessThan(1);
  });
});

// ========== 初始化测试 ==========

describe('NinjaJumpEngine - 初始化', () => {
  let engine: NinjaJumpEngine;

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

  it('初始生命数为 3', () => {
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('玩家初始位于画布底部区域', () => {
    expect(engine.playerY).toBeGreaterThan(CANVAS_HEIGHT / 2);
  });

  it('初始垂直速度为 0', () => {
    expect(engine.playerVY).toBe(0);
  });

  it('初始没有平台', () => {
    expect(engine.platforms.length).toBe(0);
  });

  it('初始没有道具', () => {
    expect(engine.powerUps.length).toBe(0);
  });

  it('初始没有飞镖', () => {
    expect(engine.darts.length).toBe(0);
  });

  it('初始没有敌人', () => {
    expect(engine.enemies.length).toBe(0);
  });

  it('初始没有活跃道具效果', () => {
    expect(engine.activePowerUps.length).toBe(0);
  });

  it('初始难度为 1', () => {
    expect(engine.difficultyLevel).toBe(1);
  });

  it('初始相机位置为 0', () => {
    expect(engine.cameraY).toBe(0);
  });

  it('初始最高高度为 0', () => {
    expect(engine.maxHeight).toBe(0);
  });

  it('初始无敌时间为 0', () => {
    expect(engine.invincibleTimer).toBe(0);
  });
});

// ========== 生命周期测试 ==========

describe('NinjaJumpEngine - 生命周期', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后生成初始平台', () => {
    engine.start();
    expect(engine.platforms.length).toBeGreaterThan(0);
  });

  it('start 后玩家获得初始跳跃速度', () => {
    engine.start();
    expect(engine.playerVY).toBeLessThan(0); // 向上
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

  it('reset 后生命恢复', () => {
    engine.start();
    engine.reset();
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('reset 后平台清空', () => {
    engine.start();
    engine.reset();
    expect(engine.platforms.length).toBe(0);
  });

  it('reset 后敌人清空', () => {
    engine.start();
    engine.reset();
    expect(engine.enemies.length).toBe(0);
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
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('start 后分数为 0', () => {
    engine.start();
    expect(engine.score).toBe(0);
  });

  it('start 后等级为 1', () => {
    engine.start();
    expect(engine.level).toBe(1);
  });
});

// ========== 玩家移动测试 ==========

describe('NinjaJumpEngine - 玩家移动', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('按左键玩家向左移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 10);
    expect(engine.playerX).toBeLessThan(startX);
  });

  it('按右键玩家向右移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 10);
    expect(engine.playerX).toBeGreaterThan(startX);
  });

  it('按 A 键向左移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('a');
    tick(engine, 10);
    expect(engine.playerX).toBeLessThan(startX);
  });

  it('按 D 键向右移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('d');
    tick(engine, 10);
    expect(engine.playerX).toBeGreaterThan(startX);
  });

  it('松开按键后停止水平移动', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 5);
    const x1 = engine.playerX;
    engine.handleKeyUp('ArrowRight');
    tick(engine, 5);
    const x2 = engine.playerX;
    // 水平速度为 0，所以位置不应变化（只有垂直运动）
    expect(x2).toBeCloseTo(x1, 1);
  });

  it('玩家可以从左边穿越到右边', () => {
    (engine as any)._playerX = -PLAYER_WIDTH + 1;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1, 16);
    // 应该出现在右边
    expect(engine.playerX).toBeGreaterThan(CANVAS_WIDTH / 2);
  });

  it('玩家可以从右边穿越到左边', () => {
    (engine as any)._playerX = CANVAS_WIDTH - 1;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 1, 16);
    // 应该出现在左边
    expect(engine.playerX).toBeLessThan(0);
  });

  it('重力使玩家向下加速', () => {
    const initialVY = engine.playerVY;
    tick(engine, 5);
    expect(engine.playerVY).toBeGreaterThan(initialVY);
  });
});

// ========== 平台测试 ==========

describe('NinjaJumpEngine - 平台', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('初始平台包含不同类型', () => {
    const types = new Set(engine.platforms.map(p => p.type));
    // 至少有普通平台
    expect(types.has('normal')).toBe(true);
  });

  it('移动平台在范围内移动', () => {
    // 添加一个移动平台
    (engine as any)._platforms.push({
      x: 200, y: 300, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'moving', alive: true, originX: 200, moveDir: DIR_RIGHT,
    });
    const platIndex = engine.platforms.length - 1;
    const startX = engine.platforms[platIndex].x;
    tick(engine, 30);
    expect(engine.platforms[platIndex].x).not.toBe(startX);
  });

  it('移动平台到达边界后反向', () => {
    (engine as any)._platforms.push({
      x: 200, y: 300, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'moving', alive: true, originX: 200, moveDir: DIR_RIGHT,
    });
    const platIndex = engine.platforms.length - 1;
    // 模拟足够长时间使其到达边界
    tick(engine, 200);
    const plat = engine.platforms[platIndex];
    if (plat) {
      // 应该在 originX ± range/2 范围内
      expect(plat.x).toBeGreaterThanOrEqual(200 - MOVING_PLATFORM_RANGE / 2);
      expect(plat.x).toBeLessThanOrEqual(200 + MOVING_PLATFORM_RANGE / 2);
    }
  });

  it('易碎平台被踩后开始破碎', () => {
    // 清除其他平台，只保留易碎平台
    (engine as any)._platforms = [];
    const fragilePlat = {
      x: 200, y: 300, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'fragile' as const, alive: true, breaking: false, breakTimer: 0,
    };
    (engine as any)._platforms.push(fragilePlat);
    // 玩家刚好在平台上方，速度向下
    (engine as any)._playerX = 210;
    (engine as any)._playerY = 300 - PLAYER_HEIGHT - 1;
    (engine as any)._playerVY = 50; // 向下速度适中
    // 禁止生成新平台
    (engine as any)._highestPlatformY = -100000;

    tick(engine, 5);

    const plat = engine.platforms.find(p => p.type === 'fragile');
    expect(plat).toBeDefined();
    if (plat) {
      expect(plat.breaking).toBe(true);
    }
  });

  it('易碎平台破碎后消失', () => {
    // 清除其他平台
    (engine as any)._platforms = [];
    // 禁止生成新平台
    (engine as any)._highestPlatformY = -100000;
    // 阻止相机移动
    (engine as any)._cameraY = -10000;

    const fragilePlat = {
      x: 200, y: -9500, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'fragile' as const, alive: true, breaking: true, breakTimer: 0,
    };
    (engine as any)._platforms.push(fragilePlat);
    // 0.3 seconds = ~19 frames at 16ms
    tick(engine, 25);
    const plat = engine.platforms.find(p => p.type === 'fragile');
    // 平台应该已经消失（被清理掉）
    if (plat) {
      expect(plat.alive).toBe(false);
    } else {
      // 平台被清理了，这也说明它已经消失
      expect(true).toBe(true);
    }
  });

  it('弹簧平台提供更高跳跃', () => {
    // 设置玩家在弹簧平台上方
    const springPlat = {
      x: 200, y: 400, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'spring' as const, alive: true,
    };
    (engine as any)._platforms.push(springPlat);
    (engine as any)._playerX = 210;
    (engine as any)._playerY = 400 - PLAYER_HEIGHT - 2;
    (engine as any)._playerVY = 100; // 向下

    tick(engine, 2);

    // 弹簧跳跃速度应比普通跳跃更强（绝对值更大）
    // 注意：重力会减少绝对值，所以只检查第一帧
    const jumpVY = JUMP_VELOCITY * SPRING_JUMP_MULTIPLIER;
    expect(engine.playerVY).toBeLessThanOrEqual(jumpVY + 100); // 允许一些重力影响
  });

  it('平台不断向上生成', () => {
    // 模拟玩家跳得很高
    (engine as any)._playerY = -5000;
    (engine as any)._playerVY = -200;
    tick(engine, 10);
    // 应该有新平台生成
    expect(engine.platforms.length).toBeGreaterThan(0);
  });

  it('所有平台都有合理尺寸', () => {
    for (const plat of engine.platforms) {
      expect(plat.width).toBeGreaterThanOrEqual(PLATFORM_WIDTH);
      expect(plat.height).toBe(PLATFORM_HEIGHT);
    }
  });
});

// ========== 碰撞检测测试 ==========

describe('NinjaJumpEngine - 碰撞检测', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('下落时碰到平台会弹起', () => {
    // 放一个平台在玩家下方
    const platY = engine.playerY + PLAYER_HEIGHT + 5;
    (engine as any)._platforms = [{
      x: engine.playerX, y: platY, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'normal', alive: true,
    }];
    (engine as any)._playerVY = 200; // 向下

    tick(engine, 3);

    // 应该弹起了（速度变为负）
    expect(engine.playerVY).toBeLessThan(0);
  });

  it('上升时穿过平台（不碰撞）', () => {
    const platY = engine.playerY + PLAYER_HEIGHT + 5;
    (engine as any)._platforms = [{
      x: engine.playerX, y: platY, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'normal', alive: true,
    }];
    (engine as any)._playerVY = -300; // 向上

    const prevY = engine.playerY;
    tick(engine, 3);

    // 玩家应该继续向上，没有被弹起
    expect(engine.playerY).toBeLessThan(prevY);
    expect(engine.playerVY).toBeLessThan(0); // 仍然向上
  });

  it('玩家不与平台水平重叠时不碰撞', () => {
    (engine as any)._platforms = [{
      x: engine.playerX + PLATFORM_WIDTH + 50, y: engine.playerY + PLAYER_HEIGHT + 5,
      width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'normal', alive: true,
    }];
    (engine as any)._playerVY = 200;

    tick(engine, 3);
    // 应该继续下落
    expect(engine.playerVY).toBeGreaterThan(0);
  });
});

// ========== 道具系统测试 ==========

describe('NinjaJumpEngine - 道具系统', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('收集飞镖道具后获得飞镖能力', () => {
    (engine as any)._powerUps = [{
      x: engine.playerX, y: engine.playerY,
      type: 'dart', alive: true, collected: false,
    }];
    tick(engine, 1);
    expect(engine.hasDartPowerUp()).toBe(true);
  });

  it('收集护盾道具后获得护盾', () => {
    (engine as any)._powerUps = [{
      x: engine.playerX, y: engine.playerY,
      type: 'shield', alive: true, collected: false,
    }];
    tick(engine, 1);
    expect(engine.hasShield()).toBe(true);
  });

  it('收集磁铁道具后获得磁铁', () => {
    (engine as any)._powerUps = [{
      x: engine.playerX, y: engine.playerY,
      type: 'magnet', alive: true, collected: false,
    }];
    tick(engine, 1);
    expect(engine.hasMagnet()).toBe(true);
  });

  it('道具效果有时间限制', () => {
    (engine as any)._powerUps = [{
      x: engine.playerX, y: engine.playerY,
      type: 'dart', alive: true, collected: false,
    }];
    tick(engine, 1);
    expect(engine.hasDartPowerUp()).toBe(true);

    // 模拟时间流逝超过道具持续时间
    tick(engine, 600, 16); // ~9.6 秒
    expect(engine.hasDartPowerUp()).toBe(false);
  });

  it('重复收集同类道具刷新时间', () => {
    (engine as any).activatePowerUp('dart');
    const pu1 = engine.activePowerUps.find(p => p.type === 'dart')!;
    const firstRemaining = pu1.remainingTime;

    // 立即再收集一个
    (engine as any).activatePowerUp('dart');
    const pu2 = engine.activePowerUps.find(p => p.type === 'dart')!;
    expect(pu2.remainingTime).toBe(POWERUP_DART_DURATION);
    // 只应该有一个同类型道具
    expect(engine.activePowerUps.filter(p => p.type === 'dart').length).toBe(1);
  });

  it('磁铁吸引附近道具', () => {
    // 先激活磁铁效果
    (engine as any).activatePowerUp('magnet');
    expect(engine.hasMagnet()).toBe(true);

    // 添加一个远处道具
    const targetPU = {
      x: engine.playerX + 100, y: engine.playerY,
      type: 'dart' as const, alive: true, collected: false,
    };
    (engine as any)._powerUps = [targetPU];

    const beforeX = targetPU.x;
    tick(engine, 10);
    // 道具应该被吸引（位置改变）
    const afterPU = engine.powerUps.find(p => p.type === 'dart' && p.alive);
    if (afterPU) {
      expect(afterPU.x).not.toBe(beforeX);
    }
  });

  it('收集道具时触发事件', () => {
    const spy = vi.fn();
    engine.on('powerUpActivated', spy);
    (engine as any).activatePowerUp('shield');
    expect(spy).toHaveBeenCalledWith('shield');
  });
});

// ========== 飞镖系统测试 ==========

describe('NinjaJumpEngine - 飞镖系统', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('有飞镖道具时按空格发射飞镖', () => {
    (engine as any).activatePowerUp('dart');
    engine.handleKeyDown(' ');
    tick(engine, 1);
    expect(engine.darts.length).toBeGreaterThan(0);
  });

  it('没有飞镖道具时不能发射', () => {
    engine.handleKeyDown(' ');
    tick(engine, 1);
    expect(engine.darts.length).toBe(0);
  });

  it('飞镖向上移动', () => {
    (engine as any).activatePowerUp('dart');
    engine.handleKeyDown(' ');
    tick(engine, 1);
    if (engine.darts.length > 0) {
      const startY = engine.darts[0].y;
      tick(engine, 5);
      expect(engine.darts[0].y).toBeLessThan(startY);
    }
  });

  it('飞镖数量不超过上限', () => {
    (engine as any).activatePowerUp('dart');
    for (let i = 0; i < 10; i++) {
      engine.handleKeyDown(' ');
      tick(engine, 1);
      engine.handleKeyUp(' ');
    }
    const activeDarts = engine.darts.filter(d => d.alive);
    expect(activeDarts.length).toBeLessThanOrEqual(MAX_DARTS);
  });

  it('飞镖出界后标记为不活跃', () => {
    const dart = { x: 200, y: engine.cameraY - 100, alive: true };
    (engine as any)._darts = [dart];
    tick(engine, 5);
    // 清理会移除不活跃的飞镖，所以列表应该为空
    expect(engine.darts.length).toBe(0);
  });
});

// ========== 敌人系统测试 ==========

describe('NinjaJumpEngine - 敌人系统', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('飞行忍者水平移动', () => {
    (engine as any)._enemies = [{
      x: 100, y: 200, type: 'flying', alive: true, dx: DIR_RIGHT,
    }];
    const startX = engine.enemies[0].x;
    tick(engine, 10);
    expect(engine.enemies[0].x).not.toBe(startX);
  });

  it('飞行忍者碰到边界反弹', () => {
    (engine as any)._enemies = [{
      x: CANVAS_WIDTH - ENEMY_FLYING_SIZE - 1, y: 200,
      type: 'flying', alive: true, dx: DIR_RIGHT,
    }];
    tick(engine, 20);
    // 应该反弹了
    expect(engine.enemies[0]?.dx).toBe(DIR_LEFT);
  });

  it('落石向下移动', () => {
    (engine as any)._enemies = [{
      x: 200, y: 100, type: 'rock', alive: true, dx: 0,
    }];
    const startY = engine.enemies[0].y;
    tick(engine, 10);
    expect(engine.enemies[0].y).toBeGreaterThan(startY);
  });

  it('敌人在定时器到期后生成', () => {
    (engine as any)._enemySpawnTimer = ENEMY_SPAWN_INTERVAL_BASE - 100;
    tick(engine, 10);
    // 应该生成了敌人
    expect(engine.enemies.length).toBeGreaterThan(0);
  });

  it('飞镖击中敌人得分', () => {
    (engine as any)._darts = [{
      x: 100, y: 195, alive: true,
    }];
    (engine as any)._enemies = [{
      x: 98, y: 200, type: 'flying', alive: true, dx: 1,
    }];
    const prevScore = engine.score;
    tick(engine, 1);
    expect(engine.score).toBe(prevScore + ENEMY_SCORE);
  });

  it('飞镖击中敌人后双方消失', () => {
    (engine as any)._darts = [{
      x: 100, y: 195, alive: true,
    }];
    (engine as any)._enemies = [{
      x: 98, y: 200, type: 'flying', alive: true, dx: 1,
    }];
    tick(engine, 1);
    // 清理后两者都不存在了
    expect(engine.darts.length).toBe(0);
    expect(engine.enemies.length).toBe(0);
  });

  it('敌人碰到玩家减少生命', () => {
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    const prevLives = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBeLessThan(prevLives);
  });

  it('有护盾时敌人不伤害玩家', () => {
    (engine as any).activatePowerUp('shield');
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    const prevLives = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(prevLives);
  });

  it('无敌时间内敌人不伤害玩家', () => {
    (engine as any)._invincibleTimer = 5;
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    const prevLives = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(prevLives);
  });
});

// ========== 相机系统测试 ==========

describe('NinjaJumpEngine - 相机系统', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('相机跟随玩家向上移动', () => {
    (engine as any)._playerY = -1000;
    (engine as any)._playerVY = -200;
    tick(engine, 5);
    expect(engine.cameraY).toBeLessThan(0);
  });

  it('相机不向下移动', () => {
    // 先让相机上移
    (engine as any)._cameraY = -500;
    // 然后玩家向下
    (engine as any)._playerY = 0;
    (engine as any)._playerVY = 200;
    tick(engine, 5);
    expect(engine.cameraY).toBe(-500);
  });

  it('最高高度随玩家上升更新', () => {
    (engine as any)._playerY = -2000;
    (engine as any)._playerVY = -100;
    tick(engine, 5);
    expect(engine.maxHeight).toBeGreaterThan(0);
  });

  it('高度增加时得分增加', () => {
    const prevScore = engine.score;
    (engine as any)._playerY = -1000;
    (engine as any)._playerVY = -100;
    tick(engine, 5);
    expect(engine.score).toBeGreaterThan(prevScore);
  });
});

// ========== 难度系统测试 ==========

describe('NinjaJumpEngine - 难度系统', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('初始难度为 1', () => {
    expect(engine.difficultyLevel).toBe(1);
  });

  it('分数增加时难度提升', () => {
    (engine as any).addScore(DIFFICULTY_INTERVAL);
    tick(engine, 1);
    expect(engine.difficultyLevel).toBeGreaterThanOrEqual(2);
  });

  it('难度不超过最大值', () => {
    (engine as any).addScore(DIFFICULTY_INTERVAL * 20);
    tick(engine, 1);
    expect(engine.difficultyLevel).toBeLessThanOrEqual(MAX_DIFFICULTY_LEVEL);
  });

  it('难度提升时等级同步更新', () => {
    (engine as any).addScore(DIFFICULTY_INTERVAL);
    tick(engine, 1);
    expect(engine.level).toBe(engine.difficultyLevel);
  });
});

// ========== 游戏结束测试 ==========

describe('NinjaJumpEngine - 游戏结束', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('玩家掉出屏幕底部触发游戏结束', () => {
    (engine as any)._playerY = engine.cameraY + CANVAS_HEIGHT + 100;
    (engine as any)._playerVY = 500;
    tick(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('生命耗尽触发游戏结束', () => {
    (engine as any)._lives = 1;
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    tick(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('游戏结束后敌人被清除', () => {
    (engine as any)._lives = 1;
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    tick(engine, 1);
    expect(engine.enemies.length).toBe(0);
  });

  it('游戏结束后飞镖被清除', () => {
    (engine as any)._lives = 1;
    (engine as any)._darts = [{ x: 100, y: 100, alive: true }];
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    tick(engine, 1);
    expect(engine.darts.length).toBe(0);
  });

  it('游戏结束后可以重新开始', () => {
    (engine as any)._playerY = engine.cameraY + CANVAS_HEIGHT + 100;
    tick(engine, 1);
    expect(engine.status).toBe('gameover');

    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.lives).toBe(INITIAL_LIVES);
    expect(engine.score).toBe(0);
  });
});

// ========== 事件系统测试 ==========

describe('NinjaJumpEngine - 事件系统', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 时触发 statusChange 事件', () => {
    const spy = vi.fn();
    engine.on('statusChange', spy);
    engine.start();
    expect(spy).toHaveBeenCalledWith('playing');
  });

  it('pause 时触发 statusChange 事件', () => {
    engine.start();
    const spy = vi.fn();
    engine.on('statusChange', spy);
    engine.pause();
    expect(spy).toHaveBeenCalledWith('paused');
  });

  it('resume 时触发 statusChange 事件', () => {
    engine.start();
    engine.pause();
    const spy = vi.fn();
    engine.on('statusChange', spy);
    engine.resume();
    expect(spy).toHaveBeenCalledWith('playing');
  });

  it('reset 时触发 statusChange 事件', () => {
    engine.start();
    const spy = vi.fn();
    engine.on('statusChange', spy);
    engine.reset();
    expect(spy).toHaveBeenCalledWith('idle');
  });

  it('gameOver 时触发 statusChange 事件', () => {
    engine.start();
    const spy = vi.fn();
    engine.on('statusChange', spy);
    (engine as any).gameOver();
    expect(spy).toHaveBeenCalledWith('gameover');
  });

  it('失去生命时触发 loseLife 事件', () => {
    engine.start();
    const spy = vi.fn();
    engine.on('loseLife', spy);
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    tick(engine, 1);
    expect(spy).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const spy = vi.fn();
    engine.on('statusChange', spy);
    engine.off('statusChange', spy);
    engine.start();
    expect(spy).not.toHaveBeenCalled();
  });
});

// ========== getState 测试 ==========

describe('NinjaJumpEngine - getState', () => {
  it('返回正确的游戏状态对象', () => {
    const engine = startEngine();
    const state = engine.getState();

    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('lives');
    expect(state).toHaveProperty('playerX');
    expect(state).toHaveProperty('playerY');
    expect(state).toHaveProperty('playerVY');
    expect(state).toHaveProperty('cameraY');
    expect(state).toHaveProperty('maxHeight');
    expect(state).toHaveProperty('difficultyLevel');
    expect(state).toHaveProperty('platformCount');
    expect(state).toHaveProperty('enemyCount');
    expect(state).toHaveProperty('dartCount');
    expect(state).toHaveProperty('activePowerUpTypes');
  });

  it('返回正确的初始分数', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
  });

  it('返回正确的生命数', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state.lives).toBe(INITIAL_LIVES);
  });
});

// ========== 清理测试 ==========

describe('NinjaJumpEngine - 清理', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('出界平台被清理', () => {
    // 设置相机和只保留一个出界平台
    (engine as any)._cameraY = -10000;
    (engine as any)._platforms = [{
      x: 200, y: 0, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT,
      type: 'normal', alive: true,
    }];
    // 禁止生成新平台
    (engine as any)._highestPlatformY = -20000;
    tick(engine, 1);
    // 平台在相机底部之下，应被清理
    expect(engine.platforms.length).toBe(0);
  });

  it('不活跃飞镖被清理', () => {
    (engine as any)._darts = [
      { x: 100, y: 100, alive: false },
      { x: 200, y: 200, alive: true },
    ];
    tick(engine, 1);
    expect(engine.darts.length).toBe(1);
  });

  it('不活跃敌人被清理', () => {
    (engine as any)._enemies = [
      { x: 100, y: 100, type: 'flying', alive: false, dx: 1 },
      { x: 200, y: 200, type: 'rock', alive: true, dx: 0 },
    ];
    tick(engine, 1);
    expect(engine.enemies.length).toBe(1);
  });

  it('已收集道具被清理', () => {
    (engine as any)._powerUps = [
      { x: 100, y: 100, type: 'dart', alive: false, collected: true },
      { x: 200, y: 200, type: 'shield', alive: true, collected: false },
    ];
    tick(engine, 1);
    expect(engine.powerUps.length).toBe(1);
  });
});

// ========== 无敌时间测试 ==========

describe('NinjaJumpEngine - 无敌时间', () => {
  let engine: NinjaJumpEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('被击中后进入无敌状态', () => {
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    tick(engine, 1);
    expect(engine.invincibleTimer).toBeGreaterThan(0);
  });

  it('无敌时间逐渐减少', () => {
    (engine as any)._invincibleTimer = 2;
    // 2 seconds = ~125 frames at 16ms
    tick(engine, 150);
    expect(engine.invincibleTimer).toBe(0);
  });

  it('无敌时间内不再受伤', () => {
    (engine as any)._invincibleTimer = 5;
    (engine as any)._enemies = [{
      x: engine.playerX, y: engine.playerY,
      type: 'flying', alive: true, dx: 1,
    }];
    const prevLives = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(prevLives);
  });
});

// ========== 综合集成测试 ==========

describe('NinjaJumpEngine - 集成测试', () => {
  it('完整游戏循环：开始-暂停-恢复-重置', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.status).toBe('playing');

    engine.pause();
    expect(engine.status).toBe('paused');

    engine.resume();
    expect(engine.status).toBe('playing');

    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('多次开始重置不会崩溃', () => {
    const engine = createEngine();
    for (let i = 0; i < 5; i++) {
      engine.start();
      tick(engine, 10);
      engine.reset();
    }
    expect(engine.status).toBe('idle');
  });

  it('快速按键不会崩溃', () => {
    const engine = createEngine();
    for (let i = 0; i < 20; i++) {
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown(' ');
      engine.handleKeyUp('ArrowLeft');
      engine.handleKeyUp('ArrowRight');
      engine.handleKeyUp(' ');
    }
    expect(engine.status).toBe('playing');
  });

  it('长时间运行不会内存泄漏（实体数量有上限）', () => {
    const engine = startEngine();
    // 模拟 1000 帧
    tick(engine, 1000);
    // 平台和敌人数量应该有合理上限
    expect(engine.platforms.length).toBeLessThan(100);
    expect(engine.enemies.length).toBeLessThan(50);
  });

  it('游戏结束后 destroy 清理所有资源', () => {
    const engine = startEngine();
    tick(engine, 50);
    (engine as any).gameOver();
    engine.destroy();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);
  });
});
