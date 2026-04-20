/**
 * 画面设置管理器
 *
 * v19.0 画质管理器，职责：
 * - 4档画质预设 (低/中/高/自动)
 * - 自动检测设备能力并推荐画质
 * - 5项高级画质选项独立控制
 * - 画质即时切换
 *
 * @module engine/settings/GraphicsManager
 */

import { GraphicsPreset } from '../../core/settings';
import type {
  AdvancedGraphicsOptions,
  DeviceCapability,
  GraphicsSettings,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 画质预设配置 */
export interface PresetConfig {
  /** 粒子特效 */
  particleEffects: boolean;
  /** 实时阴影 */
  realtimeShadows: boolean;
  /** 水墨晕染 */
  inkWash: boolean;
  /** 帧率限制 */
  frameRateLimit: number;
  /** 抗锯齿 */
  antiAliasing: boolean;
}

/** 画质变更回调 */
export type GraphicsChangeCallback = (
  settings: Readonly<GraphicsSettings>,
) => void;

// ─────────────────────────────────────────────
// 预设配置表
// ─────────────────────────────────────────────

/** 各档位预设配置 */
const PRESET_CONFIGS: Record<GraphicsPreset, PresetConfig> = {
  [GraphicsPreset.Low]: {
    particleEffects: false,
    realtimeShadows: false,
    inkWash: false,
    frameRateLimit: 30,
    antiAliasing: false,
  },
  [GraphicsPreset.Medium]: {
    particleEffects: true,
    realtimeShadows: false,
    inkWash: true,
    frameRateLimit: 60,
    antiAliasing: false,
  },
  [GraphicsPreset.High]: {
    particleEffects: true,
    realtimeShadows: true,
    inkWash: true,
    frameRateLimit: 60,
    antiAliasing: true,
  },
  [GraphicsPreset.Auto]: {
    // Auto 由 detectBestPreset() 决定
    particleEffects: true,
    realtimeShadows: false,
    inkWash: true,
    frameRateLimit: 60,
    antiAliasing: false,
  },
};

// ─────────────────────────────────────────────
// 画面管理器
// ─────────────────────────────────────────────

/**
 * 画面设置管理器
 *
 * 管理画质档位切换和高级选项。
 *
 * @example
 * ```ts
 * const gfx = new GraphicsManager();
 *
 * // 自动检测
 * const recommended = gfx.detectBestPreset();
 *
 * // 切换画质
 * gfx.applyPreset(GraphicsPreset.High);
 *
 * // 独立修改高级选项
 * gfx.setAdvancedOption('particleEffects', false);
 * ```
 */
export class GraphicsManager {
  private settings: GraphicsSettings;
  private detectedPreset: GraphicsPreset | null = null;
  private listeners: GraphicsChangeCallback[] = [];

  constructor() {
    // 默认值在 initialize 或 applySettings 时设置
    this.settings = {
      preset: GraphicsPreset.Auto,
      advanced: { ...PRESET_CONFIGS[GraphicsPreset.Auto] },
    };
  }

  // ─────────────────────────────────────────
  // 初始化 & 设置
  // ─────────────────────────────────────────

  /**
   * 应用画面设置
   */
  applySettings(settings: GraphicsSettings): void {
    this.settings = {
      preset: settings.preset,
      advanced: { ...settings.advanced },
    };
    if (settings.preset === GraphicsPreset.Auto) {
      this.detectedPreset = this.detectBestPreset();
      this.settings.advanced = { ...PRESET_CONFIGS[this.detectedPreset] };
    }
  }

  /** 获取当前画面设置 */
  getSettings(): Readonly<GraphicsSettings> {
    return this.settings;
  }

  // ─────────────────────────────────────────
  // 自动检测
  // ─────────────────────────────────────────

  /**
   * 检测设备能力
   *
   * 模拟检测 CPU 核心数和内存大小。
   * 在浏览器环境中使用 navigator.hardwareConcurrency 和
   * navigator.deviceMemory（如果可用）。
   */
  detectDeviceCapability(): DeviceCapability {
    const cpuCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
    const memoryGB = typeof navigator !== 'undefined' && (navigator as any).deviceMemory
      ? (navigator as any).deviceMemory
      : 4;
    return { cpuCores, memoryGB };
  }

  /**
   * 检测推荐画质档位
   *
   * 规则：
   * - CPU≥8核 + 内存≥8GB → 高画质
   * - CPU≥4核 + 内存≥4GB → 中画质
   * - 其他 → 低画质
   */
  detectBestPreset(capability?: DeviceCapability): GraphicsPreset {
    const cap = capability ?? this.detectDeviceCapability();
    if (cap.cpuCores >= 8 && cap.memoryGB >= 8) {
      return GraphicsPreset.High;
    }
    if (cap.cpuCores >= 4 && cap.memoryGB >= 4) {
      return GraphicsPreset.Medium;
    }
    return GraphicsPreset.Low;
  }

  /** 获取检测到的预设（仅 Auto 模式有效） */
  getDetectedPreset(): GraphicsPreset | null {
    return this.detectedPreset;
  }

  // ─────────────────────────────────────────
  // 画质切换
  // ─────────────────────────────────────────

  /**
   * 应用画质预设
   *
   * 切换预设时，高级选项会被重置为预设默认值。
   * Auto 模式会自动检测并应用推荐档位。
   */
  applyPreset(preset: GraphicsPreset): void {
    if (preset === GraphicsPreset.Auto) {
      this.detectedPreset = this.detectBestPreset();
      this.settings = {
        preset: GraphicsPreset.Auto,
        advanced: { ...PRESET_CONFIGS[this.detectedPreset] },
      };
    } else {
      this.settings = {
        preset,
        advanced: { ...PRESET_CONFIGS[preset] },
      };
    }
    this.notifyListeners();
  }

  /**
   * 设置高级选项
   *
   * 独立控制单个高级画质选项。
   */
  setAdvancedOption<K extends keyof AdvancedGraphicsOptions>(
    key: K,
    value: AdvancedGraphicsOptions[K],
  ): void {
    this.settings = {
      ...this.settings,
      advanced: { ...this.settings.advanced, [key]: value },
    };
    this.notifyListeners();
  }

  /**
   * 批量更新高级选项
   */
  updateAdvancedOptions(partial: Partial<AdvancedGraphicsOptions>): void {
    this.settings = {
      ...this.settings,
      advanced: { ...this.settings.advanced, ...partial },
    };
    this.notifyListeners();
  }

  // ─────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────

  /** 是否为低画质模式 */
  isLowQuality(): boolean {
    if (this.settings.preset === GraphicsPreset.Low) return true;
    if (this.settings.preset === GraphicsPreset.Auto && this.detectedPreset === GraphicsPreset.Low) {
      return true;
    }
    return false;
  }

  /** 是否为高画质模式 */
  isHighQuality(): boolean {
    if (this.settings.preset === GraphicsPreset.High) return true;
    if (this.settings.preset === GraphicsPreset.Auto && this.detectedPreset === GraphicsPreset.High) {
      return true;
    }
    return false;
  }

  /** 获取当前生效的高级选项 */
  getEffectiveOptions(): Readonly<AdvancedGraphicsOptions> {
    return this.settings.advanced;
  }

  /** 获取预设配置 */
  getPresetConfig(preset: GraphicsPreset): Readonly<PresetConfig> {
    return PRESET_CONFIGS[preset];
  }

  /** 是否显示高级选项（低端设备隐藏） */
  shouldShowAdvancedOptions(): boolean {
    return !this.isLowQuality();
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册画质变更回调
   * @returns 取消注册函数
   */
  onChange(callback: GraphicsChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** 移除所有监听器 */
  removeAllListeners(): void {
    this.listeners = [];
  }

  // ─────────────────────────────────────────
  // 内部
  // ─────────────────────────────────────────

  private notifyListeners(): void {
    for (const cb of this.listeners) {
      try {
        cb(this.settings);
      } catch {
        // 不阻断
      }
    }
  }
}
