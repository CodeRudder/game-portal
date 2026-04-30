/**
 * battle-helpers 测试 — 战斗辅助函数
 *
 * 覆盖：
 *   1. getAliveUnits / getAliveFrontUnits / getAliveBackUnits
 *   2. sortBySpeed — 速度排序 + ID稳定排序
 *   3. getEnemyTeam / getAllyTeam
 *   4. findUnitInTeam / findUnit
 *   5. 边界：空队伍、全灭队伍、混合前后排
 */

import { describe, it, expect } from 'vitest';
import {
  getAliveUnits,
  getAliveFrontUnits,
  getAliveBackUnits,
  sortBySpeed,
  getEnemyTeam,
  getAllyTeam,
  findUnitInTeam,
  findUnit,
} from '../battle-helpers';
import type { BattleTeam, BattleState, BattleUnit } from '../battle.types';
import { BattlePhase } from '../battle.types';

// ── 辅助 ──

function makeUnit(overrides: Partial<BattleUnit> & { id: string }): BattleUnit {
  return {
    name: overrides.id,
    faction: 'wei',
    troopType: 'INFANTRY',
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 30,
    speed: 50,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: {
      id: 'atk', name: '普攻', type: 'active', level: 1,
      description: '', multiplier: 1.0, targetType: 'SINGLE_ENEMY',
      rageCost: 0, cooldown: 0, currentCooldown: 0,
    },
    skills: [],
    buffs: [],
    ...overrides,
  };
}

function makeTeam(units: BattleUnit[], side: 'ally' | 'enemy' = 'ally'): BattleTeam {
  return { units, side };
}

function makeState(allyUnits: BattleUnit[], enemyUnits: BattleUnit[]): BattleState {
  return {
    id: 'test-battle',
    phase: BattlePhase.IN_PROGRESS,
    currentTurn: 1,
    maxTurns: 10,
    allyTeam: makeTeam(allyUnits, 'ally'),
    enemyTeam: makeTeam(enemyUnits, 'enemy'),
    turnOrder: [],
    currentActorIndex: 0,
    actionLog: [],
    result: null,
  };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('getAliveUnits', () => {
  it('should return only alive units', () => {
    const team = makeTeam([
      makeUnit({ id: 'a', isAlive: true }),
      makeUnit({ id: 'b', isAlive: false }),
      makeUnit({ id: 'c', isAlive: true }),
    ]);
    const alive = getAliveUnits(team);
    expect(alive).toHaveLength(2);
    expect(alive.map((u) => u.id)).toEqual(['a', 'c']);
  });

  it('should return empty array for all-dead team', () => {
    const team = makeTeam([
      makeUnit({ id: 'a', isAlive: false }),
      makeUnit({ id: 'b', isAlive: false }),
    ]);
    expect(getAliveUnits(team)).toEqual([]);
  });

  it('should return empty array for empty team', () => {
    expect(getAliveUnits(makeTeam([]))).toEqual([]);
  });

  it('should return all units if all alive', () => {
    const team = makeTeam([
      makeUnit({ id: 'a' }),
      makeUnit({ id: 'b' }),
    ]);
    expect(getAliveUnits(team)).toHaveLength(2);
  });
});

describe('getAliveFrontUnits', () => {
  it('should return only alive front-row units', () => {
    const team = makeTeam([
      makeUnit({ id: 'f1', position: 'front', isAlive: true }),
      makeUnit({ id: 'b1', position: 'back', isAlive: true }),
      makeUnit({ id: 'f2', position: 'front', isAlive: false }),
    ]);
    const front = getAliveFrontUnits(team);
    expect(front).toHaveLength(1);
    expect(front[0].id).toBe('f1');
  });

  it('should return empty if all front units are dead', () => {
    const team = makeTeam([
      makeUnit({ id: 'f1', position: 'front', isAlive: false }),
      makeUnit({ id: 'b1', position: 'back', isAlive: true }),
    ]);
    expect(getAliveFrontUnits(team)).toEqual([]);
  });
});

describe('getAliveBackUnits', () => {
  it('should return only alive back-row units', () => {
    const team = makeTeam([
      makeUnit({ id: 'f1', position: 'front', isAlive: true }),
      makeUnit({ id: 'b1', position: 'back', isAlive: true }),
      makeUnit({ id: 'b2', position: 'back', isAlive: false }),
    ]);
    const back = getAliveBackUnits(team);
    expect(back).toHaveLength(1);
    expect(back[0].id).toBe('b1');
  });

  it('should return empty if all back units are dead', () => {
    const team = makeTeam([
      makeUnit({ id: 'f1', position: 'front', isAlive: true }),
      makeUnit({ id: 'b1', position: 'back', isAlive: false }),
    ]);
    expect(getAliveBackUnits(team)).toEqual([]);
  });
});

describe('sortBySpeed', () => {
  it('should sort by speed descending', () => {
    const units = [
      makeUnit({ id: 'slow', speed: 30 }),
      makeUnit({ id: 'fast', speed: 100 }),
      makeUnit({ id: 'mid', speed: 60 }),
    ];
    const sorted = sortBySpeed(units);
    expect(sorted.map((u) => u.id)).toEqual(['fast', 'mid', 'slow']);
  });

  it('should sort by ID lexicographically when speed is equal', () => {
    const units = [
      makeUnit({ id: 'charlie', speed: 50 }),
      makeUnit({ id: 'alpha', speed: 50 }),
      makeUnit({ id: 'bravo', speed: 50 }),
    ];
    const sorted = sortBySpeed(units);
    expect(sorted.map((u) => u.id)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('should not mutate original array', () => {
    const units = [
      makeUnit({ id: 'slow', speed: 30 }),
      makeUnit({ id: 'fast', speed: 100 }),
    ];
    const originalOrder = units.map((u) => u.id);
    sortBySpeed(units);
    expect(units.map((u) => u.id)).toEqual(originalOrder);
  });

  it('should return empty array for empty input', () => {
    expect(sortBySpeed([])).toEqual([]);
  });

  it('should handle single element', () => {
    const units = [makeUnit({ id: 'only', speed: 50 })];
    const sorted = sortBySpeed(units);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe('only');
  });
});

describe('getEnemyTeam', () => {
  it('should return enemyTeam when side is ally', () => {
    const state = makeState(
      [makeUnit({ id: 'ally1', side: 'ally' })],
      [makeUnit({ id: 'enemy1', side: 'enemy' })],
    );
    const enemy = getEnemyTeam(state, 'ally');
    expect(enemy.side).toBe('enemy');
    expect(enemy.units[0].id).toBe('enemy1');
  });

  it('should return allyTeam when side is enemy', () => {
    const state = makeState(
      [makeUnit({ id: 'ally1', side: 'ally' })],
      [makeUnit({ id: 'enemy1', side: 'enemy' })],
    );
    const ally = getEnemyTeam(state, 'enemy');
    expect(ally.side).toBe('ally');
    expect(ally.units[0].id).toBe('ally1');
  });
});

describe('getAllyTeam', () => {
  it('should return allyTeam when side is ally', () => {
    const state = makeState(
      [makeUnit({ id: 'ally1', side: 'ally' })],
      [makeUnit({ id: 'enemy1', side: 'enemy' })],
    );
    expect(getAllyTeam(state, 'ally').side).toBe('ally');
  });

  it('should return enemyTeam when side is enemy', () => {
    const state = makeState(
      [makeUnit({ id: 'ally1', side: 'ally' })],
      [makeUnit({ id: 'enemy1', side: 'enemy' })],
    );
    expect(getAllyTeam(state, 'enemy').side).toBe('enemy');
  });
});

describe('findUnitInTeam', () => {
  it('should find unit by id', () => {
    const team = makeTeam([
      makeUnit({ id: 'u1' }),
      makeUnit({ id: 'u2' }),
    ]);
    expect(findUnitInTeam(team, 'u1')?.id).toBe('u1');
  });

  it('should return undefined for missing unit', () => {
    const team = makeTeam([makeUnit({ id: 'u1' })]);
    expect(findUnitInTeam(team, 'nonexistent')).toBeUndefined();
  });

  it('should return first match for duplicate ids', () => {
    const team = makeTeam([
      makeUnit({ id: 'dup' }),
      makeUnit({ id: 'dup' }),
    ]);
    const found = findUnitInTeam(team, 'dup');
    expect(found).toBeDefined();
  });
});

describe('findUnit', () => {
  it('should find unit in allyTeam', () => {
    const state = makeState(
      [makeUnit({ id: 'ally1', side: 'ally' })],
      [makeUnit({ id: 'enemy1', side: 'enemy' })],
    );
    expect(findUnit(state, 'ally1')?.id).toBe('ally1');
  });

  it('should find unit in enemyTeam', () => {
    const state = makeState(
      [makeUnit({ id: 'ally1', side: 'ally' })],
      [makeUnit({ id: 'enemy1', side: 'enemy' })],
    );
    expect(findUnit(state, 'enemy1')?.id).toBe('enemy1');
  });

  it('should return undefined for unknown unit', () => {
    const state = makeState(
      [makeUnit({ id: 'ally1' })],
      [makeUnit({ id: 'enemy1' })],
    );
    expect(findUnit(state, 'nonexistent')).toBeUndefined();
  });

  it('should prefer allyTeam over enemyTeam for same id', () => {
    const state = makeState(
      [makeUnit({ id: 'shared', side: 'ally' })],
      [makeUnit({ id: 'shared', side: 'enemy' })],
    );
    const found = findUnit(state, 'shared');
    expect(found?.side).toBe('ally');
  });
});
