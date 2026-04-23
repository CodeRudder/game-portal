/**
 * 游戏状态管理
 *
 * 定义全局游戏状态的默认值、创建函数和类型守卫。
 * 所有子系统的状态通过 subsystems 字段集中管理。
 *
 * 设计原则：
 * - 提供默认状态工厂函数，确保初始状态一致性
 * - 类型守卫用于运行时校验状态数据
 * - 快照功能用于存档和调试
 * - 版本迁移支持旧存档升级
 *
 * @module core/state/GameState
 */

import type { IGameState } from '../types/state';
import { gameLog } from '../logger';

// ─────────────────────────────────────────────
// 默认值与版本
// ─────────────────────────────────────────────

/** 当前存档格式版本号 */
export const CURRENT_SAVE_VERSION = '1.0.0';

// ─────────────────────────────────────────────
// 工厂函数
// ─────────────────────────────────────────────

/**
 * 创建初始游戏状态
 *
 * 生成一个全新的游戏状态对象，所有子系统状态为空。
 * 子系统在 init 阶段应将自己的初始状态写入 subsystems。
 *
 * @param overrides - 可选的部分覆盖字段
 * @returns 初始游戏状态
 *
 * @example
 * ```ts
 * const state = createInitialState();
 * // { version: '1.0.0', timestamp: 1234567890, subsystems: {}, metadata: {...} }
 *
 * const stateWithVersion = createInitialState({ version: '2.0.0' });
 * ```
 */
export function createInitialState(overrides?: Partial<IGameState>): IGameState {
  return {
    version: CURRENT_SAVE_VERSION,
    timestamp: Date.now(),
    subsystems: {},
    metadata: {
      totalPlayTime: 0,
      saveCount: 0,
      lastVersion: CURRENT_SAVE_VERSION,
    },
    ...overrides,
  };
}

/**
 * 创建空的游戏状态（别名）
 *
 * 与 createInitialState 功能一致，提供语义化的别名。
 * 用于新游戏创建和状态重置场景。
 *
 * @returns 初始游戏状态
 */
export function createEmptyGameState(): IGameState {
  return createInitialState();
}

// ─────────────────────────────────────────────
// 类型守卫
// ─────────────────────────────────────────────

/**
 * 检查值是否为非空对象
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 类型守卫：检查未知值是否为有效的 IGameState
 *
 * 递归校验 IGameState 的结构完整性，包括：
 * - version: string
 * - timestamp: number
 * - subsystems: object
 * - metadata: { totalPlayTime: number, saveCount: number, lastVersion: string }
 *
 * @param value - 待校验的值
 * @returns 是否为有效的 IGameState
 *
 * @example
 * ```ts
 * const data = JSON.parse(rawJson);
 * if (isGameState(data)) {
 *   // 安全使用 data.version, data.subsystems 等
 * } else {
 *   console.error('Invalid game state');
 * }
 * ```
 */
export function isGameState(value: unknown): value is IGameState {
  if (!isObject(value)) return false;

  // version
  if (typeof value.version !== 'string') return false;

  // timestamp
  if (typeof value.timestamp !== 'number') return false;

  // subsystems
  if (!isObject(value.subsystems)) return false;

  // metadata
  if (!isObject(value.metadata)) return false;
  const metadata = value.metadata as Record<string, unknown>;
  if (typeof metadata.totalPlayTime !== 'number') return false;
  if (typeof metadata.saveCount !== 'number') return false;
  if (typeof metadata.lastVersion !== 'string') return false;

  return true;
}

/**
 * 类型守卫别名（兼容 StateSerializer 导入）
 *
 * @param state - 待校验的值
 * @returns 是否为有效的 IGameState
 */
export const validateGameState = isGameState;

/**
 * 类型守卫：检查子系统状态是否存在
 *
 * 用于从 IGameState.subsystems 中安全地提取子系统状态。
 *
 * @param state - 游戏状态
 * @param name - 子系统名称
 * @returns 子系统状态是否存在
 */
export function hasSubsystemState(state: IGameState, name: string): boolean {
  return name in state.subsystems && state.subsystems[name] !== undefined;
}

// ─────────────────────────────────────────────
// 版本迁移
// ─────────────────────────────────────────────

/**
 * 版本迁移映射表
 *
 * 键为源版本，值为 { version: 目标版本, migrate: 迁移函数 }。
 * 支持链式迁移：0.9.0 → 0.10.0 → 1.0.0。
 *
 * 当前仅有占位条目，未来版本升级时在此添加迁移逻辑。
 */
const MIGRATIONS: Record<
  string,
  { version: string; migrate: (state: IGameState) => IGameState }
> = {
  // 示例（未来使用）：
  // '0.9.0': {
  //   version: '1.0.0',
  //   migrate: (state) => ({ ...state, version: '1.0.0', newField: 'default' }),
  // },
};

/**
 * 迁移游戏状态到目标版本
 *
 * 沿迁移链逐步升级，直到达到目标版本或无法继续。
 * 如果当前版本已等于目标版本，直接返回原状态。
 * 如果找不到迁移路径，返回原状态并输出警告。
 *
 * @param state - 当前游戏状态
 * @param targetVersion - 目标版本号（默认为 CURRENT_SAVE_VERSION）
 * @returns 迁移后的游戏状态
 */
export function migrateGameState(
  state: IGameState,
  targetVersion: string = CURRENT_SAVE_VERSION,
): IGameState {
  let current = state;
  let iterations = 0;
  const MAX_ITERATIONS = 20; // 防止无限循环

  while (current.version !== targetVersion && iterations < MAX_ITERATIONS) {
    const migration = MIGRATIONS[current.version];
    if (!migration) {
      gameLog.warn(
        `[GameState] No migration path from v${current.version} to v${targetVersion}. ` +
          'Returning state as-is.',
      );
      return current;
    }
    try {
      current = migration.migrate(current);
    } catch (err) {
      gameLog.error(
        `[GameState] Migration failed at v${current.version}:`,
        err,
      );
      return state; // 返回原始状态
    }
    iterations++;
  }

  if (iterations >= MAX_ITERATIONS) {
    gameLog.warn('[GameState] Migration loop detected, aborting.');
    return state;
  }

  return current;
}

// ─────────────────────────────────────────────
// 快照工具
// ─────────────────────────────────────────────

/**
 * 创建游戏状态快照
 *
 * 对当前状态进行深拷贝，生成独立的状态快照。
 * 用于存档前、调试或对比。
 *
 * @param state - 原始游戏状态
 * @returns 深拷贝的状态快照
 */
export function createSnapshot(state: IGameState): IGameState {
  return JSON.parse(JSON.stringify(state)) as IGameState;
}

/**
 * 合并子系统状态到游戏状态
 *
 * 将一个或多个子系统的状态合并到游戏状态的 subsystems 字段中。
 * 返回新的状态对象（浅拷贝），不修改原状态。
 *
 * @param state - 原始游戏状态
 * @param subsystemStates - 子系统状态键值对
 * @returns 合并后的新游戏状态
 *
 * @example
 * ```ts
 * const state = createInitialState();
 * const updated = mergeSubsystemStates(state, {
 *   building: { buildings: [], totalLevel: 0 },
 *   general: { generals: [], bonds: [] },
 * });
 * ```
 */
export function mergeSubsystemStates(
  state: IGameState,
  subsystemStates: Record<string, unknown>,
): IGameState {
  return {
    ...state,
    timestamp: Date.now(),
    subsystems: {
      ...state.subsystems,
      ...subsystemStates,
    },
  };
}

/**
 * 合并两个游戏状态
 *
 * 以 base 为基础，用 overlay 中的非 undefined 字段覆盖。
 * subsystems 和 metadata 执行浅合并（不递归嵌套）。
 *
 * @param base - 基础状态
 * @param overlay - 覆盖状态（部分字段）
 * @returns 合并后的新状态
 *
 * @example
 * ```ts
 * const updated = mergeGameState(currentState, {
 *   timestamp: Date.now(),
 *   subsystems: { building: newBuildingState },
 * });
 * ```
 */
export function mergeGameState(
  base: IGameState,
  overlay: Partial<IGameState>,
): IGameState {
  return {
    ...base,
    ...(overlay.version !== undefined && { version: overlay.version }),
    ...(overlay.timestamp !== undefined && { timestamp: overlay.timestamp }),
    ...(overlay.subsystems !== undefined && {
      subsystems: { ...base.subsystems, ...overlay.subsystems },
    }),
    ...(overlay.metadata !== undefined && {
      metadata: { ...base.metadata, ...overlay.metadata },
    }),
  };
}

/**
 * 更新游戏状态元数据
 *
 * 返回新的状态对象，metadata 字段与传入的 updates 合并。
 *
 * @param state - 原始游戏状态
 * @param updates - 元数据更新字段
 * @returns 更新后的新游戏状态
 */
export function updateMetadata(
  state: IGameState,
  updates: Partial<IGameState['metadata']>,
): IGameState {
  return {
    ...state,
    metadata: {
      ...state.metadata,
      ...updates,
    },
  };
}
