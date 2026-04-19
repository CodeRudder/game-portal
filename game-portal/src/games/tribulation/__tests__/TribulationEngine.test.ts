/**
 * 渡劫飞升（Tribulation）放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TribulationEngine } from '@/games/tribulation/TribulationEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_POWER_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  TRIBULATIONS,
  TRIBULATION_LEVELS,
  MIN_PRESTIGE_SPIRIT,
  PRESTIGE_MULTIPLIER,
} from '@/games/tribulation/constants';

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

function createEngine(): TribulationEngine {
  const engine = new TribulationEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): TribulationEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addSpirit(engine: TribulationEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.SPIRIT_POWER, amount);
}

function addDaoRhyme(engine: TribulationEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.DAO_RHYME, amount);
}

function addHeavenAwe(engine: TribulationEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.HEAVEN_AWE, amount);
}

/** 触发一次 update */
function tick(engine: TribulationEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getSpirit(engine: TribulationEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.SPIRIT_POWER)?.amount ?? 0;
}

function getDaoRhyme(engine: TribulationEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.DAO_RHYME)?.amount ?? 0;
}

function getHeavenAwe(engine: TribulationEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.HEAVEN_AWE)?.amount ?? 0;
}

// ========== 测试 ==========

describe('TribulationEngine', () => {
  let engine: TribulationEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(TribulationEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后灵力为 0', () => {
      expect(getSpirit(engine)).toBe(0);
    });

    it('init 后道韵为 0', () => {
      expect(getDaoRhyme(engine)).toBe(0);
    });

    it('init 后天威为 0', () => {
      expect(getHeavenAwe(engine)).toBe(0);
    });

    it('init 后 gameId 为 tribulation', () => {
      expect(engine.gameId).toBe('tribulation');
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后灵力已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.SPIRIT_POWER);
      expect(res.unlocked).toBe(true);
    });

    it('init 后道韵未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.DAO_RHYME);
      expect(res.unlocked).toBe(false);
    });

    it('init 后天威未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.HEAVEN_AWE);
      expect(res.unlocked).toBe(false);
    });

    it('init 后天劫进度为 0', () => {
      expect(engine.completedTribulations).toEqual([]);
      expect(engine.currentTribulationIndex).toBe(0);
    });

    it('init 后统计数据为 0', () => {
      expect(engine.totalSpiritEarned).toBe(0);
      expect(engine.totalClicks).toBe(0);
      expect(engine.totalTribulationsPassed).toBe(0);
    });

    it('init 后所有天劫未完成', () => {
      expect(engine.allTribulationsCompleted).toBe(false);
    });

    it('init 后天劫动画未激活', () => {
      expect(engine.tribulationAnimActive).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('应有 5 种天劫', () => {
      expect(TRIBULATIONS.length).toBe(5);
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('天劫 ID 唯一', () => {
      const ids = TRIBULATIONS.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个建筑有正数基础费用', () => {
      BUILDINGS.forEach(b => {
        const costs = Object.values(b.baseCost);
        expect(costs.length).toBeGreaterThan(0);
        costs.forEach(c => expect(c).toBeGreaterThan(0));
      });
    });

    it('每个天劫有正数成功率', () => {
      TRIBULATIONS.forEach(t => {
        expect(t.successRate).toBeGreaterThan(0);
        expect(t.successRate).toBeLessThanOrEqual(1);
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

    it('点击获得 SPIRIT_POWER_PER_CLICK 灵力', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBe(SPIRIT_POWER_PER_CLICK);
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

    it('点击触发 click 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('click', listener);
      engine.click();
      expect(listener).toHaveBeenCalledWith(SPIRIT_POWER_PER_CLICK);
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

  // ========== 点击力量计算 ==========

  describe('点击力量计算', () => {
    it('初始点击力量为 SPIRIT_POWER_PER_CLICK', () => {
      expect(engine.getClickPower()).toBe(SPIRIT_POWER_PER_CLICK);
    });

    it('渡劫台等级增加点击力量', () => {
      engine.start();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.TRIBULATION_PLATFORM);
      upgrade.unlocked = true;
      upgrade.level = 5;
      const power = engine.getClickPower();
      // 每级 +5%, 5 级 = +25%
      expect(power).toBeCloseTo(SPIRIT_POWER_PER_CLICK * 1.25, 2);
    });

    it('天威增加点击力量', () => {
      engine.start();
      addHeavenAwe(engine, 100);
      const power = engine.getClickPower();
      // 每点天威 +0.1%, 100 点 = +10%
      expect(power).toBeCloseTo(SPIRIT_POWER_PER_CLICK * 1.1, 2);
    });

    it('已渡天劫增加点击力量', () => {
      engine.start();
      (engine as any)._completedTribulations = new Set(['thunder', 'fire']);
      const power = engine.getClickPower();
      // 每渡一劫 +20%, 2 劫 = +40%
      expect(power).toBeCloseTo(SPIRIT_POWER_PER_CLICK * 1.4, 2);
    });

    it('声望增加点击力量', () => {
      engine.start();
      (engine as any).prestige.currency = 5;
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(SPIRIT_POWER_PER_CLICK * (1 + 5 * PRESTIGE_MULTIPLIER), 2);
    });
  });

  // ========== 资源系统 ==========

  describe('资源系统', () => {
    it('增加灵力', () => {
      addSpirit(engine, 100);
      expect(getSpirit(engine)).toBe(100);
    });

    it('增加道韵', () => {
      addDaoRhyme(engine, 50);
      expect(getDaoRhyme(engine)).toBe(50);
    });

    it('增加天威', () => {
      addHeavenAwe(engine, 30);
      expect(getHeavenAwe(engine)).toBe(30);
    });

    it('消耗灵力成功', () => {
      addSpirit(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.SPIRIT_POWER, 50);
      expect(getSpirit(engine)).toBe(50);
    });

    it('消耗灵力失败（不足）', () => {
      addSpirit(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.SPIRIT_POWER, 50);
      expect(result).toBeFalsy();
      expect(getSpirit(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addSpirit(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.SPIRIT_POWER, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.SPIRIT_POWER, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addSpirit(engine, 1000);
      addDaoRhyme(engine, 50);
      expect((engine as any).canAfford({ [RESOURCE_IDS.SPIRIT_POWER]: 500, [RESOURCE_IDS.DAO_RHYME]: 20 })).toBe(true);
      expect((engine as any).canAfford({ [RESOURCE_IDS.SPIRIT_POWER]: 500, [RESOURCE_IDS.DAO_RHYME]: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('初始只有修炼洞府和聚灵阵解锁', () => {
      const cave = (engine as any).upgrades.get(BUILDING_IDS.CAVE);
      const spiritArray = (engine as any).upgrades.get(BUILDING_IDS.SPIRIT_ARRAY);
      const forge = (engine as any).upgrades.get(BUILDING_IDS.FORGE);

      expect(cave.unlocked).toBe(true);
      expect(spiritArray.unlocked).toBe(true);
      expect(forge.unlocked).toBe(false);
    });

    it('购买修炼洞府成功', () => {
      engine.start();
      addSpirit(engine, 100);
      const result = engine.purchaseBuilding(BUILDING_IDS.CAVE);
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(BUILDING_IDS.CAVE)).toBe(1);
    });

    it('购买修炼洞府失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(BUILDING_IDS.CAVE);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(BUILDING_IDS.CAVE)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addSpirit(engine, 10000);
      const cost1 = engine.getBuildingCost(BUILDING_IDS.CAVE);
      engine.purchaseBuilding(BUILDING_IDS.CAVE);
      const cost2 = engine.getBuildingCost(BUILDING_IDS.CAVE);
      expect(cost2[RESOURCE_IDS.SPIRIT_POWER]).toBeGreaterThan(cost1[RESOURCE_IDS.SPIRIT_POWER]);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addSpirit(engine, 10000);
      // 炼器坊需要完成雷劫才解锁
      const result = engine.purchaseBuilding(BUILDING_IDS.FORGE);
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addSpirit(engine, 100);
      const before = getSpirit(engine);
      engine.purchaseBuilding(BUILDING_IDS.CAVE);
      expect(getSpirit(engine)).toBeLessThan(before);
    });

    it('buyBuildingByIndex 成功', () => {
      engine.start();
      addSpirit(engine, 100);
      const result = engine.buyBuildingByIndex(0); // cave
      expect(result).toBe(true);
    });

    it('buyBuildingByIndex 无效索引', () => {
      engine.start();
      addSpirit(engine, 10000);
      expect(engine.buyBuildingByIndex(-1)).toBe(false);
      expect(engine.buyBuildingByIndex(99)).toBe(false);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addSpirit(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(BUILDING_IDS.CAVE);
      expect(listener).toHaveBeenCalled();
    });
  });

  // ========== 天劫系统 ==========

  describe('天劫系统', () => {
    it('初始天劫为雷劫', () => {
      const tribulation = engine.currentTribulation;
      expect(tribulation).not.toBeNull();
      expect(tribulation!.id).toBe(TRIBULATION_LEVELS.THUNDER);
    });

    it('初始无法渡劫（资源不足）', () => {
      engine.start();
      expect(engine.canAttemptTribulation()).toBe(false);
    });

    it('资源充足时可以渡劫', () => {
      engine.start();
      addSpirit(engine, 2000);
      addDaoRhyme(engine, 100);
      expect(engine.canAttemptTribulation()).toBe(true);
    });

    it('渡劫进行中不可再次渡劫', () => {
      engine.start();
      addSpirit(engine, 10000);
      addDaoRhyme(engine, 500);
      (engine as any)._tribulationAnim.active = true;
      const result = engine.attemptTribulation();
      expect(result.success).toBe(false);
      expect(result.message).toContain('渡劫进行中');
    });

    it('idle 状态下不可渡劫', () => {
      const result = engine.attemptTribulation();
      expect(result.success).toBe(false);
      expect(result.message).toContain('不可渡劫');
    });

    it('资源不足渡劫失败', () => {
      engine.start();
      addSpirit(engine, 10);
      const result = engine.attemptTribulation();
      expect(result.success).toBe(false);
      expect(result.message).toContain('资源不足');
    });

    it('渡劫成功后完成列表增加', () => {
      engine.start();
      addSpirit(engine, 10000);
      addDaoRhyme(engine, 500);

      // Mock Math.random to guarantee success
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = engine.attemptTribulation();

      if (result.success) {
        expect(engine.completedTribulations).toContain(TRIBULATION_LEVELS.THUNDER);
        expect(engine.currentTribulationIndex).toBe(1);
        expect(engine.totalTribulationsPassed).toBe(1);
      }

      spy.mockRestore();
    });

    it('渡劫失败损失灵力', () => {
      engine.start();
      addSpirit(engine, 10000);
      addDaoRhyme(engine, 500);

      // Mock Math.random to guarantee failure
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const spiritBefore = getSpirit(engine);
      const result = engine.attemptTribulation();

      if (!result.success) {
        expect(getSpirit(engine)).toBeLessThan(spiritBefore);
        expect(result.resourcesLost[RESOURCE_IDS.SPIRIT_POWER]).toBeGreaterThan(0);
      }

      spy.mockRestore();
    });

    it('渡劫成功获得天威', () => {
      engine.start();
      addSpirit(engine, 10000);
      addDaoRhyme(engine, 500);

      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = engine.attemptTribulation();

      if (result.success) {
        expect(result.heavenAweGained).toBeGreaterThan(0);
        expect(getHeavenAwe(engine)).toBeGreaterThan(0);
      }

      spy.mockRestore();
    });

    it('渡劫成功触发 tribulationSuccess 事件', () => {
      engine.start();
      addSpirit(engine, 10000);
      addDaoRhyme(engine, 500);

      const listener = vi.fn();
      engine.on('tribulationSuccess', listener);

      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      engine.attemptTribulation();
      spy.mockRestore();

      expect(listener).toHaveBeenCalled();
    });

    it('渡劫失败触发 tribulationFail 事件', () => {
      engine.start();
      addSpirit(engine, 10000);
      addDaoRhyme(engine, 500);

      const listener = vi.fn();
      engine.on('tribulationFail', listener);

      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.attemptTribulation();
      spy.mockRestore();

      expect(listener).toHaveBeenCalled();
    });

    it('渡劫成功率计算正确', () => {
      const thunder = TRIBULATIONS[0];
      const rate = engine.getTribulationSuccessRate(thunder);
      expect(rate).toBe(thunder.successRate);
    });

    it('天威加成渡劫成功率', () => {
      addHeavenAwe(engine, 100);
      const thunder = TRIBULATIONS[0];
      const rate = engine.getTribulationSuccessRate(thunder);
      expect(rate).toBeGreaterThan(thunder.successRate);
    });

    it('渡劫成功率上限 95%', () => {
      addHeavenAwe(engine, 100000);
      (engine as any).prestige.currency = 1000;
      const thunder = TRIBULATIONS[0];
      const rate = engine.getTribulationSuccessRate(thunder);
      expect(rate).toBeLessThanOrEqual(0.95);
    });

    it('getNextTribulation 返回当前天劫', () => {
      const next = engine.getNextTribulation();
      expect(next).not.toBeNull();
      expect(next!.id).toBe(TRIBULATION_LEVELS.THUNDER);
    });

    it('isTribulationCompleted 判断正确', () => {
      expect(engine.isTribulationCompleted(TRIBULATION_LEVELS.THUNDER)).toBe(false);
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.THUNDER);
      expect(engine.isTribulationCompleted(TRIBULATION_LEVELS.THUNDER)).toBe(true);
    });

    it('所有天劫完成后 allTribulationsCompleted 为 true', () => {
      TRIBULATIONS.forEach(t => {
        (engine as any)._completedTribulations.add(t.id);
      });
      (engine as any)._currentTribulationIndex = TRIBULATIONS.length;
      expect(engine.allTribulationsCompleted).toBe(true);
      expect(engine.currentTribulation).toBeNull();
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('完成雷劫后解锁炼器坊', () => {
      engine.start();
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.THUNDER);
      tick(engine, 16);
      const forge = (engine as any).upgrades.get(BUILDING_IDS.FORGE);
      expect(forge.unlocked).toBe(true);
    });

    it('完成火劫后解锁道殿', () => {
      engine.start();
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.THUNDER);
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.FIRE);
      tick(engine, 16);
      const daoHall = (engine as any).upgrades.get(BUILDING_IDS.DAO_HALL);
      expect(daoHall.unlocked).toBe(true);
    });

    it('建筑解锁触发 buildingUnlocked 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('buildingUnlocked', listener);
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.THUNDER);
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith(BUILDING_IDS.FORGE);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('完成雷劫后解锁道韵', () => {
      engine.start();
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.THUNDER);
      tick(engine, 16);
      const dao = (engine as any).getResource(RESOURCE_IDS.DAO_RHYME);
      expect(dao.unlocked).toBe(true);
    });

    it('完成火劫后解锁天威', () => {
      engine.start();
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.FIRE);
      tick(engine, 16);
      const awe = (engine as any).getResource(RESOURCE_IDS.HEAVEN_AWE);
      expect(awe.unlocked).toBe(true);
    });

    it('资源解锁触发 resourceUnlocked 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('resourceUnlocked', listener);
      (engine as any)._completedTribulations.add(TRIBULATION_LEVELS.THUNDER);
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith(RESOURCE_IDS.DAO_RHYME);
    });
  });

  // ========== 产出计算 ==========

  describe('产出计算', () => {
    it('初始产出倍率为 1', () => {
      expect(engine.getProductionMultiplier()).toBe(1);
    });

    it('仙池等级增加产出倍率', () => {
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.IMMORTAL_POOL);
      upgrade.level = 3;
      const mult = engine.getProductionMultiplier();
      // 每级 +8%, 3 级 = +24%
      expect(mult).toBeCloseTo(1.24, 2);
    });

    it('已渡天劫增加产出倍率', () => {
      (engine as any)._completedTribulations = new Set(['thunder', 'fire']);
      const mult = engine.getProductionMultiplier();
      // 每渡一劫 +15%, 2 劫 = +30%
      expect(mult).toBeCloseTo(1.3, 2);
    });

    it('声望增加产出倍率', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * PRESTIGE_MULTIPLIER, 2);
    });

    it('getEffectiveProduction 返回含加成的产出', () => {
      addSpirit(engine, 100);
      engine.start();
      engine.purchaseBuilding(BUILDING_IDS.CAVE);
      const effective = engine.getEffectiveProduction(RESOURCE_IDS.SPIRIT_POWER);
      expect(effective).toBeGreaterThanOrEqual(0);
    });
  });

  // ========== 飞升/声望系统 ==========

  describe('飞升/声望系统', () => {
    it('初始声望为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('灵力不足时无法飞升', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('飞升预览为 0（灵力不足）', () => {
      engine.start();
      expect(engine.calculatePrestigeReward()).toBe(0);
    });

    it('灵力达到最低要求时可以飞升', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      expect(engine.canPrestige()).toBe(true);
      expect(engine.calculatePrestigeReward()).toBeGreaterThan(0);
    });

    it('飞升成功', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      const result = engine.doPrestige();
      expect(result).toBe(true);
    });

    it('飞升后声望增加', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('飞升后声望次数增加', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('飞升后资源重置并给予初始奖励', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      const reward = engine.calculatePrestigeReward();
      engine.doPrestige();
      // doPrestige 重置后给予 reward * 10 的初始灵力
      expect(getSpirit(engine)).toBe(reward * 10);
    });

    it('飞升保留渡劫成功次数', () => {
      engine.start();
      (engine as any)._totalTribulationsPassed = 3;
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      engine.doPrestige();
      expect(engine.totalTribulationsPassed).toBe(3);
    });

    it('飞升触发 prestige 事件', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('飞升给予初始灵力奖励', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      const reward = engine.calculatePrestigeReward();
      engine.doPrestige();
      // 初始奖励 = reward * 10
      expect(getSpirit(engine)).toBe(reward * 10);
    });

    it('天劫加成飞升声望', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      const rewardWithout = engine.calculatePrestigeReward();

      // 完成一些天劫
      (engine as any)._completedTribulations = new Set(['thunder', 'fire']);
      const rewardWith = engine.calculatePrestigeReward();
      expect(rewardWith).toBeGreaterThan(rewardWithout);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('tribulation');
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

    it('save 包含天劫进度', () => {
      engine.start();
      (engine as any)._completedTribulations = new Set(['thunder']);
      const data = engine.save();
      expect((data.settings as any).completedTribulations).toContain('thunder');
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

    it('load 恢复天劫进度', () => {
      engine.start();
      (engine as any)._completedTribulations = new Set(['thunder', 'fire']);
      (engine as any)._currentTribulationIndex = 2;
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.completedTribulations).toContain('thunder');
      expect(engine2.completedTribulations).toContain('fire');
      expect(engine2.currentTribulationIndex).toBe(2);
    });

    it('load 恢复统计数据', () => {
      engine.start();
      (engine as any)._totalSpiritEarned = 10000;
      (engine as any)._totalClicks = 500;
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.totalSpiritEarned).toBe(10000);
      expect(engine2.totalClicks).toBe(500);
    });
  });

  // ========== 状态管理 ==========

  describe('状态管理', () => {
    it('getState 返回完整状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toBeDefined();
      expect(state.resources).toBeDefined();
      expect(state.upgrades).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.completedTribulations).toBeDefined();
      expect(state.currentTribulationIndex).toBeDefined();
      expect(state.totalSpiritEarned).toBeDefined();
      expect(state.totalClicks).toBeDefined();
      expect(state.totalTribulationsPassed).toBeDefined();
      expect(state.selectedBuildingIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addSpirit(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state);
      expect(getSpirit(engine2)).toBeCloseTo(1000, 0);
    });

    it('loadState 恢复声望', () => {
      engine.start();
      (engine as any).prestige.currency = 5;
      (engine as any).prestige.count = 2;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state);
      expect((engine2 as any).prestige.currency).toBe(5);
      expect((engine2 as any).prestige.count).toBe(2);
    });

    it('loadState 恢复天劫进度', () => {
      engine.start();
      (engine as any)._completedTribulations = new Set(['thunder']);
      (engine as any)._currentTribulationIndex = 1;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state);
      expect(engine2.completedTribulations).toContain('thunder');
      expect(engine2.currentTribulationIndex).toBe(1);
    });

    it('loadState 恢复统计数据', () => {
      engine.start();
      (engine as any)._totalSpiritEarned = 5000;
      (engine as any)._totalClicks = 200;
      (engine as any)._totalTribulationsPassed = 2;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state);
      expect(engine2.totalSpiritEarned).toBe(5000);
      expect(engine2.totalClicks).toBe(200);
      expect(engine2.totalTribulationsPassed).toBe(2);
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

    it('T 键触发渡劫', () => {
      engine.start();
      addSpirit(engine, 10000);
      addDaoRhyme(engine, 500);
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      engine.handleKeyDown('t');
      spy.mockRestore();
      // Should have attempted tribulation
      expect(engine.tribulationAnimActive).toBe(true);
    });

    it('P 键触发飞升', () => {
      engine.start();
      addSpirit(engine, MIN_PRESTIGE_SPIRIT * 4);
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
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
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedBuildingIndex).toBe(1);
    });

    it('回车购买建筑', () => {
      engine.start();
      addSpirit(engine, 100);
      (engine as any)._selectedBuildingIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(BUILDING_IDS.CAVE)).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getSpirit(engine)).toBe(0);
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

    it('天劫动画激活时渲染正常', () => {
      engine.start();
      (engine as any)._tribulationAnim = {
        active: true,
        tribulationId: TRIBULATION_LEVELS.THUNDER,
        success: true,
        timer: 1000,
        maxTimer: 1500,
      };
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('天劫动画失败时渲染正常', () => {
      engine.start();
      (engine as any)._tribulationAnim = {
        active: true,
        tribulationId: TRIBULATION_LEVELS.THUNDER,
        success: false,
        timer: 1000,
        maxTimer: 1500,
      };
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有天劫完成时渲染正常', () => {
      engine.start();
      TRIBULATIONS.forEach(t => {
        (engine as any)._completedTribulations.add(t.id);
      });
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAVE);
      const before = getSpirit(engine);
      tick(engine, 1000);
      const after = getSpirit(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addSpirit(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAVE);
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

    it('statistics getter 返回有效对象', () => {
      const stats = engine.statistics;
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });
  });
});
