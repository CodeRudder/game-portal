/**
 * 资源交易引擎 — PRD v1.0 TRD-FLOW-1~3
 *
 * 职责：grain↔gold / grain→troops / gold→techPoint 的资源交易
 * 规则：
 *   - 交易方向: grain→gold(10:1), gold→grain(1:8), grain→troops(20:1), gold→techPoint(100:1)
 *   - 手续费: 5%（实际到账 = 交易量 × 汇率 × 0.95）
 *   - 解锁条件: 市集(market)等级 ≥ 5
 *   - 资源保护: 最低粮草保留10、铜钱<500安全线（低于安全线不能交易该资源）
 */

import type { ResourceType } from '../../shared/types';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 交易手续费率 (5%) */
const TRADE_FEE_RATE = 0.05;

/** 最低粮草保留量 */
const MIN_GRAIN_RESERVE = 10;

/** 铜钱安全线：低于此值不能交易铜钱 */
const GOLD_SAFETY_LINE = 500;

/** 市集解锁等级 */
const MARKET_REQUIRED_LEVEL = 5;

// ─────────────────────────────────────────────
// 交易对定义
// ─────────────────────────────────────────────

/** 交易对键名 */
export type TradePairKey = 'grain_to_gold' | 'gold_to_grain' | 'grain_to_troops' | 'gold_to_techPoint';

/** 交易对定义 */
export interface TradePairDef {
  /** 交易对键名 */
  key: TradePairKey;
  /** 源资源类型 */
  from: ResourceType;
  /** 目标资源类型 */
  to: ResourceType;
  /** 汇率（1单位源资源 → 多少单位目标资源） */
  rate: number;
}

/** 交易结果 */
export interface ResourceTradeResult {
  /** 是否成功 */
  success: boolean;
  /** 实际到账数量 */
  received: number;
  /** 手续费数量 */
  fee: number;
  /** 错误原因 */
  error?: string;
}

/** 交易可行性检查结果 */
export interface CanTradeResult {
  /** 是否可以交易 */
  canTrade: boolean;
  /** 不可交易的原因 */
  reason?: string;
}

/** 支持的交易对信息 */
export interface TradePairInfo {
  from: ResourceType;
  to: ResourceType;
  rate: number;
  fee: number;
}

/** 资源操作回调（由外部注入） */
export interface ResourceTradeDeps {
  /** 获取资源数量 */
  getResourceAmount: (type: ResourceType) => number;
  /** 消耗资源 */
  consumeResource: (type: ResourceType, amount: number) => number;
  /** 添加资源 */
  addResource: (type: ResourceType, amount: number) => number;
  /** 获取市场等级 */
  getMarketLevel: () => number;
}

/** 交易对汇率表 */
const TRADE_PAIR_DEFS: Record<TradePairKey, TradePairDef> = {
  grain_to_gold:     { key: 'grain_to_gold',     from: 'grain', to: 'gold',     rate: 0.1  },  // 10 grain → 1 gold
  gold_to_grain:     { key: 'gold_to_grain',     from: 'gold', to: 'grain',     rate: 8    },  // 1 gold → 8 grain
  grain_to_troops:   { key: 'grain_to_troops',   from: 'grain', to: 'troops',   rate: 0.05 },  // 20 grain → 1 troops
  gold_to_techPoint: { key: 'gold_to_techPoint', from: 'gold', to: 'techPoint', rate: 0.01 },  // 100 gold → 1 techPoint
};

/** 反向映射：(from, to) → TradePairDef */
const TRADE_PAIR_MAP = new Map<string, TradePairDef>();
for (const def of Object.values(TRADE_PAIR_DEFS)) {
  TRADE_PAIR_MAP.set(`${def.from}:${def.to}`, def);
}

// ─────────────────────────────────────────────
// ResourceTradeEngine
// ─────────────────────────────────────────────

/**
 * 资源交易引擎
 *
 * 实现 PRD v1.0 定义的 grain↔gold / grain→troops / gold→techPoint 资源交易功能。
 * 通过 setDeps() 注入资源操作回调和市场等级查询，与 ResourceSystem / BuildingSystem 解耦。
 */
export class ResourceTradeEngine implements ISubsystem {
  readonly name = 'resourceTrade' as const;
  private deps: ISystemDeps | null = null;
  private tradeDeps: ResourceTradeDeps | null = null;

  // ── ISubsystem ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 资源交易无持续更新逻辑
  }

  getState(): Record<string, unknown> {
    return {
      supportedPairs: this.getSupportedTradePairs(),
      marketRequiredLevel: MARKET_REQUIRED_LEVEL,
      feeRate: TRADE_FEE_RATE,
      minGrainReserve: MIN_GRAIN_RESERVE,
      goldSafetyLine: GOLD_SAFETY_LINE,
    };
  }

  reset(): void {
    // 无内部状态需要重置
  }

  /** 注入资源操作依赖 */
  setDeps(deps: ResourceTradeDeps): void {
    this.tradeDeps = deps;
  }

  // ─────────────────────────────────────────────
  // 核心 API
  // ─────────────────────────────────────────────

  /**
   * 执行资源交易
   *
   * 流程：检查市场等级 → 检查资源保护线 → 扣除源资源 → 计算手续费 → 添加目标资源
   *
   * @param from - 源资源类型
   * @param to - 目标资源类型
   * @param amount - 交易数量（源资源单位）
   * @returns 交易结果
   */
  tradeResource(from: ResourceType, to: ResourceType, amount: number): ResourceTradeResult {
    // 参数校验 (FIX-801: NaN绕过防护; FIX-802: 拒绝小数金额防止截断资损)
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, received: 0, fee: 0, error: '交易数量必须大于 0' };
    }
    if (!Number.isInteger(amount)) {
      return { success: false, received: 0, fee: 0, error: '交易数量必须为整数' };
    }

    // 查找交易对
    const pairDef = TRADE_PAIR_MAP.get(`${from}:${to}`);
    if (!pairDef) {
      return { success: false, received: 0, fee: 0, error: `不支持的交易对: ${from}→${to}` };
    }

    // 检查依赖注入
    if (!this.tradeDeps) {
      return { success: false, received: 0, fee: 0, error: '资源交易引擎未初始化依赖' };
    }

    // 检查市场等级
    const marketLevel = this.tradeDeps.getMarketLevel();
    if (marketLevel < MARKET_REQUIRED_LEVEL) {
      return { success: false, received: 0, fee: 0, error: `需要市集等级 ≥ ${MARKET_REQUIRED_LEVEL}，当前 ${marketLevel}` };
    }

    // 检查资源保护线
    const protectionCheck = this.checkResourceProtection(from, amount);
    if (!protectionCheck.canTrade) {
      return { success: false, received: 0, fee: 0, error: protectionCheck.reason };
    }

    // 检查资源余额
    const currentAmount = this.tradeDeps.getResourceAmount(from);
    if (currentAmount < amount) {
      return { success: false, received: 0, fee: 0, error: `${from} 资源不足：需要 ${amount}，当前 ${currentAmount}` };
    }

    // 扣除源资源
    try {
      this.tradeDeps.consumeResource(from, amount);
    } catch (e) {
      return { success: false, received: 0, fee: 0, error: (e as Error).message };
    }

    // 计算手续费和实际到账
    const gross = amount * pairDef.rate;
    const fee = Math.floor(gross * TRADE_FEE_RATE);
    const received = Math.floor(gross) - fee;

    // 添加目标资源
    const actualReceived = this.tradeDeps.addResource(to, Math.max(0, received));

    return {
      success: true,
      received: actualReceived,
      fee,
    };
  }

  /**
   * 获取交易汇率
   *
   * @param from - 源资源类型
   * @param to - 目标资源类型
   * @returns 汇率（1单位源资源 → 多少单位目标资源），不支持时返回 0
   */
  getResourceTradeRate(from: ResourceType, to: ResourceType): number {
    const pairDef = TRADE_PAIR_MAP.get(`${from}:${to}`);
    return pairDef?.rate ?? 0;
  }

  /**
   * 检查是否可以执行交易
   *
   * 综合检查市场等级、资源保护线和资源余额
   *
   * @param from - 源资源类型
   * @param to - 目标资源类型
   * @param amount - 交易数量
   * @returns 检查结果
   */
  canTradeResource(from: ResourceType, to: ResourceType, amount: number): CanTradeResult {
    // 参数校验 (FIX-801: NaN绕过防护; FIX-802: 拒绝小数金额防止截断资损)
    if (!Number.isFinite(amount) || amount <= 0) {
      return { canTrade: false, reason: '交易数量必须大于 0' };
    }
    if (!Number.isInteger(amount)) {
      return { canTrade: false, reason: '交易数量必须为整数' };
    }

    // 查找交易对
    const pairDef = TRADE_PAIR_MAP.get(`${from}:${to}`);
    if (!pairDef) {
      return { canTrade: false, reason: `不支持的交易对: ${from}→${to}` };
    }

    // 检查依赖注入
    if (!this.tradeDeps) {
      return { canTrade: false, reason: '资源交易引擎未初始化依赖' };
    }

    // 检查市场等级
    const marketLevel = this.tradeDeps.getMarketLevel();
    if (marketLevel < MARKET_REQUIRED_LEVEL) {
      return { canTrade: false, reason: `需要市集等级 ≥ ${MARKET_REQUIRED_LEVEL}，当前 ${marketLevel}` };
    }

    // 检查资源保护线
    const protectionCheck = this.checkResourceProtection(from, amount);
    if (!protectionCheck.canTrade) {
      return protectionCheck;
    }

    // 检查资源余额
    const currentAmount = this.tradeDeps.getResourceAmount(from);
    if (currentAmount < amount) {
      return { canTrade: false, reason: `${from} 资源不足：需要 ${amount}，当前 ${currentAmount}` };
    }

    return { canTrade: true };
  }

  /**
   * 获取所有支持的交易对信息
   *
   * @returns 交易对列表
   */
  getSupportedTradePairs(): TradePairInfo[] {
    return Object.values(TRADE_PAIR_DEFS).map(def => ({
      from: def.from,
      to: def.to,
      rate: def.rate,
      fee: TRADE_FEE_RATE,
    }));
  }

  // ─────────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────────

  /**
   * 检查资源保护线
   *
   * - 交易粮草时：交易后粮草不能低于 MIN_GRAIN_RESERVE (10)
   * - 交易铜钱时：铜钱低于 GOLD_SAFETY_LINE (500) 时不能交易
   */
  private checkResourceProtection(from: ResourceType, amount: number): CanTradeResult {
    if (!this.tradeDeps) {
      return { canTrade: false, reason: '资源交易引擎未初始化依赖' };
    }

    const currentAmount = this.tradeDeps.getResourceAmount(from);

    // 粮草保护：交易后不低于 MIN_GRAIN_RESERVE
    if (from === 'grain') {
      const afterTrade = currentAmount - amount;
      if (afterTrade < MIN_GRAIN_RESERVE) {
        return {
          canTrade: false,
          reason: `粮草保护：交易后粮草不能低于 ${MIN_GRAIN_RESERVE}（当前 ${currentAmount}，交易 ${amount}，剩余 ${afterTrade}）`,
        };
      }
    }

    // 铜钱安全线：低于 GOLD_SAFETY_LINE 时不能交易铜钱
    if (from === 'gold') {
      if (currentAmount < GOLD_SAFETY_LINE) {
        return {
          canTrade: false,
          reason: `铜钱安全线保护：铜钱低于 ${GOLD_SAFETY_LINE} 时不能交易（当前 ${currentAmount}）`,
        };
      }
      // 交易后铜钱可以低于安全线，但交易前必须高于安全线
    }

    return { canTrade: true };
  }
}
