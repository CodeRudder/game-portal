/**
 * 每日系统对抗式测试
 *
 * 覆盖子系统：
 *   S1: SignInSystem（7天循环签到/补签/连续加成）
 *   S2: QuestDailyManager（每日任务池刷新/20选6/过期清理）
 *   S3: QuestActivityManager（活跃度点数/里程碑宝箱/每日重置）
 *   S4: ActivitySystem（日常活动/每日任务重置/离线进度）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/daily-adversarial
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignInSystem, createDefaultSignInData, DEFAULT_SIGN_IN_CONFIG, SIGN_IN_CYCLE_DAYS } from '../../engine/activity/SignInSystem';
import type { SignInData, SignInConfig, SignInReward } from '../../core/activity/activity.types';
import { QuestDailyManager } from '../../engine/quest/QuestDailyManager';
import type { DailyManagerDeps } from '../../engine/quest/QuestDailyManager';
import type { QuestDef, QuestInstance } from '../../core/quest';
import { DEFAULT_DAILY_POOL_CONFIG } from '../../core/quest';
import { QuestActivityManager, MAX_ACTIVITY_POINTS } from '../../engine/quest/QuestActivityManager';
import { ActivitySystem } from '../../engine/activity/ActivitySystem';
import { createDefaultActivityState } from '../../engine/activity/ActivityFactory';
import { ACTIVITY_SAVE_VERSION } from '../../engine/activity/ActivitySystemConfig';
import { ActivityType, ActivityStatus, ActivityTaskStatus, MilestoneStatus } from '../../core/activity/activity.types';
import type { ActivityDef, ActivityState, ActivityTaskDef, ActivityMilestone as ActMilestone } from '../../core/activity/activity.types';
import type { ISystemDeps } from '../../core/types/subsystem';

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const dateTs = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

const mockDeps = (): ISystemDeps => {
  const ls = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      once: vi.fn(), emit: vi.fn((e: string, p?: unknown) => { ls.get(e)?.forEach(h => h(p)); }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
};

const createDailyManagerDeps = () => {
  let counter = 0;
  return {
    expired: [] as string[],
    events: [] as Array<{ event: string; data: unknown }>,
    registerAndAccept: (def: QuestDef): QuestInstance => ({
      instanceId: `di-${++counter}`, questDefId: def.id, status: 'active',
      objectives: def.objectives.map(o => ({ ...o, currentCount: 0 })),
      acceptedAt: Date.now(), completedAt: null, rewardClaimed: false,
    }),
    expireQuest(id: string) { this.expired.push(id); },
    emitEvent(event: string, data: unknown) { this.events.push({ event, data }); },
  };
};

const dailyDef = (id = 'daily_act_1'): ActivityDef => ({
  id, name: '日常活动', description: '', type: ActivityType.DAILY,
  startTime: Date.now() - DAY_MS, endTime: Date.now() + 30 * DAY_MS, icon: '',
});

const taskDef = (id: string, target = 5): ActivityTaskDef => ({
  id, name: `任务${id}`, description: '', taskType: 'DAILY' as any,
  targetCount: target, tokenReward: 10, pointReward: 20, resourceReward: {},
});

// ═══════════════════════════════════════════════
// F-Normal
// ═══════════════════════════════════════════════

describe('每日对抗测试 — F-Normal', () => {

  describe('签到系统', () => {
    it('首次签到 consecutiveDays=1', () => {
      const sys = new SignInSystem();
      const r = sys.signIn(createDefaultSignInData(), dateTs(2025, 1, 1));
      expect(r.data.consecutiveDays).toBe(1);
      expect(r.data.todaySigned).toBe(true);
      expect(r.reward.day).toBe(1);
      expect(r.bonusPercent).toBe(0);
    });

    it('连续7天签到获得50%加成', () => {
      const sys = new SignInSystem();
      let data = createDefaultSignInData();
      let bonus = 0;
      for (let d = 1; d <= 7; d++) {
        const r = sys.signIn(data, dateTs(2025, 1, d));
        data = r.data; bonus = r.bonusPercent;
      }
      expect(data.consecutiveDays).toBe(7);
      expect(bonus).toBe(50);
    });

    it('第8天循环回第1天奖励', () => {
      const sys = new SignInSystem();
      let data = createDefaultSignInData();
      for (let d = 1; d <= 8; d++) {
        const r = sys.signIn(data, dateTs(2025, 1, d));
        data = r.data;
        if (d === 8) expect(r.reward.day).toBe(1);
      }
      expect(data.consecutiveDays).toBe(8);
    });

    it('断签重新从1开始', () => {
      const sys = new SignInSystem();
      const r1 = sys.signIn(createDefaultSignInData(), dateTs(2025, 1, 1));
      const r3 = sys.signIn(r1.data, dateTs(2025, 1, 3));
      expect(r3.data.consecutiveDays).toBe(1);
    });

    it('补签消耗元宝并记录次数', () => {
      const sys = new SignInSystem();
      const r = sys.retroactive(createDefaultSignInData(), dateTs(2025, 1, 1), 200);
      expect(r.goldCost).toBe(DEFAULT_SIGN_IN_CONFIG.retroactiveCostGold);
      expect(r.data.weeklyRetroactiveCount).toBe(1);
      expect(r.data.todaySigned).toBe(true);
    });

    it('canSignIn / canRetroactive 判断', () => {
      const sys = new SignInSystem();
      expect(sys.canSignIn(createDefaultSignInData())).toBe(true);
      expect(sys.canSignIn({ ...createDefaultSignInData(), todaySigned: true })).toBe(false);
      const now = dateTs(2025, 1, 1);
      expect(sys.canRetroactive(createDefaultSignInData(), now, 200).canRetroactive).toBe(true);
      expect(sys.canRetroactive(createDefaultSignInData(), now, 10).canRetroactive).toBe(false);
    });
  });

  describe('每日任务刷新', () => {
    it('首次刷新返回6个任务', () => {
      const mgr = new QuestDailyManager();
      const deps = createDailyManagerDeps();
      mgr.setDeps(deps);
      const result = mgr.refresh();
      expect(result.length).toBe(DEFAULT_DAILY_POOL_CONFIG.dailyPickCount);
      expect(mgr.getInstanceIds().length).toBe(DEFAULT_DAILY_POOL_CONFIG.dailyPickCount);
    });

    it('同天重复刷新返回空', () => {
      const mgr = new QuestDailyManager();
      mgr.setDeps(createDailyManagerDeps());
      mgr.refresh();
      expect(mgr.refresh()).toEqual([]);
      expect(mgr.isRefreshedToday()).toBe(true);
    });

    it('刷新发出事件', () => {
      const mgr = new QuestDailyManager();
      const deps = createDailyManagerDeps();
      mgr.setDeps(deps);
      mgr.refresh();
      expect(deps.events.some(e => e.event === 'quest:dailyRefreshed')).toBe(true);
    });
  });

  describe('活跃度系统', () => {
    it('增减与上限', () => {
      const mgr = new QuestActivityManager();
      expect(mgr.getCurrentPoints()).toBe(0);
      mgr.addPoints(30);
      expect(mgr.getCurrentPoints()).toBe(30);
      mgr.addPoints(200);
      expect(mgr.getCurrentPoints()).toBe(MAX_ACTIVITY_POINTS);
    });

    it('领取里程碑宝箱', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(50);
      expect(mgr.claimMilestone(0)).not.toBeNull();
      expect(mgr.claimMilestone(0)).toBeNull(); // 已领取
    });

    it('每日重置', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(80);
      mgr.resetDaily();
      expect(mgr.getCurrentPoints()).toBe(0);
      mgr.getMilestones().forEach(m => expect(m.claimed).toBe(false));
    });
  });

  describe('日常活动', () => {
    it('启动→进度→完成→领取 全流程', () => {
      const sys = new ActivitySystem();
      let state = createDefaultActivityState();
      const def = dailyDef();
      state = sys.startActivity(state, def, [taskDef('t1', 5)], [], Date.now());
      state = sys.updateTaskProgress(state, def.id, 't1', 5);
      expect(state.activities[def.id].tasks[0].status).toBe(ActivityTaskStatus.COMPLETED);
      const r = sys.claimTaskReward(state, def.id, 't1');
      expect(r.points).toBe(20);
      expect(r.state.activities[def.id].points).toBe(20);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error
// ═══════════════════════════════════════════════

describe('每日对抗测试 — F-Error', () => {

  describe('签到错误', () => {
    it('重复签到/NaN时间/Infinity时间 均抛错', () => {
      const sys = new SignInSystem();
      const data = createDefaultSignInData();
      const now = dateTs(2025, 1, 1);
      const r = sys.signIn(data, now);
      expect(() => sys.signIn(r.data, now)).toThrow('今日已签到');
      expect(() => sys.signIn(createDefaultSignInData(), NaN)).toThrow('时间参数异常');
      expect(() => sys.signIn(createDefaultSignInData(), Infinity)).toThrow('时间参数异常');
    });

    it('补签异常：已签到/次数用完/元宝不足/NaN', () => {
      const sys = new SignInSystem();
      const now = dateTs(2025, 1, 6);
      const signed = sys.signIn(createDefaultSignInData(), now).data;
      expect(() => sys.retroactive(signed, now, 200)).toThrow('今日已签到');

      let data = createDefaultSignInData();
      data = sys.retroactive(data, now, 200).data;
      data.todaySigned = false;
      data = sys.retroactive(data, now, 200).data;
      data.todaySigned = false;
      expect(() => sys.retroactive(data, now, 200)).toThrow('本周补签次数已用完');
      expect(() => sys.retroactive(createDefaultSignInData(), dateTs(2025, 1, 1), 10)).toThrow('元宝不足');
      expect(() => sys.retroactive(createDefaultSignInData(), NaN, 200)).toThrow('时间参数异常');
      expect(() => sys.retroactive(createDefaultSignInData(), dateTs(2025, 1, 1), NaN)).toThrow('元宝数据异常');
    });
  });

  describe('活跃度错误', () => {
    it('NaN/Infinity/负数/零 均静默忽略', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(NaN); expect(mgr.getCurrentPoints()).toBe(0);
      mgr.addPoints(Infinity); expect(mgr.getCurrentPoints()).toBe(0);
      mgr.addPoints(-10); expect(mgr.getCurrentPoints()).toBe(0);
      mgr.addPoints(0); expect(mgr.getCurrentPoints()).toBe(0);
    });

    it('索引越界返回 null', () => {
      const mgr = new QuestActivityManager();
      expect(mgr.claimMilestone(-1)).toBeNull();
      expect(mgr.claimMilestone(99)).toBeNull();
    });
  });

  describe('活动系统错误', () => {
    it('null def / NaN时间 抛错', () => {
      const sys = new ActivitySystem();
      const state = createDefaultActivityState();
      expect(() => sys.startActivity(state, null as any, [], [], Date.now())).toThrow();
      expect(() => sys.startActivity(state, dailyDef(), [], [], NaN)).toThrow();
    });

    it('领取未完成/已领取/不存在 奖励', () => {
      const sys = new ActivitySystem();
      let state = createDefaultActivityState();
      const def = dailyDef();
      state = sys.startActivity(state, def, [taskDef('t1', 5)], [], Date.now());
      expect(() => sys.claimTaskReward(state, def.id, 't1')).toThrow('任务未完成');
      state = sys.updateTaskProgress(state, def.id, 't1', 5);
      state = sys.claimTaskReward(state, def.id, 't1').state;
      expect(() => sys.claimTaskReward(state, def.id, 't1')).toThrow('已领取');
      expect(() => sys.claimTaskReward(createDefaultActivityState(), 'none', 't1')).toThrow('活动不存在');
    });

    it('里程碑：未解锁/已领取/不存在', () => {
      const sys = new ActivitySystem();
      const state = createDefaultActivityState();
      expect(() => sys.claimMilestone(state, 'none', 'm1')).toThrow('活动不存在');

      let s = createDefaultActivityState();
      s = sys.startActivity(s, dailyDef(), [taskDef('t1', 5)],
        [{ id: 'm1', requiredPoints: 10, status: MilestoneStatus.LOCKED, rewards: { gold: 500 }, isFinal: false }],
        Date.now());
      expect(() => sys.claimMilestone(s, dailyDef().id, 'm1')).toThrow('里程碑未解锁');

      // 完整流程：解锁→领取→再领
      s = sys.updateTaskProgress(s, dailyDef().id, 't1', 5);
      s = sys.claimTaskReward(s, dailyDef().id, 't1').state;
      s = sys.checkMilestones(s, dailyDef().id);
      s = sys.claimMilestone(s, dailyDef().id, 'm1').state;
      expect(() => sys.claimMilestone(s, dailyDef().id, 'm1')).toThrow('已领取');
    });
  });

  it('未设置 deps 时 refresh 返回空', () => {
    expect(new QuestDailyManager().refresh()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// F-Boundary
// ═══════════════════════════════════════════════

describe('每日对抗测试 — F-Boundary', () => {

  describe('签到边界', () => {
    it('getReward 边界索引', () => {
      const sys = new SignInSystem();
      expect(sys.getReward(0).day).toBe(1);
      expect(sys.getReward(-1).day).toBe(1);
      expect(sys.getReward(8).day).toBe(7);
    });

    it('getCycleDay 边界', () => {
      const sys = new SignInSystem();
      expect(sys.getCycleDay(0)).toBe(1);
      expect(sys.getCycleDay(7)).toBe(7);
      expect(sys.getCycleDay(14)).toBe(7);
    });

    it('getConsecutiveBonus 阈值', () => {
      const sys = new SignInSystem();
      expect(sys.getConsecutiveBonus(2)).toBe(0);
      expect(sys.getConsecutiveBonus(3)).toBe(20);
      expect(sys.getConsecutiveBonus(6)).toBe(20);
      expect(sys.getConsecutiveBonus(7)).toBe(50);
      expect(sys.getConsecutiveBonus(100)).toBe(50);
    });

    it('跨月/跨年 连续性保持', () => {
      const sys = new SignInSystem();
      const r1 = sys.signIn(createDefaultSignInData(), dateTs(2025, 1, 31));
      expect(sys.signIn(r1.data, dateTs(2025, 2, 1)).data.consecutiveDays).toBe(2);
      const r2 = sys.signIn(createDefaultSignInData(), dateTs(2024, 12, 31));
      expect(sys.signIn(r2.data, dateTs(2025, 1, 1)).data.consecutiveDays).toBe(2);
    });

    it('奖励返回深拷贝', () => {
      const sys = new SignInSystem();
      const r1 = sys.getReward(1);
      r1.rewards.copper = 99999;
      expect(sys.getReward(1).rewards.copper).not.toBe(99999);
    });

    it('从未签到补签视为首次', () => {
      const sys = new SignInSystem();
      const data = createDefaultSignInData();
      expect(data.lastSignInTime).toBe(0);
      expect(sys.retroactive(data, dateTs(2025, 1, 1), 200).data.consecutiveDays).toBe(1);
    });
  });

  describe('活跃度边界', () => {
    it('4个里程碑阈值 40/60/80/100', () => {
      const ms = new QuestActivityManager().getMilestones();
      expect(ms.map(m => m.points)).toEqual([40, 60, 80, 100]);
    });

    it('100点可领取全部4个里程碑', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(100);
      for (let i = 0; i < 4; i++) expect(mgr.claimMilestone(i)).not.toBeNull();
    });

    it('restoreState null 安全回退', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(50);
      mgr.restoreState(null as any);
      expect(mgr.getCurrentPoints()).toBe(0);
    });
  });

  describe('活动并行上限', () => {
    it('日常最多1个并行', () => {
      const sys = new ActivitySystem();
      const def1 = dailyDef('daily_1');
      const state = sys.startActivity(createDefaultActivityState(), def1, [], [], Date.now());
      expect(sys.canStartActivity(state, ActivityType.DAILY).canStart).toBe(false);
    });

    it('总上限为5', () => {
      const sys = new ActivitySystem();
      let state = createDefaultActivityState();
      const defs: ActivityDef[] = [
        { id: 'season_0', name: '', description: '', type: ActivityType.SEASON, startTime: 0, endTime: 1, icon: '' },
        { id: 'limited_0', name: '', description: '', type: ActivityType.LIMITED_TIME, startTime: 0, endTime: 1, icon: '' },
        { id: 'limited_1', name: '', description: '', type: ActivityType.LIMITED_TIME, startTime: 0, endTime: 1, icon: '' },
        { id: 'daily_0', name: '', description: '', type: ActivityType.DAILY, startTime: 0, endTime: 1, icon: '' },
        { id: 'festival_0', name: '', description: '', type: ActivityType.FESTIVAL, startTime: 0, endTime: 1, icon: '' },
      ];
      defs.forEach(d => { state = sys.startActivity(state, d, [], [], Date.now()); });
      expect(sys.canStartActivity(state, ActivityType.ALLIANCE).canStart).toBe(false);
    });
  });

  describe('任务进度边界', () => {
    it('NaN/负数/零 不更新', () => {
      const sys = new ActivitySystem();
      let s = createDefaultActivityState();
      s = sys.startActivity(s, dailyDef(), [taskDef('t1')], [], Date.now());
      const id = dailyDef().id;
      [NaN, -5, 0].forEach(v => {
        s = sys.updateTaskProgress(s, id, 't1', v);
        expect(s.activities[id].tasks[0].currentProgress).toBe(0);
      });
    });

    it('进度不超过目标值', () => {
      const sys = new ActivitySystem();
      let s = createDefaultActivityState();
      s = sys.startActivity(s, dailyDef(), [taskDef('t1', 5)], [], Date.now());
      s = sys.updateTaskProgress(s, dailyDef().id, 't1', 100);
      expect(s.activities[dailyDef().id].tasks[0].currentProgress).toBe(5);
    });

    it('不存在活动返回原 state', () => {
      const sys = new ActivitySystem();
      const s = createDefaultActivityState();
      expect(sys.updateTaskProgress(s, 'none', 't1', 5)).toBe(s);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Cross
// ═══════════════════════════════════════════════

describe('每日对抗测试 — F-Cross', () => {

  describe('签到与活跃度联动', () => {
    it('连续签到7天获取第7天代币奖励', () => {
      const sys = new SignInSystem();
      let data = createDefaultSignInData();
      for (let d = 1; d <= 7; d++) {
        const r = sys.signIn(data, dateTs(2025, 1, d));
        data = r.data;
        if (d === 7) {
          expect(r.reward.tokenReward).toBe(50);
          expect(r.bonusPercent).toBe(50);
        }
      }
    });
  });

  describe('任务→积分→里程碑联动', () => {
    it('完成任务→积分累积→解锁→领取里程碑', () => {
      const sys = new ActivitySystem();
      let state = createDefaultActivityState();
      const def = dailyDef();
      const ms: ActMilestone[] = [{ id: 'm1', requiredPoints: 15, status: MilestoneStatus.LOCKED, rewards: { gold: 500, gem: 50 }, isFinal: false }];
      state = sys.startActivity(state, def, [taskDef('t1', 5)], ms, Date.now());
      state = sys.updateTaskProgress(state, def.id, 't1', 5);
      state = sys.claimTaskReward(state, def.id, 't1').state;
      expect(state.activities[def.id].points).toBe(20);
      state = sys.checkMilestones(state, def.id);
      expect(state.activities[def.id].milestones[0].status).toBe(MilestoneStatus.UNLOCKED);
      const claimMs = sys.claimMilestone(state, def.id, 'm1');
      expect(claimMs.rewards.gold).toBe(500);
    });
  });

  describe('每日重置联动', () => {
    it('活跃度重置清空里程碑状态', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(60);
      mgr.claimMilestone(0);
      mgr.resetDaily();
      expect(mgr.getCurrentPoints()).toBe(0);
      mgr.getMilestones().forEach(m => expect(m.claimed).toBe(false));
    });

    it('活动每日任务重置', () => {
      const sys = new ActivitySystem();
      let s = createDefaultActivityState();
      const defs = [taskDef('t1', 5)];
      s = sys.startActivity(s, dailyDef(), defs, [], Date.now());
      s = sys.updateTaskProgress(s, dailyDef().id, 't1', 5);
      expect(s.activities[dailyDef().id].tasks[0].currentProgress).toBe(5);
      s = sys.resetDailyTasks(s, dailyDef().id, defs);
      expect(s.activities[dailyDef().id].tasks[0].currentProgress).toBe(0);
    });
  });

  describe('离线进度联动', () => {
    it('日常活动离线效率100%', () => {
      expect(new ActivitySystem().getOfflineEfficiency().daily).toBe(1.0);
    });

    it('计算离线进度返回结果', () => {
      const sys = new ActivitySystem();
      let s = createDefaultActivityState();
      s = sys.startActivity(s, dailyDef(), [], [], Date.now());
      expect(Array.isArray(sys.calculateOfflineProgress(s, DAY_MS))).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle
// ═══════════════════════════════════════════════

describe('每日对抗测试 — F-Lifecycle', () => {

  describe('SignInSystem 序列化', () => {
    it('serialize/deserialize 往返', () => {
      const sys = new SignInSystem({ retroactiveCostGold: 100 });
      const data = sys.serialize();
      expect(data.config.retroactiveCostGold).toBe(100);
      expect(data.rewards.length).toBe(SIGN_IN_CYCLE_DAYS);
      const sys2 = new SignInSystem();
      sys2.deserialize(data);
      expect(sys2.getConfig().retroactiveCostGold).toBe(100);
    });

    it('deserialize null/undefined/空对象 静默忽略', () => {
      const sys = new SignInSystem();
      expect(() => sys.deserialize(null as any)).not.toThrow();
      expect(() => sys.deserialize(undefined as any)).not.toThrow();
      sys.deserialize({});
      expect(sys.getConfig()).toEqual(DEFAULT_SIGN_IN_CONFIG);
    });

    it('序列化返回深拷贝', () => {
      const sys = new SignInSystem();
      const d1 = sys.serialize();
      d1.rewards[0].rewards.copper = 99999;
      expect(sys.serialize().rewards[0].rewards.copper).not.toBe(99999);
    });
  });

  describe('SignInSystem 重置与接口', () => {
    it('reset 恢复默认', () => {
      const sys = new SignInSystem({ retroactiveCostGold: 999 });
      sys.reset();
      expect(sys.getConfig().retroactiveCostGold).toBe(DEFAULT_SIGN_IN_CONFIG.retroactiveCostGold);
    });

    it('ISubsystem 接口完整', () => {
      const sys = new SignInSystem();
      expect(sys.name).toBe('signIn');
      expect(() => sys.init(mockDeps())).not.toThrow();
      expect(() => sys.update(16)).not.toThrow();
      expect((sys.getState() as any).name).toBe('signIn');
    });
  });

  describe('QuestDailyManager 序列化', () => {
    it('restoreState / fullReset', () => {
      const mgr = new QuestDailyManager();
      mgr.restoreState('2025-01-15', ['id1', 'id2']);
      expect(mgr.getRefreshDate()).toBe('2025-01-15');
      expect(mgr.getInstanceIds()).toEqual(['id1', 'id2']);
      mgr.fullReset();
      expect(mgr.getInstanceIds()).toEqual([]);
      expect(mgr.getRefreshDate()).toBe('');
    });
  });

  describe('QuestActivityManager 序列化', () => {
    it('restoreState 往返', () => {
      const mgr = new QuestActivityManager();
      mgr.addPoints(75);
      const mgr2 = new QuestActivityManager();
      mgr2.restoreState(mgr.getState());
      expect(mgr2.getCurrentPoints()).toBe(75);
    });

    it('NaN/undefined 安全回退', () => {
      const mgr = new QuestActivityManager();
      mgr.restoreState({ currentPoints: NaN, maxPoints: 100, milestones: undefined as any, lastResetDate: '' });
      expect(mgr.getCurrentPoints()).toBe(0);
      expect(mgr.getMilestones().length).toBe(4);
    });
  });

  describe('ActivitySystem 序列化', () => {
    it('serialize/deserialize 往返', () => {
      const sys = new ActivitySystem();
      const data = sys.serialize(createDefaultActivityState());
      expect(data.version).toBe(ACTIVITY_SAVE_VERSION);
      expect(sys.deserialize(data)).toBeDefined();
    });

    it('版本不匹配/null 返回默认状态', () => {
      const sys = new ActivitySystem();
      const r1 = sys.deserialize({ version: 999, state: createDefaultActivityState() });
      expect(r1).toBeDefined();
      const r2 = sys.deserialize(null as any);
      expect(Object.keys(r2.activities).length).toBe(0);
    });

    it('serialize 清洗 NaN', () => {
      const sys = new ActivitySystem();
      const state: ActivityState = {
        ...createDefaultActivityState(),
        activities: {
          test: {
            defId: 'test', status: ActivityStatus.ACTIVE, points: NaN, tokens: Infinity,
            tasks: [{ defId: 't1', taskType: 'DAILY' as any, currentProgress: NaN, targetCount: NaN, status: ActivityTaskStatus.INCOMPLETE, tokenReward: NaN, pointReward: NaN, resourceReward: {} }],
            milestones: [], createdAt: Date.now(),
          },
        },
      };
      const act = sys.serialize(state).state.activities['test'];
      expect(act.points).toBe(0);
      expect(act.tokens).toBe(0);
      expect(act.tasks[0].currentProgress).toBe(0);
    });
  });

  describe('完整每日生命周期', () => {
    it('签到→任务→活跃度→重置 全流程', () => {
      const signIn = new SignInSystem();
      const signData = signIn.signIn(createDefaultSignInData(), dateTs(2025, 3, 1)).data;
      expect(signData.consecutiveDays).toBe(1);

      const dailyMgr = new QuestDailyManager();
      dailyMgr.setDeps(createDailyManagerDeps());
      expect(dailyMgr.refresh().length).toBe(6);

      const actMgr = new QuestActivityManager();
      actMgr.addPoints(40);
      expect(actMgr.claimMilestone(0)).not.toBeNull();
      actMgr.resetDaily();
      expect(actMgr.getCurrentPoints()).toBe(0);
    });

    it('多日连续：签到+活跃度+序列化恢复', () => {
      const signIn = new SignInSystem();
      let signData = createDefaultSignInData();
      const actMgr = new QuestActivityManager();

      signData = signIn.signIn(signData, dateTs(2025, 3, 1)).data;
      actMgr.addPoints(60);
      signData = signIn.signIn(signData, dateTs(2025, 3, 2)).data;
      actMgr.resetDaily();
      actMgr.addPoints(80);

      // 恢复活跃度
      const mgr2 = new QuestActivityManager();
      mgr2.restoreState(actMgr.getState());
      expect(mgr2.getCurrentPoints()).toBe(80);

      // 恢复签到配置
      const signIn2 = new SignInSystem();
      signIn2.deserialize(signIn.serialize());
      expect(signIn2.getCycleDays()).toBe(SIGN_IN_CYCLE_DAYS);
    });
  });
});
