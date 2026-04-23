/**
 * MailSystem 单元测试 (p2)
 *
 * 覆盖：
 * - 附件领取（批量）
 * - 邮件查询与分页
 * - 批量操作（一键已读+批量领取+删除）
 * - 过期处理
 * - 存档序列化
 * - 常量验证
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
// 3b. 附件领取（批量）
// ═══════════════════════════════════════════════

describe('MailSystem — 附件领取（批量）', () => {
  it('批量领取', () => {
    const sys = new MailSystem();
    sys.sendMail(createRewardMail([{ resourceType: 'gold', amount: 100 }]));
    sys.sendMail(createRewardMail([{ resourceType: 'gold', amount: 200 }]));
    sys.sendMail(createRewardMail([{ resourceType: 'grain', amount: 500 }]));

    const result = sys.claimAllAttachments();
    expect(result.count).toBe(3);
    expect(result.claimedResources.gold).toBe(300);
    expect(result.claimedResources.grain).toBe(500);
  });

  it('批量领取带分类过滤', () => {
    const sys = new MailSystem();
    sys.sendMail(createRewardMail([{ resourceType: 'gold', amount: 100 }]));
    sys.sendMail({ category: 'system', title: '系统', content: '', sender: '系统' });

    const result = sys.claimAllAttachments({ category: 'reward' });
    expect(result.count).toBe(1);
  });
});

// ═══════════════════════════════════════════════
// 4. 邮件查询与分页
// ═══════════════════════════════════════════════

describe('MailSystem — 查询与分页', () => {
  it('获取全部邮件', () => {
    const sys = new MailSystem();
    for (let i = 0; i < 5; i++) {
      sys.sendMail(createSystemMail({ title: `邮件${i}` }));
    }
    expect(sys.getMailCount()).toBe(5);
  });

  it('按分类过滤', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail({ category: 'system' }));
    sys.sendMail(createSystemMail({ category: 'battle' }));
    sys.sendMail(createSystemMail({ category: 'reward' }));

    expect(sys.getMailCount({ category: 'system' })).toBe(1);
    expect(sys.getMailCount({ category: 'all' })).toBe(3);
  });

  it('分页查询', () => {
    const sys = new MailSystem();
    for (let i = 0; i < 25; i++) {
      sys.sendMail(createSystemMail({ title: `邮件${i}` }));
    }

    const page1 = sys.getMails(undefined, 1);
    const page2 = sys.getMails(undefined, 2);

    expect(page1).toHaveLength(MAILS_PER_PAGE);
    expect(page2).toHaveLength(5); // 25 - 20 = 5
  });

  it('按时间倒序排列', () => {
    const sys = new MailSystem();
    const first = sys.sendMail(createSystemMail({ title: '第一封' }));
    const second = sys.sendMail(createSystemMail({ title: '第二封' }));

    const mails = sys.getMails();
    expect(mails[0].id).toBe(second.id); // 最新的在前
    expect(mails[1].id).toBe(first.id);
  });

  it('未读数统计', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail());
    sys.sendMail(createSystemMail());
    sys.sendMail(createSystemMail());

    expect(sys.getUnreadCount()).toBe(3);

    // 标记一封已读
    const mails = sys.getMails();
    sys.markRead(mails[0].id);

    expect(sys.getUnreadCount()).toBe(2);
  });

  it('按分类统计未读', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail({ category: 'system' }));
    sys.sendMail(createSystemMail({ category: 'reward' }));

    expect(sys.getUnreadCount('system')).toBe(1);
    expect(sys.getUnreadCount('reward')).toBe(1);
    expect(sys.getUnreadCount('battle')).toBe(0);
  });

  it('只看有附件的邮件', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail()); // 无附件
    sys.sendMail(createRewardMail()); // 有附件

    expect(sys.getMailCount({ hasAttachment: true })).toBe(1);
  });
});

// ═══════════════════════════════════════════════
// 5. 批量操作
// ═══════════════════════════════════════════════

describe('MailSystem — 批量操作', () => {
  it('一键全部已读', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail());
    sys.sendMail(createSystemMail());
    sys.sendMail(createSystemMail());

    const count = sys.markAllRead();
    expect(count).toBe(3);
    expect(sys.getUnreadCount()).toBe(0);
  });

  it('按分类全部已读', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail({ category: 'system' }));
    sys.sendMail(createSystemMail({ category: 'system' }));
    sys.sendMail(createSystemMail({ category: 'reward' }));

    const count = sys.markAllRead({ category: 'system' });
    expect(count).toBe(2);
    expect(sys.getUnreadCount()).toBe(1); // reward still unread
  });

  it('删除已读已领邮件', () => {
    const sys = new MailSystem();
    const mail1 = sys.sendMail(createSystemMail());
    const mail2 = sys.sendMail(createRewardMail());

    sys.markRead(mail1.id); // 无附件 → read_claimed
    sys.markRead(mail2.id); // 有附件 → read_unclaimed

    // 只有 mail1 可以删除（已读已领）
    expect(sys.deleteMail(mail1.id)).toBe(true);
    expect(sys.deleteMail(mail2.id)).toBe(false); // 未领取附件
  });

  it('批量删除已读已领', () => {
    const sys = new MailSystem();
    const mail1 = sys.sendMail(createSystemMail());
    const mail2 = sys.sendMail(createSystemMail());
    sys.sendMail(createSystemMail()); // unread

    sys.markRead(mail1.id);
    sys.markRead(mail2.id);

    const count = sys.deleteReadClaimed();
    expect(count).toBe(2);
    expect(sys.getMailCount()).toBe(1);
  });
});

// ═══════════════════════════════════════════════
// 6. 过期处理
// ═══════════════════════════════════════════════

describe('MailSystem — 过期处理', () => {
  it('过期邮件标记为expired', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail({
      ...createSystemMail(),
      retainSeconds: 0,
    });

    // 设置过期时间为过去
    const data = sys.getMail(mail.id)!;
    data.expireTime = Date.now() - 1000;

    const count = sys.processExpired();
    expect(count).toBe(1);
    expect(sys.getMail(mail.id)!.status).toBe('expired');
  });

  it('未过期邮件不受影响', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail({ retainSeconds: 86400 }));

    const count = sys.processExpired();
    expect(count).toBe(0);
  });

  it('已过期邮件不重复处理', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail({ ...createSystemMail(), retainSeconds: 0 });
    const data = sys.getMail(mail.id)!;
    data.expireTime = Date.now() - 1000;

    sys.processExpired();
    const count = sys.processExpired();
    expect(count).toBe(0);
  });

  it('过期邮件不能标记已读', () => {
    const sys = new MailSystem();
    const mail = sys.sendMail({ ...createSystemMail(), retainSeconds: 0 });
    const data = sys.getMail(mail.id)!;
    data.expireTime = Date.now() - 1000;
    sys.processExpired();

    expect(sys.markRead(mail.id)).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// 7. 存档序列化
// ═══════════════════════════════════════════════

describe('MailSystem — 存档序列化', () => {
  it('存档和恢复', () => {
    const sys1 = new MailSystem();
    sys1.sendMail(createSystemMail({ title: '测试邮件' }));
    sys1.sendMail(createRewardMail());

    const saveData = sys1.getSaveData();
    expect(saveData.mails).toHaveLength(2);
    expect(saveData.version).toBe(1);

    // 恢复到新实例
    const sys2 = new MailSystem();
    sys2.loadFromSaveData(saveData);
    expect(sys2.getMailCount()).toBe(2);
  });

  it('版本不匹配不恢复', () => {
    const sys = new MailSystem();
    sys.loadFromSaveData({ mails: [], nextId: 1, version: 999 });
    expect(sys.getMailCount()).toBe(0);
  });

  it('重置清空所有邮件', () => {
    const sys = new MailSystem();
    sys.sendMail(createSystemMail());
    sys.sendMail(createSystemMail());

    sys.reset();
    expect(sys.getMailCount()).toBe(0);
  });

  it('持久化到 storage', () => {
    const storage = createMockStorage();
    const sys = new MailSystem(storage);
    sys.sendMail(createSystemMail());

    expect(storage.setItem).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 8. 常量验证
// ═══════════════════════════════════════════════

describe('MailSystem — 常量', () => {
  it('分类标签完整', () => {
    expect(CATEGORY_LABELS.system).toBe('系统');
    expect(CATEGORY_LABELS.battle).toBe('战斗');
    expect(CATEGORY_LABELS.social).toBe('社交');
    expect(CATEGORY_LABELS.reward).toBe('奖励');
    expect(CATEGORY_LABELS.all).toBe('全部');
  });

  it('状态标签完整', () => {
    expect(STATUS_LABELS.unread).toBe('未读');
    expect(STATUS_LABELS.read_unclaimed).toBe('已读未领');
    expect(STATUS_LABELS.read_claimed).toBe('已读已领');
    expect(STATUS_LABELS.expired).toBe('已过期');
  });

  it('每页20条', () => {
    expect(MAILS_PER_PAGE).toBe(20);
  });
});
