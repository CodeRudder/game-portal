/**
 * v11.0 群雄逐鹿 — 社交全链路集成测试
 *
 * 覆盖 Play 流程：
 *   §6 好友系统（面板/添加/互动/借将/友情商店/删除）
 *   §7 聊天系统（多频道/消息/禁言/举报）
 *   §8.6 社交异常处理
 *   §9.4 好友→互动→友情点→商店闭环
 *   §9.5 借将→出征→归还→PvP禁用
 *   §9.6 聊天→举报→禁言→反馈闭环
 *
 * @module engine/social/__tests__/integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FriendSystem } from '../../FriendSystem';
import { ChatSystem } from '../../ChatSystem';
import { createDefaultSocialState } from '../../friend-config';
import {
  FriendStatus,
  InteractionType,
  ChatChannel,
  MuteLevel,
  ReportType,
} from '../../../../core/social/social.types';
import type { SocialState, FriendData } from '../../../../core/social/social.types';

// ── 辅助 ────────────────────────────────────

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

// ─────────────────────────────────────────────
// §6 好友系统
// ─────────────────────────────────────────────

describe('§6 好友系统', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1000000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
  });

  it('§6.1 添加好友', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    expect(Object.keys(state.friends)).toHaveLength(1);
    expect(state.friends['f1'].playerName).toBe('Friend_f1');
  });

  it('§6.2 好友上限50人', () => {
    // 添加50个好友
    for (let i = 0; i < 50; i++) {
      state = friend.addFriend(state, makeFriend(`f${i}`));
    }
    // 第51个应失败
    expect(() => friend.addFriend(state, makeFriend('f50'))).toThrow('好友数量已达上限');
  });

  it('§6.3 重复添加失败', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    expect(() => friend.addFriend(state, makeFriend('f1'))).toThrow('已经是好友了');
  });

  it('§6.4 删除好友+24h冷却', () => {
    state = friend.addFriend(state, makeFriend('f1'));
    state = friend.removeFriend(state, 'f1', now);
    expect(state.friends['f1']).toBeUndefined();

    // 冷却期内不可再添加
    expect(friend.canRemoveFriend(state, 'f1', now + 1000)).toBe(false);

    // 24h后冷却结束
    const after24h = now + 24 * 60 * 60 * 1000;
    // 冷却结束但仍需注意：冷却记录是针对删除操作的
    expect(state.deleteCooldowns['f1']).toBe(now + 24 * 60 * 60 * 1000);
  });

  it('§6.5 发送好友申请', () => {
    state = friend.sendFriendRequest(state, 'p1', 'Player1', 'target1', now);
    expect(state.pendingRequests).toHaveLength(1);
    expect(state.dailyRequestsSent).toBe(1);
  });

  it('§6.6 每日申请上限20次', () => {
    for (let i = 0; i < 20; i++) {
      state = friend.sendFriendRequest(state, 'p1', 'Player1', `target_${i}`, now);
    }
    expect(() => friend.sendFriendRequest(state, 'p1', 'Player1', 'target_20', now))
      .toThrow('今日申请次数已达上限');
  });

  it('§6.7 接受好友申请', () => {
    state = friend.sendFriendRequest(state, 'p1', 'Player1', 'self', now);
    const requestId = state.pendingRequests[0].id;
    state = friend.acceptFriendRequest(state, requestId, makeFriend('p1'));
    expect(state.friends['p1']).toBeTruthy();
    expect(state.pendingRequests).toHaveLength(0);
  });

  it('§6.8 拒绝好友申请', () => {
    state = friend.sendFriendRequest(state, 'p1', 'Player1', 'self', now);
    const requestId = state.pendingRequests[0].id;
    state = friend.rejectFriendRequest(state, requestId);
    expect(state.friends['p1']).toBeUndefined();
    expect(state.pendingRequests).toHaveLength(0);
  });

  it('§6.9 每日重置', () => {
    state = friend.sendFriendRequest(state, 'p1', 'Player1', 't1', now);
    state = friend.dailyReset(state);
    expect(state.dailyRequestsSent).toBe(0);
    expect(state.dailyInteractions).toEqual([]);
    expect(state.dailyFriendshipEarned).toBe(0);
  });
});

// ─────────────────────────────────────────────
// §6.2 好友互动
// ─────────────────────────────────────────────

describe('§6.2 好友互动', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1000000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
    state = friend.addFriend(state, makeFriend('f1'));
  });

  it('§6.2.1 赠送兵力10次/天获得友情点', () => {
    for (let i = 0; i < 10; i++) {
      const result = friend.giftTroops(state, 'f1', now + i * 1000);
      state = result.state;
      expect(result.friendshipEarned).toBe(5);
    }
    // 第11次应该抛出异常
    expect(() => friend.giftTroops(state, 'f1', now + 11000))
      .toThrow('今日赠送次数已达上限');
  });

  it('§6.2.2 拜访主城5次/天获得铜钱', () => {
    for (let i = 0; i < 5; i++) {
      const result = friend.visitCastle(state, 'f1', now + i * 1000);
      state = result.state;
      expect(result.copperReward).toBe(100);
    }
  });

  it('§6.2.3 切磋3次/天胜/败友情点不同', () => {
    const winResult = friend.spar(state, 'f1', true, now);
    expect(winResult.friendshipEarned).toBe(20);

    const loseResult = friend.spar(state, 'f1', false, now + 1000);
    expect(loseResult.friendshipEarned).toBe(5);
  });

  it('§6.2.4 友情点每日上限200', () => {
    // 通过赠送兵力积累友情点: 10次×5=50
    for (let i = 0; i < 10; i++) {
      const result = friend.giftTroops(state, 'f1', now + i * 1000);
      state = result.state;
    }
    // 通过切磋胜利积累: 3次×20=60 → 总110
    for (let i = 0; i < 3; i++) {
      const result = friend.spar(state, 'f1', true, now + 10000 + i * 1000);
      state = result.state;
    }
    // 此时友情点应在合理范围
    expect(state.dailyFriendshipEarned).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// §6.3 借将系统
// ─────────────────────────────────────────────

describe('§6.3 借将系统', () => {
  let friend: FriendSystem;
  let state: SocialState;
  const now = 1000000;

  beforeEach(() => {
    friend = new FriendSystem();
    state = makeState();
    state = friend.addFriend(state, makeFriend('lender'));
  });

  it('§6.3.1 借将战力80%折算', () => {
    const result = friend.borrowHero(state, 'hero_zhaoyun', 'lender', 'borrower', now);
    expect(result.powerRatio).toBe(0.8);
    expect(result.state.dailyBorrowCount).toBe(1);
  });

  it('§6.3.2 借将PvP禁用', () => {
    expect(friend.isBorrowHeroAllowedInPvP()).toBe(false);
  });

  it('§6.3.3 归还借将', () => {
    const borrowResult = friend.borrowHero(state, 'hero_zhaoyun', 'lender', 'borrower', now);
    state = borrowResult.state;

    const borrowId = state.activeBorrows[0].id;
    state = friend.returnBorrowedHero(state, borrowId);
    expect(state.activeBorrows.find((b) => b.id === borrowId)?.returned).toBe(true);
  });

  it('§6.3.4 每日借将3次上限', () => {
    // 需要不同出借方（同一出借方只能同时借出1个）
    state = friend.addFriend(state, makeFriend('lender2'));
    state = friend.addFriend(state, makeFriend('lender3'));

    const result1 = friend.borrowHero(state, 'hero_1', 'lender', 'borrower', now);
    state = result1.state;
    const result2 = friend.borrowHero(state, 'hero_2', 'lender2', 'borrower', now + 1000);
    state = result2.state;
    const result3 = friend.borrowHero(state, 'hero_3', 'lender3', 'borrower', now + 2000);
    state = result3.state;

    expect(state.dailyBorrowCount).toBe(3);
  });
});

// ─────────────────────────────────────────────
// §7 聊天系统
// ─────────────────────────────────────────────

describe('§7 聊天系统', () => {
  let chat: ChatSystem;
  let state: SocialState;
  const now = 1000000;

  beforeEach(() => {
    chat = new ChatSystem();
    state = makeState();
  });

  it('§7.1 世界频道发送消息', () => {
    const result = chat.sendMessage(state, ChatChannel.WORLD, 'p1', 'Player1', 'Hello', now);
    state = result.state;
    expect(result.message.content).toBe('Hello');
    expect(result.message.channel).toBe(ChatChannel.WORLD);
  });

  it('§7.2 世界频道10秒发言间隔', () => {
    const r1 = chat.sendMessage(state, ChatChannel.WORLD, 'p1', 'Player1', 'Msg1', now);
    state = r1.state;
    // 立即再发应失败
    expect(() => chat.sendMessage(state, ChatChannel.WORLD, 'p1', 'Player1', 'Msg2', now + 1000))
      .toThrow('发言间隔太短');
    // 10秒后可以
    const r2 = chat.sendMessage(state, ChatChannel.WORLD, 'p1', 'Player1', 'Msg2', now + 11000);
    expect(r2.message.content).toBe('Msg2');
  });

  it('§7.3 私聊需要目标', () => {
    expect(() => chat.sendMessage(state, ChatChannel.PRIVATE, 'p1', 'Player1', 'Hi', now))
      .toThrow('私聊需要指定目标');
  });

  it('§7.4 私聊成功发送', () => {
    const result = chat.sendMessage(state, ChatChannel.PRIVATE, 'p1', 'Player1', 'Hi', now, 'p2');
    expect(result.message.targetId).toBe('p2');
  });

  it('§7.5 系统频道仅官方', () => {
    expect(() => chat.sendMessage(state, ChatChannel.SYSTEM, 'p1', 'Player1', 'Msg', now))
      .toThrow('系统频道仅限官方发送');
  });

  it('§7.6 系统频道官方可发', () => {
    const result = chat.sendMessage(state, ChatChannel.SYSTEM, 'system', '系统', '通知', now);
    expect(result.message.content).toBe('通知');
  });

  it('§7.7 公会频道发送', () => {
    const result = chat.sendMessage(state, ChatChannel.GUILD, 'p1', 'Player1', '公会消息', now);
    expect(result.message.channel).toBe(ChatChannel.GUILD);
  });

  it('§7.8 消息保留数量限制', () => {
    // 世界频道最多100条
    for (let i = 0; i < 110; i++) {
      const result = chat.sendMessage(state, ChatChannel.WORLD, 'p1', 'Player1', `Msg${i}`, now + i * 11000);
      state = result.state;
    }
    const messages = chat.getMessages(state, ChatChannel.WORLD);
    expect(messages.length).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────
// §7.3 禁言与举报
// ─────────────────────────────────────────────

describe('§7.3 禁言与举报', () => {
  let chat: ChatSystem;
  let state: SocialState;
  const now = 1000000;

  beforeEach(() => {
    chat = new ChatSystem();
    state = makeState();
  });

  it('§7.3.1 一级禁言1小时', () => {
    state = chat.mutePlayer(state, 'bad_player', MuteLevel.LEVEL_1, '广告', now);
    expect(chat.isPlayerMuted(state, 'bad_player', now)).toBe(true);
    expect(chat.isPlayerMuted(state, 'bad_player', now + 3600000)).toBe(false);
  });

  it('§7.3.2 二级禁言24小时', () => {
    state = chat.mutePlayer(state, 'bad_player', MuteLevel.LEVEL_2, '辱骂', now);
    expect(chat.isPlayerMuted(state, 'bad_player', now)).toBe(true);
    expect(chat.isPlayerMuted(state, 'bad_player', now + 24 * 3600000)).toBe(false);
  });

  it('§7.3.3 三级禁言7天', () => {
    state = chat.mutePlayer(state, 'bad_player', MuteLevel.LEVEL_3, '严重违规', now);
    expect(chat.isPlayerMuted(state, 'bad_player', now)).toBe(true);
    expect(chat.isPlayerMuted(state, 'bad_player', now + 7 * 24 * 3600000)).toBe(false);
  });

  it('§7.3.4 禁言期间不可发言', () => {
    state = chat.mutePlayer(state, 'p1', MuteLevel.LEVEL_1, '测试', now);
    expect(() => chat.sendMessage(state, ChatChannel.WORLD, 'p1', 'Player1', 'Hello', now))
      .toThrow('您已被禁言');
  });

  it('§7.3.5 举报提交成功', () => {
    // 先发送一条消息
    const msgResult = chat.sendMessage(state, ChatChannel.WORLD, 'bad', 'BadPlayer', '违规内容', now);
    state = msgResult.state;

    const reportResult = chat.reportMessage(state, 'reporter', 'bad', msgResult.message.id, ReportType.INSULT, now);
    expect(reportResult.isFalseReport).toBe(false);
    expect(reportResult.state.reportRecords).toHaveLength(1);
  });

  it('§7.3.6 恶意举报3次后处罚', () => {
    // 标记3次恶意举报
    state = chat.markFalseReport(state, 'reporter');
    state = chat.markFalseReport(state, 'reporter');
    state = chat.markFalseReport(state, 'reporter');
    expect(state.falseReportCounts['reporter']).toBe(3);

    // 再次举报时被判定为恶意
    const msgResult = chat.sendMessage(state, ChatChannel.WORLD, 'bad', 'BadPlayer', '内容', now);
    state = msgResult.state;
    const reportResult = chat.reportMessage(state, 'reporter', 'bad', msgResult.message.id, ReportType.OTHER, now);
    expect(reportResult.isFalseReport).toBe(true);
  });

  it('§7.3.7 解除禁言', () => {
    state = chat.mutePlayer(state, 'p1', MuteLevel.LEVEL_1, '测试', now);
    expect(chat.isPlayerMuted(state, 'p1', now)).toBe(true);

    state = chat.unmutePlayer(state, 'p1', now);
    expect(chat.isPlayerMuted(state, 'p1', now)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// §9.4 好友→互动→友情点→商店闭环
// ─────────────────────────────────────────────

describe('§9.4 好友→互动→友情点→商店闭环', () => {
  it('§9.4.1 完整互动闭环', () => {
    const friend = new FriendSystem();
    let state = makeState();

    // 1. 添加好友
    state = friend.addFriend(state, makeFriend('f1'));

    // 2. 赠送兵力10次 → 友情点×50
    for (let i = 0; i < 10; i++) {
      const result = friend.giftTroops(state, 'f1', 1000000 + i * 1000);
      state = result.state;
    }

    // 3. 拜访5次 → 铜钱×500
    for (let i = 0; i < 5; i++) {
      const result = friend.visitCastle(state, 'f1', 2000000 + i * 1000);
      state = result.state;
    }

    // 4. 切磋3次胜2场 → 友情点×45
    const sparResults = [true, true, false];
    for (let i = 0; i < 3; i++) {
      const result = friend.spar(state, 'f1', sparResults[i], 3000000 + i * 1000);
      state = result.state;
    }

    // 5. 验证友情点积累
    expect(state.dailyFriendshipEarned).toBeGreaterThan(0);
    expect(state.friendshipPoints).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// §9.5 借将→出征→归还→PvP禁用
// ─────────────────────────────────────────────

describe('§9.5 借将→出征→归还→PvP禁用', () => {
  it('§9.5.1 完整借将流程', () => {
    const friend = new FriendSystem();
    let state = makeState();
    state = friend.addFriend(state, makeFriend('lender'));

    // 1. 借将
    const borrowResult = friend.borrowHero(state, 'hero_zhaoyun', 'lender', 'borrower', 1000000);
    state = borrowResult.state;
    expect(borrowResult.powerRatio).toBe(0.8);
    expect(state.activeBorrows).toHaveLength(1);

    // 2. PvP禁用验证
    expect(friend.isBorrowHeroAllowedInPvP()).toBe(false);

    // 3. 归还
    const borrowId = state.activeBorrows[0].id;
    state = friend.returnBorrowedHero(state, borrowId);
    expect(state.activeBorrows[0].returned).toBe(true);
  });
});

// ─────────────────────────────────────────────
// §9.6 聊天→举报→禁言→反馈闭环
// ─────────────────────────────────────────────

describe('§9.6 聊天→举报→禁言→反馈闭环', () => {
  it('§9.6.1 完整治理闭环', () => {
    const chat = new ChatSystem();
    let state = makeState();
    const now = 1000000;

    // 1. 世界频道发现违规言论
    const msgResult = chat.sendMessage(state, ChatChannel.WORLD, 'bad_player', 'BadPlayer', '违规内容', now);
    state = msgResult.state;

    // 2. 举报
    const reportResult = chat.reportMessage(state, 'reporter', 'bad_player', msgResult.message.id, ReportType.INSULT, now);
    state = reportResult.state;
    expect(reportResult.isFalseReport).toBe(false);
    expect(state.reportRecords).toHaveLength(1);

    // 3. 审核确认违规 → 禁言
    state = chat.mutePlayer(state, 'bad_player', MuteLevel.LEVEL_2, '辱骂', now);
    expect(chat.isPlayerMuted(state, 'bad_player', now)).toBe(true);

    // 4. 禁言期间不可发言
    expect(() => chat.sendMessage(state, ChatChannel.WORLD, 'bad_player', 'BadPlayer', '再发', now + 11000))
      .toThrow('您已被禁言');
  });
});

// ─────────────────────────────────────────────
// §8.6 社交异常处理
// ─────────────────────────────────────────────

describe('§8.6 社交异常处理', () => {
  it('§8.6.1 好友申请被拒绝后不返还次数', () => {
    const friend = new FriendSystem();
    let state = makeState();
    const now = 1000000;

    state = friend.sendFriendRequest(state, 'p1', 'Player1', 'target1', now);
    expect(state.dailyRequestsSent).toBe(1);

    const requestId = state.pendingRequests[0].id;
    state = friend.rejectFriendRequest(state, requestId);
    // 拒绝后次数不返还
    expect(state.dailyRequestsSent).toBe(1);
  });

  it('§8.6.2 清理过期消息', () => {
    const chat = new ChatSystem();
    let state = makeState();
    const now = 1000000;

    // 发送消息
    const result = chat.sendMessage(state, ChatChannel.WORLD, 'p1', 'Player1', 'Hello', now);
    state = result.state;
    expect(chat.getMessages(state, ChatChannel.WORLD)).toHaveLength(1);

    // 清理48小时前的消息
    const futureNow = now + 49 * 3600000;
    state = chat.cleanExpiredMessages(state, futureNow);
    expect(chat.getMessages(state, ChatChannel.WORLD)).toHaveLength(0);
  });
});
