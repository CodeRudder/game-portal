/**
 * 成就系统 — 辅助函数
 *
 * 从 AchievementSystem 中提取的初始状态工厂函数。
 *
 * @module engine/achievement/AchievementHelpers
 */

import type {
  AchievementDimension,
  AchievementDef,
  AchievementInstance,
  AchievementState,
  DimensionStats,
} from '../../core/achievement';
import {
  ALL_ACHIEVEMENTS,
  REBIRTH_ACHIEVEMENT_CHAINS,
} from '../../core/achievement';

/** 创建初始成就实例 */
export function createAchievementInstance(def: AchievementDef): AchievementInstance {
  const progress: Record<string, number> = {};
  for (const cond of def.conditions) {
    progress[cond.type] = 0;
  }
  return {
    defId: def.id,
    status: def.prerequisiteId ? 'locked' : 'in_progress',
    progress,
    completedAt: null,
    claimedAt: null,
  };
}

/** 创建初始成就状态 */
export function createInitialState(): AchievementState {
  const achievements: Record<string, AchievementInstance> = {};
  const dimensionStats: Record<string, DimensionStats> = {
    battle: { dimension: 'battle', completedCount: 0, totalCount: 0, totalPoints: 0 },
    building: { dimension: 'building', completedCount: 0, totalCount: 0, totalPoints: 0 },
    collection: { dimension: 'collection', completedCount: 0, totalCount: 0, totalPoints: 0 },
    social: { dimension: 'social', completedCount: 0, totalCount: 0, totalPoints: 0 },
    rebirth: { dimension: 'rebirth', completedCount: 0, totalCount: 0, totalPoints: 0 },
  };

  for (const def of ALL_ACHIEVEMENTS) {
    achievements[def.id] = createAchievementInstance(def);
    const dim = dimensionStats[def.dimension];
    if (dim) dim.totalCount++;
  }

  return {
    achievements,
    totalPoints: 0,
    dimensionStats: dimensionStats as Record<AchievementDimension, DimensionStats>,
    completedChains: [],
    chainProgress: {},
  };
}

/** 初始化成就链进度 */
export function initChainProgress(): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const chain of REBIRTH_ACHIEVEMENT_CHAINS) {
    progress[chain.chainId] = 0;
  }
  return progress;
}
