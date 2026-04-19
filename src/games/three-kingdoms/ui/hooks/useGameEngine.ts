/**
 * 三国霸业 — 引擎生命周期 Hook
 *
 * 职责：
 *   1. 创建 ThreeKingdomsEngine 实例
 *   2. 启动游戏循环（setInterval tick）
 *   3. 管理 snapshot 状态，每次 tick 后更新
 *   4. 提供加载/保存/重置操作
 *   5. 组件卸载时清理资源
 *
 * 设计原则：
 *   - 不包含任何渲染逻辑
 *   - 返回的数据均为不可变 snapshot
 *   - 引擎实例通过 ref 持有，避免重复创建
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { EngineSnapshot } from '@/games/three-kingdoms/shared/types';
import type { OfflineEarnings } from '@/games/three-kingdoms/shared/types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** tick 间隔（ms），与引擎建议一致 */
const TICK_INTERVAL_MS = 100;

// ─────────────────────────────────────────────
// 返回值类型
// ─────────────────────────────────────────────

export interface UseGameEngineResult {
  /** 引擎实例（用于传递给 GameProvider） */
  engine: ThreeKingdomsEngine;
  /** 最新快照，null 表示引擎尚未初始化 */
  snapshot: EngineSnapshot | null;
  /** 引擎是否已完成初始化（load 或 init） */
  isReady: boolean;
  /** 离线收益信息（仅 load 时有值） */
  offlineEarnings: OfflineEarnings | null;
  /** 手动保存 */
  save: () => void;
  /** 手动加载存档，返回离线收益 */
  load: () => OfflineEarnings | null;
  /** 重置引擎（清除存档 + 重新初始化） */
  reset: () => void;
}

// ─────────────────────────────────────────────
// Hook 实现
// ─────────────────────────────────────────────

/**
 * useGameEngine — 管理引擎的完整生命周期。
 *
 * 应在顶层组件中调用一次，将返回的 engine + snapshot 传入 GameProvider。
 *
 * @example
 * ```tsx
 * function GameApp() {
 *   const gameEngine = useGameEngine();
 *   return (
 *     <GameContext.Provider value={{ engine: gameEngine.engine, snapshot: gameEngine.snapshot }}>
 *       <GameUI />
 *     </GameContext.Provider>
 *   );
 * }
 * ```
 */
export function useGameEngine(): UseGameEngineResult {
  // ── 引擎实例（只创建一次） ──
  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new ThreeKingdomsEngine();
  }
  const engine = engineRef.current;

  // ── 状态 ──
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [offlineEarnings, setOfflineEarnings] = useState<OfflineEarnings | null>(null);

  // ── 定时器引用 ──
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 快照更新（使用 useCallback 避免闭包捕获旧 engine） ──
  const updateSnapshot = useCallback(() => {
    const snap = engine.getSnapshot();
    setSnapshot(snap);
  }, [engine]);

  // ── 初始化 & 游戏循环 ──
  useEffect(() => {
    // 尝试加载存档，无存档则新游戏
    const loaded = engine.load();
    if (!loaded) {
      engine.init();
    } else {
      setOfflineEarnings(loaded);
    }

    setIsReady(true);
    updateSnapshot();

    // 启动游戏循环
    timerRef.current = setInterval(() => {
      engine.tick(TICK_INTERVAL_MS);
      updateSnapshot();
    }, TICK_INTERVAL_MS);

    // 清理：停止循环 + 重置引擎
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      engine.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 操作方法 ──

  const save = useCallback(() => {
    engine.save();
  }, [engine]);

  const load = useCallback((): OfflineEarnings | null => {
    const result = engine.load();
    if (result) {
      setOfflineEarnings(result);
    }
    updateSnapshot();
    return result;
  }, [engine, updateSnapshot]);

  const reset = useCallback(() => {
    // 停止旧循环
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    // 重置引擎并重新初始化
    engine.reset();
    engine.init();
    updateSnapshot();

    // 重新启动循环
    timerRef.current = setInterval(() => {
      engine.tick(TICK_INTERVAL_MS);
      updateSnapshot();
    }, TICK_INTERVAL_MS);
  }, [engine, updateSnapshot]);

  return {
    engine,
    snapshot,
    isReady,
    offlineEarnings,
    save,
    load,
    reset,
  };
}
