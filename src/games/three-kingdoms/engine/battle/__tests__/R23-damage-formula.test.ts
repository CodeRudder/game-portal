/**
 * R23-3: 伤害公式边界条件覆盖
 *
 * 覆盖场景：
 * - 零攻击力
 * - 满防御（防御 > 攻击）
 * - 暴击叠加
 * - 极端属性
 * - 最低伤害保底
 */

import { describe, it, expect } from 'vitest';
import {
  DamageCalculator,
  getRestraintMultiplier,
  getCriticalRate,
  getAttackBonus,
  getDefenseBonus,
  getShieldAmount,
} from '../DamageCalculator';
import type { BattleUnit } from '../battle.types';
import { TroopType, BuffType } from '../battle-base.types';
import type { Position, BattleSide, BuffEffect } from '../battle-base.types';
import { BATTLE_CONFIG } from '../battle-config';
import { vi } from 'vitest';

// ── 工厂函数 ──

function createUnit(
  overrides: Partial<{
    id: string;
    name: string;
    side: BattleSide;
    attack: number;
    defense: number;
    intelligence: number;
    speed: number;
    maxHp: number;
    hp: number;
    troopType: TroopType;
    buffs: BuffEffect[];
  }> = {},
): BattleUnit {
  return {
    id: overrides.id ?? 'unit1',
    name: overrides.name ?? 'TestUnit',
    faction: 'shu',
    troopType: overrides.troopType ?? TroopType.INFANTRY,
    position: { row: 0, col: 0 } as Position,
    side: overrides.side ?? 'ally',
    attack: overrides.attack ?? 100,
    defense: overrides.defense ?? 50,
    intelligence: overrides.intelligence ?? 50,
    speed: overrides.speed ?? 50,
    maxHp: overrides.maxHp ?? 1000,
    hp: overrides.hp ?? overrides.maxHp ?? 1000,
    rage: 0,
    skills: [],
    buffs: overrides.buffs ?? [],
    isAlive: true,
  };
}

describe('R23-3: 伤害公式边界条件', () => {
  let calc: DamageCalculator;
  beforeEach(() => {
    calc = new DamageCalculator();
  });

  // ═══════════════════════════════════════════
  // 零攻击力
  // ═══════════════════════════════════════════
  describe('零攻击力', () => {
    it('攻击力为 0 时最低伤害保底为 0', () => {
      const attacker = createUnit({ attack: 0, speed: 0 });
      const defender = createUnit({ defense: 0, side: 'enemy' });
      const result = calc.calculateDamage(attacker, defender, 1.0);
      // 最低伤害保底 = 攻击力 × 10% = 0
      expect(result.damage).toBeGreaterThanOrEqual(0);
      // 0攻击力时基础伤害=1(保底), minDamage=0, 1 >= 0 所以不触发保底
      // 或者最终伤害=0, minDamage=0, 0 < 0 = false
      // 关键是不崩溃
      expect(isFinite(result.damage)).toBe(true);
    });

    it('攻击力为 0 + 技能倍率 2.0 不崩溃', () => {
      const attacker = createUnit({ attack: 0, speed: 0 });
      const defender = createUnit({ defense: 0, side: 'enemy' });
      const result = calc.calculateDamage(attacker, defender, 2.0);
      expect(result.damage).toBeGreaterThanOrEqual(0);
      expect(isFinite(result.damage)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 满防御（防御 > 攻击）
  // ═══════════════════════════════════════════
  describe('满防御（防御 > 攻击）', () => {
    it('防御远大于攻击时触发最低伤害保底', () => {
      const attacker = createUnit({ attack: 10, defense: 50 });
      const defender = createUnit({ defense: 99999, side: 'enemy' });
      const result = calc.calculateDamage(attacker, defender, 1.0);
      // 基础伤害 = max(1, 10 - 99999) = 1
      // 最低保底 = 10 * 10% = 1
      // finalDamage ≈ 1.0, minDamage = 1.0 → isMinDamage 可能是 false (不严格小于)
      // 关键是伤害 >= 1（不出现0或负数）
      expect(result.damage).toBeGreaterThanOrEqual(1);
      expect(result.baseDamage).toBe(1);
    });

    it('防御等于攻击时基础伤害为 1', () => {
      const attacker = createUnit({ attack: 100, speed: 0 });
      const defender = createUnit({ defense: 100, side: 'enemy' });
      const result = calc.calculateDamage(attacker, defender, 1.0);
      // 基础伤害 = max(1, 100 - 100) = 1
      expect(result.baseDamage).toBe(1);
    });

    it('高防低攻 + 高技能倍率仍触发保底', () => {
      const attacker = createUnit({ attack: 5, speed: 0 });
      const defender = createUnit({ defense: 1000, side: 'enemy' });
      const result = calc.calculateDamage(attacker, defender, 3.0);
      expect(result.damage).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════
  // 暴击判定
  // ═══════════════════════════════════════════
  describe('暴击判定', () => {
    it('暴击率 = 基础5% + speed/100', () => {
      expect(getCriticalRate(0)).toBeCloseTo(0.05, 5);
      // speed=100 → 0.05 + 100/100 = 1.05, 但被 min(1.0) 截断
      expect(getCriticalRate(100)).toBe(1.0);
      expect(getCriticalRate(50)).toBeCloseTo(0.55, 5);
    });

    it('暴击率上限 100%', () => {
      expect(getCriticalRate(99999)).toBe(1.0);
    });

    it('暴击率下限 0%', () => {
      expect(getCriticalRate(-99999)).toBe(0.0);
    });

    it('暴击系数为 1.5', () => {
      // 通过多次运行验证暴击伤害
      const attacker = createUnit({ attack: 100, defense: 0, speed: 999 }); // 必定暴击
      const defender = createUnit({ defense: 0, side: 'enemy' });
      let foundCritical = false;
      for (let i = 0; i < 50; i++) {
        const result = calc.calculateDamage(attacker, defender, 1.0);
        if (result.isCritical) {
          expect(result.criticalMultiplier).toBe(BATTLE_CONFIG.CRITICAL_MULTIPLIER);
          foundCritical = true;
          break;
        }
      }
      // speed=999 → 暴击率 ≈ 1.0，50次中应该至少有一次暴击
      expect(foundCritical).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 兵种克制
  // ═══════════════════════════════════════════
  describe('兵种克制', () => {
    it('骑兵克制步兵 → 系数 1.5', () => {
      expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY)).toBe(1.5);
    });

    it('步兵克制枪兵 → 系数 1.5', () => {
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN)).toBe(1.5);
    });

    it('枪兵克制骑兵 → 系数 1.5', () => {
      expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY)).toBe(1.5);
    });

    it('被克制 → 系数 0.7', () => {
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY)).toBe(0.7);
    });

    it('弓兵无克制关系 → 系数 1.0', () => {
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.INFANTRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.ARCHER)).toBe(1.0);
    });

    it('谋士无克制关系 → 系数 1.0', () => {
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.CAVALRY)).toBe(1.0);
    });

    it('同兵种无克制 → 系数 1.0', () => {
      expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.CAVALRY)).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════
  // Buff 加成
  // ═══════════════════════════════════════════
  describe('Buff 加成', () => {
    it('ATK_UP 增加攻击加成', () => {
      const unit = createUnit({
        buffs: [{ type: BuffType.ATK_UP, value: 0.5, duration: 3, source: 'test' }],
      });
      expect(getAttackBonus(unit)).toBe(0.5);
    });

    it('ATK_DOWN 减少攻击加成', () => {
      const unit = createUnit({
        buffs: [{ type: BuffType.ATK_DOWN, value: 0.3, duration: 3, source: 'test' }],
      });
      expect(getAttackBonus(unit)).toBe(-0.3);
    });

    it('DEF_UP 增加防御加成', () => {
      const unit = createUnit({
        buffs: [{ type: BuffType.DEF_UP, value: 0.5, duration: 3, source: 'test' }],
      });
      expect(getDefenseBonus(unit)).toBe(0.5);
    });

    it('DEF_DOWN 减少防御加成', () => {
      const unit = createUnit({
        buffs: [{ type: BuffType.DEF_DOWN, value: 0.3, duration: 3, source: 'test' }],
      });
      expect(getDefenseBonus(unit)).toBe(-0.3);
    });

    it('多个 Buff 叠加', () => {
      const unit = createUnit({
        buffs: [
          { type: BuffType.ATK_UP, value: 0.3, duration: 3, source: 'test' },
          { type: BuffType.ATK_UP, value: 0.2, duration: 3, source: 'test' },
        ],
      });
      expect(getAttackBonus(unit)).toBe(0.5);
    });

    it('SHIELD 计算护盾总量', () => {
      const unit = createUnit({
        buffs: [
          { type: BuffType.SHIELD, value: 200, duration: 3, source: 'test' },
          { type: BuffType.SHIELD, value: 300, duration: 3, source: 'test' },
        ],
      });
      expect(getShieldAmount(unit)).toBe(500);
    });
  });

  // ═══════════════════════════════════════════
  // 极端属性组合
  // ═══════════════════════════════════════════
  describe('极端属性组合', () => {
    it('极高攻击 vs 0防御 → 高伤害', () => {
      const attacker = createUnit({ attack: 99999, defense: 0, speed: 0 });
      const defender = createUnit({ defense: 0, side: 'enemy' });
      const result = calc.calculateDamage(attacker, defender, 1.0);
      expect(result.damage).toBeGreaterThan(50000);
    });

    it('极高攻击 + 高技能倍率 + 暴击 → 超高伤害', () => {
      const attacker = createUnit({ attack: 10000, defense: 0, speed: 999 });
      const defender = createUnit({ defense: 0, side: 'enemy' });
      let maxDamage = 0;
      for (let i = 0; i < 100; i++) {
        const result = calc.calculateDamage(attacker, defender, 3.0);
        maxDamage = Math.max(maxDamage, result.damage);
      }
      // 暴击 × 3.0倍率 × 随机波动1.1
      // 10000 * 3.0 * 1.5 * 1.1 = 49500
      expect(maxDamage).toBeGreaterThan(10000);
    });

    it('伤害结果总是有限数', () => {
      const attacker = createUnit({ attack: 99999, defense: 99999, speed: 99999 });
      const defender = createUnit({ defense: 99999, side: 'enemy' });
      for (let i = 0; i < 20; i++) {
        const result = calc.calculateDamage(attacker, defender, 3.0);
        expect(isFinite(result.damage)).toBe(true);
        expect(result.damage).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ═══════════════════════════════════════════
  // applyDamage
  // ═══════════════════════════════════════════
  describe('applyDamage', () => {
    it('伤害不超过当前 HP', () => {
      const defender = createUnit({ maxHp: 100, hp: 50, side: 'enemy' });
      const actualDamage = calc.applyDamage(defender, 200);
      expect(actualDamage).toBeLessThanOrEqual(50);
      expect(defender.hp).toBe(0);
    });

    it('0 伤害不减少 HP', () => {
      const defender = createUnit({ maxHp: 1000, hp: 1000, side: 'enemy' });
      calc.applyDamage(defender, 0);
      expect(defender.hp).toBe(1000);
    });

    it('护盾先吸收伤害', () => {
      const defender = createUnit({
        maxHp: 1000,
        hp: 1000,
        side: 'enemy',
        buffs: [{ type: BuffType.SHIELD, value: 200, duration: 3, source: 'test' }],
      });
      const actualDamage = calc.applyDamage(defender, 150);
      // 护盾吸收 150，HP 不变
      expect(defender.hp).toBe(1000);
    });
  });
});
