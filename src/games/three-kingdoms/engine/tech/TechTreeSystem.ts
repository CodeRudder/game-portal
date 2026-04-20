/**
 * 科技域 — 科技树系统（聚合根）
 *
 * 职责：节点状态管理、前置依赖检查、互斥分支机制、科技效果汇总
 * 规则：可引用 tech-config 和 tech.types，禁止引用其他域的 System
 *
 * @module engine/tech/TechTreeSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TechPath,
  TechNodeDef,
  TechNodeState,
  TechNodeStatus,
  TechEffect,
  TechEdge,
  TechState,
  TechSaveData,
} from './tech.types';
import { TECH_PATHS } from './tech.types';
import {
  TECH_NODE_DEFS,
  TECH_NODE_MAP,
  TECH_EDGES,
  TECH_SAVE_VERSION,
  getNodesByPath,
  getNodesByTier,
  getMutexGroups,
} from './tech-config';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建节点初始状态 */
function createNodeState(id: string): TechNodeState {
  return {
    id,
    status: 'locked',
    researchStartTime: null,
    researchEndTime: null,
  };
}

/** 创建所有节点的初始状态 */
function createAllNodeStates(): Record<string, TechNodeState> {
  const states: Record<string, TechNodeState> = {};
  for (const def of TECH_NODE_DEFS) {
    states[def.id] = createNodeState(def.id);
  }
  return states;
}

// ─────────────────────────────────────────────
// TechTreeSystem
// ─────────────────────────────────────────────

export class TechTreeSystem implements ISubsystem {
  readonly name = 'tech-tree' as const;
  private deps: ISystemDeps | null = null;

  /** 所有节点运行时状态 */
  private nodes: Record<string, TechNodeState>;
  /** 已选择的互斥节点映射 mutexGroup → nodeId */
  private chosenMutexNodes: Record<string, string>;

  constructor() {
    this.nodes = createAllNodeStates();
    this.chosenMutexNodes = {};
    this.refreshAllAvailability();
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 科技树本身不需要每帧更新，研究进度由 TechResearchSystem 管理
  }

  getState(): TechState {
    return {
      nodes: { ...this.nodes },
      researchQueue: [],
      techPoints: { current: 0, totalEarned: 0, totalSpent: 0 },
      chosenMutexNodes: { ...this.chosenMutexNodes },
    };
  }

  reset(): void {
    this.nodes = createAllNodeStates();
    this.chosenMutexNodes = {};
    this.refreshAllAvailability();
  }

  // ─────────────────────────────────────────
  // 节点查询
  // ─────────────────────────────────────────

  /** 获取节点定义 */
  getNodeDef(id: string): TechNodeDef | undefined {
    return TECH_NODE_MAP.get(id);
  }

  /** 获取节点运行时状态 */
  getNodeState(id: string): TechNodeState | undefined {
    return this.nodes[id];
  }

  /** 获取所有节点状态 */
  getAllNodeStates(): Record<string, TechNodeState> {
    return { ...this.nodes };
  }

  /** 获取指定路线的所有节点定义 */
  getPathNodes(path: TechPath): TechNodeDef[] {
    return getNodesByPath(path);
  }

  /** 获取指定路线指定层级的节点 */
  getTierNodes(path: TechPath, tier: number): TechNodeDef[] {
    return getNodesByTier(path, tier);
  }

  /** 获取所有连线 */
  getEdges(): TechEdge[] {
    return TECH_EDGES;
  }

  /** 获取所有节点定义 */
  getAllNodeDefs(): TechNodeDef[] {
    return TECH_NODE_DEFS;
  }

  // ─────────────────────────────────────────
  // 状态变更（供 TechResearchSystem 调用）
  // ─────────────────────────────────────────

  /** 将节点标记为研究中 */
  setResearching(id: string, startTime: number, endTime: number): void {
    const state = this.nodes[id];
    if (!state) return;
    state.status = 'researching';
    state.researchStartTime = startTime;
    state.researchEndTime = endTime;
  }

  /** 将节点标记为已完成，并处理互斥锁定 */
  completeNode(id: string): void {
    const state = this.nodes[id];
    const def = TECH_NODE_MAP.get(id);
    if (!state || !def) return;

    state.status = 'completed';
    state.researchStartTime = null;
    state.researchEndTime = null;

    // 处理互斥组：记录选择，锁定同组其他节点
    if (def.mutexGroup) {
      this.chosenMutexNodes[def.mutexGroup] = id;
      this.lockMutexAlternatives(def.mutexGroup, id);
    }

    // 刷新所有节点可用性
    this.refreshAllAvailability();

    // 发出事件
    this.deps?.eventBus.emit('economy:techCompleted', {
      techId: id,
      techName: def.name,
      bonuses: this.collectEffectsMap(id),
    });
  }

  /** 取消研究（将节点恢复为 available） */
  cancelResearch(id: string): void {
    const state = this.nodes[id];
    if (!state || state.status !== 'researching') return;
    state.status = 'available';
    state.researchStartTime = null;
    state.researchEndTime = null;
  }

  // ─────────────────────────────────────────
  // 前置依赖检查
  // ─────────────────────────────────────────

  /** 检查节点的前置依赖是否全部满足 */
  arePrerequisitesMet(id: string): boolean {
    const def = TECH_NODE_MAP.get(id);
    if (!def) return false;
    return def.prerequisites.every((preId) => {
      const state = this.nodes[preId];
      return state?.status === 'completed';
    });
  }

  /** 获取未满足的前置依赖列表 */
  getUnmetPrerequisites(id: string): string[] {
    const def = TECH_NODE_MAP.get(id);
    if (!def) return [];
    return def.prerequisites.filter((preId) => {
      const state = this.nodes[preId];
      return state?.status !== 'completed';
    });
  }

  // ─────────────────────────────────────────
  // 互斥分支
  // ─────────────────────────────────────────

  /** 检查节点是否被互斥锁定 */
  isMutexLocked(id: string): boolean {
    const def = TECH_NODE_MAP.get(id);
    if (!def || !def.mutexGroup) return false;
    const chosen = this.chosenMutexNodes[def.mutexGroup];
    // 如果同组已选了其他节点，则被锁定
    return !!chosen && chosen !== id;
  }

  /** 获取节点的互斥替代节点 ID */
  getMutexAlternatives(id: string): string[] {
    const def = TECH_NODE_MAP.get(id);
    if (!def || !def.mutexGroup) return [];
    const groups = getMutexGroups();
    const members = groups.get(def.mutexGroup) ?? [];
    return members.filter((m) => m !== id);
  }

  /** 获取已选择的互斥节点映射 */
  getChosenMutexNodes(): Record<string, string> {
    return { ...this.chosenMutexNodes };
  }

  // ─────────────────────────────────────────
  // 可用性检查
  // ─────────────────────────────────────────

  /** 检查节点是否可以开始研究 */
  canResearch(id: string): { can: boolean; reason?: string } {
    const state = this.nodes[id];
    const def = TECH_NODE_MAP.get(id);

    if (!state || !def) {
      return { can: false, reason: '科技节点不存在' };
    }

    if (state.status === 'completed') {
      return { can: false, reason: '科技已完成' };
    }

    if (state.status === 'researching') {
      return { can: false, reason: '科技正在研究中' };
    }

    if (this.isMutexLocked(id)) {
      return { can: false, reason: '互斥分支已选择其他节点' };
    }

    if (!this.arePrerequisitesMet(id)) {
      return { can: false, reason: '前置科技未完成' };
    }

    return { can: true };
  }

  // ─────────────────────────────────────────
  // 效果汇总
  // ─────────────────────────────────────────

  /** 获取所有已完成科技的效果列表 */
  getAllCompletedEffects(): TechEffect[] {
    const effects: TechEffect[] = [];
    for (const def of TECH_NODE_DEFS) {
      if (this.nodes[def.id]?.status === 'completed') {
        effects.push(...def.effects);
      }
    }
    return effects;
  }

  /** 获取指定效果类型的汇总值（同类叠加） */
  getEffectValue(effectType: string, target: string): number {
    let total = 0;
    for (const def of TECH_NODE_DEFS) {
      if (this.nodes[def.id]?.status !== 'completed') continue;
      for (const eff of def.effects) {
        if (eff.type === effectType && (eff.target === target || eff.target === 'all')) {
          total += eff.value;
        }
      }
    }
    return total;
  }

  /** 获取科技加成百分比（用于资源系统加成框架） */
  getTechBonusMultiplier(): number {
    // 汇总所有 target='all' 的资源产出加成
    const bonus = this.getEffectValue('resource_production', 'all');
    return bonus / 100;
  }

  // ─────────────────────────────────────────
  // 路线统计
  // ─────────────────────────────────────────

  /** 获取指定路线的完成进度 */
  getPathProgress(path: TechPath): { completed: number; total: number } {
    const nodes = getNodesByPath(path);
    const completed = nodes.filter((n) => this.nodes[n.id]?.status === 'completed').length;
    return { completed, total: nodes.length };
  }

  /** 获取三条路线的完成进度 */
  getAllPathProgress(): Record<TechPath, { completed: number; total: number }> {
    const result = {} as Record<TechPath, { completed: number; total: number }>;
    for (const path of TECH_PATHS) {
      result[path] = this.getPathProgress(path);
    }
    return result;
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 序列化 */
  serialize(): Pick<TechSaveData, 'completedTechIds' | 'chosenMutexNodes'> {
    const completedTechIds: string[] = [];
    for (const def of TECH_NODE_DEFS) {
      if (this.nodes[def.id]?.status === 'completed') {
        completedTechIds.push(def.id);
      }
    }
    return {
      completedTechIds,
      chosenMutexNodes: { ...this.chosenMutexNodes },
    };
  }

  /** 反序列化 */
  deserialize(data: Pick<TechSaveData, 'completedTechIds' | 'chosenMutexNodes'>): void {
    this.nodes = createAllNodeStates();
    this.chosenMutexNodes = {};

    // 恢复已完成节点
    const completedSet = new Set(data.completedTechIds);
    for (const id of completedSet) {
      if (this.nodes[id]) {
        this.nodes[id].status = 'completed';
      }
    }

    // 恢复互斥选择
    if (data.chosenMutexNodes) {
      this.chosenMutexNodes = { ...data.chosenMutexNodes };
    }

    // 刷新可用性
    this.refreshAllAvailability();
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 锁定互斥组中除 chosenId 外的其他节点 */
  private lockMutexAlternatives(mutexGroup: string, chosenId: string): void {
    const groups = getMutexGroups();
    const members = groups.get(mutexGroup) ?? [];
    for (const memberId of members) {
      if (memberId !== chosenId && this.nodes[memberId]) {
        const memberState = this.nodes[memberId];
        // 只有 locked 或 available 状态的节点才锁定
        if (memberState.status === 'locked' || memberState.status === 'available') {
          memberState.status = 'locked';
        }
      }
    }
  }

  /** 刷新所有节点的可用状态 */
  private refreshAllAvailability(): void {
    for (const def of TECH_NODE_DEFS) {
      const state = this.nodes[def.id];
      if (!state) continue;

      // 已完成或研究中不改变
      if (state.status === 'completed' || state.status === 'researching') continue;

      // 检查互斥锁定
      if (this.isMutexLocked(def.id)) {
        state.status = 'locked';
        continue;
      }

      // 检查前置依赖
      if (this.arePrerequisitesMet(def.id)) {
        state.status = 'available';
      } else {
        state.status = 'locked';
      }
    }
  }

  /** 收集单个科技的效果映射（用于事件） */
  private collectEffectsMap(id: string): Record<string, number> {
    const def = TECH_NODE_MAP.get(id);
    if (!def) return {};
    const map: Record<string, number> = {};
    for (const eff of def.effects) {
      const key = `${eff.type}:${eff.target}`;
      map[key] = (map[key] ?? 0) + eff.value;
    }
    return map;
  }
}
