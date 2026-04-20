/**
 * PrestigeShopSystem 单元测试
 *
 * 覆盖声望商店系统所有功能：
 * - #6 声望商店 — 等级解锁商品、声望值消耗
 * - 商品展示、购买、限购
 * - 购买记录
 */

import { PrestigeShopSystem } from '../PrestigeShopSystem';
import type { ISystemDeps } from '../../../core/types';
import { PRESTIGE_SHOP_GOODS } from '../../../core/prestige';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(opts?: { points?: number; level?: number }): PrestigeShopSystem {
  const sys = new PrestigeShopSystem();
  sys.init(mockDeps());
  if (opts) {
    sys.updatePrestigeInfo(opts.points ?? 0, opts.level ?? 1);
  }
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('PrestigeShopSystem', () => {
  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════

  describe('ISubsystem', () => {
    test('name 为 prestigeShop', () => {
      const sys = createSystem();
      expect(sys.name).toBe('prestigeShop');
    });

    test('初始状态正确', () => {
      const sys = createSystem();
      const state = sys.getState();
      expect(state.prestigePoints).toBe(0);
      expect(state.prestigeLevel).toBe(1);
      expect(state.items.length).toBe(PRESTIGE_SHOP_GOODS.length);
    });

    test('reset 恢复初始状态', () => {
      const sys = createSystem({ points: 5000, level: 10 });
      sys.buyGoods('psg-001');
      sys.reset();
      const state = sys.getState();
      expect(state.prestigePoints).toBe(0);
      expect(state.prestigeLevel).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 商品展示
  // ═══════════════════════════════════════════

  describe('商品展示', () => {
    test('所有商品数量正确', () => {
      const sys = createSystem();
      const goods = sys.getAllGoods();
      expect(goods).toHaveLength(PRESTIGE_SHOP_GOODS.length);
    });

    test('初始等级1只解锁等级1商品', () => {
      const sys = createSystem({ points: 99999, level: 1 });
      const goods = sys.getAllGoods();
      const unlocked = goods.filter((g) => g.unlocked);
      expect(unlocked.length).toBeGreaterThanOrEqual(1);
      // psg-001 requiredLevel=1 应该解锁
      const psg001 = goods.find((g) => g.id === 'psg-001');
      expect(psg001?.unlocked).toBe(true);
    });

    test('getUnlockedGoods 只返回已解锁商品', () => {
      const sys = createSystem({ points: 99999, level: 1 });
      const unlocked = sys.getUnlockedGoods();
      for (const g of unlocked) {
        expect(g.unlocked).toBe(true);
      }
    });

    test('高等级解锁更多商品', () => {
      const sys1 = createSystem({ points: 99999, level: 1 });
      const sys2 = createSystem({ points: 99999, level: 10 });
      expect(sys2.getUnlockedGoods().length).toBeGreaterThan(sys1.getUnlockedGoods().length);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 购买商品 (#6)
  // ═══════════════════════════════════════════

  describe('购买商品', () => {
    test('正常购买成功', () => {
      const sys = createSystem({ points: 500, level: 5 });
      const result = sys.buyGoods('psg-001');
      expect(result.success).toBe(true);
      expect(result.cost).toBe(50); // psg-001 costPoints=50
    });

    test('购买扣除声望值', () => {
      const sys = createSystem({ points: 500, level: 5 });
      sys.buyGoods('psg-001');
      expect(sys.getState().prestigePoints).toBe(500 - 50);
    });

    test('声望值不足购买失败', () => {
      const sys = createSystem({ points: 10, level: 5 });
      const result = sys.buyGoods('psg-001');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('声望值不足');
    });

    test('等级不足购买失败', () => {
      const sys = createSystem({ points: 9999, level: 1 });
      const result = sys.buyGoods('psg-003'); // requiredLevel=5
      expect(result.success).toBe(false);
      expect(result.reason).toContain('声望等级');
    });

    test('商品不存在', () => {
      const sys = createSystem({ points: 9999, level: 50 });
      const result = sys.buyGoods('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('商品不存在');
    });

    test('限购达到上限', () => {
      const sys = createSystem({ points: 99999, level: 5 });
      // psg-001 purchaseLimit=5
      for (let i = 0; i < 5; i++) {
        const r = sys.buyGoods('psg-001');
        expect(r.success).toBe(true);
      }
      const result = sys.buyGoods('psg-001');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('购买上限');
    });

    test('批量购买', () => {
      const sys = createSystem({ points: 99999, level: 5 });
      const result = sys.buyGoods('psg-001', 3);
      expect(result.success).toBe(true);
      expect(result.cost).toBe(50 * 3);
    });

    test('批量购买超过限购', () => {
      const sys = createSystem({ points: 99999, level: 5 });
      // psg-001 purchaseLimit=5
      const result = sys.buyGoods('psg-001', 6);
      expect(result.success).toBe(false);
    });

    test('购买触发奖励回调', () => {
      const sys = createSystem({ points: 500, level: 5 });
      const rewardCb = jest.fn();
      sys.setRewardCallback(rewardCb);
      sys.buyGoods('psg-001');
      expect(rewardCb).toHaveBeenCalledTimes(1);
      // 奖励应包含 iron: 100
      expect(rewardCb).toHaveBeenCalledWith(expect.objectContaining({ iron: 100 }));
    });

    test('购买发射 purchased 事件', () => {
      const deps = mockDeps();
      const emitSpy = jest.spyOn(deps.eventBus, 'emit');
      const sys = new PrestigeShopSystem();
      sys.init(deps);
      sys.updatePrestigeInfo(500, 5);

      sys.buyGoods('psg-001');
      expect(emitSpy).toHaveBeenCalledWith('prestigeShop:purchased', expect.objectContaining({
        goodsId: 'psg-001',
        quantity: 1,
      }));
    });
  });

  // ═══════════════════════════════════════════
  // 4. canBuyGoods 检查
  // ═══════════════════════════════════════════

  describe('canBuyGoods', () => {
    test('可购买时返回 canBuy: true', () => {
      const sys = createSystem({ points: 500, level: 5 });
      const check = sys.canBuyGoods('psg-001');
      expect(check.canBuy).toBe(true);
    });

    test('等级不足返回原因', () => {
      const sys = createSystem({ points: 9999, level: 1 });
      const check = sys.canBuyGoods('psg-005'); // requiredLevel=10
      expect(check.canBuy).toBe(false);
      expect(check.reason).toContain('声望等级');
    });

    test('声望值不足返回原因', () => {
      const sys = createSystem({ points: 10, level: 5 });
      const check = sys.canBuyGoods('psg-001');
      expect(check.canBuy).toBe(false);
      expect(check.reason).toContain('声望值不足');
    });

    test('限购已满返回原因', () => {
      const sys = createSystem({ points: 99999, level: 5 });
      for (let i = 0; i < 5; i++) {
        sys.buyGoods('psg-001');
      }
      const check = sys.canBuyGoods('psg-001');
      expect(check.canBuy).toBe(false);
      expect(check.reason).toContain('购买上限');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 购买记录
  // ═══════════════════════════════════════════

  describe('购买记录', () => {
    test('初始无购买记录', () => {
      const sys = createSystem();
      const history = sys.getPurchaseHistory();
      expect(Object.keys(history)).toHaveLength(0);
    });

    test('购买后记录更新', () => {
      const sys = createSystem({ points: 99999, level: 5 });
      sys.buyGoods('psg-001', 2);
      const history = sys.getPurchaseHistory();
      expect(history['psg-001']).toBe(2);
    });

    test('loadPurchases 恢复记录', () => {
      const sys = createSystem();
      sys.loadPurchases({ 'psg-001': 3, 'psg-002': 1 });
      const history = sys.getPurchaseHistory();
      expect(history['psg-001']).toBe(3);
      expect(history['psg-002']).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 6. updatePrestigeInfo
  // ═══════════════════════════════════════════

  describe('updatePrestigeInfo', () => {
    test('更新声望值和等级', () => {
      const sys = createSystem();
      sys.updatePrestigeInfo(1000, 10);
      const state = sys.getState();
      expect(state.prestigePoints).toBe(1000);
      expect(state.prestigeLevel).toBe(10);
    });

    test('等级提升解锁更多商品', () => {
      const sys = createSystem();
      const before = sys.getUnlockedGoods().length;
      sys.updatePrestigeInfo(0, 20);
      const after = sys.getUnlockedGoods().length;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ═══════════════════════════════════════════
  // 7. canBuy 字段综合
  // ═══════════════════════════════════════════

  describe('商品 canBuy 字段', () => {
    test('canBuy 综合考虑等级、声望值、限购', () => {
      const sys = createSystem({ points: 99999, level: 50 });
      const goods = sys.getAllGoods();
      // 所有商品应解锁
      expect(goods.every((g) => g.unlocked)).toBe(true);
      // 所有商品应可购买（首次）
      expect(goods.every((g) => g.canBuy)).toBe(true);
    });

    test('canBuy 在声望值不足时为 false', () => {
      const sys = createSystem({ points: 0, level: 50 });
      const goods = sys.getAllGoods();
      expect(goods.every((g) => g.canBuy)).toBe(false);
    });
  });
});
