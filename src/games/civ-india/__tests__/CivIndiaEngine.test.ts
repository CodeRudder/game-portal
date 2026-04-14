/**
 * 四大文明·古印度 (Civ India) — 放置类游戏引擎测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivIndiaEngine } from '../CivIndiaEngine';
import type { CasteState, DharmaState } from '../CivIndiaEngine';
import {
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  CASTES,
  DHARMAS,
  MIN_PRESTIGE_SPICE,
  SPICE_PER_CLICK,
  NIRVANA_BONUS_MULTIPLIER,
  MAX_EVOLUTION_LEVEL,
  EVOLUTION_COSTS,
  COLORS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../constants';

// ========== Canvas Mock ==========
const createMockCtx = () => ({
  fillRect: vi.fn(), strokeRect: vi.fn(), clearRect: vi.fn(),
  fillText: vi.fn(), strokeText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
  beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
  arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
  save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
  drawImage: vi.fn(), clip: vi.fn(), rect: vi.fn(),
  quadraticCurveTo: vi.fn(), bezierCurveTo: vi.fn(),
  ellipse: vi.fn(), arcTo: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
  globalAlpha: 1, lineWidth: 1,
});

// ========== Helpers ==========

/** Create a canvas element mock for setCanvas */
function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** Create engine + set canvas so start() works */
function createEngine(): CivIndiaEngine {
  const engine = new CivIndiaEngine();
  engine.init(createMockCanvas());
  return engine;
}

/** Start the engine (sets status to 'playing') */
function startEngine(engine: CivIndiaEngine): void {
  engine.start();
}

/** Shortcut: add spice */
function addSpice(engine: CivIndiaEngine, amount: number): void {
  engine.addResource(RESOURCE_IDS.SPICE, amount);
}

/** Shortcut: add gem */
function addGem(engine: CivIndiaEngine, amount: number): void {
  engine.addResource(RESOURCE_IDS.GEM, amount);
}

/** Shortcut: add karma */
function addKarma(engine: CivIndiaEngine, amount: number): void {
  engine.addResource(RESOURCE_IDS.KARMA, amount);
}

// ========== Tests ==========
describe('CivIndiaEngine', () => {
  let engine: CivIndiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ================================================================
  // 1. 初始化 (10 tests)
  // ================================================================
  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(CivIndiaEngine);
    });

    it('gameId 应为 civ-india', () => {
      expect(engine.gameId).toBe('civ-india');
    });

    it('香料初始为 0 且已解锁', () => {
      const res = engine.getResource(RESOURCE_IDS.SPICE);
      expect(res).toBeDefined();
      expect(res!.amount).toBe(0);
      expect(res!.unlocked).toBe(true);
    });

    it('宝石初始为 0 且未解锁', () => {
      const res = engine.getResource(RESOURCE_IDS.GEM);
      expect(res).toBeDefined();
      expect(res!.amount).toBe(0);
      expect(res!.unlocked).toBe(false);
    });

    it('业力初始为 0 且未解锁', () => {
      const res = engine.getResource(RESOURCE_IDS.KARMA);
      expect(res).toBeDefined();
      expect(res!.amount).toBe(0);
      expect(res!.unlocked).toBe(false);
    });

    it('totalSpiceEarned 初始为 0', () => {
      expect(engine.totalSpiceEarned).toBe(0);
    });

    it('totalClicks 初始为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('score 初始为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('selectedIndex 初始为 0', () => {
      expect(engine.selectedIndex).toBe(0);
    });

    it('首陀罗种姓初始已解锁，其余未解锁', () => {
      const castes = engine.castes;
      expect(castes.find(c => c.id === 'sudra')!.unlocked).toBe(true);
      expect(castes.find(c => c.id === 'vaisya')!.unlocked).toBe(false);
      expect(castes.find(c => c.id === 'kshatriya')!.unlocked).toBe(false);
      expect(castes.find(c => c.id === 'brahmin')!.unlocked).toBe(false);
    });
  });

  // ================================================================
  // 2. 常量验证 (6 tests)
  // ================================================================
  describe('常量验证', () => {
    it('RESOURCE_IDS 应包含 spice / gem / karma', () => {
      expect(RESOURCE_IDS.SPICE).toBe('spice');
      expect(RESOURCE_IDS.GEM).toBe('gem');
      expect(RESOURCE_IDS.KARMA).toBe('karma');
      expect(Object.keys(RESOURCE_IDS)).toHaveLength(3);
    });

    it('BUILDINGS 应有 8 个建筑定义', () => {
      expect(BUILDINGS).toHaveLength(8);
    });

    it('CASTES 应有 4 个种姓', () => {
      expect(CASTES).toHaveLength(4);
    });

    it('DHARMAS 应有 6 个佛法修行', () => {
      expect(DHARMAS).toHaveLength(6);
    });

    it('MIN_PRESTIGE_SPICE 应为 50000', () => {
      expect(MIN_PRESTIGE_SPICE).toBe(50000);
    });

    it('COLORS 应包含主题色', () => {
      expect(COLORS).toBeDefined();
      expect(COLORS.spiceColor).toBeDefined();
      expect(COLORS.gemColor).toBeDefined();
      expect(COLORS.karmaColor).toBeDefined();
      expect(COLORS.accent).toBeDefined();
    });
  });

  // ================================================================
  // 3. 点击系统 (8 tests)
  // ================================================================
  describe('点击系统', () => {
    it('playing 状态下点击应返回获得的香料数', () => {
      startEngine(engine);
      const gained = engine.click();
      expect(gained).toBeGreaterThanOrEqual(SPICE_PER_CLICK);
    });

    it('点击应增加香料资源', () => {
      startEngine(engine);
      engine.click();
      const res = engine.getResource(RESOURCE_IDS.SPICE);
      expect(res!.amount).toBeGreaterThanOrEqual(SPICE_PER_CLICK);
    });

    it('点击应增加 totalSpiceEarned', () => {
      startEngine(engine);
      engine.click();
      expect(engine.totalSpiceEarned).toBeGreaterThanOrEqual(SPICE_PER_CLICK);
    });

    it('点击应增加 totalClicks', () => {
      startEngine(engine);
      engine.click();
      expect(engine.totalClicks).toBe(1);
    });

    it('多次点击应累加香料和点击数', () => {
      startEngine(engine);
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
      const res = engine.getResource(RESOURCE_IDS.SPICE);
      expect(res!.amount).toBeGreaterThanOrEqual(SPICE_PER_CLICK * 3);
    });

    it('idle 状态下点击应返回 0 且不增加资源', () => {
      // engine is idle by default (not started)
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(engine.totalClicks).toBe(0);
    });

    it('点击应增加 score', () => {
      startEngine(engine);
      engine.click();
      expect(engine.score).toBeGreaterThanOrEqual(SPICE_PER_CLICK);
    });

    it('点击应触发 stateChange 事件', () => {
      startEngine(engine);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.click();
      expect(listener).toHaveBeenCalled();
    });
  });

  // ================================================================
  // 4. 资源系统 (6 tests)
  // ================================================================
  describe('资源系统', () => {
    it('addResource 应增加资源数量', () => {
      addSpice(engine, 500);
      expect(engine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(500);
    });

    it('addResource 正数应自动解锁未解锁资源', () => {
      // gem starts locked
      expect(engine.getResource(RESOURCE_IDS.GEM)!.unlocked).toBe(false);
      addGem(engine, 100);
      expect(engine.getResource(RESOURCE_IDS.GEM)!.unlocked).toBe(true);
    });

    it('spendResource 资源充足时应成功', () => {
      addSpice(engine, 100);
      const result = engine.spendResource(RESOURCE_IDS.SPICE, 50);
      expect(result).toBe(true);
      expect(engine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(50);
    });

    it('spendResource 资源不足时应失败', () => {
      addSpice(engine, 10);
      const result = engine.spendResource(RESOURCE_IDS.SPICE, 50);
      expect(result).toBe(false);
      expect(engine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(10);
    });

    it('canAfford 应正确判断多资源费用', () => {
      addSpice(engine, 100);
      addGem(engine, 50);
      expect(engine.canAfford({ spice: 50, gem: 30 })).toBe(true);
      expect(engine.canAfford({ spice: 50, gem: 60 })).toBe(false);
    });

    it('getResource 对不存在的资源应返回 undefined', () => {
      expect(engine.getResource('nonexistent')).toBeUndefined();
    });
  });

  // ================================================================
  // 5. 建筑系统 (10 tests)
  // ================================================================
  describe('建筑系统', () => {
    it('香料园初始应已解锁', () => {
      // Can get cost => building exists and is accessible
      const cost = engine.getUpgradeCost(BUILDING_IDS.SPICE_GARDEN);
      expect(Object.keys(cost).length).toBeGreaterThan(0);
    });

    it('资源充足时购买建筑应成功', () => {
      addSpice(engine, 1000);
      const result = engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      expect(result).toBe(true);
    });

    it('资源不足时购买建筑应失败', () => {
      // spice = 0, cost = 15
      const result = engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      expect(result).toBe(false);
    });

    it('购买后应扣除对应资源', () => {
      addSpice(engine, 1000);
      const cost = engine.getUpgradeCost(BUILDING_IDS.SPICE_GARDEN);
      engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      const res = engine.getResource(RESOURCE_IDS.SPICE);
      const expected = 1000 - (cost[RESOURCE_IDS.SPICE] || 0);
      expect(res!.amount).toBe(expected);
    });

    it('建筑费用应随等级递增', () => {
      addSpice(engine, 100000);
      const cost1 = engine.getUpgradeCost(BUILDING_IDS.SPICE_GARDEN);
      engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      const cost2 = engine.getUpgradeCost(BUILDING_IDS.SPICE_GARDEN);
      expect(cost2[RESOURCE_IDS.SPICE]).toBeGreaterThan(cost1[RESOURCE_IDS.SPICE]);
    });

    it('purchaseBuildingByIndex 应正确工作', () => {
      addSpice(engine, 1000);
      const result = engine.purchaseBuildingByIndex(0); // spice garden
      expect(result).toBe(true);
    });

    it('purchaseBuildingByIndex 无效索引应返回 false', () => {
      expect(engine.purchaseBuildingByIndex(-1)).toBe(false);
      expect(engine.purchaseBuildingByIndex(999)).toBe(false);
    });

    it('未解锁建筑不能购买', () => {
      // stupa requires spice_garden level > 0
      addSpice(engine, 10000);
      const result = engine.purchaseBuilding(BUILDING_IDS.STUPA);
      expect(result).toBe(false);
    });

    it('满足前置条件后建筑在 update 后自动解锁', () => {
      addSpice(engine, 100000);
      engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      // Building unlocks happen in onUpdate, so trigger an update cycle
      engine.start();
      engine.update(16);
      const result = engine.purchaseBuilding(BUILDING_IDS.STUPA);
      expect(result).toBe(true);
    });

    it('达到 maxLevel 后不能再购买', () => {
      addSpice(engine, 1e15);
      const garden = BUILDINGS.find(b => b.id === BUILDING_IDS.SPICE_GARDEN)!;
      for (let i = 0; i < garden.maxLevel + 1; i++) {
        engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      }
      const result = engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      expect(result).toBe(false);
    });
  });

  // ================================================================
  // 6. 种姓系统 (6 tests)
  // ================================================================
  describe('种姓系统', () => {
    it('首陀罗初始已解锁', () => {
      const sudra = engine.castes.find(c => c.id === 'sudra');
      expect(sudra!.unlocked).toBe(true);
    });

    it('香料不足时解锁种姓应失败', () => {
      // vaisya costs 800 spice
      const result = engine.unlockCaste('vaisya');
      expect(result).toBe(false);
    });

    it('香料充足时应能解锁种姓', () => {
      addSpice(engine, 800);
      const result = engine.unlockCaste('vaisya');
      expect(result).toBe(true);
      const vaisya = engine.castes.find(c => c.id === 'vaisya');
      expect(vaisya!.unlocked).toBe(true);
    });

    it('重复解锁种姓应失败', () => {
      addSpice(engine, 2000);
      engine.unlockCaste('vaisya');
      const result = engine.unlockCaste('vaisya');
      expect(result).toBe(false);
    });

    it('解锁不存在的种姓应失败', () => {
      expect(engine.unlockCaste('nonexistent')).toBe(false);
    });

    it('解锁种姓应扣除香料', () => {
      const vaisya = CASTES.find(c => c.id === 'vaisya')!;
      addSpice(engine, vaisya.unlockCost + 100);
      engine.unlockCaste('vaisya');
      expect(engine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(100);
    });
  });

  // ================================================================
  // 7. 佛法修行 (8 tests)
  // ================================================================
  describe('佛法修行', () => {
    it('冥想初始已解锁', () => {
      const meditation = engine.dharmas.find(d => d.id === 'meditation');
      expect(meditation!.unlocked).toBe(true);
    });

    it('业力不足时解锁佛法应失败', () => {
      // dana costs 200 karma
      const result = engine.unlockDharma('dana');
      expect(result).toBe(false);
    });

    it('业力充足时应能解锁佛法', () => {
      addKarma(engine, 200);
      const result = engine.unlockDharma('dana');
      expect(result).toBe(true);
    });

    it('重复解锁佛法应失败', () => {
      addKarma(engine, 500);
      engine.unlockDharma('dana');
      const result = engine.unlockDharma('dana');
      expect(result).toBe(false);
    });

    it('解锁不存在的佛法应失败', () => {
      expect(engine.unlockDharma('nonexistent')).toBe(false);
    });

    it('进化未解锁的佛法应失败', () => {
      // dana is locked initially
      const result = engine.evolveDharma('dana');
      expect(result).toBe(false);
    });

    it('资源充足时进化佛法应成功', () => {
      // meditation is unlocked, evolve level 1 costs gem:10, karma:5
      addGem(engine, 100);
      addKarma(engine, 100);
      addSpice(engine, 1000);
      const result = engine.evolveDharma('meditation');
      expect(result).toBe(true);
      const meditation = engine.dharmas.find(d => d.id === 'meditation');
      expect(meditation!.evolutionLevel).toBe(1);
    });

    it('进化不存在的佛法应失败', () => {
      expect(engine.evolveDharma('nonexistent')).toBe(false);
    });
  });

  // ================================================================
  // 8. 转生系统 (6 tests)
  // ================================================================
  describe('转生系统', () => {
    it('totalSpiceEarned 不足时转生应返回 0', () => {
      const gained = engine.doPrestige();
      expect(gained).toBe(0);
    });

    it('totalSpiceEarned 充足时转生应获得涅槃点', () => {
      // Need totalSpiceEarned >= MIN_PRESTIGE_SPICE
      // Use engine internal stats manipulation via loadState
      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 2,
      };
      engine.loadState(state);

      const gained = engine.doPrestige();
      expect(gained).toBeGreaterThan(0);
    });

    it('转生后香料应重置为 0', () => {
      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 2,
      };
      state.resources[RESOURCE_IDS.SPICE] = { amount: 99999, perSecond: 0, unlocked: true };
      engine.loadState(state);

      engine.doPrestige();
      const spice = engine.getResource(RESOURCE_IDS.SPICE);
      expect(spice!.amount).toBe(0);
    });

    it('转生后 totalClicks 应重置为 0', () => {
      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 2,
        totalClicks: 100,
      };
      engine.loadState(state);

      engine.doPrestige();
      expect(engine.totalClicks).toBe(0);
    });

    it('转生应保留种姓解锁状态', () => {
      // Unlock vaisya first
      addSpice(engine, 800);
      engine.unlockCaste('vaisya');

      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 2,
      };
      engine.loadState(state);

      engine.doPrestige();
      const vaisya = engine.castes.find(c => c.id === 'vaisya');
      expect(vaisya!.unlocked).toBe(true);
    });

    it('转生应保留佛法进化等级', () => {
      // Evolve meditation
      addGem(engine, 100);
      addKarma(engine, 100);
      addSpice(engine, 1000);
      engine.evolveDharma('meditation');

      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 2,
      };
      engine.loadState(state);

      engine.doPrestige();
      const meditation = engine.dharmas.find(d => d.id === 'meditation');
      expect(meditation!.evolutionLevel).toBe(1);
    });
  });

  // ================================================================
  // 9. 存档 (5 tests)
  // ================================================================
  describe('存档系统', () => {
    it('save 应返回有效的 SaveData', () => {
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('civ-india');
      expect(data.resources).toBeDefined();
    });

    it('save/load 应正确恢复资源', () => {
      addSpice(engine, 1000);
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(1000);
    });

    it('save 应包含种姓和佛法数据', () => {
      const data = engine.save();
      expect(data.settings).toBeDefined();
      const settings = data.settings as any;
      expect(settings.castes).toBeDefined();
      expect(settings.dharmas).toBeDefined();
    });

    it('load 错误 gameId 应被忽略', () => {
      const data = engine.save();
      data.gameId = 'wrong-game';
      // load with wrong gameId should not change state
      const spiceBefore = engine.getResource(RESOURCE_IDS.SPICE)!.amount;
      engine.load(data);
      expect(engine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(spiceBefore);
    });

    it('save/load 往返应保持建筑等级', () => {
      addSpice(engine, 10000);
      engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      // Building level should be restored (saved in upgrades)
      const state = newEngine.getState();
      expect(state.buildings[BUILDING_IDS.SPICE_GARDEN]).toBe(1);
    });
  });

  // ================================================================
  // 10. 状态管理 (4 tests)
  // ================================================================
  describe('状态管理', () => {
    it('getState 应返回完整状态对象', () => {
      const state = engine.getState();
      expect(state).toBeDefined();
      expect(state.resources).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.castes).toBeDefined();
      expect(state.dharmas).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 应恢复资源', () => {
      addSpice(engine, 500);
      const state = engine.getState();
      engine.loadState(state);
      expect(engine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(500);
    });

    it('loadState 应恢复种姓状态', () => {
      addSpice(engine, 800);
      engine.unlockCaste('vaisya');
      const state = engine.getState();
      engine.loadState(state);
      const vaisya = engine.castes.find(c => c.id === 'vaisya');
      expect(vaisya!.unlocked).toBe(true);
    });

    it('loadState 应恢复佛法状态', () => {
      addGem(engine, 100);
      addKarma(engine, 100);
      addSpice(engine, 1000);
      engine.evolveDharma('meditation');
      const state = engine.getState();
      engine.loadState(state);
      const meditation = engine.dharmas.find(d => d.id === 'meditation');
      expect(meditation!.evolutionLevel).toBe(1);
    });
  });

  // ================================================================
  // 11. 生命周期 (5 tests)
  // ================================================================
  describe('生命周期', () => {
    it('start 应将状态变为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('pause 应将状态变为 paused', () => {
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 应将状态变回 playing', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 应将状态变为 idle 并重置资源', () => {
      addSpice(engine, 1000);
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.getResource(RESOURCE_IDS.SPICE)!.amount).toBe(0);
    });

    it('destroy 应清理引擎', () => {
      engine.start();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ================================================================
  // 12. 数字格式化 (3 tests)
  // ================================================================
  describe('数字格式化', () => {
    it('应正确格式化小整数', () => {
      expect(engine.formatNumber(123)).toBe('123');
    });

    it('应正确格式化千位数', () => {
      expect(engine.formatNumber(1500)).toBe('1.5K');
    });

    it('应正确格式化百万数', () => {
      expect(engine.formatNumber(2500000)).toBe('2.5M');
    });
  });

  // ================================================================
  // 13. Canvas 渲染 (3 tests)
  // ================================================================
  describe('Canvas 渲染', () => {
    it('onRender 在 idle 状态不应抛出错误', () => {
      const ctx = createMockCtx();
      expect(() => {
        engine.onRender(ctx as any, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('onRender 在 playing 状态不应抛出错误', () => {
      engine.start();
      const ctx = createMockCtx();
      expect(() => {
        engine.onRender(ctx as any, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('onRender 应调用 Canvas API', () => {
      const ctx = createMockCtx();
      engine.onRender(ctx as any, CANVAS_WIDTH, CANVAS_HEIGHT);
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  // ================================================================
  // 14. 键盘 (4 tests)
  // ================================================================
  describe('键盘操作', () => {
    it('空格键在 playing 状态应触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(engine.totalClicks).toBe(1);
    });

    it('ArrowDown 应增加 selectedIndex', () => {
      engine.start();
      const prev = engine.selectedIndex;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(prev + 1);
    });

    it('ArrowUp 应减少 selectedIndex', () => {
      engine.start();
      engine.handleKeyDown('ArrowDown'); // increase first
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(0);
    });

    it('handleKeyUp 不应抛出错误', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ================================================================
  // 15. 自动生产 (2 tests)
  // ================================================================
  describe('自动生产', () => {
    it('购买建筑后 update 应增加资源', () => {
      addSpice(engine, 10000);
      engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      engine.start();
      engine.update(1000); // 1 second
      const res = engine.getResource(RESOURCE_IDS.SPICE);
      expect(res!.amount).toBeGreaterThan(0);
    });

    it('未 playing 时 update 不应增加资源', () => {
      addSpice(engine, 10000);
      engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      // engine is idle, not playing
      const before = engine.getResource(RESOURCE_IDS.SPICE)!.amount;
      engine.update(1000);
      const after = engine.getResource(RESOURCE_IDS.SPICE)!.amount;
      expect(after).toBe(before);
    });
  });

  // ================================================================
  // 16. 边界情况 (8 tests)
  // ================================================================
  describe('边界情况', () => {
    it('购买不存在的建筑应失败', () => {
      expect(engine.purchaseBuilding('non-existent')).toBe(false);
    });

    it('解锁不存在的种姓应失败', () => {
      expect(engine.unlockCaste('non-existent')).toBe(false);
    });

    it('解锁不存在的佛法应失败', () => {
      expect(engine.unlockDharma('non-existent')).toBe(false);
    });

    it('进化不存在的佛法应失败', () => {
      expect(engine.evolveDharma('non-existent')).toBe(false);
    });

    it('进化等级达到上限后应失败', () => {
      // Manually set meditation evolution to max
      addGem(engine, 1e6);
      addKarma(engine, 1e6);
      addSpice(engine, 1e9);
      for (let i = 0; i < MAX_EVOLUTION_LEVEL; i++) {
        engine.evolveDharma('meditation');
      }
      const result = engine.evolveDharma('meditation');
      expect(result).toBe(false);
    });

    it('castes getter 应返回副本而非引用', () => {
      const c1 = engine.castes;
      const c2 = engine.castes;
      expect(c1).not.toBe(c2); // different array instances
    });

    it('dharmas getter 应返回副本而非引用', () => {
      const d1 = engine.dharmas;
      const d2 = engine.dharmas;
      expect(d1).not.toBe(d2);
    });

    it('已解锁种姓再次解锁应失败', () => {
      expect(engine.unlockCaste('sudra')).toBe(false);
    });

    it('spendResource 不存在的资源应返回 false', () => {
      expect(engine.spendResource('nonexistent', 10)).toBe(false);
    });

    it('addResource 不存在的资源应无效果', () => {
      expect(() => engine.addResource('nonexistent', 10)).not.toThrow();
    });

    it('canAfford 空费用应返回 true', () => {
      expect(engine.canAfford({})).toBe(true);
    });

    it('formatNumber 应处理负数', () => {
      const result = engine.formatNumber(-1500);
      expect(result).toBe('-1.5K');
    });

    it('formatNumber 应处理零', () => {
      const result = engine.formatNumber(0);
      expect(result).toBe('0');
    });

    it('formatNumber 应处理十亿', () => {
      const result = engine.formatNumber(2500000000);
      expect(result).toBe('2.5B');
    });

    it('formatNumber 应处理万亿', () => {
      const result = engine.formatNumber(3e12);
      expect(result).toBe('3T');
    });

    it('formatNumber 应处理无穷大', () => {
      const result = engine.formatNumber(Infinity);
      expect(result).toBe('∞');
    });

    it('formatNumber 应处理小数', () => {
      const result = engine.formatNumber(1.5);
      expect(result).toBe('1.5');
    });

    it('pause 在非 playing 状态应无效果', () => {
      // idle state
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('resume 在非 paused 状态应无效果', () => {
      engine.start();
      engine.resume(); // already playing, not paused
      expect(engine.status).toBe('playing');
    });

    it('handleKeyDown 在非 playing 状态应无效果', () => {
      // idle state
      engine.handleKeyDown(' ');
      expect(engine.totalClicks).toBe(0);
    });

    it('handleKeyDown Enter 应购买当前选中建筑', () => {
      engine.start();
      addSpice(engine, 1000);
      engine.handleKeyDown('Enter');
      // Should have purchased spice garden (index 0)
      const state = engine.getState();
      expect(state.buildings[BUILDING_IDS.SPICE_GARDEN]).toBe(1);
    });

    it('handleKeyDown P 应触发涅槃', () => {
      engine.start();
      // Not enough spice earned, should not throw
      expect(() => engine.handleKeyDown('p')).not.toThrow();
    });

    it('handleKeyDown E 应进化佛法', () => {
      engine.start();
      addGem(engine, 100);
      addKarma(engine, 100);
      addSpice(engine, 1000);
      engine.handleKeyDown('e');
      const meditation = engine.dharmas.find(d => d.id === 'meditation');
      expect(meditation!.evolutionLevel).toBe(1);
    });

    it('selectedIndex 不应低于 0', () => {
      engine.start();
      engine.handleKeyDown('ArrowUp'); // already at 0
      expect(engine.selectedIndex).toBe(0);
    });

    it('selectedIndex 不应超过建筑数', () => {
      engine.start();
      for (let i = 0; i < 20; i++) {
        engine.handleKeyDown('ArrowDown');
      }
      expect(engine.selectedIndex).toBeLessThan(BUILDINGS.length);
    });

    it('多次购买不同建筑应各自独立计费', () => {
      addSpice(engine, 100000);
      // Buy spice garden
      const result1 = engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      expect(result1).toBe(true);
      // Unlock stupa via update cycle
      engine.start();
      engine.update(16);
      engine.pause(); // pause to prevent resource drain
      // Now buy stupa — it should have its own cost
      const cost = engine.getUpgradeCost(BUILDING_IDS.STUPA);
      expect(Object.keys(cost)).toHaveLength(1); // only spice
      expect(cost[RESOURCE_IDS.SPICE]).toBeGreaterThan(0);
    });

    it('loadState 应恢复 selectedIndex', () => {
      const state = engine.getState();
      state.selectedIndex = 3;
      engine.loadState(state);
      expect(engine.selectedIndex).toBe(3);
    });

    it('loadState 应恢复声望数据', () => {
      const state = engine.getState();
      state.prestige = { currency: 5, count: 2 };
      engine.loadState(state);
      const newState = engine.getState();
      expect(newState.prestige).toEqual({ currency: 5, count: 2 });
    });

    it('save/load 应保持种姓数据', () => {
      addSpice(engine, 800);
      engine.unlockCaste('vaisya');
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      const vaisya = newEngine.castes.find(c => c.id === 'vaisya');
      expect(vaisya!.unlocked).toBe(true);
    });

    it('save/load 应保持佛法进化数据', () => {
      addGem(engine, 100);
      addKarma(engine, 100);
      addSpice(engine, 1000);
      engine.evolveDharma('meditation');
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      const meditation = newEngine.dharmas.find(d => d.id === 'meditation');
      expect(meditation!.evolutionLevel).toBe(1);
    });

    it('getEvolutionCost 应返回正确的费用', () => {
      const cost1 = engine.getEvolutionCost(1);
      expect(cost1).toEqual(EVOLUTION_COSTS[1]);
      const costInvalid = engine.getEvolutionCost(99);
      expect(Object.keys(costInvalid)).toHaveLength(0);
    });

    it('canPrestige 在 totalSpiceEarned 不足时应返回 false', () => {
      expect(engine.canPrestige()).toBe(false);
    });

    it('getPrestigePreview 在不足时应返回 0', () => {
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('getPrestigeMultiplier 无涅槃点时应为 1', () => {
      expect(engine.getPrestigeMultiplier()).toBe(1);
    });

    it('getPrestigeMultiplier 有涅槃点时应大于 1', () => {
      const state = engine.getState();
      state.prestige = { currency: 5, count: 1 };
      engine.loadState(state);
      expect(engine.getPrestigeMultiplier()).toBeGreaterThan(1);
    });

    it('getDharmaEvolutionLevel 应返回正确等级', () => {
      expect(engine.getDharmaEvolutionLevel('meditation')).toBe(0);
      expect(engine.getDharmaEvolutionLevel('nonexistent')).toBe(0);
    });

    it('getBuildingLevel 应返回正确等级', () => {
      expect(engine.getBuildingLevel(0)).toBe(0);
      addSpice(engine, 1000);
      engine.purchaseBuilding(BUILDING_IDS.SPICE_GARDEN);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('getBuildingLevel 无效索引应返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(999)).toBe(0);
    });

    it('getBuildingCost 无效索引应返回空对象', () => {
      expect(Object.keys(engine.getBuildingCost(-1))).toHaveLength(0);
      expect(Object.keys(engine.getBuildingCost(999))).toHaveLength(0);
    });

    it('解锁吠舍后应能继续解锁刹帝利', () => {
      addSpice(engine, 10000);
      engine.unlockCaste('vaisya');
      const result = engine.unlockCaste('kshatriya');
      expect(result).toBe(true);
    });

    it('解锁布施佛法应扣除业力', () => {
      addKarma(engine, 500);
      const karmaBefore = engine.getResource(RESOURCE_IDS.KARMA)!.amount;
      engine.unlockDharma('dana');
      const karmaAfter = engine.getResource(RESOURCE_IDS.KARMA)!.amount;
      expect(karmaAfter).toBeLessThan(karmaBefore);
    });

    it('进化佛法应扣除多种资源', () => {
      addGem(engine, 100);
      addKarma(engine, 100);
      addSpice(engine, 1000);
      const gemBefore = engine.getResource(RESOURCE_IDS.GEM)!.amount;
      const karmaBefore = engine.getResource(RESOURCE_IDS.KARMA)!.amount;
      engine.evolveDharma('meditation');
      expect(engine.getResource(RESOURCE_IDS.GEM)!.amount).toBeLessThan(gemBefore);
      expect(engine.getResource(RESOURCE_IDS.KARMA)!.amount).toBeLessThan(karmaBefore);
    });

    it('转生应增加声望计数', () => {
      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 4,
      };
      engine.loadState(state);

      const stateBefore = engine.getState();
      const countBefore = stateBefore.prestige.count;
      engine.doPrestige();
      const stateAfter = engine.getState();
      expect(stateAfter.prestige.count).toBe(countBefore + 1);
    });

    it('资源不应超过 maxAmount', () => {
      // Spice maxAmount is 1e15
      addSpice(engine, 2e15);
      const res = engine.getResource(RESOURCE_IDS.SPICE);
      expect(res!.amount).toBeLessThanOrEqual(1e15);
    });

    it('click 在 paused 状态应返回 0', () => {
      engine.start();
      engine.pause();
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('初始化后冥想佛法进化等级应为 0', () => {
      const meditation = engine.dharmas.find(d => d.id === 'meditation');
      expect(meditation!.evolutionLevel).toBe(0);
    });

    it('初始化后所有佛法中只有冥想已解锁', () => {
      const unlocked = engine.dharmas.filter(d => d.unlocked);
      expect(unlocked).toHaveLength(1);
      expect(unlocked[0].id).toBe('meditation');
    });

    it('种姓列表应包含所有 4 个种姓 ID', () => {
      const ids = engine.castes.map(c => c.id);
      expect(ids).toContain('sudra');
      expect(ids).toContain('vaisya');
      expect(ids).toContain('kshatriya');
      expect(ids).toContain('brahmin');
    });

    it('佛法列表应包含所有 6 个佛法 ID', () => {
      const ids = engine.dharmas.map(d => d.id);
      expect(ids).toContain('meditation');
      expect(ids).toContain('dana');
      expect(ids).toContain('ksanti');
      expect(ids).toContain('virya');
      expect(ids).toContain('dhyana');
      expect(ids).toContain('prajna');
    });

    it('getUnlockedResources 初始只有香料', () => {
      const unlocked = engine.getUnlockedResources();
      expect(unlocked).toHaveLength(1);
      expect(unlocked[0].id).toBe(RESOURCE_IDS.SPICE);
    });

    it('NIRVANA_BONUS_MULTIPLIER 应为 0.12', () => {
      expect(NIRVANA_BONUS_MULTIPLIER).toBe(0.12);
    });

    it('MAX_EVOLUTION_LEVEL 应为 5', () => {
      expect(MAX_EVOLUTION_LEVEL).toBe(5);
    });

    it('EVOLUTION_COSTS 应有 5 个等级', () => {
      expect(Object.keys(EVOLUTION_COSTS)).toHaveLength(5);
    });

    it('EVOLUTION_COSTS 等级 1 应包含 gem 和 karma', () => {
      expect(EVOLUTION_COSTS[1]).toBeDefined();
      expect(EVOLUTION_COSTS[1].gem).toBeDefined();
      expect(EVOLUTION_COSTS[1].karma).toBeDefined();
    });

    it('BUILDING_IDS 应包含所有 8 个建筑 ID', () => {
      expect(Object.keys(BUILDING_IDS)).toHaveLength(8);
      expect(BUILDING_IDS.SPICE_GARDEN).toBeDefined();
      expect(BUILDING_IDS.STUPA).toBeDefined();
      expect(BUILDING_IDS.GANGES_IRRIGATION).toBeDefined();
      expect(BUILDING_IDS.YOGA_STUDIO).toBeDefined();
      expect(BUILDING_IDS.GEM_MINE).toBeDefined();
      expect(BUILDING_IDS.TEMPLE).toBeDefined();
      expect(BUILDING_IDS.MONASTERY).toBeDefined();
      expect(BUILDING_IDS.ASHOKA_PILLAR).toBeDefined();
    });

    it('所有建筑都应有正的 costMultiplier', () => {
      for (const b of BUILDINGS) {
        expect(b.costMultiplier).toBeGreaterThan(1);
      }
    });

    it('所有建筑都应有正的 baseProduction', () => {
      for (const b of BUILDINGS) {
        expect(b.baseProduction).toBeGreaterThan(0);
      }
    });

    it('所有种姓都应有 unlockCost >= 0', () => {
      for (const c of CASTES) {
        expect(c.unlockCost).toBeGreaterThanOrEqual(0);
      }
    });

    it('所有佛法都应有 unlockCost >= 0', () => {
      for (const d of DHARMAS) {
        expect(d.unlockCost).toBeGreaterThanOrEqual(0);
      }
    });

    it('解锁吠舍种姓应触发 casteUnlocked 事件', () => {
      const listener = vi.fn();
      engine.on('casteUnlocked', listener);
      addSpice(engine, 800);
      engine.unlockCaste('vaisya');
      expect(listener).toHaveBeenCalledWith('vaisya');
    });

    it('解锁佛法应触发 dharmaUnlocked 事件', () => {
      const listener = vi.fn();
      engine.on('dharmaUnlocked', listener);
      addKarma(engine, 200);
      engine.unlockDharma('dana');
      expect(listener).toHaveBeenCalledWith('dana');
    });

    it('进化佛法应触发 dharmaEvolved 事件', () => {
      const listener = vi.fn();
      engine.on('dharmaEvolved', listener);
      addGem(engine, 100);
      addKarma(engine, 100);
      addSpice(engine, 1000);
      engine.evolveDharma('meditation');
      expect(listener).toHaveBeenCalledWith('meditation', 1);
    });

    it('转生应触发 prestige 事件', () => {
      const listener = vi.fn();
      engine.on('prestige', listener);
      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 2,
      };
      engine.loadState(state);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toBeGreaterThan(0);
    });

    it('getPrestigePreview 在充足时应返回正数', () => {
      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE * 4,
      };
      engine.loadState(state);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('canPrestige 在充足时应返回 true', () => {
      const state = engine.getState();
      state.statistics = {
        ...(state.statistics as any),
        totalSpiceEarned: MIN_PRESTIGE_SPICE,
      };
      engine.loadState(state);
      expect(engine.canPrestige()).toBe(true);
    });

    it('建筑 ID 应使用下划线命名', () => {
      // Verify building IDs match the BUILDINGS array
      for (const b of BUILDINGS) {
        expect(b.id).toMatch(/^[a-z_]+$/);
      }
    });

    it('种姓解锁顺序应从低到高', () => {
      const costs = CASTES.map(c => c.unlockCost);
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1]);
      }
    });
  });
});
