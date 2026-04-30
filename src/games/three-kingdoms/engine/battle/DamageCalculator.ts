/**
 * 战斗系统 — 伤害计算器
 *
 * 职责：伤害公式计算、暴击判定、兵种克制、最低伤害保底
 * 公式来源：CBT-3 伤害计算公式
 *
 * 核心公式：
 *   基础伤害 = 攻击力 × (1 + 攻击加成) - 防御力 × (1 + 防御加成)
 *   最终伤害 = max(1, 基础伤害) × 技能倍率 × 暴击系数 × 克制系数 × 随机波动(0.9~1.1)
 *   最低伤害保底 = 攻击力 × 10%
 *
 * @module engine/battle/DamageCalculator
 */

import type {
  BattleUnit,
  DamageResult,
  IDamageCalculator,
} from './battle.types';
import {
  BuffType,
  TroopType,
} from './battle.types';
import { BATTLE_CONFIG } from './battle-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 兵种克制关系表
// ─────────────────────────────────────────────

/**
 * 兵种克制关系映射
 *
 * key = 攻击方兵种, value = 被克制的兵种
 * 骑兵 > 步兵 > 枪兵 > 骑兵（循环克制）
 * 弓兵、谋士无特殊克制
 */
const RESTRAINT_MAP: ReadonlyMap<TroopType, TroopType> = new Map([
  [TroopType.CAVALRY, TroopType.INFANTRY],   // 骑兵克制步兵
  [TroopType.INFANTRY, TroopType.SPEARMAN],  // 步兵克制枪兵
  [TroopType.SPEARMAN, TroopType.CAVALRY],   // 枪兵克制骑兵
]);

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 生成指定范围内的随机数
 *
 * @param min - 下限（含）
 * @param max - 上限（含）
 * @returns 范围内的随机浮点数
 */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * 计算攻击方对防御方的克制系数
 *
 * 克制关系：骑兵 > 步兵 > 枪兵 > 骑兵
 * 弓兵、谋士无特殊克制关系
 *
 * @param attackerTroop - 攻击方兵种
 * @param defenderTroop - 防御方兵种
 * @returns 克制系数（0.7 / 1.0 / 1.5）
 */
export function getRestraintMultiplier(
  attackerTroop: TroopType,
  defenderTroop: TroopType,
): number {
  // 弓兵、谋士无克制关系
  if (
    attackerTroop === TroopType.ARCHER ||
    attackerTroop === TroopType.STRATEGIST ||
    defenderTroop === TroopType.ARCHER ||
    defenderTroop === TroopType.STRATEGIST
  ) {
    return BATTLE_CONFIG.RESTRAINT_NEUTRAL;
  }

  // 检查克制关系
  const restrained = RESTRAINT_MAP.get(attackerTroop);
  if (restrained === defenderTroop) {
    return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; // 克制：×1.5
  }

  // 检查反向克制（被克制）
  const reverseRestrained = RESTRAINT_MAP.get(defenderTroop);
  if (reverseRestrained === attackerTroop) {
    return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; // 被克制：×0.7
  }

  return BATTLE_CONFIG.RESTRAINT_NEUTRAL; // 无克制：×1.0
}

/**
 * 计算暴击率
 *
 * 暴击率 = 基础5% + 速度/100
 * 上限100%
 *
 * @param speed - 攻击方速度
 * @returns 暴击率（0~1）
 */
export function getCriticalRate(speed: number): number {
  const rate =
    BATTLE_CONFIG.BASE_CRITICAL_RATE +
    speed / BATTLE_CONFIG.SPEED_CRITICAL_COEFFICIENT;
  return Math.min(1.0, Math.max(0.0, rate));
}

/**
 * 判定是否暴击
 *
 * @param speed - 攻击方速度
 * @returns 是否暴击
 */
export function rollCritical(speed: number): boolean {
  const rate = getCriticalRate(speed);
  return Math.random() < rate;
}

/**
 * 计算单位的攻击加成（来自Buff）
 *
 * @param unit - 战斗单位
 * @returns 攻击加成比例（如0.15表示+15%）
 */
export function getAttackBonus(unit: BattleUnit): number {
  let bonus = 0;
  for (const buff of unit.buffs) {
    if (buff.type === BuffType.ATK_UP) {
      // FIX-102: NaN 防护，防止 buff.value 为 NaN 污染伤害链
      bonus += Number.isFinite(buff.value) ? buff.value : 0;
    } else if (buff.type === BuffType.ATK_DOWN) {
      bonus -= Number.isFinite(buff.value) ? buff.value : 0;
    }
  }
  return bonus;
}

/**
 * 计算单位的防御加成（来自Buff）
 *
 * @param unit - 战斗单位
 * @returns 防御加成比例（如0.15表示+15%）
 */
export function getDefenseBonus(unit: BattleUnit): number {
  let bonus = 0;
  for (const buff of unit.buffs) {
    if (buff.type === BuffType.DEF_UP) {
      // FIX-102: NaN 防护，防止 buff.value 为 NaN 污染伤害链
      bonus += Number.isFinite(buff.value) ? buff.value : 0;
    } else if (buff.type === BuffType.DEF_DOWN) {
      bonus -= Number.isFinite(buff.value) ? buff.value : 0;
    }
  }
  return bonus;
}

/**
 * 计算护盾吸收量
 *
 * @param unit - 战斗单位
 * @returns 当前护盾总值
 */
export function getShieldAmount(unit: BattleUnit): number {
  let total = 0;
  for (const buff of unit.buffs) {
    if (buff.type === BuffType.SHIELD) {
      total += buff.value;
    }
  }
  return total;
}

// ─────────────────────────────────────────────
// DamageCalculator
// ─────────────────────────────────────────────

/**
 * 伤害计算器
 *
 * 实现完整的伤害计算流程：
 * 1. 计算攻击加成和防御加成
 * 2. 计算基础伤害（攻击×(1+加成) - 防御×(1+加成)）
 * 3. 应用技能倍率
 * 4. 判定暴击
 * 5. 计算克制系数
 * 6. 应用随机波动
 * 7. 最低伤害保底
 *
 * @example
 * ```ts
 * const calculator = new DamageCalculator();
 * const result = calculator.calculateDamage(attacker, defender, 1.5);
 * console.log(result.damage); // 最终伤害值
 * ```
 */
export class DamageCalculator implements IDamageCalculator, ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'damageCalculator' as const;
  private sysDeps: ISystemDeps | null = null;

  // ─────────────────────────────────────────
  // ISubsystem 适配层
  // ─────────────────────────────────────────

  /** ISubsystem.init — 注入依赖 */
  init(deps: ISystemDeps): void {
    this.sysDeps = deps;
  }

  /** ISubsystem.update — 伤害计算器无状态，不需要每帧更新 */
  update(_dt: number): void {
    // 伤害计算器是纯函数式调用，不需要每帧更新
  }

  /** ISubsystem.getState — 返回计算器状态 */
  getState(): { type: string } {
    return { type: 'DamageCalculator' };
  }

  /** ISubsystem.reset — 重置计算器（无状态，空操作） */
  reset(): void {
    // 伤害计算器无持久状态，无需重置
  }
  /**
   * 计算伤害
   *
   * @param attacker - 攻击方战斗单位
   * @param defender - 防御方战斗单位
   * @param skillMultiplier - 技能倍率（1.0=普攻，1.5~3.0=大招）
   * @returns 伤害计算结果
   */
  calculateDamage(
    attacker: BattleUnit,
    defender: BattleUnit,
    skillMultiplier: number,
  ): DamageResult {
    // 1. 计算攻击加成和防御加成
    const atkBonus = getAttackBonus(attacker);
    const defBonus = getDefenseBonus(defender);

    // 2. 计算有效攻击力和防御力
    const effectiveAttack = attacker.attack * (1 + atkBonus);
    const effectiveDefense = defender.defense * (1 + defBonus);

    // 3. 计算基础伤害
    const rawDamage = effectiveAttack - effectiveDefense;
    const baseDamage = Math.max(1, rawDamage);

    // DEF-006: NaN 防护，防止 baseDamage 为 NaN 传播到整个伤害链
    if (Number.isNaN(baseDamage)) {
      return {
        damage: 0,
        baseDamage: 0,
        skillMultiplier,
        isCritical: false,
        criticalMultiplier: 1.0,
        restraintMultiplier: 1.0,
        randomFactor: 1.0,
        isMinDamage: false,
      };
    }

    // FIX-103: skillMultiplier 负数/NaN/Infinity 防护，防止伤害变加血或传播 NaN
    if (!Number.isFinite(skillMultiplier) || skillMultiplier < 0) {
      return {
        damage: 0,
        baseDamage: Math.floor(baseDamage),
        skillMultiplier,
        isCritical: false,
        criticalMultiplier: 1.0,
        restraintMultiplier: 1.0,
        randomFactor: 1.0,
        isMinDamage: false,
      };
    }

    // 4. 应用技能倍率
    const damageAfterSkill = baseDamage * skillMultiplier;

    // 5. 判定暴击
    const isCritical = rollCritical(attacker.speed);
    const criticalMultiplier = isCritical
      ? BATTLE_CONFIG.CRITICAL_MULTIPLIER
      : 1.0;

    // 6. 计算克制系数
    const restraintMultiplier = getRestraintMultiplier(
      attacker.troopType,
      defender.troopType,
    );

    // 7. 随机波动
    const randomFactor = randomInRange(
      BATTLE_CONFIG.RANDOM_FACTOR_MIN,
      BATTLE_CONFIG.RANDOM_FACTOR_MAX,
    );

    // 8. 计算最终伤害
    let finalDamage = damageAfterSkill * criticalMultiplier * restraintMultiplier * randomFactor;

    // 9. 最低伤害保底：攻击力 × 10%
    const minDamage = effectiveAttack * BATTLE_CONFIG.MIN_DAMAGE_RATIO;
    const isMinDamage = finalDamage < minDamage;
    if (isMinDamage) {
      finalDamage = minDamage;
    }

    // DEF-006: 最终 NaN 防护（skillMultiplier 等参数可能为 NaN）
    if (Number.isNaN(finalDamage)) {
      return {
        damage: 0,
        baseDamage: Math.floor(baseDamage),
        skillMultiplier,
        isCritical,
        criticalMultiplier,
        restraintMultiplier,
        randomFactor,
        isMinDamage: false,
      };
    }

    return {
      damage: Math.floor(finalDamage),
      baseDamage: Math.floor(baseDamage),
      skillMultiplier,
      isCritical,
      criticalMultiplier,
      restraintMultiplier,
      randomFactor,
      isMinDamage,
    };
  }

  /**
   * 应用伤害到防御方（扣除HP，考虑护盾）
   *
   * @param defender - 防御方战斗单位
   * @param damage - 伤害值
   * @returns 实际造成的伤害值
   */
  applyDamage(defender: BattleUnit, damage: number): number {
    // DEF-006: NaN 防护，防止 NaN 沿调用链传播
    if (Number.isNaN(damage)) return 0;
    // DEF-005: 负伤害防护，防止负数伤害变成治疗
    if (damage <= 0) return 0;

    if (!defender.isAlive) return 0;

    let remainingDamage = damage;

    // 先扣除护盾
    const shieldAmount = getShieldAmount(defender);
    if (shieldAmount > 0 && remainingDamage > 0) {
      const shieldAbsorbed = Math.min(shieldAmount, remainingDamage);
      remainingDamage -= shieldAbsorbed;
      // 减少护盾值
      this.reduceShield(defender, shieldAbsorbed);
    }

    // 扣除HP
    const actualDamage = Math.min(remainingDamage, defender.hp);
    defender.hp -= actualDamage;

    // 检查死亡
    if (defender.hp <= 0) {
      defender.hp = 0;
      defender.isAlive = false;
    }

    return actualDamage;
  }

  /**
   * 减少护盾值
   *
   * @param unit - 战斗单位
   * @param amount - 需要减少的量
   */
  private reduceShield(unit: BattleUnit, amount: number): void {
    let remaining = amount;
    for (let i = unit.buffs.length - 1; i >= 0 && remaining > 0; i--) {
      const buff = unit.buffs[i];
      if (buff.type === BuffType.SHIELD) {
        const absorbed = Math.min(buff.value, remaining);
        buff.value -= absorbed;
        remaining -= absorbed;
        if (buff.value <= 0) {
          unit.buffs.splice(i, 1);
        }
      }
    }
  }

  /**
   * 计算状态效果的持续伤害（DOT）
   *
   * @param unit - 受到持续伤害的单位
   * @returns 本次回合受到的DOT总伤害
   */
  calculateDotDamage(unit: BattleUnit): number {
    let totalDot = 0;

    for (const buff of unit.buffs) {
      let dot = 0;
      switch (buff.type) {
        case BuffType.BURN:
          // 灼烧：最大HP的5%
          dot = Math.floor(unit.maxHp * BATTLE_CONFIG.BURN_DAMAGE_RATIO);
          break;
        case BuffType.POISON:
          // 中毒：最大HP的3%
          dot = Math.floor(unit.maxHp * BATTLE_CONFIG.POISON_DAMAGE_RATIO);
          break;
        case BuffType.BLEED:
          // 流血：攻击力的10%
          dot = Math.floor(unit.attack * BATTLE_CONFIG.BLEED_DAMAGE_RATIO);
          break;
      }
      // FIX-101: NaN/Infinity 防护，防止非有限值绕过 > 0 检查污染伤害链
      if (Number.isFinite(dot)) {
        totalDot += dot;
      }
    }

    // 最终防护：确保返回值为有限非负整数
    return Number.isFinite(totalDot) ? totalDot : 0;
  }

  /**
   * 检查单位是否被控制（无法行动）
   *
   * @param unit - 战斗单位
   * @returns 是否被控制
   */
  isControlled(unit: BattleUnit): boolean {
    return unit.buffs.some(
      (buff) => buff.type === BuffType.STUN || buff.type === BuffType.FREEZE,
    );
  }
}
