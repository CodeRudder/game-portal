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
  UTCOffset,
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
