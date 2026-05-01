/**
 * DamageCalculator — 对抗性测试
 *
 * 目标：检测存活变异 M06 (finalDamage < minDamage → finalDamage <= minDamage)
 * 专门验证数值精确性和逻辑正确性
 */

import { vi } from 'vitest';
import {
  DamageCalculator,
  getRestraintMultiplier,
  getCriticalRate,
  getAttackBonus,
  getDefenseBonus,
  getShieldAmount,
} from '../DamageCalculator';
import type { BattleUnit } from '../battle.types';
import { BATTLE_CONFIG, BuffType, TroopType } from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

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

describe('DamageCalculator — 对抗性测试 (Adversarial)', () => {
  let calculator: DamageCalculator;

  beforeEach(() => {
    calculator = new DamageCalculator();
  });

  // ── 1. 最低伤害保底精确边界测试 ──
  // 针对 M06: finalDamage < minDamage → finalDamage <= minDamage
  // 当 finalDamage 恰好等于 minDamage 时，< 和 <= 行为不同

  it('当 finalDamage 恰好等于 minDamage 时，isMinDamage 应为 false（不触发保底）', () => {
    // 构造场景：让 finalDamage 精确等于 minDamage
    // minDamage = effectiveAttack * 0.1 = attack * 0.1 (无buff时)
    // 需要 finalDamage = attack * 0.1
    // finalDamage = baseDamage * skillMultiplier * critMult * restraint * randomFactor
    // 简化：让 attack=100, defense=0, skillMult=1, no crit, no restraint
    // baseDamage = max(1, 100-0) = 100
    // minDamage = 100 * 0.1 = 10
    // 需要 finalDamage = 10
    // finalDamage = 100 * 1 * 1 * 1 * randomFactor = 100 * randomFactor
    // randomFactor = 0.1 → 但范围是 0.9~1.1，无法达到
    // 换一种方式：用极低攻击力 + 高技能倍率来构造
    // attack=100, defense=99, skillMult=1
    // baseDamage = max(1, 100-99) = 1
    // minDamage = 100 * 0.1 = 10
    // finalDamage = 1 * 1 * 1 * 1 * randomFactor ≈ 1
    // finalDamage < minDamage → isMinDamage = true

    // 更好的方式：直接验证当 finalDamage == minDamage 时行为
    // attack=1000, defense=0, skillMult=0.1
    // baseDamage = 1000, minDamage = 1000*0.1 = 100
    // finalDamage = 1000 * 0.1 * 1 * 1 * randomFactor(0.9~1.1) = 90~110
    // 当 randomFactor=1.0 时，finalDamage = 100 = minDamage → 不应触发保底

    const attacker = createTestUnit({ attack: 1000, defense: 0, troopType: TroopType.ARCHER });
    const defender = createTestUnit({ attack: 0, defense: 0, troopType: TroopType.ARCHER });

    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValueOnce(0.99).mockReturnValueOnce(0.5); // randomFactor = 1.0

    const result = calculator.calculateDamage(attacker, defender, 0.1);
    // finalDamage = 1000 * 0.1 * 1.0 * 1.0 * 1.0 = 100
    // minDamage = 1000 * 0.1 = 100
    // finalDamage == minDamage → isMinDamage 应为 false
    expect(result.isMinDamage).toBe(false);
    expect(result.damage).toBe(100);

    mockRandom.mockRestore();
  });

  // ── 2. 最低伤害保底严格小于测试 ──
  it('当 finalDamage 比 minDamage 小 0.01 时，应触发保底', () => {
    // 构造 finalDamage 略小于 minDamage
    // attack=100, defense=0, skillMult=1, no crit, neutral restraint
    // baseDamage = 100, minDamage = 10
    // 需要 finalDamage < 10
    // finalDamage = 100 * 1 * 1 * 1 * randomFactor
    // randomFactor < 0.1 → 超出范围
    // 改用：attack=100, defense=95, skillMult=1
    // baseDamage = max(1, 5) = 5, minDamage = 100*0.1 = 10
    // finalDamage = 5 * 1 * 1 * 1 * randomFactor(0.9~1.1) = 4.5~5.5
    // 4.5 < 10 → isMinDamage = true ✓

    const attacker = createTestUnit({ attack: 100, defense: 0, troopType: TroopType.ARCHER });
    const defender = createTestUnit({ attack: 0, defense: 95, troopType: TroopType.ARCHER });

    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValueOnce(0.99).mockReturnValueOnce(0.5);

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    expect(result.isMinDamage).toBe(true);
    expect(result.damage).toBe(10); // 保底值 = 100 * 0.1 = 10

    mockRandom.mockRestore();
  });

  // ── 3. 伤害精确数值验证（无随机波动） ──
  it('无buff无克制无暴击时，伤害数值精确匹配公式', () => {
    const attacker = createTestUnit({ attack: 250, defense: 0, speed: 0, troopType: TroopType.ARCHER });
    const defender = createTestUnit({ attack: 0, defense: 80, troopType: TroopType.ARCHER });

    const mockRandom = vi.spyOn(Math, 'random');
    // speed=0 → critRate=0.05 → random=0.99 > 0.05 → no crit
    mockRandom.mockReturnValueOnce(0.99).mockReturnValueOnce(0.5); // randomFactor = 1.0

    const result = calculator.calculateDamage(attacker, defender, 1.5);

    // effectiveAttack = 250 * (1 + 0) = 250
    // effectiveDefense = 80 * (1 + 0) = 80
    // baseDamage = max(1, 250-80) = 170
    // damageAfterSkill = 170 * 1.5 = 255
    // critMult = 1.0, restraint = 1.0, random = 1.0
    // finalDamage = 255
    // minDamage = 250 * 0.1 = 25
    expect(result.baseDamage).toBe(170);
    expect(result.damage).toBe(255);
    expect(result.isMinDamage).toBe(false);

    mockRandom.mockRestore();
  });

  // ── 4. 克制系数精确验证 ──
  it('骑兵vs步兵克制系数必须精确为1.5', () => {
    expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY)).toBe(1.5);
  });

  it('步兵vs枪兵克制系数必须精确为1.5', () => {
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN)).toBe(1.5);
  });

  it('枪兵vs骑兵克制系数必须精确为1.5', () => {
    expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY)).toBe(1.5);
  });

  // ── 5. 被克制系数精确验证 ──
  it('步兵vs骑兵被克制系数必须精确为0.7', () => {
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY)).toBe(0.7);
  });

  // ── 6. 暴击率精确值验证 ──
  it('speed=50 时暴击率精确为 0.05 + 50/100 = 0.55', () => {
    expect(getCriticalRate(50)).toBeCloseTo(0.55, 10);
  });

  it('speed=0 时暴击率精确为 0.05', () => {
    expect(getCriticalRate(0)).toBeCloseTo(0.05, 10);
  });

  // ── 7. applyDamage 精确伤害扣除 ──
  it('applyDamage 精确扣除HP，不多不少', () => {
    const defender = createTestUnit({ hp: 500, maxHp: 1000 });
    const actualDamage = calculator.applyDamage(defender, 300);

    expect(actualDamage).toBe(300);
    expect(defender.hp).toBe(200);
    expect(defender.isAlive).toBe(true);
  });

  // ── 8. applyDamage 死亡边界 ──
  it('applyDamage 精确到0HP时标记死亡', () => {
    const defender = createTestUnit({ hp: 100, maxHp: 1000 });
    const actualDamage = calculator.applyDamage(defender, 100);

    expect(actualDamage).toBe(100);
    expect(defender.hp).toBe(0);
    expect(defender.isAlive).toBe(false);
  });

  // ── 9. 护盾吸收精确值 ──
  it('护盾完全吸收伤害时，HP不扣，返回0', () => {
    const defender = createTestUnit({
      hp: 500,
      maxHp: 1000,
      buffs: [{ type: BuffType.SHIELD, value: 200, duration: 1, source: 'test' }],
    });
    const actualDamage = calculator.applyDamage(defender, 150);

    // 150伤害 < 200护盾 → 护盾吸收150，HP不扣
    // applyDamage 返回的是对HP造成的伤害，不是总伤害
    expect(actualDamage).toBe(0);
    expect(defender.hp).toBe(500);
    expect(defender.buffs[0].value).toBe(50);
  });

  // ── 10. Buff加成精确值验证 ──
  // DEF-028: 乘法叠加 1.2 * 0.9 - 1 = 0.08
  it('ATK_UP +20% 和 ATK_DOWN -10% 叠加后精确为 +8%', () => {
    const unit = createTestUnit({
      buffs: [
        { type: BuffType.ATK_UP, value: 0.2, duration: 1, source: 'test' },
        { type: BuffType.ATK_DOWN, value: 0.1, duration: 1, source: 'test' },
      ],
    });
    expect(getAttackBonus(unit)).toBeCloseTo(0.08, 10);
  });
});
