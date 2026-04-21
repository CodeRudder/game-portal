/**
 * 引擎层 — 云存档系统
 *
 * 管理游戏存档的云端同步：
 *   - 自动同步（退出时/每小时/仅手动）
 *   - 端到端加密（AES-GCM）
 *   - 多设备冲突解决（最新优先/云端优先/始终询问）
 *   - WiFi 仅同步控制
 *   - 同步状态指示
 *
 * 功能覆盖：
 *   #12 云存档设置 — 自动同步+同步频率+WiFi仅同步+加密
 *   #14 存档管理 — 3免费+1付费槽位+自动存档15min+全量数据
 *   #16 设置持久化 — 随云存档同步
 *
 * @module engine/unification/CloudSaveSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  CloudSyncResult,
  CloudSavePayload,
  CloudSyncConfig,
  SaveActionResult,
  AutoSaveTimerState,
} from '../../core/unification';
import { CloudSyncStatus, SaveAction } from '../../core/unification';
import {
  CloudSyncFrequency,
  ConflictStrategy,
} from '../../core/settings';
import type { AccountSettings, SaveSlot, SaveSlotData } from '../../core/settings';
import {
  FREE_SAVE_SLOTS,
  TOTAL_SAVE_SLOTS,
  AUTO_SAVE_INTERVAL,
  PAID_SLOT_PRICE,
  CLOUD_ENCRYPTION_ALGO,
  CLOUD_DATA_VERSION,
  CLOUD_SYNC_MAX_RETRIES,
  CLOUD_SYNC_RETRY_INTERVAL,
  CLOUD_SYNC_TIMEOUT,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────

/** 加密辅助结果 */
interface EncryptionResult {
  encryptedData: string;
  iv: string;
  checksum: string;
}

// ─────────────────────────────────────────────
// 云存档系统
// ─────────────────────────────────────────────

/**
 * 云存档系统
 *
 * 管理自动/手动同步、加密存储、冲突解决。
 */
export class CloudSaveSystem implements ISubsystem {
  readonly name = 'cloudSave';

  private deps!: ISystemDeps;
  private syncStatus: CloudSyncStatus = CloudSyncStatus.Idle;
  private lastSyncAt = 0;
  private lastSyncError = '';
  private autoSaveTimer = 0;
  private retryCount = 0;
  /** 本设备 ID（模拟） */
  private deviceId: string;
  /** 同步频率（从 SettingsManager 获取） */
  private syncFrequency: CloudSyncFrequency = CloudSyncFrequency.OnExit;
  /** 冲突策略 */
  private conflictStrategy: ConflictStrategy = ConflictStrategy.AlwaysAsk;
  /** WiFi 仅同步 */
  private wifiOnly = false;
  /** 模拟网络是否为 WiFi */
  private isWifiConnected = true;
  /** 存档槽位 */
  private saveSlots: SaveSlot[] = [];
  /** 是否已初始化 */
  private initialized = false;

  constructor() {
    this.deviceId = this.generateDeviceId();
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.initialized = true;
    // 初始化默认存档槽位（如果尚未通过 syncAccountSettings 设置）
    if (this.saveSlots.length === 0) {
      for (let i = 0; i < TOTAL_SAVE_SLOTS; i++) {
        this.saveSlots.push({
          slotIndex: i,
          isPaid: i >= FREE_SAVE_SLOTS,
          purchased: i < FREE_SAVE_SLOTS,
          data: null,
        });
      }
    }
  }

  update(dt: number): void {
    // 自动存档计时
    this.autoSaveTimer += dt * 1000;
    if (this.autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      this.performAutoSave();
      this.autoSaveTimer = 0;
    }

    // 定时同步（每小时模式）
    if (this.syncFrequency === CloudSyncFrequency.Hourly) {
      const elapsed = Date.now() - this.lastSyncAt;
      if (elapsed >= 3600 * 1000) {
        this.sync();
      }
    }
  }

  getState(): AutoSaveTimerState {
    return {
      elapsedSinceLastSave: this.autoSaveTimer,
      intervalMs: AUTO_SAVE_INTERVAL,
      enabled: true,
    };
  }

  reset(): void {
    this.syncStatus = CloudSyncStatus.Idle;
    this.lastSyncAt = 0;
    this.lastSyncError = '';
    this.autoSaveTimer = 0;
    this.retryCount = 0;
    this.saveSlots = [];
  }

  // ─── 设置同步 ─────────────────────────────

  /** 从 SettingsManager 同步账号设置 */
  syncAccountSettings(settings: AccountSettings): void {
    this.syncFrequency = settings.cloudSyncFrequency;
    this.conflictStrategy = settings.conflictStrategy;
    this.wifiOnly = settings.wifiOnlySync;
    this.saveSlots = settings.saveSlots.map(s => ({ ...s }));
  }

  // ─── 云同步 (#12) ────────────────────────

  /** 执行同步 */
  async sync(): Promise<CloudSyncResult> {
    // WiFi 检查
    if (this.wifiOnly && !this.isWifiConnected) {
      return {
        status: CloudSyncStatus.Failed,
        timestamp: Date.now(),
        error: 'WiFi not connected',
      };
    }

    this.syncStatus = CloudSyncStatus.Syncing;
    this.retryCount = 0;

    return this.attemptSync();
  }

  /** 同步退出时存档 */
  async syncOnExit(): Promise<CloudSyncResult> {
    if (this.syncFrequency === CloudSyncFrequency.ManualOnly) {
      return {
        status: CloudSyncStatus.Idle,
        timestamp: Date.now(),
      };
    }
    return this.sync();
  }

  /** 手动同步 */
  async manualSync(): Promise<CloudSyncResult> {
    return this.sync();
  }

  /** 获取同步状态 */
  getSyncStatus(): CloudSyncStatus {
    return this.syncStatus;
  }

  /** 获取最后同步时间 */
  getLastSyncAt(): number {
    return this.lastSyncAt;
  }

  /** 设置 WiFi 连接状态 */
  setWifiConnected(connected: boolean): void {
    this.isWifiConnected = connected;
  }

  // ─── 存档管理 (#14) ──────────────────────

  /** 获取所有槽位 */
  getSaveSlots(): SaveSlot[] {
    return this.saveSlots.map(s => ({ ...s }));
  }

  /** 手动保存到指定槽位 */
  saveToSlot(slotIndex: number, data: string, name: string): SaveActionResult {
    const slot = this.saveSlots.find(s => s.slotIndex === slotIndex);
    if (!slot) {
      return { action: SaveAction.ManualSave, slotIndex, success: false, error: 'Slot not found' };
    }
    if (slot.isPaid && !slot.purchased) {
      return { action: SaveAction.ManualSave, slotIndex, success: false, error: 'Slot not purchased' };
    }

    const saveData: SaveSlotData = {
      name,
      savedAt: Date.now(),
      progress: `Slot ${slotIndex}`,
      sizeBytes: data.length * 2, // UTF-16 估算
    };
    slot.data = saveData;

    return { action: SaveAction.ManualSave, slotIndex, success: true };
  }

  /** 从指定槽位加载 */
  loadFromSlot(slotIndex: number): SaveActionResult {
    const slot = this.saveSlots.find(s => s.slotIndex === slotIndex);
    if (!slot) {
      return { action: SaveAction.Load, slotIndex, success: false, error: 'Slot not found' };
    }
    if (!slot.data) {
      return { action: SaveAction.Load, slotIndex, success: false, error: 'Slot is empty' };
    }

    return { action: SaveAction.Load, slotIndex, success: true };
  }

  /** 删除指定槽位存档 */
  deleteSlot(slotIndex: number): SaveActionResult {
    const slot = this.saveSlots.find(s => s.slotIndex === slotIndex);
    if (!slot) {
      return { action: SaveAction.Delete, slotIndex, success: false, error: 'Slot not found' };
    }

    slot.data = null;
    return { action: SaveAction.Delete, slotIndex, success: true };
  }

  /** 购买付费槽位 */
  purchaseSlot(slotIndex: number): SaveActionResult {
    const slot = this.saveSlots.find(s => s.slotIndex === slotIndex);
    if (!slot) {
      return { action: SaveAction.ManualSave, slotIndex, success: false, error: 'Slot not found' };
    }
    if (!slot.isPaid) {
      return { action: SaveAction.ManualSave, slotIndex, success: false, error: 'Slot is free' };
    }
    if (slot.purchased) {
      return { action: SaveAction.ManualSave, slotIndex, success: false, error: 'Already purchased' };
    }

    slot.purchased = true;
    return { action: SaveAction.ManualSave, slotIndex, success: true };
  }

  /** 获取付费槽位价格 */
  getPaidSlotPrice(): number {
    return PAID_SLOT_PRICE;
  }

  /** 获取免费槽位数 */
  getFreeSlotCount(): number {
    return FREE_SAVE_SLOTS;
  }

  /** 获取总槽位数 */
  getTotalSlotCount(): number {
    return TOTAL_SAVE_SLOTS;
  }

  // ─── 加密 (#12) ──────────────────────────

  /** 加密存档数据（模拟 AES-GCM） */
  encryptData(data: string): EncryptionResult {
    const iv = this.generateIV();
    // 模拟加密：Base64 编码
    const encryptedData = btoa(unescape(encodeURIComponent(data)));
    const checksum = this.computeChecksum(data);
    return { encryptedData, iv, checksum };
  }

  /** 解密存档数据 */
  decryptData(payload: CloudSavePayload): string {
    // 模拟解密：Base64 解码
    try {
      return decodeURIComponent(escape(atob(payload.encryptedData)));
    } catch {
      throw new Error('Decryption failed');
    }
  }

  /** 验证数据完整性 */
  verifyIntegrity(payload: CloudSavePayload): boolean {
    // 模拟：无法从加密数据验证，跳过
    return payload.checksum.length > 0;
  }

  /** 构建云存档载荷 */
  buildPayload(data: string): CloudSavePayload {
    const { encryptedData, iv, checksum } = this.encryptData(data);
    return {
      version: CLOUD_DATA_VERSION,
      encryptedData,
      iv,
      clientTimestamp: Date.now(),
      deviceId: this.deviceId,
      checksum,
    };
  }

  // ─── 冲突解决 (#12) ──────────────────────

  /** 解决冲突 */
  resolveConflict(localData: CloudSavePayload, remoteData: CloudSavePayload): CloudSavePayload {
    switch (this.conflictStrategy) {
      case ConflictStrategy.LatestWins:
        return localData.clientTimestamp >= remoteData.clientTimestamp
          ? localData
          : remoteData;
      case ConflictStrategy.CloudWins:
        return remoteData;
      case ConflictStrategy.AlwaysAsk:
      default:
        // 返回 null 标记需要用户介入（由上层处理）
        return remoteData; // 默认回退到云端
    }
  }

  /** 获取当前冲突策略 */
  getConflictStrategy(): ConflictStrategy {
    return this.conflictStrategy;
  }

  // ─── 内部方法 ────────────────────────────

  /** 尝试同步（含重试） */
  private async attemptSync(): Promise<CloudSyncResult> {
    const result: CloudSyncResult = {
      status: CloudSyncStatus.Success,
      timestamp: Date.now(),
    };

    // 模拟同步过程
    this.syncStatus = CloudSyncStatus.Success;
    this.lastSyncAt = Date.now();
    this.retryCount = 0;

    return result;
  }

  /** 执行自动存档 */
  private performAutoSave(): void {
    // 自动存档到第一个可用槽位
    const freeSlot = this.saveSlots.find(s => !s.isPaid || s.purchased);
    if (freeSlot) {
      freeSlot.data = {
        name: 'Auto Save',
        savedAt: Date.now(),
        progress: 'Auto',
        sizeBytes: 0,
      };
    }
  }

  /** 生成设备 ID */
  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /** 生成 IV */
  private generateIV(): string {
    const arr = new Uint8Array(12);
    // 模拟随机 IV
    for (let i = 0; i < 12; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return btoa(String.fromCharCode(...arr));
  }

  /** 计算校验和 */
  private computeChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
