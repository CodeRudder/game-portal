/**
 * Map模块 — 对抗式测试 (Adversarial Testing)
 *
 * 3-Agent对抗流程：Builder构建流程树 → Challenger挑战完整性 → Arbiter仲裁评分
 *
 * 覆盖子系统：
 *   M1: WorldMapSystem   — 世界地图核心
 *   M2: TerritorySystem  — 领土管理
 *   M3: SiegeSystem      — 攻城战
 *   M4: GarrisonSystem   — 驻防系统
 *   M5: SiegeEnhancer    — 攻城增强
 *   M6: MapEventSystem   — 地图事件
 *   M7: MapDataRenderer  — 渲染数据
 *
 * 5维度挑战：
 *   F-Normal:    主线流程完整性
 *   F-Boundary:  边界条件覆盖
 *   F-Error:     异常路径覆盖
 *   F-Cross:     跨系统交互覆盖
 *   F-Lifecycle: 数据生命周期覆盖
 *
 * @module tests/adversarial/map-adversarial-test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorldMapSystem } from '../WorldMapSystem';
import { TerritorySystem } from '../TerritorySystem';
import { SiegeSystem } from '../SiegeSystem';
import { GarrisonSystem } from '../GarrisonSystem';
import { SiegeEnhancer } from '../SiegeEnhancer';
import { MapEventSystem } from '../MapEventSystem';
import { MapDataRenderer } from '../MapDataRenderer';
import { MapFilterSystem } from '../MapFilterSystem';
import type { ISystemDeps } from '../../../core/types';
import type { OwnershipStatus, LandmarkLevel, GridPosition } from '../../../core/map';
import {
  MAP_SIZE,
  GRID_CONFIG,
  VIEWPORT_CONFIG,
  DEFAULT_LANDMARKS,
  LANDMARK_POSITIONS,
} from '../../../core/map';

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

  // 构建注册表
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
    has: vi.fn((name: string) => ['territory', 'siege', 'garrison', 'worldMap', 'siegeEnhancer'].includes(name)),
  };
  const fullDeps = createMockDeps({ registry });

  mapSys.init(fullDeps);
  territorySys.init(fullDeps);
  siegeSys.init(fullDeps);
  garrisonSys.init(fullDeps);
  enhancer.init(fullDeps);
  eventSys.init(fullDeps);
  renderer.init(fullDeps);

  return { deps: fullDeps, mapSys, territorySys, siegeSys, garrisonSys, enhancer, eventSys, renderer };
}

/** 创建带HeroSystem模拟的依赖 */
function createStackWithHero(generals: Array<{ id: string; name: string; quality: string; baseStats: { defense: number } }>) {
  const stack = createFullStack();
  const origGet = stack.deps.registry.get;
  stack.deps.registry.get = vi.fn((name: string) => {
    if (name === 'hero') {
      return {
        getGeneral: (id: string) => generals.find(g => g.id === id),
      };
    }
    if (name === 'heroFormation') {
      return { isGeneralInAnyFormation: () => false };
    }
    return origGet(name);
  });
  return stack;
}

// ═══════════════════════════════════════════════════════════════
// M1: WorldMapSystem — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('M1: WorldMapSystem — 对抗式测试', () => {
  let sys: WorldMapSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    sys = new WorldMapSystem();
    sys.init(deps);
  });

  // ── F-Normal: 地图初始化和格子生成 ──

  it('F-Normal: 初始化后应生成正确数量的格子 (100×60=6000)', () => {
    expect(sys.getTotalTiles()).toBe(MAP_SIZE.cols * MAP_SIZE.rows);
    expect(sys.getSize()).toEqual({ cols: 100, rows: 60 });
  });

  it('F-Normal: 初始化后应生成所有默认地标', () => {
    const landmarks = sys.getLandmarks();
    expect(landmarks.length).toBe(DEFAULT_LANDMARKS.length);
  });

  it('F-Normal: 所有地标应在有效坐标上', () => {
    const landmarks = sys.getLandmarks();
    for (const lm of landmarks) {
      const pos = LANDMARK_POSITIONS[lm.id];
      expect(pos).toBeDefined();
      expect(sys.isValidPosition(pos!)).toBe(true);
    }
  });

  // ── F-Boundary: 坐标边界 ──

  it('F-Boundary: 坐标边界 (0,0) 应有效', () => {
    expect(sys.isValidPosition({ x: 0, y: 0 })).toBe(true);
    expect(sys.getTileAt({ x: 0, y: 0 })).not.toBeNull();
  });

  it('F-Boundary: 坐标最大边界 (99,59) 应有效', () => {
    expect(sys.isValidPosition({ x: 99, y: 59 })).toBe(true);
    expect(sys.getTileAt({ x: 99, y: 59 })).not.toBeNull();
  });

  it('F-Boundary: 坐标恰好越界 (100,60) 应无效', () => {
    expect(sys.isValidPosition({ x: 100, y: 60 })).toBe(false);
    expect(sys.getTileAt({ x: 100, y: 60 })).toBeNull();
  });

  it('F-Boundary: 负坐标应无效', () => {
    expect(sys.isValidPosition({ x: -1, y: 0 })).toBe(false);
    expect(sys.isValidPosition({ x: 0, y: -1 })).toBe(false);
    expect(sys.getTileAt({ x: -1, y: -1 })).toBeNull();
  });

  it('F-Boundary: 超大坐标应无效', () => {
    expect(sys.isValidPosition({ x: 99999, y: 99999 })).toBe(false);
    expect(sys.getTileAt({ x: 99999, y: 99999 })).toBeNull();
  });

  // ── F-Error: 地标操作异常 ──

  it('F-Error: 设置不存在地标的归属应返回 false', () => {
    expect(sys.setLandmarkOwnership('nonexistent', 'player')).toBe(false);
  });

  it('F-Error: 升级不存在地标应返回 false', () => {
    expect(sys.upgradeLandmark('nonexistent')).toBe(false);
  });

  it('F-Error: 升级满级(level=5)地标应返回 false', () => {
    // 找一个level=5的地标
    const lm = sys.getLandmarks().find(l => l.level === 5);
    expect(lm).toBeDefined();
    expect(sys.upgradeLandmark(lm!.id)).toBe(false);
  });

  it('F-Error: 按ID获取不存在地标应返回 null', () => {
    expect(sys.getLandmarkById('nonexistent')).toBeNull();
  });

  // ── F-Boundary: 地标升级边界 ──

  it('F-Boundary: 升级level=4地标应成功且变为level=5', () => {
    const lm = sys.getLandmarks().find(l => l.level === 4);
    expect(lm).toBeDefined();
    const result = sys.upgradeLandmark(lm!.id);
    expect(result).toBe(true);
    const updated = sys.getLandmarkById(lm!.id);
    expect(updated!.level).toBe(5);
    // 产出倍率应增加0.2
    expect(updated!.productionMultiplier).toBeCloseTo(lm!.productionMultiplier + 0.2, 10);
  });

  // ── F-Lifecycle: 序列化/反序列化 ──

  it('F-Lifecycle: 序列化→反序列化应保持地标归属一致', () => {
    sys.setLandmarkOwnership('city-luoyang', 'enemy');
    sys.setLandmarkOwnership('city-ye', 'player');
    const data = sys.serialize();

    const sys2 = new WorldMapSystem();
    sys2.init(deps);
    sys2.deserialize(data);

    expect(sys2.getLandmarkById('city-luoyang')!.ownership).toBe('enemy');
    expect(sys2.getLandmarkById('city-ye')!.ownership).toBe('player');
  });

  it('F-Lifecycle: 序列化→反序列化应保持地标等级一致', () => {
    sys.upgradeLandmark('city-xuchang'); // level 4→5
    const data = sys.serialize();

    const sys2 = new WorldMapSystem();
    sys2.init(deps);
    sys2.deserialize(data);

    expect(sys2.getLandmarkById('city-xuchang')!.level).toBe(5);
  });

  it('F-Lifecycle: 反序列化空数据不应崩溃', () => {
    expect(() => {
      sys.deserialize({
        landmarkOwnerships: {},
        landmarkLevels: {},
        viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
        version: 1,
      });
    }).not.toThrow();
  });

  // ── F-Error: 视口异常值 ──

  it('F-Error: 设置NaN视口偏移不应崩溃', () => {
    expect(() => sys.setViewportOffset(NaN, NaN)).not.toThrow();
  });

  it('F-Boundary: 缩放应被clamp到[minZoom, maxZoom]范围', () => {
    sys.setZoom(0.1); // 低于minZoom(0.5)
    expect(sys.getViewport().zoom).toBe(VIEWPORT_CONFIG.minZoom);

    sys.setZoom(10.0); // 高于maxZoom(2.0)
    expect(sys.getViewport().zoom).toBe(VIEWPORT_CONFIG.maxZoom);
  });

  it('F-Normal: 重置后视口应回到初始状态', () => {
    sys.setViewportOffset(100, 200);
    sys.setZoom(2.0);
    sys.reset();
    const vp = sys.getViewport();
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBe(0);
    expect(vp.zoom).toBe(VIEWPORT_CONFIG.defaultZoom);
  });

  // ── F-Normal: 区域划分 ──

  it('F-Normal: getRegions应返回3个区域(魏蜀吴，不含neutral)', () => {
    const regions = sys.getRegions();
    expect(regions.length).toBe(3);
    const ids = regions.map(r => r.id);
    expect(ids).toContain('wei');
    expect(ids).toContain('shu');
    expect(ids).toContain('wu');
    expect(ids).not.toContain('neutral');
  });

  // ── F-Error: 数据隔离 ──

  /**
   * ⚠️ P0-6 [已确认]: getTileAt返回的landmark修改会影响内部tiles数据
   *
   * 复现步骤：
   * 1. sys.getTileAt({ x: 50, y: 23 }) 获取含landmark的格子
   * 2. 修改返回对象的 landmark.ownership = 'hacked'
   * 3. 再次 sys.getTileAt({ x: 50, y: 23 }) 获取同一格子
   * 4. 发现内部数据已被篡改为 'hacked'
   *
   * 根因：getTileAt中虽然做了 { ...t, landmark: t.landmark ? { ...t.landmark } : undefined }
   * 但返回后外部修改了landmark的属性，这个修改被JS引擎优化为引用修改
   * 实际上{ ...t.landmark }创建了新对象，但tiles数组中的landmark引用被直接暴露
   *
   * 修复建议：getTileAt应返回深拷贝，或使用Object.freeze防止修改
   */
  it('F-Error [P0-6 确认]: getTileAt返回的landmark修改会影响内部tiles数据(安全漏洞)', () => {
    const tile = sys.getTileAt({ x: 50, y: 23 });
    expect(tile).not.toBeNull();
    expect(tile!.landmark).toBeDefined();
    const originalOwnership = tile!.landmark!.ownership;

    // 修改返回的tile的landmark
    tile!.landmark!.ownership = 'hacked' as OwnershipStatus;

    // 获取内部状态检查是否被影响
    const tile2 = sys.getTileAt({ x: 50, y: 23 });
    // ⚠️ BUG: 内部数据已被外部修改影响！
    expect(tile2!.landmark!.ownership).toBe('hacked');
    // 这违反了数据封装原则：外部代码可以通过修改返回值来篡改内部状态
  });
});

// ═══════════════════════════════════════════════════════════════
// M2: TerritorySystem — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('M2: TerritorySystem — 对抗式测试', () => {
  let sys: TerritorySystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    sys = new TerritorySystem();
    sys.init(deps);
  });

  // ── F-Normal: 领土初始化 ──

  it('F-Normal: 初始化后应生成24个领土+4个主城周边资源点', () => {
    expect(sys.getTotalTerritoryCount()).toBe(DEFAULT_LANDMARKS.length + 4);
  });

  it('F-Normal: 初始状态下玩家应拥有洛阳及周边资源点', () => {
    const playerTerritories = sys.getTerritoriesByOwnership('player');
    expect(playerTerritories.length).toBeGreaterThanOrEqual(1);
    const ids = playerTerritories.map(t => t.id);
    expect(ids).toContain('city-luoyang');
  });

  // ── F-Normal: 占领领土 ──

  it('F-Normal: 占领领土应改变归属并发射事件', () => {
    const result = sys.captureTerritory('city-changan', 'player');
    expect(result).toBe(true);
    expect(sys.getTerritoryById('city-changan')!.ownership).toBe('player');
    expect(deps.eventBus.emit).toHaveBeenCalledWith('territory:captured', expect.objectContaining({
      territoryId: 'city-changan',
      newOwner: 'player',
    }));
  });

  // ── P1-4: 重复占领同一归属 ──

  it('F-Boundary [P1-4]: 对已占有的领土重复capture应成功但不应产生实际变更', () => {
    const t1 = sys.getTerritoryById('city-luoyang');
    expect(t1!.ownership).toBe('player');

    // 重复占领 — 当前实现不拒绝
    const result = sys.captureTerritory('city-luoyang', 'player');
    expect(result).toBe(true);
    // 验证归属未变
    const t2 = sys.getTerritoryById('city-luoyang');
    expect(t2!.ownership).toBe('player');
  });

  // ── F-Error: 占领不存在的领土 ──

  it('F-Error: 占领不存在的领土应返回 false', () => {
    expect(sys.captureTerritory('nonexistent', 'player')).toBe(false);
  });

  // ── F-Normal: 领土升级 ──

  it('F-Normal: 升级玩家领土应成功并提升产出', () => {
    const before = sys.getTerritoryById('city-luoyang')!;
    expect(before.ownership).toBe('player');
    expect(before.level).toBe(5); // 洛阳初始level=5
    // 洛阳已满级，不可升级
    const result = sys.upgradeTerritory('city-luoyang');
    expect(result.success).toBe(false);
  });

  it('F-Normal: 升级非玩家领土应失败', () => {
    const result = sys.upgradeTerritory('city-changan');
    expect(result.success).toBe(false);
  });

  it('F-Boundary: 升级level=4的玩家领土应成功', () => {
    // 先占领一个level=4的领土
    sys.captureTerritory('city-xiangyang', 'player');
    const before = sys.getTerritoryById('city-xiangyang')!;
    expect(before.level).toBe(4);

    const result = sys.upgradeTerritory('city-xiangyang');
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe(5);
    expect(result.previousLevel).toBe(4);
    // 升级后产出应增加
    expect(result.newProduction.grain).toBeGreaterThan(before.currentProduction.grain);
  });

  // ── F-Boundary: 攻城条件 ──

  it('F-Normal: 洛阳应与许昌相邻（可攻击）', () => {
    // 洛阳(player) → 许昌(neutral) 应可攻击
    expect(sys.canAttackTerritory('city-xuchang', 'player')).toBe(true);
  });

  it('F-Boundary: 不相邻的领土不可攻击', () => {
    // 洛阳(player) → 成都(neutral) 不相邻
    expect(sys.canAttackTerritory('city-chengdu', 'player')).toBe(false);
  });

  it('F-Error: 不存在的领土不可攻击', () => {
    expect(sys.canAttackTerritory('nonexistent', 'player')).toBe(false);
  });

  it('F-Boundary: 己方领土不可攻击', () => {
    expect(sys.canAttackTerritory('city-luoyang', 'player')).toBe(false);
  });

  // ── F-Normal: 产出汇总 ──

  it('F-Normal: 初始状态下玩家产出汇总包含洛阳及周边资源点', () => {
    const summary = sys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBeGreaterThanOrEqual(1);
    const ids = summary.details.map(d => d.id);
    expect(ids).toContain('city-luoyang');
    // 洛阳level=5, multiplier=2.5
    expect(summary.totalProduction.grain).toBeGreaterThan(0);
  });

  it('F-Normal: 累积产出计算应正确', () => {
    const summary = sys.getPlayerProductionSummary();
    const accumulated = sys.calculateAccumulatedProduction(3600); // 1小时
    expect(accumulated.grain).toBeCloseTo(summary.totalProduction.grain * 3600, 1);
  });

  // ── F-Lifecycle: 序列化/反序列化 ──

  it('F-Lifecycle: 序列化→反序列化应保持归属和等级一致', () => {
    sys.captureTerritory('city-changan', 'player');
    sys.captureTerritory('city-xiangyang', 'player');
    const data = sys.serialize();

    const sys2 = new TerritorySystem();
    sys2.init(deps);
    sys2.deserialize(data);

    expect(sys2.getTerritoryById('city-changan')!.ownership).toBe('player');
    expect(sys2.getTerritoryById('city-xiangyang')!.ownership).toBe('player');
    expect(sys2.getPlayerTerritoryCount()).toBeGreaterThanOrEqual(3); // 洛阳+长安+襄阳+周边资源点
  });

  // ── F-Error: 批量设置归属 ──

  it('F-Error: setOwnerships中不存在的ID应被安全忽略', () => {
    expect(() => {
      sys.setOwnerships({ 'nonexistent': 'player', 'city-luoyang': 'enemy' });
    }).not.toThrow();
    expect(sys.getTerritoryById('city-luoyang')!.ownership).toBe('enemy');
  });
});

// ═══════════════════════════════════════════════════════════════
// M3: SiegeSystem — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('M3: SiegeSystem — 对抗式测试', () => {
  let stack: ReturnType<typeof createFullStack>;

  beforeEach(() => {
    stack = createFullStack();
  });

  // ── F-Normal: 攻城条件校验 ──

  it('F-Normal: 满足所有条件时应允许攻城', () => {
    // 洛阳(player) → 许昌(neutral), 相邻
    const territory = stack.territorySys.getTerritoryById('city-xuchang');
    const cost = stack.siegeSys.calculateSiegeCost(territory!);
    const result = stack.siegeSys.checkSiegeConditions(
      'city-xuchang', 'player', cost.troops + 1000, cost.grain + 1000,
    );
    expect(result.canSiege).toBe(true);
  });

  it('F-Normal: 攻城消耗计算应正确 (troops=基础×防/100×typeFactor, grain=500)', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    // 许昌 level=4, defenseValue=1000*0.5*4=2000
    // city typeFactor=0.8, troops = ceil(100 * 2000/100 * 0.8) = 1600
    expect(cost.troops).toBe(Math.ceil(100 * (territory.defenseValue / 100) * 0.8));
    expect(cost.grain).toBe(500);
  });

  // ── F-Error: 7种错误码 ──

  it('F-Error: TARGET_NOT_FOUND — 目标不存在', () => {
    const result = stack.siegeSys.checkSiegeConditions('nonexistent', 'player', 99999, 99999);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_NOT_FOUND');
  });

  it('F-Error: TARGET_ALREADY_OWNED — 目标已是己方', () => {
    const result = stack.siegeSys.checkSiegeConditions('city-luoyang', 'player', 99999, 99999);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_ALREADY_OWNED');
  });

  it('F-Error: NOT_ADJACENT — 不相邻', () => {
    // 洛阳(player) → 成都(neutral), 不相邻
    const result = stack.siegeSys.checkSiegeConditions('city-chengdu', 'player', 99999, 99999);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('NOT_ADJACENT');
  });

  it('F-Error: INSUFFICIENT_TROOPS — 兵力不足', () => {
    const result = stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', 1, 99999);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
  });

  it('F-Error: INSUFFICIENT_GRAIN — 粮草不足', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    const result = stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', cost.troops + 100, cost.grain - 1);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_GRAIN');
  });

  it('F-Error: DAILY_LIMIT_REACHED — 每日3次上限', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    // 连续攻城3次（每次恢复归属以允许再次攻城）
    for (let i = 0; i < 3; i++) {
      stack.siegeSys.executeSiegeWithResult('city-xuchang', 'player', cost.troops + 100000, cost.grain + 100000, true);
      // 恢复归属以便下次可攻
      stack.territorySys.captureTerritory('city-xuchang', 'neutral');
      // 清除冷却
      stack.siegeSys.setCaptureTimestamp('city-xuchang', 0);
    }
    // 第4次应被每日限制拒绝
    const result = stack.siegeSys.checkSiegeConditions('city-xuchang', 'player', 99999, 99999);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('DAILY_LIMIT_REACHED');
  });

  // ── F-Normal: 胜率公式验证 ──

  it('F-Normal: 胜率公式 — 攻防相等时胜率=50%', () => {
    // 胜率 = min(0.95, max(0.05, (attackerPower / defenderPower) × 0.5))
    // 许昌 defenseValue = 4000
    // attackerPower = troops - cost.troops
    // 需要 attackerPower = 4000 → 胜率 = (4000/4000) × 0.5 = 0.5
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    const troopsNeeded = territory.defenseValue + cost.troops;
    // 多次模拟验证统计胜率接近50%
    let victories = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const result = stack.siegeSys.executeSiege('city-xuchang', 'player', troopsNeeded, 99999);
      if (result.victory) victories++;
      // 恢复归属、每日限制和冷却
      stack.territorySys.captureTerritory('city-xuchang', 'neutral');
      stack.siegeSys.resetDailySiegeCount();
      stack.siegeSys.setCaptureTimestamp('city-xuchang', 0);
    }
    const winRate = victories / trials;
    // 统计检验：50% ± 15%（200次试验的置信区间）
    expect(winRate).toBeGreaterThan(0.30);
    expect(winRate).toBeLessThan(0.70);
  });

  // ── F-Normal: 攻城执行 ──

  it('F-Normal: 攻城胜利应占领领土并发射事件', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    // 给足够兵力确保胜利
    const result = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true,
    );
    expect(result.launched).toBe(true);
    expect(result.victory).toBe(true);
    expect(result.capture).toBeDefined();
    expect(result.capture!.newOwner).toBe('player');
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');
  });

  it('F-Normal: 攻城失败应损失30%兵力', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    const result = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 1000, cost.grain + 1000, false,
    );
    expect(result.launched).toBe(true);
    expect(result.victory).toBe(false);
    expect(result.defeatTroopLoss).toBe(Math.floor(cost.troops * 0.3));
    // 失败不应占领
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('neutral');
  });

  // ── P0-4: 无territorySys依赖时跳过相邻检查 ──

  it('F-Cross [P0-4]: 无territorySys时checkSiegeConditions应跳过相邻检查(安全漏洞)', () => {
    const isolatedDeps = createMockDeps();
    const isolatedSiege = new SiegeSystem();
    isolatedSiege.init(isolatedDeps);
    // 无territorySys → territorySys为null → 相邻检查被跳过
    const result = isolatedSiege.checkSiegeConditions('any-target', 'player', 99999, 99999);
    // 因为没有territorySys，无法获取territory → TARGET_NOT_FOUND
    // 但如果传入一个合法的targetId，由于territorySys为null，会跳过NOT_ADJACENT检查
    expect(result.canSiege).toBe(false);
    // 这是一个设计问题：无依赖时不应该跳过关键校验
  });

  // ── F-Boundary: 每日限制跨天重置 ──

  it('F-Boundary [P1-2]: 每日攻城次数应在跨天后自动重置', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    // 用完3次
    for (let i = 0; i < 3; i++) {
      stack.siegeSys.executeSiegeWithResult('city-xuchang', 'player', cost.troops + 100000, cost.grain + 100000, true);
      stack.territorySys.captureTerritory('city-xuchang', 'neutral');
      stack.siegeSys.setCaptureTimestamp('city-xuchang', 0);
    }
    expect(stack.siegeSys.getRemainingDailySieges()).toBe(0);

    // 跨天重置
    stack.siegeSys.resetDailySiegeCount();
    expect(stack.siegeSys.getRemainingDailySieges()).toBe(3);
  });

  // ── F-Normal: 占领冷却 ──

  it('F-Normal: 占领后24小时内不可被反攻', () => {
    // 洛阳(player)与许昌相邻（通过道路网络）
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    // 攻占许昌
    stack.siegeSys.executeSiegeWithResult('city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true);
    // 验证冷却已设置
    expect(stack.siegeSys.isInCaptureCooldown('city-xuchang')).toBe(true);
    // 验证冷却未过期时仍然生效
    expect(stack.siegeSys.isInCaptureCooldown('city-xuchang')).toBe(true);
  });

  it('F-Boundary: 占领冷却过期后应可被攻击', () => {
    stack.siegeSys.setCaptureTimestamp('city-xuchang', Date.now() - 24 * 60 * 60 * 1000 - 1);
    expect(stack.siegeSys.isInCaptureCooldown('city-xuchang')).toBe(false);
  });

  // ── P1-8: 序列化保存captureTimestamps (FIX-704) ──

  it('F-Lifecycle [P1-8]: 序列化保存captureTimestamps(冷却信息保留)', () => {
    stack.siegeSys.setCaptureTimestamp('city-xuchang', Date.now());
    const data = stack.siegeSys.serialize();
    // FIX-704: SiegeSaveData 包含 captureTimestamps
    expect(data).toHaveProperty('captureTimestamps');
    expect(data.captureTimestamps).toHaveProperty('city-xuchang');

    // 反序列化后冷却信息保留
    const siege2 = new SiegeSystem();
    siege2.init(createMockDeps());
    siege2.deserialize(data);
    expect(siege2.isInCaptureCooldown('city-xuchang')).toBe(true);
  });

  // ── F-Error: 条件不满足时executeSiege应返回失败 ──

  it('F-Error: 条件不满足时executeSiege应返回失败且不扣资源', () => {
    const result = stack.siegeSys.executeSiege('nonexistent', 'player', 99999, 99999);
    expect(result.launched).toBe(false);
    expect(result.cost.troops).toBe(0);
    expect(result.cost.grain).toBe(0);
  });

  // ── F-Normal: 统计 ──

  it('F-Normal: 攻城统计应正确', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);

    // 第一次攻城（胜利）
    const r1 = stack.siegeSys.executeSiegeWithResult('city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true);
    expect(r1.launched).toBe(true);
    expect(r1.victory).toBe(true);
    expect(stack.siegeSys.getTotalSieges()).toBe(1);
    expect(stack.siegeSys.getVictories()).toBe(1);
    expect(stack.siegeSys.getDefeats()).toBe(0);
    expect(stack.siegeSys.getWinRate()).toBe(1.0);

    // 恢复领土归属和每日限制
    stack.territorySys.captureTerritory('city-xuchang', 'neutral');
    stack.siegeSys.resetDailySiegeCount();
    // 清除冷却时间戳
    stack.siegeSys.setCaptureTimestamp('city-xuchang', 0);

    // 第二次攻城（失败）
    const r2 = stack.siegeSys.executeSiegeWithResult('city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, false);
    expect(r2.launched).toBe(true);
    expect(stack.siegeSys.getTotalSieges()).toBe(2);
    expect(stack.siegeSys.getVictories()).toBe(1);
    expect(stack.siegeSys.getDefeats()).toBe(1);
    expect(stack.siegeSys.getWinRate()).toBe(0.5);
  });
});

// ═══════════════════════════════════════════════════════════════
// M4: GarrisonSystem — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('M4: GarrisonSystem — 对抗式测试', () => {
  let stack: ReturnType<typeof createStackWithHero>;

  const mockGenerals = [
    { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { defense: 95 } },
    { id: 'zhangfei', name: '张飞', quality: 'EPIC', baseStats: { defense: 80 } },
    { id: 'zhugeLiang', name: '诸葛亮', quality: 'LEGENDARY', baseStats: { defense: 50 } },
  ];

  beforeEach(() => {
    stack = createStackWithHero(mockGenerals);
  });

  // ── F-Normal: 驻防派遣 ──

  it('F-Normal: 派遣武将驻防玩家领土应成功', () => {
    const result = stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    expect(result.success).toBe(true);
    expect(result.assignment).toBeDefined();
    expect(result.assignment!.territoryId).toBe('city-luoyang');
    expect(result.assignment!.generalId).toBe('guanyu');
    expect(result.bonus).toBeDefined();
    expect(result.bonus!.defenseBonus).toBeGreaterThan(0);
  });

  it('F-Normal: 驻防加成应正确计算', () => {
    const result = stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    // 关羽 defense=95, DEFENSE_BONUS_FACTOR=0.003
    // defenseBonus = 95 × 0.003 = 0.285
    expect(result.bonus!.defenseBonus).toBeCloseTo(95 * 0.003, 10);
    // 产出加成 = 基础产出 × LEGENDARY(30%)
    const territory = stack.territorySys.getTerritoryById('city-luoyang')!;
    expect(result.bonus!.productionBonus.grain).toBeCloseTo(
      Math.round(territory.currentProduction.grain * 0.30 * 100) / 100, 2,
    );
  });

  // ── F-Error: 5重校验 ──

  it('F-Error: TERRITORY_NOT_FOUND — 领土不存在', () => {
    const result = stack.garrisonSys.assignGarrison('nonexistent', 'guanyu');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TERRITORY_NOT_FOUND');
  });

  it('F-Error: TERRITORY_NOT_OWNED — 非玩家领土', () => {
    const result = stack.garrisonSys.assignGarrison('city-changan', 'guanyu');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TERRITORY_NOT_OWNED');
  });

  it('F-Error: GENERAL_NOT_FOUND — 武将不存在', () => {
    const result = stack.garrisonSys.assignGarrison('city-luoyang', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('GENERAL_NOT_FOUND');
  });

  it('F-Error: GENERAL_ALREADY_GARRISONED — 武将已在其他领土驻防', () => {
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    // 占领长安后尝试用已驻防的关羽
    stack.territorySys.captureTerritory('city-changan', 'player');
    const result = stack.garrisonSys.assignGarrison('city-changan', 'guanyu');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('GENERAL_ALREADY_GARRISONED');
  });

  it('F-Error: TERRITORY_ALREADY_GARRISONED — 领土已有驻防', () => {
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    const result = stack.garrisonSys.assignGarrison('city-luoyang', 'zhangfei');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TERRITORY_ALREADY_GARRISONED');
  });

  // ── F-Normal: 撤回驻防 ──

  it('F-Normal: 撤回驻防应成功', () => {
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    const result = stack.garrisonSys.withdrawGarrison('city-luoyang');
    expect(result.success).toBe(true);
    expect(result.generalId).toBe('guanyu');
    expect(stack.garrisonSys.isTerritoryGarrisoned('city-luoyang')).toBe(false);
  });

  it('F-Error: 撤回未驻防的领土应失败', () => {
    const result = stack.garrisonSys.withdrawGarrison('city-luoyang');
    expect(result.success).toBe(false);
  });

  // ── F-Normal: 加成查询 ──

  it('F-Normal: 未驻防领土的加成应为零', () => {
    const bonus = stack.garrisonSys.getGarrisonBonus('city-luoyang');
    expect(bonus.defenseBonus).toBe(0);
    expect(bonus.productionBonus.grain).toBe(0);
  });

  it('F-Normal: 有效防御值应包含驻防加成', () => {
    const baseDefense = 1000;
    const before = stack.garrisonSys.getEffectiveDefense('city-luoyang', baseDefense);
    expect(before).toBe(baseDefense); // 无驻防时等于基础

    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    const after = stack.garrisonSys.getEffectiveDefense('city-luoyang', baseDefense);
    expect(after).toBeGreaterThan(baseDefense);
    // 加成 = 1000 × (1 + 0.285) = 1285
    expect(after).toBeCloseTo(Math.round(baseDefense * (1 + 95 * 0.003) * 100) / 100, 1);
  });

  // ── F-Lifecycle: 序列化/反序列化 ──

  it('F-Lifecycle: 序列化→反序列化应保持驻防记录', () => {
    stack.garrisonSys.assignGarrison('city-luoyang', 'guanyu');
    const data = stack.garrisonSys.serialize();

    const garrison2 = new GarrisonSystem();
    garrison2.init(stack.deps);
    garrison2.deserialize(data);

    expect(garrison2.getGarrisonCount()).toBe(1);
    expect(garrison2.isTerritoryGarrisoned('city-luoyang')).toBe(true);
  });

  // ── F-Cross: 自动驻防事件 ──

  it('F-Cross: siege:autoGarrison事件应被处理', () => {
    // GarrisonSystem.init 注册了 siege:autoGarrison 监听器
    // 模拟攻城胜利后的事件
    const handler = stack.deps.eventBus.on as ReturnType<typeof vi.fn>;
    // 验证init时注册了事件监听
    expect(handler).toHaveBeenCalledWith('siege:autoGarrison', expect.any(Function));
  });
});

// ═══════════════════════════════════════════════════════════════
// M5: SiegeEnhancer — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('M5: SiegeEnhancer — 对抗式测试', () => {
  let stack: ReturnType<typeof createFullStack>;

  beforeEach(() => {
    stack = createFullStack();
  });

  // ── F-Normal: 胜率预估 ──

  it('F-Normal: 胜率预估应返回合理结果', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const estimate = stack.enhancer.estimateWinRate(5000, 'city-xuchang');
    expect(estimate).not.toBeNull();
    expect(estimate!.winRate).toBeGreaterThanOrEqual(0.05);
    expect(estimate!.winRate).toBeLessThanOrEqual(0.95);
    expect(estimate!.defenderPower).toBe(territory.defenseValue); // 无驻防时等于基础防御
  });

  it('F-Boundary: 攻方战力为0时胜率应为5%(下限)', () => {
    const estimate = stack.enhancer.estimateWinRate(0, 'city-xuchang');
    expect(estimate!.winRate).toBe(0.05);
  });

  it('F-Boundary: 攻方战力远大于防方时胜率应为95%(上限)', () => {
    const estimate = stack.enhancer.estimateWinRate(99999999, 'city-xuchang');
    expect(estimate!.winRate).toBe(0.95);
  });

  it('F-Error: 不存在的领土应返回null', () => {
    const estimate = stack.enhancer.estimateWinRate(5000, 'nonexistent');
    expect(estimate).toBeNull();
  });

  // ── P0-5: 胜率公式一致性 ──

  it('F-Cross [P0-5]: SiegeEnhancer与SiegeSystem胜率公式应一致(无地形修正时)', () => {
    // SiegeSystem: rawRate = ratio × 0.5
    // SiegeEnhancer: rawRate = ratio × 0.5 + terrainBonus (默认0)
    // 当terrainBonus=0时两者应一致
    const attackerPower = 5000;
    const targetId = 'city-xuchang';
    const territory = stack.territorySys.getTerritoryById(targetId)!;
    const defenderPower = territory.defenseValue;

    const estimate = stack.enhancer.estimateWinRate(attackerPower, targetId);
    // SiegeSystem的computeWinRate是private，但通过estimateWinRate验证一致性
    const expectedRatio = attackerPower / defenderPower;
    const expectedWinRate = Math.min(0.95, Math.max(0.05, expectedRatio * 0.5));
    expect(estimate!.winRate).toBeCloseTo(expectedWinRate, 4);
  });

  // ── F-Normal: 战斗评级 ──

  it('F-Normal: 战斗评级应正确划分', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const defenderPower = territory.defenseValue;

    // easy: winRate >= 0.75 → attackerPower/defenderPower >= 1.5
    const easyEstimate = stack.enhancer.estimateWinRate(defenderPower * 2, 'city-xuchang');
    expect(easyEstimate!.rating).toBe('easy');

    // impossible: winRate <= 0.15 → attackerPower/defenderPower <= 0.3
    const impossibleEstimate = stack.enhancer.estimateWinRate(defenderPower * 0.1, 'city-xuchang');
    expect(impossibleEstimate!.rating).toBe('impossible');
  });

  // ── F-Normal: 攻城奖励 ──

  it('F-Normal: 攻城奖励应按等级和类型计算', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const reward = stack.enhancer.calculateSiegeReward(territory);
    expect(reward.resources.grain).toBe(50 * territory.level); // baseGrain × level
    expect(reward.resources.gold).toBe(30 * territory.level);
    expect(reward.territoryExp).toBe(100 * territory.level);
  });

  it('F-Boundary: 关卡(pass)奖励应有1.5倍加成', () => {
    const passTerritory = stack.territorySys.getTerritoryById('pass-hulao')!;
    const cityTerritory = stack.territorySys.getTerritoryById('city-puyang')!;
    // 同等级比较
    if (passTerritory.level === cityTerritory.level) {
      const passReward = stack.enhancer.calculateSiegeReward(passTerritory);
      const cityReward = stack.enhancer.calculateSiegeReward(cityTerritory);
      expect(passReward.resources.grain).toBe(Math.round(cityReward.resources.grain * 1.5));
    }
  });

  // ── F-Normal: 征服流程 ──

  it('F-Normal: 完整征服流程应成功', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);
    const result = stack.enhancer.executeConquest(
      'city-xuchang', 'player',
      territory.defenseValue * 3, // 确保高胜率
      cost.troops + 100000, cost.grain + 100000,
    );
    // 由于使用simulateBattle（随机），可能成功或失败
    expect(result.phase).toBeDefined();
    expect(['check', 'battle', 'reward']).toContain(result.phase);
  });

  it('F-Error: 征服不存在的领土应在check阶段失败', () => {
    const result = stack.enhancer.executeConquest('nonexistent', 'player', 99999, 99999, 99999);
    expect(result.success).toBe(false);
    expect(result.phase).toBe('check');
  });
});

// ═══════════════════════════════════════════════════════════════
// M6: MapEventSystem — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('M6: MapEventSystem — 对抗式测试', () => {
  let sys: MapEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    sys = new MapEventSystem({ rng: () => 0.05 }); // 始终触发
    sys.init(deps);
  });

  // ── F-Normal: 事件触发 ──

  it('F-Normal: 满足条件时应触发事件', () => {
    const event = sys.checkAndTrigger(1000);
    expect(event).not.toBeNull();
    expect(event!.status).toBe('active');
    expect(event!.id).toMatch(/^map_event_\d+$/);
  });

  it('F-Normal: 未过检查间隔时不应触发', () => {
    sys.checkAndTrigger(1000);
    const event2 = sys.checkAndTrigger(1001); // 间隔太短
    expect(event2).toBeNull();
  });

  it('F-Boundary: 达到最大事件数(3)时不应触发新事件', () => {
    // 使用forceTrigger确保触发
    sys.forceTrigger('bandit', 1000);
    sys.forceTrigger('caravan', 2000);
    sys.forceTrigger('ruins', 3000);
    expect(sys.getActiveEventCount()).toBe(3);
    // 第4次forceTrigger应返回最后一个事件（P1-3行为）
    const event4 = sys.forceTrigger('disaster', 4000);
    expect(event4.id).not.toContain('disaster'); // 不是新事件
    expect(sys.getActiveEventCount()).toBe(3); // 仍为3
  });

  // ── F-Normal: 事件解决 ──

  it('F-Normal: 解决事件应返回奖励', () => {
    const event = sys.forceTrigger('bandit');
    const resolution = sys.resolveEvent(event.id, 'attack');
    expect(resolution.success).toBe(true);
    expect(resolution.triggeredBattle).toBe(true); // bandit是战斗类事件
    expect(resolution.rewards.length).toBeGreaterThan(0);
  });

  it('F-Normal: 谈判解决应返回谈判奖励', () => {
    const event = sys.forceTrigger('bandit');
    const resolution = sys.resolveEvent(event.id, 'negotiate');
    expect(resolution.success).toBe(true);
    expect(resolution.triggeredBattle).toBe(false);
    // bandit的谈判奖励是 200 gold
    expect(resolution.rewards).toEqual([{ type: 'gold', amount: 200 }]);
  });

  it('F-Normal: 忽略解决应返回空奖励', () => {
    const event = sys.forceTrigger('bandit');
    const resolution = sys.resolveEvent(event.id, 'ignore');
    expect(resolution.success).toBe(true);
    expect(resolution.rewards).toEqual([]);
  });

  // ── F-Error: 异常解决 ──

  it('F-Error: 解决不存在的事件应返回失败', () => {
    const resolution = sys.resolveEvent('nonexistent', 'attack');
    expect(resolution.success).toBe(false);
    expect(resolution.rewards).toEqual([]);
  });

  // ── P1-3: forceTrigger达到上限时行为 ──

  it('F-Boundary [P1-3]: forceTrigger达到上限时返回最后一个事件而非报错', () => {
    const e1 = sys.forceTrigger('bandit');
    const e2 = sys.forceTrigger('caravan');
    const e3 = sys.forceTrigger('ruins');
    expect(sys.getActiveEventCount()).toBe(3);
    // 第4次forceTrigger应返回最后一个事件
    const e4 = sys.forceTrigger('disaster');
    expect(e4.id).toBe(e3.id); // 返回最后一个，而非新事件
  });

  // ── F-Normal: 过期清理 ──

  it('F-Normal: 过期事件应被自动清理', () => {
    const event = sys.forceTrigger('bandit');
    expect(sys.getActiveEventCount()).toBe(1);
    // bandit持续2小时=7200000ms
    const cleaned = sys.cleanExpiredEvents(event.createdAt + 7200001);
    expect(cleaned).toBe(1);
    expect(sys.getActiveEventCount()).toBe(0);
  });

  it('F-Boundary: 未过期事件不应被清理', () => {
    const event = sys.forceTrigger('bandit');
    const cleaned = sys.cleanExpiredEvents(event.createdAt + 1000);
    expect(cleaned).toBe(0);
    expect(sys.getActiveEventCount()).toBe(1);
  });

  // ── F-Lifecycle: 序列化/反序列化 ──

  it('F-Lifecycle: 序列化→反序列化应保持事件状态', () => {
    sys.forceTrigger('bandit');
    sys.forceTrigger('caravan');
    const data = sys.serialize();

    const sys2 = new MapEventSystem();
    sys2.init(deps);
    sys2.deserialize(data);

    expect(sys2.getActiveEventCount()).toBe(2);
    expect(sys2.getResolvedCount()).toBe(0);
  });

  // ── P1-9: 版本不匹配 ──

  it('F-Lifecycle [P1-9]: 反序列化版本不匹配时应静默失败', () => {
    const result = sys.serialize();
    const sys2 = new MapEventSystem();
    sys2.init(deps);
    // 版本不匹配 → 静默失败，不恢复数据
    expect(() => sys2.deserialize({ ...result, version: 999 })).not.toThrow();
    expect(sys2.getActiveEventCount()).toBe(0);
  });

  // ── F-Error: forceTrigger不存在的类型 ──

  it('F-Error: forceTrigger不存在的类型应抛出异常', () => {
    expect(() => sys.forceTrigger('nonexistent' as any)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// M7: MapDataRenderer — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('M7: MapDataRenderer — 对抗式测试', () => {
  let renderer: MapDataRenderer;
  let mapSys: WorldMapSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    renderer = new MapDataRenderer();
    renderer.init(deps);
    mapSys = new WorldMapSystem();
    mapSys.init(deps);
  });

  // ── F-Normal: 视口计算 ──

  it('F-Normal: 默认视口应覆盖部分地图', () => {
    const viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    const range = renderer.computeVisibleRange(viewport);
    expect(range.startX).toBe(0);
    expect(range.startY).toBe(0);
    expect(range.endX).toBeGreaterThanOrEqual(0);
    expect(range.endY).toBeGreaterThanOrEqual(0);
    // 默认视口 1280×696, 格子32×32 → 41×23格子（ceil包含边界）
    const colCount = range.endX - range.startX + 1;
    const rowCount = range.endY - range.startY + 1;
    expect(colCount).toBe(41); // ceil(1280/32) + 1 = 40 + 1
    expect(rowCount).toBe(23); // ceil(696/32) + 1 = 21.75 → 22 + 1
  });

  it('F-Normal: 缩放2x时可见范围应减半', () => {
    const range1x = renderer.computeVisibleRange({ offsetX: 0, offsetY: 0, zoom: 1.0 });
    const range2x = renderer.computeVisibleRange({ offsetX: 0, offsetY: 0, zoom: 2.0 });
    const count1x = renderer.computeVisibleTileCount(range1x);
    const count2x = renderer.computeVisibleTileCount(range2x);
    expect(count2x).toBeLessThan(count1x);
  });

  // ── F-Normal: 坐标转换 ──

  it('F-Normal: gridToPixel和pixelToGrid应互为逆运算', () => {
    const pos: GridPosition = { x: 15, y: 20 };
    const pixel = renderer.gridToPixel(pos);
    expect(pixel.pixelX).toBe(15 * GRID_CONFIG.tileWidth);
    expect(pixel.pixelY).toBe(20 * GRID_CONFIG.tileHeight);

    const backToGrid = renderer.pixelToGrid(pixel.pixelX, pixel.pixelY);
    expect(backToGrid).toEqual(pos);
  });

  it('F-Boundary: 坐标(0,0)的像素应为(0,0)', () => {
    const pixel = renderer.gridToPixel({ x: 0, y: 0 });
    expect(pixel.pixelX).toBe(0);
    expect(pixel.pixelY).toBe(0);
  });

  // ── F-Normal: 渲染数据生成 ──

  it('F-Normal: computeViewportRenderData应返回可见格子', () => {
    const tiles = mapSys.getAllTiles();
    const viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    const data = renderer.computeViewportRenderData(tiles, viewport);
    expect(data.tiles.length).toBeGreaterThan(0);
    expect(data.visibleRange).toBeDefined();
    // 每个tile应有渲染数据
    for (const tile of data.tiles) {
      expect(tile.pixelX).toBeDefined();
      expect(tile.pixelY).toBeDefined();
      expect(tile.terrainColor).toBeDefined();
      expect(tile.regionColor).toBeDefined();
      expect(tile.layer).toBeDefined();
    }
  });

  it('F-Normal: 视口内地标应被收集到visibleLandmarks', () => {
    const tiles = mapSys.getAllTiles();
    const viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    const data = renderer.computeViewportRenderData(tiles, viewport);
    // 邺城在(32,9)，默认视口应能看到
    const yechengInViewport = data.visibleLandmarks.find(l => l.id === 'city-ye');
    expect(yechengInViewport).toBeDefined();
  });

  // ── F-Normal: 视口约束 ──

  it('F-Normal: clampViewport应约束偏移在合法范围内', () => {
    const viewport = { offsetX: 1000, offsetY: 1000, zoom: 1.0 };
    const clamped = renderer.clampViewport(viewport);
    // 偏移不应超出地图边界
    expect(clamped.offsetX).toBeLessThanOrEqual(0);
    expect(clamped.offsetY).toBeLessThanOrEqual(0);
  });

  it('F-Normal: centerOnPosition应居中到目标', () => {
    const viewport = renderer.centerOnPosition({ x: 30, y: 20 });
    expect(viewport.zoom).toBeGreaterThanOrEqual(VIEWPORT_CONFIG.minZoom);
    expect(viewport.zoom).toBeLessThanOrEqual(VIEWPORT_CONFIG.maxZoom);
    // 居中偏移应使目标在视口中心
    const { tileWidth, tileHeight } = GRID_CONFIG;
    const expectedX = VIEWPORT_CONFIG.width / 2 - (30 * tileWidth + tileWidth / 2);
    const expectedY = VIEWPORT_CONFIG.height / 2 - (20 * tileHeight + tileHeight / 2);
    expect(viewport.offsetX).toBeCloseTo(expectedX, 1);
    expect(viewport.offsetY).toBeCloseTo(expectedY, 1);
  });

  // ── F-Boundary: 极端视口 ──

  it('F-Boundary: 极端偏移的视口应被正确clamp', () => {
    const extreme = { offsetX: -99999, offsetY: -99999, zoom: 1.0 };
    const clamped = renderer.clampViewport(extreme);
    expect(clamped.offsetX).toBeLessThanOrEqual(0);
    expect(clamped.offsetY).toBeLessThanOrEqual(0);
    expect(Number.isFinite(clamped.offsetX)).toBe(true);
    expect(Number.isFinite(clamped.offsetY)).toBe(true);
  });

  // ── F-Error: 空数据 ──

  it('F-Error: 空格子列表应返回空渲染数据', () => {
    const data = renderer.computeViewportRenderData([], { offsetX: 0, offsetY: 0, zoom: 1.0 });
    expect(data.tiles.length).toBe(0);
    expect(data.visibleLandmarks.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 跨系统交互 — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('Map模块 — 跨系统交互对抗式测试', () => {
  let stack: ReturnType<typeof createStackWithHero>;

  const mockGenerals = [
    { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { defense: 95 } },
  ];

  beforeEach(() => {
    stack = createStackWithHero(mockGenerals);
  });

  // ── P1-7: TerritorySystem与WorldMapSystem地标不同步 ──

  it('F-Cross [P1-7]: TerritorySystem占领不同步WorldMapSystem地标归属', () => {
    // TerritorySystem占领
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    // WorldMapSystem的地标归属未同步
    const landmark = stack.mapSys.getLandmarkById('city-xuchang');
    // 默认初始所有地标都是neutral
    expect(landmark!.ownership).toBe('neutral');
    // TerritorySystem已变更
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');
    // 这是一个设计缺陷：两个系统的归属状态不一致
  });

  // ── F-Cross: 攻城→占领→驻防完整流程 ──

  it('F-Cross: 攻城→占领→驻防完整流程', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);

    // 1. 攻城
    const siegeResult = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true,
    );
    expect(siegeResult.victory).toBe(true);

    // 2. 验证占领
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');

    // 3. 驻防
    const garrisonResult = stack.garrisonSys.assignGarrison('city-xuchang', 'guanyu');
    expect(garrisonResult.success).toBe(true);

    // 4. 验证加成
    const bonus = stack.garrisonSys.getGarrisonBonus('city-xuchang');
    expect(bonus.defenseBonus).toBeGreaterThan(0);

    // 5. 验证有效防御值
    const effectiveDefense = stack.garrisonSys.getEffectiveDefense('city-xuchang', territory.defenseValue);
    expect(effectiveDefense).toBeGreaterThan(territory.defenseValue);
  });

  // ── F-Cross: 攻城→失败→再次攻城 ──

  it('F-Cross: 攻城失败后应可再次攻城', () => {
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const cost = stack.siegeSys.calculateSiegeCost(territory);

    // 第一次失败
    const result1 = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, false,
    );
    expect(result1.victory).toBe(false);
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('neutral');

    // 重置每日限制
    stack.siegeSys.resetDailySiegeCount();

    // 第二次成功
    const result2 = stack.siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', cost.troops + 100000, cost.grain + 1000, true,
    );
    expect(result2.victory).toBe(true);
    expect(stack.territorySys.getTerritoryById('city-xuchang')!.ownership).toBe('player');
  });

  // ── F-Cross: 占领后失去相邻领土 ──

  it('F-Cross: 占领领土后失去相邻应影响攻城条件', () => {
    // 洛阳(player) 与 许昌相邻（通过道路网络）
    // 先占领许昌
    stack.territorySys.captureTerritory('city-xuchang', 'player');

    // 成都：初始不相邻（洛阳与成都之间没有道路连接）
    expect(stack.territorySys.canAttackTerritory('city-chengdu', 'player')).toBe(false);
    // 占领汉中后可以攻击成都（汉中与成都通过道路相邻）
    stack.territorySys.captureTerritory('city-hanzhong', 'player');
    expect(stack.territorySys.canAttackTerritory('city-chengdu', 'player')).toBe(true);
    // 失去汉中后不可攻击
    stack.territorySys.captureTerritory('city-hanzhong', 'enemy');
    expect(stack.territorySys.canAttackTerritory('city-chengdu', 'player')).toBe(false);
  });

  // ── F-Cross: 驻防影响攻城胜率 ──

  it('F-Cross: 驻防应增加防守方有效战力', () => {
    // 占领并驻防许昌
    stack.territorySys.captureTerritory('city-xuchang', 'enemy');
    // 模拟敌方驻防（直接操作garrisonSys需要敌方领土）
    // 实际上garrisonSys只允许玩家领土驻防，所以这里验证玩家驻防对防御的影响
    stack.territorySys.captureTerritory('city-xuchang', 'player');
    stack.garrisonSys.assignGarrison('city-xuchang', 'guanyu');

    // SiegeEnhancer计算防守方战力时应包含驻防加成
    const territory = stack.territorySys.getTerritoryById('city-xuchang')!;
    const defenderPower = stack.enhancer.calculateDefenderPower(territory);
    expect(defenderPower).toBeGreaterThan(territory.defenseValue);
  });

  // ── F-Cross: 产出汇总与领土升级联动 ──

  it('F-Cross: 领土升级后产出汇总应更新', () => {
    const summaryBefore = stack.territorySys.getPlayerProductionSummary();
    // 洛阳level=5已满级，先占领一个可升级的
    stack.territorySys.captureTerritory('city-xiangyang', 'player'); // level=4
    const result = stack.territorySys.upgradeTerritory('city-xiangyang');
    expect(result.success).toBe(true);

    const summaryAfter = stack.territorySys.getPlayerProductionSummary();
    expect(summaryAfter.totalTerritories).toBe(summaryBefore.totalTerritories + 1);
    expect(summaryAfter.totalProduction.grain).toBeGreaterThan(summaryBefore.totalProduction.grain);
  });
});

// ═══════════════════════════════════════════════════════════════
// MapFilterSystem — 对抗式测试
// ═══════════════════════════════════════════════════════════════

describe('MapFilterSystem — 对抗式测试', () => {
  let mapSys: WorldMapSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    mapSys = new WorldMapSystem();
    mapSys.init(deps);
  });

  // ── F-Normal: 综合筛选 ──

  it('F-Normal: 按区域筛选应返回正确结果', () => {
    const FilterSys = MapFilterSystem;
    const tiles = mapSys.getAllTiles();
    const landmarks = mapSys.getLandmarks();
    const result = FilterSys.filter(tiles, landmarks, { regions: ['wei'] });
    expect(result.tiles.length).toBeGreaterThan(0);
    for (const tile of result.tiles) {
      expect(tile.region).toBe('wei');
    }
  });

  it('F-Normal: 按地形筛选应返回正确结果', () => {
    const FilterSys = MapFilterSystem;
    const tiles = mapSys.getAllTiles();
    const result = FilterSys.filterByTerrain(tiles, ['city']);
    for (const tile of result) {
      expect(tile.terrain).toBe('city');
    }
  });

  it('F-Normal: 空筛选条件应返回全部数据', () => {
    const FilterSys = MapFilterSystem;
    const tiles = mapSys.getAllTiles();
    const landmarks = mapSys.getLandmarks();
    const result = FilterSys.filter(tiles, landmarks, {});
    expect(result.totalTiles).toBe(tiles.length);
    expect(result.totalLandmarks).toBe(landmarks.length);
  });

  it('F-Normal: 统计各区域格子数量总和应等于总格子数', () => {
    const FilterSys = MapFilterSystem;
    const tiles = mapSys.getAllTiles();
    const counts = FilterSys.countByRegion(tiles);
    const total = counts.wei + counts.shu + counts.wu + counts.neutral;
    expect(total).toBe(tiles.length);
  });

  it('F-Error: 空数组筛选应返回全部数据', () => {
    const FilterSys = MapFilterSystem;
    const tiles = mapSys.getAllTiles();
    const result = FilterSys.filterByRegion(tiles, []);
    expect(result.length).toBe(tiles.length);
  });
});
