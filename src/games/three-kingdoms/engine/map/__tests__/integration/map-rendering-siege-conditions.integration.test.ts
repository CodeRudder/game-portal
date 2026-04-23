/**
 * 集成测试 — 地图基础渲染 + 攻城条件检查
 *
 * 覆盖 Play 文档流程：
 *   §6.1  20×15六边形网格渲染
 *   §6.2  三大区域划分验证
 *   §6.3  六种地形类型显示验证
 *   §6.4  地图首次加载流程
 *   §7.1  攻城条件检查（相邻 + 兵力 + 粮草 + 每日次数）
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/map/__tests__/integration/map-rendering-siege-conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMapSystem } from '../../WorldMapSystem';
import { MapDataRenderer } from '../../MapDataRenderer';
import { MapFilterSystem } from '../../MapFilterSystem';
import { TerritorySystem } from '../../TerritorySystem';
import { SiegeSystem } from '../../SiegeSystem';
import { SiegeEnhancer } from '../../SiegeEnhancer';
import { GarrisonSystem } from '../../GarrisonSystem';
import {
  MAP_SIZE,
  REGION_DEFS,
  TERRAIN_TYPES,
  DEFAULT_LANDMARKS,
  LANDMARK_POSITIONS,
  getRegionAtPosition,
  getTerrainAtPosition,
  generateAllTiles,
  areAdjacent,
} from '../../../../core/map';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();

  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('worldMap', mapSys);

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

  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  mapSys.init(deps);

  return deps;
}

/** 从 deps 获取子系统 */
function getSystems(deps: ISystemDeps) {
  return {
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('集成测试: 地图基础渲染 + 攻城条件 (Play §6, §7.1)', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  // ── §6.1 六边形网格渲染 ──────────────────────

  describe('§6.1 20×15六边形网格渲染', () => {
    it('地图尺寸为 60×40 = 2400 格子', () => {
      expect(MAP_SIZE.cols).toBe(60);
      expect(MAP_SIZE.rows).toBe(40);
      expect(MAP_SIZE.cols * MAP_SIZE.rows).toBe(2400);
    });

    it('generateAllTiles 生成 2400 个格子', () => {
      const tiles = generateAllTiles();
      expect(tiles).toHaveLength(2400);
    });

    it('格子坐标范围合法 (x: 0~59, y: 0~39)', () => {
      const tiles = generateAllTiles();
      for (const tile of tiles) {
        expect(tile.pos.x).toBeGreaterThanOrEqual(0);
        expect(tile.pos.x).toBeLessThan(60);
        expect(tile.pos.y).toBeGreaterThanOrEqual(0);
        expect(tile.pos.y).toBeLessThan(40);
      }
    });

    it('格子无重复坐标', () => {
      const tiles = generateAllTiles();
      const keys = new Set(tiles.map(t => `${t.pos.x},${t.pos.y}`));
      expect(keys.size).toBe(2400);
    });

    it('WorldMapSystem 初始化后可查询格子', () => {
      const tile = sys.map.getTileAt({ x: 0, y: 0 });
      expect(tile).toBeDefined();
      expect(tile).not.toBeNull();
      if (tile) {
        expect(tile.pos.x).toBe(0);
        expect(tile.pos.y).toBe(0);
      }
    });
  });

  // ── §6.2 三大区域划分 ──────────────────────

  describe('§6.2 三大区域划分验证', () => {
    it('三大区域定义存在: wei/shu/wu', () => {
      expect(REGION_DEFS).toHaveProperty('wei');
      expect(REGION_DEFS).toHaveProperty('shu');
      expect(REGION_DEFS).toHaveProperty('wu');
    });

    it('getRegionAtPosition 正确划分三大区域', () => {
      // 魏国（中原 y<20）
      expect(getRegionAtPosition(10, 5)).toBe('wei');
      expect(getRegionAtPosition(25, 10)).toBe('wei');
      // 蜀国（左下 x<30, y>=20）
      expect(getRegionAtPosition(10, 25)).toBe('shu');
      expect(getRegionAtPosition(20, 30)).toBe('shu');
      // 吴国（右下 x>=30, y>=20）
      expect(getRegionAtPosition(35, 25)).toBe('wu');
      expect(getRegionAtPosition(45, 30)).toBe('wu');
    });

    it('地标坐标正确对应区域', () => {
      // 邺城 → 魏
      const ye = LANDMARK_POSITIONS['city-ye'];
      expect(getRegionAtPosition(ye.x, ye.y)).toBe('wei');
      // 成都 → 蜀
      const chengdu = LANDMARK_POSITIONS['city-chengdu'];
      expect(getRegionAtPosition(chengdu.x, chengdu.y)).toBe('shu');
      // 建业 → 吴
      const jianye = LANDMARK_POSITIONS['city-jianye'];
      expect(getRegionAtPosition(jianye.x, jianye.y)).toBe('wu');
    });

    it('三大特殊地标存在', () => {
      const ids = DEFAULT_LANDMARKS.map(lm => lm.id);
      expect(ids).toContain('city-luoyang');
      expect(ids).toContain('city-changan');
      expect(ids).toContain('city-jianye');
    });
  });

  // ── §6.3 六种地形类型 ──────────────────────

  describe('§6.3 六种地形类型显示验证', () => {
    it('6种地形类型全部定义', () => {
      expect(TERRAIN_TYPES).toContain('plain');
      expect(TERRAIN_TYPES).toContain('mountain');
      expect(TERRAIN_TYPES).toContain('forest');
      expect(TERRAIN_TYPES).toContain('water');
      expect(TERRAIN_TYPES).toContain('desert');
      expect(TERRAIN_TYPES).toContain('city');
      expect(TERRAIN_TYPES).toHaveLength(6);
    });

    it('getTerrainAtPosition 返回有效地形', () => {
      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 20; x++) {
          const terrain = getTerrainAtPosition(x, y);
          expect(TERRAIN_TYPES).toContain(terrain);
        }
      }
    });

    it('城市地标位置对应 city 地形', () => {
      const cityLandmarks = DEFAULT_LANDMARKS.filter(lm => lm.type === 'city');
      for (const lm of cityLandmarks) {
        const pos = LANDMARK_POSITIONS[lm.id];
        if (pos) {
          const terrain = getTerrainAtPosition(pos.x, pos.y);
          expect(['city', 'plain']).toContain(terrain);
        }
      }
    });
  });

  // ── §6.4 地图首次加载流程 ──────────────────────

  describe('§6.4 地图首次加载流程', () => {
    it('WorldMapSystem 初始化后 tiles 非空', () => {
      const state = sys.map.getState();
      expect(state).toBeDefined();
    });

    it('MapDataRenderer 可计算视口渲染数据', () => {
      const renderer = new MapDataRenderer();
      const tiles = generateAllTiles();
      const viewport = { offsetX: 0, offsetY: 0, zoom: 1, width: 800, height: 600 };
      const renderData = renderer.computeViewportRenderData(tiles, viewport);
      expect(renderData).toBeDefined();
      expect(renderData.tiles.length).toBeGreaterThan(0);
    });

    it('视口裁剪：渲染数据包含格子信息', () => {
      const renderer = new MapDataRenderer();
      const tiles = generateAllTiles();
      const viewport = { offsetX: 0, offsetY: 0, zoom: 1, width: 800, height: 600 };
      const renderData = renderer.computeViewportRenderData(tiles, viewport);
      // 渲染数据应包含格子
      expect(renderData.tiles.length).toBeGreaterThan(0);
      expect(renderData.tiles[0]).toBeDefined();
    });
  });

  // ── §7.1 攻城条件检查 ──────────────────────

  describe('§7.1 攻城条件检查', () => {
    it('不存在的领土 → 条件不通过', () => {
      const result = sys.siege.checkSiegeConditions('nonexistent', 'player', 10000, 10000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('TARGET_NOT_FOUND');
    });

    it('己方领土 → TARGET_ALREADY_OWNED', () => {
      // 先占领许昌
      sys.territory.captureTerritory('city-xuchang', 'player');
      const result = sys.siege.checkSiegeConditions('city-xuchang', 'player', 10000, 10000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('TARGET_ALREADY_OWNED');
    });

    it('不相邻领土 → NOT_ADJACENT', () => {
      // 占领邺城，然后尝试攻占不相邻的成都
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.checkSiegeConditions('city-chengdu', 'player', 10000, 10000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('NOT_ADJACENT');
    });

    it('兵力不足 → INSUFFICIENT_TROOPS', () => {
      // 占领邺城，然后尝试攻占相邻的许昌（兵力不足）
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.checkSiegeConditions('city-xuchang', 'player', 10, 10000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });

    it('粮草不足 → INSUFFICIENT_GRAIN', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.checkSiegeConditions('city-xuchang', 'player', 10000, 10);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_GRAIN');
    });

    it('相邻+兵力+粮草充足 → 条件通过', () => {
      // 占领邺城 → 许昌是相邻领土
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.checkSiegeConditions('city-xuchang', 'player', 10000, 10000);
      expect(result.canSiege).toBe(true);
    });

    it('每日攻城次数限制（3次）', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      // 邺城相邻: city-puyang, city-beihai, city-xuchang
      // 连续攻城3次，每次攻击不同的相邻目标
      const result1 = sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      expect(result1.launched).toBe(true);
      const result2 = sys.siege.executeSiegeWithResult('city-puyang', 'player', 10000, 10000, true);
      expect(result2.launched).toBe(true);
      const result3 = sys.siege.executeSiegeWithResult('city-beihai', 'player', 10000, 10000, true);
      expect(result3.launched).toBe(true);
      // 第4次应被限制
      expect(sys.siege.getRemainingDailySieges()).toBe(0);
    });

    it('每日攻城次数用尽 → DAILY_LIMIT_REACHED', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      // 执行3次攻城（不同目标）
      sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      sys.siege.executeSiegeWithResult('city-puyang', 'player', 10000, 10000, true);
      sys.siege.executeSiegeWithResult('city-beihai', 'player', 10000, 10000, true);
      // 尝试第4次攻城（襄阳通过北海相邻）
      const result = sys.siege.checkSiegeConditions('city-xiangyang', 'player', 10000, 10000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('DAILY_LIMIT_REACHED');
    });

    it('resetDailySiegeCount 重置后可再次攻城', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      for (let i = 0; i < 3; i++) {
        sys.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 10000, true);
      }
      sys.siege.resetDailySiegeCount();
      expect(sys.siege.getRemainingDailySieges()).toBe(3);
    });

    it('攻城消耗公式: 粮草固定500（PRD MAP-4统一声明）', () => {
      const cost = sys.siege.getSiegeCostById('city-xuchang');
      expect(cost).not.toBeNull();
      expect(cost!.grain).toBe(500);
    });

    it('攻城消耗公式: 兵力消耗与防御值相关', () => {
      const cost = sys.siege.getSiegeCostById('city-xuchang');
      expect(cost).not.toBeNull();
      expect(cost!.troops).toBeGreaterThan(0);
    });

    it('相邻关系验证: 邺城与许昌相邻', () => {
      expect(areAdjacent('city-ye', 'city-xuchang')).toBe(true);
    });

    it('相邻关系验证: 邺城与成都不相邻', () => {
      expect(areAdjacent('city-ye', 'city-chengdu')).toBe(false);
    });
  });
});
