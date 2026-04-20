/**
 * BuildingPlacementManager 模块测试
 *
 * 测试建筑放置、校验、升级、移除等功能。
 *
 * @module engine/tilemap/__tests__/BuildingPlacementManager.test
 */

import { BuildingPlacementManager, getLevelVisual, LEVEL_VISUALS } from '../BuildingPlacementManager';
import { BiomeType, BIOME_CONFIGS } from '../BiomeConfig';
import { TerrainType } from '../types';
import type { TileMapData, BuildingDef, PlacedBuilding, Tile } from '../types';

// ---------------------------------------------------------------------------
// 测试辅助
// ---------------------------------------------------------------------------

/** 创建测试用建筑定义 */
function createTestBuildingDefs(): BuildingDef[] {
  return [
    {
      id: 'house', name: '民居', type: 'house',
      size: { w: 1, h: 1 }, color: '#8B8682', iconEmoji: '🏠',
      clickable: true, description: '普通民居', levels: 3,
    },
    {
      id: 'market', name: '市场', type: 'market',
      size: { w: 2, h: 2 }, color: '#DAA520', iconEmoji: '🏪',
      clickable: true, description: '贸易市场', levels: 3,
    },
    {
      id: 'palace', name: '宫殿', type: 'palace',
      size: { w: 3, h: 3 }, color: '#FFD700', iconEmoji: '🏯',
      clickable: true, description: '王族宫殿', levels: 5,
    },
    {
      id: 'tower', name: '塔楼', type: 'tower',
      size: { w: 1, h: 1 }, color: '#708090', iconEmoji: '🗼',
      clickable: true, description: '防御塔楼', levels: 3,
    },
  ];
}

/** 创建测试用地图数据 */
function createTestMapData(w: number, h: number): TileMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < h; y++) {
    tiles[y] = [];
    for (let x = 0; x < w; x++) {
      tiles[y][x] = {
        x, y,
        terrain: TerrainType.GRASS,
        elevation: 0,
        variant: 0,
      };
    }
  }
  return { width: w, height: h, tileSize: 48, tiles, buildings: [], decorations: [] };
}

/** 创建 Biome 映射（全平原） */
function createPlainsBiomeMap(w: number, h: number): Map<string, BiomeType> {
  const map = new Map<string, BiomeType>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      map.set(`${x},${y}`, BiomeType.PLAINS);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// 放置校验
// ---------------------------------------------------------------------------

describe('BuildingPlacementManager 放置校验', () => {
  let manager: BuildingPlacementManager;
  let mapData: TileMapData;
  let biomeMap: Map<string, BiomeType>;

  beforeEach(() => {
    manager = new BuildingPlacementManager();
    manager.registerBuildingDefs(createTestBuildingDefs());
    mapData = createTestMapData(20, 20);
    biomeMap = createPlainsBiomeMap(20, 20);
    manager.setMapData(mapData, biomeMap);
  });

  it('应在平原上允许放置 house', () => {
    const result = manager.canPlace('house', 5, 5);
    expect(result.canPlace).toBe(true);
  });

  it('应在平原上允许放置 market (2x2)', () => {
    const result = manager.canPlace('market', 5, 5);
    expect(result.canPlace).toBe(true);
  });

  it('应在平原上允许放置 palace (3x3)', () => {
    const result = manager.canPlace('palace', 5, 5);
    expect(result.canPlace).toBe(true);
  });

  it('不存在的建筑定义应返回失败', () => {
    const result = manager.canPlace('nonexistent', 5, 5);
    expect(result.canPlace).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('超出地图边界应返回失败', () => {
    const result = manager.canPlace('palace', 18, 18);
    expect(result.canPlace).toBe(false);
    expect(result.reason).toContain('边界');
  });

  it('负坐标应返回失败', () => {
    const result = manager.canPlace('house', -1, 0);
    expect(result.canPlace).toBe(false);
  });

  it('水域地形应不允许放置', () => {
    biomeMap.set('5,5', BiomeType.WATER);
    const result = manager.canPlace('house', 5, 5);
    expect(result.canPlace).toBe(false);
    expect(result.reason).toContain('不可建造');
  });

  it('山地地形应不允许放置', () => {
    biomeMap.set('5,5', BiomeType.MOUNTAIN);
    const result = manager.canPlace('house', 5, 5);
    expect(result.canPlace).toBe(false);
  });

  it('已占用格子应不允许放置', () => {
    manager.place('house', 5, 5);
    const result = manager.canPlace('house', 5, 5);
    expect(result.canPlace).toBe(false);
    expect(result.reason).toContain('已被占用');
  });

  it('2x2 建筑部分重叠应不允许放置', () => {
    manager.place('house', 6, 6);
    const result = manager.canPlace('market', 5, 5);
    expect(result.canPlace).toBe(false);
  });

  it('未设置地图数据时应返回失败', () => {
    const emptyManager = new BuildingPlacementManager();
    emptyManager.registerBuildingDefs(createTestBuildingDefs());
    const result = emptyManager.canPlace('house', 5, 5);
    expect(result.canPlace).toBe(false);
    expect(result.reason).toContain('地图数据');
  });
});

// ---------------------------------------------------------------------------
// 放置操作
// ---------------------------------------------------------------------------

describe('BuildingPlacementManager 放置操作', () => {
  let manager: BuildingPlacementManager;
  let mapData: TileMapData;
  let biomeMap: Map<string, BiomeType>;

  beforeEach(() => {
    manager = new BuildingPlacementManager();
    manager.registerBuildingDefs(createTestBuildingDefs());
    mapData = createTestMapData(20, 20);
    biomeMap = createPlainsBiomeMap(20, 20);
    manager.setMapData(mapData, biomeMap);
  });

  it('应成功放置 1x1 建筑', () => {
    const bld = manager.place('house', 5, 5);
    expect(bld).not.toBeNull();
    expect(bld!.defId).toBe('house');
    expect(bld!.x).toBe(5);
    expect(bld!.y).toBe(5);
    expect(bld!.level).toBe(1);
  });

  it('应成功放置 2x2 建筑', () => {
    const bld = manager.place('market', 3, 3);
    expect(bld).not.toBeNull();
    expect(bld!.defId).toBe('market');
  });

  it('应成功放置 3x3 建筑', () => {
    const bld = manager.place('palace', 2, 2);
    expect(bld).not.toBeNull();
    expect(bld!.defId).toBe('palace');
  });

  it('放置后应标记瓦片占用', () => {
    manager.place('house', 5, 5);
    expect(mapData.tiles[5][5].buildingId).toBeDefined();
  });

  it('2x2 建筑应标记 4 个瓦片', () => {
    manager.place('market', 3, 3);
    expect(mapData.tiles[3][3].buildingId).toBeDefined();
    expect(mapData.tiles[3][4].buildingId).toBeDefined();
    expect(mapData.tiles[4][3].buildingId).toBeDefined();
    expect(mapData.tiles[4][4].buildingId).toBeDefined();
  });

  it('3x3 建筑应标记 9 个瓦片', () => {
    manager.place('palace', 2, 2);
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(mapData.tiles[2 + dy][2 + dx].buildingId).toBeDefined();
      }
    }
  });

  it('放置后应添加到建筑列表', () => {
    manager.place('house', 5, 5);
    expect(mapData.buildings).toHaveLength(1);
  });

  it('初始状态应为 building', () => {
    const bld = manager.place('house', 5, 5);
    expect(bld!.state).toBe('building');
    expect(bld!.buildProgress).toBe(0);
  });

  it('放置失败应返回 null', () => {
    biomeMap.set('5,5', BiomeType.WATER);
    const bld = manager.place('house', 5, 5);
    expect(bld).toBeNull();
  });

  it('isOccupied 应正确反映占用状态', () => {
    expect(manager.isOccupied(5, 5)).toBe(false);
    manager.place('house', 5, 5);
    expect(manager.isOccupied(5, 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 移除操作
// ---------------------------------------------------------------------------

describe('BuildingPlacementManager 移除操作', () => {
  let manager: BuildingPlacementManager;
  let mapData: TileMapData;

  beforeEach(() => {
    manager = new BuildingPlacementManager();
    manager.registerBuildingDefs(createTestBuildingDefs());
    mapData = createTestMapData(20, 20);
    const biomeMap = createPlainsBiomeMap(20, 20);
    manager.setMapData(mapData, biomeMap);
  });

  it('应成功移除已放置的建筑', () => {
    const bld = manager.place('house', 5, 5);
    const result = manager.remove(bld!.id);
    expect(result).toBe(true);
    expect(mapData.buildings).toHaveLength(0);
  });

  it('移除后应释放瓦片占用', () => {
    const bld = manager.place('house', 5, 5);
    manager.remove(bld!.id);
    expect(mapData.tiles[5][5].buildingId).toBeUndefined();
    expect(manager.isOccupied(5, 5)).toBe(false);
  });

  it('移除 2x2 建筑应释放所有瓦片', () => {
    const bld = manager.place('market', 3, 3);
    manager.remove(bld!.id);
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        expect(mapData.tiles[3 + dy][3 + dx].buildingId).toBeUndefined();
        expect(manager.isOccupied(3 + dx, 3 + dy)).toBe(false);
      }
    }
  });

  it('移除不存在的建筑应返回 false', () => {
    const result = manager.remove('nonexistent');
    expect(result).toBe(false);
  });

  it('移除后应能在原位重新放置', () => {
    const bld = manager.place('house', 5, 5);
    manager.remove(bld!.id);
    const newBld = manager.place('house', 5, 5);
    expect(newBld).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 升级操作
// ---------------------------------------------------------------------------

describe('BuildingPlacementManager 升级操作', () => {
  let manager: BuildingPlacementManager;
  let mapData: TileMapData;

  beforeEach(() => {
    manager = new BuildingPlacementManager();
    manager.registerBuildingDefs(createTestBuildingDefs());
    mapData = createTestMapData(20, 20);
    const biomeMap = createPlainsBiomeMap(20, 20);
    manager.setMapData(mapData, biomeMap);
  });

  it('应成功升级建筑', () => {
    const bld = manager.place('house', 5, 5);
    const newLevel = manager.upgrade(bld!.id);
    expect(newLevel).toBe(2);
  });

  it('连续升级应递增等级', () => {
    const bld = manager.place('house', 5, 5);
    manager.upgrade(bld!.id);
    manager.upgrade(bld!.id);
    expect(bld!.level).toBe(3);
  });

  it('达到最大等级后应返回 -1', () => {
    const bld = manager.place('house', 5, 5);
    manager.upgrade(bld!.id, 2);
    const result = manager.upgrade(bld!.id, 2);
    expect(result).toBe(-1);
  });

  it('升级不存在的建筑应返回 -1', () => {
    const result = manager.upgrade('nonexistent');
    expect(result).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

describe('BuildingPlacementManager 查询', () => {
  let manager: BuildingPlacementManager;
  let mapData: TileMapData;

  beforeEach(() => {
    manager = new BuildingPlacementManager();
    manager.registerBuildingDefs(createTestBuildingDefs());
    mapData = createTestMapData(20, 20);
    const biomeMap = createPlainsBiomeMap(20, 20);
    manager.setMapData(mapData, biomeMap);
  });

  it('getBuildingAt 应返回指定位置的建筑', () => {
    manager.place('house', 5, 5);
    const bld = manager.getBuildingAt(5, 5);
    expect(bld).toBeDefined();
    expect(bld!.defId).toBe('house');
  });

  it('getBuildingAt 空位置应返回 undefined', () => {
    const bld = manager.getBuildingAt(5, 5);
    expect(bld).toBeUndefined();
  });

  it('2x2 建筑应在所有占用格子上都能查到', () => {
    manager.place('market', 3, 3);
    expect(manager.getBuildingAt(3, 3)).toBeDefined();
    expect(manager.getBuildingAt(4, 3)).toBeDefined();
    expect(manager.getBuildingAt(3, 4)).toBeDefined();
    expect(manager.getBuildingAt(4, 4)).toBeDefined();
  });

  it('getAllBuildings 应返回所有建筑', () => {
    manager.place('house', 1, 1);
    manager.place('house', 5, 5);
    expect(manager.getAllBuildings()).toHaveLength(2);
  });

  it('getBuildingVisual 应返回等级视觉配置', () => {
    const bld = manager.place('house', 5, 5);
    const visual = manager.getBuildingVisual(bld!.id);
    expect(visual).not.toBeNull();
    expect(visual!.level).toBe(1);
  });

  it('setBuildingState 应更新建筑状态', () => {
    const bld = manager.place('house', 5, 5);
    const result = manager.setBuildingState(bld!.id, 'damaged');
    expect(result).toBe(true);
    expect(bld!.state).toBe('damaged');
  });

  it('setBuildProgress 应更新建造进度', () => {
    const bld = manager.place('house', 5, 5);
    manager.setBuildProgress(bld!.id, 0.5);
    expect(bld!.buildProgress).toBe(0.5);
  });

  it('setBuildProgress 到 1 应自动变为 active', () => {
    const bld = manager.place('house', 5, 5);
    manager.setBuildProgress(bld!.id, 1);
    expect(bld!.state).toBe('active');
    expect(bld!.buildProgress).toBe(1);
  });

  it('setBuildProgress 应限制在 [0, 1] 范围', () => {
    const bld = manager.place('house', 5, 5);
    manager.setBuildProgress(bld!.id, 1.5);
    expect(bld!.buildProgress).toBe(1);
    manager.setBuildProgress(bld!.id, -0.5);
    expect(bld!.buildProgress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 等级视觉配置
// ---------------------------------------------------------------------------

describe('LevelVisualConfig', () => {
  it('LEVEL_VISUALS 应有 5 个等级', () => {
    expect(LEVEL_VISUALS).toHaveLength(5);
  });

  it('getLevelVisual 应返回对应等级配置', () => {
    const v1 = getLevelVisual(1);
    expect(v1.level).toBe(1);
    expect(v1.stars).toBe(0);

    const v5 = getLevelVisual(5);
    expect(v5.level).toBe(5);
    expect(v5.stars).toBe(4);
  });

  it('getLevelVisual 超过最大等级应返回最高级', () => {
    const v = getLevelVisual(10);
    expect(v.level).toBe(5);
  });

  it('getLevelVisual 0 应返回第 1 级', () => {
    const v = getLevelVisual(0);
    expect(v.level).toBe(1);
  });

  it('每个等级应有颜色和缩放', () => {
    for (const visual of LEVEL_VISUALS) {
      expect(visual.color).toBeTruthy();
      expect(visual.borderColor).toBeTruthy();
      expect(visual.scale).toBeGreaterThan(0);
      expect(visual.scale).toBeLessThanOrEqual(1);
    }
  });
});
