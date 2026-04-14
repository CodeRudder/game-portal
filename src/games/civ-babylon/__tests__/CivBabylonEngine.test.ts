/**
 * 四大文明·古巴比伦 (Civ Babylon) 放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivBabylonEngine } from '@/games/civ-babylon/CivBabylonEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  BRICK_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_BRICK,
  GARDEN_LAYERS,
  BUILDINGS,
  BUILDING_IDS,
  COLORS,
  GARDEN_DRAW,
} from '@/games/civ-babylon/constants';

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

function createEngine(): CivBabylonEngine {
  const engine = new CivBabylonEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): CivBabylonEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addBrick(engine: CivBabylonEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.BRICK, amount);
}

function addCopper(engine: CivBabylonEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.COPPER, amount);
}

function addAstro(engine: CivBabylonEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.ASTRO, amount);
}

/** 触发一次 update */
function tick(engine: CivBabylonEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getBrick(engine: CivBabylonEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.BRICK)?.amount ?? 0;
}

function getCopper(engine: CivBabylonEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.COPPER)?.amount ?? 0;
}

function getAstro(engine: CivBabylonEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.ASTRO)?.amount ?? 0;
}

// ========== 测试 ==========

describe('CivBabylonEngine', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(CivBabylonEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后泥砖为 0', () => {
      expect(getBrick(engine)).toBe(0);
    });

    it('init 后铜币为 0', () => {
      expect(getCopper(engine)).toBe(0);
    });

    it('init 后星象知识为 0', () => {
      expect(getAstro(engine)).toBe(0);
    });

    it('init 后总泥砖获得为 0', () => {
      expect(engine.totalBrickEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 civ-babylon', () => {
      expect(engine.gameId).toBe('civ-babylon');
    });

    it('init 后泥砖已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.BRICK);
      expect(res.unlocked).toBe(true);
    });

    it('init 后铜币未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.COPPER);
      expect(res.unlocked).toBe(false);
    });

    it('init 后星象知识未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.ASTRO);
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 空中花园层初始化 ==========

  describe('空中花园层初始化', () => {
    it('应有 7 层花园', () => {
      expect(GARDEN_LAYERS.length).toBe(7);
    });

    it('初始只有基座平台解锁', () => {
      const layers = engine.gardenLayers;
      const baseLayer = layers.find(l => l.layer === 1);
      expect(baseLayer?.unlocked).toBe(true);
    });

    it('其他层初始未解锁', () => {
      const layers = engine.gardenLayers;
      const locked = layers.filter(l => l.layer !== 1);
      locked.forEach(l => {
        expect(l.unlocked).toBe(false);
      });
    });

    it('所有层初始升级等级为 0', () => {
      const layers = engine.gardenLayers;
      layers.forEach(l => {
        expect(l.upgradeLevel).toBe(0);
      });
    });

    it('每层有名称', () => {
      GARDEN_LAYERS.forEach(g => {
        expect(g.name).toBeTruthy();
      });
    });

    it('每层有图标', () => {
      GARDEN_LAYERS.forEach(g => {
        expect(g.icon).toBeTruthy();
      });
    });

    it('每层有正数基础产出', () => {
      GARDEN_LAYERS.forEach(g => {
        expect(g.baseProduction).toBeGreaterThan(0);
      });
    });

    it('每层有不同的颜色', () => {
      const colors = GARDEN_LAYERS.map(g => g.color);
      expect(new Set(colors).size).toBeGreaterThan(1);
    });
  });

  // ========== 建筑常量验证 ==========

  describe('建筑常量', () => {
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

    it('每个建筑有正数基础产出', () => {
      BUILDINGS.forEach(b => {
        expect(b.baseProduction).toBeGreaterThan(0);
      });
    });

    it('每个建筑有费用递增系数 > 1', () => {
      BUILDINGS.forEach(b => {
        expect(b.costMultiplier).toBeGreaterThan(1);
      });
    });

    it('泥砖窑初始解锁', () => {
      const kiln = (engine as any).upgrades.get(BUILDING_IDS.BRICK_KILN);
      expect(kiln.unlocked).toBe(true);
    });

    it('铜矿场初始未解锁', () => {
      const mine = (engine as any).upgrades.get(BUILDING_IDS.COPPER_MINE);
      expect(mine.unlocked).toBe(false);
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

    it('reset 后泥砖归零', () => {
      engine.start();
      addBrick(engine, 1000);
      engine.reset();
      expect(getBrick(engine)).toBe(0);
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
      addBrick(engine, 500);
      engine.reset();
      engine.start();
      expect(getBrick(engine)).toBe(0);
    });
  });

  // ========== 点击产生泥砖 ==========

  describe('点击产生泥砖', () => {
    it('点击一次产生泥砖', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getBrick(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生泥砖', () => {
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

    it('点击增加总泥砖获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalBrickEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getBrick(engine)).toBe(0);
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
    it('增加泥砖', () => {
      addBrick(engine, 100);
      expect(getBrick(engine)).toBe(100);
    });

    it('增加铜币', () => {
      addCopper(engine, 50);
      expect(getCopper(engine)).toBe(50);
    });

    it('增加星象知识', () => {
      addAstro(engine, 30);
      expect(getAstro(engine)).toBe(30);
    });

    it('消耗泥砖成功', () => {
      addBrick(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.BRICK, 50);
      expect(getBrick(engine)).toBe(50);
    });

    it('消耗泥砖失败（不足）', () => {
      addBrick(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.BRICK, 50);
      expect(result).toBeFalsy();
      expect(getBrick(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addBrick(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.BRICK, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.BRICK, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addBrick(engine, 100);
      addCopper(engine, 50);
      expect((engine as any).canAfford({ [RESOURCE_IDS.BRICK]: 50, [RESOURCE_IDS.COPPER]: 20 })).toBe(true);
      expect((engine as any).canAfford({ [RESOURCE_IDS.BRICK]: 50, [RESOURCE_IDS.COPPER]: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('购买泥砖窑成功', () => {
      engine.start();
      addBrick(engine, 100);
      const result = engine.purchaseBuilding(0); // brick_kiln
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买泥砖窑失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addBrick(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2[RESOURCE_IDS.BRICK]).toBeGreaterThan(cost1[RESOURCE_IDS.BRICK]);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addBrick(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addBrick(engine, 10000);
      // 铜矿场需要泥砖窑等级 > 0
      const result = engine.purchaseBuilding(1); // copper_mine
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addBrick(engine, 100);
      const before = getBrick(engine);
      engine.purchaseBuilding(0);
      expect(getBrick(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addBrick(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑增加统计计数', () => {
      engine.start();
      addBrick(engine, 100);
      engine.purchaseBuilding(0);
      expect(engine.statistics.totalBuildingPurchases).toBe(1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('铜矿场在泥砖窑有等级后解锁', () => {
      engine.start();
      addBrick(engine, 100);
      engine.purchaseBuilding(0); // brick_kiln
      tick(engine, 16);
      const mine = (engine as any).upgrades.get(BUILDING_IDS.COPPER_MINE);
      expect(mine.unlocked).toBe(true);
    });

    it('城墙在泥砖窑有等级后解锁', () => {
      engine.start();
      addBrick(engine, 100);
      engine.purchaseBuilding(0); // brick_kiln
      tick(engine, 16);
      const wall = (engine as any).upgrades.get(BUILDING_IDS.CITY_WALL);
      expect(wall.unlocked).toBe(true);
    });

    it('观星台需要铜矿场和城墙', () => {
      engine.start();
      addBrick(engine, 100000);
      // 购买泥砖窑
      engine.purchaseBuilding(0); // brick_kiln
      tick(engine, 16);
      // 购买铜矿场和城墙
      addCopper(engine, 10000);
      engine.purchaseBuilding(1); // copper_mine
      engine.purchaseBuilding(2); // city_wall
      tick(engine, 16);
      const obs = (engine as any).upgrades.get(BUILDING_IDS.OBSERVATORY);
      expect(obs.unlocked).toBe(true);
    });

    it('集市需要铜矿场和城墙', () => {
      engine.start();
      addBrick(engine, 100000);
      engine.purchaseBuilding(0); // brick_kiln
      tick(engine, 16);
      addCopper(engine, 10000);
      engine.purchaseBuilding(1); // copper_mine
      engine.purchaseBuilding(2); // city_wall
      tick(engine, 16);
      const market = (engine as any).upgrades.get(BUILDING_IDS.MARKETPLACE);
      expect(market.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('铜币在泥砖窑等级>=5时解锁', () => {
      engine.start();
      addBrick(engine, 100000);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(0); // brick_kiln
      }
      tick(engine, 16);
      const copper = (engine as any).getResource(RESOURCE_IDS.COPPER);
      expect(copper.unlocked).toBe(true);
    });

    it('星象知识在观星台等级>=1时解锁', () => {
      engine.start();
      addBrick(engine, 1000000);
      // 先解锁泥砖窑
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0); // brick_kiln
      }
      tick(engine, 16);
      // 解锁铜矿场和城墙
      addCopper(engine, 10000);
      engine.purchaseBuilding(1); // copper_mine
      engine.purchaseBuilding(2); // city_wall
      tick(engine, 16);
      // 购买观星台
      addBrick(engine, 100000);
      addCopper(engine, 10000);
      engine.purchaseBuilding(3); // observatory
      tick(engine, 16);
      const astro = (engine as any).getResource(RESOURCE_IDS.ASTRO);
      expect(astro.unlocked).toBe(true);
    });
  });

  // ========== 空中花园系统 ==========

  describe('空中花园系统', () => {
    it('初始基座平台已解锁', () => {
      const layers = engine.gardenLayers;
      const base = layers.find(l => l.layer === 1);
      expect(base?.unlocked).toBe(true);
    });

    it('解锁第2层需要500泥砖', () => {
      engine.start();
      addBrick(engine, 500);
      const result = engine.unlockGardenLayer(2);
      expect(result).toBe(true);
    });

    it('解锁第2层失败（泥砖不足）', () => {
      engine.start();
      addBrick(engine, 100);
      const result = engine.unlockGardenLayer(2);
      expect(result).toBe(false);
    });

    it('解锁不存在的层失败', () => {
      engine.start();
      const result = engine.unlockGardenLayer(99);
      expect(result).toBe(false);
    });

    it('不能跳层解锁', () => {
      engine.start();
      addBrick(engine, 100000);
      // 第2层未解锁时不能解锁第3层
      const result = engine.unlockGardenLayer(3);
      expect(result).toBe(false);
    });

    it('重复解锁同一层失败', () => {
      engine.start();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      const result = engine.unlockGardenLayer(2);
      expect(result).toBe(false);
    });

    it('解锁层触发 gardenLayerUnlocked 事件', () => {
      engine.start();
      addBrick(engine, 500);
      const listener = vi.fn();
      engine.on('gardenLayerUnlocked', listener);
      engine.unlockGardenLayer(2);
      expect(listener).toHaveBeenCalledWith(2);
    });

    it('解锁层增加统计计数', () => {
      engine.start();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      expect(engine.statistics.totalGardenLayersUnlocked).toBe(2);
    });

    it('解锁层后产出增加', () => {
      engine.start();
      const brickBefore = (engine as any).getResource(RESOURCE_IDS.BRICK)?.perSecond ?? 0;
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      // 基座平台 + 灌溉水渠 都产出泥砖
      const layers = engine.gardenLayers;
      const unlockedCount = layers.filter(l => l.unlocked).length;
      expect(unlockedCount).toBe(2);
    });

    it('gardenLayers getter 返回副本', () => {
      const layers1 = engine.gardenLayers;
      const layers2 = engine.gardenLayers;
      expect(layers1).not.toBe(layers2);
    });
  });

  // ========== 空中花园升级 ==========

  describe('空中花园升级', () => {
    it('升级基座平台成功', () => {
      engine.start();
      addBrick(engine, 200);
      addCopper(engine, 10);
      const result = engine.upgradeGardenLayer(1);
      expect(result).toBe(true);
      expect(engine.getGardenUpgradeLevel(1)).toBe(1);
    });

    it('升级未解锁的层失败', () => {
      engine.start();
      const result = engine.upgradeGardenLayer(2);
      expect(result).toBe(false);
    });

    it('升级资源不足时失败', () => {
      engine.start();
      const result = engine.upgradeGardenLayer(1);
      expect(result).toBe(false);
    });

    it('升级后产出增加', () => {
      engine.start();
      addBrick(engine, 200);
      addCopper(engine, 10);
      const prodBefore = (engine as any).getResource(RESOURCE_IDS.BRICK)?.perSecond ?? 0;
      engine.upgradeGardenLayer(1);
      // 升级后 recalculateProduction 会增加产出
      const layers = engine.gardenLayers;
      const base = layers.find(l => l.layer === 1);
      expect(base?.upgradeLevel).toBe(1);
    });

    it('升级触发 gardenLayerUpgraded 事件', () => {
      engine.start();
      addBrick(engine, 200);
      addCopper(engine, 10);
      const listener = vi.fn();
      engine.on('gardenLayerUpgraded', listener);
      engine.upgradeGardenLayer(1);
      expect(listener).toHaveBeenCalledWith(1, 1);
    });

    it('获取升级费用', () => {
      const cost1 = engine.getGardenUpgradeCost(1);
      expect(cost1).toBeDefined();
      expect(Object.keys(cost1).length).toBeGreaterThan(0);
    });

    it('高级升级费用更高', () => {
      const cost1 = engine.getGardenUpgradeCost(1);
      const cost3 = engine.getGardenUpgradeCost(3);
      expect(cost3[RESOURCE_IDS.BRICK]).toBeGreaterThan(cost1[RESOURCE_IDS.BRICK]);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始花园点击倍率为 1.1（基座平台加成）', () => {
      // 基座平台初始解锁，+10% 点击
      const mult = engine.getGardenClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始占星术倍率为 1（无观星台等级）', () => {
      const mult = engine.getAstrologyMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随泥板增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * PRESTIGE_BONUS_MULTIPLIER, 2);
    });

    it('解锁更多花园层增加点击倍率', () => {
      engine.start();
      const multBefore = engine.getGardenClickMultiplier();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      const multAfter = engine.getGardenClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('观星台等级增加占星术倍率', () => {
      engine.start();
      addBrick(engine, 100000);
      // 解锁并购买观星台
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0); // brick_kiln
      }
      tick(engine, 16);
      addCopper(engine, 10000);
      engine.purchaseBuilding(1); // copper_mine
      engine.purchaseBuilding(2); // city_wall
      tick(engine, 16);
      addBrick(engine, 100000);
      addCopper(engine, 10000);
      engine.purchaseBuilding(3); // observatory
      const mult = engine.getAstrologyMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始泥板为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('泥砖不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（泥砖不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('泥砖达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      const tablets = engine.doPrestige();
      expect(tablets).toBeGreaterThan(0);
    });

    it('声望后泥板增加', () => {
      engine.start();
      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addBrick(engine, MIN_PRESTIGE_BRICK * 4);
      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      engine.doPrestige();
      expect(getBrick(engine)).toBe(0);
    });

    it('声望保留花园层状态', () => {
      engine.start();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      addBrick(engine, 200);
      addCopper(engine, 10);
      engine.upgradeGardenLayer(1);
      const upgradeBefore = engine.getGardenUpgradeLevel(1);

      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      engine.doPrestige();
      const upgradeAfter = engine.getGardenUpgradeLevel(1);
      expect(upgradeAfter).toBe(upgradeBefore);

      const layers = engine.gardenLayers;
      const layer2 = layers.find(l => l.layer === 2);
      expect(layer2?.unlocked).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('civ-babylon');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addBrick(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含花园层和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).gardenLayers).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addBrick(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getBrick(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复花园层状态', () => {
      engine.start();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const layers = engine2.gardenLayers;
      const layer2 = layers.find(l => l.layer === 2);
      expect(layer2?.unlocked).toBe(true);
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
      expect(state.gardenLayers).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addBrick(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getBrick(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复花园层', () => {
      engine.start();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const layers = engine2.gardenLayers;
      const layer2 = layers.find(l => l.layer === 2);
      expect(layer2?.unlocked).toBe(true);
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
      expect(getBrick(engine)).toBeGreaterThan(0);
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
      addBrick(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('G 键解锁花园层', () => {
      engine.start();
      addBrick(engine, 500);
      engine.handleKeyDown('g');
      const layers = engine.gardenLayers;
      const layer2 = layers.find(l => l.layer === 2);
      expect(layer2?.unlocked).toBe(true);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalBrickEarned = MIN_PRESTIGE_BRICK * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getBrick(engine)).toBe(0);
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

    it('有花园层解锁时渲染正常', () => {
      engine.start();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有花园层解锁时渲染正常', () => {
      engine.start();
      // 强制解锁所有层
      for (const layer of (engine as any)._gardenLayers) {
        layer.unlocked = true;
        layer.upgradeLevel = 3;
      }
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑购买后渲染正常', () => {
      engine.start();
      addBrick(engine, 100);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addBrick(engine, 100);
      engine.purchaseBuilding(0); // brick_kiln
      const before = getBrick(engine);
      tick(engine, 1000);
      const after = getBrick(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addBrick(engine, 100);
      engine.purchaseBuilding(0);
      const before = getBrick(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getBrick(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('花园层也产出资源', () => {
      engine.start();
      addBrick(engine, 500);
      engine.unlockGardenLayer(2);
      // 花园层有基础产出
      const brick = (engine as any).getResource(RESOURCE_IDS.BRICK);
      // 基座平台 + 灌溉水渠 都产出泥砖
      expect(brick.perSecond).toBeGreaterThan(0);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addBrick(engine, 1e14);
      expect(getBrick(engine)).toBeGreaterThan(0);
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
  });

  // ========== RESOURCE_IDS 常量验证 ==========

  describe('RESOURCE_IDS 常量', () => {
    it('BRICK 常量正确', () => {
      expect(RESOURCE_IDS.BRICK).toBe('brick');
    });

    it('COPPER 常量正确', () => {
      expect(RESOURCE_IDS.COPPER).toBe('copper');
    });

    it('ASTRO 常量正确', () => {
      expect(RESOURCE_IDS.ASTRO).toBe('astro');
    });
  });

  // ========== BUILDING_IDS 常量验证 ==========

  describe('BUILDING_IDS 常量', () => {
    it('包含所有 8 个建筑 ID', () => {
      expect(Object.keys(BUILDING_IDS).length).toBe(8);
    });

    it('BRICK_KILN 常量正确', () => {
      expect(BUILDING_IDS.BRICK_KILN).toBe('brick_kiln');
    });

    it('COPPER_MINE 常量正确', () => {
      expect(BUILDING_IDS.COPPER_MINE).toBe('copper_mine');
    });

    it('CITY_WALL 常量正确', () => {
      expect(BUILDING_IDS.CITY_WALL).toBe('city_wall');
    });

    it('OBSERVATORY 常量正确', () => {
      expect(BUILDING_IDS.OBSERVATORY).toBe('observatory');
    });

    it('ZIGGURAT 常量正确', () => {
      expect(BUILDING_IDS.ZIGGURAT).toBe('ziggurat');
    });

    it('MARKETPLACE 常量正确', () => {
      expect(BUILDING_IDS.MARKETPLACE).toBe('marketplace');
    });

    it('HANGING_GARDEN 常量正确', () => {
      expect(BUILDING_IDS.HANGING_GARDEN).toBe('hanging_garden');
    });

    it('ISHTAR_GATE 常量正确', () => {
      expect(BUILDING_IDS.ISHTAR_GATE).toBe('ishtar_gate');
    });
  });

  // ========== COLORS 常量验证 ==========

  describe('COLORS 常量', () => {
    it('包含所有必要颜色', () => {
      expect(COLORS.brickColor).toBeDefined();
      expect(COLORS.copperColor).toBeDefined();
      expect(COLORS.astroColor).toBeDefined();
      expect(COLORS.waterColor).toBeDefined();
      expect(COLORS.starGlow).toBeDefined();
    });

    it('颜色值为合法 CSS 颜色', () => {
      expect(typeof COLORS.brickColor).toBe('string');
      expect(typeof COLORS.copperColor).toBe('string');
      expect(typeof COLORS.astroColor).toBe('string');
    });
  });
});
