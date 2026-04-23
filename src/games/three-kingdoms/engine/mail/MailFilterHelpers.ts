/**
 * 邮件系统 — 过滤与查询辅助函数
 *
 * 从 MailSystem 中提取的纯函数工具。
 *
 * @module engine/mail/MailFilterHelpers
 */

import type { MailCategory, MailData, MailFilter } from './mail.types';

/** 按条件过滤邮件 */
export function filterMails(mails: Iterable<MailData>, filter?: MailFilter): MailData[] {
  const result: MailData[] = [];
  for (const mail of mails) {
    if (filter?.category && filter.category !== 'all' && mail.category !== filter.category) continue;
    if (filter?.status && mail.status !== filter.status) continue;
    if (filter?.hasAttachment && mail.attachments.length === 0) continue;
    result.push(mail);
  }
  return result;
}

/** 获取分类对应的默认保留时长（秒） */
export function getDefaultRetainSeconds(
  category: MailCategory,
  defaults: { system: number; reward: number; default_: number },
): number | null {
  switch (category) {
    case 'system': return defaults.system;
    case 'reward': return defaults.reward;
    default: return defaults.default_;
  }
}
