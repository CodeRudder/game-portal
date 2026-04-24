/**
 * 集成测试 — 限时活动 + 代币商店
 *
 * 覆盖 §3.1~3.6：
 *   §3.1 限时活动4阶段生命周期（preview→active→settlement→closed）
 *   §3.2 活动参与与剩余时间
 *   §3.3 代币兑换七阶稀有度
 *   §3.4 排行榜奖励梯度
 *   §3.5 节日活动模板
 *   §3.6 离线进度计算
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TimedActivitySystem } from '../../../activity/TimedActivitySystem';
import { TokenShopSystem } from '../../../activity/TokenShopSystem';
import type { ISystemDeps } from '../../../../core/types';

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

/** 时间基准：2025-01-01 00:00:00 UTC */
const T0 = 1735689600000;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════

describe('§3 限时活动+代币商店 集成', () => {
  let activity: TimedActivitySystem;
  let shop: TokenShopSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    activity = new TimedActivitySystem();
    activity.init(deps);
    shop = new TokenShopSystem(undefined, undefined, 1000);
    shop.init(deps);
  });

  // ═══════════════════════════════════════════
  // §3.1 限时活动4阶段生命周期
  // ═══════════════════════════════════════════
  describe('§3.1 限时活动4阶段生命周期', () => {
    it('创建活动后初始阶段为 preview', () => {
      const flow = activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      expect(flow.phase).toBe('preview');
      expect(flow.activeStart).toBe(T0 + DAY);
    });

    it('updatePhase 在 activeStart 前为 preview', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      const phase = activity.updatePhase('act-1', T0);
      expect(phase).toBe('preview');
    });

    it('updatePhase 在 activeStart 后为 active', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      const phase = activity.updatePhase('act-1', T0 + 2 * DAY);
      expect(phase).toBe('active');
    });

    it('updatePhase 在 activeEnd 后为 settlement', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      const phase = activity.updatePhase('act-1', T0 + 7 * DAY + HOUR);
      expect(phase).toBe('settlement');
    });

    it('updatePhase 在 closedTime 后为 closed', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      const phase = activity.updatePhase('act-1', T0 + 7 * DAY + 3 * HOUR);
      expect(phase).toBe('closed');
    });

    it('不存在的活动 updatePhase 返回 closed', () => {
      expect(activity.updatePhase('ghost', T0)).toBe('closed');
    });

    it('getFlow 返回活动流程数据', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      const flow = activity.getFlow('act-1');
      expect(flow).toBeDefined();
      expect(flow!.activityId).toBe('act-1');
    });
  });

  // ═══════════════════════════════════════════
  // §3.2 活动参与与剩余时间
  // ═══════════════════════════════════════════
  describe('§3.2 活动参与与剩余时间', () => {
    it('canParticipate 在 active 阶段返回 true', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      expect(activity.canParticipate('act-1', T0 + 2 * DAY)).toBe(true);
    });

    it('canParticipate 在 preview 阶段返回 false', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      expect(activity.canParticipate('act-1', T0)).toBe(false);
    });

    it('canParticipate 在 closed 阶段返回 false', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      expect(activity.canParticipate('act-1', T0 + 8 * DAY)).toBe(false);
    });

    it('getRemainingTime 返回剩余毫秒数', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      const remaining = activity.getRemainingTime('act-1', T0 + 3 * DAY);
      expect(remaining).toBe(4 * DAY);
    });

    it('getRemainingTime 已结束返回 0', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      expect(activity.getRemainingTime('act-1', T0 + 8 * DAY)).toBe(0);
    });

    it('getRemainingTime 不存在的活动返回 0', () => {
      expect(activity.getRemainingTime('ghost', T0)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // §3.3 代币兑换七阶稀有度
  // ═══════════════════════════════════════════
  describe('§3.3 代币兑换七阶稀有度', () => {
    it('默认商店包含七阶商品', () => {
      const items = shop.getAllItems();
      expect(items.length).toBeGreaterThanOrEqual(7);
    });

    it('按稀有度查询商品', () => {
      const common = shop.getItemsByRarity('common');
      const supreme = shop.getItemsByRarity('supreme');
      expect(common.length).toBeGreaterThanOrEqual(1);
      expect(supreme.length).toBeGreaterThanOrEqual(1);
    });

    it('购买 common 商品成功扣减代币', () => {
      const result = shop.purchaseItem('shop-copper', 1);
      expect(result.success).toBe(true);
      expect(result.tokensSpent).toBe(10);
      expect(shop.getTokenBalance()).toBe(990);
    });

    it('购买 supreme 商品成功', () => {
      shop.addTokens(900); // 总额 1900
      const result = shop.purchaseItem('shop-supreme-title', 1);
      expect(result.success).toBe(true);
      expect(result.tokensSpent).toBe(1000);
    });

    it('代币不足时购买失败', () => {
      const poorShop = new TokenShopSystem(undefined, undefined, 5);
      poorShop.init(deps);
      const result = poorShop.purchaseItem('shop-copper', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('代币不足');
    });

    it('限购商品达到上限后不可购买', () => {
      // shop-hero-frag: purchaseLimit=2
      shop.addTokens(900); // 确保足够
      shop.purchaseItem('shop-hero-frag', 2);
      const result = shop.purchaseItem('shop-hero-frag', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('限购');
    });

    it('批量购买正确计算总价', () => {
      const result = shop.purchaseItem('shop-copper', 5);
      expect(result.success).toBe(true);
      expect(result.tokensSpent).toBe(50);
    });

    it('getAvailableItems 排除已售罄商品', () => {
      shop.addTokens(900);
      // shop-legendary-weapon: purchaseLimit=1
      shop.purchaseItem('shop-legendary-weapon', 1);
      const available = shop.getAvailableItems();
      const legend = available.find(i => i.id === 'shop-legendary-weapon');
      expect(legend).toBeUndefined();
    });

    it('refreshShop 重置购买计数', () => {
      shop.purchaseItem('shop-copper', 3);
      const count = shop.refreshShop();
      expect(count).toBeGreaterThan(0);
      const item = shop.getItem('shop-copper');
      expect(item!.purchased).toBe(0);
    });

    it('dailyRefresh 重置限购并可更新商品列表', () => {
      shop.purchaseItem('shop-copper', 1);
      const count = shop.dailyRefresh();
      expect(count).toBeGreaterThan(0);
      expect(shop.getItem('shop-copper')!.purchased).toBe(0);
    });

    it('代币增减操作正确', () => {
      shop.addTokens(500);
      expect(shop.getTokenBalance()).toBe(1500);
      const result = shop.spendTokens(200);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1300);
    });

    it('spendTokens 余额不足返回失败', () => {
      const result = shop.spendTokens(2000);
      expect(result.success).toBe(false);
    });

    it('商品上架/下架', () => {
      shop.setItemAvailability('shop-copper', false);
      const available = shop.getAvailableItems();
      expect(available.find(i => i.id === 'shop-copper')).toBeUndefined();
    });

    it('自定义商品添加和移除', () => {
      shop.addItem({
        id: 'custom-1', name: '自定义', description: '测试',
        rarity: 'rare', tokenPrice: 30, purchaseLimit: 0, purchased: 0,
        rewards: { custom: 1 }, activityId: 'act-1', available: true,
      });
      expect(shop.getItem('custom-1')).toBeDefined();
      expect(shop.removeItem('custom-1')).toBe(true);
      expect(shop.getItem('custom-1')).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // §3.4 排行榜奖励梯度
  // ═══════════════════════════════════════════
  describe('§3.4 排行榜奖励梯度', () => {
    it('updateLeaderboard 按积分降序排列', () => {
      const entries = [
        { playerId: 'p1', playerName: 'A', points: 100, tokens: 0, rank: 0 },
        { playerId: 'p2', playerName: 'B', points: 300, tokens: 0, rank: 0 },
        { playerId: 'p3', playerName: 'C', points: 200, tokens: 0, rank: 0 },
      ];
      const result = activity.updateLeaderboard('act-1', entries as any);
      expect(result[0].rank).toBe(1);
      expect(result[0].playerId).toBe('p2');
      expect(result[1].playerId).toBe('p3');
      expect(result[2].playerId).toBe('p1');
    });

    it('getPlayerRank 返回玩家排名', () => {
      const entries = [
        { playerId: 'p1', playerName: 'A', points: 100, tokens: 0, rank: 0 },
        { playerId: 'p2', playerName: 'B', points: 200, tokens: 0, rank: 0 },
      ];
      activity.updateLeaderboard('act-1', entries as any);
      expect(activity.getPlayerRank('act-1', 'p2')).toBe(1);
      expect(activity.getPlayerRank('act-1', 'p1')).toBe(2);
    });

    it('getPlayerRank 不存在的玩家返回 0', () => {
      expect(activity.getPlayerRank('act-1', 'ghost')).toBe(0);
    });

    it('calculateRankRewards 第1名获500金', () => {
      const rewards = activity.calculateRankRewards(1);
      expect(rewards.gold).toBe(500);
    });

    it('calculateRankRewards 第2-3名获300金', () => {
      const rewards = activity.calculateRankRewards(2);
      expect(rewards.gold).toBe(300);
    });

    it('calculateRankRewards 第4-10名获150金', () => {
      const rewards = activity.calculateRankRewards(7);
      expect(rewards.gold).toBe(150);
    });

    it('calculateRankRewards 第11-50名获50金', () => {
      const rewards = activity.calculateRankRewards(30);
      expect(rewards.gold).toBe(50);
    });

    it('calculateRankRewards 第51名无奖励', () => {
      const rewards = activity.calculateRankRewards(51);
      expect(Object.keys(rewards)).toHaveLength(0);
    });

    it('排行榜裁剪到 maxEntries', () => {
      const many = Array.from({ length: 200 }, (_, i) => ({
        playerId: `p${i}`, playerName: `P${i}`, points: i, tokens: 0, rank: 0,
      }));
      const result = activity.updateLeaderboard('act-1', many as any);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  // ═══════════════════════════════════════════
  // §3.5 节日活动模板
  // ═══════════════════════════════════════════
  describe('§3.5 节日活动模板', () => {
    it('getAllFestivalTemplates 返回5个节日模板', () => {
      const templates = activity.getAllFestivalTemplates();
      expect(templates.length).toBe(5);
    });

    it('getFestivalTemplate 按类型获取春节模板', () => {
      const spring = activity.getFestivalTemplate('spring');
      expect(spring).toBeDefined();
      expect(spring!.name).toBe('春节庆典');
      expect(spring!.themeColor).toBe('#FF0000');
    });

    it('getFestivalTemplate 获取中秋模板', () => {
      const mid = activity.getFestivalTemplate('mid_autumn');
      expect(mid).toBeDefined();
      expect(mid!.name).toBe('中秋赏月');
    });

    it('getFestivalTemplate 不存在的类型返回 undefined', () => {
      expect(activity.getFestivalTemplate('non_existent' as any)).toBeUndefined();
    });

    it('createFestivalActivity 创建完整活动流程', () => {
      const result = activity.createFestivalActivity('spring', T0, 7);
      expect(result).not.toBeNull();
      expect(result!.template.festivalType).toBe('spring');
      expect(result!.flow.activityId).toBe('festival-spring');
      expect(result!.flow.phase).toBe('preview');
    });

    it('createFestivalActivity 默认持续7天', () => {
      const result = activity.createFestivalActivity('lantern', T0);
      expect(result).not.toBeNull();
      const duration = result!.flow.activeEnd - result!.flow.activeStart;
      expect(duration).toBe(7 * DAY);
    });

    it('节日模板包含专属任务', () => {
      const templates = activity.getAllFestivalTemplates();
      for (const t of templates) {
        expect(t.exclusiveTasks.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ═══════════════════════════════════════════
  // §3.6 离线进度计算
  // ═══════════════════════════════════════════
  describe('§3.6 离线进度计算', () => {
    it('calculateOfflineProgress 返回积分和代币', () => {
      const result = activity.calculateOfflineProgress('act-1', 'season', DAY);
      expect(result.activityId).toBe('act-1');
      expect(result.pointsEarned).toBeGreaterThan(0);
      expect(result.tokensEarned).toBeGreaterThan(0);
      expect(result.offlineDuration).toBe(DAY);
    });

    it('不同活动类型使用不同效率', () => {
      const season = activity.calculateOfflineProgress('a', 'season', DAY);
      const daily = activity.calculateOfflineProgress('b', 'daily', DAY);
      // daily 效率=1.0, season=0.5
      expect(daily.pointsEarned).toBeGreaterThan(season.pointsEarned);
    });

    it('离线时长为0时无收益', () => {
      const result = activity.calculateOfflineProgress('a', 'season', 0);
      expect(result.pointsEarned).toBe(0);
      expect(result.tokensEarned).toBe(0);
    });

    it('calculateAllOfflineProgress 批量计算', () => {
      const activities = [
        { id: 'a1', type: 'season' },
        { id: 'a2', type: 'festival' },
      ];
      const summary = activity.calculateAllOfflineProgress(activities, DAY);
      expect(summary.activityResults).toHaveLength(2);
      expect(summary.totalPoints).toBeGreaterThan(0);
      expect(summary.totalTokens).toBeGreaterThan(0);
      expect(summary.offlineDurationMs).toBe(DAY);
    });

    it('序列化/反序列化保留活动流程和排行榜', () => {
      activity.createTimedActivityFlow('act-1', T0 + DAY, T0 + 7 * DAY);
      activity.updateLeaderboard('act-1', [
        { playerId: 'p1', playerName: 'A', points: 100, tokens: 0, rank: 0 },
      ] as any);

      const data = activity.serialize();
      const newActivity = new TimedActivitySystem();
      newActivity.init(deps);
      newActivity.deserialize(data);

      expect(newActivity.getFlow('act-1')).toBeDefined();
      expect(newActivity.getLeaderboard('act-1')).toHaveLength(1);
    });

    it('商店序列化/反序列化保留余额和购买记录', () => {
      shop.purchaseItem('shop-copper', 2);
      const data = shop.serialize();

      const newShop = new TokenShopSystem();
      newShop.init(deps);
      newShop.deserialize(data);

      expect(newShop.getTokenBalance()).toBe(980);
      expect(newShop.getItem('shop-copper')!.purchased).toBe(2);
    });
  });
});
