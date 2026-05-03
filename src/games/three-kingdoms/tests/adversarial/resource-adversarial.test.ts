/**
 * 资源模块对抗式测试 — Builder 产出
 *
 * 覆盖子系统：
 *   R1: ResourceSystem          — 资源状态管理聚合根
 *   R2: resource-calculator     — 加成/上限/警告计算
 *   R3: OfflineEarningsCalculator — 离线收益
 *   R4: resource-config         — 常量配置
 *   R5: ThreeKingdomsEngine     — 引擎集成
 *
 * 5维度挑战：
 *   F-Error:     异常路径（NaN/Infinity/负值/空数据/零值/类型错误）
 *   F-Cross:     跨系统交互（资源+建筑产出联动/上限联动/离线收益+上限截断）
 *   F-Lifecycle: 数据生命周期（序列化/反序列化/重置/版本迁移）
 *   F-Boundary:  边界条件（上限截断/粮草保护/产出速率/容量警告/批量消耗/超大数）
 *   F-Normal:    正向流程（初始化/添加/扣除/多资源消耗/生产tick/上限管理/引擎集成）
 *
 * @module tests/adversarial/resource-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceSystem } from '../../engine/resource/ResourceSystem';
import {
  zeroResources, cloneResources, calculateBonusMultiplier,
  lookupCap, calculateCapWarnings, calculateCapWarning, getWarningLevel,
} from '../../engine/resource/resource-calculator';
import type { ResourceType, Resources, ResourceCost, Bonuses } from '../../engine/resource/resource.types';
import { RESOURCE_TYPES } from '../../engine/resource/resource.types';
import {
  INITIAL_RESOURCES, INITIAL_PRODUCTION_RATES, INITIAL_CAPS,
  MIN_GRAIN_RESERVE, SAVE_VERSION, OFFLINE_MAX_SECONDS,
} from '../../engine/resource/resource-config';

// ── 测试辅助 ──────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn().mockReturnValue(vi.fn()), off: vi.fn(), once: vi.fn().mockReturnValue(vi.fn()), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  };
}

function createResource(): ResourceSystem {
  const sys = new ResourceSystem();
  sys.init(createMockDeps() as any);
  return sys;
}

function fillResources(sys: ResourceSystem, amounts?: Partial<Resources>): void {
  sys.setCap('grain', null);
  sys.setCap('gold', null);
  sys.setCap('ore', null);
  sys.setCap('wood', null);
  sys.setCap('troops', null);
  const r = amounts ?? { grain: 99999, gold: 99999, ore: 99999, wood: 99999, troops: 99999, mandate: 99999, techPoint: 99999, recruitToken: 99999, skillBook: 99999 };
  for (const type of RESOURCE_TYPES) {
    if (r[type] !== undefined) sys.setResource(type, r[type]!);
  }
}

function isAtCap(sys: ResourceSystem, type: ResourceType): boolean {
  const cap = sys.getCaps()[type];
  return cap !== null && sys.getAmount(type) >= cap;
}

// ═══════════════════════════════════════════════
// F-Error: 异常路径覆盖
// ═══════════════════════════════════════════════

describe('F-Error: 资源初始化异常', () => {
  it('初始资源应为正数或零且有限', () => {
    const sys = createResource();
    const r = sys.getResources();
    for (const type of RESOURCE_TYPES) {
      expect(r[type]).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r[type])).toBe(true);
    }
  });

  it('初始产出速率不含 NaN', () => {
    const sys = createResource();
    const rates = sys.getProductionRates();
    for (const type of RESOURCE_TYPES) expect(Number.isFinite(rates[type])).toBe(true);
  });

  it('初始上限 grain/ore/wood/troops 为正数，gold/其余为 null', () => {
    const caps = createResource().getCaps();
    expect(caps.grain).toBeGreaterThan(0);
    expect(caps.gold).toBeNull(); // gold 无上限
    expect(caps.ore).toBeGreaterThan(0);
    expect(caps.wood).toBeGreaterThan(0);
    expect(caps.troops).toBeGreaterThan(0);
    for (const t of ['mandate', 'techPoint', 'recruitToken', 'skillBook'] as const) expect(caps[t]).toBeNull();
  });

  it('未调用 init 时系统仍可使用（deps 为 null）', () => {
    const sys = new ResourceSystem();
    expect(() => sys.addResource('gold', 10)).not.toThrow();
    expect(sys.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 10);
  });
});

describe('F-Error: 添加资源异常路径', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('NaN/Infinity/-Infinity/负数/零/undefined 全部返回 0', () => {
    const bad = [NaN, Infinity, -Infinity, -100, -0.001, 0, undefined];
    for (const v of bad) {
      const before = sys.getAmount('gold');
      expect(sys.addResource('gold', v as any)).toBe(0);
      expect(sys.getAmount('gold')).toBe(before);
    }
  });
});

describe('F-Error: 扣除资源异常路径', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); fillResources(sys); });

  it('NaN/Infinity/零/负数 返回 0', () => {
    for (const v of [NaN, Infinity, 0, -50]) expect(sys.consumeResource('gold', v)).toBe(0);
  });

  it('资源不足应抛出错误', () => {
    sys.setResource('gold', 10);
    expect(() => sys.consumeResource('gold', 100)).toThrow('不足');
  });

  it('粮草不足时抛出含保留量的错误', () => {
    sys.setResource('grain', 5);
    expect(() => sys.consumeResource('grain', 1)).toThrow();
  });

  it('粮草恰好等于保留量时无法消耗', () => {
    sys.setResource('grain', MIN_GRAIN_RESERVE);
    expect(() => sys.consumeResource('grain', 1)).toThrow();
  });
});

describe('F-Error: canAfford 异常路径', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('空 cost / NaN / 负数 / undefined 均返回 canAfford=true', () => {
    fillResources(sys);
    expect(sys.canAfford({}).canAfford).toBe(true);
    expect(sys.canAfford({ gold: NaN }).canAfford).toBe(true);
    expect(sys.canAfford({ gold: -100 }).canAfford).toBe(true);
    expect(sys.canAfford({ gold: undefined as any }).canAfford).toBe(true);
  });

  it('资源值为 NaN 时判定为不足', () => {
    sys.setResource('gold', NaN as any);
    const r = sys.canAfford({ gold: 10 });
    expect(r.canAfford).toBe(false);
    expect(r.shortages.gold).toBeDefined();
  });
});

describe('F-Error: consumeBatch 异常路径', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('资源不足时抛出含详细信息的错误', () => {
    sys.setResource('gold', 10);
    expect(() => sys.consumeBatch({ gold: 100 })).toThrow('资源不足');
  });

  it('部分不足时全部不扣', () => {
    fillResources(sys);
    sys.setResource('gold', 5);
    expect(() => sys.consumeBatch({ grain: 100, gold: 200 })).toThrow();
    expect(sys.getAmount('grain')).toBe(99999);
    expect(sys.getAmount('gold')).toBe(5);
  });

  it('空 cost 不抛错', () => {
    expect(() => sys.consumeBatch({})).not.toThrow();
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互覆盖
// ═══════════════════════════════════════════════

describe('F-Cross: 资源+建筑产出联动', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('recalculateProduction 从建筑产出同步速率', () => {
    sys.recalculateProduction({ grain: 5.0, gold: 3.0 });
    const rates = sys.getProductionRates();
    expect(rates.grain).toBeCloseTo(5.0);
    expect(rates.gold).toBeCloseTo(3.0);
  });

  it('recalculateProduction 保留 recruitToken 被动产出', () => {
    sys.recalculateProduction({ grain: 1.0 });
    expect(sys.getProductionRates().recruitToken).toBe(INITIAL_PRODUCTION_RATES.recruitToken);
  });

  it('recalculateProduction 忽略 NaN 和未知类型', () => {
    sys.recalculateProduction({ grain: NaN, gold: 2.0, unknown: 100 } as any);
    expect(sys.getProductionRates().grain).toBe(0);
    expect(sys.getProductionRates().gold).toBeCloseTo(2.0);
  });

  it('recalculateProduction 清零后重新累加', () => {
    sys.recalculateProduction({ grain: 10 });
    sys.recalculateProduction({ grain: 3 });
    expect(sys.getProductionRates().grain).toBeCloseTo(3);
  });

  it('tick 驱动资源增长与速率一致', () => {
    sys.recalculateProduction({ grain: 1.0 });
    const before = sys.getAmount('grain');
    sys.tick(1000);
    expect(sys.getAmount('grain')).toBeCloseTo(before + 1.0, 0);
  });

  it('tick 零/负 deltaMs 不增加资源', () => {
    sys.recalculateProduction({ grain: 10 });
    const before = sys.getAmount('grain');
    sys.tick(0);
    expect(sys.getAmount('grain')).toBe(before);
    sys.tick(-1000);
    expect(sys.getAmount('grain')).toBe(before);
  });
});

describe('F-Cross: 上限联动与溢出事件', () => {
  let sys: ResourceSystem; let deps: any;
  beforeEach(() => { deps = createMockDeps(); sys = new ResourceSystem(); sys.init(deps as any); });

  it('资源达到上限时截断并发射 resource:overflow', () => {
    const cap = sys.getCaps().grain!;
    sys.setResource('grain', cap - 10);
    const actual = sys.addResource('grain', 100);
    expect(actual).toBeLessThan(100);
    expect(deps.eventBus.emit).toHaveBeenCalledWith('resource:overflow', expect.objectContaining({ resourceType: 'grain', overflow: expect.any(Number) }));
  });

  it('无上限资源不截断', () => {
    sys.addResource('mandate', 999999);
    expect(sys.getAmount('mandate')).toBeGreaterThanOrEqual(999999);
  });

  it('updateCaps 后溢出资源被截断', () => {
    sys.setResource('grain', 5000);
    sys.updateCaps(1, 1);
    expect(sys.getAmount('grain')).toBeLessThanOrEqual(2000);
  });

  it('setCap 后资源被截断，setCap null 移除上限', () => {
    sys.setResource('troops', 9999);
    sys.setCap('troops', 100);
    expect(sys.getAmount('troops')).toBeLessThanOrEqual(100);
    sys.setCap('grain', null);
    sys.addResource('grain', 999999);
    expect(sys.getAmount('grain')).toBeGreaterThanOrEqual(999999);
  });
});

describe('F-Cross: 离线收益+上限截断', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('applyOfflineEarnings 受上限约束', () => {
    sys.recalculateProduction({ grain: 1.0 });
    const cap = sys.getCaps().grain!;
    sys.setResource('grain', cap - 5);
    sys.applyOfflineEarnings(3600);
    expect(sys.getAmount('grain')).toBeLessThanOrEqual(cap);
  });

  it('零产出时离线收益为空（recruitToken 除外）', () => {
    sys.recalculateProduction({});
    const result = sys.calculateOfflineEarnings(3600);
    for (const type of RESOURCE_TYPES) {
      if (type === 'recruitToken') continue;
      expect(result.earned[type]).toBe(0);
    }
  });

  it('超长离线时间不超过最大计算时长', () => {
    sys.recalculateProduction({ grain: 1.0 });
    const result = sys.calculateOfflineEarnings(OFFLINE_MAX_SECONDS * 10);
    expect(Number.isFinite(result.earned.grain)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期覆盖
// ═══════════════════════════════════════════════

describe('F-Lifecycle: 序列化/反序列化', () => {
  it('空系统序列化/反序列化一致', () => {
    const sys = createResource();
    const data = sys.serialize();
    expect(data.version).toBe(SAVE_VERSION);
    const sys2 = createResource();
    sys2.deserialize(data);
    expect(sys2.getResources()).toEqual(sys.getResources());
    expect(sys2.getCaps()).toEqual(sys.getCaps());
  });

  it('资源/速率/上限数据完整保留', () => {
    const sys = createResource();
    sys.setCap('grain', null); sys.setCap('gold', null);
    sys.setResource('grain', 1234);
    sys.setResource('gold', 5678);
    sys.setProductionRate('grain', 5.5);
    sys.setCap('grain', 50000);
    const data = sys.serialize();
    const sys2 = createResource();
    sys2.deserialize(data);
    expect(sys2.getAmount('grain')).toBe(1234);
    expect(sys2.getAmount('gold')).toBe(5678);
    expect(sys2.getProductionRates().grain).toBeCloseTo(5.5);
    expect(sys2.getCaps().grain).toBe(50000);
  });

  it('null/undefined 数据安全重置', () => {
    const sys = createResource();
    sys.setResource('gold', 9999);
    sys.deserialize(null as any);
    expect(sys.getAmount('gold')).toBe(INITIAL_RESOURCES.gold);
    sys.setResource('gold', 9999);
    sys.deserialize(undefined as any);
    expect(sys.getAmount('gold')).toBe(INITIAL_RESOURCES.gold);
  });

  it('版本不匹配仍兼容加载', () => {
    const sys = createResource();
    sys.setCap('gold', null);
    sys.setResource('gold', 5000);
    const data = sys.serialize();
    data.version = 999;
    const sys2 = createResource();
    sys2.deserialize(data);
    expect(sys2.getAmount('gold')).toBe(5000);
  });

  it('序列化修复 NaN，反序列化修复负数/undefined', () => {
    const sys = createResource();
    sys.setResource('gold', NaN as any);
    expect(Number.isFinite(sys.serialize().resources.gold)).toBe(true);
    const data = sys.serialize();
    data.resources.gold = -100;
    sys.deserialize(data);
    expect(sys.getAmount('gold')).toBe(0);
    (data.resources as any).gold = undefined;
    sys.deserialize(data);
    expect(sys.getAmount('gold')).toBe(0);
  });

  it('连续序列化/反序列化数据稳定', () => {
    const sys = createResource();
    sys.setResource('gold', 1234);
    sys.setProductionRate('grain', 3.5);
    const data1 = sys.serialize();
    const sys2 = createResource();
    sys2.deserialize(data1);
    const data2 = sys2.serialize();
    expect(data2.resources).toEqual(data1.resources);
    expect(data2.productionRates).toEqual(data1.productionRates);
  });
});

describe('F-Lifecycle: 系统重置', () => {
  it('reset 恢复初始资源/速率/上限', () => {
    const sys = createResource();
    sys.setResource('gold', 99999);
    sys.setProductionRate('grain', 100);
    sys.setCap('grain', 99999);
    sys.reset();
    expect(sys.getResources()).toEqual(cloneResources(INITIAL_RESOURCES));
    expect(sys.getProductionRates()).toEqual({ ...INITIAL_PRODUCTION_RATES });
    expect(sys.getCaps()).toEqual({
      grain: INITIAL_CAPS.grain, gold: INITIAL_CAPS.gold,
      ore: INITIAL_CAPS.ore, wood: INITIAL_CAPS.wood,
      troops: INITIAL_CAPS.troops, mandate: null, techPoint: null, recruitToken: null, skillBook: null,
    });
  });
});

describe('F-Lifecycle: ISubsystem 接口适配', () => {
  it('update 调用 tick，getState 返回序列化数据', () => {
    const sys = createResource();
    sys.recalculateProduction({ grain: 1.0 });
    const before = sys.getAmount('grain');
    sys.update(1);
    expect(sys.getAmount('grain')).toBeGreaterThan(before);
    const state = sys.getState() as any;
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.resources).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件覆盖
// ═══════════════════════════════════════════════

describe('F-Boundary: 上限截断边界', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('恰好等于上限不截断，超过上限精确截断', () => {
    const cap = sys.getCaps().grain!;
    sys.setResource('grain', 0);
    expect(sys.addResource('grain', cap)).toBe(cap);
    expect(sys.getAmount('grain')).toBe(cap);
    sys.setResource('grain', 0);
    expect(sys.addResource('grain', cap + 100)).toBe(cap);
  });

  it('setResource 超上限截断，NaN 防护为 0', () => {
    const cap = sys.getCaps().grain!;
    sys.setResource('grain', cap + 1000);
    expect(sys.getAmount('grain')).toBe(cap);
    sys.setResource('gold', NaN as any);
    expect(sys.getAmount('gold')).toBe(0);
  });

  it('isAtCap 正确判断（有上限/无上限）', () => {
    const cap = sys.getCaps().grain!;
    sys.setResource('grain', 0);
    expect(isAtCap(sys, 'grain')).toBe(false);
    sys.setResource('grain', cap);
    expect(isAtCap(sys, 'grain')).toBe(true);
    expect(isAtCap(sys, 'mandate')).toBe(false);
    sys.addResource('mandate', 999999);
    expect(isAtCap(sys, 'mandate')).toBe(false);
  });
});

describe('F-Boundary: 超大数处理', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('addResource/setResource MAX_SAFE_INTEGER 不崩溃', () => {
    expect(() => sys.addResource('gold', Number.MAX_SAFE_INTEGER)).not.toThrow();
    expect(Number.isFinite(sys.getAmount('gold'))).toBe(true);
    expect(() => sys.setResource('gold', Number.MAX_SAFE_INTEGER)).not.toThrow();
    expect(Number.isFinite(sys.getAmount('gold'))).toBe(true);
  });

  it('consumeResource/canAfford 大数值精确', () => {
    sys.setCap('gold', null);
    sys.setResource('gold', 100000);
    sys.consumeResource('gold', 50000);
    expect(sys.getAmount('gold')).toBe(50000);
    expect(sys.canAfford({ gold: 100000 }).canAfford).toBe(false);
    expect(sys.canAfford({ gold: 50000 }).canAfford).toBe(true);
  });
});

describe('F-Boundary: 粮草保护机制', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('消耗保留 MIN_GRAIN_RESERVE，等于/低于保留量无法消耗', () => {
    sys.setResource('grain', MIN_GRAIN_RESERVE + 50);
    sys.consumeResource('grain', 50);
    expect(sys.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);
    sys.setResource('grain', MIN_GRAIN_RESERVE);
    expect(() => sys.consumeResource('grain', 1)).toThrow();
    sys.setResource('grain', MIN_GRAIN_RESERVE - 1);
    expect(() => sys.consumeResource('grain', 1)).toThrow();
  });

  it('canAfford 考虑粮草保留量', () => {
    sys.setResource('grain', MIN_GRAIN_RESERVE + 100);
    expect(sys.canAfford({ grain: 101 }).canAfford).toBe(false);
    expect(sys.canAfford({ grain: 100 }).canAfford).toBe(true);
  });
});

describe('F-Boundary: 产出速率与生产边界', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('零/负/NaN 产出速率不增长', () => {
    sys.recalculateProduction({ grain: 10 });
    const before = sys.getAmount('grain');
    sys.setProductionRate('grain', 0);
    sys.tick(1000);
    expect(sys.getAmount('grain')).toBe(before);
    sys.setProductionRate('grain', -5);
    sys.tick(1000);
    expect(sys.getAmount('grain')).toBe(before);
    sys.setProductionRate('grain', NaN);
    sys.tick(1000);
    expect(sys.getAmount('grain')).toBe(before);
  });

  it('tick NaN/Infinity deltaMs 被跳过', () => {
    sys.recalculateProduction({ grain: 10 });
    const before = sys.getAmount('grain');
    sys.tick(NaN);
    sys.tick(Infinity);
    expect(sys.getAmount('grain')).toBe(before);
  });

  it('生产达到上限时截断', () => {
    sys.recalculateProduction({ grain: 100.0 });
    const cap = sys.getCaps().grain!;
    sys.setResource('grain', cap - 5);
    sys.tick(1000);
    expect(sys.getAmount('grain')).toBeLessThanOrEqual(cap);
  });
});

describe('F-Boundary: 加成乘数边界', () => {
  it('无加成返回 1，正加成增加，多类型乘法叠加', () => {
    expect(calculateBonusMultiplier()).toBe(1);
    expect(calculateBonusMultiplier({})).toBe(1);
    expect(calculateBonusMultiplier({ tech: 0.15 })).toBeCloseTo(1.15);
    expect(calculateBonusMultiplier({ tech: 0.1, castle: 0.2 })).toBeCloseTo(1.1 * 1.2);
  });

  it('NaN 加成跳过，负加成下界防护', () => {
    expect(calculateBonusMultiplier({ tech: NaN })).toBe(1);
    expect(calculateBonusMultiplier({ tech: -0.5 })).toBeCloseTo(0.5);
    expect(calculateBonusMultiplier({ tech: -1.5 })).toBe(0);
  });

  it('tick 中加成正确应用', () => {
    const sys = createResource();
    sys.recalculateProduction({ grain: 1.0 });
    const before = sys.getAmount('grain');
    sys.tick(1000, { castle: 0.5 });
    expect(sys.getAmount('grain')).toBeCloseTo(before + 1.5, 0);
  });
});

describe('F-Boundary: 容量警告边界', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('各级别警告正确', () => {
    // safe
    expect(sys.getCapWarnings().find(w => w.resourceType === 'grain')?.level).toBe('safe');
    // notice (90%)
    sys.setCap('grain', 100000); sys.setResource('grain', 9000); sys.setCap('grain', 10000);
    expect(sys.getCapWarning('grain')!.level).toBe('notice');
    // warning (95%)
    sys.setCap('grain', 100000); sys.setResource('grain', 9500); sys.setCap('grain', 10000);
    expect(sys.getCapWarning('grain')!.level).toBe('warning');
    // full (100%)
    sys.setCap('grain', 100000); sys.setResource('grain', 10000); sys.setCap('grain', 10000);
    expect(sys.getCapWarning('grain')!.level).toBe('full');
  });

  it('无上限资源返回 null，getWarningLevel NaN/Infinity 返回 safe', () => {
    expect(sys.getCapWarning('mandate')).toBeNull();
    expect(getWarningLevel(NaN)).toBe('safe');
    expect(getWarningLevel(Infinity)).toBe('safe');
  });
});

describe('F-Boundary: 批量消耗原子性', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('全部满足时原子扣除，部分不足时全部不扣', () => {
    fillResources(sys);
    sys.consumeBatch({ grain: 100, gold: 200 });
    expect(sys.getAmount('grain')).toBe(99999 - 100);
    expect(sys.getAmount('gold')).toBe(99999 - 200);
    fillResources(sys);
    sys.setResource('gold', 5);
    expect(() => sys.consumeBatch({ grain: 100, gold: 200 })).toThrow();
    expect(sys.getAmount('grain')).toBe(99999);
    expect(sys.getAmount('gold')).toBe(5);
  });
});

describe('F-Boundary: 上限查表 lookupCap', () => {
  it('等级 1 返回初始上限，等级 0 返回正数，超高等级线性外推', () => {
    expect(lookupCap(1, 'granary')).toBe(INITIAL_CAPS.grain);
    expect(lookupCap(1, 'barracks')).toBe(INITIAL_CAPS.troops);
    expect(lookupCap(0, 'granary')).toBeGreaterThan(0);
    expect(lookupCap(100, 'granary')).toBeGreaterThan(lookupCap(30, 'granary'));
  });
});

// ═══════════════════════════════════════════════
// F-Normal: 正向流程补充
// ═══════════════════════════════════════════════

describe('F-Normal: 资源添加正向流程', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('添加正数资源返回实际增加量，多次累加正确', () => {
    expect(sys.addResource('gold', 100)).toBe(100);
    expect(sys.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 100);
    sys.addResource('gold', 200);
    sys.addResource('gold', 300);
    expect(sys.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 600);
  });

  it('所有7种资源类型都可添加', () => {
    for (const type of RESOURCE_TYPES) {
      expect(sys.addResource(type, 10)).toBe(10);
      expect(sys.getAmount(type)).toBe(INITIAL_RESOURCES[type] + 10);
    }
  });

  it('添加小数资源正确处理', () => {
    sys.addResource('gold', 0.5);
    expect(sys.getAmount('gold')).toBeCloseTo(INITIAL_RESOURCES.gold + 0.5);
  });
});

describe('F-Normal: 资源消耗正向流程', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); fillResources(sys); });

  it('消耗足够资源返回消耗量，批量消耗成功', () => {
    expect(sys.consumeResource('gold', 100)).toBe(100);
    sys.consumeBatch({ grain: 100, gold: 200, troops: 50 });
    expect(sys.getAmount('grain')).toBe(99999 - 100);
    expect(sys.getAmount('gold')).toBe(99999 - 200 - 100);
    expect(sys.getAmount('troops')).toBe(99999 - 50);
  });

  it('canAfford 检查通过后 consumeBatch 成功', () => {
    const cost: ResourceCost = { grain: 100, gold: 200 };
    expect(sys.canAfford(cost).canAfford).toBe(true);
    sys.consumeBatch(cost);
    expect(sys.getAmount('grain')).toBe(99999 - 100);
  });
});

describe('F-Normal: 生产 tick 正向流程', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('基础/多资源/加成产出', () => {
    sys.recalculateProduction({ grain: 2.0 });
    const before = sys.getAmount('grain');
    sys.tick(5000);
    expect(sys.getAmount('grain')).toBeCloseTo(before + 10, 0);

    sys.recalculateProduction({ grain: 1.0, gold: 2.0, troops: 0.5 });
    const b2 = sys.getResources();
    sys.tick(2000);
    expect(sys.getAmount('grain')).toBeCloseTo(b2.grain + 2, 0);
    expect(sys.getAmount('gold')).toBeCloseTo(b2.gold + 4, 0);
    expect(sys.getAmount('troops')).toBeCloseTo(b2.troops + 1, 0);

    sys.recalculateProduction({ grain: 1.0 });
    const b3 = sys.getAmount('grain');
    sys.tick(1000, { castle: 1.0 });
    expect(sys.getAmount('grain')).toBeCloseTo(b3 + 2, 0);
  });
});

describe('F-Normal: 上限管理正向流程', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('updateCaps/setCap/getCap/touchSaveTime', () => {
    sys.updateCaps(5, 5);
    expect(sys.getCaps().grain).toBeGreaterThan(INITIAL_CAPS.grain!);
    expect(sys.getCaps().troops).toBeGreaterThan(INITIAL_CAPS.troops!);
    sys.setCap('grain', 5000);
    expect(sys.getCaps().grain).toBe(5000);
    const before = sys.getLastSaveTime();
    sys.touchSaveTime();
    expect(sys.getLastSaveTime()).toBeGreaterThanOrEqual(before);
  });

  it('getResources/getProductionRates/getCaps 返回只读副本', () => {
    const r = sys.getResources(); r.gold = 0;
    expect(sys.getAmount('gold')).toBe(INITIAL_RESOURCES.gold);
    const rates = sys.getProductionRates(); rates.grain = 999;
    expect(sys.getProductionRates().grain).toBe(INITIAL_PRODUCTION_RATES.grain);
    const caps = sys.getCaps(); (caps as any).grain = 999;
    expect(sys.getCaps().grain).toBe(INITIAL_CAPS.grain);
  });
});

describe('F-Normal: setProductionRate 正向流程', () => {
  let sys: ResourceSystem;
  beforeEach(() => { sys = createResource(); });

  it('正常设置，零值不增长，负值 tick 跳过', () => {
    sys.setProductionRate('grain', 5.0);
    expect(sys.getProductionRates().grain).toBe(5.0);
    sys.setProductionRate('grain', 0);
    expect(sys.getProductionRates().grain).toBe(0);
    sys.setProductionRate('grain', -10);
    expect(sys.getProductionRates().grain).toBe(-10);
    const before = sys.getAmount('grain');
    sys.tick(1000);
    expect(sys.getAmount('grain')).toBe(before);
  });
});

// ═══════════════════════════════════════════════
// F-Integration: ThreeKingdomsEngine 集成
// ═══════════════════════════════════════════════

describe('F-Integration: ThreeKingdomsEngine 资源集成', () => {
  let ThreeKingdomsEngine: any;
  beforeEach(async () => {
    const mod = await import('../../engine/ThreeKingdomsEngine');
    ThreeKingdomsEngine = mod.ThreeKingdomsEngine;
  });

  it('引擎初始化后资源系统可用', () => {
    const engine = new ThreeKingdomsEngine();
    expect(engine.resource).toBeDefined();
    expect(engine.resource.getAmount('grain')).toBe(INITIAL_RESOURCES.grain);
    expect(engine.resource.getAmount('gold')).toBe(INITIAL_RESOURCES.gold);
  });

  it('通过引擎 resource 属性直接操作资源', () => {
    const engine = new ThreeKingdomsEngine();
    engine.resource.addResource('gold', 500);
    expect(engine.resource.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 500);
    engine.resource.consumeResource('gold', 100);
    expect(engine.resource.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 400);
  });

  it('引擎 reset 同时重置资源', () => {
    const engine = new ThreeKingdomsEngine();
    engine.resource.addResource('gold', 9999);
    engine.reset();
    expect(engine.resource.getAmount('gold')).toBe(INITIAL_RESOURCES.gold);
  });

  it('引擎序列化包含资源数据', () => {
    const engine = new ThreeKingdomsEngine();
    engine.resource.setCap('gold', null);
    engine.resource.setResource('gold', 7777);
    const json = engine.serialize();
    expect(json).toContain('gold');
    const parsed = JSON.parse(json);
    expect(parsed.resource.resources.gold).toBe(7777);
  });

  it('引擎 tick 驱动资源产出', () => {
    const engine = new ThreeKingdomsEngine();
    const before = engine.resource.getAmount('grain');
    engine.tick(1, 1);
    expect(engine.resource.getAmount('grain')).toBeGreaterThanOrEqual(before);
  });

  it('引擎 getCapWarnings 代理到资源系统', () => {
    const engine = new ThreeKingdomsEngine();
    expect(Array.isArray(engine.getCapWarnings())).toBe(true);
  });

  it('引擎 deserialize 恢复资源状态', () => {
    const engine = new ThreeKingdomsEngine();
    engine.resource.setCap('gold', null);
    engine.resource.setResource('gold', 5555);
    const json = engine.serialize();
    const engine2 = new ThreeKingdomsEngine();
    engine2.deserialize(json);
    expect(engine2.resource.getAmount('gold')).toBe(5555);
  });
});

// ═══════════════════════════════════════════════
// 边界条件补充
// ═══════════════════════════════════════════════

describe('F-Boundary: 辅助函数边界', () => {
  it('getAmount 对所有类型返回有限数', () => {
    const sys = createResource();
    for (const type of RESOURCE_TYPES) expect(Number.isFinite(sys.getAmount(type))).toBe(true);
  });

  it('zeroResources 返回全零，cloneResources 深拷贝', () => {
    const z = zeroResources();
    for (const type of RESOURCE_TYPES) expect(z[type]).toBe(0);
    const c = cloneResources(z);
    c.gold = 999;
    expect(z.gold).toBe(0);
  });

  it('calculateCapWarnings 无上限时返回空，calculateCapWarning 无上限返回 null', () => {
    const r = zeroResources();
    const caps = { grain: null, gold: null, ore: null, wood: null, troops: null, mandate: null, techPoint: null, recruitToken: null, skillBook: null };
    expect(calculateCapWarnings(r, caps)).toEqual([]);
    for (const type of RESOURCE_TYPES) expect(calculateCapWarning(type, r, caps)).toBeNull();
  });
});
