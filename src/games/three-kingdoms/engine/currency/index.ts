/**
 * 货币域引擎层 — 统一导出
 */
export { CurrencySystem } from './CurrencySystem';

// 核心类型（从core层重新导出）
export type {
  CurrencyType,
  CurrencyWallet,
  CurrencySaveData,
  CurrencyShortage,
  ExchangeRequest,
  ExchangeResult,
  ExchangeRate,
  SpendPriorityConfig,
} from '../../core/currency/currency.types';
export {
  CURRENCY_TYPES,
  CURRENCY_LABELS,
  CURRENCY_COLORS,
  CURRENCY_ICONS,
  CURRENCY_IS_PAID,
} from '../../core/currency/currency.types';
