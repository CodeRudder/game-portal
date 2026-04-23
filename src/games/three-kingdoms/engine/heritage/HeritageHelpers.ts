/**
 * 传承系统 — 辅助函数与常量
 *
 * 从 HeritageSystem 中提取的辅助函数和常量。
 *
 * @module engine/heritage/HeritageHelpers
 */

import type { HeritageState } from '../../core/heritage';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

export const EVENT_PREFIX = 'heritage';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建初始传承状态 */
export function createInitialHeritageState(): HeritageState {
  return {
    heroHeritageCount: 0,
    equipmentHeritageCount: 0,
    experienceHeritageCount: 0,
    dailyHeritageCount: 0,
    lastDailyReset: new Date().toISOString().slice(0, 10),
    heritageHistory: [],
  };
}

/** 获取今天日期字符串 */
export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
