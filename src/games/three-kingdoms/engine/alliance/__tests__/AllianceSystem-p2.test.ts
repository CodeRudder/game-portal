import {
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
});
