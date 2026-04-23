/**
 * 邮件域 — 核心层统一导出
 *
 * 类型定义统一从 engine/mail/mail.types.ts 重导出，
 * core/mail/mail.types.ts 作为桥接层。
 *
 * @module core/mail
 */

export type {
  MailCategory,
  MailPriority,
  MailStatus,
  MailAttachment,
  MailData,
  MailFilter,
  MailSendRequest,
  ClaimResult,
  BatchClaimResult,
  BatchAction,
  BatchActionResult,
  BatchOperationResult,
  MailSaveData,
  MailTemplate,
  MailTemplateVars,
} from './mail.types';

export {
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_PRIORITY_LABELS,
  MAILBOX_CAPACITY,
  DEFAULT_MAIL_EXPIRE_DAYS,
  MAIL_SAVE_VERSION,
  MAILS_PER_PAGE,
} from './mail.types';
