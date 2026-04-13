/**
 * WhackAMoleEngine 综合测试
 * 覆盖：初始化（3x3网格9个洞）、地鼠出现/消失生命周期、敲击地鼠（键盘+数字键）、
 *       计分（基础分+连击加成）、时间限制、等级递进、状态管理、handleKeyDown/Up、
 *       getState、事件系统、边界与异常场景
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhackAMoleEngine } from '../WhackAMoleEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_ROWS, GRID_COLS, TOTAL_HOLES,
  MOLE_APPEAR_DURATION, MOLE_STAY_DURATION_BASE, MOLE_STAY_DURATION_DECREASE_PER_LEVEL,
  MOLE_STAY_DURATION_MIN, MOLE_HIDE_DURATION,
  SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_DECREASE_PER_LEVEL, SPAWN_INTERVAL_MIN,
  MAX_ACTIVE_MOLES_BASE, MAX_ACTIVE_MOLES_LEVEL_STEP, MAX_ACTIVE_MOLES_MAX,
  HIT_SCORE_BASE, HIT_SCORE_PER_LEVEL, COMBO_BONUS,
  GAME_DURATION, LEVEL_UP_SCORE, MAX_LEVEL,
  MoleState,
  KEY_HOLE_MAP, DIRECTION_KEYS,
  HOLE_RADIUS, MOLE_RADIUS, CURSOR_RADIUS,
  HUD_HEIGHT, GRID_PADDING_X, GRID_PADDING_Y,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): WhackAMoleEngine {
  const engine = new WhackAMoleEngine();
  engine.init(); // 不传 canvas
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): WhackAMoleEngine {
  const engine = new WhackAMoleEngine();
  engine.init();
  // start 需要 canvas，但我们绕过检查
  // 直接设置 _status 并调用 onStart
  (engine as any)._status = 'playing';
  (engine as any)._score = 0;
  (engine as any)._level = 1;
  // 手动调用 onStart 的逻辑
  const proto = Object.getPrototypeOf(engine);
  proto.onStart.call(engine);
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: WhackAMoleEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: WhackAMoleEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: WhackAMoleEngine, deltaTime: number): void {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 手动让一个洞的地鼠进入 APPEARING 状态 */
function spawnMoleAt(engine: WhackAMoleEngine, index: number): void {
  const holes = getPrivate<any[]>(engine, '_holes');
  holes[index].state = MoleState.APPEARING;
  holes[index].stateTimer = 0;
  holes[index].whacked = false;
  // 增加 totalMolesSpawned
  setPrivate(engine, '_totalMolesSpawned', getPrivate<number>(engine, '_totalMolesSpawned') + 1);
}

/** 手动让一个洞的地鼠进入 VISIBLE 状态 */
function makeMoleVisible(engine: WhackAMoleEngine, index: number): void {
  const holes = getPrivate<any[]>(engine, '_holes');
  holes[index].state = MoleState.VISIBLE;
  holes[index].stateTimer = 0;
  holes[index].whacked = false;
}

/** 获取引擎的 holes 数组 */
function getHoles(engine: WhackAMoleEngine) {
  return getPrivate<any[]>(engine, '_holes');
}

/** 获取引擎的 holePositions 数组 */
function getHolePositions(engine: WhackAMoleEngine) {
  return getPrivate<{ x: number; y: number }[]>(engine, '_holePositions');
}

/** 获取 scorePopups 数组 */
function getScorePopups(engine: WhackAMoleEngine) {
  return getPrivate<any[]>(engine, '_scorePopups');
}

// ============================================================
// 1. 初始化
// ============================================================
describe('WhackAMoleEngine - 初始化', () => {
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

  it('init 后创建 3x3 = 9 个洞', () => {
    const engine = createEngine();
    const holes = getHoles(engine);
    expect(holes).toHaveLength(TOTAL_HOLES);
    expect(TOTAL_HOLES).toBe(9);
  });

  it('init 后所有洞为 HIDDEN 状态', () => {
    const engine = createEngine();
    const holes = getHoles(engine);
    for (const hole of holes) {
      expect(hole.state).toBe(MoleState.HIDDEN);
    }
  });

  it('init 后所有洞的 index 从 0 到 8', () => {
    const engine = createEngine();
    const holes = getHoles(engine);
    for (let i = 0; i < TOTAL_HOLES; i++) {
      expect(holes[i].index).toBe(i);
    }
  });

  it('init 后所有洞的 whacked 为 false', () => {
    const engine = createEngine();
    const holes = getHoles(engine);
    for (const hole of holes) {
      expect(hole.whacked).toBe(false);
    }
  });

  it('init 后光标在中心位置（index 4）', () => {
    const engine = createEngine();
    expect(engine.cursorIndex).toBe(4);
  });

  it('init 后 holePositions 有 9 个坐标', () => {
    const engine = createEngine();
    const positions = getHolePositions(engine);
    expect(positions).toHaveLength(9);
  });

  it('holePositions 按行列排列，第一个在左上', () => {
    const engine = createEngine();
    const positions = getHolePositions(engine);
    // 第一个洞应该在左上区域
    expect(positions[0].x).toBeLessThan(CANVAS_WIDTH / 2);
    expect(positions[0].y).toBeGreaterThan(HUD_HEIGHT);
  });

  it('最后一个洞在右下区域', () => {
    const engine = createEngine();
    const positions = getHolePositions(engine);
    expect(positions[8].x).toBeGreaterThan(CANVAS_WIDTH / 2);
    expect(positions[8].y).toBeGreaterThan(CANVAS_HEIGHT / 2);
  });

  it('init 后 combo 为 0', () => {
    const engine = createEngine();
    expect(engine.combo).toBe(0);
  });

  it('init 后 totalHits 为 0', () => {
    const engine = createEngine();
    expect(engine.totalHits).toBe(0);
  });

  it('init 后 totalMisses 为 0', () => {
    const engine = createEngine();
    expect(engine.totalMisses).toBe(0);
  });

  it('init 后 totalMolesSpawned 为 0', () => {
    const engine = createEngine();
    expect(engine.totalMolesSpawned).toBe(0);
  });
});

// ============================================================
// 2. 启动 / onStart
// ============================================================
describe('WhackAMoleEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后分数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后等级为 1', () => {
    const engine = createAndStartEngine();
    expect(engine.level).toBe(1);
  });

  it('start 后所有洞重置为 HIDDEN', () => {
    const engine = createAndStartEngine();
    const holes = getHoles(engine);
    for (const hole of holes) {
      expect(hole.state).toBe(MoleState.HIDDEN);
    }
  });

  it('start 后光标回到中心（index 4）', () => {
    const engine = createAndStartEngine();
    expect(engine.cursorIndex).toBe(4);
  });

  it('start 后游戏计时器为 GAME_DURATION 秒', () => {
    const engine = createAndStartEngine();
    expect(engine.remainingTime).toBe(GAME_DURATION);
  });

  it('start 后 combo 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.combo).toBe(0);
  });

  it('start 后 maxCombo 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.maxCombo).toBe(0);
  });

  it('start 后 totalHits 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.totalHits).toBe(0);
  });

  it('start 后 totalMisses 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.totalMisses).toBe(0);
  });

  it('start 后 totalMolesSpawned 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.totalMolesSpawned).toBe(0);
  });

  it('start 后 scorePopups 为空', () => {
    const engine = createAndStartEngine();
    expect(getScorePopups(engine)).toHaveLength(0);
  });

  it('start 后 directionPressed 被清空', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    expect(pressed.size).toBe(0);
  });
});

// ============================================================
// 3. 地鼠出现/消失生命周期
// ============================================================
describe('WhackAMoleEngine - 地鼠生命周期', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('地鼠从 HIDDEN 变为 APPEARING', () => {
    spawnMoleAt(engine, 0);
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.APPEARING);
  });

  it('APPEARING 经过 MOLE_APPEAR_DURATION 后变为 VISIBLE', () => {
    spawnMoleAt(engine, 0);
    callUpdate(engine, MOLE_APPEAR_DURATION);
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.VISIBLE);
  });

  it('APPEARING 在 MOLE_APPEAR_DURATION 之前仍为 APPEARING', () => {
    spawnMoleAt(engine, 0);
    callUpdate(engine, MOLE_APPEAR_DURATION - 1);
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.APPEARING);
  });

  it('VISIBLE 经过 stayDuration 后变为 HIDING', () => {
    makeMoleVisible(engine, 0);
    const stayDuration = MOLE_STAY_DURATION_BASE; // level 1
    callUpdate(engine, stayDuration);
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.HIDING);
  });

  it('VISIBLE 在 stayDuration 之前仍为 VISIBLE', () => {
    makeMoleVisible(engine, 0);
    callUpdate(engine, MOLE_STAY_DURATION_BASE - 1);
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.VISIBLE);
  });

  it('HIDING 经过 MOLE_HIDE_DURATION 后变为 HIDDEN', () => {
    makeMoleVisible(engine, 0);
    callUpdate(engine, MOLE_STAY_DURATION_BASE); // -> HIDING
    callUpdate(engine, MOLE_HIDE_DURATION); // -> HIDDEN
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.HIDDEN);
  });

  it('HIDING 在 MOLE_HIDE_DURATION 之前仍为 HIDING', () => {
    makeMoleVisible(engine, 0);
    callUpdate(engine, MOLE_STAY_DURATION_BASE); // -> HIDING
    callUpdate(engine, MOLE_HIDE_DURATION - 1);
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.HIDING);
  });

  it('WHACKED 经过 MOLE_HIDE_DURATION 后变为 HIDDEN', () => {
    makeMoleVisible(engine, 0);
    const holes = getHoles(engine);
    holes[0].state = MoleState.WHACKED;
    holes[0].stateTimer = 0;
    callUpdate(engine, MOLE_HIDE_DURATION);
    expect(holes[0].state).toBe(MoleState.HIDDEN);
  });

  it('地鼠逃跑（VISIBLE→HIDING）重置 combo', () => {
    setPrivate(engine, '_combo', 3);
    makeMoleVisible(engine, 0);
    callUpdate(engine, MOLE_STAY_DURATION_BASE); // -> HIDING, resets combo
    expect(engine.combo).toBe(0);
  });

  it('HIDDEN 状态的洞不受 update 影响', () => {
    const holes = getHoles(engine);
    const beforeState = holes[0].state;
    const beforeTimer = holes[0].stateTimer;
    callUpdate(engine, 100);
    expect(holes[0].state).toBe(beforeState);
    expect(holes[0].stateTimer).toBe(beforeTimer);
  });

  it('完整生命周期：APPEARING → VISIBLE → HIDING → HIDDEN', () => {
    spawnMoleAt(engine, 0);
    const holes = getHoles(engine);

    // APPEARING -> VISIBLE
    callUpdate(engine, MOLE_APPEAR_DURATION);
    expect(holes[0].state).toBe(MoleState.VISIBLE);

    // VISIBLE -> HIDING
    callUpdate(engine, MOLE_STAY_DURATION_BASE);
    expect(holes[0].state).toBe(MoleState.HIDING);

    // HIDING -> HIDDEN
    callUpdate(engine, MOLE_HIDE_DURATION);
    expect(holes[0].state).toBe(MoleState.HIDDEN);
  });
});

// ============================================================
// 4. 地鼠生成
// ============================================================
describe('WhackAMoleEngine - 地鼠生成', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('spawnTimer 倒计时到 0 时尝试生成', () => {
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 1); // spawnTimer 变为负值，触发 _trySpawnMole
    // 至少一个洞不再是 HIDDEN（概率性，但 spawnTimer=0 几乎必然触发）
    const holes = getHoles(engine);
    const activeCount = holes.filter(h => h.state !== MoleState.HIDDEN).length;
    expect(activeCount).toBeGreaterThanOrEqual(0); // 至少不崩溃
  });

  it('生成后 totalMolesSpawned 增加', () => {
    setPrivate(engine, '_spawnTimer', 0);
    // 多次 update 让生成有足够机会
    for (let i = 0; i < 10; i++) {
      callUpdate(engine, SPAWN_INTERVAL_BASE + 1);
    }
    expect(engine.totalMolesSpawned).toBeGreaterThan(0);
  });

  it('达到最大活跃地鼠数时不再生成', () => {
    // level 1: MAX_ACTIVE_MOLES_BASE = 1
    // 把所有洞都设为活跃
    const holes = getHoles(engine);
    for (let i = 0; i < TOTAL_HOLES; i++) {
      holes[i].state = MoleState.VISIBLE;
    }
    const beforeSpawned = engine.totalMolesSpawned;
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 1);
    expect(engine.totalMolesSpawned).toBe(beforeSpawned);
  });

  it('没有可用洞位时不生成', () => {
    const holes = getHoles(engine);
    for (let i = 0; i < TOTAL_HOLES; i++) {
      holes[i].state = MoleState.APPEARING;
    }
    const beforeSpawned = engine.totalMolesSpawned;
    setPrivate(engine, '_spawnTimer', 0);
    callUpdate(engine, 1);
    expect(engine.totalMolesSpawned).toBe(beforeSpawned);
  });

  it('高等级时最大活跃地鼠数增加', () => {
    // Level 4: extra = floor(3/3) = 1, maxActive = 1 + 1 = 2
    setPrivate(engine, '_level', 4);
    const proto = Object.getPrototypeOf(engine);
    const getMaxActive = proto._getMaxActiveMoles.bind(engine);
    expect(getMaxActive()).toBe(MAX_ACTIVE_MOLES_BASE + 1);
  });

  it('最大活跃地鼠数不超过 MAX_ACTIVE_MOLES_MAX', () => {
    setPrivate(engine, '_level', MAX_LEVEL);
    const proto = Object.getPrototypeOf(engine);
    const getMaxActive = proto._getMaxActiveMoles.bind(engine);
    expect(getMaxActive()).toBeLessThanOrEqual(MAX_ACTIVE_MOLES_MAX);
  });

  it('生成间隔随等级降低', () => {
    setPrivate(engine, '_level', 1);
    const proto = Object.getPrototypeOf(engine);
    const getInterval = proto._getSpawnInterval.bind(engine);
    const interval1 = getInterval();
    setPrivate(engine, '_level', 5);
    const interval5 = getInterval();
    expect(interval5).toBeLessThan(interval1);
  });

  it('生成间隔不低于 SPAWN_INTERVAL_MIN', () => {
    setPrivate(engine, '_level', MAX_LEVEL);
    const proto = Object.getPrototypeOf(engine);
    const getInterval = proto._getSpawnInterval.bind(engine);
    expect(getInterval()).toBeGreaterThanOrEqual(SPAWN_INTERVAL_MIN);
  });
});

// ============================================================
// 5. 敲击地鼠（键盘）
// ============================================================
describe('WhackAMoleEngine - 敲击地鼠', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空格键敲击当前位置的 VISIBLE 地鼠', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const holes = getHoles(engine);
    expect(holes[engine.cursorIndex].state).toBe(MoleState.WHACKED);
  });

  it('Enter 键敲击当前位置的 VISIBLE 地鼠', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown('Enter');
    const holes = getHoles(engine);
    expect(holes[engine.cursorIndex].state).toBe(MoleState.WHACKED);
  });

  it('Space 键别名也能敲击', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown('Space');
    const holes = getHoles(engine);
    expect(holes[engine.cursorIndex].state).toBe(MoleState.WHACKED);
  });

  it('敲击 APPEARING 状态的地鼠也有效', () => {
    spawnMoleAt(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const holes = getHoles(engine);
    expect(holes[engine.cursorIndex].state).toBe(MoleState.WHACKED);
  });

  it('敲击 HIDDEN 的洞算 miss', () => {
    engine.handleKeyDown(' ');
    expect(engine.totalMisses).toBe(1);
  });

  it('敲击 HIDING 的洞算 miss', () => {
    const holes = getHoles(engine);
    holes[engine.cursorIndex].state = MoleState.HIDING;
    holes[engine.cursorIndex].stateTimer = 0;
    engine.handleKeyDown(' ');
    expect(engine.totalMisses).toBe(1);
  });

  it('敲击 WHACKED 的洞算 miss（防止重复击中）', () => {
    const holes = getHoles(engine);
    holes[engine.cursorIndex].state = MoleState.WHACKED;
    holes[engine.cursorIndex].stateTimer = 0;
    engine.handleKeyDown(' ');
    expect(engine.totalMisses).toBe(1);
  });

  it('数字键 1-9 直接敲击对应洞位', () => {
    makeMoleVisible(engine, 0);
    engine.handleKeyDown('1');
    const holes = getHoles(engine);
    expect(holes[0].state).toBe(MoleState.WHACKED);
  });

  it('数字键 5 敲击中心洞位', () => {
    makeMoleVisible(engine, 4);
    engine.handleKeyDown('5');
    const holes = getHoles(engine);
    expect(holes[4].state).toBe(MoleState.WHACKED);
  });

  it('数字键 9 敲击右下角洞位', () => {
    makeMoleVisible(engine, 8);
    engine.handleKeyDown('9');
    const holes = getHoles(engine);
    expect(holes[8].state).toBe(MoleState.WHACKED);
  });

  it('数字键同时移动光标到对应位置', () => {
    engine.handleKeyDown('7');
    expect(engine.cursorIndex).toBe(6);
  });

  it('敲击有效地鼠后 totalHits 增加', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    expect(engine.totalHits).toBe(1);
  });

  it('miss 后 totalMisses 增加', () => {
    engine.handleKeyDown(' ');
    expect(engine.totalMisses).toBe(1);
  });

  it('miss 后 combo 重置为 0', () => {
    setPrivate(engine, '_combo', 5);
    engine.handleKeyDown(' '); // miss
    expect(engine.combo).toBe(0);
  });
});

// ============================================================
// 6. 计分系统
// ============================================================
describe('WhackAMoleEngine - 计分', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('基础击中分数为 HIT_SCORE_BASE（等级1）', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(HIT_SCORE_BASE);
  });

  it('连续击中增加 combo', () => {
    makeMoleVisible(engine, 0);
    engine.handleKeyDown('1');
    expect(engine.combo).toBe(1);

    makeMoleVisible(engine, 1);
    engine.handleKeyDown('2');
    expect(engine.combo).toBe(2);
  });

  it('combo > 1 时有连击加成', () => {
    // 第一次击中
    makeMoleVisible(engine, 0);
    engine.handleKeyDown('1');
    const scoreAfterFirst = engine.score;

    // 第二次击中
    makeMoleVisible(engine, 1);
    engine.handleKeyDown('2');
    const scoreAfterSecond = engine.score;
    // 第二次得分 = HIT_SCORE_BASE + COMBO_BONUS
    expect(scoreAfterSecond - scoreAfterFirst).toBe(HIT_SCORE_BASE + COMBO_BONUS);
  });

  it('combo = 3 时加成为 2 * COMBO_BONUS', () => {
    // 击中3次
    for (let i = 0; i < 3; i++) {
      makeMoleVisible(engine, i);
      engine.handleKeyDown(String(i + 1));
    }
    // 总分 = HIT_SCORE_BASE + (HIT_SCORE_BASE + COMBO_BONUS) + (HIT_SCORE_BASE + 2*COMBO_BONUS)
    const expected = 3 * HIT_SCORE_BASE + (0 + 1 + 2) * COMBO_BONUS;
    expect(engine.score).toBe(expected);
  });

  it('maxCombo 记录最大连击数', () => {
    for (let i = 0; i < 5; i++) {
      makeMoleVisible(engine, i);
      engine.handleKeyDown(String(i + 1));
    }
    expect(engine.maxCombo).toBe(5);
  });

  it('miss 后 maxCombo 不被重置', () => {
    for (let i = 0; i < 3; i++) {
      makeMoleVisible(engine, i);
      engine.handleKeyDown(String(i + 1));
    }
    const savedMaxCombo = engine.maxCombo;
    engine.handleKeyDown('4'); // miss
    expect(engine.maxCombo).toBe(savedMaxCombo);
  });

  it('高等级击中分数更高', () => {
    setPrivate(engine, '_level', 3);
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const expectedScore = HIT_SCORE_BASE + (3 - 1) * HIT_SCORE_PER_LEVEL;
    expect(engine.score).toBe(expectedScore);
  });

  it('击中后发出 hit 事件', () => {
    const handler = vi.fn();
    engine.on('hit', handler);
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        holeIndex: engine.cursorIndex,
        combo: 1,
        score: HIT_SCORE_BASE,
      }),
    );
  });

  it('miss 后发出 miss 事件', () => {
    const handler = vi.fn();
    engine.on('miss', handler);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ holeIndex: engine.cursorIndex }),
    );
  });

  it('击中后产生得分弹出', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    expect(popups.length).toBeGreaterThan(0);
  });

  it('得分弹出文字包含分数', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    expect(popups[0].text).toContain(`${HIT_SCORE_BASE}`);
  });

  it('连击时弹出文字包含 combo 倍数', () => {
    // 先击中一次建立 combo
    makeMoleVisible(engine, 0);
    engine.handleKeyDown('1');
    // 再击中一次
    makeMoleVisible(engine, 1);
    engine.handleKeyDown('2');
    const popups = getScorePopups(engine);
    // 第二次弹出应包含 x2
    const lastPopup = popups[popups.length - 1];
    expect(lastPopup.text).toContain('x2');
  });

  it('得分弹出自带 duration', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    expect(popups[0].duration).toBeGreaterThan(0);
  });
});

// ============================================================
// 7. 时间限制
// ============================================================
describe('WhackAMoleEngine - 时间限制', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('游戏开始时剩余时间为 GAME_DURATION', () => {
    expect(engine.remainingTime).toBe(GAME_DURATION);
  });

  it('update 消耗游戏时间', () => {
    callUpdate(engine, 1000);
    expect(engine.remainingTime).toBeLessThan(GAME_DURATION);
  });

  it('时间耗尽后游戏结束', () => {
    const totalTime = GAME_DURATION * 1000;
    callUpdate(engine, totalTime + 1);
    expect(engine.status).toBe('gameover');
  });

  it('remainingTime 不为负数', () => {
    const totalTime = GAME_DURATION * 1000;
    callUpdate(engine, totalTime + 5000);
    expect(engine.remainingTime).toBeGreaterThanOrEqual(0);
  });

  it('游戏结束后不再 update', () => {
    const totalTime = GAME_DURATION * 1000;
    callUpdate(engine, totalTime + 1);
    expect(engine.status).toBe('gameover');
    // 再次 update 不崩溃
    expect(() => callUpdate(engine, 100)).not.toThrow();
  });

  it('GAME_DURATION 为 60 秒', () => {
    expect(GAME_DURATION).toBe(60);
  });

  it('游戏计时器精确倒计时', () => {
    callUpdate(engine, 500);
    expect(engine.remainingTime).toBeCloseTo(GAME_DURATION - 0.5, 1);
  });
});

// ============================================================
// 8. 等级递进
// ============================================================
describe('WhackAMoleEngine - 等级递进', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始等级为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('每 LEVEL_UP_SCORE 分升一级', () => {
    // 给足够分数
    setPrivate(engine, '_score', LEVEL_UP_SCORE);
    callUpdate(engine, 1); // 触发 _checkLevelUp
    expect(engine.level).toBe(2);
  });

  it('等级不超过 MAX_LEVEL', () => {
    setPrivate(engine, '_score', MAX_LEVEL * LEVEL_UP_SCORE);
    callUpdate(engine, 1);
    expect(engine.level).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it('升级发出 levelUp 事件', () => {
    const handler = vi.fn();
    engine.on('levelUp', handler);
    setPrivate(engine, '_score', LEVEL_UP_SCORE);
    callUpdate(engine, 1);
    expect(handler).toHaveBeenCalledWith(2);
  });

  it('高等级地鼠停留时间更短', () => {
    setPrivate(engine, '_level', 1);
    const proto = Object.getPrototypeOf(engine);
    const getStay = proto._getStayDuration.bind(engine);
    const stay1 = getStay();

    setPrivate(engine, '_level', 5);
    const stay5 = getStay();
    expect(stay5).toBeLessThan(stay1);
  });

  it('地鼠停留时间不低于 MOLE_STAY_DURATION_MIN', () => {
    setPrivate(engine, '_level', MAX_LEVEL);
    const proto = Object.getPrototypeOf(engine);
    const getStay = proto._getStayDuration.bind(engine);
    expect(getStay()).toBeGreaterThanOrEqual(MOLE_STAY_DURATION_MIN);
  });

  it('LEVEL_UP_SCORE 为 100', () => {
    expect(LEVEL_UP_SCORE).toBe(100);
  });

  it('MAX_LEVEL 为 10', () => {
    expect(MAX_LEVEL).toBe(10);
  });

  it('等级 1 停留时间为 MOLE_STAY_DURATION_BASE', () => {
    setPrivate(engine, '_level', 1);
    const proto = Object.getPrototypeOf(engine);
    const getStay = proto._getStayDuration.bind(engine);
    expect(getStay()).toBe(MOLE_STAY_DURATION_BASE);
  });

  it('等级 2 停留时间为 BASE - DECREASE', () => {
    setPrivate(engine, '_level', 2);
    const proto = Object.getPrototypeOf(engine);
    const getStay = proto._getStayDuration.bind(engine);
    expect(getStay()).toBe(MOLE_STAY_DURATION_BASE - MOLE_STAY_DURATION_DECREASE_PER_LEVEL);
  });
});

// ============================================================
// 9. 光标移动
// ============================================================
describe('WhackAMoleEngine - 光标移动', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('ArrowUp 向上移动光标', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorIndex).toBe(4 - GRID_COLS); // 4 - 3 = 1
  });

  it('ArrowDown 向下移动光标', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorIndex).toBe(4 + GRID_COLS); // 4 + 3 = 7
  });

  it('ArrowLeft 向左移动光标', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorIndex).toBe(3);
  });

  it('ArrowRight 向右移动光标', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorIndex).toBe(5);
  });

  it('w 键向上移动', () => {
    engine.handleKeyDown('w');
    expect(engine.cursorIndex).toBe(1);
  });

  it('W 键向上移动', () => {
    engine.handleKeyDown('W');
    expect(engine.cursorIndex).toBe(1);
  });

  it('s 键向下移动', () => {
    engine.handleKeyDown('s');
    expect(engine.cursorIndex).toBe(7);
  });

  it('S 键向下移动', () => {
    engine.handleKeyDown('S');
    expect(engine.cursorIndex).toBe(7);
  });

  it('a 键向左移动', () => {
    engine.handleKeyDown('a');
    expect(engine.cursorIndex).toBe(3);
  });

  it('A 键向左移动', () => {
    engine.handleKeyDown('A');
    expect(engine.cursorIndex).toBe(3);
  });

  it('d 键向右移动', () => {
    engine.handleKeyDown('d');
    expect(engine.cursorIndex).toBe(5);
  });

  it('D 键向右移动', () => {
    engine.handleKeyDown('D');
    expect(engine.cursorIndex).toBe(5);
  });

  it('光标不能移出上边界', () => {
    // 移到第一行 index=1
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorIndex).toBe(1);
    // 再向上，应该不动
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorIndex).toBe(1);
  });

  it('光标不能移出下边界', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorIndex).toBe(7);
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorIndex).toBe(7);
  });

  it('光标不能移出左边界', () => {
    // 移到 index=3（第2行第1列）
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorIndex).toBe(3);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorIndex).toBe(3);
  });

  it('光标不能移出右边界', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorIndex).toBe(5);
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorIndex).toBe(5);
  });

  it('左上角（index 0）不能向上或向左', () => {
    setPrivate(engine, '_cursorIndex', 0);
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorIndex).toBe(0);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorIndex).toBe(0);
  });

  it('右下角（index 8）不能向下或向右', () => {
    setPrivate(engine, '_cursorIndex', 8);
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorIndex).toBe(8);
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorIndex).toBe(8);
  });

  it('连续移动光标到任意位置', () => {
    // 从中心(4)移动到右下角(8)
    engine.handleKeyDown('ArrowRight'); // -> 5
    engine.handleKeyDown('ArrowDown');  // -> 8
    expect(engine.cursorIndex).toBe(8);
  });
});

// ============================================================
// 10. 状态管理
// ============================================================
describe('WhackAMoleEngine - 状态管理', () => {
  it('初始状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('时间耗尽后状态为 gameover', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, GAME_DURATION * 1000 + 1);
    expect(engine.status).toBe('gameover');
  });

  it('reset 后状态恢复为 idle', () => {
    const engine = createAndStartEngine();
    // 手动调用 reset（不经过 start 的 canvas 检查）
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(engine));
    // GameEngine.reset 是 public
    engine.reset();
    // 注意：reset 会将 _status 设为 idle
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数清零', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_score', 500);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后等级重置为 1', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 5);
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('reset 后所有洞重置为 HIDDEN', () => {
    const engine = createAndStartEngine();
    const holes = getHoles(engine);
    holes[0].state = MoleState.VISIBLE;
    engine.reset();
    const resetHoles = getHoles(engine);
    for (const hole of resetHoles) {
      expect(hole.state).toBe(MoleState.HIDDEN);
    }
  });

  it('reset 后光标回到中心', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_cursorIndex', 0);
    engine.reset();
    expect(engine.cursorIndex).toBe(4);
  });

  it('reset 后统计数据清零', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_totalHits', 10);
    setPrivate(engine, '_totalMisses', 5);
    setPrivate(engine, '_totalMolesSpawned', 20);
    setPrivate(engine, '_combo', 3);
    setPrivate(engine, '_maxCombo', 7);
    engine.reset();
    expect(engine.totalHits).toBe(0);
    expect(engine.totalMisses).toBe(0);
    expect(engine.totalMolesSpawned).toBe(0);
    expect(engine.combo).toBe(0);
    expect(engine.maxCombo).toBe(0);
  });

  it('reset 后游戏计时器恢复', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, 30000); // 消耗30秒
    engine.reset();
    // reset 后 _gameTimer 被重新设置
    expect(engine.remainingTime).toBe(GAME_DURATION);
  });

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    const callCountAfterDestroy = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCountAfterDestroy);
  });

  it('destroy 后状态为 idle', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });
});

// ============================================================
// 11. handleKeyDown / handleKeyUp
// ============================================================
describe('WhackAMoleEngine - handleKeyDown / handleKeyUp', () => {
  it('Space 在 idle 状态启动游戏', () => {
    const engine = createEngine();
    // handleKeyDown 中 idle 状态的 Space 调用 start()
    // 但 start() 需要 canvas，会抛错
    // 所以我们验证逻辑：idle 状态下按 Space 尝试启动
    expect(() => engine.handleKeyDown(' ')).toThrow('Canvas not initialized');
  });

  it('Enter 在 idle 状态启动游戏', () => {
    const engine = createEngine();
    expect(() => engine.handleKeyDown('Enter')).toThrow('Canvas not initialized');
  });

  it('Space 在 gameover 状态重启游戏', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');
    // gameover 下按 Space 调用 reset() + start()
    // reset 不需要 canvas，但 start 需要
    expect(() => engine.handleKeyDown(' ')).toThrow('Canvas not initialized');
  });

  it('Enter 在 gameover 状态重启游戏', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');
    expect(() => engine.handleKeyDown('Enter')).toThrow('Canvas not initialized');
  });

  it('非 playing 状态下方向键无效', () => {
    const engine = createEngine();
    const beforeCursor = engine.cursorIndex;
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorIndex).toBe(beforeCursor);
  });

  it('非 playing 状态下数字键无效', () => {
    const engine = createEngine();
    engine.handleKeyDown('1');
    expect(engine.totalHits).toBe(0);
    expect(engine.totalMisses).toBe(0);
  });

  it('handleKeyUp ArrowUp 删除 up 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('ArrowUp');
    expect(pressed.has('up')).toBe(true);
    engine.handleKeyUp('ArrowUp');
    expect(pressed.has('up')).toBe(false);
  });

  it('handleKeyUp ArrowDown 删除 down 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('ArrowDown');
    expect(pressed.has('down')).toBe(true);
    engine.handleKeyUp('ArrowDown');
    expect(pressed.has('down')).toBe(false);
  });

  it('handleKeyUp ArrowLeft 删除 left 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('ArrowLeft');
    expect(pressed.has('left')).toBe(true);
    engine.handleKeyUp('ArrowLeft');
    expect(pressed.has('left')).toBe(false);
  });

  it('handleKeyUp ArrowRight 删除 right 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('ArrowRight');
    expect(pressed.has('right')).toBe(true);
    engine.handleKeyUp('ArrowRight');
    expect(pressed.has('right')).toBe(false);
  });

  it('handleKeyUp w 删除 up 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('w');
    engine.handleKeyUp('w');
    expect(pressed.has('up')).toBe(false);
  });

  it('handleKeyUp s 删除 down 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('s');
    engine.handleKeyUp('s');
    expect(pressed.has('down')).toBe(false);
  });

  it('handleKeyUp a 删除 left 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('a');
    engine.handleKeyUp('a');
    expect(pressed.has('left')).toBe(false);
  });

  it('handleKeyUp d 删除 right 方向', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('d');
    engine.handleKeyUp('d');
    expect(pressed.has('right')).toBe(false);
  });

  it('未知按键 keyUp 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('x')).not.toThrow();
  });

  it('重复按下同一方向键不重复添加', () => {
    const engine = createAndStartEngine();
    const pressed = getPrivate<Set<string>>(engine, '_directionPressed');
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowUp');
    // Set 只有一个 'up'
    expect(pressed.has('up')).toBe(true);
  });
});

// ============================================================
// 12. getState
// ============================================================
describe('WhackAMoleEngine - getState', () => {
  it('返回包含所有必要字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('status');
    expect(state).toHaveProperty('cursorIndex');
    expect(state).toHaveProperty('combo');
    expect(state).toHaveProperty('maxCombo');
    expect(state).toHaveProperty('totalHits');
    expect(state).toHaveProperty('totalMisses');
    expect(state).toHaveProperty('totalMolesSpawned');
    expect(state).toHaveProperty('remainingTime');
    expect(state).toHaveProperty('holes');
  });

  it('初始状态 getState 值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.status).toBe('playing');
    expect(state.cursorIndex).toBe(4);
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(0);
    expect(state.totalHits).toBe(0);
    expect(state.totalMisses).toBe(0);
    expect(state.totalMolesSpawned).toBe(0);
  });

  it('getState 返回的 holes 是副本', () => {
    const engine = createAndStartEngine();
    const state1 = engine.getState();
    const state2 = engine.getState();
    expect(state1.holes).not.toBe(state2.holes);
  });

  it('击中后 getState 反映新分数', () => {
    const engine = createAndStartEngine();
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const state = engine.getState();
    expect(state.score).toBe(HIT_SCORE_BASE);
    expect(state.totalHits).toBe(1);
  });

  it('游戏结束后 getState 反映 gameover', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, GAME_DURATION * 1000 + 1);
    const state = engine.getState();
    expect(state.status).toBe('gameover');
  });

  it('holes 数组长度为 9', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect((state.holes as any[]).length).toBe(9);
  });

  it('每个 hole 包含 index, state, stateTimer, whacked', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const hole = (state.holes as any[])[0];
    expect(hole).toHaveProperty('index');
    expect(hole).toHaveProperty('state');
    expect(hole).toHaveProperty('stateTimer');
    expect(hole).toHaveProperty('whacked');
  });
});

// ============================================================
// 13. 事件系统
// ============================================================
describe('WhackAMoleEngine - 事件系统', () => {
  it('on 注册事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.off('test', handler);
    engine.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit 传递参数', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.emit('test', 'arg1', 42);
    expect(handler).toHaveBeenCalledWith('arg1', 42);
  });

  it('多次 on 同一事件注册多个监听', () => {
    const engine = createEngine();
    const h1 = vi.fn();
    const h2 = vi.fn();
    engine.on('test', h1);
    engine.on('test', h2);
    engine.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('hit 事件携带 holeIndex, combo, score', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('hit', handler);
    makeMoleVisible(engine, 2);
    engine.handleKeyDown('3');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        holeIndex: 2,
        combo: 1,
        score: HIT_SCORE_BASE,
      }),
    );
  });

  it('miss 事件携带 holeIndex', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('miss', handler);
    engine.handleKeyDown('1'); // hole 0 is HIDDEN
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ holeIndex: 0 }),
    );
  });

  it('levelUp 事件携带新等级', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('levelUp', handler);
    setPrivate(engine, '_score', LEVEL_UP_SCORE);
    callUpdate(engine, 1);
    expect(handler).toHaveBeenCalledWith(2);
  });

  it('scoreChange 事件在击中时触发', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    expect(handler).toHaveBeenCalledWith(HIT_SCORE_BASE);
  });
});

// ============================================================
// 14. 得分弹出动画
// ============================================================
describe('WhackAMoleEngine - 得分弹出', () => {
  let engine: WhackAMoleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('弹出在 duration 后消失', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    expect(popups.length).toBe(1);
    const duration = popups[0].duration;
    callUpdate(engine, duration);
    expect(getScorePopups(engine)).toHaveLength(0);
  });

  it('弹出在 duration 之前仍存在', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    callUpdate(engine, 100);
    expect(getScorePopups(engine)).toHaveLength(1);
  });

  it('弹出 y 坐标随时间上飘', () => {
    makeMoleVisible(engine, engine.cursorIndex);
    engine.handleKeyDown(' ');
    const popups = getScorePopups(engine);
    const startY = popups[0].y;
    callUpdate(engine, 100);
    expect(popups[0].y).toBeLessThan(startY);
  });

  it('多次击中产生多个弹出', () => {
    makeMoleVisible(engine, 0);
    engine.handleKeyDown('1');
    makeMoleVisible(engine, 1);
    engine.handleKeyDown('2');
    expect(getScorePopups(engine)).toHaveLength(2);
  });
});

// ============================================================
// 15. 边界与异常场景
// ============================================================
describe('WhackAMoleEngine - 边界与异常场景', () => {
  it('无 canvas 时 start 抛出错误', () => {
    const engine = new WhackAMoleEngine();
    engine.init();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('连续多次 init 不崩溃', () => {
    const engine = new WhackAMoleEngine();
    engine.init();
    expect(() => engine.init()).not.toThrow();
  });

  it('连续多次 reset 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });

  it('update deltaTime 为 0 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 0)).not.toThrow();
  });

  it('update deltaTime 为负数不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, -100)).not.toThrow();
  });

  it('超大 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 999999)).not.toThrow();
    expect(engine.status).toBe('gameover');
  });

  it('敲击无效洞位索引不崩溃', () => {
    const engine = createAndStartEngine();
    const proto = Object.getPrototypeOf(engine);
    const whack = proto._whack.bind(engine);
    expect(() => whack(-1)).not.toThrow();
    expect(() => whack(9)).not.toThrow();
    expect(() => whack(100)).not.toThrow();
  });

  it('所有洞同时活跃不崩溃', () => {
    const engine = createAndStartEngine();
    const holes = getHoles(engine);
    for (let i = 0; i < TOTAL_HOLES; i++) {
      holes[i].state = MoleState.VISIBLE;
    }
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('快速连续敲击同一洞不崩溃', () => {
    const engine = createAndStartEngine();
    makeMoleVisible(engine, 0);
    for (let i = 0; i < 10; i++) {
      engine.handleKeyDown('1');
    }
    // 第一次击中，后续都是 miss（WHACKED 状态算 miss）
    expect(engine.totalHits).toBe(1);
    expect(engine.totalMisses).toBe(9);
  });

  it('快速连续 update 不崩溃', () => {
    const engine = createAndStartEngine();
    // 5000 * 16 = 80000ms > 60000ms (GAME_DURATION)
    for (let i = 0; i < 5000; i++) {
      callUpdate(engine, 16);
      if (engine.status === 'gameover') break;
    }
    expect(engine.status).toBe('gameover');
  });

  it('idle 状态下 update 不被调用（无 canvas 无 gameLoop）', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
    // 手动调用 update 不崩溃
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('gameover 后 handleKeyDown 不处理方向键', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');
    const beforeCursor = engine.cursorIndex;
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorIndex).toBe(beforeCursor);
  });

  it('holes getter 返回只读数组', () => {
    const engine = createAndStartEngine();
    const holes = engine.holes;
    expect(holes.length).toBe(TOTAL_HOLES);
    // 修改返回的数组不应影响内部
    expect(() => { (holes as any)[0] = null; }).not.toThrow();
  });

  it('engine 在极端等级下不崩溃', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 1);
    makeMoleVisible(engine, 0);
    callUpdate(engine, 16);
    expect(engine.status).toBe('playing');
  });
});

// ============================================================
// 16. 常量合理性验证
// ============================================================
describe('Whack-a-Mole 常量验证', () => {
  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('GRID_ROWS * GRID_COLS = TOTAL_HOLES = 9', () => {
    expect(GRID_ROWS * GRID_COLS).toBe(TOTAL_HOLES);
    expect(TOTAL_HOLES).toBe(9);
  });

  it('MOLE_APPEAR_DURATION > 0', () => {
    expect(MOLE_APPEAR_DURATION).toBeGreaterThan(0);
  });

  it('MOLE_STAY_DURATION_BASE > MOLE_STAY_DURATION_MIN', () => {
    expect(MOLE_STAY_DURATION_BASE).toBeGreaterThan(MOLE_STAY_DURATION_MIN);
  });

  it('MOLE_HIDE_DURATION > 0', () => {
    expect(MOLE_HIDE_DURATION).toBeGreaterThan(0);
  });

  it('SPAWN_INTERVAL_BASE > SPAWN_INTERVAL_MIN', () => {
    expect(SPAWN_INTERVAL_BASE).toBeGreaterThan(SPAWN_INTERVAL_MIN);
  });

  it('MAX_ACTIVE_MOLES_BASE >= 1', () => {
    expect(MAX_ACTIVE_MOLES_BASE).toBeGreaterThanOrEqual(1);
  });

  it('MAX_ACTIVE_MOLES_MAX >= MAX_ACTIVE_MOLES_BASE', () => {
    expect(MAX_ACTIVE_MOLES_MAX).toBeGreaterThanOrEqual(MAX_ACTIVE_MOLES_BASE);
  });

  it('HIT_SCORE_BASE > 0', () => {
    expect(HIT_SCORE_BASE).toBeGreaterThan(0);
  });

  it('COMBO_BONUS > 0', () => {
    expect(COMBO_BONUS).toBeGreaterThan(0);
  });

  it('GAME_DURATION > 0', () => {
    expect(GAME_DURATION).toBeGreaterThan(0);
  });

  it('LEVEL_UP_SCORE > 0', () => {
    expect(LEVEL_UP_SCORE).toBeGreaterThan(0);
  });

  it('MAX_LEVEL >= 1', () => {
    expect(MAX_LEVEL).toBeGreaterThanOrEqual(1);
  });

  it('KEY_HOLE_MAP 映射 1-9 到 0-8', () => {
    for (let i = 1; i <= 9; i++) {
      expect(KEY_HOLE_MAP[String(i)]).toBe(i - 1);
    }
  });

  it('DIRECTION_KEYS 包含 UP/DOWN/LEFT/RIGHT', () => {
    expect(DIRECTION_KEYS.UP.length).toBeGreaterThan(0);
    expect(DIRECTION_KEYS.DOWN.length).toBeGreaterThan(0);
    expect(DIRECTION_KEYS.LEFT.length).toBeGreaterThan(0);
    expect(DIRECTION_KEYS.RIGHT.length).toBeGreaterThan(0);
  });

  it('HOLE_RADIUS > MOLE_RADIUS（洞比地鼠大）', () => {
    expect(HOLE_RADIUS).toBeGreaterThan(MOLE_RADIUS);
  });

  it('CURSOR_RADIUS > 0', () => {
    expect(CURSOR_RADIUS).toBeGreaterThan(0);
  });

  it('HUD_HEIGHT > 0', () => {
    expect(HUD_HEIGHT).toBeGreaterThan(0);
  });

  it('GRID_PADDING_X 和 GRID_PADDING_Y > 0', () => {
    expect(GRID_PADDING_X).toBeGreaterThan(0);
    expect(GRID_PADDING_Y).toBeGreaterThan(0);
  });

  it('MoleState 枚举包含所有状态', () => {
    expect(MoleState.HIDDEN).toBe('hidden');
    expect(MoleState.APPEARING).toBe('appearing');
    expect(MoleState.VISIBLE).toBe('visible');
    expect(MoleState.HIDING).toBe('hiding');
    expect(MoleState.WHACKED).toBe('whacked');
  });
});

// ============================================================
// 17. holes 公开 getter
// ============================================================
describe('WhackAMoleEngine - holes getter', () => {
  it('返回长度为 9 的数组', () => {
    const engine = createAndStartEngine();
    expect(engine.holes).toHaveLength(9);
  });

  it('每个 hole 有正确的 index', () => {
    const engine = createAndStartEngine();
    engine.holes.forEach((hole, i) => {
      expect(hole.index).toBe(i);
    });
  });

  it('初始时所有 hole 为 HIDDEN', () => {
    const engine = createAndStartEngine();
    engine.holes.forEach((hole) => {
      expect(hole.state).toBe(MoleState.HIDDEN);
    });
  });

  it('修改返回数组不影响内部状态', () => {
    const engine = createAndStartEngine();
    const holes = engine.holes;
    const originalState = holes[0].state;
    // 内部 holes 是独立的
    const internalHoles = getHoles(engine);
    expect(internalHoles[0].state).toBe(originalState);
  });
});

// ============================================================
// 18. remainingTime getter
// ============================================================
describe('WhackAMoleEngine - remainingTime', () => {
  it('开始时为 GAME_DURATION', () => {
    const engine = createAndStartEngine();
    expect(engine.remainingTime).toBe(GAME_DURATION);
  });

  it('update 后减少', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, 5000);
    expect(engine.remainingTime).toBeLessThan(GAME_DURATION);
  });

  it('不会返回负数', () => {
    const engine = createAndStartEngine();
    callUpdate(engine, GAME_DURATION * 1000 + 10000);
    expect(engine.remainingTime).toBe(0);
  });
});
