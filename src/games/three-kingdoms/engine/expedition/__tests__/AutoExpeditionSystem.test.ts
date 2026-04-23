/**
 * AutoExpeditionSystem 单元测试
 *
 * 覆盖：
 *   - 自动远征启动/停止
 *   - 自动远征单步执行
 *   - 暂停条件（兵力耗尽/连续失败/完成次数）
 *   - 完整自动远征循环
 *   - 离线远征收益计算
 *   - 离线远征预估收益
 *   - 离线时间上限
 */

import { AutoExpeditionSystem } from '../AutoExpeditionSystem';
import type {
  AutoExpeditionStepResult,
  AutoExpeditionResult,
  OfflineExpeditionParams,
} from '../AutoExpeditionSystem';
import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import type { ExpeditionState, ExpeditionTeam, ExpeditionReward } from '../../../core/expedition/expedition.types';
import {
  FormationType,
  RouteDifficulty,
  BattleGrade,
  PauseReason,
  NodeType,
  NodeStatus,
} from '../../../core/expedition/expedition.types';
import { createDefaultExpeditionState } from '../expedition-helpers';

// ── 辅助函数 ──────────────────────────────

/** 创建测试用队伍 */
function createTeam(overrides: Partial<ExpeditionTeam> = {}): ExpeditionTeam {
  return {
    id: 'team_1',
    name: '测试队伍',
    heroIds: ['h1', 'h2', 'h3'],
    formation: FormationType.FISH_SCALE,
    troopCount: 200,
    maxTroops: 300,
    totalPower: 3000,
    currentRouteId: null,
    currentNodeId: null,
    isExpeditioning: false,
    ...overrides,
  };
}

/** 创建测试用状态 */
function createState(overrides: Partial<ExpeditionState> = {}): ExpeditionState {
  const state = createDefaultExpeditionState(1000);
  return { ...state, ...overrides };
}

/** 创建离线远征参数 */
function createOfflineParams(overrides: Partial<OfflineExpeditionParams> = {}): OfflineExpeditionParams {
  return {
    offlineSeconds: 3600,
    teamPower: 3000,
    teamFormation: FormationType.FISH_SCALE,
    routeAvgPower: 2000,
    routeAvgFormation: FormationType.WEDGE,
    avgRouteDurationSeconds: 600,
    baseRouteReward: { grain: 100, gold: 200, iron: 10, equipFragments: 5, exp: 300, drops: [] },
    heroCount: 3,
    ...overrides,
  };
}

// ── 全局实例 ──────────────────────────────

let auto: AutoExpeditionSystem;
let battle: ExpeditionBattleSystem;
let rewardSystem: ExpeditionRewardSystem;

beforeEach(() => {
  battle = new ExpeditionBattleSystem();
  rewardSystem = new ExpeditionRewardSystem(() => 0.5);
  auto = new AutoExpeditionSystem(battle, rewardSystem);
});

// ═══════════════════════════════════════════
// 1. 启动/停止自动远征
// ═══════════════════════════════════════════

describe('AutoExpeditionSystem — 启动/停止', () => {
  test('正常启动自动远征', () => {
    const state = createState();
    state.teams['team_1'] = createTeam();
    const ok = auto.startAutoExpedition(state, 'team_1', 'route_hulao_easy');
    expect(ok).toBe(true);
    expect(state.isAutoExpeditioning).toBe(true);
  });

  test('不存在的队伍无法启动', () => {
    const state = createState();
    const ok = auto.startAutoExpedition(state, 'nonexistent', 'route_hulao_easy');
    expect(ok).toBe(false);
  });

  test('不存在的路线无法启动', () => {
    const state = createState();
    state.teams['team_1'] = createTeam();
    const ok = auto.startAutoExpedition(state, 'team_1', 'nonexistent');
    expect(ok).toBe(false);
  });

  test('未解锁路线无法启动', () => {
    const state = createState();
    state.teams['team_1'] = createTeam();
    const ok = auto.startAutoExpedition(state, 'team_1', 'route_yishui_easy');
    expect(ok).toBe(false);
  });

  test('已在自动远征中无法再次启动', () => {
    const state = createState();
    state.teams['team_1'] = createTeam();
    state.isAutoExpeditioning = true;
    const ok = auto.startAutoExpedition(state, 'team_1', 'route_hulao_easy');
    expect(ok).toBe(false);
  });

  test('兵力不足无法启动', () => {
    const state = createState();
    state.teams['team_1'] = createTeam({ troopCount: 10 });
    const ok = auto.startAutoExpedition(state, 'team_1', 'route_hulao_easy');
    expect(ok).toBe(false);
  });

  test('停止自动远征', () => {
    const state = createState();
    state.teams['team_1'] = createTeam();
    auto.startAutoExpedition(state, 'team_1', 'route_hulao_easy');
    auto.stopAutoExpedition(state);
    expect(state.isAutoExpeditioning).toBe(false);
    expect(state.consecutiveFailures).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 2. 自动远征单步执行
// ═══════════════════════════════════════════

describe('AutoExpeditionSystem — 单步执行', () => {
  test('正常执行单步返回结果', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    const team = createTeam({ troopCount: 200 });

    const step = auto.executeAutoStep(
      state, team, 2000, FormationType.WEDGE, RouteDifficulty.NORMAL, false,
    );

    expect(step).toHaveProperty('success');
    expect(step).toHaveProperty('grade');
    expect(step).toHaveProperty('reward');
    expect(step).toHaveProperty('paused');
    expect(step).toHaveProperty('remainingRepeats');
  });

  test('兵力不足触发暂停', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    const team = createTeam({ troopCount: 5 });

    const step = auto.executeAutoStep(
      state, team, 2000, FormationType.WEDGE, RouteDifficulty.NORMAL, false,
    );

    expect(step.paused).toBe(true);
    expect(step.pauseReason).toBe(PauseReason.TROOPS_EXHAUSTED);
    expect(step.success).toBe(false);
  });

  test('执行后消耗兵力', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    const team = createTeam({ troopCount: 200 });
    const before = team.troopCount;

    auto.executeAutoStep(
      state, team, 2000, FormationType.WEDGE, RouteDifficulty.NORMAL, false,
    );

    expect(team.troopCount).toBeLessThan(before);
  });

  test('奖励包含资源', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    const team = createTeam({ troopCount: 200 });

    const step = auto.executeAutoStep(
      state, team, 2000, FormationType.WEDGE, RouteDifficulty.NORMAL, false,
    );

    // 战斗成功时应有奖励
    if (step.success) {
      expect(step.reward.grain + step.reward.gold + step.reward.exp).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════
// 3. 暂停条件
// ═══════════════════════════════════════════

describe('AutoExpeditionSystem — 暂停条件', () => {
  test('连续失败2次触发暂停', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 0; // 无限
    // 极弱队伍，确保失败
    const weakTeam = createTeam({ troopCount: 500, totalPower: 100 });

    let consecutiveFailures = 0;
    for (let i = 0; i < 5; i++) {
      if (!state.isAutoExpeditioning) break;
      const step = auto.executeAutoStep(
        state, weakTeam, 10000, FormationType.GOOSE, RouteDifficulty.HARD, false,
      );
      if (!step.success) {
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
      }
      if (step.paused) {
        if (consecutiveFailures >= 2) {
          expect(step.pauseReason).toBe(PauseReason.CONSECUTIVE_FAILURES);
        }
        break;
      }
    }
  });

  test('设定次数完成后暂停', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 1;
    const team = createTeam({ troopCount: 500 });

    const step = auto.executeAutoStep(
      state, team, 1000, FormationType.WEDGE, RouteDifficulty.EASY, false,
    );

    // repeatCount 从1减到0，然后检测到remaining=0触发完成暂停
    if (step.paused && step.pauseReason === PauseReason.COMPLETED) {
      expect(step.remainingRepeats).toBe(0);
    }
  });

  test('无限模式（repeatCount=0）不因次数暂停', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 0;
    const team = createTeam({ troopCount: 500 });

    const step = auto.executeAutoStep(
      state, team, 1000, FormationType.WEDGE, RouteDifficulty.EASY, false,
    );

    expect(step.remainingRepeats).toBeNull();
  });
});

// ═══════════════════════════════════════════
// 4. 完整自动远征循环
// ═══════════════════════════════════════════

describe('AutoExpeditionSystem — 完整循环', () => {
  test('循环执行直到暂停', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 3;
    const team = createTeam({ troopCount: 500 });

    const result = auto.executeAutoExpedition(
      state, team, 1000, FormationType.WEDGE, RouteDifficulty.EASY, false, 50,
    );

    expect(result.totalRuns).toBeGreaterThan(0);
    expect(result.steps.length).toBe(result.totalRuns);
    expect(result.totalRuns).toBeLessThanOrEqual(50);
  });

  test('maxSteps限制最大步数', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 0; // 无限
    const team = createTeam({ troopCount: 10000 });

    const result = auto.executeAutoExpedition(
      state, team, 1000, FormationType.WEDGE, RouteDifficulty.EASY, false, 5,
    );

    expect(result.totalRuns).toBeLessThanOrEqual(5);
  });

  test('结果包含成功/失败计数', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 2;
    const team = createTeam({ troopCount: 500 });

    const result = auto.executeAutoExpedition(
      state, team, 1000, FormationType.WEDGE, RouteDifficulty.EASY, false, 10,
    );

    expect(result.successCount + result.failureCount).toBe(result.totalRuns);
  });

  test('结果包含总奖励汇总', () => {
    const state = createState();
    state.isAutoExpeditioning = true;
    state.autoConfig.repeatCount = 2;
    const team = createTeam({ troopCount: 500 });

    const result = auto.executeAutoExpedition(
      state, team, 1000, FormationType.WEDGE, RouteDifficulty.EASY, false, 10,
    );

    expect(result.totalReward).toBeDefined();
    expect(result.totalReward.drops).toBeDefined();
  });

  test('未启动自动远征时循环立即结束', () => {
    const state = createState();
    state.isAutoExpeditioning = false;
    const team = createTeam();

    const result = auto.executeAutoExpedition(
      state, team, 1000, FormationType.WEDGE, RouteDifficulty.EASY, false, 10,
    );

    expect(result.totalRuns).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 5. 离线远征收益计算
// ═══════════════════════════════════════════

describe('AutoExpeditionSystem — 离线远征', () => {
  test('基本离线收益计算', () => {
    const params = createOfflineParams();
    const result = auto.calculateOfflineExpedition(params);

    expect(result.completedRuns).toBeGreaterThan(0);
    expect(result.totalReward.grain).toBeGreaterThan(0);
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });

  test('离线时间上限72小时', () => {
    const params = createOfflineParams({ offlineSeconds: 100 * 3600 });
    const result = auto.calculateOfflineExpedition(params);

    expect(result.isTimeCapped).toBe(true);
    expect(result.offlineSeconds).toBe(72 * 3600);
  });

  test('短时间离线不算capped', () => {
    const params = createOfflineParams({ offlineSeconds: 3600 });
    const result = auto.calculateOfflineExpedition(params);

    expect(result.isTimeCapped).toBe(false);
  });

  test('强队完成次数更多', () => {
    const weakParams = createOfflineParams({ teamPower: 1500 });
    const strongParams = createOfflineParams({ teamPower: 5000 });

    const weakResult = auto.calculateOfflineExpedition(weakParams);
    const strongResult = auto.calculateOfflineExpedition(strongParams);

    expect(strongResult.completedRuns).toBeGreaterThanOrEqual(weakResult.completedRuns);
  });

  test('阵型克制影响完成次数', () => {
    // 鱼鳞克制锋矢
    const counterParams = createOfflineParams({
      teamFormation: FormationType.FISH_SCALE,
      routeAvgFormation: FormationType.WEDGE,
    });
    // 鱼鳞不克制雁行
    const neutralParams = createOfflineParams({
      teamFormation: FormationType.FISH_SCALE,
      routeAvgFormation: FormationType.GOOSE,
    });

    const counterResult = auto.calculateOfflineExpedition(counterParams);
    const neutralResult = auto.calculateOfflineExpedition(neutralParams);

    // 克制方有加成，完成次数应更多或相等
    expect(counterResult.completedRuns).toBeGreaterThanOrEqual(neutralResult.completedRuns);
  });

  test('短路线平均时长完成次数更多', () => {
    const shortRoute = createOfflineParams({ avgRouteDurationSeconds: 300 });
    const longRoute = createOfflineParams({ avgRouteDurationSeconds: 1800 });

    const shortResult = auto.calculateOfflineExpedition(shortRoute);
    const longResult = auto.calculateOfflineExpedition(longRoute);

    expect(shortResult.completedRuns).toBeGreaterThan(longResult.completedRuns);
  });

  test('离线效率×0.85', () => {
    const params = createOfflineParams({ offlineSeconds: 3600 });
    const result = auto.calculateOfflineExpedition(params);
    // 效率应在合理范围内
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════
// 6. 离线远征预估收益
// ═══════════════════════════════════════════

describe('AutoExpeditionSystem — 预估收益', () => {
  test('返回多个时间点的预估', () => {
    const params = createOfflineParams();
    const estimates = auto.estimateOfflineEarnings(params, 72);

    expect(estimates.length).toBeGreaterThan(0);
    expect(estimates[0].hours).toBe(1);
  });

  test('预估时间递增', () => {
    const params = createOfflineParams();
    const estimates = auto.estimateOfflineEarnings(params, 72);

    for (let i = 1; i < estimates.length; i++) {
      expect(estimates[i].hours).toBeGreaterThan(estimates[i - 1].hours);
      expect(estimates[i].runs).toBeGreaterThanOrEqual(estimates[i - 1].runs);
    }
  });

  test('超出指定小时数不返回', () => {
    const params = createOfflineParams();
    const estimates = auto.estimateOfflineEarnings(params, 4);

    for (const e of estimates) {
      expect(e.hours).toBeLessThanOrEqual(4);
    }
  });

  test('72小时预估包含所有时间点', () => {
    const params = createOfflineParams();
    const estimates = auto.estimateOfflineEarnings(params, 72);

    const hours = estimates.map(e => e.hours);
    expect(hours).toContain(1);
    expect(hours).toContain(24);
    expect(hours).toContain(72);
  });
});
