/**
 * Wild Survival（野外求生）放置类游戏 — 完整测试套件
 */
import { WildSurvivalEngine } from '@/games/wild-survival/WildSurvivalEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  STONE_PER_CLICK,
  WISDOM_BONUS_MULTIPLIER,
  MIN_PRESTIGE_STONE,
  BUILDINGS,
  SKILLS,
  COLORS,
  CAMP_DRAW,
  SEASON_ORDER,
  SEASON_DURATION,
  SEASON_MULTIPLIERS,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/wild-survival/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createMockCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop,
    measureText: () => ({ width: 10 } as TextMetrics),
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, rect: noop, ellipse: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop,
    fill: noop, stroke: noop, clip: noop,
    save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop,
    transform: noop, setTransform: noop, resetTransform: noop,
    drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop } as CanvasGradient),
    createRadialGradient: () => ({ addColorStop: noop } as CanvasGradient),
    createPattern: () => null,
    globalAlpha: 1, globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap, lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10, font: '12px sans-serif',
    textAlign: 'start' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

function createEngine(): WildSurvivalEngine {
  const engine = new WildSurvivalEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): WildSurvivalEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addStone(engine: WildSurvivalEngine, amount: number): void {
  (engine as any).addResource('stone', amount);
}

function addFood(engine: WildSurvivalEngine, amount: number): void {
  (engine as any).addResource('food', amount);
}

function addFur(engine: WildSurvivalEngine, amount: number): void {
  (engine as any).addResource('fur', amount);
}

/** 触发一次 update */
function tick(engine: WildSurvivalEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getStone(engine: WildSurvivalEngine): number {
  return (engine as any).getResource('stone')?.amount ?? 0;
}

function getFood(engine: WildSurvivalEngine): number {
  return (engine as any).getResource('food')?.amount ?? 0;
}

function getFur(engine: WildSurvivalEngine): number {
  return (engine as any).getResource('fur')?.amount ?? 0;
}

// ========== 测试 ==========

describe('WildSurvivalEngine', () => {
  let engine: WildSurvivalEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 常量验证 ==========

  describe('常量定义', () => {
    it('RESOURCE_IDS 包含三种资源', () => {
      expect(RESOURCE_IDS.STONE).toBe('stone');
      expect(RESOURCE_IDS.FOOD).toBe('food');
      expect(RESOURCE_IDS.FUR).toBe('fur');
    });

    it('BUILDING_IDS 包含 8 种建筑', () => {
      expect(Object.keys(BUILDING_IDS).length).toBe(8);
      expect(BUILDING_IDS.CAMPFIRE).toBe('campfire');
      expect(BUILDING_IDS.SHELTER).toBe('shelter');
      expect(BUILDING_IDS.TRAP).toBe('trap');
      expect(BUILDING_IDS.QUARRY).toBe('quarry');
      expect(BUILDING_IDS.TANNERY).toBe('tannery');
      expect(BUILDING_IDS.WORKSHOP).toBe('workshop');
      expect(BUILDING_IDS.WATCHTOWER).toBe('watchtower');
      expect(BUILDING_IDS.FORTRESS).toBe('fortress');
    });

    it('STONE_PER_CLICK 为 1', () => {
      expect(STONE_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_STONE 为 50000', () => {
      expect(MIN_PRESTIGE_STONE).toBe(50000);
    });

    it('BUILDINGS 数组有 8 个元素', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('SKILLS 数组有 6 个元素', () => {
      expect(SKILLS.length).toBe(6);
    });

    it('SEASON_ORDER 有 4 个季节', () => {
      expect(SEASON_ORDER.length).toBe(4);
      expect(SEASON_ORDER).toEqual(['spring', 'summer', 'autumn', 'winter']);
    });

    it('COLORS 包含必要颜色', () => {
      expect(COLORS.textPrimary).toBeDefined();
      expect(COLORS.accent).toBeDefined();
      expect(COLORS.stoneColor).toBeDefined();
      expect(COLORS.foodColor).toBeDefined();
      expect(COLORS.furColor).toBeDefined();
    });
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(WildSurvivalEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后石头为 0', () => {
      expect(getStone(engine)).toBe(0);
    });

    it('init 后食物为 0', () => {
      expect(getFood(engine)).toBe(0);
    });

    it('init 后毛皮为 0', () => {
      expect(getFur(engine)).toBe(0);
    });

    it('init 后总石头获得为 0', () => {
      expect(engine.totalStoneEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 wild-survival', () => {
      expect(engine.gameId).toBe('wild-survival');
    });

    it('init 后石头已解锁', () => {
      const res = (engine as any).getResource('stone');
      expect(res.unlocked).toBe(true);
    });

    it('init 后食物未解锁', () => {
      const res = (engine as any).getResource('food');
      expect(res.unlocked).toBe(false);
    });

    it('init 后毛皮未解锁', () => {
      const res = (engine as any).getResource('fur');
      expect(res.unlocked).toBe(false);
    });

    it('init 后季节为春天', () => {
      expect(engine.season).toBe('spring');
    });

    it('init 后季节进度为 0', () => {
      expect(engine.seasonProgress).toBe(0);
    });

    it('init 后选中索引为 0', () => {
      expect(engine.selectedIndex).toBe(0);
    });
  });

  // ========== 建筑定义验证 ==========

  describe('建筑定义', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个建筑有名称', () => {
      BUILDINGS.forEach(b => {
        expect(b.name).toBeTruthy();
      });
    });

    it('每个建筑有图标', () => {
      BUILDINGS.forEach(b => {
        expect(b.icon).toBeTruthy();
      });
    });

    it('每个建筑有正数费用倍率', () => {
      BUILDINGS.forEach(b => {
        expect(b.costMultiplier).toBeGreaterThan(1);
      });
    });

    it('每个建筑有正数基础产出', () => {
      BUILDINGS.forEach(b => {
        expect(b.baseProduction).toBeGreaterThan(0);
      });
    });

    it('每个建筑有最大等级', () => {
      BUILDINGS.forEach(b => {
        expect(b.maxLevel).toBeGreaterThan(0);
      });
    });

    it('每个建筑产出合法资源', () => {
      const validResources = ['stone', 'food', 'fur'];
      BUILDINGS.forEach(b => {
        expect(validResources).toContain(b.productionResource);
      });
    });

    it('初始只有篝火解锁', () => {
      const campfire = (engine as any).upgrades.get('campfire');
      expect(campfire.unlocked).toBe(true);
    });

    it('庇护所初始未解锁', () => {
      const shelter = (engine as any).upgrades.get('shelter');
      expect(shelter.unlocked).toBe(false);
    });

    it('陷阱初始未解锁', () => {
      const trap = (engine as any).upgrades.get('trap');
      expect(trap.unlocked).toBe(false);
    });

    it('堡垒初始未解锁', () => {
      const fortress = (engine as any).upgrades.get('fortress');
      expect(fortress.unlocked).toBe(false);
    });
  });

  // ========== 技能定义验证 ==========

  describe('技能定义', () => {
    it('应有 6 种技能', () => {
      expect(SKILLS.length).toBe(6);
    });

    it('技能 ID 唯一', () => {
      const ids = SKILLS.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个技能有名称', () => {
      SKILLS.forEach(s => {
        expect(s.name).toBeTruthy();
      });
    });

    it('每个技能有图标', () => {
      SKILLS.forEach(s => {
        expect(s.icon).toBeTruthy();
      });
    });

    it('每个技能有正数加成', () => {
      SKILLS.forEach(s => {
        expect(s.bonusPerLevel).toBeGreaterThan(0);
      });
    });

    it('每个技能有最大等级', () => {
      SKILLS.forEach(s => {
        expect(s.maxLevel).toBeGreaterThan(0);
      });
    });

    it('所有技能初始等级为 0', () => {
      const skills = engine.skills;
      skills.forEach(s => {
        expect(s.level).toBe(0);
      });
    });

    it('skills getter 返回副本', () => {
      const skills1 = engine.skills;
      const skills2 = engine.skills;
      expect(skills1).not.toBe(skills2);
    });
  });

  // ========== 生命周期 ==========

  describe('生命周期', () => {
    it('start 后状态应为 playing', () => {
      engine.start();
      expect((engine as any)._status).toBe('playing');
    });

    it('pause 后状态应为 paused', () => {
      engine.start();
      engine.pause();
      expect((engine as any)._status).toBe('paused');
    });

    it('resume 后状态应为 playing', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect((engine as any)._status).toBe('playing');
    });

    it('reset 后状态应为 idle', () => {
      engine.start();
      engine.reset();
      expect((engine as any)._status).toBe('idle');
    });

    it('reset 后石头归零', () => {
      engine.start();
      addStone(engine, 1000);
      engine.reset();
      expect(getStone(engine)).toBe(0);
    });

    it('destroy 后状态为 idle', () => {
      engine.start();
      engine.destroy();
      expect((engine as any)._status).toBe('idle');
    });

    it('多次 start 不会出错', () => {
      engine.start();
      expect(() => engine.start()).not.toThrow();
    });

    it('start-reset 循环正常', () => {
      engine.start();
      addStone(engine, 500);
      engine.reset();
      engine.start();
      expect(getStone(engine)).toBe(0);
    });
  });

  // ========== 点击产生石头 ==========

  describe('点击产生石头', () => {
    it('点击一次产生石头', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getStone(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生石头', () => {
      engine.start();
      let total = 0;
      for (let i = 0; i < 10; i++) {
        total += engine.click();
      }
      expect(total).toBeGreaterThanOrEqual(10);
    });

    it('点击增加总点击计数', () => {
      engine.start();
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
    });

    it('点击增加总石头获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalStoneEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getStone(engine)).toBe(0);
    });

    it('paused 状态下点击无效', () => {
      engine.start();
      engine.pause();
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      engine.start();
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.click();
      expect(listener).toHaveBeenCalled();
    });

    it('大量点击（1000次）性能正常', () => {
      engine.start();
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        engine.click();
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  // ========== 资源系统 ==========

  describe('资源系统', () => {
    it('增加石头', () => {
      addStone(engine, 100);
      expect(getStone(engine)).toBe(100);
    });

    it('增加食物', () => {
      addFood(engine, 50);
      expect(getFood(engine)).toBe(50);
    });

    it('增加毛皮', () => {
      addFur(engine, 30);
      expect(getFur(engine)).toBe(30);
    });

    it('消耗石头成功', () => {
      addStone(engine, 100);
      (engine as any).spendResource('stone', 50);
      expect(getStone(engine)).toBe(50);
    });

    it('消耗石头失败（不足）', () => {
      addStone(engine, 10);
      const result = (engine as any).spendResource('stone', 50);
      expect(result).toBeFalsy();
      expect(getStone(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addStone(engine, 100);
      expect((engine as any).hasResource('stone', 50)).toBe(true);
      expect((engine as any).hasResource('stone', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addStone(engine, 100);
      addFood(engine, 50);
      expect((engine as any).canAfford({ stone: 50, food: 20 })).toBe(true);
      expect((engine as any).canAfford({ stone: 50, food: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('购买篝火成功', () => {
      engine.start();
      addStone(engine, 100);
      const result = engine.purchaseBuilding(0); // campfire
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买篝火失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addStone(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.stone).toBeGreaterThan(cost1.stone);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addStone(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addStone(engine, 10000);
      // 庇护所需要篝火等级 > 0
      const result = engine.purchaseBuilding(1); // shelter
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addStone(engine, 100);
      const before = getStone(engine);
      engine.purchaseBuilding(0);
      expect(getStone(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addStone(engine, 100);
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑触发 upgradePurchased', () => {
      engine.start();
      addStone(engine, 100);
      const listener = jest.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledWith('campfire', 1);
    });

    it('getBuildingCost 无效索引返回空对象', () => {
      const cost = engine.getBuildingCost(-1);
      expect(cost).toEqual({});
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('庇护所在篝火有等级后解锁', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0); // campfire
      tick(engine, 16);
      const shelter = (engine as any).upgrades.get('shelter');
      expect(shelter.unlocked).toBe(true);
    });

    it('陷阱在篝火有等级后解锁', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0); // campfire
      tick(engine, 16);
      const trap = (engine as any).upgrades.get('trap');
      expect(trap.unlocked).toBe(true);
    });

    it('采石场在篝火有等级后解锁', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0); // campfire
      tick(engine, 16);
      const quarry = (engine as any).upgrades.get('quarry');
      expect(quarry.unlocked).toBe(true);
    });

    it('制革坊需要陷阱有等级', () => {
      engine.start();
      addStone(engine, 1000);
      addFood(engine, 200);
      engine.purchaseBuilding(0); // campfire
      tick(engine, 16);
      engine.purchaseBuilding(2); // trap
      tick(engine, 16);
      const tannery = (engine as any).upgrades.get('tannery');
      expect(tannery.unlocked).toBe(true);
    });

    it('工坊需要采石场和庇护所', () => {
      engine.start();
      addStone(engine, 100000);
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // campfire
      tick(engine, 16);
      engine.purchaseBuilding(1); // shelter
      engine.purchaseBuilding(3); // quarry
      tick(engine, 16);
      const workshop = (engine as any).upgrades.get('workshop');
      expect(workshop.unlocked).toBe(true);
    });

    it('瞭望塔需要工坊和制革坊', () => {
      engine.start();
      addStone(engine, 100000);
      addFood(engine, 10000);
      addFur(engine, 5000);
      // campfire
      engine.purchaseBuilding(0);
      tick(engine, 16);
      // shelter
      engine.purchaseBuilding(1);
      // trap
      engine.purchaseBuilding(2);
      // quarry
      engine.purchaseBuilding(3);
      tick(engine, 16);
      // tannery
      engine.purchaseBuilding(4);
      // workshop
      engine.purchaseBuilding(5);
      tick(engine, 16);
      const watchtower = (engine as any).upgrades.get('watchtower');
      expect(watchtower.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('食物在庇护所等级>=1时解锁', () => {
      engine.start();
      addStone(engine, 1000);
      engine.purchaseBuilding(0); // campfire
      tick(engine, 16);
      engine.purchaseBuilding(1); // shelter
      tick(engine, 16);
      const food = (engine as any).getResource('food');
      expect(food.unlocked).toBe(true);
    });

    it('毛皮在陷阱等级>=1时解锁', () => {
      engine.start();
      addStone(engine, 1000);
      addFood(engine, 200);
      engine.purchaseBuilding(0); // campfire
      tick(engine, 16);
      engine.purchaseBuilding(2); // trap
      tick(engine, 16);
      const fur = (engine as any).getResource('fur');
      expect(fur.unlocked).toBe(true);
    });
  });

  // ========== 技能系统 ==========

  describe('技能系统', () => {
    it('学习采石术成功', () => {
      engine.start();
      addStone(engine, 100);
      const result = engine.learnSkill('stone_mastery');
      expect(result).toBe(true);
      expect(engine.getSkillLevel('stone_mastery')).toBe(1);
    });

    it('学习技能扣除石头', () => {
      engine.start();
      addStone(engine, 100);
      const before = getStone(engine);
      engine.learnSkill('stone_mastery');
      expect(getStone(engine)).toBeLessThan(before);
    });

    it('学习技能失败（石头不足）', () => {
      engine.start();
      addStone(engine, 10);
      const result = engine.learnSkill('stone_mastery');
      expect(result).toBe(false);
      expect(engine.getSkillLevel('stone_mastery')).toBe(0);
    });

    it('学习不存在的技能失败', () => {
      engine.start();
      addStone(engine, 1000);
      const result = engine.learnSkill('nonexistent');
      expect(result).toBe(false);
    });

    it('前置技能未满足时学习失败', () => {
      engine.start();
      addStone(engine, 100000);
      // 御寒术需要先学采石术
      const result = engine.learnSkill('winter_craft');
      expect(result).toBe(false);
    });

    it('前置技能满足后可以学习', () => {
      engine.start();
      addStone(engine, 100000);
      engine.learnSkill('stone_mastery'); // 先学采石术
      const result = engine.learnSkill('winter_craft');
      expect(result).toBe(true);
      expect(engine.getSkillLevel('winter_craft')).toBe(1);
    });

    it('学习技能触发 skillLearned 事件', () => {
      engine.start();
      addStone(engine, 100);
      const listener = jest.fn();
      engine.on('skillLearned', listener);
      engine.learnSkill('stone_mastery');
      expect(listener).toHaveBeenCalledWith('stone_mastery', 1);
    });

    it('学习技能增加统计计数', () => {
      engine.start();
      addStone(engine, 100);
      engine.learnSkill('stone_mastery');
      expect(engine.statistics.totalSkillsLearned).toBe(1);
    });

    it('技能费用递增', () => {
      engine.start();
      addStone(engine, 100000);
      const cost1 = engine.getSkillCost('stone_mastery');
      engine.learnSkill('stone_mastery');
      const cost2 = engine.getSkillCost('stone_mastery');
      expect(cost2).toBeGreaterThan(cost1);
    });

    it('技能达到最大等级后无法继续学习', () => {
      engine.start();
      addStone(engine, 1e10);
      const def = SKILLS.find(s => s.id === 'stone_mastery')!;
      for (let i = 0; i < def.maxLevel; i++) {
        engine.learnSkill('stone_mastery');
      }
      expect(engine.getSkillLevel('stone_mastery')).toBe(def.maxLevel);
      const result = engine.learnSkill('stone_mastery');
      expect(result).toBe(false);
    });

    it('getSkillCost 不存在的技能返回 Infinity', () => {
      const cost = engine.getSkillCost('nonexistent');
      expect(cost).toBe(Infinity);
    });

    it('getSkillLevel 不存在的技能返回 0', () => {
      expect(engine.getSkillLevel('nonexistent')).toBe(0);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1（无技能加成）', () => {
      const mult = engine.getClickMultiplier();
      expect(mult).toBe(1);
    });

    it('初始产出倍率为 1（无技能加成）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随远古智慧增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * WISDOM_BONUS_MULTIPLIER, 2);
    });

    it('学习采石术后点击倍率增加', () => {
      engine.start();
      addStone(engine, 100);
      const before = engine.getClickMultiplier();
      engine.learnSkill('stone_mastery');
      const after = engine.getClickMultiplier();
      expect(after).toBeGreaterThan(before);
    });

    it('学习觅食术后产出倍率增加', () => {
      engine.start();
      addStone(engine, 1000);
      const before = engine.getProductionMultiplier();
      engine.learnSkill('foraging');
      const after = engine.getProductionMultiplier();
      expect(after).toBeGreaterThan(before);
    });

    it('学习高级采矿后点击和产出倍率都增加', () => {
      engine.start();
      addStone(engine, 100000);
      engine.learnSkill('stone_mastery');
      const clickBefore = engine.getClickMultiplier();
      const prodBefore = engine.getProductionMultiplier();
      engine.learnSkill('advanced_mining');
      const clickAfter = engine.getClickMultiplier();
      const prodAfter = engine.getProductionMultiplier();
      expect(clickAfter).toBeGreaterThan(clickBefore);
      expect(prodAfter).toBeGreaterThan(prodBefore);
    });
  });

  // ========== 季节系统 ==========

  describe('季节系统', () => {
    it('初始季节为春天', () => {
      expect(engine.season).toBe('spring');
    });

    it('季节进度初始为 0', () => {
      expect(engine.seasonProgress).toBe(0);
    });

    it('春天产出倍率为 1.0', () => {
      const mult = engine.getSeasonMultiplier();
      expect(mult).toBeCloseTo(1.0, 1);
    });

    it('夏天产出倍率为 1.3', () => {
      (engine as any)._season = 'summer';
      const mult = engine.getSeasonMultiplier();
      expect(mult).toBeCloseTo(1.3, 1);
    });

    it('秋天产出倍率为 1.1', () => {
      (engine as any)._season = 'autumn';
      const mult = engine.getSeasonMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('冬天产出倍率为 0.6', () => {
      (engine as any)._season = 'winter';
      const mult = engine.getSeasonMultiplier();
      expect(mult).toBeCloseTo(0.6, 1);
    });

    it('冬季御寒术减少惩罚', () => {
      (engine as any)._season = 'winter';
      const multBefore = engine.getSeasonMultiplier();
      // 学习御寒术
      const skill = (engine as any)._skills.find((s: any) => s.id === 'winter_craft');
      skill.level = 1;
      const multAfter = engine.getSeasonMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('冬季御寒术最高不超过 1.0', () => {
      (engine as any)._season = 'winter';
      // 满级御寒术
      const skill = (engine as any)._skills.find((s: any) => s.id === 'winter_craft');
      skill.level = 5;
      const mult = engine.getSeasonMultiplier();
      expect(mult).toBeLessThanOrEqual(1.0);
    });

    it('季节在 tick 后推进', () => {
      engine.start();
      tick(engine, SEASON_DURATION + 100);
      expect(engine.season).toBe('summer');
    });

    it('季节循环：春→夏→秋→冬→春', () => {
      engine.start();
      const seasons: string[] = [engine.season];
      for (let i = 0; i < 4; i++) {
        tick(engine, SEASON_DURATION + 100);
        seasons.push(engine.season);
      }
      expect(seasons).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring']);
    });

    it('季节变化触发 seasonChange 事件', () => {
      engine.start();
      const listener = jest.fn();
      engine.on('seasonChange', listener);
      tick(engine, SEASON_DURATION + 100);
      // 季节变化时 emit 的是新季节名
      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1];
      expect(SEASON_ORDER).toContain(lastCall[0]);
    });

    it('季节变化增加统计计数', () => {
      engine.start();
      // 用较小的 dt 只触发一次季节变化
      (engine as any)._seasonTimer = SEASON_DURATION - 10;
      tick(engine, 20);
      expect(engine.statistics.totalSeasonsSurvived).toBeGreaterThanOrEqual(1);
    });

    it('季节进度在 0-1 之间', () => {
      engine.start();
      tick(engine, SEASON_DURATION / 2);
      expect(engine.seasonProgress).toBeGreaterThanOrEqual(0);
      expect(engine.seasonProgress).toBeLessThanOrEqual(1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始远古智慧为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('石头不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（石头不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('石头达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      const wisdom = engine.doPrestige();
      expect(wisdom).toBeGreaterThan(0);
    });

    it('声望后远古智慧增加', () => {
      engine.start();
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addStone(engine, MIN_PRESTIGE_STONE * 4);
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      engine.doPrestige();
      expect(getStone(engine)).toBe(0);
    });

    it('声望保留技能等级', () => {
      engine.start();
      addStone(engine, 100);
      engine.learnSkill('stone_mastery');
      const levelBefore = engine.getSkillLevel('stone_mastery');

      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      engine.doPrestige();
      const levelAfter = engine.getSkillLevel('stone_mastery');
      expect(levelAfter).toBe(levelBefore);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      const listener = jest.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望后声望加成生效', () => {
      engine.start();
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 100;
      engine.doPrestige();
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('石头不足时声望返回 0', () => {
      engine.start();
      const result = engine.doPrestige();
      expect(result).toBe(0);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('wild-survival');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addStone(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含技能和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).skills).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('save 包含季节信息', () => {
      engine.start();
      const data = engine.save();
      expect((data.settings as any).season).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addStone(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getStone(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复技能状态', () => {
      engine.start();
      addStone(engine, 100);
      engine.learnSkill('stone_mastery');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.getSkillLevel('stone_mastery')).toBe(1);
    });

    it('load 恢复季节状态', () => {
      engine.start();
      (engine as any)._season = 'winter';
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.season).toBe('winter');
    });
  });

  // ========== 状态管理 ==========

  describe('状态管理', () => {
    it('getState 返回完整状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toBeDefined();
      expect(state.resources).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.skills).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
      expect(state.season).toBeDefined();
      expect(state.seasonProgress).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addStone(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getStone(engine2)).toBeCloseTo(1000, 0);
    });

    it('loadState 恢复声望', () => {
      engine.start();
      (engine as any).prestige.currency = 5;
      (engine as any).prestige.count = 2;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect((engine2 as any).prestige.currency).toBe(5);
      expect((engine2 as any).prestige.count).toBe(2);
    });

    it('loadState 恢复技能', () => {
      engine.start();
      addStone(engine, 100);
      engine.learnSkill('stone_mastery');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.getSkillLevel('stone_mastery')).toBe(1);
    });

    it('loadState 恢复季节', () => {
      engine.start();
      (engine as any)._season = 'autumn';
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.season).toBe('autumn');
    });

    it('loadState 恢复建筑等级', () => {
      engine.start();
      addStone(engine, 1000);
      engine.purchaseBuilding(0);
      engine.purchaseBuilding(0);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.getBuildingLevel(0)).toBe(2);
    });
  });

  // ========== 数字格式化 ==========

  describe('数字格式化', () => {
    it('小数字原样返回', () => {
      expect((engine as any).formatNumber(42)).toBe('42');
    });

    it('千位使用 K 后缀', () => {
      const result = (engine as any).formatNumber(1500);
      expect(result).toContain('K');
    });

    it('百万使用 M 后缀', () => {
      const result = (engine as any).formatNumber(1500000);
      expect(result).toContain('M');
    });

    it('十亿使用 B 后缀', () => {
      const result = (engine as any).formatNumber(1500000000);
      expect(result).toContain('B');
    });

    it('0 返回 0', () => {
      expect((engine as any).formatNumber(0)).toBe('0');
    });

    it('负数格式化', () => {
      const result = (engine as any).formatNumber(-1500);
      expect(result).toContain('-');
      expect(result).toContain('K');
    });
  });

  // ========== 键盘输入 ==========

  describe('键盘输入', () => {
    it('空格键触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(getStone(engine)).toBeGreaterThan(0);
    });

    it('上箭头减少选中索引', () => {
      engine.start();
      (engine as any)._selectedIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(1);
    });

    it('上箭头不低于 0', () => {
      engine.start();
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(0);
    });

    it('下箭头增加选中索引', () => {
      engine.start();
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(1);
    });

    it('下箭头不超过最大值', () => {
      engine.start();
      (engine as any)._selectedIndex = BUILDINGS.length - 1;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(BUILDINGS.length - 1);
    });

    it('回车购买建筑', () => {
      engine.start();
      addStone(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('S 键学习技能', () => {
      engine.start();
      addStone(engine, 100);
      engine.handleKeyDown('s');
      expect(engine.getSkillLevel('stone_mastery')).toBe(1);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getStone(engine)).toBe(0);
    });

    it('handleKeyUp 不抛错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ========== Canvas 渲染 ==========

  describe('Canvas 渲染', () => {
    it('onRender 不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('多次渲染不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      for (let i = 0; i < 10; i++) {
        engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    });

    it('有声望时渲染正常', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('冬季渲染正常', () => {
      engine.start();
      (engine as any)._season = 'winter';
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('夏季渲染正常', () => {
      engine.start();
      (engine as any)._season = 'summer';
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('秋季渲染正常', () => {
      engine.start();
      (engine as any)._season = 'autumn';
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有技能时渲染正常', () => {
      engine.start();
      addStone(engine, 100);
      engine.learnSkill('stone_mastery');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑时渲染正常', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有季节渲染不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      for (const season of SEASON_ORDER) {
        (engine as any)._season = season;
        expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
      }
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0); // campfire
      const before = getStone(engine);
      tick(engine, 1000);
      const after = getStone(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0);
      const before = getStone(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getStone(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('夏季产出更高', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0);

      // 春天产出
      (engine as any)._season = 'spring';
      (engine as any).recalculateProduction();
      tick(engine, 1000);
      const springGain = getStone(engine);

      // 重置
      engine.reset();
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0);

      // 夏天产出
      (engine as any)._season = 'summer';
      (engine as any).recalculateProduction();
      tick(engine, 1000);
      const summerGain = getStone(engine);

      expect(summerGain).toBeGreaterThan(springGain);
    });

    it('冬季产出降低', () => {
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0);

      // 春天产出
      (engine as any)._season = 'spring';
      (engine as any).recalculateProduction();
      tick(engine, 1000);
      const springGain = getStone(engine);

      // 重置
      engine.reset();
      engine.start();
      addStone(engine, 100);
      engine.purchaseBuilding(0);

      // 冬天产出
      (engine as any)._season = 'winter';
      (engine as any).recalculateProduction();
      tick(engine, 1000);
      const winterGain = getStone(engine);

      expect(winterGain).toBeLessThan(springGain);
    });

    it('技能加成提高产出', () => {
      engine.start();
      addStone(engine, 1000);
      engine.purchaseBuilding(0);

      // 无技能产出
      tick(engine, 1000);
      const noSkillGain = getStone(engine);

      // 有技能产出（advanced_mining 需要 stone_mastery 前置）
      engine.reset();
      engine.start();
      addStone(engine, 100000);
      engine.purchaseBuilding(0);
      engine.learnSkill('stone_mastery');
      engine.learnSkill('advanced_mining');
      (engine as any).recalculateProduction();
      tick(engine, 1000);
      const withSkillGain = getStone(engine);

      expect(withSkillGain).toBeGreaterThan(noSkillGain);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addStone(engine, 1e14);
      expect(getStone(engine)).toBeGreaterThan(0);
    });

    it('负数 deltaTime 不崩溃', () => {
      engine.start();
      expect(() => tick(engine, -100)).not.toThrow();
    });

    it('零 deltaTime 不崩溃', () => {
      engine.start();
      expect(() => tick(engine, 0)).not.toThrow();
    });

    it('极大 deltaTime 不崩溃', () => {
      engine.start();
      expect(() => tick(engine, 86400000)).not.toThrow();
    });

    it('重复 init 不崩溃', () => {
      engine.init(createCanvas());
      engine.init(createCanvas());
      expect((engine as any)._status).toBeDefined();
    });

    it('未 start 时 update 不崩溃', () => {
      expect(() => tick(engine, 100)).not.toThrow();
    });

    it('连续 reset 不崩溃', () => {
      engine.start();
      engine.reset();
      engine.reset();
      expect((engine as any)._status).toBe('idle');
    });

    it('statistics getter 返回副本', () => {
      const stats1 = engine.statistics;
      const stats2 = engine.statistics;
      expect(stats1).not.toBe(stats2);
    });

    it('重复学习同一技能到满级不崩溃', () => {
      engine.start();
      addStone(engine, 1e10);
      const def = SKILLS.find(s => s.id === 'stone_mastery')!;
      for (let i = 0; i < def.maxLevel + 5; i++) {
        engine.learnSkill('stone_mastery');
      }
      expect(engine.getSkillLevel('stone_mastery')).toBe(def.maxLevel);
    });

    it('极端季节计时器值不崩溃', () => {
      engine.start();
      (engine as any)._seasonTimer = 1e15;
      expect(() => tick(engine, 100)).not.toThrow();
    });

    it('所有建筑满级时渲染不崩溃', () => {
      engine.start();
      for (const building of BUILDINGS) {
        const upgrade = (engine as any).upgrades.get(building.id);
        if (upgrade) {
          upgrade.level = building.maxLevel;
          upgrade.unlocked = true;
        }
      }
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 完整游戏流程 ==========

  describe('完整游戏流程', () => {
    it('从零开始的基本游戏流程', () => {
      const e = startEngine();

      // 1. 点击获取石头
      for (let i = 0; i < 20; i++) {
        e.click();
      }
      const stoneAfterClicks = getStone(e);
      expect(stoneAfterClicks).toBeGreaterThanOrEqual(20);

      // 2. 购买篝火
      const bought = e.purchaseBuilding(0);
      expect(bought).toBe(true);

      // 3. 等待自动产出（石头可能因购买减少，但之后会增加）
      const stoneBefore = getStone(e);
      tick(e, 5000);
      const stoneAfter = getStone(e);
      expect(stoneAfter).toBeGreaterThan(stoneBefore);

      // 4. 学习技能
      addStone(e, 200);
      e.learnSkill('stone_mastery');
      expect(e.getSkillLevel('stone_mastery')).toBe(1);

      // 5. 季节变化
      (e as any)._seasonTimer = SEASON_DURATION - 10;
      tick(e, 20);
      expect(e.season).toBe('summer');

      // 6. 验证状态
      const state = e.getState();
      expect(state.resources.stone.amount).toBeGreaterThan(0);
      expect(state.skills).toBeDefined();
      expect(state.season).toBe('summer');
    });

    it('声望后重新开始流程', () => {
      const e = startEngine();

      // 积累石头
      addStone(e, MIN_PRESTIGE_STONE * 4);
      (e as any)._stats.totalStoneEarned = MIN_PRESTIGE_STONE * 4;

      // 学习技能
      e.learnSkill('stone_mastery');

      // 声望
      const wisdom = e.doPrestige();
      expect(wisdom).toBeGreaterThan(0);
      expect(getStone(e)).toBe(0);
      expect(e.getSkillLevel('stone_mastery')).toBe(1);
      expect(e.getPrestigeMultiplier()).toBeGreaterThan(1);
    });
  });
});
