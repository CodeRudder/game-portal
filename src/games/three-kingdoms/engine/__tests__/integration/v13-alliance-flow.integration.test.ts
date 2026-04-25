/**
 * v13.0 联盟争锋 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 联盟系统: 创建/加入/退出/踢人/转让/公告
 * - §2 联盟管理: 成员权限、捐献、经验、等级
 * - §3 联盟子系统: 任务/Boss/商店
 * - §4 好友系统: 添加/删除/互动(赠送/拜访/切磋/借将)
 * - §5 跨系统联动: 联盟→好友→远征
 *
 * 注意: v13.0在R3中部分功能可能未完全封版，
 * 未实现的功能用 it.skip 标注 [引擎未实现]
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v13-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { AllianceData, AllianceRole, AlliancePlayerState } from '../../../core/alliance/alliance.types';
import { AllianceRole as AR, ApplicationStatus } from '../../../core/alliance/alliance.types';
import type { SocialState, FriendData } from '../../../core/social/social.types';
import { FriendStatus } from '../../../core/social/social.types';

// ── 辅助函数 ──

const NOW = Date.now();

/** 创建一个默认的联盟数据对象（使用 Record<string, AllianceMember>） */
function createAllianceData(overrides: Partial<AllianceData> = {}): AllianceData {
  return {
    id: 'alliance_test_001',
    name: '测试联盟',
    declaration: '测试宣言',
    leaderId: 'player_001',
    level: 1,
    experience: 0,
    members: {
      player_001: {
        playerId: 'player_001',
        playerName: '盟主',
        role: AR.LEADER,
        power: 1000,
        joinTime: NOW,
        dailyContribution: 0,
        totalContribution: 0,
        dailyBossChallenges: 0,
      },
    },
    applications: [],
    announcements: [],
    messages: [],
    createTime: NOW,
    bossKilledToday: false,
    lastBossRefreshTime: NOW,
    dailyTaskCompleted: 0,
    lastDailyReset: NOW,
    ...overrides,
  };
}

/** 创建默认联盟玩家状态 */
function createPlayerState(overrides: Partial<AlliancePlayerState> = {}): AlliancePlayerState {
  return {
    allianceId: '',
    guildCoins: 0,
    dailyBossChallenges: 0,
    dailyContribution: 0,
    lastDailyReset: NOW,
    weeklyRetroactiveCount: 0,
    lastRetroactiveReset: NOW,
    ...overrides,
  };
}

/** 创建默认社交状态 */
function createSocialState(overrides: Partial<SocialState> = {}): SocialState {
  return {
    friends: {},
    pendingRequests: [],
    dailyRequestsSent: 0,
    lastDailyReset: NOW,
    dailyInteractions: [],
    friendshipPoints: 0,
    dailyFriendshipEarned: 0,
    activeBorrows: [],
    dailyBorrowCount: 0,
    deleteCooldowns: {},
    chatMessages: { WORLD: [], GUILD: [], PRIVATE: [], SYSTEM: [] },
    lastSendTime: {},
    muteRecords: [],
    reportRecords: [],
    falseReportCounts: {},
    ...overrides,
  };
}

/** 创建好友数据 */
function createFriendData(id = 'friend_001', name = '赵云'): FriendData {
  return {
    playerId: id,
    playerName: name,
    status: FriendStatus.ONLINE,
    power: 5000,
    lastOnlineTime: NOW,
    friendSince: NOW,
  };
}

/** 构建包含两个成员的联盟 */
function createAllianceWithTwoMembers(): AllianceData {
  return createAllianceData({
    members: {
      player_001: {
        playerId: 'player_001',
        playerName: '盟主',
        role: AR.LEADER,
        power: 1000,
        joinTime: NOW,
        dailyContribution: 0,
        totalContribution: 0,
        dailyBossChallenges: 0,
      },
      player_002: {
        playerId: 'player_002',
        playerName: '成员',
        role: AR.MEMBER,
        power: 800,
        joinTime: NOW,
        dailyContribution: 0,
        totalContribution: 0,
        dailyBossChallenges: 0,
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// §1 联盟系统
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟争锋 — §1 联盟系统', () => {

  it('should access alliance system via engine getter', () => {
    const sim = createSim();
    const alliance = sim.engine.getAllianceSystem();
    expect(alliance).toBeDefined();
    expect(typeof alliance.createAlliance).toBe('function');
    expect(typeof alliance.leaveAlliance).toBe('function');
  });

  it('should create an alliance with correct signature', () => {
    // Play §1.1: 创建联盟需满足条件
    // createAlliance(playerState, name, declaration, playerId, playerName, now)
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();
    const playerState = createPlayerState();

    const result = allianceSys.createAlliance(
      playerState,
      '蜀汉复兴',
      '兴复汉室',
      'player_001',
      '刘备',
      NOW,
    );

    expect(result).toBeDefined();
    expect(result.alliance.name).toBe('蜀汉复兴');
    expect(result.alliance.leaderId).toBe('player_001');
    expect(result.alliance.declaration).toBe('兴复汉室');
    expect(result.playerState.allianceId).toBe(result.alliance.id);
  });

  it('should apply to join an alliance', () => {
    // Play §1.1: 申请加入联盟
    // applyToJoin(alliance, playerState, playerId, playerName, power, now)
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();
    const playerState = createPlayerState();
    const allianceData = createAllianceData();

    const result = allianceSys.applyToJoin(
      allianceData,
      playerState,
      'player_002',
      '关羽',
      800,
      NOW,
    );

    expect(result).toBeDefined();
    expect(result.applications.length).toBeGreaterThan(allianceData.applications.length);
  });

  it('should approve an application', () => {
    // Play §1.1: 审批通过
    // approveApplication(alliance, applicationId, operatorId, now)
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    let allianceData = createAllianceData();
    const playerState = createPlayerState();
    allianceData = allianceSys.applyToJoin(allianceData, playerState, 'player_002', '关羽', 800, NOW);

    const appId = allianceData.applications[0].id;
    const result = allianceSys.approveApplication(allianceData, appId, 'player_001', NOW);

    expect(result).toBeDefined();
    expect(result.members['player_002']).toBeDefined();
    expect(result.members['player_002'].role).toBe(AR.MEMBER);
  });

  it('should reject an application', () => {
    // Play §1.1: 审批拒绝
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    let allianceData = createAllianceData();
    const playerState = createPlayerState();
    allianceData = allianceSys.applyToJoin(allianceData, playerState, 'player_002', '关羽', 800, NOW);

    const appId = allianceData.applications[0].id;
    const result = allianceSys.rejectApplication(allianceData, appId, 'player_001');

    expect(result).toBeDefined();
    const rejected = result.applications.find(a => a.id === appId);
    expect(rejected?.status).toBe(ApplicationStatus.REJECTED);
  });

  it('should leave alliance', () => {
    // Play §1.1: 退出联盟
    // leaveAlliance(alliance, playerState, playerId)
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceWithTwoMembers();
    const playerState = createPlayerState({ allianceId: allianceData.id });

    const result = allianceSys.leaveAlliance(allianceData, playerState, 'player_002');
    expect(result).toBeDefined();
    expect(result.playerState.allianceId).toBe('');
  });

  it('should kick member from alliance', () => {
    // Play §2.2: 踢出成员
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceWithTwoMembers();
    const result = allianceSys.kickMember(allianceData, 'player_001', 'player_002');

    expect(result).toBeDefined();
    expect(result.members['player_002']).toBeUndefined();
    expect(Object.keys(result.members).length).toBe(1);
  });

  it('should transfer leadership', () => {
    // Play §2.3: 盟主退位
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceWithTwoMembers();
    // player_002 needs to be ADVISOR for realistic scenario, but MEMBER works too
    const result = allianceSys.transferLeadership(allianceData, 'player_001', 'player_002');
    expect(result).toBeDefined();
    expect(result.leaderId).toBe('player_002');
    expect(result.members['player_001'].role).toBe(AR.MEMBER);
    expect(result.members['player_002'].role).toBe(AR.LEADER);
  });

  it('should set member role', () => {
    // Play §2.1: 设置成员权限
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceWithTwoMembers();
    const result = allianceSys.setRole(allianceData, 'player_001', 'player_002', AR.ADVISOR);
    expect(result).toBeDefined();
    expect(result.members['player_002'].role).toBe(AR.ADVISOR);
  });

  it('should post announcement', () => {
    // Play §1.3: 发布联盟公告
    // postAnnouncement(alliance, authorId, authorName, content, pinned, now)
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData();
    const result = allianceSys.postAnnouncement(allianceData, 'player_001', '盟主', '今晚8点联盟战！', false, NOW);

    expect(result).toBeDefined();
    expect(result.announcements.length).toBe(1);
    expect(result.announcements[0].content).toBe('今晚8点联盟战！');
  });

  it('should send message in alliance', () => {
    // Play §1.3: 联盟频道消息
    // sendMessage(alliance, senderId, senderName, content, now)
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData();
    const result = allianceSys.sendMessage(allianceData, 'player_001', '盟主', '大家好！', NOW);

    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(allianceData.messages.length);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 联盟管理
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟争锋 — §2 联盟管理', () => {

  it('should add experience to alliance', () => {
    // Play §1.2: 联盟经验与等级
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData({ experience: 0 });
    const result = allianceSys.addExperience(allianceData, 100);

    expect(result).toBeDefined();
    expect(result.experience).toBe(100);
  });

  it('should get alliance bonuses by level', () => {
    // Play §1.2: 联盟等级福利
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData({ level: 3 });
    const bonuses = allianceSys.getBonuses(allianceData);

    expect(bonuses).toBeDefined();
    expect(typeof bonuses.resourceBonus).toBe('number');
    expect(typeof bonuses.expeditionBonus).toBe('number');
  });

  it('should get max members by level', () => {
    // Play §1.2: 成员上限随等级增长
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const maxLv1 = allianceSys.getMaxMembers(1);
    const maxLv5 = allianceSys.getMaxMembers(5);

    expect(typeof maxLv1).toBe('number');
    expect(typeof maxLv5).toBe('number');
    expect(maxLv5).toBeGreaterThanOrEqual(maxLv1);
  });

  it('should get level config', () => {
    // Play §1.2: 等级配置
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const config = allianceSys.getLevelConfig(1);
    expect(config).toBeDefined();
    expect(config.level).toBe(1);
    expect(typeof config.maxMembers).toBe('number');
  });

  it('should check member permissions', () => {
    // Play §2.1: 成员权限验证
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData();
    const hasPermission = allianceSys.hasPermission(allianceData, 'player_001', 'kick');
    expect(typeof hasPermission).toBe('boolean');
  });

  it('should get member list', () => {
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData();
    const members = allianceSys.getMemberList(allianceData);
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThan(0);
  });

  it('should get pending applications', () => {
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    let allianceData = createAllianceData();
    const playerState = createPlayerState();
    allianceData = allianceSys.applyToJoin(allianceData, playerState, 'player_002', '关羽', 800, NOW);

    const pending = allianceSys.getPendingApplications(allianceData);
    expect(Array.isArray(pending)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it('should search alliance by keyword', () => {
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const alliances = [createAllianceData({ name: '蜀汉复兴' }), createAllianceData({ id: 'ally_002', name: '魏武天下' })];
    const results = allianceSys.searchAlliance(alliances, '蜀汉');
    expect(Array.isArray(results)).toBe(true);
  });

  it('should perform daily reset for alliance', () => {
    // Play §2.4: 每日重置
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData();
    const playerState = createPlayerState({
      allianceId: allianceData.id,
      dailyBossChallenges: 3,
      dailyContribution: 100,
    });

    const result = allianceSys.dailyReset(allianceData, playerState);
    expect(result).toBeDefined();
    expect(result.playerState.dailyBossChallenges).toBe(0);
    expect(result.playerState.dailyContribution).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 联盟子系统
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟争锋 — §3 联盟子系统', () => {

  it('should access alliance task system via engine getter', () => {
    const sim = createSim();
    const taskSys = sim.engine.getAllianceTaskSystem();
    expect(taskSys).toBeDefined();
  });

  it('should access alliance boss system via engine getter', () => {
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();
    expect(bossSys).toBeDefined();
  });

  it('should access alliance shop system via engine getter', () => {
    const sim = createSim();
    const shopSys = sim.engine.getAllianceShopSystem();
    expect(shopSys).toBeDefined();
  });

  it('should get alliance task definitions and active tasks', () => {
    // Play §4.1: 联盟任务
    const sim = createSim();
    const taskSys = sim.engine.getAllianceTaskSystem();

    const taskPool = taskSys.getTaskPool();
    expect(Array.isArray(taskPool)).toBe(true);

    const activeTasks = taskSys.getActiveTasks();
    expect(Array.isArray(activeTasks)).toBe(true);
  });

  it('should daily refresh alliance tasks', () => {
    // Play §4.1: 每日刷新联盟任务
    const sim = createSim();
    const taskSys = sim.engine.getAllianceTaskSystem();

    const tasks = taskSys.dailyRefresh();
    expect(Array.isArray(tasks)).toBe(true);
  });

  it('should get alliance boss config and calculate HP', () => {
    // Play §3.1: 联盟Boss
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const config = bossSys.getConfig();
    expect(config).toBeDefined();

    const maxHp = bossSys.calculateBossMaxHp(1);
    expect(typeof maxHp).toBe('number');
    expect(maxHp).toBeGreaterThan(0);
  });

  it('should get alliance shop items', () => {
    // Play §4.2: 联盟商店
    const sim = createSim();
    const shopSys = sim.engine.getAllianceShopSystem();

    const items = shopSys.getAllItems();
    expect(Array.isArray(items)).toBe(true);
  });

  it('should get available alliance shop items by level', () => {
    // Play §4.2: 按联盟等级过滤商品
    const sim = createSim();
    const shopSys = sim.engine.getAllianceShopSystem();

    const available = shopSys.getAvailableShopItems(1);
    expect(Array.isArray(available)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 好友系统
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟争锋 — §4 好友系统', () => {

  it('should access friend system via engine getter', () => {
    const sim = createSim();
    const friend = sim.engine.getFriendSystem();
    expect(friend).toBeDefined();
    expect(typeof friend.addFriend).toBe('function');
    expect(typeof friend.removeFriend).toBe('function');
    expect(typeof friend.sendFriendRequest).toBe('function');
  });

  it('should add a friend', () => {
    // Play 社交循环: 好友添加
    // addFriend(state, friend) → state.friends is Record<string, FriendData>
    const sim = createSim();
    const friend = sim.engine.getFriendSystem();

    const state = createSocialState();
    const friendData = createFriendData();

    const result = friend.addFriend(state, friendData);
    expect(result.friends['friend_001']).toBeDefined();
    expect(result.friends['friend_001'].playerName).toBe('赵云');
  });

  it('should remove a friend', () => {
    // Play 社交循环: 删除好友
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState();
    const stateWithFriend = friendSys.addFriend(state, createFriendData());
    const stateAfterRemove = friendSys.removeFriend(stateWithFriend, 'friend_001', NOW);

    expect(stateAfterRemove.friends['friend_001']).toBeUndefined();
  });

  it('should check if friend can be added or removed', () => {
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState();
    const canAdd = friendSys.canAddFriend(state);
    expect(typeof canAdd).toBe('boolean');

    const canRemove = friendSys.canRemoveFriend(state, 'nonexistent', NOW);
    expect(typeof canRemove).toBe('boolean');
  });

  it('should send and accept friend request', () => {
    // Play 社交循环: 发送好友请求→接受
    // sendFriendRequest(state, fromPlayerId, fromPlayerName, toPlayerId, now)
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    let state = createSocialState();
    state = friendSys.sendFriendRequest(state, 'player_001', '刘备', 'target_002', NOW);

    expect(state.pendingRequests.length).toBeGreaterThan(0);

    const requestId = state.pendingRequests[0].id;
    state = friendSys.acceptFriendRequest(state, requestId, {
      playerId: 'target_002',
      playerName: '目标玩家',
      status: FriendStatus.ONLINE,
      level: 5,
      power: 500,
      lastOnlineTime: NOW,
      addedAt: NOW,
      friendSince: NOW,
    });
    expect(state.friends['target_002']).toBeDefined();
  });

  it('should reject friend request', () => {
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    let state = createSocialState();
    state = friendSys.sendFriendRequest(state, 'player_001', '刘备', 'target_002', NOW);

    const requestId = state.pendingRequests[0].id;
    state = friendSys.rejectFriendRequest(state, requestId);
    expect(state.pendingRequests.length).toBe(0);
  });

  it('should gift troops to friend', () => {
    // Play 社交循环: 赠送
    // giftTroops(state, friendId, now) → { state, friendshipEarned }
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState({
      friends: { friend_001: createFriendData() },
    });

    const result = friendSys.giftTroops(state, 'friend_001', NOW);
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    expect(typeof result.friendshipEarned).toBe('number');
  });

  it('should visit friend castle', () => {
    // Play 社交循环: 拜访
    // visitCastle(state, friendId, now) → { state, copperReward }
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState({
      friends: { friend_001: createFriendData() },
    });

    const result = friendSys.visitCastle(state, 'friend_001', NOW);
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    expect(typeof result.copperReward).toBe('number');
  });

  it('should spar with friend', () => {
    // Play 社交循环: 切磋
    // spar(state, friendId, won, now) → { state, friendshipEarned }
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState({
      friends: { friend_001: createFriendData() },
    });

    const result = friendSys.spar(state, 'friend_001', true, NOW);
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    expect(typeof result.friendshipEarned).toBe('number');
  });

  it('should borrow hero from friend', () => {
    // Play 社交循环: 借将
    // borrowHero(state, heroId, lenderPlayerId, borrowerPlayerId, now)
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState({
      friends: { friend_001: createFriendData() },
    });

    const result = friendSys.borrowHero(state, 'zhaoyun', 'friend_001', 'player_001', NOW);
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    expect(typeof result.powerRatio).toBe('number');
  });

  it('should get friend list and online friends', () => {
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState({
      friends: { friend_001: createFriendData() },
    });

    const list = friendSys.getFriendList(state);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);

    const online = friendSys.getOnlineFriends(state);
    expect(Array.isArray(online)).toBe(true);
  });

  it('should daily reset social state', () => {
    // Play 社交循环: 每日重置互动次数
    // dailyReset resets: dailyRequestsSent, dailyInteractions, dailyFriendshipEarned, dailyBorrowCount
    const sim = createSim();
    const friendSys = sim.engine.getFriendSystem();

    const state = createSocialState({
      dailyRequestsSent: 5,
      dailyFriendshipEarned: 100,
      dailyBorrowCount: 3,
    });

    const resetState = friendSys.dailyReset(state);
    expect(resetState.dailyRequestsSent).toBe(0);
    expect(resetState.dailyInteractions.length).toBe(0);
    expect(resetState.dailyFriendshipEarned).toBe(0);
    expect(resetState.dailyBorrowCount).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟争锋 — §5 跨系统联动', () => {

  it('should link alliance with friend system', () => {
    // Play §5: 联盟→好友联动
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();
    const friendSys = sim.engine.getFriendSystem();

    expect(allianceSys).toBeDefined();
    expect(friendSys).toBeDefined();

    const playerState = createPlayerState();
    const allianceData = allianceSys.createAlliance(playerState, '联动测试联盟', '宣言', 'player_001', '刘备', NOW);
    const socialState = createSocialState();
    const stateWithFriend = friendSys.addFriend(socialState, createFriendData());

    expect(allianceData.alliance).toBeDefined();
    expect(stateWithFriend.friends['friend_001']).toBeDefined();
  });

  it('should link alliance bonuses with expedition system', () => {
    // Play §5: 联盟加成→远征
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();
    const expedition = sim.engine.getExpeditionSystem();

    const allianceData = createAllianceData({ level: 5 });
    const bonuses = allianceSys.getBonuses(allianceData);

    expect(bonuses.expeditionBonus).toBeGreaterThanOrEqual(0);
    expect(expedition).toBeDefined();
  });

  it('should serialize and deserialize alliance data', () => {
    // Play §5: 数据持久化
    const sim = createSim();
    const allianceSys = sim.engine.getAllianceSystem();

    const allianceData = createAllianceData();
    const playerState = createPlayerState({ allianceId: allianceData.id });

    const saveData = allianceSys.serialize(playerState, allianceData);
    expect(saveData).toBeDefined();

    const loaded = allianceSys.deserialize(saveData);
    expect(loaded).toBeDefined();
    expect(loaded.playerState).toBeDefined();
  });

});
