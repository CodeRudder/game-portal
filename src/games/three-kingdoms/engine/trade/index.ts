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

// 核心类型（从core层重新导出）
export type {
  CityId,
  TradeRouteId,
  TradeRouteDef,
  TradeRouteState,
  TradeGoodsId,
  TradeGoodsDef,
  TradeGoodsPrice,
  TradeProfit,
  Caravan,
  CaravanAttributes,
  CaravanStatus,
  CaravanDispatchRequest,
  CaravanDispatchResult,
  GuardMutexCheck,
  GuardDispatchResult,
  TradeEventType,
  TradeEventDef,
  TradeEventInstance,
  TradeEventOption,
  ProsperityLevel,
  ProsperityTier,
  NpcMerchantType,
  NpcMerchantDef,
  NpcMerchantInstance,
  TradeSaveData,
} from '../../core/trade/trade.types';
export {
  CITY_IDS,
  CITY_LABELS,
  CARAVAN_STATUS_LABELS,
  PROSPERITY_LABELS,
} from '../../core/trade/trade.types';
