/**
 * ChainEventSystemV15 单元测试
 *
 * 覆盖 v15.0 连锁事件系统深化的所有功能：
 * - ISubsystem 接口
 * - 链注册（深度验证、合并点验证）
 * - 链启动与推进
 * - 分支合并
 * - 超时处理
 * - 访问路径追踪
 * - 进度统计
 * - 序列化/反序列化
 */

import { ChainEventSystemV15 } from '../ChainEventSystemV15';
import type { ISystemDeps } from '../../../core/types';
import type {
  EventChainDefV15,
  ChainNodeDefV15,
  ChainMergePoint,
} from '../../../core/event/event-v15.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): ChainEventSystemV15 {
  const sys = new ChainEventSystemV15();
  sys.init(mockDeps());
  return sys;
}

/** 创建简单的线性链 */
function createLinearChain(): EventChainDefV15 {
  return {
    id: 'chain-linear',
    name: '线性链',
    description: '测试线性链',
    category: 'chain',
    maxDepth: 3,
    timeoutTurns: null,
    mergePoints: [],
    nodes: [
      { id: 'node-1', eventDefId: 'evt-1', depth: 0 },
      { id: 'node-2', eventDefId: 'evt-2', parentNodeId: 'node-1', parentOptionId: 'go', depth: 1 },
      { id: 'node-3', eventDefId: 'evt-3', parentNodeId: 'node-2', parentOptionId: 'go', depth: 2 },
    ],
  };
}

/** 创建分支合并链 */
function createBranchMergeChain(): EventChainDefV15 {
  return {
    id: 'chain-branch',
    name: '分支合并链',
    description: '测试分支合并',
    category: 'story',
    maxDepth: 3,
    timeoutTurns: 10,
    mergePoints: [
      {
        mergeNodeId: 'node-merge',
        sourceNodeIds: ['node-left', 'node-right'],
        requireAll: true,
      },
    ],
    nodes: [
      { id: 'node-root', eventDefId: 'evt-root', depth: 0 },
      { id: 'node-left', eventDefId: 'evt-left', parentNodeId: 'node-root', parentOptionId: 'left', depth: 1 },
      { id: 'node-right', eventDefId: 'evt-right', parentNodeId: 'node-root', parentOptionId: 'right', depth: 1 },
      { id: 'node-merge', eventDefId: 'evt-merge', depth: 2, isMergeNode: true, mergeSourceIds: ['node-left', 'node-right'] },
    ],
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('ChainEventSystemV15', () => {
  // ─── ISubsystem 接口 ────────────────────────

  describe('ISubsystem', () => {
    it('应有正确的 name', () => {
      const sys = createSystem();
      expect(sys.name).toBe('chainEventV15');
    });

    it('reset 应清空所有状态', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      sys.startChain('chain-linear', 1);
      sys.reset();
      expect(sys.getAllChains()).toHaveLength(0);
    });
  });

  // ─── 链注册 ────────────────────────────────

  describe('链注册', () => {
    it('应成功注册有效链', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      expect(sys.getChain('chain-linear')).toBeDefined();
    });

    it('深度超过限制应抛出异常', () => {
      const sys = createSystem();
      const chain = { ...createLinearChain(), maxDepth: 15 };
      expect(() => sys.registerChain(chain)).toThrow('超过最大限制');
    });

    it('节点深度超过链最大深度应抛出异常', () => {
      const sys = createSystem();
      const chain: EventChainDefV15 = {
        ...createLinearChain(),
        maxDepth: 1,
        nodes: [
          { id: 'n1', eventDefId: 'e1', depth: 0 },
          { id: 'n2', eventDefId: 'e2', depth: 3 }, // 超过 maxDepth
        ],
      };
      expect(() => sys.registerChain(chain)).toThrow('超过链最大深度');
    });

    it('批量注册应正确工作', () => {
      const sys = createSystem();
      sys.registerChains([createLinearChain(), createBranchMergeChain()]);
      expect(sys.getAllChains()).toHaveLength(2);
    });

    it('按分类获取链', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain()); // category: chain
      sys.registerChain(createBranchMergeChain()); // category: story
      expect(sys.getChainsByCategory('chain')).toHaveLength(1);
      expect(sys.getChainsByCategory('story')).toHaveLength(1);
    });
  });

  // ─── 链启动与推进 ──────────────────────────

  describe('链启动与推进', () => {
    it('应成功启动链并返回根节点', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      const rootNode = sys.startChain('chain-linear', 1);
      expect(rootNode).not.toBeNull();
      expect(rootNode!.id).toBe('node-1');
      expect(rootNode!.depth).toBe(0);
    });

    it('启动不存在的链应返回null', () => {
      const sys = createSystem();
      expect(sys.startChain('nonexistent', 1)).toBeNull();
    });

    it('应正确推进线性链', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      sys.startChain('chain-linear', 1);

      // 推进到 node-2
      const result1 = sys.advanceChain('chain-linear', 'go', 2);
      expect(result1.success).toBe(true);
      expect(result1.currentNode?.id).toBe('node-2');
      expect(result1.chainCompleted).toBe(false);

      // 推进到 node-3
      const result2 = sys.advanceChain('chain-linear', 'go', 3);
      expect(result2.success).toBe(true);
      expect(result2.currentNode?.id).toBe('node-3');

      // 没有后续节点，链完成
      const result3 = sys.advanceChain('chain-linear', 'go', 4);
      expect(result3.chainCompleted).toBe(true);
    });

    it('推进未开始的链应失败', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      const result = sys.advanceChain('chain-linear', 'go', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在或未开始');
    });

    it('推进已完成的链应失败', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      sys.startChain('chain-linear', 1);
      // 快速完成链
      sys.advanceChain('chain-linear', 'go', 2);
      sys.advanceChain('chain-linear', 'go', 3);
      sys.advanceChain('chain-linear', 'go', 4);

      const result = sys.advanceChain('chain-linear', 'go', 5);
      expect(result.success).toBe(false);
      expect(result.chainCompleted).toBe(true);
    });
  });

  // ─── 分支合并 ──────────────────────────────

  describe('分支合并', () => {
    it('requireAll=true 时需所有来源完成才合并', () => {
      const sys = createSystem();
      sys.registerChain(createBranchMergeChain());
      sys.startChain('chain-branch', 1);

      // 选择 left 分支
      const result1 = sys.advanceChain('chain-branch', 'left', 2);
      expect(result1.success).toBe(true);
      expect(result1.currentNode?.id).toBe('node-left');

      // 从 node-left 继续，无直接后续，检查合并
      // 但只有 node-left 完成，node-right 未完成
      const result2 = sys.advanceChain('chain-branch', 'any', 3);
      // 没有匹配的后续节点，链完成（因为 requireAll 未满足）
      expect(result2.chainCompleted).toBe(true);
    });

    it('requireAll=true 时所有来源完成应合并', () => {
      const sys = createSystem();
      const chain: EventChainDefV15 = {
        id: 'merge-test',
        name: '合并测试',
        description: '',
        category: 'chain',
        maxDepth: 3,
        timeoutTurns: null,
        mergePoints: [
          {
            mergeNodeId: 'merge-node',
            sourceNodeIds: ['src-a'],
            requireAll: true,
          },
        ],
        nodes: [
          { id: 'root', eventDefId: 'e1', depth: 0 },
          { id: 'src-a', eventDefId: 'e2', parentNodeId: 'root', parentOptionId: 'go-a', depth: 1 },
          { id: 'merge-node', eventDefId: 'e3', depth: 2, isMergeNode: true, mergeSourceIds: ['src-a'] },
        ],
      };
      sys.registerChain(chain);
      sys.startChain('merge-test', 1);

      sys.advanceChain('merge-test', 'go-a', 2);
      const result = sys.advanceChain('merge-test', 'any', 3);
      expect(result.success).toBe(true);
      expect(result.isMerge).toBe(true);
      expect(result.currentNode?.id).toBe('merge-node');
    });
  });

  // ─── 超时处理 ──────────────────────────────

  describe('超时处理', () => {
    it('链超时应正确标记', () => {
      const sys = createSystem();
      sys.registerChain(createBranchMergeChain()); // timeoutTurns: 10
      sys.startChain('chain-branch', 1);

      // 在超时前推进
      const result1 = sys.advanceChain('chain-branch', 'left', 5);
      expect(result1.isTimedOut).toBe(false);

      // 超过超时回合
      const result2 = sys.advanceChain('chain-branch', 'any', 15);
      expect(result2.isTimedOut).toBe(true);
      expect(result2.chainCompleted).toBe(true);
    });

    it('checkTimeouts 应批量检查所有链', () => {
      const sys = createSystem();
      sys.registerChain(createBranchMergeChain());
      sys.startChain('chain-branch', 1);

      const timedOut = sys.checkTimeouts(15);
      expect(timedOut).toContain('chain-branch');
      expect(sys.isChainTimedOut('chain-branch')).toBe(true);
    });

    it('无超时的链不应超时', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain()); // timeoutTurns: null
      sys.startChain('chain-linear', 1);

      const timedOut = sys.checkTimeouts(100);
      expect(timedOut).toHaveLength(0);
      expect(sys.isChainTimedOut('chain-linear')).toBe(false);
    });
  });

  // ─── 访问路径追踪 ──────────────────────────

  describe('访问路径追踪', () => {
    it('应记录访问的分支路径', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      sys.startChain('chain-linear', 1);
      sys.advanceChain('chain-linear', 'go', 2);
      sys.advanceChain('chain-linear', 'go', 3);

      const branches = sys.getVisitedBranches('chain-linear');
      expect(branches).toEqual(['go', 'go']);
    });
  });

  // ─── 进度统计 ──────────────────────────────

  describe('进度统计', () => {
    it('应正确计算进度', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      sys.startChain('chain-linear', 1);

      let stats = sys.getProgressStats('chain-linear');
      expect(stats.completed).toBe(0);
      expect(stats.total).toBe(3);
      expect(stats.percentage).toBe(0);

      sys.advanceChain('chain-linear', 'go', 2);
      stats = sys.getProgressStats('chain-linear');
      expect(stats.completed).toBe(1);
      expect(stats.percentage).toBe(33);
    });

    it('isChainStarted/isChainCompleted 应正确返回', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());

      expect(sys.isChainStarted('chain-linear')).toBe(false);
      sys.startChain('chain-linear', 1);
      expect(sys.isChainStarted('chain-linear')).toBe(true);
      expect(sys.isChainCompleted('chain-linear')).toBe(false);
    });
  });

  // ─── 后续节点查询 ──────────────────────────

  describe('后续节点查询', () => {
    it('应返回正确的后续节点', () => {
      const sys = createSystem();
      sys.registerChain(createBranchMergeChain());

      const nextNodes = sys.getNextNodes('chain-branch', 'node-root');
      expect(nextNodes).toHaveLength(2);
      expect(nextNodes.map(n => n.id)).toContain('node-left');
      expect(nextNodes.map(n => n.id)).toContain('node-right');
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('exportSaveData/importSaveData 应保持一致性', () => {
      const sys = createSystem();
      sys.registerChain(createLinearChain());
      sys.startChain('chain-linear', 1);
      sys.advanceChain('chain-linear', 'go', 2);

      const data = sys.exportSaveData();

      const sys2 = createSystem();
      sys2.registerChain(createLinearChain());
      sys2.importSaveData(data);

      const progress = sys2.getProgress('chain-linear');
      expect(progress).toBeDefined();
      expect(progress!.visitedBranches).toEqual(['go']);
      expect(progress!.startedAtTurn).toBe(1);
    });
  });
});
