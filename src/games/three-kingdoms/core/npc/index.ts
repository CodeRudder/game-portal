/**
 * 核心层 — NPC 模块统一导出
 *
 * @module core/npc
 */

// 从 map 模块重新导出 NPC 系统依赖的地图类型
export type { GridPosition, RegionId } from '../map';

// 类型导出
export type {
  NPCProfession,
  NPCProfessionDef,
  NPCInteractionType,
  NPCId,
  NPCData,
  AffinityLevel,
  NPCMapDisplay,
  NPCClusterConfig,
  NPCPlacementResult,
  CrowdManagementConfig,
  NPCInfoPopup,
  NPCAction,
  DialogNodeId,
  DialogOption,
  DialogEffect,
  DialogNode,
  DialogTree,
  DialogSession,
  DialogHistoryEntry,
  NPCSystemState,
  NPCSaveData,
} from './npc.types';

export { AFFINITY_THRESHOLDS } from './npc.types';

// 配置导出
export {
  NPC_PROFESSION_DEFS,
  NPC_PROFESSIONS,
  NPC_PROFESSION_LABELS,
  DEFAULT_NPCS,
  DEFAULT_CLUSTER_CONFIG,
  DEFAULT_CROWD_CONFIG,
  DIALOG_TREES,
  DIALOG_TREE_MERCHANT,
  DIALOG_TREE_STRATEGIST,
  DIALOG_TREE_WARRIOR,
  DIALOG_TREE_ARTISAN,
  DIALOG_TREE_TRAVELER,
  DIALOG_MERCHANT_DEFAULT,
  DIALOG_STRATEGIST_DEFAULT,
  DIALOG_WARRIOR_DEFAULT,
  DIALOG_ARTISAN_DEFAULT,
  DIALOG_TRAVELER_DEFAULT,
  AFFINITY_LEVEL_LABELS,
  NPC_SAVE_VERSION,
  getAffinityLevel,
  getAffinityProgress,
  clampAffinity,
  getAvailableActions,
} from './npc-config';

// v6.0 好感度类型导出
export type {
  AffinityLevelEffect,
  AffinitySource,
  AffinityChangeRecord,
  AffinityGainConfig,
  BondSkillId,
  BondSkillDef,
  BondSkillEffect,
  AffinityVisualization,
  FavorabilityState,
  FavorabilitySaveData,
} from './favorability.types';

export {
  AFFINITY_LEVEL_EFFECTS,
  DEFAULT_AFFINITY_GAIN_CONFIG,
  BOND_SKILL_MERCHANT,
  BOND_SKILL_STRATEGIST,
  BOND_SKILL_WARRIOR,
  BOND_SKILL_ARTISAN,
  BOND_SKILL_TRAVELER,
  BOND_SKILLS,
} from './favorability.types';

// v7.0 巡逻路径类型导出
export type {
  PatrolPathId,
  PatrolPath,
  NPCPatrolState,
  PatrolAssignment,
  NPCSpawnTemplate,
  NPCSpawnConfig,
  NPCSpawnRecord,
  SpawnResult,
  PatrolSystemState,
  PatrolSaveData,
} from './patrol.types';

// v7.0 赠送系统类型导出
export type {
  ItemId,
  ItemRarity,
  ItemCategory,
  ItemDef,
  NPCPreference,
  GiftRequest,
  GiftResult,
  GiftSystemConfig,
  GiftSaveData,
} from './gift.types';
