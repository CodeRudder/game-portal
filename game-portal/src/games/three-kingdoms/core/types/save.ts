/**
 * 核心接口 — 存档管理
 *
 * 定义游戏存档的读写接口，抽象底层存储实现。
 * 具体实现可基于 localStorage、IndexedDB 或服务端存储。
 *
 * @module core/types/save
 */

import type { IGameState } from './state';

/**
 * 存档管理器接口
 *
 * 提供游戏存档的完整生命周期管理：保存、加载、删除、查询。
 * 引擎门面（IGameEngineFacade）通过此接口管理存档。
 *
 * @example
 * ```ts
 * // 保存游戏
 * const state = engine.getGameState();
 * engine.save.save(state);
 *
 * // 检查是否有存档
 * if (engine.save.hasSaveData()) {
 *   const loaded = engine.save.load();
 *   // 恢复游戏状态...
 * }
 *
 * // 删除存档（重新开始）
 * engine.save.deleteSave();
 * ```
 */
export interface ISaveManager {
  /**
   * 保存游戏状态
   *
   * 将当前游戏状态序列化并持久化到存储中。
   * 保存前通常会更新 state.timestamp 和 metadata.saveCount。
   *
   * @param data - 要保存的游戏状态
   * @returns 是否保存成功（存储空间不足等情况下可能失败）
   */
  save(data: IGameState): boolean;

  /**
   * 加载游戏状态
   *
   * 从存储中反序列化并返回最近一次保存的游戏状态。
   *
   * @returns 游戏状态，如果没有存档则返回 null
   */
  load(): IGameState | null;

  /**
   * 检查是否存在存档数据
   *
   * 用于游戏启动时判断是显示"继续游戏"还是"新游戏"。
   *
   * @returns 是否存在有效存档
   */
  hasSaveData(): boolean;

  /**
   * 删除存档
   *
   * 清除持久化存储中的游戏存档数据。
   * 通常在玩家选择"重新开始"时调用。
   */
  deleteSave(): void;

  /**
   * 获取最近一次保存时间
   *
   * 返回最近一次成功保存的 Unix 时间戳（毫秒）。
   * 用于计算离线时长和显示"上次保存时间"。
   *
   * @returns 时间戳，如果没有存档则返回 null
   */
  getLastSaveTime(): number | null;
}
