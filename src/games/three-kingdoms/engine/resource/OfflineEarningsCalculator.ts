/**
 * 资源域 — 离线收益计算器
 *
 * ⚠️ DEPRECATED: 本模块是 resource 域的简化版离线收益计算器。
 * 完整版离线收益引擎位于 offline 域的 OfflineRewardEngine.ts。
 * 新功能请直接使用 OfflineRewardEngine，本文件仅保留向后兼容。
 *
 * 桥接关系：
 *   resource 域 (ResourceSystem) → OfflineEarningsCalculator（本文件，简化版）
 *   offline  域 (OfflineRewardSystem) → OfflineRewardEngine（完整版，含6档衰减/VIP/道具/贸易）
 *
 * 职责：离线收益相关的纯计算逻辑（无状态工具类）
 * 规则：不持有任何状态，所有数据通过参数传入
 *
 * 从 resource-calculator.ts 中提取的离线收益专用模块，
 * 降低 ResourceSystem.ts 的代码量。
 */

import type {
  Resources,
  ProductionRate,
  Bonuses,
  OfflineEarnings,
  OfflineTierBreakdown,
} from './resource.types';
import { RESOURCE_TYPES } from './resource.types';
import { zeroResources, calculateBonusMultiplier } from './resource-calculator';
import { OFFLINE_TIERS, OFFLINE_MAX_SECONDS } from './resource-config';

// ─────────────────────────────────────────────
// 1. 离线收益计算
// ─────────────────────────────────────────────

/**
 * 计算离线收益
 *
 * 根据离线时长、产出速率和加成，按衰减时段计算各资源的离线产出。
 * 离线时长超过 OFFLINE_MAX_SECONDS 时会被截断并标记 isCapped。
 *
 * @param offlineSeconds 离线秒数
 * @param productionRates 当前产出速率
 * @param bonuses 加成集合（可选）
 * @returns 离线收益详情
 */
export function calculateOfflineEarnings(
  offlineSeconds: number,
  productionRates: Readonly<ProductionRate>,
  bonuses?: Bonuses,
): OfflineEarnings {
  // FIX-710: NaN seconds 防护
  if (!Number.isFinite(offlineSeconds) || offlineSeconds <= 0) {
    return {
      offlineSeconds: offlineSeconds ?? 0,
      earned: zeroResources(),
      isCapped: false,
      tierBreakdown: [],
    };
  }

  const capped = offlineSeconds > OFFLINE_MAX_SECONDS;
  const effectiveSeconds = Math.min(offlineSeconds, OFFLINE_MAX_SECONDS);
  const multiplier = calculateBonusMultiplier(bonuses);

  const earned: Resources = zeroResources();
  const tierBreakdown: OfflineTierBreakdown[] = [];

  for (const tier of OFFLINE_TIERS) {
    if (effectiveSeconds <= tier.startSeconds) break;

    const tierSeconds = Math.min(effectiveSeconds, tier.endSeconds) - tier.startSeconds;
    if (tierSeconds <= 0) continue;

    const tierEarned = zeroResources();
    for (const type of RESOURCE_TYPES) {
      const gain = productionRates[type] * tierSeconds * tier.efficiency * multiplier;
      tierEarned[type] = gain;
      earned[type] += gain;
    }

    tierBreakdown.push({ tier, seconds: tierSeconds, earned: tierEarned });
  }

  return {
    offlineSeconds,
    earned,
    isCapped: capped,
    tierBreakdown,
  };
}

// ─────────────────────────────────────────────
// 2. 离线收益应用（纯计算，不修改状态）
// ─────────────────────────────────────────────

/**
 * 将离线收益叠加到现有资源上（纯函数，返回新对象）
 *
 * @param currentResources 当前资源数量
 * @param earnings 离线收益
 * @param caps 资源上限（null 表示无上限）
 * @returns 叠加后的资源数量（受上限约束）
 */
export function applyEarningsToResources(
  currentResources: Readonly<Resources>,
  earnings: Readonly<Resources>,
  caps: Readonly<Record<keyof Resources, number | null>>,
): Resources {
  const result: Resources = { ...currentResources };

  for (const type of RESOURCE_TYPES) {
    const cap = caps[type];
    const before = result[type];
    const after = cap !== null ? Math.min(before + earnings[type], cap) : before + earnings[type];
    result[type] = after;
  }

  return result;
}

// ─────────────────────────────────────────────
// 3. 工具方法
// ─────────────────────────────────────────────

/**
 * 格式化离线时间为可读字符串
 *
 * 将秒数转换为人类友好的时间描述，如 "2小时30分钟"。
 * 自动选择合适的单位组合。
 *
 * @param seconds - 离线秒数
 * @returns 格式化后的时间字符串
 *
 * @example
 * ```ts
 * formatOfflineTime(90);    // "1分钟"
 * formatOfflineTime(3661);  // "1小时1分钟"
 * formatOfflineTime(90000); // "1天1小时"
 * formatOfflineTime(0);     // "刚刚"
 * ```
 */
export function formatOfflineTime(seconds: number): string {
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

/**
 * 获取指定离线时长的综合效率百分比
 *
 * 用于 UI 显示"当前效率"提示。
 *
 * @param offlineSeconds - 离线秒数
 * @returns 效率百分比（0~100）
 */
export function getOfflineEfficiencyPercent(offlineSeconds: number): number {
  if (offlineSeconds <= 0) return 100;

  const clamped = Math.min(offlineSeconds, OFFLINE_MAX_SECONDS);
  let totalEffective = 0;

  for (const tier of OFFLINE_TIERS) {
    if (clamped <= tier.startSeconds) break;
    const tierSeconds = Math.min(clamped, tier.endSeconds) - tier.startSeconds;
    if (tierSeconds <= 0) continue;
    totalEffective += tierSeconds * tier.efficiency;
  }

  return Math.round((totalEffective / clamped) * 100);
}
