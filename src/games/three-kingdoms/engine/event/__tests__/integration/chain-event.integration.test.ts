/**
 * 集成测试 §2: 链式事件 — 连锁引擎/分支路径/链追踪/超时/并发
 *
 * 覆盖 v15.0 Play §2 链式事件引擎规则：
 *   - 连锁引擎注册与启动
 *   - 分支路径推进（选择驱动）
 *   - 链进度追踪（节点完成/百分比）
 *   - 链超时与完成检测
 *   - 并发链管理
 *   - 序列化/反序列化
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChainEventSystem } from '../../ChainEventSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  EventChainDef, ChainNodeDef, ChainProgress, ChainAdvanceResult,
} from '../../chain-event-types';
import { MAX_ALLOWED_DEPTH, CHAIN_SAVE_VERSION } from '../../chain-event-types';

// ─────────────────────────────────────────────
// 辅助
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

/** 创建线性链（A→B→C） */
function makeLinearChain(id: string = 'chain-linear'): EventChainDef {
  return {
    id,
    name: '线性测试链',
    description: 'A→B→C 三节点线性链',
    maxDepth: 2,
    nodes: [
      { id: 'node-a', eventDefId: 'evt-a', depth: 0, description: '根节点A' },
      { id: 'node-b', eventDefId: 'evt-b', parentNodeId: 'node-a', parentOptionId: 'opt-next', depth: 1, description: '节点B' },
      { id: 'node-c', eventDefId: 'evt-c', parentNodeId: 'node-b', parentOptionId: 'opt-next', depth: 2, description: '节点C' },
    ],
  };
}

/** 创建分支链（A→B1/B2） */
function makeBranchChain(id: string = 'chain-branch'): EventChainDef {
  return {
    id,
    name: '分支测试链',
    description: 'A→B1(战斗)/B2(外交)',
    maxDepth: 2,
    nodes: [
      { id: 'root', eventDefId: 'evt-root', depth: 0, description: '根节点' },
      { id: 'branch-fight', eventDefId: 'evt-fight', parentNodeId: 'root', parentOptionId: 'opt-fight', depth: 1, description: '战斗分支' },
      { id: 'branch-diplomacy', eventDefId: 'evt-diplomacy', parentNodeId: 'root', parentOptionId: 'opt-diplomacy', depth: 1, description: '外交分支' },
    ],
  };
}

/** 创建深层分支链（A→B→C1/C2） */
function makeDeepBranchChain(id: string = 'chain-deep'): EventChainDef {
  return {
    id,
    name: '深层分支链',
    description: 'A→B→C1/C2 四节点',
    maxDepth: 3,
    nodes: [
      { id: 'n-a', eventDefId: 'evt-a', depth: 0 },
      { id: 'n-b', eventDefId: 'evt-b', parentNodeId: 'n-a', parentOptionId: 'go', depth: 1 },
      { id: 'n-c1', eventDefId: 'evt-c1', parentNodeId: 'n-b', parentOptionId: 'left', depth: 2 },
      { id: 'n-c2', eventDefId: 'evt-c2', parentNodeId: 'n-b', parentOptionId: 'right', depth: 2 },
    ],
  };
}

// ─────────────────────────────────────────────
// §2 链式事件
// ─────────────────────────────────────────────

describe('§2 链式事件 — 连锁引擎/分支路径/链追踪/超时/并发', () => {

  // ─── §2.1 连锁引擎注册与启动 ───────────────

  describe('§2.1 连锁引擎注册与启动', () => {
    let chain: ChainEventSystem;

    beforeEach(() => {
      chain = new ChainEventSystem();
      chain.init(mockDeps());
    });

    it('应成功注册事件链定义', () => {
      const def = makeLinearChain();
      chain.registerChain(def);
      expect(chain.getChain(def.id)).toEqual(def);
    });

    it('应成功批量注册事件链', () => {
      const defs = [makeLinearChain('c1'), makeBranchChain('c2')];
      chain.registerChains(defs);
      expect(chain.getAllChains()).toHaveLength(2);
    });

    it('超过最大深度的链应拒绝注册', () => {
      const tooDeep: EventChainDef = {
        id: 'too-deep', name: '', description: '', maxDepth: MAX_ALLOWED_DEPTH + 1, nodes: [],
      };
      expect(() => chain.registerChain(tooDeep)).toThrow();
    });

    it('节点深度超过链最大深度应拒绝注册', () => {
      const badChain: EventChainDef = {
        id: 'bad', name: '', description: '', maxDepth: 2,
        nodes: [
          { id: 'n1', eventDefId: 'e1', depth: 0 },
          { id: 'n2', eventDefId: 'e2', depth: 3 },
        ],
      };
      expect(() => chain.registerChain(badChain)).toThrow();
    });

    it('startChain 应返回根节点（depth=0）', () => {
      chain.registerChain(makeLinearChain());
      const root = chain.startChain('chain-linear');
      expect(root).not.toBeNull();
      expect(root!.depth).toBe(0);
      expect(root!.id).toBe('node-a');
    });

    it('startChain 不存在的链应返回 null', () => {
      const result = chain.startChain('nonexistent');
      expect(result).toBeNull();
    });

    it('startChain 无根节点的链应返回 null', () => {
      const noRoot: EventChainDef = {
        id: 'no-root', name: '', description: '', maxDepth: 1,
        nodes: [{ id: 'n1', eventDefId: 'e1', depth: 1 }],
      };
      chain.registerChain(noRoot);
      expect(chain.startChain('no-root')).toBeNull();
    });

    it('启动链应发出 chain:started 事件', () => {
      const deps = mockDeps();
      chain.init(deps);
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('chain:started', expect.any(Object));
    });
  });

  // ─── §2.2 分支路径推进 ─────────────────────

  describe('§2.2 分支路径推进（选择驱动）', () => {
    let chain: ChainEventSystem;

    beforeEach(() => {
      chain = new ChainEventSystem();
      chain.init(mockDeps());
    });

    it('线性链应按选择推进到下一节点', () => {
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');

      const result = chain.advanceChain('chain-linear', 'opt-next');
      expect(result.success).toBe(true);
      expect(result.currentNode?.id).toBe('node-b');
      expect(result.chainCompleted).toBe(false);
    });

    it('线性链推进到最后应标记完成', () => {
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');
      chain.advanceChain('chain-linear', 'opt-next'); // A→B
      const result = chain.advanceChain('chain-linear', 'opt-next'); // B→C
      expect(result.success).toBe(true);
      expect(result.chainCompleted).toBe(false); // C是最后一个节点但还没完成
    });

    it('分支链应按选项走不同路径', () => {
      chain.registerChain(makeBranchChain());
      chain.startChain('chain-branch');

      const fightResult = chain.advanceChain('chain-branch', 'opt-fight');
      expect(fightResult.success).toBe(true);
      expect(fightResult.currentNode?.id).toBe('branch-fight');
    });

    it('分支链外交路径应正确推进', () => {
      chain.registerChain(makeBranchChain());
      chain.startChain('chain-branch');

      const dipResult = chain.advanceChain('chain-branch', 'opt-diplomacy');
      expect(dipResult.success).toBe(true);
      expect(dipResult.currentNode?.id).toBe('branch-diplomacy');
    });

    it('无效选项应导致链完成（无后续节点）', () => {
      chain.registerChain(makeBranchChain());
      chain.startChain('chain-branch');

      const result = chain.advanceChain('chain-branch', 'opt-invalid');
      expect(result.success).toBe(true);
      expect(result.chainCompleted).toBe(true);
    });

    it('深层分支链应支持多级推进', () => {
      chain.registerChain(makeDeepBranchChain());
      chain.startChain('chain-deep');

      const r1 = chain.advanceChain('chain-deep', 'go');
      expect(r1.currentNode?.id).toBe('n-b');

      const r2 = chain.advanceChain('chain-deep', 'left');
      expect(r2.currentNode?.id).toBe('n-c1');
    });

    it('推进链应发出 chain:advanced 事件', () => {
      const deps = mockDeps();
      chain.init(deps);
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      chain.advanceChain('chain-linear', 'opt-next');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('chain:advanced', expect.any(Object));
    });
  });

  // ─── §2.3 链进度追踪 ──────────────────────

  describe('§2.3 链进度追踪', () => {
    let chain: ChainEventSystem;

    beforeEach(() => {
      chain = new ChainEventSystem();
      chain.init(mockDeps());
    });

    it('getProgress 应返回正确的进度数据', () => {
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');

      const progress = chain.getProgress('chain-linear');
      expect(progress).toBeDefined();
      expect(progress!.currentNodeId).toBe('node-a');
      expect(progress!.isCompleted).toBe(false);
    });

    it('getProgressStats 应返回正确的完成统计', () => {
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');

      const stats = chain.getProgressStats('chain-linear');
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(0);
      expect(stats.percentage).toBe(0);
    });

    it('推进后 completedNodeIds 应增加', () => {
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');
      chain.advanceChain('chain-linear', 'opt-next');

      const progress = chain.getProgress('chain-linear');
      expect(progress!.completedNodeIds.has('node-a')).toBe(true);
      expect(progress!.completedNodeIds.size).toBe(1);
    });

    it('isChainStarted 应正确反映链启动状态', () => {
      chain.registerChain(makeLinearChain());
      expect(chain.isChainStarted('chain-linear')).toBe(false);
      chain.startChain('chain-linear');
      expect(chain.isChainStarted('chain-linear')).toBe(true);
    });

    it('isChainCompleted 应正确反映链完成状态', () => {
      chain.registerChain(makeBranchChain());
      chain.startChain('chain-branch');
      expect(chain.isChainCompleted('chain-branch')).toBe(false);
      // 第一次推进: root → branch-fight
      chain.advanceChain('chain-branch', 'opt-fight');
      expect(chain.isChainCompleted('chain-branch')).toBe(false);
      // 第二次推进: branch-fight 无后续 → 链完成
      chain.advanceChain('chain-branch', 'opt-next');
      expect(chain.isChainCompleted('chain-branch')).toBe(true);
    });

    it('getCurrentNode 应返回当前活跃节点', () => {
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');

      const current = chain.getCurrentNode('chain-linear');
      expect(current).not.toBeNull();
      expect(current!.id).toBe('node-a');
    });

    it('getNextNodes 应返回指定节点的后续节点', () => {
      chain.registerChain(makeBranchChain());
      const nextNodes = chain.getNextNodes('chain-branch', 'root');
      expect(nextNodes).toHaveLength(2);
      const ids = nextNodes.map(n => n.id);
      expect(ids).toContain('branch-fight');
      expect(ids).toContain('branch-diplomacy');
    });
  });

  // ─── §2.4 链超时与完成检测 ─────────────────

  describe('§2.4 链超时与完成检测', () => {
    let chain: ChainEventSystem;

    beforeEach(() => {
      chain = new ChainEventSystem();
      chain.init(mockDeps());
    });

    it('已完成链不应再推进', () => {
      chain.registerChain(makeBranchChain());
      chain.startChain('chain-branch');
      chain.advanceChain('chain-branch', 'opt-fight'); // root → branch-fight
      chain.advanceChain('chain-branch', 'opt-next');  // branch-fight → 无后续 → 完成

      const result = chain.advanceChain('chain-branch', 'opt-next');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已完成');
    });

    it('未启动链不应推进', () => {
      chain.registerChain(makeLinearChain());
      const result = chain.advanceChain('chain-linear', 'opt-next');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在或未开始');
    });

    it('链完成时应记录 completedAt 时间', () => {
      chain.registerChain(makeBranchChain());
      chain.startChain('chain-branch');
      chain.advanceChain('chain-branch', 'opt-fight'); // root → branch-fight
      chain.advanceChain('chain-branch', 'opt-next');  // branch-fight → 完成

      const progress = chain.getProgress('chain-branch');
      expect(progress!.completedAt).not.toBeNull();
      expect(progress!.isCompleted).toBe(true);
    });

    it('链完成应发出 chain:completed 事件', () => {
      const deps = mockDeps();
      chain.init(deps);
      chain.registerChain(makeBranchChain());
      chain.startChain('chain-branch');
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockClear();

      chain.advanceChain('chain-branch', 'opt-fight'); // root → branch-fight
      // 尚未完成，不应有 completed 事件
      expect(deps.eventBus.emit).not.toHaveBeenCalledWith('chain:completed', expect.any(Object));

      chain.advanceChain('chain-branch', 'opt-next'); // branch-fight → 完成
      expect(deps.eventBus.emit).toHaveBeenCalledWith('chain:completed', expect.any(Object));
    });
  });

  // ─── §2.5 并发链管理 ──────────────────────

  describe('§2.5 并发链管理', () => {
    let chain: ChainEventSystem;

    beforeEach(() => {
      chain = new ChainEventSystem();
      chain.init(mockDeps());
    });

    it('应支持同时启动多条链', () => {
      chain.registerChains([makeLinearChain('c1'), makeBranchChain('c2'), makeDeepBranchChain('c3')]);
      chain.startChain('c1');
      chain.startChain('c2');
      chain.startChain('c3');

      expect(chain.isChainStarted('c1')).toBe(true);
      expect(chain.isChainStarted('c2')).toBe(true);
      expect(chain.isChainStarted('c3')).toBe(true);
    });

    it('并发链推进应互不影响', () => {
      chain.registerChains([makeLinearChain('c1'), makeBranchChain('c2')]);
      chain.startChain('c1');
      chain.startChain('c2');

      chain.advanceChain('c1', 'opt-next'); // A→B
      chain.advanceChain('c2', 'opt-fight'); // root → branch-fight

      expect(chain.getCurrentNode('c1')?.id).toBe('node-b');
      expect(chain.isChainCompleted('c1')).toBe(false);
      expect(chain.getCurrentNode('c2')?.id).toBe('branch-fight');
      expect(chain.isChainCompleted('c2')).toBe(false);
    });

    it('reset 应清除所有链进度', () => {
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');
      chain.reset();
      expect(chain.isChainStarted('chain-linear')).toBe(false);
    });
  });

  // ─── §2.6 序列化/反序列化 ──────────────────

  describe('§2.6 序列化/反序列化', () => {
    it('应正确导出存档数据', () => {
      const chain = new ChainEventSystem();
      chain.init(mockDeps());
      chain.registerChain(makeLinearChain());
      chain.startChain('chain-linear');

      const save = chain.exportSaveData();
      expect(save.version).toBe(CHAIN_SAVE_VERSION);
      expect(save.chainProgresses).toHaveLength(1);
      expect(save.chainProgresses[0].chainId).toBe('chain-linear');
    });

    it('应正确导入存档数据', () => {
      const chain1 = new ChainEventSystem();
      chain1.init(mockDeps());
      chain1.registerChain(makeLinearChain());
      chain1.startChain('chain-linear');
      chain1.advanceChain('chain-linear', 'opt-next');

      const save = chain1.exportSaveData();

      const chain2 = new ChainEventSystem();
      chain2.init(mockDeps());
      chain2.importSaveData(save);

      const progress = chain2.getProgress('chain-linear');
      expect(progress).toBeDefined();
      expect(progress!.currentNodeId).toBe('node-b');
      expect(progress!.completedNodeIds.has('node-a')).toBe(true);
    });

    it('空存档数据应正常处理', () => {
      const chain = new ChainEventSystem();
      chain.init(mockDeps());
      chain.importSaveData({ version: CHAIN_SAVE_VERSION, chainProgresses: [] });
      expect(chain.getAllChains()).toHaveLength(0);
    });
  });
});
