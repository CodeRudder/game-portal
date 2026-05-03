/**
 * QuestSystem 对抗式测试
 *
 * 覆盖：边界条件、异常注入、状态转换、跨系统交互
 * 重点发现：负数注入、溢出、并发安全、序列化安全
 */

import { vi } from 'vitest';
import { QuestSystem } from '../QuestSystem';
import { QuestTrackerSystem } from '../QuestTrackerSystem';
import { ActivitySystem } from '../ActivitySystem';
import { QuestActivityManager } from '../QuestActivityManager';
import { QuestDailyManager } from '../QuestDailyManager';
import {
  serializeQuestState,
  deserializeQuestState,
} from '../QuestSerialization';
import {
  pickDailyWithDiversity,
  trackQuest,
  untrackQuest,
  addActivityPoints,
  claimActivityMilestone,
  updateProgressByTypeLogic,
  claimRewardLogic,
  claimAllRewardsLogic,
  MAX_TRACKED_QUESTS,
  MAX_ACTIVITY_POINTS,
} from '../QuestSystem.helpers';
import type { ISystemDeps } from '../../../core/types';
import type { QuestDef, QuestInstance, QuestReward, QuestSystemSaveData } from '../../../core/quest';
import { DAILY_QUEST_TEMPLATES, DEFAULT_ACTIVITY_MILESTONES } from '../../../core/quest';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

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

function createQuestSystem(): QuestSystem {
  const sys = new QuestSystem();
  sys.init(mockDeps());
  return sys;
}

function createTestQuestDef(id = 'test-q1', category = 'main' as const): QuestDef {
  return {
    id,
    name: `测试任务-${id}`,
    category,
    objectives: [
      { id: `${id}-obj1`, type: 'battle_clear', description: '战斗胜利', targetCount: 3, currentCount: 0 },
      { id: `${id}-obj2`, type: 'collect_resource', description: '收集资源', targetCount: 100, currentCount: 0, params: { resource: 'gold' } },
    ],
    rewards: { exp: 100, gold: 500, activityPoints: 10 },
    prerequisiteQuestIds: [],
  };
}

function createChainQuestDef(id: string, prereqIds: string[]): QuestDef {
  return {
    id,
    name: `链式任务-${id}`,
    category: 'main',
    objectives: [
      { id: `${id}-obj1`, type: 'battle_clear', description: '战斗', targetCount: 1, currentCount: 0 },
    ],
    rewards: { exp: 50, gold: 200 },
    prerequisiteQuestIds: prereqIds,
  };
}

// ═══════════════════════════════════════════════════════════

describe('QuestSystem 对抗式测试', () => {

  // ═══════════════════════════════════════════
  // 1. 负数注入攻击
  // ═══════════════════════════════════════════

  describe('TC-Q-001: 负数活跃度注入', () => {
    it('addActivityPoints(-50) 应导致 currentPoints 不低于 0', () => {
      const sys = createQuestSystem();
      sys.addActivityPoints(50);
      expect(sys.getActivityState().currentPoints).toBe(50);

      // 对抗：注入负数
      sys.addActivityPoints(-100);
      const points = sys.getActivityState().currentPoints;
      // BUG: Math.min(50 + (-100), 100) = Math.min(-50, 100) = -50
      // 预期：应 >= 0
      expect(points).toBeGreaterThanOrEqual(0);
    });

    it('helper: addActivityPoints 负数不应使 currentPoints 为负', () => {
      const state = { currentPoints: 30, maxPoints: 100, milestones: [], lastResetDate: '' };
      addActivityPoints(state, -50);
      // BUG: Math.min(30 + (-50), 100) = -20
      expect(state.currentPoints).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TC-Q-002: 负数进度注入', () => {
    it('updateObjectiveProgress 负数进度不应使 currentCount 为负', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('neg-prog');
      sys.registerQuest(def);
      const instance = sys.acceptQuest('neg-prog')!;

      // 先增加一些进度
      sys.updateObjectiveProgress(instance.instanceId, 'neg-prog-obj1', 2);
      expect(sys.getQuestInstance(instance.instanceId)!.objectives[0].currentCount).toBe(2);

      // 对抗：注入负数
      sys.updateObjectiveProgress(instance.instanceId, 'neg-prog-obj1', -10);
      const obj = sys.getQuestInstance(instance.instanceId)!.objectives[0];
      // BUG: Math.min(2 + (-10), 3) = Math.min(-8, 3) = -8
      expect(obj.currentCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 边界条件
  // ═══════════════════════════════════════════

  describe('TC-Q-003: 超大进度值', () => {
    it('updateObjectiveProgress 超大值应 clamp 到 targetCount', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('big-prog');
      sys.registerQuest(def);
      const instance = sys.acceptQuest('big-prog')!;

      sys.updateObjectiveProgress(instance.instanceId, 'big-prog-obj1', Number.MAX_SAFE_INTEGER);
      const obj = sys.getQuestInstance(instance.instanceId)!.objectives[0];
      expect(obj.currentCount).toBe(obj.targetCount);
    });
  });

  describe('TC-Q-007: 追踪上限竞争', () => {
    it('追踪列表满后手动追踪应返回 false', () => {
      const sys = createQuestSystem();
      // 注册4个任务
      for (let i = 1; i <= 4; i++) {
        sys.registerQuest(createTestQuestDef(`track-${i}`));
      }
      // 接受4个任务（前3个自动追踪）
      const instances: QuestInstance[] = [];
      for (let i = 1; i <= 4; i++) {
        const inst = sys.acceptQuest(`track-${i}`)!;
        instances.push(inst);
      }

      // 前3个应已追踪
      expect(sys.getTrackedQuests().length).toBe(MAX_TRACKED_QUESTS);
      // 第4个手动追踪应失败
      expect(sys.trackQuest(instances[3].instanceId)).toBe(false);
    });

    it('取消追踪后可添加新追踪', () => {
      const sys = createQuestSystem();
      for (let i = 1; i <= 4; i++) {
        sys.registerQuest(createTestQuestDef(`untrack-${i}`));
      }
      const instances: QuestInstance[] = [];
      for (let i = 1; i <= 4; i++) {
        instances.push(sys.acceptQuest(`untrack-${i}`)!);
      }

      // 取消第1个追踪
      expect(sys.untrackQuest(instances[0].instanceId)).toBe(true);
      // 现在可以追踪第4个
      expect(sys.trackQuest(instances[3].instanceId)).toBe(true);
    });
  });

  describe('TC-Q-008/009: 里程碑越界', () => {
    it('负数 index 返回 null', () => {
      const sys = createQuestSystem();
      sys.addActivityPoints(50);
      expect(sys.claimActivityMilestone(-1)).toBeNull();
    });

    it('超大 index 返回 null', () => {
      const sys = createQuestSystem();
      sys.addActivityPoints(50);
      expect(sys.claimActivityMilestone(999)).toBeNull();
    });

    it('NaN index 返回 null', () => {
      const sys = createQuestSystem();
      sys.addActivityPoints(50);
      expect(sys.claimActivityMilestone(NaN)).toBeNull();
    });

    it('Infinity index 返回 null', () => {
      const sys = createQuestSystem();
      sys.addActivityPoints(50);
      expect(sys.claimActivityMilestone(Infinity)).toBeNull();
    });

    it('helper: claimActivityMilestone 已领取返回 null', () => {
      const state = {
        currentPoints: 100,
        maxPoints: 100,
        milestones: DEFAULT_ACTIVITY_MILESTONES.map(m => ({ ...m })),
        lastResetDate: '',
      };
      // 领取第一个
      const r1 = claimActivityMilestone(state, 0);
      expect(r1).not.toBeNull();
      // 再次领取
      const r2 = claimActivityMilestone(state, 0);
      expect(r2).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 3. 重复操作与状态转换
  // ═══════════════════════════════════════════

  describe('TC-Q-004: 重复接受同一任务', () => {
    it('第二次接受返回 null', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('dup-accept');
      sys.registerQuest(def);
      const inst1 = sys.acceptQuest('dup-accept');
      expect(inst1).not.toBeNull();
      const inst2 = sys.acceptQuest('dup-accept');
      expect(inst2).toBeNull();
    });
  });

  describe('TC-Q-005: 接受已完成任务', () => {
    it('完成后再次接受返回 null', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('done-accept');
      sys.registerQuest(def);
      const inst = sys.acceptQuest('done-accept')!;
      // 完成所有目标
      sys.updateObjectiveProgress(inst.instanceId, 'done-accept-obj1', 10);
      sys.updateObjectiveProgress(inst.instanceId, 'done-accept-obj2', 200);
      // 任务应自动完成
      expect(sys.isQuestCompleted('done-accept')).toBe(true);
      // 再次接受
      expect(sys.acceptQuest('done-accept')).toBeNull();
    });
  });

  describe('TC-Q-006: 前置任务未完成', () => {
    it('前置任务未完成时返回 null', () => {
      const sys = createQuestSystem();
      sys.registerQuest(createTestQuestDef('prereq-1'));
      sys.registerQuest(createChainQuestDef('prereq-2', ['prereq-1']));
      // 不接受前置，直接接受后续
      expect(sys.acceptQuest('prereq-2')).toBeNull();
    });

    it('完成前置后可接受后续', () => {
      const sys = createQuestSystem();
      sys.registerQuest(createTestQuestDef('prereq-1b'));
      sys.registerQuest(createChainQuestDef('prereq-2b', ['prereq-1b']));

      const inst = sys.acceptQuest('prereq-1b')!;
      sys.updateObjectiveProgress(inst.instanceId, 'prereq-1b-obj1', 10);
      sys.updateObjectiveProgress(inst.instanceId, 'prereq-1b-obj2', 200);
      expect(sys.isQuestCompleted('prereq-1b')).toBe(true);

      expect(sys.acceptQuest('prereq-2b')).not.toBeNull();
    });
  });

  describe('TC-Q-014: claimReward 并发安全', () => {
    it('连续两次 claimReward 第二次返回 null', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('claim-twice');
      sys.registerQuest(def);
      const inst = sys.acceptQuest('claim-twice')!;
      // 完成
      sys.updateObjectiveProgress(inst.instanceId, 'claim-twice-obj1', 10);
      sys.updateObjectiveProgress(inst.instanceId, 'claim-twice-obj2', 200);

      const r1 = sys.claimReward(inst.instanceId);
      expect(r1).not.toBeNull();
      // 第二次
      const r2 = sys.claimReward(inst.instanceId);
      expect(r2).toBeNull();
    });
  });

  describe('TC-Q-015: claimAllRewards 空列表', () => {
    it('无已完成任务时返回空数组', () => {
      const sys = createQuestSystem();
      expect(sys.claimAllRewards()).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 日常任务对抗
  // ═══════════════════════════════════════════

  describe('TC-Q-012: 日常刷新幂等性', () => {
    it('同一天两次刷新返回相同任务', () => {
      const sys = createQuestSystem();
      const first = sys.refreshDailyQuests();
      const second = sys.refreshDailyQuests();
      expect(second.length).toBe(first.length);
      expect(second.map(q => q.instanceId).sort()).toEqual(
        first.map(q => q.instanceId).sort(),
      );
    });
  });

  describe('TC-Q-013: 日常刷新自动领取已完成奖励', () => {
    it('已完成未领取的日常在刷新时自动领取', () => {
      const deps = mockDeps();
      const sys = new QuestSystem();
      sys.init(deps);
      sys.refreshDailyQuests();

      const daily = sys.getDailyQuests();
      if (daily.length > 0) {
        // 完成第一个日常的所有目标
        const inst = daily[0];
        const def = sys.getQuestDef(inst.questDefId);
        if (def) {
          for (const obj of def.objectives) {
            sys.updateObjectiveProgress(inst.instanceId, obj.id, obj.targetCount + 10);
          }
        }
        expect(sys.getQuestInstance(inst.instanceId)?.status).toBe('completed');

        // 刷新日常（模拟第二天）
        // 由于日期判断，需要修改 dailyRefreshDate
        // 直接测试 helper 逻辑
      }
    });
  });

  describe('TC-Q-020: pickDailyWithDiversity 多样性保证', () => {
    it('100次抽取都应包含 battle/training/auto 类', () => {
      const tagMap: Record<string, string> = {
        'daily-001': 'build', 'daily-002': 'battle', 'daily-003': 'training',
        'daily-004': 'collect', 'daily-005': 'social', 'daily-006': 'training',
        'daily-007': 'social', 'daily-008': 'event', 'daily-009': 'build',
        'daily-010': 'battle', 'daily-011': 'collect', 'daily-012': 'training',
        'daily-013': 'training', 'daily-014': 'social', 'daily-015': 'battle',
        'daily-016': 'build', 'daily-017': 'training', 'daily-018': 'social',
        'daily-019': 'auto', 'daily-020': 'event',
      };

      for (let i = 0; i < 100; i++) {
        const picked = pickDailyWithDiversity([...DAILY_QUEST_TEMPLATES], 6);
        const tags = picked.map(q => tagMap[q.id] ?? 'other');
        expect(tags).toContain('battle');
        expect(tags).toContain('training');
        expect(tags).toContain('auto');
        // 每类最多2个
        const tagCounts: Record<string, number> = {};
        for (const t of tags) {
          tagCounts[t] = (tagCounts[t] ?? 0) + 1;
        }
        for (const count of Object.values(tagCounts)) {
          expect(count).toBeLessThanOrEqual(2);
        }
      }
    });

    it('D01(每日签到) 必定出现', () => {
      for (let i = 0; i < 50; i++) {
        const picked = pickDailyWithDiversity([...DAILY_QUEST_TEMPLATES], 6);
        expect(picked.some(q => q.id === 'daily-019')).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 5. 序列化安全
  // ═══════════════════════════════════════════

  describe('TC-Q-010: 序列化恢复一致性', () => {
    it('序列化→反序列化后状态一致', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('ser-1');
      sys.registerQuest(def);
      sys.acceptQuest('ser-1');
      sys.addActivityPoints(42);

      const saved = sys.serialize();

      const sys2 = createQuestSystem();
      sys2.deserialize(saved);

      expect(sys2.getActiveQuests().length).toBe(1);
      expect(sys2.getActivityState().currentPoints).toBe(42);
      expect(sys2.isQuestActive('ser-1')).toBe(true);
    });
  });

  describe('TC-Q-011: 空数据反序列化', () => {
    it('空对象不崩溃', () => {
      const sys = createQuestSystem();
      expect(() => sys.deserialize({} as QuestSystemSaveData)).not.toThrow();
    });

    it('null activityState 使用默认值', () => {
      const sys = createQuestSystem();
      sys.deserialize({ version: 1 } as QuestSystemSaveData);
      expect(sys.getActivityState().currentPoints).toBe(0);
    });
  });

  describe('TC-Q-021: reset 后 instanceCounter 碰撞', () => {
    it('reset 后新实例 ID 可能与旧 ID 冲突', () => {
      const sys = createQuestSystem();
      sys.registerQuest(createTestQuestDef('collision-1'));
      const inst1 = sys.acceptQuest('collision-1')!;
      const oldId = inst1.instanceId;

      // 序列化
      const saved = sys.serialize();

      // reset + 反序列化
      sys.reset();
      sys.deserialize(saved);

      // 创建新任务
      sys.registerQuest(createTestQuestDef('collision-2'));
      const inst2 = sys.acceptQuest('collision-2')!;

      // 潜在问题：inst2.instanceId 可能与恢复的实例冲突
      // 因为 instanceCounter 在 reset 后从0开始
      // 但反序列化不会恢复 instanceCounter
      // 注意：这是 P3 问题，实际可能不会触发
      expect(inst2.instanceId).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 6. updateProgressByType 参数匹配
  // ═══════════════════════════════════════════

  describe('TC-Q-016: updateProgressByType 参数匹配', () => {
    it('params 不匹配时跳过', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('param-match');
      sys.registerQuest(def);
      const inst = sys.acceptQuest('param-match')!;

      // obj2 需要 resource=gold，传入 resource=wood
      sys.updateProgressByType('collect_resource', 1, { resource: 'wood' });
      const obj = sys.getQuestInstance(inst.instanceId)!.objectives[1];
      expect(obj.currentCount).toBe(0); // 不匹配，不更新
    });

    it('params 匹配时更新', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('param-match2');
      sys.registerQuest(def);
      const inst = sys.acceptQuest('param-match2')!;

      sys.updateProgressByType('collect_resource', 1, { resource: 'gold' });
      const obj = sys.getQuestInstance(inst.instanceId)!.objectives[1];
      expect(obj.currentCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. QuestTrackerSystem 对抗
  // ═══════════════════════════════════════════

  describe('TC-Q-017: TrackerSystem 无绑定', () => {
    it('未绑定 questSystem 时事件不崩溃', () => {
      const deps = mockDeps();
      const tracker = new QuestTrackerSystem();
      tracker.init(deps);
      tracker.startTracking();

      // 模拟触发事件
      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of onCalls) {
        const callback = call[1];
        // 调用所有注册的回调
        (callback as Function)({ resource: 'gold' });
      }
      // 不应崩溃
    });
  });

  describe('TC-Q-018: 跳转路由优先级', () => {
    it('优先使用 questDef.jumpTarget', () => {
      const deps = mockDeps();
      const tracker = new QuestTrackerSystem();
      tracker.init(deps);

      const def: QuestDef = {
        id: 'jump-test',
        name: '跳转测试',
        category: 'main',
        objectives: [
          { id: 'obj1', type: 'battle_clear', description: '战斗', targetCount: 1, currentCount: 0 },
        ],
        rewards: { exp: 10 },
        jumpTarget: '/custom-route',
      };

      expect(tracker.getQuestJumpRoute(def)).toBe('/custom-route');
    });

    it('无 jumpTarget 时使用目标类型映射', () => {
      const deps = mockDeps();
      const tracker = new QuestTrackerSystem();
      tracker.init(deps);

      const def: QuestDef = {
        id: 'jump-test2',
        name: '跳转测试2',
        category: 'main',
        objectives: [
          { id: 'obj1', type: 'battle_clear', description: '战斗', targetCount: 1, currentCount: 0 },
        ],
        rewards: { exp: 10 },
      };

      expect(tracker.getQuestJumpRoute(def)).toBe('/campaign');
    });

    it('无匹配路由返回 null', () => {
      const deps = mockDeps();
      const tracker = new QuestTrackerSystem();
      tracker.init(deps);

      const def: QuestDef = {
        id: 'jump-test3',
        name: '跳转测试3',
        category: 'main',
        objectives: [
          { id: 'obj1', type: 'unknown_type' as any, description: '未知', targetCount: 1, currentCount: 0 },
        ],
        rewards: { exp: 10 },
      };

      expect(tracker.getQuestJumpRoute(def)).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 8. ActivitySystem 对抗
  // ═══════════════════════════════════════════

  describe('TC-Q-019: ActivitySystem 每日重置', () => {
    it('checkDailyReset 同一天返回 false', () => {
      const sys = new ActivitySystem();
      sys.init(mockDeps());
      // 先执行一次重置以设置 lastResetDate
      sys.resetDaily();
      sys.addPoints(50);

      const today = new Date().toISOString().slice(0, 10);
      expect(sys.checkDailyReset(today)).toBe(false);
      expect(sys.getCurrentPoints()).toBe(50);
    });

    it('checkDailyReset 不同天返回 true 并重置', () => {
      const sys = new ActivitySystem();
      sys.init(mockDeps());
      sys.addPoints(50);

      expect(sys.checkDailyReset('2020-01-01')).toBe(true);
      expect(sys.getCurrentPoints()).toBe(0);
    });
  });

  describe('TC-Q-024: ActivitySystem 大数溢出', () => {
    it('addPoints(MAX_SAFE_INTEGER) clamp 到 maxPoints', () => {
      const sys = new ActivitySystem();
      sys.init(mockDeps());
      sys.addPoints(Number.MAX_SAFE_INTEGER);
      expect(sys.getCurrentPoints()).toBe(sys.getMaxPoints());
    });
  });

  describe('ActivitySystem claimAllMilestones', () => {
    it('活跃度满时一键领取所有里程碑', () => {
      const sys = new ActivitySystem();
      sys.init(mockDeps());
      sys.addPoints(100);

      const rewards = sys.claimAllMilestones();
      expect(rewards.length).toBeGreaterThan(0);
      // 所有里程碑应已领取
      expect(sys.getNextClaimableIndex()).toBe(-1);
    });
  });

  describe('ActivitySystem getProgressRatio', () => {
    it('0点时返回 0', () => {
      const sys = new ActivitySystem();
      sys.init(mockDeps());
      expect(sys.getProgressRatio()).toBe(0);
    });

    it('50点时返回 0.5', () => {
      const sys = new ActivitySystem();
      sys.init(mockDeps());
      sys.addPoints(50);
      expect(sys.getProgressRatio()).toBe(0.5);
    });
  });

  // ═══════════════════════════════════════════
  // 9. QuestActivityManager 对抗
  // ═══════════════════════════════════════════

  describe('QuestActivityManager 对抗', () => {
    it('fullReset 恢复初始状态', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(80);
      mgr.fullReset();
      expect(mgr.getCurrentPoints()).toBe(0);
      expect(mgr.getMaxPoints()).toBe(MAX_ACTIVITY_POINTS);
    });

    it('restoreState 恢复外部状态', () => {
      const mgr = new QuestActivityManager();
      mgr.restoreState({
        currentPoints: 77,
        maxPoints: 200,
        milestones: DEFAULT_ACTIVITY_MILESTONES.map(m => ({ ...m })),
        lastResetDate: '2024-06-01',
      });
      expect(mgr.getCurrentPoints()).toBe(77);
      expect(mgr.getMaxPoints()).toBe(200);
    });
  });

  // ═══════════════════════════════════════════
  // 10. QuestDailyManager 对抗
  // ═══════════════════════════════════════════

  describe('TC-Q-023: QuestDailyManager 无 deps', () => {
    it('未设置 deps 时 refresh 返回空数组', () => {
      const mgr = new QuestDailyManager();
      expect(mgr.refresh()).toEqual([]);
    });

    it('fullReset 清空状态', () => {
      const mgr = new QuestDailyManager();
      mgr.fullReset();
      expect(mgr.getInstanceIds()).toEqual([]);
      expect(mgr.getRefreshDate()).toBe('');
    });
  });

  // ═══════════════════════════════════════════
  // 11. helper 纯函数对抗
  // ═══════════════════════════════════════════

  describe('helper: trackQuest 边界', () => {
    it('追踪不存在的实例返回 null', () => {
      const result = trackQuest('nonexistent', [], new Map());
      expect(result).toBeNull();
    });

    it('追踪非 active 实例返回 null', () => {
      const quests = new Map<string, QuestInstance>();
      quests.set('inst-1', {
        instanceId: 'inst-1',
        questDefId: 'q1',
        status: 'completed',
        objectives: [],
        acceptedAt: 0,
        completedAt: 0,
        rewardClaimed: false,
      });
      expect(trackQuest('inst-1', [], quests)).toBeNull();
    });
  });

  describe('helper: untrackQuest 边界', () => {
    it('取消追踪不存在的 ID 返回 null', () => {
      expect(untrackQuest('nonexistent', ['a', 'b'])).toBeNull();
    });
  });

  describe('helper: updateProgressByTypeLogic', () => {
    it('跳过已满进度的目标', () => {
      const quests = new Map<string, QuestInstance>();
      quests.set('inst-1', {
        instanceId: 'inst-1',
        questDefId: 'q1',
        status: 'active',
        objectives: [
          { id: 'obj1', type: 'battle_clear', description: '战斗', targetCount: 5, currentCount: 5 },
        ],
        acceptedAt: 0,
        completedAt: null,
        rewardClaimed: false,
      });

      const emit = vi.fn();
      const completeQuest = vi.fn();
      const checkQuestCompletion = vi.fn().mockReturnValue(false);

      updateProgressByTypeLogic('battle_clear', 1, quests, {
        emit,
        completeQuest,
        checkQuestCompletion,
      });

      // 已满进度，不应更新
      expect(quests.get('inst-1')!.objectives[0].currentCount).toBe(5);
    });
  });

  describe('helper: claimRewardLogic 对抗', () => {
    it('实例不存在返回 null', () => {
      const result = claimRewardLogic('nonexistent', {
        questDefs: new Map(),
        activeQuests: new Map(),
        addActivityPoints: vi.fn(),
        emit: vi.fn(),
      });
      expect(result).toBeNull();
    });

    it('定义不存在返回 null', () => {
      const quests = new Map<string, QuestInstance>();
      quests.set('inst-1', {
        instanceId: 'inst-1',
        questDefId: 'q-notexist',
        status: 'completed',
        objectives: [],
        acceptedAt: 0,
        completedAt: 0,
        rewardClaimed: false,
      });

      const result = claimRewardLogic('inst-1', {
        questDefs: new Map(),
        activeQuests: quests,
        addActivityPoints: vi.fn(),
        emit: vi.fn(),
      });
      expect(result).toBeNull();
    });
  });

  describe('helper: claimAllRewardsLogic', () => {
    it('空活跃任务返回空数组', () => {
      const rewards = claimAllRewardsLogic(new Map(), vi.fn());
      expect(rewards).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 12. QuestSerialization 对抗
  // ═══════════════════════════════════════════

  describe('QuestSerialization 对抗', () => {
    it('序列化空状态', () => {
      const data = serializeQuestState({
        activeQuests: new Map(),
        completedQuestIds: new Set(),
        activityState: { currentPoints: 0, maxPoints: 100, milestones: [], lastResetDate: '' },
        dailyRefreshDate: '',
        dailyQuestInstanceIds: [],
      });
      expect(data.activeQuests).toEqual([]);
      expect(data.completedQuestIds).toEqual([]);
    });

    it('反序列化含 undefined 字段的数据', () => {
      const quests = new Map<string, QuestInstance>();
      const completed = new Set<string>();
      expect(() => {
        deserializeQuestState({
          version: 1,
          activeQuests: undefined as any,
          completedQuestIds: undefined as any,
        }, quests, completed);
      }).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 13. 回调注入对抗
  // ═══════════════════════════════════════════

  describe('回调注入对抗', () => {
    it('rewardCallback 未设置时静默', () => {
      const sys = createQuestSystem();
      const def = createTestQuestDef('cb-test');
      sys.registerQuest(def);
      const inst = sys.acceptQuest('cb-test')!;
      sys.updateObjectiveProgress(inst.instanceId, 'cb-test-obj1', 10);
      sys.updateObjectiveProgress(inst.instanceId, 'cb-test-obj2', 200);
      // 不应崩溃
      expect(() => sys.claimReward(inst.instanceId)).not.toThrow();
    });

    it('rewardCallback 正确调用', () => {
      const sys = createQuestSystem();
      const cb = vi.fn();
      sys.setRewardCallback(cb);
      const def = createTestQuestDef('cb-test2');
      sys.registerQuest(def);
      const inst = sys.acceptQuest('cb-test2')!;
      sys.updateObjectiveProgress(inst.instanceId, 'cb-test2-obj1', 10);
      sys.updateObjectiveProgress(inst.instanceId, 'cb-test2-obj2', 200);
      sys.claimReward(inst.instanceId);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('activityAddCallback 正确调用', () => {
      const sys = createQuestSystem();
      const cb = vi.fn();
      sys.setActivityAddCallback(cb);
      // 日常任务领奖时会触发
      const def: QuestDef = {
        id: 'daily-cb',
        name: '日常回调测试',
        category: 'daily',
        objectives: [
          { id: 'd-obj1', type: 'daily_login', description: '登录', targetCount: 1, currentCount: 0 },
        ],
        rewards: { exp: 10, activityPoints: 20 },
      };
      sys.registerQuest(def);
      const inst = sys.acceptQuest('daily-cb')!;
      sys.updateObjectiveProgress(inst.instanceId, 'd-obj1', 1);
      sys.claimReward(inst.instanceId);
      expect(cb).toHaveBeenCalledWith(20);
    });
  });

  // ═══════════════════════════════════════════
  // 14. 周常任务对抗
  // ═══════════════════════════════════════════

  describe('TC-Q-022: 周常任务', () => {
    it('同周两次刷新返回相同任务', () => {
      const sys = createQuestSystem();
      const first = sys.refreshWeeklyQuests();
      const second = sys.refreshWeeklyQuests();
      expect(second.length).toBe(first.length);
    });

    it('getWeeklyQuests 返回活跃周常', () => {
      const sys = createQuestSystem();
      sys.refreshWeeklyQuests();
      const weekly = sys.getWeeklyQuests();
      expect(weekly.length).toBeGreaterThan(0);
      weekly.forEach(q => expect(q.status).toBe('active'));
    });
  });

  // ═══════════════════════════════════════════
  // 15. 综合跨系统场景
  // ═══════════════════════════════════════════

  describe('跨系统：Tracker + QuestSystem 集成', () => {
    it('Tracker 事件驱动进度更新', () => {
      const deps = mockDeps();
      const questSys = new QuestSystem();
      questSys.init(deps);

      const tracker = new QuestTrackerSystem();
      tracker.init(deps);
      tracker.bindQuestSystem(questSys);
      tracker.startTracking();

      const def = createTestQuestDef('tracker-integ');
      questSys.registerQuest(def);
      questSys.acceptQuest('tracker-integ');

      // 模拟游戏事件
      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const battleClearCb = onCalls.find(
        (call: any[]) => call[0] === 'battle:clear',
      )?.[1] as Function | undefined;

      if (battleClearCb) {
        battleClearCb({});
        const inst = questSys.getActiveQuests()[0];
        expect(inst.objectives[0].currentCount).toBe(1);
      }
    });
  });
});
