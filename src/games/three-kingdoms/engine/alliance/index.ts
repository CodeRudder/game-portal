/**
 * 联盟系统 — 统一导出入口
 *
 * @module engine/alliance
 */

// 核心类型
export type {
  AllianceData,
  AllianceMember,
  AllianceApplication,
  AllianceAnnouncement,
  AllianceMessage,
  AllianceLevelConfig,
  AllianceCreateConfig,
  AllianceBoss,
  AllianceBossConfig,
  BossChallengeResult,
  BossDamageEntry,
  AllianceTaskDef,
  AllianceTaskInstance,
  AllianceTaskConfig,
  AllianceShopItem,
  AllianceShopConfig,
  AllianceRankType,
  AllianceRankEntry,
  AlliancePlayerState,
  AllianceSaveData,
} from '../../core/alliance/alliance.types';

export {
  AllianceRole,
  ApplicationStatus,
  BossStatus,
  AllianceTaskType,
  AllianceTaskStatus,
} from '../../core/alliance/alliance.types';

// AllianceSystem
export {
  AllianceSystem,
} from './AllianceSystem';

// 常量与工具函数（来自 alliance-constants.ts）
export {
  DEFAULT_CREATE_CONFIG,
  ALLIANCE_LEVEL_CONFIGS,
  ALLIANCE_SAVE_VERSION,
  createDefaultAlliancePlayerState,
  createAllianceData,
  generateId,
} from './alliance-constants';

// AllianceBossSystem
export {
  AllianceBossSystem,
  DEFAULT_BOSS_CONFIG,
  createBoss,
} from './AllianceBossSystem';

// AllianceShopSystem
export {
  AllianceShopSystem,
  DEFAULT_ALLIANCE_SHOP_ITEMS,
} from './AllianceShopSystem';

// AllianceTaskSystem
export {
  AllianceTaskSystem,
  DEFAULT_TASK_CONFIG,
  ALLIANCE_TASK_POOL,
} from './AllianceTaskSystem';
