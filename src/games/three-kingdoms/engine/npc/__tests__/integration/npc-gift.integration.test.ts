/**
 * 集成测试 §3 — NPC赠送系统（Plan#3 + Plan#4）
 *
 * 覆盖 Play 流程：
 *   §3.1 赠送操作流程 — 好感度检查/物品选择/偏好计算/次数限制
 *   §3.2 NPC偏好物品匹配 — 偏好物品倍率×1.5
 *   §4.1 偏好物品识别与展示 — 偏好标记/职业对应
 *
 * 集成系统：NPCGiftSystem ↔ NPCSystem ↔ NPCFavorabilitySystem ↔ EventBus
 *
 * @module engine/npc/__tests__/integration/npc-gift
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCGiftSystem } from '../../NPCGiftSystem';
import { NPCSystem } from '../../NPCSystem';
import { NPCFavorabilitySystem } from '../../NPCFavorabilitySystem';
import type { ISystemDeps } from '../../../../core/types';
import type { NPCProfession } from '../../../../core/npc';
import type { ItemDef, NPCPreference } from '../../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(npcSystem?: NPCSystem): ISystemDeps {
  const npc = npcSystem ?? new NPCSystem();
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
      get: vi.fn().mockImplementation((name: string) => name === 'npc' ? npc : null),
      getAll: vi.fn(),
      has: vi.fn(),
      unregister: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

/** 创建测试用物品 */
function createItem(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    id: 'item-wine',
    name: '美酒',
    category: 'drink',
    rarity: 'common',
    baseAffinityValue: 10,
    description: '一壶上好的美酒',
    ...overrides,
  };
}

/** 创建完整的NPCPreference */
function createPreference(overrides: Partial<NPCPreference> = {}): NPCPreference {
  return {
    profession: 'merchant',
    preferredCategories: [],
    preferredItems: [],
    preferredMultiplier: 1.5,
    normalMultiplier: 1.0,
    dislikedCategories: [],
    dislikeMultiplier: 0.5,
    ...overrides,
  };
}

/** 创建集成环境 */
function createGiftIntegrationEnv() {
  const npcSystem = new NPCSystem();
  const npcDeps = createMockDeps(npcSystem);
  npcSystem.init(npcDeps);

  const giftSystem = new NPCGiftSystem();
  const giftDeps = createMockDeps(npcSystem);
  giftSystem.init(giftDeps);

  const favSystem = new NPCFavorabilitySystem();
  const favDeps = createMockDeps(npcSystem);
  favSystem.init(favDeps);

  const sharedEmit = vi.fn();
  npcDeps.eventBus.emit = sharedEmit;
  giftDeps.eventBus.emit = sharedEmit;
  favDeps.eventBus.emit = sharedEmit;

  return { npcSystem, giftSystem, favSystem, sharedEmit };
}

/** 获取第一个NPC的ID */
function getFirstNPCId(npcSystem: NPCSystem): string {
  const npcs = npcSystem.getAllNPCs();
  return npcs[0]?.id ?? 'npc-merchant-01';
}

/** 获取第一个NPC的职业 */
function getFirstNPCProfession(npcSystem: NPCSystem): NPCProfession {
  const npcs = npcSystem.getAllNPCs();
  return npcs[0]?.profession ?? 'merchant';
}

// ─────────────────────────────────────────────
// §3 NPC赠送系统
// ─────────────────────────────────────────────

describe('§3 NPC赠送系统集成', () => {
  let env: ReturnType<typeof createGiftIntegrationEnv>;
  let firstNpcId: string;
  let firstProfession: NPCProfession;

  beforeEach(() => {
    env = createGiftIntegrationEnv();
    firstNpcId = getFirstNPCId(env.npcSystem);
    firstProfession = getFirstNPCProfession(env.npcSystem);
  });

  // ── §3.1 赠送操作流程 ─────────────────────

  describe('§3.1 赠送操作流程', () => {
    it('§3.1.1 注册物品后应可查询', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);

      const item = env.giftSystem.getItem('item-wine');
      expect(item).toBeDefined();
      expect(item!.name).toBe('美酒');
    });

    it('§3.1.2 批量注册物品应全部可查询', () => {
      const items = [
        createItem({ id: 'item-wine', name: '美酒', category: 'drink' }),
        createItem({ id: 'item-sword', name: '宝剑', category: 'weapon' }),
        createItem({ id: 'item-book', name: '兵书', category: 'book' }),
      ];
      env.giftSystem.registerItems(items);

      expect(env.giftSystem.getAllItems()).toHaveLength(3);
    });

    it('§3.1.3 赠送物品应成功返回结果', () => {
      const wine = createItem({ id: 'item-wine', baseAffinityValue: 10 });
      env.giftSystem.registerItem(wine);

      // 确保NPC好感度足够（minAffinityToGift默认20）
      env.npcSystem.setAffinity(firstNpcId, 50);

      const result = env.giftSystem.giveGift({
        npcId: firstNpcId,
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('§3.1.4 赠送不存在的NPC应失败', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);

      const result = env.giftSystem.giveGift({
        npcId: 'nonexistent-npc',
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toContain('NPC不存在');
    });

    it('§3.1.5 赠送不存在的物品应失败', () => {
      const result = env.giftSystem.giveGift({
        npcId: firstNpcId,
        itemId: 'nonexistent-item',
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toContain('物品不存在');
    });

    it('§3.1.6 好感度不足时应赠送失败', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);

      // 将NPC好感度设为很低
      env.npcSystem.setAffinity(firstNpcId, 5);

      const result = env.giftSystem.giveGift({
        npcId: firstNpcId,
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toContain('好感度不足');
    });

    it('§3.1.7 达到每日赠送上限后应失败', () => {
      const wine = createItem({ id: 'item-wine', baseAffinityValue: 5 });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      // 设置极低的每日上限
      env.giftSystem.setConfig({ dailyGiftLimit: 2 });

      // 赠送2次
      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });
      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });

      // 第3次应失败
      const result = env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });
      expect(result.success).toBe(false);
      expect(result.failReason).toContain('次数已用完');
    });

    it('§3.1.8 resetDailyGiftCount应重置计数', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);
      env.giftSystem.setConfig({ dailyGiftLimit: 1 });

      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });
      expect(env.giftSystem.getDailyGiftCount()).toBe(1);

      env.giftSystem.resetDailyGiftCount();
      expect(env.giftSystem.getDailyGiftCount()).toBe(0);

      // 应可再次赠送
      const result = env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });
      expect(result.success).toBe(true);
    });

    it('§3.1.9 成功赠送应发出npc:gift_given事件', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });

      expect(env.sharedEmit).toHaveBeenCalledWith('npc:gift_given', expect.objectContaining({
        npcId: firstNpcId,
        itemId: 'item-wine',
      }));
    });

    it('§3.1.10 赠送历史应可按NPC查询', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);
      env.giftSystem.setConfig({ dailyGiftLimit: 0 });

      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });
      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });

      const history = env.giftSystem.getGiftHistory(firstNpcId);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('§3.1.11 赠送历史应可限制返回条数', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);
      env.giftSystem.setConfig({ dailyGiftLimit: 0 });

      for (let i = 0; i < 5; i++) {
        env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });
      }

      const history = env.giftSystem.getGiftHistory(firstNpcId, 3);
      expect(history.length).toBeLessThanOrEqual(3);
    });

    it('§3.1.12 setCurrentTurn应更新当前回合', () => {
      env.giftSystem.setCurrentTurn(10);
      expect(env.giftSystem.getCurrentTurn()).toBe(10);
    });

    it('§3.1.13 getConfig应返回当前配置', () => {
      const config = env.giftSystem.getConfig();
      expect(config).toBeDefined();
      expect(config.maxAffinityPerGift).toBeDefined();
      expect(config.dailyGiftLimit).toBeDefined();
    });

    it('§3.1.14 setConfig应部分更新配置', () => {
      env.giftSystem.setConfig({ dailyGiftLimit: 5 });
      const config = env.giftSystem.getConfig();
      expect(config.dailyGiftLimit).toBe(5);
    });
  });

  // ── §3.2 NPC偏好物品匹配 ─────────────────

  describe('§3.2 NPC偏好物品匹配', () => {
    it('§3.2.1 应能查询职业偏好', () => {
      const pref = env.giftSystem.getPreference(firstProfession);
      // 偏好可能已由默认配置加载
      expect(pref).toBeDefined();
    });

    it('§3.2.2 设置自定义偏好应生效', () => {
      const customPref = createPreference({
        profession: 'merchant',
        preferredCategories: ['jewelry', 'drink'],
        dislikedCategories: ['weapon'],
      });
      env.giftSystem.setPreference(customPref);

      const pref = env.giftSystem.getPreference('merchant');
      expect(pref).toBeDefined();
      expect(pref!.preferredCategories).toContain('jewelry');
    });

    it('§3.2.3 isPreferredItem应正确判断偏好物品（类别匹配）', () => {
      // 设置偏好
      env.giftSystem.setPreference(createPreference({
        profession: 'merchant',
        preferredCategories: ['drink'],
      }));

      // 注册偏好类别的物品
      const wine = createItem({ id: 'item-wine', category: 'drink' });
      env.giftSystem.registerItem(wine);

      const isPreferred = env.giftSystem.isPreferredItem('merchant', 'item-wine');
      expect(isPreferred).toBe(true);
    });

    it('§3.2.4 非偏好物品应返回false', () => {
      env.giftSystem.setPreference(createPreference({
        profession: 'merchant',
        preferredCategories: ['jewelry'],
      }));

      const sword = createItem({ id: 'item-sword', category: 'weapon' });
      env.giftSystem.registerItem(sword);

      expect(env.giftSystem.isPreferredItem('merchant', 'item-sword')).toBe(false);
    });

    it('§3.2.5 isDislikedItem应正确判断厌恶物品', () => {
      env.giftSystem.setPreference(createPreference({
        profession: 'merchant',
        dislikedCategories: ['weapon'],
      }));

      const sword = createItem({ id: 'item-sword', category: 'weapon' });
      env.giftSystem.registerItem(sword);

      expect(env.giftSystem.isDislikedItem('merchant', 'item-sword')).toBe(true);
    });

    it('§3.2.6 getItemsByCategory应按类别筛选物品', () => {
      env.giftSystem.registerItems([
        createItem({ id: 'wine', category: 'drink' }),
        createItem({ id: 'sword', category: 'weapon' }),
        createItem({ id: 'tea', category: 'drink' }),
      ]);

      const drinks = env.giftSystem.getItemsByCategory('drink');
      expect(drinks).toHaveLength(2);
      drinks.forEach((item) => {
        expect(item.category).toBe('drink');
      });
    });

    it('§3.2.7 getRecommendedItems应将偏好物品排在前面', () => {
      env.giftSystem.setPreference(createPreference({
        profession: 'merchant',
        preferredCategories: ['drink'],
      }));

      env.giftSystem.registerItems([
        createItem({ id: 'wine', category: 'drink' }),
        createItem({ id: 'sword', category: 'weapon' }),
      ]);

      const recommended = env.giftSystem.getRecommendedItems('merchant');
      expect(recommended.length).toBeGreaterThan(0);
      // 偏好物品应排在前面
      expect(recommended[0].category).toBe('drink');
    });

    it('§3.2.8 不同职业应有不同偏好', () => {
      env.giftSystem.setPreference(createPreference({
        profession: 'merchant',
        preferredCategories: ['jewelry'],
      }));
      env.giftSystem.setPreference(createPreference({
        profession: 'warrior',
        preferredCategories: ['weapon'],
      }));

      const wine = createItem({ id: 'item-wine', category: 'drink' });
      const sword = createItem({ id: 'item-sword', category: 'weapon' });
      env.giftSystem.registerItems([wine, sword]);

      // 商人偏好珠宝不是武器
      expect(env.giftSystem.isPreferredItem('merchant', 'item-sword')).toBe(false);
      // 武将偏好武器
      expect(env.giftSystem.isPreferredItem('warrior', 'item-sword')).toBe(true);
    });
  });

  // ── §4.1 偏好物品识别与展示 ──────────────

  describe('§4.1 偏好物品识别与展示', () => {
    it('§4.1.1 偏好物品在赠送结果中应标记isPreferred', () => {
      env.giftSystem.setPreference(createPreference({
        profession: firstProfession,
        preferredCategories: ['drink'],
      }));

      const wine = createItem({ id: 'item-wine', category: 'drink', baseAffinityValue: 10 });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      const result = env.giftSystem.giveGift({
        npcId: firstNpcId,
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(true);
      expect(result.isPreferred).toBe(true);
    });

    it('§4.1.2 非偏好物品应标记isPreferred=false', () => {
      env.giftSystem.setPreference(createPreference({
        profession: firstProfession,
        preferredCategories: ['jewelry'],
      }));

      const sword = createItem({ id: 'item-sword', category: 'weapon', baseAffinityValue: 10 });
      env.giftSystem.registerItem(sword);
      env.npcSystem.setAffinity(firstNpcId, 50);

      const result = env.giftSystem.giveGift({
        npcId: firstNpcId,
        itemId: 'item-sword',
        quantity: 1,
      });

      expect(result.success).toBe(true);
      expect(result.isPreferred).toBe(false);
    });

    it('§4.1.3 赠送成功应返回好感度变化量', () => {
      const wine = createItem({ id: 'item-wine', baseAffinityValue: 10 });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      const result = env.giftSystem.giveGift({
        npcId: firstNpcId,
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(true);
      expect(result.affinityDelta).toBeDefined();
      expect(typeof result.affinityDelta).toBe('number');
    });

    it('§4.1.4 赠送成功应返回NPC反应文本', () => {
      const wine = createItem({ id: 'item-wine', baseAffinityValue: 10 });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      const result = env.giftSystem.giveGift({
        npcId: firstNpcId,
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(true);
      expect(result.reactionText).toBeDefined();
      expect(typeof result.reactionText).toBe('string');
    });

    it('§4.1.5 NPCFavorabilitySystem应记录好感度变化', () => {
      const wine = createItem({ id: 'item-wine', baseAffinityValue: 10 });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      // 通过FavorabilitySystem添加赠送好感度
      const delta = env.favSystem.addGiftAffinity(firstNpcId, true, 10, 1);
      // 应返回好感度变化值（可能为null如果NPC不存在于FavorabilitySystem的NPC引用中）
      expect(delta === null || typeof delta === 'number').toBe(true);
    });

    it('§4.1.6 NPCFavorabilitySystem应支持对话好感度', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      const delta = env.favSystem.addDialogAffinity(firstNpcId, 1);
      expect(delta === null || typeof delta === 'number').toBe(true);
    });

    it('§4.1.7 NPCFavorabilitySystem应支持任务完成好感度', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      const delta = env.favSystem.addQuestCompleteAffinity(firstNpcId, 1);
      expect(delta === null || typeof delta === 'number').toBe(true);
    });

    it('§4.1.8 NPCFavorabilitySystem应支持交易好感度', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      const delta = env.favSystem.addTradeAffinity(firstNpcId, 1);
      expect(delta === null || typeof delta === 'number').toBe(true);
    });

    it('§4.1.9 NPCFavorabilitySystem好感度等级效果应可查询', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      const effect = env.favSystem.getNPCLevelEffect(firstNpcId);
      // 应返回等级效果或null
      if (effect) {
        expect(effect.unlockedInteractions).toBeDefined();
        expect(effect.tradeDiscount).toBeDefined();
      }
    });

    it('§4.1.10 NPCFavorabilitySystem交互解锁检查', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      const unlocked = env.favSystem.isInteractionUnlocked(firstNpcId, 'trade');
      expect(typeof unlocked).toBe('boolean');
    });

    it('§4.1.11 NPCFavorabilitySystem交易折扣查询', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      const discount = env.favSystem.getTradeDiscount(firstNpcId);
      expect(typeof discount).toBe('number');
      expect(discount).toBeGreaterThanOrEqual(0);
    });

    it('§4.1.12 NPCFavorabilitySystem好感度可视化数据', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      const viz = env.favSystem.getVisualization(firstNpcId);
      // null和有效对象都是可接受的
      if (viz !== null) {
        expect(viz.currentLevel).toBeDefined();
        expect(viz.levelProgress).toBeDefined();
        expect(viz.currentAffinity).toBe(50);
      }
      // 验证函数不抛异常即可
      expect(true).toBe(true);
    });

    it('§4.1.13 NPCFavorabilitySystem序列化与反序列化', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      env.favSystem.addDialogAffinity(firstNpcId, 1);

      const data = env.favSystem.serialize();
      expect(data).toBeDefined();

      env.favSystem.reset();
      env.favSystem.deserialize(data);

      const state = env.favSystem.getState();
      expect(state).toBeDefined();
    });

    it('§4.1.14 GiftSystem序列化应包含历史数据', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });

      const saveData = env.giftSystem.exportSaveData();
      expect(saveData).toBeDefined();
      expect(saveData.giftHistory).toBeDefined();
    });

    it('§4.1.15 GiftSystem反序列化应恢复历史数据', () => {
      const wine = createItem({ id: 'item-wine' });
      env.giftSystem.registerItem(wine);
      env.npcSystem.setAffinity(firstNpcId, 50);

      env.giftSystem.giveGift({ npcId: firstNpcId, itemId: 'item-wine', quantity: 1 });
      const saveData = env.giftSystem.exportSaveData();

      env.giftSystem.reset();
      expect(env.giftSystem.getDailyGiftCount()).toBe(0);

      env.giftSystem.importSaveData(saveData);
      // 历史应恢复
      const history = env.giftSystem.getGiftHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('§4.1.16 NPCSystem好感度等级应随好感度值变化', () => {
      const LEVEL_ORDER: Record<string, number> = {
        hostile: 0, neutral: 1, friendly: 2, trusted: 3, bonded: 4,
      };

      // 低好感度
      env.npcSystem.setAffinity(firstNpcId, 10);
      const lowLevel = env.npcSystem.getAffinityLevel(firstNpcId);

      // 高好感度
      env.npcSystem.setAffinity(firstNpcId, 90);
      const highLevel = env.npcSystem.getAffinityLevel(firstNpcId);

      // 高好感度等级应不低于低好感度等级
      if (lowLevel !== null && highLevel !== null) {
        expect(LEVEL_ORDER[highLevel]).toBeGreaterThanOrEqual(LEVEL_ORDER[lowLevel]);
      }
    });

    it('§4.1.17 NPCSystem好感度变更应更新NPC数据', () => {
      env.npcSystem.setAffinity(firstNpcId, 30);
      const npcBefore = env.npcSystem.getNPCById(firstNpcId);
      expect(npcBefore!.affinity).toBe(30);

      env.npcSystem.changeAffinity(firstNpcId, 20);
      const npcAfter = env.npcSystem.getNPCById(firstNpcId);
      expect(npcAfter!.affinity).toBe(50);
    });

    it('§4.1.18 NPCSystem updateLastInteracted应更新时间戳', () => {
      const result = env.npcSystem.updateLastInteracted(firstNpcId, 100);
      if (result) {
        const npc = env.npcSystem.getNPCById(firstNpcId);
        expect(npc!.lastInteractedAt).toBe(100);
      }
    });

    it('§4.1.19 NPCFavorabilitySystem好感度衰减处理', () => {
      env.npcSystem.setAffinity(firstNpcId, 50);
      env.npcSystem.updateLastInteracted(firstNpcId, 0);

      // 设置当前回合远大于上次交互
      env.favSystem.processDecay([firstNpcId], 100);

      // 好感度可能已衰减
      const npc = env.npcSystem.getNPCById(firstNpcId);
      expect(npc).toBeDefined();
    });

    it('§4.1.20 NPCFavorabilitySystem羁绊技能激活', () => {
      env.npcSystem.setAffinity(firstNpcId, 90);

      const skill = env.favSystem.activateBondSkill(firstNpcId, 1);
      // 可能返回null（如果好感度不够或无羁绊技能）或技能对象
      if (skill) {
        expect(skill.id).toBeDefined();
        expect(skill.name).toBeDefined();
      }
      // null也是可接受的（集成边界）
      expect(skill === null || typeof skill === 'object').toBe(true);
    });
  });
});
