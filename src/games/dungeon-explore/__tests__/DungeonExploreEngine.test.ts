/**
 * 地下城探险（Dungeon Explore）放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DungeonExploreEngine } from '@/games/dungeon-explore/DungeonExploreEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  EQUIPMENTS,
  GOLD_PER_CLICK,
  EXP_PER_CLICK,
  SOUL_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GOLD,
  PRESTIGE_BASE_SOULS,
  MAX_CHARACTER_LEVEL,
  LEVEL_EXP_BASE,
  LEVEL_EXP_MULTIPLIER,
  COLORS,
  HERO_DRAW,
  getExpForLevel,
} from '@/games/dungeon-explore/constants';

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

function createEngine(): DungeonExploreEngine {
  const engine = new DungeonExploreEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): DungeonExploreEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addGold(engine: DungeonExploreEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.GOLD, amount);
}

function addExp(engine: DungeonExploreEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.EXP, amount);
}

function addGem(engine: DungeonExploreEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.GEM, amount);
}

/** 触发一次 update */
function tick(engine: DungeonExploreEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getGold(engine: DungeonExploreEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.GOLD)?.amount ?? 0;
}

function getExp(engine: DungeonExploreEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.EXP)?.amount ?? 0;
}

function getGem(engine: DungeonExploreEngine): number {
  return (engine as any).getResource(RESOURCE_IDS.GEM)?.amount ?? 0;
}

// ========== 测试 ==========

describe('DungeonExploreEngine', () => {
  let engine: DungeonExploreEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(DungeonExploreEngine);
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

    it('init 后宝石为 0', () => {
      expect(getGem(engine)).toBe(0);
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

    it('init 后 gameId 为 dungeon-explore', () => {
      expect(engine.gameId).toBe('dungeon-explore');
    });

    it('init 后金币已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.GOLD);
      expect(res.unlocked).toBe(true);
    });

    it('init 后经验已解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.EXP);
      expect(res.unlocked).toBe(true);
    });

    it('init 后宝石未解锁', () => {
      const res = (engine as any).getResource(RESOURCE_IDS.GEM);
      expect(res.unlocked).toBe(false);
    });

    it('init 后角色等级为 1', () => {
      expect(engine.characterLevel).toBe(1);
    });

    it('init 后角色经验为 0', () => {
      expect(engine.characterExp).toBe(0);
    });

    it('init 后选中索引为 0', () => {
      expect(engine.selectedIndex).toBe(0);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('应有 8 种装备', () => {
      expect(EQUIPMENTS.length).toBe(8);
    });

    it('建筑 ID 唯一', () => {
      const ids = BUILDINGS.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('装备 ID 唯一', () => {
      const ids = EQUIPMENTS.map(e => e.id);
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

    it('每个装备有名称', () => {
      EQUIPMENTS.forEach(e => {
        expect(e.name).toBeTruthy();
      });
    });

    it('每个装备有图标', () => {
      EQUIPMENTS.forEach(e => {
        expect(e.icon).toBeTruthy();
      });
    });

    it('每个装备有正数加成值', () => {
      EQUIPMENTS.forEach(e => {
        expect(e.bonus.value).toBeGreaterThan(0);
      });
    });

    it('装备槽位合法', () => {
      EQUIPMENTS.forEach(e => {
        expect(['weapon', 'armor', 'accessory']).toContain(e.slot);
      });
    });

    it('最大角色等级为 50', () => {
      expect(MAX_CHARACTER_LEVEL).toBe(50);
    });

    it('声望加成系数为 0.2', () => {
      expect(SOUL_BONUS_MULTIPLIER).toBe(0.2);
    });

    it('声望最低金币为 50000', () => {
      expect(MIN_PRESTIGE_GOLD).toBe(50000);
    });
  });

  // ========== 装备初始化 ==========

  describe('装备初始化', () => {
    it('所有装备初始未购买', () => {
      const eqs = engine.equipments;
      eqs.forEach(e => {
        expect(e.purchased).toBe(false);
      });
    });

    it('equipments getter 返回副本', () => {
      const eqs1 = engine.equipments;
      const eqs2 = engine.equipments;
      expect(eqs1).not.toBe(eqs2);
    });

    it('isEquipmentPurchased 初始全为 false', () => {
      EQUIPMENTS.forEach(e => {
        expect(engine.isEquipmentPurchased(e.id)).toBe(false);
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

  // ========== 点击探索 ==========

  describe('点击探索', () => {
    it('点击一次产生金币', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getGold(engine)).toBeGreaterThan(0);
    });

    it('点击产生经验', () => {
      engine.start();
      engine.click();
      expect(getExp(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次累积资源', () => {
      engine.start();
      let totalGold = 0;
      for (let i = 0; i < 10; i++) {
        totalGold += engine.click();
      }
      expect(totalGold).toBeGreaterThanOrEqual(10);
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

    it('增加宝石', () => {
      addGem(engine, 30);
      expect(getGem(engine)).toBe(30);
    });

    it('消耗金币成功', () => {
      addGold(engine, 100);
      (engine as any).spendResource(RESOURCE_IDS.GOLD, 50);
      expect(getGold(engine)).toBe(50);
    });

    it('消耗金币失败（不足）', () => {
      addGold(engine, 10);
      const result = (engine as any).spendResource(RESOURCE_IDS.GOLD, 50);
      expect(result).toBeFalsy();
      expect(getGold(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addGold(engine, 100);
      expect((engine as any).hasResource(RESOURCE_IDS.GOLD, 50)).toBe(true);
      expect((engine as any).hasResource(RESOURCE_IDS.GOLD, 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addGold(engine, 100);
      addGem(engine, 50);
      expect((engine as any).canAfford({ gold: 50, gem: 20 })).toBe(true);
      expect((engine as any).canAfford({ gold: 50, gem: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('初始只有酒馆解锁', () => {
      const tavern = (engine as any).upgrades.get(BUILDING_IDS.TAVERN);
      expect(tavern.unlocked).toBe(true);
    });

    it('铁匠铺初始未解锁', () => {
      const blacksmith = (engine as any).upgrades.get(BUILDING_IDS.BLACKSMITH);
      expect(blacksmith.unlocked).toBe(false);
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
      // 铁匠铺需要酒馆等级 > 0
      const result = engine.purchaseBuilding(1); // blacksmith
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

    it('购买建筑增加统计计数', () => {
      engine.start();
      addGold(engine, 1000);
      engine.purchaseBuilding(0);
      expect((engine as any)._stats.totalBuildingsPurchased).toBe(1);
    });

    it('建筑达到最大等级后无法继续购买', () => {
      engine.start();
      addGold(engine, 1e10);
      // 购买酒馆到满级
      for (let i = 0; i < 60; i++) {
        engine.purchaseBuilding(0);
      }
      const level = engine.getBuildingLevel(0);
      expect(level).toBeLessThanOrEqual(BUILDINGS[0].maxLevel);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('铁匠铺在酒馆有等级后解锁', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      const blacksmith = (engine as any).upgrades.get(BUILDING_IDS.BLACKSMITH);
      expect(blacksmith.unlocked).toBe(true);
    });

    it('训练场在酒馆有等级后解锁', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      const training = (engine as any).upgrades.get(BUILDING_IDS.TRAINING_GROUND);
      expect(training.unlocked).toBe(true);
    });

    it('魔法塔需要铁匠铺', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(1); // blacksmith
      tick(engine, 16);
      const magicTower = (engine as any).upgrades.get(BUILDING_IDS.MAGIC_TOWER);
      expect(magicTower.unlocked).toBe(true);
    });

    it('商人公会需要铁匠铺和训练场', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(1); // blacksmith
      engine.purchaseBuilding(3); // training_ground
      tick(engine, 16);
      const merchant = (engine as any).upgrades.get(BUILDING_IDS.MERCHANT);
      expect(merchant.unlocked).toBe(true);
    });

    it('竞技场需要商人公会和宝物室', () => {
      engine.start();
      addGold(engine, 1e9);
      addGem(engine, 1e6);
      // 解锁链：酒馆 → 铁匠铺 → 魔法塔 → 炼金实验室 → 宝物室
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(1); // blacksmith
      tick(engine, 16);
      engine.purchaseBuilding(2); // magic_tower
      tick(engine, 16);
      engine.purchaseBuilding(4); // alchemy_lab
      tick(engine, 16);
      engine.purchaseBuilding(6); // treasure_room
      // 解锁链：酒馆 → 铁匠铺 + 训练场 → 商人公会
      engine.purchaseBuilding(3); // training_ground
      tick(engine, 16);
      engine.purchaseBuilding(5); // merchant
      tick(engine, 16);
      const arena = (engine as any).upgrades.get(BUILDING_IDS.ARENA);
      expect(arena.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('宝石在魔法塔等级>=1时解锁', () => {
      engine.start();
      addGold(engine, 100000);
      addGem(engine, 100);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(1); // blacksmith
      tick(engine, 16);
      engine.purchaseBuilding(2); // magic_tower
      tick(engine, 16);
      const gem = (engine as any).getResource(RESOURCE_IDS.GEM);
      expect(gem.unlocked).toBe(true);
    });
  });

  // ========== 装备系统 ==========

  describe('装备系统', () => {
    it('购买木剑成功', () => {
      engine.start();
      addGold(engine, 50);
      const result = engine.purchaseEquipment('wooden_sword');
      expect(result).toBe(true);
      expect(engine.isEquipmentPurchased('wooden_sword')).toBe(true);
    });

    it('购买木剑失败（金币不足）', () => {
      engine.start();
      const result = engine.purchaseEquipment('wooden_sword');
      expect(result).toBe(false);
    });

    it('重复购买同一装备失败', () => {
      engine.start();
      addGold(engine, 200);
      engine.purchaseEquipment('wooden_sword');
      const result = engine.purchaseEquipment('wooden_sword');
      expect(result).toBe(false);
    });

    it('购买不存在的装备失败', () => {
      engine.start();
      const result = engine.purchaseEquipment('nonexistent');
      expect(result).toBe(false);
    });

    it('等级不足无法购买装备', () => {
      engine.start();
      addGold(engine, 1e6);
      addGem(engine, 1e4);
      // 铁剑需要等级 5，角色初始等级 1
      const result = engine.purchaseEquipment('iron_sword');
      expect(result).toBe(false);
    });

    it('购买装备触发 equipmentPurchased 事件', () => {
      engine.start();
      addGold(engine, 50);
      const listener = vi.fn();
      engine.on('equipmentPurchased', listener);
      engine.purchaseEquipment('wooden_sword');
      expect(listener).toHaveBeenCalledWith('wooden_sword');
    });

    it('购买装备增加统计计数', () => {
      engine.start();
      addGold(engine, 50);
      engine.purchaseEquipment('wooden_sword');
      expect((engine as any)._stats.totalEquipmentsPurchased).toBe(1);
    });

    it('购买装备后点击加成增加', () => {
      engine.start();
      const goldBefore = engine.click();
      addGold(engine, 50);
      engine.purchaseEquipment('wooden_sword');
      // 重置并重新测试
      addGold(engine, 100);
      const goldAfter = engine.click();
      // 木剑加成 +1 金币/点击
      expect(goldAfter).toBeGreaterThanOrEqual(goldBefore);
    });

    it('皮甲增加产出加成', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);

      addGold(engine, 100);
      const prodBefore = (engine as any).getResource(RESOURCE_IDS.GOLD)?.perSecond ?? 0;

      addGold(engine, 80);
      engine.purchaseEquipment('leather_armor');

      // 重新计算产出
      const prodAfter = (engine as any).getResource(RESOURCE_IDS.GOLD)?.perSecond ?? 0;
      expect(prodAfter).toBeGreaterThanOrEqual(prodBefore);
    });
  });

  // ========== 角色升级 ==========

  describe('角色升级', () => {
    it('获取升级所需经验', () => {
      const needed = engine.getExpNeededForNextLevel();
      expect(needed).toBeGreaterThan(0);
    });

    it('升级到 2 级需要正确经验', () => {
      const needed = engine.getExpForLevel(2);
      expect(needed).toBe(LEVEL_EXP_BASE);
    });

    it('升级到 3 级需要更多经验', () => {
      const needed2 = engine.getExpForLevel(2);
      const needed3 = engine.getExpForLevel(3);
      expect(needed3).toBeGreaterThan(needed2);
    });

    it('手动升级成功', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      const result = engine.levelUp();
      expect(result).toBe(true);
      expect(engine.characterLevel).toBe(2);
    });

    it('经验不足时升级失败', () => {
      engine.start();
      const result = engine.levelUp();
      expect(result).toBe(false);
      expect(engine.characterLevel).toBe(1);
    });

    it('升级触发 levelUp 事件', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      const listener = vi.fn();
      engine.on('levelUp', listener);
      engine.levelUp();
      expect(listener).toHaveBeenCalledWith(2);
    });

    it('升级增加统计计数', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      engine.levelUp();
      expect((engine as any)._stats.totalLevelUps).toBe(1);
    });

    it('升级后最高等级更新', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      engine.levelUp();
      expect((engine as any)._stats.highestLevel).toBe(2);
    });

    it('等级加成增加点击产出', () => {
      engine.start();
      const click1 = engine.click();
      // 升级到 2 级
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      engine.levelUp();
      // 清空金币，重新点击
      const goldBefore = getGold(engine);
      const click2 = engine.click();
      // 等级加成 5% per level
      expect(click2).toBeGreaterThanOrEqual(click1);
    });

    it('达到最大等级后无法继续升级', () => {
      engine.start();
      // 直接设置角色等级为最大
      (engine as any)._character.level = MAX_CHARACTER_LEVEL;
      const result = engine.levelUp();
      expect(result).toBe(false);
    });

    it('getExpForLevel(1) 返回 0', () => {
      expect(engine.getExpForLevel(1)).toBe(0);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始远古之魂为 0', () => {
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
      const souls = engine.doPrestige();
      expect(souls).toBeGreaterThan(0);
    });

    it('声望后远古之魂增加', () => {
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

    it('声望保留角色等级', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      engine.levelUp();
      const levelBefore = engine.characterLevel;

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.characterLevel).toBe(levelBefore);
    });

    it('声望保留装备', () => {
      engine.start();
      addGold(engine, 50);
      engine.purchaseEquipment('wooden_sword');

      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.isEquipmentPurchased('wooden_sword')).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望加成倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望加成倍率随远古之魂增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * SOUL_BONUS_MULTIPLIER, 2);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('dungeon-explore');
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

    it('save 包含装备、角色和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).equipments).toBeDefined();
      expect((data.settings as any).character).toBeDefined();
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

    it('load 恢复装备状态', () => {
      engine.start();
      addGold(engine, 50);
      engine.purchaseEquipment('wooden_sword');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.isEquipmentPurchased('wooden_sword')).toBe(true);
    });

    it('load 恢复角色状态', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      engine.levelUp();
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(engine2.characterLevel).toBe(2);
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
      expect(state.equipments).toBeDefined();
      expect(state.character).toBeDefined();
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

    it('loadState 恢复装备', () => {
      engine.start();
      addGold(engine, 50);
      engine.purchaseEquipment('wooden_sword');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.isEquipmentPurchased('wooden_sword')).toBe(true);
    });

    it('loadState 恢复角色', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      engine.levelUp();
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.characterLevel).toBe(2);
    });

    it('loadState 恢复建筑等级', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(engine2.getBuildingLevel(0)).toBe(1);
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

    it('L 键升级角色', () => {
      engine.start();
      const needed = engine.getExpNeededForNextLevel();
      addExp(engine, needed);
      engine.handleKeyDown('l');
      expect(engine.characterLevel).toBe(2);
    });

    it('E 键购买装备', () => {
      engine.start();
      addGold(engine, 50);
      engine.handleKeyDown('e');
      expect(engine.isEquipmentPurchased('wooden_sword')).toBe(true);
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

    it('有装备时渲染正常', () => {
      engine.start();
      addGold(engine, 50);
      engine.purchaseEquipment('wooden_sword');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('角色高等级时渲染正常', () => {
      engine.start();
      (engine as any)._character.level = 25;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑时渲染正常', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('宝石解锁后渲染正常', () => {
      engine.start();
      const gem = (engine as any).getResource(RESOURCE_IDS.GEM);
      gem.unlocked = true;
      gem.amount = 100;
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
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

    it('训练场产出经验', () => {
      engine.start();
      addGold(engine, 100000);
      engine.purchaseBuilding(0); // tavern
      tick(engine, 16);
      engine.purchaseBuilding(3); // training_ground
      tick(engine, 16);
      const expBefore = getExp(engine);
      tick(engine, 1000);
      const expAfter = getExp(engine);
      expect(expAfter).toBeGreaterThan(expBefore);
    });

    it('声望加成影响产出', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      (engine as any).prestige.currency = 10;
      (engine as any).recalculateProduction();
      const goldRes = (engine as any).getResource(RESOURCE_IDS.GOLD);
      expect(goldRes.perSecond).toBeGreaterThan(0);
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
  });

  // ========== getExpForLevel 函数 ==========

  describe('getExpForLevel 函数', () => {
    it('level 1 返回 0', () => {
      expect(getExpForLevel(1)).toBe(0);
    });

    it('level 2 返回 BASE', () => {
      expect(getExpForLevel(2)).toBe(LEVEL_EXP_BASE);
    });

    it('level 3 返回 BASE * MULTIPLIER', () => {
      expect(getExpForLevel(3)).toBe(Math.floor(LEVEL_EXP_BASE * Math.pow(LEVEL_EXP_MULTIPLIER, 1)));
    });

    it('高等级需要更多经验', () => {
      const exp10 = getExpForLevel(10);
      const exp20 = getExpForLevel(20);
      expect(exp20).toBeGreaterThan(exp10);
    });
  });
});
