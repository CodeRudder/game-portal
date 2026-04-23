/**
 * Chain event - types
 *
 * Extracted from ChainEventSystem.ts.
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId } from '../../core/event';
// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export type ChainId = string;

/** 链节点 ID */
export type ChainNodeId = string;

/** 选项 ID */
export type ChainOptionId = string;

/** 连锁事件链定义 */
export interface EventChainDef {
  /** 链唯一 ID */
  id: ChainId;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 事件节点列表 */
  nodes: ChainNodeDef[];
  /** 最大深度（1-5） */
  maxDepth: number;
}

/** 连锁事件节点定义 */
export interface ChainNodeDef {
  /** 节点 ID */
  id: ChainNodeId;
  /** 关联事件定义 ID */
  eventDefId: EventId;
  /** 前序节点 ID（根节点为 undefined） */
  parentNodeId?: ChainNodeId;
  /** 前序选项 ID（哪个选择触发此节点） */
  parentOptionId?: ChainOptionId;
  /** 深度（根节点为 0） */
  depth: number;
  /** 节点描述 */
  description?: string;
}

/** 链运行时进度 */
export interface ChainProgress {
  /** 链 ID */
  chainId: ChainId;
  /** 当前活跃节点 ID */
  currentNodeId: ChainNodeId | null;
  /** 已完成节点 ID 集合 */
  completedNodeIds: Set<ChainNodeId>;
  /** 链是否已完成 */
  isCompleted: boolean;
  /** 开始时间 */
  startedAt: number;
  /** 完成时间 */
  completedAt: number | null;
}

/** 链推进结果 */
export interface ChainAdvanceResult {
  /** 是否推进成功 */
  success: boolean;
  /** 前一个节点 ID */
  previousNodeId: ChainNodeId | null;
  /** 当前节点（推进后的新节点） */
  currentNode: ChainNodeDef | null;
  /** 链是否已完成 */
  chainCompleted: boolean;
  /** 失败原因 */
  reason?: string;
}

/** 连锁事件系统存档数据 */
export interface ChainEventSaveData {
  /** 版本号 */
  version: number;
  /** 链进度列表 */
  chainProgresses: Array<{
    chainId: ChainId;
    currentNodeId: ChainNodeId | null;
    completedNodeIds: ChainNodeId[];
    isCompleted: boolean;
    startedAt: number;
    completedAt: number | null;
  }>;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大允许深度 */
export const MAX_ALLOWED_DEPTH = 5;

/** 存档版本 */
export const CHAIN_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 连锁事件系统
// ─────────────────────────────────────────────

/**
 * 连锁事件系统
 *
 * 管理事件链的注册、推进和进度追踪。
 *
 * @example
 * ```ts
 * const chainSys = new ChainEventSystem();
 * chainSys.init(deps);
 *
 * // 注册事件链
 * chainSys.registerChain({
 *   id: 'yellow-turban-chain',
 *   name: '黄巾之乱',
 *   nodes: [
 *     { id: 'node-1', eventDefId: 'evt-yt-1', depth: 0 },
 *     { id: 'node-2', eventDefId: 'evt-yt-2', parentNodeId: 'node-1', parentOptionId: 'fight', depth: 1 },
 *   ],
 *   maxDepth: 2,
 * });
 *
 * // 开始链
 * chainSys.startChain('yellow-turban-chain');
 *
 * // 推进链
 * chainSys.advanceChain('yellow-turban-chain', 'fight');
 * ```
 */
