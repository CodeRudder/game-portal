/**
 * QuestSystem 单元测试
 *
 * 覆盖任务系统的所有核心功能：
 * - 任务注册与查询
 * - 任务接取与前置条件
 * - 进度更新与完成判定
 * - 奖励领取
 * - 日常/周常刷新
 * - 事件系统
 * - 存档/读档
 * - 重置
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  QuestSystem,
  type QuestDef,
  type QuestEvent,
} from '../modules/QuestSystem';

// ============================================================
// 测试数据工厂
// ============================================================

function createDailyQuest(overrides: Partial<QuestDef> = {}): QuestDef {
  return {
    id: 'daily_build_5',
    name: '建造大师',
    description: '建造 5 个建筑',
    type: 'daily',
    conditions: [{ type: 'build', targetId: 'any', requiredCount: 5 }],
    rewards: [{ type: 'resource', id: 'gold', amount: 100 }],
    autoAccept: true,
    ...overrides,
  };
}

function createMainQuest(overrides: Partial<QuestDef> = {}): QuestDef {
  return {
    id: 'main_defeat_10',
    name: '初出茅庐',
    description: '击败 10 个敌人',
    type: 'main',
    conditions: [{ type: 'defeat', targetId: 'goblin', requiredCount: 10 }],
    rewards: [{ type: 'resource', id: 'gem', amount: 50 }],
    ...overrides,
  };
}

function createWeeklyQuest(): QuestDef {
  return {
    id: 'weekly_collect',
    name: '资源收集者',
    description: '收集 1000 金币',
    type: 'weekly',
    conditions: [{ type: 'collect', targetId: 'gold', requiredCount: 1000 }],
    rewards: [{ type: 'item', id: 'chest', amount: 1 }],
    autoAccept: true,
  };
}

// ============================================================
// 测试
// ============================================================

describe('QuestSystem', () => {
  let system: QuestSystem;

  beforeEach(() => {
    system = new QuestSystem();
  });

  // ---- 注册与查询 ----

  it('应正确注册任务定义', () => {
    system.register([createDailyQuest()]);
    expect(system.quests).toHaveLength(1);
    expect(system.quests[0].id).toBe('daily_build_5');
  });

  it('自动接取的任务应立即出现在 activeQuests', () => {
    system.register([createDailyQuest()]);
    expect(system.activeQuests).toHaveLength(1);
  });

  it('非自动接取的任务应出现在 availableQuests', () => {
    system.register([createMainQuest()]);
    expect(system.getAvailableQuests()).toHaveLength(1);
  });

  // ---- 接取 ----

  it('应正确接取任务', () => {
    system.register([createMainQuest()]);
    expect(system.acceptQuest('main_defeat_10')).toBe(true);
    expect(system.getState('main_defeat_10')?.accepted).toBe(true);
  });

  it('接取不存在的任务应返回 false', () => {
    expect(system.acceptQuest('nonexistent')).toBe(false);
  });

  it('重复接取同一任务应返回 false', () => {
    system.register([createMainQuest()]);
    system.acceptQuest('main_defeat_10');
    expect(system.acceptQuest('main_defeat_10')).toBe(false);
  });

  // ---- 前置任务 ----

  it('前置任务未完成时应无法接取', () => {
    system.register([
      createMainQuest({ id: 'q1' }),
      createMainQuest({ id: 'q2', prerequisiteQuest: 'q1' }),
    ]);
    expect(system.acceptQuest('q2')).toBe(false);
  });

  it('前置任务完成后应可以接取', () => {
    system.register([
      createMainQuest({ id: 'q1', conditions: [{ type: 'build', targetId: 'any', requiredCount: 1 }] }),
      createMainQuest({ id: 'q2', prerequisiteQuest: 'q1' }),
    ]);
    system.acceptQuest('q1');
    system.updateProgress('build', 'any', 1);
    expect(system.acceptQuest('q2')).toBe(true);
  });

  // ---- 进度与完成 ----

  it('应正确更新任务进度', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 3);
    expect(system.getState('daily_build_5')?.progress['any']).toBe(3);
  });

  it('条件满足时应自动标记完成', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 5);
    expect(system.getState('daily_build_5')?.completed).toBe(true);
  });

  it('getProgress 应返回正确的进度百分比', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 3);
    expect(system.getProgress('daily_build_5')).toBe(0.6);
  });

  // ---- 奖励 ----

  it('未完成任务领取奖励应返回 null', () => {
    system.register([createDailyQuest()]);
    expect(system.claimReward('daily_build_5')).toBeNull();
  });

  it('完成后应正确领取奖励', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 5);
    const rewards = system.claimReward('daily_build_5');
    expect(rewards).toHaveLength(1);
    expect(rewards![0].id).toBe('gold');
  });

  it('重复领取奖励应返回 null', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 5);
    system.claimReward('daily_build_5');
    expect(system.claimReward('daily_build_5')).toBeNull();
  });

  it('claimAll 应领取所有已完成未领取的奖励', () => {
    system.register([
      createDailyQuest({ id: 'd1' }),
      createDailyQuest({ id: 'd2', conditions: [{ type: 'defeat', targetId: 'any', requiredCount: 1 }] }),
    ]);
    system.updateProgress('build', 'any', 5);
    system.updateProgress('defeat', 'any', 1);
    const all = system.claimAll();
    expect(all).toHaveLength(2);
  });

  // ---- 刷新 ----

  it('refreshDaily 应重置日常任务', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 5);
    const refreshed = system.refreshDaily();
    expect(refreshed).toContain('daily_build_5');
    expect(system.getState('daily_build_5')?.progress['any']).toBeUndefined();
  });

  it('refreshWeekly 应重置周常任务', () => {
    system.register([createWeeklyQuest()]);
    system.updateProgress('collect', 'gold', 500);
    const refreshed = system.refreshWeekly();
    expect(refreshed).toContain('weekly_collect');
  });

  // ---- 事件 ----

  it('应正确触发 quest_accepted 事件', () => {
    system.register([createMainQuest()]);
    const handler = vi.fn();
    system.onEvent(handler);
    system.acceptQuest('main_defeat_10');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'quest_accepted', questId: 'main_defeat_10' }));
  });

  it('应正确触发 quest_completed 事件', () => {
    system.register([createDailyQuest()]);
    const handler = vi.fn();
    system.onEvent(handler);
    system.updateProgress('build', 'any', 5);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'quest_completed' }));
  });

  // ---- 存档 ----

  it('saveState/loadState 应正确保存和恢复状态', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 3);
    const saved = system.saveState();

    const newSystem = new QuestSystem();
    newSystem.register([createDailyQuest()]);
    newSystem.loadState(saved);
    expect(newSystem.getState('daily_build_5')?.progress['any']).toBe(3);
  });

  // ---- 重置 ----

  it('reset 应清除所有状态', () => {
    system.register([createDailyQuest()]);
    system.updateProgress('build', 'any', 5);
    system.reset();
    expect(system.activeQuests).toHaveLength(1); // autoAccept 的会重新创建
    expect(system.getState('daily_build_5')?.progress['any']).toBeUndefined();
  });
});
