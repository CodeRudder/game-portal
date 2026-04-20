/**
 * 核心层 — NPC 赠送系统类型定义
 *
 * 定义 v7.0 NPC 赠送系统的核心类型：
 *   - 物品类型与偏好物品
 *   - 赠送请求与结果
 *   - 好感度加成规则
 *
 * @module core/npc/gift.types
 */

import type { NPCId, NPCProfession } from './npc.types';

// ─────────────────────────────────────────────
// 1. 物品类型
// ─────────────────────────────────────────────

/** 物品ID */
export type ItemId = string;

/** 物品稀有度 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** 物品分类 */
export type ItemCategory =
  | 'food'        // 食物
  | 'drink'       // 饮品
  | 'weapon'      // 武器
  | 'armor'       // 防具
  | 'material'    // 材料
  | 'book'        // 书籍
  | 'jewelry'     // 珠宝
  | 'medicine';   // 药品

/** 物品定义 */
export interface ItemDef {
  /** 物品ID */
  id: ItemId;
  /** 物品名称 */
  name: string;
  /** 物品分类 */
  category: ItemCategory;
  /** 稀有度 */
  rarity: ItemRarity;
  /** 基础好感度值 */
  baseAffinityValue: number;
  /** 描述 */
  description: string;
}

// ─────────────────────────────────────────────
// 2. NPC 偏好物品
// ─────────────────────────────────────────────

/** NPC 偏好物品配置 */
export interface NPCPreference {
  /** NPC 职业 */
  profession: NPCProfession;
  /** 偏好物品分类列表（按优先级排序） */
  preferredCategories: ItemCategory[];
  /** 偏好物品ID列表 */
  preferredItems: ItemId[];
  /** 偏好物品加成倍率 */
  preferredMultiplier: number;
  /** 普通物品加成倍率 */
  normalMultiplier: number;
  /** 不喜欢物品分类列表 */
  dislikedCategories: ItemCategory[];
  /** 不喜欢物品好感度衰减倍率 */
  dislikeMultiplier: number;
}

// ─────────────────────────────────────────────
// 3. 赠送请求与结果
// ─────────────────────────────────────────────

/** 赠送请求 */
export interface GiftRequest {
  /** 目标NPC ID */
  npcId: NPCId;
  /** 物品ID */
  itemId: ItemId;
  /** 物品数量（默认1） */
  quantity: number;
}

/** 赠送结果 */
export interface GiftResult {
  /** 是否成功 */
  success: boolean;
  /** NPC ID */
  npcId: NPCId;
  /** 物品ID */
  itemId: ItemId;
  /** 是否为偏好物品 */
  isPreferred: boolean;
  /** 好感度变化量 */
  affinityDelta: number;
  /** 变化前好感度 */
  previousAffinity: number;
  /** 变化后好感度 */
  newAffinity: number;
  /** NPC 反应文本 */
  reactionText: string;
  /** 失败原因（success=false时） */
  failReason?: string;
}

/** 赠送系统配置 */
export interface GiftSystemConfig {
  /** 单次赠送好感度上限 */
  maxAffinityPerGift: number;
  /** 每日赠送次数上限（0=无限制） */
  dailyGiftLimit: number;
  /** 连续赠送同一NPC衰减系数 */
  repeatDecayFactor: number;
  /** 最低好感度要求 */
  minAffinityToGift: number;
}

/** 赠送系统存档数据 */
export interface GiftSaveData {
  /** 赠送历史（NPC ID → 上次赠送时间映射） */
  giftHistory: Array<{
    npcId: NPCId;
    itemId: ItemId;
    turn: number;
    affinityDelta: number;
  }>;
  /** 每日赠送计数 */
  dailyGiftCount: number;
  /** 上次重置日期 */
  lastResetDate: number;
  /** 版本号 */
  version: number;
}
