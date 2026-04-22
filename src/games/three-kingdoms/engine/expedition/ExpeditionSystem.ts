/**
 * 远征系统 — 引擎层
 *
 * 职责：路线管理、节点状态推进、队伍调度、队列槽位、路线解锁
 * 队伍编成逻辑委托给 ExpeditionTeamHelper。
 *
 * @module engine/expedition/ExpeditionSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ExpeditionRoute,
  ExpeditionRegion,
  ExpeditionTeam,
  ExpeditionState,
  ExpeditionSaveData,
  FormationType,
} from '../../core/expedition/expedition.types';
import {
  NodeStatus,
  NodeType,
  RouteDifficulty,
  CASTLE_LEVEL_SLOTS,
  TROOP_COST,
  SweepType,
  MilestoneType,
} from '../../core/expedition/expedition.types';
import {
  createDefaultRegions,
  createDefaultRoutes,
} from './expedition-config';
import {
  ExpeditionTeamHelper,
  type HeroBrief,
  type TeamValidationResult,
} from './ExpeditionTeamHelper';

// 重导出辅助类型，保持向后兼容
export type { HeroBrief, TeamValidationResult } from './ExpeditionTeamHelper';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 路线解锁校验结果 */
export interface UnlockCheckResult {
  canUnlock: boolean;
  reasons: string[];
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 创建默认远征状态 */
export function createDefaultExpeditionState(basePower: number = 1000): ExpeditionState {
  return {
    routes: createDefaultRoutes(basePower),
    regions: createDefaultRegions(),
    teams: {},
    unlockedSlots: 1,
    clearedRouteIds: new Set<string>(),
    routeStars: {},
    sweepCounts: {},
    achievedMilestones: new Set<MilestoneType>(),
    autoConfig: {
      repeatCount: 0,
      failureAction: 'pause',
      bagFullAction: 'pause',
      lowTroopAction: 'pause',
    },
    consecutiveFailures: 0,
    isAutoExpeditioning: false,
  };
}

// ─────────────────────────────────────────────
// ExpeditionSystem 类
// ─────────────────────────────────────────────

export class ExpeditionSystem implements ISubsystem {
  // ─── ISubsystem 接口 ───────────────────────

  readonly name = 'expedition' as const;
  private deps: ISystemDeps | null = null;

  // ─── 内部状态 ─────────────────────────────

  private state: ExpeditionState;

  constructor(initialState?: ExpeditionState) {
    this.state = initialState ?? createDefaultExpeditionState();
  }

  // ─── ISubsystem 适配层 ─────────────────────

  /** 注入依赖（事件总线、配置注册表等） */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** ISubsystem.update — 远征系统由事件驱动，无需帧更新 */
  update(_dt: number): void {
    // 远征系统由事件驱动，无需帧更新
  }

  /** ISubsystem.reset — 重置远征状态到初始值 */
  reset(): void {
    this.state = createDefaultExpeditionState();
  }

  // ─── 状态访问 ─────────────────────────────

  getState(): ExpeditionState { return this.state; }
  getRoute(routeId: string): ExpeditionRoute | undefined { return this.state.routes[routeId]; }
  getRegion(regionId: string): ExpeditionRegion | undefined { return this.state.regions[regionId]; }
  getTeam(teamId: string): ExpeditionTeam | undefined { return this.state.teams[teamId]; }
  getAllRoutes(): ExpeditionRoute[] { return Object.values(this.state.routes); }
  getAllTeams(): ExpeditionTeam[] { return Object.values(this.state.teams); }
  getClearedRouteIds(): Set<string> { return this.state.clearedRouteIds; }
  getRouteStars(routeId: string): number { return this.state.routeStars[routeId] ?? 0; }

  // ─── 队列槽位 ─────────────────────────────

  /** 根据主城等级更新队伍槽位 */
  updateSlots(castleLevel: number): number {
    const slots = this.getSlotCount(castleLevel);
    this.state.unlockedSlots = slots;
    return slots;
  }

  /** 获取主城等级对应的队伍数量 */
  getSlotCount(castleLevel: number): number {
    const levels = Object.keys(CASTLE_LEVEL_SLOTS).map(Number).sort((a, b) => b - a);
    for (const lvl of levels) {
      if (castleLevel >= lvl) return CASTLE_LEVEL_SLOTS[lvl];
    }
    return 0;
  }

  getUnlockedSlots(): number { return this.state.unlockedSlots; }

  // ─── 路线解锁 ─────────────────────────────

  canUnlockRoute(routeId: string): UnlockCheckResult {
    const route = this.state.routes[routeId];
    if (!route) return { canUnlock: false, reasons: ['路线不存在'] };
    if (route.unlocked) return { canUnlock: true, reasons: [] };

    const reasons: string[] = [];
    if (route.requiredRegionId) {
      const regionRoutes = this.state.regions[route.requiredRegionId]?.routeIds ?? [];
      const regionCleared = regionRoutes.every(rid => this.state.clearedRouteIds.has(rid));
      if (!regionCleared) reasons.push('需要先通关前置区域的所有路线');
    }
    if (route.requireHardClear) {
      const hardRoutes = this.getAllRoutes().filter(
        r => r.regionId === route.regionId && r.difficulty === RouteDifficulty.HARD
      );
      const hardCleared = hardRoutes.some(r => this.state.clearedRouteIds.has(r.id));
      if (!hardCleared) reasons.push('需要先通关同区域的困难路线');
    }

    return { canUnlock: reasons.length === 0, reasons };
  }

  unlockRoute(routeId: string): boolean {
    const check = this.canUnlockRoute(routeId);
    if (!check.canUnlock) return false;
    const route = this.state.routes[routeId];
    if (route) {
      route.unlocked = true;
      const startNode = route.nodes[route.startNodeId];
      if (startNode && startNode.status === NodeStatus.LOCKED) {
        startNode.status = NodeStatus.MARCHING;
      }
    }
    return true;
  }

  // ─── 队伍编成（委托给 ExpeditionTeamHelper） ──

  createTeam(
    name: string,
    heroIds: string[],
    formation: FormationType,
    heroDataMap: Record<string, HeroBrief>,
  ): TeamValidationResult {
    const activeTeams = Object.values(this.state.teams).filter(t => t.isExpeditioning);
    const validation = ExpeditionTeamHelper.validateTeam(heroIds, formation, heroDataMap, activeTeams);
    if (!validation.valid) return validation;

    const totalPower = ExpeditionTeamHelper.calculateTeamPower(heroIds, heroDataMap, formation);
    const troopCost = ExpeditionTeamHelper.calculateTroopCost(heroIds.length);

    const team: ExpeditionTeam = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name, heroIds, formation,
      troopCount: troopCost,
      maxTroops: heroIds.length * 100,
      totalPower,
      currentRouteId: null, currentNodeId: null,
      isExpeditioning: false,
    };
    this.state.teams[team.id] = team;
    return { ...validation, totalPower };
  }

  validateTeam(heroIds: string[], formation: FormationType, heroDataMap: Record<string, HeroBrief>, activeTeams: ExpeditionTeam[]): TeamValidationResult {
    return ExpeditionTeamHelper.validateTeam(heroIds, formation, heroDataMap, activeTeams);
  }

  checkFactionBond(heroIds: string[], heroDataMap: Record<string, HeroBrief>): boolean {
    return ExpeditionTeamHelper.checkFactionBond(heroIds, heroDataMap);
  }

  calculateTeamPower(heroIds: string[], heroDataMap: Record<string, HeroBrief>, formation: FormationType): number {
    return ExpeditionTeamHelper.calculateTeamPower(heroIds, heroDataMap, formation);
  }

  autoComposeTeam(availableHeroes: HeroBrief[], activeHeroIds: Set<string>, formation: FormationType, maxHeroes?: number): string[] {
    return ExpeditionTeamHelper.autoComposeTeam(availableHeroes, activeHeroIds, formation, maxHeroes);
  }

  // ─── 远征推进 ─────────────────────────────

  dispatchTeam(teamId: string, routeId: string): boolean {
    const team = this.state.teams[teamId];
    const route = this.state.routes[routeId];
    if (!team || !route || !route.unlocked) return false;

    const expeditioningCount = Object.values(this.state.teams).filter(t => t.isExpeditioning).length;
    if (expeditioningCount >= this.state.unlockedSlots) return false;

    const requiredTroops = team.heroIds.length * TROOP_COST.expeditionPerHero;
    if (team.troopCount < requiredTroops) return false;

    team.troopCount -= requiredTroops;
    team.currentRouteId = routeId;
    team.currentNodeId = route.startNodeId;
    team.isExpeditioning = true;

    const startNode = route.nodes[route.startNodeId];
    if (startNode && startNode.status === NodeStatus.LOCKED) {
      startNode.status = NodeStatus.MARCHING;
    }
    return true;
  }

  advanceToNextNode(teamId: string, branchIndex: number = 0): string | null {
    const team = this.state.teams[teamId];
    if (!team || !team.isExpeditioning || !team.currentRouteId || !team.currentNodeId) return null;

    const route = this.state.routes[team.currentRouteId];
    if (!route) return null;

    const currentNode = route.nodes[team.currentNodeId];
    if (!currentNode || currentNode.nextNodeIds.length === 0) return null;

    currentNode.status = NodeStatus.CLEARED;
    const nextNodeId = currentNode.nextNodeIds[branchIndex] ?? currentNode.nextNodeIds[0];
    const nextNode = route.nodes[nextNodeId];
    if (nextNode) {
      nextNode.status = NodeStatus.MARCHING;
      team.currentNodeId = nextNodeId;
      return nextNodeId;
    }
    return null;
  }

  processNodeEffect(teamId: string): { healed: boolean; healAmount: number } {
    const team = this.state.teams[teamId];
    if (!team || !team.currentRouteId || !team.currentNodeId) return { healed: false, healAmount: 0 };

    const route = this.state.routes[team.currentRouteId];
    const node = route?.nodes[team.currentNodeId];
    if (!node || node.type !== NodeType.REST) return { healed: false, healAmount: 0 };

    const healPercent = node.healPercent ?? 0.20;
    const healAmount = Math.round(team.maxTroops * healPercent);
    team.troopCount = Math.min(team.maxTroops, team.troopCount + healAmount);
    return { healed: true, healAmount };
  }

  completeRoute(teamId: string, stars: number): boolean {
    const team = this.state.teams[teamId];
    if (!team || !team.currentRouteId) return false;

    const routeId = team.currentRouteId;
    const route = this.state.routes[routeId];
    if (route && team.currentNodeId) {
      const endNode = route.nodes[team.currentNodeId];
      if (endNode) endNode.status = NodeStatus.CLEARED;
    }

    this.state.clearedRouteIds.add(routeId);
    const prevStars = this.state.routeStars[routeId] ?? 0;
    if (stars > prevStars) this.state.routeStars[routeId] = stars;

    team.currentRouteId = null;
    team.currentNodeId = null;
    team.isExpeditioning = false;
    team.troopCount = team.maxTroops;

    this.checkAndUnlockNewRoutes();
    return true;
  }

  private checkAndUnlockNewRoutes(): void {
    for (const routeId of Object.keys(this.state.routes)) {
      this.unlockRoute(routeId);
    }
  }

  // ─── 扫荡系统 ─────────────────────────────

  canSweepRoute(routeId: string): boolean { return (this.state.routeStars[routeId] ?? 0) >= 3; }

  getSweepCount(routeId: string, sweepType: SweepType): number {
    return this.state.sweepCounts[routeId]?.[sweepType] ?? 0;
  }

  executeSweep(routeId: string, sweepType: SweepType): { success: boolean; reason: string } {
    if (!this.canSweepRoute(routeId)) return { success: false, reason: '需要三星通关才能扫荡' };
    const config = this.getSweepConfig(sweepType);
    const currentCount = this.getSweepCount(routeId, sweepType);
    if (currentCount >= config.dailyLimit) return { success: false, reason: '今日扫荡次数已用完' };

    if (!this.state.sweepCounts[routeId]) {
      this.state.sweepCounts[routeId] = { [SweepType.NORMAL]: 0, [SweepType.ADVANCED]: 0, [SweepType.FREE]: 0 };
    }
    this.state.sweepCounts[routeId][sweepType] = currentCount + 1;
    return { success: true, reason: '' };
  }

  private getSweepConfig(sweepType: SweepType): { cost: number; rewardMultiplier: number; dailyLimit: number; guaranteedRare: boolean } {
    const configs: Record<SweepType, { cost: number; rewardMultiplier: number; dailyLimit: number; guaranteedRare: boolean }> = {
      [SweepType.NORMAL]: { cost: 1, rewardMultiplier: 1.0, dailyLimit: 5, guaranteedRare: false },
      [SweepType.ADVANCED]: { cost: 3, rewardMultiplier: 1.5, dailyLimit: 3, guaranteedRare: true },
      [SweepType.FREE]: { cost: 0, rewardMultiplier: 0.5, dailyLimit: 1, guaranteedRare: false },
    };
    return configs[sweepType];
  }

  // ─── 里程碑 ─────────────────────────────

  checkMilestones(): MilestoneType[] {
    const cleared = this.state.clearedRouteIds.size;
    const totalRoutes = Object.keys(this.state.routes).length;
    const newlyAchieved: MilestoneType[] = [];

    const checks: Array<{ type: MilestoneType; required: number }> = [
      { type: MilestoneType.FIRST_CLEAR, required: 1 },
      { type: MilestoneType.TEN_CLEARS, required: 10 },
      { type: MilestoneType.THIRTY_CLEARS, required: 30 },
    ];
    for (const check of checks) {
      if (cleared >= check.required && !this.state.achievedMilestones.has(check.type)) {
        this.state.achievedMilestones.add(check.type);
        newlyAchieved.push(check.type);
      }
    }
    if (cleared >= totalRoutes && totalRoutes > 0 && !this.state.achievedMilestones.has(MilestoneType.ALL_CLEARS)) {
      this.state.achievedMilestones.add(MilestoneType.ALL_CLEARS);
      newlyAchieved.push(MilestoneType.ALL_CLEARS);
    }
    return newlyAchieved;
  }

  // ─── 兵力恢复 ─────────────────────────────

  recoverTroops(elapsedSeconds: number): void {
    const recoveryCycles = Math.floor(elapsedSeconds / TROOP_COST.recoveryIntervalSeconds);
    const recoveryAmount = recoveryCycles * TROOP_COST.recoveryAmount;
    for (const team of Object.values(this.state.teams)) {
      team.troopCount = Math.min(team.maxTroops, team.troopCount + recoveryAmount);
    }
  }

  // ─── 序列化 ─────────────────────────────

  serialize(): ExpeditionSaveData {
    const teams: ExpeditionSaveData['teams'] = {};
    for (const [id, team] of Object.entries(this.state.teams)) {
      teams[id] = { id: team.id, name: team.name, heroIds: team.heroIds, formation: team.formation, troopCount: team.troopCount, maxTroops: team.maxTroops, totalPower: team.totalPower, currentRouteId: team.currentRouteId, currentNodeId: team.currentNodeId, isExpeditioning: team.isExpeditioning };
    }
    const sweepCounts: Record<string, Record<string, number>> = {};
    for (const [routeId, counts] of Object.entries(this.state.sweepCounts)) { sweepCounts[routeId] = { ...counts }; }
    const routeNodeStatuses: Record<string, Record<string, string>> = {};
    for (const [routeId, route] of Object.entries(this.state.routes)) {
      const nodeStatuses: Record<string, string> = {};
      for (const [nodeId, node] of Object.entries(route.nodes)) { nodeStatuses[nodeId] = node.status; }
      routeNodeStatuses[routeId] = nodeStatuses;
    }
    return {
      version: SAVE_VERSION, clearedRouteIds: [...this.state.clearedRouteIds], routeStars: { ...this.state.routeStars },
      sweepCounts, achievedMilestones: [...this.state.achievedMilestones], teams,
      autoConfig: { ...this.state.autoConfig }, unlockedSlots: this.state.unlockedSlots,
      consecutiveFailures: this.state.consecutiveFailures, isAutoExpeditioning: this.state.isAutoExpeditioning,
      routeNodeStatuses,
    };
  }

  deserialize(data: ExpeditionSaveData): void {
    this.state.clearedRouteIds = new Set(data.clearedRouteIds);
    this.state.routeStars = data.routeStars;
    this.state.achievedMilestones = new Set(data.achievedMilestones as MilestoneType[]);
    this.state.autoConfig = { ...data.autoConfig };
    this.state.unlockedSlots = data.unlockedSlots ?? 1;
    this.state.consecutiveFailures = data.consecutiveFailures ?? 0;
    this.state.isAutoExpeditioning = data.isAutoExpeditioning ?? false;

    this.state.teams = {};
    for (const [id, teamData] of Object.entries(data.teams)) { this.state.teams[id] = { ...teamData }; }

    this.state.sweepCounts = {};
    for (const [routeId, counts] of Object.entries(data.sweepCounts)) {
      this.state.sweepCounts[routeId] = counts as Record<SweepType, number>;
    }

    const savedNodeStatuses = data.routeNodeStatuses;
    for (const routeId of this.state.clearedRouteIds) {
      const route = this.state.routes[routeId];
      if (route) {
        route.unlocked = true;
        if (savedNodeStatuses?.[routeId]) {
          for (const [nodeId, statusStr] of Object.entries(savedNodeStatuses[routeId])) {
            const node = route.nodes[nodeId];
            if (node) node.status = statusStr as NodeStatus;
          }
        } else {
          for (const node of Object.values(route.nodes)) node.status = NodeStatus.CLEARED;
        }
      }
    }

    if (savedNodeStatuses) {
      for (const [routeId, nodeStatuses] of Object.entries(savedNodeStatuses)) {
        if (this.state.clearedRouteIds.has(routeId)) continue;
        const route = this.state.routes[routeId];
        if (route) {
          for (const [nodeId, statusStr] of Object.entries(nodeStatuses)) {
            const node = route.nodes[nodeId];
            if (node && statusStr !== NodeStatus.LOCKED) node.status = statusStr as NodeStatus;
          }
        }
      }
    }
  }
}
