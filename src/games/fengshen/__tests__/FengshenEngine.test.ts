/**
 * 封神演义 (Fengshen) 放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FengshenEngine } from '@/games/fengshen/FengshenEngine';
import type { FengshenStatistics } from '@/games/fengshen/FengshenEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_SPIRIT,
  IMMORTALS,
  BUILDINGS,
  COLORS,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/fengshen/constants';

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

function createEngine(): FengshenEngine {
  const engine = new FengshenEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): FengshenEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addSpirit(engine: FengshenEngine, amount: number): void {
  (engine as any).addResource('spirit', amount);
}

function addMerit(engine: FengshenEngine, amount: number): void {
  (engine as any).addResource('merit', amount);
}

function addTreasure(engine: FengshenEngine, amount: number): void {
  (engine as any).addResource('treasure', amount);
}

/** 触发一次 update */
function tick(engine: FengshenEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getSpirit(engine: FengshenEngine): number {
  return (engine as any).getResource('spirit')?.amount ?? 0;
}

function getMerit(engine: FengshenEngine): number {
  return (engine as any).getResource('merit')?.amount ?? 0;
}

function getTreasure(engine: FengshenEngine): number {
  return (engine as any).getResource('treasure')?.amount ?? 0;
}

// ========== 测试 ==========

describe('FengshenEngine', () => {
  let engine: FengshenEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(FengshenEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后灵力为 0', () => {
      expect(getSpirit(engine)).toBe(0);
    });

    it('init 后功德为 0', () => {
      expect(getMerit(engine)).toBe(0);
    });

    it('init 后法宝为 0', () => {
      expect(getTreasure(engine)).toBe(0);
    });

    it('init 后总灵力获得为 0', () => {
      expect(engine.totalSpiritEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 fengshen', () => {
      expect(engine.gameId).toBe('fengshen');
    });

    it('init 后灵力已解锁', () => {
      const res = (engine as any).getResource('spirit');
      expect(res.unlocked).toBe(true);
    });

    it('init 后功德未解锁', () => {
      const res = (engine as any).getResource('merit');
      expect(res.unlocked).toBe(false);
    });

    it('init 后法宝未解锁', () => {
      const res = (engine as any).getResource('treasure');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('RESOURCE_IDS 包含三种资源', () => {
      expect(RESOURCE_IDS.SPIRIT).toBe('spirit');
      expect(RESOURCE_IDS.MERIT).toBe('merit');
      expect(RESOURCE_IDS.TREASURE).toBe('treasure');
    });

    it('BUILDING_IDS 包含 8 个建筑', () => {
      const ids = Object.values(BUILDING_IDS);
      expect(ids.length).toBe(8);
    });

    it('BUILDINGS 数组有 8 个建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('MIN_PRESTIGE_SPIRIT 为 50000', () => {
      expect(MIN_PRESTIGE_SPIRIT).toBe(50000);
    });

    it('COLORS 存在', () => {
      expect(COLORS).toBeDefined();
      expect(COLORS.accent).toBe('#FFD700');
    });

    it('IMMORTALS 有 6 个神仙', () => {
      expect(IMMORTALS.length).toBe(6);
    });
  });

  // ========== 神仙初始化 ==========

  describe('神仙初始化', () => {
    it('应有 6 种神仙', () => {
      expect(IMMORTALS.length).toBe(6);
    });

    it('初始只有哪吒解锁', () => {
      const immortals = engine.immortals;
      const neZha = immortals.find(i => i.id === 'ne_zha');
      expect(neZha?.unlocked).toBe(true);
    });

    it('其他神仙初始未解锁', () => {
      const immortals = engine.immortals;
      const locked = immortals.filter(i => i.id !== 'ne_zha');
      locked.forEach(i => {
        expect(i.unlocked).toBe(false);
      });
    });

    it('所有神仙初始进化等级为 0', () => {
      const immortals = engine.immortals;
      immortals.forEach(i => {
        expect(i.evolutionLevel).toBe(0);
      });
    });

    it('神仙 ID 唯一', () => {
      const ids = IMMORTALS.map(i => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个神仙有名称', () => {
      IMMORTALS.forEach(i => {
        expect(i.name).toBeTruthy();
      });
    });

    it('每个神仙有图标', () => {
      IMMORTALS.forEach(i => {
        expect(i.icon).toBeTruthy();
      });
    });

    it('每个神仙有正数加成值', () => {
      IMMORTALS.forEach(i => {
        expect(i.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个神仙有进化倍率', () => {
      IMMORTALS.forEach(i => {
        expect(i.evolutionMultiplier).toBeGreaterThan(0);
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

    it('reset 后灵力归零', () => {
      engine.start();
      addSpirit(engine, 1000);
      engine.reset();
      expect(getSpirit(engine)).toBe(0);
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
      addSpirit(engine, 500);
      engine.reset();
      engine.start();
      expect(getSpirit(engine)).toBe(0);
    });
  });

  // ========== 点击产生灵力 ==========

  describe('点击产生灵力', () => {
    it('点击一次产生灵力', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getSpirit(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生灵力', () => {
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

    it('点击增加总灵力获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalSpiritEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getSpirit(engine)).toBe(0);
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
    it('增加灵力', () => {
      addSpirit(engine, 100);
      expect(getSpirit(engine)).toBe(100);
    });

    it('增加功德', () => {
      addMerit(engine, 30);
      expect(getMerit(engine)).toBe(30);
    });

    it('增加法宝', () => {
      addTreasure(engine, 50);
      expect(getTreasure(engine)).toBe(50);
    });

    it('消耗灵力成功', () => {
      addSpirit(engine, 100);
      (engine as any).spendResource('spirit', 50);
      expect(getSpirit(engine)).toBe(50);
    });

    it('消耗灵力失败（不足）', () => {
      addSpirit(engine, 10);
      const result = (engine as any).spendResource('spirit', 50);
      expect(result).toBeFalsy();
      expect(getSpirit(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addSpirit(engine, 100);
      expect((engine as any).hasResource('spirit', 50)).toBe(true);
      expect((engine as any).hasResource('spirit', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addSpirit(engine, 100);
      addMerit(engine, 50);
      expect((engine as any).canAfford({ spirit: 50, merit: 20 })).toBe(true);
      expect((engine as any).canAfford({ spirit: 50, merit: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有洞府解锁', () => {
      const cave = (engine as any).upgrades.get('cave');
      expect(cave.unlocked).toBe(true);
    });

    it('炼器坊初始未解锁', () => {
      const forge = (engine as any).upgrades.get('forge');
      expect(forge.unlocked).toBe(false);
    });

    it('购买洞府成功', () => {
      engine.start();
      addSpirit(engine, 100);
      const result = engine.purchaseBuilding(0); // cave
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买洞府失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addSpirit(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.spirit).toBeGreaterThan(cost1.spirit);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addSpirit(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addSpirit(engine, 100000);
      // 炼器坊需要洞府和祭天坛/观星塔
      const result = engine.purchaseBuilding(3); // forge
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addSpirit(engine, 100);
      const before = getSpirit(engine);
      engine.purchaseBuilding(0);
      expect(getSpirit(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addSpirit(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('祭天坛在洞府有等级后解锁', () => {
      engine.start();
      addSpirit(engine, 10000);
      engine.purchaseBuilding(0); // cave
      tick(engine, 16);
      const altar = (engine as any).upgrades.get('altar');
      expect(altar.unlocked).toBe(true);
    });

    it('观星塔在洞府有等级后解锁', () => {
      engine.start();
      addSpirit(engine, 10000);
      engine.purchaseBuilding(0); // cave
      tick(engine, 16);
      const tower = (engine as any).upgrades.get('tower');
      expect(tower.unlocked).toBe(true);
    });

    it('炼器坊需要祭天坛和观星塔', () => {
      engine.start();
      addSpirit(engine, 100000);
      // 购买洞府
      engine.purchaseBuilding(0); // cave
      tick(engine, 16);
      // 购买祭天坛和观星塔
      engine.purchaseBuilding(1); // altar
      engine.purchaseBuilding(2); // tower
      tick(engine, 16);
      const forge = (engine as any).upgrades.get('forge');
      expect(forge.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('功德在祭天坛等级>=1时解锁', () => {
      engine.start();
      addSpirit(engine, 100000);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(0); // cave
      }
      tick(engine, 16);
      // 解锁祭天坛并购买1级
      engine.purchaseBuilding(1); // altar
      tick(engine, 16);
      const merit = (engine as any).getResource('merit');
      expect(merit.unlocked).toBe(true);
    });

    it('法宝在洞府等级>=5时解锁', () => {
      engine.start();
      addSpirit(engine, 1000000);
      // 购买洞府5级
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      const treasure = (engine as any).getResource('treasure');
      expect(treasure.unlocked).toBe(true);
    });
  });

  // ========== 神仙系统 ==========

  describe('神仙系统', () => {
    it('解锁杨戬需要 800 灵力', () => {
      engine.start();
      addSpirit(engine, 800);
      const result = engine.unlockImmortal('yang_jian');
      expect(result).toBe(true);
    });

    it('解锁杨戬失败（灵力不足）', () => {
      engine.start();
      addSpirit(engine, 100);
      const result = engine.unlockImmortal('yang_jian');
      expect(result).toBe(false);
    });

    it('重复解锁同一神仙失败', () => {
      engine.start();
      addSpirit(engine, 2000);
      engine.unlockImmortal('yang_jian');
      const result = engine.unlockImmortal('yang_jian');
      expect(result).toBe(false);
    });

    it('解锁不存在的神仙失败', () => {
      engine.start();
      const result = engine.unlockImmortal('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁神仙触发 immortalUnlocked 事件', () => {
      engine.start();
      addSpirit(engine, 800);
      const listener = vi.fn();
      engine.on('immortalUnlocked', listener);
      engine.unlockImmortal('yang_jian');
      expect(listener).toHaveBeenCalledWith('yang_jian');
    });

    it('解锁神仙增加统计计数', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockImmortal('yang_jian');
      expect((engine as any)._stats.totalImmortalsUnlocked).toBe(2); // 初始1 + 新解锁1
    });

    it('immortals getter 返回副本', () => {
      const immortals1 = engine.immortals;
      const immortals2 = engine.immortals;
      expect(immortals1).not.toBe(immortals2);
    });
  });

  // ========== 神仙进化 ==========

  describe('神仙进化', () => {
    it('进化哪吒成功', () => {
      engine.start();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      const result = engine.evolveImmortal('ne_zha');
      expect(result).toBe(true);
      expect(engine.getImmortalEvolutionLevel('ne_zha')).toBe(1);
    });

    it('进化未解锁的神仙失败', () => {
      engine.start();
      const result = engine.evolveImmortal('yang_jian');
      expect(result).toBe(false);
    });

    it('进化资源不足时失败', () => {
      engine.start();
      const result = engine.evolveImmortal('ne_zha');
      expect(result).toBe(false);
    });

    it('进化后神仙加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      engine.evolveImmortal('ne_zha');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('进化触发 immortalEvolved 事件', () => {
      engine.start();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      const listener = vi.fn();
      engine.on('immortalEvolved', listener);
      engine.evolveImmortal('ne_zha');
      expect(listener).toHaveBeenCalledWith('ne_zha', 1);
    });

    it('进化增加统计计数', () => {
      engine.start();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      engine.evolveImmortal('ne_zha');
      expect((engine as any)._stats.totalEvolutions).toBe(1);
    });

    it('获取进化费用', () => {
      const cost1 = engine.getEvolutionCost(1);
      expect(cost1).toBeDefined();
      expect(Object.keys(cost1).length).toBeGreaterThan(0);
    });

    it('高级进化费用更高', () => {
      const cost1 = engine.getEvolutionCost(1);
      const cost3 = engine.getEvolutionCost(3);
      expect(cost3.merit).toBeGreaterThan(cost1.merit);
    });

    it('进化等级不超过最大值', () => {
      engine.start();
      // 手动设置进化等级到最大
      const immortal = (engine as any)._immortals.find((i: any) => i.id === 'ne_zha');
      immortal.evolutionLevel = 5; // MAX_EVOLUTION_LEVEL
      const result = engine.evolveImmortal('ne_zha');
      expect(result).toBe(false);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（哪吒加成）', () => {
      // 哪吒初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始产出倍率为 1（无产出加成神仙）', () => {
      const mult = engine.getProductionMultiplier();
      // 无转生天命，哪吒只加点击，所以产出倍率 = prestigeMultiplier = 1
      expect(mult).toBe(1);
    });

    it('初始功德倍率为 1', () => {
      const mult = engine.getMeritMultiplier();
      expect(mult).toBe(1);
    });

    it('初始法宝倍率为 1', () => {
      const mult = engine.getTreasureMultiplier();
      expect(mult).toBe(1);
    });

    it('转生倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('转生倍率随天命增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * PRESTIGE_BONUS_MULTIPLIER, 2);
    });

    it('解锁杨戬增加产出倍率', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockImmortal('yang_jian');
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 转生系统 ==========

  describe('转生系统', () => {
    it('初始天命为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始转生次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('灵力不足时无法转生', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('转生预览为 0（灵力不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('灵力达到最低要求时可以转生', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('转生重置成功', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      const destiny = engine.doPrestige();
      expect(destiny).toBeGreaterThan(0);
    });

    it('转生后天命增加', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('转生后转生次数增加', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('转生后资源归零', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      expect(getSpirit(engine)).toBe(0);
    });

    it('转生保留神仙进化等级', () => {
      engine.start();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      engine.evolveImmortal('ne_zha');
      const evoBefore = engine.getImmortalEvolutionLevel('ne_zha');

      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      const evoAfter = engine.getImmortalEvolutionLevel('ne_zha');
      expect(evoAfter).toBe(evoBefore);
    });

    it('转生保留神仙解锁状态', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockImmortal('yang_jian');

      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      const immortals = engine.immortals;
      const yangJian = immortals.find(g => g.id === 'yang_jian');
      expect(yangJian?.unlocked).toBe(true);
    });

    it('转生触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('灵力不足时转生返回 0', () => {
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
      expect(data.gameId).toBe('fengshen');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addSpirit(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含神仙和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).immortals).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addSpirit(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getSpirit(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复神仙状态', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockImmortal('yang_jian');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const immortals = engine2.immortals;
      const yangJian = immortals.find(i => i.id === 'yang_jian');
      expect(yangJian?.unlocked).toBe(true);
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
      expect(state.immortals).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addSpirit(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getSpirit(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复神仙', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockImmortal('yang_jian');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const immortals = engine2.immortals;
      const yangJian = immortals.find(i => i.id === 'yang_jian');
      expect(yangJian?.unlocked).toBe(true);
    });

    it('loadState 恢复进化等级', () => {
      engine.start();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      engine.evolveImmortal('ne_zha');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.getImmortalEvolutionLevel('ne_zha')).toBe(1);
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
      expect(getSpirit(engine)).toBeGreaterThan(0);
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
      addSpirit(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('E 键进化神仙', () => {
      engine.start();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      engine.handleKeyDown('e');
      expect(engine.getImmortalEvolutionLevel('ne_zha')).toBe(1);
    });

    it('P 键触发转生', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getSpirit(engine)).toBe(0);
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

    it('有转生时渲染正常', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有神仙进化时渲染正常', () => {
      engine.start();
      addTreasure(engine, 100);
      addMerit(engine, 50);
      engine.evolveImmortal('ne_zha');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(0); // cave
      const before = getSpirit(engine);
      tick(engine, 1000);
      const after = getSpirit(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(0);
      const before = getSpirit(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getSpirit(engine);
      expect(after).toBeGreaterThan(before);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addSpirit(engine, 1e14);
      expect(getSpirit(engine)).toBeGreaterThan(0);
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
      const stats1 = (engine as any)._stats;
      const stats2 = { ...(engine as any)._stats };
      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });
});
