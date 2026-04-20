/**
 * 竞技商店系统 — 引擎层
 *
 * 职责：竞技币兑换、物品管理、周限购
 * 规则：
 *   - 货币：竞技币
 *   - 物品类型：武将碎片/强化石/装备箱/头像框
 *   - 部分物品周限购
 *
 * @module engine/pvp/ArenaShopSystem
 */

import type { ArenaShopItem, ArenaPlayerState } from '../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认竞技商店物品列表 */
export const DEFAULT_ARENA_SHOP_ITEMS: ArenaShopItem[] = [
  { itemId: 'fragment_liubei', itemName: '刘备碎片', itemType: 'hero_fragment', arenaCoinCost: 100, weeklyLimit: 5, purchased: 0 },
  { itemId: 'fragment_guanyu', itemName: '关羽碎片', itemType: 'hero_fragment', arenaCoinCost: 120, weeklyLimit: 5, purchased: 0 },
  { itemId: 'fragment_zhangfei', itemName: '张飞碎片', itemType: 'hero_fragment', arenaCoinCost: 120, weeklyLimit: 5, purchased: 0 },
  { itemId: 'fragment_zhaoyun', itemName: '赵云碎片', itemType: 'hero_fragment', arenaCoinCost: 150, weeklyLimit: 3, purchased: 0 },
  { itemId: 'fragment_zhugeliang', itemName: '诸葛亮碎片', itemType: 'hero_fragment', arenaCoinCost: 200, weeklyLimit: 3, purchased: 0 },
  { itemId: 'enhance_stone_small', itemName: '初级强化石', itemType: 'enhance_stone', arenaCoinCost: 50, weeklyLimit: 10, purchased: 0 },
  { itemId: 'enhance_stone_medium', itemName: '中级强化石', itemType: 'enhance_stone', arenaCoinCost: 150, weeklyLimit: 5, purchased: 0 },
  { itemId: 'enhance_stone_large', itemName: '高级强化石', itemType: 'enhance_stone', arenaCoinCost: 400, weeklyLimit: 2, purchased: 0 },
  { itemId: 'equip_box_bronze', itemName: '青铜装备箱', itemType: 'equipment_box', arenaCoinCost: 80, weeklyLimit: 0, purchased: 0 },
  { itemId: 'equip_box_silver', itemName: '白银装备箱', itemType: 'equipment_box', arenaCoinCost: 200, weeklyLimit: 5, purchased: 0 },
  { itemId: 'equip_box_gold', itemName: '黄金装备箱', itemType: 'equipment_box', arenaCoinCost: 500, weeklyLimit: 2, purchased: 0 },
  { itemId: 'avatar_bronze', itemName: '青铜头像框', itemType: 'avatar_frame', arenaCoinCost: 300, weeklyLimit: 1, purchased: 0 },
  { itemId: 'avatar_silver', itemName: '白银头像框', itemType: 'avatar_frame', arenaCoinCost: 600, weeklyLimit: 1, purchased: 0 },
  { itemId: 'avatar_gold', itemName: '黄金头像框', itemType: 'avatar_frame', arenaCoinCost: 1000, weeklyLimit: 1, purchased: 0 },
];

/** 竞技商店存档数据 */
export interface ArenaShopSaveData {
  version: number;
  items: ArenaShopItem[];
}

/** 竞技商店存档版本 */
export const ARENA_SHOP_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// ArenaShopSystem 类
// ─────────────────────────────────────────────

/**
 * 竞技商店系统
 *
 * 管理竞技币兑换和物品限购
 */
export class ArenaShopSystem {
  /** 商店物品列表 */
  private items: ArenaShopItem[];

  constructor(items?: ArenaShopItem[]) {
    this.items = (items ?? DEFAULT_ARENA_SHOP_ITEMS).map((item) => ({ ...item }));
  }

  // ── 商品查询 ──────────────────────────────

  /**
   * 获取所有商品
   */
  getAllItems(): ArenaShopItem[] {
    return this.items.map((item) => ({ ...item }));
  }

  /**
   * 按类型获取商品
   */
  getItemsByType(itemType: ArenaShopItem['itemType']): ArenaShopItem[] {
    return this.items.filter((i) => i.itemType === itemType).map((i) => ({ ...i }));
  }

  /**
   * 获取指定商品
   */
  getItem(itemId: string): ArenaShopItem | undefined {
    const item = this.items.find((i) => i.itemId === itemId);
    return item ? { ...item } : undefined;
  }

  // ── 购买逻辑 ──────────────────────────────

  /**
   * 购买商品
   *
   * @returns 更新后的玩家状态和购买结果
   * @throws 竞技币不足 / 商品不存在 / 超出限购
   */
  buyItem(
    playerState: ArenaPlayerState,
    itemId: string,
    count: number = 1,
  ): { state: ArenaPlayerState; item: ArenaShopItem } {
    if (count <= 0) {
      throw new Error('购买数量必须大于0');
    }

    const itemIdx = this.items.findIndex((i) => i.itemId === itemId);
    if (itemIdx < 0) {
      throw new Error('商品不存在');
    }

    const item = this.items[itemIdx];

    // 检查限购
    if (item.weeklyLimit > 0 && item.purchased + count > item.weeklyLimit) {
      throw new Error(`每周限购${item.weeklyLimit}个，已购${item.purchased}个`);
    }

    // 检查竞技币
    const totalCost = item.arenaCoinCost * count;
    if (playerState.arenaCoins < totalCost) {
      throw new Error('竞技币不足');
    }

    // 更新商品已购数量
    this.items[itemIdx] = { ...item, purchased: item.purchased + count };

    // 更新玩家状态
    const newState: ArenaPlayerState = {
      ...playerState,
      arenaCoins: playerState.arenaCoins - totalCost,
    };

    return { state: newState, item: { ...this.items[itemIdx] } };
  }

  /**
   * 检查是否可以购买
   */
  canBuy(
    playerState: ArenaPlayerState,
    itemId: string,
    count: number = 1,
  ): { canBuy: boolean; reason: string } {
    const item = this.items.find((i) => i.itemId === itemId);
    if (!item) {
      return { canBuy: false, reason: '商品不存在' };
    }
    if (count <= 0) {
      return { canBuy: false, reason: '购买数量必须大于0' };
    }
    if (item.weeklyLimit > 0 && item.purchased + count > item.weeklyLimit) {
      return { canBuy: false, reason: '超出周限购数量' };
    }
    if (playerState.arenaCoins < item.arenaCoinCost * count) {
      return { canBuy: false, reason: '竞技币不足' };
    }
    return { canBuy: true, reason: '' };
  }

  // ── 周重置 ──────────────────────────────

  /**
   * 每周重置限购计数
   */
  weeklyReset(): void {
    this.items = this.items.map((item) => ({ ...item, purchased: 0 }));
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化商店数据
   */
  serialize(): ArenaShopSaveData {
    return {
      version: ARENA_SHOP_SAVE_VERSION,
      items: this.items.map((i) => ({ ...i })),
    };
  }

  /**
   * 反序列化恢复商店数据
   */
  deserialize(data: ArenaShopSaveData): void {
    if (!data || data.version !== ARENA_SHOP_SAVE_VERSION) return;
    this.items = data.items.map((i) => ({ ...i }));
  }
}
