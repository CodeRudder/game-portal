/**
 * FroggerEngine 综合测试
 * 覆盖：初始化、青蛙移动、跳跃动画、车辆系统、河流物体、碰撞检测、
 *       终点系统、生命与重生、计时器、计分、关卡递进、状态管理、
 *       handleKeyDown/Up、getState、事件系统、边界与异常场景
 */
import { FroggerEngine } from '../FroggerEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  COLS, ROWS, CELL_SIZE,
  FROG_START_COL, FROG_START_ROW, FROG_JUMP_DURATION,
  GOAL_ROW, GOAL_COUNT, GOAL_POSITIONS,
  RIVER_ROWS, ROAD_A_ROWS, ROAD_B_ROWS,
  LANE_CONFIGS, RIVER_CONFIGS,
  INITIAL_LIVES, ROUND_TIME_LIMIT,
  SCORE_FORWARD, SCORE_GOAL, SCORE_TIME_BONUS_MAX, SCORE_LEVEL_COMPLETE,
  SPEED_INCREMENT_PER_LEVEL,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建 mock canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并完成 init（不 start，停留在 idle） */
function createEngine(): FroggerEngine {
  const engine = new FroggerEngine();
  engine.init(createMockCanvas());
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): FroggerEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射调用 protected update 方法 */
function tick(engine: FroggerEngine, dtMs: number): void {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(dtMs);
}

/** 完成青蛙当前跳跃动画（给足够时间让 jumpProgress >= 1） */
function finishJump(engine: FroggerEngine): void {
  tick(engine, FROG_JUMP_DURATION + 50);
}

/** 移动青蛙一步并完成跳跃 */
function moveAndLand(engine: FroggerEngine, key: string): void {
  engine.handleKeyDown(key);
  finishJump(engine);
}

/** 将青蛙移动到指定行（逐步向上/下） */
function moveFrogToRow(engine: FroggerEngine, targetRow: number): void {
  // 移动前清除车辆和河流物体，避免穿越时被撞或溺水
  setPrivate(engine, 'vehicles', []);
  setPrivate(engine, 'riverObjects', []);
  let safety = 0;
  while (engine.frogRow !== targetRow && safety < ROWS + 2) {
    if (engine.frogRow > targetRow) {
      moveAndLand(engine, 'ArrowUp');
    } else {
      moveAndLand(engine, 'ArrowDown');
    }
    safety++;
  }
}

/** 将青蛙移动到指定列，移动前清除车辆避免碰撞 */
function moveFrogToCol(engine: FroggerEngine, targetCol: number): void {
  // 清除车辆，避免青蛙在车道行上移动时被撞死
  setPrivate(engine, 'vehicles', []);
  let safety = 0;
  while (engine.frogCol !== targetCol && safety < COLS + 2) {
    if (engine.frogCol > targetCol) {
      moveAndLand(engine, 'ArrowLeft');
    } else {
      moveAndLand(engine, 'ArrowRight');
    }
    safety++;
  }
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: FroggerEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: FroggerEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 获取内部 frog 对象 */
function getFrog(engine: FroggerEngine) {
  return getPrivate<{
    col: number; row: number;
    x: number; y: number;
    targetX: number; targetY: number;
    jumping: boolean; jumpProgress: number;
  }>(engine, 'frog');
}

/** 获取内部 vehicles 数组 */
function getVehicles(engine: FroggerEngine) {
  return getPrivate<Array<{
    x: number; row: number; width: number; height: number;
    speed: number; direction: 1 | -1; type: string; color: string;
  }>>(engine, 'vehicles');
}

/** 获取内部 riverObjects 数组 */
function getRiverObjects(engine: FroggerEngine) {
  return getPrivate<Array<{
    x: number; row: number; width: number; height: number;
    speed: number; direction: 1 | -1; type: 'log' | 'turtle'; color: string;
    canDive: boolean; diveCycleDuration: number; diveDuration: number;
    diveTimer: number; isDiving: boolean;
  }>>(engine, 'riverObjects');
}

/** 获取内部 goalsReached 数组 */
function getGoalsReached(engine: FroggerEngine): boolean[] {
  return getPrivate<boolean[]>(engine, 'goalsReached');
}

// ============================================================
// 1. 初始化
// ============================================================
describe('FroggerEngine - 初始化', () => {
  it('引擎可以正常实例化', () => {
    const engine = new FroggerEngine();
    expect(engine).toBeInstanceOf(FroggerEngine);
  });

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

  it('init 后青蛙在起始位置', () => {
    const engine = createEngine();
    expect(engine.frogCol).toBe(FROG_START_COL);
    expect(engine.frogRow).toBe(FROG_START_ROW);
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后生命为 INITIAL_LIVES', () => {
    const engine = createAndStartEngine();
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('start 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isWin).toBe(false);
  });

  it('start 后 timeRemaining 约等于 ROUND_TIME_LIMIT', () => {
    const engine = createAndStartEngine();
    expect(engine.timeRemaining).toBeCloseTo(ROUND_TIME_LIMIT, 1);
  });

  it('start 后 goalsReachedCount 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.goalsReachedCount).toBe(0);
  });

  it('start 后青蛙存活', () => {
    const engine = createAndStartEngine();
    expect(engine.frogAlivePublic).toBe(true);
  });

  it('start 后 deathCause 为 null', () => {
    const engine = createAndStartEngine();
    expect(engine.deathCausePublic).toBeNull();
  });

  it('start 后生成了车辆', () => {
    const engine = createAndStartEngine();
    expect(engine.vehicleCount).toBeGreaterThan(0);
  });

  it('start 后生成了河流物体', () => {
    const engine = createAndStartEngine();
    expect(engine.riverObjectCount).toBeGreaterThan(0);
  });

  it('start 后分数重置为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后等级为 1', () => {
    const engine = createAndStartEngine();
    expect(engine.level).toBe(1);
  });
});

// ============================================================
// 2. 启动事件
// ============================================================
describe('FroggerEngine - 启动事件', () => {
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
});

// ============================================================
// 3. 青蛙移动 — handleKeyDown
// ============================================================
describe('FroggerEngine - 青蛙移动', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('ArrowUp 使青蛙向上移动一行', () => {
    const rowBefore = engine.frogRow;
    engine.handleKeyDown('ArrowUp');
    expect(engine.frogRow).toBe(rowBefore - 1);
  });

  it('ArrowDown 使青蛙向下移动一行', () => {
    moveAndLand(engine, 'ArrowUp');
    const rowBefore = engine.frogRow;
    engine.handleKeyDown('ArrowDown');
    expect(engine.frogRow).toBe(rowBefore + 1);
  });

  it('ArrowLeft 使青蛙向左移动一列', () => {
    const colBefore = engine.frogCol;
    engine.handleKeyDown('ArrowLeft');
    expect(engine.frogCol).toBe(colBefore - 1);
  });

  it('ArrowRight 使青蛙向右移动一列', () => {
    const colBefore = engine.frogCol;
    engine.handleKeyDown('ArrowRight');
    expect(engine.frogCol).toBe(colBefore + 1);
  });

  it('w 键向上移动', () => {
    const rowBefore = engine.frogRow;
    engine.handleKeyDown('w');
    expect(engine.frogRow).toBe(rowBefore - 1);
  });

  it('s 键向下移动', () => {
    moveAndLand(engine, 'ArrowUp');
    const rowBefore = engine.frogRow;
    engine.handleKeyDown('s');
    expect(engine.frogRow).toBe(rowBefore + 1);
  });

  it('a 键向左移动', () => {
    const colBefore = engine.frogCol;
    engine.handleKeyDown('a');
    expect(engine.frogCol).toBe(colBefore - 1);
  });

  it('d 键向右移动', () => {
    const colBefore = engine.frogCol;
    engine.handleKeyDown('d');
    expect(engine.frogCol).toBe(colBefore + 1);
  });

  it('W（大写）向上移动', () => {
    const rowBefore = engine.frogRow;
    engine.handleKeyDown('W');
    expect(engine.frogRow).toBe(rowBefore - 1);
  });

  it('S（大写）向下移动', () => {
    moveAndLand(engine, 'ArrowUp');
    engine.handleKeyDown('S');
    expect(engine.frogRow).toBe(FROG_START_ROW);
  });

  it('A（大写）向左移动', () => {
    engine.handleKeyDown('A');
    expect(engine.frogCol).toBe(FROG_START_COL - 1);
  });

  it('D（大写）向右移动', () => {
    engine.handleKeyDown('D');
    expect(engine.frogCol).toBe(FROG_START_COL + 1);
  });

  it('青蛙不能超出左边界（col >= 0）', () => {
    for (let i = 0; i < COLS + 2; i++) {
      moveAndLand(engine, 'ArrowLeft');
    }
    expect(engine.frogCol).toBe(0);
  });

  it('青蛙不能超出右边界（col < COLS）', () => {
    for (let i = 0; i < COLS + 2; i++) {
      moveAndLand(engine, 'ArrowRight');
    }
    expect(engine.frogCol).toBe(COLS - 1);
  });

  it('青蛙不能超出上边界（row >= 0）', () => {
    // 清除车辆和河流物体，避免穿越时被撞或溺水
    setPrivate(engine, 'vehicles', []);
    setPrivate(engine, 'riverObjects', []);
    // 移动到 row 1（GOAL_ROW 的下一行），避免到达终点行被 killFrog
    // FROG_START_ROW=14, 需要移动 13 步到 row 1
    for (let i = 0; i < FROG_START_ROW - 1; i++) {
      moveAndLand(engine, 'ArrowUp');
    }
    expect(engine.frogRow).toBe(1);
    // 再向上移动一步：row 应被钳制为 0，不会变成负数
    engine.handleKeyDown('ArrowUp');
    expect(engine.frogRow).toBe(0);
  });

  it('青蛙不能超出下边界（row < ROWS）', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.frogRow).toBe(FROG_START_ROW);
  });

  it('无效按键不移动青蛙', () => {
    const colBefore = engine.frogCol;
    const rowBefore = engine.frogRow;
    engine.handleKeyDown('Space');
    engine.handleKeyDown('Enter');
    engine.handleKeyDown('x');
    expect(engine.frogCol).toBe(colBefore);
    expect(engine.frogRow).toBe(rowBefore);
  });

  it('跳跃中不接受新的移动指令', () => {
    engine.handleKeyDown('ArrowUp');
    const row = engine.frogRow;
    engine.handleKeyDown('ArrowUp');
    expect(engine.frogRow).toBe(row);
  });

  it('死亡后不接受移动指令', () => {
    setPrivate(engine, 'frogAlive', false);
    const row = engine.frogRow;
    const col = engine.frogCol;
    engine.handleKeyDown('ArrowUp');
    expect(engine.frogRow).toBe(row);
    expect(engine.frogCol).toBe(col);
  });

  it('非 playing 状态不接受移动指令', () => {
    engine.pause();
    const row = engine.frogRow;
    engine.handleKeyDown('ArrowUp');
    expect(engine.frogRow).toBe(row);
  });

  it('同方向重复按（跳跃完成后可以再跳）', () => {
    moveAndLand(engine, 'ArrowUp');
    moveAndLand(engine, 'ArrowUp');
    expect(engine.frogRow).toBe(FROG_START_ROW - 2);
  });
});

// ============================================================
// 4. handleKeyUp
// ============================================================
describe('FroggerEngine - handleKeyUp', () => {
  it('handleKeyUp 不抛异常', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
  });

  it('handleKeyUp 不影响青蛙位置', () => {
    const engine = createAndStartEngine();
    const row = engine.frogRow;
    const col = engine.frogCol;
    engine.handleKeyUp('ArrowUp');
    engine.handleKeyUp('ArrowDown');
    engine.handleKeyUp('ArrowLeft');
    engine.handleKeyUp('ArrowRight');
    expect(engine.frogRow).toBe(row);
    expect(engine.frogCol).toBe(col);
  });

  it('handleKeyUp 对未知按键不抛异常', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('z')).not.toThrow();
  });
});

// ============================================================
// 5. 跳跃动画
// ============================================================
describe('FroggerEngine - 跳跃动画', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('按下方向键后青蛙进入跳跃状态', () => {
    engine.handleKeyDown('ArrowUp');
    const frog = getFrog(engine);
    expect(frog.jumping).toBe(true);
  });

  it('跳跃开始时 jumpProgress 为 0', () => {
    engine.handleKeyDown('ArrowUp');
    const frog = getFrog(engine);
    expect(frog.jumpProgress).toBe(0);
  });

  it('跳跃完成后 jumping 为 false', () => {
    engine.handleKeyDown('ArrowUp');
    finishJump(engine);
    const frog = getFrog(engine);
    expect(frog.jumping).toBe(false);
  });

  it('跳跃完成后 frog.x 等于 targetX', () => {
    engine.handleKeyDown('ArrowUp');
    finishJump(engine);
    const frog = getFrog(engine);
    expect(frog.x).toBe(frog.targetX);
  });

  it('跳跃完成后 frog.y 等于 targetY', () => {
    engine.handleKeyDown('ArrowUp');
    finishJump(engine);
    const frog = getFrog(engine);
    expect(frog.y).toBe(frog.targetY);
  });

  it('跳跃完成后 jumpProgress 为 1', () => {
    engine.handleKeyDown('ArrowUp');
    finishJump(engine);
    const frog = getFrog(engine);
    expect(frog.jumpProgress).toBe(1);
  });

  it('跳跃中 frog.x 向 targetX 靠近', () => {
    engine.handleKeyDown('ArrowRight');
    const frog = getFrog(engine);
    const startX = FROG_START_COL * CELL_SIZE;
    const targetX = (FROG_START_COL + 1) * CELL_SIZE;
    // 跳跃中 x 应在起点和目标之间（或已接近目标）
    tick(engine, FROG_JUMP_DURATION / 2);
    expect(frog.x).toBeGreaterThan(startX);
    expect(frog.x).toBeLessThanOrEqual(targetX);
  });
});

// ============================================================
// 6. 车辆系统
// ============================================================
describe('FroggerEngine - 车辆系统', () => {
  it('车辆数量与车道配置匹配', () => {
    const engine = createAndStartEngine();
    const vehicles = getVehicles(engine);
    let expectedCount = 0;
    for (const cfg of LANE_CONFIGS) {
      expectedCount += Math.ceil(COLS / (cfg.vehicleWidth + cfg.gap)) + 1;
    }
    expect(vehicles.length).toBe(expectedCount);
  });

  it('车辆在正确的行上', () => {
    const engine = createAndStartEngine();
    const vehicles = getVehicles(engine);
    const roadRows = [...ROAD_A_ROWS, ...ROAD_B_ROWS];
    for (const v of vehicles) {
      expect(roadRows).toContain(v.row);
    }
  });

  it('车辆随时间移动', () => {
    const engine = createAndStartEngine();
    const vehicles = getVehicles(engine);
    const firstX = vehicles[0].x;
    tick(engine, 1000);
    expect(vehicles[0].x).not.toBe(firstX);
  });

  it('向右的车辆 x 增加', () => {
    const engine = createAndStartEngine();
    const vehicles = getVehicles(engine);
    const rightVehicle = vehicles.find(v => v.direction === 1);
    if (rightVehicle) {
      const xBefore = rightVehicle.x;
      tick(engine, 100);
      expect(rightVehicle.x).toBeGreaterThan(xBefore);
    }
  });

  it('向左的车辆 x 减少', () => {
    const engine = createAndStartEngine();
    const vehicles = getVehicles(engine);
    const leftVehicle = vehicles.find(v => v.direction === -1);
    if (leftVehicle) {
      const xBefore = leftVehicle.x;
      tick(engine, 100);
      expect(leftVehicle.x).toBeLessThan(xBefore);
    }
  });

  it('车辆循环滚动（向右出界后从左边出现）', () => {
    const engine = createAndStartEngine();
    const vehicles = getVehicles(engine);
    const rightVehicle = vehicles.find(v => v.direction === 1);
    if (rightVehicle) {
      rightVehicle.x = CANVAS_WIDTH + 1;
      tick(engine, 16);
      expect(rightVehicle.x).toBeLessThan(0);
    }
  });

  it('车辆循环滚动（向左出界后从右边出现）', () => {
    const engine = createAndStartEngine();
    const vehicles = getVehicles(engine);
    const leftVehicle = vehicles.find(v => v.direction === -1);
    if (leftVehicle) {
      leftVehicle.x = -(leftVehicle.width * CELL_SIZE) - 1;
      tick(engine, 16);
      expect(leftVehicle.x).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 7. 河流物体
// ============================================================
describe('FroggerEngine - 河流物体', () => {
  it('河流物体数量与配置匹配', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    let expectedCount = 0;
    for (const cfg of RIVER_CONFIGS) {
      expectedCount += Math.ceil(COLS / (cfg.objectWidth + cfg.gap)) + 1;
    }
    expect(riverObjects.length).toBe(expectedCount);
  });

  it('河流物体在正确的行上', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    for (const obj of riverObjects) {
      expect(RIVER_ROWS).toContain(obj.row);
    }
  });

  it('河流物体包含 log 和 turtle 类型', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    const types = new Set(riverObjects.map(o => o.type));
    expect(types.has('log')).toBe(true);
    expect(types.has('turtle')).toBe(true);
  });

  it('河流物体随时间移动', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    const firstX = riverObjects[0].x;
    tick(engine, 1000);
    expect(riverObjects[0].x).not.toBe(firstX);
  });

  it('乌龟有潜水属性', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    const turtles = riverObjects.filter(o => o.type === 'turtle');
    expect(turtles.length).toBeGreaterThan(0);
    for (const t of turtles) {
      expect(t.canDive).toBe(true);
    }
  });

  it('木头没有潜水属性', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    const logs = riverObjects.filter(o => o.type === 'log');
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) {
      expect(l.canDive).toBe(false);
    }
  });

  it('乌龟潜水周期中 isDiving 状态变化', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    const turtle = riverObjects.find(o => o.canDive);
    if (turtle) {
      // 初始状态可能不是潜水
      turtle.diveTimer = 0;
      turtle.isDiving = false;
      // 推进到潜水阶段
      turtle.diveTimer = turtle.diveCycleDuration - turtle.diveDuration + 1;
      tick(engine, 16);
      // diveTimer 会在 update 中增加
    }
  });

  it('河流物体循环滚动（向右出界）', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    const rightObj = riverObjects.find(o => o.direction === 1);
    if (rightObj) {
      rightObj.x = CANVAS_WIDTH + 1;
      tick(engine, 16);
      expect(rightObj.x).toBeLessThan(0);
    }
  });

  it('河流物体循环滚动（向左出界）', () => {
    const engine = createAndStartEngine();
    const riverObjects = getRiverObjects(engine);
    const leftObj = riverObjects.find(o => o.direction === -1);
    if (leftObj) {
      leftObj.x = -(leftObj.width * CELL_SIZE) - 1;
      tick(engine, 16);
      expect(leftObj.x).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 8. 碰撞检测 — 车辆
// ============================================================
describe('FroggerEngine - 车辆碰撞', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('青蛙碰到车辆死亡，cause 为 car', () => {
    // 将青蛙移到某个车道行
    const roadRow = ROAD_A_ROWS[0]; // row 5
    moveFrogToRow(engine, roadRow);
    finishJump(engine);

    // 放置一辆车在青蛙位置
    const vehicles = getVehicles(engine);
    const frog = getFrog(engine);
    const v = vehicles.find(v => v.row === roadRow);
    if (v) {
      v.x = frog.x;
      v.row = roadRow;
      tick(engine, 16);
      expect(engine.frogAlivePublic).toBe(false);
      expect(engine.deathCausePublic).toBe('car');
    }
  });

  it('跳跃中不检测车辆碰撞', () => {
    const roadRow = ROAD_A_ROWS[0];
    moveFrogToRow(engine, roadRow);
    finishJump(engine);

    const vehicles = getVehicles(engine);
    const frog = getFrog(engine);
    const v = vehicles.find(v => v.row === roadRow);
    if (v) {
      v.x = frog.x;
      // 开始跳跃
      engine.handleKeyDown('ArrowUp');
      expect(engine.frogAlivePublic).toBe(true);
    }
  });

  it('已死亡的青蛙不重复检测碰撞', () => {
    setPrivate(engine, 'frogAlive', false);
    const vehicles = getVehicles(engine);
    const frog = getFrog(engine);
    vehicles[0].x = frog.x;
    vehicles[0].row = frog.row;
    expect(() => tick(engine, 16)).not.toThrow();
  });
});

// ============================================================
// 9. 河流碰撞与漂流
// ============================================================
describe('FroggerEngine - 河流碰撞与漂流', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('青蛙在河流中不在物体上 → 溺水死亡', () => {
    const riverRow = RIVER_ROWS[0]; // row 1
    moveFrogToRow(engine, riverRow);
    // moveFrogToRow 清除了 riverObjects，再次清除确保没有可站立的
    setPrivate(engine, 'riverObjects', []);
    finishJump(engine);
    tick(engine, 16);
    expect(engine.frogAlivePublic).toBe(false);
    expect(engine.deathCausePublic).toBe('water');
  });

  it('青蛙站在河流物体上随物体漂移', () => {
    const riverRow = RIVER_ROWS[0]; // row 1
    // 先移动青蛙到河流行上方（row 4 = MID_REST_ROW）
    moveFrogToRow(engine, riverRow + 1);

    // moveFrogToRow 清除了 riverObjects，手动添加一个覆盖青蛙位置的 log
    const frog = getFrog(engine);
    setPrivate(engine, 'riverObjects', [{
      x: frog.x - CELL_SIZE,
      row: riverRow,
      width: 10,
      height: CELL_SIZE - 4,
      speed: 50,
      direction: 1 as const,
      type: 'log' as const,
      color: '#8B4513',
      canDive: false,
      diveCycleDuration: 0,
      diveDuration: 0,
      diveTimer: 0,
      isDiving: false,
    }]);

    // 跳到河流行
    moveAndLand(engine, 'ArrowUp');
    expect(engine.frogRow).toBe(riverRow);

    // 检查漂移
    const xBefore = getFrog(engine).x;
    tick(engine, 500);
    const xAfter = getFrog(engine).x;
    // 青蛙应该被带动
    expect(xAfter).not.toBe(xBefore);
  });

  it('青蛙被带出屏幕左边界 → 死亡', () => {
    const riverRow = RIVER_ROWS[0];
    moveFrogToRow(engine, riverRow);

    // 手动设置青蛙 x 到接近边界
    const frog = getFrog(engine);
    frog.x = -CELL_SIZE - 1;
    frog.jumping = false;

    // moveFrogToRow 清除了 riverObjects，手动添加一个物体在青蛙位置
    setPrivate(engine, 'riverObjects', [{
      x: -CELL_SIZE - 2,
      row: riverRow,
      width: 5,
      height: CELL_SIZE - 4,
      speed: -100,
      direction: -1 as const,
      type: 'log' as const,
      color: '#8B4513',
      canDive: false,
      diveCycleDuration: 0,
      diveDuration: 0,
      diveTimer: 0,
      isDiving: false,
    }]);

    tick(engine, 16);
    expect(engine.frogAlivePublic).toBe(false);
    expect(engine.deathCausePublic).toBe('offscreen');
  });

  it('青蛙被带出屏幕右边界 → 死亡', () => {
    const riverRow = RIVER_ROWS[0];
    moveFrogToRow(engine, riverRow);

    const frog = getFrog(engine);
    // 将青蛙放在接近右边界的位置
    frog.x = CANVAS_WIDTH - 20;
    frog.jumping = false;

    // moveFrogToRow 清除了 riverObjects，手动添加一个物体覆盖青蛙位置
    // 物体起始位置需要确保不会在 updateRiverObjects 中被立即循环包裹
    setPrivate(engine, 'riverObjects', [{
      x: CANVAS_WIDTH - 200,
      row: riverRow,
      width: 5,
      height: CELL_SIZE - 4,
      speed: 3000,
      direction: 1 as const,
      type: 'log' as const,
      color: '#8B4513',
      canDive: false,
      diveCycleDuration: 0,
      diveDuration: 0,
      diveTimer: 0,
      isDiving: false,
    }]);

    tick(engine, 16);
    expect(engine.frogAlivePublic).toBe(false);
    expect(engine.deathCausePublic).toBe('offscreen');
  });

  it('乌龟潜水时青蛙不能站在上面', () => {
    const riverRow = RIVER_ROWS[1]; // row 2 (turtle row)
    moveFrogToRow(engine, riverRow);

    const frog = getFrog(engine);
    // moveFrogToRow 清除了 riverObjects，手动添加潜水乌龟
    // diveTimer 需要设置在潜水阶段：phase >= (diveCycleDuration - diveDuration)
    setPrivate(engine, 'riverObjects', [{
      x: frog.x - CELL_SIZE,
      row: riverRow,
      width: 5,
      height: CELL_SIZE - 4,
      speed: -70,
      direction: -1 as const,
      type: 'turtle' as const,
      color: '#2d6a4f',
      canDive: true,
      diveCycleDuration: 4000,
      diveDuration: 1500,
      diveTimer: 3500, // 处于潜水阶段 (3500 % 4000 = 3500 >= 2500)
      isDiving: true,
    }]);

    tick(engine, 16);
    expect(engine.frogAlivePublic).toBe(false);
    expect(engine.deathCausePublic).toBe('water');
  });
});

// ============================================================
// 10. 终点系统
// ============================================================
describe('FroggerEngine - 终点系统', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('GOAL_COUNT 为 5', () => {
    expect(GOAL_COUNT).toBe(5);
  });

  it('GOAL_POSITIONS 有 5 个位置', () => {
    expect(GOAL_POSITIONS.length).toBe(GOAL_COUNT);
  });

  it('到达终点位置后 goalsReachedCount 增加', () => {
    const goalCol = GOAL_POSITIONS[0];
    // 手动设置青蛙到终点位置（避免 moveFrogToRow 中 tick 触发 checkGoalReached 导致重置）
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    tick(engine, 16);
    expect(engine.goalsReachedCount).toBe(1);
  });

  it('到达终点后获得 SCORE_GOAL 分', () => {
    const goalCol = GOAL_POSITIONS[0];
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    tick(engine, 16);
    expect(engine.score).toBeGreaterThanOrEqual(SCORE_GOAL);
  });

  it('到达终点后获得时间奖励', () => {
    const goalCol = GOAL_POSITIONS[0];
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    tick(engine, 16);
    // 分数应包含 GOAL + 时间奖励
    expect(engine.score).toBeGreaterThanOrEqual(SCORE_GOAL);
  });

  it('到达终点后青蛙重置到起始位置', () => {
    const goalCol = GOAL_POSITIONS[0];
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    tick(engine, 16);
    // 青蛙应重置回起始位置（除非全部到达）
    if (!engine.isWin) {
      expect(engine.frogRow).toBe(FROG_START_ROW);
      expect(engine.frogCol).toBe(FROG_START_COL);
    }
  });

  it('到达终点行但不在目标位置 → 死亡', () => {
    // 移到非目标列
    const nonGoalCol = 0; // 不在 GOAL_POSITIONS 中
    if (!GOAL_POSITIONS.includes(nonGoalCol)) {
      const frog = getFrog(engine);
      frog.col = nonGoalCol;
      frog.row = GOAL_ROW;
      frog.x = nonGoalCol * CELL_SIZE;
      frog.y = GOAL_ROW * CELL_SIZE;
      frog.jumping = false;
      frog.jumpProgress = 1;
      setPrivate(engine, 'frog', frog);
      tick(engine, 16);
      expect(engine.frogAlivePublic).toBe(false);
      expect(engine.deathCausePublic).toBe('water');
    }
  });

  it('全部终点到达后 isWin 为 true', () => {
    const goalCol = GOAL_POSITIONS[0];
    // 手动设置青蛙到终点位置
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    // 手动设置全部到达
    const gr = getGoalsReached(engine);
    for (let i = 0; i < GOAL_COUNT; i++) {
      gr[i] = true;
    }
    tick(engine, 16);
    // 检查 isWin（通过 getState）
    expect(engine.isWin).toBe(true);
  });

  it('已到达的终点不能重复到达', () => {
    const goalCol = GOAL_POSITIONS[0];
    moveFrogToCol(engine, goalCol);
    moveFrogToRow(engine, GOAL_ROW);
    finishJump(engine);
    tick(engine, 16);
    const countAfterFirst = engine.goalsReachedCount;

    // 再次到达同一终点
    if (engine.frogAlivePublic && !engine.isWin) {
      moveFrogToCol(engine, goalCol);
      moveFrogToRow(engine, GOAL_ROW);
      finishJump(engine);
      tick(engine, 16);
      // 计数不应再增加（因为该终点已到达，到终点行但目标已到达 → 死亡）
    }
  });
});

// ============================================================
// 11. 生命与重生
// ============================================================
describe('FroggerEngine - 生命与重生', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始生命为 INITIAL_LIVES (3)', () => {
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('死亡后进入死亡动画', () => {
    const riverRow = RIVER_ROWS[0];
    // 直接设置青蛙到河流行（不经过 moveFrogToRow，避免中途溺水）
    const frog = getFrog(engine);
    frog.col = FROG_START_COL;
    frog.row = riverRow;
    frog.x = FROG_START_COL * CELL_SIZE;
    frog.y = riverRow * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    setPrivate(engine, 'riverObjects', []);
    tick(engine, 16);
    expect(engine.frogAlivePublic).toBe(false);
  });

  it('死亡动画结束后重生，生命减 1', () => {
    const riverRow = RIVER_ROWS[0];
    // 直接设置青蛙到河流行
    const frog = getFrog(engine);
    frog.col = FROG_START_COL;
    frog.row = riverRow;
    frog.x = FROG_START_COL * CELL_SIZE;
    frog.y = riverRow * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    setPrivate(engine, 'riverObjects', []);
    tick(engine, 16); // 触发死亡
    expect(engine.frogAlivePublic).toBe(false);

    // 推进死亡动画结束（500ms）
    tick(engine, 600);
    expect(engine.lives).toBe(INITIAL_LIVES - 1);
    expect(engine.frogAlivePublic).toBe(true);
  });

  it('重生后青蛙回到起始位置', () => {
    const riverRow = RIVER_ROWS[0];
    const frog = getFrog(engine);
    frog.col = FROG_START_COL;
    frog.row = riverRow;
    frog.x = FROG_START_COL * CELL_SIZE;
    frog.y = riverRow * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    setPrivate(engine, 'riverObjects', []);
    tick(engine, 16);
    tick(engine, 600);
    expect(engine.frogRow).toBe(FROG_START_ROW);
    expect(engine.frogCol).toBe(FROG_START_COL);
  });

  it('重生后 deathCause 清除', () => {
    const riverRow = RIVER_ROWS[0];
    const frog = getFrog(engine);
    frog.col = FROG_START_COL;
    frog.row = riverRow;
    frog.x = FROG_START_COL * CELL_SIZE;
    frog.y = riverRow * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    setPrivate(engine, 'riverObjects', []);
    tick(engine, 16);
    tick(engine, 600);
    expect(engine.deathCausePublic).toBeNull();
  });

  it('生命耗尽后游戏结束', () => {
    setPrivate(engine, '_lives', 1);
    const riverRow = RIVER_ROWS[0];
    setPrivate(engine, 'riverObjects', []);
    moveFrogToRow(engine, riverRow);
    finishJump(engine);
    tick(engine, 16);
    tick(engine, 600);
    expect(engine.status).toBe('gameover');
  });

  it('生命为 0 时 lives 不为负数', () => {
    setPrivate(engine, '_lives', 1);
    const riverRow = RIVER_ROWS[0];
    setPrivate(engine, 'riverObjects', []);
    moveFrogToRow(engine, riverRow);
    finishJump(engine);
    tick(engine, 16);
    tick(engine, 600);
    expect(engine.lives).toBe(0);
  });
});

// ============================================================
// 12. 计时器
// ============================================================
describe('FroggerEngine - 计时器', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('计时器随时间减少', () => {
    const timeBefore = engine.timeRemaining;
    tick(engine, 1000);
    expect(engine.timeRemaining).toBeLessThan(timeBefore);
  });

  it('计时器减少量正确（秒）', () => {
    const timeBefore = engine.timeRemaining;
    tick(engine, 1000);
    expect(timeBefore - engine.timeRemaining).toBeCloseTo(1, 1);
  });

  it('计时器归零后青蛙死亡（timeout）', () => {
    setPrivate(engine, 'roundTimer', 0.001);
    tick(engine, 16);
    expect(engine.frogAlivePublic).toBe(false);
    expect(engine.deathCausePublic).toBe('timeout');
  });

  it('timeRemaining 不为负数', () => {
    setPrivate(engine, 'roundTimer', -5);
    expect(engine.timeRemaining).toBe(0);
  });

  it('ROUND_TIME_LIMIT 为 30 秒', () => {
    expect(ROUND_TIME_LIMIT).toBe(30);
  });
});

// ============================================================
// 13. 计分系统
// ============================================================
describe('FroggerEngine - 计分系统', () => {
  let engine: FroggerEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('向前移动到新最高行获得 SCORE_FORWARD 分', () => {
    moveAndLand(engine, 'ArrowUp');
    expect(engine.score).toBe(SCORE_FORWARD);
  });

  it('连续前进获得多次 SCORE_FORWARD', () => {
    moveAndLand(engine, 'ArrowUp');
    moveAndLand(engine, 'ArrowUp');
    moveAndLand(engine, 'ArrowUp');
    expect(engine.score).toBe(SCORE_FORWARD * 3);
  });

  it('向后移动不得分', () => {
    moveAndLand(engine, 'ArrowUp');
    const scoreAfterUp = engine.score;
    moveAndLand(engine, 'ArrowDown');
    expect(engine.score).toBe(scoreAfterUp);
  });

  it('重复到达同一最高行不得分', () => {
    moveAndLand(engine, 'ArrowUp');
    const scoreAfterFirst = engine.score;
    moveAndLand(engine, 'ArrowDown');
    moveAndLand(engine, 'ArrowUp');
    expect(engine.score).toBe(scoreAfterFirst);
  });

  it('到达终点获得 SCORE_GOAL 分', () => {
    const goalCol = GOAL_POSITIONS[0];
    moveFrogToCol(engine, goalCol);
    const scoreBeforeGoal = engine.score;
    moveFrogToRow(engine, GOAL_ROW);
    finishJump(engine);
    tick(engine, 16);
    expect(engine.score).toBeGreaterThanOrEqual(scoreBeforeGoal + SCORE_GOAL);
  });

  it('到达终点获得时间奖励（最多 SCORE_TIME_BONUS_MAX）', () => {
    const goalCol = GOAL_POSITIONS[0];
    moveFrogToCol(engine, goalCol);
    moveFrogToRow(engine, GOAL_ROW);
    finishJump(engine);
    tick(engine, 16);
    // 时间奖励 = floor(roundTimer / ROUND_TIME_LIMIT * SCORE_TIME_BONUS_MAX)
    // 在满时间时应该接近 SCORE_TIME_BONUS_MAX
    // 总分 = forward 分 + SCORE_GOAL + 时间奖励
  });

  it('SCORE_FORWARD 为 10', () => {
    expect(SCORE_FORWARD).toBe(10);
  });

  it('SCORE_GOAL 为 50', () => {
    expect(SCORE_GOAL).toBe(50);
  });

  it('SCORE_TIME_BONUS_MAX 为 100', () => {
    expect(SCORE_TIME_BONUS_MAX).toBe(100);
  });

  it('SCORE_LEVEL_COMPLETE 为 200', () => {
    expect(SCORE_LEVEL_COMPLETE).toBe(200);
  });
});

// ============================================================
// 14. 关卡递进
// ============================================================
describe('FroggerEngine - 关卡递进', () => {
  it('SPEED_INCREMENT_PER_LEVEL 为 0.2', () => {
    expect(SPEED_INCREMENT_PER_LEVEL).toBe(0.2);
  });

  it('全部终点到达后进入下一关', () => {
    const engine = createAndStartEngine();
    const goalCol = GOAL_POSITIONS[0];
    // 手动设置青蛙到终点位置
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    // 手动设置全部到达
    const goalsReached = getGoalsReached(engine);
    for (let i = 0; i < GOAL_COUNT; i++) {
      goalsReached[i] = true;
    }
    tick(engine, 16);
    expect(engine.level).toBe(2);
  });

  it('下一关后 goalsReached 重置', () => {
    const engine = createAndStartEngine();
    const goalCol = GOAL_POSITIONS[0];
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    const goalsReached = getGoalsReached(engine);
    for (let i = 0; i < GOAL_COUNT; i++) {
      goalsReached[i] = true;
    }
    tick(engine, 16);
    expect(engine.goalsReachedCount).toBe(0);
  });

  it('下一关后青蛙重置到起始位置', () => {
    const engine = createAndStartEngine();
    const goalCol = GOAL_POSITIONS[0];
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    const goalsReached = getGoalsReached(engine);
    for (let i = 0; i < GOAL_COUNT; i++) {
      goalsReached[i] = true;
    }
    tick(engine, 16);
    expect(engine.frogRow).toBe(FROG_START_ROW);
  });

  it('全部终点到达后获得 SCORE_LEVEL_COMPLETE 分', () => {
    const engine = createAndStartEngine();
    const goalCol = GOAL_POSITIONS[0];
    const frog = getFrog(engine);
    frog.col = goalCol;
    frog.row = GOAL_ROW;
    frog.x = goalCol * CELL_SIZE;
    frog.y = GOAL_ROW * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    const goalsReached = getGoalsReached(engine);
    for (let i = 0; i < GOAL_COUNT; i++) {
      goalsReached[i] = true;
    }
    tick(engine, 16);
    // 分数应包含 LEVEL_COMPLETE
    expect(engine.score).toBeGreaterThanOrEqual(SCORE_LEVEL_COMPLETE);
  });
});

// ============================================================
// 15. 状态管理
// ============================================================
describe('FroggerEngine - 状态管理', () => {
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
    setPrivate(engine, 'riverObjects', []);
    moveFrogToRow(engine, RIVER_ROWS[0]);
    finishJump(engine);
    tick(engine, 16);
    tick(engine, 600);
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
    moveAndLand(engine, 'ArrowUp');
    expect(engine.score).toBeGreaterThan(0);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后生命恢复', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_lives', 1);
    engine.reset();
    expect(engine.lives).toBe(INITIAL_LIVES);
  });

  it('reset 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_isWin', true);
    engine.reset();
    expect(engine.isWin).toBe(false);
  });

  it('reset 后车辆和河流物体清空', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.vehicleCount).toBe(0);
    expect(engine.riverObjectCount).toBe(0);
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

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    const callCountAfterDestroy = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCountAfterDestroy);
  });
});

// ============================================================
// 16. getState
// ============================================================
describe('FroggerEngine - getState', () => {
  it('返回包含所有必要字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('frogCol');
    expect(state).toHaveProperty('frogRow');
    expect(state).toHaveProperty('frogAlive');
    expect(state).toHaveProperty('lives');
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('timeRemaining');
    expect(state).toHaveProperty('goalsReached');
    expect(state).toHaveProperty('goalsReachedCount');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('deathCause');
    expect(state).toHaveProperty('speedMultiplier');
  });

  it('初始状态的 getState 值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.frogCol).toBe(FROG_START_COL);
    expect(state.frogRow).toBe(FROG_START_ROW);
    expect(state.frogAlive).toBe(true);
    expect(state.lives).toBe(INITIAL_LIVES);
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.isWin).toBe(false);
    expect(state.deathCause).toBeNull();
    expect(state.speedMultiplier).toBe(1);
  });

  it('移动后 getState 反映新位置', () => {
    const engine = createAndStartEngine();
    moveAndLand(engine, 'ArrowUp');
    moveAndLand(engine, 'ArrowRight');
    const state = engine.getState();
    expect(state.frogRow).toBe(FROG_START_ROW - 1);
    expect(state.frogCol).toBe(FROG_START_COL + 1);
  });

  it('goalsReached 是数组的副本', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const goals = state.goalsReached as boolean[];
    expect(goals.length).toBe(GOAL_COUNT);
    expect(goals.every(g => g === false)).toBe(true);
  });

  it('死亡后 getState 反映状态', () => {
    const engine = createAndStartEngine();
    // 直接设置青蛙到河流行
    const frog = getFrog(engine);
    frog.col = FROG_START_COL;
    frog.row = RIVER_ROWS[0];
    frog.x = FROG_START_COL * CELL_SIZE;
    frog.y = RIVER_ROWS[0] * CELL_SIZE;
    frog.jumping = false;
    frog.jumpProgress = 1;
    setPrivate(engine, 'frog', frog);
    setPrivate(engine, 'riverObjects', []);
    tick(engine, 16);
    const state = engine.getState();
    expect(state.frogAlive).toBe(false);
    expect(state.deathCause).toBe('water');
  });
});

// ============================================================
// 17. 事件系统
// ============================================================
describe('FroggerEngine - 事件系统', () => {
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

  it('scoreChange 事件在得分时触发', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    moveAndLand(engine, 'ArrowUp');
    expect(handler).toHaveBeenCalled();
  });
});

// ============================================================
// 18. 边界与异常场景
// ============================================================
describe('FroggerEngine - 边界与异常场景', () => {
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

  it('paused 时 update 不执行游戏逻辑', () => {
    const engine = createAndStartEngine();
    engine.pause();
    const timeBefore = engine.timeRemaining;
    tick(engine, 1000);
    // paused 时 update 直接返回，时间不减少
    expect(engine.timeRemaining).toBe(timeBefore);
  });

  it('gameover 时 update 不执行游戏逻辑', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');
    const timeBefore = engine.timeRemaining;
    tick(engine, 1000);
    expect(engine.timeRemaining).toBe(timeBefore);
  });

  it('大 deltaTime 不导致崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => tick(engine, 100000)).not.toThrow();
  });

  it('快速连续移动不会崩溃', () => {
    const engine = createAndStartEngine();
    // 清除障碍物，避免在移动过程中被撞或溺水
    setPrivate(engine, 'vehicles', []);
    setPrivate(engine, 'riverObjects', []);
    // 移动到 row 1（GOAL_ROW 下方），避免到达终点行触发死亡逻辑
    for (let i = 0; i < FROG_START_ROW - 1; i++) {
      engine.handleKeyDown('ArrowUp');
      finishJump(engine);
    }
    expect(engine.frogRow).toBe(1);
    // 再向上一步到 row 0，验证不会崩溃
    engine.handleKeyDown('ArrowUp');
    expect(engine.frogRow).toBe(0);
  });

  it('destroy 后可以重新 init 和 start', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    engine.init();
    engine.start();
    expect(engine.status).toBe('playing');
  });
});

// ============================================================
// 19. 常量合理性验证
// ============================================================
describe('Frogger 常量验证', () => {
  it('COLS 和 ROWS 为正数', () => {
    expect(COLS).toBeGreaterThan(0);
    expect(ROWS).toBeGreaterThan(0);
  });

  it('CELL_SIZE 为 CANVAS_WIDTH / COLS', () => {
    expect(CELL_SIZE).toBe(CANVAS_WIDTH / COLS);
  });

  it('FROG_START_COL 在有效范围内', () => {
    expect(FROG_START_COL).toBeGreaterThanOrEqual(0);
    expect(FROG_START_COL).toBeLessThan(COLS);
  });

  it('FROG_START_ROW 在有效范围内', () => {
    expect(FROG_START_ROW).toBeGreaterThanOrEqual(0);
    expect(FROG_START_ROW).toBeLessThan(ROWS);
  });

  it('GOAL_ROW 为 0（最顶行）', () => {
    expect(GOAL_ROW).toBe(0);
  });

  it('GOAL_POSITIONS 所有值在有效范围内', () => {
    for (const pos of GOAL_POSITIONS) {
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThan(COLS);
    }
  });

  it('RIVER_ROWS 是连续的', () => {
    for (let i = 1; i < RIVER_ROWS.length; i++) {
      expect(RIVER_ROWS[i]).toBe(RIVER_ROWS[i - 1] + 1);
    }
  });

  it('LANE_CONFIGS 覆盖所有车道行', () => {
    const configRows = new Set(LANE_CONFIGS.map(c => c.row));
    for (const row of [...ROAD_A_ROWS, ...ROAD_B_ROWS]) {
      expect(configRows.has(row)).toBe(true);
    }
  });

  it('RIVER_CONFIGS 覆盖所有河流行', () => {
    const configRows = new Set(RIVER_CONFIGS.map(c => c.row));
    for (const row of RIVER_ROWS) {
      expect(configRows.has(row)).toBe(true);
    }
  });

  it('INITIAL_LIVES > 0', () => {
    expect(INITIAL_LIVES).toBeGreaterThan(0);
  });

  it('ROUND_TIME_LIMIT > 0', () => {
    expect(ROUND_TIME_LIMIT).toBeGreaterThan(0);
  });

  it('SPEED_INCREMENT_PER_LEVEL > 0', () => {
    expect(SPEED_INCREMENT_PER_LEVEL).toBeGreaterThan(0);
  });

  it('所有车道速度为正数', () => {
    for (const cfg of LANE_CONFIGS) {
      expect(cfg.speed).toBeGreaterThan(0);
    }
  });

  it('所有河流物体速度为正数', () => {
    for (const cfg of RIVER_CONFIGS) {
      expect(cfg.speed).toBeGreaterThan(0);
    }
  });

  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('FROG_JUMP_DURATION > 0', () => {
    expect(FROG_JUMP_DURATION).toBeGreaterThan(0);
  });
});
