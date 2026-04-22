/**
 * 转生系统 — v16.0 深化功能辅助模块
 *
 * 从 RebirthSystem.ts 拆分出的纯函数：
 *   - 转生初始赠送
 *   - 瞬间建筑配置
 *   - 建筑升级时间计算
 *   - 一键重建计划
 *   - v16.0 解锁内容
 *   - 声望增长曲线
 *   - 转生时机对比
 *   - 收益模拟器 v16
 *
 * @module engine/prestige/RebirthSystemV16
 */

import type {
  RebirthInitialGift,
  RebirthInstantBuild,
  RebirthUnlockContentV16,
  SimulationParams,
  SimulationResult,
  SimulationResultV16,
  RebirthSimulationComparison,
} from '../../core/prestige';
import {
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
  REBIRTH_UNLOCK_CONTENTS_V16,
  SIMULATION_DIMINISHING_RETURNS_HOUR,
  REBIRTH_ACCELERATION,
} from '../../core/prestige';

// ─────────────────────────────────────────────
// 转生初始赠送
// ─────────────────────────────────────────────

/** 获取转生初始资源赠送 */
export function getInitialGift(): RebirthInitialGift {
  return { ...REBIRTH_INITIAL_GIFT };
}

// ─────────────────────────────────────────────
// 瞬间建筑配置
// ─────────────────────────────────────────────

/** 获取瞬间建筑升级配置 */
export function getInstantBuildConfig(): RebirthInstantBuild {
  return { ...REBIRTH_INSTANT_BUILD };
}

/**
 * 计算建筑升级时间
 * @param baseTimeSeconds - 基础升级时间（秒）
 * @param buildingLevel - 建筑等级
 * @param multiplier - 转生倍率
 * @param accelerationDaysLeft - 加速剩余天数
 */
export function calculateBuildTime(
  baseTimeSeconds: number,
  buildingLevel: number,
  multiplier: number,
  accelerationDaysLeft: number,
): number {
  // 低级建筑瞬间升级
  if (buildingLevel <= REBIRTH_INSTANT_BUILD.maxInstantLevel) {
    return Math.max(1, Math.floor(baseTimeSeconds / REBIRTH_INSTANT_BUILD.speedDivisor));
  }
  // 加速期内享受加速
  if (accelerationDaysLeft > 0) {
    return Math.max(1, Math.floor(baseTimeSeconds / multiplier / REBIRTH_ACCELERATION.buildSpeedMultiplier));
  }
  return Math.max(1, Math.floor(baseTimeSeconds / multiplier));
}

// ─────────────────────────────────────────────
// 一键重建计划
// ─────────────────────────────────────────────

/** 获取一键重建的建筑优先级列表 */
export function getAutoRebuildPlan(rebirthCount: number): string[] | null {
  if (rebirthCount < 1) return null;
  // 按优先级返回需要重建的建筑ID列表
  return [
    'main_hall',
    'barracks',
    'farm',
    'lumber_mill',
    'warehouse',
    'academy',
    'market',
  ];
}

// ─────────────────────────────────────────────
// v16.0 解锁内容
// ─────────────────────────────────────────────

/** 获取 v16.0 解锁内容列表（含当前解锁状态） */
export function getUnlockContentsV16(
  rebirthCount: number,
): Array<RebirthUnlockContentV16 & { unlocked: boolean }> {
  return REBIRTH_UNLOCK_CONTENTS_V16.map(item => ({
    ...item,
    unlocked: rebirthCount >= item.requiredRebirthCount,
  }));
}

/** 检查指定功能是否已解锁 */
export function isFeatureUnlocked(unlockId: string, rebirthCount: number): boolean {
  const item = REBIRTH_UNLOCK_CONTENTS_V16.find(c => c.unlockId === unlockId);
  if (!item) return false;
  return rebirthCount >= item.requiredRebirthCount;
}

// ─────────────────────────────────────────────
// 声望增长曲线
// ─────────────────────────────────────────────

/** 生成声望增长预测曲线 */
export function generatePrestigeGrowthCurve(
  params: SimulationParams,
): Array<{ day: number; prestige: number }> {
  const curve: Array<{ day: number; prestige: number }> = [];
  let accumulated = 0;
  const dailyPrestige = 20 * params.dailyOnlineHours;

  for (let day = 1; day <= params.simulateDays; day++) {
    const accelMultiplier = day <= REBIRTH_ACCELERATION.durationDays
      ? REBIRTH_ACCELERATION.resourceMultiplier
      : 1.0;
    accumulated += dailyPrestige * accelMultiplier;
    curve.push({ day, prestige: Math.floor(accumulated) });
  }

  return curve;
}

// ─────────────────────────────────────────────
// 转生时机对比
// ─────────────────────────────────────────────

/** 对比立即转生与等待后转生的收益 */
export function compareRebirthTiming(
  currentRebirthCount: number,
  waitHoursOptions: number[] = [24, 48, 72],
): RebirthSimulationComparison {
  const immediateMultiplier = 1 + (currentRebirthCount + 1) * 0.1;
  const bestWait = waitHoursOptions.reduce((best, hours) => {
    const waitMultiplier = 1 + (currentRebirthCount + 1) * 0.1 * (1 + hours / 240);
    return waitMultiplier > best.mul ? { hours, mul: waitMultiplier } : best;
  }, { hours: 0, mul: immediateMultiplier });

  const diminishingHour = SIMULATION_DIMINISHING_RETURNS_HOUR;
  const diff = bestWait.mul - immediateMultiplier;

  let recommendedAction: 'rebirth_now' | 'wait' | 'no_difference';
  let confidence: 'high' | 'medium' | 'low';

  if (diff < 0.01) {
    recommendedAction = 'no_difference';
    confidence = 'high';
  } else if (bestWait.hours > diminishingHour) {
    recommendedAction = 'rebirth_now';
    confidence = 'medium';
  } else {
    recommendedAction = 'wait';
    confidence = diff > 0.1 ? 'high' : 'medium';
  }

  return {
    immediateMultiplier,
    waitMultiplier: bestWait.mul,
    waitHours: bestWait.hours,
    diminishingReturnsHour: diminishingHour,
    recommendedAction,
    confidence,
  };
}

// ─────────────────────────────────────────────
// 收益模拟器 v16
// ─────────────────────────────────────────────

/** v16.0 收益模拟（含增长曲线和转生时机对比） */
export function simulateEarningsV16(
  params: SimulationParams,
  baseResult: SimulationResult,
): SimulationResultV16 {
  const prestigeGrowthCurve = generatePrestigeGrowthCurve(params);
  const comparison = compareRebirthTiming(params.currentRebirthCount);

  const recommendation = comparison.recommendedAction === 'rebirth_now'
    ? '建议立即转生，等待收益递减'
    : comparison.recommendedAction === 'wait'
      ? `建议等待 ${comparison.waitHours} 小时后转生，可获得更高倍率`
      : '转生时机对收益影响不大，可自行决定';

  return {
    ...baseResult,
    prestigeGrowthCurve,
    comparison,
    recommendation,
  };
}
