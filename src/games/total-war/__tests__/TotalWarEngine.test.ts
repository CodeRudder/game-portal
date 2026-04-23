import { vi } from 'vitest';
/**
 * Total War（全面战争）放置类游戏 — 完整测试套件
 */
import { TotalWarEngine } from '@/games/total-war/TotalWarEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GOLD,
  TROOP_TYPES,
  TERRITORIES,
  BUILDINGS,
  COLORS,
  CASTLE_DRAW,
  BUILDING_IDS,
  RESOURCE_IDS,
} from '@/games/total-war/constants';

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

function createEngine(): TotalWarEngine {
  const engine = new TotalWarEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): TotalWarEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addGold(engine: TotalWarEngine, amount: number): void {
  (engine as any).addResource('gold', amount);
}

function addIron(engine: TotalWarEngine, amount: number): void {
  (engine as any).addResource('iron', amount);
}

function addTroop(engine: TotalWarEngine, amount: number): void {
  (engine as any).addResource('troop', amount);
}

/** 触发一次 update（绕过状态检查） */
function tick(engine: TotalWarEngine, dt: number = 16): void {
  (engine as any).onUpdate(dt);
}

/** 获取内部资源数量 */
function getGold(engine: TotalWarEngine): number {
  return (engine as any).getResource('gold')?.amount ?? 0;
}

function getIron(engine: TotalWarEngine): number {
  return (engine as any).getResource('iron')?.amount ?? 0;
}

function getTroop(engine: TotalWarEngine): number {
  return (engine as any).getResource('troop')?.amount ?? 0;
}

/** 设置兵种状态 */
function setTroopState(engine: TotalWarEngine, troopId: string, state: { unlocked?: boolean; count?: number; upgradeLevel?: number }): void {
  const troops = (engine as any)._troops;
  const troop = troops.find((t: any) => t.id === troopId);
  if (troop) {
    if (state.unlocked !== undefined) troop.unlocked = state.unlocked;
    if (state.count !== undefined) troop.count = state.count;
    if (state.upgradeLevel !== undefined) troop.upgradeLevel = state.upgradeLevel;
  }
}

/** 设置领土状态 */
function setTerritoryConquered(engine: TotalWarEngine, territoryId: string, conquered: boolean): void {
  const territories = (engine as any)._territories;
  const territory = territories.find((t: any) => t.id === territoryId);
  if (territory) territory.conquered = conquered;
}

// ========== 测试 ==========

describe('TotalWarEngine', () => {
  let engine: TotalWarEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(TotalWarEngine);
    });

    it('init 后状态应为 idle', () => {
      expect((engine as any)._status).toBe('idle');
    });

    it('init 后金币为 0', () => {
      expect(getGold(engine)).toBe(0);
    });

    it('init 后铁矿石为 0', () => {
      expect(getIron(engine)).toBe(0);
    });

    it('init 后兵力为 0', () => {
      expect(getTroop(engine)).toBe(0);
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

    it('init 后 gameId 为 total-war', () => {
      expect(engine.gameId).toBe('total-war');
    });

    it('init 后金币已解锁', () => {
      const res = (engine as any).getResource('gold');
      expect(res.unlocked).toBe(true);
    });

    it('init 后铁矿石未解锁', () => {
      const res = (engine as any).getResource('iron');
      expect(res.unlocked).toBe(false);
    });

    it('init 后兵力未解锁', () => {
      const res = (engine as any).getResource('troop');
      expect(res.unlocked).toBe(false);
    });

    it('init 后无已征服领土', () => {
      expect(engine.getConqueredCount()).toBe(0);
    });

    it('init 后总战斗力为 0', () => {
      expect(engine.getTotalPower()).toBe(0);
    });
  });

  // ========== 常量验证 ==========

  describe('常量定义', () => {
    it('RESOURCE_IDS 应包含 GOLD/IRON/TROOP', () => {
      expect(RESOURCE_IDS.GOLD).toBe('gold');
      expect(RESOURCE_IDS.IRON).toBe('iron');
      expect(RESOURCE_IDS.TROOP).toBe('troop');
    });

    it('BUILDING_IDS 应包含 8 个建筑', () => {
      const ids = Object.values(BUILDING_IDS);
      expect(ids.length).toBe(8);
      expect(ids).toContain('gold_mine');
      expect(ids).toContain('iron_mine');
      expect(ids).toContain('barracks');
      expect(ids).toContain('blacksmith');
      expect(ids).toContain('archery_range');
      expect(ids).toContain('stable');
      expect(ids).toContain('war_camp');
      expect(ids).toContain('castle');
    });

    it('GOLD_PER_CLICK 应为 1', () => {
      expect(GOLD_PER_CLICK).toBe(1);
    });

    it('MIN_PRESTIGE_GOLD 应为 50000', () => {
      expect(MIN_PRESTIGE_GOLD).toBe(50000);
    });

    it('BUILDINGS 应有 8 个建筑', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('TROOP_TYPES 应有 6 种兵种', () => {
      expect(TROOP_TYPES.length).toBe(6);
    });

    it('TERRITORIES 应有 8 块领土', () => {
      expect(TERRITORIES.length).toBe(8);
    });

    it('COLORS 应包含必要的颜色键', () => {
      expect(COLORS.accent).toBeDefined();
      expect(COLORS.goldColor).toBeDefined();
      expect(COLORS.ironColor).toBeDefined();
      expect(COLORS.troopColor).toBeDefined();
      expect(COLORS.panelBg).toBeDefined();
    });

    it('CASTLE_DRAW 应包含渲染参数', () => {
      expect(CASTLE_DRAW.centerX).toBe(240);
      expect(CASTLE_DRAW.centerY).toBe(180);
    });
  });

  // ========== 兵种初始化 ==========

  describe('兵种初始化', () => {
    it('应有 6 种兵种', () => {
      expect(TROOP_TYPES.length).toBe(6);
    });

    it('初始所有兵种未解锁', () => {
      const troops = engine.troops;
      troops.forEach((t) => {
        expect(t.unlocked).toBe(false);
      });
    });

    it('所有兵种初始升级等级为 0', () => {
      const troops = engine.troops;
      troops.forEach((t) => {
        expect(t.upgradeLevel).toBe(0);
      });
    });

    it('所有兵种初始数量为 0', () => {
      const troops = engine.troops;
      troops.forEach((t) => {
        expect(t.count).toBe(0);
      });
    });
  });

  // ========== 领土初始化 ==========

  describe('领土初始化', () => {
    it('应有 8 块领土', () => {
      expect(TERRITORIES.length).toBe(8);
    });

    it('初始所有领土未征服', () => {
      const territories = engine.territories;
      territories.forEach((t) => {
        expect(t.conquered).toBe(false);
      });
    });

    it('第一块领土为边境村庄', () => {
      expect(TERRITORIES[0].id).toBe('village');
      expect(TERRITORIES[0].requiredPower).toBe(10);
    });

    it('最后一块领土为暗黑领域', () => {
      expect(TERRITORIES[7].id).toBe('darklands');
      expect(TERRITORIES[7].requiredPower).toBe(8000);
    });
  });

  // ========== 建筑系统 ==========

  describe('建筑系统', () => {
    it('初始只有金矿场解锁', () => {
      const upgrade = (engine as any).upgrades.get('gold_mine');
      expect(upgrade.unlocked).toBe(true);
    });

    it('其他建筑初始未解锁', () => {
      const lockedIds = ['iron_mine', 'barracks', 'blacksmith', 'archery_range', 'stable', 'war_camp', 'castle'];
      for (const id of lockedIds) {
        const upgrade = (engine as any).upgrades.get(id);
        expect(upgrade.unlocked).toBe(false);
      }
    });

    it('购买金矿场应成功', () => {
      addGold(engine, 100);
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(true);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买金矿场应扣除金币', () => {
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      expect(getGold(engine)).toBe(85); // 100 - 15
    });

    it('金币不足时购买失败', () => {
      addGold(engine, 10);
      const result = engine.purchaseBuilding(0);
      expect(result).toBe(false);
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('购买建筑后应增加产出', () => {
      addGold(engine, 100);
      engine.purchaseBuilding(0);
      const gold = (engine as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('建筑等级递增费用', () => {
      addGold(engine, 1000);
      engine.purchaseBuilding(0);
      const cost1 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost2 = engine.getBuildingCost(0);
      expect(cost2.gold).toBeGreaterThan(cost1.gold);
    });

    it('无效索引购买失败', () => {
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(99)).toBe(false);
    });

    it('金矿场升级到3级应解锁铁矿石', () => {
      // 直接设置金矿场等级
      const upgrade = (engine as any).upgrades.get('gold_mine');
      upgrade.level = 3;
      upgrade.unlocked = true;

      tick(engine);

      const iron = (engine as any).getResource('iron');
      expect(iron.unlocked).toBe(true);
    });

    it('建造兵营应解锁兵力资源', () => {
      // 先建金矿场
      const goldMineUpgrade = (engine as any).upgrades.get('gold_mine');
      goldMineUpgrade.level = 1;
      goldMineUpgrade.unlocked = true;

      // 解锁兵营
      const barracksUpgrade = (engine as any).upgrades.get('barracks');
      barracksUpgrade.unlocked = true;
      barracksUpgrade.level = 1;

      tick(engine);

      const troop = (engine as any).getResource('troop');
      expect(troop.unlocked).toBe(true);
    });
  });

  // ========== 点击系统 ==========

  describe('点击系统', () => {
    it('start 后点击应获得金币', () => {
      const eng = startEngine();
      const gained = eng.click();
      expect(gained).toBeGreaterThanOrEqual(GOLD_PER_CLICK);
      expect(getGold(eng)).toBeGreaterThanOrEqual(GOLD_PER_CLICK);
    });

    it('点击应增加统计', () => {
      const eng = startEngine();
      eng.click();
      eng.click();
      expect(eng.totalClicks).toBe(2);
    });

    it('点击应增加分数', () => {
      const eng = startEngine();
      eng.click();
      expect(eng.score).toBeGreaterThan(0);
    });

    it('未 start 时点击返回 0', () => {
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('暂停时点击返回 0', () => {
      const eng = startEngine();
      eng.pause();
      const gained = eng.click();
      expect(gained).toBe(0);
    });
  });

  // ========== 兵种系统 ==========

  describe('兵种系统', () => {
    it('训练未解锁兵种应失败', () => {
      const result = engine.trainTroop('militia');
      expect(result).toBe(false);
    });

    it('训练不存在的兵种应失败', () => {
      const result = engine.trainTroop('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁民兵后应能训练', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 0 });
      addGold(engine, 100);

      const result = engine.trainTroop('militia');
      expect(result).toBe(true);
      expect(engine.getTroopCount('militia')).toBe(1);
    });

    it('训练兵种应扣除费用', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 0 });
      addGold(engine, 50);

      const cost = engine.getTroopTrainCost('militia');
      const goldBefore = getGold(engine);

      engine.trainTroop('militia');
      expect(getGold(engine)).toBe(goldBefore - cost.gold);
    });

    it('资源不足时训练失败', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 0 });
      addGold(engine, 1);

      const result = engine.trainTroop('militia');
      expect(result).toBe(false);
    });

    it('多次训练应累加数量', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 0 });
      addGold(engine, 1000);

      engine.trainTroop('militia');
      engine.trainTroop('militia');
      engine.trainTroop('militia');

      expect(engine.getTroopCount('militia')).toBe(3);
    });

    it('训练应增加统计', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 0 });
      addGold(engine, 1000);

      engine.trainTroop('militia');
      engine.trainTroop('militia');

      const stats = (engine as any)._stats as { totalTroopsTrained: number };
      expect(stats.totalTroopsTrained).toBe(2);
    });
  });

  // ========== 兵种升级 ==========

  describe('兵种升级', () => {
    it('升级未解锁兵种应失败', () => {
      const result = engine.upgradeTroop('militia');
      expect(result).toBe(false);
    });

    it('升级不存在的兵种应失败', () => {
      const result = engine.upgradeTroop('nonexistent');
      expect(result).toBe(false);
    });

    it('解锁后升级应成功', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1, upgradeLevel: 0 });
      addGold(engine, 200);
      addIron(engine, 100);

      const result = engine.upgradeTroop('militia');
      expect(result).toBe(true);
      expect(engine.getTroopUpgradeLevel('militia')).toBe(1);
    });

    it('升级应扣除费用', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1, upgradeLevel: 0 });
      addGold(engine, 200);
      addIron(engine, 100);

      const cost = engine.getTroopUpgradeCost('militia');
      const goldBefore = getGold(engine);
      const ironBefore = getIron(engine);

      engine.upgradeTroop('militia');
      expect(getGold(engine)).toBe(goldBefore - cost.gold);
      expect(getIron(engine)).toBe(ironBefore - cost.iron);
    });

    it('资源不足时升级失败', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1, upgradeLevel: 0 });
      addGold(engine, 10);

      const result = engine.upgradeTroop('militia');
      expect(result).toBe(false);
    });

    it('升级应增加统计', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1, upgradeLevel: 0 });
      addGold(engine, 500);
      addIron(engine, 200);

      engine.upgradeTroop('militia');

      const stats = (engine as any)._stats as { totalTroopUpgrades: number };
      expect(stats.totalTroopUpgrades).toBe(1);
    });

    it('获取不存在的兵种升级等级应为 0', () => {
      expect(engine.getTroopUpgradeLevel('nonexistent')).toBe(0);
    });

    it('获取不存在的兵种数量应为 0', () => {
      expect(engine.getTroopCount('nonexistent')).toBe(0);
    });
  });

  // ========== 战斗力计算 ==========

  describe('战斗力计算', () => {
    it('无兵种时战斗力为 0', () => {
      expect(engine.getTotalPower()).toBe(0);
    });

    it('单个民兵战斗力正确', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1 });
      // 民兵: attack=2, defense=1, total=3
      expect(engine.getTotalPower()).toBe(3);
    });

    it('多个民兵战斗力正确', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 5 });
      // 5 * (2+1) = 15
      expect(engine.getTotalPower()).toBe(15);
    });

    it('升级后战斗力增加', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 2, upgradeLevel: 1 });
      // 2 * (2+1) * 1.3^1 = 7.8 → floor = 7 > 6 (base)
      const power = engine.getTotalPower();
      expect(power).toBeGreaterThan(6); // 2*(2+1)=6 base
    });

    it('多兵种战斗力累加', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 2 });
      setTroopState(engine, 'swordsman', { unlocked: true, count: 1 });
      // militia: 2*(2+1)=6, swordsman: 1*(5+4)=9, total=15
      expect(engine.getTotalPower()).toBe(15);
    });

    it('未解锁兵种不计算战斗力', () => {
      setTroopState(engine, 'militia', { unlocked: false, count: 10 });
      expect(engine.getTotalPower()).toBe(0);
    });

    it('数量为 0 不计算战斗力', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 0 });
      expect(engine.getTotalPower()).toBe(0);
    });
  });

  // ========== 领土征服 ==========

  describe('领土征服', () => {
    it('未 start 时征服失败', () => {
      const result = engine.conquerTerritory('village');
      expect(result).toBe(false);
    });

    it('start 后战斗力不足时征服失败', () => {
      const eng = startEngine();
      const result = eng.conquerTerritory('village');
      expect(result).toBe(false);
    });

    it('战斗力足够时征服成功', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });
      // 5 * 3 = 15 > 10 (village required)

      const result = eng.conquerTerritory('village');
      expect(result).toBe(true);
      expect(eng.isTerritoryConquered('village')).toBe(true);
    });

    it('征服领土应获得兵力奖励', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });
      const troopBefore = getTroop(eng);

      eng.conquerTerritory('village');
      // village gives 5 troops
      expect(getTroop(eng)).toBe(troopBefore + 5);
    });

    it('重复征服同一领土应失败', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });

      eng.conquerTerritory('village');
      const result = eng.conquerTerritory('village');
      expect(result).toBe(false);
    });

    it('征服不存在的领土应失败', () => {
      const eng = startEngine();
      const result = eng.conquerTerritory('nonexistent');
      expect(result).toBe(false);
    });

    it('征服应增加领土计数', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });

      eng.conquerTerritory('village');
      expect(eng.getConqueredCount()).toBe(1);
    });

    it('征服应增加战斗胜利统计', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });

      eng.conquerTerritory('village');
      expect(eng.totalBattlesWon).toBe(1);
    });

    it('第二块领土需要先征服第一块', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 20 });
      // 20 * 3 = 60 > 30 (forest required)

      // 未征服 village 时不能征服 forest
      expect(eng.canConquerTerritory('forest')).toBe(false);

      // 先征服 village
      eng.conquerTerritory('village');
      expect(eng.canConquerTerritory('forest')).toBe(true);
    });

    it('canConquerTerritory 对已征服领土返回 false', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });
      eng.conquerTerritory('village');
      expect(eng.canConquerTerritory('village')).toBe(false);
    });

    it('canConquerTerritory 对不存在领土返回 false', () => {
      expect(engine.canConquerTerritory('nonexistent')).toBe(false);
    });

    it('isTerritoryConquered 对不存在领土返回 false', () => {
      expect(engine.isTerritoryConquered('nonexistent')).toBe(false);
    });

    it('征服领土后应重新计算产出', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });
      eng.conquerTerritory('village');

      const gold = (eng as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThan(0);
    });

    it('征服全部领土后计数应为 8', () => {
      const eng = startEngine();
      // 给足够战斗力
      setTroopState(eng, 'knight', { unlocked: true, count: 1000 });

      for (const t of TERRITORIES) {
        eng.conquerTerritory(t.id);
      }
      expect(eng.getConqueredCount()).toBe(8);
    });
  });

  // ========== 资源产出 ==========

  describe('资源产出', () => {
    it('建筑产出应在 update 中生效', () => {
      const eng = startEngine();
      addGold(eng, 100);
      eng.purchaseBuilding(0); // gold_mine

      // purchaseBuilding calls recalculateProduction, so perSecond is set
      // But the base update() only adds production when status is 'playing'
      // We need to tick through the proper update path
      const goldBefore = getGold(eng);
      (eng as any).update(1000); // 1 second through base update

      const goldAfter = getGold(eng);
      expect(goldAfter).toBeGreaterThan(goldBefore);
    });

    it('领土加成应在产出中体现', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });
      eng.conquerTerritory('village');

      // 领土加成 goldReward=1/s
      const gold = (eng as any).getResource('gold');
      expect(gold.perSecond).toBeGreaterThanOrEqual(1);
    });
  });

  // ========== 加成系统 ==========

  describe('加成系统', () => {
    it('无加成时点击倍率为 1', () => {
      // 没有兵种提供点击加成
      expect(engine.getClickMultiplier()).toBe(1);
    });

    it('民兵提供点击加成', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 10 });
      const mult = engine.getClickMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('声望加成正确', () => {
      (engine as any).prestige.currency = 10;
      const mult = engine.getPrestigeMultiplier();
      expect(mult).toBe(1 + 10 * PRESTIGE_BONUS_MULTIPLIER);
    });

    it('领土加成影响金币倍率', () => {
      const multBefore = engine.getGoldMultiplier();
      setTerritoryConquered(engine, 'village', true);
      const multAfter = engine.getGoldMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('领土加成影响铁矿石倍率', () => {
      const multBefore = engine.getIronMultiplier();
      setTerritoryConquered(engine, 'village', true);
      const multAfter = engine.getIronMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });

    it('领土加成影响兵力倍率', () => {
      const multBefore = engine.getTroopMultiplier();
      setTerritoryConquered(engine, 'village', true);
      const multAfter = engine.getTroopMultiplier();
      expect(multAfter).toBeGreaterThan(multBefore);
    });
  });

  // ========== 声望系统 ==========

  describe('声望系统', () => {
    it('金币不足时不能声望', () => {
      expect(engine.canPrestige()).toBe(false);
    });

    it('金币不足时声望返回 0', () => {
      expect(engine.doPrestige()).toBe(0);
    });

    it('金币足够时可以声望', () => {
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD + 1000;
      expect(engine.canPrestige()).toBe(true);
    });

    it('声望应获得荣耀点', () => {
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const glory = engine.doPrestige();
      expect(glory).toBeGreaterThan(0);
    });

    it('声望应重置资源', () => {
      addGold(engine, 10000);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;

      engine.doPrestige();
      expect(getGold(engine)).toBe(0);
    });

    it('声望应重置建筑等级', () => {
      addGold(engine, 10000);
      (engine as any).upgrades.get('gold_mine').level = 5;
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;

      engine.doPrestige();
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('声望应保留荣耀点', () => {
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const glory = engine.doPrestige();

      expect((engine as any).prestige.currency).toBe(glory);
    });

    it('声望应增加声望次数', () => {
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      engine.doPrestige();

      expect((engine as any).prestige.count).toBe(1);
    });

    it('声望应保留兵种升级等级', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 5, upgradeLevel: 3 });
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;

      engine.doPrestige();
      expect(engine.getTroopUpgradeLevel('militia')).toBe(3);
    });

    it('声望应保留领土征服状态', () => {
      setTerritoryConquered(engine, 'village', true);
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;

      engine.doPrestige();
      expect(engine.isTerritoryConquered('village')).toBe(true);
    });

    it('声望预览正确', () => {
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const preview = engine.getPrestigePreview();
      expect(preview).toBe(Math.floor(Math.sqrt(4)));
    });

    it('声望预览在不足时为 0', () => {
      (engine as any)._stats.totalGoldEarned = 100;
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('多次声望应累加荣耀点', () => {
      // 第一次声望
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const glory1 = engine.doPrestige();

      // 模拟再次获得金币
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 9;
      const glory2 = engine.doPrestige();

      expect((engine as any).prestige.currency).toBe(glory1 + glory2);
      expect((engine as any).prestige.count).toBe(2);
    });
  });

  // ========== 存档系统 ==========

  describe('存档系统', () => {
    it('save 应包含 gameId', () => {
      const data = engine.save();
      expect(data.gameId).toBe('total-war');
    });

    it('save 应包含兵种数据', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 5, upgradeLevel: 2 });
      const data = engine.save() as any;
      const militia = data.troops.find((t: any) => t.id === 'militia');
      expect(militia.unlocked).toBe(true);
      expect(militia.count).toBe(5);
      expect(militia.upgradeLevel).toBe(2);
    });

    it('save 应包含领土数据', () => {
      setTerritoryConquered(engine, 'village', true);
      const data = engine.save() as any;
      const village = data.territories.find((t: any) => t.id === 'village');
      expect(village.conquered).toBe(true);
    });

    it('load 应恢复兵种状态', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 10, upgradeLevel: 3 });
      setTerritoryConquered(engine, 'village', true);

      const data = engine.save();
      engine.onInit(); // 重置

      engine.load(data as any);
      expect(engine.getTroopCount('militia')).toBe(10);
      expect(engine.getTroopUpgradeLevel('militia')).toBe(3);
    });

    it('load 应恢复领土状态', () => {
      setTerritoryConquered(engine, 'village', true);
      setTerritoryConquered(engine, 'forest', true);

      const data = engine.save();
      engine.onInit();

      engine.load(data as any);
      expect(engine.isTerritoryConquered('village')).toBe(true);
      expect(engine.isTerritoryConquered('forest')).toBe(true);
    });

    it('export/import 存档应正确', () => {
      addGold(engine, 500);
      const exported = engine.exportSave();

      engine.onInit();
      const result = engine.importSave(exported);
      expect(result).toBe(true);
    });

    it('导入错误存档应失败', () => {
      const result = engine.importSave('invalid base64!!!');
      expect(result).toBe(false);
    });
  });

  // ========== 游戏状态 ==========

  describe('游戏状态', () => {
    it('getState 应返回游戏状态', () => {
      const state = engine.getState();
      expect(state.gameId).toBe('total-war');
      expect(state.resources).toBeDefined();
      expect(state.prestige).toBeDefined();
    });

    it('start 后状态为 playing', () => {
      const eng = startEngine();
      expect(eng.status).toBe('playing');
    });

    it('pause 后状态为 paused', () => {
      const eng = startEngine();
      eng.pause();
      expect(eng.status).toBe('paused');
    });

    it('resume 后状态为 playing', () => {
      const eng = startEngine();
      eng.pause();
      eng.resume();
      expect(eng.status).toBe('playing');
    });

    it('reset 后应回到初始状态', () => {
      const eng = startEngine();
      addGold(eng, 1000);
      eng.click();

      eng.reset();
      expect(getGold(eng)).toBe(0);
      expect(eng.score).toBe(0);
    });
  });

  // ========== 建筑解锁链 ==========

  describe('建筑解锁链', () => {
    it('金矿场初始解锁', () => {
      const upgrade = (engine as any).upgrades.get('gold_mine');
      expect(upgrade.unlocked).toBe(true);
    });

    it('金矿场1级后解锁铁矿场', () => {
      (engine as any).upgrades.get('gold_mine').level = 1;
      tick(engine);
      expect((engine as any).upgrades.get('iron_mine').unlocked).toBe(true);
    });

    it('金矿场1级后解锁兵营', () => {
      (engine as any).upgrades.get('gold_mine').level = 1;
      tick(engine);
      expect((engine as any).upgrades.get('barracks').unlocked).toBe(true);
    });

    it('铁矿场+兵营后解锁铁匠铺', () => {
      (engine as any).upgrades.get('iron_mine').level = 1;
      (engine as any).upgrades.get('barracks').level = 1;
      tick(engine);
      expect((engine as any).upgrades.get('blacksmith').unlocked).toBe(true);
    });

    it('兵营后解锁射箭场', () => {
      (engine as any).upgrades.get('barracks').level = 1;
      tick(engine);
      expect((engine as any).upgrades.get('archery_range').unlocked).toBe(true);
    });

    it('射箭场+铁匠铺后解锁马厩', () => {
      (engine as any).upgrades.get('archery_range').level = 1;
      (engine as any).upgrades.get('blacksmith').level = 1;
      tick(engine);
      expect((engine as any).upgrades.get('stable').unlocked).toBe(true);
    });

    it('马厩后解锁战争营地', () => {
      (engine as any).upgrades.get('stable').level = 1;
      tick(engine);
      expect((engine as any).upgrades.get('war_camp').unlocked).toBe(true);
    });

    it('战争营地后解锁城堡', () => {
      (engine as any).upgrades.get('war_camp').level = 1;
      tick(engine);
      expect((engine as any).upgrades.get('castle').unlocked).toBe(true);
    });
  });

  // ========== 兵种解锁 ==========

  describe('兵种解锁', () => {
    it('兵营1级后解锁民兵', () => {
      (engine as any).upgrades.get('barracks').level = 1;
      tick(engine);
      const militia = engine.troops.find((t) => t.id === 'militia');
      expect(militia?.unlocked).toBe(true);
    });

    it('铁匠铺1级后解锁剑士', () => {
      (engine as any).upgrades.get('blacksmith').level = 1;
      tick(engine);
      const swordsman = engine.troops.find((t) => t.id === 'swordsman');
      expect(swordsman?.unlocked).toBe(true);
    });

    it('射箭场1级后解锁弓箭手', () => {
      (engine as any).upgrades.get('archery_range').level = 1;
      tick(engine);
      const archer = engine.troops.find((t) => t.id === 'archer');
      expect(archer?.unlocked).toBe(true);
    });

    it('马厩1级后解锁骑兵', () => {
      (engine as any).upgrades.get('stable').level = 1;
      tick(engine);
      const cavalry = engine.troops.find((t) => t.id === 'cavalry');
      expect(cavalry?.unlocked).toBe(true);
    });

    it('战争营地1级后解锁攻城器械', () => {
      (engine as any).upgrades.get('war_camp').level = 1;
      tick(engine);
      const siege = engine.troops.find((t) => t.id === 'siege');
      expect(siege?.unlocked).toBe(true);
    });

    it('城堡1级后解锁圣骑士', () => {
      (engine as any).upgrades.get('castle').level = 1;
      tick(engine);
      const knight = engine.troops.find((t) => t.id === 'knight');
      expect(knight?.unlocked).toBe(true);
    });
  });

  // ========== 渲染 ==========

  describe('渲染', () => {
    it('onRender 不应抛出异常', () => {
      const ctx = createMockCtx();
      expect(() => {
        engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('start 后 onRender 不应抛出异常', () => {
      const eng = startEngine();
      const ctx = createMockCtx();
      expect(() => {
        eng.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('点击后渲染不应抛出异常', () => {
      const eng = startEngine();
      eng.click();
      const ctx = createMockCtx();
      expect(() => {
        eng.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });
  });

  // ========== 选择建筑 ==========

  describe('选择建筑', () => {
    it('应能选择建筑', () => {
      engine.selectBuilding(2);
      expect(engine.selectedIndex).toBe(2);
    });

    it('负索引不改变选择', () => {
      engine.selectBuilding(0);
      engine.selectBuilding(-1);
      expect(engine.selectedIndex).toBe(0);
    });

    it('超出范围不改变选择', () => {
      engine.selectBuilding(0);
      engine.selectBuilding(99);
      expect(engine.selectedIndex).toBe(0);
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('点击应触发 stateChange', () => {
      const eng = startEngine();
      const handler = vi.fn();
      eng.on('stateChange', handler);
      eng.click();
      expect(handler).toHaveBeenCalled();
    });

    it('购买建筑应触发 upgradePurchased', () => {
      const eng = startEngine();
      addGold(eng, 100);
      const handler = vi.fn();
      eng.on('upgradePurchased', handler);
      eng.purchaseBuilding(0);
      expect(handler).toHaveBeenCalledWith('gold_mine', 1);
    });

    it('训练兵种应触发 troopTrained', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 0 });
      addGold(eng, 100);
      const handler = vi.fn();
      eng.on('troopTrained', handler);
      eng.trainTroop('militia');
      expect(handler).toHaveBeenCalledWith('militia', 1);
    });

    it('升级兵种应触发 troopUpgraded', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1, upgradeLevel: 0 });
      addGold(engine, 200);
      addIron(engine, 100);
      const handler = vi.fn();
      engine.on('troopUpgraded', handler);
      engine.upgradeTroop('militia');
      expect(handler).toHaveBeenCalledWith('militia', 1);
    });

    it('征服领土应触发 territoryConquered', () => {
      const eng = startEngine();
      setTroopState(eng, 'militia', { unlocked: true, count: 5 });
      const handler = vi.fn();
      eng.on('territoryConquered', handler);
      eng.conquerTerritory('village');
      expect(handler).toHaveBeenCalledWith('village');
    });

    it('声望应触发 prestige', () => {
      (engine as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 4;
      const handler = vi.fn();
      engine.on('prestige', handler);
      engine.doPrestige();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('资源不应超过最大值', () => {
      addGold(engine, 1e20);
      const gold = (engine as any).getResource('gold');
      expect(gold.amount).toBeLessThanOrEqual(gold.maxAmount);
    });

    it('getBuildingCost 无效索引返回空对象', () => {
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingCost(99)).toEqual({});
    });

    it('getBuildingLevel 无效索引返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(99)).toBe(0);
    });

    it('getTroopTrainCost 不存在的兵种返回空对象', () => {
      expect(engine.getTroopTrainCost('nonexistent')).toEqual({});
    });

    it('getTroopUpgradeCost 最大等级时返回空对象', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1, upgradeLevel: 5 });
      expect(engine.getTroopUpgradeCost('militia')).toEqual({});
    });

    it('升级到最大等级后不能再升级', () => {
      setTroopState(engine, 'militia', { unlocked: true, count: 1, upgradeLevel: 5 });
      addGold(engine, 1e6);
      addIron(engine, 1e6);
      expect(engine.upgradeTroop('militia')).toBe(false);
    });

    it('建筑达到最大等级后不能购买', () => {
      const upgrade = (engine as any).upgrades.get('gold_mine');
      upgrade.level = upgrade.maxLevel;
      upgrade.unlocked = true;
      addGold(engine, 1e15);

      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('格式化大数正确', () => {
      expect((engine as any).formatNumber(1000)).toContain('K');
      expect((engine as any).formatNumber(1000000)).toContain('M');
      expect((engine as any).formatNumber(1000000000)).toContain('B');
    });

    it('格式化负数正确', () => {
      expect((engine as any).formatNumber(-100)).toContain('-');
    });
  });

  // ========== 综合场景 ==========

  describe('综合场景', () => {
    it('完整游戏流程：点击 → 建造 → 解锁 → 训练 → 征服', () => {
      const eng = startEngine();

      // 1. 点击获得金币
      for (let i = 0; i < 50; i++) {
        eng.click();
      }
      expect(getGold(eng)).toBeGreaterThan(0);

      // 2. 建造金矿场
      addGold(eng, 200);
      eng.purchaseBuilding(0);
      expect(eng.getBuildingLevel(0)).toBe(1);

      // 3. 解锁铁矿场和兵营
      tick(eng);
      expect((eng as any).upgrades.get('iron_mine').unlocked).toBe(true);
      expect((eng as any).upgrades.get('barracks').unlocked).toBe(true);

      // 4. 建造兵营
      addGold(eng, 500);
      addIron(eng, 100);
      eng.purchaseBuilding(2); // barracks
      tick(eng);

      // 5. 解锁兵力资源和民兵
      const troop = (eng as any).getResource('troop');
      expect(troop.unlocked).toBe(true);

      // 6. 解锁民兵
      const militia = eng.troops.find((t) => t.id === 'militia');
      expect(militia?.unlocked).toBe(true);

      // 7. 训练民兵
      addGold(eng, 100);
      eng.trainTroop('militia');
      eng.trainTroop('militia');
      eng.trainTroop('militia');
      eng.trainTroop('militia');
      expect(eng.getTroopCount('militia')).toBe(4);

      // 8. 征服领土
      // 4 militia * (2+1) = 12 > 10 (village)
      const result = eng.conquerTerritory('village');
      expect(result).toBe(true);
      expect(eng.getConqueredCount()).toBe(1);
    });

    it('声望循环：积累 → 声望 → 加成提升', () => {
      const eng = startEngine();

      // 模拟大量金币
      (eng as any)._stats.totalGoldEarned = MIN_PRESTIGE_GOLD * 9;
      const glory = eng.doPrestige();

      expect(glory).toBeGreaterThan(0);
      expect(eng.getPrestigeMultiplier()).toBeGreaterThan(1);
    });
  });
});
