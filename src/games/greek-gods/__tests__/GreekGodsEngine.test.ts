/**
 * Greek Gods（希腊众神）放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GreekGodsEngine } from '@/games/greek-gods/GreekGodsEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  BLESSING_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GOLD,
  GODS,
  BUILDINGS,
  COLORS,
  TEMPLE_DRAW,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/greek-gods/constants';

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

function createEngine(): GreekGodsEngine {
  const engine = new GreekGodsEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): GreekGodsEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addGold(engine: GreekGodsEngine, amount: number): void {
  (engine as any).addResource('gold', amount);
}

function addFaith(engine: GreekGodsEngine, amount: number): void {
  (engine as any).addResource('faith', amount);
}

function addGlory(engine: GreekGodsEngine, amount: number): void {
  (engine as any).addResource('glory', amount);
}

/** 触发一次 update */
function tick(engine: GreekGodsEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getGold(engine: GreekGodsEngine): number {
  return (engine as any).getResource('gold')?.amount ?? 0;
}

function getFaith(engine: GreekGodsEngine): number {
  return (engine as any).getResource('faith')?.amount ?? 0;
}

function getGlory(engine: GreekGodsEngine): number {
  return (engine as any).getResource('glory')?.amount ?? 0;
}

// ========== 测试 ==========

describe('GreekGodsEngine', () => {
  let engine: GreekGodsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(GreekGodsEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后金币为 0', () => {
      expect(getGold(engine)).toBe(0);
    });

    it('init 后信仰为 0', () => {
      expect(getFaith(engine)).toBe(0);
    });

    it('init 后荣耀为 0', () => {
      expect(getGlory(engine)).toBe(0);
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

    it('init 后 gameId 为 greek-gods', () => {
      expect(engine.gameId).toBe('greek-gods');
    });

    it('init 后金币已解锁', () => {
      const res = (engine as any).getResource('gold');
      expect(res.unlocked).toBe(true);
    });

    it('init 后信仰未解锁', () => {
      const res = (engine as any).getResource('faith');
      expect(res.unlocked).toBe(false);
    });

    it('init 后荣耀未解锁', () => {
      const res = (engine as any).getResource('glory');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('RESOURCE_IDS 包含 GOLD/FAITH/GLORY', () => {
      expect(RESOURCE_IDS.GOLD).toBe('gold');
      expect(RESOURCE_IDS.FAITH).toBe('faith');
      expect(RESOURCE_IDS.GLORY).toBe('glory');
    });

    it('BUILDING_IDS 包含 8 个建筑', () => {
      const ids = Object.values(BUILDING_IDS);
      expect(ids.length).toBe(8);
    });

    it('GOLD_PER_CLICK 为 1', () => {
      expect(GOLD_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_GOLD 为 50000', () => {
      expect(MIN_PRESTIGE_GOLD).toBe(50000);
    });

    it('BLESSING_BONUS_MULTIPLIER 为 0.15', () => {
      expect(BLESSING_BONUS_MULTIPLIER).toBe(0.15);
    });
  });

  // ========== 众神初始化 ==========

  describe('众神初始化', () => {
    it('应有 8 位神', () => {
      expect(GODS.length).toBe(8);
    });

    it('初始只有宙斯解锁', () => {
      const gods = engine.gods;
      const zeus = gods.find(g => g.id === 'zeus');
      expect(zeus?.unlocked).toBe(true);
    });

    it('其他神初始未解锁', () => {
      const gods = engine.gods;
      const locked = gods.filter(g => g.id !== 'zeus');
      locked.forEach(g => {
        expect(g.unlocked).toBe(false);
      });
    });

    it('所有神初始恩赐等级为 0', () => {
      const gods = engine.gods;
      gods.forEach(g => {
        expect(g.blessingLevel).toBe(0);
      });
    });

    it('神 ID 唯一', () => {
      const ids = GODS.map(g => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个神有名称', () => {
      GODS.forEach(g => {
        expect(g.name).toBeTruthy();
      });
    });

    it('每个神有图标', () => {
      GODS.forEach(g => {
        expect(g.icon).toBeTruthy();
      });
    });

    it('每个神有正数加成值', () => {
      GODS.forEach(g => {
        expect(g.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个神有恩赐倍率', () => {
      GODS.forEach(g => {
        expect(g.blessingMultiplier).toBeGreaterThan(0);
      });
    });

    it('每个神有颜色', () => {
      GODS.forEach(g => {
        expect(g.color).toBeTruthy();
      });
    });

    it('每个神有光环颜色', () => {
      GODS.forEach(g => {
        expect(g.auraColor).toBeTruthy();
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
    it('增加金币', () => {
      addGold(engine, 100);
      expect(getGold(engine)).toBe(100);
    });

    it('增加信仰', () => {
      addFaith(engine, 50);
      expect(getFaith(engine)).toBe(50);
    });

    it('增加荣耀', () => {
      addGlory(engine, 30);
      expect(getGlory(engine)).toBe(30);
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
      addFaith(engine, 50);
      expect((engine as any).canAfford({ gold: 50, faith: 20 })).toBe(true);
      expect((engine as any).canAfford({ gold: 50, faith: 200 })).toBe(false);
    });

    it('资源不超过上限', () => {
      addGold(engine, 1e20);
      const res = (engine as any).getResource('gold');
      expect(res.amount).toBeLessThanOrEqual(1e15);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有宙斯神殿解锁', () => {
      const temple = (engine as any).upgrades.get('temple_of_zeus');
      expect(temple.unlocked).toBe(true);
    });

    it('雅典娜圣坛初始未解锁', () => {
      const shrine = (engine as any).upgrades.get('shrine_of_athena');
      expect(shrine.unlocked).toBe(false);
    });

    it('购买宙斯神殿成功', () => {
      engine.start();
      addGold(engine, 100);
      const result = engine.purchaseBuilding(0); // temple_of_zeus
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买宙斯神殿失败（资源不足）', () => {
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
      // 雅典娜圣坛需要宙斯神殿等级 > 0
      const result = engine.purchaseBuilding(1); // shrine_of_athena
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
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑触发 upgradePurchased 事件', () => {
      engine.start();
      addGold(engine, 100);
      const listener = vi.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledWith('temple_of_zeus', 1);
    });

    it('建筑达到最大等级后不能再购买', () => {
      engine.start();
      addGold(engine, 1e15);
      const building = BUILDINGS[0];
      for (let i = 0; i < building.maxLevel; i++) {
        engine.purchaseBuilding(0);
      }
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('雅典娜圣坛在宙斯神殿有等级后解锁', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // temple_of_zeus
      tick(engine, 16);
      const shrine = (engine as any).upgrades.get('shrine_of_athena');
      expect(shrine.unlocked).toBe(true);
    });

    it('赫淮斯托斯锻造场在宙斯神殿有等级后解锁', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0); // temple_of_zeus
      tick(engine, 16);
      const forge = (engine as any).upgrades.get('forge_of_hephaestus');
      expect(forge.unlocked).toBe(true);
    });

    it('德墨忒尔花园需要雅典娜圣坛和锻造场', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // temple_of_zeus
      tick(engine, 16);
      engine.purchaseBuilding(1); // shrine_of_athena
      engine.purchaseBuilding(2); // forge_of_hephaestus
      tick(engine, 16);
      const garden = (engine as any).upgrades.get('garden_of_demeter');
      expect(garden.unlocked).toBe(true);
    });

    it('阿瑞斯兵营需要锻造场', () => {
      engine.start();
      addGold(engine, 1e8);
      // 解锁并购买宙斯神殿
      engine.purchaseBuilding(0);
      tick(engine, 16);
      // 解锁并购买锻造场
      engine.purchaseBuilding(2);
      tick(engine, 16);
      const barracks = (engine as any).upgrades.get('barracks_of_ares');
      expect(barracks.unlocked).toBe(true);
    });

    it('竞技场需要兵营和图书馆', () => {
      engine.start();
      addGold(engine, 1e10);
      addFaith(engine, 1e6);
      // 宙斯神殿
      engine.purchaseBuilding(0);
      tick(engine, 16);
      // 雅典娜圣坛
      engine.purchaseBuilding(1);
      tick(engine, 16);
      // 锻造场
      engine.purchaseBuilding(2);
      tick(engine, 16);
      // 图书馆
      engine.purchaseBuilding(4); // library_of_apollo
      tick(engine, 16);
      // 兵营
      engine.purchaseBuilding(5); // barracks_of_ares
      tick(engine, 16);
      const arena = (engine as any).upgrades.get('arena');
      expect(arena.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('信仰在雅典娜圣坛等级>=5时解锁', () => {
      engine.start();
      addGold(engine, 100000);
      // 先解锁宙斯神殿
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      // 解锁并购买雅典娜圣坛
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(1);
      }
      tick(engine, 16);
      const faith = (engine as any).getResource('faith');
      expect(faith.unlocked).toBe(true);
    });

    it('荣耀在阿瑞斯兵营等级>=1时解锁', () => {
      engine.start();
      addGold(engine, 1e9);
      addFaith(engine, 1e6);
      // 宙斯神殿
      for (let i = 0; i < 20; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      // 锻造场
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(2);
      }
      tick(engine, 16);
      // 兵营
      engine.purchaseBuilding(5); // barracks_of_ares
      tick(engine, 16);
      const glory = (engine as any).getResource('glory');
      expect(glory.unlocked).toBe(true);
    });
  });

  // ========== 众神系统 ==========

  describe('众神系统', () => {
    it('解锁雅典娜需要 1000 金币', () => {
      engine.start();
      addGold(engine, 1000);
      const result = engine.unlockGod('athena');
      expect(result).toBe(true);
    });

    it('解锁雅典娜失败（金币不足）', () => {
      engine.start();
      addGold(engine, 100);
      const result = engine.unlockGod('athena');
      expect(result).toBe(false);
    });

    it('重复解锁同一神失败', () => {
      engine.start();
      addGold(engine, 2000);
      engine.unlockGod('athena');
      const result = engine.unlockGod('athena');
      expect(result).toBe(false);
    });

    it('解锁不存在的神失败', () => {
      engine.start();
      const result = engine.unlockGod('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁神触发 godUnlocked 事件', () => {
      engine.start();
      addGold(engine, 1000);
      const listener = vi.fn();
      engine.on('godUnlocked', listener);
      engine.unlockGod('athena');
      expect(listener).toHaveBeenCalledWith('athena');
    });

    it('解锁神增加统计计数', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockGod('athena');
      expect(engine.statistics.totalGodsUnlocked).toBe(2); // 初始1 + 新解锁1
    });

    it('gods getter 返回副本', () => {
      const gods1 = engine.gods;
      const gods2 = engine.gods;
      expect(gods1).not.toBe(gods2);
    });

    it('解锁波塞冬需要 5000 金币', () => {
      engine.start();
      addGold(engine, 5000);
      const result = engine.unlockGod('poseidon');
      expect(result).toBe(true);
    });

    it('解锁阿佛洛狄忒需要 15000 金币', () => {
      engine.start();
      addGold(engine, 15000);
      const result = engine.unlockGod('aphrodite');
      expect(result).toBe(true);
    });

    it('解锁赫尔墨斯需要 50000 金币', () => {
      engine.start();
      addGold(engine, 50000);
      const result = engine.unlockGod('hermes');
      expect(result).toBe(true);
    });

    it('解锁阿瑞斯需要 150000 金币', () => {
      engine.start();
      addGold(engine, 150000);
      const result = engine.unlockGod('ares');
      expect(result).toBe(true);
    });

    it('解锁阿波罗需要 500000 金币', () => {
      engine.start();
      addGold(engine, 500000);
      const result = engine.unlockGod('apollo');
      expect(result).toBe(true);
    });

    it('解锁哈迪斯需要 2000000 金币', () => {
      engine.start();
      addGold(engine, 2000000);
      const result = engine.unlockGod('hades');
      expect(result).toBe(true);
    });
  });

  // ========== 众神恩赐 ==========

  describe('众神恩赐', () => {
    it('恩赐宙斯成功', () => {
      engine.start();
      addFaith(engine, 100);
      addGlory(engine, 50);
      const result = engine.blessGod('zeus');
      expect(result).toBe(true);
      expect(engine.getGodBlessingLevel('zeus')).toBe(1);
    });

    it('恩赐未解锁的神失败', () => {
      engine.start();
      const result = engine.blessGod('athena');
      expect(result).toBe(false);
    });

    it('恩赐资源不足时失败', () => {
      engine.start();
      const result = engine.blessGod('zeus');
      expect(result).toBe(false);
    });

    it('恩赐后神加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addFaith(engine, 100);
      addGlory(engine, 50);
      engine.blessGod('zeus');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('恩赐触发 godBlessed 事件', () => {
      engine.start();
      addFaith(engine, 100);
      addGlory(engine, 50);
      const listener = vi.fn();
      engine.on('godBlessed', listener);
      engine.blessGod('zeus');
      expect(listener).toHaveBeenCalledWith('zeus', 1);
    });

    it('恩赐增加统计计数', () => {
      engine.start();
      addFaith(engine, 100);
      addGlory(engine, 50);
      engine.blessGod('zeus');
      expect(engine.statistics.totalBlessings).toBe(1);
    });

    it('获取恩赐费用', () => {
      const cost1 = engine.getBlessingCost(1);
      expect(cost1).toBeDefined();
      expect(Object.keys(cost1).length).toBeGreaterThan(0);
    });

    it('高级恩赐费用更高', () => {
      const cost1 = engine.getBlessingCost(1);
      const cost3 = engine.getBlessingCost(3);
      expect(cost3.faith).toBeGreaterThan(cost1.faith);
    });

    it('恩赐等级不超过 5', () => {
      engine.start();
      addFaith(engine, 1e8);
      addGlory(engine, 1e6);
      addGold(engine, 1e10);
      for (let i = 0; i < 6; i++) {
        engine.blessGod('zeus');
      }
      expect(engine.getGodBlessingLevel('zeus')).toBe(5);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（宙斯加成）', () => {
      // 宙斯初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始金币产出倍率为 1（无金币产出加成神）', () => {
      const mult = engine.getGoldProductionMultiplier();
      expect(mult).toBe(1); // 无声望，宙斯只加点击
    });

    it('初始信仰产出倍率为 1', () => {
      const mult = engine.getFaithProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('初始荣耀产出倍率为 1', () => {
      const mult = engine.getGloryProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随众神庇护增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * BLESSING_BONUS_MULTIPLIER, 2);
    });

    it('解锁雅典娜增加金币产出倍率', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockGod('athena');
      const mult = engine.getGoldProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁波塞冬增加信仰产出倍率', () => {
      engine.start();
      addGold(engine, 5000);
      engine.unlockGod('poseidon');
      const mult = engine.getFaithProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁阿瑞斯增加荣耀产出倍率', () => {
      engine.start();
      addGold(engine, 150000);
      engine.unlockGod('ares');
      const mult = engine.getGloryProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁阿波罗增加所有产出倍率', () => {
      engine.start();
      addGold(engine, 500000);
      engine.unlockGod('apollo');
      expect(engine.getGoldProductionMultiplier()).toBeGreaterThan(1);
      expect(engine.getFaithProductionMultiplier()).toBeGreaterThan(1);
      expect(engine.getGloryProductionMultiplier()).toBeGreaterThan(1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始众神庇护为 0', () => {
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
      const blessings = engine.doPrestige();
      expect(blessings).toBeGreaterThan(0);
    });

    it('声望后众神庇护增加', () => {
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

    it('声望保留众神恩赐等级', () => {
      engine.start();
      addFaith(engine, 100);
      addGlory(engine, 50);
      engine.blessGod('zeus');
      const blessBefore = engine.getGodBlessingLevel('zeus');

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      const blessAfter = engine.getGodBlessingLevel('zeus');
      expect(blessAfter).toBe(blessBefore);
    });

    it('声望保留众神解锁状态', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockGod('athena');

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      const gods = engine.gods;
      const athena = gods.find(g => g.id === 'athena');
      expect(athena?.unlocked).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望金币不足时返回 0', () => {
      engine.start();
      const result = engine.doPrestige();
      expect(result).toBe(0);
    });

    it('多次声望累积庇护', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      const first = (engine as any).prestige.currency;

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      const second = (engine as any).prestige.currency;
      expect(second).toBeGreaterThan(first);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('greek-gods');
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

    it('save 包含众神和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).gods).toBeDefined();
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

    it('load 恢复众神状态', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockGod('athena');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const gods = engine2.gods;
      const athena = gods.find(g => g.id === 'athena');
      expect(athena?.unlocked).toBe(true);
    });

    it('load 不同 gameId 不恢复', () => {
      engine.start();
      addGold(engine, 500);
      const data = engine.save();
      data.gameId = 'other-game';

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      // Should not restore since gameId doesn't match
      expect(getGold(engine2)).toBe(0);
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
      expect(state.gods).toBeDefined();
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

    it('loadState 恢复众神', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockGod('athena');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const gods = engine2.gods;
      const athena = gods.find(g => g.id === 'athena');
      expect(athena?.unlocked).toBe(true);
    });

    it('loadState 恢复建筑等级', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.getBuildingLevel(0)).toBe(1);
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

    it('万亿使用 T 后缀', () => {
      const result = (engine as any).formatNumber(1500000000000);
      expect(result).toContain('T');
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

    it('B 键恩赐众神', () => {
      engine.start();
      addFaith(engine, 100);
      addGlory(engine, 50);
      engine.handleKeyDown('b');
      expect(engine.getGodBlessingLevel('zeus')).toBe(1);
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

    it('有众神恩赐时渲染正常', () => {
      engine.start();
      addFaith(engine, 100);
      addGlory(engine, 50);
      engine.blessGod('zeus');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑时渲染正常', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有建筑解锁时渲染正常', () => {
      engine.start();
      addGold(engine, 1e15);
      addFaith(engine, 1e10);
      addGlory(engine, 1e8);
      for (let i = 0; i < BUILDINGS.length; i++) {
        engine.purchaseBuilding(i);
      }
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('未 start 时渲染不抛错', () => {
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // temple_of_zeus
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

    it('产出受众神加成影响', () => {
      engine.start();
      addGold(engine, 10000);
      engine.purchaseBuilding(0);

      addGold(engine, 1000);
      engine.unlockGod('athena');

      tick(engine, 16);
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
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

    it('getBuildingCost 无效索引返回空对象', () => {
      expect(Object.keys(engine.getBuildingCost(-1)).length).toBe(0);
      expect(Object.keys(engine.getBuildingCost(99)).length).toBe(0);
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });

    it('getGodBlessingLevel 不存在的神返回 0', () => {
      expect(engine.getGodBlessingLevel('nonexistent')).toBe(0);
    });

    it('getBlessingCost 不存在的等级返回空对象', () => {
      expect(Object.keys(engine.getBlessingCost(99)).length).toBe(0);
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('on/off 正常工作', () => {
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.start();
      engine.click();
      expect(listener).toHaveBeenCalled();
      engine.off('stateChange', listener);
    });

    it('多个监听器正常工作', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      engine.on('stateChange', listener1);
      engine.on('stateChange', listener2);
      engine.start();
      engine.click();
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('off 后不再触发', () => {
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.off('stateChange', listener);
      engine.start();
      engine.click();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ========== 产出重计算 ==========

  describe('产出重计算', () => {
    it('购买建筑后产出更新', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('解锁神后产出更新', () => {
      engine.start();
      addGold(engine, 1e6);
      // 购买建筑
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0);
      }
      // 解锁雅典娜
      engine.unlockGod('athena');
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('无建筑时产出为 0', () => {
      engine.start();
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBe(0);
    });
  });

  // ========== 综合测试 ==========

  describe('综合测试', () => {
    it('完整游戏流程：点击→建筑→解锁神→恩赐→声望', () => {
      engine.start();

      // 点击积累金币
      for (let i = 0; i < 100; i++) {
        engine.click();
      }
      expect(getGold(engine)).toBeGreaterThan(0);

      // 购买建筑
      addGold(engine, 10000);
      engine.purchaseBuilding(0);
      expect(engine.getBuildingLevel(0)).toBe(1);

      // 解锁神
      addGold(engine, 1000);
      engine.unlockGod('athena');
      const athena = engine.gods.find(g => g.id === 'athena');
      expect(athena?.unlocked).toBe(true);

      // 恩赐
      addFaith(engine, 100);
      addGlory(engine, 50);
      engine.blessGod('zeus');
      expect(engine.getGodBlessingLevel('zeus')).toBe(1);

      // 声望
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const blessings = engine.doPrestige();
      expect(blessings).toBeGreaterThan(0);
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('存档→加载→继续游戏', () => {
      engine.start();
      addGold(engine, 5000);
      engine.click();
      engine.click();
      engine.purchaseBuilding(0);

      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);

      expect(engine2.getBuildingLevel(0)).toBe(1);
      expect(engine2.gameId).toBe('greek-gods');
    });

    it('状态导出→导入正常', () => {
      engine.start();
      addGold(engine, 5000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getGold(engine2)).toBeCloseTo(5000, 0);
    });
  });
});
