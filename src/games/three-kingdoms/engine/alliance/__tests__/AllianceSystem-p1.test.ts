/**
 * AllianceSystem 单元测试
 *
 * 覆盖：
 *   - 联盟创建与加入
 *   - 成员管理（三级权限）
 *   - 频道与公告
 *   - 联盟等级与福利
 *   - 每日重置
 *   - 存档序列化
 */

import {
  AllianceSystem,
} from '../AllianceSystem';
import {
  ALLIANCE_LEVEL_CONFIGS,
  createDefaultAlliancePlayerState,
  createAllianceData,
} from '../alliance-constants';
import { ApplicationStatus, AllianceRole } from '../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
} from '../../../core/alliance/alliance.types';

// ── 辅助函数 ──────────────────────────────

const NOW = 1000000;

function createState(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function createTestAlliance(
  leaderId = 'p1',
  leaderName = '刘备',
  name = '蜀汉',
): AllianceData {
  return createAllianceData('ally_1', name, '兴复汉室', leaderId, leaderName, NOW);
}

function createAllianceWithMembers(): AllianceData {
  let alliance = createTestAlliance();
  // 添加军师和成员
  alliance.members['p2'] = {
    playerId: 'p2', playerName: '诸葛亮', role: 'ADVISOR' as AllianceRole,
    power: 5000, joinTime: NOW, dailyContribution: 0, totalContribution: 100, dailyBossChallenges: 0,
  };
  alliance.members['p3'] = {
    playerId: 'p3', playerName: '关羽', role: 'MEMBER' as AllianceRole,
    power: 3000, joinTime: NOW, dailyContribution: 0, totalContribution: 50, dailyBossChallenges: 0,
  };
  return alliance;
}

// ── 联盟创建 ──────────────────────────────

describe('AllianceSystem — 联盟创建', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
  });

  test('成功创建联盟', () => {
    const state = createState();
    const result = system.createAlliance(state, '蜀汉', '兴复汉室', 'p1', '刘备', NOW);

    expect(result.playerState.allianceId).toBeTruthy();
    expect(result.alliance.name).toBe('蜀汉');
    expect(result.alliance.declaration).toBe('兴复汉室');
    expect(result.alliance.leaderId).toBe('p1');
    expect(result.alliance.level).toBe(1);
    expect(Object.keys(result.alliance.members)).toHaveLength(1);
    expect(result.alliance.members['p1'].role).toBe('LEADER');
  });

  test('已在联盟中无法创建', () => {
    const state = createState({ allianceId: 'existing' });
    expect(() => system.createAlliance(state, '蜀汉', '宣言', 'p1', '刘备', NOW))
      .toThrow('已在联盟中');
  });

  test('名称过短', () => {
    const state = createState();
    expect(() => system.createAlliance(state, '蜀', '宣言', 'p1', '刘备', NOW))
      .toThrow('联盟名称长度');
  });

  test('名称过长', () => {
    const state = createState();
    expect(() => system.createAlliance(state, '非常长的联盟名字不行', '宣言', 'p1', '刘备', NOW))
      .toThrow('联盟名称长度');
  });

  test('名称边界 — 2字', () => {
    const state = createState();
    const result = system.createAlliance(state, '蜀汉', '宣言', 'p1', '刘备', NOW);
    expect(result.alliance.name).toBe('蜀汉');
  });

  test('名称边界 — 8字', () => {
    const state = createState();
    const result = system.createAlliance(state, '八百诸侯联盟会', '宣言', 'p1', '刘备', NOW);
    expect(result.alliance.name).toBe('八百诸侯联盟会');
  });
});

// ── 申请加入 ──────────────────────────────

describe('AllianceSystem — 申请加入', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
  });

  test('成功申请加入', () => {
    const alliance = createTestAlliance();
    const state = createState();
    const result = system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW);

    expect(result.applications).toHaveLength(1);
    expect(result.applications[0].playerId).toBe('p2');
    expect(result.applications[0].status).toBe(ApplicationStatus.PENDING);
  });

  test('已在联盟中不能申请', () => {
    const alliance = createTestAlliance();
    const state = createState({ allianceId: 'other' });
    expect(() => system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW))
      .toThrow('已在联盟中');
  });

  test('重复申请被拒', () => {
    let alliance = createTestAlliance();
    const state = createState();
    alliance = system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW);
    expect(() => system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW))
      .toThrow('已提交申请');
  });

  test('成员已满不能申请', () => {
    const alliance = createTestAlliance();
    alliance.level = 1; // maxMembers = 20
    // 填满成员
    for (let i = 0; i < 19; i++) {
      alliance.members[`fill_${i}`] = {
        playerId: `fill_${i}`, playerName: `fill_${i}`, role: 'MEMBER' as AllianceRole,
        power: 0, joinTime: NOW, dailyContribution: 0, totalContribution: 0, dailyBossChallenges: 0,
      };
    }
    const state = createState();
    expect(() => system.applyToJoin(alliance, state, 'p99', '新人', 1000, NOW))
      .toThrow('联盟成员已满');
  });
});

// ── 审批管理 ──────────────────────────────

describe('AllianceSystem — 审批管理', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
  });

  test('盟主审批通过', () => {
    let alliance = createTestAlliance();
    const state = createState();
    alliance = system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW);
    const appId = alliance.applications[0].id;

    const result = system.approveApplication(alliance, appId, 'p1', NOW);
    expect(result.members['p2']).toBeDefined();
    expect(result.members['p2'].role).toBe('MEMBER');
    expect(result.applications[0].status).toBe(ApplicationStatus.APPROVED);
  });

  test('军师审批通过', () => {
    const alliance = createAllianceWithMembers();
    const state = createState();
    let tempAlliance = { ...alliance };
    tempAlliance = system.applyToJoin(tempAlliance, state, 'p4', '赵云', 4000, NOW);
    const appId = tempAlliance.applications.find(a => a.playerId === 'p4')!.id;

    const result = system.approveApplication(tempAlliance, appId, 'p2', NOW);
    expect(result.members['p4']).toBeDefined();
  });

  test('普通成员无权审批', () => {
    const alliance = createAllianceWithMembers();
    const state = createState();
    let tempAlliance = { ...alliance };
    tempAlliance = system.applyToJoin(tempAlliance, state, 'p4', '赵云', 4000, NOW);
    const appId = tempAlliance.applications.find(a => a.playerId === 'p4')!.id;

    expect(() => system.approveApplication(tempAlliance, appId, 'p3', NOW))
      .toThrow('权限不足');
  });

  test('拒绝申请', () => {
    let alliance = createTestAlliance();
    const state = createState();
    alliance = system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW);
    const appId = alliance.applications[0].id;

    const result = system.rejectApplication(alliance, appId, 'p1');
    expect(result.applications[0].status).toBe(ApplicationStatus.REJECTED);
  });

  test('重复审批被拒', () => {
    let alliance = createTestAlliance();
    const state = createState();
    alliance = system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW);
    const appId = alliance.applications[0].id;
    alliance = system.approveApplication(alliance, appId, 'p1', NOW);

    expect(() => system.approveApplication(alliance, appId, 'p1', NOW))
      .toThrow('申请已处理');
  });
});

// ── 成员管理 ──────────────────────────────

describe('AllianceSystem — 成员管理', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
  });

  test('踢出成员（盟主）', () => {
    const alliance = createAllianceWithMembers();
    const result = system.kickMember(alliance, 'p1', 'p3');
    expect(result.members['p3']).toBeUndefined();
    expect(Object.keys(result.members)).toHaveLength(2);
  });

  test('踢出成员（军师）', () => {
    const alliance = createAllianceWithMembers();
    const result = system.kickMember(alliance, 'p2', 'p3');
    expect(result.members['p3']).toBeUndefined();
  });

  test('普通成员不能踢人', () => {
    const alliance = createAllianceWithMembers();
    expect(() => system.kickMember(alliance, 'p3', 'p2'))
      .toThrow('权限不足');
  });

  test('不能踢出盟主', () => {
    const alliance = createAllianceWithMembers();
    expect(() => system.kickMember(alliance, 'p2', 'p1'))
      .toThrow('不能踢出盟主');
  });

  test('不能踢出自己', () => {
    const alliance = createAllianceWithMembers();
    expect(() => system.kickMember(alliance, 'p2', 'p2'))
      .toThrow('不能踢出自己');
  });

  test('转让盟主', () => {
    const alliance = createAllianceWithMembers();
    const result = system.transferLeadership(alliance, 'p1', 'p2');
    expect(result.leaderId).toBe('p2');
    expect(result.members['p1'].role).toBe('MEMBER');
    expect(result.members['p2'].role).toBe('LEADER');
  });

  test('只有盟主能转让', () => {
    const alliance = createAllianceWithMembers();
    expect(() => system.transferLeadership(alliance, 'p2', 'p3'))
      .toThrow('只有盟主可以转让');
  });

  test('设置角色', () => {
    const alliance = createAllianceWithMembers();
});
});
