/**
 * 设置管理器
 *
 * v19.0 设置系统的核心管理器，职责：
 * - 4大分类(基础/音效/画面/账号) + 动画设置的统一管理
 * - 设置持久化到 localStorage
 * - 设置变更通知
 * - 恢复默认设置
 * - 云端同步冲突解决
 *
 * @module engine/settings/SettingsManager
 */

import {
  SettingsCategory,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SAVE_VERSION,
  VOLUME_MIN,
  VOLUME_MAX,
  VOLUME_STEP,
} from '../../core/settings';
import type {
  SettingsChangeEvent,
  BasicSettings,
  AudioSettings,
  GraphicsSettings,
  AccountSettings,
  AnimationSettings,
  AllSettings,
  SettingsSaveData,
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
// 类型
// ─────────────────────────────────────────────

/** 设置变更回调 */
export type SettingsChangeCallback = (event: SettingsChangeEvent) => void;

/** 存储适配器接口（便于测试） */
export interface ISettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ─────────────────────────────────────────────
// 设置管理器
// ─────────────────────────────────────────────

/**
 * 设置管理器
 *
 * 管理游戏所有设置项，提供读写、持久化、变更通知能力。
 *
 * @example
 * ```ts
 * const mgr = new SettingsManager();
 * mgr.initialize();
 *
 * // 读取
 * const vol = mgr.getAudioSettings().masterVolume;
 *
 * // 修改
 * mgr.updateAudioSettings({ masterVolume: 50 });
 *
 * // 监听变更
 * mgr.onChange((evt) => console.log(evt));
 * ```
 */
export class SettingsManager {
  private settings: AllSettings;
  private storage: ISettingsStorage;
  private listeners: SettingsChangeCallback[] = [];
  private initialized = false;

  constructor(storage?: ISettingsStorage) {
    this.settings = createDefaultAllSettings();
    this.storage = storage ?? SettingsManager.createDefaultStorage();
  }

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化设置管理器
   *
   * 从持久化存储加载设置，如果没有存储则使用默认值。
   */
  initialize(): void {
    if (this.initialized) return;
    this.loadFromStorage();
    this.initialized = true;
  }

  /** 是否已初始化 */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ─────────────────────────────────────────
  // 读取设置
  // ─────────────────────────────────────────

  /** 获取所有设置（只读副本） */
  getAllSettings(): Readonly<AllSettings> {
    return this.settings;
  }

  /** 获取基础设置 */
  getBasicSettings(): Readonly<BasicSettings> {
    return this.settings.basic;
  }

  /** 获取音效设置 */
  getAudioSettings(): Readonly<AudioSettings> {
    return this.settings.audio;
  }

  /** 获取画面设置 */
  getGraphicsSettings(): Readonly<GraphicsSettings> {
    return this.settings.graphics;
  }

  /** 获取账号设置 */
  getAccountSettings(): Readonly<AccountSettings> {
    return this.settings.account;
  }

  /** 获取动画设置 */
  getAnimationSettings(): Readonly<AnimationSettings> {
    return this.settings.animation;
  }

  // ─────────────────────────────────────────
  // 更新设置
  // ─────────────────────────────────────────

  /**
   * 更新基础设置
   *
   * 合并传入的部分设置到当前设置中，自动持久化并通知变更。
   */
  updateBasicSettings(partial: Partial<BasicSettings>): void {
    this.applyUpdate(
      SettingsCategory.Basic,
      'basic',
      { ...this.settings.basic, ...partial },
    );
  }

  /**
   * 更新音效设置
   *
   * 合并传入的部分设置到当前设置中，自动持久化并通知变更。
   * 音量值会被 clamp 到 [0, 100] 范围。
   */
  updateAudioSettings(partial: Partial<AudioSettings>): void {
    const merged = { ...this.settings.audio, ...partial };
    // Clamp 音量值
    merged.masterVolume = this.clampVolume(merged.masterVolume);
    merged.bgmVolume = this.clampVolume(merged.bgmVolume);
    merged.sfxVolume = this.clampVolume(merged.sfxVolume);
    merged.voiceVolume = this.clampVolume(merged.voiceVolume);
    this.applyUpdate(SettingsCategory.Audio, 'audio', merged);
  }

  /**
   * 更新画面设置
   */
  updateGraphicsSettings(partial: Partial<GraphicsSettings>): void {
    const merged = { ...this.settings.graphics, ...partial };
    if (partial.advanced) {
      merged.advanced = { ...this.settings.graphics.advanced, ...partial.advanced };
    }
    this.applyUpdate(SettingsCategory.Graphics, 'graphics', merged);
  }

  /**
   * 更新账号设置
   */
  updateAccountSettings(partial: Partial<AccountSettings>): void {
    this.applyUpdate(
      SettingsCategory.Account,
      'account',
      { ...this.settings.account, ...partial },
    );
  }

  /**
   * 更新动画设置
   */
  updateAnimationSettings(partial: Partial<AnimationSettings>): void {
    this.applyUpdate(
      SettingsCategory.Animation,
      'animation',
      { ...this.settings.animation, ...partial },
    );
  }

  /**
   * 设置单个设置项
   *
   * 通过分类和键路径精确设置某个值。
   */
  setSetting<K extends keyof AllSettings>(
    category: SettingsCategory,
    key: K,
    value: AllSettings[K],
  ): void {
    const oldValue = this.settings[key];
    this.settings = { ...this.settings, [key]: value, lastModifiedAt: Date.now() };
    this.saveToStorage();
    this.notifyListeners({
      category,
      key: key as string,
      oldValue,
      newValue: value,
      timestamp: Date.now(),
    });
  }

  // ─────────────────────────────────────────
  // 音量快捷操作
  // ─────────────────────────────────────────

  /**
   * 计算实际音量
   *
   * 实际输出 = 分类音量 × 主音量 / 100
   *
   * @param channelVolume 分类音量 (0~100)
   * @returns 实际输出音量 (0~1)
   */
  calculateEffectiveVolume(channelVolume: number): number {
    if (!this.settings.audio.masterSwitch) return 0;
    return (channelVolume / 100) * (this.settings.audio.masterVolume / 100);
  }

  /**
   * 调整音量（按步进值）
   *
   * @param key - 音量设置键
   * @param direction - 1 增加 / -1 减少
   */
  adjustVolume(key: keyof Pick<AudioSettings, 'masterVolume' | 'bgmVolume' | 'sfxVolume' | 'voiceVolume'>, direction: 1 | -1): void {
    const current = this.settings.audio[key];
    const next = this.clampVolume(current + direction * VOLUME_STEP);
    this.updateAudioSettings({ [key]: next });
  }

  // ─────────────────────────────────────────
  // 恢复默认
  // ─────────────────────────────────────────

  /**
   * 恢复指定分类的默认设置
   */
  resetCategory(category: SettingsCategory): void {
    switch (category) {
      case SettingsCategory.Basic:
        this.applyUpdate(category, 'basic', createDefaultBasicSettings());
        break;
      case SettingsCategory.Audio:
        this.applyUpdate(category, 'audio', createDefaultAudioSettings());
        break;
      case SettingsCategory.Graphics:
        this.applyUpdate(category, 'graphics', createDefaultGraphicsSettings());
        break;
      case SettingsCategory.Account:
        this.applyUpdate(category, 'account', createDefaultAccountSettings());
        break;
      case SettingsCategory.Animation:
        this.applyUpdate(category, 'animation', createDefaultAnimationSettings());
        break;
    }
  }

  /**
   * 恢复所有设置为默认值
   */
  resetAll(): void {
    this.settings = createDefaultAllSettings();
    this.saveToStorage();
    // 通知所有分类
    Object.values(SettingsCategory).forEach((cat) => {
      this.notifyListeners({
        category: cat,
        key: 'all',
        oldValue: null,
        newValue: null,
        timestamp: Date.now(),
      });
    });
  }

  // ─────────────────────────────────────────
  // 持久化
  // ─────────────────────────────────────────

  /**
   * 获取设置序列化数据
   *
   * 用于云存档同步和导入导出。
   */
  getSaveData(): SettingsSaveData {
    return {
      version: SETTINGS_SAVE_VERSION,
      settings: { ...this.settings },
    };
  }

  /**
   * 从序列化数据恢复设置
   *
   * 用于云存档恢复和导入。
   *
   * @returns 是否恢复成功
   */
  restoreFromSaveData(data: SettingsSaveData): boolean {
    try {
      if (!data || !data.settings) return false;
      // 简单版本兼容：如果版本不同，保留默认值并合并已有字段
      this.settings = { ...createDefaultAllSettings(), ...data.settings };
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 合并远程设置（冲突解决）
   *
   * @param remoteData - 远程设置数据
   * @param remoteTimestamp - 远程修改时间
   */
  mergeRemoteSettings(remoteData: AllSettings, remoteTimestamp: number): void {
    if (remoteTimestamp > this.settings.lastModifiedAt) {
      this.settings = { ...remoteData };
      this.saveToStorage();
    }
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册设置变更回调
   *
   * @returns 取消注册的函数
   */
  onChange(callback: SettingsChangeCallback): () => void {
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
  // 内部方法
  // ─────────────────────────────────────────

  /** 应用更新并持久化 */
  private applyUpdate(
    category: SettingsCategory,
    key: string,
    newValue: unknown,
  ): void {
    const oldValue = (this.settings as unknown as Record<string, unknown>)[key];
    this.settings = {
      ...this.settings,
      [key]: newValue,
      lastModifiedAt: Date.now(),
    };
    this.saveToStorage();
    this.notifyListeners({
      category,
      key,
      oldValue,
      newValue,
      timestamp: Date.now(),
    });
  }

  /** 通知所有监听器 */
  private notifyListeners(event: SettingsChangeEvent): void {
    for (const cb of this.listeners) {
      try {
        cb(event);
      } catch {
        // 监听器错误不阻断其他监听器
      }
    }
  }

  /** 从存储加载 */
  private loadFromStorage(): void {
    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const data: SettingsSaveData = JSON.parse(raw);
      if (data.settings) {
        this.settings = { ...createDefaultAllSettings(), ...data.settings };
      }
    } catch {
      // 解析失败，使用默认值
    }
  }

  /** 保存到存储 */
  private saveToStorage(): void {
    try {
      const data: SettingsSaveData = {
        version: SETTINGS_SAVE_VERSION,
        settings: this.settings,
      };
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 存储空间不足等，静默失败
    }
  }

  /** 音量 clamp */
  private clampVolume(value: number): number {
    return Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, value));
  }

  /** 创建默认存储适配器 */
  private static createDefaultStorage(): ISettingsStorage {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    // 测试/SSR 环境回退
    const store: Record<string, string> = {};
    return {
      getItem: (key) => store[key] ?? null,
      setItem: (key, val) => { store[key] = val; },
      removeItem: (key) => { delete store[key]; },
    };
  }
}
