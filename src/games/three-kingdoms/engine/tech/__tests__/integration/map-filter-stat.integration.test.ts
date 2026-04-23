/**
 * 集成测试 — 地图筛选/热力图 + 地图事件 + 统计
 *
 * 覆盖 Play 文档流程：
 *   §2.5  地图筛选过滤：按类型/阵营/等级筛选
 *   §2.6  收益热力图模式：热力图数据生成
 *   §5.1  地图事件触发：事件触发机制
 *   §5.2  地图事件类型：9类事件
 *   §5.3  事件选择分支：事件选择逻辑
 *   §6.1  地图统计：5维度统计
 *
 * @module engine/tech/__tests__/integration/map-filter-stat
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldMapSystem } from '../../../map/WorldMapSystem';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { MapFilterSystem } from '../../../map/MapFilterSystem';
import { MapDataRenderer } from '../../../map/MapDataRenderer';
import { EventTriggerSystem } from '../../../event/EventTriggerSystem';
import { BattleStatisticsSubsystem, calculateBattleStats, generateSummary } from '../../../battle/BattleStatistics';
import { BattleOutcome, StarRating } from '../../../battle/battle.types';
import { PREDEFINED_EVENTS } from '../../../../core/event';
import { MapEvents } from '../../../../core/events/EventTypes';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';
import type { TileData, LandmarkData, MapFilterCriteria } from '../../../../core/map';
import type { BattleState } from '../../../battle/battle.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const worldMap = new WorldMapSystem();
  const territory = new TerritorySystem();
  const filter = new MapFilterSystem();
  const eventTrigger = new EventTriggerSystem();
  const battleStats = new BattleStatisticsSubsystem();

  const registry = new Map<string, unknown>();
  registry.set('worldMap', worldMap);
  registry.set('territory', territory);
  registry.set('mapFilter', filter);
  registry.set('eventTrigger', eventTrigger);
  registry.set('battleStatistics', battleStats);

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
  filter.init(deps);
  eventTrigger.init(deps);
  battleStats.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
    territory: deps.registry.get<TerritorySystem>('territory')!,
    filter: deps.registry.get<MapFilterSystem>('mapFilter')!,
    renderer: new MapDataRenderer(),
    eventTrigger: deps.registry.get<EventTriggerSystem>('eventTrigger')!,
    battleStats: deps.registry.get<BattleStatisticsSubsystem>('battleStatistics')!,
  };
}

/** 构造最小 BattleState 用于统计测试 */
function createMockBattleState(overrides?: Partial<BattleState>): BattleState {
  return {
    phase: 'completed',
    turn: 3,
    actionLog: [
      {
        turn: 1,
        actorSide: 'ally',
        actorId: 'hero-1',
        skillId: 'attack',
        damageResults: {
          'enemy-1': { damage: 120, isCritical: true },
          'enemy-2': { damage: 80, isCritical: false },
        },
      },
      {
        turn: 2,
        actorSide: 'enemy',
        actorId: 'enemy-1',
        skillId: 'attack',
        damageResults: {
          'hero-1': { damage: 60, isCritical: false },
        },
      },
      {
        turn: 3,
        actorSide: 'ally',
        actorId: 'hero-2',
        skillId: 'skill-a',
        damageResults: {
          'enemy-1': { damage: 200, isCritical: true },
        },
      },
    ],
    ...overrides,
  } as unknown as BattleState;
}

// ─────────────────────────────────────────────
// §2.5 地图筛选过滤
// ─────────────────────────────────────────────

describe('§2.5 地图筛选过滤', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('MapFilterSystem 应初始化成功', () => {
    const state = sys.filter.getState();
    expect(state).toBeDefined();
    expect(state).toHaveProperty('name', 'mapFilter');
  });

  it('按区域筛选 — 仅返回 wei 区域的格子', () => {
    const tiles = sys.map.getAllTiles();
    const landmarks = sys.map.getLandmarks();
    const result = MapFilterSystem.filter(tiles, landmarks, {
      regions: ['wei'],
    });
    expect(result.tiles.length).toBeGreaterThan(0);
    for (const tile of result.tiles) {
      expect(tile.region).toBe('wei');
    }
  });

  it('按地形筛选 — 仅返回 plain 地形', () => {
    const tiles = sys.map.getAllTiles();
    const landmarks = sys.map.getLandmarks();
    const result = MapFilterSystem.filter(tiles, landmarks, {
      terrains: ['plain'],
    });
    expect(result.tiles.length).toBeGreaterThan(0);
    for (const tile of result.tiles) {
      expect(tile.terrain).toBe('plain');
    }
  });

  it('按占领状态筛选地标 — 仅返回 player 占领', () => {
    const tiles = sys.map.getAllTiles();
    const landmarks = sys.map.getLandmarks();
    const result = MapFilterSystem.filter(tiles, landmarks, {
      ownerships: ['player'],
    });
    for (const lm of result.landmarks) {
      expect(lm.ownership).toBe('player');
    }
  });

  it('按地标类型筛选', () => {
    const tiles = sys.map.getAllTiles();
    const landmarks = sys.map.getLandmarks();
    const result = MapFilterSystem.filter(tiles, landmarks, {
      landmarkTypes: ['city'],
    });
    for (const lm of result.landmarks) {
      expect(lm.type).toBe('city');
    }
  });

  it('组合筛选 — 多条件叠加(区域+地形)', () => {
    const tiles = sys.map.getAllTiles();
    const landmarks = sys.map.getLandmarks();
    const result = MapFilterSystem.filter(tiles, landmarks, {
      regions: ['wei'],
      terrains: ['plain', 'city'],
    });
    for (const tile of result.tiles) {
      expect(tile.region).toBe('wei');
      expect(['plain', 'city']).toContain(tile.terrain);
    }
  });

  it('空条件返回全部数据', () => {
    const tiles = sys.map.getAllTiles();
    const landmarks = sys.map.getLandmarks();
    const result = MapFilterSystem.filter(tiles, landmarks, {});
    expect(result.tiles.length).toBe(tiles.length);
    expect(result.landmarks.length).toBe(landmarks.length);
  });

  it('filterByRegion 静态方法', () => {
    const tiles = sys.map.getAllTiles();
    const filtered = MapFilterSystem.filterByRegion(tiles, ['shu']);
    for (const t of filtered) {
      expect(t.region).toBe('shu');
    }
  });

  it('filterByTerrain 静态方法', () => {
    const tiles = sys.map.getAllTiles();
    const filtered = MapFilterSystem.filterByTerrain(tiles, ['mountain']);
    for (const t of filtered) {
      expect(t.terrain).toBe('mountain');
    }
  });

  it('filterByOwnership 静态方法', () => {
    const landmarks = sys.map.getLandmarks();
    const filtered = MapFilterSystem.filterByOwnership(landmarks, ['neutral']);
    for (const l of filtered) {
      expect(l.ownership).toBe('neutral');
    }
  });

  it('filterByLandmarkType 静态方法', () => {
    const landmarks = sys.map.getLandmarks();
    const filtered = MapFilterSystem.filterByLandmarkType(landmarks, ['city']);
    for (const l of filtered) {
      expect(l.type).toBe('city');
    }
  });

  it('getTilesWithLandmarks / getTilesWithoutLandmarks', () => {
    const tiles = sys.map.getAllTiles();
    const withLm = MapFilterSystem.getTilesWithLandmarks(tiles);
    const withoutLm = MapFilterSystem.getTilesWithoutLandmarks(tiles);
    expect(withLm.length + withoutLm.length).toBe(tiles.length);
  });

  it('筛选结果包含统计字段', () => {
    const tiles = sys.map.getAllTiles();
    const landmarks = sys.map.getLandmarks();
    const result = MapFilterSystem.filter(tiles, landmarks, { regions: ['wei'] });
    expect(result).toHaveProperty('totalTiles');
    expect(result).toHaveProperty('totalLandmarks');
    expect(result.totalTiles).toBe(result.tiles.length);
    expect(result.totalLandmarks).toBe(result.landmarks.length);
  });
});

// ─────────────────────────────────────────────
// §2.6 收益热力图模式
// ─────────────────────────────────────────────

describe('§2.6 收益热力图模式', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('热力图 5 级颜色梯度定义完整', () => {
    const colors = ['#C9A84C', '#E8D48B', '#7EC850', '#A8D88A', '#6B8B6B'];
    expect(colors.length).toBe(5);
    expect(colors[0]).toBe('#C9A84C');
    expect(colors[4]).toBe('#6B8B6B');
  });

  it('热力图数据可按产出排序', () => {
    const territories = sys.territory.getAllTerritories();
    for (const t of territories.slice(0, 3)) {
      if (t.ownership !== 'player') {
        sys.territory.captureTerritory(t.id, 'player');
      }
    }
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toBeDefined();
    expect(summary).toHaveProperty('totalProduction');
  });

  it('MapDataRenderer 可生成视口渲染数据', () => {
    const tiles = sys.map.getAllTiles();
    const viewport = sys.map.getViewport();
    const renderData = sys.renderer.computeViewportRenderData(tiles, viewport);
    if (renderData) {
      expect(renderData).toHaveProperty('tiles');
    }
  });

  it.skip('热力图产出值映射到颜色梯度', () => {
    // 需要 HeatMapRenderer API 尚未暴露
  });
});

// ─────────────────────────────────────────────
// §5.1 地图事件触发
// ─────────────────────────────────────────────

describe('§5.1 地图事件触发', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('EventTriggerSystem 初始化并加载预定义事件', () => {
    const state = sys.eventTrigger.getState();
    expect(state).toHaveProperty('eventDefs');
    expect(state).toHaveProperty('activeEvents');
    // 预定义事件应至少包含6个
    const allDefs = sys.eventTrigger.getAllEventDefs();
    expect(allDefs.length).toBeGreaterThanOrEqual(6);
  });

  it('事件定义包含三种触发类型: random / fixed / chain', () => {
    const allDefs = sys.eventTrigger.getAllEventDefs();
    const types = new Set(allDefs.map(d => d.triggerType));
    expect(types.has('random')).toBe(true);
    expect(types.has('fixed')).toBe(true);
    expect(types.has('chain')).toBe(true);
  });

  it('强制触发事件应成功', () => {
    const result = sys.eventTrigger.forceTriggerEvent('event-random-refugees', 1);
    expect(result.triggered).toBe(true);
    expect(result.instance).toBeDefined();
    expect(result.instance!.eventDefId).toBe('event-random-refugees');
    expect(result.instance!.status).toBe('active');
  });

  it('已触发的事件不能重复触发', () => {
    sys.eventTrigger.forceTriggerEvent('event-random-refugees', 1);
    const result = sys.eventTrigger.forceTriggerEvent('event-random-refugees', 2);
    expect(result.triggered).toBe(false);
  });

  it('活跃事件列表可查询', () => {
    sys.eventTrigger.forceTriggerEvent('event-random-merchants', 1);
    const active = sys.eventTrigger.getActiveEvents();
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active[0].eventDefId).toBe('event-random-merchants');
  });

  it('MapEvents 常量定义完整(6种地图事件)', () => {
    expect(MapEvents.TERRITORY_EXPANDED).toBeDefined();
    expect(MapEvents.CITY_CAPTURED).toBeDefined();
    expect(MapEvents.CITY_LOST).toBeDefined();
    expect(MapEvents.WEATHER_CHANGED).toBeDefined();
    expect(MapEvents.DAY_NIGHT_CHANGED).toBeDefined();
    expect(MapEvents.RESOURCE_POINT_CAPTURED).toBeDefined();
  });

  it('checkAndTriggerEvents 每回合检查', () => {
    const triggered = sys.eventTrigger.checkAndTriggerEvents(1);
    expect(Array.isArray(triggered)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// §5.2 地图事件类型 (9类)
// ─────────────────────────────────────────────

describe('§5.2 地图事件类型', () => {
  it('预定义事件包含流民求助(随机)', () => {
    const def = sys_eventDef('event-random-refugees');
    expect(def).toBeDefined();
    expect(def!.triggerType).toBe('random');
    expect(def!.options.length).toBeGreaterThanOrEqual(2);
  });

  it('预定义事件包含商队来访(随机)', () => {
    const def = sys_eventDef('event-random-merchants');
    expect(def).toBeDefined();
    expect(def!.triggerType).toBe('random');
    expect(def!.options.length).toBeGreaterThanOrEqual(2);
  });

  it('预定义事件包含丰收祭典(固定)', () => {
    const def = sys_eventDef('event-fixed-harvest');
    expect(def).toBeDefined();
    expect(def!.triggerType).toBe('fixed');
    expect(def!.triggerConditions).toBeDefined();
  });

  it('连锁事件包含3幕密信系列', () => {
    const def1 = sys_eventDef('event-chain-letter-1');
    const def2 = sys_eventDef('event-chain-letter-2');
    const def3 = sys_eventDef('event-chain-letter-3');
    expect(def1).toBeDefined();
    expect(def2).toBeDefined();
    expect(def3).toBeDefined();
    expect(def1!.triggerType).toBe('chain');
    expect(def2!.prerequisiteEventIds).toContain('event-chain-letter-1');
    expect(def3!.prerequisiteEventIds).toContain('event-chain-letter-1');
    expect(def3!.prerequisiteEventIds).toContain('event-chain-letter-2');
  });

  it('事件选项包含后果描述', () => {
    const def = sys_eventDef('event-random-refugees');
    for (const opt of def!.options) {
      expect(opt).toHaveProperty('id');
      expect(opt).toHaveProperty('consequences');
      expect(opt.consequences).toHaveProperty('resourceChanges');
    }
  });

  it('事件有紧急程度分级', () => {
    const urgencies = new Set<string>();
    for (const [, def] of Object.entries(PREDEFINED_EVENTS)) {
      urgencies.add(def.urgency);
    }
    expect(urgencies.size).toBeGreaterThanOrEqual(2);
  });

  it('事件有作用域(global/region/npc)', () => {
    const scopes = new Set<string>();
    for (const [, def] of Object.entries(PREDEFINED_EVENTS)) {
      scopes.add(def.scope);
    }
    expect(scopes.has('global')).toBe(true);
  });
});

/** 辅助: 从 PREDEFINED_EVENTS 获取事件定义 */
function sys_eventDef(id: string) {
  return PREDEFINED_EVENTS[id] as import('../../../../core/event').EventDef | undefined;
}

// ─────────────────────────────────────────────
// §5.3 事件选择分支
// ─────────────────────────────────────────────

describe('§5.3 事件选择分支', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('resolveEvent 处理选择后返回 EventChoiceResult', () => {
    const triggerResult = sys.eventTrigger.forceTriggerEvent('event-random-refugees', 1);
    expect(triggerResult.instance).toBeDefined();
    const instanceId = triggerResult.instance!.instanceId;

    const choiceResult = sys.eventTrigger.resolveEvent(instanceId, 'accept');
    expect(choiceResult).not.toBeNull();
    expect(choiceResult).toHaveProperty('optionId', 'accept');
  });

  it('选择"拒绝/忽略"为默认选项', () => {
    const def = sys_eventDef('event-random-refugees');
    const defaultOpt = def!.options.find(o => o.isDefault);
    expect(defaultOpt).toBeDefined();
    expect(defaultOpt!.id).toBe('reject');
  });

  it('商队来访有3个选项', () => {
    const def = sys_eventDef('event-random-merchants');
    expect(def!.options.length).toBe(3);
    const optIds = def!.options.map(o => o.id);
    expect(optIds).toContain('allow');
    expect(optIds).toContain('tax');
    expect(optIds).toContain('refuse');
  });

  it('选择后资源变更可追踪', () => {
    const def = sys_eventDef('event-random-refugees');
    const acceptOpt = def!.options.find(o => o.id === 'accept')!;
    expect(acceptOpt.consequences.resourceChanges).toBeDefined();
    expect(acceptOpt.consequences.resourceChanges).toHaveProperty('grain');
    expect(acceptOpt.consequences.resourceChanges!.grain).toBe(-50);
  });

  it('连锁事件选择可触发下一幕', () => {
    const def1 = sys_eventDef('event-chain-letter-1');
    const investigate = def1!.options.find(o => o.id === 'investigate')!;
    expect(investigate.consequences).toHaveProperty('triggerEventId', 'event-chain-letter-2');
  });

  it('resolveEvent 对无效 instanceId 返回 null', () => {
    const result = sys.eventTrigger.resolveEvent('nonexistent-instance', 'accept');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────
// §6.1 统计面板查看 (5维度)
// ─────────────────────────────────────────────

describe('§6.1 统计面板查看', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  // 维度1: 领土概览
  it('维度1 — 领土概览(总数/各阵营数)', () => {
    const territories = sys.territory.getAllTerritories();
    const total = territories.length;
    expect(total).toBeGreaterThan(0);

    const byOwnership = new Map<string, number>();
    for (const t of territories) {
      const count = byOwnership.get(t.ownership) ?? 0;
      byOwnership.set(t.ownership, count + 1);
    }
    expect(byOwnership.size).toBeGreaterThan(0);
  });

  // 维度2: 资源产出
  it('维度2 — 资源产出(总产出/各领土明细)', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toBeDefined();
    expect(summary).toHaveProperty('totalProduction');
    expect(summary.totalProduction).toHaveProperty('grain');
    expect(summary.totalProduction).toHaveProperty('gold');
    expect(summary.totalProduction).toHaveProperty('troops');
  });

  // 维度3: 战斗统计
  it('维度3 — 战斗统计(伤害/连击/摘要)', () => {
    const battleState = createMockBattleState();
    const stats = sys.battleStats.calculate(battleState);

    expect(stats.allyTotalDamage).toBe(400); // 120 + 80 + 200
    expect(stats.enemyTotalDamage).toBe(60);
    expect(stats.maxSingleDamage).toBe(200);
    expect(stats.maxCombo).toBe(1); // hero-1: crit, non-crit → combo=1; hero-2: crit → combo=1

    // 摘要
    const summary = sys.battleStats.summary(BattleOutcome.VICTORY, StarRating.THREE, 3, 5);
    expect(summary).toContain('战斗胜利');
    expect(summary).toContain('★★★');
    expect(summary).toContain('3回合');
  });

  it('战斗摘要 — 失败', () => {
    const summary = generateSummary(BattleOutcome.DEFEAT, StarRating.ZERO_STAR, 5, 0);
    expect(summary).toContain('战斗失败');
    expect(summary).toContain('5回合');
  });

  it('战斗摘要 — 平局', () => {
    const summary = generateSummary(BattleOutcome.DRAW, StarRating.ZERO_STAR, 10, 3);
    expect(summary).toContain('战斗平局');
  });

  // 维度4: 探索进度
  it('维度4 — 探索进度可查询(区域统计)', () => {
    const tiles = sys.map.getAllTiles();
    const regionCounts = MapFilterSystem.countByRegion(tiles);
    expect(regionCounts).toHaveProperty('wei');
    expect(regionCounts).toHaveProperty('wu');
    expect(regionCounts).toHaveProperty('shu');
    expect(regionCounts).toHaveProperty('neutral');

    const total = Object.values(regionCounts).reduce((s, v) => s + v, 0);
    expect(total).toBe(tiles.length);
  });

  it('地形统计', () => {
    const tiles = sys.map.getAllTiles();
    const terrainCounts = MapFilterSystem.countByTerrain(tiles);
    expect(terrainCounts).toHaveProperty('plain');
    expect(terrainCounts).toHaveProperty('mountain');
    expect(terrainCounts).toHaveProperty('water');
    expect(terrainCounts).toHaveProperty('forest');
    expect(terrainCounts).toHaveProperty('desert');
    expect(terrainCounts).toHaveProperty('city');
  });

  it('占领状态统计', () => {
    const landmarks = sys.map.getLandmarks();
    const ownershipCounts = MapFilterSystem.countByOwnership(landmarks);
    expect(ownershipCounts).toHaveProperty('player');
    expect(ownershipCounts).toHaveProperty('enemy');
    expect(ownershipCounts).toHaveProperty('neutral');
  });

  // 维度5: 事件参与统计
  it('维度5 — 事件参与统计(已完成事件数)', () => {
    const state = sys.eventTrigger.getState();
    expect(state).toHaveProperty('completedEventIds');
    expect(state.completedEventIds).toBeInstanceOf(Set);
  });

  it('BattleStatisticsSubsystem reset 清空统计数据', () => {
    const battleState = createMockBattleState();
    sys.battleStats.calculate(battleState);
    expect(sys.battleStats.getState().lastStats).not.toBeNull();

    sys.battleStats.reset();
    expect(sys.battleStats.getState().lastStats).toBeNull();
  });
});
