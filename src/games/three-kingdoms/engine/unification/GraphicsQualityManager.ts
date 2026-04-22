/**
 * 引擎层 — 画质管理器
 *
 * 管理游戏画质设置：
 *   - 4档预设（低/中/高/自动）
 *   - 自动检测设备能力（CPU核心+内存→推荐档位）
 *   - 5项高级画质选项独立控制
 *   - 即时切换+水墨晕染过渡(0.6s)
 *   - 低端设备隐藏高级选项
 *
 * 功能覆盖：
 *   #8 画质档位 — 低/中/高/自动4档+自动检测
 *   #9 高级画质选项 — 粒子特效/实时阴影/水墨晕染/帧率限制/抗锯齿5项
 *   #10 画质切换规则 — 即时生效+水墨晕染过渡0.6s+低端设备隐藏高级选项
 *
 * @module engine/unification/GraphicsQualityManager
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  GraphicsPresetConfig,
  QualityDetectionResult,
  GraphicsChangeEvent,
} from '../../core/unification';
import { GraphicsPreset } from '../../core/settings';
import type { GraphicsSettings, AdvancedGraphicsOptions } from '../../core/settings';
import {
  HIGH_QUALITY_MIN_CPU,
  HIGH_QUALITY_MIN_MEMORY,
  MEDIUM_QUALITY_MIN_CPU,
  MEDIUM_QUALITY_MIN_MEMORY,
  INK_WASH_TRANSITION_DURATION,
} from '../../core/settings';
/// <reference path="../types/navigator.d.ts" />

// ─────────────────────────────────────────────
// 预设配置表
// ─────────────────────────────────────────────

/** 各档位预设配置 */
const PRESET_CONFIGS: Record<string, GraphicsPresetConfig> = {
  [GraphicsPreset.Low]: {
    particleEffects: false,
    realtimeShadows: false,
    inkWash: false,
    frameRateLimit: 30,
    antiAliasing: false,
    showAdvancedOptions: false, // 低端设备隐藏高级选项
  },
  [GraphicsPreset.Medium]: {
    particleEffects: true,
    realtimeShadows: false,
    inkWash: true,
    frameRateLimit: 60,
    antiAliasing: false,
    showAdvancedOptions: true,
  },
  [GraphicsPreset.High]: {
    particleEffects: true,
    realtimeShadows: true,
    inkWash: true,
    frameRateLimit: 60,
    antiAliasing: true,
    showAdvancedOptions: true,
  },
  [GraphicsPreset.Auto]: {
    // 自动模式：由检测结果决定
    particleEffects: true,
    realtimeShadows: false,
    inkWash: true,
    frameRateLimit: 60,
    antiAliasing: false,
    showAdvancedOptions: true,
  },
};

// ─────────────────────────────────────────────
// 画质管理器
// ─────────────────────────────────────────────

/**
 * 画质管理器
 *
 * 管理4档预设、自动检测、高级选项、切换过渡。
 */
export class GraphicsQualityManager implements ISubsystem {
  readonly name = 'graphicsQuality';

  private deps!: ISystemDeps;
  private currentPreset: GraphicsPreset = GraphicsPreset.Auto;
  private advanced: AdvancedGraphicsOptions;
  private detectionResult: QualityDetectionResult | null = null;
  /** 是否正在水墨过渡中 */
  private inkTransitionActive = false;
  private inkTransitionTimer = 0;
  /** 检测到的设备能力 */
  private deviceCpuCores = 4;
  private deviceMemoryGB = 4;

  constructor() {
    this.advanced = {
      particleEffects: true,
      realtimeShadows: false,
      inkWash: true,
      frameRateLimit: 60,
      antiAliasing: false,
    };
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    // 首次启动自动检测
    this.detectDeviceCapability();
  }

  update(dt: number): void {
    // 处理水墨过渡动画
    if (this.inkTransitionActive) {
      this.inkTransitionTimer += dt * 1000;
      if (this.inkTransitionTimer >= INK_WASH_TRANSITION_DURATION) {
        this.inkTransitionActive = false;
        this.inkTransitionTimer = 0;
        this.deps?.eventBus?.emit('graphics:transitionComplete', {
          preset: this.currentPreset,
        });
      }
    }
  }

  getState(): GraphicsSettings {
    return {
      preset: this.currentPreset,
      advanced: { ...this.advanced },
    };
  }

  reset(): void {
    this.currentPreset = GraphicsPreset.Auto;
    this.advanced = {
      particleEffects: true,
      realtimeShadows: false,
      inkWash: true,
      frameRateLimit: 60,
      antiAliasing: false,
    };
    this.inkTransitionActive = false;
    this.inkTransitionTimer = 0;
  }

  // ─── 设置同步 ─────────────────────────────

  /** 从 SettingsManager 同步画面设置 */
  syncGraphicsSettings(settings: GraphicsSettings): void {
    this.currentPreset = settings.preset as GraphicsPreset;
    this.advanced = { ...settings.advanced };
  }

  // ─── 画质档位 (#8) ──────────────────────

  /** 设置画质档位 */
  setPreset(preset: GraphicsPreset): GraphicsChangeEvent {
    const oldPreset = this.currentPreset;
    this.currentPreset = preset;

    // 自动模式：应用检测到的推荐配置
    if (preset === GraphicsPreset.Auto && this.detectionResult) {
      const resolved = this.detectionResult.recommendedPreset;
      this.applyPresetConfig(resolved);
    } else {
      this.applyPresetConfig(preset);
    }

    // 触发水墨过渡
    const needsTransition = oldPreset !== preset;
    if (needsTransition) {
      this.startInkTransition();
    }

    const event: GraphicsChangeEvent = {
      oldPreset,
      newPreset: preset,
      needsTransition,
    };

    this.deps?.eventBus?.emit('graphics:presetChanged', event);

    return event;
  }

  /** 获取当前档位 */
  getPreset(): GraphicsPreset {
    return this.currentPreset;
  }

  /** 获取当前档位配置 */
  getPresetConfig(): GraphicsPresetConfig {
    if (this.currentPreset === GraphicsPreset.Auto && this.detectionResult) {
      return PRESET_CONFIGS[this.detectionResult.recommendedPreset] ?? PRESET_CONFIGS[GraphicsPreset.Medium];
    }
    return PRESET_CONFIGS[this.currentPreset] ?? PRESET_CONFIGS[GraphicsPreset.Medium];
  }

  /** 获取指定档位的配置 */
  getPresetConfigFor(preset: GraphicsPreset): GraphicsPresetConfig {
    return { ...PRESET_CONFIGS[preset] };
  }

  /** 是否显示高级选项 */
  shouldShowAdvancedOptions(): boolean {
    const config = this.getPresetConfig();
    return config.showAdvancedOptions;
  }

  // ─── 自动检测 (#8) ──────────────────────

  /** 检测设备能力 */
  detectDeviceCapability(): QualityDetectionResult {
    // 模拟设备检测
    this.deviceCpuCores = navigator?.hardwareConcurrency ?? 4;
    // 内存检测（如果 API 不可用则使用默认值）
    this.deviceMemoryGB = navigator?.deviceMemory ?? 4;

    let recommendedPreset: string;
    if (
      this.deviceCpuCores >= HIGH_QUALITY_MIN_CPU &&
      this.deviceMemoryGB >= HIGH_QUALITY_MIN_MEMORY
    ) {
      recommendedPreset = GraphicsPreset.High;
    } else if (
      this.deviceCpuCores >= MEDIUM_QUALITY_MIN_CPU &&
      this.deviceMemoryGB >= MEDIUM_QUALITY_MIN_MEMORY
    ) {
      recommendedPreset = GraphicsPreset.Medium;
    } else {
      recommendedPreset = GraphicsPreset.Low;
    }

    this.detectionResult = {
      cpuCores: this.deviceCpuCores,
      memoryGB: this.deviceMemoryGB,
      recommendedPreset,
      detectedAt: Date.now(),
    };

    // 自动模式立即应用
    if (this.currentPreset === GraphicsPreset.Auto) {
      this.applyPresetConfig(recommendedPreset);
    }

    return { ...this.detectionResult };
  }

  /** 获取检测结果 */
  getDetectionResult(): QualityDetectionResult | null {
    return this.detectionResult ? { ...this.detectionResult } : null;
  }

  /** 获取推荐档位 */
  getRecommendedPreset(): GraphicsPreset {
    if (this.detectionResult) {
      return this.detectionResult.recommendedPreset as GraphicsPreset;
    }
    return GraphicsPreset.Medium;
  }

  // ─── 高级画质选项 (#9) ──────────────────

  /** 设置粒子特效 */
  setParticleEffects(enabled: boolean): void {
    this.advanced.particleEffects = enabled;
    this.emitAdvancedChange('particleEffects', enabled);
  }

  /** 设置实时阴影 */
  setRealtimeShadows(enabled: boolean): void {
    this.advanced.realtimeShadows = enabled;
    this.emitAdvancedChange('realtimeShadows', enabled);
  }

  /** 设置水墨晕染 */
  setInkWash(enabled: boolean): void {
    this.advanced.inkWash = enabled;
    this.emitAdvancedChange('inkWash', enabled);
  }

  /** 设置帧率限制 */
  setFrameRateLimit(fps: number): void {
    const valid = [30, 60].includes(fps) ? fps : 60;
    this.advanced.frameRateLimit = valid;
    this.emitAdvancedChange('frameRateLimit', valid);
  }

  /** 设置抗锯齿 */
  setAntiAliasing(enabled: boolean): void {
    this.advanced.antiAliasing = enabled;
    this.emitAdvancedChange('antiAliasing', enabled);
  }

  /** 批量设置高级选项 */
  setAdvancedOptions(options: Partial<AdvancedGraphicsOptions>): void {
    Object.assign(this.advanced, options);
    this.deps?.eventBus?.emit('graphics:advancedChanged', { ...this.advanced });
  }

  /** 获取高级选项 */
  getAdvancedOptions(): AdvancedGraphicsOptions {
    return { ...this.advanced };
  }

  // ─── 水墨过渡 (#10) ──────────────────────

  /** 是否正在水墨过渡中 */
  isInkTransitionActive(): boolean {
    return this.inkTransitionActive;
  }

  /** 获取水墨过渡进度 (0~1) */
  getInkTransitionProgress(): number {
    if (!this.inkTransitionActive) return 1;
    return Math.min(1, this.inkTransitionTimer / INK_WASH_TRANSITION_DURATION);
  }

  /** 获取水墨过渡时长 */
  getInkTransitionDuration(): number {
    return INK_WASH_TRANSITION_DURATION;
  }

  // ─── 内部方法 ────────────────────────────

  /** 应用预设配置到高级选项 */
  private applyPresetConfig(preset: string): void {
    const config = PRESET_CONFIGS[preset];
    if (!config) return;

    this.advanced = {
      particleEffects: config.particleEffects,
      realtimeShadows: config.realtimeShadows,
      inkWash: config.inkWash,
      frameRateLimit: config.frameRateLimit,
      antiAliasing: config.antiAliasing,
    };
  }

  /** 开始水墨过渡 */
  private startInkTransition(): void {
    this.inkTransitionActive = true;
    this.inkTransitionTimer = 0;
  }

  /** 发布高级选项变更事件 */
  private emitAdvancedChange(key: string, value: boolean | number): void {
    this.deps?.eventBus?.emit('graphics:advancedChanged', {
      key,
      value,
      advanced: { ...this.advanced },
    });
  }
}
