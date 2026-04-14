/**
 * 宗门崛起 (Sect Rise) — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectRiseEngine } from '@/games/sect-rise/SectRiseEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_STONE_PER_CLICK,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_STONES,
  DISCIPLES,
  BUILDINGS,
  COLORS,
  SECT_DRAW,
  BUILDING_PANEL,
} from '@/games/sect-rise/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): SectRiseEngine {
  const engine = new SectRiseEngine();
  engine.init(createCanvas());
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addSpiritStones(engine: SectRiseEngine, amount: number): void {
  (engine as any).addResource('spirit-stone', amount);
}

function addHerb(engine: SectRiseEngine, amount: number): void {
  (engine as any).addResource('herb', amount);
}

function addArtifact(engine: SectRiseEngine, amount: number): void {
  (engine as any).addResource('artifact', amount);
}

function addReputation(engine: SectRiseEngine, amount: number): void {
  (engine as any).addResource('reputation', amount);
}

/** 获取资源数量 */
function getResourceAmount(engine: SectRiseEngine, id: string): number {
  return (engine as any).getResource(id)?.amount ?? 0;
}

// ========== 测试套件 ==========

describe('SectRiseEngine', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==================== 1. 引擎创建与初始化 ====================

  describe('引擎创建与初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(SectRiseEngine);
    });

    it('gameId 应为 sect-rise', () => {
      expect((engine as any)._gameId).toBe('sect-rise');
    });

    it('初始状态应为 playing（start 后）', () => {
      expect((engine as any)._status).toBe('playing');
    });

    it('Canvas 尺寸应正确设置', () => {
      const canvas = createCanvas();
      expect(canvas.width).toBe(CANVAS_WIDTH);
      expect(canvas.height).toBe(CANVAS_HEIGHT);
    });

    it('灵石资源初始应为 0', () => {
      expect(getResourceAmount(engine, 'spirit-stone')).toBe(0);
    });

    it('灵石初始应已解锁', () => {
      const ss = (engine as any).getResource('spirit-stone');
      expect(ss.unlocked).toBe(true);
    });

    it('仙草初始应未解锁', () => {
      const herb = (engine as any).getResource('herb');
      expect(herb.unlocked).toBe(false);
    });

    it('法器初始应未解锁', () => {
      const artifact = (engine as any).getResource('artifact');
      expect(artifact.unlocked).toBe(false);
    });

    it('声望初始应未解锁', () => {
      const rep = (engine as any).getResource('reputation');
      expect(rep.unlocked).toBe(false);
    });

    it('初始 totalSpiritStonesEarned 应为 0', () => {
      expect(engine.totalSpiritStonesEarned).toBe(0);
    });

    it('初始 totalClicks 应为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('初始 selectedIndex 应为 0', () => {
      expect(engine.selectedIndex).toBe(0);
    });

    it('初始声望 currency 应为 0', () => {
      expect(engine.prestige.currency).toBe(0);
    });

    it('初始声望 count 应为 0', () => {
      expect(engine.prestige.count).toBe(0);
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

    it('SPIRIT_STONE_PER_CLICK 应为 1', () => {
      expect(SPIRIT_STONE_PER_CLICK).toBe(1);
    });

    it('PRESTIGE_MULTIPLIER 应为 0.035', () => {
      expect(PRESTIGE_MULTIPLIER).toBe(0.035);
    });

    it('MIN_PRESTIGE_STONES 应为 30000', () => {
      expect(MIN_PRESTIGE_STONES).toBe(30000);
    });

    it('DISCIPLES 应包含六种弟子', () => {
      expect(DISCIPLES.length).toBe(6);
    });

    it('DISCIPLES 应包含外门弟子', () => {
      expect(DISCIPLES.find(d => d.id === 'outer')).toBeDefined();
    });

    it('DISCIPLES 应包含内门弟子', () => {
      expect(DISCIPLES.find(d => d.id === 'inner')).toBeDefined();
    });

    it('DISCIPLES 应包含核心弟子', () => {
      expect(DISCIPLES.find(d => d.id === 'core')).toBeDefined();
    });

    it('DISCIPLES 应包含长老', () => {
      expect(DISCIPLES.find(d => d.id === 'elder')).toBeDefined();
    });

    it('DISCIPLES 应包含太上长老', () => {
      expect(DISCIPLES.find(d => d.id === 'supreme')).toBeDefined();
    });

    it('DISCIPLES 应包含掌门', () => {
      expect(DISCIPLES.find(d => d.id === 'patriarch')).toBeDefined();
    });

    it('BUILDINGS 应包含六个建筑', () => {
      expect(BUILDINGS.length).toBe(6);
    });

    it('COLORS 应包含必要颜色', () => {
      expect(COLORS.spiritStoneColor).toBeDefined();
      expect(COLORS.herbColor).toBeDefined();
      expect(COLORS.artifactColor).toBeDefined();
      expect(COLORS.reputationColor).toBeDefined();
    });

    it('SECT_DRAW 应包含渲染参数', () => {
      expect(SECT_DRAW.centerX).toBeDefined();
      expect(SECT_DRAW.centerY).toBeDefined();
    });

    it('BUILDING_PANEL 应包含面板参数', () => {
      expect(BUILDING_PANEL.startY).toBeDefined();
      expect(BUILDING_PANEL.itemHeight).toBeDefined();
    });
  });

  // ==================== 3. 点击系统 ====================

  describe('点击系统', () => {
    it('点击应返回获得的灵石数', () => {
      const result = engine.click();
      expect(result).toBeGreaterThan(0);
    });

    it('点击应增加灵石资源', () => {
      engine.click();
      expect(getResourceAmount(engine, 'spirit-stone')).toBeGreaterThan(0);
    });

    it('点击应增加 totalSpiritStonesEarned', () => {
      engine.click();
      expect(engine.totalSpiritStonesEarned).toBeGreaterThan(0);
    });

    it('点击应增加 totalClicks', () => {
      engine.click();
      expect(engine.totalClicks).toBe(1);
    });

    it('多次点击应累加灵石', () => {
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
      expect(getResourceAmount(engine, 'spirit-stone')).toBeGreaterThanOrEqual(3);
    });

    it('未初始化时点击应返回 0', () => {
      const rawEngine = new SectRiseEngine();
      expect(rawEngine.click()).toBe(0);
    });

    it('点击基础值应至少为 SPIRIT_STONE_PER_CLICK', () => {
      const result = engine.click();
      expect(result).toBeGreaterThanOrEqual(SPIRIT_STONE_PER_CLICK);
    });
  });

  // ==================== 4. 建筑系统 ====================

  describe('建筑系统', () => {
    it('灵石矿场初始应已解锁', () => {
      const upgrade = (engine as any).upgrades.get('stone-mine');
      expect(upgrade.unlocked).toBe(true);
    });

    it('药园初始应未解锁', () => {
      const upgrade = (engine as any).upgrades.get('herb-garden');
      expect(upgrade.unlocked).toBe(false);
    });

    it('getBuildingCost 应返回建筑费用', () => {
      const cost = engine.getBuildingCost(0);
      expect(cost).toBeDefined();
      expect(cost['spirit-stone']).toBeGreaterThan(0);
    });

    it('getBuildingCost 越界应返回空对象', () => {
      expect(engine.getBuildingCost(-1)).toEqual({});
      expect(engine.getBuildingCost(999)).toEqual({});
    });

    it('getBuildingLevel 初始应为 0', () => {
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('getBuildingLevel 越界应返回 0', () => {
      expect(engine.getBuildingLevel(-1)).toBe(0);
      expect(engine.getBuildingLevel(999)).toBe(0);
    });

    it('purchaseBuilding 资源不足时应返回 false', () => {
      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('purchaseBuilding 资源充足时应返回 true', () => {
      addSpiritStones(engine, 100);
      expect(engine.purchaseBuilding(0)).toBe(true);
    });

    it('购买后建筑等级应为 1', () => {
      addSpiritStones(engine, 100);
      engine.purchaseBuilding(0);
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('购买后应扣除资源', () => {
      addSpiritStones(engine, 100);
      const cost = engine.getBuildingCost(0);
      const before = getResourceAmount(engine, 'spirit-stone');
      engine.purchaseBuilding(0);
      const after = getResourceAmount(engine, 'spirit-stone');
      expect(before - after).toBe(cost['spirit-stone']);
    });

    it('purchaseBuilding 越界应返回 false', () => {
      expect(engine.purchaseBuilding(-1)).toBe(false);
      expect(engine.purchaseBuilding(999)).toBe(false);
    });

    it('建筑费用应随等级递增', () => {
      addSpiritStones(engine, 10000);
      const cost0 = engine.getBuildingCost(0);
      engine.purchaseBuilding(0);
      const cost1 = engine.getBuildingCost(0);
      expect(cost1['spirit-stone']).toBeGreaterThan(cost0['spirit-stone']);
    });

    it('建筑应正确产出灵石', () => {
      addSpiritStones(engine, 100);
      engine.purchaseBuilding(0);
      (engine as any).recalculateProduction();
      const ss = (engine as any).getResource('spirit-stone');
      expect(ss.perSecond).toBeGreaterThan(0);
    });

    it('购买建筑达到 maxLevel 后不能再购买', () => {
      const upgrade = (engine as any).upgrades.get('stone-mine');
      upgrade.level = BUILDINGS[0].maxLevel;
      upgrade.unlocked = true;
      addSpiritStones(engine, 1e10);
      expect(engine.purchaseBuilding(0)).toBe(false);
    });

    it('未解锁建筑不应能购买', () => {
      addSpiritStones(engine, 1e10);
      expect(engine.purchaseBuilding(1)).toBe(false); // herb-garden requires stone-mine
    });

    it('前置建筑满足后应解锁新建筑', () => {
      addSpiritStones(engine, 10000);
      engine.purchaseBuilding(0); // stone-mine level 1
      (engine as any).checkBuildingUnlocks();
      const herbGarden = (engine as any).upgrades.get('herb-garden');
      expect(herbGarden.unlocked).toBe(true);
    });

    it('灵石矿场等级 >= 5 应解锁仙草资源', () => {
      const upgrade = (engine as any).upgrades.get('stone-mine');
      upgrade.level = 5;
      upgrade.unlocked = true;
      (engine as any).checkResourceUnlocks();
      const herb = (engine as any).getResource('herb');
      expect(herb.unlocked).toBe(true);
    });

    it('炼丹房等级 >= 1 应解锁法器资源', () => {
      const upgrade = (engine as any).upgrades.get('pill-room');
      upgrade.level = 1;
      upgrade.unlocked = true;
      (engine as any).checkResourceUnlocks();
      const artifact = (engine as any).getResource('artifact');
      expect(artifact.unlocked).toBe(true);
    });

    it('护宗大阵等级 >= 1 应解锁声望资源', () => {
      const upgrade = (engine as any).upgrades.get('formation');
      upgrade.level = 1;
      upgrade.unlocked = true;
      (engine as any).checkResourceUnlocks();
      const rep = (engine as any).getResource('reputation');
      expect(rep.unlocked).toBe(true);
    });
  });

  // ==================== 5. 弟子系统 ====================

  describe('弟子系统', () => {
    it('初始外门弟子应已解锁', () => {
      expect(engine.isDiscipleUnlocked('outer')).toBe(true);
    });

    it('初始内门弟子应未解锁', () => {
      expect(engine.isDiscipleUnlocked('inner')).toBe(false);
    });

    it('初始核心弟子应未解锁', () => {
      expect(engine.isDiscipleUnlocked('core')).toBe(false);
    });

    it('初始长老应未解锁', () => {
      expect(engine.isDiscipleUnlocked('elder')).toBe(false);
    });

    it('初始太上长老应未解锁', () => {
      expect(engine.isDiscipleUnlocked('supreme')).toBe(false);
    });

    it('初始掌门应未解锁', () => {
      expect(engine.isDiscipleUnlocked('patriarch')).toBe(false);
    });

    it('disciples 应返回所有弟子状态', () => {
      expect(engine.disciples.length).toBe(DISCIPLES.length);
    });

    it('disciples 返回的应是副本', () => {
      const d1 = engine.disciples;
      const d2 = engine.disciples;
      expect(d1).not.toBe(d2);
    });

    it('recruitDisciple 灵石不足应返回 false', () => {
      expect(engine.recruitDisciple('inner')).toBe(false);
    });

    it('recruitDisciple 灵石充足应返回 true', () => {
      addSpiritStones(engine, 5000);
      expect(engine.recruitDisciple('inner')).toBe(true);
    });

    it('招募后弟子应已解锁', () => {
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      expect(engine.isDiscipleUnlocked('inner')).toBe(true);
    });

    it('招募后应扣除灵石', () => {
      addSpiritStones(engine, 5000);
      const before = getResourceAmount(engine, 'spirit-stone');
      engine.recruitDisciple('inner');
      const after = getResourceAmount(engine, 'spirit-stone');
      expect(after).toBeLessThan(before);
    });

    it('重复招募同一弟子应返回 false', () => {
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      addSpiritStones(engine, 5000);
      expect(engine.recruitDisciple('inner')).toBe(false);
    });

    it('招募不存在的弟子应返回 false', () => {
      expect(engine.recruitDisciple('nonexistent')).toBe(false);
    });

    it('外门弟子解锁费用应为 0', () => {
      const outer = DISCIPLES.find(d => d.id === 'outer')!;
      expect(outer.unlockCost).toBe(0);
    });

    it('内门弟子解锁费用应为 500', () => {
      const inner = DISCIPLES.find(d => d.id === 'inner')!;
      expect(inner.unlockCost).toBe(500);
    });

    it('核心弟子解锁费用应为 3000', () => {
      const core = DISCIPLES.find(d => d.id === 'core')!;
      expect(core.unlockCost).toBe(3000);
    });

    it('弟子加成应提升点击倍率', () => {
      const base = engine.getClickMultiplier();
      // outer already unlocked, gives spirit_stone bonus
      expect(base).toBeGreaterThanOrEqual(1);
    });

    it('招募内门弟子应提升点击倍率', () => {
      const base = engine.getClickMultiplier();
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      expect(engine.getClickMultiplier()).toBeGreaterThan(base);
    });

    it('弟子应提升灵石产出倍率', () => {
      const base = engine.getSpiritStoneMultiplier();
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      expect(engine.getSpiritStoneMultiplier()).toBeGreaterThan(base);
    });

    it('弟子应提升仙草产出倍率', () => {
      const base = engine.getHerbMultiplier();
      addSpiritStones(engine, 10000);
      engine.recruitDisciple('core');
      expect(engine.getHerbMultiplier()).toBeGreaterThan(base);
    });

    it('弟子应提升法器产出倍率', () => {
      const base = engine.getArtifactMultiplier();
      addSpiritStones(engine, 50000);
      engine.recruitDisciple('elder');
      expect(engine.getArtifactMultiplier()).toBeGreaterThan(base);
    });

    it('太上长老应提升全产出倍率', () => {
      addSpiritStones(engine, 200000);
      engine.recruitDisciple('supreme');
      expect(engine.getSpiritStoneMultiplier()).toBeGreaterThan(1);
      expect(engine.getHerbMultiplier()).toBeGreaterThan(1);
    });

    it('掌门应提升全产出倍率', () => {
      addSpiritStones(engine, 500000);
      engine.recruitDisciple('patriarch');
      expect(engine.getSpiritStoneMultiplier()).toBeGreaterThan(1);
      expect(engine.getReputationMultiplier()).toBeGreaterThan(1);
    });
  });

  // ==================== 6. 声望系统 ====================

  describe('声望系统', () => {
    it('canPrestige 灵石不足时应返回 false', () => {
      expect(engine.canPrestige()).toBe(false);
    });

    it('canPrestige 灵石充足时应返回 true', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      expect(engine.canPrestige()).toBe(true);
    });

    it('getPrestigePreview 灵石不足时应返回 0', () => {
      expect(engine.getPrestigePreview()).toBe(0);
    });

    it('getPrestigePreview 灵石充足时应返回正值', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      expect(engine.getPrestigePreview()).toBeGreaterThan(0);
    });

    it('doPrestige 灵石不足时应返回 0', () => {
      expect(engine.doPrestige()).toBe(0);
    });

    it('doPrestige 灵石充足时应返回正值', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      const result = engine.doPrestige();
      expect(result).toBeGreaterThan(0);
    });

    it('doPrestige 后应增加宗门气运', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('doPrestige 后应增加声望次数', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      expect(engine.prestige.count).toBe(1);
    });

    it('doPrestige 后资源应被重置', () => {
      addSpiritStones(engine, 50000);
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      expect(getResourceAmount(engine, 'spirit-stone')).toBe(0);
    });

    it('doPrestige 后建筑等级应被重置', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      expect(engine.getBuildingLevel(0)).toBe(0);
    });

    it('doPrestige 后弟子解锁状态应保留', () => {
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      expect(engine.isDiscipleUnlocked('inner')).toBe(true);
    });

    it('getPrestigeMultiplier 初始应为 1', () => {
      expect(engine.getPrestigeMultiplier()).toBe(1);
    });

    it('getPrestigeMultiplier 有宗门气运时应大于 1', () => {
      engine.prestige.currency = 10;
      expect(engine.getPrestigeMultiplier()).toBeGreaterThan(1);
    });

    it('声望加成应正确计算', () => {
      engine.prestige.currency = 10;
      const expected = 1 + 10 * PRESTIGE_MULTIPLIER;
      expect(engine.getPrestigeMultiplier()).toBeCloseTo(expected, 5);
    });

    it('多次声望应累积宗门气运', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      const firstCurrency = engine.prestige.currency;
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      expect(engine.prestige.currency).toBeGreaterThan(firstCurrency);
    });
  });

  // ==================== 7. 产出倍率系统 ====================

  describe('产出倍率系统', () => {
    it('getClickMultiplier 初始应 >= 1（外门弟子加成）', () => {
      expect(engine.getClickMultiplier()).toBeGreaterThanOrEqual(1);
    });

    it('getSpiritStoneMultiplier 初始应 >= 1', () => {
      expect(engine.getSpiritStoneMultiplier()).toBeGreaterThanOrEqual(1);
    });

    it('getHerbMultiplier 初始应为 1', () => {
      expect(engine.getHerbMultiplier()).toBe(1);
    });

    it('getArtifactMultiplier 初始应为 1', () => {
      expect(engine.getArtifactMultiplier()).toBe(1);
    });

    it('getReputationMultiplier 初始应为 1', () => {
      expect(engine.getReputationMultiplier()).toBe(1);
    });

    it('声望应乘入灵石产出倍率', () => {
      engine.prestige.currency = 5;
      const mult = engine.getSpiritStoneMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('声望应乘入仙草产出倍率', () => {
      engine.prestige.currency = 5;
      const mult = engine.getHerbMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('声望应乘入法器产出倍率', () => {
      engine.prestige.currency = 5;
      const mult = engine.getArtifactMultiplier();
      expect(mult).toBeGreaterThan(1);
    });

    it('声望应乘入声望产出倍率', () => {
      engine.prestige.currency = 5;
      const mult = engine.getReputationMultiplier();
      expect(mult).toBeGreaterThan(1);
    });
  });

  // ==================== 8. 存档系统 ====================

  describe('存档系统', () => {
    it('save 应返回有效 SaveData', () => {
      const data = engine.save();
      expect(data).toBeDefined();
    });

    it('save 应包含设置数据', () => {
      const data = engine.save();
      expect(data.settings).toBeDefined();
    });

    it('save 应包含弟子状态', () => {
      const data = engine.save();
      const settings = data.settings as Record<string, unknown>;
      expect(settings.disciples).toBeDefined();
    });

    it('save 应包含统计数据', () => {
      const data = engine.save();
      const settings = data.settings as Record<string, unknown>;
      expect(settings.stats).toBeDefined();
    });

    it('load 应恢复统计数据', () => {
      engine.click();
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.totalClicks).toBe(1);
    });

    it('load 应恢复弟子状态', () => {
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.isDiscipleUnlocked('inner')).toBe(true);
    });

    it('load 应恢复选中索引', () => {
      (engine as any)._selectedIndex = 3;
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.selectedIndex).toBe(3);
    });

    it('getState 应返回完整状态', () => {
      const state = engine.getState();
      expect(state.resources).toBeDefined();
      expect(state.buildings).toBeDefined();
      expect(state.disciples).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.statistics).toBeDefined();
    });

    it('getState 应包含 selectedIndex', () => {
      const state = engine.getState();
      expect(state.selectedIndex).toBe(0);
    });

    it('loadState 应恢复资源数量', () => {
      addSpiritStones(engine, 500);
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(getResourceAmount(newEngine, 'spirit-stone')).toBe(500);
    });

    it('loadState 应恢复建筑等级', () => {
      addSpiritStones(engine, 100);
      engine.purchaseBuilding(0);
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.getBuildingLevel(0)).toBe(1);
    });

    it('loadState 应恢复弟子状态', () => {
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.isDiscipleUnlocked('inner')).toBe(true);
    });

    it('loadState 应恢复声望数据', () => {
      engine.prestige = { currency: 5, count: 2 };
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.prestige.currency).toBe(5);
      expect(newEngine.prestige.count).toBe(2);
    });

    it('loadState 应恢复统计数据', () => {
      engine.click();
      engine.click();
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.totalClicks).toBe(2);
    });

    it('loadState 应恢复 selectedIndex', () => {
      (engine as any)._selectedIndex = 4;
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.selectedIndex).toBe(4);
    });

    it('save → load 往返应保持一致', () => {
      engine.click();
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.isDiscipleUnlocked('inner')).toBe(true);
      expect(newEngine.totalClicks).toBe(1);
    });
  });

  // ==================== 9. 键盘输入 ====================

  describe('键盘输入', () => {
    it('空格键应触发点击', () => {
      engine.handleKeyDown(' ');
      expect(engine.totalClicks).toBe(1);
    });

    it('ArrowUp 应减少选中建筑索引', () => {
      (engine as any)._selectedIndex = 3;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(2);
    });

    it('ArrowUp 不应低于 0', () => {
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(0);
    });

    it('ArrowDown 应增加选中建筑索引', () => {
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(1);
    });

    it('ArrowDown 不应超过建筑数 - 1', () => {
      (engine as any)._selectedIndex = BUILDINGS.length - 1;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(BUILDINGS.length - 1);
    });

    it('Enter 应购买选中建筑', () => {
      addSpiritStones(engine, 100);
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(0)).toBe(1);
    });

    it('d 键应招募下一个未解锁弟子', () => {
      addSpiritStones(engine, 5000);
      engine.handleKeyDown('d');
      expect(engine.isDiscipleUnlocked('inner')).toBe(true);
    });

    it('D 键应招募下一个未解锁弟子', () => {
      addSpiritStones(engine, 5000);
      engine.handleKeyDown('D');
      expect(engine.isDiscipleUnlocked('inner')).toBe(true);
    });

    it('p 键应触发声望', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.handleKeyDown('p');
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('P 键应触发声望', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.handleKeyDown('P');
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('handleKeyUp 不应抛出异常', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ==================== 10. 渲染 ====================

  describe('渲染', () => {
    it('onRender 不应抛出异常', () => {
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('onRender 点击后不应抛出异常', () => {
      engine.click();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('onRender 有建筑后不应抛出异常', () => {
      addSpiritStones(engine, 100);
      engine.purchaseBuilding(0);
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('onRender 有弟子后不应抛出异常', () => {
      addSpiritStones(engine, 5000);
      engine.recruitDisciple('inner');
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==================== 11. 弟子定义验证 ====================

  describe('弟子定义验证', () => {
    it('所有弟子应有 id', () => {
      for (const d of DISCIPLES) {
        expect(d.id).toBeTruthy();
      }
    });

    it('所有弟子应有名称', () => {
      for (const d of DISCIPLES) {
        expect(d.name).toBeTruthy();
      }
    });

    it('所有弟子应有图标', () => {
      for (const d of DISCIPLES) {
        expect(d.icon).toBeTruthy();
      }
    });

    it('所有弟子应有描述', () => {
      for (const d of DISCIPLES) {
        expect(d.description).toBeTruthy();
      }
    });

    it('所有弟子应有有效的 bonusType', () => {
      const validTypes = ['spirit_stone', 'herb', 'artifact', 'reputation', 'all'];
      for (const d of DISCIPLES) {
        expect(validTypes).toContain(d.bonusType);
      }
    });

    it('所有弟子 bonusValue 应大于 0', () => {
      for (const d of DISCIPLES) {
        expect(d.bonusValue).toBeGreaterThan(0);
      }
    });

    it('弟子解锁费用应递增', () => {
      for (let i = 1; i < DISCIPLES.length; i++) {
        expect(DISCIPLES[i].unlockCost).toBeGreaterThan(DISCIPLES[i - 1].unlockCost);
      }
    });
  });

  // ==================== 12. 建筑定义验证 ====================

  describe('建筑定义验证', () => {
    it('所有建筑应有 id', () => {
      for (const b of BUILDINGS) {
        expect(b.id).toBeTruthy();
      }
    });

    it('所有建筑应有名称', () => {
      for (const b of BUILDINGS) {
        expect(b.name).toBeTruthy();
      }
    });

    it('所有建筑应有图标', () => {
      for (const b of BUILDINGS) {
        expect(b.icon).toBeTruthy();
      }
    });

    it('所有建筑应有 costMultiplier > 1', () => {
      for (const b of BUILDINGS) {
        expect(b.costMultiplier).toBeGreaterThan(1);
      }
    });

    it('所有建筑应有 maxLevel > 0', () => {
      for (const b of BUILDINGS) {
        expect(b.maxLevel).toBeGreaterThan(0);
      }
    });

    it('所有建筑应有 baseProduction >= 0', () => {
      for (const b of BUILDINGS) {
        expect(b.baseProduction).toBeGreaterThanOrEqual(0);
      }
    });

    it('所有建筑应有 productionResource', () => {
      for (const b of BUILDINGS) {
        expect(b.productionResource).toBeTruthy();
      }
    });
  });

  // ==================== 13. 边界条件 ====================

  describe('边界条件', () => {
    it('连续点击不应出错', () => {
      for (let i = 0; i < 100; i++) {
        engine.click();
      }
      expect(engine.totalClicks).toBe(100);
    });

    it('load 空数据不应崩溃', () => {
      expect(() => engine.load({} as any)).not.toThrow();
    });

    it('loadState 空状态不应崩溃', () => {
      expect(() => engine.loadState({} as any)).not.toThrow();
    });

    it('isDiscipleUnlocked 不存在的弟子应返回 false', () => {
      expect(engine.isDiscipleUnlocked('nonexistent')).toBe(false);
    });

    it('recruitDisciple 不存在的弟子应返回 false', () => {
      expect(engine.recruitDisciple('nonexistent')).toBe(false);
    });

    it('getPrestigePreview 计算应正确', () => {
      (engine as any)._stats.totalSpiritStonesEarned = MIN_PRESTIGE_STONES * 4;
      const preview = engine.getPrestigePreview();
      // PRESTIGE_BASE_FORTUNE * sqrt(4) = 1 * 2 = 2
      expect(preview).toBe(2);
    });

    it('doPrestige 后 totalPrestigeCount 应增加', () => {
      (engine as any)._stats.totalSpiritStonesEarned = 50000;
      engine.doPrestige();
      const state = engine.getState();
      expect(state.statistics.totalPrestigeCount).toBe(1);
    });
  });
});
