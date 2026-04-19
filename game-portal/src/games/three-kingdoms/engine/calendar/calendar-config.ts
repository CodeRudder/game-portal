/**
 * 日历域 — 数值配置
 *
 * 规则：零逻辑，只有常量和数据结构
 *
 * 覆盖：年号表、季节参数、天气权重、时间缩放、月份天数
 *
 * @module engine/calendar/calendar-config
 */

import type { Season, WeatherType, EraEntry, SeasonBonus } from './calendar.types';

// ─────────────────────────────────────────────
// 1. 时间参数
// ─────────────────────────────────────────────

/** 现实 1 秒 = 游戏内 1 天（可由 ConfigRegistry 覆盖） */
export const DEFAULT_TIME_SCALE = 1.0;

/** 每月固定天数（古代简化历法） */
export const DAYS_PER_MONTH = 30;

/** 每年月数 */
export const MONTHS_PER_YEAR = 12;

/** 每年天数 */
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 360

// ─────────────────────────────────────────────
// 2. 季节参数
// ─────────────────────────────────────────────

/** 每季天数 */
export const DAYS_PER_SEASON = 90; // DAYS_PER_YEAR / 4

/**
 * 月份 → 季节映射
 * 1-3月=春, 4-6月=夏, 7-9月=秋, 10-12月=冬
 */
export const SEASON_MONTH_MAP: Record<number, Season> = {
  1: 'spring',  2: 'spring',  3: 'spring',
  4: 'summer',  5: 'summer',  6: 'summer',
  7: 'autumn',  8: 'autumn',  9: 'autumn',
  10: 'winter', 11: 'winter', 12: 'winter',
};

/**
 * 季节资源加成倍率（v1.0 预留，供资源系统通过 EventBus 查询）
 *
 * 设计意图：
 * - 春：万物复苏，粮草略增
 * - 夏：商贸繁荣，铜钱略增
 * - 秋：丰收季节，粮草大增、铜钱增加
 * - 冬：天寒地冻，粮草减少、兵力下降
 */
export const SEASON_BONUSES: Record<Season, SeasonBonus> = {
  spring: { grainMultiplier: 1.2, goldMultiplier: 1.0, troopsMultiplier: 1.0 },
  summer: { grainMultiplier: 1.0, goldMultiplier: 1.1, troopsMultiplier: 1.0 },
  autumn: { grainMultiplier: 1.5, goldMultiplier: 1.2, troopsMultiplier: 1.0 },
  winter: { grainMultiplier: 0.7, goldMultiplier: 0.8, troopsMultiplier: 0.9 },
} as const;

// ─────────────────────────────────────────────
// 3. 天气参数
// ─────────────────────────────────────────────

/**
 * 天气随机权重（总和 100）
 *
 * 晴天为主，雨/雪/风按概率出现。
 * 未来可扩展为按季节调整权重。
 */
export const WEATHER_WEIGHTS: Record<WeatherType, number> = {
  clear: 55,
  rain: 20,
  snow: 10,
  wind: 15,
} as const;

/** 天气变化间隔（游戏天），实际间隔在 [min, max] 范围内随机 */
export const WEATHER_CHANGE_INTERVAL_MIN = 3;  // 最少 3 天变一次
export const WEATHER_CHANGE_INTERVAL_MAX = 10;  // 最多 10 天变一次

// ─────────────────────────────────────────────
// 4. 年号表
// ─────────────────────────────────────────────

/**
 * 三国时期年号表
 *
 * 按游戏年数自动切换。游戏从建安元年（year=1）开始。
 * 年号覆盖范围基于真实历史简化，实际游戏可能跨越更多年份。
 *
 * startYear/endYear 为游戏年数（从 1 开始计数）。
 */
export const ERA_TABLE: readonly EraEntry[] = [
  { name: '建安', startYear: 1,   endYear: 24 },
  { name: '延康', startYear: 25,  endYear: 25 },
  { name: '黄初', startYear: 26,  endYear: 29 },
  { name: '太和', startYear: 30,  endYear: 33 },
  { name: '青龙', startYear: 34,  endYear: 36 },
  { name: '景初', startYear: 37,  endYear: 38 },
  { name: '正始', startYear: 39,  endYear: 42 },
  { name: '嘉平', startYear: 43,  endYear: 47 },
  { name: '正元', startYear: 48,  endYear: 49 },
  { name: '甘露', startYear: 50,  endYear: 54 },
  { name: '景元', startYear: 55,  endYear: 60 },
  { name: '咸熙', startYear: 61,  endYear: 64 },
] as const;

// ─────────────────────────────────────────────
// 5. 存档版本
// ─────────────────────────────────────────────

/** 当前日历存档数据版本号 */
export const CALENDAR_SAVE_VERSION = 1;
