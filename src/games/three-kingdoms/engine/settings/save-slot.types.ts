/**
 * 多存档管理器 — 类型与常量
 *
 * 从 SaveSlotManager.ts 拆分，保持主文件 ≤500 行。
 *
 * @module engine/settings/save-slot.types
 */

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 存档槽位变更回调 */
export type SaveSlotChangeCallback = (
  slotIndex: number,
  action: 'save' | 'load' | 'delete',
) => void;

/** 云同步状态 */
export enum CloudSyncStatus {
  Idle = 'idle',
  Syncing = 'syncing',
  Success = 'success',
  Failed = 'failed',
}

/** 云同步结果 */
export interface CloudSyncResult {
  status: CloudSyncStatus;
  message: string;
  syncedAt: number;
}

/** 存档操作结果 */
export interface SaveSlotResult {
  success: boolean;
  message: string;
}

/** 导出数据格式 */
export interface ExportData {
  version: string;
  exportedAt: number;
  slots: Record<number, string>; // slotIndex -> base64 encoded data
}

/** 存储适配器 */
export interface ISaveSlotStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存档key前缀 */
export const SAVE_SLOT_PREFIX = 'three-kingdoms-slot-';

/** 导出版本号 */
export const EXPORT_VERSION = '1.0.0';
