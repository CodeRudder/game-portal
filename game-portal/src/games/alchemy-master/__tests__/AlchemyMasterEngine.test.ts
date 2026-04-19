/**
 * Alchemy Master（炼丹大师）放置类游戏 — 完整测试套件
 *
 * 覆盖：初始化、常量验证、资源、点击、灵药田、炼丹、境界、产出倍率、声望、存档、键盘、渲染、边界
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlchemyMasterEngine } from '@/games/alchemy-master/AlchemyMasterEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HERB_PER_CLICK,
  RESOURCE_IDS,
  FIELD_IDS,
  FIELDS,
  RECIPES,
  RECIPE_IDS,
  REALMS,
  REALM_IDS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_PILLS,
  COLORS,
  MAX_SMOKE_PARTICLES,
  SMOKE_RISE_SPEED,
  FLOATING_TEXT_DURATION,
  UPGRADE_PANEL,
  FURNACE_DRAW,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
} from '@/games/alchemy-master/constants';

// ========== 测试辅助 ==========

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
    save: noop, restore: noop, translate: noop, rotate: noop,
    scale: noop, transform: noop, setTransform: noop, resetTransform: noop,
    drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop } as CanvasGradient),
    createRadialGradient: () => ({ addColorStop: noop } as CanvasGradient),
    createPattern: () => null,
    setLineDash: noop,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, lineCap: 'butt' as CanvasLineCap, lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10, font: '12px sans-serif',
    textAlign: 'start' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): AlchemyMasterEngine {
  const engine = new AlchemyMasterEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): AlchemyMasterEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addHerb(engine: AlchemyMasterEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.HERB, amount);
}

function addPillEnergy(engine: AlchemyMasterEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.PILL_ENERGY, amount);
}

function addPill(engine: AlchemyMasterEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.PILL, amount);
}

function addAlchemyWay(engine: AlchemyMasterEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.ALCHEMY_WAY, amount);
}

/** 触发一次 update */
function tick(engine: AlchemyMasterEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getHerb(engine: AlchemyMasterEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.HERB)?.amount ?? 0;
}

function getPillEnergy(engine: AlchemyMasterEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.PILL_ENERGY)?.amount ?? 0;
}

function getPill(engine: AlchemyMasterEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.PILL)?.amount ?? 0;
}

function getAlchemyWay(engine: AlchemyMasterEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.ALCHEMY_WAY)?.amount ?? 0;
}

// ========== 测试 ==========

describe('AlchemyMasterEngine', () => {
  let engine: AlchemyMasterEngine;

  beforeEach(() => {
    localStorage.clear();
    engine = createEngine();
  });

  // ==========================================================================
  // 1. 初始化 (15 tests)
  // ==========================================================================

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(AlchemyMasterEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后灵药为 0', () => {
      expect(getHerb(engine)).toBe(0);
    });

    it('init 后丹气为 0', () => {
      expect(getPillEnergy(engine)).toBe(0);
    });

    it('init 后丹药为 0', () => {
      expect(getPill(engine)).toBe(0);
    });

    it('init 后丹道为 0', () => {
      expect(getAlchemyWay(engine)).toBe(0);
    });

    it('init 后总灵药获得为 0', () => {
      expect(engine.totalHerbsEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后总炼制丹药为 0', () => {
      expect(engine.totalPillsCrafted).toBe(0);
    });

    it('init 后当前境界索引为 0', () => {
      expect(engine.currentRealmIndex).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 alchemy-master', () => {
      expect(engine.gameId).toBe('alchemy-master');
    });

    it('init 后灵药已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.HERB);
      expect(res.unlocked).toBe(true);
    });

    it('init 后丹气未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.PILL_ENERGY);
      expect(res.unlocked).toBe(false);
    });

    it('init 后丹药未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.PILL);
      expect(res.unlocked).toBe(false);
    });
  });

  // ==========================================================================
  // 2. 常量验证 (12 tests)
  // ==========================================================================

  describe('常量验证', () => {
    it('CANVAS_WIDTH 为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('HERB_PER_CLICK 为 1', () => {
      expect(HERB_PER_CLICK).toBe(1);
    });

    it('PRESTIGE_MULTIPLIER 为 0.05', () => {
      expect(PRESTIGE_MULTIPLIER).toBe(0.05);
    });

    it('MIN_PRESTIGE_PILLS 为 100', () => {
      expect(MIN_PRESTIGE_PILLS).toBe(100);
    });

    it('MAX_SMOKE_PARTICLES 为 10', () => {
      expect(MAX_SMOKE_PARTICLES).toBe(10);
    });

    it('SMOKE_RISE_SPEED 为 30', () => {
      expect(SMOKE_RISE_SPEED).toBe(30);
    });

    it('FLOATING_TEXT_DURATION 为 1200', () => {
      expect(FLOATING_TEXT_DURATION).toBe(1200);
    });

    it('RESOURCE_IDS 包含所有资源', () => {
      expect(RESOURCE_IDS.HERB).toBe('herb');
      expect(RESOURCE_IDS.PILL_ENERGY).toBe('pill-energy');
      expect(RESOURCE_IDS.PILL).toBe('pill');
      expect(RESOURCE_IDS.ALCHEMY_WAY).toBe('alchemy-way');
    });

    it('FIELD_IDS 包含所有灵药田', () => {
      expect(FIELD_IDS.HERB_GARDEN).toBe('herb-garden');
      expect(FIELD_IDS.SPIRIT_SPRING).toBe('spirit-spring');
      expect(FIELD_IDS.MEDICINE_VALLEY).toBe('medicine-valley');
      expect(FIELD_IDS.FURNACE).toBe('furnace');
      expect(FIELD_IDS.PILL_ROOM).toBe('pill-room');
      expect(FIELD_IDS.ALCHEMY_PAVILION).toBe('alchemy-pavilion');
    });

    it('COLORS 包含关键颜色', () => {
      expect(COLORS.herbColor).toBeDefined();
      expect(COLORS.pillColor).toBeDefined();
      expect(COLORS.alchemyWayColor).toBeDefined();
      expect(COLORS.furnaceColor).toBeDefined();
    });

    it('UPGRADE_PANEL 参数合理', () => {
      expect(UPGRADE_PANEL.startY).toBeGreaterThan(0);
      expect(UPGRADE_PANEL.itemWidth).toBe(CANVAS_WIDTH - 24);
    });
  });

  // ==========================================================================
  // 3. 灵药田初始化 (8 tests)
  // ==========================================================================

  describe('灵药田初始化', () => {
    it('应有 6 种灵药田', () => {
      expect(FIELDS.length).toBe(6);
    });

    it('初始只有百草园解锁', () => {
      const garden = (engine as any).upgrades.get(FIELD_IDS.HERB_GARDEN);
      expect(garden.unlocked).toBe(true);
    });

    it('灵泉初始未解锁', () => {
      const spring = (engine as any).upgrades.get(FIELD_IDS.SPIRIT_SPRING);
      expect(spring.unlocked).toBe(false);
    });

    it('药王谷初始未解锁', () => {
      const valley = (engine as any).upgrades.get(FIELD_IDS.MEDICINE_VALLEY);
      expect(valley.unlocked).toBe(false);
    });

    it('丹炉初始未解锁', () => {
      const furnace = (engine as any).upgrades.get(FIELD_IDS.FURNACE);
      expect(furnace.unlocked).toBe(false);
    });

    it('所有灵药田初始等级为 0', () => {
      for (const field of FIELDS) {
        expect(engine.getFieldLevel(field.id)).toBe(0);
      }
    });

    it('灵药田 ID 唯一', () => {
      const ids = FIELDS.map(f => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('丹房初始未解锁', () => {
      const room = (engine as any).upgrades.get(FIELD_IDS.PILL_ROOM);
      expect(room.unlocked).toBe(false);
    });
  });

  // ==========================================================================
  // 4. 丹方初始化 (8 tests)
  // ==========================================================================

  describe('丹方初始化', () => {
    it('应有 6 种丹方', () => {
      expect(RECIPES.length).toBe(6);
    });

    it('丹方 ID 唯一', () => {
      const ids = RECIPES.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('疗伤丹需求学徒境界', () => {
      const recipe = RECIPES.find(r => r.id === RECIPE_IDS.HEALING_PILL)!;
      expect(recipe.realmRequired).toBe(REALM_IDS.APPRENTICE);
    });

    it('聚灵丹需求弟子境界', () => {
      const recipe = RECIPES.find(r => r.id === RECIPE_IDS.SPIRIT_PILL)!;
      expect(recipe.realmRequired).toBe(REALM_IDS.DISCIPLE);
    });

    it('九转金丹需求宗师境界', () => {
      const recipe = RECIPES.find(r => r.id === RECIPE_IDS.DIVINE_PILL)!;
      expect(recipe.realmRequired).toBe(REALM_IDS.SAGE);
    });

    it('疗伤丹消耗灵药', () => {
      const recipe = RECIPES.find(r => r.id === RECIPE_IDS.HEALING_PILL)!;
      expect(recipe.cost).toHaveProperty('herb');
    });

    it('所有丹方有丹药产出', () => {
      for (const recipe of RECIPES) {
        expect(recipe.pillYield).toBeGreaterThan(0);
      }
    });

    it('所有丹方有丹气产出', () => {
      for (const recipe of RECIPES) {
        expect(recipe.energyYield).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // 5. 境界系统初始化 (8 tests)
  // ==========================================================================

  describe('境界系统初始化', () => {
    it('应有 8 个境界', () => {
      expect(REALMS.length).toBe(8);
    });

    it('境界 ID 唯一', () => {
      const ids = REALMS.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('初始境界为炼丹学徒', () => {
      expect(engine.getCurrentRealm().id).toBe(REALM_IDS.APPRENTICE);
    });

    it('初始境界名称为炼丹学徒', () => {
      expect(engine.getCurrentRealmName()).toBe('炼丹学徒');
    });

    it('学徒境界产出倍率为 1.0', () => {
      expect(REALMS[0].productionMultiplier).toBe(1.0);
    });

    it('丹神境界产出倍率为 15.0', () => {
      expect(REALMS[7].productionMultiplier).toBe(15.0);
    });

    it('境界要求丹药数递增', () => {
      for (let i = 1; i < REALMS.length; i++) {
        expect(REALMS[i].requiredPills).toBeGreaterThan(REALMS[i - 1].requiredPills);
      }
    });

    it('getNextRealm 初始返回弟子', () => {
      const next = engine.getNextRealm();
      expect(next).not.toBeNull();
      expect(next!.id).toBe(REALM_IDS.DISCIPLE);
    });
  });

  // ==========================================================================
  // 6. 生命周期 (4 tests)
  // ==========================================================================

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
  });

  // ==========================================================================
  // 7. 资源系统 (15 tests)
  // ==========================================================================

  describe('资源系统', () => {
    it('addResource 增加灵药', () => {
      addHerb(engine, 100);
      expect(getHerb(engine)).toBe(100);
    });

    it('addResource 累加灵药', () => {
      addHerb(engine, 50);
      addHerb(engine, 30);
      expect(getHerb(engine)).toBe(80);
    });

    it('addResource 增加丹气', () => {
      addPillEnergy(engine, 25);
      expect(getPillEnergy(engine)).toBe(25);
    });

    it('addResource 增加丹药', () => {
      addPill(engine, 10);
      expect(getPill(engine)).toBe(10);
    });

    it('addResource 增加丹道', () => {
      addAlchemyWay(engine, 5);
      expect(getAlchemyWay(engine)).toBe(5);
    });

    it('getResource 返回 undefined 对不存在的 ID', () => {
      const res = (engine as any).getResource('nonexistent');
      expect(res).toBeUndefined();
    });

    it('addResource 正数自动解锁资源', () => {
      expect((engine as any).getResource(RESOURCE_IDS.PILL_ENERGY).unlocked).toBe(false);
      addPillEnergy(engine, 10);
      expect((engine as any).getResource(RESOURCE_IDS.PILL_ENERGY).unlocked).toBe(true);
    });

    it('spendResource 扣除资源', () => {
      addHerb(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.HERB, 40);
      expect(getHerb(engine)).toBe(60);
    });

    it('spendResource 资源不足返回 false', () => {
      addHerb(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.HERB, 50);
      expect(result).toBe(false);
      expect(getHerb(engine)).toBe(10);
    });

    it('hasResource 检查资源充足', () => {
      addHerb(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.HERB, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.HERB, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addHerb(engine, 100);
      addPillEnergy(engine, 50);
      expect((engine as any).canAfford({ herb: 50, 'pill-energy': 30 })).toBe(true);
      expect((engine as any).canAfford({ herb: 50, 'pill-energy': 60 })).toBe(false);
    });

    it('getUnlockedResources 返回已解锁资源', () => {
      const unlocked = (engine as any).getUnlockedResources();
      expect(unlocked.length).toBe(1);
      expect(unlocked[0].id).toBe(RESOURCE_IDS.HERB);
    });

    it('addResource 触发 resourceChange 事件', () => {
      const listener = vi.fn();
      engine.on('resourceChange', listener);
      addHerb(engine, 50);
      expect(listener).toHaveBeenCalledWith(RESOURCE_IDS.HERB, 50);
    });

    it('spendResource 触发 resourceChange 事件', () => {
      addHerb(engine, 100);
      const listener = vi.fn();
      engine.on('resourceChange', listener);
      (engine as any).spendResource(RESOURCE_IDS.HERB, 30);
      expect(listener).toHaveBeenCalledWith(RESOURCE_IDS.HERB, 70);
    });

    it('资源不超 maxAmount', () => {
      addHerb(engine, Number.MAX_SAFE_INTEGER);
      expect(getHerb(engine)).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  // ==========================================================================
  // 8. 资源解锁 (5 tests)
  // ==========================================================================

  describe('资源解锁', () => {
    it('灵药达到 50 时解锁丹气', () => {
      engine.start();
      addHerb(engine, 60);
      tick(engine, 16);
      const energy = (engine as any).getResource(RESOURCE_IDS.PILL_ENERGY);
      expect(energy.unlocked).toBe(true);
    });

    it('丹气达到 20 时解锁丹药', () => {
      engine.start();
      addPillEnergy(engine, 30);
      tick(engine, 16);
      const pill = (engine as any).getResource(RESOURCE_IDS.PILL);
      expect(pill.unlocked).toBe(true);
    });

    it('声望后解锁丹道', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      tick(engine, 16);
      const alchemyWay = (engine as any).getResource(RESOURCE_IDS.ALCHEMY_WAY);
      expect(alchemyWay.unlocked).toBe(true);
    });

    it('条件未满足时资源保持锁定', () => {
      engine.start();
      addHerb(engine, 10);
      tick(engine, 16);
      const energy = (engine as any).getResource(RESOURCE_IDS.PILL_ENERGY);
      expect(energy.unlocked).toBe(false);
    });

    it('资源解锁触发 resourceUnlocked 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('resourceUnlocked', listener);
      addHerb(engine, 60);
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith(RESOURCE_IDS.PILL_ENERGY);
    });
  });

  // ==========================================================================
  // 9. 点击系统 (10 tests)
  // ==========================================================================

  describe('点击系统', () => {
    it('playing 状态下点击获得灵药', () => {
      engine.start();
      const result = engine.click();
      expect(result).toBeGreaterThan(0);
      expect(getHerb(engine)).toBeGreaterThan(0);
    });

    it('点击增加 totalClicks', () => {
      engine.start();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(2);
    });

    it('点击增加 totalHerbsEarned', () => {
      engine.start();
      engine.click();
      expect(engine.totalHerbsEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击返回 0', () => {
      expect(engine.click()).toBe(0);
    });

    it('paused 状态下点击返回 0', () => {
      engine.start();
      engine.pause();
      expect(engine.click()).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.click();
      expect(listener).toHaveBeenCalled();
    });

    it('多次点击累积灵药', () => {
      engine.start();
      for (let i = 0; i < 10; i++) {
        engine.click();
      }
      expect(getHerb(engine)).toBeGreaterThan(0);
      expect(engine.totalClicks).toBe(10);
    });

    it('点击返回值等于 getClickPower', () => {
      engine.start();
      const power = engine.getClickPower();
      const result = engine.click();
      expect(result).toBeCloseTo(power, 5);
    });

    it('点击 totalHerbsEarned 累积', () => {
      engine.start();
      engine.click();
      const first = engine.totalHerbsEarned;
      engine.click();
      expect(engine.totalHerbsEarned).toBeGreaterThan(first);
    });
  });

  // ==========================================================================
  // 10. getClickPower (5 tests)
  // ==========================================================================

  describe('getClickPower', () => {
    it('初始点击力量为 HERB_PER_CLICK * 境界倍率', () => {
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(HERB_PER_CLICK * REALMS[0].productionMultiplier, 5);
    });

    it('境界提升增加点击力量', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 2; // 炼丹师，1.5x
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(HERB_PER_CLICK * 1.5, 5);
    });

    it('声望增加点击力量', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(HERB_PER_CLICK * (1 + 10 * PRESTIGE_MULTIPLIER), 5);
    });

    it('境界+声望叠加', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 1; // 弟子，1.2x
      (engine as any).prestige.currency = 5;
      const power = engine.getClickPower();
      expect(power).toBeCloseTo(HERB_PER_CLICK * 1.2 * (1 + 5 * PRESTIGE_MULTIPLIER), 5);
    });

    it('getClickPower 始终大于 0', () => {
      expect(engine.getClickPower()).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 11. 灵药田系统 (20 tests)
  // ==========================================================================

  describe('灵药田系统', () => {
    it('购买百草园（初始解锁灵药田）', () => {
      engine.start();
      addHerb(engine, 100);
      const result = engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(result).toBe(true);
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(1);
    });

    it('购买灵药田扣除资源', () => {
      engine.start();
      addHerb(engine, 100);
      const before = getHerb(engine);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(getHerb(engine)).toBeLessThan(before);
    });

    it('资源不足时购买失败', () => {
      engine.start();
      addHerb(engine, 1);
      const result = engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(result).toBe(false);
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(0);
    });

    it('未解锁灵药田购买失败', () => {
      engine.start();
      addHerb(engine, 1000);
      const result = engine.purchaseField(FIELD_IDS.SPIRIT_SPRING);
      expect(result).toBe(false);
    });

    it('购买灵药田触发 upgradePurchased 事件', () => {
      engine.start();
      addHerb(engine, 100);
      const listener = vi.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(listener).toHaveBeenCalledWith(FIELD_IDS.HERB_GARDEN, 1);
    });

    it('getFieldCost 返回正确的费用', () => {
      const cost = engine.getFieldCost(FIELD_IDS.HERB_GARDEN);
      expect(cost).toBeDefined();
      expect(cost.herb).toBeGreaterThan(0);
    });

    it('buyFieldByIndex 正常工作', () => {
      engine.start();
      addHerb(engine, 100);
      const result = engine.buyFieldByIndex(0);
      expect(result).toBe(true);
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(1);
    });

    it('buyFieldByIndex 越界返回 false', () => {
      engine.start();
      expect(engine.buyFieldByIndex(-1)).toBe(false);
      expect(engine.buyFieldByIndex(999)).toBe(false);
    });

    it('灵药田费用随等级增长', () => {
      engine.start();
      addHerb(engine, 10000);
      const cost1 = engine.getFieldCost(FIELD_IDS.HERB_GARDEN);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      const cost2 = engine.getFieldCost(FIELD_IDS.HERB_GARDEN);
      expect(cost2.herb).toBeGreaterThan(cost1.herb);
    });

    it('连续购买多次灵药田等级递增', () => {
      engine.start();
      addHerb(engine, 10000);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(3);
    });

    it('getFieldLevel 对不存在 ID 返回 0', () => {
      expect(engine.getFieldLevel('nonexistent')).toBe(0);
    });

    it('getFieldCost 对不存在 ID 返回空对象', () => {
      const cost = engine.getFieldCost('nonexistent');
      expect(Object.keys(cost).length).toBe(0);
    });

    it('购买灵药田触发 stateChange 事件', () => {
      engine.start();
      addHerb(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(listener).toHaveBeenCalled();
    });

    it('灵药田费用使用 costMultiplier 计算', () => {
      const gardenDef = FIELDS.find(f => f.id === FIELD_IDS.HERB_GARDEN)!;
      const cost0 = engine.getFieldCost(FIELD_IDS.HERB_GARDEN);
      expect(cost0.herb).toBe(gardenDef.baseCost.herb);
    });

    it('购买灵药田后 recalculateProduction 被调用', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      const herb = (engine as any).getResource(RESOURCE_IDS.HERB);
      expect(herb.perSecond).toBeGreaterThan(0);
    });

    it('灵药田等级不超过 maxLevel', () => {
      engine.start();
      const gardenDef = FIELDS.find(f => f.id === FIELD_IDS.HERB_GARDEN)!;
      const garden = (engine as any).upgrades.get(FIELD_IDS.HERB_GARDEN);
      garden.level = gardenDef.maxLevel;
      addHerb(engine, 999999);
      const result = engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(result).toBe(false);
    });

    it('灵药田 ID 包含所有定义的 ID', () => {
      const ids = FIELDS.map(f => f.id);
      expect(ids).toContain(FIELD_IDS.HERB_GARDEN);
      expect(ids).toContain(FIELD_IDS.SPIRIT_SPRING);
      expect(ids).toContain(FIELD_IDS.MEDICINE_VALLEY);
      expect(ids).toContain(FIELD_IDS.FURNACE);
      expect(ids).toContain(FIELD_IDS.PILL_ROOM);
      expect(ids).toContain(FIELD_IDS.ALCHEMY_PAVILION);
    });

    it('购买灵药田精确扣除费用', () => {
      engine.start();
      addHerb(engine, 100);
      const cost = engine.getFieldCost(FIELD_IDS.HERB_GARDEN);
      const before = getHerb(engine);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(getHerb(engine)).toBe(before - cost.herb);
    });

    it('多次购买费用递增', () => {
      engine.start();
      addHerb(engine, 10000);
      const costs: number[] = [];
      for (let i = 0; i < 3; i++) {
        costs.push(engine.getFieldCost(FIELD_IDS.HERB_GARDEN).herb);
        engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      }
      expect(costs[1]).toBeGreaterThan(costs[0]);
      expect(costs[2]).toBeGreaterThan(costs[1]);
    });

    it('百草园产出灵药', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      const herb = (engine as any).getResource(RESOURCE_IDS.HERB);
      expect(herb.perSecond).toBe(0.5); // baseProduction
    });
  });

  // ==========================================================================
  // 12. 灵药田解锁 (6 tests)
  // ==========================================================================

  describe('灵药田解锁', () => {
    it('百草园 Lv3 解锁灵泉', () => {
      engine.start();
      const garden = (engine as any).upgrades.get(FIELD_IDS.HERB_GARDEN);
      garden.level = 3;
      tick(engine, 16);
      const spring = (engine as any).upgrades.get(FIELD_IDS.SPIRIT_SPRING);
      expect(spring.unlocked).toBe(true);
    });

    it('灵泉 Lv2 解锁药王谷', () => {
      engine.start();
      const spring = (engine as any).upgrades.get(FIELD_IDS.SPIRIT_SPRING);
      spring.level = 2;
      spring.unlocked = true;
      tick(engine, 16);
      const valley = (engine as any).upgrades.get(FIELD_IDS.MEDICINE_VALLEY);
      expect(valley.unlocked).toBe(true);
    });

    it('药王谷 Lv2 解锁丹炉', () => {
      engine.start();
      const valley = (engine as any).upgrades.get(FIELD_IDS.MEDICINE_VALLEY);
      valley.level = 2;
      valley.unlocked = true;
      tick(engine, 16);
      const furnace = (engine as any).upgrades.get(FIELD_IDS.FURNACE);
      expect(furnace.unlocked).toBe(true);
    });

    it('丹炉 Lv3 解锁丹房', () => {
      engine.start();
      const furnace = (engine as any).upgrades.get(FIELD_IDS.FURNACE);
      furnace.level = 3;
      furnace.unlocked = true;
      tick(engine, 16);
      const room = (engine as any).upgrades.get(FIELD_IDS.PILL_ROOM);
      expect(room.unlocked).toBe(true);
    });

    it('丹房 Lv2 解锁丹道阁', () => {
      engine.start();
      const room = (engine as any).upgrades.get(FIELD_IDS.PILL_ROOM);
      room.level = 2;
      room.unlocked = true;
      tick(engine, 16);
      const pavilion = (engine as any).upgrades.get(FIELD_IDS.ALCHEMY_PAVILION);
      expect(pavilion.unlocked).toBe(true);
    });

    it('灵药田解锁触发 fieldUnlocked 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('fieldUnlocked', listener);
      const garden = (engine as any).upgrades.get(FIELD_IDS.HERB_GARDEN);
      garden.level = 3;
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith(FIELD_IDS.SPIRIT_SPRING);
    });
  });

  // ==========================================================================
  // 13. 炼丹系统 (15 tests)
  // ==========================================================================

  describe('炼丹系统', () => {
    it('炼制疗伤丹（学徒境界）', () => {
      engine.start();
      addHerb(engine, 20);
      const result = engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(result).toBe(true);
    });

    it('炼制丹药增加丹药数量', () => {
      engine.start();
      addHerb(engine, 20);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(getPill(engine)).toBeGreaterThan(0);
    });

    it('炼制丹药增加丹气', () => {
      engine.start();
      addHerb(engine, 20);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(getPillEnergy(engine)).toBeGreaterThan(0);
    });

    it('炼制丹药扣除灵药', () => {
      engine.start();
      addHerb(engine, 20);
      const before = getHerb(engine);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(getHerb(engine)).toBeLessThan(before);
    });

    it('资源不足时炼制失败', () => {
      engine.start();
      addHerb(engine, 1);
      const result = engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(result).toBe(false);
    });

    it('境界不足时炼制失败', () => {
      engine.start();
      addHerb(engine, 100000);
      // 初始为学徒，聚灵丹需要弟子境界
      const result = engine.craftPill(RECIPE_IDS.SPIRIT_PILL);
      expect(result).toBe(false);
    });

    it('冷却中炼制失败', () => {
      engine.start();
      addHerb(engine, 100);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      // 立即再次炼制，应因冷却失败
      addHerb(engine, 100);
      const result = engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(result).toBe(false);
    });

    it('冷却结束后可以再次炼制', () => {
      engine.start();
      addHerb(engine, 1000);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      // 等待冷却结束（1000ms）
      tick(engine, 1100);
      addHerb(engine, 100);
      const result = engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(result).toBe(true);
    });

    it('炼制丹药增加 totalPillsCrafted', () => {
      engine.start();
      addHerb(engine, 20);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(engine.totalPillsCrafted).toBeGreaterThan(0);
    });

    it('炼制丹药触发 pillCrafted 事件', () => {
      engine.start();
      addHerb(engine, 20);
      const listener = vi.fn();
      engine.on('pillCrafted', listener);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(listener).toHaveBeenCalledWith(RECIPE_IDS.HEALING_PILL, expect.any(Number));
    });

    it('canCraft 返回正确状态', () => {
      engine.start();
      expect(engine.canCraft(RECIPE_IDS.HEALING_PILL)).toBe(false);
      addHerb(engine, 20);
      expect(engine.canCraft(RECIPE_IDS.HEALING_PILL)).toBe(true);
    });

    it('canCraft 对无效 ID 返回 false', () => {
      expect(engine.canCraft('invalid')).toBe(false);
    });

    it('getRecipeCooldown 返回冷却时间', () => {
      engine.start();
      addHerb(engine, 20);
      engine.craftPill(RECIPE_IDS.HEALING_PILL);
      const cooldown = engine.getRecipeCooldown(RECIPE_IDS.HEALING_PILL);
      expect(cooldown).toBeGreaterThan(0);
    });

    it('getRecipeCooldown 无冷却时返回 0', () => {
      expect(engine.getRecipeCooldown(RECIPE_IDS.HEALING_PILL)).toBe(0);
    });

    it('idle 状态下炼制失败', () => {
      addHerb(engine, 20);
      const result = engine.craftPill(RECIPE_IDS.HEALING_PILL);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // 14. 境界系统 (10 tests)
  // ==========================================================================

  describe('境界系统', () => {
    it('丹药达到 10 时提升到弟子', () => {
      engine.start();
      addPill(engine, 15);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(1);
      expect(engine.getCurrentRealm().id).toBe(REALM_IDS.DISCIPLE);
    });

    it('丹药达到 50 时提升到炼丹师', () => {
      engine.start();
      addPill(engine, 60);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(2);
      expect(engine.getCurrentRealm().id).toBe(REALM_IDS.MASTER);
    });

    it('丹药达到 200 时提升到高级炼丹师', () => {
      engine.start();
      addPill(engine, 250);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(3);
    });

    it('丹药达到 1000 时提升到炼丹大师', () => {
      engine.start();
      addPill(engine, 1200);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(4);
    });

    it('丹药达到 5000 时提升到丹道宗师', () => {
      engine.start();
      addPill(engine, 6000);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(5);
    });

    it('丹药达到 20000 时提升到丹圣', () => {
      engine.start();
      addPill(engine, 25000);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(6);
    });

    it('丹药达到 100000 时提升到丹神', () => {
      engine.start();
      addPill(engine, 120000);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(7);
      expect(engine.getCurrentRealm().id).toBe(REALM_IDS.GOD);
    });

    it('境界提升触发 realmUpgraded 事件', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('realmUpgraded', listener);
      addPill(engine, 15);
      tick(engine, 16);
      expect(listener).toHaveBeenCalledWith(REALM_IDS.DISCIPLE);
    });

    it('丹药不足时境界不变', () => {
      engine.start();
      addPill(engine, 5);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(0);
    });

    it('丹神为最高境界', () => {
      engine.start();
      addPill(engine, 999999);
      tick(engine, 16);
      expect(engine.currentRealmIndex).toBe(REALMS.length - 1);
      expect(engine.getNextRealm()).toBeNull();
    });
  });

  // ==========================================================================
  // 15. 产出倍率 (8 tests)
  // ==========================================================================

  describe('产出倍率', () => {
    it('初始产出倍率为 1（学徒倍率）', () => {
      const mult = engine.getProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('境界提升增加产出倍率', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 2; // 炼丹师 1.5x
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('声望增加产出倍率', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('getResourceMultiplier 返回相同倍率', () => {
      const mult = engine.getResourceMultiplier(RESOURCE_IDS.HERB);
      expect(mult).toBe(engine.getProductionMultiplier());
    });

    it('getEffectiveProduction 返回 0 对未设置产出的资源', () => {
      expect(engine.getEffectiveProduction(RESOURCE_IDS.PILL_ENERGY)).toBe(0);
    });

    it('getEffectiveProduction 含灵药田产出和加成', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      const prod = engine.getEffectiveProduction(RESOURCE_IDS.HERB);
      expect(prod).toBeGreaterThan(0);
    });

    it('产出倍率各加成叠加', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 1; // 弟子 1.2x
      (engine as any).prestige.currency = 3;
      const mult = engine.getProductionMultiplier();
      // 1.2 + 3*0.05 = 1.2 + 0.15 = 1.35
      expect(mult).toBeCloseTo(1.35, 5);
    });

    it('丹神境界产出倍率为 15+', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 7;
      const mult = engine.getProductionMultiplier();
      expect(mult).toBeGreaterThanOrEqual(15);
    });
  });

  // ==========================================================================
  // 16. 自动生产 (5 tests)
  // ==========================================================================

  describe('自动生产', () => {
    it('有灵药田后 update 增加资源', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      const before = getHerb(engine);
      tick(engine, 1000);
      const after = getHerb(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      const before = getHerb(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getHerb(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('无灵药田时 update 不增加资源', () => {
      engine.start();
      addHerb(engine, 50);
      const before = getHerb(engine);
      tick(engine, 1000);
      expect(getHerb(engine)).toBe(before);
    });

    it('paused 状态不产出', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      engine.pause();
      const before = getHerb(engine);
      tick(engine, 1000);
      expect(getHerb(engine)).toBe(before);
    });

    it('idle 状态不产出', () => {
      addHerb(engine, 100);
      const before = getHerb(engine);
      tick(engine, 1000);
      expect(getHerb(engine)).toBe(before);
    });
  });

  // ==========================================================================
  // 17. 声望（传承）系统 (15 tests)
  // ==========================================================================

  describe('声望（传承）系统', () => {
    it('初始丹道点数为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('丹药不足时无法计算传承精华', () => {
      engine.start();
      expect(engine.calculatePrestigeEssence()).toBe(0);
    });

    it('丹药达到最低要求时可以计算传承精华', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS);
      const essence = engine.calculatePrestigeEssence();
      expect(essence).toBeGreaterThanOrEqual(1);
    });

    it('calculatePrestigeEssence 使用 sqrt 公式', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      const essence = engine.calculatePrestigeEssence();
      expect(essence).toBe(Math.floor(Math.sqrt(4)));
    });

    it('传承重置成功', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      const result = engine.doPrestige();
      expect(result).toBe(true);
    });

    it('传承重置后丹道点数增加', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('传承重置后声望次数增加', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('传承重置后资源归零', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      expect(getPill(engine)).toBe(0);
    });

    it('传承重置后声望数据保留', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      expect((engine as any).prestige.count).toBeGreaterThan(0);
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('传承重置触发 prestigeReset 事件', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      const listener = vi.fn();
      engine.on('prestigeReset', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('丹药不足时传承重置失败', () => {
      engine.start();
      addPill(engine, 10);
      const result = engine.doPrestige();
      expect(result).toBe(false);
    });

    it('传承重置后获得丹道', () => {
      engine.start();
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      expect(getAlchemyWay(engine)).toBeGreaterThan(0);
    });

    it('传承重置后灵药田等级归零', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(1);
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(0);
    });

    it('多次传承累积丹道点数', () => {
      engine.start();
      // 第一次传承
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      const first = (engine as any).prestige.currency;

      // 第二次传承
      addPill(engine, MIN_PRESTIGE_PILLS * 4);
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(first);
      expect((engine as any).prestige.count).toBe(2);
    });
  });

  // ==========================================================================
  // 18. 存档系统 (8 tests)
  // ==========================================================================

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('alchemy-master');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addHerb(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
      expect(data.resources[RESOURCE_IDS.HERB].amount).toBeCloseTo(500, 0);
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addHerb(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getHerb(engine2)).toBeCloseTo(500, 0);
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

    it('save 包含境界数据', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 2;
      const data = engine.save();
      expect(data.statistics.currentRealmIndex).toBe(2);
    });

    it('load 恢复境界数据', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 2;
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.currentRealmIndex).toBe(2);
    });
  });

  // ==========================================================================
  // 19. 状态管理 (5 tests)
  // ==========================================================================

  describe('状态管理', () => {
    it('getState 返回完整状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state.totalHerbsEarned).toBeDefined();
      expect(state.totalClicks).toBeDefined();
      expect(state.totalPillsCrafted).toBeDefined();
      expect(state.currentRealmIndex).toBeDefined();
      expect(state.prestige).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addHerb(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getHerb(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复境界', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 3;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.currentRealmIndex).toBe(3);
    });

    it('loadState 恢复统计数据', () => {
      engine.start();
      engine.click();
      engine.click();
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.totalClicks).toBe(2);
      expect(engine2.totalHerbsEarned).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 20. 数字格式化 (8 tests)
  // ==========================================================================

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
      expect(result).toContain('-');
    });

    it('Infinity 返回 ∞', () => {
      expect((engine as any).formatNumber(Infinity)).toBe('∞');
    });
  });

  // ==========================================================================
  // 21. 键盘输入 (10 tests)
  // ==========================================================================

  describe('键盘输入', () => {
    it('空格键触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(getHerb(engine)).toBeGreaterThan(0);
    });

    it('上箭头减少选中索引', () => {
      engine.start();
      (engine as any)._selectedFieldIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedFieldIndex).toBe(1);
    });

    it('上箭头不低于 0', () => {
      engine.start();
      (engine as any)._selectedFieldIndex = 0;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedFieldIndex).toBe(0);
    });

    it('下箭头增加选中索引', () => {
      engine.start();
      addHerb(engine, 100);
      tick(engine, 16);
      const visibleCount = FIELDS.filter(f => {
        const u = (engine as any).upgrades.get(f.id);
        return u && u.unlocked;
      }).length;
      if (visibleCount > 1) {
        engine.handleKeyDown('ArrowDown');
        expect(engine.selectedFieldIndex).toBe(1);
      }
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getHerb(engine)).toBe(0);
    });

    it('handleKeyUp 不抛错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('Enter 键购买选中灵药田', () => {
      engine.start();
      addHerb(engine, 100);
      engine.handleKeyDown('Enter');
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(1);
    });

    it('Enter 键资源不足不购买', () => {
      engine.start();
      engine.handleKeyDown('Enter');
      expect(engine.getFieldLevel(FIELD_IDS.HERB_GARDEN)).toBe(0);
    });

    it('空格键增加 totalClicks', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(engine.totalClicks).toBe(1);
    });

    it('ArrowDown 不超过可见灵药田数', () => {
      engine.start();
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedFieldIndex).toBe(0);
    });
  });

  // ==========================================================================
  // 22. Canvas 渲染 (10 tests)
  // ==========================================================================

  describe('Canvas 渲染', () => {
    it('onRender 不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('渲染后 ctx 定义', () => {
      engine.start();
      const ctx = createMockCtx();
      engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      expect(ctx).toBeDefined();
    });

    it('多次渲染不抛错', () => {
      engine.start();
      const ctx = createMockCtx();
      for (let i = 0; i < 10; i++) {
        engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    });

    it('有声望时渲染不报错', () => {
      engine.start();
      (engine as any).prestige.count = 1;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有灵药田时渲染不报错', () => {
      engine.start();
      addHerb(engine, 100);
      engine.purchaseField(FIELD_IDS.HERB_GARDEN);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('idle 状态渲染不报错', () => {
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('高境界时渲染不报错', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 5;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有飘字时渲染不报错', () => {
      engine.start();
      engine.click();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('大量资源时渲染不报错', () => {
      engine.start();
      addHerb(engine, 999999999);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('丹神境界渲染不报错', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 7;
      addPill(engine, 999999);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==========================================================================
  // 23. 边界情况 (10 tests)
  // ==========================================================================

  describe('边界情况', () => {
    it('大量资源不溢出', () => {
      addHerb(engine, Number.MAX_SAFE_INTEGER / 2);
      expect(getHerb(engine)).toBeGreaterThan(0);
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

    it('reset 后资源归零', () => {
      engine.start();
      addHerb(engine, 500);
      engine.reset();
      engine.init(createCanvas());
      expect(getHerb(engine)).toBe(0);
    });

    it('reset 后境界重置为学徒', () => {
      engine.start();
      (engine as any)._currentRealmIndex = 5;
      engine.reset();
      engine.init(createCanvas());
      expect(engine.currentRealmIndex).toBe(0);
    });

    it('destroy 不崩溃', () => {
      engine.start();
      addHerb(engine, 100);
      engine.click();
      expect(() => engine.destroy()).not.toThrow();
    });
  });
});
