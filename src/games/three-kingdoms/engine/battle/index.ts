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
  // v4.0 新增类型
  UltimateTimeStopEvent,
  IUltimateTimeStopHandler,
  UltimateReadyResult,
  BattleSpeedState,
  SpeedChangeEvent,
  IBattleEngineV4,
} from './battle.types';

export {
  TroopType,
  TROOP_TYPE_LABELS,
  BuffType,
  SkillTargetType,
  BattlePhase,
  BattleOutcome,
  StarRating,
  // v4.0 新增枚举
  TimeStopState,
  BattleSpeed,
  BattleMode,
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

// v4.0：大招时停系统
export { UltimateSkillSystem } from './UltimateSkillSystem';

// v4.0：战斗加速控制器
export { BattleSpeedController } from './BattleSpeedController';
export type { ISpeedChangeListener } from './BattleSpeedController';

// v4.0：科技效果应用器
export { BattleEffectApplier } from './BattleEffectApplier';
export type {
  EffectElement,
  EffectTrigger,
  SkillEffectConfig,
  EnhancedBattleStats,
  EnhancedDamageResult,
} from './BattleEffectApplier';

// v4.0：伤害数字动画系统
export { DamageNumberSystem, DamageNumberType, TrajectoryType } from './DamageNumberSystem';
export type {
  TrajectoryConfig,
  DamageNumber,
  MergedDamageNumber,
  DamageNumberConfig,
} from './DamageNumberSystem';
