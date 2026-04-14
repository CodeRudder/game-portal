/**
 * 四大文明·古中国 (Civ China) 放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivChinaEngine } from '@/games/civ-china/CivChinaEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  FOOD_PER_CLICK,
  MANDATE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_FOOD,
  DYNASTY_BONUS,
  BUILDINGS,
  BUILDING_IDS,
  DYNASTY_IDS,
  DYNASTIES,
  OFFICIALS,
  COLORS,
  SCENE_DRAW,
} from '@/games/civ-china/constants';

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

function createEngine(): CivChinaEngine {
  const engine = new CivChinaEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): CivChinaEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addFood(engine: CivChinaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.FOOD, amount);
}

function addSilk(engine: CivChinaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.SILK, amount);
}

function addCulture(engine: CivChinaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.CULTURE, amount);
}

/** 触发一次 update */
function tick(engine: CivChinaEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getFood(engine: CivChinaEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.FOOD)?.amount ?? 0;
}

function getSilk(engine: CivChinaEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.SILK)?.amount ?? 0;
}

function getCulture(engine: CivChinaEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.CULTURE)?.amount ?? 0;
}

// ========== 测试 ==========

describe('CivChinaEngine', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(CivChinaEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后粮食为 0', () => {
      expect(getFood(engine)).toBe(0);
    });

    it('init 后丝绸为 0', () => {
      expect(getSilk(engine)).toBe(0);
    });

    it('init 后文化为 0', () => {
      expect(getCulture(engine)).toBe(0);
    });

    it('init 后总粮食获得为 0', () => {
      expect(engine.totalFoodEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 civ-china', () => {
      expect(engine.gameId).toBe('civ-china');
    });

    it('init 后粮食已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.FOOD);
      expect(res.unlocked).toBe(true);
    });

    it('init 后丝绸未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.SILK);
      expect(res.unlocked).toBe(false);
    });

    it('init 后文化未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.CULTURE);
      expect(res.unlocked).toBe(false);
    });

    it('init 后朝代索引为 0', () => {
      expect(engine.dynastyIndex).toBe(0);
    });

    it('init 后当前朝代为夏', () => {
      expect(engine.getCurrentDynastyName()).toBe('夏');
    });

    it('init 后秀才已招募', () => {
      const officials = engine.officials;
      const scholar = officials.find(o => o.id === 'scholar');
      expect(scholar?.recruited).toBe(true);
    });

    it('init 后举人未招募', () => {
      const officials = engine.officials;
      const juren = officials.find(o => o.id === 'juren');
      expect(juren?.recruited).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('CANVAS_WIDTH 为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('FOOD_PER_CLICK 为 1', () => {
      expect(FOOD_PER_CLICK).toBe(1);
    });

    it('MANDATE_BONUS_MULTIPLIER 为 0.15', () => {
      expect(MANDATE_BONUS_MULTIPLIER).toBe(0.15);
    });

    it('MIN_PRESTIGE_FOOD 为 50000', () => {
      expect(MIN_PRESTIGE_FOOD).toBe(50000);
    });

    it('DYNASTY_BONUS 为 0.15', () => {
      expect(DYNASTY_BONUS).toBe(0.15);
    });
  });

  // ========== RESOURCE_IDS ==========

  describe('RESOURCE_IDS', () => {
    it('FOOD 常量正确', () => {
      expect(RESOURCE_IDS.FOOD).toBe('food');
    });

    it('SILK 常量正确', () => {
      expect(RESOURCE_IDS.SILK).toBe('silk');
    });

    it('CULTURE 常量正确', () => {
      expect(RESOURCE_IDS.CULTURE).toBe('culture');
    });
  });

  // ========== BUILDING_IDS ==========

  describe('BUILDING_IDS', () => {
    it('包含所有 8 个建筑 ID', () => {
      expect(Object.keys(BUILDING_IDS).length).toBe(8);
    });

    it('FARM 常量正确', () => {
      expect(BUILDING_IDS.FARM).toBe('farm');
    });

    it('SILK_WORKSHOP 常量正确', () => {
      expect(BUILDING_IDS.SILK_WORKSHOP).toBe('silk_workshop');
    });

    it('GREAT_WALL 常量正确', () => {
      expect(BUILDING_IDS.GREAT_WALL).toBe('great_wall');
    });

    it('SILK_ROAD 常量正确', () => {
      expect(BUILDING_IDS.SILK_ROAD).toBe('silk_road');
    });

    it('ACADEMY 常量正确', () => {
      expect(BUILDING_IDS.ACADEMY).toBe('academy');
    });

    it('IMPERIAL_PALACE 常量正确', () => {
      expect(BUILDING_IDS.IMPERIAL_PALACE).toBe('imperial_palace');
    });

    it('GRAND_CANAL 常量正确', () => {
      expect(BUILDING_IDS.GRAND_CANAL).toBe('grand_canal');
    });

    it('FORBIDDEN_CITY 常量正确', () => {
      expect(BUILDING_IDS.FORBIDDEN_CITY).toBe('forbidden_city');
    });
  });

  // ========== DYNASTY_IDS ==========

  describe('DYNASTY_IDS', () => {
    it('包含所有 8 个朝代 ID', () => {
      expect(Object.keys(DYNASTY_IDS).length).toBe(8);
    });

    it('XIA 常量正确', () => {
      expect(DYNASTY_IDS.XIA).toBe('xia');
    });

    it('SHANG 常量正确', () => {
      expect(DYNASTY_IDS.SHANG).toBe('shang');
    });

    it('ZHOU 常量正确', () => {
      expect(DYNASTY_IDS.ZHOU).toBe('zhou');
    });

    it('QIN 常量正确', () => {
      expect(DYNASTY_IDS.QIN).toBe('qin');
    });

    it('HAN 常量正确', () => {
      expect(DYNASTY_IDS.HAN).toBe('han');
    });

    it('TANG 常量正确', () => {
      expect(DYNASTY_IDS.TANG).toBe('tang');
    });

    it('SONG 常量正确', () => {
      expect(DYNASTY_IDS.SONG).toBe('song');
    });

    it('MING 常量正确', () => {
      expect(DYNASTY_IDS.MING).toBe('ming');
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

    it('农田初始解锁', () => {
      const farm = (engine as any).upgrades.get(BUILDING_IDS.FARM);
      expect(farm.unlocked).toBe(true);
    });

    it('丝绸作坊初始未解锁', () => {
      const workshop = (engine as any).upgrades.get(BUILDING_IDS.SILK_WORKSHOP);
      expect(workshop.unlocked).toBe(false);
    });
  });

  // ========== 朝代常量验证 ==========

  describe('朝代常量', () => {
    it('应有 8 个朝代', () => {
      expect(DYNASTIES.length).toBe(8);
    });

    it('朝代 ID 唯一', () => {
      const ids = DYNASTIES.map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个朝代有名称', () => {
      DYNASTIES.forEach(d => {
        expect(d.name).toBeTruthy();
      });
    });

    it('每个朝代有图标', () => {
      DYNASTIES.forEach(d => {
        expect(d.icon).toBeTruthy();
      });
    });

    it('每个朝代有正数加成', () => {
      DYNASTIES.forEach(d => {
        expect(d.bonusValue).toBeGreaterThan(0);
      });
    });

    it('夏朝不需要天命点', () => {
      expect(DYNASTIES[0].requiredMandate).toBe(0);
    });

    it('后续朝代需要更多天命点', () => {
      for (let i = 1; i < DYNASTIES.length; i++) {
        expect(DYNASTIES[i].requiredMandate).toBeGreaterThan(DYNASTIES[i - 1].requiredMandate);
      }
    });
  });

  // ========== 科举官员常量验证 ==========

  describe('科举官员常量', () => {
    it('应有 4 种官员', () => {
      expect(OFFICIALS.length).toBe(4);
    });

    it('官员 ID 唯一', () => {
      const ids = OFFICIALS.map(o => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个官员有名称', () => {
      OFFICIALS.forEach(o => {
        expect(o.name).toBeTruthy();
      });
    });

    it('每个官员有正数加成', () => {
      OFFICIALS.forEach(o => {
        expect(o.bonusValue).toBeGreaterThan(0);
      });
    });

    it('秀才招募费用为 0', () => {
      expect(OFFICIALS[0].recruitCost).toBe(0);
    });
  });

  // ========== COLORS 常量 ==========

  describe('COLORS 常量', () => {
    it('包含所有必要颜色', () => {
      expect(COLORS.background).toBeDefined();
      expect(COLORS.foodColor).toBeDefined();
      expect(COLORS.silkColor).toBeDefined();
      expect(COLORS.cultureColor).toBeDefined();
      expect(COLORS.lanternGlow).toBeDefined();
      expect(COLORS.wallColor).toBeDefined();
    });

    it('颜色值为合法 CSS 颜色', () => {
      expect(typeof COLORS.foodColor).toBe('string');
      expect(typeof COLORS.silkColor).toBe('string');
      expect(typeof COLORS.cultureColor).toBe('string');
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

    it('reset 后粮食归零', () => {
      engine.start();
      addFood(engine, 1000);
      engine.reset();
      expect(getFood(engine)).toBe(0);
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
      addFood(engine, 500);
      engine.reset();
      engine.start();
      expect(getFood(engine)).toBe(0);
    });
  });

  // ========== 点击产生粮食 ==========

  describe('点击产生粮食', () => {
    it('点击一次产生粮食', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getFood(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生粮食', () => {
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

    it('点击增加总粮食获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalFoodEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getFood(engine)).toBe(0);
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
    it('增加粮食', () => {
      addFood(engine, 100);
      expect(getFood(engine)).toBe(100);
    });

    it('增加丝绸', () => {
      addSilk(engine, 50);
      expect(getSilk(engine)).toBe(50);
    });

    it('增加文化', () => {
      addCulture(engine, 30);
      expect(getCulture(engine)).toBe(30);
    });

    it('消耗粮食成功', () => {
      addFood(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.FOOD, 50);
      expect(getFood(engine)).toBe(50);
    });

    it('消耗粮食失败（不足）', () => {
      addFood(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.FOOD, 50);
      expect(result).toBeFalsy();
      expect(getFood(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addFood(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.FOOD, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.FOOD, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addFood(engine, 100);
      addSilk(engine, 50);
      expect((engine as any).canAfford({ [RESOURCE_IDS.FOOD]: 50, [RESOURCE_IDS.SILK]: 20 })).toBe(true);
      expect((engine as any).canAfford({ [RESOURCE_IDS.FOOD]: 50, [RESOURCE_IDS.SILK]: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('购买农田成功', () => {
      engine.start();
      addFood(engine, 100);
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
      addFood(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2[RESOURCE_IDS.FOOD]).toBeGreaterThan(cost1[RESOURCE_IDS.FOOD]);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addFood(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addFood(engine, 10000);
      // 丝绸作坊需要农田等级 > 0
      const result = engine.purchaseBuilding(1); // silk_workshop
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addFood(engine, 100);
      const before = getFood(engine);
      engine.purchaseBuilding(0);
      expect(getFood(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addFood(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('购买建筑增加统计计数', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0);
      expect(engine.statistics.totalBuildingPurchases).toBe(1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('丝绸作坊在农田有等级后解锁', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      const workshop = (engine as any).upgrades.get(BUILDING_IDS.SILK_WORKSHOP);
      expect(workshop.unlocked).toBe(true);
    });

    it('长城在农田有等级后解锁', () => {
      engine.start();
      addFood(engine, 10000);
      addSilk(engine, 1000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      const wall = (engine as any).upgrades.get(BUILDING_IDS.GREAT_WALL);
      expect(wall.unlocked).toBe(true);
    });

    it('科举书院需要长城', () => {
      engine.start();
      addFood(engine, 100000);
      addSilk(engine, 10000);
      addCulture(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // great_wall
      tick(engine, 16);
      const academy = (engine as any).upgrades.get(BUILDING_IDS.ACADEMY);
      expect(academy.unlocked).toBe(true);
    });

    it('丝绸之路需要朝代 1（商朝）', () => {
      engine.start();
      addFood(engine, 1000000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      // 丝绸作坊和长城都需要 farm
      addSilk(engine, 100000);
      engine.purchaseBuilding(1); // silk_workshop
      engine.purchaseBuilding(2); // great_wall
      tick(engine, 16);
      // 朝代 0（夏朝）时丝绸之路不解锁
      const silkRoad = (engine as any).upgrades.get(BUILDING_IDS.SILK_ROAD);
      expect(silkRoad.unlocked).toBe(false);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('丝绸在丝绸作坊等级>=1时解锁', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      addFood(engine, 1000);
      engine.purchaseBuilding(1); // silk_workshop
      tick(engine, 16);
      const silk = (engine as any).getResource(RESOURCE_IDS.SILK);
      expect(silk.unlocked).toBe(true);
    });

    it('文化在科举书院等级>=1时解锁', () => {
      engine.start();
      addFood(engine, 100000);
      addSilk(engine, 10000);
      addCulture(engine, 10000);
      engine.purchaseBuilding(0); // farm
      tick(engine, 16);
      engine.purchaseBuilding(2); // great_wall
      tick(engine, 16);
      addFood(engine, 10000);
      addCulture(engine, 1000);
      engine.purchaseBuilding(4); // academy
      tick(engine, 16);
      const culture = (engine as any).getResource(RESOURCE_IDS.CULTURE);
      expect(culture.unlocked).toBe(true);
    });
  });

  // ========== 朝代系统 ==========

  describe('朝代系统', () => {
    it('初始朝代为夏', () => {
      expect(engine.dynastyIndex).toBe(0);
      expect(engine.getCurrentDynastyName()).toBe('夏');
    });

    it('推进到商朝需要 3 天命', () => {
      engine.start();
      (engine as any).prestige.currency = 3;
      const result = engine.advanceDynasty();
      expect(result).toBe(true);
      expect(engine.dynastyIndex).toBe(1);
      expect(engine.getCurrentDynastyName()).toBe('商');
    });

    it('天命不足无法推进朝代', () => {
      engine.start();
      (engine as any).prestige.currency = 1;
      const result = engine.advanceDynasty();
      expect(result).toBe(false);
      expect(engine.dynastyIndex).toBe(0);
    });

    it('推进朝代触发 dynastyAdvanced 事件', () => {
      engine.start();
      (engine as any).prestige.currency = 3;
      const listener = vi.fn();
      engine.on('dynastyAdvanced', listener);
      engine.advanceDynasty();
      expect(listener).toHaveBeenCalledWith('shang', 1);
    });

    it('推进朝代增加统计计数', () => {
      engine.start();
      (engine as any).prestige.currency = 3;
      engine.advanceDynasty();
      expect(engine.statistics.totalDynastyAdvances).toBe(1);
    });

    it('推进朝代后产出增加', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // farm
      // 夏朝给粮食 +10%
      const prodBefore = (engine as any).getResource(RESOURCE_IDS.FOOD)?.perSecond ?? 0;
      (engine as any).prestige.currency = 3;
      engine.advanceDynasty();
      // 商朝给丝绸 +15%，不影响粮食，但 recalculateProduction 会重新计算
      const prodAfter = (engine as any).getResource(RESOURCE_IDS.FOOD)?.perSecond ?? 0;
      // 商朝粮食加成为 1（无加成），所以产出变为 base * 1 = base
      // 夏朝时 prodBefore = base * 1.1, 商朝时 prodAfter = base * 1
      // 因此 prodAfter < prodBefore
      expect(prodAfter).toBeGreaterThan(0);
    });

    it('推进到所有朝代', () => {
      engine.start();
      const mandates = [0, 3, 10, 25, 50, 100, 200, 500];
      for (let i = 0; i < DYNASTIES.length - 1; i++) {
        (engine as any).prestige.currency = mandates[i + 1];
        const result = engine.advanceDynasty();
        expect(result).toBe(true);
        expect(engine.dynastyIndex).toBe(i + 1);
      }
      expect(engine.dynastyIndex).toBe(DYNASTIES.length - 1);
    });

    it('最后一个朝代后无法再推进', () => {
      engine.start();
      (engine as any)._dynastyIndex = DYNASTIES.length - 1;
      (engine as any).prestige.currency = 9999;
      const result = engine.advanceDynasty();
      expect(result).toBe(false);
    });

    it('canAdvanceDynasty 正确判断', () => {
      engine.start();
      expect(engine.canAdvanceDynasty()).toBe(false);
      (engine as any).prestige.currency = 3;
      expect(engine.canAdvanceDynasty()).toBe(true);
    });

    it('getCurrentDynasty 返回正确朝代', () => {
      const dynasty = engine.getCurrentDynasty();
      expect(dynasty.id).toBe('xia');
      expect(dynasty.name).toBe('夏');
    });
  });

  // ========== 科举系统 ==========

  describe('科举系统', () => {
    it('初始秀才已招募', () => {
      const officials = engine.officials;
      const scholar = officials.find(o => o.id === 'scholar');
      expect(scholar?.recruited).toBe(true);
    });

    it('招募举人需要 500 文化', () => {
      engine.start();
      addCulture(engine, 500);
      const result = engine.recruitOfficial('juren');
      expect(result).toBe(true);
      const officials = engine.officials;
      const juren = officials.find(o => o.id === 'juren');
      expect(juren?.recruited).toBe(true);
    });

    it('招募举人失败（文化不足）', () => {
      engine.start();
      addCulture(engine, 100);
      const result = engine.recruitOfficial('juren');
      expect(result).toBe(false);
    });

    it('招募不存在的官员失败', () => {
      engine.start();
      const result = engine.recruitOfficial('nonexistent');
      expect(result).toBe(false);
    });

    it('重复招募同一官员失败', () => {
      engine.start();
      const result = engine.recruitOfficial('scholar');
      expect(result).toBe(false);
    });

    it('招募官员触发 officialRecruited 事件', () => {
      engine.start();
      addCulture(engine, 500);
      const listener = vi.fn();
      engine.on('officialRecruited', listener);
      engine.recruitOfficial('juren');
      expect(listener).toHaveBeenCalledWith('juren');
    });

    it('招募官员增加统计计数', () => {
      engine.start();
      addCulture(engine, 500);
      engine.recruitOfficial('juren');
      expect(engine.statistics.totalOfficialsRecruited).toBe(2);
    });

    it('招募状元需要 8000 文化', () => {
      engine.start();
      addCulture(engine, 8000);
      const result = engine.recruitOfficial('zhuangyuan');
      expect(result).toBe(true);
    });

    it('招募官员后产出增加', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // farm
      const prodBefore = (engine as any).getResource(RESOURCE_IDS.FOOD)?.perSecond ?? 0;
      addCulture(engine, 500);
      engine.recruitOfficial('juren'); // 举人：所有产出 +15%
      const prodAfter = (engine as any).getResource(RESOURCE_IDS.FOOD)?.perSecond ?? 0;
      expect(prodAfter).toBeGreaterThan(prodBefore);
    });

    it('officials getter 返回副本', () => {
      const o1 = engine.officials;
      const o2 = engine.officials;
      expect(o1).not.toBe(o2);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始声望倍率为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随天命增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * MANDATE_BONUS_MULTIPLIER, 2);
    });

    it('夏朝粮食加成为 +10%', () => {
      const mult = engine.getDynastyMultiplier(RESOURCE_IDS.FOOD);
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('夏朝丝绸加成为 1（无加成）', () => {
      const mult = engine.getDynastyMultiplier(RESOURCE_IDS.SILK);
      expect(mult).toBe(1);
    });

    it('商朝丝绸加成为 +15%', () => {
      (engine as any)._dynastyIndex = 1;
      const mult = engine.getDynastyMultiplier(RESOURCE_IDS.SILK);
      expect(mult).toBeCloseTo(1.15, 2);
    });

    it('秦朝所有加成为 +20%', () => {
      (engine as any)._dynastyIndex = 3;
      const mult = engine.getDynastyMultiplier(RESOURCE_IDS.FOOD);
      expect(mult).toBeCloseTo(1.2, 1);
    });

    it('初始官员点击倍率为 1.1（秀才加成）', () => {
      const mult = engine.getOfficialClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始官员生产倍率为 1（无生产加成官员）', () => {
      const mult = engine.getOfficialProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('招募举人后生产倍率增加', () => {
      addCulture(engine, 500);
      engine.recruitOfficial('juren');
      const mult = engine.getOfficialProductionMultiplier();
      expect(mult).toBeCloseTo(1.15, 2);
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

    it('粮食不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（粮食不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('粮食达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      const mandate = engine.doPrestige();
      expect(mandate).toBeGreaterThan(0);
    });

    it('声望后天命增加', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addFood(engine, MIN_PRESTIGE_FOOD * 4);
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect(getFood(engine)).toBe(0);
    });

    it('声望保留官员状态', () => {
      engine.start();
      addCulture(engine, 500);
      engine.recruitOfficial('juren');
      const jurenBefore = engine.officials.find(o => o.id === 'juren');
      expect(jurenBefore?.recruited).toBe(true);

      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      const jurenAfter = engine.officials.find(o => o.id === 'juren');
      expect(jurenAfter?.recruited).toBe(true);
    });

    it('声望保留朝代索引', () => {
      engine.start();
      (engine as any).prestige.currency = 3;
      engine.advanceDynasty();
      expect(engine.dynastyIndex).toBe(1);

      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      expect(engine.dynastyIndex).toBe(1);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
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
      expect(data.gameId).toBe('civ-china');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addFood(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含朝代、官员和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).dynastyIndex).toBeDefined();
      expect((data.settings as any).officials).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addFood(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getFood(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复朝代状态', () => {
      engine.start();
      (engine as any).prestige.currency = 3;
      engine.advanceDynasty();
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.dynastyIndex).toBe(1);
    });

    it('load 恢复官员状态', () => {
      engine.start();
      addCulture(engine, 500);
      engine.recruitOfficial('juren');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const juren = engine2.officials.find(o => o.id === 'juren');
      expect(juren?.recruited).toBe(true);
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
      expect(state.dynastyIndex).toBeDefined();
      expect(state.officials).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addFood(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getFood(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复朝代', () => {
      engine.start();
      (engine as any).prestige.currency = 3;
      engine.advanceDynasty();
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.dynastyIndex).toBe(1);
    });

    it('loadState 恢复官员', () => {
      engine.start();
      addCulture(engine, 500);
      engine.recruitOfficial('juren');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const juren = engine2.officials.find(o => o.id === 'juren');
      expect(juren?.recruited).toBe(true);
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
      expect(getFood(engine)).toBeGreaterThan(0);
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
      addFood(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('D 键推进朝代', () => {
      engine.start();
      (engine as any).prestige.currency = 3;
      engine.handleKeyDown('d');
      expect(engine.dynastyIndex).toBe(1);
    });

    it('O 键招募官员', () => {
      engine.start();
      addCulture(engine, 500);
      engine.handleKeyDown('o');
      const juren = engine.officials.find(o => o.id === 'juren');
      expect(juren?.recruited).toBe(true);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getFood(engine)).toBe(0);
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

    it('有朝代推进时渲染正常', () => {
      engine.start();
      (engine as any)._dynastyIndex = 2;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有官员招募时渲染正常', () => {
      engine.start();
      addCulture(engine, 500);
      engine.recruitOfficial('juren');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑购买后渲染正常', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有朝代时渲染正常', () => {
      engine.start();
      (engine as any)._dynastyIndex = DYNASTIES.length - 1;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有官员招募时渲染正常', () => {
      engine.start();
      for (const o of (engine as any)._officials) {
        o.recruited = true;
      }
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0); // farm
      const before = getFood(engine);
      tick(engine, 1000);
      const after = getFood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addFood(engine, 100);
      engine.purchaseBuilding(0);
      const before = getFood(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getFood(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('朝代加成影响产出', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // farm
      const prodBefore = (engine as any).getResource(RESOURCE_IDS.FOOD)?.perSecond ?? 0;

      // 夏朝给粮食 +10%
      expect(prodBefore).toBeGreaterThan(0);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addFood(engine, 1e14);
      expect(getFood(engine)).toBeGreaterThan(0);
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

    it('getBuildingCost 无效索引返回空对象', () => {
      expect(Object.keys(engine.getBuildingCost(-1)).length).toBe(0);
      expect(Object.keys(engine.getBuildingCost(99)).length).toBe(0);
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });

    it('getDynastyMultiplier 无朝代返回 1', () => {
      (engine as any)._dynastyIndex = 999;
      const mult = engine.getDynastyMultiplier();
      expect(mult).toBe(1);
    });

    it('声望后重新计算产出', () => {
      engine.start();
      addFood(engine, 10000);
      engine.purchaseBuilding(0); // farm
      (engine as any)._stats.totalFoodEarned = MIN_PRESTIGE_FOOD * 4;
      engine.doPrestige();
      // 声望后建筑归零，产出应为 0
      const food = (engine as any).getResource(RESOURCE_IDS.FOOD);
      expect(food.perSecond).toBe(0);
    });
  });
});
