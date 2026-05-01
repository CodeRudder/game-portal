/**
 * 联盟商店系统 — 引擎层
 *
 * 职责：公会币商店管理、等级解锁商品、限购重置
 * 规则：
 *   - 货币：公会币（联盟活动/Boss/任务产出）
 *   - 商品按联盟等级解锁
 *   - 部分商品每周限购
 *   - 每周重置限购数量
 *
 * @module engine/alliance/AllianceShopSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AllianceShopItem,
  AllianceShopConfig,
  AlliancePlayerState,
} from '../../core/alliance/alliance.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认联盟商店商品 */
export const DEFAULT_ALLIANCE_SHOP_ITEMS: AllianceShopItem[] = [
  { id: 'as_1', name: '招募令', type: 'recruit_order', guildCoinCost: 50, weeklyLimit: 5, purchased: 0, requiredAllianceLevel: 1 },
  { id: 'as_2', name: '装备箱·良', type: 'equip_box', guildCoinCost: 30, weeklyLimit: 3, purchased: 0, requiredAllianceLevel: 1 },
  { id: 'as_3', name: '加速道具·小', type: 'speed_item', guildCoinCost: 20, weeklyLimit: 10, purchased: 0, requiredAllianceLevel: 1 },
  { id: 'as_4', name: '武将碎片·随机', type: 'hero_fragment', guildCoinCost: 80, weeklyLimit: 3, purchased: 0, requiredAllianceLevel: 3 },
  { id: 'as_5', name: '装备箱·精', type: 'equip_box', guildCoinCost: 60, weeklyLimit: 2, purchased: 0, requiredAllianceLevel: 5 },
  { id: 'as_6', name: '武将碎片·稀有', type: 'hero_fragment', guildCoinCost: 150, weeklyLimit: 1, purchased: 0, requiredAllianceLevel: 7 },
];

// ─────────────────────────────────────────────
// AllianceShopSystem 类
// ─────────────────────────────────────────────

/**
 * 联盟商店系统
 *
 * 管理公会币商店、等级解锁、限购
 */
export class AllianceShopSystem implements ISubsystem {
  readonly name = 'AllianceShopSystem';
  private deps!: ISystemDeps;
  private shopItems: AllianceShopItem[];

  constructor(shopItems?: AllianceShopItem[]) {
    this.shopItems = shopItems ?? DEFAULT_ALLIANCE_SHOP_ITEMS.map(i => ({ ...i }));
  }

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    /* 预留 */
  }

  getState(): Record<string, unknown> {
    return {
      shopItems: this.shopItems.map(i => ({ ...i })),
    };
  }

  reset(): void {
    this.resetShopWeekly();
  }

  // ── 商品查询 ──────────────────────────────

  /**
   * 获取全部商品
   */
  getAllItems(): AllianceShopItem[] {
    return [...this.shopItems];
  }

  /**
   * 获取可购买商品列表（按联盟等级过滤）
   */
  getAvailableShopItems(allianceLevel: number): AllianceShopItem[] {
    return this.shopItems.filter(item => item.requiredAllianceLevel <= allianceLevel);
  }

  /**
   * 获取单个商品
   */
  getItem(itemId: string): AllianceShopItem | undefined {
    return this.shopItems.find(i => i.id === itemId);
  }

  /**
   * 检查商品是否解锁
   */
  isItemUnlocked(itemId: string, allianceLevel: number): boolean {
    const item = this.getItem(itemId);
    if (!item) return false;
    return item.requiredAllianceLevel <= allianceLevel;
  }

  /**
   * 检查商品是否可购买（解锁 + 限购未满）
   */
  canBuy(itemId: string, allianceLevel: number, guildCoins: number): {
    canBuy: boolean;
    reason: string;
  } {
    const item = this.getItem(itemId);
    if (!item) return { canBuy: false, reason: '商品不存在' };
    if (item.requiredAllianceLevel > allianceLevel) {
      return { canBuy: false, reason: `需要联盟等级${item.requiredAllianceLevel}` };
    }
    if (item.weeklyLimit > 0 && item.purchased >= item.weeklyLimit) {
      return { canBuy: false, reason: '已达限购上限' };
    }
    if (guildCoins < item.guildCoinCost) {
      return { canBuy: false, reason: '公会币不足' };
    }
    return { canBuy: true, reason: '' };
  }

  // ── 购买操作 ──────────────────────────────

  /**
   * 购买商品
   */
  buyShopItem(
    playerState: AlliancePlayerState,
    itemId: string,
    allianceLevel: number,
  ): AlliancePlayerState {
    const item = this.getItem(itemId);
    if (!item) throw new Error('商品不存在');
    if (item.requiredAllianceLevel > allianceLevel) throw new Error('联盟等级不足');
    if (item.weeklyLimit > 0 && item.purchased >= item.weeklyLimit) throw new Error('已达限购上限');
    if (playerState.guildCoins < item.guildCoinCost) throw new Error('公会币不足');

    item.purchased++;
    return {
      ...playerState,
      guildCoins: playerState.guildCoins - item.guildCoinCost,
    };
  }

  /**
   * 批量购买商品
   */
  buyShopItemBatch(
    playerState: AlliancePlayerState,
    itemId: string,
    count: number,
    allianceLevel: number,
  ): AlliancePlayerState {
    const item = this.getItem(itemId);
    if (!item) throw new Error('商品不存在');
    if (item.requiredAllianceLevel > allianceLevel) throw new Error('联盟等级不足');

    const remaining = item.weeklyLimit > 0 ? item.weeklyLimit - item.purchased : count;
    const actualCount = Math.min(count, remaining);
    if (actualCount <= 0) throw new Error('已达限购上限');

    const totalCost = item.guildCoinCost * actualCount;
    if (playerState.guildCoins < totalCost) throw new Error('公会币不足');

    item.purchased += actualCount;
    return {
      ...playerState,
      guildCoins: playerState.guildCoins - totalCost,
    };
  }

  // ── 重置 ──────────────────────────────────

  /**
   * 重置商店周购（每周重置）
   */
  resetShopWeekly(): void {
    for (const item of this.shopItems) {
      item.purchased = 0;
    }
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 获取商品购买剩余次数
   */
  getRemainingPurchases(itemId: string): number {
    const item = this.getItem(itemId);
    if (!item) return 0;
    if (item.weeklyLimit <= 0) return Infinity;
    return Math.max(0, item.weeklyLimit - item.purchased);
  }

  /**
   * 获取按类型分组的商品
   */
  getItemsByType(allianceLevel: number): Record<string, AllianceShopItem[]> {
    const available = this.getAvailableShopItems(allianceLevel);
    const grouped: Record<string, AllianceShopItem[]> = {};
    for (const item of available) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item);
    }
    return grouped;
  }

  // ── 存档序列化 (FIX-P0-003: Alliance R1 存档接入) ──

  /** 商店存档数据 */
  serialize(): { items: Array<{ id: string; purchased: number }> } {
    return {
      items: this.shopItems.map(i => ({ id: i.id, purchased: i.purchased })),
    };
  }

  /** 从存档恢复限购状态 */
  deserialize(data: { items: Array<{ id: string; purchased: number }> }): void {
    if (!data || !Array.isArray(data.items)) return;
    for (const saved of data.items) {
      const item = this.shopItems.find(i => i.id === saved.id);
      if (item) {
        item.purchased = Math.max(0, saved.purchased);
      }
    }
  }
}
