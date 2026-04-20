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

import {
  BindMethod,
  MAX_DEVICES,
  FIRST_BIND_REWARD,
  ACCOUNT_DELETE_COOLDOWN_DAYS,
  DEVICE_UNBIND_COOLDOWN_HOURS,
} from '../../core/settings';
import type {
  BindingInfo,
  DeviceInfo,
  AccountSettings,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 账号操作结果 */
export interface AccountResult {
  success: boolean;
  message: string;
}

/** 绑定操作结果（含奖励信息） */
export interface BindResult extends AccountResult {
  /** 是否触发了首次绑定奖励 */
  rewardGranted: boolean;
  /** 奖励元宝数量 */
  rewardAmount: number;
}

/** 设备操作结果 */
export interface DeviceResult extends AccountResult {
  /** 更新后的设备列表 */
  devices: DeviceInfo[];
}

/** 删除流程状态 */
export enum DeleteFlowState {
  /** 未发起 */
  None = 'none',
  /** 已输入确认文字 */
  Confirmed = 'confirmed',
  /** 二次确认完成，冷静期中 */
  CoolingDown = 'coolingDown',
  /** 冷静期结束，可永久删除 */
  ReadyToDelete = 'readyToDelete',
}

/** 删除流程数据 */
export interface DeleteFlowData {
  /** 当前状态 */
  state: DeleteFlowState;
  /** 发起时间 */
  initiatedAt: number;
  /** 冷静期结束时间 */
  cooldownEndAt: number;
}

/** 账号变更回调 */
export type AccountChangeCallback = (
  settings: Readonly<AccountSettings>,
) => void;

/** 元宝消耗函数签名 */
export type SpendIngotFn = (amount: number) => boolean;

/** 元宝奖励函数签名 */
export type GrantIngotFn = (amount: number) => void;

/** 当前时间函数（便于测试注入） */
export type NowFn = () => number;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 确认删除文字 */
const DELETE_CONFIRM_TEXT = '确认删除';

/** 冷静期天数转毫秒 */
const COOLDOWN_MS = ACCOUNT_DELETE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** 设备解绑冷却毫秒 */
const UNBIND_COOLDOWN_MS = DEVICE_UNBIND_COOLDOWN_HOURS * 60 * 60 * 1000;

/** 游客账号清除天数 */
const GUEST_EXPIRE_DAYS = 30;

/** 游客账号清除毫秒 */
const GUEST_EXPIRE_MS = GUEST_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

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
 * account.registerDevice({ id: 'dev1', name: 'iPhone 15' });
 * ```
 */
export class AccountSystem {
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

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化账号系统
   *
   * @param settings - 当前账号设置
   */
  initialize(settings: AccountSettings): void {
    this.settings = { ...settings };
    this.deleteFlow = null;
  }

  /**
   * 设置元宝奖励函数
   */
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

  /**
   * 绑定账号
   *
   * @param method - 绑定方式
   * @param identifier - 绑定标识（脱敏后的）
   * @returns 绑定结果
   */
  bind(method: BindMethod, identifier: string): BindResult {
    if (!this.settings) {
      return { success: false, message: '未初始化', rewardGranted: false, rewardAmount: 0 };
    }

    // 检查是否已绑定相同方式
    const existing = this.settings.bindings.find((b) => b.method === method);
    if (existing) {
      return { success: false, message: '该方式已绑定', rewardGranted: false, rewardAmount: 0 };
    }

    // 添加绑定
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

    // 首次绑定奖励
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

  /**
   * 解绑账号
   *
   * @param method - 要解绑的绑定方式
   * @returns 操作结果
   */
  unbind(method: BindMethod): AccountResult {
    if (!this.settings) {
      return { success: false, message: '未初始化' };
    }

    const idx = this.settings.bindings.findIndex((b) => b.method === method);
    if (idx === -1) {
      return { success: false, message: '未找到该绑定' };
    }

    // 至少保留一个绑定
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

  /**
   * 检查是否已绑定指定方式
   */
  hasBinding(method: BindMethod): boolean {
    if (!this.settings) return false;
    return this.settings.bindings.some((b) => b.method === method);
  }

  /**
   * 获取所有绑定信息
   */
  getBindings(): Readonly<BindingInfo>[] {
    if (!this.settings) return [];
    return [...this.settings.bindings];
  }

  // ─────────────────────────────────────────
  // 多设备管理
  // ─────────────────────────────────────────

  /**
   * 注册设备
   *
   * 如果设备已存在则更新活跃时间，否则添加新设备。
   * 超过最大设备数时返回失败。
   *
   * @param deviceId - 设备ID
   * @param deviceName - 设备名称
   * @returns 操作结果
   */
  registerDevice(deviceId: string, deviceName: string): DeviceResult {
    if (!this.settings) {
      return { success: false, message: '未初始化', devices: [] };
    }

    const now = this.nowFn();
    const existing = this.settings.devices.find((d) => d.deviceId === deviceId);

    if (existing) {
      // 更新活跃时间
      const updated = this.settings.devices.map((d) =>
        d.deviceId === deviceId ? { ...d, lastActiveAt: now } : d,
      );
      this.settings = { ...this.settings, devices: updated };
      this.notifyListeners();
      return { success: true, message: '设备已更新', devices: [...this.settings.devices] };
    }

    // 检查设备数量限制
    if (this.settings.devices.length >= MAX_DEVICES) {
      return {
        success: false,
        message: `最多绑定${MAX_DEVICES}台设备`,
        devices: [...this.settings.devices],
      };
    }

    // 添加新设备（第一个设备自动设为主力）
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

  /**
   * 解绑设备
   *
   * 解绑后需等待24小时冷却才能再次绑定新设备。
   * 主力设备解绑后，最新设备自动升级为主力。
   *
   * @param deviceId - 要解绑的设备ID
   * @returns 操作结果
   */
  unregisterDevice(deviceId: string): DeviceResult {
    if (!this.settings) {
      return { success: false, message: '未初始化', devices: [] };
    }

    const device = this.settings.devices.find((d) => d.deviceId === deviceId);
    if (!device) {
      return { success: false, message: '未找到该设备', devices: [...this.settings.devices] };
    }

    // 不能解绑唯一设备
    if (this.settings.devices.length <= 1) {
      return { success: false, message: '至少保留一台设备', devices: [...this.settings.devices] };
    }

    const wasPrimary = device.isPrimary;
    const newDevices = this.settings.devices.filter((d) => d.deviceId !== deviceId);

    // 如果解绑的是主力设备，最新设备自动升级
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

  /**
   * 设置主力设备
   */
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

  /**
   * 检查设备是否在解绑冷却中
   *
   * @param unbindTimestamp - 解绑操作的时间戳
   * @returns 是否仍在冷却中
   */
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

  /**
   * 发起账号删除（步骤1：输入确认文字）
   *
   * @param confirmText - 用户输入的确认文字
   * @returns 操作结果
   */
  initiateDelete(confirmText: string): AccountResult {
    if (!this.settings) {
      return { success: false, message: '未初始化' };
    }

    if (this.settings.isGuest) {
      return { success: false, message: '游客账号无需删除流程' };
    }

    if (this.deleteFlow && this.deleteFlow.state !== DeleteFlowState.None) {
      return { success: false, message: '删除流程已在进行中' };
    }

    if (confirmText !== DELETE_CONFIRM_TEXT) {
      return { success: false, message: '确认文字不匹配' };
    }

    this.deleteFlow = {
      state: DeleteFlowState.Confirmed,
      initiatedAt: this.nowFn(),
      cooldownEndAt: 0,
    };

    return { success: true, message: '已确认，请进行二次确认' };
  }

  /**
   * 二次确认删除（步骤2）
   *
   * 进入冷静期。
   */
  confirmDelete(): AccountResult {
    if (!this.deleteFlow || this.deleteFlow.state !== DeleteFlowState.Confirmed) {
      return { success: false, message: '请先完成步骤1' };
    }

    const now = this.nowFn();
    this.deleteFlow = {
      ...this.deleteFlow,
      state: DeleteFlowState.CoolingDown,
      cooldownEndAt: now + COOLDOWN_MS,
    };

    return { success: true, message: `已进入${ACCOUNT_DELETE_COOLDOWN_DAYS}天冷静期` };
  }

  /**
   * 检查冷静期是否结束
   */
  checkDeleteCooldown(): DeleteFlowData | null {
    if (!this.deleteFlow) return null;

    if (
      this.deleteFlow.state === DeleteFlowState.CoolingDown &&
      this.nowFn() >= this.deleteFlow.cooldownEndAt
    ) {
      this.deleteFlow = {
        ...this.deleteFlow,
        state: DeleteFlowState.ReadyToDelete,
      };
    }

    return { ...this.deleteFlow };
  }

  /**
   * 执行永久删除（步骤3：冷静期结束后）
   */
  executeDelete(): AccountResult {
    if (!this.deleteFlow || this.deleteFlow.state !== DeleteFlowState.ReadyToDelete) {
      return { success: false, message: '冷静期未结束或未发起删除' };
    }

    // 重置为游客状态
    this.settings = {
      ...this.settings!,
      bindings: [],
      isGuest: true,
      firstBindRewardClaimed: false,
      devices: [],
    };
    this.deleteFlow = null;

    this.notifyListeners();
    return { success: true, message: '账号已永久删除' };
  }

  /**
   * 撤销删除（冷静期内）
   */
  cancelDelete(): AccountResult {
    if (!this.deleteFlow) {
      return { success: false, message: '无进行中的删除流程' };
    }

    if (this.deleteFlow.state === DeleteFlowState.ReadyToDelete) {
      return { success: false, message: '冷静期已结束，请执行删除或联系客服' };
    }

    this.deleteFlow = null;
    return { success: true, message: '删除已撤销' };
  }

  /** 获取删除流程状态 */
  getDeleteFlow(): DeleteFlowData | null {
    return this.deleteFlow ? { ...this.deleteFlow } : null;
  }

  // ─────────────────────────────────────────
  // 游客账号
  // ─────────────────────────────────────────

  /**
   * 检查游客账号是否过期
   *
   * @param createdAt - 游客账号创建时间
   * @returns 是否已过期
   */
  isGuestExpired(createdAt: number): boolean {
    if (!this.settings || !this.settings.isGuest) return false;
    return this.nowFn() - createdAt >= GUEST_EXPIRE_MS;
  }

  /**
   * 获取游客账号剩余天数
   */
  getGuestRemainingDays(createdAt: number): number {
    if (!this.settings || !this.settings.isGuest) return 0;
    const elapsed = this.nowFn() - createdAt;
    const remaining = GUEST_EXPIRE_MS - elapsed;
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册账号变更回调
   * @returns 取消注册函数
   */
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

  // ─────────────────────────────────────────
  // 重置
  // ─────────────────────────────────────────

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
