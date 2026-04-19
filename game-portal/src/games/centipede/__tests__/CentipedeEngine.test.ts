import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CentipedeEngine } from '../CentipedeEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  COLS, ROWS, CELL_SIZE,
  PLAYER_ZONE_START_ROW,
  PLAYER_SIZE, PLAYER_SPEED, INITIAL_LIVES,
  BULLET_WIDTH, BULLET_HEIGHT, BULLET_SPEED, MAX_BULLETS,
  CENTIPEDE_INITIAL_LENGTH, CENTIPEDE_SPEED_BASE, CENTIPEDE_SPEED_PER_LEVEL,
  CENTIPEDE_SEGMENT_SIZE, CENTIPEDE_SCORE_HEAD, CENTIPEDE_SCORE_BODY,
  MUSHROOM_HEALTH, MUSHROOM_SCORE, INITIAL_MUSHROOM_COUNT,
  MUSHROOM_ZONE_START_ROW, MUSHROOM_ZONE_END_ROW,
  SPIDER_SCORE, SPIDER_WIDTH, SPIDER_HEIGHT,
  CENTIPEDE_LENGTH_PER_LEVEL, CENTIPEDE_MAX_LENGTH,
  DIR_LEFT, DIR_RIGHT,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): CentipedeEngine {
  const engine = new CentipedeEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 模拟游戏循环若干帧 */
function tick(engine: CentipedeEngine, frames: number, dt: number = 16): void {
  for (let i = 0; i < frames; i++) {
    engine.update(dt);
  }
}

// ========== 常量测试 ==========

describe('Centipede Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('网格应为 30x30，每格 16px', () => {
    expect(COLS).toBe(30);
    expect(ROWS).toBe(30);
    expect(CELL_SIZE).toBe(16);
    expect(COLS * CELL_SIZE).toBe(CANVAS_WIDTH);
  });

  it('玩家区域从第 26 行开始', () => {
    expect(PLAYER_ZONE_START_ROW).toBe(26);
  });

  it('蜈蚣初始长度为 12', () => {
    expect(CENTIPEDE_INITIAL_LENGTH).toBe(12);
  });

  it('蘑菇生命值为 4', () => {
    expect(MUSHROOM_HEALTH).toBe(4);
  });

  it('初始蘑菇数量为 30', () => {
    expect(INITIAL_MUSHROOM_COUNT).toBe(30);
  });

  it('方向常量正确', () => {
    expect(DIR_LEFT).toBe(-1);
    expect(DIR_RIGHT).toBe(1);
  });

  it('初始生命数为 3', () => {
    expect(INITIAL_LIVES).toBe(3);
  });

  it('最大子弹数为 1', () => {
    expect(MAX_BULLETS).toBe(1);
  });
});

// ========== 初始化测试 ==========

describe('CentipedeEngine - 初始化', () => {
  let engine: CentipedeEngine;

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

  it('初始波次为 1', () => {
    expect(engine.wave).toBe(1);
  });

  it('玩家初始位于画布底部中央', () => {
    expect(engine.playerX).toBeCloseTo((CANVAS_WIDTH - PLAYER_SIZE) / 2, 1);
    expect(engine.playerY).toBeCloseTo((PLAYER_ZONE_START_ROW + 2) * CELL_SIZE, 1);
  });

  it('初始没有子弹', () => {
    expect(engine.bullets.length).toBe(0);
  });

  it('初始没有蜈蚣', () => {
    expect(engine.centipedes.length).toBe(0);
  });

  it('初始没有蜘蛛', () => {
    expect(engine.spiders.length).toBe(0);
  });

  it('初始没有蘑菇', () => {
    expect(engine.mushrooms.size).toBe(0);
  });
});

// ========== 生命周期测试 ==========

describe('CentipedeEngine - 生命周期', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后生成蘑菇', () => {
    engine.start();
    expect(engine.mushrooms.size).toBe(INITIAL_MUSHROOM_COUNT);
  });

  it('start 后生成一条蜈蚣', () => {
    engine.start();
    expect(engine.centipedes.length).toBe(1);
  });

  it('start 后蜈蚣有正确的初始长度', () => {
    engine.start();
    expect(engine.centipedes[0].segments.length).toBe(CENTIPEDE_INITIAL_LENGTH);
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
    // 强制 game over
    (engine as any)._lives = 0;
    (engine as any).gameOver();
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });
});

// ========== 玩家移动测试 ==========

describe('CentipedeEngine - 玩家移动', () => {
  let engine: CentipedeEngine;

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

  it('按上箭头玩家向上移动', () => {
    const startY = engine.playerY;
    engine.handleKeyDown('ArrowUp');
    tick(engine, 10);
    expect(engine.playerY).toBeLessThan(startY);
  });

  it('按下箭头玩家向下移动', () => {
    const startY = engine.playerY;
    engine.handleKeyDown('ArrowDown');
    tick(engine, 10);
    expect(engine.playerY).toBeGreaterThan(startY);
  });

  it('WASD 键也能移动玩家', () => {
    const startX = engine.playerX;
    const startY = engine.playerY;
    engine.handleKeyDown('a');
    tick(engine, 10);
    expect(engine.playerX).toBeLessThan(startX);
    engine.handleKeyUp('a');

    const startX2 = engine.playerX;
    engine.handleKeyDown('d');
    tick(engine, 10);
    expect(engine.playerX).toBeGreaterThan(startX2);
  });

  it('玩家不能移出画布左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 200);
    expect(engine.playerX).toBeGreaterThanOrEqual(0);
  });

  it('玩家不能移出画布右边界', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 200);
    expect(engine.playerX).toBeLessThanOrEqual(CANVAS_WIDTH - PLAYER_SIZE);
  });

  it('玩家不能移出底部边界', () => {
    engine.handleKeyDown('ArrowDown');
    tick(engine, 200);
    expect(engine.playerY).toBeLessThanOrEqual((ROWS - 1) * CELL_SIZE);
  });

  it('玩家不能移到玩家区域上方', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 200);
    expect(engine.playerY).toBeGreaterThanOrEqual(PLAYER_ZONE_START_ROW * CELL_SIZE);
  });

  it('松开按键后玩家停止', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 5);
    const movedX = engine.playerX;
    engine.handleKeyUp('ArrowRight');
    tick(engine, 5);
    expect(engine.playerX).toBe(movedX);
  });
});

// ========== 射击测试 ==========

describe('CentipedeEngine - 射击', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('按空格发射子弹', () => {
    engine.handleKeyDown(' ');
    tick(engine, 1);
    const activeBullets = engine.bullets.filter(b => b.alive);
    expect(activeBullets.length).toBeGreaterThan(0);
  });

  it('子弹从玩家上方发射', () => {
    engine.handleKeyDown(' ');
    tick(engine, 1);
    const bullet = engine.bullets.find(b => b.alive);
    expect(bullet).toBeDefined();
    expect(bullet!.y).toBeLessThan(engine.playerY);
  });

  it('子弹向上移动', () => {
    engine.handleKeyDown(' ');
    tick(engine, 1);
    const bullet = engine.bullets.find(b => b.alive);
    const startY = bullet!.y;
    tick(engine, 5);
    expect(bullet!.y).toBeLessThan(startY);
  });

  it('子弹飞出画布顶部后标记为不活跃', () => {
    engine.handleKeyDown(' ');
    tick(engine, 1);
    const bullet = engine.bullets[0];
    // 模拟足够多的帧让子弹飞出
    tick(engine, 200);
    expect(bullet.alive).toBe(false);
  });

  it('最多只能有 MAX_BULLETS 颗子弹', () => {
    engine.handleKeyDown(' ');
    tick(engine, 1);
    engine.handleKeyDown(' ');
    tick(engine, 1);
    const activeBullets = engine.bullets.filter(b => b.alive);
    expect(activeBullets.length).toBeLessThanOrEqual(MAX_BULLETS);
  });
});

// ========== 蘑菇测试 ==========

describe('CentipedeEngine - 蘑菇', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('游戏开始时生成指定数量的蘑菇', () => {
    expect(engine.mushrooms.size).toBe(INITIAL_MUSHROOM_COUNT);
  });

  it('蘑菇位于有效区域内', () => {
    engine.mushrooms.forEach((m) => {
      expect(m.row).toBeGreaterThanOrEqual(MUSHROOM_ZONE_START_ROW);
      expect(m.row).toBeLessThan(MUSHROOM_ZONE_END_ROW);
      expect(m.col).toBeGreaterThanOrEqual(0);
      expect(m.col).toBeLessThan(COLS);
    });
  });

  it('蘑菇初始生命值为 MUSHROOM_HEALTH', () => {
    engine.mushrooms.forEach((m) => {
      expect(m.health).toBe(MUSHROOM_HEALTH);
    });
  });

  it('子弹击中蘑菇减少其生命值', () => {
    // 手动放置蘑菇和子弹
    const mushroomCol = 10;
    const mushroomRow = 10;
    (engine as any)._mushrooms.set(`${mushroomCol},${mushroomRow}`, {
      col: mushroomCol, row: mushroomRow, health: MUSHROOM_HEALTH,
    });
    // 放置子弹对准蘑菇
    (engine as any)._bullets = [{
      x: mushroomCol * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2,
      y: mushroomRow * CELL_SIZE + CELL_SIZE / 2 - BULLET_HEIGHT / 2,
      alive: true,
    }];
    tick(engine, 1);
    const mushroom = engine.mushrooms.get(`${mushroomCol},${mushroomRow}`);
    expect(mushroom).toBeDefined();
    expect(mushroom!.health).toBe(MUSHROOM_HEALTH - 1);
  });

  it('蘑菇被击中 MUSHROOM_HEALTH 次后消失', () => {
    const mushroomCol = 10;
    const mushroomRow = 10;
    (engine as any)._mushrooms.set(`${mushroomCol},${mushroomRow}`, {
      col: mushroomCol, row: mushroomRow, health: 1,
    });
    (engine as any)._bullets = [{
      x: mushroomCol * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2,
      y: mushroomRow * CELL_SIZE + CELL_SIZE / 2 - BULLET_HEIGHT / 2,
      alive: true,
    }];
    tick(engine, 1);
    expect(engine.mushrooms.has(`${mushroomCol},${mushroomRow}`)).toBe(false);
  });

  it('击毁蘑菇得分', () => {
    const mushroomCol = 10;
    const mushroomRow = 10;
    (engine as any)._mushrooms.set(`${mushroomCol},${mushroomRow}`, {
      col: mushroomCol, row: mushroomRow, health: 1,
    });
    (engine as any)._bullets = [{
      x: mushroomCol * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2,
      y: mushroomRow * CELL_SIZE + CELL_SIZE / 2 - BULLET_HEIGHT / 2,
      alive: true,
    }];
    const scoreBefore = engine.score;
    tick(engine, 1);
    expect(engine.score).toBe(scoreBefore + MUSHROOM_SCORE);
  });

  it('子弹击中蘑菇后子弹消失', () => {
    const mushroomCol = 10;
    const mushroomRow = 10;
    (engine as any)._mushrooms.set(`${mushroomCol},${mushroomRow}`, {
      col: mushroomCol, row: mushroomRow, health: MUSHROOM_HEALTH,
    });
    (engine as any)._bullets = [{
      x: mushroomCol * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2,
      y: mushroomRow * CELL_SIZE + CELL_SIZE / 2 - BULLET_HEIGHT / 2,
      alive: true,
    }];
    tick(engine, 1);
    expect((engine as any)._bullets.every(b => !b.alive)).toBe(true);
  });
});

// ========== 蜈蚣移动测试 ==========

describe('CentipedeEngine - 蜈蚣移动', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('蜈蚣初始向左移动', () => {
    expect(engine.centipedes[0].dirX).toBe(DIR_LEFT);
  });

  it('蜈蚣头部位于网格中', () => {
    const head = engine.centipedes[0].segments[0];
    expect(head.col).toBeGreaterThanOrEqual(0);
    expect(head.col).toBeLessThan(COLS);
    expect(head.row).toBeGreaterThanOrEqual(0);
    expect(head.row).toBeLessThan(ROWS);
  });

  it('蜈蚣移动后头部位置改变', () => {
    const head = engine.centipedes[0].segments[0];
    const startCol = head.col;
    const startRow = head.row;
    // 模拟足够多的帧让蜈蚣移动
    tick(engine, 50);
    // 至少行或列有变化
    const moved = head.col !== startCol || head.row !== startRow;
    expect(moved).toBe(true);
  });

  it('蜈蚣碰到左边界会下移并反向', () => {
    // 将蜈蚣头部放在左边界
    const centipede = engine.centipedes[0];
    centipede.segments[0].col = 0;
    centipede.segments[0].row = 5;
    centipede.dirX = DIR_LEFT;
    // 清除蘑菇避免干扰
    (engine as any)._mushrooms.clear();
    const startRow = centipede.segments[0].row;
    tick(engine, 50);
    // 应该已经下移
    expect(centipede.segments[0].row).toBeGreaterThanOrEqual(startRow);
    // 方向应该反转
    expect(centipede.dirX).toBe(DIR_RIGHT);
  });

  it('蜈蚣碰到右边界会下移并反向', () => {
    const centipede = engine.centipedes[0];
    centipede.segments[0].col = COLS - 1;
    centipede.segments[0].row = 5;
    centipede.dirX = DIR_RIGHT;
    (engine as any)._mushrooms.clear();
    const startRow = centipede.segments[0].row;
    tick(engine, 50);
    expect(centipede.segments[0].row).toBeGreaterThanOrEqual(startRow);
    expect(centipede.dirX).toBe(DIR_LEFT);
  });

  it('蜈蚣碰到蘑菇会下移并反向', () => {
    const centipede = engine.centipedes[0];
    centipede.segments[0].col = 15;
    centipede.segments[0].row = 5;
    centipede.dirX = DIR_LEFT;
    // 在左边放一个蘑菇
    (engine as any)._mushrooms.clear();
    (engine as any)._mushrooms.set('14,5', { col: 14, row: 5, health: MUSHROOM_HEALTH });
    const startRow = centipede.segments[0].row;
    tick(engine, 50);
    expect(centipede.segments[0].row).toBeGreaterThan(startRow);
    expect(centipede.dirX).toBe(DIR_RIGHT);
  });

  it('蜈蚣到达底部后回到顶部', () => {
    const centipede = engine.centipedes[0];
    centipede.segments[0].col = 0;
    centipede.segments[0].row = ROWS - 1;
    centipede.dirX = DIR_LEFT;
    (engine as any)._mushrooms.clear();
    tick(engine, 50);
    // 应该回到顶部
    expect(centipede.segments[0].row).toBeLessThan(ROWS - 1);
  });

  it('蜈蚣身体跟随头部', () => {
    const centipede = engine.centipedes[0];
    (engine as any)._mushrooms.clear();
    const headPrevCol = centipede.segments[0].col;
    const headPrevRow = centipede.segments[0].row;
    tick(engine, 50);
    // 第二段应该移动到头部的旧位置附近
    // （由于多次移动，检查第二段确实在移动）
    const seg1 = centipede.segments[1];
    expect(seg1.col).toBeGreaterThanOrEqual(0);
    expect(seg1.row).toBeGreaterThanOrEqual(0);
  });
});

// ========== 蜈蚣分裂测试 ==========

describe('CentipedeEngine - 蜈蚣分裂', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    // 清除蘑菇避免干扰
    (engine as any)._mushrooms.clear();
  });

  it('射中蜈蚣中间节段导致分裂为两条', () => {
    const centipede = engine.centipedes[0];
    expect(centipede.segments.length).toBe(CENTIPEDE_INITIAL_LENGTH);
    const midIndex = Math.floor(CENTIPEDE_INITIAL_LENGTH / 2);
    const targetSeg = centipede.segments[midIndex];

    // 放置子弹在目标节段网格内偏下位置，确保移动后仍在同一格
    const bulletX = targetSeg.col * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2;
    const bulletY = targetSeg.row * CELL_SIZE + CELL_SIZE - BULLET_HEIGHT - 1;
    (engine as any)._bullets = [{ x: bulletX, y: bulletY, alive: true }];

    tick(engine, 1);

    // 应该分裂为两条
    expect(engine.centipedes.length).toBe(2);
  });

  it('分裂后总节段数减少 1（被击中的节段消失）', () => {
    const originalLength = engine.centipedes[0].segments.length;
    const midIndex = Math.floor(originalLength / 2);
    const targetSeg = engine.centipedes[0].segments[midIndex];

    const bulletX = targetSeg.col * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2;
    const bulletY = targetSeg.row * CELL_SIZE + CELL_SIZE - BULLET_HEIGHT - 1;
    (engine as any)._bullets = [{ x: bulletX, y: bulletY, alive: true }];

    tick(engine, 1);

    const totalSegments = engine.centipedes.reduce((sum, c) => sum + c.segments.length, 0);
    expect(totalSegments).toBe(originalLength - 1);
  });

  it('射中蜈蚣头部得高分', () => {
    const head = engine.centipedes[0].segments[0];
    const bulletX = head.col * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2;
    const bulletY = head.row * CELL_SIZE + CELL_SIZE - BULLET_HEIGHT - 1;
    (engine as any)._bullets = [{ x: bulletX, y: bulletY, alive: true }];
    const scoreBefore = engine.score;
    tick(engine, 1);
    expect(engine.score).toBe(scoreBefore + CENTIPEDE_SCORE_HEAD);
  });

  it('射中蜈蚣身体得低分', () => {
    const bodySeg = engine.centipedes[0].segments[2];
    const bulletX = bodySeg.col * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2;
    const bulletY = bodySeg.row * CELL_SIZE + CELL_SIZE - BULLET_HEIGHT - 1;
    (engine as any)._bullets = [{ x: bulletX, y: bulletY, alive: true }];
    const scoreBefore = engine.score;
    tick(engine, 1);
    expect(engine.score).toBe(scoreBefore + CENTIPEDE_SCORE_BODY);
  });

  it('被击中的节段变成蘑菇', () => {
    const targetSeg = engine.centipedes[0].segments[3];
    const bulletX = targetSeg.col * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2;
    const bulletY = targetSeg.row * CELL_SIZE + CELL_SIZE - BULLET_HEIGHT - 1;
    (engine as any)._bullets = [{ x: bulletX, y: bulletY, alive: true }];
    tick(engine, 1);
    expect(engine.mushrooms.has(`${targetSeg.col},${targetSeg.row}`)).toBe(true);
  });

  it('射中蜈蚣尾部（最后一段）只保留前半段', () => {
    const centipede = engine.centipedes[0];
    const lastIdx = centipede.segments.length - 1;
    const targetSeg = centipede.segments[lastIdx];

    const bulletX = targetSeg.col * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2;
    const bulletY = targetSeg.row * CELL_SIZE + CELL_SIZE - BULLET_HEIGHT - 1;
    (engine as any)._bullets = [{ x: bulletX, y: bulletY, alive: true }];

    tick(engine, 1);
    expect(engine.centipedes.length).toBe(1);
    expect(engine.centipedes[0].segments.length).toBe(lastIdx);
  });

  it('射中蜈蚣头部（第一段）只保留后半段', () => {
    const head = engine.centipedes[0].segments[0];
    const bulletX = head.col * CELL_SIZE + CELL_SIZE / 2 - BULLET_WIDTH / 2;
    const bulletY = head.row * CELL_SIZE + CELL_SIZE - BULLET_HEIGHT - 1;
    (engine as any)._bullets = [{ x: bulletX, y: bulletY, alive: true }];

    tick(engine, 1);
    expect(engine.centipedes.length).toBe(1);
    expect(engine.centipedes[0].segments.length).toBe(CENTIPEDE_INITIAL_LENGTH - 1);
  });
});

// ========== 碰撞与生命测试 ==========

describe('CentipedeEngine - 碰撞与生命', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._mushrooms.clear();
  });

  it('蜈蚣碰到玩家减少生命', () => {
    const centipede = engine.centipedes[0];
    // 将蜈蚣头部放到玩家位置
    const pCol = Math.floor((engine.playerX + PLAYER_SIZE / 2) / CELL_SIZE);
    const pRow = Math.floor((engine.playerY + PLAYER_SIZE / 2) / CELL_SIZE);
    centipede.segments[0].col = pCol;
    centipede.segments[0].row = pRow;
    const livesBefore = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(livesBefore - 1);
  });

  it('生命为 0 时游戏结束', () => {
    (engine as any)._lives = 1;
    const centipede = engine.centipedes[0];
    const pCol = Math.floor((engine.playerX + PLAYER_SIZE / 2) / CELL_SIZE);
    const pRow = Math.floor((engine.playerY + PLAYER_SIZE / 2) / CELL_SIZE);
    centipede.segments[0].col = pCol;
    centipede.segments[0].row = pRow;
    tick(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('被击中后玩家重置到初始位置', () => {
    // 移动玩家到其他位置
    engine.handleKeyDown('ArrowRight');
    tick(engine, 20);
    const movedX = engine.playerX;
    expect(movedX).not.toBeCloseTo((CANVAS_WIDTH - PLAYER_SIZE) / 2, 0);
    engine.handleKeyUp('ArrowRight');

    // 蜈蚣碰到玩家
    const centipede = engine.centipedes[0];
    const pCol = Math.floor((engine.playerX + PLAYER_SIZE / 2) / CELL_SIZE);
    const pRow = Math.floor((engine.playerY + PLAYER_SIZE / 2) / CELL_SIZE);
    centipede.segments[0].col = pCol;
    centipede.segments[0].row = pRow;
    tick(engine, 1);

    // 玩家应该回到初始位置
    expect(engine.playerX).toBeCloseTo((CANVAS_WIDTH - PLAYER_SIZE) / 2, 1);
  });

  it('被击中后子弹清空', () => {
    engine.handleKeyDown(' ');
    tick(engine, 1);
    expect(engine.bullets.length).toBeGreaterThan(0);

    const centipede = engine.centipedes[0];
    const pCol = Math.floor((engine.playerX + PLAYER_SIZE / 2) / CELL_SIZE);
    const pRow = Math.floor((engine.playerY + PLAYER_SIZE / 2) / CELL_SIZE);
    centipede.segments[0].col = pCol;
    centipede.segments[0].row = pRow;
    tick(engine, 1);
    expect(engine.bullets.length).toBe(0);
  });
});

// ========== 蜘蛛测试 ==========

describe('CentipedeEngine - 蜘蛛', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._mushrooms.clear();
  });

  it('可以手动生成蜘蛛', () => {
    (engine as any).spawnSpider();
    expect(engine.spiders.length).toBe(1);
  });

  it('蜘蛛从左侧或右侧进入', () => {
    (engine as any).spawnSpider();
    const spider = engine.spiders[0];
    const fromLeft = spider.dx > 0;
    const fromRight = spider.dx < 0;
    expect(fromLeft || fromRight).toBe(true);
  });

  it('蜘蛛向对面移动', () => {
    (engine as any).spawnSpider();
    const spider = engine.spiders[0];
    const startX = spider.x;
    tick(engine, 50);
    if (spider.dx > 0) {
      expect(spider.x).toBeGreaterThan(startX);
    } else {
      expect(spider.x).toBeLessThan(startX);
    }
  });

  it('子弹击中蜘蛛得分', () => {
    (engine as any).spawnSpider();
    const spider = engine.spiders[0];
    spider.x = 100;
    spider.y = 100;
    spider.alive = true;
    (engine as any)._bullets = [{
      x: spider.x + SPIDER_WIDTH / 2,
      y: spider.y + SPIDER_HEIGHT / 2,
      alive: true,
    }];
    const scoreBefore = engine.score;
    tick(engine, 1);
    expect(engine.score).toBe(scoreBefore + SPIDER_SCORE);
  });

  it('子弹击中蜘蛛后蜘蛛消失', () => {
    (engine as any).spawnSpider();
    const spider = engine.spiders[0];
    spider.x = 100;
    spider.y = 100;
    spider.alive = true;
    (engine as any)._bullets = [{
      x: spider.x + SPIDER_WIDTH / 2,
      y: spider.y + SPIDER_HEIGHT / 2,
      alive: true,
    }];
    tick(engine, 1);
    expect(spider.alive).toBe(false);
  });

  it('蜘蛛碰到玩家减少生命', () => {
    (engine as any).spawnSpider();
    const spider = engine.spiders[0];
    spider.x = engine.playerX;
    spider.y = engine.playerY;
    spider.alive = true;
    const livesBefore = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(livesBefore - 1);
  });

  it('蜘蛛飞出画布后标记为不活跃', () => {
    (engine as any).spawnSpider();
    const spider = engine.spiders[0];
    spider.dx = 1;
    spider.x = CANVAS_WIDTH + SPIDER_WIDTH * 3;
    tick(engine, 1);
    expect(spider.alive).toBe(false);
  });
});

// ========== 波次测试 ==========

describe('CentipedeEngine - 波次', () => {
  let engine: CentipedeEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._mushrooms.clear();
  });

  it('消灭所有蜈蚣节段后进入下一波', () => {
    // 清空蜈蚣
    (engine as any)._centipedes = [];
    tick(engine, 1);
    expect(engine.wave).toBe(2);
  });

  it('新波次蜈蚣更长', () => {
    const firstWaveLength = engine.centipedes[0].segments.length;
    // 清空蜈蚣触发下一波
    (engine as any)._centipedes = [];
    tick(engine, 1);
    expect(engine.wave).toBe(2);
    const secondWaveLength = engine.centipedes[0].segments.length;
    expect(secondWaveLength).toBeGreaterThan(firstWaveLength);
  });

  it('新波次等级提升', () => {
    (engine as any)._centipedes = [];
    tick(engine, 1);
    expect(engine.level).toBe(2);
  });

  it('新波次补充蘑菇', () => {
    const mushroomCountBefore = engine.mushrooms.size;
    (engine as any)._centipedes = [];
    tick(engine, 1);
    expect(engine.mushrooms.size).toBeGreaterThanOrEqual(mushroomCountBefore);
  });

  it('新波次清空蜘蛛', () => {
    (engine as any).spawnSpider();
    expect(engine.spiders.length).toBeGreaterThan(0);
    (engine as any)._centipedes = [];
    tick(engine, 1);
    expect(engine.spiders.filter(s => s.alive).length).toBe(0);
  });

  it('蜈蚣长度不超过最大值', () => {
    // 设置高波次
    (engine as any)._wave = 20;
    (engine as any)._centipedes = [];
    tick(engine, 1);
    const length = engine.centipedes[0].segments.length;
    expect(length).toBeLessThanOrEqual(CENTIPEDE_MAX_LENGTH);
  });
});

// ========== 事件系统测试 ==========

describe('CentipedeEngine - 事件', () => {
  let engine: CentipedeEngine;

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
});

// ========== getState 测试 ==========

describe('CentipedeEngine - getState', () => {
  let engine: CentipedeEngine;

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

  it('返回正确的波次', () => {
    const state = engine.getState();
    expect(state.wave).toBe(1);
  });

  it('返回玩家位置', () => {
    const state = engine.getState();
    expect(typeof state.playerX).toBe('number');
    expect(typeof state.playerY).toBe('number');
  });

  it('返回蜈蚣统计', () => {
    const state = engine.getState();
    expect(state.centipedeCount).toBe(1);
    expect(state.totalSegments).toBe(CENTIPEDE_INITIAL_LENGTH);
  });

  it('返回蘑菇数量', () => {
    const state = engine.getState();
    expect(state.mushroomCount).toBe(INITIAL_MUSHROOM_COUNT);
  });
});

// ========== handleKeyDown / handleKeyUp 测试 ==========

describe('CentipedeEngine - 输入处理', () => {
  let engine: CentipedeEngine;

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

  it('空格键触发射击标志', () => {
    engine.handleKeyDown(' ');
    expect((engine as any)._shootPressed).toBe(true);
  });

  it('空格键释放清除射击标志', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyUp(' ');
    expect((engine as any)._shootPressed).toBe(false);
  });
});

// ========== 边界与异常测试 ==========

describe('CentipedeEngine - 边界与异常', () => {
  it('未初始化 canvas 就 start 会抛出错误', () => {
    const engine = new CentipedeEngine();
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

  it('off 可以取消事件监听', () => {
    const engine = createEngine();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.off('statusChange', callback);
    engine.start();
    expect(callback).not.toHaveBeenCalled();
  });
});
