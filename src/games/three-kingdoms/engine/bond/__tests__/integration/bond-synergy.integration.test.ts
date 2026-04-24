/**
 * 集成测试 — §1 武将羁绊（阵营羁绊 + 可视化 + 好感度故事事件）
 *
 * 覆盖：
 *   §1.1 阵营羁绊检测 — 2同/3同/6同/3+3混搭
 *   §1.2 羁绊可视化 — 编队预览/潜在提示/属性加成汇总
 *   §1.3 好感度触发故事事件 — 好感度累积/条件校验/事件触发/不可重复
 *
 * @integration v16.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BondSystem } from '../../BondSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { GeneralData, Faction } from '../../../hero/hero.types';
import { Quality, FACTIONS } from '../../../hero/hero.types';
import { BOND_EFFECTS, STORY_EVENTS } from '../../bond-config';
import { BOND_NAMES, BOND_SAVE_VERSION } from '../../../../core/bond';
import type { ActiveBond, FormationBondPreview, HeroFavorability } from '../../../../core/bond';

// ─────────────────────────────────────────────
// Mock 基础设施
// ─────────────────────────────────────────────

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

function createMockDeps(): ISystemDeps {
  return {
    eventBus: createMockEventBus() as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

// ─────────────────────────────────────────────
// 武将工厂
// ─────────────────────────────────────────────

let heroIdCounter = 0;

function makeHero(faction: Faction, level: number = 10, name?: string): GeneralData {
  heroIdCounter++;
  return {
    id: name ?? `hero_${heroIdCounter}`,
    name: name ?? `武将${heroIdCounter}`,
    quality: Quality.RARE,
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
    level,
    exp: 0,
    faction,
    skills: [],
  };
}

/** 批量生成同阵营武将 */
function makeHeroes(faction: Faction, count: number, startLevel: number = 10): GeneralData[] {
  return Array.from({ length: count }, (_, i) => makeHero(faction, startLevel + i));
}

/** 生成指定武将（按名称映射） */
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

// ═══════════════════════════════════════════════
// §1.1 阵营羁绊检测
// ═══════════════════════════════════════════════

describe('§1 武将羁绊系统', () => {
  let bond: BondSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    heroIdCounter = 0;
    bond = new BondSystem();
    deps = createMockDeps();
    bond.init(deps);
  });

  describe('§1.1 阵营羁绊检测', () => {
    it('空编队不激活任何羁绊', () => {
      const bonds = bond.detectActiveBonds([]);
      expect(bonds).toHaveLength(0);
    });

    it('单武将不激活羁绊', () => {
      const bonds = bond.detectActiveBonds([makeHero('shu')]);
      expect(bonds).toHaveLength(0);
    });

    it('2名同阵营激活"同乡之谊"(faction_2)', () => {
      const heroes = makeHeroes('shu', 2);
      const bonds = bond.detectActiveBonds(heroes);
      expect(bonds).toHaveLength(1);
      expect(bonds[0].type).toBe('faction_2');
      expect(bonds[0].faction).toBe('shu');
      expect(bonds[0].heroCount).toBe(2);
      expect(bonds[0].effect.bonuses).toHaveProperty('attack');
    });

    it('3名同阵营激活"同仇敌忾"(faction_3)，不激活faction_2', () => {
      const heroes = makeHeroes('wei', 3);
      const bonds = bond.detectActiveBonds(heroes);
      const types = bonds.map(b => b.type);
      expect(types).toContain('faction_3');
      expect(types).not.toContain('faction_2');
      expect(bonds.find(b => b.type === 'faction_3')!.heroCount).toBe(3);
    });

    it('6名同阵营激活"众志成城"(faction_6)，不激活低级羁绊', () => {
      const heroes = makeHeroes('wu', 6);
      const bonds = bond.detectActiveBonds(heroes);
      const types = bonds.map(b => b.type);
      expect(types).toContain('faction_6');
      expect(types).not.toContain('faction_3');
      expect(types).not.toContain('faction_2');
    });

    it('3+3混搭不同阵营激活"混搭协作"(mixed_3_3)', () => {
      const heroes = [...makeHeroes('shu', 3), ...makeHeroes('wei', 3)];
      const bonds = bond.detectActiveBonds(heroes);
      const types = bonds.map(b => b.type);
      expect(types).toContain('mixed_3_3');
    });

    it('多阵营各2名激活多个faction_2', () => {
      const heroes = [
        ...makeHeroes('shu', 2),
        ...makeHeroes('wei', 2),
      ];
      const bonds = bond.detectActiveBonds(heroes);
      const faction2Bonds = bonds.filter(b => b.type === 'faction_2');
      expect(faction2Bonds).toHaveLength(2);
    });

    it('阵营分布统计正确', () => {
      const heroes = [
        ...makeHeroes('shu', 3),
        ...makeHeroes('wei', 2),
        makeHero('wu'),
      ];
      const dist = bond.getFactionDistribution(heroes);
      expect(dist.shu).toBe(3);
      expect(dist.wei).toBe(2);
      expect(dist.wu).toBe(1);
      expect(dist.qun).toBe(0);
    });

    it('羁绊效果加成值与配置表一致', () => {
      const heroes = makeHeroes('shu', 6);
      const bonds = bond.detectActiveBonds(heroes);
      const bond6 = bonds.find(b => b.type === 'faction_6');
      expect(bond6).toBeDefined();
      expect(bond6!.effect.bonuses.attack).toBeCloseTo(BOND_EFFECTS.faction_6.bonuses.attack!);
      expect(bond6!.effect.bonuses.defense).toBeCloseTo(BOND_EFFECTS.faction_6.bonuses.defense!);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.2 羁绊可视化
  // ═══════════════════════════════════════════════

  describe('§1.2 羁绊可视化', () => {
    it('编队预览包含激活羁绊和阵营分布', () => {
      const heroes = makeHeroes('shu', 3);
      const preview = bond.getFormationPreview('form_1', heroes);
      expect(preview.formationId).toBe('form_1');
      expect(preview.activeBonds.length).toBeGreaterThan(0);
      expect(preview.factionDistribution.shu).toBe(3);
    });

    it('编队预览总加成为所有激活羁绊之和', () => {
      const heroes = [...makeHeroes('shu', 3), ...makeHeroes('wei', 2)];
      const preview = bond.getFormationPreview('form_2', heroes);
      // faction_3(shu) + faction_2(wei)
      const bondTypes = preview.activeBonds.map(b => b.type);
      expect(bondTypes).toContain('faction_3');
      expect(bondTypes).toContain('faction_2');
      expect(preview.totalBonuses).toBeDefined();
    });

    it('潜在羁绊提示：差1名同阵营可激活faction_2', () => {
      const heroes = [makeHero('shu')];
      const preview = bond.getFormationPreview('form_3', heroes);
      expect(preview.potentialBonds.length).toBeGreaterThan(0);
      const tip = preview.potentialBonds.find(t => t.type === 'faction_2' && t.suggestedFaction === 'shu');
      expect(tip).toBeDefined();
      expect(tip!.missingCount).toBe(1);
    });

    it('潜在羁绊提示：差1名可从faction_2升级到faction_3', () => {
      const heroes = makeHeroes('qun', 2);
      const preview = bond.getFormationPreview('form_4', heroes);
      const tip = preview.potentialBonds.find(t => t.type === 'faction_3' && t.suggestedFaction === 'qun');
      expect(tip).toBeDefined();
      expect(tip!.missingCount).toBe(1);
    });

    it('空编队预览无激活羁绊', () => {
      const preview = bond.getFormationPreview('form_empty', []);
      expect(preview.activeBonds).toHaveLength(0);
      expect(preview.totalBonuses).toEqual({});
    });

    it('getBondEffect/getAllBondEffects查询羁绊效果定义', () => {
      const effect = bond.getBondEffect('faction_3');
      expect(effect.type).toBe('faction_3');
      expect(effect.name).toBe(BOND_NAMES.faction_3);
      const all = bond.getAllBondEffects();
      expect(all).toHaveLength(4);
      const types = all.map(e => e.type);
      expect(types).toContain('faction_2');
      expect(types).toContain('mixed_3_3');
    });
  });

  // ═══════════════════════════════════════════════
  // §1.3 好感度触发故事事件
  // ═══════════════════════════════════════════════

  describe('§1.3 好感度触发故事事件', () => {
    it('初始好感度为0', () => {
      const fav = bond.getFavorability('liubei');
      expect(fav.value).toBe(0);
      expect(fav.heroId).toBe('liubei');
    });

    it('增加好感度后值正确累加', () => {
      bond.addFavorability('liubei', 30);
      bond.addFavorability('liubei', 20);
      expect(bond.getFavorability('liubei').value).toBe(50);
    });

    it('好感度不足时故事事件不可触发', () => {
      const heroes = new Map<string, GeneralData>();
      heroes.set('liubei', makeNamedHero('liubei', 'shu', 10));
      heroes.set('guanyu', makeNamedHero('guanyu', 'shu', 10));
      heroes.set('zhangfei', makeNamedHero('zhangfei', 'shu', 10));
      // 好感度不足50
      bond.addFavorability('liubei', 10);
      const available = bond.getAvailableStoryEvents(heroes);
      expect(available.find(e => e.id === 'story_001')).toBeUndefined();
    });

    it('好感度满足+等级满足时故事事件可触发', () => {
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
      const result = bond.triggerStoryEvent('story_001');
      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event!.title).toBe('桃园结义');
      expect(result.rewards).toBeDefined();
      expect(result.rewards!.prestigePoints).toBe(100);
    });

    it('触发故事事件后发射bond:storyTriggered事件并增加好感度', () => {
      bond.addFavorability('liubei', 60);
      const beforeLiu = bond.getFavorability('liubei').value;
      bond.triggerStoryEvent('story_001');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'bond:storyTriggered',
        expect.objectContaining({ eventId: 'story_001' }),
      );
      const afterLiu = bond.getFavorability('liubei').value;
      expect(afterLiu).toBeGreaterThan(beforeLiu);
    });

    it('不可重复的故事事件只能触发一次', () => {
      const r1 = bond.triggerStoryEvent('story_001');
      expect(r1.success).toBe(true);
      const r2 = bond.triggerStoryEvent('story_001');
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('已完成');
    });

    it('触发不存在的事件返回失败', () => {
      const result = bond.triggerStoryEvent('story_nonexist');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('序列化/反序列化保持好感度和已完成事件', () => {
      bond.addFavorability('liubei', 80);
      bond.triggerStoryEvent('story_001');
      const saved = bond.getState();
      expect(saved.version).toBe(BOND_SAVE_VERSION);
      expect(saved.favorabilities['liubei'].value).toBeGreaterThan(0);
      expect(saved.completedStoryEvents).toContain('story_001');
    });

    it('getAllStoryEvents返回预定义事件列表', () => {
      const events = bond.getAllStoryEvents();
      expect(events.length).toBeGreaterThanOrEqual(5);
      const ids = events.map(e => e.id);
      expect(ids).toContain('story_001');
      expect(ids).toContain('story_002');
    });
  });
});
