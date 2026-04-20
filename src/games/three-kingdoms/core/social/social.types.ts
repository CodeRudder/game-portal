/**
 * 社交系统 — 核心类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 覆盖：好友系统、聊天系统、借将系统
 *
 * @module core/social/social.types
 */

// ─────────────────────────────────────────────
// 1. 好友系统
// ─────────────────────────────────────────────

/** 好友状态 */
export enum FriendStatus {
  /** 在线 */
  ONLINE = 'ONLINE',
  /** 离线 */
  OFFLINE = 'OFFLINE',
}

/** 好友关系 */
export interface FriendData {
  /** 好友玩家ID */
  playerId: string;
  /** 好友名称 */
  playerName: string;
  /** 好友状态 */
  status: FriendStatus;
  /** 战力 */
  power: number;
  /** 最后上线时间（时间戳） */
  lastOnlineTime: number;
  /** 成为好友时间（时间戳） */
  friendSince: number;
}

/** 好友申请 */
export interface FriendRequest {
  /** 申请ID */
  id: string;
  /** 发起者玩家ID */
  fromPlayerId: string;
  /** 发起者名称 */
  fromPlayerName: string;
  /** 目标玩家ID */
  toPlayerId: string;
  /** 申请时间（时间戳） */
  timestamp: number;
}

/** 好友配置 */
export interface FriendConfig {
  /** 最大好友数 */
  maxFriends: number; // 50
  /** 每日申请上限 */
  dailyRequestLimit: number; // 20
  /** 待处理申请上限 */
  pendingRequestLimit: number; // 30
  /** 删除好友冷却时间（毫秒） */
  deleteCooldownMs: number; // 24 * 60 * 60 * 1000
}

// ─────────────────────────────────────────────
// 2. 好友互动
// ─────────────────────────────────────────────

/** 互动类型 */
export enum InteractionType {
  /** 赠送兵力 */
  GIFT_TROOPS = 'GIFT_TROOPS',
  /** 拜访主城 */
  VISIT_CASTLE = 'VISIT_CASTLE',
  /** 切磋 */
  SPAR = 'SPAR',
  /** 借将 */
  BORROW_HERO = 'BORROW_HERO',
}

/** 互动配置 */
export interface InteractionConfig {
  /** 每日赠送兵力次数 */
  giftTroopsDailyLimit: number; // 10
  /** 每次赠送获得友情点 */
  giftTroopsFriendshipPoints: number; // 5
  /** 每日拜访次数 */
  visitDailyLimit: number; // 5
  /** 每次拜访获得铜钱 */
  visitCopperReward: number; // 100
  /** 每日切磋次数 */
  sparDailyLimit: number; // 3
  /** 切磋胜利友情点 */
  sparWinPoints: number; // 20
  /** 切磋失败友情点 */
  sparLosePoints: number; // 5
  /** 每日借将次数 */
  borrowDailyLimit: number; // 3
  /** 出借方获得友情点 */
  lendFriendshipPoints: number; // 10
  /** 借将战力折算比例 */
  borrowPowerRatio: number; // 0.8
  /** 友情点每日获取上限 */
  friendshipDailyCap: number; // 200
}

/** 互动记录 */
export interface InteractionRecord {
  /** 互动类型 */
  type: InteractionType;
  /** 目标好友ID */
  targetFriendId: string;
  /** 互动时间（时间戳） */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 3. 借将系统
// ─────────────────────────────────────────────

/** 借将记录 */
export interface BorrowHeroRecord {
  /** 借将ID */
  id: string;
  /** 借用的武将ID */
  heroId: string;
  /** 出借方玩家ID */
  lenderPlayerId: string;
  /** 借用方玩家ID */
  borrowerPlayerId: string;
  /** 借用时间（时间戳） */
  borrowTime: number;
  /** 是否已归还 */
  returned: boolean;
}

/** 借将配置 */
export interface BorrowConfig {
  /** 每日借将次数 */
  dailyBorrowLimit: number; // 3
  /** 战力折算比例 */
  powerRatio: number; // 0.8
  /** 是否可用于PvP */
  allowedInPvP: boolean; // false
}

// ─────────────────────────────────────────────
// 4. 聊天系统
// ─────────────────────────────────────────────

/** 聊天频道类型 */
export enum ChatChannel {
  /** 世界频道 */
  WORLD = 'WORLD',
  /** 公会频道 */
  GUILD = 'GUILD',
  /** 私聊 */
  PRIVATE = 'PRIVATE',
  /** 系统频道 */
  SYSTEM = 'SYSTEM',
}

/** 聊天消息 */
export interface ChatMessage {
  /** 消息ID */
  id: string;
  /** 频道 */
  channel: ChatChannel;
  /** 发送者ID */
  senderId: string;
  /** 发送者名称 */
  senderName: string;
  /** 消息内容 */
  content: string;
  /** 发送时间（时间戳） */
  timestamp: number;
  /** 接收者ID（私聊用） */
  targetId?: string;
}

/** 频道配置 */
export interface ChannelConfig {
  /** 最大消息数 */
  maxMessages: number;
  /** 消息保留时间（毫秒） */
  retentionMs: number;
  /** 发言间隔（毫秒） */
  sendIntervalMs: number;
}

/** 聊天配置 */
export interface ChatConfig {
  /** 各频道配置 */
  channels: Record<ChatChannel, ChannelConfig>;
}

// ─────────────────────────────────────────────
// 5. 禁言与举报
// ─────────────────────────────────────────────

/** 禁言等级 */
export enum MuteLevel {
  /** 一级禁言 — 1小时 */
  LEVEL_1 = 'LEVEL_1',
  /** 二级禁言 — 24小时 */
  LEVEL_2 = 'LEVEL_2',
  /** 三级禁言 — 7天 */
  LEVEL_3 = 'LEVEL_3',
}

/** 禁言记录 */
export interface MuteRecord {
  /** 被禁言玩家ID */
  playerId: string;
  /** 禁言等级 */
  level: MuteLevel;
  /** 禁言开始时间（时间戳） */
  startTime: number;
  /** 禁言结束时间（时间戳） */
  endTime: number;
  /** 禁言原因 */
  reason: string;
}

/** 举报类型 */
export enum ReportType {
  /** 广告 */
  ADVERTISEMENT = 'ADVERTISEMENT',
  /** 辱骂 */
  INSULT = 'INSULT',
  /** 作弊 */
  CHEATING = 'CHEATING',
  /** 其他 */
  OTHER = 'OTHER',
}

/** 举报记录 */
export interface ReportRecord {
  /** 举报ID */
  id: string;
  /** 举报者ID */
  reporterId: string;
  /** 被举报者ID */
  targetId: string;
  /** 举报类型 */
  type: ReportType;
  /** 举报消息ID */
  messageId: string;
  /** 举报时间（时间戳） */
  timestamp: number;
}

/** 举报配置 */
export interface ReportConfig {
  /** 恶意举报处罚禁言等级 */
  falseReportMuteLevel: MuteLevel;
  /** 恶意举报判定阈值（连续举报被驳回次数） */
  falseReportThreshold: number; // 3
}

// ─────────────────────────────────────────────
// 6. 社交系统状态
// ─────────────────────────────────────────────

/** 社交系统状态 */
export interface SocialState {
  /** 好友列表 */
  friends: Record<string, FriendData>;
  /** 待处理的好友申请 */
  pendingRequests: FriendRequest[];
  /** 今日已发送申请数 */
  dailyRequestsSent: number;
  /** 上次重置时间 */
  lastDailyReset: number;
  /** 今日互动记录 */
  dailyInteractions: InteractionRecord[];
  /** 友情点余额 */
  friendshipPoints: number;
  /** 今日已获取友情点 */
  dailyFriendshipEarned: number;
  /** 当前借将记录 */
  activeBorrows: BorrowHeroRecord[];
  /** 今日借将次数 */
  dailyBorrowCount: number;
  /** 删除好友冷却 Map<playerId, cooldownEndTime> */
  deleteCooldowns: Record<string, number>;
  /** 聊天消息（按频道分组） */
  chatMessages: Record<ChatChannel, ChatMessage[]>;
  /** 上次发言时间（按频道） */
  lastSendTime: Record<string, number>;
  /** 禁言记录 */
  muteRecords: MuteRecord[];
  /** 举报记录 */
  reportRecords: ReportRecord[];
  /** 恶意举报计数 */
  falseReportCounts: Record<string, number>;
}

/** 社交系统存档 */
export interface SocialSaveData {
  /** 存档版本 */
  version: number;
  /** 社交状态 */
  state: SocialState;
}
