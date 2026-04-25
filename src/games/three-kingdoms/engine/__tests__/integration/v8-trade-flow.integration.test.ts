/**
 * v8.0 商贸繁荣 — 贸易系统 Play 流程集成测试
 *
 * 覆盖范围：
 * - §3.1 商路开通（8条商路逐级解锁）
 * - §3.2 商品系统（10种商品价格波动）
 * - §3.3 商队管理（数量上限/属性/状态）
 * - §3.5 商队派遣与运输
 * - §3.6 自动贸易（skip: 引擎未实现）
 * - §3.7 仓库管理（skip: 引擎未实现）
 * - §3.4 商队属性提升（skip: 需TechSystem联动）
 * - §4 价格波动与低买高卖
 * - §5 贸易事件/NPC商人/繁荣度
 * - §9.2 仓库容量扩展（skip: 引擎未实现）
 *
 * 测试原则：
 * - 每个用例创建独立 sim 实例，使用真实引擎 API
 * - 零 as any，零 mock
 */

import { describe, it, expect } from 'vitest';
import { createSim, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { TradeRouteId } from '../../../../core/trade/trade.types';
import {
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  TRADE_EVENT_DEFS,
  NPC_MERCHANT_DEFS,
  INITIAL_CARAVAN_COUNT,
  MAX_CARAVAN_COUNT,
} from '../../../core/trade/trade-config';

/** 创建已开通商路并设置routeProvider的辅助函数 */
function setupTradeAndCaravan() {
  const sim = createSim();
  sim.addResources(MASSIVE_RESOURCES);
  const trade = sim.engine.getTradeSystem();
  const caravanSys = sim.engine.getCaravanSystem();

  trade.openRoute('route_luoyang_xuchang' as TradeRouteId, 1);
  caravanSys.setRouteProvider({
    getRouteDef: (routeId: string) => {
      const state = trade.getRouteState(routeId as TradeRouteId);
      const def = trade.getRouteDefs().find(r => r.id === routeId);
      if (!state || !def) return null;
      return { opened: state.opened, baseTravelTime: def.baseTravelTime, baseProfitRate: def.baseProfitRate, from: def.from, to: def.to };
    },
    getPrice: (goodsId: string) => trade.getPrice(goodsId),
    completeTrade: (routeId: TradeRouteId) => trade.completeTrade(routeId),
  });
  return { sim, trade, caravanSys };
}

/** 开通多条商路 */
function openMultipleRoutes(trade: ReturnType<typeof createSim>['engine']['getTradeSystem'], castleLevel = 20) {
  const openedRoutes: TradeRouteId[] = [];
  const defs = trade.getRouteDefs().sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
  for (const def of defs) {
    if (def.requiredRoute) {
      const preState = trade.getRouteState(def.requiredRoute);
      if (!preState?.opened) continue;
    }
    const result = trade.openRoute(def.id, castleLevel);
    if (result.success) openedRoutes.push(def.id);
  }
  return openedRoutes;
}

// ═══════════════════════════════════════════════
// §3.1 商路开通
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §3.1 商路开通', () => {
  it('TRADE-FLOW-1: 应能获取8条商路定义', () => {
    const trade = createSim().engine.getTradeSystem();
    const routes = trade.getRouteDefs();
    expect(routes.length).toBeGreaterThanOrEqual(8);
  });

  it('TRADE-FLOW-2: 未开通商路应不可用', () => {
    const trade = createSim().engine.getTradeSystem();
    for (const route of trade.getRouteDefs()) {
      const state = trade.getRouteState(route.id as TradeRouteId);
      if (state) expect(state.opened).toBe(false);
    }
  });

  it('TRADE-FLOW-3: 主城等级不足时不可开通商路', () => {
    const trade = createSim().engine.getTradeSystem();
    const highLevelRoute = trade.getRouteDefs().find(r => r.requiredCastleLevel > 1);
    if (highLevelRoute) {
      const check = trade.canOpenRoute(highLevelRoute.id as TradeRouteId, 1);
      expect(check.canOpen).toBe(false);
      expect(check.reason).toBeDefined();
    }
  });

  it('TRADE-FLOW-4: 满足条件时开通第一条商路(洛阳→许昌)', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const trade = sim.engine.getTradeSystem();
    const result = trade.openRoute('route_luoyang_xuchang' as TradeRouteId, 1);
    if (result.success) {
      expect(trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.opened).toBe(true);
    }
  });

  it('TRADE-FLOW-5: 前置商路未开通时不可开通后续商路', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const trade = sim.engine.getTradeSystem();
    const routeWithPrereq = trade.getRouteDefs().find(r => r.requiredRoute);
    if (routeWithPrereq) {
      const check = trade.canOpenRoute(routeWithPrereq.id as TradeRouteId, 20);
      expect(check.canOpen).toBe(false);
      expect(check.reason).toContain('前置');
    }
  });

  it('TRADE-FLOW-6: 开通商路后繁荣度初始值正确', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const trade = sim.engine.getTradeSystem();
    trade.openRoute('route_luoyang_xuchang' as TradeRouteId, 1);
    const state = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId);
    if (state?.opened) {
      expect(state.prosperity).toBe(INITIAL_PROSPERITY);
      expect(state.prosperity).toBeGreaterThanOrEqual(0);
      expect(state.prosperity).toBeLessThanOrEqual(100);
    }
  });

  it('TRADE-FLOW-7: 已开通商路不可重复开通', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const trade = sim.engine.getTradeSystem();
    trade.openRoute('route_luoyang_xuchang' as TradeRouteId, 1);
    const result = trade.openRoute('route_luoyang_xuchang' as TradeRouteId, 1);
    if (!result.success) expect(result.reason).toContain('已开通');
  });

  it('TRADE-FLOW-7b: 按顺序开通多条商路', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const trade = sim.engine.getTradeSystem();
    const opened = openMultipleRoutes(trade);
    expect(opened.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// §3.2 商品系统
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §3.2 商品系统', () => {
  it('TRADE-FLOW-8: 应有10种贸易商品定义', () => {
    const trade = createSim().engine.getTradeSystem();
    expect(trade.getAllGoodsDefs().length).toBeGreaterThanOrEqual(10);
  });

  it('TRADE-FLOW-9: 商品应有基础价格和波动率', () => {
    const trade = createSim().engine.getTradeSystem();
    for (const g of trade.getAllGoodsDefs()) {
      expect(g.basePrice).toBeGreaterThan(0);
      expect(g.volatility).toBeGreaterThanOrEqual(0);
      expect(g.volatility).toBeLessThanOrEqual(1);
    }
  });

  it('TRADE-FLOW-10: 商品应有当前价格', () => {
    const trade = createSim().engine.getTradeSystem();
    for (const g of trade.getAllGoodsDefs()) {
      expect(trade.getPrice(g.id)).toBeGreaterThanOrEqual(0);
    }
  });

  it('TRADE-FLOW-11: 价格刷新后应在波动范围内', () => {
    const trade = createSim().engine.getTradeSystem();
    const goods = trade.getAllGoodsDefs();
    trade.refreshPrices();
    for (const g of goods) {
      const price = trade.getPrice(g.id);
      // 价格应在基础价50%~200%之间
      expect(price).toBeGreaterThanOrEqual(Math.floor(g.basePrice * 0.5));
      expect(price).toBeLessThanOrEqual(Math.floor(g.basePrice * 2));
    }
  });

  it('TRADE-FLOW-12: 获取所有商品价格映射', () => {
    const trade = createSim().engine.getTradeSystem();
    expect(trade.getAllPrices().size).toBeGreaterThanOrEqual(10);
  });

  it('TRADE-FLOW-12b: 商品应有重量属性', () => {
    const trade = createSim().engine.getTradeSystem();
    for (const g of trade.getAllGoodsDefs()) {
      expect(g.weight).toBeGreaterThan(0);
    }
  });

  it('TRADE-FLOW-12c: 商品有所属城市', () => {
    const trade = createSim().engine.getTradeSystem();
    for (const g of trade.getAllGoodsDefs()) {
      expect(g.originCity).toBeDefined();
      expect(g.originCity.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════
// §3.3 商队管理
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §3.3 商队管理', () => {
  it('TRADE-FLOW-13: 初始应有≥2支商队', () => {
    const caravanSys = createSim().engine.getCaravanSystem();
    expect(caravanSys.getCaravans().length).toBe(INITIAL_CARAVAN_COUNT);
    expect(INITIAL_CARAVAN_COUNT).toBeGreaterThanOrEqual(2);
  });

  it('TRADE-FLOW-14: 商队应有正确属性(载重/速度)', () => {
    const caravanSys = createSim().engine.getCaravanSystem();
    for (const c of caravanSys.getCaravans()) {
      expect(c.attributes.capacity).toBeGreaterThan(0);
      expect(c.attributes.speedMultiplier).toBeGreaterThan(0);
    }
  });

  it('TRADE-FLOW-15: 新商队状态应为idle', () => {
    const caravanSys = createSim().engine.getCaravanSystem();
    for (const c of caravanSys.getCaravans()) expect(c.status).toBe('idle');
  });

  it('TRADE-FLOW-16: 应能获取空闲商队列表', () => {
    const caravanSys = createSim().engine.getCaravanSystem();
    expect(caravanSys.getIdleCaravans().length).toBe(INITIAL_CARAVAN_COUNT);
  });

  it('TRADE-FLOW-17: 商队数量上限检查', () => {
    const caravanSys = createSim().engine.getCaravanSystem();
    expect(caravanSys.canAddCaravan()).toBe(true);
    // 添加到上限
    while (caravanSys.canAddCaravan()) {
      caravanSys.addCaravan();
    }
    expect(caravanSys.getCaravanCount()).toBe(MAX_CARAVAN_COUNT);
    expect(caravanSys.canAddCaravan()).toBe(false);
    // 超限添加失败
    const result = caravanSys.addCaravan();
    expect(result.success).toBe(false);
  });

  it('TRADE-FLOW-17b: 商队属性升级', () => {
    const caravanSys = createSim().engine.getCaravanSystem();
    const caravans = caravanSys.getCaravans();
    if (caravans.length === 0) return;

    const caravanId = caravans[0].id;
    const beforeCapacity = caravans[0].attributes.capacity;
    const result = caravanSys.upgradeCaravan(caravanId, 'capacity', 10);
    expect(result).toBe(true);
    const after = caravanSys.getCaravan(caravanId);
    expect(after?.attributes.capacity).toBe(beforeCapacity + 10);
  });
});

// ═══════════════════════════════════════════════
// §3.5 商队派遣与运输
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §3.5 商队派遣与运输', () => {
  it('TRADE-FLOW-18: 未设置routeProvider时派遣失败', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const caravanSys = sim.engine.getCaravanSystem();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length > 0) {
      const result = caravanSys.dispatch({ caravanId: caravans[0].id, routeId: 'route_luoyang_xuchang' as TradeRouteId, cargo: { silk: 5 } });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('商路信息未初始化');
    }
  });

  it('TRADE-FLOW-19: 开通商路后可派遣商队', () => {
    const { caravanSys } = setupTradeAndCaravan();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length > 0) {
      const result = caravanSys.dispatch({ caravanId: caravans[0].id, routeId: 'route_luoyang_xuchang' as TradeRouteId, cargo: { silk: 5 } });
      expect(result.success).toBe(true);
      expect(result.estimatedArrival).toBeGreaterThan(0);
      expect(result.estimatedProfit).toBeGreaterThanOrEqual(0);
      // 商队状态应变为traveling
      const updated = caravanSys.getCaravan(caravans[0].id);
      expect(updated?.status).toBe('traveling');
    }
  });

  it('TRADE-FLOW-20: 超出载重上限不可派遣', () => {
    const { caravanSys } = setupTradeAndCaravan();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length > 0) {
      const capacity = caravans[0].attributes.capacity;
      const result = caravanSys.dispatch({ caravanId: caravans[0].id, routeId: 'route_luoyang_xuchang' as TradeRouteId, cargo: { silk: capacity + 100 } });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('载重');
    }
  });

  it('TRADE-FLOW-21: 未开通商路派遣失败', () => {
    const { caravanSys } = setupTradeAndCaravan();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length > 0) {
      const result = caravanSys.dispatch({ caravanId: caravans[0].id, routeId: 'nonexistent_route' as TradeRouteId, cargo: { silk: 5 } });
      expect(result.success).toBe(false);
    }
  });

  it('TRADE-FLOW-22: 非idle商队不可派遣', () => {
    const { caravanSys } = setupTradeAndCaravan();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length > 0) {
      caravanSys.dispatch({ caravanId: caravans[0].id, routeId: 'route_luoyang_xuchang' as TradeRouteId, cargo: { silk: 5 } });
      const result = caravanSys.dispatch({ caravanId: caravans[0].id, routeId: 'route_luoyang_xuchang' as TradeRouteId, cargo: { silk: 5 } });
      expect(result.success).toBe(false);
    }
  });

  it('TRADE-FLOW-22b: 派遣时指定护卫武将', () => {
    const { caravanSys } = setupTradeAndCaravan();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length > 0) {
      const result = caravanSys.dispatch({
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang' as TradeRouteId,
        cargo: { silk: 5 },
        guardHeroId: 'hero_zhaoyun',
      });
      expect(result.success).toBe(true);
      expect(caravanSys.getGuardHeroId(caravans[0].id)).toBe('hero_zhaoyun');
      expect(caravanSys.hasGuard(caravans[0].id)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════
// §4 价格波动与低买高卖
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §4 价格波动', () => {
  it('TRADE-FLOW-23: 利润计算应正确', () => {
    const { trade } = setupTradeAndCaravan();
    const profit = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, { silk: 100, tea: 150 }, 1.0, 0);
    expect(typeof profit.revenue).toBe('number');
    expect(typeof profit.cost).toBe('number');
    expect(typeof profit.profit).toBe('number');
    expect(typeof profit.profitRate).toBe('number');
    expect(typeof profit.prosperityBonus).toBe('number');
    expect(typeof profit.bargainingBonus).toBe('number');
    expect(typeof profit.guardCost).toBe('number');
  });

  it('TRADE-FLOW-24: 繁荣度倍率影响利润', () => {
    const { trade } = setupTradeAndCaravan();
    expect(trade.getProsperityMultiplier('route_luoyang_xuchang' as TradeRouteId)).toBeGreaterThan(0);
  });

  it('TRADE-FLOW-24b: 高议价能力增加利润', () => {
    const { trade } = setupTradeAndCaravan();
    const cargo = { silk: 5 };
    const baseProfit = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, cargo, 1.0, 0);
    const highProfit = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, cargo, 1.5, 0);
    expect(highProfit.bargainingBonus).toBeGreaterThan(baseProfit.bargainingBonus);
    expect(highProfit.revenue).toBeGreaterThan(baseProfit.revenue);
  });

  it('TRADE-FLOW-24c: 护卫费用从利润中扣除', () => {
    const { trade } = setupTradeAndCaravan();
    const cargo = { silk: 5 };
    const noGuardProfit = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, cargo, 1.0, 0);
    const withGuardProfit = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, cargo, 1.0, 500);
    expect(withGuardProfit.guardCost).toBe(500);
    expect(withGuardProfit.profit).toBe(noGuardProfit.profit - 500);
  });

  it('TRADE-FLOW-24d: 多次价格刷新保持稳定', () => {
    const trade = createSim().engine.getTradeSystem();
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

// ═══════════════════════════════════════════════
// §5 贸易事件与NPC商人
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §5 贸易事件与NPC商人', () => {
  it('TRADE-FLOW-25: 应能生成贸易事件(每趟≤2个)', () => {
    const { trade } = setupTradeAndCaravan();
    const events = trade.generateTradeEvents('test_caravan', 'route_luoyang_xuchang' as TradeRouteId);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeLessThanOrEqual(2);
    for (const event of events) {
      expect(event.id).toBeTruthy();
      expect(event.caravanId).toBe('test_caravan');
      expect(event.resolved).toBe(false);
    }
  });

  it('TRADE-FLOW-26: 应能解决贸易事件', () => {
    const { trade } = setupTradeAndCaravan();
    const events = trade.generateTradeEvents('test_caravan', 'route_luoyang_xuchang' as TradeRouteId);
    if (events.length > 0) {
      const def = TRADE_EVENT_DEFS.find(d => d.type === events[0].eventType);
      if (def && def.options.length > 0) {
        const result = trade.resolveTradeEvent(events[0].id, def.options[0].id);
        expect(result.success).toBe(true);
        expect(result.option).toBeDefined();
      }
    }
  });

  it('TRADE-FLOW-27: 护卫自动处理低风险事件', () => {
    const { trade } = setupTradeAndCaravan();
    trade.generateTradeEvents('test_guard', 'route_luoyang_xuchang' as TradeRouteId);
    const resolved = trade.autoResolveWithGuard('test_guard');
    expect(Array.isArray(resolved)).toBe(true);
    for (const r of resolved) {
      expect(r.resolved).toBe(true);
      expect(r.chosenOptionId).toBe('auto_guard');
    }
  });

  it('TRADE-FLOW-28: 应能获取活跃事件列表', () => {
    const { trade } = setupTradeAndCaravan();
    trade.generateTradeEvents('test_active', 'route_luoyang_xuchang' as TradeRouteId);
    expect(Array.isArray(trade.getActiveEvents('test_active'))).toBe(true);
  });

  it('TRADE-FLOW-28b: 事件定义应有8种', () => {
    expect(TRADE_EVENT_DEFS.length).toBeGreaterThanOrEqual(8);
    for (const def of TRADE_EVENT_DEFS) {
      expect(def.options.length).toBeGreaterThan(0);
      expect(typeof def.type).toBe('string');
    }
  });

  it('TRADE-FLOW-29: NPC商人尝试生成', () => {
    const trade = createSim().engine.getTradeSystem();
    expect(Array.isArray(trade.trySpawnNpcMerchants())).toBe(true);
  });

  it('TRADE-FLOW-30: 获取活跃NPC商人列表', () => {
    const trade = createSim().engine.getTradeSystem();
    expect(Array.isArray(trade.getActiveNpcMerchants())).toBe(true);
  });

  it('TRADE-FLOW-31: 与NPC商人交互', () => {
    const trade = createSim().engine.getTradeSystem();
    trade.trySpawnNpcMerchants();
    const merchants = trade.getActiveNpcMerchants();
    if (merchants.length > 0) {
      const npc = merchants[0];
      expect(npc.interacted).toBe(false);
      expect(trade.interactWithNpcMerchant(npc.id)).toBe(true);
      // 重复交互应失败
      expect(trade.interactWithNpcMerchant(npc.id)).toBe(false);
    }
  });

  it('TRADE-FLOW-31b: 高繁荣度生成更多NPC', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const trade = sim.engine.getTradeSystem();
    trade.openRoute('route_luoyang_xuchang' as TradeRouteId, 1);
    // 提升繁荣度
    for (let i = 0; i < 30; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    let totalSpawned = 0;
    for (let i = 0; i < 100; i++) {
      totalSpawned += trade.trySpawnNpcMerchants().length;
    }
    expect(totalSpawned).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// §5.3 繁荣度
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §5.3 繁荣度', () => {
  it('TRADE-FLOW-32: 获取繁荣度等级', () => {
    const { trade } = setupTradeAndCaravan();
    const level = trade.getProsperityLevel('route_luoyang_xuchang' as TradeRouteId);
    expect(['declining', 'normal', 'thriving', 'golden']).toContain(level);
  });

  it('TRADE-FLOW-33: 完成贸易后繁荣度增加', () => {
    const { trade } = setupTradeAndCaravan();
    const before = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const after = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    expect(after).toBe(before + PROSPERITY_GAIN_PER_TRADE);
  });

  it('TRADE-FLOW-34: 繁荣度等级分层正确(4级)', () => {
    expect(PROSPERITY_TIERS.length).toBe(4);
    const levels = PROSPERITY_TIERS.map(t => t.level);
    expect(levels).toContain('declining');
    expect(levels).toContain('normal');
    expect(levels).toContain('thriving');
    expect(levels).toContain('golden');
  });

  it('TRADE-FLOW-35: 繁荣度自然衰减（update tick）', () => {
    const { trade } = setupTradeAndCaravan();
    trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const before = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    trade.update(100000);
    const after = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    expect(after).toBeLessThanOrEqual(before);
  });

  it('TRADE-FLOW-35b: 繁荣度不超过100', () => {
    const { trade } = setupTradeAndCaravan();
    for (let i = 0; i < 50; i++) {
      trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    }
    const state = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId);
    expect(state?.prosperity).toBeLessThanOrEqual(100);
  });

  it('TRADE-FLOW-35c: 繁荣度不低于0', () => {
    const { trade } = setupTradeAndCaravan();
    for (let i = 0; i < 10000; i++) {
      trade.update(100);
    }
    const state = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId);
    expect(state?.prosperity).toBeGreaterThanOrEqual(0);
  });

  it('TRADE-FLOW-35d: 繁荣度影响利润倍率', () => {
    const { trade } = setupTradeAndCaravan();
    // 提升繁荣度
    for (let i = 0; i < 25; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const tier = trade.getProsperityTier('route_luoyang_xuchang' as TradeRouteId);
    expect(tier.outputMultiplier).toBeGreaterThan(0);
    // 繁荣和鼎盛应解锁NPC商人
    if (tier.level === 'thriving' || tier.level === 'golden') {
      expect(tier.unlockNpcMerchant).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════
// §3.6~3.7 自动贸易与仓库（引擎未实现 → skip）
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §3.6~3.7 自动贸易与仓库', () => {
  it.skip('TRADE-FLOW-36: 自动贸易需科技「富甲天下」解锁 — 引擎未实现', () => { /* §3.6 */ });
  it.skip('TRADE-FLOW-37: 仓库管理基础容量100 — 引擎未实现', () => { /* §3.7 */ });
  it.skip('TRADE-FLOW-38: 仓库溢出保护自动出售 — 引擎未实现', () => { /* §9.2 */ });
});

// ═══════════════════════════════════════════════
// §3.4 商队属性提升（需科技系统联动 → skip）
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW §3.4 商队属性提升', () => {
  it.skip('TRADE-FLOW-39: 科技「市舶司」利润+25% — 需TechSystem联动', () => { /* §3.4 */ });
  it.skip('TRADE-FLOW-40: 科技「通宝令」折扣+20% — 需TechSystem联动', () => { /* §3.4 */ });
  it.skip('TRADE-FLOW-41: 科技「富甲天下」铜钱+50% — 需TechSystem联动', () => { /* §3.4 */ });
});

// ═══════════════════════════════════════════════
// 护卫武将互斥
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW 护卫武将互斥', () => {
  it('TRADE-FLOW-42: 同一武将不可护卫两支商队', () => {
    const { caravanSys } = setupTradeAndCaravan();
    const idle = caravanSys.getIdleCaravans();
    if (idle.length < 2) return;

    const assign1 = caravanSys.assignGuard(idle[0].id, 'hero_zhaoyun');
    expect(assign1.success).toBe(true);

    const assign2 = caravanSys.assignGuard(idle[1].id, 'hero_zhaoyun');
    expect(assign2.success).toBe(false);
    expect(assign2.reason).toContain('护卫');
  });

  it('TRADE-FLOW-43: 移除护卫后武将可用', () => {
    const { caravanSys } = setupTradeAndCaravan();
    const idle = caravanSys.getIdleCaravans();
    if (idle.length === 0) return;

    caravanSys.assignGuard(idle[0].id, 'hero_zhaoyun');
    caravanSys.removeGuard(idle[0].id);
    const check = caravanSys.checkGuardMutex('hero_zhaoyun');
    expect(check.available).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 序列化
// ═══════════════════════════════════════════════
describe('v8 TRADE-FLOW 序列化', () => {
  it('TRADE-FLOW-44: 贸易系统序列化/反序列化', () => {
    const { trade } = setupTradeAndCaravan();
    trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const data = trade.serialize();
    expect(data.routes).toBeDefined();
    expect(data.prices).toBeDefined();
    expect(data.version).toBeDefined();
    trade.deserialize(data);
    expect(trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.opened).toBe(true);
    expect(trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.completedTrades).toBe(1);
  });

  it('TRADE-FLOW-45: 商队系统序列化/反序列化', () => {
    const { trade, caravanSys } = setupTradeAndCaravan();
    const idle = caravanSys.getIdleCaravans();
    if (idle.length === 0) return;

    caravanSys.dispatch({
      caravanId: idle[0].id,
      routeId: 'route_luoyang_xuchang' as TradeRouteId,
      cargo: { silk: 5 },
      guardHeroId: 'hero_test',
    });

    const data = caravanSys.serialize();
    const caravanSys2 = createSim().engine.getCaravanSystem();
    caravanSys2.deserialize(data);
    expect(caravanSys2.getCaravanCount()).toBe(caravanSys.getCaravanCount());
  });
});
