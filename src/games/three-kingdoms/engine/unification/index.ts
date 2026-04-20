/**
 * 引擎层 — v19.0 天下一统(上) 统一导出
 *
 * 包含设置、音频、画质、动画、云存档、账号、数值验证 7 个子系统。
 *
 * @module engine/unification
 */

export { SettingsManager } from './SettingsManager';
export { AudioController } from './AudioController';
export { AudioScene } from './AudioController';
export type { VolumeOutput, AudioControllerConfig } from './AudioController';
export { GraphicsQualityManager } from './GraphicsQualityManager';
export { AnimationController } from './AnimationController';
export { CloudSaveSystem } from './CloudSaveSystem';
export { AccountSystem } from './AccountSystem';
export { BalanceValidator } from './BalanceValidator';
export {
  generateId,
  inRange,
  calcDeviation,
  makeEntry,
  calcPower,
  calcRebirthMultiplier,
  generateResourceCurve,
  validateSingleResource,
  validateSingleHero,
  calculateStagePoints,
  validateEconomy,
  calculateRebirthPoints,
  validateRebirth,
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
} from './BalanceCalculator';
