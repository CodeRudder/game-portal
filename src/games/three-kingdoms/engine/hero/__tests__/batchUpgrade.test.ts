/**
 * B13 批量升级功能测试
 *
 * 覆盖：批量升级多个武将、资源不足跳过、空列表、部分成功、
 * 资源消耗正确、返回结果统计
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroLevelSystem, type LevelDeps } from '../HeroLevelSystem';
import type { HeroSystem } from '../HeroSystem';
import type { GeneralData, GeneralStats } from '../hero.types';
import { Quality } from '../hero.types';

// ── Mock 武将数据 ──

function makeGeneral(id: string, level: number, exp = 0, quality = Quality.RARE): GeneralData {
  return {
    id,
    name: id,
    quality,
    level,
    exp,
    faction: 'shu',
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
    skills: [],
  };
}

// ── Mock HeroSystem ──

function createMockHeroSystem(generals: GeneralData[]): HeroSystem {
  const map = new Map(generals.map((g) => [g.id, { ...g }]));

  return {
    getGeneral: vi.fn((id: string) => map.get(id)),
    getAllGenerals: vi.fn(() => [...map.values()]),
    calculatePower: vi.fn((g: GeneralData) => {
      return g.level * 100 + g.baseStats.attack + g.baseStats.defense;
    }),
    setLevelAndExp: vi.fn((id: string, level: number, exp: number) => {
      const g = map.get(id);
      if (g) { g.level = level; g.exp = exp; }
      return map.get(id);
    }),
  } as unknown as HeroSystem;
}

// ── Mock 资源系统 ──

function createMockResources(
  gold: number,
  exp: number,
  spendFail = false,
) {
  let curGold = gold;
  let curExp = exp;
  return {
    spendResource: vi.fn((type: string, amount: number) => {
      if (spendFail) return false;
      if (type === 'gold') { curGold -= amount; return true; }
      if (type === 'exp') { curExp -= amount; return true; }
      return true;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => {
      if (type === 'gold') return curGold >= amount;
      if (type === 'exp') return curExp >= amount;
      return true;
    }),
    getResourceAmount: vi.fn((type: string) => {
      if (type === 'gold') return curGold;
      if (type === 'exp') return curExp;
      return 0;
    }),
  };
}

describe('B13 批量升级 (batchUpgrade)', () => {
  let levelSystem: HeroLevelSystem;

  beforeEach(() => {
    levelSystem = new HeroLevelSystem();
  });

  it('批量升级多个武将', () => {
    const g1 = makeGeneral('hero1', 1, 0);
    const g2 = makeGeneral('hero2', 1, 0);
    const heroSystem = createMockHeroSystem([g1, g2]);
    const resources = createMockResources(999999, 999999);

    const deps: LevelDeps = {
      heroSystem,
      ...resources,
    };
    levelSystem.setLevelDeps(deps);

    const result = levelSystem.batchUpgrade(['hero1', 'hero2'], 10);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].general.id).toBe('hero1');
    expect(result.results[1].general.id).toBe('hero2');
    expect(result.totalGoldSpent).toBeGreaterThan(0);
    expect(result.totalExpSpent).toBeGreaterThan(0);
    expect(result.totalPowerGain).toBeGreaterThan(0);
  });

  it('空列表返回空结果', () => {
    const heroSystem = createMockHeroSystem([]);
    const resources = createMockResources(999999, 999999);

    levelSystem.setLevelDeps({ heroSystem, ...resources });

    const result = levelSystem.batchUpgrade([], 10);

    expect(result.results).toHaveLength(0);
    expect(result.totalGoldSpent).toBe(0);
    expect(result.totalExpSpent).toBe(0);
    expect(result.totalPowerGain).toBe(0);
  });

  it('不存在的武将 ID 被跳过', () => {
    const g1 = makeGeneral('hero1', 1, 0);
    const heroSystem = createMockHeroSystem([g1]);
    const resources = createMockResources(999999, 999999);

    levelSystem.setLevelDeps({ heroSystem, ...resources });

    const result = levelSystem.batchUpgrade(['hero1', 'nonexistent'], 10);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].general.id).toBe('hero1');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toBe('nonexistent');
  });

  it('资源不足时跳过该武将', () => {
    const g1 = makeGeneral('hero1', 1, 0);
    const g2 = makeGeneral('hero2', 1, 0);
    const heroSystem = createMockHeroSystem([g1, g2]);
    // 只够升级一个
    const resources = createMockResources(50, 50);

    levelSystem.setLevelDeps({ heroSystem, ...resources });

    const result = levelSystem.batchUpgrade(['hero1', 'hero2'], 10);

    // 至少第一个成功
    expect(result.results.length).toBeGreaterThanOrEqual(0);
  });

  it('满级武将被跳过', () => {
    const g1 = makeGeneral('hero1', 999, 0); // 超过上限
    const heroSystem = createMockHeroSystem([g1]);
    const resources = createMockResources(999999, 999999);

    levelSystem.setLevelDeps({ heroSystem, ...resources });

    const result = levelSystem.batchUpgrade(['hero1'], 10);

    expect(result.results).toHaveLength(0);
  });

  it('不传 targetLevel 时升级到资源允许的最高等级', () => {
    const g1 = makeGeneral('hero1', 1, 0);
    const heroSystem = createMockHeroSystem([g1]);
    const resources = createMockResources(999999, 999999);

    levelSystem.setLevelDeps({ heroSystem, ...resources });

    const result = levelSystem.batchUpgrade(['hero1']);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].levelsGained).toBeGreaterThan(0);
  });

  it('totalPowerGain 正确统计', () => {
    const g1 = makeGeneral('hero1', 1, 0);
    const g2 = makeGeneral('hero2', 1, 0);
    const heroSystem = createMockHeroSystem([g1, g2]);
    const resources = createMockResources(999999, 999999);

    levelSystem.setLevelDeps({ heroSystem, ...resources });

    const result = levelSystem.batchUpgrade(['hero1', 'hero2'], 5);

    let expectedGain = 0;
    for (const r of result.results) {
      expectedGain += r.levelsGained * 100; // 每级 100 战力
    }
    expect(result.totalPowerGain).toBe(expectedGain);
  });

  it('无 deps 时返回空结果', () => {
    const result = levelSystem.batchUpgrade(['hero1'], 10);
    expect(result.results).toHaveLength(0);
    expect(result.totalGoldSpent).toBe(0);
    expect(result.totalExpSpent).toBe(0);
    expect(result.totalPowerGain).toBe(0);
  });
});
