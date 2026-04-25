/**
 * ResourceTradeEngine 单元测试
 *
 * 覆盖范围：
 * - 基础汇率查询
 * - 交易执行（4个交易对）
 * - 5% 手续费计算
 * - 市集等级解锁条件
 * - 资源保护线（粮草最低10、铜钱安全线500）
 * - 边界条件（金额为0、余额不足、不支持的交易对）
 * - canTradeResource 检查
 * - getSupportedTradePairs
 */

import { describe, it, expect } from 'vitest';
import { ResourceTradeEngine } from '../ResourceTradeEngine';
import type { ResourceTradeDeps } from '../ResourceTradeEngine';
import type { ResourceType } from '../../../../shared/types';

// ── 测试辅助 ──

/** 创建 mock deps，默认市场等级 5，资源充足 */
function createMockDeps(overrides?: Partial<ResourceTradeDeps & { resources: Record<string, number> }>): {
  deps: ResourceTradeDeps;
  resources: Record<string, number>;
  consumed: Array<{ type: ResourceType; amount: number }>;
  added: Array<{ type: ResourceType; amount: number }>;
} {
  const resources: Record<string, number> = overrides?.resources ?? {
    grain: 10000,
    gold: 10000,
    troops: 5000,
    techPoint: 0,
    mandate: 0,
    recruitToken: 0,
  };
  const consumed: Array<{ type: ResourceType; amount: number }> = [];
  const added: Array<{ type: ResourceType; amount: number }> = [];

  const deps: ResourceTradeDeps = {
    getResourceAmount: (type: ResourceType) => resources[type] ?? 0,
    consumeResource: (type: ResourceType, amount: number) => {
      resources[type] = (resources[type] ?? 0) - amount;
      consumed.push({ type, amount });
      return amount;
    },
    addResource: (type: ResourceType, amount: number) => {
      resources[type] = (resources[type] ?? 0) + amount;
      added.push({ type, amount });
      return amount;
    },
    getMarketLevel: () => overrides?.getMarketLevel?.() ?? 5,
  };

  return { deps, resources, consumed, added };
}

/** 创建引擎并注入 deps */
function createEngine(mockDeps?: Partial<ResourceTradeDeps & { resources: Record<string, number> }>): {
  engine: ResourceTradeEngine;
  deps: ResourceTradeDeps;
  resources: Record<string, number>;
  consumed: Array<{ type: ResourceType; amount: number }>;
  added: Array<{ type: ResourceType; amount: number }>;
} {
  const { deps, resources, consumed, added } = createMockDeps(mockDeps);
  const engine = new ResourceTradeEngine();
  engine.init({ eventBus: null as never, config: null as never, registry: null as never });
  engine.setDeps(deps);
  return { engine, deps, resources, consumed, added };
}

// ═══════════════════════════════════════════════
// 汇率查询
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine 汇率查询', () => {
  it('should return correct rate for grain→gold (0.1)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('grain', 'gold')).toBe(0.1);
  });

  it('should return correct rate for gold→grain (8)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('gold', 'grain')).toBe(8);
  });

  it('should return correct rate for grain→troops (0.05)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('grain', 'troops')).toBe(0.05);
  });

  it('should return correct rate for gold→techPoint (0.01)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('gold', 'techPoint')).toBe(0.01);
  });

  it('should return 0 for unsupported pair', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('troops', 'gold')).toBe(0);
    expect(engine.getResourceTradeRate('mandate', 'grain')).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 交易执行
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine 交易执行', () => {
  it('should trade grain→gold with 5% fee', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('grain', 'gold', 1000);

    expect(result.success).toBe(true);
    expect(result.received).toBe(95);   // 1000 * 0.1 = 100 gross, fee=5, received=95
    expect(result.fee).toBe(5);
    expect(resources.grain).toBe(9000);
    expect(resources.gold).toBe(10095);
  });

  it('should trade gold→grain with 5% fee', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('gold', 'grain', 100);

    expect(result.success).toBe(true);
    // 100 * 8 = 800 gross, fee = floor(800 * 0.05) = 40, received = 800 - 40 = 760
    expect(result.received).toBe(760);
    expect(result.fee).toBe(40);
    expect(resources.gold).toBe(9900);
    expect(resources.grain).toBe(10760);
  });

  it('should trade grain→troops with 5% fee', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('grain', 'troops', 1000);

    expect(result.success).toBe(true);
    // 1000 * 0.05 = 50 gross, fee = floor(50 * 0.05) = 2, received = 50 - 2 = 48
    expect(result.received).toBe(48);
    expect(result.fee).toBe(2);
    expect(resources.grain).toBe(9000);
    expect(resources.troops).toBe(5048);
  });

  it('should trade gold→techPoint with 5% fee', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('gold', 'techPoint', 1000);

    expect(result.success).toBe(true);
    // 1000 * 0.01 = 10 gross, fee = floor(10 * 0.05) = 0, received = 10 - 0 = 10
    expect(result.received).toBe(10);
    expect(result.fee).toBe(0);
    expect(resources.gold).toBe(9000);
    expect(resources.techPoint).toBe(10);
  });
});

// ═══════════════════════════════════════════════
// 市集等级解锁
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine 市集等级解锁', () => {
  it('should fail when market level < 5', () => {
    const { engine } = createEngine({ getMarketLevel: () => 4 });
    const result = engine.tradeResource('grain', 'gold', 1000);

    expect(result.success).toBe(false);
    expect(result.error).toContain('市集等级');
  });

  it('should succeed when market level = 5', () => {
    const { engine } = createEngine({ getMarketLevel: () => 5 });
    const result = engine.tradeResource('grain', 'gold', 1000);

    expect(result.success).toBe(true);
  });

  it('should succeed when market level > 5', () => {
    const { engine } = createEngine({ getMarketLevel: () => 10 });
    const result = engine.tradeResource('grain', 'gold', 1000);

    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 资源保护线
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine 资源保护线', () => {
  it('should enforce minimum grain reserve of 10', () => {
    const { engine } = createEngine({ resources: { grain: 100, gold: 0, troops: 0, techPoint: 0, mandate: 0, recruitToken: 0 } });

    // 交易 90 应成功（剩余 10）
    const result1 = engine.tradeResource('grain', 'gold', 90);
    expect(result1.success).toBe(true);

    // 交易 1 应失败（粮草保护）
    const result2 = engine.tradeResource('grain', 'gold', 1);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('粮草保护');
  });

  it('should enforce gold safety line of 500', () => {
    const { engine } = createEngine({ resources: { grain: 0, gold: 400, troops: 0, techPoint: 0, mandate: 0, recruitToken: 0 } });

    const result = engine.tradeResource('gold', 'grain', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('安全线');
  });

  it('should allow gold trade when above safety line', () => {
    const { engine } = createEngine({ resources: { grain: 0, gold: 600, troops: 0, techPoint: 0, mandate: 0, recruitToken: 0 } });

    const result = engine.tradeResource('gold', 'grain', 100);
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 边界条件
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine 边界条件', () => {
  it('should reject zero amount', () => {
    const { engine } = createEngine();
    const result = engine.tradeResource('grain', 'gold', 0);

    expect(result.success).toBe(false);
    expect(result.error).toContain('大于 0');
  });

  it('should reject negative amount', () => {
    const { engine } = createEngine();
    const result = engine.tradeResource('grain', 'gold', -100);

    expect(result.success).toBe(false);
    expect(result.error).toContain('大于 0');
  });

  it('should reject unsupported trade pair', () => {
    const { engine } = createEngine();
    const result = engine.tradeResource('troops', 'gold', 100);

    expect(result.success).toBe(false);
    expect(result.error).toContain('不支持');
  });

  it('should reject when insufficient resources', () => {
    const { engine } = createEngine({ resources: { grain: 0, gold: 600, troops: 0, techPoint: 0, mandate: 0, recruitToken: 0 } });

    // gold=600 > safety line 500, but trying to trade 700 > 600
    const result = engine.tradeResource('gold', 'grain', 700);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不足');
  });

  it('should reject when deps not initialized', () => {
    const engine = new ResourceTradeEngine();
    engine.init({ eventBus: null as never, config: null as never, registry: null as never });
    // 没有 setDeps

    const result = engine.tradeResource('grain', 'gold', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('未初始化');
  });
});

// ═══════════════════════════════════════════════
// canTradeResource
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine canTradeResource', () => {
  it('should return canTrade=true for valid trade', () => {
    const { engine } = createEngine();
    const result = engine.canTradeResource('grain', 'gold', 1000);
    expect(result.canTrade).toBe(true);
  });

  it('should return canTrade=false with reason for low market level', () => {
    const { engine } = createEngine({ getMarketLevel: () => 3 });
    const result = engine.canTradeResource('grain', 'gold', 1000);
    expect(result.canTrade).toBe(false);
    expect(result.reason).toContain('市集等级');
  });

  it('should return canTrade=false with reason for insufficient resources', () => {
    const { engine } = createEngine({ resources: { grain: 0, gold: 600, troops: 0, techPoint: 0, mandate: 0, recruitToken: 0 } });
    const result = engine.canTradeResource('gold', 'grain', 700);
    expect(result.canTrade).toBe(false);
    expect(result.reason).toContain('不足');
  });

  it('should not modify resources when checking', () => {
    const { engine, resources } = createEngine();
    engine.canTradeResource('grain', 'gold', 1000);
    expect(resources.grain).toBe(10000);
    expect(resources.gold).toBe(10000);
  });
});

// ═══════════════════════════════════════════════
// getSupportedTradePairs
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine getSupportedTradePairs', () => {
  it('should return 4 trade pairs', () => {
    const { engine } = createEngine();
    const pairs = engine.getSupportedTradePairs();
    expect(pairs).toHaveLength(4);
  });

  it('should include all expected pairs', () => {
    const { engine } = createEngine();
    const pairs = engine.getSupportedTradePairs();
    const keys = pairs.map(p => `${p.from}→${p.to}`);

    expect(keys).toContain('grain→gold');
    expect(keys).toContain('gold→grain');
    expect(keys).toContain('grain→troops');
    expect(keys).toContain('gold→techPoint');
  });

  it('should have 5% fee rate for all pairs', () => {
    const { engine } = createEngine();
    const pairs = engine.getSupportedTradePairs();
    for (const pair of pairs) {
      expect(pair.fee).toBe(0.05);
    }
  });
});

// ═══════════════════════════════════════════════
// ISubsystem 接口
// ═══════════════════════════════════════════════
describe('ResourceTradeEngine ISubsystem', () => {
  it('should have name = resourceTrade', () => {
    const engine = new ResourceTradeEngine();
    expect(engine.name).toBe('resourceTrade');
  });

  it('should return state from getState()', () => {
    const { engine } = createEngine();
    const state = engine.getState();
    expect(state.supportedPairs).toBeDefined();
    expect(state.marketRequiredLevel).toBe(5);
    expect(state.feeRate).toBe(0.05);
    expect(state.minGrainReserve).toBe(10);
    expect(state.goldSafetyLine).toBe(500);
  });

  it('should reset without error', () => {
    const { engine } = createEngine();
    expect(() => engine.reset()).not.toThrow();
  });
});
