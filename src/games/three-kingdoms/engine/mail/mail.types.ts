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
// 1. 邮件分类与状态
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

/**
 * 邮件状态（v9.0 四态管理）
 *
 * unread:         未读
 * read_unclaimed: 已读未领（有附件未领取）
 * read_claimed:   已读已领（附件已领取或无附件）
 * expired:        已过期
 */
export type MailStatus = 'unread' | 'read_unclaimed' | 'read_claimed' | 'expired';

// ─────────────────────────────────────────────
// 2. 邮件附件
// ─────────────────────────────────────────────

/** 邮件附件 */
export interface MailAttachment {
  /** 附件ID */
  id: string;
  /** 附件类型 */
  type: 'resource' | 'item' | 'hero_fragment';
  /** 附件内容 */
  content: Resources | Record<string, number>;
  /** 是否已领取 */
  claimed: boolean;
}

// ─────────────────────────────────────────────
// 3. 邮件数据
// ─────────────────────────────────────────────

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
  /** 是否星标 */
  starred: boolean;
}

// ─────────────────────────────────────────────
// 4. 附件领取结果
// ─────────────────────────────────────────────

/** 单封附件领取结果 */
export interface ClaimResult {
  success: boolean;
  mailId: string;
  claimedAttachmentIds: string[];
  earnedResources: Resources;
  earnedItems: Record<string, number>;
  reason?: string;
}

/** 批量领取结果 */
export interface BatchClaimResult {
  successCount: number;
  failCount: number;
  totalEarnedResources: Resources;
  totalEarnedItems: Record<string, number>;
  results: ClaimResult[];
}

// ─────────────────────────────────────────────
// 5. 批量操作
// ─────────────────────────────────────────────

/** 批量操作类型 */
export type BatchAction = 'read_all' | 'claim_all' | 'delete_read' | 'delete_expired';

/** 批量操作结果 */
export interface BatchActionResult {
  action: BatchAction;
  affectedCount: number;
  claimedResult?: BatchClaimResult;
}

// ─────────────────────────────────────────────
// 6. 邮件模板
// ─────────────────────────────────────────────

/** 邮件模板定义 */
export interface MailTemplate {
  id: string;
  category: MailCategory;
  titleTemplate: string;
  bodyTemplate: string;
  sender: string;
  priority: MailPriority;
  defaultExpireSeconds: number;
  defaultAttachments?: Omit<MailAttachment, 'id' | 'claimed'>[];
}

/** 邮件模板变量 */
export interface MailTemplateVars {
  [key: string]: string | number;
}

// ─────────────────────────────────────────────
// 7. 邮件筛选
// ─────────────────────────────────────────────

/** 邮件筛选条件 */
export interface MailFilter {
  category?: MailCategory;
  status?: MailStatus;
  starredOnly?: boolean;
  hasAttachments?: boolean;
}

// ─────────────────────────────────────────────
// 8. 存档数据
// ─────────────────────────────────────────────

/** 邮件系统存档数据 */
export interface MailSaveData {
  mails: MailData[];
  lastCleanupTime: number;
  version: number;
}

// ─────────────────────────────────────────────
// 9. 常量
// ─────────────────────────────────────────────

/** 邮件类别标签 */
export const MAIL_CATEGORY_LABELS: Record<MailCategory, string> = {
  system: '系统', reward: '奖励', combat: '战报',
  trade: '贸易', social: '社交', alliance: '联盟',
};

/** 邮件状态标签 */
export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  unread: '未读', read_unclaimed: '已读未领', read_claimed: '已读已领', expired: '已过期',
};

/** 邮件优先级标签 */
export const MAIL_PRIORITY_LABELS: Record<MailPriority, string> = {
  low: '低', normal: '普通', high: '高', urgent: '紧急',
};

/** 邮箱容量上限 */
export const MAILBOX_CAPACITY = 100;

/** 默认邮件过期天数 */
export const DEFAULT_MAIL_EXPIRE_DAYS = 30;

/** 邮件系统存档版本 */
export const MAIL_SAVE_VERSION = 1;
