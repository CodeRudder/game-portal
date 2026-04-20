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
  CloudSyncResult,
  SaveSlotResult,
  ExportData,
  ISaveSlotStorage,
} from './SaveSlotManager';
