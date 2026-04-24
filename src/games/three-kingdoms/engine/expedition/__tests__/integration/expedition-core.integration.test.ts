/**
 * 集成测试: 远征核心流程 — 队伍/路线选择/战斗/奖励
 *
 * 覆盖：
 *   §1 远征队伍创建与校验 (6 cases)
 *   §2 路线选择与解锁 (5 cases)
 *   §3 节点战斗与推进 (6 cases)
 *   §4 奖励结算与首通 (5 cases)
 *   §5 扫荡系统 (5 cases)
 *   §6 里程碑达成 (4 cases)
 *   Total: 31 cases
 *
 * 联动系统：ExpeditionSystem + ExpeditionBattleSystem + ExpeditionRewardSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import { ExpeditionBattleSystem, type BattleTeamData, type NodeBattleConfig } from '../../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../../ExpeditionRewardSystem';
import type { HeroBrief } from '../../ExpeditionTeamHelper';
import type { Faction } from '../../../hero/hero.types';
import {
  RouteDifficulty,
  NodeType,
  NodeStatus,
  FormationType,
  BattleGrade,
  SweepType,
  MilestoneType,
  TROOP_COST,
  CASTLE_LEVEL_SLOTS,
} from '../../../../core/expedition/expedition.types';
import { BASE_REWARDS } from '../../expedition-config';

// ── 辅助函数 ──────────────────────────────

function createHero(id: string, faction: Faction, power: number): HeroBrief {
  return { id, faction, power };
}

function createHeroDataMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

function shuHeroes(): HeroBrief[] {
  return [
    createHero('guanyu', 'shu', 5000),
    createHero('zhangfei', 'shu', 4800),
    createHero('zhaoyun', 'shu', 5200),
    createHero('machao', 'shu', 4600),
    createHero('huangzhong', 'shu', 4400),
  ];
}

function mixedHeroes(): HeroBrief[] {
  return [
    createHero('guanyu', 'shu', 5000),
    createHero('caocao', 'wei', 5500),
    createHero('zhouyu', 'wu', 5200),
    createHero('lvbu', 'qun', 6000),
    createHero('zhaoyun', 'shu', 5200),
  ];
}

function createBattleTeam(power: number, formation: FormationType): BattleTeamData {
  return {
    units: [{
      id: 'hero_1', hp: 10000, maxHp: 10000,
      attack: power * 0.3, defense: power * 0.2,
      speed: power * 0.1, intelligence: power * 0.1,
    }],
    formation,
    totalPower: power,
  };
}

function createNodeConfig(type: NodeType, power: number, formation: FormationType): NodeBattleConfig {
  return { nodeType: type, enemyPower: power, enemyFormation: formation, recommendedPower: power };
}

// ── §1 远征队伍创建与校验 ──────────────────

describe('§1 远征队伍创建与校验', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
  });

  it('§1.1 应创建有效队伍并返回战力', () => {
    const heroes = shuHeroes();
    const result = system.createTeam('蜀国主力', heroes.map(h => h.id), FormationType.OFFENSIVE, createHeroDataMap(heroes));
    expect(result.valid).toBe(true);
    expect(result.totalPower).toBeGreaterThan(0);
    expect(Object.keys(system.getState().teams).length).toBe(1);
  });

  it('§1.2 应拒绝空武将列表', () => {
    const result = system.createTeam('空队', [], FormationType.STANDARD, {});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('§1.3 应拒绝不存在的武将', () => {
    const result = system.createTeam('幽灵队', ['nonexistent1', 'nonexistent2'], FormationType.STANDARD, {});
    expect(result.valid).toBe(false);
  });

  it('§1.4 应拒绝已在远征中的武将（互斥校验）', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('队A', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    // 派遣队A使其进入远征状态
    const teamA = system.getAllTeams()[0];
    teamA.troopCount = teamA.maxTroops;
    system.dispatchTeam(teamA.id, 'route_hulao_easy');

    // 队A的武将已在远征中
    const activeTeams = Object.values(system.getState().teams).filter(t => t.isExpeditioning);
    const result = system.validateTeam(
      [heroes[0].id], FormationType.STANDARD, map, activeTeams,
    );
    expect(result.valid).toBe(false);
  });

  it('§1.5 应正确计算阵营羁绊', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expect(system.checkFactionBond(heroes.map(h => h.id), map)).toBe(true);

    const mixed = mixedHeroes();
    const mixedMap = createHeroDataMap(mixed);
    expect(system.checkFactionBond(mixed.map(h => h.id), mixedMap)).toBe(false);
  });

  it('§1.6 智能编队应优先选择高战力+同阵营', () => {
    const heroes = shuHeroes();
    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.OFFENSIVE, 5);
    expect(selected.length).toBe(5);
    // 应全部是蜀国武将（满足阵营羁绊）
    const map = createHeroDataMap(heroes);
    expect(system.checkFactionBond(selected, map)).toBe(true);
  });
});

// ── §2 路线选择与解锁 ──────────────────────

describe('§2 路线选择与解锁', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
  });

  it('§2.1 应列出所有路线', () => {
    const routes = system.getAllRoutes();
    expect(routes.length).toBeGreaterThan(0);
  });

  it('§2.2 首条路线默认解锁', () => {
    const route = system.getRoute('route_hulao_easy');
    expect(route).toBeDefined();
    expect(route!.unlocked).toBe(true);
  });

  it('§2.3 前置区域未通关时不可解锁', () => {
    const route = system.getRoute('route_yishui_easy');
    expect(route).toBeDefined();
    const check = system.canUnlockRoute('route_yishui_easy');
    expect(check.canUnlock).toBe(false);
  });

  it('§2.4 通关前置区域后可解锁', () => {
    // 通关虎牢关所有路线
    const state = system.getState();
    for (const rid of state.regions['region_hulao'].routeIds) {
      state.clearedRouteIds.add(rid);
    }
    const check = system.canUnlockRoute('route_yishui_easy');
    expect(check.canUnlock).toBe(true);
  });

  it('§2.5 奇袭路线需要困难通关', () => {
    // 先通关汜水关所有路线
    const state = system.getState();
    for (const rid of state.regions['region_yishui'].routeIds) {
      state.clearedRouteIds.add(rid);
    }
    // 但没通关洛阳困难
    const check = system.canUnlockRoute('route_luoyang_ambush');
    expect(check.canUnlock).toBe(false);
    expect(check.reasons.length).toBeGreaterThan(0);
  });
});

// ── §3 节点战斗与推进 ──────────────────────

describe('§3 节点战斗与推进', () => {
  let system: ExpeditionSystem;
  let battleSystem: ExpeditionBattleSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
    battleSystem = new ExpeditionBattleSystem();
  });

  it('§3.1 应派遣队伍到路线', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    const teamResult = system.createTeam('远征队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);
    expect(teamResult.valid).toBe(true);

    const teams = system.getAllTeams();
    const team = teams[0];
    team.troopCount = team.maxTroops; // 补满兵力

    const dispatched = system.dispatchTeam(team.id, 'route_hulao_easy');
    expect(dispatched).toBe(true);
    expect(team.isExpeditioning).toBe(true);
  });

  it('§3.2 应拒绝派遣到未解锁路线', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('远征队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = system.getAllTeams()[0];
    team.troopCount = team.maxTroops;

    const dispatched = system.dispatchTeam(team.id, 'route_yishui_easy');
    expect(dispatched).toBe(false);
  });

  it('§3.3 应拒绝兵力不足的派遣', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('远征队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = system.getAllTeams()[0];
    team.troopCount = 0; // 兵力为0

    const dispatched = system.dispatchTeam(team.id, 'route_hulao_easy');
    expect(dispatched).toBe(false);
  });

  it('§3.4 应推进到下一节点', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('远征队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = system.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    system.dispatchTeam(team.id, 'route_hulao_easy');

    const nextNodeId = system.advanceToNextNode(team.id);
    expect(nextNodeId).not.toBeNull();
    expect(team.currentNodeId).toBe(nextNodeId);
  });

  it('§3.5 休息节点应恢复兵力', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('远征队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = system.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    system.dispatchTeam(team.id, 'route_hulao_easy');

    // 推进到休息节点（第5个节点是REST）
    system.advanceToNextNode(team.id); // n1 -> n2
    system.advanceToNextNode(team.id); // n2 -> n3
    system.advanceToNextNode(team.id); // n3 -> n4
    system.advanceToNextNode(team.id); // n4 -> n5 (REST)

    team.troopCount = Math.floor(team.maxTroops * 0.5); // 先扣血
    const result = system.processNodeEffect(team.id);
    expect(result.healed).toBe(true);
    expect(result.healAmount).toBeGreaterThan(0);
  });

  it('§3.6 战斗系统应返回有效评级', () => {
    const allyTeam = createBattleTeam(10000, FormationType.OFFENSIVE);
    const nodeConfig = createNodeConfig(NodeType.BANDIT, 3000, FormationType.STANDARD);

    const result = battleSystem.executeBattle(allyTeam, nodeConfig);
    expect(Object.values(BattleGrade)).toContain(result.grade);
    expect(result.stars).toBeGreaterThanOrEqual(0);
    expect(result.stars).toBeLessThanOrEqual(3);
    expect(result.totalTurns).toBeGreaterThan(0);
    expect(result.totalTurns).toBeLessThanOrEqual(10);
  });
});

// ── §4 奖励结算与首通 ──────────────────────

describe('§4 奖励结算与首通', () => {
  let rewardSystem: ExpeditionRewardSystem;

  beforeEach(() => {
    // 注入固定随机数，让掉落结果可预测
    let seed = 0;
    rewardSystem = new ExpeditionRewardSystem(() => {
      seed += 0.1;
      return seed % 1;
    });
  });

  it('§4.1 应计算普通节点奖励', () => {
    const reward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BANDIT,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
    expect(reward.exp).toBeGreaterThan(0);
  });

  it('§4.2 BOSS节点奖励应高于普通节点', () => {
    const normalReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BANDIT,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const bossReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(bossReward.grain).toBeGreaterThan(normalReward.grain);
    expect(bossReward.exp).toBeGreaterThan(normalReward.exp);
  });

  it('§4.3 首通应附加额外奖励', () => {
    const normal = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const firstClear = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: true,
      isRouteComplete: false,
    });
    const firstClearHeroFrag = firstClear.drops.filter(d => d.type === 'hero_fragment');
    expect(firstClearHeroFrag.length).toBeGreaterThan(normal.drops.filter(d => d.type === 'hero_fragment').length);
  });

  it('§4.4 大捷奖励应高于惜败', () => {
    const greatReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.HARD,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const defeatReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.HARD,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.NARROW_DEFEAT,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(greatReward.grain).toBeGreaterThan(defeatReward.grain);
    expect(greatReward.exp).toBeGreaterThan(defeatReward.exp);
  });

  it('§4.5 路线完成应汇总所有节点奖励', () => {
    const routeReward = rewardSystem.calculateRouteReward(
      RouteDifficulty.NORMAL,
      [
        { nodeType: NodeType.BANDIT, grade: BattleGrade.GREAT_VICTORY },
        { nodeType: NodeType.HAZARD, grade: BattleGrade.MINOR_VICTORY },
        { nodeType: NodeType.BOSS, grade: BattleGrade.GREAT_VICTORY },
      ],
      true,
    );
    expect(routeReward.grain).toBeGreaterThan(0);
    expect(routeReward.gold).toBeGreaterThan(0);
    expect(routeReward.drops.length).toBeGreaterThan(0);
  });
});

// ── §5 扫荡系统 ────────────────────────────

describe('§5 扫荡系统', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
  });

  it('§5.1 未三星通关不可扫荡', () => {
    expect(system.canSweepRoute('route_hulao_easy')).toBe(false);
  });

  it('§5.2 三星通关后可扫荡', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.routeStars['route_hulao_easy'] = 3;
    expect(system.canSweepRoute('route_hulao_easy')).toBe(true);
  });

  it('§5.3 普通扫荡有每日上限', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.routeStars['route_hulao_easy'] = 3;

    // 连续扫荡5次应成功
    for (let i = 0; i < 5; i++) {
      const result = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
      expect(result.success).toBe(true);
    }
    // 第6次应失败
    const result = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('次数');
  });

  it('§5.4 高级扫荡每日上限为3次', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.routeStars['route_hulao_easy'] = 3;

    for (let i = 0; i < 3; i++) {
      const result = system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
      expect(result.success).toBe(true);
    }
    const result = system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    expect(result.success).toBe(false);
  });

  it('§5.5 免费扫荡每日1次', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.routeStars['route_hulao_easy'] = 3;

    const r1 = system.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(r1.success).toBe(true);
    const r2 = system.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(r2.success).toBe(false);
  });
});

// ── §6 里程碑达成 ──────────────────────────

describe('§6 里程碑达成', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
  });

  it('§6.1 通关首条路线应达成"初出茅庐"', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');

    const milestones = system.checkMilestones();
    expect(milestones).toContain(MilestoneType.FIRST_CLEAR);
  });

  it('§6.2 重复通关不应重复触发里程碑', () => {
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    system.checkMilestones();

    const milestones2 = system.checkMilestones();
    expect(milestones2).not.toContain(MilestoneType.FIRST_CLEAR);
  });

  it('§6.3 通关10条路线应达成"百战之师"', () => {
    const state = system.getState();
    const routes = system.getAllRoutes();
    for (let i = 0; i < Math.min(10, routes.length); i++) {
      state.clearedRouteIds.add(routes[i].id);
    }
    const milestones = system.checkMilestones();
    expect(milestones).toContain(MilestoneType.TEN_CLEARS);
  });

  it('§6.4 完成路线应更新星级记录', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('远征队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = system.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    system.dispatchTeam(team.id, 'route_hulao_easy');

    system.completeRoute(team.id, 3);
    expect(system.getRouteStars('route_hulao_easy')).toBe(3);
    expect(system.getClearedRouteIds().has('route_hulao_easy')).toBe(true);
  });
});
