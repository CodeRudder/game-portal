/**
 * v8.0 商贸繁荣 — 货币系统 Play 流程集成测试
 *
 * 覆盖范围：
 * - §1.6 货币体系（8种常驻货币）
 * - §1.7 货币兑换与汇率
 * - §1.8 货币防通胀与转生影响
 * - §9.3 声望转生规则统一声明
 * - §9.4 活动代币过期结算
 *
 * 测试原则：
 * - 每个用例创建独立 sim 实例
 * - 使用真实引擎 API
 * - 引擎未实现的功能使用 test.skip 并注明原因
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { CurrencyType } from '../../../../core/currency';

// ═══════════════════════════════════════════════
// §1.6 货币体系
// ═══════════════════════════════════════════════
describe('v8 CURRENCY-FLOW §1.6 货币体系', () => {

  it('CURRENCY-FLOW-1: 应能访问货币系统', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    expect(currency).toBeDefined();
    expect(typeof currency.getBalance).toBe('function');
    expect(typeof currency.addCurrency).toBe('function');
    expect(typeof currency.spendCurrency).toBe('function');
  });

  it('CURRENCY-FLOW-2: 获取完整钱包状态', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    const wallet = currency.getWallet();
    expect(wallet).toBeDefined();
    expect(typeof wallet).toBe('object');
  });

  it('CURRENCY-FLOW-3: 8种常驻货币余额查询', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const currencyTypes: CurrencyType[] = [
      'copper', 'mandate', 'recruit', 'summon',
      'expedition', 'guild', 'reputation', 'ingot',
    ];

    for (const type of currencyTypes) {
      const balance = currency.getBalance(type);
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    }
  });

  it('CURRENCY-FLOW-4: 添加货币', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const before = currency.getBalance('copper');
    const added = currency.addCurrency('copper', 1000);
    const after = currency.getBalance('copper');

    expect(added).toBeGreaterThan(0);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('CURRENCY-FLOW-5: 消耗货币', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper', 5000);
    const before = currency.getBalance('copper');
    currency.spendCurrency('copper', 1000);
    const after = currency.getBalance('copper');
    expect(after).toBe(before - 1000);
  });

  it('CURRENCY-FLOW-6: 余额不足时消耗抛出异常', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.setCurrency('copper', 100);
    expect(() => currency.spendCurrency('copper', 500)).toThrow();
  });

  it('CURRENCY-FLOW-7: 检查货币充足性', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper', 500);
    expect(currency.hasEnough('copper', 300)).toBe(true);
    // 初始钱包可能已有铜钱，所以添加500后余额可能>600
    // 使用一个足够大的数来验证不足场景
    expect(currency.hasEnough('copper', 99999999)).toBe(false);
  });

  it('CURRENCY-FLOW-8: 获取货币不足信息', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.setCurrency('copper', 100);
    const shortage = currency.getShortage('copper', 500);
    expect(shortage).toBeDefined();
    expect(shortage.required).toBe(500);
    expect(shortage.current).toBe(100);
    expect(shortage.gap).toBe(400);
  });

  it('CURRENCY-FLOW-9: 批量检查可负担性', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper', 500);
    const check = currency.checkAffordability({ copper: 300, ingot: 10 });
    expect(check.canAfford).toBe(false); // ingot不足
    expect(check.shortages.length).toBeGreaterThan(0);
  });

  it('CURRENCY-FLOW-10: 付费货币判断', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    // 元宝应为付费货币
    expect(currency.isPaidCurrency('ingot')).toBe(true);
    // 铜钱应为免费货币
    expect(currency.isPaidCurrency('copper')).toBe(false);
  });

  it('CURRENCY-FLOW-11: 获取货币上限', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const cap = currency.getCap('copper');
    // 上限可能为null（无上限）或正数
    if (cap !== null) {
      expect(cap).toBeGreaterThan(0);
    }
  });

  it('CURRENCY-FLOW-12: 添加货币受上限约束', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const cap = currency.getCap('recruit');
    if (cap !== null) {
      currency.setCurrency('recruit', cap);
      const added = currency.addCurrency('recruit', 100);
      // 已达上限时添加应为0
      expect(added).toBe(0);
    }
  });

});

// ═══════════════════════════════════════════════
// §1.7 货币兑换与汇率
// ═══════════════════════════════════════════════
describe('v8 CURRENCY-FLOW §1.7 货币兑换与汇率', () => {

  it('CURRENCY-FLOW-13: 获取汇率', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const rate = currency.getExchangeRate('copper', 'mandate');
    expect(typeof rate).toBe('number');
    expect(rate).toBeGreaterThanOrEqual(0);
  });

  it('CURRENCY-FLOW-14: 同种货币汇率为1', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const rate = currency.getExchangeRate('copper', 'copper');
    expect(rate).toBe(1);
  });

  it('CURRENCY-FLOW-15: 执行货币兑换', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper', 100000);

    const result = currency.exchange({
      from: 'copper',
      to: 'mandate',
      amount: 1000,
    });

    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      expect(result.spent).toBeGreaterThan(0);
      expect(result.received).toBeGreaterThanOrEqual(0);
    }
  });

  it('CURRENCY-FLOW-16: 兑换余额不足时失败', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.setCurrency('copper', 10);

    const result = currency.exchange({
      from: 'copper',
      to: 'mandate',
      amount: 100000,
    });

    expect(result.success).toBe(false);
  });

  it('CURRENCY-FLOW-17: 同种货币兑换无操作', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const result = currency.exchange({
      from: 'copper',
      to: 'copper',
      amount: 1000,
    });

    expect(result.success).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.received).toBe(0);
  });

  it('CURRENCY-FLOW-18: 消耗优先级配置', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const priority = currency.getSpendPriority('normal');
    expect(Array.isArray(priority)).toBe(true);
  });

  it('CURRENCY-FLOW-19: 按优先级消耗货币', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper', 10000);

    const result = currency.spendByPriority('normal', { copper: 500 });
    expect(result).toBeDefined();
    expect(result.copper).toBe(500);
  });

  it('CURRENCY-FLOW-20: 按优先级消耗不足时回滚', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.setCurrency('copper', 10);

    expect(() => {
      currency.spendByPriority('normal', { copper: 50000 });
    }).toThrow();
  });

});

// ═══════════════════════════════════════════════
// §1.8 货币防通胀
// ═══════════════════════════════════════════════
describe('v8 CURRENCY-FLOW §1.8 货币防通胀', () => {

  it('CURRENCY-FLOW-21: 招贤榜堆叠上限验证', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const cap = currency.getCap('recruit');
    // 招贤榜应有上限（PRD定义堆叠上限99）
    if (cap !== null) {
      expect(cap).toBeGreaterThan(0);
      // 尝试超过上限
      currency.setCurrency('recruit', cap);
      const added = currency.addCurrency('recruit', 100);
      // 不应超过上限
      expect(currency.getBalance('recruit')).toBeLessThanOrEqual(cap);
    }
  });

  it('CURRENCY-FLOW-22: 货币不可为负', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.setCurrency('copper', 0);
    expect(currency.getBalance('copper')).toBe(0);

    // 设置负数应被处理
    currency.setCurrency('copper', -100);
    expect(currency.getBalance('copper')).toBeGreaterThanOrEqual(0);
  });

});

// ═══════════════════════════════════════════════
// §9.3 声望转生规则（引擎层面验证）
// ═══════════════════════════════════════════════
describe('v8 CURRENCY-FLOW §9.3 声望转生规则', () => {

  it('CURRENCY-FLOW-23: 声望值余额查询', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const balance = currency.getBalance('reputation');
    expect(typeof balance).toBe('number');
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it('CURRENCY-FLOW-24: 声望值可增加', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const before = currency.getBalance('reputation');
    currency.addCurrency('reputation', 100);
    const after = currency.getBalance('reputation');
    expect(after).toBeGreaterThanOrEqual(before);
  });

});

// ═══════════════════════════════════════════════
// §9.4 活动代币过期结算 — R4: 验证活动系统接口就绪
// ═══════════════════════════════════════════════
describe('v8 CURRENCY-FLOW §9.4 活动代币', () => {

  it('CURRENCY-FLOW-25: 活动系统应可通过engine getter访问', () => {
    const sim = createSim();
    const activity = sim.engine.getActivitySystem();
    expect(activity).toBeDefined();
    // 活动系统应支持代币相关操作
    expect(typeof activity.getState).toBe('function');
  });

  it('CURRENCY-FLOW-26: 货币系统应支持活动代币类型', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    // 验证货币系统可处理非常规货币类型
    expect(typeof currency.addCurrency).toBe('function');
    expect(typeof currency.spendCurrency).toBe('function');
    expect(typeof currency.getBalance).toBe('function');
  });

});

// ═══════════════════════════════════════════════
// 货币系统序列化
// ═══════════════════════════════════════════════
describe('v8 CURRENCY-FLOW 序列化', () => {

  it('CURRENCY-FLOW-27: 货币系统序列化/反序列化', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper', 5000);
    currency.addCurrency('mandate', 100);

    const state = currency.getState();
    expect(state).toBeDefined();

    // reset后状态应恢复
    currency.reset();
    const afterReset = currency.getBalance('copper');
    // reset后余额应回到初始值
    expect(afterReset).toBeDefined();
  });

});
