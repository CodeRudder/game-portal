/**
 * 家族传说 (Clan Saga) — 完整测试套件 v3.0
 *
 * 适配重构后的 ClanSagaEngine（基于 BuildingSystem + PrestigeSystem +
 * UnitSystem + StageSystem + TechTreeSystem 架构）。
 */
import { ClanSagaEngine } from '@/games/clan-saga/ClanSagaEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GAME_ID,
  GAME_TITLE,
  BUILDINGS,
  HEROES,
  DYNASTIES,
  INVENTIONS,
  PRESTIGE_CONFIG,
  RESOURCES,
  INITIAL_RESOURCES,
  INITIALLY_UNLOCKED,
  CLICK_REWARD,
  COLOR_THEME,
  RARITY_COLORS,
} from '@/games/clan-saga/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): ClanSagaEngine {
  const engine = new ClanSagaEngine();
  engine.init(createCanvas());
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addResource(engine: ClanSagaEngine, id: string, amount: number): void {
  (engine as any).giveRes(id, amount);
}

/** 给粮食 */
function addGrain(engine: ClanSagaEngine, amount: number): void {
  addResource(engine, 'grain', amount);
}

/** 给丝绸 */
function addSilk(engine: ClanSagaEngine, amount: number): void {
  addResource(engine, 'silk', amount);
}

/** 给灵石 */
function addStone(engine: ClanSagaEngine, amount: number): void {
  addResource(engine, 'stone', amount);
}

/** 给威望 */
function addPrestige(engine: ClanSagaEngine, amount: number): void {
  addResource(engine, 'prestige', amount);
}

/** 触发一次 update */
function tick(engine: ClanSagaEngine, dt: number = 16): void {
  (engine as any).onUpdate(dt);
}

/** 获取资源数量 */
function getResourceAmount(engine: ClanSagaEngine, id: string): number {
  return (engine as any).res[id] ?? 0;
}

// ========== 测试套件 ==========

describe('ClanSagaEngine', () => {
  let engine: ClanSagaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==================== 1. 引擎创建与初始化 ====================

  describe('引擎创建与初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(ClanSagaEngine);
    });

    it('gameId 应为 clan-saga', () => {
      expect((engine as any)._gameId).toBe('clan-saga');
    });

    it('初始状态应为 playing（start 后）', () => {
      expect((engine as any)._status).toBe('playing');
    });

    it('Canvas 尺寸应正确设置', () => {
      const canvas = createCanvas();
      expect(canvas.width).toBe(CANVAS_WIDTH);
      expect(canvas.height).toBe(CANVAS_HEIGHT);
    });

    it('初始化后粮食资源应为 INITIAL_RESOURCES.grain', () => {
      expect(getResourceAmount(engine, 'grain')).toBe(INITIAL_RESOURCES.grain);
    });

    it('丝绸初始应为 0', () => {
      expect(getResourceAmount(engine, 'silk')).toBe(0);
    });

    it('灵石初始应为 0', () => {
      expect(getResourceAmount(engine, 'stone')).toBe(0);
    });

    it('威望初始应为 0', () => {
      expect(getResourceAmount(engine, 'prestige')).toBe(0);
    });

    it('灵田初始应已解锁', () => {
      const bldg = (engine as any).bldg;
      expect(bldg.isUnlocked('farm')).toBe(true);
    });

    it('织造坊初始应未解锁', () => {
      const bldg = (engine as any).bldg;
      expect(bldg.isUnlocked('workshop')).toBe(false);
    });

    it('初始 selectedBuildingIndex 应为 0', () => {
      expect((engine as any).selIdx).toBe(0);
    });

    it('初始 activePanel 应为 none', () => {
      expect(engine.getActivePanel()).toBe('none');
    });
  });

  // ==================== 2. 常量验证 ====================

  describe('常量验证', () => {
    it('CANVAS_WIDTH 应为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 应为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('GAME_ID 应为 clan-saga', () => {
      expect(GAME_ID).toBe('clan-saga');
    });

    it('GAME_TITLE 应为 家族传说', () => {
      expect(GAME_TITLE).toBe('家族传说');
    });

    it('RESOURCES 应包含四个资源', () => {
      expect(RESOURCES.length).toBe(4);
      const ids = RESOURCES.map(r => r.id);
      expect(ids).toContain('grain');
      expect(ids).toContain('silk');
      expect(ids).toContain('stone');
      expect(ids).toContain('prestige');
    });

    it('BUILDINGS 数组长度应为 8', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('HEROES 数组长度应为 8', () => {
      expect(HEROES.length).toBe(8);
    });

    it('DYNASTIES 数组长度应为 6', () => {
      expect(DYNASTIES.length).toBe(6);
    });

    it('INVENTIONS 数组长度应为 9', () => {
      expect(INVENTIONS.length).toBe(9);
    });

    it('INITIALLY_UNLOCKED 应包含 farm', () => {
      expect(INITIALLY_UNLOCKED).toContain('farm');
    });

    it('CLICK_REWARD 应为 { grain: 1 }', () => {
      expect(CLICK_REWARD).toEqual({ grain: 1 });
    });

    it('PRESTIGE_CONFIG 应包含必要字段', () => {
      expect(PRESTIGE_CONFIG.currencyName).toBeDefined();
      expect(PRESTIGE_CONFIG.base).toBeGreaterThan(0);
      expect(PRESTIGE_CONFIG.threshold).toBeGreaterThan(0);
      expect(PRESTIGE_CONFIG.bonusMultiplier).toBeGreaterThan(0);
      expect(PRESTIGE_CONFIG.retention).toBeGreaterThanOrEqual(0);
      expect(PRESTIGE_CONFIG.retention).toBeLessThanOrEqual(1);
    });

    it('COLOR_THEME 应包含必要颜色', () => {
      expect(COLOR_THEME.bgGradient1).toBeDefined();
      expect(COLOR_THEME.textPrimary).toBeDefined();
      expect(COLOR_THEME.accentGold).toBeDefined();
      expect(COLOR_THEME.accentGreen).toBeDefined();
    });

    it('RARITY_COLORS 应包含稀有度颜色', () => {
      expect(RARITY_COLORS.rare).toBeDefined();
      expect(RARITY_COLORS.epic).toBeDefined();
      expect(RARITY_COLORS.legendary).toBeDefined();
    });

    it('INITIAL_RESOURCES 应包含 grain: 50', () => {
      expect(INITIAL_RESOURCES.grain).toBe(50);
    });

    it('BUILDINGS 中 farm 应为第一个建筑', () => {
      expect(BUILDINGS[0].id).toBe('farm');
    });

    it('DYNASTIES 中 small_clan 应为初始阶段', () => {
      expect(DYNASTIES[0].id).toBe('small_clan');
    });
  });

  // ==================== 3. 点击系统 ====================

  describe('点击系统', () => {
    it('点击应获得 CLICK_REWARD 数量的粮食', () => {
      const before = getResourceAmount(engine, 'grain');
      (engine as any).doClick();
      const after = getResourceAmount(engine, 'grain');
      expect(after - before).toBe(CLICK_REWARD.grain);
    });

    it('连续点击应累积粮食', () => {
      const before = getResourceAmount(engine, 'grain');
      for (let i = 0; i < 10; i++) {
        (engine as any).doClick();
      }
      expect(getResourceAmount(engine, 'grain')).toBe(before + 10);
    });

    it('非 playing 状态点击应不增加资源', () => {
      (engine as any)._status = 'paused';
      const before = getResourceAmount(engine, 'grain');
      (engine as any).doClick();
      // doClick 内部检查状态，非 playing 直接返回
      expect(getResourceAmount(engine, 'grain')).toBe(before);
    });

    it('点击应触发 stateChange 事件', () => {
      const listener = jest.fn();
      engine.on('stateChange', listener);
      (engine as any).doClick();
      expect(listener).toHaveBeenCalled();
    });

    it('点击应增加 totalClicks 统计', () => {
      (engine as any).doClick();
      (engine as any).doClick();
      const stats = (engine as any).stats;
      expect(stats.get('totalClicks')).toBe(2);
    });
  });

  // ==================== 4. 建筑系统 ====================

  describe('建筑系统', () => {
    it('灵田初始应已解锁', () => {
      const bldg = (engine as any).bldg;
      expect(bldg.isUnlocked('farm')).toBe(true);
    });

    it('织造坊初始应未解锁（需要灵田 Lv.1）', () => {
      const bldg = (engine as any).bldg;
      expect(bldg.isUnlocked('workshop')).toBe(false);
    });

    it('购买灵田应成功', () => {
      addGrain(engine, 100);
      const result = (engine as any).buyBuilding();
      expect(result).not.toBe(false);
    });

    it('资源不足时购买应失败', () => {
      // 灵田基础费用 grain:10，初始 grain:50
      // 但我们先消耗掉
      (engine as any).res.grain = 0;
      const bldg = (engine as any).bldg;
      const cost = bldg.getCost('farm');
      const result = bldg.canAfford('farm', (id: string, a: number) => (engine as any).res[id] >= a);
      expect(result).toBe(false);
    });

    it('购买后灵田等级应为 1', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      const bldg = (engine as any).bldg;
      expect(bldg.getLevel('farm')).toBe(1);
    });

    it('建筑费用应随等级递增', () => {
      const bldg = (engine as any).bldg;
      const cost1 = bldg.getCost('farm');
      // 手动升级两次（farm costMultiplier=1.07，Math.floor(10*1.07)=10，
      // Math.floor(10*1.07^2)=11）
      bldg.purchase('farm',
        (id: string, a: number) => true,
        () => {},
      );
      bldg.purchase('farm',
        (id: string, a: number) => true,
        () => {},
      );
      const cost2 = bldg.getCost('farm');
      expect(cost2.grain).toBeGreaterThan(cost1.grain);
    });

    it('getLevel 未购买建筑应返回 0', () => {
      const bldg = (engine as any).bldg;
      expect(bldg.getLevel('workshop')).toBe(0);
    });

    it('getCost 应返回正确的费用结构', () => {
      const bldg = (engine as any).bldg;
      const cost = bldg.getCost('farm');
      expect(cost).toHaveProperty('grain');
      expect(cost.grain).toBeGreaterThan(0);
    });

    it('建筑解锁应在满足条件时自动触发', () => {
      // 购买灵田后，织造坊应解锁
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      // checkUnlocks 在 update 中调用
      tick(engine, 16);
      const bldg = (engine as any).bldg;
      expect(bldg.isUnlocked('workshop')).toBe(true);
    });

    it('getUnlockedBuildings 初始应只包含灵田', () => {
      const bldg = (engine as any).bldg;
      const unlocked = bldg.getUnlockedBuildings();
      expect(unlocked.length).toBe(1);
      expect(unlocked[0].id).toBe('farm');
    });
  });

  // ==================== 5. 族人（英雄）系统 ====================

  describe('族人系统', () => {
    it('HEROES 应包含 8 个英雄', () => {
      expect(HEROES.length).toBe(8);
    });

    it('英雄应包含必要属性', () => {
      for (const h of HEROES) {
        expect(h.id).toBeDefined();
        expect(h.name).toBeDefined();
        expect(h.rarity).toBeDefined();
        expect(h.baseStats).toBeDefined();
        expect(h.growthRates).toBeDefined();
        expect(h.recruitCost).toBeDefined();
      }
    });

    it('英雄稀有度应为有效值', () => {
      const valid = ['uncommon', 'rare', 'epic', 'legendary'];
      for (const h of HEROES) {
        expect(valid).toContain(h.rarity);
      }
    });
  });

  // ==================== 6. 阶段系统 ====================

  describe('阶段系统', () => {
    it('初始阶段应为 small_clan', () => {
      const stage = engine.getStageInfo();
      expect(stage?.id).toBe('small_clan');
    });

    it('DYNASTIES 应按顺序排列', () => {
      for (let i = 0; i < DYNASTIES.length; i++) {
        expect(DYNASTIES[i].order).toBe(i + 1);
      }
    });

    it('阶段应包含必要属性', () => {
      for (const d of DYNASTIES) {
        expect(d.id).toBeDefined();
        expect(d.name).toBeDefined();
        expect(d.productionMultiplier).toBeGreaterThan(0);
      }
    });

    it('getStageInfo 应返回当前阶段', () => {
      const stage = engine.getStageInfo();
      expect(stage).toBeDefined();
      expect(stage?.name).toBe('小族');
    });
  });

  // ==================== 7. 声望/重置系统 ====================

  describe('声望/重置系统', () => {
    it('初始声望货币应为 0', () => {
      const ps = engine.getPrestigeState();
      expect(ps.currency).toBe(0);
    });

    it('初始声望次数应为 0', () => {
      const ps = engine.getPrestigeState();
      expect(ps.count).toBe(0);
    });

    it('资源不足时 doPrestige 应不增加声望', () => {
      engine.doPrestige();
      const ps = engine.getPrestigeState();
      expect(ps.count).toBe(0);
    });

    it('资源充足时 doPrestige 应增加声望货币', () => {
      // 添加大量资源
      addGrain(engine, PRESTIGE_CONFIG.threshold * 100);
      addSilk(engine, PRESTIGE_CONFIG.threshold * 100);
      addStone(engine, PRESTIGE_CONFIG.threshold * 100);
      engine.doPrestige();
      const ps = engine.getPrestigeState();
      expect(ps.currency).toBeGreaterThan(0);
    });

    it('doPrestige 应增加声望次数', () => {
      addGrain(engine, PRESTIGE_CONFIG.threshold * 100);
      addSilk(engine, PRESTIGE_CONFIG.threshold * 100);
      addStone(engine, PRESTIGE_CONFIG.threshold * 100);
      engine.doPrestige();
      const ps = engine.getPrestigeState();
      expect(ps.count).toBe(1);
    });

    it('doPrestige 应重置资源（保留比例）', () => {
      const amount = PRESTIGE_CONFIG.threshold * 100;
      addGrain(engine, amount);
      addSilk(engine, amount);
      addStone(engine, amount);
      engine.doPrestige();
      // 资源应被重置（保留 10%），所以应远小于原始值
      const grain = getResourceAmount(engine, 'grain');
      const silk = getResourceAmount(engine, 'silk');
      const stone = getResourceAmount(engine, 'stone');
      // 保留后应为原始值的 10%
      expect(grain).toBeLessThan(amount);
      expect(silk).toBeLessThan(amount);
      expect(stone).toBeLessThan(amount);
      // 保留比例应大于 0
      expect(grain).toBeGreaterThan(0);
    });

    it('doPrestige 应重置建筑等级', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      const bldg = (engine as any).bldg;
      expect(bldg.getLevel('farm')).toBe(1);

      addGrain(engine, PRESTIGE_CONFIG.threshold * 100);
      addSilk(engine, PRESTIGE_CONFIG.threshold * 100);
      addStone(engine, PRESTIGE_CONFIG.threshold * 100);
      engine.doPrestige();
      expect(bldg.getLevel('farm')).toBe(0);
    });

    it('doPrestige 应触发 stateChange 事件', () => {
      addGrain(engine, PRESTIGE_CONFIG.threshold * 100);
      addSilk(engine, PRESTIGE_CONFIG.threshold * 100);
      addStone(engine, PRESTIGE_CONFIG.threshold * 100);
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });
  });

  // ==================== 8. 产出计算 ====================

  describe('产出计算', () => {
    it('无建筑时总产出应为空', () => {
      const bldg = (engine as any).bldg;
      const prod = bldg.getTotalProduction();
      // farm 未购买，等级为 0
      const hasProduction = Object.values(prod).some((v: any) => v > 0);
      expect(hasProduction).toBe(false);
    });

    it('购买灵田后粮食产出应大于 0', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      const bldg = (engine as any).bldg;
      const prod = bldg.getTotalProduction();
      expect(prod.grain).toBeGreaterThan(0);
    });

    it('灵田基础产出应匹配定义', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      const bldg = (engine as any).bldg;
      const prod = bldg.getProduction('farm');
      // baseProduction=0.1, level=1 => 0.1
      expect(prod).toBeCloseTo(0.1, 5);
    });

    it('产出倍率应影响有效产出', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      // 设置全局倍率
      const bldg = (engine as any).bldg;
      bldg.setGlobalMultiplier(2.0);
      const prod = bldg.getProduction('farm');
      // baseProduction=0.1, level=1, multiplier=2.0 => 0.2
      expect(prod).toBeCloseTo(0.2, 5);
    });
  });

  // ==================== 9. 存档系统 ====================

  describe('存档系统', () => {
    it('serialize 应返回有效状态', () => {
      const data = engine.serialize();
      expect(data).toBeDefined();
      expect(data.resources).toBeDefined();
      expect(data.buildings).toBeDefined();
    });

    it('serialize 应包含声望状态', () => {
      const data = engine.serialize();
      expect(data.prestigeState).toBeDefined();
      expect(data.prestigeState.currency).toBe(0);
      expect(data.prestigeState.count).toBe(0);
    });

    it('serialize 应包含英雄状态', () => {
      const data = engine.serialize();
      expect(data.heroes).toBeDefined();
    });

    it('serialize 应包含科技状态', () => {
      const data = engine.serialize();
      expect(data.researchedTechs).toBeDefined();
    });

    it('serialize 应包含当前阶段', () => {
      const data = engine.serialize();
      expect(data.currentStage).toBe('small_clan');
    });

    it('deserialize 应恢复资源状态', () => {
      addGrain(engine, 500);
      const data = engine.serialize();
      const engine2 = createEngine();
      engine2.deserialize(data);
      expect(getResourceAmount(engine2, 'grain')).toBe(550); // 50 initial + 500
    });

    it('deserialize 应恢复建筑等级', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      const data = engine.serialize();
      const engine2 = createEngine();
      engine2.deserialize(data);
      const bldg = (engine2 as any).bldg;
      expect(bldg.getLevel('farm')).toBe(1);
    });

    it('getResources 应返回资源副本', () => {
      const res1 = engine.getResources();
      const res2 = engine.getResources();
      expect(res1).toEqual(res2);
      expect(res1).not.toBe(res2);
    });
  });

  // ==================== 10. 键盘输入 ====================

  describe('键盘输入', () => {
    it('handleKeyDown 不应抛出错误', () => {
      expect(() => engine.handleKeyDown(' ')).not.toThrow();
    });

    it('ArrowDown 应增加选中建筑索引', () => {
      // 确保至少有 2 个可见建筑
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      tick(engine, 16);
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).selIdx).toBe(1);
    });

    it('ArrowUp 应减少选中建筑索引', () => {
      (engine as any).selIdx = 2;
      engine.handleKeyDown('ArrowUp');
      expect((engine as any).selIdx).toBe(1);
    });

    it('ArrowUp 不应低于 0', () => {
      (engine as any).selIdx = 0;
      engine.handleKeyDown('ArrowUp');
      expect((engine as any).selIdx).toBe(0);
    });

    it('Escape 应重置面板', () => {
      (engine as any).panel = 'tech';
      engine.handleKeyDown('Escape');
      expect(engine.getActivePanel()).toBe('none');
    });
  });

  // ==================== 11. 动画系统 ====================

  describe('动画系统', () => {
    it('update 应更新 playTime', () => {
      const before = (engine as any).playTime;
      tick(engine, 1000);
      const after = (engine as any).playTime;
      expect(after).toBeGreaterThan(before);
    });

    it('FloatingTextSystem 应正常工作', () => {
      const ftSys = (engine as any).ftSys;
      expect(ftSys).toBeDefined();
    });

    it('ParticleSystem 应正常工作', () => {
      const ptSys = (engine as any).ptSys;
      expect(ptSys).toBeDefined();
    });
  });

  // ==================== 12. 渲染系统 ====================

  describe('渲染系统', () => {
    it('onRender 不应抛出错误', () => {
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('onRender 有资源时不应抛出错误', () => {
      addGrain(engine, 1000);
      addSilk(engine, 100);
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('onRender 有建筑时不应抛出错误', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==================== 13. 科技系统 ====================

  describe('科技系统', () => {
    it('INVENTIONS 应包含 9 项科技', () => {
      expect(INVENTIONS.length).toBe(9);
    });

    it('科技应包含必要属性', () => {
      for (const t of INVENTIONS) {
        expect(t.id).toBeDefined();
        expect(t.name).toBeDefined();
        expect(t.cost).toBeDefined();
        expect(t.effects).toBeDefined();
        expect(t.branch).toBeDefined();
      }
    });

    it('科技分支应包含 agriculture、commerce、cultivation', () => {
      const branches = [...new Set(INVENTIONS.map(t => t.branch))];
      expect(branches).toContain('agriculture');
      expect(branches).toContain('commerce');
      expect(branches).toContain('cultivation');
    });
  });

  // ==================== 14. 边界与综合测试 ====================

  describe('边界与综合测试', () => {
    it('getLevel 无效建筑应返回 0', () => {
      const bldg = (engine as any).bldg;
      expect(bldg.getLevel('nonexistent')).toBe(0);
    });

    it('getCost 无效建筑应返回空对象', () => {
      const bldg = (engine as any).bldg;
      const cost = bldg.getCost('nonexistent');
      expect(cost).toEqual({});
    });

    it('isUnlocked 无效建筑应返回 false', () => {
      const bldg = (engine as any).bldg;
      expect(bldg.isUnlocked('nonexistent')).toBe(false);
    });

    it('多次点击和购买建筑的综合测试', () => {
      // 快速点击积累粮食
      for (let i = 0; i < 50; i++) {
        (engine as any).doClick();
      }
      expect(getResourceAmount(engine, 'grain')).toBeGreaterThan(50);

      // 购买灵田
      (engine as any).buyBuilding();
      const bldg = (engine as any).bldg;
      expect(bldg.getLevel('farm')).toBe(1);
    });

    it('getResources 应返回所有资源', () => {
      const res = engine.getResources();
      expect(res.grain).toBeDefined();
      expect(res.silk).toBeDefined();
      expect(res.stone).toBeDefined();
      expect(res.prestige).toBeDefined();
    });

    it('update 应追踪产出', () => {
      addGrain(engine, 100);
      (engine as any).buyBuilding();
      tick(engine, 1000);
      // 产出应增加粮食
      const grain = getResourceAmount(engine, 'grain');
      expect(grain).toBeGreaterThan(0);
    });

    it('连续 update 不应抛出错误', () => {
      addGrain(engine, 1000);
      (engine as any).buyBuilding();
      for (let i = 0; i < 100; i++) {
        tick(engine, 16);
      }
      expect(getResourceAmount(engine, 'grain')).toBeGreaterThan(0);
    });
  });
});
