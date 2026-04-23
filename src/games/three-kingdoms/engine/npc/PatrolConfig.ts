/**
 * NPC 巡逻配置 — 常量
 *
 * 从 NPCPatrolSystem 中提取，保持主文件精简。
 *
 * @module engine/npc/PatrolConfig
 */

import type { NPCSpawnConfig } from '../../core/npc';

/** 巡逻存档版本 */
export const PATROL_SAVE_VERSION = 1;

/** 默认刷新配置 */
export const DEFAULT_SPAWN_CONFIG: NPCSpawnConfig = {
  spawnInterval: 30,
  maxNPCCount: 20,
  maxNPCPerRegion: 8,
  npcLifetime: 0,
  autoSpawnEnabled: true,
};
