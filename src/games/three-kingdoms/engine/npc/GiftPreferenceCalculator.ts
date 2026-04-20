/**
 * 引擎层 — 赠送偏好计算器
 *
 * 从 NPCGiftSystem 拆分出的偏好物品计算逻辑：
 *   - 物品偏好/不喜欢判断
 *   - 好感度加成计算（含稀有度、偏好倍率、连续衰减）
 *   - NPC 反应文本生成
 *   - 偏好物品推荐
 *
 * @module engine/npc/GiftPreferenceCalculator
 */

import type { NPCId, NPCProfession } from '../../core/npc';
import type {
  ItemId,
  ItemRarity,
  ItemCategory,
  ItemDef,
  NPCPreference,
  GiftSystemConfig,
} from '../../core/npc';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 稀有度好感度倍率 */
const RARITY_MULTIPLIERS: Record<ItemRarity, number> = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.0,
  epic: 3.0,
  legendary: 5.0,
} as const;

/** 各职业默认偏好物品分类 */
export const DEFAULT_PREFERENCES: Record<NPCProfession, NPCPreference> = {
  merchant: {
    profession: 'merchant',
    preferredCategories: ['jewelry', 'food'],
    preferredItems: ['item-gold-ingot', 'item-silk'],
    preferredMultiplier: 2.0,
    normalMultiplier: 1.0,
    dislikedCategories: ['weapon'],
    dislikeMultiplier: 0.5,
  },
  strategist: {
    profession: 'strategist',
    preferredCategories: ['book', 'medicine'],
    preferredItems: ['item-art-of-war', 'item-herb'],
    preferredMultiplier: 2.0,
    normalMultiplier: 1.0,
    dislikedCategories: ['jewelry'],
    dislikeMultiplier: 0.5,
  },
  warrior: {
    profession: 'warrior',
    preferredCategories: ['weapon', 'armor'],
    preferredItems: ['item-iron-sword', 'item-shield'],
    preferredMultiplier: 2.0,
    normalMultiplier: 1.0,
    dislikedCategories: ['book'],
    dislikeMultiplier: 0.5,
  },
  artisan: {
    profession: 'artisan',
    preferredCategories: ['material', 'jewelry'],
    preferredItems: ['item-iron-ore', 'item-crystal'],
    preferredMultiplier: 2.0,
    normalMultiplier: 1.0,
    dislikedCategories: ['food'],
    dislikeMultiplier: 0.5,
  },
  traveler: {
    profession: 'traveler',
    preferredCategories: ['food', 'drink'],
    preferredItems: ['item-wine', 'item-bread'],
    preferredMultiplier: 2.0,
    normalMultiplier: 1.0,
    dislikedCategories: ['armor'],
    dislikeMultiplier: 0.5,
  },
} as const;

/** NPC 反应文本模板 */
const REACTION_TEXTS = {
  preferred: [
    '太好了！这正是我想要的！',
    '你真是太了解我了！',
    '这正是我梦寐以求的东西！',
  ],
  normal: [
    '谢谢你的心意。',
    '多谢，不错的礼物。',
    '感谢赠礼。',
  ],
  disliked: [
    '这个……不太适合我。',
    '嗯……谢谢，不过我对此不太感兴趣。',
    '你的好意我心领了，但这个……',
  ],
  lowAffinity: [
    '我们还不熟，你为什么要送我东西？',
    '不好意思，我不接受陌生人的礼物。',
  ],
} as const;

// ─────────────────────────────────────────────
// 赠送历史条目（内部使用）
// ─────────────────────────────────────────────

export interface GiftHistoryEntry {
  npcId: NPCId;
  itemId: ItemId;
  turn: number;
  affinityDelta: number;
}

// ─────────────────────────────────────────────
// 赠送偏好计算器
// ─────────────────────────────────────────────

/**
 * 赠送偏好计算器
 *
 * 负责物品偏好判断、好感度加成计算和反应文本生成。
 */
export class GiftPreferenceCalculator {
  /**
   * 判断物品是否为 NPC 偏好物品
   *
   * @param profession - NPC 职业
   * @param itemId - 物品 ID
   * @param preferences - 职业偏好映射
   * @param items - 物品定义映射
   * @returns 是否为偏好物品
   */
  isPreferredItem(
    profession: NPCProfession,
    itemId: ItemId,
    preferences: Map<NPCProfession, NPCPreference>,
    items: Map<ItemId, ItemDef>,
  ): boolean {
    const pref = preferences.get(profession);
    if (!pref) return false;

    // 检查是否在偏好物品列表中
    if (pref.preferredItems.includes(itemId)) return true;

    // 检查物品分类是否在偏好分类中
    const item = items.get(itemId);
    if (item && pref.preferredCategories.includes(item.category)) return true;

    return false;
  }

  /**
   * 判断物品是否为 NPC 不喜欢物品
   */
  isDislikedItem(
    profession: NPCProfession,
    itemId: ItemId,
    preferences: Map<NPCProfession, NPCPreference>,
    items: Map<ItemId, ItemDef>,
  ): boolean {
    const pref = preferences.get(profession);
    if (!pref) return false;

    const item = items.get(itemId);
    if (item && pref.dislikedCategories.includes(item.category)) return true;

    return false;
  }

  /**
   * 计算好感度变化量
   *
   * 考虑因素：
   * - 物品基础好感度
   * - 物品稀有度倍率
   * - 偏好/不喜欢物品倍率
   * - 连续赠送衰减
   * - 数量加成
   * - 单次上限
   *
   * @param profession - NPC 职业
   * @param item - 物品定义
   * @param quantity - 赠送数量
   * @param preferences - 职业偏好映射
   * @param config - 赠送系统配置
   * @param giftHistory - 赠送历史（用于计算连续赠送衰减）
   */
  calculateAffinityDelta(
    profession: NPCProfession,
    item: ItemDef,
    quantity: number,
    preferences: Map<NPCProfession, NPCPreference>,
    config: GiftSystemConfig,
    giftHistory: GiftHistoryEntry[],
  ): number {
    const pref = preferences.get(profession);

    // 基础值 × 数量
    let baseValue = item.baseAffinityValue * quantity;

    // 稀有度倍率
    const rarityMult = RARITY_MULTIPLIERS[item.rarity] ?? 1.0;
    baseValue *= rarityMult;

    // 偏好/不喜欢倍率
    let preferenceMult = pref?.normalMultiplier ?? 1.0;
    if (pref) {
      if (pref.preferredItems.includes(item.id) ||
          pref.preferredCategories.includes(item.category)) {
        preferenceMult = pref.preferredMultiplier;
      } else if (pref.dislikedCategories.includes(item.category)) {
        preferenceMult = pref.dislikeMultiplier;
      }
    }
    baseValue *= preferenceMult;

    // 连续赠送衰减
    const repeatCount = this.getRepeatGiftCount(item.id, giftHistory);
    if (repeatCount > 0) {
      baseValue *= Math.pow(config.repeatDecayFactor, repeatCount);
    }

    // 限制单次上限
    baseValue = Math.min(baseValue, config.maxAffinityPerGift);

    return Math.max(0, Math.round(baseValue));
  }

  /**
   * 获取连续赠送同一物品的次数
   */
  getRepeatGiftCount(itemId: ItemId, giftHistory: GiftHistoryEntry[]): number {
    let count = 0;
    for (let i = giftHistory.length - 1; i >= 0; i--) {
      const entry = giftHistory[i];
      if (entry.itemId === itemId) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * 生成 NPC 反应文本
   */
  getReactionText(
    isPreferred: boolean,
    isDisliked: boolean,
    affinity: number,
    minAffinityToGift: number,
  ): string {
    if (affinity < minAffinityToGift) {
      return this.randomChoice(REACTION_TEXTS.lowAffinity);
    }
    if (isPreferred) {
      return this.randomChoice(REACTION_TEXTS.preferred);
    }
    if (isDisliked) {
      return this.randomChoice(REACTION_TEXTS.disliked);
    }
    return this.randomChoice(REACTION_TEXTS.normal);
  }

  /**
   * 获取 NPC 偏好物品推荐列表
   *
   * @param profession - NPC 职业
   * @param preferences - 职业偏好映射
   * @param allItems - 所有物品列表
   * @returns 推荐物品列表（按偏好排序）
   */
  getRecommendedItems(
    profession: NPCProfession,
    preferences: Map<NPCProfession, NPCPreference>,
    allItems: ItemDef[],
  ): ItemDef[] {
    const pref = preferences.get(profession);
    if (!pref) return [];

    // 偏好物品优先
    const preferred = allItems.filter(
      (i) => pref.preferredItems.includes(i.id) ||
             pref.preferredCategories.includes(i.category),
    );

    // 普通物品
    const normal = allItems.filter(
      (i) => !pref.preferredItems.includes(i.id) &&
             !pref.preferredCategories.includes(i.category) &&
             !pref.dislikedCategories.includes(i.category),
    );

    return [...preferred, ...normal];
  }

  /** 随机选择数组元素 */
  private randomChoice<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
