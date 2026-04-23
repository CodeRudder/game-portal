/**
 * 引擎层 — 货币系统
 *
 * 管理8种常驻货币的完整生命周期：
 *   - 余额管理（获取/消耗/查询）
 *   - 消耗优先级（按商店类型区分）
 *   - 货币不足检测与提示
 *   - 汇率转换
 *   - 序列化/反序列化
 *
 * 功能覆盖：
 *   #4 货币体系基础
 *   #17 8种常驻货币定义
 *   #18 货币消耗优先级
 *   #19 货币不足提示
 *
 * @module engine/currency/CurrencySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  CurrencyType,
  CurrencyWallet,
  SpendPriorityConfig,
  ExchangeRate,
  ExchangeRequest,
  ExchangeResult,
  CurrencyShortage,
  CurrencySaveData,
} from '../../core/currency';
import { gameLog } from '../../core/logger';
import {
  CURRENCY_TYPES,
  CURRENCY_LABELS,
  CURRENCY_IS_PAID,
} from '../../core/currency';
import {
  INITIAL_WALLET,
  CURRENCY_CAPS,
  SPEND_PRIORITY_CONFIG,
  BASE_EXCHANGE_RATES,
  CURRENCY_ACQUIRE_HINTS,
  CURRENCY_SAVE_VERSION,
} from '../../core/currency';

// ─────────────────────────────────────────────
// 货币系统
// ─────────────────────────────────────────────

/**
 * 货币系统
 *
 * 管理8种常驻货币的余额、消耗优先级和不足提示。
 */
export class CurrencySystem implements ISubsystem {
  readonly name = 'currency';

  private deps!: ISystemDeps;
  private wallet: CurrencyWallet;
  private priorityConfig: SpendPriorityConfig;
  private exchangeRates: ExchangeRate[];

  constructor() {
    this.wallet = { ...INITIAL_WALLET };
    this.priorityConfig = { ...SPEND_PRIORITY_CONFIG };
    this.exchangeRates = [...BASE_EXCHANGE_RATES];
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 货币系统无 tick 逻辑，由外部事件驱动
  }

  getState(): CurrencyWallet {
    return this.getWallet();
  }

  reset(): void {
    this.wallet = { ...INITIAL_WALLET };
  }

  // ─── 1. 余额查询 ─────────────────────────

  /** 获取完整钱包（只读副本） */
  getWallet(): CurrencyWallet {
    return { ...this.wallet };
  }

  /** 获取指定货币余额 */
  getBalance(type: CurrencyType): number {
    return this.wallet[type];
  }

  /** 获取货币上限 */
  getCap(type: CurrencyType): number | null {
    return CURRENCY_CAPS[type];
  }

  /** 检查是否有足够货币 */
  hasEnough(type: CurrencyType, amount: number): boolean {
    return this.wallet[type] >= amount;
  }

  /** 检查是否为付费货币 */
  isPaidCurrency(type: CurrencyType): boolean {
    return CURRENCY_IS_PAID[type];
  }

  // ─── 2. 余额增减 ─────────────────────────

  /** 增加货币（受上限约束） */
  addCurrency(type: CurrencyType, amount: number): number {
    if (amount <= 0) return 0;

    const cap = CURRENCY_CAPS[type];
    const before = this.wallet[type];

    if (cap !== null) {
      const after = Math.min(before + amount, cap);
      const actual = after - before;
      this.wallet[type] = after;
      this.emitChanged(type, before, after);
      return actual;
    }

    this.wallet[type] = before + amount;
    this.emitChanged(type, before, before + amount);
    return amount;
  }

  /** 消耗货币（余额不足时抛出异常） */
  spendCurrency(type: CurrencyType, amount: number): number {
    if (amount <= 0) return 0;

    const current = this.wallet[type];
    if (current < amount) {
      const shortage = this.getShortage(type, amount);
      throw new Error(
        `${CURRENCY_LABELS[type]}不足：需要 ${amount}，当前 ${current}，缺少 ${shortage.gap}`,
      );
    }

    const before = this.wallet[type];
    this.wallet[type] = current - amount;
    this.emitChanged(type, before, this.wallet[type]);
    return amount;
  }

  /** 设置货币数量（用于加载存档） */
  setCurrency(type: CurrencyType, amount: number): void {
    const cap = CURRENCY_CAPS[type];
    this.wallet[type] = cap !== null ? Math.min(amount, cap) : Math.max(0, amount);
  }

  /**
   * 按优先级消耗货币
   *
   * 根据商店类型确定消耗优先级，依次尝试扣除。
   * 需要指定总金额（铜钱等价）和实际货币类型。
   *
   * @param shopType - 商店类型
   * @param costs - 各货币消耗量 { currencyType: amount }
   * @returns 实际消耗的各货币数量
   */
  spendByPriority(shopType: string, costs: Record<string, number>): Record<string, number> {
    const priority = this.priorityConfig[shopType as keyof SpendPriorityConfig]
      ?? this.priorityConfig.normal;

    const result: Record<string, number> = {};
    let remaining = 0;

    // 先处理指定货币的消耗
    for (const [currency, amount] of Object.entries(costs)) {
      if (amount <= 0) continue;

      const balance = this.wallet[currency as CurrencyType] ?? 0;
      const toSpend = Math.min(amount, balance);

      if (toSpend > 0) {
        this.wallet[currency as CurrencyType] -= toSpend;
        result[currency] = toSpend;
      }

      const unpaid = amount - toSpend;
      if (unpaid > 0) {
        remaining += unpaid;
      }
    }

    // 如果有剩余未付金额，按优先级从其他货币扣除
    if (remaining > 0) {
      for (const currency of priority) {
        if (remaining <= 0) break;
        if (result[currency] !== undefined) continue; // 已处理

        const balance = this.wallet[currency];
        if (balance <= 0) continue;

        const toSpend = Math.min(remaining, balance);
        this.wallet[currency] -= toSpend;
        result[currency] = toSpend;
        remaining -= toSpend;
      }
    }

    if (remaining > 0) {
      // 回滚所有扣除
      for (const [currency, amount] of Object.entries(result)) {
        this.wallet[currency as CurrencyType] += amount;
      }
      throw new Error(`货币不足，仍有 ${remaining} 未支付`);
    }

    return result;
  }

  // ─── 3. 消耗优先级 ─────────────────────────

  /** 获取指定商店类型的消耗优先级 */
  getSpendPriority(shopType: string): CurrencyType[] {
    return this.priorityConfig[shopType as keyof SpendPriorityConfig]
      ?? this.priorityConfig.normal;
  }

  /** 获取完整消耗优先级配置 */
  getAllSpendPriorities(): SpendPriorityConfig {
    return { ...this.priorityConfig };
  }

  // ─── 4. 货币不足提示（#19）──────────────────

  /** 获取货币不足信息 */
  getShortage(currency: CurrencyType, required: number): CurrencyShortage {
    const current = this.wallet[currency];
    const gap = Math.max(0, required - current);

    return {
      currency,
      required,
      current,
      gap,
      acquireHints: CURRENCY_ACQUIRE_HINTS[currency],
    };
  }

  /** 批量检查货币是否充足 */
  checkAffordability(costs: Record<string, number>): {
    canAfford: boolean;
    shortages: CurrencyShortage[];
  } {
    const shortages: CurrencyShortage[] = [];

    for (const [currency, amount] of Object.entries(costs)) {
      if (amount <= 0) continue;
      const balance = this.wallet[currency as CurrencyType] ?? 0;
      if (balance < amount) {
        shortages.push(this.getShortage(currency as CurrencyType, amount));
      }
    }

    return {
      canAfford: shortages.length === 0,
      shortages,
    };
  }

  // ─── 5. 汇率转换 ─────────────────────────

  /** 获取汇率 */
  getExchangeRate(from: CurrencyType, to: CurrencyType): number {
    if (from === to) return 1;

    const direct = this.exchangeRates.find(r => r.from === from && r.to === to);
    if (direct) return direct.rate;

    // 通过铜钱间接换算
    const fromToCopper = this.exchangeRates.find(r => r.from === from && r.to === 'copper');
    const copperToTo = this.exchangeRates.find(r => r.from === 'copper' && r.to === to);

    if (fromToCopper && copperToTo) {
      return fromToCopper.rate * copperToTo.rate;
    }

    return 0; // 无可用汇率
  }

  /** 执行汇率转换 */
  exchange(request: ExchangeRequest): ExchangeResult {
    const { from, to, amount } = request;

    if (from === to) {
      return { success: true, spent: 0, received: 0 };
    }

    const balance = this.wallet[from];
    if (balance < amount) {
      return {
        success: false,
        spent: 0,
        received: 0,
        reason: `${CURRENCY_LABELS[from]}不足`,
      };
    }

    const rate = this.getExchangeRate(from, to);
    if (rate <= 0) {
      return {
        success: false,
        spent: 0,
        received: 0,
        reason: '不支持该汇率转换',
      };
    }

    const received = Math.floor(amount * rate);

    // 检查目标货币上限
    const cap = CURRENCY_CAPS[to];
    const currentTo = this.wallet[to];
    if (cap !== null && currentTo + received > cap) {
      const actualReceived = cap - currentTo;
      if (actualReceived <= 0) {
        return {
          success: false,
          spent: 0,
          received: 0,
          reason: `${CURRENCY_LABELS[to]}已达上限`,
        };
      }
      // 按实际可接收量折算消耗
      const actualSpent = Math.ceil(actualReceived / rate);
      this.wallet[from] -= actualSpent;
      this.wallet[to] = cap;
      return { success: true, spent: actualSpent, received: actualReceived };
    }

    this.wallet[from] -= amount;
    this.wallet[to] += received;
    return { success: true, spent: amount, received };
  }

  // ─── 6. 序列化 ────────────────────────────

  serialize(): CurrencySaveData {
    return {
      wallet: { ...this.wallet },
      version: CURRENCY_SAVE_VERSION,
    };
  }

  deserialize(data: CurrencySaveData): void {
    if (data.version !== CURRENCY_SAVE_VERSION) {
      gameLog.warn(
        `CurrencySystem: 存档版本不匹配 (期望 ${CURRENCY_SAVE_VERSION}，实际 ${data.version})`,
      );
    }

    // 恢复余额，确保不超过上限
    for (const type of CURRENCY_TYPES) {
      const amount = data.wallet[type] ?? 0;
      this.setCurrency(type, amount);
    }
  }

  // ─── 内部方法 ──────────────────────────────

  /** 发出货币变化事件 */
  private emitChanged(type: CurrencyType, before: number, after: number): void {
    try {
      this.deps?.eventBus?.emit('currency:changed', {
        type,
        before,
        after,
      });
    } catch {
      // 事件总线可能未初始化
    }
  }
}
