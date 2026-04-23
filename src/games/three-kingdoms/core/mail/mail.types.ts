/**
 * 邮件域 — 核心层类型（从 shared 层重导出）
 *
 * v9.0 邮件系统类型唯一定义源：shared/mail-types.ts
 * core 层通过重导出使用，避免重复定义和跨层引用。
 *
 * @module core/mail/mail.types
 */

export {
  // 类型
  type MailCategory,
  type MailPriority,
  type MailStatus,
  type MailAttachment,
  type MailData,
  type MailFilter,
  type MailSendRequest,
  type ClaimResult,
  type BatchClaimResult,
  type BatchAction,
  type BatchActionResult,
  type BatchOperationResult,
  type MailTemplate,
  type MailTemplateVars,
  type MailSaveData,
  // 常量
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_PRIORITY_LABELS,
  MAILBOX_CAPACITY,
  DEFAULT_MAIL_EXPIRE_DAYS,
  MAIL_SAVE_VERSION,
  MAILS_PER_PAGE,
} from '../../shared/mail-types';
