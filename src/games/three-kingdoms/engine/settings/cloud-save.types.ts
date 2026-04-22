/**
 * 云存档系统 — 类型与常量
 *
 * 从 CloudSaveSystem.ts 拆分，保持主文件 ≤500 行。
 *
 * @module engine/settings/cloud-save.types
 */

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
// 默认实现
// ─────────────────────────────────────────────

/** 默认网络检测器 */
export class DefaultNetworkDetector implements INetworkDetector {
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
