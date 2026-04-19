/**
 * 三国霸业 — 游戏 Context
 *
 * 通过 React Context 向组件树提供引擎实例与状态快照。
 * UI 层的所有 hooks 均通过 useGameContext() 获取引擎引用，
 * 不直接 new ThreeKingdomsEngine。
 */

import { createContext, useContext } from 'react';
import type { ThreeKingdomsEngine } from '../../engine/ThreeKingdomsEngine';
import type { EngineSnapshot } from '../../shared/types';

// ─────────────────────────────────────────────
// Context Value 类型
// ─────────────────────────────────────────────

export interface GameContextValue {
  /** 引擎实例（只读引用，不直接暴露 setter） */
  engine: ThreeKingdomsEngine;
  /** 最近一次 tick 的引擎快照，null 表示尚未初始化 */
  snapshot: EngineSnapshot | null;
}

// ─────────────────────────────────────────────
// Context 创建
// ─────────────────────────────────────────────

/**
 * 游戏 Context — 默认值为 null，必须通过 GameProvider 提供值。
 * 故意的 null 设计：强制子组件在 Provider 内使用。
 */
export const GameContext = createContext<GameContextValue | null>(null);

// ─────────────────────────────────────────────
// Consumer Hook
// ─────────────────────────────────────────────

/**
 * 获取游戏 Context 的安全 Hook。
 *
 * @throws 如果在 GameProvider 外部调用则抛出错误
 * @returns GameContextValue（engine + snapshot）
 *
 * @example
 * ```tsx
 * const { engine, snapshot } = useGameContext();
 * ```
 */
export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error(
      'useGameContext must be used within a <GameProvider>. ' +
      'Make sure the component is wrapped with GameContext.Provider.',
    );
  }
  return ctx;
}
