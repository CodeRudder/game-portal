import { vi } from 'vitest';
import { DigDugEngine } from '../DigDugEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  COLS, ROWS, CELL_SIZE,
  PLAYER_SPEED, INITIAL_LIVES,
  PUMP_RANGE, INFLATE_TO_POP,
  MONSTER_SPEED, MONSTER_SPEED_PER_LEVEL,
  POOKA_SCORE_SHALLOW, POOKA_SCORE_MEDIUM, POOKA_SCORE_DEEP, POOKA_SCORE_VERY_DEEP,
  FYGAR_SCORE_SHALLOW, FYGAR_SCORE_MEDIUM, FYGAR_SCORE_DEEP, FYGAR_SCORE_VERY_DEEP,
  FYGAR_FIRE_RANGE, FYGAR_FIRE_DURATION, FYGAR_FIRE_COOLDOWN,
  ROCK_FALL_DELAY, ROCK_FALL_SPEED, ROCK_SCORE,
  POOKA_BASE_COUNT, FYGAR_BASE_COUNT,
  DEPTH_SHALLOW_END, DEPTH_MEDIUM_END, DEPTH_DEEP_END,
  DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT,
  BG_COLOR, DIRT_COLORS, TUNNEL_COLOR, ROCK_COLOR,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): DigDugEngine {
  const engine = new DigDugEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 模拟游戏循环若干帧 */
function tick(engine: DigDugEngine, frames: number, dt: number = 16): void {
  for (let i = 0; i < frames; i++) {
    engine.update(dt);
  }
}

// ========== 常量测试 ==========

describe('Dig Dug Constants', () => {
  it('画布尺寸应为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('网格应为 15x20，每格 32px', () => {
    expect(COLS).toBe(15);
    expect(ROWS).toBe(20);
    expect(CELL_SIZE).toBe(32);
    expect(COLS * CELL_SIZE).toBe(CANVAS_WIDTH);
  });

  it('初始生命数为 3', () => {
    expect(INITIAL_LIVES).toBe(3);
  });

  it('充气泵射程为 4 格', () => {
    expect(PUMP_RANGE).toBe(4);
  });

  it('膨胀到 4 级爆炸', () => {
    expect(INFLATE_TO_POP).toBe(4);
  });

  it('怪物基础速度为 2 格/秒', () => {
    expect(MONSTER_SPEED).toBe(2);
  });

  it('Pooka 浅层得分为 200', () => {
    expect(POOKA_SCORE_SHALLOW).toBe(200);
  });

  it('Fygar 浅层得分为 300', () => {
    expect(FYGAR_SCORE_SHALLOW).toBe(300);
  });

  it('岩石砸死怪物得分为 1000', () => {
    expect(ROCK_SCORE).toBe(1000);
  });

  it('Fygar 火焰射程为 3 格', () => {
    expect(FYGAR_FIRE_RANGE).toBe(3);
  });

  it('深度区域划分正确', () => {
    expect(DEPTH_SHALLOW_END).toBe(5);
    expect(DEPTH_MEDIUM_END).toBe(10);
    expect(DEPTH_DEEP_END).toBe(15);
  });

  it('方向常量正确', () => {
    expect(DIR_UP).toBe('up');
    expect(DIR_DOWN).toBe('down');
    expect(DIR_LEFT).toBe('left');
    expect(DIR_RIGHT).toBe('right');
  });

  it('初始 Pooka 数量为 2', () => {
    expect(POOKA_BASE_COUNT).toBe(2);
  });

  it('初始 Fygar 数量为 1', () => {
    expect(FYGAR_BASE_COUNT).toBe(1);
  });

  it('泥土颜色数组有 5 层', () => {
    expect(DIRT_COLORS.length).toBe(5);
  });
});

// ========== 初始化测试 ==========

describe('DigDugEngine - 初始化', () => {
  let engine: DigDugEngine;

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

  it('玩家初始位于顶部中央', () => {
    expect(engine.playerCol).toBe(Math.floor(COLS / 2));
    expect(engine.playerRow).toBe(0);
  });

  it('初始方向为右', () => {
    expect(engine.playerDir).toBe(DIR_RIGHT);
  });

  it('初始没有怪物', () => {
    expect(engine.monsters.length).toBe(0);
  });

  it('初始没有岩石', () => {
    expect(engine.rocks.length).toBe(0);
  });

  it('初始没有火焰', () => {
    expect(engine.fires.length).toBe(0);
  });

  it('充气泵初始未激活', () => {
    expect(engine.pump.active).toBe(false);
  });

  it('顶部行初始为隧道', () => {
    for (let c = 0; c < COLS; c++) {
      expect(engine.getCell(c, 0)).toBe('tunnel');
    }
  });

  it('非顶部行初始为泥土', () => {
    for (let r = 1; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        expect(engine.getCell(c, r)).toBe('dirt');
      }
    }
  });
});

// ========== 生命周期测试 ==========

describe('DigDugEngine - 生命周期', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后状态变为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后生成怪物', () => {
    engine.start();
    expect(engine.monsters.length).toBeGreaterThan(0);
  });

  it('start 后生成岩石', () => {
    engine.start();
    expect(engine.rocks.length).toBeGreaterThan(0);
  });

  it('start 后生成正确数量的怪物（2 Pooka + 1 Fygar）', () => {
    engine.start();
    const pookas = engine.monsters.filter(m => m.type === 'pooka');
    const fygars = engine.monsters.filter(m => m.type === 'fygar');
    expect(pookas.length).toBe(POOKA_BASE_COUNT);
    expect(fygars.length).toBe(FYGAR_BASE_COUNT);
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

describe('DigDugEngine - 玩家移动', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('按左箭头玩家向左移动', () => {
    const startCol = engine.playerCol;
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 30);
    expect(engine.playerCol).toBeLessThan(startCol);
  });

  it('按右箭头玩家向右移动', () => {
    const startCol = engine.playerCol;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 30);
    expect(engine.playerCol).toBeGreaterThan(startCol);
  });

  it('按下箭头玩家向下移动（挖掘）', () => {
    const startRow = engine.playerRow;
    engine.handleKeyDown('ArrowDown');
    tick(engine, 30);
    expect(engine.playerRow).toBeGreaterThan(startRow);
  });

  it('按上箭头玩家向上移动', () => {
    // 先向下挖
    engine.handleKeyDown('ArrowDown');
    tick(engine, 30);
    const rowAfterDown = engine.playerRow;
    engine.handleKeyUp('ArrowDown');
    // 再向上
    engine.handleKeyDown('ArrowUp');
    tick(engine, 30);
    expect(engine.playerRow).toBeLessThan(rowAfterDown);
  });

  it('WASD 键也能移动玩家', () => {
    const startCol = engine.playerCol;
    engine.handleKeyDown('a');
    tick(engine, 30);
    expect(engine.playerCol).toBeLessThan(startCol);
    engine.handleKeyUp('a');
  });

  it('玩家不能移出左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 200);
    expect(engine.playerCol).toBeGreaterThanOrEqual(0);
  });

  it('玩家不能移出右边界', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 200);
    expect(engine.playerCol).toBeLessThan(COLS);
  });

  it('玩家不能移出上边界', () => {
    engine.handleKeyDown('ArrowUp');
    tick(engine, 200);
    expect(engine.playerRow).toBeGreaterThanOrEqual(0);
  });

  it('玩家不能移出下边界', () => {
    engine.handleKeyDown('ArrowDown');
    tick(engine, 200);
    expect(engine.playerRow).toBeLessThan(ROWS);
  });

  it('玩家移动时自动挖掘隧道', () => {
    engine.handleKeyDown('ArrowDown');
    tick(engine, 30);
    const row = engine.playerRow;
    expect(engine.getCell(engine.playerCol, row)).toBe('tunnel');
  });

  it('松开按键后玩家停止', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 10);
    const col = engine.playerCol;
    engine.handleKeyUp('ArrowRight');
    tick(engine, 10);
    expect(engine.playerCol).toBe(col);
  });

  it('玩家方向随输入改变', () => {
    engine.handleKeyDown('ArrowDown');
    tick(engine, 10);
    expect(engine.playerDir).toBe(DIR_DOWN);
    engine.handleKeyUp('ArrowDown');
    engine.handleKeyDown('ArrowLeft');
    tick(engine, 10);
    expect(engine.playerDir).toBe(DIR_LEFT);
  });

  it('玩家不能穿过岩石', () => {
    // 手动放置岩石在玩家右边
    (engine as any)._rocks = [{
      col: engine.playerCol + 1,
      row: engine.playerRow,
      falling: false, fallTimer: 0, waitingToFall: false,
      fallY: engine.playerRow * CELL_SIZE, settled: false, destroyed: false,
    }];
    const startCol = engine.playerCol;
    engine.handleKeyDown('ArrowRight');
    tick(engine, 30);
    expect(engine.playerCol).toBe(startCol);
  });
});

// ========== 充气泵测试 ==========

describe('DigDugEngine - 充气泵', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    // 清除怪物避免干扰
    (engine as any)._monsters = [];
    (engine as any)._monstersSpawned = 0;
  });

  it('按空格激活充气泵', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 5);
    engine.handleKeyUp('ArrowRight');
    engine.handleKeyDown(' ');
    tick(engine, 1);
    expect(engine.pump.active).toBe(true);
  });

  it('充气泵朝玩家面向方向发射', () => {
    engine.handleKeyDown('ArrowRight');
    tick(engine, 5);
    engine.handleKeyUp('ArrowRight');
    engine.handleKeyDown(' ');
    tick(engine, 1);
    expect(engine.pump.dir).toBe(DIR_RIGHT);
  });

  it('DEBUG: pump activation works', () => {
    // Directly test pump activation
    expect(engine.pump.active).toBe(false);
    expect((engine as any)._pumpPressed).toBe(false);

    engine.handleKeyDown(' ');
    expect((engine as any)._pumpPressed).toBe(true);
    expect((engine as any)._pumpJustPressed).toBe(true);

    // Now call update directly
    (engine as any).update(16);
    expect(engine.pump.active).toBe(true);
    expect(engine.pump.extending).toBe(true);
  });

  it('充气泵碰到泥土收回', () => {
    // 玩家在第0行，面向下（第1行是泥土）
    (engine as any)._player.dir = DIR_DOWN;
    engine.handleKeyDown(' ');
    tick(engine, 1);
    expect(engine.pump.active).toBe(true);
    // 等泵延伸到泥土
    tick(engine, 20);
    // 泵应该已收回或未激活
    expect(engine.pump.extending).toBe(false);
  });

  it('充气泵碰到怪物开始充气', () => {
    // 放置怪物在玩家右边 2 格
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 0;
    (engine as any)._player.dir = DIR_RIGHT;
    // 确保路径是隧道
    for (let c = 5; c <= 7; c++) {
      (engine as any)._grid[0][c] = 'tunnel';
    }
    (engine as any)._monsters = [{
      type: 'pooka', col: 7, row: 0, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];

    engine.handleKeyDown(' ');
    tick(engine, 30);
    // 怪物应该正在被充气
    const monster = engine.monsters[0];
    expect(monster.state).toBe('inflating');
    expect(monster.inflateLevel).toBeGreaterThan(0);
  });

  it('持续充气使怪物爆炸', () => {
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 0;
    (engine as any)._player.dir = DIR_RIGHT;
    for (let c = 5; c <= 7; c++) {
      (engine as any)._grid[0][c] = 'tunnel';
    }
    (engine as any)._monsters = [{
      type: 'pooka', col: 7, row: 0, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 2, targetLength: 4, targetMonster: 0,
    };

    // 持续按住空格
    engine.handleKeyDown(' ');
    tick(engine, 60);
    // 怪物应该已爆炸
    expect(engine.monsters[0].alive).toBe(false);
  });

  it('松开空格怪物慢慢消气', () => {
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 0;
    (engine as any)._player.dir = DIR_RIGHT;
    (engine as any)._monsters = [{
      type: 'pooka', col: 7, row: 0, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 2, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 2, targetLength: 4, targetMonster: 0,
    };

    // 松开空格
    engine.handleKeyUp(' ');
    tick(engine, 60);
    // 怪物应该已经消气（不再处于充气状态，膨胀等级归零）
    expect(engine.monsters[0].inflateLevel).toBe(0);
    expect(engine.monsters[0].state).not.toBe('inflating');
  });

  it('充气泵超出射程自动收回', () => {
    (engine as any)._player.col = 0;
    (engine as any)._player.row = 0;
    (engine as any)._player.dir = DIR_RIGHT;
    // 全部挖开确保没有泥土阻挡
    for (let c = 0; c < COLS; c++) {
      (engine as any)._grid[0][c] = 'tunnel';
    }
    engine.handleKeyDown(' ');
    tick(engine, 40);
    expect(engine.pump.extending).toBe(false);
  });

  it('怪物爆炸后得分', () => {
    const scoreBefore = engine.score;
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 0;
    (engine as any)._player.dir = DIR_RIGHT;
    (engine as any)._monsters = [{
      type: 'pooka', col: 7, row: 0, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3.5, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 2, targetLength: 4, targetMonster: 0,
    };
    engine.handleKeyDown(' ');
    tick(engine, 30);
    expect(engine.score).toBeGreaterThan(scoreBefore);
  });
});

// ========== 怪物测试 ==========

describe('DigDugEngine - 怪物', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('怪物初始状态为 normal', () => {
    for (const m of engine.monsters) {
      expect(m.state).toBe('normal');
    }
  });

  it('怪物初始存活', () => {
    for (const m of engine.monsters) {
      expect(m.alive).toBe(true);
    }
  });

  it('怪物初始膨胀等级为 0', () => {
    for (const m of engine.monsters) {
      expect(m.inflateLevel).toBe(0);
    }
  });

  it('怪物所在格为隧道', () => {
    for (const m of engine.monsters) {
      expect(engine.getCell(m.col, m.row)).toBe('tunnel');
    }
  });

  it('怪物在有效范围内', () => {
    for (const m of engine.monsters) {
      expect(m.col).toBeGreaterThanOrEqual(0);
      expect(m.col).toBeLessThan(COLS);
      expect(m.row).toBeGreaterThanOrEqual(0);
      expect(m.row).toBeLessThan(ROWS);
    }
  });

  it('怪物可以进入穿墙模式', () => {
    const monster = engine.monsters[0];
    monster.state = 'ghost';
    monster.ghostTimer = 2;
    expect(monster.state).toBe('ghost');
  });

  it('穿墙模式怪物可以穿过泥土', () => {
    const monster = engine.monsters[0];
    monster.col = 5;
    monster.row = 5;
    monster.state = 'ghost';
    monster.ghostTimer = 10;
    // 在旁边放泥土（应该已经是泥土）
    expect(engine.getCell(6, 5)).toBe('dirt');
    // 怪物在穿墙模式下应该能移动到泥土中
    expect((engine as any).isPassable(6, 5, true)).toBe(true);
  });

  it('非穿墙怪物不能穿过泥土', () => {
    expect((engine as any).isPassable(5, 5, false)).toBe(false);
  });

  it('怪物可以在隧道中移动', () => {
    // 挖一条隧道让怪物移动
    for (let c = 0; c < COLS; c++) {
      (engine as any)._grid[5][c] = 'tunnel';
    }
    const monster = engine.monsters[0];
    monster.col = 7;
    monster.row = 5;
    monster.state = 'normal';
    monster.moveTimer = 0;
    // 将玩家放在同一行，确保怪物有明确的移动方向
    (engine as any)._player.col = 0;
    (engine as any)._player.row = 5;
    const startCol = monster.col;
    // mock Math.random 避免怪物进入穿墙模式
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    tick(engine, 100);
    randomSpy.mockRestore();
    // 怪物应该已经移动（朝玩家方向）
    const moved = monster.col !== startCol;
    expect(moved).toBe(true);
  });

  it('充气中的怪物不移动', () => {
    const monster = engine.monsters[0];
    monster.state = 'inflating';
    monster.col = 5;
    monster.row = 5;
    const startCol = monster.col;
    tick(engine, 50);
    expect(monster.col).toBe(startCol);
  });
});

// ========== 深度得分测试 ==========

describe('DigDugEngine - 深度得分', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._monsters = [];
  });

  it('Pooka 在浅层（0-4行）得 200 分', () => {
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 2, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3.5, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 1, targetLength: 4, targetMonster: 0,
    };
    engine.handleKeyDown(' ');
    tick(engine, 30);
    expect(engine.score).toBe(POOKA_SCORE_SHALLOW);
  });

  it('Pooka 在中层（5-9行）得 300 分', () => {
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 7, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3.5, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 1, targetLength: 4, targetMonster: 0,
    };
    engine.handleKeyDown(' ');
    tick(engine, 30);
    expect(engine.score).toBe(POOKA_SCORE_MEDIUM);
  });

  it('Pooka 在深层（10-14行）得 400 分', () => {
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 12, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3.5, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 1, targetLength: 4, targetMonster: 0,
    };
    engine.handleKeyDown(' ');
    tick(engine, 30);
    expect(engine.score).toBe(POOKA_SCORE_DEEP);
  });

  it('Pooka 在极深层（15-19行）得 500 分', () => {
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 17, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3.5, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 1, targetLength: 4, targetMonster: 0,
    };
    engine.handleKeyDown(' ');
    tick(engine, 30);
    expect(engine.score).toBe(POOKA_SCORE_VERY_DEEP);
  });

  it('Fygar 在浅层得 300 分', () => {
    (engine as any)._monsters = [{
      type: 'fygar', col: 5, row: 2, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3.5, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 1, targetLength: 4, targetMonster: 0,
    };
    engine.handleKeyDown(' ');
    tick(engine, 30);
    expect(engine.score).toBe(FYGAR_SCORE_SHALLOW);
  });

  it('Fygar 在极深层得 600 分', () => {
    (engine as any)._monsters = [{
      type: 'fygar', col: 5, row: 17, dir: DIR_LEFT,
      state: 'inflating', inflateLevel: 3.5, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    (engine as any)._pump = {
      active: true, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 1, targetLength: 4, targetMonster: 0,
    };
    engine.handleKeyDown(' ');
    tick(engine, 30);
    expect(engine.score).toBe(FYGAR_SCORE_VERY_DEEP);
  });
});

// ========== 岩石测试 ==========

describe('DigDugEngine - 岩石', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._monsters = [];
    (engine as any)._monstersSpawned = 0;
  });

  it('岩石初始不坠落', () => {
    for (const rock of engine.rocks) {
      expect(rock.falling).toBe(false);
      expect(rock.waitingToFall).toBe(false);
    }
  });

  it('岩石初始未销毁', () => {
    for (const rock of engine.rocks) {
      expect(rock.destroyed).toBe(false);
    }
  });

  it('挖空岩石下方支撑后岩石开始等待掉落', () => {
    // 放置岩石在 (5, 3)
    (engine as any)._rocks = [{
      col: 5, row: 3, falling: false, fallTimer: 0,
      waitingToFall: false, fallY: 3 * CELL_SIZE, settled: false, destroyed: false,
    }];
    // 确保岩石下方是泥土
    (engine as any)._grid[4][5] = 'dirt';
    // 挖开岩石下方
    (engine as any)._grid[4][5] = 'tunnel';
    // 检查支撑
    (engine as any).checkRockSupport();
    expect(engine.rocks[0].waitingToFall).toBe(true);
  });

  it('岩石等待延迟后开始掉落', () => {
    // 确保岩石下方是隧道，这样它不会立即落地
    for (let r = 4; r < ROWS; r++) {
      (engine as any)._grid[r][5] = 'tunnel';
    }
    (engine as any)._rocks = [{
      col: 5, row: 3, falling: false, fallTimer: ROCK_FALL_DELAY,
      waitingToFall: true, fallY: 3 * CELL_SIZE, settled: false, destroyed: false,
    }];
    // 模拟延迟
    tick(engine, 40);
    expect(engine.rocks[0].falling).toBe(true);
  });

  it('岩石掉落时 Y 坐标增加', () => {
    (engine as any)._rocks = [{
      col: 5, row: 3, falling: true, fallTimer: 0,
      waitingToFall: false, fallY: 3 * CELL_SIZE, settled: false, destroyed: false,
    }];
    // 确保下方是隧道
    for (let r = 4; r < ROWS; r++) {
      (engine as any)._grid[r][5] = 'tunnel';
    }
    const startY = engine.rocks[0].fallY;
    tick(engine, 10);
    expect(engine.rocks[0].fallY).toBeGreaterThan(startY);
  });

  it('岩石砸死怪物', () => {
    (engine as any)._rocks = [{
      col: 5, row: 3, falling: true, fallTimer: 0,
      waitingToFall: false, fallY: 4 * CELL_SIZE, settled: false, destroyed: false,
    }];
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 4, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    expect(engine.monsters[0].alive).toBe(false);
    expect(engine.monsters[0].crushed).toBe(true);
  });

  it('岩石砸死怪物得 1000 分', () => {
    const scoreBefore = engine.score;
    (engine as any)._rocks = [{
      col: 5, row: 3, falling: true, fallTimer: 0,
      waitingToFall: false, fallY: 4 * CELL_SIZE, settled: false, destroyed: false,
    }];
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 4, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    expect(engine.score).toBe(scoreBefore + ROCK_SCORE);
  });

  it('岩石砸玩家减少生命', () => {
    (engine as any)._rocks = [{
      col: 5, row: 3, falling: true, fallTimer: 0,
      waitingToFall: false, fallY: 4 * CELL_SIZE, settled: false, destroyed: false,
    }];
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 4;
    (engine as any)._player.invincibleTimer = 0;
    const livesBefore = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(livesBefore - 1);
  });

  it('岩石落地后标记为销毁', () => {
    (engine as any)._rocks = [{
      col: 5, row: ROWS - 3, falling: true, fallTimer: 0,
      waitingToFall: false, fallY: (ROWS - 3) * CELL_SIZE, settled: false, destroyed: false,
    }];
    // 确保底部有泥土作为支撑
    (engine as any)._grid[ROWS - 1][5] = 'dirt';
    // 模拟掉落到底部
    tick(engine, 200);
    // 岩石应该已销毁（落地后清理）
    const destroyed = engine.rocks.every(r => r.destroyed);
    expect(destroyed).toBe(true);
  });
});

// ========== Fygar 喷火测试 ==========

describe('DigDugEngine - Fygar 喷火', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._monsters = [];
  });

  it('Fygar 与玩家同行且在射程内会喷火', () => {
    // 放置 Fygar 和玩家在同一行
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 5;
    for (let c = 0; c < COLS; c++) {
      (engine as any)._grid[5][c] = 'tunnel';
    }
    (engine as any)._monsters = [{
      type: 'fygar', col: 8, row: 5, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: 0, // 冷却完毕
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    // 应该产生火焰
    expect(engine.fires.length).toBeGreaterThan(0);
  });

  it('火焰伤害玩家', () => {
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 5;
    (engine as any)._player.invincibleTimer = 0;
    // 手动创建火焰覆盖玩家位置
    (engine as any)._fires = [{
      col: 3, row: 5, dir: DIR_RIGHT, remaining: 1, range: FYGAR_FIRE_RANGE,
    }];
    const livesBefore = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(livesBefore - 1);
  });

  it('火焰随时间消失', () => {
    (engine as any)._fires = [{
      col: 3, row: 5, dir: DIR_RIGHT, remaining: 0.01, range: FYGAR_FIRE_RANGE,
    }];
    tick(engine, 5);
    expect(engine.fires.length).toBe(0);
  });

  it('Fygar 不在同行不喷火', () => {
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 3;
    (engine as any)._monsters = [{
      type: 'fygar', col: 8, row: 5, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: 0,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    expect(engine.fires.length).toBe(0);
  });
});

// ========== 碰撞与生命测试 ==========

describe('DigDugEngine - 碰撞与生命', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._monsters = [];
  });

  it('怪物碰到玩家减少生命', () => {
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 5;
    (engine as any)._player.invincibleTimer = 0;
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 5, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    const livesBefore = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(livesBefore - 1);
  });

  it('生命为 0 时游戏结束', () => {
    (engine as any)._lives = 1;
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 5;
    (engine as any)._player.invincibleTimer = 0;
    (engine as any)._monsters = [{
      type: 'pooka', col: 5, row: 5, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    expect(engine.status).toBe('gameover');
  });

  it('被击中后玩家重置到初始位置', () => {
    (engine as any)._player.col = 10;
    (engine as any)._player.row = 10;
    (engine as any)._player.invincibleTimer = 0;
    (engine as any)._monsters = [{
      type: 'pooka', col: 10, row: 10, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    expect(engine.playerCol).toBe(Math.floor(COLS / 2));
    expect(engine.playerRow).toBe(0);
  });

  it('被击中后获得无敌时间', () => {
    (engine as any)._player.invincibleTimer = 0;
    (engine as any)._monsters = [{
      type: 'pooka', col: engine.playerCol, row: engine.playerRow, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    expect((engine as any)._player.invincibleTimer).toBeGreaterThan(0);
  });

  it('无敌期间不受怪物伤害', () => {
    (engine as any)._player.invincibleTimer = 5;
    (engine as any)._monsters = [{
      type: 'pooka', col: engine.playerCol, row: engine.playerRow, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    const livesBefore = engine.lives;
    tick(engine, 1);
    expect(engine.lives).toBe(livesBefore);
  });

  it('被击中后泵收回', () => {
    (engine as any)._player.invincibleTimer = 0;
    (engine as any)._pump.active = true;
    (engine as any)._pump.length = 2;
    (engine as any)._monsters = [{
      type: 'pooka', col: engine.playerCol, row: engine.playerRow, dir: DIR_LEFT,
      state: 'normal', inflateLevel: 0, ghostTimer: 0,
      moveTimer: 0, fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false, fireRemaining: 0, fireDir: DIR_RIGHT,
      alive: true, crushed: false,
    }];
    tick(engine, 1);
    expect(engine.pump.active).toBe(false);
    expect(engine.pump.length).toBe(0);
  });
});

// ========== 波次测试 ==========

describe('DigDugEngine - 波次', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('消灭所有怪物后进入下一波', () => {
    // 杀死所有怪物
    for (const m of engine.monsters) {
      m.alive = false;
    }
    tick(engine, 5);
    expect(engine.wave).toBe(2);
  });

  it('新波次等级提升', () => {
    for (const m of engine.monsters) {
      m.alive = false;
    }
    tick(engine, 5);
    expect(engine.level).toBe(2);
  });

  it('新波次生成新怪物', () => {
    const initialCount = engine.monsters.length;
    for (const m of engine.monsters) {
      m.alive = false;
    }
    tick(engine, 5);
    expect(engine.wave).toBe(2);
    expect(engine.monsters.length).toBeGreaterThan(0);
  });

  it('新波次生成新岩石', () => {
    for (const m of engine.monsters) {
      m.alive = false;
    }
    tick(engine, 5);
    expect(engine.rocks.length).toBeGreaterThan(0);
  });

  it('新波次清空火焰', () => {
    (engine as any)._fires = [{ col: 3, row: 5, dir: DIR_RIGHT, remaining: 5, range: 3 }];
    for (const m of engine.monsters) {
      m.alive = false;
    }
    tick(engine, 5);
    expect(engine.fires.length).toBe(0);
  });

  it('新波次泵重置', () => {
    (engine as any)._pump.active = true;
    for (const m of engine.monsters) {
      m.alive = false;
    }
    tick(engine, 5);
    expect(engine.pump.active).toBe(false);
  });
});

// ========== 事件系统测试 ==========

describe('DigDugEngine - 事件', () => {
  let engine: DigDugEngine;

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
    (engine as any).addScore(200);
    expect(callback).toHaveBeenCalledWith(200);
  });

  it('失去生命触发 loseLife 事件', () => {
    engine.start();
    const callback = vi.fn();
    engine.on('loseLife', callback);
    (engine as any).playerHit();
    expect(callback).toHaveBeenCalledWith(INITIAL_LIVES - 1);
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

describe('DigDugEngine - getState', () => {
  let engine: DigDugEngine;

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
    expect(typeof state.playerCol).toBe('number');
    expect(typeof state.playerRow).toBe('number');
  });

  it('返回玩家方向', () => {
    const state = engine.getState();
    expect(typeof state.playerDir).toBe('string');
  });

  it('返回怪物数量', () => {
    const state = engine.getState();
    expect(typeof state.monsterCount).toBe('number');
    expect((state.monsterCount as number)).toBeGreaterThan(0);
  });

  it('返回岩石数量', () => {
    const state = engine.getState();
    expect(typeof state.rockCount).toBe('number');
    expect((state.rockCount as number)).toBeGreaterThan(0);
  });

  it('返回泵状态', () => {
    const state = engine.getState();
    expect(typeof state.pumpActive).toBe('boolean');
  });
});

// ========== handleKeyDown / handleKeyUp 测试 ==========

describe('DigDugEngine - 输入处理', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('ArrowLeft 键被记录', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.keys.has('ArrowLeft')).toBe(true);
  });

  it('ArrowRight 键被记录', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.keys.has('ArrowRight')).toBe(true);
  });

  it('ArrowUp 键被记录', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.keys.has('ArrowUp')).toBe(true);
  });

  it('ArrowDown 键被记录', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.keys.has('ArrowDown')).toBe(true);
  });

  it('keyup 移除按键记录', () => {
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyUp('ArrowLeft');
    expect(engine.keys.has('ArrowLeft')).toBe(false);
  });

  it('空格键触发泵按下标志', () => {
    engine.handleKeyDown(' ');
    expect((engine as any)._pumpPressed).toBe(true);
  });

  it('空格键释放清除泵按下标志', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyUp(' ');
    expect((engine as any)._pumpPressed).toBe(false);
  });

  it('WASD 键被记录', () => {
    engine.handleKeyDown('w');
    engine.handleKeyDown('a');
    engine.handleKeyDown('s');
    engine.handleKeyDown('d');
    expect(engine.keys.has('w')).toBe(true);
    expect(engine.keys.has('a')).toBe(true);
    expect(engine.keys.has('s')).toBe(true);
    expect(engine.keys.has('d')).toBe(true);
  });
});

// ========== 边界与异常测试 ==========

describe('DigDugEngine - 边界与异常', () => {
  it('未初始化 canvas 就 start 会抛出错误', () => {
    const engine = new DigDugEngine();
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

  it('getCell 越界返回 dirt', () => {
    const engine = createEngine();
    expect(engine.getCell(-1, 0)).toBe('dirt');
    expect(engine.getCell(0, -1)).toBe('dirt');
    expect(engine.getCell(COLS, 0)).toBe('dirt');
    expect(engine.getCell(0, ROWS)).toBe('dirt');
  });

  it('多次 destroy 不出错', () => {
    const engine = createEngine();
    engine.start();
    engine.destroy();
    expect(() => engine.destroy()).not.toThrow();
  });

  it('多次 reset 不出错', () => {
    const engine = createEngine();
    engine.start();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });
});

// ========== 网格系统测试 ==========

describe('DigDugEngine - 网格系统', () => {
  let engine: DigDugEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
    (engine as any)._monsters = [];
  });

  it('网格行数等于 ROWS', () => {
    expect(engine.grid.length).toBe(ROWS);
  });

  it('网格列数等于 COLS', () => {
    for (let r = 0; r < ROWS; r++) {
      expect(engine.grid[r].length).toBe(COLS);
    }
  });

  it('玩家移动挖掘隧道', () => {
    const startCol = engine.playerCol;
    const startRow = engine.playerRow;
    // 向下移动
    (engine as any)._player.col = 5;
    (engine as any)._player.row = 0;
    engine.handleKeyDown('ArrowDown');
    tick(engine, 30);
    // 检查路径上是否有隧道
    let hasTunnel = false;
    for (let r = 0; r <= engine.playerRow; r++) {
      if (engine.getCell(5, r) === 'tunnel') {
        hasTunnel = true;
      }
    }
    expect(hasTunnel).toBe(true);
  });

  it('岩石占据的格子不可通过', () => {
    (engine as any)._rocks = [{
      col: 5, row: 3, falling: false, fallTimer: 0,
      waitingToFall: false, fallY: 3 * CELL_SIZE, settled: false, destroyed: false,
    }];
    expect((engine as any).isRockAt(5, 3)).toBe(true);
  });

  it('空格子没有岩石', () => {
    expect((engine as any).isRockAt(0, 0)).toBe(false);
  });
});
