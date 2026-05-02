/**
 * §3.1~3.5 商路开通 / 商队派遣运输 — 集成测试
 *
 * TradeSystem + CaravanSystem 联动验证
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TradeSystem } from '../../TradeSystem';
import { CaravanSystem } from '../../CaravanSystem';
import type { RouteInfoProvider } from '../../CaravanSystem';
import type { ISystemDeps } from '../../../../core/types';

// ─── 辅助 ────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createFixture() {
  const trade = new TradeSystem();
  const caravan = new CaravanSystem();
  trade.init(mockDeps());
  caravan.init(mockDeps());

  // 注入商路信息提供者
  const provider: RouteInfoProvider = {
    getRouteDef: (routeId) => {
      const state = trade.getRouteState(routeId);
      const defs = trade.getRouteDefs();
      const def = defs.find(d => d.id === routeId);
      if (!def || !state) return null;
      return {
        opened: state.opened,
        baseTravelTime: def.baseTravelTime,
        baseProfitRate: def.baseProfitRate,
        from: def.from,
        to: def.to,
      };
    },
    getPrice: (goodsId) => trade.getPrice(goodsId),
    completeTrade: (routeId) => trade.completeTrade(routeId),
  };
  caravan.setRouteProvider(provider);

  return { trade, caravan };
}

// ═══════════════════════════════════════════════

describe('§3.1~3.5 商路开通 / 商队派遣运输', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;

  beforeEach(() => {
    ({ trade, caravan } = createFixture());
  });

  // ─── §3.1 商路定义与查询 ──────────────────

  describe('§3.1 商路定义与查询', () => {
    it('初始化后包含 8 条商路', () => {
      expect(trade.getRouteDefs().length).toBe(11);
    });

    it('所有商路初始未开通', () => {
      const states = trade.getAllRouteStates();
      for (const state of states.values()) {
        expect(state.opened).toBe(false);
      }
    });

    it('getRouteState 返回正确状态', () => {
      const state = trade.getRouteState('route_luoyang_xuchang');
      expect(state).toBeDefined();
      expect(state!.prosperity).toBe(30);
    });

    it('getRouteState 不存在返回 undefined', () => {
      expect(trade.getRouteState('fake_route')).toBeUndefined();
    });

    it('10 种贸易商品定义', () => {
      expect(trade.getAllGoodsDefs().length).toBe(10);
    });
  });

  // ─── §3.2 商路开通 ────────────────────────

  describe('§3.2 商路开通', () => {
    it('canOpenRoute 等级不足返回 false', () => {
      const result = trade.canOpenRoute('route_luoyang_xuchang', 0);
      expect(result.canOpen).toBe(false);
    });

    it('canOpenRoute 等级足够返回 true', () => {
      const result = trade.canOpenRoute('route_luoyang_xuchang', 1);
      expect(result.canOpen).toBe(true);
    });

    it('openRoute 成功开通商路', () => {
      const result = trade.openRoute('route_luoyang_xuchang', 1);
      expect(result.success).toBe(true);
      expect(trade.getRouteState('route_luoyang_xuchang')!.opened).toBe(true);
    });

    it('重复开通返回失败', () => {
      trade.openRoute('route_luoyang_xuchang', 1);
      const result = trade.openRoute('route_luoyang_xuchang', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已开通');
    });

    it('前置商路未开通返回失败', () => {
      const result = trade.openRoute('route_xuchang_xiangyang', 2);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置');
    });

    it('依次开通前置链', () => {
      expect(trade.openRoute('route_luoyang_xuchang', 1).success).toBe(true);
      expect(trade.openRoute('route_xuchang_xiangyang', 2).success).toBe(true);
      expect(trade.openRoute('route_xiangyang_chengdu', 3).success).toBe(true);
    });

    it('不存在商路返回失败', () => {
      const result = trade.canOpenRoute('fake_route', 99);
      expect(result.canOpen).toBe(false);
      expect(result.reason).toContain('不存在');
    });
  });

  // ─── §3.3 商队管理 ────────────────────────

  describe('§3.3 商队管理', () => {
    it('初始拥有 2 个商队', () => {
      expect(caravan.getCaravanCount()).toBe(2);
    });

    it('初始商队均为待命状态', () => {
      const idle = caravan.getIdleCaravans();
      expect(idle.length).toBe(2);
    });

    it('addCaravan 新增商队', () => {
      const result = caravan.addCaravan();
      expect(result.success).toBe(true);
      expect(result.caravan).toBeDefined();
      expect(caravan.getCaravanCount()).toBe(3);
    });

    it('商队数量上限 5', () => {
      for (let i = 0; i < 3; i++) caravan.addCaravan();
      expect(caravan.canAddCaravan()).toBe(false);
      expect(caravan.addCaravan().success).toBe(false);
    });

    it('upgradeCaravan 提升属性', () => {
      const c = caravan.getIdleCaravans()[0];
      const result = caravan.upgradeCaravan(c.id, 'capacity', 10);
      expect(result).toBe(true);
      expect(caravan.getCaravan(c.id)!.attributes.capacity).toBe(30);
    });

    it('upgradeCaravan currentLoad 不可升级', () => {
      const c = caravan.getIdleCaravans()[0];
      expect(caravan.upgradeCaravan(c.id, 'currentLoad', 5)).toBe(false);
    });

    it('getCaravan 返回副本', () => {
      const c = caravan.getIdleCaravans()[0];
      const fetched = caravan.getCaravan(c.id);
      fetched!.attributes.capacity = 999;
      expect(caravan.getCaravan(c.id)!.attributes.capacity).not.toBe(999);
    });
  });

  // ─── §3.4 商队派遣与运输 ──────────────────

  describe('§3.4 商队派遣与运输', () => {
    beforeEach(() => {
      trade.openRoute('route_luoyang_xuchang', 1);
    });

    it('派遣商队成功', () => {
      const c = caravan.getIdleCaravans()[0];
      const result = caravan.dispatch({
        caravanId: c.id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      });
      expect(result.success).toBe(true);
      expect(result.estimatedArrival).toBeGreaterThan(0);
      expect(result.estimatedProfit).toBeDefined();
    });

    it('派遣后商队状态变为 traveling', () => {
      const c = caravan.getIdleCaravans()[0];
      caravan.dispatch({
        caravanId: c.id,
        routeId: 'route_luoyang_xuchang',
        cargo: { tea: 3 },
      });
      const updated = caravan.getCaravan(c.id);
      expect(updated!.status).toBe('traveling');
    });

    it('超出载重上限派遣失败', () => {
      const c = caravan.getIdleCaravans()[0];
      const result = caravan.dispatch({
        caravanId: c.id,
        routeId: 'route_luoyang_xuchang',
        cargo: { iron: 99 },
      });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('载重');
    });

    it('商路未开通不可派遣', () => {
      const c = caravan.getIdleCaravans()[0];
      const result = caravan.dispatch({
        caravanId: c.id,
        routeId: 'route_xuchang_xiangyang',
        cargo: { silk: 1 },
      });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未开通');
    });

    it('非待命商队不可派遣', () => {
      const c = caravan.getIdleCaravans()[0];
      caravan.dispatch({ caravanId: c.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 1 } });
      const result = caravan.dispatch({ caravanId: c.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 1 } });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('待命');
    });

    it('不存在的商队派遣失败', () => {
      const result = caravan.dispatch({ caravanId: 'fake', routeId: 'route_luoyang_xuchang', cargo: {} });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('护卫指派后商队有护卫', () => {
      const c = caravan.getIdleCaravans()[0];
      caravan.dispatch({
        caravanId: c.id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 1 },
        guardHeroId: 'hero_zhaoyun',
      });
      expect(caravan.hasGuard(c.id)).toBe(true);
      expect(caravan.getGuardHeroId(c.id)).toBe('hero_zhaoyun');
    });
  });

  // ─── §3.5 护卫互斥与利润 ──────────────────

  describe('§3.5 护卫互斥与利润', () => {
    beforeEach(() => {
      trade.openRoute('route_luoyang_xuchang', 1);
    });

    it('同一武将不可护卫两个商队', () => {
      const [c1, c2] = caravan.getIdleCaravans();
      caravan.assignGuard(c1.id, 'hero_guanyu');
      const mutex = caravan.checkGuardMutex('hero_guanyu', c2.id);
      expect(mutex.available).toBe(false);
      expect(mutex.conflictCaravanId).toBe(c1.id);
    });

    it('不同武将可分别护卫', () => {
      const [c1, c2] = caravan.getIdleCaravans();
      expect(caravan.assignGuard(c1.id, 'hero_guanyu').success).toBe(true);
      expect(caravan.assignGuard(c2.id, 'hero_zhangfei').success).toBe(true);
    });

    it('removeGuard 解除护卫', () => {
      const c = caravan.getIdleCaravans()[0];
      caravan.assignGuard(c.id, 'hero_guanyu');
      expect(caravan.removeGuard(c.id)).toBe(true);
      expect(caravan.hasGuard(c.id)).toBe(false);
    });

    it('calculateProfit 返回利润详情', () => {
      const profit = trade.calculateProfit('route_luoyang_xuchang', { silk: 10 }, 1.0, 0);
      expect(profit.revenue).toBeGreaterThanOrEqual(0);
      expect(profit.cost).toBe(1000);
      expect(profit).toHaveProperty('prosperityBonus');
      expect(profit).toHaveProperty('bargainingBonus');
    });

    it('繁荣度影响利润加成', () => {
      trade.openRoute('route_luoyang_xuchang', 1);
      const state = trade.getRouteState('route_luoyang_xuchang')!;
      // 模拟繁荣度提升
      for (let i = 0; i < 20; i++) trade.completeTrade('route_luoyang_xuchang');
      const tier = trade.getProsperityTier('route_luoyang_xuchang');
      expect(tier.outputMultiplier).toBeGreaterThan(1);
    });

    it('completeTrade 增加贸易次数和繁荣度', () => {
      trade.openRoute('route_luoyang_xuchang', 1);
      const beforeTrades = trade.getRouteState('route_luoyang_xuchang')!.completedTrades;
      const beforeProsperity = trade.getRouteState('route_luoyang_xuchang')!.prosperity;
      trade.completeTrade('route_luoyang_xuchang');
      const after = trade.getRouteState('route_luoyang_xuchang')!;
      expect(after.completedTrades).toBe(beforeTrades + 1);
      expect(after.prosperity).toBeGreaterThan(beforeProsperity);
    });

    it('序列化/反序列化保持一致', () => {
      trade.openRoute('route_luoyang_xuchang', 1);
      trade.completeTrade('route_luoyang_xuchang');
      const data = trade.serialize();
      const trade2 = new TradeSystem();
      trade2.init(mockDeps());
      trade2.deserialize(data);
      expect(trade2.getRouteState('route_luoyang_xuchang')!.opened).toBe(true);
      expect(trade2.getRouteState('route_luoyang_xuchang')!.completedTrades).toBe(1);
    });

    it('商队序列化/反序列化保持一致', () => {
      const data = caravan.serialize();
      const caravan2 = new CaravanSystem();
      caravan2.init(mockDeps());
      caravan2.deserialize(data);
      expect(caravan2.getCaravanCount()).toBe(2);
    });
  });
});
