/**
 * 引擎层 — 连锁事件系统
 *
 * 管理连锁事件链的完整生命周期：
 *   - 事件链注册与管理
 *   - 链节点推进（选择驱动）
 *   - 触发条件验证
 *   - 链进度追踪
 *   - 序列化/反序列化
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ChainId,
  ChainNodeId,
  ChainOptionId,
  EventChainDef,
  ChainNodeDef,
  ChainProgress,
  ChainAdvanceResult,
  ChainEventSaveData,
} from './chain-event-types';
import {
  MAX_ALLOWED_DEPTH,
  CHAIN_SAVE_VERSION,
} from './chain-event-types';

export class ChainEventSystem implements ISubsystem {
  readonly name = 'chainEvent';

  private deps!: ISystemDeps;
  private chains: Map<ChainId, EventChainDef> = new Map();
  private progresses: Map<ChainId, ChainProgress> = new Map();

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 连锁事件由外部驱动，不需要帧更新
  }

  getState(): { chains: EventChainDef[]; progresses: Map<ChainId, ChainProgress> } {
    return {
      chains: Array.from(this.chains.values()),
      progresses: new Map(this.progresses),
    };
  }

  reset(): void {
    this.chains.clear();
    this.progresses.clear();
  }

  // ─────────────────────────────────────────
  // 事件链注册
  // ─────────────────────────────────────────

  /**
   * 注册事件链定义
   *
   * @param chain - 事件链定义
   * @throws 如果 maxDepth 超过限制
   */
  registerChain(chain: EventChainDef): void {
    if (chain.maxDepth > MAX_ALLOWED_DEPTH) {
      throw new Error(
        `[ChainEventSystem] 链 ${chain.id} 深度 ${chain.maxDepth} 超过最大限制 ${MAX_ALLOWED_DEPTH}`,
      );
    }

    // 验证节点深度
    for (const node of chain.nodes) {
      if (node.depth > chain.maxDepth) {
        throw new Error(
          `[ChainEventSystem] 节点 ${node.id} 深度 ${node.depth} 超过链最大深度 ${chain.maxDepth}`,
        );
      }
    }

    this.chains.set(chain.id, chain);
  }

  /**
   * 批量注册事件链
   */
  registerChains(chains: EventChainDef[]): void {
    chains.forEach((c) => this.registerChain(c));
  }

  /**
   * 获取事件链定义
   */
  getChain(chainId: ChainId): EventChainDef | undefined {
    return this.chains.get(chainId);
  }

  /**
   * 获取所有事件链定义
   */
  getAllChains(): EventChainDef[] {
    return Array.from(this.chains.values());
  }

  // ─────────────────────────────────────────
  // 链操作
  // ─────────────────────────────────────────

  /**
   * 开始事件链
   *
   * 将链推进到第一个节点（depth=0）。
   *
   * @param chainId - 链 ID
   * @returns 根节点定义，失败返回 null
   */
  startChain(chainId: ChainId): ChainNodeDef | null {
    const chain = this.chains.get(chainId);
    if (!chain) return null;

    // 查找根节点
    const rootNode = chain.nodes.find((n) => n.depth === 0);
    if (!rootNode) return null;

    // 创建进度
    const progress: ChainProgress = {
      chainId,
      currentNodeId: rootNode.id,
      completedNodeIds: new Set(),
      isCompleted: false,
      startedAt: Date.now(),
      completedAt: null,
    };

    this.progresses.set(chainId, progress);

    this.deps?.eventBus.emit('chain:started', {
      chainId,
      nodeId: rootNode.id,
      eventDefId: rootNode.eventDefId,
    });

    return rootNode;
  }

  /**
   * 推进事件链
   *
   * 根据玩家选择的选项推进到下一个节点。
   * 如果没有匹配的后续节点，链标记为完成。
   *
   * @param chainId - 链 ID
   * @param optionId - 玩家选择的选项 ID
   * @returns 推进结果
   */
  advanceChain(chainId: ChainId, optionId: ChainOptionId): ChainAdvanceResult {
    const chain = this.chains.get(chainId);
    const progress = this.progresses.get(chainId);

    if (!chain || !progress) {
      return {
        success: false,
        previousNodeId: null,
        currentNode: null,
        chainCompleted: false,
        reason: '事件链不存在或未开始',
      };
    }

    if (progress.isCompleted) {
      return {
        success: false,
        previousNodeId: progress.currentNodeId,
        currentNode: null,
        chainCompleted: true,
        reason: '事件链已完成',
      };
    }

    // 标记当前节点完成
    const previousNodeId = progress.currentNodeId;
    if (previousNodeId) {
      progress.completedNodeIds.add(previousNodeId);
    }

    // 查找匹配选项的下一个节点
    const nextNode = chain.nodes.find(
      (n) =>
        n.parentNodeId === previousNodeId &&
        n.parentOptionId === optionId &&
        n.depth <= chain.maxDepth,
    ) ?? null;

    if (nextNode) {
      progress.currentNodeId = nextNode.id;

      this.deps?.eventBus.emit('chain:advanced', {
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
      };
    }

    // 没有后续节点，链完成
    progress.currentNodeId = null;
    progress.isCompleted = true;
    progress.completedAt = Date.now();

    this.deps?.eventBus.emit('chain:completed', {
      chainId,
      completedNodeIds: Array.from(progress.completedNodeIds),
    });

    return {
      success: true,
      previousNodeId,
      currentNode: null,
      chainCompleted: true,
    };
  }

  /**
   * 获取当前节点
   */
  getCurrentNode(chainId: ChainId): ChainNodeDef | null {
    const chain = this.chains.get(chainId);
    const progress = this.progresses.get(chainId);
    if (!chain || !progress || !progress.currentNodeId) return null;

    return chain.nodes.find((n) => n.id === progress.currentNodeId) ?? null;
  }

  /**
   * 获取链进度
   */
  getProgress(chainId: ChainId): ChainProgress | undefined {
    return this.progresses.get(chainId);
  }

  /**
   * 获取链的进度统计
   */
  getProgressStats(chainId: ChainId): { completed: number; total: number; percentage: number } {
    const chain = this.chains.get(chainId);
    const progress = this.progresses.get(chainId);
    if (!chain) return { completed: 0, total: 0, percentage: 0 };

    const total = chain.nodes.length;
    const completed = progress?.completedNodeIds.size ?? 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  /**
   * 检查链是否已开始
   */
  isChainStarted(chainId: ChainId): boolean {
    return this.progresses.has(chainId);
  }

  /**
   * 检查链是否已完成
   */
  isChainCompleted(chainId: ChainId): boolean {
    return this.progresses.get(chainId)?.isCompleted ?? false;
  }

  /**
   * 获取指定节点的后续节点列表
   */
  getNextNodes(chainId: ChainId, nodeId: ChainNodeId): ChainNodeDef[] {
    const chain = this.chains.get(chainId);
    if (!chain) return [];

    return chain.nodes.filter((n) => n.parentNodeId === nodeId);
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 导出存档数据 */
  exportSaveData(): ChainEventSaveData {
    return {
      version: CHAIN_SAVE_VERSION,
      chainProgresses: Array.from(this.progresses.entries()).map(
        ([chainId, progress]) => ({
          chainId,
          currentNodeId: progress.currentNodeId,
          completedNodeIds: Array.from(progress.completedNodeIds),
          isCompleted: progress.isCompleted,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
        }),
      ),
    };
  }

  /** 导入存档数据 */
  importSaveData(data: ChainEventSaveData): void {
    this.progresses.clear();

    for (const cp of data.chainProgresses ?? []) {
      this.progresses.set(cp.chainId, {
        chainId: cp.chainId,
        currentNodeId: cp.currentNodeId,
        completedNodeIds: new Set(cp.completedNodeIds),
        isCompleted: cp.isCompleted,
        startedAt: cp.startedAt,
        completedAt: cp.completedAt,
      });
    }
  }
}
