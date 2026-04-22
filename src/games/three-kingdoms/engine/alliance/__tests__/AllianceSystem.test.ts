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
    const result = system.setRole(alliance, 'p1', 'p3', 'ADVISOR' as AllianceRole);
    expect(result.members['p3'].role).toBe('ADVISOR');
  });

  test('不能设置为LEADER角色', () => {
    const alliance = createAllianceWithMembers();
    expect(() => system.setRole(alliance, 'p1', 'p3', 'LEADER' as AllianceRole))
      .toThrow('请使用转让盟主功能');
  });

  test('退出联盟', () => {
    const alliance = createAllianceWithMembers();
    const state = createState({ allianceId: alliance.id });
    const result = system.leaveAlliance(alliance, state, 'p3');
    expect(result.playerState.allianceId).toBe('');
    expect(result.alliance!.members['p3']).toBeUndefined();
  });

  test('盟主不能退出', () => {
    const alliance = createAllianceWithMembers();
    const state = createState({ allianceId: alliance.id });
    expect(() => system.leaveAlliance(alliance, state, 'p1'))
      .toThrow('盟主需先转让');
  });
});

// ── 三级权限 ──────────────────────────────

describe('AllianceSystem — 三级权限', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
  });

  test('盟主拥有全部权限', () => {
    const alliance = createAllianceWithMembers();
    expect(system.hasPermission(alliance, 'p1', 'approve')).toBe(true);
    expect(system.hasPermission(alliance, 'p1', 'announce')).toBe(true);
    expect(system.hasPermission(alliance, 'p1', 'kick')).toBe(true);
    expect(system.hasPermission(alliance, 'p1', 'manage')).toBe(true);
  });

  test('军师有审批+公告+踢人权限', () => {
    const alliance = createAllianceWithMembers();
    expect(system.hasPermission(alliance, 'p2', 'approve')).toBe(true);
    expect(system.hasPermission(alliance, 'p2', 'announce')).toBe(true);
    expect(system.hasPermission(alliance, 'p2', 'kick')).toBe(true);
    expect(system.hasPermission(alliance, 'p2', 'manage')).toBe(false);
  });

  test('成员只有基础权限', () => {
    const alliance = createAllianceWithMembers();
    expect(system.hasPermission(alliance, 'p3', 'approve')).toBe(false);
    expect(system.hasPermission(alliance, 'p3', 'announce')).toBe(false);
    expect(system.hasPermission(alliance, 'p3', 'kick')).toBe(false);
    expect(system.hasPermission(alliance, 'p3', 'manage')).toBe(false);
  });
});

// ── 频道与公告 ──────────────────────────────

describe('AllianceSystem — 频道与公告', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
  });

  test('发布普通公告', () => {
    const alliance = createTestAlliance();
    const result = system.postAnnouncement(alliance, 'p1', '刘备', '明天攻城', false, NOW);
    expect(result.announcements).toHaveLength(1);
    expect(result.announcements[0].content).toBe('明天攻城');
    expect(result.announcements[0].pinned).toBe(false);
  });

  test('发布置顶公告', () => {
    const alliance = createTestAlliance();
    const result = system.postAnnouncement(alliance, 'p1', '刘备', '重要通知', true, NOW);
    expect(result.announcements[0].pinned).toBe(true);
  });

  test('置顶公告上限3条', () => {
    let alliance = createTestAlliance();
    alliance = system.postAnnouncement(alliance, 'p1', '刘备', '通知1', true, NOW);
    alliance = system.postAnnouncement(alliance, 'p1', '刘备', '通知2', true, NOW);
    alliance = system.postAnnouncement(alliance, 'p1', '刘备', '通知3', true, NOW);

    expect(() => system.postAnnouncement(alliance, 'p1', '刘备', '通知4', true, NOW))
      .toThrow('置顶公告最多3条');
  });

  test('军师可以发布公告', () => {
    const alliance = createAllianceWithMembers();
    const result = system.postAnnouncement(alliance, 'p2', '诸葛亮', '军令', false, NOW);
    expect(result.announcements).toHaveLength(1);
  });

  test('普通成员不能发布公告', () => {
    const alliance = createAllianceWithMembers();
    expect(() => system.postAnnouncement(alliance, 'p3', '关羽', '通知', false, NOW))
      .toThrow('权限不足');
  });

  test('发送频道消息', () => {
    const alliance = createTestAlliance();
    const result = system.sendMessage(alliance, 'p1', '刘备', '大家好', NOW);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('大家好');
  });

  test('非成员不能发消息', () => {
    const alliance = createTestAlliance();
    expect(() => system.sendMessage(alliance, 'p999', '路人', '你好', NOW))
      .toThrow('不是联盟成员');
  });

  test('消息超限截断', () => {
    let alliance = createTestAlliance();
    for (let i = 0; i < 105; i++) {
      alliance = system.sendMessage(alliance, 'p1', '刘备', `消息${i}`, NOW + i);
    }
    expect(alliance.messages.length).toBe(100);
  });

  test('获取置顶公告', () => {
    let alliance = createTestAlliance();
    alliance = system.postAnnouncement(alliance, 'p1', '刘备', '置顶', true, NOW);
    alliance = system.postAnnouncement(alliance, 'p1', '刘备', '普通', false, NOW);

    const pinned = system.getPinnedAnnouncements(alliance);
    expect(pinned).toHaveLength(1);
    expect(pinned[0].content).toBe('置顶');
  });
});

// ── 联盟等级与福利 ──────────────────────────

describe('AllianceSystem — 联盟等级与福利', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
  });

  test('初始等级为1', () => {
    const alliance = createTestAlliance();
    expect(alliance.level).toBe(1);
  });

  test('增加经验可升级', () => {
    const alliance = createTestAlliance();
    const result = system.addExperience(alliance, 1000);
    expect(result.level).toBe(2);
    expect(result.experience).toBe(1000);
  });

  test('多级升级', () => {
    const alliance = createTestAlliance();
    const result = system.addExperience(alliance, 6000);
    expect(result.level).toBe(4);
  });

  test('达到最高等级不再升级', () => {
    const alliance = createTestAlliance();
    const result = system.addExperience(alliance, 999999);
    expect(result.level).toBe(ALLIANCE_LEVEL_CONFIGS.length);
  });

  test('获取等级加成', () => {
    const alliance = createTestAlliance();
    const bonuses = system.getBonuses(alliance);
    expect(bonuses.resourceBonus).toBe(0);
    expect(bonuses.expeditionBonus).toBe(0);
  });

  test('等级3有加成', () => {
    let alliance = createTestAlliance();
    alliance = system.addExperience(alliance, 3000);
    const bonuses = system.getBonuses(alliance);
    expect(bonuses.resourceBonus).toBe(4);
    expect(bonuses.expeditionBonus).toBe(2);
  });

  test('成员上限随等级增长', () => {
    expect(system.getMaxMembers(1)).toBe(20);
    expect(system.getMaxMembers(7)).toBe(50);
  });
});

// ── 每日重置 ──────────────────────────────

describe('AllianceSystem — 每日重置', () => {
  test('重置成员每日数据', () => {
    const alliance = createAllianceWithMembers();
    alliance.members['p2'].dailyContribution = 100;
    alliance.members['p2'].dailyBossChallenges = 3;
    alliance.bossKilledToday = true;

    const state = createState({ dailyBossChallenges: 3, dailyContribution: 50 });
    const system = new AllianceSystem();
    const result = system.dailyReset(alliance, state);

    expect(result.alliance.members['p2'].dailyContribution).toBe(0);
    expect(result.alliance.members['p2'].dailyBossChallenges).toBe(0);
    expect(result.alliance.bossKilledToday).toBe(false);
    expect(result.playerState.dailyBossChallenges).toBe(0);
    expect(result.playerState.dailyContribution).toBe(0);
  });
});

// ── 存档序列化 ──────────────────────────────

describe('AllianceSystem — 存档序列化', () => {
  test('序列化与反序列化', () => {
    const system = new AllianceSystem();
    const state = createState({ allianceId: 'ally_1', guildCoins: 500 });
    const alliance = createTestAlliance();

    const saved = system.serialize(state, alliance);
    expect(saved.version).toBe(1);
    expect(saved.playerState.guildCoins).toBe(500);
    expect(saved.allianceData).toBeTruthy();

    const loaded = system.deserialize(saved);
    expect(loaded.playerState.guildCoins).toBe(500);
    expect(loaded.alliance).toBeTruthy();
    expect(loaded.alliance!.name).toBe('蜀汉');
  });

  test('无联盟时序列化', () => {
    const system = new AllianceSystem();
    const state = createState();
    const saved = system.serialize(state, null);
    expect(saved.allianceData).toBeNull();

    const loaded = system.deserialize(saved);
    expect(loaded.alliance).toBeNull();
  });

  test('版本不匹配返回默认值', () => {
    const system = new AllianceSystem();
    const loaded = system.deserialize({ version: 999, playerState: createState(), allianceData: null });
    expect(loaded.playerState.allianceId).toBe('');
    expect(loaded.alliance).toBeNull();
  });
});

// ── 工具方法 ──────────────────────────────

describe('AllianceSystem — 工具方法', () => {
  test('获取成员列表', () => {
    const system = new AllianceSystem();
    const alliance = createAllianceWithMembers();
    const members = system.getMemberList(alliance);
    expect(members).toHaveLength(3);
  });

  test('获取待审批申请', () => {
    const system = new AllianceSystem();
    const alliance = createTestAlliance();
    const state = createState();
    const applied = system.applyToJoin(alliance, state, 'p2', '诸葛亮', 5000, NOW);
    const pending = system.getPendingApplications(applied);
    expect(pending).toHaveLength(1);
  });

  test('搜索联盟', () => {
    const system = new AllianceSystem();
    const alliances = [
      createAllianceData('a1', '蜀汉', '', 'p1', '刘备', NOW),
      createAllianceData('a2', '曹魏', '', 'p2', '曹操', NOW),
      createAllianceData('a3', '东吴', '', 'p3', '孙权', NOW),
    ];
    const results = system.searchAlliance(alliances, '蜀');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('蜀汉');
  });
});
