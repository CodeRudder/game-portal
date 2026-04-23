/**
 * Token shop - config constants
 *
 * Extracted from TokenShopSystem.ts.
 */

import type { TokenShopConfig, ShopItemRarity, TokenShopItem } from '../../core/event/event-activity.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

export const DEFAULT_TOKEN_SHOP_CONFIG: TokenShopConfig = {
  tokenName: '活动代币',
  dailyRefresh: true,
  maxItems: 12,
};

/** 稀有度排序权重 */
export const RARITY_ORDER: ShopItemRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'supreme',
];

/** 稀有度 → 基础价格倍率 */
export const RARITY_PRICE_MULTIPLIER: Record<ShopItemRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 5,
  epic: 10,
  legendary: 25,
  mythic: 50,
  supreme: 100,
};

/** 默认商品模板（七阶各一个） */
export const DEFAULT_SHOP_ITEMS: TokenShopItem[] = [
  {
    id: 'shop-copper',
    name: '铜钱袋',
    description: '包含1000铜钱',
    rarity: 'common',
    tokenPrice: 10,
    purchaseLimit: 10,
    purchased: 0,
    rewards: { copper: 1000 },
    activityId: '',
    available: true,
  },
  {
    id: 'shop-speed',
    name: '加速道具',
    description: '减少建筑升级时间1小时',
    rarity: 'uncommon',
    tokenPrice: 20,
    purchaseLimit: 5,
    purchased: 0,
    rewards: { speedItem: 1 },
    activityId: '',
    available: true,
  },
  {
    id: 'shop-equip-box',
    name: '装备箱',
    description: '随机获得一件装备',
    rarity: 'rare',
    tokenPrice: 50,
    purchaseLimit: 3,
    purchased: 0,
    rewards: { equipBox: 1 },
    activityId: '',
    available: true,
  },
  {
    id: 'shop-hero-frag',
    name: '武将碎片',
    description: '随机武将碎片×5',
    rarity: 'epic',
    tokenPrice: 100,
    purchaseLimit: 2,
    purchased: 0,
    rewards: { heroFragment: 5 },
    activityId: '',
    available: true,
  },
  {
    id: 'shop-legendary-weapon',
    name: '传说武器',
    description: '一把传说级武器',
    rarity: 'legendary',
    tokenPrice: 250,
    purchaseLimit: 1,
    purchased: 0,
    rewards: { legendaryWeapon: 1 },
    activityId: '',
    available: true,
  },
  {
    id: 'shop-mythic-hero',
    name: '神话武将',
    description: '限定神话武将一名',
    rarity: 'mythic',
    tokenPrice: 500,
    purchaseLimit: 1,
    purchased: 0,
    rewards: { mythicHero: 1 },
    activityId: '',
    available: true,
  },
  {
    id: 'shop-supreme-title',
    name: '至尊称号',
    description: '赛季限定至尊称号',
    rarity: 'supreme',
    tokenPrice: 1000,
    purchaseLimit: 1,
    purchased: 0,
    rewards: { supremeTitle: 1 },
    activityId: '',
    available: true,
  },
];

// ─────────────────────────────────────────────
// 代币商店系统
// ─────────────────────────────────────────────

/**
 * 代币商店系统
 *
 * 管理代币兑换、限购、刷新。
 */
