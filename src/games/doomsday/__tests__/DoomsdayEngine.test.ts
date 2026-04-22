import { vi } from 'vitest';
/**
 * 末日生存 (Doomsday) 放置类游戏 — 完整测试套件
 */
import { DoomsdayEngine } from '@/games/doomsday/DoomsdayEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SUPPLY_PER_CLICK,
  CHIP_BONUS_MULTIPLIER,
  PRESTIGE_BASE_CHIPS,
  MIN_PRESTIGE_SUPPLY,
  BUILDINGS,
  BUILDING_IDS,
  ZOMBIE_WAVES,
  COLORS,
  SCENE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
} from '@/games/doomsday/constants';

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

function createEngine(): DoomsdayEngine {
  const engine = new DoomsdayEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): DoomsdayEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addSupply(engine: DoomsdayEngine, amount: number): void {
  (engine as any).addResource('supply', amount);
}

function addAmmo(engine: DoomsdayEngine, amount: number): void {
  (engine as any).addResource('ammo', amount);
}

function addPower(engine: DoomsdayEngine, amount: number): void {
  (engine as any).addResource('power', amount);
}

/** 触发一次 update */
function tick(engine: DoomsdayEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getSupply(engine: DoomsdayEngine): number {
  return (engine as any).getResource('supply')?.amount ?? 0;
}

function getAmmo(engine: DoomsdayEngine): number {
  return (engine as any).getResource('ammo')?.amount ?? 0;
}

function getPower(engine: DoomsdayEngine): number {
  return (engine as any).getResource('power')?.amount ?? 0;
}

/** 获取建筑等级 */
function getBuildingLevel(engine: DoomsdayEngine, id: string): number {
  const upgrade = (engine as any).upgrades.get(id);
  return upgrade ? upgrade.level : 0;
}

/** 设置建筑等级（绕过购买逻辑） */
function setBuildingLevel(engine: DoomsdayEngine, id: string, level: number): void {
  const upgrade = (engine as any).upgrades.get(id);
  if (upgrade) {
    upgrade.level = level;
    upgrade.unlocked = true;
  }
}

// ========== 测试 ==========

describe('DoomsdayEngine', () => {
  let engine: DoomsdayEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 (10) ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(DoomsdayEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后物资为 0', () => {
      expect(getSupply(engine)).toBe(0);
    });

    it('init 后弹药为 0', () => {
      expect(getAmmo(engine)).toBe(0);
    });

    it('init 后电力为 0', () => {
      expect(getPower(engine)).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后总物资获得为 0', () => {
      expect(engine.totalSupplyEarned).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 doomsday', () => {
      expect(engine.gameId).toBe('doomsday');
    });

    it('init 后物资已解锁', () => {
      const res = (engine as any).getResource('supply');
      expect(res.unlocked).toBe(true);
    });
  });

  // ========== 常量 (5) ==========

  describe('常量', () => {
    it('应有正确的 Canvas 尺寸', () => {
      expect(CANVAS_WIDTH).toBe(480);
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('应有 8 种建筑定义', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('应有 10 波丧尸', () => {
      expect(ZOMBIE_WAVES.length).toBe(10);
    });

    it('点击常量应为 1', () => {
      expect(SUPPLY_PER_CLICK).toBe(1);
    });

    it('声望加成系数应为 0.12', () => {
      expect(CHIP_BONUS_MULTIPLIER).toBe(0.12);
    });
  });

  // ========== 点击 (8) ==========

  describe('点击', () => {
    it('playing 状态下点击应获得物资', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBe(SUPPLY_PER_CLICK);
      expect(getSupply(engine)).toBeGreaterThanOrEqual(SUPPLY_PER_CLICK);
    });

    it('点击应增加 totalClicks', () => {
      engine.start();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(2);
    });

    it('点击应增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('点击应增加 totalSupplyEarned', () => {
      engine.start();
      engine.click();
      expect(engine.totalSupplyEarned).toBeGreaterThanOrEqual(SUPPLY_PER_CLICK);
    });

    it('idle 状态下点击应返回 0', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('paused 状态下点击应返回 0', () => {
      engine.start();
      engine.pause();
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('声望加成应增加点击收益', () => {
      engine.start();
      // 模拟有末日芯片
      (engine as any).prestige.currency = 10;
      const gained = engine.click();
      const expected = Math.floor(SUPPLY_PER_CLICK * (1 + 10 * CHIP_BONUS_MULTIPLIER) * 100) / 100;
      expect(gained).toBe(expected);
    });

    it('点击应触发 stateChange 事件', () => {
      engine.start();
      const handler = vi.fn();
      engine.on('stateChange', handler);
      engine.click();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ========== 资源 (6) ==========

  describe('资源', () => {
    it('addResource 应增加资源数量', () => {
      addSupply(engine, 100);
      expect(getSupply(engine)).toBe(100);
    });

    it('spendResource 应减少资源数量', () => {
      addSupply(engine, 100);
      (engine as any).spendResource('supply', 30);
      expect(getSupply(engine)).toBe(70);
    });

    it('spendResource 不足时应返回 false', () => {
      addSupply(engine, 10);
      const result = (engine as any).spendResource('supply', 50);
      expect(result).toBe(false);
      expect(getSupply(engine)).toBe(10);
    });

    it('canAfford 应检查多资源费用', () => {
      addSupply(engine, 100);
      addPower(engine, 50);
      const result = (engine as any).canAfford({ supply: 50, power: 30 });
      expect(result).toBe(true);
    });

    it('canAfford 任一资源不足应返回 false', () => {
      addSupply(engine, 100);
      addPower(engine, 10);
      const result = (engine as any).canAfford({ supply: 50, power: 30 });
      expect(result).toBe(false);
    });

    it('弹药初始未解锁', () => {
      const res = (engine as any).getResource('ammo');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 建筑 (10) ==========

  describe('建筑', () => {
    it('初始只有 shelter 解锁', () => {
      const shelterUpgrade = (engine as any).upgrades.get('shelter');
      expect(shelterUpgrade.unlocked).toBe(true);
    });

    it('purchaseBuilding 无效索引应返回 false', () => {
      engine.start();
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(999)).toBe(false);
    });

    it('purchaseBuilding 未解锁建筑应返回 false', () => {
      engine.start();
      // generator 需要前置 shelter
      expect(engine.purchaseBuilding(1)).toBe(false);
    });

    it('purchaseBuilding 资源不足应返回 false', () => {
      engine.start();
      // shelter 已解锁但物资为 0
      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('purchaseBuilding 资源足够应成功', () => {
      engine.start();
      addSupply(engine, 100);
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(true);
      expect(getBuildingLevel(engine, 'shelter')).toBe(1);
    });

    it('购买建筑应扣除资源', () => {
      engine.start();
      addSupply(engine, 100);
      engine.purchaseBuilding(0);
      // shelter baseCost = { supply: 15 }
      expect(getSupply(engine)).toBe(85);
    });

    it('购买建筑应增加产出', () => {
      engine.start();
      addSupply(engine, 100);
      engine.purchaseBuilding(0);
      // shelter produces supply, recalculateProduction called in purchaseBuilding
      const supply = (engine as any).getResource('supply');
      expect(supply.perSecond).toBeGreaterThan(0);
    });

    it('建筑达到最大等级后无法购买', () => {
      engine.start();
      const shelterUpgrade = (engine as any).upgrades.get('shelter');
      shelterUpgrade.level = shelterUpgrade.maxLevel;
      addSupply(engine, 1000000);
      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('getBuildingCost 应返回正确的费用', () => {
      engine.start();
      const cost = engine.getBuildingCost(0);
      expect(cost).toBeDefined();
      // 等级 0 时费用等于 baseCost
      const shelter = BUILDINGS[0];
      expect(Object.keys(cost)).toEqual(Object.keys(shelter.baseCost));
    });

    it('getBuildingLevel 应返回正确的等级', () => {
      engine.start();
      expect(engine.getBuildingLevel(0)).toBe(0);
      setBuildingLevel(engine, 'shelter', 5);
      expect(engine.getBuildingLevel(0)).toBe(5);
    });
  });

  // ========== 转生/声望 (6) ==========

  describe('转生/声望', () => {
    it('物资未达标时 doPrestige 应返回 0', () => {
      engine.start();
      expect(engine.doPrestige()).toBe(0);
    });

    it('canPrestige 物资未达标时应返回 false', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('物资达标后 canPrestige 应返回 true', () => {
      engine.start();
      // 直接设置统计
      (engine as any)._stats.totalSupplyEarned = MIN_PRESTIGE_SUPPLY;
      expect(engine.canPrestige()).toBe(true);
    });

    it('doPrestige 应返回末日芯片数量', () => {
      engine.start();
      (engine as any)._stats.totalSupplyEarned = MIN_PRESTIGE_SUPPLY * 4;
      const chips = engine.doPrestige();
      expect(chips).toBeGreaterThan(0);
    });

    it('doPrestige 应增加声望货币', () => {
      engine.start();
      (engine as any)._stats.totalSupplyEarned = MIN_PRESTIGE_SUPPLY * 4;
      const prevCurrency = (engine as any).prestige.currency;
      const chips = engine.doPrestige();
      expect((engine as any).prestige.currency).toBe(prevCurrency + chips);
    });

    it('getPrestigeMultiplier 应正确计算加成', () => {
      engine.start();
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1 + 5 * CHIP_BONUS_MULTIPLIER);
    });
  });

  // ========== 存档 (5) ==========

  describe('存档', () => {
    it('save 应返回有效的 SaveData', () => {
      engine.start();
      const data = engine.save();
      expect(data.gameId).toBe('doomsday');
      expect(data.version).toBeDefined();
      expect(data.resources).toBeDefined();
      expect(data.prestige).toBeDefined();
    });

    it('load 应恢复游戏状态', () => {
      engine.start();
      addSupply(engine, 500);
      const data = engine.save();

      // 创建新引擎并加载
      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getSupply(engine2)).toBe(500);
    });

    it('exportSave 应返回 Base64 字符串', () => {
      engine.start();
      const exported = engine.exportSave();
      expect(typeof exported).toBe('string');
      // 应该可以解码
      expect(() => atob(exported)).not.toThrow();
    });

    it('importSave 应恢复存档', () => {
      engine.start();
      addSupply(engine, 300);
      const exported = engine.exportSave();

      const engine2 = createEngine();
      engine2.start();
      const result = engine2.importSave(exported);
      expect(result).toBe(true);
      expect(getSupply(engine2)).toBe(300);
    });

    it('importSave 无效数据应返回 false', () => {
      engine.start();
      expect(engine.importSave('invalid base64!')).toBe(false);
    });
  });

  // ========== 状态 (4) ==========

  describe('状态', () => {
    it('getState 应返回完整的游戏状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state.resources).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.zombieBattle).toBeDefined();
    });

    it('loadState 应恢复资源和建筑', () => {
      engine.start();
      addSupply(engine, 1000);
      setBuildingLevel(engine, 'shelter', 3);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state);
      expect(getSupply(engine2)).toBe(1000);
      expect(getBuildingLevel(engine2, 'shelter')).toBe(3);
    });

    it('loadState 应恢复声望数据', () => {
      engine.start();
      (engine as any).prestige = { currency: 5, count: 2 };
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state);
      expect((engine2 as any).prestige.currency).toBe(5);
      expect((engine2 as any).prestige.count).toBe(2);
    });

    it('loadState 应恢复丧尸战斗状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state.zombieBattle.inBattle).toBe(false);
      expect(state.zombieBattle.currentWave).toBe(0);
    });
  });

  // ========== 生命周期 (5) ==========

  describe('生命周期', () => {
    it('start 后状态应为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('pause 后状态应为 paused', () => {
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态应为 playing', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态应为 idle', () => {
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('destroy 后引擎应清理', () => {
      engine.start();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ========== 格式化 (3) ==========

  describe('格式化', () => {
    it('formatNumber 应正确格式化小数', () => {
      expect(engine.formatNumber(0)).toBe('0');
      expect(engine.formatNumber(100)).toBe('100');
    });

    it('formatNumber 应使用 K/M/B 后缀', () => {
      expect(engine.formatNumber(1500)).toBe('1.5K');
      expect(engine.formatNumber(1000000)).toBe('1M');
      expect(engine.formatNumber(1000000000)).toBe('1B');
    });

    it('formatNumber 应处理负数', () => {
      expect(engine.formatNumber(-100)).toBe('-100');
    });
  });

  // ========== 渲染 (3) ==========

  describe('渲染', () => {
    it('render 不应抛出异常', () => {
      engine.start();
      const ctx = createMockCtx();
      expect(() => {
        (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('render 应调用 ctx 绑定方法', () => {
      engine.start();
      const ctx = createMockCtx();
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      expect(fillRectSpy).toHaveBeenCalled();
    });

    it('render 未开始游戏时不应抛出', () => {
      const ctx = createMockCtx();
      expect(() => {
        (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });
  });

  // ========== 键盘 (4) ==========

  describe('键盘', () => {
    it('空格键应触发点击', () => {
      engine.start();
      const prevSupply = getSupply(engine);
      engine.handleKeyDown(' ');
      expect(getSupply(engine)).toBeGreaterThan(prevSupply);
    });

    it('ArrowDown 应增加 selectedIndex', () => {
      engine.start();
      const prev = engine.selectedIndex;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(prev + 1);
    });

    it('ArrowUp 应减少 selectedIndex', () => {
      engine.start();
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowDown');
      const prev = engine.selectedIndex;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBeLessThan(prev);
    });

    it('idle 状态下键盘不应有效果', () => {
      const prevSupply = getSupply(engine);
      engine.handleKeyDown(' ');
      expect(getSupply(engine)).toBe(prevSupply);
    });
  });

  // ========== 边界 (10) ==========

  describe('边界条件', () => {
    it('selectedIndex 不应小于 0', () => {
      engine.start();
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(0);
    });

    it('selectedIndex 不应超过建筑数', () => {
      engine.start();
      for (let i = 0; i < 50; i++) {
        engine.handleKeyDown('ArrowDown');
      }
      expect(engine.selectedIndex).toBeLessThan(BUILDINGS.length);
    });

    it('getBuildingCost 无效索引应返回空对象', () => {
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingCost(999)).toEqual({});
    });

    it('getBuildingLevel 无效索引应返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(999)).toBe(0);
    });

    it('资源不应超过 maxAmount', () => {
      engine.start();
      addSupply(engine, 2e15);
      const supply = (engine as any).getResource('supply');
      expect(supply.amount).toBeLessThanOrEqual(supply.maxAmount);
    });

    it('多次 click 应累加物资', () => {
      engine.start();
      for (let i = 0; i < 10; i++) {
        engine.click();
      }
      expect(getSupply(engine)).toBeGreaterThanOrEqual(10);
    });

    it('重复 pause 不应抛出异常', () => {
      engine.start();
      engine.pause();
      expect(() => engine.pause()).not.toThrow();
    });

    it('重复 resume 不应抛出异常', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(() => engine.resume()).not.toThrow();
    });

    it('formatNumber 应处理 Infinity', () => {
      expect(engine.formatNumber(Infinity)).toBe('∞');
    });

    it('doPrestige 后资源应被重置', () => {
      engine.start();
      addSupply(engine, 100000);
      (engine as any)._stats.totalSupplyEarned = MIN_PRESTIGE_SUPPLY * 4;
      engine.doPrestige();
      expect(getSupply(engine)).toBe(0);
    });
  });
});
