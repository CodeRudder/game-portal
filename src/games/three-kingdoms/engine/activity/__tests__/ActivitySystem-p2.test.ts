import {
  ActivitySystem,
  createDefaultActivityState,
  createMilestone,
  ACTIVITY_SAVE_VERSION,
} from '../ActivitySystem';

import type {
  ActivityDef,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityState,
} from '../../../core/activity/activity.types';

import {
  ActivityType,
  ActivityTaskType,
  MilestoneStatus,
} from '../../../core/activity/activity.types';

// ─── 辅助 ────────────────────────────────────

function createActivityDef(
  id: string,
  type: ActivityType,
  overrides?: Partial<ActivityDef>,
): ActivityDef {
  return {
    id,
    name: `活动_${id}`,
    description: `测试活动 ${id}`,
    type,
    startTime: Date.now() - 1000,
    endTime: Date.now() + 86400000,
    icon: `icon_${id}`,
    ...overrides,
  };
}

function createTaskDef(
  id: string,
  taskType: ActivityTaskType,
  overrides?: Partial<ActivityTaskDef>,
): ActivityTaskDef {
  return {
    id,
    name: `任务_${id}`,
    description: `测试任务 ${id}`,
    taskType,
    targetCount: 10,
    tokenReward: 5,
    pointReward: 20,
    resourceReward: { copper: 100 },
    ...overrides,
  };
}

function createStandardTaskDefs(): ActivityTaskDef[] {
  const daily = Array.from({ length: 5 }, (_, i) =>
    createTaskDef(`daily_${i + 1}`, ActivityTaskType.DAILY, {
      targetCount: 5 + i,
      pointReward: 10,
      tokenReward: 2,
    }),
  );
  const challenge = Array.from({ length: 3 }, (_, i) =>
    createTaskDef(`challenge_${i + 1}`, ActivityTaskType.CHALLENGE, {
      targetCount: 20 + i * 10,
      pointReward: 50,
      tokenReward: 10,
    }),
  );
  const cumulative = [
    createTaskDef('cumulative_1', ActivityTaskType.CUMULATIVE, {
      targetCount: 100,
      pointReward: 100,
      tokenReward: 30,
    }),
  ];
  return [...daily, ...challenge, ...cumulative];
}

function createStandardMilestones(): ActivityMilestone[] {
  return [
    createMilestone('ms_1', 50, { copper: 500 }),
    createMilestone('ms_2', 150, { gold: 10 }),
    createMilestone('ms_3', 300, { heroFragment: 3 }),
    createMilestone('ms_final', 500, { legendaryChest: 1 }, true),
  ];
}

function createStartedState(
  activityId: string,
  type: ActivityType,
  now: number,
  taskDefs?: ActivityTaskDef[],
  milestones?: ActivityMilestone[],
): ActivityState {
  const sys = new ActivitySystem();
  const state = createDefaultActivityState();
  const def = createActivityDef(activityId, type);
  const tasks = taskDefs ?? createStandardTaskDefs();
  const ms = milestones ?? createStandardMilestones();
  return sys.startActivity(state, def, tasks, ms, now);
}

const NOW = Date.now();

// 模块级 system 实例，供所有 describe 块共享
let system: ActivitySystem;
beforeEach(() => {
  system = new ActivitySystem();
});

describe('里程碑奖励', () => {
  let state: ActivityState;

  beforeEach(() => {
    state = createStartedState('season_1', ActivityType.SEASON, NOW, createStandardTaskDefs(), createStandardMilestones());
  });

  it('初始里程碑全部 LOCKED', () => {
    const milestones = state.activities['season_1'].milestones;
    for (const ms of milestones) {
      expect(ms.status).toBe(MilestoneStatus.LOCKED);
    }
  });

  it('checkMilestones 积分足够时解锁里程碑', () => {
    // 先累积积分到 50（ms_1 需要 50）
    let s = state;
    for (let i = 0; i < 5; i++) {
      s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
      s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
    }

    const checked = system.checkMilestones(s, 'season_1');
    const ms1 = checked.activities['season_1'].milestones.find(m => m.id === 'ms_1');
    expect(ms1!.status).toBe(MilestoneStatus.UNLOCKED);
  });

  it('checkMilestones 积分不足时保持 LOCKED', () => {
    // 只累积少量积分
    let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
    s = system.claimTaskReward(s, 'season_1', 'daily_1').state;
    // points = 10, 不足以解锁 ms_1(50)

    const checked = system.checkMilestones(s, 'season_1');
    const ms1 = checked.activities['season_1'].milestones.find(m => m.id === 'ms_1');
    expect(ms1!.status).toBe(MilestoneStatus.LOCKED);
  });

  it('checkMilestones 线性推进：低分先解锁', () => {
    // 积分到 150（解锁 ms_1 和 ms_2）
    let s = state;
    const tasks = createStandardTaskDefs();
    // 只完成每日任务(5×10=50)和2个挑战任务(2×50=100)，总分150
    const partialTasks = tasks.filter(t =>
      t.taskType === ActivityTaskType.DAILY
      || t.id === 'challenge_1'
      || t.id === 'challenge_2',
    );
    for (const t of partialTasks) {
      s = system.updateTaskProgress(s, 'season_1', t.id, t.targetCount);
      s = system.claimTaskReward(s, 'season_1', t.id).state;
    }

    const checked = system.checkMilestones(s, 'season_1');
    const milestones = checked.activities['season_1'].milestones;

    // ms_1 (50) 和 ms_2 (150) 应该解锁
    expect(milestones.find(m => m.id === 'ms_1')!.status).toBe(MilestoneStatus.UNLOCKED);
    expect(milestones.find(m => m.id === 'ms_2')!.status).toBe(MilestoneStatus.UNLOCKED);
    // ms_3 (300) 和 ms_final (500) 还未解锁
    expect(milestones.find(m => m.id === 'ms_3')!.status).toBe(MilestoneStatus.LOCKED);
    expect(milestones.find(m => m.id === 'ms_final')!.status).toBe(MilestoneStatus.LOCKED);
  });

  it('checkMilestones 已 CLAIMED 的里程碑不变', () => {
    // 先解锁并领取 ms_1
    let s = state;
    for (let i = 0; i < 5; i++) {
      s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
      s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
    }
    s = system.checkMilestones(s, 'season_1');
    s = system.claimMilestone(s, 'season_1', 'ms_1').state;

    // 再次检查，已领取的不变
    const checked = system.checkMilestones(s, 'season_1');
    const ms1 = checked.activities['season_1'].milestones.find(m => m.id === 'ms_1');
    expect(ms1!.status).toBe(MilestoneStatus.CLAIMED);
  });

  it('checkMilestones 不存在的活动返回原状态', () => {
    const checked = system.checkMilestones(state, 'nonexistent');
    expect(checked).toBe(state);
  });

  it('claimMilestone 手动领取已解锁里程碑', () => {
    // 累积积分并解锁
    let s = state;
    for (let i = 0; i < 5; i++) {
      s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
      s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
    }
    s = system.checkMilestones(s, 'season_1');

    const result = system.claimMilestone(s, 'season_1', 'ms_1');
    expect(result.rewards).toEqual({ copper: 500 });
    expect(result.state.activities['season_1'].milestones.find(m => m.id === 'ms_1')!.status).toBe(MilestoneStatus.CLAIMED);
  });

  it('claimMilestone 未解锁里程碑抛异常', () => {
    expect(() => {
      system.claimMilestone(state, 'season_1', 'ms_1');
    }).toThrow('里程碑未解锁');
  });

  it('claimMilestone 已领取里程碑抛异常', () => {
    // 先解锁并领取
    let s = state;
    for (let i = 0; i < 5; i++) {
      s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
      s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
    }
    s = system.checkMilestones(s, 'season_1');
    s = system.claimMilestone(s, 'season_1', 'ms_1').state;

    // 再次领取
    expect(() => {
      system.claimMilestone(s, 'season_1', 'ms_1');
    }).toThrow('已领取');
  });

  it('claimMilestone 活动不存在抛异常', () => {
    expect(() => {
      system.claimMilestone(state, 'nonexistent', 'ms_1');
    }).toThrow('活动不存在');
  });

  it('claimMilestone 里程碑不存在抛异常', () => {
    expect(() => {
      system.claimMilestone(state, 'season_1', 'nonexistent');
    }).toThrow('里程碑不存在');
  });

  it('MilestoneStatus 枚举值正确', () => {
    expect(MilestoneStatus.LOCKED).toBe('LOCKED');
    expect(MilestoneStatus.UNLOCKED).toBe('UNLOCKED');
    expect(MilestoneStatus.CLAIMED).toBe('CLAIMED');
  });

  it('里程碑 isFinal 标记正确', () => {
    const milestones = state.activities['season_1'].milestones;
    expect(milestones.find(m => m.id === 'ms_final')!.isFinal).toBe(true);
    expect(milestones.filter(m => !m.isFinal)).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════
// 6. 离线进度
// ═══════════════════════════════════════════
describe('离线进度', () => {
  it('calculateOfflineProgress 为活跃活动计算离线积分', () => {
    const state = createStartedState('season_1', ActivityType.SEASON, NOW);
    const results = system.calculateOfflineProgress(state, 3600000); // 1小时
    expect(results).toHaveLength(1);
    expect(results[0].activityId).toBe('season_1');
    expect(results[0].pointsEarned).toBeGreaterThan(0);
  });

  it('calculateOfflineProgress 已结束活动不产生进度', () => {
    let state = createStartedState('season_1', ActivityType.SEASON, NOW);
    state = system.updateActivityStatus(state, 'season_1', NOW + 2000, NOW + 1000);
    const results = system.calculateOfflineProgress(state, 3600000);
    expect(results).toHaveLength(0);
  });

  it('calculateOfflineProgress 不同活动类型效率不同', () => {
    let state = createDefaultActivityState();
    state = system.startActivity(state, createActivityDef('season_1', ActivityType.SEASON), [], [], NOW);
    state = system.startActivity(state, createActivityDef('limited_1', ActivityType.LIMITED_TIME), [], [], NOW);
    state = system.startActivity(state, createActivityDef('daily_1', ActivityType.DAILY), [], [], NOW);

    const results = system.calculateOfflineProgress(state, 3600000);
    expect(results).toHaveLength(3);

    // daily 效率 1.0 > season 0.5 > limited 0.3
    const dailyResult = results.find(r => r.activityId === 'daily_1')!;
    const seasonResult = results.find(r => r.activityId === 'season_1')!;
    const limitedResult = results.find(r => r.activityId === 'limited_1')!;

    expect(dailyResult.pointsEarned).toBeGreaterThan(seasonResult.pointsEarned);
    expect(seasonResult.pointsEarned).toBeGreaterThan(limitedResult.pointsEarned);
  });

  it('applyOfflineProgress 应用离线进度到状态', () => {
    const state = createStartedState('season_1', ActivityType.SEASON, NOW);
    const results = system.calculateOfflineProgress(state, 3600000);
    const updated = system.applyOfflineProgress(state, results);

    expect(updated.activities['season_1'].points).toBeGreaterThan(0);
    expect(updated.activities['season_1'].tokens).toBeGreaterThanOrEqual(0);
  });

  it('applyOfflineProgress 空结果不改变状态', () => {
    const state = createDefaultActivityState();
    const updated = system.applyOfflineProgress(state, []);
    expect(updated).toEqual(state);
  });

  it('applyOfflineProgress 不存在的活动跳过', () => {
    const state = createDefaultActivityState();
    const results = [{ activityId: 'nonexistent', pointsEarned: 100, tokensEarned: 10, offlineDuration: 3600000 }];
    const updated = system.applyOfflineProgress(state, results);
    expect(updated).toEqual(state);
  });
});

// ═══════════════════════════════════════════
// 7. 赛季深化
// ═══════════════════════════════════════════
describe('赛季深化', () => {
  it('getCurrentSeasonTheme 返回正确主题', () => {
    const theme = system.getCurrentSeasonTheme(0);
    expect(theme.id).toBe('theme_s1');
    expect(theme.name).toBe('黄巾之乱');
  });

  it('getCurrentSeasonTheme 循环返回主题', () => {
    const theme = system.getCurrentSeasonTheme(4); // 超出长度，应循环
    expect(theme.id).toBe('theme_s1');
  });

  it('getSeasonThemes 返回全部主题', () => {
    const themes = system.getSeasonThemes();
    expect(themes).toHaveLength(4);
  });

  it('createSettlementAnimation 创建结算动画数据', () => {
    const rewards = { copper: 1000, arenaCoin: 500, gold: 50, title: '测试称号' };
    const animation = system.createSettlementAnimation(
      's1', 'rank_gold', 'rank_platinum', 100, 50, rewards, true,
    );
    expect(animation.seasonId).toBe('s1');
    expect(animation.oldRankId).toBe('rank_gold');
    expect(animation.newRankId).toBe('rank_platinum');
    expect(animation.oldRanking).toBe(100);
    expect(animation.newRanking).toBe(50);
    expect(animation.isServerAnnouncement).toBe(true);
  });

  it('updateSeasonRecord 胜场更新', () => {
    const record = {
      seasonId: 's1',
      wins: 0,
      losses: 0,
      total: 0,
      winRate: 0,
      highestRank: '',
      highestRanking: 0,
    };
    const updated = system.updateSeasonRecord(record, true, 'rank_gold', 50);
    expect(updated.wins).toBe(1);
    expect(updated.losses).toBe(0);
    expect(updated.total).toBe(1);
    expect(updated.winRate).toBe(100);
  });

  it('updateSeasonRecord 败场更新', () => {
    const record = {
      seasonId: 's1',
      wins: 5,
      losses: 3,
      total: 8,
      winRate: 63,
      highestRank: 'rank_gold',
      highestRanking: 50,
    };
    const updated = system.updateSeasonRecord(record, false, 'rank_gold', 60);
    expect(updated.wins).toBe(5);
    expect(updated.losses).toBe(4);
    expect(updated.total).toBe(9);
    expect(updated.winRate).toBe(56); // Math.round(5/9 * 100)
  });

  it('updateSeasonRecord 更新最高排名', () => {
    const record = {
      seasonId: 's1',
      wins: 5,
      losses: 3,
      total: 8,
      winRate: 63,
      highestRank: 'rank_gold',
      highestRanking: 100,
    };
    const updated = system.updateSeasonRecord(record, true, 'rank_gold', 30);
    expect(updated.highestRanking).toBe(30);
  });

  it('generateSeasonRecordRanking 按胜场排序', () => {
    const records = [
      { playerId: 'p1', playerName: '玩家1', record: { seasonId: 's1', wins: 10, losses: 5, total: 15, winRate: 67, highestRank: 'rank_gold', highestRanking: 50 } },
      { playerId: 'p2', playerName: '玩家2', record: { seasonId: 's1', wins: 15, losses: 3, total: 18, winRate: 83, highestRank: 'rank_platinum', highestRanking: 20 } },
      { playerId: 'p3', playerName: '玩家3', record: { seasonId: 's1', wins: 10, losses: 8, total: 18, winRate: 56, highestRank: 'rank_silver', highestRanking: 100 } },
    ];
    const ranking = system.generateSeasonRecordRanking(records);
    expect(ranking[0].playerId).toBe('p2');
    expect(ranking[0].rank).toBe(1);
    // p1 和 p3 同胜场，按胜率排序
    expect(ranking[1].playerId).toBe('p1');
    expect(ranking[1].rank).toBe(2);
    expect(ranking[2].playerId).toBe('p3');
    expect(ranking[2].rank).toBe(3);
  });
});
