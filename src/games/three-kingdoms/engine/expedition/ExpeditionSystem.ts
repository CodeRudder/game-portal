/**
 * 远征系统 — 引擎层
 *
 * 职责：路线管理、节点状态推进、队伍调度、队列槽位、路线解锁
 * 规则：
 *   - 树状分支路线，5种节点(山贼/天险/Boss/宝箱/休息)
 *   - 主城5/10/15/20级→1/2/3/4支队伍
 *   - 路线按区域逐步解锁，奇袭需通关困难路线
 *   - 兵力消耗：出发20/武将，扫荡10/武将
 *   - 阵营羁绊：≥3名同阵营全属性+10%
 *
 * @module engine/expedition/ExpeditionSystem
 */

import type {
  ExpeditionRoute,
  ExpeditionRegion,
  ExpeditionTeam,
  ExpeditionNode,
  ExpeditionState,
  ExpeditionSaveData,
  FormationType,
} from '../../core/expedition/expedition.types';
import {
  NodeStatus,
  NodeType,
  RouteDifficulty,
  FormationType as FT,
  CASTLE_LEVEL_SLOTS,
  TROOP_COST,
  FACTION_BOND_THRESHOLD,
  FACTION_BOND_BONUS,
  MAX_HEROES_PER_TEAM,
  SweepType,
  MilestoneType,
  FORMATION_EFFECTS,
} from '../../core/expedition/expedition.types';
import {
  createDefaultRegions,
  createDefaultRoutes,
} from './expedition-config';
import type { Faction } from '../hero/hero.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 武将简要信息（用于编队计算） */
export interface HeroBrief {
  id: string;
  faction: Faction;
  power: number;
}

/** 编队校验结果 */
export interface TeamValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  factionBond: boolean;
  totalPower: number;
}

/** 路线解锁校验结果 */
export interface UnlockCheckResult {
  canUnlock: boolean;
  reasons: string[];
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一ID */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

export class ExpeditionSystem {
  private state: ExpeditionState;

  constructor(initialState?: ExpeditionState) {
    this.state = initialState ?? createDefaultExpeditionState();
  }

  // ─── 状态访问 ─────────────────────────────

  getState(): ExpeditionState {
    return this.state;
  }

  getRoute(routeId: string): ExpeditionRoute | undefined {
    return this.state.routes[routeId];
  }

  getRegion(regionId: string): ExpeditionRegion | undefined {
    return this.state.regions[regionId];
  }

  getTeam(teamId: string): ExpeditionTeam | undefined {
    return this.state.teams[teamId];
  }

  getAllRoutes(): ExpeditionRoute[] {
    return Object.values(this.state.routes);
  }

  getAllTeams(): ExpeditionTeam[] {
    return Object.values(this.state.teams);
  }

  getClearedRouteIds(): Set<string> {
    return this.state.clearedRouteIds;
  }

  getRouteStars(routeId: string): number {
    return this.state.routeStars[routeId] ?? 0;
  }

  // ─── 队列槽位 ─────────────────────────────

  /** 根据主城等级更新队伍槽位 */
  updateSlots(castleLevel: number): number {
    const slots = this.getSlotCount(castleLevel);
    this.state.unlockedSlots = slots;
    return slots;
  }

  /** 获取主城等级对应的队伍数量 */
  getSlotCount(castleLevel: number): number {
    const levels = Object.keys(CASTLE_LEVEL_SLOTS)
      .map(Number)
      .sort((a, b) => b - a);
    for (const lvl of levels) {
      if (castleLevel >= lvl) {
        return CASTLE_LEVEL_SLOTS[lvl];
      }
    }
    return 0;
  }

  getUnlockedSlots(): number {
    return this.state.unlockedSlots;
  }

  // ─── 路线解锁 ─────────────────────────────

  /** 检查路线是否可以解锁 */
  canUnlockRoute(routeId: string): UnlockCheckResult {
    const route = this.state.routes[routeId];
    if (!route) {
      return { canUnlock: false, reasons: ['路线不存在'] };
    }
    if (route.unlocked) {
      return { canUnlock: true, reasons: [] };
    }

    const reasons: string[] = [];

    // 检查前置区域
    if (route.requiredRegionId) {
      const regionRoutes = this.state.regions[route.requiredRegionId]?.routeIds ?? [];
      const regionCleared = regionRoutes.every(rid => this.state.clearedRouteIds.has(rid));
      if (!regionCleared) {
        reasons.push(`需要先通关前置区域的所有路线`);
      }
    }

    // 检查困难路线通关（奇袭路线）
    if (route.requireHardClear) {
      const hardRoutes = this.getAllRoutes().filter(
        r => r.regionId === route.regionId && r.difficulty === RouteDifficulty.HARD
      );
      const hardCleared = hardRoutes.some(r => this.state.clearedRouteIds.has(r.id));
      if (!hardCleared) {
        reasons.push(`需要先通关同区域的困难路线`);
      }
    }

    return { canUnlock: reasons.length === 0, reasons };
  }

  /** 尝试解锁路线 */
  unlockRoute(routeId: string): boolean {
    const check = this.canUnlockRoute(routeId);
    if (!check.canUnlock) {
      return false;
    }
    const route = this.state.routes[routeId];
    if (route) {
      route.unlocked = true;
      // 解锁起始节点
      const startNode = route.nodes[route.startNodeId];
      if (startNode && startNode.status === NodeStatus.LOCKED) {
        startNode.status = NodeStatus.MARCHING;
      }
    }
    return true;
  }

  // ─── 队伍编成 ─────────────────────────────

  /** 创建队伍 */
  createTeam(
    name: string,
    heroIds: string[],
    formation: FormationType,
    heroDataMap: Record<string, HeroBrief>,
  ): TeamValidationResult {
    const activeTeams = Object.values(this.state.teams).filter(t => t.isExpeditioning);
    const validation = this.validateTeam(heroIds, formation, heroDataMap, activeTeams);

    if (!validation.valid) {
      return validation;
    }

    const totalPower = this.calculateTeamPower(heroIds, heroDataMap, formation);
    const troopCost = heroIds.length * TROOP_COST.expeditionPerHero;

    const team: ExpeditionTeam = {
      id: generateId('team'),
      name,
      heroIds,
      formation,
      troopCount: troopCost,
      maxTroops: heroIds.length * 100,
      totalPower,
      currentRouteId: null,
      currentNodeId: null,
      isExpeditioning: false,
    };

    this.state.teams[team.id] = team;
    return { ...validation, totalPower };
  }

  /** 校验队伍编成 */
  validateTeam(
    heroIds: string[],
    formation: FormationType,
    heroDataMap: Record<string, HeroBrief>,
    activeTeams: ExpeditionTeam[],
  ): TeamValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 武将数量
    if (heroIds.length === 0) {
      errors.push('至少需要1名武将');
    }
    if (heroIds.length > MAX_HEROES_PER_TEAM) {
      errors.push(`武将数量不能超过${MAX_HEROES_PER_TEAM}名`);
    }

    // 武将互斥检查
    const activeHeroIds = new Set<string>();
    for (const team of activeTeams) {
      for (const hid of team.heroIds) {
        activeHeroIds.add(hid);
      }
    }
    for (const hid of heroIds) {
      if (activeHeroIds.has(hid)) {
        errors.push(`武将${hid}已在其他远征队伍中`);
      }
    }

    // 检查武将是否存在
    for (const hid of heroIds) {
      if (!heroDataMap[hid]) {
        errors.push(`武将${hid}不存在`);
      }
    }

    // 阵营羁绊
    const factionBond = this.checkFactionBond(heroIds, heroDataMap);
    if (heroIds.length >= FACTION_BOND_THRESHOLD && !factionBond) {
      warnings.push('当前编队未触发阵营羁绊');
    }

    const totalPower = this.calculateTeamPower(heroIds, heroDataMap, formation);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      factionBond,
      totalPower,
    };
  }

  /** 检查阵营羁绊 */
  checkFactionBond(heroIds: string[], heroDataMap: Record<string, HeroBrief>): boolean {
    const factionCounts: Record<string, number> = {};
    for (const hid of heroIds) {
      const hero = heroDataMap[hid];
      if (hero) {
        factionCounts[hero.faction] = (factionCounts[hero.faction] ?? 0) + 1;
      }
    }
    return Object.values(factionCounts).some(count => count >= FACTION_BOND_THRESHOLD);
  }

  /** 计算队伍总战力 */
  calculateTeamPower(
    heroIds: string[],
    heroDataMap: Record<string, HeroBrief>,
    formation: FormationType,
  ): number {
    let totalPower = 0;
    const effect = FORMATION_EFFECTS[formation];
    const hasBond = this.checkFactionBond(heroIds, heroDataMap);
    const bondMultiplier = hasBond ? (1 + FACTION_BOND_BONUS) : 1;

    for (const hid of heroIds) {
      const hero = heroDataMap[hid];
      if (hero) {
        // 阵型修正：取平均修正
        const avgMod = (effect.attackMod + effect.defenseMod + effect.speedMod + effect.intelligenceMod) / 4;
        totalPower += hero.power * (1 + avgMod) * bondMultiplier;
      }
    }

    return Math.round(totalPower);
  }

  /** 智能编队 — 基于战力+阵营羁绊自动填充 */
  autoComposeTeam(
    availableHeroes: HeroBrief[],
    activeHeroIds: Set<string>,
    formation: FormationType,
    maxHeroes: number = MAX_HEROES_PER_TEAM,
  ): string[] {
    const candidates = availableHeroes
      .filter(h => !activeHeroIds.has(h.id))
      .sort((a, b) => b.power - a.power);

    if (candidates.length === 0) return [];

    // 尝试触发阵营羁绊
    const factionGroups: Record<string, HeroBrief[]> = {};
    for (const hero of candidates) {
      if (!factionGroups[hero.faction]) {
        factionGroups[hero.faction] = [];
      }
      factionGroups[hero.faction].push(hero);
    }

    // 找到最多同阵营的英雄组
    let bestFaction: string | null = null;
    let bestCount = 0;
    for (const [faction, heroes] of Object.entries(factionGroups)) {
      if (heroes.length >= FACTION_BOND_THRESHOLD && heroes.length > bestCount) {
        bestFaction = faction;
        bestCount = heroes.length;
      }
    }

    const selected: HeroBrief[] = [];

    if (bestFaction && bestCount >= FACTION_BOND_THRESHOLD) {
      // 先加入同阵营最强武将（达到羁绊阈值）
      const factionHeroes = factionGroups[bestFaction]
        .sort((a, b) => b.power - a.power)
        .slice(0, Math.min(FACTION_BOND_THRESHOLD, maxHeroes));
      selected.push(...factionHeroes);

      // 剩余位置用其他最强武将填充
      const remaining = maxHeroes - selected.length;
      if (remaining > 0) {
        const selectedIds = new Set(selected.map(h => h.id));
        const others = candidates
          .filter(h => !selectedIds.has(h.id))
          .sort((a, b) => b.power - a.power)
          .slice(0, remaining);
        selected.push(...others);
      }
    } else {
      // 无羁绊，直接取最强
      selected.push(...candidates.slice(0, maxHeroes));
    }

    return selected.map(h => h.id);
  }

  // ─── 远征推进 ─────────────────────────────

  /** 派遣队伍出发远征 */
  dispatchTeam(teamId: string, routeId: string): boolean {
    const team = this.state.teams[teamId];
    const route = this.state.routes[routeId];

    if (!team || !route || !route.unlocked) {
      return false;
    }

    // 检查队伍数量限制
    const expeditioningCount = Object.values(this.state.teams)
      .filter(t => t.isExpeditioning).length;
    if (expeditioningCount >= this.state.unlockedSlots) {
      return false;
    }

    // 检查兵力
    const requiredTroops = team.heroIds.length * TROOP_COST.expeditionPerHero;
    if (team.troopCount < requiredTroops) {
      return false;
    }

    // 消耗兵力
    team.troopCount -= requiredTroops;
    team.currentRouteId = routeId;
    team.currentNodeId = route.startNodeId;
    team.isExpeditioning = true;

    // 设置起始节点为行军中
    const startNode = route.nodes[route.startNodeId];
    if (startNode && startNode.status === NodeStatus.LOCKED) {
      startNode.status = NodeStatus.MARCHING;
    }

    return true;
  }

  /** 推进到下一个节点 */
  advanceToNextNode(teamId: string): string | null {
    const team = this.state.teams[teamId];
    if (!team || !team.isExpeditioning || !team.currentRouteId || !team.currentNodeId) {
      return null;
    }

    const route = this.state.routes[team.currentRouteId];
    if (!route) return null;

    const currentNode = route.nodes[team.currentNodeId];
    if (!currentNode || currentNode.nextNodeIds.length === 0) {
      // 已到达终点
      return null;
    }

    // 标记当前节点为已通关
    currentNode.status = NodeStatus.CLEARED;

    // 推进到下一个节点
    const nextNodeId = currentNode.nextNodeIds[0];
    const nextNode = route.nodes[nextNodeId];
    if (nextNode) {
      nextNode.status = NodeStatus.MARCHING;
      team.currentNodeId = nextNodeId;
      return nextNodeId;
    }

    return null;
  }

  /** 处理节点效果（休息点恢复兵力） */
  processNodeEffect(teamId: string): { healed: boolean; healAmount: number } {
    const team = this.state.teams[teamId];
    if (!team || !team.currentRouteId || !team.currentNodeId) {
      return { healed: false, healAmount: 0 };
    }

    const route = this.state.routes[team.currentRouteId];
    const node = route?.nodes[team.currentNodeId];
    if (!node || node.type !== NodeType.REST) {
      return { healed: false, healAmount: 0 };
    }

    const healPercent = node.healPercent ?? 0.20;
    const healAmount = Math.round(team.maxTroops * healPercent);
    team.troopCount = Math.min(team.maxTroops, team.troopCount + healAmount);

    return { healed: true, healAmount };
  }

  /** 完成路线 */
  completeRoute(teamId: string, stars: number): boolean {
    const team = this.state.teams[teamId];
    if (!team || !team.currentRouteId) return false;

    const routeId = team.currentRouteId;

    // 标记终点节点
    const route = this.state.routes[routeId];
    if (route && team.currentNodeId) {
      const endNode = route.nodes[team.currentNodeId];
      if (endNode) {
        endNode.status = NodeStatus.CLEARED;
      }
    }

    // 记录通关
    this.state.clearedRouteIds.add(routeId);

    // 更新星级（取最高）
    const prevStars = this.state.routeStars[routeId] ?? 0;
    if (stars > prevStars) {
      this.state.routeStars[routeId] = stars;
    }

    // 重置队伍（恢复兵力至满值，便于再次出征）
    team.currentRouteId = null;
    team.currentNodeId = null;
    team.isExpeditioning = false;
    team.troopCount = team.maxTroops;

    // 检查是否解锁新路线
    this.checkAndUnlockNewRoutes();

    return true;
  }

  /** 检查并解锁新路线 */
  private checkAndUnlockNewRoutes(): void {
    for (const routeId of Object.keys(this.state.routes)) {
      this.unlockRoute(routeId);
    }
  }

  // ─── 扫荡系统 ─────────────────────────────

  /** 检查路线是否可扫荡 */
  canSweepRoute(routeId: string): boolean {
    const stars = this.state.routeStars[routeId] ?? 0;
    return stars >= 3;
  }

  /** 获取今日扫荡次数 */
  getSweepCount(routeId: string, sweepType: SweepType): number {
    return this.state.sweepCounts[routeId]?.[sweepType] ?? 0;
  }

  /** 执行扫荡 */
  executeSweep(routeId: string, sweepType: SweepType): { success: boolean; reason: string } {
    if (!this.canSweepRoute(routeId)) {
      return { success: false, reason: '需要三星通关才能扫荡' };
    }

    const config = this.getSweepConfig(sweepType);
    const currentCount = this.getSweepCount(routeId, sweepType);

    if (currentCount >= config.dailyLimit) {
      return { success: false, reason: '今日扫荡次数已用完' };
    }

    // 记录扫荡次数
    if (!this.state.sweepCounts[routeId]) {
      this.state.sweepCounts[routeId] = {
        [SweepType.NORMAL]: 0,
        [SweepType.ADVANCED]: 0,
        [SweepType.FREE]: 0,
      };
    }
    this.state.sweepCounts[routeId][sweepType] = currentCount + 1;

    return { success: true, reason: '' };
  }

  /** 获取扫荡配置 */
  private getSweepConfig(sweepType: SweepType): { cost: number; rewardMultiplier: number; dailyLimit: number; guaranteedRare: boolean } {
    const configs: Record<SweepType, { cost: number; rewardMultiplier: number; dailyLimit: number; guaranteedRare: boolean }> = {
      [SweepType.NORMAL]: { cost: 1, rewardMultiplier: 1.0, dailyLimit: 5, guaranteedRare: false },
      [SweepType.ADVANCED]: { cost: 3, rewardMultiplier: 1.5, dailyLimit: 3, guaranteedRare: true },
      [SweepType.FREE]: { cost: 0, rewardMultiplier: 0.5, dailyLimit: 1, guaranteedRare: false },
    };
    return configs[sweepType];
  }

  // ─── 里程碑 ─────────────────────────────

  /** 检查里程碑达成 */
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

  /** 自然恢复兵力 */
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
      teams[id] = {
        id: team.id,
        name: team.name,
        heroIds: team.heroIds,
        formation: team.formation,
        troopCount: team.troopCount,
        maxTroops: team.maxTroops,
        totalPower: team.totalPower,
        currentRouteId: team.currentRouteId,
        currentNodeId: team.currentNodeId,
        isExpeditioning: team.isExpeditioning,
      };
    }

    const sweepCounts: Record<string, Record<string, number>> = {};
    for (const [routeId, counts] of Object.entries(this.state.sweepCounts)) {
      sweepCounts[routeId] = { ...counts };
    }

    return {
      version: SAVE_VERSION,
      clearedRouteIds: [...this.state.clearedRouteIds],
      routeStars: { ...this.state.routeStars },
      sweepCounts,
      achievedMilestones: [...this.state.achievedMilestones],
      teams,
      autoConfig: { ...this.state.autoConfig },
      unlockedSlots: this.state.unlockedSlots,
      consecutiveFailures: this.state.consecutiveFailures,
      isAutoExpeditioning: this.state.isAutoExpeditioning,
    };
  }

  deserialize(data: ExpeditionSaveData): void {
    this.state.clearedRouteIds = new Set(data.clearedRouteIds);
    this.state.routeStars = data.routeStars;
    this.state.achievedMilestones = new Set(data.achievedMilestones as MilestoneType[]);
    this.state.autoConfig = { ...data.autoConfig };

    // 恢复队伍槽位与自动远征状态
    this.state.unlockedSlots = data.unlockedSlots ?? 1;
    this.state.consecutiveFailures = data.consecutiveFailures ?? 0;
    this.state.isAutoExpeditioning = data.isAutoExpeditioning ?? false;

    // 恢复队伍
    this.state.teams = {};
    for (const [id, teamData] of Object.entries(data.teams)) {
      this.state.teams[id] = {
        ...teamData,
      };
    }

    // 恢复扫荡计数
    this.state.sweepCounts = {};
    for (const [routeId, counts] of Object.entries(data.sweepCounts)) {
      this.state.sweepCounts[routeId] = counts as Record<SweepType, number>;
    }

    // 恢复路线解锁状态
    for (const routeId of this.state.clearedRouteIds) {
      const route = this.state.routes[routeId];
      if (route) {
        route.unlocked = true;
        for (const node of Object.values(route.nodes)) {
          node.status = NodeStatus.CLEARED;
        }
      }
    }
  }
}
