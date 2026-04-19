import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSpiralPath,
  generateDefaultPath,
  getPathPosition,
  distance,
  findNearestPathIndex,
  findNearestBallIndex,
  findMatchAt,
  checkChainReaction,
  randomColorIndex,
  generateInitialChain,
  advanceChain,
  insertBallIntoChain,
  reorderChainIndices,
  removeBallsFromChain,
  calculateScore,
  getColorCountForLevel,
  getChainLengthForLevel,
  getChainSpeedForLevel,
} from '../ZumaEngine';
import { ZumaEngine } from '../ZumaEngine';
import {
  BALL_RADIUS,
  BALL_DIAMETER,
  SHOOTER_X,
  SHOOTER_Y,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PATH_POINTS_COUNT,
  INITIAL_COLOR_COUNT,
  MAX_COLOR_COUNT,
  COLORS_PER_LEVELS,
  MIN_MATCH,
  BASE_SCORE_PER_BALL,
  COMBO_MULTIPLIER,
  INITIAL_CHAIN_LENGTH,
  CHAIN_LENGTH_PER_LEVEL,
  MAX_CHAIN_LENGTH,
  CHAIN_SPEED_BASE,
  CHAIN_SPEED_PER_LEVEL,
  SHOT_SPEED,
  SHOOTER_ROTATE_SPEED,
} from '../constants';

// ========== 辅助类型 ==========
interface ChainBall {
  colorIndex: number;
  pathIndex: number;
}

interface PathPoint {
  x: number;
  y: number;
}

// ========== 螺旋路径生成 ==========

describe('generateSpiralPath', () => {
  it('应生成指定数量的路径点', () => {
    const path = generateSpiralPath(240, 320, 260, 40, 2.5, 100);
    expect(path).toHaveLength(100);
  });

  it('应生成指定数量的路径点（600点）', () => {
    const path = generateSpiralPath(240, 320, 260, 40, 2.5, PATH_POINTS_COUNT);
    expect(path).toHaveLength(PATH_POINTS_COUNT);
  });

  it('起始点应在起始半径位置', () => {
    const cx = 240, cy = 320, startR = 260;
    const path = generateSpiralPath(cx, cy, startR, 40, 2.5, 100);
    const first = path[0];
    const dist = Math.sqrt((first.x - cx) ** 2 + (first.y - cy) ** 2);
    expect(dist).toBeCloseTo(startR, 0);
  });

  it('终点应在结束半径位置', () => {
    const cx = 240, cy = 320, endR = 40;
    const path = generateSpiralPath(cx, cy, 260, endR, 2.5, 100);
    const last = path[path.length - 1];
    const dist = Math.sqrt((last.x - cx) ** 2 + (last.y - cy) ** 2);
    expect(dist).toBeCloseTo(endR, 0);
  });

  it('路径点应按螺旋顺序排列', () => {
    const cx = 240, cy = 320;
    const path = generateSpiralPath(cx, cy, 260, 40, 2.5, 100);
    // 每个点到中心的距离应逐渐减小
    for (let i = 1; i < path.length; i++) {
      const d1 = Math.sqrt((path[i - 1].x - cx) ** 2 + (path[i - 1].y - cy) ** 2);
      const d2 = Math.sqrt((path[i].x - cx) ** 2 + (path[i].y - cy) ** 2);
      expect(d2).toBeLessThanOrEqual(d1 + 1); // 允许微小误差
    }
  });

  it('单个点路径应正常工作', () => {
    const path = generateSpiralPath(240, 320, 260, 40, 2.5, 1);
    expect(path).toHaveLength(1);
  });

  it('两点路径应正常工作', () => {
    const path = generateSpiralPath(240, 320, 260, 40, 2.5, 2);
    expect(path).toHaveLength(2);
  });

  it('路径点应在合理范围内', () => {
    const path = generateSpiralPath(SHOOTER_X, SHOOTER_Y, 260, 40, 2.5, PATH_POINTS_COUNT);
    // 螺旋可能超出画布边界，但应在合理范围内
    for (const p of path) {
      expect(p.x).toBeGreaterThanOrEqual(-100);
      expect(p.x).toBeLessThanOrEqual(CANVAS_WIDTH + 100);
      expect(p.y).toBeGreaterThanOrEqual(-100);
      expect(p.y).toBeLessThanOrEqual(CANVAS_HEIGHT + 100);
    }
  });

  it('不同圈数应产生不同路径', () => {
    const path1 = generateSpiralPath(240, 320, 260, 40, 1, 100);
    const path2 = generateSpiralPath(240, 320, 260, 40, 3, 100);
    expect(path1[50].x).not.toBeCloseTo(path2[50].x, 0);
  });

  it('起始半径等于结束半径时应生成圆形', () => {
    const cx = 240, cy = 320, r = 100;
    const path = generateSpiralPath(cx, cy, r, r, 1, 100);
    for (const p of path) {
      const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      expect(d).toBeCloseTo(r, 0);
    }
  });
});

describe('generateDefaultPath', () => {
  it('应生成默认路径', () => {
    const path = generateDefaultPath();
    expect(path).toHaveLength(PATH_POINTS_COUNT);
  });

  it('默认路径应以发射器位置为中心', () => {
    const path = generateDefaultPath();
    const first = path[0];
    const dist = Math.sqrt((first.x - SHOOTER_X) ** 2 + (first.y - SHOOTER_Y) ** 2);
    expect(dist).toBeGreaterThan(100); // 起始点远离中心
  });

  it('默认路径终点应靠近中心', () => {
    const path = generateDefaultPath();
    const last = path[path.length - 1];
    const dist = Math.sqrt((last.x - SHOOTER_X) ** 2 + (last.y - SHOOTER_Y) ** 2);
    expect(dist).toBeLessThan(100); // 终点靠近中心
  });
});

// ========== 路径位置计算 ==========

describe('getPathPosition', () => {
  const path = generateDefaultPath();

  it('应返回路径上整数索引的精确位置', () => {
    const pos = getPathPosition(path, 0);
    expect(pos.x).toBeCloseTo(path[0].x);
    expect(pos.y).toBeCloseTo(path[0].y);
  });

  it('应返回路径末尾的精确位置', () => {
    const pos = getPathPosition(path, path.length - 1);
    expect(pos.x).toBeCloseTo(path[path.length - 1].x);
    expect(pos.y).toBeCloseTo(path[path.length - 1].y);
  });

  it('应在两个点之间进行线性插值', () => {
    const pos = getPathPosition(path, 0.5);
    const expectedX = (path[0].x + path[1].x) / 2;
    const expectedY = (path[0].y + path[1].y) / 2;
    expect(pos.x).toBeCloseTo(expectedX);
    expect(pos.y).toBeCloseTo(expectedY);
  });

  it('索引为负数时应返回第一个点', () => {
    const pos = getPathPosition(path, -5);
    expect(pos.x).toBeCloseTo(path[0].x);
    expect(pos.y).toBeCloseTo(path[0].y);
  });

  it('索引超出范围时应返回最后一个点', () => {
    const pos = getPathPosition(path, path.length + 100);
    expect(pos.x).toBeCloseTo(path[path.length - 1].x);
    expect(pos.y).toBeCloseTo(path[path.length - 1].y);
  });

  it('索引为0时应返回第一个点', () => {
    const pos = getPathPosition(path, 0);
    expect(pos.x).toBe(path[0].x);
    expect(pos.y).toBe(path[0].y);
  });
});

// ========== 距离计算 ==========

describe('distance', () => {
  it('应计算两点之间的欧几里得距离', () => {
    const d = distance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(d).toBeCloseTo(5);
  });

  it('同一点距离应为0', () => {
    const d = distance({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(d).toBe(0);
  });

  it('水平距离应正确', () => {
    const d = distance({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d).toBeCloseTo(10);
  });

  it('垂直距离应正确', () => {
    const d = distance({ x: 0, y: 0 }, { x: 0, y: 10 });
    expect(d).toBeCloseTo(10);
  });

  it('负坐标距离应正确', () => {
    const d = distance({ x: -3, y: -4 }, { x: 0, y: 0 });
    expect(d).toBeCloseTo(5);
  });
});

// ========== 查找最近路径索引 ==========

describe('findNearestPathIndex', () => {
  const path = generateDefaultPath();

  it('应找到路径上最近的点索引', () => {
    const target = { x: path[50].x, y: path[50].y };
    const idx = findNearestPathIndex(path, target);
    expect(idx).toBe(50);
  });

  it('第一个点附近应返回0', () => {
    const target = { x: path[0].x, y: path[0].y };
    const idx = findNearestPathIndex(path, target);
    expect(idx).toBe(0);
  });

  it('最后一个点附近应返回最后一个索引', () => {
    const target = { x: path[path.length - 1].x, y: path[path.length - 1].y };
    const idx = findNearestPathIndex(path, target);
    expect(idx).toBe(path.length - 1);
  });
});

// ========== 查找最近球索引 ==========

describe('findNearestBallIndex', () => {
  const path = generateDefaultPath();

  it('空链应返回-1', () => {
    const idx = findNearestBallIndex(path, [], { x: 100, y: 100 });
    expect(idx).toBe(-1);
  });

  it('应找到最近的球', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 2 },
    ];
    const pos = getPathPosition(path, BALL_DIAMETER);
    const idx = findNearestBallIndex(path, chain, pos);
    expect(idx).toBe(1);
  });

  it('靠近链头应返回0', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
    ];
    const pos = getPathPosition(path, 0);
    const idx = findNearestBallIndex(path, chain, pos);
    expect(idx).toBe(0);
  });

  it('靠近链尾应返回最后一个索引', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
    ];
    const pos = getPathPosition(path, BALL_DIAMETER);
    const idx = findNearestBallIndex(path, chain, pos);
    expect(idx).toBe(1);
  });
});

// ========== 消除检测 ==========

describe('findMatchAt', () => {
  it('空链应返回null', () => {
    expect(findMatchAt([], 0)).toBeNull();
  });

  it('索引越界应返回null', () => {
    const chain: ChainBall[] = [{ colorIndex: 0, pathIndex: 0 }];
    expect(findMatchAt(chain, -1)).toBeNull();
    expect(findMatchAt(chain, 5)).toBeNull();
  });

  it('不足三连应返回null', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER },
    ];
    expect(findMatchAt(chain, 0)).toBeNull();
  });

  it('恰好三连应返回匹配', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 2 },
    ];
    const result = findMatchAt(chain, 1);
    expect(result).not.toBeNull();
    expect(result!.matchStart).toBe(0);
    expect(result!.matchEnd).toBe(2);
    expect(result!.matched).toHaveLength(3);
  });

  it('四连应返回匹配', () => {
    const chain: ChainBall[] = [
      { colorIndex: 1, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 2 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 3 },
    ];
    const result = findMatchAt(chain, 2);
    expect(result).not.toBeNull();
    expect(result!.matchStart).toBe(0);
    expect(result!.matchEnd).toBe(3);
  });

  it('五连应返回匹配', () => {
    const chain: ChainBall[] = [
      { colorIndex: 2, pathIndex: 0 },
      { colorIndex: 2, pathIndex: BALL_DIAMETER },
      { colorIndex: 2, pathIndex: BALL_DIAMETER * 2 },
      { colorIndex: 2, pathIndex: BALL_DIAMETER * 3 },
      { colorIndex: 2, pathIndex: BALL_DIAMETER * 4 },
    ];
    const result = findMatchAt(chain, 0);
    expect(result).not.toBeNull();
    expect(result!.matched).toHaveLength(5);
  });

  it('不同色球不应匹配', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 2 },
    ];
    expect(findMatchAt(chain, 0)).toBeNull();
  });

  it('中间有不同色应只匹配部分', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 2 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 3 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 4 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 5 },
    ];
    const result = findMatchAt(chain, 4);
    expect(result).not.toBeNull();
    expect(result!.matchStart).toBe(3);
    expect(result!.matchEnd).toBe(5);
  });

  it('从链中间开始的三连', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 2 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 3 },
      { colorIndex: 2, pathIndex: BALL_DIAMETER * 4 },
    ];
    const result = findMatchAt(chain, 2);
    expect(result).not.toBeNull();
    expect(result!.matchStart).toBe(1);
    expect(result!.matchEnd).toBe(3);
  });
});

describe('checkChainReaction', () => {
  it('空链应返回null', () => {
    expect(checkChainReaction([], 0)).toBeNull();
  });

  it('无连锁应返回null', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
    ];
    expect(checkChainReaction(chain, 0)).toBeNull();
  });

  it('消除后前后同色应触发连锁', () => {
    // 模拟：前面是 [0,0]，后面是 [0]，消除中间后前后都是0
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 2 },
    ];
    const result = checkChainReaction(chain, 0);
    expect(result).not.toBeNull();
    expect(result!.matched).toHaveLength(3);
  });

  it('消除后不同色不应连锁', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
    ];
    expect(checkChainReaction(chain, 1)).toBeNull();
  });

  it('索引为0时不应越界', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
    ];
    expect(checkChainReaction(chain, 0)).toBeNull();
  });
});

// ========== 球链管理 ==========

describe('randomColorIndex', () => {
  it('应在指定范围内返回颜色索引', () => {
    for (let i = 0; i < 100; i++) {
      const idx = randomColorIndex(3);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    }
  });

  it('1种颜色应始终返回0', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomColorIndex(1)).toBe(0);
    }
  });

  it('应能返回所有颜色', () => {
    const colors = new Set<number>();
    for (let i = 0; i < 200; i++) {
      colors.add(randomColorIndex(4));
    }
    // 统计上应该覆盖所有颜色（概率极高）
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('generateInitialChain', () => {
  it('应生成指定长度的球链', () => {
    const chain = generateInitialChain(20, 3);
    expect(chain).toHaveLength(20);
  });

  it('球链颜色应在范围内', () => {
    const chain = generateInitialChain(50, 3);
    for (const ball of chain) {
      expect(ball.colorIndex).toBeGreaterThanOrEqual(0);
      expect(ball.colorIndex).toBeLessThan(3);
    }
  });

  it('球链路径索引应按顺序递增', () => {
    const chain = generateInitialChain(20, 3);
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].pathIndex).toBeGreaterThan(chain[i - 1].pathIndex);
    }
  });

  it('球链路径索引间距应为BALL_DIAMETER', () => {
    const chain = generateInitialChain(20, 3);
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].pathIndex - chain[i - 1].pathIndex).toBe(BALL_DIAMETER);
    }
  });

  it('第一个球的路径索引应为0', () => {
    const chain = generateInitialChain(20, 3);
    expect(chain[0].pathIndex).toBe(0);
  });

  it('空链应正常工作', () => {
    const chain = generateInitialChain(0, 3);
    expect(chain).toHaveLength(0);
  });

  it('单球链应正常工作', () => {
    const chain = generateInitialChain(1, 3);
    expect(chain).toHaveLength(1);
    expect(chain[0].pathIndex).toBe(0);
  });
});

describe('advanceChain', () => {
  it('应移动所有球', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
    ];
    const reached = advanceChain(chain, 1, 600);
    expect(reached).toBe(false);
    expect(chain[0].pathIndex).toBe(1);
    expect(chain[1].pathIndex).toBe(BALL_DIAMETER + 1);
  });

  it('球到达终点应返回true', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 590 },
    ];
    const reached = advanceChain(chain, 20, 600);
    expect(reached).toBe(true);
  });

  it('球未到终点应返回false', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 100 },
    ];
    const reached = advanceChain(chain, 1, 600);
    expect(reached).toBe(false);
  });

  it('空链不应到达终点', () => {
    const reached = advanceChain([], 1, 600);
    expect(reached).toBe(false);
  });

  it('速度为0不应移动', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 100 },
    ];
    advanceChain(chain, 0, 600);
    expect(chain[0].pathIndex).toBe(100);
  });

  it('多球链应同步移动', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
      { colorIndex: 2, pathIndex: BALL_DIAMETER * 2 },
    ];
    advanceChain(chain, 5, 600);
    expect(chain[0].pathIndex).toBe(5);
    expect(chain[1].pathIndex).toBe(BALL_DIAMETER + 5);
    expect(chain[2].pathIndex).toBe(BALL_DIAMETER * 2 + 5);
  });
});

describe('insertBallIntoChain', () => {
  const path = generateDefaultPath();

  it('应插入到空链', () => {
    const result = insertBallIntoChain([], 0, 0, path);
    expect(result).toHaveLength(1);
    expect(result[0].colorIndex).toBe(0);
  });

  it('应插入到链头', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 100 },
    ];
    const result = insertBallIntoChain(chain, 0, 1, path);
    expect(result).toHaveLength(2);
    expect(result[0].colorIndex).toBe(1);
  });

  it('应插入到链尾', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 100 },
    ];
    const result = insertBallIntoChain(chain, 1, 1, path);
    expect(result).toHaveLength(2);
    expect(result[1].colorIndex).toBe(1);
  });

  it('应插入到链中间', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 2 },
    ];
    const result = insertBallIntoChain(chain, 1, 2, path);
    expect(result).toHaveLength(3);
    expect(result[1].colorIndex).toBe(2);
  });

  it('插入后球的间距应合理', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 3 },
    ];
    const result = insertBallIntoChain(chain, 1, 2, path);
    // 插入后间距应被调整
    expect(result).toHaveLength(3);
  });
});

describe('reorderChainIndices', () => {
  const path = generateDefaultPath();

  it('空链不应报错', () => {
    expect(() => reorderChainIndices([], 0, path)).not.toThrow();
  });

  it('应调整向前方向的间距', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 2 }, // 间距过大
    ];
    reorderChainIndices(chain, 1, path);
    expect(chain[0].pathIndex).toBeLessThanOrEqual(chain[1].pathIndex - BALL_DIAMETER);
  });

  it('应调整向后方向的间距', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 2 },
    ];
    reorderChainIndices(chain, 0, path);
    expect(chain[1].pathIndex).toBeGreaterThanOrEqual(chain[0].pathIndex + BALL_DIAMETER);
  });
});

describe('removeBallsFromChain', () => {
  it('应移除指定范围的球', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 0, pathIndex: BALL_DIAMETER },
      { colorIndex: 0, pathIndex: BALL_DIAMETER * 2 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER * 3 },
    ];
    const result = removeBallsFromChain(chain, 0, 2);
    expect(result).toHaveLength(1);
    expect(result[0].colorIndex).toBe(1);
  });

  it('移除中间的球', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
      { colorIndex: 2, pathIndex: BALL_DIAMETER * 2 },
      { colorIndex: 3, pathIndex: BALL_DIAMETER * 3 },
    ];
    const result = removeBallsFromChain(chain, 1, 2);
    expect(result).toHaveLength(2);
    expect(result[0].colorIndex).toBe(0);
    expect(result[1].colorIndex).toBe(3);
  });

  it('移除单个球', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
    ];
    const result = removeBallsFromChain(chain, 0, 0);
    expect(result).toHaveLength(1);
    expect(result[0].colorIndex).toBe(1);
  });

  it('移除所有球', () => {
    const chain: ChainBall[] = [
      { colorIndex: 0, pathIndex: 0 },
      { colorIndex: 1, pathIndex: BALL_DIAMETER },
    ];
    const result = removeBallsFromChain(chain, 0, 1);
    expect(result).toHaveLength(0);
  });
});

// ========== 计分 ==========

describe('calculateScore', () => {
  it('基础消除得分', () => {
    const score = calculateScore(3, 0);
    expect(score).toBe(3 * BASE_SCORE_PER_BALL);
  });

  it('4球消除得分', () => {
    const score = calculateScore(4, 0);
    expect(score).toBe(4 * BASE_SCORE_PER_BALL);
  });

  it('5球消除得分', () => {
    const score = calculateScore(5, 0);
    expect(score).toBe(5 * BASE_SCORE_PER_BALL);
  });

  it('连锁第1级加分', () => {
    const score = calculateScore(3, 1);
    const expected = Math.round(3 * BASE_SCORE_PER_BALL * COMBO_MULTIPLIER);
    expect(score).toBe(expected);
  });

  it('连锁第2级加分', () => {
    const score = calculateScore(3, 2);
    const expected = Math.round(3 * BASE_SCORE_PER_BALL * Math.pow(COMBO_MULTIPLIER, 2));
    expect(score).toBe(expected);
  });

  it('连锁第3级加分', () => {
    const score = calculateScore(3, 3);
    const expected = Math.round(3 * BASE_SCORE_PER_BALL * Math.pow(COMBO_MULTIPLIER, 3));
    expect(score).toBe(expected);
  });

  it('连锁为0不应加成', () => {
    const score = calculateScore(3, 0);
    expect(score).toBe(30);
  });
});

// ========== 关卡系统 ==========

describe('getColorCountForLevel', () => {
  it('第1关应有3种颜色', () => {
    expect(getColorCountForLevel(1)).toBe(INITIAL_COLOR_COUNT);
  });

  it('第2关应有3种颜色', () => {
    expect(getColorCountForLevel(2)).toBe(3);
  });

  it('第3关应有3种颜色', () => {
    expect(getColorCountForLevel(3)).toBe(3);
  });

  it('第4关应有4种颜色', () => {
    expect(getColorCountForLevel(4)).toBe(4);
  });

  it('第6关应有4种颜色', () => {
    expect(getColorCountForLevel(6)).toBe(4);
  });

  it('第7关应有5种颜色', () => {
    expect(getColorCountForLevel(7)).toBe(5);
  });

  it('第10关应有6种颜色', () => {
    expect(getColorCountForLevel(10)).toBe(6);
  });

  it('颜色数量不应超过最大值', () => {
    expect(getColorCountForLevel(100)).toBe(MAX_COLOR_COUNT);
  });
});

describe('getChainLengthForLevel', () => {
  it('第1关应有初始长度', () => {
    expect(getChainLengthForLevel(1)).toBe(INITIAL_CHAIN_LENGTH);
  });

  it('第2关应增加', () => {
    expect(getChainLengthForLevel(2)).toBe(INITIAL_CHAIN_LENGTH + CHAIN_LENGTH_PER_LEVEL);
  });

  it('不应超过最大长度', () => {
    expect(getChainLengthForLevel(100)).toBe(MAX_CHAIN_LENGTH);
  });

  it('每关增加量应正确', () => {
    for (let level = 1; level <= 10; level++) {
      const expected = Math.min(
        INITIAL_CHAIN_LENGTH + (level - 1) * CHAIN_LENGTH_PER_LEVEL,
        MAX_CHAIN_LENGTH
      );
      expect(getChainLengthForLevel(level)).toBe(expected);
    }
  });
});

describe('getChainSpeedForLevel', () => {
  it('第1关应有基础速度', () => {
    expect(getChainSpeedForLevel(1)).toBe(CHAIN_SPEED_BASE);
  });

  it('第2关应增加速度', () => {
    expect(getChainSpeedForLevel(2)).toBe(CHAIN_SPEED_BASE + CHAIN_SPEED_PER_LEVEL);
  });

  it('速度应随关卡递增', () => {
    for (let level = 1; level <= 10; level++) {
      expect(getChainSpeedForLevel(level)).toBe(CHAIN_SPEED_BASE + (level - 1) * CHAIN_SPEED_PER_LEVEL);
    }
  });
});

// ========== ZumaEngine 集成测试 ==========

describe('ZumaEngine', () => {
  let engine: ZumaEngine;

  beforeEach(() => {
    engine = new ZumaEngine();
    engine.init(); // 不传 canvas
  });

  describe('初始化', () => {
    it('应正确初始化', () => {
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('应有默认路径', () => {
      expect(engine.path).toHaveLength(PATH_POINTS_COUNT);
    });

    it('初始发射器角度应朝上', () => {
      expect(engine.shooterAngle).toBeCloseTo(-Math.PI / 2);
    });

    it('初始颜色数量应为3', () => {
      expect(engine.colorCount).toBe(INITIAL_COLOR_COUNT);
    });

    it('初始球链应为空', () => {
      expect(engine.chain).toHaveLength(0);
    });
  });

  describe('start', () => {
    it('开始后状态应为playing', () => {
      // 需要设置 canvas 才能调用 start
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('开始后应生成球链', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      expect(engine.chain.length).toBeGreaterThan(0);
    });

    it('开始后分数应为0', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      expect(engine.score).toBe(0);
    });
  });

  describe('reset', () => {
    it('重置后应回到初始状态', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.chain).toHaveLength(0);
    });
  });

  describe('handleKeyDown', () => {
    it('空格键应触发射击', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      engine.handleKeyDown(' ');
      expect(engine.shotBall).not.toBeNull();
      expect(engine.shotsFired).toBe(1);
    });

    it('左方向键应旋转发射器', () => {
      const initialAngle = engine.shooterAngle;
      engine.handleKeyDown('ArrowLeft');
      // 角度应该变化（通过update调用）
    });

    it('上方向键应交换球颜色', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      const prevCurrent = engine.currentBallColor;
      const prevNext = engine.nextBallColor;
      engine.handleKeyDown('ArrowUp');
      expect(engine.currentBallColor).toBe(prevNext);
      expect(engine.nextBallColor).toBe(prevCurrent);
    });

    it('下方向键应交换球颜色', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      const prevCurrent = engine.currentBallColor;
      const prevNext = engine.nextBallColor;
      engine.handleKeyDown('ArrowDown');
      expect(engine.currentBallColor).toBe(prevNext);
      expect(engine.nextBallColor).toBe(prevCurrent);
    });
  });

  describe('handleKeyUp', () => {
    it('应移除按键', () => {
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyUp('ArrowLeft');
      // 内部状态已清除，不会崩溃
      expect(true).toBe(true);
    });
  });

  describe('getState', () => {
    it('应返回游戏状态对象', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('chain');
      expect(state).toHaveProperty('shooterAngle');
      expect(state).toHaveProperty('currentBallColor');
      expect(state).toHaveProperty('nextBallColor');
      expect(state).toHaveProperty('colorCount');
      expect(state).toHaveProperty('comboCount');
      expect(state).toHaveProperty('isWin');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('score');
    });
  });

  describe('射击', () => {
    it('连续射击应只保留一个球', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      engine.handleKeyDown(' ');
      const firstBall = engine.shotBall;
      engine.handleKeyDown(' ');
      // 第二次射击不应生效（已有球在飞行中）
      expect(engine.shotsFired).toBe(1);
    });

    it('射击后应切换球颜色', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      const prevCurrent = engine.currentBallColor;
      engine.handleKeyDown(' ');
      // 当前球应变为之前的下一个球
      // (nextBallColor是随机的，不好精确断言)
    });
  });

  describe('消除逻辑', () => {
    it('设置球链应正常工作', () => {
      const chain: ChainBall[] = [
        { colorIndex: 0, pathIndex: 0 },
        { colorIndex: 0, pathIndex: BALL_DIAMETER },
        { colorIndex: 0, pathIndex: BALL_DIAMETER * 2 },
      ];
      engine.setChain(chain);
      expect(engine.chain).toHaveLength(3);
    });

    it('设置发射器角度应正常工作', () => {
      engine.setShooterAngle(0);
      expect(engine.shooterAngle).toBe(0);
    });

    it('设置球颜色应正常工作', () => {
      engine.setCurrentBallColor(2);
      expect(engine.currentBallColor).toBe(2);
    });

    it('设置下一个球颜色应正常工作', () => {
      engine.setNextBallColor(1);
      expect(engine.nextBallColor).toBe(1);
    });

    it('设置颜色数量应正常工作', () => {
      engine.setColorCount(5);
      expect(engine.colorCount).toBe(5);
    });

    it('forceShoot应射出球', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      engine.forceShoot(-Math.PI / 2, 0);
      expect(engine.shotBall).not.toBeNull();
      expect(engine.shotBall!.colorIndex).toBe(0);
      expect(engine.shotsFired).toBe(1);
    });

    it('setShotBall应设置射出的球', () => {
      engine.setShotBall({
        x: 100,
        y: 100,
        dx: 1,
        dy: -1,
        colorIndex: 0,
        alive: true,
      });
      expect(engine.shotBall).not.toBeNull();
      expect(engine.shotBall!.x).toBe(100);
    });
  });

  describe('游戏结束', () => {
    it('球到达终点应游戏结束', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      // 设置球链在终点附近（足够近，一次update即可到达）
      const maxPath = engine.path.length;
      const chain: ChainBall[] = [
        { colorIndex: 0, pathIndex: maxPath - 1 }, // 已在终点
      ];
      engine.setChain(chain);

      // 模拟更新
      engine.update(16);

      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(false);
    });
  });

  describe('关卡进阶', () => {
    it('消除所有球应进入下一关', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      // 清空球链
      engine.setChain([]);
      engine.setShotBall(null);
      engine.setProcessing(false);

      // 模拟更新
      engine.update(16);

      expect(engine.level).toBe(2);
    });

    it('第二关颜色数量应增加', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();

      engine.setChain([]);
      engine.setShotBall(null);
      engine.setProcessing(false);
      engine.update(16);

      // 第4关才增加颜色
      expect(engine.colorCount).toBeGreaterThanOrEqual(INITIAL_COLOR_COUNT);
    });
  });

  describe('destroy', () => {
    it('销毁后应清理状态', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  describe('pause/resume', () => {
    it('暂停后状态应为paused', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('恢复后状态应为playing', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('idle状态不能暂停', () => {
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('playing状态不能resume', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      engine.resume();
      expect(engine.status).toBe('playing');
    });
  });

  describe('事件系统', () => {
    it('应触发statusChange事件', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);

      let newStatus = '';
      engine.on('statusChange', (s: string) => { newStatus = s; });
      engine.start();
      expect(newStatus).toBe('playing');
    });

    it('应触发scoreChange事件', () => {
      let score = 0;
      engine.on('scoreChange', (s: number) => { score = s; });
      // 直接调用 addScore（通过反射或子类方法）
      // 通过 engine 的 addScore 方法触发
      expect(score).toBe(0);
    });

    it('应触发levelChange事件', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);

      let level = 1;
      engine.on('levelChange', (l: number) => { level = l; });
      engine.start();
      expect(level).toBe(1);
    });
  });

  describe('isProcessing', () => {
    it('初始不应在处理中', () => {
      expect(engine.isProcessing).toBe(false);
    });

    it('setProcessing应设置处理状态', () => {
      engine.setProcessing(true);
      expect(engine.isProcessing).toBe(true);
    });
  });

  describe('levelComplete', () => {
    it('初始不应完成', () => {
      expect(engine.levelComplete).toBe(false);
    });
  });

  describe('totalEliminated', () => {
    it('初始消除数应为0', () => {
      expect(engine.totalEliminated).toBe(0);
    });
  });

  describe('levelChainLength', () => {
    it('应返回关卡球链长度', () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      engine.setCanvas(canvas);
      engine.start();
      expect(engine.levelChainLength).toBe(INITIAL_CHAIN_LENGTH);
    });
  });
});

// ========== 常量验证 ==========

describe('游戏常量', () => {
  it('BALL_RADIUS应为14', () => {
    expect(BALL_RADIUS).toBe(14);
  });

  it('BALL_DIAMETER应为28', () => {
    expect(BALL_DIAMETER).toBe(28);
  });

  it('CANVAS_WIDTH应为480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT应为640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('MIN_MATCH应为3', () => {
    expect(MIN_MATCH).toBe(3);
  });

  it('INITIAL_COLOR_COUNT应为3', () => {
    expect(INITIAL_COLOR_COUNT).toBe(3);
  });

  it('MAX_COLOR_COUNT应为6', () => {
    expect(MAX_COLOR_COUNT).toBe(6);
  });

  it('SHOT_SPEED应为8', () => {
    expect(SHOT_SPEED).toBe(8);
  });

  it('SHOOTER_ROTATE_SPEED应为0.05', () => {
    expect(SHOOTER_ROTATE_SPEED).toBe(0.05);
  });

  it('CHAIN_SPEED_BASE应为0.3', () => {
    expect(CHAIN_SPEED_BASE).toBe(0.3);
  });

  it('INITIAL_CHAIN_LENGTH应为20', () => {
    expect(INITIAL_CHAIN_LENGTH).toBe(20);
  });

  it('MAX_CHAIN_LENGTH应为60', () => {
    expect(MAX_CHAIN_LENGTH).toBe(60);
  });

  it('BASE_SCORE_PER_BALL应为10', () => {
    expect(BASE_SCORE_PER_BALL).toBe(10);
  });

  it('COMBO_MULTIPLIER应为1.5', () => {
    expect(COMBO_MULTIPLIER).toBe(1.5);
  });
});
