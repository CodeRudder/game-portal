/**
 * ChatSystem 单元测试
 *
 * 覆盖：
 *   - 4频道消息发送（世界/公会/私聊/系统）
 *   - 发言间隔限制
 *   - 禁言系统（三级禁言/解禁/检查）
 *   - 举报系统（举报/恶意举报处罚）
 *   - 消息清理（过期消息清理）
 *   - 频道配置
 */

import {
  ChatSystem,
  DEFAULT_CHANNEL_CONFIGS,
  MUTE_DURATIONS,
} from '../ChatSystem';
import {
  ChatChannel as CC,
  MuteLevel as ML,
  ReportType,
} from '../../../core/social/social.types';
import type { SocialState } from '../../../core/social/social.types';
import { createDefaultSocialState } from '../FriendSystem';

// ── 辅助函数 ──────────────────────────────

/** 基准时间：足够大，避免发言间隔冲突 */
const BASE_TIME = 10_000_000;

/** 创建带频道消息的状态 */
function createStateWithMessages(
  channel: CC,
  count: number,
  baseTime: number = BASE_TIME,
): SocialState {
  const state = createDefaultSocialState();
  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      id: `msg_${i}`,
      channel,
      senderId: `sender_${i}`,
      senderName: `Sender${i}`,
      content: `消息${i}`,
      timestamp: baseTime + i * 1000,
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

// ── 全局实例 ──────────────────────────────

let system: ChatSystem;
let state: SocialState;

beforeEach(() => {
  system = new ChatSystem();
  state = createDefaultSocialState();
});

// ── 世界频道 ──────────────────────────────

describe('ChatSystem — 世界频道', () => {
  test('发送世界频道消息', () => {
    const result = system.sendMessage(state, CC.WORLD, 'p1', '玩家1', '你好世界', BASE_TIME);
    expect(result.message.channel).toBe(CC.WORLD);
    expect(result.message.senderId).toBe('p1');
    expect(result.message.content).toBe('你好世界');
    expect(result.state.chatMessages[CC.WORLD].length).toBe(1);
  });

  test('世界频道消息上限100条', () => {
    let s = createStateWithMessages(CC.WORLD, 100, BASE_TIME);
    // 发送第101条，最早的应该被截断
    const result = system.sendMessage(s, CC.WORLD, 'p1', '玩家1', '溢出消息', BASE_TIME + 200000);
    expect(result.state.chatMessages[CC.WORLD].length).toBe(100);
    expect(result.state.chatMessages[CC.WORLD][99].content).toBe('溢出消息');
  });

  test('世界频道发言间隔10秒', () => {
    const config = system.getChannelConfig(CC.WORLD);
    expect(config.sendIntervalMs).toBe(10 * 1000);
  });

  test('发言间隔内重复发送应抛出异常', () => {
    const s = system.sendMessage(state, CC.WORLD, 'p1', '玩家1', '第一条', BASE_TIME).state;
    expect(() => system.sendMessage(s, CC.WORLD, 'p1', '玩家1', '第二条', BASE_TIME + 5000))
      .toThrow('发言间隔太短');
  });

  test('超过发言间隔可以发送', () => {
    const s = system.sendMessage(state, CC.WORLD, 'p1', '玩家1', '第一条', BASE_TIME).state;
    const later = BASE_TIME + DEFAULT_CHANNEL_CONFIGS[CC.WORLD].sendIntervalMs + 1;
    expect(() => system.sendMessage(s, CC.WORLD, 'p1', '玩家1', '第二条', later)).not.toThrow();
  });
});

// ── 公会频道 ──────────────────────────────

describe('ChatSystem — 公会频道', () => {
  test('发送公会频道消息', () => {
    const result = system.sendMessage(state, CC.GUILD, 'p1', '玩家1', '公会消息', BASE_TIME);
    expect(result.message.channel).toBe(CC.GUILD);
    expect(result.state.chatMessages[CC.GUILD].length).toBe(1);
  });

  test('公会频道发言间隔5秒', () => {
    const config = system.getChannelConfig(CC.GUILD);
    expect(config.sendIntervalMs).toBe(5 * 1000);
  });
});

// ── 私聊频道 ──────────────────────────────

describe('ChatSystem — 私聊频道', () => {
  test('发送私聊消息', () => {
    const result = system.sendMessage(state, CC.PRIVATE, 'p1', '玩家1', '私聊内容', BASE_TIME, 'p2');
    expect(result.message.channel).toBe(CC.PRIVATE);
    expect(result.message.targetId).toBe('p2');
    expect(result.state.chatMessages[CC.PRIVATE].length).toBe(1);
  });

  test('私聊需要指定目标', () => {
    expect(() => system.sendMessage(state, CC.PRIVATE, 'p1', '玩家1', '私聊', BASE_TIME))
      .toThrow('私聊需要指定目标');
  });

  test('获取私聊消息按双方过滤', () => {
    let s = state;
    // p1 -> p2
    s = system.sendMessage(s, CC.PRIVATE, 'p1', '玩家1', '你好', BASE_TIME, 'p2').state;
    // p2 -> p1
    s = system.sendMessage(s, CC.PRIVATE, 'p2', '玩家2', '回复', BASE_TIME + 10000, 'p1').state;
    // p1 -> p3 (无关)
    s = system.sendMessage(s, CC.PRIVATE, 'p1', '玩家1', '给p3', BASE_TIME + 20000, 'p3').state;

    const messages = system.getPrivateMessages(s, 'p1', 'p2');
    expect(messages.length).toBe(2);
  });

  test('私聊频道发言间隔3秒', () => {
    const config = system.getChannelConfig(CC.PRIVATE);
    expect(config.sendIntervalMs).toBe(3 * 1000);
  });
});

// ── 系统频道 ──────────────────────────────

describe('ChatSystem — 系统频道', () => {
  test('系统账号可以发送系统消息', () => {
    const result = system.sendMessage(state, CC.SYSTEM, 'system', '系统', '维护通知', BASE_TIME);
    expect(result.message.channel).toBe(CC.SYSTEM);
  });

  test('非系统账号不能发送系统消息', () => {
    expect(() => system.sendMessage(state, CC.SYSTEM, 'p1', '玩家1', '冒充系统', BASE_TIME))
      .toThrow('系统频道仅限官方发送');
  });

  test('系统频道无发言间隔限制', () => {
    const config = system.getChannelConfig(CC.SYSTEM);
    expect(config.sendIntervalMs).toBe(0);
  });
});

// ── 禁言系统 ──────────────────────────────

describe('ChatSystem — 禁言系统', () => {
  test('一级禁言1小时', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_1, '广告', now);
    expect(s.muteRecords.length).toBe(1);
    expect(s.muteRecords[0].endTime).toBe(now + MUTE_DURATIONS[ML.LEVEL_1]);
    expect(s.muteRecords[0].reason).toBe('广告');
  });

  test('二级禁言24小时', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_2, '辱骂', now);
    expect(s.muteRecords[0].endTime).toBe(now + MUTE_DURATIONS[ML.LEVEL_2]);
  });

  test('三级禁言7天', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_3, '严重违规', now);
    expect(s.muteRecords[0].endTime).toBe(now + MUTE_DURATIONS[ML.LEVEL_3]);
  });

  test('被禁言玩家不能发送消息', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_1, '广告', now);
    expect(() => system.sendMessage(s, CC.WORLD, 'p1', '玩家1', '尝试发言', now + 100))
      .toThrow('您已被禁言');
  });

  test('禁言过期后可以发言', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_1, '广告', now);
    const afterMute = now + MUTE_DURATIONS[ML.LEVEL_1] + 1;
    expect(() => system.sendMessage(s, CC.WORLD, 'p1', '玩家1', '解禁了', afterMute)).not.toThrow();
  });

  test('isPlayerMuted 正确判断', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_1, '广告', now);
    expect(system.isPlayerMuted(s, 'p1', now + 100)).toBe(true);
    expect(system.isPlayerMuted(s, 'p1', now + MUTE_DURATIONS[ML.LEVEL_1])).toBe(false);
    expect(system.isPlayerMuted(s, 'other', now + 100)).toBe(false);
  });

  test('getActiveMute 返回当前禁言记录', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_2, '辱骂', now);
    const record = system.getActiveMute(s, 'p1', now + 100);
    expect(record).toBeDefined();
    expect(record!.level).toBe(ML.LEVEL_2);
  });

  test('getActiveMute 无禁言时返回 undefined', () => {
    expect(system.getActiveMute(state, 'p1', BASE_TIME)).toBeUndefined();
  });

  test('手动解除禁言', () => {
    const now = BASE_TIME;
    const s = system.mutePlayer(state, 'p1', ML.LEVEL_1, '广告', now);
    const after = system.unmutePlayer(s, 'p1', now + 100);
    expect(system.isPlayerMuted(after, 'p1', now + 200)).toBe(false);
  });
});

// ── 举报系统 ──────────────────────────────

describe('ChatSystem — 举报系统', () => {
  test('正常举报消息', () => {
    const result = system.reportMessage(state, 'reporter', 'badguy', 'msg_123', ReportType.INSULT, BASE_TIME);
    expect(result.isFalseReport).toBe(false);
    expect(result.state.reportRecords.length).toBe(1);
    expect(result.state.reportRecords[0].reporterId).toBe('reporter');
    expect(result.state.reportRecords[0].targetId).toBe('badguy');
    expect(result.state.reportRecords[0].type).toBe(ReportType.INSULT);
  });

  test('举报多种类型', () => {
    const types = [ReportType.ADVERTISEMENT, ReportType.INSULT, ReportType.CHEATING, ReportType.OTHER];
    let s = state;
    for (const type of types) {
      const result = system.reportMessage(s, 'reporter', 'badguy', `msg_${type}`, type, BASE_TIME);
      s = result.state;
    }
    expect(s.reportRecords.length).toBe(4);
  });

  test('恶意举报3次后自动禁言', () => {
    let s = state;
    // 标记3次恶意举报
    s = system.markFalseReport(s, 'reporter');
    s = system.markFalseReport(s, 'reporter');
    s = system.markFalseReport(s, 'reporter');

    // 第4次举报触发恶意举报处罚
    const result = system.reportMessage(s, 'reporter', 'badguy', 'msg_123', ReportType.INSULT, BASE_TIME);
    expect(result.isFalseReport).toBe(true);
    // 应该被自动禁言
    expect(system.isPlayerMuted(result.state, 'reporter', BASE_TIME)).toBe(true);
  });

  test('markFalseReport 累积计数', () => {
    let s = state;
    s = system.markFalseReport(s, 'reporter');
    expect(s.falseReportCounts['reporter']).toBe(1);
    s = system.markFalseReport(s, 'reporter');
    expect(s.falseReportCounts['reporter']).toBe(2);
  });

  test('不同举报者计数独立', () => {
    let s = state;
    s = system.markFalseReport(s, 'reporter1');
    s = system.markFalseReport(s, 'reporter2');
    expect(s.falseReportCounts['reporter1']).toBe(1);
    expect(s.falseReportCounts['reporter2']).toBe(1);
  });
});

// ── 消息清理 ──────────────────────────────

describe('ChatSystem — 消息清理', () => {
  test('清理过期世界频道消息', () => {
    const now = 20_000_000;
    const oldTime = now - DEFAULT_CHANNEL_CONFIGS[CC.WORLD].retentionMs - 1;
    let s = state;
    // 添加一条过期消息
    s = {
      ...s,
      chatMessages: {
        ...s.chatMessages,
        [CC.WORLD]: [
          { id: 'old', channel: CC.WORLD, senderId: 'p1', senderName: 'P1', content: '旧消息', timestamp: oldTime },
          { id: 'new', channel: CC.WORLD, senderId: 'p1', senderName: 'P1', content: '新消息', timestamp: now },
        ],
      },
    };

    const after = system.cleanExpiredMessages(s, now);
    expect(after.chatMessages[CC.WORLD].length).toBe(1);
    expect(after.chatMessages[CC.WORLD][0].id).toBe('new');
  });

  test('未过期消息不受影响', () => {
    const now = 20_000_000;
    let s = createStateWithMessages(CC.WORLD, 5, now - 1000);
    const after = system.cleanExpiredMessages(s, now);
    expect(after.chatMessages[CC.WORLD].length).toBe(5);
  });
});

// ── 频道配置 ──────────────────────────────

describe('ChatSystem — 频道配置', () => {
  test('getChannelConfig 返回正确配置', () => {
    const worldConfig = system.getChannelConfig(CC.WORLD);
    expect(worldConfig.maxMessages).toBe(100);
    expect(worldConfig.retentionMs).toBe(48 * 60 * 60 * 1000);
  });

  test('getAllChannelConfigs 返回4个频道', () => {
    const configs = system.getAllChannelConfigs();
    expect(Object.keys(configs).length).toBe(4);
  });

  test('getChannelCount 返回4', () => {
    expect(system.getChannelCount()).toBe(4);
  });

  test('自定义频道配置', () => {
    const customSystem = new ChatSystem({
      [CC.WORLD]: { sendIntervalMs: 5000 },
    });
    const config = customSystem.getChannelConfig(CC.WORLD);
    expect(config.sendIntervalMs).toBe(5000);
    // 其他配置不变
    expect(config.maxMessages).toBe(DEFAULT_CHANNEL_CONFIGS[CC.WORLD].maxMessages);
  });

  test('getMessages 返回频道消息', () => {
    let s = state;
    s = system.sendMessage(s, CC.WORLD, 'p1', 'P1', 'hello', BASE_TIME).state;
    s = system.sendMessage(s, CC.WORLD, 'p2', 'P2', 'world', BASE_TIME + 20000).state;
    const msgs = system.getMessages(s, CC.WORLD);
    expect(msgs.length).toBe(2);
  });
});

// ── 序列化 ──────────────────────────────

describe('ChatSystem — 序列化', () => {
  test('序列化后反序列化应恢复聊天状态', () => {
    let s = state;
    s = system.sendMessage(s, CC.WORLD, 'p1', 'P1', 'hello', BASE_TIME).state;
    s = system.mutePlayer(s, 'bad', ML.LEVEL_1, 'spam', BASE_TIME);

    const serialized = system.serializeChat(s);
    const restored = system.deserializeChat(serialized);

    expect(restored.chatMessages![CC.WORLD].length).toBe(1);
    expect(restored.muteRecords!.length).toBe(1);
  });

  test('反序列化空数据返回默认值', () => {
    const restored = system.deserializeChat({} as unknown as Record<string, unknown>);
    expect(restored.muteRecords).toEqual([]);
    expect(restored.lastSendTime).toEqual({});
  });
});
