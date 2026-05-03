/**
 * 兵营编队系统 — 模块入口
 *
 * @module engine/barracks
 */

export { BarracksFormationSystem } from './BarracksFormationSystem';
export type {
  BarracksResourcePool,
} from './BarracksFormationSystem';
export type {
  BarracksFormation,
  BarracksFormationState,
  BarracksFormationSaveData,
  TroopType,
  TrainingMode,
  TrainingResult,
} from './barracks.types';
export {
  MAX_BARRACKS_FORMATIONS,
  FORMATION_1_UNLOCK_LEVEL,
  FORMATION_2_UNLOCK_LEVEL,
  FORMATION_3_UNLOCK_LEVEL,
  DEFAULT_FORMATION_NAMES,
  TROOP_TYPE_LABELS,
} from './barracks.types';
