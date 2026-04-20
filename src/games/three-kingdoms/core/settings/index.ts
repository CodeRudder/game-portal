/**
 * 核心层 — 设置系统统一导出
 *
 * @module core/settings
 */

export type {
  SettingsChangeEvent,
  BasicSettings,
  AudioChannel as AudioChannelType,
  AudioSettings,
  GraphicsPreset as GraphicsPresetType,
  AdvancedGraphicsOptions,
  GraphicsSettings,
  DeviceCapability,
  BindMethod as BindMethodType,
  BindingInfo,
  DeviceInfo,
  SaveSlot,
  SaveSlotData,
  AccountSettings,
  AllSettings,
  AnimationConfig,
  AnimationSettings,
  SettingsSaveData,
} from './settings.types';

export {
  SettingsCategory,
  Language,
  NotificationType,
  AudioChannel,
  AudioSwitch,
  GraphicsPreset,
  CloudSyncFrequency,
  ConflictStrategy,
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
} from './settings.types';

export type { UTCOffset } from './settings.types';

export { BindMethod } from './settings.types';

export {
  SETTINGS_SAVE_VERSION,
  SETTINGS_STORAGE_KEY,
  VOLUME_STEP,
  VOLUME_MIN,
  VOLUME_MAX,
  MAX_DEVICES,
  FREE_SAVE_SLOTS,
  PAID_SAVE_SLOTS,
  TOTAL_SAVE_SLOTS,
  AUTO_SAVE_INTERVAL,
  PAID_SLOT_PRICE,
  FIRST_BIND_REWARD,
  ACCOUNT_DELETE_COOLDOWN_DAYS,
  DEVICE_UNBIND_COOLDOWN_HOURS,
  createDefaultBasicSettings,
  createDefaultAudioSettings,
  createDefaultGraphicsSettings,
  createDefaultAccountSettings,
  createDefaultAnimationSettings,
  createDefaultAllSettings,
} from './settings-defaults';

export {
  TRANSITION_DURATIONS,
  STATE_ANIMATION_DURATIONS,
  FEEDBACK_ANIMATION_DURATIONS,
  INK_WASH_TRANSITION_DURATION,
  FIRST_LAUNCH_BGM_DELAY,
  BACKGROUND_FADE_DURATION,
  CALL_RECOVER_FADE_DURATION,
  LOW_BATTERY_THRESHOLD,
  LOW_BATTERY_BGM_REDUCTION,
  HIGH_QUALITY_MIN_CPU,
  HIGH_QUALITY_MIN_MEMORY,
  MEDIUM_QUALITY_MIN_CPU,
  MEDIUM_QUALITY_MIN_MEMORY,
  FRAME_RATE_OPTIONS,
  CLOUD_ENCRYPTION_ALGO,
  CLOUD_DATA_VERSION,
  CLOUD_SYNC_MAX_RETRIES,
  CLOUD_SYNC_RETRY_INTERVAL,
  CLOUD_SYNC_TIMEOUT,
  SUPPORTED_LANGUAGES,
  LANGUAGE_CHANGE_REQUIRES_RESTART,
  MIN_UTC_OFFSET,
  MAX_UTC_OFFSET,
  DEFAULT_UTC_OFFSET,
} from './settings-config';
