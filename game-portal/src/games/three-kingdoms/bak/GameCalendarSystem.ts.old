/**
 * 三国霸业 — 游戏日历系统 & 十二时辰系统
 *
 * 提供建安纪年、十二时辰、二十四节气、季节效果、历史大事件等功能：
 * - 60秒现实时间 = 1游戏小时（可调 timeScale）
 * - 建安元年正月初一为游戏起始日期
 * - 十二时辰映射（子丑寅卯辰巳午未申酉戌亥）
 * - 二十四节气按月日匹配
 * - 季节资源产出加成
 * - 历史大事件预告与触发
 * - 时间加速、暂停、序列化支持
 *
 * @module games/three-kingdoms/GameCalendarSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 十二时辰 */
export type Shichen = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';

/** 二十四节气 */
export type SolarTerm =
  '立春' | '雨水' | '惊蛰' | '春分' | '清明' | '谷雨' |
  '立夏' | '小满' | '芒种' | '夏至' | '小暑' | '大暑' |
  '立秋' | '处暑' | '白露' | '秋分' | '寒露' | '霜降' |
  '立冬' | '小雪' | '大雪' | '冬至' | '小寒' | '大寒';

/** 季节 */
export type Season = '春' | '夏' | '秋' | '冬';

/** 游戏日期 */
export interface GameDate {
  /** 建安X年（从建安1年开始） */
  year: number;
  /** 月份 1-12 */
  month: number;
  /** 日期 1-30 */
  day: number;
  /** 季节 */
  season: Season;
  /** 节气（若当日有节气） */
  solarTerm?: SolarTerm;
  /** 当前时辰 */
  shichen: Shichen;
  /** 小时 0-23 */
  hour: number;
  /** 分钟 0-59 */
  minute: number;
}

/** 大事件预告 */
export interface UpcomingEvent {
  id: string;
  name: string;
  description: string;
  triggerDate: GameDate;
  daysRemaining: number;
  type: 'historical' | 'seasonal' | 'quest' | 'random';
  rewards?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 时辰配置表 */
const SHICHEN_TABLE: { shichen: Shichen; startHour: number; endHour: number; description: string }[] = [
  { shichen: '子', startHour: 23, endHour: 1,  description: '深夜' },
  { shichen: '丑', startHour: 1,  endHour: 3,  description: '深夜' },
  { shichen: '寅', startHour: 3,  endHour: 5,  description: '凌晨' },
  { shichen: '卯', startHour: 5,  endHour: 7,  description: '早晨' },
  { shichen: '辰', startHour: 7,  endHour: 9,  description: '上午' },
  { shichen: '巳', startHour: 9,  endHour: 11, description: '上午' },
  { shichen: '午', startHour: 11, endHour: 13, description: '中午' },
  { shichen: '未', startHour: 13, endHour: 15, description: '下午' },
  { shichen: '申', startHour: 15, endHour: 17, description: '下午' },
  { shichen: '酉', startHour: 17, endHour: 19, description: '傍晚' },
  { shichen: '戌', startHour: 19, endHour: 21, description: '晚上' },
  { shichen: '亥', startHour: 21, endHour: 23, description: '夜晚' },
];

/**
 * 二十四节气查找表：[month, day] → SolarTerm
 * 每月两个节气，大约在每月的 5-7 日和 20-22 日
 */
const SOLAR_TERM_MAP: [number, number, SolarTerm][] = [
  [1,  6,  '小寒'],  [1,  20, '大寒'],
  [2,  4,  '立春'],  [2,  19, '雨水'],
  [3,  6,  '惊蛰'],  [3,  21, '春分'],
  [4,  5,  '清明'],  [4,  20, '谷雨'],
  [5,  6,  '立夏'],  [5,  21, '小满'],
  [6,  6,  '芒种'],  [6,  21, '夏至'],
  [7,  7,  '小暑'],  [7,  23, '大暑'],
  [8,  7,  '立秋'],  [8,  23, '处暑'],
  [9,  8,  '白露'],  [9,  23, '秋分'],
  [10, 8,  '寒露'],  [10, 23, '霜降'],
  [11, 7,  '立冬'],  [11, 22, '小雪'],
  [12, 7,  '大雪'],  [12, 22, '冬至'],
];

/** 季节效果配置 */
const SEASON_EFFECTS: Record<Season, { foodMultiplier: number; goldMultiplier: number; moraleModifier: number }> = {
  '春': { foodMultiplier: 1.2, goldMultiplier: 1.0, moraleModifier: 0 },
  '夏': { foodMultiplier: 1.0, goldMultiplier: 1.1, moraleModifier: -0.05 },
  '秋': { foodMultiplier: 1.5, goldMultiplier: 1.2, moraleModifier: 0.1 },
  '冬': { foodMultiplier: 0.7, goldMultiplier: 0.8, moraleModifier: -0.1 },
};

/** 默认时间缩放：60秒现实时间 = 1游戏小时 */
const DEFAULT_TIME_SCALE = 1;

/** 每月天数（固定30天） */
const DAYS_PER_MONTH = 30;

/** 每年月数 */
const MONTHS_PER_YEAR = 12;

/** 每天小时数 */
const HOURS_PER_DAY = 24;

/** 每小时分钟数 */
const MINUTES_PER_HOUR = 60;

/** 每分钟秒数 */
const SECONDS_PER_MINUTE = 60;

/** 中文数字映射（用于日期格式化） */
const CN_NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

// ═══════════════════════════════════════════════════════════════
// GameCalendarSystem 类
// ═══════════════════════════════════════════════════════════════

export class GameCalendarSystem {
  /** 累计游戏分钟数 */
  private totalGameMinutes: number;
  /** 游戏起始日期（建安元年正月初一） */
  private readonly startDate: { year: number; month: number; day: number };
  /** 待触发的大事件列表 */
  private upcomingEvents: UpcomingEvent[];
  /** 历史事件注册表：key = "year-month-day" */
  private historicalEvents: Map<string, { name: string; month: number; day: number }>;
  /** 时间缩放倍率 */
  private timeScale: number;
  /** 是否暂停 */
  private paused: boolean;

  constructor() {
    this.totalGameMinutes = 0;
    this.startDate = { year: 1, month: 1, day: 1 };
    this.upcomingEvents = [];
    this.historicalEvents = new Map();
    this.timeScale = DEFAULT_TIME_SCALE;
    this.paused = false;
    this.initHistoricalEvents();
  }

  // ───────────────────────────────────────────────────────────
  // 时间推进
  // ───────────────────────────────────────────────────────────

  /**
   * 更新游戏时间
   * @param deltaSeconds 现实经过的秒数
   * @param timeScale 可选的时间缩放（覆盖当前 timeScale）
   * @returns 当前游戏日期
   */
  update(deltaSeconds: number, timeScale?: number): GameDate {
    if (this.paused) {
      return this.getCurrentDate();
    }

    const scale = timeScale ?? this.timeScale;
    // 60秒现实时间 → 1游戏小时 → 60游戏分钟
    const gameMinutesDelta = (deltaSeconds * scale) / SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
    this.totalGameMinutes += gameMinutesDelta;

    return this.getCurrentDate();
  }

  // ───────────────────────────────────────────────────────────
  // 日期计算
  // ───────────────────────────────────────────────────────────

  /**
   * 根据累计游戏分钟数计算当前完整日期
   */
  getCurrentDate(): GameDate {
    const totalMinutes = Math.floor(this.totalGameMinutes);

    const minutes = totalMinutes % MINUTES_PER_HOUR;
    const totalHours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const hour = totalHours % HOURS_PER_DAY;
    const totalDays = Math.floor(totalHours / HOURS_PER_DAY);

    const day = (totalDays % DAYS_PER_MONTH) + 1;
    const totalMonths = Math.floor(totalDays / DAYS_PER_MONTH);
    const month = (totalMonths % MONTHS_PER_YEAR) + 1;
    const year = Math.floor(totalMonths / MONTHS_PER_YEAR) + 1;

    const season = this.getCurrentSeason(month);
    const solarTerm = this.getSolarTerm(month, day);
    const shichen = this.getShichen(hour);

    return { year, month, day, season, solarTerm, shichen, hour, minute: minutes };
  }

  // ───────────────────────────────────────────────────────────
  // 日期格式化
  // ───────────────────────────────────────────────────────────

  /**
   * 格式化为完整日期字符串
   * @example "建安三年 五月初七 午时"
   */
  formatDate(date?: GameDate): string {
    const d = date ?? this.getCurrentDate();
    const yearStr = `建安${d.year === 1 ? '元' : this.toChineseNumber(d.year)}年`;
    const monthStr = `${d.month === 1 ? '正' : this.toChineseNumber(d.month)}月`;
    const dayStr = this.toChineseDay(d.day);
    return `${yearStr} ${monthStr}${dayStr} ${d.shichen}时`;
  }

  /**
   * 格式化为简短日期字符串
   * @example "三年/五月/初七"
   */
  formatDateShort(date?: GameDate): string {
    const d = date ?? this.getCurrentDate();
    const yearStr = `${d.year === 1 ? '元' : this.toChineseNumber(d.year)}年`;
    const monthStr = `${d.month === 1 ? '正' : this.toChineseNumber(d.month)}月`;
    const dayStr = this.toChineseDay(d.day);
    return `${yearStr}/${monthStr}/${dayStr}`;
  }

  // ───────────────────────────────────────────────────────────
  // 时辰相关
  // ───────────────────────────────────────────────────────────

  /**
   * 根据小时获取对应时辰
   */
  getShichen(hour: number): Shichen {
    const h = ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
    // 子时跨日：23:00-01:00
    if (h >= 23 || h < 1) return '子';
    if (h >= 1 && h < 3) return '丑';
    if (h >= 3 && h < 5) return '寅';
    if (h >= 5 && h < 7) return '卯';
    if (h >= 7 && h < 9) return '辰';
    if (h >= 9 && h < 11) return '巳';
    if (h >= 11 && h < 13) return '午';
    if (h >= 13 && h < 15) return '未';
    if (h >= 15 && h < 17) return '申';
    if (h >= 17 && h < 19) return '酉';
    if (h >= 19 && h < 21) return '戌';
    return '亥'; // 21-23
  }

  /**
   * 获取时辰的时段描述
   * @example "子时(深夜)"
   */
  getShichenPeriod(shichen: Shichen): string {
    const entry = SHICHEN_TABLE.find(s => s.shichen === shichen);
    return entry ? `${shichen}时(${entry.description})` : `${shichen}时`;
  }

  /**
   * 获取全部十二时辰配置
   */
  getShichenHours(): { shichen: Shichen; startHour: number; endHour: number; description: string }[] {
    return [...SHICHEN_TABLE];
  }

  // ───────────────────────────────────────────────────────────
  // 节气相关
  // ───────────────────────────────────────────────────────────

  /**
   * 根据月日获取节气（精确匹配）
   */
  getSolarTerm(month: number, day: number): SolarTerm | undefined {
    const entry = SOLAR_TERM_MAP.find(([m, d]) => m === month && d === day);
    return entry ? entry[2] : undefined;
  }

  /**
   * 根据月份获取季节
   */
  getCurrentSeason(month: number): Season {
    if (month >= 1 && month <= 3) return '春';
    if (month >= 4 && month <= 6) return '夏';
    if (month >= 7 && month <= 9) return '秋';
    return '冬';
  }

  // ───────────────────────────────────────────────────────────
  // 季节效果
  // ───────────────────────────────────────────────────────────

  /**
   * 获取季节对资源产出的影响
   */
  getSeasonEffect(season: Season): { foodMultiplier: number; goldMultiplier: number; moraleModifier: number } {
    return { ...SEASON_EFFECTS[season] };
  }

  // ───────────────────────────────────────────────────────────
  // 大事件系统
  // ───────────────────────────────────────────────────────────

  /**
   * 添加一个大事件预告
   */
  addUpcomingEvent(event: UpcomingEvent): void {
    this.upcomingEvents.push(event);
  }

  /**
   * 获取所有待触发的大事件
   */
  getUpcomingEvents(): UpcomingEvent[] {
    return [...this.upcomingEvents];
  }

  /**
   * 检查并返回当前日期触发的大事件
   */
  checkEventTriggers(currentDate: GameDate): UpcomingEvent[] {
    const triggered: UpcomingEvent[] = [];

    this.upcomingEvents = this.upcomingEvents.filter(event => {
      const isTriggered =
        event.triggerDate.year === currentDate.year &&
        event.triggerDate.month === currentDate.month &&
        event.triggerDate.day === currentDate.day;

      if (isTriggered) {
        triggered.push({ ...event, daysRemaining: 0 });
      }
      return !isTriggered;
    });

    // 更新剩余天数
    this.upcomingEvents.forEach(event => {
      event.daysRemaining = this.calculateDaysBetween(currentDate, event.triggerDate);
    });

    return triggered;
  }

  /**
   * 初始化三国历史大事件
   */
  initHistoricalEvents(): void {
    const events: [string, number, number, string][] = [
      ['1-1-1',   1,  1,  '曹操迎帝'],
      ['3-10-15', 3,  10, '吕布殒命'],
      ['5-9-15',  5,  9,  '官渡之战'],
      ['13-7-15', 13, 7,  '赤壁之战'],
      ['19-5-1',  19, 5,  '刘备入蜀'],
      ['25-1-1',  25, 1,  '曹丕篡汉'],
    ];

    events.forEach(([key, month, day, name]) => {
      this.historicalEvents.set(key, { name, month, day });
    });
  }

  /**
   * 获取指定年份的历史事件
   */
  getHistoricalEvents(year: number): { name: string; month: number; day: number }[] {
    const result: { name: string; month: number; day: number }[] = [];
    this.historicalEvents.forEach((value, key) => {
      const eventYear = parseInt(key.split('-')[0], 10);
      if (eventYear === year) {
        result.push(value);
      }
    });
    return result;
  }

  // ───────────────────────────────────────────────────────────
  // 时间控制
  // ───────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────
  // 序列化
  // ───────────────────────────────────────────────────────────

  serialize(): object {
    return {
      totalGameMinutes: this.totalGameMinutes,
      timeScale: this.timeScale,
      paused: this.paused,
      upcomingEvents: this.upcomingEvents,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (typeof data.totalGameMinutes === 'number') {
      this.totalGameMinutes = data.totalGameMinutes;
    }
    if (typeof data.timeScale === 'number') {
      this.timeScale = data.timeScale;
    }
    if (typeof data.paused === 'boolean') {
      this.paused = data.paused;
    }
    if (Array.isArray(data.upcomingEvents)) {
      this.upcomingEvents = data.upcomingEvents as UpcomingEvent[];
    }
  }

  // ───────────────────────────────────────────────────────────
  // 私有工具方法
  // ───────────────────────────────────────────────────────────

  /**
   * 数字转中文（1-99）
   */
  private toChineseNumber(n: number): string {
    if (n <= 10) return CN_NUMBERS[n];
    if (n < 20) return `十${n % 10 === 0 ? '' : CN_NUMBERS[n % 10]}`;
    if (n < 100 && n % 10 === 0) return `${CN_NUMBERS[Math.floor(n / 10)]}十`;
    return `${CN_NUMBERS[Math.floor(n / 10)]}十${CN_NUMBERS[n % 10]}`;
  }

  /**
   * 日期转中文（带"初"前缀）
   */
  private toChineseDay(day: number): string {
    if (day <= 10) return `初${CN_NUMBERS[day]}`;
    if (day === 20) return '二十';
    if (day === 30) return '三十';
    if (day < 20) return `十${CN_NUMBERS[day % 10]}`;
    return `二十${CN_NUMBERS[day % 10]}`;
  }

  /**
   * 计算两个游戏日期之间的天数差
   */
  private calculateDaysBetween(from: GameDate, to: GameDate): number {
    const fromTotalDays = (from.year - 1) * MONTHS_PER_YEAR * DAYS_PER_MONTH
      + (from.month - 1) * DAYS_PER_MONTH + from.day;
    const toTotalDays = (to.year - 1) * MONTHS_PER_YEAR * DAYS_PER_MONTH
      + (to.month - 1) * DAYS_PER_MONTH + to.day;
    return Math.max(0, toTotalDays - fromTotalDays);
  }
}
