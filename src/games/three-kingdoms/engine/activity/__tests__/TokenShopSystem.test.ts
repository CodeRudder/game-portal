/**
 * TokenShopSystem 单元测试
 *
 * 覆盖：
 * 1. 商品查询（全部/可用/按稀有度/按活动ID）
 * 2. 购买操作（正常/限购/余额不足/不存在）
 * 3. 代币管理
 * 4. 商品管理（添加/移除/刷新/每日刷新）
 * 5. 序列化/反序列化
 */

import { TokenShopSystem } from '../TokenShopSystem';
import type { TokenShopItem } from '../../../core/event/event-activity.types';

describe('TokenShopSystem', () => {
  let shop: TokenShopSystem;

  const testItem: TokenShopItem = {
    id: 'item_test',
    name: '测试商品',
    rarity: 'rare',
    tokenPrice: 50,
    purchaseLimit: 2,
    purchased: 0,
    available: true,
    activityId: 'act_1',
    rewards: { resourceChanges: { gold: 500 } },
  };

  beforeEach(() => {
    shop = new TokenShopSystem(undefined, [testItem], 200);
  });

  // ─── ISubsystem ───────────────────────────

  describe('ISubsystem 接口', () => {
    it('name 应为 tokenShop', () => {
      expect(shop.name).toBe('tokenShop');
    });

    it('getState 应返回状态快照', () => {
      const state = shop.getState();
      expect(state.tokenBalance).toBe(200);
      expect(state.itemCount).toBeGreaterThan(0);
    });
  });

  // ─── 商品查询 ─────────────────────────────

  describe('商品查询', () => {
    it('getAllItems 应返回所有商品', () => {
      const items = shop.getAllItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('getAvailableItems 应返回上架且未售罄的商品', () => {
      const items = shop.getAvailableItems();
      expect(items.every(i => i.available)).toBe(true);
    });

    it('getItem 应返回指定商品', () => {
      const item = shop.getItem('item_test');
      expect(item).toBeDefined();
      expect(item!.name).toBe('测试商品');
    });

    it('getItem 不存在应返回 undefined', () => {
      expect(shop.getItem('nonexistent')).toBeUndefined();
    });

    it('getItemsByActivity 应返回匹配活动ID的商品', () => {
      const items = shop.getItemsByActivity('act_1');
      expect(items.length).toBeGreaterThan(0);
    });
  });

  // ─── 购买操作 ─────────────────────────────

  describe('购买操作', () => {
    it('正常购买应成功', () => {
      const result = shop.purchaseItem('item_test', 1);
      expect(result.success).toBe(true);
      expect(result.tokensSpent).toBe(50);
      expect(shop.getTokenBalance()).toBe(150);
    });

    it('不存在的商品应失败', () => {
      const result = shop.purchaseItem('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('已下架商品应失败', () => {
      shop.setItemAvailability('item_test', false);
      const result = shop.purchaseItem('item_test');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('下架');
    });

    it('限购检查应生效', () => {
      shop.purchaseItem('item_test', 1); // 第1次
      shop.purchaseItem('item_test', 1); // 第2次
      const result = shop.purchaseItem('item_test', 1); // 第3次，超限
      expect(result.success).toBe(false);
      expect(result.reason).toContain('限购');
    });

    it('余额不足应失败', () => {
      const poorShop = new TokenShopSystem(undefined, [testItem], 10);
      const result = poorShop.purchaseItem('item_test');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });
  });

  // ─── 代币管理 ─────────────────────────────

  describe('代币管理', () => {
    it('addTokens 应增加余额', () => {
      shop.addTokens(100);
      expect(shop.getTokenBalance()).toBe(300);
    });

    it('spendTokens 余额充足应成功', () => {
      const result = shop.spendTokens(50);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(150);
    });

    it('spendTokens 余额不足应失败', () => {
      const result = shop.spendTokens(999);
      expect(result.success).toBe(false);
    });
  });

  // ─── 商品管理 ─────────────────────────────

  describe('商品管理', () => {
    it('addItem 应添加商品', () => {
      const newItem: TokenShopItem = {
        id: 'item_new', name: '新商品', rarity: 'common',
        tokenPrice: 10, purchaseLimit: 0, purchased: 0,
        available: true, activityId: '', rewards: {},
      };
      shop.addItem(newItem);
      expect(shop.getItem('item_new')).toBeDefined();
    });

    it('removeItem 应移除商品', () => {
      expect(shop.removeItem('item_test')).toBe(true);
      expect(shop.getItem('item_test')).toBeUndefined();
    });

    it('refreshShop 应重置购买计数', () => {
      shop.purchaseItem('item_test', 1);
      const refreshed = shop.refreshShop();
      expect(refreshed).toBeGreaterThan(0);
      const item = shop.getItem('item_test');
      expect(item!.purchased).toBe(0);
    });

    it('dailyRefresh 应完全重置购买计数', () => {
      shop.purchaseItem('item_test', 1);
      const count = shop.dailyRefresh();
      expect(count).toBeGreaterThan(0);
      const item = shop.getItem('item_test');
      expect(item!.purchased).toBe(0);
    });

    it('setItemAvailability 应切换上下架', () => {
      expect(shop.setItemAvailability('item_test', false)).toBe(true);
      expect(shop.getItem('item_test')!.available).toBe(false);
    });
  });

  // ─── 序列化 ───────────────────────────────

  describe('序列化', () => {
    it('应正确序列化和反序列化', () => {
      shop.addTokens(100);
      shop.purchaseItem('item_test', 1);
      const data = shop.serialize();

      const shop2 = new TokenShopSystem();
      shop2.deserialize(data);
      expect(shop2.getTokenBalance()).toBe(data.tokenBalance);
      expect(shop2.getAllItems().length).toBe(data.items.length);
    });
  });

  // ─── 重置 ─────────────────────────────────

  describe('reset', () => {
    it('应恢复默认状态', () => {
      shop.addTokens(500);
      shop.reset();
      expect(shop.getTokenBalance()).toBe(0);
    });
  });
});
