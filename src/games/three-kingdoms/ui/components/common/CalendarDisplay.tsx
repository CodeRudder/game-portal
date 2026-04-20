/**
 * 三国霸业 — 日历显示组件
 *
 * 显示游戏内时间信息：
 *   - 当前年号/年份
 *   - 季节显示（春/夏/秋/冬）
 *   - 天气状态（晴/雨/雪/风）
 *   - 季节加成信息
 *   - 季节切换动画（预留）
 *
 * 引擎依赖：engine/calendar/ 下的 CalendarSystem
 *
 * @module ui/components/common/CalendarDisplay
 */

import { useMemo } from 'react';
import { useGameContext } from '../../context/GameContext';
import type { Season, WeatherType, GameDate } from '../../../engine/calendar/calendar.types';
import {
  SEASON_LABELS,
  WEATHER_LABELS,
} from '../../../engine/calendar/calendar.types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 季节样式配置 */
interface SeasonStyle {
  icon: string;
  color: string;
  background: string;
}

/** 天气样式配置 */
interface WeatherStyle {
  icon: string;
  color: string;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 季节样式映射 */
const SEASON_STYLES: Record<Season, SeasonStyle> = {
  spring: { icon: '🌸', color: '#f472b6', background: 'rgba(244, 114, 182, 0.08)' },
  summer: { icon: '☀️', color: '#fb923c', background: 'rgba(251, 146, 60, 0.08)' },
  autumn: { icon: '🍂', color: '#d4a574', background: 'rgba(212, 165, 116, 0.08)' },
  winter: { icon: '❄️', color: '#93c5fd', background: 'rgba(147, 197, 253, 0.08)' },
};

/** 天气样式映射 */
const WEATHER_STYLES: Record<WeatherType, WeatherStyle> = {
  clear: { icon: '☀️', color: '#fbbf24' },
  rain: { icon: '🌧️', color: '#60a5fa' },
  snow: { icon: '🌨️', color: '#e0e7ff' },
  wind: { icon: '💨', color: '#a0a0a0' },
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface CalendarDisplayProps {
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 格式化游戏日期为中文 */
function formatGameDate(date: GameDate): string {
  const yearStr = date.yearInEra === 1
    ? `${date.eraName}元年`
    : `${date.eraName}${toChineseNumber(date.yearInEra)}年`;
  const monthStr = date.month === 1 ? '正月' : `${toChineseNumber(date.month)}月`;
  const dayStr = toChineseDay(date.day);
  return `${yearStr} ${monthStr}${dayStr}`;
}

/** 数字转中文（1-99） */
function toChineseNumber(n: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (n <= 10) return digits[n];
  if (n < 20) return `十${n % 10 === 0 ? '' : digits[n % 10]}`;
  if (n < 100 && n % 10 === 0) return `${digits[Math.floor(n / 10)]}十`;
  return `${digits[Math.floor(n / 10)]}十${digits[n % 10]}`;
}

/** 日期转中文 */
function toChineseDay(day: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (day <= 10) return `初${digits[day]}`;
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 20) return `十${digits[day % 10]}`;
  return `二十${digits[day % 10]}`;
}

/** 格式化季节加成 */
function formatSeasonBonus(bonus: { grainMultiplier: number; goldMultiplier: number; troopsMultiplier: number }): string[] {
  const lines: string[] = [];
  if (bonus.grainMultiplier !== 1) lines.push(`粮草 ×${bonus.grainMultiplier}`);
  if (bonus.goldMultiplier !== 1) lines.push(`铜钱 ×${bonus.goldMultiplier}`);
  if (bonus.troopsMultiplier !== 1) lines.push(`兵力 ×${bonus.troopsMultiplier}`);
  return lines;
}

// ─────────────────────────────────────────────
// 纯逻辑管理器（用于测试）
// ─────────────────────────────────────────────

/**
 * CalendarLogic — 日历显示逻辑管理器
 *
 * 封装日历显示的核心逻辑，不依赖 React DOM。
 */
export class CalendarLogic {
  private date: GameDate;
  private weather: WeatherType;
  private totalDays: number;
  private paused: boolean;
  private seasonBonus: { grainMultiplier: number; goldMultiplier: number; troopsMultiplier: number };

  constructor(
    date: GameDate,
    weather: WeatherType,
    totalDays: number = 0,
    paused: boolean = false,
    seasonBonus: { grainMultiplier: number; goldMultiplier: number; troopsMultiplier: number } = {
      grainMultiplier: 1, goldMultiplier: 1, troopsMultiplier: 1,
    },
  ) {
    this.date = date;
    this.weather = weather;
    this.totalDays = totalDays;
    this.paused = paused;
    this.seasonBonus = seasonBonus;
  }

  /** 获取格式化的日期字符串 */
  getFormattedDate(): string {
    return formatGameDate(this.date);
  }

  /** 获取季节信息 */
  getSeasonInfo(): { label: string; icon: string; color: string; background: string } {
    const style = SEASON_STYLES[this.date.season];
    return {
      label: SEASON_LABELS[this.date.season],
      icon: style.icon,
      color: style.color,
      background: style.background,
    };
  }

  /** 获取天气信息 */
  getWeatherInfo(): { label: string; icon: string; color: string } {
    const style = WEATHER_STYLES[this.weather];
    return {
      label: WEATHER_LABELS[this.weather],
      icon: style.icon,
      color: style.color,
    };
  }

  /** 获取年号信息 */
  getEraInfo(): { eraName: string; yearInEra: number } {
    return { eraName: this.date.eraName, yearInEra: this.date.yearInEra };
  }

  /** 获取季节加成描述 */
  getSeasonBonusDesc(): string[] {
    return formatSeasonBonus(this.seasonBonus);
  }

  /** 是否有季节加成 */
  hasSeasonBonus(): boolean {
    return this.seasonBonus.grainMultiplier !== 1
      || this.seasonBonus.goldMultiplier !== 1
      || this.seasonBonus.troopsMultiplier !== 1;
  }

  /** 获取累计天数 */
  getTotalDays(): number {
    return this.totalDays;
  }

  /** 是否暂停 */
  isPaused(): boolean {
    return this.paused;
  }

  /** 获取完整日期 */
  getDate(): GameDate {
    return { ...this.date };
  }

  /** 获取天气 */
  getWeather(): WeatherType {
    return this.weather;
  }

  /** 获取季节 */
  getSeason(): Season {
    return this.date.season;
  }

  /** 计算一年中的进度百分比 */
  getYearProgress(): number {
    // 假设每月30天，一年360天
    const dayOfYear = (this.date.month - 1) * 30 + this.date.day;
    return Math.round((dayOfYear / 360) * 100);
  }

  /** 计算季节中的天数 */
  getSeasonDayCount(): number {
    // 每个季节3个月，每月30天
    const seasonMonths: Record<Season, number[]> = {
      spring: [1, 2, 3],
      summer: [4, 5, 6],
      autumn: [7, 8, 9],
      winter: [10, 11, 12],
    };
    const months = seasonMonths[this.date.season];
    const firstMonth = months[0];
    return (this.date.month - firstMonth) * 30 + this.date.day;
  }
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * CalendarDisplay — 日历显示组件
 *
 * @example
 * ```tsx
 * <CalendarDisplay />
 * ```
 */
export function CalendarDisplay({ className }: CalendarDisplayProps) {
  const { engine, snapshot } = useGameContext();

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  const calendarState = snapshot.calendar;
  const calendar = engine.calendar;

  // 创建逻辑实例
  const logic = useMemo(
    () => new CalendarLogic(
      calendarState.date,
      calendarState.weather,
      calendarState.totalDays,
      calendarState.paused,
      calendar.getSeasonBonus(),
    ),
    [calendarState, calendar],
  );

  const seasonInfo = logic.getSeasonInfo();
  const weatherInfo = logic.getWeatherInfo();
  const eraInfo = logic.getEraInfo();
  const bonusDesc = logic.getSeasonBonusDesc();

  return (
    <div
      style={{
        ...styles.container,
        background: seasonInfo.background,
      }}
      className={`tk-calendar ${className ?? ''}`.trim()}
      role="region"
      aria-label="日历"
    >
      {/* 年号 + 日期 */}
      <div style={styles.dateSection}>
        <div style={styles.eraName}>{eraInfo.eraName}</div>
        <div style={styles.dateString}>{logic.getFormattedDate()}</div>
      </div>

      {/* 季节 + 天气 */}
      <div style={styles.statusRow}>
        {/* 季节 */}
        <div style={{ ...styles.statusItem, borderColor: seasonInfo.color }}>
          <span style={styles.statusIcon}>{seasonInfo.icon}</span>
          <span style={{ ...styles.statusLabel, color: seasonInfo.color }}>{seasonInfo.label}</span>
        </div>

        {/* 天气 */}
        <div style={{ ...styles.statusItem, borderColor: weatherInfo.color }}>
          <span style={styles.statusIcon}>{weatherInfo.icon}</span>
          <span style={{ ...styles.statusLabel, color: weatherInfo.color }}>{weatherInfo.label}</span>
        </div>

        {/* 暂停标记 */}
        {logic.isPaused() && (
          <div style={styles.pausedBadge}>⏸ 已暂停</div>
        )}
      </div>

      {/* 季节加成 */}
      {logic.hasSeasonBonus() && (
        <div style={styles.bonusSection}>
          <div style={styles.bonusTitle}>季节加成</div>
          {bonusDesc.map((desc) => (
            <div key={desc} style={styles.bonusItem}>{desc}</div>
          ))}
        </div>
      )}

      {/* 年度进度 */}
      <div style={styles.progressSection}>
        <div style={styles.progressLabel}>
          <span>年度进度</span>
          <span style={{ color: seasonInfo.color }}>{logic.getYearProgress()}%</span>
        </div>
        <div style={styles.progressBg}>
          <div
            style={{
              ...styles.progressFill,
              width: `${logic.getYearProgress()}%`,
              backgroundColor: seasonInfo.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(212, 165, 116, 0.15)',
    color: '#e8e0d0',
    fontSize: '13px',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#a0a0a0',
  },
  dateSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  eraName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#d4a574',
  },
  dateString: {
    fontSize: '13px',
    color: '#e8e0d0',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    border: '1px solid',
    borderRadius: '4px',
  },
  statusIcon: {
    fontSize: '14px',
  },
  statusLabel: {
    fontSize: '12px',
    fontWeight: 600,
  },
  pausedBadge: {
    fontSize: '11px',
    color: '#fbbf24',
    fontWeight: 600,
  },
  bonusSection: {
    padding: '6px 8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  bonusTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '2px',
  },
  bonusItem: {
    fontSize: '11px',
    color: '#e8e0d0',
  },
  progressSection: {
    marginBottom: '4px',
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    marginBottom: '2px',
  },
  progressBg: {
    width: '100%',
    height: '3px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
};
