/**
 * 四大文明·古埃及 (Civ Egypt) 放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivEgyptEngine } from '@/games/civ-egypt/CivEgyptEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  FOOD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_FOOD,
  ERAS,
  BUILDINGS,
  BUILDING_IDS,
  COLORS,
  PYRAMID_DRAW,
} from '@/games/civ-egypt/constants';

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

function createEngine(): CivEgyptEngine {
  const engine = new CivEgyptEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): CivEgyptEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addFood(engine: CivEgyptEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.FOOD, amount);
}

function addGold(engine: CivEgyptEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.GOLD, amount);
}

function addFaith(engine: CivEgyptEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.FAITH, amount);
}

/** 触发一次 update */
function tick(engine: CivEgyptEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getFood(engine: CivEgyptEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.FOOD)?.amount ?? 0;
}

function getGold(engine: CivEgyptEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.GOLD)?.amount ?? 0;
}

function getFaith(engine: CivEgyptEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.FAITH)?.amount ?? 0;
}

// ========== 测试 ==========

describe('CivEgyptEngine', () => {
  let engine: CivEgyptEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(CivEgyptEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后粮食为 0', () => {
      expect(getFood(engine)).toBe(0);
    });

    it('init 后黄金为 0', () => {
      expect(getGold(engine)).toBe(0);
    });

    it('init 后信仰为 0', () => {
      expect(getFaith(engine)).toBe(0);
    });

    it('init 后总粮食获得为 0', () => {
      expect(engine.totalFoodEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 civ-egypt', () => {
      expect(engine.gameId).toBe('civ-egypt');
    });

    it('init 后粮食已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.FOOD);
      expect(res.unlocked).toBe(true);
    });

    it('init 后黄金未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.GOLD);
      expect(res.unlocked).toBe(false);
    });

    it('init 后信仰未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.FAITH);
      expect(res.unlocked).toBe(false);
    });

    it('init 后法老威望为 0', () => {
      expect(engine.pharaohPrestige).toBe(0);
    });

    it('init 后当前时代为前王朝', () => {
      expect(engine.currentEra.id).toBe('predynastic');
    });

    it('init 后法老威望等级为部落首领', () => {
      expect(engine.getPharaohPrestigeLevel()).toBe('部落首领');
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('应有 3 种资源 ID', () => {
      expect(Object.keys(RESOURCE_IDS).length).toBe(3);
    });

    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('应有 4 个时代', () => {
      expect(ERAS.length).toBe(4);
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个建筑有名称', () => {
      BUILDINGS.forEach((b) => {
        expect(b.name).toBeTruthy();
      });
    });

    it('每个建筑有图标', () => {
      BUILDINGS.forEach((b) => {
        expect(b.icon).toBeTruthy();
      });
    });

    it('每个建筑有正数基础产出', () => {
      BUILDINGS.forEach((b) => {
        expect(b.baseProduction).toBeGreaterThan(0);
      });
    });

    it('每个建筑费用递增系数大于 1', () => {
      BUILDINGS.forEach((b) => {
        expect(b.costMultiplier).toBeGreaterThan(1);
      });
    });

    it('每个建筑有最大等级', () => {
      BUILDINGS.forEach((b) => {
        expect(b.maxLevel).toBeGreaterThan(0);
      });
    });

    it('时代 ID 唯一', () => {
      const ids = ERAS.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('时代产出倍率递增', () => {
      for (let i = 1; i < ERAS.length; i++) {
        expect(ERAS[i].productionMultiplier).toBeGreaterThan(ERAS[i - 1].productionMultiplier);
      }
    });

    it('MIN_PRESTIGE_FOOD 为正数', () => {
      expect(MIN_PRESTIGE_FOOD).toBeGreaterThan(0);
    });

    it('PRESTIGE_BONUS_MULTIPLIER 为正数', () => {
      expect(PRESTIGE_BONUS_MULTIPLIER).toBeGreaterThan(0);
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

    it('reset 后粮食归零', () => {
      engine.start();
      addFood(engine, 1000);
      engine.reset();
      expect(getFood(engine)).toBe(0);
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
      addFood(engine, 500);
      engine.reset();
      engine.start();
      expect(getFood(engine)).toBe(0);
    });
  });

  // ========== 点击产生粮食 ==========

  describe('点击产生粮食', () => {
    it('点击一次产生粮食', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getFood(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生粮食', () => {
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

    it('点击增加总粮食获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalFoodEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getFood(engine)).toBe(0);
    });

    it('paused 状态下点击无效', () => {
      engine.start();
      engine.pause();
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      engine.start();
      const listener = vi.fn();
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
    it('增加粮食', () => {
      addFood(engine, 100);
      expect(getFood(engine)).toBe(100);
    });

    it('增加黄金', () => {
      addGold(engine, 50);
      expect(getGold(engine)).toBe(50);
    });

    it('增加信仰', () => {
      addFaith(engine, 30);
      expect(getFaith(engine)).toBe(30);
    });

    it('消耗粮食成功', () => {
      addFood(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.FOOD, 50);
      expect(getFood(engine)).toBe(50);
    });

    it('消耗粮食失败（不足）', () => {
      addFood(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.FOOD, 50);
      expect(result).toBeFalsy();
      expect(getFood(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addFood(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.FOOD, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.FOOD, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addFood(engine, 100);
      addGold(engine, 50);
      expect((engine as any).canAfford({ [RESOURCE_IDS.FOOD]: 50, [RESOURCE_IDS.GOLD]: 20 })).toBe(true);
      expect((engine as any).canAfford({ [RESOURCE_IDS.FOOD]: 50, [RESOURCE_IDS.GOLD]: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有农田解锁', () => {
      const farm = (engine as any).upgrades.get(BUILDING_IDS.FARM);
      expect(farm.unlocked).toBe(true);
    });

    it('粮仓初始未解锁', () => {
      const granary = (engine as any).upgrades.get(BUILDING_IDS.GRANARY);
      expect(granary.unlocked).toBe(false);
    });

    it('采石场初始未解锁', () => {
      const quarry = (engine as any).upgrades.get(BUILDING_IDS.QUARRY);
      expect(quarry.unlocked).toBe(false);
    });

    it('购买农田成功', () => {
      engine.start();
      addFood(engine, 100);
      const result = engine.purchaseBuilding(0); // farm
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买农田失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addFood(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2[RESOURCE_IDS.FOOD]).toBeGreaterThan(cost1[RESOURCE_IDS.FOOD]);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addFood(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addFood(engine, 10000);
      // 粮仓需要农田等级 > 0
      const result = engine.purchaseBuilding(1); // granary
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addFood(engine, 100);
      const before = getFood(engine);
      engine.purchaseBuilding(0);
      expect(getFood(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addFood(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑增加统计计数', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0);
      expect(engine.statistics.totalBuildingsBuilt).toBe(1);
    });

    it('建筑达到最大等级后无法继续购买', () => {
      engine.start();
      // 农田 maxLevel = 50，直接设置等级
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.FARM);
      upgrade.level = 50;
      addFood(engine, 1e10);
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('粮仓在农田有等级后解锁', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      const granary = (engine as any).upgrades.get(BUILDING_IDS.GRANARY);
      expect(granary.unlocked).toBe(true);
    });

    it('采石场在农田有等级后解锁', () => {
      engine.start();
      addFood(engine, 1000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      const quarry = (engine as any).upgrades.get(BUILDING_IDS.QUARRY);
      expect(quarry.unlocked).toBe(true);
    });

    it('金字塔需要采石场和粮仓', () => {
      engine.start();
      addFood(engine, 100000);
      // 购买农田
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      // 购买粮仓和采石场
      engine.purchaseBuilding(1); // granary
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      const pyramid = (engine as any).upgrades.get(BUILDING_IDS.PYRAMID);
      expect(pyramid.unlocked).toBe(true);
    });

    it('神庙需要采石场', () => {
      engine.start();
      addFood(engine, 100000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      const temple = (engine as any).upgrades.get(BUILDING_IDS.TEMPLE);
      expect(temple.unlocked).toBe(true);
    });

    it('灌溉系统需要粮仓', () => {
      engine.start();
      addFood(engine, 100000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(1); // granary
      tick(engine, 16);
      const irrigation = (engine as any).upgrades.get(BUILDING_IDS.IRRIGATION);
      expect(irrigation.unlocked).toBe(true);
    });

    it('集市需要神庙', () => {
      engine.start();
      addFood(engine, 1e6);
      addGold(engine, 1000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      engine.purchaseBuilding(4); // temple
      tick(engine, 16);
      const marketplace = (engine as any).upgrades.get(BUILDING_IDS.MARKETPLACE);
      expect(marketplace.unlocked).toBe(true);
    });

    it('方尖碑需要金字塔和神庙', () => {
      engine.start();
      addFood(engine, 1e7);
      addGold(engine, 5000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(1); // granary
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      engine.purchaseBuilding(3); // pyramid
      engine.purchaseBuilding(4); // temple
      tick(engine, 16);
      const obelisk = (engine as any).upgrades.get(BUILDING_IDS.OBELISK);
      expect(obelisk.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('黄金在采石场等级>=1时解锁', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      const gold = (engine as any).getResource(RESOURCE_IDS.GOLD);
      expect(gold.unlocked).toBe(true);
    });

    it('信仰在神庙等级>=1时解锁', () => {
      engine.start();
      addFood(engine, 1e6);
      addGold(engine, 500);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      engine.purchaseBuilding(4); // temple
      tick(engine, 16);
      const faith = (engine as any).getResource(RESOURCE_IDS.FAITH);
      expect(faith.unlocked).toBe(true);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始声望货币为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('粮食不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（粮食不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('粮食达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      const blessings = engine.doPrestige();
      expect(blessings).toBeGreaterThan(0);
    });

    it('声望后声望货币增加', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect(getFood(engine)).toBe(0);
    });

    it('声望保留法老威望', () => {
      engine.start();
      (engine as any)._pharaohPrestige = 2;
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect(engine.pharaohPrestige).toBeGreaterThan(0);
    });

    it('声望增加法老威望', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      const blessings = engine.doPrestige();
      expect(engine.pharaohPrestige).toBe(blessings);
    });

    it('声望保留时代进度', () => {
      engine.start();
      (engine as any)._currentEraIndex = 2;
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect(engine.currentEraIndex).toBe(2);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('多次声望累积声望货币', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      const firstBlessings = (engine as any).prestige.currency;

      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 9;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(firstBlessings);
    });
  });

  // ========== 法老威望系统 ==========

  describe('法老威望系统', () => {
    it('初始威望等级为部落首领', () => {
      expect(engine.getPharaohPrestigeLevel()).toBe('部落首领');
    });

    it('威望 1 为初立法老', () => {
      (engine as any)._pharaohPrestige = 1;
      expect(engine.getPharaohPrestigeLevel()).toBe('初立法老');
    });

    it('威望 3 为英明法老', () => {
      (engine as any)._pharaohPrestige = 3;
      expect(engine.getPharaohPrestigeLevel()).toBe('英明法老');
    });

    it('威望 6 为伟大法老', () => {
      (engine as any)._pharaohPrestige = 6;
      expect(engine.getPharaohPrestigeLevel()).toBe('伟大法老');
    });

    it('威望 10 为半神法老', () => {
      (engine as any)._pharaohPrestige = 10;
      expect(engine.getPharaohPrestigeLevel()).toBe('半神法老');
    });

    it('威望 15 仍为半神法老', () => {
      (engine as any)._pharaohPrestige = 15;
      expect(engine.getPharaohPrestigeLevel()).toBe('半神法老');
    });
  });

  // ========== 时代演进 ==========

  describe('时代演进', () => {
    it('初始时代为前王朝', () => {
      expect(engine.currentEra.id).toBe('predynastic');
      expect(engine.currentEra.name).toBe('前王朝时代');
    });

    it('前王朝产出倍率为 1.0', () => {
      expect(engine.getEraProductionMultiplier()).toBe(1.0);
    });

    it('法老威望达到 1 时演进到古王国', () => {
      engine.start();
      (engine as any)._pharaohPrestige = 1;
      tick(engine, 16);
      expect(engine.currentEra.id).toBe('old_kingdom');
    });

    it('法老威望达到 3 时演进到中王国', () => {
      engine.start();
      (engine as any)._pharaohPrestige = 3;
      tick(engine, 16);
      expect(engine.currentEra.id).toBe('middle_kingdom');
    });

    it('法老威望达到 6 时演进到新王国', () => {
      engine.start();
      (engine as any)._pharaohPrestige = 6;
      tick(engine, 16);
      expect(engine.currentEra.id).toBe('new_kingdom');
    });

    it('时代演进触发 eraAdvanced 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('eraAdvanced', listener);
      (engine as any)._pharaohPrestige = 1;
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith('old_kingdom', '古王国时代');
    });

    it('时代演进更新最高时代统计', () => {
      engine.start();
      (engine as any)._pharaohPrestige = 3;
      tick(engine, 16);
      expect(engine.statistics.highestEraReached).toBeGreaterThanOrEqual(2);
    });

    it('古王国产出倍率为 1.5', () => {
      (engine as any)._currentEraIndex = 1;
      expect(engine.getEraProductionMultiplier()).toBe(1.5);
    });

    it('中王国产出倍率为 2.0', () => {
      (engine as any)._currentEraIndex = 2;
      expect(engine.getEraProductionMultiplier()).toBe(2.0);
    });

    it('新王国产出倍率为 3.0', () => {
      (engine as any)._currentEraIndex = 3;
      expect(engine.getEraProductionMultiplier()).toBe(3.0);
    });

    it('getCurrentEraName 返回正确名称', () => {
      expect(engine.getCurrentEraName()).toBe('前王朝时代');
      (engine as any)._currentEraIndex = 1;
      expect(engine.getCurrentEraName()).toBe('古王国时代');
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随赐福增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * PRESTIGE_BONUS_MULTIPLIER, 2);
    });

    it('时代倍率影响点击产出', () => {
      engine.start();
      (engine as any)._currentEraIndex = 1; // 古王国 1.5x
      const gained = engine.click();
      expect(gained).toBeGreaterThanOrEqual(1.5);
    });

    it('声望倍率影响点击产出', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      const gained = engine.click();
      expect(gained).toBeGreaterThan(1);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('civ-egypt');
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

    it('save 包含设置信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).pharaohPrestige).toBeDefined();
      expect((data.settings as any).currentEraIndex).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
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

    it('load 恢复法老威望', () => {
      engine.start();
      (engine as any)._pharaohPrestige = 5;
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.pharaohPrestige).toBe(5);
    });

    it('load 恢复时代', () => {
      engine.start();
      (engine as any)._currentEraIndex = 2;
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.currentEraIndex).toBe(2);
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
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
      expect(state.currentEra).toBeDefined();
      expect(state.pharaohPrestige).toBeDefined();
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

    it('loadState 恢复法老威望', () => {
      engine.start();
      (engine as any)._pharaohPrestige = 7;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.pharaohPrestige).toBe(7);
    });

    it('loadState 恢复时代', () => {
      engine.start();
      (engine as any)._currentEraIndex = 3;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.currentEraIndex).toBe(3);
    });

    it('loadState 恢复建筑', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // farm
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.getBuildingLevel(0)).toBe(1);
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

    it('负数返回带负号', () => {
      const result = (engine as any).formatNumber(-500);
      expect(result).toContain('-');
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
      addFood(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('大写 P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.handleKeyDown('P');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getFood(engine)).toBe(0);
    });

    it('handleKeyUp 不抛错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ========== 渲染 ==========

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

    it('有建筑时渲染正常', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('不同时代渲染正常', () => {
      engine.start();
      for (let i = 0; i < ERAS.length; i++) {
        (engine as any)._currentEraIndex = i;
        const ctx = createMockCtx();
        expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
      }
    });

    it('有沙尘粒子时渲染正常', () => {
      engine.start();
      // 触发一些 update 来产生粒子
      for (let i = 0; i < 100; i++) {
        tick(engine, 16);
      }
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有飘字时渲染正常', () => {
      engine.start();
      engine.click();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0); // farm
      const before = getFood(engine);
      tick(engine, 1000);
      const after = getFood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0);
      const before = getFood(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getFood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('采石场产出黄金', () => {
      engine.start();
      addFood(engine, 100000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      // 确认黄金已解锁
      const gold = (engine as any).getResource(RESOURCE_IDS.GOLD);
      expect(gold.unlocked).toBe(true);
      // 确认黄金产出
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('神庙产出信仰', () => {
      engine.start();
      addFood(engine, 1e6);
      addGold(engine, 500);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // quarry
      tick(engine, 16);
      engine.purchaseBuilding(4); // temple
      tick(engine, 16);
      const faith = (engine as any).getResource(RESOURCE_IDS.FAITH);
      expect(faith.unlocked).toBe(true);
      expect(faith.perSecond).toBeGreaterThan(0);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addFood(engine, 1e14);
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

    it('statistics getter 返回副本', () => {
      const stats1 = engine.statistics;
      const stats2 = engine.statistics;
      expect(stats1).not.toBe(stats2);
    });

    it('getBuildingCost 无效索引返回空对象', () => {
      const cost = engine.getBuildingCost(-1);
      expect(Object.keys(cost).length).toBe(0);
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });
  });

  // ========== 综合流程 ==========

  describe('综合流程', () => {
    it('完整游戏流程：点击→建筑→声望→时代演进', () => {
      // 1. 开始游戏
      engine.start();
      expect((engine as any)._status).toBe('playing');

      // 2. 点击获取粮食
      for (let i = 0; i < 100; i++) {
        engine.click();
      }
      expect(getFood(engine)).toBeGreaterThan(0);

      // 3. 购买农田
      addFood(engine, 500);
      engine.purchaseBuilding(0);
      expect(engine.getBuildingLevel(0)).toBe(1);

      // 4. 声望
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      const blessings = engine.doPrestige();
      expect(blessings).toBeGreaterThan(0);
      expect(getFood(engine)).toBe(0);
      expect(engine.pharaohPrestige).toBeGreaterThan(0);

      // 5. 检查时代（威望可能不够演进）
      expect(engine.currentEra).toBeDefined();
    });

    it('多次声望后时代演进', () => {
      engine.start();

      // 第一次声望
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();

      // 第二次声望
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 9;
      engine.doPrestige();

      // 检查法老威望增长
      expect(engine.pharaohPrestige).toBeGreaterThan(0);
    });

    it('存档/读档完整流程', () => {
      engine.start();
      addFood(engine, 1000);
      engine.purchaseBuilding(0);
      (engine as any)._pharaohPrestige = 3;
      (engine as any)._currentEraIndex = 1;

      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);

      expect(engine2.pharaohPrestige).toBe(3);
      expect(engine2.currentEraIndex).toBe(1);
      expect(engine2.getBuildingLevel(0)).toBe(1);
    });

    it('getState/loadState 完整流程', () => {
      engine.start();
      addFood(engine, 2000);
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      (engine as any)._pharaohPrestige = 5;
      (engine as any)._currentEraIndex = 2;

      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);

      expect(engine2.pharaohPrestige).toBe(5);
      expect(engine2.currentEraIndex).toBe(2);
      expect(engine2.getBuildingLevel(0)).toBe(1);
    });
  });
});
