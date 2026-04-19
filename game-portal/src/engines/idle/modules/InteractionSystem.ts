/**
 * InteractionSystem — 放置游戏互动系统核心模块
 *
 * 提供好友管理、聊天消息、互赠礼物、公会系统等社交互动功能。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 事件驱动，支持 UI 层监听互动状态变化
 * - 完整的存档/读档支持（序列化 / 反序列化）
 * - 礼物赠送冷却时间控制
 *
 * @module engines/idle/modules/InteractionSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 好友关系状态 */
export type FriendStatus = 'pending' | 'accepted' | 'blocked';

/** 好友信息 */
export interface Friend {
  /** 好友唯一标识 */
  id: string;
  /** 好友显示名称 */
  name: string;
  /** 关系状态 */
  status: FriendStatus;
  /** 添加时间戳 */
  addedAt: number;
  /** 上次赠送礼物时间戳（0 表示从未赠送） */
  lastGiftSentAt: number;
}

/** 聊天消息 */
export interface ChatMessage {
  /** 消息唯一标识 */
  id: string;
  /** 发送者 ID */
  fromId: string;
  /** 发送者名称 */
  fromName: string;
  /** 接收者 ID */
  toId: string;
  /** 消息内容 */
  content: string;
  /** 发送时间戳 */
  sentAt: number;
  /** 是否已读 */
  read: boolean;
}

/** 赠送礼物记录 */
export interface GiftRecord {
  /** 目标好友 ID */
  friendId: string;
  /** 礼物类型 */
  giftType: string;
  /** 礼物数量 */
  amount: number;
  /** 赠送时间戳 */
  sentAt: number;
}

/** 拜访记录 */
export interface VisitRecord {
  /** 被拜访好友 ID */
  friendId: string;
  /** 拜访时间戳 */
  visitedAt: number;
}

/** 公会信息 */
export interface Guild {
  /** 公会唯一标识 */
  id: string;
  /** 公会名称 */
  name: string;
  /** 成员 ID 列表 */
  members: string[];
  /** 公会等级 */
  level: number;
  /** 最大成员数 */
  maxMembers: number;
}

/** 公会成员简要信息 */
export interface GuildMember {
  /** 成员 ID */
  id: string;
  /** 成员名称 */
  name: string;
  /** 加入时间戳 */
  joinedAt: number;
}

/** 互动系统事件 */
export type InteractionEvent =
  | { type: 'friend_added'; friendId: string }
  | { type: 'friend_accepted'; friendId: string }
  | { type: 'friend_removed'; friendId: string }
  | { type: 'friend_blocked'; friendId: string }
  | { type: 'gift_sent'; friendId: string; giftType: string; amount: number }
  | { type: 'message_sent'; messageId: string; toId: string }
  | { type: 'message_read'; messageId: string }
  | { type: 'guild_created'; guildId: string }
  | { type: 'guild_joined'; guildId: string }
  | { type: 'guild_left'; guildId: string };

/** 事件监听器函数类型 */
export type InteractionEventListener = (event: InteractionEvent) => void;

// ============================================================
// 常量
// ============================================================

/** 礼物赠送冷却时间（毫秒），默认 1 小时 */
const GIFT_COOLDOWN_MS = 3600_000;

/** 玩家自身 ID（用于区分消息发送者） */
const SELF_ID = 'player';

// ============================================================
// InteractionSystem 实现
// ============================================================

/**
 * 互动系统 — 管理好友、聊天、互赠、公会等社交互动
 *
 * @example
 * ```typescript
 * const interaction = new InteractionSystem();
 * interaction.addFriend('f001', 'Alice');
 * interaction.acceptFriend('f001');
 * interaction.sendGift('f001', 'coin', 100);
 * interaction.sendMessage('f001', '你好！');
 * ```
 */
export class InteractionSystem {

  // ========== 内部数据 ==========

  /** 好友列表：friendId → Friend */
  private friends: Map<string, Friend> = new Map();

  /** 聊天消息列表 */
  private messages: ChatMessage[] = [];

  /** 当前公会（null 表示未加入） */
  private guild: Guild | null = null;

  /** 事件监听器：eventType → callbacks */
  private eventListeners: Map<string, InteractionEventListener[]> = new Map();

  // ============================================================
  // 初始化
  // ============================================================

  constructor() {
    // 纯内存结构，无需额外初始化
  }

  // ============================================================
  // 好友管理
  // ============================================================

  /**
   * 添加好友（状态为 pending）
   *
   * @param friendId - 好友唯一标识
   * @param name - 好友显示名称
   * @returns 是否添加成功（已存在则返回 false）
   */
  addFriend(friendId: string, name: string): boolean {
    if (this.friends.has(friendId)) {
      return false;
    }
    this.friends.set(friendId, {
      id: friendId,
      name,
      status: 'pending',
      addedAt: Date.now(),
      lastGiftSentAt: 0,
    });
    this.emit('friend_added', { type: 'friend_added', friendId });
    return true;
  }

  /**
   * 接受好友请求
   *
   * @param friendId - 好友 ID
   * @returns 是否操作成功
   */
  acceptFriend(friendId: string): boolean {
    const friend = this.friends.get(friendId);
    if (!friend || friend.status !== 'pending') {
      return false;
    }
    friend.status = 'accepted';
    this.emit('friend_accepted', { type: 'friend_accepted', friendId });
    return true;
  }

  /**
   * 删除好友
   *
   * @param friendId - 好友 ID
   * @returns 是否删除成功
   */
  removeFriend(friendId: string): boolean {
    if (!this.friends.has(friendId)) {
      return false;
    }
    this.friends.delete(friendId);
    this.emit('friend_removed', { type: 'friend_removed', friendId });
    return true;
  }

  /**
   * 屏蔽好友
   *
   * @param friendId - 好友 ID
   * @returns 是否操作成功
   */
  blockFriend(friendId: string): boolean {
    const friend = this.friends.get(friendId);
    if (!friend) {
      return false;
    }
    friend.status = 'blocked';
    this.emit('friend_blocked', { type: 'friend_blocked', friendId });
    return true;
  }

  /**
   * 获取所有好友列表
   */
  getFriends(): Friend[] {
    return Array.from(this.friends.values());
  }

  // ============================================================
  // 互赠礼物
  // ============================================================

  /**
   * 向好友赠送礼物
   *
   * 冷却时间内不可重复赠送。
   *
   * @param friendId - 好友 ID
   * @param giftType - 礼物类型
   * @param amount - 礼物数量
   * @returns 是否赠送成功
   */
  sendGift(friendId: string, giftType: string, amount: number): boolean {
    const friend = this.friends.get(friendId);
    if (!friend || friend.status !== 'accepted') {
      return false;
    }
    // 冷却时间检查
    if (friend.lastGiftSentAt > 0 && (Date.now() - friend.lastGiftSentAt) < GIFT_COOLDOWN_MS) {
      return false;
    }
    friend.lastGiftSentAt = Date.now();
    this.emit('gift_sent', {
      type: 'gift_sent',
      friendId,
      giftType,
      amount,
    });
    return true;
  }

  // ============================================================
  // 聊天消息
  // ============================================================

  /**
   * 发送消息给指定好友
   *
   * @param toId - 接收者 ID
   * @param content - 消息内容
   * @returns 生成的消息对象
   */
  sendMessage(toId: string, content: string): ChatMessage {
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromId: SELF_ID,
      fromName: 'Player',
      toId,
      content,
      sentAt: Date.now(),
      read: false,
    };
    this.messages.push(msg);
    this.emit('message_sent', { type: 'message_sent', messageId: msg.id, toId });
    return msg;
  }

  /**
   * 标记消息为已读
   *
   * @param messageId - 消息 ID
   */
  readMessage(messageId: string): void {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) {
      msg.read = true;
      this.emit('message_read', { type: 'message_read', messageId });
    }
  }

  /**
   * 获取所有未读消息
   */
  getUnreadMessages(): ChatMessage[] {
    return this.messages.filter((m) => !m.read);
  }

  /**
   * 获取与指定好友的聊天记录
   *
   * @param friendId - 好友 ID
   */
  getChatHistory(friendId: string): ChatMessage[] {
    // 返回与该好友的聊天记录（发送给该好友 或 来自该好友的消息）
    return this.messages.filter(
      (m) => m.toId === friendId || m.fromId === friendId,
    );
  }

  // ============================================================
  // 公会系统
  // ============================================================

  /**
   * 创建公会
   *
   * @param name - 公会名称
   * @returns 创建的公会对象
   */
  createGuild(name: string): Guild {
    const guild: Guild = {
      id: `guild_${Date.now()}`,
      name,
      members: [SELF_ID],
      level: 1,
      maxMembers: 50,
    };
    this.guild = guild;
    this.emit('guild_created', { type: 'guild_created', guildId: guild.id });
    return guild;
  }

  /**
   * 加入公会
   *
   * @param guildId - 公会 ID（用于验证，当前简化实现直接加入）
   * @returns 是否加入成功
   */
  joinGuild(guildId: string): boolean {
    if (this.guild) {
      return false; // 已在公会中，需先退出
    }
    // 简化实现：直接创建一个对应公会并加入
    this.guild = {
      id: guildId,
      name: 'Joined Guild',
      members: [SELF_ID],
      level: 1,
      maxMembers: 50,
    };
    this.emit('guild_joined', { type: 'guild_joined', guildId });
    return true;
  }

  /**
   * 离开当前公会
   *
   * @returns 是否离开成功
   */
  leaveGuild(): boolean {
    if (!this.guild) {
      return false;
    }
    const guildId = this.guild.id;
    this.guild = null;
    this.emit('guild_left', { type: 'guild_left', guildId });
    return true;
  }

  /**
   * 获取当前公会信息
   */
  getGuild(): Guild | null {
    return this.guild;
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: InteractionEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * 触发事件
   *
   * @param event - 事件名称
   * @param data - 事件数据
   */
  private emit(event: string, data: InteractionEvent): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        cb(data);
      }
    }
  }

  // ============================================================
  // 序列化 / 反序列化
  // ============================================================

  /**
   * 序列化当前状态为可存储对象（深拷贝）
   */
  serialize(): object {
    return {
      friends: Array.from(this.friends.entries()).map(
        ([key, val]) => [key, { ...val }],
      ),
      messages: this.messages.map((m) => ({ ...m })),
      guild: this.guild ? { ...this.guild, members: [...this.guild.members] } : null,
    };
  }

  /**
   * 从序列化数据恢复状态
   *
   * @param data - serialize() 输出的数据
   */
  deserialize(data: Record<string, unknown>): void {
    // 恢复好友列表
    const friendsData = data.friends as [string, Friend][] | undefined;
    this.friends = friendsData
      ? new Map(friendsData)
      : new Map();

    // 恢复消息列表
    const messagesData = data.messages as ChatMessage[] | undefined;
    this.messages = messagesData ? [...messagesData] : [];

    // 恢复公会信息
    this.guild = (data.guild as Guild | null) ?? null;
  }
}
