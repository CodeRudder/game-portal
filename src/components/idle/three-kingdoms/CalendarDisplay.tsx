/**
 * CalendarDisplay — 日历显示组件
 *
 * 职责：渲染游戏内日历信息（年号/季节/天气/日期）
 * 从 ThreeKingdomsGame.tsx 拆分出来
 */

import React from 'react';
import type { Season, WeatherType } from '@/games/three-kingdoms/engine';
import { SEASON_LABELS, WEATHER_LABELS } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 天气图标映射 */
const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: '☀️',
  rain: '🌧️',
  snow: '❄️',
  wind: '🌬️',
};

/** 季节图标映射 */
const SEASON_ICONS: Record<Season, string> = {
  spring: '🌸',
  summer: '🌞',
  autumn: '🍂',
  winter: '❄️',
};

// ─────────────────────────────────────────────
// 日历格式化工具
// ─────────────────────────────────────────────

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

/** 数字转中文（1-99） */
function toChineseNumber(n: number): string {
  if (n <= 10) return CN_DIGITS[n];
  if (n < 20) return `十${n % 10 === 0 ? '' : CN_DIGITS[n % 10]}`;
  if (n < 100 && n % 10 === 0) return `${CN_DIGITS[Math.floor(n / 10)]}十`;
  return `${CN_DIGITS[Math.floor(n / 10)]}十${CN_DIGITS[n % 10]}`;
}

/** 年号内年数转中文 */
function toChineseYear(n: number): string {
  return toChineseNumber(n);
}

/** 日期转中文（带"初"前缀） */
function toChineseDay(day: number): string {
  if (day <= 10) return `初${CN_DIGITS[day]}`;
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 20) return `十${CN_DIGITS[day % 10]}`;
  return `二十${CN_DIGITS[day % 10]}`;
}

/** 格式化游戏日期为中文显示 */
function formatGameDate(date: { month: number; day: number }): string {
  const monthStr = date.month === 1 ? '正月' : `${toChineseNumber(date.month)}月`;
  const dayStr = toChineseDay(date.day);
  return `${monthStr}${dayStr}`;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface CalendarDisplayProps {
  /** 日历状态，可能为 undefined（安全降级） */
  calendar: {
    date?: {
      eraName: string;
      yearInEra: number;
      month: number;
      day: number;
      season: Season;
    };
    weather: WeatherType;
  } | null;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const CalendarDisplay: React.FC<CalendarDisplayProps> = ({ calendar }) => {
  return (
    <div className="tk-calendar" data-testid="calendar-display">
      <span className="tk-calendar-era" data-testid="calendar-display-era">
        {calendar?.date
          ? `${calendar.date.eraName}${calendar.date.yearInEra === 1 ? '元年' : `${toChineseYear(calendar.date.yearInEra)}年`}`
          : '建安元年'}
      </span>
      <span className="tk-calendar-season" data-testid="calendar-display-season">
        {calendar?.date
          ? `${SEASON_ICONS[calendar.date.season]} ${SEASON_LABELS[calendar.date.season]}`
          : '🌸 春'}
      </span>
      <span className="tk-calendar-weather" data-testid="calendar-display-weather">
        {calendar
          ? `${WEATHER_ICONS[calendar.weather]} ${WEATHER_LABELS[calendar.weather]}`
          : '☀️ 晴'}
      </span>
      <span className="tk-calendar-date" data-testid="calendar-display-date">
        {calendar?.date ? formatGameDate(calendar.date) : '正月初一'}
      </span>
    </div>
  );
};

CalendarDisplay.displayName = 'CalendarDisplay';

export default CalendarDisplay;
