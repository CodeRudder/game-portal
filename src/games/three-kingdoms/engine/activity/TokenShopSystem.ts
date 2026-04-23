/**
 * 引擎层 — 代币兑换商店 v15.0
 *
 * 功能覆盖：
 *   #14 代币兑换商店（七阶稀有度体系）
 *
 * 设计：
 *   - 七阶稀有度：common → uncommon → rare → epic → legendary → mythic → supreme
 *   - 代币消费 + 限购机制
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { TokenShopConfig, TokenShopItem, ShopItemRarity } from '../../core/event/event-activity.types';
import {
  DEFAULT_TOKEN_SHOP_CONFIG,
  RARITY_ORDER,
  RARITY_PRICE_MULTIPLIER,
  DEFAULT_SHOP_ITEMS,
} from './token-shop-config';

export class TokenShopSystem implements ISubsystem {
  // ─── ISubsystem 接口 ───────────────────────

  readonly name = 'tokenShop' as const;
  private deps: ISystemDeps | null = null;

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

  // ─── ISubsystem 适配层 ─────────────────────

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 商店系统无需帧更新 */
  update(_dt: number): void {
    // 商店系统由事件驱动，无需帧更新
  }

  /** 获取系统状态快照 */
  getState(): Record<string, unknown> {
    return {
      name: this.name,
      tokenBalance: this.tokenBalance,
      itemCount: this.items.size,
    };
  }

  /** 重置系统状态 */
  reset(): void {
    this.tokenBalance = 0;
    this.items.clear();
    for (const item of DEFAULT_SHOP_ITEMS) {
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
      for (const [key, value] of Object.entries(item.rewards.resourceChanges as unknown as Record<string, number>)) {
        rewards[key] = (value as number) * quantity;
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
