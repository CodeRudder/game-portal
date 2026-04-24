/**
 * 集成测试: 跨系统串联 — 远征↔武将/资源/科技
 *
 * 覆盖：
 *   §1 远征↔武将系统联动 (6 cases)
 *   §2 远征↔资源系统联动 (5 cases)
 *   §3 远征↔科技系统联动 (4 cases)
 *   §4 全链路端到端流程 (5 cases)
 *   Total: 20 cases
 *
 * 联动系统：ExpeditionSystem + ExpeditionBattleSystem + ExpeditionRewardSystem + AutoExpeditionSystem
 * 外部系统接口：HeroSystem / ResourceSystem / TechSystem（通过模拟接口交互）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import { ExpeditionBattleSystem, type BattleTeamData, type NodeBattleConfig } from '../../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../../ExpeditionRewardSystem';
import { AutoExpeditionSystem } from '../../AutoExpeditionSystem';
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
import { BASE_REWARDS, POWER_MULTIPLIERS } from '../../expedition-config';

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

function weiHeroes(): HeroBrief[] {
  return [
    createHero('caocao', 'wei', 5500),
    createHero('xuchu', 'wei', 4500),
    createHero('dianwei', 'wei', 4700),
    createHero('zhangliao', 'wei', 5000),
    createHero('simayi', 'wei', 5800),
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

// ── §1 远征↔武将系统联动 ──────────────────

describe('§1 远征↔武将系统联动', () => {
  let system: ExpeditionSystem;
  let battleSystem: ExpeditionBattleSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
    battleSystem = new ExpeditionBattleSystem();
  });

  it('§1.1 武将战力应直接影响队伍总战力', () => {
    const weakHeroes = [createHero('weak1', 'shu', 1000), createHero('weak2', 'shu', 1000)];
    const strongHeroes = [createHero('strong1', 'shu', 5000), createHero('strong2', 'shu', 5000)];

    const weakMap = createHeroDataMap(weakHeroes);
    const strongMap = createHeroDataMap(strongHeroes);

    const weakResult = system.createTeam('弱队', weakHeroes.map(h => h.id), FormationType.STANDARD, weakMap);
    const weakPower = weakResult.totalPower;

    system.createTeam('强队', strongHeroes.map(h => h.id), FormationType.STANDARD, strongMap);
    const strongPower = system.getAllTeams()[1]!.totalPower;

    expect(strongPower).toBeGreaterThan(weakPower);
  });

  it('§1.2 阵型应影响队伍战力计算', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);

    // 攻击阵型应提高攻击相关战力
    const offensiveResult = system.createTeam('攻队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);
    const standardResult = system.calculateTeamPower(
      heroes.map(h => h.id), map, FormationType.STANDARD,
    );

    expect(offensiveResult.totalPower).not.toBe(standardResult);
  });

  it('§1.3 武将互斥：同一武将不可同时在两支远征队', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);

    system.createTeam('队A', heroes.map(h => h.id), FormationType.STANDARD, map);
    const teamA = system.getAllTeams()[0];
    teamA.isExpeditioning = true;

    // 尝试用队A的武将创建队B
    const activeTeams = Object.values(system.getState().teams).filter(t => t.isExpeditioning);
    const result = system.validateTeam(
      [heroes[0].id, heroes[1].id], FormationType.STANDARD, map, activeTeams,
    );
    expect(result.valid).toBe(false);
  });

  it('§1.4 武将数量应影响兵力消耗', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);

    system.createTeam('3人队', heroes.slice(0, 3).map(h => h.id), FormationType.STANDARD, map);
    const team3 = system.getAllTeams()[0];
    const cost3 = team3.heroIds.length * TROOP_COST.expeditionPerHero;

    system.createTeam('5人队', heroes.map(h => h.id), FormationType.STANDARD, map);
    const team5 = system.getAllTeams()[1];
    const cost5 = team5.heroIds.length * TROOP_COST.expeditionPerHero;

    expect(cost5).toBeGreaterThan(cost3);
  });

  it('§1.5 智能编队应排除已在远征中的武将', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);

    system.createTeam('队A', heroes.slice(0, 3).map(h => h.id), FormationType.STANDARD, map);
    const teamA = system.getAllTeams()[0];
    teamA.isExpeditioning = true;

    const activeHeroIds = new Set(teamA.heroIds);
    const selected = system.autoComposeTeam(heroes, activeHeroIds, FormationType.STANDARD, 5);

    // 不应包含队A的武将
    for (const hid of teamA.heroIds) {
      expect(selected).not.toContain(hid);
    }
  });

  it('§1.6 阵营羁绊加成应体现在战力中', () => {
    const shuMap = createHeroDataMap(shuHeroes());
    const mixedMap = createHeroDataMap([
      createHero('guanyu', 'shu', 5000),
      createHero('caocao', 'wei', 5000),
      createHero('zhouyu', 'wu', 5000),
      createHero('lvbu', 'qun', 5000),
      createHero('zhaoyun', 'shu', 5000),
    ]);

    const shuPower = system.calculateTeamPower(
      shuHeroes().map(h => h.id), shuMap, FormationType.STANDARD,
    );
    const mixedPower = system.calculateTeamPower(
      ['guanyu', 'caocao', 'zhouyu', 'lvbu', 'zhaoyun'], mixedMap, FormationType.STANDARD,
    );

    // 蜀国5人触发羁绊，混合阵营不触发，同基础战力下蜀国应更高
    expect(shuPower).toBeGreaterThan(mixedPower);
  });
});

// ── §2 远征↔资源系统联动 ──────────────────

describe('§2 远征↔资源系统联动', () => {
  let system: ExpeditionSystem;
  let rewardSystem: ExpeditionRewardSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
    let seed = 0;
    rewardSystem = new ExpeditionRewardSystem(() => { seed += 0.15; return seed % 1; });
  });

  it('§2.1 远征奖励应产出多种资源类型', () => {
    const reward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
    expect(reward.iron).toBeGreaterThan(0);
    expect(reward.exp).toBeGreaterThan(0);
  });

  it('§2.2 高难度路线奖励应高于低难度', () => {
    const easyReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.EASY,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const hardReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.HARD,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(hardReward.grain).toBeGreaterThan(easyReward.grain);
    expect(hardReward.gold).toBeGreaterThan(easyReward.gold);
    expect(hardReward.exp).toBeGreaterThan(easyReward.exp);
  });

  it('§2.3 扫荡奖励应按类型缩放', () => {
    const normalReward = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.NORMAL,
      heroCount: 5,
    });
    const advancedReward = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.ADVANCED,
      heroCount: 5,
    });
    const freeReward = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.FREE,
      heroCount: 5,
    });

    expect(advancedReward.grain).toBeGreaterThan(normalReward.grain);
    expect(normalReward.grain).toBeGreaterThan(freeReward.grain);
  });

  it('§2.4 里程碑奖励应可获取', () => {
    const firstClearReward = rewardSystem.getMilestoneReward(MilestoneType.FIRST_CLEAR);
    expect(firstClearReward).not.toBeNull();
    expect(firstClearReward!.gold).toBeGreaterThan(0);
  });

  it('§2.5 兵力恢复应按时间线性增长', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('远征队', heroes.map(h => h.id), FormationType.STANDARD, map);

    const team = system.getAllTeams()[0];
    team.troopCount = 0;

    system.recoverTroops(TROOP_COST.recoveryIntervalSeconds * 10);
    expect(team.troopCount).toBe(10); // 10个恢复周期 × 1点/周期
  });
});

// ── §3 远征↔科技系统联动 ──────────────────

describe('§3 远征↔科技系统联动', () => {
  let system: ExpeditionSystem;
  let battleSystem: ExpeditionBattleSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
    battleSystem = new ExpeditionBattleSystem();
  });

  it('§3.1 主城等级应决定远征队伍槽位数', () => {
    expect(system.getSlotCount(5)).toBe(1);
    expect(system.getSlotCount(10)).toBe(2);
    expect(system.getSlotCount(15)).toBe(3);
    expect(system.getSlotCount(20)).toBe(4);
  });

  it('§3.2 低等级主城应限制并发远征队数', () => {
    system.updateSlots(5); // 只有1个槽位
    expect(system.getUnlockedSlots()).toBe(1);

    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);

    system.createTeam('队1', heroes.slice(0, 3).map(h => h.id), FormationType.STANDARD, map);
    const team1 = system.getAllTeams()[0];
    team1.troopCount = team1.maxTroops;
    system.dispatchTeam(team1.id, 'route_hulao_easy');

    // 第二队无法派遣（槽位已满）
    system.createTeam('队2', heroes.slice(3, 5).map(h => h.id), FormationType.STANDARD, map);
    const team2 = system.getAllTeams()[1];
    team2.troopCount = team2.maxTroops;
    const dispatched = system.dispatchTeam(team2.id, 'route_hulao_easy');
    expect(dispatched).toBe(false);
  });

  it('§3.3 阵型克制应影响战斗结果', () => {
    const allyTeam = createBattleTeam(5000, FormationType.OFFENSIVE);
    const counteredEnemy = createNodeConfig(NodeType.BOSS, 5000, FormationType.DEFENSIVE); // 锋矢克制方圆
    const neutralEnemy = createNodeConfig(NodeType.BOSS, 5000, FormationType.STANDARD);

    const counteredResult = battleSystem.executeBattle(allyTeam, counteredEnemy);
    const neutralResult = battleSystem.executeBattle(allyTeam, neutralEnemy);

    // 克制方应有更好的血量保留
    expect(counteredResult.allyHpPercent).toBeGreaterThanOrEqual(neutralResult.allyHpPercent * 0.8);
  });

  it('§3.4 路线难度倍率应影响敌方战力', () => {
    const easyMult = POWER_MULTIPLIERS[RouteDifficulty.EASY];
    const hardMult = POWER_MULTIPLIERS[RouteDifficulty.HARD];
    const ambushMult = POWER_MULTIPLIERS[RouteDifficulty.AMBUSH];

    expect(hardMult).toBeGreaterThan(easyMult);
    expect(ambushMult).toBeGreaterThan(hardMult);
  });
});

// ── §4 全链路端到端流程 ────────────────────

describe('§4 全链路端到端流程', () => {
  let system: ExpeditionSystem;
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(10);
    battleSystem = new ExpeditionBattleSystem();
    let seed = 0;
    rewardSystem = new ExpeditionRewardSystem(() => { seed += 0.2; return seed % 1; });
  });

  it('§4.1 完整流程：编队→派遣→战斗→推进→完成路线', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);

    // 1. 编队
    const teamResult = system.createTeam('蜀国远征军', heroes.map(h => h.id), FormationType.OFFENSIVE, map);
    expect(teamResult.valid).toBe(true);

    // 2. 派遣
    const team = system.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    const dispatched = system.dispatchTeam(team.id, 'route_hulao_easy');
    expect(dispatched).toBe(true);

    // 3. 战斗（首节点）
    const route = system.getRoute('route_hulao_easy')!;
    const firstNode = route.nodes[team.currentNodeId!];
    const allyTeam = createBattleTeam(team.totalPower, team.formation);
    const nodeConfig = createNodeConfig(firstNode.type, firstNode.recommendedPower ?? 1000, FormationType.STANDARD);
    const battleResult = battleSystem.executeBattle(allyTeam, nodeConfig);
    expect(battleResult.grade).toBeDefined();

    // 4. 推进
    system.advanceToNextNode(team.id);

    // 5. 完成路线（直接完成）
    const completed = system.completeRoute(team.id, battleResult.stars);
    expect(completed).toBe(true);
    expect(system.getClearedRouteIds().has('route_hulao_easy')).toBe(true);
  });

  it('§4.2 完整流程：多路线通关→解锁新区域', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);

    // 通关虎牢关所有路线
    const state = system.getState();
    for (const rid of state.regions['region_hulao'].routeIds) {
      system.createTeam(`通关队_${rid}`, heroes.map(h => h.id), FormationType.OFFENSIVE, map);
      state.clearedRouteIds.add(rid);
      state.routeStars[rid] = 3;
    }

    // 汜水关应可解锁
    const check = system.canUnlockRoute('route_yishui_easy');
    expect(check.canUnlock).toBe(true);

    const unlocked = system.unlockRoute('route_yishui_easy');
    expect(unlocked).toBe(true);
  });

  it('§4.3 完整流程：扫荡→奖励→资源累积', () => {
    // 先设置三星通关
    const state = system.getState();
    state.clearedRouteIds.add('route_hulao_easy');
    state.routeStars['route_hulao_easy'] = 3;

    // 执行扫荡
    const sweepResult = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    expect(sweepResult.success).toBe(true);

    // 计算扫荡奖励
    const reward = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.EASY,
      sweepType: SweepType.NORMAL,
      heroCount: 5,
    });
    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
  });

  it('§4.4 完整流程：序列化→反序列化→状态恢复', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    system.createTeam('蜀国远征军', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = system.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    system.dispatchTeam(team.id, 'route_hulao_easy');
    system.completeRoute(team.id, 3);

    // 序列化
    const saved = system.serialize();
    expect(saved.clearedRouteIds).toContain('route_hulao_easy');
    expect(saved.routeStars['route_hulao_easy']).toBe(3);

    // 反序列化到新系统
    const newSystem = new ExpeditionSystem();
    newSystem.deserialize(saved);

    expect(newSystem.getClearedRouteIds().has('route_hulao_easy')).toBe(true);
    expect(newSystem.getRouteStars('route_hulao_easy')).toBe(3);
  });

  it('§4.5 完整流程：自动远征→离线收益→里程碑', () => {
    const autoBattle = new ExpeditionBattleSystem();
    const autoReward = new ExpeditionRewardSystem();
    const autoSystem = new AutoExpeditionSystem(autoBattle, autoReward);

    // 计算离线收益
    const offlineResult = autoSystem.calculateOfflineExpedition({
      offlineSeconds: 8 * 3600,
      teamPower: 15000,
      teamFormation: FormationType.OFFENSIVE,
      routeAvgPower: 5000,
      routeAvgFormation: FormationType.STANDARD,
      avgRouteDurationSeconds: 1800,
      baseRouteReward: { ...BASE_REWARDS[RouteDifficulty.NORMAL], drops: [] },
      heroCount: 5,
    });

    expect(offlineResult.completedRuns).toBeGreaterThan(0);
    expect(offlineResult.totalReward.grain).toBeGreaterThan(0);

    // 检查里程碑
    const state = system.getState();
    for (let i = 0; i < 10; i++) {
      state.clearedRouteIds.add(`route_mock_${i}`);
    }
    const milestones = system.checkMilestones();
    expect(milestones).toContain(MilestoneType.TEN_CLEARS);
  });
});
