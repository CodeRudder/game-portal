/**
 * 引擎层 — 音频控制器
 *
 * 管理游戏音频的完整生命周期：
 *   - 4通道音量控制（BGM/音效/语音/战斗）
 *   - 实际音量计算（分类音量 × 主音量）
 *   - 4项独立开关
 *   - 特殊场景处理（后台/来电/首次启动/低电量）
 *
 * 功能覆盖：
 *   #4 音量控制 — 主音量 + BGM/音效/语音三分类 + 0~100% + 5%步进
 *   #5 音量计算规则 — 实际输出 = 分类音量 × 主音量
 *   #6 开关控制 — 音效总开关/BGM开关/语音开关/战斗音效开关
 *   #7 特殊音频规则 — 后台BGM渐弱/来电静音/首次启动延迟3s/低电量降BGM
 *
 * @module engine/unification/AudioController
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { AudioSettings, AudioChannel } from '../../core/settings';
import { VOLUME_STEP, VOLUME_MIN, VOLUME_MAX } from '../../core/settings';

// ─────────────────────────────────────────────
// 特殊场景状态
// ─────────────────────────────────────────────

/** 特殊音频场景 */
export enum AudioScene {
  Normal = 'normal',
  Background = 'background',       // 后台运行
  IncomingCall = 'incomingCall',    // 来电/闹钟
  FirstLaunch = 'firstLaunch',      // 首次启动
  LowBattery = 'lowBattery',        // 低电量
}

/** 音量计算结果 */
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

/** 音频控制器配置 */
export interface AudioControllerConfig {
  /** 后台BGM渐弱过渡时间 (ms) */
  backgroundFadeDuration: number;
  /** 来电恢复后渐入时间 (ms) */
  callRecoverFadeIn: number;
  /** 首次启动BGM延迟 (ms) */
  firstLaunchDelay: number;
  /** 低电量阈值 (%) */
  lowBatteryThreshold: number;
  /** 低电量BGM降低比例 */
  lowBatteryBgmReduction: number;
}

/** 默认音频控制器配置 */
const DEFAULT_AUDIO_CONTROLLER_CONFIG: AudioControllerConfig = {
  backgroundFadeDuration: 1000,
  callRecoverFadeIn: 500,
  firstLaunchDelay: 3000,
  lowBatteryThreshold: 20,
  lowBatteryBgmReduction: 0.5,
};

// ─────────────────────────────────────────────
// 音频控制器
// ─────────────────────────────────────────────

/**
 * 音频控制器
 *
 * 管理4通道音量、开关和特殊场景。
 * 音量计算规则：实际输出 = 分类音量% × 主音量% / 100
 */
export class AudioController implements ISubsystem {
  readonly name = 'audioController';

  private deps!: ISystemDeps;
  private settings: AudioSettings;
  private config: AudioControllerConfig;
  private currentScene: AudioScene = AudioScene.Normal;
  private batteryLevel = 100;
  private isFirstLaunch = true;
  /** 首次启动延迟计时器 */
  private firstLaunchTimer = 0;
  /** 场景音量覆盖（如后台/来电） */
  private sceneVolumeMultiplier = 1.0;

  constructor(config?: Partial<AudioControllerConfig>) {
    this.settings = {
      masterVolume: 80,
      bgmVolume: 60,
      sfxVolume: 70,
      voiceVolume: 80,
      masterSwitch: true,
      bgmSwitch: true,
      voiceSwitch: true,
      battleSfxSwitch: true,
    };
    this.config = { ...DEFAULT_AUDIO_CONTROLLER_CONFIG, ...config };
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    // 处理首次启动延迟
    if (this.isFirstLaunch && this.currentScene === AudioScene.FirstLaunch) {
      this.firstLaunchTimer += dt * 1000;
      if (this.firstLaunchTimer >= this.config.firstLaunchDelay) {
        this.setScene(AudioScene.Normal);
        this.isFirstLaunch = false;
      }
    }
  }

  getState(): AudioSettings {
    return { ...this.settings };
  }

  reset(): void {
    this.settings = {
      masterVolume: 80,
      bgmVolume: 60,
      sfxVolume: 70,
      voiceVolume: 80,
      masterSwitch: true,
      bgmSwitch: true,
      voiceSwitch: true,
      battleSfxSwitch: true,
    };
    this.currentScene = AudioScene.Normal;
    this.sceneVolumeMultiplier = 1.0;
    this.isFirstLaunch = true;
    this.firstLaunchTimer = 0;
  }

  // ─── 设置同步 ─────────────────────────────

  /** 从 SettingsManager 同步音频设置 */
  syncSettings(settings: AudioSettings): void {
    this.settings = { ...settings };
  }

  // ─── 音量控制 (#4) ───────────────────────

  /** 设置主音量 */
  setMasterVolume(volume: number): void {
    this.settings.masterVolume = this.clampAndSnap(volume);
  }

  /** 设置BGM音量 */
  setBgmVolume(volume: number): void {
    this.settings.bgmVolume = this.clampAndSnap(volume);
  }

  /** 设置音效音量 */
  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = this.clampAndSnap(volume);
  }

  /** 设置语音音量 */
  setVoiceVolume(volume: number): void {
    this.settings.voiceVolume = this.clampAndSnap(volume);
  }

  /** 按通道设置音量 */
  setChannelVolume(channel: AudioChannel, volume: number): void {
    const snapped = this.clampAndSnap(volume);
    switch (channel) {
      case 'bgm': this.settings.bgmVolume = snapped; break;
      case 'sfx': this.settings.sfxVolume = snapped; break;
      case 'voice': this.settings.voiceVolume = snapped; break;
      case 'battle': this.settings.sfxVolume = snapped; break;
    }
  }

  /** 音量步进增加 */
  stepUp(channel: AudioChannel | 'master', step: number = VOLUME_STEP): number {
    const current = this.getChannelVolume(channel);
    const next = Math.min(VOLUME_MAX, current + step);
    this.setChannelVolumeDirect(channel, next);
    return next;
  }

  /** 音量步进减少 */
  stepDown(channel: AudioChannel | 'master', step: number = VOLUME_STEP): number {
    const current = this.getChannelVolume(channel);
    const next = Math.max(VOLUME_MIN, current - step);
    this.setChannelVolumeDirect(channel, next);
    return next;
  }

  // ─── 音量计算 (#5) ───────────────────────

  /**
   * 计算实际输出音量
   * 规则：实际输出 = 分类音量% × 主音量% / 100
   */
  calculateOutput(): VolumeOutput {
    const master = this.settings.masterSwitch
      ? this.settings.masterVolume / 100
      : 0;

    return {
      bgm: this.settings.bgmSwitch
        ? Math.round(this.settings.bgmVolume * master * this.sceneVolumeMultiplier)
        : 0,
      sfx: this.settings.masterSwitch
        ? Math.round(this.settings.sfxVolume * master * this.sceneVolumeMultiplier)
        : 0,
      voice: this.settings.voiceSwitch
        ? Math.round(this.settings.voiceVolume * master * this.sceneVolumeMultiplier)
        : 0,
      battle: this.settings.battleSfxSwitch
        ? Math.round(this.settings.sfxVolume * master * this.sceneVolumeMultiplier)
        : 0,
    };
  }

  /** 获取指定通道的实际输出音量 */
  getEffectiveVolume(channel: AudioChannel): number {
    const output = this.calculateOutput();
    return output[channel as keyof VolumeOutput] ?? 0;
  }

  // ─── 开关控制 (#6) ───────────────────────

  /** 设置音效总开关 */
  setMasterSwitch(enabled: boolean): void {
    this.settings.masterSwitch = enabled;
  }

  /** 设置BGM开关 */
  setBgmSwitch(enabled: boolean): void {
    this.settings.bgmSwitch = enabled;
  }

  /** 设置语音开关 */
  setVoiceSwitch(enabled: boolean): void {
    this.settings.voiceSwitch = enabled;
  }

  /** 设置战斗音效开关 */
  setBattleSfxSwitch(enabled: boolean): void {
    this.settings.battleSfxSwitch = enabled;
  }

  /** 判断指定通道是否静音 */
  isMuted(channel: AudioChannel): boolean {
    switch (channel) {
      case 'bgm': return !this.settings.bgmSwitch || !this.settings.masterSwitch;
      case 'sfx': return !this.settings.masterSwitch;
      case 'voice': return !this.settings.voiceSwitch || !this.settings.masterSwitch;
      case 'battle': return !this.settings.battleSfxSwitch || !this.settings.masterSwitch;
      default: return true;
    }
  }

  // ─── 特殊场景处理 (#7) ───────────────────

  /** 设置当前音频场景 */
  setScene(scene: AudioScene): void {
    this.currentScene = scene;
    switch (scene) {
      case AudioScene.Background:
        // 后台BGM渐弱至静音
        this.sceneVolumeMultiplier = 0;
        break;
      case AudioScene.IncomingCall:
        // 来电立即静音
        this.sceneVolumeMultiplier = 0;
        break;
      case AudioScene.LowBattery:
        // 低电量BGM降低50%
        this.sceneVolumeMultiplier = this.config.lowBatteryBgmReduction;
        break;
      case AudioScene.FirstLaunch:
        // 首次启动延迟3秒
        this.sceneVolumeMultiplier = 0;
        this.firstLaunchTimer = 0;
        break;
      case AudioScene.Normal:
      default:
        this.sceneVolumeMultiplier = 1.0;
        break;
    }
  }

  /** 获取当前场景 */
  getScene(): AudioScene {
    return this.currentScene;
  }

  /** 设置电池电量（用于低电量检测） */
  setBatteryLevel(level: number): void {
    this.batteryLevel = Math.max(0, Math.min(100, level));
    if (this.batteryLevel < this.config.lowBatteryThreshold
        && this.currentScene === AudioScene.Normal) {
      this.setScene(AudioScene.LowBattery);
    } else if (this.batteryLevel >= this.config.lowBatteryThreshold
               && this.currentScene === AudioScene.LowBattery) {
      this.setScene(AudioScene.Normal);
    }
  }

  /** 获取电池电量 */
  getBatteryLevel(): number {
    return this.batteryLevel;
  }

  /** 标记首次启动完成 */
  markFirstLaunchComplete(): void {
    this.isFirstLaunch = false;
    if (this.currentScene === AudioScene.FirstLaunch) {
      this.setScene(AudioScene.Normal);
    }
  }

  /** 是否首次启动 */
  getIsFirstLaunch(): boolean {
    return this.isFirstLaunch;
  }

  /** 获取场景音量乘数 */
  getSceneVolumeMultiplier(): number {
    return this.sceneVolumeMultiplier;
  }

  /** 获取配置 */
  getConfig(): AudioControllerConfig {
    return { ...this.config };
  }

  // ─── 内部方法 ────────────────────────────

  /** 钳位并对齐到步进值 */
  private clampAndSnap(volume: number): number {
    const clamped = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, volume));
    return Math.round(clamped / VOLUME_STEP) * VOLUME_STEP;
  }

  /** 获取通道原始音量 */
  private getChannelVolume(channel: AudioChannel | 'master'): number {
    switch (channel) {
      case 'master': return this.settings.masterVolume;
      case 'bgm': return this.settings.bgmVolume;
      case 'sfx': return this.settings.sfxVolume;
      case 'voice': return this.settings.voiceVolume;
      case 'battle': return this.settings.sfxVolume;
      default: return 0;
    }
  }

  /** 直接设置通道音量（内部用） */
  private setChannelVolumeDirect(channel: AudioChannel | 'master', volume: number): void {
    switch (channel) {
      case 'master': this.settings.masterVolume = volume; break;
      case 'bgm': this.settings.bgmVolume = volume; break;
      case 'sfx': this.settings.sfxVolume = volume; break;
      case 'voice': this.settings.voiceVolume = volume; break;
      case 'battle': this.settings.sfxVolume = volume; break;
    }
  }
}
