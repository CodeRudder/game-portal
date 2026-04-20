/**
 * BattleMap 测试
 *
 * 覆盖：Grid 模式创建和查询、Hex 模式创建和查询、
 * 设置/获取占据者、移动范围计算（BFS）、攻击范围计算、
 * 寻路（A*）、距离计算、地形效果、边界条件。
 */

import { BattleMap } from '../../modules/battle/BattleMap';
import type { MapDef } from '../../modules/battle/BattleMap';

// ============================================================
// 辅助函数
// ============================================================

/** 创建全平原方格地图定义 */
function createPlainGridDef(w: number, h: number): MapDef {
  return {
    width: w,
    height: h,
    cells: Array.from({ length: h }, () => Array(w).fill('plain')),
  };
}

/** 创建全平原六角地图定义 */
function createPlainHexDef(w: number, h: number): MapDef {
  return {
    width: w,
    height: h,
    cells: Array.from({ length: h }, () => Array(w).fill('plain')),
  };
}

/** 创建混合地形地图 */
function createMixedTerrainDef(): MapDef {
  return {
    width: 5,
    height: 5,
    cells: [
      ['plain', 'plain', 'plain', 'plain', 'plain'],
      ['plain', 'forest', 'plain', 'water', 'plain'],
      ['plain', 'plain', 'mountain', 'plain', 'plain'],
      ['plain', 'wall', 'plain', 'forest', 'plain'],
      ['plain', 'plain', 'road', 'plain', 'plain'],
    ],
  };
}

// ============================================================
// Grid 模式创建和查询
// ============================================================

describe('BattleMap — Grid 模式', () => {
  it('应正确创建方格地图', () => {
    const map = new BattleMap(createPlainGridDef(10, 8), 'grid');
    expect(map.getWidth()).toBe(10);
    expect(map.getHeight()).toBe(8);
    expect(map.getType()).toBe('grid');
  });

  it('getCell 应返回正确的格子', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    const cell = map.getCell(2, 3);
    expect(cell).not.toBeNull();
    expect(cell!.x).toBe(2);
    expect(cell!.y).toBe(3);
    expect(cell!.type).toBe('plain');
    expect(cell!.movementCost).toBe(1);
    expect(cell!.defenseBonus).toBe(0);
  });

  it('getCell 越界应返回 null', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.getCell(-1, 0)).toBeNull();
    expect(map.getCell(0, -1)).toBeNull();
    expect(map.getCell(5, 0)).toBeNull();
    expect(map.getCell(0, 5)).toBeNull();
  });

  it('应正确处理最小尺寸地图', () => {
    const map = new BattleMap({ width: 0, height: 0, cells: [] }, 'grid');
    expect(map.getWidth()).toBe(1);
    expect(map.getHeight()).toBe(1);
  });

  it('getCell 应处理未定义的地形类型为 plain', () => {
    const def: MapDef = {
      width: 3,
      height: 1,
      cells: [['plain', undefined as any, 'plain']],
    };
    const map = new BattleMap(def, 'grid');
    const cell = map.getCell(1, 0);
    expect(cell).not.toBeNull();
    expect(cell!.type).toBe('plain');
  });

  it('getAllCells 应返回所有格子', () => {
    const map = new BattleMap(createPlainGridDef(3, 2), 'grid');
    const cells = map.getAllCells();
    expect(cells.length).toBe(6);
  });
});

// ============================================================
// Hex 模式创建和查询
// ============================================================

describe('BattleMap — Hex 模式', () => {
  it('应正确创建六角地图', () => {
    const map = new BattleMap(createPlainHexDef(8, 6), 'hex');
    expect(map.getWidth()).toBe(8);
    expect(map.getHeight()).toBe(6);
    expect(map.getType()).toBe('hex');
  });

  it('getHexCell 应返回带 q/r 坐标的格子', () => {
    const map = new BattleMap(createPlainHexDef(5, 5), 'hex');
    const cell = map.getHexCell(2, 1);
    expect(cell).not.toBeNull();
    expect(cell!.q).toBe(2);
    expect(cell!.r).toBe(1);
  });

  it('getHexCell 越界应返回 null', () => {
    const map = new BattleMap(createPlainHexDef(5, 5), 'hex');
    expect(map.getHexCell(10, 0)).toBeNull();
    expect(map.getHexCell(0, 10)).toBeNull();
  });

  it('六角坐标到内部坐标的转换应正确', () => {
    const map = new BattleMap(createPlainHexDef(10, 10), 'hex');
    // q=0, r=0 -> x=0, y=0
    const cell00 = map.getHexCell(0, 0);
    expect(cell00).not.toBeNull();
    expect(cell00!.x).toBe(0);

    // q=2, r=1 -> x = 2 + floor(1/2) = 2
    const cell21 = map.getHexCell(2, 1);
    expect(cell21).not.toBeNull();
    expect(cell21!.x).toBe(2);

    // q=1, r=3 -> x = 1 + floor(3/2) = 2
    const cell13 = map.getHexCell(1, 3);
    expect(cell13).not.toBeNull();
    expect(cell13!.x).toBe(2);
  });
});

// ============================================================
// 设置/获取占据者
// ============================================================

describe('BattleMap — 占据者管理', () => {
  it('setOccupant 应正确设置占据者', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.setOccupant(2, 3, 'unit1')).toBe(true);
    expect(map.getOccupant(2, 3)).toBe('unit1');
  });

  it('setOccupant 越界应返回 false', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.setOccupant(10, 10, 'unit1')).toBe(false);
  });

  it('setOccupant null 应清除占据者', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    map.setOccupant(1, 1, 'unit1');
    expect(map.getOccupant(1, 1)).toBe('unit1');
    map.setOccupant(1, 1, null);
    expect(map.getOccupant(1, 1)).toBeNull();
  });

  it('getOccupant 越界应返回 null', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.getOccupant(-1, 0)).toBeNull();
  });

  it('setHexOccupant/getHexOccupant 应正确工作', () => {
    const map = new BattleMap(createPlainHexDef(10, 10), 'hex');
    expect(map.setHexOccupant(3, 2, 'hexUnit')).toBe(true);
    expect(map.getHexOccupant(3, 2)).toBe('hexUnit');
  });

  it('reset 应清除所有占据者', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    map.setOccupant(0, 0, 'u1');
    map.setOccupant(1, 1, 'u2');
    map.setOccupant(2, 2, 'u3');
    map.reset();
    expect(map.getOccupant(0, 0)).toBeNull();
    expect(map.getOccupant(1, 1)).toBeNull();
    expect(map.getOccupant(2, 2)).toBeNull();
  });
});

// ============================================================
// 移动范围计算（BFS）
// ============================================================

describe('BattleMap — 移动范围', () => {
  it('平原地图上移动范围应为菱形', () => {
    const map = new BattleMap(createPlainGridDef(10, 10), 'grid');
    const range = map.getMovementRange(5, 5, 2);
    // 曼哈顿距离 <= 2 的格子（不含起点），共 12 个
    expect(range.length).toBe(12);
    // 验证所有点都在范围内
    for (const p of range) {
      const dist = Math.abs(p.x - 5) + Math.abs(p.y - 5);
      expect(dist).toBeLessThanOrEqual(2);
    }
  });

  it('移动范围不应包含被占据的格子', () => {
    const map = new BattleMap(createPlainGridDef(10, 10), 'grid');
    map.setOccupant(5, 4, 'blocker');
    const range = map.getMovementRange(5, 5, 2);
    const blocked = range.find((p) => p.x === 5 && p.y === 4);
    expect(blocked).toBeUndefined();
  });

  it('森林地形消耗 2 点移动力', () => {
    const def: MapDef = {
      width: 5,
      height: 3,
      cells: [
        ['plain', 'forest', 'plain', 'plain', 'plain'],
        ['plain', 'plain', 'plain', 'plain', 'plain'],
        ['plain', 'plain', 'plain', 'plain', 'plain'],
      ],
    };
    const map = new BattleMap(def, 'grid');
    // 从 (0,1) 出发，移动力 2
    const range = map.getMovementRange(0, 1, 2);
    // 可以到 (1,1) 消耗 1，再到 (2,1) 消耗 1
    expect(range.some((p) => p.x === 2 && p.y === 1)).toBe(true);
    // 但从 (0,0) 出发，移动力 2，经过森林 (1,0) 消耗 2，只能到 (1,0)
    const range2 = map.getMovementRange(0, 0, 2);
    expect(range2.some((p) => p.x === 1 && p.y === 0)).toBe(true);
    // (2,0) 需要消耗 1 + 2 = 3 > 2，不可达
    expect(range2.some((p) => p.x === 2 && p.y === 0)).toBe(false);
  });

  it('水域和墙壁应不可通过', () => {
    const def: MapDef = {
      width: 5,
      height: 1,
      cells: [['plain', 'water', 'plain', 'wall', 'plain']],
    };
    const map = new BattleMap(def, 'grid');
    const range = map.getMovementRange(0, 0, 10);
    // 只能到达 (0,0) 左侧（没有）和右侧被阻断
    // 从 (0,0) 出发，(1,0) 是 water 不可通过
    expect(range.some((p) => p.x === 1 && p.y === 0)).toBe(false);
    expect(range.some((p) => p.x === 2 && p.y === 0)).toBe(false);
  });

  it('起点越界应返回空数组', () => {
    const map = new PlainGridDef(5, 5);
    const range = map.getMovementRange(10, 10, 5);
    expect(range).toEqual([]);
  });

  it('移动力为 0 应返回空数组', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    const range = map.getMovementRange(2, 2, 0);
    expect(range).toEqual([]);
  });

  it('六角地图移动范围应考虑六方向', () => {
    const map = new BattleMap(createPlainHexDef(10, 10), 'hex');
    const range = map.getMovementRange(5, 5, 1);
    // 六角地图 1 格移动应有 6 个邻居（不含起点）
    expect(range.length).toBeGreaterThan(0);
    expect(range.length).toBeLessThanOrEqual(6);
  });

  it('道路地形消耗 0.5 移动力', () => {
    const def: MapDef = {
      width: 5,
      height: 1,
      cells: [['plain', 'road', 'road', 'road', 'plain']],
    };
    const map = new BattleMap(def, 'grid');
    // 移动力 2，道路消耗 0.5，可以走很远
    const range = map.getMovementRange(0, 0, 2);
    // (1,0) = 0.5, (2,0) = 1.0, (3,0) = 1.5, (4,0) = 2.5 > 2 不可达
    expect(range.some((p) => p.x === 3 && p.y === 0)).toBe(true);
  });
});

// 辅助类别名
function PlainGridDef(w: number, h: number): BattleMap {
  return new BattleMap(createPlainGridDef(w, h), 'grid');
}

// ============================================================
// 攻击范围计算
// ============================================================

describe('BattleMap — 攻击范围', () => {
  it('方格地图攻击范围 1 应返回 4 个邻居', () => {
    const map = new BattleMap(createPlainGridDef(10, 10), 'grid');
    const range = map.getAttackRange(5, 5, 1);
    expect(range.length).toBe(4);
  });

  it('方格地图攻击范围 2 应返回 12 个格子', () => {
    const map = new BattleMap(createPlainGridDef(10, 10), 'grid');
    const range = map.getAttackRange(5, 5, 2);
    // 曼哈顿距离 1~2 的格子
    expect(range.length).toBe(12);
  });

  it('攻击范围不应包含起点', () => {
    const map = new BattleMap(createPlainGridDef(10, 10), 'grid');
    const range = map.getAttackRange(5, 5, 3);
    expect(range.some((p) => p.x === 5 && p.y === 5)).toBe(false);
  });

  it('边缘位置的攻击范围应被截断', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    const range = map.getAttackRange(0, 0, 2);
    // (0,0) 的曼哈顿距离 1~2 的格子在 5x5 地图内
    expect(range.length).toBeLessThan(12);
    expect(range.every((p) => p.x >= 0 && p.x < 5 && p.y >= 0 && p.y < 5)).toBe(true);
  });

  it('攻击范围 0 应返回空数组', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.getAttackRange(2, 2, 0)).toEqual([]);
  });

  it('起点越界应返回空数组', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.getAttackRange(10, 10, 3)).toEqual([]);
  });

  it('六角地图攻击范围应使用六角距离', () => {
    const map = new BattleMap(createPlainHexDef(10, 10), 'hex');
    const range = map.getAttackRange(5, 5, 1);
    // 六角距离 1 应有最多 6 个邻居
    expect(range.length).toBeGreaterThan(0);
    expect(range.length).toBeLessThanOrEqual(6);
  });
});

// ============================================================
// 寻路（A*）
// ============================================================

describe('BattleMap — 寻路', () => {
  it('直线路径应正确', () => {
    const map = new BattleMap(createPlainGridDef(10, 10), 'grid');
    const path = map.findPath(0, 0, 3, 0);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 0 });
    expect(path!.length).toBe(4); // (0,0) -> (1,0) -> (2,0) -> (3,0)
  });

  it('起点等于终点应返回单元素路径', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    const path = map.findPath(2, 2, 2, 2);
    expect(path).toEqual([{ x: 2, y: 2 }]);
  });

  it('不可通过的格子应绕行', () => {
    const def: MapDef = {
      width: 5,
      height: 3,
      cells: [
        ['plain', 'wall', 'plain', 'plain', 'plain'],
        ['plain', 'wall', 'plain', 'plain', 'plain'],
        ['plain', 'plain', 'plain', 'plain', 'plain'],
      ],
    };
    const map = new BattleMap(def, 'grid');
    const path = map.findPath(0, 0, 2, 0);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 2, y: 0 });
    // 路径不应经过 (1,0) 或 (1,1)（wall）
    for (const p of path!) {
      const cell = map.getCell(p.x, p.y);
      expect(cell!.type).not.toBe('wall');
    }
  });

  it('完全被阻断应返回 null', () => {
    const def: MapDef = {
      width: 5,
      height: 3,
      cells: [
        ['plain', 'wall', 'plain', 'plain', 'plain'],
        ['plain', 'wall', 'plain', 'plain', 'plain'],
        ['plain', 'wall', 'plain', 'plain', 'plain'],
      ],
    };
    const map = new BattleMap(def, 'grid');
    const path = map.findPath(0, 0, 4, 0);
    expect(path).toBeNull();
  });

  it('越界坐标应返回 null', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.findPath(-1, 0, 3, 0)).toBeNull();
    expect(map.findPath(0, 0, 10, 10)).toBeNull();
  });

  it('路径应考虑地形消耗', () => {
    const def: MapDef = {
      width: 5,
      height: 1,
      cells: [['plain', 'road', 'road', 'road', 'plain']],
    };
    const map = new BattleMap(def, 'grid');
    const path = map.findPath(0, 0, 4, 0);
    expect(path).not.toBeNull();
    // 应该走道路（消耗更低）
    expect(path!.length).toBe(5);
  });

  it('六角地图寻路应工作', () => {
    const map = new BattleMap(createPlainHexDef(10, 10), 'hex');
    const path = map.findPath(0, 0, 3, 3);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 3 });
  });
});

// ============================================================
// 距离计算
// ============================================================

describe('BattleMap — 距离计算', () => {
  it('方格地图应使用曼哈顿距离', () => {
    const map = new BattleMap(createPlainGridDef(10, 10), 'grid');
    expect(map.getDistance(0, 0, 3, 4)).toBe(7);
    expect(map.getDistance(2, 2, 2, 2)).toBe(0);
    expect(map.getDistance(0, 0, 0, 5)).toBe(5);
  });

  it('六角地图应使用六角距离', () => {
    const map = new BattleMap(createPlainHexDef(10, 10), 'hex');
    // 六角距离公式：max(|q1-q2|, |r1-r2|, |(q1+r1)-(q2+r2)|)
    expect(map.getDistance(0, 0, 0, 0)).toBe(0);
    // (0,0) -> (1,0): max(1, 0, 1) = 1
    expect(map.getDistance(0, 0, 1, 0)).toBe(1);
    // (0,0) -> (1,1): max(1, 1, 2) = 2
    expect(map.getDistance(0, 0, 1, 1)).toBe(2);
    // (0,0) -> (3,3): max(3, 3, 6) = 6
    expect(map.getDistance(0, 0, 3, 3)).toBe(6);
  });
});

// ============================================================
// 地形效果
// ============================================================

describe('BattleMap — 地形效果', () => {
  it('各种地形应有正确的移动消耗', () => {
    const map = new BattleMap(createMixedTerrainDef(), 'grid');
    expect(map.getMovementCost(0, 0)).toBe(1);    // plain
    expect(map.getMovementCost(1, 1)).toBe(2);    // forest
    expect(map.getMovementCost(2, 2)).toBe(3);    // mountain
    expect(map.getMovementCost(3, 1)).toBe(Infinity); // water
    expect(map.getMovementCost(1, 3)).toBe(Infinity); // wall
    expect(map.getMovementCost(2, 4)).toBe(0.5);  // road
  });

  it('各种地形应有正确的防御加成', () => {
    const map = new BattleMap(createMixedTerrainDef(), 'grid');
    expect(map.getDefenseBonus(0, 0)).toBe(0);    // plain
    expect(map.getDefenseBonus(1, 1)).toBe(0.1);  // forest
    expect(map.getDefenseBonus(2, 2)).toBe(0.2);  // mountain
    expect(map.getDefenseBonus(1, 3)).toBe(0.3);  // wall
  });

  it('越界位置防御加成应为 0', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.getDefenseBonus(10, 10)).toBe(0);
  });

  it('越界位置移动消耗应为 Infinity', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    expect(map.getMovementCost(10, 10)).toBe(Infinity);
  });

  it('castle 地形应有 0.25 防御加成', () => {
    const def: MapDef = {
      width: 3,
      height: 1,
      cells: [['castle']],
    };
    const map = new BattleMap({ width: 1, height: 1, cells: [['castle']] }, 'grid');
    expect(map.getDefenseBonus(0, 0)).toBe(0.25);
    expect(map.getMovementCost(0, 0)).toBe(1);
  });

  it('bridge 地形消耗应为 1', () => {
    const map = new BattleMap({ width: 1, height: 1, cells: [['bridge']] }, 'grid');
    expect(map.getMovementCost(0, 0)).toBe(1);
    expect(map.getDefenseBonus(0, 0)).toBe(0);
  });
});

// ============================================================
// 边界条件
// ============================================================

describe('BattleMap — 边界条件', () => {
  it('1x1 地图应正常工作', () => {
    const map = new BattleMap({ width: 1, height: 1, cells: [['plain']] }, 'grid');
    expect(map.getWidth()).toBe(1);
    expect(map.getHeight()).toBe(1);
    expect(map.getCell(0, 0)).not.toBeNull();
    expect(map.getMovementRange(0, 0, 5)).toEqual([]);
    expect(map.getAttackRange(0, 0, 1)).toEqual([]);
  });

  it('大量格子时应正常工作', () => {
    const map = new BattleMap(createPlainGridDef(50, 50), 'grid');
    expect(map.getWidth()).toBe(50);
    expect(map.getHeight()).toBe(50);
    const range = map.getMovementRange(25, 25, 5);
    expect(range.length).toBeGreaterThan(0);
  });

  it('重复设置占据者应覆盖', () => {
    const map = new BattleMap(createPlainGridDef(5, 5), 'grid');
    map.setOccupant(2, 2, 'unit1');
    expect(map.getOccupant(2, 2)).toBe('unit1');
    map.setOccupant(2, 2, 'unit2');
    expect(map.getOccupant(2, 2)).toBe('unit2');
  });

  it('reset 后地图地形不变', () => {
    const map = new BattleMap(createMixedTerrainDef(), 'grid');
    map.setOccupant(0, 0, 'u1');
    map.reset();
    expect(map.getCell(0, 0)!.type).toBe('plain');
    expect(map.getCell(1, 1)!.type).toBe('forest');
  });
});
