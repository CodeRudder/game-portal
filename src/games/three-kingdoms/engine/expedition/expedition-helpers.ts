/**
 * Expedition - types and helpers
 *
 * Extracted from ExpeditionSystem.ts.
 */

import type { ExpeditionState } from '../../core/expedition/expedition.types';
import type { MilestoneType } from '../../core/expedition/expedition-battle.types';
import { createDefaultRoutes, createDefaultRegions } from './expedition-config';
// 重导出辅助类型，保持向后兼容

export type { HeroBrief, TeamValidationResult } from './ExpeditionTeamHelper';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

export const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 路线解锁校验结果 */
export interface UnlockCheckResult {
  canUnlock: boolean;
  reasons: string[];
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 创建默认远征状态 */
export function createDefaultExpeditionState(basePower: number = 1000): ExpeditionState {
  return {
    routes: createDefaultRoutes(basePower),
    regions: createDefaultRegions(),
    teams: {},
    unlockedSlots: 1,
    clearedRouteIds: new Set<string>(),
    routeStars: {},
    sweepCounts: {},
    achievedMilestones: new Set<MilestoneType>(),
    autoConfig: {
      repeatCount: 0,
      failureAction: 'pause',
      bagFullAction: 'pause',
      lowTroopAction: 'pause',
    },
    consecutiveFailures: 0,
    isAutoExpeditioning: false,
    lastDispatchConfig: null,
  };
}

// ─────────────────────────────────────────────
// ExpeditionSystem 类
// ─────────────────────────────────────────────

