/**
 * 引擎层 — 代币兑换商店 v15.0
 *
 * 功能覆盖：
 *   #14 代币兑换商店（七阶稀有度体系）
 *
 * 设计：
 *   - 七阶稀有度：common → uncommon → rare → epic → legendary → mythic → supreme
 *   - 代币消费 + 限购机制
 *   - 商品刷新（每日/手动）
 *   - 活动专属商品
 *
 * @module engine/activity/TokenShopSystem
 */

import type {
  TokenShopItem,
  TokenShopConfig,
  ShopItemRarity,
} from '../../core/event/event-v15.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认商店配置 */
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
export class TokenShopSystem {
  private config: TokenShopConfig;
  private items: Map<string, TokenShopItem> = new Map();
  private tokenBalance: number = 0;

  constructor(
    config?: Partial<TokenShopConfig>,
    initialItems?: TokenShopItem[],
    initialTokens: number = 0,
  ) {
    this.config = { ...DEFAULT_TOKEN_SHOP_CONFIG, ...config };
    this.tokenBalance = initialTokens;

    // 加载商品
    const items = initialItems ?? DEFAULT_SHOP_ITEMS;
    for (const item of items) {
      this.items.set(item.id, { ...item });
    }
  }

  // ─── 商品查询 ──────────────────────────────

  /**
   * 获取所有商品
   */
  getAllItems(): TokenShopItem[] {
    return Array.from(this.items.values());
  }

  /**
   * 获取可用商品（上架且未售罄）
   */
  getAvailableItems(): TokenShopItem[] {
    return this.getAllItems().filter((item) => {
      if (!item.available) return false;
      if (item.purchaseLimit > 0 && item.purchased >= item.purchaseLimit) return false;
      return true;
    });
  }

  /**
   * 获取指定商品
   */
  getItem(itemId: string): TokenShopItem | undefined {
    return this.items.get(itemId);
  }

  /**
   * 按稀有度获取商品
   */
  getItemsByRarity(rarity: ShopItemRarity): TokenShopItem[] {
    return this.getAllItems().filter((item) => item.rarity === rarity);
  }

  /**
   * 按活动ID获取商品
   */
  getItemsByActivity(activityId: string): TokenShopItem[] {
    return this.getAllItems().filter(
      (item) => item.activityId === activityId || item.activityId === '',
    );
  }

  // ─── 购买操作 ──────────────────────────────

  /**
   * 购买商品
   *
   * @returns 购买结果（成功时包含奖励）
   */
  purchaseItem(itemId: string, quantity: number = 1): {
    success: boolean;
    rewards: Record<string, number>;
    tokensSpent: number;
    reason?: string;
  } {
    const item = this.items.get(itemId);
    if (!item) {
      return { success: false, rewards: {}, tokensSpent: 0, reason: '商品不存在' };
    }

    if (!item.available) {
      return { success: false, rewards: {}, tokensSpent: 0, reason: '商品已下架' };
    }

    // 限购检查
    if (item.purchaseLimit > 0 && item.purchased + quantity > item.purchaseLimit) {
      const remaining = item.purchaseLimit - item.purchased;
      return {
        success: false,
        rewards: {},
        tokensSpent: 0,
        reason: `限购${item.purchaseLimit}个，还可购买${remaining}个`,
      };
    }

    // 代币余额检查
    const totalCost = item.tokenPrice * quantity;
    if (this.tokenBalance < totalCost) {
      return {
        success: false,
        rewards: {},
        tokensSpent: 0,
        reason: `代币不足（需要${totalCost}，当前${this.tokenBalance}）`,
      };
    }

    // 执行购买
    this.tokenBalance -= totalCost;
    item.purchased += quantity;

    // 计算奖励
    const rewards: Record<string, number> = {};
    if (item.rewards.resourceChanges) {
      for (const [key, value] of Object.entries(item.rewards.resourceChanges)) {
        rewards[key] = value * quantity;
      }
    }

    return { success: true, rewards, tokensSpent: totalCost };
  }

  // ─── 代币管理 ──────────────────────────────

  /**
   * 获取代币余额
   */
  getTokenBalance(): number {
    return this.tokenBalance;
  }

  /**
   * 增加代币
   */
  addTokens(amount: number): number {
    this.tokenBalance += amount;
    return this.tokenBalance;
  }

  /**
   * 消耗代币
   */
  spendTokens(amount: number): { success: boolean; newBalance: number } {
    if (this.tokenBalance < amount) {
      return { success: false, newBalance: this.tokenBalance };
    }
    this.tokenBalance -= amount;
    return { success: true, newBalance: this.tokenBalance };
  }

  // ─── 商品管理 ──────────────────────────────

  /**
   * 添加商品
   */
  addItem(item: TokenShopItem): void {
    this.items.set(item.id, { ...item });
  }

  /**
   * 移除商品
   */
  removeItem(itemId: string): boolean {
    return this.items.delete(itemId);
  }

  /**
   * 刷新商店（重置购买数量）
   */
  refreshShop(): number {
    let refreshed = 0;
    for (const item of this.items.values()) {
      if (item.purchased > 0) {
        item.purchased = 0;
        refreshed++;
      }
    }
    return refreshed;
  }

  /**
   * 每日刷新（重置限购商品 + 可选更新商品列表）
   */
  dailyRefresh(newItems?: TokenShopItem[]): number {
    // 重置购买计数
    for (const item of this.items.values()) {
      item.purchased = 0;
    }

    // 如果有新商品，更新列表
    if (newItems) {
      this.items.clear();
      for (const item of newItems) {
        this.items.set(item.id, { ...item });
      }
    }

    return this.items.size;
  }

  /**
   * 设置商品上架/下架
   */
  setItemAvailability(itemId: string, available: boolean): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;
    item.available = available;
    return true;
  }

  // ─── 工具方法 ──────────────────────────────

  /** 获取配置 */
  getConfig(): TokenShopConfig {
    return { ...this.config };
  }

  /** 获取稀有度排序 */
  static getRarityOrder(): ShopItemRarity[] {
    return [...RARITY_ORDER];
  }

  /** 获取稀有度价格倍率 */
  static getRarityPriceMultiplier(): Record<ShopItemRarity, number> {
    return { ...RARITY_PRICE_MULTIPLIER };
  }

  /** 获取默认商品列表 */
  static getDefaultItems(): TokenShopItem[] {
    return DEFAULT_SHOP_ITEMS.map((item) => ({ ...item }));
  }

  // ─── 序列化 ──────────────────────────────

  /** 导出存档 */
  serialize(): {
    config: TokenShopConfig;
    items: TokenShopItem[];
    tokenBalance: number;
  } {
    return {
      config: { ...this.config },
      items: this.getAllItems().map((item) => ({ ...item })),
      tokenBalance: this.tokenBalance,
    };
  }

  /** 导入存档 */
  deserialize(data: {
    config: TokenShopConfig;
    items: TokenShopItem[];
    tokenBalance: number;
  }): void {
    this.config = { ...data.config };
    this.tokenBalance = data.tokenBalance;
    this.items.clear();
    for (const item of data.items) {
      this.items.set(item.id, { ...item });
    }
  }
}
