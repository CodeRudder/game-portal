/**
 * MailSystem 单元测试 — 创建与状态管理
 *
 * 从 MailSystem.test.ts 拆分而来
 * 覆盖：邮件创建、四态管理
 */

import {
  MailSystem,
  type MailData,
  type MailCategory,
  type MailStatus,
  type MailSendRequest,
} from '../MailSystem';

// ── 辅助 ──

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
