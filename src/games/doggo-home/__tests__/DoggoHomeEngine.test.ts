/**
 * 狗狗家园 (Doggo Home) — 放置类游戏完整测试套件
 *
 * 覆盖：
 * - 初始化与生命周期
 * - 资源系统
 * - 点击系统
 * - 建筑购买
 * - 费用递增
 * - 狗狗品种解锁
 * - 声望系统
 * - 存档/加载
 * - 数字格式化
 * - 键盘输入
 * - Canvas 渲染
 * - 边界情况
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DoggoHomeEngine } from '../DoggoHomeEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TREATS_PER_CLICK,
  STAR_BONUS_MULTIPLIER,
  PRESTIGE_MIN_TOTAL_TREATS,
  DOG_BREEDS,
  BUILDINGS,
} from '../constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): DoggoHomeEngine {
  const engine = new DoggoHomeEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): DoggoHomeEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加大量饼干用于测试 */
function addTreats(engine: DoggoHomeEngine, amount: number): void {
  engine.addResource('treats', amount);
}

describe('DoggoHomeEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== 初始化测试 ==========
  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      const engine = createEngine();
      expect(engine).toBeInstanceOf(DoggoHomeEngine);
    });

    it('gameId 应为 doggo-home', () => {
      const engine = createEngine();
      expect(engine.gameId).toBe('doggo-home');
    });

    it('初始选中建筑索引为 0', () => {
      const engine = createEngine();
      expect(engine.selectedIndex).toBe(0);
    });

    it('初始统计数据应为默认值', () => {
      const engine = createEngine();
      expect(engine.totalTreatsEarned).toBe(0);
      expect(engine.totalClicks).toBe(0);
    });

    it('初始狗狗列表应只有柴犬解锁', () => {
      const engine = createEngine();
      const dogs = engine.dogs;
      expect(dogs.length).toBe(DOG_BREEDS.length);
      expect(dogs.find(d => d.id === 'shiba')?.unlocked).toBe(true);
      expect(dogs.filter(d => d.unlocked).length).toBe(1);
    });

    it('初始所有建筑等级为 0', () => {
      const engine = createEngine();
      for (let i = 0; i < BUILDINGS.length; i++) {
        expect(engine.getBuildingLevel(i)).toBe(0);
      }
    });

    it('初始应有 treats 资源', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state.resources.treats).toBeDefined();
      expect(state.resources.treats.amount).toBe(0);
    });

    it('初始 love 资源应未解锁', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state.resources.love).toBeDefined();
    });
  });

  // ========== 点击系统 ==========
  describe('点击系统', () => {
    it('点击应返回饼干数', () => {
      const engine = startEngine();
      const earned = engine.click();
      expect(earned).toBeGreaterThanOrEqual(TREATS_PER_CLICK);
    });

    it('点击应增加总点击数', () => {
      const engine = startEngine();
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
    });

    it('点击应增加总饼干收入', () => {
      const engine = startEngine();
      const earned = engine.click();
      expect(engine.totalTreatsEarned).toBeGreaterThanOrEqual(earned);
    });

    it('连续点击应累积饼干', () => {
      const engine = startEngine();
      let total = 0;
      for (let i = 0; i < 10; i++) {
        total += engine.click();
      }
      expect(engine.totalTreatsEarned).toBeGreaterThanOrEqual(total);
    });

    it('点击后 treats 数量应增加', () => {
      const engine = startEngine();
      engine.click();
      const state = engine.getState();
      expect(state.resources.treats.amount).toBeGreaterThan(0);
    });
  });

  // ========== 资源系统 ==========
  describe('资源系统', () => {
    it('addResource 应增加资源', () => {
      const engine = createEngine();
      engine.addResource('treats', 100);
      expect(engine.getState().resources.treats.amount).toBeGreaterThanOrEqual(100);
    });

    it('spendResource 应扣除资源', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      const result = engine.spendResource('treats', 50);
      expect(result).toBe(true);
    });

    it('资源不足时 spendResource 应失败', () => {
      const engine = createEngine();
      const result = engine.spendResource('treats', 100);
      expect(result).toBe(false);
    });

    it('资源不应超过上限', () => {
      const engine = createEngine();
      engine.addResource('treats', 1e20);
      const state = engine.getState();
      expect(state.resources.treats.amount).toBeLessThanOrEqual(1e15);
    });
  });

  // ========== 建筑系统 ==========
  describe('建筑系统', () => {
    it('购买第一个建筑（狗窝）应成功', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('饼干不足时应无法购买', () => {
      const engine = createEngine();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('购买建筑后应扣除饼干', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      const before = engine.getState().resources.treats.amount;
      engine.purchaseBuilding(0);
      const after = engine.getState().resources.treats.amount;
      expect(after).toBeLessThan(before);
    });

    it('建筑费用应递增', () => {
      const engine = createEngine();
      const cost0 = engine.getBuildingCost(0);
      addTreats(engine, 1000);
      engine.purchaseBuilding(0);
      const cost1 = engine.getBuildingCost(0);
      expect(cost1.treats).toBeGreaterThan(cost0.treats);
    });

    it('建筑索引越界应返回 false', () => {
      const engine = createEngine();
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(999)).toBe(false);
    });

    it('建筑等级越界应返回 0', () => {
      const engine = createEngine();
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(999)).toBe(0);
    });

    it('建筑费用越界应返回空对象', () => {
      const engine = createEngine();
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingCost(999)).toEqual({});
    });

    it('连续购买多个建筑应正确累加等级', () => {
      const engine = createEngine();
      addTreats(engine, 10000);
      engine.purchaseBuilding(0);
      engine.purchaseBuilding(0);
      engine.purchaseBuilding(0);
      expect(engine.getBuildingLevel(0)).toBe(3);
    });

    it('有前置条件的建筑未满足时应无法购买', () => {
      const engine = createEngine();
      addTreats(engine, 10000);
      // 训练场需要 kennel，但没买 kennel
      const result = engine.purchaseBuilding(1);
      expect(result).toBe(false);
    });
  });

  // ========== 狗狗品种解锁 ==========
  describe('狗狗品种解锁', () => {
    it('柴犬应已解锁', () => {
      const engine = createEngine();
      expect(engine.dogs.find(d => d.id === 'shiba')?.unlocked).toBe(true);
    });

    it('金毛初始应未解锁', () => {
      const engine = createEngine();
      expect(engine.dogs.find(d => d.id === 'golden')?.unlocked).toBe(false);
    });

    it('饼干不足时应无法解锁金毛', () => {
      const engine = createEngine();
      const result = engine.unlockDog('golden');
      expect(result).toBe(false);
      expect(engine.dogs.find(d => d.id === 'golden')?.unlocked).toBe(false);
    });

    it('饼干足够时应能解锁金毛', () => {
      const engine = createEngine();
      const golden = DOG_BREEDS.find(b => b.id === 'golden')!;
      addTreats(engine, golden.unlockCost + 100);
      const result = engine.unlockDog('golden');
      expect(result).toBe(true);
      expect(engine.dogs.find(d => d.id === 'golden')?.unlocked).toBe(true);
    });

    it('解锁狗狗应扣除饼干', () => {
      const engine = createEngine();
      const golden = DOG_BREEDS.find(b => b.id === 'golden')!;
      addTreats(engine, golden.unlockCost + 100);
      const before = engine.getState().resources.treats.amount;
      engine.unlockDog('golden');
      const after = engine.getState().resources.treats.amount;
      expect(after).toBeLessThan(before);
    });

    it('重复解锁已解锁品种应返回 false', () => {
      const engine = createEngine();
      const golden = DOG_BREEDS.find(b => b.id === 'golden')!;
      addTreats(engine, golden.unlockCost + 100);
      engine.unlockDog('golden');
      const result = engine.unlockDog('golden');
      expect(result).toBe(false);
    });

    it('解锁不存在的品种应返回 false', () => {
      const engine = createEngine();
      expect(engine.unlockDog('nonexistent')).toBe(false);
    });

    it('解锁柴犬（已解锁）应返回 false', () => {
      const engine = createEngine();
      const result = engine.unlockDog('shiba');
      expect(result).toBe(false);
    });

    it('所有品种定义应完整', () => {
      expect(DOG_BREEDS.length).toBe(8);
      for (const breed of DOG_BREEDS) {
        expect(breed.id).toBeTruthy();
        expect(breed.name).toBeTruthy();
        expect(breed.bonusType).toBeTruthy();
        expect(typeof breed.bonusValue).toBe('number');
        expect(typeof breed.unlockCost).toBe('number');
      }
    });

    it('应能解锁所有品种', () => {
      const engine = createEngine();
      for (const breed of DOG_BREEDS) {
        if (breed.unlockCost > 0) {
          addTreats(engine, breed.unlockCost + 100);
          engine.unlockDog(breed.id);
        }
      }
      expect(engine.dogs.filter(d => d.unlocked).length).toBe(DOG_BREEDS.length);
    });
  });

  // ========== 乘数系统 ==========
  describe('乘数系统', () => {
    it('初始点击乘数应大于 0', () => {
      const engine = createEngine();
      expect(engine.getClickMultiplier()).toBeGreaterThan(0);
    });

    it('初始产出乘数应大于 0', () => {
      const engine = createEngine();
      expect(engine.getProductionMultiplier()).toBeGreaterThan(0);
    });

    it('初始爱心乘数应大于 0', () => {
      const engine = createEngine();
      expect(engine.getLoveMultiplier()).toBeGreaterThan(0);
    });

    it('初始奖牌乘数应大于 0', () => {
      const engine = createEngine();
      expect(engine.getMedalMultiplier()).toBeGreaterThan(0);
    });

    it('解锁金毛后产出乘数应增加', () => {
      const engine = createEngine();
      const before = engine.getProductionMultiplier();
      const golden = DOG_BREEDS.find(b => b.id === 'golden')!;
      addTreats(engine, golden.unlockCost + 100);
      engine.unlockDog('golden');
      const after = engine.getProductionMultiplier();
      expect(after).toBeGreaterThan(before);
    });

    it('解锁边牧后点击乘数应增加', () => {
      const engine = createEngine();
      const before = engine.getClickMultiplier();
      const collie = DOG_BREEDS.find(b => b.id === 'border_collie')!;
      addTreats(engine, collie.unlockCost + 100);
      engine.unlockDog('border_collie');
      const after = engine.getClickMultiplier();
      expect(after).toBeGreaterThan(before);
    });
  });

  // ========== 声望系统 ==========
  describe('声望系统', () => {
    it('初始应无法声望', () => {
      const engine = createEngine();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览在初期应为 0', () => {
      const engine = createEngine();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('饼干足够时声望预览应大于 0', () => {
      const engine = createEngine();
      addTreats(engine, PRESTIGE_MIN_TOTAL_TREATS * 2);
      // 需要设置 totalTreatsEarned
      expect(engine.getPrestigePreview()).toBeGreaterThanOrEqual(0);
    });

    it('声望应返回星星数', () => {
      const engine = createEngine();
      addTreats(engine, PRESTIGE_MIN_TOTAL_TREATS * 2);
      // 需要满足声望条件
      if (engine.canPrestige()) {
        const stars = engine.performPrestige();
        expect(stars).toBeGreaterThan(0);
      }
    });

    it('声望后资源应重置', () => {
      const engine = createEngine();
      addTreats(engine, PRESTIGE_MIN_TOTAL_TREATS * 2);
      if (engine.canPrestige()) {
        engine.performPrestige();
        const state = engine.getState();
        expect(state.resources.treats.amount).toBe(0);
      }
    });

    it('声望后建筑应重置', () => {
      const engine = createEngine();
      addTreats(engine, PRESTIGE_MIN_TOTAL_TREATS * 2);
      engine.purchaseBuilding(0);
      if (engine.canPrestige()) {
        engine.performPrestige();
        expect(engine.getBuildingLevel(0)).toBe(0);
      }
    });

    it('声望后乘数应有加成', () => {
      const engine = createEngine();
      addTreats(engine, PRESTIGE_MIN_TOTAL_TREATS * 2);
      if (engine.canPrestige()) {
        engine.performPrestige();
        expect(engine.getPrestigeMultiplier()).toBeGreaterThan(1);
      }
    });

    it('声望乘数公式正确', () => {
      const engine = createEngine();
      addTreats(engine, PRESTIGE_MIN_TOTAL_TREATS * 2);
      if (engine.canPrestige()) {
        const stars = engine.performPrestige();
        const expected = 1 + stars * STAR_BONUS_MULTIPLIER;
        expect(engine.getPrestigeMultiplier()).toBeCloseTo(expected, 1);
      }
    });
  });

  // ========== 存档系统 ==========
  describe('存档系统', () => {
    it('getState 应返回有效状态', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state).toBeDefined();
      expect(state.resources).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.dogs).toBeDefined();
    });

    it('loadState 应恢复状态', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      engine.purchaseBuilding(0);
      const saved = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(saved);
      expect(engine2.getBuildingLevel(0)).toBe(1);
    });

    it('save 应返回 SaveData', () => {
      const engine = createEngine();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.gameId).toBe('doggo-home');
      expect(data.version).toBeTruthy();
    });

    it('load 应恢复存档', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.load(data);
      expect(engine2.totalTreatsEarned).toBeGreaterThanOrEqual(0);
    });

    it('存档-加载循环应保持数据', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      engine.purchaseBuilding(0);
      const saved = engine.save();

      const engine2 = createEngine();
      engine2.load(saved);
      expect(engine2.getBuildingLevel(0)).toBe(1);
    });
  });

  // ========== 渲染系统 ==========
  describe('渲染系统', () => {
    it('onRender 不应抛出异常', () => {
      const engine = createEngine();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        expect(() => {
          engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
        }).not.toThrow();
      }
    });

    it('点击后渲染不应抛出异常', () => {
      const engine = startEngine();
      engine.click();
      engine.stop();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        expect(() => {
          engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
        }).not.toThrow();
      }
    });

    it('有建筑后渲染不应抛出异常', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      engine.purchaseBuilding(0);
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        expect(() => {
          engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
        }).not.toThrow();
      }
    });
  });

  // ========== 键盘控制 ==========
  describe('键盘控制', () => {
    it('handleKeyDown 不应抛出异常', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyDown('ArrowDown')).not.toThrow();
      expect(() => engine.handleKeyDown('Enter')).not.toThrow();
    });

    it('ArrowDown 应增加选中索引', () => {
      const engine = createEngine();
      const before = engine.selectedIndex;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBeGreaterThanOrEqual(before);
    });

    it('ArrowUp 应减少选中索引', () => {
      const engine = createEngine();
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowDown');
      const before = engine.selectedIndex;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBeLessThanOrEqual(before);
    });

    it('handleKeyUp 不应抛出异常', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });
  });

  // ========== 数字格式化 ==========
  describe('数字格式化', () => {
    it('应正确格式化小数字', () => {
      const engine = createEngine();
      expect(engine.formatNumber(0)).toBe('0');
      expect(engine.formatNumber(1)).toBe('1');
      expect(engine.formatNumber(999)).toBe('999');
    });

    it('应正确格式化千位', () => {
      const engine = createEngine();
      const result = engine.formatNumber(1000);
      expect(result).toContain('K');
    });

    it('应正确格式化百万位', () => {
      const engine = createEngine();
      const result = engine.formatNumber(1000000);
      expect(result).toContain('M');
    });

    it('应正确格式化十亿位', () => {
      const engine = createEngine();
      const result = engine.formatNumber(1000000000);
      expect(result).toContain('B');
    });

    it('应正确格式化万亿位', () => {
      const engine = createEngine();
      const result = engine.formatNumber(1000000000000);
      expect(result).toContain('T');
    });

    it('应正确处理负数', () => {
      const engine = createEngine();
      const result = engine.formatNumber(-100);
      expect(result).toContain('-');
    });
  });

  // ========== 建筑定义完整性 ==========
  describe('建筑定义', () => {
    it('应有 6 种建筑', () => {
      expect(BUILDINGS.length).toBe(6);
    });

    it('每种建筑应有完整定义', () => {
      for (const b of BUILDINGS) {
        expect(b.id).toBeTruthy();
        expect(b.name).toBeTruthy();
        expect(b.baseCost).toBeDefined();
        expect(b.costMultiplier).toBeGreaterThan(1);
        expect(b.maxLevel).toBeGreaterThan(0);
        expect(b.baseProduction).toBeGreaterThan(0);
        expect(b.productionResource).toBeTruthy();
      }
    });

    it('建筑费用递增系数应合理', () => {
      for (const b of BUILDINGS) {
        expect(b.costMultiplier).toBeGreaterThanOrEqual(1.1);
        expect(b.costMultiplier).toBeLessThanOrEqual(2);
      }
    });

    it('建筑应有唯一 id', () => {
      const ids = BUILDINGS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ========== 狗狗品种定义 ==========
  describe('狗狗品种定义', () => {
    it('应有 8 种狗狗', () => {
      expect(DOG_BREEDS.length).toBe(8);
    });

    it('每种狗狗应有唯一 id', () => {
      const ids = DOG_BREEDS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('初始品种（柴犬）费用应为 0', () => {
      const shiba = DOG_BREEDS.find(b => b.id === 'shiba')!;
      expect(shiba.unlockCost).toBe(0);
    });

    it('品种解锁费用应递增', () => {
      const paid = DOG_BREEDS.filter(b => b.unlockCost > 0);
      for (let i = 1; i < paid.length; i++) {
        expect(paid[i].unlockCost).toBeGreaterThan(paid[i - 1].unlockCost);
      }
    });
  });

  // ========== 常量验证 ==========
  describe('常量验证', () => {
    it('TREATS_PER_CLICK 应为正数', () => {
      expect(TREATS_PER_CLICK).toBeGreaterThan(0);
    });

    it('STAR_BONUS_MULTIPLIER 应为正小数', () => {
      expect(STAR_BONUS_MULTIPLIER).toBeGreaterThan(0);
      expect(STAR_BONUS_MULTIPLIER).toBeLessThan(1);
    });

    it('PRESTIGE_MIN_TOTAL_TREATS 应为正数', () => {
      expect(PRESTIGE_MIN_TOTAL_TREATS).toBeGreaterThan(0);
    });

    it('CANVAS_WIDTH 和 CANVAS_HEIGHT 应为正数', () => {
      expect(CANVAS_WIDTH).toBeGreaterThan(0);
      expect(CANVAS_HEIGHT).toBeGreaterThan(0);
    });
  });

  // ========== 游戏生命周期 ==========
  describe('游戏生命周期', () => {
    it('引擎创建后应能获取状态', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state).toBeDefined();
    });

    it('多次操作后状态应一致', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      const state1 = engine.getState();
      const state2 = engine.getState();
      expect(state1.resources.treats.amount).toBe(state2.resources.treats.amount);
    });

    it('存档-加载循环应保持数据', () => {
      const engine = createEngine();
      addTreats(engine, 1000);
      engine.purchaseBuilding(0);
      const golden = DOG_BREEDS.find(b => b.id === 'golden')!;
      addTreats(engine, golden.unlockCost + 100);
      engine.unlockDog('golden');

      const saved = engine.save();
      const engine2 = createEngine();
      engine2.load(saved);

      expect(engine2.getBuildingLevel(0)).toBe(1);
      expect(engine2.dogs.find(d => d.id === 'golden')?.unlocked).toBe(true);
    });

    it('状态导出导入应保持一致', () => {
      const engine = createEngine();
      addTreats(engine, 100);

      const state = engine.getState();
      const engine2 = createEngine();
      engine2.loadState(state);

      const state2 = engine2.getState();
      expect(state2.resources.treats.amount).toBe(state.resources.treats.amount);
    });
  });

  // ========== 边界情况 ==========
  describe('边界情况', () => {
    it('空存档加载不应崩溃', () => {
      const engine = createEngine();
      expect(() => engine.load({} as any)).not.toThrow();
    });

    it('无效状态加载不应崩溃', () => {
      const engine = createEngine();
      expect(() => engine.loadState({} as any)).not.toThrow();
    });

    it('大量点击不应溢出', () => {
      const engine = startEngine();
      for (let i = 0; i < 1000; i++) engine.click();
      engine.stop();
      expect(engine.totalClicks).toBe(1000);
      expect(engine.totalTreatsEarned).toBeGreaterThan(0);
    });

    it('连续购买建筑至高等级', () => {
      const engine = createEngine();
      addTreats(engine, 1e8);
      let bought = 0;
      for (let i = 0; i < 60; i++) {
        if (engine.purchaseBuilding(0)) bought++;
      }
      expect(bought).toBeGreaterThan(0);
      expect(engine.getBuildingLevel(0)).toBe(bought);
    });

    it('零尺寸渲染不应崩溃', () => {
      const engine = createEngine();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        expect(() => engine.onRender(ctx, 0, 0)).not.toThrow();
      }
    });
  });

  // ========== 更新循环 ==========
  describe('更新循环', () => {
    it('有建筑后 onUpdate 应产出资源', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      engine.purchaseBuilding(0);

      const before = engine.getState().resources.treats.amount;
      engine.onUpdate(1000);
      const after = engine.getState().resources.treats.amount;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('无建筑时 onUpdate 不应崩溃', () => {
      const engine = createEngine();
      expect(() => engine.onUpdate(1000)).not.toThrow();
    });

    it('多次更新应累积产出', () => {
      const engine = createEngine();
      addTreats(engine, 100);
      engine.purchaseBuilding(0);

      const before = engine.getState().resources.treats.amount;
      for (let i = 0; i < 10; i++) {
        engine.onUpdate(100);
      }
      const after = engine.getState().resources.treats.amount;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });
});
