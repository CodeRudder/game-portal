/**
 * CityMapSystem + ResourcePointSystem 单元测试
 * @module games/three-kingdoms/__tests__/CityMapAndResource.test
 */

import { describe, it, expect } from 'vitest';
import { CityMapSystem, type CityBuildingType } from '../CityMapSystem';
import { ResourcePointSystem, type ResourcePointType } from '../ResourcePointSystem';

// ═══════════════════════════════════════════════════════════════
// 辅助：生成测试用地图瓦片
// ═══════════════════════════════════════════════════════════════

function makeTestTiles(): { x: number; y: number; terrain: string }[][] {
  const terrains = ['plain', 'mountain', 'forest', 'water', 'plain', 'village'];
  const grid: { x: number; y: number; terrain: string }[][] = [];
  for (let y = 0; y < 6; y++) {
    const row: { x: number; y: number; terrain: string }[] = [];
    for (let x = 0; x < 8; x++) {
      row.push({ x, y, terrain: terrains[(x + y) % terrains.length] });
    }
    grid.push(row);
  }
  return grid;
}

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('CityMapSystem', () => {
  // ── 1. 城市地图生成（不同领土类型有不同建筑）──
  it('都城应有衙门+民居×3+商铺×2+兵营+市场+书院+酒馆', () => {
    const sys = new CityMapSystem();
    const map = sys.generateCityMap('luoyang', '洛阳', 'capital');
    const types = map.buildings.map(b => b.type);
    expect(types.filter(t => t === 'yamen')).toHaveLength(1);
    expect(types.filter(t => t === 'residence')).toHaveLength(3);
    expect(types.filter(t => t === 'shop')).toHaveLength(2);
    expect(types.filter(t => t === 'barracks')).toHaveLength(1);
    expect(types.filter(t => t === 'market')).toHaveLength(1);
    expect(types.filter(t => t === 'academy')).toHaveLength(1);
    expect(types.filter(t => t === 'tavern')).toHaveLength(1);
  });

  it('城市应有衙门+民居×2+商铺+兵营+市场+铁匠铺', () => {
    const sys = new CityMapSystem();
    const map = sys.generateCityMap('chengdu', '成都', 'plains');
    const types = map.buildings.map(b => b.type);
    expect(types.filter(t => t === 'yamen')).toHaveLength(1);
    expect(types.filter(t => t === 'residence')).toHaveLength(2);
    expect(types.filter(t => t === 'smithy')).toHaveLength(1);
  });

  it('关卡应只有兵营×2+城墙+铁匠铺', () => {
    const sys = new CityMapSystem();
    const map = sys.generateCityMap('hanzhong', '汉中', 'mountain');
    expect(map.buildings).toHaveLength(4);
    const types = map.buildings.map(b => b.type);
    expect(types.filter(t => t === 'barracks')).toHaveLength(2);
    expect(types.filter(t => t === 'wall')).toHaveLength(1);
    expect(types.filter(t => t === 'smithy')).toHaveLength(1);
  });

  // ── 2. 城市建筑布局 ──
  it('每栋建筑应有有效位置和尺寸', () => {
    const sys = new CityMapSystem();
    const map = sys.generateCityMap('luoyang', '洛阳', 'capital');
    map.buildings.forEach(b => {
      expect(b.position.x).toBeGreaterThanOrEqual(0);
      expect(b.position.y).toBeGreaterThanOrEqual(0);
      expect(b.size.w).toBeGreaterThan(0);
      expect(b.size.h).toBeGreaterThan(0);
      expect(b.level).toBe(1);
    });
  });

  it('都城初始繁荣度应为 80', () => {
    const sys = new CityMapSystem();
    const map = sys.generateCityMap('luoyang', '洛阳', 'capital');
    expect(map.prosperity).toBe(80);
    expect(map.population).toBe(50000);
  });

  // ── 3. 城市税收计算 ──
  it('税收应包含 gold、grain、troops', () => {
    const sys = new CityMapSystem();
    sys.generateCityMap('luoyang', '洛阳', 'capital');
    const tax = sys.getCityTax('luoyang');
    expect(tax.gold).toBeGreaterThan(0);
    expect(tax.grain).toBeGreaterThanOrEqual(0);
    expect(tax.troops).toBeGreaterThanOrEqual(0);
  });

  it('未生成的城市税收应为空', () => {
    const sys = new CityMapSystem();
    expect(sys.getCityTax('nonexistent')).toEqual({});
  });

  // ── 4. 城市更新 ──
  it('更新后繁荣度应增长', () => {
    const sys = new CityMapSystem();
    sys.generateCityMap('chengdu', '成都', 'plains');
    const before = sys.getCityMap('chengdu')!.prosperity;
    sys.updateCity('chengdu', 3600); // 1 小时
    const after = sys.getCityMap('chengdu')!.prosperity;
    expect(after).toBeGreaterThan(before);
  });

  // ── 5. getAllCities ──
  it('getAllCities 应返回所有已生成城市', () => {
    const sys = new CityMapSystem();
    sys.generateCityMap('luoyang', '洛阳', 'capital');
    sys.generateCityMap('chengdu', '成都', 'plains');
    expect(sys.getAllCities()).toHaveLength(2);
  });
});

describe('ResourcePointSystem', () => {
  // ── 6. 资源点生成（基于地形）──
  it('应基于地形生成资源点', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const points = sys.getAllResourcePoints();
    expect(points.length).toBeGreaterThan(0);
    // 确认类型都是合法的
    const validTypes: ResourcePointType[] = ['farm', 'mine', 'lumber', 'fishery', 'herb'];
    points.forEach(p => {
      expect(validTypes).toContain(p.type);
    });
  });

  it('城市/道路/关卡地形不应生成资源点', () => {
    const sys = new ResourcePointSystem();
    const tiles = [[
      { x: 0, y: 0, terrain: 'city' },
      { x: 1, y: 0, terrain: 'road' },
      { x: 2, y: 0, terrain: 'fortress' },
    ]];
    sys.generateResourcePoints(tiles);
    expect(sys.getAllResourcePoints()).toHaveLength(0);
  });

  // ── 7. 资源点占领 ──
  it('应能占领空闲资源点', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    expect(rp.isOccupied).toBe(false);
    const ok = sys.occupyResourcePoint(rp.id, 'player_1');
    expect(ok).toBe(true);
    expect(sys.getResourcePoint(rp.id)!.isOccupied).toBe(true);
    expect(sys.getResourcePoint(rp.id)!.occupiedBy).toBe('player_1');
  });

  it('不能重复占领已占领的资源点', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    sys.occupyResourcePoint(rp.id, 'player_1');
    const ok = sys.occupyResourcePoint(rp.id, 'player_2');
    expect(ok).toBe(false);
    expect(sys.getResourcePoint(rp.id)!.occupiedBy).toBe('player_1');
  });

  // ── 8. 工人分配 ──
  it('占领后可分配工人', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    sys.occupyResourcePoint(rp.id, 'player_1');
    const ok = sys.assignWorkers(rp.id, 3);
    expect(ok).toBe(true);
    expect(sys.getResourcePoint(rp.id)!.workerCount).toBe(3);
  });

  it('未占领的资源点不能分配工人', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    expect(sys.assignWorkers(rp.id, 3)).toBe(false);
  });

  it('工人数量不能超过上限', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    sys.occupyResourcePoint(rp.id, 'player_1');
    expect(sys.assignWorkers(rp.id, rp.maxWorkers + 1)).toBe(false);
  });

  // ── 9. 资源产出计算 ──
  it('有工人的已占领资源点应有产出', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    sys.occupyResourcePoint(rp.id, 'player_1');
    sys.assignWorkers(rp.id, rp.maxWorkers);
    const output = sys.calculateOutput(3600); // 1 小时
    const totalValue = Object.values(output).reduce((s, v) => s + v, 0);
    expect(totalValue).toBeGreaterThan(0);
  });

  it('无工人的资源点不应有产出', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    sys.occupyResourcePoint(rp.id, 'player_1');
    // 未分配工人
    const output = sys.calculateOutput(3600);
    expect(Object.values(output).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // ── 10. 资源点升级 ──
  it('升级应增加等级', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    const beforeLevel = rp.level;
    const beforeOutput = { ...rp.outputPerHour };
    const ok = sys.upgradeResourcePoint(rp.id);
    expect(ok).toBe(true);
    expect(sys.getResourcePoint(rp.id)!.level).toBe(beforeLevel + 1);
    // 升级后产出应提升
    const afterOutput = sys.getResourcePoint(rp.id)!.outputPerHour;
    Object.keys(beforeOutput).forEach(k => {
      expect(afterOutput[k]).toBeGreaterThan(beforeOutput[k]);
    });
  });

  it('等级上限 5 级后不能继续升级', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    // 强制升满
    while (rp.level < 5) { sys.upgradeResourcePoint(rp.id); }
    expect(sys.upgradeResourcePoint(rp.id)).toBe(false);
  });

  // ── 11. 序列化/反序列化 ──
  it('应正确序列化和反序列化', () => {
    const sys = new ResourcePointSystem();
    sys.generateResourcePoints(makeTestTiles());
    const rp = sys.getAllResourcePoints()[0];
    sys.occupyResourcePoint(rp.id, 'player_1');
    sys.assignWorkers(rp.id, 2);
    sys.upgradeResourcePoint(rp.id);

    const data = sys.serialize();
    const sys2 = new ResourcePointSystem();
    sys2.deserialize(data);

    const restored = sys2.getResourcePoint(rp.id)!;
    expect(restored.isOccupied).toBe(true);
    expect(restored.occupiedBy).toBe('player_1');
    expect(restored.workerCount).toBe(2);
    expect(restored.level).toBe(2);
  });

  it('CityMapSystem 应正确序列化和反序列化', () => {
    const sys = new CityMapSystem();
    sys.generateCityMap('luoyang', '洛阳', 'capital');
    sys.updateCity('luoyang', 3600);

    const data = sys.serialize();
    const sys2 = new CityMapSystem();
    sys2.deserialize(data);

    const restored = sys2.getCityMap('luoyang')!;
    expect(restored.cityName).toBe('洛阳');
    expect(restored.buildings.length).toBeGreaterThan(0);
    expect(restored.prosperity).toBeCloseTo(sys.getCityMap('luoyang')!.prosperity, 5);
  });
});
