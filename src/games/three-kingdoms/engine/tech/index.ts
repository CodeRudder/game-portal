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
export { TechOfflineSystem } from './TechOfflineSystem';
export { AcademyResearchManager } from './AcademyResearchManager';
export type {
  TechBonusSnapshot,
  AcademyStateSnapshot,
} from './AcademyResearchManager';
export { AcademyResearchSystem } from './AcademyResearchSystem';
export type {
  CopperSpeedUpResult,
  IngotInstantResult,
  TechPreviewNode,
  TechTreePreview,
  BuildingBonusInjection,
} from './AcademyResearchSystem';

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
  COPPER_SPEEDUP_COST,
  COPPER_SPEEDUP_PROGRESS_PERCENT,
  COPPER_SPEEDUP_MAX_DAILY,
  RESEARCH_START_COPPER_COST,
  RESEARCH_START_TECH_POINT_MULTIPLIER,
  ACADEMY_TECH_CAP_MULTIPLIER,
  ACADEMY_RESEARCH_SPEED_PER_LEVEL,
  TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL,
  TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL,
  TECH_BATTLE_STAT_BONUS_PER_LEVEL,
  getNodesByPath,
  getNodesByTier,
  getMutexGroups,
  getQueueSizeForAcademyLevel,
  getTechPointProduction,
  getMaxResearchableTechCount,
  getAcademyResearchSpeedMultiplier,
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

// ── 离线研究类型 ──
export type {
  EfficiencyTier,
  OfflineTechProgress,
  EfficiencyCurvePoint,
  OfflineResearchPanel,
  OfflineResearchSaveData,
  ResearchSnapshotItem,
  OfflineResearchState,
} from '../../core/tech/offline-research.types';

export {
  OFFLINE_RESEARCH_DECAY_TIERS,
  MAX_OFFLINE_RESEARCH_SECONDS,
} from '../../core/tech/offline-research.types';
