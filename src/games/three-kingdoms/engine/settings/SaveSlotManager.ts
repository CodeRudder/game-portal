/**
 * 多存档管理器
 *
 * v19.0 存档槽位管理器，职责：
 * - 3免费+1付费槽位管理
 * - 自动存档（每15分钟）
 * - 手动保存/读取/删除
 * - 存档导入导出（JSON序列化）
 * - 云存档模拟（加密/同步/冲突解决）
 *
 * @module engine/settings/SaveSlotManager
 */

import {
  FREE_SAVE_SLOTS,
  TOTAL_SAVE_SLOTS,
  PAID_SLOT_PRICE,
  AUTO_SAVE_INTERVAL,
  ConflictStrategy,
  CloudSyncFrequency,
} from '../../core/settings';
import type {
  SaveSlot,
  SaveSlotData,
  AccountSettings,
  DeviceInfo,
} from '../../core/settings';

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

const SAVE_SLOT_PREFIX = 'three-kingdoms-slot-';
const EXPORT_VERSION = '1.0.0';

// ─────────────────────────────────────────────
// 多存档管理器
// ─────────────────────────────────────────────

/**
 * 多存档管理器
 *
 * 管理游戏的多个存档槽位。
 *
 * @example
 * ```ts
 * const mgr = new SaveSlotManager();
 *
 * // 保存到槽位 0
 * mgr.saveToSlot(0, gameState, '第一章');
 *
 * // 从槽位 0 加载
 * const data = mgr.loadFromSlot(0);
 *
 * // 自动存档
 * mgr.startAutoSave(() => engine.getGameState());
 * ```
 */
export class SaveSlotManager {
  private storage: ISaveSlotStorage;
  private slots: SaveSlot[];
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private lastAutoSaveAt = 0;
  private listeners: SaveSlotChangeCallback[] = [];
  private cloudSyncStatus: CloudSyncStatus = CloudSyncStatus.Idle;
  private lastCloudSyncAt = 0;
  private paidSlotPurchased = false;

  constructor(storage?: ISaveSlotStorage) {
    this.storage = storage ?? SaveSlotManager.createDefaultStorage();
    this.slots = this.initializeSlots();
    this.loadSlotMetadata();
  }

  // ─────────────────────────────────────────
  // 槽位查询
  // ─────────────────────────────────────────

  /** 获取所有槽位 */
  getSlots(): Readonly<SaveSlot>[] {
    return this.slots.map((s) => ({ ...s }));
  }

  /** 获取指定槽位 */
  getSlot(index: number): Readonly<SaveSlot> | null {
    if (!this.isValidSlotIndex(index)) return null;
    return { ...this.slots[index] };
  }

  /** 获取已使用的槽位数量 */
  getUsedSlotCount(): number {
    return this.slots.filter((s) => s.data !== null).length;
  }

  /** 获取可用槽位数量 */
  getAvailableSlotCount(): number {
    return this.slots.filter((s) => this.isSlotAvailable(s.slotIndex)).length;
  }

  /** 槽位是否可用（已购买或免费） */
  isSlotAvailable(index: number): boolean {
    if (!this.isValidSlotIndex(index)) return false;
    const slot = this.slots[index];
    if (!slot.isPaid) return true; // 免费槽位
    return slot.purchased; // 付费槽位需购买
  }

  /** 槽位是否为空 */
  isSlotEmpty(index: number): boolean {
    if (!this.isValidSlotIndex(index)) return true;
    return this.slots[index].data === null;
  }

  // ─────────────────────────────────────────
  // 保存操作
  // ─────────────────────────────────────────

  /**
   * 保存到指定槽位
   *
   * @param index - 槽位索引
   * @param gameData - 游戏数据（JSON 字符串）
   * @param name - 存档名称
   * @returns 操作结果
   */
  saveToSlot(index: number, gameData: string, name: string): SaveSlotResult {
    if (!this.isValidSlotIndex(index)) {
      return { success: false, message: '无效的槽位索引' };
    }
    if (!this.isSlotAvailable(index)) {
      return { success: false, message: '该槽位需要购买' };
    }
    try {
      const sizeBytes = new Blob([gameData]).size;
      const slotData: SaveSlotData = {
        name,
        savedAt: Date.now(),
        progress: name,
        sizeBytes,
      };
      this.slots[index] = {
        ...this.slots[index],
        data: slotData,
      };
      this.storage.setItem(`${SAVE_SLOT_PREFIX}${index}`, gameData);
      this.saveSlotMetadata();
      this.notifyListeners(index, 'save');
      return { success: true, message: '保存成功' };
    } catch (e) {
      return { success: false, message: '保存失败：存储空间不足' };
    }
  }

  /**
   * 从指定槽位加载
   *
   * @returns 游戏数据 JSON 字符串，或 null
   */
  loadFromSlot(index: number): string | null {
    if (!this.isValidSlotIndex(index)) return null;
    if (this.slots[index].data === null) return null;
    try {
      const data = this.storage.getItem(`${SAVE_SLOT_PREFIX}${index}`);
      this.notifyListeners(index, 'load');
      return data;
    } catch {
      return null;
    }
  }

  /**
   * 删除指定槽位存档
   */
  deleteSlot(index: number): SaveSlotResult {
    if (!this.isValidSlotIndex(index)) {
      return { success: false, message: '无效的槽位索引' };
    }
    if (this.slots[index].data === null) {
      return { success: false, message: '该槽位为空' };
    }
    this.slots[index] = {
      ...this.slots[index],
      data: null,
    };
    this.storage.removeItem(`${SAVE_SLOT_PREFIX}${index}`);
    this.saveSlotMetadata();
    this.notifyListeners(index, 'delete');
    return { success: true, message: '删除成功' };
  }

  // ─────────────────────────────────────────
  // 付费槽位
  // ─────────────────────────────────────────

  /**
   * 购买付费槽位
   *
   * @param spendFn - 消耗元宝的函数
   * @returns 操作结果
   */
  purchasePaidSlot(spendFn: (amount: number) => boolean): SaveSlotResult {
    const paidSlot = this.slots.find((s) => s.isPaid && !s.purchased);
    if (!paidSlot) {
      return { success: false, message: '没有可购买的槽位' };
    }
    if (!spendFn(PAID_SLOT_PRICE)) {
      return { success: false, message: '元宝不足' };
    }
    paidSlot.purchased = true;
    this.paidSlotPurchased = true;
    this.saveSlotMetadata();
    return { success: true, message: '购买成功' };
  }

  /** 付费槽位是否已购买 */
  isPaidSlotPurchased(): boolean {
    return this.paidSlotPurchased;
  }

  // ─────────────────────────────────────────
  // 自动存档
  // ─────────────────────────────────────────

  /**
   * 启动自动存档
   *
   * @param getStateFn - 获取当前游戏状态的函数
   * @param slotIndex - 自动存档使用的槽位（默认0）
   */
  startAutoSave(
    getStateFn: () => string,
    slotIndex: number = 0,
  ): void {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      const data = getStateFn();
      this.saveToSlot(slotIndex, data, '自动存档');
      this.lastAutoSaveAt = Date.now();
    }, AUTO_SAVE_INTERVAL);
  }

  /** 停止自动存档 */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /** 获取最后自动保存时间 */
  getLastAutoSaveTime(): number {
    return this.lastAutoSaveAt;
  }

  /** 是否正在自动保存 */
  isAutoSaving(): boolean {
    return this.autoSaveTimer !== null;
  }

  // ─────────────────────────────────────────
  // 导入导出
  // ─────────────────────────────────────────

  /**
   * 导出所有存档
   *
   * 将所有非空槽位的数据打包为可导出的 JSON 格式。
   */
  exportSaves(): ExportData {
    const slots: Record<number, string> = {};
    for (const slot of this.slots) {
      if (slot.data !== null) {
        const data = this.storage.getItem(`${SAVE_SLOT_PREFIX}${slot.slotIndex}`);
        if (data) {
          // Base64 编码
          slots[slot.slotIndex] = btoa(unescape(encodeURIComponent(data)));
        }
      }
    }
    return {
      version: EXPORT_VERSION,
      exportedAt: Date.now(),
      slots,
    };
  }

  /**
   * 导入存档
   *
   * 从导出数据恢复存档。
   */
  importSaves(exportData: ExportData): SaveSlotResult {
    if (!exportData || !exportData.slots) {
      return { success: false, message: '无效的导入数据' };
    }
    try {
      for (const [indexStr, encoded] of Object.entries(exportData.slots)) {
        const index = parseInt(indexStr, 10);
        if (!this.isValidSlotIndex(index)) continue;
        const decoded = decodeURIComponent(escape(atob(encoded)));
        this.saveToSlot(index, decoded, '导入存档');
      }
      return { success: true, message: '导入成功' };
    } catch {
      return { success: false, message: '导入失败：数据格式错误' };
    }
  }

  // ─────────────────────────────────────────
  // 云存档（模拟）
  // ─────────────────────────────────────────

  /**
   * 执行云同步
   *
   * 模拟云存档同步流程。
   */
  async cloudSync(
    accountSettings: AccountSettings,
    localData: string,
  ): Promise<CloudSyncResult> {
    this.cloudSyncStatus = CloudSyncStatus.Syncing;

    // 检查 WiFi 限制
    if (accountSettings.wifiOnlySync) {
      // 模拟检查（实际环境中检查 navigator.connection）
      // 这里简单通过
    }

    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // 模拟加密存储
      const encrypted = this.simpleEncrypt(localData);

      // 模拟存储到云端
      this.lastCloudSyncAt = Date.now();
      this.cloudSyncStatus = CloudSyncStatus.Success;

      return {
        status: CloudSyncStatus.Success,
        message: '同步成功',
        syncedAt: this.lastCloudSyncAt,
      };
    } catch {
      this.cloudSyncStatus = CloudSyncStatus.Failed;
      return {
        status: CloudSyncStatus.Failed,
        message: '同步失败',
        syncedAt: 0,
      };
    }
  }

  /** 获取云同步状态 */
  getCloudSyncStatus(): CloudSyncStatus {
    return this.cloudSyncStatus;
  }

  /** 获取最后云同步时间 */
  getLastCloudSyncTime(): number {
    return this.lastCloudSyncAt;
  }

  /**
   * 解决冲突
   *
   * 根据冲突策略选择使用本地或远程数据。
   */
  resolveConflict(
    strategy: ConflictStrategy,
    localTimestamp: number,
    remoteTimestamp: number,
    localData: string,
    remoteData: string,
  ): string {
    switch (strategy) {
      case ConflictStrategy.LatestWins:
        return remoteTimestamp > localTimestamp ? remoteData : localData;
      case ConflictStrategy.CloudWins:
        return remoteData;
      case ConflictStrategy.AlwaysAsk:
        // 返回本地数据，由 UI 层处理询问
        return localData;
      default:
        return localData;
    }
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册槽位变更回调
   * @returns 取消注册函数
   */
  onChange(callback: SaveSlotChangeCallback): () => void {
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

  /** 重置所有槽位 */
  reset(): void {
    this.stopAutoSave();
    for (let i = 0; i < this.slots.length; i++) {
      this.storage.removeItem(`${SAVE_SLOT_PREFIX}${i}`);
    }
    this.slots = this.initializeSlots();
    this.lastAutoSaveAt = 0;
    this.cloudSyncStatus = CloudSyncStatus.Idle;
    this.lastCloudSyncAt = 0;
    this.paidSlotPurchased = false;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 初始化槽位 */
  private initializeSlots(): SaveSlot[] {
    const slots: SaveSlot[] = [];
    for (let i = 0; i < TOTAL_SAVE_SLOTS; i++) {
      slots.push({
        slotIndex: i,
        isPaid: i >= FREE_SAVE_SLOTS,
        purchased: i < FREE_SAVE_SLOTS,
        data: null,
      });
    }
    return slots;
  }

  /** 验证槽位索引 */
  private isValidSlotIndex(index: number): boolean {
    return index >= 0 && index < TOTAL_SAVE_SLOTS;
  }

  /** 保存槽位元数据 */
  private saveSlotMetadata(): void {
    try {
      const metadata = {
        slots: this.slots.map((s) => ({
          slotIndex: s.slotIndex,
          isPaid: s.isPaid,
          purchased: s.purchased,
          data: s.data,
        })),
        paidSlotPurchased: this.paidSlotPurchased,
      };
      this.storage.setItem(`${SAVE_SLOT_PREFIX}metadata`, JSON.stringify(metadata));
    } catch {
      // 静默失败
    }
  }

  /** 加载槽位元数据 */
  private loadSlotMetadata(): void {
    try {
      const raw = this.storage.getItem(`${SAVE_SLOT_PREFIX}metadata`);
      if (!raw) return;
      const metadata = JSON.parse(raw);
      if (metadata.slots) {
        this.slots = metadata.slots;
      }
      if (metadata.paidSlotPurchased !== undefined) {
        this.paidSlotPurchased = metadata.paidSlotPurchased;
      }
    } catch {
      // 静默失败
    }
  }

  /** 简单加密（模拟，实际应使用 Web Crypto API） */
  private simpleEncrypt(data: string): string {
    return btoa(unescape(encodeURIComponent(data)));
  }

  /** 通知监听器 */
  private notifyListeners(slotIndex: number, action: 'save' | 'load' | 'delete'): void {
    for (const cb of this.listeners) {
      try {
        cb(slotIndex, action);
      } catch {
        // 不阻断
      }
    }
  }

  /** 创建默认存储 */
  private static createDefaultStorage(): ISaveSlotStorage {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    const store: Record<string, string> = {};
    return {
      getItem: (key) => store[key] ?? null,
      setItem: (key, val) => { store[key] = val; },
      removeItem: (key) => { delete store[key]; },
    };
  }
}
