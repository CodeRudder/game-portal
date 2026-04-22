/**
 * TechTree 渲染数据测试
 *
 * 覆盖：科技树渲染所需的数据完整性、节点连线关系、
 * 路线颜色/图标、节点状态转换、层级结构、互斥分支渲染数据
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import type { TechPath, TechNodeDef, TechEdge } from '../tech.types';
import { TECH_PATHS, TECH_PATH_LABELS, TECH_PATH_COLORS, TECH_PATH_ICONS } from '../tech.types';
import { TECH_NODE_DEFS, TECH_NODE_MAP, TECH_EDGES, getNodesByPath, getNodesByTier, getMutexGroups } from '../tech-config';
import type { ISystemDeps } from '../../../../core/types';

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

describe('TechTree 渲染数据测试', () => {
  let sys: TechTreeSystem;

  beforeEach(() => {
    sys = new TechTreeSystem();
    sys.init(mockDeps());
  });

  // ── 路线渲染数据 ──

  it('三条路线都有标签、颜色和图标', () => {
    for (const path of TECH_PATHS) {
      expect(TECH_PATH_LABELS[path]).toBeTruthy();
      expect(TECH_PATH_COLORS[path]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(TECH_PATH_ICONS[path]).toBeTruthy();
    }
  });

  it('每条路线至少有3个层级的节点', () => {
    for (const path of TECH_PATHS) {
      const nodes = getNodesByPath(path);
      const tiers = new Set(nodes.map((n) => n.tier));
      expect(tiers.size).toBeGreaterThanOrEqual(3);
    }
  });

  // ── 节点定义完整性 ──

  it('所有节点定义都有渲染所需的字段', () => {
    for (const def of TECH_NODE_DEFS) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.path).toBeTruthy();
      expect(typeof def.tier).toBe('number');
      expect(def.tier).toBeGreaterThanOrEqual(1);
      expect(TECH_PATHS).toContain(def.path);
    }
  });

  it('所有节点 ID 唯一', () => {
    const ids = TECH_NODE_DEFS.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('TECH_NODE_MAP 与 TECH_NODE_DEFS 一致', () => {
    expect(TECH_NODE_MAP.size).toBe(TECH_NODE_DEFS.length);
    for (const def of TECH_NODE_DEFS) {
      expect(TECH_NODE_MAP.has(def.id)).toBe(true);
      expect(TECH_NODE_MAP.get(def.id)?.id).toBe(def.id);
    }
  });

  // ── 连线数据 ──

  it('连线引用的节点都存在', () => {
    for (const edge of TECH_EDGES) {
      expect(TECH_NODE_MAP.has(edge.from)).toBe(true);
      expect(TECH_NODE_MAP.has(edge.to)).toBe(true);
    }
  });

  it('连线方向从低层级到高层级', () => {
    for (const edge of TECH_EDGES) {
      const fromDef = TECH_NODE_MAP.get(edge.from);
      const toDef = TECH_NODE_MAP.get(edge.to);
      expect(fromDef).toBeTruthy();
      expect(toDef).toBeTruthy();
      expect(toDef!.tier).toBeGreaterThanOrEqual(fromDef!.tier);
    }
  });

  it('每条路线内部连线是连通的', () => {
    for (const path of TECH_PATHS) {
      const pathNodes = getNodesByPath(path);
      const pathNodeIds = new Set(pathNodes.map((n) => n.id));
      const pathEdges = TECH_EDGES.filter(
        (e) => pathNodeIds.has(e.from) && pathNodeIds.has(e.to),
      );

      // 至少有一些连线
      expect(pathEdges.length).toBeGreaterThan(0);

      // 所有非 Tier1 节点都应有入边
      const nodesWithIncoming = new Set(pathEdges.map((e) => e.to));
      for (const node of pathNodes) {
        if (node.tier > 1) {
          expect(nodesWithIncoming.has(node.id)).toBe(true);
        }
      }
    }
  });

  // ── 层级结构 ──

  it('每条路线的节点按 tier 分层', () => {
    for (const path of TECH_PATHS) {
      const nodes = getNodesByPath(path);
      const tiers = [...new Set(nodes.map((n) => n.tier))].sort((a, b) => a - b);
      // 层级从1开始连续
      for (let i = 0; i < tiers.length; i++) {
        expect(tiers[i]).toBe(i + 1);
      }
    }
  });

  it('getTierNodes 返回指定路线指定层级的节点', () => {
    for (const path of TECH_PATHS) {
      const tier1 = getNodesByTier(path, 1);
      expect(tier1.length).toBeGreaterThan(0);
      for (const node of tier1) {
        expect(node.path).toBe(path);
        expect(node.tier).toBe(1);
      }
    }
  });

  // ── 互斥分支渲染数据 ──

  it('互斥组都有两个以上成员', () => {
    const groups = getMutexGroups();
    for (const [groupId, members] of groups) {
      expect(members.length).toBeGreaterThanOrEqual(2);
      // 所有成员属于同一路线和层级
      const paths = new Set(members.map((m) => TECH_NODE_MAP.get(m)?.path));
      const tiers = new Set(members.map((m) => TECH_NODE_MAP.get(m)?.tier));
      expect(paths.size).toBe(1);
      expect(tiers.size).toBe(1);
    }
  });

  // ── 节点状态转换渲染 ──

  it('初始状态所有节点为 locked 或 available', () => {
    const states = sys.getAllNodeStates();
    for (const [id, state] of Object.entries(states)) {
      expect(['locked', 'available']).toContain(state.status);
    }
  });

  it('Tier1 无前置依赖的节点初始为 available', () => {
    const states = sys.getAllNodeStates();
    for (const def of TECH_NODE_DEFS) {
      if (def.tier === 1 && def.prerequisites.length === 0) {
        expect(states[def.id]?.status).toBe('available');
      }
    }
  });

  it('completeNode 后节点状态变为 completed', () => {
    // 找一个 available 的 Tier1 节点
    const states = sys.getAllNodeStates();
    const availableNode = TECH_NODE_DEFS.find(
      (d) => states[d.id]?.status === 'available',
    );
    expect(availableNode).toBeTruthy();

    sys.completeNode(availableNode!.id);
    expect(sys.getNodeState(availableNode!.id)?.status).toBe('completed');
  });

  it('完成前置节点后后续节点变为 available', () => {
    // 找一条连线
    const edge = TECH_EDGES[0];
    const fromDef = TECH_NODE_MAP.get(edge.from)!;
    const toDef = TECH_NODE_MAP.get(edge.to)!;

    // 确保前置节点可完成
    const fromState = sys.getNodeState(edge.from);
    if (fromState?.status === 'available') {
      sys.completeNode(edge.from);
      const toState = sys.getNodeState(edge.to);
      expect(['available', 'completed']).toContain(toState?.status);
    }
  });

  // ── 效果数据 ──

  it('节点效果定义完整', () => {
    for (const def of TECH_NODE_DEFS) {
      expect(def.effects.length).toBeGreaterThan(0);
      for (const eff of def.effects) {
        expect(eff.type).toBeTruthy();
        expect(typeof eff.value).toBe('number');
      }
    }
  });

  it('getAllCompletedEffects 初始为空', () => {
    const effects = sys.getAllCompletedEffects();
    expect(effects).toHaveLength(0);
  });

  it('完成节点后 getAllCompletedEffects 返回该节点效果', () => {
    const states = sys.getAllNodeStates();
    const availableNode = TECH_NODE_DEFS.find(
      (d) => states[d.id]?.status === 'available',
    );
    expect(availableNode).toBeTruthy();

    sys.completeNode(availableNode!.id);
    const effects = sys.getAllCompletedEffects();
    expect(effects.length).toBeGreaterThanOrEqual(availableNode!.effects.length);
  });

  // ── 路线进度 ──

  it('getAllPathProgress 初始时 completed 为 0', () => {
    const progress = sys.getAllPathProgress();
    for (const path of TECH_PATHS) {
      expect(progress[path].completed).toBe(0);
      expect(progress[path].total).toBeGreaterThan(0);
    }
  });

  // ── 序列化/反序列化 ──

  it('序列化后反序列化恢复状态', () => {
    const states = sys.getAllNodeStates();
    const availableNode = TECH_NODE_DEFS.find(
      (d) => states[d.id]?.status === 'available',
    );
    if (availableNode) sys.completeNode(availableNode.id);

    const data = sys.serialize();
    const newSys = new TechTreeSystem();
    newSys.init(mockDeps());
    newSys.deserialize(data);

    if (availableNode) {
      expect(newSys.getNodeState(availableNode.id)?.status).toBe('completed');
    }
  });
});
