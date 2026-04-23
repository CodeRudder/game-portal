/**
 * Audio - config and types
 *
 * Extracted from AudioManager.ts.
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import { AudioChannel } from '../../core/settings';
import type { AudioSettings } from '../../core/settings';
import { AudioSceneHelper } from './AudioSceneHelper';
import type { AudioSceneContext } from './AudioSceneHelper';
// ─────────────────────────────────────────────
// 枚举
// ─────────────────────────────────────────────

export enum AudioScene {
  Normal = 'normal',
  Background = 'background',
  IncomingCall = 'incomingCall',
  FirstLaunch = 'firstLaunch',
  LowBattery = 'lowBattery',
}

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 音量计算结果（0~100 范围） */
export interface VolumeOutput {
  bgm: number;
  sfx: number;
  voice: number;
  battle: number;
}

/** 音频播放器接口（便于测试 mock） */
export interface IAudioPlayer {
  play(channel: AudioChannel, id: string, volume: number): void;
  stop(channel: AudioChannel): void;
  setVolume(channel: AudioChannel, volume: number): void;
  fade(channel: AudioChannel, targetVolume: number, durationMs: number): void;
}

/** 音频事件回调 */
export interface AudioEventCallbacks {
  onVolumeChange?: (channel: AudioChannel, effectiveVolume: number) => void;
  onSwitchToggle?: (switchType: import('../../core/settings').AudioSwitch, enabled: boolean) => void;
  onBGMStart?: (bgmId: string) => void;
  onBGMStop?: () => void;
}

/** 音频管理器配置 */
export interface AudioManagerConfig {
  firstLaunchDelayMs: number;
  backgroundFadeDurationMs: number;
  callRecoverFadeMs: number;
  lowBatteryThreshold: number;
  lowBatteryBGMReduction: number;
}

// ─────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────

export const DEFAULT_AUDIO_CONFIG: AudioManagerConfig = {
  firstLaunchDelayMs: 3000,
  backgroundFadeDurationMs: 1000,
  callRecoverFadeMs: 500,
  lowBatteryThreshold: 20,
  lowBatteryBGMReduction: 0.5,
};

// ─────────────────────────────────────────────
// 音频管理器
// ─────────────────────────────────────────────

/**
 * 音效管理器
 *
 * 管理 4 个音频通道的音量、开关和特殊场景处理。
 * 纯逻辑委托给 AudioSceneHelper，本类负责状态持有和播放器调度。
 */
