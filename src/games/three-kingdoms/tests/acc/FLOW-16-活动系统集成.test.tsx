/**
 * FLOW-16 活动系统集成测试 — 活动面板数据/活动参与/限时活动/活动奖励/苏格拉底边界
 *
 * 使用真实 ActivitySystem / TimedActivitySystem / TokenShopSystem / SignInSystem，
 * 通过 createSim() 创建引擎实例，不 mock 核心逻辑。
 *
 * 覆盖范围：
 * - 活动面板数据：活动列表、活动类型、活动状态、并行上限、签到数据
 * - 活动参与：参与活动、完成任务、领取奖励、里程碑解锁
 * - 限时活动：4阶段流程（预览→活跃→结算→关闭）、时间检查、过期处理
 * - 活动奖励：代币商店、奖励计算、排行榜奖励、签到奖励
 * - 苏格拉底边界：无活动、活动结束、重复领取、序列化恢复、重置
 *
 * @module tests/acc/FLOW-16
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// 活动系统核心
import {
  ActivitySystem,
  createDefaultActivityState,
  createActivityInstance,
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_OFFLINE_EFFICIENCY,
} from '../../engine/activity';

import {
  ActivityType,
  ActivityStatus,
  ActivityTaskType,
  ActivityTaskStatus,
  MilestoneStatus,
} from '../../engine/activity';

import type {
  ActivityDef,
  ActivityInstance,
  ActivityState,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityTask,
  SignInData,
} from '../../engine/activity';

// 限时活动系统
import {
  TimedActivitySystem,
  DEFAULT_LEADERBOARD_CONFIG,
  FESTIVAL_TEMPLATES,
} from '../../engine/activity';

import type {
  ActivityRankEntry,
} from '../../core/event/event-activity.types';

// 代币商店
import {
  TokenShopSystem,
} from '../../engine/activity';

// 签到系统
import {
  SignInSystem,
  DEFAULT_SIGN_IN_CONFIG,
  SIGN_IN_CYCLE_DAYS,
  createDefaultSignInData,
} from '../../engine/activity';

// 类型
import type { ISystemDeps } from '../../core/types/subsystem';

// ── 辅助函数 ──

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

const BASE_TIME = new Date('2024-06-01T00:00:00Z').getTime();
function dayOffset(days: number): number {
  return BASE_TIME + days * 24 * 60 * 60 * 1000;
}

function makeActivityDef(overrides?: Partial<ActivityDef>): ActivityDef {
  return {
    id: 'act-test-001',
    name: '测试活动',
    description: '集成测试活动',
    type: ActivityType.LIMITED_TIME,
    startTime: Date.now(),
    endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
    icon: '',
    ...overrides,
  };
}

function makeTaskDef(overrides?: Partial<ActivityTaskDef>): ActivityTaskDef {
  return {
    id: 'task-001',
    name: '击败敌军',
    description: '击败50次敌军',
    taskType: ActivityTaskType.DAILY,
    targetCount: 50,
    pointReward: 50,
    tokenReward: 100,
    resourceReward: { copper: 200 },
    ...overrides,
  };
}

function makeMilestone(overrides?: Partial<ActivityMilestone>): ActivityMilestone {
  return {
    id: 'ms-001',
    requiredPoints: 100,
    status: MilestoneStatus.LOCKED,
    rewards: { copper: 500, gold: 10 },
    isFinal: false,
    ...overrides,
  };
}

function createRankEntries(count: number): ActivityRankEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i}`,
    playerName: `玩家${i}`,
    points: (count - i) * 100,
    tokens: (count - i) * 10,
    rank: 0,
  }));
}

// ═══════════════════════════════════════════════════════════════
// FLOW-16 活动系统集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-16 活动系统集成测试', () => {
  let sim: GameEventSimulator;
  let activitySys: ActivitySystem;
  let timedSys: TimedActivitySystem;
  let shopSys: TokenShopSystem;
  let signInSys: SignInSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });

    const deps = mockDeps();
    activitySys = new ActivitySystem();
    activitySys.init(deps);

    timedSys = new TimedActivitySystem();
    timedSys.init(deps);

    shopSys = new TokenShopSystem();
    shopSys.init(deps);

    signInSys = new SignInSystem();
    signInSys.init(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. 活动面板数据（FLOW-16-01 ~ FLOW-16-05）
  // ═══════════════════════════════════════════════════════════

  describe('1. 活动面板数据', () => {

    it(accTest('FLOW-16-01', '活动列表 — 5类活动类型均存在'), () => {
      const types = Object.values(ActivityType);
      assertStrict(types.length === 5, 'FLOW-16-01',
        `应有5种活动类型，实际: ${types.length}`);

      assertStrict(types.includes(ActivityType.SEASON), 'FLOW-16-01', '应有赛季活动');
      assertStrict(types.includes(ActivityType.LIMITED_TIME), 'FLOW-16-01', '应有限时活动');
      assertStrict(types.includes(ActivityType.DAILY), 'FLOW-16-01', '应有日常活动');
      assertStrict(types.includes(ActivityType.FESTIVAL), 'FLOW-16-01', '应有节日活动');
      assertStrict(types.includes(ActivityType.ALLIANCE), 'FLOW-16-01', '应有联盟活动');
    });

    it(accTest('FLOW-16-02', '活动状态 — 3种状态枚举正确'), () => {
      const statuses = Object.values(ActivityStatus);
      assertStrict(statuses.length === 3, 'FLOW-16-02',
        `应有3种活动状态，实际: ${statuses.length}`);

      assertStrict(statuses.includes(ActivityStatus.UPCOMING), 'FLOW-16-02', '应有未开始状态');
      assertStrict(statuses.includes(ActivityStatus.ACTIVE), 'FLOW-16-02', '应有进行中状态');
      assertStrict(statuses.includes(ActivityStatus.ENDED), 'FLOW-16-02', '应有已结束状态');
    });

    it(accTest('FLOW-16-03', '活动并行上限 — 默认配置正确'), () => {
      const config = DEFAULT_CONCURRENCY_CONFIG;
      assertStrict(config.maxSeason === 1, 'FLOW-16-03',
        `赛季活动最大并行应为1，实际: ${config.maxSeason}`);
      assertStrict(config.maxLimitedTime === 2, 'FLOW-16-03',
        `限时活动最大并行应为2，实际: ${config.maxLimitedTime}`);
      assertStrict(config.maxDaily === 1, 'FLOW-16-03',
        `日常活动最大并行应为1，实际: ${config.maxDaily}`);
      assertStrict(config.maxFestival === 1, 'FLOW-16-03',
        `节日活动最大并行应为1，实际: ${config.maxFestival}`);
      assertStrict(config.maxAlliance === 1, 'FLOW-16-03',
        `联盟活动最大并行应为1，实际: ${config.maxAlliance}`);
      assertStrict(config.maxTotal === 5, 'FLOW-16-03',
        `总最大并行应为5，实际: ${config.maxTotal}`);
    });

    it(accTest('FLOW-16-04', '活动实例 — 创建活动实例结构完整'), () => {
      const def = makeActivityDef();
      const tasks = [makeTaskDef()];
      const milestones = [makeMilestone()];
      const state: ActivityState = createDefaultActivityState();

      const newState = activitySys.startActivity(state, def, tasks, milestones, Date.now());
      const instance = newState.activities[def.id];

      assertStrict(!!instance, 'FLOW-16-04', '应创建活动实例');
      assertStrict(instance!.status === ActivityStatus.ACTIVE, 'FLOW-16-04',
        `状态应为ACTIVE，实际: ${instance!.status}`);
      assertStrict(instance!.points === 0, 'FLOW-16-04',
        `初始积分应为0，实际: ${instance!.points}`);
      assertStrict(instance!.tokens === 0, 'FLOW-16-04',
        `初始代币应为0，实际: ${instance!.tokens}`);
      assertStrict(instance!.tasks.length === 1, 'FLOW-16-04',
        `应有1个任务，实际: ${instance!.tasks.length}`);
      assertStrict(instance!.milestones.length === 1, 'FLOW-16-04',
        `应有1个里程碑，实际: ${instance!.milestones.length}`);
    });

    it(accTest('FLOW-16-05', '签到数据 — 默认签到状态正确'), () => {
      const signInData = createDefaultSignInData();
      assertStrict(signInData.consecutiveDays === 0, 'FLOW-16-05',
        `初始连续天数应为0，实际: ${signInData.consecutiveDays}`);
      assertStrict(signInData.todaySigned === false, 'FLOW-16-05',
        `初始今日签到应为false`);
      assertStrict(signInData.weeklyRetroactiveCount === 0, 'FLOW-16-05',
        `初始补签次数应为0`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 活动参与（FLOW-16-06 ~ FLOW-16-10）
  // ═══════════════════════════════════════════════════════════

  describe('2. 活动参与', () => {

    it(accTest('FLOW-16-06', '参与活动 — 启动活动并创建任务'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-join-001' });
      const tasks = [
        makeTaskDef({ id: 't1', name: '击败敌军', targetCount: 10 }),
        makeTaskDef({ id: 't2', name: '收集资源', targetCount: 20, taskType: ActivityTaskType.CUMULATIVE }),
      ];

      const newState = activitySys.startActivity(state, def, tasks, []);
      const instance = newState.activities['act-join-001'];

      assertStrict(!!instance, 'FLOW-16-06', '活动实例应存在');
      assertStrict(instance!.tasks.length === 2, 'FLOW-16-06',
        `应有2个任务，实际: ${instance!.tasks.length}`);
      assertStrict(instance!.tasks[0].status === ActivityTaskStatus.INCOMPLETE, 'FLOW-16-06',
        '初始任务状态应为INCOMPLETE');
    });

    it(accTest('FLOW-16-07', '参与活动 — 更新任务进度'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-prog-001' });
      const taskDef = makeTaskDef({ id: 't1', targetCount: 50 });
      let newState = activitySys.startActivity(state, def, [taskDef], []);

      newState = activitySys.updateTaskProgress(newState, 'act-prog-001', 't1', 30);
      const task = newState.activities['act-prog-001'].tasks[0];

      assertStrict(task.currentProgress === 30, 'FLOW-16-07',
        `进度应为30，实际: ${task.currentProgress}`);
      assertStrict(task.status === ActivityTaskStatus.INCOMPLETE, 'FLOW-16-07',
        `未完成目标时状态应为INCOMPLETE，实际: ${task.status}`);
    });

    it(accTest('FLOW-16-08', '参与活动 — 完成任务条件后状态变更'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-comp-001' });
      const taskDef = makeTaskDef({ id: 't1', targetCount: 50 });
      let newState = activitySys.startActivity(state, def, [taskDef], []);

      newState = activitySys.updateTaskProgress(newState, 'act-comp-001', 't1', 50);
      const task = newState.activities['act-comp-001'].tasks[0];

      assertStrict(task.status === ActivityTaskStatus.COMPLETED, 'FLOW-16-08',
        `完成目标后状态应为COMPLETED，实际: ${task.status}`);
    });

    it(accTest('FLOW-16-09', '参与活动 — 领取任务奖励'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-claim-001' });
      const taskDef = makeTaskDef({ id: 't1', targetCount: 50, pointReward: 100, tokenReward: 200 });
      let newState = activitySys.startActivity(state, def, [taskDef], []);
      newState = activitySys.updateTaskProgress(newState, 'act-claim-001', 't1', 50);

      const result = activitySys.claimTaskReward(newState, 'act-claim-001', 't1');
      assertStrict(result.points === 100, 'FLOW-16-09',
        `应获得100积分，实际: ${result.points}`);
      assertStrict(result.tokens === 200, 'FLOW-16-09',
        `应获得200代币，实际: ${result.tokens}`);
    });

    it(accTest('FLOW-16-10', '参与活动 — 里程碑按积分解锁'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-milestone-001' });
      const ms1 = makeMilestone({ id: 'ms1', requiredPoints: 100, rewards: { gold: 200 } });
      const ms2 = makeMilestone({ id: 'ms2', requiredPoints: 500, rewards: { gold: 1000 } });
      let newState = activitySys.startActivity(state, def, [], [ms1, ms2]);

      // 设置积分为150，只解锁第一个里程碑
      newState.activities['act-milestone-001'].points = 150;
      newState = activitySys.checkMilestones(newState, 'act-milestone-001');

      const milestones = newState.activities['act-milestone-001'].milestones;
      assertStrict(milestones[0].status === MilestoneStatus.UNLOCKED, 'FLOW-16-10',
        `100积分里程碑应解锁，实际: ${milestones[0].status}`);
      assertStrict(milestones[1].status === MilestoneStatus.LOCKED, 'FLOW-16-10',
        `500积分里程碑应锁定，实际: ${milestones[1].status}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 限时活动（FLOW-16-11 ~ FLOW-16-15）
  // ═══════════════════════════════════════════════════════════

  describe('3. 限时活动', () => {

    it(accTest('FLOW-16-11', '限时活动 — 预览阶段不可参与'), () => {
      const now = Date.now();
      const activeStart = now + 24 * 60 * 60 * 1000; // 明天开始
      const activeEnd = activeStart + 7 * 24 * 60 * 60 * 1000;

      timedSys.createTimedActivityFlow('timed-001', activeStart, activeEnd);

      const canJoin = timedSys.canParticipate('timed-001', now);
      assertStrict(!canJoin, 'FLOW-16-11', '预览阶段不应可参与');

      const phase = timedSys.updatePhase('timed-001', now);
      assertStrict(phase === 'preview', 'FLOW-16-11',
        `阶段应为preview，实际: ${phase}`);
    });

    it(accTest('FLOW-16-12', '限时活动 — 活跃阶段可参与'), () => {
      const now = Date.now();
      const activeStart = now - 1000; // 已开始
      const activeEnd = now + 7 * 24 * 60 * 60 * 1000;

      timedSys.createTimedActivityFlow('timed-002', activeStart, activeEnd);
      const phase = timedSys.updatePhase('timed-002', now);

      assertStrict(phase === 'active', 'FLOW-16-12',
        `阶段应为active，实际: ${phase}`);
      assertStrict(timedSys.canParticipate('timed-002', now), 'FLOW-16-12',
        '活跃阶段应可参与');
    });

    it(accTest('FLOW-16-13', '限时活动 — 结算阶段计算排行奖励'), () => {
      const now = Date.now();
      const activeStart = now - 8 * 24 * 60 * 60 * 1000;
      const activeEnd = now - 1000; // 刚结束

      timedSys.createTimedActivityFlow('timed-003', activeStart, activeEnd);
      const phase = timedSys.updatePhase('timed-003', now);
      assertStrict(phase === 'settlement', 'FLOW-16-13',
        `阶段应为settlement，实际: ${phase}`);

      // 计算排行奖励
      const rewards = timedSys.calculateRankRewards(1);
      assertStrict(rewards.gold === 500, 'FLOW-16-13',
        `第1名应获得500元宝，实际: ${rewards.gold}`);
    });

    it(accTest('FLOW-16-14', '限时活动 — 关闭阶段不可参与'), () => {
      const now = Date.now();
      const activeStart = now - 10 * 24 * 60 * 60 * 1000;
      const activeEnd = now - 3 * 60 * 60 * 1000; // 超过结算期

      timedSys.createTimedActivityFlow('timed-004', activeStart, activeEnd);
      const phase = timedSys.updatePhase('timed-004', now);

      assertStrict(phase === 'closed', 'FLOW-16-14',
        `阶段应为closed，实际: ${phase}`);
      assertStrict(!timedSys.canParticipate('timed-004', now), 'FLOW-16-14',
        '关闭阶段不应可参与');
    });

    it(accTest('FLOW-16-15', '限时活动 — 剩余时间计算正确'), () => {
      const now = Date.now();
      const end = now + 3600000; // 1小时后结束

      timedSys.createTimedActivityFlow('timed-005', now, end);

      const remaining = timedSys.getRemainingTime('timed-005', now + 1800000);
      assertStrict(remaining === 1800000, 'FLOW-16-15',
        `剩余时间应为1800000ms，实际: ${remaining}`);

      // 已过期的活动剩余时间为0
      const expired = timedSys.getRemainingTime('timed-005', now + 7200000);
      assertStrict(expired === 0, 'FLOW-16-15',
        `过期后剩余时间应为0，实际: ${expired}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 活动奖励（FLOW-16-16 ~ FLOW-16-20）
  // ═══════════════════════════════════════════════════════════

  describe('4. 活动奖励', () => {

    it(accTest('FLOW-16-16', '代币商店 — 代币余额与购买'), () => {
      shopSys.addTokens(500);
      assertStrict(shopSys.getTokenBalance() === 500, 'FLOW-16-16',
        `代币余额应为500，实际: ${shopSys.getTokenBalance()}`);

      const items = shopSys.getAvailableItems();
      if (items.length > 0 && items[0].tokenPrice <= 500) {
        const price = items[0].tokenPrice;
        const result = shopSys.purchaseItem(items[0].id);
        assertStrict(result.success, 'FLOW-16-16',
          `购买应成功: ${result.reason ?? ''}`);
        assertStrict(shopSys.getTokenBalance() === 500 - price, 'FLOW-16-16',
          `余额应为${500 - price}，实际: ${shopSys.getTokenBalance()}`);
      }
    });

    it(accTest('FLOW-16-17', '奖励计算 — 排行榜奖励梯度正确'), () => {
      // rank 1 → gold 500, rank 2-3 → gold 300, rank 4-10 → gold 150
      assertStrict(timedSys.calculateRankRewards(1).gold === 500, 'FLOW-16-17',
        '第1名应获得500元宝');
      assertStrict(timedSys.calculateRankRewards(2).gold === 300, 'FLOW-16-17',
        '第2名应获得300元宝');
      assertStrict(timedSys.calculateRankRewards(3).gold === 300, 'FLOW-16-17',
        '第3名应获得300元宝');
      assertStrict(timedSys.calculateRankRewards(5).gold === 150, 'FLOW-16-17',
        '第5名应获得150元宝');
      assertStrict(timedSys.calculateRankRewards(20).gold === 50, 'FLOW-16-17',
        '第20名应获得50元宝');
    });

    it(accTest('FLOW-16-18', '奖励计算 — 排行榜按积分降序排列'), () => {
      const entries: ActivityRankEntry[] = [
        { playerId: 'p1', playerName: '玩家A', points: 500, tokens: 20, rank: 0 },
        { playerId: 'p2', playerName: '玩家B', points: 1200, tokens: 50, rank: 0 },
        { playerId: 'p3', playerName: '玩家C', points: 800, tokens: 30, rank: 0 },
      ];

      const sorted = timedSys.updateLeaderboard('lb-001', entries);
      assertStrict(sorted[0].playerId === 'p2', 'FLOW-16-18',
        `第1名应为p2(1200分)，实际: ${sorted[0].playerId}`);
      assertStrict(sorted[0].rank === 1, 'FLOW-16-18',
        `第1名rank应为1，实际: ${sorted[0].rank}`);
      assertStrict(sorted[1].playerId === 'p3', 'FLOW-16-18',
        `第2名应为p3(800分)，实际: ${sorted[1].playerId}`);
      assertStrict(sorted[2].playerId === 'p1', 'FLOW-16-18',
        `第3名应为p1(500分)，实际: ${sorted[2].playerId}`);
    });

    it(accTest('FLOW-16-19', '签到奖励 — 连续签到加成计算'), () => {
      // 不足3天无加成
      assertStrict(signInSys.getConsecutiveBonus(1) === 0, 'FLOW-16-19',
        '1天连续应无加成');
      assertStrict(signInSys.getConsecutiveBonus(2) === 0, 'FLOW-16-19',
        '2天连续应无加成');

      // 连续3天20%加成
      assertStrict(signInSys.getConsecutiveBonus(3) === DEFAULT_SIGN_IN_CONFIG.consecutive3Bonus, 'FLOW-16-19',
        '3天连续应有加成');

      // 连续7天50%加成
      assertStrict(signInSys.getConsecutiveBonus(7) === DEFAULT_SIGN_IN_CONFIG.consecutive7Bonus, 'FLOW-16-19',
        '7天连续应有加成');
    });

    it(accTest('FLOW-16-20', '奖励计算 — 里程碑奖励领取'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-reward-001' });
      const ms = makeMilestone({ id: 'ms1', requiredPoints: 100, rewards: { copper: 500, gold: 20 } });
      let newState = activitySys.startActivity(state, def, [], [ms]);

      // 设置积分并检查里程碑
      newState.activities['act-reward-001'].points = 150;
      newState = activitySys.checkMilestones(newState, 'act-reward-001');

      // 领取里程碑奖励
      const result = activitySys.claimMilestone(newState, 'act-reward-001', 'ms1');
      assertStrict(result.rewards.copper === 500, 'FLOW-16-20',
        `应获得500铜钱，实际: ${result.rewards.copper}`);
      assertStrict(result.rewards.gold === 20, 'FLOW-16-20',
        `应获得20元宝，实际: ${result.rewards.gold}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 苏格拉底边界（FLOW-16-21 ~ FLOW-16-25）
  // ═══════════════════════════════════════════════════════════

  describe('5. 苏格拉底边界', () => {

    it(accTest('FLOW-16-21', '边界 — 无活动时状态为空'), () => {
      const state = createDefaultActivityState();
      const activityCount = Object.keys(state.activities).length;
      assertStrict(activityCount === 0, 'FLOW-16-21',
        `初始应无活动，实际: ${activityCount}`);
    });

    it(accTest('FLOW-16-22', '边界 — 活动结束后不可参与'), () => {
      const now = Date.now();
      // 活动已经结束（过去的时间范围）
      const activeStart = now - 10 * 24 * 60 * 60 * 1000;
      const activeEnd = now - 5 * 24 * 60 * 60 * 1000;

      timedSys.createTimedActivityFlow('expired-001', activeStart, activeEnd);
      const phase = timedSys.updatePhase('expired-001', now);

      assertStrict(phase === 'closed', 'FLOW-16-22',
        `已结束活动应为closed阶段，实际: ${phase}`);
      assertStrict(!timedSys.canParticipate('expired-001', now), 'FLOW-16-22',
        '已结束活动不应可参与');
    });

    it(accTest('FLOW-16-23', '边界 — 重复领取任务奖励抛异常'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-dup-001' });
      const taskDef = makeTaskDef({ id: 't1', targetCount: 10 });
      let newState = activitySys.startActivity(state, def, [taskDef], []);
      newState = activitySys.updateTaskProgress(newState, 'act-dup-001', 't1', 10);

      // 第一次领取成功
      const first = activitySys.claimTaskReward(newState, 'act-dup-001', 't1');
      assertStrict(first.points > 0, 'FLOW-16-23', '第一次领取应成功');

      // 第二次领取应抛异常
      let threw = false;
      try {
        activitySys.claimTaskReward(first.state, 'act-dup-001', 't1');
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('已领取'), 'FLOW-16-23',
          `错误信息应包含"已领取"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-16-23', '重复领取应抛异常');
    });

    it(accTest('FLOW-16-24', '边界 — 序列化/反序列化保持活动状态'), () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef({ id: 'act-serial-001' });
      const tasks = [makeTaskDef({ id: 't1', targetCount: 10 })];
      const ms = [makeMilestone({ id: 'ms1', requiredPoints: 100 })];
      let newState = activitySys.startActivity(state, def, tasks, ms);
      newState = activitySys.updateTaskProgress(newState, 'act-serial-001', 't1', 5);
      newState.activities['act-serial-001'].points = 50;

      // 序列化
      const saveData = activitySys.serialize(newState);
      assertStrict(saveData.version === 1, 'FLOW-16-24',
        `版本应为1，实际: ${saveData.version}`);

      // 反序列化
      const restored = activitySys.deserialize(saveData);
      const restoredInstance = restored.activities['act-serial-001'];
      assertStrict(!!restoredInstance, 'FLOW-16-24', '反序列化后活动应存在');
      assertStrict(restoredInstance!.points === 50, 'FLOW-16-24',
        `积分应为50，实际: ${restoredInstance!.points}`);
      assertStrict(restoredInstance!.tasks[0].currentProgress === 5, 'FLOW-16-24',
        `任务进度应为5，实际: ${restoredInstance!.tasks[0].currentProgress}`);
    });

    it(accTest('FLOW-16-25', '边界 — 代币不足时购买失败'), () => {
      // 初始余额为0
      assertStrict(shopSys.getTokenBalance() === 0, 'FLOW-16-25',
        '初始代币应为0');

      const items = shopSys.getAvailableItems();
      if (items.length > 0) {
        const result = shopSys.purchaseItem(items[0].id);
        assertStrict(!result.success, 'FLOW-16-25', '代币不足购买应失败');
        assertStrict(result.reason?.includes('不足'), 'FLOW-16-25',
          `原因应包含"不足"，实际: ${result.reason}`);
      }
    });

    // ── 额外边界用例（FLOW-16-26 ~ FLOW-16-30） ──

    it(accTest('FLOW-16-26', '边界 — 不存在的活动返回closed'), () => {
      const phase = timedSys.updatePhase('nonexistent-activity', Date.now());
      assertStrict(phase === 'closed', 'FLOW-16-26',
        `不存在的活动应为closed，实际: ${phase}`);
    });

    it(accTest('FLOW-16-27', '边界 — 同一天重复签到抛异常'), () => {
      const data = createDefaultSignInData();
      const result = signInSys.signIn(data, BASE_TIME);
      assertStrict(result.data.todaySigned, 'FLOW-16-27', '第一次签到应成功');

      let threw = false;
      try {
        signInSys.signIn(result.data, BASE_TIME);
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('今日已签到'), 'FLOW-16-27',
          `错误信息应包含"今日已签到"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-16-27', '重复签到应抛异常');
    });

    it(accTest('FLOW-16-28', '边界 — 排行榜裁剪到最大条目数'), () => {
      const entries = createRankEntries(150);
      const sorted = timedSys.updateLeaderboard('lb-trim', entries);
      assertStrict(sorted.length <= 100, 'FLOW-16-28',
        `排行榜应裁剪到≤100条，实际: ${sorted.length}`);
    });

    it(accTest('FLOW-16-29', '边界 — 限购商品达到上限后不可购买'), () => {
      shopSys.addTokens(100000);
      const items = shopSys.getAvailableItems();
      const limitedItem = items.find(i => i.purchaseLimit > 0);

      if (limitedItem) {
        // 买满限购
        for (let i = 0; i < limitedItem.purchaseLimit; i++) {
          shopSys.purchaseItem(limitedItem.id);
        }
        // 再次购买应失败
        const result = shopSys.purchaseItem(limitedItem.id);
        assertStrict(!result.success, 'FLOW-16-29', '达到限购上限应失败');
        assertStrict(result.reason?.includes('限购'), 'FLOW-16-29',
          `原因应包含"限购"，实际: ${result.reason}`);
      }
    });

    it(accTest('FLOW-16-30', '边界 — 节日活动模板完整'), () => {
      const templates = FESTIVAL_TEMPLATES;
      assertStrict(templates.length >= 5, 'FLOW-16-30',
        `应有至少5个节日模板，实际: ${templates.length}`);

      // 验证春节模板
      const spring = timedSys.getFestivalTemplate('spring');
      assertStrict(!!spring, 'FLOW-16-30', '春节模板应存在');
      assertStrict(spring!.name.includes('春节'), 'FLOW-16-30',
        `春节模板名称应包含"春节"，实际: ${spring!.name}`);

      // 创建节日活动
      const festival = timedSys.createFestivalActivity('spring', Date.now(), 7);
      assertStrict(!!festival, 'FLOW-16-30', '创建春节活动应成功');
      assertStrict(festival!.flow !== undefined, 'FLOW-16-30', '节日活动应有流程数据');

      // 不存在的节日类型
      const invalid = timedSys.createFestivalActivity('nonexistent' as any, Date.now());
      assertStrict(invalid === null, 'FLOW-16-30', '不存在的节日类型应返回null');
    });
  });
});
