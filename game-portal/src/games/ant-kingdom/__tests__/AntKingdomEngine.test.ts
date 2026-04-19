/**
 * Ant Kingdom（蚂蚁王国）放置类游戏 — 完整测试套件
 *
 * 覆盖：初始化、资源、点击、建筑、蚂蚁兵种、产出倍率、声望、存档、键盘、渲染、边界
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AntKingdomEngine } from '@/games/ant-kingdom/AntKingdomEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FOOD_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  ANTS,
  ANT_IDS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_FOOD,
  COLORS,
  MAX_VISIBLE_ANTS,
} from '@/games/ant-kingdom/constants';

// ========== 测试辅助 ==========

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
    save: noop, restore: noop, translate: noop, rotate: noop,
    scale: noop, transform: noop, setTransform: noop, resetTransform: noop,
    drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop } as CanvasGradient),
    createRadialGradient: () => ({ addColorStop: noop } as CanvasGradient),
    createPattern: () => null,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, lineCap: 'butt' as CanvasLineCap, lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10, font: '12px sans-serif',
    textAlign: 'start' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): AntKingdomEngine {
  const engine = new AntKingdomEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): AntKingdomEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addFood(engine: AntKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.FOOD, amount);
}

function addLeaf(engine: AntKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.LEAF, amount);
}

function addAcid(engine: AntKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.ACID, amount);
}

function addHoney(engine: AntKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.HONEY, amount);
}

/** 触发一次 update */
function tick(engine: AntKingdomEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getFood(engine: AntKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.FOOD)?.amount ?? 0;
}

function getLeaf(engine: AntKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.LEAF)?.amount ?? 0;
}

function getAcid(engine: AntKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.ACID)?.amount ?? 0;
}

function getHoney(engine: AntKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.HONEY)?.amount ?? 0;
}

// ========== 测试 ==========

describe('AntKingdomEngine', () => {
  let engine: AntKingdomEngine;

  beforeEach(() => {
    localStorage.clear();
    engine = createEngine();
  });

  // ==========================================================================
  // 1. 初始化 (15 tests)
  // ==========================================================================

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(AntKingdomEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后食物为 0', () => {
      expect(getFood(engine)).toBe(0);
    });

    it('init 后树叶为 0', () => {
      expect(getLeaf(engine)).toBe(0);
    });

    it('init 后蚁酸为 0', () => {
      expect(getAcid(engine)).toBe(0);
    });

    it('init 后蜂蜜为 0', () => {
      expect(getHoney(engine)).toBe(0);
    });

    it('init 后总食物获得为 0', () => {
      expect(engine.totalFoodEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后选中建筑索引为 0', () => {
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 ant-kingdom', () => {
      expect(engine.gameId).toBe('ant-kingdom');
    });

    it('init 后食物已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.FOOD);
      expect(res.unlocked).toBe(true);
    });

    it('init 后树叶未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.LEAF);
      expect(res.unlocked).toBe(false);
    });

    it('init 后蚁酸未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.ACID);
      expect(res.unlocked).toBe(false);
    });

    it('init 后蜂蜜未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.HONEY);
      expect(res.unlocked).toBe(false);
    });
  });

  // ==========================================================================
  // 2. 建筑初始化 (8 tests)
  // ==========================================================================

  describe('建筑初始化', () => {
    it('应有 6 种建筑', () => {
      expect(BUILDINGS.length).toBe(6);
    });

    it('初始只有蚁穴解锁', () => {
      const nest = (engine as any).upgrades.get(BUILDING_IDS.NEST);
      expect(nest.unlocked).toBe(true);
    });

    it('真菌农场初始未解锁', () => {
      const farm = (engine as any).upgrades.get(BUILDING_IDS.FUNGUS_FARM);
      expect(farm.unlocked).toBe(false);
    });

    it('蚁酸工厂初始未解锁', () => {
      const factory = (engine as any).upgrades.get(BUILDING_IDS.ACID_FACTORY);
      expect(factory.unlocked).toBe(false);
    });

    it('育婴室初始未解锁', () => {
      const nursery = (engine as any).upgrades.get(BUILDING_IDS.NURSERY);
      expect(nursery.unlocked).toBe(false);
    });

    it('兵蚁训练营初始未解锁', () => {
      const camp = (engine as any).upgrades.get(BUILDING_IDS.SOLDIER_CAMP);
      expect(camp.unlocked).toBe(false);
    });

    it('所有建筑初始等级为 0', () => {
      for (const building of BUILDINGS) {
        expect(engine.getBuildingLevel(building.id)).toBe(0);
      }
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ==========================================================================
  // 3. 蚂蚁兵种初始化 (8 tests)
  // ==========================================================================

  describe('蚂蚁兵种初始化', () => {
    it('应有 6 种蚂蚁兵种', () => {
      expect(ANTS.length).toBe(6);
    });

    it('初始只有工蚁已解锁', () => {
      expect(engine.unlockedAnts).toEqual([ANT_IDS.WORKER]);
    });

    it('兵蚁初始未解锁', () => {
      expect(engine.isAntUnlocked(ANT_IDS.SOLDIER)).toBe(false);
    });

    it('侦察蚁初始未解锁', () => {
      expect(engine.isAntUnlocked(ANT_IDS.SCOUT)).toBe(false);
    });

    it('收割蚁初始未解锁', () => {
      expect(engine.isAntUnlocked(ANT_IDS.HARVESTER)).toBe(false);
    });

    it('织叶蚁初始未解锁', () => {
      expect(engine.isAntUnlocked(ANT_IDS.WEAVER)).toBe(false);
    });

    it('子弹蚁初始未解锁', () => {
      expect(engine.isAntUnlocked(ANT_IDS.BULLET_ANT)).toBe(false);
    });

    it('蚂蚁兵种 ID 唯一', () => {
      const ids = ANTS.map(a => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ==========================================================================
  // 4. 生命周期 (4 tests)
  // ==========================================================================

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
  });

  // ==========================================================================
  // 5. 资源系统 (15 tests)
  // ==========================================================================

  describe('资源系统', () => {
    it('addResource 增加食物', () => {
      addFood(engine, 100);
      expect(getFood(engine)).toBe(100);
    });

    it('addResource 累加食物', () => {
      addFood(engine, 50);
      addFood(engine, 30);
      expect(getFood(engine)).toBe(80);
    });

    it('addResource 增加树叶', () => {
      addLeaf(engine, 25);
      expect(getLeaf(engine)).toBe(25);
    });

    it('addResource 增加蚁酸', () => {
      addAcid(engine, 10);
      expect(getAcid(engine)).toBe(10);
    });

    it('addResource 增加蜂蜜', () => {
      addHoney(engine, 5);
      expect(getHoney(engine)).toBe(5);
    });

    it('getResource 返回 undefined 对不存在的 ID', () => {
      const res = (engine as any).getResource('nonexistent');
      expect(res).toBeUndefined();
    });

    it('addResource 正数自动解锁资源', () => {
      // 树叶初始未解锁
      expect((engine as any).getResource(RESOURCE_IDS.LEAF).unlocked).toBe(false);
      addLeaf(engine, 10);
      expect((engine as any).getResource(RESOURCE_IDS.LEAF).unlocked).toBe(true);
    });

    it('spendResource 扣除资源', () => {
      addFood(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.FOOD, 40);
      expect(getFood(engine)).toBe(60);
    });

    it('spendResource 资源不足返回 false', () => {
      addFood(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.FOOD, 50);
      expect(result).toBe(false);
      expect(getFood(engine)).toBe(10);
    });

    it('hasResource 检查资源充足', () => {
      addFood(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.FOOD, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.FOOD, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addFood(engine, 100);
      addLeaf(engine, 50);
      expect((engine as any).canAfford({ food: 50, leaf: 30 })).toBe(true);
      expect((engine as any).canAfford({ food: 50, leaf: 60 })).toBe(false);
    });

    it('getUnlockedResources 返回已解锁资源', () => {
      const unlocked = (engine as any).getUnlockedResources();
      // 初始只有食物解锁
      expect(unlocked.length).toBe(1);
      expect(unlocked[0].id).toBe(RESOURCE_IDS.FOOD);
    });

    it('addResource 触发 resourceChange 事件', () => {
      const listener = vi.fn();
      engine.on('resourceChange', listener);
      addFood(engine, 50);
      expect(listener).toHaveBeenCalledWith(RESOURCE_IDS.FOOD, 50);
    });

    it('spendResource 触发 resourceChange 事件', () => {
      addFood(engine, 100);
      const listener = vi.fn();
      engine.on('resourceChange', listener);
      (engine as any).spendResource(RESOURCE_IDS.FOOD, 30);
      expect(listener).toHaveBeenCalledWith(RESOURCE_IDS.FOOD, 70);
    });

    it('资源不超 maxAmount', () => {
      // 食物 maxAmount 是 Infinity，所以这个测试验证不会变成 NaN
      addFood(engine, Number.MAX_SAFE_INTEGER);
      expect(getFood(engine)).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  // ==========================================================================
  // 6. 资源解锁 (5 tests)
  // ==========================================================================

  describe('资源解锁', () => {
    it('食物达到 50 时解锁树叶', () => {
      engine.start();
      addFood(engine, 60);
      tick(engine, 16);
      const leaf = (engine as any).getResource(RESOURCE_IDS.LEAF);
      expect(leaf.unlocked).toBe(true);
    });

    it('树叶达到 50 时解锁蚁酸', () => {
      engine.start();
      addLeaf(engine, 60);
      tick(engine, 16);
      const acid = (engine as any).getResource(RESOURCE_IDS.ACID);
      expect(acid.unlocked).toBe(true);
    });

    it('声望后解锁蜂蜜', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      tick(engine, 16);
      const honey = (engine as any).getResource(RESOURCE_IDS.HONEY);
      expect(honey.unlocked).toBe(true);
    });

    it('条件未满足时资源保持锁定', () => {
      engine.start();
      addFood(engine, 10);
      tick(engine, 16);
      const leaf = (engine as any).getResource(RESOURCE_IDS.LEAF);
      expect(leaf.unlocked).toBe(false);
    });

    it('资源解锁触发 resourceUnlocked 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('resourceUnlocked', listener);
      addFood(engine, 60);
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith(RESOURCE_IDS.LEAF);
    });
  });

  // ==========================================================================
  // 7. 点击系统 (10 tests)
  // ==========================================================================

  describe('点击系统', () => {
    it('playing 状态下点击获得食物', () => {
      engine.start();
      const result = engine.click();
      expect(result).toBeGreaterThan(0);
      expect(getFood(engine)).toBeGreaterThan(0);
    });

    it('点击增加 totalClicks', () => {
      engine.start();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(2);
    });

    it('点击增加 totalFoodEarned', () => {
      engine.start();
      engine.click();
      expect(engine.totalFoodEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击返回 0', () => {
      expect(engine.click()).toBe(0);
    });

    it('paused 状态下点击返回 0', () => {
      engine.start();
      engine.pause();
      expect(engine.click()).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.click();
      expect(listener).toHaveBeenCalled();
    });

    it('多次点击累积食物', () => {
      engine.start();
      for (let i = 0; i < 10; i++) {
        engine.click();
      }
      expect(getFood(engine)).toBeGreaterThan(0);
      expect(engine.totalClicks).toBe(10);
    });

    it('点击返回值等于 getClickPower', () => {
      engine.start();
      const power = engine.getClickPower();
      const result = engine.click();
      expect(result).toBeCloseTo(power, 5);
    });

    it('点击 totalFoodEarned 累积', () => {
      engine.start();
      engine.click();
      const first = engine.totalFoodEarned;
      engine.click();
      expect(engine.totalFoodEarned).toBeGreaterThan(first);
    });
  });

  // ==========================================================================
  // 8. getClickPower (5 tests)
  // ==========================================================================

  describe('getClickPower', () => {
    it('初始点击力量为 FOOD_PER_CLICK * 1.10（工蚁加成）', () => {
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(FOOD_PER_CLICK * 1.10, 5);
    });

    it('育婴室增加点击力量', () => {
      engine.start();
      const nursery = (engine as any).upgrades.get(BUILDING_IDS.NURSERY);
      nursery.level = 3;
      const power = engine.getClickPower();
      expect(power).toBeCloseTo((FOOD_PER_CLICK + 3 * 0.5) * 1.10, 5);
    });

    it('声望增加点击力量', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(FOOD_PER_CLICK * (1 + 10 * PRESTIGE_MULTIPLIER) * 1.10, 5);
    });

    it('育婴室+声望叠加', () => {
      engine.start();
      const nursery = (engine as any).upgrades.get(BUILDING_IDS.NURSERY);
      nursery.level = 2;
      (engine as any).prestige.currency = 5;
      const power = engine.getClickPower();
      // base + nursery * 0.5 = 1 + 1 = 2, * prestige(1+5*0.03=1.15), * worker(1.1)
      expect(power).toBeCloseTo((FOOD_PER_CLICK + 2 * 0.5) * (1 + 5 * PRESTIGE_MULTIPLIER) * 1.10, 5);
    });

    it('getClickPower 始终大于 0', () => {
      expect(engine.getClickPower()).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 9. 建筑系统 (20 tests)
  // ==========================================================================

  describe('建筑系统', () => {
    it('购买蚁穴（初始解锁建筑）', () => {
      engine.start();
      addFood(engine, 100);
      const result = engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(1);
    });

    it('购买建筑扣除资源', () => {
      engine.start();
      addFood(engine, 100);
      const before = getFood(engine);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(getFood(engine)).toBeLessThan(before);
    });

    it('资源不足时购买失败', () => {
      engine.start();
      addFood(engine, 1);
      const result = engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(0);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addFood(engine, 1000);
      const result = engine.purchaseBuilding(BUILDING_IDS.FUNGUS_FARM);
      expect(result).toBe(false);
    });

    it('购买建筑触发 upgradePurchased 事件', () => {
      engine.start();
      addFood(engine, 100);
      const listener = vi.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(listener).toHaveBeenCalledWith(BUILDING_IDS.NEST, 1);
    });

    it('getBuildingCost 返回正确的费用', () => {
      const cost = engine.getBuildingCost(BUILDING_IDS.NEST);
      expect(cost).toBeDefined();
      expect(cost.food).toBeGreaterThan(0);
    });

    it('buyBuildingByIndex 正常工作', () => {
      engine.start();
      addFood(engine, 100);
      const result = engine.buyBuildingByIndex(0);
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(1);
    });

    it('buyBuildingByIndex 越界返回 false', () => {
      engine.start();
      expect(engine.buyBuildingByIndex(-1)).toBe(false);
      expect(engine.buyBuildingByIndex(999)).toBe(false);
    });

    it('建筑费用随等级增长', () => {
      engine.start();
      addFood(engine, 10000);
      const cost1 = engine.getBuildingCost(BUILDING_IDS.NEST);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      const cost2 = engine.getBuildingCost(BUILDING_IDS.NEST);
      expect(cost2.food).toBeGreaterThan(cost1.food);
    });

    it('连续购买多次建筑等级递增', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(3);
    });

    it('getBuildingLevel 对不存在 ID 返回 0', () => {
      expect(engine.getBuildingLevel('nonexistent')).toBe(0);
    });

    it('getBuildingCost 对不存在 ID 返回空对象', () => {
      const cost = engine.getBuildingCost('nonexistent');
      expect(Object.keys(cost).length).toBe(0);
    });

    it('购买建筑触发 stateChange 事件', () => {
      engine.start();
      addFood(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(listener).toHaveBeenCalled();
    });

    it('建筑费用使用 costMultiplier 计算', () => {
      const nestDef = BUILDINGS.find(b => b.id === BUILDING_IDS.NEST)!;
      const cost0 = engine.getBuildingCost(BUILDING_IDS.NEST);
      expect(cost0.food).toBe(nestDef.baseCost.food); // level 0 → base * 1.15^0 = base
    });

    it('购买建筑后 recalculateProduction 被调用', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      const food = (engine as any).getResource(RESOURCE_IDS.FOOD);
      expect(food.perSecond).toBeGreaterThan(0);
    });

    it('真菌农场需要解锁条件满足才能购买', () => {
      engine.start();
      addFood(engine, 50);
      tick(engine, 16); // 触发解锁检查
      addFood(engine, 200);
      const result = engine.purchaseBuilding(BUILDING_IDS.FUNGUS_FARM);
      expect(result).toBe(true);
    });

    it('建筑等级不超过 maxLevel', () => {
      engine.start();
      const nestDef = BUILDINGS.find(b => b.id === BUILDING_IDS.NEST)!;
      const nursery = (engine as any).upgrades.get(BUILDING_IDS.NEST);
      nursery.level = nestDef.maxLevel;
      addFood(engine, 999999);
      const result = engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(result).toBe(false);
    });

    it('建筑 ID 包含所有定义的 ID', () => {
      const ids = BUILDINGS.map(b => b.id);
      expect(ids).toContain(BUILDING_IDS.NEST);
      expect(ids).toContain(BUILDING_IDS.FUNGUS_FARM);
      expect(ids).toContain(BUILDING_IDS.ACID_FACTORY);
      expect(ids).toContain(BUILDING_IDS.NURSERY);
      expect(ids).toContain(BUILDING_IDS.SOLDIER_CAMP);
      expect(ids).toContain(BUILDING_IDS.HONEY_VAULT);
    });

    it('购买建筑精确扣除费用', () => {
      engine.start();
      addFood(engine, 100);
      const cost = engine.getBuildingCost(BUILDING_IDS.NEST);
      const before = getFood(engine);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(getFood(engine)).toBe(before - cost.food);
    });

    it('多次购买费用递增', () => {
      engine.start();
      addFood(engine, 10000);
      const costs: number[] = [];
      for (let i = 0; i < 3; i++) {
        costs.push(engine.getBuildingCost(BUILDING_IDS.NEST).food);
        engine.purchaseBuilding(BUILDING_IDS.NEST);
      }
      expect(costs[1]).toBeGreaterThan(costs[0]);
      expect(costs[2]).toBeGreaterThan(costs[1]);
    });
  });

  // ==========================================================================
  // 10. 建筑解锁 (5 tests)
  // ==========================================================================

  describe('建筑解锁', () => {
    it('食物达到条件时解锁真菌农场', () => {
      engine.start();
      addFood(engine, 50);
      tick(engine, 16);
      const farm = (engine as any).upgrades.get(BUILDING_IDS.FUNGUS_FARM);
      expect(farm.unlocked).toBe(true);
    });

    it('食物和树叶达到条件时解锁蚁酸工厂', () => {
      engine.start();
      addFood(engine, 200);
      addLeaf(engine, 100);
      tick(engine, 16);
      const factory = (engine as any).upgrades.get(BUILDING_IDS.ACID_FACTORY);
      expect(factory.unlocked).toBe(true);
    });

    it('条件未满足时建筑保持锁定', () => {
      engine.start();
      addFood(engine, 10);
      tick(engine, 16);
      const farm = (engine as any).upgrades.get(BUILDING_IDS.FUNGUS_FARM);
      expect(farm.unlocked).toBe(false);
    });

    it('建筑解锁触发 buildingUnlocked 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('buildingUnlocked', listener);
      addFood(engine, 50);
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith(BUILDING_IDS.FUNGUS_FARM);
    });

    it('部分条件满足不解锁', () => {
      engine.start();
      // 蚁酸工厂需要 food>=100 和 leaf>=20
      addFood(engine, 200);
      // 不加 leaf
      tick(engine, 16);
      const factory = (engine as any).upgrades.get(BUILDING_IDS.ACID_FACTORY);
      expect(factory.unlocked).toBe(false);
    });
  });

  // ==========================================================================
  // 11. 蚂蚁兵种系统 (15 tests)
  // ==========================================================================

  describe('蚂蚁兵种系统', () => {
    it('解锁兵蚁（500 食物）', () => {
      engine.start();
      addFood(engine, 600);
      const result = engine.unlockAnt(ANT_IDS.SOLDIER);
      expect(result).toBe(true);
      expect(engine.isAntUnlocked(ANT_IDS.SOLDIER)).toBe(true);
    });

    it('解锁侦察蚁（2000 食物）', () => {
      engine.start();
      addFood(engine, 2500);
      const result = engine.unlockAnt(ANT_IDS.SCOUT);
      expect(result).toBe(true);
      expect(engine.isAntUnlocked(ANT_IDS.SCOUT)).toBe(true);
    });

    it('解锁收割蚁（5000 食物）', () => {
      engine.start();
      addFood(engine, 6000);
      const result = engine.unlockAnt(ANT_IDS.HARVESTER);
      expect(result).toBe(true);
    });

    it('解锁织叶蚁（15000 食物）', () => {
      engine.start();
      addFood(engine, 20000);
      const result = engine.unlockAnt(ANT_IDS.WEAVER);
      expect(result).toBe(true);
    });

    it('解锁子弹蚁（50000 食物）', () => {
      engine.start();
      addFood(engine, 60000);
      const result = engine.unlockAnt(ANT_IDS.BULLET_ANT);
      expect(result).toBe(true);
    });

    it('资源不足时解锁失败', () => {
      engine.start();
      addFood(engine, 100);
      const result = engine.unlockAnt(ANT_IDS.SOLDIER);
      expect(result).toBe(false);
      expect(engine.isAntUnlocked(ANT_IDS.SOLDIER)).toBe(false);
    });

    it('重复解锁同一兵种失败', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      const result = engine.unlockAnt(ANT_IDS.SOLDIER);
      expect(result).toBe(false);
    });

    it('解锁兵种扣除资源', () => {
      engine.start();
      addFood(engine, 1000);
      const before = getFood(engine);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      expect(getFood(engine)).toBe(before - 500);
    });

    it('解锁无效 ID 返回 false', () => {
      engine.start();
      expect(engine.unlockAnt('invalid-ant')).toBe(false);
    });

    it('解锁兵种触发 antUnlocked 事件', () => {
      engine.start();
      addFood(engine, 600);
      const listener = vi.fn();
      engine.on('antUnlocked', listener);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      expect(listener).toHaveBeenCalledWith(ANT_IDS.SOLDIER);
    });

    it('canUnlockAnt 返回正确状态', () => {
      engine.start();
      expect(engine.canUnlockAnt(ANT_IDS.SOLDIER)).toBe(false);
      addFood(engine, 600);
      expect(engine.canUnlockAnt(ANT_IDS.SOLDIER)).toBe(true);
    });

    it('canUnlockAnt 对已解锁兵种返回 false', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      expect(engine.canUnlockAnt(ANT_IDS.SOLDIER)).toBe(false);
    });

    it('canUnlockAnt 对无效 ID 返回 false', () => {
      expect(engine.canUnlockAnt('invalid')).toBe(false);
    });

    it('工蚁解锁费用为 0', () => {
      const worker = ANTS.find(a => a.id === ANT_IDS.WORKER)!;
      expect(Object.keys(worker.unlockCost).length).toBe(0);
    });

    it('解锁兵种后 unlockedAnts 列表更新', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      expect(engine.unlockedAnts).toContain(ANT_IDS.WORKER);
      expect(engine.unlockedAnts).toContain(ANT_IDS.SOLDIER);
      expect(engine.unlockedAnts.length).toBe(2);
    });
  });

  // ==========================================================================
  // 12. 产出倍率 (10 tests)
  // ==========================================================================

  describe('产出倍率', () => {
    it('初始产出倍率为 1（无加成）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('育婴室增加产出倍率', () => {
      engine.start();
      const nursery = (engine as any).upgrades.get(BUILDING_IDS.NURSERY);
      nursery.level = 5;
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('声望增加产出倍率', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('子弹蚁增加产出倍率', () => {
      engine.start();
      addFood(engine, 60000);
      engine.unlockAnt(ANT_IDS.BULLET_ANT);
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('getResourceMultiplier 对食物有工蚁加成', () => {
      const mult = engine.getResourceMultiplier(RESOURCE_IDS.FOOD);
      expect(mult).toBeGreaterThan(1);
    });

    it('getResourceMultiplier 对树叶有侦察蚁加成', () => {
      engine.start();
      addFood(engine, 3000);
      engine.unlockAnt(ANT_IDS.SCOUT);
      const mult = engine.getResourceMultiplier(RESOURCE_IDS.LEAF);
      expect(mult).toBeGreaterThan(1);
    });

    it('getResourceMultiplier 收割蚁增加树叶倍率', () => {
      engine.start();
      addFood(engine, 8000);
      engine.unlockAnt(ANT_IDS.HARVESTER);
      const mult = engine.getResourceMultiplier(RESOURCE_IDS.LEAF);
      expect(mult).toBeGreaterThan(1);
    });

    it('getEffectiveProduction 返回 0 对未设置产出的资源', () => {
      expect(engine.getEffectiveProduction(RESOURCE_IDS.LEAF)).toBe(0);
    });

    it('getEffectiveProduction 含建筑产出和加成', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      const prod = engine.getEffectiveProduction(RESOURCE_IDS.FOOD);
      expect(prod).toBeGreaterThan(0);
    });

    it('产出倍率各加成叠加', () => {
      engine.start();
      const nursery = (engine as any).upgrades.get(BUILDING_IDS.NURSERY);
      nursery.level = 2;
      (engine as any).prestige.currency = 3;
      addFood(engine, 60000);
      engine.unlockAnt(ANT_IDS.BULLET_ANT);
      const mult = engine.getProductionMultiplier();
      // 1 + 2*0.05 + 3*0.03 + 0.30 = 1 + 0.10 + 0.09 + 0.30 = 1.49
      expect(mult).toBeCloseTo(1.49, 5);
    });
  });

  // ==========================================================================
  // 13. 自动生产 (5 tests)
  // ==========================================================================

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      const before = getFood(engine);
      tick(engine, 1000);
      const after = getFood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      const before = getFood(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getFood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('无建筑时 update 不增加资源', () => {
      engine.start();
      addFood(engine, 50);
      const before = getFood(engine);
      tick(engine, 1000);
      expect(getFood(engine)).toBe(before);
    });

    it('paused 状态不产出', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      engine.pause();
      const before = getFood(engine);
      tick(engine, 1000);
      expect(getFood(engine)).toBe(before);
    });

    it('idle 状态不产出', () => {
      addFood(engine, 100);
      // 未 start，update 不执行
      const before = getFood(engine);
      tick(engine, 1000);
      expect(getFood(engine)).toBe(before);
    });
  });

  // ==========================================================================
  // 14. 声望系统 (15 tests)
  // ==========================================================================

  describe('声望系统', () => {
    it('初始蚁后之息为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('食物不足时无法计算声望精华', () => {
      engine.start();
      expect(engine.calculatePrestigeEssence()).toBe(0);
    });

    it('食物达到最低要求时可以计算声望精华', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD);
      const essence = engine.calculatePrestigeEssence();
      expect(essence).toBeGreaterThanOrEqual(1);
    });

    it('calculatePrestigeEssence 使用 sqrt 公式', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      const essence = engine.calculatePrestigeEssence();
      expect(essence).toBe(Math.floor(Math.sqrt(4)));
    });

    it('声望重置成功', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      const result = engine.doPrestige();
      expect(result).toBe(true);
    });

    it('声望重置后蚁后之息增加', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望重置后声望次数增加', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望重置后资源归零', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      expect(getFood(engine)).toBe(0);
    });

    it('声望重置后声望数据保留', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      expect((engine as any).prestige.count).toBeGreaterThan(0);
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望重置触发 prestigeReset 事件', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      const listener = vi.fn();
      engine.on('prestigeReset', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('食物不足时声望重置失败', () => {
      engine.start();
      addFood(engine, 100);
      const result = engine.doPrestige();
      expect(result).toBe(false);
    });

    it('声望重置后获得蜂蜜', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      expect(getHoney(engine)).toBeGreaterThan(0);
    });

    it('声望重置后建筑等级归零', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(1);
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(0);
    });

    it('多次声望累积蚁后之息', () => {
      engine.start();
      // 第一次声望
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      const first = (engine as any).prestige.currency;

      // 第二次声望
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(first);
      expect((engine as any).prestige.count).toBe(2);
    });
  });

  // ==========================================================================
  // 15. 织叶蚁建筑费用减免 (3 tests)
  // ==========================================================================

  describe('织叶蚁建筑费用减免', () => {
    it('解锁织叶蚁后建筑费用降低', () => {
      engine.start();
      const costBefore = engine.getBuildingCost(BUILDING_IDS.NEST);
      addFood(engine, 20000);
      engine.unlockAnt(ANT_IDS.WEAVER);
      const costAfter = engine.getBuildingCost(BUILDING_IDS.NEST);
      expect(costAfter.food).toBeLessThan(costBefore.food);
    });

    it('织叶蚁减免比例为 20%', () => {
      engine.start();
      const costBefore = engine.getBuildingCost(BUILDING_IDS.NEST);
      addFood(engine, 20000);
      engine.unlockAnt(ANT_IDS.WEAVER);
      const costAfter = engine.getBuildingCost(BUILDING_IDS.NEST);
      // 20% 减免 → costAfter = costBefore * 0.8
      expect(costAfter.food).toBe(Math.floor(costBefore.food * 0.8));
    });

    it('织叶蚁减免对所有资源费用生效', () => {
      engine.start();
      // 蚁酸工厂需要 food 和 leaf
      addFood(engine, 200);
      addLeaf(engine, 100);
      tick(engine, 16); // 解锁
      const costBefore = engine.getBuildingCost(BUILDING_IDS.ACID_FACTORY);
      addFood(engine, 20000);
      engine.unlockAnt(ANT_IDS.WEAVER);
      const costAfter = engine.getBuildingCost(BUILDING_IDS.ACID_FACTORY);
      expect(costAfter.food).toBeLessThan(costBefore.food);
      expect(costAfter.leaf).toBeLessThan(costBefore.leaf);
    });
  });

  // ==========================================================================
  // 16. 存档系统 (8 tests)
  // ==========================================================================

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('ant-kingdom');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addFood(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
      expect(data.resources[RESOURCE_IDS.FOOD].amount).toBeCloseTo(500, 0);
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addFood(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getFood(engine2)).toBeCloseTo(500, 0);
    });

    it('save 包含统计数据', () => {
      engine.start();
      engine.click();
      engine.click();
      const data = engine.save();
      expect(data.statistics).toBeDefined();
      expect(data.statistics.totalClicks).toBe(2);
    });

    it('load 恢复统计数据', () => {
      engine.start();
      engine.click();
      engine.click();
      engine.click();
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.totalClicks).toBe(3);
    });

    it('save 包含蚂蚁兵种数据', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      const data = engine.save();
      expect(data.statistics.unlockedAnts).toBeDefined();
    });

    it('load 恢复蚂蚁兵种数据', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.isAntUnlocked(ANT_IDS.SOLDIER)).toBe(true);
    });
  });

  // ==========================================================================
  // 17. 状态管理 (5 tests)
  // ==========================================================================

  describe('状态管理', () => {
    it('getState 返回完整状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state.totalFoodEarned).toBeDefined();
      expect(state.totalClicks).toBeDefined();
      expect(state.selectedBuildingIndex).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.unlockedAnts).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addFood(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getFood(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复蚂蚁兵种', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.isAntUnlocked(ANT_IDS.SOLDIER)).toBe(true);
    });

    it('loadState 恢复统计数据', () => {
      engine.start();
      engine.click();
      engine.click();
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.totalClicks).toBe(2);
      expect(engine2.totalFoodEarned).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 18. 数字格式化 (8 tests)
  // ==========================================================================

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

    it('万亿使用 T 后缀', () => {
      const result = (engine as any).formatNumber(1500000000000);
      expect(result).toContain('T');
    });

    it('0 返回 0', () => {
      expect((engine as any).formatNumber(0)).toBe('0');
    });

    it('负数处理', () => {
      const result = (engine as any).formatNumber(-100);
      expect(result).toBeDefined();
      expect(result).toContain('-');
    });

    it('Infinity 返回 ∞', () => {
      expect((engine as any).formatNumber(Infinity)).toBe('∞');
    });
  });

  // ==========================================================================
  // 19. 键盘输入 (10 tests)
  // ==========================================================================

  describe('键盘输入', () => {
    it('空格键触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(getFood(engine)).toBeGreaterThan(0);
    });

    it('上箭头减少选中索引', () => {
      engine.start();
      (engine as any)._selectedBuildingIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(1);
    });

    it('上箭头不低于 0', () => {
      engine.start();
      (engine as any)._selectedBuildingIndex = 0;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('下箭头增加选中索引', () => {
      engine.start();
      addFood(engine, 100);
      tick(engine, 16);
      const visibleCount = BUILDINGS.filter(b => {
        const u = (engine as any).upgrades.get(b.id);
        return u && u.unlocked;
      }).length;
      if (visibleCount > 1) {
        engine.handleKeyDown('ArrowDown');
        expect(engine.selectedBuildingIndex).toBe(1);
      }
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getFood(engine)).toBe(0);
    });

    it('handleKeyUp 不抛错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('Enter 键购买选中建筑', () => {
      engine.start();
      addFood(engine, 100);
      // 只有蚁穴可见，索引 0
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(1);
    });

    it('Enter 键资源不足不购买', () => {
      engine.start();
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(BUILDING_IDS.NEST)).toBe(0);
    });

    it('空格键增加 totalClicks', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(engine.totalClicks).toBe(1);
    });

    it('ArrowDown 不超过可见建筑数', () => {
      engine.start();
      // 只有蚁穴可见（1个），ArrowDown 不应超过 0
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedBuildingIndex).toBe(0);
    });
  });

  // ==========================================================================
  // 20. Canvas 渲染 (10 tests)
  // ==========================================================================

  describe('Canvas 渲染', () => {
    it('onRender 不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('渲染后 ctx 定义', () => {
      engine.start();
      const ctx = createMockCtx();
      engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      expect(ctx).toBeDefined();
    });

    it('多次渲染不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      for (let i = 0; i < 10; i++) {
        engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    });

    it('有声望时渲染不报错', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有蚂蚁兵种时渲染不报错', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('idle 状态渲染不报错', () => {
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑时渲染不报错', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.NEST);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有飘字时渲染不报错', () => {
      engine.start();
      engine.click(); // 产生飘字
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('大量资源时渲染不报错', () => {
      engine.start();
      addFood(engine, 999999999);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有兵种解锁时渲染不报错', () => {
      engine.start();
      addFood(engine, 100000);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      engine.unlockAnt(ANT_IDS.SCOUT);
      engine.unlockAnt(ANT_IDS.HARVESTER);
      engine.unlockAnt(ANT_IDS.WEAVER);
      engine.unlockAnt(ANT_IDS.BULLET_ANT);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==========================================================================
  // 21. 边界情况 (10 tests)
  // ==========================================================================

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addFood(engine, Number.MAX_SAFE_INTEGER / 2);
      expect(getFood(engine)).toBeGreaterThan(0);
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

    it('reset 后资源归零', () => {
      engine.start();
      addFood(engine, 500);
      engine.reset();
      engine.init(createCanvas());
      expect(getFood(engine)).toBe(0);
    });

    it('reset 后蚂蚁兵种重置为只有工蚁', () => {
      engine.start();
      addFood(engine, 600);
      engine.unlockAnt(ANT_IDS.SOLDIER);
      engine.reset();
      engine.init(createCanvas());
      expect(engine.unlockedAnts).toEqual([ANT_IDS.WORKER]);
    });

    it('destroy 不崩溃', () => {
      engine.start();
      addFood(engine, 100);
      engine.click();
      expect(() => engine.destroy()).not.toThrow();
    });
  });
});
