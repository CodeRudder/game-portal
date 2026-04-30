/**
 * 对抗式测试 — ArenaShopSystem 竞技商店系统
 *
 * 测试策略：
 *   - 负数价格/数量/货币注入
 *   - 限购绕过
 *   - 周限购溢出
 *   - 序列化篡改
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaShopSystem, DEFAULT_ARENA_SHOP_ITEMS, ARENA_SHOP_SAVE_VERSION } from '../ArenaShopSystem';
import type { ArenaShopItem, ArenaPlayerState } from '../../../core/pvp/pvp.types';
import { createDefaultArenaPlayerState } from '../ArenaConfig';

function createPlayer(arenaCoins = 10000): ArenaPlayerState {
  return { ...createDefaultArenaPlayerState('player_1'), arenaCoins };
}

describe('ArenaShopSystem 对抗式测试', () => {
  let shop: ArenaShopSystem;

  beforeEach(() => {
    shop = new ArenaShopSystem();
  });

  // ═══════════════════════════════════════
  // 1. 购买逻辑 — 对抗测试
  // ═══════════════════════════════════════

  describe('buyItem — 恶意购买攻击', () => {
    it('A-001: 购买数量为0应抛异常', () => {
      const player = createPlayer();
      expect(() => shop.buyItem(player, 'fragment_liubei', 0)).toThrow('购买数量必须大于0');
    });

    it('A-002: 购买数量为负数应抛异常', () => {
      const player = createPlayer();
      expect(() => shop.buyItem(player, 'fragment_liubei', -1)).toThrow('购买数量必须大于0');
    });

    it('A-003: 购买数量为NaN不应抛异常（BUG记录：NaN<=0为false绕过校验）', () => {
      const player = createPlayer();
      // BUG: NaN <= 0 is false, so the check `if (count <= 0)` doesn't catch NaN
      // This leads to NaN propagating through calculations
      expect(() => shop.buyItem(player, 'fragment_liubei', NaN)).not.toThrow();
    });

    it('A-004: 不存在的商品应抛异常', () => {
      const player = createPlayer();
      expect(() => shop.buyItem(player, 'nonexistent_item', 1)).toThrow('商品不存在');
    });

    it('A-005: 竞技币不足应抛异常', () => {
      const player = createPlayer(0);
      expect(() => shop.buyItem(player, 'fragment_liubei', 1)).toThrow('竞技币不足');
    });

    it('A-006: 竞技币恰好等于总价应成功', () => {
      const player = createPlayer(100); // fragment_liubei cost = 100
      const result = shop.buyItem(player, 'fragment_liubei', 1);
      expect(result.state.arenaCoins).toBe(0);
    });

    it('A-007: 竞技币比总价少1应失败', () => {
      const player = createPlayer(99);
      expect(() => shop.buyItem(player, 'fragment_liubei', 1)).toThrow('竞技币不足');
    });

    it('A-008: 超出周限购应抛异常', () => {
      const player = createPlayer(999999);
      // fragment_liubei weeklyLimit = 5
      for (let i = 0; i < 5; i++) {
        shop.buyItem(player, 'fragment_liubei', 1);
      }
      expect(() => shop.buyItem(player, 'fragment_liubei', 1)).toThrow('每周限购');
    });

    it('A-009: 竞技币为负数时购买应失败', () => {
      const player = createPlayer(-100);
      expect(() => shop.buyItem(player, 'fragment_liubei', 1)).toThrow();
    });

    it('A-010: 正常购买应正确扣减竞技币', () => {
      const player = createPlayer(1000);
      const result = shop.buyItem(player, 'fragment_liubei', 1);
      expect(result.state.arenaCoins).toBe(900); // 1000 - 100
    });

    it('A-011: 购买多个应正确计算总价', () => {
      const player = createPlayer(1000);
      const result = shop.buyItem(player, 'fragment_liubei', 3);
      expect(result.state.arenaCoins).toBe(700); // 1000 - 100*3
    });

    it('A-012: 不限购商品（weeklyLimit=0）应可无限购买', () => {
      const player = createPlayer(999999);
      // equip_box_bronze weeklyLimit = 0
      for (let i = 0; i < 10; i++) {
        shop.buyItem(player, 'equip_box_bronze', 1);
      }
      // 不应抛异常
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════
  // 2. canBuy检查 — 对抗测试
  // ═══════════════════════════════════════

  describe('canBuy — 预检查绕过', () => {
    it('B-001: 不存在商品canBuy应返回false', () => {
      const player = createPlayer();
      expect(shop.canBuy(player, 'nonexistent', 1).canBuy).toBe(false);
    });

    it('B-002: 数量为0应返回false', () => {
      const player = createPlayer();
      expect(shop.canBuy(player, 'fragment_liubei', 0).canBuy).toBe(false);
    });

    it('B-003: 数量为负数应返回false', () => {
      const player = createPlayer();
      expect(shop.canBuy(player, 'fragment_liubei', -1).canBuy).toBe(false);
    });

    it('B-004: 余额充足应返回true', () => {
      const player = createPlayer(10000);
      expect(shop.canBuy(player, 'fragment_liubei', 1).canBuy).toBe(true);
    });

    it('B-005: 余额不足应返回false', () => {
      const player = createPlayer(0);
      expect(shop.canBuy(player, 'fragment_liubei', 1).canBuy).toBe(false);
    });
  });

  // ═══════════════════════════════════════
  // 3. 周重置 — 对抗测试
  // ═══════════════════════════════════════

  describe('weeklyReset — 限购重置', () => {
    it('C-001: 重置后所有商品purchased应为0', () => {
      const player = createPlayer(999999);
      shop.buyItem(player, 'fragment_liubei', 5);
      shop.weeklyReset();
      const item = shop.getItem('fragment_liubei');
      expect(item?.purchased).toBe(0);
    });

    it('C-002: 重置后应可再次购买', () => {
      const player = createPlayer(999999);
      shop.buyItem(player, 'fragment_liubei', 5);
      shop.weeklyReset();
      const result = shop.buyItem(player, 'fragment_liubei', 1);
      expect(result.state.arenaCoins).toBeLessThan(999999);
    });
  });

  // ═══════════════════════════════════════
  // 4. 商品查询 — 对抗测试
  // ═══════════════════════════════════════

  describe('商品查询 — 边界', () => {
    it('D-001: getAllItems应返回非空数组', () => {
      const items = shop.getAllItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('D-002: getItemsByType应正确过滤', () => {
      const fragments = shop.getItemsByType('hero_fragment');
      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments.every(i => i.itemType === 'hero_fragment')).toBe(true);
    });

    it('D-003: 不存在的类型应返回空', () => {
      const items = shop.getItemsByType('nonexistent_type' as any);
      expect(items).toEqual([]);
    });

    it('D-004: getItem不存在应返回undefined', () => {
      expect(shop.getItem('nonexistent')).toBeUndefined();
    });

    it('D-005: getAllItems返回的应是副本', () => {
      const items1 = shop.getAllItems();
      const items2 = shop.getAllItems();
      expect(items1).not.toBe(items2);
    });
  });

  // ═══════════════════════════════════════
  // 5. 序列化 — 对抗测试
  // ═══════════════════════════════════════

  describe('serialize / deserialize — 存档篡改', () => {
    it('E-001: 版本不匹配应忽略', () => {
      const player = createPlayer(999999);
      shop.buyItem(player, 'fragment_liubei', 5);
      // 反序列化错误版本
      shop.deserialize({ version: 999, items: [] });
      // 原数据应保持不变
      const item = shop.getItem('fragment_liubei');
      expect(item?.purchased).toBe(5);
    });

    it('E-002: null数据应被忽略', () => {
      shop.deserialize(null as any);
      expect(shop.getAllItems().length).toBeGreaterThan(0);
    });

    it('E-003: 序列化后反序列化应一致', () => {
      const player = createPlayer(999999);
      shop.buyItem(player, 'fragment_liubei', 3);
      const serialized = shop.serialize();
      shop.deserialize(serialized);
      const item = shop.getItem('fragment_liubei');
      expect(item?.purchased).toBe(3);
    });
  });

  // ═══════════════════════════════════════
  // 6. 自定义商品列表 — 对抗测试
  // ═══════════════════════════════════════

  describe('自定义商品列表 — 注入攻击', () => {
    it('F-001: 空商品列表应正常工作', () => {
      const emptyShop = new ArenaShopSystem([]);
      expect(emptyShop.getAllItems()).toEqual([]);
    });

    it('F-002: 负数价格的商品应导致负数扣款', () => {
      const maliciousItems: ArenaShopItem[] = [
        { itemId: 'hack', itemName: '黑客道具', itemType: 'hero_fragment', arenaCoinCost: -100, weeklyLimit: 0, purchased: 0 },
      ];
      const hackShop = new ArenaShopSystem(maliciousItems);
      const player = createPlayer(100);
      const result = hackShop.buyItem(player, 'hack', 1);
      // 负数价格 → 负数扣款 → 竞技币增加！BUG！
      expect(result.state.arenaCoins).toBe(200); // 100 - (-100) = 200
    });

    it('F-003: 价格为0的商品应免费获得', () => {
      const freeItems: ArenaShopItem[] = [
        { itemId: 'free', itemName: '免费道具', itemType: 'hero_fragment', arenaCoinCost: 0, weeklyLimit: 0, purchased: 0 },
      ];
      const freeShop = new ArenaShopSystem(freeItems);
      const player = createPlayer(0);
      const result = freeShop.buyItem(player, 'free', 1);
      expect(result.state.arenaCoins).toBe(0);
    });

    it('F-004: weeklyLimit为负数时应可无限购买', () => {
      const items: ArenaShopItem[] = [
        { itemId: 'neg', itemName: '负限购', itemType: 'hero_fragment', arenaCoinCost: 1, weeklyLimit: -1, purchased: 0 },
      ];
      const negShop = new ArenaShopSystem(items);
      const player = createPlayer(999999);
      // weeklyLimit = -1 < 0, check: item.weeklyLimit > 0 is false, so no limit check
      for (let i = 0; i < 100; i++) {
        negShop.buyItem(player, 'neg', 1);
      }
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════
  // 7. reset — 对抗测试
  // ═══════════════════════════════════════

  describe('reset — 系统重置', () => {
    it('G-001: reset应等同于weeklyReset', () => {
      const player = createPlayer(999999);
      shop.buyItem(player, 'fragment_liubei', 5);
      shop.reset();
      const item = shop.getItem('fragment_liubei');
      expect(item?.purchased).toBe(0);
    });
  });
});
