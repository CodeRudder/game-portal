/**
 * 引擎层 — 连锁事件引擎 v15.0
 *
 * 功能覆盖：
 *   #11 连锁事件引擎（分支追踪 + 快照）
 *   #12 连锁事件数据结构（增强版）
 *
 * 设计：
 *   - 事件链定义支持分支（同一节点不同选项→不同后续）
 *   - ChainSnapshot 追踪当前分支路径
 *   - 最大深度限制5
 *   - 与现有 ChainEventSystem 兼容并增强
 *
 * @module engine/event/ChainEventEngine
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId, EventConsequence } from '../../core/event';
import type {
  ChainBranch,
  ChainSnapshot,
} from '../../core/event/event-v15.types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 连锁事件链 ID */
export type ChainEngineId = string;

/** 链节点 ID */
export type ChainEngineNodeId = string;

/** 选项 ID */
export type ChainEngineOptionId = string;

/** 连锁事件链定义（增强版） */
export interface ChainEventDefV15 {
  /** 链唯一 ID */
  id: ChainEngineId;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 事件节点列表 */
  nodes: ChainNodeDefV15[];
  /** 最大深度（1-5） */
  maxDepth: number;
}

/** 连锁事件节点定义（增强版） */
export interface ChainNodeDefV15 {
  /** 节点 ID */
  id: ChainEngineNodeId;
  /** 关联事件定义 ID */
  eventDefId: EventId;
  /** 前序节点 ID（根节点为 undefined） */
  parentNodeId?: ChainEngineNodeId;
  /** 前序选项 ID（哪个选择触发此节点） */
  parentOptionId?: ChainEngineOptionId;
  /** 深度（根节点为 0） */
  depth: number;
  /** 节点描述 */
  description?: string;
  /** 选项列表 */
  options: ChainNodeOption[];
}

/** 链节点选项 */
export interface ChainNodeOption {
  /** 选项 ID */
  id: ChainEngineOptionId;
  /** 选项文本 */
  text: string;
  /** 后果 */
  consequences: EventConsequence;
}

/** 链推进结果（增强版） */
export interface ChainAdvanceResultV15 {
  /** 是否推进成功 */
  success: boolean;
  /** 前一个节点 ID */
  previousNodeId: ChainEngineNodeId | null;
  /** 当前节点（推进后的新节点） */
  currentNode: ChainNodeDefV15 | null;
  /** 链是否已完成 */
  chainCompleted: boolean;
  /** 当前快照 */
  snapshot: ChainSnapshot | null;
  /** 失败原因 */
  reason?: string;
}

/** 连锁事件引擎存档数据 */
export interface ChainEngineSaveData {
  version: number;
  snapshots: Array<{
    chainId: ChainEngineId;
    currentBranch: ChainBranch | null;
    branches: ChainBranch[];
    currentDepth: number;
    maxDepth: number;
    completionPercent: number;
  }>;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大允许深度 */
const MAX_ALLOWED_DEPTH = 5;

/** 存档版本 */
const CHAIN_ENGINE_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 连锁事件引擎
// ─────────────────────────────────────────────

/**
 * 连锁事件引擎 v15
 *
 * 增强版连锁事件系统，支持分支追踪和快照。
 */
export class ChainEventEngine implements ISubsystem {
  readonly name = 'chainEventEngine';

  private deps!: ISystemDeps;
  private chains: Map<ChainEngineId, ChainEventDefV15> = new Map();
  private snapshots: Map<ChainEngineId, ChainSnapshot> = new Map();
  private branchIdCounter = 0;

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 由外部驱动
  }

  getState() {
    return {
      chains: Array.from(this.chains.values()),
      snapshots: new Map(this.snapshots),
    };
  }

  reset(): void {
    this.chains.clear();
    this.snapshots.clear();
    this.branchIdCounter = 0;
  }

  // ─────────────────────────────────────────
  // 链注册
  // ─────────────────────────────────────────

  /**
   * 注册事件链
   */
  registerChain(chain: ChainEventDefV15): void {
    if (chain.maxDepth > MAX_ALLOWED_DEPTH) {
      throw new Error(
        `[ChainEventEngine] 链 ${chain.id} 深度 ${chain.maxDepth} 超过最大限制 ${MAX_ALLOWED_DEPTH}`,
      );
    }

    // 验证节点深度
    for (const node of chain.nodes) {
      if (node.depth > chain.maxDepth) {
        throw new Error(
          `[ChainEventEngine] 节点 ${node.id} 深度 ${node.depth} 超过链最大深度 ${chain.maxDepth}`,
        );
      }
    }

    this.chains.set(chain.id, chain);
  }

  /**
   * 批量注册
   */
  registerChains(chains: ChainEventDefV15[]): void {
    chains.forEach((c) => this.registerChain(c));
  }

  /**
   * 获取链定义
   */
  getChain(chainId: ChainEngineId): ChainEventDefV15 | undefined {
    return this.chains.get(chainId);
  }

  /**
   * 获取所有链定义
   */
  getAllChains(): ChainEventDefV15[] {
    return Array.from(this.chains.values());
  }

  // ─────────────────────────────────────────
  // 链操作
  // ─────────────────────────────────────────

  /**
   * 开始事件链
   *
   * 创建初始分支并推进到根节点。
   */
  startChain(chainId: ChainEngineId): ChainNodeDefV15 | null {
    const chain = this.chains.get(chainId);
    if (!chain) return null;

    // 查找根节点
    const rootNode = chain.nodes.find((n) => n.depth === 0);
    if (!rootNode) return null;

    // 创建初始分支
    this.branchIdCounter++;
    const initialBranch: ChainBranch = {
      id: `branch-${this.branchIdCounter}`,
      chainId,
      path: [rootNode.id],
      status: 'active',
    };

    // 创建快照
    const snapshot: ChainSnapshot = {
      chainId,
      currentBranch: initialBranch,
      branches: [initialBranch],
      currentDepth: 0,
      maxDepth: chain.maxDepth,
      completionPercent: 0,
    };

    this.snapshots.set(chainId, snapshot);

    this.deps?.eventBus.emit('chain-engine:started', {
      chainId,
      nodeId: rootNode.id,
      eventDefId: rootNode.eventDefId,
    });

    return rootNode;
  }

  /**
   * 推进事件链
   *
   * 根据选项推进到下一节点。支持分支：
   *   - 如果有匹配的后续节点 → 推进
   *   - 如果没有 → 链完成
   */
  advanceChain(
    chainId: ChainEngineId,
    optionId: ChainEngineOptionId,
  ): ChainAdvanceResultV15 {
    const chain = this.chains.get(chainId);
    const snapshot = this.snapshots.get(chainId);

    if (!chain || !snapshot) {
      return {
        success: false,
        previousNodeId: null,
        currentNode: null,
        chainCompleted: false,
        snapshot: null,
        reason: '事件链不存在或未开始',
      };
    }

    if (!snapshot.currentBranch || snapshot.currentBranch.status !== 'active') {
      return {
        success: false,
        previousNodeId: null,
        currentNode: null,
        chainCompleted: true,
        snapshot,
        reason: '事件链已完成或无活跃分支',
      };
    }

    // 查找当前节点
    const currentPath = snapshot.currentBranch.path;
    const currentNodeId = currentPath[currentPath.length - 1];
    const previousNodeId = currentNodeId;

    // 查找匹配选项的下一节点
    const nextNode = chain.nodes.find(
      (n) => n.parentNodeId === currentNodeId && n.parentOptionId === optionId,
    ) ?? null;

    if (nextNode) {
      // 推进到下一节点
      snapshot.currentBranch.path.push(nextNode.id);
      snapshot.currentDepth = nextNode.depth;

      // 更新完成百分比
      snapshot.completionPercent = Math.round(
        (snapshot.currentBranch.path.length / chain.nodes.length) * 100,
      );

      this.deps?.eventBus.emit('chain-engine:advanced', {
        chainId,
        fromNodeId: previousNodeId,
        toNodeId: nextNode.id,
        eventDefId: nextNode.eventDefId,
        optionId,
      });

      return {
        success: true,
        previousNodeId,
        currentNode: nextNode,
        chainCompleted: false,
        snapshot,
      };
    }

    // 没有后续节点 → 当前分支完成
    snapshot.currentBranch.status = 'completed';
    snapshot.completionPercent = 100;
    snapshot.currentDepth = snapshot.maxDepth;

    this.deps?.eventBus.emit('chain-engine:completed', {
      chainId,
      branchId: snapshot.currentBranch.id,
      path: snapshot.currentBranch.path,
    });

    return {
      success: true,
      previousNodeId,
      currentNode: null,
      chainCompleted: true,
      snapshot,
    };
  }

  /**
   * 放弃当前分支
   *
   * 标记当前分支为放弃，可用于切换到其他分支。
   */
  abandonBranch(chainId: ChainEngineId): boolean {
    const snapshot = this.snapshots.get(chainId);
    if (!snapshot || !snapshot.currentBranch) return false;

    snapshot.currentBranch.status = 'abandoned';
    return true;
  }

  // ─────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────

  /**
   * 获取快照
   */
  getSnapshot(chainId: ChainEngineId): ChainSnapshot | undefined {
    return this.snapshots.get(chainId);
  }

  /**
   * 获取当前节点
   */
  getCurrentNode(chainId: ChainEngineId): ChainNodeDefV15 | null {
    const chain = this.chains.get(chainId);
    const snapshot = this.snapshots.get(chainId);
    if (!chain || !snapshot || !snapshot.currentBranch) return null;

    const path = snapshot.currentBranch.path;
    const currentNodeId = path[path.length - 1];
    return chain.nodes.find((n) => n.id === currentNodeId) ?? null;
  }

  /**
   * 获取指定节点的后续节点列表
   */
  getNextNodes(chainId: ChainEngineId, nodeId: ChainEngineNodeId): ChainNodeDefV15[] {
    const chain = this.chains.get(chainId);
    if (!chain) return [];
    return chain.nodes.filter((n) => n.parentNodeId === nodeId);
  }

  /**
   * 获取当前节点的可用选项
   */
  getCurrentOptions(chainId: ChainEngineId): ChainNodeOption[] {
    const node = this.getCurrentNode(chainId);
    return node?.options ?? [];
  }

  /**
   * 检查链是否已开始
   */
  isChainStarted(chainId: ChainEngineId): boolean {
    return this.snapshots.has(chainId);
  }

  /**
   * 检查链是否已完成
   */
  isChainCompleted(chainId: ChainEngineId): boolean {
    const snapshot = this.snapshots.get(chainId);
    if (!snapshot) return false;
    return snapshot.currentBranch?.status === 'completed' || snapshot.completionPercent >= 100;
  }

  /**
   * 获取进度统计
   */
  getProgressStats(chainId: ChainEngineId): {
    completed: number;
    total: number;
    percentage: number;
  } {
    const chain = this.chains.get(chainId);
    const snapshot = this.snapshots.get(chainId);
    if (!chain) return { completed: 0, total: 0, percentage: 0 };

    const total = chain.nodes.length;
    const completed = snapshot?.currentBranch?.path.length ?? 0;
    const percentage = snapshot?.completionPercent ?? 0;

    return { completed, total, percentage };
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 导出存档 */
  exportSaveData(): ChainEngineSaveData {
    return {
      version: CHAIN_ENGINE_SAVE_VERSION,
      snapshots: Array.from(this.snapshots.entries()).map(
        ([chainId, snapshot]) => ({
          chainId,
          currentBranch: snapshot.currentBranch
            ? { ...snapshot.currentBranch, path: [...snapshot.currentBranch.path] }
            : null,
          branches: snapshot.branches.map((b) => ({ ...b, path: [...b.path] })),
          currentDepth: snapshot.currentDepth,
          maxDepth: snapshot.maxDepth,
          completionPercent: snapshot.completionPercent,
        }),
      ),
    };
  }

  /** 导入存档 */
  importSaveData(data: ChainEngineSaveData): void {
    this.snapshots.clear();

    for (const s of data.snapshots ?? []) {
      this.snapshots.set(s.chainId, {
        chainId: s.chainId,
        currentBranch: s.currentBranch
          ? { ...s.currentBranch, path: [...s.currentBranch.path] }
          : null,
        branches: s.branches.map((b) => ({ ...b, path: [...b.path] })),
        currentDepth: s.currentDepth,
        maxDepth: s.maxDepth,
        completionPercent: s.completionPercent,
      });
    }
  }
}
