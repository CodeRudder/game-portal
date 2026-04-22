/**
 * 联盟系统 — 常量与工具函数
 *
 * 包含：创建配置、等级配置表、存档版本、ID生成、默认状态创建
 *
 * @module engine/alliance/alliance-constants
 */

import type {
  AllianceData,
  AllianceMember,
  AllianceRole,
  AllianceLevelConfig,
  AllianceCreateConfig,
  AlliancePlayerState,
} from '../../core/alliance/alliance.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认创建配置 */
export const DEFAULT_CREATE_CONFIG: AllianceCreateConfig = {
  createCostGold: 500,
  nameMinLength: 2,
  nameMaxLength: 8,
  maxPinnedAnnouncements: 3,
  maxMessages: 100,
};

/** 联盟等级配置表 */
export const ALLIANCE_LEVEL_CONFIGS: AllianceLevelConfig[] = [
  { level: 1, requiredExp: 0, maxMembers: 20, resourceBonus: 0, expeditionBonus: 0 },
  { level: 2, requiredExp: 1000, maxMembers: 25, resourceBonus: 2, expeditionBonus: 1 },
  { level: 3, requiredExp: 3000, maxMembers: 30, resourceBonus: 4, expeditionBonus: 2 },
  { level: 4, requiredExp: 6000, maxMembers: 35, resourceBonus: 6, expeditionBonus: 3 },
  { level: 5, requiredExp: 10000, maxMembers: 40, resourceBonus: 8, expeditionBonus: 4 },
  { level: 6, requiredExp: 15000, maxMembers: 45, resourceBonus: 10, expeditionBonus: 5 },
  { level: 7, requiredExp: 21000, maxMembers: 50, resourceBonus: 12, expeditionBonus: 6 },
];

/** 存档版本 */
export const ALLIANCE_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一ID */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建默认玩家联盟状态 */
export function createDefaultAlliancePlayerState(): AlliancePlayerState {
  return {
    allianceId: '',
    guildCoins: 0,
    dailyBossChallenges: 0,
    dailyContribution: 0,
    lastDailyReset: 0,
    weeklyRetroactiveCount: 0,
    lastRetroactiveReset: 0,
  };
}

/** 创建默认联盟数据 */
export function createAllianceData(
  id: string,
  name: string,
  declaration: string,
  leaderId: string,
  leaderName: string,
  now: number,
): AllianceData {
  const leader: AllianceMember = {
    playerId: leaderId,
    playerName: leaderName,
    role: 'LEADER' as AllianceRole,
    power: 0,
    joinTime: now,
    dailyContribution: 0,
    totalContribution: 0,
    dailyBossChallenges: 0,
  };

  return {
    id,
    name,
    declaration,
    leaderId,
    level: 1,
    experience: 0,
    members: { [leaderId]: leader },
    applications: [],
    announcements: [],
    messages: [],
    createTime: now,
    bossKilledToday: false,
    lastBossRefreshTime: now,
    dailyTaskCompleted: 0,
    lastDailyReset: now,
  };
}
