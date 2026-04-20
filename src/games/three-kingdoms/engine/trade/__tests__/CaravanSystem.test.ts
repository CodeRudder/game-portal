/**
 * CaravanSystem 单元测试 — Part 1
 *
 * 覆盖：
 * 1. 初始化（商队数量、属性）
 * 2. 商队查询
 * 3. 商队派遣
 * 4. update 状态流转
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaravanSystem } from '../CaravanSystem';
import type { RouteInfoProvider } from '../CaravanSystem';
import {
  CARAVAN_STATUS_LABELS,
} from '../../../core/trade/trade.types';
import {
  INITIAL_CARAVAN_COUNT,
  MAX_CARAVAN_COUNT,
  BASE_CARAVAN_ATTRIBUTES,
} from '../../../core/trade/trade-config';

function createCaravan(): CaravanSystem {
  const caravan = new CaravanSystem();
  caravan.init({
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as any,
    config: { get: vi.fn() } as any,
    registry: { get: vi.fn() } as any,
  });
  return caravan;
}

function createMockRouteProvider(): RouteInfoProvider {
  return {
    getRouteDef: vi.fn().mockReturnValue({
      opened: true, baseTravelTime: 600, baseProfitRate: 0.15, from: 'luoyang', to: 'xuchang',
    }),
    getPrice: vi.fn().mockReturnValue(100),
    completeTrade: vi.fn(),
  };
}

describe('CaravanSystem - 初始化与查询', () => {
  let cs: CaravanSystem;
  beforeEach(() => { vi.restoreAllMocks(); cs = createCaravan(); });

  it('初始商队数量为2', () => {
    expect(cs.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
  });

  it('所有商队初始状态为 idle', () => {
    for (const c of cs.getCaravans()) expect(c.status).toBe('idle');
  });

  it('商队属性与配置一致', () => {
    for (const c of cs.getCaravans()) {
      expect(c.attributes.capacity).toBe(BASE_CARAVAN_ATTRIBUTES.capacity);
      expect(c.attributes.speedMultiplier).toBe(BASE_CARAVAN_ATTRIBUTES.speedMultiplier);
      expect(c.attributes.bargainingPower).toBe(BASE_CARAVAN_ATTRIBUTES.bargainingPower);
      expect(c.attributes.currentLoad).toBe(0);
    }
  });

  it('商队无护卫', () => {
    for (const c of cs.getCaravans()) expect(c.guardHeroId).toBeNull();
  });

  it('name 为 caravan', () => {
    expect(cs.name).toBe('caravan');
  });

  it('CARAVAN_STATUS_LABELS 包含4种状态', () => {
    expect(Object.keys(CARAVAN_STATUS_LABELS)).toHaveLength(4);
  });

  it('getCaravans 返回所有商队', () => {
    expect(cs.getCaravans().length).toBe(INITIAL_CARAVAN_COUNT);
  });

  it('getCaravan 返回指定商队', () => {
    const first = cs.getCaravans()[0];
    expect(cs.getCaravan(first.id)?.id).toBe(first.id);
  });

  it('getCaravan 不存在返回 undefined', () => {
    expect(cs.getCaravan('nonexistent')).toBeUndefined();
  });

  it('getIdleCaravans 返回空闲商队', () => {
    expect(cs.getIdleCaravans().length).toBe(INITIAL_CARAVAN_COUNT);
  });

  it('canAddCaravan 初始可添加', () => {
    expect(cs.canAddCaravan()).toBe(true);
  });

  it('getState 返回商队列表', () => {
    const state = cs.getState();
    expect(Array.isArray(state)).toBe(true);
    expect(state.length).toBe(INITIAL_CARAVAN_COUNT);
  });
});

describe('CaravanSystem - 商队派遣', () => {
  let cs: CaravanSystem;
  beforeEach(() => { vi.restoreAllMocks(); cs = createCaravan(); });

  it('dispatch 成功派遣', () => {
    cs.setRouteProvider(createMockRouteProvider());
    const first = cs.getCaravans()[0];
    const result = cs.dispatch({
      caravanId: first.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 10 },
    });
    expect(result.success).toBe(true);
    expect(result.estimatedArrival).toBeGreaterThan(0);
    expect(result.estimatedProfit).toBeGreaterThanOrEqual(0);
    expect(cs.getCaravan(first.id)!.status).toBe('traveling');
    expect(cs.getCaravan(first.id)!.currentRouteId).toBe('route_luoyang_xuchang');
  });

  it('dispatch 不存在的商队失败', () => {
    cs.setRouteProvider(createMockRouteProvider());
    const result = cs.dispatch({ caravanId: 'nonexistent', routeId: 'route_luoyang_xuchang', cargo: { silk: 10 } });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('dispatch 非空闲商队失败', () => {
    cs.setRouteProvider(createMockRouteProvider());
    const first = cs.getCaravans()[0];
    cs.dispatch({ caravanId: first.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 5 } });
    const result = cs.dispatch({ caravanId: first.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 5 } });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('待命');
  });

  it('dispatch 无 RouteProvider 失败', () => {
    const result = cs.dispatch({
      caravanId: cs.getCaravans()[0].id, routeId: 'route_luoyang_xuchang', cargo: { silk: 10 },
    });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('未初始化');
  });

  it('dispatch 商路未开通失败', () => {
    const provider: RouteInfoProvider = {
      getRouteDef: vi.fn().mockReturnValue({ opened: false, baseTravelTime: 600, baseProfitRate: 0.15, from: 'luoyang', to: 'xuchang' }),
      getPrice: vi.fn().mockReturnValue(100), completeTrade: vi.fn(),
    };
    cs.setRouteProvider(provider);
    const result = cs.dispatch({ caravanId: cs.getCaravans()[0].id, routeId: 'route_luoyang_xuchang', cargo: { silk: 10 } });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('未开通');
  });

  it('dispatch 商路不存在失败', () => {
    const provider: RouteInfoProvider = {
      getRouteDef: vi.fn().mockReturnValue(null),
      getPrice: vi.fn().mockReturnValue(100), completeTrade: vi.fn(),
    };
    cs.setRouteProvider(provider);
    const result = cs.dispatch({ caravanId: cs.getCaravans()[0].id, routeId: 'nonexistent', cargo: { silk: 10 } });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('dispatch 超载失败', () => {
    cs.setRouteProvider(createMockRouteProvider());
    const result = cs.dispatch({
      caravanId: cs.getCaravans()[0].id, routeId: 'route_luoyang_xuchang', cargo: { silk: 999 },
    });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('载重');
  });

  it('dispatch 带护卫成功', () => {
    cs.setRouteProvider(createMockRouteProvider());
    const first = cs.getCaravans()[0];
    const result = cs.dispatch({
      caravanId: first.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 5 }, guardHeroId: 'hero_001',
    });
    expect(result.success).toBe(true);
    expect(cs.hasGuard(first.id)).toBe(true);
    expect(cs.getGuardHeroId(first.id)).toBe('hero_001');
  });

  it('dispatch 护卫互斥失败', () => {
    cs.setRouteProvider(createMockRouteProvider());
    const [c1, c2] = cs.getCaravans();
    cs.dispatch({ caravanId: c1.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 5 }, guardHeroId: 'hero_001' });
    const result = cs.dispatch({ caravanId: c2.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 5 }, guardHeroId: 'hero_001' });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('其他商队');
  });
});

describe('CaravanSystem - update 状态流转', () => {
  let cs: CaravanSystem;
  beforeEach(() => { vi.restoreAllMocks(); cs = createCaravan(); });

  it('traveling 商队到达后转为 returning', () => {
    const provider = createMockRouteProvider();
    cs.setRouteProvider(provider);
    const first = cs.getCaravans()[0];
    cs.dispatch({ caravanId: first.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 5 } });
    const caravan = (cs as any).caravans.get(first.id);
    caravan.arrivalTime = Date.now() - 1;
    cs.update(1);
    expect(caravan.status).toBe('returning');
    expect(provider.completeTrade).toHaveBeenCalled();
  });

  it('returning 商队到达后转为 idle', () => {
    const provider = createMockRouteProvider();
    cs.setRouteProvider(provider);
    const first = cs.getCaravans()[0];
    cs.dispatch({ caravanId: first.id, routeId: 'route_luoyang_xuchang', cargo: { silk: 5 } });
    const caravan = (cs as any).caravans.get(first.id);
    caravan.status = 'returning';
    caravan.arrivalTime = Date.now() - 1;
    cs.update(1);
    expect(caravan.status).toBe('idle');
    expect(caravan.currentRouteId).toBeNull();
    expect(caravan.cargo).toEqual({});
  });

  it('update 不抛异常', () => {
    expect(() => cs.update(16)).not.toThrow();
  });
});
