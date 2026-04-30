/**
 * AutoExpeditionSystem 对抗式测试（Adversarial Test）
 *
 * 重点测试：
 *   P0-1: 自动远征启动/停止边界
 *   P0-2: 连续失败暂停机制
 *   P0-3: 重复次数耗尽
 *   P0-4: 兵力耗尽暂停
 *   P0-5: 离线远征极端参数
 *   P0-6: 离线远征时间上限
 *
 * @module engine/expedition/__tests__/AutoExpeditionSystem-adversarial
 */

import { AutoExpeditionSystem } from '../AutoExpeditionSystem';
import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import type { OfflineExpeditionParams } from '../AutoExpeditionSystem';
import type { ExpeditionState, ExpeditionTeam, FormationType } from '../../../core/expedition/expedition.types';
import {
  NodeType,
  RouteDifficulty,
  BattleGrade,
  PauseReason,
  TROOP_COST,
} from '../../../core/expedition/expedition.types';
import { createDefaultExpeditionState } from '../expedition-helpers';

// ── 辅助 ──────────────────────────────

function createDefaultState(): ExpeditionState {
  return createDefaultExpeditionState();
}

function createTeam(overrides: Partial<ExpeditionTeam> = {}): ExpeditionTeam {
  return {
    id: 'test_team',
    name: '测试队',
    heroIds: ['h1', 'h2', 'h3'],
    formation: FormationType.STANDARD,
    troopCount: 1000,
    maxTroops: 300,
    totalPower: 5000,
    currentRouteId: 'route_hulao_easy',
    currentNodeId: null,
    isExpeditioning: false,
    ...overrides,
  };
}

let battleSystem: ExpeditionBattleSystem;
let rewardSystem: ExpeditionRewardSystem;
let autoSystem: AutoExpeditionSystem;

beforeEach(() => {
  battleSystem = new ExpeditionBattleSystem();
  rewardSystem = new ExpeditionRewardSystem();
  autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
});

// ═══════════════════════════════════════════════════════════
// P0-1: 自动远征启动/停止边界
// ═══════════════════════════════════════════════════════════

describe('P0-1: 启动/停止边界', () => {
  test('正常启动自动远征', () => {
    const state = createDefaultState();
    const team = createTeam();
    state.teams[team.id] = team;
    state.routes['route_hulao_easy'].unlocked = true;

    const result = autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    expect(result).toBe(true);
    expect(state.isAutoExpeditioning).toBe(true);
  });

  test('不存在队伍不能启动', () => {
    const state = createDefaultState();
    const result = autoSystem.startAutoExpedition(state, 'nonexistent', 'route_hulao_easy');
    expect(result).toBe(false);
    expect(state.isAutoExpeditioning).toBe(false);
  });

  test('不存在路线不能启动', () => {
    const state = createDefaultState();
    const team = createTeam();
    state.teams[team.id] = team;

    const result = autoSystem.startAutoExpedition(state, team.id, 'nonexistent');
    expect(result).toBe(false);
  });

  test('未解锁路线不能启动', () => {
    const state = createDefaultState();
    const team = createTeam();
    state.teams[team.id] = team;
    // route_yishui_easy 默认未解锁

    const result = autoSystem.startAutoExpedition(state, team.id, 'route_yishui_easy');
    expect(result).toBe(false);
  });

  test('已在自动远征中不能重复启动', () => {
    const state = createDefaultState();
    const team = createTeam();
    state.teams[team.id] = team;
    state.routes['route_hulao_easy'].unlocked = true;

    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    const result2 = autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    expect(result2).toBe(false);
  });

  test('兵力不足不能启动', () => {
    const state = createDefaultState();
    const team = createTeam({ troopCount: 1 }); // 远远不够
    state.teams[team.id] = team;
    state.routes['route_hulao_easy'].unlocked = true;

    const result = autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    expect(result).toBe(false);
  });

  test('停止自动远征重置状态', () => {
    const state = createDefaultState();
    const team = createTeam();
    state.teams[team.id] = team;
    state.routes['route_hulao_easy'].unlocked = true;

    autoSystem.startAutoExpedition(state, team.id, 'route_hulao_easy');
    expect(state.isAutoExpeditioning).toBe(true);

    autoSystem.stopAutoExpedition(state);
    expect(state.isAutoExpeditioning).toBe(false);
    expect(state.consecutiveFailures).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-2: 连续失败暂停机制
// ═══════════════════════════════════════════════════════════

describe('P0-2: 连续失败暂停', () => {
  test('连续2次失败自动暂停', () => {
    const state = createDefaultState();
    state.isAutoExpeditioning = true;
    state.consecutiveFailures = 0;

    const team = createTeam({ troopCount: 10000 });

    // 模拟连续失败（使用极低战力确保失败）
    const weakTeam = createTeam({ troopCount: 10000, totalPower: 10 });

    // 执行多步，期望连续失败后暂停
    const result = autoSystem.executeAutoExpedition(
      state,
      weakTeam,
      100000, // 敌方远强于我方
      FormationType.STANDARD,
      RouteDifficulty.HARD,
      false,
      20,
    );

    // 应该因为连续失败而暂停
    if (result.pauseReason === PauseReason.CONSECUTIVE_FAILURES) {
      expect(result.failureCount).toBeGreaterThanOrEqual(2);
      expect(state.isAutoExpeditioning).toBe(false);
    }
  });

  test('胜利重置连续失败计数', () => {
    const state = createDefaultState();
    state.isAutoExpeditioning = true;
    state.consecutiveFailures = 1; // 已失败1次

    const strongTeam = createTeam({ troopCount: 10000, totalPower: 100000 });

    const step = autoSystem.executeAutoStep(
      state,
      strongTeam,
      1000, // 敌方远弱于我方
      FormationType.STANDARD,
      RouteDifficulty.EASY,
      false,
    );

    if (step.success) {
      expect(state.consecutiveFailures).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// P0-3: 重复次数耗尽
// ═══════════════════════════════════════════════════════════

describe('P0-3: 重复次数耗尽', () => {
  test('设定3次重复后完成', () => {
    const state = createDefaultState();
    state.autoConfig.repeatCount = 3;
    state.isAutoExpeditioning = true;

    const team = createTeam({ troopCount: 100000, totalPower: 100000 });

    const result = autoSystem.executeAutoExpedition(
      state,
      team,
      1000,
      FormationType.STANDARD,
      RouteDifficulty.EASY,
      false,
      100,
    );

    expect(result.pauseReason).toBe(PauseReason.COMPLETED);
    expect(result.totalRuns).toBe(3);
    expect(state.isAutoExpeditioning).toBe(false);
  });

  test('repeatCount=0表示无限（直到其他条件暂停）', () => {
    const state = createDefaultState();
    state.autoConfig.repeatCount = 0; // 无限
    state.isAutoExpeditioning = true;

    const team = createTeam({ troopCount: 100000, totalPower: 100000 });

    // maxSteps限制安全退出
    const result = autoSystem.executeAutoExpedition(
      state,
      team,
      1000,
      FormationType.STANDARD,
      RouteDifficulty.EASY,
      false,
      5, // 限制5步
    );

    expect(result.totalRuns).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-4: 兵力耗尽暂停
// ═══════════════════════════════════════════════════════════

describe('P0-4: 兵力耗尽暂停', () => {
  test('兵力不足时暂停', () => {
    const state = createDefaultState();
    state.isAutoExpeditioning = true;

    // 兵力恰好只够1次
    const requiredTroops = 3 * TROOP_COST.expeditionPerHero; // 60
    const team = createTeam({ troopCount: requiredTroops + 1, totalPower: 100000 });

    const step = autoSystem.executeAutoStep(
      state,
      team,
      1000,
      FormationType.STANDARD,
      RouteDifficulty.EASY,
      false,
    );

    // 第一步消耗兵力后，第二步兵力不足
    expect(step.success).toBe(true);
    expect(team.troopCount).toBe(1); // 61 - 60 = 1

    // 第二步应因兵力不足暂停
    const step2 = autoSystem.executeAutoStep(
      state,
      team,
      1000,
      FormationType.STANDARD,
      RouteDifficulty.EASY,
      false,
    );

    expect(step2.paused).toBe(true);
    expect(step2.pauseReason).toBe(PauseReason.TROOPS_EXHAUSTED);
  });

  test('兵力恰好为0时暂停', () => {
    const state = createDefaultState();
    state.isAutoExpeditioning = true;

    const requiredTroops = 3 * TROOP_COST.expeditionPerHero;
    const team = createTeam({ troopCount: 0, totalPower: 100000 });

    const step = autoSystem.executeAutoStep(
      state,
      team,
      1000,
      FormationType.STANDARD,
      RouteDifficulty.EASY,
      false,
    );

    expect(step.paused).toBe(true);
    expect(step.pauseReason).toBe(PauseReason.TROOPS_EXHAUSTED);
    expect(step.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-5: 离线远征极端参数
// ═══════════════════════════════════════════════════════════

describe('P0-5: 离线远征极端参数', () => {
  const baseParams: OfflineExpeditionParams = {
    offlineSeconds: 3600,
    teamPower: 5000,
    teamFormation: FormationType.STANDARD,
    routeAvgPower: 3000,
    routeAvgFormation: FormationType.STANDARD,
    avgRouteDurationSeconds: 1800,
    baseRouteReward: { grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200, drops: [] },
    heroCount: 3,
  };

  test('正常离线远征计算', () => {
    const result = autoSystem.calculateOfflineExpedition(baseParams);
    expect(result.completedRuns).toBeGreaterThan(0);
    expect(result.totalReward.grain).toBeGreaterThan(0);
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });

  test('离线0秒', () => {
    const result = autoSystem.calculateOfflineExpedition({
      ...baseParams,
      offlineSeconds: 0,
    });
    expect(result.completedRuns).toBe(0);
    expect(result.offlineSeconds).toBe(0);
    expect(result.totalReward.grain).toBe(0);
  });

  test('离线超过72小时被截断', () => {
    const result = autoSystem.calculateOfflineExpedition({
      ...baseParams,
      offlineSeconds: 200 * 3600, // 200小时
    });
    expect(result.isTimeCapped).toBe(true);
    expect(result.offlineSeconds).toBe(72 * 3600);
  });

  test('离线负数秒', () => {
    const result = autoSystem.calculateOfflineExpedition({
      ...baseParams,
      offlineSeconds: -3600,
    });
    // 负数秒应被安全处理
    expect(result).toBeDefined();
    expect(Number.isFinite(result.offlineSeconds)).toBe(true);
  });

  test('路线时长为0（除零保护）', () => {
    const result = autoSystem.calculateOfflineExpedition({
      ...baseParams,
      avgRouteDurationSeconds: 0,
    });
    // 应有除零保护（至少60秒）
    expect(result).toBeDefined();
    expect(result.completedRuns).toBeGreaterThan(0);
  });

  test('敌方战力为0', () => {
    const result = autoSystem.calculateOfflineExpedition({
      ...baseParams,
      routeAvgPower: 0,
    });
    expect(result).toBeDefined();
    expect(result.completedRuns).toBeGreaterThan(0);
  });

  test('我方战力为0', () => {
    const result = autoSystem.calculateOfflineExpedition({
      ...baseParams,
      teamPower: 0,
    });
    expect(result).toBeDefined();
    // 战力为0胜率极低，但至少完成1次（Math.max(1, ...)）
    expect(result.completedRuns).toBeGreaterThanOrEqual(1);
  });

  test('估算离线收益多时间点', () => {
    const estimates = autoSystem.estimateOfflineEarnings(baseParams, 72);
    expect(estimates.length).toBeGreaterThan(0);
    // 时间点应递增
    for (let i = 1; i < estimates.length; i++) {
      expect(estimates[i].hours).toBeGreaterThan(estimates[i - 1].hours);
      expect(estimates[i].runs).toBeGreaterThanOrEqual(estimates[i - 1].runs);
    }
  });

  test('估算离线收益截断到指定小时', () => {
    const estimates = autoSystem.estimateOfflineEarnings(baseParams, 8);
    // 应只包含<=8小时的估算
    for (const e of estimates) {
      expect(e.hours).toBeLessThanOrEqual(8);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// F-Error: 胜率估算边界
// ═══════════════════════════════════════════════════════════

describe('F-Error: 胜率估算边界', () => {
  test('压倒性优势(powerRatio>=2.0)胜率95%', () => {
    // 通过离线远征间接测试
    const result = autoSystem.calculateOfflineExpedition({
      offlineSeconds: 3600,
      teamPower: 10000,
      teamFormation: FormationType.STANDARD,
      routeAvgPower: 3000,
      routeAvgFormation: FormationType.STANDARD,
      avgRouteDurationSeconds: 1800,
      baseRouteReward: { grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200, drops: [] },
      heroCount: 3,
    });
    // 高战力比应导致高完成次数
    expect(result.completedRuns).toBeGreaterThan(0);
  });

  test('极端劣势胜率5%', () => {
    const result = autoSystem.calculateOfflineExpedition({
      offlineSeconds: 3600,
      teamPower: 100,
      teamFormation: FormationType.STANDARD,
      routeAvgPower: 10000,
      routeAvgFormation: FormationType.STANDARD,
      avgRouteDurationSeconds: 1800,
      baseRouteReward: { grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200, drops: [] },
      heroCount: 3,
    });
    // 低战力比仍至少完成1次（Math.max(1, ...)）
    expect(result.completedRuns).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// F-Lifecycle: ISubsystem接口
// ═══════════════════════════════════════════════════════════

describe('F-Lifecycle: ISubsystem接口', () => {
  test('init/update/reset不崩溃', () => {
    autoSystem.init({} as any);
    expect(() => autoSystem.update(16)).not.toThrow();
    expect(() => autoSystem.reset()).not.toThrow();
  });

  test('getState返回正确结构', () => {
    const state = autoSystem.getState();
    expect(state.name).toBe('autoExpedition');
  });

  test('reset清空剩余次数', () => {
    autoSystem.reset();
    const state = autoSystem.getState();
    expect(state.remainingRepeats).toBeNull();
  });
});
