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
export {
  MAP_SIZE,
  GRID_CONFIG,
  VIEWPORT_CONFIG,
  MAP_PIXEL_SIZE,
  REGION_IDS,
  REGION_DEFS,
  REGION_LABELS,
  REGION_COLORS,
  TERRAIN_TYPES,
  TERRAIN_DEFS,
  TERRAIN_LABELS,
  TERRAIN_COLORS,
  DEFAULT_LANDMARKS,
  LANDMARK_POSITIONS,
  MAP_SAVE_VERSION,
  getRegionAtPosition,
  getTerrainAtPosition,
  generateAllTiles,
} from '../../core/map';
