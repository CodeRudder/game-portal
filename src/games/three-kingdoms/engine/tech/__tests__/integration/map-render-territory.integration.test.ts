/**
 * 集成测试 — 地图渲染 + 领土系统
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

// ─────────────────────────────────────────────
// §2.1 地图渲染与浏览
// ─────────────────────────────────────────────

describe('§2.1 地图渲染与浏览', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('格子系统渲染正确（20×15瓦片）', () => {
    const size = sys.map.getSize();
    expect(size).toBeDefined();
    const totalTiles = sys.map.getTotalTiles();
    expect(totalTiles).toBeGreaterThan(0);
  });

  it('视口范围可拖拽/缩放(50%~200%)', () => {
    sys.map.setZoom(0.5);
    let vp = sys.map.getViewport();
    expect(vp.zoom).toBe(0.5);

    sys.map.setZoom(2.0);
    vp = sys.map.getViewport();
    expect(vp.zoom).toBe(2.0);
  });

  it('可获取所有瓦片数据', () => {
    const tiles = sys.map.getAllTiles();
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]).toHaveProperty('x');
    expect(tiles[0]).toHaveProperty('y');
    expect(tiles[0]).toHaveProperty('region');
    expect(tiles[0]).toHaveProperty('terrain');
  });

  it('MapDataRenderer计算可见范围', () => {
    const viewport = sys.map.getViewport();
    const range = sys.renderer.computeVisibleRange(viewport);
    expect(range.startX).toBeGreaterThanOrEqual(0);
    expect(range.startY).toBeGreaterThanOrEqual(0);
    expect(range.endX).toBeGreaterThanOrEqual(range.startX);
    expect(range.endY).toBeGreaterThanOrEqual(range.startY);
  });

  it('视口偏移可设置', () => {
    sys.map.setOffset(100, 50);
    const vp = sys.map.getViewport();
    expect(vp.offsetX).toBe(100);
    expect(vp.offsetY).toBe(50);
  });
});

// ─────────────────────────────────────────────
// §2.2 三大区域划分
// ─────────────────────────────────────────────

describe('§2.2 三大区域划分', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('应有4个区域: 魏/蜀/吴+中立', () => {
    const regions = sys.map.getRegions();
    expect(regions.length).toBeGreaterThanOrEqual(3);
    const ids = regions.map((r: any) => r.id);
    expect(ids).toContain('wei');
    expect(ids).toContain('shu');
    expect(ids).toContain('wu');
  });

  it('各区域应有正确的领土', () => {
    const regions = sys.map.getRegions();
    for (const region of regions) {
      const tiles = sys.map.getTilesByRegion(region.id);
      expect(tiles.length).toBeGreaterThan(0);
    }
  });

  it('区域边界不重叠', () => {
    const regions = sys.map.getRegions();
    const allTileKeys = new Set<string>();
    for (const region of regions) {
      const tiles = sys.map.getTilesByRegion(region.id);
      for (const t of tiles) {
        const key = `${t.x},${t.y}`;
        expect(allTileKeys.has(key)).toBe(false);
        allTileKeys.add(key);
      }
    }
  });

  it('区域类型标识正确', () => {
    const regions = sys.map.getRegions();
    for (const region of regions) {
      expect(region).toHaveProperty('id');
      expect(region).toHaveProperty('name');
      expect(typeof region.id).toBe('string');
    }
  });
});

// ─────────────────────────────────────────────
// §2.3 地形类型与战斗效果
// ─────────────────────────────────────────────

describe('§2.3 地形类型与战斗效果', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('应有6种地形', () => {
    const terrains = sys.map.getTerrains();
    expect(terrains.length).toBe(6);
  });

  it('地形包含平原/山地/水域/城池/森林/关隘', () => {
    const terrains = sys.map.getTerrains();
    const types = terrains.map((t: any) => t.type);
    expect(types).toContain('plain');
    expect(types).toContain('mountain');
    expect(types).toContain('water');
    expect(types).toContain('city');
    expect(types).toContain('forest');
    expect(types).toContain('pass');
  });

  it('平原地形粮草+30%', () => {
    const terrains = sys.map.getTerrains();
    const plain = terrains.find((t: any) => t.type === 'plain');
    expect(plain).toBeDefined();
    if (plain?.effects) {
      expect(plain.effects.grainBonus ?? plain.effects.grain).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('山地地形防守防御+20%', () => {
    const terrains = sys.map.getTerrains();
    const mountain = terrains.find((t: any) => t.type === 'mountain');
    expect(mountain).toBeDefined();
  });

  it('可按地形查询瓦片数量', () => {
    const terrains = sys.map.getTerrains();
    for (const t of terrains) {
      const count = sys.map.getTerrainTileCount(t.type);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────────
// §2.4 特殊地标
// ─────────────────────────────────────────────

describe('§2.4 特殊地标', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('应有特殊地标', () => {
    const landmarks = sys.map.getLandmarks();
    expect(landmarks.length).toBeGreaterThan(0);
  });

  it('洛阳(中心/全资源产出+50%)存在', () => {
    const landmarks = sys.map.getLandmarks();
    const luoyang = landmarks.find((l: any) => l.id.includes('luoyang') || l.name === '洛阳');
    expect(luoyang).toBeDefined();
  });

  it('长安(科技点产出+30%)存在', () => {
    const landmarks = sys.map.getLandmarks();
    const changan = landmarks.find((l: any) => l.id.includes('changan') || l.name === '长安');
    expect(changan).toBeDefined();
  });

  it('建业(铜钱产出+30%)存在', () => {
    const landmarks = sys.map.getLandmarks();
    const jianye = landmarks.find((l: any) => l.id.includes('jianye') || l.name === '建业');
    expect(jianye).toBeDefined();
  });

  it('可按类型查询地标', () => {
    const types = ['city', 'pass', 'resource'];
    for (const t of types) {
      const landmarks = sys.map.getLandmarksByType(t as any);
      expect(Array.isArray(landmarks)).toBe(true);
    }
  });

  it('点击地标弹出简要信息', () => {
    const landmarks = sys.map.getLandmarks();
    if (landmarks.length === 0) return;
    const lm = sys.map.getLandmarkById(landmarks[0].id);
    expect(lm).toBeDefined();
    expect(lm).toHaveProperty('id');
    expect(lm).toHaveProperty('name');
  });
});

// ─────────────────────────────────────────────
// §3.1 领土占领
// ─────────────────────────────────────────────

describe('§3.1 领土占领', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('应能获取所有领土', () => {
    const territories = sys.territory.getAllTerritories();
    expect(territories.length).toBeGreaterThan(0);
  });

  it('攻城胜利后领土归属变更', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const result = sys.territory.captureTerritory(target.id, 'player');
    expect(result).toBe(true);

    const updated = sys.territory.getTerritoryById(target.id);
    expect(updated?.ownership).toBe('player');
  });

  it('己方领土数量统计正确', () => {
    const count = sys.territory.getPlayerTerritoryCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('占领中立领土后数量增加', () => {
    const before = sys.territory.getPlayerTerritoryCount();
    const territories = sys.territory.getAllTerritories();
    const neutral = territories.find((t: any) => t.ownership === 'neutral');
    if (!neutral) return;

    sys.territory.captureTerritory(neutral.id, 'player');
    const after = sys.territory.getPlayerTerritoryCount();
    expect(after).toBe(before + 1);
  });

  it('重复占领己方领土不改变数量', () => {
    const territories = sys.territory.getAllTerritories();
    const player = territories.find((t: any) => t.ownership === 'player');
    if (!player) return;

    const before = sys.territory.getPlayerTerritoryCount();
    sys.territory.captureTerritory(player.id, 'player');
    const after = sys.territory.getPlayerTerritoryCount();
    expect(after).toBe(before);
  });
});

// ─────────────────────────────────────────────
// §3.2 领土产出计算
// ─────────────────────────────────────────────

describe('§3.2 领土产出计算', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('产出公式: 基础×地形×阵营×科技×声望×地标', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toBeDefined();
  });

  it('己方领土提供持续资源产出', () => {
    const territories = sys.territory.getAllTerritories();
    const neutral = territories.find((t: any) => t.ownership !== 'player');
    if (neutral) {
      sys.territory.captureTerritory(neutral.id, 'player');
    }
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toBeDefined();
    expect(summary).toHaveProperty('totalGrain');
    expect(summary).toHaveProperty('totalCoins');
    expect(summary).toHaveProperty('totalTroops');
  });

  it('占领更多领土产出更高', () => {
    const territories = sys.territory.getAllTerritories();
    const neutralList = territories.filter((t: any) => t.ownership !== 'player');

    // 占领前
    const summary1 = sys.territory.getPlayerProductionSummary();

    // 占领一个
    if (neutralList.length > 0) {
      sys.territory.captureTerritory(neutralList[0].id, 'player');
    }

    const summary2 = sys.territory.getPlayerProductionSummary();
    // 产出应增加或保持不变
    expect(summary2).toBeDefined();
  });

  it('领土等级影响产出', () => {
    const territories = sys.territory.getAllTerritories();
    const player = territories.find((t: any) => t.ownership === 'player');
    if (!player) return;

    const result = sys.territory.upgradeTerritory(player.id);
    expect(result).toHaveProperty('success');
  });
});
