/**
 * R2 Adversarial Test — 战斗布阵补充
 */

import { describe, it, expect } from 'vitest';
import { autoFormation } from '../autoFormation';
import type { BattleUnit } from '../battle.types';

function makeUnit(id: string, defense: number, hp: number, attack: number = 50, alive: boolean = true): BattleUnit {
  return {
    id,
    name: id,
    level: 1,
    maxHp: hp,
    currentHp: hp,
    attack,
    defense,
    intelligence: 50,
    speed: 50,
    skills: [],
    position: 'front',
    isAlive: alive,
    side: 'ally' as const,
    buffIds: [],
    debuffIds: [],
    cooldowns: {},
  };
}

describe('autoFormation (battle) — R2 Adversarial', () => {
  it('should return empty result when all units are dead', () => {
    const units = [
      makeUnit('u1', 100, 1000, 50, false),
      makeUnit('u2', 80, 800, 60, false),
      makeUnit('u3', 60, 600, 70, false),
    ];

    const result = autoFormation(units);
    expect(result.frontLine).toHaveLength(0);
    expect(result.backLine).toHaveLength(0);
    expect(result.score).toBe(0);
    expect(result.team.units).toHaveLength(0);
  });

  it('should handle single alive unit among dead ones', () => {
    const units = [
      makeUnit('u1', 100, 1000, 50, false),
      makeUnit('u2', 80, 800, 60, true),
      makeUnit('u3', 60, 600, 70, false),
    ];

    const result = autoFormation(units);
    expect(result.frontLine).toHaveLength(1);
    expect(result.backLine).toHaveLength(0);
    expect(result.frontLine[0]).toBe('u2');
  });

  it('should not modify original unit positions', () => {
    const units = [
      makeUnit('u1', 100, 1000),
      makeUnit('u2', 80, 800),
    ];
    const originalPositions = units.map(u => u.position);

    autoFormation(units);

    expect(units[0].position).toBe(originalPositions[0]);
    expect(units[1].position).toBe(originalPositions[1]);
  });

  it('should handle exactly 6 alive units', () => {
    const units = Array.from({ length: 8 }, (_, i) =>
      makeUnit(`u${i}`, 100 - i * 10, 1000 - i * 100, 50 + i * 10, i < 6)
    );

    const result = autoFormation(units);
    expect(result.team.units).toHaveLength(6);
    expect(result.frontLine).toHaveLength(3);
    expect(result.backLine).toHaveLength(3);
  });
});
