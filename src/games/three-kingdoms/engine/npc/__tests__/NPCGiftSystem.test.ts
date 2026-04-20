/**
 * NPCGiftSystem 单元测试（engine/npc/）
 *
 * 覆盖 NPC 赠送系统的所有功能：
 * - ISubsystem 接口
 * - 物品注册与查询
 * - NPC 偏好物品判断
 * - 赠送流程（物品消耗+好感度提升）
 * - 偏好倍率计算
 * - 连续赠送衰减
 * - 每日赠送次数限制
 * - 赠送历史
 * - 序列化/反序列化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCGiftSystem } from '../NPCGiftSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ItemDef, NPCPreference, GiftRequest } from '../../../core/npc';

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
    registry: {
      register: vi.fn(),
      get: vi.fn().mockReturnValue({
        getNPCById: vi.fn().mockReturnValue({
          id: 'npc-merchant-01',
          name: '商人张三',
          profession: 'merchant',
          affinity: 50,
          position: { x: 1, y: 1 },
          region: 'central_plains',
          visible: true,
          dialogId: 'dialog-merchant-default',
          createdAt: 0,
          lastInteractedAt: 0,
        }),
        changeAffinity: vi.fn().mockReturnValue(55),
      }),
      getAll: vi.fn(),
      has: vi.fn(),
      unregister: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

function createSystem(): NPCGiftSystem {
  const sys = new NPCGiftSystem();
  sys.init(mockDeps());
  return sys;
}

/** 创建测试物品 */
function createItem(overrides?: Partial<ItemDef>): ItemDef {
  return {
    id: 'item-wine',
    name: '美酒',
    category: 'drink',
    rarity: 'common',
    baseAffinityValue: 5,
    description: '一壶上好的美酒',
    ...overrides,
  };
}

/** 注册测试物品 */
function registerTestItems(sys: NPCGiftSystem): void {
  sys.registerItems([
    createItem({ id: 'item-wine', name: '美酒', category: 'drink', rarity: 'common', baseAffinityValue: 5 }),
    createItem({ id: 'item-silk', name: '丝绸', category: 'jewelry', rarity: 'uncommon', baseAffinityValue: 10 }),
    createItem({ id: 'item-art-of-war', name: '孙子兵法', category: 'book', rarity: 'rare', baseAffinityValue: 15 }),
    createItem({ id: 'item-iron-sword', name: '铁剑', category: 'weapon', rarity: 'common', baseAffinityValue: 5 }),
    createItem({ id: 'item-gold-ingot', name: '金元宝', category: 'jewelry', rarity: 'epic', baseAffinityValue: 25 }),
    createItem({ id: 'item-crystal', name: '水晶', category: 'jewelry', rarity: 'rare', baseAffinityValue: 15 }),
  ]);
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('NPCGiftSystem', () => {
  let system: NPCGiftSystem;

  beforeEach(() => {
    system = createSystem();
    registerTestItems(system);
  });

  // ─── ISubsystem 接口 ────────────────────────

  describe('ISubsystem 接口', () => {
    it('应该有正确的 name 属性', () => {
      expect(system.name).toBe('npcGift');
    });

    it('init 不应抛出异常', () => {
      expect(() => system.init(mockDeps())).not.toThrow();
    });

    it('update 不应抛出异常', () => {
      expect(() => system.update(16)).not.toThrow();
    });

    it('getState 应返回有效状态', () => {
      const state = system.getState();
      expect(state).toHaveProperty('giftHistory');
      expect(state).toHaveProperty('dailyGiftCount');
    });

    it('reset 应清空所有数据', () => {
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      system.reset();
      expect(system.getGiftHistory()).toHaveLength(0);
      expect(system.getDailyGiftCount()).toBe(0);
    });
  });

  // ─── 物品注册 ──────────────────────────────

  describe('物品注册', () => {
    it('应该能注册物品', () => {
      system.registerItem(createItem({ id: 'item-new' }));
      expect(system.getItem('item-new')).toBeDefined();
    });

    it('批量注册物品', () => {
      const fresh = new NPCGiftSystem();
      fresh.init(mockDeps());
      fresh.registerItems([
        createItem({ id: 'a' }),
        createItem({ id: 'b' }),
      ]);
      expect(fresh.getAllItems()).toHaveLength(2);
    });

    it('获取不存在的物品应返回 undefined', () => {
      expect(system.getItem('nonexistent')).toBeUndefined();
    });

    it('按分类获取物品', () => {
      const drinks = system.getItemsByCategory('drink');
      expect(drinks).toHaveLength(1);
      expect(drinks[0].id).toBe('item-wine');
    });
  });

  // ─── NPC 偏好物品 ──────────────────────────

  describe('NPC 偏好物品（#4）', () => {
    it('商人应偏好珠宝类物品', () => {
      expect(system.isPreferredItem('merchant', 'item-gold-ingot')).toBe(true);
      expect(system.isPreferredItem('merchant', 'item-silk')).toBe(true);
    });

    it('商人应不偏好武器类物品', () => {
      expect(system.isDislikedItem('merchant', 'item-iron-sword')).toBe(true);
    });

    it('谋士应偏好书籍类物品', () => {
      expect(system.isPreferredItem('strategist', 'item-art-of-war')).toBe(true);
    });

    it('武将应偏好武器类物品', () => {
      expect(system.isPreferredItem('warrior', 'item-iron-sword')).toBe(true);
    });

    it('旅人应偏好食物类物品', () => {
      expect(system.isPreferredItem('traveler', 'item-wine')).toBe(true);
    });

    it('获取偏好配置', () => {
      const pref = system.getPreference('merchant');
      expect(pref).toBeDefined();
      expect(pref!.preferredCategories).toContain('jewelry');
    });

    it('获取推荐物品列表', () => {
      const recommended = system.getRecommendedItems('merchant');
      expect(recommended.length).toBeGreaterThan(0);
      // 偏好物品应排在前面
      const jewelryItems = recommended.filter((i) => i.category === 'jewelry');
      const nonPreferred = recommended.filter((i) => i.category === 'weapon');
      if (jewelryItems.length > 0 && nonPreferred.length > 0) {
        const firstJewelryIdx = recommended.indexOf(jewelryItems[0]);
        const firstWeaponIdx = recommended.indexOf(nonPreferred[0]);
        expect(firstJewelryIdx).toBeLessThan(firstWeaponIdx);
      }
    });
  });

  // ─── 赠送系统 ──────────────────────────────

  describe('赠送系统（#3）', () => {
    it('应该能成功赠送物品', () => {
      const result = system.giveGift({
        npcId: 'npc-merchant-01',
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(true);
      expect(result.affinityDelta).toBeGreaterThan(0);
      expect(result.reactionText).toBeTruthy();
    });

    it('赠送不存在的物品应失败', () => {
      const result = system.giveGift({
        npcId: 'npc-merchant-01',
        itemId: 'nonexistent',
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toContain('物品不存在');
    });

    it('赠送应记录历史', () => {
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      const history = system.getGiftHistory();
      expect(history).toHaveLength(1);
      expect(history[0].itemId).toBe('item-wine');
    });

    it('赠送应增加每日计数', () => {
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      expect(system.getDailyGiftCount()).toBe(1);
    });

    it('赠送应发出 npc:gift_given 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      registerTestItems(system);

      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:gift_given',
        expect.objectContaining({
          npcId: 'npc-merchant-01',
          itemId: 'item-wine',
        }),
      );
    });

    it('按NPC查询赠送历史', () => {
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-silk', quantity: 1 });

      const history = system.getGiftHistory('npc-merchant-01');
      expect(history).toHaveLength(2);
    });

    it('限制历史返回条数', () => {
      for (let i = 0; i < 5; i++) {
        system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      }
      const history = system.getGiftHistory(undefined, 3);
      expect(history).toHaveLength(3);
    });
  });

  // ─── 好感度计算 ────────────────────────────

  describe('好感度计算', () => {
    it('偏好物品应有更高加成', () => {
      // 商人偏好珠宝
      const normalDelta = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'item-iron-sword', category: 'weapon', rarity: 'common', baseAffinityValue: 10 }),
        1,
      );
      const preferredDelta = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'item-gold-ingot', category: 'jewelry', rarity: 'common', baseAffinityValue: 10 }),
        1,
      );

      expect(preferredDelta).toBeGreaterThan(normalDelta);
    });

    it('不喜欢物品应降低加成', () => {
      const normalDelta = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'food', rarity: 'common', baseAffinityValue: 10 }),
        1,
      );
      const dislikedDelta = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'weapon', rarity: 'common', baseAffinityValue: 10 }),
        1,
      );

      expect(dislikedDelta).toBeLessThan(normalDelta);
    });

    it('稀有度越高加成越高', () => {
      const common = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'food', rarity: 'common', baseAffinityValue: 2 }),
        1,
      );
      const rare = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'food', rarity: 'rare', baseAffinityValue: 2 }),
        1,
      );
      const legendary = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'food', rarity: 'legendary', baseAffinityValue: 2 }),
        1,
      );

      // common=2, rare=2*2=4, legendary=2*5=10
      expect(rare).toBeGreaterThan(common);
      expect(legendary).toBeGreaterThan(rare);
    });

    it('数量增加应增加好感度', () => {
      const single = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'food', rarity: 'common', baseAffinityValue: 5 }),
        1,
      );
      const triple = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'food', rarity: 'common', baseAffinityValue: 5 }),
        3,
      );

      expect(triple).toBeGreaterThan(single);
    });

    it('连续赠送同一物品应有衰减', () => {
      // 先赠送几次
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });

      // 计算衰减后的值
      const delta = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'item-wine', category: 'drink', rarity: 'common', baseAffinityValue: 5 }),
        1,
      );

      // 衰减后应低于基础值
      expect(delta).toBeLessThan(5);
    });

    it('好感度不应超过单次上限', () => {
      const delta = system.calculateAffinityDelta(
        'merchant',
        createItem({ id: 'test', category: 'food', rarity: 'legendary', baseAffinityValue: 100 }),
        10,
      );

      const config = system.getConfig();
      expect(delta).toBeLessThanOrEqual(config.maxAffinityPerGift);
    });
  });

  // ─── 配置 ──────────────────────────────────

  describe('配置', () => {
    it('getConfig 应返回配置', () => {
      const config = system.getConfig();
      expect(config).toHaveProperty('maxAffinityPerGift');
      expect(config).toHaveProperty('dailyGiftLimit');
    });

    it('setConfig 应更新配置', () => {
      system.setConfig({ dailyGiftLimit: 3 });
      const config = system.getConfig();
      expect(config.dailyGiftLimit).toBe(3);
    });

    it('setCurrentTurn 应设置回合', () => {
      system.setCurrentTurn(10);
      expect(system.getCurrentTurn()).toBe(10);
    });

    it('resetDailyGiftCount 应重置计数', () => {
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      system.resetDailyGiftCount();
      expect(system.getDailyGiftCount()).toBe(0);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('导出后导入应保持一致', () => {
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-wine', quantity: 1 });
      system.giveGift({ npcId: 'npc-merchant-01', itemId: 'item-silk', quantity: 1 });

      const data = system.exportSaveData();

      const newSystem = createSystem();
      newSystem.importSaveData(data);

      expect(newSystem.getGiftHistory()).toHaveLength(2);
      expect(newSystem.getDailyGiftCount()).toBe(2);
    });

    it('空系统导出导入不应出错', () => {
      const data = system.exportSaveData();
      const newSystem = createSystem();
      expect(() => newSystem.importSaveData(data)).not.toThrow();
    });
  });
});
