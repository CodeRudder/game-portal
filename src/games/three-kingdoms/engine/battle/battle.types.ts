/**
 * 战斗系统 — 类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 来源：CBT-3 战斗机制 PRD
 *
 * @module engine/battle/battle.types
 */

import type { Faction, GeneralStats, SkillData } from '../hero/hero.types';
import type {
  BuffEffect,
  BattleSkill,
  Position,
  BattleSide,
  BattleUnit,
} from './battle-base.types';
import {
  TroopType,
  TROOP_TYPE_LABELS,
  BuffType,
  SkillTargetType,
} from './battle-base.types';

export { BATTLE_CONFIG } from './battle-config';

// 从基础模块重导出（避免与 battle-ultimate.types 循环依赖）
export {
  TroopType,
  TROOP_TYPE_LABELS,
  BuffType,
  SkillTargetType,
} from './battle-base.types';
export type {
  BuffEffect,
  BattleSkill,
  Position,
  BattleSide,
  BattleUnit,
} from './battle-base.types';

// ─────────────────────────────────────────────
// 1~4. 基础类型已移至 battle-base.types.ts
// ─────────────────────────────────────────────

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
 * 包含胜负、星级评定、战斗统计、碎片奖励等
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
  /** 碎片奖励（胜利时按敌方配置产出，失败时为空） */
  fragmentRewards: Record<string, number>;
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

// ─────────────────────────────────────────────
// 14~16. v4.0 扩展类型（从 battle-ultimate.types 导入）
// ─────────────────────────────────────────────

export {
  TimeStopState,
  BattleSpeed,
  BattleMode,
} from './battle-ultimate.types';

export type {
  UltimateTimeStopEvent,
  IUltimateTimeStopHandler,
  UltimateReadyResult,
  BattleSpeedState,
  SpeedChangeEvent,
  IBattleEngineV4,
} from './battle-ultimate.types';
