/**
 * 引擎层 — 设置管理器
 *
 * 统一管理4大分类设置（基础/音效/画面/账号）+ 动画配置：
 *   - 设置项的读写（getter/setter）
 *   - 设置变更事件发布
 *   - 持久化（localStorage 读写）
 *   - 恢复默认（按分类重置）
 *   - 云端同步时间戳管理
 *
 * 功能覆盖：
 *   #16 设置持久化 — 修改后立即保存本地 + 随云存档同步 + 冲突取最新时间
 *   #17 恢复默认 — 重置当前分类所有设置项
 *
 * @module engine/unification/SettingsManager
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AllSettings,
  BasicSettings,
  AudioSettings,
  GraphicsSettings,
  AccountSettings,
  AnimationSettings,
  SettingsChangeEvent,
  SettingsSaveData,
} from '../../core/settings';
import {
  SettingsCategory,
  SETTINGS_SAVE_VERSION,
  SETTINGS_STORAGE_KEY,
} from '../../core/settings';
import {
  createDefaultAllSettings,
  createDefaultBasicSettings,
  createDefaultAudioSettings,
  createDefaultGraphicsSettings,
  createDefaultAccountSettings,
  createDefaultAnimationSettings,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 设置管理器
// ─────────────────────────────────────────────

/**
 * 设置管理器
 *
 * 管理所有游戏设置，提供统一的读写接口。
 * 修改设置后自动持久化到 localStorage，并发布变更事件。
 */
export class SettingsManager implements ISubsystem {
  readonly name = 'settings';

  private deps!: ISystemDeps;
  private settings: AllSettings;
  /** 是否已加载过持久化数据 */
  private loaded = false;

  constructor() {
    this.settings = createDefaultAllSettings();
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadFromStorage();
  }

  update(_dt: number): void {
    // 设置管理器无 tick 逻辑，由外部调用驱动
  }

  getState(): AllSettings {
    return this.getAllSettings();
  }

  reset(): void {
    this.settings = createDefaultAllSettings();
    this.saveToStorage();
  }

  // ─── 读取 ────────────────────────────────

  /** 获取完整设置 */
  getAllSettings(): AllSettings {
    return { ...this.settings };
  }

  /** 获取基础设置 */
  getBasicSettings(): BasicSettings {
    return { ...this.settings.basic };
  }

  /** 获取音效设置 */
  getAudioSettings(): AudioSettings {
    return { ...this.settings.audio };
  }

  /** 获取画面设置 */
  getGraphicsSettings(): GraphicsSettings {
    return { ...this.settings.graphics };
  }

  /** 获取账号设置 */
  getAccountSettings(): AccountSettings {
    return { ...this.settings.account };
  }

  /** 获取动画设置 */
  getAnimationSettings(): AnimationSettings {
    return {
      ...this.settings.animation,
      transitions: { ...this.settings.animation.transitions },
      stateAnimations: { ...this.settings.animation.stateAnimations },
      feedbackAnimations: { ...this.settings.animation.feedbackAnimations },
    };
  }

  /** 获取最后修改时间 */
  getLastModifiedAt(): number {
    return this.settings.lastModifiedAt;
  }

  // ─── 基础设置写入 (#1 语言, #2 时区, #3 通知) ──

  /** 设置语言 (#1) */
  setLanguage(language: string, followSystem: boolean): void {
    const old = this.settings.basic.language;
    this.settings.basic.language = language as any;
    this.settings.basic.languageFollowSystem = followSystem;
    this.emitChange(SettingsCategory.Basic, 'language', old, language);
    this.persist();
  }

  /** 设置时区 (#2) */
  setTimezone(offset: number, followDevice: boolean): void {
    const clamped = Math.max(-12, Math.min(14, offset));
    const old = this.settings.basic.timezone;
    this.settings.basic.timezone = clamped;
    this.settings.basic.timezoneFollowDevice = followDevice;
    this.emitChange(SettingsCategory.Basic, 'timezone', old, clamped);
    this.persist();
  }

  /** 设置通知总开关 (#3) */
  setNotificationEnabled(enabled: boolean): void {
    const old = this.settings.basic.notificationEnabled;
    this.settings.basic.notificationEnabled = enabled;
    this.emitChange(SettingsCategory.Basic, 'notificationEnabled', old, enabled);
    this.persist();
  }

  /** 设置单项通知开关 (#3) */
  setNotificationFlag(type: string, enabled: boolean): void {
    const key = type as keyof typeof this.settings.basic.notificationFlags;
    const old = this.settings.basic.notificationFlags[key];
    this.settings.basic.notificationFlags[key] = enabled;
    this.emitChange(SettingsCategory.Basic, `notificationFlags.${type}`, old, enabled);
    this.persist();
  }

  // ─── 音效设置写入 (#4 音量, #5 计算, #6 开关) ──

  /** 设置主音量 (#4) */
  setMasterVolume(volume: number): void {
    const clamped = this.clampVolume(volume);
    const old = this.settings.audio.masterVolume;
    this.settings.audio.masterVolume = clamped;
    this.emitChange(SettingsCategory.Audio, 'masterVolume', old, clamped);
    this.persist();
  }

  /** 设置BGM音量 (#4) */
  setBgmVolume(volume: number): void {
    const clamped = this.clampVolume(volume);
    const old = this.settings.audio.bgmVolume;
    this.settings.audio.bgmVolume = clamped;
    this.emitChange(SettingsCategory.Audio, 'bgmVolume', old, clamped);
    this.persist();
  }

  /** 设置音效音量 (#4) */
  setSfxVolume(volume: number): void {
    const clamped = this.clampVolume(volume);
    const old = this.settings.audio.sfxVolume;
    this.settings.audio.sfxVolume = clamped;
    this.emitChange(SettingsCategory.Audio, 'sfxVolume', old, clamped);
    this.persist();
  }

  /** 设置语音音量 (#4) */
  setVoiceVolume(volume: number): void {
    const clamped = this.clampVolume(volume);
    const old = this.settings.audio.voiceVolume;
    this.settings.audio.voiceVolume = clamped;
    this.emitChange(SettingsCategory.Audio, 'voiceVolume', old, clamped);
    this.persist();
  }

  /** 设置音效总开关 (#6) */
  setMasterSwitch(enabled: boolean): void {
    const old = this.settings.audio.masterSwitch;
    this.settings.audio.masterSwitch = enabled;
    this.emitChange(SettingsCategory.Audio, 'masterSwitch', old, enabled);
    this.persist();
  }

  /** 设置BGM开关 (#6) */
  setBgmSwitch(enabled: boolean): void {
    const old = this.settings.audio.bgmSwitch;
    this.settings.audio.bgmSwitch = enabled;
    this.emitChange(SettingsCategory.Audio, 'bgmSwitch', old, enabled);
    this.persist();
  }

  /** 设置语音开关 (#6) */
  setVoiceSwitch(enabled: boolean): void {
    const old = this.settings.audio.voiceSwitch;
    this.settings.audio.voiceSwitch = enabled;
    this.emitChange(SettingsCategory.Audio, 'voiceSwitch', old, enabled);
    this.persist();
  }

  /** 设置战斗音效开关 (#6) */
  setBattleSfxSwitch(enabled: boolean): void {
    const old = this.settings.audio.battleSfxSwitch;
    this.settings.audio.battleSfxSwitch = enabled;
    this.emitChange(SettingsCategory.Audio, 'battleSfxSwitch', old, enabled);
    this.persist();
  }

  // ─── 画面设置写入 (#8 画质档位, #9 高级选项) ──

  /** 设置画质档位 (#8) */
  setGraphicsPreset(preset: string): void {
    const old = this.settings.graphics.preset;
    this.settings.graphics.preset = preset as any;
    this.emitChange(SettingsCategory.Graphics, 'preset', old, preset);
    this.persist();
  }

  /** 设置高级画质选项 (#9) */
  setAdvancedOption(key: string, value: boolean | number): void {
    const old = (this.settings.graphics.advanced as any)[key];
    (this.settings.graphics.advanced as any)[key] = value;
    this.emitChange(SettingsCategory.Graphics, `advanced.${key}`, old, value);
    this.persist();
  }

  /** 批量设置高级画质选项 (#9) */
  setAdvancedOptions(options: Record<string, boolean | number>): void {
    for (const [key, value] of Object.entries(options)) {
      (this.settings.graphics.advanced as any)[key] = value;
    }
    this.emitChange(SettingsCategory.Graphics, 'advanced', null, options);
    this.persist();
  }

  // ─── 动画设置写入 (#18, #19, #20) ──

  /** 设置动画总开关 */
  setAnimationEnabled(enabled: boolean): void {
    const old = this.settings.animation.enabled;
    this.settings.animation.enabled = enabled;
    this.emitChange(SettingsCategory.Animation, 'enabled', old, enabled);
    this.persist();
  }

  // ─── 恢复默认 (#17) ─────────────────────

  /** 恢复指定分类的默认设置 */
  resetCategory(category: SettingsCategory): void {
    switch (category) {
      case SettingsCategory.Basic:
        this.settings.basic = createDefaultBasicSettings();
        break;
      case SettingsCategory.Audio:
        this.settings.audio = createDefaultAudioSettings();
        break;
      case SettingsCategory.Graphics:
        this.settings.graphics = createDefaultGraphicsSettings();
        break;
      case SettingsCategory.Account:
        this.settings.account = createDefaultAccountSettings();
        break;
      case SettingsCategory.Animation:
        this.settings.animation = createDefaultAnimationSettings();
        break;
    }
    this.emitChange(category, '__reset__', null, null);
    this.persist();
  }

  // ─── 持久化 (#16) ───────────────────────

  /** 保存到 localStorage */
  saveToStorage(): void {
    try {
      const data: SettingsSaveData = {
        version: SETTINGS_SAVE_VERSION,
        settings: this.settings,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage 不可用时静默失败
    }
  }

  /** 从 localStorage 加载 */
  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const data: SettingsSaveData = JSON.parse(raw);
      if (data.version === SETTINGS_SAVE_VERSION && data.settings) {
        this.settings = data.settings;
        this.loaded = true;
      }
    } catch {
      // 解析失败时使用默认值
    }
  }

  /** 是否已加载持久化数据 */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** 导出设置数据（用于云同步） */
  exportData(): SettingsSaveData {
    return {
      version: SETTINGS_SAVE_VERSION,
      settings: { ...this.settings },
    };
  }

  /** 导入设置数据（用于云同步恢复） */
  importData(data: SettingsSaveData): void {
    if (data.version === SETTINGS_SAVE_VERSION && data.settings) {
      // 冲突策略：取最新时间戳
      if (data.settings.lastModifiedAt >= this.settings.lastModifiedAt) {
        this.settings = data.settings;
        this.saveToStorage();
        this.emitChange(SettingsCategory.Basic, '__import__', null, null);
      }
    }
  }

  // ─── 内部方法 ────────────────────────────

  /** 发布设置变更事件 */
  private emitChange(
    category: SettingsCategory,
    key: string,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    this.settings.lastModifiedAt = Date.now();
    const event: SettingsChangeEvent = {
      category,
      key,
      oldValue,
      newValue,
      timestamp: Date.now(),
    };
    this.deps?.eventBus?.emit('settings:changed', event);
  }

  /** 持久化（修改后立即保存） */
  private persist(): void {
    this.saveToStorage();
  }

  /** 音量值钳位 0~100 */
  private clampVolume(v: number): number {
    return Math.max(0, Math.min(100, v));
  }
}
