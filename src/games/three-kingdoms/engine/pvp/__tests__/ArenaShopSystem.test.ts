/**
 * ArenaShopSystem 单元测试
 *
 * 覆盖：
 *   - 商品查询（全部/按类型/单个）
 *   - 购买逻辑（竞技币扣除/限购检查）
 *   - 购买前置检查
 *   - 每周重置
 *   - 存档序列化/反序列化
 */

import {
  ArenaShopSystem,
  DEFAULT_ARENA_SHOP_ITEMS,
  ARENA_SHOP_SAVE_VERSION,
} from '../ArenaShopSystem';
import type { ArenaPlayerState } from '../../../core/pvp/pvp.types';
import { createDefaultArenaPlayerState } from '../ArenaSystem';

// ── 辅助函数 ──────────────────────────────

function createPlayerWithCoins(coins: number): ArenaPlayerState {
  const state = createDefaultArenaPlayerState();
  return { ...state, arenaCoins: coins };
}

let shop: ArenaShopSystem;

beforeEach(() => {
  shop = new ArenaShopSystem();
});

// ── 商品查询 ──────────────────────────────

describe('ArenaShopSystem — 商品查询', () => {
  test('默认商品列表非空', () => {
    const items = shop.getAllItems();
    expect(items.length).toBeGreaterThan(0);
  });

  test('默认商品列表与常量一致', () => {
    expect(DEFAULT_ARENA_SHOP_ITEMS.length).toBe(14);
  });

  test('按类型查询 — 武将碎片', () => {
    const fragments = shop.getItemsByType('hero_fragment');
    expect(fragments.length).toBeGreaterThan(0);
    expect(fragments.every((i) => i.itemType === 'hero_fragment')).toBe(true);
  });

  test('按类型查询 — 强化石', () => {
    const stones = shop.getItemsByType('enhance_stone');
    expect(stones.length).toBeGreaterThan(0);
  });

  test('按类型查询 — 装备箱', () => {
    const boxes = shop.getItemsByType('equipment_box');
    expect(boxes.length).toBeGreaterThan(0);
  });

  test('按类型查询 — 头像框', () => {
    const frames = shop.getItemsByType('avatar_frame');
    expect(frames.length).toBeGreaterThan(0);
  });

  test('获取单个商品', () => {
    const item = shop.getItem('fragment_liubei');
    expect(item).toBeDefined();
    expect(item!.itemName).toBe('刘备碎片');
    expect(item!.arenaCoinCost).toBe(100);
  });

  test('不存在的商品返回undefined', () => {
    expect(shop.getItem('nonexistent')).toBeUndefined();
  });

  test('返回的是副本不是引用', () => {
    const items1 = shop.getAllItems();
    const items2 = shop.getAllItems();
    items1[0].purchased = 999;
    expect(items2[0].purchased).toBe(0);
  });
});

// ── 购买逻辑 ──────────────────────────────

describe('ArenaShopSystem — 购买逻辑', () => {
  test('正常购买扣除竞技币', () => {
    const player = createPlayerWithCoins(500);
    const result = shop.buyItem(player, 'fragment_liubei', 1);

    expect(result.state.arenaCoins).toBe(400); // 500 - 100
    expect(result.item.purchased).toBe(1);
  });

  test('购买多个物品', () => {
    const player = createPlayerWithCoins(1000);
    const result = shop.buyItem(player, 'enhance_stone_small', 3);

    expect(result.state.arenaCoins).toBe(850); // 1000 - 50*3
    expect(result.item.purchased).toBe(3);
  });

  test('竞技币不足时抛出异常', () => {
    const player = createPlayerWithCoins(50);
    expect(() => shop.buyItem(player, 'fragment_liubei')).toThrow('竞技币不足');
  });

  test('商品不存在时抛出异常', () => {
    const player = createPlayerWithCoins(10000);
    expect(() => shop.buyItem(player, 'nonexistent')).toThrow('商品不存在');
  });

  test('购买数量为0时抛出异常', () => {
    const player = createPlayerWithCoins(10000);
    expect(() => shop.buyItem(player, 'fragment_liubei', 0)).toThrow('购买数量必须大于0');
  });

  test('超出周限购数量时抛出异常', () => {
    const player = createPlayerWithCoins(10000);
    // fragment_zhaoyun: weeklyLimit=3
    shop.buyItem(player, 'fragment_zhaoyun', 2);
    player.arenaCoins = 10000;

    expect(() => shop.buyItem(player, 'fragment_zhaoyun', 2)).toThrow('每周限购');
  });

  test('无限购商品可以无限购买', () => {
    const player = createPlayerWithCoins(100000);
    // equip_box_bronze: weeklyLimit=0
    const result1 = shop.buyItem(player, 'equip_box_bronze', 5);
    player.arenaCoins = 100000;
    const result2 = shop.buyItem(result1.state, 'equip_box_bronze', 5);

    expect(result2.state.arenaCoins).toBeLessThan(result1.state.arenaCoins);
  });

  test('连续购买累计已购数量', () => {
    let player = createPlayerWithCoins(10000);
    player = shop.buyItem(player, 'fragment_liubei', 1).state;
    player.arenaCoins = 10000;
    player = shop.buyItem(player, 'fragment_liubei', 1).state;

    const item = shop.getItem('fragment_liubei');
    expect(item!.purchased).toBe(2);
  });
});

// ── 购买前置检查 ──────────────────────────

describe('ArenaShopSystem — 购买前置检查', () => {
  test('可以购买时返回canBuy=true', () => {
    const player = createPlayerWithCoins(500);
    const check = shop.canBuy(player, 'fragment_liubei', 1);
    expect(check.canBuy).toBe(true);
    expect(check.reason).toBe('');
  });

  test('竞技币不足返回false', () => {
    const player = createPlayerWithCoins(50);
    const check = shop.canBuy(player, 'fragment_liubei', 1);
    expect(check.canBuy).toBe(false);
    expect(check.reason).toBe('竞技币不足');
  });

  test('商品不存在返回false', () => {
    const player = createPlayerWithCoins(10000);
    const check = shop.canBuy(player, 'nonexistent');
    expect(check.canBuy).toBe(false);
    expect(check.reason).toBe('商品不存在');
  });

  test('超出限购返回false', () => {
    const player = createPlayerWithCoins(100000);
    shop.buyItem(player, 'fragment_zhaoyun', 3);
    player.arenaCoins = 100000;

    const check = shop.canBuy(player, 'fragment_zhaoyun', 1);
    expect(check.canBuy).toBe(false);
    expect(check.reason).toBe('超出周限购数量');
  });
});

// ── 每周重置 ──────────────────────────────

describe('ArenaShopSystem — 每周重置', () => {
  test('重置后所有商品已购数量归零', () => {
    const player = createPlayerWithCoins(100000);
    shop.buyItem(player, 'fragment_liubei', 3);
    shop.buyItem(player, 'enhance_stone_small', 5);

    shop.weeklyReset();

    const items = shop.getAllItems();
    expect(items.every((i) => i.purchased === 0)).toBe(true);
  });

  test('重置后可以再次购买限购商品', () => {
    const player = createPlayerWithCoins(100000);
    // fragment_zhaoyun: weeklyLimit=3
    shop.buyItem(player, 'fragment_zhaoyun', 3);

    shop.weeklyReset();

    player.arenaCoins = 100000;
    const check = shop.canBuy(player, 'fragment_zhaoyun', 1);
    expect(check.canBuy).toBe(true);
  });
});

// ── 存档序列化 ────────────────────────────

describe('ArenaShopSystem — 存档序列化', () => {
  test('序列化包含完整商品数据', () => {
    const data = shop.serialize();
    expect(data.version).toBe(ARENA_SHOP_SAVE_VERSION);
    expect(data.items.length).toBe(DEFAULT_ARENA_SHOP_ITEMS.length);
  });

  test('序列化包含已购数量', () => {
    const player = createPlayerWithCoins(100000);
    shop.buyItem(player, 'fragment_liubei', 2);

    const data = shop.serialize();
    const liubei = data.items.find((i) => i.itemId === 'fragment_liubei');
    expect(liubei!.purchased).toBe(2);
  });

  test('反序列化恢复商品状态', () => {
    const player = createPlayerWithCoins(100000);
    shop.buyItem(player, 'fragment_liubei', 2);

    const data = shop.serialize();

    const newShop = new ArenaShopSystem();
    newShop.deserialize(data);

    const item = newShop.getItem('fragment_liubei');
    expect(item!.purchased).toBe(2);
  });

  test('反序列化无效数据不崩溃', () => {
    const newShop = new ArenaShopSystem();
    expect(() => newShop.deserialize({} as any)).not.toThrow();
    expect(() => newShop.deserialize({ version: 999, items: [] } as any)).not.toThrow();
  });
});

// ── 自定义商品列表 ────────────────────────

describe('ArenaShopSystem — 自定义商品列表', () => {
  test('可以传入自定义商品', () => {
    const customItems = [
      { itemId: 'custom_1', itemName: '自定义物品', itemType: 'hero_fragment' as const, arenaCoinCost: 50, weeklyLimit: 0, purchased: 0 },
    ];
    const customShop = new ArenaShopSystem(customItems);

    expect(customShop.getAllItems().length).toBe(1);
    expect(customShop.getItem('custom_1')).toBeDefined();
  });
});
