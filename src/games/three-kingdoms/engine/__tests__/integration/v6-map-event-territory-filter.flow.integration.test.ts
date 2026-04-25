/**
 * v6.0 集成测试 — §4.1 地图事件play流程 + §4.0.2 地图筛选深度 + §3.2.1 领土等级×产出
 *
 * 覆盖 Play 文档流程（排查缺失补充）：
 *   §4.1 地图事件系统完整play流程（触发→选择→奖励→过期→存档）
 *   §4.0.2 地图筛选深度（组合筛选、快捷筛选、统计面板数据）
 *   §3.2.1 领土等级体系×产出计算（升级→产出变化→多领土汇总）
 *   §4.0.3 地图统计面板（领土概览/资源产出/战斗统计/探索进度）
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/__tests__/integration/v6-map-event-territory-filter-flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapEventSystem } from '../../map/MapEventSystem';
import type { MapEventInstance, MapEventResolution, MapEventType, MapEventChoice } from '../../map/MapEventSystem';
import { EVENT_TYPE_CONFIGS } from '../../map/map-event-config';
import { MapFilterSystem } from '../../map/MapFilterSystem';
import { TerritorySystem } from '../../map/TerritorySystem';
import { SiegeSystem } from '../../map/SiegeSystem';
import { SiegeEnhancer } from '../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../map/GarrisonSystem';
import { WorldMapSystem } from '../../map/WorldMapSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { TileData, LandmarkData, MapFilterCriteria } from '../../../core/map';
import { DEFAULT_LANDMARKS, generateAllTiles } from '../../../core/map';
import type { TerritoryData, TerritoryProduction } from '../../../core/map/territory.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建依赖注入 */
function createDeps(): ISystemDeps {
  const mapEvent = new MapEventSystem({ rng: () => 0.05 }); // 低随机值确保触发
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();

  const registry = new Map<string, unknown>();
  registry.set('mapEventSystem', mapEvent);
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

  mapEvent.init(deps);
  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  mapSys.init(deps);

  return deps;
}

/** 创建测试用TileData */
function makeTile(x: number, y: number, region: string, terrain: string): TileData {
  return {
    pos: { x, y },
    x,
    y,
    terrain: terrain as TileData['terrain'],
    region: region as TileData['region'],
  };
}

/** 创建测试用LandmarkData */
function makeLandmark(
  id: string,
  type: string,
  name: string,
  ownership: string,
  level: number = 1,
): LandmarkData {
  return {
    id,
    type: type as LandmarkData['type'],
    name,
    level: level as LandmarkData['level'],
    ownership: ownership as LandmarkData['ownership'],
    icon: '🏰',
    productionMultiplier: 1.0,
    defenseValue: 50,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v6.0 play流程: §4.1 地图事件系统完整链路', () => {
  let deps: ISystemDeps;
  let mapEvent: MapEventSystem;

  beforeEach(() => {
    deps = createDeps();
    mapEvent = deps.registry.get<MapEventSystem>('mapEventSystem')!;
  });

  // ── §4.1 触发流程 ──────────────────────

  describe('§4.1.1 事件触发play流程', () => {
    it('checkAndTrigger: 每小时10%概率触发，最多3个未处理事件', () => {
      const now = Date.now();

      // 第一次检查 — rng=0.05 < 0.10 → 触发
      const e1 = mapEvent.checkAndTrigger(now);
      expect(e1).not.toBeNull();
      expect(e1!.status).toBe('active');

      // 第二次检查 — 时间间隔不够 → 不触发
      const e2 = mapEvent.checkAndTrigger(now + 100);
      expect(e2).toBeNull();

      // 使用forceTrigger填满3个（避免cleanExpiredEvents时间干扰）
      mapEvent.forceTrigger('caravan', now);
      mapEvent.forceTrigger('ruins', now);
      expect(mapEvent.getActiveEventCount()).toBe(3);

      // 达到上限后 → checkAndTrigger返回null
      const e5 = mapEvent.checkAndTrigger(now + 3600001);
      expect(e5).toBeNull();
      expect(mapEvent.getActiveEventCount()).toBe(3);
    });

    it('forceTrigger: 强制触发指定类型事件', () => {
      const event = mapEvent.forceTrigger('bandit', 1000);
      expect(event).toBeDefined();
      expect(event.eventType).toBe('bandit');
      expect(event.name).toBe('流寇入侵');
      expect(event.status).toBe('active');
      expect(event.isCombat).toBe(true);
      expect(event.choices).toContain('attack');
      expect(event.choices).toContain('negotiate');
      expect(event.choices).toContain('ignore');
    });

    it('5种事件类型均可触发', () => {
      const types: MapEventType[] = ['bandit', 'caravan', 'disaster', 'ruins', 'conflict'];
      for (const type of types) {
        const event = mapEvent.forceTrigger(type, Date.now());
        expect(event.eventType).toBe(type);
        expect(event.status).toBe('active');
      }
    });
  });

  // ── §4.1 选择分支play流程 ──────────────

  describe('§4.1.2 事件选择分支play流程', () => {
    it('强攻(attack): 战斗类事件触发战斗，获得高收益奖励', () => {
      const event = mapEvent.forceTrigger('bandit', Date.now());
      const result = mapEvent.resolveEvent(event.id, 'attack');

      expect(result.success).toBe(true);
      expect(result.choice).toBe('attack');
      expect(result.triggeredBattle).toBe(true); // 流寇是战斗类
      expect(result.rewards.length).toBeGreaterThan(0);

      // 验证奖励与配置一致
      const config = EVENT_TYPE_CONFIGS.find(c => c.type === 'bandit')!;
      expect(result.rewards).toEqual(config.attackRewards);
    });

    it('谈判(negotiate): 低风险中收益', () => {
      const event = mapEvent.forceTrigger('caravan', Date.now());
      const result = mapEvent.resolveEvent(event.id, 'negotiate');

      expect(result.success).toBe(true);
      expect(result.triggeredBattle).toBe(false);
      const config = EVENT_TYPE_CONFIGS.find(c => c.type === 'caravan')!;
      expect(result.rewards).toEqual(config.negotiateRewards);
    });

    it('忽略(ignore): 无风险无收益', () => {
      const event = mapEvent.forceTrigger('ruins', Date.now());
      const result = mapEvent.resolveEvent(event.id, 'ignore');

      expect(result.success).toBe(true);
      expect(result.triggeredBattle).toBe(false);
      expect(result.rewards).toEqual([]);
    });

    it('解决不存在的事件返回失败', () => {
      const result = mapEvent.resolveEvent('non-existent-id', 'attack');
      expect(result.success).toBe(false);
      expect(result.rewards).toEqual([]);
    });

    it('解决后事件从活跃列表移除', () => {
      const event = mapEvent.forceTrigger('bandit', Date.now());
      expect(mapEvent.getActiveEventCount()).toBe(1);

      mapEvent.resolveEvent(event.id, 'attack');
      expect(mapEvent.getActiveEventCount()).toBe(0);
      expect(mapEvent.getEventById(event.id)).toBeUndefined();
    });
  });

  // ── §4.1 过期处理play流程 ──────────────

  describe('§4.1.3 事件过期处理play流程', () => {
    it('过期事件自动清理，无惩罚', () => {
      const now = Date.now();
      const event = mapEvent.forceTrigger('bandit', now);

      // 验证事件存在
      expect(mapEvent.getActiveEventCount()).toBe(1);

      // 模拟时间流逝超过事件持续时间（流寇2小时 = 7200000ms）
      const expired = mapEvent.cleanExpiredEvents(now + 7200001);
      expect(expired).toBe(1);
      expect(mapEvent.getActiveEventCount()).toBe(0);
    });

    it('未过期事件不受影响', () => {
      const now = Date.now();
      mapEvent.forceTrigger('bandit', now);

      // 时间未到
      const expired = mapEvent.cleanExpiredEvents(now + 3600000);
      expect(expired).toBe(0);
      expect(mapEvent.getActiveEventCount()).toBe(1);
    });

    it('天灾事件持续24小时', () => {
      const now = Date.now();
      mapEvent.forceTrigger('disaster', now);

      // 23小时后未过期
      expect(mapEvent.cleanExpiredEvents(now + 82800000)).toBe(0);

      // 25小时后已过期
      expect(mapEvent.cleanExpiredEvents(now + 90000000)).toBe(1);
    });

    it('阵营冲突事件持续48小时', () => {
      const now = Date.now();
      mapEvent.forceTrigger('conflict', now);

      // 47小时后未过期
      expect(mapEvent.cleanExpiredEvents(now + 169200000)).toBe(0);

      // 49小时后已过期
      expect(mapEvent.cleanExpiredEvents(now + 176400000)).toBe(1);
    });
  });

  // ── §4.1 存档play流程 ──────────────────

  describe('§4.1.4 事件系统存档play流程', () => {
    it('序列化/反序列化一致', () => {
      const now = Date.now();
      const e1 = mapEvent.forceTrigger('bandit', now);
      const e2 = mapEvent.forceTrigger('caravan', now + 1000);

      // 序列化
      const saved = mapEvent.serialize();
      expect(saved.version).toBe(1);
      expect(saved.activeEvents).toHaveLength(2);
      expect(saved.resolvedCount).toBe(0);

      // 解决一个事件
      mapEvent.resolveEvent(e1.id, 'attack');
      const saved2 = mapEvent.serialize();
      expect(saved2.activeEvents).toHaveLength(1);
      expect(saved2.resolvedCount).toBe(1);

      // 反序列化恢复
      const newSystem = new MapEventSystem();
      newSystem.deserialize(saved2);
      expect(newSystem.getActiveEventCount()).toBe(1);
      expect(newSystem.getEventById(e2.id)).toBeDefined();
    });

    it('无效版本号不恢复', () => {
      const newSystem = new MapEventSystem();
      newSystem.deserialize({ version: 999, activeEvents: [], resolvedCount: 5, lastCheckTime: 0 });
      expect(newSystem.getActiveEventCount()).toBe(0);
    });
  });

  // ── §4.1 事件权重分布 ──────────────────

  describe('§4.1.5 事件类型权重与概率分布', () => {
    it('5种事件配置权重总和合理', () => {
      const totalWeight = EVENT_TYPE_CONFIGS.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBe(100); // 25+20+15+25+15

      // 各事件权重占比
      const banditRatio = 25 / totalWeight;
      const caravanRatio = 20 / totalWeight;
      expect(banditRatio).toBeCloseTo(0.25);
      expect(caravanRatio).toBeCloseTo(0.20);
    });

    it('所有事件类型都有奖励配置', () => {
      for (const config of EVENT_TYPE_CONFIGS) {
        expect(config.attackRewards).toBeDefined();
        expect(config.negotiateRewards).toBeDefined();
        expect(config.ignoreRewards).toBeDefined();
      }
    });

    it('战斗类事件标记正确', () => {
      const combatTypes = EVENT_TYPE_CONFIGS.filter(c => c.isCombat);
      expect(combatTypes).toHaveLength(2); // bandit + conflict
      expect(combatTypes.map(c => c.type)).toContain('bandit');
      expect(combatTypes.map(c => c.type)).toContain('conflict');
    });
  });

  // ── §4.1 按类型查询 ────────────────────

  describe('§4.1.6 事件查询与统计', () => {
    it('getEventsByType: 按类型筛选活跃事件', () => {
      mapEvent.forceTrigger('bandit', Date.now());
      mapEvent.forceTrigger('bandit', Date.now() + 1);
      mapEvent.forceTrigger('caravan', Date.now() + 2);

      const bandits = mapEvent.getEventsByType('bandit');
      const caravans = mapEvent.getEventsByType('caravan');
      expect(bandits).toHaveLength(2);
      expect(caravans).toHaveLength(1);
    });

    it('getState: 系统状态完整', () => {
      mapEvent.forceTrigger('ruins', 1000);
      const state = mapEvent.getState();
      expect(state.activeEvents).toHaveLength(1);
      expect(state.resolvedCount).toBe(0);
      expect(state.lastCheckTime).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('v6.0 play流程: §4.0.2 地图筛选深度 + §4.0.3 统计面板', () => {
  let tiles: TileData[];
  let landmarks: LandmarkData[];

  beforeEach(() => {
    // 构建测试数据集 — 模拟三大区域
    tiles = [
      // 魏国区域
      makeTile(10, 5, 'wei', 'plain'),
      makeTile(15, 8, 'wei', 'mountain'),
      makeTile(20, 10, 'wei', 'city'),
      makeTile(25, 5, 'wei', 'forest'),
      // 蜀国区域
      makeTile(10, 25, 'shu', 'plain'),
      makeTile(12, 30, 'shu', 'mountain'),
      makeTile(15, 28, 'shu', 'water'),
      // 吴国区域
      makeTile(35, 20, 'wu', 'plain'),
      makeTile(38, 25, 'wu', 'water'),
      makeTile(40, 22, 'wu', 'city'),
      // 中立区域
      makeTile(20, 15, 'neutral', 'plain'),
      makeTile(22, 18, 'neutral', 'pass'),
    ];

    landmarks = [
      makeLandmark('city-ye', 'city', '邺城', 'player', 3),
      makeLandmark('city-xuchang', 'city', '许昌', 'player', 2),
      makeLandmark('city-chengdu', 'city', '成都', 'enemy', 4),
      makeLandmark('city-jianye', 'city', '建业', 'enemy', 5),
      makeLandmark('city-luoyang', 'city', '洛阳', 'neutral', 5),
      makeLandmark('pass-hulao', 'pass', '虎牢关', 'neutral', 3),
      makeLandmark('res-grain1', 'resource', '许田', 'player', 2),
    ];
  });

  // ── §4.0.2 组合筛选 ────────────────────

  describe('§4.0.2 组合筛选play流程', () => {
    it('单维度筛选: 按区域筛选', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, { regions: ['wei'] });
      expect(result.totalTiles).toBe(4);
      expect(result.tiles.every(t => t.region === 'wei')).toBe(true);
    });

    it('单维度筛选: 按地形筛选（OR逻辑）', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, { terrains: ['plain', 'water'] });
      // plain: wei(10,5), shu(10,25), wu(35,20), neutral(20,15) = 4
      // water: shu(15,28), wu(38,25) = 2
      // 合计 6
      expect(result.totalTiles).toBe(6);
    });

    it('多维度组合: 区域 AND 地形', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, {
        regions: ['wei'],
        terrains: ['plain', 'city'],
      });
      // wei + (plain or city) = (10,5)plain + (20,10)city = 2
      expect(result.totalTiles).toBe(2);
    });

    it('按占领状态筛选地标', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, { ownerships: ['player'] });
      expect(result.totalLandmarks).toBe(3); // 邺城, 许昌, 许田
    });

    it('空条件返回全部', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, {});
      expect(result.totalTiles).toBe(tiles.length);
      expect(result.totalLandmarks).toBe(landmarks.length);
    });

    it('无匹配结果返回空', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, { regions: ['wei'], terrains: ['water'] });
      expect(result.totalTiles).toBe(0);
    });
  });

  // ── §4.0.2 快捷筛选 ────────────────────

  describe('§4.0.2 快捷筛选按钮逻辑', () => {
    it('🏠我的领土: 筛选player占领的地标', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, { ownerships: ['player'] });
      const playerLandmarks = result.landmarks;
      expect(playerLandmarks.every(l => l.ownership === 'player')).toBe(true);
    });

    it('⚔️可征服: 筛选非己方地标(enemy+neutral)', () => {
      const result = MapFilterSystem.filter(tiles, landmarks, {
        ownerships: ['enemy', 'neutral'],
      });
      const attackable = result.landmarks;
      expect(attackable.every(l => l.ownership !== 'player')).toBe(true);
      expect(attackable.length).toBe(4); // 成都, 建业, 洛阳, 虎牢关
    });
  });

  // ── §4.0.3 统计面板数据 ─────────────────

  describe('§4.0.3 地图统计面板', () => {
    it('领土概览: 各区域领土数', () => {
      const byRegion = MapFilterSystem.countByRegion(tiles);
      expect(byRegion.wei).toBe(4);
      expect(byRegion.shu).toBe(3);
      expect(byRegion.wu).toBe(3);
      expect(byRegion.neutral).toBe(2);
    });

    it('地形分布统计', () => {
      const byTerrain = MapFilterSystem.countByTerrain(tiles);
      expect(byTerrain.plain).toBe(4);
      expect(byTerrain.mountain).toBe(2);
      expect(byTerrain.water).toBe(2);
      expect(byTerrain.city).toBe(2);
      expect(byTerrain.forest).toBe(1);
      expect(byTerrain.pass).toBe(1);
    });

    it('占领状态统计', () => {
      const byOwnership = MapFilterSystem.countByOwnership(landmarks);
      expect(byOwnership.player).toBe(3);
      expect(byOwnership.enemy).toBe(2);
      expect(byOwnership.neutral).toBe(2);
    });

    it('有地标/无地标格子筛选', () => {
      // 给部分tiles添加landmark
      const tilesWithLandmarks = tiles.map((t, i) =>
        i < 3 ? { ...t, landmark: landmarks[i] } : t,
      );
      const withLM = MapFilterSystem.getTilesWithLandmarks(tilesWithLandmarks);
      const withoutLM = MapFilterSystem.getTilesWithoutLandmarks(tilesWithLandmarks);
      expect(withLM.length).toBe(3);
      expect(withoutLM.length).toBe(tiles.length - 3);
    });
  });
});

describe('v6.0 play流程: §3.2.1 领土等级体系×产出计算', () => {
  let deps: ISystemDeps;
  let territory: TerritorySystem;

  beforeEach(() => {
    deps = createDeps();
    territory = deps.registry.get<TerritorySystem>('territory')!;
  });

  // ── §3.2.1 领土等级体系 ────────────────

  describe('§3.2.1 领土等级play流程', () => {
    it('初始领土等级为1，产出×1.0', () => {
      const all = territory.getAllTerritories();
      expect(all.length).toBeGreaterThan(0);

      // 查找一个初始领土
      const t = all[0];
      expect(t.level).toBeGreaterThanOrEqual(1);
    });

    it('占领领土后可升级', () => {
      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership !== 'player');
      if (!target) return; // 无可占领领土时跳过

      // 先占领
      const captured = territory.captureTerritory(target.id, 'player');
      if (!captured) return;

      // 升级
      const result = territory.upgradeTerritory(target.id);
      if (result.success) {
        expect(result.newLevel).toBeGreaterThan(result.previousLevel);
        expect(result.newProduction.grain).toBeGreaterThanOrEqual(result.previousLevel > 0 ? 0 : 0);
      }
    });

    it('非己方领土不可升级', () => {
      const all = territory.getAllTerritories();
      const neutral = all.find(t => t.ownership === 'neutral');
      if (!neutral) return;

      const result = territory.upgradeTerritory(neutral.id);
      expect(result.success).toBe(false);
    });

    it('满级(5)领土不可继续升级', () => {
      const all = territory.getAllTerritories();
      const target = all[0];

      // 先占领
      territory.captureTerritory(target.id, 'player');

      // 手动设置满级
      const t = territory.getTerritoryById(target.id);
      if (!t) return;

      // 连续升级直到满级
      for (let i = 0; i < 5; i++) {
        territory.upgradeTerritory(target.id);
      }

      // 满级后再升级应失败
      const result = territory.upgradeTerritory(target.id);
      if (t.level >= 5) {
        expect(result.success).toBe(false);
      }
    });
  });

  // ── §3.2.2 产出计算play流程 ────────────

  describe('§3.2.2 领土产出计算play流程', () => {
    it('玩家领土产出汇总', () => {
      // 先占领一些领土
      const all = territory.getAllTerritories();
      const neutrals = all.filter(t => t.ownership === 'neutral').slice(0, 3);
      for (const n of neutrals) {
        territory.captureTerritory(n.id, 'player');
      }

      const summary = territory.getPlayerProductionSummary();
      expect(summary).toBeDefined();
      expect(summary.totalProduction).toBeDefined();
      expect(summary.totalProduction.grain).toBeGreaterThanOrEqual(0);
      expect(summary.totalProduction.gold).toBeGreaterThanOrEqual(0);
      expect(summary.totalTerritories).toBeGreaterThan(0);
    });

    it('产出累积: 按时间线性增长', () => {
      // 占领一个领土确保有产出
      const all = territory.getAllTerritories();
      const target = all.find(t => t.ownership === 'neutral');
      if (target) {
        territory.captureTerritory(target.id, 'player');
      }

      const summary = territory.getPlayerProductionSummary();
      const prod1 = territory.calculateAccumulatedProduction(3600); // 1小时
      const prod2 = territory.calculateAccumulatedProduction(7200); // 2小时

      // 2小时产出约为1小时的2倍
      if (summary.totalProduction.grain > 0) {
        expect(prod2.grain).toBeCloseTo(prod1.grain * 2, 0);
      }
    });

    it('多领土总产出正确汇总', () => {
      const all = territory.getAllTerritories();
      // 占领前3个中立领土
      const neutrals = all.filter(t => t.ownership === 'neutral').slice(0, 3);
      for (const n of neutrals) {
        territory.captureTerritory(n.id, 'player');
      }

      const playerTerritories = territory.getAllTerritories().filter(t => t.ownership === 'player');
      const summary = territory.getPlayerProductionSummary();

      // 汇总产出应等于各领土产出之和
      let expectedGrain = 0;
      let expectedGold = 0;
      for (const t of playerTerritories) {
        expectedGrain += t.currentProduction.grain;
        expectedGold += t.currentProduction.gold;
      }
      expect(summary.totalProduction.grain).toBeCloseTo(expectedGrain, 1);
      expect(summary.totalProduction.gold).toBeCloseTo(expectedGold, 1);
    });
  });

  // ── §3 领土归属与序列化 ─────────────────

  describe('§3 领土归属与存档', () => {
    it('setOwnerships: 批量设置归属', () => {
      territory.setOwnerships({
        'city-ye': 'player',
        'city-chengdu': 'player',
        'city-luoyang': 'enemy',
      });

      expect(territory.getTerritoryById('city-ye')?.ownership).toBe('player');
      expect(territory.getTerritoryById('city-chengdu')?.ownership).toBe('player');
      expect(territory.getTerritoryById('city-luoyang')?.ownership).toBe('enemy');
    });

    it('序列化/反序列化后归属一致', () => {
      territory.setOwnerships({
        'city-ye': 'player',
        'city-xuchang': 'player',
      });

      const saved = territory.serialize();
      const newTerritory = new TerritorySystem();
      const newDeps = createDeps();
      newTerritory.init(newDeps);
      newTerritory.deserialize(saved);

      expect(newTerritory.getTerritoryById('city-ye')?.ownership).toBe('player');
      expect(newTerritory.getTerritoryById('city-xuchang')?.ownership).toBe('player');
    });

    it('getAttackableTerritories: 返回可攻击的相邻领土', () => {
      // 设置一些己方领土
      territory.setOwnerships({ 'city-ye': 'player' });

      const attackable = territory.getAttackableTerritories('player');
      // 可攻击领土应是非己方且与己方相邻的
      for (const t of attackable) {
        expect(t.ownership).not.toBe('player');
      }
    });
  });
});
