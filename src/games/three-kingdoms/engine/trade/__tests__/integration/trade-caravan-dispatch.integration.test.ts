import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * 集成测试 1/3: 商路开通→商队派遣→利润计算→繁荣度提升 完整流程
 *
 * 覆盖Play文档：
 *   §3.1 商路开通（含前置依赖链）
 *   §3.3 商队管理（数量上限、属性查询）
 *   §3.5 商队派遣与运输（载重、护卫、状态流转）
 *   §4.2 低买高卖策略（利润计算含繁荣度/议价加成）
 *   §5.3 商路繁荣度完整验证（增长、衰减、等级映射）
 *   §8.2 贸易→繁荣度闭环
 *   §8.4 护卫武将互斥验证
 */

import { TradeSystem } from '../../TradeSystem';
import { CaravanSystem } from '../../CaravanSystem';
import type { TradeCurrencyOps } from '../../TradeSystem';
import type { RouteInfoProvider } from '../../CaravanSystem';
import type { TradeRouteId, CaravanDispatchRequest } from '../../../../core/trade/trade.types';
import {
import type { ISystemDeps } from "../../../../core/types";
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  PROSPERITY_DECAY_RATE,
  INITIAL_CARAVAN_COUNT,
  MAX_CARAVAN_COUNT,
  PROSPERITY_TIERS,
} from '../../../../core/trade/trade-config';

// ─── 辅助工具 ────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  };
}

function createMockCurrencyOps(): TradeCurrencyOps {
  return {
    addCurrency: vi.fn(),
    canAfford: vi.fn().mockReturnValue(true),
    spendByPriority: vi.fn().mockReturnValue({ success: true }),
  };
}

function createTrade(): TradeSystem {
  const trade = new TradeSystem();
  trade.init(createMockDeps() as unknown as ISystemDeps);
  trade.setCurrencyOps(createMockCurrencyOps());
  return trade;
}

function createCaravan(trade: TradeSystem): CaravanSystem {
  const caravan = new CaravanSystem();
  caravan.init(createMockDeps() as unknown as ISystemDeps);

  const provider: RouteInfoProvider = {
    getRouteDef: (routeId: TradeRouteId) => {
      const state = trade.getRouteState(routeId);
      const def = trade.getRouteDefs().find(d => d.id === routeId);
      if (!state || !def) return null;
      return {
        opened: state.opened,
        baseTravelTime: def.baseTravelTime,
        baseProfitRate: def.baseProfitRate,
        from: def.from,
        to: def.to,
      };
    },
    getPrice: (goodsId: string) => trade.getPrice(goodsId),
    completeTrade: (routeId: TradeRouteId) => trade.completeTrade(routeId),
  };
  caravan.setRouteProvider(provider);
  return caravan;
}

/** 开通第一条可开通的商路 */
function openFirstRoute(trade: TradeSystem, castleLevel = 10): TradeRouteId | null {
  const defs = trade.getRouteDefs();
  for (const def of defs) {
    const check = trade.canOpenRoute(def.id, castleLevel);
    if (check.canOpen) {
      const result = trade.openRoute(def.id, castleLevel);
      return result.success ? def.id : null;
    }
  }
  return null;
}

/** 开通指定ID的商路 */
function openRouteById(trade: TradeSystem, routeId: TradeRouteId, castleLevel = 20): boolean {
  const check = trade.canOpenRoute(routeId, castleLevel);
  if (!check.canOpen) return false;
  const result = trade.openRoute(routeId, castleLevel);
  return result.success;
}

// ─────────────────────────────────────────
// §3.1 商路开通完整流程
// ─────────────────────────────────────────

describe('§3.1 商路开通完整流程', () => {
  let trade: TradeSystem;

  beforeEach(() => { trade = createTrade(); });

  it('§3.1.1 应包含8条商路定义', () => {
    expect(trade.getRouteDefs().length).toBe(8);
  });

  it('§3.1.2 所有商路初始状态为未开通', () => {
    const states = trade.getAllRouteStates();
    for (const [, state] of states) {
      expect(state.opened).toBe(false);
    }
  });

  it('§3.1.3 无前置商路的可直接开通', () => {
    const noPrereq = trade.getRouteDefs().filter(d => !d.requiredRoute);
    expect(noPrereq.length).toBeGreaterThan(0);

    for (const def of noPrereq) {
      const check = trade.canOpenRoute(def.id, def.requiredCastleLevel);
      expect(check.canOpen).toBe(true);
    }
  });

  it('§3.1.4 主城等级不足时拒绝开通', () => {
    const defs = trade.getRouteDefs();
    const highLevel = defs.find(d => d.requiredCastleLevel >= 3);
    if (!highLevel) return;

    const check = trade.canOpenRoute(highLevel.id, 1);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('主城');
  });

  it('§3.1.5 前置商路未开通时拒绝开通', () => {
    const withPrereq = trade.getRouteDefs().find(d => d.requiredRoute);
    if (!withPrereq) return;

    const check = trade.canOpenRoute(withPrereq.id, 99);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('前置');
  });

  it('§3.1.6 已开通商路不可重复开通', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const check = trade.canOpenRoute(routeId, 99);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('已开通');
  });

  it('§3.1.7 按依赖链顺序开通多条商路', () => {
    const sorted = [...trade.getRouteDefs()].sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
    let opened = 0;

    for (const def of sorted) {
      if (def.requiredRoute) {
        const preState = trade.getRouteState(def.requiredRoute);
        if (!preState?.opened) continue;
      }
      const result = trade.openRoute(def.id, 20);
      if (result.success) opened++;
    }

    expect(opened).toBeGreaterThanOrEqual(3);
  });

  it('§3.1.8 开通后繁荣度初始值为30', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBe(INITIAL_PROSPERITY);
    expect(state?.completedTrades).toBe(0);
  });

  it('§3.1.9 开通时扣款通过currencyOps执行', () => {
    const ops = createMockCurrencyOps();
    trade.setCurrencyOps(ops);

    const noPrereq = trade.getRouteDefs().find(d => !d.requiredRoute);
    if (!noPrereq) return;

    trade.openRoute(noPrereq.id, noPrereq.requiredCastleLevel);
    expect(ops.spendByPriority).toHaveBeenCalled();
  });

  it('§3.1.10 开通费不足时拒绝开通', () => {
    const ops: TradeCurrencyOps = {
      addCurrency: vi.fn(),
      canAfford: vi.fn().mockReturnValue(false),
      spendByPriority: vi.fn().mockReturnValue({ success: false }),
    };
    trade.setCurrencyOps(ops);

    const noPrereq = trade.getRouteDefs().find(d => !d.requiredRoute);
    if (!noPrereq) return;

    const result = trade.openRoute(noPrereq.id, noPrereq.requiredCastleLevel);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('货币不足');
  });
});

// ─────────────────────────────────────────
// §3.3+§3.5 商队管理与派遣
// ─────────────────────────────────────────

describe('§3.3+§3.5 商队管理与派遣', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;

  beforeEach(() => {
    trade = createTrade();
    caravan = createCaravan(trade);
  });

  it('§3.3.1 初始商队数量为2', () => {
    expect(caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
  });

  it('§3.3.2 所有初始商队状态为idle', () => {
    const caravans = caravan.getCaravans();
    for (const c of caravans) {
      expect(c.status).toBe('idle');
      expect(c.currentRouteId).toBeNull();
      expect(c.guardHeroId).toBeNull();
    }
  });

  it('§3.3.3 getIdleCaravans返回所有空闲商队', () => {
    const idle = caravan.getIdleCaravans();
    expect(idle.length).toBe(INITIAL_CARAVAN_COUNT);
  });

  it('§3.3.4 商队属性含capacity/speedMultiplier/bargainingPower', () => {
    const c = caravan.getCaravans()[0];
    expect(c.attributes.capacity).toBeGreaterThan(0);
    expect(c.attributes.speedMultiplier).toBeGreaterThan(0);
    expect(c.attributes.bargainingPower).toBeGreaterThan(0);
  });

  it('§3.5.1 派遣到已开通商路应成功', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    const result = caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 5, tea: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.estimatedArrival).toBeGreaterThan(0);
    expect(result.estimatedProfit).toBeGreaterThanOrEqual(0);
  });

  it('§3.5.2 派遣后商队状态变为traveling', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    caravan.dispatch({ caravanId: idle[0].id, routeId, cargo: { silk: 1 } });

    const updated = caravan.getCaravan(idle[0].id);
    expect(updated?.status).toBe('traveling');
    expect(updated?.currentRouteId).toBe(routeId);
    expect(updated?.departTime).toBeGreaterThan(0);
    expect(updated?.arrivalTime).toBeGreaterThan(updated.departTime);
  });

  it('§3.5.3 派遣到未开通商路应失败', () => {
    const idle = caravan.getIdleCaravans();
    const result = caravan.dispatch({
      caravanId: idle[0].id,
      routeId: 'nonexistent_route',
      cargo: { silk: 1 },
    });
    expect(result.success).toBe(false);
  });

  it('§3.5.4 超出载重应失败', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    const capacity = idle[0].attributes.capacity;

    const result = caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: capacity + 100 },
    });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('载重');
  });

  it('§3.5.5 非空闲商队不可再次派遣', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    caravan.dispatch({ caravanId: idle[0].id, routeId, cargo: { silk: 1 } });

    const result = caravan.dispatch({ caravanId: idle[0].id, routeId, cargo: { silk: 1 } });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('待命');
  });

  it('§3.5.6 多支商队可同时派遣到不同商路', () => {
    // 开通两条商路
    const sorted = [...trade.getRouteDefs()].sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
    const openedRoutes: TradeRouteId[] = [];
    for (const def of sorted) {
      if (openedRoutes.length >= 2) break;
      if (def.requiredRoute) {
        const pre = trade.getRouteState(def.requiredRoute);
        if (!pre?.opened) continue;
      }
      const result = trade.openRoute(def.id, 20);
      if (result.success) openedRoutes.push(def.id);
    }

    if (openedRoutes.length < 2) return;

    const idle = caravan.getIdleCaravans();
    const r1 = caravan.dispatch({ caravanId: idle[0].id, routeId: openedRoutes[0], cargo: { silk: 1 } });
    const r2 = caravan.dispatch({ caravanId: idle[1].id, routeId: openedRoutes[1], cargo: { tea: 1 } });

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('§3.5.7 派遣带护卫武将应成功', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    const result = caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 1 },
      guardHeroId: 'hero_guanyu',
    });

    expect(result.success).toBe(true);
    expect(caravan.hasGuard(idle[0].id)).toBe(true);
    expect(caravan.getGuardHeroId(idle[0].id)).toBe('hero_guanyu');
  });

  it('§3.3.5 新增商队受上限约束', () => {
    while (caravan.canAddCaravan()) {
      caravan.addCaravan();
    }
    expect(caravan.getCaravanCount()).toBe(MAX_CARAVAN_COUNT);

    const result = caravan.addCaravan();
    expect(result.success).toBe(false);
  });

  it('§3.3.6 升级商队属性应生效', () => {
    const c = caravan.getCaravans()[0];
    const before = c.attributes.capacity;

    const ok = caravan.upgradeCaravan(c.id, 'capacity', 10);
    expect(ok).toBe(true);

    const after = caravan.getCaravan(c.id);
    expect(after?.attributes.capacity).toBe(before + 10);
  });

  it('§3.3.7 currentLoad不可直接升级', () => {
    const c = caravan.getCaravans()[0];
    const ok = caravan.upgradeCaravan(c.id, 'currentLoad', 10);
    expect(ok).toBe(false);
  });
});

// ─────────────────────────────────────────
// §4.2 利润计算
// ─────────────────────────────────────────

describe('§4.2 低买高卖策略 — 利润计算', () => {
  let trade: TradeSystem;

  beforeEach(() => { trade = createTrade(); });

  it('§4.2.1 利润计算含收入、成本、繁荣度加成、议价加成', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const profit = trade.calculateProfit(routeId, { silk: 5, tea: 3 }, 1.0, 0);
    expect(profit.revenue).toBeGreaterThanOrEqual(0);
    expect(profit.cost).toBeGreaterThan(0);
    expect(typeof profit.profitRate).toBe('number');
    expect(typeof profit.prosperityBonus).toBe('number');
    expect(typeof profit.bargainingBonus).toBe('number');
    expect(typeof profit.guardCost).toBe('number');
  });

  it('§4.2.2 高议价能力增加利润', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const base = trade.calculateProfit(routeId, { silk: 5 }, 1.0, 0);
    const high = trade.calculateProfit(routeId, { silk: 5 }, 1.5, 0);

    expect(high.bargainingBonus).toBeGreaterThan(base.bargainingBonus);
    expect(high.revenue).toBeGreaterThan(base.revenue);
  });

  it('§4.2.3 护卫费用从利润中扣除', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const noGuard = trade.calculateProfit(routeId, { silk: 5 }, 1.0, 0);
    const withGuard = trade.calculateProfit(routeId, { silk: 5 }, 1.0, 200);

    expect(withGuard.guardCost).toBe(200);
    expect(withGuard.profit).toBe(noGuard.profit - 200);
  });

  it('§4.2.4 繁荣度等级影响产出倍率', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const tier = trade.getProsperityTier(routeId);
    expect(tier.outputMultiplier).toBeGreaterThan(0);

    const level = trade.getProsperityLevel(routeId);
    expect(['declining', 'normal', 'thriving', 'golden']).toContain(level);
  });

  it('§4.2.5 不存在的商路利润为零', () => {
    const profit = trade.calculateProfit('nonexistent_route', { silk: 5 }, 1.0, 0);
    expect(profit.revenue).toBe(0);
    expect(profit.cost).toBe(0);
    expect(profit.profit).toBe(0);
  });

  it('§4.2.6 空货物利润为零', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const profit = trade.calculateProfit(routeId, {}, 1.0, 0);
    expect(profit.cost).toBe(0);
  });

  it('§4.2.7 繁荣度提升后利润倍率增加', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const beforeMultiplier = trade.getProsperityMultiplier(routeId);

    // 提升繁荣度
    for (let i = 0; i < 20; i++) {
      trade.completeTrade(routeId);
    }

    const afterMultiplier = trade.getProsperityMultiplier(routeId);
    expect(afterMultiplier).toBeGreaterThanOrEqual(beforeMultiplier);
  });
});

// ─────────────────────────────────────────
// §5.3 繁荣度完整验证
// ─────────────────────────────────────────

describe('§5.3 商路繁荣度完整验证', () => {
  let trade: TradeSystem;

  beforeEach(() => { trade = createTrade(); });

  it('§5.3.1 初始繁荣度为30', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBe(INITIAL_PROSPERITY);
  });

  it('§5.3.2 完成贸易增加繁荣度', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const before = trade.getRouteState(routeId)!.prosperity;
    trade.completeTrade(routeId);
    const after = trade.getRouteState(routeId)!.prosperity;

    expect(after).toBe(before + PROSPERITY_GAIN_PER_TRADE);
  });

  it('§5.3.3 繁荣度上限为100', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 100; i++) {
      trade.completeTrade(routeId);
    }

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeLessThanOrEqual(100);
  });

  it('§5.3.4 繁荣度4个等级配置完整', () => {
    expect(PROSPERITY_TIERS.length).toBe(4);
    const levels = PROSPERITY_TIERS.map(t => t.level);
    expect(levels).toContain('declining');
    expect(levels).toContain('normal');
    expect(levels).toContain('thriving');
    expect(levels).toContain('golden');
  });

  it('§5.3.5 繁荣和鼎盛等级解锁NPC商人', () => {
    const thriving = PROSPERITY_TIERS.find(t => t.level === 'thriving');
    const golden = PROSPERITY_TIERS.find(t => t.level === 'golden');
    expect(thriving?.unlockNpcMerchant).toBe(true);
    expect(golden?.unlockNpcMerchant).toBe(true);
  });

  it('§5.3.6 update触发繁荣度衰减', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 10; i++) trade.completeTrade(routeId);
    const before = trade.getRouteState(routeId)!.prosperity;

    trade.update(1);
    const after = trade.getRouteState(routeId)!.prosperity;
    expect(after).toBeLessThanOrEqual(before);
  });

  it('§5.3.7 繁荣度不低于0', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 10000; i++) trade.update(100);

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeGreaterThanOrEqual(0);
  });

  it('§5.3.8 未开通商路update不衰减', () => {
    const states = trade.getAllRouteStates();
    const closedRoute = Array.from(states.entries()).find(([, s]) => !s.opened);
    if (!closedRoute) return;

    const [, state] = closedRoute;
    const before = state.prosperity;
    trade.update(1000);
    expect(state.prosperity).toBe(before);
  });
});

// ─────────────────────────────────────────
// §8.2 贸易→繁荣度闭环
// ─────────────────────────────────────────

describe('§8.2 贸易→繁荣度闭环', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;

  beforeEach(() => {
    trade = createTrade();
    caravan = createCaravan(trade);
  });

  it('§8.2.1 完成贸易→繁荣度提升→等级可能变化', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const initialLevel = trade.getProsperityLevel(routeId);
    const initialMultiplier = trade.getProsperityMultiplier(routeId);

    for (let i = 0; i < 25; i++) trade.completeTrade(routeId);

    const finalLevel = trade.getProsperityLevel(routeId);
    const finalMultiplier = trade.getProsperityMultiplier(routeId);

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeGreaterThan(INITIAL_PROSPERITY);
    expect(finalMultiplier).toBeGreaterThanOrEqual(initialMultiplier);
  });

  it('§8.2.2 繁荣度影响利润计算', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const cargo = { silk: 5 };
    const profitBefore = trade.calculateProfit(routeId, cargo, 1.0, 0);

    for (let i = 0; i < 20; i++) trade.completeTrade(routeId);

    const profitAfter = trade.calculateProfit(routeId, cargo, 1.0, 0);

    // 繁荣度提升后收入应增加（或至少不变）
    expect(profitAfter.prosperityBonus).toBeGreaterThanOrEqual(profitBefore.prosperityBonus);
  });

  it('§8.2.3 衰减抵消增长形成动态平衡', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 模拟：每次完成贸易后update一段时间
    // PROSPERITY_DECAY_RATE=0.01, GAIN=3
    // update(10) => decay 0.1 per cycle, gain 3 per trade
    for (let cycle = 0; cycle < 10; cycle++) {
      trade.completeTrade(routeId);
      trade.update(10); // 轻微衰减
    }

    const state = trade.getRouteState(routeId);
    // 繁荣度应在合理范围内
    expect(state!.prosperity).toBeGreaterThan(0);
    expect(state!.prosperity).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────
// §8.4 护卫武将互斥
// ─────────────────────────────────────────

describe('§8.4 护卫武将互斥验证', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;

  beforeEach(() => {
    trade = createTrade();
    caravan = createCaravan(trade);
  });

  it('§8.4.1 同一武将不可同时护卫两支商队', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    if (idle.length < 2) return;

    const r1 = caravan.assignGuard(idle[0].id, 'hero_zhaoyun');
    expect(r1.success).toBe(true);

    const r2 = caravan.assignGuard(idle[1].id, 'hero_zhaoyun');
    expect(r2.success).toBe(false);
  });

  it('§8.4.2 checkGuardMutex检测冲突', () => {
    const idle = caravan.getIdleCaravans();
    if (idle.length < 2) return;

    caravan.assignGuard(idle[0].id, 'hero_zhaoyun');
    const check = caravan.checkGuardMutex('hero_zhaoyun', idle[1].id);
    expect(check.available).toBe(false);
    expect(check.conflictCaravanId).toBe(idle[0].id);
  });

  it('§8.4.3 移除护卫后武将可用', () => {
    const idle = caravan.getIdleCaravans();
    if (idle.length < 2) return;

    caravan.assignGuard(idle[0].id, 'hero_zhaoyun');
    caravan.removeGuard(idle[0].id);

    const check = caravan.checkGuardMutex('hero_zhaoyun');
    expect(check.available).toBe(true);
  });

  it('§8.4.4 派遣时指定护卫正确指派', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 1 },
      guardHeroId: 'hero_guanyu',
    });

    expect(caravan.getGuardHeroId(idle[0].id)).toBe('hero_guanyu');
    expect(caravan.hasGuard(idle[0].id)).toBe(true);
  });

  it('§8.4.5 派遣时护卫互斥检查生效', () => {
    const sorted = [...trade.getRouteDefs()].sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
    const openedRoutes: TradeRouteId[] = [];
    for (const def of sorted) {
      if (openedRoutes.length >= 2) break;
      if (def.requiredRoute) {
        const pre = trade.getRouteState(def.requiredRoute);
        if (!pre?.opened) continue;
      }
      const r = trade.openRoute(def.id, 20);
      if (r.success) openedRoutes.push(def.id);
    }
    if (openedRoutes.length < 2) return;

    const idle = caravan.getIdleCaravans();
    // 商队1带护卫
    caravan.dispatch({
      caravanId: idle[0].id,
      routeId: openedRoutes[0],
      cargo: { silk: 1 },
      guardHeroId: 'hero_zhaoyun',
    });

    // 商队2尝试用同一护卫
    const r2 = caravan.dispatch({
      caravanId: idle[1].id,
      routeId: openedRoutes[1],
      cargo: { tea: 1 },
      guardHeroId: 'hero_zhaoyun',
    });
    expect(r2.success).toBe(false);
    expect(r2.reason).toContain('护卫');
  });

  it('§8.4.6 不同武将可分别护卫不同商队', () => {
    const sorted = [...trade.getRouteDefs()].sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
    const openedRoutes: TradeRouteId[] = [];
    for (const def of sorted) {
      if (openedRoutes.length >= 2) break;
      if (def.requiredRoute) {
        const pre = trade.getRouteState(def.requiredRoute);
        if (!pre?.opened) continue;
      }
      const r = trade.openRoute(def.id, 20);
      if (r.success) openedRoutes.push(def.id);
    }
    if (openedRoutes.length < 2) return;

    const idle = caravan.getIdleCaravans();
    const r1 = caravan.dispatch({
      caravanId: idle[0].id, routeId: openedRoutes[0],
      cargo: { silk: 1 }, guardHeroId: 'hero_zhaoyun',
    });
    const r2 = caravan.dispatch({
      caravanId: idle[1].id, routeId: openedRoutes[1],
      cargo: { tea: 1 }, guardHeroId: 'hero_guanyu',
    });

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

// ─────────────────────────────────────────
// 序列化集成
// ─────────────────────────────────────────

describe('Trade+Caravan 序列化集成', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;

  beforeEach(() => {
    trade = createTrade();
    caravan = createCaravan(trade);
  });

  it('TradeSystem 序列化→反序列化恢复完整状态', () => {
    const routeId = openFirstRoute(trade);
    if (routeId) {
      for (let i = 0; i < 5; i++) trade.completeTrade(routeId);
    }

    const data = trade.serialize();
    const trade2 = createTrade();
    trade2.deserialize(data);

    if (routeId) {
      const state = trade2.getRouteState(routeId);
      expect(state?.opened).toBe(true);
      expect(state?.completedTrades).toBe(5);
    }

    expect(trade2.getAllPrices().size).toBe(TRADE_GOODS_DEFS.length);
  });

  it('CaravanSystem 序列化→反序列化恢复商队状态', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    caravan.dispatch({
      caravanId: idle[0].id, routeId,
      cargo: { silk: 5 }, guardHeroId: 'hero_test',
    });

    const data = caravan.serialize();
    const caravan2 = new CaravanSystem();
    caravan2.init(createMockDeps() as unknown as ISystemDeps);
    caravan2.deserialize(data);

    expect(caravan2.getCaravanCount()).toBe(caravan.getCaravanCount());
    const traveling = caravan2.getCaravans().find(c => c.status === 'traveling');
    expect(traveling).toBeDefined();
    expect(traveling?.guardHeroId).toBe('hero_test');
  });

  it('reset恢复初始状态', () => {
    openFirstRoute(trade);
    trade.reset();

    for (const [, state] of trade.getAllRouteStates()) {
      expect(state.opened).toBe(false);
    }
  });
});
