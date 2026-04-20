/**
 * 核心层 — NPC 模块统一导出
 *
 * @module core/npc
 */

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

// 常量导出
export { AFFINITY_THRESHOLDS } from './npc.types';

// 配置导出
export {
  NPC_PROFESSION_DEFS,
  NPC_PROFESSIONS,
  DEFAULT_NPCS,
  DIALOG_MERCHANT_DEFAULT,
  DIALOG_STRATEGIST_DEFAULT,
  DIALOG_WARRIOR_DEFAULT,
  DIALOG_ARTISAN_DEFAULT,
  DIALOG_TRAVELER_DEFAULT,
  DIALOG_TREES,
  DEFAULT_CLUSTER_CONFIG,
  DEFAULT_CROWD_CONFIG,
  NPC_SAVE_VERSION,
  getAffinityLevel,
  getAffinityProgress,
  clampAffinity,
} from './npc-config';
