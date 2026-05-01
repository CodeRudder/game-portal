/**
 * 聊天系统 — 引擎层
 *
 * 职责：多频道聊天、消息存储、发言间隔、禁言、举报
 * 规则：
 *   - 4频道：世界/公会/私聊/系统
 *   - 世界：100条48h/10s间隔
 *   - 公会：100条48h/5s间隔
 *   - 私聊：50条7天/3s间隔
 *   - 系统：30天/仅官方
 *   - 三级禁言：1h/24h/7天
 *   - 恶意举报处罚
 *
 * @module engine/social/ChatSystem
 */

import type {
  ChatMessage,
  ChatConfig,
  ChannelConfig,
  ChatChannel,
  MuteRecord,
  MuteLevel,
  ReportRecord,
  ReportType,
  SocialState,
} from '../../core/social/social.types';
import { ChatChannel as CC, MuteLevel as ML } from '../../core/social/social.types';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认频道配置 */
export const DEFAULT_CHANNEL_CONFIGS: Record<ChatChannel, ChannelConfig> = {
  [CC.WORLD]: {
    maxMessages: 100,
    retentionMs: 48 * 60 * 60 * 1000, // 48小时
    sendIntervalMs: 10 * 1000, // 10秒
  },
  [CC.GUILD]: {
    maxMessages: 100,
    retentionMs: 48 * 60 * 60 * 1000,
    sendIntervalMs: 5 * 1000, // 5秒
  },
  [CC.PRIVATE]: {
    maxMessages: 50,
    retentionMs: 7 * 24 * 60 * 60 * 1000, // 7天
    sendIntervalMs: 3 * 1000, // 3秒
  },
  [CC.SYSTEM]: {
    maxMessages: 100,
    retentionMs: 30 * 24 * 60 * 60 * 1000, // 30天
    sendIntervalMs: 0, // 无限制
  },
};

/** 禁言时长映射 */
export const MUTE_DURATIONS: Record<MuteLevel, number> = {
  [ML.LEVEL_1]: 60 * 60 * 1000, // 1小时
  [ML.LEVEL_2]: 24 * 60 * 60 * 1000, // 24小时
  [ML.LEVEL_3]: 7 * 24 * 60 * 60 * 1000, // 7天
};

/** 生成唯一消息ID */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────
// ChatSystem 类
// ─────────────────────────────────────────────

/**
 * 聊天系统
 *
 * 管理多频道聊天、禁言、举报
 */
export class ChatSystem implements ISubsystem {
  readonly name = 'chat' as const;
  private deps!: ISystemDeps;
  private channelConfigs: Record<ChatChannel, ChannelConfig>;

  constructor(channelConfigs?: Partial<Record<ChatChannel, Partial<ChannelConfig>>>) {
    this.channelConfigs = {
      [CC.WORLD]: { ...DEFAULT_CHANNEL_CONFIGS[CC.WORLD], ...channelConfigs?.WORLD },
      [CC.GUILD]: { ...DEFAULT_CHANNEL_CONFIGS[CC.GUILD], ...channelConfigs?.GUILD },
      [CC.PRIVATE]: { ...DEFAULT_CHANNEL_CONFIGS[CC.PRIVATE], ...channelConfigs?.PRIVATE },
      [CC.SYSTEM]: { ...DEFAULT_CHANNEL_CONFIGS[CC.SYSTEM], ...channelConfigs?.SYSTEM },
    };
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留 */ }
  getState(): unknown { return { channelConfigs: this.channelConfigs }; }
  reset(): void { /* 聊天系统无持久状态 */ }

  // ── 发送消息 ──────────────────────────────

  /**
   * 发送聊天消息
   */
  sendMessage(
    state: SocialState,
    channel: ChatChannel,
    senderId: string,
    senderName: string,
    content: string,
    now: number,
    targetId?: string,
  ): { state: SocialState; message: ChatMessage } {
    // P0-05 fix: 校验 now 必须为有限数
    if (!Number.isFinite(now)) {
      throw new Error('无效的时间参数: now 必须为有限数');
    }

    // 系统频道仅官方
    if (channel === CC.SYSTEM && senderId !== 'system') {
      throw new Error('系统频道仅限官方发送');
    }

    // 检查禁言
    if (this.isPlayerMuted(state, senderId, now)) {
      throw new Error('您已被禁言');
    }

    // 检查发言间隔
    const channelKey = targetId ? `${channel}_${targetId}` : channel;
    const lastSend = state.lastSendTime[channelKey] || 0;
    // P0-03 fix: 拒绝时间回拨
    if (lastSend > 0 && now < lastSend) {
      throw new Error('发送时间不能早于上次发言时间');
    }
    const interval = this.channelConfigs[channel].sendIntervalMs;
    if (interval > 0 && lastSend > 0 && now - lastSend < interval) {
      throw new Error('发言间隔太短');
    }

    // 私聊需要目标
    if (channel === CC.PRIVATE && !targetId) {
      throw new Error('私聊需要指定目标');
    }

    const message: ChatMessage = {
      id: generateMessageId(),
      channel,
      senderId,
      senderName,
      content,
      timestamp: now,
      targetId,
    };

    // 添加消息到频道
    const channelMessages = [...(state.chatMessages[channel] || []), message]
      .slice(-this.channelConfigs[channel].maxMessages);

    return {
      state: {
        ...state,
        chatMessages: {
          ...state.chatMessages,
          [channel]: channelMessages,
        },
        lastSendTime: {
          ...state.lastSendTime,
          [channelKey]: now,
        },
      },
      message,
    };
  }

  // ── 消息查询 ──────────────────────────────

  /**
   * 获取频道消息
   */
  getMessages(state: SocialState, channel: ChatChannel): ChatMessage[] {
    return state.chatMessages[channel] || [];
  }

  /**
   * 获取私聊消息
   */
  getPrivateMessages(
    state: SocialState,
    playerId1: string,
    playerId2: string,
  ): ChatMessage[] {
    return (state.chatMessages[CC.PRIVATE] || []).filter(
      (m) =>
        (m.senderId === playerId1 && m.targetId === playerId2) ||
        (m.senderId === playerId2 && m.targetId === playerId1),
    );
  }

  /**
   * 获取频道配置
   */
  getChannelConfig(channel: ChatChannel): ChannelConfig {
    return { ...this.channelConfigs[channel] };
  }

  // ── 禁言系统 ──────────────────────────────

  /**
   * 禁言玩家
   */
  mutePlayer(
    state: SocialState,
    playerId: string,
    level: MuteLevel,
    reason: string,
    now: number,
  ): SocialState {
    // FIX-R2-P0-03: 校验 now 必须为有限数
    if (!Number.isFinite(now)) {
      throw new Error('无效的时间参数: now 必须为有限数');
    }
    const duration = MUTE_DURATIONS[level];
    const record: MuteRecord = {
      playerId,
      level,
      startTime: now,
      endTime: now + duration,
      reason,
    };

    return {
      ...state,
      muteRecords: [...state.muteRecords, record],
    };
  }

  /**
   * 检查玩家是否被禁言
   */
  isPlayerMuted(state: SocialState, playerId: string, now: number): boolean {
    return state.muteRecords.some(
      (r) => r.playerId === playerId && now >= r.startTime && now < r.endTime,
    );
  }

  /**
   * 获取玩家当前禁言记录
   */
  getActiveMute(state: SocialState, playerId: string, now: number): MuteRecord | undefined {
    return state.muteRecords.find(
      (r) => r.playerId === playerId && now >= r.startTime && now < r.endTime,
    );
  }

  /**
   * 解除禁言
   */
  unmutePlayer(state: SocialState, playerId: string, now: number): SocialState {
    // FIX-R2-P0-03: 校验 now 必须为有限数
    if (!Number.isFinite(now)) {
      throw new Error('无效的时间参数: now 必须为有限数');
    }
    return {
      ...state,
      muteRecords: state.muteRecords.map((r) =>
        r.playerId === playerId && now >= r.startTime && now < r.endTime
          ? { ...r, endTime: now }
          : r,
      ),
    };
  }

  // ── 举报系统 ──────────────────────────────

  /**
   * 举报消息
   */
  reportMessage(
    state: SocialState,
    reporterId: string,
    targetId: string,
    messageId: string,
    reportType: ReportType,
    now: number,
  ): { state: SocialState; isFalseReport: boolean } {
    // FIX-R2-P0-03: 校验 now 必须为有限数
    if (!Number.isFinite(now)) {
      throw new Error('无效的时间参数: now 必须为有限数');
    }
    // 检查是否恶意举报
    const falseReportCount = state.falseReportCounts[reporterId] || 0;
    const isFalseReport = falseReportCount >= 3;

    if (isFalseReport) {
      // 恶意举报：自动禁言举报者
      const newState = this.mutePlayer(
        state,
        reporterId,
        ML.LEVEL_1,
        '恶意举报',
        now,
      );
      return { state: newState, isFalseReport: true };
    }

    const report: ReportRecord = {
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      reporterId,
      targetId,
      type: reportType,
      messageId,
      timestamp: now,
    };

    return {
      state: {
        ...state,
        reportRecords: [...state.reportRecords, report],
      },
      isFalseReport: false,
    };
  }

  /**
   * 标记举报为恶意（驳回举报）
   */
  markFalseReport(state: SocialState, reporterId: string): SocialState {
    const count = (state.falseReportCounts[reporterId] || 0) + 1;
    return {
      ...state,
      falseReportCounts: {
        ...state.falseReportCounts,
        [reporterId]: count,
      },
    };
  }

  // ── 消息清理 ──────────────────────────────

  /**
   * 清理过期消息
   */
  cleanExpiredMessages(state: SocialState, now: number): SocialState {
    // FIX-R2-P0-03: 校验 now 必须为有限数
    if (!Number.isFinite(now)) {
      throw new Error('无效的时间参数: now 必须为有限数');
    }
    const cleanedMessages: Record<string, ChatMessage[]> = {};

    for (const channel of Object.values(CC)) {
      const config = this.channelConfigs[channel];
      const cutoff = now - config.retentionMs;
      cleanedMessages[channel] = (state.chatMessages[channel] || []).filter(
        (m) => m.timestamp >= cutoff,
      );
    }

    return {
      ...state,
      chatMessages: cleanedMessages as SocialState['chatMessages'],
    };
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 获取所有频道配置
   */
  getAllChannelConfigs(): Record<ChatChannel, ChannelConfig> {
    return { ...this.channelConfigs };
  }

  /**
   * 获取频道数量
   */
  getChannelCount(): number {
    return 4; // 世界/公会/私聊/系统
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化聊天相关状态
   */
  serializeChat(state: SocialState): {
    chatMessages: Record<string, import('../../core/social/social.types').ChatMessage[]>;
    lastSendTime: Record<string, number>;
    muteRecords: import('../../core/social/social.types').MuteRecord[];
  } {
    return {
      chatMessages: { ...state.chatMessages },
      lastSendTime: { ...state.lastSendTime },
      muteRecords: [...state.muteRecords],
    };
  }

  /**
   * 反序列化恢复聊天状态
   */
  deserializeChat(data: {
    chatMessages: Record<string, import('../../core/social/social.types').ChatMessage[]>;
    lastSendTime: Record<string, number>;
    muteRecords: import('../../core/social/social.types').MuteRecord[];
  }): Partial<SocialState> {
    // P0-06 fix: 防御性校验
    if (!data) {
      return {
        chatMessages: { WORLD: [], GUILD: [], PRIVATE: [], SYSTEM: [] } as SocialState['chatMessages'],
        lastSendTime: {},
        muteRecords: [],
      };
    }
    return {
      chatMessages: (data.chatMessages ?? {
        WORLD: [], GUILD: [], PRIVATE: [], SYSTEM: [],
      }) as SocialState['chatMessages'],
      lastSendTime: data.lastSendTime ?? {},
      muteRecords: data.muteRecords ?? [],
    };
  }
}
