/**
 * 手机端专属设置系统
 *
 * 职责：
 * - #11 省电模式（帧率控制+粒子开关+自动低电量检测）
 * - #13 屏幕常亮（游戏内保持+后台恢复）
 * - #14 字体大小三档（与LayoutManager协同）
 *
 * 设计原则：
 * - 纯状态管理，不操作DOM/Native API
 * - 通过回调通知设置变更
 * - 可在测试环境中完整验证
 *
 * @module engine/responsive/MobileSettingsSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

import {
  PowerSaveLevel,
  FontSizeLevel,
  type PowerSaveConfig,
  type PowerSaveState,
  type MobileSettingsState,
  type OnPowerSaveChange,
} from '../../core/responsive/responsive.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认省电配置 */
const DEFAULT_POWER_SAVE_CONFIG: PowerSaveConfig = {
  targetFps: 30,
  disableParticles: true,
  disableShadows: true,
  autoTriggerBatteryLevel: 20,
};

/** 正常帧率 */
const NORMAL_FPS = 60;

/** 省电帧率 */
const POWER_SAVE_FPS = 30;

// ─────────────────────────────────────────────
// MobileSettingsSystem
// ─────────────────────────────────────────────

/**
 * 手机端专属设置系统
 *
 * 管理省电模式、屏幕常亮、字体大小等设置。
 */
export class MobileSettingsSystem implements ISubsystem {
  // ── 省电模式 ──
  private _powerSaveLevel: PowerSaveLevel = PowerSaveLevel.Off;
  private _powerSaveActive: boolean = false;
  private _currentBatteryLevel: number = 100;
  private _isCharging: boolean = false;
  private _powerSaveConfig: PowerSaveConfig;

  // ── 屏幕常亮 ──
  private _screenAlwaysOn: boolean = false;
  private _isInGame: boolean = false;

  // ── 字体大小 ──
  private _fontSize: FontSizeLevel = FontSizeLevel.Medium;

  // ── 回调 ──
  private readonly _powerSaveListeners: Set<OnPowerSaveChange> = new Set();

  constructor(config?: Partial<PowerSaveConfig>) {
    this._powerSaveConfig = { ...DEFAULT_POWER_SAVE_CONFIG, ...config };
  }

  // ─────────────────────────────────────────
  // 属性
  // ─────────────────────────────────────────

  get powerSaveLevel(): PowerSaveLevel { return this._powerSaveLevel; }
  get isPowerSaveActive(): boolean { return this._powerSaveActive; }
  get currentBatteryLevel(): number { return this._currentBatteryLevel; }
  get isCharging(): boolean { return this._isCharging; }
  get screenAlwaysOn(): boolean { return this._screenAlwaysOn; }
  get fontSize(): FontSizeLevel { return this._fontSize; }

  get currentFps(): number {
    return this._powerSaveActive ? this._powerSaveConfig.targetFps : NORMAL_FPS;
  }

  get shouldDisableParticles(): boolean {
    return this._powerSaveActive && this._powerSaveConfig.disableParticles;
  }

  get shouldDisableShadows(): boolean {
    return this._powerSaveActive && this._powerSaveConfig.disableShadows;
  }

  /** 获取屏幕常亮是否实际生效 */
  get isScreenAlwaysOnEffective(): boolean {
    return this._screenAlwaysOn && this._isInGame;
  }

  // ─────────────────────────────────────────
  // #11 省电模式
  // ─────────────────────────────────────────

  /**
   * 设置省电模式等级
   */
  setPowerSaveLevel(level: PowerSaveLevel): void {
    this._powerSaveLevel = level;
    this._updatePowerSaveState();
  }

  /**
   * 更新电池状态
   * @param batteryLevel 电量百分比 (0-100)
   * @param isCharging 是否在充电
   */
  updateBatteryStatus(batteryLevel: number, isCharging: boolean): void {
    this._currentBatteryLevel = Math.max(0, Math.min(100, batteryLevel));
    this._isCharging = isCharging;

    // 自动模式下根据电量自动切换
    if (this._powerSaveLevel === PowerSaveLevel.Auto) {
      this._updatePowerSaveState();
    }
  }

  /**
   * 获取省电模式状态
   */
  getPowerSaveState(): PowerSaveState {
    return {
      level: this._powerSaveLevel,
      isActive: this._powerSaveActive,
      currentFps: this.currentFps,
      config: { ...this._powerSaveConfig },
    };
  }

  /**
   * 更新省电配置
   */
  setPowerSaveConfig(config: Partial<PowerSaveConfig>): void {
    this._powerSaveConfig = { ...this._powerSaveConfig, ...config };
    this._updatePowerSaveState();
  }

  // ─────────────────────────────────────────
  // #13 屏幕常亮
  // ─────────────────────────────────────────

  /**
   * 设置屏幕常亮开关
   */
  setScreenAlwaysOn(enabled: boolean): void {
    this._screenAlwaysOn = enabled;
  }

  /**
   * 设置游戏内状态（进入/退出游戏）
   */
  setInGame(inGame: boolean): void {
    this._isInGame = inGame;
  }

  // ─────────────────────────────────────────
  // #14 字体大小
  // ─────────────────────────────────────────

  /**
   * 设置字体大小档位
   */
  setFontSize(level: FontSizeLevel): void {
    this._fontSize = level;
  }

  // ─────────────────────────────────────────
  // 完整设置状态
  // ─────────────────────────────────────────

  /**
   * 获取完整的手机端设置状态
   */
  getSettingsState(): MobileSettingsState {
    return {
      powerSave: this.getPowerSaveState(),
      leftHandMode: false, // 由LayoutManager管理
      screenAlwaysOn: this._screenAlwaysOn,
      fontSize: this._fontSize,
    };
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  onPowerSaveChange(listener: OnPowerSaveChange): () => void {
    this._powerSaveListeners.add(listener);
    return () => { this._powerSaveListeners.delete(listener); };
  }

  clearListeners(): void {
    this._powerSaveListeners.clear();
  }

  // ─────────────────────────────────────────
  // ISubsystem 接口
  // ─────────────────────────────────────────

  readonly name = 'mobile-settings';
  private _initialized = false;

  init(_deps: ISystemDeps): void { this._initialized = true; }
  update(_dt: number): void { /* 设置系统由用户操作驱动，无需帧更新 */ }
  getState(): MobileSettingsState { return this.getSettingsState(); }
  get isInitialized(): boolean { return this._initialized; }

  /** 重置为默认状态 */
  reset(): void {
    this._powerSaveLevel = PowerSaveLevel.Off;
    this._powerSaveActive = false;
    this._currentBatteryLevel = 100;
    this._isCharging = false;
    this._powerSaveConfig = { ...DEFAULT_POWER_SAVE_CONFIG };
    this._screenAlwaysOn = false;
    this._isInGame = false;
    this._fontSize = FontSizeLevel.Medium;
    this._initialized = false;
    this.clearListeners();
  }

  // ─────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────

  /**
   * 根据当前设置和电量更新省电模式实际激活状态
   */
  private _updatePowerSaveState(): void {
    const wasActive = this._powerSaveActive;

    switch (this._powerSaveLevel) {
      case PowerSaveLevel.On:
        this._powerSaveActive = true;
        break;
      case PowerSaveLevel.Auto:
        this._powerSaveActive =
          !this._isCharging &&
          this._currentBatteryLevel <= this._powerSaveConfig.autoTriggerBatteryLevel;
        break;
      case PowerSaveLevel.Off:
      default:
        this._powerSaveActive = false;
        break;
    }

    // 状态变更时通知
    if (wasActive !== this._powerSaveActive) {
      this._notifyPowerSaveChange();
    }
  }

  private _notifyPowerSaveChange(): void {
    const state = this.getPowerSaveState();
    for (const listener of this._powerSaveListeners) {
      listener(state);
    }
  }
}
