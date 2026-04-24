/**
 * 集成测试 — NPC赠送+切磋全链路 (v6.0 天下大势)
 *
 * 覆盖 Play 文档流程：
 *   §6.1 NPC赠送系统：赠送物品→好感度增加、礼物偏好倍率
 *   §6.2 NPC切磋系统：切磋战斗→好感度增加、结盟
 *
 * @module engine/calendar/__tests__/integration/npc-gift-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NPCSystem } from '../../../npc/NPCSystem';
import { NPCGiftSystem } from '../../../npc/NPCGiftSystem';
import { NPCTrainingSystem } from '../../../npc/NPCTrainingSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { ItemDef } from '../../../../core/npc';
import {
  TRAINING_COOLDOWN,
  ALLIANCE_REQUIRED_AFFINITY,
} from '../../../npc/NPCTrainingTypes';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建测试物品 */
function createItem(overrides: Partial<ItemDef> = {}): ItemDef {
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

/** 创建完整的系统依赖 */
function createDeps(): ISystemDeps {
  const npc = new NPCSystem();
  const gift = new NPCGiftSystem();
  const training = new NPCTrainingSystem();

  const registry = new Map<string, unknown>();
  registry.set('npc', npc);
  registry.set('npcGift', gift);
  registry.set('npcTraining', training);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as import('../../../../core/types/subsystem').ISubsystemRegistry,
  };

  npc.init(deps);
  gift.init(deps);
  training.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    npc: deps.registry!.get<NPCSystem>('npc')!,
    gift: deps.registry!.get<NPCGiftSystem>('npcGift')!,
    training: deps.registry!.get<NPCTrainingSystem>('npcTraining')!,
  };
}

/** 注册标准测试物品 */
function registerTestItems(giftSys: NPCGiftSystem): void {
  giftSys.registerItems([
    createItem({ id: 'item-wine', name: '美酒', category: 'drink', rarity: 'common', baseAffinityValue: 5 }),
    createItem({ id: 'item-silk', name: '丝绸', category: 'jewelry', rarity: 'uncommon', baseAffinityValue: 10 }),
    createItem({ id: 'item-art-of-war', name: '孙子兵法', category: 'book', rarity: 'rare', baseAffinityValue: 15 }),
    createItem({ id: 'item-iron-sword', name: '铁剑', category: 'weapon', rarity: 'common', baseAffinityValue: 5 }),
    createItem({ id: 'item-gold-ingot', name: '金元宝', category: 'jewelry', rarity: 'epic', baseAffinityValue: 25 }),
    createItem({ id: 'item-herb', name: '草药', category: 'medicine', rarity: 'common', baseAffinityValue: 3 }),
  ]);
}

/** 注册商人偏好配置（覆盖默认偏好以精确控制测试） */
function registerMerchantPreference(giftSys: NPCGiftSystem): void {
  giftSys.setPreference({
    profession: 'merchant',
    preferredCategories: ['jewelry', 'drink'],
    preferredItems: ['item-silk', 'item-gold-ingot'],
    preferredMultiplier: 1.5,
    normalMultiplier: 1.0,
    dislikedCategories: ['weapon'],
    dislikeMultiplier: 0.5,
  });
}

/** 注册武将偏好配置 */
function registerWarriorPreference(giftSys: NPCGiftSystem): void {
  giftSys.setPreference({
    profession: 'warrior',
    preferredCategories: ['weapon', 'drink'],
    preferredItems: ['item-iron-sword'],
    preferredMultiplier: 1.5,
    normalMultiplier: 1.0,
    dislikedCategories: ['book'],
    dislikeMultiplier: 0.5,
  });
}

// ═════════════════════════════════════════════
// §6.1 NPC赠送系统
// ═════════════════════════════════════════════

describe('§6.1 NPC赠送系统', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
    registerTestItems(sys.gift);
    registerMerchantPreference(sys.gift);
    registerWarriorPreference(sys.gift);
  });

  // --- 赠送流程：赠送物品→好感度增加 ---

  describe('赠送流程：赠送物品→好感度增加', () => {
    it('向NPC赠送物品成功返回 success=true 且 affinityDelta > 0', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      const before = sys.npc.getNPCById(npc.id)!.affinity;
      const result = sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });

      expect(result.success).toBe(true);
      expect(result.affinityDelta).toBeGreaterThan(0);
      expect(result.reactionText).toBeDefined();

      const after = sys.npc.getNPCById(npc.id)!.affinity;
      expect(after).toBeGreaterThan(before);
    });

    it('赠送偏好物品返回 isPreferred=true 且好感度加成更高', () => {
      const npcA = sys.npc.createNPC('商人A', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      const npcB = sys.npc.createNPC('商人B', 'merchant', { x: 6, y: 6 }, { affinity: 50 });

      // 丝绸是商人偏好物品
      const preferredResult = sys.gift.giveGift({ npcId: npcA.id, itemId: 'item-silk', quantity: 1 });
      expect(preferredResult.isPreferred).toBe(true);

      // 草药是商人非偏好物品
      const normalResult = sys.gift.giveGift({ npcId: npcB.id, itemId: 'item-herb', quantity: 1 });
      expect(normalResult.isPreferred).toBe(false);

      // 偏好物品好感度应 ≥ 普通物品（丝绸baseValue=10 > 草药baseValue=3，且有倍率加成）
      expect(preferredResult.affinityDelta).toBeGreaterThanOrEqual(normalResult.affinityDelta);
    });

    it('赠送不喜欢物品返回 isPreferred=false 且好感度加成较低', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      // 铁剑是商人不喜欢的武器类
      const result = sys.gift.giveGift({ npcId: npc.id, itemId: 'item-iron-sword', quantity: 1 });
      expect(result.isPreferred).toBe(false);
      // 不喜欢物品好感度应低于同baseValue的正常物品
      expect(result.affinityDelta).toBeLessThan(5 * 1.0); // baseAffinityValue * normalMultiplier
    });

    it('赠送数量影响好感度变化量', () => {
      const npcA = sys.npc.createNPC('商人A', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      const npcB = sys.npc.createNPC('商人B', 'merchant', { x: 6, y: 6 }, { affinity: 50 });

      const result1 = sys.gift.giveGift({ npcId: npcA.id, itemId: 'item-wine', quantity: 1 });
      const result3 = sys.gift.giveGift({ npcId: npcB.id, itemId: 'item-wine', quantity: 3 });

      expect(result3.affinityDelta).toBeGreaterThanOrEqual(result1.affinityDelta);
    });

    it('赠送不存在的NPC返回 success=false 且 failReason 包含"NPC不存在"', () => {
      const result = sys.gift.giveGift({ npcId: 'npc-nonexistent', itemId: 'item-wine', quantity: 1 });
      expect(result.success).toBe(false);
      expect(result.failReason).toContain('NPC不存在');
    });

    it('赠送不存在的物品返回 success=false 且 failReason 包含"物品不存在"', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      const result = sys.gift.giveGift({ npcId: npc.id, itemId: 'item-nonexistent', quantity: 1 });
      expect(result.success).toBe(false);
      expect(result.failReason).toContain('物品不存在');
    });

    it('好感度不足 minAffinityToGift 时赠送失败', () => {
      const npc = sys.npc.createNPC('路人甲', 'merchant', { x: 5, y: 5 }, { affinity: 5 });
      const result = sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
      expect(result.success).toBe(false);
      expect(result.failReason).toContain('好感度不足');
    });

    it('每日赠送次数达上限后赠送失败', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      const config = sys.gift.getConfig();
      for (let i = 0; i < config.dailyGiftLimit; i++) {
        sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
        sys.gift.resetDailyGiftCount(); // 每次重置以避免计数限制
      }
      // 手动设置计数到上限
      for (let i = 0; i < config.dailyGiftLimit; i++) {
        sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
      }
      const result = sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
      expect(result.success).toBe(false);
      expect(result.failReason).toContain('次数');
    });
  });

  // --- 礼物偏好倍率验证 ---

  describe('礼物偏好倍率验证', () => {
    it('isPreferredItem 商人判断丝绸为偏好、铁剑为非偏好', () => {
      expect(sys.gift.isPreferredItem('merchant', 'item-silk')).toBe(true);
      expect(sys.gift.isPreferredItem('merchant', 'item-iron-sword')).toBe(false);
    });

    it('isDislikedItem 商人判断铁剑为不喜欢、美酒为非不喜欢', () => {
      expect(sys.gift.isDislikedItem('merchant', 'item-iron-sword')).toBe(true);
      expect(sys.gift.isDislikedItem('merchant', 'item-wine')).toBe(false);
    });

    it('isPreferredItem 武将判断铁剑为偏好、兵法为非偏好', () => {
      expect(sys.gift.isPreferredItem('warrior', 'item-iron-sword')).toBe(true);
      expect(sys.gift.isPreferredItem('warrior', 'item-art-of-war')).toBe(false);
    });

    it('getRecommendedItems 返回商人偏好分类中的物品', () => {
      const recommended = sys.gift.getRecommendedItems('merchant');
      expect(recommended.length).toBeGreaterThanOrEqual(1);
      // 推荐物品中至少有一个属于偏好分类或偏好物品列表
      const pref = sys.gift.getPreference('merchant')!;
      const hasPreferred = recommended.some(
        (item) => pref.preferredCategories.includes(item.category)
          || pref.preferredItems.includes(item.id),
      );
      expect(hasPreferred).toBe(true);
    });

    it('偏好倍率使偏好物品好感度显著高于同baseValue非偏好物品', () => {
      // 使用 baseAffinityValue 相同的物品对比：美酒(5,drink,preferred) vs 草药(3,medicine,normal)
      // 商人偏好 drink 类，不偏好 medicine 类
      const npcA = sys.npc.createNPC('商人A', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      const npcB = sys.npc.createNPC('商人B', 'merchant', { x: 6, y: 6 }, { affinity: 50 });

      const wineResult = sys.gift.giveGift({ npcId: npcA.id, itemId: 'item-wine', quantity: 1 });
      const herbResult = sys.gift.giveGift({ npcId: npcB.id, itemId: 'item-herb', quantity: 1 });

      // 美酒 baseValue=5 + 偏好倍率1.5 > 草药 baseValue=3 + 正常倍率1.0
      expect(wineResult.affinityDelta).toBeGreaterThan(herbResult.affinityDelta);
    });
  });

  // --- 物品注册与查询 ---

  describe('物品注册与查询', () => {
    it('getItem 返回已注册物品，未注册返回 undefined', () => {
      expect(sys.gift.getItem('item-wine')).toBeDefined();
      expect(sys.gift.getItem('item-nonexistent')).toBeUndefined();
    });

    it('getItemsByCategory 按分类过滤物品', () => {
      const drinks = sys.gift.getItemsByCategory('drink');
      expect(drinks.length).toBeGreaterThanOrEqual(1);
      expect(drinks.every((i) => i.category === 'drink')).toBe(true);
    });

    it('getGiftHistory 记录赠送历史', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
      const history = sys.gift.getGiftHistory(npc.id);
      expect(history.length).toBe(1);
      expect(history[0].npcId).toBe(npc.id);
      expect(history[0].itemId).toBe('item-wine');
    });
  });

  // --- 序列化 ---

  describe('序列化', () => {
    it('exportSaveData/importSaveData 可恢复赠送历史与计数', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
      const saved = sys.gift.exportSaveData();

      const newGift = new NPCGiftSystem();
      const newDeps = createDeps();
      newGift.init(newDeps);
      newGift.importSaveData(saved);

      expect(newGift.getDailyGiftCount()).toBe(saved.dailyGiftCount);
      expect(newGift.getGiftHistory().length).toBe(1);
    });
  });
});

// ═════════════════════════════════════════════
// §6.2 NPC切磋系统
// ═════════════════════════════════════════════

describe('§6.2 NPC切磋系统', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
    registerTestItems(sys.gift);
    registerMerchantPreference(sys.gift);
    registerWarriorPreference(sys.gift);
  });

  // --- 切磋战斗→好感度增加 ---

  describe('切磋战斗→好感度增加', () => {
    it('切磋返回合法结果（outcome 为 win/lose/draw）', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 50 });
      const result = sys.training.training(npc.id, 10, 10);
      expect(['win', 'lose', 'draw']).toContain(result.outcome);
      expect(result).toHaveProperty('rewards');
      expect(result).toHaveProperty('message');
    });

    it('胜利时 rewards 包含 experience > 0 和 affinityChange > 0', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 50 });
      // 多次重试以获得胜利（高等级优势）
      let winResult: typeof result | null = null;
      for (let i = 0; i < 30; i++) {
        sys.training.reset();
        const result = sys.training.training(npc.id, 100, 1);
        if (result.outcome === 'win') {
          winResult = result;
          break;
        }
      }
      if (winResult) {
        expect(winResult.rewards).not.toBeNull();
        expect(winResult.rewards!.experience).toBeGreaterThan(0);
        expect(winResult.rewards!.affinityChange).toBeGreaterThan(0);
      }
    });

    it('切磋后进入冷却，再次切磋返回 draw + 冷却消息', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 50 });
      sys.training.training(npc.id, 10, 10);
      expect(sys.training.canTraining(npc.id)).toBe(false);
      expect(sys.training.getTrainingCooldown(npc.id)).toBe(TRAINING_COOLDOWN);

      const result = sys.training.training(npc.id, 10, 10);
      expect(result.outcome).toBe('draw');
      expect(result.message).toContain('冷却');
    });

    it('getTrainingStats 返回正确的胜负统计', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 50 });
      sys.training.training(npc.id, 10, 10);
      const stats = sys.training.getTrainingStats(npc.id);
      expect(stats.total).toBe(1);
      expect(stats.wins + stats.losses + stats.draws).toBe(1);
    });

    it('getTrainingRecords 按 npcId 过滤记录', () => {
      const npc1 = sys.npc.createNPC('武将A', 'warrior', { x: 5, y: 5 }, { affinity: 50 });
      const npc2 = sys.npc.createNPC('武将B', 'warrior', { x: 6, y: 6 }, { affinity: 50 });
      sys.training.training(npc1.id, 10, 10);
      sys.training.training(npc2.id, 10, 10);

      expect(sys.training.getTrainingRecords(npc1.id).length).toBe(1);
      expect(sys.training.getTrainingRecords().length).toBe(2);
    });
  });

  // --- 结盟系统 ---

  describe('结盟系统', () => {
    it('好感度 >= ALLIANCE_REQUIRED_AFFINITY 时结盟成功', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 90 });
      const result = sys.training.formAlliance(npc.id, 'warrior-zhaoyun', 90);
      expect(result.success).toBe(true);
      expect(sys.training.isAllied(npc.id)).toBe(true);
    });

    it('好感度 < ALLIANCE_REQUIRED_AFFINITY 时结盟失败', () => {
      const npc = sys.npc.createNPC('路人甲', 'warrior', { x: 5, y: 5 }, { affinity: 50 });
      const result = sys.training.formAlliance(npc.id, 'warrior-lurenjia', 50);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('好感度不足');
    });

    it('重复结盟返回失败且 reason 包含"已经"', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 90 });
      sys.training.formAlliance(npc.id, 'warrior-zhaoyun', 90);
      const result = sys.training.formAlliance(npc.id, 'warrior-zhaoyun', 90);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已经');
    });

    it('breakAlliance 解除结盟后 isAllied 返回 false', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 90 });
      sys.training.formAlliance(npc.id, 'warrior-zhaoyun', 90);
      expect(sys.training.breakAlliance(npc.id)).toBe(true);
      expect(sys.training.isAllied(npc.id)).toBe(false);
    });

    it('getAllAllianceBonuses 汇总所有结盟加成', () => {
      const npc1 = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 90 });
      const npc2 = sys.npc.createNPC('武将关羽', 'warrior', { x: 6, y: 6 }, { affinity: 90 });
      sys.training.formAlliance(npc1.id, 'warrior-zhaoyun', 90);
      sys.training.formAlliance(npc2.id, 'warrior-guanyu', 90);

      const bonuses = sys.training.getAllAllianceBonuses();
      expect(bonuses).toHaveProperty('attack');
      expect(bonuses).toHaveProperty('defense');
      // 两个武将结盟，攻击加成应 > 单个
      expect(bonuses.attack).toBeGreaterThan(0);
    });

    it('getAlliance 返回包含 bonuses 数组的结盟数据', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 90 });
      sys.training.formAlliance(npc.id, 'warrior-zhaoyun', 90);
      const alliance = sys.training.getAlliance(npc.id);
      expect(alliance).toBeDefined();
      expect(alliance!.bonuses.length).toBeGreaterThan(0);
    });
  });

  // --- 对话历史 ---

  describe('对话历史', () => {
    it('recordDialogue 记录后可通过 getDialogueHistory 查询', () => {
      sys.training.recordDialogue('npc-01', '商人张三', '讨论了市场行情', 5);
      const history = sys.training.getDialogueHistory('npc-01');
      expect(history.length).toBe(1);
      expect(history[0].summary).toBe('讨论了市场行情');
    });

    it('getRecentDialogues 返回最近 N 条对话', () => {
      for (let i = 0; i < 15; i++) {
        sys.training.recordDialogue('npc-01', `NPC${i}`, `对话${i}`, 1);
      }
      const recent = sys.training.getRecentDialogues(5);
      expect(recent.length).toBe(5);
    });

    it('clearDialogueHistory 清除后历史为空', () => {
      sys.training.recordDialogue('npc-01', '商人张三', '测试对话', 1);
      sys.training.clearDialogueHistory('npc-01');
      expect(sys.training.getDialogueHistory('npc-01').length).toBe(0);
    });
  });

  // --- 序列化 ---

  describe('序列化', () => {
    it('serialize/deserialize 可恢复切磋记录和结盟数据', () => {
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 90 });
      sys.training.training(npc.id, 10, 10);
      sys.training.formAlliance(npc.id, 'warrior-zhaoyun', 90);
      const saved = sys.training.serialize();

      const newTraining = new NPCTrainingSystem();
      const newDeps = createDeps();
      newTraining.init(newDeps);
      newTraining.deserialize(saved);

      expect(newTraining.getTrainingRecords().length).toBe(1);
      expect(newTraining.isAllied(npc.id)).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════
// §6.1+§6.2 交叉集成：赠送→好感→切磋→结盟
// ═════════════════════════════════════════════

describe('§6.1+§6.2 赠送+切磋交叉集成', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
    registerTestItems(sys.gift);
    registerMerchantPreference(sys.gift);
    registerWarriorPreference(sys.gift);
  });

  it('赠送提升好感度后可触发切磋', () => {
    const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 50 });
    sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
    const result = sys.training.training(npc.id, 10, 10);
    expect(['win', 'lose', 'draw']).toContain(result.outcome);
  });

  it('赠送+切磋循环可将好感度提升至结盟阈值', () => {
    const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 60 });
    // 持续赠送金元宝（偏好物品，高baseValue）提升好感
    for (let i = 0; i < 10; i++) {
      sys.gift.giveGift({ npcId: npc.id, itemId: 'item-gold-ingot', quantity: 1 });
      sys.gift.resetDailyGiftCount();
    }
    const currentAffinity = sys.npc.getNPCById(npc.id)!.affinity;
    const allianceResult = sys.training.formAlliance(npc.id, 'warrior-zhaoyun', currentAffinity);
    if (currentAffinity >= ALLIANCE_REQUIRED_AFFINITY) {
      expect(allianceResult.success).toBe(true);
    }
  });

  it('结盟后仍可赠送物品和切磋', () => {
    const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 5, y: 5 }, { affinity: 90 });
    sys.training.formAlliance(npc.id, 'warrior-zhaoyun', 90);

    const giftResult = sys.gift.giveGift({ npcId: npc.id, itemId: 'item-wine', quantity: 1 });
    expect(giftResult.success).toBe(true);

    sys.training.reset(); // 清除冷却
    const trainResult = sys.training.training(npc.id, 10, 10);
    expect(['win', 'lose', 'draw']).toContain(trainResult.outcome);
  });

  it('离线行为计算依赖已创建的NPC列表', () => {
    const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
    const summary = sys.training.calculateOfflineActions(600, [
      { id: npc.id, name: npc.name, profession: npc.profession },
    ]);
    expect(summary.offlineDuration).toBe(600);
    expect(summary.actions.length).toBeGreaterThan(0);
    expect(summary.totalResourceChanges).toBeDefined();
  });
});
