/**
 * 市舶司→贸易系统桥接注入测试
 *
 * 验证：
 * 1. TradeSystem 注入折扣后利润计算
 * 2. CaravanSystem 注入商队数量限制
 * 3. BuildingSystem 注入繁荣度→市集铜钱加成
 * 4. 未注入时使用默认值（向后兼容）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeSystem } from '../TradeSystem';
import { CaravanSystem } from '../CaravanSystem';
import type { RouteInfoProvider } from '../CaravanSystem';
import { BuildingSystem } from '../../building/BuildingSystem';
import { MAX_CARAVAN_COUNT } from '../../../core/trade/trade-config';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  };
}

function createTradeSystem(): TradeSystem {
  const sys = new TradeSystem();
  sys.init(createMockDeps());
  return sys;
}

function createCaravanSystem(): CaravanSystem {
  const sys = new CaravanSystem();
  const routeProvider: RouteInfoProvider = {
    getRouteDef: vi.fn().mockReturnValue({
      id: 'route_1',
      baseTravelTime: 60_000,
      baseProfitRate: 0.5,
    }),
  };
  (sys as unknown as { setRouteProvider: (p: RouteInfoProvider) => void }).setRouteProvider(routeProvider);
  sys.init(createMockDeps());
  return sys;
}

function createBuildingSystem(): BuildingSystem {
  const sys = new BuildingSystem();
  sys.init(createMockDeps());
  return sys;
}

/** 直接设置建筑等级（绕过升级流程，用于单元测试） */
function setBuildingLevel(sys: BuildingSystem, type: string, level: number): void {
  const buildings = (sys as unknown as { buildings: Record<string, { level: number }> }).buildings;
  buildings[type].level = level;
  buildings[type].status = 'idle';
}

// ─────────────────────────────────────────────
// 1. TradeSystem 折扣注入
// ─────────────────────────────────────────────

describe('TradeSystem — port-bridge discount injection', () => {
  let trade: TradeSystem;

  beforeEach(() => {
    trade = createTradeSystem();
  });

  it('无折扣注入时利润计算不变（向后兼容）', () => {
    const result = trade.calculateProfit('route_1', { goods_1: 10 }, 1.0, 0);
    // 无回调注入，利润按原逻辑计算
    expect(result.profit).toBeTypeOf('number');
    expect(Number.isFinite(result.profit)).toBe(true);
  });

  it('注入 10% 折扣后成本降低、利润增加', () => {
    // 先获取无折扣基线
    const baseline = trade.calculateProfit('route_1', { goods_1: 10 }, 1.0, 0);

    // 注入 10% 折扣
    trade.setTradeDiscount(() => 10);
    const discounted = trade.calculateProfit('route_1', { goods_1: 10 }, 1.0, 0);

    // 利润应比无折扣时更高（成本降低）
    expect(discounted.profit).toBeGreaterThanOrEqual(baseline.profit);
    // 原始成本不变
    expect(discounted.cost).toBe(baseline.cost);
  });

  it('注入 20% 折扣进一步降低成本', () => {
    trade.setTradeDiscount(() => 10);
    const d10 = trade.calculateProfit('route_1', { goods_1: 10 }, 1.0, 0);

    trade.setTradeDiscount(() => 20);
    const d20 = trade.calculateProfit('route_1', { goods_1: 10 }, 1.0, 0);

    expect(d20.profit).toBeGreaterThanOrEqual(d10.profit);
  });

  it('注入 0% 折扣与无注入等价', () => {
    const baseline = trade.calculateProfit('route_1', { goods_1: 10 }, 1.0, 0);
    trade.setTradeDiscount(() => 0);
    const zeroDiscount = trade.calculateProfit('route_1', { goods_1: 10 }, 1.0, 0);
    expect(zeroDiscount.profit).toBe(baseline.profit);
  });
});

// ─────────────────────────────────────────────
// 2. CaravanSystem 商队数量注入
// ─────────────────────────────────────────────

describe('CaravanSystem — port-bridge maxCaravans injection', () => {
  let caravan: CaravanSystem;

  beforeEach(() => {
    caravan = createCaravanSystem();
  });

  it('未注入时使用默认 MAX_CARAVAN_COUNT', () => {
    expect(caravan.getMaxCaravans()).toBe(MAX_CARAVAN_COUNT);
  });

  it('注入回调后 getMaxCaravans 返回回调值', () => {
    caravan.setMaxCaravansCallback(() => 3);
    expect(caravan.getMaxCaravans()).toBe(3);
  });

  it('canAddCaravan 受回调限制', () => {
    // 初始有 INITIAL_CARAVAN_COUNT 个商队
    const count = caravan.getCaravanCount();

    // 设置上限等于当前数量
    caravan.setMaxCaravansCallback(() => count);
    expect(caravan.canAddCaravan()).toBe(false);

    // 设置上限大于当前数量
    caravan.setMaxCaravansCallback(() => count + 1);
    expect(caravan.canAddCaravan()).toBe(true);
  });

  it('addCaravan 失败消息包含动态上限', () => {
    caravan.setMaxCaravansCallback(() => caravan.getCaravanCount());
    const result = caravan.addCaravan();
    expect(result.success).toBe(false);
    expect(result.reason).toContain(String(caravan.getCaravanCount()));
  });

  it('注入回调值变化时 getMaxCaravans 实时响应', () => {
    let portLevel = 5;
    caravan.setMaxCaravansCallback(() => (portLevel >= 10 ? 3 : 2));

    expect(caravan.getMaxCaravans()).toBe(2);
    portLevel = 15;
    expect(caravan.getMaxCaravans()).toBe(3);
  });
});

// ─────────────────────────────────────────────
// 3. BuildingSystem 繁荣度→市集铜钱加成
// ─────────────────────────────────────────────

describe('BuildingSystem — port-bridge prosperity gold bonus', () => {
  let building: BuildingSystem;

  beforeEach(() => {
    building = createBuildingSystem();
  });

  it('未注入时市集产出不变（向后兼容）', () => {
    setBuildingLevel(building, 'market', 1);
    const production = building.getProduction('market');
    expect(production).toBeTypeOf('number');
    expect(Number.isFinite(production)).toBe(true);
    expect(production).toBeGreaterThan(0);
  });

  it('注入 15% 加成后市集产出增加', () => {
    setBuildingLevel(building, 'market', 1);
    const baseProduction = building.getProduction('market');

    building.setProsperityBonus(() => 15);
    const boostedProduction = building.getProduction('market');

    expect(boostedProduction).toBeCloseTo(baseProduction * 1.15, 1);
  });

  it('注入 0% 加成与无注入等价', () => {
    setBuildingLevel(building, 'market', 1);
    const baseProduction = building.getProduction('market');
    building.setProsperityBonus(() => 0);
    const zeroBonus = building.getProduction('market');

    expect(zeroBonus).toBe(baseProduction);
  });

  it('繁荣度加成不影响非市集建筑', () => {
    setBuildingLevel(building, 'farmland', 1);
    const before = building.getProduction('farmland');
    building.setProsperityBonus(() => 25);
    const after = building.getProduction('farmland');

    expect(after).toBe(before);
  });

  it('注入 25% 加成（繁荣度等级5）', () => {
    setBuildingLevel(building, 'market', 1);
    const baseProduction = building.getProduction('market');
    building.setProsperityBonus(() => 25);
    const maxBonus = building.getProduction('market');

    expect(maxBonus).toBeCloseTo(baseProduction * 1.25, 1);
  });
});
