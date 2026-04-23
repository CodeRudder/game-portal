import { vi } from 'vitest';
/**
 * 日本妖怪 (Yokai Night) 放置类游戏 — 完整测试套件
 */
import { YokaiNightEngine } from '@/games/yokai-night/YokaiNightEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_PER_CLICK,
  OMAMORI_BONUS_MULTIPLIER,
  MIN_PRESTIGE_SPIRIT,
  RESOURCE_IDS,
  BUILDING_IDS,
  YOKAI_BREEDS,
  BUILDINGS,
  COLORS,
  YOKAI_DRAW,
} from '@/games/yokai-night/constants';

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

function createEngine(): YokaiNightEngine {
  const engine = new YokaiNightEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): YokaiNightEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addSpirit(engine: YokaiNightEngine, amount: number): void {
  (engine as any).addResource('spirit', amount);
}

function addCoins(engine: YokaiNightEngine, amount: number): void {
  (engine as any).addResource('yokai_coin', amount);
}

function addOmamori(engine: YokaiNightEngine, amount: number): void {
  (engine as any).addResource('omamori', amount);
}

/** 触发一次 update */
function tick(engine: YokaiNightEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getSpirit(engine: YokaiNightEngine): number {
  return (engine as any).getResource('spirit')?.amount ?? 0;
}

function getCoins(engine: YokaiNightEngine): number {
  return (engine as any).getResource('yokai_coin')?.amount ?? 0;
}

function getOmamori(engine: YokaiNightEngine): number {
  return (engine as any).getResource('omamori')?.amount ?? 0;
}

// ========== 测试 ==========

describe('YokaiNightEngine', () => {
  let engine: YokaiNightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(YokaiNightEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后灵力为 0', () => {
      expect(getSpirit(engine)).toBe(0);
    });

    it('init 后妖怪币为 0', () => {
      expect(getCoins(engine)).toBe(0);
    });

    it('init 后御守为 0', () => {
      expect(getOmamori(engine)).toBe(0);
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

    it('init 后 gameId 为 yokai-night', () => {
      expect(engine.gameId).toBe('yokai-night');
    });

    it('init 后灵力已解锁', () => {
      const res = (engine as any).getResource('spirit');
      expect(res.unlocked).toBe(true);
    });

    it('init 后妖怪币未解锁', () => {
      const res = (engine as any).getResource('yokai_coin');
      expect(res.unlocked).toBe(false);
    });

    it('init 后御守未解锁', () => {
      const res = (engine as any).getResource('omamori');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('RESOURCE_IDS 包含 SPIRIT', () => {
      expect(RESOURCE_IDS.SPIRIT).toBe('spirit');
    });

    it('RESOURCE_IDS 包含 YOKAI_COIN', () => {
      expect(RESOURCE_IDS.YOKAI_COIN).toBe('yokai_coin');
    });

    it('RESOURCE_IDS 包含 OMAMORI', () => {
      expect(RESOURCE_IDS.OMAMORI).toBe('omamori');
    });

    it('BUILDING_IDS 包含 8 个建筑', () => {
      expect(Object.keys(BUILDING_IDS).length).toBe(8);
    });

    it('BUILDINGS 数组长度为 8', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('SPIRIT_PER_CLICK 为 1', () => {
      expect(SPIRIT_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_SPIRIT 为 50000', () => {
      expect(MIN_PRESTIGE_SPIRIT).toBe(50000);
    });

    it('COLORS 已定义', () => {
      expect(COLORS).toBeDefined();
      expect(COLORS.accent).toBeDefined();
      expect(COLORS.spiritColor).toBeDefined();
    });

    it('YOKAI_DRAW 已定义', () => {
      expect(YOKAI_DRAW).toBeDefined();
      expect(YOKAI_DRAW.centerX).toBe(240);
    });
  });

  // ========== 妖怪品种初始化 ==========

  describe('妖怪品种初始化', () => {
    it('应有 6 种妖怪品种', () => {
      expect(YOKAI_BREEDS.length).toBe(6);
    });

    it('初始只有狐火解锁', () => {
      const yokaiList = engine.yokai;
      const kitsune = yokaiList.find(y => y.id === 'kitsune');
      expect(kitsune?.unlocked).toBe(true);
    });

    it('其他品种初始未解锁', () => {
      const yokaiList = engine.yokai;
      const locked = yokaiList.filter(y => y.id !== 'kitsune');
      locked.forEach(y => {
        expect(y.unlocked).toBe(false);
      });
    });

    it('所有品种初始进化等级为 0', () => {
      const yokaiList = engine.yokai;
      yokaiList.forEach(y => {
        expect(y.evolutionLevel).toBe(0);
      });
    });

    it('品种 ID 唯一', () => {
      const ids = YOKAI_BREEDS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个品种有名称', () => {
      YOKAI_BREEDS.forEach(b => {
        expect(b.name).toBeTruthy();
      });
    });

    it('每个品种有图标', () => {
      YOKAI_BREEDS.forEach(b => {
        expect(b.icon).toBeTruthy();
      });
    });

    it('每个品种有正数加成值', () => {
      YOKAI_BREEDS.forEach(b => {
        expect(b.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个品种有进化倍率', () => {
      YOKAI_BREEDS.forEach(b => {
        expect(b.evolutionMultiplier).toBeGreaterThan(0);
      });
    });

    it('品种包含狐火(kitsune)', () => {
      const ids = YOKAI_BREEDS.map(b => b.id);
      expect(ids).toContain('kitsune');
    });

    it('品种包含天狗(tengu)', () => {
      const ids = YOKAI_BREEDS.map(b => b.id);
      expect(ids).toContain('tengu');
    });

    it('品种包含狸猫(tanuki)', () => {
      const ids = YOKAI_BREEDS.map(b => b.id);
      expect(ids).toContain('tanuki');
    });

    it('品种包含河童(kappa)', () => {
      const ids = YOKAI_BREEDS.map(b => b.id);
      expect(ids).toContain('kappa');
    });

    it('品种包含幽灵(yurei)', () => {
      const ids = YOKAI_BREEDS.map(b => b.id);
      expect(ids).toContain('yurei');
    });

    it('品种包含龙神(ryu)', () => {
      const ids = YOKAI_BREEDS.map(b => b.id);
      expect(ids).toContain('ryu');
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

    it('增加妖怪币', () => {
      addCoins(engine, 50);
      expect(getCoins(engine)).toBe(50);
    });

    it('增加御守', () => {
      addOmamori(engine, 30);
      expect(getOmamori(engine)).toBe(30);
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
      addCoins(engine, 50);
      expect((engine as any).canAfford({ spirit: 50, yokai_coin: 20 })).toBe(true);
      expect((engine as any).canAfford({ spirit: 50, yokai_coin: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有鸟居解锁', () => {
      const torii = (engine as any).upgrades.get('torii_gate');
      expect(torii.unlocked).toBe(true);
    });

    it('灵堂初始未解锁', () => {
      const shrine = (engine as any).upgrades.get('spirit_shrine');
      expect(shrine.unlocked).toBe(false);
    });

    it('购买鸟居成功', () => {
      engine.start();
      addSpirit(engine, 100);
      const result = engine.purchaseBuilding(0); // torii_gate
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买鸟居失败（资源不足）', () => {
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
      addSpirit(engine, 10000);
      // 灵堂需要鸟居等级 > 0
      const result = engine.purchaseBuilding(1); // spirit_shrine
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

    it('购买建筑触发 upgradePurchased 事件', () => {
      engine.start();
      addSpirit(engine, 100);
      const listener = vi.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledWith('torii_gate', 1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('灵堂在鸟居有等级后解锁', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(0); // torii_gate
      tick(engine, 16);
      const shrine = (engine as any).upgrades.get('spirit_shrine');
      expect(shrine.unlocked).toBe(true);
    });

    it('茶屋在鸟居有等级后解锁', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(0); // torii_gate
      tick(engine, 16);
      const teaHouse = (engine as any).upgrades.get('tea_house');
      expect(teaHouse.unlocked).toBe(true);
    });

    it('妖怪市集需要灵堂和茶屋', () => {
      engine.start();
      addSpirit(engine, 100000);
      engine.purchaseBuilding(0); // torii_gate
      tick(engine, 16);
      engine.purchaseBuilding(1); // spirit_shrine
      engine.purchaseBuilding(2); // tea_house
      tick(engine, 16);
      const market = (engine as any).upgrades.get('yokai_market');
      expect(market.unlocked).toBe(true);
    });

    it('温泉需要灵堂', () => {
      engine.start();
      addSpirit(engine, 100000);
      engine.purchaseBuilding(0); // torii_gate
      tick(engine, 16);
      engine.purchaseBuilding(1); // spirit_shrine
      tick(engine, 16);
      const springs = (engine as any).upgrades.get('hot_springs');
      expect(springs.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('妖怪币在鸟居等级>=5时解锁', () => {
      engine.start();
      addSpirit(engine, 100000);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      const coins = (engine as any).getResource('yokai_coin');
      expect(coins.unlocked).toBe(true);
    });

    it('御守在灵堂等级>=3时解锁', () => {
      engine.start();
      addSpirit(engine, 1000000);
      // 先解锁鸟居
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      // 解锁并购买灵堂
      for (let i = 0; i < 3; i++) {
        engine.purchaseBuilding(1);
      }
      tick(engine, 16);
      const omamori = (engine as any).getResource('omamori');
      expect(omamori.unlocked).toBe(true);
    });
  });

  // ========== 妖怪系统 ==========

  describe('妖怪系统', () => {
    it('解锁天狗需要 800 灵力', () => {
      engine.start();
      addSpirit(engine, 800);
      const result = engine.unlockYokai('tengu');
      expect(result).toBe(true);
    });

    it('解锁天狗失败（灵力不足）', () => {
      engine.start();
      addSpirit(engine, 100);
      const result = engine.unlockYokai('tengu');
      expect(result).toBe(false);
    });

    it('重复解锁同一妖怪失败', () => {
      engine.start();
      addSpirit(engine, 2000);
      engine.unlockYokai('tengu');
      const result = engine.unlockYokai('tengu');
      expect(result).toBe(false);
    });

    it('解锁不存在的妖怪失败', () => {
      engine.start();
      const result = engine.unlockYokai('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁妖怪触发 yokaiUnlocked 事件', () => {
      engine.start();
      addSpirit(engine, 800);
      const listener = vi.fn();
      engine.on('yokaiUnlocked', listener);
      engine.unlockYokai('tengu');
      expect(listener).toHaveBeenCalledWith('tengu');
    });

    it('解锁妖怪增加统计计数', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockYokai('tengu');
      expect(engine.statistics.totalYokaiUnlocked).toBe(2); // 初始1 + 新解锁1
    });

    it('yokai getter 返回副本', () => {
      const yokai1 = engine.yokai;
      const yokai2 = engine.yokai;
      expect(yokai1).not.toBe(yokai2);
    });

    it('解锁狸猫需要 3000 灵力', () => {
      engine.start();
      addSpirit(engine, 3000);
      const result = engine.unlockYokai('tanuki');
      expect(result).toBe(true);
    });

    it('解锁河童需要 8000 灵力', () => {
      engine.start();
      addSpirit(engine, 8000);
      const result = engine.unlockYokai('kappa');
      expect(result).toBe(true);
    });

    it('解锁幽灵需要 25000 灵力', () => {
      engine.start();
      addSpirit(engine, 25000);
      const result = engine.unlockYokai('yurei');
      expect(result).toBe(true);
    });

    it('解锁龙神需要 80000 灵力', () => {
      engine.start();
      addSpirit(engine, 80000);
      const result = engine.unlockYokai('ryu');
      expect(result).toBe(true);
    });
  });

  // ========== 妖怪进化 ==========

  describe('妖怪进化', () => {
    it('进化狐火成功', () => {
      engine.start();
      addCoins(engine, 100);
      addOmamori(engine, 50);
      const result = engine.evolveYokai('kitsune');
      expect(result).toBe(true);
      expect(engine.getYokaiEvolutionLevel('kitsune')).toBe(1);
    });

    it('进化未解锁的妖怪失败', () => {
      engine.start();
      const result = engine.evolveYokai('tengu');
      expect(result).toBe(false);
    });

    it('进化资源不足时失败', () => {
      engine.start();
      const result = engine.evolveYokai('kitsune');
      expect(result).toBe(false);
    });

    it('进化后妖怪加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addCoins(engine, 100);
      addOmamori(engine, 50);
      engine.evolveYokai('kitsune');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('进化触发 yokaiEvolved 事件', () => {
      engine.start();
      addCoins(engine, 100);
      addOmamori(engine, 50);
      const listener = vi.fn();
      engine.on('yokaiEvolved', listener);
      engine.evolveYokai('kitsune');
      expect(listener).toHaveBeenCalledWith('kitsune', 1);
    });

    it('进化增加统计计数', () => {
      engine.start();
      addCoins(engine, 100);
      addOmamori(engine, 50);
      engine.evolveYokai('kitsune');
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
      expect(cost3.yokai_coin).toBeGreaterThan(cost1.yokai_coin);
    });

    it('进化等级2需要灵力', () => {
      const cost2 = engine.getEvolutionCost(2);
      expect(cost2.spirit).toBeGreaterThan(0);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（狐火加成）', () => {
      // 狐火初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始产出倍率为 1（无产出加成妖怪）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1); // 无声望，狐火只加点击
    });

    it('初始妖怪币倍率为 1', () => {
      const mult = engine.getCoinMultiplier();
      expect(mult).toBe(1);
    });

    it('初始御守倍率为 1', () => {
      const mult = engine.getOmamoriMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随御守增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * OMAMORI_BONUS_MULTIPLIER, 2);
    });

    it('解锁天狗增加产出倍率', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockYokai('tengu');
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁狸猫增加妖怪币倍率', () => {
      engine.start();
      addSpirit(engine, 3000);
      engine.unlockYokai('tanuki');
      const mult = engine.getCoinMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁河童增加御守倍率', () => {
      engine.start();
      addSpirit(engine, 8000);
      engine.unlockYokai('kappa');
      const mult = engine.getOmamoriMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始御守为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('灵力不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（灵力不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('灵力达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      const omamori = engine.doPrestige();
      expect(omamori).toBeGreaterThan(0);
    });

    it('声望后御守增加', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      expect(getSpirit(engine)).toBe(0);
    });

    it('声望保留妖怪进化等级', () => {
      engine.start();
      addCoins(engine, 100);
      addOmamori(engine, 50);
      engine.evolveYokai('kitsune');
      const evoBefore = engine.getYokaiEvolutionLevel('kitsune');

      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      engine.doPrestige();
      const evoAfter = engine.getYokaiEvolutionLevel('kitsune');
      expect(evoAfter).toBe(evoBefore);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalSpiritEarned = MIN_PRESTIGE_SPIRIT * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望计算公式正确', () => {
      engine.start();
      const totalSpirit = MIN_PRESTIGE_SPIRIT * 9; // sqrt(9) = 3
      (engine as any)._stats.totalSpiritEarned = totalSpirit;
      const preview = engine.getPrestigePreview();
      expect(preview).toBe(3); // 1 * sqrt(9)
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('yokai-night');
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

    it('save 包含妖怪和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).yokai).toBeDefined();
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

    it('load 恢复妖怪状态', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockYokai('tengu');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const yokaiList = engine2.yokai;
      const tengu = yokaiList.find(y => y.id === 'tengu');
      expect(tengu?.unlocked).toBe(true);
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
      expect(state.yokai).toBeDefined();
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

    it('loadState 恢复妖怪', () => {
      engine.start();
      addSpirit(engine, 800);
      engine.unlockYokai('tengu');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const yokaiList = engine2.yokai;
      const tengu = yokaiList.find(y => y.id === 'tengu');
      expect(tengu?.unlocked).toBe(true);
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

    it('E 键进化妖怪', () => {
      engine.start();
      addCoins(engine, 100);
      addOmamori(engine, 50);
      engine.handleKeyDown('e');
      expect(engine.getYokaiEvolutionLevel('kitsune')).toBe(1);
    });

    it('P 键触发声望', () => {
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

    it('有声望时渲染正常', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有妖怪进化时渲染正常', () => {
      engine.start();
      addCoins(engine, 100);
      addOmamori(engine, 50);
      engine.evolveYokai('kitsune');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有灯笼粒子时渲染正常', () => {
      engine.start();
      tick(engine, 1000); // 触发粒子生成
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有飘字时渲染正常', () => {
      engine.start();
      engine.click(); // 产生飘字
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑后渲染正常', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有妖怪解锁后渲染正常', () => {
      engine.start();
      addSpirit(engine, 100000);
      engine.unlockYokai('tengu');
      engine.unlockYokai('tanuki');
      engine.unlockYokai('kappa');
      engine.unlockYokai('yurei');
      engine.unlockYokai('ryu');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(0); // torii_gate
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
      const stats1 = engine.statistics;
      const stats2 = engine.statistics;
      expect(stats1).not.toBe(stats2);
    });
  });
});
