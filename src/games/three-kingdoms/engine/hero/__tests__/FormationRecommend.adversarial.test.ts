/**
 * R2 Adversarial Test — 推荐系统P1补充
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FormationRecommendSystem } from '../FormationRecommendSystem';
import type { GeneralData } from '../hero.types';

function makeGeneral(id: string, power: number, faction: string = 'shu'): GeneralData {
  return {
    id, name: id, faction, quality: 'EPIC' as const,
    level: 1, exp: 0,
    baseStats: { attack: power, defense: power, intelligence: power, speed: power },
    skills: [], isUnlocked: true, unlockTime: Date.now(),
  };
}

describe('FormationRecommendSystem — R2 Adversarial P1', () => {
  let system: FormationRecommendSystem;

  beforeEach(() => {
    system = new FormationRecommendSystem();
  });

  it('should handle negative power values', () => {
    const heroes = [
      makeGeneral('h1', -100),
      makeGeneral('h2', 200),
      makeGeneral('h3', 300),
    ];

    const result = system.recommend('normal', heroes, (g) => g.baseStats.attack);
    expect(result.plans.length).toBeGreaterThan(0);
    if (result.plans[0]) {
      expect(result.plans[0].heroIds[0]).not.toBe('h1');
    }
  });

  it('should handle heroes with empty faction string', () => {
    const heroes = [
      makeGeneral('h1', 100, ''),
      makeGeneral('h2', 200, ''),
      makeGeneral('h3', 300, ''),
      makeGeneral('h4', 400, 'shu'),
    ];

    const result = system.recommend('normal', heroes, (g) => g.baseStats.attack);
    expect(result.plans.length).toBeGreaterThan(0);
  });

  it('should handle single hero against very high difficulty', () => {
    const heroes = [makeGeneral('h1', 100)];

    const result = system.recommend('boss', heroes, (g) => g.baseStats.attack, 99999, 6);
    expect(result.plans.length).toBe(1);
    expect(result.plans[0].estimatedPower).toBe(100);
    expect(result.plans[0].score).toBeLessThan(50);
  });

  it('should handle null heroes in list', () => {
    const heroes = [null, makeGeneral('h1', 100), undefined, makeGeneral('h2', 200)] as unknown as GeneralData[];

    const result = system.recommend('normal', heroes, (g) => g.baseStats.attack);
    expect(result.plans.length).toBeGreaterThan(0);
  });

  it('should handle calculatePower returning NaN', () => {
    const heroes = [makeGeneral('h1', 100), makeGeneral('h2', 200)];

    const result = system.recommend('normal', heroes, (g) => NaN);
    expect(result.plans.length).toBeGreaterThan(0);
  });
});
