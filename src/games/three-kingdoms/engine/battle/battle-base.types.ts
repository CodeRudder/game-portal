/**
 * 战斗系统 — 基础类型定义（无外部依赖）
 *
 * 提取 battle.types.ts 中被 battle-v4.types.ts 引用的基础类型，
 * 避免循环依赖。
 *
 * 包含：兵种枚举、状态效果、技能目标、战斗技能、战斗单位、站位、阵营标识
 *
 * @module engine/battle/battle-base.types
 */

import type { Faction } from '../hero/hero.types';

// ─────────────────────────────────────────────
// 1. 兵种枚举
// ─────────────────────────────────────────────

/**
 * 兵种类型
 *
 * 克制关系：骑兵 > 步兵 > 枪兵 > 骑兵（循环克制）
 * 弓兵、谋士无特殊克制关系
 */
export enum TroopType {
  /** 骑兵 — 克制步兵，被枪兵克制 */
  CAVALRY = 'CAVALRY',
  /** 步兵 — 克制枪兵，被骑兵克制 */
  INFANTRY = 'INFANTRY',
  /** 枪兵 — 克制骑兵，被步兵克制 */
  SPEARMAN = 'SPEARMAN',
  /** 弓兵 — 无特殊克制 */
  ARCHER = 'ARCHER',
  /** 谋士 — 无特殊克制 */
  STRATEGIST = 'STRATEGIST',
}

/** 兵种中文名映射 */
export const TROOP_TYPE_LABELS: Record<TroopType, string> = {
  [TroopType.CAVALRY]: '骑兵',
  [TroopType.INFANTRY]: '步兵',
  [TroopType.SPEARMAN]: '枪兵',
  [TroopType.ARCHER]: '弓兵',
  [TroopType.STRATEGIST]: '谋士',
};

// ─────────────────────────────────────────────
// 2. 状态效果（Buff/Debuff）
// ─────────────────────────────────────────────

/**
 * 状态效果类型
 *
 * 来源：CBT-3 状态效果
 */
export enum BuffType {
  /** 灼烧 — 每回合损失最大HP的5%，持续2~3回合 */
  BURN = 'BURN',
  /** 冰冻 — 无法行动，持续1回合 */
  FREEZE = 'FREEZE',
  /** 中毒 — 每回合损失最大HP的3%，持续3回合 */
  POISON = 'POISON',
  /** 眩晕 — 无法行动，持续1回合 */
  STUN = 'STUN',
  /** 流血 — 每回合损失攻击力10%的HP，持续2~3回合 */
  BLEED = 'BLEED',
  /** 攻击提升 — 攻击力+N% */
  ATK_UP = 'ATK_UP',
  /** 攻击降低 — 攻击力-N% */
  ATK_DOWN = 'ATK_DOWN',
  /** 防御提升 — 防御力+N% */
  DEF_UP = 'DEF_UP',
  /** 防御降低 — 防御力-N% */
  DEF_DOWN = 'DEF_DOWN',
  /** 护盾 — 吸收一定量伤害 */
  SHIELD = 'SHIELD',
}

/** 状态效果数据 */
export interface BuffEffect {
  /** 状态类型 */
  type: BuffType;
  /** 剩余回合数 */
  remainingTurns: number;
  /** 效果数值（百分比或固定值） */
  value: number;
  /** 效果来源单位ID */
  sourceId: string;
}

// ─────────────────────────────────────────────
// 3. 战斗技能
// ─────────────────────────────────────────────

/** 技能目标类型 */
export enum SkillTargetType {
  /** 单体 — 攻击敌方单体 */
  SINGLE_ENEMY = 'SINGLE_ENEMY',
  /** 前排 — 攻击敌方前排 */
  FRONT_ROW = 'FRONT_ROW',
  /** 后排 — 攻击敌方后排 */
  BACK_ROW = 'BACK_ROW',
  /** 全体 — 攻击敌方全体 */
  ALL_ENEMY = 'ALL_ENEMY',
  /** 自身 */
  SELF = 'SELF',
  /** 己方单体 */
  SINGLE_ALLY = 'SINGLE_ALLY',
  /** 己方全体 */
  ALL_ALLY = 'ALL_ALLY',
}

/** 战斗技能数据 */
export interface BattleSkill {
  /** 技能ID */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能类型 */
  type: 'active' | 'passive' | 'faction' | 'awaken';
  /** 技能等级 */
  level: number;
  /** 技能描述 */
  description: string;
  /** 技能伤害倍率（1.0 = 普攻，1.5~3.0 = 大招） */
  multiplier: number;
  /** 目标类型 */
  targetType: SkillTargetType;
  /** 怒气消耗（0 = 被动/普攻，>0 = 大招消耗） */
  rageCost: number;
  /** 冷却回合数（0 = 无冷却） */
  cooldown: number;
  /** 当前冷却剩余回合数 */
  currentCooldown: number;
  /** 附带的Buff/Debuff效果 */
  buffs?: BuffEffect[];
}

// ─────────────────────────────────────────────
// 4. 战斗单位
// ─────────────────────────────────────────────

/** 站位位置 */
export type Position = 'front' | 'back';

/** 战斗单位阵营标识 */
export type BattleSide = 'ally' | 'enemy';

/**
 * 战斗单位
 *
 * 包含武将/敌方NPC在战斗中的所有运行时数据。
 * 由 GeneralDef 或敌方配置初始化生成。
 */
export interface BattleUnit {
  /** 单位唯一ID */
  id: string;
  /** 单位名称 */
  name: string;
  /** 所属阵营（蜀/魏/吴/群） */
  faction: Faction;
  /** 兵种类型 */
  troopType: TroopType;
  /** 站位（前排/后排） */
  position: Position;
  /** 阵营标识（我方/敌方） */
  side: BattleSide;

  // ── 基础属性 ──
  /** 当前攻击力（含Buff/Debuff修正） */
  attack: number;
  /** 基础攻击力（无Buff时的原始值） */
  baseAttack: number;
  /** 当前防御力（含Buff/Debuff修正） */
  defense: number;
  /** 基础防御力 */
  baseDefense: number;
  /** 智力 */
  intelligence: number;
  /** 速度 — 决定行动顺序 */
  speed: number;

  // ── 生命值 ──
  /** 当前生命值 */
  hp: number;
  /** 最大生命值 */
  maxHp: number;
  /** 是否存活 */
  isAlive: boolean;

  // ── 怒气系统 ──
  /** 当前怒气值（0~100） */
  rage: number;
  /** 最大怒气值 */
  maxRage: number;

  // ── 技能 ──
  /** 普攻技能（倍率1.0） */
  normalAttack: BattleSkill;
  /** 主动技能列表 */
  skills: BattleSkill[];

  // ── 状态效果 ──
  /** 当前身上的Buff/Debuff列表 */
  buffs: BuffEffect[];
}
