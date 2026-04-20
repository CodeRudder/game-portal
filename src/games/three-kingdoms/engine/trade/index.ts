/**
 * 贸易域引擎层 — 统一导出
 */
export { TradeSystem } from './TradeSystem';
export type { TradeCurrencyOps } from './TradeSystem';
export { CaravanSystem } from './CaravanSystem';
export type { RouteInfoProvider } from './CaravanSystem';
export {
  createDefaultRouteState,
  createDefaultPrice,
  findProsperityTier,
  refreshSinglePrice,
  generateTradeEvents,
  trySpawnNpcMerchants,
} from './trade-helpers';
export type { NpcSpawnContext } from './trade-helpers';
