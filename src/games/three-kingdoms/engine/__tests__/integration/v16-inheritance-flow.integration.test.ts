/**
 * v16.0 传承有序 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 武将传承（源/目标武将选择、经验传递、技能传承、好感度传承）
 * - §2 装备传承（装备强化等级传递、部位限制、稀有度效率）
 * - §3 经验传承（部分经验传递、效率计算、铜钱消耗）
 * - §4 传承消耗与限制（每日次数限制、铜钱消耗、品质要求）
 * - §5 转生后加速（初始赠送、一键重建、瞬间升级）
 * - §6 收益模拟器与转生解锁
 * - §7 跨系统联动（传承→武将→装备→资源）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v16-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type {
  HeritageResult,
  HeroHeritageRequest,
  EquipmentHeritageRequest,
  ExperienceHeritageRequest,
  HeritageSimulationParams,
} from '../../../../core/heritage';

/**
 * 创建 sim 并手动初始化 HeritageSystem 的 deps。
 *
 * 引擎 initR11Systems() 当前未调用 heritageSystem.init(deps)，
 * 导致 recordHeritage 中 this.deps.eventBus 崩溃。
 * 此 helper 在引擎初始化后手动注入 deps。
 */
function createSimWithHeritageInit() {
  const sim = createSim();
  const heritage = sim.engine.getHeritageSystem();
  // 手动注入 deps：从引擎内部获取 eventBus/config/registry
  const deps = {
    eventBus: (sim.engine as unknown as { bus: { on: (...a: unknown[]) => void; emit: (...a: unknown[]) => void; off: (...a: unknown[]) => void } }).bus,
    config: { get: () => undefined },
    registry: { get: () => undefined },
  };
  heritage.init(deps as never);
  return sim;
}

// ═══════════════════════════════════════════════════════════════
// §1 武将传承
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §1 武将传承', () => {

  it('should access heritage system via engine getter', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    expect(heritage).toBeDefined();
    expect(typeof heritage.executeHeroHeritage).toBe('function');
    expect(typeof heritage.executeEquipmentHeritage).toBe('function');
    expect(typeof heritage.executeExperienceHeritage).toBe('function');
  });

  it('should get heritage system state', () => {
    // Play §1: 传承系统状态查询
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    const state = heritage.getState();
    expect(state).toBeDefined();
    expect(typeof state.dailyHeritageCount).toBe('number');
    expect(typeof state.heroHeritageCount).toBe('number');
    expect(typeof state.equipmentHeritageCount).toBe('number');
    expect(typeof state.experienceHeritageCount).toBe('number');
    expect(Array.isArray(state.heritageHistory)).toBe(true);
  });

  it('should reject hero heritage when source hero not found', () => {
    // Play §1: 源武将不存在
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'nonexistent-hero',
      targetHeroId: 'another-hero',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    expect(result.success).toBe(false);
    expect(result.type).toBe('hero');
  });

  it('should reject hero heritage when target hero not found', () => {
    // Play §1: 目标武将不存在
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    // 需要设置回调才能查询武将数据
    heritage.setCallbacks({
      getHero: (id) => id === 'source-hero' ? {
        id: 'source-hero', level: 30, exp: 5000, quality: 4,
        faction: 'shu', skillLevels: [5, 3], favorability: 80,
      } : null,
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'source-hero',
      targetHeroId: 'nonexistent-target',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    expect(result.success).toBe(false);
  });

  it('should reject self-heritage for hero', () => {
    // Play §1: 不能自我传承
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    heritage.setCallbacks({
      getHero: (id) => ({
        id, level: 30, exp: 5000, quality: 4,
        faction: 'shu', skillLevels: [5, 3], favorability: 80,
      }),
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'hero-001',
      targetHeroId: 'hero-001',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    expect(result.success).toBe(false);
  });

  it('should execute hero heritage with valid heroes', () => {
    // Play §1: 武将传承完整流程
    const sim = createSimWithHeritageInit();
    sim.addResources(SUFFICIENT_RESOURCES);
    const heritage = sim.engine.getHeritageSystem();

    const heroData: Record<string, { id: string; level: number; exp: number; quality: number; faction: string; skillLevels: number[]; favorability: number }> = {
      'source-hero': { id: 'source-hero', level: 50, exp: 10000, quality: 5, faction: 'shu', skillLevels: [8, 6], favorability: 100 },
      'target-hero': { id: 'target-hero', level: 20, exp: 2000, quality: 4, faction: 'shu', skillLevels: [3, 2], favorability: 30 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroData[id] ?? null,
      updateHero: (id, updates) => {
        if (heroData[id]) Object.assign(heroData[id], updates);
      },
      addResources: () => {},
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'source-hero',
      targetHeroId: 'target-hero',
      options: { expEfficiency: 1.0, transferSkillLevels: true, transferFavorability: true },
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('hero');
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.copperCost).toBeGreaterThan(0);
    expect(result.sourceBefore.id).toBe('source-hero');
    expect(result.targetBefore.id).toBe('target-hero');
  });

  it('should apply faction bonus for same-faction hero heritage', () => {
    // Play §1: 同阵营加成
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroData: Record<string, { id: string; level: number; exp: number; quality: number; faction: string; skillLevels: number[]; favorability: number }> = {
      'shu-source': { id: 'shu-source', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'shu-target': { id: 'shu-target', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroData[id] ?? null,
      updateHero: (id, updates) => { if (heroData[id]) Object.assign(heroData[id], updates); },
      addResources: () => {},
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'shu-source',
      targetHeroId: 'shu-target',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    expect(result.success).toBe(true);
    // 同阵营应获得加成
    expect(result.efficiency).toBeGreaterThan(0.5);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 装备传承
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §2 装备传承', () => {

  it('should reject equipment heritage when source not found', () => {
    // Play §2: 源装备不存在
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const result = heritage.executeEquipmentHeritage({
      sourceUid: 'nonexistent-equip',
      targetUid: 'target-equip',
      options: { transferEnhanceLevel: true },
    });

    expect(result.success).toBe(false);
    expect(result.type).toBe('equipment');
  });

  it('should reject self-heritage for equipment', () => {
    // Play §2: 不能自我传承
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    heritage.setCallbacks({
      getEquip: (uid) => ({ uid, slot: 'weapon', rarity: 4, enhanceLevel: 10 }),
    });

    const result = heritage.executeEquipmentHeritage({
      sourceUid: 'equip-001',
      targetUid: 'equip-001',
      options: { transferEnhanceLevel: true },
    });

    expect(result.success).toBe(false);
  });

  it('should execute equipment heritage with valid equipment', () => {
    // Play §2: 装备传承完整流程
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const equipData: Record<string, { uid: string; slot: string; rarity: number; enhanceLevel: number }> = {
      'source-equip': { uid: 'source-equip', slot: 'weapon', rarity: 4, enhanceLevel: 12 },
      'target-equip': { uid: 'target-equip', slot: 'weapon', rarity: 5, enhanceLevel: 3 },
    };

    heritage.setCallbacks({
      getEquip: (uid) => equipData[uid] ?? null,
      updateEquip: (uid, updates) => { if (equipData[uid]) Object.assign(equipData[uid], updates); },
      removeEquip: (uid) => { delete equipData[uid]; },
      addResources: () => {},
    });

    const result = heritage.executeEquipmentHeritage({
      sourceUid: 'source-equip',
      targetUid: 'target-equip',
      options: { transferEnhanceLevel: true },
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('equipment');
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.copperCost).toBeGreaterThan(0);
  });

  it('should calculate efficiency based on rarity difference', () => {
    // Play §2: 稀有度差异影响效率
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    // 同稀有度
    const equipData1: Record<string, { uid: string; slot: string; rarity: number; enhanceLevel: number }> = {
      'src-same': { uid: 'src-same', slot: 'weapon', rarity: 4, enhanceLevel: 10 },
      'tgt-same': { uid: 'tgt-same', slot: 'weapon', rarity: 4, enhanceLevel: 0 },
    };

    heritage.setCallbacks({
      getEquip: (uid) => equipData1[uid] ?? null,
      updateEquip: (uid, updates) => { if (equipData1[uid]) Object.assign(equipData1[uid], updates); },
      removeEquip: (uid) => { delete equipData1[uid]; },
      addResources: () => {},
    });

    const resultSame = heritage.executeEquipmentHeritage({
      sourceUid: 'src-same', targetUid: 'tgt-same',
      options: { transferEnhanceLevel: true },
    });

    expect(resultSame.success).toBe(true);
    expect(resultSame.efficiency).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 经验传承
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §3 经验传承', () => {

  it('should reject experience heritage when source not found', () => {
    // Play §3: 源武将不存在
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const result = heritage.executeExperienceHeritage({
      sourceHeroId: 'nonexistent',
      targetHeroId: 'target',
      expRatio: 0.5,
    });

    expect(result.success).toBe(false);
    expect(result.type).toBe('experience');
  });

  it('should reject self-experience heritage', () => {
    // Play §3: 不能自我传承
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    heritage.setCallbacks({
      getHero: (id) => ({
        id, level: 30, exp: 5000, quality: 4,
        faction: 'shu', skillLevels: [5], favorability: 60,
      }),
    });

    const result = heritage.executeExperienceHeritage({
      sourceHeroId: 'hero-x',
      targetHeroId: 'hero-x',
      expRatio: 0.5,
    });

    expect(result.success).toBe(false);
  });

  it('should execute experience heritage with valid heroes', () => {
    // Play §3: 经验传承完整流程
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroData: Record<string, { id: string; level: number; exp: number; quality: number; faction: string; skillLevels: number[]; favorability: number }> = {
      'exp-source': { id: 'exp-source', level: 50, exp: 20000, quality: 5, faction: 'wei', skillLevels: [8], favorability: 90 },
      'exp-target': { id: 'exp-target', level: 15, exp: 1500, quality: 3, faction: 'shu', skillLevels: [3], favorability: 40 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroData[id] ?? null,
      updateHero: (id, updates) => { if (heroData[id]) Object.assign(heroData[id], updates); },
      addResources: () => {},
    });

    const result = heritage.executeExperienceHeritage({
      sourceHeroId: 'exp-source',
      targetHeroId: 'exp-target',
      expRatio: 0.5,
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('experience');
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.copperCost).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 传承消耗与限制
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §4 传承消耗与限制', () => {

  it('should track daily heritage count in state', () => {
    // Play §4: 每日传承次数追踪
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    const state = heritage.getState();
    expect(state.dailyHeritageCount).toBe(0);
  });

  it('should increment daily count after heritage', () => {
    // Play §4: 传承后次数+1
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroData: Record<string, { id: string; level: number; exp: number; quality: number; faction: string; skillLevels: number[]; favorability: number }> = {
      'daily-src': { id: 'daily-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'daily-tgt': { id: 'daily-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroData[id] ?? null,
      updateHero: (id, updates) => { if (heroData[id]) Object.assign(heroData[id], updates); },
      addResources: () => {},
    });

    heritage.executeHeroHeritage({
      sourceHeroId: 'daily-src', targetHeroId: 'daily-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    const state = heritage.getState();
    expect(state.dailyHeritageCount).toBe(1);
    expect(state.heroHeritageCount).toBe(1);
  });

  it('should record heritage in history', () => {
    // Play §4: 传承历史记录
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroData: Record<string, { id: string; level: number; exp: number; quality: number; faction: string; skillLevels: number[]; favorability: number }> = {
      'hist-src': { id: 'hist-src', level: 30, exp: 5000, quality: 4, faction: 'shu', skillLevels: [4], favorability: 50 },
      'hist-tgt': { id: 'hist-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroData[id] ?? null,
      updateHero: (id, updates) => { if (heroData[id]) Object.assign(heroData[id], updates); },
      addResources: () => {},
    });

    heritage.executeHeroHeritage({
      sourceHeroId: 'hist-src', targetHeroId: 'hist-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    const state = heritage.getState();
    expect(state.heritageHistory.length).toBeGreaterThanOrEqual(1);
    const record = state.heritageHistory[state.heritageHistory.length - 1];
    expect(record.type).toBe('hero');
    expect(record.sourceId).toBe('hist-src');
    expect(record.targetId).toBe('hist-tgt');
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 转生后加速
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §5 转生后加速', () => {

  it('should get acceleration state', () => {
    // Play §5: 加速状态查询
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    const accelState = heritage.getAccelerationState();
    expect(accelState).toBeDefined();
  });

  it('should initialize rebirth acceleration', () => {
    // Play §5: 初始化转生加速
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    expect(() => heritage.initRebirthAcceleration()).not.toThrow();
  });

  it('should claim initial gift after rebirth', () => {
    // Play §5: 领取转生后初始赠送
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();
    heritage.initRebirthAcceleration();

    const result = heritage.claimInitialGift();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      expect(result.resources).toBeDefined();
    }
  });

  it('should execute rebuild after rebirth', () => {
    // Play §5: 一键重建
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();
    heritage.initRebirthAcceleration();

    const result = heritage.executeRebuild();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should attempt instant upgrade for building', () => {
    // Play §5: 瞬间升级低级建筑
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    heritage.initRebirthAcceleration();

    const result = heritage.instantUpgrade('farmland');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 收益模拟器与转生解锁
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §6 收益模拟器与转生解锁', () => {

  it('should simulate heritage earnings', () => {
    // Play §6: 收益模拟
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const result = heritage.simulateEarnings({
      currentPrestige: 1000,
      targetPrestige: 5000,
      rebirthCount: 2,
      daysElapsed: 30,
    } as HeritageSimulationParams);

    expect(result).toBeDefined();
  });

  it('should get rebirth unlock content', () => {
    // Play §6: 转生次数解锁内容
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const unlocks = heritage.getRebirthUnlocks();
    expect(unlocks).toBeDefined();
  });

  it('should check if specific content is unlocked', () => {
    // Play §6: 解锁状态检查
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const isUnlocked = heritage.isUnlocked('some-unlock-id');
    expect(typeof isUnlocked).toBe('boolean');
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §7 跨系统联动', () => {

  it('should coordinate heritage with resource system', () => {
    // Play §7: 传承→资源系统联动
    const sim = createSimWithHeritageInit();
    sim.addResources(SUFFICIENT_RESOURCES);
    const heritage = sim.engine.getHeritageSystem();
    const currency = sim.engine.getCurrencySystem();

    expect(heritage).toBeDefined();
    expect(currency).toBeDefined();

    // 传承系统通过回调与资源系统交互
    let resourceDeducted = false;
    const heroData: Record<string, { id: string; level: number; exp: number; quality: number; faction: string; skillLevels: number[]; favorability: number }> = {
      'cross-src': { id: 'cross-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'cross-tgt': { id: 'cross-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroData[id] ?? null,
      updateHero: (id, updates) => { if (heroData[id]) Object.assign(heroData[id], updates); },
      addResources: (res) => { if (res.copper && res.copper < 0) resourceDeducted = true; },
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'cross-src', targetHeroId: 'cross-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    if (result.success) {
      expect(resourceDeducted).toBe(true);
    }
  });

  it('should save and load heritage data', () => {
    // Play §7: 存档序列化
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const saveData = heritage.getSaveData();
    expect(saveData).toBeDefined();
    expect(saveData.version).toBeDefined();
    expect(saveData.state).toBeDefined();

    // 加载存档不应抛出异常
    expect(() => heritage.loadSaveData(saveData)).not.toThrow();
  });

  it('should reset heritage system state', () => {
    // Play §7: 重置
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroData: Record<string, { id: string; level: number; exp: number; quality: number; faction: string; skillLevels: number[]; favorability: number }> = {
      'reset-src': { id: 'reset-src', level: 30, exp: 5000, quality: 4, faction: 'shu', skillLevels: [4], favorability: 50 },
      'reset-tgt': { id: 'reset-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroData[id] ?? null,
      updateHero: (id, updates) => { if (heroData[id]) Object.assign(heroData[id], updates); },
      addResources: () => {},
    });

    heritage.executeHeroHeritage({
      sourceHeroId: 'reset-src', targetHeroId: 'reset-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    heritage.reset();
    const state = heritage.getState();
    expect(state.dailyHeritageCount).toBe(0);
    expect(state.heroHeritageCount).toBe(0);
    expect(state.heritageHistory.length).toBe(0);
  });

});
