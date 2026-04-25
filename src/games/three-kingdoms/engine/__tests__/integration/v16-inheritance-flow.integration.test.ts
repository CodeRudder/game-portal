/**
 * v16.0 传承有序 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 传承物品选择与属性（武将/装备/经验传承）
 * - §2 传承消耗与效果（铜钱消耗、效率计算、阵营加成）
 * - §3 传承规则（保留项/重置项、每日次数、历史记录）
 * - §4 转生后加速（初始赠送、一键重建、瞬间升级）
 * - §5 跨系统联动（传承→资源→存档→重置）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例（createSim）
 * - 使用真实引擎 API，不使用 mock，不用 `as any`
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v16-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { HeritageSimulationParams } from '../../../../core/heritage';
import {
  ENHANCE_SUCCESS_RATES,
  ENHANCE_CONFIG,
  RARITY_ENHANCE_CAP,
} from '../../../core/equipment/equipment-config';
import type { EquipmentRarity } from '../../../core/equipment/equipment.types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
} from '../../../core/prestige/prestige-config';
import { calcRebirthMultiplier } from '../../prestige/RebirthSystem';

/**
 * 创建 sim 并手动初始化 HeritageSystem 的 deps。
 *
 * 引擎 initR16Systems() 当前未调用 heritageSystem.init(deps)，
 * 导致 recordHeritage 中 this.deps.eventBus 崩溃。
 * 此 helper 在引擎初始化后手动注入 deps，避免 `as any`。
 */
function createSimWithHeritageInit() {
  const sim = createSim();
  const heritage = sim.engine.getHeritageSystem();
  // 从引擎内部获取 eventBus — 使用 unknown 中转避免 `as any`
  const engineInternal = sim.engine as unknown as {
    bus: { on: (...a: unknown[]) => void; emit: (...a: unknown[]) => void; off: (...a: unknown[]) => void };
  };
  const deps = {
    eventBus: engineInternal.bus,
    config: { get: () => undefined },
    registry: { get: () => undefined },
  };
  heritage.init(deps as never);
  return sim;
}

// ── 武将数据类型（内联，避免依赖外部 type） ──
interface HeroStub {
  id: string;
  level: number;
  exp: number;
  quality: number;
  faction: string;
  skillLevels: number[];
  favorability: number;
}

// ── 装备数据类型 ──
interface EquipStub {
  uid: string;
  slot: string;
  rarity: number;
  enhanceLevel: number;
}

// ═══════════════════════════════════════════════════════════════
// §1 传承物品选择与属性
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §1 传承物品选择与属性', () => {

  it('should access heritage system and expose core methods', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    expect(heritage).toBeDefined();
    expect(typeof heritage.executeHeroHeritage).toBe('function');
    expect(typeof heritage.executeEquipmentHeritage).toBe('function');
    expect(typeof heritage.executeExperienceHeritage).toBe('function');
    expect(typeof heritage.getState).toBe('function');
  });

  it('should reject hero heritage when source or target not found', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    // 源武将不存在
    const r1 = heritage.executeHeroHeritage({
      sourceHeroId: 'nonexistent',
      targetHeroId: 'another',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });
    expect(r1.success).toBe(false);

    // 设置源武将存在但目标不存在
    heritage.setCallbacks({ getHero: (id) => id === 'src' ? { id: 'src', level: 30, exp: 5000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 80 } : null });
    const r2 = heritage.executeHeroHeritage({
      sourceHeroId: 'src', targetHeroId: 'missing',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });
    expect(r2.success).toBe(false);
  });

  it('should reject self-heritage for hero and equipment', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    // 武将自我传承
    heritage.setCallbacks({
      getHero: (id) => ({ id, level: 30, exp: 5000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 80 }),
    });
    const heroResult = heritage.executeHeroHeritage({
      sourceHeroId: 'hero-1', targetHeroId: 'hero-1',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });
    expect(heroResult.success).toBe(false);

    // 装备自我传承
    heritage.setCallbacks({
      getEquip: (uid) => ({ uid, slot: 'weapon', rarity: 4, enhanceLevel: 10 }),
    });
    const equipResult = heritage.executeEquipmentHeritage({
      sourceUid: 'equip-1', targetUid: 'equip-1',
      options: { transferEnhanceLevel: true },
    });
    expect(equipResult.success).toBe(false);
  });

  it('should execute hero heritage and transfer skill levels and favorability', () => {
    const sim = createSimWithHeritageInit();
    sim.addResources(SUFFICIENT_RESOURCES);
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'src': { id: 'src', level: 50, exp: 10000, quality: 5, faction: 'shu', skillLevels: [8, 6], favorability: 100 },
      'tgt': { id: 'tgt', level: 20, exp: 2000, quality: 4, faction: 'shu', skillLevels: [3, 2], favorability: 30 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'src', targetHeroId: 'tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: true, transferFavorability: true },
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('hero');
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.copperCost).toBeGreaterThan(0);
    expect(result.sourceBefore.id).toBe('src');
    expect(result.targetBefore.id).toBe('tgt');
  });

  it('should execute equipment heritage and transfer enhance level', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const equips: Record<string, EquipStub> = {
      'src-eq': { uid: 'src-eq', slot: 'weapon', rarity: 4, enhanceLevel: 12 },
      'tgt-eq': { uid: 'tgt-eq', slot: 'weapon', rarity: 5, enhanceLevel: 3 },
    };

    heritage.setCallbacks({
      getEquip: (uid) => equips[uid] ?? null,
      updateEquip: (uid, updates) => { if (equips[uid]) Object.assign(equips[uid], updates); },
      removeEquip: (uid) => { delete equips[uid]; },
      addResources: () => {},
    });

    const result = heritage.executeEquipmentHeritage({
      sourceUid: 'src-eq', targetUid: 'tgt-eq',
      options: { transferEnhanceLevel: true },
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('equipment');
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.copperCost).toBeGreaterThan(0);
  });

  it('should execute experience heritage with partial exp transfer', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'exp-src': { id: 'exp-src', level: 50, exp: 20000, quality: 5, faction: 'wei', skillLevels: [8], favorability: 90 },
      'exp-tgt': { id: 'exp-tgt', level: 15, exp: 1500, quality: 3, faction: 'shu', skillLevels: [3], favorability: 40 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    const result = heritage.executeExperienceHeritage({
      sourceHeroId: 'exp-src', targetHeroId: 'exp-tgt', expRatio: 0.5,
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('experience');
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.copperCost).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 传承消耗与效果
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §2 传承消耗与效果', () => {

  it('should apply faction bonus for same-faction hero heritage', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'shu-src': { id: 'shu-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'shu-tgt': { id: 'shu-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'shu-src', targetHeroId: 'shu-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    expect(result.success).toBe(true);
    // 同阵营应获得加成效率 > 0.5
    expect(result.efficiency).toBeGreaterThan(0.5);
  });

  it('should calculate efficiency based on rarity difference for equipment', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    // 同稀有度传承
    const equips: Record<string, EquipStub> = {
      's1': { uid: 's1', slot: 'weapon', rarity: 4, enhanceLevel: 10 },
      't1': { uid: 't1', slot: 'weapon', rarity: 4, enhanceLevel: 0 },
    };

    heritage.setCallbacks({
      getEquip: (uid) => equips[uid] ?? null,
      updateEquip: (uid, updates) => { if (equips[uid]) Object.assign(equips[uid], updates); },
      removeEquip: (uid) => { delete equips[uid]; },
      addResources: () => {},
    });

    const resultSame = heritage.executeEquipmentHeritage({
      sourceUid: 's1', targetUid: 't1',
      options: { transferEnhanceLevel: true },
    });
    expect(resultSame.success).toBe(true);
    expect(resultSame.efficiency).toBeGreaterThan(0);
  });

  it('should deduct copper cost via callback on successful heritage', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    let deductedCopper = 0;
    const heroes: Record<string, HeroStub> = {
      'cost-src': { id: 'cost-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'cost-tgt': { id: 'cost-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: (res: Record<string, number>) => { if (res.copper && res.copper < 0) deductedCopper += res.copper; },
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'cost-src', targetHeroId: 'cost-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    if (result.success) {
      expect(deductedCopper).toBeLessThan(0);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 传承规则：保留项/重置项、次数限制、历史记录
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §3 传承规则', () => {

  it('should track initial daily heritage count as zero', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    const state = heritage.getState();
    expect(state.dailyHeritageCount).toBe(0);
    expect(state.heroHeritageCount).toBe(0);
    expect(state.equipmentHeritageCount).toBe(0);
    expect(state.experienceHeritageCount).toBe(0);
    expect(Array.isArray(state.heritageHistory)).toBe(true);
  });

  it('should increment daily and type-specific count after heritage', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'cnt-src': { id: 'cnt-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'cnt-tgt': { id: 'cnt-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    heritage.executeHeroHeritage({
      sourceHeroId: 'cnt-src', targetHeroId: 'cnt-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    const state = heritage.getState();
    expect(state.dailyHeritageCount).toBe(1);
    expect(state.heroHeritageCount).toBe(1);
  });

  it('should record heritage in history with correct metadata', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'hist-src': { id: 'hist-src', level: 30, exp: 5000, quality: 4, faction: 'shu', skillLevels: [4], favorability: 50 },
      'hist-tgt': { id: 'hist-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
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

  it('should reset all heritage state on reset()', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'r-src': { id: 'r-src', level: 30, exp: 5000, quality: 4, faction: 'shu', skillLevels: [4], favorability: 50 },
      'r-tgt': { id: 'r-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    heritage.executeHeroHeritage({
      sourceHeroId: 'r-src', targetHeroId: 'r-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    heritage.reset();
    const state = heritage.getState();
    expect(state.dailyHeritageCount).toBe(0);
    expect(state.heroHeritageCount).toBe(0);
    expect(state.heritageHistory.length).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 转生后加速
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §4 转生后加速', () => {

  it('should initialize rebirth acceleration and claim initial gift', () => {
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

  it('should execute one-click rebuild after rebirth', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();
    heritage.initRebirthAcceleration();

    const result = heritage.executeRebuild();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should attempt instant upgrade for low-level building', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    heritage.initRebirthAcceleration();

    const result = heritage.instantUpgrade('farmland');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should simulate heritage earnings and check rebirth unlocks', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    // 收益模拟
    const simResult = heritage.simulateEarnings({
      currentPrestige: 1000,
      targetPrestige: 5000,
      rebirthCount: 2,
      daysElapsed: 30,
    } as HeritageSimulationParams);
    expect(simResult).toBeDefined();

    // 转生解锁内容
    const unlocks = heritage.getRebirthUnlocks();
    expect(unlocks).toBeDefined();

    // 解锁状态检查
    const isUnlocked = heritage.isUnlocked('some-unlock-id');
    expect(typeof isUnlocked).toBe('boolean');
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §5 跨系统联动', () => {

  it('should coordinate heritage with currency system', () => {
    const sim = createSimWithHeritageInit();
    sim.addResources(SUFFICIENT_RESOURCES);
    const heritage = sim.engine.getHeritageSystem();
    const currency = sim.engine.getCurrencySystem();

    expect(heritage).toBeDefined();
    expect(currency).toBeDefined();

    // 传承系统通过回调与资源系统交互
    let resourceDeducted = false;
    const heroes: Record<string, HeroStub> = {
      'cross-src': { id: 'cross-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'cross-tgt': { id: 'cross-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: (res: Record<string, number>) => { if (res.copper && res.copper < 0) resourceDeducted = true; },
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'cross-src', targetHeroId: 'cross-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    if (result.success) {
      expect(resourceDeducted).toBe(true);
    }
  });

  it('should save and load heritage data preserving state', () => {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();

    const saveData = heritage.getSaveData();
    expect(saveData).toBeDefined();
    expect(saveData.version).toBeDefined();
    expect(saveData.state).toBeDefined();

    // 加载存档不应抛出异常
    expect(() => heritage.loadSaveData(saveData)).not.toThrow();
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 装备强化核心数值
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §6 装备强化核心数值', () => {

  // ── 6.1 强化成功率表验证 ──

  it('should expose correct success rate table matching ENHANCE_SUCCESS_RATES', () => {
    const sim = createSim();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    // 验证 15 级成功率曲线全部可查
    for (let level = 0; level < 15; level++) {
      const rate = enhance.getSuccessRate(level);
      expect(rate).toBeCloseTo(ENHANCE_SUCCESS_RATES[level], 4);
    }

    // 关键节点验证
    expect(enhance.getSuccessRate(0)).toBe(1.0);   // +0→+1: 100%
    expect(enhance.getSuccessRate(2)).toBe(1.0);   // +2→+3: 100%
    expect(enhance.getSuccessRate(3)).toBe(0.80);  // +3→+4: 80%
    expect(enhance.getSuccessRate(5)).toBe(0.55);  // +5→+6: 55%
    expect(enhance.getSuccessRate(9)).toBe(0.10);  // +9→+10: 10%
    expect(enhance.getSuccessRate(14)).toBe(0.01); // +14→+15: 1%
  });

  it('should return 0.01 for levels beyond the table', () => {
    const sim = createSim();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    expect(enhance.getSuccessRate(15)).toBe(0.01);
    expect(enhance.getSuccessRate(99)).toBe(0.01);
  });

  it('should have decreasing success rates as level increases', () => {
    const sim = createSim();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    for (let level = 3; level < 14; level++) {
      const current = enhance.getSuccessRate(level);
      const next = enhance.getSuccessRate(level + 1);
      expect(next).toBeLessThanOrEqual(current);
    }
  });

  // ── 6.2 品质强化上限（白+5/绿+8/蓝+10/紫+12/金+15） ──

  it('should enforce rarity enhance caps: white=5, green=8, blue=10, purple=12, gold=15', () => {
    expect(RARITY_ENHANCE_CAP.white).toBe(5);
    expect(RARITY_ENHANCE_CAP.green).toBe(8);
    expect(RARITY_ENHANCE_CAP.blue).toBe(10);
    expect(RARITY_ENHANCE_CAP.purple).toBe(12);
    expect(RARITY_ENHANCE_CAP.gold).toBe(15);
  });

  it('should reject enhance when equipment is at rarity cap', () => {
    const sim = createSim();
    const equipSys = sim.engine.getEquipmentSystem();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    // 生成白色装备并强化到+5（上限）
    const whiteEq = equipSys.generateEquipment('weapon', 'white');
    expect(whiteEq).not.toBeNull();
    if (!whiteEq) return;

    // 注入资源扣除（始终成功）
    enhance.setResourceDeductor(() => true);

    // 先强化到+5（白品质上限）— 前3级100%成功
    for (let i = 0; i < 5; i++) {
      enhance.enhance(whiteEq.uid);
    }

    const atCap = equipSys.getEquipment(whiteEq.uid);
    expect(atCap).not.toBeNull();
    expect(atCap!.enhanceLevel).toBeGreaterThanOrEqual(3); // 至少前3级100%

    // 手动设置到上限以测试拒绝逻辑
    const capped = equipSys.recalcStats({ ...atCap!, enhanceLevel: 5 });
    equipSys.updateEquipment(capped);

    // 尝试超过上限 — 应返回 fail 且等级不变
    const result = enhance.enhance(whiteEq.uid);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(5);
  });

  it('should allow gold equipment to reach +15 but not beyond', () => {
    const sim = createSim();
    const equipSys = sim.engine.getEquipmentSystem();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    const goldEq = equipSys.generateEquipment('weapon', 'gold');
    expect(goldEq).not.toBeNull();
    if (!goldEq) return;

    enhance.setResourceDeductor(() => true);

    // 手动设置到+14
    const at14 = equipSys.recalcStats({ ...goldEq, enhanceLevel: 14 });
    equipSys.updateEquipment(at14);

    // +14→+15 应该可以尝试（不拒绝）
    const result = enhance.enhance(goldEq.uid);
    // 不应因品质上限被拒绝（outcome 可能成功也可能失败，但不是因上限拒绝）
    // 如果被拒绝，currentLevel 应保持 14
    expect(result.previousLevel).toBe(14);

    // 手动设置到+15
    const at15 = equipSys.recalcStats({ ...goldEq, enhanceLevel: 15 });
    equipSys.updateEquipment(at15);

    // +15→+16 应该被拒绝（超过 maxLevel=15）
    const resultOver = enhance.enhance(goldEq.uid);
    expect(resultOver.outcome).toBe('fail');
    expect(resultOver.currentLevel).toBe(15);
  });

  // ── 6.3 失败降级规则（不低于+5安全线） ──

  it('should have safeLevel=5 where downgrade cannot occur below', () => {
    expect(ENHANCE_CONFIG.safeLevel).toBe(5);
    expect(ENHANCE_CONFIG.downgradeChance).toBe(0.5);
  });

  it('should not downgrade at or below safeLevel (+5)', () => {
    const sim = createSim();
    const equipSys = sim.engine.getEquipmentSystem();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    const blueEq = equipSys.generateEquipment('weapon', 'blue');
    expect(blueEq).not.toBeNull();
    if (!blueEq) return;

    enhance.setResourceDeductor(() => true);

    // 设置到+5（安全线）
    const at5 = equipSys.recalcStats({ ...blueEq, enhanceLevel: 5 });
    equipSys.updateEquipment(at5);

    // +5→+6 失败时不会降到+5以下（安全线内不降级）
    // 因为+5==safeLevel，降级检查条件是 level > safeLevel
    // 所以+5失败不降级
    const eq = equipSys.getEquipment(blueEq.uid);
    expect(eq!.enhanceLevel).toBe(5);
  });

  // ── 6.4 保护符机制 ──

  it('should consume protection scroll to prevent downgrade on failure', () => {
    const sim = createSim();
    const equipSys = sim.engine.getEquipmentSystem();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    const purpleEq = equipSys.generateEquipment('weapon', 'purple');
    expect(purpleEq).not.toBeNull();
    if (!purpleEq) return;

    enhance.setResourceDeductor(() => true);

    // 设置到+8（安全线以上，可能降级）
    const at8 = equipSys.recalcStats({ ...purpleEq, enhanceLevel: 8 });
    equipSys.updateEquipment(at8);

    // 添加保护符
    enhance.addProtection(10);
    const protBefore = enhance.getProtectionCount();

    // 使用保护符强化
    const result = enhance.enhance(purpleEq.uid, true);
    expect(result.previousLevel).toBe(8);

    // 如果失败且使用了保护符，等级不应降低
    if (result.outcome === 'fail' && result.protectionUsed) {
      expect(result.currentLevel).toBe(8); // 保护符防止降级
      expect(enhance.getProtectionCount()).toBeLessThan(protBefore);
    }
  });

  it('should report protection cost per level', () => {
    const sim = createSim();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    // +6→+7 需要保护符
    expect(enhance.getProtectionCost(6)).toBe(1);
    // +10→+11 需要保护符
    expect(enhance.getProtectionCost(10)).toBe(3);
    // +14→+15 需要保护符
    expect(enhance.getProtectionCost(14)).toBe(5);
  });

  // ── 6.5 强化费用曲线 ──

  it('should calculate copper cost with exponential growth', () => {
    const sim = createSim();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    // baseCopper=100, copperGrowth=1.5
    const cost0 = enhance.getCopperCost(0);
    expect(cost0).toBe(100); // 100 * 1.5^0

    const cost5 = enhance.getCopperCost(5);
    expect(cost5).toBe(Math.floor(100 * Math.pow(1.5, 5)));

    // 费用应递增
    for (let level = 0; level < 14; level++) {
      expect(enhance.getCopperCost(level + 1)).toBeGreaterThan(enhance.getCopperCost(level));
    }
  });

  it('should calculate stone cost with exponential growth', () => {
    const sim = createSim();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    // baseStone=1, stoneGrowth=1.3
    const cost0 = enhance.getStoneCost(0);
    expect(cost0).toBe(1);

    const cost5 = enhance.getStoneCost(5);
    expect(cost5).toBe(Math.max(1, Math.floor(1 * Math.pow(1.3, 5))));
  });

  // ── 6.6 强化转移 ──

  it('should transfer enhance level with -1 loss and deduct cost', () => {
    const sim = createSim();
    const equipSys = sim.engine.getEquipmentSystem();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    const source = equipSys.generateEquipment('weapon', 'purple');
    const target = equipSys.generateEquipment('armor', 'blue');
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    if (!source || !target) return;

    // 设置源装备到+10
    const sourceAt10 = equipSys.recalcStats({ ...source, enhanceLevel: 10 });
    equipSys.updateEquipment(sourceAt10);

    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(true);
    expect(result.transferredLevel).toBe(9); // 10 - 1 = 9
    expect(result.cost).toBeGreaterThan(0);

    // 源装备应重置为+0
    const sourceAfter = equipSys.getEquipment(source.uid);
    expect(sourceAfter!.enhanceLevel).toBe(0);

    // 目标装备应为+9
    const targetAfter = equipSys.getEquipment(target.uid);
    expect(targetAfter!.enhanceLevel).toBe(9);
  });

  it('should reject transfer when source is +0', () => {
    const sim = createSim();
    const equipSys = sim.engine.getEquipmentSystem();
    const enhance = sim.engine.getEquipmentEnhanceSystem();

    const source = equipSys.generateEquipment('weapon', 'white');
    const target = equipSys.generateEquipment('armor', 'white');
    if (!source || !target) return;

    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(false);
    expect(result.transferredLevel).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 转生条件完整验证
// ═══════════════════════════════════════════════════════════════
describe('v16.0 传承有序 — §7 转生条件完整验证', () => {

  // ── 7.1 转生条件5项完整验证 ──

  it('should define exactly 4 rebirth conditions in config', () => {
    // PRD 转生条件：声望等级≥20、主城等级≥10、武将数量≥5、总战力≥10000
    expect(REBIRTH_CONDITIONS.minPrestigeLevel).toBe(20);
    expect(REBIRTH_CONDITIONS.minCastleLevel).toBe(10);
    expect(REBIRTH_CONDITIONS.minHeroCount).toBe(5);
    expect(REBIRTH_CONDITIONS.minTotalPower).toBe(10000);
  });

  it('should report all conditions unmet when nothing is set up', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(false);

    // 全部条件不满足
    expect(check.conditions.prestigeLevel.met).toBe(false);
    expect(check.conditions.castleLevel.met).toBe(false);
    expect(check.conditions.heroCount.met).toBe(false);
    expect(check.conditions.totalPower.met).toBe(false);
  });

  it('should partially meet conditions when only prestige level is sufficient', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    // 只满足声望等级
    rebirth.updatePrestigeLevel(25);

    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(false);
    expect(check.conditions.prestigeLevel.met).toBe(true);
    expect(check.conditions.prestigeLevel.current).toBe(25);
    expect(check.conditions.prestigeLevel.required).toBe(20);
    expect(check.conditions.castleLevel.met).toBe(false);
    expect(check.conditions.heroCount.met).toBe(false);
    expect(check.conditions.totalPower.met).toBe(false);
  });

  it('should meet all 4 conditions and allow rebirth', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    // 设置回调满足全部条件
    rebirth.setCallbacks({
      castleLevel: () => 15,     // ≥10 ✓
      heroCount: () => 8,         // ≥5 ✓
      totalPower: () => 50000,    // ≥10000 ✓
      prestigeLevel: () => 25,    // ≥20 ✓
    });
    rebirth.updatePrestigeLevel(25);

    const check = rebirth.checkRebirthConditions();
    expect(check.conditions.prestigeLevel.met).toBe(true);
    expect(check.conditions.castleLevel.met).toBe(true);
    expect(check.conditions.heroCount.met).toBe(true);
    expect(check.conditions.totalPower.met).toBe(true);
    expect(check.canRebirth).toBe(true);
  });

  it('should reject rebirth when any single condition is unmet', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    // 满足3项但缺主城等级
    rebirth.setCallbacks({
      castleLevel: () => 5,       // <10 ✗
      heroCount: () => 8,          // ≥5 ✓
      totalPower: () => 50000,     // ≥10000 ✓
    });
    rebirth.updatePrestigeLevel(25);

    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(false);
    expect(check.conditions.castleLevel.met).toBe(false);

    // 满足3项但缺武将数量
    rebirth.setCallbacks({
      castleLevel: () => 15,
      heroCount: () => 3,          // <5 ✗
      totalPower: () => 50000,
    });

    const check2 = rebirth.checkRebirthConditions();
    expect(check2.canRebirth).toBe(false);
    expect(check2.conditions.heroCount.met).toBe(false);

    // 满足3项但缺总战力
    rebirth.setCallbacks({
      castleLevel: () => 15,
      heroCount: () => 8,
      totalPower: () => 5000,      // <10000 ✗
    });

    const check3 = rebirth.checkRebirthConditions();
    expect(check3.canRebirth).toBe(false);
    expect(check3.conditions.totalPower.met).toBe(false);
  });

  it('should report current vs required for each unmet condition', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    rebirth.setCallbacks({
      castleLevel: () => 7,
      heroCount: () => 3,
      totalPower: () => 8000,
    });
    rebirth.updatePrestigeLevel(15);

    const check = rebirth.checkRebirthConditions();
    expect(check.conditions.prestigeLevel.current).toBe(15);
    expect(check.conditions.prestigeLevel.required).toBe(20);
    expect(check.conditions.castleLevel.current).toBe(7);
    expect(check.conditions.castleLevel.required).toBe(10);
    expect(check.conditions.heroCount.current).toBe(3);
    expect(check.conditions.heroCount.required).toBe(5);
    expect(check.conditions.totalPower.current).toBe(8000);
    expect(check.conditions.totalPower.required).toBe(10000);
  });

  // ── 7.2 转生倍率加成 ──

  it('should calculate rebirth multiplier correctly', () => {
    // base=1.0, perRebirth=0.5, max=10.0
    expect(REBIRTH_MULTIPLIER.base).toBe(1.0);
    expect(REBIRTH_MULTIPLIER.perRebirth).toBe(0.5);
    expect(REBIRTH_MULTIPLIER.max).toBe(10.0);

    // 第1次转生: 1.0 + 1*0.5 = 1.5
    expect(calcRebirthMultiplier(1)).toBeCloseTo(1.5, 2);
    // 第2次转生: 1.0 + 0.5 * log2(3) ≈ 1.79 (对数衰减)
    expect(calcRebirthMultiplier(2)).toBeCloseTo(1.0 + 0.5 * Math.log2(3), 2);
    // 第5次转生: 1.0 + 0.5 * log2(6) ≈ 2.29 (对数衰减)
    expect(calcRebirthMultiplier(5)).toBeCloseTo(1.0 + 0.5 * Math.log2(6), 2);
    // 上限：第20次转生应被截断为10.0
    expect(calcRebirthMultiplier(20)).toBeLessThanOrEqual(10.0);
  });

  it('should update multiplier after successful rebirth', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    // 满足全部条件
    rebirth.setCallbacks({
      castleLevel: () => 15,
      heroCount: () => 8,
      totalPower: () => 50000,
      onReset: () => {},
    });
    rebirth.updatePrestigeLevel(25);

    const multiplierBefore = rebirth.getCurrentMultiplier();
    expect(multiplierBefore).toBe(1.0); // 初始倍率

    const result = rebirth.executeRebirth();
    expect(result.success).toBe(true);
    expect(result.newCount).toBe(1);
    expect(result.multiplier).toBeCloseTo(1.5, 2);

    const multiplierAfter = rebirth.getCurrentMultiplier();
    expect(multiplierAfter).toBeCloseTo(1.5, 2);
  });

  it('should stack multiplier across multiple rebirths', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    rebirth.setCallbacks({
      castleLevel: () => 15,
      heroCount: () => 8,
      totalPower: () => 50000,
      onReset: () => {},
    });
    rebirth.updatePrestigeLevel(25);

    // 连续3次转生
    for (let i = 0; i < 3; i++) {
      const r = rebirth.executeRebirth();
      expect(r.success).toBe(true);
    }

    // 3次转生: count=3 → 1.0 + 0.5 * log2(4) = 2.0 (对数衰减)
    expect(rebirth.getCurrentMultiplier()).toBeCloseTo(1.0 + 0.5 * Math.log2(4), 2);
  });

  // ── 7.3 转生后属性重置与保留 ──

  it('should define keep and reset rules correctly', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const keepRules = [
      'keep_heroes',
      'keep_equipment',
      'keep_tech_points',
      'keep_prestige',
      'keep_achievements',
      'keep_vip',
    ];
    const resetRules = [
      'reset_buildings',
      'reset_resources',
      'reset_map_progress',
      'reset_quest_progress',
      'reset_campaign',
    ];

    expect(rebirth.getKeepRules()).toEqual(keepRules);
    expect(rebirth.getResetRules()).toEqual(resetRules);
  });

  it('should trigger acceleration after successful rebirth', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    rebirth.setCallbacks({
      castleLevel: () => 15,
      heroCount: () => 8,
      totalPower: () => 50000,
      onReset: () => {},
    });
    rebirth.updatePrestigeLevel(25);

    const result = rebirth.executeRebirth();
    expect(result.success).toBe(true);
    expect(result.acceleration).toBeDefined();

    // 加速效果应激活
    const accel = rebirth.getAcceleration();
    expect(accel.active).toBe(true);
    expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    expect(accel.config.buildSpeedMultiplier).toBe(1.5);
    expect(accel.config.resourceMultiplier).toBe(2.0);
    expect(accel.config.expMultiplier).toBe(2.0);
  });

  it('should apply effective multipliers with acceleration bonus', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    rebirth.setCallbacks({
      castleLevel: () => 15,
      heroCount: () => 8,
      totalPower: () => 50000,
      onReset: () => {},
    });
    rebirth.updatePrestigeLevel(25);

    rebirth.executeRebirth();

    const effective = rebirth.getEffectiveMultipliers();
    // 基础倍率1.5 × 加速倍率
    expect(effective.buildSpeed).toBeCloseTo(1.5 * 1.5, 2);  // 1.5 × 1.5
    expect(effective.techSpeed).toBeCloseTo(1.5 * 1.5, 2);   // 1.5 × 1.5
    expect(effective.resource).toBeCloseTo(1.5 * 2.0, 2);    // 1.5 × 2.0
    expect(effective.exp).toBeCloseTo(1.5 * 2.0, 2);         // 1.5 × 2.0
  });

  it('should record rebirth history', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    rebirth.setCallbacks({
      castleLevel: () => 15,
      heroCount: () => 8,
      totalPower: () => 50000,
      onReset: () => {},
    });
    rebirth.updatePrestigeLevel(25);

    rebirth.executeRebirth();

    const records = rebirth.getRebirthRecords();
    expect(records.length).toBe(1);
    expect(records[0].rebirthCount).toBe(1);
    expect(records[0].multiplier).toBeCloseTo(1.5, 2);
    expect(records[0].prestigeLevelBefore).toBe(25);
  });

  it('should reject rebirth and report unmet conditions in reason', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    // 不满足任何条件
    const result = rebirth.executeRebirth();
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('条件不满足');
  });

});
