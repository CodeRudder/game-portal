/**
 * 邮件域 — 统一导出
 *
 * 所有类型均从 mail.types.ts（单一数据源）导出。
 * MailSystem.ts 和 MailTemplateSystem.ts 的类型已统一。
 *
 * @module engine/mail
 */

// 从 MailSystem.ts 导出（主接口）
export { MailSystem } from './MailSystem';

// 从 MailPersistence.ts 导出
export {
  buildTemplateMail,
  buildSaveData,
  restoreSaveData,
  loadFromStorage,
  persistToStorage,
  clearStorage,
} from './MailPersistence';

// 从 MailTemplateSystem.ts 导出
export { MailTemplateSystem } from './MailTemplateSystem';

// ── 统一类型导出（单一数据源: mail.types.ts） ──
export type {
  MailCategory,
  MailPriority,
  MailStatus,
  MailAttachment,
  MailData,
  MailSendRequest,
  MailFilter,
  ClaimResult,
  BatchClaimResult,
  BatchAction,
  BatchActionResult,
  BatchOperationResult,
  MailTemplate,
  MailTemplateVars,
  MailSaveData,
} from './mail.types';

// ── 常量导出 ──
export {
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_PRIORITY_LABELS,
  MAILBOX_CAPACITY,
  DEFAULT_MAIL_EXPIRE_DAYS,
  MAIL_SAVE_VERSION,
  MAILS_PER_PAGE,
} from './mail.types';

// ── 向后兼容别名（旧名 → 新名） ──
export type {
  MailCategory as MailCategoryV2,
  MailStatus as MailStatusV2,
  MailAttachment as MailAttachmentV2,
  MailData as MailDataV2,
  MailFilter as MailFilterV2,
  MailSaveData as MailSaveDataV2,
} from './mail.types';
