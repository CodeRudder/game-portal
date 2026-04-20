/**
 * 商店域 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 涵盖：商品、商店类型、购买流程、库存、限购、补货
 */

// ─────────────────────────────────────────────
// 1. 商店类型
// ─────────────────────────────────────────────

/** 商店类型枚举 */
export type ShopType = 'normal' | 'black_market' | 'limited_time' | 'vip';

/** 商店类型标签 */
export const SHOP_TYPE_LABELS: Record<ShopType, string> = {
  normal: '集市',
  black_market: '黑市',
  limited_time: '限时特惠',
  vip: 'VIP商店',
};

/** 所有商店类型 */
export const SHOP_TYPES: readonly ShopType[] = ['normal', 'black_market', 'limited_time', 'vip'] as const;

// ─────────────────────────────────────────────
// 2. 商品分类
// ─────────────────────────────────────────────

/** 商品分类 */
export type GoodsCategory = 'resource' | 'material' | 'equipment' | 'consumable' | 'special';

/** 商品分类标签 */
export const GOODS_CATEGORY_LABELS: Record<GoodsCategory, string> = {
  resource: '资源',
  material: '材料',
  equipment: '装备',
  consumable: '消耗品',
  special: '特殊',
};

// ─────────────────────────────────────────────
// 3. 商品定义
// ─────────────────────────────────────────────

/** 商品稀有度 */
export type GoodsRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** 商品稀有度标签 */
export const GOODS_RARITY_LABELS: Record<GoodsRarity, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

/** 商品定义（静态配置） */
export interface GoodsDef {
  /** 商品唯一ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品描述 */
  description: string;
  /** 商品分类 */
  category: GoodsCategory;
  /** 稀有度 */
  rarity: GoodsRarity;
  /** 图标标识 */
  icon: string;
  /** 基础价格（货币类型 -> 数量） */
  basePrice: Record<string, number>;
  /** 主要货币类型 */
  primaryCurrency: string;
  /** 是否可收藏 */
  favoritable: boolean;
  /** 商品类型：常驻/随机/折扣/限时 */
  goodsType: 'permanent' | 'random' | 'discount' | 'limited';
}

// ─────────────────────────────────────────────
// 4. 商品实例（运行时状态）
// ─────────────────────────────────────────────

/** 商品实例 — 运行时数据 */
export interface GoodsItem {
  /** 商品定义ID */
  defId: string;
  /** 当前库存（-1 表示无限） */
  stock: number;
  /** 最大库存 */
  maxStock: number;
  /** 当前折扣（0~1，1=无折扣） */
  discount: number;
  /** 每日已购买数量 */
  dailyPurchased: number;
  /** 终身已购买数量 */
  lifetimePurchased: number;
  /** 每日限购数量（-1 表示无限） */
  dailyLimit: number;
  /** 终身限购数量（-1 表示无限） */
  lifetimeLimit: number;
  /** 上架时间戳 */
  listedAt: number;
  /** 是否被收藏 */
  favorited: boolean;
}

// ─────────────────────────────────────────────
// 5. 购买流程
// ─────────────────────────────────────────────

/** 购买确认级别（五级确认策略） */
export type ConfirmLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/** 购买请求 */
export interface BuyRequest {
  /** 商品定义ID */
  goodsId: string;
  /** 购买数量 */
  quantity: number;
  /** 商店类型 */
  shopType: ShopType;
}

/** 购买结果 */
export interface BuyResult {
  /** 是否成功 */
  success: boolean;
  /** 错误原因 */
  reason?: string;
  /** 实际花费（各货币类型） */
  cost?: Record<string, number>;
  /** 获得的物品ID */
  goodsId?: string;
  /** 获得数量 */
  quantity?: number;
  /** 确认级别 */
  confirmLevel?: ConfirmLevel;
}

/** 购买校验结果 */
export interface BuyValidation {
  /** 是否可购买 */
  canBuy: boolean;
  /** 确认级别 */
  confirmLevel: ConfirmLevel;
  /** 错误原因列表 */
  errors: string[];
  /** 实际价格（折扣后） */
  finalPrice: Record<string, number>;
}

// ─────────────────────────────────────────────
// 6. 补货机制
// ─────────────────────────────────────────────

/** 补货类型 */
export type RestockType = 'scheduled' | 'offline' | 'manual';

/** 补货配置 */
export interface RestockConfig {
  /** 定时补货间隔（秒），默认 8h = 28800s */
  scheduledInterval: number;
  /** 离线补货间隔（秒），默认 8h */
  offlineInterval: number;
  /** 离线补货最大累积次数 */
  offlineMaxAccumulation: number;
  /** 手动刷新消耗（货币类型 -> 数量） */
  manualRefreshCost: Record<string, number>;
  /** 随机商品数量范围 [min, max] */
  randomGoodsRange: [number, number];
  /** 折扣概率 */
  discountChance: number;
  /** 离线限定稀有概率 */
  offlineRareChance: number;
}

/** 补货结果 */
export interface RestockResult {
  /** 补货类型 */
  type: RestockType;
  /** 补充的商品ID列表 */
  restockedGoods: string[];
  /** 新增的随机商品ID列表 */
  newRandomGoods: string[];
  /** 折扣商品ID列表 */
  discountGoods: string[];
}

// ─────────────────────────────────────────────
// 7. 商店状态
// ─────────────────────────────────────────────

/** 单个商店状态 */
export interface ShopState {
  /** 商店类型 */
  shopType: ShopType;
  /** 商品实例列表 */
  goods: GoodsItem[];
  /** 上次定时补货时间 */
  lastScheduledRestock: number;
  /** 上次离线补货时间 */
  lastOfflineRestock: number;
  /** 手动刷新次数（每日） */
  manualRefreshCount: number;
  /** 手动刷新次数上限（每日） */
  manualRefreshLimit: number;
  /** 商店等级（影响商品品质） */
  shopLevel: number;
}

/** 商店系统存档数据 */
export interface ShopSaveData {
  /** 各商店状态 */
  shops: Record<ShopType, ShopState>;
  /** 收藏商品ID列表 */
  favorites: string[];
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 8. 折扣系统
// ─────────────────────────────────────────────

/** 折扣类型 */
export type DiscountType = 'normal' | 'limited_sale' | 'npc_affinity' | 'vip';

/** 折扣配置 */
export interface DiscountConfig {
  /** 折扣类型 */
  type: DiscountType;
  /** 折扣比例（0~1，如 0.8 = 八折） */
  rate: number;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 适用商品ID列表（空=全部适用） */
  applicableGoods: string[];
}

// ─────────────────────────────────────────────
// 9. 商品搜索
// ─────────────────────────────────────────────

/** 搜索过滤条件 */
export interface GoodsFilter {
  /** 关键词搜索 */
  keyword?: string;
  /** 商品分类过滤 */
  category?: GoodsCategory;
  /** 稀有度过滤 */
  rarity?: GoodsRarity;
  /** 价格范围 [min, max] */
  priceRange?: [number, number];
  /** 仅显示有库存 */
  inStockOnly?: boolean;
  /** 仅显示收藏 */
  favoritesOnly?: boolean;
  /** 排序字段 */
  sortBy?: 'price' | 'rarity' | 'name' | 'discount';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}
