/**
 * 集成测试 §2: 活动系统全链路 — 限时活动→代币商店→排行榜→签到→离线进度
 *
 * 覆盖 Play §3 的活动系统核心循环：
 *   - 限时活动4阶段流程（预览→活跃→结算→关闭）
 *   - 代币兑换商店（七阶体系 + 限购 + 刷新）
 *   - 活动排行榜（积分排序 + 奖励梯度）
 *   - 签到系统（7天循环 + 连续加成 + 补签）
 *   - 离线进度累积
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ActivitySystem } from '../../../activity/ActivitySystem';
import { TokenShopSystem } from '../../../activity/TokenShopSystem';
import { TimedActivitySystem } from '../../../activity/TimedActivitySystem';
import { SignInSystem, DEFAULT_SIGN_IN_REWARDS, DEFAULT_SIGN_IN_CONFIG, SIGN_IN_CYCLE_DAYS, createDefaultSignInData } from '../../../activity/SignInSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { ActivityDef, ActivityTaskDef, ActivityMilestone, ActivityState } from '../../../../core/activity/activity.types';
import { ActivityType, ActivityStatus, ActivityTaskStatus, MilestoneStatus } from '../../../../core/activity/activity.types';

// ─────────────────────────────────────────────
// 辅助
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

function makeActivityDef(overrides?: Partial<ActivityDef>): ActivityDef {
  return {
    id: 'act-test-001',
    name: '测试活动',
    description: '集成测试活动',
    type: ActivityType.LIMITED_TIME,
    startTime: Date.now(),
    endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  } as ActivityDef;
}

function makeTaskDef(overrides?: Partial<ActivityTaskDef>): ActivityTaskDef {
  return {
    id: 'task-001',
    name: '击败敌军',
    description: '击败50次敌军',
    type: 'daily',
    targetCount: 50,
    pointReward: 50,
    tokenReward: 100,
    ...overrides,
  };
}

function makeMilestone(overrides?: Partial<ActivityMilestone>): ActivityMilestone {
  return {
    id: 'ms-001',
    requiredPoints: 100,
    status: MilestoneStatus.LOCKED,
    rewards: { copper: 500, gold: 10 },
    ...overrides,
  };
}

const BASE_TIME = new Date('2024-01-01T00:00:00Z').getTime();
function dayOffset(days: number): number {
  return BASE_TIME + days * 24 * 60 * 60 * 1000;
}

// ═══════════════════════════════════════════════
// §2 活动系统全链路集成
// ═══════════════════════════════════════════════

describe('§2 活动系统全链路集成', () => {
  let activitySys: ActivitySystem;
  let shopSys: TokenShopSystem;
  let timedSys: TimedActivitySystem;
  let signInSys: SignInSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    activitySys = new ActivitySystem();
    shopSys = new TokenShopSystem();
    timedSys = new TimedActivitySystem();
    signInSys = new SignInSystem();

    activitySys.init(deps);
    shopSys.init(deps);
    timedSys.init(deps);
    signInSys.init(deps);
  });

  // ─── §2.1 限时活动4阶段流程 ─────────────

  describe('§2.1 限时活动4阶段流程', () => {
    it('创建限时活动流程', () => {
      const now = Date.now();
      const flow = timedSys.createTimedActivityFlow('act-1', now, now + 7 * 86400000);
      expect(flow.phase).toBe('preview');
      expect(flow.activityId).toBe('act-1');
    });

    it('预览阶段 → 活跃阶段转换', () => {
      const now = Date.now();
      const activeStart = now + 1000;
      timedSys.createTimedActivityFlow('act-2', activeStart, activeStart + 86400000);
      const phase = timedSys.updatePhase('act-2', activeStart + 1);
      expect(phase).toBe('active');
    });

    it('活跃阶段 → 结算阶段转换', () => {
      const now = Date.now();
      const activeEnd = now + 100;
      timedSys.createTimedActivityFlow('act-3', now, activeEnd);
      const phase = timedSys.updatePhase('act-3', activeEnd + 1);
      expect(phase).toBe('settlement');
    });

    it('结算阶段 → 关闭阶段转换', () => {
      const now = Date.now();
      const activeEnd = now;
      timedSys.createTimedActivityFlow('act-4', now - 86400000, activeEnd);
      const phase = timedSys.updatePhase('act-4', activeEnd + 3 * 3600000);
      expect(phase).toBe('closed');
    });

    it('canParticipate 仅在活跃阶段返回 true', () => {
      const now = Date.now();
      timedSys.createTimedActivityFlow('act-5', now + 86400000, now + 2 * 86400000);
      expect(timedSys.canParticipate('act-5', now)).toBe(false);
      expect(timedSys.canParticipate('act-5', now + 86400000 + 1)).toBe(true);
    });

    it('获取剩余时间', () => {
      const now = Date.now();
      const end = now + 3600000;
      timedSys.createTimedActivityFlow('act-6', now, end);
      const remaining = timedSys.getRemainingTime('act-6', now + 1800000);
      expect(remaining).toBe(1800000);
    });

    it('剩余时间为负时返回 0', () => {
      const now = Date.now();
      timedSys.createTimedActivityFlow('act-7', now - 7200000, now - 3600000);
      expect(timedSys.getRemainingTime('act-7', now)).toBe(0);
    });

    it('不存在的活动返回 closed', () => {
      expect(timedSys.updatePhase('nonexistent', Date.now())).toBe('closed');
    });
  });

  // ─── §2.2 代币兑换商店 ──────────────────

  describe('§2.2 代币兑换商店（七阶体系）', () => {
    it('初始有默认商品', () => {
      const items = shopSys.getAllItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('按稀有度过滤商品', () => {
      const common = shopSys.getItemsByRarity('common');
      expect(Array.isArray(common)).toBe(true);
    });

    it('代币不足时购买失败', () => {
      const items = shopSys.getAvailableItems();
      if (items.length > 0) {
        const result = shopSys.purchaseItem(items[0].id);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('不足');
      }
    });

    it('添加代币后可购买', () => {
      shopSys.addTokens(10000);
      const items = shopSys.getAvailableItems();
      if (items.length > 0 && items[0].tokenPrice <= 10000) {
        const result = shopSys.purchaseItem(items[0].id);
        expect(result.success).toBe(true);
        expect(result.tokensSpent).toBeGreaterThan(0);
      }
    });

    it('购买后代币余额减少', () => {
      shopSys.addTokens(10000);
      const items = shopSys.getAvailableItems();
      if (items.length > 0 && items[0].tokenPrice <= 10000) {
        const price = items[0].tokenPrice;
        shopSys.purchaseItem(items[0].id);
        expect(shopSys.getTokenBalance()).toBe(10000 - price);
      }
    });

    it('限购商品达到上限后不可购买', () => {
      shopSys.addTokens(100000);
      const items = shopSys.getAvailableItems();
      const limitedItem = items.find(i => i.purchaseLimit > 0);
      if (limitedItem) {
        // 买满
        for (let i = 0; i < limitedItem.purchaseLimit; i++) {
          shopSys.purchaseItem(limitedItem.id);
        }
        const result = shopSys.purchaseItem(limitedItem.id);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('限购');
      }
    });

    it('商店刷新重置购买数量', () => {
      shopSys.addTokens(100000);
      const items = shopSys.getAvailableItems();
      if (items.length > 0) {
        shopSys.purchaseItem(items[0].id);
        const refreshed = shopSys.refreshShop();
        expect(refreshed).toBeGreaterThanOrEqual(0);
      }
    });

    it('每日刷新重置所有购买计数', () => {
      shopSys.addTokens(100000);
      const items = shopSys.getAvailableItems();
      if (items.length > 0) {
        shopSys.purchaseItem(items[0].id);
      }
      const count = shopSys.dailyRefresh();
      expect(count).toBeGreaterThan(0);
      // 购买计数应归零
      const refreshed = shopSys.getAllItems();
      refreshed.forEach(item => expect(item.purchased).toBe(0));
    });

    it('商品上架/下架', () => {
      const items = shopSys.getAllItems();
      if (items.length > 0) {
        shopSys.setItemAvailability(items[0].id, false);
        const item = shopSys.getItem(items[0].id);
        expect(item!.available).toBe(false);
      }
    });

    it('序列化与反序列化', () => {
      shopSys.addTokens(500);
      const data = shopSys.serialize();
      expect(data.tokenBalance).toBe(500);

      const newShop = new TokenShopSystem();
      newShop.init(mockDeps());
      newShop.deserialize(data);
      expect(newShop.getTokenBalance()).toBe(500);
    });
  });

  // ─── §2.3 活动排行榜 ──────────────────

  describe('§2.3 活动排行榜', () => {
    it('更新排行榜按积分降序排列', () => {
      const entries = [
        { playerId: 'p1', playerName: 'A', points: 100, tokens: 50, rank: 0, faction: 'wei' },
        { playerId: 'p2', playerName: 'B', points: 300, tokens: 80, rank: 0, faction: 'shu' },
        { playerId: 'p3', playerName: 'C', points: 200, tokens: 60, rank: 0, faction: 'wu' },
      ];
      const result = timedSys.updateLeaderboard('act-lb-1', entries as any);
      expect(result[0].rank).toBe(1);
      expect(result[0].points).toBe(300);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it('同分按代币数排序', () => {
      const entries = [
        { playerId: 'p1', playerName: 'A', points: 200, tokens: 30, rank: 0, faction: 'wei' },
        { playerId: 'p2', playerName: 'B', points: 200, tokens: 80, rank: 0, faction: 'shu' },
      ];
      const result = timedSys.updateLeaderboard('act-lb-2', entries as any);
      expect(result[0].playerId).toBe('p2');
    });

    it('获取玩家排名', () => {
      const entries = [
        { playerId: 'p1', playerName: 'A', points: 500, tokens: 50, rank: 0, faction: 'wei' },
        { playerId: 'p2', playerName: 'B', points: 100, tokens: 20, rank: 0, faction: 'shu' },
      ];
      timedSys.updateLeaderboard('act-lb-3', entries as any);
      expect(timedSys.getPlayerRank('act-lb-3', 'p1')).toBe(1);
      expect(timedSys.getPlayerRank('act-lb-3', 'p2')).toBe(2);
    });

    it('未上榜玩家排名为 0', () => {
      expect(timedSys.getPlayerRank('nonexistent', 'p1')).toBe(0);
    });

    it('计算排行奖励', () => {
      const rewards = timedSys.calculateRankRewards(1);
      expect(Object.keys(rewards).length).toBeGreaterThan(0);
    });

    it('排行榜裁剪到最大条目数', () => {
      const entries = Array.from({ length: 200 }, (_, i) => ({
        playerId: `p${i}`, playerName: `P${i}`, points: 200 - i, tokens: 50, rank: 0, faction: 'wei',
      }));
      const result = timedSys.updateLeaderboard('act-lb-4', entries as any);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  // ─── §2.4 签到系统 ──────────────────────

  describe('§2.4 签到系统', () => {
    it('首次签到成功', () => {
      const data = createDefaultSignInData();
      const result = signInSys.signIn(data, BASE_TIME);
      expect(result.data.consecutiveDays).toBe(1);
      expect(result.data.todaySigned).toBe(true);
    });

    it('连续7天签到完成一个循环', () => {
      let data = createDefaultSignInData();
      for (let i = 0; i < 7; i++) {
        const result = signInSys.signIn(data, dayOffset(i));
        expect(result.data.consecutiveDays).toBe(i + 1);
        data = result.data;
      }
      expect(data.consecutiveDays).toBe(7);
    });

    it('断签重置连续天数', () => {
      let data = createDefaultSignInData();
      const r1 = signInSys.signIn(data, dayOffset(0));
      data = r1.data;
      const r2 = signInSys.signIn(data, dayOffset(1));
      data = r2.data;
      // 跳过一天
      const r3 = signInSys.signIn(data, dayOffset(3));
      expect(r3.data.consecutiveDays).toBe(1);
    });

    it('同天重复签到抛异常', () => {
      const data = createDefaultSignInData();
      const r1 = signInSys.signIn(data, BASE_TIME);
      // Use returned data which has todaySigned=true
      expect(() => signInSys.signIn(r1.data, BASE_TIME)).toThrow('今日已签到');
    });

    it('补签消耗元宝', () => {
      let data = createDefaultSignInData();
      const r1 = signInSys.signIn(data, dayOffset(0));
      data = r1.data;
      // 补签
      const retroResult = signInSys.retroactive(data, dayOffset(2), 100);
      expect(retroResult.goldCost).toBe(DEFAULT_SIGN_IN_CONFIG.retroactiveCostGold);
    });

    it('补签次数周限制', () => {
      let data = createDefaultSignInData();
      data.weeklyRetroactiveCount = 2;
      data.lastRetroactiveResetWeek = 1;
      expect(() => signInSys.retroactive(data, dayOffset(2), 100)).toThrow('补签次数已用完');
    });

    it('获取签到奖励列表', () => {
      const rewards = signInSys.getAllRewards();
      expect(rewards).toHaveLength(7);
    });

    it('获取连续加成', () => {
      expect(signInSys.getConsecutiveBonus(2)).toBe(0);
      expect(signInSys.getConsecutiveBonus(3)).toBe(DEFAULT_SIGN_IN_CONFIG.consecutive3Bonus);
      expect(signInSys.getConsecutiveBonus(7)).toBe(DEFAULT_SIGN_IN_CONFIG.consecutive7Bonus);
    });
  });

  // ─── §2.5 离线进度 ──────────────────────

  describe('§2.5 离线进度累积', () => {
    it('计算限时活动离线进度', () => {
      const result = timedSys.calculateOfflineProgress('act-1', 'limitedTime', 3600000);
      expect(result.pointsEarned).toBeGreaterThan(0);
      expect(result.activityId).toBe('act-1');
    });

    it('不同活动类型效率不同', () => {
      const season = timedSys.calculateOfflineProgress('a1', 'season', 3600000);
      const daily = timedSys.calculateOfflineProgress('a2', 'daily', 3600000);
      const limited = timedSys.calculateOfflineProgress('a3', 'limitedTime', 3600000);
      // daily效率100% > season 50% > limited 30%
      expect(daily.pointsEarned).toBeGreaterThan(season.pointsEarned);
      expect(season.pointsEarned).toBeGreaterThan(limited.pointsEarned);
    });

    it('批量计算离线进度', () => {
      const activities = [
        { id: 'a1', type: 'season' },
        { id: 'a2', type: 'limitedTime' },
        { id: 'a3', type: 'daily' },
      ];
      const summary = timedSys.calculateAllOfflineProgress(activities, 3600000);
      expect(summary.activityResults).toHaveLength(3);
      expect(summary.totalPoints).toBeGreaterThan(0);
    });

    it('ActivitySystem 离线进度计算', () => {
      const state: ActivityState = {
        activities: {},
        signIn: createDefaultSignInData(),
      };
      const results = activitySys.calculateOfflineProgress(state, 3600000);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ─── §2.6 活动系统任务与里程碑 ──────────

  describe('§2.6 活动任务与里程碑', () => {
    it('启动活动并添加任务', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const def = makeActivityDef();
      const tasks = [makeTaskDef(), makeTaskDef({ id: 'task-002', name: '收集资源' })];
      const milestones = [makeMilestone(), makeMilestone({ id: 'ms-002', requiredPoints: 500 })];

      const newState = activitySys.startActivity(state, def, tasks, milestones);
      const instance = newState.activities[def.id];
      expect(instance).toBeDefined();
      expect(instance.tasks).toHaveLength(2);
      expect(instance.milestones).toHaveLength(2);
    });

    it('更新任务进度', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ targetCount: 50 });
      const newState = activitySys.startActivity(state, def, [taskDef], []);

      const updated = activitySys.updateTaskProgress(newState, def.id, taskDef.id, 30);
      const task = updated.activities[def.id].tasks[0];
      expect(task.currentProgress).toBe(30);
      expect(task.status).toBe(ActivityTaskStatus.INCOMPLETE);
    });

    it('任务完成状态变更', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ targetCount: 50 });
      const newState = activitySys.startActivity(state, def, [taskDef], []);

      const updated = activitySys.updateTaskProgress(newState, def.id, taskDef.id, 50);
      const task = updated.activities[def.id].tasks[0];
      expect(task.status).toBe(ActivityTaskStatus.COMPLETED);
    });

    it('领取任务奖励', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ targetCount: 50, pointReward: 100, tokenReward: 200 });
      let newState = activitySys.startActivity(state, def, [taskDef], []);
      newState = activitySys.updateTaskProgress(newState, def.id, taskDef.id, 50);

      const result = activitySys.claimTaskReward(newState, def.id, taskDef.id);
      expect(result.points).toBe(100);
      expect(result.tokens).toBe(200);
    });

    it('重复领取任务奖励抛异常', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ targetCount: 10 });
      let newState = activitySys.startActivity(state, def, [taskDef], []);
      newState = activitySys.updateTaskProgress(newState, def.id, taskDef.id, 10);
      const claimed = activitySys.claimTaskReward(newState, def.id, taskDef.id);
      expect(() => activitySys.claimTaskReward(claimed.state, def.id, taskDef.id)).toThrow('已领取');
    });

    it('里程碑按积分解锁', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const def = makeActivityDef();
      const ms = makeMilestone({ requiredPoints: 100 });
      let newState = activitySys.startActivity(state, def, [], [ms]);
      // 设置积分
      newState.activities[def.id].points = 150;
      const checked = activitySys.checkMilestones(newState, def.id);
      expect(checked.activities[def.id].milestones[0].status).toBe(MilestoneStatus.UNLOCKED);
    });

    it('领取里程碑奖励', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const def = makeActivityDef();
      const ms = makeMilestone({ requiredPoints: 100, rewards: { copper: 500 } });
      let newState = activitySys.startActivity(state, def, [], [ms]);
      newState.activities[def.id].points = 150;
      newState = activitySys.checkMilestones(newState, def.id);

      const result = activitySys.claimMilestone(newState, def.id, ms.id);
      expect(result.rewards.copper).toBe(500);
    });
  });

  // ─── §2.7 节日活动框架 ──────────────────

  describe('§2.7 节日活动框架', () => {
    it('获取春节模板', () => {
      const template = timedSys.getFestivalTemplate('spring');
      expect(template).toBeDefined();
      expect(template!.name).toContain('春节');
    });

    it('获取所有节日模板', () => {
      const templates = timedSys.getAllFestivalTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(5);
    });

    it('创建节日活动', () => {
      const result = timedSys.createFestivalActivity('spring', Date.now(), 7);
      expect(result).not.toBeNull();
      expect(result!.template.festivalType).toBe('spring');
      expect(result!.flow).toBeDefined();
    });

    it('不存在的节日类型返回 null', () => {
      const result = timedSys.createFestivalActivity('nonexistent' as any, Date.now());
      expect(result).toBeNull();
    });
  });

  // ─── §2.8 序列化 ────────────────────────

  describe('§2.8 活动系统序列化', () => {
    it('TimedActivitySystem 序列化与恢复', () => {
      timedSys.createTimedActivityFlow('act-s', Date.now(), Date.now() + 86400000);
      const data = timedSys.serialize();
      expect(data.flows).toHaveLength(1);

      const newSys = new TimedActivitySystem();
      newSys.init(mockDeps());
      newSys.deserialize(data);
      expect(newSys.getAllFlows()).toHaveLength(1);
    });

    it('ActivitySystem 序列化与恢复', () => {
      const state: ActivityState = { activities: {}, signIn: createDefaultSignInData() };
      const saveData = activitySys.serialize(state);
      expect(saveData.version).toBeDefined();
      const restored = activitySys.deserialize(saveData);
      expect(restored).toBeDefined();
    });
  });
});
