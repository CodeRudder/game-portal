/**
 * DamageCalculator — 伤害计算管道
 *
 * 纯函数模块，无状态。提供伤害计算流程：
 * 闪避检查 → 元素克制 → 基础伤害 → 防御减伤 → 克制倍率 → 暴击 → 最终伤害
 *
 * 元素克制循环：fire > ice > thunder > fire
 * normal 属性无克制关系
 *
 * @module engines/idle/modules/battle/DamageCalculator
 */

// ============================================================
// 类型定义
// ============================================================

/** 伤害计算上下文 */
export interface DamageContext {
  /** 攻击者攻击力 */
  attackerAttack: number;
  /** 防御者防御力 */
  defenderDefense: number;
  /** 攻击者暴击率 (0-1) */
  attackerCritRate: number;
  /** 攻击者暴击倍率 (通常 1.5-2.0) */
  attackerCritMultiplier: number;
  /** 防御者闪避率 (0-1) */
  defenderEvasion: number;
  /** 攻击者元素属性 */
  attackerElement?: string;
  /** 防御者元素属性 */
  defenderElement?: string;
  /** 技能伤害（优先于攻击力） */
  skillDamage?: number;
}

/** 伤害结果 */
export interface DamageResult {
  /** 最终伤害值 */
  finalDamage: number;
  /** 是否暴击 */
  isCrit: boolean;
  /** 是否闪避 */
  isMiss: boolean;
  /** 元素克制效果 */
  effectiveness: 'normal' | 'super' | 'weak';
}

// ============================================================
// 元素克制表
// ============================================================

/**
 * 元素克制关系映射
 * key 克制 value 中的所有元素
 */
const ELEMENT_ADVANTAGE: Record<string, string[]> = {
  fire: ['ice'],
  ice: ['thunder'],
  thunder: ['fire'],
};

/**
 * 查询元素克制效果
 *
 * @param attackerElement - 攻击者元素
 * @param defenderElement - 防御者元素
 * @returns 克制效果类型
 */
export function getElementEffectiveness(
  attackerElement?: string,
  defenderElement?: string,
): 'normal' | 'super' | 'weak' {
  if (!attackerElement || !defenderElement) return 'normal';
  if (attackerElement === 'normal' || defenderElement === 'normal') return 'normal';
  if (attackerElement === defenderElement) return 'normal';

  const advantages = ELEMENT_ADVANTAGE[attackerElement];
  if (advantages && advantages.includes(defenderElement)) return 'super';

  const defenderAdvantages = ELEMENT_ADVANTAGE[defenderElement];
  if (defenderAdvantages && defenderAdvantages.includes(attackerElement)) return 'weak';

  return 'normal';
}

/**
 * 获取克制倍率
 *
 * @param effectiveness - 克制效果类型
 * @returns 倍率数值
 */
export function getEffectivenessMultiplier(effectiveness: 'normal' | 'super' | 'weak'): number {
  switch (effectiveness) {
    case 'super': return 1.5;
    case 'weak': return 0.5;
    case 'normal': return 1.0;
  }
}

// ============================================================
// 核心伤害计算
// ============================================================

/**
 * 计算伤害（纯函数）
 *
 * 流程：
 * 1. 闪避检查：random < evasion → miss
 * 2. 元素克制判定
 * 3. 基础伤害：skillDamage ?? attackerAttack
 * 4. 防御减伤：max(1, baseDmg - defense * 0.5)
 * 5. 克制倍率：super=1.5, weak=0.5, normal=1.0
 * 6. 暴击检查：random < critRate → dmg *= critMultiplier
 * 7. 最终伤害：Math.floor(dmg)
 *
 * @param ctx - 伤害计算上下文
 * @returns 伤害结果
 */
export function calculateDamage(ctx: DamageContext): DamageResult {
  // 1. 闪避检查
  if (Math.random() < ctx.defenderEvasion) {
    return {
      finalDamage: 0,
      isCrit: false,
      isMiss: true,
      effectiveness: 'normal',
    };
  }

  // 2. 元素克制
  const effectiveness = getElementEffectiveness(ctx.attackerElement, ctx.defenderElement);
  const effectivenessMult = getEffectivenessMultiplier(effectiveness);

  // 3. 基础伤害（skillDamage 为显式数值时优先使用，包括 0）
  const baseDamage = ctx.skillDamage !== undefined ? ctx.skillDamage : ctx.attackerAttack;

  // 4. 防御减伤
  const afterDefense = Math.max(1, baseDamage - ctx.defenderDefense * 0.5);

  // 5. 克制倍率
  let damage = afterDefense * effectivenessMult;

  // 6. 暴击检查
  let isCrit = false;
  if (Math.random() < ctx.attackerCritRate) {
    damage *= ctx.attackerCritMultiplier;
    isCrit = true;
  }

  // 7. 最终伤害
  return {
    finalDamage: Math.max(0, Math.floor(damage)),
    isCrit,
    isMiss: false,
    effectiveness,
  };
}
