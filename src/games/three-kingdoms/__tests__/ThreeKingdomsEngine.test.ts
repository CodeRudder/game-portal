/**
 * 三国志 (Three Kingdoms) 放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/ThreeKingdomsEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRAIN_PER_CLICK,
  MANDATE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GRAIN,
  GENERALS,
  BUILDINGS,
  COLORS,
  SCENE_DRAW,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/three-kingdoms/constants';

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

function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): ThreeKingdomsEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addGrain(engine: ThreeKingdomsEngine, amount: number): void {
  (engine as any).addResource('grain', amount);
}

function addGold(engine: ThreeKingdomsEngine, amount: number): void {
  (engine as any).addResource('gold', amount);
}

function addTroop(engine: ThreeKingdomsEngine, amount: number): void {
  (engine as any).addResource('troop', amount);
}

/** 触发一次 update */
function tick(engine: ThreeKingdomsEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getGrain(engine: ThreeKingdomsEngine): number {
  return (engine as any).getResource('grain')?.amount ?? 0;
}

function getGold(engine: ThreeKingdomsEngine): number {
  return (engine as any).getResource('gold')?.amount ?? 0;
}

function getTroop(engine: ThreeKingdomsEngine): number {
  return (engine as any).getResource('troop')?.amount ?? 0;
}

// ========== 测试 ==========

describe('ThreeKingdomsEngine', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(ThreeKingdomsEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后粮草为 0', () => {
      expect(getGrain(engine)).toBe(0);
    });

    it('init 后金币为 0', () => {
      expect(getGold(engine)).toBe(0);
    });

    it('init 后兵力为 0', () => {
      expect(getTroop(engine)).toBe(0);
    });

    it('init 后总粮草获得为 0', () => {
      expect(engine.totalGrainEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 three-kingdoms', () => {
      expect(engine.gameId).toBe('three-kingdoms');
    });

    it('init 后粮草已解锁', () => {
      const res = (engine as any).getResource('grain');
      expect(res.unlocked).toBe(true);
    });

    it('init 后金币未解锁', () => {
      const res = (engine as any).getResource('gold');
      expect(res.unlocked).toBe(false);
    });

    it('init 后兵力未解锁', () => {
      const res = (engine as any).getResource('troop');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('RESOURCE_IDS 包含 GRAIN/GOLD/TROOP', () => {
      expect(RESOURCE_IDS.GRAIN).toBe('grain');
      expect(RESOURCE_IDS.GOLD).toBe('gold');
      expect(RESOURCE_IDS.TROOP).toBe('troop');
    });

    it('BUILDING_IDS 包含 8 个建筑', () => {
      const ids = Object.values(BUILDING_IDS);
      expect(ids.length).toBe(8);
    });

    it('GRAIN_PER_CLICK 为 1', () => {
      expect(GRAIN_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_GRAIN 为 50000', () => {
      expect(MIN_PRESTIGE_GRAIN).toBe(50000);
    });

    it('MANDATE_BONUS_MULTIPLIER 为 0.15', () => {
      expect(MANDATE_BONUS_MULTIPLIER).toBe(0.15);
    });

    it('BUILDINGS 数组有 8 个建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('GENERALS 数组有 6 个武将', () => {
      expect(GENERALS.length).toBe(6);
    });

    it('所有建筑 ID 在 BUILDING_IDS 中', () => {
      const allIds = Object.values(BUILDING_IDS) as string[];
      for (const b of BUILDINGS) {
        expect(allIds).toContain(b.id);
      }
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('武将 ID 唯一', () => {
      const ids = GENERALS.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ========== 武将初始化 ==========

  describe('武将初始化', () => {
    it('应有 6 位武将', () => {
      expect(GENERALS.length).toBe(6);
    });

    it('初始只有刘备解锁', () => {
      const generals = engine.generals;
      const liubei = generals.find((g) => g.id === 'liubei');
      expect(liubei?.unlocked).toBe(true);
    });

    it('其他武将初始未解锁', () => {
      const generals = engine.generals;
      const locked = generals.filter((g) => g.id !== 'liubei');
      locked.forEach((g) => {
        expect(g.unlocked).toBe(false);
      });
    });

    it('所有武将初始升级等级为 0', () => {
      const generals = engine.generals;
      generals.forEach((g) => {
        expect(g.upgradeLevel).toBe(0);
      });
    });

    it('每个武将有名称', () => {
      GENERALS.forEach((g) => {
        expect(g.name).toBeTruthy();
      });
    });

    it('每个武将有称号', () => {
      GENERALS.forEach((g) => {
        expect(g.title).toBeTruthy();
      });
    });

    it('每个武将有图标', () => {
      GENERALS.forEach((g) => {
        expect(g.icon).toBeTruthy();
      });
    });

    it('每个武将有正数加成值', () => {
      GENERALS.forEach((g) => {
        expect(g.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个武将有升级倍率', () => {
      GENERALS.forEach((g) => {
        expect(g.upgradeMultiplier).toBeGreaterThan(0);
      });
    });

    it('每个武将有阵营', () => {
      GENERALS.forEach((g) => {
        expect(['shu', 'wei', 'wu']).toContain(g.faction);
      });
    });

    it('刘备属于蜀国', () => {
      const liubei = GENERALS.find((g) => g.id === 'liubei');
      expect(liubei?.faction).toBe('shu');
    });

    it('曹操属于魏国', () => {
      const caocao = GENERALS.find((g) => g.id === 'caocao');
      expect(caocao?.faction).toBe('wei');
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

    it('reset 后粮草归零', () => {
      engine.start();
      addGrain(engine, 1000);
      engine.reset();
      expect(getGrain(engine)).toBe(0);
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
      addGrain(engine, 500);
      engine.reset();
      engine.start();
      expect(getGrain(engine)).toBe(0);
    });
  });

  // ========== 点击产生粮草 ==========

  describe('点击产生粮草', () => {
    it('点击一次产生粮草', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getGrain(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生粮草', () => {
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

    it('点击增加总粮草获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalGrainEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getGrain(engine)).toBe(0);
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
    it('增加粮草', () => {
      addGrain(engine, 100);
      expect(getGrain(engine)).toBe(100);
    });

    it('增加金币', () => {
      addGold(engine, 50);
      expect(getGold(engine)).toBe(50);
    });

    it('增加兵力', () => {
      addTroop(engine, 30);
      expect(getTroop(engine)).toBe(30);
    });

    it('消耗粮草成功', () => {
      addGrain(engine, 100);
      (engine as any).spendResource('grain', 50);
      expect(getGrain(engine)).toBe(50);
    });

    it('消耗粮草失败（不足）', () => {
      addGrain(engine, 10);
      const result = (engine as any).spendResource('grain', 50);
      expect(result).toBeFalsy();
      expect(getGrain(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addGrain(engine, 100);
      expect((engine as any).hasResource('grain', 50)).toBe(true);
      expect((engine as any).hasResource('grain', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addGrain(engine, 100);
      addGold(engine, 50);
      expect((engine as any).canAfford({ grain: 50, gold: 20 })).toBe(true);
      expect((engine as any).canAfford({ grain: 50, gold: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有农田解锁', () => {
      const farm = (engine as any).upgrades.get('farm');
      expect(farm.unlocked).toBe(true);
    });

    it('集市初始未解锁', () => {
      const market = (engine as any).upgrades.get('market');
      expect(market.unlocked).toBe(false);
    });

    it('兵营初始未解锁', () => {
      const barracks = (engine as any).upgrades.get('barracks');
      expect(barracks.unlocked).toBe(false);
    });

    it('购买农田成功', () => {
      engine.start();
      addGrain(engine, 100);
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
      addGrain(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.grain).toBeGreaterThan(cost1.grain);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addGrain(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addGrain(engine, 10000);
      // 集市需要农田等级 > 0
      const result = engine.purchaseBuilding(1); // market
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addGrain(engine, 100);
      const before = getGrain(engine);
      engine.purchaseBuilding(0);
      expect(getGrain(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addGrain(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑触发 upgradePurchased 事件', () => {
      engine.start();
      addGrain(engine, 100);
      const listener = vi.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledWith('farm', 1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('集市在农田有等级后解锁', () => {
      engine.start();
      addGrain(engine, 100);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      const market = (engine as any).upgrades.get('market');
      expect(market.unlocked).toBe(true);
    });

    it('兵营在农田有等级后解锁', () => {
      engine.start();
      addGrain(engine, 100);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      const barracks = (engine as any).upgrades.get('barracks');
      expect(barracks.unlocked).toBe(true);
    });

    it('粮仓需要集市和兵营', () => {
      engine.start();
      addGrain(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(1); // market
      engine.purchaseBuilding(2); // barracks
      tick(engine, 16);
      const granary = (engine as any).upgrades.get('granary');
      expect(granary.unlocked).toBe(true);
    });

    it('商栈需要集市', () => {
      engine.start();
      addGrain(engine, 50000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      // 购买多个集市来满足商栈费用
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(1); // market
      }
      tick(engine, 16);
      const tradingPost = (engine as any).upgrades.get('trading_post');
      expect(tradingPost.unlocked).toBe(true);
    });

    it('演武场需要兵营', () => {
      engine.start();
      addGrain(engine, 100000);
      addTroop(engine, 1000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(2); // barracks
      }
      tick(engine, 16);
      const trainingGround = (engine as any).upgrades.get('training_ground');
      expect(trainingGround.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('金币在集市等级>=1时解锁', () => {
      engine.start();
      addGrain(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(1); // market
      tick(engine, 16);
      const gold = (engine as any).getResource('gold');
      expect(gold.unlocked).toBe(true);
    });

    it('兵力在兵营等级>=1时解锁', () => {
      engine.start();
      addGrain(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // barracks
      tick(engine, 16);
      const troop = (engine as any).getResource('troop');
      expect(troop.unlocked).toBe(true);
    });
  });

  // ========== 武将系统 ==========

  describe('武将系统', () => {
    it('解锁关羽需要 800 粮草', () => {
      engine.start();
      addGrain(engine, 800);
      const result = engine.unlockGeneral('guanyu');
      expect(result).toBe(true);
    });

    it('解锁关羽失败（粮草不足）', () => {
      engine.start();
      addGrain(engine, 100);
      const result = engine.unlockGeneral('guanyu');
      expect(result).toBe(false);
    });

    it('重复解锁同一武将失败', () => {
      engine.start();
      addGrain(engine, 2000);
      engine.unlockGeneral('guanyu');
      const result = engine.unlockGeneral('guanyu');
      expect(result).toBe(false);
    });

    it('解锁不存在的武将失败', () => {
      engine.start();
      const result = engine.unlockGeneral('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁武将触发 generalUnlocked 事件', () => {
      engine.start();
      addGrain(engine, 800);
      const listener = vi.fn();
      engine.on('generalUnlocked', listener);
      engine.unlockGeneral('guanyu');
      expect(listener).toHaveBeenCalledWith('guanyu');
    });

    it('解锁武将增加统计计数', () => {
      engine.start();
      addGrain(engine, 800);
      engine.unlockGeneral('guanyu');
      expect(engine.statistics.totalGeneralsUnlocked).toBe(2); // 初始1 + 新解锁1
    });

    it('generals getter 返回副本', () => {
      const generals1 = engine.generals;
      const generals2 = engine.generals;
      expect(generals1).not.toBe(generals2);
    });

    it('解锁曹操需要 3000 粮草', () => {
      engine.start();
      addGrain(engine, 3000);
      const result = engine.unlockGeneral('caocao');
      expect(result).toBe(true);
    });

    it('解锁赵云需要 80000 粮草', () => {
      engine.start();
      addGrain(engine, 80000);
      const result = engine.unlockGeneral('zhaoyun');
      expect(result).toBe(true);
    });
  });

  // ========== 武将升级 ==========

  describe('武将升级', () => {
    it('升级刘备成功', () => {
      engine.start();
      addGold(engine, 100);
      addTroop(engine, 50);
      const result = engine.upgradeGeneral('liubei');
      expect(result).toBe(true);
      expect(engine.getGeneralUpgradeLevel('liubei')).toBe(1);
    });

    it('升级未解锁的武将失败', () => {
      engine.start();
      const result = engine.upgradeGeneral('guanyu');
      expect(result).toBe(false);
    });

    it('升级资源不足时失败', () => {
      engine.start();
      const result = engine.upgradeGeneral('liubei');
      expect(result).toBe(false);
    });

    it('升级后武将加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addGold(engine, 100);
      addTroop(engine, 50);
      engine.upgradeGeneral('liubei');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('升级触发 generalUpgraded 事件', () => {
      engine.start();
      addGold(engine, 100);
      addTroop(engine, 50);
      const listener = vi.fn();
      engine.on('generalUpgraded', listener);
      engine.upgradeGeneral('liubei');
      expect(listener).toHaveBeenCalledWith('liubei', 1);
    });

    it('升级增加统计计数', () => {
      engine.start();
      addGold(engine, 100);
      addTroop(engine, 50);
      engine.upgradeGeneral('liubei');
      expect(engine.statistics.totalUpgrades).toBe(1);
    });

    it('获取升级费用', () => {
      const cost1 = engine.getGeneralUpgradeCost(1);
      expect(cost1).toBeDefined();
      expect(Object.keys(cost1).length).toBeGreaterThan(0);
    });

    it('高级升级费用更高', () => {
      const cost1 = engine.getGeneralUpgradeCost(1);
      const cost3 = engine.getGeneralUpgradeCost(3);
      expect(cost3.gold).toBeGreaterThan(cost1.gold);
    });

    it('升级到最大等级后不能再升级', () => {
      engine.start();
      // 手动设置到最大等级
      const general = (engine as any)._generals.find((g: any) => g.id === 'liubei');
      general.upgradeLevel = 5;
      const result = engine.upgradeGeneral('liubei');
      expect(result).toBe(false);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（刘备加成）', () => {
      // 刘备初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始产出倍率为 1（无产出加成武将）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1); // 无声望，刘备只加点击
    });

    it('初始金币倍率为 1', () => {
      const mult = engine.getGoldMultiplier();
      expect(mult).toBe(1);
    });

    it('初始兵力倍率为 1', () => {
      const mult = engine.getTroopMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随天命增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * MANDATE_BONUS_MULTIPLIER, 2);
    });

    it('解锁曹操增加产出倍率', () => {
      engine.start();
      addGrain(engine, 3000);
      engine.unlockGeneral('caocao');
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁关羽增加兵力倍率', () => {
      engine.start();
      addGrain(engine, 800);
      engine.unlockGeneral('guanyu');
      const mult = engine.getTroopMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁赵云增加所有倍率', () => {
      engine.start();
      addGrain(engine, 80000);
      engine.unlockGeneral('zhaoyun');
      expect(engine.getClickMultiplier()).toBeGreaterThan(1.1);
      expect(engine.getGoldMultiplier()).toBeGreaterThan(1);
      expect(engine.getTroopMultiplier()).toBeGreaterThan(1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始天命为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('粮草不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（粮草不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('粮草达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      const mandates = engine.doPrestige();
      expect(mandates).toBeGreaterThan(0);
    });

    it('声望后天命增加', () => {
      engine.start();
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addGrain(engine, MIN_PRESTIGE_GRAIN * 4);
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      engine.doPrestige();
      expect(getGrain(engine)).toBe(0);
    });

    it('声望保留武将升级等级', () => {
      engine.start();
      addGold(engine, 100);
      addTroop(engine, 50);
      engine.upgradeGeneral('liubei');
      const upgBefore = engine.getGeneralUpgradeLevel('liubei');

      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      engine.doPrestige();
      const upgAfter = engine.getGeneralUpgradeLevel('liubei');
      expect(upgAfter).toBe(upgBefore);
    });

    it('声望保留武将解锁状态', () => {
      engine.start();
      addGrain(engine, 800);
      engine.unlockGeneral('guanyu');

      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      engine.doPrestige();
      const generals = engine.generals;
      const guanyu = generals.find((g) => g.id === 'guanyu');
      expect(guanyu?.unlocked).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望后天命提供加成', () => {
      engine.start();
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 100;
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
      expect(data.gameId).toBe('three-kingdoms');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addGrain(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含武将和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).generals).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addGrain(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getGrain(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复武将状态', () => {
      engine.start();
      addGrain(engine, 800);
      engine.unlockGeneral('guanyu');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const generals = engine2.generals;
      const guanyu = generals.find((g) => g.id === 'guanyu');
      expect(guanyu?.unlocked).toBe(true);
    });

    it('load 忽略不同 gameId', () => {
      engine.start();
      addGrain(engine, 500);
      const data = engine.save();
      data.gameId = 'different-game';

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      // Should not have loaded the grain
      expect(getGrain(engine2)).toBe(0);
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
      expect(state.generals).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addGrain(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getGrain(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复武将', () => {
      engine.start();
      addGrain(engine, 800);
      engine.unlockGeneral('guanyu');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const generals = engine2.generals;
      const guanyu = generals.find((g) => g.id === 'guanyu');
      expect(guanyu?.unlocked).toBe(true);
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
      expect(getGrain(engine)).toBeGreaterThan(0);
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
      addGrain(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('U 键升级武将', () => {
      engine.start();
      addGold(engine, 100);
      addTroop(engine, 50);
      engine.handleKeyDown('u');
      expect(engine.getGeneralUpgradeLevel('liubei')).toBe(1);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalGrainEarned = MIN_PRESTIGE_GRAIN * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getGrain(engine)).toBe(0);
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

    it('有武将升级时渲染正常', () => {
      engine.start();
      addGold(engine, 100);
      addTroop(engine, 50);
      engine.upgradeGeneral('liubei');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('解锁多个武将后渲染正常', () => {
      engine.start();
      addGrain(engine, 100000);
      engine.unlockGeneral('guanyu');
      engine.unlockGeneral('caocao');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑等级时渲染正常', () => {
      engine.start();
      addGrain(engine, 1000);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addGrain(engine, 100);
      engine.purchaseBuilding(0); // farm
      const before = getGrain(engine);
      tick(engine, 1000);
      const after = getGrain(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addGrain(engine, 100);
      engine.purchaseBuilding(0);
      const before = getGrain(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getGrain(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('集市产金币', () => {
      engine.start();
      addGrain(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(1); // market
      tick(engine, 16);
      // 金币应已解锁
      const gold = (engine as any).getResource('gold');
      expect(gold.unlocked).toBe(true);
      // 有产出
      tick(engine, 1000);
      expect(getGold(engine)).toBeGreaterThan(0);
    });

    it('兵营产兵力', () => {
      engine.start();
      addGrain(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // barracks
      tick(engine, 16);
      const troop = (engine as any).getResource('troop');
      expect(troop.unlocked).toBe(true);
      tick(engine, 1000);
      expect(getTroop(engine)).toBeGreaterThan(0);
    });
  });

  // ========== 建筑依赖链 ==========

  describe('建筑依赖链', () => {
    it('完整建筑解锁链路', () => {
      engine.start();
      // 给足够资源
      addGrain(engine, 10000000);
      addGold(engine, 10000);
      addTroop(engine, 10000);

      // 农田
      expect(engine.purchaseBuilding(0)).toBe(true); // farm
      tick(engine, 16);

      // 集市和兵营（依赖农田）
      expect(engine.purchaseBuilding(1)).toBe(true); // market
      expect(engine.purchaseBuilding(2)).toBe(true); // barracks
      tick(engine, 16);

      // 粮仓（依赖集市+兵营）
      expect(engine.purchaseBuilding(3)).toBe(true); // granary
      tick(engine, 16);

      // 商栈（依赖集市）
      expect(engine.purchaseBuilding(4)).toBe(true); // trading_post

      // 演武场（依赖兵营）
      expect(engine.purchaseBuilding(5)).toBe(true); // training_ground
      tick(engine, 16);

      // 书院（依赖粮仓）
      expect(engine.purchaseBuilding(6)).toBe(true); // academy
      tick(engine, 16);

      // 军机处（依赖演武场+书院）
      expect(engine.purchaseBuilding(7)).toBe(true); // war_council
    });

    it('建筑最大等级限制', () => {
      engine.start();
      addGrain(engine, 1e15);
      // 农田最大 50 级
      for (let i = 0; i < 55; i++) {
        engine.purchaseBuilding(0);
      }
      expect(engine.getBuildingLevel(0)).toBe(BUILDINGS[0].maxLevel);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addGrain(engine, 1e14);
      expect(getGrain(engine)).toBeGreaterThan(0);
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

    it('getBuildingCost 无效索引返回空', () => {
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingCost(99)).toEqual({});
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });

    it('getGeneralUpgradeLevel 不存在的武将返回 0', () => {
      expect(engine.getGeneralUpgradeLevel('nonexistent')).toBe(0);
    });
  });
});
