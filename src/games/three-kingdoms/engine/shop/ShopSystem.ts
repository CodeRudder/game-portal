/**
 * 引擎层 — 商店系统
 *
 * 管理商店的完整生命周期：
 *   - 商品列表与分类展示
 *   - 库存与限购管理
 *   - 购买流程（五级确认策略）
 *   - 折扣机制（常规/限时/NPC好感度）
 *   - 收藏管理
 *   - 补货机制
 *   - 序列化/反序列化
 *
 * 功能覆盖：
 *   #1 商品分类  #2 定价规则  #3 购买逻辑基础
 *   #5 集市商店主界面  #6 商品卡片信息
 *   #7 定价规则与折扣机制  #8 购买逻辑  #9 库存与限购
 *
 * @module engine/shop/ShopSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ShopType, GoodsCategory, GoodsDef, GoodsItem,
  BuyRequest, BuyResult, BuyValidation, ConfirmLevel,
  ShopState, ShopSaveData, DiscountConfig, GoodsFilter,
} from '../../core/shop';
import { SHOP_TYPES, SHOP_TYPE_LABELS, GOODS_CATEGORY_LABELS } from '../../core/shop';
import {
  DEFAULT_RESTOCK_CONFIG, DAILY_MANUAL_REFRESH_LIMIT, SHOP_SAVE_VERSION,
  CONFIRM_THRESHOLDS, PERMANENT_GOODS_STOCK, RANDOM_GOODS_STOCK,
  DISCOUNT_GOODS_STOCK, LIMITED_GOODS_STOCK,
} from '../../core/shop';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '../../core/shop';
import { gameLog } from '../../core/logger';

// ─── 货币操作接口（依赖倒置，解耦 CurrencySystem 具体类） ───

/**
 * 商店所需的货币操作接口。
 *
 * 参照 TradeSystem 的 TradeCurrencyOps 模式，
 * 将 ShopSystem 对 CurrencySystem 具体类的直接依赖替换为接口回调，
 * 遵循依赖倒置原则 (DIP)。
 *
 * @see TRD-P1-01 修复
 */
export interface ShopCurrencyOps {
  /** 批量检查货币是否充足，返回不足信息 */
  checkAffordability: (costs: Record<string, number>) => {
    canAfford: boolean;
    shortages: Array<{ currency: string; required: number; current: number; gap: number }>;
  };
  /** 按优先级消耗货币，失败时抛出异常 */
  spendByPriority: (shopType: string, costs: Record<string, number>) => Record<string, number>;
}

// ─── 辅助函数 ────────────────────────────────

/** 获取默认库存 */
function defaultStock(goodsType: GoodsDef['goodsType']): number {
  const map: Record<string, number> = {
    permanent: PERMANENT_GOODS_STOCK,
    random: RANDOM_GOODS_STOCK,
    discount: DISCOUNT_GOODS_STOCK,
    limited: LIMITED_GOODS_STOCK,
  };
  return map[goodsType] ?? PERMANENT_GOODS_STOCK;
}

/** 获取默认限购 */
function defaultLimits(goodsType: GoodsDef['goodsType']): { dailyLimit: number; lifetimeLimit: number } {
  switch (goodsType) {
    case 'discount': return { dailyLimit: 2, lifetimeLimit: -1 };
    case 'limited': return { dailyLimit: 1, lifetimeLimit: 3 };
    case 'random': return { dailyLimit: 5, lifetimeLimit: -1 };
    default: return { dailyLimit: -1, lifetimeLimit: -1 };
  }
}

/** 创建商品实例 */
function createItem(defId: string): GoodsItem {
  const def = GOODS_DEF_MAP[defId];
  const gt = def?.goodsType ?? 'permanent';
  const lim = defaultLimits(gt);
  return {
    defId, stock: defaultStock(gt), maxStock: defaultStock(gt),
    discount: gt === 'discount' ? 0.8 : 1,
    dailyPurchased: 0, lifetimePurchased: 0,
    dailyLimit: lim.dailyLimit, lifetimeLimit: lim.lifetimeLimit,
    listedAt: Date.now(), favorited: false,
  };
}

/** 铜钱等价汇率 */
const COPPER_RATES: Record<string, number> = {
  copper: 1, mandate: 100, recruit: 200, summon: 500,
  expedition: 80, guild: 80, reputation: 50, ingot: 1000,
};

/** 货币中文名 */
const CUR_LABELS: Record<string, string> = {
  copper: '铜钱', mandate: '天命', recruit: '招贤令', summon: '求贤令',
  expedition: '远征币', guild: '公会币', reputation: '声望值', ingot: '元宝',
};

// ─── ShopSystem ──────────────────────────────

export class ShopSystem implements ISubsystem {
  readonly name = 'shop';

  private deps!: ISystemDeps;
  private currencyOps: ShopCurrencyOps | null = null;
  private shops: Record<ShopType, ShopState> = {} as Record<ShopType, ShopState>;
  private favorites: Set<string> = new Set();
  private activeDiscounts: DiscountConfig[] = [];
  private npcDiscountProvider: ((npcId: string) => number) | null = null;
  private lastUpdateTick: number = 0;

  constructor() {
    const now = Date.now();
    for (const type of SHOP_TYPES) {
      this.shops[type] = this.emptyShop(type, now);
    }
  }

  // ─── ISubsystem ───────────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; this.lastUpdateTick = Date.now(); }
  update(_dt: number): void {
    // 定时补货：每8h自动刷新
    const now = Date.now();
    const interval = DEFAULT_RESTOCK_CONFIG.scheduledInterval * 1000;
    for (const type of SHOP_TYPES) {
      const shop = this.shops[type];
      if (now - shop.lastScheduledRestock >= interval) {
        this.restockShop(type, now);
      }
    }
  }
  getState(): Record<ShopType, ShopState> { return { ...this.shops }; }

  reset(): void {
    const now = Date.now();
    for (const type of SHOP_TYPES) this.shops[type] = this.emptyShop(type, now);
    this.favorites.clear();
    this.activeDiscounts = [];
  }

  // ─── 依赖注入 ─────────────────────────────

  /**
   * 注入货币操作接口（推荐方式，遵循依赖倒置原则）
   *
   * 使用方式：
   * ```ts
   * shopSystem.setCurrencyOps({
   *   checkAffordability: (costs) => currencySystem.checkAffordability(costs),
   *   spendByPriority: (shopType, costs) => currencySystem.spendByPriority(shopType, costs),
   * });
   * ```
   */
  setCurrencyOps(ops: ShopCurrencyOps): void { this.currencyOps = ops; }

  /**
   * @deprecated 使用 setCurrencyOps 替代。保留向后兼容。
   * 直接传入 CurrencySystem 实例时自动适配为 ShopCurrencyOps 接口。
   */
  setCurrencySystem(cs: { checkAffordability: (costs: Record<string, number>) => { canAfford: boolean; shortages: Array<{ currency: string; required: number; current: number; gap: number }> }; spendByPriority: (shopType: string, costs: Record<string, number>) => Record<string, number> }): void {
    this.currencyOps = cs;
  }

  setNPCDiscountProvider(fn: (npcId: string) => number): void { this.npcDiscountProvider = fn; }

  // ─── 1. 商品分类展示（#1, #5, #6）──────────

  getShopGoods(shopType: ShopType): GoodsItem[] {
    return this.shops[shopType]?.goods ?? [];
  }

  getGoodsByCategory(shopType: ShopType, category: GoodsCategory): GoodsItem[] {
    return this.shops[shopType].goods.filter(i => GOODS_DEF_MAP[i.defId]?.category === category);
  }

  getCategories(): GoodsCategory[] {
    return Object.keys(GOODS_CATEGORY_LABELS) as GoodsCategory[];
  }

  getGoodsDef(defId: string): GoodsDef | undefined {
    return GOODS_DEF_MAP[defId];
  }

  getGoodsItem(shopType: ShopType, defId: string): GoodsItem | undefined {
    return this.shops[shopType].goods.find(g => g.defId === defId);
  }

  /** 搜索/过滤商品 */
  filterGoods(shopType: ShopType, filter: GoodsFilter): GoodsItem[] {
    let items = [...this.shops[shopType].goods];

    if (filter.category) items = items.filter(i => GOODS_DEF_MAP[i.defId]?.category === filter.category);
    if (filter.rarity) items = items.filter(i => GOODS_DEF_MAP[i.defId]?.rarity === filter.rarity);
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      items = items.filter(i => {
        const d = GOODS_DEF_MAP[i.defId];
        return d?.name.toLowerCase().includes(kw) || d?.description.toLowerCase().includes(kw);
      });
    }
    if (filter.inStockOnly) items = items.filter(i => i.stock === -1 || i.stock > 0);
    if (filter.favoritesOnly) items = items.filter(i => this.favorites.has(i.defId));
    if (filter.priceRange) {
      const [min, max] = filter.priceRange;
      items = items.filter(i => {
        const p = Object.values(GOODS_DEF_MAP[i.defId]?.basePrice ?? {})[0] ?? 0;
        return p >= min && p <= max;
      });
    }

    // 排序（默认排序：推荐→折扣→价格升序）
    const sortBy = filter.sortBy ?? 'default';
    const order = filter.sortOrder ?? 'asc';
    items.sort((a, b) => {
      const dA = GOODS_DEF_MAP[a.defId], dB = GOODS_DEF_MAP[b.defId];
      let cmp = 0;
      if (sortBy === 'price') cmp = (Object.values(dA?.basePrice ?? {})[0] ?? 0) - (Object.values(dB?.basePrice ?? {})[0] ?? 0);
      else if (sortBy === 'name') cmp = (dA?.name ?? '').localeCompare(dB?.name ?? '');
      else if (sortBy === 'discount') cmp = a.discount - b.discount;
      else if (sortBy === 'default') {
        // 默认排序规则：1.收藏优先 2.折扣优先 3.价格升序
        const favA = this.favorites.has(a.defId) ? 0 : 1;
        const favB = this.favorites.has(b.defId) ? 0 : 1;
        if (favA !== favB) { cmp = favA - favB; }
        else if (a.discount !== b.discount) { cmp = a.discount - b.discount; }
        else { cmp = (Object.values(dA?.basePrice ?? {})[0] ?? 0) - (Object.values(dB?.basePrice ?? {})[0] ?? 0); }
      }
      return order === 'asc' ? cmp : -cmp;
    });
    return items;
  }

  // ─── 2. 定价与折扣（#2, #7）────────────────

  calculateFinalPrice(defId: string, shopType: ShopType, npcId?: string): Record<string, number> {
    const def = GOODS_DEF_MAP[defId];
    if (!def) return {};

    const item = this.getGoodsItem(shopType, defId);
    const itemDiscount = item?.discount ?? 1;

    // NPC好感度折扣
    let npcRate = 1;
    if (npcId && this.npcDiscountProvider) npcRate = this.npcDiscountProvider(npcId);

    // 活跃折扣（取最低）
    let activeRate = 1;
    const now = Date.now();
    for (const dc of this.activeDiscounts) {
      if (now >= dc.startTime && now <= dc.endTime) {
        if (dc.applicableGoods.length === 0 || dc.applicableGoods.includes(defId)) {
          activeRate = Math.min(activeRate, dc.rate);
        }
      }
    }

    const finalRate = Math.min(itemDiscount, npcRate, activeRate);
    const result: Record<string, number> = {};
    for (const [cur, price] of Object.entries(def.basePrice)) {
      result[cur] = Math.ceil(price * finalRate);
    }
    return result;
  }

  addDiscount(config: DiscountConfig): void { this.activeDiscounts.push(config); }

  cleanupExpiredDiscounts(): number {
    const now = Date.now();
    const before = this.activeDiscounts.length;
    this.activeDiscounts = this.activeDiscounts.filter(d => d.endTime > now);
    return before - this.activeDiscounts.length;
  }

  // ─── 3. 购买逻辑（#3, #8）──────────────────

  validateBuy(request: BuyRequest, npcId?: string): BuyValidation {
    const errors: string[] = [];
    const { goodsId, quantity, shopType } = request;

    // 数量合法性校验
    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return { canBuy: false, confirmLevel: 'none', errors: ['购买数量无效：必须为正整数'], finalPrice: {} };
    }

    const def = GOODS_DEF_MAP[goodsId];
    if (!def) return { canBuy: false, confirmLevel: 'none', errors: ['商品不存在'], finalPrice: {} };

    const item = this.getGoodsItem(shopType, goodsId);
    if (!item) return { canBuy: false, confirmLevel: 'none', errors: ['商品不在当前商店中'], finalPrice: {} };

    if (item.stock !== -1 && item.stock < quantity) errors.push(`库存不足：剩余 ${item.stock}，需要 ${quantity}`);
    if (item.dailyLimit !== -1 && item.dailyPurchased + quantity > item.dailyLimit) errors.push(`每日限购 ${item.dailyLimit}，已购 ${item.dailyPurchased}`);
    if (item.lifetimeLimit !== -1 && item.lifetimePurchased + quantity > item.lifetimeLimit) errors.push(`终身限购 ${item.lifetimeLimit}，已购 ${item.lifetimePurchased}`);

    const finalPrice = this.calculateFinalPrice(goodsId, shopType, npcId);

    if (this.currencyOps) {
      // ACC-10-20 fix: 货币检查金额 = 单价 × 数量
      const totalCost: Record<string, number> = {};
      for (const [cur, price] of Object.entries(finalPrice)) {
        totalCost[cur] = price * quantity;
      }
      const check = this.currencyOps.checkAffordability(totalCost);
      if (!check.canAfford) {
        for (const s of check.shortages) errors.push(`${CUR_LABELS[s.currency]}不足：需要 ${s.required}，缺少 ${s.gap}`);
      }
    }

    const copperEq = this.toCopperEq(finalPrice);
    return { canBuy: errors.length === 0, confirmLevel: this.confirmLevel(copperEq), errors, finalPrice };
  }

  executeBuy(request: BuyRequest, npcId?: string): BuyResult {
    const validation = this.validateBuy(request, npcId);
    if (!validation.canBuy) return { success: false, reason: validation.errors.join('; '), confirmLevel: validation.confirmLevel };

    const { goodsId, quantity, shopType } = request;

    if (this.currencyOps) {
      // ACC-10-20 fix: 扣费金额 = 单价 × 数量
      const totalCost: Record<string, number> = {};
      for (const [cur, price] of Object.entries(validation.finalPrice)) {
        totalCost[cur] = price * quantity;
      }
      try { this.currencyOps.spendByPriority(shopType, totalCost); }
      catch (e) { return { success: false, reason: (e as Error).message, confirmLevel: validation.confirmLevel }; }
    }

    const item = this.getGoodsItem(shopType, goodsId);
    if (item) {
      if (item.stock !== -1) item.stock -= quantity;
      item.dailyPurchased += quantity;
      item.lifetimePurchased += quantity;
    }

    try {
      this.deps?.eventBus?.emit('shop:goods_purchased', { goodsId, quantity, shopType, cost: validation.finalPrice });
    } catch { /* ok */ }

    // ACC-10-20 fix: 返回总价而非单价
    const totalCostResult: Record<string, number> = {};
    for (const [cur, price] of Object.entries(validation.finalPrice)) {
      totalCostResult[cur] = price * quantity;
    }
    return { success: true, goodsId, quantity, cost: totalCostResult, confirmLevel: validation.confirmLevel };
  }

  // ─── 4. 库存与限购（#9）────────────────────

  getStockInfo(shopType: ShopType, defId: string) {
    const item = this.getGoodsItem(shopType, defId);
    if (!item) return null;
    return { stock: item.stock, dailyPurchased: item.dailyPurchased, dailyLimit: item.dailyLimit, lifetimePurchased: item.lifetimePurchased, lifetimeLimit: item.lifetimeLimit };
  }

  resetDailyLimits(): void {
    for (const type of SHOP_TYPES) {
      for (const item of this.shops[type].goods) item.dailyPurchased = 0;
      this.shops[type].manualRefreshCount = 0;
    }
  }

  manualRefresh(): { success: boolean; reason?: string } {
    for (const type of SHOP_TYPES) {
      if (this.shops[type].manualRefreshCount >= this.shops[type].manualRefreshLimit) return { success: false, reason: '今日刷新次数已用完' };
    }
    const now = Date.now();
    for (const type of SHOP_TYPES) {
      this.shops[type].manualRefreshCount++;
      this.restockShop(type, now);
    }
    return { success: true };
  }

  // ─── 5. 收藏管理 ─────────────────────────

  toggleFavorite(defId: string): boolean {
    const def = GOODS_DEF_MAP[defId];
    if (!def || !def.favoritable) return false;

    const adding = !this.favorites.has(defId);
    if (adding) this.favorites.add(defId); else this.favorites.delete(defId);

    for (const type of SHOP_TYPES) {
      const item = this.shops[type].goods.find(g => g.defId === defId);
      if (item) item.favorited = adding;
    }
    return adding;
  }

  isFavorite(defId: string): boolean { return this.favorites.has(defId); }
  getFavorites(): string[] { return [...this.favorites]; }

  /** 离线补货（登录时调用，最多累积2次） */
  processOfflineRestock(): void {
    const now = Date.now();
    const offlineInterval = DEFAULT_RESTOCK_CONFIG.offlineInterval * 1000;
    const maxAccumulation = DEFAULT_RESTOCK_CONFIG.offlineMaxAccumulation;

    for (const type of SHOP_TYPES) {
      const shop = this.shops[type];
      const elapsed = now - shop.lastOfflineRestock;
      const accumulated = Math.min(maxAccumulation, Math.floor(elapsed / offlineInterval));

      if (accumulated > 0) {
        this.restockShop(type, now);
        // 10%概率出现稀有
        if (Math.random() < DEFAULT_RESTOCK_CONFIG.offlineRareChance) {
          for (const item of shop.goods) {
            if (item.discount === 1) {
              item.discount = 0.7; // 稀有折扣
              break;
            }
          }
        }
      }
    }
  }

  // ─── 6. 商店等级 ─────────────────────────

  getShopLevel(shopType: ShopType): number { return this.shops[shopType].shopLevel; }
  setShopLevel(shopType: ShopType, level: number): void { this.shops[shopType].shopLevel = level; }

  // ─── 7. 序列化 ────────────────────────────

  serialize(): ShopSaveData {
    return { shops: { ...this.shops }, favorites: [...this.favorites], version: SHOP_SAVE_VERSION };
  }

  deserialize(data: ShopSaveData): void {
    if (data.version !== SHOP_SAVE_VERSION) gameLog.warn(`ShopSystem: 存档版本不匹配 (期望 ${SHOP_SAVE_VERSION}，实际 ${data.version})`);
    for (const type of SHOP_TYPES) { if (data.shops[type]) this.shops[type] = data.shops[type]; }
    this.favorites.clear();
    if (data.favorites) for (const id of data.favorites) this.favorites.add(id);
  }

  // ─── 内部方法 ──────────────────────────────

  private emptyShop(type: ShopType, now: number): ShopState {
    const ids = SHOP_GOODS_IDS[type] ?? [];
    return {
      shopType: type, goods: ids.map(id => createItem(id)),
      lastScheduledRestock: now, lastOfflineRestock: now,
      manualRefreshCount: 0, manualRefreshLimit: DAILY_MANUAL_REFRESH_LIMIT, shopLevel: 1,
    };
  }

  private restockShop(shopType: ShopType, now: number): void {
    const shop = this.shops[shopType];
    const ids = SHOP_GOODS_IDS[shopType] ?? [];
    shop.goods = ids.map(id => createItem(id));
    for (const item of shop.goods) {
      if (Math.random() < DEFAULT_RESTOCK_CONFIG.discountChance) item.discount = 0.7 + Math.random() * 0.2;
    }
    shop.lastScheduledRestock = now;
  }

  private toCopperEq(price: Record<string, number>): number {
    let total = 0;
    for (const [cur, amt] of Object.entries(price)) total += amt * (COPPER_RATES[cur] ?? 1);
    return total;
  }

  private confirmLevel(copperEq: number): ConfirmLevel {
    if (copperEq <= CONFIRM_THRESHOLDS.none) return 'none';
    if (copperEq <= CONFIRM_THRESHOLDS.low) return 'low';
    if (copperEq <= CONFIRM_THRESHOLDS.medium) return 'medium';
    if (copperEq <= CONFIRM_THRESHOLDS.high) return 'high';
    return 'critical';
  }
}
