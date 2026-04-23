import { vi } from 'vitest';
/**
 * Final Fantasy（最终幻想）放置类游戏 — 完整测试套件
 */
import { FinalFantasyEngine } from '@/games/final-fantasy/FinalFantasyEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  CRYSTAL_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GOLD,
  JOBS,
  SUMMONS,
  BUILDINGS,
  COLORS,
  CHARACTER_DRAW,
  PROMOTION_COSTS,
  MAX_PROMOTION_LEVEL,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/final-fantasy/constants';

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

function createEngine(): FinalFantasyEngine {
  const engine = new FinalFantasyEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): FinalFantasyEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addGold(engine: FinalFantasyEngine, amount: number): void {
  (engine as any).addResource('gold', amount);
}

function addExp(engine: FinalFantasyEngine, amount: number): void {
  (engine as any).addResource('exp', amount);
}

function addMana(engine: FinalFantasyEngine, amount: number): void {
  (engine as any).addResource('mana', amount);
}

/** 触发一次 update */
function tick(engine: FinalFantasyEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getGold(engine: FinalFantasyEngine): number {
  return (engine as any).getResource('gold')?.amount ?? 0;
}

function getExp(engine: FinalFantasyEngine): number {
  return (engine as any).getResource('exp')?.amount ?? 0;
}

function getMana(engine: FinalFantasyEngine): number {
  return (engine as any).getResource('mana')?.amount ?? 0;
}

// ========== 测试 ==========

describe('FinalFantasyEngine', () => {
  let engine: FinalFantasyEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(FinalFantasyEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后金币为 0', () => {
      expect(getGold(engine)).toBe(0);
    });

    it('init 后经验为 0', () => {
      expect(getExp(engine)).toBe(0);
    });

    it('init 后魔力为 0', () => {
      expect(getMana(engine)).toBe(0);
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

    it('init 后 gameId 为 final-fantasy', () => {
      expect(engine.gameId).toBe('final-fantasy');
    });

    it('init 后金币已解锁', () => {
      const res = (engine as any).getResource('gold');
      expect(res.unlocked).toBe(true);
    });

    it('init 后经验未解锁', () => {
      const res = (engine as any).getResource('exp');
      expect(res.unlocked).toBe(false);
    });

    it('init 后魔力未解锁', () => {
      const res = (engine as any).getResource('mana');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量', () => {
    it('RESOURCE_IDS 包含 GOLD/EXP/MANA', () => {
      expect(RESOURCE_IDS.GOLD).toBe('gold');
      expect(RESOURCE_IDS.EXP).toBe('exp');
      expect(RESOURCE_IDS.MANA).toBe('mana');
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

    it('COLORS 对象包含必要颜色', () => {
      expect(COLORS.accent).toBeDefined();
      expect(COLORS.goldColor).toBeDefined();
      expect(COLORS.expColor).toBeDefined();
      expect(COLORS.manaColor).toBeDefined();
    });
  });

  // ========== 职业初始化 ==========

  describe('职业初始化', () => {
    it('应有 6 种职业', () => {
      expect(JOBS.length).toBe(6);
    });

    it('初始只有战士解锁', () => {
      const jobs = engine.jobs;
      const warrior = jobs.find(j => j.id === 'warrior');
      expect(warrior?.unlocked).toBe(true);
    });

    it('其他职业初始未解锁', () => {
      const jobs = engine.jobs;
      const locked = jobs.filter(j => j.id !== 'warrior');
      locked.forEach(j => {
        expect(j.unlocked).toBe(false);
      });
    });

    it('所有职业初始进阶等级为 0', () => {
      const jobs = engine.jobs;
      jobs.forEach(j => {
        expect(j.promotionLevel).toBe(0);
      });
    });

    it('职业 ID 唯一', () => {
      const ids = JOBS.map(j => j.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个职业有名称', () => {
      JOBS.forEach(j => {
        expect(j.name).toBeTruthy();
      });
    });

    it('每个职业有图标', () => {
      JOBS.forEach(j => {
        expect(j.icon).toBeTruthy();
      });
    });

    it('每个职业有正数加成值', () => {
      JOBS.forEach(j => {
        expect(j.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个职业有进阶倍率', () => {
      JOBS.forEach(j => {
        expect(j.promotionMultiplier).toBeGreaterThan(0);
      });
    });
  });

  // ========== 召唤兽初始化 ==========

  describe('召唤兽初始化', () => {
    it('应有 5 种召唤兽', () => {
      expect(SUMMONS.length).toBe(5);
    });

    it('初始无召唤兽解锁', () => {
      const summons = engine.summons;
      summons.forEach(s => {
        expect(s.unlocked).toBe(false);
      });
    });

    it('召唤兽 ID 唯一', () => {
      const ids = SUMMONS.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个召唤兽有名称', () => {
      SUMMONS.forEach(s => {
        expect(s.name).toBeTruthy();
      });
    });

    it('每个召唤兽有正数加成倍率', () => {
      SUMMONS.forEach(s => {
        expect(s.bonusMultiplier).toBeGreaterThan(0);
      });
    });

    it('每个召唤兽有解锁费用', () => {
      SUMMONS.forEach(s => {
        expect(s.unlockCost).toBeGreaterThan(0);
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

    it('增加经验', () => {
      addExp(engine, 50);
      expect(getExp(engine)).toBe(50);
    });

    it('增加魔力', () => {
      addMana(engine, 30);
      expect(getMana(engine)).toBe(30);
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
      addExp(engine, 50);
      expect((engine as any).canAfford({ gold: 50, exp: 20 })).toBe(true);
      expect((engine as any).canAfford({ gold: 50, exp: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有酒馆解锁', () => {
      const tavern = (engine as any).upgrades.get('tavern');
      expect(tavern.unlocked).toBe(true);
    });

    it('训练场初始未解锁', () => {
      const trainingGround = (engine as any).upgrades.get('training_ground');
      expect(trainingGround.unlocked).toBe(false);
    });

    it('购买酒馆成功', () => {
      engine.start();
      addGold(engine, 100);
      const result = engine.purchaseBuilding(0); // tavern
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买酒馆失败（资源不足）', () => {
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
      // 训练场需要酒馆等级 > 0
      const result = engine.purchaseBuilding(1); // training_ground
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
      expect(listener).toHaveBeenCalledWith('tavern', 1);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('训练场在酒馆有等级后解锁', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      const trainingGround = (engine as any).upgrades.get('training_ground');
      expect(trainingGround.unlocked).toBe(true);
    });

    it('魔法塔在酒馆有等级后解锁', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      const magicTower = (engine as any).upgrades.get('magic_tower');
      expect(magicTower.unlocked).toBe(true);
    });

    it('铁匠铺在酒馆有等级后解锁', () => {
      engine.start();
      addGold(engine, 10000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      const blacksmith = (engine as any).upgrades.get('blacksmith');
      expect(blacksmith.unlocked).toBe(true);
    });

    it('斗技场需要训练场和铁匠铺', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(1); // training_ground
      engine.purchaseBuilding(3); // blacksmith
      tick(engine, 16);
      const arena = (engine as any).upgrades.get('arena');
      expect(arena.unlocked).toBe(true);
    });

    it('召唤殿需要魔法塔', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(2); // magic_tower
      tick(engine, 16);
      const shrine = (engine as any).upgrades.get('summoning_shrine');
      expect(shrine.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('经验在训练场购买后解锁', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(1); // training_ground
      tick(engine, 16);
      const exp = (engine as any).getResource('exp');
      expect(exp.unlocked).toBe(true);
    });

    it('魔力在魔法塔购买后解锁', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(2); // magic_tower
      tick(engine, 16);
      const mana = (engine as any).getResource('mana');
      expect(mana.unlocked).toBe(true);
    });
  });

  // ========== 职业系统 ==========

  describe('职业系统', () => {
    it('解锁法师需要 500 金币', () => {
      engine.start();
      addGold(engine, 500);
      const result = engine.unlockJob('mage');
      expect(result).toBe(true);
    });

    it('解锁法师失败（金币不足）', () => {
      engine.start();
      addGold(engine, 100);
      const result = engine.unlockJob('mage');
      expect(result).toBe(false);
    });

    it('重复解锁同一职业失败', () => {
      engine.start();
      addGold(engine, 2000);
      engine.unlockJob('mage');
      const result = engine.unlockJob('mage');
      expect(result).toBe(false);
    });

    it('解锁不存在的职业失败', () => {
      engine.start();
      const result = engine.unlockJob('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁职业触发 jobUnlocked 事件', () => {
      engine.start();
      addGold(engine, 500);
      const listener = vi.fn();
      engine.on('jobUnlocked', listener);
      engine.unlockJob('mage');
      expect(listener).toHaveBeenCalledWith('mage');
    });

    it('解锁职业增加统计计数', () => {
      engine.start();
      addGold(engine, 500);
      engine.unlockJob('mage');
      expect(engine.statistics.totalJobsUnlocked).toBe(2);
    });

    it('解锁盗贼需要 2000 金币', () => {
      engine.start();
      addGold(engine, 2000);
      const result = engine.unlockJob('thief');
      expect(result).toBe(true);
    });

    it('解锁牧师需要 8000 金币', () => {
      engine.start();
      addGold(engine, 8000);
      const result = engine.unlockJob('cleric');
      expect(result).toBe(true);
    });

    it('解锁龙骑士需要 30000 金币', () => {
      engine.start();
      addGold(engine, 30000);
      const result = engine.unlockJob('dragoon');
      expect(result).toBe(true);
    });

    it('解锁召唤师需要 100000 金币', () => {
      engine.start();
      addGold(engine, 100000);
      const result = engine.unlockJob('summoner');
      expect(result).toBe(true);
    });

    it('jobs getter 返回副本', () => {
      const jobs1 = engine.jobs;
      const jobs2 = engine.jobs;
      expect(jobs1).not.toBe(jobs2);
    });
  });

  // ========== 职业进阶 ==========

  describe('职业进阶', () => {
    it('进阶战士成功', () => {
      engine.start();
      addExp(engine, 100);
      addMana(engine, 50);
      const result = engine.promoteJob('warrior');
      expect(result).toBe(true);
      expect(engine.getJobPromotionLevel('warrior')).toBe(1);
    });

    it('进阶未解锁的职业失败', () => {
      engine.start();
      const result = engine.promoteJob('mage');
      expect(result).toBe(false);
    });

    it('进阶资源不足时失败', () => {
      engine.start();
      const result = engine.promoteJob('warrior');
      expect(result).toBe(false);
    });

    it('进阶后职业加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addExp(engine, 100);
      addMana(engine, 50);
      engine.promoteJob('warrior');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('进阶触发 jobPromoted 事件', () => {
      engine.start();
      addExp(engine, 100);
      addMana(engine, 50);
      const listener = vi.fn();
      engine.on('jobPromoted', listener);
      engine.promoteJob('warrior');
      expect(listener).toHaveBeenCalledWith('warrior', 1);
    });

    it('进阶增加统计计数', () => {
      engine.start();
      addExp(engine, 100);
      addMana(engine, 50);
      engine.promoteJob('warrior');
      expect(engine.statistics.totalPromotions).toBe(1);
    });

    it('获取进阶费用', () => {
      const cost1 = engine.getPromotionCost(1);
      expect(cost1).toBeDefined();
      expect(Object.keys(cost1).length).toBeGreaterThan(0);
    });

    it('高级进阶费用更高', () => {
      const cost1 = engine.getPromotionCost(1);
      const cost3 = engine.getPromotionCost(3);
      expect(cost3.exp).toBeGreaterThan(cost1.exp);
    });

    it('最大进阶等级为 5', () => {
      expect(MAX_PROMOTION_LEVEL).toBe(5);
    });

    it('超过最大进阶等级失败', () => {
      engine.start();
      // 手动设置进阶等级到最大
      const job = (engine as any)._jobs.find((j: any) => j.id === 'warrior');
      job.promotionLevel = MAX_PROMOTION_LEVEL;
      addExp(engine, 100000);
      addMana(engine, 100000);
      const result = engine.promoteJob('warrior');
      expect(result).toBe(false);
    });
  });

  // ========== 召唤兽系统 ==========

  describe('召唤兽系统', () => {
    it('解锁伊弗利特需要 50 魔力', () => {
      engine.start();
      addMana(engine, 50);
      const result = engine.unlockSummon('ifrit');
      expect(result).toBe(true);
    });

    it('解锁伊弗利特失败（魔力不足）', () => {
      engine.start();
      addMana(engine, 10);
      const result = engine.unlockSummon('ifrit');
      expect(result).toBe(false);
    });

    it('重复解锁同一召唤兽失败', () => {
      engine.start();
      addMana(engine, 200);
      engine.unlockSummon('ifrit');
      const result = engine.unlockSummon('ifrit');
      expect(result).toBe(false);
    });

    it('解锁不存在的召唤兽失败', () => {
      engine.start();
      const result = engine.unlockSummon('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁召唤兽触发 summonUnlocked 事件', () => {
      engine.start();
      addMana(engine, 50);
      const listener = vi.fn();
      engine.on('summonUnlocked', listener);
      engine.unlockSummon('ifrit');
      expect(listener).toHaveBeenCalledWith('ifrit');
    });

    it('解锁召唤兽增加统计计数', () => {
      engine.start();
      addMana(engine, 50);
      engine.unlockSummon('ifrit');
      expect(engine.statistics.totalSummonsUnlocked).toBe(1);
    });

    it('解锁湿婆需要 200 魔力', () => {
      engine.start();
      addMana(engine, 200);
      const result = engine.unlockSummon('shiva');
      expect(result).toBe(true);
    });

    it('解锁巴哈姆特需要 1000 魔力', () => {
      engine.start();
      addMana(engine, 1000);
      const result = engine.unlockSummon('bahamut');
      expect(result).toBe(true);
    });

    it('解锁奥丁需要 5000 魔力', () => {
      engine.start();
      addMana(engine, 5000);
      const result = engine.unlockSummon('odin');
      expect(result).toBe(true);
    });

    it('解锁亚历山大需要 20000 魔力', () => {
      engine.start();
      addMana(engine, 20000);
      const result = engine.unlockSummon('alexander');
      expect(result).toBe(true);
    });

    it('isSummonUnlocked 正确返回状态', () => {
      engine.start();
      expect(engine.isSummonUnlocked('ifrit')).toBe(false);
      addMana(engine, 50);
      engine.unlockSummon('ifrit');
      expect(engine.isSummonUnlocked('ifrit')).toBe(true);
    });

    it('summons getter 返回副本', () => {
      const summons1 = engine.summons;
      const summons2 = engine.summons;
      expect(summons1).not.toBe(summons2);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（战士加成）', () => {
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始金币产出倍率为 1（无金币加成职业）', () => {
      const mult = engine.getGoldProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('初始经验产出倍率为 1', () => {
      const mult = engine.getExpProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('初始魔力产出倍率为 1', () => {
      const mult = engine.getManaProductionMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随水晶增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * CRYSTAL_BONUS_MULTIPLIER, 2);
    });

    it('解锁龙骑士增加金币产出倍率', () => {
      engine.start();
      addGold(engine, 30000);
      engine.unlockJob('dragoon');
      const mult = engine.getGoldProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁法师增加魔力产出倍率', () => {
      engine.start();
      addGold(engine, 500);
      engine.unlockJob('mage');
      const mult = engine.getManaProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁牧师增加经验产出倍率', () => {
      engine.start();
      addGold(engine, 8000);
      engine.unlockJob('cleric');
      const mult = engine.getExpProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('解锁召唤兽增加对应倍率', () => {
      engine.start();
      addMana(engine, 50);
      engine.unlockSummon('ifrit');
      const mult = engine.getSummonMultiplier('gold');
      expect(mult).toBe(1.5);
    });

    it('解锁巴哈姆特增加所有倍率', () => {
      engine.start();
      addMana(engine, 1000);
      engine.unlockSummon('bahamut');
      expect(engine.getSummonMultiplier('gold')).toBe(2.0);
      expect(engine.getSummonMultiplier('exp')).toBe(2.0);
      expect(engine.getSummonMultiplier('mana')).toBe(2.0);
    });

    it('多个召唤兽倍率叠加', () => {
      engine.start();
      addMana(engine, 1050);
      engine.unlockSummon('ifrit');
      engine.unlockSummon('bahamut');
      const mult = engine.getSummonMultiplier('gold');
      expect(mult).toBeCloseTo(1.5 * 2.0, 1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始水晶为 0', () => {
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
      const crystals = engine.doPrestige();
      expect(crystals).toBeGreaterThan(0);
    });

    it('声望后水晶增加', () => {
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

    it('声望保留职业进阶等级', () => {
      engine.start();
      addExp(engine, 100);
      addMana(engine, 50);
      engine.promoteJob('warrior');
      const promoBefore = engine.getJobPromotionLevel('warrior');

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      const promoAfter = engine.getJobPromotionLevel('warrior');
      expect(promoAfter).toBe(promoBefore);
    });

    it('声望保留召唤兽解锁状态', () => {
      engine.start();
      addMana(engine, 50);
      engine.unlockSummon('ifrit');

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.isSummonUnlocked('ifrit')).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望增加声望统计计数', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.statistics.totalPrestigeCount).toBe(1);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('final-fantasy');
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

    it('save 包含职业、召唤兽和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).jobs).toBeDefined();
      expect((data.settings as any).summons).toBeDefined();
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

    it('load 恢复职业状态', () => {
      engine.start();
      addGold(engine, 500);
      engine.unlockJob('mage');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const jobs = engine2.jobs;
      const mage = jobs.find(j => j.id === 'mage');
      expect(mage?.unlocked).toBe(true);
    });

    it('load 恢复召唤兽状态', () => {
      engine.start();
      addMana(engine, 50);
      engine.unlockSummon('ifrit');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.isSummonUnlocked('ifrit')).toBe(true);
    });

    it('load 恢复声望数据', () => {
      engine.start();
      (engine as any).prestige.currency = 10;
      (engine as any).prestige.count = 3;
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect((engine2 as any).prestige.currency).toBe(10);
      expect((engine2 as any).prestige.count).toBe(3);
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
      expect(state.jobs).toBeDefined();
      expect(state.summons).toBeDefined();
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

    it('loadState 恢复职业', () => {
      engine.start();
      addGold(engine, 500);
      engine.unlockJob('mage');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const jobs = engine2.jobs;
      const mage = jobs.find(j => j.id === 'mage');
      expect(mage?.unlocked).toBe(true);
    });

    it('loadState 恢复召唤兽', () => {
      engine.start();
      addMana(engine, 50);
      engine.unlockSummon('ifrit');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.isSummonUnlocked('ifrit')).toBe(true);
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

    it('J 键进阶职业', () => {
      engine.start();
      addExp(engine, 100);
      addMana(engine, 50);
      engine.handleKeyDown('j');
      expect(engine.getJobPromotionLevel('warrior')).toBe(1);
    });

    it('大写 J 键进阶职业', () => {
      engine.start();
      addExp(engine, 100);
      addMana(engine, 50);
      engine.handleKeyDown('J');
      expect(engine.getJobPromotionLevel('warrior')).toBe(1);
    });

    it('S 键解锁召唤兽', () => {
      engine.start();
      addMana(engine, 50);
      engine.handleKeyDown('s');
      expect(engine.isSummonUnlocked('ifrit')).toBe(true);
    });

    it('大写 S 键解锁召唤兽', () => {
      engine.start();
      addMana(engine, 50);
      engine.handleKeyDown('S');
      expect(engine.isSummonUnlocked('ifrit')).toBe(true);
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

    it('有职业进阶时渲染正常', () => {
      engine.start();
      addExp(engine, 100);
      addMana(engine, 50);
      engine.promoteJob('warrior');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有召唤兽时渲染正常', () => {
      engine.start();
      addMana(engine, 50);
      engine.unlockSummon('ifrit');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('不同职业渲染正常', () => {
      engine.start();
      // 测试各种职业的渲染
      const jobIds = ['warrior', 'mage', 'thief', 'cleric', 'dragoon', 'summoner'];
      for (const jobId of jobIds) {
        const job = (engine as any)._jobs.find((j: any) => j.id === jobId);
        if (job) {
          // 先解锁所有
          const prev = (engine as any)._jobs.find((j: any) => j.id === 'warrior');
          if (prev) prev.unlocked = false;
          job.unlocked = true;
        }
        const ctx = createMockCtx();
        expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
        // 恢复
        if (jobId !== 'warrior') {
          job.unlocked = false;
          const warrior = (engine as any)._jobs.find((j: any) => j.id === 'warrior');
          if (warrior) warrior.unlocked = true;
        }
      }
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // tavern
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

    it('经验建筑产出经验', () => {
      engine.start();
      addGold(engine, 100000);
      // 购买酒馆
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      // 购买训练场
      engine.purchaseBuilding(1); // training_ground
      tick(engine, 16);
      const before = getExp(engine);
      tick(engine, 1000);
      const after = getExp(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('魔力建筑产出魔力', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(2); // magic_tower
      tick(engine, 16);
      const before = getMana(engine);
      tick(engine, 1000);
      const after = getMana(engine);
      expect(after).toBeGreaterThan(before);
    });
  });

  // ========== 产出计算 ==========

  describe('产出计算', () => {
    it('购买建筑后正确计算产出', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0); // tavern
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('解锁职业后重新计算产出', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0);
      engine.unlockJob('mage'); // 魔力产出加成
      // 不崩溃即可
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('解锁召唤兽后重新计算产出', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0);
      addMana(engine, 50);
      engine.unlockSummon('ifrit');
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('声望加成影响产出', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0);
      const prodBefore = (engine as any).getResource('gold').perSecond;
      (engine as any).prestige.currency = 5;
      (engine as any).recalculateProduction();
      const prodAfter = (engine as any).getResource('gold').perSecond;
      expect(prodAfter).toBeGreaterThan(prodBefore);
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

    it('getJobPromotionLevel 不存在的职业返回 0', () => {
      expect(engine.getJobPromotionLevel('nonexistent')).toBe(0);
    });

    it('isSummonUnlocked 不存在的召唤兽返回 false', () => {
      expect(engine.isSummonUnlocked('nonexistent')).toBe(false);
    });

    it('getPromotionCost 无效等级返回空对象', () => {
      const cost = engine.getPromotionCost(99);
      expect(Object.keys(cost).length).toBe(0);
    });
  });
});
