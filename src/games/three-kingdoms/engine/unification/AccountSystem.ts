/**
 * 引擎层 — 账号管理系统
 *
 * 管理玩家账号的完整生命周期：
 *   - 账号绑定（手机号/邮箱/第三方）
 *   - 多设备管理（最多5台+主力设备标记+解绑冷却）
 *   - 账号删除（确认→冷静期→永久删除）
 *   - 首次绑定奖励（元宝×50）
 *   - 游客账号管理
 *
 * 功能覆盖：
 *   #11 账号绑定 — 手机号/邮箱/第三方+首次绑定元宝×50
 *   #13 多设备管理 — 最大5台+主力设备标记+解绑24h冷却+冲突策略
 *   #15 账号删除 — 输入确认文字→二次确认→7天冷静期→永久删除
 *
 * @module engine/unification/AccountSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  BindResult,
  DeviceUnbindResult,
  AccountDeleteRequest,
} from '../../core/unification';
import { AccountStatus } from '../../core/unification';
import {
  BindMethod,
} from '../../core/settings';
import type {
  BindingInfo,
  DeviceInfo,
  AccountSettings,
} from '../../core/settings';
import {
  MAX_DEVICES,
  FIRST_BIND_REWARD,
  ACCOUNT_DELETE_COOLDOWN_DAYS,
  DEVICE_UNBIND_COOLDOWN_HOURS,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 内部常量
// ─────────────────────────────────────────────

/** 确认删除文字 */
const DELETE_CONFIRM_TEXT = '确认删除';

// ─────────────────────────────────────────────
// 账号管理系统
// ─────────────────────────────────────────────

/**
 * 账号管理系统
 *
 * 管理绑定、设备、删除流程。
 */
export class AccountSystem implements ISubsystem {
  readonly name = 'account';

  private deps!: ISystemDeps;
  private status: AccountStatus = AccountStatus.Guest;
  private bindings: BindingInfo[] = [];
  private devices: DeviceInfo[] = [];
  private deleteRequest: AccountDeleteRequest | null = null;
  private firstBindRewardClaimed = false;
  /** 当前设备 ID */
  private currentDeviceId: string;
  /** 解绑冷却记录：deviceId → 冷却结束时间 */
  private unbindCooldowns = new Map<string, number>();

  constructor() {
    this.currentDeviceId = this.generateDeviceId();
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    // 将当前设备注册到设备列表
    this.registerCurrentDevice();
  }

  update(_dt: number): void {
    // 检查冷静期是否已过（账号删除）
    if (this.deleteRequest && !this.deleteRequest.revoked) {
      if (Date.now() >= this.deleteRequest.cooldownEndsAt) {
        this.status = AccountStatus.Deleted;
      }
    }
  }

  getState(): AccountSettings {
    return {
      bindings: this.bindings.map(b => ({ ...b })),
      isGuest: this.status === AccountStatus.Guest,
      firstBindRewardClaimed: this.firstBindRewardClaimed,
      cloudSyncFrequency: 'onExit' as any,
      wifiOnlySync: false,
      conflictStrategy: 'alwaysAsk' as any,
      devices: this.devices.map(d => ({ ...d })),
      saveSlots: [],
      lastAutoSaveAt: 0,
      deleteRequest: this.deleteRequest ? { ...this.deleteRequest } : null,
      currentDeviceId: this.currentDeviceId,
      unbindCooldowns: Object.fromEntries(this.unbindCooldowns),
    };
  }

  reset(): void {
    this.status = AccountStatus.Guest;
    this.bindings = [];
    this.devices = [];
    this.deleteRequest = null;
    this.firstBindRewardClaimed = false;
    this.unbindCooldowns.clear();
    this.currentDeviceId = this.generateDeviceId();
  }

  // ─── 设置同步 ─────────────────────────────

  /** 从 SettingsManager 同步账号设置 */
  syncAccountSettings(settings: AccountSettings): void {
    this.bindings = settings.bindings.map(b => ({ ...b }));
    this.firstBindRewardClaimed = settings.firstBindRewardClaimed;
    this.devices = settings.devices.map(d => ({ ...d }));
    this.status = settings.isGuest ? AccountStatus.Guest : AccountStatus.Bound;
    // 恢复持久化字段
    if (settings.deleteRequest !== undefined) {
      this.deleteRequest = settings.deleteRequest ? { ...settings.deleteRequest } : null;
    }
    if (settings.currentDeviceId !== undefined) {
      this.currentDeviceId = settings.currentDeviceId;
    }
    if (settings.unbindCooldowns !== undefined) {
      this.unbindCooldowns = new Map(Object.entries(settings.unbindCooldowns));
    }
  }

  // ─── 账号绑定 (#11) ──────────────────────

  /** 绑定账号 */
  bind(method: BindMethod, identifier: string): BindResult {
    // 检查是否已绑定相同方式
    if (this.bindings.some(b => b.method === method)) {
      return {
        success: false,
        method,
        error: 'Already bound with this method',
        rewardGranted: false,
      };
    }

    // 脱敏处理
    const maskedId = this.maskIdentifier(identifier);

    const binding: BindingInfo = {
      method,
      identifier: maskedId,
      boundAt: Date.now(),
    };

    this.bindings.push(binding);

    // 从游客转为绑定状态
    const wasGuest = this.status === AccountStatus.Guest;
    this.status = AccountStatus.Bound;

    // 首次绑定奖励
    let rewardGranted = false;
    if (!this.firstBindRewardClaimed) {
      this.firstBindRewardClaimed = true;
      rewardGranted = true;
      this.deps?.eventBus?.emit('account:firstBindReward', {
        reward: FIRST_BIND_REWARD,
        currency: 'ingot',
      });
    }

    this.deps?.eventBus?.emit('account:bound', { method, wasGuest });

    return {
      success: true,
      method,
      rewardGranted,
    };
  }

  /** 解绑账号 */
  unbind(method: BindMethod): BindResult {
    const index = this.bindings.findIndex(b => b.method === method);
    if (index === -1) {
      return {
        success: false,
        method,
        error: 'Binding not found',
        rewardGranted: false,
      };
    }

    // 至少保留一个绑定
    if (this.bindings.length <= 1) {
      return {
        success: false,
        method,
        error: 'Cannot remove the last binding',
        rewardGranted: false,
      };
    }

    this.bindings.splice(index, 1);

    return {
      success: true,
      method,
      rewardGranted: false,
    };
  }

  /** 获取所有绑定 */
  getBindings(): BindingInfo[] {
    return this.bindings.map(b => ({ ...b }));
  }

  /** 是否已绑定 */
  isBound(): boolean {
    return this.status === AccountStatus.Bound;
  }

  /** 是否游客 */
  isGuest(): boolean {
    return this.status === AccountStatus.Guest;
  }

  /** 是否已领取首次绑定奖励 */
  isFirstBindRewardClaimed(): boolean {
    return this.firstBindRewardClaimed;
  }

  /** 获取首次绑定奖励金额 */
  getFirstBindReward(): number {
    return FIRST_BIND_REWARD;
  }

  // ─── 多设备管理 (#13) ────────────────────

  /** 获取所有设备 */
  getDevices(): DeviceInfo[] {
    return this.devices.map(d => ({ ...d }));
  }

  /** 获取设备数量 */
  getDeviceCount(): number {
    return this.devices.length;
  }

  /** 获取最大设备数 */
  getMaxDevices(): number {
    return MAX_DEVICES;
  }

  /** 设置主力设备 */
  setPrimaryDevice(deviceId: string): boolean {
    const device = this.devices.find(d => d.deviceId === deviceId);
    if (!device) return false;

    // 取消其他设备的主力标记
    for (const d of this.devices) {
      d.isPrimary = false;
    }
    device.isPrimary = true;

    return true;
  }

  /** 解绑设备 */
  unbindDevice(deviceId: string): DeviceUnbindResult {
    // 不能解绑当前设备
    if (deviceId === this.currentDeviceId) {
      return {
        success: false,
        error: 'Cannot unbind current device',
      };
    }

    // 检查冷却
    const cooldownEnd = this.unbindCooldowns.get(deviceId);
    if (cooldownEnd && Date.now() < cooldownEnd) {
      return {
        success: false,
        error: 'Cooldown active',
        cooldownEndsAt: cooldownEnd,
      };
    }

    const index = this.devices.findIndex(d => d.deviceId === deviceId);
    if (index === -1) {
      return {
        success: false,
        error: 'Device not found',
      };
    }

    this.devices.splice(index, 1);

    // 设置冷却（对同一设备 ID）
    const cooldownEndAt = Date.now() + DEVICE_UNBIND_COOLDOWN_HOURS * 3600 * 1000;
    this.unbindCooldowns.set(deviceId, cooldownEndAt);

    return { success: true };
  }

  /** 检查是否可以添加设备 */
  canAddDevice(): boolean {
    return this.devices.length < MAX_DEVICES;
  }

  /** 获取当前设备 ID */
  getCurrentDeviceId(): string {
    return this.currentDeviceId;
  }

  /** 获取主力设备 */
  getPrimaryDevice(): DeviceInfo | null {
    return this.devices.find(d => d.isPrimary) ?? null;
  }

  // ─── 账号删除 (#15) ──────────────────────

  /** 请求删除账号（第一步：输入确认文字） */
  requestDelete(confirmText: string): { success: boolean; error?: string } {
    if (this.status === AccountStatus.Guest) {
      return { success: false, error: 'Guest account cannot be deleted' };
    }

    if (confirmText !== DELETE_CONFIRM_TEXT) {
      return { success: false, error: 'Confirmation text does not match' };
    }

    return { success: true };
  }

  /** 确认删除账号（第二步：二次确认 → 进入冷静期） */
  confirmDelete(): { success: boolean; cooldownEndsAt: number } {
    if (this.status === AccountStatus.PendingDelete) {
      return { success: false, cooldownEndsAt: 0 };
    }

    const now = Date.now();
    this.deleteRequest = {
      requestedAt: now,
      cooldownEndsAt: now + ACCOUNT_DELETE_COOLDOWN_DAYS * 24 * 3600 * 1000,
      revoked: false,
    };
    this.status = AccountStatus.PendingDelete;

    this.deps?.eventBus?.emit('account:deleteRequested', {
      cooldownEndsAt: this.deleteRequest.cooldownEndsAt,
    });

    return {
      success: true,
      cooldownEndsAt: this.deleteRequest.cooldownEndsAt,
    };
  }

  /** 撤销删除（冷静期内） */
  revokeDelete(): boolean {
    if (!this.deleteRequest || this.deleteRequest.revoked) {
      return false;
    }

    if (Date.now() >= this.deleteRequest.cooldownEndsAt) {
      return false; // 冷静期已过
    }

    this.deleteRequest.revoked = true;
    this.status = AccountStatus.Bound;
    this.deleteRequest = null;

    this.deps?.eventBus?.emit('account:deleteRevoked', {});

    return true;
  }

  /** 获取删除请求状态 */
  getDeleteRequest(): AccountDeleteRequest | null {
    return this.deleteRequest ? { ...this.deleteRequest } : null;
  }

  /** 获取账号状态 */
  getAccountStatus(): AccountStatus {
    return this.status;
  }

  /** 获取冷静期天数 */
  getCooldownDays(): number {
    return ACCOUNT_DELETE_COOLDOWN_DAYS;
  }

  // ─── 内部方法 ────────────────────────────

  /** 注册当前设备 */
  private registerCurrentDevice(): void {
    if (!this.devices.some(d => d.deviceId === this.currentDeviceId)) {
      this.devices.push({
        deviceId: this.currentDeviceId,
        deviceName: 'Current Device',
        isPrimary: this.devices.length === 0,
        lastActiveAt: Date.now(),
      });
    }
  }

  /** 生成设备 ID */
  private generateDeviceId(): string {
    return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /** 脱敏标识符 */
  private maskIdentifier(id: string): string {
    if (id.length <= 4) return '****';
    return id.substring(0, 2) + '****' + id.substring(id.length - 2);
  }
}
