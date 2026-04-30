/**
 * BattleTargetSelector 测试 — 目标选择辅助
 *
 * 覆盖：
 *   1. selectTargets — 所有目标类型（SINGLE_ENEMY/FRONT_ROW/BACK_ROW/ALL_ENEMY/SELF/SINGLE_ALLY/ALL_ALLY）
 *   2. selectSingleTarget — 优先前排
 *   3. selectFrontRowTargets — 前排优先，无前排回退后排
 *   4. selectBackRowTargets — 后排优先，无后排回退前排
 *   5. 边界：全灭队伍、空队伍、混合前后排
 */

import { describe, it, expect } from 'vitest';
import {
  selectTargets,
  selectSingleTarget,
  selectFrontRowTargets,
  selectBackRowTargets,
} from '../BattleTargetSelector';
import { SkillTargetType } from '../battle-base.types';
import type { BattleState, BattleUnit, BattleTeam, BattleSkill } from '../battle.types';
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

function makeSkill(targetType: SkillTargetType): BattleSkill {
  return {
    id: 'skill1',
    name: 'Test Skill',
    type: 'active',
    level: 1,
    description: '',
    multiplier: 1.5,
    targetType,
    rageCost: 30,
    cooldown: 2,
    currentCooldown: 0,
  };
}

function makeState(allyUnits: BattleUnit[], enemyUnits: BattleUnit[]): BattleState {
  return {
    id: 'test',
    phase: BattlePhase.IN_PROGRESS,
    currentTurn: 1,
    maxTurns: 10,
    allyTeam: { units: allyUnits, side: 'ally' },
    enemyTeam: { units: enemyUnits, side: 'enemy' },
    turnOrder: [],
    currentActorIndex: 0,
    actionLog: [],
    result: null,
  };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('selectTargets', () => {
  const allyActor = makeUnit({ id: 'actor', side: 'ally', isAlive: true });

  it('should select single enemy target with SINGLE_ENEMY', () => {
    const enemy = makeUnit({ id: 'enemy1', side: 'enemy', position: 'front' });
    const state = makeState([allyActor], [enemy]);
    const targets = selectTargets(state, allyActor, makeSkill(SkillTargetType.SINGLE_ENEMY));
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('enemy1');
  });

  it('should select front row targets with FRONT_ROW', () => {
    const enemies = [
      makeUnit({ id: 'f1', side: 'enemy', position: 'front' }),
      makeUnit({ id: 'b1', side: 'enemy', position: 'back' }),
    ];
    const state = makeState([allyActor], enemies);
    const targets = selectTargets(state, allyActor, makeSkill(SkillTargetType.FRONT_ROW));
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('f1');
  });

  it('should select back row targets with BACK_ROW', () => {
    const enemies = [
      makeUnit({ id: 'f1', side: 'enemy', position: 'front' }),
      makeUnit({ id: 'b1', side: 'enemy', position: 'back' }),
    ];
    const state = makeState([allyActor], enemies);
    const targets = selectTargets(state, allyActor, makeSkill(SkillTargetType.BACK_ROW));
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('b1');
  });

  it('should select all alive enemies with ALL_ENEMY', () => {
    const enemies = [
      makeUnit({ id: 'e1', side: 'enemy', isAlive: true }),
      makeUnit({ id: 'e2', side: 'enemy', isAlive: true }),
      makeUnit({ id: 'e3', side: 'enemy', isAlive: false }),
    ];
    const state = makeState([allyActor], enemies);
    const targets = selectTargets(state, allyActor, makeSkill(SkillTargetType.ALL_ENEMY));
    expect(targets).toHaveLength(2);
  });

  it('should select self with SELF', () => {
    const state = makeState([allyActor], []);
    const targets = selectTargets(state, allyActor, makeSkill(SkillTargetType.SELF));
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('actor');
  });

  it('should return empty for SELF when actor is dead', () => {
    const deadActor = makeUnit({ id: 'dead', side: 'ally', isAlive: false });
    const state = makeState([deadActor], []);
    const targets = selectTargets(state, deadActor, makeSkill(SkillTargetType.SELF));
    expect(targets).toEqual([]);
  });

  it('should select lowest HP ratio ally with SINGLE_ALLY', () => {
    const allies = [
      makeUnit({ id: 'full', side: 'ally', hp: 1000, maxHp: 1000 }),
      makeUnit({ id: 'hurt', side: 'ally', hp: 200, maxHp: 1000 }),
      allyActor,
    ];
    const state = makeState(allies, []);
    const targets = selectTargets(state, allyActor, makeSkill(SkillTargetType.SINGLE_ALLY));
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('hurt');
  });

  it('should return empty for SINGLE_ALLY when no allies alive', () => {
    const deadActor = makeUnit({ id: 'dead', side: 'ally', isAlive: false });
    const state = makeState([deadActor], []);
    const targets = selectTargets(state, deadActor, makeSkill(SkillTargetType.SINGLE_ALLY));
    expect(targets).toEqual([]);
  });

  it('should select all alive allies with ALL_ALLY', () => {
    const allies = [
      makeUnit({ id: 'a1', side: 'ally', isAlive: true }),
      makeUnit({ id: 'a2', side: 'ally', isAlive: false }),
      allyActor,
    ];
    const state = makeState(allies, []);
    const targets = selectTargets(state, allyActor, makeSkill(SkillTargetType.ALL_ALLY));
    expect(targets).toHaveLength(2);
  });

  it('should default to single enemy for unknown target type', () => {
    const enemy = makeUnit({ id: 'e1', side: 'enemy', position: 'front' });
    const state = makeState([allyActor], [enemy]);
    const skill = makeSkill('UNKNOWN_TYPE' as SkillTargetType);
    const targets = selectTargets(state, allyActor, skill);
    // Defaults to selectSingleTarget
    expect(targets.length).toBeLessThanOrEqual(1);
  });

  it('should work for enemy actor targeting ally team', () => {
    const enemyActor = makeUnit({ id: 'enemy_actor', side: 'enemy', isAlive: true });
    const ally = makeUnit({ id: 'ally1', side: 'ally', position: 'front' });
    const state = makeState([ally], [enemyActor]);
    const targets = selectTargets(state, enemyActor, makeSkill(SkillTargetType.SINGLE_ENEMY));
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('ally1');
  });
});

describe('selectSingleTarget', () => {
  it('should select from front row when available', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: true }),
        makeUnit({ id: 'b1', position: 'back', isAlive: true }),
      ],
    };
    const targets = selectSingleTarget(team);
    expect(targets).toHaveLength(1);
    expect(targets[0].position).toBe('front');
  });

  it('should fall back to back row when no front alive', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: false }),
        makeUnit({ id: 'b1', position: 'back', isAlive: true }),
      ],
    };
    const targets = selectSingleTarget(team);
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('b1');
  });

  it('should return empty when all units dead', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: false }),
        makeUnit({ id: 'b1', position: 'back', isAlive: false }),
      ],
    };
    expect(selectSingleTarget(team)).toEqual([]);
  });

  it('should return empty for empty team', () => {
    const team: BattleTeam = { side: 'enemy', units: [] };
    expect(selectSingleTarget(team)).toEqual([]);
  });
});

describe('selectFrontRowTargets', () => {
  it('should return alive front row units', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: true }),
        makeUnit({ id: 'f2', position: 'front', isAlive: true }),
        makeUnit({ id: 'b1', position: 'back', isAlive: true }),
      ],
    };
    const targets = selectFrontRowTargets(team);
    expect(targets).toHaveLength(2);
    expect(targets.every((t) => t.position === 'front')).toBe(true);
  });

  it('should fall back to back row when no front alive', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: false }),
        makeUnit({ id: 'b1', position: 'back', isAlive: true }),
      ],
    };
    const targets = selectFrontRowTargets(team);
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('b1');
  });

  it('should return empty when all units dead', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: false }),
        makeUnit({ id: 'b1', position: 'back', isAlive: false }),
      ],
    };
    expect(selectFrontRowTargets(team)).toEqual([]);
  });
});

describe('selectBackRowTargets', () => {
  it('should return alive back row units', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: true }),
        makeUnit({ id: 'b1', position: 'back', isAlive: true }),
        makeUnit({ id: 'b2', position: 'back', isAlive: true }),
      ],
    };
    const targets = selectBackRowTargets(team);
    expect(targets).toHaveLength(2);
    expect(targets.every((t) => t.position === 'back')).toBe(true);
  });

  it('should fall back to front row when no back alive', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: true }),
        makeUnit({ id: 'b1', position: 'back', isAlive: false }),
      ],
    };
    const targets = selectBackRowTargets(team);
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('f1');
  });

  it('should return empty when all units dead', () => {
    const team: BattleTeam = {
      side: 'enemy',
      units: [
        makeUnit({ id: 'f1', position: 'front', isAlive: false }),
        makeUnit({ id: 'b1', position: 'back', isAlive: false }),
      ],
    };
    expect(selectBackRowTargets(team)).toEqual([]);
  });
});
