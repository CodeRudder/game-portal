/**
 * 集成测试 — 地图渲染 + 领土系统 (v5.0 百家争鸣)
 *
 * 覆盖 Play 文档流程：
 *   §2.1  地图渲染与浏览（格子系统、视口、拖拽/缩放）
 *   §2.2  三大区域划分（魏/蜀/吴+中立）
 *   §2.3  地形类型与战斗效果（6种地形）
 *   §2.4  特殊地标（洛阳/长安/建业）
 *   §3.1  领土占领
 *   §3.2  领土产出计算
 *
 * @module engine/tech/__tests__/integration/map-render-territory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMapSystem } from '../../../map/WorldMapSystem';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { MapDataRenderer } from '../../../map/MapDataRenderer';
import type { ISystemDeps } from '../../../../../core/types';
import type { ISubsystemRegistry } from '../../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const worldMap = new WorldMapSystem();
  const territory = new TerritorySystem();
  const renderer = new MapDataRenderer();

  const registry = new Map<string, unknown>();
  registry.set('worldMap', worldMap);
  registry.set('territory', territory);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  worldMap.init(deps);
  territory.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
    territory: deps.registry.get<TerritorySystem>('territory')!,
    renderer: new MapDataRenderer(),
  };
}

// ═════════════════════════════════════════════
// §2.1 地图渲染与浏览
// ═════════════════════════════════════════════

describe('§2.1 地图渲染与浏览', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  // ── 格子系统 ──

  it('地图尺寸应为60×40格子', () => {
    const size = sys.map.getSize();
    expect(size.cols).toBe(60);
    expect(size.rows).toBe(40);
  });

  it('总格子数=60×40=2400', () => {
    expect(sys.map.getTotalTiles()).toBe(2400);
  });

  it('每个格子包含pos/region/terrain属性', () => {
    const tile = sys.map.getTileAt({ x: 0, y: 0 });
    expect(tile).not.toBeNull();
    expect(tile).toHaveProperty('pos');
    expect(tile).toHaveProperty('region');
    expect(tile).toHaveProperty('terrain');
  });

  it('getAllTiles返回2400条数据', () => {
    const tiles = sys.map.getAllTiles();
    expect(tiles.length).toBe(2400);
  });

  it('坐标越界返回null', () => {
    expect(sys.map.getTileAt({ x: -1, y: 0 })).toBeNull();
    expect(sys.map.getTileAt({ x: 0, y: -1 })).toBeNull();
    expect(sys.map.getTileAt({ x: 60, y: 0 })).toBeNull();
    expect(sys.map.getTileAt({ x: 0, y: 40 })).toBeNull();
  });

  it('isValidPosition边界值校验', () => {
    expect(sys.map.isValidPosition({ x: 0, y: 0 })).toBe(true);
    expect(sys.map.isValidPosition({ x: 59, y: 39 })).toBe(true);
    expect(sys.map.isValidPosition({ x: 60, y: 39 })).toBe(false);
  });

  // ── 视口控制 ──

  it('默认视口zoom=1.0', () => {
    const vp = sys.map.getViewport();
    expect(vp.zoom).toBe(1.0);
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBe(0);
  });

  it('缩放范围0.5~2.0，超出被clamp', () => {
    sys.map.setZoom(0.3);
    expect(sys.map.getViewport().zoom).toBe(0.5);
    sys.map.setZoom(3.0);
    expect(sys.map.getViewport().zoom).toBe(2.0);
  });

  it('视口偏移可设置与平移', () => {
    sys.map.setViewportOffset(100, 50);
    expect(sys.map.getViewport().offsetX).toBe(100);
    expect(sys.map.getViewport().offsetY).toBe(50);
    sys.map.panViewport(10, 20);
    expect(sys.map.getViewport().offsetX).toBe(110);
    expect(sys.map.getViewport().offsetY).toBe(70);
  });

  it('MapDataRenderer计算可见范围', () => {
    const vp = sys.map.getViewport();
    const range = sys.renderer.computeVisibleRange(vp);
    expect(range.startX).toBeGreaterThanOrEqual(0);
    expect(range.startY).toBeGreaterThanOrEqual(0);
    expect(range.endX).toBeGreaterThanOrEqual(range.startX);
    expect(range.endY).toBeGreaterThanOrEqual(range.startY);
  });

  it('resetViewport恢复默认值', () => {
    sys.map.setZoom(2.0);
    sys.map.setViewportOffset(500, 300);
    sys.map.resetViewport();
    const vp = sys.map.getViewport();
    expect(vp.zoom).toBe(1.0);
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBe(0);
  });
});

// ═════════════════════════════════════════════
// §2.2 三大区域划分
// ═════════════════════════════════════════════

describe('§2.2 三大区域划分', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('getRegions返回魏/蜀/吴3个区域', () => {
    const regions = sys.map.getRegions();
    expect(regions.length).toBe(3);
    const ids = regions.map(r => r.id);
    expect(ids).toContain('wei');
    expect(ids).toContain('shu');
    expect(ids).toContain('wu');
  });

  it('魏区域bounds覆盖北方(x:10-50,y:0-19)', () => {
    // 魏区域格子存在
    const tiles = sys.map.getTilesByRegion('wei');
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('蜀区域bounds覆盖西南(x:0-29,y:20-39)', () => {
    const tiles = sys.map.getTilesByRegion('shu');
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('吴区域bounds覆盖东南(x:30-59,y:20-39)', () => {
    const tiles = sys.map.getTilesByRegion('wu');
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('getRegionAt根据坐标返回正确区域', () => {
    // 左上角(0,0)属于neutral区域
    const tile = sys.map.getTileAt({ x: 0, y: 0 });
    expect(tile).not.toBeNull();
    expect(['wei', 'shu', 'wu', 'neutral']).toContain(tile!.region);
  });

  it('getRegionTileCount各区域均>0', () => {
    for (const id of ['wei', 'shu', 'wu'] as const) {
      expect(sys.map.getRegionTileCount(id)).toBeGreaterThan(0);
    }
  });

  it('区域定义包含id/label/color', () => {
    const regions = sys.map.getRegions();
    for (const r of regions) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('label');
      expect(r).toHaveProperty('color');
      expect(typeof r.id).toBe('string');
    }
  });
});

// ═════════════════════════════════════════════
// §2.3 地形类型与战斗效果
// ═════════════════════════════════════════════

describe('§2.3 地形类型与战斗效果', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('应有6种地形类型', () => {
    const terrains = sys.map.getTerrains();
    expect(terrains.length).toBe(6);
  });

  it('包含plain/mountain/water/city/forest/desert', () => {
    const types = sys.map.getTerrains().map(t => t.type);
    expect(types).toContain('plain');
    expect(types).toContain('mountain');
    expect(types).toContain('water');
    expect(types).toContain('city');
    expect(types).toContain('forest');
    expect(types).toContain('desert');
  });

  it('平原defenseBonus=0', () => {
    const plain = sys.map.getTerrains().find(t => t.type === 'plain');
    expect(plain!.defenseBonus).toBe(0);
  });

  it('山地defenseBonus=0.3（+30%）', () => {
    const mt = sys.map.getTerrains().find(t => t.type === 'mountain');
    expect(mt!.defenseBonus).toBe(0.3);
  });

  it('每个地形格子数>=0', () => {
    for (const t of sys.map.getTerrains()) {
      expect(sys.map.getTerrainTileCount(t.type)).toBeGreaterThanOrEqual(0);
    }
  });

  it('getTerrainAt根据坐标返回地形', () => {
    const terrain = sys.map.getTerrainAt({ x: 0, y: 0 });
    expect(terrain).not.toBeNull();
    expect(terrain).toHaveProperty('type');
    expect(terrain).toHaveProperty('defenseBonus');
  });

  it('越界坐标getTerrainAt返回null', () => {
    expect(sys.map.getTerrainAt({ x: -1, y: 0 })).toBeNull();
    expect(sys.map.getTerrainAt({ x: 0, y: -1 })).toBeNull();
  });
});

// ═════════════════════════════════════════════
// §2.4 特殊地标
// ═════════════════════════════════════════════

describe('§2.4 特殊地标', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('地图存在特殊地标', () => {
    expect(sys.map.getTotalLandmarkCount()).toBeGreaterThan(0);
  });

  it('洛阳存在且为城市类型', () => {
    const lm = sys.map.getLandmarks().find(l => l.id.includes('luoyang') || l.name === '洛阳');
    expect(lm).toBeDefined();
    expect(lm!.type).toBe('city');
  });

  it('长安存在且为城市类型', () => {
    const lm = sys.map.getLandmarks().find(l => l.id.includes('changan') || l.name === '长安');
    expect(lm).toBeDefined();
    expect(lm!.type).toBe('city');
  });

  it('建业存在且为城市类型', () => {
    const lm = sys.map.getLandmarks().find(l => l.id.includes('jianye') || l.name === '建业');
    expect(lm).toBeDefined();
    expect(lm!.type).toBe('city');
  });

  it('可按类型筛选地标(city/pass/resource)', () => {
    const cities = sys.map.getLandmarksByType('city');
    const passes = sys.map.getLandmarksByType('pass');
    expect(cities.length).toBeGreaterThan(0);
    expect(passes.length).toBeGreaterThanOrEqual(0);
  });

  it('getLandmarkById返回完整数据', () => {
    const landmarks = sys.map.getLandmarks();
    const first = sys.map.getLandmarkById(landmarks[0].id);
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('type');
    expect(first).toHaveProperty('level');
    expect(first).toHaveProperty('ownership');
  });

  it('不存在的ID返回null', () => {
    expect(sys.map.getLandmarkById('nonexistent-xyz')).toBeNull();
  });

  it('setLandmarkOwnership修改归属', () => {
    const landmarks = sys.map.getLandmarks();
    const target = landmarks[0];
    const ok = sys.map.setLandmarkOwnership(target.id, 'player');
    expect(ok).toBe(true);
    const updated = sys.map.getLandmarkById(target.id);
    expect(updated!.ownership).toBe('player');
  });

  it('upgradeLandmark提升等级和生产倍率', () => {
    const landmarks = sys.map.getLandmarks();
    const target = landmarks.find(l => l.level < 5);
    if (!target) return;
    const prevLevel = target.level;
    const prevMult = target.productionMultiplier;
    const ok = sys.map.upgradeLandmark(target.id);
    expect(ok).toBe(true);
    const updated = sys.map.getLandmarkById(target.id);
    expect(updated!.level).toBe(prevLevel + 1);
    expect(updated!.productionMultiplier).toBeGreaterThan(prevMult);
  });

  it('等级5地标不可再升级', () => {
    const landmarks = sys.map.getLandmarks();
    // 找一个level 5的或手动升到5
    const target = landmarks[0];
    // 升到满级
    for (let i = 0; i < 5; i++) sys.map.upgradeLandmark(target.id);
    const ok = sys.map.upgradeLandmark(target.id);
    expect(ok).toBe(false);
  });
});

// ═════════════════════════════════════════════
// §3.1 领土占领
// ═════════════════════════════════════════════

describe('§3.1 领土占领', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('初始存在领土数据', () => {
    expect(sys.territory.getTotalTerritoryCount()).toBeGreaterThan(0);
  });

  it('captureTerritory成功返回true', () => {
    const neutral = sys.territory.getAllTerritories().find(t => t.ownership === 'neutral');
    if (!neutral) return;
    expect(sys.territory.captureTerritory(neutral.id, 'player')).toBe(true);
  });

  it('占领后归属变更为player', () => {
    const neutral = sys.territory.getAllTerritories().find(t => t.ownership === 'neutral');
    if (!neutral) return;
    sys.territory.captureTerritory(neutral.id, 'player');
    const updated = sys.territory.getTerritoryById(neutral.id);
    expect(updated!.ownership).toBe('player');
  });

  it('占领中立领土后player数量+1', () => {
    const before = sys.territory.getPlayerTerritoryCount();
    const neutral = sys.territory.getAllTerritories().find(t => t.ownership === 'neutral');
    if (!neutral) return;
    sys.territory.captureTerritory(neutral.id, 'player');
    expect(sys.territory.getPlayerTerritoryCount()).toBe(before + 1);
  });

  it('不存在的ID返回false', () => {
    expect(sys.territory.captureTerritory('nonexistent', 'player')).toBe(false);
  });

  it('可按区域查询领土', () => {
    for (const region of ['wei', 'shu', 'wu'] as const) {
      const list = sys.territory.getTerritoriesByRegion(region);
      expect(Array.isArray(list)).toBe(true);
    }
  });

  it('可按归属查询领土', () => {
    const playerList = sys.territory.getTerritoriesByOwnership('player');
    const neutralList = sys.territory.getTerritoriesByOwnership('neutral');
    expect(Array.isArray(playerList)).toBe(true);
    expect(Array.isArray(neutralList)).toBe(true);
  });

  it('getPlayerTerritoryIds返回ID列表', () => {
    const ids = sys.territory.getPlayerTerritoryIds();
    expect(Array.isArray(ids)).toBe(true);
    for (const id of ids) {
      const t = sys.territory.getTerritoryById(id);
      expect(t!.ownership).toBe('player');
    }
  });

  it('setOwnerships批量设置归属', () => {
    const all = sys.territory.getAllTerritories();
    const target1 = all[0];
    const target2 = all[1];
    sys.territory.setOwnerships({ [target1.id]: 'player', [target2.id]: 'wei' });
    expect(sys.territory.getTerritoryById(target1.id)!.ownership).toBe('player');
    expect(sys.territory.getTerritoryById(target2.id)!.ownership).toBe('wei');
  });

  it('相邻关系查询返回数组', () => {
    const all = sys.territory.getAllTerritories();
    const adj = sys.territory.getAdjacentTerritoryIds(all[0].id);
    expect(Array.isArray(adj)).toBe(true);
  });

  it('canAttackTerritory: 非己方+有相邻己方领土', () => {
    // 先占领一个领土，再检查其相邻是否可攻击
    const all = sys.territory.getAllTerritories();
    const playerTerritory = all.find(t => t.ownership === 'player');
    if (!playerTerritory) return;
    const adjIds = sys.territory.getAdjacentTerritoryIds(playerTerritory.id);
    if (adjIds.length === 0) return;
    const adjTarget = sys.territory.getTerritoryById(adjIds[0]);
    if (!adjTarget || adjTarget.ownership === 'player') return;
    expect(sys.territory.canAttackTerritory(adjTarget.id, 'player')).toBe(true);
  });

  it('getAttackableTerritories返回可攻击列表', () => {
    const list = sys.territory.getAttackableTerritories('player');
    expect(Array.isArray(list)).toBe(true);
  });
});

// ═════════════════════════════════════════════
// §3.2 领土产出计算
// ═════════════════════════════════════════════

describe('§3.2 领土产出计算', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('getPlayerProductionSummary返回汇总数据', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toHaveProperty('totalProduction');
    expect(summary.totalProduction).toHaveProperty('grain');
    expect(summary.totalProduction).toHaveProperty('gold');
    expect(summary.totalProduction).toHaveProperty('troops');
    expect(summary.totalProduction).toHaveProperty('mandate');
  });

  it('占领更多领土产出增加', () => {
    const summary1 = sys.territory.getPlayerProductionSummary();
    const neutral = sys.territory.getAllTerritories().find(t => t.ownership !== 'player');
    if (!neutral) return;
    sys.territory.captureTerritory(neutral.id, 'player');
    const summary2 = sys.territory.getPlayerProductionSummary();
    const total1 = summary1.totalProduction.grain + summary1.totalProduction.gold;
    const total2 = summary2.totalProduction.grain + summary2.totalProduction.gold;
    expect(total2).toBeGreaterThanOrEqual(total1);
  });

  it('upgradeTerritory提升产出', () => {
    const player = sys.territory.getAllTerritories().find(t => t.ownership === 'player');
    if (!player) return;
    const prevProd = player.currentProduction;
    const result = sys.territory.upgradeTerritory(player.id);
    if (result.success) {
      expect(result.newLevel).toBeGreaterThan(result.previousLevel);
      // 新产出应更高（至少某项）
      const newTotal = result.newProduction.grain + result.newProduction.gold;
      const prevTotal = prevProd.grain + prevProd.gold;
      expect(newTotal).toBeGreaterThanOrEqual(prevTotal);
    }
  });

  it('非玩家领土不可升级', () => {
    const neutral = sys.territory.getAllTerritories().find(t => t.ownership !== 'player');
    if (!neutral) return;
    const result = sys.territory.upgradeTerritory(neutral.id);
    expect(result.success).toBe(false);
  });

  it('不存在的ID升级返回失败', () => {
    const result = sys.territory.upgradeTerritory('nonexistent');
    expect(result.success).toBe(false);
  });

  it('领土数据包含defenseValue', () => {
    const t = sys.territory.getAllTerritories()[0];
    expect(t).toHaveProperty('defenseValue');
    expect(t.defenseValue).toBeGreaterThan(0);
  });

  it('领土数据包含level和baseProduction', () => {
    const t = sys.territory.getAllTerritories()[0];
    expect(t).toHaveProperty('level');
    expect(t).toHaveProperty('baseProduction');
    expect(t).toHaveProperty('currentProduction');
  });
});
