/**
 * 科技域 — 融合科技系统
 *
 * 职责：
 * - 跨路线组合解锁高级科技
 * - 当玩家在两条路线各完成指定节点后，触发融合科技解锁
 * - 融合科技的研究流程与普通科技相同
 * - 融合科技效果汇总与查询
 *
 * 依赖：TechTreeSystem（查询已完成节点状态）
 *
 * @module engine/tech/FusionTechSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TechEffect,
  FusionTechDef,
  FusionTechState,
  FusionTechStatus,
  FusionPrerequisite,
  FusionTechSystemState,
  FusionTechSaveData,
  PrerequisiteCheckResult,
  PathGroupCheckResult,
  FusionLinkEffect,
} from './fusion-tech.types';
import { FUSION_TECH_DEFS, FUSION_TECH_MAP } from './fusion-tech.types';
import type { TechTreeSystem } from './TechTreeSystem';
import type { TechLinkSystem } from './TechLinkSystem';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建融合科技节点初始状态 */
function createFusionNodeState(id: string): FusionTechState {
  return {
    id,
    status: 'locked',
    researchStartTime: null,
    researchEndTime: null,
  };
}

/** 创建所有融合科技节点的初始状态 */
function createAllFusionNodeStates(): Record<string, FusionTechState> {
  const states: Record<string, FusionTechState> = {};
  for (const def of FUSION_TECH_DEFS) {
    states[def.id] = createFusionNodeState(def.id);
  }
  return states;
}

// ─────────────────────────────────────────────
// FusionTechSystem
// ─────────────────────────────────────────────

export class FusionTechSystem implements ISubsystem {
  readonly name = 'fusion-tech' as const;
  private deps: ISystemDeps | null = null;

  /** 所有融合科技节点运行时状态 */
  private nodes: Record<string, FusionTechState>;
  /** 依赖的科技树系统 */
  private techTree: TechTreeSystem | null = null;
  /** 依赖的联动系统（v5.0） */
  private linkSystem: TechLinkSystem | null = null;
  /** 融合科技联动效果（v5.0） */
  private fusionLinks: Map<string, FusionLinkEffect>;

  constructor() {
    this.nodes = createAllFusionNodeStates();
    this.fusionLinks = new Map();
    this.registerDefaultFusionLinks();
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 融合科技不需要每帧更新，研究进度由 TechResearchSystem 管理
  }

  getState(): FusionTechSystemState {
    return {
      nodes: { ...this.nodes },
    };
  }

  reset(): void {
    this.nodes = createAllFusionNodeStates();
  }

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入科技树系统引用 */
  setTechTree(techTree: TechTreeSystem): void {
    this.techTree = techTree;
    this.refreshAllAvailability();
  }

  /** 注入联动系统引用（v5.0） */
  setLinkSystem(linkSystem: TechLinkSystem): void {
    this.linkSystem = linkSystem;
  }

  // ─────────────────────────────────────────
  // 融合科技联动效果（v5.0）
  // ─────────────────────────────────────────

  /** 注册默认融合科技联动效果 */
  private registerDefaultFusionLinks(): void {
    const defaultLinks: FusionLinkEffect[] = [
      // ── 兵精粮足 → 建筑/资源联动 ──
      { id: 'fl_mil_eco_1_barracks', fusionTechId: 'fusion_mil_eco_1', target: 'building', targetSub: 'barracks', description: '兵精粮足：兵营训练速度+10%', value: 10 },
      { id: 'fl_mil_eco_1_grain', fusionTechId: 'fusion_mil_eco_1', target: 'resource', targetSub: 'grain', description: '兵精粮足：粮草产出+15%', value: 15 },
      // ── 铁骑商路 → 建筑/资源联动 ──
      { id: 'fl_mil_eco_2_stable', fusionTechId: 'fusion_mil_eco_2', target: 'building', targetSub: 'stable', description: '铁骑商路：马厩产出+20%', value: 20, unlockFeature: true, unlockDescription: '解锁精锐骑兵训练' },
      { id: 'fl_mil_eco_2_gold', fusionTechId: 'fusion_mil_eco_2', target: 'resource', targetSub: 'gold', description: '铁骑商路：铜钱产出+20%', value: 20 },
      // ── 兵法大家 → 武将联动 ──
      { id: 'fl_mil_cul_1_hero', fusionTechId: 'fusion_mil_cul_1', target: 'hero', targetSub: 'all_skill_exp', description: '兵法大家：武将技能经验+20%', value: 20 },
      { id: 'fl_mil_cul_1_academy', fusionTechId: 'fusion_mil_cul_1', target: 'building', targetSub: 'academy', description: '兵法大家：书院研究速度+10%', value: 10 },
      // ── 名将传承 → 武将联动 ──
      { id: 'fl_mil_cul_2_hero', fusionTechId: 'fusion_mil_cul_2', target: 'hero', targetSub: 'infantry_command', description: '名将传承：步兵指挥+25%', value: 25, unlockSkill: true },
      { id: 'fl_mil_cul_2_research', fusionTechId: 'fusion_mil_cul_2', target: 'resource', targetSub: 'mandate', description: '名将传承：天命获取+15%', value: 15 },
      // ── 文景之治 → 资源联动 ──
      { id: 'fl_eco_cul_1_all_res', fusionTechId: 'fusion_eco_cul_1', target: 'resource', targetSub: 'grain', description: '文景之治：粮草产出+15%', value: 15 },
      { id: 'fl_eco_cul_1_hero_exp', fusionTechId: 'fusion_eco_cul_1', target: 'hero', targetSub: 'all_skill_exp', description: '文景之治：武将经验+15%', value: 15 },
      // ── 盛世华章 → 资源/武将联动 ──
      { id: 'fl_eco_cul_2_gold', fusionTechId: 'fusion_eco_cul_2', target: 'resource', targetSub: 'gold', description: '盛世华章：铜钱产出+25%', value: 25 },
      { id: 'fl_eco_cul_2_recruit', fusionTechId: 'fusion_eco_cul_2', target: 'hero', targetSub: 'recruit_quality', description: '盛世华章：招募折扣+15%', value: 15, unlockSkill: true },
    ];
    for (const link of defaultLinks) {
      this.fusionLinks.set(link.id, link);
    }
  }

  /** 获取融合科技的联动效果列表 */
  getFusionLinkEffects(fusionTechId: string): FusionLinkEffect[] {
    const result: FusionLinkEffect[] = [];
    for (const link of this.fusionLinks.values()) {
      if (link.fusionTechId === fusionTechId) {
        result.push(link);
      }
    }
    return result;
  }

  /** 获取所有已完成融合科技的联动效果 */
  getActiveFusionLinkEffects(): FusionLinkEffect[] {
    const result: FusionLinkEffect[] = [];
    for (const link of this.fusionLinks.values()) {
      if (this.nodes[link.fusionTechId]?.status === 'completed') {
        result.push(link);
      }
    }
    return result;
  }

  /** 获取已完成融合科技对指定目标的联动加成总值 */
  getFusionLinkBonus(target: 'building' | 'hero' | 'resource', targetSub: string): number {
    let total = 0;
    for (const link of this.fusionLinks.values()) {
      if (link.target !== target || link.targetSub !== targetSub) continue;
      if (this.nodes[link.fusionTechId]?.status !== 'completed') continue;
      total += link.value;
    }
    return total;
  }

  // ─────────────────────────────────────────
  // 节点查询
  // ─────────────────────────────────────────

  /** 获取融合科技定义 */
  getFusionDef(id: string): FusionTechDef | undefined {
    return FUSION_TECH_MAP.get(id);
  }

  /** 获取融合科技节点运行时状态 */
  getFusionState(id: string): FusionTechState | undefined {
    return this.nodes[id];
  }

  /** 获取所有融合科技节点状态 */
  getAllFusionStates(): Record<string, FusionTechState> {
    return { ...this.nodes };
  }

  /** 获取所有融合科技定义 */
  getAllFusionDefs(): FusionTechDef[] {
    return FUSION_TECH_DEFS;
  }

  /** 获取指定路线组合的融合科技 */
  getFusionsByPathPair(pathA: string, pathB: string): FusionTechDef[] {
    return FUSION_TECH_DEFS.filter(
      (def) =>
        (def.pathPair[0] === pathA && def.pathPair[1] === pathB) ||
        (def.pathPair[0] === pathB && def.pathPair[1] === pathA),
    );
  }

  // ─────────────────────────────────────────
  // 前置条件检查
  // ─────────────────────────────────────────

  /** 检查融合科技的前置条件是否满足 */
  arePrerequisitesMet(id: string): boolean {
    const def = FUSION_TECH_MAP.get(id);
    if (!def || !this.techTree) return false;

    const { pathA, pathB } = def.prerequisites;
    const stateA = this.techTree.getNodeState(pathA);
    const stateB = this.techTree.getNodeState(pathB);

    return stateA?.status === 'completed' && stateB?.status === 'completed';
  }

  /**
   * 详细检查融合科技的前置条件（v5.0 扩展）
   *
   * 返回每组前置条件的完成状态，便于 UI 展示详细的解锁进度。
   */
  checkPrerequisitesDetailed(id: string): PrerequisiteCheckResult {
    const def = FUSION_TECH_MAP.get(id);
    if (!def || !this.techTree) {
      return { met: false, groups: [] };
    }

    const { pathA, pathB } = def.prerequisites;
    const defA = this.techTree.getNodeDef(pathA);
    const defB = this.techTree.getNodeDef(pathB);
    const stateA = this.techTree.getNodeState(pathA);
    const stateB = this.techTree.getNodeState(pathB);

    const groupA: PathGroupCheckResult = {
      path: defA?.path ?? 'military',
      requiredNodes: [pathA],
      completedNodes: stateA?.status === 'completed' ? [pathA] : [],
      minCompleted: 1,
      actualCompleted: stateA?.status === 'completed' ? 1 : 0,
      met: stateA?.status === 'completed',
    };

    const groupB: PathGroupCheckResult = {
      path: defB?.path ?? 'economy',
      requiredNodes: [pathB],
      completedNodes: stateB?.status === 'completed' ? [pathB] : [],
      minCompleted: 1,
      actualCompleted: stateB?.status === 'completed' ? 1 : 0,
      met: stateB?.status === 'completed',
    };

    return {
      met: groupA.met && groupB.met,
      groups: [groupA, groupB],
    };
  }

  /**
   * 检查指定路线组合的所有融合科技解锁进度（v5.0 扩展）
   *
   * 返回两条路线各有多少融合科技已解锁/可研究/锁定。
   */
  getPathPairProgress(pathA: string, pathB: string): {
    total: number;
    available: number;
    completed: number;
    locked: number;
  } {
    const fusions = this.getFusionsByPathPair(pathA, pathB);
    let available = 0;
    let completed = 0;
    let locked = 0;

    for (const def of fusions) {
      const state = this.nodes[def.id];
      if (!state) continue;
      if (state.status === 'completed') completed++;
      else if (state.status === 'available' || state.status === 'researching') available++;
      else locked++;
    }

    return { total: fusions.length, available, completed, locked };
  }

  /** 获取未满足的前置条件描述 */
  getUnmetPrerequisites(id: string): { pathA: boolean; pathB: boolean } {
    const def = FUSION_TECH_MAP.get(id);
    if (!def || !this.techTree) {
      return { pathA: false, pathB: false };
    }

    const { pathA, pathB } = def.prerequisites;
    const stateA = this.techTree.getNodeState(pathA);
    const stateB = this.techTree.getNodeState(pathB);

    return {
      pathA: stateA?.status === 'completed',
      pathB: stateB?.status === 'completed',
    };
  }

  // ─────────────────────────────────────────
  // 状态变更
  // ─────────────────────────────────────────

  /** 将融合科技标记为研究中 */
  setResearching(id: string, startTime: number, endTime: number): void {
    const state = this.nodes[id];
    if (!state) return;
    state.status = 'researching';
    state.researchStartTime = startTime;
    state.researchEndTime = endTime;
  }

  /** 将融合科技标记为已完成 */
  completeFusionNode(id: string): void {
    const state = this.nodes[id];
    const def = FUSION_TECH_MAP.get(id);
    if (!state || !def) return;

    state.status = 'completed';
    state.researchStartTime = null;
    state.researchEndTime = null;

    // 同步联动效果到 TechLinkSystem（v5.0）
    this.syncFusionLinksToLinkSystem(id);

    // 发出事件
    this.deps?.eventBus.emit('economy:fusionTechCompleted', {
      techId: id,
      techName: def.name,
      effects: def.effects,
    });
  }

  /** 同步融合科技联动效果到联动系统 */
  private syncFusionLinksToLinkSystem(fusionTechId: string): void {
    if (!this.linkSystem) return;
    const links = this.getFusionLinkEffects(fusionTechId);
    for (const fl of links) {
      // 将融合科技联动注册为普通联动，techId 使用融合科技 ID
      this.linkSystem.registerLink({
        id: fl.id,
        techId: fl.fusionTechId,
        target: fl.target,
        targetSub: fl.targetSub,
        description: fl.description,
        value: fl.value,
        unlockFeature: fl.unlockFeature,
        unlockDescription: fl.unlockDescription,
        unlockSkill: (fl as any).unlockSkill,
        newSkillDescription: (fl as any).newSkillDescription,
      });
      // 标记融合科技为已完成，使联动生效
      this.linkSystem.addCompletedTech(fl.fusionTechId);
    }
  }

  /** 取消研究 */
  cancelResearch(id: string): void {
    const state = this.nodes[id];
    if (!state || state.status !== 'researching') return;
    state.status = 'available';
    state.researchStartTime = null;
    state.researchEndTime = null;
  }

  // ─────────────────────────────────────────
  // 可用性检查
  // ─────────────────────────────────────────

  /** 检查融合科技是否可以开始研究 */
  canResearch(id: string): { can: boolean; reason?: string } {
    const state = this.nodes[id];
    const def = FUSION_TECH_MAP.get(id);

    if (!state || !def) {
      return { can: false, reason: '融合科技节点不存在' };
    }

    if (state.status === 'completed') {
      return { can: false, reason: '融合科技已完成' };
    }

    if (state.status === 'researching') {
      return { can: false, reason: '融合科技正在研究中' };
    }

    if (!this.arePrerequisitesMet(id)) {
      return { can: false, reason: '前置科技未完成（需两条路线各完成指定节点）' };
    }

    return { can: true };
  }

  // ─────────────────────────────────────────
  // 效果汇总
  // ─────────────────────────────────────────

  /** 获取所有已完成融合科技的效果列表 */
  getAllCompletedEffects(): TechEffect[] {
    const effects: TechEffect[] = [];
    for (const def of FUSION_TECH_DEFS) {
      if (this.nodes[def.id]?.status === 'completed') {
        effects.push(...def.effects);
      }
    }
    return effects;
  }

  /** 获取指定效果类型的汇总值 */
  getEffectValue(effectType: string, target: string): number {
    let total = 0;
    for (const def of FUSION_TECH_DEFS) {
      if (this.nodes[def.id]?.status !== 'completed') continue;
      for (const eff of def.effects) {
        if (eff.type === effectType && (eff.target === target || eff.target === 'all')) {
          total += eff.value;
        }
      }
    }
    return total;
  }

  // ─────────────────────────────────────────
  // 刷新可用性
  // ─────────────────────────────────────────

  /** 刷新所有融合科技节点的可用状态（科技完成时调用） */
  refreshAllAvailability(): void {
    for (const def of FUSION_TECH_DEFS) {
      const state = this.nodes[def.id];
      if (!state) continue;

      // 已完成或研究中不改变
      if (state.status === 'completed' || state.status === 'researching') continue;

      // 检查前置条件
      if (this.arePrerequisitesMet(def.id)) {
        state.status = 'available';
      } else {
        state.status = 'locked';
      }
    }
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 序列化 */
  serialize(): FusionTechSaveData {
    const completedFusionIds: string[] = [];
    for (const def of FUSION_TECH_DEFS) {
      if (this.nodes[def.id]?.status === 'completed') {
        completedFusionIds.push(def.id);
      }
    }
    return {
      version: 1,
      completedFusionIds,
    };
  }

  /** 反序列化 */
  deserialize(data: FusionTechSaveData): void {
    this.nodes = createAllFusionNodeStates();

    const completedSet = new Set(data.completedFusionIds);
    for (const id of completedSet) {
      if (this.nodes[id]) {
        this.nodes[id].status = 'completed';
      }
    }

    this.refreshAllAvailability();
  }
}
