/**
 * social/friend-config.ts 单元测试
 *
 * 覆盖导出函数：
 * - generateId
 * - createDefaultSocialState
 *
 * 验证常量：
 * - DEFAULT_FRIEND_CONFIG
 * - DEFAULT_INTERACTION_CONFIG
 * - SOCIAL_SAVE_VERSION
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FRIEND_CONFIG,
  DEFAULT_INTERACTION_CONFIG,
  SOCIAL_SAVE_VERSION,
  generateId,
  createDefaultSocialState,
} from '../friend-config';

// ═══════════════════════════════════════════
// generateId
// ═══════════════════════════════════════════
describe('generateId', () => {
  it('包含指定前缀', () => {
    const id = generateId('friend');
    expect(id).toMatch(/^friend_/);
  });

  it('包含时间戳和随机串', () => {
    const id = generateId('req');
    expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
  });

  it('每次调用生成不同 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(generateId('x'));
    }
    expect(ids.size).toBeGreaterThanOrEqual(19);
  });
});

// ═══════════════════════════════════════════
// createDefaultSocialState
// ═══════════════════════════════════════════
describe('createDefaultSocialState', () => {
  it('返回有效的默认状态', () => {
    const state = createDefaultSocialState();
    expect(state.friends).toEqual({});
    expect(state.pendingRequests).toEqual([]);
    expect(state.dailyRequestsSent).toBe(0);
  });

  it('互动相关字段初始化', () => {
    const state = createDefaultSocialState();
    expect(state.dailyInteractions).toEqual([]);
    expect(state.friendshipPoints).toBe(0);
    expect(state.dailyFriendshipEarned).toBe(0);
  });

  it('借将相关字段初始化', () => {
    const state = createDefaultSocialState();
    expect(state.activeBorrows).toEqual([]);
    expect(state.dailyBorrowCount).toBe(0);
  });

  it('聊天消息频道初始化', () => {
    const state = createDefaultSocialState();
    expect(state.chatMessages.WORLD).toEqual([]);
    expect(state.chatMessages.GUILD).toEqual([]);
    expect(state.chatMessages.PRIVATE).toEqual([]);
    expect(state.chatMessages.SYSTEM).toEqual([]);
  });

  it('删除冷却初始化为空', () => {
    const state = createDefaultSocialState();
    expect(state.deleteCooldowns).toEqual({});
  });

  it('举报相关初始化', () => {
    const state = createDefaultSocialState();
    expect(state.muteRecords).toEqual([]);
    expect(state.reportRecords).toEqual([]);
    expect(state.falseReportCounts).toEqual({});
  });

  it('lastDailyReset 为 0', () => {
    const state = createDefaultSocialState();
    expect(state.lastDailyReset).toBe(0);
  });

  it('lastSendTime 初始化为空', () => {
    const state = createDefaultSocialState();
    expect(state.lastSendTime).toEqual({});
  });

  it('每次调用返回新对象', () => {
    const a = createDefaultSocialState();
    const b = createDefaultSocialState();
    expect(a).not.toBe(b);
    expect(a.friends).not.toBe(b.friends);
    expect(a.chatMessages).not.toBe(b.chatMessages);
  });
});

// ═══════════════════════════════════════════
// 常量验证
// ═══════════════════════════════════════════
describe('常量', () => {
  it('DEFAULT_FRIEND_CONFIG 有合理参数', () => {
    expect(DEFAULT_FRIEND_CONFIG.maxFriends).toBeGreaterThan(0);
    expect(DEFAULT_FRIEND_CONFIG.dailyRequestLimit).toBeGreaterThan(0);
    expect(DEFAULT_FRIEND_CONFIG.pendingRequestLimit).toBeGreaterThan(0);
    expect(DEFAULT_FRIEND_CONFIG.deleteCooldownMs).toBeGreaterThan(0);
  });

  it('DEFAULT_INTERACTION_CONFIG 有合理参数', () => {
    expect(DEFAULT_INTERACTION_CONFIG.giftTroopsDailyLimit).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.visitDailyLimit).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.sparDailyLimit).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.borrowDailyLimit).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.friendshipDailyCap).toBeGreaterThan(0);
  });

  it('互动奖励为正数', () => {
    expect(DEFAULT_INTERACTION_CONFIG.giftTroopsFriendshipPoints).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.visitCopperReward).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.sparWinPoints).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.sparLosePoints).toBeGreaterThan(0);
  });

  it('借将战力比在 (0, 1] 范围', () => {
    expect(DEFAULT_INTERACTION_CONFIG.borrowPowerRatio).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_CONFIG.borrowPowerRatio).toBeLessThanOrEqual(1);
  });

  it('SOCIAL_SAVE_VERSION 为正整数', () => {
    expect(SOCIAL_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(SOCIAL_SAVE_VERSION)).toBe(true);
  });
});
