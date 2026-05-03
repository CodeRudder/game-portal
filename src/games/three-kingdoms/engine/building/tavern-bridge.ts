/**
 * 酒馆↔招募桥接层
 *
 * 职责：将酒馆等级转化为招募概率加成，供 HeroRecruitSystem 通过回调注入。
 * 核心公式：actualRate = baseRate × (1 + tavernLevel × 0.02) × (1 + techBonus) × (1 + heroInt)
 *
 * 规则：
 * - 不修改 HeroRecruitSystem 核心逻辑
 * - 通过回调/注入方式连接
 * - 纯函数，无副作用
 *
 * @module engine/building/tavern-bridge
 */

// ─────────────────────────────────────────────
// 1. 常量配置
// ─────────────────────────────────────────────

/** 每级酒馆提供的概率加成比例（2%） */
const TAVERN_BONUS_PER_LEVEL = 0.02;

/** 酒馆功能解锁配置 */
const TAVERN_FEATURE_UNLOCK: Record<string, number> = {
  /** Lv1~5: 普通招募 */
  normalRecruit: 1,
  /** Lv6~10: 高级招募 */
  advancedRecruit: 6,
  /** Lv11~15: 十连招募 */
  tenPull: 11,
  /** Lv16~20: 保底可见（可预览保底计数） */
  pityVisible: 16,
} as const;

// ─────────────────────────────────────────────
// 2. 核心计算函数
// ─────────────────────────────────────────────

/**
 * 获取酒馆等级对应的招募概率加成
 *
 * @param tavernLevel 酒馆等级（1~20）
 * @returns 概率加成百分比（如酒馆Lv5→0.10 = 10%）
 *
 * @example
 * ```ts
 * getRecruitBonus(5);  // 0.10 (10%)
 * getRecruitBonus(10); // 0.20 (20%)
 * ```
 */
export function getRecruitBonus(tavernLevel: number): number {
  if (tavernLevel <= 0) return 0;
  const clampedLevel = Math.min(tavernLevel, 20);
  return clampedLevel * TAVERN_BONUS_PER_LEVEL;
}

/**
 * 计算实际招募概率
 *
 * 公式：actualRate = baseRate × (1 + tavernBonus) × (1 + techBonus) × (1 + heroInt)
 * - tavernBonus: 酒馆等级 × 2%
 * - techBonus: 科技加成（0~0.3）
 * - heroInt: 英雄智力加成（0~0.2）
 *
 * @param baseRate 基础概率（0~1）
 * @param tavernLevel 酒馆等级
 * @param techBonus 科技加成（可选，默认0）
 * @param heroInt 英雄智力加成（可选，默认0）
 * @returns 实际概率（0~1）
 *
 * @example
 * ```ts
 * // 基础5% × (1+10%) × (1+5%) × (1+8%) = 6.237%
 * calculateActualRate(0.05, 5, 0.05, 0.08); // ≈ 0.06237
 * ```
 */
export function calculateActualRate(
  baseRate: number,
  tavernLevel: number,
  techBonus: number = 0,
  heroInt: number = 0,
): number {
  const tavernBonus = getRecruitBonus(tavernLevel);
  const actualRate = baseRate * (1 + tavernBonus) * (1 + techBonus) * (1 + heroInt);
  // 概率上限为1.0（100%）
  return Math.min(actualRate, 1.0);
}

/**
 * 获取酒馆功能解锁等级
 *
 * @param feature 功能名称
 * @returns 解锁所需酒馆等级，未知功能返回 -1
 *
 * @example
 * ```ts
 * getTavernUnlockLevel('normalRecruit');    // 1
 * getTavernUnlockLevel('advancedRecruit');  // 6
 * getTavernUnlockLevel('pityVisible');      // 16
 * ```
 */
export function getTavernUnlockLevel(feature: string): number {
  return TAVERN_FEATURE_UNLOCK[feature] ?? -1;
}

/**
 * 检查酒馆是否已解锁指定功能
 *
 * @param tavernLevel 当前酒馆等级
 * @param feature 功能名称
 * @returns 是否已解锁
 */
export function isTavernFeatureUnlocked(tavernLevel: number, feature: string): boolean {
  const requiredLevel = getTavernUnlockLevel(feature);
  return requiredLevel > 0 && tavernLevel >= requiredLevel;
}

// ─────────────────────────────────────────────
// 3. 序列化支持
// ─────────────────────────────────────────────

/** 酒馆桥接层存档数据 */
export interface TavernBridgeSaveData {
  /** 版本号 */
  version: number;
  /** 上次计算的加成快照（用于离线校验） */
  lastBonusSnapshot?: number;
}

/** 当前版本号 */
export const TAVERN_BRIDGE_SAVE_VERSION = 1;

/**
 * 序列化酒馆桥接层状态
 */
export function serializeTavernBridge(tavernLevel: number): TavernBridgeSaveData {
  return {
    version: TAVERN_BRIDGE_SAVE_VERSION,
    lastBonusSnapshot: getRecruitBonus(tavernLevel),
  };
}

/**
 * 反序列化酒馆桥接层状态
 */
export function deserializeTavernBridge(data: unknown): TavernBridgeSaveData {
  if (typeof data === 'object' && data !== null && 'version' in data) {
    const d = data as TavernBridgeSaveData;
    return {
      version: d.version ?? TAVERN_BRIDGE_SAVE_VERSION,
      lastBonusSnapshot: d.lastBonusSnapshot,
    };
  }
  return { version: TAVERN_BRIDGE_SAVE_VERSION };
}
