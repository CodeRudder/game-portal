/**
 * HeroSerializer 补充边界测试 — 序列化性能、往返一致性、边界数据
 * 覆盖：大量武将序列化、空对象处理、属性完整保留、版本兼容、undefined 字段
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createEmptyState,
  cloneGeneral,
  cloneState,
  serializeHeroState,
  deserializeHeroState,
} from '../HeroSerializer';
import type { GeneralData, HeroState, HeroSaveData } from '../hero.types';
import { Quality } from '../hero.types';
import { HERO_SAVE_VERSION } from '../hero-config';

// ── 测试数据 ──

function makeTestGeneral(overrides: Partial<GeneralData> = {}): GeneralData {
  return {
    id: 'test-hero',
    name: '测试武将',
    quality: Quality.RARE,
    baseStats: { attack: 90, defense: 80, intelligence: 70, speed: 60 },
    level: 5,
    exp: 100,
    faction: 'shu',
    skills: [
      { id: 'skill_01', name: '技能一', type: 'active', level: 1, description: '测试技能1' },
      { id: 'skill_02', name: '技能二', type: 'passive', level: 2, description: '测试技能2' },
    ],
    ...overrides,
  };
}

function makeTestState(
  generals: Record<string, GeneralData> = {},
  fragments: Record<string, number> = {},
): HeroState {
  return { generals, fragments };
}

// ═══════════════════════════════════════════════════════════════
describe('HeroSerializer — 补充边界测试', () => {

  // ───────────────────────────────────────────
  // 1. createEmptyState 补充
  // ───────────────────────────────────────────
  describe('createEmptyState 边界', () => {
    it('返回的对象结构仅包含 generals 和 fragments', () => {
      const state = createEmptyState();
      const keys = Object.keys(state);
      expect(keys).toContain('generals');
      expect(keys).toContain('fragments');
      expect(keys.length).toBe(2);
    });

    it('多次调用返回独立的状态对象', () => {
      const s1 = createEmptyState();
      const s2 = createEmptyState();
      expect(s1).not.toBe(s2);
      expect(s1.generals).not.toBe(s2.generals);
      expect(s1.fragments).not.toBe(s2.fragments);
    });
  });

  // ───────────────────────────────────────────
  // 2. cloneGeneral 补充
  // ───────────────────────────────────────────
  describe('cloneGeneral 边界', () => {
    it('深拷贝不共享 baseStats 引用', () => {
      const original = makeTestGeneral();
      const cloned = cloneGeneral(original);

      // 修改 cloned 的 baseStats
      cloned.baseStats.defense = 999;
      cloned.baseStats.intelligence = 888;

      expect(original.baseStats.defense).toBe(80);
      expect(original.baseStats.intelligence).toBe(70);
    });

    it('深拷贝不共享 skills 数组引用', () => {
      const original = makeTestGeneral();
      const cloned = cloneGeneral(original);

      // 删除 cloned 的 skills 元素
      cloned.skills.length = 0;
      expect(original.skills).toHaveLength(2);
    });

    it('深拷贝不共享单个 skill 对象引用', () => {
      const original = makeTestGeneral();
      const cloned = cloneGeneral(original);

      cloned.skills[0].level = 99;
      cloned.skills[1].description = '被修改';

      expect(original.skills[0].level).toBe(1);
      expect(original.skills[1].description).toBe('测试技能2');
    });

    it('保留所有武将属性字段', () => {
      const original = makeTestGeneral({
        id: 'guanyu',
        name: '关羽',
        quality: Quality.LEGENDARY,
        level: 30,
        exp: 500,
        faction: 'shu',
      });
      const cloned = cloneGeneral(original);

      expect(cloned.id).toBe('guanyu');
      expect(cloned.name).toBe('关羽');
      expect(cloned.quality).toBe(Quality.LEGENDARY);
      expect(cloned.level).toBe(30);
      expect(cloned.exp).toBe(500);
      expect(cloned.faction).toBe('shu');
      expect(cloned.baseStats).toEqual(original.baseStats);
      expect(cloned.skills).toEqual(original.skills);
    });

    it('单技能武将正确拷贝', () => {
      const original = makeTestGeneral({
        skills: [{ id: 'only', name: '唯一技能', type: 'active', level: 3, description: 'desc' }],
      });
      const cloned = cloneGeneral(original);
      expect(cloned.skills).toHaveLength(1);
      expect(cloned.skills[0]).toEqual(original.skills[0]);
      expect(cloned.skills[0]).not.toBe(original.skills[0]);
    });
  });

  // ───────────────────────────────────────────
  // 3. cloneState 补充
  // ───────────────────────────────────────────
  describe('cloneState 边界', () => {
    it('空 generals 对象正确处理', () => {
      const state = makeTestState({}, {});
      const cloned = cloneState(state);
      expect(Object.keys(cloned.generals)).toHaveLength(0);
    });

    it('空 fragments 对象正确处理', () => {
      const state = makeTestState({}, {});
      const cloned = cloneState(state);
      expect(Object.keys(cloned.fragments)).toHaveLength(0);
    });

    it('只有 fragments 没有武将时正确拷贝', () => {
      const state = makeTestState({}, { hero1: 10, hero2: 20 });
      const cloned = cloneState(state);
      expect(cloned.fragments).toEqual({ hero1: 10, hero2: 20 });
      expect(cloned.fragments).not.toBe(state.fragments);
    });

    it('武将数量为 0 但 fragments 有数据', () => {
      const state = makeTestState(
        {},
        { a: 1, b: 2, c: 3, d: 4, e: 5 },
      );
      const cloned = cloneState(state);
      expect(Object.keys(cloned.generals)).toHaveLength(0);
      expect(Object.keys(cloned.fragments)).toHaveLength(5);
    });
  });

  // ───────────────────────────────────────────
  // 4. serializeHeroState 补充
  // ───────────────────────────────────────────
  describe('serializeHeroState 边界', () => {
    it('序列化后的数据是 JSON 安全的（可 JSON.stringify）', () => {
      const g = makeTestGeneral({ quality: Quality.EPIC });
      const state = makeTestState({ hero1: g }, { hero1: 15 });
      const data = serializeHeroState(state);

      // 不应抛出异常
      const json = JSON.stringify(data);
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(HERO_SAVE_VERSION);
      expect(parsed.state.generals.hero1.name).toBe('测试武将');
    });

    it('序列化大量武将性能合理（100个武将 < 50ms）', () => {
      const generals: Record<string, GeneralData> = {};
      for (let i = 0; i < 100; i++) {
        generals[`hero_${i}`] = makeTestGeneral({
          id: `hero_${i}`,
          name: `武将${i}`,
          level: i + 1,
        });
      }
      const fragments: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        fragments[`hero_${i}`] = i * 3;
      }
      const state = makeTestState(generals, fragments);

      const start = performance.now();
      const data = serializeHeroState(state);
      const elapsed = performance.now() - start;

      expect(Object.keys(data.state.generals)).toHaveLength(100);
      expect(Object.keys(data.state.fragments)).toHaveLength(100);
      expect(elapsed).toBeLessThan(50);
    });

    it('序列化版本号等于 HERO_SAVE_VERSION', () => {
      const state = createEmptyState();
      const data = serializeHeroState(state);
      expect(data.version).toBe(HERO_SAVE_VERSION);
    });
  });

  // ───────────────────────────────────────────
  // 5. deserializeHeroState 补充
  // ───────────────────────────────────────────
  describe('deserializeHeroState 边界', () => {
    it('反序列化后武将属性完整保留', () => {
      const g = makeTestGeneral({
        id: 'zhugeliang',
        name: '诸葛亮',
        quality: Quality.LEGENDARY,
        baseStats: { attack: 68, defense: 72, intelligence: 118, speed: 88 },
        level: 25,
        exp: 300,
        faction: 'shu',
        skills: [
          { id: 'zhugeliang_01', name: '空城计', type: 'active', level: 1, description: '策略伤害' },
          { id: 'zhugeliang_02', name: '卧龙', type: 'passive', level: 1, description: '护盾' },
        ],
      });
      const state = makeTestState({ zhugeliang: g }, { zhugeliang: 50 });
      const data = serializeHeroState(state);
      const restored = deserializeHeroState(data);

      const rg = restored.generals['zhugeliang'];
      expect(rg.id).toBe('zhugeliang');
      expect(rg.name).toBe('诸葛亮');
      expect(rg.quality).toBe(Quality.LEGENDARY);
      expect(rg.baseStats).toEqual({ attack: 68, defense: 72, intelligence: 118, speed: 88 });
      expect(rg.level).toBe(25);
      expect(rg.exp).toBe(300);
      expect(rg.faction).toBe('shu');
      expect(rg.skills).toHaveLength(2);
      expect(rg.skills[0].name).toBe('空城计');
    });

    it('反序列化缺失字段时仍返回有效状态', () => {
      // 使用空对象作为 generals 和 fragments
      const data: HeroSaveData = {
        version: HERO_SAVE_VERSION,
        state: { generals: {}, fragments: {} },
      };
      const restored = deserializeHeroState(data);
      expect(restored.generals).toEqual({});
      expect(restored.fragments).toEqual({});
    });

    it('反序列化结果与序列化输入独立（不共享引用）', () => {
      const g = makeTestGeneral();
      const data: HeroSaveData = {
        version: HERO_SAVE_VERSION,
        state: makeTestState({ hero: g }, { hero: 5 }),
      };
      const restored = deserializeHeroState(data);

      // 修改反序列化结果
      restored.generals['hero'].level = 99;
      restored.generals['hero'].baseStats.attack = 0;
      restored.fragments['hero'] = 0;

      // 原始数据不受影响
      expect(data.state.generals['hero'].level).toBe(5);
      expect(data.state.generals['hero'].baseStats.attack).toBe(90);
      expect(data.state.fragments['hero']).toBe(5);
    });
  });

  // ───────────────────────────────────────────
  // 6. serialize → deserialize 往返一致性
  // ───────────────────────────────────────────
  describe('往返一致性', () => {
    it('多品质武将往返一致性', () => {
      const generals: Record<string, GeneralData> = {
        common: makeTestGeneral({ id: 'common', quality: Quality.COMMON, level: 1 }),
        fine: makeTestGeneral({ id: 'fine', quality: Quality.FINE, level: 10 }),
        rare: makeTestGeneral({ id: 'rare', quality: Quality.RARE, level: 20 }),
        epic: makeTestGeneral({ id: 'epic', quality: Quality.EPIC, level: 30 }),
        legendary: makeTestGeneral({ id: 'legendary', quality: Quality.LEGENDARY, level: 40 }),
      };
      const fragments: Record<string, number> = {
        common: 5, fine: 10, rare: 20, epic: 40, legendary: 80,
      };
      const state = makeTestState(generals, fragments);

      const serialized = serializeHeroState(state);
      const restored = deserializeHeroState(serialized);

      // 验证所有武将
      for (const id of Object.keys(generals)) {
        expect(restored.generals[id]).toEqual(generals[id]);
      }
      expect(restored.fragments).toEqual(fragments);
    });

    it('JSON.stringify → JSON.parse 往返一致性', () => {
      const g = makeTestGeneral({ id: 'json_test', exp: 250 });
      const state = makeTestState({ json_test: g }, { json_test: 30 });
      const data = serializeHeroState(state);

      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);
      const restored = deserializeHeroState(parsed);

      expect(restored.generals['json_test']).toEqual(g);
      expect(restored.fragments['json_test']).toBe(30);
    });

    it('多次序列化反序列化结果稳定', () => {
      const g = makeTestGeneral();
      const state = makeTestState({ hero: g }, { hero: 10 });

      // 第一轮
      const r1 = deserializeHeroState(serializeHeroState(state));
      // 第二轮
      const r2 = deserializeHeroState(serializeHeroState(r1));
      // 第三轮
      const r3 = deserializeHeroState(serializeHeroState(r2));

      expect(r3.generals['hero']).toEqual(g);
      expect(r3.fragments['hero']).toBe(10);
    });
  });

  // ───────────────────────────────────────────
  // 7. 版本兼容性
  // ───────────────────────────────────────────
  describe('版本兼容性', () => {
    it('当前版本序列化反序列化无警告', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const state = createEmptyState();
      const data = serializeHeroState(state);
      deserializeHeroState(data);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('旧版本数据仍可反序列化（向前兼容）', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const data: HeroSaveData = {
        version: 0, // 旧版本
        state: createEmptyState(),
      };
      const restored = deserializeHeroState(data);
      // 应该仍然返回有效数据
      expect(restored.generals).toEqual({});
      expect(restored.fragments).toEqual({});
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
