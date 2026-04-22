/**
 * 联盟系统 — 引擎层
 *
 * 职责：联盟创建/加入/退出、三级权限管理、频道公告、联盟等级与福利
 * 规则：
 *   - 创建消耗元宝×500
 *   - 三级权限：盟主(全部) / 军师(审批+公告+踢人) / 成员(基础)
 *   - 成员上限：初始20人, 每级+5, 上限50人
 *   - 置顶公告最多3条
 *   - 联盟经验来源：成员日常+任务+Boss击杀
 *
 * @module engine/alliance/AllianceSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AllianceData,
  AllianceRole,
  AllianceApplication,
  AllianceAnnouncement,
  AllianceMessage,
  AllianceCreateConfig,
  AlliancePlayerState,
  AllianceSaveData,
} from '../../core/alliance/alliance.types';
import { ApplicationStatus } from '../../core/alliance/alliance.types';
import {
  DEFAULT_CREATE_CONFIG,
  ALLIANCE_LEVEL_CONFIGS,
  ALLIANCE_SAVE_VERSION,
  generateId,
  createDefaultAlliancePlayerState,
  createAllianceData,
} from './alliance-constants';
import * as AllianceHelper from './AllianceHelper';

// 重新导出常量供外部使用
export {
  DEFAULT_CREATE_CONFIG,
  ALLIANCE_LEVEL_CONFIGS,
  ALLIANCE_SAVE_VERSION,
  createDefaultAlliancePlayerState,
  createAllianceData,
};

/**
 * 联盟系统
 *
 * 管理联盟CRUD、成员权限、等级福利
 */
export class AllianceSystem implements ISubsystem {
  readonly name = 'AllianceSystem';
  private deps!: ISystemDeps;
  private createConfig: AllianceCreateConfig;

  constructor(createConfig?: Partial<AllianceCreateConfig>) {
    this.createConfig = { ...DEFAULT_CREATE_CONFIG, ...createConfig };
  }

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    /* 预留 */
  }

  getState(): Record<string, unknown> {
    return {
      createConfig: this.createConfig,
    };
  }

  reset(): void {
    /* 联盟数据由外部管理，此处无内部状态需重置 */
  }

  // ── 联盟创建与加入 ────────────────────────

  createAlliance(
    playerState: AlliancePlayerState,
    name: string,
    declaration: string,
    playerId: string,
    playerName: string,
    now: number,
  ): { playerState: AlliancePlayerState; alliance: AllianceData } {
    if (playerState.allianceId) {
      throw new Error('已在联盟中，无法创建');
    }
    if (name.length < this.createConfig.nameMinLength || name.length > this.createConfig.nameMaxLength) {
      throw new Error(`联盟名称长度需在${this.createConfig.nameMinLength}~${this.createConfig.nameMaxLength}之间`);
    }
    const id = generateId('ally');
    const alliance = createAllianceData(id, name, declaration, playerId, playerName, now);
    return {
      playerState: { ...playerState, allianceId: id },
      alliance,
    };
  }

  applyToJoin(
    alliance: AllianceData,
    playerState: AlliancePlayerState,
    playerId: string,
    playerName: string,
    power: number,
    now: number,
  ): AllianceData {
    if (playerState.allianceId) throw new Error('已在联盟中');
    const existing = alliance.applications.find(
      a => a.playerId === playerId && a.status === ApplicationStatus.PENDING,
    );
    if (existing) throw new Error('已提交申请，请等待审批');
    const levelConfig = this.getLevelConfig(alliance.level);
    const memberCount = Object.keys(alliance.members).length;
    if (memberCount >= levelConfig.maxMembers) throw new Error('联盟成员已满');

    const application: AllianceApplication = {
      id: generateId('app'),
      allianceId: alliance.id,
      playerId,
      playerName,
      power,
      timestamp: now,
      status: ApplicationStatus.PENDING,
    };
    return { ...alliance, applications: [...alliance.applications, application] };
  }

  approveApplication(
    alliance: AllianceData,
    applicationId: string,
    operatorId: string,
    now: number,
  ): AllianceData {
    this.requirePermission(alliance, operatorId, 'approve');
    const app = alliance.applications.find(a => a.id === applicationId);
    if (!app) throw new Error('申请不存在');
    if (app.status !== ApplicationStatus.PENDING) throw new Error('申请已处理');
    const levelConfig = this.getLevelConfig(alliance.level);
    if (Object.keys(alliance.members).length >= levelConfig.maxMembers) {
      throw new Error('联盟成员已满');
    }
    const newMember = {
      playerId: app.playerId, playerName: app.playerName,
      role: 'MEMBER' as AllianceRole, power: app.power,
      joinTime: now, dailyContribution: 0, totalContribution: 0, dailyBossChallenges: 0,
    };
    return {
      ...alliance,
      members: { ...alliance.members, [app.playerId]: newMember },
      applications: alliance.applications.map(a =>
        a.id === applicationId ? { ...a, status: ApplicationStatus.APPROVED } : a,
      ),
    };
  }

  rejectApplication(alliance: AllianceData, applicationId: string, operatorId: string): AllianceData {
    this.requirePermission(alliance, operatorId, 'approve');
    const app = alliance.applications.find(a => a.id === applicationId);
    if (!app) throw new Error('申请不存在');
    if (app.status !== ApplicationStatus.PENDING) throw new Error('申请已处理');
    return {
      ...alliance,
      applications: alliance.applications.map(a =>
        a.id === applicationId ? { ...a, status: ApplicationStatus.REJECTED } : a,
      ),
    };
  }

  leaveAlliance(
    alliance: AllianceData,
    playerState: AlliancePlayerState,
    playerId: string,
  ): { alliance: AllianceData | null; playerState: AlliancePlayerState } {
    if (!alliance.members[playerId]) throw new Error('不是联盟成员');
    if (playerId === alliance.leaderId) throw new Error('盟主需先转让才能退出');
    const { [playerId]: _, ...remainingMembers } = alliance.members;
    const newState: AlliancePlayerState = { ...playerState, allianceId: '' };
    if (Object.keys(remainingMembers).length === 0) {
      return { alliance: null, playerState: newState };
    }
    return { alliance: { ...alliance, members: remainingMembers }, playerState: newState };
  }

  // ── 成员管理 ──────────────────────────────

  kickMember(alliance: AllianceData, operatorId: string, targetId: string): AllianceData {
    this.requirePermission(alliance, operatorId, 'kick');
    if (!alliance.members[targetId]) throw new Error('目标不是联盟成员');
    if (targetId === alliance.leaderId) throw new Error('不能踢出盟主');
    if (targetId === operatorId) throw new Error('不能踢出自己');
    const { [targetId]: _, ...remainingMembers } = alliance.members;
    return { ...alliance, members: remainingMembers };
  }

  transferLeadership(alliance: AllianceData, currentLeaderId: string, newLeaderId: string): AllianceData {
    if (alliance.leaderId !== currentLeaderId) throw new Error('只有盟主可以转让');
    if (!alliance.members[newLeaderId]) throw new Error('目标不是联盟成员');
    if (currentLeaderId === newLeaderId) throw new Error('不能转让给自己');
    return {
      ...alliance,
      leaderId: newLeaderId,
      members: {
        ...alliance.members,
        [currentLeaderId]: { ...alliance.members[currentLeaderId], role: 'MEMBER' as AllianceRole },
        [newLeaderId]: { ...alliance.members[newLeaderId], role: 'LEADER' as AllianceRole },
      },
    };
  }

  setRole(alliance: AllianceData, operatorId: string, targetId: string, role: AllianceRole): AllianceData {
    if (alliance.leaderId !== operatorId) throw new Error('只有盟主可以设置角色');
    if (!alliance.members[targetId]) throw new Error('目标不是联盟成员');
    if (role === 'LEADER') throw new Error('请使用转让盟主功能');
    if (targetId === operatorId) throw new Error('不能修改自己的角色');
    return {
      ...alliance,
      members: { ...alliance.members, [targetId]: { ...alliance.members[targetId], role } },
    };
  }

  // ── 频道与公告 ──────────────────────────────

  postAnnouncement(
    alliance: AllianceData, authorId: string, authorName: string,
    content: string, pinned: boolean, now: number,
  ): AllianceData {
    this.requirePermission(alliance, authorId, 'announce');
    if (!content.trim()) throw new Error('公告内容不能为空');
    if (pinned) {
      const pinnedCount = alliance.announcements.filter(a => a.pinned).length;
      if (pinnedCount >= this.createConfig.maxPinnedAnnouncements) {
        throw new Error(`置顶公告最多${this.createConfig.maxPinnedAnnouncements}条`);
      }
    }
    const announcement: AllianceAnnouncement = {
      id: generateId('ann'), authorId, authorName, content, pinned, timestamp: now,
    };
    return { ...alliance, announcements: [...alliance.announcements, announcement] };
  }

  sendMessage(
    alliance: AllianceData, senderId: string, senderName: string, content: string, now: number,
  ): AllianceData {
    if (!alliance.members[senderId]) throw new Error('不是联盟成员');
    if (!content.trim()) throw new Error('消息内容不能为空');
    const message: AllianceMessage = {
      id: generateId('msg'), senderId, senderName, content, timestamp: now,
    };
    const messages = [...alliance.messages, message];
    if (messages.length > this.createConfig.maxMessages) {
      messages.splice(0, messages.length - this.createConfig.maxMessages);
    }
    return { ...alliance, messages };
  }

  // ── 联盟等级与福利 ──────────────────────────

  addExperience(alliance: AllianceData, exp: number): AllianceData {
    let newExp = alliance.experience + exp;
    let newLevel = alliance.level;
    const maxLevel = ALLIANCE_LEVEL_CONFIGS.length;
    while (newLevel < maxLevel) {
      const nextConfig = ALLIANCE_LEVEL_CONFIGS[newLevel];
      if (nextConfig && newExp >= nextConfig.requiredExp) { newLevel++; } else { break; }
    }
    return { ...alliance, experience: newExp, level: newLevel };
  }

  getLevelConfig(level: number) {
    const idx = Math.min(level, ALLIANCE_LEVEL_CONFIGS.length) - 1;
    return ALLIANCE_LEVEL_CONFIGS[Math.max(0, idx)];
  }

  getBonuses(alliance: AllianceData): { resourceBonus: number; expeditionBonus: number } {
    const config = this.getLevelConfig(alliance.level);
    return { resourceBonus: config.resourceBonus, expeditionBonus: config.expeditionBonus };
  }

  getMaxMembers(level: number): number {
    return this.getLevelConfig(level).maxMembers;
  }

  // ── 每日重置 ──────────────────────────────

  dailyReset(alliance: AllianceData, playerState: AlliancePlayerState): {
    alliance: AllianceData; playerState: AlliancePlayerState;
  } {
    const members: Record<string, import('../../core/alliance/alliance.types').AllianceMember> = {};
    for (const [id, m] of Object.entries(alliance.members)) {
      members[id] = { ...m, dailyContribution: 0, dailyBossChallenges: 0 };
    }
    return {
      alliance: {
        ...alliance, members, bossKilledToday: false,
        dailyTaskCompleted: 0, lastDailyReset: Date.now(),
      },
      playerState: {
        ...playerState, dailyBossChallenges: 0,
        dailyContribution: 0, lastDailyReset: Date.now(),
      },
    };
  }

  // ── 权限检查（委托 AllianceHelper） ──

  private requirePermission(
    alliance: AllianceData, playerId: string,
    action: 'approve' | 'announce' | 'kick' | 'manage',
  ): void {
    AllianceHelper.requirePermission(alliance, playerId, action);
  }

  hasPermission(
    alliance: AllianceData, playerId: string,
    action: 'approve' | 'announce' | 'kick' | 'manage',
  ): boolean {
    return AllianceHelper.hasPermission(alliance, playerId, action);
  }

  // ── 工具方法（委托 AllianceHelper） ──

  getMemberList(alliance: AllianceData) {
    return AllianceHelper.getMemberList(alliance);
  }

  getPendingApplications(alliance: AllianceData) {
    return AllianceHelper.getPendingApplications(alliance);
  }

  getPinnedAnnouncements(alliance: AllianceData) {
    return AllianceHelper.getPinnedAnnouncements(alliance);
  }

  searchAlliance(alliances: AllianceData[], keyword: string): AllianceData[] {
    return AllianceHelper.searchAlliance(alliances, keyword);
  }

  // ── 存档序列化（委托 AllianceHelper） ──

  serialize(playerState: AlliancePlayerState, alliance: AllianceData | null): AllianceSaveData {
    return AllianceHelper.serializeAlliance(playerState, alliance);
  }

  deserialize(data: AllianceSaveData): {
    playerState: AlliancePlayerState; alliance: AllianceData | null;
  } {
    return AllianceHelper.deserializeAlliance(data);
  }
}
