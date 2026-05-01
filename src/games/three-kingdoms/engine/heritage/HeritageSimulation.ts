/**
 * 引擎层 — 传承系统：收益模拟器 + 转生加速 + 次数解锁
 *
 * 从 HeritageSystem.ts 拆分出的辅助模块：
 *   #18 转生后加速机制 — 初始资源赠送 + 低级建筑瞬间 + 一键重建
 *   #19 转生次数解锁内容 — 天命/专属科技/神话武将/跨服
 *   #20 收益模拟器 — 预测声望增长 + 推荐转生时机 + 倍率对比
 *
 * @module engine/heritage/HeritageSimulation
 */

import type { ISystemDeps } from '../../core/types';
import type {
  HeritageDataSummary,
  RebirthAccelerationState,
  RebirthRebuildConfig,
  HeritageSimulationParams,
  HeritageSimulationResult,
} from '../../core/heritage';
import {
  REBIRTH_INITIAL_GIFT,
  DEFAULT_REBUILD_CONFIG,
  INSTANT_UPGRADE_COUNT_PER_REBIRTH,
  HERITAGE_REBIRTH_UNLOCKS,
  SIMULATION_BASE_DAILY,
  SIMULATION_DIMINISHING_THRESHOLD,
} from '../../core/heritage';
import { calcRebirthMultiplier } from '../prestige/RebirthSystem';

// ─────────────────────────────────────────────
// 类型：外部回调接口
// ─────────────────────────────────────────────

/** 转生加速所需的外部回调 */
export interface RebirthAccelCallbacks {
  addResources?: (resources: Record<string, number>) => void;
  upgradeBuilding?: (buildingId: string) => boolean;
  getRebirthCount?: () => number;
}

// ─────────────────────────────────────────────
// 转生后加速 (#18)
// ─────────────────────────────────────────────

/**
 * 领取转生后初始资源赠送
 */
export function claimInitialGift(
  accelState: RebirthAccelerationState,
  callbacks: RebirthAccelCallbacks,
  deps: ISystemDeps,
): { success: boolean; resources: Record<string, number>; reason?: string; newState: RebirthAccelerationState } {
  if (accelState.initialGiftClaimed) {
    return { success: false, resources: {}, reason: '已领取过初始资源', newState: accelState };
  }

  const resources = {
    grain: REBIRTH_INITIAL_GIFT.grain,
    copper: REBIRTH_INITIAL_GIFT.copper,
    enhanceStone: REBIRTH_INITIAL_GIFT.enhanceStone,
  };

  callbacks.addResources?.(resources);
  const newState = { ...accelState, initialGiftClaimed: true };

  deps.eventBus.emit('heritage:initialGiftClaimed', resources);

  return { success: true, resources, newState };
}

/**
 * 一键重建 (#18)
 * 按优先级自动升级建筑
 */
export function executeRebuild(
  accelState: RebirthAccelerationState,
  callbacks: RebirthAccelCallbacks,
  deps: ISystemDeps,
  config?: Partial<RebirthRebuildConfig>,
): { success: boolean; upgradedBuildings: string[]; reason?: string; newState: RebirthAccelerationState } {
  if (accelState.rebuildCompleted) {
    return { success: false, upgradedBuildings: [], reason: '已执行过一键重建', newState: accelState };
  }

  const cfg = { ...DEFAULT_REBUILD_CONFIG, ...config };
  const upgradedBuildings: string[] = [];

  for (const buildingId of cfg.buildingPriority) {
    const success = callbacks.upgradeBuilding?.(buildingId) ?? false;
    if (success) {
      upgradedBuildings.push(buildingId);
    }
  }

  const newState = { ...accelState, rebuildCompleted: true };

  deps.eventBus.emit('heritage:rebuildCompleted', { upgradedBuildings });

  return { success: true, upgradedBuildings, newState };
}

/**
 * 瞬间升级低级建筑 (#18)
 */
export function instantUpgrade(
  buildingId: string,
  accelState: RebirthAccelerationState,
  callbacks: RebirthAccelCallbacks,
): { success: boolean; reason?: string; newState: RebirthAccelerationState } {
  const rebirthCount = callbacks.getRebirthCount?.() ?? 0;
  // FIX-H06: 回调未注入时给出明确错误
  if (!callbacks.getRebirthCount) {
    return { success: false, reason: '转生数据不可用，无法执行瞬间升级', newState: accelState };
  }
  const maxInstantUpgrades = rebirthCount * INSTANT_UPGRADE_COUNT_PER_REBIRTH;

  if (accelState.instantUpgradeCount >= maxInstantUpgrades) {
    return { success: false, reason: '瞬间升级次数已用完', newState: accelState };
  }

  if (accelState.instantUpgradedBuildings.includes(buildingId)) {
    return { success: false, reason: '该建筑已瞬间升级过', newState: accelState };
  }

  const success = callbacks.upgradeBuilding?.(buildingId) ?? false;
  if (!success) {
    return { success: false, reason: '建筑升级失败', newState: accelState };
  }

  const newState = {
    ...accelState,
    instantUpgradeCount: accelState.instantUpgradeCount + 1,
    instantUpgradedBuildings: [...accelState.instantUpgradedBuildings, buildingId],
  };

  return { success: true, newState };
}

/**
 * 初始化转生后加速状态
 */
export function createInitialAccelState(): RebirthAccelerationState {
  return {
    initialGiftClaimed: false,
    rebuildCompleted: false,
    instantUpgradeCount: 0,
    instantUpgradedBuildings: [],
  };
}

// ─────────────────────────────────────────────
// 转生次数解锁 (#19)
// ─────────────────────────────────────────────

/**
 * 获取转生次数解锁内容
 */
export function getRebirthUnlocks(currentCount: number): Array<{
  rebirthCount: number;
  description: string;
  type: string;
  unlockId: string;
  unlocked: boolean;
}> {
  return HERITAGE_REBIRTH_UNLOCKS.map(u => ({
    ...u,
    unlocked: currentCount >= u.rebirthCount,
  }));
}

/**
 * 检查指定内容是否已解锁
 */
export function isHeritageUnlocked(unlockId: string, currentCount: number): boolean {
  return HERITAGE_REBIRTH_UNLOCKS.some(
    u => u.unlockId === unlockId && currentCount >= u.rebirthCount,
  );
}

// ─────────────────────────────────────────────
// 收益模拟器 (#20)
// ─────────────────────────────────────────────

/**
 * 模拟转生收益
 * 对比立即转生和等待后转生的收益差异
 */
export function simulateEarnings(params: HeritageSimulationParams): HeritageSimulationResult {
  // FIX-H05: 参数NaN防护
  const dailyOnlineHours = Number.isFinite(params.dailyOnlineHours) && params.dailyOnlineHours > 0
    ? params.dailyOnlineHours : 4;
  const waitHours = Number.isFinite(params.waitHours) && params.waitHours >= 0
    ? params.waitHours : 0;
  const currentRebirthCount = Number.isFinite(params.currentRebirthCount) && params.currentRebirthCount >= 0
    ? params.currentRebirthCount : 0;

  const rawMultiplier = calcRebirthMultiplier(currentRebirthCount + 1);
  // FIX-H05: multiplier结果验证（防止Infinity/NaN跨系统传播）
  const immediateMultiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0
    ? rawMultiplier : 1.0;
  const waitMultiplier = immediateMultiplier; // 倍率不受等待影响

  // 立即转生：从现在开始享受倍率
  const immediateDays = 30;
  const immediateEarnings = calcEarnings(
    immediateMultiplier, immediateDays, dailyOnlineHours,
  );

  // 等待后转生：等待期间无倍率，之后享受倍率
  const waitDays = waitHours / 24;
  const remainingDays = Math.max(0, immediateDays - waitDays);
  const waitEarnings = calcEarnings(
    waitMultiplier, remainingDays, dailyOnlineHours,
  );

  // 计算边际收益递减拐点
  const diminishingReturnHour = SIMULATION_DIMINISHING_THRESHOLD;
  const recommendedWaitHours = findOptimalWaitTime(
    { ...params, dailyOnlineHours, waitHours, currentRebirthCount }, immediateMultiplier,
  );

  // 置信度：基于在线时长，越长越准
  const confidence = Math.min(1, dailyOnlineHours / 8);

  return {
    immediateMultiplier,
    waitMultiplier,
    immediateEarnings,
    waitEarnings,
    recommendedWaitHours,
    diminishingReturnHour,
    confidence,
  };
}

// ─────────────────────────────────────────────
// 内部辅助
// ─────────────────────────────────────────────

/** 计算指定天数收益 */
function calcEarnings(
  multiplier: number,
  days: number,
  dailyHours: number,
): Record<string, number> {
  return {
    gold: Math.floor(SIMULATION_BASE_DAILY.gold * multiplier * days * (dailyHours / 4)),
    grain: Math.floor(SIMULATION_BASE_DAILY.grain * multiplier * days * (dailyHours / 4)),
    prestige: Math.floor(SIMULATION_BASE_DAILY.prestige * days * (dailyHours / 4)),
  };
}

/** 寻找最优等待时间 */
function findOptimalWaitTime(
  params: HeritageSimulationParams,
  multiplier: number,
): number {
  const basePrestigePerHour = SIMULATION_BASE_DAILY.prestige / 24;
  const marginalGain = basePrestigePerHour * multiplier;

  if (marginalGain < basePrestigePerHour * 1.5) {
    return 0;
  }

  return SIMULATION_DIMINISHING_THRESHOLD;
}
