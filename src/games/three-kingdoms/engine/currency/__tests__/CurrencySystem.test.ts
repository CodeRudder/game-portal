import { vi } from 'vitest';
/**
 * CurrencySystem 单元测试
 *
 * 覆盖：
 * 1. 初始化（8种货币、初始余额）
 * 2. 余额查询
 * 3. 余额变更（增加/减少/设置）
 * 4. 上限控制
 * 5. 消耗优先级
 * 6. 汇率转换
 * 7. 货币不足检测
 * 8. 批量操作（checkAffordability）
 * 9. 存档/反序列化
 * 10. 事件监听（通过 eventBus）
 */

import { CurrencySystem } from '../CurrencySystem';
import {
  CURRENCY_TYPES,
  CURRENCY_LABELS,
  CURRENCY_IS_PAID,
  CURRENCY_COLORS,
  CURRENCY_ICONS,
} from '../../../core/currency/currency.types';
import {
  INITIAL_WALLET,
  CURRENCY_CAPS,
  CURRENCY_SAVE_VERSION,
} from '../../../core/currency/currency-config';
import { gameLog } from '../../../core/logger';

/** 创建带 mock eventBus 的 CurrencySystem */
function createSystem(): CurrencySystem {
  const cs = new CurrencySystem();
  const mockEventBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const mockConfig = { get: vi.fn() };
  const mockRegistry = { get: vi.fn() };
  cs.init({ eventBus: mockEventBus as unknown as { emit: (...args: unknown[]) => void; on: (...args: unknown[]) => void; off: (...args: unknown[]) => void }, config: mockConfig as unknown as { get: (key: string) => unknown }, registry: mockRegistry as unknown as { get: (key: string) => unknown } });
  return cs;
}

describe('CurrencySystem', () => {
  let cs: CurrencySystem;
  beforeEach(() => {
    vi.restoreAllMocks();
    cs = createSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('应有8种货币类型', () => {
      expect(CURRENCY_TYPES).toHaveLength(8);
      expect(CURRENCY_TYPES).toContain('copper');
      expect(CURRENCY_TYPES).toContain('mandate');
      expect(CURRENCY_TYPES).toContain('recruit');
      expect(CURRENCY_TYPES).toContain('summon');
      expect(CURRENCY_TYPES).toContain('expedition');
      expect(CURRENCY_TYPES).toContain('guild');
      expect(CURRENCY_TYPES).toContain('reputation');
      expect(CURRENCY_TYPES).toContain('ingot');
    });

    it('初始余额与配置一致', () => {
      const wallet = cs.getWallet();
      expect(wallet.copper).toBe(INITIAL_WALLET.copper);
      expect(wallet.mandate).toBe(INITIAL_WALLET.mandate);
      expect(wallet.recruit).toBe(INITIAL_WALLET.recruit);
      expect(wallet.summon).toBe(INITIAL_WALLET.summon);
      expect(wallet.expedition).toBe(INITIAL_WALLET.expedition);
      expect(wallet.guild).toBe(INITIAL_WALLET.guild);
      expect(wallet.reputation).toBe(INITIAL_WALLET.reputation);
      expect(wallet.ingot).toBe(INITIAL_WALLET.ingot);
    });

    it('CURRENCY_TYPES 包含8种货币', () => {
      expect(CURRENCY_TYPES).toHaveLength(8);
    });

    it('每种货币都有中文名', () => {
      for (const type of CURRENCY_TYPES) {
        expect(CURRENCY_LABELS[type]).toBeTruthy();
      }
    });

    it('每种货币都有颜色', () => {
      for (const type of CURRENCY_TYPES) {
        expect(CURRENCY_COLORS[type]).toBeTruthy();
      }
    });

    it('每种货币都有图标', () => {
      for (const type of CURRENCY_TYPES) {
        expect(CURRENCY_ICONS[type]).toBeTruthy();
      }
    });

    it('仅元宝为付费货币', () => {
      expect(CURRENCY_IS_PAID.ingot).toBe(true);
      expect(CURRENCY_IS_PAID.copper).toBe(false);
      expect(CURRENCY_IS_PAID.mandate).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 余额查询
  // ═══════════════════════════════════════════
  describe('余额查询', () => {
    it('getBalance 返回正确余额', () => {
      expect(cs.getBalance('copper')).toBe(1000);
      expect(cs.getBalance('mandate')).toBe(0);
    });

    it('getWallet 返回只读副本', () => {
      const w1 = cs.getWallet();
      const w2 = cs.getWallet();
      expect(w1).toEqual(w2);
      expect(w1).not.toBe(w2); // 不同引用
    });

    it('hasEnough 正确判断', () => {
      expect(cs.hasEnough('copper', 500)).toBe(true);
      expect(cs.hasEnough('copper', 1000)).toBe(true);
      expect(cs.hasEnough('copper', 1001)).toBe(false);
      expect(cs.hasEnough('mandate', 1)).toBe(false);
    });

    it('isPaidCurrency 正确判断', () => {
      expect(cs.isPaidCurrency('ingot')).toBe(true);
      expect(cs.isPaidCurrency('copper')).toBe(false);
    });

    it('getCap 返回正确上限', () => {
      expect(cs.getCap('copper')).toBeNull(); // 无上限
      expect(cs.getCap('recruit')).toBe(999);
      expect(cs.getCap('summon')).toBe(99);
      expect(cs.getCap('reputation')).toBe(99999);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 余额变更
  // ═══════════════════════════════════════════
  describe('余额变更', () => {
    it('addCurrency 正确增加货币', () => {
      const added = cs.addCurrency('copper', 500);
      expect(added).toBe(500);
      expect(cs.getBalance('copper')).toBe(1500);
    });

    it('addCurrency 受上限约束', () => {
      // recruit 上限 999
      const added = cs.addCurrency('recruit', 1000);
      expect(added).toBe(999);
      expect(cs.getBalance('recruit')).toBe(999);
    });

    it('addCurrency 负数返回0', () => {
      const added = cs.addCurrency('copper', -1);
      expect(added).toBe(0);
    });

    it('addCurrency 零返回0', () => {
      const added = cs.addCurrency('copper', 0);
      expect(added).toBe(0);
    });

    it('spendCurrency 正确减少货币', () => {
      cs.spendCurrency('copper', 300);
      expect(cs.getBalance('copper')).toBe(700);
    });

    it('spendCurrency 余额不足抛异常', () => {
      expect(() => cs.spendCurrency('copper', 1001)).toThrow();
    });

    it('spendCurrency 负数返回0', () => {
      const spent = cs.spendCurrency('copper', -1);
      expect(spent).toBe(0);
    });

    it('setCurrency 正确设置', () => {
      cs.setCurrency('copper', 5000);
      expect(cs.getBalance('copper')).toBe(5000);
    });

    it('setCurrency 受上限约束', () => {
      cs.setCurrency('recruit', 2000);
      expect(cs.getBalance('recruit')).toBe(999);
    });

    it('setCurrency 负数时设为0', () => {
      cs.setCurrency('copper', -100);
      expect(cs.getBalance('copper')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 上限控制
  // ═══════════════════════════════════════════
  describe('上限控制', () => {
    it('getCap 返回正确上限', () => {
      expect(cs.getCap('copper')).toBeNull(); // 无上限
      expect(cs.getCap('recruit')).toBe(999);
      expect(cs.getCap('summon')).toBe(99);
      expect(cs.getCap('reputation')).toBe(99999);
    });

    it('addCurrency 到上限后不再增加', () => {
      cs.addCurrency('recruit', 500);
      expect(cs.getBalance('recruit')).toBe(500);
      const added = cs.addCurrency('recruit', 600);
      expect(added).toBe(499);
      expect(cs.getBalance('recruit')).toBe(999);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 消耗优先级
  // ═══════════════════════════════════════════
  describe('消耗优先级', () => {
    it('集市优先铜钱', () => {
      const priority = cs.getSpendPriority('normal');
      expect(priority[0]).toBe('copper');
    });

    it('黑市优先声望值', () => {
      const priority = cs.getSpendPriority('black_market');
      expect(priority[0]).toBe('reputation');
    });

    it('限时特惠仅元宝', () => {
      const priority = cs.getSpendPriority('limited_time');
      expect(priority).toEqual(['ingot']);
    });

    it('VIP商店优先元宝', () => {
      const priority = cs.getSpendPriority('vip');
      expect(priority[0]).toBe('ingot');
    });

    it('未知商店类型回退到 normal', () => {
      const priority = cs.getSpendPriority('unknown');
      expect(priority[0]).toBe('copper');
    });

    it('getAllSpendPriorities 返回所有配置', () => {
      const config = cs.getAllSpendPriorities();
      expect(config.normal).toBeDefined();
      expect(config.black_market).toBeDefined();
      expect(config.limited_time).toBeDefined();
      expect(config.vip).toBeDefined();
    });

    it('spendByPriority 正确扣除指定货币', () => {
      const result = cs.spendByPriority('normal', { copper: 500 });
      expect(result.copper).toBe(500);
      expect(cs.getBalance('copper')).toBe(500);
    });

    it('spendByPriority 余额不足时抛异常并回滚', () => {
      expect(() => cs.spendByPriority('normal', { copper: 2000 })).toThrow();
      expect(cs.getBalance('copper')).toBe(1000); // 回滚
    });
  });

  // ═══════════════════════════════════════════
  // 6. 汇率转换
  // ═══════════════════════════════════════════
  describe('汇率转换', () => {
    it('相同货币汇率为1', () => {
      expect(cs.getExchangeRate('copper', 'copper')).toBe(1);
    });

    it('天命→铜钱汇率为100', () => {
      expect(cs.getExchangeRate('mandate', 'copper')).toBe(100);
    });

    it('元宝→铜钱汇率为1000', () => {
      expect(cs.getExchangeRate('ingot', 'copper')).toBe(1000);
    });

    it('exchange 成功转换', () => {
      cs.addCurrency('mandate', 10);
      const result = cs.exchange({ from: 'mandate', to: 'copper', amount: 5 });
      expect(result.success).toBe(true);
      expect(result.spent).toBe(5);
      expect(result.received).toBe(500);
      expect(cs.getBalance('mandate')).toBe(5);
      expect(cs.getBalance('copper')).toBe(1500);
    });

    it('exchange 数量不足返回失败', () => {
      const result = cs.exchange({ from: 'mandate', to: 'copper', amount: 1 });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('exchange 相同货币返回成功', () => {
      const result = cs.exchange({ from: 'copper', to: 'copper', amount: 100 });
      expect(result.success).toBe(true);
      expect(result.spent).toBe(0);
      expect(result.received).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 货币不足检测
  // ═══════════════════════════════════════════
  describe('货币不足检测', () => {
    it('getShortage 余额充足时 gap 为 0', () => {
      const shortage = cs.getShortage('copper', 500);
      expect(shortage.gap).toBe(0);
    });

    it('getShortage 余额不足返回缺口信息', () => {
      const shortage = cs.getShortage('copper', 2000);
      expect(shortage.currency).toBe('copper');
      expect(shortage.required).toBe(2000);
      expect(shortage.current).toBe(1000);
      expect(shortage.gap).toBe(1000);
      expect(shortage.acquireHints.length).toBeGreaterThan(0);
    });

    it('checkAffordability 全部充足', () => {
      const result = cs.checkAffordability({ copper: 500 });
      expect(result.canAfford).toBe(true);
      expect(result.shortages).toHaveLength(0);
    });

    it('checkAffordability 部分不足', () => {
      const result = cs.checkAffordability({ copper: 500, mandate: 10 });
      expect(result.canAfford).toBe(false);
      expect(result.shortages).toHaveLength(1);
      expect(result.shortages[0].currency).toBe('mandate');
    });

    it('checkAffordability 忽略0和负数', () => {
      const result = cs.checkAffordability({ copper: 0, mandate: -1 });
      expect(result.canAfford).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 存档
  // ═══════════════════════════════════════════
  describe('存档', () => {
    it('serialize/deserialize 往返一致', () => {
      cs.addCurrency('copper', 500);
      cs.addCurrency('mandate', 10);
      const data = cs.serialize();

      expect(data.version).toBe(CURRENCY_SAVE_VERSION);
      expect(data.wallet.copper).toBe(1500);
      expect(data.wallet.mandate).toBe(10);

      const cs2 = new CurrencySystem();
      cs2.init({ eventBus: { emit: vi.fn() as unknown as (...args: unknown[]) => void, on: vi.fn() as unknown as (...args: unknown[]) => void, off: vi.fn() as unknown as (...args: unknown[]) => void }, config: { get: vi.fn() as unknown as (key: string) => unknown }, registry: { get: vi.fn() as unknown as (key: string) => unknown } });
      cs2.deserialize(data);
      expect(cs2.getBalance('copper')).toBe(1500);
      expect(cs2.getBalance('mandate')).toBe(10);
    });

    it('deserialize 版本不匹配时仍恢复数据', () => {
      const data = { wallet: { ...INITIAL_WALLET, copper: 5000 }, version: 99 };
      const consoleSpy = vi.spyOn(gameLog, 'warn').mockImplementation(() => {});
      cs.deserialize(data as unknown as Record<string, unknown>);
      expect(cs.getBalance('copper')).toBe(5000);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('reset 恢复初始状态', () => {
      cs.addCurrency('copper', 5000);
      cs.reset();
      expect(cs.getBalance('copper')).toBe(INITIAL_WALLET.copper);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 事件监听
  // ═══════════════════════════════════════════
  describe('事件监听', () => {
    it('addCurrency 触发 currency:changed 事件', () => {
      cs.addCurrency('copper', 100);
      const mockEventBus = (cs as unknown as Record<string, unknown>).deps.eventBus;
      expect(mockEventBus.emit).toHaveBeenCalledWith('currency:changed', {
        type: 'copper',
        before: 1000,
        after: 1100,
      });
    });

    it('spendCurrency 触发 currency:changed 事件', () => {
      cs.spendCurrency('copper', 100);
      const mockEventBus = (cs as unknown as Record<string, unknown>).deps.eventBus;
      expect(mockEventBus.emit).toHaveBeenCalledWith('currency:changed', {
        type: 'copper',
        before: 1000,
        after: 900,
      });
    });

    it('未初始化时不抛异常', () => {
      const raw = new CurrencySystem();
      // addCurrency 内部 emitChanged，deps 未初始化不应崩溃
      expect(() => raw.addCurrency('copper', 100)).not.toThrow();
      expect(raw.getBalance('copper')).toBe(1100);
    });
  });

  // ═══════════════════════════════════════════
  // 10. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 currency', () => {
      expect(cs.name).toBe('currency');
    });

    it('update 不抛异常', () => {
      expect(() => cs.update(16)).not.toThrow();
    });

    it('getState 返回 wallet', () => {
      const state = cs.getState();
      expect(state).toEqual(INITIAL_WALLET);
    });
  });
});
