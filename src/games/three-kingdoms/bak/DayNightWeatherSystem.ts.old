/**
 * 三国霸业 — 昼夜与天气视觉效果系统（增强版）
 *
 * 提供 6 个时段 + 6 种天气的完整视觉参数：
 * - 环境光颜色 (ambientColor) 和透明度 (ambientAlpha)
 * - 天气粒子参数（雨滴、雪花、暴雨等）
 * - 天气随机切换机制（按概率、定时器驱动）
 * - 序列化 / 反序列化支持
 *
 * @module games/three-kingdoms/DayNightWeatherSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 时段类型 */
export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';

/** 天气类型 */
export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

/** 昼夜 + 天气状态快照 */
export interface DayNightState {
  /** 当前小时 0-24 */
  hour: number;
  /** 时段名称 */
  timeOfDay: TimeOfDay;
  /** 环境光颜色 (0xRRGGBB) */
  ambientColor: number;
  /** 环境光透明度 0-1 */
  ambientAlpha: number;
  /** 当前天气 */
  weather: WeatherType;
  /** 天气强度 0-1 */
  weatherIntensity: number;
}

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 时段配置：颜色、透明度、描述 */
const TIME_PERIODS: {
  name: TimeOfDay;
  startHour: number;
  endHour: number;
  color: number;
  alpha: number;
  description: string;
}[] = [
  { name: 'dawn',      startHour: 5,  endHour: 7,  color: 0xffa07a, alpha: 0.15, description: '黎明' },
  { name: 'morning',   startHour: 7,  endHour: 10, color: 0xffffcc, alpha: 0.05, description: '清晨' },
  { name: 'noon',      startHour: 10, endHour: 14, color: 0xffffff, alpha: 0.0,  description: '正午' },
  { name: 'afternoon', startHour: 14, endHour: 17, color: 0xffd700, alpha: 0.1,  description: '午后' },
  { name: 'dusk',      startHour: 17, endHour: 19, color: 0xff6347, alpha: 0.25, description: '黄昏' },
  { name: 'night',     startHour: 19, endHour: 5,  color: 0x191970, alpha: 0.4,  description: '夜晚' },
];

/** 天气配置：概率权重、色调偏移、粒子参数 */
const WEATHER_CONFIG: Record<WeatherType, {
  weight: number;
  alphaOffset: number;
  colorOffset: number;
  particles: { type: string; count: number; speed: number; direction: number } | null;
  description: string;
}> = {
  clear:  { weight: 50, alphaOffset: 0,    colorOffset: 0x000000, particles: null,                                                          description: '晴朗' },
  cloudy: { weight: 20, alphaOffset: 0.05, colorOffset: 0x000000, particles: null,                                                          description: '多云' },
  rain:   { weight: 15, alphaOffset: 0.1,  colorOffset: 0x0000ff, particles: { type: 'rain', count: 100, speed: 400, direction: 270 },     description: '雨天' },
  storm:  { weight: 5,  alphaOffset: 0.2,  colorOffset: 0x000000, particles: { type: 'storm', count: 200, speed: 600, direction: 255 },    description: '暴风雨' },
  snow:   { weight: 5,  alphaOffset: 0.1,  colorOffset: 0x222222, particles: { type: 'snow', count: 50, speed: 80, direction: 270 },      description: '雪天' },
  fog:    { weight: 5,  alphaOffset: 0.15, colorOffset: 0x000000, particles: null,                                                          description: '大雾' },
};

/** 天气类型列表（用于随机选择） */
const ALL_WEATHERS: WeatherType[] = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];

/** 天气持续时间范围（秒） */
const WEATHER_DURATION_MIN = 300;  // 5 分钟
const WEATHER_DURATION_MAX = 1800; // 30 分钟

// ═══════════════════════════════════════════════════════════════
// DayNightWeatherSystem 类
// ═══════════════════════════════════════════════════════════════

/**
 * 昼夜与天气视觉效果系统
 *
 * 管理游戏内时段色调和天气粒子效果，供渲染层消费。
 */
export class DayNightWeatherSystem {
  private state: DayNightState;
  private weatherTimer: number;
  private weatherDuration: number;

  constructor() {
    this.state = {
      hour: 8,
      timeOfDay: 'morning',
      ambientColor: 0xffffcc,
      ambientAlpha: 0.05,
      weather: 'clear',
      weatherIntensity: 0,
    };
    this.weatherTimer = 0;
    this.weatherDuration = this.randomWeatherDuration();
  }

  /**
   * 每帧更新
   * @param deltaTime 距上次更新的时间间隔（秒）
   * @param gameHour  当前游戏小时 0-24
   * @returns 当前昼夜 + 天气状态
   */
  update(deltaTime: number, gameHour: number): DayNightState {
    // 更新时间
    this.state.hour = ((gameHour % 24) + 24) % 24;
    this.state.timeOfDay = this.getTimeOfDay(this.state.hour);

    // 更新环境色调
    const ambient = this.getAmbientParams(this.state.hour);
    this.state.ambientColor = ambient.color;
    this.state.ambientAlpha = ambient.alpha;

    // 更新天气
    this.state.weather = this.updateWeather(deltaTime);

    // 应用天气对色调的影响
    const weatherCfg = WEATHER_CONFIG[this.state.weather];
    this.state.ambientAlpha = Math.min(1, this.state.ambientAlpha + weatherCfg.alphaOffset);
    this.state.weatherIntensity = weatherCfg.alphaOffset > 0
      ? Math.min(1, weatherCfg.alphaOffset * 5)
      : 0;

    return { ...this.state };
  }

  /**
   * 根据小时数获取时段
   */
  getTimeOfDay(hour: number): TimeOfDay {
    const h = ((hour % 24) + 24) % 24;
    for (const period of TIME_PERIODS) {
      if (period.name === 'night') {
        // 夜晚跨越 0 点：19-24 和 0-5
        if (h >= period.startHour || h < period.endHour) {
          return period.name;
        }
      } else {
        if (h >= period.startHour && h < period.endHour) {
          return period.name;
        }
      }
    }
    return 'night'; // 兜底
  }

  /**
   * 获取环境色调参数
   */
  getAmbientParams(hour: number): { color: number; alpha: number } {
    const tod = this.getTimeOfDay(hour);
    const period = TIME_PERIODS.find((p) => p.name === tod)!;
    return { color: period.color, alpha: period.alpha };
  }

  /**
   * 天气随机变化（定时器驱动）
   * @returns 当前天气类型
   */
  updateWeather(deltaTime: number): WeatherType {
    this.weatherTimer += deltaTime;

    if (this.weatherTimer >= this.weatherDuration) {
      // 重置计时器
      this.weatherTimer = 0;
      this.weatherDuration = this.randomWeatherDuration();

      // 按权重随机选择新天气
      this.state.weather = this.weightedRandomWeather();
    }

    return this.state.weather;
  }

  /**
   * 获取天气粒子参数（供渲染层使用）
   */
  getWeatherParticles(): { type: string; count: number; speed: number; direction: number } {
    const cfg = WEATHER_CONFIG[this.state.weather];
    return cfg.particles ?? { type: 'none', count: 0, speed: 0, direction: 0 };
  }

  /**
   * 获取当前状态快照
   */
  getState(): DayNightState {
    return { ...this.state };
  }

  /**
   * 获取时段描述（中文，用于 UI 显示）
   */
  getTimeDescription(): string {
    const period = TIME_PERIODS.find((p) => p.name === this.state.timeOfDay);
    return period?.description ?? '未知';
  }

  /**
   * 获取天气描述（中文，用于 UI 显示）
   */
  getWeatherDescription(): string {
    return WEATHER_CONFIG[this.state.weather].description;
  }

  /**
   * 序列化为普通对象
   */
  serialize(): object {
    return {
      hour: this.state.hour,
      timeOfDay: this.state.timeOfDay,
      ambientColor: this.state.ambientColor,
      ambientAlpha: this.state.ambientAlpha,
      weather: this.state.weather,
      weatherIntensity: this.state.weatherIntensity,
      weatherTimer: this.weatherTimer,
      weatherDuration: this.weatherDuration,
    };
  }

  /**
   * 从序列化数据恢复
   */
  deserialize(data: Record<string, unknown>): void {
    if (typeof data.hour === 'number') this.state.hour = data.hour;
    if (typeof data.timeOfDay === 'string') this.state.timeOfDay = data.timeOfDay as TimeOfDay;
    if (typeof data.ambientColor === 'number') this.state.ambientColor = data.ambientColor;
    if (typeof data.ambientAlpha === 'number') this.state.ambientAlpha = data.ambientAlpha;
    if (typeof data.weather === 'string') this.state.weather = data.weather as WeatherType;
    if (typeof data.weatherIntensity === 'number') this.state.weatherIntensity = data.weatherIntensity;
    if (typeof data.weatherTimer === 'number') this.weatherTimer = data.weatherTimer;
    if (typeof data.weatherDuration === 'number') this.weatherDuration = data.weatherDuration;
  }

  // ───────────────────────────────────────────────────────────
  // 私有方法
  // ───────────────────────────────────────────────────────────

  /** 按权重随机选择天气 */
  private weightedRandomWeather(): WeatherType {
    const totalWeight = ALL_WEATHERS.reduce((sum, w) => sum + WEATHER_CONFIG[w].weight, 0);
    let roll = Math.random() * totalWeight;

    for (const weather of ALL_WEATHERS) {
      roll -= WEATHER_CONFIG[weather].weight;
      if (roll <= 0) {
        return weather;
      }
    }
    return 'clear';
  }

  /** 生成随机天气持续时间（5-30 分钟） */
  private randomWeatherDuration(): number {
    return WEATHER_DURATION_MIN + Math.random() * (WEATHER_DURATION_MAX - WEATHER_DURATION_MIN);
  }
}
