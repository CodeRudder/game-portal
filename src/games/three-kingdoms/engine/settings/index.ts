/**
 * 引擎层 — 设置系统统一导出
 *
 * @module engine/settings
 */

// ── 类型文件 ──
export type {
  AccountResult,
  BindResult,
  DeviceResult,
  AccountChangeCallback,
  SpendIngotFn,
  GrantIngotFn,
  NowFn as AccountNowFn,
  DeleteFlowData,
} from './account.types';
export { DeleteFlowState } from './account.types';

export type {
  SaveSlotChangeCallback,
  SaveSlotResult,
  ExportData,
  ISaveSlotStorage,
  CloudSyncResult as SaveSlotCloudSyncResult,
} from './save-slot.types';
export { CloudSyncStatus } from './save-slot.types';

export { CloudSyncState } from './cloud-save.types';
export type {
  CloudSyncResult,
  CloudSaveMetadata,
  SyncScheduler,
  INetworkDetector,
  ICloudStorage,
  CloudSaveChangeCallback,
  NowFn as CloudNowFn,
} from './cloud-save.types';

// ── 子系统 ──
export { SettingsManager } from './SettingsManager';
export type {
  SettingsChangeCallback,
  ISettingsStorage,
} from './SettingsManager';

export { AudioManager } from './AudioManager';
export type {
  IAudioPlayer,
  AudioEventCallbacks,
  AudioManagerConfig,
} from './AudioManager';

export { GraphicsManager } from './GraphicsManager';
export type {
  PresetConfig,
  GraphicsChangeCallback,
} from './GraphicsManager';

export { SaveSlotManager } from './SaveSlotManager';

export { CloudSaveSystem } from './CloudSaveSystem';

export { AccountSystem } from './AccountSystem';

export { AnimationController } from './AnimationController';
export type {
  IAnimationPlayer,
  AnimationEventCallbacks,
  AnimationChangeCallback,
  AnimationPlayRequest,
} from './AnimationController';

// ── 辅助模块 ──
export {
  getDefaultTransitionConfig,
  getDefaultStateAnimationConfig,
  getDefaultFeedbackConfig,
} from './animation-defaults';

export {
  initiateDelete,
  confirmDelete,
  checkDeleteCooldown,
  executeDelete,
  cancelDelete,
  isGuestExpired as isGuestAccountExpired,
  getGuestRemainingDays,
} from './account-delete-flow';
