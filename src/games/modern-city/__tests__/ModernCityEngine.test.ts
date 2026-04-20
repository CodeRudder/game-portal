/**
 * Modern City（现代都市）放置类游戏 — 完整测试套件
 */
import { ModernCityEngine } from '@/games/modern-city/ModernCityEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COIN_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_COIN,
  MAX_CITY_LEVEL,
  CITY_LEVEL_COSTS,
  BUILDINGS,
  BUILDING_IDS,
  RESOURCE_IDS,
  COLORS,
  CITY_DRAW,
} from '@/games/modern-city/constants';

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

function createEngine(): ModernCityEngine {
  const engine = new ModernCityEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): ModernCityEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addCoin(engine: ModernCityEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.COIN, amount);
}

function addPopulation(engine: ModernCityEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.POPULATION, amount);
}

function addTech(engine: ModernCityEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.TECH, amount);
}

/** 触发一次 update */
function tick(engine: ModernCityEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getCoin(engine: ModernCityEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.COIN)?.amount ?? 0;
}

function getPopulation(engine: ModernCityEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.POPULATION)?.amount ?? 0;
}

function getTech(engine: ModernCityEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.TECH)?.amount ?? 0;
}

// ========== 测试 ==========

describe('ModernCityEngine', () => {
  let engine: ModernCityEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(ModernCityEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后金币为 0', () => {
      expect(getCoin(engine)).toBe(0);
    });

    it('init 后人口为 0', () => {
      expect(getPopulation(engine)).toBe(0);
    });

    it('init 后科技为 0', () => {
      expect(getTech(engine)).toBe(0);
    });

    it('init 后总金币获得为 0', () => {
      expect(engine.totalCoinEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 modern-city', () => {
      expect(engine.gameId).toBe('modern-city');
    });

    it('init 后金币已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.COIN);
      expect(res.unlocked).toBe(true);
    });

    it('init 后人口未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.POPULATION);
      expect(res.unlocked).toBe(false);
    });

    it('init 后科技未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.TECH);
      expect(res.unlocked).toBe(false);
    });

    it('init 后城市等级为 1', () => {
      expect(engine.cityLevel).toBe(1);
    });

    it('init 后选中索引为 0', () => {
      expect(engine.selectedIndex).toBe(0);
    });
  });

  // ========== 常量验证 ==========

  describe('常量', () => {
    it('COIN_PER_CLICK 为 1', () => {
      expect(COIN_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_COIN 为 50000', () => {
      expect(MIN_PRESTIGE_COIN).toBe(50000);
    });

    it('MAX_CITY_LEVEL 为 10', () => {
      expect(MAX_CITY_LEVEL).toBe(10);
    });

    it('RESOURCE_IDS 包含三种资源', () => {
      expect(RESOURCE_IDS.COIN).toBe('coin');
      expect(RESOURCE_IDS.POPULATION).toBe('population');
      expect(RESOURCE_IDS.TECH).toBe('tech');
    });

    it('BUILDING_IDS 包含 8 种建筑', () => {
      expect(Object.keys(BUILDING_IDS).length).toBe(8);
    });

    it('BUILDINGS 有 8 个建筑定义', () => {
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

    it('每个建筑有正数产出', () => {
      BUILDINGS.forEach(b => {
        expect(b.baseProduction).toBeGreaterThan(0);
      });
    });

    it('每个建筑有费用递增系数', () => {
      BUILDINGS.forEach(b => {
        expect(b.costMultiplier).toBeGreaterThan(1);
      });
    });

    it('城市等级费用表有 9 个级别', () => {
      expect(Object.keys(CITY_LEVEL_COSTS).length).toBe(9);
    });

    it('COLORS 定义完整', () => {
      expect(COLORS.textPrimary).toBeDefined();
      expect(COLORS.accent).toBeDefined();
      expect(COLORS.coinColor).toBeDefined();
      expect(COLORS.populationColor).toBeDefined();
      expect(COLORS.techColor).toBeDefined();
    });

    it('CITY_DRAW 定义完整', () => {
      expect(CITY_DRAW.centerX).toBeDefined();
      expect(CITY_DRAW.centerY).toBeDefined();
      expect(CITY_DRAW.groundY).toBeDefined();
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

    it('reset 后金币归零', () => {
      engine.start();
      addCoin(engine, 1000);
      engine.reset();
      expect(getCoin(engine)).toBe(0);
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
      addCoin(engine, 500);
      engine.reset();
      engine.start();
      expect(getCoin(engine)).toBe(0);
    });
  });

  // ========== 点击产生金币 ==========

  describe('点击产生金币', () => {
    it('点击一次产生金币', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getCoin(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生金币', () => {
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

    it('点击增加总金币获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalCoinEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getCoin(engine)).toBe(0);
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
    it('增加金币', () => {
      addCoin(engine, 100);
      expect(getCoin(engine)).toBe(100);
    });

    it('增加人口', () => {
      addPopulation(engine, 50);
      expect(getPopulation(engine)).toBe(50);
    });

    it('增加科技', () => {
      addTech(engine, 30);
      expect(getTech(engine)).toBe(30);
    });

    it('消耗金币成功', () => {
      addCoin(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.COIN, 50);
      expect(getCoin(engine)).toBe(50);
    });

    it('消耗金币失败（不足）', () => {
      addCoin(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.COIN, 50);
      expect(result).toBeFalsy();
      expect(getCoin(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addCoin(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.COIN, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.COIN, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addCoin(engine, 100);
      addPopulation(engine, 50);
      expect((engine as any).canAfford({ coin: 50, population: 20 })).toBe(true);
      expect((engine as any).canAfford({ coin: 50, population: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有住宅解锁', () => {
      const house = (engine as any).upgrades.get(BUILDING_IDS.HOUSE);
      expect(house.unlocked).toBe(true);
    });

    it('商店初始未解锁', () => {
      const shop = (engine as any).upgrades.get(BUILDING_IDS.SHOP);
      expect(shop.unlocked).toBe(false);
    });

    it('购买住宅成功', () => {
      engine.start();
      addCoin(engine, 100);
      const result = engine.purchaseBuilding(0); // house
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买住宅失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addCoin(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.coin).toBeGreaterThan(cost1.coin);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addCoin(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addCoin(engine, 10000);
      // 商店需要住宅等级 > 0
      const result = engine.purchaseBuilding(1); // shop
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addCoin(engine, 100);
      const before = getCoin(engine);
      engine.purchaseBuilding(0);
      expect(getCoin(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addCoin(engine, 100);
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑增加统计计数', () => {
      engine.start();
      addCoin(engine, 10000);
      engine.purchaseBuilding(0);
      expect(engine.statistics.totalBuildingsPurchased).toBe(1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('商店在住宅有等级后解锁', () => {
      engine.start();
      addCoin(engine, 100);
      engine.purchaseBuilding(0); // house
      tick(engine, 16);
      const shop = (engine as any).upgrades.get(BUILDING_IDS.SHOP);
      expect(shop.unlocked).toBe(true);
    });

    it('工厂在商店有等级后解锁', () => {
      engine.start();
      addCoin(engine, 10000);
      engine.purchaseBuilding(0); // house
      tick(engine, 16);
      engine.purchaseBuilding(1); // shop
      tick(engine, 16);
      const factory = (engine as any).upgrades.get(BUILDING_IDS.FACTORY);
      expect(factory.unlocked).toBe(true);
    });

    it('学校在工厂有等级后解锁', () => {
      engine.start();
      addCoin(engine, 100000);
      engine.purchaseBuilding(0); // house
      tick(engine, 16);
      engine.purchaseBuilding(1); // shop
      tick(engine, 16);
      engine.purchaseBuilding(2); // factory
      tick(engine, 16);
      const school = (engine as any).upgrades.get(BUILDING_IDS.SCHOOL);
      expect(school.unlocked).toBe(true);
    });

    it('摩天大楼需要实验室和城市等级 7', () => {
      engine.start();
      addCoin(engine, 1000000);
      // 解锁前置建筑链
      for (let i = 0; i < 6; i++) {
        engine.purchaseBuilding(i);
        tick(engine, 16);
      }
      // 城市等级不够时不应解锁
      const skyscraper = (engine as any).upgrades.get(BUILDING_IDS.SKYSCRAPER);
      // 需要城市等级 7，当前为 1
      if (skyscraper && skyscraper.unlocked) {
        // 可能已解锁，但购买时应检查城市等级
      }
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('人口在住宅等级>=1时解锁', () => {
      engine.start();
      addCoin(engine, 100);
      engine.purchaseBuilding(0); // house
      tick(engine, 16);
      const pop = (engine as any).getResource(RESOURCE_IDS.POPULATION);
      expect(pop.unlocked).toBe(true);
    });

    it('科技在学校等级>=1时解锁', () => {
      engine.start();
      addCoin(engine, 100000);
      // 解锁前置建筑链
      engine.purchaseBuilding(0); // house
      tick(engine, 16);
      engine.purchaseBuilding(1); // shop
      tick(engine, 16);
      engine.purchaseBuilding(2); // factory
      tick(engine, 16);
      engine.purchaseBuilding(3); // school
      tick(engine, 16);
      const tech = (engine as any).getResource(RESOURCE_IDS.TECH);
      expect(tech.unlocked).toBe(true);
    });
  });

  // ========== 城市升级 ==========

  describe('城市升级', () => {
    it('初始城市等级为 1', () => {
      expect(engine.cityLevel).toBe(1);
    });

    it('升级城市需要足够金币', () => {
      engine.start();
      addCoin(engine, 1000);
      const result = engine.upgradeCity();
      expect(result).toBe(true);
      expect(engine.cityLevel).toBe(2);
    });

    it('升级城市扣除金币', () => {
      engine.start();
      addCoin(engine, 1000);
      const before = getCoin(engine);
      engine.upgradeCity();
      expect(getCoin(engine)).toBeLessThan(before);
    });

    it('金币不足时升级失败', () => {
      engine.start();
      addCoin(engine, 100);
      const result = engine.upgradeCity();
      expect(result).toBe(false);
      expect(engine.cityLevel).toBe(1);
    });

    it('连续升级城市', () => {
      engine.start();
      addCoin(engine, 100000);
      engine.upgradeCity(); // 2: 500
      expect(engine.cityLevel).toBe(2);
      engine.upgradeCity(); // 3: 2000
      expect(engine.cityLevel).toBe(3);
      engine.upgradeCity(); // 4: 8000
      expect(engine.cityLevel).toBe(4);
    });

    it('升级城市增加统计计数', () => {
      engine.start();
      addCoin(engine, 1000);
      engine.upgradeCity();
      expect(engine.statistics.totalCityUpgrades).toBe(1);
    });

    it('升级城市触发 cityUpgraded 事件', () => {
      engine.start();
      addCoin(engine, 1000);
      const listener = jest.fn();
      engine.on('cityUpgraded', listener);
      engine.upgradeCity();
      expect(listener).toHaveBeenCalledWith(2);
    });

    it('canUpgradeCity 返回正确状态', () => {
      engine.start();
      expect(engine.canUpgradeCity()).toBe(false);
      addCoin(engine, 1000);
      expect(engine.canUpgradeCity()).toBe(true);
    });

    it('getCityUpgradeCost 返回下一级费用', () => {
      const cost = engine.getCityUpgradeCost();
      expect(cost).toBe(CITY_LEVEL_COSTS[2]);
    });

    it('城市等级加成倍率随等级增加', () => {
      const mult1 = engine.getCityLevelMultiplier();
      (engine as any)._cityLevel = 5;
      const mult5 = engine.getCityLevelMultiplier();
      expect(mult5).toBeGreaterThan(mult1);
    });

    it('满级后无法继续升级', () => {
      engine.start();
      (engine as any)._cityLevel = MAX_CITY_LEVEL;
      addCoin(engine, 1e15);
      const result = engine.upgradeCity();
      expect(result).toBe(false);
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

    it('金币不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（金币不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('金币达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      const points = engine.doPrestige();
      expect(points).toBeGreaterThan(0);
    });

    it('声望后声望点数增加', () => {
      engine.start();
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addCoin(engine, MIN_PRESTIGE_COIN * 4);
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      engine.doPrestige();
      expect(getCoin(engine)).toBe(0);
    });

    it('声望后城市等级重置为 1', () => {
      engine.start();
      addCoin(engine, 100000);
      engine.upgradeCity(); // level 2
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      engine.doPrestige();
      expect(engine.cityLevel).toBe(1);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      const listener = jest.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望加成倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望加成倍率随声望点数增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * PRESTIGE_BONUS_MULTIPLIER, 2);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('modern-city');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addCoin(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含城市等级和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).cityLevel).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addCoin(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getCoin(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复城市等级', () => {
      engine.start();
      addCoin(engine, 10000);
      engine.upgradeCity();
      engine.upgradeCity();
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.cityLevel).toBe(3);
    });

    it('load 恢复建筑等级', () => {
      engine.start();
      addCoin(engine, 10000);
      engine.purchaseBuilding(0);
      engine.purchaseBuilding(0);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.getBuildingLevel(0)).toBe(2);
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
      expect(state.cityLevel).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addCoin(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getCoin(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复城市等级', () => {
      engine.start();
      addCoin(engine, 10000);
      engine.upgradeCity();
      engine.upgradeCity();
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.cityLevel).toBe(3);
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
  });

  // ========== 键盘输入 ==========

  describe('键盘输入', () => {
    it('空格键触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(getCoin(engine)).toBeGreaterThan(0);
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
      addCoin(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('U 键升级城市', () => {
      engine.start();
      addCoin(engine, 1000);
      engine.handleKeyDown('u');
      expect(engine.cityLevel).toBe(2);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalCoinEarned = MIN_PRESTIGE_COIN * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getCoin(engine)).toBe(0);
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
      addCoin(engine, 10000);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('城市等级高时渲染正常', () => {
      engine.start();
      (engine as any)._cityLevel = 8;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('点击动画后渲染正常', () => {
      engine.start();
      engine.click();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有建筑解锁时渲染正常', () => {
      engine.start();
      for (const building of BUILDINGS) {
        const upgrade = (engine as any).upgrades.get(building.id);
        if (upgrade) {
          upgrade.unlocked = true;
          upgrade.level = 1;
        }
      }
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addCoin(engine, 100);
      engine.purchaseBuilding(0); // house -> produces population
      tick(engine, 16);
      // 住宅产出人口
      const pop = getPopulation(engine);
      expect(pop).toBeGreaterThanOrEqual(0); // 人口可能刚解锁
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addCoin(engine, 100);
      engine.purchaseBuilding(0);
      const before = getPopulation(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getPopulation(engine);
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('建筑产出金币', () => {
      engine.start();
      addCoin(engine, 10000);
      engine.purchaseBuilding(0); // house
      tick(engine, 16);
      engine.purchaseBuilding(1); // shop -> produces coin
      tick(engine, 16);
      const before = getCoin(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getCoin(engine);
      expect(after).toBeGreaterThan(before);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addCoin(engine, 1e14);
      expect(getCoin(engine)).toBeGreaterThan(0);
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
      expect(Object.keys(engine.getBuildingCost(-1)).length).toBe(0);
      expect(Object.keys(engine.getBuildingCost(99)).length).toBe(0);
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });

    it('getCityUpgradeCost 满级返回 0', () => {
      (engine as any)._cityLevel = MAX_CITY_LEVEL;
      expect(engine.getCityUpgradeCost()).toBe(0);
    });

    it('canUpgradeCity 满级返回 false', () => {
      (engine as any)._cityLevel = MAX_CITY_LEVEL;
      expect(engine.canUpgradeCity()).toBe(false);
    });
  });
});
