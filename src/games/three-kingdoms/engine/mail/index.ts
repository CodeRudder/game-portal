/**
 * 邮件域 — 统一导出
 *
 * @module engine/mail
 */

// 从 MailSystem.ts 导出（主接口）
export {
  MailSystem,
  CATEGORY_LABELS,
  STATUS_LABELS,
  MAILS_PER_PAGE,
} from './MailSystem';

// 从 MailPersistence.ts 导出
export {
  buildTemplateMail,
  buildSaveData,
  restoreSaveData,
  loadFromStorage,
  persistToStorage,
  clearStorage,
} from './MailPersistence';
export type {
  MailCategory as MailCategoryV2,
  MailStatus as MailStatusV2,
  MailAttachment as MailAttachmentV2,
  MailData as MailDataV2,
  MailSendRequest,
  MailFilter as MailFilterV2,
  BatchOperationResult,
  MailSaveData as MailSaveDataV2,
} from './MailSystem';

// 从 mail.types.ts 导出（扩展类型）
export { MailTemplateSystem } from './MailTemplateSystem';
export type {
  MailCategory,
  MailPriority,
  MailStatus,
  MailAttachment,
  MailData,
  MailFilter,
  ClaimResult,
  BatchClaimResult,
  BatchAction,
  BatchActionResult,
  MailTemplate,
  MailTemplateVars,
  MailSaveData,
} from './mail.types';
export {
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_PRIORITY_LABELS,
  MAILBOX_CAPACITY,
  DEFAULT_MAIL_EXPIRE_DAYS,
  MAIL_SAVE_VERSION,
} from './mail.types';
