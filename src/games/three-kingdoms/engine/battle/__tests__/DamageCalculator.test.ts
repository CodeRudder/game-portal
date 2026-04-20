/**
 * 伤害计算器 — 单元测试
 *
 * 覆盖：
 * - 基础伤害计算（攻击×倍率 - 防御×减免）
 * - 暴击判定
 * - 兵种克制
 * - 最低伤害保底
 * - Buff/Debuff对攻防的影响
 * - 护盾吸收
 * - 持续伤害（DOT）
 * - 控制效果判定
 *
 * @module engine/battle/__tests__/DamageCalculator.test
 */

import {
  DamageCalculator,
  getRestraintMultiplier,
  getCriticalRate,
  rollCritical,
  getAttackBonus,
  getDefenseBonus,
  getShieldAmount,
} from '../DamageCalculator';
import type { BattleUnit } from '../battle.types';
import {
  BATTLE_CONFIG,
  BuffType,
  TroopType,
} from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

/** 创建测试用战斗单位 */
function createTestUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'test-unit',
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
    normalAttack: {
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
    },
    skills: [],
    buffs: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('DamageCalculator', () => {
  let calculator: DamageCalculator;

  beforeEach(() => {
    calculator = new DamageCalculator();
  });

  // ── 基础伤害计算 ──

  describe('calculateDamage - 基础伤害', () => {
    it('应该正确计算基础伤害（攻击×倍率 - 防御）', () => {
      const attacker = createTestUnit({ attack: 200, defense: 0 });
      const defender = createTestUnit({ attack: 0, defense: 50, troopType: TroopType.ARCHER });

      // Mock: crit check returns 0.99 (no crit, since crit rate = 0.05 + 80/100 = 0.85)
      // randomInRange returns 0.5 → factor = 0.9 + 0.5*0.2 = 1.0
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0.99).mockReturnValueOnce(0.5);

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      expect(result.baseDamage).toBe(150);
      expect(result.skillMultiplier).toBe(1.0);
      expect(result.restraintMultiplier).toBe(1.0); // 骑兵vs弓兵无克制
      expect(result.damage).toBe(150);

      mockRandom.mockRestore();
    });

    it('应该正确应用技能倍率', () => {
      const attacker = createTestUnit({ attack: 200, defense: 0 });
      const defender = createTestUnit({ attack: 0, defense: 50, troopType: TroopType.ARCHER });

      // Mock: crit check returns 0.99 (no crit), random returns 0.5 (factor=1.0)
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0.99).mockReturnValueOnce(0.5);

      const result = calculator.calculateDamage(attacker, defender, 2.0);

      // 基础伤害 = 150，技能倍率 ×2.0
      expect(result.baseDamage).toBe(150);
      expect(result.skillMultiplier).toBe(2.0);
      // 伤害 = 150 × 2.0 × 1.0 × 1.0 × 1.0 = 300
      expect(result.damage).toBe(300);

      mockRandom.mockRestore();
    });

    it('攻击低于防御时基础伤害应为1', () => {
      const attacker = createTestUnit({ attack: 30, defense: 0 });
      const defender = createTestUnit({ attack: 0, defense: 100, troopType: TroopType.ARCHER });

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      // 基础伤害 = max(1, 30 - 100) = 1
      expect(result.baseDamage).toBe(1);
    });

    it('最低伤害保底应为攻击力×10%', () => {
      const attacker = createTestUnit({ attack: 30, defense: 0 });
      const defender = createTestUnit({ attack: 0, defense: 100, troopType: TroopType.ARCHER });

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      // 最低伤害 = 30 × 10% = 3
      expect(result.isMinDamage).toBe(true);
      expect(result.damage).toBe(3);
    });
  });

  // ── 暴击判定 ──

  describe('暴击判定', () => {
    it('暴击时伤害应为×1.5', () => {
      // Mock Math.random to control both crit roll and random factor
      const mockRandom = jest.spyOn(Math, 'random');
      // First call: crit check (return small value → trigger crit)
      mockRandom.mockReturnValueOnce(0.001);
      // Second call: randomInRange for random factor (return 0.5 → factor = 0.9 + 0.5*0.2 = 1.0)
      mockRandom.mockReturnValueOnce(0.5);

      const attacker = createTestUnit({ attack: 200, defense: 0, speed: 80, troopType: TroopType.ARCHER });
      const defender = createTestUnit({ attack: 0, defense: 50, troopType: TroopType.ARCHER });

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      expect(result.isCritical).toBe(true);
      expect(result.criticalMultiplier).toBe(BATTLE_CONFIG.CRITICAL_MULTIPLIER);
      // 伤害 = 150 × 1.5 × 1.0 × 1.0 = 225
      expect(result.damage).toBe(225);

      mockRandom.mockRestore();
    });

    it('未暴击时伤害倍率应为×1.0', () => {
      const mockRandom = jest.spyOn(Math, 'random');
      // 暴击判定返回1.0 → 不暴击
      mockRandom.mockReturnValueOnce(1.0);
      // 随机波动返回1.0
      mockRandom.mockReturnValueOnce(1.0);

      const attacker = createTestUnit({ attack: 200, defense: 0, speed: 80, troopType: TroopType.ARCHER });
      const defender = createTestUnit({ attack: 0, defense: 50, troopType: TroopType.ARCHER });

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      expect(result.isCritical).toBe(false);
      expect(result.criticalMultiplier).toBe(1.0);

      mockRandom.mockRestore();
    });
  });

  // ── 暴击率计算 ──

  describe('getCriticalRate', () => {
    it('基础暴击率应为5%', () => {
      expect(getCriticalRate(0)).toBeCloseTo(0.05, 4);
    });

    it('速度100时暴击率应为5%+100/100=105%，但上限100%', () => {
      expect(getCriticalRate(100)).toBeLessThanOrEqual(1.0);
    });

    it('速度50时暴击率应为55%', () => {
      expect(getCriticalRate(50)).toBeCloseTo(0.55, 4);
    });
  });

  // ── 兵种克制 ──

  describe('getRestraintMultiplier - 兵种克制', () => {
    it('骑兵克制步兵 → ×1.5', () => {
      expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY))
        .toBe(BATTLE_CONFIG.RESTRAINT_ADVANTAGE);
    });

    it('步兵克制枪兵 → ×1.5', () => {
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN))
        .toBe(BATTLE_CONFIG.RESTRAINT_ADVANTAGE);
    });

    it('枪兵克制骑兵 → ×1.5', () => {
      expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY))
        .toBe(BATTLE_CONFIG.RESTRAINT_ADVANTAGE);
    });

    it('步兵被骑兵克制 → ×0.7', () => {
      expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY))
        .toBe(BATTLE_CONFIG.RESTRAINT_DISADVANTAGE);
    });

    it('枪兵被步兵克制 → ×0.7', () => {
      expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.INFANTRY))
        .toBe(BATTLE_CONFIG.RESTRAINT_DISADVANTAGE);
    });

    it('骑兵被枪兵克制 → ×0.7', () => {
      expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.SPEARMAN))
        .toBe(BATTLE_CONFIG.RESTRAINT_DISADVANTAGE);
    });

    it('弓兵无克制关系 → ×1.0', () => {
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.CAVALRY))
        .toBe(BATTLE_CONFIG.RESTRAINT_NEUTRAL);
      expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.ARCHER))
        .toBe(BATTLE_CONFIG.RESTRAINT_NEUTRAL);
    });

    it('谋士无克制关系 → ×1.0', () => {
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.INFANTRY))
        .toBe(BATTLE_CONFIG.RESTRAINT_NEUTRAL);
    });

    it('弓兵对弓兵 → ×1.0', () => {
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.ARCHER))
        .toBe(BATTLE_CONFIG.RESTRAINT_NEUTRAL);
    });
  });

  // ── Buff/Debuff ──

  describe('Buff/Debuff 影响', () => {
    it('攻击提升Buff应增加伤害', () => {
      const attacker = createTestUnit({
        attack: 100,
        troopType: TroopType.ARCHER,
        buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: 0.2, sourceId: 's' }],
      });
      const defender = createTestUnit({ attack: 0, defense: 50, troopType: TroopType.ARCHER });

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValue(1.0); // 不暴击，随机波动1.0

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      // 有效攻击 = 100 × (1 + 0.2) = 120
      // 基础伤害 = max(1, 120 - 50) = 70
      expect(result.baseDamage).toBe(70);

      mockRandom.mockRestore();
    });

    it('攻击降低Debuff应减少伤害', () => {
      const attacker = createTestUnit({
        attack: 100,
        troopType: TroopType.ARCHER,
        buffs: [{ type: BuffType.ATK_DOWN, remainingTurns: 2, value: 0.3, sourceId: 's' }],
      });
      const defender = createTestUnit({ attack: 0, defense: 50, troopType: TroopType.ARCHER });

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValue(1.0);

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      // 有效攻击 = 100 × (1 - 0.3) = 70
      // 基础伤害 = max(1, 70 - 50) = 20
      expect(result.baseDamage).toBe(20);

      mockRandom.mockRestore();
    });

    it('防御提升Buff应减少受到的伤害', () => {
      const attacker = createTestUnit({ attack: 100, troopType: TroopType.ARCHER });
      const defender = createTestUnit({
        attack: 0,
        defense: 50,
        troopType: TroopType.ARCHER,
        buffs: [{ type: BuffType.DEF_UP, remainingTurns: 2, value: 0.5, sourceId: 's' }],
      });

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValue(1.0);

      const result = calculator.calculateDamage(attacker, defender, 1.0);

      // 有效防御 = 50 × (1 + 0.5) = 75
      // 基础伤害 = max(1, 100 - 75) = 25
      expect(result.baseDamage).toBe(25);

      mockRandom.mockRestore();
    });
  });

  // ── 攻击/防御加成计算 ──

  describe('getAttackBonus / getDefenseBonus', () => {
    it('应正确计算多个攻击Buff的叠加值', () => {
      const unit = createTestUnit({
        buffs: [
          { type: BuffType.ATK_UP, remainingTurns: 2, value: 0.1, sourceId: 's1' },
          { type: BuffType.ATK_UP, remainingTurns: 1, value: 0.15, sourceId: 's2' },
        ],
      });
      expect(getAttackBonus(unit)).toBeCloseTo(0.25, 4);
    });

    it('攻击提升和降低应互相抵消', () => {
      const unit = createTestUnit({
        buffs: [
          { type: BuffType.ATK_UP, remainingTurns: 2, value: 0.2, sourceId: 's1' },
          { type: BuffType.ATK_DOWN, remainingTurns: 1, value: 0.1, sourceId: 's2' },
        ],
      });
      expect(getAttackBonus(unit)).toBeCloseTo(0.1, 4);
    });

    it('无Buff时防御加成应为0', () => {
      const unit = createTestUnit();
      expect(getDefenseBonus(unit)).toBe(0);
    });
  });

  // ── 护盾 ──

  describe('护盾系统', () => {
    it('getShieldAmount应返回所有护盾总值', () => {
      const unit = createTestUnit({
        buffs: [
          { type: BuffType.SHIELD, remainingTurns: 2, value: 100, sourceId: 's1' },
          { type: BuffType.SHIELD, remainingTurns: 1, value: 50, sourceId: 's2' },
        ],
      });
      expect(getShieldAmount(unit)).toBe(150);
    });

    it('applyDamage应先扣除护盾再扣HP', () => {
      const unit = createTestUnit({
        hp: 1000,
        maxHp: 1000,
        isAlive: true,
        buffs: [
          { type: BuffType.SHIELD, remainingTurns: 2, value: 200, sourceId: 's1' },
        ],
      });

      const actualDamage = calculator.applyDamage(unit, 150);

      // 护盾吸收150，HP不变
      expect(actualDamage).toBe(0);
      expect(unit.hp).toBe(1000);
      expect(unit.buffs[0].value).toBe(50);
    });

    it('护盾不够时应继续扣HP', () => {
      const unit = createTestUnit({
        hp: 1000,
        maxHp: 1000,
        isAlive: true,
        buffs: [
          { type: BuffType.SHIELD, remainingTurns: 2, value: 100, sourceId: 's1' },
        ],
      });

      const actualDamage = calculator.applyDamage(unit, 300);

      // 护盾吸收100，HP扣200
      expect(actualDamage).toBe(200);
      expect(unit.hp).toBe(800);
      expect(unit.buffs).toHaveLength(0); // 护盾被消耗
    });
  });

  // ── applyDamage ──

  describe('applyDamage', () => {
    it('死亡单位不应受到伤害', () => {
      const unit = createTestUnit({ hp: 0, isAlive: false });
      expect(calculator.applyDamage(unit, 100)).toBe(0);
    });

    it('伤害超过剩余HP时应正确死亡', () => {
      const unit = createTestUnit({ hp: 50, maxHp: 1000, isAlive: true });
      const actualDamage = calculator.applyDamage(unit, 200);

      expect(actualDamage).toBe(50);
      expect(unit.hp).toBe(0);
      expect(unit.isAlive).toBe(false);
    });
  });

  // ── 持续伤害（DOT） ──

  describe('calculateDotDamage', () => {
    it('灼烧伤害应为最大HP的5%', () => {
      const unit = createTestUnit({
        maxHp: 1000,
        attack: 100,
        buffs: [
          { type: BuffType.BURN, remainingTurns: 2, value: 0, sourceId: 's' },
        ],
      });
      expect(calculator.calculateDotDamage(unit)).toBe(50); // 1000 × 5%
    });

    it('中毒伤害应为最大HP的3%', () => {
      const unit = createTestUnit({
        maxHp: 1000,
        attack: 100,
        buffs: [
          { type: BuffType.POISON, remainingTurns: 3, value: 0, sourceId: 's' },
        ],
      });
      expect(calculator.calculateDotDamage(unit)).toBe(30); // 1000 × 3%
    });

    it('流血伤害应为攻击力的10%', () => {
      const unit = createTestUnit({
        maxHp: 1000,
        attack: 200,
        buffs: [
          { type: BuffType.BLEED, remainingTurns: 2, value: 0, sourceId: 's' },
        ],
      });
      expect(calculator.calculateDotDamage(unit)).toBe(20); // 200 × 10%
    });

    it('多个DOT应叠加', () => {
      const unit = createTestUnit({
        maxHp: 1000,
        attack: 100,
        buffs: [
          { type: BuffType.BURN, remainingTurns: 2, value: 0, sourceId: 's' },
          { type: BuffType.POISON, remainingTurns: 3, value: 0, sourceId: 's' },
        ],
      });
      expect(calculator.calculateDotDamage(unit)).toBe(80); // 50 + 30
    });

    it('无DOT时伤害应为0', () => {
      const unit = createTestUnit();
      expect(calculator.calculateDotDamage(unit)).toBe(0);
    });
  });

  // ── 控制效果 ──

  describe('isControlled', () => {
    it('眩晕时应返回true', () => {
      const unit = createTestUnit({
        buffs: [{ type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: 's' }],
      });
      expect(calculator.isControlled(unit)).toBe(true);
    });

    it('冰冻时应返回true', () => {
      const unit = createTestUnit({
        buffs: [{ type: BuffType.FREEZE, remainingTurns: 1, value: 0, sourceId: 's' }],
      });
      expect(calculator.isControlled(unit)).toBe(true);
    });

    it('无控制效果时应返回false', () => {
      const unit = createTestUnit({
        buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: 0.1, sourceId: 's' }],
      });
      expect(calculator.isControlled(unit)).toBe(false);
    });
  });
});
