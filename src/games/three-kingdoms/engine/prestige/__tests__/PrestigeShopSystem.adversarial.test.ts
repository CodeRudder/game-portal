/**
 * PrestigeShopSystem 对抗式测试
 *
 * 五维度挑战覆盖：
 *   F-Normal: 商品展示、购买、限购
 *   F-Boundary: 数量边界、等级边界、声望值边界
 *   F-Error: 无效商品、重复购买、余额不足
 *   F-Cross: 与PrestigeSystem的等级/声望值联动
 *   F-Lifecycle: 购买记录持久化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeShopSystem } from '../PrestigeShopSystem';
import type { ISystemDeps } from '../../../core/types';
import { PRESTIGE_SHOP_GOODS } from '../../../core/prestige';

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

function createShop(): PrestigeShopSystem {
  const shop = new PrestigeShopSystem();
  shop.init(mockDeps());
  return shop;
}

// ═══════════════════════════════════════════════════════════

describe('PrestigeShopSystem 对抗式测试', () => {
  let shop: PrestigeShopSystem;

  beforeEach(() => {
    shop = createShop();
  });

  // ═══════════════════════════════════════════
  // F-Normal: 主线流程
  // ═══════════════════════════════════════════

  describe('[F-Normal] 商品展示与购买', () => {
    it('初始状态：所有商品列表完整', () => {
      const goods = shop.getAllGoods();
      expect(goods.length).toBe(PRESTIGE_SHOP_GOODS.length);
    });

    it('初始状态：只有等级1商品解锁', () => {
      const goods = shop.getAllGoods();
      const unlocked = goods.filter(g => g.unlocked);
      expect(unlocked.length).toBeGreaterThanOrEqual(1);
      expect(unlocked.every(g => g.requiredLevel <= 1)).toBe(true);
    });

    it('正常购买流程', () => {
      shop.updatePrestigeInfo(200, 1); // 200声望值, 等级1
      const result = shop.buyGoods('psg-001', 1);
      expect(result.success).toBe(true);
      expect(result.cost).toBe(50);
    });

    it('购买后声望值扣除', () => {
      shop.updatePrestigeInfo(200, 1);
      shop.buyGoods('psg-001', 1);
      const state = shop.getState();
      expect(state.prestigePoints).toBe(150);
    });

    it('购买后购买计数增加', () => {
      shop.updatePrestigeInfo(200, 1);
      shop.buyGoods('psg-001', 1);
      const goods = shop.getAllGoods();
      const item = goods.find(g => g.id === 'psg-001');
      expect(item?.purchased).toBe(1);
    });

    it('奖励回调触发', () => {
      const cb = vi.fn();
      shop.setRewardCallback(cb);
      shop.updatePrestigeInfo(200, 1);
      shop.buyGoods('psg-001', 1);
      expect(cb).toHaveBeenCalledWith({ iron: 100 });
    });

    it('批量购买奖励按数量缩放', () => {
      const cb = vi.fn();
      shop.setRewardCallback(cb);
      shop.updatePrestigeInfo(200, 1);
      shop.buyGoods('psg-001', 2);
      expect(cb).toHaveBeenCalledWith({ iron: 200 });
    });
  });

  // ═══════════════════════════════════════════
  // F-Boundary: 边界条件
  // ═══════════════════════════════════════════

  describe('[F-Boundary] 边界条件', () => {
    it('声望值刚好等于商品价格', () => {
      shop.updatePrestigeInfo(50, 1); // psg-001 costPoints=50
      const result = shop.buyGoods('psg-001', 1);
      expect(result.success).toBe(true);
      expect(shop.getState().prestigePoints).toBe(0);
    });

    it('声望值刚好差1不够', () => {
      shop.updatePrestigeInfo(49, 1);
      const result = shop.buyGoods('psg-001', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('声望值不足');
    });

    it('限购商品达到上限后无法购买', () => {
      shop.updatePrestigeInfo(10000, 1);
      // psg-001 purchaseLimit=5
      for (let i = 0; i < 5; i++) {
        shop.buyGoods('psg-001', 1);
      }
      const result = shop.buyGoods('psg-001', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('购买上限');
    });

    it('限购数量-1表示无限购买', () => {
      // 查找 purchaseLimit=-1 的商品（如果有的话）
      const unlimited = PRESTIGE_SHOP_GOODS.find(g => g.purchaseLimit < 0);
      if (unlimited) {
        shop.updatePrestigeInfo(999999, unlimited.requiredLevel);
        for (let i = 0; i < 20; i++) {
          const result = shop.buyGoods(unlimited.id, 1);
          expect(result.success).toBe(true);
        }
      }
    });

    it('批量购买超过限购数量被拒绝', () => {
      shop.updatePrestigeInfo(10000, 1);
      // psg-001 purchaseLimit=5, 尝试一次买6个
      const result = shop.buyGoods('psg-001', 6);
      expect(result.success).toBe(false);
    });

    it('购买数量为0：FIX-505 已修复，拒绝', () => {
      shop.updatePrestigeInfo(200, 1);
      // FIX-505: quantity=0 被拦截
      const result = shop.buyGoods('psg-001', 0);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('购买数量无效');
    });

    it('canBuyGoods与buyGoods结果一致', () => {
      shop.updatePrestigeInfo(200, 1);
      const check = shop.canBuyGoods('psg-001');
      expect(check.canBuy).toBe(true);
      const buy = shop.buyGoods('psg-001', 1);
      expect(buy.success).toBe(true);
    });

    it('canBuyGoods对未解锁商品返回false', () => {
      shop.updatePrestigeInfo(99999, 1);
      // psg-002 requiresLevel=3
      const check = shop.canBuyGoods('psg-002');
      expect(check.canBuy).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 异常路径
  // ═══════════════════════════════════════════

  describe('[F-Error] 异常路径', () => {
    it('购买不存在的商品', () => {
      shop.updatePrestigeInfo(99999, 50);
      const result = shop.buyGoods('non-existent', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('商品不存在');
    });

    it('canBuyGoods对不存在商品返回false', () => {
      const check = shop.canBuyGoods('fake-id');
      expect(check.canBuy).toBe(false);
      expect(check.reason).toContain('商品不存在');
    });

    it('等级不足时购买被拒绝', () => {
      shop.updatePrestigeInfo(99999, 1);
      // psg-002 requiresLevel=3
      const result = shop.buyGoods('psg-002', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级');
    });

    it('声望值为0时购买被拒绝', () => {
      shop.updatePrestigeInfo(0, 1);
      const result = shop.buyGoods('psg-001', 1);
      expect(result.success).toBe(false);
    });

    it('负数声望值时购买被拒绝', () => {
      shop.updatePrestigeInfo(-100, 1);
      const result = shop.buyGoods('psg-001', 1);
      expect(result.success).toBe(false);
    });

    it('等级升级事件解锁新商品', () => {
      const deps = mockDeps();
      const shop2 = new PrestigeShopSystem();
      shop2.init(deps);

      // 初始等级1
      shop2.updatePrestigeInfo(99999, 1);
      let goods = shop2.getAllGoods();
      let locked = goods.find(g => g.id === 'psg-002');
      expect(locked?.unlocked).toBe(false);

      // 模拟升级到3级
      const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
      const levelHandler = onCalls.find((c: string[]) => c[0] === 'prestige:levelUp');
      if (levelHandler) {
        (levelHandler[1] as (p: { level: number }) => void)({ level: 3 });
        goods = shop2.getAllGoods();
        locked = goods.find(g => g.id === 'psg-002');
        expect(locked?.unlocked).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统交互
  // ═══════════════════════════════════════════

  describe('[F-Cross] 跨系统交互', () => {
    it('购买事件正确发射', () => {
      const deps = mockDeps();
      const shop2 = new PrestigeShopSystem();
      shop2.init(deps);
      shop2.updatePrestigeInfo(200, 1);
      shop2.buyGoods('psg-001', 1);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('prestigeShop:purchased', expect.objectContaining({
        goodsId: 'psg-001',
        quantity: 1,
        cost: 50,
      }));
    });

    it('updatePrestigeInfo同步等级和声望值', () => {
      shop.updatePrestigeInfo(500, 10);
      const state = shop.getState();
      expect(state.prestigePoints).toBe(500);
      expect(state.prestigeLevel).toBe(10);
    });

    it('购买记录加载', () => {
      shop.updatePrestigeInfo(10000, 1);
      shop.buyGoods('psg-001', 3);
      const history = shop.getPurchaseHistory();
      expect(history['psg-001']).toBe(3);

      // 加载到新实例
      const shop2 = createShop();
      shop2.loadPurchases(history);
      const goods = shop2.getAllGoods();
      const item = goods.find(g => g.id === 'psg-001');
      expect(item?.purchased).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // F-Lifecycle: 数据生命周期
  // ═══════════════════════════════════════════

  describe('[F-Lifecycle] 生命周期', () => {
    it('reset恢复初始状态', () => {
      shop.updatePrestigeInfo(10000, 50);
      shop.buyGoods('psg-001', 3);
      shop.reset();
      const state = shop.getState();
      expect(state.prestigePoints).toBe(0);
      expect(state.prestigeLevel).toBe(1);
      const goods = shop.getAllGoods();
      expect(goods.find(g => g.id === 'psg-001')?.purchased).toBe(0);
    });

    it('所有商品遍历无遗漏', () => {
      const allGoods = shop.getAllGoods();
      for (const g of allGoods) {
        expect(g.id).toBeTruthy();
        expect(g.name).toBeTruthy();
        expect(g.costPoints).toBeGreaterThan(0);
        expect(g.requiredLevel).toBeGreaterThanOrEqual(1);
      }
    });

    it('getUnlockedGoods只返回已解锁商品', () => {
      shop.updatePrestigeInfo(99999, 5);
      const unlocked = shop.getUnlockedGoods();
      expect(unlocked.length).toBeGreaterThan(0);
      expect(unlocked.every(g => g.unlocked)).toBe(true);
      expect(unlocked.every(g => g.requiredLevel <= 5)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗式：声望值消耗竞态
  // ═══════════════════════════════════════════

  describe('[对抗] 声望值消耗竞态', () => {
    it('连续购买直到声望值耗尽', () => {
      shop.updatePrestigeInfo(200, 1);
      // psg-001 cost=50, limit=5
      expect(shop.buyGoods('psg-001', 1).success).toBe(true); // 150
      expect(shop.buyGoods('psg-001', 1).success).toBe(true); // 100
      expect(shop.buyGoods('psg-001', 1).success).toBe(true); // 50
      expect(shop.buyGoods('psg-001', 1).success).toBe(true); // 0
      expect(shop.buyGoods('psg-001', 1).success).toBe(false); // 不足
    });

    it('声望值变为负数后所有购买失败', () => {
      shop.updatePrestigeInfo(-10, 1);
      expect(shop.buyGoods('psg-001', 1).success).toBe(false);
    });

    it('购买记录不影响商品定义', () => {
      shop.updatePrestigeInfo(10000, 1);
      shop.buyGoods('psg-001', 5);
      const goods = shop.getAllGoods();
      const item = goods.find(g => g.id === 'psg-001');
      // 购买数=5，达到上限
      expect(item?.purchased).toBe(5);
      // 但costPoints不变
      expect(item?.costPoints).toBe(50);
    });
  });
});
