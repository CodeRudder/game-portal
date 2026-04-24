/**
 * 集成测试 — 连锁事件深化
 *
 * 覆盖 §2.1~2.5：
 *   §2.1 事件链注册与启动
 *   §2.2 链节点推进与分支选择
 *   §2.3 深度限制验证
 *   §2.4 链进度追踪与序列化
 *   §2.5 超时/异常处理
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChainEventSystem } from '../../ChainEventSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { EventChainDef, ChainNodeDef } from '../../chain-event-types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 构造线性3节点链 */
function makeLinearChain(): EventChainDef {
  return {
    id: 'chain-linear',
    name: '线性测试链',
    description: '3节点线性推进',
    maxDepth: 3,
    nodes: [
      { id: 'node-0', eventDefId: 'evt-a', depth: 0, description: '根节点' },
      { id: 'node-1', eventDefId: 'evt-b', parentNodeId: 'node-0', parentOptionId: 'fight', depth: 1, description: '战斗分支' },
      { id: 'node-2', eventDefId: 'evt-c', parentNodeId: 'node-1', parentOptionId: 'pursue', depth: 2, description: '追击' },
    ],
  };
}

/** 构造分支链（根节点有2个选项→2个子节点） */
function makeBranchChain(): EventChainDef {
  return {
    id: 'chain-branch',
    name: '分支测试链',
    description: '根节点选择产生不同分支',
    maxDepth: 2,
    nodes: [
      { id: 'root', eventDefId: 'evt-root', depth: 0 },
      { id: 'branch-a', eventDefId: 'evt-branch-a', parentNodeId: 'root', parentOptionId: 'ally', depth: 1 },
      { id: 'branch-b', eventDefId: 'evt-branch-b', parentNodeId: 'root', parentOptionId: 'betray', depth: 1 },
      { id: 'leaf-a1', eventDefId: 'evt-leaf-a1', parentNodeId: 'branch-a', parentOptionId: 'advance', depth: 2 },
      { id: 'leaf-b1', eventDefId: 'evt-leaf-b1', parentNodeId: 'branch-b', parentOptionId: 'advance', depth: 2 },
    ],
  };
}

// ═══════════════════════════════════════════════════════════

describe('§2 连锁事件深化 集成', () => {
  let chainSys: ChainEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    chainSys = new ChainEventSystem();
    chainSys.init(deps);
  });

  // ═══════════════════════════════════════════
  // §2.1 事件链注册与启动
  // ═══════════════════════════════════════════
  describe('§2.1 事件链注册与启动', () => {
    it('注册事件链后可获取', () => {
      chainSys.registerChain(makeLinearChain());
      expect(chainSys.getChain('chain-linear')).toBeDefined();
      expect(chainSys.getChain('chain-linear')!.name).toBe('线性测试链');
    });

    it('批量注册多条链', () => {
      chainSys.registerChains([makeLinearChain(), makeBranchChain()]);
      expect(chainSys.getAllChains()).toHaveLength(2);
    });

    it('startChain 返回根节点', () => {
      chainSys.registerChain(makeLinearChain());
      const root = chainSys.startChain('chain-linear');
      expect(root).not.toBeNull();
      expect(root!.depth).toBe(0);
      expect(root!.eventDefId).toBe('evt-a');
    });

    it('startChain 不存在的链返回 null', () => {
      expect(chainSys.startChain('non-existent')).toBeNull();
    });

    it('startChain 触发 chain:started 事件', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'chain:started',
        expect.objectContaining({ chainId: 'chain-linear' }),
      );
    });

    it('链启动后 isChainStarted=true', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      expect(chainSys.isChainStarted('chain-linear')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // §2.2 链节点推进与分支选择
  // ═══════════════════════════════════════════
  describe('§2.2 链节点推进与分支选择', () => {
    it('线性链：按选项推进到下一节点', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');

      const result = chainSys.advanceChain('chain-linear', 'fight');
      expect(result.success).toBe(true);
      expect(result.currentNode).not.toBeNull();
      expect(result.currentNode!.eventDefId).toBe('evt-b');
      expect(result.chainCompleted).toBe(false);
    });

    it('线性链：连续推进到末端完成链', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');

      chainSys.advanceChain('chain-linear', 'fight');
      chainSys.advanceChain('chain-linear', 'pursue');
      // node-2 是最后一个节点，再推进无后续节点则完成
      const result = chainSys.advanceChain('chain-linear', 'end');
      expect(result.success).toBe(true);
      expect(result.chainCompleted).toBe(true);
      expect(chainSys.isChainCompleted('chain-linear')).toBe(true);
    });

    it('分支链：选择 ally 走分支A', () => {
      chainSys.registerChain(makeBranchChain());
      chainSys.startChain('chain-branch');

      const result = chainSys.advanceChain('chain-branch', 'ally');
      expect(result.success).toBe(true);
      expect(result.currentNode!.id).toBe('branch-a');
    });

    it('分支链：选择 betray 走分支B', () => {
      chainSys.registerChain(makeBranchChain());
      chainSys.startChain('chain-branch');

      const result = chainSys.advanceChain('chain-branch', 'betray');
      expect(result.success).toBe(true);
      expect(result.currentNode!.id).toBe('branch-b');
    });

    it('分支链：沿分支A继续推进到叶节点', () => {
      chainSys.registerChain(makeBranchChain());
      chainSys.startChain('chain-branch');
      chainSys.advanceChain('chain-branch', 'ally');

      const result = chainSys.advanceChain('chain-branch', 'advance');
      expect(result.success).toBe(true);
      expect(result.currentNode!.id).toBe('leaf-a1');
    });

    it('分支链：沿分支B继续推进到叶节点', () => {
      chainSys.registerChain(makeBranchChain());
      chainSys.startChain('chain-branch');
      chainSys.advanceChain('chain-branch', 'betray');

      const result = chainSys.advanceChain('chain-branch', 'advance');
      expect(result.success).toBe(true);
      expect(result.currentNode!.id).toBe('leaf-b1');
    });

    it('无效选项导致链完成（无后续节点）', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');

      const result = chainSys.advanceChain('chain-linear', 'invalid-option');
      expect(result.success).toBe(true);
      expect(result.chainCompleted).toBe(true);
    });

    it('已完成的链不能继续推进', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      chainSys.advanceChain('chain-linear', 'fight');
      chainSys.advanceChain('chain-linear', 'pursue');
      chainSys.advanceChain('chain-linear', 'end'); // 完成链

      const result = chainSys.advanceChain('chain-linear', 'any');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已完成');
    });

    it('推进时触发 chain:advanced 事件', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      chainSys.advanceChain('chain-linear', 'fight');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'chain:advanced',
        expect.objectContaining({
          chainId: 'chain-linear',
          optionId: 'fight',
        }),
      );
    });

    it('链完成时触发 chain:completed 事件', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      chainSys.advanceChain('chain-linear', 'fight');
      chainSys.advanceChain('chain-linear', 'pursue');
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      chainSys.advanceChain('chain-linear', 'end');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'chain:completed',
        expect.objectContaining({ chainId: 'chain-linear' }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // §2.3 深度限制验证
  // ═══════════════════════════════════════════
  describe('§2.3 深度限制验证', () => {
    it('maxDepth 超过5时注册抛出异常', () => {
      const deepChain: EventChainDef = {
        id: 'too-deep', name: '过深', description: '',
        maxDepth: 6, nodes: [],
      };
      expect(() => chainSys.registerChain(deepChain)).toThrow(/深度.*超过最大限制/);
    });

    it('节点深度超过链 maxDepth 时注册抛出异常', () => {
      const badChain: EventChainDef = {
        id: 'bad-node', name: '坏节点', description: '',
        maxDepth: 2,
        nodes: [
          { id: 'n0', eventDefId: 'e0', depth: 0 },
          { id: 'n1', eventDefId: 'e1', depth: 3 },
        ],
      };
      expect(() => chainSys.registerChain(badChain)).toThrow(/节点.*深度.*超过/);
    });

    it('maxDepth=5 可正常注册', () => {
      const maxChain: EventChainDef = {
        id: 'max-ok', name: '最大允许', description: '',
        maxDepth: 5,
        nodes: [{ id: 'n0', eventDefId: 'e0', depth: 0 }],
      };
      expect(() => chainSys.registerChain(maxChain)).not.toThrow();
    });

    it('getNextNodes 返回指定节点的后续节点', () => {
      chainSys.registerChain(makeBranchChain());
      const next = chainSys.getNextNodes('chain-branch', 'root');
      expect(next).toHaveLength(2);
      expect(next.map(n => n.id)).toContain('branch-a');
      expect(next.map(n => n.id)).toContain('branch-b');
    });
  });

  // ═══════════════════════════════════════════
  // §2.4 链进度追踪与序列化
  // ═══════════════════════════════════════════
  describe('§2.4 链进度追踪与序列化', () => {
    it('getProgressStats 返回正确进度', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');

      const stats = chainSys.getProgressStats('chain-linear');
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(0);
      expect(stats.percentage).toBe(0);
    });

    it('推进后进度更新', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      chainSys.advanceChain('chain-linear', 'fight');

      const stats = chainSys.getProgressStats('chain-linear');
      expect(stats.completed).toBe(1);
      expect(stats.percentage).toBe(33);
    });

    it('getCurrentNode 返回当前活跃节点', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      chainSys.advanceChain('chain-linear', 'fight');

      const node = chainSys.getCurrentNode('chain-linear');
      expect(node).not.toBeNull();
      expect(node!.id).toBe('node-1');
    });

    it('序列化/反序列化保留链进度', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      chainSys.advanceChain('chain-linear', 'fight');

      const data = chainSys.exportSaveData();
      const newSys = new ChainEventSystem();
      newSys.init(mockDeps());
      newSys.registerChain(makeLinearChain());
      newSys.importSaveData(data);

      expect(newSys.isChainStarted('chain-linear')).toBe(true);
      const progress = newSys.getProgress('chain-linear');
      expect(progress!.completedNodeIds.size).toBe(1);
    });

    it('reset 清空所有链和进度', () => {
      chainSys.registerChain(makeLinearChain());
      chainSys.startChain('chain-linear');
      chainSys.reset();
      expect(chainSys.getAllChains()).toHaveLength(0);
      expect(chainSys.isChainStarted('chain-linear')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // §2.5 超时/异常处理
  // ═══════════════════════════════════════════
  describe('§2.5 超时/异常处理', () => {
    it('推进未启动的链返回失败', () => {
      chainSys.registerChain(makeLinearChain());
      const result = chainSys.advanceChain('chain-linear', 'fight');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在或未开始');
    });

    it('推进不存在的链返回失败', () => {
      const result = chainSys.advanceChain('ghost', 'any');
      expect(result.success).toBe(false);
    });

    it('getProgress 不存在的链返回 undefined', () => {
      expect(chainSys.getProgress('non-existent')).toBeUndefined();
    });

    it('getCurrentNode 未启动的链返回 null', () => {
      chainSys.registerChain(makeLinearChain());
      expect(chainSys.getCurrentNode('chain-linear')).toBeNull();
    });

    it('getProgressStats 不存在的链返回零值', () => {
      const stats = chainSys.getProgressStats('non-existent');
      expect(stats).toEqual({ completed: 0, total: 0, percentage: 0 });
    });
  });
});
