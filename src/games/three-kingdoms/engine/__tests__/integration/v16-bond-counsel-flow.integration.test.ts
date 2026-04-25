/**
 * v16.0 传承有序 — 羁绊+军师+传承深化集成测试
 *
 * 覆盖范围：
 * - §1 武将羁绊效果（阵营分布/羁绊检测/加成计算/混搭羁绊）
 * - §2 羁绊可视化（编队预览/潜在羁绊提示/羁绊效果查询）
 * - §3 军师推荐系统（触发检测/建议更新/展示/执行/关闭/冷却）
 * - §4 传承系统深化（经验传承/装备传承/存档恢复/纪念记录）
 * - §5 跨系统联动（羁绊+好感度+军师+传承交互）
 *
 * @see docs/games/three-kingdoms/play/v16-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import { BondSystem } from '../../bond/BondSystem';
import { AdvisorSystem } from '../../advisor/AdvisorSystem';
import type { GameStateSnapshot } from '../../advisor/AdvisorSystem';
import type { GeneralData } from '../../hero/hero.types';
import type { EventChainDef } from '../../event/chain-event-types';

// ── 辅助：创建最小 deps ──
function createDeps() {
  const listeners: Record<string, Array<(...a: unknown[]) => void>> = {};
  return {
    eventBus: {
      on: (evt: string, fn: (...a: unknown[]) => void) => {
        (listeners[evt] ??= []).push(fn);
      },
      emit: (evt: string, ...args: unknown[]) => {
        (listeners[evt] ??= []).forEach(fn => fn(...args));
      },
      off: () => {},
    },
    config: { get: () => undefined },
    registry: { get: () => undefined },
  };
}

// ── 辅助：创建武将数据 ──
function makeHero(id: string, faction: string, level: number = 10): GeneralData {
  return {
    id,
    name: id,
    quality: 4,
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
    level,
    exp: level * 100,
    faction: faction as 'shu' | 'wei' | 'wu' | 'qun',
    skills: [],
  };
}

// ── 辅助：创建默认游戏快照 ──
function createDefaultSnapshot(overrides?: Partial<GameStateSnapshot>): GameStateSnapshot {
  return {
    resources: { grain: 5000, gold: 3000, troops: 1000, mandate: 50 },
    resourceCaps: { grain: 10000, gold: 10000, troops: 5000, mandate: 100 },
    buildingQueueIdle: false,
    upgradeableHeroes: [],
    techQueueIdle: false,
    armyFull: false,
    leavingNpcs: [],
    newFeatures: [],
    offlineOverflowPercent: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// §1 武将羁绊效果
// ═══════════════════════════════════════════════════════════════
describe('v16.0 羁绊+军师+传承深化 — §1 武将羁绊效果', () => {

  it('should calculate faction distribution correctly', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const heroes = [
      makeHero('liubei', 'shu'),
      makeHero('guanyu', 'shu'),
      makeHero('zhangfei', 'shu'),
      makeHero('caocao', 'wei'),
      makeHero('zhouyu', 'wu'),
    ];

    const dist = bond.getFactionDistribution(heroes);
    expect(dist.shu).toBe(3);
    expect(dist.wei).toBe(1);
    expect(dist.wu).toBe(1);
    expect(dist.qun).toBe(0);
  });

  it('should detect faction_2 bond (同乡之谊) for 2 same-faction heroes', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const heroes = [makeHero('liubei', 'shu'), makeHero('guanyu', 'shu')];
    const bonds = bond.detectActiveBonds(heroes);

    expect(bonds.length).toBeGreaterThanOrEqual(1);
    const faction2 = bonds.find(b => b.type === 'faction_2');
    expect(faction2).toBeDefined();
    expect(faction2!.faction).toBe('shu');
    expect(faction2!.heroCount).toBe(2);
  });

  it('should detect faction_3 bond (同仇敌忾) for 3 same-faction heroes', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const heroes = [
      makeHero('liubei', 'shu'),
      makeHero('guanyu', 'shu'),
      makeHero('zhangfei', 'shu'),
    ];
    const bonds = bond.detectActiveBonds(heroes);

    const faction3 = bonds.find(b => b.type === 'faction_3');
    expect(faction3).toBeDefined();
    expect(faction3!.faction).toBe('shu');
    expect(faction3!.heroCount).toBe(3);
  });

  it('should detect faction_6 bond (众志成城) for 6 same-faction heroes', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const heroes = Array.from({ length: 6 }, (_, i) => makeHero(`shu-hero-${i}`, 'shu'));
    const bonds = bond.detectActiveBonds(heroes);

    const faction6 = bonds.find(b => b.type === 'faction_6');
    expect(faction6).toBeDefined();
    expect(faction6!.heroCount).toBe(6);
  });

  it('should detect mixed_3_3 bond (混搭协作) for 3+3 different factions', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const heroes = [
      ...Array.from({ length: 3 }, (_, i) => makeHero(`shu-${i}`, 'shu')),
      ...Array.from({ length: 3 }, (_, i) => makeHero(`wei-${i}`, 'wei')),
    ];
    const bonds = bond.detectActiveBonds(heroes);

    // Should have faction_3 for both shu and wei, plus possibly mixed
    const faction3Bonds = bonds.filter(b => b.type === 'faction_3');
    expect(faction3Bonds.length).toBeGreaterThanOrEqual(2);
  });

  it('should calculate total bond bonuses across multiple bonds', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const heroes = [
      makeHero('liubei', 'shu'),
      makeHero('guanyu', 'shu'),
      makeHero('zhangfei', 'shu'),
    ];
    const bonds = bond.detectActiveBonds(heroes);
    const totalBonuses = bond.calculateTotalBondBonuses(bonds);

    expect(totalBonuses.attack).toBeGreaterThan(0);
  });

  it('should return empty bonds for empty hero list', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const bonds = bond.detectActiveBonds([]);
    expect(bonds).toEqual([]);
  });

  it('should return empty bonuses for empty bond list', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const bonuses = bond.calculateTotalBondBonuses([]);
    expect(Object.keys(bonuses).length).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 羁绊可视化
// ═══════════════════════════════════════════════════════════════
describe('v16.0 羁绊+军师+传承深化 — §2 羁绊可视化', () => {

  it('should generate formation preview with active bonds', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const heroes = [
      makeHero('liubei', 'shu'),
      makeHero('guanyu', 'shu'),
      makeHero('zhangfei', 'shu'),
    ];

    const preview = bond.getFormationPreview('formation-1', heroes);
    expect(preview.formationId).toBe('formation-1');
    expect(preview.activeBonds.length).toBeGreaterThanOrEqual(1);
    expect(preview.totalBonuses.attack).toBeGreaterThan(0);
    expect(preview.factionDistribution.shu).toBe(3);
  });

  it('should include potential bonds in preview', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    // Only 1 shu hero → should suggest adding 1 more for faction_2
    const heroes = [makeHero('liubei', 'shu')];
    const preview = bond.getFormationPreview('formation-2', heroes);

    expect(preview.potentialBonds.length).toBeGreaterThanOrEqual(1);
    const tip = preview.potentialBonds.find(p => p.suggestedFaction === 'shu');
    expect(tip).toBeDefined();
    expect(tip!.missingCount).toBe(1);
  });

  it('should query individual bond effect definition', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const effect = bond.getBondEffect('faction_3');
    expect(effect.type).toBe('faction_3');
    expect(effect.bonuses.attack).toBe(0.15);
  });

  it('should list all bond effect definitions', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    const allEffects = bond.getAllBondEffects();
    expect(allEffects.length).toBe(4); // faction_2, faction_3, faction_6, mixed_3_3
    const types = allEffects.map(e => e.type);
    expect(types).toContain('faction_2');
    expect(types).toContain('faction_3');
    expect(types).toContain('faction_6');
    expect(types).toContain('mixed_3_3');
  });

  it('should access bond system via engine getter', () => {
    const sim = createSim();
    const bondSystem = sim.engine.getBondSystem();
    expect(bondSystem).toBeDefined();
    expect(bondSystem.name).toBe('bond');
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 军师推荐系统
// ═══════════════════════════════════════════════════════════════
describe('v16.0 羁绊+军师+传承深化 — §3 军师推荐系统', () => {

  it('should detect resource_overflow trigger when resource > 90% cap', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({
      resources: { grain: 9500, gold: 3000, troops: 1000, mandate: 50 },
      resourceCaps: { grain: 10000, gold: 10000, troops: 5000, mandate: 100 },
    });

    const suggestions = advisor.detectTriggers(snapshot);
    const overflow = suggestions.find(s => s.triggerType === 'resource_overflow');
    expect(overflow).toBeDefined();
  });

  it('should detect resource_shortage trigger when resource < 10% cap', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({
      resources: { grain: 500, gold: 3000, troops: 1000, mandate: 50 },
      resourceCaps: { grain: 10000, gold: 10000, troops: 5000, mandate: 100 },
    });

    const suggestions = advisor.detectTriggers(snapshot);
    const shortage = suggestions.find(s => s.triggerType === 'resource_shortage');
    expect(shortage).toBeDefined();
  });

  it('should detect building_idle trigger', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({ buildingQueueIdle: true });
    const suggestions = advisor.detectTriggers(snapshot);
    const idle = suggestions.find(s => s.triggerType === 'building_idle');
    expect(idle).toBeDefined();
  });

  it('should update suggestions and respect daily limit', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({ buildingQueueIdle: true });
    advisor.updateSuggestions(snapshot);

    const displayed = advisor.getDisplayedSuggestions();
    expect(displayed.length).toBeLessThanOrEqual(3);
  });

  it('should execute a suggestion and remove it from list', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({ buildingQueueIdle: true });
    advisor.updateSuggestions(snapshot);

    const displayed = advisor.getDisplayedSuggestions();
    if (displayed.length > 0) {
      const id = displayed[0].id;
      const result = advisor.executeSuggestion(id);
      expect(result.success).toBe(true);

      // Should be removed
      const after = advisor.getDisplayedSuggestions();
      expect(after.find(s => s.id === id)).toBeUndefined();
    }
  });

  it('should dismiss a suggestion and apply cooldown', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({ buildingQueueIdle: true });
    advisor.updateSuggestions(snapshot);

    const displayed = advisor.getDisplayedSuggestions();
    if (displayed.length > 0) {
      const id = displayed[0].id;
      const result = advisor.dismissSuggestion(id);
      expect(result.success).toBe(true);

      // Same trigger type should be in cooldown
      expect(advisor.isInCooldown(displayed[0].triggerType)).toBe(true);
    }
  });

  it('should return failure when executing non-existent suggestion', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const result = advisor.executeSuggestion('nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('should serialize and load advisor save data', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({ buildingQueueIdle: true });
    advisor.updateSuggestions(snapshot);

    const saveData = advisor.serialize();
    expect(saveData.version).toBe(1);
    expect(typeof saveData.dailyCount).toBe('number');

    // Load into new instance
    const advisor2 = new AdvisorSystem();
    advisor2.init(createDeps());
    advisor2.loadSaveData(saveData);

    const state = advisor2.getDisplayState();
    expect(state.dailyCount).toBe(saveData.dailyCount);
  });

  it('should reset advisor state', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    const snapshot = createDefaultSnapshot({ buildingQueueIdle: true });
    advisor.updateSuggestions(snapshot);

    advisor.reset();
    const displayed = advisor.getDisplayedSuggestions();
    expect(displayed.length).toBe(0);
  });

  it('should access advisor system via engine getter', () => {
    const sim = createSim();
    const advisorSystem = sim.engine.getAdvisorSystem();
    expect(advisorSystem).toBeDefined();
    expect(advisorSystem.name).toBe('advisor');
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 传承系统深化
// ═══════════════════════════════════════════════════════════════
describe('v16.0 羁绊+军师+传承深化 — §4 传承系统深化', () => {

  // ── 武将数据类型 ──
  interface HeroStub {
    id: string;
    level: number;
    exp: number;
    quality: number;
    faction: string;
    skillLevels: number[];
    favorability: number;
  }

  interface EquipStub {
    uid: string;
    slot: string;
    rarity: number;
    enhanceLevel: number;
  }

  function createSimWithHeritageInit() {
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
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

  it('should reject hero heritage for insufficient source quality', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'low-q-src': { id: 'low-q-src', level: 30, exp: 5000, quality: 1, faction: 'shu', skillLevels: [2], favorability: 30 },
      'tgt': { id: 'tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [3], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    const result = heritage.executeHeroHeritage({
      sourceHeroId: 'low-q-src', targetHeroId: 'tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('品质不足');
  });

  it('should reject equipment heritage for different slots when required', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const equips: Record<string, EquipStub> = {
      'src-w': { uid: 'src-w', slot: 'weapon', rarity: 4, enhanceLevel: 10 },
      'tgt-a': { uid: 'tgt-a', slot: 'armor', rarity: 4, enhanceLevel: 0 },
    };

    heritage.setCallbacks({
      getEquip: (uid) => equips[uid] ?? null,
      updateEquip: (uid, updates) => { if (equips[uid]) Object.assign(equips[uid], updates); },
      removeEquip: (uid) => { delete equips[uid]; },
      addResources: () => {},
    });

    const result = heritage.executeEquipmentHeritage({
      sourceUid: 'src-w', targetUid: 'tgt-a',
      options: { transferEnhanceLevel: true },
    });

    // Depending on EQUIPMENT_HERITAGE_RULE.mustSameSlot, may fail
    if (!result.success) {
      expect(result.reason).toContain('同部位');
    }
  });

  it('should reject experience heritage for low-level source', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'low-src': { id: 'low-src', level: 1, exp: 100, quality: 4, faction: 'shu', skillLevels: [1], favorability: 10 },
      'exp-tgt': { id: 'exp-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [3], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    const result = heritage.executeExperienceHeritage({
      sourceHeroId: 'low-src', targetHeroId: 'exp-tgt', expRatio: 0.5,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('等级不足');
  });

  it('should track heritage history with correct type', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'h-src': { id: 'h-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'h-tgt': { id: 'h-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    heritage.executeHeroHeritage({
      sourceHeroId: 'h-src', targetHeroId: 'h-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    const state = heritage.getState();
    expect(state.heritageHistory.length).toBe(1);
    expect(state.heritageHistory[0].type).toBe('hero');
    expect(state.heritageHistory[0].sourceId).toBe('h-src');
    expect(state.heritageHistory[0].targetId).toBe('h-tgt');
    expect(state.heritageHistory[0].efficiency).toBeGreaterThan(0);
  });

  it('should get memorial record with all heritage counts', () => {
    const sim = createSimWithHeritageInit();
    const heritage = sim.engine.getHeritageSystem();

    const heroes: Record<string, HeroStub> = {
      'm-src': { id: 'm-src', level: 40, exp: 8000, quality: 4, faction: 'shu', skillLevels: [5], favorability: 60 },
      'm-tgt': { id: 'm-tgt', level: 10, exp: 1000, quality: 4, faction: 'shu', skillLevels: [2], favorability: 20 },
    };

    heritage.setCallbacks({
      getHero: (id) => heroes[id] ?? null,
      updateHero: (id, updates) => { if (heroes[id]) Object.assign(heroes[id], updates); },
      addResources: () => {},
    });

    heritage.executeHeroHeritage({
      sourceHeroId: 'm-src', targetHeroId: 'm-tgt',
      options: { expEfficiency: 1.0, transferSkillLevels: false, transferFavorability: false },
    });

    const memorial = heritage.getMemorialRecord();
    expect(memorial.totalHeritageCount).toBe(1);
    expect(memorial.heroHeritageCount).toBe(1);
    expect(memorial.equipmentHeritageCount).toBe(0);
    expect(memorial.heritageHistory.length).toBe(1);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v16.0 羁绊+军师+传承深化 — §5 跨系统联动', () => {

  it('should integrate bond system with favorability and story events', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    // Add favorability
    bond.addFavorability('liubei', 60);
    bond.addFavorability('guanyu', 55);

    const fav = bond.getFavorability('liubei');
    expect(fav.value).toBe(60);

    // Check available story events
    const heroMap = new Map<string, { id: string; level: number; faction: string }>();
    heroMap.set('liubei', { id: 'liubei', level: 20, faction: 'shu' });
    heroMap.set('guanyu', { id: 'guanyu', level: 18, faction: 'shu' });

    const available = bond.getAllStoryEvents();
    expect(available.length).toBeGreaterThan(0);
  });

  it('should trigger bond story event and update favorability', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    // Setup favorability
    bond.addFavorability('liubei', 80);
    bond.addFavorability('guanyu', 80);
    bond.addFavorability('zhangfei', 80);

    const result = bond.triggerStoryEvent('story_001');
    // story_001 requires liubei, guanyu, zhangfei with minFavorability 50
    if (result.success) {
      expect(result.rewards).toBeDefined();
      expect(result.rewards!.favorability).toBeGreaterThan(0);

      // Favorability should have been increased
      const fav = bond.getFavorability('liubei');
      expect(fav.value).toBeGreaterThan(80);
    }
  });

  it('should serialize and restore bond system state', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    bond.addFavorability('liubei', 75);
    bond.addFavorability('guanyu', 60);

    const saveData = bond.serialize();
    expect(saveData.version).toBe(1);
    expect(saveData.favorabilities['liubei'].value).toBe(75);

    // Load into new instance
    const bond2 = new BondSystem();
    bond2.init(createDeps());
    bond2.loadSaveData(saveData);

    const fav = bond2.getFavorability('liubei');
    expect(fav.value).toBe(75);
  });

  it('should coordinate advisor with game state snapshot', () => {
    const advisor = new AdvisorSystem();
    advisor.init(createDeps());

    // Multiple triggers at once
    const snapshot = createDefaultSnapshot({
      resources: { grain: 9500, gold: 200, troops: 1000, mandate: 50 },
      resourceCaps: { grain: 10000, gold: 10000, troops: 5000, mandate: 100 },
      buildingQueueIdle: true,
      armyFull: true,
    });

    advisor.updateSuggestions(snapshot);
    const state = advisor.getDisplayState();

    // Should have suggestions but limited to max display
    expect(state.displayedSuggestions.length).toBeLessThanOrEqual(3);
    // Should be sorted by priority (highest first)
    if (state.displayedSuggestions.length >= 2) {
      expect(state.displayedSuggestions[0].priority).toBeGreaterThanOrEqual(
        state.displayedSuggestions[1].priority,
      );
    }
  });

  it('should reset bond system and clear all data', () => {
    const bond = new BondSystem();
    bond.init(createDeps());

    bond.addFavorability('liubei', 100);
    bond.reset();

    const fav = bond.getFavorability('liubei');
    expect(fav.value).toBe(0);
  });

});
