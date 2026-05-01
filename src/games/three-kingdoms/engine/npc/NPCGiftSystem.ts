/**
 * 引擎层 — NPC 赠送系统
 *
 * 管理 NPC 赠送物品的完整流程：
 *   - 物品定义与偏好物品配置
 *   - 赠送请求处理
 *   - 好感度加成计算（偏好物品更高加成）
 *   - 赠送历史记录
 *
 * 偏好物品计算逻辑委托给 GiftPreferenceCalculator。
 *
 * 功能覆盖：
 *   #3 NPC赠送系统（P0）
 *   #4 NPC偏好物品（P0）
 *
 * @module engine/npc/NPCGiftSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { NPCId, NPCData, NPCProfession } from '../../core/npc';
import { getAffinityLevel } from '../../core/npc';
import type { NPCSystem } from './NPCSystem';
import type {
  ItemId,
  ItemDef,
  NPCPreference,
  GiftRequest,
  GiftResult,
  GiftSystemConfig,
  GiftSaveData,
} from '../../core/npc';
import {
  GiftPreferenceCalculator,
  DEFAULT_PREFERENCES,
  type GiftHistoryEntry,
} from './GiftPreferenceCalculator';

// ─────────────────────────────────────────────
// 常量与默认配置
// ─────────────────────────────────────────────

/** 赠送系统存档版本 */
const GIFT_SAVE_VERSION = 1;

/** 默认赠送系统配置 */
const DEFAULT_GIFT_CONFIG: GiftSystemConfig = {
  maxAffinityPerGift: 30,
  dailyGiftLimit: 10,
  repeatDecayFactor: 0.8,
  minAffinityToGift: 20,
} as const;

// ─────────────────────────────────────────────
// NPC 赠送系统
// ─────────────────────────────────────────────

/**
 * NPC 赠送系统
 *
 * 管理向NPC赠送物品的完整流程，包括物品偏好判断、好感度加成计算。
 * 偏好计算委托给 GiftPreferenceCalculator。
 *
 * @example
 * ```ts
 * const giftSys = new NPCGiftSystem();
 * giftSys.init(deps);
 *
 * // 注册物品
 * giftSys.registerItem({
 *   id: 'item-wine',
 *   name: '美酒',
 *   category: 'drink',
 *   rarity: 'common',
 *   baseAffinityValue: 5,
 *   description: '一壶上好的美酒',
 * });
 *
 * // 赠送物品
 * const result = giftSys.giveGift({
 *   npcId: 'npc-traveler-01',
 *   itemId: 'item-wine',
 *   quantity: 1,
 * });
 * ```
 */
export class NPCGiftSystem implements ISubsystem {
  readonly name = 'npcGift';

  private deps!: ISystemDeps;
  private config: GiftSystemConfig = { ...DEFAULT_GIFT_CONFIG };
  private items: Map<ItemId, ItemDef> = new Map();
  private preferences: Map<NPCProfession, NPCPreference> = new Map();
  private giftHistory: GiftHistoryEntry[] = [];
  private dailyGiftCount = 0;
  private currentTurn = 0;

  /** 偏好计算器 */
  private prefCalculator = new GiftPreferenceCalculator();

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadDefaultPreferences();
  }

  update(_dt: number): void {
    // 赠送系统不需要帧更新
  }

  getState(): { giftHistory: GiftHistoryEntry[]; dailyGiftCount: number } {
    return {
      giftHistory: [...this.giftHistory],
      dailyGiftCount: this.dailyGiftCount,
    };
  }

  reset(): void {
    this.items.clear();
    this.preferences.clear();
    this.giftHistory = [];
    this.dailyGiftCount = 0;
    this.currentTurn = 0;
    this.config = { ...DEFAULT_GIFT_CONFIG };
    this.loadDefaultPreferences();
  }

  // ─────────────────────────────────────────
  // 物品注册
  // ─────────────────────────────────────────

  /** 注册物品定义 */
  registerItem(item: ItemDef): void {
    this.items.set(item.id, { ...item });
  }

  /** 批量注册物品 */
  registerItems(items: ItemDef[]): void {
    items.forEach((i) => this.registerItem(i));
  }

  /** 获取物品定义 */
  getItem(itemId: ItemId): ItemDef | undefined {
    const item = this.items.get(itemId);
    return item ? { ...item } : undefined;
  }

  /** 获取所有已注册物品 */
  getAllItems(): ItemDef[] {
    return Array.from(this.items.values()).map((i) => ({ ...i }));
  }

  /** 按分类获取物品 */
  getItemsByCategory(category: string): ItemDef[] {
    return this.getAllItems().filter((i) => i.category === category);
  }

  // ─────────────────────────────────────────
  // #4 偏好物品管理
  // ─────────────────────────────────────────

  /** 加载默认偏好配置 */
  private loadDefaultPreferences(): void {
    for (const [profession, pref] of Object.entries(DEFAULT_PREFERENCES)) {
      this.preferences.set(profession as NPCProfession, { ...pref });
    }
  }

  /** 设置NPC职业偏好 */
  setPreference(preference: NPCPreference): void {
    this.preferences.set(preference.profession, { ...preference });
  }

  /** 获取NPC职业偏好 */
  getPreference(profession: NPCProfession): NPCPreference | undefined {
    const pref = this.preferences.get(profession);
    return pref ? { ...pref } : undefined;
  }

  /** 判断物品是否为NPC偏好物品 */
  isPreferredItem(profession: NPCProfession, itemId: ItemId): boolean {
    return this.prefCalculator.isPreferredItem(profession, itemId, this.preferences, this.items);
  }

  /** 判断物品是否为NPC不喜欢物品 */
  isDislikedItem(profession: NPCProfession, itemId: ItemId): boolean {
    return this.prefCalculator.isDislikedItem(profession, itemId, this.preferences, this.items);
  }

  // ─────────────────────────────────────────
  // #3 赠送系统
  // ─────────────────────────────────────────

  /**
   * 赠送物品给NPC
   *
   * 完整流程：
   * 1. 验证NPC和物品存在性
   * 2. 检查好感度要求
   * 3. 检查每日赠送次数
   * 4. 计算好感度加成
   * 5. 应用好感度变化
   * 6. 记录赠送历史
   */
  giveGift(request: GiftRequest): GiftResult {
    const { npcId, itemId, quantity } = request;

    // 获取NPC数据
    const npcData = this.getNPCData(npcId);
    if (!npcData) {
      return this.failResult(npcId, itemId, 'NPC不存在');
    }

    // 获取物品数据
    const item = this.items.get(itemId);
    if (!item) {
      return this.failResult(npcId, itemId, '物品不存在');
    }

    // 检查好感度要求
    // FIX-005: NaN防护 [BR-21]
    if (!Number.isFinite(npcData.affinity) || npcData.affinity < this.config.minAffinityToGift) {
      return this.failResult(npcId, itemId, '好感度不足，无法赠送');
    }

    // 检查每日赠送次数
    if (this.config.dailyGiftLimit > 0 && this.dailyGiftCount >= this.config.dailyGiftLimit) {
      return this.failResult(npcId, itemId, '今日赠送次数已用完');
    }

    // 计算好感度加成
    const affinityDelta = this.prefCalculator.calculateAffinityDelta(
      npcData.profession, item, quantity,
      this.preferences, this.config, this.giftHistory,
    );

    // 应用好感度变化
    const previousAffinity = npcData.affinity;
    const newAffinity = this.applyAffinityChange(npcId, affinityDelta);

    // 判断偏好类型
    const isPreferred = this.isPreferredItem(npcData.profession, itemId);
    const isDisliked = this.isDislikedItem(npcData.profession, itemId);

    // 生成反应文本
    const reactionText = this.prefCalculator.getReactionText(
      isPreferred, isDisliked, npcData.affinity, this.config.minAffinityToGift,
    );

    // 更新赠送计数
    this.dailyGiftCount++;

    // 记录历史
    this.giftHistory.push({ npcId, itemId, turn: this.currentTurn, affinityDelta });

    // 发出事件
    this.deps?.eventBus.emit('npc:gift_given', {
      npcId, itemId, quantity, affinityDelta, newAffinity, isPreferred,
    });

    return {
      success: true, npcId, itemId, isPreferred,
      affinityDelta, previousAffinity, newAffinity, reactionText,
    };
  }

  /** 应用好感度变化 */
  private applyAffinityChange(npcId: NPCId, delta: number): number {
    try {
      const npcSys = this.deps?.registry?.get<NPCSystem>('npc');
      if (npcSys?.changeAffinity) {
        const result = npcSys.changeAffinity(npcId, delta);
        return result ?? 0;
      }
    } catch {
      // NPCSystem 不可用
    }
    return 0;
  }

  /** 获取NPC数据 */
  private getNPCData(npcId: NPCId): NPCData | null {
    try {
      const npcSys = this.deps?.registry?.get<NPCSystem>('npc');
      return npcSys?.getNPCById?.(npcId) ?? null;
    } catch {
      return null;
    }
  }

  /** 构造失败结果 */
  private failResult(npcId: NPCId, itemId: ItemId, reason: string): GiftResult {
    return {
      success: false, npcId, itemId, isPreferred: false,
      affinityDelta: 0, previousAffinity: 0, newAffinity: 0,
      reactionText: '', failReason: reason,
    };
  }

  // ─────────────────────────────────────────
  // 配置与查询
  // ─────────────────────────────────────────

  /** 获取系统配置 */
  getConfig(): GiftSystemConfig {
    return { ...this.config };
  }

  /** 更新系统配置 */
  setConfig(config: Partial<GiftSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 设置当前回合 */
  setCurrentTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /** 获取当前回合 */
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  /** 获取赠送历史 */
  getGiftHistory(npcId?: NPCId, limit?: number): GiftHistoryEntry[] {
    let history = npcId
      ? this.giftHistory.filter((h) => h.npcId === npcId)
      : [...this.giftHistory];
    return limit ? history.slice(-limit) : history;
  }

  /** 获取每日赠送次数 */
  getDailyGiftCount(): number {
    return this.dailyGiftCount;
  }

  /** 重置每日赠送次数 */
  resetDailyGiftCount(): void {
    this.dailyGiftCount = 0;
  }

  /**
   * 计算好感度变化量（便捷方法）
   *
   * 封装 GiftPreferenceCalculator.calculateAffinityDelta，
   * 自动注入系统内部的偏好、配置和赠送历史。
   *
   * @param profession - NPC 职业
   * @param item - 物品定义
   * @param quantity - 赠送数量
   * @returns 好感度变化量
   */
  calculateAffinityDelta(
    profession: NPCProfession,
    item: ItemDef,
    quantity: number,
  ): number {
    return this.prefCalculator.calculateAffinityDelta(
      profession, item, quantity,
      this.preferences, this.config, this.giftHistory,
    );
  }

  /** 获取NPC偏好物品推荐列表 */
  getRecommendedItems(profession: NPCProfession): ItemDef[] {
    return this.prefCalculator.getRecommendedItems(
      profession, this.preferences, this.getAllItems(),
    );
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 导出存档数据 */
  exportSaveData(): GiftSaveData {
    return {
      giftHistory: [...this.giftHistory],
      dailyGiftCount: this.dailyGiftCount,
      lastResetDate: 0,
      version: GIFT_SAVE_VERSION,
    };
  }

  /** 导入存档数据 */
  importSaveData(data: GiftSaveData): void {
    this.giftHistory = data.giftHistory ?? [];
    this.dailyGiftCount = data.dailyGiftCount ?? 0;
  }
}
