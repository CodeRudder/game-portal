/**
 * 引擎层 — v9.0 离线收益 + 邮件系统导出
 *
 * 从 index.ts 拆分，保持 index.ts ≤500 行。
 *
 * @module engine/exports-v9
 */

// ──────────────────────────────────────────────
// v9.0 离线收益深化
// ──────────────────────────────────────────────

// 离线收益域
export { OfflineRewardSystem } from './offline/OfflineRewardSystem';
export { OfflineEstimateSystem } from './offline/OfflineEstimateSystem';
export type {
  EstimatePoint,
  EstimateResult,
} from './offline/OfflineEstimateSystem';
export type {
  DecayTier,
  OfflineSnapshot,
  TierDetail,
  DoubleSource,
  DoubleRequest,
  DoubleResult,
  ReturnPanelData,
  OfflineBoostItem,
  BoostUseResult,
  OfflineTradeEvent,
  OfflineTradeSummary,
  VipOfflineBonus,
  SystemEfficiencyModifier,
  OverflowStrategy,
  OverflowRule,
  ResourceProtection,
  WarehouseExpansion,
  ExpansionResult,
  OfflineRewardResultV9,
  OfflineSaveData,
} from './offline/offline.types';
export {
  DECAY_TIERS,
  MAX_OFFLINE_HOURS,
  MAX_OFFLINE_SECONDS,
  AD_DOUBLE_MULTIPLIER,
  ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES,
  SYSTEM_EFFICIENCY_MODIFIERS,
  OVERFLOW_RULES,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_TRADE_EFFICIENCY,
  MAX_OFFLINE_TRADES,
  OFFLINE_TRADE_DURATION,
} from './offline/offline-config';

// 邮件域
export { MailSystem } from './mail/MailSystem';
export { MailTemplateSystem } from './mail/MailTemplateSystem';
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
} from './mail/mail.types';
export {
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_PRIORITY_LABELS,
  MAILBOX_CAPACITY,
  DEFAULT_MAIL_EXPIRE_DAYS,
  MAIL_SAVE_VERSION,
  MAILS_PER_PAGE,
} from './mail/mail.types';
