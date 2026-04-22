/**
 * 账号系统
 *
 * v19.0 账号管理引擎，职责：
 * - 账号绑定（手机号/邮箱/第三方）
 * - 首次绑定奖励（元宝×50）
 * - 多设备管理（最多5台+主力设备标记+解绑24h冷却）
 * - 账号删除流程（确认文字→二次确认→7天冷静期→永久删除）
 * - 游客账号30天自动清除
 *
 * @module engine/settings/AccountSystem
 */

import { BindMethod, MAX_DEVICES, FIRST_BIND_REWARD } from '../../core/settings';
import type { BindingInfo, DeviceInfo, AccountSettings } from '../../core/settings';
import {
  type AccountResult,
  type BindResult,
  type DeviceResult,
  type AccountChangeCallback,
  type GrantIngotFn,
  type NowFn,
  DeleteFlowState,
  type DeleteFlowData,
  UNBIND_COOLDOWN_MS,
} from './account.types';
import {
  initiateDelete as doInitiateDelete,
  confirmDelete as doConfirmDelete,
  checkDeleteCooldown as doCheckDeleteCooldown,
  executeDelete as doExecuteDelete,
  cancelDelete as doCancelDelete,
  isGuestExpired as checkGuestExpired,
  getGuestRemainingDays as calcGuestRemainingDays,
} from './account-delete-flow';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// 重导出类型供外部使用
export type {
  AccountResult,
  BindResult,
  DeviceResult,
  AccountChangeCallback,
  SpendIngotFn,
  GrantIngotFn,
  NowFn,
  DeleteFlowData,
} from './account.types';
export { DeleteFlowState } from './account.types';

// ─────────────────────────────────────────────
// 账号系统
// ─────────────────────────────────────────────

/**
 * 账号系统
 *
 * 管理账号绑定、多设备和删除流程。
 *
 * @example
 * ```ts
 * const account = new AccountSystem();
 * account.initialize(settings);
 *
 * // 绑定手机号
 * const result = account.bind(BindMethod.Phone, '138****1234');
 * if (result.rewardGranted) {
 *   grantIngot(result.rewardAmount);
 * }
 *
 * // 管理设备
 * account.registerDevice('dev1', 'iPhone 15');
 * ```
 */
export class AccountSystem implements ISubsystem {
  readonly name = 'account' as const;
  private deps!: ISystemDeps;
  private settings: AccountSettings | null = null;
  private deleteFlow: DeleteFlowData | null = null;
  private listeners: AccountChangeCallback[] = [];
  private nowFn: NowFn;
  private grantIngotFn: GrantIngotFn | null = null;

  constructor(nowFn?: NowFn | { nowFn: NowFn }) {
    this.nowFn =
      typeof nowFn === 'function'
        ? nowFn
        : nowFn && typeof nowFn.nowFn === 'function'
          ? nowFn.nowFn
          : () => Date.now();
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留 */ }
  getState(): unknown { return this.settings; }

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /** 初始化账号系统 */
  initialize(settings: AccountSettings): void {
    this.settings = { ...settings };
    this.deleteFlow = null;
  }

  /** 设置元宝奖励函数 */
  setGrantIngotFn(fn: GrantIngotFn): void {
    this.grantIngotFn = fn;
  }

  /** 获取当前账号设置 */
  getSettings(): Readonly<AccountSettings> | null {
    return this.settings;
  }

  // ─────────────────────────────────────────
  // 账号绑定
  // ─────────────────────────────────────────

  /** 绑定账号 */
  bind(method: BindMethod, identifier: string): BindResult {
    if (!this.settings) {
      return { success: false, message: '未初始化', rewardGranted: false, rewardAmount: 0 };
    }

    const existing = this.settings.bindings.find((b) => b.method === method);
    if (existing) {
      return { success: false, message: '该方式已绑定', rewardGranted: false, rewardAmount: 0 };
    }

    const binding: BindingInfo = {
      method,
      identifier,
      boundAt: this.nowFn(),
    };
    this.settings = {
      ...this.settings,
      bindings: [...this.settings.bindings, binding],
      isGuest: false,
    };

    let rewardGranted = false;
    let rewardAmount = 0;
    if (!this.settings.firstBindRewardClaimed) {
      rewardGranted = true;
      rewardAmount = FIRST_BIND_REWARD;
      this.settings = {
        ...this.settings,
        firstBindRewardClaimed: true,
      };
      this.grantIngotFn?.(rewardAmount);
    }

    this.notifyListeners();
    return { success: true, message: '绑定成功', rewardGranted, rewardAmount };
  }

  /** 解绑账号 */
  unbind(method: BindMethod): AccountResult {
    if (!this.settings) {
      return { success: false, message: '未初始化' };
    }

    const idx = this.settings.bindings.findIndex((b) => b.method === method);
    if (idx === -1) {
      return { success: false, message: '未找到该绑定' };
    }

    if (this.settings.bindings.length <= 1) {
      return { success: false, message: '至少保留一个绑定方式' };
    }

    const newBindings = this.settings.bindings.filter((_, i) => i !== idx);
    this.settings = {
      ...this.settings,
      bindings: newBindings,
    };

    this.notifyListeners();
    return { success: true, message: '解绑成功' };
  }

  /** 检查是否已绑定指定方式 */
  hasBinding(method: BindMethod): boolean {
    if (!this.settings) return false;
    return this.settings.bindings.some((b) => b.method === method);
  }

  /** 获取所有绑定信息 */
  getBindings(): Readonly<BindingInfo>[] {
    if (!this.settings) return [];
    return [...this.settings.bindings];
  }

  // ─────────────────────────────────────────
  // 多设备管理
  // ─────────────────────────────────────────

  /** 注册设备 */
  registerDevice(deviceId: string, deviceName: string): DeviceResult {
    if (!this.settings) {
      return { success: false, message: '未初始化', devices: [] };
    }

    const now = this.nowFn();
    const existing = this.settings.devices.find((d) => d.deviceId === deviceId);

    if (existing) {
      const updated = this.settings.devices.map((d) =>
        d.deviceId === deviceId ? { ...d, lastActiveAt: now } : d,
      );
      this.settings = { ...this.settings, devices: updated };
      this.notifyListeners();
      return { success: true, message: '设备已更新', devices: [...this.settings.devices] };
    }

    if (this.settings.devices.length >= MAX_DEVICES) {
      return {
        success: false,
        message: `最多绑定${MAX_DEVICES}台设备`,
        devices: [...this.settings.devices],
      };
    }

    const isFirst = this.settings.devices.length === 0;
    const device: DeviceInfo = {
      deviceId,
      deviceName,
      isPrimary: isFirst,
      lastActiveAt: now,
    };
    this.settings = {
      ...this.settings,
      devices: [...this.settings.devices, device],
    };

    this.notifyListeners();
    return { success: true, message: '设备注册成功', devices: [...this.settings.devices] };
  }

  /** 解绑设备 */
  unregisterDevice(deviceId: string): DeviceResult {
    if (!this.settings) {
      return { success: false, message: '未初始化', devices: [] };
    }

    const device = this.settings.devices.find((d) => d.deviceId === deviceId);
    if (!device) {
      return { success: false, message: '未找到该设备', devices: [...this.settings.devices] };
    }

    if (this.settings.devices.length <= 1) {
      return { success: false, message: '至少保留一台设备', devices: [...this.settings.devices] };
    }

    const wasPrimary = device.isPrimary;
    const newDevices = this.settings.devices.filter((d) => d.deviceId !== deviceId);

    if (wasPrimary && newDevices.length > 0) {
      const latest = newDevices.reduce((a, b) =>
        a.lastActiveAt > b.lastActiveAt ? a : b,
      );
      const idx = newDevices.indexOf(latest);
      newDevices[idx] = { ...latest, isPrimary: true };
    }

    this.settings = { ...this.settings, devices: newDevices };
    this.notifyListeners();
    return { success: true, message: '设备已解绑', devices: [...this.settings.devices] };
  }

  /** 设置主力设备 */
  setPrimaryDevice(deviceId: string): DeviceResult {
    if (!this.settings) {
      return { success: false, message: '未初始化', devices: [] };
    }

    const exists = this.settings.devices.some((d) => d.deviceId === deviceId);
    if (!exists) {
      return { success: false, message: '未找到该设备', devices: [...this.settings.devices] };
    }

    const newDevices = this.settings.devices.map((d) => ({
      ...d,
      isPrimary: d.deviceId === deviceId,
    }));
    this.settings = { ...this.settings, devices: newDevices };

    this.notifyListeners();
    return { success: true, message: '主力设备已设置', devices: [...this.settings.devices] };
  }

  /** 检查设备是否在解绑冷却中 */
  isDeviceInUnbindCooldown(unbindTimestamp: number): boolean {
    return this.nowFn() - unbindTimestamp < UNBIND_COOLDOWN_MS;
  }

  /** 获取所有设备 */
  getDevices(): Readonly<DeviceInfo>[] {
    if (!this.settings) return [];
    return [...this.settings.devices];
  }

  /** 获取主力设备 */
  getPrimaryDevice(): DeviceInfo | null {
    if (!this.settings) return null;
    return this.settings.devices.find((d) => d.isPrimary) ?? null;
  }

  // ─────────────────────────────────────────
  // 账号删除流程
  // ─────────────────────────────────────────

  /** 发起账号删除（步骤1：输入确认文字） */
  initiateDelete(confirmText: string): AccountResult {
    if (!this.settings) {
      return { success: false, message: '未初始化' };
    }

    const { result, flow } = doInitiateDelete(
      confirmText,
      this.settings,
      this.deleteFlow,
      this.nowFn,
    );
    this.deleteFlow = flow;
    if (result.success) this.notifyListeners();
    return result;
  }

  /** 二次确认删除（步骤2：进入冷静期） */
  confirmDelete(): AccountResult {
    const { result, flow } = doConfirmDelete(this.deleteFlow, this.nowFn);
    this.deleteFlow = flow;
    return result;
  }

  /** 检查冷静期是否结束 */
  checkDeleteCooldown(): DeleteFlowData | null {
    this.deleteFlow = doCheckDeleteCooldown(this.deleteFlow, this.nowFn);
    return this.deleteFlow ? { ...this.deleteFlow } : null;
  }

  /** 执行永久删除（步骤3：冷静期结束后） */
  executeDelete(): AccountResult {
    if (!this.settings) {
      return { success: false, message: '未初始化' };
    }

    const { result, resetSettings } = doExecuteDelete(this.deleteFlow, this.settings);
    if (resetSettings) {
      this.settings = resetSettings;
      this.deleteFlow = null;
      this.notifyListeners();
    }
    return result;
  }

  /** 撤销删除（冷静期内） */
  cancelDelete(): AccountResult {
    const { result, flow } = doCancelDelete(this.deleteFlow);
    this.deleteFlow = flow;
    return result;
  }

  /** 获取删除流程状态 */
  getDeleteFlow(): DeleteFlowData | null {
    return this.deleteFlow ? { ...this.deleteFlow } : null;
  }

  // ─────────────────────────────────────────
  // 游客账号
  // ─────────────────────────────────────────

  /** 检查游客账号是否过期 */
  isGuestExpired(createdAt: number): boolean {
    if (!this.settings) return false;
    return checkGuestExpired(this.settings, createdAt, this.nowFn);
  }

  /** 获取游客账号剩余天数 */
  getGuestRemainingDays(createdAt: number): number {
    if (!this.settings) return 0;
    return calcGuestRemainingDays(this.settings, createdAt, this.nowFn);
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /** 注册账号变更回调 */
  onChange(callback: AccountChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** 移除所有监听器 */
  removeAllListeners(): void {
    this.listeners = [];
  }

  /** 重置到初始状态 */
  reset(): void {
    this.settings = null;
    this.deleteFlow = null;
    this.listeners = [];
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  private notifyListeners(): void {
    if (!this.settings) return;
    for (const cb of this.listeners) {
      try {
        cb(this.settings!);
      } catch {
        // 不阻断
      }
    }
  }
}
