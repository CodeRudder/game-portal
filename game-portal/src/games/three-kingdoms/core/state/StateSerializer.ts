/**
 * 状态序列化器
 *
 * 提供 IGameState 的序列化/反序列化、哈希计算、深拷贝和差异比较功能。
 * 所有方法均为静态方法，无状态，线程安全。
 *
 * 序列化格式：JSON（UTF-8）
 * 哈希算法：djb2（轻量级字符串哈希，用于变更检测，非加密用途）
 *
 * @module core/state/StateSerializer
 */

import type { IGameState } from '../types/state';
import { validateGameState, migrateGameState, CURRENT_SAVE_VERSION } from './GameState';

// ─────────────────────────────────────────────
// 差异结果类型
// ─────────────────────────────────────────────

/**
 * 游戏状态差异描述
 *
 * 记录两个 IGameState 之间的顶层字段差异。
 * 仅比较第一层字段，不递归嵌套对象。
 */
export interface GameStateDiff {
  /** 是否存在差异 */
  hasChanges: boolean;
  /** 发生变化的顶层字段名列表 */
  changedFields: string[];
  /** 各字段的变化详情：{ field: { before, after } } */
  details: Record<string, { before: unknown; after: unknown }>;
}

// ─────────────────────────────────────────────
// 序列化器
// ─────────────────────────────────────────────

/**
 * 状态序列化器
 *
 * 静态工具类，提供游戏状态的序列化、反序列化、哈希、克隆和差异比较。
 *
 * @example
 * ```ts
 * // 序列化
 * const json = StateSerializer.serialize(gameState);
 *
 * // 反序列化（含版本校验和迁移）
 * const state = StateSerializer.deserialize(json);
 *
 * // 变更检测
 * const hash1 = StateSerializer.hash(state1);
 * const hash2 = StateSerializer.hash(state2);
 * if (hash1 !== hash2) { /* 状态已变化 *\/ }
 *
 * // 差异比较
 * const diff = StateSerializer.diff(before, after);
 * console.log(diff.changedFields); // ['timestamp', 'subsystems']
 * ```
 */
export class StateSerializer {
  /**
   * 序列化游戏状态为 JSON 字符串
   *
   * @param state - 游戏状态
   * @returns 格式化后的 JSON 字符串
   * @throws {Error} 序列化失败时（如包含循环引用）
   */
  static serialize(state: IGameState): string {
    return JSON.stringify(state);
  }

  /**
   * 反序列化 JSON 字符串为游戏状态
   *
   * 执行以下步骤：
   * 1. JSON 解析
   * 2. 结构校验（validateGameState）
   * 3. 版本迁移（如果版本不匹配）
   *
   * @param json - JSON 字符串
   * @returns 游戏状态
   * @throws {Error} JSON 解析失败或结构校验失败时
   */
  static deserialize(json: string): IGameState {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw new Error(
        `[StateSerializer] Failed to parse JSON: ${(err as Error).message}`,
      );
    }

    if (!validateGameState(parsed)) {
      throw new Error(
        '[StateSerializer] Deserialized data does not match IGameState structure.',
      );
    }

    // 版本迁移
    if (parsed.version !== CURRENT_SAVE_VERSION) {
      parsed = migrateGameState(parsed, CURRENT_SAVE_VERSION);
    }

    return parsed as IGameState;
  }

  /**
   * 计算状态的哈希值
   *
   * 使用 djb2 算法对序列化后的字符串计算哈希。
   * 用于快速变更检测：两个状态哈希相同则大概率相同。
   *
   * 注意：这是非加密哈希，仅用于缓存/变更检测，不用于安全场景。
   *
   * @param state - 游戏状态
   * @returns 十六进制哈希字符串
   */
  static hash(state: IGameState): string {
    const str = JSON.stringify(state);
    return StateSerializer.djb2Hash(str);
  }

  /**
   * 深拷贝对象
   *
   * 通过 JSON 序列化/反序列化实现深拷贝。
   * 仅支持可 JSON 序列化的值（不支持 Date、RegExp、Function 等）。
   *
   * @typeParam T - 对象类型
   * @param obj - 要拷贝的对象
   * @returns 深拷贝后的新对象
   */
  static clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 比较两个游戏状态的差异
   *
   * 对比顶层字段（version, timestamp, subsystems, metadata），
   * 返回差异描述。仅进行第一层浅比较。
   *
   * @param before - 变更前的状态
   * @param after - 变更后的状态
   * @returns 差异描述
   */
  static diff(before: IGameState, after: IGameState): GameStateDiff {
    const changedFields: string[] = [];
    const details: Record<string, { before: unknown; after: unknown }> = {};

    // 定义需要比较的顶层字段
    const topLevelKeys = ['version', 'timestamp', 'subsystems', 'metadata'] as const;

    for (const key of topLevelKeys) {
      const beforeVal = JSON.stringify(before[key]);
      const afterVal = JSON.stringify(after[key]);
      if (beforeVal !== afterVal) {
        changedFields.push(key);
        details[key] = { before: before[key], after: after[key] };
      }
    }

    return {
      hasChanges: changedFields.length > 0,
      changedFields,
      details,
    };
  }

  // ─────────────────────────────────────────
  // 私有工具
  // ─────────────────────────────────────────

  /**
   * djb2 字符串哈希算法
   *
   * 经典的快速字符串哈希，分布均匀，适合变更检测。
   */
  private static djb2Hash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}
