/**
 * 核心层 — 连锁事件系统 v15 类型
 *
 * 包含：连锁事件链定义、节点定义、合并点、进度、推进结果
 *
 * @module core/event/event-chain.types
 */

import type { EventId } from './event.types';
import type { EventCategory, OptionConsequence } from './event-shared.types';

// ─────────────────────────────────────────────
// 连锁事件系统 v15 类型
// ─────────────────────────────────────────────

/** 连锁事件链 ID */
export type ChainId = string;

/** 连锁事件节点 ID */
export type ChainNodeId = string;

/** 连锁事件合并点 */
export interface ChainMergePoint {
  /** 合并目标节点 ID */
  mergeNodeId: ChainNodeId;
  /** 来源节点 ID 列表 */
  sourceNodeIds: ChainNodeId[];
  /** 是否需要所有来源都完成 */
  requireAll: boolean;
}

/** 连锁事件节点定义 v15 */
export interface ChainNodeDefV15 {
  /** 节点 ID */
  id: ChainNodeId;
  /** 关联事件定义 ID */
  eventDefId: EventId;
  /** 前序节点 ID */
  parentNodeId?: ChainNodeId;
  /** 前序选项 ID */
  parentOptionId?: string;
  /** 深度 */
  depth: number;
  /** 节点描述 */
  description?: string;
  /** 是否合并节点 */
  isMergeNode?: boolean;
  /** 合并来源节点 ID 列表 */
  mergeSourceIds?: ChainNodeId[];
}

/** 连锁事件链定义 v15 */
export interface EventChainDefV15 {
  /** 链 ID */
  id: ChainId;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 事件分类 */
  category: EventCategory;
  /** 最大深度 */
  maxDepth: number;
  /** 超时回合数（null=不超时） */
  timeoutTurns: number | null;
  /** 合并点列表 */
  mergePoints: ChainMergePoint[];
  /** 节点列表 */
  nodes: ChainNodeDefV15[];
}

/** 连锁事件进度 v15 */
export interface ChainProgressV15 {
  /** 链 ID */
  chainId: ChainId;
  /** 当前节点 ID */
  currentNodeId: ChainNodeId | null;
  /** 已完成节点 ID 集合 */
  completedNodeIds: Set<ChainNodeId>;
  /** 已访问分支路径 */
  visitedBranches: string[];
  /** 是否已完成 */
  isCompleted: boolean;
  /** 开始回合 */
  startedAtTurn: number;
  /** 完成回合 */
  completedAtTurn: number | null;
  /** 是否超时 */
  isTimedOut: boolean;
}

/** 连锁事件推进结果 v15 */
export interface ChainAdvanceResultV15 {
  /** 是否成功 */
  success: boolean;
  /** 前一个节点 ID */
  previousNodeId: ChainNodeId | null;
  /** 当前节点 */
  currentNode: ChainNodeDefV15 | null;
  /** 链是否已完成 */
  chainCompleted: boolean;
  /** 是否为合并推进 */
  isMerge: boolean;
  /** 是否超时 */
  isTimedOut: boolean;
  /** 失败原因 */
  reason?: string;
}
