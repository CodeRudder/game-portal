/**
 * 商店域 — 商品数据配置
 *
 * 定义所有商品（GoodsDef）的静态配置数据。
 * 规则：只有常量定义，零逻辑
 *
 * @module core/shop/goods-data
 */

import type { GoodsDef } from './shop.types';

// ─────────────────────────────────────────────
// 资源类商品
// ─────────────────────────────────────────────

/** 资源类商品定义 */
export const RESOURCE_GOODS: GoodsDef[] = [
  {
    id: 'res_grain_small',
    name: '粮草小包',
    description: '100单位粮草',
    category: 'resource',
    rarity: 'common',
    icon: '🌾',
    basePrice: { copper: 200 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'res_grain_large',
    name: '粮草大包',
    description: '500单位粮草',
    category: 'resource',
    rarity: 'uncommon',
    icon: '🌾',
    basePrice: { copper: 800 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'res_gold_small',
    name: '金币袋',
    description: '50金币',
    category: 'resource',
    rarity: 'common',
    icon: '💰',
    basePrice: { copper: 300 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'res_troops_small',
    name: '征兵令',
    description: '50兵力',
    category: 'resource',
    rarity: 'common',
    icon: '⚔️',
    basePrice: { copper: 500 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
];

// ─────────────────────────────────────────────
// 材料类商品
// ─────────────────────────────────────────────

/** 材料类商品定义 */
export const MATERIAL_GOODS: GoodsDef[] = [
  {
    id: 'mat_iron',
    name: '精铁',
    description: '锻造用精铁',
    category: 'material',
    rarity: 'uncommon',
    icon: '🔩',
    basePrice: { copper: 150 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'mat_leather',
    name: '皮革',
    description: '防具制作材料',
    category: 'material',
    rarity: 'common',
    icon: '🧤',
    basePrice: { copper: 100 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'mat_herbs',
    name: '草药',
    description: '炼丹材料',
    category: 'material',
    rarity: 'uncommon',
    icon: '🌿',
    basePrice: { copper: 120 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'mat_jade',
    name: '玉石',
    description: '稀有打造材料',
    category: 'material',
    rarity: 'rare',
    icon: '💎',
    basePrice: { mandate: 10 },
    primaryCurrency: 'mandate',
    favoritable: true,
    goodsType: 'random',
  },
];

// ─────────────────────────────────────────────
// 装备类商品
// ─────────────────────────────────────────────

/** 装备类商品定义 */
export const EQUIPMENT_GOODS: GoodsDef[] = [
  {
    id: 'eq_sword_iron',
    name: '铁剑',
    description: '普通铁剑，攻击+5',
    category: 'equipment',
    rarity: 'common',
    icon: '🗡️',
    basePrice: { copper: 500 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'eq_armor_leather',
    name: '皮甲',
    description: '轻便皮甲，防御+3',
    category: 'equipment',
    rarity: 'common',
    icon: '🛡️',
    basePrice: { copper: 400 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'eq_sword_steel',
    name: '精钢剑',
    description: '精良钢剑，攻击+12',
    category: 'equipment',
    rarity: 'uncommon',
    icon: '🗡️',
    basePrice: { copper: 1500 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'random',
  },
  {
    id: 'eq_armor_chain',
    name: '锁子甲',
    description: '坚固锁甲，防御+10',
    category: 'equipment',
    rarity: 'uncommon',
    icon: '🛡️',
    basePrice: { copper: 2000 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'random',
  },
  {
    id: 'eq_ring_jade',
    name: '玉佩',
    description: '温润玉佩，全属性+2',
    category: 'equipment',
    rarity: 'rare',
    icon: '💍',
    basePrice: { mandate: 30 },
    primaryCurrency: 'mandate',
    favoritable: true,
    goodsType: 'random',
  },
];

// ─────────────────────────────────────────────
// 消耗品类商品
// ─────────────────────────────────────────────

/** 消耗品类商品定义 */
export const CONSUMABLE_GOODS: GoodsDef[] = [
  {
    id: 'con_potion_hp',
    name: '回春丹',
    description: '恢复100点生命',
    category: 'consumable',
    rarity: 'common',
    icon: '💊',
    basePrice: { copper: 80 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'con_potion_str',
    name: '虎骨酒',
    description: '战斗中攻击+10%，持续1场',
    category: 'consumable',
    rarity: 'uncommon',
    icon: '🍶',
    basePrice: { copper: 200 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'con_scroll_exp',
    name: '兵法卷轴',
    description: '武将获得500经验',
    category: 'consumable',
    rarity: 'rare',
    icon: '📜',
    basePrice: { mandate: 15 },
    primaryCurrency: 'mandate',
    favoritable: true,
    goodsType: 'random',
  },
  {
    id: 'con_token_recruit',
    name: '招贤令',
    description: '可招募一名武将',
    category: 'consumable',
    rarity: 'epic',
    icon: '📯',
    basePrice: { recruit: 1 },
    primaryCurrency: 'recruit',
    favoritable: false,
    goodsType: 'permanent',
  },
  {
    id: 'con_token_summon',
    name: '求贤令',
    description: '可高级招募一名武将',
    category: 'consumable',
    rarity: 'legendary',
    icon: '📯',
    basePrice: { summon: 1 },
    primaryCurrency: 'summon',
    favoritable: false,
    goodsType: 'permanent',
  },
];

// ─────────────────────────────────────────────
// 特殊类商品
// ─────────────────────────────────────────────

/** 特殊类商品定义 */
export const SPECIAL_GOODS: GoodsDef[] = [
  {
    id: 'spd_blueprint',
    name: '建筑图纸',
    description: '随机建筑升级图纸',
    category: 'special',
    rarity: 'rare',
    icon: '📐',
    basePrice: { reputation: 50 },
    primaryCurrency: 'reputation',
    favoritable: true,
    goodsType: 'random',
  },
  {
    id: 'spd_tech_book',
    name: '科技典籍',
    description: '获得50科技点',
    category: 'special',
    rarity: 'rare',
    icon: '📖',
    basePrice: { expedition: 30 },
    primaryCurrency: 'expedition',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'spd_guild_chest',
    name: '公会宝箱',
    description: '随机稀有物品',
    category: 'special',
    rarity: 'epic',
    icon: '🎁',
    basePrice: { guild: 100 },
    primaryCurrency: 'guild',
    favoritable: true,
    goodsType: 'permanent',
  },
  {
    id: 'spd_vip_pack',
    name: 'VIP礼包',
    description: '含多种珍贵资源',
    category: 'special',
    rarity: 'legendary',
    icon: '👑',
    basePrice: { ingot: 298 },
    primaryCurrency: 'ingot',
    favoritable: false,
    goodsType: 'limited',
  },
  {
    id: 'spd_daily_pack',
    name: '每日特惠包',
    description: '超值资源组合',
    category: 'special',
    rarity: 'epic',
    icon: '📦',
    basePrice: { ingot: 198 },
    primaryCurrency: 'ingot',
    favoritable: true,
    goodsType: 'discount',
  },
];

// ─────────────────────────────────────────────
// 全量商品映射
// ─────────────────────────────────────────────

/** 所有商品定义 */
export const ALL_GOODS_DEFS: GoodsDef[] = [
  ...RESOURCE_GOODS,
  ...MATERIAL_GOODS,
  ...EQUIPMENT_GOODS,
  ...CONSUMABLE_GOODS,
  ...SPECIAL_GOODS,
];

/** 商品ID → GoodsDef 映射 */
export const GOODS_DEF_MAP: Record<string, GoodsDef> = Object.fromEntries(
  ALL_GOODS_DEFS.map(g => [g.id, g]),
);

/** 按分类分组的商品 */
export const GOODS_BY_CATEGORY: Record<string, GoodsDef[]> = {
  resource: RESOURCE_GOODS,
  material: MATERIAL_GOODS,
  equipment: EQUIPMENT_GOODS,
  consumable: CONSUMABLE_GOODS,
  special: SPECIAL_GOODS,
};

/** 各商店类型可售商品ID */
export const SHOP_GOODS_IDS: Record<string, string[]> = {
  normal: ALL_GOODS_DEFS.filter(g => g.goodsType !== 'limited').map(g => g.id),
  black_market: ['mat_jade', 'eq_ring_jade', 'con_scroll_exp', 'spd_blueprint'],
  limited_time: ['spd_vip_pack', 'spd_daily_pack'],
  vip: ['spd_vip_pack', 'con_token_summon', 'eq_ring_jade'],
};
