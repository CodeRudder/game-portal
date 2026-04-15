/**
 * battle 模块索引
 *
 * 导出 BattleEngine 和所有战斗相关类型
 *
 * @module engines/idle/modules/battle
 */

export {
  BattleEngine,
  type BattleModeType,
  type BattleUnitDef,
  type BattleSkillDef,
  type BattleEffectDef,
  type BattleConfig,
  type BattleSkill,
  type BattleBuff,
  type BattleUnit,
  type DamageResult as BattleDamageResult,
  type BattleStats,
  type BattleResult,
  type BattleEngineState,
  type BattleEngineEvent,
} from './BattleEngine';

export {
  calculateDamage,
  getElementEffectiveness,
  getEffectivenessMultiplier,
  type DamageContext,
  type DamageResult,
} from './DamageCalculator';
