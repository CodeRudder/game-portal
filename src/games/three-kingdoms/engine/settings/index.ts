/**
 * 引擎层 — 设置系统统一导出
 *
 * @module engine/settings
 */

// SettingsManager
export { SettingsManager } from './SettingsManager';
export type {
  SettingsChangeCallback,
  ISettingsStorage,
} from './SettingsManager';

// AudioManager
export { AudioManager } from './AudioManager';
export type {
  IAudioPlayer,
  AudioEventCallbacks,
  AudioManagerConfig,
} from './AudioManager';

// GraphicsManager
export { GraphicsManager } from './GraphicsManager';
export type {
  PresetConfig,
  GraphicsChangeCallback,
} from './GraphicsManager';

// SaveSlotManager
export { SaveSlotManager } from './SaveSlotManager';
export { CloudSyncStatus } from './SaveSlotManager';
export type {
  SaveSlotChangeCallback,
  SaveSlotCloudSyncResult,
  SaveSlotResult,
  ExportData,
  ISaveSlotStorage,
} from './SaveSlotManager';

// CloudSaveSystem
export { CloudSaveSystem, CloudSyncState } from './CloudSaveSystem';
export type {
  CloudSyncResult,
  CloudSaveMetadata,
  SyncScheduler,
  INetworkDetector,
  ICloudStorage,
  CloudSaveChangeCallback,
  NowFn as CloudNowFn,
} from './CloudSaveSystem';

// AccountSystem
export { AccountSystem, DeleteFlowState } from './AccountSystem';
export type {
  AccountResult,
  BindResult,
  DeviceResult,
  DeleteFlowData,
  AccountChangeCallback,
  SpendIngotFn,
  GrantIngotFn,
  NowFn as AccountNowFn,
} from './AccountSystem';

// AnimationController
export { AnimationController } from './AnimationController';
export type {
  IAnimationPlayer,
  AnimationEventCallbacks,
  AnimationChangeCallback,
  AnimationPlayRequest,
} from './AnimationController';
