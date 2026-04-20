/**
 * Heroes Might（英雄无敌）放置类游戏 — 完整测试套件
 */
import { HeroesMightEngine } from '@/games/heroes-might/HeroesMightEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  HONOR_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GOLD,
  HEROES,
  BUILDINGS,
  SPELLS,
  COLORS,
  CASTLE_DRAW,
  EVOLUTION_COSTS,
  MAX_EVOLUTION_LEVEL,
} from '@/games/heroes-might/constants';

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

function createEngine(): HeroesMightEngine {
  const engine = new HeroesMightEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): HeroesMightEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addGold(engine: HeroesMightEngine, amount: number): void {
  (engine as any).addResource('gold', amount);
}

function addGem(engine: HeroesMightEngine, amount: number): void {
  (engine as any).addResource('gem', amount);
}

function addCrystal(engine: HeroesMightEngine, amount: number): void {
  (engine as any).addResource('crystal', amount);
}

/** 触发一次 update */
function tick(engine: HeroesMightEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getGold(engine: HeroesMightEngine): number {
  return (engine as any).getResource('gold')?.amount ?? 0;
}

function getGem(engine: HeroesMightEngine): number {
  return (engine as any).getResource('gem')?.amount ?? 0;
}

function getCrystal(engine: HeroesMightEngine): number {
  return (engine as any).getResource('crystal')?.amount ?? 0;
}

// ========== 测试 ==========

describe('HeroesMightEngine', () => {
  let engine: HeroesMightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(HeroesMightEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后金币为 0', () => {
      expect(getGold(engine)).toBe(0);
    });

    it('init 后宝石为 0', () => {
      expect(getGem(engine)).toBe(0);
    });

    it('init 后魔法水晶为 0', () => {
      expect(getCrystal(engine)).toBe(0);
    });

    it('init 后总金币获得为 0', () => {
      expect(engine.totalGoldEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 heroes-might', () => {
      expect(engine.gameId).toBe('heroes-might');
    });

    it('init 后金币已解锁', () => {
      const res = (engine as any).getResource('gold');
      expect(res.unlocked).toBe(true);
    });

    it('init 后宝石未解锁', () => {
      const res = (engine as any).getResource('gem');
      expect(res.unlocked).toBe(false);
    });

    it('init 后魔法水晶未解锁', () => {
      const res = (engine as any).getResource('crystal');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 英雄初始化 ==========

  describe('英雄初始化', () => {
    it('应有 6 种英雄', () => {
      expect(HEROES.length).toBe(6);
    });

    it('初始只有骑士解锁', () => {
      const heroes = engine.heroes;
      const knight = heroes.find(h => h.id === 'knight');
      expect(knight?.unlocked).toBe(true);
    });

    it('其他英雄初始未解锁', () => {
      const heroes = engine.heroes;
      const locked = heroes.filter(h => h.id !== 'knight');
      locked.forEach(h => {
        expect(h.unlocked).toBe(false);
      });
    });

    it('所有英雄初始进化等级为 0', () => {
      const heroes = engine.heroes;
      heroes.forEach(h => {
        expect(h.evolutionLevel).toBe(0);
      });
    });

    it('英雄 ID 唯一', () => {
      const ids = HEROES.map(h => h.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个英雄有名称', () => {
      HEROES.forEach(h => {
        expect(h.name).toBeTruthy();
      });
    });

    it('每个英雄有图标', () => {
      HEROES.forEach(h => {
        expect(h.icon).toBeTruthy();
      });
    });

    it('每个英雄有正数加成值', () => {
      HEROES.forEach(h => {
        expect(h.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个英雄有进化倍率', () => {
      HEROES.forEach(h => {
        expect(h.evolutionMultiplier).toBeGreaterThan(0);
      });
    });
  });

  // ========== 建筑初始化 ==========

  describe('建筑初始化', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有金矿解锁', () => {
      const goldMine = (engine as any).upgrades.get('gold_mine');
      expect(goldMine.unlocked).toBe(true);
    });

    it('伐木场初始未解锁', () => {
      const lumberMill = (engine as any).upgrades.get('lumber_mill');
      expect(lumberMill.unlocked).toBe(false);
    });

    it('兵营初始未解锁', () => {
      const barracks = (engine as any).upgrades.get('barracks');
      expect(barracks.unlocked).toBe(false);
    });

    it('龙巢初始未解锁', () => {
      const dragonLair = (engine as any).upgrades.get('dragon_lair');
      expect(dragonLair.unlocked).toBe(false);
    });

    it('所有建筑有正数基础产出', () => {
      BUILDINGS.forEach(b => {
        expect(b.baseProduction).toBeGreaterThan(0);
      });
    });

    it('所有建筑费用递增系数 > 1', () => {
      BUILDINGS.forEach(b => {
        expect(b.costMultiplier).toBeGreaterThan(1);
      });
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
      addGold(engine, 1000);
      engine.reset();
      expect(getGold(engine)).toBe(0);
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
      addGold(engine, 500);
      engine.reset();
      engine.start();
      expect(getGold(engine)).toBe(0);
    });
  });

  // ========== 点击产生金币 ==========

  describe('点击产生金币', () => {
    it('点击一次产生金币', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getGold(engine)).toBeGreaterThan(0);
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
      expect(engine.totalGoldEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getGold(engine)).toBe(0);
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
      addGold(engine, 100);
      expect(getGold(engine)).toBe(100);
    });

    it('增加宝石', () => {
      addGem(engine, 50);
      expect(getGem(engine)).toBe(50);
    });

    it('增加魔法水晶', () => {
      addCrystal(engine, 30);
      expect(getCrystal(engine)).toBe(30);
    });

    it('消耗金币成功', () => {
      addGold(engine, 100);
      (engine as any).spendResource('gold', 50);
      expect(getGold(engine)).toBe(50);
    });

    it('消耗金币失败（不足）', () => {
      addGold(engine, 10);
      const result = (engine as any).spendResource('gold', 50);
      expect(result).toBeFalsy();
      expect(getGold(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addGold(engine, 100);
      expect((engine as any).hasResource('gold', 50)).toBe(true);
      expect((engine as any).hasResource('gold', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addGold(engine, 100);
      addGem(engine, 50);
      expect((engine as any).canAfford({ gold: 50, gem: 20 })).toBe(true);
      expect((engine as any).canAfford({ gold: 50, gem: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('购买金矿成功', () => {
      engine.start();
      addGold(engine, 100);
      const result = engine.purchaseBuilding(0); // gold_mine
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买金矿失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addGold(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.gold).toBeGreaterThan(cost1.gold);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addGold(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addGold(engine, 10000);
      // 伐木场需要金矿等级 > 0
      const result = engine.purchaseBuilding(1); // lumber_mill
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addGold(engine, 100);
      const before = getGold(engine);
      engine.purchaseBuilding(0);
      expect(getGold(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addGold(engine, 100);
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑触发 upgradePurchased 事件', () => {
      engine.start();
      addGold(engine, 100);
      const listener = jest.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledWith('gold_mine', 1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('伐木场在金矿有等级后解锁', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // gold_mine
      tick(engine, 16);
      const lumberMill = (engine as any).upgrades.get('lumber_mill');
      expect(lumberMill.unlocked).toBe(true);
    });

    it('兵营在金矿有等级后解锁', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0); // gold_mine
      tick(engine, 16);
      const barracks = (engine as any).upgrades.get('barracks');
      expect(barracks.unlocked).toBe(true);
    });

    it('箭塔需要兵营等级', () => {
      engine.start();
      addGold(engine, 100000);
      // 购买金矿
      engine.purchaseBuilding(0);
      tick(engine, 16);
      // 购买兵营
      engine.purchaseBuilding(2); // barracks
      tick(engine, 16);
      const archerTower = (engine as any).upgrades.get('archer_tower');
      expect(archerTower.unlocked).toBe(true);
    });

    it('魔法塔需要箭塔等级', () => {
      engine.start();
      addGold(engine, 100000);
      addGem(engine, 100);
      engine.purchaseBuilding(0); // gold_mine
      tick(engine, 16);
      engine.purchaseBuilding(2); // barracks
      tick(engine, 16);
      engine.purchaseBuilding(3); // archer_tower
      tick(engine, 16);
      const magicTower = (engine as any).upgrades.get('magic_tower');
      expect(magicTower.unlocked).toBe(true);
    });

    it('宝石矿需要伐木场等级', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // gold_mine
      tick(engine, 16);
      engine.purchaseBuilding(1); // lumber_mill
      tick(engine, 16);
      const gemMine = (engine as any).upgrades.get('gem_mine');
      expect(gemMine.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('宝石在伐木场等级>=3时解锁', () => {
      engine.start();
      addGold(engine, 100000);
      // 先解锁伐木场
      engine.purchaseBuilding(0); // gold_mine
      tick(engine, 16);
      // 购买伐木场 3 级
      for (let i = 0; i < 3; i++) {
        engine.purchaseBuilding(1); // lumber_mill
      }
      tick(engine, 16);
      const gem = (engine as any).getResource('gem');
      expect(gem.unlocked).toBe(true);
    });

    it('魔法水晶在魔法塔等级>=1时解锁', () => {
      engine.start();
      addGold(engine, 1000000);
      addGem(engine, 1000);
      // 解锁建筑链
      engine.purchaseBuilding(0); // gold_mine
      tick(engine, 16);
      engine.purchaseBuilding(2); // barracks
      tick(engine, 16);
      engine.purchaseBuilding(3); // archer_tower
      tick(engine, 16);
      engine.purchaseBuilding(4); // magic_tower
      tick(engine, 16);
      const crystal = (engine as any).getResource('crystal');
      expect(crystal.unlocked).toBe(true);
    });
  });

  // ========== 英雄系统 ==========

  describe('英雄系统', () => {
    it('招募游侠需要 500 金币', () => {
      engine.start();
      addGold(engine, 500);
      const result = engine.recruitHero('ranger');
      expect(result).toBe(true);
    });

    it('招募游侠失败（金币不足）', () => {
      engine.start();
      addGold(engine, 100);
      const result = engine.recruitHero('ranger');
      expect(result).toBe(false);
    });

    it('重复招募同一英雄失败', () => {
      engine.start();
      addGold(engine, 2000);
      engine.recruitHero('ranger');
      const result = engine.recruitHero('ranger');
      expect(result).toBe(false);
    });

    it('招募不存在的英雄失败', () => {
      engine.start();
      const result = engine.recruitHero('nonexistent');
      expect(result).toBe(false);
    });

    it('招募英雄触发 heroRecruited 事件', () => {
      engine.start();
      addGold(engine, 500);
      const listener = jest.fn();
      engine.on('heroRecruited', listener);
      engine.recruitHero('ranger');
      expect(listener).toHaveBeenCalledWith('ranger');
    });

    it('招募英雄增加统计计数', () => {
      engine.start();
      addGold(engine, 500);
      engine.recruitHero('ranger');
      expect(engine.statistics.totalHeroesUnlocked).toBe(2); // 初始1 + 新招募1
    });

    it('招募法师需要宝石', () => {
      engine.start();
      addGold(engine, 2000);
      addGem(engine, 10);
      const result = engine.recruitHero('mage');
      expect(result).toBe(true);
    });

    it('招募法师失败（缺少宝石）', () => {
      engine.start();
      addGold(engine, 2000);
      const result = engine.recruitHero('mage');
      expect(result).toBe(false);
    });

    it('heroes getter 返回副本', () => {
      const heroes1 = engine.heroes;
      const heroes2 = engine.heroes;
      expect(heroes1).not.toBe(heroes2);
    });
  });

  // ========== 英雄进化 ==========

  describe('英雄进化', () => {
    it('进化骑士成功', () => {
      engine.start();
      addGem(engine, 100);
      addCrystal(engine, 50);
      const result = engine.evolveHero('knight');
      expect(result).toBe(true);
      expect(engine.getHeroEvolutionLevel('knight')).toBe(1);
    });

    it('进化未解锁的英雄失败', () => {
      engine.start();
      const result = engine.evolveHero('ranger');
      expect(result).toBe(false);
    });

    it('进化资源不足时失败', () => {
      engine.start();
      const result = engine.evolveHero('knight');
      expect(result).toBe(false);
    });

    it('进化后英雄加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addGem(engine, 100);
      addCrystal(engine, 50);
      engine.evolveHero('knight');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('进化触发 heroEvolved 事件', () => {
      engine.start();
      addGem(engine, 100);
      addCrystal(engine, 50);
      const listener = jest.fn();
      engine.on('heroEvolved', listener);
      engine.evolveHero('knight');
      expect(listener).toHaveBeenCalledWith('knight', 1);
    });

    it('进化增加统计计数', () => {
      engine.start();
      addGem(engine, 100);
      addCrystal(engine, 50);
      engine.evolveHero('knight');
      expect(engine.statistics.totalEvolutions).toBe(1);
    });

    it('获取进化费用', () => {
      const cost1 = engine.getEvolutionCost(1);
      expect(cost1).toBeDefined();
      expect(Object.keys(cost1).length).toBeGreaterThan(0);
    });

    it('高级进化费用更高', () => {
      const cost1 = engine.getEvolutionCost(1);
      const cost3 = engine.getEvolutionCost(3);
      expect(cost3.gem).toBeGreaterThan(cost1.gem);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（骑士加成）', () => {
      // 骑士初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始产出倍率为 1（无产出加成英雄）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1); // 无声望，骑士只加点击
    });

    it('初始宝石倍率为 1', () => {
      const mult = engine.getGemMultiplier();
      expect(mult).toBe(1);
    });

    it('初始水晶倍率为 1', () => {
      const mult = engine.getCrystalMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随荣耀勋章增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * HONOR_BONUS_MULTIPLIER, 2);
    });

    it('招募游侠增加产出倍率', () => {
      engine.start();
      addGold(engine, 500);
      engine.recruitHero('ranger');
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('魔法点击倍率初始为 1', () => {
      const mult = engine.getSpellClickMultiplier();
      expect(mult).toBe(1);
    });

    it('魔法生产倍率初始为 1', () => {
      const mult = engine.getSpellProductionMultiplier('gold');
      expect(mult).toBe(1);
    });
  });

  // ========== 魔法系统 ==========

  describe('魔法系统', () => {
    it('应有 4 种魔法', () => {
      expect(SPELLS.length).toBe(4);
    });

    it('施放淘金术成功', () => {
      engine.start();
      addCrystal(engine, 10);
      const result = engine.castSpell('gold_rush');
      expect(result).toBe(true);
    });

    it('施放淘金术失败（水晶不足）', () => {
      engine.start();
      const result = engine.castSpell('gold_rush');
      expect(result).toBe(false);
    });

    it('施放不存在的魔法失败', () => {
      engine.start();
      const result = engine.castSpell('nonexistent');
      expect(result).toBe(false);
    });

    it('施放魔法后水晶减少', () => {
      engine.start();
      addCrystal(engine, 10);
      const before = getCrystal(engine);
      engine.castSpell('gold_rush');
      expect(getCrystal(engine)).toBeLessThan(before);
    });

    it('施放魔法增加统计计数', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      expect(engine.statistics.totalSpellsCast).toBe(1);
    });

    it('施放魔法触发 spellCast 事件', () => {
      engine.start();
      addCrystal(engine, 10);
      const listener = jest.fn();
      engine.on('spellCast', listener);
      engine.castSpell('gold_rush');
      expect(listener).toHaveBeenCalledWith('gold_rush');
    });

    it('施放后魔法处于激活状态', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      expect(engine.isSpellActive('gold_rush')).toBe(true);
    });

    it('施放后魔法进入冷却', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      expect(engine.isSpellOnCooldown('gold_rush')).toBe(true);
    });

    it('冷却中无法再次施放', () => {
      engine.start();
      addCrystal(engine, 100);
      engine.castSpell('gold_rush');
      const result = engine.castSpell('gold_rush');
      expect(result).toBe(false);
    });

    it('魔法激活期间生产倍率增加', () => {
      engine.start();
      addCrystal(engine, 10);
      const multBefore = engine.getSpellProductionMultiplier('gold');
      engine.castSpell('gold_rush');
      const multAfter = engine.getSpellProductionMultiplier('gold');
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('魔法激活期间点击倍率增加（click_frenzy）', () => {
      engine.start();
      addCrystal(engine, 10);
      const multBefore = engine.getSpellClickMultiplier();
      engine.castSpell('click_frenzy');
      const multAfter = engine.getSpellClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('魔法效果随时间衰减', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      expect(engine.isSpellActive('gold_rush')).toBe(true);
      // 推进时间超过持续时间
      tick(engine, 11000);
      expect(engine.isSpellActive('gold_rush')).toBe(false);
    });

    it('魔法冷却随时间衰减', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      expect(engine.isSpellOnCooldown('gold_rush')).toBe(true);
      // 推进时间超过冷却时间
      tick(engine, 31000);
      expect(engine.isSpellOnCooldown('gold_rush')).toBe(false);
    });

    it('获取魔法冷却剩余时间', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      const remaining = engine.getSpellCooldownRemaining('gold_rush');
      expect(remaining).toBeGreaterThan(0);
    });

    it('获取魔法激活剩余时间', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      const remaining = engine.getSpellActiveRemaining('gold_rush');
      expect(remaining).toBeGreaterThan(0);
    });

    it('未施放魔法时冷却剩余为 0', () => {
      expect(engine.getSpellCooldownRemaining('gold_rush')).toBe(0);
    });

    it('未施放魔法时激活剩余为 0', () => {
      expect(engine.getSpellActiveRemaining('gold_rush')).toBe(0);
    });

    it('idle 状态下施放魔法失败', () => {
      addCrystal(engine, 10);
      const result = engine.castSpell('gold_rush');
      expect(result).toBe(false);
    });

    it('施放宝石祝福成功', () => {
      engine.start();
      addCrystal(engine, 10);
      const result = engine.castSpell('gem_blessing');
      expect(result).toBe(true);
    });

    it('施放水晶涌动成功', () => {
      engine.start();
      addCrystal(engine, 10);
      const result = engine.castSpell('crystal_surge');
      expect(result).toBe(true);
    });

    it('施放狂暴点击成功', () => {
      engine.start();
      addCrystal(engine, 10);
      const result = engine.castSpell('click_frenzy');
      expect(result).toBe(true);
    });

    it('activeSpells getter 返回副本', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      const spells1 = engine.activeSpells;
      const spells2 = engine.activeSpells;
      expect(spells1).not.toBe(spells2);
    });

    it('spellCooldowns getter 返回副本', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      const cd1 = engine.spellCooldowns;
      const cd2 = engine.spellCooldowns;
      expect(cd1).not.toBe(cd2);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始荣耀勋章为 0', () => {
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
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const honor = engine.doPrestige();
      expect(honor).toBeGreaterThan(0);
    });

    it('声望后荣耀勋章增加', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addGold(engine, MIN_PRESTIGE_GOLD * 4);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(getGold(engine)).toBe(0);
    });

    it('声望保留英雄进化等级', () => {
      engine.start();
      addGem(engine, 100);
      addCrystal(engine, 50);
      engine.evolveHero('knight');
      const evoBefore = engine.getHeroEvolutionLevel('knight');

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      const evoAfter = engine.getHeroEvolutionLevel('knight');
      expect(evoAfter).toBe(evoBefore);
    });

    it('声望保留英雄解锁状态', () => {
      engine.start();
      addGold(engine, 500);
      engine.recruitHero('ranger');

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      const heroes = engine.heroes;
      const ranger = heroes.find(h => h.id === 'ranger');
      expect(ranger?.unlocked).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const listener = jest.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望后魔法效果清除', () => {
      engine.start();
      addCrystal(engine, 100);
      engine.castSpell('gold_rush');
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.activeSpells.length).toBe(0);
    });

    it('声望后统计计数更新', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.statistics.totalPrestigeCount).toBe(1);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('heroes-might');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addGold(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含英雄和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).heroes).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addGold(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getGold(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复英雄状态', () => {
      engine.start();
      addGold(engine, 500);
      engine.recruitHero('ranger');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const heroes = engine2.heroes;
      const ranger = heroes.find(h => h.id === 'ranger');
      expect(ranger?.unlocked).toBe(true);
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
      expect(state.heroes).toBeDefined();
      expect(state.spells).toBeDefined();
      expect(state.spellCooldowns).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addGold(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getGold(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复英雄', () => {
      engine.start();
      addGold(engine, 500);
      engine.recruitHero('ranger');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const heroes = engine2.heroes;
      const ranger = heroes.find(h => h.id === 'ranger');
      expect(ranger?.unlocked).toBe(true);
    });

    it('loadState 恢复魔法效果', () => {
      engine.start();
      addCrystal(engine, 100);
      engine.castSpell('gold_rush');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.isSpellActive('gold_rush')).toBe(true);
    });

    it('loadState 恢复魔法冷却', () => {
      engine.start();
      addCrystal(engine, 100);
      engine.castSpell('gold_rush');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.isSpellOnCooldown('gold_rush')).toBe(true);
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
      expect(getGold(engine)).toBeGreaterThan(0);
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
      addGold(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('E 键进化英雄', () => {
      engine.start();
      addGem(engine, 100);
      addCrystal(engine, 50);
      engine.handleKeyDown('e');
      expect(engine.getHeroEvolutionLevel('knight')).toBe(1);
    });

    it('S 键施放魔法', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.handleKeyDown('s');
      expect(engine.isSpellActive('gold_rush')).toBe(true);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getGold(engine)).toBe(0);
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

    it('有英雄进化时渲染正常', () => {
      engine.start();
      addGem(engine, 100);
      addCrystal(engine, 50);
      engine.evolveHero('knight');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有魔法效果时渲染正常', () => {
      engine.start();
      addCrystal(engine, 10);
      engine.castSpell('gold_rush');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑时渲染正常', () => {
      engine.start();
      addGold(engine, 10000);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('tick 后渲染正常', () => {
      engine.start();
      tick(engine, 100);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // gold_mine
      const before = getGold(engine);
      tick(engine, 1000);
      const after = getGold(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const before = getGold(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getGold(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('宝石矿产出宝石', () => {
      engine.start();
      addGold(engine, 100000);
      // 解锁金矿
      engine.purchaseBuilding(0); // gold_mine
      tick(engine, 16);
      // 解锁并购买伐木场
      engine.purchaseBuilding(1); // lumber_mill
      tick(engine, 16);
      // 购买宝石矿
      engine.purchaseBuilding(5); // gem_mine
      tick(engine, 16);
      // 手动解锁宝石资源
      const gem = (engine as any).getResource('gem');
      gem.unlocked = true;
      const before = getGem(engine);
      tick(engine, 1000);
      const after = getGem(engine);
      expect(after).toBeGreaterThan(before);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addGold(engine, 1e14);
      expect(getGold(engine)).toBeGreaterThan(0);
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

    it('建筑达到最大等级后无法购买', () => {
      engine.start();
      addGold(engine, 1e15);
      const building = BUILDINGS[0];
      const upgrade = (engine as any).upgrades.get(building.id);
      upgrade.level = building.maxLevel;
      upgrade.unlocked = true;
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
    });

    it('英雄达到最大进化等级后无法进化', () => {
      engine.start();
      const hero = (engine as any)._heroes.find((h: any) => h.id === 'knight');
      hero.evolutionLevel = MAX_EVOLUTION_LEVEL;
      addGem(engine, 10000);
      addCrystal(engine, 10000);
      const result = engine.evolveHero('knight');
      expect(result).toBe(false);
    });

    it('getBuildingCost 无效索引返回空对象', () => {
      const cost = engine.getBuildingCost(-1);
      expect(cost).toEqual({});
      const cost2 = engine.getBuildingCost(99);
      expect(cost2).toEqual({});
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });

    it('getHeroEvolutionLevel 不存在的英雄返回 0', () => {
      expect(engine.getHeroEvolutionLevel('nonexistent')).toBe(0);
    });

    it('getEvolutionCost 无效等级返回空对象', () => {
      const cost = engine.getEvolutionCost(99);
      expect(cost).toEqual({});
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('GOLD_PER_CLICK 为 1', () => {
      expect(GOLD_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_GOLD 为 50000', () => {
      expect(MIN_PRESTIGE_GOLD).toBe(50000);
    });

    it('HONOR_BONUS_MULTIPLIER 为正数', () => {
      expect(HONOR_BONUS_MULTIPLIER).toBeGreaterThan(0);
    });

    it('EVOLUTION_COSTS 有 5 个等级', () => {
      expect(Object.keys(EVOLUTION_COSTS).length).toBe(5);
    });

    it('MAX_EVOLUTION_LEVEL 为 5', () => {
      expect(MAX_EVOLUTION_LEVEL).toBe(5);
    });

    it('COLORS 包含必要颜色', () => {
      expect(COLORS.accent).toBeDefined();
      expect(COLORS.textPrimary).toBeDefined();
      expect(COLORS.goldColor).toBeDefined();
      expect(COLORS.gemColor).toBeDefined();
      expect(COLORS.crystalColor).toBeDefined();
    });

    it('CASTLE_DRAW 包含布局参数', () => {
      expect(CASTLE_DRAW.centerX).toBeDefined();
      expect(CASTLE_DRAW.centerY).toBeDefined();
      expect(CASTLE_DRAW.width).toBeDefined();
      expect(CASTLE_DRAW.height).toBeDefined();
    });
  });
});
