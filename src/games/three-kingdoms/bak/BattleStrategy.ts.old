/**
 * 三国霸业 — 战斗策略系统
 *
 * 包含三大策略维度：
 * - 兵种克制（Troop Counter）：步兵克弓兵、骑兵克步兵、弓兵克骑兵
 * - 阵型系统（Formation）：普通/攻击/防御/伏击四种阵型
 * - 武将技能（General Skill）：攻击/增益/减益/治疗四类技能
 *
 * @module games/three-kingdoms/BattleStrategy
 */

// ═══════════════════════════════════════════════════════════════
// 兵种克制系统
// ═══════════════════════════════════════════════════════════════

/** 兵种类型 */
export type TroopType = 'infantry' | 'cavalry' | 'archer';

/** 兵种克制关系表：key 克制 value */
export const COUNTER_TABLE: Record<TroopType, TroopType> = {
  infantry: 'archer',   // 步兵克弓兵
  cavalry: 'infantry',  // 骑兵克步兵
  archer: 'cavalry',    // 弓兵克骑兵
};

/** 兵种中文名称 */
export const TROOP_TYPE_NAMES: Record<TroopType, string> = {
  infantry: '步兵',
  cavalry: '骑兵',
  archer: '弓兵',
};

/** 克制加成：攻击克制目标时伤害 +30% */
export const COUNTER_ADVANTAGE = 0.3;

/** 被克制惩罚：攻击被克制目标时伤害 -20% */
export const COUNTER_DISADVANTAGE = -0.2;

/**
 * 获取兵种克制关系
 *
 * @param attacker 攻击方兵种
 * @param defender 防御方兵种
 * @returns 克制倍率（1.3=克制, 0.8=被克制, 1.0=无克制关系）
 */
export function getCounterMultiplier(attacker: TroopType, defender: TroopType): number {
  if (COUNTER_TABLE[attacker] === defender) {
    return 1 + COUNTER_ADVANTAGE;
  }
  if (COUNTER_TABLE[defender] === attacker) {
    return 1 + COUNTER_DISADVANTAGE;
  }
  return 1.0;
}

/**
 * 判断是否克制
 */
export function isCounter(attacker: TroopType, defender: TroopType): boolean {
  return COUNTER_TABLE[attacker] === defender;
}

// ═══════════════════════════════════════════════════════════════
// 阵型系统
// ═══════════════════════════════════════════════════════════════

/** 阵型类型 */
export enum Formation {
  /** 普通阵型：无特殊效果 */
  STANDARD = 'standard',
  /** 攻击阵型：攻击+20%，防御-10% */
  OFFENSIVE = 'offensive',
  /** 防御阵型：防御+20%，攻击-10% */
  DEFENSIVE = 'defensive',
  /** 伏击阵型：首回合攻击+50% */
  AMBUSH = 'ambush',
}

/** 阵型效果配置 */
export interface FormationEffect {
  /** 攻击倍率修正 */
  attackMod: number;
  /** 防御倍率修正 */
  defenseMod: number;
  /** 首回合额外攻击加成 */
  firstRoundBonus: number;
  /** 阵型显示名 */
  label: string;
  /** 阵型描述 */
  description: string;
  /** 阵型图标 */
  icon: string;
}

/** 各阵型的效果配置 */
export const FORMATION_EFFECTS: Record<Formation, FormationEffect> = {
  [Formation.STANDARD]: {
    attackMod: 0,
    defenseMod: 0,
    firstRoundBonus: 0,
    label: '普通阵型',
    description: '无特殊效果',
    icon: '⚔️',
  },
  [Formation.OFFENSIVE]: {
    attackMod: 0.2,
    defenseMod: -0.1,
    firstRoundBonus: 0,
    label: '攻击阵型',
    description: '攻击+20%，防御-10%',
    icon: '🗡️',
  },
  [Formation.DEFENSIVE]: {
    attackMod: -0.1,
    defenseMod: 0.2,
    firstRoundBonus: 0,
    label: '防御阵型',
    description: '防御+20%，攻击-10%',
    icon: '🛡️',
  },
  [Formation.AMBUSH]: {
    attackMod: 0,
    defenseMod: 0,
    firstRoundBonus: 0.5,
    label: '伏击阵型',
    description: '首回合攻击+50%',
    icon: '🌙',
  },
};

/**
 * 计算阵型攻击加成
 *
 * @param formation 阵型类型
 * @param round 当前回合（从1开始）
 * @returns 攻击倍率修正
 */
export function getFormationAttackMod(formation: Formation, round: number): number {
  const effect = FORMATION_EFFECTS[formation];
  let mod = effect.attackMod;
  // 伏击阵型：仅首回合额外加成
  if (formation === Formation.AMBUSH && round === 1) {
    mod += effect.firstRoundBonus;
  }
  return mod;
}

/**
 * 计算阵型防御加成
 *
 * @param formation 阵型类型
 * @returns 防御倍率修正
 */
export function getFormationDefenseMod(formation: Formation): number {
  return FORMATION_EFFECTS[formation].defenseMod;
}

// ═══════════════════════════════════════════════════════════════
// 武将技能系统
// ═══════════════════════════════════════════════════════════════

/** 技能类型 */
export type SkillType = 'attack' | 'buff' | 'debuff' | 'heal';

/** 技能目标 */
export type SkillTarget = 'enemy_all' | 'enemy_single' | 'ally_all' | 'ally_single';

/** 武将技能定义 */
export interface GeneralSkill {
  /** 技能名称 */
  name: string;
  /** 技能类型 */
  type: SkillType;
  /** 技能目标 */
  target: SkillTarget;
  /** 威力倍率 */
  power: number;
  /** 冷却回合数 */
  cooldown: number;
  /** 技能描述 */
  description: string;
}

/** 技能释放结果 */
export interface SkillResult {
  /** 技能名称 */
  skillName: string;
  /** 技能类型 */
  type: SkillType;
  /** 造成的伤害/治疗量 */
  value: number;
  /** 日志描述 */
  log: string;
}

/** 技能冷却状态跟踪 */
export class SkillCooldownTracker {
  private cooldowns: Map<string, number> = new Map();

  /**
   * 检查技能是否可用
   */
  isAvailable(skillName: string): boolean {
    return (this.cooldowns.get(skillName) ?? 0) <= 0;
  }

  /**
   * 使用技能并设置冷却
   */
  use(skill: GeneralSkill): void {
    this.cooldowns.set(skill.name, skill.cooldown);
  }

  /**
   * 每回合减少冷却
   */
  tick(): void {
    for (const [name, cd] of this.cooldowns) {
      if (cd > 0) {
        this.cooldowns.set(name, cd - 1);
      }
    }
  }

  /**
   * 获取技能当前冷却
   */
  getCooldown(skillName: string): number {
    return this.cooldowns.get(skillName) ?? 0;
  }
}

/**
 * 计算技能效果值
 *
 * @param skill 技能定义
 * @param basePower 基础战力值
 * @returns 技能效果值
 */
export function calculateSkillValue(skill: GeneralSkill, basePower: number): number {
  return Math.floor(basePower * skill.power);
}

/**
 * 释放技能
 *
 * @param skill 技能定义
 * @param basePower 基础战力值
 * @param tracker 冷却追踪器
 * @param generalName 武将名称
 * @returns 技能结果，若冷却中返回 null
 */
export function executeSkill(
  skill: GeneralSkill,
  basePower: number,
  tracker: SkillCooldownTracker,
  generalName: string,
): SkillResult | null {
  if (!tracker.isAvailable(skill.name)) {
    return null;
  }

  tracker.use(skill);
  const value = calculateSkillValue(skill, basePower);

  let log = '';
  switch (skill.type) {
    case 'attack':
      log = `✨ ${generalName}发动【${skill.name}】！造成${value}点伤害！`;
      break;
    case 'buff':
      log = `✨ ${generalName}发动【${skill.name}】！我方战力提升${value}！`;
      break;
    case 'debuff':
      log = `✨ ${generalName}发动【${skill.name}】！敌方战力降低${value}！`;
      break;
    case 'heal':
      log = `✨ ${generalName}发动【${skill.name}】！恢复${value}兵力！`;
      break;
  }

  return { skillName: skill.name, type: skill.type, value, log };
}

// ═══════════════════════════════════════════════════════════════
// 战斗策略配置（传入 calculateBattle 的参数）
// ═══════════════════════════════════════════════════════════════

/** 战斗策略参数 */
export interface BattleStrategy {
  /** 玩家选择的阵型 */
  formation?: Formation;
  /** 玩家武将 ID（用于查找技能） */
  generalId?: string;
}
