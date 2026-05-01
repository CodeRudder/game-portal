/**
 * 省电模式系统
 *
 * 职责：
 * - #11 省电模式（降低帧率至30fps + 关闭粒子特效 + 自动检测低电量）
 * - #13 屏幕常亮（游戏中保持屏幕不熄灭 + 可配置开关）
 *
 * 设计原则：
 * - 纯逻辑引擎，不直接操作浏览器API
 * - 通过回调通知状态变更
 * - 可在测试环境中完整验证
 *
 * @module engine/responsive/PowerSaveSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

import {
  PowerSaveLevel,
  type PowerSaveConfig,
  type PowerSaveState,
  type OnPowerSaveChange,
} from '../../core/responsive/responsive.types';

// ─────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────

/** 省电模式默认配置 */
const DEFAULT_POWER_SAVE_CONFIG: PowerSaveConfig = {
  targetFps: 30,
  disableParticles: true,
  disableShadows: true,
  autoTriggerBatteryLevel: 20,
};

/** 正常模式帧率 */
const NORMAL_FPS = 60;

/** 省电模式帧率 */
const POWER_SAVE_FPS = 30;

// ─────────────────────────────────────────────
// PowerSaveSystem
// ─────────────────────────────────────────────

/**
 * 省电模式系统
 *
 * 管理省电模式开关、自动检测低电量、帧率控制。
 */
export class PowerSaveSystem implements ISubsystem {
  // ── 状态 ──
  private _level: PowerSaveLevel = PowerSaveLevel.Off;
  private _isActive: boolean = false;
  private _currentFps: number = NORMAL_FPS;
  private _config: PowerSaveConfig = { ...DEFAULT_POWER_SAVE_CONFIG };

  // ── 屏幕常亮 (#13) ──
  private _screenAlwaysOn: boolean = false;

  // ── 电池状态 ──
  private _batteryLevel: number | null = null;
  private _isCharging: boolean = false;

  // ── 回调列表 ──
  private readonly _listeners: Set<OnPowerSaveChange> = new Set();

  // ─────────────────────────────────────────
  // 公共属性
  // ─────────────────────────────────────────

  /** 当前省电模式等级 */
  get level(): PowerSaveLevel {
    return this._level;
  }

  /** 省电模式是否激活 */
  get isActive(): boolean {
    return this._isActive;
  }

  /** 当前帧率 */
  get currentFps(): number {
    return this._currentFps;
  }

  /** 配置 */
  get config(): PowerSaveConfig {
    return { ...this._config };
  }

  /** 屏幕常亮状态 */
  get screenAlwaysOn(): boolean {
    return this._screenAlwaysOn;
  }

  /** 电池电量（0-100，null表示未知） */
  get batteryLevel(): number | null {
    return this._batteryLevel;
  }

  /** 是否正在充电 */
  get isCharging(): boolean {
    return this._isCharging;
  }

  /** 完整状态快照 */
  get state(): PowerSaveState {
    return {
      level: this._level,
      isActive: this._isActive,
      currentFps: this._currentFps,
      config: { ...this._config },
    };
  }

  // ─────────────────────────────────────────
  // ISubsystem 接口
  // ─────────────────────────────────────────

  readonly name = 'power-save';
  private _initialized = false;

  init(_deps: ISystemDeps): void { this._initialized = true; }
  update(_dt: number): void { /* 省电模式由事件驱动，无需帧更新 */ }
  getState(): PowerSaveState { return this.state; }
  get isInitialized(): boolean { return this._initialized; }

  // ─────────────────────────────────────────
  // 省电模式控制 (#11)
  // ─────────────────────────────────────────

  /**
   * 设置省电模式等级
   *
   * @param level - 省电模式等级
   */
  setLevel(level: PowerSaveLevel): void {
    this._level = level;
    this._updateActiveState();
  }

  /**
   * 手动开启省电模式
   */
  enable(): void {
    this._level = PowerSaveLevel.On;
    this._updateActiveState();
  }

  /**
   * 手动关闭省电模式
   */
  disable(): void {
    this._level = PowerSaveLevel.Off;
    this._updateActiveState();
  }

  /**
   * 更新电池状态
   *
   * 用于自动检测低电量场景。当电量低于阈值时自动开启省电模式，
   * 充电或电量恢复后自动关闭。
   *
   * @param batteryLevel - 电池电量（0-100）
   * @param isCharging - 是否正在充电
   */
  updateBatteryStatus(batteryLevel: number, isCharging: boolean): void {
    if (!Number.isFinite(batteryLevel) || batteryLevel < 0) return;
    this._batteryLevel = batteryLevel;
    this._isCharging = isCharging;

    // 仅在Auto模式下自动调整
    if (this._level === PowerSaveLevel.Auto) {
      this._updateActiveState();
    }
  }

  /**
   * 更新省电模式配置
   *
   * @param config - 新的配置（部分更新）
   */
  updateConfig(config: Partial<PowerSaveConfig>): void {
    if (config.targetFps !== undefined && (!Number.isFinite(config.targetFps) || config.targetFps <= 0)) {
      config.targetFps = POWER_SAVE_FPS;
    }
    if (config.autoTriggerBatteryLevel !== undefined &&
        (!Number.isFinite(config.autoTriggerBatteryLevel) || config.autoTriggerBatteryLevel < 0 || config.autoTriggerBatteryLevel > 100)) {
      config.autoTriggerBatteryLevel = DEFAULT_POWER_SAVE_CONFIG.autoTriggerBatteryLevel;
    }
    this._config = { ...this._config, ...config };
    // 配置变更后重新评估
    this._updateActiveState();
  }

  /**
   * 检查是否应该禁用粒子特效
   */
  shouldDisableParticles(): boolean {
    return this._isActive && this._config.disableParticles;
  }

  /**
   * 检查是否应该禁用阴影
   */
  shouldDisableShadows(): boolean {
    return this._isActive && this._config.disableShadows;
  }

  /**
   * 获取目标帧率
   */
  getTargetFps(): number {
    return this._isActive ? this._config.targetFps : NORMAL_FPS;
  }

  // ─────────────────────────────────────────
  // 屏幕常亮 (#13)
  // ─────────────────────────────────────────

  /**
   * 设置屏幕常亮
   *
   * @param enabled - 是否启用
   */
  setScreenAlwaysOn(enabled: boolean): void {
    this._screenAlwaysOn = enabled;
  }

  /**
   * 切换屏幕常亮状态
   *
   * @returns 切换后的状态
   */
  toggleScreenAlwaysOn(): boolean {
    this._screenAlwaysOn = !this._screenAlwaysOn;
    return this._screenAlwaysOn;
  }

  // ─────────────────────────────────────────
  // 帧率控制辅助
  // ─────────────────────────────────────────

  /**
   * 计算帧间隔时间（ms）
   *
   * 用于requestAnimationFrame或setInterval的帧率控制。
   *
   * @returns 帧间隔时间（ms）
   */
  getFrameInterval(): number {
    return 1000 / this.getTargetFps();
  }

  /**
   * 判断是否应该跳过当前帧（节流）
   *
   * @param lastFrameTime - 上一帧时间戳
   * @param currentTime - 当前时间戳
   * @returns true表示应该跳过
   */
  shouldSkipFrame(lastFrameTime: number, currentTime: number): boolean {
    if (!Number.isFinite(lastFrameTime) || !Number.isFinite(currentTime)) return false;
    const interval = this.getFrameInterval();
    return currentTime - lastFrameTime < interval;
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册省电模式变更监听器
   */
  onStateChange(listener: OnPowerSaveChange): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * 清除所有监听器
   */
  clearListeners(): void {
    this._listeners.clear();
  }

  // ─────────────────────────────────────────
  // 重置
  // ─────────────────────────────────────────

  /**
   * 重置为默认状态
   */
  reset(): void {
    this._level = PowerSaveLevel.Off;
    this._isActive = false;
    this._currentFps = NORMAL_FPS;
    this._config = { ...DEFAULT_POWER_SAVE_CONFIG };
    this._screenAlwaysOn = false;
    this._batteryLevel = null;
    this._isCharging = false;
    this._initialized = false;
    this.clearListeners();
  }

  // ─────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────

  /**
   * 根据当前等级和电池状态更新激活状态
   */
  private _updateActiveState(): void {
    const wasActive = this._isActive;

    switch (this._level) {
      case PowerSaveLevel.On:
        this._isActive = true;
        break;

      case PowerSaveLevel.Auto:
        // 自动模式：电量低于阈值且未充电时激活
        if (this._batteryLevel !== null) {
          this._isActive =
            this._batteryLevel <= this._config.autoTriggerBatteryLevel &&
            !this._isCharging;
        } else {
          // 电池状态未知时不激活
          this._isActive = false;
        }
        break;

      case PowerSaveLevel.Off:
      default:
        this._isActive = false;
        break;
    }

    // 更新帧率
    this._currentFps = this._isActive ? this._config.targetFps : NORMAL_FPS;

    // 状态变更时通知
    if (wasActive !== this._isActive) {
      this._notifyListeners();
    }
  }

  /**
   * 通知所有监听器
   */
  private _notifyListeners(): void {
    const state = this.state;
    for (const listener of this._listeners) {
      listener(state);
    }
  }
}
