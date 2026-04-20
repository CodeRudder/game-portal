/**
 * trade-helpers 单元测试
 *
 * 覆盖：
 * 1. 辅助函数（createDefaultRouteState, createDefaultPrice, findProsperityTier, generateId）
 * 2. refreshSinglePrice（价格波动逻辑）
 * 3. generateTradeEvents（事件生成逻辑）
 * 4. trySpawnNpcMerchants（NPC商人生成逻辑）
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createDefaultRouteState,
  createDefaultPrice,
  findProsperityTier,
  generateId,
  refreshSinglePrice,
  generateTradeEvents,
  trySpawnNpcMerchants,
} from '../trade-helpers';
import type { NpcSpawnContext } from '../trade-helpers';
import type { TradeGoodsDef, TradeGoodsPrice } from '../../../core/trade/trade.types';
import {
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PRICE_REFRESH_INTERVAL,
  MAX_CONSECUTIVE_DIRECTION,
} from '../../../core/trade/trade-config';

describe('trade-helpers', () => {
  // ─── createDefaultRouteState ───
  describe('createDefaultRouteState', () => {
    it('创建默认商路状态', () => {
      const state = createDefaultRouteState('route_test');
      expect(state.routeId).toBe('route_test');
      expect(state.opened).toBe(false);
      expect(state.prosperity).toBe(INITIAL_PROSPERITY);
      expect(state.completedTrades).toBe(0);
    });
  });

  // ─── createDefaultPrice ───
  describe('createDefaultPrice', () => {
    it('创建默认商品价格', () => {
      const def: TradeGoodsDef = {
        id: 'test_goods', name: '测试', basePrice: 100, volatility: 0.15, weight: 1, originCity: 'luoyang',
      };
      const price = createDefaultPrice(def, 1000);
      expect(price.goodsId).toBe('test_goods');
      expect(price.currentPrice).toBe(100);
      expect(price.lastPrice).toBe(100);
      expect(price.consecutiveDirection).toBe(0);
      expect(price.lastRefreshTime).toBe(1000);
    });
  });

  // ─── findProsperityTier ───
  describe('findProsperityTier', () => {
    it('prosperity=0 → declining', () => {
      expect(findProsperityTier(0).level).toBe('declining');
    });

    it('prosperity=30 → normal', () => {
      expect(findProsperityTier(30).level).toBe('normal');
    });

    it('prosperity=60 → thriving', () => {
      expect(findProsperityTier(60).level).toBe('thriving');
    });

    it('prosperity=90 → golden', () => {
      expect(findProsperityTier(90).level).toBe('golden');
    });

    it('prosperity=100 → golden (边界)', () => {
      expect(findProsperityTier(100).level).toBe('golden');
    });

    it('返回对应的产出倍率', () => {
      expect(findProsperityTier(0).outputMultiplier).toBe(0.8);
      expect(findProsperityTier(30).outputMultiplier).toBe(1.0);
      expect(findProsperityTier(60).outputMultiplier).toBe(1.3);
      expect(findProsperityTier(90).outputMultiplier).toBe(1.6);
    });
  });

  // ─── generateId ───
  describe('generateId', () => {
    it('生成唯一ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });

  // ─── refreshSinglePrice ───
  describe('refreshSinglePrice', () => {
    const def: TradeGoodsDef = {
      id: 'test', name: '测试', basePrice: 100, volatility: 0.15, weight: 1, originCity: 'luoyang',
    };

    it('间隔不足时不刷新', () => {
      const price: TradeGoodsPrice = {
        goodsId: 'test', currentPrice: 100, lastPrice: 100,
        consecutiveDirection: 0, lastRefreshTime: Date.now(),
      };
      const before = price.currentPrice;
      refreshSinglePrice(price, def, Date.now());
      expect(price.currentPrice).toBe(before);
    });

    it('间隔足够时刷新价格', () => {
      const price: TradeGoodsPrice = {
        goodsId: 'test', currentPrice: 100, lastPrice: 100,
        consecutiveDirection: 0, lastRefreshTime: 0,
      };
      refreshSinglePrice(price, def, Date.now());
      expect(price.lastPrice).toBe(100);
      expect(price.lastRefreshTime).toBe(Date.now());
    });

    it('价格不低于基础价50%', () => {
      const price: TradeGoodsPrice = {
        goodsId: 'test', currentPrice: 100, lastPrice: 100,
        consecutiveDirection: 0, lastRefreshTime: 0,
      };
      for (let i = 0; i < 100; i++) {
        price.lastRefreshTime = 0;
        refreshSinglePrice(price, def, Date.now());
        expect(price.currentPrice).toBeGreaterThanOrEqual(50);
        expect(price.currentPrice).toBeLessThanOrEqual(200);
      }
    });

    it('连续涨跌超过3次强制反向', () => {
      const price: TradeGoodsPrice = {
        goodsId: 'test', currentPrice: 100, lastPrice: 100,
        consecutiveDirection: MAX_CONSECUTIVE_DIRECTION, lastRefreshTime: 0,
      };
      // Mock Math.random to force direction
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // direction=1 (same as consecutive)
      refreshSinglePrice(price, def, Date.now());
      // consecutiveDirection should be forced reverse
      expect(price.consecutiveDirection).toBeLessThan(0);
      spy.mockRestore();
    });
  });

  // ─── generateTradeEvents ───
  describe('generateTradeEvents', () => {
    it('返回数组', () => {
      const events = generateTradeEvents('c1', 'route_1');
      expect(Array.isArray(events)).toBe(true);
    });

    it('事件包含正确字段', () => {
      // Force event generation by mocking random
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.01);
      const events = generateTradeEvents('c1', 'route_1');
      spy.mockRestore();
      if (events.length > 0) {
        expect(events[0].caravanId).toBe('c1');
        expect(events[0].routeId).toBe('route_1');
        expect(events[0].resolved).toBe(false);
      }
    });
  });

  // ─── trySpawnNpcMerchants ───
  describe('trySpawnNpcMerchants', () => {
    it('未开通商路不生成', () => {
      const ctx: NpcSpawnContext = {
        routeStates: new Map([['r1', { routeId: 'r1', opened: false, prosperity: 30, completedTrades: 0 }]]),
        routeDefs: new Map([['r1', { from: 'luoyang', to: 'xuchang' }]]),
      };
      expect(trySpawnNpcMerchants(ctx)).toHaveLength(0);
    });

    it('繁荣度不足不生成', () => {
      const ctx: NpcSpawnContext = {
        routeStates: new Map([['r1', { routeId: 'r1', opened: true, prosperity: 20, completedTrades: 0 }]]),
        routeDefs: new Map([['r1', { from: 'luoyang', to: 'xuchang' }]]),
      };
      expect(trySpawnNpcMerchants(ctx)).toHaveLength(0);
    });
  });
});
