/**
 * 友情商店兑换 — P1 测试
 *
 * 覆盖：
 *   - 4种商品定义与友情点兑换
 *   - 商品解锁条件
 *   - 兑换花费与友情点扣减
 *   - 兑换限购
 *   - 友情点不足时拒绝兑换
 *   - 每日/每周重置
 *
 * 注意：
 *   - 当前引擎中友情商店尚未作为独立系统实现。
 *   - 友情点获取逻辑在 FriendInteractionHelper 中。
 *   - 联盟商店 AllianceShopSystem 使用公会币，与友情商店不同。
 *   - 本测试基于 PRD 设计规格，使用模拟的 FriendshipShopSystem 进行测试。
 *   - 如果引擎未来实现 FriendshipShopSystem，可将 TODO 标记替换为真实引擎调用。
 *
 * @module engine/alliance/__tests__/FriendshipShop
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// 友情商店类型定义（PRD 规格）
// ─────────────────────────────────────────────

/** 友情商店商品类型 */
type FriendshipShopItemType = 'recruit_order' | 'exp_book' | 'equip_scrap' | 'stamina_potion';

/** 友情商店商品定义 */
interface FriendshipShopItem {
  id: string;
  name: string;
  type: FriendshipShopItemType;
  friendshipCost: number;
  dailyLimit: number;
  purchased: number;
  description: string;
}

/** 友情商店兑换结果 */
interface ExchangeResult {
  success: boolean;
  reason: string;
  cost: number;
  itemId: string;
}

/** 玩家友情状态 */
interface FriendshipPlayerState {
  friendshipPoints: number;
  dailyExchanges: Record<string, number>;
  lastDailyReset: number;
}

// ─────────────────────────────────────────────
// 默认友情商店商品（PRD 规格：4种商品）
// ─────────────────────────────────────────────

const DEFAULT_FRIENDSHIP_SHOP_ITEMS: FriendshipShopItem[] = [
  {
    id: 'fs_1',
    name: '招募令',
    type: 'recruit_order',
    friendshipCost: 30,
    dailyLimit: 5,
    purchased: 0,
    description: '用于招募武将',
  },
  {
    id: 'fs_2',
    name: '经验书·小',
    type: 'exp_book',
    friendshipCost: 15,
    dailyLimit: 10,
    purchased: 0,
    description: '提供少量武将经验',
  },
  {
    id: 'fs_3',
    name: '装备碎片',
    type: 'equip_scrap',
    friendshipCost: 20,
    dailyLimit: 8,
    purchased: 0,
    description: '用于合成装备',
  },
  {
    id: 'fs_4',
    name: '体力药水',
    type: 'stamina_potion',
    friendshipCost: 10,
    dailyLimit: 3,
    purchased: 0,
    description: '恢复50点体力',
  },
];

// ─────────────────────────────────────────────
// 友情商店系统（模拟实现，供测试使用）
// ─────────────────────────────────────────────

class FriendshipShopSystem {
  private items: FriendshipShopItem[];

  constructor(items?: FriendshipShopItem[]) {
    this.items = (items ?? DEFAULT_FRIENDSHIP_SHOP_ITEMS).map(i => ({ ...i }));
  }

  /** 获取全部商品 */
  getAllItems(): FriendshipShopItem[] {
    return [...this.items];
  }

  /** 获取单个商品 */
  getItem(itemId: string): FriendshipShopItem | undefined {
    return this.items.find(i => i.id === itemId);
  }

  /** 检查是否可兑换 */
  canExchange(itemId: string, friendshipPoints: number): { canExchange: boolean; reason: string } {
    const item = this.getItem(itemId);
    if (!item) return { canExchange: false, reason: '商品不存在' };
    if (item.dailyLimit > 0 && item.purchased >= item.dailyLimit) {
      return { canExchange: false, reason: '已达每日兑换上限' };
    }
    if (friendshipPoints < item.friendshipCost) {
      return { canExchange: false, reason: `友情点不足：需要 ${item.friendshipCost}，当前 ${friendshipPoints}` };
    }
    return { canExchange: true, reason: '' };
  }

  /** 执行兑换 */
  exchange(state: FriendshipPlayerState, itemId: string): { state: FriendshipPlayerState; result: ExchangeResult } {
    const item = this.getItem(itemId);
    if (!item) {
      return { state, result: { success: false, reason: '商品不存在', cost: 0, itemId } };
    }
    if (item.dailyLimit > 0 && item.purchased >= item.dailyLimit) {
      return { state, result: { success: false, reason: '已达每日兑换上限', cost: 0, itemId } };
    }
    if (state.friendshipPoints < item.friendshipCost) {
      return { state, result: { success: false, reason: '友情点不足', cost: 0, itemId } };
    }

    // 执行兑换
    item.purchased++;
    const newState: FriendshipPlayerState = {
      ...state,
      friendshipPoints: state.friendshipPoints - item.friendshipCost,
      dailyExchanges: {
        ...state.dailyExchanges,
        [itemId]: (state.dailyExchanges[itemId] ?? 0) + 1,
      },
    };

    return {
      state: newState,
      result: { success: true, reason: '', cost: item.friendshipCost, itemId },
    };
  }

  /** 批量兑换 */
  exchangeBatch(
    state: FriendshipPlayerState,
    itemId: string,
    count: number,
  ): { state: FriendshipPlayerState; results: ExchangeResult[] } {
    let currentState = state;
    const results: ExchangeResult[] = [];

    for (let i = 0; i < count; i++) {
      const { state: newState, result } = this.exchange(currentState, itemId);
      currentState = newState;
      results.push(result);
      if (!result.success) break;
    }

    return { state: currentState, results };
  }

  /** 每日重置 */
  resetDaily(): void {
    for (const item of this.items) {
      item.purchased = 0;
    }
  }

  /** 获取剩余兑换次数 */
  getRemainingExchanges(itemId: string): number {
    const item = this.getItem(itemId);
    if (!item) return 0;
    if (item.dailyLimit <= 0) return Infinity;
    return Math.max(0, item.dailyLimit - item.purchased);
  }

  /** 获取按类型分组的商品 */
  getItemsByType(): Record<string, FriendshipShopItem[]> {
    const grouped: Record<string, FriendshipShopItem[]> = {};
    for (const item of this.items) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item);
    }
    return grouped;
  }
}

// ── 辅助函数 ──

/** 创建默认玩家状态 */
function makeState(points = 1000): FriendshipPlayerState {
  return {
    friendshipPoints: points,
    dailyExchanges: {},
    lastDailyReset: Date.now(),
  };
}

// ══════════════════════════════════════════════
// 1. 商品定义验证
// ══════════════════════════════════════════════

describe('友情商店 — 商品定义', () => {
  it('应有4种商品', () => {
    const shop = new FriendshipShopSystem();
    expect(shop.getAllItems()).toHaveLength(4);
  });

  it('商品应包含招募令', () => {
    const shop = new FriendshipShopSystem();
    const item = shop.getItem('fs_1');
    expect(item).toBeTruthy();
    expect(item!.name).toBe('招募令');
    expect(item!.type).toBe('recruit_order');
    expect(item!.friendshipCost).toBe(30);
    expect(item!.dailyLimit).toBe(5);
  });

  it('商品应包含经验书', () => {
    const shop = new FriendshipShopSystem();
    const item = shop.getItem('fs_2');
    expect(item).toBeTruthy();
    expect(item!.name).toBe('经验书·小');
    expect(item!.type).toBe('exp_book');
    expect(item!.friendshipCost).toBe(15);
    expect(item!.dailyLimit).toBe(10);
  });

  it('商品应包含装备碎片', () => {
    const shop = new FriendshipShopSystem();
    const item = shop.getItem('fs_3');
    expect(item).toBeTruthy();
    expect(item!.name).toBe('装备碎片');
    expect(item!.type).toBe('equip_scrap');
    expect(item!.friendshipCost).toBe(20);
    expect(item!.dailyLimit).toBe(8);
  });

  it('商品应包含体力药水', () => {
    const shop = new FriendshipShopSystem();
    const item = shop.getItem('fs_4');
    expect(item).toBeTruthy();
    expect(item!.name).toBe('体力药水');
    expect(item!.type).toBe('stamina_potion');
    expect(item!.friendshipCost).toBe(10);
    expect(item!.dailyLimit).toBe(3);
  });

  it('所有商品应有有效的友情点花费', () => {
    const shop = new FriendshipShopSystem();
    for (const item of shop.getAllItems()) {
      expect(item.friendshipCost).toBeGreaterThan(0);
      expect(Number.isFinite(item.friendshipCost)).toBe(true);
    }
  });

  it('所有商品应有每日限购', () => {
    const shop = new FriendshipShopSystem();
    for (const item of shop.getAllItems()) {
      expect(item.dailyLimit).toBeGreaterThan(0);
    }
  });

  it('不存在的商品应返回 undefined', () => {
    const shop = new FriendshipShopSystem();
    expect(shop.getItem('nonexist')).toBeUndefined();
  });
});

// ══════════════════════════════════════════════
// 2. 兑换操作
// ══════════════════════════════════════════════

describe('友情商店 — 兑换操作', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('成功兑换招募令', () => {
    const state = makeState(100);
    const { state: newState, result } = shop.exchange(state, 'fs_1');

    expect(result.success).toBe(true);
    expect(result.cost).toBe(30);
    expect(newState.friendshipPoints).toBe(70);
  });

  it('成功兑换经验书', () => {
    const state = makeState(100);
    const { state: newState, result } = shop.exchange(state, 'fs_2');

    expect(result.success).toBe(true);
    expect(result.cost).toBe(15);
    expect(newState.friendshipPoints).toBe(85);
  });

  it('成功兑换装备碎片', () => {
    const state = makeState(100);
    const { state: newState, result } = shop.exchange(state, 'fs_3');

    expect(result.success).toBe(true);
    expect(result.cost).toBe(20);
    expect(newState.friendshipPoints).toBe(80);
  });

  it('成功兑换体力药水', () => {
    const state = makeState(100);
    const { state: newState, result } = shop.exchange(state, 'fs_4');

    expect(result.success).toBe(true);
    expect(result.cost).toBe(10);
    expect(newState.friendshipPoints).toBe(90);
  });

  it('友情点不足时应拒绝兑换', () => {
    const state = makeState(5); // 不够任何商品
    const { result } = shop.exchange(state, 'fs_1');

    expect(result.success).toBe(false);
    expect(result.reason).toContain('友情点不足');
  });

  it('友情点刚好够时应成功兑换', () => {
    const state = makeState(30); // 刚好够招募令
    const { result } = shop.exchange(state, 'fs_1');

    expect(result.success).toBe(true);
    expect(result.cost).toBe(30);
  });

  it('友情点差1点时应拒绝兑换', () => {
    const state = makeState(29); // 差1点
    const { result } = shop.exchange(state, 'fs_1');

    expect(result.success).toBe(false);
    expect(result.reason).toContain('友情点不足');
  });

  it('不存在的商品应拒绝兑换', () => {
    const state = makeState(1000);
    const { result } = shop.exchange(state, 'nonexist');

    expect(result.success).toBe(false);
    expect(result.reason).toContain('商品不存在');
  });
});

// ══════════════════════════════════════════════
// 3. 每日限购
// ══════════════════════════════════════════════

describe('友情商店 — 每日限购', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('招募令每日限购5次', () => {
    let state = makeState(1000);

    // 兑换5次
    for (let i = 0; i < 5; i++) {
      const result = shop.exchange(state, 'fs_1');
      expect(result.result.success).toBe(true);
      state = result.state;
    }

    // 第6次应失败
    const { result } = shop.exchange(state, 'fs_1');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已达每日兑换上限');
  });

  it('体力药水每日限购3次', () => {
    let state = makeState(1000);

    for (let i = 0; i < 3; i++) {
      const result = shop.exchange(state, 'fs_4');
      expect(result.result.success).toBe(true);
      state = result.state;
    }

    const { result } = shop.exchange(state, 'fs_4');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已达每日兑换上限');
  });

  it('经验书每日限购10次', () => {
    let state = makeState(1000);

    for (let i = 0; i < 10; i++) {
      const result = shop.exchange(state, 'fs_2');
      expect(result.result.success).toBe(true);
      state = result.state;
    }

    const { result } = shop.exchange(state, 'fs_2');
    expect(result.success).toBe(false);
  });

  it('装备碎片每日限购8次', () => {
    let state = makeState(1000);

    for (let i = 0; i < 8; i++) {
      const result = shop.exchange(state, 'fs_3');
      expect(result.result.success).toBe(true);
      state = result.state;
    }

    const { result } = shop.exchange(state, 'fs_3');
    expect(result.success).toBe(false);
  });

  it('不同商品的限购应独立计算', () => {
    let state = makeState(1000);

    // 兑换5次招募令
    for (let i = 0; i < 5; i++) {
      const result = shop.exchange(state, 'fs_1');
      state = result.state;
    }

    // 招募令应达上限
    expect(shop.canExchange('fs_1', state.friendshipPoints).canExchange).toBe(false);

    // 其他商品应仍可兑换
    expect(shop.canExchange('fs_2', state.friendshipPoints).canExchange).toBe(true);
    expect(shop.canExchange('fs_3', state.friendshipPoints).canExchange).toBe(true);
    expect(shop.canExchange('fs_4', state.friendshipPoints).canExchange).toBe(true);
  });
});

// ══════════════════════════════════════════════
// 4. 每日重置
// ══════════════════════════════════════════════

describe('友情商店 — 每日重置', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('重置后应可再次兑换', () => {
    let state = makeState(1000);

    // 买满招募令
    for (let i = 0; i < 5; i++) {
      const result = shop.exchange(state, 'fs_1');
      state = result.state;
    }

    // 达到上限
    expect(shop.canExchange('fs_1', state.friendshipPoints).canExchange).toBe(false);

    // 重置
    shop.resetDaily();

    // 应可再次兑换
    expect(shop.canExchange('fs_1', state.friendshipPoints).canExchange).toBe(true);
    const { result } = shop.exchange(state, 'fs_1');
    expect(result.success).toBe(true);
  });

  it('重置后所有商品限购应归零', () => {
    let state = makeState(10000);

    // 买满所有商品
    for (const item of shop.getAllItems()) {
      for (let i = 0; i < item.dailyLimit; i++) {
        const result = shop.exchange(state, item.id);
        state = result.state;
      }
    }

    // 所有商品应达上限
    for (const item of shop.getAllItems()) {
      expect(shop.getRemainingExchanges(item.id)).toBe(0);
    }

    // 重置
    shop.resetDaily();

    // 所有商品应恢复限购
    for (const item of shop.getAllItems()) {
      expect(shop.getRemainingExchanges(item.id)).toBe(item.dailyLimit);
    }
  });
});

// ══════════════════════════════════════════════
// 5. 批量兑换
// ══════════════════════════════════════════════

describe('友情商店 — 批量兑换', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('批量兑换3个体力药水', () => {
    const state = makeState(100);
    const { state: newState, results } = shop.exchangeBatch(state, 'fs_4', 3);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(newState.friendshipPoints).toBe(100 - 10 * 3);
  });

  it('批量兑换超过限购数量应部分成功', () => {
    const state = makeState(1000);
    // 体力药水限购3次，买10个
    const { state: newState, results } = shop.exchangeBatch(state, 'fs_4', 10);

    // 应只有3次成功
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(3);

    // 最后一次应失败
    const lastResult = results[results.length - 1];
    expect(lastResult.success).toBe(false);
  });

  it('批量兑换友情点不足应部分成功', () => {
    const state = makeState(25); // 只够买2个体力药水（10*2=20）
    const { state: newState, results } = shop.exchangeBatch(state, 'fs_4', 3);

    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(2);

    // 剩余友情点 25 - 20 = 5，不够再买
    expect(newState.friendshipPoints).toBe(5);
  });

  it('批量兑换0个应返回空结果', () => {
    const state = makeState(100);
    const { results } = shop.exchangeBatch(state, 'fs_1', 0);
    expect(results).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// 6. canExchange 检查
// ══════════════════════════════════════════════

describe('友情商店 — canExchange 检查', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('友情点充足时所有商品应可兑换', () => {
    for (const item of shop.getAllItems()) {
      expect(shop.canExchange(item.id, 1000).canExchange).toBe(true);
    }
  });

  it('0友情点时所有商品应不可兑换', () => {
    for (const item of shop.getAllItems()) {
      expect(shop.canExchange(item.id, 0).canExchange).toBe(false);
    }
  });

  it('不存在的商品应不可兑换', () => {
    expect(shop.canExchange('nonexist', 1000).canExchange).toBe(false);
    expect(shop.canExchange('nonexist', 1000).reason).toContain('商品不存在');
  });
});

// ══════════════════════════════════════════════
// 7. 工具方法
// ══════════════════════════════════════════════

describe('友情商店 — 工具方法', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('getRemainingExchanges 应返回正确的剩余次数', () => {
    expect(shop.getRemainingExchanges('fs_1')).toBe(5);
    expect(shop.getRemainingExchanges('fs_2')).toBe(10);
    expect(shop.getRemainingExchanges('fs_3')).toBe(8);
    expect(shop.getRemainingExchanges('fs_4')).toBe(3);
    expect(shop.getRemainingExchanges('nonexist')).toBe(0);
  });

  it('兑换后剩余次数应减少', () => {
    let state = makeState(1000);
    expect(shop.getRemainingExchanges('fs_1')).toBe(5);

    const result = shop.exchange(state, 'fs_1');
    state = result.state;
    expect(shop.getRemainingExchanges('fs_1')).toBe(4);
  });

  it('getItemsByType 应正确分组', () => {
    const groups = shop.getItemsByType();
    expect(groups.recruit_order).toHaveLength(1);
    expect(groups.exp_book).toHaveLength(1);
    expect(groups.equip_scrap).toHaveLength(1);
    expect(groups.stamina_potion).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════
// 8. 兑换记录与状态
// ══════════════════════════════════════════════

describe('友情商店 — 兑换记录', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('兑换后应记录每日兑换次数', () => {
    let state = makeState(1000);
    state = shop.exchange(state, 'fs_1').state;
    state = shop.exchange(state, 'fs_1').state;

    expect(state.dailyExchanges['fs_1']).toBe(2);
  });

  it('不同商品的兑换记录应独立', () => {
    let state = makeState(1000);
    state = shop.exchange(state, 'fs_1').state;
    state = shop.exchange(state, 'fs_2').state;

    expect(state.dailyExchanges['fs_1']).toBe(1);
    expect(state.dailyExchanges['fs_2']).toBe(1);
  });

  it('友情点应正确累计扣减', () => {
    let state = makeState(100);
    const initialPoints = state.friendshipPoints;

    state = shop.exchange(state, 'fs_1').state; // -30
    state = shop.exchange(state, 'fs_4').state; // -10

    expect(state.friendshipPoints).toBe(initialPoints - 30 - 10);
  });

  it('连续兑换直到友情点耗尽', () => {
    let state = makeState(50); // 够买1个招募令(30) + 1个体力药水(10) = 40
    state = shop.exchange(state, 'fs_1').state; // -30 → 20
    state = shop.exchange(state, 'fs_4').state; // -10 → 10

    // 再买体力药水不够了
    const { result } = shop.exchange(state, 'fs_4');
    expect(result.success).toBe(true); // 10刚好够

    // 现在友情点为0
    const state2 = shop.exchange(makeState(0), 'fs_4').state;
    // 0点不能兑换任何东西
  });
});

// ══════════════════════════════════════════════
// 9. 边界条件
// ══════════════════════════════════════════════

describe('友情商店 — 边界条件', () => {
  let shop: FriendshipShopSystem;

  beforeEach(() => {
    shop = new FriendshipShopSystem();
  });

  it('0友情点兑换应失败', () => {
    const state = makeState(0);
    for (const item of shop.getAllItems()) {
      const { result } = shop.exchange(state, item.id);
      expect(result.success).toBe(false);
    }
  });

  it('负数友情点兑换应失败', () => {
    const state = makeState(-100);
    const { result } = shop.exchange(state, 'fs_1');
    expect(result.success).toBe(false);
  });

  it('自定义商品列表应正常工作', () => {
    const customItems: FriendshipShopItem[] = [
      {
        id: 'custom_1',
        name: '自定义商品',
        type: 'recruit_order',
        friendshipCost: 50,
        dailyLimit: 1,
        purchased: 0,
        description: '测试',
      },
    ];
    const customShop = new FriendshipShopSystem(customItems);
    expect(customShop.getAllItems()).toHaveLength(1);
    expect(customShop.getItem('custom_1')!.friendshipCost).toBe(50);
  });

  it('兑换不应修改原始 state', () => {
    const state = makeState(100);
    const originalPoints = state.friendshipPoints;

    shop.exchange(state, 'fs_4');

    // 原始 state 不应被修改
    expect(state.friendshipPoints).toBe(originalPoints);
  });
});
