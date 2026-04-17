/**
 * 三国霸业 — 地图动态天气系统
 *
 * 提供地图场景的动态天气视觉效果：
 * - 4 种天气：晴天/雨天/雪天/雾天
 * - 每种天气对应不同粒子效果和温和色调偏移
 * - 天气随游戏时间变化（每 30-60 秒切换）
 * - 色调变化温和，不产生明暗突变
 *
 * 与 DayNightWeatherSystem 互补：
 * - DayNightWeatherSystem 管理昼夜循环 + 长周期天气（5-30 分钟）
 * - WeatherSystem 管理地图场景的短周期动态天气效果（30-60 秒）
 *
 * @module games/three-kingdoms/WeatherSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 天气类型 */
export type MapWeatherType = 'sunny' | 'rain' | 'snow' | 'fog';

/** 天气粒子配置 */
export interface WeatherParticleConfig {
  /** 粒子类型标识 */
  type: 'petal' | 'rain' | 'snow' | 'fog';
  /** 每秒生成粒子数 */
  emitRate: number;
  /** 粒子下落速度（像素/秒） */
  speed: number;
  /** 粒子水平漂移速度 */
  drift: number;
  /** 粒子尺寸范围 [min, max] */
  sizeRange: [number, number];
  /** 粒子颜色（十六进制） */
  colors: number[];
  /** 粒子透明度范围 [min, max] */
  alphaRange: [number, number];
}

/** 天气色调配置 */
export interface WeatherTintConfig {
  /** 色调颜色 (0xRRGGBB) */
  color: number;
  /** 色调透明度（温和，0-0.15） */
  alpha: number;
  /** 描述 */
  description: string;
}

/** 天气系统状态快照 */
export interface WeatherSystemState {
  /** 当前天气 */
  currentWeather: MapWeatherType;
  /** 天气计时器（秒） */
  weatherTimer: number;
  /** 下次切换时间（秒） */
  nextChangeTime: number;
  /** 色调过渡进度 0-1 */
  transitionProgress: number;
  /** 上一次天气（用于过渡） */
  previousWeather: MapWeatherType;
}

// ═══════════════════════════════════════════════════════════════
// 常量配置
// ═══════════════════════════════════════════════════════════════

/** 天气切换最短时间（秒） */
const WEATHER_CHANGE_MIN = 30;

/** 天气切换最长时间（秒） */
const WEATHER_CHANGE_MAX = 60;

/** 天气过渡时间（秒）— 温和渐变 */
const TRANSITION_DURATION = 5;

/** 天气类型列表 */
const ALL_MAP_WEATHERS: MapWeatherType[] = ['sunny', 'rain', 'snow', 'fog'];

/** 各天气的色调配置 — 温和不刺眼 */
const WEATHER_TINT: Record<MapWeatherType, WeatherTintConfig> = {
  sunny: {
    color: 0xfff8e1,
    alpha: 0.04,
    description: '晴天',
  },
  rain: {
    color: 0x90a4ae,
    alpha: 0.08,
    description: '雨天',
  },
  snow: {
    color: 0xe8eaf6,
    alpha: 0.06,
    description: '雪天',
  },
  fog: {
    color: 0xb0bec5,
    alpha: 0.10,
    description: '雾天',
  },
};

/** 各天气的粒子配置 */
const WEATHER_PARTICLES: Record<MapWeatherType, WeatherParticleConfig> = {
  sunny: {
    type: 'petal',
    emitRate: 3,
    speed: 25,
    drift: 15,
    sizeRange: [2, 5],
    colors: [0xffb7c5, 0xff8fa3, 0xffccd5, 0xf48fb1],
    alphaRange: [0.3, 0.6],
  },
  rain: {
    type: 'rain',
    emitRate: 40,
    speed: 350,
    drift: 30,
    sizeRange: [1, 2],
    colors: [0x8ab4d0, 0x6a9fb5, 0xaaccee],
    alphaRange: [0.2, 0.5],
  },
  snow: {
    type: 'snow',
    emitRate: 8,
    speed: 40,
    drift: 20,
    sizeRange: [1.5, 4],
    colors: [0xffffff, 0xf0f5ff, 0xdce5f0],
    alphaRange: [0.3, 0.7],
  },
  fog: {
    type: 'fog',
    emitRate: 1,
    speed: 5,
    drift: 10,
    sizeRange: [20, 40],
    colors: [0xc0c8d0, 0xb8c0c8, 0xd0d8e0],
    alphaRange: [0.03, 0.08],
  },
};

// ═══════════════════════════════════════════════════════════════
// WeatherSystem 类
// ═══════════════════════════════════════════════════════════════

/**
 * 地图动态天气系统
 *
 * 管理地图场景的短周期天气变化和对应粒子效果。
 * 色调变化温和，不会产生明暗突变。
 */
export class WeatherSystem {
  /** 当前天气 */
  private currentWeather: MapWeatherType = 'sunny';

  /** 上一次天气（用于过渡） */
  private previousWeather: MapWeatherType = 'sunny';

  /** 天气计时器（秒） */
  private weatherTimer: number = 0;

  /** 下次切换时间（秒） */
  private nextChangeTime: number = WEATHER_CHANGE_MIN + Math.random() * (WEATHER_CHANGE_MAX - WEATHER_CHANGE_MIN);

  /** 色调过渡进度 0-1 */
  private transitionProgress: number = 1;

  /** 是否已初始化 */
  private initialized: boolean = false;

  // ─── 公共方法 ─────────────────────────────────────────────

  /**
   * 每帧更新
   * @param deltaTime 距上次更新的时间间隔（秒）
   */
  update(deltaTime: number): void {
    if (!this.initialized) {
      this.initialized = true;
    }

    const dt = Math.min(deltaTime, 0.1); // 防止长时间挂起

    // 更新天气计时器
    this.weatherTimer += dt;

    // 检查是否需要切换天气
    if (this.weatherTimer >= this.nextChangeTime) {
      this.weatherTimer = 0;
      this.nextChangeTime = WEATHER_CHANGE_MIN + Math.random() * (WEATHER_CHANGE_MAX - WEATHER_CHANGE_MIN);
      this.switchWeather();
    }

    // 更新色调过渡
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / TRANSITION_DURATION);
    }
  }

  /**
   * 获取当前天气类型
   */
  getCurrentWeather(): MapWeatherType {
    return this.currentWeather;
  }

  /**
   * 获取当前天气色调（已过渡插值）
   * @returns { color: number, alpha: number } 色调颜色和透明度
   */
  getTint(): { color: number; alpha: number } {
    const current = WEATHER_TINT[this.currentWeather];
    const previous = WEATHER_TINT[this.previousWeather];

    // 线性插值色调
    const t = this.transitionProgress;
    const color = this.lerpColor(previous.color, current.color, t);
    const alpha = previous.alpha + (current.alpha - previous.alpha) * t;

    return { color, alpha };
  }

  /**
   * 获取当前天气粒子配置
   */
  getParticleConfig(): WeatherParticleConfig {
    return WEATHER_PARTICLES[this.currentWeather];
  }

  /**
   * 获取当前天气的粒子类型标识
   */
  getParticleType(): string {
    return WEATHER_PARTICLES[this.currentWeather].type;
  }

  /**
   * 获取天气描述（中文）
   */
  getWeatherDescription(): string {
    return WEATHER_TINT[this.currentWeather].description;
  }

  /**
   * 获取天气切换剩余时间（秒）
   */
  getTimeUntilChange(): number {
    return Math.max(0, this.nextChangeTime - this.weatherTimer);
  }

  /**
   * 获取过渡进度
   */
  getTransitionProgress(): number {
    return this.transitionProgress;
  }

  /**
   * 强制设置天气（用于测试或特殊事件）
   */
  setWeather(weather: MapWeatherType): void {
    if (weather === this.currentWeather) return;
    this.previousWeather = this.currentWeather;
    this.currentWeather = weather;
    this.transitionProgress = 0;
  }

  /**
   * 获取天气状态快照
   */
  getState(): WeatherSystemState {
    return {
      currentWeather: this.currentWeather,
      weatherTimer: this.weatherTimer,
      nextChangeTime: this.nextChangeTime,
      transitionProgress: this.transitionProgress,
      previousWeather: this.previousWeather,
    };
  }

  /**
   * 序列化为普通对象
   */
  serialize(): object {
    return {
      currentWeather: this.currentWeather,
      previousWeather: this.previousWeather,
      weatherTimer: this.weatherTimer,
      nextChangeTime: this.nextChangeTime,
      transitionProgress: this.transitionProgress,
      initialized: this.initialized,
    };
  }

  /**
   * 从序列化数据恢复
   */
  deserialize(data: Record<string, unknown>): void {
    if (typeof data.currentWeather === 'string') {
      this.currentWeather = data.currentWeather as MapWeatherType;
    }
    if (typeof data.previousWeather === 'string') {
      this.previousWeather = data.previousWeather as MapWeatherType;
    }
    if (typeof data.weatherTimer === 'number') {
      this.weatherTimer = data.weatherTimer;
    }
    if (typeof data.nextChangeTime === 'number') {
      this.nextChangeTime = data.nextChangeTime;
    }
    if (typeof data.transitionProgress === 'number') {
      this.transitionProgress = data.transitionProgress;
    }
    if (typeof data.initialized === 'boolean') {
      this.initialized = data.initialized;
    }
  }

  /**
   * 重置为初始状态
   */
  reset(): void {
    this.currentWeather = 'sunny';
    this.previousWeather = 'sunny';
    this.weatherTimer = 0;
    this.nextChangeTime = WEATHER_CHANGE_MIN + Math.random() * (WEATHER_CHANGE_MAX - WEATHER_CHANGE_MIN);
    this.transitionProgress = 1;
    this.initialized = false;
  }

  /**
   * 获取所有天气类型列表
   */
  static getAllWeatherTypes(): MapWeatherType[] {
    return [...ALL_MAP_WEATHERS];
  }

  /**
   * 获取指定天气的色调配置
   */
  static getTintConfig(weather: MapWeatherType): WeatherTintConfig {
    return WEATHER_TINT[weather];
  }

  /**
   * 获取指定天气的粒子配置
   */
  static getParticleConfigFor(weather: MapWeatherType): WeatherParticleConfig {
    return WEATHER_PARTICLES[weather];
  }

  // ─── 私有方法 ─────────────────────────────────────────────

  /**
   * 切换到随机新天气（避免与当前相同）
   */
  private switchWeather(): void {
    this.previousWeather = this.currentWeather;
    this.transitionProgress = 0;

    // 随机选择不同于当前的天气
    const candidates = ALL_MAP_WEATHERS.filter(w => w !== this.currentWeather);
    this.currentWeather = candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 颜色线性插值
   * @param c1 起始颜色 (0xRRGGBB)
   * @param c2 目标颜色 (0xRRGGBB)
   * @param t 插值因子 0-1
   */
  private lerpColor(c1: number, c2: number, t: number): number {
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }
}
