import { vi } from 'vitest';
/**
 * Island Drift（海岛漂流）放置类游戏 — 完整测试套件
 */
import { IslandDriftEngine } from '@/games/island-drift/IslandDriftEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WOOD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_WOOD,
  ISLANDS,
  BUILDINGS,
  COLORS,
  ISLAND_DRAW,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/island-drift/constants';

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

function createEngine(): IslandDriftEngine {
  const engine = new IslandDriftEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): IslandDriftEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addWood(engine: IslandDriftEngine, amount: number): void {
  (engine as any).addResource('wood', amount);
}

function addFood(engine: IslandDriftEngine, amount: number): void {
  (engine as any).addResource('food', amount);
}

function addShell(engine: IslandDriftEngine, amount: number): void {
  (engine as any).addResource('shell', amount);
}

/** 触发一次 update */
function tick(engine: IslandDriftEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getWood(engine: IslandDriftEngine): number {
  return (engine as any).getResource('wood')?.amount ?? 0;
}

function getFood(engine: IslandDriftEngine): number {
  return (engine as any).getResource('food')?.amount ?? 0;
}

function getShell(engine: IslandDriftEngine): number {
  return (engine as any).getResource('shell')?.amount ?? 0;
}

// ========== 测试 ==========

describe('IslandDriftEngine', () => {
  let engine: IslandDriftEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(IslandDriftEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后木材为 0', () => {
      expect(getWood(engine)).toBe(0);
    });

    it('init 后食物为 0', () => {
      expect(getFood(engine)).toBe(0);
    });

    it('init 后贝壳为 0', () => {
      expect(getShell(engine)).toBe(0);
    });

    it('init 后总木材获得为 0', () => {
      expect(engine.totalWoodEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 island-drift', () => {
      expect(engine.gameId).toBe('island-drift');
    });

    it('init 后木材已解锁', () => {
      const res = (engine as any).getResource('wood');
      expect(res.unlocked).toBe(true);
    });

    it('init 后食物未解锁', () => {
      const res = (engine as any).getResource('food');
      expect(res.unlocked).toBe(false);
    });

    it('init 后贝壳未解锁', () => {
      const res = (engine as any).getResource('shell');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量定义', () => {
    it('RESOURCE_IDS 包含 WOOD/FOOD/SHELL', () => {
      expect(RESOURCE_IDS.WOOD).toBe('wood');
      expect(RESOURCE_IDS.FOOD).toBe('food');
      expect(RESOURCE_IDS.SHELL).toBe('shell');
    });

    it('BUILDING_IDS 包含 8 个建筑', () => {
      expect(BUILDING_IDS.length).toBe(8);
      expect(BUILDING_IDS).toContain('shelter');
      expect(BUILDING_IDS).toContain('fishing_hut');
      expect(BUILDING_IDS).toContain('workshop');
      expect(BUILDING_IDS).toContain('farm');
      expect(BUILDING_IDS).toContain('lighthouse');
      expect(BUILDING_IDS).toContain('dock');
      expect(BUILDING_IDS).toContain('warehouse');
      expect(BUILDING_IDS).toContain('temple');
    });

    it('WOOD_PER_CLICK 为 1', () => {
      expect(WOOD_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_WOOD 为 50000', () => {
      expect(MIN_PRESTIGE_WOOD).toBe(50000);
    });

    it('BUILDINGS 数组长度为 8', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('ISLANDS 数组长度为 5', () => {
      expect(ISLANDS.length).toBe(5);
    });

    it('每个建筑有唯一 ID', () => {
      const ids = BUILDINGS.map((b: any) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个岛屿有唯一 ID', () => {
      const ids = ISLANDS.map((i: any) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个建筑有名称', () => {
      BUILDINGS.forEach((b: any) => {
        expect(b.name).toBeTruthy();
      });
    });

    it('每个建筑有图标', () => {
      BUILDINGS.forEach((b: any) => {
        expect(b.icon).toBeTruthy();
      });
    });

    it('每个岛屿有名称', () => {
      ISLANDS.forEach((i: any) => {
        expect(i.name).toBeTruthy();
      });
    });

    it('每个岛屿有正数奖励倍率', () => {
      ISLANDS.forEach((i: any) => {
        expect(i.rewardMultiplier).toBeGreaterThan(0);
      });
    });
  });

  // ========== 岛屿初始化 ==========

  describe('岛屿初始化', () => {
    it('应有 5 个岛屿', () => {
      expect(ISLANDS.length).toBe(5);
    });

    it('初始只有沙滩岛解锁', () => {
      const islands = engine.islands;
      const beach = islands.find(i => i.id === 'beach_island');
      expect(beach?.unlocked).toBe(true);
    });

    it('其他岛屿初始未解锁', () => {
      const islands = engine.islands;
      const locked = islands.filter(i => i.id !== 'beach_island');
      locked.forEach(i => {
        expect(i.unlocked).toBe(false);
      });
    });

    it('所有岛屿初始探险次数为 0', () => {
      const islands = engine.islands;
      islands.forEach(i => {
        expect(i.expeditions).toBe(0);
      });
    });

    it('初始无探险进行', () => {
      const exp = engine.expedition;
      expect(exp.active).toBe(false);
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

    it('reset 后木材归零', () => {
      engine.start();
      addWood(engine, 1000);
      engine.reset();
      expect(getWood(engine)).toBe(0);
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
      addWood(engine, 500);
      engine.reset();
      engine.start();
      expect(getWood(engine)).toBe(0);
    });
  });

  // ========== 点击产生木材 ==========

  describe('点击产生木材', () => {
    it('点击一次产生木材', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getWood(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生木材', () => {
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

    it('点击增加总木材获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalWoodEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getWood(engine)).toBe(0);
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
    it('增加木材', () => {
      addWood(engine, 100);
      expect(getWood(engine)).toBe(100);
    });

    it('增加食物', () => {
      addFood(engine, 50);
      expect(getFood(engine)).toBe(50);
    });

    it('增加贝壳', () => {
      addShell(engine, 30);
      expect(getShell(engine)).toBe(30);
    });

    it('消耗木材成功', () => {
      addWood(engine, 100);
      (engine as any).spendResource('wood', 50);
      expect(getWood(engine)).toBe(50);
    });

    it('消耗木材失败（不足）', () => {
      addWood(engine, 10);
      const result = (engine as any).spendResource('wood', 50);
      expect(result).toBeFalsy();
      expect(getWood(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addWood(engine, 100);
      expect((engine as any).hasResource('wood', 50)).toBe(true);
      expect((engine as any).hasResource('wood', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addWood(engine, 100);
      addFood(engine, 50);
      expect((engine as any).canAfford({ wood: 50, food: 20 })).toBe(true);
      expect((engine as any).canAfford({ wood: 50, food: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有庇护所解锁', () => {
      const shelter = (engine as any).upgrades.get('shelter');
      expect(shelter.unlocked).toBe(true);
    });

    it('渔屋初始未解锁', () => {
      const fishingHut = (engine as any).upgrades.get('fishing_hut');
      expect(fishingHut.unlocked).toBe(false);
    });

    it('购买庇护所成功', () => {
      engine.start();
      addWood(engine, 100);
      const result = engine.purchaseBuilding(0); // shelter
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买庇护所失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addWood(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.wood).toBeGreaterThan(cost1.wood);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addWood(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addWood(engine, 10000);
      // 渔屋需要庇护所等级 > 0
      const result = engine.purchaseBuilding(1); // fishing_hut
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addWood(engine, 100);
      const before = getWood(engine);
      engine.purchaseBuilding(0);
      expect(getWood(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addWood(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('渔屋在庇护所有等级后解锁', () => {
      engine.start();
      addWood(engine, 100);
      engine.purchaseBuilding(0); // shelter
      tick(engine, 16);
      const fishingHut = (engine as any).upgrades.get('fishing_hut');
      expect(fishingHut.unlocked).toBe(true);
    });

    it('工坊在庇护所有等级后解锁', () => {
      engine.start();
      addWood(engine, 10000);
      engine.purchaseBuilding(0); // shelter
      tick(engine, 16);
      const workshop = (engine as any).upgrades.get('workshop');
      expect(workshop.unlocked).toBe(true);
    });

    it('农场需要渔屋和工坊', () => {
      engine.start();
      addWood(engine, 100000);
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // shelter
      tick(engine, 16);
      engine.purchaseBuilding(1); // fishing_hut
      engine.purchaseBuilding(2); // workshop
      tick(engine, 16);
      const farm = (engine as any).upgrades.get('farm');
      expect(farm.unlocked).toBe(true);
    });

    it('灯塔需要农场', () => {
      engine.start();
      // 先解锁并升级前置建筑
      addWood(engine, 1000000);
      addFood(engine, 100000);
      addShell(engine, 10000);
      engine.purchaseBuilding(0); // shelter
      tick(engine, 16);
      engine.purchaseBuilding(1); // fishing_hut
      engine.purchaseBuilding(2); // workshop
      tick(engine, 16);
      engine.purchaseBuilding(3); // farm
      tick(engine, 16);
      const lighthouse = (engine as any).upgrades.get('lighthouse');
      expect(lighthouse.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('食物在庇护所等级>=3时解锁', () => {
      engine.start();
      addWood(engine, 100000);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      const food = (engine as any).getResource('food');
      expect(food.unlocked).toBe(true);
    });

    it('贝壳在灯塔等级>=1时解锁', () => {
      engine.start();
      addWood(engine, 1000000);
      addFood(engine, 100000);
      addShell(engine, 10000);
      // 先解锁前置建筑
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      // 解锁渔屋和工坊
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(1);
        engine.purchaseBuilding(2);
      }
      tick(engine, 16);
      // 解锁农场
      for (let i = 0; i < 3; i++) {
        engine.purchaseBuilding(3);
      }
      tick(engine, 16);
      // 购买灯塔
      engine.purchaseBuilding(4);
      tick(engine, 16);
      const shell = (engine as any).getResource('shell');
      expect(shell.unlocked).toBe(true);
    });
  });

  // ========== 岛屿系统 ==========

  describe('岛屿系统', () => {
    it('解锁密林岛需要 500 木材', () => {
      engine.start();
      addWood(engine, 500);
      const result = engine.unlockIsland('forest_island');
      expect(result).toBe(true);
    });

    it('解锁密林岛失败（木材不足）', () => {
      engine.start();
      addWood(engine, 100);
      const result = engine.unlockIsland('forest_island');
      expect(result).toBe(false);
    });

    it('重复解锁同一岛屿失败', () => {
      engine.start();
      addWood(engine, 2000);
      engine.unlockIsland('forest_island');
      const result = engine.unlockIsland('forest_island');
      expect(result).toBe(false);
    });

    it('解锁不存在的岛屿失败', () => {
      engine.start();
      const result = engine.unlockIsland('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁岛屿触发 islandUnlocked 事件', () => {
      engine.start();
      addWood(engine, 500);
      const listener = vi.fn();
      engine.on('islandUnlocked', listener);
      engine.unlockIsland('forest_island');
      expect(listener).toHaveBeenCalledWith('forest_island');
    });

    it('解锁岛屿增加统计计数', () => {
      engine.start();
      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      expect(engine.islands.find(i => i.id === 'forest_island')?.unlocked).toBe(true);
    });

    it('islands getter 返回副本', () => {
      const islands1 = engine.islands;
      const islands2 = engine.islands;
      expect(islands1).not.toBe(islands2);
    });

    it('isIslandUnlocked 正确反映状态', () => {
      expect(engine.isIslandUnlocked('beach_island')).toBe(true);
      expect(engine.isIslandUnlocked('forest_island')).toBe(false);
    });

    it('getIslandExpeditions 初始为 0', () => {
      expect(engine.getIslandExpeditions('beach_island')).toBe(0);
    });
  });

  // ========== 探险系统 ==========

  describe('探险系统', () => {
    it('开始探险需要 10 食物', () => {
      engine.start();
      addFood(engine, 10);
      const result = engine.startExpedition('beach_island');
      expect(result).toBe(true);
    });

    it('食物不足时无法探险', () => {
      engine.start();
      const result = engine.startExpedition('beach_island');
      expect(result).toBe(false);
    });

    it('探险中不能再次开始', () => {
      engine.start();
      addFood(engine, 100);
      engine.startExpedition('beach_island');
      const result = engine.startExpedition('beach_island');
      expect(result).toBe(false);
    });

    it('未解锁岛屿不能探险', () => {
      engine.start();
      addFood(engine, 100);
      const result = engine.startExpedition('forest_island');
      expect(result).toBe(false);
    });

    it('探险开始后 active 为 true', () => {
      engine.start();
      addFood(engine, 10);
      engine.startExpedition('beach_island');
      expect(engine.expedition.active).toBe(true);
    });

    it('探险开始消耗食物', () => {
      engine.start();
      addFood(engine, 100);
      const before = getFood(engine);
      engine.startExpedition('beach_island');
      expect(getFood(engine)).toBeLessThan(before);
    });

    it('探险触发 expeditionStarted 事件', () => {
      engine.start();
      addFood(engine, 10);
      const listener = vi.fn();
      engine.on('expeditionStarted', listener);
      engine.startExpedition('beach_island');
      expect(listener).toHaveBeenCalledWith('beach_island');
    });

    it('探险倒计时结束后完成', () => {
      engine.start();
      addFood(engine, 10);
      engine.startExpedition('beach_island');
      const totalTime = engine.expedition.totalTime;
      tick(engine, totalTime + 100);
      expect(engine.expedition.active).toBe(false);
    });

    it('探险完成后获得奖励', () => {
      engine.start();
      addFood(engine, 10);
      engine.startExpedition('beach_island');
      const totalTime = engine.expedition.totalTime;
      const woodBefore = getWood(engine);
      tick(engine, totalTime + 100);
      expect(getWood(engine)).toBeGreaterThan(woodBefore);
    });

    it('探险完成后增加探险次数统计', () => {
      engine.start();
      addFood(engine, 10);
      engine.startExpedition('beach_island');
      const totalTime = engine.expedition.totalTime;
      tick(engine, totalTime + 100);
      expect(engine.islands.find(i => i.id === 'beach_island')?.expeditions).toBe(1);
    });

    it('探险完成后可以再次探险', () => {
      engine.start();
      addFood(engine, 100);
      engine.startExpedition('beach_island');
      const totalTime = engine.expedition.totalTime;
      tick(engine, totalTime + 100);
      expect(engine.expedition.active).toBe(false);
      const result = engine.startExpedition('beach_island');
      expect(result).toBe(true);
    });

    it('不存在的岛屿探险失败', () => {
      engine.start();
      addFood(engine, 100);
      const result = engine.startExpedition('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（沙滩岛加成）', () => {
      // 沙滩岛初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始木材倍率为 1 + 声望加成', () => {
      const mult = engine.getWoodMultiplier();
      // 1个岛屿(0.15) * 声望倍率(1)
      expect(mult).toBeCloseTo(1.15, 1);
    });

    it('初始食物倍率为 1 + 声望加成', () => {
      const mult = engine.getFoodMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始贝壳倍率为 1 + 声望加成', () => {
      const mult = engine.getShellMultiplier();
      expect(mult).toBeCloseTo(1.2, 1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随漂流瓶增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * PRESTIGE_BONUS_MULTIPLIER, 2);
    });

    it('解锁新岛屿增加点击倍率', () => {
      engine.start();
      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.2, 1); // 2 islands * 0.1 + 1
    });

    it('解锁新岛屿增加木材倍率', () => {
      engine.start();
      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      const mult = engine.getWoodMultiplier();
      expect(mult).toBeGreaterThan(1.15);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始漂流瓶为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('木材不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（木材不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('木材达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      const bottles = engine.doPrestige();
      expect(bottles).toBeGreaterThan(0);
    });

    it('声望后漂流瓶增加', () => {
      engine.start();
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addWood(engine, MIN_PRESTIGE_WOOD * 4);
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      engine.doPrestige();
      expect(getWood(engine)).toBe(0);
    });

    it('声望保留岛屿解锁状态', () => {
      engine.start();
      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      const unlockedBefore = engine.isIslandUnlocked('forest_island');

      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      engine.doPrestige();
      const unlockedAfter = engine.isIslandUnlocked('forest_island');
      expect(unlockedAfter).toBe(unlockedBefore);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望后声望倍率增加', () => {
      engine.start();
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      engine.doPrestige();
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('island-drift');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addWood(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含岛屿和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).islands).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addWood(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getWood(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复岛屿状态', () => {
      engine.start();
      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const islands = engine2.islands;
      const forest = islands.find(i => i.id === 'forest_island');
      expect(forest?.unlocked).toBe(true);
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
      expect(state.islands).toBeDefined();
      expect(state.expedition).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addWood(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getWood(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复岛屿', () => {
      engine.start();
      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const islands = engine2.islands;
      const forest = islands.find(i => i.id === 'forest_island');
      expect(forest?.unlocked).toBe(true);
    });

    it('loadState 恢复探险状态', () => {
      engine.start();
      addFood(engine, 10);
      engine.startExpedition('beach_island');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.expedition.active).toBe(true);
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
      expect(getWood(engine)).toBeGreaterThan(0);
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
      addWood(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('X 键开始探险', () => {
      engine.start();
      addFood(engine, 10);
      engine.handleKeyDown('x');
      expect(engine.expedition.active).toBe(true);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalWoodEarned = MIN_PRESTIGE_WOOD * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getWood(engine)).toBe(0);
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

    it('有岛屿解锁时渲染正常', () => {
      engine.start();
      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('探险中渲染正常', () => {
      engine.start();
      addFood(engine, 10);
      engine.startExpedition('beach_island');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有岛屿解锁时渲染正常', () => {
      engine.start();
      // 直接解锁所有岛屿
      const islands = (engine as any)._islands as any[];
      islands.forEach((i: any) => { i.unlocked = true; });
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addWood(engine, 100);
      engine.purchaseBuilding(0); // shelter
      const before = getWood(engine);
      tick(engine, 1000);
      const after = getWood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addWood(engine, 100);
      engine.purchaseBuilding(0);
      const before = getWood(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getWood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('建筑产出受岛屿加成影响', () => {
      engine.start();
      addWood(engine, 100);
      engine.purchaseBuilding(0); // shelter
      const prodBefore = (engine as any).getResource('wood')?.perSecond ?? 0;

      addWood(engine, 500);
      engine.unlockIsland('forest_island');
      (engine as any).recalculateProduction();
      const prodAfter = (engine as any).getResource('wood')?.perSecond ?? 0;

      expect(prodAfter).toBeGreaterThan(prodBefore);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addWood(engine, 1e14);
      expect(getWood(engine)).toBeGreaterThan(0);
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

    it('expedition getter 返回副本', () => {
      const exp1 = engine.expedition;
      const exp2 = engine.expedition;
      expect(exp1).not.toBe(exp2);
    });

    it('getBuildingCost 无效索引返回空对象', () => {
      expect(Object.keys(engine.getBuildingCost(-1)).length).toBe(0);
      expect(Object.keys(engine.getBuildingCost(99)).length).toBe(0);
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });
  });
});
