/**
 * 核心接口 — 游戏状态
 *
 * 定义游戏全局状态的统一结构，用于存档、读档和状态快照。
 * 所有子系统的状态通过 subsystems 字段集中管理。
 *
 * @module core/types/state
 */

/**
 * 游戏状态接口
 *
 * 描述游戏在某一时刻的完整状态快照，支持序列化到 localStorage。
 * 每个子系统通过 getState() 导出自己的状态，合并到此接口中。
 *
 * @example
 * ```ts
 * const state: IGameState = {
 *   version: '1.0.0',
 *   timestamp: Date.now(),
 *   subsystems: {
 *     building: buildingSystem.getState(),
 *     general: generalSystem.getState(),
 *     campaign: campaignSystem.getState(),
 *   },
 *   metadata: {
 *     totalPlayTime: 3600,
 *     saveCount: 5,
 *     lastVersion: '1.0.0',
 *   },
 * };
 * ```
 */
export interface IGameState {
  /**
   * 存档格式版本号
   *
   * 遵循语义化版本（semver），用于存档兼容性检查。
   * 读档时如果版本不匹配，应触发迁移逻辑或提示用户。
   */
  version: string;

  /**
   * 存档时间戳
   *
   * Unix 时间戳（毫秒），记录状态快照的创建时间。
   * 用于离线奖励计算和存档排序。
   */
  timestamp: number;

  /**
   * 子系统状态集合
   *
   * 以子系统名称为键，子系统状态为值。
   * 每个子系统负责自己状态的序列化/反序列化。
   */
  subsystems: Record<string, unknown>;

  /**
   * 存档元数据
   *
   * 记录与游戏玩法无关的辅助信息，如累计游玩时间、存档次数等。
   */
  metadata: {
    /** 累计游玩时长（秒） */
    totalPlayTime: number;
    /** 累计存档次数 */
    saveCount: number;
    /** 上次存档时的游戏版本号 */
    lastVersion: string;
  };
}
