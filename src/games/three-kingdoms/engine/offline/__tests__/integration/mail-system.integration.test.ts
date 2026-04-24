/**
 * v9.0 邮件系统集成测试
 *
 * 覆盖:
 *   §5.1  邮件分类Tab（系统/战斗/社交/奖励）
 *   §5.2  状态流转（未读→已读未领→已读已领→过期）
 *   §5.3  附件领取（单封+批量）
 *   §5.4  批量操作（一键已读+批量领取+删除已读）
 *   §5.6  过期处理
 *   §5.7  模板触发
 *
 * it.skip:
 *   §5.5  容量管理（P0系统缺失）
 *   §5.8  离线收益邮件特殊规则（P0系统缺失）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MailSystem,
  MailTemplateSystem,
  buildTemplateMail,
  buildSaveData,
  restoreSaveData,
  clearStorage,
} from '../../../mail';
import {
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAILS_PER_PAGE,
  MAIL_SAVE_VERSION,
  MAILBOX_CAPACITY,
} from '../../../mail/mail.types';
import type {
  MailCategory,
  MailStatus,
  MailData,
  MailSendRequest,
  MailFilter,
  MailSaveData,
} from '../../../mail/mail.types';
import {
  DEFAULT_RETAIN_SECONDS,
  SYSTEM_RETAIN_SECONDS,
  REWARD_RETAIN_SECONDS,
} from '../../../mail/MailConstants';

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

/** 创建简单邮件请求 */
function makeRequest(overrides: Partial<MailSendRequest> = {}): MailSendRequest {
  return {
    category: 'system',
    title: '测试邮件',
    content: '测试内容',
    sender: '系统',
    ...overrides,
  };
}

/** 创建带附件的邮件请求 */
function makeRewardRequest(
  resources: Array<{ resourceType: string; amount: number }> = [{ resourceType: 'grain', amount: 100 }],
  overrides: Partial<MailSendRequest> = {},
): MailSendRequest {
  return makeRequest({ category: 'reward', title: '奖励邮件', attachments: resources, ...overrides });
}

/** 推进时间（毫秒） */
function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}

/** 创建 Mock Storage */
function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

// ═════════════════════════════════════════════
// §5.1 邮件分类Tab
// ═════════════════════════════════════════════

describe('§5.1 邮件分类Tab', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem();
    mailSystem.reset();
  });

  it('§5.1.1 系统邮件分类', () => {
    const mail = mailSystem.sendMail(makeRequest({ category: 'system', title: '系统通知' }));
    expect(mail.category).toBe('system');
    expect(mail.title).toBe('系统通知');
  });

  it('§5.1.2 战斗邮件分类', () => {
    const mail = mailSystem.sendMail(makeRequest({ category: 'battle', title: '战报' }));
    expect(mail.category).toBe('battle');
  });

  it('§5.1.3 社交邮件分类', () => {
    const mail = mailSystem.sendMail(makeRequest({ category: 'social', title: '好友消息' }));
    expect(mail.category).toBe('social');
  });

  it('§5.1.4 奖励邮件分类', () => {
    const mail = mailSystem.sendMail(makeRequest({ category: 'reward', title: '奖励' }));
    expect(mail.category).toBe('reward');
  });

  it('§5.1.5 getCategories返回已有分类', () => {
    mailSystem.sendMail(makeRequest({ category: 'system' }));
    mailSystem.sendMail(makeRequest({ category: 'reward' }));
    mailSystem.sendMail(makeRequest({ category: 'social' }));

    const cats = mailSystem.getCategories();
    expect(cats).toContain('system');
    expect(cats).toContain('reward');
    expect(cats).toContain('social');
    expect(cats.length).toBe(3);
  });

  it('§5.1.6 按分类查询邮件', () => {
    mailSystem.sendMail(makeRequest({ category: 'system', title: 'S1' }));
    mailSystem.sendMail(makeRequest({ category: 'system', title: 'S2' }));
    mailSystem.sendMail(makeRequest({ category: 'reward', title: 'R1' }));

    const systemMails = mailSystem.getByCategory('system');
    expect(systemMails.length).toBe(2);
    expect(systemMails.every(m => m.category === 'system')).toBe(true);
  });

  it('§5.1.7 各分类未读计数', () => {
    mailSystem.sendMail(makeRequest({ category: 'system' }));
    mailSystem.sendMail(makeRequest({ category: 'system' }));
    mailSystem.sendMail(makeRequest({ category: 'reward' }));

    const counts = mailSystem.getUnreadCountByCategory();
    expect(counts['system']).toBe(2);
    expect(counts['reward']).toBe(1);
  });

  it('§5.1.8 分类Tab过滤查询', () => {
    mailSystem.sendMail(makeRequest({ category: 'system' }));
    mailSystem.sendMail(makeRequest({ category: 'reward' }));
    mailSystem.sendMail(makeRequest({ category: 'social' }));

    const filter: MailFilter = { category: 'reward' };
    const rewardMails = mailSystem.getMails(filter);
    expect(rewardMails.length).toBe(1);
    expect(rewardMails[0].category).toBe('reward');
  });
});

// ═════════════════════════════════════════════
// §5.2 状态流转
// ═════════════════════════════════════════════

describe('§5.2 状态流转（未读→已读未领→已读已领→过期）', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    mailSystem = new MailSystem();
    mailSystem.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('§5.2.1 新邮件初始状态为未读', () => {
    const mail = mailSystem.sendMail(makeRequest());
    expect(mail.status).toBe('unread');
    expect(mail.isRead).toBe(false);
  });

  it('§5.2.2 无附件邮件标记已读后→已读已领', () => {
    const mail = mailSystem.sendMail(makeRequest()); // 无附件
    const result = mailSystem.markRead(mail.id);
    expect(result).toBe(true);

    const updated = mailSystem.getMail(mail.id)!;
    expect(updated.status).toBe('read_claimed');
    expect(updated.isRead).toBe(true);
  });

  it('§5.2.3 有附件邮件标记已读后→已读未领', () => {
    const mail = mailSystem.sendMail(makeRewardRequest());
    mailSystem.markRead(mail.id);

    const updated = mailSystem.getMail(mail.id)!;
    expect(updated.status).toBe('read_unclaimed');
    expect(updated.isRead).toBe(true);
  });

  it('§5.2.4 已读未领→领取附件后→已读已领', () => {
    const mail = mailSystem.sendMail(makeRewardRequest());
    mailSystem.markRead(mail.id);
    expect(mailSystem.getMail(mail.id)!.status).toBe('read_unclaimed');

    mailSystem.claimAttachments(mail.id);
    expect(mailSystem.getMail(mail.id)!.status).toBe('read_claimed');
  });

  it('§5.2.5 直接领取附件（未读→已读已领）', () => {
    const mail = mailSystem.sendMail(makeRewardRequest());
    expect(mail.status).toBe('unread');

    const claimed = mailSystem.claimAttachments(mail.id);
    const updated = mailSystem.getMail(mail.id)!;
    expect(updated.status).toBe('read_claimed');
    expect(updated.isRead).toBe(true);
    expect(claimed['grain']).toBe(100);
  });

  it('§5.2.6 已过期邮件不可标记已读', () => {
    const mail = mailSystem.sendMail(makeRequest({ retainSeconds: 1 }));
    advanceTime(2000);
    mailSystem.processExpired();

    const result = mailSystem.markRead(mail.id);
    expect(result).toBe(false);
  });

  it('§5.2.7 已过期邮件不可领取附件', () => {
    const mail = mailSystem.sendMail(makeRewardRequest([{ resourceType: 'gold', amount: 500 }], { retainSeconds: 1 }));
    advanceTime(2000);
    mailSystem.processExpired();

    const claimed = mailSystem.claimAttachments(mail.id);
    expect(Object.keys(claimed).length).toBe(0);
  });

  it('§5.2.8 完整生命周期：未读→已读未领→已读已领', () => {
    const mail = mailSystem.sendMail(makeRewardRequest([
      { resourceType: 'grain', amount: 200 },
      { resourceType: 'gold', amount: 100 },
    ]));

    // 未读
    expect(mail.status).toBe('unread');
    expect(mail.isRead).toBe(false);

    // 标记已读 → 已读未领
    mailSystem.markRead(mail.id);
    expect(mailSystem.getMail(mail.id)!.status).toBe('read_unclaimed');

    // 领取附件 → 已读已领
    const claimed = mailSystem.claimAttachments(mail.id);
    expect(claimed['grain']).toBe(200);
    expect(claimed['gold']).toBe(100);
    expect(mailSystem.getMail(mail.id)!.status).toBe('read_claimed');
  });
});

// ═════════════════════════════════════════════
// §5.3 附件领取
// ═════════════════════════════════════════════

describe('§5.3 附件领取', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem();
    mailSystem.reset();
  });

  it('§5.3.1 领取单封单资源附件', () => {
    const mail = mailSystem.sendMail(makeRewardRequest([{ resourceType: 'grain', amount: 500 }]));
    const claimed = mailSystem.claimAttachments(mail.id);

    expect(claimed['grain']).toBe(500);
    const updated = mailSystem.getMail(mail.id)!;
    expect(updated.attachments[0].claimed).toBe(true);
  });

  it('§5.3.2 领取单封多资源附件', () => {
    const mail = mailSystem.sendMail(makeRewardRequest([
      { resourceType: 'grain', amount: 200 },
      { resourceType: 'gold', amount: 300 },
      { resourceType: 'troops', amount: 50 },
    ]));
    const claimed = mailSystem.claimAttachments(mail.id);

    expect(claimed['grain']).toBe(200);
    expect(claimed['gold']).toBe(300);
    expect(claimed['troops']).toBe(50);
  });

  it('§5.3.3 重复领取返回空结果', () => {
    const mail = mailSystem.sendMail(makeRewardRequest());
    mailSystem.claimAttachments(mail.id);
    const claimed = mailSystem.claimAttachments(mail.id);

    expect(Object.keys(claimed).length).toBe(0);
  });

  it('§5.3.4 无附件邮件领取返回空', () => {
    const mail = mailSystem.sendMail(makeRequest()); // 无附件
    const claimed = mailSystem.claimAttachments(mail.id);
    expect(Object.keys(claimed).length).toBe(0);
  });

  it('§5.3.5 批量领取附件', () => {
    mailSystem.sendMail(makeRewardRequest([{ resourceType: 'grain', amount: 100 }]));
    mailSystem.sendMail(makeRewardRequest([{ resourceType: 'gold', amount: 200 }]));
    mailSystem.sendMail(makeRewardRequest([{ resourceType: 'troops', amount: 50 }]));

    const result = mailSystem.claimAllAttachments();
    expect(result.count).toBe(3);
    expect(result.claimedResources['grain']).toBe(100);
    expect(result.claimedResources['gold']).toBe(200);
    expect(result.claimedResources['troops']).toBe(50);
    expect(result.successIds.length).toBe(3);
  });

  it('§5.3.6 批量领取按分类过滤', () => {
    mailSystem.sendMail(makeRewardRequest([{ resourceType: 'grain', amount: 100 }], { category: 'reward' }));
    mailSystem.sendMail(makeRewardRequest([{ resourceType: 'gold', amount: 200 }], { category: 'system' }));

    const result = mailSystem.claimAllAttachments({ category: 'reward' });
    expect(result.count).toBe(1);
    expect(result.claimedResources['grain']).toBe(100);
    expect(result.claimedResources['gold']).toBeUndefined();
  });

  it('§5.3.7 批量领取跳过已领取邮件', () => {
    const m1 = mailSystem.sendMail(makeRewardRequest([{ resourceType: 'grain', amount: 100 }]));
    mailSystem.sendMail(makeRewardRequest([{ resourceType: 'gold', amount: 200 }]));

    // 先领取第一封
    mailSystem.claimAttachments(m1.id);

    const result = mailSystem.claimAllAttachments();
    expect(result.count).toBe(1);
    expect(result.claimedResources['gold']).toBe(200);
  });
});

// ═════════════════════════════════════════════
// §5.4 批量操作
// ═════════════════════════════════════════════

describe('§5.4 批量操作', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    mailSystem = new MailSystem();
    mailSystem.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('§5.4.1 一键全部已读', () => {
    mailSystem.sendMail(makeRequest({ title: 'A' }));
    mailSystem.sendMail(makeRequest({ title: 'B' }));
    mailSystem.sendMail(makeRequest({ title: 'C' }));

    const count = mailSystem.markAllRead();
    expect(count).toBe(3);
    expect(mailSystem.getUnreadCount()).toBe(0);
  });

  it('§5.4.2 一键已读按分类过滤', () => {
    mailSystem.sendMail(makeRequest({ category: 'system', title: 'S1' }));
    mailSystem.sendMail(makeRequest({ category: 'system', title: 'S2' }));
    mailSystem.sendMail(makeRequest({ category: 'reward', title: 'R1' }));

    const count = mailSystem.markAllRead({ category: 'system' });
    expect(count).toBe(2);
    expect(mailSystem.getUnreadCount('reward')).toBe(1);
  });

  it('§5.4.3 一键已读跳过已读邮件', () => {
    const m1 = mailSystem.sendMail(makeRequest());
    mailSystem.sendMail(makeRequest());

    mailSystem.markRead(m1.id);
    const count = mailSystem.markAllRead();
    expect(count).toBe(1);
  });

  it('§5.4.4 删除已读已领邮件', () => {
    const m1 = mailSystem.sendMail(makeRequest({ title: '已读' }));
    mailSystem.markRead(m1.id);

    const result = mailSystem.deleteMail(m1.id);
    expect(result).toBe(true);
    expect(mailSystem.getMail(m1.id)).toBeUndefined();
  });

  it('§5.4.5 不可删除未领取附件的邮件', () => {
    const mail = mailSystem.sendMail(makeRewardRequest());
    mailSystem.markRead(mail.id); // → read_unclaimed

    const result = mailSystem.deleteMail(mail.id);
    expect(result).toBe(false);
    expect(mailSystem.getMail(mail.id)).toBeDefined();
  });

  it('§5.4.6 批量删除已读已领邮件', () => {
    const m1 = mailSystem.sendMail(makeRequest());
    const m2 = mailSystem.sendMail(makeRequest());
    const m3 = mailSystem.sendMail(makeRewardRequest());

    mailSystem.markRead(m1.id);
    mailSystem.markRead(m2.id);
    // m3 未读

    const deleted = mailSystem.deleteReadClaimed();
    expect(deleted).toBe(2);
    expect(mailSystem.getMail(m3.id)).toBeDefined();
  });

  it('§5.4.7 批量删除包含已过期邮件', () => {
    const m1 = mailSystem.sendMail(makeRequest({ retainSeconds: 1 }));
    mailSystem.sendMail(makeRequest());

    advanceTime(2000);
    mailSystem.processExpired();

    const deleted = mailSystem.deleteReadClaimed();
    expect(deleted).toBe(1); // 过期的也被删除
  });

  it('§5.4.8 批量操作后邮件计数正确', () => {
    // 发送5封邮件
    for (let i = 0; i < 5; i++) {
      mailSystem.sendMail(makeRequest());
    }
    expect(mailSystem.getMailCount()).toBe(5);

    // 全部已读
    mailSystem.markAllRead();
    expect(mailSystem.getUnreadCount()).toBe(0);

    // 批量删除已读
    const deleted = mailSystem.deleteReadClaimed();
    expect(deleted).toBe(5);
    expect(mailSystem.getMailCount()).toBe(0);
  });
});

// ═════════════════════════════════════════════
// §5.5 容量管理（P0系统缺失）
// ═════════════════════════════════════════════

describe.skip('§5.5 容量管理（P0系统缺失）', () => {
  it('§5.5.1 邮箱容量上限为100', () => {
    // 依赖 MailboxCapacityEnforcer（P0未实现）
  });

  it('§5.5.2 容量满时新邮件挤掉最旧已读已领邮件', () => {
    // 依赖容量淘汰策略（P0未实现）
  });

  it('§5.5.3 容量满时不可挤掉未读邮件', () => {
    // 依赖容量淘汰策略（P0未实现）
  });
});

// ═════════════════════════════════════════════
// §5.6 过期处理
// ═════════════════════════════════════════════

describe('§5.6 过期处理', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    mailSystem = new MailSystem();
    mailSystem.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('§5.6.1 邮件到期后processExpired标记为过期', () => {
    const mail = mailSystem.sendMail(makeRequest({ retainSeconds: 1 }));
    advanceTime(1500);
    const count = mailSystem.processExpired();

    expect(count).toBe(1);
    expect(mailSystem.getMail(mail.id)!.status).toBe('expired');
  });

  it('§5.6.2 未到期邮件不受影响', () => {
    const mail = mailSystem.sendMail(makeRequest({ retainSeconds: 3600 }));
    advanceTime(1000);
    const count = mailSystem.processExpired();

    expect(count).toBe(0);
    expect(mailSystem.getMail(mail.id)!.status).toBe('unread');
  });

  it('§5.6.3 系统邮件30天过期', () => {
    const mail = mailSystem.sendMail(makeRequest({ category: 'system' }));
    // 系统邮件默认30天
    const expectedExpire = mail.sendTime + SYSTEM_RETAIN_SECONDS * 1000;
    expect(mail.expireTime).toBe(expectedExpire);
  });

  it('§5.6.4 奖励邮件14天过期', () => {
    const mail = mailSystem.sendMail(makeRewardRequest(undefined, { category: 'reward' }));
    const expectedExpire = mail.sendTime + REWARD_RETAIN_SECONDS * 1000;
    expect(mail.expireTime).toBe(expectedExpire);
  });

  it('§5.6.5 默认邮件7天过期', () => {
    const mail = mailSystem.sendMail(makeRequest({ category: 'social' }));
    const expectedExpire = mail.sendTime + DEFAULT_RETAIN_SECONDS * 1000;
    expect(mail.expireTime).toBe(expectedExpire);
  });

  it('§5.6.6 自定义保留时长', () => {
    const mail = mailSystem.sendMail(makeRequest({ retainSeconds: 600 }));
    const expectedExpire = mail.sendTime + 600 * 1000;
    expect(mail.expireTime).toBe(expectedExpire);
  });

  it('§5.6.7 retainSeconds=null永不过期', () => {
    const mail = mailSystem.sendMail(makeRequest({ retainSeconds: null }));
    expect(mail.expireTime).toBeNull();
  });

  it('§5.6.8 批量过期处理', () => {
    mailSystem.sendMail(makeRequest({ retainSeconds: 1, title: 'A' }));
    mailSystem.sendMail(makeRequest({ retainSeconds: 1, title: 'B' }));
    mailSystem.sendMail(makeRequest({ retainSeconds: 3600, title: 'C' }));

    advanceTime(2000);
    const count = mailSystem.processExpired();
    expect(count).toBe(2);
  });

  it('§5.6.9 已过期邮件不重复处理', () => {
    const mail = mailSystem.sendMail(makeRequest({ retainSeconds: 1 }));
    advanceTime(2000);
    mailSystem.processExpired();

    const count = mailSystem.processExpired();
    expect(count).toBe(0);
  });

  it('§5.6.10 过期邮件附件不可领取', () => {
    const mail = mailSystem.sendMail(makeRewardRequest([{ resourceType: 'gold', amount: 999 }], { retainSeconds: 1 }));
    advanceTime(2000);
    mailSystem.processExpired();

    const claimed = mailSystem.claimAttachments(mail.id);
    expect(Object.keys(claimed).length).toBe(0);
  });
});

// ═════════════════════════════════════════════
// §5.7 模板触发
// ═════════════════════════════════════════════

describe('§5.7 模板触发', () => {
  let mailSystem: MailSystem;
  let templateSystem: MailTemplateSystem;

  beforeEach(() => {
    mailSystem = new MailSystem();
    mailSystem.reset();
    templateSystem = new MailTemplateSystem();
    templateSystem.reset();
  });

  it('§5.7.1 离线收益模板生成', () => {
    const result = buildTemplateMail('offline_reward', { hours: 5, grain: 1000, gold: 500, troops: 200, mandate: 50 });
    expect(result).not.toBeNull();
    expect(result!.category).toBe('reward');
    expect(result!.title).toBe('离线收益报告');
    expect(result!.content).toContain('5');
    expect(result!.content).toContain('1000');
    expect(result!.sender).toBe('系统');
  });

  it('§5.7.2 建筑完成模板生成', () => {
    const result = buildTemplateMail('building_complete', { buildingName: '兵营' });
    expect(result).not.toBeNull();
    expect(result!.category).toBe('system');
    expect(result!.title).toBe('建筑升级完成');
    expect(result!.content).toContain('兵营');
  });

  it('§5.7.3 科技完成模板生成', () => {
    const result = buildTemplateMail('tech_complete', { techName: '冶铁术' });
    expect(result).not.toBeNull();
    expect(result!.category).toBe('system');
    expect(result!.content).toContain('冶铁术');
  });

  it('§5.7.4 远征归来模板生成', () => {
    const result = buildTemplateMail('expedition_return', {});
    expect(result).not.toBeNull();
    expect(result!.category).toBe('battle');
    expect(result!.title).toBe('远征归来');
  });

  it('§5.7.5 不存在的模板返回null', () => {
    const result = buildTemplateMail('nonexistent_template');
    expect(result).toBeNull();
  });

  it('§5.7.6 MailSystem.sendTemplateMail发送模板邮件', () => {
    const mail = mailSystem.sendTemplateMail('offline_reward', { hours: 3, grain: 500, gold: 200, troops: 100, mandate: 30 });
    expect(mail).not.toBeNull();
    expect(mail!.category).toBe('reward');
    expect(mail!.title).toBe('离线收益报告');
    expect(mail!.status).toBe('unread');
  });

  it('§5.7.7 MailSystem.sendTemplateMail带附件', () => {
    const mail = mailSystem.sendTemplateMail('offline_reward', { hours: 2 }, [
      { resourceType: 'grain', amount: 300 },
    ]);
    expect(mail).not.toBeNull();
    expect(mail!.attachments.length).toBe(1);
    expect(mail!.attachments[0].resourceType).toBe('grain');
    expect(mail!.attachments[0].amount).toBe(300);
  });

  it('§5.7.8 MailTemplateSystem.createFromTemplate变量插值', () => {
    const mail = templateSystem.createFromTemplate('combat_report', {
      result: '大胜',
      battleType: '攻城战',
      ourLosses: 100,
      enemyLosses: 500,
      detail: '缴获大量物资',
    });
    expect(mail.title).toBe('战报：大胜');
    expect(mail.content).toContain('攻城战');
    expect(mail.content).toContain('100');
    expect(mail.content).toContain('500');
  });

  it('§5.7.9 MailTemplateSystem不存在的模板抛出异常', () => {
    expect(() => templateSystem.createFromTemplate('no_such_template')).toThrow('邮件模板不存在');
  });

  it('§5.7.10 MailTemplateSystem自定义模板注册', () => {
    templateSystem.registerTemplate({
      id: 'custom_event',
      category: 'system',
      titleTemplate: '活动通知：{{eventName}}',
      bodyTemplate: '{{eventName}}活动已开启，持续{{days}}天。',
      sender: '活动中心',
      priority: 'high',
      defaultExpireSeconds: 7 * 24 * 3600,
    });

    const mail = templateSystem.createFromTemplate('custom_event', { eventName: '三国争霸', days: 7 });
    expect(mail.title).toBe('活动通知：三国争霸');
    expect(mail.content).toContain('三国争霸');
    expect(mail.content).toContain('7');
  });
});

// ═════════════════════════════════════════════
// §5.8 离线收益邮件特殊规则（P0系统缺失）
// ═════════════════════════════════════════════

describe.skip('§5.8 离线收益邮件特殊规则（P0系统缺失）', () => {
  it('§5.8.1 离线收益邮件自动发送', () => {
    // 依赖 OfflineRewardSystem → MailSystem 联动（P0未实现）
  });

  it('§5.8.2 离线收益邮件附件与面板数据一致', () => {
    // 依赖离线收益→邮件附件联动（P0未实现）
  });

  it('§5.8.3 离线收益邮件过期时间与离线时长相关', () => {
    // 依赖离线时长→过期策略联动（P0未实现）
  });
});

// ═════════════════════════════════════════════
// 交叉验证：存档与持久化
// ═════════════════════════════════════════════

describe('邮件存档与持久化', () => {
  it('存档序列化→恢复一致性', () => {
    const ms = new MailSystem();
    ms.reset();
    ms.sendMail(makeRewardRequest([{ resourceType: 'grain', amount: 100 }]));
    ms.sendMail(makeRequest({ category: 'system', title: '系统' }));

    const save = ms.getSaveData();
    expect(save.version).toBe(MAIL_SAVE_VERSION);
    expect(save.mails.length).toBe(2);

    const ms2 = new MailSystem();
    ms2.reset();
    ms2.loadFromSaveData(save);
    expect(ms2.getMailCount()).toBe(2);
  });

  it('Storage持久化→恢复', () => {
    const storage = createMockStorage();
    const ms = new MailSystem(storage);
    ms.sendMail(makeRequest({ title: '持久化测试' }));

    // 新实例从同一Storage恢复
    const ms2 = new MailSystem(storage);
    expect(ms2.getMailCount()).toBe(1);
    const mails = ms2.getMails();
    expect(mails[0].title).toBe('持久化测试');
  });

  it('版本不匹配时恢复失败', () => {
    const ms = new MailSystem();
    ms.sendMail(makeRequest());

    const save = ms.getSaveData();
    const badSave = { ...save, version: 999 };

    const ms2 = new MailSystem();
    ms2.loadFromSaveData(badSave);
    expect(ms2.getMailCount()).toBe(0);
  });

  it('reset清空所有邮件', () => {
    const ms = new MailSystem();
    ms.sendMail(makeRequest());
    ms.sendMail(makeRequest());
    expect(ms.getMailCount()).toBe(2);

    ms.reset();
    expect(ms.getMailCount()).toBe(0);
    expect(ms.getUnreadCount()).toBe(0);
  });
});
