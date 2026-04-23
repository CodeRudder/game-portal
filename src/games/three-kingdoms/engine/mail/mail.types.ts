/**
 * 邮件域 — 类型定义（从 shared 层重导出）
 *
 * v9.0 邮件系统全部类型
 * 唯一定义源已迁移至 shared/mail-types.ts，避免跨层引用。
 * engine 层通过重导出使用，保持向后兼容。
 *
 * 规则：只有 interface/type/const，零逻辑
 *
 * @module engine/mail/mail.types
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
