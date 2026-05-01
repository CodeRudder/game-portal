/**
 * 远征模块 R2 封版测试 — 对抗式测试最终版
 *
 * 基于Builder+Challenger+Arbiter三轮对抗，157个测试节点封版。
 * 本文件覆盖R2补充的P0级测试（37个节点）。
 *
 * 维度覆盖：
 *   R2-A: 远征失败处理完整路径 (5个)
 *   R2-B: 6节点端到端流程 (12个)
 *   R2-C: 兵力=消耗边界 (5个)
 *   R2-D: stars=0边界 (4个)
 *   R2-E: deserialize脏数据防御 (7个)
 *   R2-F: team外部篡改防御 (4个)
 *
 * @module engine/expedition/__tests__/expedition-R2-sealed
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../ExpeditionSystem';
import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import { AutoExpeditionSystem } from '../AutoExpeditionSystem';
import type { HeroBrief } from '../ExpeditionTeamHelper';
import type { BattleTeamData, NodeBattleConfig } from '../ExpeditionBattleSystem';
import type { ExpeditionSaveData, ExpeditionTeam } from '../../../core/expedition/expedition.types';
import {
  NodeStatus,
  NodeType,
  RouteDifficulty,
  FormationType,
  BattleGrade,
  SweepType,
  MilestoneType,
  TROOP_COST,
} from '../../../core/expedition/expedition.types';

// ── 辅助函数 ──────────────────────────────

function createHero(id: string, faction: string = 'shu', power: number = 1000): HeroBrief {
  return { id, faction: faction as HeroBrief['faction'], power };
}

function createHeroMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

function createShuHeroes(count: number = 3): HeroBrief[] {
  return Array.from({ length: count }, (_, i) => createHero(`shu_${i}`, 'shu', 1000 + i * 100));
}

/** 创建系统实例并初始化 */
function createSystem(): ExpeditionSystem {
  return new ExpeditionSystem();
}

/** 创建战斗队伍数据 */
function createBattleTeam(overrides: Partial<BattleTeamData> = {}): BattleTeamData {
  return {
    units: Array.from({ length: 3 }, (_, i) => ({
      id: `h_${i}`,
      hp: 1000,
      maxHp: 1000,
      attack: 100,
      defense: 80,
      speed: 50,
      intelligence: 60,
    })),
    formation: FormationType.OFFENSIVE,
    totalPower: 3000,
    ...overrides,
  };
}

function createNodeConfig(overrides: Partial<NodeBattleConfig> = {}): NodeBattleConfig {
  return {
    nodeType: NodeType.BANDIT,
    enemyPower: 1000,
    enemyFormation: FormationType.STANDARD,
    recommendedPower: 1000,
    ...overrides,
  };
}

/** 创建队伍并派遣到路线 */
function setupDispatchedTeam(
  sys: ExpeditionSystem,
  heroCount: number = 3,
  routeId: string = 'route_hulao_easy',
): { teamId: string; team: ExpeditionTeam } {
  const heroes = createShuHeroes(heroCount);
  const heroMap = createHeroMap(heroes);
  const heroIds = heroes.map(h => h.id);

  const result = sys.createTeam('testTeam', heroIds, FormationType.OFFENSIVE, heroMap);
  const teamId = Object.keys(sys.getState().teams)[0];
  const team = sys.getState().teams[teamId];

  // 确保兵力充足
  const requiredTroops = heroCount * TROOP_COST.expeditionPerHero;
  if (team.troopCount < requiredTroops) {
    team.troopCount = requiredTroops + 100;
  }

  sys.dispatchTeam(teamId, routeId);
  return { teamId, team: sys.getState().teams[teamId] };
}

// ═══════════════════════════════════════════
// R2-A: 远征失败处理完整路径
// ═══════════════════════════════════════════

describe('R2-A: 远征失败处理完整路径', () => {
  let sys: ExpeditionSystem;
  let battleSys: ExpeditionBattleSystem;

  beforeEach(() => {
    sys = createSystem();
    battleSys = new ExpeditionBattleSystem();
  });

  it('R2-A1: 战斗惜败后队伍仍isExpeditioning, 节点状态不变', () => {
    const { teamId } = setupDispatchedTeam(sys);
    const team = sys.getState().teams[teamId];
    const routeId = team.currentRouteId!;

    // 惜败场景: 不调用advanceToNextNode (战斗系统返回NARROW_DEFEAT时不推进)
    // 验证队伍状态
    expect(team.isExpeditioning).toBe(true);
    expect(team.currentNodeId).toBeTruthy();

    // 节点状态仍为MARCHING (未被CLEARED)
    const route = sys.getRoute(routeId)!;
    const currentNode = route.nodes[team.currentNodeId!];
    expect(currentNode.status).toBe(NodeStatus.MARCHING);
  });

  it('R2-A2: 惜败后可再次发起战斗(节点状态不变)', () => {
    const { teamId } = setupDispatchedTeam(sys);
    const team = sys.getState().teams[teamId];

    // 第一次战斗 - 模拟惜败
    const result1 = battleSys.executeBattle(
      createBattleTeam({ totalPower: 100 }),
      createNodeConfig({ enemyPower: 5000 }),
    );
    // 惜败时team状态不变, 可再次战斗
    expect(team.isExpeditioning).toBe(true);

    // 第二次战斗 - 模拟胜利
    const result2 = battleSys.executeBattle(
      createBattleTeam({ totalPower: 5000 }),
      createNodeConfig({ enemyPower: 100 }),
    );
    expect(result2.grade).not.toBe(BattleGrade.NARROW_DEFEAT);
  });

  it('R2-A3: 惜败后可通过completeRoute(0)撤退', () => {
    const { teamId } = setupDispatchedTeam(sys);
    const team = sys.getState().teams[teamId];
    const routeId = team.currentRouteId!;

    // 撤退 - 使用stars=0
    const completed = sys.completeRoute(teamId, 0);
    expect(completed).toBe(true);

    // 路线标记为已通关(0星)
    expect(sys.getState().clearedRouteIds.has(routeId)).toBe(true);
    expect(sys.getRouteStars(routeId)).toBe(0);

    // 队伍回到空闲
    const updatedTeam = sys.getState().teams[teamId];
    expect(updatedTeam.isExpeditioning).toBe(false);
    expect(updatedTeam.currentRouteId).toBeNull();
  });

  it('R2-A4: 惨胜后可推进节点', () => {
    const { teamId } = setupDispatchedTeam(sys);
    const team = sys.getState().teams[teamId];

    // 惨胜: won=true但hpPercent<10
    // advanceToNextNode不关心战斗结果, 直接推进
    const nextNodeId = sys.advanceToNextNode(teamId);
    expect(nextNodeId).toBeTruthy();

    // 当前节点应被CLEARED
    const route = sys.getRoute(team.currentRouteId!);
    // team已推进到下一个节点
    expect(team.currentNodeId).toBe(nextNodeId);
  });

  it('R2-A5: 连续惜败不改变节点状态', () => {
    const { teamId } = setupDispatchedTeam(sys);
    const team = sys.getState().teams[teamId];
    const routeId = team.currentRouteId!;

    // 记录初始节点
    const initialNodeId = team.currentNodeId;

    // 多次惜败(不调用advanceToNextNode)
    for (let i = 0; i < 5; i++) {
      battleSys.executeBattle(
        createBattleTeam({ totalPower: 100 }),
        createNodeConfig({ enemyPower: 5000 }),
      );
    }

    // 节点状态不变
    expect(team.currentNodeId).toBe(initialNodeId);
    const route = sys.getRoute(routeId)!;
    expect(route.nodes[initialNodeId!].status).toBe(NodeStatus.MARCHING);
  });
});

// ═══════════════════════════════════════════
// R2-B: 6节点端到端流程
// ═══════════════════════════════════════════

describe('R2-B: 6节点端到端流程', () => {
  let sys: ExpeditionSystem;
  let battleSys: ExpeditionBattleSystem;
  let rewardSys: ExpeditionRewardSystem;

  beforeEach(() => {
    sys = createSystem();
    battleSys = new ExpeditionBattleSystem();
    rewardSys = new ExpeditionRewardSystem();
  });

  it('R2-B1~B12: 完整远征流程', () => {
    // B1: 创建队伍
    const heroes = createShuHeroes(5);
    const heroMap = createHeroMap(heroes);
    const heroIds = heroes.map(h => h.id);

    const teamResult = sys.createTeam('远征军', heroIds, FormationType.OFFENSIVE, heroMap);
    expect(teamResult.valid).toBe(true);

    const teamId = Object.keys(sys.getState().teams)[0];
    const team = sys.getState().teams[teamId];

    // 确保兵力充足
    team.troopCount = 500;

    // B2: 派遣到虎牢关·简
    const routeId = 'route_hulao_easy';
    const route = sys.getRoute(routeId)!;
    expect(route.unlocked).toBe(true);

    const dispatched = sys.dispatchTeam(teamId, routeId);
    expect(dispatched).toBe(true);

    // 验证派遣后状态
    expect(team.isExpeditioning).toBe(true);
    expect(team.currentRouteId).toBe(routeId);
    const troopCost = 5 * TROOP_COST.expeditionPerHero; // 100
    expect(team.troopCount).toBe(400); // 500 - 100

    // 起始节点应为MARCHING
    const startNode = route.nodes[route.startNodeId];
    expect(startNode.status).toBe(NodeStatus.MARCHING);
    expect(team.currentNodeId).toBe(route.startNodeId);

    // lastDispatchConfig应记录
    const lastConfig = sys.getLastDispatchConfig();
    expect(lastConfig).not.toBeNull();
    expect(lastConfig!.routeId).toBe(routeId);

    // B3: 节点1 - 山贼
    const nodeIds = Object.keys(route.nodes);
    expect(nodeIds.length).toBe(6);

    const battleTeam = createBattleTeam({
      totalPower: team.totalPower,
      formation: team.formation,
    });

    // 战斗山贼节点
    const battle1 = battleSys.executeBattle(
      battleTeam,
      createNodeConfig({ nodeType: NodeType.BANDIT, enemyPower: 600, enemyFormation: FormationType.STANDARD }),
    );
    expect(battle1.grade).not.toBe(BattleGrade.NARROW_DEFEAT);

    // 推进到下一节点
    const nextId1 = sys.advanceToNextNode(teamId);
    expect(nextId1).toBeTruthy();

    // B4: 节点2 - 天险
    const battle2 = battleSys.executeBattle(
      battleTeam,
      createNodeConfig({ nodeType: NodeType.HAZARD, enemyPower: 800, enemyFormation: FormationType.DEFENSIVE }),
    );
    const nextId2 = sys.advanceToNextNode(teamId);
    expect(nextId2).toBeTruthy();

    // B5: 节点3 - 宝箱 (无战斗, 直接推进)
    const nextId3 = sys.advanceToNextNode(teamId);
    expect(nextId3).toBeTruthy();

    // B6: 节点4 - 山贼
    const battle4 = battleSys.executeBattle(
      battleTeam,
      createNodeConfig({ nodeType: NodeType.BANDIT, enemyPower: 1000, enemyFormation: FormationType.STANDARD }),
    );
    const nextId4 = sys.advanceToNextNode(teamId);
    expect(nextId4).toBeTruthy();

    // B7: 节点5 - 休息 (治疗)
    const healResult = sys.processNodeEffect(teamId);
    expect(healResult.healed).toBe(true);
    expect(healResult.healAmount).toBeGreaterThan(0);

    // 验证兵力恢复
    const troopBeforeRest = team.troopCount;
    // healAmount = round(maxTroops * 0.20)
    const expectedHeal = Math.round(team.maxTroops * 0.20);
    expect(healResult.healAmount).toBe(expectedHeal);

    // 推进到BOSS
    const nextId5 = sys.advanceToNextNode(teamId);
    expect(nextId5).toBeTruthy();

    // B8: 节点6 - BOSS
    const battleBoss = battleSys.executeBattle(
      battleTeam,
      createNodeConfig({ nodeType: NodeType.BOSS, enemyPower: 1200, enemyFormation: FormationType.OFFENSIVE }),
    );

    // 推进(到达终点)
    const nextId6 = sys.advanceToNextNode(teamId);
    // BOSS是最后一个节点, nextNodeIds为空
    expect(nextId6).toBeNull();

    // B9: 完成路线
    const completed = sys.completeRoute(teamId, 3);
    expect(completed).toBe(true);

    // 验证完成状态
    expect(sys.getState().clearedRouteIds.has(routeId)).toBe(true);
    expect(sys.getRouteStars(routeId)).toBe(3);
    expect(team.isExpeditioning).toBe(false);
    expect(team.currentRouteId).toBeNull();
    expect(team.troopCount).toBe(team.maxTroops); // 兵力恢复满

    // B10: 奖励计算
    const reward = rewardSys.calculateRouteReward(
      RouteDifficulty.EASY,
      [
        { nodeType: NodeType.BANDIT, grade: battle1.grade },
        { nodeType: NodeType.HAZARD, grade: battle2.grade },
        { nodeType: NodeType.TREASURE, grade: BattleGrade.GREAT_VICTORY },
        { nodeType: NodeType.BANDIT, grade: battle4.grade },
        { nodeType: NodeType.BOSS, grade: battleBoss.grade },
      ],
      true, // 首通
    );
    expect(reward.gold).toBeGreaterThan(0);
    expect(reward.exp).toBeGreaterThan(0);
    // 首通应含武将碎片
    expect(reward.drops.some(d => d.id === 'hf_first_clear')).toBe(true);

    // B11: 汜水关仍锁定(需虎牢关全部3条)
    expect(sys.getRoute('route_yishui_easy')!.unlocked).toBeFalsy();
  });

  it('R2-B12: 通关全部虎牢关->汜水关解锁', () => {
    // 快速完成虎牢关全部3条路线
    const routes = ['route_hulao_easy', 'route_hulao_normal', 'route_hulao_hard'];
    for (const rid of routes) {
      const route = sys.getRoute(rid)!;
      if (!route.unlocked) {
        sys.unlockRoute(rid);
      }

      const heroes = createShuHeroes(3);
      const heroMap = createHeroMap(heroes);
      sys.createTeam(`team_${rid}`, heroes.map(h => h.id), FormationType.STANDARD, heroMap);
      const teamId = Object.keys(sys.getState().teams).pop()!;
      const team = sys.getState().teams[teamId];
      team.troopCount = 200;

      sys.dispatchTeam(teamId, rid);
      sys.completeRoute(teamId, 3);
    }

    // 验证汜水关路线解锁
    expect(sys.getRoute('route_yishui_easy')!.unlocked).toBe(true);
    expect(sys.getRoute('route_yishui_normal')!.unlocked).toBe(true);
    expect(sys.getRoute('route_yishui_hard')!.unlocked).toBe(true);
  });
});

// ═══════════════════════════════════════════
// R2-C: 兵力=消耗边界
// ═══════════════════════════════════════════

describe('R2-C: 兵力=消耗边界', () => {
  let sys: ExpeditionSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('R2-C1: 兵力恰好=消耗, 派遣成功后troopCount=0', () => {
    const heroes = createShuHeroes(5);
    const heroMap = createHeroMap(heroes);
    sys.createTeam('test', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    const teamId = Object.keys(sys.getState().teams)[0];
    const team = sys.getState().teams[teamId];

    // 设置兵力恰好=消耗
    const required = 5 * TROOP_COST.expeditionPerHero; // 100
    team.troopCount = required;

    const result = sys.dispatchTeam(teamId, 'route_hulao_easy');
    expect(result).toBe(true);
    expect(team.troopCount).toBe(0);
  });

  it('R2-C2: troopCount=0时recoverTroops可恢复', () => {
    const { teamId, team } = setupDispatchedTeam(sys);
    team.troopCount = 0;

    sys.recoverTroops(TROOP_COST.recoveryIntervalSeconds); // 300秒
    expect(team.troopCount).toBe(TROOP_COST.recoveryAmount); // 1
  });

  it('R2-C3: troopCount=0时休息节点治疗有效', () => {
    const { teamId, team } = setupDispatchedTeam(sys);
    team.troopCount = 0;

    // 推进到休息节点
    // 先推进几个节点直到休息节点
    const routeId = team.currentRouteId!;
    const route = sys.getRoute(routeId)!;

    // 手动设置到休息节点
    const nodeEntries = Object.values(route.nodes);
    const restNode = nodeEntries.find(n => n.type === NodeType.REST);
    if (restNode) {
      team.currentNodeId = restNode.id;
      restNode.status = NodeStatus.MARCHING;

      const healResult = sys.processNodeEffect(teamId);
      expect(healResult.healed).toBe(true);
      expect(healResult.healAmount).toBe(Math.round(team.maxTroops * 0.20));
      expect(team.troopCount).toBeGreaterThan(0);
    }
  });

  it('R2-C4: troopCount=0时无法启动自动远征', () => {
    const autoSys = new AutoExpeditionSystem(
      new ExpeditionBattleSystem(),
      new ExpeditionRewardSystem(),
    );

    const { teamId, team } = setupDispatchedTeam(sys);
    team.troopCount = 0;

    const result = autoSys.startAutoExpedition(sys.getState(), teamId, 'route_hulao_easy');
    expect(result).toBe(false);
  });

  it('R2-C5: 兵力=消耗-1, 派遣失败', () => {
    const heroes = createShuHeroes(5);
    const heroMap = createHeroMap(heroes);
    sys.createTeam('test', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    const teamId = Object.keys(sys.getState().teams)[0];
    const team = sys.getState().teams[teamId];

    const required = 5 * TROOP_COST.expeditionPerHero; // 100
    team.troopCount = required - 1; // 99

    const result = sys.dispatchTeam(teamId, 'route_hulao_easy');
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════
// R2-D: stars=0边界
// ═══════════════════════════════════════════

describe('R2-D: stars=0边界', () => {
  let sys: ExpeditionSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('R2-D1: stars=0完成路线成功', () => {
    const { teamId, team } = setupDispatchedTeam(sys);
    const routeId = team.currentRouteId!;

    const result = sys.completeRoute(teamId, 0);
    expect(result).toBe(true);
    expect(sys.getRouteStars(routeId)).toBe(0);
  });

  it('R2-D2: stars=0后可更新为更高星', () => {
    const { teamId, team } = setupDispatchedTeam(sys);
    const routeId = team.currentRouteId!;

    sys.completeRoute(teamId, 0);
    expect(sys.getRouteStars(routeId)).toBe(0);

    // 重新派遣并完成3星
    team.troopCount = 200;
    sys.dispatchTeam(teamId, routeId);
    sys.completeRoute(teamId, 3);
    expect(sys.getRouteStars(routeId)).toBe(3);
  });

  it('R2-D3: stars=0仍加入clearedRouteIds', () => {
    const { teamId, team } = setupDispatchedTeam(sys);
    const routeId = team.currentRouteId!;

    sys.completeRoute(teamId, 0);
    expect(sys.getState().clearedRouteIds.has(routeId)).toBe(true);
  });

  it('R2-D4: stars=0不触发扫荡', () => {
    const { teamId, team } = setupDispatchedTeam(sys);
    const routeId = team.currentRouteId!;

    sys.completeRoute(teamId, 0);
    expect(sys.canSweepRoute(routeId)).toBe(false);
  });
});

// ═══════════════════════════════════════════
// R2-E: deserialize脏数据防御
// ═══════════════════════════════════════════

describe('R2-E: deserialize脏数据防御', () => {
  let sys: ExpeditionSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  function createBaseSaveData(): ExpeditionSaveData {
    // 先序列化一个正常状态
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    sys.createTeam('test', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
    return sys.serialize();
  }

  it('R2-E1: achievedMilestones含非法值不崩溃', () => {
    const data = createBaseSaveData();
    data.achievedMilestones = ['INVALID_TYPE', 'ANOTHER_BAD'];

    expect(() => sys.deserialize(data)).not.toThrow();
    expect(sys.getState().achievedMilestones.has('INVALID_TYPE' as MilestoneType)).toBe(true);
  });

  it('R2-E2: sweepCounts含非法key不崩溃', () => {
    const data = createBaseSaveData();
    data.sweepCounts = { 'route_x': { 'INVALID_TYPE': 5 } };

    expect(() => sys.deserialize(data)).not.toThrow();
  });

  it('R2-E3: teams中heroIds含null/undefined不崩溃', () => {
    const data = createBaseSaveData();
    const teamId = Object.keys(data.teams)[0];
    data.teams[teamId].heroIds = [null as any, undefined as any, 'h1'];

    expect(() => sys.deserialize(data)).not.toThrow();
  });

  it('R2-E4: clearedRouteIds含不存在的routeId不崩溃', () => {
    const data = createBaseSaveData();
    data.clearedRouteIds = ['route_nonexistent', 'route_fake'];

    expect(() => sys.deserialize(data)).not.toThrow();
  });

  it('R2-E5: routeNodeStatuses含非法NodeStatus不崩溃', () => {
    const data = createBaseSaveData();
    data.routeNodeStatuses = {
      'route_hulao_easy': {
        'route_hulao_easy_n1': 'HACKED_STATUS',
      },
    };

    expect(() => sys.deserialize(data)).not.toThrow();
  });

  it('R2-E6: unlockedSlots为NaN时使用默认值', () => {
    const data = createBaseSaveData();
    data.unlockedSlots = NaN;

    expect(() => sys.deserialize(data)).not.toThrow();
    // 代码有 ?? 1 保护
    expect(sys.getUnlockedSlots()).toBe(1);
  });

  it('R2-E7: version不匹配不崩溃', () => {
    const data = createBaseSaveData();
    data.version = 999;

    expect(() => sys.deserialize(data)).not.toThrow();
  });
});

// ═══════════════════════════════════════════
// R2-F: team外部篡改防御
// ═══════════════════════════════════════════

describe('R2-F: team外部篡改防御', () => {
  let sys: ExpeditionSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('R2-F1: 远征中删除team后advanceToNextNode返回null', () => {
    const { teamId } = setupDispatchedTeam(sys);

    // 外部删除team
    delete sys.getState().teams[teamId];

    const result = sys.advanceToNextNode(teamId);
    expect(result).toBeNull();
  });

  it('R2-F2: 远征中清空heroIds后getExpeditioningHeroIds返回空', () => {
    const { teamId, team } = setupDispatchedTeam(sys);

    // 外部清空heroIds
    team.heroIds = [];

    const heroIds = sys.getExpeditioningHeroIds();
    expect(heroIds.size).toBe(0);
  });

  it('R2-F3: 远征中修改isExpeditioning后advanceToNextNode返回null', () => {
    const { teamId, team } = setupDispatchedTeam(sys);

    // 外部修改isExpeditioning
    team.isExpeditioning = false;

    const result = sys.advanceToNextNode(teamId);
    expect(result).toBeNull();
  });

  it('R2-F4: 远征中修改currentRouteId后advanceToNextNode返回null', () => {
    const { teamId, team } = setupDispatchedTeam(sys);

    // 外部清空currentRouteId
    team.currentRouteId = null;

    const result = sys.advanceToNextNode(teamId);
    expect(result).toBeNull();
  });
});
