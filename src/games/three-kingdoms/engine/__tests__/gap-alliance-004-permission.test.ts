/**
 * GAP-ALLIANCE-004: 联盟成员权限管理测试
 * 节点ID: ALLIANCE-005
 * 优先级: P1
 *
 * 覆盖：
 * - 盟主将成员提升为军师（副盟主）
 * - 军师降级为成员
 * - 军师权限验证：审批申请、发布公告、踢人
 * - 普通成员无权限操作
 * - 只有盟主可以设置角色
 * - 不能修改自己的角色
 * - 不能设置LEADER角色（需用转让功能）
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AllianceSystem } from '../alliance/AllianceSystem';
import { requirePermission, hasPermission } from '../alliance/AllianceHelper';
import type { AllianceData, AllianceRole } from '../../core/alliance/alliance.types';

function createMockAlliance(): AllianceData {
  return {
    id: 'alliance_1',
    name: '测试联盟',
    leaderId: 'leader',
    level: 1,
    experience: 0,
    members: {
      leader: { id: 'leader', name: '盟主', role: 'LEADER' as AllianceRole, power: 10000, joinDate: Date.now() },
      advisor: { id: 'advisor', name: '军师', role: 'ADVISOR' as AllianceRole, power: 8000, joinDate: Date.now() },
      member1: { id: 'member1', name: '成员1', role: 'MEMBER' as AllianceRole, power: 5000, joinDate: Date.now() },
      member2: { id: 'member2', name: '成员2', role: 'MEMBER' as AllianceRole, power: 3000, joinDate: Date.now() },
    },
    announcements: [],
    messages: [],
    applications: [],
    settings: {
      minPower: 0,
      autoAccept: false,
      description: '',
    },
    createdAt: Date.now(),
  };
}

describe('GAP-ALLIANCE-004: 联盟成员权限管理', () => {
  let allianceSys: AllianceSystem;
  let alliance: AllianceData;

  beforeEach(() => {
    vi.restoreAllMocks();
    allianceSys = new AllianceSystem();
    alliance = createMockAlliance();
  });

  // ═══════════════════════════════════════════
  // 1. 角色变更
  // ═══════════════════════════════════════════
  describe('setRole — 角色变更', () => {
    it('盟主可将成员提升为军师', () => {
      const result = allianceSys.setRole(alliance, 'leader', 'member1', 'ADVISOR');
      expect(result.members.member1.role).toBe('ADVISOR');
    });

    it('盟主可将军师降级为成员', () => {
      const result = allianceSys.setRole(alliance, 'leader', 'advisor', 'MEMBER');
      expect(result.members.advisor.role).toBe('MEMBER');
    });

    it('非盟主不可设置角色', () => {
      expect(() => allianceSys.setRole(alliance, 'member1', 'member2', 'ADVISOR')).toThrow('只有盟主可以设置角色');
    });

    it('军师不可设置角色', () => {
      expect(() => allianceSys.setRole(alliance, 'advisor', 'member1', 'ADVISOR')).toThrow('只有盟主可以设置角色');
    });

    it('不能修改自己的角色', () => {
      expect(() => allianceSys.setRole(alliance, 'leader', 'leader', 'MEMBER')).toThrow('不能修改自己的角色');
    });

    it('不能设置LEADER角色', () => {
      expect(() => allianceSys.setRole(alliance, 'leader', 'member1', 'LEADER')).toThrow('请使用转让盟主功能');
    });

    it('目标不是联盟成员时抛出错误', () => {
      expect(() => allianceSys.setRole(alliance, 'leader', 'nonexistent', 'ADVISOR')).toThrow('目标不是联盟成员');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 军师权限验证
  // ═══════════════════════════════════════════
  describe('军师权限验证', () => {
    it('军师有审批申请权限', () => {
      expect(hasPermission(alliance, 'advisor', 'approve')).toBe(true);
    });

    it('军师有发布公告权限', () => {
      expect(hasPermission(alliance, 'advisor', 'announce')).toBe(true);
    });

    it('军师有踢人权限', () => {
      expect(hasPermission(alliance, 'advisor', 'kick')).toBe(true);
    });

    it('军师无管理权限', () => {
      expect(hasPermission(alliance, 'advisor', 'manage')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 盟主权限验证
  // ═══════════════════════════════════════════
  describe('盟主权限验证', () => {
    it('盟主有审批申请权限', () => {
      expect(hasPermission(alliance, 'leader', 'approve')).toBe(true);
    });

    it('盟主有发布公告权限', () => {
      expect(hasPermission(alliance, 'leader', 'announce')).toBe(true);
    });

    it('盟主有踢人权限', () => {
      expect(hasPermission(alliance, 'leader', 'kick')).toBe(true);
    });

    it('盟主有管理权限', () => {
      expect(hasPermission(alliance, 'leader', 'manage')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 普通成员权限验证
  // ═══════════════════════════════════════════
  describe('普通成员权限验证', () => {
    it('普通成员无审批申请权限', () => {
      expect(hasPermission(alliance, 'member1', 'approve')).toBe(false);
    });

    it('普通成员无发布公告权限', () => {
      expect(hasPermission(alliance, 'member1', 'announce')).toBe(false);
    });

    it('普通成员无踢人权限', () => {
      expect(hasPermission(alliance, 'member1', 'kick')).toBe(false);
    });

    it('普通成员无管理权限', () => {
      expect(hasPermission(alliance, 'member1', 'manage')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 非成员权限检查
  // ═══════════════════════════════════════════
  describe('非成员权限检查', () => {
    it('非联盟成员无任何权限', () => {
      expect(hasPermission(alliance, 'nonexistent', 'approve')).toBe(false);
      expect(hasPermission(alliance, 'nonexistent', 'announce')).toBe(false);
      expect(hasPermission(alliance, 'nonexistent', 'kick')).toBe(false);
      expect(hasPermission(alliance, 'nonexistent', 'manage')).toBe(false);
    });

    it('requirePermission 非成员抛出错误', () => {
      expect(() => requirePermission(alliance, 'nonexistent', 'approve')).toThrow('不是联盟成员');
    });
  });

  // ═══════════════════════════════════════════
  // 6. 踢人权限
  // ═══════════════════════════════════════════
  describe('踢人权限', () => {
    it('盟主可以踢出成员', () => {
      const result = allianceSys.kickMember(alliance, 'leader', 'member1');
      expect(result.members.member1).toBeUndefined();
    });

    it('军师可以踢出成员', () => {
      const result = allianceSys.kickMember(alliance, 'advisor', 'member1');
      expect(result.members.member1).toBeUndefined();
    });

    it('不能踢出盟主', () => {
      expect(() => allianceSys.kickMember(alliance, 'advisor', 'leader')).toThrow('不能踢出盟主');
    });

    it('不能踢出自己', () => {
      expect(() => allianceSys.kickMember(alliance, 'member1', 'member1')).toThrow('不能踢出自己');
    });
  });

  // ═══════════════════════════════════════════
  // 7. 角色变更后权限立即生效
  // ═══════════════════════════════════════════
  describe('角色变更后权限立即生效', () => {
    it('成员提升为军师后立即获得权限', () => {
      const updated = allianceSys.setRole(alliance, 'leader', 'member1', 'ADVISOR');

      expect(hasPermission(updated, 'member1', 'approve')).toBe(true);
      expect(hasPermission(updated, 'member1', 'announce')).toBe(true);
      expect(hasPermission(updated, 'member1', 'kick')).toBe(true);
    });

    it('军师降级为成员后立即失去权限', () => {
      const updated = allianceSys.setRole(alliance, 'leader', 'advisor', 'MEMBER');

      expect(hasPermission(updated, 'advisor', 'approve')).toBe(false);
      expect(hasPermission(updated, 'advisor', 'announce')).toBe(false);
      expect(hasPermission(updated, 'advisor', 'kick')).toBe(false);
    });
  });
});
