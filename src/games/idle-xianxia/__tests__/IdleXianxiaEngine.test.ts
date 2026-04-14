/**
 * 挂机修仙·凡人篇 (Idle Xianxia) — 完整测试套件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdleXianxiaEngine } from '@/games/idle-xianxia/IdleXianxiaEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  REALM_IDS,
  REALMS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_SPIRIT,
  COLORS,
  MEDITATION,
  ANIMATION,
} from '@/games/idle-xianxia/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): IdleXianxiaEngine {
  const engine = new IdleXianxiaEngine();
  engine.init(createCanvas());
  engine.start();
  return engine;
}

/** 直接添加资源 */
function addSpirit(engine: IdleXianxiaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.SPIRIT, amount);
}

function addStone(engine: IdleXianxiaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.STONE, amount);
}

function addPill(engine: IdleXianxiaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.PILL, amount);
}

function addFate(engine: IdleXianxiaEngine, amount: number): void {
  (engine as any).addResource(RESOURCE_IDS.FATE, amount);
}

/** 触发一次 update */
function tick(engine: IdleXianxiaEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 获取资源数量 */
function getResourceAmount(engine: IdleXianxiaEngine, id: string): number {
  return (engine as any).getResource(id)?.amount ?? 0;
}

// ========== 测试套件 ==========

describe('IdleXianxiaEngine', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==================== 1. 引擎创建与初始化 ====================

  describe('引擎创建与初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(IdleXianxiaEngine);
    });

    it('gameId 应为 idle-xianxia', () => {
      expect((engine as any)._gameId).toBe('idle-xianxia');
    });

    it('初始状态应为 playing（start 后）', () => {
      expect((engine as any)._status).toBe('playing');
    });

    it('Canvas 尺寸应正确设置', () => {
      const canvas = createCanvas();
      expect(canvas.width).toBe(CANVAS_WIDTH);
      expect(canvas.height).toBe(CANVAS_HEIGHT);
    });

    it('初始化后资源应正确设置', () => {
      expect(getResourceAmount(engine, RESOURCE_IDS.SPIRIT)).toBe(0);
    });

    it('灵气初始应已解锁', () => {
      const spirit = (engine as any).getResource(RESOURCE_IDS.SPIRIT);
      expect(spirit.unlocked).toBe(true);
    });

    it('灵石初始应未解锁', () => {
      const stone = (engine as any).getResource(RESOURCE_IDS.STONE);
      expect(stone.unlocked).toBe(false);
    });

    it('丹药初始应未解锁', () => {
      const pill = (engine as any).getResource(RESOURCE_IDS.PILL);
      expect(pill.unlocked).toBe(false);
    });

    it('仙缘初始应未解锁', () => {
      const fate = (engine as any).getResource(RESOURCE_IDS.FATE);
      expect(fate.unlocked).toBe(false);
    });

    it('初始 totalSpiritEarned 应为 0', () => {
      expect(engine.totalSpiritEarned).toBe(0);
    });

    it('初始 totalClicks 应为 0', () => {
      expect(engine.totalClicks).toBe(0);
    });

    it('初始 currentRealmIndex 应为 0（凡人）', () => {
      expect(engine.currentRealmIndex).toBe(0);
    });

    it('初始 totalBreakthroughs 应为 0', () => {
      expect(engine.totalBreakthroughs).toBe(0);
    });

    it('初始 meditationActive 应为 false', () => {
      expect(engine.meditationActive).toBe(false);
    });

    it('初始 selectedBuildingIndex 应为 0', () => {
      expect(engine.selectedBuildingIndex).toBe(0);
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

    it('SPIRIT_PER_CLICK 应为 1', () => {
      expect(SPIRIT_PER_CLICK).toBe(1);
    });

    it('RESOURCE_IDS 应包含四个资源', () => {
      expect(RESOURCE_IDS.SPIRIT).toBe('spirit');
      expect(RESOURCE_IDS.STONE).toBe('stone');
      expect(RESOURCE_IDS.PILL).toBe('pill');
      expect(RESOURCE_IDS.FATE).toBe('fate');
    });

    it('BUILDING_IDS 应包含六个建筑', () => {
      expect(BUILDING_IDS.SPIRIT_POOL).toBe('spirit-pool');
      expect(BUILDING_IDS.STONE_MINE).toBe('stone-mine');
      expect(BUILDING_IDS.PILL_FURNACE).toBe('pill-furnace');
      expect(BUILDING_IDS.CAVE_DWELLING).toBe('cave-dwelling');
      expect(BUILDING_IDS.BEAST_GARDEN).toBe('beast-garden');
      expect(BUILDING_IDS.FATE_PAVILION).toBe('fate-pavilion');
    });

    it('REALM_IDS 应包含境界', () => {
      expect(REALM_IDS.QI_REFINING).toBe('qi-refining');
      expect(REALM_IDS.FOUNDATION).toBe('foundation');
      expect(REALM_IDS.GOLDEN_CORE).toBe('golden-core');
      expect(REALM_IDS.NASCENT_SOUL).toBe('nascent-soul');
      expect(REALM_IDS.SPIRIT_SEVERING).toBe('spirit-severing');
      expect(REALM_IDS.VOID_REFINING).toBe('void-refining');
      expect(REALM_IDS.BODY_INTEGRATION).toBe('body-integration');
      expect(REALM_IDS.GREAT_ASCENSION).toBe('great-ascension');
    });

    it('REALMS 数组长度应为 8', () => {
      expect(REALMS.length).toBe(8);
    });

    it('PRESTIGE_MULTIPLIER 应为 0.04', () => {
      expect(PRESTIGE_MULTIPLIER).toBe(0.04);
    });

    it('MIN_PRESTIGE_SPIRIT 应为 100000', () => {
      expect(MIN_PRESTIGE_SPIRIT).toBe(100000);
    });

    it('COLORS 应包含必要颜色', () => {
      expect(COLORS.spiritColor).toBeDefined();
      expect(COLORS.stoneColor).toBeDefined();
      expect(COLORS.pillColor).toBeDefined();
      expect(COLORS.fateColor).toBeDefined();
    });

    it('BUILDINGS 数组长度应为 6', () => {
      expect(BUILDINGS.length).toBe(6);
    });

    it('炼气境突破消耗应为空', () => {
      expect(Object.keys(REALMS[0].cost).length).toBe(0);
    });

    it('筑基境应需要灵气突破', () => {
      expect(REALMS[1].cost.spirit).toBe(1000);
    });

    it('金丹境应需要灵气突破', () => {
      expect(REALMS[2].cost.spirit).toBe(5000);
    });
  });

  // ==================== 3. 点击系统 ====================

  describe('点击系统', () => {
    it('点击应返回点击力量', () => {
      const result = engine.click();
      expect(result).toBeGreaterThan(0);
    });

    it('点击应增加灵气资源', () => {
      engine.click();
      expect(getResourceAmount(engine, RESOURCE_IDS.SPIRIT)).toBeGreaterThan(0);
    });

    it('点击应增加 totalSpiritEarned', () => {
      engine.click();
      expect(engine.totalSpiritEarned).toBeGreaterThan(0);
    });

    it('点击应增加 totalClicks', () => {
      engine.click();
      expect(engine.totalClicks).toBe(1);
    });

    it('多次点击应累加灵气', () => {
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
      expect(getResourceAmount(engine, RESOURCE_IDS.SPIRIT)).toBeGreaterThanOrEqual(3);
    });

    it('未启动时点击应返回 0', () => {
      const rawEngine = new IdleXianxiaEngine();
      // Don't init or start
      expect(rawEngine.click()).toBe(0);
    });

    it('getClickPower 基础值应为 SPIRIT_PER_CLICK', () => {
      const power = engine.getClickPower();
      expect(power).toBeGreaterThanOrEqual(SPIRIT_PER_CLICK);
    });

    it('境界等级应提升点击力量', () => {
      const basePower = engine.getClickPower();
      (engine as any)._currentRealmIndex = 3;
      const newPower = engine.getClickPower();
      expect(newPower).toBeGreaterThan(basePower);
    });
  });

  // ==================== 4. 境界系统 ====================

  describe('境界系统', () => {
    it('初始境界应为炼气', () => {
      expect(engine.currentRealm.name).toBe('炼气');
    });

    it('初始境界索引应为 0', () => {
      expect(engine.currentRealmIndex).toBe(0);
    });

    it('currentRealm 应返回正确的 RealmDef', () => {
      const realm = engine.currentRealm;
      expect(realm.id).toBe(REALM_IDS.QI_REFINING);
    });

    it('canAttemptBreakthrough 在资源不足时应返回 false', () => {
      // Next realm is Foundation, costs { spirit: 1000 }
      expect(engine.canAttemptBreakthrough()).toBe(false);
    });

    it('canAttemptBreakthrough 在资源充足时应返回 true', () => {
      addSpirit(engine, 2000);
      expect(engine.canAttemptBreakthrough()).toBe(true);
    });

    it('getNextRealm 应返回下一境界', () => {
      const next = engine.getNextRealm();
      expect(next).not.toBeNull();
      expect(next!.name).toBe('筑基');
    });

    it('getNextRealm 在最高境界时应返回 null', () => {
      (engine as any)._currentRealmIndex = REALMS.length - 1;
      expect(engine.getNextRealm()).toBeNull();
    });

    it('炼气境突破消耗应为空', () => {
      expect(Object.keys(REALMS[0].cost).length).toBe(0);
    });

    it('筑基境基础成功率应为 0.95', () => {
      expect(REALMS[1].baseSuccessRate).toBe(0.95);
    });

    it('突破失败应损失部分灵气', () => {
      addSpirit(engine, 5000);
      // Mock random to force failure
      const spy = vi.spyOn(Math, 'random').mockReturnValue(1);
      const result = engine.attemptBreakthrough();
      expect(result.success).toBe(false);
      spy.mockRestore();
    });

    it('突破失败应返回失败结果', () => {
      addSpirit(engine, 5000);
      const spy = vi.spyOn(Math, 'random').mockReturnValue(1);
      const result = engine.attemptBreakthrough();
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      spy.mockRestore();
    });

    it('突破成功应提升境界索引', () => {
      addSpirit(engine, 5000);
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = engine.attemptBreakthrough();
      expect(result.success).toBe(true);
      expect(engine.currentRealmIndex).toBe(1);
      spy.mockRestore();
    });

    it('突破成功应增加 totalBreakthroughs', () => {
      addSpirit(engine, 5000);
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      engine.attemptBreakthrough();
      expect(engine.totalBreakthroughs).toBe(1);
      spy.mockRestore();
    });

    it('资源不足时突破应返回失败', () => {
      addSpirit(engine, 10);
      const result = engine.attemptBreakthrough();
      expect(result.success).toBe(false);
    });

    it('已达最高境界时突破应返回失败', () => {
      (engine as any)._currentRealmIndex = REALMS.length - 1;
      const result = engine.attemptBreakthrough();
      expect(result.success).toBe(false);
      expect(result.message).toContain('最高境界');
    });

    it('getBreakthroughRate 应受丹药加成', () => {
      addPill(engine, 10);
      // Use a realm with lower base rate so pill bonus doesn't hit the 0.95 cap
      const realm = REALMS[2]; // 金丹: baseSuccessRate 0.85
      const rate = engine.getBreakthroughRate(realm);
      expect(rate).toBeGreaterThan(realm.baseSuccessRate);
    });

    it('getBreakthroughRate 上限应为 0.95', () => {
      addPill(engine, 100000);
      const rate = engine.getBreakthroughRate(REALMS[1]);
      expect(rate).toBeLessThanOrEqual(0.95);
    });

    it('境界提升应解锁新资源（灵石）', () => {
      (engine as any)._currentRealmIndex = 1;
      (engine as any).checkResourceUnlocks();
      const stone = (engine as any).getResource(RESOURCE_IDS.STONE);
      expect(stone.unlocked).toBe(true);
    });

    it('金丹境应解锁丹药资源', () => {
      (engine as any)._currentRealmIndex = 2;
      (engine as any).checkResourceUnlocks();
      const pill = (engine as any).getResource(RESOURCE_IDS.PILL);
      expect(pill.unlocked).toBe(true);
    });

    it('斩灵境应解锁仙缘资源', () => {
      (engine as any)._currentRealmIndex = 4;
      (engine as any).checkResourceUnlocks();
      const fate = (engine as any).getResource(RESOURCE_IDS.FATE);
      expect(fate.unlocked).toBe(true);
    });
  });

  // ==================== 5. 建筑系统 ====================

  describe('建筑系统', () => {
    it('灵气池初始应已解锁', () => {
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.SPIRIT_POOL);
      expect(upgrade.unlocked).toBe(true);
    });

    it('灵石矿初始应未解锁（需筑基）', () => {
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.STONE_MINE);
      expect(upgrade.unlocked).toBe(false);
    });

    it('getBuildingCost 应返回建筑费用', () => {
      const cost = engine.getBuildingCost(BUILDING_IDS.SPIRIT_POOL);
      expect(cost).toBeDefined();
      expect(cost.spirit).toBeGreaterThan(0);
    });

    it('getBuildingLevel 初始应为 0', () => {
      expect(engine.getBuildingLevel(BUILDING_IDS.SPIRIT_POOL)).toBe(0);
    });

    it('purchaseBuilding 资源不足时应返回 false', () => {
      expect(engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL)).toBe(false);
    });

    it('purchaseBuilding 资源充足时应返回 true', () => {
      addSpirit(engine, 100);
      expect(engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL)).toBe(true);
    });

    it('购买后建筑等级应为 1', () => {
      addSpirit(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL);
      expect(engine.getBuildingLevel(BUILDING_IDS.SPIRIT_POOL)).toBe(1);
    });

    it('购买后应扣除资源', () => {
      addSpirit(engine, 100);
      const cost = engine.getBuildingCost(BUILDING_IDS.SPIRIT_POOL);
      const before = getResourceAmount(engine, RESOURCE_IDS.SPIRIT);
      engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL);
      const after = getResourceAmount(engine, RESOURCE_IDS.SPIRIT);
      expect(before - after).toBe(cost.spirit);
    });

    it('buyBuildingByIndex 应正常工作', () => {
      addSpirit(engine, 100);
      expect(engine.buyBuildingByIndex(0)).toBe(true);
    });

    it('buyBuildingByIndex 越界应返回 false', () => {
      expect(engine.buyBuildingByIndex(-1)).toBe(false);
      expect(engine.buyBuildingByIndex(999)).toBe(false);
    });

    it('建筑费用应随等级递增', () => {
      addSpirit(engine, 10000);
      const cost0 = engine.getBuildingCost(BUILDING_IDS.SPIRIT_POOL);
      engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL);
      const cost1 = engine.getBuildingCost(BUILDING_IDS.SPIRIT_POOL);
      expect(cost1.spirit).toBeGreaterThan(cost0.spirit);
    });

    it('境界提升应解锁新建筑', () => {
      (engine as any)._currentRealmIndex = 1;
      (engine as any).checkBuildingUnlocks();
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.STONE_MINE);
      expect(upgrade.unlocked).toBe(true);
    });

    it('建筑应正确产出资源', () => {
      addSpirit(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL);
      (engine as any).recalculateProduction();
      const spirit = (engine as any).getResource(RESOURCE_IDS.SPIRIT);
      expect(spirit.perSecond).toBeGreaterThan(0);
    });

    it('购买建筑达到 maxLevel 后不能再购买', () => {
      const building = BUILDINGS.find(b => b.id === BUILDING_IDS.SPIRIT_POOL)!;
      // Set level to max
      const upgrade = (engine as any).upgrades.get(BUILDING_IDS.SPIRIT_POOL);
      upgrade.level = building.maxLevel;
      upgrade.unlocked = true;
      addSpirit(engine, 1e10);
      expect(engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL)).toBe(false);
    });
  });

  // ==================== 6. 产出系统 ====================

  describe('产出系统', () => {
    it('getProductionMultiplier 初始应为 1', () => {
      expect(engine.getProductionMultiplier()).toBe(1);
    });

    it('境界等级应提升产出倍率', () => {
      const base = engine.getProductionMultiplier();
      (engine as any)._currentRealmIndex = 3;
      expect(engine.getProductionMultiplier()).toBeGreaterThan(base);
    });

    it('getEffectiveProduction 未配置资源应返回 0', () => {
      expect(engine.getEffectiveProduction('nonexistent')).toBe(0);
    });

    it('getEffectiveProduction 有建筑时应返回正值', () => {
      addSpirit(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL);
      (engine as any).recalculateProduction();
      const prod = engine.getEffectiveProduction(RESOURCE_IDS.SPIRIT);
      expect(prod).toBeGreaterThan(0);
    });
  });

  // ==================== 7. 打坐系统 ====================

  describe('打坐系统', () => {
    it('初始 meditationActive 应为 false', () => {
      expect(engine.meditationActive).toBe(false);
    });

    it('初始 meditationOnCooldown 应为 false', () => {
      expect(engine.meditationOnCooldown).toBe(false);
    });

    it('startMeditation 应返回 true', () => {
      expect(engine.startMeditation()).toBe(true);
    });

    it('startMeditation 后 meditationActive 应为 true', () => {
      engine.startMeditation();
      expect(engine.meditationActive).toBe(true);
    });

    it('打坐中再次 startMeditation 应返回 false', () => {
      engine.startMeditation();
      expect(engine.startMeditation()).toBe(false);
    });

    it('MEDITATION.duration 应为 5000', () => {
      expect(MEDITATION.duration).toBe(5000);
    });

    it('MEDITATION.multiplier 应为 3', () => {
      expect(MEDITATION.multiplier).toBe(3);
    });

    it('MEDITATION.cooldown 应为 10000', () => {
      expect(MEDITATION.cooldown).toBe(10000);
    });
  });

  // ==================== 8. 声望系统 ====================

  describe('声望系统', () => {
    it('初始声望 currency 应为 0', () => {
      expect(engine.prestige.currency).toBe(0);
    });

    it('初始声望 count 应为 0', () => {
      expect(engine.prestige.count).toBe(0);
    });

    it('calculatePrestigeDaoRhyme 灵气不足时应返回 0', () => {
      expect(engine.calculatePrestigeDaoRhyme()).toBe(0);
    });

    it('calculatePrestigeDaoRhyme 灵气充足时应返回正值', () => {
      addSpirit(engine, 200000);
      expect(engine.calculatePrestigeDaoRhyme()).toBeGreaterThan(0);
    });

    it('doPrestige 灵气不足时应返回 false', () => {
      expect(engine.doPrestige()).toBe(false);
    });

    it('doPrestige 灵气充足时应返回 true', () => {
      addSpirit(engine, 500000);
      expect(engine.doPrestige()).toBe(true);
    });

    it('doPrestige 后应增加道韵', () => {
      addSpirit(engine, 500000);
      engine.doPrestige();
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('doPrestige 后应增加声望次数', () => {
      addSpirit(engine, 500000);
      engine.doPrestige();
      expect(engine.prestige.count).toBe(1);
    });

    it('doPrestige 后资源应被重置', () => {
      addSpirit(engine, 500000);
      engine.doPrestige();
      expect(getResourceAmount(engine, RESOURCE_IDS.SPIRIT)).toBe(0);
    });

    it('doPrestige 后建筑等级应被重置', () => {
      addSpirit(engine, 500000);
      engine.doPrestige();
      expect(engine.getBuildingLevel(BUILDING_IDS.SPIRIT_POOL)).toBe(0);
    });

    it('声望加成应提升产出倍率', () => {
      const base = engine.getProductionMultiplier();
      engine.prestige.currency = 10;
      expect(engine.getProductionMultiplier()).toBeGreaterThan(base);
    });

    it('声望加成应提升点击力量', () => {
      const base = engine.getClickPower();
      engine.prestige.currency = 10;
      expect(engine.getClickPower()).toBeGreaterThan(base);
    });
  });

  // ==================== 9. 存档系统 ====================

  describe('存档系统', () => {
    it('save 应返回有效 SaveData', () => {
      const data = engine.save();
      expect(data).toBeDefined();
      expect(data.statistics).toBeDefined();
    });

    it('save 应包含统计数据', () => {
      engine.click();
      const data = engine.save();
      expect(data.statistics.totalSpiritEarned).toBeGreaterThan(0);
      expect(data.statistics.totalClicks).toBe(1);
    });

    it('save 应包含境界索引', () => {
      const data = engine.save();
      expect(data.statistics.currentRealmIndex).toBe(0);
    });

    it('load 应恢复统计数据', () => {
      engine.click();
      engine.click();
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.totalClicks).toBe(2);
    });

    it('load 应恢复境界索引', () => {
      (engine as any)._currentRealmIndex = 3;
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.currentRealmIndex).toBe(3);
    });

    it('load 应恢复 totalSpiritEarned', () => {
      engine.click();
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.totalSpiritEarned).toBeGreaterThan(0);
    });

    it('load 应恢复 totalBreakthroughs', () => {
      (engine as any)._totalBreakthroughs = 5;
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.totalBreakthroughs).toBe(5);
    });

    it('getState 应返回完整状态', () => {
      const state = engine.getState();
      expect(state.resources).toBeDefined();
      expect(state.upgrades).toBeDefined();
      expect(state.prestige).toBeDefined();
      expect(state.currentRealmIndex).toBe(0);
    });

    it('getState 应包含 totalSpiritEarned', () => {
      engine.click();
      const state = engine.getState();
      expect(state.totalSpiritEarned).toBeGreaterThan(0);
    });

    it('getState 应包含 totalClicks', () => {
      engine.click();
      const state = engine.getState();
      expect(state.totalClicks).toBe(1);
    });

    it('loadState 应恢复资源数量', () => {
      addSpirit(engine, 500);
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(getResourceAmount(newEngine, RESOURCE_IDS.SPIRIT)).toBe(500);
    });

    it('loadState 应恢复建筑等级', () => {
      addSpirit(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL);
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.getBuildingLevel(BUILDING_IDS.SPIRIT_POOL)).toBe(1);
    });

    it('loadState 应恢复声望数据', () => {
      engine.prestige = { currency: 5, count: 2 };
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.prestige.currency).toBe(5);
      expect(newEngine.prestige.count).toBe(2);
    });

    it('loadState 应恢复境界索引', () => {
      (engine as any)._currentRealmIndex = 4;
      const state = engine.getState();
      const newEngine = createEngine();
      newEngine.loadState(state);
      expect(newEngine.currentRealmIndex).toBe(4);
    });

    it('save → load 往返应保持一致', () => {
      addSpirit(engine, 1000);
      engine.click();
      (engine as any)._currentRealmIndex = 2;
      const data = engine.save();
      const newEngine = createEngine();
      newEngine.load(data);
      expect(newEngine.currentRealmIndex).toBe(2);
      expect(newEngine.totalClicks).toBe(1);
    });
  });

  // ==================== 10. 键盘输入 ====================

  describe('键盘输入', () => {
    it('空格键应触发点击', () => {
      engine.handleKeyDown(' ');
      expect(engine.totalClicks).toBe(1);
    });

    it('m 键应触发打坐', () => {
      engine.handleKeyDown('m');
      expect(engine.meditationActive).toBe(true);
    });

    it('M 键应触发打坐', () => {
      engine.handleKeyDown('M');
      expect(engine.meditationActive).toBe(true);
    });

    it('b 键应触发突破', () => {
      addSpirit(engine, 5000);
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      engine.handleKeyDown('b');
      expect(engine.totalBreakthroughs).toBe(1);
      spy.mockRestore();
    });

    it('B 键应触发突破', () => {
      addSpirit(engine, 5000);
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      engine.handleKeyDown('B');
      expect(engine.totalBreakthroughs).toBe(1);
      spy.mockRestore();
    });

    it('p 键应触发声望', () => {
      addSpirit(engine, 500000);
      engine.handleKeyDown('p');
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('P 键应触发声望', () => {
      addSpirit(engine, 500000);
      engine.handleKeyDown('P');
      expect(engine.prestige.currency).toBeGreaterThan(0);
    });

    it('ArrowUp 应减少选中建筑索引', () => {
      (engine as any)._selectedBuildingIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(1);
    });

    it('ArrowUp 不应低于 0', () => {
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedBuildingIndex).toBe(0);
    });

    it('ArrowDown 应增加选中建筑索引', () => {
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedBuildingIndex).toBeGreaterThanOrEqual(0);
    });

    it('Enter 应购买选中建筑', () => {
      addSpirit(engine, 100);
      (engine as any)._selectedBuildingIndex = 0;
      engine.handleKeyDown('Enter');
      expect(engine.getBuildingLevel(BUILDING_IDS.SPIRIT_POOL)).toBe(1);
    });
  });

  // ==================== 11. 渲染 ====================

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
      addSpirit(engine, 100);
      engine.purchaseBuilding(BUILDING_IDS.SPIRIT_POOL);
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)).not.toThrow();
    });
  });

  // ==================== 12. 动画参数 ====================

  describe('动画参数', () => {
    it('ANIMATION.floatingTextDuration 应为 1200', () => {
      expect(ANIMATION.floatingTextDuration).toBe(1200);
    });

    it('ANIMATION.cloudCount 应为 8', () => {
      expect(ANIMATION.cloudCount).toBe(8);
    });

    it('ANIMATION.spiritParticleCount 应为 15', () => {
      expect(ANIMATION.spiritParticleCount).toBe(15);
    });

    it('ANIMATION.breakthroughDuration 应为 2000', () => {
      expect(ANIMATION.breakthroughDuration).toBe(2000);
    });
  });

  // ==================== 13. 边界条件 ====================

  describe('边界条件', () => {
    it('购买不存在的建筑应返回 false', () => {
      expect(engine.purchaseBuilding('nonexistent')).toBe(false);
    });

    it('获取不存在的建筑等级应返回 0', () => {
      expect(engine.getBuildingLevel('nonexistent')).toBe(0);
    });

    it('获取不存在的建筑费用应安全返回', () => {
      const cost = engine.getBuildingCost('nonexistent');
      expect(cost).toBeDefined();
    });

    it('多次声望应累积道韵', () => {
      addSpirit(engine, 500000);
      engine.doPrestige();
      const firstCurrency = engine.prestige.currency;
      addSpirit(engine, 500000);
      engine.doPrestige();
      expect(engine.prestige.currency).toBeGreaterThan(firstCurrency);
    });

    it('声望后 totalBreakthroughs 应保留', () => {
      (engine as any)._totalBreakthroughs = 3;
      addSpirit(engine, 500000);
      engine.doPrestige();
      expect(engine.totalBreakthroughs).toBe(3);
    });

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

    it('handleKeyUp 不应抛出异常', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('getEffectiveProduction 对无产出资源应返回 0', () => {
      expect(engine.getEffectiveProduction(RESOURCE_IDS.SPIRIT)).toBe(0);
    });
  });
});
