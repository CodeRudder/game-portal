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
  UnlockCheckResult,
} from './expedition-helpers';
import {
  createDefaultExpeditionState,
  SAVE_VERSION,
} from './expedition-helpers';
import type {
  ExpeditionState,
  ExpeditionRoute,
  ExpeditionRegion,
  ExpeditionTeam,
  ExpeditionSaveData,
  ExpeditionLastDispatchConfig,
} from '../../core/expedition/expedition.types';
import {
  RouteDifficulty,
  NodeStatus,
  NodeType,
  FormationType,
  CASTLE_LEVEL_SLOTS,
  TROOP_COST,
} from '../../core/expedition/expedition.types';
import type { HeroBrief, TeamValidationResult } from './ExpeditionTeamHelper';
import { ExpeditionTeamHelper } from './ExpeditionTeamHelper';
import { SweepType, MilestoneType } from '../../core/expedition/expedition-battle.types';

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
    if (!Number.isFinite(castleLevel) || castleLevel < 0) return this.state.unlockedSlots;
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

  // ─── 武将锁定（远征中） ───────────────────

  /** 获取所有正在远征中的武将ID集合 */
  getExpeditioningHeroIds(): Set<string> {
    const heroIds = new Set<string>();
    for (const team of Object.values(this.state.teams)) {
      if (team.isExpeditioning) {
        for (const hid of team.heroIds) {
          heroIds.add(hid);
        }
      }
    }
    return heroIds;
  }

  /** 检查指定武将是否正在远征中（被锁定） */
  isHeroExpeditioning(heroId: string): boolean {
    return this.getExpeditioningHeroIds().has(heroId);
  }

  /** 获取上次派遣配置（用于快速重派）— 返回副本 */
  getLastDispatchConfig(): ExpeditionLastDispatchConfig | null {
    const config = this.state.lastDispatchConfig;
    if (!config) return null;
    return { ...config, heroIds: [...config.heroIds] };
  }

  /** 快速重派：使用上次成功的配置重新派遣队伍 */
  quickRedeploy(): boolean {
    const config = this.state.lastDispatchConfig;
    if (!config) return false;

    // 查找可用队伍（优先使用相同队伍ID，否则找空闲队伍）
    let team: ExpeditionTeam | undefined = this.state.teams[config.teamId];
    if (!team || team.isExpeditioning) {
      team = Object.values(this.state.teams).find(t => !t.isExpeditioning);
    }
    if (!team) return false;

    // 检查路线是否可用
    const route = this.state.routes[config.routeId];
    if (!route || !route.unlocked) return false;

    return this.dispatchTeam(team.id, config.routeId);
  }

  /** 获取路线节点完成进度（当前已清除节点数 / 总节点数） */
  getRouteNodeProgress(routeId: string): { current: number; total: number; percentage: number } {
    const route = this.state.routes[routeId];
    if (!route) return { current: 0, total: 0, percentage: 0 };

    const allNodes = Object.values(route.nodes);
    const total = allNodes.length;
    const cleared = allNodes.filter(n => n.status === NodeStatus.CLEARED).length;
    const percentage = total > 0 ? Math.round((cleared / total) * 100) : 0;

    return { current: cleared, total, percentage };
  }

  /** 获取队伍当前路线的节点进度 */
  getTeamNodeProgress(teamId: string): { current: number; total: number; percentage: number; routeName: string } {
    const team = this.state.teams[teamId];
    if (!team || !team.currentRouteId) return { current: 0, total: 0, percentage: 0, routeName: '' };

    const route = this.state.routes[team.currentRouteId];
    const progress = this.getRouteNodeProgress(team.currentRouteId);
    return { ...progress, routeName: route?.name ?? '' };
  }

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

    // 记录上次派遣配置，用于快速重派
    this.state.lastDispatchConfig = {
      teamId,
      routeId,
      heroIds: [...team.heroIds],
      formation: team.formation,
      timestamp: Date.now(),
    };

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
    const safeHealPercent = Number.isFinite(healPercent) && healPercent > 0 ? healPercent : 0;
    const healAmount = Math.round(team.maxTroops * safeHealPercent);
    team.troopCount = Math.min(team.maxTroops, team.troopCount + healAmount);
    return { healed: true, healAmount };
  }

  completeRoute(teamId: string, stars: number): boolean {
    if (!Number.isFinite(stars) || stars < 0 || stars > 3) return false;
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
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;
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
      lastDispatchConfig: this.state.lastDispatchConfig,
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
    this.state.lastDispatchConfig = data.lastDispatchConfig ?? null;

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
