/**
 * 邮件系统 — 邮件管理引擎（v9.0 深化）
 *
 * 职责：
 *   - 邮件面板：分类Tab（系统/战斗/社交/奖励）
 *   - 邮件状态管理：未读/已读未领/已读已领/已过期
 *   - 附件领取：单封+批量+一键已读
 *   - 批量操作：一键已读+批量领取+删除已读
 *   - 邮件发送与模板
 *   - 存档序列化
 *
 * 规则：纯逻辑引擎，不依赖 UI
 *
 * @module engine/mail/MailSystem
 */

import {
  buildTemplateMail,
  buildSaveData,
  restoreSaveData,
  loadFromStorage,
  persistToStorage,
  clearStorage,
} from './MailPersistence';

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/** 邮件分类 */
export type MailCategory = 'system' | 'battle' | 'social' | 'reward';

/** 邮件状态（四态） */
export type MailStatus = 'unread' | 'read_unclaimed' | 'read_claimed' | 'expired';

/** 附件 */
export interface MailAttachment {
  id: string;
  resourceType: string;
  amount: number;
  claimed: boolean;
}

/** 邮件数据 */
export interface MailData {
  id: string;
  category: MailCategory;
  title: string;
  content: string;
  sender: string;
  sendTime: number;
  expireTime: number | null;
  attachments: MailAttachment[];
  status: MailStatus;
  isRead: boolean;
}

/** 邮件发送请求 */
export interface MailSendRequest {
  category: MailCategory;
  title: string;
  content: string;
  sender: string;
  attachments?: Array<{ resourceType: string; amount: number }>;
  retainSeconds?: number | null;
}

/** 邮件筛选条件 */
export interface MailFilter {
  category?: MailCategory | 'all';
  status?: MailStatus;
  hasAttachment?: boolean;
}

/** 批量操作结果 */
export interface BatchOperationResult {
  count: number;
  claimedResources: Record<string, number>;
  successIds: string[];
  failures: Array<{ id: string; reason: string }>;
}

/** 邮件系统存档 */
export interface MailSaveData {
  mails: MailData[];
  nextId: number;
  version: number;
}

// ─────────────────────────────────────────────
// 2. 常量配置
// ─────────────────────────────────────────────

/** 默认邮件保留时长（7天） */
const DEFAULT_RETAIN_SECONDS = 7 * 24 * 3600;

/** 系统邮件保留时长（30天） */
const SYSTEM_RETAIN_SECONDS = 30 * 24 * 3600;

/** 奖励邮件保留时长（14天） */
const REWARD_RETAIN_SECONDS = 14 * 24 * 3600;

/** 每页邮件数量 */
export const MAILS_PER_PAGE = 20;

/** 分类标签 */
export const CATEGORY_LABELS: Record<MailCategory | 'all', string> = {
  all: '全部',
  system: '系统',
  battle: '战斗',
  social: '社交',
  reward: '奖励',
} as const;

/** 状态标签 */
export const STATUS_LABELS: Record<MailStatus, string> = {
  unread: '未读',
  read_unclaimed: '已读未领',
  read_claimed: '已读已领',
  expired: '已过期',
} as const;

// ─────────────────────────────────────────────
// 3. 邮件系统实现
// ─────────────────────────────────────────────

/**
 * 邮件系统
 *
 * 管理邮件的全生命周期：创建→阅读→领取→过期
 */
export class MailSystem {
  private mails: Map<string, MailData> = new Map();
  private nextId: number = 1;
  private storage: Storage | null = null;

  constructor(storage?: Storage) {
    this.storage = storage ?? null;
    this.initFromStorage();
  }

  /** 从Storage初始化 */
  private initFromStorage(): void {
    if (!this.storage) return;
    const data = loadFromStorage(this.storage);
    if (data) {
      const restored = restoreSaveData(data);
      if (restored) {
        this.mails = restored.mails;
        this.nextId = restored.nextId;
      }
    }
  }

  /** 持久化当前状态 */
  private persist(): void {
    if (!this.storage) return;
    persistToStorage(this.storage, this.getSaveData());
  }

  // ── 邮件创建 ──

  /** 发送邮件 */
  sendMail(request: MailSendRequest): MailData {
    const id = `mail_${this.nextId++}`;
    const now = Date.now();

    let expireTime: number | null = null;
    if (request.retainSeconds !== null) {
      const retainSeconds = request.retainSeconds ?? this.getDefaultRetainSeconds(request.category);
      if (retainSeconds !== null) {
        expireTime = now + retainSeconds * 1000;
      }
    }

    const attachments: MailAttachment[] = (request.attachments ?? []).map((att, idx) => ({
      id: `${id}_att_${idx}`,
      resourceType: att.resourceType,
      amount: att.amount,
      claimed: false,
    }));

    const mail: MailData = {
      id, category: request.category, title: request.title,
      content: request.content, sender: request.sender,
      sendTime: now, expireTime, attachments,
      status: 'unread', isRead: false,
    };

    this.mails.set(id, mail);
    this.persist();
    return mail;
  }

  /** 批量发送邮件 */
  sendBatch(requests: MailSendRequest[]): MailData[] {
    return requests.map(req => this.sendMail(req));
  }

  /** 添加邮件（直接插入） */
  addMail(mail: MailData): boolean {
    this.mails.set(mail.id, { ...mail });
    this.persist();
    return true;
  }

  // ── 邮件读取 ──

  /** 标记邮件为已读 */
  markRead(mailId: string): boolean {
    const mail = this.mails.get(mailId);
    if (!mail || mail.status === 'expired') return false;

    mail.isRead = true;
    if (mail.status === 'unread') {
      mail.status = (mail.attachments.length > 0 && mail.attachments.some(a => !a.claimed))
        ? 'read_unclaimed' : 'read_claimed';
    }
    this.persist();
    return true;
  }

  /** 全部标记已读 */
  markAllRead(filter?: MailFilter): number {
    let count = 0;
    for (const mail of this.getFilteredMails(filter)) {
      if (!mail.isRead && mail.status !== 'expired') {
        this.markRead(mail.id);
        count++;
      }
    }
    return count;
  }

  // ── 附件领取 ──

  /** 领取单封邮件附件 */
  claimAttachments(mailId: string): Record<string, number> {
    const mail = this.mails.get(mailId);
    if (!mail || mail.status === 'expired') return {};

    const claimed: Record<string, number> = {};
    for (const attachment of mail.attachments) {
      if (!attachment.claimed) {
        attachment.claimed = true;
        claimed[attachment.resourceType] = (claimed[attachment.resourceType] ?? 0) + attachment.amount;
      }
    }

    if (Object.keys(claimed).length > 0) {
      mail.status = 'read_claimed';
      mail.isRead = true;
    }
    this.persist();
    return claimed;
  }

  /** 批量领取附件 */
  claimAllAttachments(filter?: MailFilter): BatchOperationResult {
    const result: BatchOperationResult = { count: 0, claimedResources: {}, successIds: [], failures: [] };
    for (const mail of this.getFilteredMails(filter)) {
      if (mail.status === 'expired') continue;
      if (!mail.attachments.some(a => !a.claimed)) continue;
      const claimed = this.claimAttachments(mail.id);
      if (Object.keys(claimed).length > 0) {
        result.count++;
        result.successIds.push(mail.id);
        for (const [type, amount] of Object.entries(claimed)) {
          result.claimedResources[type] = (result.claimedResources[type] ?? 0) + amount;
        }
      }
    }
    return result;
  }

  // ── 邮件查询 ──

  /** 获取邮件列表（分页） */
  getMails(filter?: MailFilter, page: number = 1): MailData[] {
    const filtered = this.getFilteredMails(filter);
    filtered.sort((a, b) => {
      const timeDiff = b.sendTime - a.sendTime;
      if (timeDiff !== 0) return timeDiff;
      const aNum = parseInt(a.id.replace('mail_', ''), 10);
      const bNum = parseInt(b.id.replace('mail_', ''), 10);
      return bNum - aNum;
    });
    const start = (page - 1) * MAILS_PER_PAGE;
    return filtered.slice(start, start + MAILS_PER_PAGE);
  }

  /** 获取邮件总数 */
  getMailCount(filter?: MailFilter): number {
    return this.getFilteredMails(filter).length;
  }

  /** 获取未读邮件数 */
  getUnreadCount(category?: MailCategory): number {
    let count = 0;
    for (const mail of this.mails.values()) {
      if (mail.status === 'expired') continue;
      if (category && mail.category !== category) continue;
      if (!mail.isRead) count++;
    }
    return count;
  }

  /** 获取单封邮件 */
  getMail(mailId: string): MailData | undefined {
    return this.mails.get(mailId);
  }

  // ── 邮件删除 ──

  /** 删除邮件（只能删除已读已领或已过期） */
  deleteMail(mailId: string): boolean {
    const mail = this.mails.get(mailId);
    if (!mail) return false;
    if (mail.attachments.some(a => !a.claimed) && mail.status !== 'expired') return false;
    this.mails.delete(mailId);
    this.persist();
    return true;
  }

  /** 删除所有已读已领的邮件 */
  deleteReadClaimed(): number {
    let count = 0;
    for (const [id, mail] of this.mails) {
      if (mail.status === 'read_claimed' || mail.status === 'expired') {
        this.mails.delete(id);
        count++;
      }
    }
    if (count > 0) this.persist();
    return count;
  }

  // ── 过期处理 ──

  /** 处理过期邮件 */
  processExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const mail of this.mails.values()) {
      if (mail.status === 'expired') continue;
      if (mail.expireTime !== null && mail.expireTime <= now) {
        mail.status = 'expired';
        count++;
      }
    }
    if (count > 0) this.persist();
    return count;
  }

  // ── 分类查询 ──

  /** 获取已有邮件的分类 */
  getCategories(): MailCategory[] {
    const cats = new Set<MailCategory>();
    for (const mail of this.mails.values()) cats.add(mail.category);
    return Array.from(cats);
  }

  /** 按分类获取邮件 */
  getByCategory(category: MailCategory): MailData[] {
    return this.getFilteredMails({ category }).sort((a, b) => b.sendTime - a.sendTime);
  }

  /** 获取各分类未读数 */
  getUnreadCountByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const mail of this.mails.values()) {
      if (mail.status === 'unread') {
        counts[mail.category] = (counts[mail.category] ?? 0) + 1;
      }
    }
    return counts;
  }

  /** 获取全部邮件（按时间倒序） */
  getAllMails(): MailData[] {
    return Array.from(this.mails.values()).sort((a, b) => b.sendTime - a.sendTime);
  }

  /** 按条件查询邮件 */
  query(filter: { category?: string; status?: string; starredOnly?: boolean; hasAttachments?: boolean }): MailData[] {
    return this.getAllMails().filter(mail => {
      if (filter.category && mail.category !== filter.category) return false;
      if (filter.status && mail.status !== filter.status) return false;
      if (filter.hasAttachments && mail.attachments.length === 0) return false;
      return true;
    });
  }

  /** 标记为已读（别名） */
  markAsRead(mailId: string): boolean { return this.markRead(mailId); }

  /** 设置星标（预留接口） */
  setStarred(_mailId: string, _starred: boolean): boolean { return true; }

  // ── 模板邮件发送 ──

  /** 使用模板发送邮件 */
  sendTemplateMail(
    templateId: string,
    vars: Record<string, string | number> = {},
    attachments?: Array<{ resourceType: string; amount: number }>,
  ): MailData | null {
    const tpl = buildTemplateMail(templateId, vars);
    if (!tpl) return null;
    return this.sendMail({ category: tpl.category, title: tpl.title, content: tpl.content, sender: tpl.sender, attachments });
  }

  /** 发送自定义邮件 */
  sendCustomMail(
    category: MailCategory, title: string, content: string, sender: string,
    options?: { attachments?: Array<{ resourceType: string; amount: number }>; retainSeconds?: number },
  ): MailData | null {
    return this.sendMail({ category, title, content, sender, attachments: options?.attachments, retainSeconds: options?.retainSeconds });
  }

  // ── 存档 ──

  /** 获取存档数据 */
  getSaveData(): MailSaveData {
    return buildSaveData(this.mails, this.nextId);
  }

  /** 从存档恢复 */
  loadFromSaveData(data: MailSaveData): void {
    const restored = restoreSaveData(data);
    if (!restored) return;
    this.mails = restored.mails;
    this.nextId = restored.nextId;
    this.persist();
  }

  /** 序列化（别名） */
  serialize(): MailSaveData { return this.getSaveData(); }

  /** 反序列化（别名） */
  deserialize(data: MailSaveData): void { this.loadFromSaveData(data); }

  /** 重置邮件系统 */
  reset(): void {
    this.mails.clear();
    this.nextId = 1;
    if (this.storage) clearStorage(this.storage);
  }

  // ── 私有方法 ──

  private getFilteredMails(filter?: MailFilter): MailData[] {
    const result: MailData[] = [];
    for (const mail of this.mails.values()) {
      if (filter?.category && filter.category !== 'all' && mail.category !== filter.category) continue;
      if (filter?.status && mail.status !== filter.status) continue;
      if (filter?.hasAttachment && mail.attachments.length === 0) continue;
      result.push(mail);
    }
    return result;
  }

  private getDefaultRetainSeconds(category: MailCategory): number | null {
    switch (category) {
      case 'system': return SYSTEM_RETAIN_SECONDS;
      case 'reward': return REWARD_RETAIN_SECONDS;
      default: return DEFAULT_RETAIN_SECONDS;
    }
  }
}
