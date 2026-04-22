/**
 * AllianceTaskSystem 单元测试
 *
 * 覆盖：
 *   - 任务生成与刷新
 *   - 任务进度更新
 *   - 任务完成与奖励领取
 *   - 个人贡献记录
 */

import {
  AllianceTaskSystem,
  DEFAULT_TASK_CONFIG,
  ALLIANCE_TASK_POOL,
} from '../AllianceTaskSystem';
import { AllianceTaskStatus, AllianceTaskType } from '../../../core/alliance/alliance.types';
import type { AllianceData, AlliancePlayerState } from '../../../core/alliance/alliance.types';
import { AllianceRole } from '../../../core/alliance/alliance.types';
import { createDefaultAlliancePlayerState, createAllianceData } from '../alliance-constants';

// ── 辅助函数 ──────────────────────────────

function createPlayerState(overrides: Partial<AlliancePlayerState> = {}): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function createTestAlliance(): AllianceData {
  return createAllianceData('ally_1', '测试联盟', '宣言', 'leader_1', '盟主', 1000000);
}

// ── 全局实例 ──────────────────────────────

let taskSystem: AllianceTaskSystem;
let alliance: AllianceData;
let playerState: AlliancePlayerState;

beforeEach(() => {
  taskSystem = new AllianceTaskSystem();
  alliance = createTestAlliance();
  playerState = createPlayerState({ allianceId: 'ally_1' });
});

// ── 任务生成 ──────────────────────────────

describe('AllianceTaskSystem — 任务生成', () => {
  test('每日刷新生成3个任务', () => {
    const tasks = taskSystem.dailyRefresh();
    expect(tasks.length).toBe(DEFAULT_TASK_CONFIG.dailyTaskCount);
  });

  test('任务初始状态为ACTIVE', () => {
    const tasks = taskSystem.dailyRefresh();
    tasks.forEach(t => expect(t.status).toBe(AllianceTaskStatus.ACTIVE));
    tasks.forEach(t => expect(t.currentProgress).toBe(0));
  });

  test('再次刷新替换旧任务', () => {
    const first = taskSystem.dailyRefresh();
    const second = taskSystem.dailyRefresh();
    expect(second.length).toBe(DEFAULT_TASK_CONFIG.dailyTaskCount);
  });
});

// ── 任务进度 ──────────────────────────────

describe('AllianceTaskSystem — 任务进度', () => {
  let tasks: ReturnType<AllianceTaskSystem['dailyRefresh']>;

  beforeEach(() => {
    tasks = taskSystem.dailyRefresh();
  });

  test('更新任务进度', () => {
    const task = tasks[0];
    const def = taskSystem.getTaskDef(task.defId);
    const result = taskSystem.updateProgress(task.defId, 5);
    expect(result).toBeTruthy();
    expect(result!.currentProgress).toBe(5);
  });

  test('任务完成时状态变更', () => {
    const task = tasks[0];
    const def = taskSystem.getTaskDef(task.defId);
    if (!def) return;
    const result = taskSystem.updateProgress(task.defId, def.targetCount);
    expect(result!.status).toBe(AllianceTaskStatus.COMPLETED);
  });

  test('进度不超过目标', () => {
    const task = tasks[0];
    const def = taskSystem.getTaskDef(task.defId);
    if (!def) return;
    const result = taskSystem.updateProgress(task.defId, def.targetCount + 100);
    expect(result!.currentProgress).toBe(def.targetCount);
  });

  test('已完成任务不再更新', () => {
    const task = tasks[0];
    const def = taskSystem.getTaskDef(task.defId);
    if (!def) return;
    taskSystem.updateProgress(task.defId, def.targetCount);
    const result = taskSystem.updateProgress(task.defId, 100);
    expect(result!.status).toBe(AllianceTaskStatus.COMPLETED);
  });

  test('不存在的任务返回null', () => {
    const result = taskSystem.updateProgress('nonexistent', 10);
    expect(result).toBeNull();
  });
});

// ── 任务奖励 ──────────────────────────────

describe('AllianceTaskSystem — 任务奖励', () => {
  beforeEach(() => {
    taskSystem.dailyRefresh();
  });

  test('领取完成任务的奖励', () => {
    const activeTasks = taskSystem.getActiveTasks();
    const task = activeTasks[0];
    const def = taskSystem.getTaskDef(task.defId);
    if (!def) return;

    // 完成任务
    taskSystem.updateProgress(task.defId, def.targetCount);

    // 领取奖励
    const result = taskSystem.claimTaskReward(task.defId, alliance, playerState, 'leader_1');
    expect(result.expGained).toBe(def.allianceExpReward);
    expect(result.coinGained).toBe(def.guildCoinReward);
    expect(result.playerState.guildCoins).toBe(def.guildCoinReward);
    expect(result.alliance.experience).toBe(def.allianceExpReward);
  });

  test('未完成任务不能领取', () => {
    const activeTasks = taskSystem.getActiveTasks();
    expect(() => taskSystem.claimTaskReward(activeTasks[0].defId, alliance, playerState, 'leader_1'))
      .toThrow('任务未完成');
  });

  test('不能重复领取奖励', () => {
    const activeTasks = taskSystem.getActiveTasks();
    const task = activeTasks[0];
    const def = taskSystem.getTaskDef(task.defId);
    if (!def) return;

    taskSystem.updateProgress(task.defId, def.targetCount);
    taskSystem.claimTaskReward(task.defId, alliance, playerState, 'leader_1');

    expect(() => taskSystem.claimTaskReward(task.defId, alliance, playerState, 'leader_1'))
      .toThrow('已领取奖励');
  });
});

// ── 个人贡献 ──────────────────────────────

describe('AllianceTaskSystem — 个人贡献', () => {
  test('记录贡献增加公会币', () => {
    const result = taskSystem.recordContribution(alliance, playerState, 'leader_1', 50);
    expect(result.playerState.guildCoins).toBe(50);
    expect(result.playerState.dailyContribution).toBe(50);
  });

  test('记录贡献更新成员数据', () => {
    const result = taskSystem.recordContribution(alliance, playerState, 'leader_1', 30);
    const member = result.alliance.members['leader_1'];
    expect(member.dailyContribution).toBe(30);
    expect(member.totalContribution).toBe(30);
  });

  test('非成员不能记录贡献', () => {
    expect(() => taskSystem.recordContribution(alliance, playerState, 'outsider', 50))
      .toThrow('不是联盟成员');
  });
});

// ── 查询 ──────────────────────────────

describe('AllianceTaskSystem — 查询', () => {
  test('获取任务进度', () => {
    taskSystem.dailyRefresh();
    const activeTasks = taskSystem.getActiveTasks();
    const progress = taskSystem.getTaskProgress(activeTasks[0].defId);
    expect(progress).toBeTruthy();
    expect(progress!.current).toBe(0);
    expect(progress!.percent).toBe(0);
    expect(progress!.status).toBe(AllianceTaskStatus.ACTIVE);
  });

  test('获取已完成任务数', () => {
    taskSystem.dailyRefresh();
    expect(taskSystem.getCompletedCount()).toBe(0);

    const activeTasks = taskSystem.getActiveTasks();
    const def = taskSystem.getTaskDef(activeTasks[0].defId);
    if (def) {
      taskSystem.updateProgress(activeTasks[0].defId, def.targetCount);
    }
    expect(taskSystem.getCompletedCount()).toBe(1);
  });

  test('获取任务池', () => {
    const pool = taskSystem.getTaskPool();
    expect(pool.length).toBe(ALLIANCE_TASK_POOL.length);
  });

  test('获取配置', () => {
    const config = taskSystem.getConfig();
    expect(config.dailyTaskCount).toBe(DEFAULT_TASK_CONFIG.dailyTaskCount);
  });
});
