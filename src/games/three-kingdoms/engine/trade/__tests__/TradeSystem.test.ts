/**
 * TradeSystem 单元测试
 *
 * 覆盖：
 * 1. 初始化（商路、商品价格）
 * 2. 商路开通
 * 3. 价格波动
 * 4. 利润计算
 * 5. 繁荣度
 * 6. 贸易事件
 * 7. NPC商人
 * 8. 序列化/反序列化
 * 9. ISubsystem 接口
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeSystem } from '../TradeSystem';
import type { TradeCurrencyOps } from '../TradeSystem';
import {
  CITY_IDS,
  CITY_LABELS,
  PROSPERITY_LABELS,
} from '../../../core/trade/trade.types';
import {
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  PROSPERITY_DECAY_RATE,
  TRADE_SAVE_VERSION,
  NPC_MERCHANT_DEFS,
  TRADE_EVENT_DEFS,
} from '../../../core/trade/trade-config';

/** 创建带 mock deps 的 TradeSystem */
function createTrade(): TradeSystem {
  const trade = new TradeSystem();
  const mockEventBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const mockConfig = { get: vi.fn() };
  const mockRegistry = { get: vi.fn() };
  trade.init({ eventBus: mockEventBus as any, config: mockConfig as any, registry: mockRegistry as any });
  return trade;
}

/** 创建 mock 货币操作（始终成功） */
function createMockCurrencyOps(): TradeCurrencyOps & { spendCallLog: any[] } {
  const spendCallLog: any[] = [];
  return {
    addCurrency: vi.fn(),
    canAfford: vi.fn().mockReturnValue(true),
    spendByPriority: vi.fn((shopType: string, amount: number) => {
      spendCallLog.push({ shopType, amount });
      return { success: true };
    }),
    spendCallLog,
  };
}

describe('TradeSystem', () => {
  let trade: TradeSystem;
  beforeEach(() => {
    vi.restoreAllMocks();
    trade = createTrade();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('应有8座城市', () => {
      expect(CITY_IDS).toHaveLength(8);
    });

    it('城市标签完整', () => {
      for (const id of CITY_IDS) {
        expect(CITY_LABELS[id]).toBeTruthy();
      }
    });

    it('应有8条商路定义', () => {
      expect(TRADE_ROUTE_DEFS).toHaveLength(8);
    });

    it('应有10种贸易商品', () => {
      expect(TRADE_GOODS_DEFS).toHaveLength(10);
    });

    it('商路状态全部初始化', () => {
      const states = trade.getAllRouteStates();
      expect(states.size).toBe(TRADE_ROUTE_DEFS.length);
      for (const state of states.values()) {
        expect(state.opened).toBe(false);
        expect(state.prosperity).toBe(INITIAL_PROSPERITY);
      }
    });

    it('商品价格全部初始化', () => {
      const prices = trade.getAllPrices();
      expect(prices.size).toBe(TRADE_GOODS_DEFS.length);
    });

    it('name 为 trade', () => {
      expect(trade.name).toBe('trade');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 商路开通
  // ═══════════════════════════════════════════
  describe('商路开通', () => {
    it('canOpenRoute 等级不足返回失败', () => {
      // route_luoyang_xuchang 需要 castleLevel 1
      const result = trade.canOpenRoute('route_luoyang_xuchang', 0);
      expect(result.canOpen).toBe(false);
      expect(result.reason).toContain('主城');
    });

    it('canOpenRoute 等级足够返回成功', () => {
      const result = trade.canOpenRoute('route_luoyang_xuchang', 1);
      expect(result.canOpen).toBe(true);
    });

    it('canOpenRoute 需要前置商路', () => {
      // route_xuchang_xiangyang 需要 route_luoyang_xuchang
      const result = trade.canOpenRoute('route_xuchang_xiangyang', 2);
      expect(result.canOpen).toBe(false);
      expect(result.reason).toContain('前置');
    });

    it('canOpenRoute 已开通返回失败', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);
      const result = trade.canOpenRoute('route_luoyang_xuchang', 1);
      expect(result.canOpen).toBe(false);
      expect(result.reason).toContain('已开通');
    });

    it('canOpenRoute 不存在的商路', () => {
      const result = trade.canOpenRoute('nonexistent', 99);
      expect(result.canOpen).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('openRoute 成功开通', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      const result = trade.openRoute('route_luoyang_xuchang', 1);
      expect(result.success).toBe(true);
      const state = trade.getRouteState('route_luoyang_xuchang');
      expect(state?.opened).toBe(true);
    });

    it('openRoute 货币不足时失败', () => {
      const ops: TradeCurrencyOps = {
        addCurrency: vi.fn(),
        canAfford: vi.fn().mockReturnValue(false),
        spendByPriority: vi.fn().mockReturnValue({ success: false }),
      };
      trade.setCurrencyOps(ops);
      const result = trade.openRoute('route_luoyang_xuchang', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('货币不足');
    });

    it('openRoute 无 currencyOps 仍可开通', () => {
      const result = trade.openRoute('route_luoyang_xuchang', 1);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 价格波动
  // ═══════════════════════════════════════════
  describe('价格波动', () => {
    it('getPrice 返回基础价格（初始）', () => {
      for (const def of TRADE_GOODS_DEFS) {
        const price = trade.getPrice(def.id);
        expect(price).toBe(def.basePrice);
      }
    });

    it('getAllGoodsDefs 返回所有商品定义', () => {
      const defs = trade.getAllGoodsDefs();
      expect(defs.length).toBe(TRADE_GOODS_DEFS.length);
    });

    it('getGoodsDef 返回指定商品定义', () => {
      const def = trade.getGoodsDef('silk');
      expect(def).toBeDefined();
      expect(def!.name).toBe('丝绸');
    });

    it('getGoodsDef 不存在返回 undefined', () => {
      const def = trade.getGoodsDef('nonexistent');
      expect(def).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 利润计算
  // ═══════════════════════════════════════════
  describe('利润计算', () => {
    it('calculateProfit 返回利润信息', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);

      const profit = trade.calculateProfit(
        'route_luoyang_xuchang',
        { silk: 10 },
        1.0, // bargainingPower
        0,   // guardCost
      );
      expect(profit).toBeDefined();
      expect(typeof profit.revenue).toBe('number');
      expect(typeof profit.cost).toBe('number');
      expect(typeof profit.profit).toBe('number');
      expect(typeof profit.profitRate).toBe('number');
    });

    it('calculateProfit 不存在的商路返回零', () => {
      const profit = trade.calculateProfit('nonexistent', { silk: 10 }, 1.0, 0);
      expect(profit.revenue).toBe(0);
      expect(profit.cost).toBe(0);
      expect(profit.profit).toBe(0);
    });

    it('completeTrade 增加繁荣度', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);

      const before = trade.getRouteState('route_luoyang_xuchang')!.prosperity;
      trade.completeTrade('route_luoyang_xuchang');
      const after = trade.getRouteState('route_luoyang_xuchang')!.prosperity;
      expect(after).toBe(before + PROSPERITY_GAIN_PER_TRADE);
    });

    it('completeTrade 未开通商路不增加繁荣度', () => {
      const before = trade.getRouteState('route_luoyang_xuchang')!.prosperity;
      trade.completeTrade('route_luoyang_xuchang');
      const after = trade.getRouteState('route_luoyang_xuchang')!.prosperity;
      expect(after).toBe(before); // 未开通，不增加
    });
  });

  // ═══════════════════════════════════════════
  // 5. 繁荣度
  // ═══════════════════════════════════════════
  describe('繁荣度', () => {
    it('初始繁荣度等级为 normal', () => {
      // INITIAL_PROSPERITY = 30, normal range is 25-50
      const level = trade.getProsperityLevel('route_luoyang_xuchang');
      expect(level).toBe('normal');
    });

    it('getProsperityMultiplier 返回产出倍率', () => {
      const multiplier = trade.getProsperityMultiplier('route_luoyang_xuchang');
      expect(multiplier).toBe(1.0); // normal = 1.0
    });

    it('getProsperityTier 返回繁荣度详情', () => {
      const tier = trade.getProsperityTier('route_luoyang_xuchang');
      expect(tier.level).toBe('normal');
      expect(tier.outputMultiplier).toBe(1.0);
    });

    it('update 衰减繁荣度', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);

      const before = trade.getRouteState('route_luoyang_xuchang')!.prosperity;
      trade.update(100); // dt=100s
      const after = trade.getRouteState('route_luoyang_xuchang')!.prosperity;
      expect(after).toBeLessThan(before);
    });

    it('繁荣度不低于0', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);

      // 大量 update
      for (let i = 0; i < 10000; i++) {
        trade.update(100);
      }
      const state = trade.getRouteState('route_luoyang_xuchang');
      expect(state!.prosperity).toBeGreaterThanOrEqual(0);
    });

    it('繁荣度不超过100', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);

      for (let i = 0; i < 100; i++) {
        trade.completeTrade('route_luoyang_xuchang');
      }
      const state = trade.getRouteState('route_luoyang_xuchang');
      expect(state!.prosperity).toBeLessThanOrEqual(100);
    });

    it('PROSPERITY_LABELS 包含4个等级', () => {
      expect(Object.keys(PROSPERITY_LABELS)).toHaveLength(4);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 贸易事件
  // ═══════════════════════════════════════════
  describe('贸易事件', () => {
    it('TRADE_EVENT_DEFS 有8种事件', () => {
      expect(TRADE_EVENT_DEFS).toHaveLength(8);
    });

    it('generateTradeEvents 返回事件列表', () => {
      // 使用 Math.random mock 控制触发
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      expect(Array.isArray(events)).toBe(true);
    });

    it('resolveTradeEvent 成功处理事件', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      if (events.length > 0) {
        const event = events[0];
        const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
        if (def && def.options.length > 0) {
          const result = trade.resolveTradeEvent(event.id, def.options[0].id);
          expect(result.success).toBe(true);
          expect(result.option).toBeDefined();
        }
      }
    });

    it('resolveTradeEvent 不存在的事件返回失败', () => {
      const result = trade.resolveTradeEvent('nonexistent', 'fight');
      expect(result.success).toBe(false);
    });

    it('getActiveEvents 返回活跃事件', () => {
      trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      const active = trade.getActiveEvents('caravan_1');
      // 可能有0个或多个（取决于随机）
      expect(Array.isArray(active)).toBe(true);
    });

    it('autoResolveWithGuard 自动处理护卫事件', () => {
      const events = trade.generateTradeEvents('caravan_1', 'route_luoyang_xuchang');
      const resolved = trade.autoResolveWithGuard('caravan_1');
      // 护卫只能处理 guardCanAutoResolve 的事件
      expect(Array.isArray(resolved)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 7. NPC商人
  // ═══════════════════════════════════════════
  describe('NPC商人', () => {
    it('NPC_MERCHANT_DEFS 有5种商人', () => {
      expect(NPC_MERCHANT_DEFS).toHaveLength(5);
    });

    it('trySpawnNpcMerchants 未开通商路不生成', () => {
      const spawned = trade.trySpawnNpcMerchants();
      expect(spawned).toHaveLength(0);
    });

    it('getActiveNpcMerchants 初始为空', () => {
      const merchants = trade.getActiveNpcMerchants();
      expect(merchants).toHaveLength(0);
    });

    it('interactWithNpcMerchant 不存在的商人返回 false', () => {
      const result = trade.interactWithNpcMerchant('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize/deserialize 往返一致', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);

      const data = trade.serialize();
      expect(data.version).toBe(TRADE_SAVE_VERSION);
      expect(data.routes['route_luoyang_xuchang'].opened).toBe(true);

      const trade2 = createTrade();
      trade2.deserialize(data);
      const state = trade2.getRouteState('route_luoyang_xuchang');
      expect(state?.opened).toBe(true);
    });

    it('deserialize 版本不匹配抛异常', () => {
      const data = {
        routes: {},
        prices: {},
        caravans: [],
        activeEvents: [],
        npcMerchants: [],
        version: 99,
      };
      expect(() => trade.deserialize(data as any)).toThrow();
    });

    it('reset 恢复初始状态', () => {
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      trade.openRoute('route_luoyang_xuchang', 1);
      trade.reset();
      const state = trade.getRouteState('route_luoyang_xuchang');
      expect(state?.opened).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 9. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('update 不抛异常', () => {
      expect(() => trade.update(16)).not.toThrow();
    });

    it('getState 返回状态对象', () => {
      const state = trade.getState();
      expect(state.routes).toBeDefined();
      expect(state.prices).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 10. 商路定义
  // ═══════════════════════════════════════════
  describe('商路定义', () => {
    it('getRouteDefs 返回所有商路定义', () => {
      const defs = trade.getRouteDefs();
      expect(defs.length).toBe(TRADE_ROUTE_DEFS.length);
    });

    it('每条商路都有起止城市', () => {
      const defs = trade.getRouteDefs();
      for (const def of defs) {
        expect(def.from).toBeTruthy();
        expect(def.to).toBeTruthy();
        expect(def.baseTravelTime).toBeGreaterThan(0);
        expect(def.baseProfitRate).toBeGreaterThan(0);
      }
    });
  });
});
