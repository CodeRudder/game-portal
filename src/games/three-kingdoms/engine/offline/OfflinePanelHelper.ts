/**
 * 离线收益引擎 — 预估与面板生成
 *
 * 职责：
 *   - 离线收益预估
 *   - 格式化离线时长
 *   - 回归面板数据组装
 *   - 静默判定（≤5分钟不弹窗）
 *
 * 从 OfflineRewardEngine 中提取，保持主引擎≤500行
 *
 * @module engine/offline/OfflinePanelHelper
 */

import type { Resources, ProductionRate } from '../../shared/types';
import type {
  OfflineSnapshot, DoubleRequest, ReturnPanelData, TierDetail,
} from './offline.types';
import {
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  OFFLINE_POPUP_THRESHOLD,
  AD_DOUBLE_MULTIPLIER,
  ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
} from './offline-config';

// ─────────────────────────────────────────────
// 1. 格式化离线时长
// ─────────────────────────────────────────────

/**
 * 格式化离线时长
 *
 * @param seconds 秒数
 * @returns 格式化字符串
 */
export function formatOfflineDuration(seconds: number): string {
  if (seconds <= 0) return '刚刚';
  if (seconds < 60) return `${Math.floor(seconds)}秒`;

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
  }
  if (hours > 0) {
    const remainMinutes = minutes % 60;
    return remainMinutes > 0 ? `${hours}小时${remainMinutes}分钟` : `${hours}小时`;
  }
  return `${minutes}分钟`;
}

// ─────────────────────────────────────────────
// 2. 静默判定
// ─────────────────────────────────────────────

/** 广告翻倍每日上限 */
const AD_DAILY_LIMIT = 3;

/**
 * 判断是否应该弹出离线收益弹窗
 *
 * 离线≤5分钟：静默添加收益，不弹窗
 * 离线>5分钟：弹出离线收益弹窗
 *
 * @param offlineSeconds 离线秒数
 * @returns 是否需要弹窗
 */
export function shouldShowOfflinePopup(offlineSeconds: number): boolean {
  return offlineSeconds > OFFLINE_POPUP_THRESHOLD;
}

// ─────────────────────────────────────────────
// 3. 回归面板数据生成
// ─────────────────────────────────────────────

/**
 * 生成回归面板数据
 *
 * @param snapshot 离线快照
 * @param adUsedToday 今日已使用广告翻倍次数
 * @returns 回归面板数据
 */
export function generateReturnPanelData(
  snapshot: OfflineSnapshot,
  adUsedToday: number = 0,
): ReturnPanelData {
  const availableDoubles: DoubleRequest[] = [];

  // 广告翻倍
  if (adUsedToday < AD_DAILY_LIMIT) {
    availableDoubles.push({
      source: 'ad',
      multiplier: AD_DOUBLE_MULTIPLIER,
      description: `观看广告翻倍（今日剩余${AD_DAILY_LIMIT - adUsedToday}次）`,
    });
  }

  // 元宝翻倍（始终可用）
  availableDoubles.push({
    source: 'item',
    multiplier: ITEM_DOUBLE_MULTIPLIER,
    description: '使用元宝翻倍',
  });

  // 回归奖励（离线>24h）
  if (snapshot.offlineSeconds >= RETURN_BONUS_MIN_HOURS * 3600) {
    availableDoubles.push({
      source: 'return_bonus',
      multiplier: RETURN_BONUS_MULTIPLIER,
      description: '回归奖励翻倍',
    });
  }

  return {
    offlineSeconds: snapshot.offlineSeconds,
    formattedTime: formatOfflineDuration(snapshot.offlineSeconds),
    efficiencyPercent: Math.round(snapshot.overallEfficiency * 100),
    tierDetails: snapshot.tierDetails,
    totalEarned: { ...snapshot.totalEarned },
    isCapped: snapshot.isCapped,
    availableDoubles,
    boostItems: [],
  };
}

// ─────────────────────────────────────────────
// 4. 离线预估
// ─────────────────────────────────────────────

/**
 * 预估离线收益
 *
 * 基于当前产出速率预估指定时长的收益
 *
 * @param hours 预估时长（小时）
 * @param productionRates 当前产出速率
 * @param bonusSources 加成来源
 * @param _calculateSnapshot 内部未使用（向后兼容参数位）
 * @returns 预估收益快照
 */
export function estimateOfflineReward(
  hours: number,
  productionRates: Readonly<ProductionRate>,
  bonusSources: { tech?: number; vip?: number; reputation?: number } = {},
  _calculateSnapshot?: (seconds: number, rates: Readonly<ProductionRate>, bonus: { tech?: number; vip?: number; reputation?: number }) => OfflineSnapshot,
): OfflineSnapshot {
  const offlineSeconds = Math.min(hours * 3600, MAX_OFFLINE_SECONDS);
  const isCapped = hours * 3600 > MAX_OFFLINE_SECONDS;

  // 计算各档位衰减明细
  const tierDetails: TierDetail[] = [];
  let totalEarned: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
  let totalWeighted = 0;

  for (const tier of DECAY_TIERS) {
    const tierStartSeconds = tier.startHours * 3600;
    const tierEndSeconds = tier.endHours * 3600;
    if (offlineSeconds <= tierStartSeconds) break;

    const secondsInTier = Math.min(offlineSeconds, tierEndSeconds) - tierStartSeconds;
    if (secondsInTier <= 0) continue;

    const earned: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    for (const key of Object.keys(productionRates) as (keyof ProductionRate)[]) {
      earned[key] = productionRates[key] * secondsInTier * tier.efficiency;
    }
    tierDetails.push({ tierId: tier.id, seconds: secondsInTier, efficiency: tier.efficiency, earned });

    totalEarned.grain += earned.grain;
    totalEarned.gold += earned.gold;
    totalEarned.troops += earned.troops;
    totalEarned.mandate += earned.mandate;
    totalEarned.techPoint += earned.techPoint;
    totalWeighted += secondsInTier * tier.efficiency;
  }

  // 加成系数
  const totalBonus = (bonusSources.tech ?? 0) + (bonusSources.vip ?? 0) + (bonusSources.reputation ?? 0);
  const bonusCoefficient = 1 + Math.min(totalBonus, 1.0);

  totalEarned = {
    grain: Math.floor(totalEarned.grain * bonusCoefficient),
    gold: Math.floor(totalEarned.gold * bonusCoefficient),
    troops: Math.floor(totalEarned.troops * bonusCoefficient),
    mandate: Math.floor(totalEarned.mandate * bonusCoefficient),
    techPoint: Math.floor(totalEarned.techPoint * bonusCoefficient),
    recruitToken: Math.floor(totalEarned.recruitToken * bonusCoefficient),
  };

  const overallEfficiency = offlineSeconds > 0 ? totalWeighted / offlineSeconds : 1.0;

  return {
    timestamp: Date.now(),
    offlineSeconds,
    tierDetails,
    totalEarned,
    overallEfficiency,
    isCapped,
  };
}
