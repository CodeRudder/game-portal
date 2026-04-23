/**
 * 基础设施层 — 邮件域共享类型与常量
 *
 * 邮件域类型唯一定义源，供 engine 层和 core 层使用。
 * 零 engine/ 依赖，所有基础类型在本文件中定义。
 *
 * 规则：只有 interface/type/const，零逻辑
 *
 * @module shared/mail-types
 */

import type { Resources } from './types';

// ─────────────────────────────────────────────
// 1. 邮件分类与状态
// ─────────────────────────────────────────────

/** 邮件类别 */
export type MailCategory =
  | 'system'       // 系统通知
  | 'reward'       // 奖励邮件
  | 'battle'       // 战报（兼容旧数据）
  | 'combat'       // 战报（新名称）
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
  /** 资源类型（如 'grain', 'gold' 等） */
  resourceType: string;
  /** 数量 */
  amount: number;
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
  content: string;
  /** 发送者 */
  sender: string;
  /** 发送时间戳 */
  sendTime: number;
  /** 过期时间戳（null 表示永不过期） */
  expireTime: number | null;
  /** 邮件状态 */
  status: MailStatus;
  /** 是否已读 */
  isRead: boolean;
  /** 附件列表 */
  attachments: MailAttachment[];
}

// ─────────────────────────────────────────────
// 4. 邮件发送请求
// ─────────────────────────────────────────────

/** 邮件发送请求 */
export interface MailSendRequest {
  category: MailCategory;
  title: string;
  content: string;
  sender: string;
  attachments?: Array<{ resourceType: string; amount: number }>;
  retainSeconds?: number | null;
}

// ─────────────────────────────────────────────
// 5. 附件领取结果
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
// 6. 批量操作
// ─────────────────────────────────────────────

/** 批量操作类型 */
export type BatchAction = 'read_all' | 'claim_all' | 'delete_read' | 'delete_expired';

/** 批量操作结果 */
export interface BatchActionResult {
  action: BatchAction;
  affectedCount: number;
  claimedResult?: BatchClaimResult;
}

/** 批量操作结果（MailSystem 兼容别名） */
export interface BatchOperationResult {
  count: number;
  claimedResources: Record<string, number>;
  successIds: string[];
  failures: Array<{ id: string; reason: string }>;
}

// ─────────────────────────────────────────────
// 7. 邮件模板
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
  defaultAttachments?: Array<{ resourceType: string; amount: number }>;
}

/** 邮件模板变量 */
export interface MailTemplateVars {
  [key: string]: string | number;
}

// ─────────────────────────────────────────────
// 8. 邮件筛选
// ─────────────────────────────────────────────

/** 邮件筛选条件 */
export interface MailFilter {
  category?: MailCategory | 'all';
  status?: MailStatus;
  hasAttachment?: boolean;
  starredOnly?: boolean;
  hasAttachments?: boolean;
}

// ─────────────────────────────────────────────
// 9. 存档数据
// ─────────────────────────────────────────────

/** 邮件系统存档数据 */
export interface MailSaveData {
  mails: MailData[];
  nextId: number;
  version: number;
}

// ─────────────────────────────────────────────
// 10. 常量
// ─────────────────────────────────────────────

/** 邮件类别标签 */
export const MAIL_CATEGORY_LABELS: Record<MailCategory | 'all', string> = {
  all: '全部',
  system: '系统',
  reward: '奖励',
  battle: '战斗',
  combat: '战报',
  trade: '贸易',
  social: '社交',
  alliance: '联盟',
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

/** 每页邮件数量 */
export const MAILS_PER_PAGE = 20;
