/**
 * 活动系统 — 常量与配置
 *
 * 职责：并行上限配置、离线效率配置、存档版本号、赛季委托对象
 * 从 ActivitySystem.ts 拆分以控制文件行数
 *
 * @module engine/activity/ActivitySystemConfig
 */

import {
  DEFAULT_SEASON_THEMES,
  getCurrentSeasonTheme as _getTheme,
  createSettlementAnimation as _createAnim,
  updateSeasonRecord as _updateRecord,
  generateSeasonRecordRanking as _genRanking,
  getSeasonThemes as _getThemes,
} from './SeasonHelper';
export { DEFAULT_SEASON_THEMES };

import type {
  ActivityConcurrencyConfig,
  OfflineEfficiencyConfig,
  SeasonTheme,
  SeasonSettlementAnimation,
  SeasonRecord,
  SeasonRecordEntry,
} from '../../core/activity/activity.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认并行上限配置 */
export const DEFAULT_CONCURRENCY_CONFIG: ActivityConcurrencyConfig = {
  maxSeason: 1,
  maxLimitedTime: 2,
  maxDaily: 1,
  maxFestival: 1,
  maxAlliance: 1,
  maxTotal: 5,
};

/** 默认离线效率配置 */
export const DEFAULT_OFFLINE_EFFICIENCY: OfflineEfficiencyConfig = {
  season: 0.5,
  limitedTime: 0.3,
  daily: 1.0,
  festival: 0.5,
  alliance: 0.5,
};

/** 活动存档版本 */
export const ACTIVITY_SAVE_VERSION = 1;

/** 每秒基础积分（离线计算用） */
export const BASE_POINTS_PER_SECOND = 0.1;

// ─────────────────────────────────────────────
// 赛季委托对象
// ─────────────────────────────────────────────

/**
 * seasonHelper 委托对象
 *
 * 将 SeasonHelper 的函数封装为统一对象，供 ActivitySystem 调用
 */
export const seasonHelper = {
  getCurrentSeasonTheme: _getTheme,
  createSettlementAnimation: _createAnim,
  updateSeasonRecord: _updateRecord,
  generateSeasonRecordRanking: _genRanking,
  getSeasonThemes: _getThemes,
};
