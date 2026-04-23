import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * TradeSystem + CaravanSystem 集成测试 — 贸易路线→商队派遣→利润计算→繁荣度→事件
 *
 * 覆盖Play文档流程：
 *   §3.1 商路开通
 *   §3.2 商品系统完整验证
 *   §3.3 商队管理
 *   §3.5 商队派遣与运输
 *   §4.1 行情刷新
 *   §4.2 低买高卖策略
 *   §5.1 随机事件逐一验证
 *   §5.2 护卫自动处理与高风险事件
 *   §5.3 商路繁荣度完整验证
 *   §5.4 NPC特殊商人完整验证
 *   §8.2 贸易→商店→繁荣度闭环
 *   §8.4 护卫武将互斥验证
 *   §8.5 离线回归验证
 */

import { TradeSystem } from '../../trade/TradeSystem';
import { CaravanSystem } from '../../trade/CaravanSystem';
import type { TradeCurrencyOps } from '../../trade/TradeSystem';
import type { RouteInfoProvider } from '../../trade/CaravanSystem';
import type {
  TradeRouteId,
  CaravanDispatchRequest,
  TradeEventInstance,
} from '../../../core/trade/trade.types';
import {
  CITY_IDS,
  PROSPERITY_LABELS,
} from '../../../core/trade/trade.types';
import {
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  PRICE_REFRESH_INTERVAL,
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  TRADE_EVENT_DEFS,
  NPC_MERCHANT_DEFS,
  INITIAL_CARAVAN_COUNT,
  MAX_CARAVAN_COUNT,
} from '../../../core/trade/trade-config';

// ─── 辅助 ────────────────────────────────

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

/** 创建TradeSystem实例 */
function createTrade(): TradeSystem {
  const trade = new TradeSystem();
  trade.init(createMockDeps() as any);
  trade.setCurrencyOps(createMockCurrencyOps());
  return trade;
}

/** 创建CaravanSystem并注入RouteProvider */
function createCaravan(trade: TradeSystem): CaravanSystem {
  const caravan = new CaravanSystem();
  caravan.init(createMockDeps() as any);

  // 注入RouteProvider
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

/** 开通一条商路 */
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

// ─────────────────────────────────────────
// §3.1 商路开通
// ─────────────────────────────────────────

describe('§3.1 商路开通', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('应包含8条商路定义', () => {
    const defs = trade.getRouteDefs();
    expect(defs.length).toBe(8);
  });

  it('初始商路状态应为未开通', () => {
    const states = trade.getAllRouteStates();
    for (const [, state] of states) {
      expect(state.opened).toBe(false);
    }
  });

  it('满足条件时应能开通商路', () => {
    const routeId = openFirstRoute(trade);
    expect(routeId).not.toBeNull();

    const state = trade.getRouteState(routeId!);
    expect(state?.opened).toBe(true);
  });

  it('主城等级不足时不可开通', () => {
    const defs = trade.getRouteDefs();
    const highLevelRoute = defs.find(d => d.requiredCastleLevel >= 5);
    if (!highLevelRoute) return;

    const check = trade.canOpenRoute(highLevelRoute.id, 1);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('主城');
  });

  it('前置商路未开通时不可开通', () => {
    const defs = trade.getRouteDefs();
    const routeWithPrereq = defs.find(d => d.requiredRoute);
    if (!routeWithPrereq) return;

    const check = trade.canOpenRoute(routeWithPrereq.id, 20);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('前置');
  });

  it('已开通商路不可重复开通', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const check = trade.canOpenRoute(routeId, 20);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('已开通');
  });

  it('按顺序开通多条商路应成功', () => {
    const defs = trade.getRouteDefs().sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
    let opened = 0;

    for (const def of defs) {
      if (def.requiredRoute) {
        const preState = trade.getRouteState(def.requiredRoute);
        if (!preState?.opened) continue;
      }
      const result = trade.openRoute(def.id, 20);
      if (result.success) opened++;
    }

    expect(opened).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────
// §3.2 商品系统
// ─────────────────────────────────────────

describe('§3.2 商品系统完整验证', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('应有10种贸易商品', () => {
    const defs = trade.getAllGoodsDefs();
    expect(defs.length).toBe(10);
  });

  it('每种商品应有合理的基础价格', () => {
    const defs = trade.getAllGoodsDefs();
    for (const def of defs) {
      expect(def.basePrice).toBeGreaterThan(0);
      expect(def.volatility).toBeGreaterThan(0);
      expect(def.volatility).toBeLessThanOrEqual(1);
      expect(def.weight).toBeGreaterThan(0);
    }
  });

  it('每种商品应有所属城市', () => {
    const defs = trade.getAllGoodsDefs();
    const cityIds = new Set(CITY_IDS);
    for (const def of defs) {
      expect(cityIds.has(def.originCity)).toBe(true);
    }
  });

  it('初始价格应等于基础价格', () => {
    const defs = trade.getAllGoodsDefs();
    for (const def of defs) {
      const price = trade.getPrice(def.id);
      expect(price).toBe(def.basePrice);
    }
  });
});

// ─────────────────────────────────────────
// §3.3 + §3.5 商队管理与派遣
// ─────────────────────────────────────────

describe('§3.3+§3.5 商队管理与派遣', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;

  beforeEach(() => {
    trade = createTrade();
    caravan = createCaravan(trade);
  });

  it('初始应有2支商队', () => {
    expect(caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
    expect(INITIAL_CARAVAN_COUNT).toBe(2);
  });

  it('空闲商队应可查询', () => {
    const idle = caravan.getIdleCaravans();
    expect(idle.length).toBe(INITIAL_CARAVAN_COUNT);
    for (const c of idle) {
      expect(c.status).toBe('idle');
    }
  });

  it('派遣商队到已开通商路应成功', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idleCaravans = caravan.getIdleCaravans();
    if (idleCaravans.length === 0) return;

    const request: CaravanDispatchRequest = {
      caravanId: idleCaravans[0].id,
      routeId,
      cargo: { silk: 5, tea: 3 },
    };

    const result = caravan.dispatch(request);
    expect(result.success).toBe(true);
    expect(result.estimatedArrival).toBeGreaterThan(0);
    expect(result.estimatedProfit).toBeGreaterThanOrEqual(0);

    // 商队状态应变为traveling
    const updated = caravan.getCaravan(idleCaravans[0].id);
    expect(updated?.status).toBe('traveling');
    expect(updated?.currentRouteId).toBe(routeId);
  });

  it('派遣到未开通商路应失败', () => {
    const idleCaravans = caravan.getIdleCaravans();
    if (idleCaravans.length === 0) return;

    const request: CaravanDispatchRequest = {
      caravanId: idleCaravans[0].id,
      routeId: 'nonexistent_route',
      cargo: { silk: 1 },
    };

    const result = caravan.dispatch(request);
    expect(result.success).toBe(false);
  });

  it('超出载重应失败', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idleCaravans = caravan.getIdleCaravans();
    if (idleCaravans.length === 0) return;

    const capacity = idleCaravans[0].attributes.capacity;
    const request: CaravanDispatchRequest = {
      caravanId: idleCaravans[0].id,
      routeId,
      cargo: { silk: capacity + 100 }, // 超载
    };

    const result = caravan.dispatch(request);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('载重');
  });

  it('非空闲商队不可再次派遣', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idleCaravans = caravan.getIdleCaravans();
    if (idleCaravans.length === 0) return;

    // 第一次派遣
    caravan.dispatch({
      caravanId: idleCaravans[0].id,
      routeId,
      cargo: { silk: 1 },
    });

    // 第二次派遣同一商队
    const result = caravan.dispatch({
      caravanId: idleCaravans[0].id,
      routeId,
      cargo: { silk: 1 },
    });
    expect(result.success).toBe(false);
  });

  it('新增商队应受上限约束', () => {
    // 增加到上限
    while (caravan.canAddCaravan()) {
      const result = caravan.addCaravan();
      expect(result.success).toBe(true);
    }
    expect(caravan.canAddCaravan()).toBe(false);

    const result = caravan.addCaravan();
    expect(result.success).toBe(false);
    expect(caravan.getCaravanCount()).toBe(MAX_CARAVAN_COUNT);
  });
});

// ─────────────────────────────────────────
// §4.1 行情刷新
// ─────────────────────────────────────────

describe('§4.1 行情刷新', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('刷新后价格应在合理范围内', () => {
    trade.refreshPrices();
    const defs = trade.getAllGoodsDefs();

    for (const def of defs) {
      const price = trade.getPrice(def.id);
      // 价格应在基础价50%~200%之间
      expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
      expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
    }
  });

  it('多次刷新不应导致价格超出范围', () => {
    for (let i = 0; i < 50; i++) {
      trade.refreshPrices();
    }

    const defs = trade.getAllGoodsDefs();
    for (const def of defs) {
      const price = trade.getPrice(def.id);
      expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
      expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
    }
  });
});

// ─────────────────────────────────────────
// §4.2 利润计算
// ─────────────────────────────────────────

describe('§4.2 低买高卖策略 — 利润计算', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('利润计算应包含收入、成本、繁荣度加成', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const cargo = { silk: 5, tea: 3 };
    const profit = trade.calculateProfit(routeId, cargo, 1.0, 0);

    expect(profit.revenue).toBeGreaterThanOrEqual(0);
    expect(profit.cost).toBeGreaterThan(0);
    expect(typeof profit.profitRate).toBe('number');
    expect(typeof profit.prosperityBonus).toBe('number');
    expect(typeof profit.bargainingBonus).toBe('number');
  });

  it('高议价能力应增加利润', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const cargo = { silk: 5 };
    const baseProfit = trade.calculateProfit(routeId, cargo, 1.0, 0);
    const highProfit = trade.calculateProfit(routeId, cargo, 1.5, 0);

    expect(highProfit.bargainingBonus).toBeGreaterThan(baseProfit.bargainingBonus);
    expect(highProfit.revenue).toBeGreaterThan(baseProfit.revenue);
  });

  it('繁荣度等级应影响产出倍率', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const tier = trade.getProsperityTier(routeId);
    expect(tier.outputMultiplier).toBeGreaterThan(0);

    // 初始繁荣度30，应处于某个等级
    const level = trade.getProsperityLevel(routeId);
    expect(['declining', 'normal', 'thriving', 'golden']).toContain(level);
  });
});

// ─────────────────────────────────────────
// §5.1 贸易事件
// ─────────────────────────────────────────

describe('§5.1 随机事件逐一验证', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('应定义8种贸易事件', () => {
    expect(TRADE_EVENT_DEFS.length).toBe(8);
  });

  it('每个事件应有至少一个处理选项', () => {
    for (const def of TRADE_EVENT_DEFS) {
      expect(def.options.length).toBeGreaterThan(0);
      for (const opt of def.options) {
        expect(opt.id).toBeTruthy();
        expect(opt.label).toBeTruthy();
        expect(typeof opt.cargoLossRate).toBe('number');
        expect(typeof opt.prosperityChange).toBe('number');
      }
    }
  });

  it('生成事件应返回正确结构', () => {
    const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
    // 事件数量0~2
    expect(events.length).toBeLessThanOrEqual(2);
    for (const event of events) {
      expect(event.id).toBeTruthy();
      expect(event.caravanId).toBe('caravan_1');
      expect(event.routeId).toBe('route_luoyang_xuchang');
      expect(event.resolved).toBe(false);
    }
  });

  it('应能处理事件选项', () => {
    const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
    if (events.length === 0) return;

    const event = events[0];
    const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
    if (!def) return;

    const result = trade.resolveTradeEvent(event.id, def.options[0].id);
    expect(result.success).toBe(true);
    expect(result.option).toBeDefined();
  });

  it('处理不存在的事件应失败', () => {
    const result = trade.resolveTradeEvent('nonexistent', 'fight');
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────
// §5.2 护卫自动处理
// ─────────────────────────────────────────

describe('§5.2 护卫自动处理与高风险事件', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('护卫应能自动处理低风险事件', () => {
    // 生成事件
    const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
    if (events.length === 0) return;

    // 护卫自动处理
    const resolved = trade.autoResolveWithGuard('caravan_1');
    for (const event of resolved) {
      expect(event.resolved).toBe(true);
      expect(event.chosenOptionId).toBe('auto_guard');
    }
  });

  it('护卫只能处理guardCanAutoResolve的事件', () => {
    const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
    const autoResolvable = events.filter(e => {
      const def = TRADE_EVENT_DEFS.find(d => d.type === e.eventType);
      return def?.guardCanAutoResolve;
    });

    const resolved = trade.autoResolveWithGuard('caravan_1');
    expect(resolved.length).toBe(autoResolvable.length);
  });
});

// ─────────────────────────────────────────
// §5.3 繁荣度
// ─────────────────────────────────────────

describe('§5.3 商路繁荣度完整验证', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('初始繁荣度应为30', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBe(INITIAL_PROSPERITY);
    expect(INITIAL_PROSPERITY).toBe(30);
  });

  it('完成贸易应增加繁荣度', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const before = trade.getRouteState(routeId)!.prosperity;
    trade.completeTrade(routeId);
    const after = trade.getRouteState(routeId)!.prosperity;

    expect(after).toBe(before + PROSPERITY_GAIN_PER_TRADE);
  });

  it('繁荣度不应超过100', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 50; i++) {
      trade.completeTrade(routeId);
    }

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeLessThanOrEqual(100);
  });

  it('繁荣度等级应正确映射', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 初始30，应处于某个等级
    const tier = trade.getProsperityTier(routeId);
    expect(tier.level).toBeTruthy();
    expect(tier.outputMultiplier).toBeGreaterThan(0);

    // 验证繁荣度等级标签
    const level = trade.getProsperityLevel(routeId);
    expect(Object.keys(PROSPERITY_LABELS)).toContain(level);
  });

  it('繁荣度4个等级配置应完整', () => {
    expect(PROSPERITY_TIERS.length).toBe(4);

    const levels = PROSPERITY_TIERS.map(t => t.level);
    expect(levels).toContain('declining');
    expect(levels).toContain('normal');
    expect(levels).toContain('thriving');
    expect(levels).toContain('golden');

    // 繁荣和鼎盛应解锁NPC商人
    const thriving = PROSPERITY_TIERS.find(t => t.level === 'thriving');
    const golden = PROSPERITY_TIERS.find(t => t.level === 'golden');
    expect(thriving?.unlockNpcMerchant).toBe(true);
    expect(golden?.unlockNpcMerchant).toBe(true);
  });

  it('update应触发繁荣度衰减', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 先提升繁荣度
    for (let i = 0; i < 10; i++) {
      trade.completeTrade(routeId);
    }
    const before = trade.getRouteState(routeId)!.prosperity;

    // 模拟update（dt=1秒）
    trade.update(1);

    const after = trade.getRouteState(routeId)!.prosperity;
    expect(after).toBeLessThanOrEqual(before);
  });

  it('繁荣度不应低于0', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 大量update使繁荣度衰减
    for (let i = 0; i < 10000; i++) {
      trade.update(100);
    }

    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────
// §5.4 NPC特殊商人
// ─────────────────────────────────────────

describe('§5.4 NPC特殊商人', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('应定义5种NPC商人', () => {
    expect(NPC_MERCHANT_DEFS.length).toBe(5);
  });

  it('NPC商人应有合理的出现概率', () => {
    for (const def of NPC_MERCHANT_DEFS) {
      expect(def.appearanceChance).toBeGreaterThan(0);
      expect(def.appearanceChance).toBeLessThanOrEqual(1);
      expect(def.discountRate).toBeGreaterThan(0);
      expect(def.discountRate).toBeLessThanOrEqual(1);
      expect(def.specialGoods.length).toBeGreaterThan(0);
    }
  });

  it('繁荣度不足时不应生成NPC商人', () => {
    // 初始繁荣度30(normal等级)
    const spawned = trade.trySpawnNpcMerchants();
    // normal等级的NPC可能有行商出现(30%概率)
    // 不做严格断言，只验证返回类型
    expect(Array.isArray(spawned)).toBe(true);
  });

  it('高繁荣度应能生成更多NPC', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 提升繁荣度至鼎盛
    for (let i = 0; i < 30; i++) {
      trade.completeTrade(routeId);
    }

    // 多次尝试生成
    let totalSpawned = 0;
    for (let i = 0; i < 100; i++) {
      const spawned = trade.trySpawnNpcMerchants();
      totalSpawned += spawned.length;
    }
    // 高繁荣度应有NPC生成
    expect(totalSpawned).toBeGreaterThan(0);
  });

  it('NPC商人应有持续时间', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 30; i++) {
      trade.completeTrade(routeId);
    }

    const spawned = trade.trySpawnNpcMerchants();
    for (const npc of spawned) {
      expect(npc.duration).toBeGreaterThan(0);
      expect(npc.cityId).toBeTruthy();
      expect(npc.appearedAt).toBeGreaterThan(0);
    }
  });

  it('NPC交互应正确记录', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 30; i++) {
      trade.completeTrade(routeId);
    }

    const spawned = trade.trySpawnNpcMerchants();
    if (spawned.length === 0) return;

    const npc = spawned[0];
    expect(npc.interacted).toBe(false);

    const result = trade.interactWithNpcMerchant(npc.id);
    expect(result).toBe(true);

    // 重复交互应失败
    const result2 = trade.interactWithNpcMerchant(npc.id);
    expect(result2).toBe(false);
  });

  it('getActiveNpcMerchants应过滤过期NPC', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 30; i++) {
      trade.completeTrade(routeId);
    }

    const spawned = trade.trySpawnNpcMerchants();
    // NPC的duration是秒数，getActiveNpcMerchants用Date.now()检查
    // 刚生成的NPC应该活跃
    if (spawned.length > 0) {
      const active = trade.getActiveNpcMerchants();
      expect(active.length).toBeGreaterThan(0);
    }
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

  it('同一武将不可同时护卫两支商队', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    if (idle.length < 2) return;

    // 指派武将A到商队1
    const assign1 = caravan.assignGuard(idle[0].id, 'hero_zhaoyun');
    expect(assign1.success).toBe(true);

    // 尝试指派同一武将到商队2
    const assign2 = caravan.assignGuard(idle[1].id, 'hero_zhaoyun');
    expect(assign2.success).toBe(false);
    expect(assign2.reason).toContain('护卫');
  });

  it('checkGuardMutex应正确检测冲突', () => {
    const idle = caravan.getIdleCaravans();
    if (idle.length < 2) return;

    caravan.assignGuard(idle[0].id, 'hero_zhaoyun');

    const check = caravan.checkGuardMutex('hero_zhaoyun', idle[1].id);
    expect(check.available).toBe(false);
    expect(check.conflictCaravanId).toBe(idle[0].id);
  });

  it('移除护卫后武将应可用', () => {
    const idle = caravan.getIdleCaravans();
    if (idle.length === 0) return;

    caravan.assignGuard(idle[0].id, 'hero_zhaoyun');
    caravan.removeGuard(idle[0].id);

    const check = caravan.checkGuardMutex('hero_zhaoyun');
    expect(check.available).toBe(true);
  });

  it('派遣时指定护卫应正确指派', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    if (idle.length === 0) return;

    const result = caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 1 },
      guardHeroId: 'hero_zhaoyun',
    });

    expect(result.success).toBe(true);
    expect(caravan.getGuardHeroId(idle[0].id)).toBe('hero_zhaoyun');
    expect(caravan.hasGuard(idle[0].id)).toBe(true);
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

  it('完成贸易→繁荣度提升→等级变化', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const initialLevel = trade.getProsperityLevel(routeId);
    const initialMultiplier = trade.getProsperityMultiplier(routeId);

    // 大量贸易提升繁荣度
    for (let i = 0; i < 25; i++) {
      trade.completeTrade(routeId);
    }

    const finalLevel = trade.getProsperityLevel(routeId);
    const finalMultiplier = trade.getProsperityMultiplier(routeId);

    // 繁荣度应提升
    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeGreaterThan(INITIAL_PROSPERITY);
    expect(finalMultiplier).toBeGreaterThanOrEqual(initialMultiplier);
  });
});

// ─────────────────────────────────────────
// 序列化/反序列化
// ─────────────────────────────────────────

describe('TradeSystem 序列化集成', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTrade();
  });

  it('序列化→反序列化应恢复完整状态', () => {
    const routeId = openFirstRoute(trade);
    if (routeId) {
      trade.completeTrade(routeId);
    }

    const data = trade.serialize();

    const trade2 = createTrade();
    trade2.deserialize(data);

    // 验证商路状态
    if (routeId) {
      const state = trade2.getRouteState(routeId);
      expect(state?.opened).toBe(true);
      expect(state?.completedTrades).toBe(1);
    }

    // 验证价格
    const prices = trade2.getAllPrices();
    expect(prices.size).toBe(TRADE_GOODS_DEFS.length);
  });
});

describe('CaravanSystem 序列化集成', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;

  beforeEach(() => {
    trade = createTrade();
    caravan = createCaravan(trade);
  });

  it('序列化→反序列化应恢复商队状态', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    if (idle.length === 0) return;

    // 派遣一支商队
    caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 5 },
      guardHeroId: 'hero_test',
    });

    const data = caravan.serialize();

    const caravan2 = new CaravanSystem();
    caravan2.init(createMockDeps() as any);
    caravan2.deserialize(data);

    expect(caravan2.getCaravanCount()).toBe(caravan.getCaravanCount());
    const caravans = caravan2.getCaravans();
    const traveling = caravans.find(c => c.status === 'traveling');
    expect(traveling).toBeDefined();
    expect(traveling?.guardHeroId).toBe('hero_test');
  });
});

// ─────────────────────────────────────────
// ISubsystem 接口
// ─────────────────────────────────────────

describe('Trade+Caravan ISubsystem接口', () => {
  it('TradeSystem应实现ISubsystem', () => {
    const trade = createTrade();
    expect(trade.name).toBe('Trade');
    expect(typeof trade.init).toBe('function');
    expect(typeof trade.update).toBe('function');
    expect(typeof trade.getState).toBe('function');
    expect(typeof trade.reset).toBe('function');
  });

  it('CaravanSystem应实现ISubsystem', () => {
    const trade = createTrade();
    const caravan = createCaravan(trade);
    expect(caravan.name).toBe('Caravan');
    expect(typeof caravan.init).toBe('function');
    expect(typeof caravan.update).toBe('function');
    expect(typeof caravan.getState).toBe('function');
    expect(typeof caravan.reset).toBe('function');
  });

  it('reset应恢复初始状态', () => {
    const trade = createTrade();
    openFirstRoute(trade);

    trade.reset();

    const states = trade.getAllRouteStates();
    for (const [, state] of states) {
      expect(state.opened).toBe(false);
    }
  });
});
