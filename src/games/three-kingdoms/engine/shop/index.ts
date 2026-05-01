/**
 * 商店域引擎层 — 统一导出
 */
export { ShopSystem } from './ShopSystem';
export type { ShopCurrencyOps } from './ShopSystem';

// 核心类型（从core层重新导出）
export type {
  ShopType,
  GoodsCategory,
  GoodsRarity,
  GoodsDef,
  GoodsItem,
  BuyRequest,
  BuyResult,
  BuyValidation,
  ConfirmLevel,
  ShopState,
  ShopSaveData,
  RestockResult,
  RestockType,
  GoodsFilter,
  DiscountConfig,
  DiscountType,
} from '../../core/shop/shop.types';
export {
  SHOP_TYPES,
  SHOP_TYPE_LABELS,
  GOODS_CATEGORY_LABELS,
  GOODS_RARITY_LABELS,
} from '../../core/shop/shop.types';
