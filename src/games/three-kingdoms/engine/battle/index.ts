/**
 * 战斗系统 — 统一导出入口
 *
 * @module engine/battle
 */

// 类型
export type {
  BattleUnit,
  BattleTeam,
  BattleAction,
  BattleState,
  BattleResult,
  DamageResult,
  BuffEffect,
  BattleSkill,
  CreateUnitParams,
  UnitMap,
  Position,
  BattleSide,
  IDamageCalculator,
  IBattleEngine,
} from './battle.types';

export {
  TroopType,
  TROOP_TYPE_LABELS,
  BuffType,
  SkillTargetType,
  BattlePhase,
  BattleOutcome,
  StarRating,
} from './battle.types';

// 伤害计算器
export { DamageCalculator } from './DamageCalculator';
export {
  getRestraintMultiplier,
  getCriticalRate,
  rollCritical,
  getAttackBonus,
  getDefenseBonus,
  getShieldAmount,
} from './DamageCalculator';

// 战斗配置
export { BATTLE_CONFIG } from './battle-config';

// 战斗引擎
export { BattleEngine } from './BattleEngine';
export { BattleTurnExecutor } from './BattleTurnExecutor';
export {
  getAliveUnits,
  getAliveFrontUnits,
  getAliveBackUnits,
  sortBySpeed,
  getEnemyTeam,
  getAllyTeam,
  findUnitInTeam,
  findUnit,
} from './BattleTurnExecutor';
