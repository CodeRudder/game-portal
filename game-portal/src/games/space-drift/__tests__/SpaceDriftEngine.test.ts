/**
 * Space Drift（太空漂流）放置类游戏 — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceDriftEngine } from '@/games/space-drift/SpaceDriftEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ORE_PER_CLICK,
  CREDIT_BONUS_MULTIPLIER,
  MIN_PRESTIGE_ORE,
  GALAXIES,
  BUILDINGS,
  COLORS,
  SHIP_DRAW,
  SHIP_UPGRADE_COSTS,
  MAX_SHIP_LEVEL,
  RESOURCE_IDS,
  BUILDING_IDS,
} from '@/games/space-drift/constants';

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

function createEngine(): SpaceDriftEngine {
  const engine = new SpaceDriftEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): SpaceDriftEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addOre(engine: SpaceDriftEngine, amount: number): void {
  (engine as any).addResource('ore', amount);
}

function addEnergy(engine: SpaceDriftEngine, amount: number): void {
  (engine as any).addResource('energy', amount);
}

function addData(engine: SpaceDriftEngine, amount: number): void {
  (engine as any).addResource('data', amount);
}

/** 触发一次 update */
function tick(engine: SpaceDriftEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取内部资源数量 */
function getOre(engine: SpaceDriftEngine): number {
  return (engine as any).getResource('ore')?.amount ?? 0;
}

function getEnergy(engine: SpaceDriftEngine): number {
  return (engine as any).getResource('energy')?.amount ?? 0;
}

function getData(engine: SpaceDriftEngine): number {
  return (engine as any).getResource('data')?.amount ?? 0;
}

// ========== 测试 ==========

describe('SpaceDriftEngine', () => {
  let engine: SpaceDriftEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(SpaceDriftEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后矿石为 0', () => {
      expect(getOre(engine)).toBe(0);
    });

    it('init 后能量为 0', () => {
      expect(getEnergy(engine)).toBe(0);
    });

    it('init 后数据为 0', () => {
      expect(getData(engine)).toBe(0);
    });

    it('init 后总矿石获得为 0', () => {
      expect(engine.totalOreEarned).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后 score 为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('init 后 gameId 为 space-drift', () => {
      expect(engine.gameId).toBe('space-drift');
    });

    it('init 后矿石已解锁', () => {
      const res = (engine as any).getResource('ore');
      expect(res.unlocked).toBe(true);
    });

    it('init 后能量未解锁', () => {
      const res = (engine as any).getResource('energy');
      expect(res.unlocked).toBe(false);
    });

    it('init 后数据未解锁', () => {
      const res = (engine as any).getResource('data');
      expect(res.unlocked).toBe(false);
    });
  });

  // ========== 常量验证 ==========

  describe('常量验证', () => {
    it('RESOURCE_IDS 包含 ORE/ENERGY/DATA', () => {
      expect(RESOURCE_IDS.ORE).toBe('ore');
      expect(RESOURCE_IDS.ENERGY).toBe('energy');
      expect(RESOURCE_IDS.DATA).toBe('data');
    });

    it('BUILDING_IDS 包含 8 个建筑', () => {
      expect(Object.keys(BUILDING_IDS).length).toBe(8);
    });

    it('BUILDINGS 数组有 8 个建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('GALAXIES 数组有 6 个星系', () => {
      expect(GALAXIES.length).toBe(6);
    });

    it('ORE_PER_CLICK 为 1', () => {
      expect(ORE_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_ORE 为 50000', () => {
      expect(MIN_PRESTIGE_ORE).toBe(50000);
    });

    it('每个建筑有唯一 ID', () => {
      const ids = BUILDINGS.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个星系有唯一 ID', () => {
      const ids = GALAXIES.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个建筑有名称', () => {
      BUILDINGS.forEach((b) => {
        expect(b.name).toBeTruthy();
      });
    });

    it('每个建筑有图标', () => {
      BUILDINGS.forEach((b) => {
        expect(b.icon).toBeTruthy();
      });
    });

    it('每个建筑有正数基础产出', () => {
      BUILDINGS.forEach((b) => {
        expect(b.baseProduction).toBeGreaterThan(0);
      });
    });

    it('每个建筑费用递增系数大于 1', () => {
      BUILDINGS.forEach((b) => {
        expect(b.costMultiplier).toBeGreaterThan(1);
      });
    });
  });

  // ========== 星系初始化 ==========

  describe('星系初始化', () => {
    it('应有 6 个星系', () => {
      expect(GALAXIES.length).toBe(6);
    });

    it('初始只有太阳系解锁', () => {
      const galaxies = engine.galaxies;
      const sol = galaxies.find((g) => g.id === 'sol');
      expect(sol?.unlocked).toBe(true);
    });

    it('其他星系初始未解锁', () => {
      const galaxies = engine.galaxies;
      const locked = galaxies.filter((g) => g.id !== 'sol');
      locked.forEach((g) => {
        expect(g.unlocked).toBe(false);
      });
    });

    it('所有星系初始探索等级为 0', () => {
      const galaxies = engine.galaxies;
      galaxies.forEach((g) => {
        expect(g.explorationLevel).toBe(0);
      });
    });

    it('星系 ID 唯一', () => {
      const ids = GALAXIES.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个星系有名称', () => {
      GALAXIES.forEach((g) => {
        expect(g.name).toBeTruthy();
      });
    });

    it('每个星系有图标', () => {
      GALAXIES.forEach((g) => {
        expect(g.icon).toBeTruthy();
      });
    });

    it('每个星系有正数加成值', () => {
      GALAXIES.forEach((g) => {
        expect(g.bonusValue).toBeGreaterThan(0);
      });
    });

    it('每个星系有进化倍率', () => {
      GALAXIES.forEach((g) => {
        expect(g.evolutionMultiplier).toBeGreaterThan(0);
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

    it('reset 后矿石归零', () => {
      engine.start();
      addOre(engine, 1000);
      engine.reset();
      expect(getOre(engine)).toBe(0);
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
      addOre(engine, 500);
      engine.reset();
      engine.start();
      expect(getOre(engine)).toBe(0);
    });
  });

  // ========== 点击产生矿石 ==========

  describe('点击产生矿石', () => {
    it('点击一次产生矿石', () => {
      engine.start();
      const gained = engine.click();
      expect(gained).toBeGreaterThan(0);
      expect(getOre(engine)).toBeGreaterThan(0);
    });

    it('连续点击 10 次产生矿石', () => {
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

    it('点击增加总矿石获得', () => {
      engine.start();
      engine.click();
      expect(engine.totalOreEarned).toBeGreaterThan(0);
    });

    it('点击增加 score', () => {
      engine.start();
      engine.click();
      expect(engine.score).toBeGreaterThan(0);
    });

    it('idle 状态下点击无效', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(getOre(engine)).toBe(0);
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
    it('增加矿石', () => {
      addOre(engine, 100);
      expect(getOre(engine)).toBe(100);
    });

    it('增加能量', () => {
      addEnergy(engine, 50);
      expect(getEnergy(engine)).toBe(50);
    });

    it('增加数据', () => {
      addData(engine, 30);
      expect(getData(engine)).toBe(30);
    });

    it('消耗矿石成功', () => {
      addOre(engine, 100);
      (engine as any).spendResource('ore', 50);
      expect(getOre(engine)).toBe(50);
    });

    it('消耗矿石失败（不足）', () => {
      addOre(engine, 10);
      const result = (engine as any).spendResource('ore', 50);
      expect(result).toBeFalsy();
      expect(getOre(engine)).toBe(10);
    });

    it('检查是否有足够资源', () => {
      addOre(engine, 100);
      expect((engine as any).hasResource('ore', 50)).toBe(true);
      expect((engine as any).hasResource('ore', 200)).toBe(false);
    });

    it('canAfford 多资源检查', () => {
      addOre(engine, 100);
      addEnergy(engine, 50);
      expect((engine as any).canAfford({ ore: 50, energy: 20 })).toBe(true);
      expect((engine as any).canAfford({ ore: 50, energy: 200 })).toBe(false);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('应有 8 种建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('初始只有采矿无人机解锁', () => {
      const minerDrone = (engine as any).upgrades.get('miner_drone');
      expect(minerDrone.unlocked).toBe(true);
    });

    it('太阳能板初始未解锁', () => {
      const solarPanel = (engine as any).upgrades.get('solar_panel');
      expect(solarPanel.unlocked).toBe(false);
    });

    it('购买采矿无人机成功', () => {
      engine.start();
      addOre(engine, 100);
      const result = engine.purchaseBuilding(0); // miner_drone
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买采矿无人机失败（资源不足）', () => {
      engine.start();
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('建筑费用递增', () => {
      engine.start();
      addOre(engine, 10000);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.ore).toBeGreaterThan(cost1.ore);
    });

    it('无效索引购买失败', () => {
      engine.start();
      addOre(engine, 10000);
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('未解锁建筑购买失败', () => {
      engine.start();
      addOre(engine, 10000);
      // 太阳能板需要采矿无人机等级 > 0
      const result = engine.purchaseBuilding(1); // solar_panel
      expect(result).toBe(false);
    });

    it('购买后资源减少', () => {
      engine.start();
      addOre(engine, 100);
      const before = getOre(engine);
      engine.purchaseBuilding(0);
      expect(getOre(engine)).toBeLessThan(before);
    });

    it('购买建筑触发 stateChange', () => {
      engine.start();
      addOre(engine, 100);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalled();
    });

    it('建筑达到最大等级后无法继续购买', () => {
      engine.start();
      addOre(engine, 1e10);
      const building = BUILDINGS[0];
      for (let i = 0; i < building.maxLevel; i++) {
        engine.purchaseBuilding(0);
      }
      expect(engine.getBuildingLevel(0)).toBe(building.maxLevel);
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
    });
  });

  // ========== 建筑解锁 ==========

  describe('建筑解锁', () => {
    it('太阳能板在采矿无人机有等级后解锁', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0); // miner_drone
      tick(engine, 16);
      const solarPanel = (engine as any).upgrades.get('solar_panel');
      expect(solarPanel.unlocked).toBe(true);
    });

    it('研究实验室在采矿无人机有等级后解锁', () => {
      engine.start();
      addOre(engine, 1000);
      engine.purchaseBuilding(0); // miner_drone
      tick(engine, 16);
      const researchLab = (engine as any).upgrades.get('research_lab');
      expect(researchLab.unlocked).toBe(true);
    });

    it('精炼厂需要太阳能板', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0); // miner_drone
      tick(engine, 16);
      engine.purchaseBuilding(1); // solar_panel
      tick(engine, 16);
      const refinery = (engine as any).upgrades.get('refinery');
      expect(refinery.unlocked).toBe(true);
    });

    it('护盾发生器需要太阳能板和研究实验室', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0); // miner_drone
      tick(engine, 16);
      engine.purchaseBuilding(1); // solar_panel
      engine.purchaseBuilding(2); // research_lab
      tick(engine, 16);
      const shieldGen = (engine as any).upgrades.get('shield_gen');
      expect(shieldGen.unlocked).toBe(true);
    });

    it('曲速引擎需要研究实验室和精炼厂', () => {
      engine.start();
      addOre(engine, 1e6);
      engine.purchaseBuilding(0); // miner_drone
      tick(engine, 16);
      engine.purchaseBuilding(1); // solar_panel
      engine.purchaseBuilding(2); // research_lab
      tick(engine, 16);
      // 手动解锁能量和数据（精炼厂需要能量）
      const energy = (engine as any).getResource('energy');
      if (!energy.unlocked) energy.unlocked = true;
      addEnergy(engine, 10000);
      const data = (engine as any).getResource('data');
      if (!data.unlocked) data.unlocked = true;
      addData(engine, 1000);
      engine.purchaseBuilding(3); // refinery
      tick(engine, 16);
      const warpDrive = (engine as any).upgrades.get('warp_drive');
      expect(warpDrive.unlocked).toBe(true);
    });
  });

  // ========== 资源解锁 ==========

  describe('资源解锁', () => {
    it('能量在采矿无人机等级>=3时解锁', () => {
      engine.start();
      addOre(engine, 100000);
      for (let i = 0; i < 3; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      const energy = (engine as any).getResource('energy');
      expect(energy.unlocked).toBe(true);
    });

    it('数据在太阳能板等级>=2时解锁', () => {
      engine.start();
      addOre(engine, 1000000);
      // 先解锁采矿无人机
      for (let i = 0; i < 10; i++) {
        engine.purchaseBuilding(0);
      }
      tick(engine, 16);
      // 解锁并购买太阳能板
      for (let i = 0; i < 2; i++) {
        engine.purchaseBuilding(1);
      }
      tick(engine, 16);
      const data = (engine as any).getResource('data');
      expect(data.unlocked).toBe(true);
    });
  });

  // ========== 星系系统 ==========

  describe('星系系统', () => {
    it('解锁半人马座α需要 1000 矿石', () => {
      engine.start();
      addOre(engine, 1000);
      const result = engine.unlockGalaxy('alpha_centauri');
      expect(result).toBe(true);
    });

    it('解锁半人马座α失败（矿石不足）', () => {
      engine.start();
      addOre(engine, 100);
      const result = engine.unlockGalaxy('alpha_centauri');
      expect(result).toBe(false);
    });

    it('重复解锁同一星系失败', () => {
      engine.start();
      addOre(engine, 2000);
      engine.unlockGalaxy('alpha_centauri');
      const result = engine.unlockGalaxy('alpha_centauri');
      expect(result).toBe(false);
    });

    it('解锁不存在的星系失败', () => {
      engine.start();
      const result = engine.unlockGalaxy('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁星系触发 galaxyUnlocked 事件', () => {
      engine.start();
      addOre(engine, 1000);
      const listener = vi.fn();
      engine.on('galaxyUnlocked', listener);
      engine.unlockGalaxy('alpha_centauri');
      expect(listener).toHaveBeenCalledWith('alpha_centauri');
    });

    it('解锁星系增加统计计数', () => {
      engine.start();
      addOre(engine, 1000);
      engine.unlockGalaxy('alpha_centauri');
      expect(engine.statistics.totalGalaxiesUnlocked).toBe(2); // 初始1 + 新解锁1
    });

    it('galaxies getter 返回副本', () => {
      const galaxies1 = engine.galaxies;
      const galaxies2 = engine.galaxies;
      expect(galaxies1).not.toBe(galaxies2);
    });
  });

  // ========== 飞船升级 ==========

  describe('飞船升级', () => {
    it('升级太阳系飞船成功', () => {
      engine.start();
      addEnergy(engine, 100);
      addData(engine, 50);
      const result = engine.upgradeShip('sol');
      expect(result).toBe(true);
      expect(engine.getGalaxyExplorationLevel('sol')).toBe(1);
    });

    it('升级未解锁的星系飞船失败', () => {
      engine.start();
      const result = engine.upgradeShip('alpha_centauri');
      expect(result).toBe(false);
    });

    it('升级资源不足时失败', () => {
      engine.start();
      const result = engine.upgradeShip('sol');
      expect(result).toBe(false);
    });

    it('升级后飞船加成增加', () => {
      engine.start();
      const multBefore = engine.getClickMultiplier();
      addEnergy(engine, 100);
      addData(engine, 50);
      engine.upgradeShip('sol');
      const multAfter = engine.getClickMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('升级触发 shipUpgraded 事件', () => {
      engine.start();
      addEnergy(engine, 100);
      addData(engine, 50);
      const listener = vi.fn();
      engine.on('shipUpgraded', listener);
      engine.upgradeShip('sol');
      expect(listener).toHaveBeenCalledWith('sol', 1);
    });

    it('升级增加统计计数', () => {
      engine.start();
      addEnergy(engine, 100);
      addData(engine, 50);
      engine.upgradeShip('sol');
      expect(engine.statistics.totalShipUpgrades).toBe(1);
    });

    it('获取飞船升级费用', () => {
      const cost1 = engine.getShipUpgradeCost(1);
      expect(cost1).toBeDefined();
      expect(Object.keys(cost1).length).toBeGreaterThan(0);
    });

    it('高级升级费用更高', () => {
      const cost1 = engine.getShipUpgradeCost(1);
      const cost3 = engine.getShipUpgradeCost(3);
      expect(cost3.energy).toBeGreaterThan(cost1.energy);
    });

    it('达到最大等级后无法继续升级', () => {
      engine.start();
      addOre(engine, 1e10);
      addEnergy(engine, 1e10);
      addData(engine, 1e10);
      for (let i = 0; i < MAX_SHIP_LEVEL; i++) {
        engine.upgradeShip('sol');
      }
      expect(engine.getGalaxyExplorationLevel('sol')).toBe(MAX_SHIP_LEVEL);
      const result = engine.upgradeShip('sol');
      expect(result).toBe(false);
    });
  });

  // ========== 加成倍率 ==========

  describe('加成倍率', () => {
    it('初始点击倍率为 1.1（太阳系加成）', () => {
      // 太阳系初始解锁，+10% 点击
      const mult = engine.getClickMultiplier();
      expect(mult).toBeCloseTo(1.1, 1);
    });

    it('初始矿石倍率为 1（无矿石加成星系）', () => {
      const mult = engine.getOreMultiplier();
      expect(mult).toBe(1); // 无声望，太阳系只加点击
    });

    it('初始能量倍率为 1', () => {
      const mult = engine.getEnergyMultiplier();
      expect(mult).toBe(1);
    });

    it('初始数据倍率为 1', () => {
      const mult = engine.getDataMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率初始为 1', () => {
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1);
    });

    it('声望倍率随星际信用点增加', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeCloseTo(1 + 5 * CREDIT_BONUS_MULTIPLIER, 2);
    });

    it('解锁半人马座α增加矿石倍率', () => {
      engine.start();
      addOre(engine, 1000);
      engine.unlockGalaxy('alpha_centauri');
      const mult = engine.getOreMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('初始星际信用点为 0', () => {
      expect((engine as any).prestige.currency).toBe(0);
    });

    it('初始声望次数为 0', () => {
      expect((engine as any).prestige.count).toBe(0);
    });

    it('矿石不足时无法声望', () => {
      engine.start();
      expect(engine.canPrestige()).toBe(false);
    });

    it('声望预览为 0（矿石不足）', () => {
      engine.start();
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('矿石达到最低要求时可以声望', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      expect(engine.canPrestige()).toBe(true);
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('声望重置成功', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      const credits = engine.doPrestige();
      expect(credits).toBeGreaterThan(0);
    });

    it('声望后星际信用点增加', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect((engine as any).prestige.currency).toBeGreaterThan(0);
    });

    it('声望后声望次数增加', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望后资源归零', () => {
      engine.start();
      addOre(engine, MIN_PRESTIGE_ORE * 4);
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect(getOre(engine)).toBe(0);
    });

    it('声望保留星系探索等级', () => {
      engine.start();
      addEnergy(engine, 100);
      addData(engine, 50);
      engine.upgradeShip('sol');
      const evoBefore = engine.getGalaxyExplorationLevel('sol');

      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      const evoAfter = engine.getGalaxyExplorationLevel('sol');
      expect(evoAfter).toBe(evoBefore);
    });

    it('声望保留已解锁星系', () => {
      engine.start();
      addOre(engine, 2000);
      engine.unlockGalaxy('alpha_centauri');

      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      const galaxies = engine.galaxies;
      const alphaCentauri = galaxies.find((g) => g.id === 'alpha_centauri');
      expect(alphaCentauri?.unlocked).toBe(true);
    });

    it('声望触发 prestige 事件', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      const listener = vi.fn();
      engine.on('prestige', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望后声望倍率增加', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 返回有效数据', () => {
      engine.start();
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.gameId).toBe('space-drift');
    });

    it('save 包含资源数据', () => {
      engine.start();
      addOre(engine, 500);
      const data = engine.save();
      expect(data.resources).toBeDefined();
    });

    it('save 包含声望数据', () => {
      engine.start();
      const data = engine.save();
      expect(data.prestige).toBeDefined();
    });

    it('save 包含星系和统计信息', () => {
      engine.start();
      const data = engine.save();
      expect(data.settings).toBeDefined();
      expect((data.settings as any).galaxies).toBeDefined();
      expect((data.settings as any).stats).toBeDefined();
    });

    it('load 恢复游戏状态', () => {
      engine.start();
      addOre(engine, 500);
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      expect(getOre(engine2)).toBeCloseTo(500, 0);
    });

    it('load 恢复星系状态', () => {
      engine.start();
      addOre(engine, 1000);
      engine.unlockGalaxy('alpha_centauri');
      const data = engine.save();

      const engine2 = createEngine();
      engine2.start();
      engine2.load(data);
      const galaxies = engine2.galaxies;
      const alphaCentauri = galaxies.find((g) => g.id === 'alpha_centauri');
      expect(alphaCentauri?.unlocked).toBe(true);
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
      expect(state.galaxies).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
      expect(state.selectedIndex).toBeDefined();
    });

    it('loadState 恢复状态', () => {
      engine.start();
      addOre(engine, 1000);
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      expect(getOre(engine2)).toBeCloseTo(1000, 0);
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

    it('loadState 恢复星系', () => {
      engine.start();
      addOre(engine, 1000);
      engine.unlockGalaxy('alpha_centauri');
      const state = engine.getState();

      const engine2 = createEngine();
      engine2.start();
      engine2.loadState(state as any);
      const galaxies = engine2.galaxies;
      const alphaCentauri = galaxies.find((g) => g.id === 'alpha_centauri');
      expect(alphaCentauri?.unlocked).toBe(true);
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
      expect(getOre(engine)).toBeGreaterThan(0);
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
      addOre(engine, 100);
      (engine as any)._selectedIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('U 键升级飞船', () => {
      engine.start();
      addEnergy(engine, 100);
      addData(engine, 50);
      engine.handleKeyDown('u');
      expect(engine.getGalaxyExplorationLevel('sol')).toBe(1);
    });

    it('P 键触发声望', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      engine.handleKeyDown(' ');
      expect(getOre(engine)).toBe(0);
    });

    it('handleKeyUp 不抛错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ========== Canvas 渲染 ==========

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

    it('有飞船升级时渲染正常', () => {
      engine.start();
      addEnergy(engine, 100);
      addData(engine, 50);
      engine.upgradeShip('sol');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有星系解锁时渲染正常', () => {
      engine.start();
      addOre(engine, 1000);
      engine.unlockGalaxy('alpha_centauri');
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('有建筑时渲染正常', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0);
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('所有建筑满级时渲染正常', () => {
      engine.start();
      addOre(engine, 1e15);
      addEnergy(engine, 1e12);
      addData(engine, 1e9);
      for (let i = 0; i < BUILDINGS.length; i++) {
        const building = BUILDINGS[i];
        for (let j = 0; j < building.maxLevel; j++) {
          engine.purchaseBuilding(i);
        }
      }
      const ctx = createMockCtx();
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ========== 自动生产 ==========

  describe('自动生产', () => {
    it('有建筑后 update 增加资源', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0); // miner_drone
      const before = getOre(engine);
      tick(engine, 1000);
      const after = getOre(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('多个 tick 累积产出', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0);
      const before = getOre(engine);
      for (let i = 0; i < 10; i++) {
        tick(engine, 100);
      }
      const after = getOre(engine);
      expect(after).toBeGreaterThan(before);
    });

    it('太阳能板产出能量', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0); // miner_drone
      tick(engine, 16);
      engine.purchaseBuilding(1); // solar_panel
      tick(engine, 16);
      // 手动解锁能量
      const energy = (engine as any).getResource('energy');
      if (!energy.unlocked) {
        energy.unlocked = true;
      }
      tick(engine, 1000);
      expect(getEnergy(engine)).toBeGreaterThan(0);
    });
  });

  // ========== 产出计算 ==========

  describe('产出计算', () => {
    it('矿石产出包含声望加成', () => {
      engine.start();
      (engine as any).prestige.currency = 5;
      addOre(engine, 100);
      engine.purchaseBuilding(0);
      engine.recalculateProduction();
      const ore = (engine as any).getResource('ore');
      expect(ore.perSecond).toBeGreaterThan(0);
    });

    it('解锁半人马座α增加矿石产出', () => {
      engine.start();
      addOre(engine, 10000);
      engine.purchaseBuilding(0);
      const oreBefore = (engine as any).getResource('ore').perSecond;

      addOre(engine, 1000);
      engine.unlockGalaxy('alpha_centauri');
      const oreAfter = (engine as any).getResource('ore').perSecond;
      expect(oreAfter).toBeGreaterThan(oreBefore);
    });

    it('飞船升级增加对应产出', () => {
      engine.start();
      addOre(engine, 100);
      engine.purchaseBuilding(0);
      const oreBefore = (engine as any).getResource('ore').perSecond;

      addEnergy(engine, 100);
      addData(engine, 50);
      engine.upgradeShip('sol');
      const oreAfter = (engine as any).getResource('ore').perSecond;
      // 太阳系加成是点击，不影响产出
      expect(oreAfter).toBe(oreBefore);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
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

    it('声望后再次声望正常', () => {
      engine.start();
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);

      // 再次声望
      (engine as any)._stats.totalOreEarned = MIN_PRESTIGE_ORE * 4;
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(2);
      expect((engine as any).prestige.currency).toBeGreaterThan(1);
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('upgradePurchased 事件传递正确参数', () => {
      engine.start();
      addOre(engine, 100);
      const listener = vi.fn();
      engine.on('upgradePurchased', listener);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledWith('miner_drone', 1);
    });

    it('stateChange 事件在多种操作后触发', () => {
      engine.start();
      const listener = vi.fn();
      engine.on('stateChange', listener);

      engine.click();
      expect(listener).toHaveBeenCalledTimes(1);

      addOre(engine, 100);
      engine.purchaseBuilding(0);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('galaxyUnlocked 事件传递星系 ID', () => {
      engine.start();
      addOre(engine, 1000);
      const listener = vi.fn();
      engine.on('galaxyUnlocked', listener);
      engine.unlockGalaxy('alpha_centauri');
      expect(listener).toHaveBeenCalledWith('alpha_centauri');
    });

    it('shipUpgraded 事件传递星系 ID 和等级', () => {
      engine.start();
      addEnergy(engine, 100);
      addData(engine, 50);
      const listener = vi.fn();
      engine.on('shipUpgraded', listener);
      engine.upgradeShip('sol');
      expect(listener).toHaveBeenCalledWith('sol', 1);
    });
  });

  // ========== 导入导出 ==========

  describe('导入导出', () => {
    it('exportSave 返回 Base64 字符串', () => {
      engine.start();
      const exported = engine.exportSave();
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);
    });

    it('importSave 恢复游戏状态', () => {
      engine.start();
      addOre(engine, 500);
      const exported = engine.exportSave();

      const engine2 = createEngine();
      engine2.start();
      const result = engine2.importSave(exported);
      expect(result).toBe(true);
      expect(getOre(engine2)).toBeCloseTo(500, 0);
    });

    it('importSave 无效数据返回 false', () => {
      engine.start();
      const result = engine.importSave('invalid-data');
      expect(result).toBe(false);
    });

    it('importSave 错误 gameId 返回 false', () => {
      engine.start();
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
      const result = engine.importSave(fakeData);
      expect(result).toBe(false);
    });
  });

  // ========== 建筑费用计算 ==========

  describe('建筑费用计算', () => {
    it('getBuildingCost 返回正确的费用', () => {
      const cost = engine.getBuildingCost(0);
      expect(cost.ore).toBe(15); // 基础费用
    });

    it('getBuildingCost 无效索引返回空对象', () => {
      const cost1 = engine.getBuildingCost(-1);
      const cost2 = engine.getBuildingCost(99);
      expect(Object.keys(cost1).length).toBe(0);
      expect(Object.keys(cost2).length).toBe(0);
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });

    it('费用随等级指数增长', () => {
      engine.start();
      addOre(engine, 1e10);
      const costs: number[] = [];
      for (let i = 0; i < 5; i++) {
        costs.push(engine.getBuildingCost(0).ore);
        engine.purchaseBuilding(0);
      }
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1]);
      }
    });
  });

  // ========== 星系加成详细测试 ==========

  describe('星系加成详细测试', () => {
    it('天狼星系增加能量倍率', () => {
      engine.start();
      addOre(engine, 5000);
      engine.unlockGalaxy('sirius');
      const mult = engine.getEnergyMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('仙女座增加数据倍率', () => {
      engine.start();
      addOre(engine, 20000);
      engine.unlockGalaxy('andromeda');
      const mult = engine.getDataMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('猎户座增加矿石倍率', () => {
      engine.start();
      addOre(engine, 80000);
      engine.unlockGalaxy('orion');
      const mult = engine.getOreMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('银河核心增加所有倍率', () => {
      engine.start();
      addOre(engine, 300000);
      engine.unlockGalaxy('milky_way');
      expect(engine.getClickMultiplier()).toBeGreaterThan(1.1);
      expect(engine.getOreMultiplier()).toBeGreaterThan(1);
      expect(engine.getEnergyMultiplier()).toBeGreaterThan(1);
      expect(engine.getDataMultiplier()).toBeGreaterThan(1);
    });

    it('多个星系加成叠加', () => {
      engine.start();
      addOre(engine, 1e6);
      engine.unlockGalaxy('alpha_centauri');
      engine.unlockGalaxy('orion');
      const mult = engine.getOreMultiplier();
      expect(mult).toBeGreaterThanOrEqual(1.15 + 0.3); // 两个星系矿石加成叠加
    });
  });

  // ========== 飞船升级费用 ==========

  describe('飞船升级费用', () => {
    it('SHIP_UPGRADE_COSTS 有 5 个等级', () => {
      expect(Object.keys(SHIP_UPGRADE_COSTS).length).toBe(5);
    });

    it('MAX_SHIP_LEVEL 为 5', () => {
      expect(MAX_SHIP_LEVEL).toBe(5);
    });

    it('升级费用逐级增加', () => {
      const cost1 = SHIP_UPGRADE_COSTS[1];
      const cost5 = SHIP_UPGRADE_COSTS[5];
      expect(cost5.energy).toBeGreaterThan(cost1.energy);
      expect(cost5.data).toBeGreaterThan(cost1.data);
    });
  });
});
