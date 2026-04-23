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

// ═══════════════════════════════════════════
// 8. 配置
// ═══════════════════════════════════════════
describe('配置', () => {
  it('getConcurrencyConfig 返回默认配置', () => {
    const config = system.getConcurrencyConfig();
    expect(config.maxSeason).toBe(1);
    expect(config.maxLimitedTime).toBe(2);
    expect(config.maxDaily).toBe(1);
    expect(config.maxFestival).toBe(1);
    expect(config.maxAlliance).toBe(1);
    expect(config.maxTotal).toBe(5);
  });

  it('自定义并发配置生效', () => {
    const custom = new ActivitySystem({ maxTotal: 10 });
    expect(custom.getConcurrencyConfig().maxTotal).toBe(10);
  });

  it('getOfflineEfficiency 返回默认配置', () => {
    const eff = system.getOfflineEfficiency();
    expect(eff.season).toBe(0.5);
    expect(eff.limitedTime).toBe(0.3);
    expect(eff.daily).toBe(1.0);
    expect(eff.festival).toBe(0.5);
    expect(eff.alliance).toBe(0.5);
  });

  it('自定义离线效率配置生效', () => {
    const custom = new ActivitySystem(undefined, { season: 0.8 });
    expect(custom.getOfflineEfficiency().season).toBe(0.8);
  });
});

// ═══════════════════════════════════════════
// 9. 序列化/反序列化
// ═══════════════════════════════════════════
describe('序列化/反序列化', () => {
  it('serialize 返回正确结构', () => {
    const state = createDefaultActivityState();
    const data = system.serialize(state);
    expect(data.version).toBe(ACTIVITY_SAVE_VERSION);
    expect(data.state).toBeDefined();
    expect(data.state.activities).toEqual({});
  });

  it('serialize/deserialize 往返一致（空状态）', () => {
    const state = createDefaultActivityState();
    const data = system.serialize(state);
    const restored = system.deserialize(data);
    expect(restored.activities).toEqual({});
  });

  it('serialize/deserialize 往返一致（有活动）', () => {
    let state = createStartedState('season_1', ActivityType.SEASON, NOW, createStandardTaskDefs(), createStandardMilestones());
    // 更新一些进度
    state = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);

    const data = system.serialize(state);
    const restored = system.deserialize(data);

    expect(Object.keys(restored.activities)).toHaveLength(1);
    expect(restored.activities['season_1'].tasks.find(t => t.defId === 'daily_1')!.currentProgress).toBe(5);
  });

  it('deserialize 版本不匹配返回默认状态', () => {
    const restored = system.deserialize({ version: 999, state: createDefaultActivityState() });
    expect(restored.activities).toEqual({});
  });

  it('deserialize null/undefined 返回默认状态', () => {
    const restored = system.deserialize(null as unknown as Record<string, unknown>);
    expect(restored.activities).toEqual({});
  });

  it('serialize 保留积分和代币', () => {
    let state = createStartedState('season_1', ActivityType.SEASON, NOW);
    state = {
      ...state,
      activities: {
        ...state.activities,
        season_1: { ...state.activities['season_1'], points: 500, tokens: 50 },
      },
    };

    const data = system.serialize(state);
    const restored = system.deserialize(data);
    expect(restored.activities['season_1'].points).toBe(500);
    expect(restored.activities['season_1'].tokens).toBe(50);
  });

  it('serialize 保留里程碑状态', () => {
    let state = createStartedState('season_1', ActivityType.SEASON, NOW);
    // 手动修改里程碑状态
    const milestones = state.activities['season_1'].milestones.map((m, i) =>
      i === 0 ? { ...m, status: MilestoneStatus.CLAIMED } : m,
    );
    state = {
      ...state,
      activities: {
        ...state.activities,
        season_1: { ...state.activities['season_1'], milestones },
      },
    };

    const data = system.serialize(state);
    const restored = system.deserialize(data);
    expect(restored.activities['season_1'].milestones[0].status).toBe(MilestoneStatus.CLAIMED);
  });
});
