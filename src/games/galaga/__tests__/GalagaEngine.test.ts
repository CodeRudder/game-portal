/**
 * GalagaEngine 综合测试
 * 覆盖：初始化、玩家移动、射击、敌机编队、俯冲攻击、碰撞检测、
 *       捕获/双机、波次系统、生命/复活、爆炸效果、状态管理、
 *       handleKeyDown/Up、getState、事件系统、常量验证
 */
import { GalagaEngine } from '../GalagaEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPEED, PLAYER_Y, PLAYER_START_X, PLAYER_LIVES,
  BULLET_WIDTH, BULLET_HEIGHT, BULLET_SPEED, BULLET_COLOR, MAX_BULLETS, SHOOT_COOLDOWN,
  ENEMY_WIDTH, ENEMY_HEIGHT, ENEMY_HIT_SCORE, ENEMY_BOSS_HIT_SCORE,
  FORMATION_COLS, FORMATION_ROWS, FORMATION_SPACING_X, FORMATION_SPACING_Y,
  FORMATION_OFFSET_X, FORMATION_OFFSET_Y,
  FORMATION_SWAY_AMPLITUDE, FORMATION_SWAY_SPEED,
  DIVE_SPEED, DIVE_SPEED_PER_LEVEL, DIVE_CHANCE, DIVE_CHANCE_PER_LEVEL,
  DIVE_CURVE_AMPLITUDE, DIVE_CURVE_FREQUENCY, DIVE_RETURN_SPEED,
  CAPTURE_ENEMY_ROW, CAPTURE_DIVE_SPEED, CAPTURE_TRACTOR_BEAM_WIDTH, CAPTURE_DURATION,
  RESCUE_HIT_SCORE, DUAL_SHIP_OFFSET_Y,
  INITIAL_ENEMY_COUNT, WAVE_BONUS, WAVE_TRANSITION_DELAY,
  EXPLOSION_DURATION, EXPLOSION_RADIUS,
  BG_COLOR, ENEMY_COLOR, ENEMY_BOSS_COLOR,
  RESPAWN_DELAY, RESPAWN_INVINCIBLE_DURATION,
  ENEMY_TYPE_BASIC, ENEMY_TYPE_BOSS, ENEMY_TYPE_CAPTURE,
  ENEMY_STATE_FORMATION, ENEMY_STATE_DIVE, ENEMY_STATE_RETURN, ENEMY_STATE_CAPTURE, ENEMY_STATE_DEAD,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建一个带 mock context 的 canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): GalagaEngine {
  const engine = new GalagaEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): GalagaEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: GalagaEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: GalagaEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: GalagaEngine, deltaTime: number): void {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 获取活跃敌机数量 */
function aliveEnemyCount(engine: GalagaEngine): number {
  return engine.enemies.filter(e => e.state !== ENEMY_STATE_DEAD).length;
}

/** 获取活跃子弹数量 */
function activeBulletCount(engine: GalagaEngine): number {
  return engine.bullets.filter(b => b.active).length;
}

/** 杀死所有敌机（快速推进波次） */
function killAllEnemies(engine: GalagaEngine): void {
  for (const enemy of engine.enemies) {
    enemy.state = ENEMY_STATE_DEAD;
  }
}

// ============================================================
// 1. 初始化
// ============================================================
describe('GalagaEngine - 初始化', () => {
  it('init 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('init 后分数为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('init 后等级为 1', () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it('init 后玩家在起始 X 位置', () => {
    const engine = createEngine();
    expect(engine.playerX).toBe(PLAYER_START_X);
  });

  it('init 后玩家存活', () => {
    const engine = createEngine();
    expect(engine.playerAlive).toBe(true);
  });

  it('init 后生命数为 PLAYER_LIVES', () => {
    const engine = createEngine();
    expect(engine.lives).toBe(PLAYER_LIVES);
  });

  it('init 后无敌状态为 false', () => {
    const engine = createEngine();
    expect(engine.invincible).toBe(false);
  });

  it('init 后无双机', () => {
    const engine = createEngine();
    expect(engine.hasDualShip).toBe(false);
  });

  it('init 后未被捕获', () => {
    const engine = createEngine();
    expect(engine.isCaptured).toBe(false);
  });

  it('init 后无敌机', () => {
    const engine = createEngine();
    expect(engine.enemies.length).toBe(0);
  });

  it('init 后无子弹', () => {
    const engine = createEngine();
    expect(engine.bullets.length).toBe(0);
  });

  it('init 后无爆炸', () => {
    const engine = createEngine();
    expect(engine.explosions.length).toBe(0);
  });

  it('PLAYER_START_X 让飞船水平居中', () => {
    expect(PLAYER_START_X).toBe((CANVAS_WIDTH - PLAYER_WIDTH) / 2);
  });
});

// ============================================================
// 2. 启动 / onStart
// ============================================================
describe('GalagaEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后生成分队（40 架敌机）', () => {
    const engine = createAndStartEngine();
    expect(engine.enemies.length).toBe(FORMATION_COLS * FORMATION_ROWS);
  });

  it('start 后所有敌机在编队状态', () => {
    const engine = createAndStartEngine();
    for (const enemy of engine.enemies) {
      expect(enemy.state).toBe(ENEMY_STATE_FORMATION);
    }
  });

  it('start 后玩家存活', () => {
    const engine = createAndStartEngine();
    expect(engine.playerAlive).toBe(true);
  });

  it('start 后生命重置为 PLAYER_LIVES', () => {
    const engine = createAndStartEngine();
    expect(engine.lives).toBe(PLAYER_LIVES);
  });

  it('start 发出 statusChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('start 发出 scoreChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('start 发出 levelChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('levelChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('start 后分数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后波次为 1', () => {
    const engine = createAndStartEngine();
    expect(engine.wave).toBe(1);
  });
});

// ============================================================
// 3. 敌机编队
// ============================================================
describe('GalagaEngine - 敌机编队', () => {
  it('编队行数为 FORMATION_ROWS', () => {
    const engine = createAndStartEngine();
    // 检查不同 baseY 的数量
    const uniqueY = new Set(engine.enemies.map(e => e.baseY));
    expect(uniqueY.size).toBe(FORMATION_ROWS);
  });

  it('编队列数为 FORMATION_COLS', () => {
    const engine = createAndStartEngine();
    // 每行有 FORMATION_COLS 架敌机
    const firstRowY = FORMATION_OFFSET_Y;
    const firstRow = engine.enemies.filter(e => e.baseY === firstRowY);
    expect(firstRow.length).toBe(FORMATION_COLS);
  });

  it('最顶行敌机为 Boss 类型', () => {
    const engine = createAndStartEngine();
    const topRow = engine.enemies.filter(e => e.baseY === FORMATION_OFFSET_Y);
    for (const enemy of topRow) {
      expect(enemy.type).toBe(ENEMY_TYPE_BOSS);
    }
  });

  it('非顶行敌机为普通类型', () => {
    const engine = createAndStartEngine();
    const nonTopRow = engine.enemies.filter(e => e.baseY !== FORMATION_OFFSET_Y);
    for (const enemy of nonTopRow) {
      expect(enemy.type).toBe(ENEMY_TYPE_BASIC);
    }
  });

  it('编队敌机位置正确（第一架）', () => {
    const engine = createAndStartEngine();
    const first = engine.enemies[0];
    expect(first.baseX).toBe(FORMATION_OFFSET_X);
    expect(first.baseY).toBe(FORMATION_OFFSET_Y);
  });

  it('编队敌机位置正确（最后一架）', () => {
    const engine = createAndStartEngine();
    const last = engine.enemies[engine.enemies.length - 1];
    expect(last.baseX).toBe(FORMATION_OFFSET_X + (FORMATION_COLS - 1) * FORMATION_SPACING_X);
    expect(last.baseY).toBe(FORMATION_OFFSET_Y + (FORMATION_ROWS - 1) * FORMATION_SPACING_Y);
  });

  it('INITIAL_ENEMY_COUNT 等于 FORMATION_COLS * FORMATION_ROWS', () => {
    expect(INITIAL_ENEMY_COUNT).toBe(FORMATION_COLS * FORMATION_ROWS);
  });

  it('编队摆动影响敌机 X 位置', () => {
    const engine = createAndStartEngine();
    const first = engine.enemies[0];
    const baseX = first.baseX;
    // 模拟一些时间让 swayPhase 变化
    callUpdate(engine, 500);
    // swayPhase 应该已经改变，敌机 x 可能偏移
    // 至少验证 x 在 baseX ± AMPLITUDE 范围内
    for (const enemy of engine.enemies) {
      if (enemy.state === ENEMY_STATE_FORMATION) {
        expect(enemy.x).toBeGreaterThanOrEqual(enemy.baseX - FORMATION_SWAY_AMPLITUDE - 1);
        expect(enemy.x).toBeLessThanOrEqual(enemy.baseX + FORMATION_SWAY_AMPLITUDE + 1);
      }
    }
  });
});

// ============================================================
// 4. 玩家移动
// ============================================================
describe('GalagaEngine - 玩家移动', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('按 ArrowLeft 向左移动', () => {
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 16);
    expect(engine.playerX).toBeLessThan(PLAYER_START_X);
  });

  it('按 ArrowRight 向右移动', () => {
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.playerX).toBeGreaterThan(PLAYER_START_X);
  });

  it('按 a 向左移动', () => {
    engine.handleKeyDown('a');
    callUpdate(engine, 16);
    expect(engine.playerX).toBeLessThan(PLAYER_START_X);
  });

  it('按 A 向左移动', () => {
    engine.handleKeyDown('A');
    callUpdate(engine, 16);
    expect(engine.playerX).toBeLessThan(PLAYER_START_X);
  });

  it('按 d 向右移动', () => {
    engine.handleKeyDown('d');
    callUpdate(engine, 16);
    expect(engine.playerX).toBeGreaterThan(PLAYER_START_X);
  });

  it('按 D 向右移动', () => {
    engine.handleKeyDown('D');
    callUpdate(engine, 16);
    expect(engine.playerX).toBeGreaterThan(PLAYER_START_X);
  });

  it('松开按键后停止移动', () => {
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 16);
    const posAfterMove = engine.playerX;
    engine.handleKeyUp('ArrowLeft');
    callUpdate(engine, 16);
    expect(engine.playerX).toBe(posAfterMove);
  });

  it('不能超出左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    for (let i = 0; i < 200; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.playerX).toBeGreaterThanOrEqual(0);
  });

  it('不能超出右边界', () => {
    engine.handleKeyDown('ArrowRight');
    for (let i = 0; i < 200; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.playerX).toBeLessThanOrEqual(CANVAS_WIDTH - PLAYER_WIDTH);
  });

  it('同时按左右键，净位移为 0', () => {
    const startX = engine.playerX;
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.playerX).toBe(startX);
  });

  it('每次移动距离为 PLAYER_SPEED', () => {
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.playerX).toBeCloseTo(PLAYER_START_X + PLAYER_SPEED * (16 / 1000), 5);
  });

  it('玩家死亡时不能移动', () => {
    setPrivate(engine, '_playerAlive', false);
    setPrivate(engine, '_respawnTimer', 99999);
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.playerX).toBe(PLAYER_START_X);
  });

  it('被捕获时不能移动', () => {
    setPrivate(engine, '_isCaptured', true);
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.playerX).toBe(PLAYER_START_X);
  });
});

// ============================================================
// 5. 射击
// ============================================================
describe('GalagaEngine - 射击', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空格键创建子弹', () => {
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBe(1);
    expect(engine.bullets[0].active).toBe(true);
  });

  it('Space 键也能创建子弹', () => {
    engine.handleKeyDown('Space');
    expect(engine.bullets.length).toBe(1);
  });

  it('子弹从玩家飞船上方发射', () => {
    engine.handleKeyDown(' ');
    const bullet = engine.bullets[0];
    expect(bullet.y).toBe(PLAYER_Y - BULLET_HEIGHT);
  });

  it('子弹 X 在飞船中心', () => {
    engine.handleKeyDown(' ');
    const bullet = engine.bullets[0];
    const expectedX = engine.playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2;
    expect(bullet.x).toBe(expectedX);
  });

  it('子弹向上移动', () => {
    engine.handleKeyDown(' ');
    const beforeY = engine.bullets[0].y;
    callUpdate(engine, 16);
    expect(engine.bullets[0].y).toBeLessThan(beforeY);
  });

  it('子弹飞出屏幕后变为 inactive', () => {
    engine.handleKeyDown(' ');
    // 多次 update 让子弹飞出屏幕
    for (let i = 0; i < 100; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.bullets[0].active).toBe(false);
  });

  it('最多 MAX_BULLETS 个活跃子弹', () => {
    // 快速射击多次
    for (let i = 0; i < 10; i++) {
      setPrivate(engine, '_lastShootTime', 0);
      engine.handleKeyDown(' ');
    }
    expect(activeBulletCount(engine)).toBeLessThanOrEqual(MAX_BULLETS);
  });

  it('射击冷却时间内不能再射击', () => {
    engine.handleKeyDown(' ');
    const countBefore = engine.bullets.length;
    // 立即再射击（冷却中）
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBe(countBefore);
  });

  it('双机时发射两颗子弹', () => {
    setPrivate(engine, '_hasDualShip', true);
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBe(2);
  });

  it('双机时最多 MAX_BULLETS * 2 个活跃子弹', () => {
    setPrivate(engine, '_hasDualShip', true);
    for (let i = 0; i < 10; i++) {
      setPrivate(engine, '_lastShootTime', 0);
      engine.handleKeyDown(' ');
    }
    expect(activeBulletCount(engine)).toBeLessThanOrEqual(MAX_BULLETS * 2);
  });

  it('玩家死亡时不能射击', () => {
    setPrivate(engine, '_playerAlive', false);
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBe(0);
  });

  it('被捕获时不能射击', () => {
    setPrivate(engine, '_isCaptured', true);
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBe(0);
  });
});

// ============================================================
// 6. 碰撞检测 - 子弹击中敌机
// ============================================================
describe('GalagaEngine - 子弹击中敌机', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('子弹击中普通敌机得分 ENEMY_HIT_SCORE', () => {
    // 放一颗子弹在敌机位置
    const enemy = engine.enemies.find(e => e.type === ENEMY_TYPE_BASIC)!;
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(engine.score).toBe(ENEMY_HIT_SCORE);
  });

  it('子弹击中 Boss 敌机得分 ENEMY_BOSS_HIT_SCORE', () => {
    const boss = engine.enemies.find(e => e.type === ENEMY_TYPE_BOSS)!;
    const bullet = { x: boss.x + ENEMY_WIDTH / 2, y: boss.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(engine.score).toBe(ENEMY_BOSS_HIT_SCORE);
  });

  it('击中后敌机状态变为 dead', () => {
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(enemy.state).toBe(ENEMY_STATE_DEAD);
  });

  it('击中后子弹变为 inactive', () => {
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(bullet.active).toBe(false);
  });

  it('击中后产生爆炸效果', () => {
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(engine.explosions.length).toBeGreaterThan(0);
  });

  it('一颗子弹只能击中一个敌机', () => {
    // 放子弹在两个重叠敌机的位置
    const bullet = { x: engine.enemies[0].x, y: engine.enemies[0].y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    // 只有一个敌机被击杀
    const deadCount = engine.enemies.filter(e => e.state === ENEMY_STATE_DEAD).length;
    expect(deadCount).toBe(1);
  });

  it('子弹未击中敌机不影响分数', () => {
    // 子弹在空白区域
    const bullet = { x: 0, y: 0, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(engine.score).toBe(0);
  });

  it('击中携带玩家的敌机获得双机', () => {
    const enemy = engine.enemies[0];
    enemy.carryingCaptured = true;
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(engine.hasDualShip).toBe(true);
  });

  it('击杀敌机发出 scoreChange 事件', () => {
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    const enemy = engine.enemies[10];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(handler).toHaveBeenCalledWith(ENEMY_HIT_SCORE);
  });

  it('连续击杀多架敌机分数累加', () => {
    const e1 = engine.enemies[10];
    const e2 = engine.enemies[11];
    const bullet1 = { x: e1.x + ENEMY_WIDTH / 2, y: e1.y, active: true };
    engine.bullets.push(bullet1);
    callUpdate(engine, 16);
    const bullet2 = { x: e2.x + ENEMY_WIDTH / 2, y: e2.y, active: true };
    engine.bullets.push(bullet2);
    callUpdate(engine, 16);
    expect(engine.score).toBe(ENEMY_HIT_SCORE * 2);
  });
});

// ============================================================
// 7. 碰撞检测 - 敌机撞击玩家
// ============================================================
describe('GalagaEngine - 敌机撞击玩家', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('俯冲中敌机撞到玩家，玩家死亡', () => {
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.playerAlive).toBe(false);
  });

  it('编队中敌机不碰撞玩家', () => {
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_FORMATION;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    callUpdate(engine, 16);
    expect(engine.playerAlive).toBe(true);
  });

  it('被撞后失去一条命', () => {
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.lives).toBe(PLAYER_LIVES - 1);
  });

  it('被撞后产生爆炸', () => {
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.explosions.length).toBeGreaterThan(0);
  });

  it('无敌状态时不被撞', () => {
    setPrivate(engine, '_invincible', true);
    setPrivate(engine, '_invincibleTimer', 99999);
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    callUpdate(engine, 16);
    expect(engine.playerAlive).toBe(true);
  });

  it('已死亡的玩家不再被撞', () => {
    setPrivate(engine, '_playerAlive', false);
    setPrivate(engine, '_respawnTimer', 99999);
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    callUpdate(engine, 16);
    expect(engine.lives).toBe(PLAYER_LIVES);
  });
});

// ============================================================
// 8. 生命与复活
// ============================================================
describe('GalagaEngine - 生命与复活', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始生命数为 PLAYER_LIVES (3)', () => {
    expect(engine.lives).toBe(PLAYER_LIVES);
  });

  it('死亡后进入复活倒计时', () => {
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(getPrivate<number>(engine, '_respawnTimer')).toBe(RESPAWN_DELAY);
  });

  it('复活倒计时结束后玩家重生', () => {
    setPrivate(engine, '_playerAlive', false);
    setPrivate(engine, '_lives', 2);
    setPrivate(engine, '_respawnTimer', 100);
    callUpdate(engine, 200);
    expect(engine.playerAlive).toBe(true);
  });

  it('复活后玩家在起始位置', () => {
    setPrivate(engine, '_playerAlive', false);
    setPrivate(engine, '_lives', 2);
    setPrivate(engine, '_respawnTimer', 100);
    callUpdate(engine, 200);
    expect(engine.playerX).toBe(PLAYER_START_X);
  });

  it('复活后有无敌时间', () => {
    setPrivate(engine, '_playerAlive', false);
    setPrivate(engine, '_lives', 2);
    setPrivate(engine, '_respawnTimer', 100);
    callUpdate(engine, 200);
    expect(engine.invincible).toBe(true);
  });

  it('生命耗尽时游戏结束', () => {
    setPrivate(engine, '_lives', 1);
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.status).toBe('gameover');
  });

  it('生命耗尽时 lives 为 0', () => {
    setPrivate(engine, '_lives', 1);
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.lives).toBe(0);
  });

  it('死亡后双机丢失', () => {
    setPrivate(engine, '_hasDualShip', true);
    setPrivate(engine, '_lives', 2);
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.hasDualShip).toBe(false);
  });

  it('生命为 0 时不再复活', () => {
    setPrivate(engine, '_playerAlive', false);
    setPrivate(engine, '_lives', 0);
    setPrivate(engine, '_respawnTimer', 100);
    callUpdate(engine, 200);
    expect(engine.playerAlive).toBe(false);
  });
});

// ============================================================
// 9. 波次系统
// ============================================================
describe('GalagaEngine - 波次系统', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始波次为 1', () => {
    expect(engine.wave).toBe(1);
  });

  it('清完所有敌机进入波次过渡', () => {
    killAllEnemies(engine);
    callUpdate(engine, 16);
    expect(engine.waveTransition).toBe(true);
  });

  it('波次过渡奖励 WAVE_BONUS 分', () => {
    killAllEnemies(engine);
    callUpdate(engine, 16);
    expect(engine.score).toBe(WAVE_BONUS);
  });

  it('波次过渡持续 WAVE_TRANSITION_DELAY', () => {
    killAllEnemies(engine);
    callUpdate(engine, 16);
    expect(getPrivate<number>(engine, '_waveTransitionTimer')).toBe(WAVE_TRANSITION_DELAY);
  });

  it('波次过渡结束后生成新编队', () => {
    killAllEnemies(engine);
    callUpdate(engine, 16);
    // 推进过渡计时器
    callUpdate(engine, WAVE_TRANSITION_DELAY + 100);
    expect(engine.enemies.length).toBe(FORMATION_COLS * FORMATION_ROWS);
  });

  it('波次过渡结束后 wave 递增', () => {
    killAllEnemies(engine);
    callUpdate(engine, 16);
    callUpdate(engine, WAVE_TRANSITION_DELAY + 100);
    expect(engine.wave).toBe(2);
  });

  it('波次过渡期间 update 不更新玩家/敌机', () => {
    killAllEnemies(engine);
    callUpdate(engine, 16);
    const px = engine.playerX;
    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, 16);
    expect(engine.playerX).toBe(px); // 没移动
  });

  it('波次过渡结束后 level 更新', () => {
    killAllEnemies(engine);
    callUpdate(engine, 16);
    callUpdate(engine, WAVE_TRANSITION_DELAY + 100);
    expect(engine.level).toBe(2);
  });
});

// ============================================================
// 10. 爆炸效果
// ============================================================
describe('GalagaEngine - 爆炸效果', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('击杀敌机产生爆炸', () => {
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(engine.explosions.length).toBe(1);
  });

  it('爆炸位置在敌机中心', () => {
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    const exp = engine.explosions[0];
    expect(exp.x).toBeCloseTo(enemy.x + ENEMY_WIDTH / 2, 0);
    expect(exp.y).toBeCloseTo(enemy.y + ENEMY_HEIGHT / 2, 0);
  });

  it('爆炸持续 EXPLOSION_DURATION 后消失', () => {
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    // 推进时间超过爆炸持续时间
    callUpdate(engine, EXPLOSION_DURATION + 100);
    expect(engine.explosions.length).toBe(0);
  });

  it('爆炸计时器递减', () => {
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    const before = engine.explosions[0].timer;
    callUpdate(engine, 100);
    expect(engine.explosions[0].timer).toBeLessThan(before);
  });

  it('玩家死亡也产生爆炸', () => {
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.explosions.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 11. 俯冲攻击
// ============================================================
describe('GalagaEngine - 俯冲攻击', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('敌机可以从编队状态开始俯冲', () => {
    const enemy = engine.enemies[10];
    expect(enemy.state).toBe(ENEMY_STATE_FORMATION);
    // 强制触发俯冲
    const proto = Object.getPrototypeOf(engine);
    proto.startDive.call(engine, enemy);
    expect(enemy.state).toBe(ENEMY_STATE_DIVE);
  });

  it('俯冲中敌机 Y 坐标增加（向下移动）', () => {
    const enemy = engine.enemies[10];
    const proto = Object.getPrototypeOf(engine);
    proto.startDive.call(engine, enemy);
    const startY = enemy.y;
    callUpdate(engine, 16);
    expect(enemy.y).toBeGreaterThan(startY);
  });

  it('俯冲完成后进入返回状态', () => {
    const enemy = engine.enemies[10];
    const proto = Object.getPrototypeOf(engine);
    proto.startDive.call(engine, enemy);
    // 推进足够时间让俯冲完成
    for (let i = 0; i < 500; i++) {
      callUpdate(engine, 16);
      if (enemy.state === ENEMY_STATE_RETURN) break;
    }
    expect(enemy.state).toBe(ENEMY_STATE_RETURN);
  });

  it('返回编队后恢复编队状态', () => {
    const enemy = engine.enemies[5];
    enemy.state = ENEMY_STATE_RETURN;
    enemy.x = enemy.baseX + 100;
    enemy.y = enemy.baseY + 200;
    // 多次 update 让其返回
    for (let i = 0; i < 500; i++) {
      callUpdate(engine, 16);
      if (enemy.state === ENEMY_STATE_FORMATION) break;
    }
    expect(enemy.state).toBe(ENEMY_STATE_FORMATION);
  });

  it('俯冲速度随波次增加', () => {
    const wave1Speed = DIVE_SPEED + 0 * DIVE_SPEED_PER_LEVEL;
    const wave3Speed = DIVE_SPEED + 2 * DIVE_SPEED_PER_LEVEL;
    expect(wave3Speed).toBeGreaterThan(wave1Speed);
  });

  it('俯冲概率随波次增加', () => {
    const wave1Chance = DIVE_CHANCE + 0 * DIVE_CHANCE_PER_LEVEL;
    const wave3Chance = DIVE_CHANCE + 2 * DIVE_CHANCE_PER_LEVEL;
    expect(wave3Chance).toBeGreaterThan(wave1Chance);
  });
});

// ============================================================
// 12. 捕获机制
// ============================================================
describe('GalagaEngine - 捕获机制', () => {
  let engine: GalagaEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('Boss 敌机可以进入捕获状态', () => {
    const boss = engine.enemies.find(e => e.type === ENEMY_TYPE_BOSS)!;
    // 直接设置捕获状态
    boss.type = ENEMY_TYPE_CAPTURE;
    boss.state = ENEMY_STATE_CAPTURE;
    boss.captureTimer = 0;
    boss.hasCapturedPlayer = false;
    expect(boss.state).toBe(ENEMY_STATE_CAPTURE);
  });

  it('捕获敌机向玩家方向移动', () => {
    const boss = engine.enemies.find(e => e.type === ENEMY_TYPE_BOSS)!;
    boss.type = ENEMY_TYPE_CAPTURE;
    boss.state = ENEMY_STATE_CAPTURE;
    boss.captureTimer = 0;
    boss.hasCapturedPlayer = false;
    boss.x = 0;
    boss.y = 0;
    const beforeX = boss.x;
    callUpdate(engine, 16);
    // Boss 应该向玩家方向移动
    expect(boss.x).toBeGreaterThan(beforeX);
  });

  it('捕获超时后敌机返回编队', () => {
    const boss = engine.enemies.find(e => e.type === ENEMY_TYPE_BOSS)!;
    boss.type = ENEMY_TYPE_CAPTURE;
    boss.state = ENEMY_STATE_CAPTURE;
    boss.captureTimer = CAPTURE_DURATION + 100;
    boss.hasCapturedPlayer = false;
    // 将 boss 放在远离玩家的位置确保不会捕获
    boss.x = -100;
    boss.y = -100;
    callUpdate(engine, 16);
    expect(boss.state).toBe(ENEMY_STATE_RETURN);
  });

  it('击杀携带玩家的敌机获得双机', () => {
    const enemy = engine.enemies.find(e => e.type === ENEMY_TYPE_BOSS)!;
    enemy.carryingCaptured = true;
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(engine.hasDualShip).toBe(true);
  });

  it('击杀携带玩家的敌机后 carryingCaptured 被清除', () => {
    const enemy = engine.enemies.find(e => e.type === ENEMY_TYPE_BOSS)!;
    enemy.carryingCaptured = true;
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    expect(enemy.carryingCaptured).toBe(false);
  });
});

// ============================================================
// 13. 状态管理
// ============================================================
describe('GalagaEngine - 状态管理', () => {
  it('初始状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('pause 后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态恢复为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态恢复为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('gameOver 后状态为 gameover', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 1);
    const enemy = engine.enemies[0];
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = engine.playerX;
    enemy.diveStartY = PLAYER_Y;
    enemy.x = engine.playerX;
    enemy.y = PLAYER_Y;
    enemy.diveProgress = 0;
    callUpdate(engine, 16);
    expect(engine.status).toBe('gameover');
  });

  it('idle 时不能 pause', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('playing 时不能 resume', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后分数清零', () => {
    const engine = createAndStartEngine();
    engine.addScore(500);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后生命恢复', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 1);
    engine.reset();
    expect(engine.lives).toBe(PLAYER_LIVES);
  });

  it('reset 后敌机清空', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.enemies.length).toBe(0);
  });

  it('reset 后子弹清空', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    engine.reset();
    expect(engine.bullets.length).toBe(0);
  });

  it('reset 后爆炸清空', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.explosions.length).toBe(0);
  });

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    const callCount = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCount);
  });

  it('pause/resume 发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
    engine.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('reset 发出 statusChange idle 事件', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });
});

// ============================================================
// 14. handleKeyDown / handleKeyUp
// ============================================================
describe('GalagaEngine - handleKeyDown / handleKeyUp', () => {
  it('Space 在 idle 状态启动游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('Space 在 gameover 状态重启游戏', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('ArrowLeft 设置 _leftPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowLeft');
    expect(getPrivate<boolean>(engine, '_leftPressed')).toBe(true);
  });

  it('ArrowRight 设置 _rightPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowRight');
    expect(getPrivate<boolean>(engine, '_rightPressed')).toBe(true);
  });

  it('a 设置 _leftPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('a');
    expect(getPrivate<boolean>(engine, '_leftPressed')).toBe(true);
  });

  it('A 设置 _leftPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('A');
    expect(getPrivate<boolean>(engine, '_leftPressed')).toBe(true);
  });

  it('d 设置 _rightPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('d');
    expect(getPrivate<boolean>(engine, '_rightPressed')).toBe(true);
  });

  it('D 设置 _rightPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('D');
    expect(getPrivate<boolean>(engine, '_rightPressed')).toBe(true);
  });

  it('handleKeyUp ArrowLeft 取消 _leftPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyUp('ArrowLeft');
    expect(getPrivate<boolean>(engine, '_leftPressed')).toBe(false);
  });

  it('handleKeyUp ArrowRight 取消 _rightPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyUp('ArrowRight');
    expect(getPrivate<boolean>(engine, '_rightPressed')).toBe(false);
  });

  it('handleKeyUp a 取消 _leftPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('a');
    engine.handleKeyUp('a');
    expect(getPrivate<boolean>(engine, '_leftPressed')).toBe(false);
  });

  it('handleKeyUp d 取消 _rightPressed', () => {
    const engine = createEngine();
    engine.handleKeyDown('d');
    engine.handleKeyUp('d');
    expect(getPrivate<boolean>(engine, '_rightPressed')).toBe(false);
  });

  it('未知按键不改变输入状态', () => {
    const engine = createEngine();
    engine.handleKeyDown('z');
    expect(getPrivate<boolean>(engine, '_leftPressed')).toBe(false);
    expect(getPrivate<boolean>(engine, '_rightPressed')).toBe(false);
  });

  it('Space 在 playing 状态触发射击', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBeGreaterThan(0);
  });

  it('Space 键别名也能启动', () => {
    const engine = createEngine();
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });

  it('Space 键别名也能射击', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('Space');
    expect(engine.bullets.length).toBeGreaterThan(0);
  });

  it('handleKeyUp Space 取消 _firePressed', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    engine.handleKeyUp(' ');
    expect(getPrivate<boolean>(engine, '_firePressed')).toBe(false);
  });
});

// ============================================================
// 15. getState
// ============================================================
describe('GalagaEngine - getState', () => {
  it('返回包含所有必要字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('lives');
    expect(state).toHaveProperty('wave');
    expect(state).toHaveProperty('playerX');
    expect(state).toHaveProperty('playerY');
    expect(state).toHaveProperty('playerAlive');
    expect(state).toHaveProperty('hasDualShip');
    expect(state).toHaveProperty('isCaptured');
    expect(state).toHaveProperty('invincible');
    expect(state).toHaveProperty('bulletCount');
    expect(state).toHaveProperty('enemyCount');
    expect(state).toHaveProperty('waveTransition');
  });

  it('初始状态的 getState 值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.lives).toBe(PLAYER_LIVES);
    expect(state.wave).toBe(1);
    expect(state.playerX).toBe(PLAYER_START_X);
    expect(state.playerY).toBe(PLAYER_Y);
    expect(state.playerAlive).toBe(true);
    expect(state.hasDualShip).toBe(false);
    expect(state.isCaptured).toBe(false);
    expect(state.invincible).toBe(false);
    expect(state.bulletCount).toBe(0);
    expect(state.enemyCount).toBe(FORMATION_COLS * FORMATION_ROWS);
    expect(state.waveTransition).toBe(false);
  });

  it('击杀敌机后 enemyCount 减少', () => {
    const engine = createAndStartEngine();
    const enemy = engine.enemies[5];
    const bullet = { x: enemy.x + ENEMY_WIDTH / 2, y: enemy.y, active: true };
    engine.bullets.push(bullet);
    callUpdate(engine, 16);
    const state = engine.getState();
    expect(state.enemyCount).toBe(FORMATION_COLS * FORMATION_ROWS - 1);
  });

  it('射击后 bulletCount 增加', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    const state = engine.getState();
    expect(state.bulletCount).toBeGreaterThan(0);
  });

  it('波次过渡时 waveTransition 为 true', () => {
    const engine = createAndStartEngine();
    killAllEnemies(engine);
    callUpdate(engine, 16);
    const state = engine.getState();
    expect(state.waveTransition).toBe(true);
  });
});

// ============================================================
// 16. 事件系统
// ============================================================
describe('GalagaEngine - 事件系统', () => {
  it('on 注册事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.off('test', handler);
    engine.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit 传递参数', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.emit('test', 'arg1', 42);
    expect(handler).toHaveBeenCalledWith('arg1', 42);
  });

  it('多次 on 同一事件注册多个监听', () => {
    const engine = createEngine();
    const h1 = jest.fn();
    const h2 = jest.fn();
    engine.on('test', h1);
    engine.on('test', h2);
    engine.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });
});

// ============================================================
// 17. 边界与异常场景
// ============================================================
describe('GalagaEngine - 边界与异常场景', () => {
  it('无 canvas 时 start 抛出错误', () => {
    const engine = new GalagaEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('连续多次 start 不会崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
  });

  it('连续多次 reset 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });

  it('连续多次 pause 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(() => engine.pause()).not.toThrow();
  });

  it('未 pause 时 resume 不改变状态', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 时 pause 不改变状态', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('无敌时间倒计时结束后取消无敌', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_invincible', true);
    setPrivate(engine, '_invincibleTimer', 100);
    callUpdate(engine, 200);
    expect(engine.invincible).toBe(false);
  });

  it('快速连续射击受冷却限制', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBe(1);
    engine.handleKeyDown(' ');
    expect(engine.bullets.length).toBe(1); // 冷却中
  });

  it('所有敌机 dead 时 checkWaveComplete 正确触发', () => {
    const engine = createAndStartEngine();
    killAllEnemies(engine);
    callUpdate(engine, 16);
    expect(engine.waveTransition).toBe(true);
  });

  it('部分敌机存活时不触发波次过渡', () => {
    const engine = createAndStartEngine();
    // 只杀一部分
    for (let i = 0; i < 10; i++) {
      engine.enemies[i].state = ENEMY_STATE_DEAD;
    }
    callUpdate(engine, 16);
    expect(engine.waveTransition).toBe(false);
  });

  it('波次过渡结束后新编队所有敌机在编队状态', () => {
    const engine = createAndStartEngine();
    killAllEnemies(engine);
    callUpdate(engine, 16);
    callUpdate(engine, WAVE_TRANSITION_DELAY + 100);
    for (const enemy of engine.enemies) {
      expect(enemy.state).toBe(ENEMY_STATE_FORMATION);
    }
  });

  it('玩家 Y 坐标固定为 PLAYER_Y', () => {
    const engine = createAndStartEngine();
    expect(engine.playerY).toBe(PLAYER_Y);
  });

  it('update 在无子弹时不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('update 在无敌机时不崩溃', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_enemies', []);
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });
});

// ============================================================
// 18. 常量合理性验证
// ============================================================
describe('Galaga 常量验证', () => {
  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('PLAYER_SPEED > 0', () => {
    expect(PLAYER_SPEED).toBeGreaterThan(0);
  });

  it('BULLET_SPEED > 0', () => {
    expect(BULLET_SPEED).toBeGreaterThan(0);
  });

  it('MAX_BULLETS > 0', () => {
    expect(MAX_BULLETS).toBeGreaterThan(0);
  });

  it('SHOOT_COOLDOWN > 0', () => {
    expect(SHOOT_COOLDOWN).toBeGreaterThan(0);
  });

  it('PLAYER_LIVES > 0', () => {
    expect(PLAYER_LIVES).toBeGreaterThan(0);
  });

  it('ENEMY_HIT_SCORE > 0', () => {
    expect(ENEMY_HIT_SCORE).toBeGreaterThan(0);
  });

  it('ENEMY_BOSS_HIT_SCORE > ENEMY_HIT_SCORE', () => {
    expect(ENEMY_BOSS_HIT_SCORE).toBeGreaterThan(ENEMY_HIT_SCORE);
  });

  it('FORMATION_COLS > 0 且 FORMATION_ROWS > 0', () => {
    expect(FORMATION_COLS).toBeGreaterThan(0);
    expect(FORMATION_ROWS).toBeGreaterThan(0);
  });

  it('FORMATION_SPACING_X 和 FORMATION_SPACING_Y > 0', () => {
    expect(FORMATION_SPACING_X).toBeGreaterThan(0);
    expect(FORMATION_SPACING_Y).toBeGreaterThan(0);
  });

  it('DIVE_SPEED > 0', () => {
    expect(DIVE_SPEED).toBeGreaterThan(0);
  });

  it('DIVE_CHANCE > 0 且 < 1', () => {
    expect(DIVE_CHANCE).toBeGreaterThan(0);
    expect(DIVE_CHANCE).toBeLessThan(1);
  });

  it('WAVE_BONUS > 0', () => {
    expect(WAVE_BONUS).toBeGreaterThan(0);
  });

  it('WAVE_TRANSITION_DELAY > 0', () => {
    expect(WAVE_TRANSITION_DELAY).toBeGreaterThan(0);
  });

  it('EXPLOSION_DURATION > 0', () => {
    expect(EXPLOSION_DURATION).toBeGreaterThan(0);
  });

  it('RESPAWN_DELAY > 0', () => {
    expect(RESPAWN_DELAY).toBeGreaterThan(0);
  });

  it('RESPAWN_INVINCIBLE_DURATION > 0', () => {
    expect(RESPAWN_INVINCIBLE_DURATION).toBeGreaterThan(0);
  });

  it('PLAYER_Y 在画布底部区域', () => {
    expect(PLAYER_Y).toBeGreaterThan(CANVAS_HEIGHT / 2);
    expect(PLAYER_Y + PLAYER_HEIGHT).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  it('编队不会超出画布宽度', () => {
    const maxX = FORMATION_OFFSET_X + (FORMATION_COLS - 1) * FORMATION_SPACING_X + ENEMY_WIDTH + FORMATION_SWAY_AMPLITUDE;
    expect(maxX).toBeLessThanOrEqual(CANVAS_WIDTH);
  });

  it('DUAL_SHIP_OFFSET_Y 为负数（在主飞船上方）', () => {
    expect(DUAL_SHIP_OFFSET_Y).toBeLessThan(0);
  });

  it('RESCUE_HIT_SCORE > 0', () => {
    expect(RESCUE_HIT_SCORE).toBeGreaterThan(0);
  });

  it('CAPTURE_DURATION > 0', () => {
    expect(CAPTURE_DURATION).toBeGreaterThan(0);
  });

  it('ENEMY_STATE 常量值正确', () => {
    expect(ENEMY_STATE_FORMATION).toBe('formation');
    expect(ENEMY_STATE_DIVE).toBe('dive');
    expect(ENEMY_STATE_RETURN).toBe('return');
    expect(ENEMY_STATE_CAPTURE).toBe('capture');
    expect(ENEMY_STATE_DEAD).toBe('dead');
  });

  it('ENEMY_TYPE 常量值正确', () => {
    expect(ENEMY_TYPE_BASIC).toBe('basic');
    expect(ENEMY_TYPE_BOSS).toBe('boss');
    expect(ENEMY_TYPE_CAPTURE).toBe('capture');
  });
});
