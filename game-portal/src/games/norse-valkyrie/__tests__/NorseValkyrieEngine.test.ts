/**
 * 北欧英灵 (Norse Valkyrie) 放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NorseValkyrieEngine } from '@/games/norse-valkyrie/NorseValkyrieEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  IRON_PER_CLICK,
  GLORY_BONUS_MULTIPLIER,
  MIN_PRESTIGE_IRON,
  EINHERJAR,
  RUNES,
  BUILDINGS,
  COLORS,
  WARRIOR_DRAW,
} from '@/games/norse-valkyrie/constants';

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

function createEngine(): NorseValkyrieEngine {
  const engine = new NorseValkyrieEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): NorseValkyrieEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addIron(engine: NorseValkyrieEngine, amount: number): void {
  (engine as any).addResource('iron', amount);
}

function addGlory(engine: NorseValkyrieEngine, amount: number): void {
  (engine as any).addResource('glory', amount);
}

function addRune(engine: NorseValkyrieEngine, amount: number): void {
  (engine as any).addResource('rune', amount);
}

/** 触发一次 update */
function tick(engine: NorseValkyrieEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getIron(engine: NorseValkyrieEngine): number {
  return (engine as any).getResource('iron')?.amount ?? 0;
}

function getGlory(engine: NorseValkyrieEngine): number {
  return (engine as any).getResource('glory')?.amount ?? 0;
}

function getRune(engine: NorseValkyrieEngine): number {
  return (engine as any).getResource('rune')?.amount ?? 0;
}

// ========== 测试 ==========

describe('NorseValkyrieEngine', () => {
  let engine: NorseValkyrieEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(NorseValkyrieEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后铁矿石为 0', () => {
      expect(getIron(engine)).toBe(0);
    });

    it('init 后荣耀为 0', () => {
      expect(getGlory(engine)).toBe(0);
    });

    it('init 后卢恩为 0', () => {
      expect(getRune(engine)).toBe(0);
    });

    it('init 后总铁矿石获得为 0', () => {
      expect(engine.totalIronEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 norse-valkyrie', () => {
      expect(engine.gameId).toBe('norse-valkyrie');
    });

    it('init 后铁矿石已解锁', () => {
      const res = (engine as any).getResource('iron');
      expect(res.unlocked).toBe(true);
    });

    it('init 后荣耀未解锁', () => {
      const res = (engine as any).getResource('glory');
      expect(res.unlocked).toBe(false);
    });

    it('init 后卢恩未解锁', () => {
      const res = (engine as any).getResource('rune');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 英灵战士初始化 ==========

  describe('英灵战士初始化', () => {
    it('应有 6 种英灵战士', () => {
      expect(EINHERJAR.length).toBe(6);
    });

    it('初始只有狂战士解锁', () => {
      const einherjar = engine.einherjar;
      const berserker = einherjar.find(e => e.id === 'berserker');
      expect(berserker?.unlocked).toBe(true);
    });

    it('其他战士初始未解锁', () => {
      const einherjar = engine.einherjar;
      const locked = einherjar.filter(e => e.id !== 'berserker');
      locked.forEach(e => {
        expect(e.unlocked).toBe(false);
      });
    });

    it('所有战士初始进化等级为 0', () => {
      const einherjar = engine.einherjar;
      einherjar.forEach(e => {
        expect(e.evolutionLevel).toBe(0);
      });
    });

    it('战士 ID 唯一', () => {
      const ids = EINHERJAR.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个战士有名称', () => {
      EINHERJAR.forEach(e => {
        expect(e.name).toBeTruthy();
      });
    });

    it('每个战士有图标', () => {
      EINHERJAR.forEach(e => {
        expect(e.icon).toBeTruthy();
      });
    });

    it('每个战士有正数加成值', () => {
      EINHERJAR.forEach(e => {
        expect(e.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个战士有进化倍率', () => {
      EINHERJAR.forEach(e => {
        expect(e.evolutionMultiplier).toBeGreaterThan(0);
      });
    });
  });

  // ========== 卢恩符文初始化 ==========

  describe('卢恩符文初始化', () => {
    it('应有 8 种卢恩符文', () => {
      expect(RUNES.length).toBe(8);
    });

    it('初始所有符文未镶嵌', () => {
      const runes = engine.runes;
      runes.forEach(r => {
        expect(r.inscribed).toBe(false);
      });
    });

    it('符文 ID 唯一', () => {
      const ids = RUNES.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个符文有名称', () => {
      RUNES.forEach(r => {
        expect(r.name).toBeTruthy();
      });
    });

    it('每个符文有正数加成值', () => {
      RUNES.forEach(r => {
        expect(r.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个符文有正数镶嵌费用', () => {
      RUNES.forEach(r => {
        expect(r.inscribeCost).toBeGreaterThan(0);
      });
    });
  });

  // ========== 建筑系统初始化 ==========

  describe('建筑系统初始化', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有矿坑解锁', () => {
      const miningPit = (engine as any).upgrades.get('mining_pit');
      expect(miningPit.unlocked).toBe(true);
    });

    it('长船初始未解锁', () => {
      const longship = (engine as any).upgrades.get('longship');
      expect(longship.unlocked).toBe(false);
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

    it('reset 后铁矿石归零', () => {
      engine.start();
      addIron(engine, 1000);
      engine.reset();
      expect(getIron(engine)).toBe(0);
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
      addIron(engine, 500);
      engine.reset();
      engine.start();
      expect(getIron(engine)).toBe(0);
    });
  });

  // ========== 点击产生铁矿石 ==========

  describe('点击产生铁矿石', () => {
    it('点击一次产生铁矿石', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getIron(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生铁矿石', () => {
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

    it('点击增加总铁矿石获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalIronEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getIron(engine)).toBe(0);
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
    it('增加铁矿石', () => {
      addIron(engine, 100);
      expect(getIron(engine)).toBe(100);
    });

    it('增加荣耀', () => {
      addGlory(engine, 50);
      expect(getGlory(engine)).toBe(50);
    });

    it('增加卢恩', () => {
      addRune(engine, 30);
      expect(getRune(engine)).toBe(30);
    });

    it('消耗铁矿石成功', () => {
      addIron(engine, 100);
      (engine as any).spendResource('iron', 50);
      expect(getIron(engine)).toBe(50);
    });

    it('消耗铁矿石失败（不足）', () => {
      addIron(engine, 10);
      const result = (engine as any).spendResource('iron', 50);
      expect(result).toBeFalsy();
      expect(getIron(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addIron(engine, 100);
      expect((engine as any).hasResource('iron', 50)).toBe(true);
      expect((engine as any).hasResource('iron', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addIron(engine, 100);
      addGlory(engine, 50);
      expect((engine as any).canAfford({ iron: 50, glory: 20 })).toBe(true);
      expect((engine as any).canAfford({ iron: 50, glory: 200 })).toBe(false);
    });
  });

  // ========== 建筑购买 ==========

  describe('建筑购买', () => {
    it('购买矿坑成功', () => {
      engine.start();
      addIron(engine, 100);
      const result = engine.purchaseBuilding(0); // mining_pit
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买矿坑失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addIron(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.iron).toBeGreaterThan(cost1.iron);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addIron(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addIron(engine, 10000);
      // 长船需要矿坑等级 > 0
      const result = engine.purchaseBuilding(1); // longship
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addIron(engine, 100);
      const before = getIron(engine);
      engine.purchaseBuilding(0);
      expect(getIron(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addIron(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑触发 upgradePurchased 事件', () => {
      engine.start();
      addIron(engine, 100);
      const listener = vi.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledWith('mining_pit', 1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('长船在矿坑有等级后解锁', () => {
      engine.start();
      addIron(engine, 100);
      engine.purchaseBuilding(0); // mining_pit
      tick(engine, 16);
      const longship = (engine as any).upgrades.get('longship');
      expect(longship.unlocked).toBe(true);
    });

    it('锻造炉在矿坑有等级后解锁', () => {
      engine.start();
      addIron(engine, 10000);
      engine.purchaseBuilding(0); // mining_pit
      tick(engine, 16);
      const forge = (engine as any).upgrades.get('forge');
      expect(forge.unlocked).toBe(true);
    });

    it('英灵殿需要长船和锻造炉', () => {
      engine.start();
      addIron(engine, 100000);
      engine.purchaseBuilding(0); // mining_pit
      tick(engine, 16);
      engine.purchaseBuilding(1); // longship
      engine.purchaseBuilding(2); // forge
      tick(engine, 16);
      const valhalla = (engine as any).upgrades.get('valhalla');
      expect(valhalla.unlocked).toBe(true);
    });

    it('符文祭坛需要长船', () => {
      engine.start();
      addIron(engine, 100000);
      engine.purchaseBuilding(0); // mining_pit
      tick(engine, 16);
      engine.purchaseBuilding(1); // longship
      tick(engine, 16);
      const runeShrine = (engine as any).upgrades.get('rune_shrine');
      expect(runeShrine.unlocked).toBe(true);
    });

    it('战士营房需要英灵殿和符文祭坛', () => {
      engine.start();
      addIron(engine, 500000);
      addGlory(engine, 500);
      // Build prerequisite chain
      engine.purchaseBuilding(0); // mining_pit
      tick(engine, 16);
      engine.purchaseBuilding(1); // longship
      engine.purchaseBuilding(2); // forge
      tick(engine, 16);
      engine.purchaseBuilding(3); // valhalla
      engine.purchaseBuilding(4); // rune_shrine
      tick(engine, 16);
      const barracks = (engine as any).upgrades.get('barracks');
      expect(barracks.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('荣耀在矿坑等级>=5时解锁', () => {
      engine.start();
      addIron(engine, 100000);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      const glory = (engine as any).getResource('glory');
      expect(glory.unlocked).toBe(true);
    });

    it('卢恩在长船等级>=3时解锁', () => {
      engine.start();
      addIron(engine, 1000000);
      // 先解锁矿坑
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      // 解锁并购买长船
      for (let i = 0; i < 3; i++) {
        engine.purchaseBuilding(1);
      }
      tick(engine, 16);
      const rune = (engine as any).getResource('rune');
      expect(rune.unlocked).toBe(true);
    });
  });

  // ========== 英灵战士系统 ==========

  describe('英灵战士系统', () => {
    it('解锁盾女需要 800 铁矿石', () => {
      engine.start();
      addIron(engine, 800);
      const result = engine.unlockEinherjar('shieldmaiden');
      expect(result).toBe(true);
    });

    it('解锁盾女失败（铁矿石不足）', () => {
      engine.start();
      addIron(engine, 100);
      const result = engine.unlockEinherjar('shieldmaiden');
      expect(result).toBe(false);
    });

    it('重复解锁同一战士失败', () => {
      engine.start();
      addIron(engine, 2000);
      engine.unlockEinherjar('shieldmaiden');
      const result = engine.unlockEinherjar('shieldmaiden');
      expect(result).toBe(false);
    });

    it('解锁不存在的战士失败', () => {
      engine.start();
      const result = engine.unlockEinherjar('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁战士触发 einherjarUnlocked 事件', () => {
      engine.start();
      addIron(engine, 800);
      const listener = vi.fn();
      engine.on('einherjarUnlocked', listener);
      engine.unlockEinherjar('shieldmaiden');
      expect(listener).toHaveBeenCalledWith('shieldmaiden');
    });

    it('解锁战士增加统计计数', () => {
      engine.start();
      addIron(engine, 800);
      engine.unlockEinherjar('shieldmaiden');
      expect(engine.statistics.totalEinherjarUnlocked).toBe(2); // 初始1 + 新解锁1
    });

    it('einherjar getter 返回副本', () => {
      const e1 = engine.einherjar;
      const e2 = engine.einherjar;
      expect(e1).not.toBe(e2);
    });
  });

  // ========== 英灵战士进化 ==========

  describe('英灵战士进化', () => {
    it('进化狂战士成功', () => {
      engine.start();
      addGlory(engine, 100);
      addRune(engine, 50);
      const result = engine.evolveEinherjar('berserker');
      expect(result).toBe(true);
      expect(engine.getEinherjarEvolutionLevel('berserker')).toBe(1);
    });

    it('进化未解锁的战士失败', () => {
      engine.start();
      const result = engine.evolveEinherjar('shieldmaiden');
      expect(result).toBe(false);
    });

    it('进化资源不足时失败', () => {
      engine.start();
      const result = engine.evolveEinherjar('berserker');
      expect(result).toBe(false);
    });

    it('进化后战士加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addGlory(engine, 100);
      addRune(engine, 50);
      engine.evolveEinherjar('berserker');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('进化触发 einherjarEvolved 事件', () => {
      engine.start();
      addGlory(engine, 100);
      addRune(engine, 50);
      const listener = vi.fn();
      engine.on('einherjarEvolved', listener);
      engine.evolveEinherjar('berserker');
      expect(listener).toHaveBeenCalledWith('berserker', 1);
    });

    it('进化增加统计计数', () => {
      engine.start();
      addGlory(engine, 100);
      addRune(engine, 50);
      engine.evolveEinherjar('berserker');
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
      expect(cost3.glory).toBeGreaterThan(cost1.glory);
    });
  });

  // ========== 卢恩符文系统 ==========

  describe('卢恩符文系统', () => {
    it('镶嵌费胡符文成功', () => {
      engine.start();
      addRune(engine, 50);
      const result = engine.inscribeRune('fehu');
      expect(result).toBe(true);
    });

    it('镶嵌符文失败（卢恩不足）', () => {
      engine.start();
      addRune(engine, 1);
      const result = engine.inscribeRune('fehu');
      expect(result).toBe(false);
    });

    it('重复镶嵌同一符文失败', () => {
      engine.start();
      addRune(engine, 100);
      engine.inscribeRune('fehu');
      const result = engine.inscribeRune('fehu');
      expect(result).toBe(false);
    });

    it('镶嵌不存在的符文失败', () => {
      engine.start();
      const result = engine.inscribeRune('nonexistent');
      expect(result).toBe(false);
    });

    it('镶嵌符文触发 runeInscribed 事件', () => {
      engine.start();
      addRune(engine, 50);
      const listener = vi.fn();
      engine.on('runeInscribed', listener);
      engine.inscribeRune('fehu');
      expect(listener).toHaveBeenCalledWith('fehu');
    });

    it('镶嵌符文增加统计计数', () => {
      engine.start();
      addRune(engine, 50);
      engine.inscribeRune('fehu');
      expect(engine.statistics.totalRunesInscribed).toBe(1);
    });

    it('镶嵌符文后卢恩减少', () => {
      engine.start();
      addRune(engine, 50);
      const before = getRune(engine);
      engine.inscribeRune('fehu');
      expect(getRune(engine)).toBeLessThan(before);
    });

    it('镶嵌多个不同符文成功', () => {
      engine.start();
      addRune(engine, 1000);
      expect(engine.inscribeRune('fehu')).toBe(true);
      expect(engine.inscribeRune('uruz')).toBe(true);
      expect(engine.inscribeRune('thurisaz')).toBe(true);
    });

    it('runes getter 返回副本', () => {
      const r1 = engine.runes;
      const r2 = engine.runes;
      expect(r1).not.toBe(r2);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（狂战士加成）', () => {
      // 狂战士初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始产出倍率为 1（无产出加成战士）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1); // 无声望，狂战士只加点击
    });

    it('初始荣耀倍率为 1', () => {
      const mult = engine.getGloryMultiplier();
      expect(mult).toBe(1);
    });

    it('初始卢恩倍率为 1', () => {
      const mult = engine.getRuneMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随荣耀增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * GLORY_BONUS_MULTIPLIER, 2);
    });

    it('解锁盾女增加产出倍率', () => {
      engine.start();
      addIron(engine, 800);
      engine.unlockEinherjar('shieldmaiden');
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('镶嵌符文增加点击倍率', () => {
      engine.start();
      addRune(engine, 50);
      engine.inscribeRune('fehu');
      const mult = engine.getRuneClickMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('初始符文点击倍率为 1', () => {
      const mult = engine.getRuneClickMultiplier();
      expect(mult).toBe(1);
    });

    it('初始铁矿石倍率为 1', () => {
      const mult = engine.getIronMultiplier();
      expect(mult).toBe(1);
    });

    it('镶嵌产出类符文增加铁矿石倍率', () => {
      engine.start();
      addRune(engine, 200);
      engine.inscribeRune('uruz'); // production +20%
      const mult = engine.getIronMultiplier();
      expect(mult).toBeGreaterThan(1);
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

    it('铁矿石不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（铁矿石不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('铁矿石达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      const glory = engine.doPrestige();
      expect(glory).toBeGreaterThan(0);
    });

    it('声望后声望货币增加', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addIron(engine, MIN_PRESTIGE_IRON * 4);
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      engine.doPrestige();
      expect(getIron(engine)).toBe(0);
    });

    it('声望保留英灵战士进化等级', () => {
      engine.start();
      addGlory(engine, 100);
      addRune(engine, 50);
      engine.evolveEinherjar('berserker');
      const evoBefore = engine.getEinherjarEvolutionLevel('berserker');

      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      engine.doPrestige();
      const evoAfter = engine.getEinherjarEvolutionLevel('berserker');
      expect(evoAfter).toBe(evoBefore);
    });

    it('声望保留符文镶嵌状态', () => {
      engine.start();
      addRune(engine, 50);
      engine.inscribeRune('fehu');

      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      engine.doPrestige();
      const runes = engine.runes;
      const fehu = runes.find(r => r.id === 'fehu');
      expect(fehu?.inscribed).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望增加声望统计计数', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      engine.doPrestige();
      expect(engine.statistics.totalPrestigeCount).toBe(1);
    });

    it('铁矿石未达最低要求时声望返回 0', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON - 1;
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
      expect(data.gameId).toBe('norse-valkyrie');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addIron(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含英灵战士和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).einherjar).toBeDefined();
      expect((data.settings as any).runes).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addIron(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getIron(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复英灵战士状态', () => {
      engine.start();
      addIron(engine, 800);
      engine.unlockEinherjar('shieldmaiden');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const einherjar = engine2.einherjar;
      const shieldmaiden = einherjar.find(e => e.id === 'shieldmaiden');
      expect(shieldmaiden?.unlocked).toBe(true);
    });

    it('load 恢复符文状态', () => {
      engine.start();
      addRune(engine, 50);
      engine.inscribeRune('fehu');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const runes = engine2.runes;
      const fehu = runes.find(r => r.id === 'fehu');
      expect(fehu?.inscribed).toBe(true);
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
      expect(state.einherjar).toBeDefined();
      expect(state.runes).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addIron(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getIron(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复英灵战士', () => {
      engine.start();
      addIron(engine, 800);
      engine.unlockEinherjar('shieldmaiden');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const einherjar = engine2.einherjar;
      const shieldmaiden = einherjar.find(e => e.id === 'shieldmaiden');
      expect(shieldmaiden?.unlocked).toBe(true);
    });

    it('loadState 恢复符文', () => {
      engine.start();
      addRune(engine, 50);
      engine.inscribeRune('fehu');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const runes = engine2.runes;
      const fehu = runes.find(r => r.id === 'fehu');
      expect(fehu?.inscribed).toBe(true);
    });

    it('loadState 恢复选中索引', () => {
      engine.start();
      (engine as any)._selectedIndex = 3;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.selectedIndex).toBe(3);
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
      expect(getIron(engine)).toBeGreaterThan(0);
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
      addIron(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('E 键进化英灵战士', () => {
      engine.start();
      addGlory(engine, 100);
      addRune(engine, 50);
      engine.handleKeyDown('e');
      expect(engine.getEinherjarEvolutionLevel('berserker')).toBe(1);
    });

    it('R 键镶嵌符文', () => {
      engine.start();
      addRune(engine, 50);
      engine.handleKeyDown('r');
      const runes = engine.runes;
      const fehu = runes.find(r => r.id === 'fehu');
      expect(fehu?.inscribed).toBe(true);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getIron(engine)).toBe(0);
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

    it('有英灵战士进化时渲染正常', () => {
      engine.start();
      addGlory(engine, 100);
      addRune(engine, 50);
      engine.evolveEinherjar('berserker');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有符文镶嵌时渲染正常', () => {
      engine.start();
      addRune(engine, 50);
      engine.inscribeRune('fehu');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有建筑解锁时渲染正常', () => {
      engine.start();
      addIron(engine, 10000000);
      addGlory(engine, 5000);
      addRune(engine, 500);
      // Purchase all buildings
      for (let i = 0; i < BUILDINGS.length; i++) {
        const upgrade = (engine as any).upgrades.get(BUILDINGS[i].id);
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
      addIron(engine, 100);
      engine.purchaseBuilding(0); // mining_pit
      const before = getIron(engine);
      tick(engine, 1000);
      const after = getIron(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addIron(engine, 100);
      engine.purchaseBuilding(0);
      const before = getIron(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getIron(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('有荣耀建筑后产出荣耀', () => {
      engine.start();
      addIron(engine, 100000);
      engine.purchaseBuilding(0); // mining_pit
      tick(engine, 16);
      engine.purchaseBuilding(1); // longship
      tick(engine, 16);
      // Unlock glory
      const glory = (engine as any).getResource('glory');
      if (glory.unlocked) {
        const before = getGlory(engine);
        tick(engine, 2000);
        const after = getGlory(engine);
        expect(after).toBeGreaterThanOrEqual(before);
      }
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addIron(engine, 1e14);
      expect(getIron(engine)).toBeGreaterThan(0);
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

    it('资源不超过最大值', () => {
      addIron(engine, 1e16);
      const iron = (engine as any).getResource('iron');
      expect(iron.amount).toBeLessThanOrEqual(iron.maxAmount);
    });
  });

  // ========== 综合集成 ==========

  describe('综合集成', () => {
    it('完整游戏流程', () => {
      engine.start();

      // 点击获取铁矿石
      for (let i = 0; i < 20; i++) {
        engine.click();
      }
      expect(getIron(engine)).toBeGreaterThan(0);

      // 购买矿坑
      addIron(engine, 100);
      expect(engine.purchaseBuilding(0)).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);

      // 解锁盾女
      addIron(engine, 800);
      expect(engine.unlockEinherjar('shieldmaiden')).toBe(true);

      // 进化狂战士
      addGlory(engine, 100);
      addRune(engine, 50);
      expect(engine.evolveEinherjar('berserker')).toBe(true);

      // 镶嵌符文
      addRune(engine, 50);
      expect(engine.inscribeRune('fehu')).toBe(true);

      // 验证状态
      const state = engine.getState();
      expect(state.einherjar).toBeDefined();
      expect(state.runes).toBeDefined();
      expect(state.statistics.totalClicks).toBeGreaterThan(0);
    });

    it('声望后继续游戏流程', () => {
      engine.start();

      // 进化战士
      addGlory(engine, 100);
      addRune(engine, 50);
      engine.evolveEinherjar('berserker');

      // 镶嵌符文
      addRune(engine, 50);
      engine.inscribeRune('fehu');

      // 声望
      (engine as any)._stats.totalIronEarned = MIN_PRESTIGE_IRON * 4;
      const gloryGained = engine.doPrestige();
      expect(gloryGained).toBeGreaterThan(0);

      // 声望后继续点击
      engine.click();
      expect(getIron(engine)).toBeGreaterThan(0);

      // 验证进化保留
      expect(engine.getEinherjarEvolutionLevel('berserker')).toBe(1);

      // 验证符文保留
      const runes = engine.runes;
      const fehu = runes.find(r => r.id === 'fehu');
      expect(fehu?.inscribed).toBe(true);
    });

    it('存档-加载-继续游戏', () => {
      engine.start();

      // 游戏进度
      addIron(engine, 1000);
      addGlory(engine, 100);
      addRune(engine, 50);
      engine.unlockEinherjar('shieldmaiden');
      addRune(engine, 50);
      engine.inscribeRune('fehu');

      // 存档
      const data = engine.save();

      // 新引擎加载
      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);

      // 验证恢复（1000 - 800 for shieldmaiden = 200）
      expect(getIron(engine2)).toBeCloseTo(200, 0);
      const einherjar = engine2.einherjar;
      const shieldmaiden = einherjar.find(e => e.id === 'shieldmaiden');
      expect(shieldmaiden?.unlocked).toBe(true);
      const runes = engine2.runes;
      const fehu = runes.find(r => r.id === 'fehu');
      expect(fehu?.inscribed).toBe(true);
    });
  });
});
