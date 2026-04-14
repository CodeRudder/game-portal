/**
 * Ant Kingdom（蚂蚁王国）放置类游戏 — 完整测试套件
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
    engine = createEngine();
  });

  // ========== 初始化 ==========

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

  // ========== 建筑初始化 ==========

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

  // ========== 蚂蚁兵种初始化 ==========

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
  });

  // ========== 点击系统 ==========

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
  });

  // ========== 点击力量 ==========

  describe('getClickPower', () => {
    it('初始点击力量为 FOOD_PER_CLICK * 1.10（工蚁加成）', () => {
      // 工蚁默认解锁，加成 1.10
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(FOOD_PER_CLICK * 1.10, 5);
    });

    it('育婴室增加点击力量', () => {
      engine.start();
      const nursery = (engine as any).upgrades.get(BUILDING_IDS.NURSERY);
      nursery.level = 3;
      const power = engine.getClickPower();
      // base + nurseryLevel * 0.5 = 1 + 1.5 = 2.5, then * prestige, * worker
      expect(power).toBeCloseTo((FOOD_PER_CLICK + 3 * 0.5) * 1.10, 5);
    });

    it('声望增加点击力量', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      const power = engine.getClickPower();
      // 1 * (1 + 10 * 0.03) * 1.10 = 1 * 1.3 * 1.10
      expect(power).toBeCloseTo(FOOD_PER_CLICK * (1 + 10 * PRESTIGE_MULTIPLIER) * 1.10, 5);
    });
  });

  // ========== 建筑系统 ==========

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
      // 真菌农场初始未解锁
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
      // 费用应该增长（costMultiplier > 1）
      expect(cost2.food).toBeGreaterThan(cost1.food);
    });
  });

  // ========== 建筑解锁 ==========

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
  });

  // ========== 资源解锁 ==========

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
  });

  // ========== 蚂蚁兵种系统 ==========

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
  });

  // ========== 产出倍率 ==========

  describe('产出倍率', () => {
    it('初始产出倍率为 1（无加成）', () => {
      // 工蚁默认解锁但不影响 getProductionMultiplier（它影响 getResourceMultiplier）
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
      // 工蚁默认解锁，食物 +10%
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
      // 收割蚁 +25%
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 声望系统 ==========

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
      // 声望后应获得蜂蜜（蚁后之息以蜂蜜体现）
      expect(getHoney(engine)).toBeGreaterThan(0);
    });
  });

  // ========== 存档系统 ==========

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

  // ========== 状态管理 ==========

  describe('状态管理', () => {
    it('getState 返回完整状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toBeDefined();
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
    });
  });

  // ========== 键盘输入 ==========

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
      // 解锁更多建筑
      addFood(engine, 100);
      tick(engine, 16);
      // 确保有多个可见建筑
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
  });

  // ========== Canvas 渲染 ==========

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
  });

  // ========== 自动生产 ==========

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
  });

  // ========== 织叶蚁建筑费用减免 ==========

  describe('织叶蚁建筑费用减免', () => {
    it('解锁织叶蚁后建筑费用降低', () => {
      engine.start();
      const costBefore = engine.getBuildingCost(BUILDING_IDS.NEST);
      addFood(engine, 20000);
      engine.unlockAnt(ANT_IDS.WEAVER);
      const costAfter = engine.getBuildingCost(BUILDING_IDS.NEST);
      expect(costAfter.food).toBeLessThan(costBefore.food);
    });
  });

  // ========== 边界情况 ==========

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
  });
});
