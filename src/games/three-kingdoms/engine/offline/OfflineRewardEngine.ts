/**
 * 离线收益引擎 — 离线计算核心
 *
 * 职责：
 *   - 基础公式：产出 × 离线秒数 × 衰减系数 × 加成系数
 *   - 6档衰减系数分段计算
 *   - 科技/VIP/声望加成叠加（上限+100%）
 *   - 72h封顶机制
 *   - 翻倍机制（广告/元宝）
 *   - 资源溢出检测与截断
 *   - 各系统离线效率修正
 *
 * 规则：纯计算引擎，不持有游戏状态，所有数据通过参数传入
 *
 * @module engine/offline/OfflineRewardEngine
 */

import type { Resources, ProductionRate, ResourceCap } from '../../shared/types';
import type {
  TierDetail, OfflineSnapshot, DoubleRequest, DoubleResult,
  OfflineRewardResultV9, OverflowRule,
} from './offline.types';
import {
  DECAY_TIERS, MAX_OFFLINE_SECONDS, OFFLINE_POPUP_THRESHOLD,
  SYSTEM_EFFICIENCY_MODIFIERS, OVERFLOW_RULES,
} from './offline-config';
import {
  formatOfflineDuration, shouldShowOfflinePopup,
  generateReturnPanelData, estimateOfflineReward as _estimateOfflineReward,
} from './OfflinePanelHelper';
import { zeroRes, cloneRes, addRes, mulRes, floorRes } from './offline-utils';

// 重导出面板辅助函数，保持向后兼容
export {
  formatOfflineDuration,
  shouldShowOfflinePopup,
  generateReturnPanelData,
};

/**
 * 离线预估（包装 OfflinePanelHelper 版本，自动注入快照计算函数）
 */
export function estimateOfflineReward(
  hours: number,
  productionRates: Readonly<ProductionRate>,
  bonusSources: { tech?: number; vip?: number; reputation?: number } = {},
): OfflineSnapshot {
  return _estimateOfflineReward(hours, productionRates, bonusSources, calculateOfflineSnapshot);
}

// ─────────────────────────────────────────────
// 1. 衰减系数计算
// ─────────────────────────────────────────────

/**
 * 计算各档位衰减明细
 *
 * 将离线时长按6档衰减表分段，每段独立计算产出。
 */
export function calculateTierDetails(
  offlineSeconds: number,
  productionRates: Readonly<ProductionRate>,
): TierDetail[] {
  const details: TierDetail[] = [];

  for (const tier of DECAY_TIERS) {
    const tierStartSeconds = tier.startHours * 3600;
    const tierEndSeconds = tier.endHours * 3600;
    if (offlineSeconds <= tierStartSeconds) break;

    const secondsInTier = Math.min(offlineSeconds, tierEndSeconds) - tierStartSeconds;
    if (secondsInTier <= 0) continue;

    const earned = zeroRes();
    for (const key of Object.keys(productionRates) as (keyof ProductionRate)[]) {
      earned[key] = productionRates[key] * secondsInTier * tier.efficiency;
    }
    details.push({ tierId: tier.id, seconds: secondsInTier, efficiency: tier.efficiency, earned });
  }
  return details;
}

/**
 * 计算综合衰减效率（0~1）
 */
export function calculateOverallEfficiency(offlineSeconds: number): number {
  const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
  if (effectiveSeconds <= 0) return 1.0;

  let totalWeighted = 0;
  for (const tier of DECAY_TIERS) {
    const tierStartSeconds = tier.startHours * 3600;
    const tierEndSeconds = tier.endHours * 3600;
    if (effectiveSeconds <= tierStartSeconds) break;

    const secondsInTier = Math.min(effectiveSeconds, tierEndSeconds) - tierStartSeconds;
    if (secondsInTier <= 0) continue;
    totalWeighted += secondsInTier * tier.efficiency;
  }
  return totalWeighted / effectiveSeconds;
}

// ─────────────────────────────────────────────
// 2. 加成系数计算
// ─────────────────────────────────────────────

/** 加成来源 */
export interface BonusSources {
  tech?: number;
  vip?: number;
  reputation?: number;
}

/** 加成上限 */
const MAX_BONUS = 1.0; // +100%

/**
 * 计算加成系数
 * 公式：1 + min(科技 + VIP + 声望, MAX_BONUS)
 */
export function calculateBonusCoefficient(sources: BonusSources): number {
  // [FIX-v9] NaN 透传：任一来源为 NaN 时结果为 NaN（引擎行为）
  // undefined 视为 0（未激活加成）
  const tech = sources.tech ?? 0;
  const vip = sources.vip ?? 0;
  const reputation = sources.reputation ?? 0;
  const total = tech + vip + reputation;
  // NaN + number = NaN，自动透传
  return 1 + Math.min(total, MAX_BONUS);
}

// ─────────────────────────────────────────────
// 3. 离线收益核心计算
// ─────────────────────────────────────────────

/**
 * 计算离线收益快照
 *
 * 核心公式：产出 × 离线秒数 × 衰减系数 × 加成系数
 * 72h封顶，超过不再产出
 */
export function calculateOfflineSnapshot(
  offlineSeconds: number,
  productionRates: Readonly<ProductionRate>,
  bonusSources: BonusSources,
  timestamp: number = Date.now(),
): OfflineSnapshot {
  const isCapped = offlineSeconds > MAX_OFFLINE_SECONDS;
  const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);

  // 1. 各档位衰减明细
  const tierDetails = calculateTierDetails(effectiveSeconds, productionRates);

  // 2. 基础收益（含衰减）
  let totalEarned = zeroRes();
  for (const detail of tierDetails) {
    totalEarned = addRes(totalEarned, detail.earned);
  }

  // 3. 加成系数
  const bonusCoefficient = calculateBonusCoefficient(bonusSources);

  // 4. 应用加成
  totalEarned = mulRes(totalEarned, bonusCoefficient);

  // 5. 取整
  totalEarned = floorRes(totalEarned);

  // 6. 综合效率
  const overallEfficiency = calculateOverallEfficiency(effectiveSeconds);

  return { timestamp, offlineSeconds, tierDetails, totalEarned, overallEfficiency, isCapped };
}

// ─────────────────────────────────────────────
// 4. 翻倍机制
// ─────────────────────────────────────────────

/** 广告翻倍每日上限 */
const AD_DAILY_LIMIT = 3;

/**
 * 应用翻倍
 * 广告翻倍（3次/天）和元宝翻倍（无限制）二选一，不可叠加
 */
export function applyDouble(
  earned: Readonly<Resources>,
  request: DoubleRequest,
  adUsedToday: number = 0,
): DoubleResult {
  // [FIX-806] adUsedToday NaN 防护 + multiplier 下限防护
  const safeAdUsed = Number.isFinite(adUsedToday) ? adUsedToday : 0;
  if (request.source === 'ad' && safeAdUsed >= AD_DAILY_LIMIT) {
    return {
      success: false,
      originalEarned: cloneRes(earned),
      doubledEarned: cloneRes(earned),
      appliedMultiplier: 1,
      reason: `今日广告翻倍次数已用完（${AD_DAILY_LIMIT}次）`,
    };
  }

  const rawMultiplier = request.multiplier ?? 2;
  const multiplier = (!Number.isFinite(rawMultiplier) || rawMultiplier < 1) ? 1 : rawMultiplier;
  return {
    success: true,
    originalEarned: cloneRes(earned),
    doubledEarned: floorRes(mulRes(earned, multiplier)),
    appliedMultiplier: multiplier,
  };
}

// ─────────────────────────────────────────────
// 5. 资源溢出处理
// ─────────────────────────────────────────────

/**
 * 固有无限容量资源（ResourceCap 中类型为 null 的字段）
 * 这些资源无论 caps 传入何值，均不触发溢出截断
 */
const INHERENTLY_UNCAPPED_KEYS: ReadonlySet<string> = new Set([
  'gold', 'mandate', 'techPoint', 'recruitToken', 'skillBook',
]);

/**
 * 应用资源溢出规则
 * 有上限资源截断 + 提示升级，无上限资源全额发放
 *
 * [FIX-v9] 固有无限容量资源（gold/mandate/techPoint/recruitToken/skillBook）
 * 无论 caps 中传入何值，均视为无上限，全额发放不截断。
 */
export function applyOverflowRules(
  earned: Readonly<Resources>,
  currentResources: Readonly<Resources>,
  caps: Readonly<ResourceCap>,
  rules: readonly OverflowRule[] = OVERFLOW_RULES,
): { cappedEarned: Resources; overflowResources: Resources } {
  const cappedEarned = zeroRes();
  const overflowResources = zeroRes();

  for (const key of Object.keys(earned) as (keyof Resources)[]) {
    const cap = caps[key];
    const current = currentResources[key];
    const earn = earned[key];

    // [FIX-v9] 固有无限容量资源或 cap===null 时全额发放
    if (cap === null || INHERENTLY_UNCAPPED_KEYS.has(key)) {
      cappedEarned[key] = earn;
    } else {
      const available = Math.max(0, cap - current);
      if (earn <= available) {
        cappedEarned[key] = earn;
      } else {
        cappedEarned[key] = available;
        overflowResources[key] = earn - available;
      }
    }
  }
  return { cappedEarned, overflowResources };
}

// ─────────────────────────────────────────────
// 6. 系统效率修正
// ─────────────────────────────────────────────

/** 获取系统效率修正系数 */
export function getSystemModifier(systemId: string): number {
  const mod = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === systemId);
  return mod?.modifier ?? 1.0;
}

/** 应用系统效率修正 */
export function applySystemModifier(
  earned: Readonly<Resources>,
  systemId: string,
): Resources {
  return floorRes(mulRes(earned, getSystemModifier(systemId)));
}

// ─────────────────────────────────────────────
// 7. 完整离线收益计算（v9.0）
// ─────────────────────────────────────────────

/** 离线收益计算所需上下文 */
export interface OfflineRewardContext {
  offlineSeconds: number;
  productionRates: Readonly<ProductionRate>;
  currentResources: Readonly<Resources>;
  caps: Readonly<ResourceCap>;
  bonusSources: BonusSources;
  vipLevel: number;
  adUsedToday: number;
  systemId?: string;
}

/**
 * 计算完整离线收益（v9.0）
 *
 * 流程：基础快照→系统效率修正→资源溢出截断→生成面板
 */
export function calculateFullOfflineReward(ctx: OfflineRewardContext): OfflineRewardResultV9 {
  // Step 1: 基础快照
  const snapshot = calculateOfflineSnapshot(ctx.offlineSeconds, ctx.productionRates, ctx.bonusSources);

  // Step 2: 系统效率修正
  const systemModifiedEarned = ctx.systemId
    ? applySystemModifier(snapshot.totalEarned, ctx.systemId)
    : cloneRes(snapshot.totalEarned);

  // Step 3: 资源溢出截断
  const { cappedEarned, overflowResources } = applyOverflowRules(
    systemModifiedEarned, ctx.currentResources, ctx.caps,
  );

  // Step 4: 生成面板数据
  const panelData = generateReturnPanelData(snapshot, ctx.adUsedToday);

  return {
    snapshot,
    vipBoostedEarned: cloneRes(snapshot.totalEarned),
    systemModifiedEarned,
    cappedEarned: floorRes(cappedEarned),
    overflowResources: floorRes(overflowResources),
    tradeSummary: null,
    panelData,
  };
}
