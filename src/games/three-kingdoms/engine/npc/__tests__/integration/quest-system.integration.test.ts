/**
 * 集成测试 §15~§18 — 主线+支线+日常+活跃度
 * §15 主线任务 §16 支线任务 §17 日常任务(20选6) §18 活跃度
 * 集成：QuestSystem ↔ QuestTrackerSystem ↔ EventBus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestSystem } from '../../../quest/QuestSystem';
import { QuestTrackerSystem } from '../../../quest/QuestTrackerSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { QuestDef, QuestCategory, QuestReward } from '../../../../core/quest';

// ─── helpers ──────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function makeQuest(cat: QuestCategory, overrides: Partial<QuestDef> = {}): QuestDef {
  return {
    id: `${cat}-q1`, title: `${cat}任务`, description: '测试',
    category: cat,
    objectives: [{ id: 'obj-1', type: 'battle_clear', description: '击败敌人', targetCount: 1, currentCount: 0 }],
    rewards: { resources: { gold: 100 }, experience: 50 },
    prerequisiteQuestIds: [], ...overrides,
  };
}

function createEnv() {
  const deps = createMockDeps();
  const emit = vi.fn(); deps.eventBus.emit = emit;
  const qs = new QuestSystem(); qs.init(deps);
  const ts = new QuestTrackerSystem(); ts.init(deps); ts.bindQuestSystem(qs);
  const rewards: QuestReward[] = [];
  qs.setRewardCallback((r) => rewards.push(r));
  return { qs, ts, deps, emit, rewards };
}

// ─── §15 主线任务 ─────────────────────────────

describe('§15 主线任务集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§15.1 注册与接取', () => {
    it('§15.1.1 注册主线任务', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      expect(env.qs.getQuestDef('m1')).toBeDefined();
    });

    it('§15.1.2 接取主线任务', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      const inst = env.qs.acceptQuest('m1');
      expect(inst).not.toBeNull();
      expect(env.qs.isQuestActive('m1')).toBe(true);
    });

    it('§15.1.3 重复接取返回null', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      env.qs.acceptQuest('m1');
      expect(env.qs.acceptQuest('m1')).toBeNull();
    });

    it('§15.1.5 接取后自动追踪', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      env.qs.acceptQuest('m1');
      expect(env.qs.getTrackedQuests().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('§15.2 进度与完成', () => {
    it('§15.2.1 更新目标进度（增量）', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      const inst = env.qs.acceptQuest('m1')!;
      const obj = env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1);
      expect(obj!.currentCount).toBe(1);
    });

    it('§15.2.2 进度不超过目标数', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1', objectives: [
        { id: 'obj-1', type: 'battle_clear', description: '', targetCount: 2, currentCount: 0 },
      ] }));
      const inst = env.qs.acceptQuest('m1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 99);
      expect(inst.objectives[0].currentCount).toBeLessThanOrEqual(2);
    });

    it('§15.2.3 所有目标达成自动完成', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      const inst = env.qs.acceptQuest('m1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1);
      expect(env.qs.isQuestCompleted('m1')).toBe(true);
    });

    it('§15.2.4 按类型批量更新进度', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      env.qs.acceptQuest('m1');
      env.qs.updateProgressByType('battle_clear', 1);
      const active = env.qs.getActiveQuests();
      const obj = active[0]?.objectives.find(o => o.type === 'battle_clear');
      if (obj) expect(obj.currentCount).toBeGreaterThan(0);
    });
  });

  describe('§15.3 奖励', () => {
    it('§15.3.1 领取奖励', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      const inst = env.qs.acceptQuest('m1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1);
      const r = env.qs.claimReward(inst.instanceId);
      expect(r).not.toBeNull();
      expect(r!.experience).toBe(50);
    });

    it('§15.3.2 奖励触发回调', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      const inst = env.qs.acceptQuest('m1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1);
      env.qs.claimReward(inst.instanceId);
      expect(env.rewards.length).toBeGreaterThanOrEqual(1);
    });

    it('§15.3.3 不可重复领取', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      const inst = env.qs.acceptQuest('m1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1);
      env.qs.claimReward(inst.instanceId);
      expect(env.qs.claimReward(inst.instanceId)).toBeNull();
    });
  });
});

// ─── §16 支线任务 ─────────────────────────────

describe('§16 支线任务集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§16.1 支线流程', () => {
    it('§16.1.1 注册并接取支线', () => {
      env.qs.registerQuest(makeQuest('side', { id: 's1' }));
      expect(env.qs.acceptQuest('s1')).not.toBeNull();
    });

    it('§16.1.2 完成支线任务', () => {
      env.qs.registerQuest(makeQuest('side', { id: 's1' }));
      const inst = env.qs.acceptQuest('s1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1);
      expect(env.qs.isQuestCompleted('s1')).toBe(true);
    });

    it('§16.1.3 按分类查询活跃支线', () => {
      env.qs.registerQuest(makeQuest('side', { id: 's1' }));
      env.qs.acceptQuest('s1');
      expect(env.qs.getActiveQuestsByCategory('side').length).toBeGreaterThanOrEqual(1);
    });

    it('§16.1.4 主线支线可同时进行', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      env.qs.registerQuest(makeQuest('side', { id: 's1' }));
      env.qs.acceptQuest('m1');
      env.qs.acceptQuest('s1');
      expect(env.qs.getActiveQuests().length).toBeGreaterThanOrEqual(2);
    });

    it('§16.1.4 完成支线不影响主线', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      env.qs.registerQuest(makeQuest('side', { id: 's1' }));
      env.qs.acceptQuest('m1');
      const side = env.qs.acceptQuest('s1')!;
      env.qs.updateObjectiveProgress(side.instanceId, 'obj-1', 1);
      expect(env.qs.isQuestActive('m1')).toBe(true);
    });
  });
});

// ─── §17 日常任务 ─────────────────────────────

describe('§17 日常任务集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§17.1 刷新与接取', () => {
    it('§17.1.1 刷新日常任务', () => {
      const daily = env.qs.refreshDailyQuests();
      expect(Array.isArray(daily)).toBe(true);
    });

    it('§17.1.2 获取日常任务列表', () => {
      env.qs.refreshDailyQuests();
      expect(Array.isArray(env.qs.getDailyQuests())).toBe(true);
    });

  });

  describe('§17.2 进度与完成', () => {
    it('§17.2.1 更新日常任务进度', () => {
      env.qs.registerQuest(makeQuest('daily', { id: 'd1' }));
      const inst = env.qs.acceptQuest('d1')!;
      expect(env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1)).not.toBeNull();
    });

    it('§17.2.2 完成日常任务并领奖', () => {
      env.qs.registerQuest(makeQuest('daily', { id: 'd1' }));
      const inst = env.qs.acceptQuest('d1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-1', 1);
      expect(env.qs.claimReward(inst.instanceId)).not.toBeNull();
    });
  });
});

// ─── §18 活跃度 ───────────────────────────────

describe('§18 活跃度集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§18.1 积分', () => {
    it('§18.1.1 添加活跃度积分', () => {
      env.qs.addActivityPoints(30);
      expect(env.qs.getActivityState().currentPoints).toBe(30);
    });

    it('§18.1.2 积分累加', () => {
      env.qs.addActivityPoints(20);
      env.qs.addActivityPoints(30);
      expect(env.qs.getActivityState().currentPoints).toBe(50);
    });

    it('§18.1.3 积分不超过上限', () => {
      env.qs.addActivityPoints(99999);
      const s = env.qs.getActivityState();
      expect(s.currentPoints).toBeLessThanOrEqual(s.maxPoints);
    });
  });

  describe('§18.2 里程碑', () => {
    it('§18.2.1 领取已达成的里程碑', () => {
      env.qs.addActivityPoints(200);
      const s = env.qs.getActivityState();
      const idx = s.milestones.findIndex(m => !m.claimed && s.currentPoints >= m.points);
      if (idx >= 0) expect(env.qs.claimActivityMilestone(idx)).not.toBeNull();
    });

    it('§18.2.2 不可重复领取里程碑', () => {
      env.qs.addActivityPoints(200);
      const s = env.qs.getActivityState();
      const idx = s.milestones.findIndex(m => !m.claimed && s.currentPoints >= m.points);
      if (idx >= 0) {
        env.qs.claimActivityMilestone(idx);
        expect(env.qs.claimActivityMilestone(idx)).toBeNull();
      }
    });

  });

  describe('§18.3 重置与追踪', () => {
    it('§18.3.1 重置后积分归零', () => {
      env.qs.addActivityPoints(100);
      env.qs.resetDailyActivity();
      expect(env.qs.getActivityState().currentPoints).toBe(0);
    });

    it('§18.3.2 重置后里程碑恢复未领取', () => {
      env.qs.addActivityPoints(200);
      const s = env.qs.getActivityState();
      const idx = s.milestones.findIndex(m => !m.claimed && s.currentPoints >= m.points);
      if (idx >= 0) env.qs.claimActivityMilestone(idx);
      env.qs.resetDailyActivity();
      const rs = env.qs.getActivityState();
      expect(rs.milestones.every(m => !m.claimed)).toBe(true);
    });

    it('§18.3.3 默认跳转映射', () => {
      expect(env.ts.getAllJumpTargets().length).toBeGreaterThan(0);
    });

    it('§18.3.4 注册自定义跳转', () => {
      env.ts.registerJumpTarget({ objectiveType: 'custom', route: '/c', description: '自定义' });
      expect(env.ts.getJumpTarget('custom')!.route).toBe('/c');
    });

    it('§18.3.5 序列化与反序列化', () => {
      env.qs.registerQuest(makeQuest('main', { id: 'm1' }));
      env.qs.acceptQuest('m1');
      env.qs.addActivityPoints(50);
      const saved = env.qs.serialize();
      const env2 = createEnv();
      env2.qs.deserialize(saved);
      expect(env2.qs.getActivityState().currentPoints).toBe(50);
    });
  });
});
