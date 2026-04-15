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

export {
  SiegeSystem,
  type WallSegment,
  type GateState,
  type MoraleModifier,
  type SiegeConfig,
  type SiegeEvent,
  type SiegeUnitLike,
} from './SiegeSystem';

export {
  SiegeMode,
  type SiegeModeOptions,
} from './SiegeMode';

export {
  TowerDefenseMode,
  type TowerDefenseConfig,
  type TowerDef,
  type PathNode,
  type EnemyWave,
  type Tower,
  type EnemyUnit,
  type TowerDefenseState,
} from './TowerDefenseMode';

export {
  NavalMode,
  type NavalConfig,
  type ShipDef,
  type ShipUnit,
  type Wind,
  type NavalState,
} from './NavalMode';

export {
  FightingMode,
  type FightingConfig,
  type FighterExtension,
  type FightAction,
  type FightingEvent,
  type AIStrategy,
  type FightingState,
} from './FightingMode';
