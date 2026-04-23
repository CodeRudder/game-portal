/**
 * 音效管理器
 *
 * v19.0 音频控制器，职责：
 * - 4通道音量控制 (BGM/音效/语音/战斗)
 * - 音效开关控制
 * - 音量计算规则 (实际输出 = 分类音量 × 主音量)
 * - 特殊场景处理 (后台BGM渐弱/来电静音/首次启动延迟/低电量降BGM)
 *
 * @module engine/settings/AudioManager
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import { AudioChannel, AudioSwitch } from '../../core/settings';
import type { AudioSettings } from '../../core/settings';
import { VOLUME_STEP, VOLUME_MIN, VOLUME_MAX } from '../../core/settings';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 音量计算结果（0~100 范围） */
export interface VolumeOutput {
  /** BGM 实际输出音量 0~100 */
  bgm: number;
  /** 音效实际输出音量 0~100 */
  sfx: number;
  /** 语音实际输出音量 0~100 */
  voice: number;
  /** 战斗实际输出音量 0~100 */
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
  onSwitchToggle?: (switchType: AudioSwitch, enabled: boolean) => void;
  onBGMStart?: (bgmId: string) => void;
  onBGMStop?: () => void;
}

/** 音频管理器配置 */
export interface AudioManagerConfig {
  /** 首次启动 BGM 延迟 (ms) */
  firstLaunchDelayMs: number;
  /** 后台 BGM 渐弱时长 (ms) */
  backgroundFadeDurationMs: number;
  /** 来电恢复后渐入时长 (ms) */
  callRecoverFadeMs: number;
  /** 低电量阈值 (%) */
  lowBatteryThreshold: number;
  /** 低电量 BGM 降低比例 */
  lowBatteryBGMReduction: number;
}

// ─────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────

const DEFAULT_AUDIO_CONFIG: AudioManagerConfig = {
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
 * 音量计算规则：实际输出 = 分类音量 × 主音量 / 10000
 *
 * @example
 * ```ts
 * const audio = new AudioManager();
 * audio.applySettings(settings);
 *
 * // 播放 BGM
 * audio.playBGM('main-theme');
 *
 * // 获取实际音量
 * const vol = audio.getEffectiveVolume(AudioChannel.BGM); // 0~1
 * ```
 */
export class AudioManager implements ISubsystem {
  readonly name = 'audio' as const;
  private deps!: ISystemDeps;
  private config: AudioManagerConfig;
  private player: IAudioPlayer | null = null;
  private callbacks: AudioEventCallbacks = {};
  private settings: AudioSettings | null = null;
  private isFirstLaunch = true;
  private isInBackground = false;
  private isInCall = false;
  private batteryLevel = 100;
  private currentBGM: string | null = null;
  private bgmDelayTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: Partial<AudioManagerConfig>) {
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void { /* 音频系统无需每帧更新 */ }

  getState(): unknown {
    return {
      settings: this.settings,
      currentBGM: this.currentBGM,
      isInBackground: this.isInBackground,
      isInCall: this.isInCall,
      batteryLevel: this.batteryLevel,
      isFirstLaunch: this.isFirstLaunch,
    };
  }

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 设置音频播放器
   *
   * 注入实际的音频播放实现。不传入则使用静默模式。
   */
  setPlayer(player: IAudioPlayer): void {
    this.player = player;
  }

  /**
   * 注册事件回调
   */
  setCallbacks(callbacks: AudioEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 应用音效设置
   *
   * 当设置变更时调用，更新内部状态并应用音量。
   */
  applySettings(settings: AudioSettings): void {
    const prev = this.settings;
    this.settings = { ...settings };

    if (!prev) {
      // 首次应用设置
      this.applyAllVolumes();
      return;
    }

    // 检测音量变化
    this.detectVolumeChanges(prev, settings);

    // 检测开关变化
    this.detectSwitchChanges(prev, settings);
  }

  // ─────────────────────────────────────────
  // 音量控制
  // ─────────────────────────────────────────

  /**
   * 获取通道实际音量
   *
   * 计算规则：实际输出 = 分类音量 × 主音量 / 10000
   * 考虑开关、后台、来电、低电量等因素。
   *
   * @returns 0~1 范围的音量值
   */
  getEffectiveVolume(channel: AudioChannel): number {
    if (!this.settings) return 0;

    // 总开关关闭
    if (!this.settings.masterSwitch) return 0;

    // 通道开关检查
    if (!this.isChannelEnabled(channel)) return 0;

    // 获取通道基础音量
    const channelVolume = this.getChannelVolume(channel);

    // 计算实际音量
    let effective = (channelVolume / 100) * (this.settings.masterVolume / 100);

    // 后台运行时 BGM 渐弱
    if (this.isInBackground && channel === AudioChannel.BGM) {
      effective = 0;
    }

    // 来电时全部静音
    if (this.isInCall) return 0;

    // 低电量降低 BGM
    if (this.batteryLevel < this.config.lowBatteryThreshold && channel === AudioChannel.BGM) {
      effective *= this.config.lowBatteryBGMReduction;
    }

    return Math.max(0, Math.min(1, effective));
  }

  /**
   * 获取通道原始音量（不考虑特殊场景）
   */
  getRawVolume(channel: AudioChannel): number {
    if (!this.settings) return 0;
    if (!this.settings.masterSwitch) return 0;
    if (!this.isChannelEnabled(channel)) return 0;
    const channelVolume = this.getChannelVolume(channel);
    return (channelVolume / 100) * (this.settings.masterVolume / 100);
  }

  // ─────────────────────────────────────────
  // BGM 管理
  // ─────────────────────────────────────────

  /**
   * 播放 BGM
   *
   * 首次启动会延迟播放。
   */
  playBGM(bgmId: string): void {
    if (this.currentBGM === bgmId) return;
    this.stopBGM();
    this.currentBGM = bgmId;

    if (this.isFirstLaunch) {
      // 首次启动延迟
      this.bgmDelayTimer = setTimeout(() => {
        this.isFirstLaunch = false;
        this.bgmDelayTimer = null;
        this.doPlayBGM(bgmId);
      }, this.config.firstLaunchDelayMs);
    } else {
      this.doPlayBGM(bgmId);
    }
  }

  /** 停止 BGM */
  stopBGM(): void {
    if (this.bgmDelayTimer) {
      clearTimeout(this.bgmDelayTimer);
      this.bgmDelayTimer = null;
    }
    this.currentBGM = null;
    this.player?.stop(AudioChannel.BGM);
    this.callbacks.onBGMStop?.();
  }

  /** 获取当前 BGM ID */
  getCurrentBGM(): string | null {
    return this.currentBGM;
  }

  // ─────────────────────────────────────────
  // 特殊场景处理
  // ─────────────────────────────────────────

  /**
   * 应用进入后台
   *
   * BGM 渐弱至静音。
   */
  enterBackground(): void {
    this.isInBackground = true;
    if (this.player && this.currentBGM) {
      this.player.fade(AudioChannel.BGM, 0, this.config.backgroundFadeDurationMs);
    }
  }

  /**
   * 应用回到前台
   *
   * BGM 渐入恢复。
   */
  enterForeground(): void {
    this.isInBackground = false;
    if (this.player && this.currentBGM) {
      const vol = this.getEffectiveVolume(AudioChannel.BGM);
      this.player.fade(AudioChannel.BGM, vol, this.config.backgroundFadeDurationMs);
    }
  }

  /**
   * 来电/闹钟中断
   *
   * 立即静音所有通道。
   */
  handleInterruption(): void {
    this.isInCall = true;
    this.player?.setVolume(AudioChannel.BGM, 0);
    this.player?.setVolume(AudioChannel.SFX, 0);
    this.player?.setVolume(AudioChannel.Voice, 0);
    this.player?.setVolume(AudioChannel.Battle, 0);
  }

  /**
   * 来电/闹钟恢复
   *
   * 渐入恢复音量。
   */
  handleInterruptionEnd(): void {
    this.isInCall = false;
    // 渐入恢复
    this.applyAllVolumes();
    if (this.player && this.currentBGM) {
      const vol = this.getEffectiveVolume(AudioChannel.BGM);
      this.player.fade(AudioChannel.BGM, vol, this.config.callRecoverFadeMs);
    }
  }

  /**
   * 更新电池电量
   *
   * 低电量时自动降低 BGM 音量。
   */
  updateBatteryLevel(level: number): void {
    this.batteryLevel = Math.max(0, Math.min(100, level));
    // 如果当前正在播放 BGM，立即应用新音量
    if (this.player && this.currentBGM) {
      const vol = this.getEffectiveVolume(AudioChannel.BGM);
      this.player.setVolume(AudioChannel.BGM, vol);
    }
  }

  // ─────────────────────────────────────────
  // 音效播放
  // ─────────────────────────────────────────

  /** 播放音效 */
  playSFX(sfxId: string): void {
    const vol = this.getEffectiveVolume(AudioChannel.SFX);
    this.player?.play(AudioChannel.SFX, sfxId, vol);
  }

  /** 播放语音 */
  playVoice(voiceId: string): void {
    const vol = this.getEffectiveVolume(AudioChannel.Voice);
    this.player?.play(AudioChannel.Voice, voiceId, vol);
  }

  /** 播放战斗音效 */
  playBattleSFX(sfxId: string): void {
    const vol = this.getEffectiveVolume(AudioChannel.Battle);
    this.player?.play(AudioChannel.Battle, sfxId, vol);
  }

  // ─────────────────────────────────────────
  // 状态查询
  // ─────────────────────────────────────────

  /** 是否在后台 */
  isBackground(): boolean {
    return this.isInBackground;
  }

  /** 是否被中断 */
  isInterrupted(): boolean {
    return this.isInCall;
  }

  /** 是否首次启动 */
  isFirstLaunchState(): boolean {
    return this.isFirstLaunch;
  }

  /** 获取电池电量 */
  getBatteryLevel(): number {
    return this.batteryLevel;
  }

  // ─────────────────────────────────────────
  // 从 AudioController 合并的方法
  // ─────────────────────────────────────────

  /**
   * 计算实际输出音量（0~100 范围）
   *
   * 规则：实际输出 = 分类音量% × 主音量% / 100
   * 考虑开关、后台、来电、低电量等因素。
   */
  calculateOutput(): VolumeOutput {
    if (!this.settings) {
      return { bgm: 0, sfx: 0, voice: 0, battle: 0 };
    }

    const master = this.settings.masterSwitch
      ? this.settings.masterVolume / 100
      : 0;

    // 获取场景乘数（低电量等）
    let sceneMultiplier = 1.0;
    if (this.isInBackground) sceneMultiplier = 0;
    if (this.isInCall) sceneMultiplier = 0;
    if (this.batteryLevel < this.config.lowBatteryThreshold) {
      sceneMultiplier = this.config.lowBatteryBGMReduction;
    }

    return {
      bgm: this.settings.bgmSwitch
        ? Math.round(this.settings.bgmVolume * master * sceneMultiplier)
        : 0,
      sfx: this.settings.masterSwitch
        ? Math.round(this.settings.sfxVolume * master * (this.isInCall ? 0 : 1))
        : 0,
      voice: this.settings.voiceSwitch
        ? Math.round(this.settings.voiceVolume * master * (this.isInCall ? 0 : 1))
        : 0,
      battle: this.settings.battleSfxSwitch
        ? Math.round(this.settings.sfxVolume * master * (this.isInCall ? 0 : 1))
        : 0,
    };
  }

  /** 判断指定通道是否静音 */
  isMuted(channel: AudioChannel): boolean {
    if (!this.settings) return true;
    switch (channel) {
      case AudioChannel.BGM: return !this.settings.bgmSwitch || !this.settings.masterSwitch;
      case AudioChannel.SFX: return !this.settings.masterSwitch;
      case AudioChannel.Voice: return !this.settings.voiceSwitch || !this.settings.masterSwitch;
      case AudioChannel.Battle: return !this.settings.battleSfxSwitch || !this.settings.masterSwitch;
      default: return true;
    }
  }

  /** 设置主音量（钳位到 0~100 并对齐步进值） */
  setMasterVolume(volume: number): void {
    if (!this.settings) return;
    this.settings.masterVolume = this.clampAndSnap(volume);
  }

  /** 设置BGM音量 */
  setBgmVolume(volume: number): void {
    if (!this.settings) return;
    this.settings.bgmVolume = this.clampAndSnap(volume);
  }

  /** 设置音效音量 */
  setSfxVolume(volume: number): void {
    if (!this.settings) return;
    this.settings.sfxVolume = this.clampAndSnap(volume);
  }

  /** 设置语音音量 */
  setVoiceVolume(volume: number): void {
    if (!this.settings) return;
    this.settings.voiceVolume = this.clampAndSnap(volume);
  }

  /** 按通道设置音量 */
  setChannelVolume(channel: AudioChannel, volume: number): void {
    if (!this.settings) return;
    const snapped = this.clampAndSnap(volume);
    switch (channel) {
      case AudioChannel.BGM: this.settings.bgmVolume = snapped; break;
      case AudioChannel.SFX: this.settings.sfxVolume = snapped; break;
      case AudioChannel.Voice: this.settings.voiceVolume = snapped; break;
      case AudioChannel.Battle: this.settings.sfxVolume = snapped; break;
    }
  }

  /** 音量步进增加 */
  stepUp(channel: AudioChannel | 'master', step: number = VOLUME_STEP): number {
    const current = this.getChannelRawVolume(channel);
    const next = Math.min(VOLUME_MAX, current + step);
    this.setChannelVolumeDirect(channel, next);
    return next;
  }

  /** 音量步进减少 */
  stepDown(channel: AudioChannel | 'master', step: number = VOLUME_STEP): number {
    const current = this.getChannelRawVolume(channel);
    const next = Math.max(VOLUME_MIN, current - step);
    this.setChannelVolumeDirect(channel, next);
    return next;
  }

  /** 从外部同步音频设置 */
  syncSettings(settings: AudioSettings): void {
    this.settings = { ...settings };
  }

  // ─────────────────────────────────────────
  // 重置
  // ─────────────────────────────────────────

  /** 重置到初始状态 */
  reset(): void {
    this.stopBGM();
    this.isFirstLaunch = true;
    this.isInBackground = false;
    this.isInCall = false;
    this.batteryLevel = 100;
    this.settings = null;
    this.currentBGM = null;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 实际播放 BGM */
  private doPlayBGM(bgmId: string): void {
    const vol = this.getEffectiveVolume(AudioChannel.BGM);
    this.player?.play(AudioChannel.BGM, bgmId, vol);
    this.callbacks.onBGMStart?.(bgmId);
  }

  /** 检查通道是否启用 */
  private isChannelEnabled(channel: AudioChannel): boolean {
    if (!this.settings) return false;
    switch (channel) {
      case AudioChannel.BGM:    return this.settings.bgmSwitch;
      case AudioChannel.SFX:    return this.settings.masterSwitch;
      case AudioChannel.Voice:  return this.settings.voiceSwitch;
      case AudioChannel.Battle: return this.settings.battleSfxSwitch;
      default: return false;
    }
  }

  /** 获取通道音量设置值 */
  private getChannelVolume(channel: AudioChannel): number {
    if (!this.settings) return 0;
    switch (channel) {
      case AudioChannel.BGM:    return this.settings.bgmVolume;
      case AudioChannel.SFX:    return this.settings.sfxVolume;
      case AudioChannel.Voice:  return this.settings.voiceVolume;
      case AudioChannel.Battle: return this.settings.sfxVolume; // 战斗音效使用音效音量
      default: return 0;
    }
  }

  /** 应用所有通道音量 */
  private applyAllVolumes(): void {
    if (!this.player) return;
    for (const ch of Object.values(AudioChannel)) {
      const vol = this.getEffectiveVolume(ch as AudioChannel);
      this.player.setVolume(ch as AudioChannel, vol);
    }
  }

  /** 检测音量变化并通知 */
  private detectVolumeChanges(prev: AudioSettings, curr: AudioSettings): void {
    const channels: [AudioChannel, 'masterVolume' | 'bgmVolume' | 'sfxVolume' | 'voiceVolume'][] = [
      [AudioChannel.BGM, 'bgmVolume'],
      [AudioChannel.SFX, 'sfxVolume'],
      [AudioChannel.Voice, 'voiceVolume'],
    ];
    for (const [ch, key] of channels) {
      if (prev[key] !== curr[key] || prev.masterVolume !== curr.masterVolume) {
        const vol = this.getEffectiveVolume(ch);
        this.player?.setVolume(ch, vol);
        this.callbacks.onVolumeChange?.(ch, vol);
      }
    }
    // 战斗通道跟随音效通道
    if (prev.sfxVolume !== curr.sfxVolume || prev.masterVolume !== curr.masterVolume) {
      const vol = this.getEffectiveVolume(AudioChannel.Battle);
      this.player?.setVolume(AudioChannel.Battle, vol);
    }
  }

  /** 检测开关变化并通知 */
  private detectSwitchChanges(prev: AudioSettings, curr: AudioSettings): void {
    if (prev.masterSwitch !== curr.masterSwitch) {
      this.callbacks.onSwitchToggle?.(AudioSwitch.Master, curr.masterSwitch);
      this.applyAllVolumes();
    }
    if (prev.bgmSwitch !== curr.bgmSwitch) {
      this.callbacks.onSwitchToggle?.(AudioSwitch.BGM, curr.bgmSwitch);
      if (!curr.bgmSwitch) this.stopBGM();
      else if (this.currentBGM) this.doPlayBGM(this.currentBGM);
    }
    if (prev.voiceSwitch !== curr.voiceSwitch) {
      this.callbacks.onSwitchToggle?.(AudioSwitch.Voice, curr.voiceSwitch);
    }
    if (prev.battleSfxSwitch !== curr.battleSfxSwitch) {
      this.callbacks.onSwitchToggle?.(AudioSwitch.BattleSFX, curr.battleSfxSwitch);
    }
  }

  /** 钳位并对齐到步进值 */
  private clampAndSnap(volume: number): number {
    const clamped = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, volume));
    return Math.round(clamped / VOLUME_STEP) * VOLUME_STEP;
  }

  /** 获取通道原始音量（内部用，用于步进） */
  private getChannelRawVolume(channel: AudioChannel | 'master'): number {
    if (!this.settings) return 0;
    switch (channel) {
      case 'master': return this.settings.masterVolume;
      case AudioChannel.BGM: return this.settings.bgmVolume;
      case AudioChannel.SFX: return this.settings.sfxVolume;
      case AudioChannel.Voice: return this.settings.voiceVolume;
      case AudioChannel.Battle: return this.settings.sfxVolume;
      default: return 0;
    }
  }

  /** 直接设置通道音量（内部用，用于步进） */
  private setChannelVolumeDirect(channel: AudioChannel | 'master', volume: number): void {
    if (!this.settings) return;
    switch (channel) {
      case 'master': this.settings.masterVolume = volume; break;
      case AudioChannel.BGM: this.settings.bgmVolume = volume; break;
      case AudioChannel.SFX: this.settings.sfxVolume = volume; break;
      case AudioChannel.Voice: this.settings.voiceVolume = volume; break;
      case AudioChannel.Battle: this.settings.sfxVolume = volume; break;
    }
  }
}
