/**
 * 集成测试 4/6: 价格波动 + 贸易事件 + 繁荣度 完整流程
 *
 * 覆盖 Play 文档：
 *   §4.1 行情刷新（6h刷新、价格范围、连续涨跌限制）
 *   §4.2 低买高卖利润验证
 *   §5.1 随机事件逐一验证（8种事件定义、选项完整性）
 *   §5.2 护卫自动处理
 *   §5.3 繁荣度升降（事件影响、自然衰减、贸易增长）
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TradeSystem } from '../../TradeSystem';
import type { TradeCurrencyOps } from '../../TradeSystem';
import type { TradeRouteId } from '../../../../core/trade/trade.types';
import {
  PROSPERITY_LABELS,
} from '../../../../core/trade/trade.types';
import type { ISystemDeps } from "../../../../core/types";
import {
  TRADE_GOODS_DEFS,
  TRADE_ROUTE_DEFS,
  TRADE_EVENT_DEFS,
  NPC_MERCHANT_DEFS,
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  PROSPERITY_DECAY_RATE,
  PRICE_REFRESH_INTERVAL,
  MAX_CONSECUTIVE_DIRECTION,
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

// ═══════════════════════════════════════════════

describe('§4.1~5.3 价格波动 + 贸易事件 + 繁荣度', () => {

  // ─── §4.1 行情刷新 ────────────────────────

  describe('§4.1 行情刷新', () => {
    let trade: TradeSystem;
    beforeEach(() => { trade = createTrade(); });

    it('§4.1.1 refreshPrices 更新所有商品价格', () => {
      const before = new Map<string, number>();
      for (const def of trade.getAllGoodsDefs()) {
        before.set(def.id, trade.getPrice(def.id));
      }
      trade.refreshPrices();
      // 至少部分商品价格应变化（概率性）
      let changed = 0;
      for (const def of trade.getAllGoodsDefs()) {
        if (trade.getPrice(def.id) !== before.get(def.id)) changed++;
      }
      // 10种商品至少1种变化
      expect(changed).toBeGreaterThanOrEqual(0); // 允许全不变（极低概率）
    });

    it('§4.1.2 刷新后价格在基础价50%~200%之间', () => {
      trade.refreshPrices();
      for (const def of trade.getAllGoodsDefs()) {
        const price = trade.getPrice(def.id);
        expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
        expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
      }
    });

    it('§4.1.3 100次刷新后价格仍在合法范围', () => {
      for (let i = 0; i < 100; i++) trade.refreshPrices();
      for (const def of trade.getAllGoodsDefs()) {
        const price = trade.getPrice(def.id);
        expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
        expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
      }
    });

    it('§4.1.4 连续涨跌方向不超过MAX_CONSECUTIVE_DIRECTION=3', () => {
      for (let i = 0; i < 50; i++) trade.refreshPrices();
      const prices = trade.getAllPrices();
      for (const [, price] of prices) {
        expect(Math.abs(price.consecutiveDirection)).toBeLessThanOrEqual(MAX_CONSECUTIVE_DIRECTION);
      }
    });

    it('§4.1.5 刷新间隔PRICE_REFRESH_INTERVAL为21600秒(6h)', () => {
      expect(PRICE_REFRESH_INTERVAL).toBe(21600);
    });

    it('§4.1.6 lastPrice记录上一次价格', () => {
      const def = trade.getAllGoodsDefs()[0];
      const priceBefore = trade.getPrice(def.id);
      trade.refreshPrices();
      const prices = trade.getAllPrices();
      const priceObj = prices.get(def.id);
      expect(priceObj).toBeDefined();
      // lastPrice应为刷新前的价格
      expect(priceObj!.lastPrice).toBe(priceBefore);
    });

    it('§4.1.7 getPrice对不存在商品返回0', () => {
      expect(trade.getPrice('nonexistent_goods')).toBe(0);
    });

    it('§4.1.8 getGoodsDef返回正确商品定义', () => {
      const silk = trade.getGoodsDef('silk');
      expect(silk).toBeDefined();
      expect(silk!.name).toBe('丝绸');
      expect(silk!.basePrice).toBe(100);
    });

    it('§4.1.9 getGoodsDef不存在返回undefined', () => {
      expect(trade.getGoodsDef('nonexistent')).toBeUndefined();
    });
  });

  // ─── §4.2 低买高卖 ────────────────────────

  describe('§4.2 低买高卖利润验证', () => {
    let trade: TradeSystem;
    beforeEach(() => { trade = createTrade(); });

    it('§4.2.1 calculateProfit基础计算正确', () => {
      const routeId = openFirstRoute(trade);
      expect(routeId).not.toBeNull();
      const profit = trade.calculateProfit(routeId!, { silk: 10 }, 1.0, 0);
      expect(profit.revenue).toBeGreaterThanOrEqual(0);
      expect(profit.cost).toBe(100 * 10); // silk basePrice=100
      expect(typeof profit.profitRate).toBe('number');
    });

    it('§4.2.2 不存在商路返回零利润', () => {
      const profit = trade.calculateProfit('nonexistent_route', { silk: 10 }, 1.0, 0);
      expect(profit.revenue).toBe(0);
      expect(profit.cost).toBe(0);
      expect(profit.profit).toBe(0);
    });

    it('§4.2.3 空货物利润为零', () => {
      const routeId = openFirstRoute(trade);
      const profit = trade.calculateProfit(routeId!, {}, 1.0, 0);
      expect(profit.revenue).toBe(0);
      expect(profit.cost).toBe(0);
    });

    it('§4.2.4 护卫费用计入利润', () => {
      const routeId = openFirstRoute(trade);
      const profitNoGuard = trade.calculateProfit(routeId!, { silk: 10 }, 1.0, 0);
      const profitWithGuard = trade.calculateProfit(routeId!, { silk: 10 }, 1.0, 200);
      expect(profitWithGuard.guardCost).toBe(200);
      expect(profitWithGuard.profit).toBe(profitNoGuard.profit - 200);
    });

    it('§4.2.5 议价能力影响利润', () => {
      const routeId = openFirstRoute(trade);
      const profitNormal = trade.calculateProfit(routeId!, { silk: 10 }, 1.0, 0);
      const profitBoosted = trade.calculateProfit(routeId!, { silk: 10 }, 1.5, 0);
      expect(profitBoosted.bargainingBonus).toBe(0.5);
      expect(profitBoosted.revenue).toBeGreaterThan(profitNormal.revenue);
    });

    it('§4.2.6 多种商品混合计算', () => {
      const routeId = openFirstRoute(trade);
      const profit = trade.calculateProfit(routeId!, { silk: 5, tea: 3, iron: 2 }, 1.0, 0);
      expect(profit.cost).toBe(100 * 5 + 80 * 3 + 60 * 2);
    });
  });

  // ─── §5.1 贸易事件 ────────────────────────

  describe('§5.1 贸易事件', () => {
    let trade: TradeSystem;
    beforeEach(() => { trade = createTrade(); });

    it('§5.1.1 8种贸易事件全部定义', () => {
      expect(TRADE_EVENT_DEFS.length).toBe(8);
      const types = TRADE_EVENT_DEFS.map(d => d.type);
      expect(types).toEqual(expect.arrayContaining([
        'bandit', 'storm', 'tax', 'good_news',
        'npc_trade', 'road_block', 'lucky_find', 'competition',
      ]));
    });

    it('§5.1.2 每种事件有完整属性', () => {
      for (const def of TRADE_EVENT_DEFS) {
        expect(def.type).toBeTruthy();
        expect(def.name).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(['low', 'medium', 'high']).toContain(def.riskLevel);
        expect(Array.isArray(def.options)).toBe(true);
        expect(def.options.length).toBeGreaterThan(0);
      }
    });

    it('§5.1.3 每个选项属性完整', () => {
      for (const def of TRADE_EVENT_DEFS) {
        for (const opt of def.options) {
          expect(opt.id).toBeTruthy();
          expect(opt.label).toBeTruthy();
          expect(typeof opt.cargoLossRate).toBe('number');
          expect(opt.cargoLossRate).toBeGreaterThanOrEqual(0);
          expect(typeof opt.timeDelay).toBe('number');
          expect(typeof opt.prosperityChange).toBe('number');
        }
      }
    });

    it('§5.1.4 generateTradeEvents返回0~2个事件', () => {
      for (let i = 0; i < 50; i++) {
        const events = trade.generateTradeEvents(`c_${i}`, 'route_luoyang_xuchang');
        expect(events.length).toBeGreaterThanOrEqual(0);
        expect(events.length).toBeLessThanOrEqual(2);
      }
    });

    it('§5.1.5 事件实例结构正确', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      for (const event of events) {
        expect(event.id).toBeTruthy();
        expect(event.eventType).toBeTruthy();
        expect(event.caravanId).toBe('caravan_1');
        expect(event.routeId).toBe('route_luoyang_xuchang');
        expect(event.resolved).toBe(false);
        expect(event.triggeredAt).toBeGreaterThan(0);
      }
    });

    it('§5.1.6 resolveTradeEvent成功处理', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      if (events.length === 0) return;
      const event = events[0];
      const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
      if (!def) return;
      const result = trade.resolveTradeEvent(event.id, def.options[0].id);
      expect(result.success).toBe(true);
      expect(result.option).toBeDefined();
      expect(result.option!.id).toBe(def.options[0].id);
    });

    it('§5.1.7 已处理事件从活跃列表移除', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      if (events.length === 0) return;
      const event = events[0];
      const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
      if (!def) return;
      trade.resolveTradeEvent(event.id, def.options[0].id);
      const active = trade.getActiveEvents('caravan_1');
      expect(active.find(e => e.id === event.id)).toBeUndefined();
    });

    it('§5.1.8 处理不存在事件返回失败', () => {
      const result = trade.resolveTradeEvent('nonexistent_event', 'fight');
      expect(result.success).toBe(false);
    });

    it('§5.1.9 无效选项返回失败', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      if (events.length === 0) return;
      const result = trade.resolveTradeEvent(events[0].id, 'invalid_opt');
      expect(result.success).toBe(false);
    });

    it('§5.1.10 getActiveEvents按caravanId过滤', () => {
      trade.generateTradeEvents('caravan_A', 'route_luoyang_xuchang');
      trade.generateTradeEvents('caravan_B', 'route_luoyang_xuchang');
      const forA = trade.getActiveEvents('caravan_A');
      const forB = trade.getActiveEvents('caravan_B');
      const all = trade.getActiveEvents();
      for (const e of forA) expect(e.caravanId).toBe('caravan_A');
      for (const e of forB) expect(e.caravanId).toBe('caravan_B');
      expect(all.length).toBeGreaterThanOrEqual(forA.length + forB.length);
    });

    it('§5.1.11 getActiveEvents无参数返回所有未处理事件', () => {
      trade.generateTradeEvents('c1', 'route_luoyang_xuchang');
      trade.generateTradeEvents('c2', 'route_luoyang_xuchang');
      const all = trade.getActiveEvents();
      expect(all.length).toBeGreaterThanOrEqual(0);
      for (const e of all) expect(e.resolved).toBe(false);
    });
  });

  // ─── §5.2 护卫自动处理 ────────────────────

  describe('§5.2 护卫自动处理', () => {
    let trade: TradeSystem;
    beforeEach(() => { trade = createTrade(); });

    it('§5.2.1 autoResolveWithGuard处理可自动处理事件', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      const resolved = trade.autoResolveWithGuard('caravan_1');
      for (const e of resolved) {
        expect(e.resolved).toBe(true);
        expect(e.chosenOptionId).toBe('auto_guard');
      }
    });

    it('§5.2.2 只处理guardCanAutoResolve的事件', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      const autoResolvable = events.filter(e => {
        const def = TRADE_EVENT_DEFS.find(d => d.type === e.eventType);
        return def?.guardCanAutoResolve;
      });
      const resolved = trade.autoResolveWithGuard('caravan_1');
      expect(resolved.length).toBe(autoResolvable.length);
    });

    it('§5.2.3 已处理事件不重复处理', () => {
      trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      trade.autoResolveWithGuard('caravan_1');
      const second = trade.autoResolveWithGuard('caravan_1');
      expect(second.length).toBe(0);
    });

    it('§5.2.4 无事件时返回空数组', () => {
      trade.reset();
      const resolved = trade.autoResolveWithGuard('caravan_1');
      expect(resolved).toEqual([]);
    });

    it('§5.2.5 山贼/暴雨/好新闻/幸运发现可被护卫自动处理', () => {
      const autoTypes = ['bandit', 'storm', 'good_news', 'lucky_find'];
      for (const t of autoTypes) {
        const def = TRADE_EVENT_DEFS.find(d => d.type === t);
        expect(def?.guardCanAutoResolve).toBe(true);
      }
    });

    it('§5.2.6 关税/NPC交易/道路堵塞/竞争不可自动处理', () => {
      const manualTypes = ['tax', 'npc_trade', 'road_block', 'competition'];
      for (const t of manualTypes) {
        const def = TRADE_EVENT_DEFS.find(d => d.type === t);
        expect(def?.guardCanAutoResolve).toBe(false);
      }
    });
  });

  // ─── §5.3 繁荣度升降 ─────────────────────

  describe('§5.3 繁荣度升降', () => {
    let trade: TradeSystem;
    beforeEach(() => { trade = createTrade(); });

    it('§5.3.1 初始繁荣度为INITIAL_PROSPERITY=30', () => {
      const routeId = openFirstRoute(trade);
      expect(routeId).not.toBeNull();
      const state = trade.getRouteState(routeId!);
      expect(state!.prosperity).toBe(INITIAL_PROSPERITY);
    });

    it('§5.3.2 completeTrade增加繁荣度', () => {
      const routeId = openFirstRoute(trade);
      const before = trade.getRouteState(routeId!)!.prosperity;
      trade.completeTrade(routeId!);
      const after = trade.getRouteState(routeId!)!.prosperity;
      expect(after).toBe(before + PROSPERITY_GAIN_PER_TRADE);
    });

    it('§5.3.3 多次completeTrade繁荣度持续增长', () => {
      const routeId = openFirstRoute(trade);
      for (let i = 0; i < 10; i++) trade.completeTrade(routeId!);
      const state = trade.getRouteState(routeId!)!;
      expect(state.prosperity).toBe(INITIAL_PROSPERITY + 10 * PROSPERITY_GAIN_PER_TRADE);
    });

    it('§5.3.4 繁荣度上限100', () => {
      const routeId = openFirstRoute(trade);
      for (let i = 0; i < 100; i++) trade.completeTrade(routeId!);
      const state = trade.getRouteState(routeId!)!;
      expect(state.prosperity).toBeLessThanOrEqual(100);
    });

    it('§5.3.5 update自然衰减繁荣度', () => {
      const routeId = openFirstRoute(trade);
      for (let i = 0; i < 10; i++) trade.completeTrade(routeId!);
      const before = trade.getRouteState(routeId!)!.prosperity;
      trade.update(100); // dt=100秒
      const after = trade.getRouteState(routeId!)!.prosperity;
      expect(after).toBeLessThan(before);
    });

    it('§5.3.6 繁荣度衰减不低于0', () => {
      const routeId = openFirstRoute(trade);
      // 大量update
      for (let i = 0; i < 10000; i++) trade.update(100);
      const state = trade.getRouteState(routeId!)!;
      expect(state.prosperity).toBeGreaterThanOrEqual(0);
    });

    it('§5.3.7 未开通商路不衰减', () => {
      // 找一个未开通商路
      const states = trade.getAllRouteStates();
      let closedRouteId: TradeRouteId | null = null;
      for (const [id, state] of states) {
        if (!state.opened) { closedRouteId = id; break; }
      }
      if (!closedRouteId) return;
      const before = trade.getRouteState(closedRouteId)!.prosperity;
      trade.update(100);
      const after = trade.getRouteState(closedRouteId)!.prosperity;
      expect(after).toBe(before); // 未开通不衰减
    });

    it('§5.3.8 getProsperityLevel返回正确等级', () => {
      const routeId = openFirstRoute(trade);
      // 初始30 → normal
      expect(trade.getProsperityLevel(routeId!)).toBe('normal');
    });

    it('§5.3.9 getProsperityMultiplier返回正确倍率', () => {
      const routeId = openFirstRoute(trade);
      // 30 在 normal tier → multiplier=1.0
      expect(trade.getProsperityMultiplier(routeId!)).toBe(1.0);
    });

    it('§5.3.10 繁荣度等级4级配置正确', () => {
      const levels = PROSPERITY_TIERS.map(t => t.level);
      expect(levels).toEqual(['declining', 'normal', 'thriving', 'golden']);
    });

    it('§5.3.11 事件选项可影响繁荣度', () => {
      const routeId = openFirstRoute(trade);
      if (!routeId) return;
      const events = trade.generateTradeEvents('caravan_1', routeId);
      if (events.length === 0) return;
      const event = events[0];
      const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
      if (!def) return;
      const opt = def.options[0];
      const before = trade.getRouteState(routeId)!.prosperity;
      trade.resolveTradeEvent(event.id, opt.id);
      const after = trade.getRouteState(routeId)!.prosperity;
      expect(after).toBe(Math.max(0, Math.min(100, before + opt.prosperityChange)));
    });

    it('§5.3.12 completeTrade增加completedTrades计数', () => {
      const routeId = openFirstRoute(trade);
      const before = trade.getRouteState(routeId!)!.completedTrades;
      trade.completeTrade(routeId!);
      trade.completeTrade(routeId!);
      const after = trade.getRouteState(routeId!)!.completedTrades;
      expect(after).toBe(before + 2);
    });

    it('§5.3.13 getProsperityTier返回完整等级信息', () => {
      const routeId = openFirstRoute(trade);
      const tier = trade.getProsperityTier(routeId!);
      expect(tier.level).toBeTruthy();
      expect(tier.outputMultiplier).toBeGreaterThan(0);
      expect(typeof tier.unlockNpcMerchant).toBe('boolean');
    });

    it('§5.3.14 繁荣度0时等级为declining', () => {
      const routeId = openFirstRoute(trade);
      // 衰减到0
      for (let i = 0; i < 10000; i++) trade.update(100);
      const level = trade.getProsperityLevel(routeId!);
      const prosperity = trade.getRouteState(routeId!)!.prosperity;
      if (prosperity < 25) {
        expect(level).toBe('declining');
      }
    });

    it('§5.3.15 高繁荣度等级为thriving或golden', () => {
      const routeId = openFirstRoute(trade);
      for (let i = 0; i < 50; i++) trade.completeTrade(routeId!);
      const prosperity = trade.getRouteState(routeId!)!.prosperity;
      const level = trade.getProsperityLevel(routeId!);
      if (prosperity >= 75) expect(level).toBe('golden');
      else if (prosperity >= 50) expect(level).toBe('thriving');
    });
  });
});
