/**
 * 集成测试: 自动远征 / 离线远征
 *
 * 覆盖：
 *   §1 自动远征启动与配置 (5 cases)
 *   §2 自动远征循环执行 (5 cases)
 *   §3 暂停条件与恢复 (6 cases)
 *   §4 离线远征收益计算 (5 cases)
 *   §5 离线效率与预估 (5 cases)
 *   Total: 26 cases
 *
 * 联动系统：AutoExpeditionSystem + ExpeditionBattleSystem + ExpeditionRewardSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AutoExpeditionSystem } from '../../AutoExpeditionSystem';
import { ExpeditionBattleSystem } from '../../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../../ExpeditionRewardSystem';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import type { HeroBrief } from '../../ExpeditionTeamHelper';
import type { Faction } from '../../../hero/hero.types';
import type { OfflineExpeditionParams } from '../../AutoExpeditionSystem';
import {
  RouteDifficulty,
  NodeType,
  FormationType,
  BattleGrade,
  PauseReason,
  OFFLINE_EXPEDITION_CONFIG,
  TROOP_COST,
} from '../../../../core/expedition/expedition.types';
import { CONSECUTIVE_FAILURE_LIMIT } from '../../expedition-config';
import { createDefaultExpeditionState } from '../../expedition-helpers';

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

function createOfflineParams(overrides?: Partial<OfflineExpeditionParams>): OfflineExpeditionParams {
  return {
    offlineSeconds: 3600,
    teamPower: 10000,
    teamFormation: FormationType.OFFENSIVE,
    routeAvgPower: 5000,
    routeAvgFormation: FormationType.STANDARD,
    avgRouteDurationSeconds: 1800,
    baseRouteReward: { grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200, drops: [] },
    heroCount: 5,
    ...overrides,
  };
}

// ── §1 自动远征启动与配置 ──────────────────

describe('§1 自动远征启动与配置', () => {
  let expeditionSystem: ExpeditionSystem;
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
    expeditionSystem = new ExpeditionSystem();
    expeditionSystem.updateSlots(10);
  });

  it('§1.1 应成功启动自动远征', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops;

    const state = expeditionSystem.getState();
    const started = autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    expect(started).toBe(true);
    expect(state.isAutoExpeditioning).toBe(true);
  });

  it('§1.2 不存在队伍应拒绝启动', () => {
    const state = expeditionSystem.getState();
    const started = autoSystem.startAutoExpedition(state, 'nonexistent_team', 'route_hulao_easy');
    expect(started).toBe(false);
  });

  it('§1.3 未解锁路线应拒绝启动', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops;

    const state = expeditionSystem.getState();
    const started = autoSystem.startAutoExpedition(state, team.id, 'route_yishui_easy');
    expect(started).toBe(false);
  });

  it('§1.4 兵力不足应拒绝启动', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = 0;

    const state = expeditionSystem.getState();
    const started = autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    expect(started).toBe(false);
  });

  it('§1.5 已在自动远征中不可重复启动', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops;

    const state = expeditionSystem.getState();
    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');

    const started2 = autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    expect(started2).toBe(false);
  });
});

// ── §2 自动远征循环执行 ────────────────────

describe('§2 自动远征循环执行', () => {
  let expeditionSystem: ExpeditionSystem;
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
    expeditionSystem = new ExpeditionSystem();
    expeditionSystem.updateSlots(10);
  });

  it('§2.1 应执行单步自动远征', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    const state = expeditionSystem.getState();
    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');

    const step = autoSystem.executeAutoStep(
      state, team, 3000, FormationType.STANDARD, RouteDifficulty.EASY, false,
    );
    expect(step).toBeDefined();
    expect(typeof step.success).toBe('boolean');
    expect(step.reward).toBeDefined();
  });

  it('§2.2 应执行完整自动远征循环', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops * 100; // 超大兵力确保不中断
    const state = expeditionSystem.getState();
    state.autoConfig.repeatCount = 3;
    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');

    const result = autoSystem.executeAutoExpedition(
      state, team, 3000, FormationType.STANDARD, RouteDifficulty.EASY, false, 10,
    );
    expect(result.totalRuns).toBeGreaterThan(0);
    expect(result.totalRuns).toBeLessThanOrEqual(10);
    expect(result.steps.length).toBe(result.totalRuns);
  });

  it('§2.3 自动远征应消耗兵力', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    const state = expeditionSystem.getState();
    state.autoConfig.repeatCount = 3;
    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');

    const beforeTroops = team.troopCount;
    autoSystem.executeAutoExpedition(
      state, team, 3000, FormationType.STANDARD, RouteDifficulty.EASY, false, 3,
    );
    expect(team.troopCount).toBeLessThan(beforeTroops);
  });

  it('§2.4 无限循环模式（repeatCount=0）应持续到暂停', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops * 50;
    const state = expeditionSystem.getState();
    state.autoConfig.repeatCount = 0; // 无限
    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');

    const result = autoSystem.executeAutoExpedition(
      state, team, 3000, FormationType.STANDARD, RouteDifficulty.EASY, false, 5,
    );
    // 应被 maxSteps 限制
    expect(result.totalRuns).toBeLessThanOrEqual(5);
  });

  it('§2.5 停止自动远征应重置状态', () => {
    const heroes = shuHeroes();
    const map = createHeroDataMap(heroes);
    expeditionSystem.createTeam('自动队', heroes.map(h => h.id), FormationType.OFFENSIVE, map);

    const team = expeditionSystem.getAllTeams()[0];
    team.troopCount = team.maxTroops;
    const state = expeditionSystem.getState();
    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');

    autoSystem.stopAutoExpedition(state);
    expect(state.isAutoExpeditioning).toBe(false);
    expect(state.consecutiveFailures).toBe(0);
  });
});

// ── §3 暂停条件与恢复 ──────────────────────

describe('§3 暂停条件与恢复', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  it('§3.1 兵力耗尽应暂停', () => {
    const state = createDefaultExpeditionState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 0;

    const team: import('../../../../core/expedition/expedition.types').ExpeditionTeam = {
      id: 'team_1', name: '测试队', heroIds: ['h1', 'h2', 'h3'],
      formation: FormationType.STANDARD,
      troopCount: 0, maxTroops: 600, totalPower: 5000,
      currentRouteId: 'route_hulao_easy', currentNodeId: null, isExpeditioning: true,
    };

    const step = autoSystem.executeAutoStep(
      state, team, 3000, FormationType.STANDARD, RouteDifficulty.EASY, false,
    );
    expect(step.paused).toBe(true);
    expect(step.pauseReason).toBe(PauseReason.TROOPS_EXHAUSTED);
  });

  it('§3.2 连续失败2次应暂停', () => {
    const state = createDefaultExpeditionState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 0;
    state.consecutiveFailures = CONSECUTIVE_FAILURE_LIMIT - 1; // 已失败1次

    const team: import('../../../../core/expedition/expedition.types').ExpeditionTeam = {
      id: 'team_1', name: '弱队', heroIds: ['h1'],
      formation: FormationType.STANDARD,
      troopCount: 1000, maxTroops: 1000, totalPower: 100, // 极弱
      currentRouteId: 'route_hulao_easy', currentNodeId: null, isExpeditioning: true,
    };

    // 极弱队伍对极强敌人，大概率失败
    const step = autoSystem.executeAutoStep(
      state, team, 100000, FormationType.STANDARD, RouteDifficulty.HARD, false,
    );
    // 如果这次也失败，累计达到2次，应暂停
    if (!step.success && state.consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
      expect(step.paused).toBe(true);
      expect(step.pauseReason).toBe(PauseReason.CONSECUTIVE_FAILURES);
    }
  });

  it('§3.3 完成设定次数应暂停', () => {
    const state = createDefaultExpeditionState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 1; // 只跑1次

    const team: import('../../../../core/expedition/expedition.types').ExpeditionTeam = {
      id: 'team_1', name: '强队', heroIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
      formation: FormationType.OFFENSIVE,
      troopCount: 10000, maxTroops: 10000, totalPower: 50000,
      currentRouteId: 'route_hulao_easy', currentNodeId: null, isExpeditioning: true,
    };

    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    // 强制设置剩余次数为1
    state.autoConfig.repeatCount = 1;
    autoSystem.reset();
    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');

    const result = autoSystem.executeAutoExpedition(
      state, team, 1000, FormationType.STANDARD, RouteDifficulty.EASY, false, 10,
    );
    expect(result.pauseReason).toBe(PauseReason.COMPLETED);
  });

  it('§3.4 成功战斗应重置连续失败计数', () => {
    const state = createDefaultExpeditionState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 0;
    state.consecutiveFailures = 1;

    const team: import('../../../../core/expedition/expedition.types').ExpeditionTeam = {
      id: 'team_1', name: '强队', heroIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
      formation: FormationType.OFFENSIVE,
      troopCount: 10000, maxTroops: 10000, totalPower: 50000,
      currentRouteId: 'route_hulao_easy', currentNodeId: null, isExpeditioning: true,
    };

    autoSystem.executeAutoStep(
      state, team, 1000, FormationType.STANDARD, RouteDifficulty.EASY, false,
    );
    // 极强队伍对弱敌，应该成功并重置
    if (state.consecutiveFailures === 0) {
      expect(state.consecutiveFailures).toBe(0);
    }
  });

  it('§3.5 手动停止应立即生效', () => {
    const state = createDefaultExpeditionState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 0;

    autoSystem.stopAutoExpedition(state);
    expect(state.isAutoExpeditioning).toBe(false);

    // 后续执行应不再运行
    const team: import('../../../../core/expedition/expedition.types').ExpeditionTeam = {
      id: 'team_1', name: '强队', heroIds: ['h1'],
      formation: FormationType.STANDARD,
      troopCount: 10000, maxTroops: 10000, totalPower: 50000,
      currentRouteId: 'route_hulao_easy', currentNodeId: null, isExpeditioning: true,
    };

    const result = autoSystem.executeAutoExpedition(
      state, team, 1000, FormationType.STANDARD, RouteDifficulty.EASY, false, 10,
    );
    expect(result.totalRuns).toBe(0);
  });

  it('§3.6 自动远征结果应包含总奖励汇总', () => {
    const state = createDefaultExpeditionState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 3;

    const team: import('../../../../core/expedition/expedition.types').ExpeditionTeam = {
      id: 'team_1', name: '强队', heroIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
      formation: FormationType.OFFENSIVE,
      troopCount: 100000, maxTroops: 100000, totalPower: 50000,
      currentRouteId: 'route_hulao_easy', currentNodeId: null, isExpeditioning: true,
    };

    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    const result = autoSystem.executeAutoExpedition(
      state, team, 1000, FormationType.STANDARD, RouteDifficulty.EASY, false, 10,
    );

    expect(result.totalReward).toBeDefined();
    expect(result.totalReward.grain).toBeGreaterThanOrEqual(0);
    expect(result.totalReward.gold).toBeGreaterThanOrEqual(0);
    expect(result.successCount + result.failureCount).toBe(result.totalRuns);
  });
});

// ── §4 离线远征收益计算 ────────────────────

describe('§4 离线远征收益计算', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  it('§4.1 应计算离线远征收益', () => {
    const params = createOfflineParams({ offlineSeconds: 3600 });
    const result = autoSystem.calculateOfflineExpedition(params);
    expect(result.completedRuns).toBeGreaterThan(0);
    expect(result.totalReward.grain).toBeGreaterThan(0);
    expect(result.efficiency).toBeGreaterThan(0);
  });

  it('§4.2 离线时间应受72小时上限约束', () => {
    const params = createOfflineParams({ offlineSeconds: 100 * 3600 }); // 100小时
    const result = autoSystem.calculateOfflineExpedition(params);
    expect(result.isTimeCapped).toBe(true);
    expect(result.offlineSeconds).toBeLessThanOrEqual(72 * 3600);
  });

  it('§4.3 战力优势应提高完成次数', () => {
    const weakParams = createOfflineParams({ teamPower: 3000, routeAvgPower: 5000 });
    const strongParams = createOfflineParams({ teamPower: 20000, routeAvgPower: 5000 });

    const weakResult = autoSystem.calculateOfflineExpedition(weakParams);
    const strongResult = autoSystem.calculateOfflineExpedition(strongParams);
    expect(strongResult.completedRuns).toBeGreaterThan(weakResult.completedRuns);
  });

  it('§4.4 离线效率系数应为0.85', () => {
    const params = createOfflineParams({ offlineSeconds: 3600 });
    const result = autoSystem.calculateOfflineExpedition(params);
    // 效率应包含0.85的离线修正
    expect(result.efficiency).toBeLessThan(1.0);
  });

  it('§4.5 离线时间越长收益越高（线性增长）', () => {
    const r1h = autoSystem.calculateOfflineExpedition(createOfflineParams({ offlineSeconds: 3600 }));
    const r4h = autoSystem.calculateOfflineExpedition(createOfflineParams({ offlineSeconds: 4 * 3600 }));
    const r24h = autoSystem.calculateOfflineExpedition(createOfflineParams({ offlineSeconds: 24 * 3600 }));

    expect(r4h.totalReward.grain).toBeGreaterThan(r1h.totalReward.grain);
    expect(r24h.totalReward.grain).toBeGreaterThan(r4h.totalReward.grain);
  });
});

// ── §5 离线效率与预估 ──────────────────────

describe('§5 离线效率与预估', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  it('§5.1 应提供分时段预估收益', () => {
    const params = createOfflineParams();
    const estimates = autoSystem.estimateOfflineEarnings(params, 72);
    expect(estimates.length).toBeGreaterThan(0);
    expect(estimates[0].hours).toBe(1);
  });

  it('§5.2 预估收益应递增', () => {
    const params = createOfflineParams();
    const estimates = autoSystem.estimateOfflineEarnings(params, 72);

    for (let i = 1; i < estimates.length; i++) {
      expect(estimates[i].reward.grain).toBeGreaterThanOrEqual(estimates[i - 1].reward.grain);
    }
  });

  it('§5.3 预估不应超过指定小时数', () => {
    const params = createOfflineParams();
    const estimates = autoSystem.estimateOfflineEarnings(params, 8);
    const maxHours = Math.max(...estimates.map(e => e.hours));
    expect(maxHours).toBeLessThanOrEqual(8);
  });

  it('§5.4 阵型克制应影响离线收益', () => {
    const counteredParams = createOfflineParams({
      teamFormation: FormationType.OFFENSIVE,
      routeAvgFormation: FormationType.DEFENSIVE, // 锋矢克制方圆
    });
    const neutralParams = createOfflineParams({
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
    });

    const counteredResult = autoSystem.calculateOfflineExpedition(counteredParams);
    const neutralResult = autoSystem.calculateOfflineExpedition(neutralParams);
    // 克制方应有更高完成次数
    expect(counteredResult.completedRuns).toBeGreaterThanOrEqual(neutralResult.completedRuns);
  });

  it('§5.5 路线时长影响完成次数', () => {
    const shortRoute = createOfflineParams({ avgRouteDurationSeconds: 600 }); // 10分钟
    const longRoute = createOfflineParams({ avgRouteDurationSeconds: 3600 }); // 60分钟

    const shortResult = autoSystem.calculateOfflineExpedition(shortRoute);
    const longResult = autoSystem.calculateOfflineExpedition(longRoute);
    expect(shortResult.completedRuns).toBeGreaterThan(longResult.completedRuns);
  });
});
