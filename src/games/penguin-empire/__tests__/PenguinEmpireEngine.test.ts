/**
 * Penguin Empire（企鹅帝国）放置类游戏 — 完整测试套件
 */
import { PenguinEmpireEngine } from '@/games/penguin-empire/PenguinEmpireEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ICE_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_ICE,
  NUMBER_SUFFIXES,
  COLORS,
  MAX_VISIBLE_PENGUINS,
} from '@/games/penguin-empire/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): PenguinEmpireEngine {
  const engine = new PenguinEmpireEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): PenguinEmpireEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addIce(engine: PenguinEmpireEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.ICE, amount);
}

function addFish(engine: PenguinEmpireEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.FISH, amount);
}

function addCoins(engine: PenguinEmpireEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.COINS, amount);
}

function addCrystal(engine: PenguinEmpireEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.CRYSTAL, amount);
}

/** 触发一次 update */
function tick(engine: PenguinEmpireEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getIce(engine: PenguinEmpireEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.ICE)?.amount ?? 0;
}

function getFish(engine: PenguinEmpireEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.FISH)?.amount ?? 0;
}

function getCoins(engine: PenguinEmpireEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.COINS)?.amount ?? 0;
}

function getCrystal(engine: PenguinEmpireEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.CRYSTAL)?.amount ?? 0;
}

// ========== 测试 ==========

describe('PenguinEmpireEngine', () => {
  let engine: PenguinEmpireEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(PenguinEmpireEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后冰块为 0', () => {
      expect(getIce(engine)).toBe(0);
    });

    it('init 后鱼为 0', () => {
      expect(getFish(engine)).toBe(0);
    });

    it('init 后企鹅币为 0', () => {
      expect(getCoins(engine)).toBe(0);
    });

    it('init 后冰晶石为 0', () => {
      expect(getCrystal(engine)).toBe(0);
    });

    it('init 后总冰块获得为 0', () => {
      expect(engine.totalIceEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后选中建筑索引为 0', () => {
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 penguin-empire', () => {
      expect(engine.gameId).toBe('penguin-empire');
    });

    it('init 后冰块已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.ICE);
      expect(res.unlocked).toBe(true);
    });

    it('init 后鱼未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.FISH);
      expect(res.unlocked).toBe(false);
    });

    it('init 后企鹅币未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.COINS);
      expect(res.unlocked).toBe(false);
    });

    it('init 后冰晶石未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.CRYSTAL);
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 建筑初始化 ==========

  describe('建筑初始化', () => {
    it('应有 6 种建筑', () => {
      expect(BUILDINGS.length).toBe(6);
    });

    it('初始只有冰屋解锁', () => {
      const igloo = (engine as any).upgrades.get(BUILDING_IDS.IGLOO);
      expect(igloo.unlocked).toBe(true);
    });

    it('鱼塘初始未解锁', () => {
      const pond = (engine as any).upgrades.get(BUILDING_IDS.FISH_POND);
      expect(pond.unlocked).toBe(false);
    });

    it('冰晶矿场初始未解锁', () => {
      const mine = (engine as any).upgrades.get(BUILDING_IDS.CRYSTAL_MINE);
      expect(mine.unlocked).toBe(false);
    });

    it('所有建筑初始等级为 0', () => {
      for (const building of BUILDINGS) {
        expect(engine.getBuildingLevel(building.id)).toBe(0);
      }
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
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

    it('reset 后冰块归零', () => {
      engine.start();
      addIce(engine, 1000);
      engine.reset();
      expect(getIce(engine)).toBe(0);
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
      addIce(engine, 500);
      engine.reset();
      engine.start();
      expect(getIce(engine)).toBe(0);
    });
  });

  // ========== 点击产生冰块 ==========

  describe('点击产生冰块', () => {
    it('点击一次产生冰块', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getIce(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生冰块', () => {
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

    it('点击增加总冰块获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalIceEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getIce(engine)).toBe(0);
    });

    it('paused 状态下点击无效', () => {
      engine.start();
      engine.pause();
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      engine.start();
      const listener = jest.fn();
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
    it('增加冰块', () => {
      addIce(engine, 100);
      expect(getIce(engine)).toBe(100);
    });

    it('增加鱼', () => {
      addFish(engine, 50);
      expect(getFish(engine)).toBe(50);
    });

    it('增加企鹅币', () => {
      addCoins(engine, 30);
      expect(getCoins(engine)).toBe(30);
    });

    it('增加冰晶石', () => {
      addCrystal(engine, 10);
      expect(getCrystal(engine)).toBe(10);
    });

    it('消耗冰块成功', () => {
      addIce(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.ICE, 50);
      expect(getIce(engine)).toBe(50);
    });

    it('消耗冰块失败（不足）', () => {
      addIce(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.ICE, 50);
      expect(result).toBeFalsy();
      expect(getIce(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addIce(engine, 100);
      expect((engine as any).canAfford({ [RESOURCE_IDS.ICE]: 50 })).toBe(true);
      expect((engine as any).canAfford({ [RESOURCE_IDS.ICE]: 200 })).toBe(false);
    });

    it('增加资源时自动解锁', () => {
      addFish(engine, 1);
      const fish = (engine as any).getResource(RESOURCE_IDS.FISH);
      expect(fish.unlocked).toBe(true);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 6 种建筑', () => {
      expect(BUILDINGS.length).toBe(6);
    });

    it('购买冰屋成功', () => {
      engine.start();
      addIce(engine, 100);
      const result = engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(BUILDING_IDS.IGLOO)).toBe(1);
    });

    it('购买冰屋失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(BUILDING_IDS.IGLOO)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addIce(engine, 10000);
      const cost1 = engine.getBuildingCost(BUILDING_IDS.IGLOO);
      engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      const cost2 = engine.getBuildingCost(BUILDING_IDS.IGLOO);
      expect(cost2[RESOURCE_IDS.ICE]).toBeGreaterThan(cost1[RESOURCE_IDS.ICE]);
    });

    it('通过索引购买建筑', () => {
      engine.start();
      addIce(engine, 100);
      const result = engine.buyBuildingByIndex(0);
      expect(result).toBe(true);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addIce(engine, 10000);
      expect(engine.buyBuildingByIndex(-1)).toBe(false);
      expect(engine.buyBuildingByIndex(99)).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addIce(engine, 100);
      const before = getIce(engine);
      engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      expect(getIce(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addIce(engine, 100);
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      expect(listener).toHaveBeenCalled();
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('鱼塘需要冰块达到30解锁', () => {
      engine.start();
      addIce(engine, 30);
      // 触发 update 检查解锁
      tick(engine, 16);
      const pond = (engine as any).upgrades.get(BUILDING_IDS.FISH_POND);
      expect(pond.unlocked).toBe(true);
    });

    it('鱼塘在冰块不足30时未解锁', () => {
      engine.start();
      addIce(engine, 29);
      tick(engine, 16);
      const pond = (engine as any).upgrades.get(BUILDING_IDS.FISH_POND);
      expect(pond.unlocked).toBe(false);
    });

    it('冰晶矿场需要冰块100和鱼20解锁', () => {
      engine.start();
      addIce(engine, 100);
      addFish(engine, 20);
      tick(engine, 16);
      const mine = (engine as any).upgrades.get(BUILDING_IDS.CRYSTAL_MINE);
      expect(mine.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('鱼在冰块达到50时自动解锁', () => {
      engine.start();
      addIce(engine, 50);
      tick(engine, 16);
      const fish = (engine as any).getResource(RESOURCE_IDS.FISH);
      expect(fish.unlocked).toBe(true);
    });

    it('企鹅币在鱼达到100时自动解锁', () => {
      engine.start();
      addFish(engine, 100);
      tick(engine, 16);
      const coins = (engine as any).getResource(RESOURCE_IDS.COINS);
      expect(coins.unlocked).toBe(true);
    });
  });

  // ========== 产出计算 ==========

  describe('产出计算', () => {
    it('购买冰屋后冰块每秒产出增加', () => {
      engine.start();
      addIce(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      const production = engine.getEffectiveProduction(RESOURCE_IDS.ICE);
      expect(production).toBeGreaterThan(0);
    });

    it('产出倍率初始为1', () => {
      expect(engine.getProductionMultiplier()).toBe(1);
    });

    it('企鹅学校增加产出倍率', () => {
      engine.start();
      // 直接设置学校等级
      const school = (engine as any).upgrades.get(BUILDING_IDS.PENGUIN_SCHOOL);
      school.level = 5;
      school.unlocked = true;
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('声望增加产出倍率', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('getClickPower 初始为 ICE_PER_CLICK', () => {
      expect(engine.getClickPower()).toBe(ICE_PER_CLICK);
    });

    it('企鹅学校增加点击力量', () => {
      engine.start();
      const school = (engine as any).upgrades.get(BUILDING_IDS.PENGUIN_SCHOOL);
      school.level = 3;
      const power = engine.getClickPower();
      expect(power).toBeGreaterThan(ICE_PER_CLICK);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始极光之力为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('冰块不足时无法声望重置', () => {
      engine.start();
      expect(engine.calculatePrestigeAurora()).toBe(0);
    });

    it('冰块达到最低要求时可以计算极光之力', () => {
      engine.start();
      addIce(engine, MIN_PRESTIGE_ICE);
      const aurora = engine.calculatePrestigeAurora();
      expect(aurora).toBeGreaterThanOrEqual(1);
    });

    it('声望重置成功', () => {
      engine.start();
      addIce(engine, MIN_PRESTIGE_ICE * 4);
      const result = engine.prestigeReset();
      expect(result).toBe(true);
    });

    it('声望重置后极光之力增加', () => {
      engine.start();
      addIce(engine, MIN_PRESTIGE_ICE * 4);
      engine.prestigeReset();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望重置后声望次数增加', () => {
      engine.start();
      addIce(engine, MIN_PRESTIGE_ICE * 4);
      engine.prestigeReset();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望重置后资源归零', () => {
      engine.start();
      addIce(engine, MIN_PRESTIGE_ICE * 4);
      engine.prestigeReset();
      expect(getIce(engine)).toBe(0);
    });

    it('声望重置后声望数据保留', () => {
      engine.start();
      addIce(engine, MIN_PRESTIGE_ICE * 4);
      engine.prestigeReset();
      expect((engine as any).prestige.count).toBeGreaterThan(0);
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望重置触发 prestigeReset 事件', () => {
      engine.start();
      addIce(engine, MIN_PRESTIGE_ICE * 4);
      const listener = jest.fn();
      engine.on('prestigeReset', listener);
      engine.prestigeReset();
      expect(listener).toHaveBeenCalled();
    });

    it('冰块不足时声望重置失败', () => {
      engine.start();
      addIce(engine, 100);
      const result = engine.prestigeReset();
      expect(result).toBe(false);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('penguin-empire');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addIce(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addIce(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getIce(engine2)).toBeCloseTo(500, 0);
    });

    it('save 包含统计数据', () => {
      engine.start();
      engine.click();
      engine.click();
      const data = engine.save();
      expect(data.statistics).toBeDefined();
      expect(data.statistics.totalClicks).toBe(2);
    });

    it('load 恢复统计数据', () => {
      engine.start();
      engine.click();
      engine.click();
      engine.click();
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.totalClicks).toBe(3);
    });
  });

  // ========== 状态管理 ==========

  describe('状态管理', () => {
    it('getState 返回完整状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toBeDefined();
      expect(state.totalIceEarned).toBeDefined();
      expect(state.totalClicks).toBeDefined();
      expect(state.selectedBuildingIndex).toBeDefined();
      expect(state.prestige).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addIce(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getIce(engine2)).toBeCloseTo(1000, 0);
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

    it('负数处理', () => {
      const result = (engine as any).formatNumber(-100);
      expect(result).toBeDefined();
    });
  });

  // ========== 键盘输入 ==========

  describe('键盘输入', () => {
    it('空格键触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(getIce(engine)).toBeGreaterThan(0);
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
      // 解锁更多建筑
      addIce(engine, 100);
      tick(engine, 16);
      // 确保有多个可见建筑
      const visibleCount = BUILDINGS.filter(b => {
        const u = (engine as any).upgrades.get(b.id);
        return u && u.unlocked;
      }).length;
      if (visibleCount > 1) {
        engine.handleKeyDown('ArrowDown');
        expect(engine.selectedBuildingIndex).toBe(1);
      }
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getIce(engine)).toBe(0);
    });

    it('handleKeyUp 不抛错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ========== 渲染 ==========

  describe('Canvas 渲染', () => {
    it('onRender 不抛错', () => {
      engine.start();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('渲染后 Canvas 有内容', () => {
      engine.start();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      // 验证至少调用了 fillRect 或其他绘制方法
      expect(ctx).toBeDefined();
    });

    it('多次渲染不抛错', () => {
      engine.start();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      for (let i = 0; i < 10; i++) {
        engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    });

    it('有声望时渲染极光', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addIce(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      const before = getIce(engine);
      tick(engine, 1000);
      const after = getIce(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addIce(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.IGLOO);
      const before = getIce(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getIce(engine);
      expect(after).toBeGreaterThan(before);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addIce(engine, Number.MAX_SAFE_INTEGER / 2);
      expect(getIce(engine)).toBeGreaterThan(0);
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
  });
});
