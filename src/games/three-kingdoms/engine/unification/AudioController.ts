/**
 * 引擎层 — 音频控制器（已废弃）
 *
 * @deprecated 本模块已与 engine/settings/AudioManager 统一。
 * 所有功能已合并到 AudioManager 中。
 * 新代码请直接从 engine/settings/AudioManager 导入。
 *
 * @module engine/unification/AudioController
 */

// Re-export AudioManager as AudioController for backward compatibility
export { AudioManager as AudioController } from '../settings/AudioManager';
export { AudioScene } from '../settings/audio-config';
export type { VolumeOutput } from '../settings/audio-config';
export type { AudioManagerConfig as AudioControllerConfig } from '../settings/audio-config';
