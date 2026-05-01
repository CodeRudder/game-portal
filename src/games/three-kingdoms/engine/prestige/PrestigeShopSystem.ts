/**
 * 引擎层 — 声望商店系统
 *
 * 管理声望商店的商品购买：
 *   #6 声望商店 — 等级解锁商品、声望值消耗
 *
 * @module engine/prestige/PrestigeShopSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  PrestigeShopGoods,
  PrestigeShopItem,
  PrestigeState,
} from '../../core/prestige';
import {
  PRESTIGE_SHOP_GOODS,
} from '../../core/prestige';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建商品实例列表 */
function createShopItems(): PrestigeShopItem[] {
  return PRESTIGE_SHOP_GOODS.map((g) => ({
    defId: g.id,
    purchased: 0,
    unlocked: g.requiredLevel <= 1,
  }));
}

// ─────────────────────────────────────────────
// PrestigeShopSystem 类
// ─────────────────────────────────────────────

/**
 * 声望商店系统
 *
 * 管理声望商店的商品展示、购买和限购。
 */
export class PrestigeShopSystem implements ISubsystem {
  readonly name = 'prestigeShop';

  private deps!: ISystemDeps;
  private items: PrestigeShopItem[] = createShopItems();
  private prestigePoints = 0;
  private prestigeLevel = 1;

  /** 奖励回调 */
  private rewardCallback?: (rewards: Record<string, number>) => void;

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;

    // 监听声望等级变化
    this.deps.eventBus.on<{ level: number }>('prestige:levelUp', (payload) => {
      this.prestigeLevel = payload.level;
      this.updateUnlockStatus();
    });
  }

  update(_dt: number): void {
    // 商店不依赖帧更新
  }

  getState(): { items: PrestigeShopItem[]; prestigePoints: number; prestigeLevel: number } {
    return {
      items: this.items.map((i) => ({ ...i })),
      prestigePoints: this.prestigePoints,
      prestigeLevel: this.prestigeLevel,
    };
  }

  reset(): void {
    this.items = createShopItems();
    this.prestigePoints = 0;
    this.prestigeLevel = 1;
  }

  // ─── 配置 ───────────────────────────────

  /** 设置奖励回调 */
  setRewardCallback(cb: (rewards: Record<string, number>) => void): void {
    this.rewardCallback = cb;
  }

  /** 更新声望值（由PrestigeSystem调用） */
  updatePrestigeInfo(points: number, level: number): void {
    this.prestigePoints = points;
    this.prestigeLevel = level;
    this.updateUnlockStatus();
  }

  // ─── 公开 API ───────────────────────────

  /** 获取所有商品（含解锁状态） */
  getAllGoods(): (PrestigeShopGoods & { unlocked: boolean; purchased: number; canBuy: boolean })[] {
    return PRESTIGE_SHOP_GOODS.map((g) => {
      const item = this.items.find((i) => i.defId === g.id);
      const unlocked = this.prestigeLevel >= g.requiredLevel;
      const purchased = item?.purchased ?? 0;
      const canBuy = unlocked
        && this.prestigePoints >= g.costPoints
        && (g.purchaseLimit < 0 || purchased < g.purchaseLimit);

      return { ...g, unlocked, purchased, canBuy };
    });
  }

  /** 获取已解锁商品 */
  getUnlockedGoods(): (PrestigeShopGoods & { unlocked: boolean; purchased: number; canBuy: boolean })[] {
    return this.getAllGoods().filter((g) => g.unlocked);
  }

  /**
   * 购买商品 (#6)
   * @returns 购买结果
   */
  buyGoods(goodsId: string, quantity: number = 1): {
    success: boolean;
    reason?: string;
    cost?: number;
    rewards?: Record<string, number>;
  } {
    // FIX-505: quantity NaN/负值/非有限数防护
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, reason: '购买数量无效' };
    }
    // FIX-505: prestigePoints NaN防护
    if (!Number.isFinite(this.prestigePoints)) {
      return { success: false, reason: '声望值数据异常' };
    }

    const goodsDef = PRESTIGE_SHOP_GOODS.find((g) => g.id === goodsId);
    if (!goodsDef) {
      return { success: false, reason: '商品不存在' };
    }

    // 检查等级
    if (this.prestigeLevel < goodsDef.requiredLevel) {
      return { success: false, reason: `需要声望等级${goodsDef.requiredLevel}` };
    }

    // 检查限购
    const item = this.items.find((i) => i.defId === goodsId);
    const currentPurchased = item?.purchased ?? 0;
    if (goodsDef.purchaseLimit > 0 && currentPurchased + quantity > goodsDef.purchaseLimit) {
      return { success: false, reason: '已达购买上限' };
    }

    // 检查声望值
    const totalCost = goodsDef.costPoints * quantity;
    if (this.prestigePoints < totalCost) {
      return { success: false, reason: '声望值不足' };
    }

    // 执行购买
    this.prestigePoints -= totalCost;
    if (item) {
      item.purchased += quantity;
    }

    // 发放奖励
    if (this.rewardCallback) {
      const scaledRewards: Record<string, number> = {};
      for (const [key, val] of Object.entries(goodsDef.rewards)) {
        scaledRewards[key] = val * quantity;
      }
      this.rewardCallback(scaledRewards);
    }

    // 发射购买事件
    this.deps.eventBus.emit('prestigeShop:purchased', {
      goodsId,
      quantity,
      cost: totalCost,
    });

    return {
      success: true,
      cost: totalCost,
      rewards: goodsDef.rewards,
    };
  }

  /** 检查商品是否可购买 */
  canBuyGoods(goodsId: string): { canBuy: boolean; reason?: string } {
    const goodsDef = PRESTIGE_SHOP_GOODS.find((g) => g.id === goodsId);
    if (!goodsDef) return { canBuy: false, reason: '商品不存在' };
    if (this.prestigeLevel < goodsDef.requiredLevel) {
      return { canBuy: false, reason: `需要声望等级${goodsDef.requiredLevel}` };
    }
    const item = this.items.find((i) => i.defId === goodsId);
    if (goodsDef.purchaseLimit > 0 && (item?.purchased ?? 0) >= goodsDef.purchaseLimit) {
      return { canBuy: false, reason: '已达购买上限' };
    }
    if (this.prestigePoints < goodsDef.costPoints) {
      return { canBuy: false, reason: '声望值不足' };
    }
    return { canBuy: true };
  }

  /** 获取商品购买记录 */
  getPurchaseHistory(): Record<string, number> {
    const history: Record<string, number> = {};
    for (const item of this.items) {
      if (item.purchased > 0) {
        history[item.defId] = item.purchased;
      }
    }
    return history;
  }

  /** 加载购买记录 */
  loadPurchases(purchases: Record<string, number>): void {
    for (const item of this.items) {
      item.purchased = purchases[item.defId] ?? 0;
    }
  }

  // FIX-506: 存档序列化/反序列化
  /** 获取商店存档数据 */
  getSaveData(): { shopPurchases: Record<string, number>; prestigePoints: number; prestigeLevel: number } {
    return {
      shopPurchases: this.getPurchaseHistory(),
      prestigePoints: this.prestigePoints,
      prestigeLevel: this.prestigeLevel,
    };
  }

  /** 加载商店存档数据 */
  loadSaveData(data: { shopPurchases?: Record<string, number>; prestigePoints?: number; prestigeLevel?: number }): void {
    if (!data) return;
    if (data.shopPurchases) {
      this.loadPurchases(data.shopPurchases);
    }
    if (Number.isFinite(data.prestigePoints)) {
      this.prestigePoints = data.prestigePoints!;
    }
    if (Number.isFinite(data.prestigeLevel) && data.prestigeLevel! > 0) {
      this.prestigeLevel = data.prestigeLevel!;
    }
    this.updateUnlockStatus();
  }

  // ─── 内部方法 ───────────────────────────

  /** 更新商品解锁状态 */
  private updateUnlockStatus(): void {
    for (const item of this.items) {
      const def = PRESTIGE_SHOP_GOODS.find((g) => g.id === item.defId);
      if (def) {
        item.unlocked = this.prestigeLevel >= def.requiredLevel;
      }
    }
  }
}
