/**
 * 联盟辅助功能 — 权限检查、工具方法、存档序列化
 *
 * 从 AllianceSystem.ts 拆分，解决500行限制
 *
 * @module engine/alliance/AllianceHelper
 */

import type {
  AllianceData,
  AlliancePlayerState,
  AllianceSaveData,
} from '../../core/alliance/alliance.types';
import { ApplicationStatus } from '../../core/alliance/alliance.types';
import {
  ALLIANCE_SAVE_VERSION,
  createDefaultAlliancePlayerState,
} from './alliance-constants';

// ─────────────────────────────────────────────
// 权限检查
// ─────────────────────────────────────────────

/**
 * 检查权限（内部）
 */
export function requirePermission(
  alliance: AllianceData,
  playerId: string,
  action: 'approve' | 'announce' | 'kick' | 'manage',
): void {
  const member = alliance.members[playerId];
  if (!member) throw new Error('不是联盟成员');
  const role = member.role;
  switch (action) {
    case 'approve': case 'announce': case 'kick':
      if (role !== 'LEADER' && role !== 'ADVISOR') throw new Error('权限不足，需要盟主或军师权限');
      break;
    case 'manage':
      if (role !== 'LEADER') throw new Error('权限不足，需要盟主权限');
      break;
  }
}

/**
 * 检查玩家是否有权限
 */
export function hasPermission(
  alliance: AllianceData,
  playerId: string,
  action: 'approve' | 'announce' | 'kick' | 'manage',
): boolean {
  try { requirePermission(alliance, playerId, action); return true; } catch { return false; }
}

// ─────────────────────────────────────────────
// 工具方法
// ─────────────────────────────────────────────

/** 获取成员列表 */
export function getMemberList(alliance: AllianceData) {
  return Object.values(alliance.members);
}

/** 获取待审批申请 */
export function getPendingApplications(alliance: AllianceData) {
  return alliance.applications.filter(a => a.status === ApplicationStatus.PENDING);
}

/** 获取置顶公告 */
export function getPinnedAnnouncements(alliance: AllianceData) {
  return alliance.announcements.filter(a => a.pinned);
}

/** 搜索联盟 */
export function searchAlliance(alliances: AllianceData[], keyword: string): AllianceData[] {
  const lower = keyword.toLowerCase();
  return alliances.filter(a => a.name.toLowerCase().includes(lower));
}

// ─────────────────────────────────────────────
// 存档序列化
// ─────────────────────────────────────────────

/** 序列化联盟存档 */
export function serializeAlliance(
  playerState: AlliancePlayerState,
  alliance: AllianceData | null,
): AllianceSaveData {
  return {
    version: ALLIANCE_SAVE_VERSION,
    playerState: { ...playerState },
    allianceData: alliance ? { ...alliance } : null,
  };
}

/** 反序列化联盟存档 */
export function deserializeAlliance(data: AllianceSaveData): {
  playerState: AlliancePlayerState;
  alliance: AllianceData | null;
} {
  if (!data || data.version !== ALLIANCE_SAVE_VERSION) {
    return { playerState: createDefaultAlliancePlayerState(), alliance: null };
  }
  return {
    playerState: { ...data.playerState },
    alliance: data.allianceData ? { ...data.allianceData } : null,
  };
}
