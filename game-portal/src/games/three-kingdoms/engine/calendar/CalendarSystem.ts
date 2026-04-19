/**
 * 日历域 — 聚合根
 *
 * 职责：游戏内时间流逝、年号更替、季节切换、天气变化
 * 规则：可引用 calendar-config 和 calendar.types，禁止引用其他域的 System
 * 通信：通过 EventBus 发出事件，不直接依赖其他子系统
 *
 * 事件输出：
 * - CALENDAR_DAY_CHANGED    每游戏日变化
 * - CALENDAR_SEASON_CHANGED 每季节变化
 * - WEATHER_CHANGED         每天气变化
 *
 * @module engine/calendar/CalendarSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  Season,
  WeatherType,
  GameDate,
  CalendarState,
  CalendarSaveData,
} from './calendar.types';
import { SEASONS, WEATHERS } from './calendar.types';
import {
  DEFAULT_TIME_SCALE,
  DAYS_PER_MONTH,
  MONTHS_PER_YEAR,
  DAYS_PER_YEAR,
  SEASON_MONTH_MAP,
  SEASON_BONUSES,
  WEATHER_WEIGHTS,
  WEATHER_CHANGE_INTERVAL_MIN,
  WEATHER_CHANGE_INTERVAL_MAX,
  ERA_TABLE,
  CALENDAR_SAVE_VERSION,
} from './calendar-config';
import { SocialEvents, MapEvents } from '../../core/events/EventTypes';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 根据游戏天数计算完整日期 */
function computeDate(totalDays: number): GameDate {
  const td = Math.floor(totalDays);
  const day = (td % DAYS_PER_MONTH) + 1;
  const totalMonths = Math.floor(td / DAYS_PER_MONTH);
  const month = (totalMonths % MONTHS_PER_YEAR) + 1;
  const year = Math.floor(totalMonths / MONTHS_PER_YEAR) + 1;
  const season = SEASON_MONTH_MAP[month] ?? 'spring';
  const { eraName, yearInEra } = computeEra(year);

  return { year, month, day, season, eraName, yearInEra };
}

/** 根据游戏年查找当前年号 */
function computeEra(year: number): { eraName: string; yearInEra: number } {
  for (const era of ERA_TABLE) {
    if (year >= era.startYear && year <= era.endYear) {
      return { eraName: era.name, yearInEra: year - era.startYear + 1 };
    }
  }
  // 超出年号表范围，沿用最后一个年号
  const last = ERA_TABLE[ERA_TABLE.length - 1];
  return { eraName: last.name, yearInEra: year - last.startYear + 1 };
}

/** 按权重随机选择天气 */
function rollWeather(): WeatherType {
  const totalWeight = WEATHERS.reduce((sum, w) => sum + WEATHER_WEIGHTS[w], 0);
  let roll = Math.random() * totalWeight;
  for (const w of WEATHERS) {
    roll -= WEATHER_WEIGHTS[w];
    if (roll <= 0) return w;
  }
  return 'clear';
}

/** 在 [min, max] 范围内随机取天气变化间隔 */
function rollWeatherDuration(): number {
  return WEATHER_CHANGE_INTERVAL_MIN
    + Math.random() * (WEATHER_CHANGE_INTERVAL_MAX - WEATHER_CHANGE_INTERVAL_MIN);
}

// ─────────────────────────────────────────────
// CalendarSystem
// ─────────────────────────────────────────────

export class CalendarSystem implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'calendar' as const;
  private deps: ISystemDeps | null = null;

  // ── 内部状态 ──
  /** 累计游戏天数（浮点数，小数部分表示当天内进度） */
  private totalDays: number;
  /** 当前天气 */
  private weather: WeatherType;
  /** 天气变化计时器（游戏天） */
  private weatherTimer: number;
  /** 天气变化间隔（游戏天） */
  private weatherDuration: number;
  /** 时间缩放倍率（现实秒 → 游戏天） */
  private timeScale: number;
  /** 是否暂停 */
  private paused: boolean;

  // ── 缓存（避免每帧重复计算） ──
  private cachedDate: GameDate;
  private lastIntegerDay: number;

  constructor() {
    this.totalDays = 0;
    this.weather = 'clear';
    this.weatherTimer = 0;
    this.weatherDuration = rollWeatherDuration();
    this.timeScale = DEFAULT_TIME_SCALE;
    this.paused = false;
    this.cachedDate = computeDate(0);
    this.lastIntegerDay = 0;
  }

  // ─────────────────────────────────────────────
  // ISubsystem 生命周期
  // ─────────────────────────────────────────────

  /** 注入依赖（事件总线、配置注册表等） */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /**
   * 每帧更新 — 驱动时间流逝
   *
   * @param dt 距上次更新的现实时间增量（秒）
   */
  update(dt: number): void {
    if (this.paused || dt <= 0) return;

    // 1. 推进游戏天数
    const prevIntegerDay = this.lastIntegerDay;
    this.totalDays += dt * this.timeScale;
    this.cachedDate = computeDate(this.totalDays);
    const currentIntegerDay = Math.floor(this.totalDays);

    // 2. 检测日期变化 → 发出 CALENDAR_DAY_CHANGED
    if (currentIntegerDay > prevIntegerDay) {
      this.lastIntegerDay = currentIntegerDay;
      this.emitDayChanged(this.cachedDate);

      // 3. 检测季节变化 → 发出 CALENDAR_SEASON_CHANGED
      this.checkSeasonChange(currentIntegerDay);

      // 4. 推进天气计时器
      this.weatherTimer += (currentIntegerDay - prevIntegerDay);
      if (this.weatherTimer >= this.weatherDuration) {
        this.changeWeather();
      }
    }
  }

  /** 获取日历状态快照 */
  getState(): CalendarState {
    return {
      date: { ...this.cachedDate },
      weather: this.weather,
      totalDays: Math.floor(this.totalDays),
      paused: this.paused,
    };
  }

  /** 重置到初始状态 */
  reset(): void {
    this.totalDays = 0;
    this.weather = 'clear';
    this.weatherTimer = 0;
    this.weatherDuration = rollWeatherDuration();
    this.timeScale = DEFAULT_TIME_SCALE;
    this.paused = false;
    this.cachedDate = computeDate(0);
    this.lastIntegerDay = 0;
  }

  // ─────────────────────────────────────────────
  // 公开 API — 日期查询
  // ─────────────────────────────────────────────

  /** 获取当前游戏日期 */
  getDate(): GameDate {
    return { ...this.cachedDate };
  }

  /** 获取当前游戏年 */
  getYear(): number {
    return this.cachedDate.year;
  }

  /** 获取当前游戏月 */
  getMonth(): number {
    return this.cachedDate.month;
  }

  /** 获取当前游戏日 */
  getDay(): number {
    return this.cachedDate.day;
  }

  /** 获取当前季节 */
  getSeason(): Season {
    return this.cachedDate.season;
  }

  /** 获取当前年号名称 */
  getEraName(): string {
    return this.cachedDate.eraName;
  }

  /** 获取当前年号内第几年 */
  getYearInEra(): number {
    return this.cachedDate.yearInEra;
  }

  /** 获取累计游戏天数 */
  getTotalDays(): number {
    return Math.floor(this.totalDays);
  }

  /**
   * 格式化为完整日期字符串
   * @example "建安三年 三月初七"
   */
  formatDate(date?: GameDate): string {
    const d = date ?? this.cachedDate;
    const yearStr = d.yearInEra === 1
      ? `${d.eraName}元年`
      : `${d.eraName}${toChineseNumber(d.yearInEra)}年`;
    const monthStr = d.month === 1 ? '正月' : `${toChineseNumber(d.month)}月`;
    const dayStr = toChineseDay(d.day);
    return `${yearStr} ${monthStr}${dayStr}`;
  }

  // ─────────────────────────────────────────────
  // 公开 API — 天气查询
  // ─────────────────────────────────────────────

  /** 获取当前天气 */
  getWeather(): WeatherType {
    return this.weather;
  }

  /**
   * 手动设置天气（用于测试或特殊事件）
   * 会通过 EventBus 发出 WEATHER_CHANGED 事件
   */
  setWeather(weather: WeatherType): void {
    const previous = this.weather;
    if (previous === weather) return;
    this.weather = weather;
    this.emitWeatherChanged(previous, weather);
  }

  // ─────────────────────────────────────────────
  // 公开 API — 季节加成（v1.0 预留接口）
  // ─────────────────────────────────────────────

  /** 获取当前季节的资源加成倍率 */
  getSeasonBonus() {
    return { ...SEASON_BONUSES[this.cachedDate.season] };
  }

  /** 获取指定季节的资源加成倍率 */
  getSeasonBonusFor(season: Season) {
    return { ...SEASON_BONUSES[season] };
  }

  // ─────────────────────────────────────────────
  // 公开 API — 时间控制
  // ─────────────────────────────────────────────

  /** 设置时间缩放倍率 */
  setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  /** 获取当前时间缩放倍率 */
  getTimeScale(): number {
    return this.timeScale;
  }

  /** 暂停游戏时间 */
  pause(): void {
    this.paused = true;
  }

  /** 恢复游戏时间 */
  resume(): void {
    this.paused = false;
  }

  /** 是否暂停中 */
  isPaused(): boolean {
    return this.paused;
  }

  // ─────────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────────

  /** 序列化为存档数据 */
  serialize(): CalendarSaveData {
    return {
      version: CALENDAR_SAVE_VERSION,
      totalDays: this.totalDays,
      weather: this.weather,
      weatherTimer: this.weatherTimer,
      paused: this.paused,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: CalendarSaveData): void {
    if (data.version !== CALENDAR_SAVE_VERSION) {
      console.warn(
        `CalendarSystem: 存档版本不匹配 (期望 ${CALENDAR_SAVE_VERSION}，实际 ${data.version})`,
      );
    }

    if (typeof data.totalDays === 'number') {
      this.totalDays = data.totalDays;
    }
    if (typeof data.weather === 'string' && WEATHERS.includes(data.weather as WeatherType)) {
      this.weather = data.weather;
    }
    if (typeof data.weatherTimer === 'number') {
      this.weatherTimer = data.weatherTimer;
    }
    if (typeof data.paused === 'boolean') {
      this.paused = data.paused;
    }

    // 重建缓存
    this.cachedDate = computeDate(this.totalDays);
    this.lastIntegerDay = Math.floor(this.totalDays);
  }

  // ─────────────────────────────────────────────
  // 私有方法 — 事件发射
  // ─────────────────────────────────────────────

  /** 发出日期变化事件 */
  private emitDayChanged(date: GameDate): void {
    if (!this.deps) return;
    this.deps.eventBus.emit(SocialEvents.CALENDAR_DAY_CHANGED, {
      day: date.day,
      month: date.month,
      year: date.year,
    });
  }

  /** 检测并发出季节变化事件 */
  private checkSeasonChange(currentIntegerDay: number): void {
    // 季节变化的判定：跨越季节边界
    const prevDay = currentIntegerDay - 1;
    if (prevDay < 0) return;

    const prevDate = computeDate(prevDay);
    const currDate = this.cachedDate;

    if (prevDate.season !== currDate.season) {
      if (!this.deps) return;
      this.deps.eventBus.emit(SocialEvents.CALENDAR_SEASON_CHANGED, {
        season: currDate.season,
        year: currDate.year,
      });
    }
  }

  /** 随机切换天气并发出事件 */
  private changeWeather(): void {
    const previous = this.weather;
    this.weather = rollWeather();
    this.weatherTimer = 0;
    this.weatherDuration = rollWeatherDuration();

    if (previous !== this.weather) {
      this.emitWeatherChanged(previous, this.weather);
    }
  }

  /** 发出天气变化事件 */
  private emitWeatherChanged(previous: WeatherType, current: WeatherType): void {
    if (!this.deps) return;
    this.deps.eventBus.emit(MapEvents.WEATHER_CHANGED, {
      previous,
      current,
    });
  }
}

// ─────────────────────────────────────────────
// 中文数字格式化工具
// ─────────────────────────────────────────────

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

/** 数字转中文（1-99） */
function toChineseNumber(n: number): string {
  if (n <= 10) return CN_DIGITS[n];
  if (n < 20) return `十${n % 10 === 0 ? '' : CN_DIGITS[n % 10]}`;
  if (n < 100 && n % 10 === 0) return `${CN_DIGITS[Math.floor(n / 10)]}十`;
  return `${CN_DIGITS[Math.floor(n / 10)]}十${CN_DIGITS[n % 10]}`;
}

/** 日期转中文（带"初"前缀） */
function toChineseDay(day: number): string {
  if (day <= 10) return `初${CN_DIGITS[day]}`;
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 20) return `十${CN_DIGITS[day % 10]}`;
  return `二十${CN_DIGITS[day % 10]}`;
}
