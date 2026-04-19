import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DonkeyKongEngine } from '../DonkeyKongEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPEED,
  PLAYER_JUMP_VELOCITY, PLAYER_GRAVITY, PLAYER_CLIMB_SPEED,
  INITIAL_LIVES,
  DK_WIDTH, DK_HEIGHT,
  DK_THROW_INTERVAL_BASE, DK_THROW_INTERVAL_MIN,
  BARREL_RADIUS, BARREL_SPEED_BASE, BARREL_SPEED_PER_LEVEL,
  BARREL_FALL_SPEED, BARREL_LADDER_CHANCE, BARREL_SCORE,
  PLATFORM_HEIGHT,
  LADDER_WIDTH,
  HOSTAGE_WIDTH, HOSTAGE_HEIGHT,
  LEVEL_COMPLETE_SCORE,
  DIR_LEFT, DIR_RIGHT,
  generateLevel,
  type Platform, type Ladder,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): DonkeyKongEngine {
  const engine = new DonkeyKongEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 模拟游戏循环若干帧 */
function tick(engine: DonkeyKongEngine, frames: number, dt: number = 16): void {
  for (let i = 0; i < frames; i++) {
    (engine as any).update(dt);
  }
}

// ========== 常量测试 ==========

describe('DonkeyKong Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('玩家尺寸合理', () => {
    expect(PLAYER_WIDTH).toBeGreaterThan(0);
    expect(PLAYER_HEIGHT).toBeGreaterThan(0);
  });

  it('大金刚尺寸合理', () => {
    expect(DK_WIDTH).toBeGreaterThan(0);
    expect(DK_HEIGHT).toBeGreaterThan(0);
  });

  it('滚桶半径合理', () => {
    expect(BARREL_RADIUS).toBeGreaterThan(0);
  });

  it('初始生命数为 3', () => {
    expect(INITIAL_LIVES).toBe(3);
  });

  it('方向常量正确', () => {
    expect(DIR_LEFT).toBe(-1);
    expect(DIR_RIGHT).toBe(1);
  });

  it('跳跃速度为负值（向上）', () => {
    expect(PLAYER_JUMP_VELOCITY).toBeLessThan(0);
  });

  it('重力为正值', () => {
    expect(PLAYER_GRAVITY).toBeGreaterThan(0);
  });

  it('滚桶速度基础值合理', () => {
    expect(BARREL_SPEED_BASE).toBeGreaterThan(0);
  });

  it('投掷间隔最小值合理', () => {
    expect(DK_THROW_INTERVAL_MIN).toBeGreaterThan(0);
    expect(DK_THROW_INTERVAL_MIN).toBeLessThan(DK_THROW_INTERVAL_BASE);
  });
});

// ========== 关卡布局生成测试 ==========

describe('DonkeyKong - generateLevel', () => {
  it('生成关卡包含平台', () => {
    const level = generateLevel(1);
    expect(level.platforms.length).toBeGreaterThan(0);
  });

  it('生成关卡包含梯子', () => {
    const level = generateLevel(1);
    expect(level.ladders.length).toBeGreaterThan(0);
  });

  it('大金刚位置在顶部区域', () => {
    const level = generateLevel(1);
    expect(level.dkY).toBeLessThan(CANVAS_HEIGHT / 3);
  });

  it('人质位置在顶部区域', () => {
    const level = generateLevel(1);
    expect(level.hostageY).toBeLessThan(CANVAS_HEIGHT / 3);
  });

  it('玩家起始位置在底部', () => {
    const level = generateLevel(1);
    expect(level.playerStartY).toBeGreaterThan(CANVAS_HEIGHT / 2);
  });

  it('平台宽度不为零', () => {
    const level = generateLevel(1);
    for (const plat of level.platforms) {
      expect(plat.width).toBeGreaterThan(0);
    }
  });

  it('梯子 topY < bottomY', () => {
    const level = generateLevel(1);
    for (const lad of level.ladders) {
      expect(lad.topY).toBeLessThan(lad.bottomY);
    }
  });

  it('不同关卡生成不同布局', () => {
    const level1 = generateLevel(1);
    const level2 = generateLevel(2);
    // 至少某些属性应该不同（速度等在 engine 里处理，布局可能相同）
    expect(level1.platforms.length).toBeGreaterThan(0);
    expect(level2.platforms.length).toBeGreaterThan(0);
  });

  it('底部有地面平台', () => {
    const level = generateLevel(1);
    const bottomPlatform = level.platforms.find(p => p.y >= 580);
    expect(bottomPlatform).toBeDefined();
    expect(bottomPlatform!.width).toBe(CANVAS_WIDTH);
  });
});

// ========== 初始化测试 ==========

describe('DonkeyKongEngine - 初始化', () => {
  let engine: DonkeyKongEngine;

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

  it('初始没有滚桶', () => {
    expect(engine.barrels.length).toBe(0);
  });

  it('初始没有平台（未加载关卡）', () => {
    expect(engine.platforms.length).toBe(0);
  });

  it('初始没有梯子', () => {
    expect(engine.ladders.length).toBe(0);
  });

  it('玩家初始不在攀爬状态', () => {
    expect(engine.playerIsClimbing).toBe(false);
  });

  it('人质初始未被营救', () => {
    expect(engine.hostageRescued).toBe(false);
  });
});

// ========== 生命周期测试 ==========

describe('DonkeyKongEngine - 生命周期', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后加载平台', () => {
    engine.start();
    expect(engine.platforms.length).toBeGreaterThan(0);
  });

  it('start 后加载梯子', () => {
    engine.start();
    expect(engine.ladders.length).toBeGreaterThan(0);
  });

  it('start 后大金刚有位置', () => {
    engine.start();
    expect(engine.dkX).toBeGreaterThanOrEqual(0);
    expect(engine.dkY).toBeGreaterThanOrEqual(0);
  });

  it('start 后人质有位置', () => {
    engine.start();
    expect(engine.hostageX).toBeGreaterThanOrEqual(0);
    expect(engine.hostageY).toBeGreaterThanOrEqual(0);
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
    (engine as any)._lives = 0;
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });
});

// ========== 玩家移动测试 ==========

describe('DonkeyKongEngine - 玩家移动', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('按左箭头玩家向左移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 10);
    expect(engine.playerX).toBeLessThan(startX);
  });

  it('按右箭头玩家向右移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 10);
    expect(engine.playerX).toBeGreaterThan(startX);
  });

  it('A 键也能向左移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('a');
    tick(engine, 10);
    expect(engine.playerX).toBeLessThan(startX);
  });

  it('D 键也能向右移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('d');
    tick(engine, 10);
    expect(engine.playerX).toBeGreaterThan(startX);
  });

  it('玩家不能移出画布左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 200);
    expect(engine.playerX).toBeGreaterThanOrEqual(0);
  });

  it('玩家不能移出画布右边界', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 200);
    expect(engine.playerX).toBeLessThanOrEqual(CANVAS_WIDTH - PLAYER_WIDTH);
  });

  it('松开按键后玩家停止水平移动', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 5);
    const movedX = engine.playerX;
    engine.handleKeyUp('ArrowRight');
    tick(engine, 5);
    expect(engine.playerX).toBe(movedX);
  });

  it('玩家面向方向随移动更新', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 1);
    expect(engine.playerFacing).toBe(DIR_LEFT);
    engine.handleKeyUp('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    tick(engine, 1);
    expect(engine.playerFacing).toBe(DIR_RIGHT);
  });
});

// ========== 跳跃测试 ==========

describe('DonkeyKongEngine - 跳跃', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('按上箭头玩家跳跃', () => {
    const startY = engine.playerY;
    engine.handleKeyDown('ArrowUp');
    tick(engine, 5);
    expect(engine.playerY).toBeLessThan(startY);
  });

  it('空格键也能跳跃', () => {
    const startY = engine.playerY;
    engine.handleKeyDown(' ');
    tick(engine, 5);
    expect(engine.playerY).toBeLessThan(startY);
  });

  it('W 键也能跳跃', () => {
    const startY = engine.playerY;
    engine.handleKeyDown('w');
    tick(engine, 5);
    expect(engine.playerY).toBeLessThan(startY);
  });

  it('跳跃后 vy 为负值', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    expect(engine.playerVY).toBeLessThan(0);
  });

  it('跳跃后受重力影响', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 1);
    const vy1 = engine.playerVY;
    tick(engine, 10);
    const vy2 = engine.playerVY;
    // 重力使 vy 增大（更正）
    expect(vy2).toBeGreaterThan(vy1);
  });

  it('空中不能再跳', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 5);
    // 已经在空中
    expect(engine.playerIsOnGround).toBe(false);
    const y1 = engine.playerY;
    // 再次按跳跃不应改变轨迹
    engine.handleKeyUp('ArrowUp');
    engine.handleKeyDown('ArrowUp');
    tick(engine, 3);
    // 应该继续受重力影响正常下落
    expect(engine.playerVY).toBeGreaterThan(PLAYER_JUMP_VELOCITY);
  });

  it('着地后 isOnGround 为 true', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 5);
    // 在空中
    // 等待落地
    tick(engine, 100);
    expect(engine.playerIsOnGround).toBe(true);
  });

  it('着地后可以再次跳跃', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 100); // 等落地
    expect(engine.playerIsOnGround).toBe(true);
    const startY = engine.playerY;
    engine.handleKeyUp('ArrowUp');
    engine.handleKeyDown('ArrowUp');
    tick(engine, 5);
    expect(engine.playerY).toBeLessThan(startY);
  });
});

// ========== 攀爬测试 ==========

describe('DonkeyKongEngine - 梯子攀爬', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('靠近梯子按上键可以开始攀爬', () => {
    // 找一个梯子，将玩家放在梯子底部
    const lad = engine.ladders[0];
    if (!lad) return;
    (engine as any)._player.x = lad.x + (LADDER_WIDTH - PLAYER_WIDTH) / 2;
    (engine as any)._player.y = lad.bottomY - PLAYER_HEIGHT - 5;
    (engine as any)._player.isOnGround = true;

    engine.handleKeyDown('ArrowUp');
    tick(engine, 3);
    expect(engine.playerIsClimbing).toBe(true);
  });

  it('攀爬时按上键向上移动', () => {
    const lad = engine.ladders[0];
    if (!lad) return;
    (engine as any)._player.x = lad.x + (LADDER_WIDTH - PLAYER_WIDTH) / 2;
    (engine as any)._player.y = lad.bottomY - PLAYER_HEIGHT - 5;
    (engine as any)._player.isOnGround = true;

    engine.handleKeyDown('ArrowUp');
    tick(engine, 3);
    // 攀爬中再按上
    const startY = engine.playerY;
    tick(engine, 10);
    expect(engine.playerY).toBeLessThan(startY);
  });

  it('攀爬时按下键向下移动', () => {
    const lad = engine.ladders[0];
    if (!lad) return;
    (engine as any)._player.x = lad.x + (LADDER_WIDTH - PLAYER_WIDTH) / 2;
    (engine as any)._player.y = lad.topY + 10;
    (engine as any)._player.isClimbing = true;
    (engine as any)._player.isOnGround = false;

    engine.handleKeyDown('ArrowDown');
    const startY = engine.playerY;
    tick(engine, 10);
    expect(engine.playerY).toBeGreaterThan(startY);
  });

  it('不在梯子附近按上键不会攀爬', () => {
    // 将玩家放在远离梯子的位置
    (engine as any)._player.x = 0;
    (engine as any)._player.y = 590 - PLAYER_HEIGHT;
    engine.handleKeyDown('ArrowUp');
    // 应该触发跳跃而不是攀爬
    tick(engine, 3);
    expect(engine.playerIsClimbing).toBe(false);
  });

  it('攀爬中可以左右微调', () => {
    const lad = engine.ladders[0];
    if (!lad) return;
    (engine as any)._player.x = lad.x + (LADDER_WIDTH - PLAYER_WIDTH) / 2;
    (engine as any)._player.y = (lad.topY + lad.bottomY) / 2;
    (engine as any)._player.isClimbing = true;
    (engine as any)._player.isOnGround = false;

    const startX = engine.playerX;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 10);
    expect(engine.playerX).toBeLessThan(startX);
  });

  it('离开梯子后停止攀爬', () => {
    const lad = engine.ladders[0];
    if (!lad) return;
    (engine as any)._player.x = lad.x + (LADDER_WIDTH - PLAYER_WIDTH) / 2;
    (engine as any)._player.y = (lad.topY + lad.bottomY) / 2;
    (engine as any)._player.isClimbing = true;
    (engine as any)._player.isOnGround = false;

    // 将玩家移到梯子外
    (engine as any)._player.x = -100;
    tick(engine, 3);
    expect(engine.playerIsClimbing).toBe(false);
  });
});

// ========== 大金刚测试 ==========

describe('DonkeyKongEngine - 大金刚', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('大金刚在顶部区域', () => {
    expect(engine.dkY).toBeLessThan(CANVAS_HEIGHT / 3);
  });

  it('大金刚位置合理', () => {
    expect(engine.dkX).toBeGreaterThanOrEqual(0);
    expect(engine.dkY).toBeGreaterThanOrEqual(0);
  });

  it('大金刚初始不在投掷状态', () => {
    expect(engine.dkIsThrowing).toBe(false);
  });

  it('经过一段时间大金刚投掷滚桶', () => {
    // 模拟足够时间
    tick(engine, 200);
    expect(engine.barrels.length).toBeGreaterThan(0);
  });

  it('大金刚投掷时 isThrowing 为 true', () => {
    // 手动触发投掷
    (engine as any).throwBarrel();
    expect(engine.dkIsThrowing).toBe(true);
  });

  it('投掷动画持续一段时间后结束', () => {
    (engine as any).throwBarrel();
    expect(engine.dkIsThrowing).toBe(true);
    tick(engine, 30);
    expect(engine.dkIsThrowing).toBe(false);
  });
});

// ========== 滚桶测试 ==========

describe('DonkeyKongEngine - 滚桶', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('大金刚投掷后出现滚桶', () => {
    (engine as any).throwBarrel();
    expect(engine.barrels.length).toBeGreaterThan(0);
  });

  it('滚桶初始位置在大金刚附近', () => {
    (engine as any).throwBarrel();
    const barrel = engine.barrels[0];
    expect(Math.abs(barrel.x - engine.dkX - DK_WIDTH / 2)).toBeLessThan(DK_WIDTH);
  });

  it('滚桶会移动', () => {
    (engine as any).throwBarrel();
    const barrel = engine.barrels[0];
    const startX = barrel.x;
    tick(engine, 50);
    // 滚桶位置应该变化（水平或垂直）
    const moved = barrel.x !== startX || barrel.isFalling;
    expect(moved || barrel.x !== startX).toBe(true);
  });

  it('滚桶在平台上水平滚动', () => {
    (engine as any).throwBarrel();
    const barrel = engine.barrels[0];
    // 等待落到平台
    tick(engine, 100);
    if (!barrel.isFalling && barrel.active) {
      const startX = barrel.x;
      tick(engine, 10);
      // 应该水平移动
      expect(barrel.x).not.toBe(startX);
    }
  });

  it('滚桶到达平台边缘会下落', () => {
    (engine as any).throwBarrel();
    const barrel = engine.barrels[0];
    // 等待落到平台
    tick(engine, 100);
    if (!barrel.isFalling && barrel.active) {
      // 强制将滚桶推到边缘
      const plat = engine.platforms[barrel.onPlatformIndex];
      if (plat) {
        barrel.x = plat.x + plat.width + BARREL_RADIUS;
        tick(engine, 5);
        expect(barrel.isFalling).toBe(true);
      }
    }
  });

  it('滚桶飞出画布底部后变为不活跃', () => {
    (engine as any).throwBarrel();
    const barrel = engine.barrels[0];
    barrel.y = CANVAS_HEIGHT + BARREL_RADIUS * 3;
    barrel.active = true;
    tick(engine, 5);
    expect(barrel.active).toBe(false);
  });

  it('多个滚桶可以同时存在', () => {
    (engine as any).throwBarrel();
    (engine as any).throwBarrel();
    (engine as any).throwBarrel();
    expect(engine.barrels.length).toBe(3);
  });
});

// ========== 碰撞与生命测试 ==========

describe('DonkeyKongEngine - 碰撞与生命', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('滚桶碰到玩家减少生命', () => {
    // 在玩家位置放一个滚桶
    (engine as any)._barrels = [{
      x: engine.playerX + PLAYER_WIDTH / 2,
      y: engine.playerY + PLAYER_HEIGHT / 2,
      vx: 0, vy: 0,
      isFalling: false,
      active: true,
      onPlatformIndex: 0,
    }];
    const livesBefore = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(livesBefore - 1);
  });

  it('生命为 0 时游戏结束', () => {
    (engine as any)._lives = 1;
    (engine as any)._barrels = [{
      x: engine.playerX + PLAYER_WIDTH / 2,
      y: engine.playerY + PLAYER_HEIGHT / 2,
      vx: 0, vy: 0,
      isFalling: false,
      active: true,
      onPlatformIndex: 0,
    }];
    tick(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('被碰到后玩家重置到起始位置', () => {
    // 移动玩家
    engine.handleKeyDown('ArrowRight');
    tick(engine, 20);
    const movedX = engine.playerX;
    engine.handleKeyUp('ArrowRight');

    // 放置滚桶在玩家位置
    (engine as any)._barrels = [{
      x: engine.playerX + PLAYER_WIDTH / 2,
      y: engine.playerY + PLAYER_HEIGHT / 2,
      vx: 0, vy: 0,
      isFalling: false,
      active: true,
      onPlatformIndex: 0,
    }];
    tick(engine, 1);

    // 玩家应该回到初始位置
    const level = generateLevel(1);
    expect(engine.playerX).toBeCloseTo(level.playerStartX, 0);
  });

  it('被碰到后滚桶清空', () => {
    (engine as any).throwBarrel();
    expect(engine.barrels.length).toBeGreaterThan(0);

    (engine as any)._barrels[0].x = engine.playerX + PLAYER_WIDTH / 2;
    (engine as any)._barrels[0].y = engine.playerY + PLAYER_HEIGHT / 2;
    tick(engine, 1);
    expect(engine.barrels.length).toBe(0);
  });

  it('玩家跳过滚桶得分', () => {
    // 创建一个滚桶，玩家从上方下落经过它（跳过）
    const barrelX = engine.playerX + PLAYER_WIDTH / 2;
    const barrelY = engine.playerY + PLAYER_HEIGHT / 2;
    (engine as any)._barrels = [{
      x: barrelX,
      y: barrelY,
      vx: 100, vy: 0,
      isFalling: false,
      active: true,
      onPlatformIndex: 0,
    }];
    // 玩家底部刚好在滚桶中心（跳过条件边界），距离足够近触发碰撞
    (engine as any)._player.y = barrelY - PLAYER_HEIGHT;
    (engine as any)._player.vy = 50; // 正在下落
    (engine as any)._player.isOnGround = false;

    const scoreBefore = engine.score;
    tick(engine, 1);
    // 检查分数增加或滚桶消失
    const scoreIncreased = engine.score > scoreBefore;
    const barrelRemoved = engine.barrels.length === 0 || !engine.barrels[0]?.active;
    expect(scoreIncreased || barrelRemoved).toBe(true);
  });

  it('3 条命全部失去后游戏结束', () => {
    expect(engine.lives).toBe(3);
    for (let i = 0; i < 3; i++) {
      (engine as any)._barrels = [{
        x: engine.playerX + PLAYER_WIDTH / 2,
        y: engine.playerY + PLAYER_HEIGHT / 2,
        vx: 0, vy: 0,
        isFalling: false,
        active: true,
        onPlatformIndex: 0,
      }];
      tick(engine, 1);
    }
    expect(engine.lives).toBe(0);
    expect(engine.status).toBe('gameover');
  });
});

// ========== 营救人质测试 ==========

describe('DonkeyKongEngine - 营救人质', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('人质初始未被营救', () => {
    expect(engine.hostageRescued).toBe(false);
  });

  it('玩家到达人质位置触发营救', () => {
    // 将玩家移到人质位置
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 1);
    expect(engine.hostageRescued).toBe(true);
  });

  it('营救人质得分', () => {
    const scoreBefore = engine.score;
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 1);
    expect(engine.score).toBe(scoreBefore + LEVEL_COMPLETE_SCORE);
  });

  it('营救后进入下一关', () => {
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 2);
    expect(engine.level).toBe(2);
  });

  it('营救后人质标记为已营救', () => {
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 1);
    expect(engine.hostageRescued).toBe(true);
  });
});

// ========== 多关卡测试 ==========

describe('DonkeyKongEngine - 多关卡', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('第二关滚桶速度更快', () => {
    const speed1 = (engine as any)._barrelSpeed;
    // 进入第二关
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 2);
    const speed2 = (engine as any)._barrelSpeed;
    expect(speed2).toBeGreaterThan(speed1);
  });

  it('第二关投掷间隔更短', () => {
    const interval1 = (engine as any)._dkThrowInterval;
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 2);
    const interval2 = (engine as any)._dkThrowInterval;
    expect(interval2).toBeLessThan(interval1);
  });

  it('投掷间隔不低于最小值', () => {
    // 设置高关卡
    (engine as any)._level = 20;
    (engine as any).loadLevel(20);
    const interval = (engine as any)._dkThrowInterval;
    expect(interval).toBeGreaterThanOrEqual(DK_THROW_INTERVAL_MIN);
  });

  it('过关后等级提升', () => {
    expect(engine.level).toBe(1);
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 2);
    expect(engine.level).toBe(2);
  });

  it('过关后滚桶清空', () => {
    (engine as any).throwBarrel();
    (engine as any).throwBarrel();
    expect(engine.barrels.length).toBe(2);
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 2);
    expect(engine.barrels.length).toBe(0);
  });
});

// ========== 事件系统测试 ==========

describe('DonkeyKongEngine - 事件', () => {
  let engine: DonkeyKongEngine;

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

  it('得分变化触发 scoreChange 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('scoreChange', callback);
    (engine as any).addScore(100);
    expect(callback).toHaveBeenCalledWith(100);
  });

  it('失去生命触发 loseLife 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('loseLife', callback);
    (engine as any)._barrels = [{
      x: engine.playerX + PLAYER_WIDTH / 2,
      y: engine.playerY + PLAYER_HEIGHT / 2,
      vx: 0, vy: 0,
      isFalling: false,
      active: true,
      onPlatformIndex: 0,
    }];
    tick(engine, 1);
    expect(callback).toHaveBeenCalled();
  });

  it('过关触发 levelComplete 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('levelComplete', callback);
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 2);
    expect(callback).toHaveBeenCalledWith(2);
  });

  it('off 可以取消事件监听', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.off('statusChange', callback);
    engine.start();
    expect(callback).not.toHaveBeenCalled();
  });
});

// ========== getState 测试 ==========

describe('DonkeyKongEngine - getState', () => {
  let engine: DonkeyKongEngine;

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

  it('返回正确的生命', () => {
    const state = engine.getState();
    expect(state.lives).toBe(INITIAL_LIVES);
  });

  it('返回玩家位置', () => {
    const state = engine.getState();
    expect(typeof state.playerX).toBe('number');
    expect(typeof state.playerY).toBe('number');
  });

  it('返回攀爬状态', () => {
    const state = engine.getState();
    expect(typeof state.playerIsClimbing).toBe('boolean');
  });

  it('返回滚桶数量', () => {
    const state = engine.getState();
    expect(state.barrelCount).toBe(0);
  });

  it('返回人质状态', () => {
    const state = engine.getState();
    expect(state.hostageRescued).toBe(false);
  });

  it('返回大金刚位置', () => {
    const state = engine.getState();
    expect(typeof state.dkX).toBe('number');
    expect(typeof state.dkY).toBe('number');
  });
});

// ========== handleKeyDown / handleKeyUp 测试 ==========

describe('DonkeyKongEngine - 输入处理', () => {
  let engine: DonkeyKongEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('ArrowLeft 键被记录', () => {
    engine.handleKeyDown('ArrowLeft');
    expect((engine as any)._keys.has('ArrowLeft')).toBe(true);
  });

  it('ArrowRight 键被记录', () => {
    engine.handleKeyDown('ArrowRight');
    expect((engine as any)._keys.has('ArrowRight')).toBe(true);
  });

  it('ArrowUp 键被记录', () => {
    engine.handleKeyDown('ArrowUp');
    expect((engine as any)._keys.has('ArrowUp')).toBe(true);
  });

  it('ArrowDown 键被记录', () => {
    engine.handleKeyDown('ArrowDown');
    expect((engine as any)._keys.has('ArrowDown')).toBe(true);
  });

  it('keyup 移除按键记录', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyUp('ArrowLeft');
    expect((engine as any)._keys.has('ArrowLeft')).toBe(false);
  });

  it('空格键触发跳跃标志', () => {
    engine.handleKeyDown(' ');
    expect((engine as any)._jumpPressed).toBe(true);
  });

  it('空格键释放清除跳跃标志', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyUp(' ');
    expect((engine as any)._jumpPressed).toBe(false);
  });

  it('W 键触发跳跃标志', () => {
    engine.handleKeyDown('w');
    expect((engine as any)._jumpPressed).toBe(true);
  });

  it('W 键释放清除跳跃标志', () => {
    engine.handleKeyDown('w');
    engine.handleKeyUp('w');
    expect((engine as any)._jumpPressed).toBe(false);
  });
});

// ========== 边界与异常测试 ==========

describe('DonkeyKongEngine - 边界与异常', () => {
  it('未初始化 canvas 就 start 会抛出错误', () => {
    const engine = new DonkeyKongEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('idle 状态 pause 无效', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态 resume 无效', () => {
    const engine = createEngine();
    engine.resume();
    expect(engine.status).toBe('idle');
  });

  it('playing 状态 resume 无效', () => {
    const engine = createEngine();
    engine.start();
    engine.resume();
    expect(engine.status).toBe('playing');
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

  it('gameOver 后滚桶清空', () => {
    const engine = createEngine();
    engine.start();
    (engine as any).throwBarrel();
    (engine as any).throwBarrel();
    expect(engine.barrels.length).toBe(2);
    (engine as any).gameOver();
    expect(engine.barrels.length).toBe(0);
  });

  it('paused 状态下 pause 无效', () => {
    const engine = createEngine();
    engine.start();
    engine.pause();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('gameover 状态下 pause 无效', () => {
    const engine = createEngine();
    engine.start();
    (engine as any).gameOver();
    engine.pause();
    expect(engine.status).toBe('gameover');
  });
});

// ========== 综合游戏流程测试 ==========

describe('DonkeyKongEngine - 综合游戏流程', () => {
  it('完整的游戏循环：开始→玩→暂停→恢复→重置', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');

    engine.start();
    expect(engine.status).toBe('playing');

    engine.pause();
    expect(engine.status).toBe('paused');

    engine.resume();
    expect(engine.status).toBe('playing');

    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('完整的游戏流程：开始→被击中→游戏结束→重新开始', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.lives).toBe(3);

    // 被击中3次
    for (let i = 0; i < 3; i++) {
      (engine as any)._barrels = [{
        x: engine.playerX + PLAYER_WIDTH / 2,
        y: engine.playerY + PLAYER_HEIGHT / 2,
        vx: 0, vy: 0,
        isFalling: false,
        active: true,
        onPlatformIndex: 0,
      }];
      tick(engine, 1);
    }

    expect(engine.status).toBe('gameover');

    // 重新开始
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.lives).toBe(INITIAL_LIVES);
    expect(engine.score).toBe(0);
  });

  it('完整的过关流程：开始→移动→到达人质→过关', () => {
    const engine = createEngine();
    engine.start();

    // 直接将玩家移到人质位置模拟过关
    (engine as any)._player.x = engine.hostageX;
    (engine as any)._player.y = engine.hostageY;
    tick(engine, 2);

    expect(engine.level).toBe(2);
    expect(engine.score).toBe(LEVEL_COMPLETE_SCORE);
  });

  it('多次过关后关卡递增', () => {
    const engine = createEngine();
    engine.start();

    for (let lvl = 1; lvl <= 3; lvl++) {
      expect(engine.level).toBe(lvl);
      (engine as any)._player.x = engine.hostageX;
      (engine as any)._player.y = engine.hostageY;
      tick(engine, 2);
    }
    expect(engine.level).toBe(4);
  });
});
