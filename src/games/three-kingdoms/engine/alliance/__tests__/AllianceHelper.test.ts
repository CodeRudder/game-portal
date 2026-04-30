/**
 * AllianceHelper 单元测试
 *
 * 覆盖：
 * 1. requirePermission / hasPermission — 权限检查
 * 2. getMemberList — 获取成员列表
 * 3. getPendingApplications — 待审批申请
 * 4. getPinnedAnnouncements — 置顶公告
 * 5. searchAlliance — 搜索联盟
 * 6. serializeAlliance / deserializeAlliance — 存档
 */

import {
  requirePermission,
  hasPermission,
  getMemberList,
  getPendingApplications,
  getPinnedAnnouncements,
  searchAlliance,
  serializeAlliance,
  deserializeAlliance,
} from '../AllianceHelper';

import { ApplicationStatus } from '../../../core/alliance/alliance.types';
import { createDefaultAlliancePlayerState } from '../alliance-constants';

import type { AllianceData, AlliancePlayerState } from '../../../core/alliance/alliance.types';

describe('AllianceHelper', () => {
  const makeAlliance = (overrides?: Partial<AllianceData>): AllianceData => ({
    id: 'alliance_1',
    name: '测试联盟',
    level: 1,
    experience: 0,
    members: {
      leader: { playerId: 'leader', name: '盟主', role: 'LEADER', joinedAt: 0, contribution: 0 },
      advisor: { playerId: 'advisor', name: '军师', role: 'ADVISOR', joinedAt: 0, contribution: 0 },
      member: { playerId: 'member', name: '成员', role: 'MEMBER', joinedAt: 0, contribution: 0 },
    },
    applications: [
      { playerId: 'applicant', name: '申请人', status: ApplicationStatus.PENDING, appliedAt: 0 },
      { playerId: 'rejected', name: '被拒者', status: ApplicationStatus.REJECTED, appliedAt: 0 },
    ],
    announcements: [
      { id: 'ann_1', content: '置顶公告', authorId: 'leader', createdAt: 0, pinned: true },
      { id: 'ann_2', content: '普通公告', authorId: 'leader', createdAt: 0, pinned: false },
    ],
    maxMembers: 30,
    ...overrides,
  });

  // ─── requirePermission ────────────────────

  describe('requirePermission', () => {
    it('非成员应抛错', () => {
      const alliance = makeAlliance();
      expect(() => requirePermission(alliance, 'stranger', 'approve')).toThrow('不是联盟成员');
    });

    it('MEMBER 无 approve 权限', () => {
      const alliance = makeAlliance();
      expect(() => requirePermission(alliance, 'member', 'approve')).toThrow('权限不足');
    });

    it('ADVISOR 有 approve 权限', () => {
      const alliance = makeAlliance();
      expect(() => requirePermission(alliance, 'advisor', 'approve')).not.toThrow();
    });

    it('LEADER 有 manage 权限', () => {
      const alliance = makeAlliance();
      expect(() => requirePermission(alliance, 'leader', 'manage')).not.toThrow();
    });

    it('ADVISOR 无 manage 权限', () => {
      const alliance = makeAlliance();
      expect(() => requirePermission(alliance, 'advisor', 'manage')).toThrow('权限不足');
    });
  });

  // ─── hasPermission ────────────────────────

  describe('hasPermission', () => {
    it('有权限应返回 true', () => {
      const alliance = makeAlliance();
      expect(hasPermission(alliance, 'leader', 'manage')).toBe(true);
    });

    it('无权限应返回 false', () => {
      const alliance = makeAlliance();
      expect(hasPermission(alliance, 'member', 'kick')).toBe(false);
    });

    it('非成员应返回 false', () => {
      const alliance = makeAlliance();
      expect(hasPermission(alliance, 'stranger', 'approve')).toBe(false);
    });
  });

  // ─── getMemberList ────────────────────────

  describe('getMemberList', () => {
    it('应返回所有成员', () => {
      const alliance = makeAlliance();
      const members = getMemberList(alliance);
      expect(members.length).toBe(3);
    });
  });

  // ─── getPendingApplications ───────────────

  describe('getPendingApplications', () => {
    it('应只返回待审批申请', () => {
      const alliance = makeAlliance();
      const pending = getPendingApplications(alliance);
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe(ApplicationStatus.PENDING);
    });
  });

  // ─── getPinnedAnnouncements ───────────────

  describe('getPinnedAnnouncements', () => {
    it('应只返回置顶公告', () => {
      const alliance = makeAlliance();
      const pinned = getPinnedAnnouncements(alliance);
      expect(pinned.length).toBe(1);
      expect(pinned[0].pinned).toBe(true);
    });
  });

  // ─── searchAlliance ───────────────────────

  describe('searchAlliance', () => {
    it('应按名称搜索', () => {
      const alliances = [
        makeAlliance({ name: '三国联盟' }),
        makeAlliance({ name: '天下会' }),
        makeAlliance({ name: '三国英雄' }),
      ];
      const result = searchAlliance(alliances, '三国');
      expect(result.length).toBe(2);
    });

    it('不匹配应返回空', () => {
      const result = searchAlliance([makeAlliance()], '不存在');
      expect(result).toEqual([]);
    });

    it('应不区分大小写', () => {
      const alliances = [makeAlliance({ name: 'Test Alliance' })];
      const result = searchAlliance(alliances, 'test');
      expect(result.length).toBe(1);
    });
  });

  // ─── 序列化 ───────────────────────────────

  describe('serializeAlliance / deserializeAlliance', () => {
    it('应正确序列化和反序列化', () => {
      const playerState = createDefaultAlliancePlayerState();
      const alliance = makeAlliance();
      const data = serializeAlliance(playerState, alliance);

      const result = deserializeAlliance(data);
      expect(result.playerState).toBeDefined();
      expect(result.alliance).not.toBeNull();
      expect(result.alliance!.name).toBe('测试联盟');
    });

    it('无联盟数据应序列化为 null', () => {
      const playerState = createDefaultAlliancePlayerState();
      const data = serializeAlliance(playerState, null);
      expect(data.allianceData).toBeNull();
    });

    it('版本不匹配应返回默认值', () => {
      const result = deserializeAlliance({ version: 999, playerState: createDefaultAlliancePlayerState(), allianceData: null });
      expect(result.alliance).toBeNull();
    });

    it('null data 应返回默认值', () => {
      const result = deserializeAlliance(null as unknown as string);
      expect(result.alliance).toBeNull();
    });
  });
});
