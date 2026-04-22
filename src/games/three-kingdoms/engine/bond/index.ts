/**
 * 羁绊域 — 统一导出入口
 *
 * @module engine/bond
 */

export { BondSystem } from './BondSystem';

// 核心类型（从 core 层重新导出）
export type {
  BondType,
  BondEffect,
  ActiveBond,
  FormationBondPreview,
  BondPotentialTip,
  StoryEventCondition,
  StoryEventReward,
  StoryEventDef,
  HeroFavorability,
  BondSaveData,
} from '../../core/bond';

export {
  BOND_NAMES,
  BOND_DESCRIPTIONS,
  BOND_SAVE_VERSION,
} from '../../core/bond';
