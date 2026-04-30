/**
 * P0 崩溃缺陷修复 — 单元测试
 *
 * 覆盖：
 * - DEF-004: initBattle 无 null 防护
 * - DEF-005: applyDamage 负伤害治疗漏洞
 * - DEF-006: applyDamage/calculateDamage NaN 全链传播
 *
 * @module engine/battle/__tests__/P0-crash-fixes.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleEngine } from '../BattleEngine';
import { DamageCalculator } from '../DamageCalculator';
import type { BattleTeam, BattleUnit, BattleSkill } from '../battle.types';
import { TroopType, BuffType } from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal',
  name: '普攻',
  type: 'active',
  level: 1,
  description: '普通攻击',
  multiplier: 1.0,
  targetType: 'SINGLE_ENEMY',
  rageCost: 0,
  cooldown: 0,
  currentCooldown: 0,
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate',
  name: '大招',
  type: 'active',
  level: 1,
  description: '强力技能',
  multiplier: 2.0,
  targetType: 'ALL_ENEMY',
  rageCost: 100,
  cooldown: 3,
  currentCooldown: 0,
};

/** 创建测试用战斗单位 */
function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.CAVALRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 60,
    speed: 80,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK },
    skills: [{ ...ULTIMATE_SKILL }],
    buffs: [],
    ...overrides,
  };
}

/** 创建测试队伍 */
function createTeam(
  side: 'ally' | 'enemy',
  count: number = 3,
): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < count; i++) {
    units.push(
      createUnit({
        id: `${side}_${i}`,
        name: `${side === 'ally' ? '我方' : '敌方'}${i + 1}`,
        side,
        position: i < 2 ? 'front' : 'back',
      }),
    );
  }
  return { units, side };
}

// ─────────────────────────────────────────────
// DEF-004: initBattle 无 null 防护
// ─────────────────────────────────────────────

describe('DEF-004: initBattle null/undefined 防护', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  it('当 allyTeam 为 null 时应抛出错误', () => {
    expect(() => {
      engine.initBattle(null as unknown as BattleTeam, createTeam('enemy'));
    }).toThrow('BattleEngine.initBattle: teams cannot be null or undefined');
  });

  it('当 enemyTeam 为 undefined 时应抛出错误', () => {
    expect(() => {
      engine.initBattle(createTeam('ally'), undefined as unknown as BattleTeam);
    }).toThrow('BattleEngine.initBattle: teams cannot be null or undefined');
  });

  it('当两个队伍都为 null 时应抛出错误', () => {
    expect(() => {
      engine.initBattle(null as unknown as BattleTeam, null as unknown as BattleTeam);
    }).toThrow('BattleEngine.initBattle: teams cannot be null or undefined');
  });

  it('当传入合法队伍时不应抛出错误', () => {
    const allyTeam = createTeam('ally');
    const enemyTeam = createTeam('enemy');
    const state = engine.initBattle(allyTeam, enemyTeam);
    expect(state).toBeDefined();
    expect(state.phase).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// DEF-005: applyDamage 负伤害治疗漏洞
// ─────────────────────────────────────────────

describe('DEF-005: applyDamage 负伤害防护', () => {
  let calculator: DamageCalculator;

  beforeEach(() => {
    calculator = new DamageCalculator();
  });

  it('负伤害应返回 0，不恢复 HP', () => {
    const defender = createUnit({ hp: 500, maxHp: 1000 });
    const result = calculator.applyDamage(defender, -100);
    expect(result).toBe(0);
    expect(defender.hp).toBe(500);
  });

  it('零伤害应返回 0', () => {
    const defender = createUnit({ hp: 500, maxHp: 1000 });
    const result = calculator.applyDamage(defender, 0);
    expect(result).toBe(0);
    expect(defender.hp).toBe(500);
  });

  it('大额负伤害不应恢复 HP', () => {
    const defender = createUnit({ hp: 100, maxHp: 1000 });
    const result = calculator.applyDamage(defender, -9999);
    expect(result).toBe(0);
    expect(defender.hp).toBe(100);
  });

  it('正常正数伤害应正常工作', () => {
    const defender = createUnit({ hp: 500, maxHp: 1000 });
    const result = calculator.applyDamage(defender, 100);
    expect(result).toBe(100);
    expect(defender.hp).toBe(400);
  });
});

// ─────────────────────────────────────────────
// DEF-006: applyDamage/calculateDamage NaN 全链传播
// ─────────────────────────────────────────────

describe('DEF-006: NaN 防护', () => {
  let calculator: DamageCalculator;

  beforeEach(() => {
    calculator = new DamageCalculator();
  });

  describe('applyDamage NaN 防护', () => {
    it('NaN 伤害应返回 0，不修改 HP', () => {
      const defender = createUnit({ hp: 500, maxHp: 1000 });
      const result = calculator.applyDamage(defender, NaN);
      expect(result).toBe(0);
      expect(defender.hp).toBe(500);
    });

    it('NaN 伤害不应导致单位死亡', () => {
      const defender = createUnit({ hp: 1, maxHp: 1000 });
      calculator.applyDamage(defender, NaN);
      expect(defender.isAlive).toBe(true);
      expect(defender.hp).toBe(1);
    });
  });

  describe('calculateDamage NaN 防护', () => {
    it('攻击方 attack 为 NaN 时应返回 damage=0 的安全结果', () => {
      const attacker = createUnit({ attack: NaN });
      const defender = createUnit();
      const result = calculator.calculateDamage(attacker, defender, 1.0);
      expect(result.damage).toBe(0);
      expect(result.baseDamage).toBe(0);
      expect(Number.isNaN(result.damage)).toBe(false);
    });

    it('防御方 defense 为 NaN 时应返回 damage=0 的安全结果', () => {
      const attacker = createUnit();
      const defender = createUnit({ defense: NaN });
      const result = calculator.calculateDamage(attacker, defender, 1.0);
      expect(result.damage).toBe(0);
      expect(Number.isNaN(result.damage)).toBe(false);
    });

    it('技能倍率为 NaN 时应返回 damage=0 的安全结果', () => {
      const attacker = createUnit();
      const defender = createUnit();
      const result = calculator.calculateDamage(attacker, defender, NaN);
      expect(result.damage).toBe(0);
      expect(Number.isNaN(result.damage)).toBe(false);
    });

    it('正常参数应正常计算伤害', () => {
      const attacker = createUnit({ attack: 200 });
      const defender = createUnit({ defense: 50 });
      const result = calculator.calculateDamage(attacker, defender, 1.0);
      expect(result.damage).toBeGreaterThan(0);
      expect(Number.isNaN(result.damage)).toBe(false);
    });
  });

  describe('NaN 全链防护集成', () => {
    it('calculateDamage 返回 NaN 防护结果后 applyDamage 不应崩溃', () => {
      const attacker = createUnit({ attack: NaN });
      const defender = createUnit({ hp: 500, maxHp: 1000 });

      const damageResult = calculator.calculateDamage(attacker, defender, 1.0);
      // calculateDamage 的 NaN 防护返回 damage=0
      expect(damageResult.damage).toBe(0);

      // 将结果传给 applyDamage 也不应出问题
      const applied = calculator.applyDamage(defender, damageResult.damage);
      expect(applied).toBe(0);
      expect(defender.hp).toBe(500);
    });
  });
});
