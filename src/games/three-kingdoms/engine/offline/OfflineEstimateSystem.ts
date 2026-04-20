/**
 * 离线收益域 — 预估系统
 *
 * 职责：离线收益预估计算，展示给玩家"如果现在下线，
 * X小时后可获得多少收益"。
 *
 * 特点：
 * - 纯计算，无状态
 * - 支持各系统差异化修正系数
 * - 可生成预估时间线（1h/4h/8h/24h/48h/72h）
 *
 * @module engine/offline/OfflineEstimateSystem
 */

import type { Resources } from '../../shared/types';
import type { TierDetail, SystemEfficiencyModifier } from './offline.types';
import { DECAY_TIERS, MAX_OFFLINE_HOURS, SYSTEM_EFFICIENCY_MODIFIERS } from './offline-config';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 预估时间点 */
export interface EstimatePoint {
  /** 预估小时数 */
  hours: number;
  /** 预估收益 */
  earned: Resources;
  /** 该时刻的综合效率 */
  efficiency: number;
}

/** 预估结果 */
export interface EstimateResult {
  /** 预估时间线 */
  timeline: EstimatePoint[];
  /** 各系统修正后的预估 */
  systemEstimates: Record<string, EstimatePoint[]>;
  /** 推荐下线时长（效率最优） */
  recommendedHours: number;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建零资源 */
function zeroResources(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0 };
}

/** 资源乘以标量 */
function scaleResources(r: Readonly<Resources>, factor: number): Resources {
  return {
    grain: r.grain * factor,
    gold: r.gold * factor,
    troops: r.troops * factor,
    mandate: r.mandate * factor,
  };
}

/** 计算指定小时数的收益（按6档衰减） */
function calculateEarnedForHours(
  hours: number,
  productionRates: Readonly<Resources>,
): { earned: Resources; efficiency: number } {
  const totalEarned = zeroResources();
  let totalEffectiveSeconds = 0;
  const totalSeconds = hours * 3600;

  for (const tier of DECAY_TIERS) {
    if (hours <= tier.startHours) break;

    const tierStartSec = tier.startHours * 3600;
    const tierEndSec = Math.min(tier.endHours, hours) * 3600;
    const tierSeconds = tierEndSec - tierStartSec;
    if (tierSeconds <= 0) continue;

    for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
      totalEarned[key] += productionRates[key] * tierSeconds * tier.efficiency;
    }
    totalEffectiveSeconds += tierSeconds * tier.efficiency;
  }

  const efficiency = totalSeconds > 0 ? totalEffectiveSeconds / totalSeconds : 0;
  return { earned: totalEarned, efficiency };
}

// ─────────────────────────────────────────────
// OfflineEstimateSystem
// ─────────────────────────────────────────────

/**
 * 离线收益预估系统
 *
 * 提供离线收益预估功能，帮助玩家决策下线时机。
 * 支持各系统差异化修正系数，生成多时间点的预估数据。
 */
export class OfflineEstimateSystem {

  /** 预估时间点（小时） */
  private readonly estimateHours = [1, 2, 4, 8, 24, 48, 72];

  /**
   * 生成预估时间线
   *
   * 计算在1h/2h/4h/8h/24h/48h/72h各时间点的预估收益。
   *
   * @param productionRates 当前产出速率
   * @returns 预估结果
   */
  estimate(productionRates: Readonly<Resources>): EstimateResult {
    const timeline: EstimatePoint[] = [];

    for (const hours of this.estimateHours) {
      const { earned, efficiency } = calculateEarnedForHours(hours, productionRates);
      timeline.push({ hours, earned, efficiency });
    }

    // 各系统修正预估
    const systemEstimates: Record<string, EstimatePoint[]> = {};
    for (const modifier of SYSTEM_EFFICIENCY_MODIFIERS) {
      systemEstimates[modifier.systemId] = timeline.map(point => ({
        hours: point.hours,
        earned: scaleResources(point.earned, modifier.modifier),
        efficiency: point.efficiency * modifier.modifier,
      }));
    }

    // 推荐下线时长：效率>50%的最长时间
    let recommendedHours = 8; // 默认推荐8小时
    for (const point of timeline) {
      if (point.efficiency >= 0.5) {
        recommendedHours = point.hours;
      }
    }

    return { timeline, systemEstimates, recommendedHours };
  }

  /**
   * 预估指定小时数的收益
   *
   * @param hours 小时数
   * @param productionRates 产出速率
   * @param systemId 系统标识（可选，用于修正系数）
   * @returns 预估收益
   */
  estimateForHours(
    hours: number,
    productionRates: Readonly<Resources>,
    systemId?: string,
  ): EstimatePoint {
    const clampedHours = Math.min(hours, MAX_OFFLINE_HOURS);
    const { earned, efficiency } = calculateEarnedForHours(clampedHours, productionRates);

    if (systemId) {
      const modifier = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === systemId);
      const factor = modifier?.modifier ?? 1.0;
      return {
        hours: clampedHours,
        earned: scaleResources(earned, factor),
        efficiency: efficiency * factor,
      };
    }

    return { hours: clampedHours, earned, efficiency };
  }

  /**
   * 获取效率衰减曲线
   *
   * 返回每小时效率变化的数据点，用于绘制效率曲线图。
   *
   * @param maxHours 最大小时数（默认72）
   * @returns 效率曲线数据点
   */
  getEfficiencyCurve(maxHours: number = MAX_OFFLINE_HOURS): Array<{ hours: number; efficiency: number }> {
    const points: Array<{ hours: number; efficiency: number }> = [];

    for (let h = 1; h <= maxHours; h++) {
      const { efficiency } = calculateEarnedForHours(h, { grain: 1, gold: 0, troops: 0, mandate: 0 });
      points.push({ hours: h, efficiency });
    }

    return points;
  }
}
