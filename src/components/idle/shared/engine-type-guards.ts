/**
 * engine-type-guards — 引擎类型守卫
 *
 * 替代 typeof 检查引擎方法存在性的模式，
 * 使用接口类型 + 类型守卫函数实现编译时 + 运行时双重安全。
 *
 * @module components/idle/shared/engine-type-guards
 */

import type { IBattleEngineV4 } from '@/games/three-kingdoms/engine';
import type { BattleMode } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// NPC 子系统接口
// ─────────────────────────────────────────────

/** NPC 子系统对外暴露的方法集合 */
export interface INPCSubsystem {
  getAllNPCs(): import('@/games/three-kingdoms/core/npc').NPCData[];
}

// ─────────────────────────────────────────────
// 领土子系统接口
// ─────────────────────────────────────────────

/** 领土子系统对外暴露的方法集合 */
export interface ITerritorySubsystem {
  upgradeTerritory(id: string): unknown;
}

// ─────────────────────────────────────────────
// 教程引擎接口
// ─────────────────────────────────────────────

/** 支持教程奖励发放的引擎接口 */
export interface IEngineWithTutorialRewards {
  grantTutorialRewards(
    rewards: ReadonlyArray<{
      type: string;
      rewardId: string;
      name: string;
      amount: number;
    }>,
  ): unknown;
}

// ─────────────────────────────────────────────
// 类型守卫函数
// ─────────────────────────────────────────────

/**
 * 检查 battleEngine 是否支持 v4 大招时停 API
 *
 * 替代 typeof battleEngine.setBattleMode === 'function' 模式
 */
export function isBattleEngineV4(
  engine: unknown,
): engine is IBattleEngineV4 {
  if (engine == null || typeof engine !== 'object') return false;
  const e = engine as Record<string, unknown>;
  return (
    typeof e.setBattleMode === 'function' &&
    typeof e.confirmUltimate === 'function' &&
    typeof e.cancelUltimate === 'function'
  );
}

/**
 * 检查对象是否为 NPC 子系统
 *
 * 替代 typeof npcSys.getAllNPCs === 'function' 模式
 */
export function isNPCSubsystem(
  obj: unknown,
): obj is INPCSubsystem {
  if (obj == null || typeof obj !== 'object') return false;
  return typeof (obj as Record<string, unknown>).getAllNPCs === 'function';
}

/**
 * 检查对象是否为领土子系统（支持升级）
 *
 * 替代 typeof territorySys.upgradeTerritory === 'function' 模式
 */
export function isTerritorySubsystem(
  obj: unknown,
): obj is ITerritorySubsystem {
  if (obj == null || typeof obj !== 'object') return false;
  return typeof (obj as Record<string, unknown>).upgradeTerritory === 'function';
}

/**
 * 检查引擎是否支持教程奖励发放
 *
 * 替代 typeof engine.grantTutorialRewards === 'function' 模式
 */
export function hasTutorialRewards(
  engine: unknown,
): engine is IEngineWithTutorialRewards {
  if (engine == null || typeof engine !== 'object') return false;
  return typeof (engine as Record<string, unknown>).grantTutorialRewards === 'function';
}
