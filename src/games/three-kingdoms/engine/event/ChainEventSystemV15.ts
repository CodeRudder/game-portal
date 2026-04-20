/**
 * 引擎层 — v15.0 连锁事件系统深化
 *
 * 在 v7.0 ChainEventSystem 基础上深化：
 *   - 分支合并点：多条分支路径汇聚到同一节点
 *   - 超时处理：链节点超时自动推进或终止
 *   - 5类事件分类集成
 *   - 访问路径追踪
 *   - 序列化/反序列化
 *
 * @module engine/event/ChainEventSystemV15
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId } from '../../core/event';
import type {
  ChainId,
  ChainNodeId,
  EventCategory,
  EventChainDefV15,
  ChainNodeDefV15,
  ChainProgressV15,
  ChainAdvanceResultV15,
  ChainMergePoint,
  EventSaveDataV15,
} from '../../core/event/event-v15.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大允许深度 */
const MAX_ALLOWED_DEPTH = 10;

/** 默认超时回合数 */
const DEFAULT_TIMEOUT_TURNS = 10;

/** 存档版本 */
const CHAIN_V15_SAVE_VERSION = 15;

// ─────────────────────────────────────────────
// 连锁事件系统 v15
// ─────────────────────────────────────────────

/**
 * v15.0 连锁事件系统
 *
 * 支持分支合并、超时处理和路径追踪的连锁事件管理。
 */
export class ChainEventSystemV15 implements ISubsystem {
  readonly name = 'chainEventV15';

  private deps!: ISystemDeps;
  private chains: Map<ChainId, EventChainDefV15> = new Map();
  private progresses: Map<ChainId, ChainProgressV15> = new Map();

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 由外部 tick 驱动
  }

  getState() {
    return {
      chains: Array.from(this.chains.values()),
      progresses: new Map(this.progresses),
    };
  }

  reset(): void {
    this.chains.clear();
    this.progresses.clear();
  }

  // ─── 链注册 ────────────────────────────────

  /**
   * 注册事件链定义
   *
   * @throws 如果 maxDepth 超过限制
   */
  registerChain(chain: EventChainDefV15): void {
    if (chain.maxDepth > MAX_ALLOWED_DEPTH) {
      throw new Error(
        `[ChainEventV15] 链 ${chain.id} 深度 ${chain.maxDepth} 超过最大限制 ${MAX_ALLOWED_DEPTH}`,
      );
    }

    // 验证节点深度
    for (const node of chain.nodes) {
      if (node.depth > chain.maxDepth) {
        throw new Error(
          `[ChainEventV15] 节点 ${node.id} 深度 ${node.depth} 超过链最大深度 ${chain.maxDepth}`,
        );
      }
    }

    // 验证合并点
    for (const mp of chain.mergePoints) {
      const mergeNode = chain.nodes.find(n => n.id === mp.mergeNodeId);
      if (!mergeNode) {
        throw new Error(
          `[ChainEventV15] 合并节点 ${mp.mergeNodeId} 不存在于链 ${chain.id} 中`,
        );
      }
      mergeNode.isMergeNode = true;
      mergeNode.mergeSourceIds = mp.sourceNodeIds;
    }

    this.chains.set(chain.id, chain);
  }

  /** 批量注册 */
  registerChains(chains: EventChainDefV15[]): void {
    chains.forEach(c => this.registerChain(c));
  }

  /** 获取链定义 */
  getChain(chainId: ChainId): EventChainDefV15 | undefined {
    return this.chains.get(chainId);
  }

  /** 获取所有链 */
  getAllChains(): EventChainDefV15[] {
    return Array.from(this.chains.values());
  }

  /** 按分类获取链 */
  getChainsByCategory(category: EventCategory): EventChainDefV15[] {
    return this.getAllChains().filter(c => c.category === category);
  }

  // ─── 链操作 ────────────────────────────────

  /**
   * 开始事件链
   *
   * 将链推进到第一个节点（depth=0）。
   */
  startChain(chainId: ChainId, currentTurn: number): ChainNodeDefV15 | null {
    const chain = this.chains.get(chainId);
    if (!chain) return null;

    const rootNode = chain.nodes.find(n => n.depth === 0);
    if (!rootNode) return null;

    const progress: ChainProgressV15 = {
      chainId,
      currentNodeId: rootNode.id,
      completedNodeIds: new Set(),
      visitedBranches: [],
      isCompleted: false,
      startedAtTurn: currentTurn,
      completedAtTurn: null,
      isTimedOut: false,
    };

    this.progresses.set(chainId, progress);

    this.deps?.eventBus.emit('chainV15:started', {
      chainId,
      nodeId: rootNode.id,
      eventDefId: rootNode.eventDefId,
    });

    return rootNode;
  }

  /**
   * 推进事件链
   *
   * 根据选择的选项推进到下一个节点。
   * 支持分支合并和超时检测。
   */
  advanceChain(chainId: ChainId, optionId: string, currentTurn: number): ChainAdvanceResultV15 {
    const chain = this.chains.get(chainId);
    const progress = this.progresses.get(chainId);

    if (!chain || !progress) {
      return {
        success: false,
        previousNodeId: null,
        currentNode: null,
        chainCompleted: false,
        isMerge: false,
        isTimedOut: false,
        reason: '事件链不存在或未开始',
      };
    }

    if (progress.isCompleted) {
      return {
        success: false,
        previousNodeId: progress.currentNodeId,
        currentNode: null,
        chainCompleted: true,
        isMerge: false,
        isTimedOut: false,
        reason: '事件链已完成',
      };
    }

    // 检查超时
    const timeoutTurns = chain.timeoutTurns ?? DEFAULT_TIMEOUT_TURNS;
    if (chain.timeoutTurns !== null) {
      const elapsed = currentTurn - progress.startedAtTurn;
      if (elapsed > timeoutTurns) {
        progress.isTimedOut = true;
        progress.isCompleted = true;
        progress.completedAtTurn = currentTurn;
        progress.currentNodeId = null;

        this.deps?.eventBus.emit('chainV15:timedOut', {
          chainId,
          startedAtTurn: progress.startedAtTurn,
          currentTurn,
        });

        return {
          success: false,
          previousNodeId: progress.currentNodeId,
          currentNode: null,
          chainCompleted: true,
          isMerge: false,
          isTimedOut: true,
          reason: `事件链超时（${timeoutTurns}回合）`,
        };
      }
    }

    const previousNodeId = progress.currentNodeId;
    if (previousNodeId) {
      progress.completedNodeIds.add(previousNodeId);
    }

    // 记录分支路径
    progress.visitedBranches.push(optionId);

    // 查找下一个节点
    let nextNode = chain.nodes.find(
      n => n.parentNodeId === previousNodeId && n.parentOptionId === optionId,
    ) ?? null;

    // 如果没有直接匹配，检查合并节点
    let isMerge = false;
    if (!nextNode) {
      const mergeResult = this.checkMergePoints(chain, progress, previousNodeId);
      if (mergeResult) {
        nextNode = mergeResult;
        isMerge = true;
      }
    }

    if (nextNode) {
      progress.currentNodeId = nextNode.id;

      this.deps?.eventBus.emit('chainV15:advanced', {
        chainId,
        fromNodeId: previousNodeId,
        toNodeId: nextNode.id,
        eventDefId: nextNode.eventDefId,
        optionId,
        isMerge,
      });

      return {
        success: true,
        previousNodeId,
        currentNode: nextNode,
        chainCompleted: false,
        isMerge,
        isTimedOut: false,
      };
    }

    // 没有后续节点，链完成
    progress.currentNodeId = null;
    progress.isCompleted = true;
    progress.completedAtTurn = currentTurn;

    this.deps?.eventBus.emit('chainV15:completed', {
      chainId,
      completedNodeIds: Array.from(progress.completedNodeIds),
      visitedBranches: progress.visitedBranches,
    });

    return {
      success: true,
      previousNodeId,
      currentNode: null,
      chainCompleted: true,
      isMerge: false,
      isTimedOut: false,
    };
  }

  /** 获取当前节点 */
  getCurrentNode(chainId: ChainId): ChainNodeDefV15 | null {
    const chain = this.chains.get(chainId);
    const progress = this.progresses.get(chainId);
    if (!chain || !progress || !progress.currentNodeId) return null;

    return chain.nodes.find(n => n.id === progress.currentNodeId) ?? null;
  }

  /** 获取链进度 */
  getProgress(chainId: ChainId): ChainProgressV15 | undefined {
    return this.progresses.get(chainId);
  }

  /** 获取进度统计 */
  getProgressStats(chainId: ChainId): { completed: number; total: number; percentage: number } {
    const chain = this.chains.get(chainId);
    const progress = this.progresses.get(chainId);
    if (!chain) return { completed: 0, total: 0, percentage: 0 };

    const total = chain.nodes.length;
    const completed = progress?.completedNodeIds.size ?? 0;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  /** 检查链是否已开始 */
  isChainStarted(chainId: ChainId): boolean {
    return this.progresses.has(chainId);
  }

  /** 检查链是否已完成 */
  isChainCompleted(chainId: ChainId): boolean {
    return this.progresses.get(chainId)?.isCompleted ?? false;
  }

  /** 检查链是否超时 */
  isChainTimedOut(chainId: ChainId): boolean {
    return this.progresses.get(chainId)?.isTimedOut ?? false;
  }

  /** 获取后续节点 */
  getNextNodes(chainId: ChainId, nodeId: ChainNodeId): ChainNodeDefV15[] {
    const chain = this.chains.get(chainId);
    if (!chain) return [];
    return chain.nodes.filter(n => n.parentNodeId === nodeId);
  }

  /** 获取已访问分支 */
  getVisitedBranches(chainId: ChainId): string[] {
    return this.progresses.get(chainId)?.visitedBranches ?? [];
  }

  // ─── 超时检查 ──────────────────────────────

  /**
   * 检查所有活跃链的超时状态
   */
  checkTimeouts(currentTurn: number): ChainId[] {
    const timedOut: ChainId[] = [];

    for (const [chainId, chain] of this.chains) {
      const progress = this.progresses.get(chainId);
      if (!progress || progress.isCompleted) continue;

      if (chain.timeoutTurns !== null) {
        const elapsed = currentTurn - progress.startedAtTurn;
        if (elapsed > chain.timeoutTurns) {
          progress.isTimedOut = true;
          progress.isCompleted = true;
          progress.completedAtTurn = currentTurn;
          progress.currentNodeId = null;
          timedOut.push(chainId);

          this.deps?.eventBus.emit('chainV15:timedOut', {
            chainId,
            startedAtTurn: progress.startedAtTurn,
            currentTurn,
          });
        }
      }
    }

    return timedOut;
  }

  // ─── 序列化 ────────────────────────────────

  /** 导出存档 */
  exportSaveData(): EventSaveDataV15 {
    return {
      version: CHAIN_V15_SAVE_VERSION,
      chainProgresses: Array.from(this.progresses.entries()).map(([, p]) => ({
        chainId: p.chainId,
        currentNodeId: p.currentNodeId,
        completedNodeIds: Array.from(p.completedNodeIds),
        visitedBranches: p.visitedBranches,
        isCompleted: p.isCompleted,
        startedAtTurn: p.startedAtTurn,
        completedAtTurn: p.completedAtTurn,
        isTimedOut: p.isTimedOut,
      })),
      eventWeights: [],
      cooldowns: [],
      offlineQueue: [],
      activityBindings: [],
      timedEvents: [],
      autoProcessRules: [],
    };
  }

  /** 导入存档 */
  importSaveData(data: EventSaveDataV15): void {
    this.progresses.clear();

    for (const cp of data.chainProgresses ?? []) {
      this.progresses.set(cp.chainId, {
        chainId: cp.chainId,
        currentNodeId: cp.currentNodeId,
        completedNodeIds: new Set(cp.completedNodeIds),
        visitedBranches: cp.visitedBranches ?? [],
        isCompleted: cp.isCompleted,
        startedAtTurn: cp.startedAtTurn,
        completedAtTurn: cp.completedAtTurn,
        isTimedOut: cp.isTimedOut,
      });
    }
  }

  // ─── 内部方法 ──────────────────────────────

  /**
   * 检查合并点
   *
   * 当没有直接匹配的后续节点时，检查是否有合并节点可以推进。
   */
  private checkMergePoints(
    chain: EventChainDefV15,
    progress: ChainProgressV15,
    _currentNodeId: ChainNodeId | null,
  ): ChainNodeDefV15 | null {
    for (const mp of chain.mergePoints) {
      if (mp.requireAll) {
        // 需要所有来源节点都完成
        const allCompleted = mp.sourceNodeIds.every(id => progress.completedNodeIds.has(id));
        if (allCompleted) {
          return chain.nodes.find(n => n.id === mp.mergeNodeId) ?? null;
        }
      } else {
        // 任意来源节点完成即可
        const anyCompleted = mp.sourceNodeIds.some(id => progress.completedNodeIds.has(id));
        if (anyCompleted) {
          return chain.nodes.find(n => n.id === mp.mergeNodeId) ?? null;
        }
      }
    }
    return null;
  }
}
