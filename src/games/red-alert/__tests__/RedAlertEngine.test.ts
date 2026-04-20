/**
 * 红色警戒 (Red Alert) 放置类游戏 — 完整测试套件
 *
 * 覆盖范围：
 * - 初始化（引擎/兵种/科技/建筑）
 * - 生命周期（start/pause/resume/reset/destroy）
 * - 点击产生矿石
 * - 资源系统（增/减/查询/多资源校验）
 * - 建筑系统（购买/费用递增/解锁链/产出）
 * - 兵种系统（解锁/进化/加成）
 * - 科技树系统（研究/前置/费用/满级）
 * - 加成倍率（点击/产出/声望）
 * - 声望系统（重置/勋章/保留数据）
 * - 存档系统（save/load）
 * - 状态管理（getState/loadState）
 * - 键盘输入处理
 * - Canvas 渲染
 * - 数字格式化
 * - 自动生产
 * - 边界与异常
 */
import { RedAlertEngine } from '@/games/red-alert/RedAlertEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ORE_PER_CLICK,
  MEDAL_BONUS_MULTIPLIER,
  MIN_PRESTIGE_ORE,
  UNITS,
  BUILDINGS,
  TECHS,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/red-alert/constants';

// ========== 测试辅助 ==========

/** 创建 Canvas 元素 */
function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/**
 * 创建完整的 Canvas 2D mock
 * 必须包含：quadraticCurveTo, bezierCurveTo, createLinearGradient,
 *           createRadialGradient, ellipse, arcTo
 */
function createMockCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  const gradientMock = { addColorStop: noop } as CanvasGradient;
  return {
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 10 } as TextMetrics),
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    rect: noop,
    ellipse: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    transform: noop,
    setTransform: noop,
    resetTransform: noop,
    drawImage: noop,
    createLinearGradient: () => gradientMock,
    createRadialGradient: () => gradientMock,
    createPattern: () => null,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10,
    font: '12px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

/** 创建引擎并初始化 */
function createEngine(): RedAlertEngine {
  const engine = new RedAlertEngine();
  engine.init(createCanvas());
  return engine;
}

/** 创建引擎并启动 */
function startEngine(): RedAlertEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

// ---- 资源操作快捷方法 ----
const addOre = (e: RedAlertEngine, n: number) => (e as any).addResource(RESOURCE_IDS.ORE, n);
const addPower = (e: RedAlertEngine, n: number) => (e as any).addResource(RESOURCE_IDS.POWER, n);
const addTech = (e: RedAlertEngine, n: number) => (e as any).addResource(RESOURCE_IDS.TECH, n);
const getOre = (e: RedAlertEngine) => (e as any).getResource(RESOURCE_IDS.ORE)?.amount ?? 0;
const getPower = (e: RedAlertEngine) => (e as any).getResource(RESOURCE_IDS.POWER)?.amount ?? 0;
const getTech = (e: RedAlertEngine) => (e as any).getResource(RESOURCE_IDS.TECH)?.amount ?? 0;
const tick = (e: RedAlertEngine, dt = 16) => (e as any).update(dt);

// ========== 测试 ==========

describe('RedAlertEngine', () => {
  let engine: RedAlertEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // =====================================================
  // 1. 初始化（12 tests）
  // =====================================================
  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(RedAlertEngine);
    });

    it('init 后状态为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后三种资源均为 0', () => {
      expect(getOre(engine)).toBe(0);
      expect(getPower(engine)).toBe(0);
      expect(getTech(engine)).toBe(0);
    });

    it('init 后统计归零', () => {
      expect(engine.totalOreEarned).toBe(0);
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('gameId 为 red-alert', () => {
      expect(engine.gameId).toBe('red-alert');
    });

    it('矿石已解锁', () => {
      expect((engine as any).getResource(RESOURCE_IDS.ORE).unlocked).toBe(true);
    });

    it('电力未解锁', () => {
      expect((engine as any).getResource(RESOURCE_IDS.POWER).unlocked).toBe(false);
    });

    it('科技点未解锁', () => {
      {
        expect((engine as any).getResource(RESOURCE_IDS.TECH).unlocked).toBe(false);
      }
    });

    it('初始只有矿厂解锁', () => {
      expect((engine as any).upgrades.get(BUILDING_IDS.ORE_REFINERY).unlocked).toBe(true);
      expect((engine as any).upgrades.get(BUILDING_IDS.POWER_PLANT).unlocked).toBe(false);
    });

    it('初始只有美国大兵解锁', () => {
      const units = engine.units;
      expect(units.find(u => u.id === 'gi')!.unlocked).toBe(true);
      expect(units.filter(u => u.id !== 'gi').every(u => !u.unlocked)).toBe(true);
    });

    it('所有兵种和科技初始等级为 0', () => {
      engine.units.forEach(u => expect(u.evolutionLevel).toBe(0));
      engine.techs.forEach(t => expect(t.level).toBe(0));
    });
  });

  // =====================================================
  // 2. 常量完整性（8 tests）
  // =====================================================
  describe('常量完整性', () => {
    it('6 种兵种，ID 唯一', () => {
      expect(UNITS.length).toBe(6);
      expect(new Set(UNITS.map(u => u.id)).size).toBe(6);
    });

    it('8 种建筑，ID 唯一', () => {
      expect(BUILDINGS.length).toBe(8);
      expect(new Set(BUILDINGS.map(b => b.id)).size).toBe(8);
    });

    it('5 项科技，ID 唯一', () => {
      expect(TECHS.length).toBe(5);
      expect(new Set(TECHS.map(t => t.id)).size).toBe(5);
    });

    it('兵种加成类型合法', () => {
      const valid = ['click', 'production', 'power', 'tech', 'all'];
      UNITS.forEach(u => expect(valid).toContain(u.bonusType));
    });

    it('科技效果类型合法', () => {
      const valid = ['multiply_ore', 'multiply_power', 'multiply_tech', 'click_bonus', 'all_bonus'];
      TECHS.forEach(t => expect(valid).toContain(t.effectType));
    });

    it('建筑费用递增系数 > 1', () => {
      BUILDINGS.forEach(b => expect(b.costMultiplier).toBeGreaterThan(1));
    });

    it('ORE_PER_CLICK 为正', () => {
      expect(ORE_PER_CLICK).toBeGreaterThan(0);
    });

    it('MIN_PRESTIGE_ORE 为正', () => {
      expect(MIN_PRESTIGE_ORE).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // 3. 生命周期（8 tests）
  // =====================================================
  describe('生命周期', () => {
    it('start → playing', () => {
      engine.start();
      expect((engine as any)._status).toBe('playing');
    });

    it('pause → paused', () => {
      engine.start();
      engine.pause();
      expect((engine as any)._status).toBe('paused');
    });

    it('resume → playing', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect((engine as any)._status).toBe('playing');
    });

    it('reset → idle + 资源归零', () => {
      engine.start();
      addOre(engine, 1000);
      engine.reset();
      expect((engine as any)._status).toBe('idle');
      expect(getOre(engine)).toBe(0);
    });

    it('destroy → idle', () => {
      engine.start();
      engine.destroy();
      expect((engine as any)._status).toBe('idle');
    });

    it('多次 start 不报错', () => {
      engine.start();
      expect(() => engine.start()).not.toThrow();
    });

    it('start → reset → start 循环', () => {
      engine.start();
      addOre(engine, 500);
      engine.reset();
      engine.start();
      expect(getOre(engine)).toBe(0);
    });

    it('连续 reset 不崩溃', () => {
      engine.start();
      engine.reset();
      engine.reset();
      expect((engine as any)._status).toBe('idle');
    });
  });

  // =====================================================
  // 4. 点击产生矿石（8 tests）
  // =====================================================
  describe('点击产生矿石', () => {
    it('playing 下点击返回正数', () => {
      engine.start();
      expect(engine.click()).toBeGreaterThan(0);
    });

    it('连续 10 次点击累积矿石', () => {
      engine.start();
      let total = 0;
      for (let i = 0; i < 10; i++) total += engine.click();
      expect(total).toBeGreaterThanOrEqual(10);
    });

    it('点击增加 totalClicks', () => {
      engine.start();
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
    });

    it('点击增加 totalOreEarned', () => {
      engine.start();
      engine.click();
      expect(engine.totalOreEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 下点击返回 0', () => {
      expect(engine.click()).toBe(0);
    });

    it('paused 下点击返回 0', () => {
      engine.start();
      engine.pause();
      expect(engine.click()).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      engine.start();
      const cb = jest.fn();
      engine.on('stateChange', cb);
      engine.click();
      expect(cb).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 5. 资源系统（7 tests）
  // =====================================================
  describe('资源系统', () => {
    it('增加/查询三种资源', () => {
      addOre(engine, 100);
      addPower(engine, 50);
      addTech(engine, 30);
      expect(getOre(engine)).toBe(100);
      expect(getPower(engine)).toBe(50);
      expect(getTech(engine)).toBe(30);
    });

    it('消耗资源成功', () => {
      addOre(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.ORE, 50);
      expect(getOre(engine)).toBe(50);
    });

    it('消耗资源失败（不足）不扣减', () => {
      addOre(engine, 10);
      const ok = (engine as any).spendResource(RESOURCE_IDS.ORE, 50);
      expect(ok).toBe(false);
      expect(getOre(engine)).toBe(10);
    });

    it('hasResource 正确判断', () => {
      addOre(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.ORE, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.ORE, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addOre(engine, 100);
      addPower(engine, 50);
      expect((engine as any).canAfford({ ore: 50, power: 20 })).toBe(true);
      expect((engine as any).canAfford({ ore: 50, power: 200 })).toBe(false);
    });

    it('资源不超 maxAmount', () => {
      addOre(engine, 1e20);
      const res = (engine as any).getResource(RESOURCE_IDS.ORE);
      expect(res.amount).toBeLessThanOrEqual(res.maxAmount);
    });

    it('getUnlockedResources 只返回已解锁', () => {
      const list = (engine as any).getUnlockedResources();
      expect(list.length).toBe(1); // 只有 ore
      expect(list[0].id).toBe(RESOURCE_IDS.ORE);
    });
  });

  // =====================================================
  // 6. 建筑系统（10 tests）
  // =====================================================
  describe('建筑系统', () => {
    it('购买矿厂成功', () => {
      engine.start();
      addOre(engine, 100);
      expect(engine.purchaseBuilding(0)).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('资源不足购买失败', () => {
      engine.start();
      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('费用递增', () => {
      engine.start();
      addOre(engine, 10000);
      const c1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const c2 = engine.getBuildingCost(0);
      expect(c2[RESOURCE_IDS.ORE]).toBeGreaterThan(c1[RESOURCE_IDS.ORE]);
    });

    it('无效索引返回 false', () => {
      engine.start();
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addOre(engine, 10000);
      expect(engine.purchaseBuilding(1)).toBe(false); // 电厂需矿厂>0
    });

    it('购买后资源减少', () => {
      engine.start();
      addOre(engine, 100);
      const before = getOre(engine);
      engine.purchaseBuilding(0);
      expect(getOre(engine)).toBeLessThan(before);
    });

    it('购买触发 upgradePurchased 事件', () => {
      engine.start();
      addOre(engine, 100);
      const cb = jest.fn();
      engine.on('upgradePurchased', cb);
      engine.purchaseBuilding(0);
      expect(cb).toHaveBeenCalledWith(BUILDING_IDS.ORE_REFINERY, 1);
    });

    it('购买触发 stateChange 事件', () => {
      engine.start();
      addOre(engine, 100);
      const cb = jest.fn();
      engine.on('stateChange', cb);
      engine.purchaseBuilding(0);
      expect(cb).toHaveBeenCalled();
    });

    it('getBuildingCost 无效索引返回 {}', () => {
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingCost(99)).toEqual({});
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });
  });

  // =====================================================
  // 7. 建筑解锁链（5 tests）
  // =====================================================
  describe('建筑解锁链', () => {
    it('矿厂→电厂+兵营', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      expect((engine as any).upgrades.get(BUILDING_IDS.POWER_PLANT).unlocked).toBe(true);
      expect((engine as any).upgrades.get(BUILDING_IDS.BARRACKS).unlocked).toBe(true);
    });

    it('电厂+兵营→战车工厂', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      engine.purchaseBuilding(2);
      tick(engine, 16);
      expect((engine as any).upgrades.get(BUILDING_IDS.WAR_FACTORY).unlocked).toBe(true);
    });

    it('电厂→科技中心', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      tick(engine, 16);
      expect((engine as any).upgrades.get(BUILDING_IDS.TECH_CENTER).unlocked).toBe(true);
    });

    it('科技中心→雷达站', () => {
      engine.start();
      addOre(engine, 100000);
      addPower(engine, 1000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      tick(engine, 16);
      engine.purchaseBuilding(4);
      tick(engine, 16);
      expect((engine as any).upgrades.get(BUILDING_IDS.RADAR_STATION).unlocked).toBe(true);
    });

    it('雷达站→作战实验室', () => {
      engine.start();
      addOre(engine, 500000);
      addPower(engine, 5000);
      addTech(engine, 500);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      tick(engine, 16);
      engine.purchaseBuilding(4);
      tick(engine, 16);
      engine.purchaseBuilding(5);
      tick(engine, 16);
      expect((engine as any).upgrades.get(BUILDING_IDS.BATTLE_LAB).unlocked).toBe(true);
    });
  });

  // =====================================================
  // 8. 资源解锁（2 tests）
  // =====================================================
  describe('资源解锁', () => {
    it('电厂 Lv.1 → 电力解锁', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      tick(engine, 16);
      expect((engine as any).getResource(RESOURCE_IDS.POWER).unlocked).toBe(true);
    });

    it('科技中心 Lv.1 → 科技点解锁', () => {
      engine.start();
      addOre(engine, 100000);
      addPower(engine, 1000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      tick(engine, 16);
      engine.purchaseBuilding(4);
      tick(engine, 16);
      expect((engine as any).getResource(RESOURCE_IDS.TECH).unlocked).toBe(true);
    });
  });

  // =====================================================
  // 9. 兵种系统（8 tests）
  // =====================================================
  describe('兵种系统', () => {
    it('解锁火箭飞行兵', () => {
      engine.start();
      addOre(engine, 500);
      expect(engine.unlockUnit('rocketeer')).toBe(true);
    });

    it('矿石不足解锁失败', () => {
      engine.start();
      addOre(engine, 100);
      expect(engine.unlockUnit('rocketeer')).toBe(false);
    });

    it('重复解锁失败', () => {
      engine.start();
      addOre(engine, 2000);
      engine.unlockUnit('rocketeer');
      expect(engine.unlockUnit('rocketeer')).toBe(false);
    });

    it('解锁不存在的兵种失败', () => {
      engine.start();
      expect(engine.unlockUnit('nonexistent')).toBe(false);
    });

    it('解锁触发 unitUnlocked 事件', () => {
      engine.start();
      addOre(engine, 500);
      const cb = jest.fn();
      engine.on('unitUnlocked', cb);
      engine.unlockUnit('rocketeer');
      expect(cb).toHaveBeenCalledWith('rocketeer');
    });

    it('解锁增加统计计数', () => {
      engine.start();
      addOre(engine, 500);
      engine.unlockUnit('rocketeer');
      expect(engine.statistics.totalUnitsUnlocked).toBe(2);
    });

    it('units getter 返回副本', () => {
      expect(engine.units).not.toBe(engine.units);
    });

    it('解锁各兵种需对应矿石', () => {
      engine.start();
      // 灰熊坦克
      addOre(engine, 3000);
      expect(engine.unlockUnit('tank')).toBe(true);
      // 狙击手
      addOre(engine, 8000);
      expect(engine.unlockUnit('sniper')).toBe(true);
      // 磁暴步兵
      addOre(engine, 25000);
      expect(engine.unlockUnit('tesla')).toBe(true);
      // 超时空军团兵
      addOre(engine, 80000);
      expect(engine.unlockUnit('chrono')).toBe(true);
    });
  });

  // =====================================================
  // 10. 兵种进化（8 tests）
  // =====================================================
  describe('兵种进化', () => {
    it('进化美国大兵成功', () => {
      engine.start();
      addOre(engine, 1000);
      addPower(engine, 100);
      expect(engine.evolveUnit('gi')).toBe(true);
      expect(engine.getUnitEvolutionLevel('gi')).toBe(1);
    });

    it('进化未解锁兵种失败', () => {
      engine.start();
      expect(engine.evolveUnit('rocketeer')).toBe(false);
    });

    it('进化资源不足失败', () => {
      engine.start();
      expect(engine.evolveUnit('gi')).toBe(false);
    });

    it('进化后加成增加', () => {
      engine.start();
      const before = engine.getClickMultiplier();
      addOre(engine, 1000);
      addPower(engine, 100);
      engine.evolveUnit('gi');
      expect(engine.getClickMultiplier()).toBeGreaterThan(before);
    });

    it('进化触发 unitEvolved 事件', () => {
      engine.start();
      addOre(engine, 1000);
      addPower(engine, 100);
      const cb = jest.fn();
      engine.on('unitEvolved', cb);
      engine.evolveUnit('gi');
      expect(cb).toHaveBeenCalledWith('gi', 1);
    });

    it('进化增加统计计数', () => {
      engine.start();
      addOre(engine, 1000);
      addPower(engine, 100);
      engine.evolveUnit('gi');
      expect(engine.statistics.totalEvolutions).toBe(1);
    });

    it('进化费用随等级递增', () => {
      const c1 = engine.getEvolutionCost(1);
      const c3 = engine.getEvolutionCost(3);
      expect(c3[RESOURCE_IDS.ORE]).toBeGreaterThan(c1[RESOURCE_IDS.ORE]);
    });

    it('无效进化等级返回空费用', () => {
      expect(Object.keys(engine.getEvolutionCost(0)).length).toBe(0);
      expect(Object.keys(engine.getEvolutionCost(6)).length).toBe(0);
    });
  });

  // =====================================================
  // 11. 科技树系统（10 tests）
  // =====================================================
  describe('科技树系统', () => {
    it('研究快速采矿成功', () => {
      engine.start();
      addTech(engine, 10);
      expect(engine.researchTech('rapid_mining')).toBe(true);
      expect(engine.getTechLevel('rapid_mining')).toBe(1);
    });

    it('资源不足研究失败', () => {
      engine.start();
      expect(engine.researchTech('rapid_mining')).toBe(false);
    });

    it('研究不存在的科技失败', () => {
      engine.start();
      addTech(engine, 100);
      expect(engine.researchTech('nonexistent')).toBe(false);
    });

    it('科技费用递增', () => {
      engine.start();
      addTech(engine, 1000);
      const c1 = engine.getTechCost('rapid_mining');
      engine.researchTech('rapid_mining');
      const c2 = engine.getTechCost('rapid_mining');
      expect(c2[RESOURCE_IDS.TECH]).toBeGreaterThan(c1[RESOURCE_IDS.TECH]);
    });

    it('AI 系统需前置科技', () => {
      engine.start();
      addTech(engine, 100);
      addOre(engine, 100000);
      expect(engine.researchTech('ai_system')).toBe(false);
    });

    it('AI 系统在前置完成后可研究', () => {
      engine.start();
      addTech(engine, 1000);
      addOre(engine, 1000000);
      engine.researchTech('rapid_mining');
      engine.researchTech('advanced_power');
      expect(engine.researchTech('ai_system')).toBe(true);
    });

    it('超时空科技需 AI 系统', () => {
      engine.start();
      addTech(engine, 10000);
      addOre(engine, 10000000);
      engine.researchTech('rapid_mining');
      engine.researchTech('advanced_power');
      engine.researchTech('ai_system');
      expect(engine.researchTech('chronotech')).toBe(true);
    });

    it('研究触发 techResearched 事件', () => {
      engine.start();
      addTech(engine, 10);
      const cb = jest.fn();
      engine.on('techResearched', cb);
      engine.researchTech('rapid_mining');
      expect(cb).toHaveBeenCalledWith('rapid_mining', 1);
    });

    it('科技达到最大等级后无法继续', () => {
      engine.start();
      addTech(engine, 100000);
      addOre(engine, 10000000);
      for (let i = 0; i < 10; i++) engine.researchTech('rapid_mining');
      expect(engine.getTechLevel('rapid_mining')).toBe(10);
      expect(engine.researchTech('rapid_mining')).toBe(false);
    });

    it('techs getter 返回副本', () => {
      expect(engine.techs).not.toBe(engine.techs);
    });
  });

  // =====================================================
  // 12. 加成倍率（10 tests）
  // =====================================================
  describe('加成倍率', () => {
    it('初始点击倍率含美国大兵加成', () => {
      expect(engine.getClickMultiplier()).toBeCloseTo(1.1, 1);
    });

    it('初始科技点击倍率为 1', () => {
      expect(engine.getTechClickMultiplier()).toBe(1);
    });

    it('初始三种产出倍率均为 1', () => {
      expect(engine.getOreMultiplier()).toBe(1);
      expect(engine.getPowerMultiplier()).toBe(1);
      expect(engine.getTechMultiplier()).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      expect(engine.getPrestigeMultiplier()).toBe(1);
    });

    it('声望倍率随勋章增加', () => {
      (engine as any).prestige.currency = 5;
      expect(engine.getPrestigeMultiplier()).toBeCloseTo(1 + 5 * MEDAL_BONUS_MULTIPLIER, 2);
    });

    it('解锁火箭飞行兵增加产出倍率', () => {
      engine.start();
      addOre(engine, 500);
      engine.unlockUnit('rocketeer');
      expect(engine.getOreMultiplier()).toBeGreaterThan(1);
    });

    it('研究快速采矿增加矿石倍率', () => {
      engine.start();
      addTech(engine, 10);
      engine.researchTech('rapid_mining');
      expect(engine.getOreMultiplier()).toBeGreaterThan(1);
    });

    it('研究先进电力增加电力倍率', () => {
      engine.start();
      addTech(engine, 20);
      addOre(engine, 5000);
      engine.researchTech('advanced_power');
      expect(engine.getPowerMultiplier()).toBeGreaterThan(1);
    });

    it('研究武器升级增加点击倍率', () => {
      engine.start();
      addTech(engine, 30);
      addOre(engine, 10000);
      engine.researchTech('weapon_upgrades');
      expect(engine.getTechClickMultiplier()).toBeGreaterThan(1);
    });

    it('AI 系统增加所有产出倍率', () => {
      engine.start();
      addTech(engine, 1000);
      addOre(engine, 1000000);
      engine.researchTech('rapid_mining');
      engine.researchTech('advanced_power');
      engine.researchTech('ai_system');
      expect(engine.getOreMultiplier()).toBeGreaterThan(1);
      expect(engine.getPowerMultiplier()).toBeGreaterThan(1);
    });
  });

  // =====================================================
  // 13. 声望系统（10 tests）
  // =====================================================
  describe('声望系统', () => {
    it('初始勋章为 0，声望次数为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
      expect((engine as any).prestige.count).toBe(0);
    });

    it('矿石不足无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('矿石达标可以声望', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功返回正数', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      expect(engine.doPrestige()).toBeGreaterThan(0);
    });

    it('声望后勋章和次数增加', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addOre(engine, MIN_PRESTIGE_ORE * 4);
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect(getOre(engine)).toBe(0);
    });

    it('声望保留兵种进化等级', () => {
      engine.start();
      addOre(engine, 1000);
      addPower(engine, 100);
      engine.evolveUnit('gi');
      const evo = engine.getUnitEvolutionLevel('gi');
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect(engine.getUnitEvolutionLevel('gi')).toBe(evo);
    });

    it('声望保留兵种解锁状态', () => {
      engine.start();
      addOre(engine, 500);
      engine.unlockUnit('rocketeer');
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect(engine.units.find(u => u.id === 'rocketeer')!.unlocked).toBe(true);
    });

    it('声望保留科技等级', () => {
      engine.start();
      addTech(engine, 10);
      engine.researchTech('rapid_mining');
      const lv = engine.getTechLevel('rapid_mining');
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect(engine.getTechLevel('rapid_mining')).toBe(lv);
    });

    it('声望触发 prestige 事件并增加统计', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      const cb = jest.fn();
      engine.on('prestige', cb);
      engine.doPrestige();
      expect(cb).toHaveBeenCalled();
      expect(engine.statistics.totalPrestigeCount).toBe(1);
    });
  });

  // =====================================================
  // 14. 存档系统（7 tests）
  // =====================================================
  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('red-alert');
      expect(data.resources).toBeDefined();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含兵种、科技、统计', () => {
      engine.start();
      const data = engine.save();
      expect((data.settings as any).units).toBeDefined();
      expect((data.settings as any).techs).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复资源', () => {
      engine.start();
      addOre(engine, 500);
      const data = engine.save();
      const e2 = createEngine();
      e2.start();
      e2.load(data);
      expect(getOre(e2)).toBeCloseTo(500, 0);
    });

    it('load 恢复兵种状态', () => {
      engine.start();
      addOre(engine, 500);
      engine.unlockUnit('rocketeer');
      const data = engine.save();
      const e2 = createEngine();
      e2.start();
      e2.load(data);
      expect(e2.units.find(u => u.id === 'rocketeer')!.unlocked).toBe(true);
    });

    it('load 恢复科技状态', () => {
      engine.start();
      addTech(engine, 10);
      engine.researchTech('rapid_mining');
      const data = engine.save();
      const e2 = createEngine();
      e2.start();
      e2.load(data);
      expect(e2.getTechLevel('rapid_mining')).toBe(1);
    });

    it('load 恢复统计和选中索引', () => {
      engine.start();
      (engine as any)._selectedIndex = 3;
      (engine as any)._stats.totalClicks = 42;
      const data = engine.save();
      const e2 = createEngine();
      e2.start();
      e2.load(data);
      expect(e2.selectedIndex).toBe(3);
    });

    it('load 错误 gameId 不恢复', () => {
      engine.start();
      addOre(engine, 500);
      const data = engine.save();
      data.gameId = 'wrong';
      const e2 = createEngine();
      e2.start();
      e2.load(data);
      expect(getOre(e2)).toBe(0);
    });
  });

  // =====================================================
  // 15. 状态管理（5 tests）
  // =====================================================
  describe('状态管理', () => {
    it('getState 返回完整状态', () => {
      engine.start();
      const s = engine.getState();
      expect(s.resources).toBeDefined();
      expect(s.buildings).toBeDefined();
      expect(s.units).toBeDefined();
      expect(s.techs).toBeDefined();
      expect(s.prestige).toBeDefined();
      expect(s.statistics).toBeDefined();
      expect(s.selectedIndex).toBeDefined();
    });

    it('loadState 恢复资源', () => {
      engine.start();
      addOre(engine, 1000);
      const s = engine.getState();
      const e2 = createEngine();
      e2.start();
      e2.loadState(s as any);
      expect(getOre(e2)).toBeCloseTo(1000, 0);
    });

    it('loadState 恢复声望', () => {
      engine.start();
      (engine as any).prestige = { currency: 5, count: 2 };
      const s = engine.getState();
      const e2 = createEngine();
      e2.start();
      e2.loadState(s as any);
      expect((e2 as any).prestige.currency).toBe(5);
      expect((e2 as any).prestige.count).toBe(2);
    });

    it('loadState 恢复兵种和科技', () => {
      engine.start();
      addOre(engine, 500);
      engine.unlockUnit('rocketeer');
      addTech(engine, 10);
      engine.researchTech('rapid_mining');
      const s = engine.getState();
      const e2 = createEngine();
      e2.start();
      e2.loadState(s as any);
      expect(e2.units.find(u => u.id === 'rocketeer')!.unlocked).toBe(true);
      expect(e2.getTechLevel('rapid_mining')).toBe(1);
    });

    it('loadState 恢复选中索引', () => {
      engine.start();
      (engine as any)._selectedIndex = 5;
      const s = engine.getState();
      const e2 = createEngine();
      e2.start();
      e2.loadState(s as any);
      expect(e2.selectedIndex).toBe(5);
    });
  });

  // =====================================================
  // 16. 键盘输入（10 tests）
  // =====================================================
  describe('键盘输入', () => {
    it('空格触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(getOre(engine)).toBeGreaterThan(0);
    });

    it('↑ 减少选中索引', () => {
      engine.start();
      (engine as any)._selectedIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(1);
    });

    it('↑ 不低于 0', () => {
      engine.start();
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(0);
    });

    it('↓ 增加选中索引', () => {
      engine.start();
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(1);
    });

    it('↓ 不超过最大值', () => {
      engine.start();
      (engine as any)._selectedIndex = BUILDINGS.length - 1;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(BUILDINGS.length - 1);
    });

    it('Enter 购买建筑', () => {
      engine.start();
      addOre(engine, 100);
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('E 键进化兵种', () => {
      engine.start();
      addOre(engine, 1000);
      addPower(engine, 100);
      engine.handleKeyDown('e');
      expect(engine.getUnitEvolutionLevel('gi')).toBe(1);
    });

    it('T 键研究科技', () => {
      engine.start();
      addTech(engine, 10);
      engine.handleKeyDown('t');
      expect(engine.getTechLevel('rapid_mining')).toBe(1);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getOre(engine)).toBe(0);
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // =====================================================
  // 17. Canvas 渲染（6 tests）
  // =====================================================
  describe('Canvas 渲染', () => {
    it('onRender 不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('多次渲染不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      for (let i = 0; i < 10; i++) engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    });

    it('有声望时渲染正常', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      expect(() => engine.onRender(createMockCtx(), CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有兵种进化时渲染正常', () => {
      engine.start();
      addOre(engine, 1000);
      addPower(engine, 100);
      engine.evolveUnit('gi');
      expect(() => engine.onRender(createMockCtx(), CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑和科技时渲染正常', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0);
      addTech(engine, 10);
      engine.researchTech('rapid_mining');
      expect(() => engine.onRender(createMockCtx(), CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('Canvas mock 方法齐全（quadraticCurveTo/bezierCurveTo/ellipse/arcTo/createLinearGradient/createRadialGradient）', () => {
      const ctx = createMockCtx();
      expect(typeof ctx.quadraticCurveTo).toBe('function');
      expect(typeof ctx.bezierCurveTo).toBe('function');
      expect(typeof ctx.ellipse).toBe('function');
      expect(typeof ctx.arcTo).toBe('function');
      expect(typeof ctx.createLinearGradient).toBe('function');
      expect(typeof ctx.createRadialGradient).toBe('function');
      const lg = ctx.createLinearGradient(0, 0, 100, 100);
      expect(typeof lg.addColorStop).toBe('function');
      const rg = ctx.createRadialGradient(50, 50, 0, 50, 50, 50);
      expect(typeof rg.addColorStop).toBe('function');
    });
  });

  // =====================================================
  // 18. 数字格式化（5 tests）
  // =====================================================
  describe('数字格式化', () => {
    const fmt = (v: number) => (engine as any).formatNumber(v);

    it('小数字原样返回', () => expect(fmt(42)).toBe('42'));
    it('千位 K', () => expect(fmt(1500)).toContain('K'));
    it('百万 M', () => expect(fmt(1500000)).toContain('M'));
    it('十亿 B', () => expect(fmt(1500000000)).toContain('B'));
    it('0 返回 0', () => expect(fmt(0)).toBe('0'));
  });

  // =====================================================
  // 19. 自动生产（4 tests）
  // =====================================================
  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0);
      const before = getOre(engine);
      tick(engine, 1000);
      expect(getOre(engine)).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0);
      const before = getOre(engine);
      for (let i = 0; i < 10; i++) tick(engine, 100);
      expect(getOre(engine)).toBeGreaterThan(before);
    });

    it('电力建筑产出电力', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      tick(engine, 16);
      tick(engine, 1000);
      expect(getPower(engine)).toBeGreaterThan(0);
    });

    it('科技建筑产出科技点', () => {
      engine.start();
      addOre(engine, 100000);
      addPower(engine, 1000);
      engine.purchaseBuilding(0);
      tick(engine, 16);
      engine.purchaseBuilding(1);
      tick(engine, 16);
      engine.purchaseBuilding(4);
      tick(engine, 16);
      tick(engine, 1000);
      expect(getTech(engine)).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // 20. 边界与异常（10 tests）
  // =====================================================
  describe('边界与异常', () => {
    it('大量资源不溢出', () => {
      addOre(engine, 1e14);
      expect(getOre(engine)).toBeGreaterThan(0);
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

    it('statistics getter 返回副本', () => {
      expect(engine.statistics).not.toBe(engine.statistics);
    });

    it('getUnitEvolutionLevel 不存在返回 0', () => {
      expect(engine.getUnitEvolutionLevel('nonexistent')).toBe(0);
    });

    it('getTechLevel/getTechCost 不存在返回默认值', () => {
      expect(engine.getTechLevel('nonexistent')).toBe(0);
      expect(engine.getTechCost('nonexistent')).toEqual({});
    });

    it('1000 次点击性能正常', () => {
      engine.start();
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) engine.click();
      expect(performance.now() - t0).toBeLessThan(1000);
    });
  });
});
