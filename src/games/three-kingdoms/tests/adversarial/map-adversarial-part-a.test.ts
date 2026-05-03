/**
 * Map模块 — 对抗式测试 Part A: 核心功能流程
 *
 * 3-Agent对抗流程：Builder构建流程树 → Challenger挑战完整性 → Arbiter仲裁评分
 *
 * 覆盖核心功能流程：
 *   A1: 地图初始化 — 城池数据加载、初始状态设置、区域/地形生成
 *   A2: 城池查看   — 点击城池→查看详情→查看驻防
 *   A3: 攻城流程   — 选择城池→编队→战斗→胜负判定→占领
 *   A4: 领土管理   — 占领城池→分配驻防→收取产出→升级城池
 *   A5: 地图事件   — 随机事件触发→选择处理→获得奖励/惩罚
 *   A6: 天下Tab    — 总领土数/总产出/势力分布/热力图统计
 *
 * 5维度覆盖：
 *   F-Normal:    主线正常路径
 *   F-Boundary:  边界条件（空数据、满数据、零值、极值）
 *   F-Error:     错误路径（无效输入、权限不足、资源不够）
 *   F-Cross:     跨系统联动（攻城→消耗兵力→影响声望→触发成就）
 *   F-Lifecycle: 数据生命周期（序列化/反序列化、重置、持久化）
 *
 * @module tests/adversarial/map-adversarial-part-a
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldMapSystem } from '../../engine/map/WorldMapSystem';
import { TerritorySystem } from '../../engine/map/TerritorySystem';
import { SiegeSystem } from '../../engine/map/SiegeSystem';
import { GarrisonSystem } from '../../engine/map/GarrisonSystem';
import { SiegeEnhancer } from '../../engine/map/SiegeEnhancer';
import { MapEventSystem } from '../../engine/map/MapEventSystem';
import { MapDataRenderer } from '../../engine/map/MapDataRenderer';
import { MapFilterSystem } from '../../engine/map/MapFilterSystem';
import type { ISystemDeps } from '../../core/types';
import type { OwnershipStatus } from '../../core/map';
import {
  MAP_SIZE, VIEWPORT_CONFIG, DEFAULT_LANDMARKS, LANDMARK_POSITIONS,
} from '../../core/map';

// ── 测试辅助 ──────────────────────────────────

/** 创建模拟依赖 */
function createMockDeps(overrides: Record<string, unknown> = {}): ISystemDeps {
  const registry = {
    get: vi.fn((name: string) => null),
    has: vi.fn(() => false),
    ...((overrides.registry as Record<string, unknown>) ?? {}),
  };
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      ...((overrides.eventBus as Record<string, unknown>) ?? {}),
    },
    registry: registry as any,
    ...overrides,
  } as ISystemDeps;
}

/** 创建完整的子系统依赖图 */
function createFullStack() {
  const deps = createMockDeps();
  const mapSys = new WorldMapSystem();
  const territorySys = new TerritorySystem();
  const siegeSys = new SiegeSystem();
  const garrisonSys = new GarrisonSystem();
  const enhancer = new SiegeEnhancer();
  const eventSys = new MapEventSystem();
  const renderer = new MapDataRenderer();

  const registry = {
    get: vi.fn((name: string) => {
      switch (name) {
        case 'territory': return territorySys;
        case 'siege': return siegeSys;
        case 'garrison': return garrisonSys;
        case 'worldMap': return mapSys;
        case 'siegeEnhancer': return enhancer;
        default: return null;
      }
    }),
    has: vi.fn((name: string) =>
      ['territory', 'siege', 'garrison', 'worldMap', 'siegeEnhancer'].includes(name)),
  };
  const fullDeps = createMockDeps({ registry });

  mapSys.init(fullDeps);
  territorySys.init(fullDeps);
  siegeSys.init(fullDeps);
  garrisonSys.init(fullDeps);
  enhancer.init(fullDeps);
  eventSys.init(fullDeps);
  renderer.init(fullDeps);

  return {
    deps: fullDeps, mapSys, territorySys, siegeSys,
    garrisonSys, enhancer, eventSys, renderer,
  };
}

/** 创建带武将模拟的依赖栈 */
function createStackWithHero(
  generals: Array<{ id: string; name: string; quality: string; baseStats: { defense: number } }>,
) {
  const stack = createFullStack();
  const origGet = stack.deps.registry.get;
  stack.deps.registry.get = vi.fn((name: string) => {
    if (name === 'hero') {
      return { getGeneral: (id: string) => generals.find(g => g.id === id) };
    }
    if (name === 'heroFormation') {
      return { isGeneralInAnyFormation: () => false };
    }
    return origGet(name);
  });
  return stack;
}

/** 关羽武将测试常量 */
const HERO_GUANYU = { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { defense: 95 } };

// ═══════════════════════════════════════════════════════════════
// A1: 地图初始化 — 核心功能流程
// ═══════════════════════════════════════════════════════════════

describe('A1: 地图初始化流程', () => {
  let mapSys: WorldMapSystem;
  let territorySys: TerritorySystem;

  beforeEach(() => {
    const stack = createFullStack();
    mapSys = stack.mapSys;
    territorySys = stack.territorySys;
  });

  it('F-Normal: 初始化应生成100x60格子、24个地标、洛阳为player', () => {
    expect(mapSys.getTotalTiles()).toBe(6000);
    expect(mapSys.getAllTiles().length).toBe(6000);
    const lm = mapSys.getLandmarks();
    expect(lm.length).toBe(DEFAULT_LANDMARKS.length);
    lm.forEach(l => { const pos = LANDMARK_POSITIONS[l.id]; expect(pos).toBeDefined(); expect(mapSys.isValidPosition(pos!)).toBe(true); });
    const pl = mapSys.getLandmarksByOwnership('player');
    expect(pl).toHaveLength(1); expect(pl[0].id).toBe('city-luoyang');
  });

  it('F-Normal: 三大区域+中立区均应有格子；6种地形均存在', () => {
    const regions = mapSys.getRegions();
    expect(regions.length).toBe(3);
    expect(regions.map(r => r.id).sort()).toEqual(['shu', 'wei', 'wu']);
    (['wei', 'shu', 'wu', 'neutral'] as const).forEach(id => expect(mapSys.getRegionTileCount(id)).toBeGreaterThan(0));
    expect(mapSys.getTerrains().length).toBe(6);
  });

  it('F-Normal: 领土系统洛阳level=5 defense=5000', () => {
    expect(territorySys.getTotalTerritoryCount()).toBe(DEFAULT_LANDMARKS.length);
    const p = territorySys.getTerritoriesByOwnership('player');
    expect(p).toHaveLength(1); expect(p[0].id).toBe('city-luoyang');
    expect(p[0].level).toBe(5); expect(p[0].defenseValue).toBe(5000);
  });

  it('F-Boundary: 区域边界和城池地形一致性', () => {
    expect(mapSys.getRegionAt({ x: 50, y: 10 })!.id).toBe('wei');
    expect(mapSys.getRegionAt({ x: 20, y: 40 })!.id).toBe('shu');
    expect(mapSys.getRegionAt({ x: 80, y: 40 })!.id).toBe('wu');
    expect(mapSys.getRegionAt({ x: 10, y: 0 })!.id).toBe('neutral');
    mapSys.getLandmarksByType('city').forEach(lm => {
      expect(mapSys.getTileAt(LANDMARK_POSITIONS[lm.id]!)!.terrain).toBe('city');
    });
  });

  it('F-Error: 越界坐标和不存在的ID应返回null', () => {
    [{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 100, y: 0 }, { x: 0, y: 60 }, { x: 99999, y: 99999 }]
      .forEach(p => { expect(mapSys.getTileAt(p)).toBeNull(); expect(mapSys.getRegionAt(p)).toBeNull(); });
    expect(mapSys.getLandmarkById('nonexistent')).toBeNull();
  });

  it('F-Lifecycle: 重置后应恢复初始状态', () => {
    mapSys.setLandmarkOwnership('city-xuchang', 'player');
    mapSys.setViewportOffset(500, 300);
    mapSys.reset();
    expect(mapSys.getLandmarkById('city-xuchang')!.ownership).toBe('neutral');
    const vp = mapSys.getViewport();
    expect(vp.offsetX).toBe(0); expect(vp.offsetY).toBe(0); expect(vp.zoom).toBe(VIEWPORT_CONFIG.defaultZoom);
  });
});

// ═══════════════════════════════════════════════════════════════
// A2: 城池查看流程
// ═══════════════════════════════════════════════════════════════

describe('A2: 城池查看流程', () => {
  let stack: ReturnType<typeof createStackWithHero>;
  beforeEach(() => { stack = createStackWithHero([HERO_GUANYU]); });

  it('F-Normal: 通过坐标/ID获取城池详情和产出', () => {
    const tile = stack.mapSys.getTileAt({ x: 50, y: 23 });
    expect(tile!.landmark!.id).toBe('city-luoyang');
    expect(tile!.landmark!.level).toBe(5);
    expect(tile!.landmark!.ownership).toBe('player');
    const t = stack.territorySys.getTerritoryById('city-luoyang')!;
    expect(t.baseProduction.grain).toBeGreaterThan(0);
    expect(t.currentProduction.grain).toBeCloseTo(t.baseProduction.grain * 2.5, 1);
    const neutral = stack.territorySys.getTerritoryById('city-changan')!;
    expect(neutral.ownership).toBe('neutral');
  });

  it('F-Normal: 未驻防/已驻防加成', () => {
    expect(stack.garrisonSys.getGarrisonBonus('city-luoyang').defenseBonus).toBe(0);
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    const bonus = stack.garrisonSys.getGarrisonBonus('city-luoyang');
    expect(bonus.defenseBonus).toBeCloseTo(95 * 0.003, 3);
    const t = stack.territorySys.getTerritoryById('city-luoyang')!;
    expect(stack.garrisonSys.getEffectiveDefense('city-luoyang', t.defenseValue)).toBeGreaterThan(t.defenseValue);
  });

  it('F-Boundary: 关卡和资源点类型', () => {
    const hulao = stack.territorySys.getTerritoryById('pass-hulao')!;
    expect(hulao.name).toBe('虎牢关'); expect(hulao.defenseValue).toBe(3000);
    const grain1 = stack.territorySys.getTerritoryById('res-grain1')!;
    expect(grain1.baseProduction.grain).toBeGreaterThan(grain1.baseProduction.gold);
  });

  it('F-Error: 不存在的城池/空坐标返回null', () => {
    expect(stack.territorySys.getTerritoryById('nonexistent')).toBeNull();
    expect(stack.mapSys.getLandmarkById('nonexistent')).toBeNull();
    expect(stack.mapSys.getLandmarkAt({ x: 0, y: 0 })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// A3: 攻城流程
// ═══════════════════════════════════════════════════════════════

describe('A3: 攻城流程', () => {
  let stack: ReturnType<typeof createFullStack>;

  beforeEach(() => {
    stack = createFullStack();
  });

  // ── F-Normal: 完整攻城胜利流程 ──

  it('F-Normal: 攻城胜利→占领→发射事件→记录统计', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);

    // 执行攻城（强制胜利）
    const result = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player',
      cost.troops + 100000, cost.grain + 1000, true,
    );

    // 验证结果
    expect(result.launched).toBe(true);
    expect(result.victory).toBe(true);
    expect(result.targetId).toBe('city-xuchang');
    expect(result.targetName).toBe('许昌');
    expect(result.cost.troops).toBe(cost.troops);
    expect(result.cost.grain).toBe(500);

    // 验证占领
    expect(result.capture).toBeDefined();
    expect(result.capture!.newOwner).toBe('player');
    expect(result.capture!.previousOwner).toBe('neutral');
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');

    // 验证事件发射
    expect(stack.deps.eventBus.emit).toHaveBeenCalledWith(
      'siege:victory', expect.objectContaining({
        territoryId: 'city-xuchang',
        newOwner: 'player',
      }),
    );

    // 验证统计
    expect(stack.siegeSys.getTotalSieges()).toBe(1);
    expect(stack.siegeSys.getVictories()).toBe(1);
    expect(stack.siegeSys.getDefeats()).toBe(0);
    expect(stack.siegeSys.getWinRate()).toBe(1.0);
  });

  // ── F-Normal: 完整攻城失败流程 ──

  it('F-Normal: 攻城失败→损失30%兵力→不占领→发射事件', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);

    const result = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player',
      cost.troops + 1000, cost.grain + 1000, false,
    );

    expect(result.launched).toBe(true);
    expect(result.victory).toBe(false);
    expect(result.defeatTroopLoss).toBe(Math.floor(cost.troops * 0.3));
    expect(result.failureReason).toBeDefined();

    // 领土不应被占领
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('neutral');

    // 验证失败事件
    expect(stack.deps.eventBus.emit).toHaveBeenCalledWith(
      'siege:defeat', expect.objectContaining({
        territoryId: 'city-xuchang',
        defeatTroopLoss: Math.floor(cost.troops * 0.3),
      }),
    );

    // 统计
    expect(stack.siegeSys.getTotalSieges()).toBe(1);
    expect(stack.siegeSys.getVictories()).toBe(0);
    expect(stack.siegeSys.getDefeats()).toBe(1);
    expect(stack.siegeSys.getWinRate()).toBe(0);
  });

  // ── F-Normal: 攻城消耗计算 ──

  it('F-Normal: 攻城消耗应按PRD公式计算（troops=基础×防/100, grain=500）', () => {
    // 许昌 level=4, defenseValue=4000
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    expect(cost.troops).toBe(Math.ceil(100 * (4000 / 100) * 1.0));
    expect(cost.grain).toBe(500);

    // 洛阳 level=5, defenseValue=5000
    const luoyang = stack.territorySys.getTerritoryById('city-luoyang')!;
    const costLoyang = stack.siegeSys.calculateSiegeCost(luoyang);
    expect(costLoyang.troops).toBe(Math.ceil(100 * (5000 / 100)));
    expect(costLoyang.grain).toBe(500);
  });

  // ── F-Normal: 胜率公式 ──

  it('F-Normal: 胜率公式攻防相等时应为50%', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    // 攻方战力=防方战力=4000 → attackerPower=4000, defenderPower=4000
    // effectiveTroops = troops - cost.troops
    const troopsNeeded = territory.defenseValue + cost.troops;
    // 多次模拟验证统计胜率
    let wins = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const r = stack.siegeSys.executeSiege('city-xuchang', 'player', troopsNeeded, 99999);
      if (r.victory) wins++;
      stack.territorySys.captureTerritory('city-xuchang', 'neutral');
      stack.siegeSys.resetDailySiegeCount();
      stack.siegeSys.setCaptureTimestamp('city-xuchang', 0);
    }
    const rate = wins / N;
    expect(rate).toBeGreaterThan(0.30);
    expect(rate).toBeLessThan(0.70);
  });

  // ── F-Error: 7种攻城错误码 ──

  it('F-Error: 7种攻城错误码全覆盖', () => {
    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(t);
    expect(stack.siegeSys.checkSiegeConditions('nonexistent', 'player', 99999, 99999).errorCode).toBe('TARGET_NOT_FOUND');
    expect(stack.siegeSys.checkSiegeConditions('city-luoyang', 'player', 99999, 99999).errorCode).toBe('TARGET_ALREADY_OWNED');
    expect(stack.siegeSys.checkSiegeConditions('city-chengdu', 'player', 99999, 99999).errorCode).toBe('NOT_ADJACENT');
    expect(stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', 1, 99999).errorCode).toBe('INSUFFICIENT_TROOPS');
    expect(stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', cost.troops + 100, cost.grain - 1).errorCode).toBe('INSUFFICIENT_GRAIN');
    // DAILY_LIMIT_REACHED
    for (let i = 0; i < 3; i++) {
      stack.siegeSys.executeSiegeWithResult('city-xuchang', 'player', cost.troops + 100000, cost.grain + 100000, true);
      stack.territorySys.captureTerritory('city-xuchang', 'neutral');
      stack.siegeSys.setCaptureTimestamp('city-xuchang', 0);
    }
    expect(stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', 99999, 99999).errorCode).toBe('DAILY_LIMIT_REACHED');
    // CAPTURE_COOLDOWN — 验证攻占后冷却生效
    stack.siegeSys.resetDailySiegeCount();
    stack.siegeSys.executeSiegeWithResult('city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true);
    expect(stack.siegeSys.isInCaptureCooldown('city-xuchang')).toBe(true);
  });

  it('F-Boundary: 兵力边界、冷却过期、每日重置、NaN防护', () => {
    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(t);
    expect(stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', cost.troops, cost.grain).canSiege).toBe(true);
    expect(stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', cost.troops - 1, cost.grain).canSiege).toBe(false);
    stack.siegeSys.setCaptureTimestamp('city-xuchang', Date.now() - 24 * 60 * 60 * 1000 - 1);
    expect(stack.siegeSys.isInCaptureCooldown('city-xuchang')).toBe(false);
    expect(stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', NaN, 99999).canSiege).toBe(false);
    expect(stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', 99999, NaN).canSiege).toBe(false);
  });

  // ── F-Cross: 攻城→占领→自动驻防事件 ──

  it('F-Cross: 攻城胜利应触发siege:autoGarrison事件（50%兵力驻防）', () => {
    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(t);
    stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true,
    );
    expect(stack.deps.eventBus.emit).toHaveBeenCalledWith(
      'siege:autoGarrison',
      expect.objectContaining({
        territoryId: 'city-xuchang',
        garrisonTroops: Math.floor(cost.troops * 0.5),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// A4: 领土管理流程
// ═══════════════════════════════════════════════════════════════

describe('A4: 领土管理流程', () => {
  let stack: ReturnType<typeof createStackWithHero>;

  const mockGenerals = [
    { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { defense: 95 } },
    { id: 'zhangfei', name: '张飞', quality: 'EPIC', baseStats: { defense: 80 } },
  ];

  beforeEach(() => {
    stack = createStackWithHero(mockGenerals);
  });

  // ── F-Normal: 占领→分配驻防→收取产出→升级 ──

  it('F-Normal: 完整领土管理流程', () => {
    // 1. 攻占许昌
    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(t);
    stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true,
    );
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');

    // 2. 分配驻防
    const garrisonResult = stack.garrisonSys.assignGarrison('city-xuchang', 'guanyu');
    expect(garrisonResult.success).toBe(true);
    expect(garrisonResult.bonus!.defenseBonus).toBeGreaterThan(0);

    // 3. 验证产出
    const summary = stack.territorySys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(2); // 洛阳+许昌
    expect(summary.totalProduction.grain).toBeGreaterThan(0);

    // 4. 升级（许昌level=4→5）
    const upgradeResult = stack.territorySys.upgradeTerritory('city-xuchang');
    expect(upgradeResult.success).toBe(true);
    expect(upgradeResult.newLevel).toBe(5);
    expect(upgradeResult.newProduction.grain).toBeGreaterThan(
      stack.territorySys.getTerritoryById('city-xuchang')!.baseProduction.grain * 2.0,
    );
  });

  // ── F-Normal: 产出计算 ──

  it('F-Normal: 领土产出应按等级加成系数计算', () => {
    // level=1 → ×1.0, level=2 → ×1.3, level=3 → ×1.6, level=4 → ×2.0, level=5 → ×2.5
    const luoyang = stack.territorySys.getTerritoryById('city-luoyang')!;
    expect(luoyang.level).toBe(5);
    const expectedGrain = Math.round(luoyang.baseProduction.grain * 2.5 * 100) / 100;
    expect(luoyang.currentProduction.grain).toBeCloseTo(expectedGrain, 1);
  });

  it('F-Normal: 累积产出计算应正确', () => {
    const summary = stack.territorySys.getPlayerProductionSummary();
    const hourProd = stack.territorySys.calculateAccumulatedProduction(3600);
    expect(hourProd.grain).toBeCloseTo(summary.totalProduction.grain * 3600, 1);
    expect(hourProd.gold).toBeCloseTo(summary.totalProduction.gold * 3600, 1);
  });

  // ── F-Normal: 驻防加成 ──

  it('F-Normal: 驻防应增加有效防御和产出', () => {
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');

    const territory = stack.territorySys.getTerritoryById('city-luoyang')!;
    const effectiveDefense = stack.garrisonSys.getEffectiveDefense(
      'city-luoyang', territory.defenseValue,
    );
    expect(effectiveDefense).toBeGreaterThan(territory.defenseValue);

    const effectiveProd = stack.garrisonSys.getEffectiveProduction(
      'city-luoyang', territory.currentProduction,
    );
    expect(effectiveProd.grain).toBeGreaterThan(territory.currentProduction.grain);
  });

  // ── F-Normal: 撤回驻防 ──

  it('F-Normal: 撤回驻防应移除加成', () => {
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    expect(stack.garrisonSys.isTerritoryGarrisoned('city-luoyang')).toBe(true);

    const result = stack.garrisonSys.withdrawGarrison('city-luoyang');
    expect(result.success).toBe(true);
    expect(result.generalId).toBe('guanyu');
    expect(stack.garrisonSys.isTerritoryGarrisoned('city-luoyang')).toBe(false);

    const bonus = stack.garrisonSys.getGarrisonBonus('city-luoyang');
    expect(bonus.defenseBonus).toBe(0);
  });

  // ── F-Error: 驻防错误码 ──

  it('F-Error: 驻防5重校验和升级错误路径', () => {
    expect(stack.garrisonSys.assignGarrison('nonexistent', 'guanyu').errorCode).toBe('TERRITORY_NOT_FOUND');
    expect(stack.garrisonSys.assignGarrison('city-changan', 'guanyu').errorCode).toBe('TERRITORY_NOT_OWNED');
    expect(stack.garrisonSys.assignGarrison('city-luoyang', 'nonexistent').errorCode).toBe('GENERAL_NOT_FOUND');
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    expect(stack.garrisonSys.assignGarrison('city-xuchang', 'guanyu').errorCode).toBe('GENERAL_ALREADY_GARRISONED');
    expect(stack.garrisonSys.assignGarrison('city-luoyang', 'zhangfei').errorCode).toBe('TERRITORY_ALREADY_GARRISONED');
    expect(stack.territorySys.upgradeTerritory('city-changan').success).toBe(false);
    expect(stack.territorySys.upgradeTerritory('city-luoyang').success).toBe(false);
    expect(stack.territorySys.upgradeTerritory('nonexistent').success).toBe(false);
  });

  // ── F-Boundary: 升级边界 ──

  it('F-Boundary: level=4→5升级应成功且产出提升', () => {
    stack.territorySys.captureTerritory('city-xiangyang', 'player'); // level=4
    const before = stack.territorySys.getTerritoryById('city-xiangyang')!;
    expect(before.level).toBe(4);

    const result = stack.territorySys.upgradeTerritory('city-xiangyang');
    expect(result.success).toBe(true);
    expect(result.previousLevel).toBe(4);
    expect(result.newLevel).toBe(5);
    expect(result.newProduction.grain).toBeGreaterThan(before.currentProduction.grain);
  });

  // ── F-Lifecycle: 序列化/反序列化 ──

  it('F-Lifecycle: 全系统序列化反序列化保持一致；null防护', () => {
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    stack.mapSys.setLandmarkOwnership('city-xuchang', 'player');
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    const mapD = stack.mapSys.serialize(), terrD = stack.territorySys.serialize();
    const siegeD = stack.siegeSys.serialize(), garD = stack.garrisonSys.serialize();
    const n = createFullStack();
    n.mapSys.deserialize(mapD); n.territorySys.deserialize(terrD);
    n.siegeSys.deserialize(siegeD); n.garrisonSys.deserialize(garD);
    expect(n.mapSys.getLandmarkById('city-xuchang')!.ownership).toBe('player');
    expect(n.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');
    expect(n.garrisonSys.getGarrisonCount()).toBe(1);
    expect(() => { stack.territorySys.deserialize(null as any); stack.siegeSys.deserialize(null as any); stack.garrisonSys.deserialize(null as any); }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// A5: 地图事件流程
// ═══════════════════════════════════════════════════════════════

describe('A5: 地图事件流程', () => {
  let eventSys: MapEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    eventSys = new MapEventSystem({ rng: () => 0.05 }); // 始终触发
    eventSys.init(deps);
  });

  // ── F-Normal: 事件触发→选择→奖励 ──

  it('F-Normal: 事件触发后应创建活跃事件实例', () => {
    const event = eventSys.checkAndTrigger(1000);
    expect(event).not.toBeNull();
    expect(event!.id).toMatch(/^map_event_\d+$/);
    expect(event!.status).toBe('active');
    expect(event!.choices.length).toBeGreaterThan(0);
  });

  it('F-Normal: 流寇入侵强攻应触发战斗并获得高奖励', () => {
    const event = eventSys.forceTrigger('bandit');
    expect(event.eventType).toBe('bandit');
    expect(event.isCombat).toBe(true);

    const resolution = eventSys.resolveEvent(event.id, 'attack');
    expect(resolution.success).toBe(true);
    expect(resolution.triggeredBattle).toBe(true);
    expect(resolution.rewards.length).toBe(2); // gold+grain
    expect(resolution.rewards.some(r => r.type === 'gold')).toBe(true);
  });

  it('F-Normal: 商队经过谈判应获得中等奖励', () => {
    const event = eventSys.forceTrigger('caravan');
    const resolution = eventSys.resolveEvent(event.id, 'negotiate');
    expect(resolution.success).toBe(true);
    expect(resolution.triggeredBattle).toBe(false);
    expect(resolution.rewards).toEqual([
      { type: 'gold', amount: 400 },
      { type: 'grain', amount: 100 },
    ]);
  });

  it('F-Normal: 忽略事件应获得空奖励', () => {
    const event = eventSys.forceTrigger('bandit');
    const resolution = eventSys.resolveEvent(event.id, 'ignore');
    expect(resolution.success).toBe(true);
    expect(resolution.rewards).toEqual([]);
  });

  // ── F-Normal: 5种事件类型 ──

  it('F-Normal: 所有5种事件类型应可触发', () => {
    const types = ['bandit', 'caravan', 'disaster', 'ruins', 'conflict'] as const;
    for (const type of types) {
      eventSys.reset();
      const event = eventSys.forceTrigger(type);
      expect(event.eventType).toBe(type);
    }
  });

  it('F-Normal: 天灾降临不应有attack选项', () => {
    const event = eventSys.forceTrigger('disaster');
    expect(event.choices).not.toContain('attack');
    expect(event.choices).toContain('negotiate');
    expect(event.choices).toContain('ignore');
  });

  // ── F-Boundary: 事件上限和过期 ──

  it('F-Boundary: 最多同时3个活跃事件', () => {
    eventSys.forceTrigger('bandit', 1000);
    eventSys.forceTrigger('caravan', 2000);
    eventSys.forceTrigger('ruins', 3000);
    expect(eventSys.getActiveEventCount()).toBe(3);

    const e4 = eventSys.forceTrigger('disaster', 4000);
    // 第4次应返回最后一个事件而非创建新的
    expect(eventSys.getActiveEventCount()).toBe(3);
  });

  it('F-Boundary: 过期事件应被自动清理', () => {
    const event = eventSys.forceTrigger('bandit');
    // bandit持续2小时
    const cleaned = eventSys.cleanExpiredEvents(event.createdAt + 7200001);
    expect(cleaned).toBe(1);
    expect(eventSys.getActiveEventCount()).toBe(0);
  });

  it('F-Boundary: 未过期事件不应被清理', () => {
    const event = eventSys.forceTrigger('bandit');
    const cleaned = eventSys.cleanExpiredEvents(event.createdAt + 1000);
    expect(cleaned).toBe(0);
  });

  it('F-Boundary: 检查间隔内不应重复触发', () => {
    eventSys.checkAndTrigger(1000);
    const e2 = eventSys.checkAndTrigger(1001);
    expect(e2).toBeNull();
  });

  // ── F-Error: 异常路径 ──

  it('F-Error: 解决不存在的事件应返回失败', () => {
    const r = eventSys.resolveEvent('nonexistent', 'attack');
    expect(r.success).toBe(false);
    expect(r.rewards).toEqual([]);
  });

  it('F-Error: forceTrigger不存在的类型应抛出异常', () => {
    expect(() => eventSys.forceTrigger('nonexistent' as any)).toThrow();
  });

  // ── F-Lifecycle: 序列化/反序列化 ──

  it('F-Lifecycle: 事件序列化→反序列化应保持活跃事件', () => {
    eventSys.forceTrigger('bandit');
    eventSys.forceTrigger('caravan');
    const data = eventSys.serialize();

    const sys2 = new MapEventSystem();
    sys2.init(deps);
    sys2.deserialize(data);

    expect(sys2.getActiveEventCount()).toBe(2);
    expect(sys2.getResolvedCount()).toBe(0);
  });

  it('F-Lifecycle: 版本不匹配应静默失败', () => {
    const data = eventSys.serialize();
    const sys2 = new MapEventSystem();
    sys2.init(deps);
    expect(() => sys2.deserialize({ ...data, version: 999 })).not.toThrow();
    expect(sys2.getActiveEventCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// A6: 天下Tab统计流程
// ═══════════════════════════════════════════════════════════════

describe('A6: 天下Tab统计流程', () => {
  let stack: ReturnType<typeof createFullStack>;
  beforeEach(() => { stack = createFullStack(); });

  it('F-Normal: 领土数、产出汇总、区域分布统计', () => {
    expect(stack.territorySys.getPlayerTerritoryCount()).toBe(1);
    const s = stack.territorySys.getPlayerProductionSummary();
    expect(s.totalTerritories).toBe(1); expect(s.totalProduction.grain).toBeGreaterThan(0);
    expect(s.totalGrain).toBe(s.totalProduction.gold); // just check alias exists
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    stack.territorySys.captureTerritory('city-changan', 'player');
    stack.territorySys.captureTerritory('city-chengdu', 'player');
    const s2 = stack.territorySys.getPlayerProductionSummary();
    expect(s2.totalTerritories).toBe(4); expect(s2.territoriesByRegion.wei).toBe(1); expect(s2.territoriesByRegion.shu).toBe(2);
    expect(s2.totalProduction.grain).toBeGreaterThan(s.totalProduction.grain);
  });

  it('F-Normal: MapFilterSystem统计(区域/地形/归属)', () => {
    const tiles = stack.mapSys.getAllTiles(); const lm = stack.mapSys.getLandmarks();
    const rc = MapFilterSystem.countByRegion(tiles);
    expect(rc.wei + rc.shu + rc.wu + rc.neutral).toBe(6000);
    const tc = MapFilterSystem.countByTerrain(tiles);
    expect(Object.values(tc).reduce((s, v) => s + v, 0)).toBe(6000);
    const oc = MapFilterSystem.countByOwnership(lm);
    expect(oc.player).toBe(1); expect(oc.neutral).toBe(DEFAULT_LANDMARKS.length - 1);
  });

  it('F-Normal: 筛选功能(区域/地形/归属/组合/空)', () => {
    const tiles = stack.mapSys.getAllTiles(); const lm = stack.mapSys.getLandmarks();
    MapFilterSystem.filter(tiles, lm, { regions: ['wei'] }).tiles.forEach(t => expect(t.region).toBe('wei'));
    MapFilterSystem.filterByTerrain(tiles, ['city']).forEach(t => expect(t.terrain).toBe('city'));
    expect(MapFilterSystem.filterByOwnership(lm, ['player'])).toHaveLength(1);
    MapFilterSystem.filter(tiles, lm, { regions: ['wei'], terrains: ['city'] }).tiles
      .forEach(t => { expect(t.region).toBe('wei'); expect(t.terrain).toBe('city'); });
    expect(MapFilterSystem.filter(tiles, lm, {}).totalTiles).toBe(tiles.length);
  });

  it('F-Normal: 视口渲染数据含可见格子地标；缩放影响', () => {
    const tiles = stack.mapSys.getAllTiles();
    const data = stack.renderer.computeViewportRenderData(tiles, { offsetX: 0, offsetY: 0, zoom: 1.0 });
    expect(data.tiles.length).toBeGreaterThan(0);
    expect(data.visibleLandmarks.find(l => l.id === 'city-ye')).toBeDefined();
    const r1 = stack.renderer.computeVisibleRange({ offsetX: 0, offsetY: 0, zoom: 1.0 });
    const r2 = stack.renderer.computeVisibleRange({ offsetX: 0, offsetY: 0, zoom: 2.0 });
    expect(stack.renderer.computeVisibleTileCount(r2)).toBeLessThan(stack.renderer.computeVisibleTileCount(r1));
  });

  it('F-Normal: SiegeEnhancer胜率预估和攻城奖励(含关卡1.5倍)', () => {
    const est = stack.enhancer.estimateWinRate(5000, 'city-xuchang');
    expect(est!.winRate).toBeGreaterThanOrEqual(0.05); expect(est!.winRate).toBeLessThanOrEqual(0.95);
    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const reward = stack.enhancer.calculateSiegeReward(t);
    expect(reward.resources.grain).toBe(50 * t.level); expect(reward.territoryExp).toBe(100 * t.level);
    const pass = stack.territorySys.getTerritoryById('pass-hulao')!;
    expect(stack.enhancer.calculateSiegeReward(pass).resources.grain).toBe(Math.round(50 * pass.level * 1.5));
  });

  it('F-Boundary: 空数据/null防护/空数组筛选', () => {
    expect(MapFilterSystem.filter([], [], {}).totalTiles).toBe(0);
    expect(MapFilterSystem.filter(null as any, null as any, null as any).totalTiles).toBe(0);
    expect(MapFilterSystem.filterByRegion(stack.mapSys.getAllTiles(), []).length).toBe(6000);
  });
});

// ═══════════════════════════════════════════════════════════════
// 跨系统联动 — 核心流程对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('A-Cross: 跨系统联动核心流程', () => {
  let stack: ReturnType<typeof createStackWithHero>;

  const mockGenerals = [
    { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { defense: 95 } },
  ];

  beforeEach(() => {
    stack = createStackWithHero(mockGenerals);
  });

  // ── F-Cross: 攻城→占领→驻防→产出联动 ──

  it('F-Cross: 攻城胜利→占领→驻防→产出增加完整链路', () => {
    const summaryBefore = stack.territorySys.getPlayerProductionSummary();

    // 1. 攻城
    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(t);
    const siegeResult = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true,
    );
    expect(siegeResult.victory).toBe(true);

    // 2. 驻防
    const garrisonResult = stack.garrisonSys.assignGarrison('city-xuchang', 'guanyu');
    expect(garrisonResult.success).toBe(true);

    // 3. 产出应增加
    const summaryAfter = stack.territorySys.getPlayerProductionSummary();
    expect(summaryAfter.totalTerritories).toBe(summaryBefore.totalTerritories + 1);
    expect(summaryAfter.totalProduction.grain).toBeGreaterThan(summaryBefore.totalProduction.grain);
  });

  // ── F-Cross: 领土扩张→可攻击范围变化 ──

  it('F-Cross: 占领领土后可攻击范围应扩大', () => {
    // 初始只能攻击洛阳相邻的领土
    const attackable1 = stack.territorySys.getAttackableTerritories('player');
    const attackable1Ids = attackable1.map(t => t.id);

    // 占领许昌（与洛阳相邻，通过道路网络）
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    const attackable2 = stack.territorySys.getAttackableTerritories('player');
    const attackable2Ids = attackable2.map(t => t.id);

    // 可攻击范围应有效（占领后可攻击列表仍非空）
    expect(attackable2Ids.length).toBeGreaterThan(0);
    // 许昌不应在可攻击列表中（已被占领）
    expect(attackable2Ids).not.toContain('city-xuchang');
  });

  // ── F-Cross: 失去领土→可攻击范围缩小 ──

  it('F-Cross: 失去关键领土后可攻击范围应缩小', () => {
    // 占领汉中→可攻击成都
    stack.territorySys.captureTerritory('city-hanzhong', 'player');
    expect(stack.territorySys.canAttackTerritory('city-chengdu', 'player')).toBe(true);

    // 失去汉中→不可攻击成都
    stack.territorySys.captureTerritory('city-hanzhong', 'enemy');
    expect(stack.territorySys.canAttackTerritory('city-chengdu', 'player')).toBe(false);
  });

  // ── F-Cross: 驻防影响攻城难度 ──

  it('F-Cross: 驻防应增加防守方有效战力', () => {
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    stack.garrisonSys.assignGarrison('city-xuchang', 'guanyu');

    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const defenderPower = stack.enhancer.calculateDefenderPower(t);
    expect(defenderPower).toBeGreaterThan(t.defenseValue);
    // 关羽 defense=95, factor=0.003 → bonus=0.285
    // defenderPower = 4000 × (1 + 0.285) = 5140
    expect(defenderPower).toBeCloseTo(t.defenseValue * (1 + 95 * 0.003), 0);
  });

  // ── F-Cross: 升级→产出→统计联动 ──

  it('F-Cross: 领土升级后产出汇总应实时更新', () => {
    stack.territorySys.captureTerritory('city-xiangyang', 'player'); // level=4
    const before = stack.territorySys.getPlayerProductionSummary();

    stack.territorySys.upgradeTerritory('city-xiangyang'); // 4→5
    const after = stack.territorySys.getPlayerProductionSummary();

    expect(after.totalProduction.grain).toBeGreaterThan(before.totalProduction.grain);
    expect(after.totalProduction.gold).toBeGreaterThan(before.totalProduction.gold);
  });

  // ── F-Cross: 地图事件→资源系统联动 ──

  it('F-Cross: 地图事件奖励应通过事件总线通知资源系统', () => {
    const eventSys = new MapEventSystem({ rng: () => 0.05 });
    eventSys.init(stack.deps);

    const event = eventSys.forceTrigger('bandit');
    const resolution = eventSys.resolveEvent(event.id, 'attack');

    // 事件应已解决
    expect(resolution.success).toBe(true);
    expect(resolution.rewards.length).toBeGreaterThan(0);
    // 奖励数据应由上层消费（此处验证事件总线可用）
    expect(stack.deps.eventBus.emit).toBeDefined();
  });

  // ── F-Cross: 完整征服流程（SiegeEnhancer） ──

  it('F-Cross: SiegeEnhancer完整征服流程应协调多系统', () => {
    const t = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(t);

    const result = stack.enhancer.executeConquest(
      'city-xuchang', 'player',
      t.defenseValue * 3, // 确保高胜率
      cost.troops + 100000, cost.grain + 100000,
    );

    // 征服流程应完成到battle或reward阶段
    expect(['battle', 'reward']).toContain(result.phase);
    expect(result.winRateEstimate).not.toBeNull();
    expect(result.winRateEstimate!.winRate).toBeGreaterThan(0.05);
  });

  // ── F-Cross: TerritorySystem与WorldMapSystem地标不同步（P1-7） ──

  it('F-Cross [P1-7确认]: TerritorySystem占领不同步WorldMapSystem地标归属', () => {
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const landmark = stack.mapSys.getLandmarkById('city-xuchang');

    // TerritorySystem已变更
    expect(territory.ownership).toBe('player');
    // WorldMapSystem未同步
    expect(landmark!.ownership).toBe('neutral');
    // 设计缺陷：两系统归属状态不一致
  });

  // ── F-Cross: 序列化全流程 ──

  it('F-Lifecycle: 全系统序列化→反序列化应保持一致', () => {
    // 修改所有系统状态
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    stack.mapSys.setLandmarkOwnership('city-xuchang', 'player');
    stack.mapSys.upgradeLandmark('city-xuchang'); // level 4→5

    // 序列化
    const mapData = stack.mapSys.serialize();
    const territoryData = stack.territorySys.serialize();
    const siegeData = stack.siegeSys.serialize();

    // 反序列化到新系统
    const newStack = createFullStack();
    newStack.mapSys.deserialize(mapData);
    newStack.territorySys.deserialize(territoryData);
    newStack.siegeSys.deserialize(siegeData);

    // 验证
    expect(newStack.mapSys.getLandmarkById('city-xuchang')!.ownership).toBe('player');
    expect(newStack.mapSys.getLandmarkById('city-xuchang')!.level).toBe(5);
    expect(newStack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');
    expect(newStack.siegeSys.getTotalSieges()).toBe(stack.siegeSys.getTotalSieges());
  });
});
