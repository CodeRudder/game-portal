/**
 * MailSystem 单元测试
 *
 * 覆盖：
 *   - 邮件创建（系统/战斗/社交/奖励）
 *   - 四态管理（未读→已读未领→已读已领→已过期）
 *   - 附件领取（单封+批量）
 *   - 邮件查询与分页
 *   - 批量操作（一键已读+批量领取+删除）
 *   - 过期处理
 *   - 邮件发送规则
 *   - 存档序列化
 */

import {
  MailSystem,
  CATEGORY_LABELS,
  STATUS_LABELS,
  MAILS_PER_PAGE,
  type MailData,
  type MailCategory,
  type MailStatus,
  type MailSendRequest,
  type MailFilter,
  type BatchOperationResult,
} from '../MailSystem';

// ── 辅助 ──

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => Object.keys(store).forEach(k => delete store[k])),
    get length() { return Object.keys(store).length; },
    key: jest.fn(() => null),
  };
}

function createSystemMail(overrides?: Partial<MailSendRequest>): MailSendRequest {
  return {
    category: 'system',
    title: '系统通知',
    content: '这是一封系统邮件',
    sender: '系统',
    ...overrides,
  };
}

function createRewardMail(attachments?: Array<{ resourceType: string; amount: number }>): MailSendRequest {
  return {
    category: 'reward',
    title: '奖励邮件',
    content: '恭喜获得奖励',
    sender: '系统',
    attachments: attachments ?? [{ resourceType: 'gold', amount: 100 }],
  };
}

// ═══════════════════════════════════════════════
// 1. 邮件创建
// ═══════════════════════════════════════════════

describe('MailSystem — 邮件创建', () => {
  it('创建系统邮件', () => {
    const mail = new MailSystem().sendMail(createSystemMail());
    expect(mail.category).toBe('system');
    expect(mail.status).toBe('unread');
    expect(mail.isRead).toBe(false);
    expect(mail.id).toMatch(/^mail_\d+$/);
  });

  it('创建战斗邮件', () => {
    const mail = new MailSystem().sendMail(createSystemMail({ category: 'battle', title: '战报' }));
    expect(mail.category).toBe('battle');
    expect(mail.title).toBe('战报');
  });

  it('创建社交邮件', () => {
    const mail = new MailSystem().sendMail(createSystemMail({ category: 'social', title: '好友申请' }));
    expect(mail.category).toBe('social');
  });

  it('创建带附件的奖励邮件', () => {
    const mail = new MailSystem().sendMail(createRewardMail([{ resourceType: 'grain', amount: 500 }]));
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].resourceType).toBe('grain');
    expect(mail.attachments[0].amount).toBe(500);
    expect(mail.attachments[0].claimed).toBe(false);
  });

  it('创建多附件邮件', () => {
    const mail = new MailSystem().sendMail(createRewardMail([
      { resourceType: 'grain', amount: 500 },
      { resourceType: 'gold', amount: 100 },
      { resourceType: 'troops', amount: 50 },
    ]));
    expect(mail.attachments).toHaveLength(3);
  });

  it('批量创建邮件', () => {
    const sys = new MailSystem();
    const mails = sys.sendBatch([
      createSystemMail({ title: '邮件1' }),
      createSystemMail({ title: '邮件2' }),
      createSystemMail({ title: '邮件3' }),
    ]);
    expect(mails).toHaveLength(3);
    expect(mails[0].id).not.toBe(mails[1].id);
    expect(mails[1].id).not.toBe(mails[2].id);
  });

  it('自定义保留时长', () => {
    const mail = new MailSystem().sendMail({
      ...createSystemMail(),
      retainSeconds: 3600, // 1小时
    });
    expect(mail.expireTime).not.toBeNull();
    // 过期时间应接近 sendTime + 3600*1000
    expect(mail.expireTime! - mail.sendTime).toBe(3600 * 1000);
  });

  it('永不过期邮件', () => {
    const mail = new MailSystem().sendMail({
      ...createSystemMail(),
      retainSeconds: null,
    });
    expect(mail.expireTime).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// 2. 四态管理
// ═══════════════════════════════════════════════

describe('MailSystem — 四态管理', () => {
  it('初始状态：未读', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createSystemMail());
    expect(mail.status).toBe('unread');
    expect(mail.isRead).toBe(false);
  });

  it('无附件邮件标记已读 → 已读已领', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createSystemMail());
    sys.markRead(mail.id);

    const updated = sys.getMail(mail.id)!;
    expect(updated.isRead).toBe(true);
    expect(updated.status).toBe('read_claimed'); // 无附件直接跳到已领
  });

  it('有附件邮件标记已读 → 已读未领', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail());
    sys.markRead(mail.id);

    const updated = sys.getMail(mail.id)!;
    expect(updated.isRead).toBe(true);
    expect(updated.status).toBe('read_unclaimed');
  });

  it('领取附件后 → 已读已领', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail());
    sys.markRead(mail.id);
    sys.claimAttachments(mail.id);

    const updated = sys.getMail(mail.id)!;
    expect(updated.status).toBe('read_claimed');
    expect(updated.attachments[0].claimed).toBe(true);
  });

  it('直接领取未读邮件 → 已读已领', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail());
    sys.claimAttachments(mail.id);

    const updated = sys.getMail(mail.id)!;
    expect(updated.status).toBe('read_claimed');
    expect(updated.isRead).toBe(true);
  });

  it('过期邮件 → 已过期', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail({
      ...createSystemMail(),
      retainSeconds: 0, // 立即过期
    });

    // 手动设置过期时间为过去
    const mailData = sys.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;

    const expiredCount = sys.processExpired();
    expect(expiredCount).toBe(1);

    const updated = sys.getMail(mail.id)!;
    expect(updated.status).toBe('expired');
  });

  it('状态流转完整路径：未读→已读未领→已读已领', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail());

    // 未读
    expect(sys.getMail(mail.id)!.status).toBe('unread');

    // 标记已读 → 已读未领
    sys.markRead(mail.id);
    expect(sys.getMail(mail.id)!.status).toBe('read_unclaimed');

    // 领取 → 已读已领
    sys.claimAttachments(mail.id);
    expect(sys.getMail(mail.id)!.status).toBe('read_claimed');
  });

  it('重复标记已读无副作用', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail());
    sys.markRead(mail.id);
    sys.markRead(mail.id);

    expect(sys.getMail(mail.id)!.status).toBe('read_unclaimed');
  });
});

// ═══════════════════════════════════════════════
// 3. 附件领取
// ═══════════════════════════════════════════════

describe('MailSystem — 附件领取', () => {
  it('单封领取', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail([{ resourceType: 'gold', amount: 100 }]));
    const claimed = sys.claimAttachments(mail.id);

    expect(claimed.gold).toBe(100);
  });

  it('多附件领取汇总', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail([
      { resourceType: 'gold', amount: 100 },
      { resourceType: 'gold', amount: 200 },
      { resourceType: 'grain', amount: 500 },
    ]));
    const claimed = sys.claimAttachments(mail.id);

    expect(claimed.gold).toBe(300);
    expect(claimed.grain).toBe(500);
  });

  it('重复领取返回空', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createRewardMail());
    sys.claimAttachments(mail.id);
    const second = sys.claimAttachments(mail.id);

    expect(Object.keys(second)).toHaveLength(0);
  });

  it('无附件邮件领取返回空', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail(createSystemMail());
    const claimed = sys.claimAttachments(mail.id);

    expect(Object.keys(claimed)).toHaveLength(0);
  });
});
