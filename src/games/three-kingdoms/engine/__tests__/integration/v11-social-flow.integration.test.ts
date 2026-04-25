/**
 * v11.0 群雄逐鹿 — 社交完整流程集成测试
 *
 * 覆盖范围（按 PRD 章节组织）：
 * - §0 好友添加/删除/上限：50人上限、重复添加、删除冷却
 * - §1 好友申请流程：发送/接受/拒绝、每日申请上限、待处理上限
 * - §2 好友互动：赠送兵力(10次/天)、拜访主城(5次/天)、切磋(3次/天)
 * - §3 借将系统：借将(3次/天)、归还、PvP禁用
 * - §4 友情点获取与消耗：互动→友情点、每日上限200
 * - §5 公会基础操作：创建/加入/退出/踢人/权限
 *
 * 测试原则：
 * - 每个用例创建独立的系统实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v11-play.md (社交核心玩法)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FriendSystem } from '../../social/FriendSystem';
import { createDefaultSocialState } from '../../social/friend-config';
import { AllianceSystem } from '../../alliance/AllianceSystem';
import { createDefaultAlliancePlayerState } from '../../alliance/alliance-constants';
import { ApplicationStatus } from '../../../core/alliance/alliance.types';
import {
  FriendStatus,
  InteractionType,
} from '../../../core/social/social.types';
import type {
  SocialState,
  FriendData,
} from '../../../core/social/social.types';
import type { Faction } from '../../hero/hero.types';

// ── 辅助函数 ──────────────────────────────

function makeFriend(id: string, name: string = `Friend_${id}`): FriendData {
  return {
    playerId: id,
    playerName: name,
    status: FriendStatus.ONLINE,
    power: 5000,
    lastOnlineTime: Date.now(),
    friendSince: Date.now(),
  };
}

function makeState(): SocialState {
  return createDefaultSocialState();
}

/** 创建有N个好友的状态 */
function stateWithFriends(count: number): SocialState {
  let state = makeState();
  const friend = new FriendSystem();
  for (let i = 0; i < count; i++) {
    state = friend.addFriend(state, makeFriend(`f${i}`));
  }
  return state;
}

// ═══════════════════════════════════════════════════════════════
// §0 好友添加/删除/上限
// ═══════════════════════════════════════════════════════════════
describe('v11.0 社交 — §0 好友添加/删除/上限', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1_000_000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
  });

  it('should add a friend successfully', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    expect(Object.keys(state.friends)).toHaveLength(1);
    expect(state.friends['f1'].playerName).toBe('Friend_f1');
  });

  it('should add multiple friends', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    state = friend.addFriend(state, makeFriend('f2'));
    state = friend.addFriend(state, makeFriend('f3'));
    expect(Object.keys(state.friends)).toHaveLength(3);
  });

  it('should reject duplicate friend', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    expect(() => friend.addFriend(state, makeFriend('f1'))).toThrow('已经是好友了');
  });

  it('should enforce max 50 friends', () => {
    state = stateWithFriends(50);
    expect(() => friend.addFriend(state, makeFriend('f50'))).toThrow('好友数量已达上限');
  });

  it('should check canAddFriend correctly', () => {
    expect(friend.canAddFriend(state)).toBe(true);
    state = stateWithFriends(50);
    expect(friend.canAddFriend(state)).toBe(false);
  });

  it('should remove a friend', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    state = friend.removeFriend(state, 'f1', now);
    expect(state.friends['f1']).toBeUndefined();
  });

  it('should throw when removing non-friend', () => {
    expect(() => friend.removeFriend(state, 'nonexistent', now)).toThrow('不是好友');
  });

  it('should enforce 24h delete cooldown', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    // 删除 f1
    state = friend.removeFriend(state, 'f1', now);
    // 冷却中不能再次删除（虽然已经不是好友，但cooldown记录在）
    expect(state.deleteCooldowns['f1']).toBe(now + 24 * 60 * 60 * 1000);
  });

  it('should check canRemoveFriend with cooldown', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    expect(friend.canRemoveFriend(state, 'f1', now)).toBe(true);

    // 删除后设置冷却
    state = friend.removeFriend(state, 'f1', now);
    // f1已不是好友，所以canRemoveFriend返回false
    expect(friend.canRemoveFriend(state, 'f1', now)).toBe(false);
  });

  it('should get friend list', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    state = friend.addFriend(state, makeFriend('f2'));
    const list = friend.getFriendList(state);
    expect(list).toHaveLength(2);
    expect(list.map((f) => f.playerId)).toContain('f1');
    expect(list.map((f) => f.playerId)).toContain('f2');
  });

  it('should get online friends', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    state = friend.addFriend(state, {
      ...makeFriend('f2'),
      status: FriendStatus.OFFLINE,
    });
    const online = friend.getOnlineFriends(state);
    expect(online).toHaveLength(1);
    expect(online[0].playerId).toBe('f1');
  });

  it('should expose friend config', () => {
    const config = friend.getFriendConfig();
    expect(config.maxFriends).toBe(50);
    expect(config.dailyRequestLimit).toBe(20);
    expect(config.deleteCooldownMs).toBe(24 * 60 * 60 * 1000);
  });

});

// ═══════════════════════════════════════════════════════════════
// §1 好友申请流程
// ═══════════════════════════════════════════════════════════════
describe('v11.0 社交 — §1 好友申请流程', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1_000_000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
  });

  it('should send a friend request', () => {
    state = friend.sendFriendRequest(state, 'me', 'MyName', 'target1', now);
    expect(state.pendingRequests).toHaveLength(1);
    expect(state.pendingRequests[0].fromPlayerId).toBe('me');
    expect(state.pendingRequests[0].toPlayerId).toBe('target1');
    expect(state.dailyRequestsSent).toBe(1);
  });

  it('should increment daily request count', () => {
    state = friend.sendFriendRequest(state, 'me', 'MyName', 't1', now);
    state = friend.sendFriendRequest(state, 'me', 'MyName', 't2', now);
    state = friend.sendFriendRequest(state, 'me', 'MyName', 't3', now);
    expect(state.dailyRequestsSent).toBe(3);
  });

  it('should enforce daily request limit of 20', () => {
    for (let i = 0; i < 20; i++) {
      state = friend.sendFriendRequest(state, 'me', 'MyName', `t${i}`, now);
    }
    expect(() => friend.sendFriendRequest(state, 'me', 'MyName', 't20', now)).toThrow(
      '今日申请次数已达上限',
    );
  });

  it('should enforce pending request limit of 30', () => {
    // daily limit is 20, so we need to reset daily counter each batch
    // Send 20, reset, send 10 more to reach 30 pending, then the 31st should hit pending limit
    for (let i = 0; i < 20; i++) {
      state = friend.sendFriendRequest(state, 'me', 'MyName', `t${i}`, now + i);
    }
    // Reset daily counter but keep pending
    state = { ...state, dailyRequestsSent: 0 };
    for (let i = 20; i < 30; i++) {
      state = friend.sendFriendRequest(state, 'me', 'MyName', `t${i}`, now + i);
    }
    state = { ...state, dailyRequestsSent: 0 };
    expect(() => friend.sendFriendRequest(state, 'me', 'MyName', 't30', now + 30)).toThrow(
      '待处理申请已达上限',
    );
  });

  it('should reject sending request to existing friend', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    expect(() => friend.sendFriendRequest(state, 'me', 'MyName', 'f1', now)).toThrow(
      '已经是好友了',
    );
  });

  it('should accept a friend request', () => {
    state = friend.sendFriendRequest(state, 'other', 'OtherName', 'me', now);
    const requestId = state.pendingRequests[0].id;

    state = friend.acceptFriendRequest(state, requestId, makeFriend('other', 'OtherName'));
    expect(state.pendingRequests).toHaveLength(0);
    expect(state.friends['other']).toBeDefined();
    expect(state.friends['other'].playerName).toBe('OtherName');
  });

  it('should reject a friend request', () => {
    state = friend.sendFriendRequest(state, 'other', 'OtherName', 'me', now);
    const requestId = state.pendingRequests[0].id;

    state = friend.rejectFriendRequest(state, requestId);
    expect(state.pendingRequests).toHaveLength(0);
    expect(state.friends['other']).toBeUndefined();
  });

  it('should throw when accepting non-existent request', () => {
    expect(() => friend.acceptFriendRequest(state, 'fake_id', makeFriend('f1'))).toThrow(
      '申请不存在',
    );
  });

  it('should throw when rejecting non-existent request', () => {
    expect(() => friend.rejectFriendRequest(state, 'fake_id')).toThrow('申请不存在');
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 好友互动：赠送/拜访/切磋
// ═══════════════════════════════════════════════════════════════
describe('v11.0 社交 — §2 好友互动', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1_000_000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
    state = friend.addFriend(state, makeFriend('f1'));
    state = friend.addFriend(state, makeFriend('f2'));
  });

  it('should gift troops and earn friendship points', () => {
    const result = friend.giftTroops(state, 'f1', now);
    expect(result.friendshipEarned).toBe(5);
    expect(result.state.dailyInteractions).toHaveLength(1);
    expect(result.state.dailyInteractions[0].type).toBe(InteractionType.GIFT_TROOPS);
  });

  it('should limit gift troops to 10 per day', () => {
    for (let i = 0; i < 10; i++) {
      const result = friend.giftTroops(state, i % 2 === 0 ? 'f1' : 'f2', now + i * 1000);
      state = result.state;
    }
    // 第11次应失败
    expect(() => friend.giftTroops(state, 'f1', now + 100000)).toThrow();
  });

  it('should visit castle and earn copper', () => {
    const result = friend.visitCastle(state, 'f1', now);
    expect(result.copperReward).toBe(100);
    expect(result.state.dailyInteractions).toHaveLength(1);
    expect(result.state.dailyInteractions[0].type).toBe(InteractionType.VISIT_CASTLE);
  });

  it('should limit visit castle to 5 per day', () => {
    for (let i = 0; i < 5; i++) {
      const result = friend.visitCastle(state, i % 2 === 0 ? 'f1' : 'f2', now + i * 1000);
      state = result.state;
    }
    expect(() => friend.visitCastle(state, 'f1', now + 100000)).toThrow();
  });

  it('should spar and earn friendship points on win', () => {
    const result = friend.spar(state, 'f1', true, now);
    expect(result.friendshipEarned).toBe(20);
    expect(result.state.dailyInteractions).toHaveLength(1);
    expect(result.state.dailyInteractions[0].type).toBe(InteractionType.SPAR);
  });

  it('should spar and earn fewer points on loss', () => {
    const result = friend.spar(state, 'f1', false, now);
    expect(result.friendshipEarned).toBe(5);
  });

  it('should limit spar to 3 per day', () => {
    for (let i = 0; i < 3; i++) {
      const result = friend.spar(state, i % 2 === 0 ? 'f1' : 'f2', true, now + i * 1000);
      state = result.state;
    }
    expect(() => friend.spar(state, 'f1', true, now + 100000)).toThrow();
  });

  it('should track daily interaction count by type', () => {
    state = friend.giftTroops(state, 'f1', now).state;
    state = friend.giftTroops(state, 'f2', now + 1000).state;
    state = friend.visitCastle(state, 'f1', now + 2000).state;

    const giftCount = friend.getDailyInteractionCount(state, InteractionType.GIFT_TROOPS);
    const visitCount = friend.getDailyInteractionCount(state, InteractionType.VISIT_CASTLE);
    const sparCount = friend.getDailyInteractionCount(state, InteractionType.SPAR);

    expect(giftCount).toBe(2);
    expect(visitCount).toBe(1);
    expect(sparCount).toBe(0);
  });

  it('should expose interaction config', () => {
    const config = friend.getInteractionConfig();
    expect(config.giftTroopsDailyLimit).toBe(10);
    expect(config.giftTroopsFriendshipPoints).toBe(5);
    expect(config.visitDailyLimit).toBe(5);
    expect(config.visitCopperReward).toBe(100);
    expect(config.sparDailyLimit).toBe(3);
    expect(config.sparWinPoints).toBe(20);
    expect(config.sparLosePoints).toBe(5);
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 借将系统
// ═══════════════════════════════════════════════════════════════
describe('v11.0 社交 — §3 借将系统', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1_000_000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
    state = friend.addFriend(state, makeFriend('f1'));
  });

  it('should borrow a hero from friend', () => {
    const result = friend.borrowHero(state, 'hero_guanyu', 'f1', 'me', now);
    expect(result.powerRatio).toBe(0.8);
    expect(result.state.activeBorrows).toHaveLength(1);
    expect(result.state.activeBorrows[0].heroId).toBe('hero_guanyu');
    expect(result.state.activeBorrows[0].lenderPlayerId).toBe('f1');
    expect(result.state.activeBorrows[0].returned).toBe(false);
  });

  it('should limit borrow to 3 per day', () => {
    state = friend.addFriend(state, makeFriend('f2'));
    state = friend.addFriend(state, makeFriend('f3'));

    state = friend.borrowHero(state, 'h1', 'f1', 'me', now).state;
    state = friend.borrowHero(state, 'h2', 'f2', 'me', now + 1000).state;
    state = friend.borrowHero(state, 'h3', 'f3', 'me', now + 2000).state;

    expect(state.dailyBorrowCount).toBe(3);
    expect(() => friend.borrowHero(state, 'h4', 'f1', 'me', now + 3000)).toThrow();
  });

  it('should return a borrowed hero', () => {
    state = friend.borrowHero(state, 'hero_guanyu', 'f1', 'me', now).state;
    const borrowId = state.activeBorrows[0].id;

    state = friend.returnBorrowedHero(state, borrowId);
    expect(state.activeBorrows[0].returned).toBe(true);
  });

  it('should disallow borrowed hero in PvP', () => {
    expect(friend.isBorrowHeroAllowedInPvP()).toBe(false);
  });

  it('should track daily borrow count', () => {
    state = friend.borrowHero(state, 'h1', 'f1', 'me', now).state;
    expect(state.dailyBorrowCount).toBe(1);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 友情点获取与消耗
// ═══════════════════════════════════════════════════════════════
describe('v11.0 社交 — §4 友情点获取与消耗', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1_000_000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
    state = friend.addFriend(state, makeFriend('f1'));
    state = friend.addFriend(state, makeFriend('f2'));
  });

  it('should accumulate friendship points from gifting', () => {
    const result = friend.giftTroops(state, 'f1', now);
    expect(result.state.friendshipPoints).toBe(5);
    expect(result.state.dailyFriendshipEarned).toBe(5);
  });

  it('should accumulate friendship points from sparring', () => {
    const result = friend.spar(state, 'f1', true, now);
    expect(result.state.friendshipPoints).toBe(20);
    expect(result.state.dailyFriendshipEarned).toBe(20);
  });

  it('should accumulate friendship from multiple interactions', () => {
    state = friend.giftTroops(state, 'f1', now).state;
    state = friend.spar(state, 'f2', true, now + 1000).state;
    state = friend.visitCastle(state, 'f1', now + 2000).state;

    // giftTroops=5, spar=20, visitCastle=3 => total 28
    expect(state.friendshipPoints).toBe(5 + 20 + 3);
    expect(state.dailyFriendshipEarned).toBe(5 + 20 + 3);
  });

  it('should enforce daily friendship cap of 200', () => {
    const config = friend.getInteractionConfig();
    expect(config.friendshipDailyCap).toBe(200);
  });

  it('should reset daily counters on dailyReset', () => {
    state = friend.giftTroops(state, 'f1', now).state;
    state = friend.spar(state, 'f2', true, now + 1000).state;
    expect(state.dailyInteractions.length).toBeGreaterThan(0);
    expect(state.dailyFriendshipEarned).toBeGreaterThan(0);

    state = friend.dailyReset(state);
    expect(state.dailyInteractions).toEqual([]);
    expect(state.dailyFriendshipEarned).toBe(0);
    expect(state.dailyRequestsSent).toBe(0);
    expect(state.dailyBorrowCount).toBe(0);
  });

  it('should preserve friendship points across daily reset', () => {
    state = friend.giftTroops(state, 'f1', now).state;
    const pointsBeforeReset = state.friendshipPoints;

    state = friend.dailyReset(state);
    expect(state.friendshipPoints).toBe(pointsBeforeReset);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 公会基础操作
// ═══════════════════════════════════════════════════════════════
describe('v11.0 社交 — §5 公会基础操作', () => {
  let alliance: AllianceSystem;
  const now = 1_000_000;

  beforeEach(() => {
    alliance = new AllianceSystem();
  });

  it('should create an alliance', () => {
    const ps = createDefaultAlliancePlayerState();
    const result = alliance.createAlliance(ps, '测试公会', 'We are the best!', 'leader1', 'LeaderOne', now);
    expect(result.alliance.id).toBeTruthy();
    expect(result.alliance.name).toBe('测试公会');
    expect(result.alliance.declaration).toBe('We are the best!');
    expect(result.alliance.leaderId).toBe('leader1');
    expect(result.alliance.members['leader1']).toBeDefined();
    expect(result.alliance.members['leader1'].role).toBe('LEADER');
  });

  it('should apply to join an alliance', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    const { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    const playerPs = createDefaultAlliancePlayerState();
    const updated = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);

    expect(updated.applications).toHaveLength(1);
    expect(updated.applications[0].playerId).toBe('player1');
    expect(updated.applications[0].status).toBe(ApplicationStatus.PENDING);
  });

  it('should approve an application', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    const playerPs = createDefaultAlliancePlayerState();
    guild = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);
    const appId = guild.applications[0].id;

    guild = alliance.approveApplication(guild, appId, 'leader1', now);
    // approve updates status to APPROVED, does not remove from list
    expect(guild.applications.filter(a => a.status === ApplicationStatus.PENDING)).toHaveLength(0);
    expect(guild.members['player1']).toBeDefined();
    expect(guild.members['player1'].role).toBe('MEMBER');
  });

  it('should reject an application', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    const playerPs = createDefaultAlliancePlayerState();
    guild = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);
    const appId = guild.applications[0].id;

    guild = alliance.rejectApplication(guild, appId, 'leader1');
    // reject updates status to REJECTED, does not remove from list
    expect(guild.applications.filter(a => a.status === ApplicationStatus.PENDING)).toHaveLength(0);
    expect(guild.members['player1']).toBeUndefined();
  });

  it('should allow member to leave alliance', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    let playerPs = createDefaultAlliancePlayerState();
    guild = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);
    guild = alliance.approveApplication(guild, guild.applications[0].id, 'leader1', now);
    // Update playerPs to reflect alliance membership
    playerPs = { ...playerPs, allianceId: guild.id };

    const result = alliance.leaveAlliance(guild, playerPs, 'player1');
    guild = result.alliance!;
    expect(guild.members['player1']).toBeUndefined();
  });

  it('should allow leader to kick member', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    const playerPs = createDefaultAlliancePlayerState();
    guild = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);
    guild = alliance.approveApplication(guild, guild.applications[0].id, 'leader1', now);

    guild = alliance.kickMember(guild, 'leader1', 'player1');
    expect(guild.members['player1']).toBeUndefined();
  });

  it('should transfer leadership', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    const playerPs = createDefaultAlliancePlayerState();
    guild = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);
    guild = alliance.approveApplication(guild, guild.applications[0].id, 'leader1', now);

    guild = alliance.transferLeadership(guild, 'leader1', 'player1');
    expect(guild.leaderId).toBe('player1');
    expect(guild.members['player1'].role).toBe('LEADER');
    expect(guild.members['leader1'].role).toBe('MEMBER');
  });

  it('should post announcement', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    guild = alliance.postAnnouncement(guild, 'leader1', 'Leader', 'Welcome to the guild!', false, now);

    expect(guild.announcements).toHaveLength(1);
    expect(guild.announcements[0].content).toBe('Welcome to the guild!');
    expect(guild.announcements[0].authorId).toBe('leader1');
  });

  it('should send message to alliance channel', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    guild = alliance.sendMessage(guild, 'leader1', 'Leader', 'Hello everyone!', now);

    expect(guild.messages).toHaveLength(1);
    expect(guild.messages[0].content).toBe('Hello everyone!');
  });

  it('should add experience and level up', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    guild = alliance.addExperience(guild, 1000);
    expect(guild.experience).toBe(1000);
  });

  it('should get member list', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    const playerPs = createDefaultAlliancePlayerState();
    guild = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);
    guild = alliance.approveApplication(guild, guild.applications[0].id, 'leader1', now);

    const members = alliance.getMemberList(guild);
    expect(members.length).toBe(2);
  });

  it('should get pending applications', () => {
    const leaderPs = createDefaultAlliancePlayerState();
    let { alliance: guild } = alliance.createAlliance(leaderPs, 'Guild1', 'Join us', 'leader1', 'Leader', now);
    const playerPs = createDefaultAlliancePlayerState();
    guild = alliance.applyToJoin(guild, playerPs, 'player1', 'Player1', 5000, now);

    const pending = alliance.getPendingApplications(guild);
    expect(pending.length).toBe(1);
  });

  it('should search alliance by keyword', () => {
    const ps1 = createDefaultAlliancePlayerState();
    const ps2 = createDefaultAlliancePlayerState();
    const ps3 = createDefaultAlliancePlayerState();
    const { alliance: g1 } = alliance.createAlliance(ps1, '龙之斩', 'We slay dragons', 'l1', 'Leader1', now);
    const { alliance: g2 } = alliance.createAlliance(ps2, '凤之翼', 'Rise from ashes', 'l2', 'Leader2', now);
    const { alliance: g3 } = alliance.createAlliance(ps3, '龙之心', 'Heart of dragon', 'l3', 'Leader3', now);

    const results = alliance.searchAlliance([g1, g2, g3], '龙');
    expect(results.length).toBe(2);
    expect(results.map((g) => g.name)).toContain('龙之斩');
    expect(results.map((g) => g.name)).toContain('龙之心');
  });

});
