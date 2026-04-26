/**
 * 存档备份管理器
 *
 * 提供游戏存档的自动/手动备份与恢复能力，解决误删和版本升级导致的存档丢失问题。
 *
 * 功能：
 * - 每次保存前自动创建备份（保留最近 N 份，默认 3）
 * - 支持手动创建带标签的备份
 * - 从任意备份恢复存档
 * - 备份存储在 localStorage 中，key 前缀 three-kingdoms-backup-
 *
 * 设计原则：
 * - 所有 localStorage 操作包裹在 try/catch 中
 * - 备份失败不影响正常保存流程
 * - 备份数量超限时自动淘汰最旧的备份
 *
 * @module core/save/SaveBackupManager
 */

import { gameLog } from '../logger';
import { SAVE_KEY } from '../../shared/constants';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 备份条目元数据 */
export interface BackupEntry {
  /** 备份ID（基于时间戳） */
  id: string;
  /** 备份创建时间（ms） */
  timestamp: number;
  /** 存档版本号 */
  version: number;
  /** 用户自定义标签 */
  label?: string;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 备份 key 前缀 */
const BACKUP_KEY_PREFIX = 'three-kingdoms-backup-';

/** 备份索引 key（存储所有备份 ID 列表） */
const BACKUP_INDEX_KEY = 'three-kingdoms-backup-index';

/** 默认最大备份数 */
const DEFAULT_MAX_BACKUPS = 3;

// ─────────────────────────────────────────────
// 备份管理器
// ─────────────────────────────────────────────

/**
 * 存档备份管理器
 *
 * 管理 localStorage 中的存档备份，支持自动备份和手动恢复。
 *
 * @example
 * ```ts
 * const backupMgr = new SaveBackupManager(5);
 *
 * // 自动备份（保存前调用）
 * backupMgr.autoBackup();
 *
 * // 手动备份
 * const id = backupMgr.createBackup('升级前');
 *
 * // 列出所有备份
 * const backups = backupMgr.listBackups();
 *
 * // 恢复最新备份
 * backupMgr.restoreLatest();
 * ```
 */
export class SaveBackupManager {
  /** 最大备份数量 */
  private readonly maxBackups: number;

  // ─── 构造函数 ──────────────────────────────────────────────────

  /**
   * @param maxBackups - 最大保留备份数，默认 3
   */
  constructor(maxBackups: number = DEFAULT_MAX_BACKUPS) {
    this.maxBackups = Math.max(1, maxBackups);
  }

  // ─── 公共方法 ──────────────────────────────────────────────────

  /**
   * 自动备份（保存前调用）
   *
   * 从 localStorage 读取当前存档，创建备份。
   * 如果已有备份数量达到上限，自动淘汰最旧的备份。
   *
   * @returns 备份ID，失败返回 null
   */
  autoBackup(): string | null {
    return this.createBackup();
  }

  /**
   * 创建手动备份
   *
   * 读取当前存档数据并保存为备份。可附加用户标签。
   *
   * @param label - 可选的用户标签
   * @returns 备份ID（时间戳字符串），失败返回 null
   */
  createBackup(label?: string): string | null {
    try {
      const rawData = localStorage.getItem(SAVE_KEY);
      if (!rawData) {
        gameLog.warn('[SaveBackupManager] 无存档数据，跳过备份');
        return null;
      }

      const id = String(Date.now());
      const entry = this.buildEntry(rawData, id, label);

      // 写入备份数据
      localStorage.setItem(BACKUP_KEY_PREFIX + id, rawData);

      // 更新备份索引
      this.addToIndex(entry);

      // 淘汰超出上限的旧备份
      this.evictOldBackups();

      gameLog.info(`[SaveBackupManager] 备份已创建: ${id}${label ? ` (${label})` : ''}`);
      return id;
    } catch (err) {
      gameLog.error('[SaveBackupManager] 创建备份失败:', err);
      return null;
    }
  }

  /**
   * 恢复指定备份
   *
   * 将备份数据写回存档 key，覆盖当前存档。
   *
   * @param id - 备份ID
   * @returns 是否恢复成功
   */
  restoreBackup(id: string): boolean {
    try {
      const backupData = localStorage.getItem(BACKUP_KEY_PREFIX + id);
      if (!backupData) {
        gameLog.warn(`[SaveBackupManager] 备份不存在: ${id}`);
        return false;
      }

      localStorage.setItem(SAVE_KEY, backupData);
      gameLog.info(`[SaveBackupManager] 已恢复备份: ${id}`);
      return true;
    } catch (err) {
      gameLog.error('[SaveBackupManager] 恢复备份失败:', err);
      return false;
    }
  }

  /**
   * 恢复最新备份
   *
   * @returns 是否恢复成功
   */
  restoreLatest(): boolean {
    const backups = this.listBackups();
    if (backups.length === 0) {
      gameLog.warn('[SaveBackupManager] 无可用备份');
      return false;
    }

    // 按时间降序排列，取最新的
    const latest = backups.sort((a, b) => b.timestamp - a.timestamp)[0];
    return this.restoreBackup(latest.id);
  }

  /**
   * 列出所有备份
   *
   * @returns 备份列表（按时间降序）
   */
  listBackups(): BackupEntry[] {
    try {
      const index = this.readIndex();
      return index.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      gameLog.error('[SaveBackupManager] 读取备份列表失败:', err);
      return [];
    }
  }

  /**
   * 删除指定备份
   *
   * @param id - 备份ID
   * @returns 是否删除成功
   */
  deleteBackup(id: string): boolean {
    try {
      localStorage.removeItem(BACKUP_KEY_PREFIX + id);
      this.removeFromIndex(id);
      gameLog.info(`[SaveBackupManager] 备份已删除: ${id}`);
      return true;
    } catch (err) {
      gameLog.error('[SaveBackupManager] 删除备份失败:', err);
      return false;
    }
  }

  /**
   * 获取指定备份数据（不恢复）
   *
   * @param id - 备份ID
   * @returns 备份的原始 JSON 字符串，不存在返回 null
   */
  getBackupData(id: string): string | null {
    try {
      return localStorage.getItem(BACKUP_KEY_PREFIX + id);
    } catch {
      return null;
    }
  }

  // ─── 私有方法 ──────────────────────────────────────────────────

  /**
   * 从存档原始数据构建备份条目
   */
  private buildEntry(rawData: string, id: string, label?: string): BackupEntry {
    let version = 0;

    try {
      const parsed = JSON.parse(rawData);

      // 新格式: { v, checksum, data }
      if (typeof parsed.v === 'string' && typeof parsed.data === 'string') {
        const inner = JSON.parse(parsed.data);
        version = typeof inner.version === 'number' ? inner.version : 0;
      }
      // 旧格式: 直接 GameSaveData
      else if (typeof parsed.version === 'number') {
        version = parsed.version;
      }
    } catch {
      // 无法解析，使用默认版本号
    }

    return {
      id,
      timestamp: Date.now(),
      version,
      label,
    };
  }

  /**
   * 读取备份索引
   */
  private readIndex(): BackupEntry[] {
    try {
      const raw = localStorage.getItem(BACKUP_INDEX_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as BackupEntry[];
    } catch {
      return [];
    }
  }

  /**
   * 写入备份索引
   */
  private writeIndex(entries: BackupEntry[]): void {
    localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(entries));
  }

  /**
   * 向索引中添加备份条目
   */
  private addToIndex(entry: BackupEntry): void {
    const index = this.readIndex();
    index.push(entry);
    this.writeIndex(index);
  }

  /**
   * 从索引中移除指定备份
   */
  private removeFromIndex(id: string): void {
    const index = this.readIndex().filter(e => e.id !== id);
    this.writeIndex(index);
  }

  /**
   * 淘汰超出上限的旧备份
   *
   * 按时间升序排列，删除最旧的备份直到数量不超过 maxBackups。
   */
  private evictOldBackups(): void {
    const index = this.readIndex();
    if (index.length <= this.maxBackups) return;

    // 按时间升序排列，最旧的在前
    const sorted = index.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = sorted.slice(0, sorted.length - this.maxBackups);

    for (const entry of toRemove) {
      try {
        localStorage.removeItem(BACKUP_KEY_PREFIX + entry.id);
      } catch {
        // 忽略删除失败
      }
    }

    // 更新索引
    const remaining = sorted.slice(sorted.length - this.maxBackups);
    this.writeIndex(remaining);

    if (toRemove.length > 0) {
      gameLog.info(`[SaveBackupManager] 已淘汰 ${toRemove.length} 个旧备份`);
    }
  }
}
