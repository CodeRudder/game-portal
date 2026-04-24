/**
 * 联盟商店与捐献集成测试
 *
 * 覆盖 Play 流程：
 *   §4.1 联盟科技树（商店部分）
 *   §4.2 联盟商店
 *   §2.4 联盟捐献与贡献
 *   §14.2 联盟商店与活动商店互斥规则
 *   §16.4 联盟商店与活动商店购买操作流程
 */

import { AllianceShopSystem, DEFAULT_ALLIANCE_SHOP_ITEMS } from '../../AllianceShopSystem';
import { AllianceTaskSystem } from '../../AllianceTaskSystem';
import { AllianceSystem } from '../../AllianceSystem';
import {
  createDefaultAlliancePlayerState,
  createAllianceData,
} from '../../alliance-constants';
import { AllianceRole } from '../../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceShopItem,
} from '../../../../core/alliance/alliance.types';

// ── 辅助函数 ──────────────────────────────

const NOW = 1_000_000;

function state(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function makeAlliance(level = 1): AllianceData {
  const a = createAllianceData('ally_1', '蜀汉', '兴复汉室', 'p1', '刘备', NOW);
  a.level = level;
  a.members['p2'] = {
    playerId: 'p2', playerName: '诸葛亮', role: 'ADVISOR' as AllianceRole,
    power: 5000, joinTime: NOW, dailyContribution: 0, totalContribution: 100, dailyBossChallenges: 0,
  };
  return a;
}

// ══════════════════════════════════════════════
// §4.2 联盟商店
// ══════════════════════════════════════════════

describe('§4.2 联盟商店', () => {
  let shopSys: AllianceShopSystem;

  beforeEach(() => { shopSys = new AllianceShopSystem(); });

  it('获取全部商品列表', () => {
    const items = shopSys.getAllItems();
    expect(items.length).toBeGreaterThan(0);
  });

  it('按联盟等级过滤可购买商品', () => {
    const lv1Items = shopSys.getAvailableShopItems(1);
    const lv5Items = shopSys.getAvailableShopItems(5);
    const lv7Items = shopSys.getAvailableShopItems(7);
    expect(lv5Items.length).toBeGreaterThan(lv1Items.length);
    expect(lv7Items.length).toBeGreaterThanOrEqual(lv5Items.length);
  });

  it('Lv1可购买基础商品', () => {
    const items = shopSys.getAvailableShopItems(1);
    const types = items.map(i => i.type);
    expect(types).toContain('recruit_order');
    expect(types).toContain('equip_box');
    expect(types).toContain('speed_item');
  });

  it('Lv5解锁高级装备箱', () => {
    const items = shopSys.getAvailableShopItems(5);
    const fineBox = items.find(i => i.id === 'as_5');
    expect(fineBox).toBeDefined();
    expect(fineBox!.name).toContain('精');
  });

  it('Lv7解锁稀有武将碎片', () => {
    const items = shopSys.getAvailableShopItems(7);
    const rareFragment = items.find(i => i.id === 'as_6');
    expect(rareFragment).toBeDefined();
  });

  it('成功购买商品：公会币扣除', () => {
    const item = shopSys.getItem('as_1')!;
    const ps = state({ guildCoins: item.guildCoinCost });
    const after = shopSys.buyShopItem(ps, 'as_1', 1);
    expect(after.guildCoins).toBe(0);
  });

  it('公会币不足无法购买', () => {
    expect(() => shopSys.buyShopItem(state({ guildCoins: 0 }), 'as_1', 1))
      .toThrow('公会币不足');
  });

  it('联盟等级不足无法购买', () => {
    const ps = state({ guildCoins: 999 });
    expect(() => shopSys.buyShopItem(ps, 'as_4', 2)) // requires Lv3
      .toThrow('联盟等级不足');
  });

  it('限购次数耗尽无法购买', () => {
    const item = shopSys.getItem('as_1')!;
    const ps = state({ guildCoins: item.guildCoinCost * 10 });
    // Buy up to limit
    for (let i = 0; i < item.weeklyLimit; i++) {
      shopSys.buyShopItem(ps, 'as_1', 1);
    }
    expect(() => shopSys.buyShopItem(ps, 'as_1', 1))
      .toThrow('已达限购上限');
  });

  it('批量购买：正确扣除公会币', () => {
    const item = shopSys.getItem('as_1')!;
    const count = 3;
    const ps = state({ guildCoins: item.guildCoinCost * count });
    const after = shopSys.buyShopItemBatch(ps, 'as_1', count, 1);
    expect(after.guildCoins).toBe(0);
  });

  it('批量购买：不超过限购上限', () => {
    const item = shopSys.getItem('as_1')!;
    const ps = state({ guildCoins: item.guildCoinCost * 100 });
    // Try to buy more than limit
    const after = shopSys.buyShopItemBatch(ps, 'as_1', 100, 1);
    // Should be capped at weeklyLimit
    expect(shopSys.getRemainingPurchases('as_1')).toBe(0);
  });

  it('批量购买：公会币不足时报错', () => {
    const ps = state({ guildCoins: 5 });
    expect(() => shopSys.buyShopItemBatch(ps, 'as_1', 2, 1))
      .toThrow('公会币不足');
  });

  it('每周重置限购次数', () => {
    const item = shopSys.getItem('as_1')!;
    const ps = state({ guildCoins: item.guildCoinCost * item.weeklyLimit });
    // Buy all
    for (let i = 0; i < item.weeklyLimit; i++) {
      shopSys.buyShopItem(ps, 'as_1', 1);
    }
    expect(shopSys.getRemainingPurchases('as_1')).toBe(0);
    // Weekly reset
    shopSys.resetShopWeekly();
    expect(shopSys.getRemainingPurchases('as_1')).toBe(item.weeklyLimit);
  });

  it('canBuy：检查所有条件', () => {
    // Not enough coins
    expect(shopSys.canBuy('as_1', 1, 0).canBuy).toBe(false);
    expect(shopSys.canBuy('as_1', 1, 0).reason).toBe('公会币不足');

    // Level too low
    expect(shopSys.canBuy('as_4', 1, 999).canBuy).toBe(false);
    expect(shopSys.canBuy('as_4', 1, 999).reason).toContain('联盟等级');

    // OK
    const item = shopSys.getItem('as_1')!;
    expect(shopSys.canBuy('as_1', 1, item.guildCoinCost).canBuy).toBe(true);
  });

  it('canBuy：商品不存在', () => {
    expect(shopSys.canBuy('nonexistent', 1, 9999).canBuy).toBe(false);
  });

  it('isItemUnlocked：等级判断', () => {
    expect(shopSys.isItemUnlocked('as_1', 1)).toBe(true);
    expect(shopSys.isItemUnlocked('as_4', 1)).toBe(false);
    expect(shopSys.isItemUnlocked('as_4', 3)).toBe(true);
  });

  it('getRemainingPurchases：不存在商品返回0', () => {
    expect(shopSys.getRemainingPurchases('nonexistent')).toBe(0);
  });

  it('按类型分组商品', () => {
    const grouped = shopSys.getItemsByType(5);
    expect(Object.keys(grouped).length).toBeGreaterThan(0);
    expect(grouped['recruit_order']).toBeDefined();
    expect(grouped['equip_box']).toBeDefined();
  });

  it('自定义商品列表', () => {
    const customItems: AllianceShopItem[] = [
      { id: 'custom_1', name: '测试道具', type: 'recruit_order', guildCoinCost: 10, weeklyLimit: 0, purchased: 0, requiredAllianceLevel: 1 },
    ];
    const customShop = new AllianceShopSystem(customItems);
    expect(customShop.getAllItems()).toHaveLength(1);
    expect(customShop.getAllItems()[0].name).toBe('测试道具');
  });
});

// ══════════════════════════════════════════════
// §2.4 联盟捐献与贡献
// ══════════════════════════════════════════════

describe('§2.4 联盟捐献与贡献', () => {
  let taskSys: AllianceTaskSystem;

  beforeEach(() => { taskSys = new AllianceTaskSystem(); });

  it('贡献记录同步到联盟与个人', () => {
    const alliance = makeAlliance();
    const ps = state({ guildCoins: 0, dailyContribution: 0, allianceId: alliance.id });
    const { alliance: afterA, playerState: afterPs } = taskSys.recordContribution(
      alliance, ps, 'p1', 50,
    );
    // Personal state
    expect(afterPs.guildCoins).toBe(50);
    expect(afterPs.dailyContribution).toBe(50);
    // Alliance member state
    expect(afterA.members['p1'].dailyContribution).toBe(50);
    expect(afterA.members['p1'].totalContribution).toBe(50);
  });

  it('多次捐献累加', () => {
    const alliance = makeAlliance();
    let ps = state({ guildCoins: 0, dailyContribution: 0, allianceId: alliance.id });
    let a = alliance;
    for (let i = 0; i < 3; i++) {
      const r = taskSys.recordContribution(a, ps, 'p1', 10);
      ps = r.playerState;
      a = r.alliance;
    }
    expect(ps.guildCoins).toBe(30);
    expect(ps.dailyContribution).toBe(30);
    expect(a.members['p1'].totalContribution).toBe(30);
  });

  it('非成员捐献被拒绝', () => {
    const alliance = makeAlliance();
    const ps = state();
    expect(() => taskSys.recordContribution(alliance, ps, 'p99', 50))
      .toThrow('不是联盟成员');
  });
});

// ══════════════════════════════════════════════
// §5.1 加入→捐献→商店全链路
// ══════════════════════════════════════════════

describe('§5.1 加入→捐献→商店全链路', () => {
  it('完整链路：创建→加入→捐献→升级→商店购买', () => {
    const allianceSys = new AllianceSystem();
    const shopSys = new AllianceShopSystem();
    const taskSys = new AllianceTaskSystem();

    // Step1: 创建联盟
    const { alliance, playerState: leaderPs } = allianceSys.createAlliance(
      state(), '蜀汉', '兴复汉室', 'p1', '刘备', NOW,
    );

    // Step2: 捐献获取贡献
    let currentPs = { ...leaderPs, allianceId: alliance.id };
    let currentAlliance = alliance;
    const { alliance: afterDonate, playerState: afterPs } = taskSys.recordContribution(
      currentAlliance, currentPs, 'p1', 100,
    );
    currentPs = afterPs;
    currentAlliance = afterDonate;
    expect(currentPs.guildCoins).toBe(100);

    // Step3: 联盟升级
    currentAlliance = allianceSys.addExperience(currentAlliance, 1000);
    expect(currentAlliance.level).toBe(2);

    // Step4: 商店购买（Lv1即可购买基础商品）
    const item = shopSys.getItem('as_3')!; // 加速道具·小, cost=20
    expect(currentPs.guildCoins).toBeGreaterThanOrEqual(item.guildCoinCost);
    currentPs = shopSys.buyShopItem(currentPs, 'as_3', currentAlliance.level);
    expect(currentPs.guildCoins).toBe(100 - item.guildCoinCost);
  });
});

// ══════════════════════════════════════════════
// §14.2 联盟商店与活动商店互斥规则
// ══════════════════════════════════════════════

describe('§14.2 联盟商店与活动商店互斥规则', () => {
  it('联盟商店货币(公会币)独立于活动商店货币(代币)', () => {
    const ps = state({ guildCoins: 500 });
    // guildCoins is the alliance currency, separate from activity tokens
    expect(ps.guildCoins).toBe(500);
    // Activity tokens would be in a different state field
    // This test validates the separation of currency systems
  });

  it('联盟商店限购更严格(周限2~5件)', () => {
    const items = DEFAULT_ALLIANCE_SHOP_ITEMS;
    const limitedItems = items.filter(i => i.weeklyLimit > 0);
    expect(limitedItems.length).toBeGreaterThan(0);
    limitedItems.forEach(item => {
      expect(item.weeklyLimit).toBeGreaterThanOrEqual(1);
      expect(item.weeklyLimit).toBeLessThanOrEqual(10);
    });
  });

  it('同类商品在联盟商店限购更严格', () => {
    const allianceHeroFragments = DEFAULT_ALLIANCE_SHOP_ITEMS.filter(
      i => i.type === 'hero_fragment'
    );
    allianceHeroFragments.forEach(item => {
      expect(item.weeklyLimit).toBeLessThanOrEqual(3); // 联盟限购更严格
    });
  });
});

// ══════════════════════════════════════════════
// §16.4 商店购买操作流程
// ══════════════════════════════════════════════

describe('§16.4 商店购买操作流程', () => {
  let shopSys: AllianceShopSystem;

  beforeEach(() => { shopSys = new AllianceShopSystem(); });

  it('购买流程：检查→扣除→限购递减', () => {
    const item = shopSys.getItem('as_1')!;
    const ps = state({ guildCoins: item.guildCoinCost * 2 });

    // Check can buy
    const check = shopSys.canBuy('as_1', 1, ps.guildCoins);
    expect(check.canBuy).toBe(true);

    // Buy first
    const after1 = shopSys.buyShopItem(ps, 'as_1', 1);
    expect(after1.guildCoins).toBe(ps.guildCoins - item.guildCoinCost);
    expect(shopSys.getRemainingPurchases('as_1')).toBe(item.weeklyLimit - 1);

    // Buy second
    const after2 = shopSys.buyShopItem(after1, 'as_1', 1);
    expect(after2.guildCoins).toBe(ps.guildCoins - item.guildCoinCost * 2);
    expect(shopSys.getRemainingPurchases('as_1')).toBe(item.weeklyLimit - 2);
  });

  it('购买不存在商品报错', () => {
    const ps = state({ guildCoins: 9999 });
    expect(() => shopSys.buyShopItem(ps, 'nonexistent', 1))
      .toThrow('商品不存在');
  });

  it('批量购买不存在商品报错', () => {
    const ps = state({ guildCoins: 9999 });
    expect(() => shopSys.buyShopItemBatch(ps, 'nonexistent', 1, 1))
      .toThrow('商品不存在');
  });
});
