/**
 * BondSystem — 武将羁绊系统测试
 *
 * 覆盖：
 *   #1 阵营羁绊效果 — 4种羁绊正确检测和激活
 *   #2 羁绊可视化 — 编队预览+属性加成
 *   #3 武将故事事件 — 好感度触发+奖励
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BondSystem } from '../BondSystem';
import type { GeneralData, Faction } from '../../hero/hero.types';
import { Quality } from '../../hero/hero.types';

// ─────────────────────────────────────────────
// Mock EventBus
// ─────────────────────────────────────────────

function createMockEventBus() {
  const listeners: Record<string, Function[]> = {};
  return {
    on: (event: string, cb: Function) => { (listeners[event] ??= []).push(cb); },
    emit: (event: string, payload?: unknown) => { (listeners[event] ?? []).forEach(cb => cb(payload)); },
    off: () => {},
  };
}

function createMockDeps() {
  return {
    eventBus: createMockEventBus() as any,
    config: { get: () => undefined } as any,
    registry: { get: () => null, has: () => false } as any,
  };
}

// ─────────────────────────────────────────────
// 辅助函数：创建武将
// ─────────────────────────────────────────────

function createHero(id: string, faction: Faction, level = 10): GeneralData {
  return {
    id,
    name: id,
    quality: Quality.RARE,
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
    level,
    exp: 0,
    faction,
    skills: [],
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BondSystem', () => {
  let system: BondSystem;

  beforeEach(() => {
    system = new BondSystem();
    system.init(createMockDeps());
  });

  // ── #1 阵营羁绊效果 ──

  describe('#1 阵营羁绊效果', () => {
    it('同乡之谊：2同阵营武将上阵', () => {
      const heroes = [
        createHero('liubei', 'shu'),
        createHero('guanyu', 'shu'),
      ];
      const bonds = system.detectActiveBonds(heroes);
      expect(bonds).toHaveLength(1);
      expect(bonds[0].type).toBe('faction_2');
      expect(bonds[0].faction).toBe('shu');
      expect(bonds[0].heroCount).toBe(2);
      expect(bonds[0].effect.bonuses.attack).toBe(0.05);
    });

    it('同仇敌忾：3同阵营武将上阵', () => {
      const heroes = [
        createHero('liubei', 'shu'),
        createHero('guanyu', 'shu'),
        createHero('zhangfei', 'shu'),
      ];
      const bonds = system.detectActiveBonds(heroes);
      expect(bonds).toHaveLength(1);
      expect(bonds[0].type).toBe('faction_3');
      expect(bonds[0].effect.bonuses.attack).toBe(0.15);
    });

    it('众志成城：6同阵营武将上阵', () => {
      const heroes = Array.from({ length: 6 }, (_, i) =>
        createHero(`shu_hero_${i}`, 'shu')
      );
      const bonds = system.detectActiveBonds(heroes);
      expect(bonds).toHaveLength(1);
      expect(bonds[0].type).toBe('faction_6');
      expect(bonds[0].effect.bonuses.attack).toBe(0.25);
      expect(bonds[0].effect.bonuses.defense).toBe(0.15);
    });

    it('混搭协作：3+3不同阵营武将上阵', () => {
      const heroes = [
        ...Array.from({ length: 3 }, (_, i) => createHero(`shu_${i}`, 'shu')),
        ...Array.from({ length: 3 }, (_, i) => createHero(`wei_${i}`, 'wei')),
      ];
      const bonds = system.detectActiveBonds(heroes);
      // 应该有混搭协作羁绊
      const mixedBond = bonds.find(b => b.type === 'mixed_3_3');
      expect(mixedBond).toBeDefined();
      expect(mixedBond!.effect.bonuses.attack).toBe(0.10);
      expect(mixedBond!.effect.bonuses.intelligence).toBe(0.05);
    });

    it('无羁绊：1个武将无法激活任何羁绊', () => {
      const heroes = [createHero('solo', 'shu')];
      const bonds = system.detectActiveBonds(heroes);
      expect(bonds).toHaveLength(0);
    });

    it('多阵营各2人：激活多个同乡之谊', () => {
      const heroes = [
        createHero('shu_1', 'shu'),
        createHero('shu_2', 'shu'),
        createHero('wei_1', 'wei'),
        createHero('wei_2', 'wei'),
      ];
      const bonds = system.detectActiveBonds(heroes);
      expect(bonds).toHaveLength(2);
      expect(bonds.every(b => b.type === 'faction_2')).toBe(true);
    });
  });

  // ── #2 羁绊可视化 ──

  describe('#2 羁绊可视化', () => {
    it('编队预览包含阵营分布', () => {
      const heroes = [
        createHero('shu_1', 'shu'),
        createHero('shu_2', 'shu'),
        createHero('wei_1', 'wei'),
      ];
      const preview = system.getFormationPreview('form_1', heroes);
      expect(preview.formationId).toBe('form_1');
      expect(preview.factionDistribution.shu).toBe(2);
      expect(preview.factionDistribution.wei).toBe(1);
    });

    it('编队预览包含激活羁绊和总加成', () => {
      const heroes = [
        createHero('shu_1', 'shu'),
        createHero('shu_2', 'shu'),
      ];
      const preview = system.getFormationPreview('form_1', heroes);
      expect(preview.activeBonds).toHaveLength(1);
      expect(preview.totalBonuses.attack).toBe(0.05);
    });

    it('编队预览包含潜在羁绊提示', () => {
      const heroes = [createHero('shu_1', 'shu')];
      const preview = system.getFormationPreview('form_1', heroes);
      const tip = preview.potentialBonds.find(t => t.suggestedFaction === 'shu');
      expect(tip).toBeDefined();
      expect(tip!.missingCount).toBe(1);
      expect(tip!.type).toBe('faction_2');
    });

    it('计算羁绊总加成正确', () => {
      const heroes = Array.from({ length: 6 }, (_, i) =>
        createHero(`shu_${i}`, 'shu')
      );
      const bonds = system.detectActiveBonds(heroes);
      const total = system.calculateTotalBondBonuses(bonds);
      expect(total.attack).toBe(0.25);
      expect(total.defense).toBe(0.15);
    });
  });

  // ── #3 武将故事事件 ──

  describe('#3 武将故事事件', () => {
    it('初始好感度为0', () => {
      const fav = system.getFavorability('liubei');
      expect(fav.value).toBe(0);
      expect(fav.triggeredEvents).toHaveLength(0);
    });

    it('增加好感度', () => {
      system.addFavorability('liubei', 30);
      const fav = system.getFavorability('liubei');
      expect(fav.value).toBe(30);
    });

    it('好感度不足时无法触发故事事件', () => {
      const heroes = new Map<string, GeneralData>();
      heroes.set('liubei', createHero('liubei', 'shu'));
      heroes.set('guanyu', createHero('guanyu', 'shu'));
      heroes.set('zhangfei', createHero('zhangfei', 'shu'));

      const available = system.getAvailableStoryEvents(heroes);
      // 好感度为0，不应有可用事件
      expect(available).toHaveLength(0);
    });

    it('好感度足够时可以触发故事事件', () => {
      system.addFavorability('liubei', 60);
      system.addFavorability('guanyu', 60);
      system.addFavorability('zhangfei', 60);

      const heroes = new Map<string, GeneralData>();
      heroes.set('liubei', createHero('liubei', 'shu', 10));
      heroes.set('guanyu', createHero('guanyu', 'shu', 10));
      heroes.set('zhangfei', createHero('zhangfei', 'shu', 10));

      const available = system.getAvailableStoryEvents(heroes);
      expect(available.length).toBeGreaterThan(0);
      expect(available[0].title).toBe('桃园结义');
    });

    it('触发故事事件后获得奖励', () => {
      system.addFavorability('liubei', 60);
      system.addFavorability('guanyu', 60);
      system.addFavorability('zhangfei', 60);

      const result = system.triggerStoryEvent('story_001');
      expect(result.success).toBe(true);
      expect(result.rewards).toBeDefined();
      expect(result.rewards!.prestigePoints).toBe(100);
    });

    it('不可重复触发的故事事件只能触发一次', () => {
      system.addFavorability('liubei', 60);
      system.addFavorability('guanyu', 60);
      system.addFavorability('zhangfei', 60);

      const first = system.triggerStoryEvent('story_001');
      expect(first.success).toBe(true);

      const second = system.triggerStoryEvent('story_001');
      expect(second.success).toBe(false);
      expect(second.reason).toBe('事件已完成');
    });
  });

  // ── 序列化 ──

  describe('序列化', () => {
    it('序列化和反序列化保持一致', () => {
      system.addFavorability('liubei', 50);
      system.triggerStoryEvent('story_001');

      const data = system.serialize();
      const newSystem = new BondSystem();
      newSystem.init(createMockDeps());
      newSystem.loadSaveData(data);

      expect(newSystem.getFavorability('liubei').value).toBe(70); // 50 + 20 from event
    });
  });

  // ── 生命周期 ──

  describe('生命周期', () => {
    it('reset 清除所有状态', () => {
      system.addFavorability('liubei', 50);
      system.reset();
      expect(system.getFavorability('liubei').value).toBe(0);
    });
  });
});
