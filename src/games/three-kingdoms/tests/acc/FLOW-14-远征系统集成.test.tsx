/**
 * FLOW-14 远征系统集成测试 — 远征面板数据/派遣武将/远征事件/远征奖励/远征时间冷却/苏格拉底边界
 *
 * 使用真实 ThreeKingdomsEngine（通过 createSim()），不 mock engine。
 * 仅 mock CSS 等外部依赖。
 *
 * 覆盖范围：
 * - 远征面板数据：路线/区域/槽位/配置
 * - 派遣武将：创建队伍/派遣/推进/完成
 * - 远征事件：休息节点/宝箱/里程碑/扫荡
 * - 远征奖励：基础奖励/首通/扫荡奖励/掉落
 * - 远征时间/冷却：兵力恢复/行军时长/扫荡限制
 * - 苏格拉底边界：空队伍/超上限/未解锁/序列化/重置
 *
 * @module tests/acc/FLOW-14
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import {
  ExpeditionSystem,
  RouteDifficulty,
  NodeType,
  NodeStatus,
  ExpeditionFormationType as FormationType,
  CASTLE_LEVEL_SLOTS,
  TROOP_COST,
  MAX_HEROES_PER_TEAM,
  BASE_REWARDS,
  SweepType,
  MilestoneType,
} from '../../engine/expedition';
import type { HeroBrief } from '../../engine/expedition';
import { ExpeditionRewardSystem } from '../../engine/expedition/ExpeditionRewardSystem';
import { MARCH_DURATION } from '../../engine/expedition/expedition-config';
import type { Faction } from '../../engine/hero/hero.types';
import { BattleGrade } from '../../engine/expedition';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function createExpeditionSim(): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ grain: 500000, gold: 500000, troops: 50000 });
  return sim;
}

function createHeroBrief(id: string, faction: Faction, power: number): HeroBrief {
  return { id, faction, power };
}

function createHeroDataMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

function shuHeroes(): HeroBrief[] {
  return [
    createHeroBrief('guanyu', 'shu', 5000),
    createHeroBrief('zhangfei', 'shu', 4800),
    createHeroBrief('zhaoyun', 'shu', 5200),
    createHeroBrief('machao', 'shu', 4600),
    createHeroBrief('huangzhong', 'shu', 4400),
  ];
}

function getExpedition(sim: GameEventSimulator): ExpeditionSystem {
  return sim.engine.getExpeditionSystem();
}

function createAndDispatchTeam(exp: ExpeditionSystem, routeId?: string): { teamId: string; routeId: string } | null {
  const heroes = shuHeroes();
  const heroDataMap = createHeroDataMap(heroes);
  const result = exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
  if (!result.valid) return null;

  const teams = exp.getAllTeams();
  const teamId = teams[teams.length - 1].id;

  const routes = exp.getAllRoutes();
  const targetRoute = routeId
    ? routes.find(r => r.id === routeId)
    : routes.find(r => r.unlocked);
  if (!targetRoute) return null;

  const ok = exp.dispatchTeam(teamId, targetRoute.id);
  if (!ok) return null;

  return { teamId, routeId: targetRoute.id };
}

// ═══════════════════════════════════════════════════════════════
// FLOW-14 远征系统集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-14 远征系统集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => { vi.clearAllMocks(); sim = createExpeditionSim(); });
  afterEach(() => { vi.restoreAllMocks(); });

  // ── 1. 远征面板数据（FLOW-14-01 ~ FLOW-14-05） ──

  it(accTest('FLOW-14-01', '面板数据 — 默认路线和区域'), () => {
    const exp = getExpedition(sim);
    const routes = exp.getAllRoutes();
    const regions = Object.keys(exp.getState().regions);

    assertStrict(routes.length > 0, 'FLOW-14-01', `应有路线，实际 ${routes.length}`);
    assertStrict(regions.length >= 3, 'FLOW-14-01', `应至少有3个区域，实际 ${regions.length}`);

    // 验证区域：虎牢关、汜水关、洛阳
    assertStrict(regions.includes('region_hulao'), 'FLOW-14-01', '应有虎牢关区域');
    assertStrict(regions.includes('region_yishui'), 'FLOW-14-01', '应有汜水关区域');
    assertStrict(regions.includes('region_luoyang'), 'FLOW-14-01', '应有洛阳区域');
  });

  it(accTest('FLOW-14-02', '面板数据 — 路线难度分布（EASY/NORMAL/HARD/EPIC/AMBUSH）'), () => {
    const exp = getExpedition(sim);
    const routes = exp.getAllRoutes();

    const difficulties = new Set(routes.map(r => r.difficulty));
    assertStrict(difficulties.has(RouteDifficulty.EASY), 'FLOW-14-02', '应有简单路线');
    assertStrict(difficulties.has(RouteDifficulty.NORMAL), 'FLOW-14-02', '应有普通路线');
    assertStrict(difficulties.has(RouteDifficulty.HARD), 'FLOW-14-02', '应有困难路线');
    assertStrict(difficulties.has(RouteDifficulty.AMBUSH), 'FLOW-14-02', '应有奇袭路线');
  });

  it(accTest('FLOW-14-03', '面板数据 — 初始解锁状态'), () => {
    const exp = getExpedition(sim);
    const routes = exp.getAllRoutes();

    // FIX: 弱断言 !!hulaoEasy?.unlocked → 强断言：验证路线名称、难度、解锁状态
    const hulaoEasy = routes.find(r => r.id === 'route_hulao_easy');
    assertStrict(hulaoEasy !== undefined, 'FLOW-14-03', '虎牢关简单路线应存在');
    assertStrict(hulaoEasy!.name === '虎牢关·简', 'FLOW-14-03', `路线名称应为虎牢关·简，实际: ${hulaoEasy!.name}`);
    assertStrict(hulaoEasy!.difficulty === RouteDifficulty.EASY, 'FLOW-14-03', `难度应为EASY，实际: ${hulaoEasy!.difficulty}`);
    assertStrict(hulaoEasy!.unlocked === true, 'FLOW-14-03', '虎牢关简单路线应默认解锁');

    // FIX: 弱断言 !!yishuiEasy → 强断言：验证路线属性完整
    const yishuiEasy = routes.find(r => r.id === 'route_yishui_easy');
    assertStrict(yishuiEasy !== undefined, 'FLOW-14-03', '汜水关路线应存在');
    assertStrict(yishuiEasy!.name === '汜水关·简', 'FLOW-14-03', `路线名称应为汜水关·简，实际: ${yishuiEasy!.name}`);
    assertStrict(yishuiEasy!.difficulty === RouteDifficulty.EASY, 'FLOW-14-03', `难度应为EASY，实际: ${yishuiEasy!.difficulty}`);
    assertStrict(yishuiEasy!.unlocked === false, 'FLOW-14-03', '汜水关路线默认应未解锁');
  });

  it(accTest('FLOW-14-04', '面板数据 — 槽位与主城等级关系'), () => {
    const exp = getExpedition(sim);

    const slots1 = exp.getSlotCount(1);
    assertStrict(slots1 === 0, 'FLOW-14-04', `主城Lv1应为0槽位，实际 ${slots1}`);

    const slots5 = exp.getSlotCount(5);
    assertStrict(slots5 === 1, 'FLOW-14-04', `主城Lv5应为1槽位，实际 ${slots5}`);

    const slots10 = exp.getSlotCount(10);
    assertStrict(slots10 === 2, 'FLOW-14-04', `主城Lv10应为2槽位，实际 ${slots10}`);

    const slots20 = exp.getSlotCount(20);
    assertStrict(slots20 === 4, 'FLOW-14-04', `主城Lv20应为4槽位，实际 ${slots20}`);
  });

  it(accTest('FLOW-14-05', '面板数据 — 基础奖励按难度递增'), () => {
    const easyReward = BASE_REWARDS[RouteDifficulty.EASY];
    const normalReward = BASE_REWARDS[RouteDifficulty.NORMAL];
    const hardReward = BASE_REWARDS[RouteDifficulty.HARD];

    assertStrict(normalReward.gold > easyReward.gold, 'FLOW-14-05', '普通铜钱应>简单');
    assertStrict(hardReward.gold > normalReward.gold, 'FLOW-14-05', '困难铜钱应>普通');
    assertStrict(hardReward.exp > normalReward.exp, 'FLOW-14-05', '困难经验应>普通');
  });

  // ── 2. 派遣武将（FLOW-14-06 ~ FLOW-14-10） ──

  it(accTest('FLOW-14-06', '派遣武将 — 创建队伍成功'), () => {
    const exp = getExpedition(sim);
    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);

    const result = exp.createTeam('蜀国精锐', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
    assertStrict(result.valid, 'FLOW-14-06', `队伍创建应成功: ${result.errors.join(', ')}`);
    // FIX: 弱断言 result.totalPower > 0 → 强断言：验证战力在合理范围内（含阵型和羁绊加成）
    const heroPowerSum = heroes.reduce((sum, h) => sum + h.power, 0);
    assertStrict(result.totalPower >= heroPowerSum, 'FLOW-14-06',
      `战力应>=武将战力之和${heroPowerSum}（含加成），实际: ${result.totalPower}`);
    assertStrict(result.totalPower <= heroPowerSum * 1.5, 'FLOW-14-06',
      `战力应<=武将战力之和*1.5=${Math.round(heroPowerSum * 1.5)}（加成上限），实际: ${result.totalPower}`);

    const teams = exp.getAllTeams();
    assertStrict(teams.length === 1, 'FLOW-14-06', `应有1支队伍，实际: ${teams.length}`);
  });

  it(accTest('FLOW-14-07', '派遣武将 — 派遣到已解锁路线'), () => {
    const exp = getExpedition(sim);
    const dispatched = createAndDispatchTeam(exp);

    // FIX: 弱断言 !!dispatched → 强断言：验证返回值包含有效 teamId 和 routeId
    assertStrict(dispatched !== null, 'FLOW-14-07', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-07', `teamId 应非空字符串，实际: "${dispatched!.teamId}"`);
    assertStrict(dispatched!.routeId.startsWith('route_'), 'FLOW-14-07', `routeId 应以 route_ 开头，实际: "${dispatched!.routeId}"`);
    const team = exp.getTeam(dispatched!.teamId);
    assertStrict(team!.isExpeditioning, 'FLOW-14-07', '队伍应处于远征中');
    assertStrict(team!.currentRouteId === dispatched!.routeId, 'FLOW-14-07', '路线ID应匹配');
  });

  it(accTest('FLOW-14-08', '派遣武将 — 未解锁路线派遣失败'), () => {
    const exp = getExpedition(sim);
    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);
    exp.createTeam('蜀国精锐', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);

    const teams = exp.getAllTeams();
    const teamId = teams[teams.length - 1].id;

    const ok = exp.dispatchTeam(teamId, 'route_yishui_easy');
    assertStrict(!ok, 'FLOW-14-08', '未解锁路线派遣应失败');
  });

  it(accTest('FLOW-14-09', '派遣武将 — 兵力不足派遣失败'), () => {
    const exp = getExpedition(sim);
    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);
    exp.createTeam('蜀国精锐', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);

    const teams = exp.getAllTeams();
    const teamId = teams[teams.length - 1].id;

    // 消耗所有兵力
    exp.getState().teams[teamId].troopCount = 0;

    const routes = exp.getAllRoutes();
    const unlockedRoute = routes.find(r => r.unlocked);
    // FIX: 弱断言 !!unlockedRoute → 强断言：验证已解锁路线的属性
    assertStrict(unlockedRoute !== undefined, 'FLOW-14-09', '应有已解锁路线');
    assertStrict(unlockedRoute!.unlocked === true, 'FLOW-14-09', '路线应标记为已解锁');
    assertStrict(unlockedRoute!.id.startsWith('route_'), 'FLOW-14-09', `路线ID格式应正确，实际: ${unlockedRoute!.id}`);

    const ok = exp.dispatchTeam(teamId, unlockedRoute!.id);
    assertStrict(!ok, 'FLOW-14-09', '兵力不足应派遣失败');
  });

  it(accTest('FLOW-14-10', '派遣武将 — 不存在的队伍/路线返回false'), () => {
    const exp = getExpedition(sim);
    assertStrict(!exp.dispatchTeam('nonexistent', 'route_hulao_easy'), 'FLOW-14-10', '不存在队伍应返回false');
    assertStrict(!exp.dispatchTeam('some_team', 'nonexistent_route'), 'FLOW-14-10', '不存在路线应返回false');
  });

  // ── 3. 远征事件（FLOW-14-11 ~ FLOW-14-15） ──

  it(accTest('FLOW-14-11', '远征事件 — 推进到下一节点'), () => {
    const exp = getExpedition(sim);
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-11', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-11', 'teamId 应非空');

    const nextNodeId = exp.advanceToNextNode(dispatched!.teamId, 0);
    // FIX: 弱断言 !!nextNodeId → 强断言：验证节点ID格式（route_xxx_n 格式）
    assertStrict(nextNodeId !== null, 'FLOW-14-11', '推进应返回下一节点ID');
    assertStrict(typeof nextNodeId === 'string' && nextNodeId.length > 0, 'FLOW-14-11',
      `节点ID应为非空字符串，实际: ${nextNodeId}`);
    assertStrict(nextNodeId!.includes('_n'), 'FLOW-14-11',
      `节点ID应包含 _n 序列号，实际: ${nextNodeId}`);

    const team = exp.getTeam(dispatched!.teamId);
    assertStrict(team!.currentNodeId === nextNodeId, 'FLOW-14-11', '队伍当前节点应更新');
  });

  it(accTest('FLOW-14-12', '远征事件 — 休息节点恢复兵力'), () => {
    const exp = getExpedition(sim);
    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);
    exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
    const teams = exp.getAllTeams();
    const teamId = teams[teams.length - 1].id;

    const routes = exp.getAllRoutes();
    const unlockedRoute = routes.find(r => r.unlocked);
    // FIX: 弱断言 !!unlockedRoute → 强断言：验证路线存在且已解锁
    assertStrict(unlockedRoute !== undefined, 'FLOW-14-12', '应有已解锁路线');
    assertStrict(unlockedRoute!.unlocked === true, 'FLOW-14-12', '路线应标记为已解锁');

    exp.dispatchTeam(teamId, unlockedRoute!.id);

    // 查找休息节点
    const route = exp.getState().routes[unlockedRoute!.id];
    let restNodeId: string | null = null;
    for (const [nodeId, node] of Object.entries(route.nodes)) {
      if (node.type === NodeType.REST) { restNodeId = nodeId; break; }
    }

    if (restNodeId) {
      // 手动将队伍放到休息节点
      exp.getState().teams[teamId].currentNodeId = restNodeId;
      exp.getState().teams[teamId].troopCount = 100;

      const result = exp.processNodeEffect(teamId);
      assertStrict(result.healed, 'FLOW-14-12', '休息节点应恢复兵力');
      // FIX: 弱断言 result.healAmount > 0 → 强断言：验证恢复量为 maxTroops 的20%（REST_HEAL_PERCENT）
      const expectedHeal = Math.floor(exp.getTeam(teamId)!.maxTroops * 0.20);
      assertStrict(result.healAmount === expectedHeal, 'FLOW-14-12',
        `恢复量应为${expectedHeal}（maxTroops*20%），实际: ${result.healAmount}`);
    } else {
      // 无休息节点时，验证非休息节点不恢复
      const result = exp.processNodeEffect(teamId);
      assertStrict(!result.healed, 'FLOW-14-12', '非休息节点不应恢复兵力');
    }
  });

  it(accTest('FLOW-14-13', '远征事件 — 完成路线记录通关和星级'), () => {
    const exp = getExpedition(sim);
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-13', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-13', 'teamId 应非空');
    assertStrict(dispatched!.routeId.length > 0, 'FLOW-14-13', 'routeId 应非空');

    const ok = exp.completeRoute(dispatched!.teamId, 3);
    assertStrict(ok, 'FLOW-14-13', '完成路线应成功');

    const clearedIds = exp.getClearedRouteIds();
    assertStrict(clearedIds.has(dispatched!.routeId), 'FLOW-14-13', '路线应标记为已通关');

    const stars = exp.getRouteStars(dispatched!.routeId);
    assertStrict(stars === 3, 'FLOW-14-13', `星级应为3，实际: ${stars}`);

    // 队伍回到空闲
    const team = exp.getTeam(dispatched!.teamId);
    assertStrict(!team!.isExpeditioning, 'FLOW-14-13', '队伍应回到空闲');
    assertStrict(team!.currentRouteId === null, 'FLOW-14-13', '路线应清空');
  });

  it(accTest('FLOW-14-14', '远征事件 — 完成路线后兵力恢复到满'), () => {
    const exp = getExpedition(sim);
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-14', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-14', 'teamId 应非空');

    // 模拟战斗消耗
    exp.getState().teams[dispatched!.teamId].troopCount = 50;

    exp.completeRoute(dispatched!.teamId, 2);

    const team = exp.getTeam(dispatched!.teamId);
    assertStrict(team!.troopCount === team!.maxTroops, 'FLOW-14-14', `兵力应恢复到满(${team!.maxTroops})，实际: ${team!.troopCount}`);
  });

  it(accTest('FLOW-14-15', '远征事件 — 里程碑检查'), () => {
    const exp = getExpedition(sim);
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-15', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-15', 'teamId 应非空');

    exp.completeRoute(dispatched!.teamId, 3);

    const milestones = exp.checkMilestones();
    // FIX: 弱断言 milestones.length > 0 → 强断言：验证里程碑数量和内容
    assertStrict(milestones.length > 0, 'FLOW-14-15', `通关后应有里程碑，实际: ${milestones.length}`);
    assertStrict(milestones.includes(MilestoneType.FIRST_CLEAR), 'FLOW-14-15', '应包含"初出茅庐"里程碑');
    assertStrict(milestones.every(m => Object.values(MilestoneType).includes(m)), 'FLOW-14-15',
      `所有里程碑应为合法枚举值，实际: ${milestones.join(',')}`);
  });

  // ── 4. 远征奖励（FLOW-14-16 ~ FLOW-14-20） ──

  it(accTest('FLOW-14-16', '远征奖励 — 基础奖励按难度计算'), () => {
    const rewardSystem = new ExpeditionRewardSystem(() => 0.5); // 固定随机数

    const easyReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.EASY,
      nodeType: NodeType.BANDIT,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    // FIX: 弱断言 easyReward.gold > 0 → 强断言：验证奖励 = BASE_REWARDS[difficulty].gold * nodeMultiplier * gradeMultiplier
    // EASY + BANDIT(0.3) + MINOR_VICTORY(1.0) = 400 * 0.3 * 1.0 = 120
    const expectedEasyGold = Math.round(BASE_REWARDS[RouteDifficulty.EASY].gold * 0.3 * 1.0);
    assertStrict(easyReward.gold === expectedEasyGold, 'FLOW-14-16',
      `简单山贼小胜铜钱应为${expectedEasyGold}，实际: ${easyReward.gold}`);
    const expectedEasyExp = Math.round(BASE_REWARDS[RouteDifficulty.EASY].exp * 0.3 * 1.0);
    assertStrict(easyReward.exp === expectedEasyExp, 'FLOW-14-16',
      `简单山贼小胜经验应为${expectedEasyExp}，实际: ${easyReward.exp}`);

    const hardReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.HARD,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    assertStrict(hardReward.gold > easyReward.gold, 'FLOW-14-16', '困难BOSS奖励应>简单山贼');
  });

  it(accTest('FLOW-14-17', '远征奖励 — 首通额外奖励'), () => {
    const rewardSystem = new ExpeditionRewardSystem(() => 0.5);

    const normalReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: true,
    });

    const firstClearReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: true,
      isRouteComplete: true,
    });

    // 首通应有额外掉落
    assertStrict(firstClearReward.drops.length > normalReward.drops.length, 'FLOW-14-17',
      '首通应有额外掉落物品');
  });

  it(accTest('FLOW-14-18', '远征奖励 — 扫荡奖励计算'), () => {
    const rewardSystem = new ExpeditionRewardSystem(() => 0.5);

    const normalSweep = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.NORMAL,
      heroCount: 5,
    });
    assertStrict(normalSweep.gold > 0, 'FLOW-14-18', '普通扫荡应有铜钱');

    const advSweep = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.ADVANCED,
      heroCount: 5,
    });
    assertStrict(advSweep.gold > normalSweep.gold, 'FLOW-14-18', '高级扫荡奖励应>普通');
  });

  it(accTest('FLOW-14-19', '远征奖励 — 里程碑奖励'), () => {
    const rewardSystem = new ExpeditionRewardSystem();

    // FIX: 弱断言 !!firstClear → 强断言：验证里程碑奖励包含具体字段
    const firstClear = rewardSystem.getMilestoneReward(MilestoneType.FIRST_CLEAR);
    assertStrict(firstClear !== null, 'FLOW-14-19', '初出茅庐应有奖励');
    assertStrict(firstClear!.gold === 1000, 'FLOW-14-19', `初出茅庐铜钱应为1000，实际: ${firstClear!.gold}`);

    const tenClears = rewardSystem.getMilestoneReward(MilestoneType.TEN_CLEARS);
    assertStrict(tenClears !== null, 'FLOW-14-19', '百战之师应有奖励');
    // 百战之师奖励配置中 gold=0，验证其他字段结构完整
    assertStrict(typeof tenClears!.gold === 'number', 'FLOW-14-19', '百战之师奖励应有 gold 字段');
    assertStrict(Array.isArray(tenClears!.drops), 'FLOW-14-19', '百战之师奖励应有 drops 数组');
  });

  it(accTest('FLOW-14-20', '远征奖励 — 评级影响奖励倍率'), () => {
    const rewardSystem = new ExpeditionRewardSystem(() => 0.5);

    const great = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL, nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY, isFirstClear: false, isRouteComplete: false,
    });
    const pyrrhic = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL, nodeType: NodeType.BOSS,
      grade: BattleGrade.PYRRHIC_VICTORY, isFirstClear: false, isRouteComplete: false,
    });

    assertStrict(great.gold > pyrrhic.gold, 'FLOW-14-20',
      `大捷奖励(${great.gold})应>惨胜(${pyrrhic.gold})`);
  });

  // ── 5. 远征时间/冷却（FLOW-14-21 ~ FLOW-14-25） ──

  it(accTest('FLOW-14-21', '时间/冷却 — 兵力恢复随时间增加'), () => {
    const exp = getExpedition(sim);
    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);
    exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
    const teams = exp.getAllTeams();
    const teamId = teams[teams.length - 1].id;

    exp.getState().teams[teamId].troopCount = 100;
    const before = exp.getTeam(teamId)!.troopCount;

    exp.recoverTroops(TROOP_COST.recoveryIntervalSeconds * 5);
    const after = exp.getTeam(teamId)!.troopCount;
    // FIX: 弱断言 after > before → 强断言：验证恢复量 = 5 * recoveryAmount = 5
    const expectedRecovery = 5 * TROOP_COST.recoveryAmount;
    assertStrict(after === before + expectedRecovery, 'FLOW-14-21',
      `兵力应增加${expectedRecovery}（5次恢复），实际: ${before} → ${after}`);
  });

  it(accTest('FLOW-14-22', '时间/冷却 — 兵力恢复不超过上限'), () => {
    const exp = getExpedition(sim);
    const heroes = shuHeroes();
    const heroDataMap = createHeroDataMap(heroes);
    exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
    const teams = exp.getAllTeams();
    const teamId = teams[teams.length - 1].id;

    const maxTroops = exp.getTeam(teamId)!.maxTroops;
    exp.recoverTroops(TROOP_COST.recoveryIntervalSeconds * 10000);
    assertStrict(exp.getTeam(teamId)!.troopCount <= maxTroops, 'FLOW-14-22',
      `兵力不应超过上限(${maxTroops})，实际: ${exp.getTeam(teamId)!.troopCount}`);
  });

  it(accTest('FLOW-14-23', '时间/冷却 — 扫荡次数限制'), () => {
    const exp = getExpedition(sim);

    // 先三星通关
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-23', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-23', 'teamId 应非空');
    exp.completeRoute(dispatched!.teamId, 3);

    // 普通扫荡每日5次
    for (let i = 0; i < 5; i++) {
      const r = exp.executeSweep(dispatched!.routeId, SweepType.NORMAL);
      assertStrict(r.success, 'FLOW-14-23', `第${i + 1}次扫荡应成功`);
    }

    // 第6次应失败
    const result = exp.executeSweep(dispatched!.routeId, SweepType.NORMAL);
    assertStrict(!result.success, 'FLOW-14-23', '超过每日次数应失败');
    assertStrict(result.reason.includes('次数'), 'FLOW-14-23', `原因应包含次数: ${result.reason}`);
  });

  it(accTest('FLOW-14-24', '时间/冷却 — 未三星不能扫荡'), () => {
    const exp = getExpedition(sim);

    const canSweep = exp.canSweepRoute('route_hulao_easy');
    assertStrict(!canSweep, 'FLOW-14-24', '未通关路线不应能扫荡');
  });

  it(accTest('FLOW-14-25', '时间/冷却 — 行军时长按难度递增'), () => {
    assertStrict(
      MARCH_DURATION[RouteDifficulty.HARD].min > MARCH_DURATION[RouteDifficulty.NORMAL].min,
      'FLOW-14-25',
      '困难行军时长应>普通',
    );
    assertStrict(
      MARCH_DURATION[RouteDifficulty.EPIC].min > MARCH_DURATION[RouteDifficulty.HARD].min,
      'FLOW-14-25',
      '史诗行军时长应>困难',
    );
  });

  // ── 6. 苏格拉底边界（FLOW-14-26 ~ FLOW-14-30） ──

  it(accTest('FLOW-14-26', '边界 — 空队伍校验失败'), () => {
    const exp = getExpedition(sim);
    const result = exp.createTeam('空队伍', [], FormationType.STANDARD, {});
    assertStrict(!result.valid, 'FLOW-14-26', '空队伍应校验失败');
    // FIX: 弱断言 result.errors.length > 0 → 强断言：验证错误消息包含关键词
    assertStrict(result.errors.length > 0, 'FLOW-14-26', '应有错误信息');
    assertStrict(result.errors.some(e => e.includes('武将') || e.includes('英雄') || e.includes('hero') || e.includes('空')),
      'FLOW-14-26', `错误信息应包含武将/空相关提示，实际: ${result.errors.join('; ')}`);
  });

  it(accTest('FLOW-14-27', '边界 — 超过最大武将数校验失败'), () => {
    const exp = getExpedition(sim);
    const tooMany = Array.from({ length: MAX_HEROES_PER_TEAM + 2 }, (_, i) =>
      createHeroBrief(`hero_${i}`, 'shu', 3000 + i * 100)
    );
    const heroDataMap = createHeroDataMap(tooMany);

    const result = exp.createTeam('超员队伍', tooMany.map(h => h.id), FormationType.STANDARD, heroDataMap);
    assertStrict(!result.valid, 'FLOW-14-27', '超过最大武将数应校验失败');
  });

  it(accTest('FLOW-14-28', '边界 — 序列化/反序列化保持通关记录'), () => {
    const exp = getExpedition(sim);
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-28', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-28', 'teamId 应非空');
    assertStrict(dispatched!.routeId.length > 0, 'FLOW-14-28', 'routeId 应非空');
    exp.completeRoute(dispatched!.teamId, 3);

    const saved = exp.serialize();
    assertStrict(saved.clearedRouteIds.includes(dispatched!.routeId), 'FLOW-14-28', '通关路线应在序列化数据中');

    const exp2 = new ExpeditionSystem();
    exp2.deserialize(saved);

    const cleared2 = exp2.getClearedRouteIds();
    assertStrict(cleared2.has(dispatched!.routeId), 'FLOW-14-28', '反序列化后应保留通关记录');
    assertStrict(exp2.getRouteStars(dispatched!.routeId) === 3, 'FLOW-14-28', '反序列化后星级应为3');
  });

  it(accTest('FLOW-14-29', '边界 — 重置清空所有远征状态'), () => {
    const exp = getExpedition(sim);
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-29', '派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-29', 'teamId 应非空');
    exp.completeRoute(dispatched!.teamId, 3);

    exp.reset();

    const state = exp.getState();
    assertStrict(state.clearedRouteIds.size === 0, 'FLOW-14-29', '重置后通关记录应清空');
    assertStrict(Object.keys(state.teams).length === 0, 'FLOW-14-29', '重置后队伍应清空');
    // FIX: 补充强断言 — 验证星级和里程碑也被清空
    assertStrict(Object.keys(state.routeStars).length === 0, 'FLOW-14-29',
      `重置后星级记录应清空，实际: ${Object.keys(state.routeStars).length}`);
    assertStrict(state.achievedMilestones.size === 0, 'FLOW-14-29',
      `重置后里程碑应清空，实际: ${state.achievedMilestones.size}`);
  });

  it(accTest('FLOW-14-30', '边界 — 槽位满时派遣失败'), () => {
    const exp = getExpedition(sim);
    exp.updateSlots(5); // 1个槽位

    // 创建并派遣第一支队伍
    const dispatched = createAndDispatchTeam(exp);
    // FIX: 弱断言 !!dispatched → 强断言：验证派遣返回值
    assertStrict(dispatched !== null, 'FLOW-14-30', '第一支队伍派遣应成功');
    assertStrict(dispatched!.teamId.length > 0, 'FLOW-14-30', 'teamId 应非空');

    // 创建第二支队伍
    const heroes2 = [
      createHeroBrief('caocao', 'wei', 5500),
      createHeroBrief('xuchu', 'wei', 4500),
      createHeroBrief('dianwei', 'wei', 4700),
    ];
    const heroDataMap2 = createHeroDataMap(heroes2);
    exp.createTeam('队伍2', heroes2.map(h => h.id), FormationType.OFFENSIVE, heroDataMap2);
    const teams = exp.getAllTeams();
    const teamId2 = teams[teams.length - 1].id;

    // 尝试派遣第二支（应失败，槽位已满）
    const routes = exp.getAllRoutes();
    const unlockedRoutes = routes.filter(r => r.unlocked);
    const targetRoute = unlockedRoutes.find(r => r.id !== dispatched!.routeId) || unlockedRoutes[0];
    const ok = exp.dispatchTeam(teamId2, targetRoute.id);
    assertStrict(!ok, 'FLOW-14-30', '超过槽位限制应派遣失败');
  });
});
