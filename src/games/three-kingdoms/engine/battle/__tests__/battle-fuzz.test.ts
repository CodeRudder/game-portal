/**
 * 战斗系统 — 模糊测试（Fuzz Testing）
 *
 * 使用 seeded PRNG 生成随机战斗场景，验证战斗引擎在各种随机输入下的稳定性。
 * 覆盖：随机属性武将、极端属性、不同人数、随机技能组合、随机克制关系。
 *
 * @module engine/battle/__tests__/battle-fuzz
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleEngine } from '../BattleEngine';
import type {
  BattleTeam,
  BattleUnit,
  BattleSkill,
  BattleResult,
} from '../battle.types';
import {
  BattleOutcome,
  TroopType,
  SkillTargetType,
} from '../battle.types';
import { BATTLE_CONFIG } from '../battle-config';

// ─────────────────────────────────────────────
// Seeded PRNG (Park-Miller)
// ─────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

function pickRandom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─────────────────────────────────────────────
// 战斗单位工厂
// ─────────────────────────────────────────────

const TROOP_TYPES: readonly TroopType[] = [
  TroopType.CAVALRY,
  TroopType.INFANTRY,
  TroopType.SPEARMAN,
  TroopType.ARCHER,
  TroopType.STRATEGIST,
];

const FACTIONS: readonly ('shu' | 'wei' | 'wu' | 'qun')[] = ['shu', 'wei', 'wu', 'qun'];

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal',
  name: '普攻',
  type: 'active',
  level: 1,
  description: '普通攻击',
  multiplier: 1.0,
  targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 0,
  cooldown: 0,
  currentCooldown: 0,
};

const TARGET_TYPES: readonly SkillTargetType[] = [
  SkillTargetType.SINGLE_ENEMY,
  SkillTargetType.FRONT_ROW,
  SkillTargetType.BACK_ROW,
  SkillTargetType.ALL_ENEMY,
];

/** 创建随机技能 */
function createRandomSkill(rng: () => number, index: number): BattleSkill {
  return {
    id: `skill_${index}`,
    name: `技能${index}`,
    type: 'active',
    level: randInt(rng, 1, 5),
    description: `随机技能${index}`,
    multiplier: randFloat(rng, 1.0, 3.0),
    targetType: pickRandom(rng, TARGET_TYPES),
    rageCost: randInt(rng, 50, 100),
    cooldown: randInt(rng, 0, 3),
    currentCooldown: 0,
  };
}

/** 创建随机战斗单位 */
function createRandomUnit(
  rng: () => number,
  side: 'ally' | 'enemy',
  index: number,
  overrides: Partial<BattleUnit> = {},
): BattleUnit {
  const position = index < 3 ? 'front' as const : 'back' as const;
  const skillCount = randInt(rng, 0, 2);
  const skills: BattleSkill[] = [];
  for (let i = 0; i < skillCount; i++) {
    skills.push(createRandomSkill(rng, i));
  }

  return {
    id: `${side}_${index}_${randInt(rng, 1000, 9999)}`,
    name: `${side === 'ally' ? '我方' : '敌方'}${index + 1}`,
    faction: pickRandom(rng, FACTIONS),
    troopType: pickRandom(rng, TROOP_TYPES),
    position,
    side,
    attack: randFloat(rng, 50, 500),
    baseAttack: randFloat(rng, 50, 500),
    defense: randFloat(rng, 20, 300),
    baseDefense: randFloat(rng, 20, 300),
    intelligence: randFloat(rng, 30, 200),
    speed: randFloat(rng, 30, 200),
    hp: randFloat(rng, 500, 5000),
    maxHp: randFloat(rng, 500, 5000),
    isAlive: true,
    rage: randFloat(rng, 0, 80),
    maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK },
    skills,
    buffs: [],
    ...overrides,
  };
}

/** 创建随机队伍 */
function createRandomTeam(
  rng: () => number,
  side: 'ally' | 'enemy',
  count: number,
): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < count; i++) {
    units.push(createRandomUnit(rng, side, i));
  }
  return { units, side };
}

/** 验证战斗结果有效性 */
function isValidBattleResult(result: BattleResult): boolean {
  return (
    Number.isFinite(result.totalTurns) &&
    Number.isFinite(result.allySurvivors) &&
    Number.isFinite(result.enemySurvivors) &&
    Number.isFinite(result.allyTotalDamage) &&
    Number.isFinite(result.enemyTotalDamage) &&
    Number.isFinite(result.maxSingleDamage) &&
    result.allySurvivors >= 0 &&
    result.enemySurvivors >= 0 &&
    result.totalTurns > 0
  );
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BattleEngine Fuzz Testing', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  // ── 1. 随机属性武将战斗100次不崩溃 ──

  it('随机属性武将战斗100次不崩溃且结果有效', () => {
    const rng = seededRandom(1001);

    for (let i = 0; i < 100; i++) {
      const ally = createRandomTeam(rng, 'ally', 3);
      const enemy = createRandomTeam(rng, 'enemy', 3);

      const result = engine.runFullBattle(ally, enemy);

      // 验证结果有效
      expect(result.outcome).toBeDefined();
      expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
      expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
      expect(isValidBattleResult(result)).toBe(true);
    }
  });

  // ── 2. 极端属性（全0）武将战斗 ──

  it('全0属性武将战斗不崩溃', () => {
    const createZeroUnit = (side: 'ally' | 'enemy', index: number): BattleUnit => ({
      id: `zero_${side}_${index}`,
      name: `零属性${index}`,
      faction: 'shu',
      troopType: TroopType.INFANTRY,
      position: 'front',
      side,
      attack: 0,
      baseAttack: 0,
      defense: 0,
      baseDefense: 0,
      intelligence: 0,
      speed: 0,
      hp: 100,
      maxHp: 100,
      isAlive: true,
      rage: 0,
      maxRage: 100,
      normalAttack: { ...NORMAL_ATTACK },
      skills: [],
      buffs: [],
    });

    const ally: BattleTeam = {
      units: [createZeroUnit('ally', 0), createZeroUnit('ally', 1)],
      side: 'ally',
    };
    const enemy: BattleTeam = {
      units: [createZeroUnit('enemy', 0), createZeroUnit('enemy', 1)],
      side: 'enemy',
    };

    const result = engine.runFullBattle(ally, enemy);
    expect(result.outcome).toBeDefined();
    expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
    expect(isValidBattleResult(result)).toBe(true);
  });

  // ── 3. 极端属性（全MAX）武将战斗 ──

  it('极高属性武将战斗不崩溃', () => {
    const rng = seededRandom(2002);

    const createMaxUnit = (side: 'ally' | 'enemy', index: number): BattleUnit => ({
      id: `max_${side}_${index}`,
      name: `满属性${index}`,
      faction: pickRandom(rng, FACTIONS),
      troopType: pickRandom(rng, TROOP_TYPES),
      position: index < 3 ? 'front' : 'back',
      side,
      attack: 99999,
      baseAttack: 99999,
      defense: 99999,
      baseDefense: 99999,
      intelligence: 99999,
      speed: 99999,
      hp: 999999,
      maxHp: 999999,
      isAlive: true,
      rage: 100,
      maxRage: 100,
      normalAttack: { ...NORMAL_ATTACK },
      skills: [createRandomSkill(rng, 0)],
      buffs: [],
    });

    const ally: BattleTeam = {
      units: Array.from({ length: 3 }, (_, i) => createMaxUnit('ally', i)),
      side: 'ally',
    };
    const enemy: BattleTeam = {
      units: Array.from({ length: 3 }, (_, i) => createMaxUnit('enemy', i)),
      side: 'enemy',
    };

    const result = engine.runFullBattle(ally, enemy);
    expect(result.outcome).toBeDefined();
    expect(isValidBattleResult(result)).toBe(true);
    // 高属性下伤害值应有效
    expect(Number.isFinite(result.allyTotalDamage)).toBe(true);
    expect(Number.isFinite(result.maxSingleDamage)).toBe(true);
  });

  // ── 4. 1v1到6v6随机人数战斗 ──

  it('1v1到6v6随机人数战斗全部不崩溃', () => {
    const rng = seededRandom(3003);

    for (let teamSize = 1; teamSize <= 6; teamSize++) {
      const ally = createRandomTeam(rng, 'ally', teamSize);
      const enemy = createRandomTeam(rng, 'enemy', teamSize);

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBeDefined();
      expect(result.allySurvivors).toBeGreaterThanOrEqual(0);
      expect(result.allySurvivors).toBeLessThanOrEqual(teamSize);
      expect(result.enemySurvivors).toBeGreaterThanOrEqual(0);
      expect(result.enemySurvivors).toBeLessThanOrEqual(teamSize);
      expect(isValidBattleResult(result)).toBe(true);
    }
  });

  // ── 5. 随机技能组合战斗 ──

  it('随机技能组合战斗50次不崩溃', () => {
    const rng = seededRandom(4004);

    for (let i = 0; i < 50; i++) {
      const allyCount = randInt(rng, 1, 4);
      const enemyCount = randInt(rng, 1, 4);

      const ally = createRandomTeam(rng, 'ally', allyCount);
      const enemy = createRandomTeam(rng, 'enemy', enemyCount);

      const result = engine.runFullBattle(ally, enemy);
      expect(result.outcome).toBeDefined();
      expect(isValidBattleResult(result)).toBe(true);
    }
  });

  // ── 6. 随机克制关系战斗 ──

  it('特定克制关系组合战斗结果符合预期', () => {
    // 骑兵 > 步兵 > 枪兵 > 骑兵
    const createTypedUnit = (
      side: 'ally' | 'enemy',
      index: number,
      troopType: TroopType,
    ): BattleUnit => ({
      id: `${side}_typed_${index}`,
      name: `${TROOP_TYPES.indexOf(troopType)}_${side}_${index}`,
      faction: 'shu',
      troopType,
      position: 'front',
      side,
      attack: 200,
      baseAttack: 200,
      defense: 80,
      baseDefense: 80,
      intelligence: 60,
      speed: 100,
      hp: 2000,
      maxHp: 2000,
      isAlive: true,
      rage: 0,
      maxRage: 100,
      normalAttack: { ...NORMAL_ATTACK },
      skills: [],
      buffs: [],
    });

    // 骑兵 vs 步兵：骑兵克制步兵
    const allyCavalry: BattleTeam = {
      units: [createTypedUnit('ally', 0, TroopType.CAVALRY)],
      side: 'ally',
    };
    const enemyInfantry: BattleTeam = {
      units: [createTypedUnit('enemy', 0, TroopType.INFANTRY)],
      side: 'enemy',
    };

    const result = engine.runFullBattle(allyCavalry, enemyInfantry);
    expect(result.outcome).toBeDefined();
    expect(isValidBattleResult(result)).toBe(true);
    // 骑兵克制步兵，我方总伤害应大于敌方
    expect(result.allyTotalDamage).toBeGreaterThan(result.enemyTotalDamage);
  });

  // ── 7. 随机人数不对等战斗 ──

  it('随机不对等人数（1v6, 6v1, 2v5等）战斗不崩溃', () => {
    const rng = seededRandom(5005);
    const combinations: [number, number][] = [
      [1, 6], [6, 1], [2, 5], [5, 2], [3, 1], [1, 3],
    ];

    for (const [allyCount, enemyCount] of combinations) {
      const ally = createRandomTeam(rng, 'ally', allyCount);
      const enemy = createRandomTeam(rng, 'enemy', enemyCount);

      const result = engine.runFullBattle(ally, enemy);
      expect(result.outcome).toBeDefined();
      expect(result.allySurvivors).toBeGreaterThanOrEqual(0);
      expect(result.allySurvivors).toBeLessThanOrEqual(allyCount);
      expect(result.enemySurvivors).toBeGreaterThanOrEqual(0);
      expect(result.enemySurvivors).toBeLessThanOrEqual(enemyCount);
      expect(isValidBattleResult(result)).toBe(true);
    }
  });

  // ── 8. 极端HP单位战斗（1 HP vs 1 HP） ──

  it('1HP单位互攻战斗不崩溃', () => {
    const createOneHpUnit = (side: 'ally' | 'enemy', index: number): BattleUnit => ({
      id: `onehp_${side}_${index}`,
      name: `一血${index}`,
      faction: 'shu',
      troopType: TroopType.CAVALRY,
      position: 'front',
      side,
      attack: 100,
      baseAttack: 100,
      defense: 0,
      baseDefense: 0,
      intelligence: 50,
      speed: 100,
      hp: 1,
      maxHp: 1,
      isAlive: true,
      rage: 0,
      maxRage: 100,
      normalAttack: { ...NORMAL_ATTACK },
      skills: [],
      buffs: [],
    });

    const ally: BattleTeam = {
      units: [createOneHpUnit('ally', 0)],
      side: 'ally',
    };
    const enemy: BattleTeam = {
      units: [createOneHpUnit('enemy', 0)],
      side: 'enemy',
    };

    const result = engine.runFullBattle(ally, enemy);
    expect(result.outcome).toBeDefined();
    expect(result.totalTurns).toBe(1); // 一回合应结束
    expect(isValidBattleResult(result)).toBe(true);
  });

  // ── 9. 多seed回归测试（随机战斗20次 × 5 seed） ──

  it('多个seed下随机战斗均不崩溃', () => {
    const seeds = [1111, 2222, 3333, 4444, 5555];

    for (const seed of seeds) {
      const rng = seededRandom(seed);
      for (let i = 0; i < 20; i++) {
        const allyCount = randInt(rng, 1, 6);
        const enemyCount = randInt(rng, 1, 6);
        const ally = createRandomTeam(rng, 'ally', allyCount);
        const enemy = createRandomTeam(rng, 'enemy', enemyCount);

        const result = engine.runFullBattle(ally, enemy);
        expect(result.outcome).toBeDefined();
        expect(isValidBattleResult(result)).toBe(true);
      }
    }
  });

  // ── 10. 随机满怒气武将战斗（大招频繁释放） ──

  it('满怒气武将战斗中频繁释放大招不崩溃', () => {
    const rng = seededRandom(6006);

    const createRageUnit = (side: 'ally' | 'enemy', index: number): BattleUnit => {
      const unit = createRandomUnit(rng, side, index);
      unit.rage = 100; // 满怒气
      unit.skills = [createRandomSkill(rng, 0)];
      return unit;
    };

    const ally: BattleTeam = {
      units: Array.from({ length: 3 }, (_, i) => createRageUnit('ally', i)),
      side: 'ally',
    };
    const enemy: BattleTeam = {
      units: Array.from({ length: 3 }, (_, i) => createRageUnit('enemy', i)),
      side: 'enemy',
    };

    const result = engine.runFullBattle(ally, enemy);
    expect(result.outcome).toBeDefined();
    expect(isValidBattleResult(result)).toBe(true);
    // 大招频繁释放，总伤害应较高
    expect(result.allyTotalDamage + result.enemyTotalDamage).toBeGreaterThan(0);
  });
});
