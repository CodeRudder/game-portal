/**
 * 战斗系统 — 类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 来源：CBT-3 战斗机制 PRD
 *
 * @module engine/battle/battle.types
 */

import type { Faction, GeneralStats, SkillData } from '../hero/hero.types';

export { BATTLE_CONFIG } from './battle-config';

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

// ─────────────────────────────────────────────
// 5. 队伍
// ─────────────────────────────────────────────

/**
 * 战斗队伍
 *
 * 最多6人：前排3 + 后排3
 */
export interface BattleTeam {
  /** 队伍成员 */
  units: BattleUnit[];
  /** 队伍阵营标识 */
  side: BattleSide;
}

// ─────────────────────────────────────────────
// 6. 伤害计算结果
// ─────────────────────────────────────────────

/**
 * 伤害计算结果
 *
 * 包含伤害的完整分解，用于战斗日志和UI展示
 */
export interface DamageResult {
  /** 最终伤害值 */
  damage: number;
  /** 基础伤害（攻击×倍率 - 防御×减免） */
  baseDamage: number;
  /** 技能倍率 */
  skillMultiplier: number;
  /** 是否暴击 */
  isCritical: boolean;
  /** 暴击系数（1.0 或 1.5） */
  criticalMultiplier: number;
  /** 克制系数（0.7 / 1.0 / 1.5） */
  restraintMultiplier: number;
  /** 随机波动系数（0.9~1.1） */
  randomFactor: number;
  /** 是否触发最低伤害保底 */
  isMinDamage: boolean;
}

// ─────────────────────────────────────────────
// 7. 战斗行动记录
// ─────────────────────────────────────────────

/**
 * 战斗行动记录
 *
 * 记录一个单位在一次行动中的完整信息
 */
export interface BattleAction {
  /** 回合数（从1开始） */
  turn: number;
  /** 行动者ID */
  actorId: string;
  /** 行动者名称 */
  actorName: string;
  /** 行动者阵营 */
  actorSide: BattleSide;
  /** 使用的技能（null表示被眩晕/冰冻无法行动） */
  skill: BattleSkill | null;
  /** 目标ID列表 */
  targetIds: string[];
  /** 各目标的伤害结果 */
  damageResults: Record<string, DamageResult>;
  /** 行动描述（用于战斗日志） */
  description: string;
  /** 是否为普攻 */
  isNormalAttack: boolean;
}

// ─────────────────────────────────────────────
// 8. 战斗状态
// ─────────────────────────────────────────────

/** 战斗阶段 */
export enum BattlePhase {
  /** 初始化 */
  INIT = 'INIT',
  /** 战斗进行中 */
  IN_PROGRESS = 'IN_PROGRESS',
  /** 战斗结束 */
  FINISHED = 'FINISHED',
}

/**
 * 战斗状态
 *
 * 包含战斗的完整运行时状态，可序列化用于存档/回放
 */
export interface BattleState {
  /** 战斗ID */
  id: string;
  /** 战斗阶段 */
  phase: BattlePhase;
  /** 当前回合数（从1开始） */
  currentTurn: number;
  /** 最大回合数 */
  maxTurns: number;
  /** 我方队伍 */
  allyTeam: BattleTeam;
  /** 敌方队伍 */
  enemyTeam: BattleTeam;
  /** 当前回合的行动顺序（按速度排序后的单位ID列表） */
  turnOrder: string[];
  /** 当前行动者在turnOrder中的索引 */
  currentActorIndex: number;
  /** 所有行动记录（按时间顺序） */
  actionLog: BattleAction[];
  /** 胜负结果（战斗结束后设置） */
  result: BattleResult | null;
}

// ─────────────────────────────────────────────
// 9. 战斗结果
// ─────────────────────────────────────────────

/** 战斗胜负 */
export enum BattleOutcome {
  /** 我方胜利 */
  VICTORY = 'VICTORY',
  /** 我方失败 */
  DEFEAT = 'DEFEAT',
  /** 平局（回合耗尽） */
  DRAW = 'DRAW',
}

/**
 * 星级评定
 *
 * 来源：CBT-1 星级评定
 * ★☆☆：通关（任意HP > 0）
 * ★★☆：通关 + 我方存活 ≥ 4人
 * ★★★：通关 + 我方存活 ≥ 4人 + 回合数 ≤ 6
 */
export enum StarRating {
  /** 未通关 */
  NONE = 0,
  /** ★☆☆ — 通关 */
  ONE = 1,
  /** ★★☆ — 通关 + 存活≥4 */
  TWO = 2,
  /** ★★★ — 通关 + 存活≥4 + 回合≤6 */
  THREE = 3,
}

/**
 * 战斗结果
 *
 * 包含胜负、星级评定、战斗统计等
 */
export interface BattleResult {
  /** 战斗胜负 */
  outcome: BattleOutcome;
  /** 星级评定 */
  stars: StarRating;
  /** 总回合数 */
  totalTurns: number;
  /** 我方存活人数 */
  allySurvivors: number;
  /** 敌方存活人数 */
  enemySurvivors: number;
  /** 我方总伤害输出 */
  allyTotalDamage: number;
  /** 敌方总伤害输出 */
  enemyTotalDamage: number;
  /** 最大单次伤害 */
  maxSingleDamage: number;
  /** 最大连击（连续暴击次数） */
  maxCombo: number;
  /** 战斗日志摘要 */
  summary: string;
}

// ─────────────────────────────────────────────
// 10. 伤害计算器接口（依赖注入）
// ─────────────────────────────────────────────

/**
 * 伤害计算器接口
 *
 * 通过接口解耦，方便测试和替换实现
 */
export interface IDamageCalculator {
  /** 计算伤害 */
  calculateDamage(
    attacker: BattleUnit,
    defender: BattleUnit,
    skillMultiplier: number,
  ): DamageResult;
  /** 应用伤害到防御方（扣除HP，考虑护盾） */
  applyDamage(defender: BattleUnit, damage: number): number;
  /** 计算状态效果的持续伤害（DOT） */
  calculateDotDamage(unit: BattleUnit): number;
  /** 检查单位是否被控制（无法行动） */
  isControlled(unit: BattleUnit): boolean;
}

// ─────────────────────────────────────────────
// 12. 战斗引擎接口
// ─────────────────────────────────────────────

/**
 * 战斗引擎接口
 *
 * 定义战斗引擎的公共API，UI层通过此接口与引擎交互
 */
export interface IBattleEngine {
  /** 初始化战斗 */
  initBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleState;
  /** 执行一个回合 */
  executeTurn(state: BattleState): BattleAction[];
  /** 检查战斗是否结束 */
  isBattleOver(state: BattleState): boolean;
  /** 获取战斗结果 */
  getBattleResult(state: BattleState): BattleResult;
  /** 运行完整战斗 */
  runFullBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleResult;
}

// ─────────────────────────────────────────────
// 13. 辅助类型
// ─────────────────────────────────────────────

/** 单位查找表 */
export type UnitMap = Map<string, BattleUnit>;

/** 创建战斗单位的输入参数 */
export interface CreateUnitParams {
  /** 单位ID */
  id: string;
  /** 名称 */
  name: string;
  /** 阵营 */
  faction: Faction;
  /** 兵种 */
  troopType: TroopType;
  /** 站位 */
  position: Position;
  /** 阵营标识 */
  side: BattleSide;
  /** 基础属性 */
  stats: GeneralStats;
  /** 最大生命值 */
  maxHp: number;
  /** 技能列表（来自GeneralDef） */
  skills: SkillData[];
}
