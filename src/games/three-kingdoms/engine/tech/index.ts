/**
 * 科技域 — 统一导出入口
 */

export { TechTreeSystem } from './TechTreeSystem';
export { TechResearchSystem } from './TechResearchSystem';
export { TechPointSystem } from './TechPointSystem';
export { TechEffectSystem } from './TechEffectSystem';
export { FusionTechSystem } from './FusionTechSystem';
export { TechLinkSystem } from './TechLinkSystem';
export { TechDetailProvider } from './TechDetailProvider';

export type {
  EffectCategory,
  EffectStat,
  MilitaryStat,
  EconomyStat,
  CultureStat,
} from './TechEffectSystem';

export type {
  TechPath,
  TechNodeStatus,
  TechNodeDef,
  TechEffect,
  TechEffectType,
  TechEdge,
  TechNodeState,
  ResearchSlot,
  TechPointState,
  SpeedUpMethod,
  SpeedUpResult,
  StartResearchResult,
  TechState,
  TechSaveData,
} from './tech.types';

export {
  TECH_PATHS,
  TECH_PATH_LABELS,
  TECH_PATH_COLORS,
  TECH_PATH_ICONS,
} from './tech.types';

export {
  TECH_NODE_DEFS,
  TECH_NODE_MAP,
  TECH_EDGES,
  TECH_SAVE_VERSION,
  ACADEMY_QUEUE_SIZE_MAP,
  ACADEMY_TECH_POINT_PRODUCTION,
  MANDATE_SPEEDUP_SECONDS_PER_POINT,
  INGOT_SPEEDUP_SECONDS_PER_UNIT,
  getNodesByPath,
  getNodesByTier,
  getMutexGroups,
  getQueueSizeForAcademyLevel,
  getTechPointProduction,
} from './tech-config';

// ── 融合科技类型 ──
export type {
  FusionPathPair,
  FusionTechStatus,
  FusionPrerequisite,
  FusionTechDef,
  FusionTechState,
  FusionTechSystemState,
  FusionTechSaveData,
} from './fusion-tech.types';

// ── 融合科技配置 ──
export {
  FUSION_TECH_DEFS,
  FUSION_TECH_MAP,
} from './fusion-tech.types';

// ── 联动系统类型 ──
export type {
  LinkTarget,
  TechLinkEffect,
  BuildingLinkBonus,
  HeroLinkBonus,
  ResourceLinkBonus,
  TechLinkSystemState,
} from './TechLinkSystem';

// ── 详情数据类型 ──
export type {
  EffectDisplay,
  PrerequisiteDisplay,
  CostDisplay,
  TimeDisplay,
  LinkEffectDisplay,
  TechDetail,
} from './TechDetailProvider';
