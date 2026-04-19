/**
 * 存档管理器实现
 *
 * 基于 localStorage 的存档管理器，提供游戏存档的完整生命周期管理：
 * 保存、加载、删除、查询。
 *
 * 设计原则：
 * - 通过 StateSerializer 进行序列化/反序列化，支持版本迁移
 * - 支持自动保存（可配置间隔）
 * - 存档操作失败时返回 false 而非抛出异常（存储空间不足等场景）
 * - 所有 localStorage 操作包裹在 try/catch 中，兼容隐私模式
 *
 * @module core/save/SaveManager
 */

import type { IGameState } from '../types/state';
import type { ISaveManager } from '../types/save';
import type { IConfigRegistry } from '../types/config';
import { StateSerializer } from './StateSerializer';

// ─────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────

/** localStorage 默认键名 */
const DEFAULT_SAVE_KEY = 'three-kingdoms-save';

/** 自动保存默认间隔（毫秒） */
const DEFAULT_AUTO_SAVE_INTERVAL = 30000;

/** 默认存档版本 */
const DEFAULT_SAVE_VERSION = '1.0.0';

// ─────────────────────────────────────────────
// 存档管理器
// ─────────────────────────────────────────────

/**
 * 存档管理器
 *
 * 实现 ISaveManager 接口，基于 localStorage 管理游戏存档。
 * 内部使用 StateSerializer 进行序列化，支持版本迁移。
 *
 * @example
 * ```ts
 * const saveManager = new SaveManager(config);
 *
 * // 手动保存
 * const state = engine.getGameState();
 * saveManager.save(state);
 *
 * // 启用自动保存（每 30 秒）
 * saveManager.startAutoSave(() => engine.getGameState());
 *
 * // 加载
 * const loaded = saveManager.load();
 * if (loaded) {
 *   // 恢复游戏状态...
 * }
 *
 * // 停止自动保存
 * saveManager.stopAutoSave();
 * ```
 */
export class SaveManager implements ISaveManager {
  /** localStorage 键名 */
  private readonly saveKey: string;

  /** 状态序列化器 */
  private readonly serializer: StateSerializer;

  /** 自动保存定时器 ID */
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  /** 累计存档次数 */
  private saveCount: number = 0;

  /** 最近一次保存时间戳 */
  private lastSaveTime: number | null = null;

  // ─── 构造函数 ──────────────────────────────────────────────────

  /**
   * @param config - 配置注册表（读取 SAVE_KEY、SAVE_VERSION 等配置）
   *                 如果不传，使用默认值
   */
  constructor(config?: IConfigRegistry) {
    this.saveKey = config?.has('SAVE_KEY')
      ? (config.get('SAVE_KEY') as string)
      : DEFAULT_SAVE_KEY;

    const version = config?.has('SAVE_VERSION')
      ? (config.get('SAVE_VERSION') as string)
      : DEFAULT_SAVE_VERSION;

    this.serializer = new StateSerializer(version);
  }

  // ─── ISaveManager 核心方法 ─────────────────────────────────────

  /**
   * 保存游戏状态
   *
   * 将游戏状态序列化并写入 localStorage。
   * 保存前自动更新 timestamp 和 metadata.saveCount。
   *
   * @param data - 要保存的游戏状态
   * @returns 是否保存成功
   */
  save(data: IGameState): boolean {
    try {
      // 更新存档元数据
      const stateToSave: IGameState = {
        ...data,
        timestamp: Date.now(),
        metadata: {
          ...data.metadata,
          saveCount: this.saveCount + 1,
          lastVersion: data.version,
        },
      };

      const serialized = this.serializer.serialize(stateToSave);
      localStorage.setItem(this.saveKey, serialized);

      this.saveCount++;
      this.lastSaveTime = Date.now();

      return true;
    } catch (err) {
      console.error('[SaveManager] Save failed:', err);
      return false;
    }
  }

  /**
   * 加载游戏状态
   *
   * 从 localStorage 读取并反序列化游戏状态。
   * 自动处理版本迁移和数据校验。
   *
   * 通过预判存档格式，区分新格式（v2 序列化）和旧格式（直接 JSON），
   * 避免旧格式触发不必要的 SerializationError 日志噪音。
   *
   * @returns 游戏状态，如果没有存档则返回 null
   */
  load(): IGameState | null {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw === null) return null;

      // 预判存档格式：新格式必须有 v + checksum + data 三个字段
      if (this.isNewFormat(raw)) {
        const state = this.serializer.deserialize(raw);

        // 恢复存档计数
        this.saveCount = state.metadata.saveCount;
        this.lastSaveTime = state.timestamp;

        return state;
      }

      // 旧格式或非标准格式 — 不属于 SaveManager 管辖范围，返回 null
      // 由 ThreeKingdomsEngine.tryLoadLegacyFormat() 处理
      return null;
    } catch (err) {
      console.error('[SaveManager] Load failed:', err);
      return null;
    }
  }

  /**
   * 预判存档是否为新序列化格式
   *
   * 新格式（StateSerializer 输出）特征：
   *   { v: string, checksum: number, data: string }
   *
   * 仅当三个字段同时存在且类型正确时才判定为新格式，
   * 避免旧格式数据被误传入 deserialize() 触发 SerializationError。
   *
   * @param raw - localStorage 中的原始字符串
   * @returns 是否为新格式
   */
  private isNewFormat(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw);
      return (
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof parsed.v === 'string' &&
        typeof parsed.checksum === 'number' &&
        typeof parsed.data === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * 检查是否存在存档数据
   *
   * @returns 是否存在有效存档
   */
  hasSaveData(): boolean {
    try {
      return localStorage.getItem(this.saveKey) !== null;
    } catch {
      return false;
    }
  }

  /**
   * 删除存档
   *
   * 从 localStorage 中移除游戏存档数据。
   */
  deleteSave(): void {
    try {
      localStorage.removeItem(this.saveKey);
      this.saveCount = 0;
      this.lastSaveTime = null;
    } catch (err) {
      console.error('[SaveManager] Delete failed:', err);
    }
  }

  /**
   * 获取最近一次保存时间
   *
   * @returns 时间戳（毫秒），如果没有存档则返回 null
   */
  getLastSaveTime(): number | null {
    // 优先使用内存中的记录，否则从 localStorage 读取
    if (this.lastSaveTime !== null) return this.lastSaveTime;

    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw === null) return null;

      const serialized = JSON.parse(raw as string);
      return typeof serialized?.timestamp === 'number' ? serialized.timestamp : null;
    } catch {
      return null;
    }
  }

  // ─── 自动保存 ──────────────────────────────────────────────────

  /**
   * 启动自动保存
   *
   * 按指定间隔定期保存游戏状态。
   * 如果已有自动保存在运行，先停止旧的再启动新的。
   *
   * @param getState - 获取当前游戏状态的函数（每次保存时调用）
   * @param intervalMs - 自动保存间隔（毫秒），默认 30000
   */
  startAutoSave(
    getState: () => IGameState,
    intervalMs: number = DEFAULT_AUTO_SAVE_INTERVAL,
  ): void {
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(() => {
      const state = getState();
      this.save(state);
    }, intervalMs);
  }

  /**
   * 停止自动保存
   *
   * 停止正在运行的自动保存定时器。
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 检查自动保存是否正在运行
   */
  get isAutoSaving(): boolean {
    return this.autoSaveTimer !== null;
  }

  // ─── 扩展方法 ──────────────────────────────────────────────────

  /**
   * 获取序列化器实例
   *
   * 用于注册版本迁移函数。
   *
   * @returns StateSerializer 实例
   */
  getSerializer(): StateSerializer {
    return this.serializer;
  }

  /**
   * 获取累计存档次数
   */
  getSaveCount(): number {
    return this.saveCount;
  }
}
