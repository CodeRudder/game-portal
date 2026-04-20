/**
 * 邮件域 — 核心类型定义
 *
 * v9.0 邮件系统核心层类型
 * 规则：只有 interface/type/const，零逻辑
 *
 * @module core/mail/mail.types
 */

import type { Resources } from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 邮件分类
// ─────────────────────────────────────────────

/** 邮件类别（4类分类Tab） */
export type MailCategory = 'system' | 'battle' | 'social' | 'reward';

/** 邮件优先级 */
export type MailPriority = 'low' | 'normal' | 'high' | 'urgent';

// ─────────────────────────────────────────────
// 2. 邮件状态管理
// ─────────────────────────────────────────────

/**
 * 邮件四态流转
 *
 * unread → read_unclaimed → read_claimed
 *   ↓                              ↓
 * expired ← ← ← ← ← ← ← ← ← ← ←
 */
export type MailStatus = 'unread' | 'read_unclaimed' | 'read_claimed' | 'expired';

// ─────────────────────────────────────────────
// 3. 邮件附件
// ─────────────────────────────────────────────

/** 邮件附件定义 */
export interface MailAttachment {
  /** 附件ID */
  id: string;
  /** 资源类型（grain/gold/troops/mandate） */
  resourceType: string;
  /** 数量 */
  amount: number;
  /** 是否已领取 */
  claimed: boolean;
}

// ─────────────────────────────────────────────
// 4. 邮件数据
// ─────────────────────────────────────────────

/** 邮件数据 */
export interface MailData {
  /** 邮件唯一ID */
  id: string;
  /** 邮件分类 */
  category: MailCategory;
  /** 邮件标题 */
  title: string;
  /** 邮件正文 */
  content: string;
  /** 发送者 */
  sender: string;
  /** 发送时间戳（ms） */
  sendTime: number;
  /** 过期时间戳（ms），null表示永不过期 */
  expireTime: number | null;
  /** 附件列表 */
  attachments: MailAttachment[];
  /** 邮件状态 */
  status: MailStatus;
  /** 是否已读 */
  isRead: boolean;
}

// ─────────────────────────────────────────────
// 5. 邮件筛选
// ─────────────────────────────────────────────

/** 邮件筛选条件 */
export interface MailFilter {
  /** 分类过滤 */
  category?: MailCategory | 'all';
  /** 状态过滤 */
  status?: MailStatus;
  /** 是否只看有附件 */
  hasAttachment?: boolean;
}

// ─────────────────────────────────────────────
// 6. 邮件发送请求
// ─────────────────────────────────────────────

/** 邮件发送请求 */
export interface MailSendRequest {
  /** 邮件分类 */
  category: MailCategory;
  /** 标题 */
  title: string;
  /** 正文 */
  content: string;
  /** 发送者 */
  sender: string;
  /** 附件 */
  attachments?: Omit<MailAttachment, 'id' | 'claimed'>[];
  /** 保留时长（秒），null表示永不过期 */
  retainSeconds?: number | null;
}

// ─────────────────────────────────────────────
// 7. 批量操作
// ─────────────────────────────────────────────

/** 批量操作结果 */
export interface BatchOperationResult {
  /** 操作的邮件数量 */
  count: number;
  /** 领取的附件资源汇总 */
  claimedResources: Record<string, number>;
  /** 成功的邮件ID列表 */
  successIds: string[];
  /** 失败的邮件ID和原因 */
  failures: Array<{ id: string; reason: string }>;
}

// ─────────────────────────────────────────────
// 8. 存档数据
// ─────────────────────────────────────────────

/** 邮件系统存档数据 */
export interface MailSaveData {
  /** 邮件列表 */
  mails: MailData[];
  /** 下一封邮件ID */
  nextId: number;
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 9. 邮件模板
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
// 10. 常量
// ─────────────────────────────────────────────

/** 邮件类别标签 */
export const MAIL_CATEGORY_LABELS: Record<MailCategory | 'all', string> = {
  all: '全部',
  system: '系统',
  battle: '战斗',
  social: '社交',
  reward: '奖励',
} as const;

/** 邮件状态标签 */
export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  unread: '未读',
  read_unclaimed: '已读未领',
  read_claimed: '已读已领',
  expired: '已过期',
} as const;

/** 每页邮件数量 */
export const MAILS_PER_PAGE = 20;

/** 邮件系统存档版本 */
export const MAIL_SAVE_VERSION = 1;
