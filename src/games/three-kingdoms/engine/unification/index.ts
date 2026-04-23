/**
 * 引擎层 — v19.0 天下一统(上) 统一导出
 *
 * 包含音频、画质、数值验证等独有子系统。
 *
 * 注意：SettingsManager / AnimationController / CloudSaveSystem / AccountSystem
 * 已统一至 settings 模块，此处从 settings 模块重导出以保持向后兼容。
 *
 * @module engine/unification
 */

// ── 从 settings 模块重导出（统一后的主版本） ──
export { SettingsManager } from '../settings/SettingsManager';
export type { SettingsChangeCallback, ISettingsStorage } from '../settings/SettingsManager';

export { AnimationController } from '../settings/AnimationController';
export type {
  IAnimationPlayer,
  AnimationEventCallbacks,
  AnimationChangeCallback,
  AnimationPlayRequest,
} from '../settings/AnimationController';

export { CloudSaveSystem, CloudSyncState } from '../settings/CloudSaveSystem';
export type {
  CloudSyncResult,
  CloudSaveMetadata,
  SyncScheduler,
  INetworkDetector,
  ICloudStorage,
  CloudSaveChangeCallback,
  CloudNowFn,
} from '../settings/CloudSaveSystem';

export { AccountSystem, DeleteFlowState } from '../settings/AccountSystem';
export type {
  AccountResult,
  BindResult,
  DeviceResult,
  AccountChangeCallback,
  SpendIngotFn,
  GrantIngotFn,
  NowFn as AccountNowFn,
  DeleteFlowData,
} from '../settings/AccountSystem';

// ── unification 模块独有的子系统 ──
// AudioController 已统一到 AudioManager，此处仅做 re-export 以保持向后兼容
export { AudioManager as AudioController } from '../settings/AudioManager';
export { AudioScene } from '../settings/audio-config';
export type { VolumeOutput, AudioManagerConfig as AudioControllerConfig } from '../settings/audio-config';
export { GraphicsQualityManager } from './GraphicsQualityManager';
export { BalanceValidator } from './BalanceValidator';
export {
  generateId,
  inRange,
  calcDeviation,
  makeEntry,
  calcPower,
  calcRebirthMultiplier,
  generateResourceCurve,
} from './BalanceUtils';
export {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
} from './BalanceCalculator';
export {
  validateSingleResource,
  validateSingleHero,
  calculateStagePoints,
  validateEconomy,
  validateRebirth,
  calculateRebirthPoints,
} from './BalanceReport';
