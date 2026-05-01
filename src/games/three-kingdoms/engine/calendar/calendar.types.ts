/**
 * 日历域 — 类型定义
 *
 * 规则：只有 interface/type/const 枚举，零逻辑
 *
 * 覆盖：季节、天气、年号、游戏日期、日历状态快照、序列化格式
 *
 * @module engine/calendar/calendar.types
 */

// ─────────────────────────────────────────────
// 1. 季节
// ─────────────────────────────────────────────

/** 四季枚举 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 季节中文标签 */
export const SEASON_LABELS: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
} as const;

/** 季节列表（按顺序） */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'] as const;

// ─────────────────────────────────────────────
// 2. 天气
// ─────────────────────────────────────────────

/** 天气类型（v1.0 简化版） */
export type WeatherType = 'clear' | 'rain' | 'snow' | 'wind';

/** 天气中文标签 */
export const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: '晴',
  rain: '雨',
  snow: '雪',
  wind: '风',
} as const;

/** 天气列表 */
export const WEATHERS: readonly WeatherType[] = ['clear', 'rain', 'snow', 'wind'] as const;

// ─────────────────────────────────────────────
// 3. 年号
// ─────────────────────────────────────────────

/** 年号条目 */
export interface EraEntry {
  /** 年号名称（如 "建安"） */
  name: string;
  /** 年号起始游戏年（含） */
  startYear: number;
  /** 年号结束游戏年（含），Infinity 表示延续到最后 */
  endYear: number;
}

// ─────────────────────────────────────────────
// 4. 游戏日期
// ─────────────────────────────────────────────

/** 游戏内日期（不含时分秒，v1.0 以天为最小单位） */
export interface GameDate {
  /** 游戏年（从 1 开始） */
  year: number;
  /** 游戏月 1-12 */
  month: number;
  /** 游戏日 1-30 */
  day: number;
  /** 当前季节 */
  season: Season;
  /** 当前年号 */
  eraName: string;
  /** 年号内第几年（如建安三年 → yearInEra = 3） */
  yearInEra: number;
}

// ─────────────────────────────────────────────
// 5. 季节加成（v1.0 预留接口）
// ─────────────────────────────────────────────

/** 季节对资源产出的加成倍率 */
export interface SeasonBonus {
  /** 粮草产出倍率 */
  grainMultiplier: number;
  /** 铜钱产出倍率 */
  goldMultiplier: number;
  /** 兵力产出倍率 */
  troopsMultiplier: number;
}

// ─────────────────────────────────────────────
// 6. 日历状态快照
// ─────────────────────────────────────────────

/** 日历子系统完整状态（供 getState / UI 消费） */
export interface CalendarState {
  /** 当前游戏日期 */
  date: GameDate;
  /** 当前天气 */
  weather: WeatherType;
  /** 已累计流逝的游戏天数（从 0 开始） */
  totalDays: number;
  /** 是否暂停 */
  paused: boolean;
}

// ─────────────────────────────────────────────
// 7. 序列化格式
// ─────────────────────────────────────────────

/** 日历存档数据格式 */
export interface CalendarSaveData {
  /** 存档版本号 */
  version: number;
  /** 累计游戏天数（浮点，可还原到当天内进度） */
  totalDays: number;
  /** 当前天气 */
  weather: WeatherType;
  /** 天气计时器剩余（游戏天） */
  weatherTimer: number;
  /** 是否暂停 */
  paused: boolean;
  /** 时间缩放倍率（v2 新增，旧存档可能缺失） */
  timeScale?: number;
  /** 天气变化间隔（v2 新增，旧存档可能缺失） */
  weatherDuration?: number;
}
