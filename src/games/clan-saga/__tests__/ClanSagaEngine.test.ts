/**
 * 家族风云 (Clan Saga) — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClanSagaEngine } from '@/games/clan-saga/ClanSagaEngine';
import type { ClanSagaState } from '@/games/clan-saga/ClanSagaEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WEALTH_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  HEIR_TYPES,
  HEIR_TYPE_DEFS,
  MARRIAGE_FAMILIES,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_WEALTH,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
  FLOATING_TEXT_DURATION,
  ANIMATION,
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
function addWealth(engine: ClanSagaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.WEALTH, amount);
}

function addReputation(engine: ClanSagaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.REPUTATION, amount);
}

function addConnection(engine: ClanSagaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.CONNECTION, amount);
}

/** 触发一次 update */
function tick(engine: ClanSagaEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取资源数量 */
function getResourceAmount(engine: ClanSagaEngine, id: string): number {
  return (engine as any).getResource(id)?.amount ?? 0;
}

/** 获取资源每秒产出 */
function getResourcePerSecond(engine: ClanSagaEngine, id: string): number {
  return (engine as any).getResource(id)?.perSecond ?? 0;
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

    it('初始化后财富资源应为 0', () => {
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(0);
    });

    it('财富初始应已解锁', () => {
      const wealth = (engine as any).getResource(RESOURCE_IDS.WEALTH);
      expect(wealth.unlocked).toBe(true);
    });

    it('声望初始应未解锁', () => {
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      expect(reputation.unlocked).toBe(false);
    });

    it('人脉初始应未解锁', () => {
      const connection = (engine as any).getResource(RESOURCE_IDS.CONNECTION);
      expect(connection.unlocked).toBe(false);
    });

    it('初始 totalWealthEarned 应为 0', () => {
      expect(engine.totalWealthEarned).toBe(0);
    });

    it('初始 totalClicks 应为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('初始 selectedBuildingIndex 应为 0', () => {
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('初始 marriedFamilyIds 应为空数组', () => {
      expect(engine.marriedFamilyIds).toEqual([]);
    });

    it('初始 stats 各字段应为 0', () => {
      const stats = engine.stats;
      expect(stats.totalWealthEarned).toBe(0);
      expect(stats.totalClicks).toBe(0);
      expect(stats.totalPrestigeCount).toBe(0);
      expect(stats.totalHeirsTrained).toBe(0);
      expect(stats.totalMarriages).toBe(0);
      expect(stats.totalBuildingsBuilt).toBe(0);
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

    it('WEALTH_PER_CLICK 应为 1', () => {
      expect(WEALTH_PER_CLICK).toBe(1);
    });

    it('RESOURCE_IDS 应包含三个资源', () => {
      expect(RESOURCE_IDS.WEALTH).toBe('wealth');
      expect(RESOURCE_IDS.REPUTATION).toBe('reputation');
      expect(RESOURCE_IDS.CONNECTION).toBe('connection');
    });

    it('BUILDING_IDS 应包含八个建筑', () => {
      expect(BUILDING_IDS.SHOP).toBe('shop');
      expect(BUILDING_IDS.ACADEMY).toBe('academy');
      expect(BUILDING_IDS.DOJO).toBe('dojo');
      expect(BUILDING_IDS.ANCESTRAL_HALL).toBe('ancestral-hall');
      expect(BUILDING_IDS.TEA_HOUSE).toBe('tea-house');
      expect(BUILDING_IDS.BANK).toBe('bank');
      expect(BUILDING_IDS.EMBASSY).toBe('embassy');
      expect(BUILDING_IDS.TREASURY).toBe('treasury');
    });

    it('HEIR_TYPES 应包含四种后代', () => {
      expect(HEIR_TYPES.WARRIOR).toBe('warrior');
      expect(HEIR_TYPES.SCHOLAR).toBe('scholar');
      expect(HEIR_TYPES.MERCHANT).toBe('merchant');
      expect(HEIR_TYPES.DIPLOMAT).toBe('diplomat');
    });

    it('BUILDINGS 数组长度应为 8', () => {
      expect(BUILDINGS.length).toBe(8);
    });

    it('HEIR_TYPE_DEFS 数组长度应为 4', () => {
      expect(HEIR_TYPE_DEFS.length).toBe(4);
    });

    it('MARRIAGE_FAMILIES 数组长度应为 5', () => {
      expect(MARRIAGE_FAMILIES.length).toBe(5);
    });

    it('PRESTIGE_MULTIPLIER 应为 0.04', () => {
      expect(PRESTIGE_MULTIPLIER).toBe(0.04);
    });

    it('MIN_PRESTIGE_WEALTH 应为 50000', () => {
      expect(MIN_PRESTIGE_WEALTH).toBe(50000);
    });

    it('FLOATING_TEXT_DURATION 应为 1000', () => {
      expect(FLOATING_TEXT_DURATION).toBe(1000);
    });

    it('COLORS 应包含必要颜色', () => {
      expect(COLORS.wealthColor).toBeDefined();
      expect(COLORS.reputationColor).toBeDefined();
      expect(COLORS.connectionColor).toBeDefined();
      expect(COLORS.goldPrimary).toBeDefined();
      expect(COLORS.redPrimary).toBeDefined();
      expect(COLORS.prestigeGlow).toBeDefined();
    });

    it('ANIMATION 应包含必要参数', () => {
      expect(ANIMATION.lanternCount).toBeDefined();
      expect(ANIMATION.leafCount).toBeDefined();
      expect(ANIMATION.floatingTextDuration).toBeDefined();
      expect(ANIMATION.prestigeDuration).toBeDefined();
    });
  });

  // ==================== 3. 点击系统 ====================

  describe('点击系统', () => {
    it('点击应获得基础财富', () => {
      const gained = engine.click();
      expect(gained).toBe(WEALTH_PER_CLICK);
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(WEALTH_PER_CLICK);
    });

    it('点击应增加 totalClicks', () => {
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(2);
    });

    it('点击应增加 totalWealthEarned', () => {
      engine.click();
      expect(engine.totalWealthEarned).toBe(WEALTH_PER_CLICK);
    });

    it('连续点击应累积财富', () => {
      for (let i = 0; i < 10; i++) {
        engine.click();
      }
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(10);
    });

    it('getClickPower 基础值应为 WEALTH_PER_CLICK', () => {
      expect(engine.getClickPower()).toBe(WEALTH_PER_CLICK);
    });

    it('非 playing 状态点击应返回 0', () => {
      (engine as any)._status = 'paused';
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('点击应触发 stateChange 事件', () => {
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.click();
      expect(listener).toHaveBeenCalled();
    });

    it('点击应产生飘字效果', () => {
      engine.click();
      const floatingTexts = (engine as any)._floatingTexts;
      expect(floatingTexts.length).toBeGreaterThan(0);
    });

    it('点击应触发缩放动画', () => {
      engine.click();
      expect((engine as any)._clickScale).toBeGreaterThan(1);
    });

    it('武馆等级应提升点击力量', () => {
      // 购买武馆需要先解锁
      addWealth(engine, 1000);
      // 解锁武馆需要财富>=60
      tick(engine, 100);
      // 直接设置武馆等级
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.DOJO);
      if (upgrade) {
        upgrade.unlocked = true;
        upgrade.level = 5;
      }
      const power = engine.getClickPower();
      // 基础1 + 武馆5*0.3 = 2.5
      expect(power).toBeCloseTo(2.5, 1);
    });
  });

  // ==================== 4. 建筑系统 ====================

  describe('建筑系统', () => {
    it('商铺初始应已解锁', () => {
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.SHOP);
      expect(upgrade.unlocked).toBe(true);
    });

    it('书院初始应未解锁（需要财富>=30）', () => {
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.ACADEMY);
      expect(upgrade.unlocked).toBe(false);
    });

    it('购买商铺应成功', () => {
      addWealth(engine, 100);
      const result = engine.purchaseBuilding(BUILDING_IDS.SHOP);
      expect(result).toBe(true);
    });

    it('购买商铺应扣除财富', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBeLessThan(100);
    });

    it('资源不足时购买应失败', () => {
      const result = engine.purchaseBuilding(BUILDING_IDS.SHOP);
      expect(result).toBe(false);
    });

    it('购买后建筑等级应为 1', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      expect(engine.getBuildingLevel(BUILDING_IDS.SHOP)).toBe(1);
    });

    it('buyBuildingByIndex 应正常工作', () => {
      addWealth(engine, 100);
      const result = engine.buyBuildingByIndex(0);
      expect(result).toBe(true);
    });

    it('buyBuildingByIndex 越界应返回 false', () => {
      expect(engine.buyBuildingByIndex(-1)).toBe(false);
      expect(engine.buyBuildingByIndex(999)).toBe(false);
    });

    it('购买建筑应增加 totalBuildingsBuilt', () => {
      addWealth(engine, 1000);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      expect(engine.stats.totalBuildingsBuilt).toBe(1);
    });

    it('购买商铺后应增加财富每秒产出', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      const perSec = getResourcePerSecond(engine, RESOURCE_IDS.WEALTH);
      expect(perSec).toBeGreaterThan(0);
    });

    it('建筑费用应随等级递增', () => {
      addWealth(engine, 10000);
      const cost1 = engine.getBuildingCost(BUILDING_IDS.SHOP);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      const cost2 = engine.getBuildingCost(BUILDING_IDS.SHOP);
      const cost1Val = cost1[RESOURCE_IDS.WEALTH] || 0;
      const cost2Val = cost2[RESOURCE_IDS.WEALTH] || 0;
      expect(cost2Val).toBeGreaterThan(cost1Val);
    });

    it('getBuildingLevel 未购买建筑应返回 0', () => {
      expect(engine.getBuildingLevel(BUILDING_IDS.SHOP)).toBe(0);
      expect(engine.getBuildingLevel(BUILDING_IDS.ACADEMY)).toBe(0);
    });

    it('getBuildingCost 应返回正确的费用结构', () => {
      const cost = engine.getBuildingCost(BUILDING_IDS.SHOP);
      expect(cost).toHaveProperty(RESOURCE_IDS.WEALTH);
      expect(cost[RESOURCE_IDS.WEALTH]).toBeGreaterThan(0);
    });

    it('建筑达到最大等级后不应再购买', () => {
      addWealth(engine, 1e9);
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.SHOP);
      upgrade.level = upgrade.maxLevel;
      const result = engine.purchaseBuilding(BUILDING_IDS.SHOP);
      expect(result).toBe(false);
    });

    it('未解锁建筑不应可购买', () => {
      addWealth(engine, 1000);
      const result = engine.purchaseBuilding(BUILDING_IDS.ACADEMY);
      expect(result).toBe(false);
    });

    it('建筑解锁应在满足条件时自动触发', () => {
      addWealth(engine, 100);
      // 触发 update 以检查解锁
      tick(engine, 16);
      const academy = (engine as any).upgrades.get(BUILDING_IDS.ACADEMY);
      expect(academy.unlocked).toBe(true);
    });

    it('祠堂加成应提升产出倍率', () => {
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.ANCESTRAL_HALL);
      upgrade.unlocked = true;
      upgrade.level = 5;
      const mult = engine.getProductionMultiplier();
      // 基础1 + 祠堂5*0.05 = 1.25
      expect(mult).toBeCloseTo(1.25, 2);
    });

    it('宝库加成应提升产出倍率', () => {
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.TREASURY);
      upgrade.unlocked = true;
      upgrade.level = 3;
      const mult = engine.getProductionMultiplier();
      // 基础1 + 宝库3*0.08 = 1.24
      expect(mult).toBeCloseTo(1.24, 2);
    });
  });

  // ==================== 5. 家族成员（后代培养）系统 ====================

  describe('家族成员系统', () => {
    it('初始后代等级应为 0', () => {
      expect(engine.getHeirLevel(HEIR_TYPES.WARRIOR)).toBe(0);
      expect(engine.getHeirLevel(HEIR_TYPES.SCHOLAR)).toBe(0);
      expect(engine.getHeirLevel(HEIR_TYPES.MERCHANT)).toBe(0);
      expect(engine.getHeirLevel(HEIR_TYPES.DIPLOMAT)).toBe(0);
    });

    it('getHeirTrainCost 应返回正确的费用', () => {
      const cost = engine.getHeirTrainCost(HEIR_TYPES.WARRIOR);
      expect(cost).toHaveProperty(RESOURCE_IDS.WEALTH);
      expect(cost).toHaveProperty(RESOURCE_IDS.REPUTATION);
    });

    it('资源不足时培养应失败', () => {
      const result = engine.trainHeir(HEIR_TYPES.WARRIOR);
      expect(result).toBe(false);
    });

    it('资源充足时培养应成功', () => {
      addWealth(engine, 1000);
      addReputation(engine, 100);
      const result = engine.trainHeir(HEIR_TYPES.WARRIOR);
      expect(result).toBe(true);
    });

    it('培养后等级应增加', () => {
      addWealth(engine, 1000);
      addReputation(engine, 100);
      engine.trainHeir(HEIR_TYPES.WARRIOR);
      expect(engine.getHeirLevel(HEIR_TYPES.WARRIOR)).toBe(1);
    });

    it('培养应增加 totalHeirsTrained', () => {
      addWealth(engine, 1000);
      addReputation(engine, 100);
      engine.trainHeir(HEIR_TYPES.WARRIOR);
      expect(engine.stats.totalHeirsTrained).toBe(1);
    });

    it('培养费用应随等级递增', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      const cost1 = engine.getHeirTrainCost(HEIR_TYPES.WARRIOR);
      engine.trainHeir(HEIR_TYPES.WARRIOR);
      const cost2 = engine.getHeirTrainCost(HEIR_TYPES.WARRIOR);
      expect(cost2[RESOURCE_IDS.WEALTH]).toBeGreaterThan(cost1[RESOURCE_IDS.WEALTH]);
    });

    it('达到最大等级后不应再培养', () => {
      const heirDef = HEIR_TYPE_DEFS.find((h) => h.id === HEIR_TYPES.WARRIOR)!;
      (engine as any)._heirs.set(HEIR_TYPES.WARRIOR, heirDef.maxLevel);
      const result = engine.trainHeir(HEIR_TYPES.WARRIOR);
      expect(result).toBe(false);
    });

    it('无效后代类型不应培养', () => {
      addWealth(engine, 1e6);
      const result = engine.trainHeir('invalid-type');
      expect(result).toBe(false);
    });

    it('getHeirBonus 应返回正确加成', () => {
      (engine as any)._heirs.set(HEIR_TYPES.WARRIOR, 3);
      const bonus = engine.getHeirBonus(RESOURCE_IDS.WEALTH);
      // 武将 bonusPerLevel=0.5, level=3 => 1.5
      expect(bonus).toBeCloseTo(1.5, 2);
    });

    it('getHeirBonus 无匹配后代应返回 0', () => {
      const bonus = engine.getHeirBonus(RESOURCE_IDS.CONNECTION);
      expect(bonus).toBe(0);
    });

    it('后代加成应反映在有效产出中', () => {
      (engine as any)._heirs.set(HEIR_TYPES.WARRIOR, 2);
      // 武将 bonusTarget=wealth, bonusPerLevel=0.5 => 1.0
      const production = engine.getEffectiveProduction(RESOURCE_IDS.WEALTH);
      expect(production).toBeGreaterThanOrEqual(1.0);
    });
  });

  // ==================== 6. 联姻系统 ====================

  describe('联姻系统', () => {
    it('初始不应与任何家族联姻', () => {
      expect(engine.isMarried('family-zhang')).toBe(false);
      expect(engine.isMarried('family-li')).toBe(false);
    });

    it('canMarry 不满足后代要求应返回 false', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      // 张家需要文士>=1级
      expect(engine.canMarry('family-zhang')).toBe(false);
    });

    it('满足条件时 canMarry 应返回 true', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      // 解锁声望资源
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      // 满足张家要求：文士>=1级
      (engine as any)._heirs.set(HEIR_TYPES.SCHOLAR, 1);
      expect(engine.canMarry('family-zhang')).toBe(true);
    });

    it('联姻后应标记为已联姻', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      (engine as any)._heirs.set(HEIR_TYPES.SCHOLAR, 1);
      engine.marry('family-zhang');
      expect(engine.isMarried('family-zhang')).toBe(true);
    });

    it('联姻应增加 totalMarriages', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      (engine as any)._heirs.set(HEIR_TYPES.SCHOLAR, 1);
      engine.marry('family-zhang');
      expect(engine.stats.totalMarriages).toBe(1);
    });

    it('已联姻家族不应重复联姻', () => {
      addWealth(engine, 1e9);
      addReputation(engine, 1e9);
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      (engine as any)._heirs.set(HEIR_TYPES.SCHOLAR, 1);
      engine.marry('family-zhang');
      // 第二次联姻同一家族
      expect(engine.canMarry('family-zhang')).toBe(false);
    });

    it('getMarriageBonus 应返回正确加成', () => {
      (engine as any)._marriedFamilies.add('family-zhang');
      const bonus = engine.getMarriageBonus(RESOURCE_IDS.REPUTATION);
      // 张家声望加成 0.5
      expect(bonus).toBeCloseTo(0.5, 2);
    });

    it('getMarriageBonus 未联姻应返回 0', () => {
      const bonus = engine.getMarriageBonus(RESOURCE_IDS.WEALTH);
      expect(bonus).toBe(0);
    });

    it('marriedFamilyIds 应返回所有已联姻家族', () => {
      (engine as any)._marriedFamilies.add('family-zhang');
      (engine as any)._marriedFamilies.add('family-li');
      const ids = engine.marriedFamilyIds;
      expect(ids).toContain('family-zhang');
      expect(ids).toContain('family-li');
      expect(ids.length).toBe(2);
    });

    it('联姻应触发 marriageComplete 事件', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      (engine as any)._heirs.set(HEIR_TYPES.SCHOLAR, 1);
      const listener = vi.fn();
      engine.on('marriageComplete', listener);
      engine.marry('family-zhang');
      expect(listener).toHaveBeenCalledWith('family-zhang');
    });

    it('非 playing 状态联姻应失败', () => {
      (engine as any)._status = 'paused';
      const result = engine.marry('family-zhang');
      expect(result).toBe(false);
    });
  });

  // ==================== 7. 声望/重置系统 ====================

  describe('声望/重置系统', () => {
    it('财富不足时 calculatePrestigeHeritage 应返回 0', () => {
      expect(engine.calculatePrestigeHeritage()).toBe(0);
    });

    it('财富刚达阈值时 calculatePrestigeHeritage 应返回 1', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      expect(engine.calculatePrestigeHeritage()).toBe(1);
    });

    it('canPrestige 财富不足应返回 false', () => {
      expect(engine.canPrestige()).toBe(false);
    });

    it('canPrestige 财富充足应返回 true', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      expect(engine.canPrestige()).toBe(true);
    });

    it('doPrestige 财富不足应返回 false', () => {
      expect(engine.doPrestige()).toBe(false);
    });

    it('doPrestige 成功应返回 true 并增加声望货币', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH * 4); // sqrt(4) = 2
      const result = engine.doPrestige();
      expect(result).toBe(true);
      expect((engine as any).prestige.currency).toBe(2);
    });

    it('doPrestige 应增加声望次数', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      engine.doPrestige();
      expect((engine as any).prestige.count).toBe(1);
    });

    it('doPrestige 应增加 totalPrestigeCount', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      engine.doPrestige();
      expect(engine.stats.totalPrestigeCount).toBe(1);
    });

    it('doPrestige 应重置资源和建筑', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH * 10);
      engine.click();
      engine.doPrestige();
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(0);
      expect(engine.getBuildingLevel(BUILDING_IDS.SHOP)).toBe(0);
    });

    it('doPrestige 应触发 prestigeReset 事件', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      const listener = vi.fn();
      engine.on('prestigeReset', listener);
      engine.doPrestige();
      expect(listener).toHaveBeenCalled();
    });

    it('声望加成应提升产出倍率', () => {
      (engine as any).prestige.currency = 5;
      const mult = engine.getProductionMultiplier();
      // 基础1 + 声望5*0.04 = 1.2
      expect(mult).toBeCloseTo(1.2, 2);
    });

    it('声望加成应提升点击力量', () => {
      (engine as any).prestige.currency = 5;
      const power = engine.getClickPower();
      // 基础1 * (1 + 5*0.04) = 1.2
      expect(power).toBeCloseTo(1.2, 2);
    });

    it('doPrestige 应重置后代和联姻', () => {
      addWealth(engine, 1e9);
      (engine as any)._heirs.set(HEIR_TYPES.WARRIOR, 5);
      (engine as any)._marriedFamilies.add('family-zhang');
      engine.doPrestige();
      expect(engine.getHeirLevel(HEIR_TYPES.WARRIOR)).toBe(0);
      expect(engine.isMarried('family-zhang')).toBe(false);
    });
  });

  // ==================== 8. 产出计算 ====================

  describe('产出计算', () => {
    it('getProductionMultiplier 基础应为 1', () => {
      expect(engine.getProductionMultiplier()).toBe(1);
    });

    it('getEffectiveProduction 无建筑时应为 0', () => {
      expect(engine.getEffectiveProduction(RESOURCE_IDS.WEALTH)).toBe(0);
    });

    it('购买商铺后 getEffectiveProduction 应大于 0', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      const prod = engine.getEffectiveProduction(RESOURCE_IDS.WEALTH);
      expect(prod).toBeGreaterThan(0);
    });

    it('recalculateProduction 应正确计算基础产出', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      const perSec = getResourcePerSecond(engine, RESOURCE_IDS.WEALTH);
      // 商铺 baseProduction=0.5, level=1 => 0.5
      expect(perSec).toBeCloseTo(0.5, 2);
    });

    it('产出倍率应影响有效产出', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      // 设置祠堂等级
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.ANCESTRAL_HALL);
      upgrade.unlocked = true;
      upgrade.level = 2;
      const prod = engine.getEffectiveProduction(RESOURCE_IDS.WEALTH);
      // 0.5 * (1 + 2*0.05) = 0.5 * 1.1 = 0.55
      expect(prod).toBeCloseTo(0.55, 2);
    });
  });

  // ==================== 9. 存档系统 ====================

  describe('存档系统', () => {
    it('save 应返回有效的 SaveData', () => {
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.statistics).toBeDefined();
    });

    it('save 应包含自定义统计', () => {
      addWealth(engine, 100);
      engine.click();
      const data = engine.save();
      expect(data.statistics.totalClicks).toBe(1);
    });

    it('load 应恢复资源状态', () => {
      addWealth(engine, 500);
      const data = engine.save();
      // 创建新引擎并加载
      const engine2 = createEngine();
      engine2.load(data);
      expect(getResourceAmount(engine2, RESOURCE_IDS.WEALTH)).toBe(500);
    });

    it('load 应恢复后代等级', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      engine.trainHeir(HEIR_TYPES.WARRIOR);
      const data = engine.save();
      const engine2 = createEngine();
      engine2.load(data);
      expect(engine2.getHeirLevel(HEIR_TYPES.WARRIOR)).toBe(1);
    });

    it('load 应恢复联姻状态', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      (engine as any)._heirs.set(HEIR_TYPES.SCHOLAR, 1);
      engine.marry('family-zhang');
      const data = engine.save();
      const engine2 = createEngine();
      engine2.load(data);
      expect(engine2.isMarried('family-zhang')).toBe(true);
    });

    it('getState 应返回完整状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('resources');
      expect(state).toHaveProperty('upgrades');
      expect(state).toHaveProperty('prestige');
      expect(state).toHaveProperty('statistics');
      expect(state).toHaveProperty('heirs');
      expect(state).toHaveProperty('marriedFamilies');
      expect(state).toHaveProperty('selectedBuildingIndex');
    });

    it('loadState 应恢复状态', () => {
      const state: ClanSagaState = {
        resources: { wealth: { amount: 999, unlocked: true } },
        upgrades: {},
        prestige: { currency: 5, count: 2 },
        statistics: {},
        heirs: { warrior: 3 },
        marriedFamilies: ['family-li'],
        selectedBuildingIndex: 2,
      };
      engine.loadState(state);
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(999);
      expect(engine.getHeirLevel(HEIR_TYPES.WARRIOR)).toBe(3);
      expect(engine.isMarried('family-li')).toBe(true);
      expect(engine.selectedBuildingIndex).toBe(2);
    });

    it('loadState 应恢复声望', () => {
      const state: ClanSagaState = {
        resources: {},
        upgrades: {},
        prestige: { currency: 10, count: 3 },
        statistics: {},
        heirs: {},
        marriedFamilies: [],
        selectedBuildingIndex: 0,
      };
      engine.loadState(state);
      expect((engine as any).prestige.currency).toBe(10);
      expect((engine as any).prestige.count).toBe(3);
    });
  });

  // ==================== 10. 键盘输入 ====================

  describe('键盘输入', () => {
    it('空格键应触发点击', () => {
      engine.handleKeyDown(' ');
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(WEALTH_PER_CLICK);
    });

    it('P 键应触发声望重置（条件满足时）', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      engine.handleKeyDown('p');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('大写 P 键也应触发声望重置', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      engine.handleKeyDown('P');
      expect((engine as any).prestige.count).toBe(1);
    });

    it('1 键应培养武将', () => {
      addWealth(engine, 1000);
      addReputation(engine, 100);
      engine.handleKeyDown('1');
      expect(engine.getHeirLevel(HEIR_TYPES.WARRIOR)).toBe(1);
    });

    it('2 键应培养文士', () => {
      addWealth(engine, 1000);
      addConnection(engine, 100);
      engine.handleKeyDown('2');
      expect(engine.getHeirLevel(HEIR_TYPES.SCHOLAR)).toBe(1);
    });

    it('3 键应培养商人', () => {
      addWealth(engine, 1000);
      addConnection(engine, 100);
      engine.handleKeyDown('3');
      expect(engine.getHeirLevel(HEIR_TYPES.MERCHANT)).toBe(1);
    });

    it('4 键应培养外交官', () => {
      addWealth(engine, 1000);
      addReputation(engine, 100);
      engine.handleKeyDown('4');
      expect(engine.getHeirLevel(HEIR_TYPES.DIPLOMAT)).toBe(1);
    });

    it('ArrowUp 应减少选中建筑索引', () => {
      (engine as any)._selectedBuildingIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(1);
    });

    it('ArrowUp 不应低于 0', () => {
      (engine as any)._selectedBuildingIndex = 0;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('ArrowDown 应增加选中建筑索引', () => {
      // 确保至少有2个可见建筑
      addWealth(engine, 100);
      tick(engine, 16);
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedBuildingIndex).toBe(1);
    });

    it('M 键应触发联姻', () => {
      addWealth(engine, 1e6);
      addReputation(engine, 1e6);
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      (engine as any)._heirs.set(HEIR_TYPES.SCHOLAR, 1);
      engine.handleKeyDown('m');
      expect(engine.isMarried('family-zhang')).toBe(true);
    });

    it('Enter 键应购买当前选中建筑', () => {
      addWealth(engine, 100);
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(BUILDING_IDS.SHOP)).toBe(1);
    });

    it('非 playing 状态键盘输入不应生效', () => {
      (engine as any)._status = 'paused';
      engine.handleKeyDown(' ');
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(0);
    });

    it('handleKeyUp 不应抛出错误', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ==================== 11. 动画系统 ====================

  describe('动画系统', () => {
    it('update 应更新动画计时器', () => {
      const timerBefore = (engine as any)._animTimer;
      tick(engine, 16);
      const timerAfter = (engine as any)._animTimer;
      expect(timerAfter).toBeGreaterThan(timerBefore);
    });

    it('点击动画应在超时后恢复', () => {
      engine.click();
      expect((engine as any)._clickScale).toBeGreaterThan(1);
      // 快进到动画结束
      tick(engine, 300);
      expect((engine as any)._clickScale).toBe(1);
    });

    it('飘字效果应在持续时间内消失', () => {
      engine.click();
      expect((engine as any)._floatingTexts.length).toBeGreaterThan(0);
      // 快进超过 FLOATING_TEXT_DURATION
      tick(engine, FLOATING_TEXT_DURATION + 100);
      expect((engine as any)._floatingTexts.length).toBe(0);
    });

    it('转生光效应在超时后消失', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH);
      engine.doPrestige();
      expect((engine as any)._prestigeTimer).toBeGreaterThan(0);
      tick(engine, 2000);
      expect((engine as any)._prestigeTimer).toBe(0);
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
      addWealth(engine, 1000);
      addReputation(engine, 100);
      // 解锁声望
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      reputation.unlocked = true;
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });

    it('onRender 有建筑和后代时不应抛出错误', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      (engine as any)._heirs.set(HEIR_TYPES.WARRIOR, 2);
      (engine as any)._marriedFamilies.add('family-zhang');
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==================== 13. 资源解锁 ====================

  describe('资源解锁', () => {
    it('书院解锁后声望资源应自动解锁', () => {
      const academy = (engine as any).upgrades.get(BUILDING_IDS.ACADEMY);
      academy.unlocked = true;
      tick(engine, 16);
      const reputation = (engine as any).getResource(RESOURCE_IDS.REPUTATION);
      expect(reputation.unlocked).toBe(true);
    });

    it('茶馆解锁后人脉资源应自动解锁', () => {
      const teaHouse = (engine as any).upgrades.get(BUILDING_IDS.TEA_HOUSE);
      teaHouse.unlocked = true;
      tick(engine, 16);
      const connection = (engine as any).getResource(RESOURCE_IDS.CONNECTION);
      expect(connection.unlocked).toBe(true);
    });

    it('建筑解锁应触发 buildingUnlocked 事件', () => {
      const listener = vi.fn();
      engine.on('buildingUnlocked', listener);
      addWealth(engine, 100);
      tick(engine, 16);
      expect(listener).toHaveBeenCalled();
    });
  });

  // ==================== 14. 边界与综合测试 ====================

  describe('边界与综合测试', () => {
    it('getHeirTrainCost 无效类型应返回空对象', () => {
      const cost = engine.getHeirTrainCost('nonexistent');
      expect(cost).toEqual({});
    });

    it('getBuildingLevel 无效建筑应返回 0', () => {
      expect(engine.getBuildingLevel('nonexistent')).toBe(0);
    });

    it('getBuildingCost 无效建筑应返回空对象', () => {
      const cost = engine.getBuildingCost('nonexistent');
      expect(cost).toEqual({});
    });

    it('canMarry 无效家族应返回 false', () => {
      expect(engine.canMarry('nonexistent')).toBe(false);
    });

    it('marry 无效家族应返回 false', () => {
      expect(engine.marry('nonexistent')).toBe(false);
    });

    it('多次点击和购买建筑的综合测试', () => {
      // 快速点击积累财富
      for (let i = 0; i < 50; i++) {
        engine.click();
      }
      expect(getResourceAmount(engine, RESOURCE_IDS.WEALTH)).toBe(50);

      // 购买多个商铺
      for (let i = 0; i < 5; i++) {
        engine.purchaseBuilding(BUILDING_IDS.SHOP);
      }
      expect(engine.getBuildingLevel(BUILDING_IDS.SHOP)).toBeGreaterThan(0);
    });

    it('stats getter 应返回副本', () => {
      const stats1 = engine.stats;
      const stats2 = engine.stats;
      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2);
    });

    it('联姻加成应叠加', () => {
      (engine as any)._marriedFamilies.add('family-zhang');
      (engine as any)._marriedFamilies.add('family-li');
      // 张家声望+0.5, 李家无声望加成
      const bonus = engine.getMarriageBonus(RESOURCE_IDS.REPUTATION);
      expect(bonus).toBeCloseTo(0.5, 2);
      // 李家财富+1.0, 张家无财富加成
      const wealthBonus = engine.getMarriageBonus(RESOURCE_IDS.WEALTH);
      expect(wealthBonus).toBeCloseTo(1.0, 2);
    });

    it('calculatePrestigeHeritage 大额财富应正确计算', () => {
      addWealth(engine, MIN_PRESTIGE_WEALTH * 100); // sqrt(100) = 10
      expect(engine.calculatePrestigeHeritage()).toBe(10);
    });

    it('trackProduction 应在 update 中追踪产出', () => {
      addWealth(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SHOP);
      const before = engine.totalWealthEarned;
      tick(engine, 1000);
      const after = engine.totalWealthEarned;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });
});
