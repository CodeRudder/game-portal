import { vi } from 'vitest';
/**
 * ChainEventSystem 单元测试
 *
 * 覆盖连锁事件系统的所有功能：
 * - ISubsystem 接口
 * - 事件链注册
 * - 链启动
 * - 链推进（选择驱动分支）
 * - 链进度追踪
 * - 深度限制验证
 * - 序列化/反序列化
 */

import { ChainEventSystem } from '../ChainEventSystem';
import type { EventChainDef, ChainNodeDef } from '../ChainEventSystem';
import type { ISystemDeps } from '../../../core/types';

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

function createSystem(): ChainEventSystem {
  const sys = new ChainEventSystem();
  sys.init(mockDeps());
  return sys;
}

/** 创建简单的线性链（3节点） */
function createLinearChain(): EventChainDef {
  return {
    id: 'chain-linear',
    name: '线性测试链',
    description: 'A→B→C线性推进',
    maxDepth: 3,
    nodes: [
      { id: 'node-a', eventDefId: 'evt-a', depth: 0 },
      { id: 'node-b', eventDefId: 'evt-b', parentNodeId: 'node-a', parentOptionId: 'opt-next', depth: 1 },
      { id: 'node-c', eventDefId: 'evt-c', parentNodeId: 'node-b', parentOptionId: 'opt-next', depth: 2 },
    ],
  };
}

/** 创建分支链 */
function createBranchChain(): EventChainDef {
  return {
    id: 'chain-branch',
    name: '分支测试链',
    description: 'A→B/C分支',
    maxDepth: 2,
    nodes: [
      { id: 'node-a', eventDefId: 'evt-a', depth: 0 },
      { id: 'node-b', eventDefId: 'evt-b', parentNodeId: 'node-a', parentOptionId: 'opt-left', depth: 1 },
      { id: 'node-c', eventDefId: 'evt-c', parentNodeId: 'node-a', parentOptionId: 'opt-right', depth: 1 },
    ],
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('ChainEventSystem', () => {
  let system: ChainEventSystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ─── ISubsystem 接口 ────────────────────────

  describe('ISubsystem 接口', () => {
    it('应该有正确的 name 属性', () => {
      expect(system.name).toBe('chainEvent');
    });

    it('init 不应抛出异常', () => {
      expect(() => system.init(mockDeps())).not.toThrow();
    });

    it('update 不应抛出异常', () => {
      expect(() => system.update(16)).not.toThrow();
    });

    it('getState 应返回有效状态', () => {
      const state = system.getState();
      expect(state).toHaveProperty('chains');
      expect(state).toHaveProperty('progresses');
    });

    it('reset 应清空所有数据', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');
      system.reset();
      expect(system.getAllChains()).toHaveLength(0);
      expect(system.getProgress('chain-linear')).toBeUndefined();
    });
  });

  // ─── 事件链注册 ────────────────────────────

  describe('事件链注册', () => {
    it('应该能注册事件链', () => {
      system.registerChain(createLinearChain());
      expect(system.getChain('chain-linear')).toBeDefined();
      expect(system.getChain('chain-linear')!.name).toBe('线性测试链');
    });

    it('应该能批量注册事件链', () => {
      system.registerChains([createLinearChain(), createBranchChain()]);
      expect(system.getAllChains()).toHaveLength(2);
    });

    it('深度超过限制应抛出异常', () => {
      const chain: EventChainDef = {
        id: 'chain-deep',
        name: '过深链',
        description: '',
        maxDepth: 10,
        nodes: [],
      };
      expect(() => system.registerChain(chain)).toThrow('超过最大限制');
    });

    it('节点深度超过链最大深度应抛出异常', () => {
      const chain: EventChainDef = {
        id: 'chain-invalid',
        name: '无效链',
        description: '',
        maxDepth: 2,
        nodes: [
          { id: 'n1', eventDefId: 'e1', depth: 0 },
          { id: 'n2', eventDefId: 'e2', depth: 3 },
        ],
      };
      expect(() => system.registerChain(chain)).toThrow('超过链最大深度');
    });

    it('获取不存在的链应返回 undefined', () => {
      expect(system.getChain('nonexistent')).toBeUndefined();
    });
  });

  // ─── 链启动 ────────────────────────────────

  describe('链启动', () => {
    it('应该能启动链并返回根节点', () => {
      system.registerChain(createLinearChain());
      const rootNode = system.startChain('chain-linear');

      expect(rootNode).not.toBeNull();
      expect(rootNode!.id).toBe('node-a');
      expect(rootNode!.depth).toBe(0);
    });

    it('启动不存在的链应返回 null', () => {
      expect(system.startChain('nonexistent')).toBeNull();
    });

    it('启动链应创建进度记录', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      const progress = system.getProgress('chain-linear');
      expect(progress).toBeDefined();
      expect(progress!.currentNodeId).toBe('node-a');
      expect(progress!.isCompleted).toBe(false);
    });

    it('启动链应发出 chain:started 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      expect(deps.eventBus.emit).toHaveBeenCalledWith('chain:started', {
        chainId: 'chain-linear',
        nodeId: 'node-a',
        eventDefId: 'evt-a',
      });
    });
  });

  // ─── 链推进 ────────────────────────────────

  describe('链推进', () => {
    it('应该能推进到下一个节点', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      const result = system.advanceChain('chain-linear', 'opt-next');
      expect(result.success).toBe(true);
      expect(result.currentNode).not.toBeNull();
      expect(result.currentNode!.id).toBe('node-b');
      expect(result.chainCompleted).toBe(false);
    });

    it('连续推进应正确传递', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      // A → B
      const r1 = system.advanceChain('chain-linear', 'opt-next');
      expect(r1.currentNode!.id).toBe('node-b');

      // B → C
      const r2 = system.advanceChain('chain-linear', 'opt-next');
      expect(r2.currentNode!.id).toBe('node-c');
      expect(r2.chainCompleted).toBe(false);
    });

    it('没有后续节点时链应完成', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      system.advanceChain('chain-linear', 'opt-next'); // A → B
      system.advanceChain('chain-linear', 'opt-next'); // B → C

      // C 之后没有后续节点
      const r3 = system.advanceChain('chain-linear', 'opt-next');
      expect(r3.success).toBe(true);
      expect(r3.chainCompleted).toBe(true);
      expect(r3.currentNode).toBeNull();
    });

    it('推进不存在的链应失败', () => {
      const result = system.advanceChain('nonexistent', 'opt');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('已完成的链不应再推进', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      system.advanceChain('chain-linear', 'opt-next');
      system.advanceChain('chain-linear', 'opt-next');
      system.advanceChain('chain-linear', 'opt-next'); // 完成

      const result = system.advanceChain('chain-linear', 'opt-next');
      expect(result.success).toBe(false);
      expect(result.chainCompleted).toBe(true);
    });

    it('推进应发出 chain:advanced 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      system.advanceChain('chain-linear', 'opt-next');

      expect(deps.eventBus.emit).toHaveBeenCalledWith('chain:advanced', {
        chainId: 'chain-linear',
        fromNodeId: 'node-a',
        toNodeId: 'node-b',
        eventDefId: 'evt-b',
        optionId: 'opt-next',
      });
    });

    it('链完成应发出 chain:completed 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      system.advanceChain('chain-linear', 'opt-next');
      system.advanceChain('chain-linear', 'opt-next');
      system.advanceChain('chain-linear', 'opt-next');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'chain:completed',
        expect.objectContaining({ chainId: 'chain-linear' }),
      );
    });
  });

  // ─── 分支链 ────────────────────────────────

  describe('分支链', () => {
    it('选择不同选项应走向不同分支', () => {
      system.registerChain(createBranchChain());
      system.startChain('chain-branch');

      // 选择 left
      const r1 = system.advanceChain('chain-branch', 'opt-left');
      expect(r1.currentNode!.id).toBe('node-b');
    });

    it('选择另一个选项应走向另一个分支', () => {
      system.registerChain(createBranchChain());
      system.startChain('chain-branch');

      // 选择 right
      const r1 = system.advanceChain('chain-branch', 'opt-right');
      expect(r1.currentNode!.id).toBe('node-c');
    });

    it('不匹配的选项应导致链完成', () => {
      system.registerChain(createBranchChain());
      system.startChain('chain-branch');

      const r1 = system.advanceChain('chain-branch', 'opt-unknown');
      expect(r1.chainCompleted).toBe(true);
    });
  });

  // ─── 进度追踪 ──────────────────────────────

  describe('进度追踪', () => {
    it('getProgressStats 应返回正确的统计', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      const stats = system.getProgressStats('chain-linear');
      expect(stats.completed).toBe(0);
      expect(stats.total).toBe(3);
      expect(stats.percentage).toBe(0);
    });

    it('推进后进度应更新', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');
      system.advanceChain('chain-linear', 'opt-next');

      const stats = system.getProgressStats('chain-linear');
      expect(stats.completed).toBe(1);
      expect(stats.percentage).toBe(33);
    });

    it('isChainStarted 应正确反映状态', () => {
      system.registerChain(createLinearChain());
      expect(system.isChainStarted('chain-linear')).toBe(false);

      system.startChain('chain-linear');
      expect(system.isChainStarted('chain-linear')).toBe(true);
    });

    it('isChainCompleted 应正确反映状态', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');

      expect(system.isChainCompleted('chain-linear')).toBe(false);

      system.advanceChain('chain-linear', 'opt-next');
      system.advanceChain('chain-linear', 'opt-next');
      system.advanceChain('chain-linear', 'opt-next');

      expect(system.isChainCompleted('chain-linear')).toBe(true);
    });

    it('getNextNodes 应返回后续节点列表', () => {
      system.registerChain(createBranchChain());
      const nextNodes = system.getNextNodes('chain-branch', 'node-a');
      expect(nextNodes).toHaveLength(2);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('导出后导入应保持一致', () => {
      system.registerChain(createLinearChain());
      system.startChain('chain-linear');
      system.advanceChain('chain-linear', 'opt-next');

      const data = system.exportSaveData();

      const newSystem = createSystem();
      newSystem.registerChain(createLinearChain());
      newSystem.importSaveData(data);

      const progress = newSystem.getProgress('chain-linear');
      expect(progress).toBeDefined();
      expect(progress!.currentNodeId).toBe('node-b');
      expect(progress!.completedNodeIds.has('node-a')).toBe(true);
    });

    it('空系统导出导入不应出错', () => {
      const data = system.exportSaveData();
      expect(data.chainProgresses).toHaveLength(0);

      const newSystem = createSystem();
      expect(() => newSystem.importSaveData(data)).not.toThrow();
    });
  });
});
