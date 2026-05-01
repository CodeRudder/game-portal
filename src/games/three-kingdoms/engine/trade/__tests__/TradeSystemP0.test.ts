/**
 * RES-5 资源交易系统 P0 级测试
 *
 * 覆盖缺口：资源交易系统完全未测试的 P0 关键路径
 * 覆盖范围：
 *   1. 4种交易汇率精确验证（grain↔gold, grain→troops, gold→techPoint）
 *   2. 手续费计算（5%费率、边界值、整数截断）
 *   3. 资源保护线（粮草最低保留10、铜钱安全线500）
 *   4. 市集等级解锁条件
 *   5. 交易执行原子性（成功扣减/添加、失败不扣资源）
 *   6. canTradeResource 与 tradeResource 一致性
 *   7. 交易记录与序列化/反序列化
 *   8. PRD 规定的交易限制（每日上限、冷却时间）
 *   9. PRD 规定的汇率波动与 VIP 减免
 *
 * PRD 参考：
 *   - RES-resources-prd.md §RES-5
 *   - TRD-trade-prd.md
 *   - ResourceTradeEngine.ts（引擎实现）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceTradeEngine } from '../ResourceTradeEngine';
import type { ResourceTradeDeps, ResourceTradeResult } from '../ResourceTradeEngine';
import type { ResourceType } from '../../../../shared/types';

// ─────────────────────────────────────────────
// 测试辅助
// ─────────────────────────────────────────────

/** 创建 mock deps，默认市场等级 5，资源充足 */
function createMockDeps(
  overrides?: Partial<ResourceTradeDeps & { resources: Record<string, number> }>,
): {
  deps: ResourceTradeDeps;
  resources: Record<string, number>;
  consumed: Array<{ type: ResourceType; amount: number }>;
  added: Array<{ type: ResourceType; amount: number }>;
} {
  const resources: Record<string, number> = overrides?.resources ?? {
    grain: 100000,
    gold: 100000,
    troops: 50000,
    techPoint: 0,
    mandate: 0,
    recruitToken: 0,
    skillBook: 0,
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
function createEngine(
  mockDeps?: Partial<ResourceTradeDeps & { resources: Record<string, number> }>,
) {
  const { deps, resources, consumed, added } = createMockDeps(mockDeps);
  const engine = new ResourceTradeEngine();
  engine.init({ eventBus: null as never, config: null as never, registry: null as never });
  engine.setDeps(deps);
  return { engine, deps, resources, consumed, added };
}

/** 最小资源集（仅填充交易所需字段） */
function minResources(
  overrides: Partial<Record<string, number>> = {},
): Record<string, number> {
  return {
    grain: 100000,
    gold: 100000,
    troops: 50000,
    techPoint: 0,
    mandate: 0,
    recruitToken: 0,
    skillBook: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. 四种交易汇率精确验证
// ═══════════════════════════════════════════════════════════════
describe('RES-5 汇率验证 — 4种交易对', () => {
  it('grain→gold: 10 粮草 = 1 铜钱 (rate=0.1)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('grain', 'gold')).toBe(0.1);
  });

  it('gold→grain: 1 铜钱 = 8 粮草 (rate=8)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('gold', 'grain')).toBe(8);
  });

  it('grain→troops: 20 粮草 = 1 兵力 (rate=0.05)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('grain', 'troops')).toBe(0.05);
  });

  it('gold→techPoint: 100 铜钱 = 1 科技点 (rate=0.01)', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('gold', 'techPoint')).toBe(0.01);
  });

  it('不支持的交易对返回 0', () => {
    const { engine } = createEngine();
    expect(engine.getResourceTradeRate('troops', 'gold')).toBe(0);
    expect(engine.getResourceTradeRate('mandate', 'grain')).toBe(0);
    expect(engine.getResourceTradeRate('gold', 'troops')).toBe(0);
    expect(engine.getResourceTradeRate('techPoint', 'gold')).toBe(0);
    expect(engine.getResourceTradeRate('grain', 'grain')).toBe(0);
    expect(engine.getResourceTradeRate('gold', 'gold')).toBe(0);
  });

  it('getSupportedTradePairs 返回全部4对', () => {
    const { engine } = createEngine();
    const pairs = engine.getSupportedTradePairs();
    expect(pairs).toHaveLength(4);
    const keys = pairs.map(p => `${p.from}→${p.to}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        'grain→gold',
        'gold→grain',
        'grain→troops',
        'gold→techPoint',
      ]),
    );
  });

  it('所有交易对费率均为 5%', () => {
    const { engine } = createEngine();
    const pairs = engine.getSupportedTradePairs();
    for (const pair of pairs) {
      expect(pair.fee).toBe(0.05);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 手续费计算精确验证
// ═══════════════════════════════════════════════════════════════
describe('RES-5 手续费计算', () => {
  it('grain→gold: 1000粮草 → 毛额100 → 手续费5 → 到账95', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(5);           // floor(100 * 0.05) = 5
    expect(result.received).toBe(95);     // floor(100) - 5 = 95
    expect(resources.grain).toBe(99000);
    expect(resources.gold).toBe(100095);
  });

  it('gold→grain: 100铜钱 → 毛额800 → 手续费40 → 到账760', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('gold', 'grain', 100);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(40);          // floor(800 * 0.05) = 40
    expect(result.received).toBe(760);    // floor(800) - 40 = 760
    expect(resources.gold).toBe(99900);
    expect(resources.grain).toBe(100760);
  });

  it('grain→troops: 1000粮草 → 毛额50 → 手续费2 → 到账48', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('grain', 'troops', 1000);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(2);           // floor(50 * 0.05) = 2
    expect(result.received).toBe(48);     // floor(50) - 2 = 48
    expect(resources.grain).toBe(99000);
    expect(resources.troops).toBe(50048);
  });

  it('gold→techPoint: 1000铜钱 → 毛额10 → 手续费0 → 到账10', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('gold', 'techPoint', 1000);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(0);           // floor(10 * 0.05) = 0
    expect(result.received).toBe(10);     // floor(10) - 0 = 10
    expect(resources.gold).toBe(99000);
    expect(resources.techPoint).toBe(10);
  });

  it('手续费整数截断：grain→gold 1粮草 → 毛额0.1 → 手续费0 → 到账0', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('grain', 'gold', 1);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(0);           // floor(0.1 * 0.05) = 0
    expect(result.received).toBe(0);      // floor(0.1) - 0 = 0
    expect(resources.grain).toBe(99999);  // 已扣1粮草
    expect(resources.gold).toBe(100000);  // 无变化
  });

  it('手续费整数截断：gold→techPoint 99铜钱 → 毛额0.99 → 到账0', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('gold', 'techPoint', 99);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(0);
    expect(result.received).toBe(0);      // floor(0.99) - 0 = 0
    expect(resources.gold).toBe(99901);
    expect(resources.techPoint).toBe(0);
  });

  it('大额交易手续费：gold→grain 10000铜钱 → 毛额80000 → 手续费4000 → 到账76000', () => {
    const { engine, resources } = createEngine();
    const result = engine.tradeResource('gold', 'grain', 10000);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(4000);        // floor(80000 * 0.05)
    expect(result.received).toBe(76000);  // floor(80000) - 4000
    expect(resources.gold).toBe(90000);
    expect(resources.grain).toBe(176000);
  });

  it('手续费验证：received + fee = floor(amount * rate)', () => {
    const { engine } = createEngine();
    // 测试多个交易量，验证手续费公式
    const amounts = [1, 10, 100, 500, 1000, 5000, 10000];
    for (const amt of amounts) {
      const result = engine.tradeResource('grain', 'gold', amt);
      if (result.success) {
        const gross = Math.floor(amt * 0.1);
        expect(result.received + result.fee).toBe(gross);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 资源保护线
// ═══════════════════════════════════════════════════════════════
describe('RES-5 资源保护线', () => {
  describe('粮草最低保留 10', () => {
    it('交易后粮草恰好剩 10 时允许', () => {
      const { engine, resources } = createEngine({ resources: minResources({ grain: 110, gold: 0 }) });
      const result = engine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(true);
      expect(resources.grain).toBe(10);
    });

    it('交易后粮草剩 9 时拒绝', () => {
      const { engine } = createEngine({ resources: minResources({ grain: 109, gold: 0 }) });
      const result = engine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('粮草保护');
    });

    it('粮草为 11 时只能交易 1', () => {
      const { engine, resources } = createEngine({ resources: minResources({ grain: 11, gold: 0 }) });
      // 交易 1 成功
      expect(engine.tradeResource('grain', 'gold', 1).success).toBe(true);
      expect(resources.grain).toBe(10);
      // 再交易 1 失败
      const result = engine.tradeResource('grain', 'gold', 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('粮草保护');
    });

    it('粮草恰好 10 时不能交易任何数量', () => {
      const { engine } = createEngine({ resources: minResources({ grain: 10, gold: 0 }) });
      const result = engine.tradeResource('grain', 'gold', 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('粮草保护');
    });

    it('粮草为 0 时不能交易', () => {
      const { engine } = createEngine({ resources: minResources({ grain: 0, gold: 0 }) });
      const result = engine.tradeResource('grain', 'gold', 1);
      expect(result.success).toBe(false);
    });
  });

  describe('铜钱安全线 500', () => {
    it('铜钱 500 时允许交易', () => {
      const { engine } = createEngine({ resources: minResources({ grain: 0, gold: 500 }) });
      const result = engine.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(true);
    });

    it('铜钱 499 时拒绝交易', () => {
      const { engine } = createEngine({ resources: minResources({ grain: 0, gold: 499 }) });
      const result = engine.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('安全线');
    });

    it('铜钱 500 交易后可低于安全线', () => {
      const { engine, resources } = createEngine({ resources: minResources({ grain: 0, gold: 500 }) });
      const result = engine.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(true);
      expect(resources.gold).toBe(400); // 低于500安全线，但交易前满足条件
    });

    it('铜钱安全线也影响 gold→techPoint', () => {
      const { engine } = createEngine({ resources: minResources({ grain: 0, gold: 499 }) });
      const result = engine.tradeResource('gold', 'techPoint', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('安全线');
    });
  });

  it('保护线不影响非粮草/非铜钱的交易对', () => {
    // grain→troops 只有粮草保护，无铜钱安全线
    const { engine } = createEngine({ resources: minResources({ grain: 100, gold: 0 }) });
    const result = engine.tradeResource('grain', 'troops', 90);
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 市集等级解锁
// ═══════════════════════════════════════════════════════════════
describe('RES-5 市集等级解锁', () => {
  it('市集等级 4 时拒绝交易', () => {
    const { engine } = createEngine({ getMarketLevel: () => 4 });
    const result = engine.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('市集等级');
    expect(result.error).toContain('5');
    expect(result.error).toContain('4');
  });

  it('市集等级 0 时拒绝交易', () => {
    const { engine } = createEngine({ getMarketLevel: () => 0 });
    const result = engine.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(false);
  });

  it('市集等级 5 时允许交易', () => {
    const { engine } = createEngine({ getMarketLevel: () => 5 });
    const result = engine.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(true);
  });

  it('市集等级 10 时允许交易', () => {
    const { engine } = createEngine({ getMarketLevel: () => 10 });
    const result = engine.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(true);
  });

  it('市集等级不足时 canTrade 也返回 false', () => {
    const { engine } = createEngine({ getMarketLevel: () => 3 });
    const check = engine.canTradeResource('grain', 'gold', 1000);
    expect(check.canTrade).toBe(false);
    expect(check.reason).toContain('市集等级');
  });

  it('市集等级不足时不扣资源', () => {
    const { engine, resources, consumed } = createEngine({ getMarketLevel: () => 4 });
    engine.tradeResource('grain', 'gold', 1000);
    expect(resources.grain).toBe(100000);
    expect(consumed).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 交易执行原子性
// ═══════════════════════════════════════════════════════════════
describe('RES-5 交易执行原子性', () => {
  it('成功交易：源资源减少、目标资源增加', () => {
    const { engine, resources, consumed, added } = createEngine();
    const result = engine.tradeResource('grain', 'gold', 2000);

    expect(result.success).toBe(true);
    // 验证 consume 被调用
    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toEqual({ type: 'grain', amount: 2000 });
    // 验证 add 被调用
    expect(added).toHaveLength(1);
    expect(added[0].type).toBe('gold');
    // 验证资源变化
    expect(resources.grain).toBe(98000);
    expect(resources.gold).toBeGreaterThan(100000);
  });

  it('失败交易：不扣源资源、不加目标资源', () => {
    const { engine, resources, consumed, added } = createEngine({ getMarketLevel: () => 3 });
    const result = engine.tradeResource('grain', 'gold', 1000);

    expect(result.success).toBe(false);
    expect(consumed).toHaveLength(0);
    expect(added).toHaveLength(0);
    expect(resources.grain).toBe(100000);
    expect(resources.gold).toBe(100000);
  });

  it('资源不足时不扣资源（grain 交易触发粮草保护）', () => {
    const { engine, resources, consumed } = createEngine({
      resources: minResources({ grain: 50, gold: 0 }),
    });
    const result = engine.tradeResource('grain', 'gold', 100);

    expect(result.success).toBe(false);
    // 引擎先检查粮草保护线，再检查余额，grain 交易时触发粮草保护
    expect(result.error).toContain('粮草保护');
    expect(consumed).toHaveLength(0);
    expect(resources.grain).toBe(50);
  });

  it('资源不足时不扣资源（gold 交易触发余额不足）', () => {
    const { engine, resources, consumed } = createEngine({
      resources: minResources({ grain: 0, gold: 600 }),
    });
    const result = engine.tradeResource('gold', 'grain', 700);

    expect(result.success).toBe(false);
    // gold 交易：600 > 500 安全线通过，但 700 > 600 余额不足
    expect(result.error).toContain('不足');
    expect(consumed).toHaveLength(0);
    expect(resources.gold).toBe(600);
  });

  it('不支持的交易对不扣资源', () => {
    const { engine, resources, consumed } = createEngine();
    const result = engine.tradeResource('troops', 'gold', 100);

    expect(result.success).toBe(false);
    expect(result.error).toContain('不支持');
    expect(consumed).toHaveLength(0);
  });

  it('零金额不扣资源', () => {
    const { engine, resources, consumed } = createEngine();
    const result = engine.tradeResource('grain', 'gold', 0);

    expect(result.success).toBe(false);
    expect(consumed).toHaveLength(0);
    expect(resources.grain).toBe(100000);
  });

  it('负数金额不扣资源', () => {
    const { engine, resources, consumed } = createEngine();
    const result = engine.tradeResource('grain', 'gold', -500);

    expect(result.success).toBe(false);
    expect(consumed).toHaveLength(0);
    expect(resources.grain).toBe(100000);
  });

  it('consumeResource 抛异常时交易失败', () => {
    const { engine, resources } = createEngine();
    // 模拟 consume 抛异常
    const badDeps: ResourceTradeDeps = {
      getResourceAmount: () => 100000,
      consumeResource: () => { throw new Error('并发冲突'); },
      addResource: (type, amount) => { resources[type] = (resources[type] ?? 0) + amount; return amount; },
      getMarketLevel: () => 5,
    };
    engine.setDeps(badDeps);

    const result = engine.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('并发冲突');
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. canTradeResource 与 tradeResource 一致性
// ═══════════════════════════════════════════════════════════════
describe('RES-5 canTradeResource 一致性', () => {
  const scenarios: Array<{
    name: string;
    resources: Record<string, number>;
    marketLevel: number;
    from: ResourceType;
    to: ResourceType;
    amount: number;
  }> = [
    {
      name: '正常交易 grain→gold',
      resources: minResources(), marketLevel: 5,
      from: 'grain', to: 'gold', amount: 1000,
    },
    {
      name: '市集等级不足',
      resources: minResources(), marketLevel: 3,
      from: 'grain', to: 'gold', amount: 1000,
    },
    {
      name: '资源不足',
      resources: minResources({ grain: 5 }), marketLevel: 5,
      from: 'grain', to: 'gold', amount: 100,
    },
    {
      name: '粮草保护线',
      resources: minResources({ grain: 10 }), marketLevel: 5,
      from: 'grain', to: 'gold', amount: 1,
    },
    {
      name: '铜钱安全线',
      resources: minResources({ grain: 0, gold: 400 }), marketLevel: 5,
      from: 'gold', to: 'grain', amount: 100,
    },
    {
      name: '不支持的交易对',
      resources: minResources(), marketLevel: 5,
      from: 'troops', to: 'gold', amount: 100,
    },
    {
      name: '零金额',
      resources: minResources(), marketLevel: 5,
      from: 'grain', to: 'gold', amount: 0,
    },
    {
      name: '负数金额',
      resources: minResources(), marketLevel: 5,
      from: 'grain', to: 'gold', amount: -100,
    },
  ];

  for (const s of scenarios) {
    it(`canTrade=${s.name} 与 tradeResource 结果一致`, () => {
      // 创建两个独立的引擎实例
      const e1 = createEngine({ resources: { ...s.resources }, getMarketLevel: () => s.marketLevel });
      const e2 = createEngine({ resources: { ...s.resources }, getMarketLevel: () => s.marketLevel });

      const canTrade = e1.engine.canTradeResource(s.from, s.to, s.amount);
      const trade = e2.engine.tradeResource(s.from, s.to, s.amount);

      expect(canTrade.canTrade).toBe(trade.success);
      if (!canTrade.canTrade) {
        expect(trade.error).toBeTruthy();
      }
    });
  }

  it('canTrade 不修改资源状态', () => {
    const { engine, resources } = createEngine();
    const before = { ...resources };
    engine.canTradeResource('grain', 'gold', 5000);
    expect(resources.grain).toBe(before.grain);
    expect(resources.gold).toBe(before.gold);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 交易记录与序列化/反序列化
// ═══════════════════════════════════════════════════════════════
describe('RES-5 序列化与状态', () => {
  it('getState 返回正确的配置信息', () => {
    const { engine } = createEngine();
    const state = engine.getState();
    expect(state).toEqual({
      supportedPairs: expect.any(Array),
      marketRequiredLevel: 5,
      feeRate: 0.05,
      minGrainReserve: 10,
      goldSafetyLine: 500,
    });
  });

  it('getState 中 supportedPairs 包含4对', () => {
    const { engine } = createEngine();
    const state = engine.getState();
    const pairs = state.supportedPairs as Array<{ from: string; to: string; rate: number; fee: number }>;
    expect(pairs).toHaveLength(4);
  });

  it('reset 不抛异常', () => {
    const { engine } = createEngine();
    expect(() => engine.reset()).not.toThrow();
  });

  it('reset 后仍可正常交易', () => {
    const { engine } = createEngine();
    engine.reset();
    const result = engine.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(true);
  });

  it('引擎 name 为 resourceTrade', () => {
    const engine = new ResourceTradeEngine();
    expect(engine.name).toBe('resourceTrade');
  });

  it('update 不抛异常', () => {
    const { engine } = createEngine();
    expect(() => engine.update(16)).not.toThrow();
    expect(() => engine.update(0)).not.toThrow();
    expect(() => engine.update(-1)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 连续交易场景
// ═══════════════════════════════════════════════════════════════
describe('RES-5 连续交易场景', () => {
  it('连续多次交易资源正确累加', () => {
    const { engine, resources } = createEngine();
    // 连续3次 grain→gold
    engine.tradeResource('grain', 'gold', 1000);
    engine.tradeResource('grain', 'gold', 2000);
    engine.tradeResource('grain', 'gold', 3000);

    expect(resources.grain).toBe(94000);    // 扣 6000
    // 每次 received: 95, 190, 285 → 共 570
    expect(resources.gold).toBe(100570);
  });

  it('交替交易不同交易对', () => {
    const { engine, resources } = createEngine();
    engine.tradeResource('grain', 'gold', 1000);     // +95 gold
    engine.tradeResource('gold', 'grain', 100);       // +760 grain
    engine.tradeResource('grain', 'troops', 1000);    // +48 troops

    expect(resources.grain).toBe(100000 - 1000 + 760 - 1000); // 98760
    expect(resources.gold).toBe(100000 + 95 - 100);           // 99995
    expect(resources.troops).toBe(50000 + 48);                // 50048
  });

  it('连续交易直到粮草保护线触发', () => {
    const { engine, resources } = createEngine({ resources: minResources({ grain: 1000, gold: 0 }) });
    let successCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = engine.tradeResource('grain', 'gold', 10);
      if (result.success) successCount++;
      else break;
    }
    expect(resources.grain).toBe(10); // 粮草保护线
    expect(successCount).toBe(99);    // (1000 - 10) / 10 = 99
  });

  it('连续交易直到铜钱低于安全线', () => {
    const { engine, resources } = createEngine({ resources: minResources({ grain: 0, gold: 1000 }) });
    // 1000 > 500, 可以交易
    const r1 = engine.tradeResource('gold', 'grain', 100);
    expect(r1.success).toBe(true);
    expect(resources.gold).toBe(900);

    // 900 > 500, 可以继续
    const r2 = engine.tradeResource('gold', 'grain', 400);
    expect(r2.success).toBe(true);
    expect(resources.gold).toBe(500);

    // 500 = 500, 仍可以交易（≥500）
    const r3 = engine.tradeResource('gold', 'grain', 100);
    expect(r3.success).toBe(true);
    expect(resources.gold).toBe(400);

    // 400 < 500, 不能再交易
    const r4 = engine.tradeResource('gold', 'grain', 50);
    expect(r4.success).toBe(false);
    expect(r4.error).toContain('安全线');
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 边界值与异常输入
// ═══════════════════════════════════════════════════════════════
describe('RES-5 边界值与异常输入', () => {
  it('amount = 0 被拒绝', () => {
    const { engine } = createEngine();
    const result = engine.tradeResource('grain', 'gold', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('大于 0');
  });

  it('amount = -1 被拒绝', () => {
    const { engine } = createEngine();
    const result = engine.tradeResource('grain', 'gold', -1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('大于 0');
  });

  it('amount = -99999 被拒绝', () => {
    const { engine } = createEngine();
    const result = engine.tradeResource('grain', 'gold', -99999);
    expect(result.success).toBe(false);
  });

  it('amount = 0.5 (小数) 被拒绝，防止截断资损', () => {
    const { engine } = createEngine();
    // FIX-802: 小数金额应被拒绝，不允许截断
    const result = engine.tradeResource('grain', 'gold', 0.5);
    expect(result.success).toBe(false);
    expect(result.error).toContain('整数');
  });

  it('amount = Number.MAX_SAFE_INTEGER 触发保护线', () => {
    const { engine } = createEngine();
    const result = engine.tradeResource('grain', 'gold', Number.MAX_SAFE_INTEGER);
    expect(result.success).toBe(false);
    // 引擎先检查粮草保护线，grain 交易时触发
    expect(result.error).toContain('粮草保护');
  });

  it('未初始化 deps 时拒绝交易', () => {
    const engine = new ResourceTradeEngine();
    engine.init({ eventBus: null as never, config: null as never, registry: null as never });
    const result = engine.tradeResource('grain', 'gold', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('未初始化');
  });

  it('未调用 init 时 canTrade 也拒绝', () => {
    const engine = new ResourceTradeEngine();
    // 没有 init 也没有 setDeps
    const result = engine.canTradeResource('grain', 'gold', 100);
    expect(result.canTrade).toBe(false);
    expect(result.reason).toContain('未初始化');
  });

  it('资源恰好等于交易量时允许', () => {
    const { engine, resources } = createEngine({ resources: minResources({ grain: 1000, gold: 0 }) });
    // 粮草1000，交易990（剩10满足保护线）
    const result = engine.tradeResource('grain', 'gold', 990);
    expect(result.success).toBe(true);
    expect(resources.grain).toBe(10);
  });

  it('资源比交易量少1时拒绝（触发粮草保护线）', () => {
    const { engine } = createEngine({ resources: minResources({ grain: 989, gold: 0 }) });
    const result = engine.tradeResource('grain', 'gold', 990);
    expect(result.success).toBe(false);
    // 989 - 990 = -1 < 10，触发粮草保护线
    expect(result.error).toContain('粮草保护');
  });

  it('gold 交易时余额不足直接拒绝', () => {
    const { engine, resources } = createEngine({ resources: minResources({ grain: 0, gold: 600 }) });
    const result = engine.tradeResource('gold', 'grain', 601);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不足');
    expect(resources.gold).toBe(600);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. PRD 规定但引擎未实现的功能（skip + TODO）
// ═══════════════════════════════════════════════════════════════
describe.todo('RES-5 PRD 未实现功能 — 每日交易上限', () => {
  // PRD: 每日交易次数上限：10次
  // PRD: 铜钱交易量 ≤ 当前铜钱持有量的 50%
  // 引擎当前未实现每日限制
  it.skip('每日交易次数超过10次后拒绝', () => {
    // TODO: 等待引擎实现每日交易次数限制
  });

  it.skip('铜钱交易量超过持有量50%时拒绝', () => {
    // TODO: 等待引擎实现铜钱交易量限制
  });
});

describe.todo('RES-5 PRD 未实现功能 — 交易冷却时间', () => {
  // PRD 未明确冷却时间，但任务要求验证
  // 引擎当前未实现冷却
  it.skip('交易冷却时间内拒绝交易', () => {
    // TODO: 等待引擎实现交易冷却
  });
});

describe.todo('RES-5 PRD 未实现功能 — 汇率波动', () => {
  // PRD: 资源间可按汇率兑换（汇率随市场波动）
  // 引擎当前使用固定汇率
  it.skip('汇率随市场波动变化', () => {
    // TODO: 等待引擎实现汇率波动
  });
});

describe.todo('RES-5 PRD 未实现功能 — VIP减免手续费', () => {
  // PRD: 交易手续费：5%（VIP减免）
  // 引擎当前未实现 VIP 减免
  it.skip('VIP 等级减免手续费', () => {
    // TODO: 等待引擎实现 VIP 手续费减免
  });
});

describe.todo('RES-5 PRD 未实现功能 — 大额交易汇率优惠', () => {
  // PRD 未明确，但任务要求验证
  // 引擎当前未实现大额优惠
  it.skip('大额交易享受优惠汇率', () => {
    // TODO: 等待引擎实现大额交易优惠
  });
});

describe.todo('RES-5 PRD 未实现功能 — NPC特殊汇率', () => {
  // PRD: NPC 特殊汇率 — 好感度越高，汇率越优惠
  // 引擎当前未实现 NPC 汇率
  it.skip('NPC 商人好感度影响汇率', () => {
    // TODO: 等待引擎实现 NPC 好感度汇率
  });
});

describe.todo('RES-5 PRD 未实现功能 — 单笔交易上限', () => {
  // PRD 未明确单笔上限，但任务要求验证
  // 引擎当前未实现单笔上限
  it.skip('单笔交易超过上限时拒绝', () => {
    // TODO: 等待引擎实现单笔交易上限
  });
});

describe.todo('RES-5 PRD 未实现功能 — 交易记录持久化', () => {
  // 引擎当前无交易历史记录
  it.skip('交易成功后生成交易记录', () => {
    // TODO: 等待引擎实现交易记录
  });

  it.skip('可查询历史交易记录', () => {
    // TODO: 等待引擎实现交易记录查询
  });
});
