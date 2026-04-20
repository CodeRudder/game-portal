/**
 * ChatSystem 单元测试
 *
 * 覆盖：
 *   - 4频道（世界/公会/私聊/系统）
 *   - 发言间隔限制
 *   - 消息容量上限
 *   - 禁言系统（三级禁言/解除）
 *   - 举报系统（举报/恶意举报处罚）
 *   - 过期消息清理
 */

import {
  ChatSystem,
  DEFAULT_CHANNEL_CONFIGS,
  MUTE_DURATIONS,
} from '../ChatSystem';
import {
  ChatChannel,
  MuteLevel,
  ReportType,
} from '../../../core/social/social.types';
import type {
  ChatMessage,
  MuteRecord,
  SocialState,
} from '../../../core/social/social.types';
import { createDefaultSocialState } from '../FriendSystem';

// ── 辅助函数 ──────────────────────────────

/** 创建带有基础消息的状态 */
function createStateWithMessages(
  channel: ChatChannel,
  count: number,
  baseTime: number = 1000000,
): SocialState {
  const state = createDefaultSocialState();
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      id: `msg_${i}`,
      channel,
      senderId: `sender_${i}`,
      senderName: `发送者${i}`,
      content: `消息内容${i}`,
      timestamp: baseTime + i * 1000,
      targetId: channel === ChatChannel.PRIVATE ? `target_${i}` : undefined,
    });
  }
  return {
    ...state,
    chatMessages: {
      ...state.chatMessages,
      [channel]: messages,
    },
  };
}

// ── 4频道基础 ────────────────────────────

describe('ChatSystem — 4频道基础', () => {
  let system: ChatSystem;

  beforeEach(() => {
    system = new ChatSystem();
  });

  test('应有4个频道', () => {
    expect(system.getChannelCount()).toBe(4);
  });

  test('世界频道配置', () => {
    const config = system.getChannelConfig(ChatChannel.WORLD);
    expect(config.maxMessages).toBe(100);
    expect(config.retentionMs).toBe(48 * 60 * 60 * 1000);
    expect(config.sendIntervalMs).toBe(10 * 1000);
  });

  test('公会频道配置', () => {
    const config = system.getChannelConfig(ChatChannel.GUILD);
    expect(config.maxMessages).toBe(100);
    expect(config.retentionMs).toBe(48 * 60 * 60 * 1000);
    expect(config.sendIntervalMs).toBe(5 * 1000);
  });

  test('私聊频道配置', () => {
    const config = system.getChannelConfig(ChatChannel.PRIVATE);
    expect(config.maxMessages).toBe(50);
    expect(config.retentionMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(config.sendIntervalMs).toBe(3 * 1000);
  });

  test('系统频道配置', () => {
    const config = system.getChannelConfig(ChatChannel.SYSTEM);
    expect(config.maxMessages).toBe(100);
    expect(config.retentionMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(config.sendIntervalMs).toBe(0);
  });

  test('世界频道发送消息成功', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.sendMessage(
      state, ChatChannel.WORLD, 'player1', '玩家1', '你好世界', now,
    );
    expect(result.message.content).toBe('你好世界');
    expect(result.message.channel).toBe(ChatChannel.WORLD);
    expect(result.message.senderId).toBe('player1');
    expect(result.state.chatMessages[ChatChannel.WORLD].length).toBe(1);
  });

  test('公会频道发送消息成功', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.sendMessage(
      state, ChatChannel.GUILD, 'player1', '玩家1', '公会消息', now,
    );
    expect(result.message.channel).toBe(ChatChannel.GUILD);
    expect(result.state.chatMessages[ChatChannel.GUILD].length).toBe(1);
  });

  test('私聊发送消息成功', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.sendMessage(
      state, ChatChannel.PRIVATE, 'player1', '玩家1', '私聊消息', now, 'player2',
    );
    expect(result.message.targetId).toBe('player2');
    expect(result.state.chatMessages[ChatChannel.PRIVATE].length).toBe(1);
  });

  test('系统频道仅限官方发送', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    // 普通玩家发送系统消息应失败
    expect(() => system.sendMessage(
      state, ChatChannel.SYSTEM, 'player1', '玩家1', '系统消息', now,
    )).toThrow('系统频道仅限官方发送');

    // system可以发送
    const result = system.sendMessage(
      state, ChatChannel.SYSTEM, 'system', '系统', '系统公告', now,
    );
    expect(result.message.senderId).toBe('system');
  });

  test('私聊未指定目标应抛出异常', () => {
    const state = createDefaultSocialState();
    // now需要大于私聊间隔(3秒)，避免先触发间隔检查
    expect(() => system.sendMessage(
      state, ChatChannel.PRIVATE, 'player1', '玩家1', '私聊', 100000,
    )).toThrow('私聊需要指定目标');
  });
});

// ── 发言间隔限制 ──────────────────────────

describe('ChatSystem — 发言间隔', () => {
  let system: ChatSystem;

  beforeEach(() => {
    system = new ChatSystem();
  });

  test('世界频道10秒间隔', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    // 第一次发送成功
    const result = system.sendMessage(
      state, ChatChannel.WORLD, 'player1', '玩家1', '第一条', now,
    );

    // 5秒后发送应失败
    expect(() => system.sendMessage(
      result.state, ChatChannel.WORLD, 'player1', '玩家1', '第二条', now + 5000,
    )).toThrow('发言间隔太短');

    // 10秒后发送成功
    const result2 = system.sendMessage(
      result.state, ChatChannel.WORLD, 'player1', '玩家1', '第三条', now + 10000,
    );
    expect(result2.message.content).toBe('第三条');
  });

  test('公会频道5秒间隔', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.sendMessage(
      state, ChatChannel.GUILD, 'player1', '玩家1', '消息1', now,
    );

    // 3秒后失败
    expect(() => system.sendMessage(
      result.state, ChatChannel.GUILD, 'player1', '玩家1', '消息2', now + 3000,
    )).toThrow('发言间隔太短');

    // 5秒后成功
    const result2 = system.sendMessage(
      result.state, ChatChannel.GUILD, 'player1', '玩家1', '消息3', now + 5000,
    );
    expect(result2.message.content).toBe('消息3');
  });

  test('私聊3秒间隔', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.sendMessage(
      state, ChatChannel.PRIVATE, 'player1', '玩家1', '私聊1', now, 'player2',
    );

    // 1秒后失败
    expect(() => system.sendMessage(
      result.state, ChatChannel.PRIVATE, 'player1', '玩家1', '私聊2', now + 1000, 'player2',
    )).toThrow('发言间隔太短');

    // 3秒后成功
    const result2 = system.sendMessage(
      result.state, ChatChannel.PRIVATE, 'player1', '玩家1', '私聊3', now + 3000, 'player2',
    );
    expect(result2.message.content).toBe('私聊3');
  });

  test('系统频道无间隔限制', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result1 = system.sendMessage(
      state, ChatChannel.SYSTEM, 'system', '系统', '公告1', now,
    );
    // 立即再发也不会报错
    const result2 = system.sendMessage(
      result1.state, ChatChannel.SYSTEM, 'system', '系统', '公告2', now + 1,
    );
    expect(result2.message.content).toBe('公告2');
  });
});

// ── 消息容量上限 ──────────────────────────

describe('ChatSystem — 消息容量', () => {
  test('世界频道最多保留100条消息', () => {
    const system = new ChatSystem();
    let state = createDefaultSocialState();
    const now = 1000000;

    // 发送110条消息
    for (let i = 0; i < 110; i++) {
      state = system.sendMessage(
        state, ChatChannel.WORLD, 'player1', '玩家1', `消息${i}`, now + i * 10000,
      ).state;
    }

    const messages = system.getMessages(state, ChatChannel.WORLD);
    expect(messages.length).toBe(100);
    // 最早的10条被丢弃
    expect(messages[0].content).toBe('消息10');
  });

  test('私聊最多保留50条消息', () => {
    const system = new ChatSystem();
    let state = createDefaultSocialState();
    const now = 1000000;

    for (let i = 0; i < 60; i++) {
      state = system.sendMessage(
        state, ChatChannel.PRIVATE, 'player1', '玩家1', `消息${i}`, now + i * 3000, 'player2',
      ).state;
    }

    const messages = system.getMessages(state, ChatChannel.PRIVATE);
    expect(messages.length).toBe(50);
  });

  test('获取私聊消息应过滤双方对话', () => {
    const system = new ChatSystem();
    let state = createDefaultSocialState();
    const now = 1000000;

    // player1 → player2
    state = system.sendMessage(
      state, ChatChannel.PRIVATE, 'player1', '玩家1', '你好', now, 'player2',
    ).state;
    // player3 → player4（无关对话）
    state = system.sendMessage(
      state, ChatChannel.PRIVATE, 'player3', '玩家3', '无关', now + 1, 'player4',
    ).state;
    // player2 → player1
    state = system.sendMessage(
      state, ChatChannel.PRIVATE, 'player2', '玩家2', '回复', now + 2, 'player1',
    ).state;

    const privateMsgs = system.getPrivateMessages(state, 'player1', 'player2');
    expect(privateMsgs.length).toBe(2);
  });
});

// ── 禁言系统 ──────────────────────────────

describe('ChatSystem — 禁言系统', () => {
  let system: ChatSystem;

  beforeEach(() => {
    system = new ChatSystem();
  });

  test('三级禁言时长正确', () => {
    expect(MUTE_DURATIONS[MuteLevel.LEVEL_1]).toBe(60 * 60 * 1000); // 1小时
    expect(MUTE_DURATIONS[MuteLevel.LEVEL_2]).toBe(24 * 60 * 60 * 1000); // 24小时
    expect(MUTE_DURATIONS[MuteLevel.LEVEL_3]).toBe(7 * 24 * 60 * 60 * 1000); // 7天
  });

  test('一级禁言1小时', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_1, '违规发言', now);
    expect(result.muteRecords.length).toBe(1);
    expect(result.muteRecords[0].endTime - now).toBe(60 * 60 * 1000);
  });

  test('二级禁言24小时', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_2, '多次违规', now);
    expect(result.muteRecords[0].endTime - now).toBe(24 * 60 * 60 * 1000);
  });

  test('三级禁言7天', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_3, '严重违规', now);
    expect(result.muteRecords[0].endTime - now).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('禁言期间不可发言', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const mutedState = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_1, '违规', now);

    expect(() => system.sendMessage(
      mutedState, ChatChannel.WORLD, 'player1', '玩家1', '试试', now + 1000,
    )).toThrow('您已被禁言');
  });

  test('禁言到期后可发言', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const mutedState = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_1, '违规', now);

    // 禁言1小时后
    const afterMute = now + 60 * 60 * 1000 + 1;
    const result = system.sendMessage(
      mutedState, ChatChannel.WORLD, 'player1', '玩家1', '解禁了', afterMute,
    );
    expect(result.message.content).toBe('解禁了');
  });

  test('检查禁言状态', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const mutedState = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_2, '违规', now);

    expect(system.isPlayerMuted(mutedState, 'player1', now + 1000)).toBe(true);
    expect(system.isPlayerMuted(mutedState, 'player1', now + 24 * 60 * 60 * 1000)).toBe(false);
    expect(system.isPlayerMuted(mutedState, 'player2', now + 1000)).toBe(false);
  });

  test('获取当前禁言记录', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const mutedState = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_1, '违规', now);
    const record = system.getActiveMute(mutedState, 'player1', now + 500);

    expect(record).toBeDefined();
    expect(record!.level).toBe(MuteLevel.LEVEL_1);
    expect(record!.reason).toBe('违规');
  });

  test('解除禁言', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const mutedState = system.mutePlayer(state, 'player1', MuteLevel.LEVEL_2, '违规', now);
    const unmutedState = system.unmutePlayer(mutedState, 'player1', now + 1000);

    expect(system.isPlayerMuted(unmutedState, 'player1', now + 2000)).toBe(false);
  });

  test('未禁言玩家检查返回false', () => {
    const state = createDefaultSocialState();
    expect(system.isPlayerMuted(state, 'player1', 1000)).toBe(false);
  });
});

// ── 举报系统 ──────────────────────────────

describe('ChatSystem — 举报系统', () => {
  let system: ChatSystem;

  beforeEach(() => {
    system = new ChatSystem();
  });

  test('举报消息成功', () => {
    const state = createDefaultSocialState();
    const now = 1000000;

    const result = system.reportMessage(
      state, 'reporter', 'offender', 'msg_123', ReportType.INSULT, now,
    );
    expect(result.isFalseReport).toBe(false);
    expect(result.state.reportRecords.length).toBe(1);
    expect(result.state.reportRecords[0].reporterId).toBe('reporter');
    expect(result.state.reportRecords[0].targetId).toBe('offender');
    expect(result.state.reportRecords[0].type).toBe(ReportType.INSULT);
  });

  test('举报类型包括广告/辱骂/作弊/其他', () => {
    expect(ReportType.ADVERTISEMENT).toBe('ADVERTISEMENT');
    expect(ReportType.INSULT).toBe('INSULT');
    expect(ReportType.CHEATING).toBe('CHEATING');
    expect(ReportType.OTHER).toBe('OTHER');
  });

  test('恶意举报3次后自动禁言举报者', () => {
    let state: SocialState = createDefaultSocialState();
    const now = 1000000;

    // 标记3次恶意举报
    state = system.markFalseReport(state, 'badReporter');
    state = system.markFalseReport(state, 'badReporter');
    state = system.markFalseReport(state, 'badReporter');

    // 再次举报应被判定为恶意举报
    const result = system.reportMessage(
      state, 'badReporter', 'target', 'msg_1', ReportType.OTHER, now,
    );
    expect(result.isFalseReport).toBe(true);
    // 举报者被自动禁言
    expect(system.isPlayerMuted(result.state, 'badReporter', now)).toBe(true);
  });

  test('2次恶意举报后仍可正常举报', () => {
    let state: SocialState = createDefaultSocialState();
    const now = 1000000;

    state = system.markFalseReport(state, 'reporter');
    state = system.markFalseReport(state, 'reporter');

    const result = system.reportMessage(
      state, 'reporter', 'target', 'msg_1', ReportType.OTHER, now,
    );
    expect(result.isFalseReport).toBe(false);
    expect(result.state.reportRecords.length).toBe(1);
  });

  test('标记恶意举报递增计数', () => {
    let state: SocialState = createDefaultSocialState();

    state = system.markFalseReport(state, 'reporter');
    expect(state.falseReportCounts['reporter']).toBe(1);

    state = system.markFalseReport(state, 'reporter');
    expect(state.falseReportCounts['reporter']).toBe(2);
  });

  test('不同举报者独立计数', () => {
    let state: SocialState = createDefaultSocialState();

    state = system.markFalseReport(state, 'reporter1');
    state = system.markFalseReport(state, 'reporter1');
    state = system.markFalseReport(state, 'reporter2');

    expect(state.falseReportCounts['reporter1']).toBe(2);
    expect(state.falseReportCounts['reporter2']).toBe(1);
  });
});

// ── 过期消息清理 ──────────────────────────

describe('ChatSystem — 过期消息清理', () => {
  test('清理过期世界频道消息（48小时）', () => {
    const system = new ChatSystem();
    const now = 100000000;
    const state = createStateWithMessages(ChatChannel.WORLD, 5, now - 50 * 60 * 60 * 1000);

    // 添加一条新消息
    const freshState = {
      ...state,
      chatMessages: {
        ...state.chatMessages,
        [ChatChannel.WORLD]: [
          ...state.chatMessages[ChatChannel.WORLD],
          {
            id: 'fresh_msg',
            channel: ChatChannel.WORLD,
            senderId: 'player1',
            senderName: '玩家1',
            content: '新消息',
            timestamp: now - 1000,
          },
        ],
      },
    };

    const cleaned = system.cleanExpiredMessages(freshState, now);
    const messages = cleaned.chatMessages[ChatChannel.WORLD];
    // 48小时前的消息被清理，只保留新消息
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe('fresh_msg');
  });

  test('清理过期私聊消息（7天）', () => {
    const system = new ChatSystem();
    const now = 100000000;
    const state = createStateWithMessages(ChatChannel.PRIVATE, 3, now - 8 * 24 * 60 * 60 * 1000);

    const cleaned = system.cleanExpiredMessages(state, now);
    expect(cleaned.chatMessages[ChatChannel.PRIVATE].length).toBe(0);
  });

  test('未过期消息不受影响', () => {
    const system = new ChatSystem();
    const now = 100000000;
    const state = createStateWithMessages(ChatChannel.GUILD, 5, now - 1000);

    const cleaned = system.cleanExpiredMessages(state, now);
    expect(cleaned.chatMessages[ChatChannel.GUILD].length).toBe(5);
  });
});

// ── 配置覆盖 ──────────────────────────────

describe('ChatSystem — 配置覆盖', () => {
  test('自定义频道配置', () => {
    const system = new ChatSystem({
      [ChatChannel.WORLD]: { sendIntervalMs: 5000 },
    });

    const config = system.getChannelConfig(ChatChannel.WORLD);
    expect(config.sendIntervalMs).toBe(5000);
    // 其他配置保持默认
    expect(config.maxMessages).toBe(100);
  });

  test('获取所有频道配置', () => {
    const system = new ChatSystem();
    const configs = system.getAllChannelConfigs();

    expect(configs[ChatChannel.WORLD]).toBeDefined();
    expect(configs[ChatChannel.GUILD]).toBeDefined();
    expect(configs[ChatChannel.PRIVATE]).toBeDefined();
    expect(configs[ChatChannel.SYSTEM]).toBeDefined();
  });
});

// ── 存档序列化 ────────────────────────────

describe('ChatSystem — 存档序列化', () => {
  test('序列化和反序列化聊天状态', () => {
    const system = new ChatSystem();
    let state = createDefaultSocialState();
    const now = 1000000;

    state = system.sendMessage(
      state, ChatChannel.WORLD, 'player1', '玩家1', '消息', now,
    ).state;
    state = system.mutePlayer(state, 'player2', MuteLevel.LEVEL_1, '违规', now);

    const serialized = system.serializeChat(state);
    const deserialized = system.deserializeChat(serialized);

    expect(deserialized.chatMessages).toBeDefined();
    expect(deserialized.muteRecords).toBeDefined();
    expect(deserialized.lastSendTime).toBeDefined();
    expect(deserialized.muteRecords!.length).toBe(1);
  });

  test('反序列化空数据应返回默认值', () => {
    const system = new ChatSystem();
    const result = system.deserializeChat({
      chatMessages: undefined as any,
      lastSendTime: undefined as any,
      muteRecords: undefined as any,
    });

    expect(result.muteRecords).toEqual([]);
    expect(result.lastSendTime).toEqual({});
  });
});
