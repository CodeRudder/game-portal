/**
 * FriendSystem 单元测试
 *
 * 覆盖：
 *   - 好友CRUD（添加/删除/上限）
 *   - 好友申请（发送/接受/拒绝/每日上限）
 *   - 好友互动（赠送兵力/拜访主城/切磋）
 *   - 借将系统（借将/归还/PvP禁用）
 *   - 友情点系统（每日上限）
 *   - 每日重置
 */

import { FriendSystem } from '../FriendSystem';
import {
  DEFAULT_FRIEND_CONFIG,
  DEFAULT_INTERACTION_CONFIG,
  createDefaultSocialState,
} from '../friend-config';
import { FriendStatus, InteractionType as IT } from '../../../core/social/social.types';
import type {
  FriendData,
  SocialState,
} from '../../../core/social/social.types';

// ── 辅助函数 ──────────────────────────────

/** 创建测试用好友数据 */
function createFriend(overrides: Partial<FriendData> = {}): FriendData {
  return {
    playerId: 'friend_1',
    playerName: '好友1',
    status: FriendStatus.ONLINE,
    power: 8000,
    lastOnlineTime: 1000000,
    friendSince: 900000,
    ...overrides,
  };
}

/** 创建多个好友 */
function createFriends(count: number): Record<string, FriendData> {
  const result: Record<string, FriendData> = {};
  for (let i = 0; i < count; i++) {
    const f = createFriend({
      playerId: `friend_${i}`,
      playerName: `好友${i}`,
      power: 5000 + i * 100,
    });
    result[f.playerId] = f;
  }
  return result;
}

// ── 全局实例 ──────────────────────────────

let system: FriendSystem;
let state: SocialState;

beforeEach(() => {
  system = new FriendSystem();
  state = createDefaultSocialState();
});

// ── 好友添加 ──────────────────────────────

describe('FriendSystem — 好友添加', () => {
  test('正常添加好友', () => {
    const friend = createFriend();
    const newState = system.addFriend(state, friend);
    expect(newState.friends[friend.playerId]).toEqual(friend);
  });

  test('添加多个好友', () => {
    const friends = createFriends(5);
    let s = state;
    for (const f of Object.values(friends)) {
      s = system.addFriend(s, f);
    }
    expect(Object.keys(s.friends).length).toBe(5);
  });

  test('重复添加好友应抛出异常', () => {
    const friend = createFriend();
    const added = system.addFriend(state, friend);
    expect(() => system.addFriend(added, friend)).toThrow('已经是好友了');
  });

  test('达到好友上限应抛出异常', () => {
    let s = state;
    for (let i = 0; i < DEFAULT_FRIEND_CONFIG.maxFriends; i++) {
      s = system.addFriend(s, createFriend({ playerId: `f_${i}` }));
    }
    expect(() => system.addFriend(s, createFriend({ playerId: 'overflow' }))).toThrow('好友数量已达上限');
  });

  test('canAddFriend 在未达上限时返回 true', () => {
    expect(system.canAddFriend(state)).toBe(true);
  });

  test('canAddFriend 达到上限时返回 false', () => {
    let s = state;
    for (let i = 0; i < DEFAULT_FRIEND_CONFIG.maxFriends; i++) {
      s = system.addFriend(s, createFriend({ playerId: `f_${i}` }));
    }
    expect(system.canAddFriend(s)).toBe(false);
  });
});

// ── 好友删除 ──────────────────────────────

describe('FriendSystem — 好友删除', () => {
  test('正常删除好友', () => {
    const friend = createFriend();
    const s = system.addFriend(state, friend);
    const after = system.removeFriend(s, friend.playerId, 2000000);
    expect(after.friends[friend.playerId]).toBeUndefined();
  });

  test('删除非好友应抛出异常', () => {
    expect(() => system.removeFriend(state, 'unknown', 2000000)).toThrow('不是好友');
  });

  test('删除好友后设置冷却', () => {
    const friend = createFriend();
    const s = system.addFriend(state, friend);
    const now = 2000000;
    const after = system.removeFriend(s, friend.playerId, now);
    expect(after.deleteCooldowns[friend.playerId]).toBe(now + DEFAULT_FRIEND_CONFIG.deleteCooldownMs);
  });

  test('删除冷却中再次删除应抛出异常', () => {
    const friend = createFriend();
    const s = system.addFriend(state, friend);
    const now = 2000000;
    const after = system.removeFriend(s, friend.playerId, now);
    // 删除后好友已移除，再次删除会先检查"不是好友"
    // 需要重新添加好友来触发冷却检查
    const readded = system.addFriend(after, friend);
    expect(() => system.removeFriend(readded, friend.playerId, now + 1000)).toThrow('删除冷却中');
  });

  test('冷却结束后可再次删除（重新添加后）', () => {
    const friend = createFriend();
    const s = system.addFriend(state, friend);
    const now = 2000000;
    const after = system.removeFriend(s, friend.playerId, now);
    // 冷却结束后重新添加
    const readded = system.addFriend(after, friend);
    const cooldownEnd = now + DEFAULT_FRIEND_CONFIG.deleteCooldownMs;
    expect(() => system.removeFriend(readded, friend.playerId, cooldownEnd)).not.toThrow();
  });

  test('canRemoveFriend 返回正确状态', () => {
    const friend = createFriend();
    expect(system.canRemoveFriend(state, friend.playerId, 1000)).toBe(false);
    const s = system.addFriend(state, friend);
    expect(system.canRemoveFriend(s, friend.playerId, 1000)).toBe(true);
  });
});

// ── 好友申请 ──────────────────────────────

describe('FriendSystem — 好友申请', () => {
  test('发送好友申请', () => {
    const s = system.sendFriendRequest(state, 'me', '我', 'target', 1000);
    expect(s.pendingRequests.length).toBe(1);
    expect(s.pendingRequests[0].fromPlayerId).toBe('me');
    expect(s.pendingRequests[0].toPlayerId).toBe('target');
    expect(s.dailyRequestsSent).toBe(1);
  });

  test('接受好友申请', () => {
    const s = system.sendFriendRequest(state, 'me', '我', 'target', 1000);
    const requestId = s.pendingRequests[0].id;
    const friendData = createFriend({ playerId: 'me' });
    const after = system.acceptFriendRequest(s, requestId, friendData);
    expect(after.friends['me']).toEqual(friendData);
    expect(after.pendingRequests.length).toBe(0);
  });

  test('拒绝好友申请', () => {
    const s = system.sendFriendRequest(state, 'me', '我', 'target', 1000);
    const requestId = s.pendingRequests[0].id;
    const after = system.rejectFriendRequest(s, requestId);
    expect(after.pendingRequests.length).toBe(0);
  });

  test('接受不存在的申请应抛出异常', () => {
    expect(() => system.acceptFriendRequest(state, 'nonexistent', createFriend())).toThrow('申请不存在');
  });

  test('拒绝不存在的申请应抛出异常', () => {
    expect(() => system.rejectFriendRequest(state, 'nonexistent')).toThrow('申请不存在');
  });

  test('每日申请次数上限', () => {
    let s = state;
    for (let i = 0; i < DEFAULT_FRIEND_CONFIG.dailyRequestLimit; i++) {
      s = system.sendFriendRequest(s, 'me', '我', `target_${i}`, 1000);
    }
    expect(() => system.sendFriendRequest(s, 'me', '我', 'overflow', 1000)).toThrow('今日申请次数已达上限');
  });

  test('对已是好友的玩家发送申请应抛出异常', () => {
    const s = system.addFriend(state, createFriend({ playerId: 'target' }));
    expect(() => system.sendFriendRequest(s, 'me', '我', 'target', 1000)).toThrow('已经是好友了');
  });
});

// ── 好友互动 ──────────────────────────────

describe('FriendSystem — 好友互动', () => {
  let friendState: SocialState;

  beforeEach(() => {
    friendState = system.addFriend(state, createFriend({ playerId: 'f1' }));
  });

  test('赠送兵力', () => {
    const result = system.giftTroops(friendState, 'f1', 1000);
    expect(result.friendshipEarned).toBe(DEFAULT_INTERACTION_CONFIG.giftTroopsFriendshipPoints);
    expect(result.state.friendshipPoints).toBe(DEFAULT_INTERACTION_CONFIG.giftTroopsFriendshipPoints);
    expect(result.state.dailyInteractions.length).toBe(1);
    expect(result.state.dailyInteractions[0].type).toBe(IT.GIFT_TROOPS);
  });

  test('赠送兵力达到每日上限', () => {
    let s = friendState;
    for (let i = 0; i < DEFAULT_INTERACTION_CONFIG.giftTroopsDailyLimit; i++) {
      const result = system.giftTroops(s, 'f1', 1000 + i);
      s = result.state;
    }
    expect(() => system.giftTroops(s, 'f1', 99999)).toThrow('今日赠送次数已达上限');
  });

  test('对非好友赠送兵力应抛出异常', () => {
    expect(() => system.giftTroops(state, 'unknown', 1000)).toThrow('好友不存在');
  });

  test('拜访主城', () => {
    const result = system.visitCastle(friendState, 'f1', 1000);
    expect(result.copperReward).toBe(DEFAULT_INTERACTION_CONFIG.visitCopperReward);
    expect(result.state.dailyInteractions.length).toBe(1);
    expect(result.state.dailyInteractions[0].type).toBe(IT.VISIT_CASTLE);
  });

  test('拜访主城达到每日上限', () => {
    let s = friendState;
    for (let i = 0; i < DEFAULT_INTERACTION_CONFIG.visitDailyLimit; i++) {
      const result = system.visitCastle(s, 'f1', 1000 + i);
      s = result.state;
    }
    expect(() => system.visitCastle(s, 'f1', 99999)).toThrow('今日拜访次数已达上限');
  });

  test('切磋胜利', () => {
    const result = system.spar(friendState, 'f1', true, 1000);
    expect(result.friendshipEarned).toBe(DEFAULT_INTERACTION_CONFIG.sparWinPoints);
    expect(result.state.dailyInteractions[0].type).toBe(IT.SPAR);
  });

  test('切磋失败', () => {
    const result = system.spar(friendState, 'f1', false, 1000);
    expect(result.friendshipEarned).toBe(DEFAULT_INTERACTION_CONFIG.sparLosePoints);
  });

  test('切磋达到每日上限', () => {
    let s = friendState;
    for (let i = 0; i < DEFAULT_INTERACTION_CONFIG.sparDailyLimit; i++) {
      const result = system.spar(s, 'f1', true, 1000 + i);
      s = result.state;
    }
    expect(() => system.spar(s, 'f1', true, 99999)).toThrow('今日切磋次数已达上限');
  });
});

// ── 友情点系统 ──────────────────────────────

describe('FriendSystem — 友情点系统', () => {
  let friendState: SocialState;

  beforeEach(() => {
    friendState = system.addFriend(state, createFriend({ playerId: 'f1' }));
  });

  test('友情点累积', () => {
    let s = friendState;
    const result = system.giftTroops(s, 'f1', 1000);
    s = result.state;
    expect(s.friendshipPoints).toBe(DEFAULT_INTERACTION_CONFIG.giftTroopsFriendshipPoints);
    expect(s.dailyFriendshipEarned).toBe(DEFAULT_INTERACTION_CONFIG.giftTroopsFriendshipPoints);
  });

  test('友情点每日上限', () => {
    let s = friendState;
    // 多次切磋胜利来快速累积友情点（每次20点）
    for (let i = 0; i < DEFAULT_INTERACTION_CONFIG.sparDailyLimit; i++) {
      const result = system.spar(s, 'f1', true, 1000 + i);
      s = result.state;
    }
    // 此时累积了 3*20=60 友情点
    // 继续赠送来填满到上限
    for (let i = 0; i < DEFAULT_INTERACTION_CONFIG.giftTroopsDailyLimit; i++) {
      const result = system.giftTroops(s, 'f1', 2000 + i);
      s = result.state;
    }
    // 总计: 60 + 10*5 = 110
    // 但如果每日上限是200，还没到
    expect(s.dailyFriendshipEarned).toBeLessThanOrEqual(DEFAULT_INTERACTION_CONFIG.friendshipDailyCap);
  });

  test('友情点达到每日上限后不再增加', () => {
    // 使用低上限配置
    const lowCapSystem = new FriendSystem({}, { friendshipDailyCap: 10 });
    let s = lowCapSystem.addFriend(state, createFriend({ playerId: 'f1' }));
    // 第一次赠送获得5点
    const r1 = lowCapSystem.giftTroops(s, 'f1', 1000);
    s = r1.state;
    expect(r1.friendshipEarned).toBe(5);
    // 第二次赠送只能获得5点（上限10）
    const r2 = lowCapSystem.giftTroops(s, 'f1', 2000);
    expect(r2.friendshipEarned).toBe(5);
    // 第三次赠送获得0点
    const r3 = lowCapSystem.giftTroops(r2.state, 'f1', 3000);
    expect(r3.friendshipEarned).toBe(0);
  });
});

// ── 借将系统 ──────────────────────────────

describe('FriendSystem — 借将系统', () => {
  let friendState: SocialState;

  beforeEach(() => {
    friendState = system.addFriend(state, createFriend({ playerId: 'lender' }));
  });

  test('正常借将', () => {
    const result = system.borrowHero(friendState, 'hero_001', 'lender', 'borrower', 1000);
    expect(result.powerRatio).toBe(DEFAULT_INTERACTION_CONFIG.borrowPowerRatio);
    expect(result.state.activeBorrows.length).toBe(1);
    expect(result.state.activeBorrows[0].heroId).toBe('hero_001');
    expect(result.state.activeBorrows[0].lenderPlayerId).toBe('lender');
    expect(result.state.activeBorrows[0].returned).toBe(false);
    expect(result.state.dailyBorrowCount).toBe(1);
  });

  test('借将给出借方增加友情点', () => {
    const result = system.borrowHero(friendState, 'hero_001', 'lender', 'borrower', 1000);
    expect(result.state.friendshipPoints).toBe(DEFAULT_INTERACTION_CONFIG.lendFriendshipPoints);
  });

  test('借将达到每日上限', () => {
    let s = friendState;
    // 添加多个好友作为出借方
    s = system.addFriend(s, createFriend({ playerId: 'lender2' }));
    s = system.addFriend(s, createFriend({ playerId: 'lender3' }));
    const lenders = ['lender', 'lender2', 'lender3'];

    for (let i = 0; i < DEFAULT_INTERACTION_CONFIG.borrowDailyLimit; i++) {
      const result = system.borrowHero(s, `hero_${i}`, lenders[i], 'borrower', 1000 + i);
      s = result.state;
    }
    expect(s.dailyBorrowCount).toBe(DEFAULT_INTERACTION_CONFIG.borrowDailyLimit);
  });

  test('对非好友借将应抛出异常', () => {
    expect(() => system.borrowHero(state, 'hero_001', 'unknown', 'borrower', 1000)).toThrow('不是好友');
  });

  test('同一好友有未归还武将时不能再次借将', () => {
    const s = system.borrowHero(friendState, 'hero_001', 'lender', 'borrower', 1000).state;
    expect(() => system.borrowHero(s, 'hero_002', 'lender', 'borrower', 2000)).toThrow('该好友已有借出武将未归还');
  });

  test('归还借将', () => {
    const s = system.borrowHero(friendState, 'hero_001', 'lender', 'borrower', 1000).state;
    const borrowId = s.activeBorrows[0].id;
    const after = system.returnBorrowedHero(s, borrowId);
    const record = after.activeBorrows.find((b) => b.id === borrowId);
    expect(record!.returned).toBe(true);
  });

  test('归还不存在的借将应抛出异常', () => {
    expect(() => system.returnBorrowedHero(state, 'nonexistent')).toThrow('借将记录不存在');
  });

  test('重复归还应抛出异常', () => {
    const s = system.borrowHero(friendState, 'hero_001', 'lender', 'borrower', 1000).state;
    const borrowId = s.activeBorrows[0].id;
    const after = system.returnBorrowedHero(s, borrowId);
    expect(() => system.returnBorrowedHero(after, borrowId)).toThrow('已归还');
  });

  test('借将不可用于PvP', () => {
    expect(system.isBorrowHeroAllowedInPvP()).toBe(false);
  });
});

// ── 每日重置 ──────────────────────────────

describe('FriendSystem — 每日重置', () => {
  test('重置后每日计数归零', () => {
    let s = system.addFriend(state, createFriend({ playerId: 'f1' }));
    s = system.giftTroops(s, 'f1', 1000).state;
    s = system.sendFriendRequest(s, 'me', '我', 'target', 1000);

    expect(s.dailyInteractions.length).toBeGreaterThan(0);
    expect(s.dailyRequestsSent).toBeGreaterThan(0);

    const after = system.dailyReset(s);
    expect(after.dailyRequestsSent).toBe(0);
    expect(after.dailyInteractions).toEqual([]);
    expect(after.dailyFriendshipEarned).toBe(0);
    expect(after.dailyBorrowCount).toBe(0);
  });

  test('重置不丢失好友列表和友情点', () => {
    let s = system.addFriend(state, createFriend({ playerId: 'f1' }));
    s = system.giftTroops(s, 'f1', 1000).state;

    const after = system.dailyReset(s);
    expect(Object.keys(after.friends).length).toBe(1);
    expect(after.friendshipPoints).toBe(s.friendshipPoints);
  });
});

// ── 工具方法 ──────────────────────────────

describe('FriendSystem — 工具方法', () => {
  test('getFriendList 返回所有好友', () => {
    let s = state;
    for (let i = 0; i < 3; i++) {
      s = system.addFriend(s, createFriend({ playerId: `f_${i}` }));
    }
    const list = system.getFriendList(s);
    expect(list.length).toBe(3);
  });

  test('getOnlineFriends 只返回在线好友', () => {
    let s = state;
    s = system.addFriend(s, createFriend({ playerId: 'online', status: FriendStatus.ONLINE }));
    s = system.addFriend(s, createFriend({ playerId: 'offline', status: FriendStatus.OFFLINE }));
    const online = system.getOnlineFriends(s);
    expect(online.length).toBe(1);
    expect(online[0].playerId).toBe('online');
  });

  test('getDailyInteractionCount 按类型统计', () => {
    let s = system.addFriend(state, createFriend({ playerId: 'f1' }));
    s = system.giftTroops(s, 'f1', 1000).state;
    s = system.giftTroops(s, 'f1', 2000).state;
    s = system.visitCastle(s, 'f1', 3000).state;

    expect(system.getDailyInteractionCount(s, IT.GIFT_TROOPS)).toBe(2);
    expect(system.getDailyInteractionCount(s, IT.VISIT_CASTLE)).toBe(1);
    expect(system.getDailyInteractionCount(s, IT.SPAR)).toBe(0);
  });

  test('getFriendConfig 返回配置副本', () => {
    const config = system.getFriendConfig();
    expect(config.maxFriends).toBe(DEFAULT_FRIEND_CONFIG.maxFriends);
    config.maxFriends = 999;
    expect(system.getFriendConfig().maxFriends).toBe(DEFAULT_FRIEND_CONFIG.maxFriends);
  });

  test('getInteractionConfig 返回配置副本', () => {
    const config = system.getInteractionConfig();
    expect(config.borrowPowerRatio).toBe(DEFAULT_INTERACTION_CONFIG.borrowPowerRatio);
  });
});

// ── 序列化/反序列化 ──────────────────────────────

describe('FriendSystem — 序列化', () => {
  test('序列化后反序列化应恢复状态', () => {
    let s = state;
    s = system.addFriend(s, createFriend({ playerId: 'f1' }));
    s = system.giftTroops(s, 'f1', 1000).state;

    const saved = system.serialize(s);
    const restored = system.deserialize(saved);

    expect(Object.keys(restored.friends).length).toBe(1);
    expect(restored.friendshipPoints).toBe(s.friendshipPoints);
    expect(restored.dailyInteractions.length).toBe(s.dailyInteractions.length);
  });

  test('反序列化无效数据返回默认状态', () => {
    const restored = system.deserialize({ version: 999, state: {} as unknown as Record<string, unknown> });
    expect(Object.keys(restored.friends).length).toBe(0);
  });
});
