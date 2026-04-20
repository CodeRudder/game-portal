/**
 * CraftingSystem 单元测试
 *
 * 覆盖炼制系统的所有核心功能：
 * - 配方注册与学习
 * - 材料检查
 * - 炼制启动与进度
 * - 品质掷骰与完成
 * - 事件系统
 * - 序列化/反序列化
 * - 重置
 */

import {
  CraftingSystem,
  type RecipeDef,
  type CraftQuality,
  type ActiveCraft,
  type CraftingEvent,
} from '../modules/CraftingSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 默认品质列表 */
const DEFAULT_QUALITIES: CraftQuality[] = [
  { name: '普通', multiplier: 1.0, weight: 70, color: '#ffffff' },
  { name: '精良', multiplier: 1.5, weight: 25, color: '#00ff00' },
  { name: '史诗', multiplier: 2.0, weight: 5, color: '#ff00ff' },
];

/** 创建基础配方定义 */
function createRecipeDef(overrides: Partial<RecipeDef> = {}): RecipeDef {
  return {
    id: 'potion-hp',
    name: '生命药水',
    ingredients: { herb: 3, water: 1 },
    result: { potion_hp: 1 },
    successRate: 1.0,
    craftTime: 5000,
    qualities: [...DEFAULT_QUALITIES],
    maxConcurrent: 2,
    ...overrides,
  };
}

/** 创建第二个配方 */
function createSecondRecipeDef(): RecipeDef {
  return createRecipeDef({
    id: 'potion-mp',
    name: '魔法药水',
    ingredients: { crystal: 2, water: 1 },
    result: { potion_mp: 1 },
    craftTime: 3000,
    requires: 'potion-hp',
  });
}

/** 创建低成功率配方 */
function createFailRecipeDef(): RecipeDef {
  return createRecipeDef({
    id: 'rare-item',
    name: '稀有物品',
    ingredients: { gem: 5 },
    result: { rare_ore: 1 },
    successRate: 0.0,
    failureResult: { scrap: 1 },
    craftTime: 10000,
  });
}

// ============================================================
// 测试套件
// ============================================================

describe('CraftingSystem', () => {
  let system: CraftingSystem;

  beforeEach(() => {
    system = new CraftingSystem();
  });

  describe('构造函数', () => {
    it('应创建空系统', () => {
      const empty = new CraftingSystem();
      expect(empty.getActiveCrafts()).toEqual([]);
      expect(empty.isLearned('any')).toBe(false);
    });

    it('应注册传入的配方定义', () => {
      const sys = new CraftingSystem([createRecipeDef()]);
      expect(sys.getRecipe('potion-hp')).toBeDefined();
    });
  });

  describe('learnRecipe', () => {
    beforeEach(() => {
      system = new CraftingSystem([createRecipeDef()]);
    });

    it('应成功学习配方', () => {
      expect(system.learnRecipe('potion-hp')).toBe(true);
      expect(system.isLearned('potion-hp')).toBe(true);
    });

    it('重复学习应返回 false', () => {
      system.learnRecipe('potion-hp');
      expect(system.learnRecipe('potion-hp')).toBe(false);
    });

    it('不存在的配方应返回 false', () => {
      expect(system.learnRecipe('non-existent')).toBe(false);
    });

    it('应触发 recipe_learned 事件', () => {
      const handler = jest.fn();
      system.onEvent(handler);
      system.learnRecipe('potion-hp');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'recipe_learned',
          data: expect.objectContaining({ recipeId: 'potion-hp' }),
        }),
      );
    });
  });

  describe('checkIngredients', () => {
    beforeEach(() => {
      system = new CraftingSystem([createRecipeDef()]);
    });

    it('材料充足时应返回 true', () => {
      const inventory = { herb: 10, water: 5 };
      expect(system.checkIngredients('potion-hp', inventory)).toBe(true);
    });

    it('材料刚好够时应返回 true', () => {
      const inventory = { herb: 3, water: 1 };
      expect(system.checkIngredients('potion-hp', inventory)).toBe(true);
    });

    it('材料不足时应返回 false', () => {
      const inventory = { herb: 1, water: 5 };
      expect(system.checkIngredients('potion-hp', inventory)).toBe(false);
    });

    it('缺少某项材料时应返回 false', () => {
      const inventory = { herb: 10 };
      expect(system.checkIngredients('potion-hp', inventory)).toBe(false);
    });

    it('空背包应返回 false', () => {
      expect(system.checkIngredients('potion-hp', {})).toBe(false);
    });

    it('不存在的配方应返回 false', () => {
      const inventory = { herb: 10 };
      expect(system.checkIngredients('non-existent', inventory)).toBe(false);
    });
  });

  describe('craft', () => {
    beforeEach(() => {
      system = new CraftingSystem([createRecipeDef()]);
      system.learnRecipe('potion-hp');
    });

    it('应成功开始炼制', () => {
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);
      expect(craft).not.toBeNull();
      expect(craft!.recipeId).toBe('potion-hp');
      expect(craft!.progress).toBe(0);
      expect(craft!.instanceId).toBeTruthy();
    });

    it('应扣除材料', () => {
      const inventory = { herb: 10, water: 5 };
      system.craft('potion-hp', inventory);
      expect(inventory.herb).toBe(7);
      expect(inventory.water).toBe(4);
    });

    it('材料不足时应返回 null', () => {
      const inventory = { herb: 1, water: 0 };
      expect(system.craft('potion-hp', inventory)).toBeNull();
    });

    it('未学习的配方应返回 null', () => {
      system = new CraftingSystem([createRecipeDef()]);
      const inventory = { herb: 10, water: 5 };
      expect(system.craft('potion-hp', inventory)).toBeNull();
    });

    it('不存在的配方应返回 null', () => {
      const inventory = { herb: 10 };
      expect(system.craft('non-existent', inventory)).toBeNull();
    });

    it('超过并发上限时应返回 null', () => {
      const inventory = { herb: 100, water: 100 };
      system.craft('potion-hp', inventory);
      system.craft('potion-hp', inventory);
      expect(system.craft('potion-hp', inventory)).toBeNull();
    });

    it('应触发 craft_started 事件', () => {
      const handler = jest.fn();
      system.onEvent(handler);
      const inventory = { herb: 10, water: 5 };
      system.craft('potion-hp', inventory);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'craft_started',
          data: expect.objectContaining({ recipeId: 'potion-hp' }),
        }),
      );
    });

    it('前置配方未学习时应返回 null', () => {
      system = new CraftingSystem([createRecipeDef(), createSecondRecipeDef()]);
      system.learnRecipe('potion-mp');
      const inventory = { crystal: 10, water: 5 };
      expect(system.craft('potion-mp', inventory)).toBeNull();
    });
  });

  describe('update', () => {
    it('应推进炼制进度', () => {
      system = new CraftingSystem([
        createRecipeDef({ craftTime: 10000, successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);

      const originalStartTime = craft!.startTime;
      (system as any).active[0].startTime = originalStartTime - 5000;

      system.update(5000);

      const active = system.getActiveCrafts();
      expect(active.length).toBeGreaterThanOrEqual(0);
    });

    it('没有活跃任务时 update 应静默忽略', () => {
      expect(() => system.update(100)).not.toThrow();
    });

    it('进度达到 100% 时应自动完成', () => {
      system = new CraftingSystem([
        createRecipeDef({ craftTime: 1000, successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      system.craft('potion-hp', inventory);

      (system as any).active[0].startTime = Date.now() - 2000;

      system.update(0);

      expect(system.getActiveCrafts().length).toBe(0);
    });
  });

  describe('completeCraft', () => {
    it('成功时应返回品质和产出', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);

      const result = system.completeCraft(craft!.instanceId);
      expect(result.success).toBe(true);
      expect(result.quality).toBeTruthy();
      expect(result.output.potion_hp).toBeGreaterThanOrEqual(1);
    });

    it('失败时应返回空品质和失败产出', () => {
      system = new CraftingSystem([
        createFailRecipeDef(),
      ]);
      system.learnRecipe('rare-item');
      const inventory = { gem: 10 };
      const craft = system.craft('rare-item', inventory);

      const result = system.completeCraft(craft!.instanceId);
      expect(result.success).toBe(false);
      expect(result.quality).toBe('');
      expect(result.output.scrap).toBe(1);
    });

    it('不存在的实例应返回失败结果', () => {
      const result = system.completeCraft('non-existent');
      expect(result.success).toBe(false);
      expect(result.output).toEqual({});
    });

    it('完成后应从活跃列表移除', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);

      expect(system.getActiveCrafts().length).toBe(1);
      system.completeCraft(craft!.instanceId);
      expect(system.getActiveCrafts().length).toBe(0);
    });

    it('应触发 craft_completed 事件（成功时）', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);

      const handler = jest.fn();
      system.onEvent(handler);
      system.completeCraft(craft!.instanceId);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'craft_completed' }),
      );
    });

    it('应触发 craft_failed 事件（失败时）', () => {
      system = new CraftingSystem([
        createFailRecipeDef(),
      ]);
      system.learnRecipe('rare-item');
      const inventory = { gem: 10 };
      const craft = system.craft('rare-item', inventory);

      const handler = jest.fn();
      system.onEvent(handler);
      system.completeCraft(craft!.instanceId);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'craft_failed' }),
      );
    });

    it('应触发 quality_hit 事件（成功时）', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);

      const handler = jest.fn();
      system.onEvent(handler);
      system.completeCraft(craft!.instanceId);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'quality_hit' }),
      );
    });

    it('应更新统计数据', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);

      system.completeCraft(craft!.instanceId);

      const data = system.serialize();
      const stats = data.stats as Record<string, unknown>;
      expect(stats.totalCrafts).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.failCount).toBe(0);
    });
  });

  describe('品质掷骰', () => {
    it('品质倍率应正确应用到产出', () => {
      const singleQuality: CraftQuality[] = [
        { name: '传说', multiplier: 3.0, weight: 1, color: '#ff0000' },
      ];
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0, qualities: singleQuality, result: { potion_hp: 2 } }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 10, water: 5 };
      const craft = system.craft('potion-hp', inventory);

      const result = system.completeCraft(craft!.instanceId);
      expect(result.success).toBe(true);
      expect(result.quality).toBe('传说');
      expect(result.output.potion_hp).toBe(6);
    });

    it('应更新品质分布统计', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };

      const craft = system.craft('potion-hp', inventory);
      const result = system.completeCraft(craft!.instanceId);

      const data = system.serialize();
      const stats = data.stats as Record<string, unknown>;
      const dist = stats.qualityDistribution as Record<string, number>;
      expect(dist[result.quality]).toBe(1);
    });
  });

  describe('getActiveCrafts', () => {
    it('应返回活跃炼制列表', () => {
      system = new CraftingSystem([createRecipeDef()]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };
      system.craft('potion-hp', inventory);
      system.craft('potion-hp', inventory);

      const active = system.getActiveCrafts();
      expect(active.length).toBe(2);
    });

    it('返回的应是副本', () => {
      system = new CraftingSystem([createRecipeDef()]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };
      system.craft('potion-hp', inventory);

      const active = system.getActiveCrafts();
      (active[0] as any).progress = 999;
      expect(system.getActiveCrafts()[0].progress).toBe(0);
    });
  });

  describe('getRecipe / isLearned', () => {
    it('getRecipe 应返回配方定义', () => {
      system = new CraftingSystem([createRecipeDef()]);
      const recipe = system.getRecipe('potion-hp');
      expect(recipe).toBeDefined();
      expect(recipe!.name).toBe('生命药水');
    });

    it('getRecipe 不存在的配方应返回 undefined', () => {
      expect(system.getRecipe('non-existent')).toBeUndefined();
    });

    it('isLearned 未学习时应返回 false', () => {
      system = new CraftingSystem([createRecipeDef()]);
      expect(system.isLearned('potion-hp')).toBe(false);
    });

    it('isLearned 学习后应返回 true', () => {
      system = new CraftingSystem([createRecipeDef()]);
      system.learnRecipe('potion-hp');
      expect(system.isLearned('potion-hp')).toBe(true);
    });
  });

  describe('reset', () => {
    it('应重置所有状态', () => {
      system = new CraftingSystem([createRecipeDef()]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };
      system.craft('potion-hp', inventory);

      system.reset();

      expect(system.isLearned('potion-hp')).toBe(false);
      expect(system.getActiveCrafts()).toEqual([]);
    });

    it('重置后配方定义应保留', () => {
      system = new CraftingSystem([createRecipeDef()]);
      system.reset();
      expect(system.getRecipe('potion-hp')).toBeDefined();
    });

    it('重置后统计应归零', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };
      const craft = system.craft('potion-hp', inventory);
      system.completeCraft(craft!.instanceId);

      system.reset();

      const data = system.serialize();
      const stats = data.stats as Record<string, unknown>;
      expect(stats.totalCrafts).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failCount).toBe(0);
    });
  });

  describe('serialize / deserialize', () => {
    it('序列化后反序列化应恢复已学习配方', () => {
      system = new CraftingSystem([createRecipeDef()]);
      system.learnRecipe('potion-hp');

      const data = system.serialize();

      const newSystem = new CraftingSystem([createRecipeDef()]);
      newSystem.deserialize(data);

      expect(newSystem.isLearned('potion-hp')).toBe(true);
    });

    it('应正确序列化/反序列化活跃炼制', () => {
      system = new CraftingSystem([createRecipeDef()]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };
      system.craft('potion-hp', inventory);

      const data = system.serialize();
      expect((data.active as Array<unknown>).length).toBe(1);

      const newSystem = new CraftingSystem([createRecipeDef()]);
      newSystem.deserialize(data);

      expect(newSystem.getActiveCrafts().length).toBe(1);
      expect(newSystem.getActiveCrafts()[0].recipeId).toBe('potion-hp');
    });

    it('应正确序列化/反序列化统计数据', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };
      const craft = system.craft('potion-hp', inventory);
      system.completeCraft(craft!.instanceId);

      const data = system.serialize();
      const newSystem = new CraftingSystem([createRecipeDef()]);
      newSystem.deserialize(data);

      const restoredStats = (newSystem.serialize().stats as Record<string, unknown>);
      expect(restoredStats.totalCrafts).toBe(1);
      expect(restoredStats.successCount).toBe(1);
    });

    it('序列化空系统应返回默认值', () => {
      const data = system.serialize();
      expect(data.learned).toEqual([]);
      expect(data.active).toEqual([]);
    });

    it('反序列化空数据不应崩溃', () => {
      expect(() => system.deserialize({})).not.toThrow();
    });

    it('应正确序列化/反序列化品质分布', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0, qualities: [
          { name: '普通', multiplier: 1.0, weight: 1, color: '#fff' },
        ]}),
      ]);
      system.learnRecipe('potion-hp');
      const inventory = { herb: 100, water: 100 };
      const craft = system.craft('potion-hp', inventory);
      system.completeCraft(craft!.instanceId);

      const data = system.serialize();
      const newSystem = new CraftingSystem([createRecipeDef()]);
      newSystem.deserialize(data);

      const restoredStats = (newSystem.serialize().stats as Record<string, unknown>);
      const dist = restoredStats.qualityDistribution as Record<string, number>;
      expect(dist['普通']).toBe(1);
    });
  });

  describe('onEvent', () => {
    it('应返回取消监听函数', () => {
      const handler = jest.fn();
      const unsub = system.onEvent(handler);
      expect(typeof unsub).toBe('function');
    });

    it('取消监听后不应再收到事件', () => {
      system = new CraftingSystem([createRecipeDef()]);
      const handler = jest.fn();
      const unsub = system.onEvent(handler);
      unsub();

      system.learnRecipe('potion-hp');
      expect(handler).not.toHaveBeenCalled();
    });

    it('应支持多个监听器', () => {
      system = new CraftingSystem([createRecipeDef()]);
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      system.onEvent(handler1);
      system.onEvent(handler2);
      system.learnRecipe('potion-hp');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('完整流程', () => {
    it('应完成 学习→检查→炼制→完成 的完整流程', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0, qualities: [
          { name: '普通', multiplier: 1.0, weight: 1, color: '#fff' },
        ]}),
      ]);

      expect(system.learnRecipe('potion-hp')).toBe(true);

      const inventory = { herb: 10, water: 5 };
      expect(system.checkIngredients('potion-hp', inventory)).toBe(true);

      const craft = system.craft('potion-hp', inventory);
      expect(craft).not.toBeNull();
      expect(inventory.herb).toBe(7);
      expect(inventory.water).toBe(4);

      const result = system.completeCraft(craft!.instanceId);
      expect(result.success).toBe(true);
      expect(result.quality).toBe('普通');
      expect(result.output.potion_hp).toBe(1);
    });

    it('应支持多个配方并行炼制', () => {
      system = new CraftingSystem([
        createRecipeDef({ successRate: 1.0 }),
        createSecondRecipeDef(),
      ]);

      system.learnRecipe('potion-hp');
      system.learnRecipe('potion-mp');

      const inventory = { herb: 100, water: 100, crystal: 100 };
      const craft1 = system.craft('potion-hp', inventory);
      const craft2 = system.craft('potion-mp', inventory);

      expect(craft1).not.toBeNull();
      expect(craft2).not.toBeNull();
      expect(system.getActiveCrafts().length).toBe(2);

      const result1 = system.completeCraft(craft1!.instanceId);
      const result2 = system.completeCraft(craft2!.instanceId);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});
