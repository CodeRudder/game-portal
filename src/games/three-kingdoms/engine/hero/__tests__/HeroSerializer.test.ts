/**
 * HeroSerializer 单元测试 — 序列化/反序列化/深拷贝
 * 覆盖：createEmptyState、cloneGeneral、cloneState、serializeHeroState、deserializeHeroState
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { HeroSystem } from '../HeroSystem';

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

function makeTestState(generals: Record<string, GeneralData> = {}, fragments: Record<string, number> = {}): HeroState {
  return { generals, fragments };
}

// ═══════════════════════════════════════════════════════════════
describe('HeroSerializer', () => {

  // ───────────────────────────────────────────
  // 1. createEmptyState
  // ───────────────────────────────────────────
  describe('createEmptyState', () => {
    it('返回空的武将系统状态', () => {
      const state = createEmptyState();
      expect(state.generals).toEqual({});
      expect(state.fragments).toEqual({});
    });

    it('返回的 generals 和 fragments 是独立对象', () => {
      const state = createEmptyState();
      state.generals['test'] = makeTestGeneral();
      state.fragments['test'] = 10;

      const state2 = createEmptyState();
      expect(state2.generals).toEqual({});
      expect(state2.fragments).toEqual({});
    });
  });

  // ───────────────────────────────────────────
  // 2. cloneGeneral
  // ───────────────────────────────────────────
  describe('cloneGeneral', () => {
    it('深拷贝武将数据', () => {
      const original = makeTestGeneral();
      const cloned = cloneGeneral(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it('深拷贝 baseStats 是独立的', () => {
      const original = makeTestGeneral();
      const cloned = cloneGeneral(original);

      cloned.baseStats.attack = 999;
      expect(original.baseStats.attack).toBe(90);
    });

    it('深拷贝 skills 是独立的数组', () => {
      const original = makeTestGeneral();
      const cloned = cloneGeneral(original);

      cloned.skills.push({ id: 'new', name: '新技能', type: 'active', level: 1, description: '' });
      expect(original.skills).toHaveLength(2);
    });

    it('深拷贝 skills 中每个元素是独立的', () => {
      const original = makeTestGeneral();
      const cloned = cloneGeneral(original);

      cloned.skills[0].name = '修改后';
      expect(original.skills[0].name).toBe('技能一');
    });

    it('空技能列表正确拷贝', () => {
      const original = makeTestGeneral({ skills: [] });
      const cloned = cloneGeneral(original);
      expect(cloned.skills).toEqual([]);
      expect(cloned.skills).not.toBe(original.skills);
    });
  });

  // ───────────────────────────────────────────
  // 3. cloneState
  // ───────────────────────────────────────────
  describe('cloneState', () => {
    it('深拷贝空状态', () => {
      const state = createEmptyState();
      const cloned = cloneState(state);
      expect(cloned).toEqual(state);
    });

    it('深拷贝包含武将的状态', () => {
      const g = makeTestGeneral();
      const state = makeTestState({ 'test-hero': g }, { 'test-hero': 5 });
      const cloned = cloneState(state);

      expect(cloned.generals['test-hero']).toEqual(g);
      expect(cloned.generals['test-hero']).not.toBe(g);
      expect(cloned.fragments['test-hero']).toBe(5);
    });

    it('修改克隆状态不影响原始状态', () => {
      const g = makeTestGeneral();
      const state = makeTestState({ 'test-hero': g }, { 'test-hero': 5 });
      const cloned = cloneState(state);

      cloned.generals['test-hero'].level = 99;
      cloned.fragments['test-hero'] = 999;
      delete cloned.generals['test-hero'];

      expect(state.generals['test-hero'].level).toBe(5);
      expect(state.fragments['test-hero']).toBe(5);
      expect(state.generals['test-hero']).toBeDefined();
    });

    it('深拷贝多个武将的状态', () => {
      const g1 = makeTestGeneral({ id: 'hero1', name: '武将1' });
      const g2 = makeTestGeneral({ id: 'hero2', name: '武将2', quality: Quality.EPIC });
      const state = makeTestState(
        { hero1: g1, hero2: g2 },
        { hero1: 10, hero2: 20 },
      );
      const cloned = cloneState(state);

      expect(Object.keys(cloned.generals)).toHaveLength(2);
      expect(cloned.generals.hero1.name).toBe('武将1');
      expect(cloned.generals.hero2.quality).toBe(Quality.EPIC);
      expect(cloned.fragments).toEqual({ hero1: 10, hero2: 20 });
    });

    it('fragments 是独立的对象', () => {
      const state = makeTestState({}, { hero1: 5 });
      const cloned = cloneState(state);
      cloned.fragments['hero2'] = 10;
      expect(state.fragments['hero2']).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────
  // 4. serializeHeroState
  // ───────────────────────────────────────────
  describe('serializeHeroState', () => {
    it('返回包含版本号和状态的存档数据', () => {
      const state = createEmptyState();
      const data = serializeHeroState(state);

      expect(data.version).toBe(HERO_SAVE_VERSION);
      expect(data.state).toBeDefined();
      expect(data.state.generals).toEqual({});
      expect(data.state.fragments).toEqual({});
    });

    it('序列化的状态是深拷贝', () => {
      const g = makeTestGeneral();
      const state = makeTestState({ 'test-hero': g });
      const data = serializeHeroState(state);

      data.state.generals['test-hero'].level = 99;
      expect(state.generals['test-hero'].level).toBe(5);
    });

    it('与 HeroSystem.serialize 一致', () => {
      const hs = new HeroSystem();
      hs.addGeneral('guanyu');
      hs.addFragment('guanyu', 10);

      const directData = serializeHeroState({
        generals: Object.fromEntries(
          hs.getAllGenerals().map((g) => [g.id, g]),
        ),
        fragments: { ...hs.getAllFragments() },
      });
      const systemData = hs.serialize();

      expect(directData.version).toBe(systemData.version);
      expect(Object.keys(directData.state.generals)).toEqual(
        Object.keys(systemData.state.generals),
      );
    });
  });

  // ───────────────────────────────────────────
  // 5. deserializeHeroState
  // ───────────────────────────────────────────
  describe('deserializeHeroState', () => {
    it('反序列化空存档数据', () => {
      const data: HeroSaveData = {
        version: HERO_SAVE_VERSION,
        state: createEmptyState(),
      };
      const state = deserializeHeroState(data);
      expect(state.generals).toEqual({});
      expect(state.fragments).toEqual({});
    });

    it('反序列化恢复武将数据', () => {
      const g = makeTestGeneral();
      const originalState = makeTestState({ 'test-hero': g }, { 'test-hero': 5 });
      const data = serializeHeroState(originalState);
      const restored = deserializeHeroState(data);

      expect(restored.generals['test-hero']).toEqual(g);
      expect(restored.fragments['test-hero']).toBe(5);
    });

    it('反序列化结果与原始状态独立', () => {
      const g = makeTestGeneral();
      const data: HeroSaveData = {
        version: HERO_SAVE_VERSION,
        state: makeTestState({ 'test-hero': g }),
      };
      const restored = deserializeHeroState(data);

      restored.generals['test-hero'].level = 99;
      expect(data.state.generals['test-hero'].level).toBe(5);
    });

    it('版本不匹配时打印警告', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const data: HeroSaveData = {
        version: 999,
        state: createEmptyState(),
      };
      deserializeHeroState(data);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('序列化→反序列化往返一致性', () => {
      const hs = new HeroSystem();
      hs.addGeneral('guanyu');
      hs.addGeneral('liubei');
      hs.addFragment('guanyu', 30);

      const data = hs.serialize();
      const hs2 = new HeroSystem();
      hs2.deserialize(data);

      const data2 = hs2.serialize();
      expect(Object.keys(data2.state.generals)).toEqual(
        Object.keys(data.state.generals),
      );
      expect(data2.state.fragments).toEqual(data.state.fragments);
    });
  });
});
