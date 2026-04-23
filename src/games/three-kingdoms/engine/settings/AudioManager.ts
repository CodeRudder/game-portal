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
import { AudioChannel } from '../../core/settings';
import type { AudioSettings } from '../../core/settings';
import { AudioSceneHelper } from './AudioSceneHelper';
import type { AudioSceneContext } from './AudioSceneHelper';

// ─────────────────────────────────────────────
// 枚举
// ─────────────────────────────────────────────

/** 特殊音频场景 */
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
 * 纯逻辑委托给 AudioSceneHelper，本类负责状态持有和播放器调度。
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
  private _currentScene: AudioScene = AudioScene.Normal;

  constructor(config?: Partial<AudioManagerConfig>) {
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }

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

  // ─── 内部：构建辅助上下文 ──────────────────

  private buildCtx(): AudioSceneContext {
    return {
      settings: this.settings,
      player: this.player,
      callbacks: this.callbacks,
      isInBackground: this.isInBackground,
      isInCall: this.isInCall,
      batteryLevel: this.batteryLevel,
      lowBatteryThreshold: this.config.lowBatteryThreshold,
      lowBatteryBGMReduction: this.config.lowBatteryBGMReduction,
      getEffectiveVolume: (ch) => this.getEffectiveVolume(ch),
    };
  }

  // ─── 初始化 ──────────────────────────────

  /** 设置音频播放器 */
  setPlayer(player: IAudioPlayer): void { this.player = player; }

  /** 注册事件回调 */
  setCallbacks(callbacks: AudioEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /** 应用音效设置 */
  applySettings(settings: AudioSettings): void {
    const prev = this.settings;
    this.settings = { ...settings };

    if (!prev) {
      AudioSceneHelper.applyAllVolumes(this.buildCtx());
      return;
    }

    AudioSceneHelper.detectVolumeChanges(this.buildCtx(), prev, settings);
    AudioSceneHelper.detectSwitchChanges(
      this.buildCtx(), prev, settings,
      this.currentBGM,
      () => this.stopBGM(),
      (id) => this.doPlayBGM(id),
    );
  }

  // ─── 音量控制 ────────────────────────────

  /** 获取通道实际音量（0~1 范围） */
  getEffectiveVolume(channel: AudioChannel): number {
    if (!this.settings) return 0;
    if (!this.settings.masterSwitch) return 0;
    if (!AudioSceneHelper.isChannelEnabled(this.settings, channel)) return 0;

    const channelVolume = AudioSceneHelper.getChannelVolume(this.settings, channel);
    let effective = (channelVolume / 100) * (this.settings.masterVolume / 100);

    if (this.isInBackground && channel === AudioChannel.BGM) effective = 0;
    if (this.isInCall) return 0;
    if (this.batteryLevel < this.config.lowBatteryThreshold && channel === AudioChannel.BGM) {
      effective *= this.config.lowBatteryBGMReduction;
    }

    return Math.max(0, Math.min(1, effective));
  }

  /** 获取通道原始音量（不考虑特殊场景） */
  getRawVolume(channel: AudioChannel): number {
    if (!this.settings) return 0;
    if (!this.settings.masterSwitch) return 0;
    if (!AudioSceneHelper.isChannelEnabled(this.settings, channel)) return 0;
    const channelVolume = AudioSceneHelper.getChannelVolume(this.settings, channel);
    return (channelVolume / 100) * (this.settings.masterVolume / 100);
  }

  // ─── BGM 管理 ────────────────────────────

  /** 播放 BGM（首次启动会延迟播放） */
  playBGM(bgmId: string): void {
    if (this.currentBGM === bgmId) return;
    this.stopBGM();
    this.currentBGM = bgmId;

    if (this.isFirstLaunch) {
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
  getCurrentBGM(): string | null { return this.currentBGM; }

  // ─── 特殊场景处理 ────────────────────────

  /** 应用进入后台（BGM 渐弱至静音） */
  enterBackground(): void {
    this.isInBackground = true;
    if (this.player && this.currentBGM) {
      this.player.fade(AudioChannel.BGM, 0, this.config.backgroundFadeDurationMs);
    }
  }

  /** 应用回到前台（BGM 渐入恢复） */
  enterForeground(): void {
    this.isInBackground = false;
    if (this.player && this.currentBGM) {
      const vol = this.getEffectiveVolume(AudioChannel.BGM);
      this.player.fade(AudioChannel.BGM, vol, this.config.backgroundFadeDurationMs);
    }
  }

  /** 来电/闹钟中断（立即静音所有通道） */
  handleInterruption(): void {
    this.isInCall = true;
    this.player?.setVolume(AudioChannel.BGM, 0);
    this.player?.setVolume(AudioChannel.SFX, 0);
    this.player?.setVolume(AudioChannel.Voice, 0);
    this.player?.setVolume(AudioChannel.Battle, 0);
  }

  /** 来电/闹钟恢复（渐入恢复音量） */
  handleInterruptionEnd(): void {
    this.isInCall = false;
    AudioSceneHelper.applyAllVolumes(this.buildCtx());
    if (this.player && this.currentBGM) {
      const vol = this.getEffectiveVolume(AudioChannel.BGM);
      this.player.fade(AudioChannel.BGM, vol, this.config.callRecoverFadeMs);
    }
  }

  /** 更新电池电量（低电量时自动降低 BGM 音量） */
  updateBatteryLevel(level: number): void {
    this.batteryLevel = Math.max(0, Math.min(100, level));
    if (this.player && this.currentBGM) {
      const vol = this.getEffectiveVolume(AudioChannel.BGM);
      this.player.setVolume(AudioChannel.BGM, vol);
    }
  }

  // ─── 音效播放 ────────────────────────────

  /** 播放音效 */
  playSFX(sfxId: string): void {
    this.player?.play(AudioChannel.SFX, sfxId, this.getEffectiveVolume(AudioChannel.SFX));
  }

  /** 播放语音 */
  playVoice(voiceId: string): void {
    this.player?.play(AudioChannel.Voice, voiceId, this.getEffectiveVolume(AudioChannel.Voice));
  }

  /** 播放战斗音效 */
  playBattleSFX(sfxId: string): void {
    this.player?.play(AudioChannel.Battle, sfxId, this.getEffectiveVolume(AudioChannel.Battle));
  }

  // ─── 状态查询 ────────────────────────────

  isBackground(): boolean { return this.isInBackground; }
  isInterrupted(): boolean { return this.isInCall; }
  isFirstLaunchState(): boolean { return this.isFirstLaunch; }
  getBatteryLevel(): number { return this.batteryLevel; }

  // ─── 从 AudioController 合并的方法 ───────

  /** 计算实际输出音量（0~100 范围） */
  calculateOutput(): VolumeOutput {
    return AudioSceneHelper.calculateOutput(this.buildCtx());
  }

  /** 判断指定通道是否静音 */
  isMuted(channel: AudioChannel): boolean {
    return AudioSceneHelper.isMuted(this.settings, channel);
  }

  /** 设置主音量 */
  setMasterVolume(volume: number): void { AudioSceneHelper.setMasterVolume(this.settings, volume); }

  /** 设置BGM音量 */
  setBgmVolume(volume: number): void { AudioSceneHelper.setBgmVolume(this.settings, volume); }

  /** 设置音效音量 */
  setSfxVolume(volume: number): void { AudioSceneHelper.setSfxVolume(this.settings, volume); }

  /** 设置语音音量 */
  setVoiceVolume(volume: number): void { AudioSceneHelper.setVoiceVolume(this.settings, volume); }

  /** 按通道设置音量 */
  setChannelVolume(channel: AudioChannel, volume: number): void {
    AudioSceneHelper.setChannelVolume(this.settings, channel, volume);
  }

  /** 音量步进增加 */
  stepUp(channel: AudioChannel | 'master', step?: number): number {
    return AudioSceneHelper.stepUp(this.settings, channel, step);
  }

  /** 音量步进减少 */
  stepDown(channel: AudioChannel | 'master', step?: number): number {
    return AudioSceneHelper.stepDown(this.settings, channel, step);
  }

  /** 从外部同步音频设置 */
  syncSettings(settings: AudioSettings): void { this.settings = { ...settings }; }

  // ─── 开关便捷方法 ────────────────────────

  setMasterSwitch(enabled: boolean): void { AudioSceneHelper.setMasterSwitch(this.settings, enabled); }
  setBgmSwitch(enabled: boolean): void { AudioSceneHelper.setBgmSwitch(this.settings, enabled); }
  setVoiceSwitch(enabled: boolean): void { AudioSceneHelper.setVoiceSwitch(this.settings, enabled); }
  setBattleSfxSwitch(enabled: boolean): void { AudioSceneHelper.setBattleSfxSwitch(this.settings, enabled); }

  // ─── 场景便捷方法 ────────────────────────

  /** 设置当前音频场景 */
  setScene(scene: AudioScene): void {
    this._currentScene = scene;
    switch (scene) {
      case AudioScene.Background:
        if (!this.isInBackground) this.enterBackground();
        break;
      case AudioScene.IncomingCall:
        if (!this.isInCall) this.handleInterruption();
        break;
      case AudioScene.LowBattery:
        break;
      case AudioScene.FirstLaunch:
        this.isFirstLaunch = true;
        break;
      case AudioScene.Normal:
      default:
        if (this.isInBackground) this.enterForeground();
        if (this.isInCall) this.handleInterruptionEnd();
        break;
    }
  }

  getScene(): AudioScene { return this._currentScene; }

  getSceneVolumeMultiplier(): number {
    return AudioSceneHelper.getSceneVolumeMultiplier(this.buildCtx());
  }

  /** 设置电池电量（同时自动切换场景） */
  setBatteryLevel(level: number): void {
    this.updateBatteryLevel(level);
    if (this.batteryLevel < this.config.lowBatteryThreshold
        && this._currentScene === AudioScene.Normal) {
      this._currentScene = AudioScene.LowBattery;
    } else if (this.batteryLevel >= this.config.lowBatteryThreshold
               && this._currentScene === AudioScene.LowBattery) {
      this._currentScene = AudioScene.Normal;
    }
  }

  markFirstLaunchComplete(): void {
    this.isFirstLaunch = false;
    if (this._currentScene === AudioScene.FirstLaunch) {
      this._currentScene = AudioScene.Normal;
    }
  }

  getIsFirstLaunch(): boolean { return this.isFirstLaunch; }
  getConfig(): AudioManagerConfig { return { ...this.config }; }

  // ─── 重置 ────────────────────────────────

  reset(): void {
    this.stopBGM();
    this.isFirstLaunch = true;
    this.isInBackground = false;
    this.isInCall = false;
    this.batteryLevel = 100;
    this.settings = null;
    this.currentBGM = null;
    this._currentScene = AudioScene.Normal;
  }

  // ─── 内部方法 ────────────────────────────

  private doPlayBGM(bgmId: string): void {
    AudioSceneHelper.doPlayBGM(this.buildCtx(), bgmId);
  }
}
