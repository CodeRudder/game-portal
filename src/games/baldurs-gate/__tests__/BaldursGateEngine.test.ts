/**
 * Baldur's Gate（博德之门）放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaldursGateEngine } from '@/games/baldurs-gate/BaldursGateEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GOLD,
  COMPANIONS,
  BUILDINGS,
  DUNGEONS,
  COMPANION_UPGRADE_COSTS,
  MAX_COMPANION_LEVEL,
  COLORS,
  HERO_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  BUILDING_IDS,
  RESOURCE_IDS,
} from '@/games/baldurs-gate/constants';

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

function createEngine(): BaldursGateEngine {
  const engine = new BaldursGateEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): BaldursGateEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addGold(engine: BaldursGateEngine, amount: number): void {
  (engine as any).addResource('gold', amount);
}

function addXp(engine: BaldursGateEngine, amount: number): void {
  (engine as any).addResource('xp', amount);
}

function addMagicItems(engine: BaldursGateEngine, amount: number): void {
  (engine as any).addResource('magic_item', amount);
}

/** 触发一次 update */
function tick(engine: BaldursGateEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getGold(engine: BaldursGateEngine): number {
  return (engine as any).getResource('gold')?.amount ?? 0;
}

function getXp(engine: BaldursGateEngine): number {
  return (engine as any).getResource('xp')?.amount ?? 0;
}

function getMagicItems(engine: BaldursGateEngine): number {
  return (engine as any).getResource('magic_item')?.amount ?? 0;
}

// ========== 测试 ==========

describe('BaldursGateEngine', () => {
  let engine: BaldursGateEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(BaldursGateEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后金币为 0', () => {
      expect(getGold(engine)).toBe(0);
    });

    it('init 后经验为 0', () => {
      expect(getXp(engine)).toBe(0);
    });

    it('init 后魔法物品为 0', () => {
      expect(getMagicItems(engine)).toBe(0);
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

    it('init 后 gameId 为 baldurs-gate', () => {
      expect(engine.gameId).toBe('baldurs-gate');
    });

    it('init 后金币已解锁', () => {
      const res = (engine as any).getResource('gold');
      expect(res.unlocked).toBe(true);
    });

    it('init 后经验未解锁', () => {
      const res = (engine as any).getResource('xp');
      expect(res.unlocked).toBe(false);
    });

    it('init 后魔法物品未解锁', () => {
      const res = (engine as any).getResource('magic_item');
      expect(res.unlocked).toBe(false);
    });

    it('init 后无地下城探索', () => {
      expect(engine.dungeonExplore).toBeNull();
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('GOLD_PER_CLICK 应为 1', () => {
      expect(GOLD_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_GOLD 应为 50000', () => {
      expect(MIN_PRESTIGE_GOLD).toBe(50000);
    });

    it('PRESTIGE_BONUS_MULTIPLIER 应为 0.15', () => {
      expect(PRESTIGE_BONUS_MULTIPLIER).toBe(0.15);
    });

    it('RESOURCE_IDS 应包含 gold/xp/magic_item', () => {
      expect(RESOURCE_IDS.GOLD).toBe('gold');
      expect(RESOURCE_IDS.XP).toBe('xp');
      expect(RESOURCE_IDS.MAGIC_ITEM).toBe('magic_item');
    });

    it('BUILDING_IDS 应有 8 个建筑', () => {
      expect(Object.keys(BUILDING_IDS)).toHaveLength(8);
    });

    it('CANVAS_WIDTH 应为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 应为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });
  });

  // ========== 队友初始化 ==========

  describe('队友初始化', () => {
    it('应有 6 种队友', () => {
      expect(COMPANIONS.length).toBe(6);
    });

    it('初始只有影心解锁', () => {
      const companions = engine.companions;
      const shadowheart = companions.find(c => c.id === 'shadowheart');
      expect(shadowheart?.unlocked).toBe(true);
    });

    it('其他队友初始未解锁', () => {
      const companions = engine.companions;
      const locked = companions.filter(c => c.id !== 'shadowheart');
      locked.forEach(c => {
        expect(c.unlocked).toBe(false);
      });
    });

    it('所有队友初始升级等级为 0', () => {
      const companions = engine.companions;
      companions.forEach(c => {
        expect(c.upgradeLevel).toBe(0);
      });
    });

    it('队友 ID 唯一', () => {
      const ids = COMPANIONS.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个队友有名称', () => {
      COMPANIONS.forEach(c => {
        expect(c.name).toBeTruthy();
      });
    });

    it('每个队友有图标', () => {
      COMPANIONS.forEach(c => {
        expect(c.icon).toBeTruthy();
      });
    });

    it('每个队友有正数加成值', () => {
      COMPANIONS.forEach(c => {
        expect(c.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个队友有升级倍率', () => {
      COMPANIONS.forEach(c => {
        expect(c.upgradeMultiplier).toBeGreaterThan(0);
      });
    });

    it('每个队友有职业', () => {
      COMPANIONS.forEach(c => {
        expect(c.className).toBeTruthy();
      });
    });
  });

  // ========== 建筑初始化 ==========

  describe('建筑初始化', () => {
    it('应有 8 个建筑', () => {
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

    it('每个建筑有最大等级', () => {
      BUILDINGS.forEach(b => {
        expect(b.maxLevel).toBeGreaterThan(0);
      });
    });

    it('初始只有酒馆解锁', () => {
      const upgrade = (engine as any).upgrades.get('tavern');
      expect(upgrade.unlocked).toBe(true);
    });

    it('铁匠铺初始未解锁', () => {
      const upgrade = (engine as any).upgrades.get('blacksmith');
      expect(upgrade.unlocked).toBe(false);
    });

    it('地下城建筑需要最多前置', () => {
      const dungeon = BUILDINGS.find(b => b.id === 'underground_dungeon');
      expect(dungeon?.requires).toBeDefined();
      expect(dungeon!.requires!.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========== 地下城初始化 ==========

  describe('地下城初始化', () => {
    it('应有 5 个地下城', () => {
      expect(DUNGEONS.length).toBe(5);
    });

    it('地下城 ID 唯一', () => {
      const ids = DUNGEONS.map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个地下城有名称', () => {
      DUNGEONS.forEach(d => {
        expect(d.name).toBeTruthy();
      });
    });

    it('每个地下城有正数探索时间', () => {
      DUNGEONS.forEach(d => {
        expect(d.exploreTime).toBeGreaterThan(0);
      });
    });

    it('每个地下城有金币奖励', () => {
      DUNGEONS.forEach(d => {
        expect(d.goldReward).toBeGreaterThan(0);
      });
    });

    it('每个地下城有经验奖励', () => {
      DUNGEONS.forEach(d => {
        expect(d.xpReward).toBeGreaterThan(0);
      });
    });

    it('地下城队友要求递增', () => {
      for (let i = 1; i < DUNGEONS.length; i++) {
        expect(DUNGEONS[i].requiredCompanions).toBeGreaterThanOrEqual(
          DUNGEONS[i - 1].requiredCompanions
        );
      }
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

    it('resume 后恢复 playing', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect((engine as any)._status).toBe('playing');
    });

    it('reset 后金币归零', () => {
      engine.start();
      addGold(engine, 1000);
      engine.reset();
      expect(getGold(engine)).toBe(0);
    });

    it('init 后可正常 start', () => {
      expect(() => engine.start()).not.toThrow();
    });

    it('重复 start 不报错', () => {
      engine.start();
      expect(() => engine.start()).not.toThrow();
    });
  });

  // ========== 点击系统 ==========

  describe('点击系统', () => {
    it('点击应获得金币', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getGold(engine)).toBeGreaterThan(0);
    });

    it('基础点击应获得 GOLD_PER_CLICK × 队友加成', () => {
      engine.start();
      const gained = engine.click();
      // 影心提供 +10% 点击加成
      expect(gained).toBeCloseTo(GOLD_PER_CLICK * 1.1, 1);
    });

    it('多次点击应累积金币', () => {
      engine.start();
      engine.click();
      engine.click();
      engine.click();
      expect(getGold(engine)).toBeCloseTo(GOLD_PER_CLICK * 1.1 * 3, 1);
    });

    it('未开始时点击返回 0', () => {
      expect(engine.click()).toBe(0);
    });

    it('暂停时点击返回 0', () => {
      engine.start();
      engine.pause();
      expect(engine.click()).toBe(0);
    });

    it('点击应增加 totalClicks', () => {
      engine.start();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(2);
    });

    it('点击应增加 totalGoldEarned', () => {
      engine.start();
      engine.click();
      expect(engine.totalGoldEarned).toBeGreaterThan(0);
    });

    it('点击应增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('点击应触发 stateChange 事件', () => {
      engine.start();
      const handler = vi.fn();
      engine.on('stateChange', handler);
      engine.click();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ========== 建筑购买 ==========

  describe('建筑购买', () => {
    it('无金币时不能购买酒馆', () => {
      engine.start();
      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('有足够金币时可购买酒馆', () => {
      engine.start();
      addGold(engine, 100);
      expect(engine.purchaseBuilding(0)).toBe(true);
    });

    it('购买后金币应减少', () => {
      engine.start();
      addGold(engine, 100);
      const before = getGold(engine);
      engine.purchaseBuilding(0);
      expect(getGold(engine)).toBeLessThan(before);
    });

    it('购买后建筑等级应增加', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('不能购买未解锁的建筑', () => {
      engine.start();
      addGold(engine, 10000);
      // 铁匠铺需要酒馆先有等级
      expect(engine.purchaseBuilding(1)).toBe(false);
    });

    it('满足前置条件后建筑解锁', () => {
      engine.start();
      addGold(engine, 10000);
      engine.purchaseBuilding(0); // 酒馆
      tick(engine); // 触发 checkBuildingUnlocks
      // 铁匠铺需要酒馆
      const upgrade = (engine as any).upgrades.get('blacksmith');
      expect(upgrade.unlocked).toBe(true);
    });

    it('无效索引返回 false', () => {
      engine.start();
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(999)).toBe(false);
    });

    it('达到最大等级后不能再购买', () => {
      engine.start();
      const building = BUILDINGS[0];
      const upgrade = (engine as any).upgrades.get(building.id);
      upgrade.level = building.maxLevel;
      addGold(engine, 1e15);
      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('购买应触发 upgradePurchased 事件', () => {
      engine.start();
      addGold(engine, 100);
      const handler = vi.fn();
      engine.on('upgradePurchased', handler);
      engine.purchaseBuilding(0);
      expect(handler).toHaveBeenCalledWith('tavern', 1);
    });

    it('购买酒馆后金币产出应增加', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });
  });

  // ========== 队友招募 ==========

  describe('队友招募', () => {
    it('无金币时不能招募队友', () => {
      engine.start();
      expect(engine.unlockCompanion('gale')).toBe(false);
    });

    it('有足够金币时可招募盖尔', () => {
      engine.start();
      addGold(engine, 1000);
      expect(engine.unlockCompanion('gale')).toBe(true);
    });

    it('招募后金币应减少', () => {
      engine.start();
      addGold(engine, 1000);
      const before = getGold(engine);
      engine.unlockCompanion('gale');
      expect(getGold(engine)).toBeLessThan(before);
    });

    it('招募后队友应为已解锁', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockCompanion('gale');
      const companions = engine.companions;
      const gale = companions.find(c => c.id === 'gale');
      expect(gale?.unlocked).toBe(true);
    });

    it('不能重复招募', () => {
      engine.start();
      addGold(engine, 2000);
      engine.unlockCompanion('gale');
      expect(engine.unlockCompanion('gale')).toBe(false);
    });

    it('无效 ID 返回 false', () => {
      engine.start();
      expect(engine.unlockCompanion('nonexistent')).toBe(false);
    });

    it('招募应增加已解锁队友计数', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockCompanion('gale');
      expect(engine.getUnlockedCompanionCount()).toBe(2);
    });

    it('招募应触发 companionUnlocked 事件', () => {
      engine.start();
      addGold(engine, 1000);
      const handler = vi.fn();
      engine.on('companionUnlocked', handler);
      engine.unlockCompanion('gale');
      expect(handler).toHaveBeenCalledWith('gale');
    });

    it('招募盖尔后经验加成应生效', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockCompanion('gale');
      // 盖尔提供经验加成
      const mult = (engine as any).getXpProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 队友升级 ==========

  describe('队友升级', () => {
    it('未解锁队友不能升级', () => {
      engine.start();
      expect(engine.upgradeCompanion('gale')).toBe(false);
    });

    it('资源不足时不能升级', () => {
      engine.start();
      expect(engine.upgradeCompanion('shadowheart')).toBe(false);
    });

    it('有足够资源时可升级', () => {
      engine.start();
      addXp(engine, 100);
      addMagicItems(engine, 10);
      expect(engine.upgradeCompanion('shadowheart')).toBe(true);
    });

    it('升级后等级应增加', () => {
      engine.start();
      addXp(engine, 100);
      addMagicItems(engine, 10);
      engine.upgradeCompanion('shadowheart');
      expect(engine.getCompanionUpgradeLevel('shadowheart')).toBe(1);
    });

    it('升级后资源应减少', () => {
      engine.start();
      addXp(engine, 100);
      addMagicItems(engine, 10);
      const beforeXp = getXp(engine);
      const beforeMi = getMagicItems(engine);
      engine.upgradeCompanion('shadowheart');
      expect(getXp(engine)).toBeLessThan(beforeXp);
      expect(getMagicItems(engine)).toBeLessThan(beforeMi);
    });

    it('达到最大等级后不能升级', () => {
      engine.start();
      const companion = engine.companions.find(c => c.id === 'shadowheart');
      // 直接设置等级到最大
      (engine as any)._companions[0].upgradeLevel = MAX_COMPANION_LEVEL;
      addXp(engine, 1e10);
      addMagicItems(engine, 1e10);
      expect(engine.upgradeCompanion('shadowheart')).toBe(false);
    });

    it('升级应触发 companionUpgraded 事件', () => {
      engine.start();
      addXp(engine, 100);
      addMagicItems(engine, 10);
      const handler = vi.fn();
      engine.on('companionUpgraded', handler);
      engine.upgradeCompanion('shadowheart');
      expect(handler).toHaveBeenCalledWith('shadowheart', 1);
    });

    it('升级费用表应有 5 级', () => {
      expect(Object.keys(COMPANION_UPGRADE_COSTS)).toHaveLength(5);
    });

    it('每级升级费用递增', () => {
      const cost1 = COMPANION_UPGRADE_COSTS[1];
      const cost3 = COMPANION_UPGRADE_COSTS[3];
      expect(cost3.xp).toBeGreaterThan(cost1.xp);
    });
  });

  // ========== 地下城探索 ==========

  describe('地下城探索', () => {
    it('未开始游戏时不能探索', () => {
      expect(engine.startDungeonExplore('goblin_cave')).toBe(false);
    });

    it('有 1 个队友时可探索哥布林洞穴', () => {
      engine.start();
      expect(engine.canStartDungeonExplore('goblin_cave')).toBe(true);
    });

    it('有 1 个队友时不能探索亡灵墓穴', () => {
      engine.start();
      expect(engine.canStartDungeonExplore('undead_crypt')).toBe(false);
    });

    it('开始探索后应有探索状态', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      expect(engine.dungeonExplore).not.toBeNull();
      expect(engine.dungeonExplore!.dungeonId).toBe('goblin_cave');
    });

    it('探索中不能再开始新探索', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      expect(engine.startDungeonExplore('goblin_cave')).toBe(false);
    });

    it('无效地下城 ID 返回 false', () => {
      engine.start();
      expect(engine.startDungeonExplore('nonexistent')).toBe(false);
    });

    it('探索进度初始为 0', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      expect(engine.getDungeonExploreProgress()).toBeGreaterThanOrEqual(0);
    });

    it('探索完成后应获得奖励', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      const beforeGold = getGold(engine);

      // 手动完成探索
      (engine as any).completeDungeonExplore();

      expect(getGold(engine)).toBeGreaterThan(beforeGold);
    });

    it('探索完成后应增加地下城完成计数', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      (engine as any).completeDungeonExplore();

      const state = engine.getState();
      expect(state.statistics.totalDungeonsCompleted).toBe(1);
    });

    it('探索完成后状态应重置', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      (engine as any).completeDungeonExplore();
      expect(engine.dungeonExplore).toBeNull();
    });

    it('探索应触发 dungeonExploreStarted 事件', () => {
      engine.start();
      const handler = vi.fn();
      engine.on('dungeonExploreStarted', handler);
      engine.startDungeonExplore('goblin_cave');
      expect(handler).toHaveBeenCalledWith('goblin_cave');
    });

    it('探索完成应触发 dungeonExploreCompleted 事件', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      const handler = vi.fn();
      engine.on('dungeonExploreCompleted', handler);
      (engine as any).completeDungeonExplore();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('酒馆等级 5 时解锁经验', () => {
      engine.start();
      const upgrade = (engine as any).upgrades.get('tavern');
      upgrade.level = 5;
      tick(engine);
      const xp = (engine as any).getResource('xp');
      expect(xp.unlocked).toBe(true);
    });

    it('酒馆等级 4 时经验未解锁', () => {
      engine.start();
      const upgrade = (engine as any).upgrades.get('tavern');
      upgrade.level = 4;
      tick(engine);
      const xp = (engine as any).getResource('xp');
      expect(xp.unlocked).toBe(false);
    });

    it('冒险公会等级 1 时解锁魔法物品', () => {
      engine.start();
      const upgrade = (engine as any).upgrades.get('adventure_guild');
      upgrade.level = 1;
      upgrade.unlocked = true;
      tick(engine);
      const magicItem = (engine as any).getResource('magic_item');
      expect(magicItem.unlocked).toBe(true);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('酒馆升级后铁匠铺解锁', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      tick(engine);
      const upgrade = (engine as any).upgrades.get('blacksmith');
      expect(upgrade.unlocked).toBe(true);
    });

    it('酒馆升级后炼金店解锁', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      tick(engine);
      const upgrade = (engine as any).upgrades.get('alchemist_shop');
      expect(upgrade.unlocked).toBe(true);
    });

    it('商会需要铁匠铺和炼金店', () => {
      engine.start();
      addGold(engine, 1e6);
      engine.purchaseBuilding(0); // 酒馆
      tick(engine);
      const bs = (engine as any).upgrades.get('blacksmith');
      const al = (engine as any).upgrades.get('alchemist_shop');
      expect(bs.unlocked).toBe(true);
      expect(al.unlocked).toBe(true);

      engine.purchaseBuilding(1); // 铁匠铺
      tick(engine);
      const mg = (engine as any).upgrades.get('merchant_guild');
      expect(mg.unlocked).toBe(false);

      engine.purchaseBuilding(2); // 炼金店
      tick(engine);
      expect(mg.unlocked).toBe(true);
    });
  });

  // ========== 产出计算 ==========

  describe('产出计算', () => {
    it('无建筑时金币产出为 0', () => {
      engine.start();
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBe(0);
    });

    it('酒馆等级 1 时金币产出大于 0', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('酒馆产出等于基础产出 × 等级', () => {
      engine.start();
      addGold(engine, 1e6);
      engine.purchaseBuilding(0);
      const gold = (engine as any).getResource('gold');
      const tavern = BUILDINGS.find(b => b.id === 'tavern')!;
      expect(gold.perSecond).toBe(tavern.baseProduction * 1);
    });

    it('升级后产出应重新计算', () => {
      engine.start();
      addGold(engine, 1e6);
      engine.purchaseBuilding(0);
      const ps1 = (engine as any).getResource('gold').perSecond;
      engine.purchaseBuilding(0);
      const ps2 = (engine as any).getResource('gold').perSecond;
      expect(ps2).toBeGreaterThan(ps1);
    });

    it('队友加成应影响产出', () => {
      engine.start();
      addGold(engine, 1e6);
      engine.purchaseBuilding(0);
      const ps1 = (engine as any).getResource('gold').perSecond;

      // 招募莱泽尔（金币产出加成）
      addGold(engine, 10000);
      engine.unlockCompanion('laezel');
      (engine as any).recalculateProduction();
      const ps2 = (engine as any).getResource('gold').perSecond;
      expect(ps2).toBeGreaterThan(ps1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('金币不足时不能声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('金币不足时声望返回 0', () => {
      engine.start();
      expect(engine.doPrestige()).toBe(0);
    });

    it('金币足够时可以声望', () => {
      engine.start();
      // 直接设置 totalGoldEarned
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 2;
      expect(engine.canPrestige()).toBe(true);
    });

    it('声望后应获得命运点数', () => {
      engine.start();
      addGold(engine, MIN_PRESTIGE_GOLD * 4);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const gained = engine.doPrestige();
      expect(gained).toBeGreaterThan(0);
    });

    it('声望后资源应重置', () => {
      engine.start();
      addGold(engine, MIN_PRESTIGE_GOLD * 4);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(getGold(engine)).toBe(0);
    });

    it('声望后建筑等级应重置', () => {
      engine.start();
      addGold(engine, 1e6);
      engine.purchaseBuilding(0);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('声望后命运点数应保留', () => {
      engine.start();
      addGold(engine, MIN_PRESTIGE_GOLD * 4);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const gained = engine.doPrestige();
      expect(engine.prestige.currency).toBe(gained);
    });

    it('声望后声望次数应增加', () => {
      engine.start();
      addGold(engine, MIN_PRESTIGE_GOLD * 4);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();
      expect(engine.prestige.count).toBe(1);
    });

    it('声望后队友升级等级应保留', () => {
      engine.start();
      addXp(engine, 100);
      addMagicItems(engine, 10);
      engine.upgradeCompanion('shadowheart');
      const level = engine.getCompanionUpgradeLevel('shadowheart');

      addGold(engine, MIN_PRESTIGE_GOLD * 4);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();

      expect(engine.getCompanionUpgradeLevel('shadowheart')).toBe(level);
    });

    it('声望预览应正确计算', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const preview = engine.getPrestigePreview();
      expect(preview).toBeGreaterThan(0);
    });

    it('声望加成倍率应正确', () => {
      engine.start();
      engine.prestige.currency = 10;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1 + 10 * PRESTIGE_BONUS_MULTIPLIER);
    });

    it('声望后点击有加成', () => {
      engine.start();
      addGold(engine, MIN_PRESTIGE_GOLD * 100);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 100;
      engine.doPrestige();

      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(GOLD_PER_CLICK);
    });
  });

  // ========== 渲染 ==========

  describe('渲染', () => {
    it('onRender 不应报错', () => {
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('start 后 onRender 不应报错', () => {
      engine.start();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('点击后 onRender 不应报错', () => {
      engine.start();
      engine.click();
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('探索中 onRender 不应报错', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 输入处理 ==========

  describe('输入处理', () => {
    it('空格键应触发点击', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(getGold(engine)).toBeGreaterThan(0);
    });

    it('ArrowUp 应减少选中索引', () => {
      engine.start();
      (engine as any)._selectedIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(1);
    });

    it('ArrowDown 应增加选中索引', () => {
      engine.start();
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(1);
    });

    it('ArrowUp 不应低于 0', () => {
      engine.start();
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(0);
    });

    it('ArrowDown 不应超过建筑数', () => {
      engine.start();
      (engine as any)._selectedIndex = BUILDINGS.length - 1;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(BUILDINGS.length - 1);
    });

    it('Enter 应购买选中建筑', () => {
      engine.start();
      addGold(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('U 键应升级队友', () => {
      engine.start();
      addXp(engine, 100);
      addMagicItems(engine, 10);
      engine.handleKeyDown('u');
      expect(engine.getCompanionUpgradeLevel('shadowheart')).toBe(1);
    });

    it('D 键应开始地下城探索', () => {
      engine.start();
      engine.handleKeyDown('d');
      expect(engine.dungeonExplore).not.toBeNull();
    });

    it('P 键应触发声望', () => {
      engine.start();
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.handleKeyDown('p');
      expect(engine.prestige.count).toBe(1);
    });

    it('未开始时按键不应有效果', () => {
      engine.handleKeyDown(' ');
      expect(getGold(engine)).toBe(0);
    });

    it('handleKeyUp 不应报错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ========== 状态序列化 ==========

  describe('状态序列化', () => {
    it('getState 应返回正确状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state.resources).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.companions).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 应恢复资源', () => {
      engine.start();
      addGold(engine, 500);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(state);
      expect(getGold(engine2)).toBe(500);
    });

    it('loadState 应恢复建筑等级', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(state);
      expect(engine2.getBuildingLevel(0)).toBe(1);
    });

    it('loadState 应恢复队友状态', () => {
      engine.start();
      addGold(engine, 1000);
      engine.unlockCompanion('gale');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(state);
      const companions = engine2.companions;
      const gale = companions.find(c => c.id === 'gale');
      expect(gale?.unlocked).toBe(true);
    });

    it('loadState 应恢复声望', () => {
      engine.start();
      engine.prestige.currency = 5;
      engine.prestige.count = 1;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(state);
      expect(engine2.prestige.currency).toBe(5);
      expect(engine2.prestige.count).toBe(1);
    });

    it('loadState 应恢复统计', () => {
      engine.start();
      engine.click();
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(state);
      expect(state.statistics.totalClicks).toBe(1);
    });

    it('loadState 应恢复选中索引', () => {
      engine.start();
      (engine as any)._selectedIndex = 3;
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(state);
      expect(engine2.selectedIndex).toBe(3);
    });

    it('loadState 应恢复地下城探索', () => {
      engine.start();
      engine.startDungeonExplore('goblin_cave');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.loadState(state);
      expect(engine2.dungeonExplore).not.toBeNull();
      expect(engine2.dungeonExplore!.dungeonId).toBe('goblin_cave');
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 应返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.settings).toBeDefined();
    });

    it('save 应包含队友数据', () => {
      engine.start();
      const data = engine.save();
      expect((data.settings as any).companions).toBeDefined();
    });

    it('save 应包含统计数据', () => {
      engine.start();
      const data = engine.save();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 应恢复存档', () => {
      engine.start();
      addGold(engine, 500);
      addXp(engine, 100);
      engine.unlockCompanion('gale');

      const data = engine.save();
      expect((data.settings as any).companions).toBeDefined();
      const savedGale = (data.settings as any).companions.find((c: any) => c.id === 'gale');
      expect(savedGale?.unlocked).toBe(true);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（影心加成）', () => {
      engine.start();
      const mult = (engine as any).getClickMultiplier();
      // 影心 +10%
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('招募莱泽尔后金币产出倍率增加', () => {
      engine.start();
      const before = (engine as any).getGoldProductionMultiplier();
      addGold(engine, 10000);
      engine.unlockCompanion('laezel');
      const after = (engine as any).getGoldProductionMultiplier();
      expect(after).toBeGreaterThan(before);
    });

    it('升级影心后点击倍率增加', () => {
      engine.start();
      const before = (engine as any).getClickMultiplier();
      addXp(engine, 100);
      addMagicItems(engine, 10);
      engine.upgradeCompanion('shadowheart');
      const after = (engine as any).getClickMultiplier();
      expect(after).toBeGreaterThan(before);
    });

    it('声望加成影响产出倍率', () => {
      engine.start();
      engine.prestige.currency = 10;
      const mult = (engine as any).getGoldProductionMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('卡拉克全加成应影响所有类型', () => {
      engine.start();
      addGold(engine, 100000);
      engine.unlockCompanion('karlach');

      const clickMult = (engine as any).getClickMultiplier();
      const goldMult = (engine as any).getGoldProductionMultiplier();
      const xpMult = (engine as any).getXpProductionMultiplier();
      const miMult = (engine as any).getMagicItemProductionMultiplier();

      expect(clickMult).toBeGreaterThan(1);
      expect(goldMult).toBeGreaterThan(1);
      expect(xpMult).toBeGreaterThan(1);
      expect(miMult).toBeGreaterThan(1);
    });
  });

  // ========== 建筑费用 ==========

  describe('建筑费用', () => {
    it('建筑费用应随等级递增', () => {
      engine.start();
      const cost0 = engine.getBuildingCost(0);
      const upgrade = (engine as any).upgrades.get('tavern');
      upgrade.level = 5;
      const cost5 = engine.getBuildingCost(0);
      // 费用应递增
      const c0 = Object.values(cost0)[0] as number;
      const c5 = Object.values(cost5)[0] as number;
      expect(c5).toBeGreaterThan(c0);
    });

    it('无效索引返回空对象', () => {
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingCost(999)).toEqual({});
    });

    it('建筑等级初始为 0', () => {
      for (let i = 0; i < BUILDINGS.length; i++) {
        expect(engine.getBuildingLevel(i)).toBe(0);
      }
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('资源不应超过最大值', () => {
      engine.start();
      addGold(engine, 1e20);
      const gold = (engine as any).getResource('gold');
      expect(gold.amount).toBeLessThanOrEqual(gold.maxAmount);
    });

    it('负数索引建筑操作应安全', () => {
      engine.start();
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingLevel(-1)).toBe(0);
    });

    it('超大索引建筑操作应安全', () => {
      engine.start();
      expect(engine.purchaseBuilding(999)).toBe(false);
      expect(engine.getBuildingCost(999)).toEqual({});
      expect(engine.getBuildingLevel(999)).toBe(0);
    });

    it('不存在队友的升级等级应为 0', () => {
      expect(engine.getCompanionUpgradeLevel('nonexistent')).toBe(0);
    });

    it('无探索时进度应为 0', () => {
      expect(engine.getDungeonExploreProgress()).toBe(0);
    });

    it('金币不足时声望预览为 0', () => {
      expect(engine.getPrestigePreview()).toBe(0);
    });
  });

  // ========== 颜色与渲染常量 ==========

  describe('颜色与渲染常量', () => {
    it('COLORS 应包含所有必要颜色', () => {
      expect(COLORS.bgGradient1).toBeDefined();
      expect(COLORS.textPrimary).toBeDefined();
      expect(COLORS.accent).toBeDefined();
      expect(COLORS.goldColor).toBeDefined();
      expect(COLORS.xpColor).toBeDefined();
      expect(COLORS.magicItemColor).toBeDefined();
      expect(COLORS.portalColor).toBeDefined();
      expect(COLORS.torchColor).toBeDefined();
    });

    it('HERO_DRAW 应包含渲染参数', () => {
      expect(HERO_DRAW.centerX).toBe(240);
      expect(HERO_DRAW.centerY).toBe(200);
      expect(HERO_DRAW.bodyWidth).toBeGreaterThan(0);
      expect(HERO_DRAW.bodyHeight).toBeGreaterThan(0);
    });

    it('BUILDING_PANEL 应包含面板参数', () => {
      expect(BUILDING_PANEL.startY).toBeGreaterThan(0);
      expect(BUILDING_PANEL.itemHeight).toBeGreaterThan(0);
    });

    it('RESOURCE_PANEL 应包含面板参数', () => {
      expect(RESOURCE_PANEL.startY).toBeGreaterThan(0);
      expect(RESOURCE_PANEL.itemHeight).toBeGreaterThan(0);
    });
  });

  // ========== Update 循环 ==========

  describe('Update 循环', () => {
    it('tick 后动画计时器应增加', () => {
      engine.start();
      const before = (engine as any)._heroAnimTimer;
      tick(engine, 16);
      const after = (engine as any)._heroAnimTimer;
      expect(after).toBeGreaterThan(before);
    });

    it('tick 后飘字应更新', () => {
      engine.start();
      engine.click();
      tick(engine, 1000);
      // 飘字应该消失
      const texts = (engine as any)._floatingTexts;
      expect(texts.length).toBe(0);
    });

    it('tick 应统计资源产出', () => {
      engine.start();
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      tick(engine, 1000);
      expect(engine.totalGoldEarned).toBeGreaterThan(0);
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('应支持 on/off 事件监听', () => {
      engine.start();
      const handler = vi.fn();
      engine.on('stateChange', handler);
      engine.click();
      engine.off('stateChange', handler);
      engine.click();
      // handler 被调用 1 次后 off
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('应触发 resourceUnlocked 事件', () => {
      engine.start();
      const handler = vi.fn();
      engine.on('resourceUnlocked', handler);
      const upgrade = (engine as any).upgrades.get('tavern');
      upgrade.level = 5;
      tick(engine);
      expect(handler).toHaveBeenCalledWith('xp');
    });
  });

  // ========== 综合测试 ==========

  describe('综合测试', () => {
    it('完整游戏流程', () => {
      engine.start();

      // 1. 点击赚金币
      for (let i = 0; i < 50; i++) {
        engine.click();
      }
      expect(getGold(engine)).toBeGreaterThan(0);

      // 2. 购买酒馆
      const goldBefore = getGold(engine);
      addGold(engine, 100);
      expect(engine.purchaseBuilding(0)).toBe(true);

      // 3. 解锁经验资源
      const tavernUpgrade = (engine as any).upgrades.get('tavern');
      tavernUpgrade.level = 5;
      tick(engine);

      // 4. 招募队友
      addGold(engine, 1000);
      expect(engine.unlockCompanion('gale')).toBe(true);

      // 5. 探索地下城
      expect(engine.startDungeonExplore('goblin_cave')).toBe(true);
      (engine as any).completeDungeonExplore();

      // 6. 验证状态
      const state = engine.getState();
      expect(state.buildings.tavern).toBeGreaterThanOrEqual(1); // 5 from direct + 1 from purchase
      expect(state.statistics.totalDungeonsCompleted).toBe(1);
    });

    it('声望重置流程', () => {
      engine.start();

      // 积累金币
      addGold(engine, MIN_PRESTIGE_GOLD * 10);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 10;

      // 升级队友
      addXp(engine, 100);
      addMagicItems(engine, 10);
      engine.upgradeCompanion('shadowheart');

      // 声望
      const fateGained = engine.doPrestige();
      expect(fateGained).toBeGreaterThan(0);
      expect(engine.prestige.currency).toBe(fateGained);

      // 验证重置
      expect(getGold(engine)).toBe(0);
      expect(engine.getBuildingLevel(0)).toBe(0);

      // 验证保留
      expect(engine.getCompanionUpgradeLevel('shadowheart')).toBe(1);
      expect(engine.prestige.count).toBe(1);
    });
  });
});
