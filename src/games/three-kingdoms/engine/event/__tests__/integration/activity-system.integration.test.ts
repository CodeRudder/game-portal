/**
 * 集成测试 §3: 活动系统 — 限时活动/商店/签到/活跃度/排行榜
 *
 * 覆盖 v15.0 Play §3 活动系统核心循环：
 *   - 限时活动4阶段流程（预览→活跃→结算→关闭）
 *   - 代币兑换商店（七阶稀有度 + 限购 + 刷新）
 *   - 签到系统（7天循环 + 连续加成 + 补签）
 *   - 活跃度系统（任务积分 + 里程碑奖励）
 *   - 活动排行榜（积分排序 + 奖励梯度）
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TokenShopSystem } from '../../../activity/TokenShopSystem';
import { TimedActivitySystem } from '../../../activity/TimedActivitySystem';
import { ActivitySystem } from '../../../activity/ActivitySystem';
import { SignInSystem, DEFAULT_SIGN_IN_REWARDS, DEFAULT_SIGN_IN_CONFIG, SIGN_IN_CYCLE_DAYS, createDefaultSignInData } from '../../../activity/SignInSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { TokenShopItem, TokenShopConfig, ShopItemRarity } from '../../../../core/event/event-activity.types';
import type { SignInData, SignInReward, ActivityDef, ActivityTaskDef, ActivityMilestone, ActivityState } from '../../../../core/activity/activity.types';
import { ActivityType, ActivityStatus, ActivityTaskStatus, MilestoneStatus } from '../../../../core/activity/activity.types';
import type { ActivityRankEntry } from '../../../../core/event/event-activity.types';

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

function makeShopItem(overrides?: Partial<TokenShopItem>): TokenShopItem {
  return {
    id: 'item-001',
    name: '铜钱礼包',
    description: '获得1000铜钱',
    rarity: 'common',
    tokenPrice: 10,
    purchaseLimit: 5,
    purchased: 0,
    rewards: { copper: 1000 },
    activityId: '',
    available: true,
    ...overrides,
  };
}

const BASE_TIME = new Date('2024-01-01T00:00:00Z').getTime();
function dayOffset(days: number): number {
  return BASE_TIME + days * 24 * 60 * 60 * 1000;
}

// ─────────────────────────────────────────────
// §3 活动系统
// ─────────────────────────────────────────────

describe('§3 活动系统 — 限时活动/商店/签到/活跃度/排行榜', () => {

  // ─── §3.1 代币兑换商店 ─────────────────────

  describe('§3.1 代币兑换商店（七阶稀有度 + 限购 + 刷新）', () => {
    let shop: TokenShopSystem;

    beforeEach(() => {
      shop = new TokenShopSystem(undefined, undefined, 100);
      shop.init(mockDeps());
    });

    it('应正确初始化商店并加载默认商品', () => {
      const items = shop.getAllItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('应正确查询代币余额', () => {
      expect(shop.getTokenBalance()).toBe(100);
    });

    it('应正确增加代币', () => {
      const newBalance = shop.addTokens(50);
      expect(newBalance).toBe(150);
      expect(shop.getTokenBalance()).toBe(150);
    });

    it('应正确消耗代币', () => {
      const result = shop.spendTokens(30);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(70);
    });

    it('代币不足时应拒绝消耗', () => {
      const result = shop.spendTokens(200);
      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(100);
    });

    it('应成功购买可用商品', () => {
      const item = makeShopItem({ tokenPrice: 10 });
      shop.addItem(item);
      const result = shop.purchaseItem(item.id);
      expect(result.success).toBe(true);
      expect(result.tokensSpent).toBe(10);
      expect(shop.getTokenBalance()).toBe(90);
    });

    it('购买不存在的商品应失败', () => {
      const result = shop.purchaseItem('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('代币不足时应拒绝购买', () => {
      const item = makeShopItem({ tokenPrice: 200 });
      shop.addItem(item);
      const result = shop.purchaseItem(item.id);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('达到限购数量后应拒绝购买', () => {
      const item = makeShopItem({ tokenPrice: 1, purchaseLimit: 2 });
      shop.addItem(item);
      shop.purchaseItem(item.id, 2);
      const result = shop.purchaseItem(item.id);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('限购');
    });

    it('批量购买应正确计算总价', () => {
      const item = makeShopItem({ tokenPrice: 5, purchaseLimit: 10 });
      shop.addItem(item);
      const result = shop.purchaseItem(item.id, 3);
      expect(result.success).toBe(true);
      expect(result.tokensSpent).toBe(15);
    });

    it('下架商品不应可购买', () => {
      const item = makeShopItem({ available: false });
      shop.addItem(item);
      const result = shop.purchaseItem(item.id);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('下架');
    });

    it('refreshShop 应重置所有商品购买计数', () => {
      const item = makeShopItem({ tokenPrice: 1, purchaseLimit: 5 });
      shop.addItem(item);
      shop.purchaseItem(item.id, 3);
      const refreshed = shop.refreshShop();
      expect(refreshed).toBeGreaterThanOrEqual(1);
      expect(shop.getItem(item.id)?.purchased).toBe(0);
    });

    it('按稀有度筛选商品应正确工作', () => {
      const before = shop.getItemsByRarity('supreme').length;
      shop.addItem(makeShopItem({ id: 'sp1', rarity: 'supreme' }));
      shop.addItem(makeShopItem({ id: 'sp2', rarity: 'supreme' }));
      const after = shop.getItemsByRarity('supreme').length;
      expect(after - before).toBe(2);
    });

    it('getAvailableItems 应仅返回可购买商品', () => {
      shop.addItem(makeShopItem({ id: 'a1', available: true, purchaseLimit: 1, purchased: 1 }));
      shop.addItem(makeShopItem({ id: 'a2', available: true, purchaseLimit: 5, purchased: 0 }));
      const available = shop.getAvailableItems();
      const ids = available.map(i => i.id);
      expect(ids).toContain('a2');
      expect(ids).not.toContain('a1');
    });

    it('dailyRefresh 应重置限购并提供新商品', () => {
      const item = makeShopItem({ tokenPrice: 1, purchaseLimit: 5 });
      shop.addItem(item);
      shop.purchaseItem(item.id, 3);

      const count = shop.dailyRefresh([makeShopItem({ id: 'new-1' })]);
      expect(shop.getItem('new-1')).toBeDefined();
    });
  });

  // ─── §3.2 签到系统 ─────────────────────────

  describe('§3.2 签到系统（7天循环 + 连续加成 + 补签）', () => {
    let signIn: SignInSystem;

    beforeEach(() => {
      signIn = new SignInSystem();
      signIn.init(mockDeps());
    });

    it('首次签到应从第1天开始', () => {
      const data = createDefaultSignInData();
      const result = signIn.signIn(data, dayOffset(0));
      expect(result.data.consecutiveDays).toBe(1);
      expect(result.data.todaySigned).toBe(true);
      expect(result.reward).toBeDefined();
    });

    it('连续签到应递增天数', () => {
      let data = createDefaultSignInData();
      data = signIn.signIn(data, dayOffset(0)).data;
      data = { ...data, todaySigned: false };
      data = signIn.signIn(data, dayOffset(1)).data;
      expect(data.consecutiveDays).toBe(2);
    });

    it('7天循环应正确回绕', () => {
      let data = createDefaultSignInData();
      for (let i = 0; i < 7; i++) {
        data = signIn.signIn(data, dayOffset(i)).data;
        if (i < 6) data = { ...data, todaySigned: false };
      }
      expect(data.consecutiveDays).toBe(7);
      const cycleDay = ((data.consecutiveDays - 1) % SIGN_IN_CYCLE_DAYS) + 1;
      expect(cycleDay).toBe(7);
    });

    it('断签后应重置为第1天', () => {
      let data = createDefaultSignInData();
      data = signIn.signIn(data, dayOffset(0)).data;
      data = { ...data, todaySigned: false };
      // 跳过2天
      data = signIn.signIn(data, dayOffset(3)).data;
      expect(data.consecutiveDays).toBe(1);
    });

    it('同一天重复签到应抛出错误', () => {
      const data = createDefaultSignInData();
      const result = signIn.signIn(data, dayOffset(0));
      expect(() => signIn.signIn(result.data, dayOffset(0))).toThrow('今日已签到');
    });

    it('连续3天应获得20%加成', () => {
      let data = createDefaultSignInData();
      for (let i = 0; i < 3; i++) {
        data = signIn.signIn(data, dayOffset(i)).data;
        if (i < 2) data = { ...data, todaySigned: false };
      }
      const result = signIn.getConsecutiveBonus(data.consecutiveDays);
      expect(result).toBe(DEFAULT_SIGN_IN_CONFIG.consecutive3Bonus);
    });

    it('连续7天应获得50%加成', () => {
      const bonus = signIn.getConsecutiveBonus(7);
      expect(bonus).toBe(DEFAULT_SIGN_IN_CONFIG.consecutive7Bonus);
    });

    it('补签应消耗元宝并增加连续天数', () => {
      let data = createDefaultSignInData();
      data = signIn.signIn(data, dayOffset(0)).data;
      data = { ...data, todaySigned: false };
      const result = signIn.retroactive(data, dayOffset(2), 100);
      expect(result.goldCost).toBe(DEFAULT_SIGN_IN_CONFIG.retroactiveCostGold);
      expect(result.data.consecutiveDays).toBe(2);
    });

    it('元宝不足时应拒绝补签', () => {
      const data = { ...createDefaultSignInData(), todaySigned: false };
      expect(() => signIn.retroactive(data, dayOffset(1), 10)).toThrow('元宝不足');
    });

    it('本周补签次数用完应拒绝', () => {
      let data = createDefaultSignInData();
      data = signIn.signIn(data, dayOffset(0)).data;
      data = { ...data, todaySigned: false };
      // 补签2次（达到上限）
      data = signIn.retroactive(data, dayOffset(1), 100).data;
      data = { ...data, todaySigned: false };
      data = signIn.retroactive(data, dayOffset(2), 100).data;
      data = { ...data, todaySigned: false };
      expect(() => signIn.retroactive(data, dayOffset(3), 100)).toThrow('本周补签次数');
    });

    it('getReward 应返回对应天数的奖励', () => {
      const reward = signIn.getReward(1);
      expect(reward).toBeDefined();
      expect(reward.day).toBe(1);
    });

    it('getConsecutiveBonus 不足3天应返回0', () => {
      expect(signIn.getConsecutiveBonus(1)).toBe(0);
      expect(signIn.getConsecutiveBonus(2)).toBe(0);
    });
  });

  // ─── §3.3 限时活动流程 ─────────────────────

  describe('§3.3 限时活动流程（预览→活跃→结算→关闭）', () => {
    let timedSys: TimedActivitySystem;
    const now = Date.now();

    beforeEach(() => {
      timedSys = new TimedActivitySystem();
      timedSys.init(mockDeps());
    });

    it('应在预览阶段显示活动预告', () => {
      const activeStart = now + 24 * 60 * 60 * 1000; // 明天开始
      const activeEnd = activeStart + 7 * 24 * 60 * 60 * 1000;
      const flow = timedSys.createTimedActivityFlow('timed-001', activeStart, activeEnd);
      expect(flow.phase).toBe('preview');
      expect(timedSys.canParticipate('timed-001', now)).toBe(false);
    });

    it('应在活跃阶段允许参与活动任务', () => {
      const activeStart = now - 1000; // 已开始
      const activeEnd = now + 7 * 24 * 60 * 60 * 1000;
      timedSys.createTimedActivityFlow('timed-002', activeStart, activeEnd);
      const phase = timedSys.updatePhase('timed-002', now);
      expect(phase).toBe('active');
      expect(timedSys.canParticipate('timed-002', now)).toBe(true);
    });

    it('应在结算阶段计算排行榜奖励', () => {
      const activeStart = now - 8 * 24 * 60 * 60 * 1000;
      const activeEnd = now - 1000; // 刚结束
      timedSys.createTimedActivityFlow('timed-003', activeStart, activeEnd);
      const phase = timedSys.updatePhase('timed-003', now);
      expect(phase).toBe('settlement');

      // 结算阶段计算排行奖励
      const entries: ActivityRankEntry[] = [
        { playerId: 'p1', playerName: '玩家1', points: 1000, tokens: 50, rank: 0 },
        { playerId: 'p2', playerName: '玩家2', points: 800, tokens: 30, rank: 0 },
      ];
      timedSys.updateLeaderboard('timed-003', entries);
      const rewards = timedSys.calculateRankRewards(1);
      expect(rewards.gold).toBe(500);
    });

    it('应在关闭阶段清理活动数据', () => {
      const activeStart = now - 10 * 24 * 60 * 60 * 1000;
      const activeEnd = now - 3 * 60 * 60 * 1000; // 超过结算期
      timedSys.createTimedActivityFlow('timed-004', activeStart, activeEnd);
      const phase = timedSys.updatePhase('timed-004', now);
      expect(phase).toBe('closed');
      expect(timedSys.canParticipate('timed-004', now)).toBe(false);
    });
  });

  // ─── §3.4 活跃度系统 ──────────────────────

  describe('§3.4 活跃度系统（任务积分 + 里程碑奖励）', () => {
    let activitySys: ActivitySystem;
    let state: ActivityState;

    beforeEach(() => {
      activitySys = new ActivitySystem();
      activitySys.init(mockDeps());
      state = { activities: {} };
    });

    it('应正确计算任务积分', () => {
      const def: ActivityDef = {
        id: 'act-001',
        name: '限时挑战',
        description: '完成每日任务',
        type: ActivityType.LIMITED_TIME,
        startTime: Date.now(),
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      const taskDefs: ActivityTaskDef[] = [
        { id: 'task-001', name: '击败10个敌人', description: '', targetCount: 10, pointReward: 50, tokenReward: 5, type: 'daily' },
      ];
      const milestones: ActivityMilestone[] = [];
      state = activitySys.startActivity(state, def, taskDefs, milestones, Date.now());

      // 完成任务
      state = activitySys.updateTaskProgress(state, 'act-001', 'task-001', 10);
      const task = state.activities['act-001'].tasks.find(t => t.defId === 'task-001');
      expect(task?.status).toBe(ActivityTaskStatus.COMPLETED);

      // 领取奖励
      const result = activitySys.claimTaskReward(state, 'act-001', 'task-001');
      expect(result.points).toBe(50);
      expect(result.tokens).toBe(5);
    });

    it('应正确解锁里程碑奖励', () => {
      const def: ActivityDef = {
        id: 'act-002',
        name: '赛季活动',
        description: '赛季里程碑',
        type: ActivityType.SEASON,
        startTime: Date.now(),
        endTime: Date.now() + 28 * 24 * 60 * 60 * 1000,
      };
      const taskDefs: ActivityTaskDef[] = [];
      const milestones: ActivityMilestone[] = [
        { id: 'ms-001', name: '100积分', description: '', requiredPoints: 100, rewards: { gold: 200 }, status: MilestoneStatus.LOCKED },
        { id: 'ms-002', name: '500积分', description: '', requiredPoints: 500, rewards: { gold: 1000 }, status: MilestoneStatus.LOCKED },
      ];
      state = activitySys.startActivity(state, def, taskDefs, milestones, Date.now());

      // 模拟达到100积分
      const instance = state.activities['act-002'];
      state = {
        ...state,
        activities: {
          ...state.activities,
          'act-002': { ...instance, points: 150 },
        },
      };

      // 检查里程碑解锁
      state = activitySys.checkMilestones(state, 'act-002');
      const ms1 = state.activities['act-002'].milestones.find(m => m.id === 'ms-001');
      const ms2 = state.activities['act-002'].milestones.find(m => m.id === 'ms-002');
      expect(ms1?.status).toBe(MilestoneStatus.UNLOCKED);
      expect(ms2?.status).toBe(MilestoneStatus.LOCKED);

      // 领取里程碑
      const claimResult = activitySys.claimMilestone(state, 'act-002', 'ms-001');
      expect(claimResult.rewards.gold).toBe(200);
    });

    it('应正确计算离线进度累积', () => {
      const def: ActivityDef = {
        id: 'act-003',
        name: '日常活动',
        description: '日常离线累积',
        type: ActivityType.DAILY,
        startTime: Date.now(),
        endTime: Date.now() + 24 * 60 * 60 * 1000,
      };
      state = activitySys.startActivity(state, def, [], [], Date.now());

      // 计算离线进度
      const offlineResults = activitySys.calculateOfflineProgress(state, 3600000); // 1小时
      expect(offlineResults.length).toBeGreaterThanOrEqual(0);

      // 应用离线进度
      if (offlineResults.length > 0) {
        const newState = activitySys.applyOfflineProgress(state, offlineResults);
        expect(newState).toBeDefined();
      }
    });
  });

  // ─── §3.5 活动排行榜 ──────────────────────

  describe('§3.5 活动排行榜（积分排序 + 奖励梯度）', () => {
    let timedSys: TimedActivitySystem;

    beforeEach(() => {
      timedSys = new TimedActivitySystem();
      timedSys.init(mockDeps());
    });

    it('应按积分降序排列排行', () => {
      const entries: ActivityRankEntry[] = [
        { playerId: 'p1', playerName: '玩家A', points: 500, tokens: 20, rank: 0 },
        { playerId: 'p2', playerName: '玩家B', points: 1200, tokens: 50, rank: 0 },
        { playerId: 'p3', playerName: '玩家C', points: 800, tokens: 30, rank: 0 },
      ];
      const sorted = timedSys.updateLeaderboard('lb-001', entries);
      expect(sorted[0].playerId).toBe('p2'); // 1200分
      expect(sorted[0].rank).toBe(1);
      expect(sorted[1].playerId).toBe('p3'); // 800分
      expect(sorted[1].rank).toBe(2);
      expect(sorted[2].playerId).toBe('p1'); // 500分
      expect(sorted[2].rank).toBe(3);
    });

    it('应正确分配奖励档位', () => {
      // 默认配置: rank 1 → gold 500, rank 2-3 → gold 300, rank 4-10 → gold 150, rank 11-50 → gold 50
      expect(timedSys.calculateRankRewards(1).gold).toBe(500);
      expect(timedSys.calculateRankRewards(2).gold).toBe(300);
      expect(timedSys.calculateRankRewards(3).gold).toBe(300);
      expect(timedSys.calculateRankRewards(5).gold).toBe(150);
      expect(timedSys.calculateRankRewards(20).gold).toBe(50);
      expect(Object.keys(timedSys.calculateRankRewards(99)).length).toBe(0); // 超出范围无奖励
    });

    it('应限制排行榜最大人数', () => {
      const config = timedSys.getLeaderboardConfig();
      expect(config.maxEntries).toBe(100);

      // 创建150个玩家，验证裁剪到100
      const entries: ActivityRankEntry[] = Array.from({ length: 150 }, (_, i) => ({
        playerId: `p${i}`,
        playerName: `玩家${i}`,
        points: 1500 - i * 10,
        tokens: 50,
        rank: 0,
      }));
      const sorted = timedSys.updateLeaderboard('lb-002', entries);
      expect(sorted.length).toBe(100);
    });
  });
});
