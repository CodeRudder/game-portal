/**
 * CaravanSystem 单元测试
 *
 * 覆盖：
 * 1. 初始化（商队数量、属性）
 * 2. 商队查询
 * 3. 商队派遣
 * 4. 护卫系统
 * 5. 商队管理（新增、升级）
 * 6. 商队状态流转（traveling → trading → returning → idle）
 * 7. 序列化/反序列化
 * 8. ISubsystem 接口
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaravanSystem } from '../CaravanSystem';
import type { RouteInfoProvider } from '../CaravanSystem';
import type { CaravanDispatchRequest } from '../../../core/trade/trade.types';
import {
  INITIAL_CARAVAN_COUNT,
  MAX_CARAVAN_COUNT,
  BASE_CARAVAN_ATTRIBUTES,
  GUARD_RISK_REDUCTION,
  TRADE_SAVE_VERSION,
} from '../../../core/trade/trade-config';

/** 创建 mock 依赖 */
function createMockDeps() {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  };
}

/** 创建 mock 商路信息提供者 */
function createMockRouteProvider(): RouteInfoProvider {
  return {
    getRouteDef: vi.fn().mockReturnValue({
      opened: true,
      baseTravelTime: 600,
      baseProfitRate: 0.15,
      from: 'luoyang',
      to: 'xuchang',
    }),
    getPrice: vi.fn().mockReturnValue(100),
    completeTrade: vi.fn(),
  };
}

/** 创建初始化完成的 CaravanSystem */
function createCaravan(): CaravanSystem {
  const cs = new CaravanSystem();
  cs.init(createMockDeps() as any);
  cs.setRouteProvider(createMockRouteProvider());
  return cs;
}

describe('CaravanSystem', () => {
  let caravan: CaravanSystem;
  beforeEach(() => {
    vi.restoreAllMocks();
    caravan = createCaravan();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('初始商队数量与配置一致', () => {
      expect(caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
    });

    it('name 为 caravan', () => {
      expect(caravan.name).toBe('caravan');
    });

    it('初始商队均为待命状态', () => {
      const caravans = caravan.getCaravans();
      for (const c of caravans) {
        expect(c.status).toBe('idle');
      }
    });

    it('初始商队属性与配置一致', () => {
      const caravans = caravan.getCaravans();
      for (const c of caravans) {
        expect(c.attributes.capacity).toBe(BASE_CARAVAN_ATTRIBUTES.capacity);
        expect(c.attributes.speedMultiplier).toBe(BASE_CARAVAN_ATTRIBUTES.speedMultiplier);
        expect(c.attributes.bargainingPower).toBe(BASE_CARAVAN_ATTRIBUTES.bargainingPower);
      }
    });

    it('初始商队无护卫', () => {
      const caravans = caravan.getCaravans();
      for (const c of caravans) {
        expect(c.guardHeroId).toBeNull();
      }
    });

    it('初始商队无货物', () => {
      const caravans = caravan.getCaravans();
      for (const c of caravans) {
        expect(Object.keys(c.cargo)).toHaveLength(0);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 商队查询
  // ═══════════════════════════════════════════
  describe('商队查询', () => {
    it('getCaravans 返回所有商队', () => {
      const caravans = caravan.getCaravans();
      expect(caravans).toHaveLength(INITIAL_CARAVAN_COUNT);
    });

    it('getCaravan 返回指定商队', () => {
      const caravans = caravan.getCaravans();
      const first = caravans[0];
      const found = caravan.getCaravan(first.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(first.id);
    });

    it('getCaravan 不存在返回 undefined', () => {
      expect(caravan.getCaravan('nonexistent')).toBeUndefined();
    });

    it('getIdleCaravans 返回空闲商队', () => {
      const idle = caravan.getIdleCaravans();
      expect(idle).toHaveLength(INITIAL_CARAVAN_COUNT);
    });

    it('getCaravanCount 返回正确数量', () => {
      expect(caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
    });

    it('canAddCaravan 未达上限时返回 true', () => {
      expect(caravan.canAddCaravan()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 商队派遣
  // ═══════════════════════════════════════════
  describe('商队派遣', () => {
    it('dispatch 成功派遣', () => {
      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      };
      const result = caravan.dispatch(request);
      expect(result.success).toBe(true);
      expect(result.estimatedArrival).toBeGreaterThan(0);
      expect(result.estimatedProfit).toBeGreaterThanOrEqual(0);
    });

    it('dispatch 不存在的商队返回失败', () => {
      const request: CaravanDispatchRequest = {
        caravanId: 'nonexistent',
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      };
      const result = caravan.dispatch(request);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('dispatch 非待命商队返回失败', () => {
      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      };
      caravan.dispatch(request);

      // 再次派遣同一商队
      const result = caravan.dispatch(request);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('待命');
    });

    it('dispatch 超载返回失败', () => {
      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 999 }, // 远超载重上限
      };
      const result = caravan.dispatch(request);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('载重');
    });

    it('dispatch 未开通商路返回失败', () => {
      const provider: RouteInfoProvider = {
        getRouteDef: vi.fn().mockReturnValue({
          opened: false,
          baseTravelTime: 600,
          baseProfitRate: 0.15,
          from: 'luoyang',
          to: 'xuchang',
        }),
        getPrice: vi.fn().mockReturnValue(100),
        completeTrade: vi.fn(),
      };
      caravan.setRouteProvider(provider);

      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      };
      const result = caravan.dispatch(request);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未开通');
    });

    it('dispatch 无路由提供者返回失败', () => {
      const rawCaravan = new CaravanSystem();
      rawCaravan.init(createMockDeps() as any);
      // 不设置 routeProvider

      const caravans = rawCaravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      };
      const result = rawCaravan.dispatch(request);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未初始化');
    });

    it('dispatch 不存在的商路返回失败', () => {
      const provider: RouteInfoProvider = {
        getRouteDef: vi.fn().mockReturnValue(null),
        getPrice: vi.fn().mockReturnValue(100),
        completeTrade: vi.fn(),
      };
      caravan.setRouteProvider(provider);

      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'nonexistent',
        cargo: { silk: 5 },
      };
      const result = caravan.dispatch(request);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('dispatch 后商队状态变为 traveling', () => {
      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      };
      caravan.dispatch(request);
      const c = caravan.getCaravan(caravans[0].id);
      expect(c!.status).toBe('traveling');
      expect(c!.currentRouteId).toBe('route_luoyang_xuchang');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 护卫系统
  // ═══════════════════════════════════════════
  describe('护卫系统', () => {
    it('assignGuard 成功指派护卫', () => {
      const caravans = caravan.getCaravans();
      const result = caravan.assignGuard(caravans[0].id, 'hero_001');
      expect(result.success).toBe(true);
      expect(result.riskReduction).toBe(GUARD_RISK_REDUCTION);
    });

    it('assignGuard 不存在的商队返回失败', () => {
      const result = caravan.assignGuard('nonexistent', 'hero_001');
      expect(result.success).toBe(false);
    });

    it('checkGuardMutex 护卫互斥检查', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');

      // 同一护卫不能分配给另一商队
      const mutex = caravan.checkGuardMutex('hero_001', caravans[1].id);
      expect(mutex.available).toBe(false);
      expect(mutex.conflictCaravanId).toBe(caravans[0].id);
    });

    it('checkGuardMutex 同一商队内可重新分配', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');

      const mutex = caravan.checkGuardMutex('hero_001', caravans[0].id);
      expect(mutex.available).toBe(true);
    });

    it('removeGuard 移除护卫', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');

      const result = caravan.removeGuard(caravans[0].id);
      expect(result).toBe(true);
      expect(caravan.getGuardHeroId(caravans[0].id)).toBeNull();
    });

    it('removeGuard 不存在的护卫返回 false', () => {
      const caravans = caravan.getCaravans();
      expect(caravan.removeGuard(caravans[0].id)).toBe(false);
    });

    it('hasGuard 正确判断', () => {
      const caravans = caravan.getCaravans();
      expect(caravan.hasGuard(caravans[0].id)).toBe(false);
      caravan.assignGuard(caravans[0].id, 'hero_001');
      expect(caravan.hasGuard(caravans[0].id)).toBe(true);
    });

    it('getGuardHeroId 返回护卫武将ID', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');
      expect(caravan.getGuardHeroId(caravans[0].id)).toBe('hero_001');
    });

    it('assignGuard 替换护卫时移除旧的', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');
      caravan.assignGuard(caravans[0].id, 'hero_002');

      expect(caravan.getGuardHeroId(caravans[0].id)).toBe('hero_002');
      // hero_001 应该不再被锁定
      const mutex = caravan.checkGuardMutex('hero_001', caravans[1].id);
      expect(mutex.available).toBe(true);
    });

    it('dispatch 带护卫成功', () => {
      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
        guardHeroId: 'hero_001',
      };
      const result = caravan.dispatch(request);
      expect(result.success).toBe(true);
      expect(caravan.hasGuard(caravans[0].id)).toBe(true);
    });

    it('dispatch 护卫互斥时失败', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');

      const request: CaravanDispatchRequest = {
        caravanId: caravans[1].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
        guardHeroId: 'hero_001',
      };
      const result = caravan.dispatch(request);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('护卫');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 商队管理
  // ═══════════════════════════════════════════
  describe('商队管理', () => {
    it('addCaravan 成功新增商队', () => {
      const result = caravan.addCaravan();
      expect(result.success).toBe(true);
      expect(result.caravan).toBeDefined();
      expect(caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT + 1);
    });

    it('addCaravan 达到上限时失败', () => {
      // 添加到上限
      while (caravan.canAddCaravan()) {
        caravan.addCaravan();
      }
      const result = caravan.addCaravan();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('上限');
      expect(caravan.getCaravanCount()).toBe(MAX_CARAVAN_COUNT);
    });

    it('upgradeCaravan 成功升级属性', () => {
      const caravans = caravan.getCaravans();
      const before = caravans[0].attributes.capacity;
      const result = caravan.upgradeCaravan(caravans[0].id, 'capacity', 10);
      expect(result).toBe(true);
      const after = caravan.getCaravan(caravans[0].id);
      expect(after!.attributes.capacity).toBe(before + 10);
    });

    it('upgradeCaravan 不存在的商队返回 false', () => {
      expect(caravan.upgradeCaravan('nonexistent', 'capacity', 10)).toBe(false);
    });

    it('upgradeCaravan currentLoad 不可直接升级', () => {
      const caravans = caravan.getCaravans();
      const result = caravan.upgradeCaravan(caravans[0].id, 'currentLoad', 10);
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 商队状态流转
  // ═══════════════════════════════════════════
  describe('商队状态流转', () => {
    it('update 到达后状态变更 traveling → trading → returning → idle', () => {
      const caravans = caravan.getCaravans();
      const request: CaravanDispatchRequest = {
        caravanId: caravans[0].id,
        routeId: 'route_luoyang_xuchang',
        cargo: { silk: 5 },
      };
      caravan.dispatch(request);

      // 模拟到达时间（设置 arrivalTime 为过去）
      const c = (caravan as any).caravans.get(caravans[0].id);
      c.arrivalTime = Date.now() - 1;

      // 第一次 update: traveling → trading → returning
      caravan.update(0);
      expect(c.status).toBe('returning');

      // 设置返回到达时间
      c.arrivalTime = Date.now() - 1;

      // 第二次 update: returning → idle
      caravan.update(0);
      expect(c.status).toBe('idle');
      expect(c.currentRouteId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize/deserialize 往返一致', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');

      const data = caravan.serialize();
      expect(data.version).toBe(TRADE_SAVE_VERSION);
      expect(data.caravans).toHaveLength(INITIAL_CARAVAN_COUNT);

      const cs2 = new CaravanSystem();
      cs2.init(createMockDeps() as any);
      cs2.deserialize(data);

      expect(cs2.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
      expect(cs2.getGuardHeroId(caravans[0].id)).toBe('hero_001');
    });

    it('deserialize 版本不匹配抛异常', () => {
      const data = { caravans: [], version: 999 };
      expect(() => caravan.deserialize(data as any)).toThrow();
    });

    it('reset 恢复初始状态', () => {
      const caravans = caravan.getCaravans();
      caravan.assignGuard(caravans[0].id, 'hero_001');
      caravan.addCaravan();

      caravan.reset();
      expect(caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
      const newCaravans = caravan.getCaravans();
      for (const c of newCaravans) {
        expect(c.guardHeroId).toBeNull();
        expect(c.status).toBe('idle');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 8. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('update 不抛异常', () => {
      expect(() => caravan.update(16)).not.toThrow();
    });

    it('getState 返回商队列表', () => {
      const state = caravan.getState();
      expect(Array.isArray(state)).toBe(true);
      expect(state).toHaveLength(INITIAL_CARAVAN_COUNT);
    });
  });
});
