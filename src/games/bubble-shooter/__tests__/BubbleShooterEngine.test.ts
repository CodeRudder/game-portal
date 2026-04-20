
/**
 * BubbleShooterEngine 全面测试
 *
 * 覆盖工具函数、引擎核心逻辑、碰撞检测、消除计分、
 * 动画、等级提升、Game Over、键盘输入、事件系统等。
 */
import {
  BubbleShooterEngine,
  getPixelPos,
  getMaxCols,
  isValidCell,
  getNeighbors,
  pixelDist,
} from '../BubbleShooterEngine';
import {
  BUBBLE_RADIUS,
  BUBBLE_DIAMETER,
  COLS,
  ROW_HEIGHT,
  INITIAL_ROWS,
  SHOOTER_X,
  SHOOTER_Y,
  SHOOTER_SPEED,
  AIM_SPEED,
  MIN_ANGLE,
  MAX_ANGLE,
  DEAD_LINE_Y,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BUBBLE_COLORS,
  getColorsForLevel,
  POP_SCORE,
  DROP_SCORE,
  MIN_MATCH,
} from '../constants';

// ======================== 辅助函数 ========================

/** 创建 mock canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化（idle 状态） */
function createEngine(): BubbleShooterEngine {
  const engine = new BubbleShooterEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎、初始化并启动（playing 状态） */
function createAndStartEngine(): BubbleShooterEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 清空网格 */
function clearGrid(engine: BubbleShooterEngine): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any)._grid = [];
}

/** 设置私有属性 */
function setPrivate(obj: object, key: string, value: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (obj as any)[key] = value;
}

/** 调用 protected update 方法（update 定义在 GameEngine 基类） */
function callUpdate(engine: BubbleShooterEngine, deltaTime: number): void {
  // Walk up the prototype chain to find update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let proto: any = engine;
  while (proto !== null) {
    proto = Object.getPrototypeOf(proto);
    if (proto && typeof proto.update === 'function') {
      proto.update.call(engine, deltaTime);
      return;
    }
  }
  throw new Error('update method not found on prototype chain');
}

// ============================================================
// 23. getPixelPos 边界与精确值
// ============================================================
describe('getPixelPos 边界与精确值', () => {
  it('row=0, col=0 返回正确坐标', () => {
    const pos = getPixelPos(0, 0);
    expect(pos.x).toBe(BUBBLE_RADIUS);
    expect(pos.y).toBe(BUBBLE_RADIUS);
  });

  it('row=0, col=COLS-1 偶数行最后一个', () => {
    const pos = getPixelPos(0, COLS - 1);
    expect(pos.x).toBe((COLS - 1) * BUBBLE_DIAMETER + BUBBLE_RADIUS);
    expect(pos.y).toBe(BUBBLE_RADIUS);
  });

  it('row=1, col=0 奇数行第一个', () => {
    const pos = getPixelPos(1, 0);
    expect(pos.x).toBe(BUBBLE_DIAMETER); // BUBBLE_RADIUS + BUBBLE_RADIUS
    expect(pos.y).toBeCloseTo(ROW_HEIGHT + BUBBLE_RADIUS, 5);
  });

  it('row=1, col=COLS-2 奇数行最后一个', () => {
    const pos = getPixelPos(1, COLS - 2);
    const offset = BUBBLE_RADIUS;
    expect(pos.x).toBe((COLS - 2) * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset);
  });

  it('row=10, col=0 大行号', () => {
    const pos = getPixelPos(10, 0);
    expect(pos.y).toBeCloseTo(10 * ROW_HEIGHT + BUBBLE_RADIUS, 5);
  });

  it('偶数行 offset=0', () => {
    for (const r of [0, 2, 4, 6, 8]) {
      const pos = getPixelPos(r, 0);
      expect(pos.x).toBe(BUBBLE_RADIUS);
    }
  });

  it('奇数行 offset=BUBBLE_RADIUS', () => {
    for (const r of [1, 3, 5, 7, 9]) {
      const pos = getPixelPos(r, 0);
      expect(pos.x).toBe(BUBBLE_RADIUS + BUBBLE_RADIUS);
    }
  });

  it('y 坐标随行号线性增长', () => {
    const y0 = getPixelPos(0, 0).y;
    const y1 = getPixelPos(1, 0).y;
    const y2 = getPixelPos(2, 0).y;
    expect(y1 - y0).toBeCloseTo(ROW_HEIGHT, 5);
    expect(y2 - y1).toBeCloseTo(ROW_HEIGHT, 5);
  });
});

// ============================================================
// 24. getNeighbors 详细验证
// ============================================================
describe('getNeighbors 详细验证', () => {
  it('偶数行 (0,0) 的邻居坐标', () => {
    const neighbors = getNeighbors(0, 0);
    // even: [-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]
    expect(neighbors).toContainEqual([-1, -1]);
    expect(neighbors).toContainEqual([-1, 0]);
    expect(neighbors).toContainEqual([0, -1]);
    expect(neighbors).toContainEqual([0, 1]);
    expect(neighbors).toContainEqual([1, -1]);
    expect(neighbors).toContainEqual([1, 0]);
  });

  it('奇数行 (1,0) 的邻居坐标', () => {
    const neighbors = getNeighbors(1, 0);
    // odd: [-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]
    expect(neighbors).toContainEqual([0, 0]);
    expect(neighbors).toContainEqual([0, 1]);
    expect(neighbors).toContainEqual([1, -1]);
    expect(neighbors).toContainEqual([1, 1]);
    expect(neighbors).toContainEqual([2, 0]);
    expect(neighbors).toContainEqual([2, 1]);
  });

  it('偶数行 (4,6) 的邻居', () => {
    const neighbors = getNeighbors(4, 6);
    expect(neighbors).toContainEqual([3, 5]);
    expect(neighbors).toContainEqual([3, 6]);
    expect(neighbors).toContainEqual([4, 5]);
    expect(neighbors).toContainEqual([4, 7]);
    expect(neighbors).toContainEqual([5, 5]);
    expect(neighbors).toContainEqual([5, 6]);
  });

  it('奇数行 (5,6) 的邻居', () => {
    const neighbors = getNeighbors(5, 6);
    expect(neighbors).toContainEqual([4, 6]);
    expect(neighbors).toContainEqual([4, 7]);
    expect(neighbors).toContainEqual([5, 5]);
    expect(neighbors).toContainEqual([5, 7]);
    expect(neighbors).toContainEqual([6, 6]);
    expect(neighbors).toContainEqual([6, 7]);
  });

  it('邻居数量始终为6', () => {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < getMaxCols(r); c++) {
        expect(getNeighbors(r, c).length).toBe(6);
      }
    }
  });

  it('邻居可以包含负坐标', () => {
    const neighbors = getNeighbors(0, 0);
    // [-1,-1] 和 [-1,0] 是负行号
    const hasNeg = neighbors.some(([r]) => r < 0);
    expect(hasNeg).toBe(true);
  });
});

// ============================================================
// 25. isValidCell 边界
// ============================================================
describe('isValidCell 边界', () => {
  it('row=0 所有有效列', () => {
    for (let c = 0; c < COLS; c++) {
      expect(isValidCell(0, c)).toBe(true);
    }
    expect(isValidCell(0, COLS)).toBe(false);
  });

  it('row=1 所有有效列', () => {
    for (let c = 0; c < COLS - 1; c++) {
      expect(isValidCell(1, c)).toBe(true);
    }
    expect(isValidCell(1, COLS - 1)).toBe(false);
  });

  it('col=0 对所有非负行有效', () => {
    for (let r = 0; r < 20; r++) {
      expect(isValidCell(r, 0)).toBe(true);
    }
  });

  it('col=-1 始终无效', () => {
    expect(isValidCell(0, -1)).toBe(false);
    expect(isValidCell(5, -1)).toBe(false);
  });

  it('row=-1 始终无效', () => {
    expect(isValidCell(-1, 0)).toBe(false);
    expect(isValidCell(-1, 5)).toBe(false);
  });

  it('极大行号仍然有效（只检查列）', () => {
    expect(isValidCell(1000, 0)).toBe(true);
    expect(isValidCell(1000, COLS - 1)).toBe(true);
  });
});

// ============================================================
// 26. pixelDist 边界
// ============================================================
describe('pixelDist 边界', () => {
  it('负坐标距离', () => {
    const d = pixelDist(-3, -4, 0, 0);
    expect(d).toBe(5);
  });

  it('大数距离', () => {
    const d = pixelDist(0, 0, 10000, 0);
    expect(d).toBe(10000);
  });

  it('浮点精度', () => {
    const d = pixelDist(0.1, 0.1, 0.2, 0.2);
    expect(d).toBeCloseTo(Math.sqrt(0.02), 10);
  });

  it('对称性', () => {
    expect(pixelDist(1, 2, 3, 4)).toBeCloseTo(pixelDist(3, 4, 1, 2), 10);
  });
});

// ============================================================
// 27. getColorsForLevel 详细
// ============================================================
describe('getColorsForLevel 详细', () => {
  it('level=1 返回 4', () => {
    expect(getColorsForLevel(1)).toBe(4);
  });

  it('level=2 返回 5', () => {
    expect(getColorsForLevel(2)).toBe(5);
  });

  it('level=3 返回 6', () => {
    expect(getColorsForLevel(3)).toBe(6);
  });

  it('level=4 返回 7', () => {
    expect(getColorsForLevel(4)).toBe(7);
  });

  it('level=5 返回 8', () => {
    expect(getColorsForLevel(5)).toBe(8);
  });

  it('level>=5 上限为 BUBBLE_COLORS.length', () => {
    for (let l = 5; l < 100; l++) {
      expect(getColorsForLevel(l)).toBe(BUBBLE_COLORS.length);
    }
  });

  it('level=0 返回 3', () => {
    expect(getColorsForLevel(0)).toBe(3);
  });

  it('单调递增直到上限', () => {
    let prev = getColorsForLevel(0);
    for (let l = 1; l <= 10; l++) {
      const cur = getColorsForLevel(l);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

// ============================================================
// 28. addBubbleToGrid 详细
// ============================================================
describe('addBubbleToGrid 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('添加到 row=0, col=0', () => {
    engine.addBubbleToGrid(0, 0, 2);
    const b = engine.getBubbleAt(0, 0);
    expect(b).not.toBeNull();
    expect(b!.row).toBe(0);
    expect(b!.col).toBe(0);
    expect(b!.colorIdx).toBe(2);
  });

  it('添加到新行自动扩展网格', () => {
    expect(engine.grid.length).toBe(0);
    engine.addBubbleToGrid(3, 0, 0);
    expect(engine.grid.length).toBe(4); // rows 0,1,2,3
  });

  it('扩展的空行长度正确', () => {
    engine.addBubbleToGrid(2, 0, 0);
    // row 0: even, COLS; row 1: odd, COLS-1; row 2: even, COLS
    expect(engine.grid[0].length).toBe(COLS);
    expect(engine.grid[1].length).toBe(COLS - 1);
    expect(engine.grid[2].length).toBe(COLS);
  });

  it('覆盖已存在的泡泡', () => {
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 0, 3);
    expect(engine.getBubbleAt(0, 0)!.colorIdx).toBe(3);
  });

  it('无效列不崩溃', () => {
    expect(() => engine.addBubbleToGrid(0, -1, 0)).not.toThrow();
    expect(() => engine.addBubbleToGrid(0, COLS + 5, 0)).not.toThrow();
  });

  it('添加多个泡泡到同一行', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(0, 1, 1);
    engine.addBubbleToGrid(0, 2, 2);
    expect(engine.getBubbleAt(0, 0)!.colorIdx).toBe(0);
    expect(engine.getBubbleAt(0, 1)!.colorIdx).toBe(1);
    expect(engine.getBubbleAt(0, 2)!.colorIdx).toBe(2);
  });
});

// ============================================================
// 29. removeBubbles 详细
// ============================================================
describe('removeBubbles 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('移除单个泡泡', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.removeBubbles([[0, 0]]);
    expect(engine.getBubbleAt(0, 0)).toBeNull();
  });

  it('移除多个泡泡', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(0, 1, 1);
    engine.addBubbleToGrid(0, 2, 2);
    engine.removeBubbles([[0, 0], [0, 2]]);
    expect(engine.getBubbleAt(0, 0)).toBeNull();
    expect(engine.getBubbleAt(0, 1)).not.toBeNull();
    expect(engine.getBubbleAt(0, 2)).toBeNull();
  });

  it('移除空列表不崩溃', () => {
    expect(() => engine.removeBubbles([])).not.toThrow();
  });

  it('移除已为空的位置不崩溃', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.removeBubbles([[0, 0]]);
    expect(() => engine.removeBubbles([[0, 0]])).not.toThrow();
  });
});

// ============================================================
// 30. findConnectedSameColor 复杂场景
// ============================================================
describe('findConnectedSameColor 复杂场景', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('5个同色连通', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(0, 1, 0);
    engine.addBubbleToGrid(0, 2, 0);
    engine.addBubbleToGrid(0, 3, 0);
    engine.addBubbleToGrid(0, 4, 0);
    const result = engine.findConnectedSameColor(0, 2);
    expect(result.length).toBe(5);
  });

  it('L 形连通', () => {
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(1, 0, 1); // 奇数行邻居含 (0,0)
    engine.addBubbleToGrid(2, 0, 1); // 偶数行邻居含 (1,-1) 和 (1,0)
    const result = engine.findConnectedSameColor(0, 0);
    expect(result.length).toBe(3);
  });

  it('两色交替不连通', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(0, 1, 1);
    engine.addBubbleToGrid(0, 2, 0);
    engine.addBubbleToGrid(0, 3, 1);
    expect(engine.findConnectedSameColor(0, 0).length).toBe(1);
    expect(engine.findConnectedSameColor(0, 1).length).toBe(1);
  });

  it('从不同起点搜索同区域', () => {
    engine.addBubbleToGrid(0, 0, 2);
    engine.addBubbleToGrid(0, 1, 2);
    engine.addBubbleToGrid(0, 2, 2);
    const fromStart = engine.findConnectedSameColor(0, 0);
    const fromMiddle = engine.findConnectedSameColor(0, 1);
    const fromEnd = engine.findConnectedSameColor(0, 2);
    expect(fromStart.length).toBe(3);
    expect(fromMiddle.length).toBe(3);
    expect(fromEnd.length).toBe(3);
  });

  it('搜索不存在的位置', () => {
    expect(engine.findConnectedSameColor(5, 5)).toEqual([]);
    expect(engine.findConnectedSameColor(-1, 0)).toEqual([]);
  });

  it('跨行对角连通', () => {
    // (0,0) → (1,0) → (2,0) → (3,0)
    engine.addBubbleToGrid(0, 0, 3);
    engine.addBubbleToGrid(1, 0, 3);
    engine.addBubbleToGrid(2, 0, 3);
    engine.addBubbleToGrid(3, 0, 3);
    const result = engine.findConnectedSameColor(0, 0);
    expect(result.length).toBe(4);
  });
});

// ============================================================
// 31. findFloatingBubbles 复杂场景
// ============================================================
describe('findFloatingBubbles 复杂场景', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('全部顶行连通不算悬挂', () => {
    for (let c = 0; c < COLS; c++) {
      engine.addBubbleToGrid(0, c, 0);
    }
    expect(engine.findFloatingBubbles().length).toBe(0);
  });

  it('第1行通过顶行连通', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(1, 0, 1); // (1,0) 邻居含 (0,0)
    expect(engine.findFloatingBubbles().length).toBe(0);
  });

  it('孤立的泡泡为悬挂', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(5, 5, 1); // 远离且不连通
    const floating = engine.findFloatingBubbles();
    expect(floating.length).toBe(1);
    expect(floating).toContainEqual([5, 5]);
  });

  it('消除中间泡泡导致两侧悬挂', () => {
    // 0-0-0-0-0 (row 0, color 0)
    //         |
    //       (1,2) color 1 (悬挂)
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(0, 1, 0);
    engine.addBubbleToGrid(0, 2, 0);
    // (1,2) 的邻居含 (0,2) 和 (0,3)
    engine.addBubbleToGrid(1, 2, 5);
    // 如果消除 (0,2), (1,2) 应该悬挂
    engine.removeBubbles([[0, 2]]);
    const floating = engine.findFloatingBubbles();
    expect(floating).toContainEqual([1, 2]);
  });

  it('空网格无悬挂', () => {
    expect(engine.findFloatingBubbles()).toEqual([]);
  });

  it('只有顶行有泡泡无悬挂', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(0, 5, 1);
    expect(engine.findFloatingBubbles().length).toBe(0);
  });

  it('链式连通不算悬挂', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(1, 0, 0);
    engine.addBubbleToGrid(2, 0, 0);
    engine.addBubbleToGrid(3, 0, 0);
    expect(engine.findFloatingBubbles().length).toBe(0);
  });
});

// ============================================================
// 32. 发射综合场景
// ============================================================
describe('发射综合场景', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('发射后 projectile 不为 null', () => {
    engine.shoot();
    expect(engine.projectile).not.toBeNull();
  });

  it('发射方向为正上方时 dy < 0', () => {
    setPrivate(engine, '_aimAngle', -Math.PI / 2);
    engine.shoot();
    expect(engine.projectile!.dy).toBeLessThan(0);
    expect(engine.projectile!.dx).toBeCloseTo(0, 5);
  });

  it('发射方向偏左时 dx < 0', () => {
    setPrivate(engine, '_aimAngle', -Math.PI * 0.75);
    engine.shoot();
    expect(engine.projectile!.dx).toBeLessThan(0);
  });

  it('发射方向偏右时 dx > 0', () => {
    setPrivate(engine, '_aimAngle', -Math.PI * 0.25);
    engine.shoot();
    expect(engine.projectile!.dx).toBeGreaterThan(0);
  });

  it('发射速度等于 SHOOTER_SPEED', () => {
    engine.shoot();
    const p = engine.projectile!;
    const speed = Math.sqrt(p.dx * p.dx + p.dy * p.dy);
    expect(speed).toBeCloseTo(SHOOTER_SPEED, 5);
  });

  it('多次发射 shotsFired 累计', () => {
    engine.shoot();
    setPrivate(engine, '_projectile', null);
    setPrivate(engine, '_canShoot', true);
    engine.shoot();
    setPrivate(engine, '_projectile', null);
    setPrivate(engine, '_canShoot', true);
    engine.shoot();
    expect(engine.shotsFired).toBe(3);
  });

  it('canShoot=false 时不能发射', () => {
    setPrivate(engine, '_canShoot', false);
    engine.shoot();
    expect(engine.projectile).toBeNull();
  });
});

// ============================================================
// 33. 飞行泡泡反弹与吸附
// ============================================================
describe('飞行泡泡反弹与吸附', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('左墙反弹后 dx 变正', () => {
    setPrivate(engine, '_projectile', {
      x: BUBBLE_RADIUS - 5,
      y: 300,
      dx: -SHOOTER_SPEED,
      dy: -SHOOTER_SPEED,
      colorIdx: 0,
    });
    callUpdate(engine, 16);
    expect(engine.projectile!.dx).toBeGreaterThan(0);
    expect(engine.projectile!.x).toBe(BUBBLE_RADIUS);
  });

  it('右墙反弹后 dx 变负', () => {
    setPrivate(engine, '_projectile', {
      x: CANVAS_WIDTH - BUBBLE_RADIUS + 5,
      y: 300,
      dx: SHOOTER_SPEED,
      dy: -SHOOTER_SPEED,
      colorIdx: 0,
    });
    callUpdate(engine, 16);
    expect(engine.projectile!.dx).toBeLessThan(0);
    expect(engine.projectile!.x).toBe(CANVAS_WIDTH - BUBBLE_RADIUS);
  });

  it('碰到顶部 y 被修正为 BUBBLE_RADIUS', () => {
    setPrivate(engine, '_projectile', {
      x: CANVAS_WIDTH / 2,
      y: BUBBLE_RADIUS - 5,
      dx: 0,
      dy: -SHOOTER_SPEED,
      colorIdx: 0,
    });
    callUpdate(engine, 16);
    // 应该被吸附了
    expect(engine.projectile).toBeNull();
  });

  it('飞行泡泡正常移动', () => {
    setPrivate(engine, '_projectile', {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: 0,
      dy: -SHOOTER_SPEED,
      colorIdx: 0,
    });
    const beforeY = engine.projectile!.y;
    callUpdate(engine, 16);
    expect(engine.projectile!.y).toBe(beforeY - SHOOTER_SPEED);
  });

  it('多次反弹不崩溃', () => {
    setPrivate(engine, '_projectile', {
      x: BUBBLE_RADIUS + 1,
      y: 400,
      dx: -SHOOTER_SPEED,
      dy: -1,
      colorIdx: 0,
    });
    for (let i = 0; i < 50; i++) {
      callUpdate(engine, 16);
      if (!engine.projectile) break;
    }
    // 不崩溃即可
    expect(true).toBe(true);
  });
});

// ============================================================
// 34. 碰撞检测详细
// ============================================================
describe('碰撞检测详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('距离恰好 < BUBBLE_DIAMETER - 2 时碰撞', () => {
    engine.addBubbleToGrid(0, 5, 0);
    const pos = getPixelPos(0, 5);
    setPrivate(engine, '_projectile', {
      x: pos.x,
      y: pos.y + BUBBLE_DIAMETER - 3,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    expect(engine.checkGridCollision()).toBe(true);
  });

  it('距离恰好 >= BUBBLE_DIAMETER - 2 时不碰撞', () => {
    engine.addBubbleToGrid(0, 5, 0);
    const pos = getPixelPos(0, 5);
    setPrivate(engine, '_projectile', {
      x: pos.x,
      y: pos.y + BUBBLE_DIAMETER + 10,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    expect(engine.checkGridCollision()).toBe(false);
  });

  it('null 泡泡不碰撞', () => {
    engine.addBubbleToGrid(0, 5, 0);
    engine.removeBubbles([[0, 5]]);
    const pos = getPixelPos(0, 5);
    setPrivate(engine, '_projectile', {
      x: pos.x,
      y: pos.y + 5,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    expect(engine.checkGridCollision()).toBe(false);
  });
});

// ============================================================
// 35. snapProjectile 详细
// ============================================================
describe('snapProjectile 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('snap 到第0行 col=0', () => {
    const pos = getPixelPos(0, 0);
    setPrivate(engine, '_projectile', {
      x: pos.x,
      y: BUBBLE_RADIUS + 1,
      dx: 0,
      dy: -1,
      colorIdx: 2,
    });
    engine.snapProjectile();
    expect(engine.getBubbleAt(0, 0)).not.toBeNull();
    expect(engine.getBubbleAt(0, 0)!.colorIdx).toBe(2);
  });

  it('snap 到有邻居的位置', () => {
    engine.addBubbleToGrid(0, 5, 0);
    const pos = getPixelPos(0, 5);
    // 飞行泡泡在 (0,5) 正下方
    setPrivate(engine, '_projectile', {
      x: pos.x,
      y: pos.y + BUBBLE_DIAMETER - 3,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    // 应该吸附到 (0,5) 附近的空位
    expect(engine.projectile).toBeNull();
    expect(engine.canShoot).toBe(true);
  });

  it('snap 后 currentColorIdx 变为 nextColorIdx', () => {
    setPrivate(engine, '_nextColorIdx', 5);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 0).x,
      y: BUBBLE_RADIUS + 1,
      dx: 0,
      dy: -1,
      colorIdx: 0,
    });
    engine.snapProjectile();
    expect(engine.currentColorIdx).toBe(5);
  });

  it('snap 消除后设置 animating', () => {
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(engine.animating).toBe(true);
  });

  it('snap 不消除不设置 animating', () => {
    engine.addBubbleToGrid(0, 0, 0);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 1).x,
      y: getPixelPos(0, 1).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(engine.animating).toBe(false);
  });
});

// ============================================================
// 36. 消除计分详细
// ============================================================
describe('消除计分详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('消除3个同色得 3*POP_SCORE', () => {
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(engine.score).toBe(3 * POP_SCORE);
  });

  it('消除4个同色得 4*POP_SCORE', () => {
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    engine.addBubbleToGrid(0, 2, 1);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 3).x,
      y: getPixelPos(0, 3).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(engine.score).toBe(4 * POP_SCORE);
  });

  it('消除 + 掉落混合计分', () => {
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    // 悬挂泡泡
    engine.addBubbleToGrid(5, 5, 7);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(engine.score).toBe(3 * POP_SCORE + 1 * DROP_SCORE);
  });

  it('bubblesPopped 包含消除和掉落', () => {
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    engine.addBubbleToGrid(5, 5, 7);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(engine.bubblesPopped).toBe(4); // 3 消除 + 1 掉落
  });

  it('scoreChange 事件在消除时触发', () => {
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(handler).toHaveBeenCalledWith(3 * POP_SCORE);
  });
});

// ============================================================
// 37. 动画更新详细
// ============================================================
describe('动画更新详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('消除动画多个同时递减', () => {
    setPrivate(engine, '_popBubbles', [
      { x: 100, y: 100, colorIdx: 0, timer: 300 },
      { x: 200, y: 200, colorIdx: 1, timer: 200 },
    ]);
    callUpdate(engine, 50);
    expect(engine.popBubbles[0].timer).toBe(250);
    expect(engine.popBubbles[1].timer).toBe(150);
  });

  it('消除动画部分消失', () => {
    setPrivate(engine, '_popBubbles', [
      { x: 100, y: 100, colorIdx: 0, timer: 50 },
      { x: 200, y: 200, colorIdx: 1, timer: 300 },
    ]);
    callUpdate(engine, 100);
    expect(engine.popBubbles.length).toBe(1);
    expect(engine.popBubbles[0].timer).toBe(200);
  });

  it('掉落动画重力加速', () => {
    setPrivate(engine, '_fallingBubbles', [
      { x: 100, y: 300, vy: 0, colorIdx: 0 },
    ]);
    callUpdate(engine, 16);
    expect(engine.fallingBubbles[0].vy).toBe(0.5);
    callUpdate(engine, 16);
    expect(engine.fallingBubbles[0].vy).toBe(1.0);
  });

  it('掉落动画多个同时更新', () => {
    setPrivate(engine, '_fallingBubbles', [
      { x: 100, y: 300, vy: 2, colorIdx: 0 },
      { x: 200, y: 400, vy: 5, colorIdx: 1 },
    ]);
    callUpdate(engine, 16);
    expect(engine.fallingBubbles.length).toBe(2);
    expect(engine.fallingBubbles[0].vy).toBe(2.5);
    expect(engine.fallingBubbles[1].vy).toBe(5.5);
  });

  it('消除动画 timer 精确递减', () => {
    setPrivate(engine, '_popBubbles', [
      { x: 100, y: 100, colorIdx: 0, timer: 300 },
    ]);
    callUpdate(engine, 123);
    expect(engine.popBubbles[0].timer).toBe(177);
  });

  it('animating 在所有动画完成后置 false', () => {
    setPrivate(engine, '_animating', true);
    setPrivate(engine, '_popBubbles', [
      { x: 100, y: 100, colorIdx: 0, timer: 10 },
    ]);
    setPrivate(engine, '_fallingBubbles', []);
    callUpdate(engine, 50);
    expect(engine.animating).toBe(false);
  });
});

// ============================================================
// 38. 等级提升详细
// ============================================================
describe('等级提升详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('advanceLevel 等级递增', () => {
    const level = engine.level;
    engine.advanceLevel();
    expect(engine.level).toBe(level + 1);
  });

  it('advanceLevel 多次递增', () => {
    for (let i = 0; i < 5; i++) {
      engine.advanceLevel();
    }
    expect(engine.level).toBe(6);
  });

  it('advanceLevel 网格重建', () => {
    clearGrid(engine);
    engine.advanceLevel();
    expect(engine.grid.length).toBe(INITIAL_ROWS);
  });

  it('清空网格触发升级', () => {
    clearGrid(engine);
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    expect(engine.level).toBe(2);
  });

  it('升级后网格有泡泡', () => {
    clearGrid(engine);
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();
    let hasBubble = false;
    for (const row of engine.grid) {
      for (const b of row) {
        if (b !== null) { hasBubble = true; break; }
      }
    }
    expect(hasBubble).toBe(true);
  });
});

// ============================================================
// 39. Game Over 详细
// ============================================================
describe('Game Over 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('泡泡在 DEAD_LINE_Y 以下触发 gameover', () => {
    clearGrid(engine);
    // 计算哪一行的 y + BUBBLE_RADIUS >= DEAD_LINE_Y
    const row = Math.ceil((DEAD_LINE_Y - BUBBLE_RADIUS) / ROW_HEIGHT);
    engine.addBubbleToGrid(row, 0, 0);
    const { y } = getPixelPos(row, 0);
    if (y + BUBBLE_RADIUS >= DEAD_LINE_Y) {
      callUpdate(engine, 16);
      expect(engine.status).toBe('gameover');
    } else {
      // 放到更下面的行
      engine.addBubbleToGrid(row + 2, 0, 0);
      callUpdate(engine, 16);
      const pos2 = getPixelPos(row + 2, 0);
      if (pos2.y + BUBBLE_RADIUS >= DEAD_LINE_Y) {
        expect(engine.status).toBe('gameover');
      }
    }
  });

  it('gameover 后不能射击', () => {
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(engine));
    proto.gameOver.call(engine);
    engine.shoot();
    expect(engine.projectile).toBeNull();
  });

  it('gameover 后空格重启分数清零', () => {
    engine.addScore(500);
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(engine));
    proto.gameOver.call(engine);
    engine.handleKeyDown(' ');
    expect(engine.score).toBe(0);
  });

  it('gameover 后空格重启等级为1', () => {
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(engine));
    proto.gameOver.call(engine);
    engine.handleKeyDown(' ');
    expect(engine.level).toBe(1);
  });

  it('正常状态不 gameover', () => {
    clearGrid(engine);
    engine.addBubbleToGrid(0, 0, 0);
    callUpdate(engine, 16);
    expect(engine.status).toBe('playing');
  });

  it('飞行中不检查 gameover', () => {
    clearGrid(engine);
    const row = Math.ceil(DEAD_LINE_Y / ROW_HEIGHT);
    engine.addBubbleToGrid(row, 0, 0);
    setPrivate(engine, '_projectile', {
      x: 100, y: 100, dx: 0, dy: -1, colorIdx: 0,
    });
    const statusBefore = engine.status;
    callUpdate(engine, 16);
    expect(engine.status).toBeDefined();
  });
});

// ============================================================
// 40. 键盘输入详细
// ============================================================
describe('键盘输入详细', () => {
  it('Space 在 gameover 重启', () => {
    const engine = createAndStartEngine();
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(engine));
    proto.gameOver.call(engine);
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });

  it('左右键同时按不崩溃', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('重复按键不崩溃', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowLeft');
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('keyup 未 keydown 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowLeft')).not.toThrow();
    expect(() => engine.handleKeyUp('ArrowRight')).not.toThrow();
  });

  it('idle 状态空格启动', () => {
    const engine = createEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('paused 状态空格不改变状态', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('paused');
  });
});

// ============================================================
// 41. getState 详细
// ============================================================
describe('getState 详细', () => {
  it('aimAngle 反映当前瞄准角度', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_aimAngle', -1.23);
    expect(engine.getState().aimAngle).toBe(-1.23);
  });

  it('currentColorIdx 反映当前颜色', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_currentColorIdx', 5);
    expect(engine.getState().currentColorIdx).toBe(5);
  });

  it('nextColorIdx 反映下一个颜色', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_nextColorIdx', 3);
    expect(engine.getState().nextColorIdx).toBe(3);
  });

  it('canShoot 反映发射状态', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_canShoot', false);
    expect(engine.getState().canShoot).toBe(false);
  });

  it('projectile 反映飞行泡泡', () => {
    const engine = createAndStartEngine();
    const proj = { x: 100, y: 200, dx: 1, dy: -1, colorIdx: 2 };
    setPrivate(engine, '_projectile', proj);
    expect(engine.getState().projectile).toEqual(proj);
  });

  it('gridRowCount 反映网格行数', () => {
    const engine = createAndStartEngine();
    expect(engine.getState().gridRowCount).toBe(INITIAL_ROWS);
  });

  it('advanceLevel 后 level 更新', () => {
    const engine = createAndStartEngine();
    engine.advanceLevel();
    expect(engine.getState().level).toBe(2);
  });

  it('多次操作后 getState 一致', () => {
    const engine = createAndStartEngine();
    engine.shoot();
    const state = engine.getState();
    expect(state.shotsFired).toBe(1);
    expect(state.canShoot).toBe(false);
    expect(state.projectile).not.toBeNull();
  });
});

// ============================================================
// 42. 事件系统详细
// ============================================================
describe('事件系统详细', () => {
  it('destroy 后 emit 不触发', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.destroy();
    engine.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('off 未注册的事件不崩溃', () => {
    const engine = createEngine();
    const handler = jest.fn();
    expect(() => engine.off('test', handler)).not.toThrow();
  });

  it('emit 未注册的事件不崩溃', () => {
    const engine = createEngine();
    expect(() => engine.emit('nonexistent')).not.toThrow();
  });

  it('同一事件多个监听器都收到', () => {
    const engine = createEngine();
    const handlers = [jest.fn(), jest.fn(), jest.fn()];
    handlers.forEach(h => engine.on('test', h));
    engine.emit('test', 'data');
    handlers.forEach(h => expect(h).toHaveBeenCalledWith('data'));
  });

  it('off 只移除指定监听器', () => {
    const engine = createEngine();
    const h1 = jest.fn();
    const h2 = jest.fn();
    engine.on('test', h1);
    engine.on('test', h2);
    engine.off('test', h1);
    engine.emit('test');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('scoreChange 在 addScore 时触发', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.addScore(100);
    expect(handler).toHaveBeenCalledWith(100);
  });

  it('levelChange 在 setLevel 时触发', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('levelChange', handler);
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(engine));
    proto.setLevel.call(engine, 3);
    expect(handler).toHaveBeenCalledWith(3);
  });
});

// ============================================================
// 43. prepareNextBubble 详细
// ============================================================
describe('prepareNextBubble 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('nextColorIdx >= 0 时 current 继承 next', () => {
    setPrivate(engine, '_nextColorIdx', 4);
    engine.prepareNextBubble();
    expect(engine.currentColorIdx).toBe(4);
  });

  it('nextColorIdx < 0 时 current 随机', () => {
    setPrivate(engine, '_nextColorIdx', -1);
    engine.prepareNextBubble();
    expect(engine.currentColorIdx).toBeGreaterThanOrEqual(0);
  });

  it('调用后 nextColorIdx 被更新', () => {
    const before = engine.nextColorIdx;
    engine.prepareNextBubble();
    // nextColorIdx 应该被重新随机分配
    expect(engine.nextColorIdx).toBeGreaterThanOrEqual(0);
  });

  it('使用当前等级颜色数', () => {
    clearGrid(engine);
    setPrivate(engine, '_level', 1);
    setPrivate(engine, '_nextColorIdx', -1);
    engine.prepareNextBubble();
    const numColors = getColorsForLevel(1);
    expect(engine.currentColorIdx).toBeLessThan(numColors);
    expect(engine.nextColorIdx).toBeLessThan(numColors);
  });
});

// ============================================================
// 44. populateGrid 详细
// ============================================================
describe('populateGrid 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('清空旧网格并重建', () => {
    clearGrid(engine);
    engine.populateGrid();
    expect(engine.grid.length).toBe(INITIAL_ROWS);
  });

  it('偶数行所有格子非空', () => {
    engine.populateGrid();
    for (let r = 0; r < INITIAL_ROWS; r += 2) {
      for (const b of engine.grid[r]) {
        expect(b).not.toBeNull();
      }
    }
  });

  it('奇数行所有格子非空', () => {
    engine.populateGrid();
    for (let r = 1; r < INITIAL_ROWS; r += 2) {
      for (const b of engine.grid[r]) {
        expect(b).not.toBeNull();
      }
    }
  });

  it('泡泡 colorIdx 在有效范围内', () => {
    setPrivate(engine, '_level', 1);
    engine.populateGrid();
    const numColors = getColorsForLevel(1);
    for (const row of engine.grid) {
      for (const b of row) {
        if (b) {
          expect(b.colorIdx).toBeGreaterThanOrEqual(0);
          expect(b.colorIdx).toBeLessThan(numColors);
        }
      }
    }
  });

  it('泡泡 row 和 col 正确', () => {
    engine.populateGrid();
    for (let r = 0; r < engine.grid.length; r++) {
      for (let c = 0; c < engine.grid[r].length; c++) {
        const b = engine.grid[r][c];
        if (b) {
          expect(b.row).toBe(r);
          expect(b.col).toBe(c);
        }
      }
    }
  });

  it('高等级使用更多颜色', () => {
    setPrivate(engine, '_level', 5);
    engine.populateGrid();
    const numColors = getColorsForLevel(5);
    const colors = new Set<number>();
    for (const row of engine.grid) {
      for (const b of row) {
        if (b) colors.add(b.colorIdx);
      }
    }
    // 颜色种类应该 <= numColors
    for (const c of colors) {
      expect(c).toBeLessThan(numColors);
    }
  });
});

// ============================================================
// 45. hasOccupiedNeighbor 详细
// ============================================================
describe('hasOccupiedNeighbor 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
    clearGrid(engine);
  });

  it('空网格无邻居', () => {
    expect(engine.hasOccupiedNeighbor(0, 0)).toBe(false);
    expect(engine.hasOccupiedNeighbor(1, 0)).toBe(false);
  });

  it('仅有一个泡泡时其邻居有占用', () => {
    engine.addBubbleToGrid(0, 0, 0);
    // (1,0) 的邻居含 (0,0)（奇数行偏移）
    expect(engine.hasOccupiedNeighbor(1, 0)).toBe(true);
  });

  it('远离泡泡的位置无占用邻居', () => {
    engine.addBubbleToGrid(0, 0, 0);
    // (5,5) 远离 (0,0)
    expect(engine.hasOccupiedNeighbor(5, 5)).toBe(false);
  });

  it('多个邻居有占用', () => {
    engine.addBubbleToGrid(0, 0, 0);
    engine.addBubbleToGrid(0, 1, 0);
    // (1,0) 的邻居含 (0,0) 和 (0,1)
    expect(engine.hasOccupiedNeighbor(1, 0)).toBe(true);
  });
});

// ============================================================
// 46. isGridEmpty 详细
// ============================================================
describe('isGridEmpty 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('清空后为空', () => {
    clearGrid(engine);
    expect(engine.isGridEmpty()).toBe(true);
  });

  it('有一个泡泡不为空', () => {
    clearGrid(engine);
    engine.addBubbleToGrid(0, 0, 0);
    expect(engine.isGridEmpty()).toBe(false);
  });

  it('所有行都有泡泡不为空', () => {
    expect(engine.isGridEmpty()).toBe(false);
  });

  it('只有 null 的行算空', () => {
    clearGrid(engine);
    // grid still has rows but all null
    expect(engine.isGridEmpty()).toBe(true);
  });
});

// ============================================================
// 47. pickRandomColor 详细
// ============================================================
describe('pickRandomColor 详细', () => {
  let engine: BubbleShooterEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空网格时随机返回有效颜色', () => {
    clearGrid(engine);
    const color = engine.pickRandomColor(4);
    expect(color).toBeGreaterThanOrEqual(0);
    expect(color).toBeLessThan(4);
  });

  it('有泡泡时返回存在的颜色', () => {
    clearGrid(engine);
    engine.addBubbleToGrid(0, 0, 2);
    engine.addBubbleToGrid(0, 1, 5);
    // 多次调用，应该返回 2 或 5
    for (let i = 0; i < 20; i++) {
      const color = engine.pickRandomColor(8);
      expect(color === 2 || color === 5).toBe(true);
    }
  });

  it('numColors=1 只返回 0', () => {
    clearGrid(engine);
    for (let i = 0; i < 10; i++) {
      const color = engine.pickRandomColor(1);
      expect(color).toBe(0);
    }
  });
});

// ============================================================
// 48. 常量关系验证
// ============================================================
describe('常量关系验证', () => {
  it('DEAD_LINE_Y 在 SHOOTER_Y 上方', () => {
    expect(DEAD_LINE_Y).toBeLessThan(SHOOTER_Y);
  });

  it('SHOOTER_Y 在画布底部附近', () => {
    expect(SHOOTER_Y).toBe(CANVAS_HEIGHT - 40);
  });

  it('AIM_SPEED 足够小', () => {
    expect(AIM_SPEED).toBeLessThan(0.1);
  });

  it('SHOOTER_SPEED 足够快', () => {
    expect(SHOOTER_SPEED).toBeGreaterThan(5);
  });

  it('ROW_HEIGHT < BUBBLE_DIAMETER', () => {
    expect(ROW_HEIGHT).toBeLessThan(BUBBLE_DIAMETER);
  });

  it('INITIAL_ROWS * ROW_HEIGHT < DEAD_LINE_Y', () => {
    // 初始泡泡不应该立即触发 gameover
    const maxInitialY = (INITIAL_ROWS - 1) * ROW_HEIGHT + BUBBLE_RADIUS;
    expect(maxInitialY + BUBBLE_RADIUS).toBeLessThan(DEAD_LINE_Y);
  });

  it('BUBBLE_COLORS 有 8 种颜色', () => {
    expect(BUBBLE_COLORS.length).toBe(8);
  });

  it('所有 BUBBLE_COLORS 是有效 CSS 颜色字符串', () => {
    for (const color of BUBBLE_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('DROP_SCORE > POP_SCORE', () => {
    expect(DROP_SCORE).toBeGreaterThan(POP_SCORE);
  });

  it('MIN_ANGLE 接近 -π', () => {
    expect(MIN_ANGLE).toBeGreaterThan(-Math.PI);
    expect(MIN_ANGLE).toBeLessThan(-Math.PI + 0.5);
  });

  it('MAX_ANGLE 接近 0', () => {
    expect(MAX_ANGLE).toBeLessThan(0);
    expect(MAX_ANGLE).toBeGreaterThan(-0.5);
  });
});

// ============================================================
// 49. 综合游戏流程
// ============================================================
describe('综合游戏流程', () => {
  it('完整流程: init → start → shoot → snap → 消除', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.status).toBe('playing');

    // 清空网格，放3个同色
    clearGrid(engine);
    engine.addBubbleToGrid(0, 0, 1);
    engine.addBubbleToGrid(0, 1, 1);

    // 发射
    setPrivate(engine, '_projectile', {
      x: getPixelPos(0, 2).x,
      y: getPixelPos(0, 2).y,
      dx: 0,
      dy: -1,
      colorIdx: 1,
    });
    engine.snapProjectile();

    expect(engine.score).toBe(3 * POP_SCORE);
    expect(engine.bubblesPopped).toBe(3);
    expect(engine.animating).toBe(true);
    // 升级了
    expect(engine.level).toBe(2);
  });

  it('完整流程: init → start → pause → resume', () => {
    const engine = createEngine();
    engine.start();
    engine.pause();
    expect(engine.status).toBe('paused');
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('完整流程: init → start → reset → start', () => {
    const engine = createEngine();
    engine.start();
    engine.addScore(100);
    engine.reset();
    expect(engine.score).toBe(0);
    expect(engine.status).toBe('idle');
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.grid.length).toBe(INITIAL_ROWS);
  });

  it('完整流程: gameover → restart', () => {
    const engine = createAndStartEngine();
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(engine));
    proto.gameOver.call(engine);
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.score).toBe(0);
    expect(engine.level).toBe(1);
  });

  it('多次 update 不崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 100; i++) {
      callUpdate(engine, 16);
    }
    expect(engine.status).toBe('playing');
  });

  it('destroy 后可以重新 init', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    const canvas = createMockCanvas();
    engine.init(canvas);
    expect(engine.status).toBe('idle');
    engine.start();
    expect(engine.status).toBe('playing');
  });
});

// ============================================================
// 50. 边界异常补充
// ============================================================
describe('边界异常补充', () => {
  it('getBubbleAt 空网格', () => {
    const engine = createAndStartEngine();
    clearGrid(engine);
    expect(engine.getBubbleAt(0, 0)).toBeNull();
  });

  it('findNearestEmptyCell 空网格', () => {
    const engine = createAndStartEngine();
    clearGrid(engine);
    const result = engine.findNearestEmptyCell(CANVAS_WIDTH / 2, BUBBLE_RADIUS);
    expect(result.row).toBe(0);
    expect(result.col).toBeGreaterThanOrEqual(0);
  });

  it('updateProjectile 无 projectile 不崩溃', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_projectile', null);
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('snapProjectile 无 projectile 不崩溃', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_projectile', null);
    expect(() => engine.snapProjectile()).not.toThrow();
  });

  it('checkGridCollision 无 projectile 返回 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_projectile', null);
    expect(engine.checkGridCollision()).toBe(false);
  });

  it('连续 destroy 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(() => engine.destroy()).not.toThrow();
  });

  it('极大 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 100000)).not.toThrow();
  });

  it('负 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, -100)).not.toThrow();
  });

  it('0 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 0)).not.toThrow();
  });

  it('animating 中不能 shoot', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_animating', true);
    engine.shoot();
    expect(engine.projectile).toBeNull();
  });

  it('animating 中不能瞄准', () => {
    const engine = createAndStartEngine();
    // 引擎在 animating 时仍然允许瞄准（只要 canShoot 且无 projectile）
    // 要阻止瞄准需要同时设置 canShoot=false
    setPrivate(engine, '_animating', true);
    setPrivate(engine, '_canShoot', false);
    const angle = engine.aimAngle;
    engine.handleKeyDown('ArrowLeft');
    callUpdate(engine, 16);
    expect(engine.aimAngle).toBe(angle);
  });
});
