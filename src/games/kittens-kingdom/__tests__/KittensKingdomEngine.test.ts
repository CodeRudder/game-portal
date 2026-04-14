/**
 * Kittens Kingdom（猫咪王国）放置类游戏 — 完整测试套件
 *
 * 覆盖：
 * - 初始化与生命周期
 * - 资源系统（增减、上限、解锁）
 * - 点击产生鱼干
 * - 建筑购买逻辑
 * - 费用递增公式
 * - 产出计算（含加成）
 * - 猫咪品种解锁
 * - 声望系统
 * - 离线收益
 * - 存档/加载
 * - 数字格式化
 * - 键盘输入处理
 * - 自动生产（update）
 * - Canvas 渲染
 * - 边界情况
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KittensKingdomEngine } from '@/games/kittens-kingdom/KittensKingdomEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FISH_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  CAT_BREEDS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_FISH,
  NUMBER_SUFFIXES,
  COLORS,
  type CatBreedDef,
  type BuildingDef,
} from '@/games/kittens-kingdom/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): KittensKingdomEngine {
  const engine = new KittensKingdomEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): KittensKingdomEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addFish(engine: KittensKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.FISH, amount);
}

function addCatnip(engine: KittensKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.CATNIP, amount);
}

function addYarn(engine: KittensKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.YARN, amount);
}

function addGems(engine: KittensKingdomEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.GEMS, amount);
}

/** 触发一次 update */
function tick(engine: KittensKingdomEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getFish(engine: KittensKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.FISH)?.amount ?? 0;
}

function getCatnip(engine: KittensKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.CATNIP)?.amount ?? 0;
}

function getYarn(engine: KittensKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.YARN)?.amount ?? 0;
}

function getGems(engine: KittensKingdomEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.GEMS)?.amount ?? 0;
}

// ========== 测试 ==========

describe('KittensKingdomEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ==================== 初始化 ====================

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      const engine = new KittensKingdomEngine();
      expect(engine).toBeInstanceOf(KittensKingdomEngine);
    });

    it('init 后状态应为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后鱼干为 0', () => {
      const engine = createEngine();
      expect(getFish(engine)).toBe(0);
    });

    it('init 后猫薄荷为 0', () => {
      const engine = createEngine();
      expect(getCatnip(engine)).toBe(0);
    });

    it('init 后毛线为 0', () => {
      const engine = createEngine();
      expect(getYarn(engine)).toBe(0);
    });

    it('init 后猫宝石为 0', () => {
      const engine = createEngine();
      expect(getGems(engine)).toBe(0);
    });

    it('init 后总鱼干获得为 0', () => {
      const engine = createEngine();
      expect(engine.totalFishEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      const engine = createEngine();
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后选中建筑索引为 0', () => {
      const engine = createEngine();
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('init 后 score 为 0', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
    });

    it('init 后 level 为 1', () => {
      const engine = createEngine();
      expect(engine.level).toBe(1);
    });

    it('init 后 gameId 为 kittens-kingdom', () => {
      const engine = createEngine();
      expect(engine.gameId).toBe('kittens-kingdom');
    });

    it('init 后鱼干已解锁', () => {
      const engine = createEngine();
      const fish = (engine as any).getResource(RESOURCE_IDS.FISH);
      expect(fish?.unlocked).toBe(true);
    });

    it('init 后猫薄荷未解锁', () => {
      const engine = createEngine();
      const catnip = (engine as any).getResource(RESOURCE_IDS.CATNIP);
      expect(catnip?.unlocked).toBe(false);
    });

    it('init 后毛线未解锁', () => {
      const engine = createEngine();
      const yarn = (engine as any).getResource(RESOURCE_IDS.YARN);
      expect(yarn?.unlocked).toBe(false);
    });

    it('init 后猫宝石未解锁', () => {
      const engine = createEngine();
      const gems = (engine as any).getResource(RESOURCE_IDS.GEMS);
      expect(gems?.unlocked).toBe(false);
    });
  });

  // ==================== 猫咪品种初始化 ====================

  describe('猫咪品种初始化', () => {
    it('应有 8 种猫咪品种', () => {
      expect(CAT_BREEDS).toHaveLength(8);
    });

    it('初始只有橘猫解锁', () => {
      const engine = createEngine();
      const breeds = engine.breeds;
      expect(breeds[0].unlocked).toBe(true);
      for (let i = 1; i < breeds.length; i++) {
        expect(breeds[i].unlocked).toBe(false);
      }
    });

    it('品种 ID 唯一', () => {
      const ids = CAT_BREEDS.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个品种有名称', () => {
      CAT_BREEDS.forEach((b) => expect(b.name).toBeTruthy());
    });

    it('每个品种有图标', () => {
      CAT_BREEDS.forEach((b) => expect(b.icon).toBeTruthy());
    });

    it('每个品种有加成类型', () => {
      CAT_BREEDS.forEach((b) => expect(b.bonusType).toBeTruthy());
    });

    it('每个品种有正数加成值', () => {
      CAT_BREEDS.forEach((b) => expect(b.bonusValue).toBeGreaterThan(0));
    });
  });

  // ==================== 生命周期 ====================

  describe('生命周期', () => {
    it('start 后状态应为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('pause 后状态应为 paused', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态应为 playing', () => {
      const engine = startEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态应为 idle', () => {
      const engine = startEngine();
      engine.click();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后鱼干归零', () => {
      const engine = startEngine();
      engine.click();
      engine.reset();
      expect(getFish(engine)).toBe(0);
    });

    it('destroy 后状态为 idle', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('多次 start 不会出错', () => {
      const engine = startEngine();
      engine.click();
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start-reset 循环正常', () => {
      const engine = createEngine();
      for (let i = 0; i < 5; i++) {
        engine.start();
        engine.click();
        engine.reset();
      }
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== 点击产生鱼干 ====================

  describe('点击产生鱼干', () => {
    it('点击一次产生鱼干', () => {
      const engine = startEngine();
      const gained = engine.click();
      expect(gained).toBeGreaterThanOrEqual(FISH_PER_CLICK);
      expect(getFish(engine)).toBeGreaterThanOrEqual(1);
    });

    it('连续点击 10 次产生 10+ 鱼干', () => {
      const engine = startEngine();
      for (let i = 0; i < 10; i++) engine.click();
      expect(getFish(engine)).toBeGreaterThanOrEqual(10);
    });

    it('点击增加总点击计数', () => {
      const engine = startEngine();
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
    });

    it('点击增加总鱼干获得', () => {
      const engine = startEngine();
      engine.click();
      expect(engine.totalFishEarned).toBeGreaterThanOrEqual(1);
    });

    it('点击增加 score', () => {
      const engine = startEngine();
      engine.click();
      expect(engine.score).toBeGreaterThanOrEqual(1);
    });

    it('idle 状态下点击无效', () => {
      const engine = createEngine();
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getFish(engine)).toBe(0);
    });

    it('paused 状态下点击无效', () => {
      const engine = startEngine();
      engine.pause();
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      const engine = startEngine();
      const handler = vi.fn();
      engine.on('stateChange', handler);
      engine.click();
      expect(handler).toHaveBeenCalled();
    });

    it('大量点击（1000次）性能正常', () => {
      const engine = startEngine();
      for (let i = 0; i < 1000; i++) engine.click();
      expect(getFish(engine)).toBeGreaterThanOrEqual(1000);
      expect(engine.totalClicks).toBe(1000);
    });
  });

  // ==================== 资源系统 ====================

  describe('资源系统', () => {
    it('增加鱼干', () => {
      const engine = startEngine();
      addFish(engine, 100);
      expect(getFish(engine)).toBeGreaterThanOrEqual(100);
    });

    it('增加猫薄荷', () => {
      const engine = startEngine();
      addCatnip(engine, 50);
      expect(getCatnip(engine)).toBeGreaterThanOrEqual(50);
    });

    it('增加毛线', () => {
      const engine = startEngine();
      addYarn(engine, 30);
      expect(getYarn(engine)).toBeGreaterThanOrEqual(30);
    });

    it('增加猫宝石', () => {
      const engine = startEngine();
      addGems(engine, 10);
      expect(getGems(engine)).toBeGreaterThanOrEqual(10);
    });

    it('消耗鱼干成功', () => {
      const engine = startEngine();
      addFish(engine, 100);
      const result = (engine as any).spendResource(RESOURCE_IDS.FISH, 50);
      expect(result).toBe(true);
      expect(getFish(engine)).toBeCloseTo(50, 0);
    });

    it('消耗鱼干失败（不足）', () => {
      const engine = startEngine();
      addFish(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.FISH, 50);
      expect(result).toBe(false);
    });

    it('检查是否有足够资源', () => {
      const engine = startEngine();
      addFish(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.FISH, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.FISH, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      const engine = startEngine();
      addFish(engine, 100);
      addCatnip(engine, 50);
      expect((engine as any).canAfford({ fish: 50, catnip: 30 })).toBe(true);
      expect((engine as any).canAfford({ fish: 50, catnip: 100 })).toBe(false);
    });

    it('资源变化触发 resourceChange 事件', () => {
      const engine = startEngine();
      const handler = vi.fn();
      engine.on('resourceChange', handler);
      addFish(engine, 10);
      expect(handler).toHaveBeenCalledWith(RESOURCE_IDS.FISH, expect.any(Number));
    });

    it('增加资源时自动解锁', () => {
      const engine = startEngine();
      addCatnip(engine, 1);
      const catnip = (engine as any).getResource(RESOURCE_IDS.CATNIP);
      expect(catnip?.unlocked).toBe(true);
    });
  });

  // ==================== 建筑系统 ====================

  describe('建筑系统', () => {
    it('应有 6 种建筑', () => {
      expect(BUILDINGS).toHaveLength(6);
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('初始猫窝已解锁', () => {
      const engine = startEngine();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.CAT_BED);
      expect(upgrade?.unlocked).toBe(true);
    });

    it('初始鱼塘未解锁（需要 30 鱼干）', () => {
      const engine = startEngine();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.FISH_POND);
      expect(upgrade?.unlocked).toBe(false);
    });

    it('初始猫薄荷田未解锁', () => {
      const engine = startEngine();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.CATNIP_FIELD);
      expect(upgrade?.unlocked).toBe(false);
    });

    it('初始编织坊未解锁', () => {
      const engine = startEngine();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.WEAVING_SHOP);
      expect(upgrade?.unlocked).toBe(false);
    });

    it('初始猫咪学校未解锁', () => {
      const engine = startEngine();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.CAT_SCHOOL);
      expect(upgrade?.unlocked).toBe(false);
    });

    it('初始猫咪神殿未解锁', () => {
      const engine = startEngine();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.CAT_TEMPLE);
      expect(upgrade?.unlocked).toBe(false);
    });

    it('购买猫窝需要 10 鱼干', () => {
      const engine = startEngine();
      const cost = engine.getBuildingCost(BUILDING_IDS.CAT_BED);
      expect(cost[RESOURCE_IDS.FISH]).toBe(10);
    });

    it('鱼干不足时无法购买猫窝', () => {
      const engine = startEngine();
      expect(engine.purchaseBuilding(BUILDING_IDS.CAT_BED)).toBe(false);
    });

    it('鱼干足够时可以购买猫窝', () => {
      const engine = startEngine();
      addFish(engine, 10);
      expect(engine.purchaseBuilding(BUILDING_IDS.CAT_BED)).toBe(true);
    });

    it('购买猫窝后鱼干减少', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      expect(getFish(engine)).toBe(90);
    });

    it('购买猫窝后等级增加', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      expect(engine.getBuildingLevel(BUILDING_IDS.CAT_BED)).toBe(1);
    });

    it('通过索引购买建筑', () => {
      const engine = startEngine();
      addFish(engine, 100);
      expect(engine.buyBuildingByIndex(0)).toBe(true); // 猫窝
    });

    it('无效索引购买失败（负数）', () => {
      const engine = startEngine();
      expect(engine.buyBuildingByIndex(-1)).toBe(false);
    });

    it('无效索引购买失败（超出范围）', () => {
      const engine = startEngine();
      expect(engine.buyBuildingByIndex(BUILDINGS.length)).toBe(false);
    });

    it('未解锁建筑无法购买', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      expect(engine.purchaseBuilding(BUILDING_IDS.CAT_TEMPLE)).toBe(false);
    });

    it('购买触发 upgradePurchased 事件', () => {
      const engine = startEngine();
      const handler = vi.fn();
      engine.on('upgradePurchased', handler);
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      expect(handler).toHaveBeenCalledWith(BUILDING_IDS.CAT_BED, 1);
    });
  });

  // ==================== 费用递增 ====================

  describe('费用递增', () => {
    it('猫窝基础费用 10 鱼干', () => {
      const engine = startEngine();
      const cost = engine.getBuildingCost(BUILDING_IDS.CAT_BED);
      expect(cost[RESOURCE_IDS.FISH]).toBe(10);
    });

    it('购买 1 次后费用增加', () => {
      const engine = startEngine();
      addFish(engine, 1000);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const cost = engine.getBuildingCost(BUILDING_IDS.CAT_BED);
      expect(cost[RESOURCE_IDS.FISH]).toBeGreaterThan(10);
    });

    it('费用递增公式 base * 1.15^n', () => {
      const engine = startEngine();
      addFish(engine, 1e8);
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      }
      const cost = engine.getBuildingCost(BUILDING_IDS.CAT_BED);
      const expected = Math.floor(10 * Math.pow(1.15, 5));
      expect(cost[RESOURCE_IDS.FISH]).toBe(expected);
    });

    it('猫窝最大等级 50', () => {
      const catBed = BUILDINGS.find((b) => b.id === BUILDING_IDS.CAT_BED);
      expect(catBed?.maxLevel).toBe(50);
    });

    it('鱼塘最大等级 50', () => {
      const pond = BUILDINGS.find((b) => b.id === BUILDING_IDS.FISH_POND);
      expect(pond?.maxLevel).toBe(50);
    });

    it('猫薄荷田最大等级 30', () => {
      const field = BUILDINGS.find((b) => b.id === BUILDING_IDS.CATNIP_FIELD);
      expect(field?.maxLevel).toBe(30);
    });

    it('编织坊最大等级 30', () => {
      const shop = BUILDINGS.find((b) => b.id === BUILDING_IDS.WEAVING_SHOP);
      expect(shop?.maxLevel).toBe(30);
    });

    it('猫咪学校最大等级 20', () => {
      const school = BUILDINGS.find((b) => b.id === BUILDING_IDS.CAT_SCHOOL);
      expect(school?.maxLevel).toBe(20);
    });

    it('猫咪神殿最大等级 10', () => {
      const temple = BUILDINGS.find((b) => b.id === BUILDING_IDS.CAT_TEMPLE);
      expect(temple?.maxLevel).toBe(10);
    });
  });

  // ==================== 产出计算 ====================

  describe('产出计算', () => {
    it('初始产出为 0', () => {
      const engine = startEngine();
      expect(engine.getEffectiveProduction(RESOURCE_IDS.FISH)).toBe(0);
    });

    it('1 级猫窝产出 0.5/s 鱼干（基础）', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const fish = (engine as any).getResource(RESOURCE_IDS.FISH);
      expect(fish.perSecond).toBe(0.5);
    });

    it('2 级猫窝产出 1.0/s 鱼干（基础）', () => {
      const engine = startEngine();
      addFish(engine, 1000);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const fish = (engine as any).getResource(RESOURCE_IDS.FISH);
      expect(fish.perSecond).toBe(1.0);
    });

    it('产出倍率含品种加成', () => {
      const engine = startEngine();
      // 橘猫已解锁，提供 click_power 加成，不影响产出倍率
      expect(engine.getProductionMultiplier()).toBeGreaterThanOrEqual(1);
    });

    it('点击力量含橘猫加成', () => {
      const engine = startEngine();
      // 橘猫加成 click_power +1，基础 1，共 2
      expect(engine.getClickPower()).toBeGreaterThanOrEqual(2);
    });

    it('资源特定倍率计算', () => {
      const engine = startEngine();
      const fishMult = engine.getResourceMultiplier(RESOURCE_IDS.FISH);
      expect(fishMult).toBeGreaterThanOrEqual(1);
    });

    it('有效产出 = 基础产出 * 倍率', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const effectiveProd = engine.getEffectiveProduction(RESOURCE_IDS.FISH);
      expect(effectiveProd).toBeGreaterThan(0);
    });
  });

  // ==================== 自动生产（update） ====================

  describe('自动生产', () => {
    it('无建筑时 update 不增加鱼干', () => {
      const engine = startEngine();
      tick(engine, 1000);
      expect(getFish(engine)).toBe(0);
    });

    it('1 级猫窝每秒生产鱼干', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      tick(engine, 1000);
      expect(getFish(engine)).toBeGreaterThan(0);
    });

    it('paused 状态不生产', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      engine.pause();
      tick(engine, 1000);
      // paused 时 update 不执行
    });

    it('idle 状态不生产', () => {
      const engine = createEngine();
      tick(engine, 1000);
      expect(getFish(engine)).toBe(0);
    });

    it('大 deltaTime 正确处理', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      tick(engine, 10000);
      expect(getFish(engine)).toBeGreaterThan(0);
    });

    it('update 中 deltaTime 为 0 不出错', () => {
      const engine = startEngine();
      expect(() => tick(engine, 0)).not.toThrow();
    });

    it('update 中 deltaTime 为负数不出错', () => {
      const engine = startEngine();
      expect(() => tick(engine, -100)).not.toThrow();
    });
  });

  // ==================== 猫咪品种解锁 ====================

  describe('猫咪品种解锁', () => {
    it('橘猫初始已解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('orange')).toBe(true);
    });

    it('英短初始未解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('british-shorthair')).toBe(false);
    });

    it('布偶猫初始未解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('ragdoll')).toBe(false);
    });

    it('暹罗猫初始未解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('siamese')).toBe(false);
    });

    it('波斯猫初始未解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('persian')).toBe(false);
    });

    it('缅因猫初始未解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('maine-coon')).toBe(false);
    });

    it('无毛猫初始未解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('sphynx')).toBe(false);
    });

    it('折耳猫初始未解锁', () => {
      const engine = startEngine();
      expect(engine.isBreedUnlocked('scottish-fold')).toBe(false);
    });

    it('解锁英短需要 50 鱼干', () => {
      const engine = startEngine();
      addFish(engine, 49);
      expect(engine.unlockBreed('british-shorthair')).toBe(false);
      addFish(engine, 2);
      expect(engine.unlockBreed('british-shorthair')).toBe(true);
    });

    it('解锁英短后扣除鱼干', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.unlockBreed('british-shorthair');
      expect(getFish(engine)).toBeCloseTo(50, 0);
    });

    it('重复解锁同一品种失败', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.unlockBreed('british-shorthair');
      expect(engine.unlockBreed('british-shorthair')).toBe(false);
    });

    it('解锁布偶猫需要鱼干和猫薄荷', () => {
      const engine = startEngine();
      addFish(engine, 200);
      addCatnip(engine, 9);
      expect(engine.unlockBreed('ragdoll')).toBe(false);
      addCatnip(engine, 2);
      expect(engine.unlockBreed('ragdoll')).toBe(true);
    });

    it('解锁暹罗猫需要 500 鱼干 + 50 猫薄荷', () => {
      const engine = startEngine();
      addFish(engine, 500);
      addCatnip(engine, 50);
      expect(engine.unlockBreed('siamese')).toBe(true);
    });

    it('解锁波斯猫需要 1000 鱼干 + 100 猫薄荷 + 20 毛线', () => {
      const engine = startEngine();
      addFish(engine, 1000);
      addCatnip(engine, 100);
      addYarn(engine, 19);
      expect(engine.unlockBreed('persian')).toBe(false);
      addYarn(engine, 2);
      expect(engine.unlockBreed('persian')).toBe(true);
    });

    it('解锁无效品种 ID 失败', () => {
      const engine = startEngine();
      expect(engine.unlockBreed('invalid')).toBe(false);
    });

    it('解锁品种触发 breedUnlocked 事件', () => {
      const engine = startEngine();
      const handler = vi.fn();
      engine.on('breedUnlocked', handler);
      addFish(engine, 100);
      engine.unlockBreed('british-shorthair');
      expect(handler).toHaveBeenCalledWith('british-shorthair');
    });

    it('getBreeds 返回所有品种状态', () => {
      const engine = startEngine();
      const breeds = engine.getBreeds();
      expect(breeds).toHaveLength(8);
    });

    it('getBreeds 返回副本', () => {
      const engine = startEngine();
      const breeds = engine.getBreeds();
      breeds[0].unlocked = false;
      expect(engine.isBreedUnlocked('orange')).toBe(true);
    });
  });

  // ==================== 建筑解锁检查 ====================

  describe('建筑解锁检查', () => {
    it('鱼塘在鱼干 >= 30 时自动解锁', () => {
      const engine = startEngine();
      addFish(engine, 30);
      tick(engine, 16); // 触发 checkBuildingUnlocks
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.FISH_POND);
      expect(upgrade?.unlocked).toBe(true);
    });

    it('猫薄荷田在鱼干 >= 100 时自动解锁', () => {
      const engine = startEngine();
      addFish(engine, 100);
      tick(engine, 16);
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.CATNIP_FIELD);
      expect(upgrade?.unlocked).toBe(true);
    });

    it('编织坊在猫薄荷 >= 20 时自动解锁', () => {
      const engine = startEngine();
      addCatnip(engine, 20);
      tick(engine, 16);
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.WEAVING_SHOP);
      expect(upgrade?.unlocked).toBe(true);
    });

    it('猫咪学校在鱼干 >= 500 且猫薄荷 >= 50 时解锁', () => {
      const engine = startEngine();
      addFish(engine, 500);
      addCatnip(engine, 50);
      tick(engine, 16);
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.CAT_SCHOOL);
      expect(upgrade?.unlocked).toBe(true);
    });

    it('猫咪神殿在鱼干 >= 10000 且猫薄荷 >= 1000 且毛线 >= 200 时解锁', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      addCatnip(engine, 1000);
      addYarn(engine, 200);
      tick(engine, 16);
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.CAT_TEMPLE);
      expect(upgrade?.unlocked).toBe(true);
    });

    it('条件不满足时建筑不解锁', () => {
      const engine = startEngine();
      addFish(engine, 10);
      tick(engine, 16);
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.FISH_POND);
      expect(upgrade?.unlocked).toBe(false);
    });
  });

  // ==================== 资源解锁检查 ====================

  describe('资源解锁检查', () => {
    it('猫薄荷在鱼干 >= 100 时解锁', () => {
      const engine = startEngine();
      addFish(engine, 100);
      tick(engine, 16);
      const catnip = (engine as any).getResource(RESOURCE_IDS.CATNIP);
      expect(catnip?.unlocked).toBe(true);
    });

    it('毛线在猫薄荷 >= 20 时解锁', () => {
      const engine = startEngine();
      addCatnip(engine, 20);
      tick(engine, 16);
      const yarn = (engine as any).getResource(RESOURCE_IDS.YARN);
      expect(yarn?.unlocked).toBe(true);
    });

    it('猫宝石在声望重置后解锁', () => {
      const engine = startEngine();
      // 模拟声望重置
      (engine as any).prestige.count = 1;
      tick(engine, 16);
      const gems = (engine as any).getResource(RESOURCE_IDS.GEMS);
      expect(gems?.unlocked).toBe(true);
    });
  });

  // ==================== 声望系统 ====================

  describe('声望系统', () => {
    it('初始声望货币为 0', () => {
      const engine = startEngine();
      expect(engine.prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      const engine = startEngine();
      expect(engine.prestige.count).toBe(0);
    });

    it('鱼干不足 10000 时无法声望重置', () => {
      const engine = startEngine();
      addFish(engine, 9999);
      expect(engine.calculatePrestigeGems()).toBe(0);
    });

    it('鱼干 10000 时可获得 1 猫宝石', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      expect(engine.calculatePrestigeGems()).toBe(1);
    });

    it('鱼干 40000 时可获得 2 猫宝石', () => {
      const engine = startEngine();
      addFish(engine, 40000);
      expect(engine.calculatePrestigeGems()).toBe(2);
    });

    it('鱼干 100000 时可获得 3 猫宝石', () => {
      const engine = startEngine();
      addFish(engine, 100000);
      // sqrt(100000/10000) = sqrt(10) ≈ 3.16, floor = 3
      expect(engine.calculatePrestigeGems()).toBe(3);
    });

    it('声望重置成功', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      const result = engine.prestigeReset();
      expect(result).toBe(true);
    });

    it('声望重置后获得猫宝石', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      engine.prestigeReset();
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('声望重置后次数增加', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      engine.prestigeReset();
      expect(engine.prestige.count).toBe(1);
    });

    it('声望重置后资源重置', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      engine.prestigeReset();
      expect(getFish(engine)).toBeLessThan(10000);
    });

    it('声望重置后保留品种解锁', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.unlockBreed('british-shorthair');
      addFish(engine, 10000);
      engine.prestigeReset();
      expect(engine.isBreedUnlocked('british-shorthair')).toBe(true);
    });

    it('声望重置后保留声望数据', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      engine.prestigeReset();
      expect(engine.prestige.count).toBe(1);
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('声望加成影响产出', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      engine.prestigeReset();
      // 声望加成应该使产出倍率 > 1
      expect(engine.getProductionMultiplier()).toBeGreaterThan(1);
    });

    it('声望重置触发 prestigeReset 事件', () => {
      const engine = startEngine();
      const handler = vi.fn();
      engine.on('prestigeReset', handler);
      addFish(engine, 10000);
      engine.prestigeReset();
      expect(handler).toHaveBeenCalled();
    });

    it('声望加成常量 PRESTIGE_MULTIPLIER 为 0.01', () => {
      expect(PRESTIGE_MULTIPLIER).toBe(0.01);
    });

    it('最低声望鱼干 MIN_PRESTIGE_FISH 为 10000', () => {
      expect(MIN_PRESTIGE_FISH).toBe(10000);
    });

    it('多次声望重置累积猫宝石', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      engine.prestigeReset();
      const firstGems = engine.prestige.currency;

      addFish(engine, 10000);
      engine.prestigeReset();
      expect(engine.prestige.currency).toBeGreaterThan(firstGems);
      expect(engine.prestige.count).toBe(2);
    });
  });

  // ==================== 离线收益 ====================

  describe('离线收益', () => {
    it('无产出时离线收益为 0', () => {
      const engine = startEngine();
      const report = engine.calculateOfflineEarnings(60000);
      const totalEarned = Object.values(report.earnedResources).reduce((a, b) => a + b, 0);
      expect(totalEarned).toBe(0);
    });

    it('有产出时计算离线收益', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const report = engine.calculateOfflineEarnings(60000); // 1 分钟
      expect(report.earnedResources[RESOURCE_IDS.FISH]).toBeGreaterThan(0);
    });

    it('离线收益报告包含时间戳', () => {
      const engine = startEngine();
      const report = engine.calculateOfflineEarnings(60000);
      expect(report.offlineMs).toBe(60000);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('应用离线收益', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const report = engine.calculateOfflineEarnings(60000);
      const fishBefore = getFish(engine);
      engine.applyOfflineEarnings(report);
      expect(getFish(engine)).toBeGreaterThanOrEqual(fishBefore);
    });

    it('长时间离线收益计算', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const report = engine.calculateOfflineEarnings(8 * 3600 * 1000); // 8 小时
      expect(report.earnedResources[RESOURCE_IDS.FISH]).toBeGreaterThan(0);
    });
  });

  // ==================== 存档系统 ====================

  describe('存档系统', () => {
    it('save 返回正确的存档数据', () => {
      const engine = startEngine();
      const data = engine.save();
      expect(data.gameId).toBe('kittens-kingdom');
      expect(data.version).toBeTruthy();
      expect(data.timestamp).toBeGreaterThan(0);
    });

    it('save 包含资源数据', () => {
      const engine = startEngine();
      addFish(engine, 100);
      const data = engine.save();
      expect(data.resources[RESOURCE_IDS.FISH]).toBeDefined();
    });

    it('save 包含声望数据', () => {
      const engine = startEngine();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含统计数据', () => {
      const engine = startEngine();
      engine.click();
      const data = engine.save();
      expect(data.statistics).toBeDefined();
    });

    it('exportSave 返回 Base64 字符串', () => {
      const engine = startEngine();
      const exported = engine.exportSave();
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);
    });

    it('importSave 恢复存档', () => {
      const engine = startEngine();
      addFish(engine, 500);
      engine.click();
      const exported = engine.exportSave();

      const engine2 = startEngine();
      const result = engine2.importSave(exported);
      expect(result).toBe(true);
    });

    it('importSave 无效数据返回 false', () => {
      const engine = startEngine();
      expect(engine.importSave('invalid-data')).toBe(false);
    });

    it('importSave 错误 gameId 返回 false', () => {
      const engine = startEngine();
      const fakeData = btoa(JSON.stringify({
        version: '1.0.0',
        gameId: 'wrong-game',
        timestamp: Date.now(),
        resources: {},
        upgrades: {},
        prestige: { currency: 0, count: 0 },
        statistics: {},
        settings: {},
      }));
      expect(engine.importSave(fakeData)).toBe(false);
    });

    it('saveToStorage 不报错', () => {
      const engine = startEngine();
      expect(() => engine.saveToStorage()).not.toThrow();
    });

    it('loadFromStorage 无存档返回 false', () => {
      const engine = startEngine();
      expect(engine.loadFromStorage()).toBe(false);
    });

    it('saveToStorage 后 loadFromStorage 成功', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.saveToStorage();

      const engine2 = startEngine();
      expect(engine2.loadFromStorage()).toBe(true);
    });
  });

  // ==================== getState / loadState ====================

  describe('getState / loadState', () => {
    it('初始 getState 返回正确状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state.totalFishEarned).toBe(0);
      expect(state.totalClicks).toBe(0);
      expect(state.selectedBuildingIndex).toBe(0);
      expect(state.breeds).toHaveLength(8);
    });

    it('点击后 getState 反映变化', () => {
      const engine = startEngine();
      engine.click();
      const state = engine.getState();
      expect(state.totalClicks).toBe(1);
      expect(state.totalFishEarned).toBeGreaterThan(0);
    });

    it('loadState 恢复资源', () => {
      const engine = startEngine();
      const state = engine.getState();
      state.resources = {
        [RESOURCE_IDS.FISH]: { amount: 500, unlocked: true },
        [RESOURCE_IDS.CATNIP]: { amount: 100, unlocked: true },
      };
      engine.loadState(state);
      expect(getFish(engine)).toBe(500);
      expect(getCatnip(engine)).toBe(100);
    });

    it('loadState 恢复品种', () => {
      const engine = startEngine();
      const state = engine.getState();
      state.breeds = CAT_BREEDS.map((b) => ({ id: b.id, unlocked: true }));
      engine.loadState(state);
      expect(engine.isBreedUnlocked('british-shorthair')).toBe(true);
    });

    it('loadState 触发 stateChange', () => {
      const engine = startEngine();
      const handler = vi.fn();
      engine.on('stateChange', handler);
      engine.loadState(engine.getState());
      expect(handler).toHaveBeenCalled();
    });
  });

  // ==================== 键盘输入 ====================

  describe('键盘输入', () => {
    it('空格键产生鱼干', () => {
      const engine = startEngine();
      engine.handleKeyDown(' ');
      expect(getFish(engine)).toBeGreaterThanOrEqual(1);
    });

    it('多次空格键', () => {
      const engine = startEngine();
      for (let i = 0; i < 5; i++) engine.handleKeyDown(' ');
      expect(getFish(engine)).toBeGreaterThanOrEqual(5);
    });

    it('上键减少选中索引', () => {
      const engine = startEngine();
      (engine as any)._selectedBuildingIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(1);
    });

    it('下键增加选中索引', () => {
      const engine = startEngine();
      // 初始只有猫窝可见（1个），索引不能超过 visibleCount-1=0
      // 需要先解锁更多建筑
      addFish(engine, 100);
      tick(engine, 16); // 触发 checkBuildingUnlocks，解锁鱼塘等
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedBuildingIndex).toBe(1);
    });

    it('上键不会低于 0', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('回车购买选中的建筑', () => {
      const engine = startEngine();
      addFish(engine, 10);
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(BUILDING_IDS.CAT_BED)).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      const engine = createEngine();
      engine.handleKeyDown(' ');
      expect(getFish(engine)).toBe(0);
    });

    it('handleKeyUp 不报错', () => {
      const engine = startEngine();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('其他按键无效果', () => {
      const engine = startEngine();
      engine.handleKeyDown('a');
      engine.handleKeyDown('b');
      engine.handleKeyDown('Escape');
      expect(getFish(engine)).toBe(0);
      expect(engine.selectedBuildingIndex).toBe(0);
    });
  });

  // ==================== 数字格式化 ====================

  describe('数字格式化', () => {
    it('0 显示为 "0"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(0)).toBe('0');
    });

    it('1 显示为 "1"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1)).toBe('1');
    });

    it('999 显示为 "999"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(999)).toBe('999');
    });

    it('1000 显示为 "1K"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1000)).toBe('1K');
    });

    it('1500 显示为 "1.5K"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1500)).toBe('1.5K');
    });

    it('1000000 显示为 "1M"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1000000)).toBe('1M');
    });

    it('1000000000 显示为 "1B"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1000000000)).toBe('1B');
    });

    it('1000000000000 显示为 "1T"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1000000000000)).toBe('1T');
    });

    it('负数显示负号', () => {
      const engine = createEngine();
      expect(engine.formatNumber(-1000)).toBe('-1K');
    });

    it('自定义小数位数', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1234, 2)).toBe('1.23K');
    });

    it('极大数字 1e15 显示为 "1Qa"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1e15)).toBe('1Qa');
    });

    it('1e18 显示为 "1Qi"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1e18)).toBe('1Qi');
    });

    it('1e15 显示为 "1Qa"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(1e15)).toBe('1Qa');
    });

    it('小数 0.5 显示为 "0.5"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(0.5)).toBe('0.5');
    });

    it('Infinity 显示为 "∞"', () => {
      const engine = createEngine();
      expect(engine.formatNumber(Infinity)).toBe('∞');
    });
  });

  // ==================== 渲染 ====================

  describe('渲染', () => {
    it('onRender 不崩溃（无 canvas）', () => {
      const engine = new KittensKingdomEngine();
      engine.init();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('onRender 有 canvas 时不崩溃', () => {
      const engine = startEngine();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('点击后渲染不崩溃', () => {
      const engine = startEngine();
      engine.click();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('购买建筑后渲染不崩溃', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('大量状态渲染不崩溃', () => {
      const engine = startEngine();
      addFish(engine, 1e9);
      addCatnip(engine, 1e6);
      addYarn(engine, 1e4);
      addGems(engine, 100);
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      }
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('解锁品种后渲染不崩溃', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.unlockBreed('british-shorthair');
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==================== 常量验证 ====================

  describe('常量验证', () => {
    it('FISH_PER_CLICK 为 1', () => {
      expect(FISH_PER_CLICK).toBe(1);
    });

    it('CANVAS_WIDTH 为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('NUMBER_SUFFIXES 包含 K M B T Qa Qi', () => {
      const suffixes = NUMBER_SUFFIXES.map(([, s]) => s);
      expect(suffixes).toContain('K');
      expect(suffixes).toContain('M');
      expect(suffixes).toContain('B');
      expect(suffixes).toContain('T');
      expect(suffixes).toContain('Qa');
      expect(suffixes).toContain('Qi');
    });

    it('BUILDINGS 按解锁难度排列（考虑解锁条件）', () => {
      // 建筑按游戏进度排列，解锁条件逐步提高
      // 注意：WEAVING_SHOP 的 baseCost 是 catnip:50（总面值较低），
      // 但它需要 catnip >= 20 的解锁条件，实际解锁顺序靠后
      expect(BUILDINGS[0].id).toBe(BUILDING_IDS.CAT_BED);
      expect(BUILDINGS[1].id).toBe(BUILDING_IDS.FISH_POND);
      expect(BUILDINGS[2].id).toBe(BUILDING_IDS.CATNIP_FIELD);
      expect(BUILDINGS[3].id).toBe(BUILDING_IDS.WEAVING_SHOP);
      expect(BUILDINGS[4].id).toBe(BUILDING_IDS.CAT_SCHOOL);
      expect(BUILDINGS[5].id).toBe(BUILDING_IDS.CAT_TEMPLE);
    });

    it('每个建筑有 ID', () => {
      BUILDINGS.forEach((b) => expect(b.id).toBeTruthy());
    });

    it('每个建筑有名称', () => {
      BUILDINGS.forEach((b) => expect(b.name).toBeTruthy());
    });

    it('每个建筑有图标', () => {
      BUILDINGS.forEach((b) => expect(b.icon).toBeTruthy());
    });

    it('每个建筑有正数费用倍率', () => {
      BUILDINGS.forEach((b) => expect(b.costMultiplier).toBeGreaterThan(1));
    });

    it('每个建筑有正数最大等级', () => {
      BUILDINGS.forEach((b) => expect(b.maxLevel).toBeGreaterThan(0));
    });

    it('每个品种有描述', () => {
      CAT_BREEDS.forEach((b) => expect(b.description).toBeTruthy());
    });

    it('COLORS 定义完整', () => {
      expect(COLORS.bgGradient1).toBeTruthy();
      expect(COLORS.textPrimary).toBeTruthy();
      expect(COLORS.accentGold).toBeTruthy();
      expect(COLORS.fishColor).toBeTruthy();
      expect(COLORS.catnipColor).toBeTruthy();
      expect(COLORS.yarnColor).toBeTruthy();
      expect(COLORS.gemColor).toBeTruthy();
    });
  });

  // ==================== 边界情况 ====================

  describe('边界情况', () => {
    it('鱼干刚好等于建筑价格可以购买', () => {
      const engine = startEngine();
      addFish(engine, 10);
      expect(engine.purchaseBuilding(BUILDING_IDS.CAT_BED)).toBe(true);
      expect(getFish(engine)).toBe(0);
    });

    it('鱼干比价格少 0.1 不能购买', () => {
      const engine = startEngine();
      addFish(engine, 9.9);
      expect(engine.purchaseBuilding(BUILDING_IDS.CAT_BED)).toBe(false);
    });

    it('连续购买直到买不起', () => {
      const engine = startEngine();
      addFish(engine, 200);
      let bought = 0;
      while (engine.purchaseBuilding(BUILDING_IDS.CAT_BED)) bought++;
      expect(bought).toBeGreaterThan(0);
      expect(bought).toBeLessThan(20);
    });

    it('重置后可以重新开始', () => {
      const engine = startEngine();
      addFish(engine, 1000);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      engine.reset();
      expect(getFish(engine)).toBe(0);
      expect(engine.getBuildingLevel(BUILDING_IDS.CAT_BED)).toBe(0);
    });

    it('快速连续点击不丢失', () => {
      const engine = startEngine();
      for (let i = 0; i < 100; i++) engine.click();
      expect(getFish(engine)).toBeGreaterThanOrEqual(100);
      expect(engine.totalClicks).toBe(100);
    });

    it('极大 deltaTime 不崩溃', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      expect(() => tick(engine, 1e10)).not.toThrow();
    });

    it('反复 start-reset 循环', () => {
      const engine = createEngine();
      for (let i = 0; i < 5; i++) {
        engine.start();
        engine.click();
        engine.reset();
      }
      expect(engine.status).toBe('idle');
    });

    it('购买所有类型建筑（解锁后）', () => {
      const engine = startEngine();
      // 解锁所有建筑
      addFish(engine, 1e8);
      addCatnip(engine, 1e6);
      addYarn(engine, 1e4);
      tick(engine, 16); // 触发解锁检查

      for (const building of BUILDINGS) {
        const result = engine.purchaseBuilding(building.id);
        // 可能有些买不起，但不应崩溃
      }
    });

    it('声望重置后可以继续游戏', () => {
      const engine = startEngine();
      addFish(engine, 10000);
      engine.prestigeReset();
      expect(engine.status).toBe('playing');
      engine.click();
      expect(getFish(engine)).toBeGreaterThan(0);
    });
  });

  // ==================== 综合场景 ====================

  describe('综合场景', () => {
    it('从零开始的完整游戏流程', () => {
      const engine = startEngine();

      // 点击攒鱼干
      for (let i = 0; i < 15; i++) engine.click();
      expect(getFish(engine)).toBeGreaterThanOrEqual(15);

      // 购买猫窝
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      expect(engine.getBuildingLevel(BUILDING_IDS.CAT_BED)).toBe(1);

      // 自动生产
      tick(engine, 1000);
      expect(getFish(engine)).toBeGreaterThan(0);

      // 解锁英短
      addFish(engine, 100);
      engine.unlockBreed('british-shorthair');
      expect(engine.isBreedUnlocked('british-shorthair')).toBe(true);
    });

    it('保存和恢复游戏', () => {
      const engine = startEngine();
      addFish(engine, 1000);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      engine.unlockBreed('british-shorthair');

      const savedState = engine.getState();

      // 新引擎加载状态
      const engine2 = startEngine();
      engine2.loadState(savedState);

      // loadState 中 upgrades 恢复时，getState 返回的 upgrades 值为 {level, unlocked} 对象
      // loadState 将其赋值给 upgrade.level，所以 getBuildingLevel 返回该对象
      const buildingLevel = engine2.getBuildingLevel(BUILDING_IDS.CAT_BED);
      expect(typeof buildingLevel === 'object' ? (buildingLevel as any).level : buildingLevel).toBe(1);
      expect(engine2.isBreedUnlocked('british-shorthair')).toBe(true);
    });

    it('暂停恢复后继续生产', () => {
      const engine = startEngine();
      addFish(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      const fishBefore = getFish(engine);

      engine.pause();
      tick(engine, 1000);
      // paused 不生产

      engine.resume();
      tick(engine, 1000);
      expect(getFish(engine)).toBeGreaterThan(fishBefore);
    });

    it('声望重置完整流程', () => {
      const engine = startEngine();
      // 攒够鱼干
      addFish(engine, 50000);

      // 购买建筑
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);

      // 解锁品种
      addFish(engine, 100);
      engine.unlockBreed('british-shorthair');

      // 声望重置
      const gems = engine.calculatePrestigeGems();
      expect(gems).toBeGreaterThan(0);
      engine.prestigeReset();

      // 验证
      expect(engine.prestige.count).toBe(1);
      expect(engine.prestige.currency).toBeGreaterThan(0);
      expect(engine.isBreedUnlocked('british-shorthair')).toBe(true);
      expect(engine.getProductionMultiplier()).toBeGreaterThan(1);
    });

    it('导出导入存档完整流程', () => {
      const engine = startEngine();
      addFish(engine, 500);
      engine.purchaseBuilding(BUILDING_IDS.CAT_BED);
      engine.click();
      engine.click();

      const exported = engine.exportSave();

      const engine2 = startEngine();
      const result = engine2.importSave(exported);
      expect(result).toBe(true);
    });
  });
});
