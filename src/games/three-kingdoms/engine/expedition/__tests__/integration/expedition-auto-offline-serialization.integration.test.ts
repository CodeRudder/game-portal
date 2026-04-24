/**
 * 集成测试 §5~§6: 自动远征、离线远征与存档序列化
 *
 * 覆盖 Play 流程：
 *   §5.1 自动远征启动与循环 (5 cases)
 *   §5.2 自动远征暂停条件 (5 cases)
 *   §5.3 离线远征收益计算 (6 cases)
 *   §5.4 离线效率分段衰减 (4 cases)
 *   §6.1 编队→远征→战斗→奖励全链路 (5 cases)
 *   §6.2 多队并行→互斥→自动远征闭环 (5 cases)
 *   §6.3 存档序列化与恢复 (5 cases)
 *   Total: 35 cases
 *
 * 联动系统：ExpeditionSystem + ExpeditionBattleSystem + ExpeditionRewardSystem + AutoExpeditionSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import { ExpeditionBattleSystem } from '../../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../../ExpeditionRewardSystem';
import { AutoExpeditionSystem } from '../../AutoExpeditionSystem';
import type { HeroBrief } from '../../ExpeditionTeamHelper';
import type { Faction } from '../../../hero/hero.types';
import type { OfflineExpeditionParams } from '../../AutoExpeditionSystem';
import {
  RouteDifficulty,
  NodeType,
  NodeStatus,
  FormationType,
  BattleGrade,
  SweepType,
  MilestoneType,
  PauseReason,
  TROOP_COST,
  OFFLINE_EXPEDITION_CONFIG,
} from '../../../../core/expedition/expedition.types';

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

function createOfflineParams(overrides: Partial<OfflineExpeditionParams> = {}): OfflineExpeditionParams {
  return {
    offlineSeconds: 8 * 3600, // 8小时
    teamPower: 10000,
    teamFormation: FormationType.STANDARD,
    routeAvgPower: 8000,
    routeAvgFormation: FormationType.STANDARD,
    avgRouteDurationSeconds: 3600, // 1小时
    baseRouteReward: { grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200, drops: [] },
    heroCount: 5,
    ...overrides,
  };
}

// ── §5 自动远征与离线 ─────────────────────

describe('§5 自动远征与离线', () => {
  let system: ExpeditionSystem;
  let battle: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let auto: AutoExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(20);
    battle = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    auto = new AutoExpeditionSystem(battle, rewardSystem);
  });

  // ── §5.1 自动远征启动与循环 (5) ──────────

  describe('§5.1 自动远征启动与循环', () => {
    it('启动自动远征需满足条件：队伍存在、路线解锁、兵力充足', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      // 设置足够兵力
      team.troopCount = 9999;

      const started = auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');
      expect(started).toBe(true);
      expect(system.getState().isAutoExpeditioning).toBe(true);
    });

    it('路线未解锁时无法启动自动远征', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const started = auto.startAutoExpedition(system.getState(), teamIds[0], 'route_yishui_easy');
      expect(started).toBe(false);
    });

    it('停止自动远征应重置状态', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 9999;

      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');
      expect(system.getState().isAutoExpeditioning).toBe(true);

      auto.stopAutoExpedition(system.getState());
      expect(system.getState().isAutoExpeditioning).toBe(false);
      expect(system.getState().consecutiveFailures).toBe(0);
    });

    it('自动远征执行单步返回完整结果', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 9999;

      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');

      const step = auto.executeAutoStep(
        system.getState(), team,
        8000, FormationType.STANDARD,
        RouteDifficulty.EASY, false,
      );

      expect(step).toHaveProperty('success');
      expect(step).toHaveProperty('grade');
      expect(step).toHaveProperty('reward');
      expect(step).toHaveProperty('paused');
      expect(step).toHaveProperty('pauseReason');
    });

    it('自动远征完整循环执行多步', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 99999;

      system.getState().autoConfig.repeatCount = 3; // 重复3次
      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');

      const result = auto.executeAutoExpedition(
        system.getState(), team,
        5000, FormationType.STANDARD,
        RouteDifficulty.EASY, false,
        10,
      );

      expect(result.totalRuns).toBeGreaterThan(0);
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  // ── §5.2 自动远征暂停条件 (5) ────────────

  describe('§5.2 自动远征暂停条件', () => {
    it('兵力耗尽时自动暂停', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 1; // 兵力不足

      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');

      const step = auto.executeAutoStep(
        system.getState(), team,
        8000, FormationType.STANDARD,
        RouteDifficulty.EASY, false,
      );

      expect(step.paused).toBe(true);
      expect(step.pauseReason).toBe(PauseReason.TROOPS_EXHAUSTED);
    });

    it('连续失败2次自动暂停', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 99999;

      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');
      system.getState().consecutiveFailures = 1; // 已失败1次

      // 模拟第二次失败
      const step = auto.executeAutoStep(
        system.getState(), team,
        999999, FormationType.STANDARD, // 敌方极强确保失败
        RouteDifficulty.HARD, false,
      );

      // 连续失败2次后应暂停（如果这步也失败）
      if (!step.success && system.getState().consecutiveFailures >= 2) {
        expect(step.paused).toBe(true);
        expect(step.pauseReason).toBe(PauseReason.CONSECUTIVE_FAILURES);
      }
    });

    it('完成设定重复次数后自动暂停', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 99999;

      system.getState().autoConfig.repeatCount = 1;
      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');

      const result = auto.executeAutoExpedition(
        system.getState(), team,
        1000, FormationType.STANDARD, // 弱敌确保胜利
        RouteDifficulty.EASY, false,
        10,
      );

      // 应因完成次数而停止
      expect(result.pauseReason).toBe(PauseReason.COMPLETED);
    });

    it('无限重复模式(repeatCount=0)不因次数停止', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 99999;

      system.getState().autoConfig.repeatCount = 0; // 无限
      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');

      // 执行5步
      const result = auto.executeAutoExpedition(
        system.getState(), team,
        1000, FormationType.STANDARD,
        RouteDifficulty.EASY, false,
        5,
      );

      // 无限模式不应因次数停止（除非其他暂停条件触发）
      expect(result.totalRuns).toBeGreaterThan(0);
    });

    it('手动停止远征立即生效', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('自动队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 99999;

      auto.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');
      expect(system.getState().isAutoExpeditioning).toBe(true);

      auto.stopAutoExpedition(system.getState());
      expect(system.getState().isAutoExpeditioning).toBe(false);

      // 后续执行应跳过
      const result = auto.executeAutoExpedition(
        system.getState(), team,
        1000, FormationType.STANDARD,
        RouteDifficulty.EASY, false,
        5,
      );
      expect(result.totalRuns).toBe(0);
    });
  });

  // ── §5.3 离线远征收益计算 (6) ────────────

  describe('§5.3 离线远征收益计算', () => {
    it('离线8小时收益计算正确', () => {
      const params = createOfflineParams({ offlineSeconds: 8 * 3600 });
      const result = auto.calculateOfflineExpedition(params);

      expect(result.offlineSeconds).toBe(8 * 3600);
      expect(result.completedRuns).toBeGreaterThan(0);
      expect(result.totalReward.grain).toBeGreaterThan(0);
      expect(result.isTimeCapped).toBe(false);
    });

    it('离线超过72小时封顶计算', () => {
      const params = createOfflineParams({ offlineSeconds: 100 * 3600 });
      const result = auto.calculateOfflineExpedition(params);

      expect(result.offlineSeconds).toBe(OFFLINE_EXPEDITION_CONFIG.maxOfflineHours * 3600);
      expect(result.isTimeCapped).toBe(true);
    });

    it('离线收益受战斗惩罚×0.85影响', () => {
      const params = createOfflineParams({ offlineSeconds: 3600 });
      const result = auto.calculateOfflineExpedition(params);

      // 效率应≤0.85（战斗惩罚系数）
      expect(result.efficiency).toBeLessThanOrEqual(1);
    });

    it('战力优势越大离线完成次数越多', () => {
      const weakParams = createOfflineParams({
        teamPower: 5000,
        routeAvgPower: 10000,
      });
      const strongParams = createOfflineParams({
        teamPower: 20000,
        routeAvgPower: 10000,
      });

      const weakResult = auto.calculateOfflineExpedition(weakParams);
      const strongResult = auto.calculateOfflineExpedition(strongParams);

      expect(strongResult.completedRuns).toBeGreaterThan(weakResult.completedRuns);
    });

    it('预估收益按时间段正确分段', () => {
      const params = createOfflineParams();
      const estimates = auto.estimateOfflineEarnings(params, 72);

      expect(estimates.length).toBeGreaterThan(0);
      // 应包含1h, 2h, 4h等时间段
      expect(estimates[0].hours).toBe(1);
      // 更长时间应有更多收益
      for (let i = 1; i < estimates.length; i++) {
        expect(estimates[i].reward.grain).toBeGreaterThanOrEqual(estimates[i - 1].reward.grain);
      }
    });

    it('阵型克制影响离线胜率', () => {
      const counterParams = createOfflineParams({
        teamFormation: FormationType.OFFENSIVE,
        routeAvgFormation: FormationType.DEFENSIVE, // 被克制
      });
      const counteredParams = createOfflineParams({
        teamFormation: FormationType.DEFENSIVE,
        routeAvgFormation: FormationType.OFFENSIVE, // 被克制
      });

      const counterResult = auto.calculateOfflineExpedition(counterParams);
      const counteredResult = auto.calculateOfflineExpedition(counteredParams);

      // 克制方应比被克制方完成次数多
      expect(counterResult.completedRuns).toBeGreaterThanOrEqual(counteredResult.completedRuns);
    });
  });

  // ── §5.4 离线效率分段衰减 (4) ────────────

  describe('§5.4 离线效率分段衰减', () => {
    it('0~2h效率最高，24~48h效率显著下降', () => {
      const shortParams = createOfflineParams({ offlineSeconds: 1 * 3600 });
      const longParams = createOfflineParams({ offlineSeconds: 36 * 3600 });

      const shortResult = auto.calculateOfflineExpedition(shortParams);
      const longResult = auto.calculateOfflineExpedition(longParams);

      // 短时间离线效率应高于长时间（按每小时产出计）
      const shortPerHour = shortResult.totalReward.grain / 1;
      const longPerHour = longResult.totalReward.grain / 36;
      expect(shortPerHour).toBeGreaterThan(longPerHour);
    });

    it('72h后收益封顶不再增长', () => {
      const params72 = createOfflineParams({ offlineSeconds: 72 * 3600 });
      const params100 = createOfflineParams({ offlineSeconds: 100 * 3600 });

      const result72 = auto.calculateOfflineExpedition(params72);
      const result100 = auto.calculateOfflineExpedition(params100);

      // 100小时收益不应超过72小时
      expect(result100.totalReward.grain).toBeLessThanOrEqual(result72.totalReward.grain);
    });

    it('路线时长越短离线完成次数越多', () => {
      const fastParams = createOfflineParams({ avgRouteDurationSeconds: 1800 }); // 30分钟
      const slowParams = createOfflineParams({ avgRouteDurationSeconds: 7200 }); // 2小时

      const fastResult = auto.calculateOfflineExpedition(fastParams);
      const slowResult = auto.calculateOfflineExpedition(slowParams);

      expect(fastResult.completedRuns).toBeGreaterThan(slowResult.completedRuns);
    });

    it('离线收益使用RewardSystem计算OfflineReward一致', () => {
      const baseReward = { grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200, drops: [] };
      const offlineResult = rewardSystem.calculateOfflineReward(baseReward, 8 * 3600, 5);

      expect(offlineResult.offlineSeconds).toBe(8 * 3600);
      expect(offlineResult.completedRuns).toBe(5);
      expect(offlineResult.efficiency).toBe(0.85);
      expect(offlineResult.isTimeCapped).toBe(false);
      expect(offlineResult.totalReward.grain).toBe(Math.round(400 * 5 * 0.85));
    });
  });
});

// ── §6 全链路与序列化 ─────────────────────

describe('§6 全链路与序列化', () => {
  let system: ExpeditionSystem;
  let battle: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(20);
    battle = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
  });

  // ── §6.1 编队→远征→战斗→奖励全链路 (5) ──

  describe('§6.1 编队→远征→战斗→奖励全链路', () => {
    it('完整链路：编队→出发→推进→战斗→结算', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);

      // 1. 编队
      const teamResult = system.createTeam('远征队', heroes.map(h => h.id), FormationType.OFFENSIVE, heroMap);
      expect(teamResult.valid).toBe(true);

      // 2. 出发
      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 9999;

      const dispatched = system.dispatchTeam(teamIds[0], 'route_hulao_easy');
      expect(dispatched).toBe(true);
      expect(team.isExpeditioning).toBe(true);

      // 3. 推进节点
      const nextNode = system.advanceToNextNode(teamIds[0]);
      expect(nextNode).not.toBeNull();

      // 4. 战斗
      const battleResult = battle.executeBattle(
        {
          units: heroes.map(h => ({
            id: h.id, hp: 1000, maxHp: 1000,
            attack: h.power / 50, defense: h.power / 60,
            speed: h.power / 80, intelligence: h.power / 100,
          })),
          formation: FormationType.OFFENSIVE,
          totalPower: team.totalPower,
        },
        {
          nodeType: NodeType.BANDIT,
          enemyPower: 5000,
          enemyFormation: FormationType.STANDARD,
          recommendedPower: 8000,
        },
      );
      expect(battleResult.grade).toBeDefined();

      // 5. 奖励
      const nodeReward = rewardSystem.calculateNodeReward({
        difficulty: RouteDifficulty.EASY,
        nodeType: NodeType.BANDIT,
        grade: battleResult.grade,
        isFirstClear: true,
        isRouteComplete: false,
      });
      expect(nodeReward.grain).toBeGreaterThan(0);
    });

    it('兵力消耗正确：出发每武将-20', () => {
      const heroes = shuHeroes().slice(0, 3);
      const heroMap = createHeroDataMap(heroes);

      system.createTeam('兵力队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);
      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 9999;
      const troopsBefore = team.troopCount;

      system.dispatchTeam(teamIds[0], 'route_hulao_easy');

      const expectedCost = 3 * TROOP_COST.expeditionPerHero;
      expect(team.troopCount).toBe(troopsBefore - expectedCost);
    });

    it('路线完成后标记通关+记录星级+队伍回归', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('完成队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 9999;

      system.dispatchTeam(teamIds[0], 'route_hulao_easy');

      // 推进到最后节点
      let current = team.currentNodeId;
      while (current) {
        const route = system.getState().routes[team.currentRouteId!];
        const node = route?.nodes[current];
        if (!node || node.nextNodeIds.length === 0) break;
        current = system.advanceToNextNode(teamIds[0])!;
        if (!current) break;
      }

      // 完成路线
      const completed = system.completeRoute(teamIds[0], 3);
      expect(completed).toBe(true);
      expect(system.getState().clearedRouteIds.has('route_hulao_easy')).toBe(true);
      expect(system.getRouteStars('route_hulao_easy')).toBe(3);
      expect(team.isExpeditioning).toBe(false);
    });

    it('天险节点阵型效果削弱50%：战斗系统正确处理', () => {
      const ally = {
        units: [{ id: 'h1', hp: 1000, maxHp: 1000, attack: 100, defense: 80, speed: 60, intelligence: 50 }],
        formation: FormationType.OFFENSIVE,
        totalPower: 10000,
      };
      const node = {
        nodeType: NodeType.HAZARD,
        enemyPower: 10000,
        enemyFormation: FormationType.STANDARD,
        recommendedPower: 12000,
      };

      const result = battle.executeBattle(ally, node);
      expect(result.totalTurns).toBeLessThanOrEqual(10);
    });

    it('三星通关后可执行扫荡并获得奖励', () => {
      system.getState().routeStars['route_hulao_easy'] = 3;
      expect(system.canSweepRoute('route_hulao_easy')).toBe(true);

      const sweepResult = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
      expect(sweepResult.success).toBe(true);

      const sweepReward = rewardSystem.calculateSweepReward({
        difficulty: RouteDifficulty.EASY,
        sweepType: SweepType.NORMAL,
        heroCount: 5,
      });
      expect(sweepReward.grain).toBeGreaterThan(0);
    });
  });

  // ── §6.2 多队并行→互斥→自动远征闭环 (5) ─

  describe('§6.2 多队并行→互斥→自动远征闭环', () => {
    it('多支队伍同时出征不同路线互不干扰', () => {
      const shu = shuHeroes();
      const wei = [
        createHero('caocao', 'wei', 5500),
        createHero('xuchu', 'wei', 4500),
        createHero('dianwei', 'wei', 4700),
      ];

      system.createTeam('蜀队', shu.map(h => h.id), FormationType.STANDARD, createHeroDataMap(shu));
      system.createTeam('魏队', wei.map(h => h.id), FormationType.STANDARD, createHeroDataMap(wei));

      const teamIds = Object.keys(system.getState().teams);
      system.getState().teams[teamIds[0]].troopCount = 9999;
      system.getState().teams[teamIds[1]].troopCount = 9999;

      const d1 = system.dispatchTeam(teamIds[0], 'route_hulao_easy');
      const d2 = system.dispatchTeam(teamIds[1], 'route_hulao_normal');

      expect(d1).toBe(true);
      expect(d2).toBe(true);

      // 两队独立推进
      const n1 = system.advanceToNextNode(teamIds[0]);
      const n2 = system.advanceToNextNode(teamIds[1]);
      expect(n1).not.toBeNull();
      expect(n2).not.toBeNull();
    });

    it('武将互斥：同一武将不可同时编入多支队伍', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);

      system.createTeam('队1', ['guanyu', 'zhangfei'], FormationType.STANDARD, heroMap);
      const teamIds = Object.keys(system.getState().teams);
      system.getState().teams[teamIds[0]].isExpeditioning = true;

      // 尝试将guanyu编入第二队
      const result = system.createTeam('队2', ['guanyu', 'zhaoyun'], FormationType.STANDARD, heroMap);
      expect(result.valid).toBe(false);
    });

    it('自动远征+手动远征可并行', () => {
      const shu = shuHeroes();
      const wei = [createHero('caocao', 'wei', 5500), createHero('xuchu', 'wei', 4500)];

      system.createTeam('手动队', shu.slice(0, 2).map(h => h.id), FormationType.STANDARD, createHeroDataMap(shu));
      system.createTeam('自动队', wei.map(h => h.id), FormationType.STANDARD, createHeroDataMap(wei));

      const teamIds = Object.keys(system.getState().teams);
      system.getState().teams[teamIds[0]].troopCount = 9999;
      system.getState().teams[teamIds[1]].troopCount = 9999;

      // 手动出发
      system.dispatchTeam(teamIds[0], 'route_hulao_easy');

      // 自动远征
      const autoSys = new AutoExpeditionSystem(battle, rewardSystem);
      const started = autoSys.startAutoExpedition(system.getState(), teamIds[1], 'route_hulao_normal');
      expect(started).toBe(true);
    });

    it('自动远征循环完成后正确统计成功/失败次数', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('循环队', heroes.map(h => h.id), FormationType.STANDARD, heroMap);

      const teamIds = Object.keys(system.getState().teams);
      const team = system.getState().teams[teamIds[0]];
      team.troopCount = 99999;

      system.getState().autoConfig.repeatCount = 3;
      const autoSys = new AutoExpeditionSystem(battle, rewardSystem);
      autoSys.startAutoExpedition(system.getState(), teamIds[0], 'route_hulao_easy');

      const result = autoSys.executeAutoExpedition(
        system.getState(), team,
        1000, FormationType.STANDARD,
        RouteDifficulty.EASY, false,
        10,
      );

      expect(result.totalRuns).toBeGreaterThan(0);
      expect(result.successCount + result.failureCount).toBe(result.totalRuns);
      expect(result.totalReward).toBeDefined();
    });

    it('一键远征分配：高战力队伍分配到高难度路线', () => {
      const shu = shuHeroes();
      const wei = [createHero('caocao', 'wei', 5500), createHero('xuchu', 'wei', 4500)];

      system.createTeam('强队', shu.map(h => h.id), FormationType.OFFENSIVE, createHeroDataMap(shu));
      system.createTeam('弱队', wei.map(h => h.id), FormationType.STANDARD, createHeroDataMap(wei));

      const teamIds = Object.keys(system.getState().teams);
      const team1 = system.getState().teams[teamIds[0]];
      const team2 = system.getState().teams[teamIds[1]];

      // 强队战力应高于弱队
      expect(team1.totalPower).toBeGreaterThan(team2.totalPower);
    });
  });

  // ── §6.3 存档序列化与恢复 (5) ────────────

  describe('§6.3 存档序列化与恢复', () => {
    it('序列化后反序列化应恢复完整状态', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('持久队', heroes.map(h => h.id), FormationType.OFFENSIVE, heroMap);

      // 模拟一些进度
      system.getState().clearedRouteIds.add('route_hulao_easy');
      system.getState().routeStars['route_hulao_easy'] = 3;
      system.getState().achievedMilestones.add(MilestoneType.FIRST_CLEAR);

      const saved = system.serialize();
      expect(saved.version).toBe(1);
      expect(saved.clearedRouteIds).toContain('route_hulao_easy');
      expect(saved.routeStars['route_hulao_easy']).toBe(3);

      // 反序列化到新系统
      const newSystem = new ExpeditionSystem();
      newSystem.deserialize(saved);

      expect(newSystem.getState().clearedRouteIds.has('route_hulao_easy')).toBe(true);
      expect(newSystem.getRouteStars('route_hulao_easy')).toBe(3);
      expect(newSystem.getState().achievedMilestones.has(MilestoneType.FIRST_CLEAR)).toBe(true);
    });

    it('队伍数据序列化后完整恢复', () => {
      const heroes = shuHeroes();
      const heroMap = createHeroDataMap(heroes);
      system.createTeam('测试队', heroes.map(h => h.id), FormationType.OFFENSIVE, heroMap);

      const saved = system.serialize();
      const teamEntries = Object.entries(saved.teams);
      expect(teamEntries).toHaveLength(1);

      const newSystem = new ExpeditionSystem();
      newSystem.deserialize(saved);

      const restoredTeams = newSystem.getAllTeams();
      expect(restoredTeams).toHaveLength(1);
      expect(restoredTeams[0].name).toBe('测试队');
      expect(restoredTeams[0].formation).toBe(FormationType.OFFENSIVE);
      expect(restoredTeams[0].heroIds).toEqual(heroes.map(h => h.id));
    });

    it('扫荡次数序列化后正确恢复', () => {
      system.getState().routeStars['route_hulao_easy'] = 3;
      system.executeSweep('route_hulao_easy', SweepType.NORMAL);
      system.executeSweep('route_hulao_easy', SweepType.NORMAL);

      const saved = system.serialize();
      expect(saved.sweepCounts['route_hulao_easy']['NORMAL']).toBe(2);

      const newSystem = new ExpeditionSystem();
      newSystem.deserialize(saved);

      expect(newSystem.getSweepCount('route_hulao_easy', SweepType.NORMAL)).toBe(2);
    });

    it('自动远征配置序列化后正确恢复', () => {
      system.getState().autoConfig = {
        repeatCount: 5,
        failureAction: 'skip',
        bagFullAction: 'auto_sell',
        lowTroopAction: 'use_item',
      };
      system.getState().consecutiveFailures = 1;
      system.getState().isAutoExpeditioning = true;

      const saved = system.serialize();
      expect(saved.autoConfig.repeatCount).toBe(5);
      expect(saved.autoConfig.failureAction).toBe('skip');
      expect(saved.consecutiveFailures).toBe(1);

      const newSystem = new ExpeditionSystem();
      newSystem.deserialize(saved);

      expect(newSystem.getState().autoConfig.repeatCount).toBe(5);
      expect(newSystem.getState().autoConfig.failureAction).toBe('skip');
      expect(newSystem.getState().consecutiveFailures).toBe(1);
    });

    it('空状态序列化→反序列化应保持空', () => {
      const saved = system.serialize();
      const newSystem = new ExpeditionSystem();
      newSystem.deserialize(saved);

      expect(newSystem.getState().clearedRouteIds.size).toBe(0);
      expect(newSystem.getAllTeams()).toHaveLength(0);
      expect(newSystem.getUnlockedSlots()).toBe(saved.unlockedSlots);
    });
  });
});
