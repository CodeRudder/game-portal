/**
 * Dino Ranch（恐龙牧场）放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DinoRanchEngine } from '@/games/dino-ranch/DinoRanchEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MEAT_PER_CLICK,
  GENE_BONUS_MULTIPLIER,
  PRESTIGE_MIN_TOTAL_MEAT,
  DINO_BREEDS,
  BUILDINGS,
  COLORS,
  DINO_DRAW,
} from '@/games/dino-ranch/constants';

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

function createEngine(): DinoRanchEngine {
  const engine = new DinoRanchEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): DinoRanchEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addMeat(engine: DinoRanchEngine, amount: number): void {
  (engine as any).addResource('meat', amount);
}

function addEggs(engine: DinoRanchEngine, amount: number): void {
  (engine as any).addResource('dino_eggs', amount);
}

function addFossils(engine: DinoRanchEngine, amount: number): void {
  (engine as any).addResource('fossils', amount);
}

function addGenes(engine: DinoRanchEngine, amount: number): void {
  (engine as any).addResource('gene_fragments', amount);
}

/** 触发一次 update */
function tick(engine: DinoRanchEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getMeat(engine: DinoRanchEngine): number {
  return (engine as any).getResource('meat')?.amount ?? 0;
}

function getEggs(engine: DinoRanchEngine): number {
  return (engine as any).getResource('dino_eggs')?.amount ?? 0;
}

function getFossils(engine: DinoRanchEngine): number {
  return (engine as any).getResource('fossils')?.amount ?? 0;
}

function getGenes(engine: DinoRanchEngine): number {
  return (engine as any).getResource('gene_fragments')?.amount ?? 0;
}

// ========== 测试 ==========

describe('DinoRanchEngine', () => {
  let engine: DinoRanchEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(DinoRanchEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后肉为 0', () => {
      expect(getMeat(engine)).toBe(0);
    });

    it('init 后恐龙蛋为 0', () => {
      expect(getEggs(engine)).toBe(0);
    });

    it('init 后化石为 0', () => {
      expect(getFossils(engine)).toBe(0);
    });

    it('init 后基因碎片为 0', () => {
      expect(getGenes(engine)).toBe(0);
    });

    it('init 后总肉获得为 0', () => {
      expect(engine.totalMeatEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 dino-ranch', () => {
      expect(engine.gameId).toBe('dino-ranch');
    });

    it('init 后肉已解锁', () => {
      const res = (engine as any).getResource('meat');
      expect(res.unlocked).toBe(true);
    });

    it('init 后恐龙蛋未解锁', () => {
      const res = (engine as any).getResource('dino_eggs');
      expect(res.unlocked).toBe(false);
    });

    it('init 后化石未解锁', () => {
      const res = (engine as any).getResource('fossils');
      expect(res.unlocked).toBe(false);
    });

    it('init 后基因碎片未解锁', () => {
      const res = (engine as any).getResource('gene_fragments');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 恐龙品种初始化 ==========

  describe('恐龙品种初始化', () => {
    it('应有 6 种恐龙品种', () => {
      expect(DINO_BREEDS.length).toBe(6);
    });

    it('初始只有迅猛龙解锁', () => {
      const dinos = engine.dinos;
      const velociraptor = dinos.find(d => d.id === 'velociraptor');
      expect(velociraptor?.unlocked).toBe(true);
    });

    it('其他品种初始未解锁', () => {
      const dinos = engine.dinos;
      const locked = dinos.filter(d => d.id !== 'velociraptor');
      locked.forEach(d => {
        expect(d.unlocked).toBe(false);
      });
    });

    it('所有品种初始进化等级为 0', () => {
      const dinos = engine.dinos;
      dinos.forEach(d => {
        expect(d.evolutionLevel).toBe(0);
      });
    });

    it('品种 ID 唯一', () => {
      const ids = DINO_BREEDS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个品种有名称', () => {
      DINO_BREEDS.forEach(b => {
        expect(b.name).toBeTruthy();
      });
    });

    it('每个品种有图标', () => {
      DINO_BREEDS.forEach(b => {
        expect(b.icon).toBeTruthy();
      });
    });

    it('每个品种有正数加成值', () => {
      DINO_BREEDS.forEach(b => {
        expect(b.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个品种有进化倍率', () => {
      DINO_BREEDS.forEach(b => {
        expect(b.evolutionMultiplier).toBeGreaterThan(0);
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

    it('reset 后肉归零', () => {
      engine.start();
      addMeat(engine, 1000);
      engine.reset();
      expect(getMeat(engine)).toBe(0);
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
      addMeat(engine, 500);
      engine.reset();
      engine.start();
      expect(getMeat(engine)).toBe(0);
    });
  });

  // ========== 点击产生肉 ==========

  describe('点击产生肉', () => {
    it('点击一次产生肉', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getMeat(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生肉', () => {
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

    it('点击增加总肉获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalMeatEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getMeat(engine)).toBe(0);
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
    it('增加肉', () => {
      addMeat(engine, 100);
      expect(getMeat(engine)).toBe(100);
    });

    it('增加恐龙蛋', () => {
      addEggs(engine, 50);
      expect(getEggs(engine)).toBe(50);
    });

    it('增加化石', () => {
      addFossils(engine, 30);
      expect(getFossils(engine)).toBe(30);
    });

    it('增加基因碎片', () => {
      addGenes(engine, 10);
      expect(getGenes(engine)).toBe(10);
    });

    it('消耗肉成功', () => {
      addMeat(engine, 100);
      (engine as any).spendResource('meat', 50);
      expect(getMeat(engine)).toBe(50);
    });

    it('消耗肉失败（不足）', () => {
      addMeat(engine, 10);
      const result = (engine as any).spendResource('meat', 50);
      expect(result).toBeFalsy();
      expect(getMeat(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addMeat(engine, 100);
      expect((engine as any).hasResource('meat', 50)).toBe(true);
      expect((engine as any).hasResource('meat', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addMeat(engine, 100);
      addEggs(engine, 50);
      expect((engine as any).canAfford({ meat: 50, dino_eggs: 20 })).toBe(true);
      expect((engine as any).canAfford({ meat: 50, dino_eggs: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 6 种建筑', () => {
      expect(BUILDINGS.length).toBe(6);
    });

    it('初始只有围栏解锁', () => {
      const fence = (engine as any).upgrades.get('fence');
      expect(fence.unlocked).toBe(true);
    });

    it('孵化室初始未解锁', () => {
      const hatchery = (engine as any).upgrades.get('hatchery');
      expect(hatchery.unlocked).toBe(false);
    });

    it('购买围栏成功', () => {
      engine.start();
      addMeat(engine, 100);
      const result = engine.purchaseBuilding(0); // fence
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买围栏失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addMeat(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.meat).toBeGreaterThan(cost1.meat);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addMeat(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addMeat(engine, 10000);
      // 孵化室需要围栏等级 > 0
      const result = engine.purchaseBuilding(1); // hatchery
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addMeat(engine, 100);
      const before = getMeat(engine);
      engine.purchaseBuilding(0);
      expect(getMeat(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addMeat(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('孵化室在围栏有等级后解锁', () => {
      engine.start();
      addMeat(engine, 100);
      engine.purchaseBuilding(0); // fence
      tick(engine, 16);
      const hatchery = (engine as any).upgrades.get('hatchery');
      expect(hatchery.unlocked).toBe(true);
    });

    it('饲料场在围栏有等级后解锁', () => {
      engine.start();
      addMeat(engine, 100);
      engine.purchaseBuilding(0); // fence
      tick(engine, 16);
      const feedLot = (engine as any).upgrades.get('feed_lot');
      expect(feedLot.unlocked).toBe(true);
    });

    it('基因实验室需要孵化室和饲料场', () => {
      engine.start();
      // 购买围栏
      addMeat(engine, 10000);
      engine.purchaseBuilding(0); // fence
      tick(engine, 16);
      // 购买孵化室和饲料场
      engine.purchaseBuilding(1); // hatchery
      engine.purchaseBuilding(2); // feed_lot
      tick(engine, 16);
      const geneLab = (engine as any).upgrades.get('gene_lab');
      expect(geneLab.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('恐龙蛋在围栏等级>=5时解锁', () => {
      engine.start();
      addMeat(engine, 100000);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      const eggs = (engine as any).getResource('dino_eggs');
      expect(eggs.unlocked).toBe(true);
    });

    it('化石在孵化室等级>=3时解锁', () => {
      engine.start();
      addMeat(engine, 1000000);
      // 先解锁围栏
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      // 解锁并购买孵化室
      for (let i = 0; i < 3; i++) {
        engine.purchaseBuilding(1);
      }
      tick(engine, 16);
      const fossils = (engine as any).getResource('fossils');
      expect(fossils.unlocked).toBe(true);
    });
  });

  // ========== 恐龙系统 ==========

  describe('恐龙系统', () => {
    it('解锁三角龙需要 800 肉', () => {
      engine.start();
      addMeat(engine, 800);
      const result = engine.unlockDino('triceratops');
      expect(result).toBe(true);
    });

    it('解锁三角龙失败（肉不足）', () => {
      engine.start();
      addMeat(engine, 100);
      const result = engine.unlockDino('triceratops');
      expect(result).toBe(false);
    });

    it('重复解锁同一恐龙失败', () => {
      engine.start();
      addMeat(engine, 2000);
      engine.unlockDino('triceratops');
      const result = engine.unlockDino('triceratops');
      expect(result).toBe(false);
    });

    it('解锁不存在的恐龙失败', () => {
      engine.start();
      const result = engine.unlockDino('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁恐龙触发 dinoUnlocked 事件', () => {
      engine.start();
      addMeat(engine, 800);
      const listener = vi.fn();
      engine.on('dinoUnlocked', listener);
      engine.unlockDino('triceratops');
      expect(listener).toHaveBeenCalledWith('triceratops');
    });

    it('解锁恐龙增加统计计数', () => {
      engine.start();
      addMeat(engine, 800);
      engine.unlockDino('triceratops');
      expect(engine.statistics.totalDinosUnlocked).toBe(2); // 初始1 + 新解锁1
    });

    it('dinos getter 返回副本', () => {
      const dinos1 = engine.dinos;
      const dinos2 = engine.dinos;
      expect(dinos1).not.toBe(dinos2);
    });
  });

  // ========== 恐龙进化 ==========

  describe('恐龙进化', () => {
    it('进化迅猛龙成功', () => {
      engine.start();
      addEggs(engine, 100);
      addFossils(engine, 50);
      const result = engine.evolveDino('velociraptor');
      expect(result).toBe(true);
      expect(engine.getDinoEvolutionLevel('velociraptor')).toBe(1);
    });

    it('进化未解锁的恐龙失败', () => {
      engine.start();
      const result = engine.evolveDino('triceratops');
      expect(result).toBe(false);
    });

    it('进化资源不足时失败', () => {
      engine.start();
      const result = engine.evolveDino('velociraptor');
      expect(result).toBe(false);
    });

    it('进化后恐龙加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addEggs(engine, 100);
      addFossils(engine, 50);
      engine.evolveDino('velociraptor');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('进化触发 dinoEvolved 事件', () => {
      engine.start();
      addEggs(engine, 100);
      addFossils(engine, 50);
      const listener = vi.fn();
      engine.on('dinoEvolved', listener);
      engine.evolveDino('velociraptor');
      expect(listener).toHaveBeenCalledWith('velociraptor', 1);
    });

    it('进化增加统计计数', () => {
      engine.start();
      addEggs(engine, 100);
      addFossils(engine, 50);
      engine.evolveDino('velociraptor');
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
      expect(cost3.dino_eggs).toBeGreaterThan(cost1.dino_eggs);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（迅猛龙加成）', () => {
      // 迅猛龙初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始产出倍率为 1（无产出加成恐龙）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1); // 无声望，迅猛龙只加点击
    });

    it('初始恐龙蛋倍率为 1', () => {
      const mult = engine.getEggMultiplier();
      expect(mult).toBe(1);
    });

    it('初始化石倍率为 1', () => {
      const mult = engine.getFossilMultiplier();
      expect(mult).toBe(1);
    });

    it('初始基因碎片倍率为 1', () => {
      const mult = engine.getGeneFragmentMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随远古基因增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * GENE_BONUS_MULTIPLIER, 2);
    });

    it('解锁三角龙增加产出倍率', () => {
      engine.start();
      addMeat(engine, 800);
      engine.unlockDino('triceratops');
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始远古基因为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('肉不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（肉不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('肉达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
      const genes = engine.doPrestige();
      expect(genes).toBeGreaterThan(0);
    });

    it('声望后远古基因增加', () => {
      engine.start();
      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addMeat(engine, PRESTIGE_MIN_TOTAL_MEAT * 4);
      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
      engine.doPrestige();
      expect(getMeat(engine)).toBe(0);
    });

    it('声望保留恐龙进化等级', () => {
      engine.start();
      addEggs(engine, 100);
      addFossils(engine, 50);
      engine.evolveDino('velociraptor');
      const evoBefore = engine.getDinoEvolutionLevel('velociraptor');

      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
      engine.doPrestige();
      const evoAfter = engine.getDinoEvolutionLevel('velociraptor');
      expect(evoAfter).toBe(evoBefore);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
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
      expect(data.gameId).toBe('dino-ranch');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addMeat(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含恐龙和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).dinos).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addMeat(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getMeat(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复恐龙状态', () => {
      engine.start();
      addMeat(engine, 800);
      engine.unlockDino('triceratops');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const dinos = engine2.dinos;
      const triceratops = dinos.find(d => d.id === 'triceratops');
      expect(triceratops?.unlocked).toBe(true);
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
      expect(state.dinos).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addMeat(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getMeat(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复恐龙', () => {
      engine.start();
      addMeat(engine, 800);
      engine.unlockDino('triceratops');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const dinos = engine2.dinos;
      const triceratops = dinos.find(d => d.id === 'triceratops');
      expect(triceratops?.unlocked).toBe(true);
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
      expect(getMeat(engine)).toBeGreaterThan(0);
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
      addMeat(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('E 键进化恐龙', () => {
      engine.start();
      addEggs(engine, 100);
      addFossils(engine, 50);
      engine.handleKeyDown('e');
      expect(engine.getDinoEvolutionLevel('velociraptor')).toBe(1);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalMeatEarned = PRESTIGE_MIN_TOTAL_MEAT * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getMeat(engine)).toBe(0);
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

    it('有恐龙进化时渲染正常', () => {
      engine.start();
      addEggs(engine, 100);
      addFossils(engine, 50);
      engine.evolveDino('velociraptor');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addMeat(engine, 100);
      engine.purchaseBuilding(0); // fence
      const before = getMeat(engine);
      tick(engine, 1000);
      const after = getMeat(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addMeat(engine, 100);
      engine.purchaseBuilding(0);
      const before = getMeat(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getMeat(engine);
      expect(after).toBeGreaterThan(before);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addMeat(engine, 1e14);
      expect(getMeat(engine)).toBeGreaterThan(0);
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
});
