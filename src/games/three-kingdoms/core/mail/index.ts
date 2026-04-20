/**
 * 邮件域 — 核心层统一导出
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
  BatchOperationResult,
  MailSaveData,
  MailTemplate,
  MailTemplateVars,
} from './mail.types';
export {
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAILS_PER_PAGE,
  MAIL_SAVE_VERSION,
} from './mail.types';
