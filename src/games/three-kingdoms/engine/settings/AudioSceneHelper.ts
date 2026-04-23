/**
 * 音频场景辅助工具
 *
 * 从 AudioManager 拆分的纯逻辑方法集合。
 * 所有方法为静态函数，不持有状态，通过参数传入依赖。
 *
 * @module engine/settings/AudioSceneHelper
 */

import { AudioChannel, AudioSwitch } from '../../core/settings';
import type { AudioSettings } from '../../core/settings';
import { VOLUME_STEP, VOLUME_MIN, VOLUME_MAX } from '../../core/settings';
import type { IAudioPlayer, AudioEventCallbacks, VolumeOutput } from './AudioManager';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 静态方法所需的音频场景上下文 */
export interface AudioSceneContext {
  settings: AudioSettings | null;
  player: IAudioPlayer | null;
  callbacks: AudioEventCallbacks;
  isInBackground: boolean;
  isInCall: boolean;
  batteryLevel: number;
  lowBatteryThreshold: number;
  lowBatteryBGMReduction: number;
  /** 获取有效音量的回调（因为需要完整的 AudioManager 状态） */
  getEffectiveVolume: (channel: AudioChannel) => number;
}

// ─────────────────────────────────────────────
// 辅助方法
// ─────────────────────────────────────────────

/**
 * 音频场景辅助工具类
 *
 * 提供无状态的静态方法，供 AudioManager 调用。
 */
export class AudioSceneHelper {
  // ─── BGM 播放 ────────────────────────────

  /** 实际播放 BGM */
  static doPlayBGM(ctx: AudioSceneContext, bgmId: string): void {
    const vol = ctx.getEffectiveVolume(AudioChannel.BGM);
    ctx.player?.play(AudioChannel.BGM, bgmId, vol);
    ctx.callbacks.onBGMStart?.(bgmId);
  }

  // ─── 通道查询 ────────────────────────────

  /** 检查通道是否启用 */
  static isChannelEnabled(settings: AudioSettings | null, channel: AudioChannel): boolean {
    if (!settings) return false;
    switch (channel) {
      case AudioChannel.BGM:    return settings.bgmSwitch;
      case AudioChannel.SFX:    return settings.masterSwitch;
      case AudioChannel.Voice:  return settings.voiceSwitch;
      case AudioChannel.Battle: return settings.battleSfxSwitch;
      default: return false;
    }
  }

  /** 获取通道音量设置值 */
  static getChannelVolume(settings: AudioSettings | null, channel: AudioChannel): number {
    if (!settings) return 0;
    switch (channel) {
      case AudioChannel.BGM:    return settings.bgmVolume;
      case AudioChannel.SFX:    return settings.sfxVolume;
      case AudioChannel.Voice:  return settings.voiceVolume;
      case AudioChannel.Battle: return settings.sfxVolume;
      default: return 0;
    }
  }

  // ─── 音量应用 ────────────────────────────

  /** 应用所有通道音量 */
  static applyAllVolumes(ctx: AudioSceneContext): void {
    if (!ctx.player) return;
    for (const ch of Object.values(AudioChannel)) {
      const vol = ctx.getEffectiveVolume(ch as AudioChannel);
      ctx.player.setVolume(ch as AudioChannel, vol);
    }
  }

  // ─── 变更检测 ────────────────────────────

  /** 检测音量变化并通知 */
  static detectVolumeChanges(
    ctx: AudioSceneContext,
    prev: AudioSettings,
    curr: AudioSettings,
  ): void {
    const channels: [AudioChannel, 'masterVolume' | 'bgmVolume' | 'sfxVolume' | 'voiceVolume'][] = [
      [AudioChannel.BGM, 'bgmVolume'],
      [AudioChannel.SFX, 'sfxVolume'],
      [AudioChannel.Voice, 'voiceVolume'],
    ];
    for (const [ch, key] of channels) {
      if (prev[key] !== curr[key] || prev.masterVolume !== curr.masterVolume) {
        const vol = ctx.getEffectiveVolume(ch);
        ctx.player?.setVolume(ch, vol);
        ctx.callbacks.onVolumeChange?.(ch, vol);
      }
    }
    if (prev.sfxVolume !== curr.sfxVolume || prev.masterVolume !== curr.masterVolume) {
      const vol = ctx.getEffectiveVolume(AudioChannel.Battle);
      ctx.player?.setVolume(AudioChannel.Battle, vol);
    }
  }

  /** 检测开关变化并通知 */
  static detectSwitchChanges(
    ctx: AudioSceneContext,
    prev: AudioSettings,
    curr: AudioSettings,
    currentBGM: string | null,
    stopBGM: () => void,
    doPlayBGM: (bgmId: string) => void,
  ): void {
    if (prev.masterSwitch !== curr.masterSwitch) {
      ctx.callbacks.onSwitchToggle?.(AudioSwitch.Master, curr.masterSwitch);
      AudioSceneHelper.applyAllVolumes(ctx);
    }
    if (prev.bgmSwitch !== curr.bgmSwitch) {
      ctx.callbacks.onSwitchToggle?.(AudioSwitch.BGM, curr.bgmSwitch);
      if (!curr.bgmSwitch) stopBGM();
      else if (currentBGM) doPlayBGM(currentBGM);
    }
    if (prev.voiceSwitch !== curr.voiceSwitch) {
      ctx.callbacks.onSwitchToggle?.(AudioSwitch.Voice, curr.voiceSwitch);
    }
    if (prev.battleSfxSwitch !== curr.battleSfxSwitch) {
      ctx.callbacks.onSwitchToggle?.(AudioSwitch.BattleSFX, curr.battleSfxSwitch);
    }
  }

  // ─── 音量钳位与步进 ─────────────────────

  /** 钳位并对齐到步进值 */
  static clampAndSnap(volume: number): number {
    const clamped = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, volume));
    return Math.round(clamped / VOLUME_STEP) * VOLUME_STEP;
  }

  /** 获取通道原始音量（内部用，用于步进） */
  static getChannelRawVolume(settings: AudioSettings | null, channel: AudioChannel | 'master'): number {
    if (!settings) return 0;
    switch (channel) {
      case 'master': return settings.masterVolume;
      case AudioChannel.BGM: return settings.bgmVolume;
      case AudioChannel.SFX: return settings.sfxVolume;
      case AudioChannel.Voice: return settings.voiceVolume;
      case AudioChannel.Battle: return settings.sfxVolume;
      default: return 0;
    }
  }

  /** 直接设置通道音量（内部用，用于步进） */
  static setChannelVolumeDirect(
    settings: AudioSettings | null,
    channel: AudioChannel | 'master',
    volume: number,
  ): void {
    if (!settings) return;
    switch (channel) {
      case 'master': settings.masterVolume = volume; break;
      case AudioChannel.BGM: settings.bgmVolume = volume; break;
      case AudioChannel.SFX: settings.sfxVolume = volume; break;
      case AudioChannel.Voice: settings.voiceVolume = volume; break;
      case AudioChannel.Battle: settings.sfxVolume = volume; break;
    }
  }

  // ─── 输出计算 ────────────────────────────

  /** 计算实际输出音量（0~100 范围） */
  static calculateOutput(ctx: AudioSceneContext): VolumeOutput {
    const s = ctx.settings;
    if (!s) return { bgm: 0, sfx: 0, voice: 0, battle: 0 };

    const master = s.masterSwitch ? s.masterVolume / 100 : 0;

    let sceneMultiplier = 1.0;
    if (ctx.isInBackground) sceneMultiplier = 0;
    if (ctx.isInCall) sceneMultiplier = 0;
    if (ctx.batteryLevel < ctx.lowBatteryThreshold) {
      sceneMultiplier = ctx.lowBatteryBGMReduction;
    }

    return {
      bgm: s.bgmSwitch ? Math.round(s.bgmVolume * master * sceneMultiplier) : 0,
      sfx: s.masterSwitch ? Math.round(s.sfxVolume * master * (ctx.isInCall ? 0 : 1)) : 0,
      voice: s.voiceSwitch ? Math.round(s.voiceVolume * master * (ctx.isInCall ? 0 : 1)) : 0,
      battle: s.battleSfxSwitch ? Math.round(s.sfxVolume * master * (ctx.isInCall ? 0 : 1)) : 0,
    };
  }

  /** 判断指定通道是否静音 */
  static isMuted(settings: AudioSettings | null, channel: AudioChannel): boolean {
    if (!settings) return true;
    switch (channel) {
      case AudioChannel.BGM: return !settings.bgmSwitch || !settings.masterSwitch;
      case AudioChannel.SFX: return !settings.masterSwitch;
      case AudioChannel.Voice: return !settings.voiceSwitch || !settings.masterSwitch;
      case AudioChannel.Battle: return !settings.battleSfxSwitch || !settings.masterSwitch;
      default: return true;
    }
  }

  // ─── 音量设置 ────────────────────────────

  /** 设置主音量 */
  static setMasterVolume(settings: AudioSettings | null, volume: number): void {
    if (!settings) return;
    settings.masterVolume = AudioSceneHelper.clampAndSnap(volume);
  }

  /** 设置BGM音量 */
  static setBgmVolume(settings: AudioSettings | null, volume: number): void {
    if (!settings) return;
    settings.bgmVolume = AudioSceneHelper.clampAndSnap(volume);
  }

  /** 设置音效音量 */
  static setSfxVolume(settings: AudioSettings | null, volume: number): void {
    if (!settings) return;
    settings.sfxVolume = AudioSceneHelper.clampAndSnap(volume);
  }

  /** 设置语音音量 */
  static setVoiceVolume(settings: AudioSettings | null, volume: number): void {
    if (!settings) return;
    settings.voiceVolume = AudioSceneHelper.clampAndSnap(volume);
  }

  /** 按通道设置音量 */
  static setChannelVolume(settings: AudioSettings | null, channel: AudioChannel, volume: number): void {
    if (!settings) return;
    const snapped = AudioSceneHelper.clampAndSnap(volume);
    switch (channel) {
      case AudioChannel.BGM: settings.bgmVolume = snapped; break;
      case AudioChannel.SFX: settings.sfxVolume = snapped; break;
      case AudioChannel.Voice: settings.voiceVolume = snapped; break;
      case AudioChannel.Battle: settings.sfxVolume = snapped; break;
    }
  }

  /** 音量步进增加 */
  static stepUp(settings: AudioSettings | null, channel: AudioChannel | 'master', step?: number): number {
    const s = step ?? VOLUME_STEP;
    const current = AudioSceneHelper.getChannelRawVolume(settings, channel);
    const next = Math.min(VOLUME_MAX, current + s);
    AudioSceneHelper.setChannelVolumeDirect(settings, channel, next);
    return next;
  }

  /** 音量步进减少 */
  static stepDown(settings: AudioSettings | null, channel: AudioChannel | 'master', step?: number): number {
    const s = step ?? VOLUME_STEP;
    const current = AudioSceneHelper.getChannelRawVolume(settings, channel);
    const next = Math.max(VOLUME_MIN, current - s);
    AudioSceneHelper.setChannelVolumeDirect(settings, channel, next);
    return next;
  }

  // ─── 开关设置 ────────────────────────────

  /** 设置音效总开关 */
  static setMasterSwitch(settings: AudioSettings | null, enabled: boolean): void {
    if (!settings) return;
    settings.masterSwitch = enabled;
  }

  /** 设置BGM开关 */
  static setBgmSwitch(settings: AudioSettings | null, enabled: boolean): void {
    if (!settings) return;
    settings.bgmSwitch = enabled;
  }

  /** 设置语音开关 */
  static setVoiceSwitch(settings: AudioSettings | null, enabled: boolean): void {
    if (!settings) return;
    settings.voiceSwitch = enabled;
  }

  /** 设置战斗音效开关 */
  static setBattleSfxSwitch(settings: AudioSettings | null, enabled: boolean): void {
    if (!settings) return;
    settings.battleSfxSwitch = enabled;
  }

  // ─── 场景音量乘数 ────────────────────────

  /** 获取场景音量乘数 */
  static getSceneVolumeMultiplier(ctx: AudioSceneContext): number {
    if (ctx.isInCall) return 0;
    if (ctx.isInBackground) return 0;
    if (ctx.batteryLevel < ctx.lowBatteryThreshold) {
      return ctx.lowBatteryBGMReduction;
    }
    return 1.0;
  }
}
