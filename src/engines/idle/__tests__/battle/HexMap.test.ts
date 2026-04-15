/**
 * HexMap 单元测试
 *
 * 覆盖六角网格地图的所有核心功能：
 * - 创建与初始化
 * - 单元格操作
 * - 单位位置管理
 * - 地形属性
 * - 邻居与距离
 * - A* 寻路
 * - 可达范围
 * - 攻击范围
 * - 坐标转换
 * - 工厂方法
 * - 序列化/反序列化
 * - 重置
 * - 边界条件
 */

import { describe, it, expect } from 'vitest';
import { HexMap } from '../../modules/battle/HexMap';
import type { HexMapDef, HexCell } from '../../modules/battle/HexMap';
import type { TerrainType } from '../../modules/battle/HexMap';

// ============================================================
// 测试套件
// ============================================================

describe('HexMap', () => {
  // ============================================================
  // 创建与初始化
  // ============================================================

  describe('创建与初始化', () => {
    it('应从 HexMapDef 创建六角地图', () => {
      const hexMap = HexMap.createHexGrid(3);
      expect(hexMap.getRadius()).toBe(3);
    });

    it('应正确加载单元格数据', () => {
      const hexMap = HexMap.createHexGrid(2);
      const cell = hexMap.getCell(0, 0);
      expect(cell).not.toBeNull();
      expect(cell!.terrain).toBe('plain');
    });

    it('应加载带单位 ID 的单元格', () => {
      const cells: HexCell[] = [
        { q: 0, r: 0, terrain: 'plain', unitId: 'hero' },
        { q: 1, r: 0, terrain: 'plain', unitId: null },
        { q: 0, r: 1, terrain: 'plain', unitId: null },
        { q: -1, r: 1, terrain: 'plain', unitId: null },
        { q: -1, r: 0, terrain: 'plain', unitId: null },
        { q: 0, r: -1, terrain: 'plain', unitId: null },
        { q: 1, r: -1, terrain: 'plain', unitId: null },
      ];
      const def: HexMapDef = { radius: 1, cells };
      const hexMap = new HexMap(def);
      expect(hexMap.getUnitPosition('hero')).toEqual({ q: 0, r: 0 });
    });

    it('radius 最小为 0', () => {
      const hexMap = HexMap.createHexGrid(-1);
      expect(hexMap.getRadius()).toBe(0);
    });
  });

  // ============================================================
  // 单元格操作
  // ============================================================

  describe('单元格操作', () => {
    it('getCell 应返回指定坐标的六角格', () => {
      const hexMap = HexMap.createHexGrid(3);
      const cell = hexMap.getCell(1, -1);
      expect(cell).not.toBeNull();
      expect(cell!.q).toBe(1);
      expect(cell!.r).toBe(-1);
    });

    it('getCell 不存在的坐标应返回 null', () => {
      const hexMap = HexMap.createHexGrid(1);
      expect(hexMap.getCell(5, 5)).toBeNull();
    });

    it('setCell 应更新地形类型', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setCell(0, 0, 'forest');
      expect(hexMap.getCell(0, 0)!.terrain).toBe('forest');
    });

    it('setCell 不存在的坐标应静默忽略', () => {
      const hexMap = HexMap.createHexGrid(1);
      expect(() => hexMap.setCell(10, 10, 'forest')).not.toThrow();
    });

    it('setCell 应保留单位 ID', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('hero', 0, 0);
      hexMap.setCell(0, 0, 'mountain');
      // mountain 不可通过，但 setCell 只改地形不检查
      expect(hexMap.getCell(0, 0)!.unitId).toBe('hero');
    });
  });

  // ============================================================
  // 单位位置管理
  // ============================================================

  describe('单位位置管理', () => {
    it('setUnitPosition 应成功放置单位', () => {
      const hexMap = HexMap.createHexGrid(3);
      expect(hexMap.setUnitPosition('hero', 0, 0)).toBe(true);
      expect(hexMap.getUnitPosition('hero')).toEqual({ q: 0, r: 0 });
    });

    it('setUnitPosition 应更新单元格 unitId', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('hero', 1, -1);
      expect(hexMap.getCell(1, -1)!.unitId).toBe('hero');
    });

    it('setUnitPosition 移动时应清除旧位置', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('hero', 0, 0);
      hexMap.setUnitPosition('hero', 1, 0);
      expect(hexMap.getCell(0, 0)!.unitId).toBeNull();
      expect(hexMap.getCell(1, 0)!.unitId).toBe('hero');
    });

    it('setUnitPosition 不可通过地形应失败', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setCell(1, 0, 'water');
      expect(hexMap.setUnitPosition('hero', 1, 0)).toBe(false);
    });

    it('setUnitPosition 被其他单位占用应失败', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('hero', 0, 0);
      expect(hexMap.setUnitPosition('enemy', 0, 0)).toBe(false);
    });

    it('setUnitPosition 不存在的坐标应失败', () => {
      const hexMap = HexMap.createHexGrid(1);
      expect(hexMap.setUnitPosition('hero', 5, 5)).toBe(false);
    });

    it('getUnitPosition 不存在的单位应返回 null', () => {
      const hexMap = HexMap.createHexGrid(3);
      expect(hexMap.getUnitPosition('nonexistent')).toBeNull();
    });

    it('removeUnit 应移除单位', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('hero', 0, 0);
      hexMap.removeUnit('hero');
      expect(hexMap.getUnitPosition('hero')).toBeNull();
      expect(hexMap.getCell(0, 0)!.unitId).toBeNull();
    });

    it('removeUnit 不存在的单位应静默忽略', () => {
      const hexMap = HexMap.createHexGrid(3);
      expect(() => hexMap.removeUnit('nonexistent')).not.toThrow();
    });
  });

  // ============================================================
  // 地形属性
  // ============================================================

  describe('地形属性', () => {
    it('HexMap.getTerrainProps 应返回与 BattleMap 一致的结果', () => {
      const props = HexMap.getTerrainProps('forest');
      expect(props.moveCost).toBe(2);
      expect(props.defenseBonus).toBe(0.2);
      expect(props.isPassable).toBe(true);
    });

    it('不可通过地形属性应正确', () => {
      const props = HexMap.getTerrainProps('mountain');
      expect(props.isPassable).toBe(false);
    });
  });

  // ============================================================
  // 邻居与距离
  // ============================================================

  describe('邻居与距离', () => {
    it('中心格应有 6 个邻居', () => {
      const hexMap = HexMap.createHexGrid(2);
      const neighbors = hexMap.getNeighbors(0, 0);
      expect(neighbors).toHaveLength(6);
    });

    it('边缘格的邻居应少于 6 个', () => {
      const hexMap = HexMap.createHexGrid(1);
      const neighbors = hexMap.getNeighbors(1, 0);
      // radius=1 时，(1,0) 在边缘，邻居数少于 6
      expect(neighbors.length).toBeLessThan(6);
    });

    it('邻居方向应正确', () => {
      const hexMap = HexMap.createHexGrid(3);
      const neighbors = hexMap.getNeighbors(0, 0);
      const expected = [
        { q: 1, r: 0 }, { q: -1, r: 0 },
        { q: 0, r: 1 }, { q: 0, r: -1 },
        { q: 1, r: -1 }, { q: -1, r: 1 },
      ];
      for (const exp of expected) {
        expect(neighbors).toContainEqual(exp);
      }
    });

    it('hexDistance 自身距离应为 0', () => {
      const hexMap = HexMap.createHexGrid(3);
      expect(hexMap.hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    });

    it('hexDistance 相邻格距离应为 1', () => {
      const hexMap = HexMap.createHexGrid(3);
      expect(hexMap.hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
      expect(hexMap.hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
      expect(hexMap.hexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
    });

    it('hexDistance 远距离应正确', () => {
      const hexMap = HexMap.createHexGrid(5);
      expect(hexMap.hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    });

    it('hexDistance 应对称', () => {
      const hexMap = HexMap.createHexGrid(5);
      const d1 = hexMap.hexDistance({ q: 1, r: 2 }, { q: 3, r: -1 });
      const d2 = hexMap.hexDistance({ q: 3, r: -1 }, { q: 1, r: 2 });
      expect(d1).toBe(d2);
    });
  });

  // ============================================================
  // A* 寻路
  // ============================================================

  describe('A* 寻路', () => {
    it('起点等于终点应返回空路径', () => {
      const hexMap = HexMap.createHexGrid(3);
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 0, r: 0 });
      expect(result.reachable).toBe(true);
      expect(result.path).toHaveLength(1);
      expect(result.totalCost).toBe(0);
    });

    it('相邻格寻路应正确', () => {
      const hexMap = HexMap.createHexGrid(3);
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 1, r: 0 });
      expect(result.reachable).toBe(true);
      expect(result.path).toHaveLength(2);
      expect(result.totalCost).toBe(1);
    });

    it('应绕过不可通过的地形', () => {
      const hexMap = HexMap.createHexGrid(3);
      // 封锁 (1,0) 和 (0,1)
      hexMap.setCell(1, 0, 'wall');
      hexMap.setCell(0, 1, 'wall');
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 2, r: 0 });
      expect(result.reachable).toBe(true);
      // 路径不应经过被封锁的格子
      for (const p of result.path) {
        expect(p.x === 1 && p.y === 0).toBe(false);
        expect(p.x === 0 && p.y === 1).toBe(false);
      }
    });

    it('被完全包围时应不可达', () => {
      const hexMap = HexMap.createHexGrid(3);
      // 封锁 (0,0) 的所有邻居
      hexMap.setCell(1, 0, 'wall');
      hexMap.setCell(-1, 0, 'wall');
      hexMap.setCell(0, 1, 'wall');
      hexMap.setCell(0, -1, 'wall');
      hexMap.setCell(1, -1, 'wall');
      hexMap.setCell(-1, 1, 'wall');
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 3, r: 0 });
      expect(result.reachable).toBe(false);
    });

    it('不存在的坐标应不可达', () => {
      const hexMap = HexMap.createHexGrid(1);
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 5, r: 5 });
      expect(result.reachable).toBe(false);
    });

    it('终点不可通过应不可达', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setCell(2, 0, 'water');
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 2, r: 0 });
      expect(result.reachable).toBe(false);
    });

    it('maxCost 限制应正确', () => {
      const hexMap = HexMap.createHexGrid(5);
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 4, r: 0 }, 2);
      expect(result.reachable).toBe(false);
    });

    it('森林地形应增加路径消耗', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setCell(1, 0, 'forest');
      const result = hexMap.findPath({ q: 0, r: 0 }, { q: 2, r: 0 });
      expect(result.reachable).toBe(true);
      expect(result.totalCost).toBeGreaterThanOrEqual(3); // 1 + 2 = 3
    });
  });

  // ============================================================
  // 可达范围
  // ============================================================

  describe('可达范围', () => {
    it('movePower=0 应只包含起点', () => {
      const hexMap = HexMap.createHexGrid(3);
      const reachable = hexMap.getReachableHexes({ q: 0, r: 0 }, 0);
      expect(reachable).toHaveLength(1);
    });

    it('movePower=1 应包含起点和可达邻居', () => {
      const hexMap = HexMap.createHexGrid(3);
      const reachable = hexMap.getReachableHexes({ q: 0, r: 0 }, 1);
      // 起点 + 6 个邻居（如果都在地图内且都是 plain）
      expect(reachable.length).toBe(7);
    });

    it('不可通过的地形应排除', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setCell(1, 0, 'wall');
      const reachable = hexMap.getReachableHexes({ q: 0, r: 0 }, 1);
      const hasWall = reachable.some((c) => c.q === 1 && c.r === 0);
      expect(hasWall).toBe(false);
    });

    it('被单位占据的格子应排除', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('blocker', 1, 0);
      const reachable = hexMap.getReachableHexes({ q: 0, r: 0 }, 1);
      const hasBlocker = reachable.some((c) => c.q === 1 && c.r === 0);
      expect(hasBlocker).toBe(false);
    });

    it('不存在的起点应返回空数组', () => {
      const hexMap = HexMap.createHexGrid(1);
      const reachable = hexMap.getReachableHexes({ q: 5, r: 5 }, 3);
      expect(reachable).toEqual([]);
    });
  });

  // ============================================================
  // 攻击范围
  // ============================================================

  describe('攻击范围', () => {
    it('范围 (1,1) 应包含 6 个相邻格', () => {
      const hexMap = HexMap.createHexGrid(3);
      const range = hexMap.getAttackRange({ q: 0, r: 0 }, 1, 1);
      expect(range).toHaveLength(6);
    });

    it('范围 (2,3) 应包含正确距离的格子', () => {
      const hexMap = HexMap.createHexGrid(5);
      const range = hexMap.getAttackRange({ q: 0, r: 0 }, 2, 3);
      for (const cell of range) {
        const dist = hexMap.hexDistance({ q: 0, r: 0 }, { q: cell.q, r: cell.r });
        expect(dist).toBeGreaterThanOrEqual(2);
        expect(dist).toBeLessThanOrEqual(3);
      }
    });

    it('范围 (0,0) 不应包含中心点', () => {
      const hexMap = HexMap.createHexGrid(3);
      const range = hexMap.getAttackRange({ q: 0, r: 0 }, 1, 3);
      const hasCenter = range.some((c) => c.q === 0 && c.r === 0);
      expect(hasCenter).toBe(false);
    });
  });

  // ============================================================
  // 坐标转换
  // ============================================================

  describe('坐标转换', () => {
    it('hexToPixel 原点应返回 (0,0)', () => {
      const result = HexMap.hexToPixel(0, 0, 30);
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });

    it('pixelToHex → hexToPixel 应往返一致', () => {
      const hexSize = 30;
      const hex = { q: 2, r: -1 };
      const pixel = HexMap.hexToPixel(hex.q, hex.r, hexSize);
      const roundTrip = HexMap.pixelToHex(pixel.x, pixel.y, hexSize);
      expect(roundTrip.q).toBe(hex.q);
      expect(roundTrip.r).toBe(hex.r);
    });

    it('hexToPixel 不同 hexSize 应缩放', () => {
      const p1 = HexMap.hexToPixel(1, 0, 10);
      const p2 = HexMap.hexToPixel(1, 0, 20);
      expect(p2.x).toBeCloseTo(p1.x * 2, 5);
      expect(p2.y).toBeCloseTo(p1.y * 2, 5);
    });

    it('hexSize 最小为 1', () => {
      const result = HexMap.hexToPixel(1, 0, -5);
      const expected = HexMap.hexToPixel(1, 0, 1);
      expect(result.x).toBeCloseTo(expected.x, 5);
      expect(result.y).toBeCloseTo(expected.y, 5);
    });

    it('pixelToHex 应正确四舍五入', () => {
      const hexSize = 30;
      // 精确的六角格中心
      const pixel = HexMap.hexToPixel(1, 1, hexSize);
      const hex = HexMap.pixelToHex(pixel.x, pixel.y, hexSize);
      expect(hex.q).toBe(1);
      expect(hex.r).toBe(1);
    });
  });

  // ============================================================
  // 工厂方法
  // ============================================================

  describe('工厂方法', () => {
    it('createHexGrid radius=0 应只有 1 个格子', () => {
      const hexMap = HexMap.createHexGrid(0);
      const state = hexMap.getState();
      expect(state.cells).toHaveLength(1);
      expect(hexMap.getCell(0, 0)).not.toBeNull();
    });

    it('createHexGrid radius=1 应有 7 个格子', () => {
      const hexMap = HexMap.createHexGrid(1);
      const state = hexMap.getState();
      // 3*1*2 + 1 = 7
      expect(state.cells).toHaveLength(7);
    });

    it('createHexGrid radius=2 应有 19 个格子', () => {
      const hexMap = HexMap.createHexGrid(2);
      const state = hexMap.getState();
      // 3*2*3 + 1 = 19
      expect(state.cells).toHaveLength(19);
    });

    it('createHexGrid radius=3 应有 37 个格子', () => {
      const hexMap = HexMap.createHexGrid(3);
      const state = hexMap.getState();
      // 3*3*4 + 1 = 37
      expect(state.cells).toHaveLength(37);
    });

    it('createHexGrid 默认地形应为 plain', () => {
      const hexMap = HexMap.createHexGrid(2);
      expect(hexMap.getCell(0, 0)!.terrain).toBe('plain');
    });

    it('createHexGrid 应支持自定义默认地形', () => {
      const hexMap = HexMap.createHexGrid(2, 'desert');
      expect(hexMap.getCell(0, 0)!.terrain).toBe('desert');
    });
  });

  // ============================================================
  // 序列化
  // ============================================================

  describe('序列化', () => {
    it('getState 应返回正确的 HexMapDef', () => {
      const hexMap = HexMap.createHexGrid(2);
      const state = hexMap.getState();
      expect(state.radius).toBe(2);
      expect(state.cells).toHaveLength(19);
    });

    it('getState 应包含单位信息', () => {
      const hexMap = HexMap.createHexGrid(2);
      hexMap.setUnitPosition('hero', 1, 0);
      const state = hexMap.getState();
      const heroCell = state.cells.find((c) => c.unitId === 'hero');
      expect(heroCell).toBeDefined();
      expect(heroCell!.q).toBe(1);
      expect(heroCell!.r).toBe(0);
    });

    it('从 getState 重建地图应保持一致', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setCell(1, 0, 'forest');
      hexMap.setUnitPosition('hero', 0, 0);
      const state = hexMap.getState();
      const hexMap2 = new HexMap(state);
      expect(hexMap2.getRadius()).toBe(3);
      expect(hexMap2.getCell(1, 0)!.terrain).toBe('forest');
      expect(hexMap2.getUnitPosition('hero')).toEqual({ q: 0, r: 0 });
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('重置', () => {
    it('reset 应清除所有单位位置', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('hero', 0, 0);
      hexMap.setUnitPosition('enemy', 1, 0);
      hexMap.reset();
      expect(hexMap.getUnitPosition('hero')).toBeNull();
      expect(hexMap.getUnitPosition('enemy')).toBeNull();
    });

    it('reset 应保留地形', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setCell(0, 0, 'forest');
      hexMap.reset();
      expect(hexMap.getCell(0, 0)!.terrain).toBe('forest');
    });

    it('reset 后单元格 unitId 应为 null', () => {
      const hexMap = HexMap.createHexGrid(3);
      hexMap.setUnitPosition('hero', 0, 0);
      hexMap.reset();
      expect(hexMap.getCell(0, 0)!.unitId).toBeNull();
    });
  });
});
