/**
 * 邮件域 — 类型定义
 *
 * v9.0 邮件系统全部类型
 * 规则：只有 interface/type/const，零逻辑
 *
 * @module engine/mail/mail.types
 */

import type { Resources } from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 邮件分类
// ─────────────────────────────────────────────

/** 邮件类别 */
export type MailCategory =
  | 'system'       // 系统通知
  | 'reward'       // 奖励邮件
  | 'combat'       // 战报
  | 'trade'        // 贸易通知
  | 'social'       // 社交消息
  | 'alliance';    // 联盟邮件

/** 邮件优先级 */
export type MailPriority = 'low' | 'normal' | 'high' | 'urgent';

// ─────────────────────────────────────────────
// 2. 邮件状态管理
// ─────────────────────────────────────────────

/** 邮件状态 */
export type MailStatus = 'unread' | 'read' | 'claimed' | 'expired';

/** 邮件附件 */
export interface MailAttachment {
  /** 附件ID */
  id: string;
  /** 附件类型 */
  type: 'resource' | 'item' | 'hero_fragment';
  /** 附件内容描述 */
  content: Resources | Record<string, number>;
  /** 是否已领取 */
  claimed: boolean;
}

/** 邮件数据 */
export interface MailData {
  /** 邮件唯一ID */
  id: string;
  /** 邮件类别 */
  category: MailCategory;
  /** 邮件标题 */
  title: string;
  /** 邮件正文 */
  body: string;
  /** 发送者 */
  sender: string;
  /** 发送时间戳 */
  sendTime: number;
  /** 过期时间戳（0表示永不过期） */
  expireTime: number;
  /** 邮件状态 */
  status: MailStatus;
  /** 优先级 */
  priority: MailPriority;
  /** 附件列表 */
  attachments: MailAttachment[];
  /** 是否已标记为星标 */
  starred: boolean;
}

// ─────────────────────────────────────────────
// 3. 附件领取
// ─────────────────────────────────────────────

/** 附件领取结果 */
export interface ClaimResult {
  /** 是否成功 */
  success: boolean;
  /** 邮件ID */
  mailId: string;
  /** 领取的附件ID列表 */
  claimedAttachmentIds: string[];
  /** 获得的资源 */
  earnedResources: Resources;
  /** 获得的道具 */
  earnedItems: Record<string, number>;
  /** 失败原因 */
  reason?: string;
}

/** 批量领取结果 */
export interface BatchClaimResult {
  /** 成功领取的邮件数 */
  successCount: number;
  /** 失败的邮件数 */
  failCount: number;
  /** 总获得资源 */
  totalEarnedResources: Resources;
  /** 总获得道具 */
  totalEarnedItems: Record<string, number>;
  /** 各邮件领取结果 */
  results: ClaimResult[];
}

// ─────────────────────────────────────────────
// 4. 批量操作
// ─────────────────────────────────────────────

/** 批量操作类型 */
export type BatchAction = 'read_all' | 'claim_all' | 'delete_read' | 'delete_expired';

/** 批量操作结果 */
export interface BatchActionResult {
  /** 操作类型 */
  action: BatchAction;
  /** 影响的邮件数量 */
  affectedCount: number;
  /** 操作附带收益（claim_all时） */
  claimedResult?: BatchClaimResult;
}

// ─────────────────────────────────────────────
// 5. 邮件模板
// ─────────────────────────────────────────────

/** 邮件模板定义 */
export interface MailTemplate {
  /** 模板ID */
  id: string;
  /** 模板类别 */
  category: MailCategory;
  /** 标题模板（支持变量插值 {{var}}） */
  titleTemplate: string;
  /** 正文模板 */
  bodyTemplate: string;
  /** 发送者 */
  sender: string;
  /** 优先级 */
  priority: MailPriority;
  /** 默认过期时间（秒，0=永不过期） */
  defaultExpireSeconds: number;
  /** 默认附件 */
  defaultAttachments?: Omit<MailAttachment, 'id' | 'claimed'>[];
}

/** 邮件模板变量 */
export interface MailTemplateVars {
  [key: string]: string | number;
}

// ─────────────────────────────────────────────
// 6. 邮件筛选
// ─────────────────────────────────────────────

/** 邮件筛选条件 */
export interface MailFilter {
  /** 按类别筛选 */
  category?: MailCategory;
  /** 按状态筛选 */
  status?: MailStatus;
  /** 是否只看星标 */
  starredOnly?: boolean;
  /** 是否只看有附件的 */
  hasAttachments?: boolean;
}

// ─────────────────────────────────────────────
// 7. 存档数据
// ─────────────────────────────────────────────

/** 邮件系统存档数据 */
export interface MailSaveData {
  /** 所有邮件 */
  mails: MailData[];
  /** 最后一次清理时间 */
  lastCleanupTime: number;
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 8. 常量
// ─────────────────────────────────────────────

/** 邮件类别标签 */
export const MAIL_CATEGORY_LABELS: Record<MailCategory, string> = {
  system: '系统',
  reward: '奖励',
  combat: '战报',
  trade: '贸易',
  social: '社交',
  alliance: '联盟',
};

/** 邮件状态标签 */
export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  unread: '未读',
  read: '已读',
  claimed: '已领取',
  expired: '已过期',
};

/** 邮件优先级标签 */
export const MAIL_PRIORITY_LABELS: Record<MailPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

/** 邮箱容量上限 */
export const MAILBOX_CAPACITY = 100;

/** 默认邮件过期天数 */
export const DEFAULT_MAIL_EXPIRE_DAYS = 30;

/** 邮件系统存档版本 */
export const MAIL_SAVE_VERSION = 1;
