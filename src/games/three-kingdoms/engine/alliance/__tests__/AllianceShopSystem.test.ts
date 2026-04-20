/**
 * AllianceShopSystem 单元测试
 *
 * 覆盖：
 *   - 商品查询（按等级解锁）
 *   - 购买操作（公会币+限购）
 *   - 批量购买
 *   - 周购重置
 *   - 按类型分组
 */

import {
  AllianceShopSystem,
  DEFAULT_ALLIANCE_SHOP_ITEMS,
} from '../AllianceShopSystem';
import type { AlliancePlayerState } from '../../../core/alliance/alliance.types';
import { createDefaultAlliancePlayerState } from '../AllianceSystem';

// ── 辅助函数 ──────────────────────────────

function createState(coins = 1000): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), guildCoins: coins };
}

// ── 商品查询 ──────────────────────────────

describe('AllianceShopSystem — 商品查询', () => {
  test('默认有6种商品', () => {
    const system = new AllianceShopSystem();
    expect(system.getAllItems()).toHaveLength(6);
  });

  test('等级1只看到基础商品', () => {
    const system = new AllianceShopSystem();
    const items = system.getAvailableShopItems(1);
    expect(items.length).toBe(3); // as_1, as_2, as_3
    expect(items.every(i => i.requiredAllianceLevel <= 1)).toBe(true);
  });

  test('等级3解锁武将碎片', () => {
    const system = new AllianceShopSystem();
    const items = system.getAvailableShopItems(3);
    expect(items.length).toBe(4);
    expect(items.find(i => i.id === 'as_4')).toBeTruthy();
  });

  test('等级7解锁全部商品', () => {
    const system = new AllianceShopSystem();
    const items = system.getAvailableShopItems(7);
    expect(items.length).toBe(6);
  });

  test('获取单个商品', () => {
    const system = new AllianceShopSystem();
    const item = system.getItem('as_1');
    expect(item).toBeTruthy();
    expect(item!.name).toBe('招募令');
  });

  test('不存在的商品返回undefined', () => {
    const system = new AllianceShopSystem();
    expect(system.getItem('nonexist')).toBeUndefined();
  });

  test('检查商品解锁状态', () => {
    const system = new AllianceShopSystem();
    expect(system.isItemUnlocked('as_1', 1)).toBe(true);
    expect(system.isItemUnlocked('as_4', 1)).toBe(false);
    expect(system.isItemUnlocked('as_4', 3)).toBe(true);
  });
});

// ── 购买操作 ──────────────────────────────

describe('AllianceShopSystem — 购买操作', () => {
  test('成功购买商品', () => {
    const system = new AllianceShopSystem();
    const state = createState(1000);
    const result = system.buyShopItem(state, 'as_1', 1);
    expect(result.guildCoins).toBe(1000 - 50); // 招募令50公会币
  });

  test('商品不存在', () => {
    const system = new AllianceShopSystem();
    const state = createState(1000);
    expect(() => system.buyShopItem(state, 'nonexist', 1))
      .toThrow('商品不存在');
  });

  test('联盟等级不足', () => {
    const system = new AllianceShopSystem();
    const state = createState(1000);
    expect(() => system.buyShopItem(state, 'as_4', 1))
      .toThrow('联盟等级不足');
  });

  test('公会币不足', () => {
    const system = new AllianceShopSystem();
    const state = createState(10);
    expect(() => system.buyShopItem(state, 'as_1', 1))
      .toThrow('公会币不足');
  });

  test('限购数量检查', () => {
    const system = new AllianceShopSystem();
    const state = createState(10000);
    // as_1限购5次
    let result = state;
    for (let i = 0; i < 5; i++) {
      result = system.buyShopItem(result, 'as_1', 1);
    }
    expect(() => system.buyShopItem(result, 'as_1', 1))
      .toThrow('已达限购上限');
  });

  test('canBuy检查', () => {
    const system = new AllianceShopSystem();
    expect(system.canBuy('as_1', 1, 100).canBuy).toBe(true);
    expect(system.canBuy('as_4', 1, 100).canBuy).toBe(false);
    expect(system.canBuy('as_1', 1, 10).canBuy).toBe(false);
  });
});

// ── 批量购买 ──────────────────────────────

describe('AllianceShopSystem — 批量购买', () => {
  test('批量购买2个', () => {
    const system = new AllianceShopSystem();
    const state = createState(1000);
    const result = system.buyShopItemBatch(state, 'as_1', 2, 1);
    expect(result.guildCoins).toBe(1000 - 50 * 2);
  });

  test('批量购买超过限购数量', () => {
    const system = new AllianceShopSystem();
    const state = createState(10000);
    // as_1限购5次，买10个只买5个
    const result = system.buyShopItemBatch(state, 'as_1', 10, 1);
    expect(result.guildCoins).toBe(10000 - 50 * 5);
  });

  test('批量购买公会币不足', () => {
    const system = new AllianceShopSystem();
    const state = createState(80);
    expect(() => system.buyShopItemBatch(state, 'as_1', 2, 1))
      .toThrow('公会币不足');
  });
});

// ── 周购重置 ──────────────────────────────

describe('AllianceShopSystem — 周购重置', () => {
  test('重置后可再次购买', () => {
    const system = new AllianceShopSystem();
    const state = createState(10000);
    // 买满
    let result = state;
    for (let i = 0; i < 5; i++) {
      result = system.buyShopItem(result, 'as_1', 1);
    }
    expect(() => system.buyShopItem(result, 'as_1', 1)).toThrow('已达限购上限');

    // 重置
    system.resetShopWeekly();
    const afterReset = system.buyShopItem(result, 'as_1', 1);
    expect(afterReset.guildCoins).toBeLessThan(result.guildCoins);
  });
});

// ── 工具方法 ──────────────────────────────

describe('AllianceShopSystem — 工具方法', () => {
  test('获取剩余购买次数', () => {
    const system = new AllianceShopSystem();
    expect(system.getRemainingPurchases('as_1')).toBe(5); // 限购5
    expect(system.getRemainingPurchases('nonexist')).toBe(0);
  });

  test('按类型分组', () => {
    const system = new AllianceShopSystem();
    const groups = system.getItemsByType(1);
    expect(groups['recruit_order']).toHaveLength(1);
    expect(groups['equip_box']).toHaveLength(1);
    expect(groups['speed_item']).toHaveLength(1);
    expect(groups['hero_fragment']).toBeUndefined(); // 等级1看不到
  });
});
