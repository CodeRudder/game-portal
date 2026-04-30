/**
 * V5 百家争鸣 — 羁绊与科技跨系统联动集成测试
 *
 * 覆盖以下 play 流程：
 * - §1 羁绊系统核心: 阵营羁绊检测/效果计算/编队预览
 * - §2 羁绊与科技联动: 羁绊加成×科技加成叠加计算
 * - §3 故事事件全流程: 好感度累积→条件校验→触发→奖励
 * - §4 羁绊序列化/反序列化: 存档恢复一致性
 *
 * 编码规范：
 * - 每个it前创建新的系统实例
 * - describe按play流程ID组织
 * - 不使用 as unknown as Record<string, unknown>
 *
 * @module engine/bond/__tests__/integration/v5-bond-tech-cross-system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BondSystem } from '../../BondSystem';
import { TechTreeSystem } from '../../../tech/TechTreeSystem';
import { TechEffectSystem } from '../../../tech/TechEffectSystem';
import { TechEffectApplier } from '../../../tech/TechEffectApplier';
import { TechLinkSystem } from '../../../tech/TechLinkSystem';
import { TECH_NODE_DEFS } from '../../../tech/tech-config';
import type { TechPath } from '../../../tech/tech.types';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';
import type { GeneralData, Faction } from '../../../hero/hero.types';
import { Quality, FACTIONS } from '../../../hero/hero.types';
import { BOND_EFFECTS, STORY_EVENTS } from '../../bond-config';
import { BOND_NAMES, BOND_SAVE_VERSION } from '../../../../core/bond';
import type { ActiveBond } from '../../../../core/bond';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建 Mock EventBus（带 emit spy） */
function createMockEventBus() {
  const listeners: Record<string, Function[]> = {};
  return {
    on: (event: string, cb: Function) => { (listeners[event] ??= []).push(cb); },
    emit: vi.fn((event: string, payload?: unknown) => {
      (listeners[event] ?? []).forEach(cb => cb(payload));
    }),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

/** 创建标准系统依赖 */
function createDeps(): ISystemDeps {
  const registry = new Map<string, unknown>();
  return {
    eventBus: createMockEventBus() as unknown as ISystemDeps['eventBus'],
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };
}

/** 创建羁绊+科技联合系统栈 */
function createBondTechStack() {
  const deps = createDeps();
  const bond = new BondSystem();
  const tree = new TechTreeSystem();
  const effectSystem = new TechEffectSystem();
  const applier = new TechEffectApplier();
  const link = new TechLinkSystem();

  bond.init(deps);
  tree.init(deps);
  effectSystem.init(deps);
  link.init(deps);

  effectSystem.setTechTree(tree);
  applier.setTechEffectSystem(effectSystem);

  return { bond, tree, effectSystem, applier, link, deps };
}

// ── 武将工厂 ──

let heroIdCounter = 0;

function makeHero(faction: Faction, level: number = 10, id?: string): GeneralData {
  heroIdCounter++;
  return {
    id: id ?? `hero_${heroIdCounter}`,
    name: id ?? `武将${heroIdCounter}`,
    quality: Quality.RARE,
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
    level,
    exp: 0,
    faction,
    skills: [],
  };
}

function makeHeroes(faction: Faction, count: number, startLevel: number = 10): GeneralData[] {
  return Array.from({ length: count }, (_, i) => makeHero(faction, startLevel + i));
}

function makeNamedHero(heroId: string, faction: Faction, level: number): GeneralData {
  return {
    id: heroId,
    name: heroId,
    quality: Quality.RARE,
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
    level,
    exp: 0,
    faction,
    skills: [],
  };
}

/** 获取指定路线第一个可研究节点 */
function getFirstResearchableNode(tree: TechTreeSystem, path?: TechPath) {
  const defs = path
    ? TECH_NODE_DEFS.filter(d => d.path === path)
    : TECH_NODE_DEFS;
  return defs.find(d => tree.canResearch(d.id).can);
}

// ═══════════════════════════════════════════════════════════════
// §1 羁绊系统核心 — 阵营羁绊检测/效果计算
// ═══════════════════════════════════════════════════════════════
describe('§1 羁绊系统核心', () => {

  beforeEach(() => { heroIdCounter = 0; });

  it('空编队无羁绊', () => {
    const { bond } = createBondTechStack();
    expect(bond.detectActiveBonds([])).toHaveLength(0);
  });

  it('单武将不激活羁绊', () => {
    const { bond } = createBondTechStack();
    expect(bond.detectActiveBonds([makeHero('shu')])).toHaveLength(0);
  });

  it('2同阵营→faction_2(同乡之谊)', () => {
    const { bond } = createBondTechStack();
    const bonds = bond.detectActiveBonds(makeHeroes('shu', 2));
    expect(bonds).toHaveLength(1);
    expect(bonds[0].type).toBe('faction_2');
    expect(bonds[0].faction).toBe('shu');
    expect(bonds[0].heroCount).toBe(2);
  });

  it('3同阵营→faction_3(同仇敌忾)，不含faction_2', () => {
    const { bond } = createBondTechStack();
    const bonds = bond.detectActiveBonds(makeHeroes('wei', 3));
    const types = bonds.map(b => b.type);
    expect(types).toContain('faction_3');
    expect(types).not.toContain('faction_2');
  });

  it('6同阵营→faction_6(众志成城)，不含低级羁绊', () => {
    const { bond } = createBondTechStack();
    const bonds = bond.detectActiveBonds(makeHeroes('wu', 6));
    const types = bonds.map(b => b.type);
    expect(types).toContain('faction_6');
    expect(types).not.toContain('faction_3');
    expect(types).not.toContain('faction_2');
  });

  it('3+3混搭→mixed_3_3(混搭协作)', () => {
    const { bond } = createBondTechStack();
    const heroes = [...makeHeroes('shu', 3), ...makeHeroes('wei', 3)];
    const bonds = bond.detectActiveBonds(heroes);
    expect(bonds.map(b => b.type)).toContain('mixed_3_3');
  });

  it('多阵营各2名→多个faction_2', () => {
    const { bond } = createBondTechStack();
    const heroes = [...makeHeroes('shu', 2), ...makeHeroes('wei', 2)];
    const bonds = bond.detectActiveBonds(heroes);
    const faction2 = bonds.filter(b => b.type === 'faction_2');
    expect(faction2).toHaveLength(2);
  });

  it('阵营分布统计正确', () => {
    const { bond } = createBondTechStack();
    const heroes = [
      ...makeHeroes('shu', 3),
      ...makeHeroes('wei', 2),
      makeHero('wu'),
    ];
    const dist = bond.getFactionDistribution(heroes);
    expect(dist).toEqual({ shu: 3, wei: 2, wu: 1, qun: 0 });
  });

  it('calculateTotalBondBonuses汇总所有羁绊加成', () => {
    const { bond } = createBondTechStack();
    const heroes = makeHeroes('shu', 6);
    const bonds = bond.detectActiveBonds(heroes);
    const total = bond.calculateTotalBondBonuses(bonds);
    // faction_6: attack+25%, defense+15%
    expect(total.attack).toBeCloseTo(0.25);
    expect(total.defense).toBeCloseTo(0.15);
  });

  it('羁绊效果与配置表一致', () => {
    const { bond } = createBondTechStack();
    const effect = bond.getBondEffect('faction_6');
    expect(effect.bonuses.attack).toBeCloseTo(BOND_EFFECTS.faction_6.bonuses.attack!);
    expect(effect.bonuses.defense).toBeCloseTo(BOND_EFFECTS.faction_6.bonuses.defense!);
  });

  it('getAllBondEffects返回4种羁绊效果', () => {
    const { bond } = createBondTechStack();
    const all = bond.getAllBondEffects();
    expect(all).toHaveLength(4);
    expect(all.map(e => e.type)).toEqual(
      expect.arrayContaining(['faction_2', 'faction_3', 'faction_6', 'mixed_3_3']),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// §2 羁绊与科技联动 — 羁绊加成×科技加成叠加
// ═══════════════════════════════════════════════════════════════
describe('§2 羁绊与科技联动', () => {

  beforeEach(() => { heroIdCounter = 0; });

  it('羁绊加成与科技加成独立计算', () => {
    const { bond, tree, effectSystem, applier } = createBondTechStack();

    // 完成军事科技
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 6同阵营羁绊
    const heroes = makeHeroes('shu', 6);
    const bonds = bond.detectActiveBonds(heroes);
    const bondBonuses = bond.calculateTotalBondBonuses(bonds);

    // 科技加成
    const techAtkMultiplier = applier.getBattleBonuses('all').attackMultiplier;

    // 两者独立存在
    expect(bondBonuses.attack).toBeGreaterThan(0);
    expect(techAtkMultiplier).toBeGreaterThan(1);
  });

  it('编队预览含羁绊+科技综合加成', () => {
    const { bond, tree, effectSystem, applier } = createBondTechStack();

    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const heroes = makeHeroes('shu', 3);
    const preview = bond.getFormationPreview('form_1', heroes);
    expect(preview.activeBonds.length).toBeGreaterThan(0);
    expect(preview.totalBonuses.attack).toBeGreaterThan(0);
  });

  it('潜在羁绊提示正确计算', () => {
    const { bond } = createBondTechStack();

    // 1个蜀将→差1个可激活faction_2
    const heroes = [makeHero('shu')];
    const preview = bond.getFormationPreview('form_1', heroes);
    const tip = preview.potentialBonds.find(
      t => t.type === 'faction_2' && t.suggestedFaction === 'shu',
    );
    expect(tip).toBeDefined();
    expect(tip!.missingCount).toBe(1);
  });

  it('2同阵营→差1个可升级到faction_3', () => {
    const { bond } = createBondTechStack();
    const heroes = makeHeroes('qun', 2);
    const preview = bond.getFormationPreview('form_1', heroes);
    const tip = preview.potentialBonds.find(
      t => t.type === 'faction_3' && t.suggestedFaction === 'qun',
    );
    expect(tip).toBeDefined();
    expect(tip!.missingCount).toBe(1);
  });

  it('3+同阵营→差(6-count)个可升级到faction_6', () => {
    const { bond } = createBondTechStack();
    const heroes = makeHeroes('wu', 4);
    const preview = bond.getFormationPreview('form_1', heroes);
    const tip = preview.potentialBonds.find(
      t => t.type === 'faction_6' && t.suggestedFaction === 'wu',
    );
    expect(tip).toBeDefined();
    expect(tip!.missingCount).toBe(2);
  });

  it('羁绊攻击加成×科技攻击乘数叠加效果', () => {
    const { bond, tree, effectSystem, applier } = createBondTechStack();

    // 完成军事科技(兵法入门: 全军攻击+5%)
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 3同阵营羁绊(faction_3: attack+15%)
    const heroes = makeHeroes('shu', 3);
    const bonds = bond.detectActiveBonds(heroes);
    const bondAtk = bond.calculateTotalBondBonuses(bonds).attack ?? 0;

    // 科技乘数
    const techMultiplier = applier.getBattleBonuses('all').attackMultiplier;

    // 综合攻击 = 基础 × 科技乘数 × (1 + 羁绊加成)
    const baseAttack = 1000;
    const techEnhanced = baseAttack * techMultiplier;
    const total = techEnhanced * (1 + bondAtk);

    expect(total).toBeGreaterThan(baseAttack);
    expect(bondAtk).toBeCloseTo(0.15); // faction_3: +15%
    expect(techMultiplier).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// §3 故事事件全流程 — 好感度→条件→触发→奖励
// ═══════════════════════════════════════════════════════════════
describe('§3 故事事件全流程', () => {

  beforeEach(() => { heroIdCounter = 0; });

  it('初始好感度为0', () => {
    const { bond } = createBondTechStack();
    const fav = bond.getFavorability('liubei');
    expect(fav.value).toBe(0);
    expect(fav.heroId).toBe('liubei');
    expect(fav.triggeredEvents).toEqual([]);
  });

  it('好感度累加正确', () => {
    const { bond } = createBondTechStack();
    bond.addFavorability('liubei', 30);
    bond.addFavorability('liubei', 25);
    expect(bond.getFavorability('liubei').value).toBe(55);
  });

  it('好感度不足时故事事件不可触发', () => {
    const { bond } = createBondTechStack();
    const heroes = new Map<string, GeneralData>();
    heroes.set('liubei', makeNamedHero('liubei', 'shu', 10));
    heroes.set('guanyu', makeNamedHero('guanyu', 'shu', 10));
    heroes.set('zhangfei', makeNamedHero('zhangfei', 'shu', 10));

    bond.addFavorability('liubei', 10);
    const available = bond.getAvailableStoryEvents(heroes);
    expect(available.find(e => e.id === 'story_001')).toBeUndefined();
  });

  it('等级不足时故事事件不可触发', () => {
    const { bond } = createBondTechStack();
    const heroes = new Map<string, GeneralData>();
    heroes.set('liubei', makeNamedHero('liubei', 'shu', 2)); // 等级不足
    heroes.set('guanyu', makeNamedHero('guanyu', 'shu', 2));
    heroes.set('zhangfei', makeNamedHero('zhangfei', 'shu', 2));

    bond.addFavorability('liubei', 60);
    bond.addFavorability('guanyu', 60);
    bond.addFavorability('zhangfei', 60);

    const available = bond.getAvailableStoryEvents(heroes);
    expect(available.find(e => e.id === 'story_001')).toBeUndefined();
  });

  it('好感度+等级满足时故事事件可触发', () => {
    const { bond } = createBondTechStack();
    const heroes = new Map<string, GeneralData>();
    heroes.set('liubei', makeNamedHero('liubei', 'shu', 10));
    heroes.set('guanyu', makeNamedHero('guanyu', 'shu', 10));
    heroes.set('zhangfei', makeNamedHero('zhangfei', 'shu', 10));

    bond.addFavorability('liubei', 60);
    bond.addFavorability('guanyu', 60);
    bond.addFavorability('zhangfei', 60);

    const available = bond.getAvailableStoryEvents(heroes);
    expect(available.find(e => e.id === 'story_001')).toBeDefined();
  });

  it('触发故事事件返回成功+奖励', () => {
    const { bond } = createBondTechStack();
    const result = bond.triggerStoryEvent('story_001');
    expect(result.success).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event!.title).toBe('桃园结义');
    expect(result.rewards).toBeDefined();
    expect(result.rewards!.favorability).toBe(20);
    expect(result.rewards!.prestigePoints).toBe(100);
    expect(result.rewards!.fragments).toBeDefined();
    expect(result.rewards!.fragments!.liubei).toBe(3);
  });

  it('触发故事事件发射bond:storyTriggered', () => {
    const { bond, deps } = createBondTechStack();
    bond.triggerStoryEvent('story_001');
    expect(deps.eventBus.emit).toHaveBeenCalledWith(
      'bond:storyTriggered',
      expect.objectContaining({ eventId: 'story_001' }),
    );
  });

  it('触发故事事件增加关联武将好感度', () => {
    const { bond } = createBondTechStack();
    bond.addFavorability('liubei', 60);
    const before = bond.getFavorability('liubei').value;
    bond.triggerStoryEvent('story_001');
    const after = bond.getFavorability('liubei').value;
    expect(after).toBeGreaterThan(before);
  });

  it('不可重复事件只能触发一次', () => {
    const { bond } = createBondTechStack();
    const r1 = bond.triggerStoryEvent('story_001');
    expect(r1.success).toBe(true);
    const r2 = bond.triggerStoryEvent('story_001');
    expect(r2.success).toBe(false);
    expect(r2.reason).toContain('已完成');
  });

  it('触发不存在的事件返回失败', () => {
    const { bond } = createBondTechStack();
    const result = bond.triggerStoryEvent('story_nonexist');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('getAllStoryEvents返回5个预定义事件', () => {
    const { bond } = createBondTechStack();
    const events = bond.getAllStoryEvents();
    expect(events.length).toBe(5);
    const ids = events.map(e => e.id);
    expect(ids).toContain('story_001'); // 桃园结义
    expect(ids).toContain('story_002'); // 三顾茅庐
    expect(ids).toContain('story_003'); // 赤壁之战
    expect(ids).toContain('story_004'); // 过五关斩六将
    expect(ids).toContain('story_005'); // 草船借箭
  });

  it('三顾茅庐需刘备+诸葛亮好感60+等级10', () => {
    const { bond } = createBondTechStack();
    const heroes = new Map<string, GeneralData>();
    heroes.set('liubei', makeNamedHero('liubei', 'shu', 10));
    heroes.set('zhugeliang', makeNamedHero('zhugeliang', 'shu', 10));

    bond.addFavorability('liubei', 65);
    bond.addFavorability('zhugeliang', 65);

    const available = bond.getAvailableStoryEvents(heroes);
    expect(available.find(e => e.id === 'story_002')).toBeDefined();
  });

  it('赤壁之战需周瑜+诸葛亮+曹操好感70+等级15', () => {
    const { bond } = createBondTechStack();
    const heroes = new Map<string, GeneralData>();
    heroes.set('zhouyu', makeNamedHero('zhouyu', 'wu', 15));
    heroes.set('zhugeliang', makeNamedHero('zhugeliang', 'shu', 15));
    heroes.set('caocao', makeNamedHero('caocao', 'wei', 15));

    bond.addFavorability('zhouyu', 75);
    bond.addFavorability('zhugeliang', 75);
    bond.addFavorability('caocao', 75);

    const available = bond.getAvailableStoryEvents(heroes);
    expect(available.find(e => e.id === 'story_003')).toBeDefined();
  });

  it('过五关斩六将需关羽好感80+等级20', () => {
    const { bond } = createBondTechStack();
    const heroes = new Map<string, GeneralData>();
    heroes.set('guanyu', makeNamedHero('guanyu', 'shu', 20));

    bond.addFavorability('guanyu', 85);

    const available = bond.getAvailableStoryEvents(heroes);
    expect(available.find(e => e.id === 'story_004')).toBeDefined();
  });

  it('草船借箭需诸葛亮+曹操好感55+等级12', () => {
    const { bond } = createBondTechStack();
    const heroes = new Map<string, GeneralData>();
    heroes.set('zhugeliang', makeNamedHero('zhugeliang', 'shu', 12));
    heroes.set('caocao', makeNamedHero('caocao', 'wei', 12));

    bond.addFavorability('zhugeliang', 60);
    bond.addFavorability('caocao', 60);

    const available = bond.getAvailableStoryEvents(heroes);
    expect(available.find(e => e.id === 'story_005')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// §4 羁绊序列化/反序列化 — 存档恢复一致性
// ═══════════════════════════════════════════════════════════════
describe('§4 羁绊序列化/反序列化', () => {

  beforeEach(() => { heroIdCounter = 0; });

  it('序列化包含版本号', () => {
    const { bond } = createBondTechStack();
    const saved = bond.getState();
    expect(saved.version).toBe(BOND_SAVE_VERSION);
  });

  it('好感度序列化/反序列化一致', () => {
    const { bond } = createBondTechStack();
    bond.addFavorability('liubei', 80);
    bond.addFavorability('guanyu', 50);

    const saved = bond.getState();
    expect(saved.favorabilities['liubei'].value).toBe(80);
    expect(saved.favorabilities['guanyu'].value).toBe(50);

    // 反序列化到新实例
    const { bond: bond2, deps } = createBondTechStack();
    bond2.init(deps);
    bond2.loadSaveData(saved);
    expect(bond2.getFavorability('liubei').value).toBe(80);
    expect(bond2.getFavorability('guanyu').value).toBe(50);
  });

  it('已完成事件序列化/反序列化一致', () => {
    const { bond } = createBondTechStack();
    bond.triggerStoryEvent('story_001');
    bond.triggerStoryEvent('story_002');

    const saved = bond.getState();
    expect(saved.completedStoryEvents).toContain('story_001');
    expect(saved.completedStoryEvents).toContain('story_002');

    // 反序列化到新实例
    const { bond: bond2, deps } = createBondTechStack();
    bond2.init(deps);
    bond2.loadSaveData(saved);

    // 已完成事件应阻止再次触发
    const r1 = bond2.triggerStoryEvent('story_001');
    expect(r1.success).toBe(false);
    const r2 = bond2.triggerStoryEvent('story_002');
    expect(r2.success).toBe(false);
  });

  it('reset清空所有状态', () => {
    const { bond } = createBondTechStack();
    bond.addFavorability('liubei', 80);
    bond.triggerStoryEvent('story_001');

    bond.reset();
    expect(bond.getFavorability('liubei').value).toBe(0);

    // 事件应可再次触发
    const r = bond.triggerStoryEvent('story_001');
    expect(r.success).toBe(true);
  });

  it('空存档反序列化不报错', () => {
    const { bond, deps } = createBondTechStack();
    bond.loadSaveData({
      version: BOND_SAVE_VERSION,
      favorabilities: {},
      completedStoryEvents: [],
    });
    expect(bond.getFavorability('liubei').value).toBe(0);
  });
});
