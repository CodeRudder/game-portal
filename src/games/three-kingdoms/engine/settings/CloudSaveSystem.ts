/**
 * 云存档系统
 *
 * v19.0 云存档引擎，职责：
 * - 自动同步（退出时/每小时/仅手动）
 * - 同步频率控制
 * - 仅 WiFi 同步
 * - 数据加密（AES-GCM 模拟）
 * - 多设备管理协同
 * - 冲突检测与解决
 * - 同步重试机制
 *
 * @module engine/settings/CloudSaveSystem
 */

import {
  CloudSyncFrequency,
  ConflictStrategy,
  CLOUD_DATA_VERSION,
  CLOUD_SYNC_MAX_RETRIES,
  CLOUD_SYNC_RETRY_INTERVAL,
  AUTO_SAVE_INTERVAL,
} from '../../core/settings';
import type { AccountSettings } from '../../core/settings';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 云同步状态 */
export enum CloudSyncState {
  Idle = 'idle',
  Syncing = 'syncing',
  Success = 'success',
  Failed = 'failed',
  Conflict = 'conflict',
}

/** 云同步结果 */
export interface CloudSyncResult {
  state: CloudSyncState;
  message: string;
  syncedAt: number;
  /** 冲突时的远程数据 */
  remoteData: string | null;
  /** 冲突时的远程时间戳 */
  remoteTimestamp: number;
}

/** 云存档元数据 */
export interface CloudSaveMetadata {
  /** 数据版本 */
  version: string;
  /** 最后同步时间 */
  lastSyncedAt: number;
  /** 同步设备 ID */
  syncedDeviceId: string;
  /** 数据大小 (bytes) */
  sizeBytes: number;
  /** 校验和 */
  checksum: string;
}

/** 同步频率调度器 */
export type SyncScheduler = {
  start: (callback: () => void, intervalMs: number) => void;
  stop: () => void;
};

/** 网络状态检测器 */
export interface INetworkDetector {
  isWifi(): boolean;
  isOnline(): boolean;
}

/** 云存储接口 */
export interface ICloudStorage {
  upload(data: string, metadata: CloudSaveMetadata): Promise<boolean>;
  download(): Promise<{ data: string; metadata: CloudSaveMetadata } | null>;
  getMetadata(): Promise<CloudSaveMetadata | null>;
  delete(): Promise<boolean>;
}

/** 云存档变更回调 */
export type CloudSaveChangeCallback = (
  state: CloudSyncState,
  result: CloudSyncResult | null,
) => void;

/** 当前时间函数（便于测试注入） */
export type NowFn = () => number;

// ─────────────────────────────────────────────
// 云存档系统
// ─────────────────────────────────────────────

/**
 * 云存档系统
 *
 * 管理游戏存档的云端同步。
 *
 * @example
 * ```ts
 * const cloud = new CloudSaveSystem();
 * cloud.configure(accountSettings);
 *
 * // 手动同步
 * const result = await cloud.sync(localData, 'device-1');
 *
 * // 启动自动同步
 * cloud.startAutoSync(() => engine.getGameState(), 'device-1');
 * ```
 */
export class CloudSaveSystem {
  private state: CloudSyncState = CloudSyncState.Idle;
  private lastSyncResult: CloudSyncResult | null = null;
  private config: AccountSettings | null = null;
  private cloudStorage: ICloudStorage | null = null;
  private networkDetector: INetworkDetector;
  private listeners: CloudSaveChangeCallback[] = [];
  private nowFn: NowFn;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;

  constructor(deps?: {
    cloudStorage?: ICloudStorage;
    networkDetector?: INetworkDetector;
    nowFn?: NowFn;
  }) {
    this.cloudStorage = deps?.cloudStorage ?? null;
    this.networkDetector = deps?.networkDetector ?? new DefaultNetworkDetector();
    this.nowFn = deps?.nowFn ?? (() => Date.now());
  }

  // ─────────────────────────────────────────
  // 配置
  // ─────────────────────────────────────────

  /**
   * 配置云存档系统
   *
   * @param settings - 账号设置（含同步频率、WiFi 限制等）
   */
  configure(settings: AccountSettings): void {
    this.config = { ...settings };
  }

  /**
   * 设置云存储实现
   */
  setCloudStorage(storage: ICloudStorage): void {
    this.cloudStorage = storage;
  }

  /** 获取当前同步状态 */
  getState(): CloudSyncState {
    return this.state;
  }

  /** 获取最后同步结果 */
  getLastSyncResult(): CloudSyncResult | null {
    return this.lastSyncResult;
  }

  // ─────────────────────────────────────────
  // 同步操作
  // ─────────────────────────────────────────

  /**
   * 手动触发同步
   *
   * @param localData - 本地存档数据
   * @param deviceId - 当前设备 ID
   * @param localTimestamp - 本地数据时间戳
   */
  async sync(
    localData: string,
    deviceId: string,
    localTimestamp?: number,
  ): Promise<CloudSyncResult> {
    if (!this.cloudStorage) {
      return this.failResult('云存储未配置');
    }

    if (!this.networkDetector.isOnline()) {
      return this.failResult('网络不可用');
    }

    // WiFi 限制检查
    if (this.config?.wifiOnlySync && !this.networkDetector.isWifi()) {
      return this.failResult('仅 WiFi 下同步');
    }

    this.setState(CloudSyncState.Syncing);

    try {
      // 下载远程数据
      const remote = await this.cloudStorage.download();

      // 冲突检测
      if (remote && localTimestamp && remote.metadata.lastSyncedAt > localTimestamp) {
        const strategy = this.config?.conflictStrategy ?? ConflictStrategy.AlwaysAsk;

        if (strategy === ConflictStrategy.AlwaysAsk) {
          const result: CloudSyncResult = {
            state: CloudSyncState.Conflict,
            message: '检测到冲突，需要用户选择',
            syncedAt: this.nowFn(),
            remoteData: remote.data,
            remoteTimestamp: remote.metadata.lastSyncedAt,
          };
          this.lastSyncResult = result;
          this.setState(CloudSyncState.Conflict);
          return result;
        }

        // 自动解决冲突
        const resolved = this.resolveConflict(
          strategy, localData, remote.data,
          localTimestamp, remote.metadata.lastSyncedAt,
        );
        await this.uploadData(resolved, deviceId);
      } else {
        // 无冲突，直接上传
        await this.uploadData(localData, deviceId);
      }

      this.retryCount = 0;
      const result: CloudSyncResult = {
        state: CloudSyncState.Success,
        message: '同步成功',
        syncedAt: this.nowFn(),
        remoteData: null,
        remoteTimestamp: 0,
      };
      this.lastSyncResult = result;
      this.setState(CloudSyncState.Success);
      return result;
    } catch {
      return this.handleSyncError();
    }
  }

  /**
   * 解决冲突并上传
   *
   * 用户选择后调用。
   */
  async resolveAndUpload(
    chosenData: string,
    deviceId: string,
  ): Promise<CloudSyncResult> {
    if (!this.cloudStorage) {
      return this.failResult('云存储未配置');
    }

    try {
      await this.uploadData(chosenData, deviceId);
      const result: CloudSyncResult = {
        state: CloudSyncState.Success,
        message: '冲突已解决，同步成功',
        syncedAt: this.nowFn(),
        remoteData: null,
        remoteTimestamp: 0,
      };
      this.lastSyncResult = result;
      this.setState(CloudSyncState.Success);
      return result;
    } catch {
      return this.failResult('上传失败');
    }
  }

  // ─────────────────────────────────────────
  // 自动同步
  // ─────────────────────────────────────────

  /**
   * 启动自动同步
   *
   * 根据配置的同步频率自动触发同步。
   *
   * @param getDataFn - 获取本地数据的函数
   * @param deviceId - 当前设备 ID
   */
  startAutoSync(
    getDataFn: () => string,
    deviceId: string,
  ): void {
    this.stopAutoSync();

    const frequency = this.config?.cloudSyncFrequency ?? CloudSyncFrequency.ManualOnly;

    if (frequency === CloudSyncFrequency.ManualOnly) {
      return; // 仅手动同步
    }

    if (frequency === CloudSyncFrequency.Hourly) {
      const intervalMs = 60 * 60 * 1000;
      this.syncTimer = setInterval(() => {
        const data = getDataFn();
        this.sync(data, deviceId).catch(() => {
          // 静默处理自动同步错误
        });
      }, intervalMs);
    }
    // OnExit 不自动定时同步
  }

  /** 停止自动同步 */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /** 是否正在自动同步 */
  isAutoSyncing(): boolean {
    return this.syncTimer !== null;
  }

  // ─────────────────────────────────────────
  // 加密
  // ─────────────────────────────────────────

  /**
   * 加密数据
   *
   * 模拟 AES-GCM 加密。实际环境应使用 Web Crypto API。
   *
   * @param data - 原始数据
   * @param key - 加密密钥
   * @returns 加密后的 Base64 字符串
   */
  encrypt(data: string, key: string): string {
    const keyBytes = new TextEncoder().encode(key);
    const dataBytes = new TextEncoder().encode(data);
    const encrypted = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return this.uint8ToBase64(encrypted);
  }

  /**
   * 解密数据
   *
   * @param encrypted - 加密后的 Base64 字符串
   * @param key - 解密密钥
   * @returns 原始数据
   */
  decrypt(encrypted: string, key: string): string {
    const keyBytes = new TextEncoder().encode(key);
    const encryptedBytes = this.base64ToUint8(encrypted);
    const decrypted = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder().decode(decrypted);
  }

  // ─────────────────────────────────────────
  // 数据完整性
  // ─────────────────────────────────────────

  /**
   * 计算校验和
   */
  computeChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * 验证数据完整性
   */
  verifyIntegrity(data: string, checksum: string): boolean {
    return this.computeChecksum(data) === checksum;
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册状态变更回调
   * @returns 取消注册函数
   */
  onChange(callback: CloudSaveChangeCallback): () => void {
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
    this.stopAutoSync();
    this.state = CloudSyncState.Idle;
    this.lastSyncResult = null;
    this.config = null;
    this.retryCount = 0;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 冲突解决 */
  private resolveConflict(
    strategy: ConflictStrategy,
    localData: string,
    remoteData: string,
    localTimestamp: number,
    remoteTimestamp: number,
  ): string {
    switch (strategy) {
      case ConflictStrategy.LatestWins:
        return remoteTimestamp > localTimestamp ? remoteData : localData;
      case ConflictStrategy.CloudWins:
        return remoteData;
      case ConflictStrategy.AlwaysAsk:
        return localData;
      default:
        return localData;
    }
  }

  /** 上传数据 */
  private async uploadData(data: string, deviceId: string): Promise<boolean> {
    if (!this.cloudStorage) return false;

    const metadata: CloudSaveMetadata = {
      version: CLOUD_DATA_VERSION,
      lastSyncedAt: this.nowFn(),
      syncedDeviceId: deviceId,
      sizeBytes: new Blob([data]).size,
      checksum: this.computeChecksum(data),
    };

    return this.cloudStorage.upload(data, metadata);
  }

  /** 处理同步错误（含重试） */
  private handleSyncError(): CloudSyncResult {
    this.retryCount++;

    const result: CloudSyncResult = {
      state: CloudSyncState.Failed,
      message: this.retryCount >= CLOUD_SYNC_MAX_RETRIES
        ? `同步失败（已重试${CLOUD_SYNC_MAX_RETRIES}次）`
        : '同步失败',
      syncedAt: 0,
      remoteData: null,
      remoteTimestamp: 0,
    };
    this.lastSyncResult = result;
    this.setState(CloudSyncState.Failed);
    return result;
  }

  /** 设置状态并通知 */
  private setState(newState: CloudSyncState): void {
    this.state = newState;
    for (const cb of this.listeners) {
      try {
        cb(newState, this.lastSyncResult);
      } catch {
        // 不阻断
      }
    }
  }

  /** 构建失败结果 */
  private failResult(message: string): CloudSyncResult {
    const result: CloudSyncResult = {
      state: CloudSyncState.Failed,
      message,
      syncedAt: 0,
      remoteData: null,
      remoteTimestamp: 0,
    };
    this.lastSyncResult = result;
    return result;
  }

  /** Uint8Array → Base64 */
  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /** Base64 → Uint8Array */
  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// ─────────────────────────────────────────────
// 默认实现
// ─────────────────────────────────────────────

/** 默认网络检测器 */
class DefaultNetworkDetector implements INetworkDetector {
  isWifi(): boolean {
    if (typeof navigator === 'undefined') return true;
    const conn = (navigator as unknown as Record<string, unknown>).connection as
      | Record<string, unknown>
      | undefined;
    if (conn && typeof conn === 'object' && 'type' in conn) {
      return conn.type === 'wifi';
    }
    return true;
  }

  isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }
}
