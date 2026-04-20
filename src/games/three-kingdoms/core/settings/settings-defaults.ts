/**
 * 设置系统 — 默认值配置
 *
 * v19.0 各分类设置的默认值，用于：
 * - 首次启动初始化
 * - 恢复默认设置
 * - 设置项缺失时的回退值
 *
 * @module core/settings/settings-defaults
 */

import {
  Language,
  NotificationType,
  GraphicsPreset,
  CloudSyncFrequency,
  ConflictStrategy,
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
} from './settings.types';
import type {
  BasicSettings,
  AudioSettings,
  GraphicsSettings,
  AccountSettings,
  AnimationSettings,
  AnimationConfig,
  AllSettings,
} from './settings.types';

// ─────────────────────────────────────────────
// 默认值常量
// ─────────────────────────────────────────────

/** 设置存储版本 */
export const SETTINGS_SAVE_VERSION = '19.0.0';

/** localStorage 存储键 */
export const SETTINGS_STORAGE_KEY = 'three-kingdoms-settings';

/** 音量步进值 */
export const VOLUME_STEP = 5;

/** 最小音量 */
export const VOLUME_MIN = 0;

/** 最大音量 */
export const VOLUME_MAX = 100;

/** 最大设备数 */
export const MAX_DEVICES = 5;

/** 免费存档槽位数 */
export const FREE_SAVE_SLOTS = 3;

/** 付费存档槽位数 */
export const PAID_SAVE_SLOTS = 1;

/** 总槽位数 */
export const TOTAL_SAVE_SLOTS = FREE_SAVE_SLOTS + PAID_SAVE_SLOTS;

/** 自动存档间隔 (ms) */
export const AUTO_SAVE_INTERVAL = 15 * 60 * 1000; // 15分钟

/** 付费槽位价格 (元宝) */
export const PAID_SLOT_PRICE = 200;

/** 首次绑定奖励 (元宝) */
export const FIRST_BIND_REWARD = 50;

/** 账号删除冷静期 (天) */
export const ACCOUNT_DELETE_COOLDOWN_DAYS = 7;

/** 设备解绑冷却 (小时) */
export const DEVICE_UNBIND_COOLDOWN_HOURS = 24;

// ─────────────────────────────────────────────
// 动画默认配置
// ─────────────────────────────────────────────

/** 过渡动画默认配置 */
const DEFAULT_TRANSITION_CONFIGS: Record<TransitionType, AnimationConfig> = {
  [TransitionType.PanelOpen]:     { duration: 300, easing: EasingType.EaseOut },
  [TransitionType.PanelClose]:    { duration: 200, easing: EasingType.EaseIn },
  [TransitionType.TabSwitch]:     { duration: 200, easing: EasingType.EaseInOut },
  [TransitionType.PageTransition]: { duration: 500, easing: EasingType.Linear },
  [TransitionType.PopupAppear]:   { duration: 250, easing: EasingType.Spring },
  [TransitionType.SceneSwitch]:   { duration: 800, easing: EasingType.Linear },
};

/** 状态动画默认配置 */
const DEFAULT_STATE_ANIMATION_CONFIGS: Record<StateAnimationType, AnimationConfig> = {
  [StateAnimationType.ButtonHover]:    { duration: 150, easing: EasingType.EaseOut },
  [StateAnimationType.ButtonPress]:    { duration: 80,  easing: EasingType.EaseIn },
  [StateAnimationType.ButtonRelease]:  { duration: 120, easing: EasingType.EaseOut },
  [StateAnimationType.ToggleSwitch]:   { duration: 200, easing: EasingType.EaseInOut },
  [StateAnimationType.CardSelect]:     { duration: 200, easing: EasingType.EaseOut },
};

/** 反馈动画默认配置 */
const DEFAULT_FEEDBACK_ANIMATION_CONFIGS: Record<FeedbackAnimationType, AnimationConfig> = {
  [FeedbackAnimationType.ResourceFloat]: { duration: 800,  easing: EasingType.EaseOut },
  [FeedbackAnimationType.LevelUpGlow]:   { duration: 1000, easing: EasingType.EaseOut },
  [FeedbackAnimationType.ToastSlideIn]:  { duration: 300,  easing: EasingType.EaseOut },
  [FeedbackAnimationType.BattleResult]:  { duration: 300,  easing: EasingType.EaseInOut },
};

// ─────────────────────────────────────────────
// 各分类默认值工厂
// ─────────────────────────────────────────────

/** 创建默认基础设置 */
export function createDefaultBasicSettings(): BasicSettings {
  return {
    language: Language.SimplifiedChinese,
    languageFollowSystem: true,
    timezone: 8, // UTC+8 北京时间
    timezoneFollowDevice: true,
    notificationEnabled: true,
    notificationFlags: {
      [NotificationType.BuildingComplete]: true,
      [NotificationType.ExpeditionReturn]: true,
      [NotificationType.ActivityReminder]: true,
      [NotificationType.FriendMessage]: true,
      [NotificationType.AllianceNotice]: true,
    },
  };
}

/** 创建默认音效设置 */
export function createDefaultAudioSettings(): AudioSettings {
  return {
    masterVolume: 80,
    bgmVolume: 60,
    sfxVolume: 70,
    voiceVolume: 80,
    masterSwitch: true,
    bgmSwitch: true,
    voiceSwitch: true,
    battleSfxSwitch: true,
  };
}

/** 创建默认画面设置 */
export function createDefaultGraphicsSettings(): GraphicsSettings {
  return {
    preset: GraphicsPreset.Auto,
    advanced: {
      particleEffects: true,
      realtimeShadows: false,
      inkWash: true,
      frameRateLimit: 60,
      antiAliasing: false,
    },
  };
}

/** 创建默认账号设置 */
export function createDefaultAccountSettings(): AccountSettings {
  const saveSlots = [];
  for (let i = 0; i < TOTAL_SAVE_SLOTS; i++) {
    saveSlots.push({
      slotIndex: i,
      isPaid: i >= FREE_SAVE_SLOTS,
      purchased: i < FREE_SAVE_SLOTS, // 免费槽位默认可用
      data: null,
    });
  }
  return {
    bindings: [],
    isGuest: true,
    firstBindRewardClaimed: false,
    cloudSyncFrequency: CloudSyncFrequency.OnExit,
    wifiOnlySync: false,
    conflictStrategy: ConflictStrategy.AlwaysAsk,
    devices: [],
    saveSlots,
    lastAutoSaveAt: 0,
  };
}

/** 创建默认动画设置 */
export function createDefaultAnimationSettings(): AnimationSettings {
  return {
    enabled: true,
    transitions: { ...DEFAULT_TRANSITION_CONFIGS },
    stateAnimations: { ...DEFAULT_STATE_ANIMATION_CONFIGS },
    feedbackAnimations: { ...DEFAULT_FEEDBACK_ANIMATION_CONFIGS },
  };
}

/** 创建完整的默认设置 */
export function createDefaultAllSettings(): AllSettings {
  return {
    basic: createDefaultBasicSettings(),
    audio: createDefaultAudioSettings(),
    graphics: createDefaultGraphicsSettings(),
    account: createDefaultAccountSettings(),
    animation: createDefaultAnimationSettings(),
    lastModifiedAt: Date.now(),
  };
}
