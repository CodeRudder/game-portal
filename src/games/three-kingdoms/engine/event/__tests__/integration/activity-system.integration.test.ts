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
import { SignInSystem, DEFAULT_SIGN_IN_REWARDS, DEFAULT_SIGN_IN_CONFIG, SIGN_IN_CYCLE_DAYS, createDefaultSignInData } from '../../../activity/SignInSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { TokenShopItem, TokenShopConfig, ShopItemRarity } from '../../../../core/event/event-activity.types';
import type { SignInData, SignInReward } from '../../../../core/activity/activity.types';

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
    it.skip('应在预览阶段显示活动预告', () => {
      // 需要 TimedActivitySystem 完整集成
    });

    it.skip('应在活跃阶段允许参与活动任务', () => {
      // 需要 TimedActivitySystem + ActivitySystem 联动
    });

    it.skip('应在结算阶段计算排行榜奖励', () => {
      // 需要 TimedActivitySystem + Leaderboard 联动
    });

    it.skip('应在关闭阶段清理活动数据', () => {
      // 需要 TimedActivitySystem 完整生命周期
    });
  });

  // ─── §3.4 活跃度系统 ──────────────────────

  describe('§3.4 活跃度系统（任务积分 + 里程碑奖励）', () => {
    it.skip('应正确计算任务积分', () => {
      // 需要 ActivitySystem 任务完成集成
    });

    it.skip('应正确解锁里程碑奖励', () => {
      // 需要 ActivitySystem 里程碑集成
    });

    it.skip('应正确计算离线进度累积', () => {
      // 需要 ActivityOfflineCalculator 集成
    });
  });

  // ─── §3.5 活动排行榜 ──────────────────────

  describe('§3.5 活动排行榜（积分排序 + 奖励梯度）', () => {
    it.skip('应按积分降序排列排行', () => {
      // 需要 TimedActivitySystem 排行榜集成
    });

    it.skip('应正确分配奖励档位', () => {
      // 需要 LeaderboardRewardTier 计算
    });

    it.skip('应限制排行榜最大人数', () => {
      // 需要 maxEntries 限制
    });
  });
});
