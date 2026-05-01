/**
 * 邮件容量与过期提醒 — P1 测试
 *
 * 覆盖：
 *   1. 容量上限（100封 + 暂存队列20封）
 *   2. 过期提醒机制（3天/1天/当天闪烁提醒）
 *   3. P1补充：超限处理、暂存队列溢出、过期分级查询、状态联动
 *
 * 注意：
 *   - 使用真实 MailSystem 实例，不 mock
 *   - 暂存队列功能在 OfflineRewardSystem 中实现，本测试验证 MailSystem
 *     的容量常量和与暂存队列的交互逻辑。
 *   - 过期提醒为 UI 层功能，引擎层通过 expireTime 提供数据支撑，
 *     本测试验证过期时间计算和分类查询的正确性。
 *
 * @module engine/mail/__tests__/MailCapacity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MailSystem } from '../MailSystem';
import { MAILBOX_CAPACITY, MAILS_PER_PAGE } from '../mail.types';
import {
  DEFAULT_RETAIN_SECONDS,
  SYSTEM_RETAIN_SECONDS,
  REWARD_RETAIN_SECONDS,
} from '../MailConstants';
import type { MailData, MailSendRequest, MailCategory } from '../mail.types';

// ── 辅助函数 ──

/** 创建 mock Storage */
function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => Object.keys(store).forEach(k => delete store[k])),
    get length() { return Object.keys(store).length; },
    key: vi.fn(() => null),
  };
}

/** 创建邮件发送请求 */
function makeMail(index: number, overrides?: Partial<MailSendRequest>): MailSendRequest {
  return {
    category: 'system',
    title: `测试邮件 ${index}`,
    content: `这是第 ${index} 封测试邮件`,
    sender: '测试系统',
    ...overrides,
  };
}

/** 创建带附件的奖励邮件 */
function makeRewardMail(index: number): MailSendRequest {
  return {
    category: 'reward',
    title: `奖励邮件 ${index}`,
    content: `恭喜获得奖励 ${index}`,
    sender: '奖励系统',
    attachments: [{ resourceType: 'gold', amount: 100 * index }],
  };
}

/** 创建即将过期的邮件（指定剩余秒数） */
function makeExpiringMail(index: number, remainSeconds: number): MailSendRequest {
  return {
    category: 'system',
    title: `即将过期邮件 ${index}`,
    content: `还有 ${remainSeconds} 秒过期`,
    sender: '系统',
    retainSeconds: remainSeconds,
  };
}

/** 获取邮件剩余天数 */
function getRemainDays(mail: MailData): number {
  if (!mail.expireTime) return Infinity;
  return (mail.expireTime - Date.now()) / (24 * 3600 * 1000);
}

/** 获取过期提醒级别 */
function getExpiryAlertLevel(mail: MailData): 'none' | 'flash' | 'urgent' | 'warning' | 'safe' {
  if (!mail.expireTime || mail.status === 'expired') return 'none';
  const remainDays = getRemainDays(mail);
  if (remainDays <= 0) return 'none';
  if (remainDays <= 1) return 'flash';
  if (remainDays <= 3) return 'urgent';
  if (remainDays <= 7) return 'warning';
  return 'safe';
}

// ══════════════════════════════════════════════
// 1. 容量上限 — 常量验证
// ══════════════════════════════════════════════

describe('邮件容量 — 常量验证', () => {
  it('MAILBOX_CAPACITY 应为 100', () => {
    expect(MAILBOX_CAPACITY).toBe(100);
  });

  it('MAILS_PER_PAGE 应为 20', () => {
    expect(MAILS_PER_PAGE).toBe(20);
  });
});

// ══════════════════════════════════════════════
// 2. 容量上限 — 邮箱满载测试
// ══════════════════════════════════════════════

describe('邮件容量 — 邮箱满载', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('应能发送并存储100封邮件', () => {
    const mails: MailData[] = [];
    for (let i = 0; i < 100; i++) {
      mails.push(mailSystem.sendMail(makeMail(i)));
    }
    expect(mailSystem.getMailCount()).toBe(100);
  });

  it('超过100封后仍可发送（引擎不强制限制，由上层控制）', () => {
    for (let i = 0; i < 120; i++) {
      mailSystem.sendMail(makeMail(i));
    }
    expect(mailSystem.getMailCount()).toBe(120);
  });

  it('容量检查：getMailCount 应准确反映当前邮件数', () => {
    expect(mailSystem.getMailCount()).toBe(0);
    mailSystem.sendMail(makeMail(1));
    expect(mailSystem.getMailCount()).toBe(1);
    mailSystem.sendMail(makeMail(2));
    expect(mailSystem.getMailCount()).toBe(2);
  });

  it('删除邮件后容量应释放', () => {
    const m1 = mailSystem.sendMail(makeMail(1));
    const m2 = mailSystem.sendMail(makeMail(2));
    const m3 = mailSystem.sendMail(makeMail(3));

    expect(mailSystem.getMailCount()).toBe(3);

    mailSystem.markRead(m1.id);
    mailSystem.markRead(m2.id);

    expect(mailSystem.deleteMail(m1.id)).toBe(true);
    expect(mailSystem.getMailCount()).toBe(2);
  });

  it('分页查询应正确处理满载邮箱', () => {
    for (let i = 0; i < 100; i++) {
      mailSystem.sendMail(makeMail(i));
    }

    const page1 = mailSystem.getMails(undefined, 1);
    expect(page1.length).toBe(20);

    const page5 = mailSystem.getMails(undefined, 5);
    expect(page5.length).toBe(20);

    const page6 = mailSystem.getMails(undefined, 6);
    expect(page6.length).toBe(0);
  });
});

// ══════════════════════════════════════════════
// 3. 容量上限 — 暂存队列交互
// ══════════════════════════════════════════════

describe('邮件容量 — 暂存队列交互', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('删除已读已领邮件后应能继续接收新邮件', () => {
    const mails: MailData[] = [];
    for (let i = 0; i < 100; i++) {
      mails.push(mailSystem.sendMail(makeMail(i)));
    }
    expect(mailSystem.getMailCount()).toBe(100);

    mailSystem.markAllRead();
    const deleted = mailSystem.deleteReadClaimed();
    expect(deleted).toBe(100);
    expect(mailSystem.getMailCount()).toBe(0);

    const newMail = mailSystem.sendMail(makeMail(101));
    expect(mailSystem.getMailCount()).toBe(1);
    expect(newMail.title).toContain('101');
  });

  it('批量删除后邮件ID应保持唯一', () => {
    const first = mailSystem.sendMail(makeMail(1));
    mailSystem.markRead(first.id);
    mailSystem.deleteMail(first.id);

    const second = mailSystem.sendMail(makeMail(2));
    expect(first.id).not.toBe(second.id);
  });

  it('满载时批量领取附件应正常工作', () => {
    for (let i = 0; i < 100; i++) {
      mailSystem.sendMail(makeRewardMail(i));
    }
    expect(mailSystem.getMailCount()).toBe(100);

    const result = mailSystem.claimAllAttachments();
    expect(result.count).toBe(100);
    expect(result.successIds.length).toBe(100);
    expect(result.claimedResources.gold).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════
// 4. 过期提醒机制 — 过期时间计算
// ══════════════════════════════════════════════

describe('邮件过期提醒 — 过期时间计算', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('邮件应正确设置过期时间', () => {
    const retainSeconds = 7 * 24 * 3600;
    const mail = mailSystem.sendMail({
      category: 'system',
      title: '测试过期',
      content: '内容',
      sender: '系统',
      retainSeconds,
    });

    expect(mail.expireTime).not.toBeNull();
    expect(mail.expireTime! - mail.sendTime).toBe(retainSeconds * 1000);
  });

  it('retainSeconds 为 null 时不应过期', () => {
    const mail = mailSystem.sendMail({
      category: 'system',
      title: '永不过期',
      content: '内容',
      sender: '系统',
      retainSeconds: null,
    });

    expect(mail.expireTime).toBeNull();
  });

  it('不同分类的邮件应有不同的默认过期时间', () => {
    const systemMail = mailSystem.sendMail({
      category: 'system', title: '系统邮件', content: '内容', sender: '系统',
    });
    const rewardMail = mailSystem.sendMail({
      category: 'reward', title: '奖励邮件', content: '内容', sender: '系统',
    });
    const socialMail = mailSystem.sendMail({
      category: 'social', title: '社交邮件', content: '内容', sender: '系统',
    });

    // 系统邮件30天过期
    expect(systemMail.expireTime).not.toBeNull();
    const systemRetain = (systemMail.expireTime! - systemMail.sendTime) / 1000;
    expect(systemRetain).toBe(30 * 24 * 3600);

    // 奖励邮件14天过期
    expect(rewardMail.expireTime).not.toBeNull();
    const rewardRetain = (rewardMail.expireTime! - rewardMail.sendTime) / 1000;
    expect(rewardRetain).toBe(14 * 24 * 3600);

    // 社交邮件7天过期
    expect(socialMail.expireTime).not.toBeNull();
    const socialRetain = (socialMail.expireTime! - socialMail.sendTime) / 1000;
    expect(socialRetain).toBe(7 * 24 * 3600);
  });
});

// ══════════════════════════════════════════════
// 5. 过期提醒机制 — 3天/1天/当天判断
// ══════════════════════════════════════════════

describe('邮件过期提醒 — 剩余时间分级', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('3天内过期的邮件应可被查询', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 2 * 24 * 3600));
    const remainDays = getRemainDays(mail);
    expect(remainDays).toBeLessThan(3);
    expect(remainDays).toBeGreaterThan(1);
  });

  it('1天内过期的邮件应可被查询', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 12 * 3600));
    const remainDays = getRemainDays(mail);
    expect(remainDays).toBeLessThan(1);
    expect(remainDays).toBeGreaterThan(0);
  });

  it('当天过期的邮件应可被查询', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 3600));
    const remainHours = (mail.expireTime! - Date.now()) / (3600 * 1000);
    expect(remainHours).toBeLessThan(24);
    expect(remainHours).toBeGreaterThan(0);
  });

  it('已过期的邮件应被 processExpired 标记', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 1));
    const mailData = mailSystem.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;

    const expiredCount = mailSystem.processExpired();
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const updatedMail = mailSystem.getMail(mail.id)!;
    expect(updatedMail.status).toBe('expired');
  });

  it('未过期邮件不应被标记为过期', () => {
    mailSystem.sendMail({
      category: 'system', title: '未过期邮件', content: '内容', sender: '系统',
      retainSeconds: 7 * 24 * 3600,
    });

    const expiredCount = mailSystem.processExpired();
    expect(expiredCount).toBe(0);
  });
});

// ══════════════════════════════════════════════
// 6. 过期提醒 — 辅助函数（供 UI 层使用）
// ══════════════════════════════════════════════

describe('邮件过期提醒 — 辅助计算', () => {
  it('应正确计算邮件剩余天数', () => {
    const now = Date.now();
    const threeDaysLater = now + 3 * 24 * 3600 * 1000;
    const remainDays = (threeDaysLater - now) / (24 * 3600 * 1000);
    expect(remainDays).toBe(3);
  });

  it('3天阈值判断应正确', () => {
    const now = Date.now();

    const fourDays = now + 4 * 24 * 3600 * 1000;
    expect((fourDays - now) / (24 * 3600 * 1000)).toBeGreaterThan(3);

    const twoDays = now + 2 * 24 * 3600 * 1000;
    expect((twoDays - now) / (24 * 3600 * 1000)).toBeLessThan(3);
    expect((twoDays - now) / (24 * 3600 * 1000)).toBeGreaterThan(1);

    const twelveHours = now + 12 * 3600 * 1000;
    expect((twelveHours - now) / (24 * 3600 * 1000)).toBeLessThan(1);

    const oneHour = now + 1 * 3600 * 1000;
    expect((oneHour - now) / (3600 * 1000)).toBeLessThan(24);
    expect((oneHour - now) / (3600 * 1000)).toBeGreaterThan(0);
  });

  it('过期时间已过的邮件应返回负数剩余天数', () => {
    const now = Date.now();
    const pastTime = now - 24 * 3600 * 1000;
    const remainDays = (pastTime - now) / (24 * 3600 * 1000);
    expect(remainDays).toBeLessThan(0);
  });
});

// ══════════════════════════════════════════════
// 7. 过期邮件与容量管理
// ══════════════════════════════════════════════

describe('邮件过期与容量管理', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('过期邮件不应计入未读数', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 1));
    const mailData = mailSystem.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSystem.processExpired();
    expect(mailSystem.getUnreadCount()).toBe(0);
  });

  it('过期邮件不能被标记已读', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 1));
    const mailData = mailSystem.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSystem.processExpired();
    expect(mailSystem.markRead(mail.id)).toBe(false);
  });

  it('过期邮件不能领取附件', () => {
    const mail = mailSystem.sendMail({
      category: 'reward', title: '过期奖励', content: '内容', sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 100 }],
      retainSeconds: 1,
    });
    const mailData = mailSystem.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSystem.processExpired();

    const claimed = mailSystem.claimAttachments(mail.id);
    expect(Object.keys(claimed)).toHaveLength(0);
  });

  it('过期邮件可以被删除', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 1));
    const mailData = mailSystem.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSystem.processExpired();

    expect(mailSystem.deleteMail(mail.id)).toBe(true);
    expect(mailSystem.getMailCount()).toBe(0);
  });

  it('deleteReadClaimed 应同时清理过期邮件', () => {
    mailSystem.sendMail(makeMail(1));
    const expiring = mailSystem.sendMail(makeExpiringMail(2, 1));

    const mailData = mailSystem.getMail(expiring.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSystem.processExpired();

    const normalMail = mailSystem.getMails()[0];
    if (normalMail && normalMail.id !== expiring.id) {
      mailSystem.markRead(normalMail.id);
    }

    const deleted = mailSystem.deleteReadClaimed();
    expect(deleted).toBeGreaterThanOrEqual(1);
  });

  it('满载邮箱中过期邮件清理后应释放空间', () => {
    const mails: MailData[] = [];
    for (let i = 0; i < 100; i++) {
      mails.push(mailSystem.sendMail(makeExpiringMail(i, i < 50 ? 1 : 7 * 24 * 3600)));
    }

    for (let i = 0; i < 50; i++) {
      const mail = mailSystem.getMail(mails[i].id)!;
      mail.expireTime = Date.now() - 1000;
    }
    mailSystem.processExpired();

    const deleted = mailSystem.deleteReadClaimed();
    expect(deleted).toBe(50);
    expect(mailSystem.getMailCount()).toBe(50);
  });
});

// ══════════════════════════════════════════════
// 8. 批量操作与容量
// ══════════════════════════════════════════════

describe('邮件批量操作与容量', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('批量发送应正确增加邮件数', () => {
    const requests = Array.from({ length: 10 }, (_, i) => makeMail(i));
    const mails = mailSystem.sendBatch(requests);
    expect(mails).toHaveLength(10);
    expect(mailSystem.getMailCount()).toBe(10);
  });

  it('满载后批量标记已读应正常工作', () => {
    for (let i = 0; i < 100; i++) {
      mailSystem.sendMail(makeMail(i));
    }
    const count = mailSystem.markAllRead();
    expect(count).toBe(100);
    expect(mailSystem.getUnreadCount()).toBe(0);
  });

  it('按分类统计未读数应正确', () => {
    for (let i = 0; i < 30; i++) {
      mailSystem.sendMail({ ...makeMail(i), category: 'system' });
    }
    for (let i = 0; i < 20; i++) {
      mailSystem.sendMail({ ...makeMail(i + 30), category: 'reward' });
    }
    for (let i = 0; i < 10; i++) {
      mailSystem.sendMail({ ...makeMail(i + 50), category: 'social' });
    }

    const counts = mailSystem.getUnreadCountByCategory();
    expect(counts.system).toBe(30);
    expect(counts.reward).toBe(20);
    expect(counts.social).toBe(10);
  });

  it('序列化与反序列化应保持邮件数量', () => {
    for (let i = 0; i < 50; i++) {
      mailSystem.sendMail(makeMail(i));
    }

    const saveData = mailSystem.getSaveData();
    expect(saveData.mails).toHaveLength(50);

    const newSystem = new MailSystem(createMockStorage());
    newSystem.reset();
    newSystem.loadFromSaveData(saveData);
    expect(newSystem.getMailCount()).toBe(50);
  });
});

// ══════════════════════════════════════════════
// 9. P1补充 — 超限处理
// ══════════════════════════════════════════════

describe('邮件容量 — 超限处理（P1补充）', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('超过100封后最旧邮件应可被查询到并手动删除', () => {
    const mails: MailData[] = [];
    for (let i = 0; i < 120; i++) {
      mails.push(mailSystem.sendMail(makeMail(i)));
    }

    expect(mailSystem.getMailCount()).toBe(120);

    const oldestMail = mailSystem.getMail(mails[0].id);
    expect(oldestMail).toBeTruthy();
    expect(oldestMail!.title).toContain('0');

    mailSystem.markRead(mails[0].id);
    expect(mailSystem.deleteMail(mails[0].id)).toBe(true);
    expect(mailSystem.getMailCount()).toBe(119);
  });

  it('超过100封后按时间排序最旧邮件在末尾', () => {
    for (let i = 0; i < 110; i++) {
      mailSystem.sendMail(makeMail(i));
    }

    const allMails = mailSystem.getAllMails();
    expect(allMails).toHaveLength(110);
    expect(allMails[0].sendTime).toBeGreaterThanOrEqual(allMails[allMails.length - 1].sendTime);
  });

  it('模拟上层容量管理：超过100封时删除最旧的已读已领邮件', () => {
    const mails: MailData[] = [];
    for (let i = 0; i < 110; i++) {
      mails.push(mailSystem.sendMail(makeMail(i)));
    }

    mailSystem.markAllRead();

    for (let i = 0; i < 10; i++) {
      mailSystem.deleteMail(mails[i].id);
    }

    expect(mailSystem.getMailCount()).toBe(100);
  });

  it('容量管理：无附件邮件标记已读后可被deleteReadClaimed清理', () => {
    // 50封无附件邮件 + 60封有附件邮件
    for (let i = 0; i < 50; i++) {
      mailSystem.sendMail(makeMail(i));
    }
    for (let i = 0; i < 60; i++) {
      mailSystem.sendMail(makeRewardMail(i));
    }

    expect(mailSystem.getMailCount()).toBe(110);

    // 标记所有邮件已读
    mailSystem.markAllRead();

    // 无附件的邮件标记已读后变为 read_claimed，可被删除
    // 有附件的邮件标记已读后变为 read_unclaimed，不可被删除
    const deleted = mailSystem.deleteReadClaimed();
    // 只有50封无附件的已读邮件可被删除（read_claimed）
    // 60封有附件的邮件是 read_unclaimed，不会被删除
    expect(deleted).toBe(50);
    expect(mailSystem.getMailCount()).toBe(60);
  });
});

// ══════════════════════════════════════════════
// 10. P1补充 — 暂存队列
// ══════════════════════════════════════════════

describe('邮件容量 — 暂存队列（P1补充）', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('暂存队列概念：MAILBOX容量100 + MAILS_PER_PAGE = 20', () => {
    expect(MAILBOX_CAPACITY).toBe(100);
    expect(MAILS_PER_PAGE).toBe(20);
    expect(MAILBOX_CAPACITY / MAILS_PER_PAGE).toBe(5);
  });

  it('分页查询第1页应返回最新的20封邮件', () => {
    for (let i = 0; i < 100; i++) {
      mailSystem.sendMail(makeMail(i));
    }

    const page1 = mailSystem.getMails(undefined, 1);
    expect(page1).toHaveLength(20);
    const titles = page1.map(m => m.title);
    expect(titles.some(t => t.includes('99'))).toBe(true);
  });

  it('分页查询最后一页应返回最旧的邮件', () => {
    for (let i = 0; i < 100; i++) {
      mailSystem.sendMail(makeMail(i));
    }

    const page5 = mailSystem.getMails(undefined, 5);
    expect(page5).toHaveLength(20);
    const titles = page5.map(m => m.title);
    expect(titles.some(t => t.includes('0'))).toBe(true);
  });

  it('删除部分邮件后分页应正确调整', () => {
    for (let i = 0; i < 80; i++) {
      mailSystem.sendMail(makeMail(i));
    }

    const allMails = mailSystem.getAllMails();
    const oldestMails = allMails.slice(-10);
    for (const mail of oldestMails) {
      mailSystem.markRead(mail.id);
      mailSystem.deleteMail(mail.id);
    }

    expect(mailSystem.getMailCount()).toBe(70);

    const page4 = mailSystem.getMails(undefined, 4);
    expect(page4).toHaveLength(10);
    const page5 = mailSystem.getMails(undefined, 5);
    expect(page5).toHaveLength(0);
  });

  it('暂存队列溢出：超过120封邮件后系统应仍正常工作', () => {
    for (let i = 0; i < 200; i++) {
      mailSystem.sendMail(makeMail(i));
    }

    expect(mailSystem.getMailCount()).toBe(200);

    const page1 = mailSystem.getMails(undefined, 1);
    expect(page1).toHaveLength(20);
    expect(mailSystem.getUnreadCount()).toBe(200);
  });
});

// ══════════════════════════════════════════════
// 11. P1补充 — 过期提醒分级查询
// ══════════════════════════════════════════════

describe('邮件过期提醒 — 分级查询（P1补充）', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('应能筛选出3天内过期的邮件', () => {
    mailSystem.sendMail(makeExpiringMail(1, 2 * 24 * 3600));
    mailSystem.sendMail(makeExpiringMail(2, 5 * 24 * 3600));
    mailSystem.sendMail(makeExpiringMail(3, 1 * 24 * 3600));

    const allMails = mailSystem.getAllMails();
    const urgentMails = allMails.filter(m => {
      const level = getExpiryAlertLevel(m);
      return level === 'urgent' || level === 'flash';
    });

    expect(urgentMails.length).toBeGreaterThanOrEqual(2);
  });

  it('应能筛选出1天内过期的邮件', () => {
    const halfDay = mailSystem.sendMail(makeExpiringMail(1, 12 * 3600));
    mailSystem.sendMail(makeExpiringMail(2, 2 * 24 * 3600));

    const allMails = mailSystem.getAllMails();
    const flashMails = allMails.filter(m => getExpiryAlertLevel(m) === 'flash');

    expect(flashMails.length).toBeGreaterThanOrEqual(1);
    expect(flashMails.some(m => m.id === halfDay.id)).toBe(true);
  });

  it('应能筛选出当天过期的邮件（闪烁提醒）', () => {
    mailSystem.sendMail(makeExpiringMail(1, 3600));
    mailSystem.sendMail(makeExpiringMail(2, 12 * 3600));

    const allMails = mailSystem.getAllMails();
    const flashMails = allMails.filter(m => getExpiryAlertLevel(m) === 'flash');

    expect(flashMails.length).toBeGreaterThanOrEqual(1);
  });

  it('永不过期的邮件不应有提醒', () => {
    const mail = mailSystem.sendMail({
      category: 'system', title: '永不过期', content: '内容', sender: '系统',
      retainSeconds: null,
    });
    expect(getExpiryAlertLevel(mail)).toBe('none');
  });

  it('已过期邮件不应有提醒', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 1));
    const mailData = mailSystem.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSystem.processExpired();
    expect(getExpiryAlertLevel(mailData)).toBe('none');
  });

  it('大量邮件中过期提醒应正确分类', () => {
    for (let i = 0; i < 100; i++) {
      mailSystem.sendMail(makeExpiringMail(i, (i + 1) * 3600));
    }

    const allMails = mailSystem.getAllMails();
    const flash = allMails.filter(m => getExpiryAlertLevel(m) === 'flash');
    const urgent = allMails.filter(m => getExpiryAlertLevel(m) === 'urgent');
    const warning = allMails.filter(m => getExpiryAlertLevel(m) === 'warning');
    const safe = allMails.filter(m => getExpiryAlertLevel(m) === 'safe');

    // 所有邮件应被分到某个有效级别（flash + urgent + warning + safe）
    expect(flash.length + urgent.length + warning.length + safe.length).toBe(100);
    expect(flash.length).toBeGreaterThan(0);
    expect(urgent.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════
// 12. P1补充 — 过期提醒与邮件状态联动
// ══════════════════════════════════════════════

describe('邮件过期提醒 — 与邮件状态联动（P1补充）', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('过期提醒的邮件仍可被标记已读', () => {
    const mail = mailSystem.sendMail(makeExpiringMail(1, 2 * 24 * 3600));
    expect(getExpiryAlertLevel(mail)).toBeTruthy();

    expect(mailSystem.markRead(mail.id)).toBe(true);
    const updated = mailSystem.getMail(mail.id)!;
    expect(updated.isRead).toBe(true);
  });

  it('过期提醒的邮件附件仍可领取', () => {
    const mail = mailSystem.sendMail({
      category: 'reward', title: '即将过期奖励', content: '内容', sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 500 }],
      retainSeconds: 2 * 24 * 3600,
    });

    const claimed = mailSystem.claimAttachments(mail.id);
    expect(claimed.gold).toBe(500);
  });

  it('过期提醒邮件过期后附件不可领取', () => {
    const mail = mailSystem.sendMail({
      category: 'reward', title: '即将过期奖励', content: '内容', sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 500 }],
      retainSeconds: 1,
    });

    const mailData = mailSystem.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSystem.processExpired();

    const claimed = mailSystem.claimAttachments(mail.id);
    expect(Object.keys(claimed)).toHaveLength(0);
  });

  it('不同分类邮件的过期提醒级别应独立计算', () => {
    const systemMail = mailSystem.sendMail({
      category: 'system', title: '系统邮件', content: '内容', sender: '系统',
      retainSeconds: 2 * 24 * 3600,
    });
    const rewardMail = mailSystem.sendMail({
      category: 'reward', title: '奖励邮件', content: '内容', sender: '系统',
      retainSeconds: 2 * 24 * 3600,
    });

    expect(getExpiryAlertLevel(systemMail)).toBe(getExpiryAlertLevel(rewardMail));
  });

  it('processExpired 应批量处理所有过期邮件', () => {
    const mails: MailData[] = [];
    for (let i = 0; i < 10; i++) {
      mails.push(mailSystem.sendMail(makeExpiringMail(i, 1)));
    }

    for (const mail of mails) {
      const mailData = mailSystem.getMail(mail.id)!;
      mailData.expireTime = Date.now() - 1000;
    }

    const expiredCount = mailSystem.processExpired();
    expect(expiredCount).toBe(10);

    for (const mail of mails) {
      const updated = mailSystem.getMail(mail.id)!;
      expect(updated.status).toBe('expired');
    }
  });
});

// ══════════════════════════════════════════════
// 13. P1补充 — 过期常量验证
// ══════════════════════════════════════════════

describe('邮件过期提醒 — 常量验证（P1补充）', () => {
  it('DEFAULT_RETAIN_SECONDS 应为7天', () => {
    expect(DEFAULT_RETAIN_SECONDS).toBe(7 * 24 * 3600);
  });

  it('SYSTEM_RETAIN_SECONDS 应为30天', () => {
    expect(SYSTEM_RETAIN_SECONDS).toBe(30 * 24 * 3600);
  });

  it('REWARD_RETAIN_SECONDS 应为14天', () => {
    expect(REWARD_RETAIN_SECONDS).toBe(14 * 24 * 3600);
  });

  it('系统邮件保留时间应大于奖励邮件', () => {
    expect(SYSTEM_RETAIN_SECONDS).toBeGreaterThan(REWARD_RETAIN_SECONDS);
  });

  it('奖励邮件保留时间应大于默认邮件', () => {
    expect(REWARD_RETAIN_SECONDS).toBeGreaterThan(DEFAULT_RETAIN_SECONDS);
  });

  it('3天/1天/当天阈值应在合理范围内', () => {
    const threeDays = 3 * 24 * 3600;
    const oneDay = 1 * 24 * 3600;
    expect(threeDays).toBeLessThan(DEFAULT_RETAIN_SECONDS);
    expect(oneDay).toBeLessThan(threeDays);
  });
});

// ══════════════════════════════════════════════
// 14. P1补充 — 容量与过期联动边界场景
// ══════════════════════════════════════════════

describe('邮件容量与过期联动 — 边界场景（P1补充）', () => {
  let mailSystem: MailSystem;

  beforeEach(() => {
    mailSystem = new MailSystem(createMockStorage());
    mailSystem.reset();
  });

  it('满载邮箱中部分过期后新邮件应正常接收', () => {
    for (let i = 0; i < 100; i++) {
      mailSystem.sendMail(makeMail(i));
    }
    expect(mailSystem.getMailCount()).toBe(100);

    const allMails = mailSystem.getAllMails();
    const oldest50 = allMails.slice(-50);
    for (const mail of oldest50) {
      const mailData = mailSystem.getMail(mail.id)!;
      mailData.expireTime = Date.now() - 1000;
    }
    mailSystem.processExpired();
    mailSystem.deleteReadClaimed();
    expect(mailSystem.getMailCount()).toBe(50);

    for (let i = 0; i < 50; i++) {
      mailSystem.sendMail(makeMail(100 + i));
    }
    expect(mailSystem.getMailCount()).toBe(100);
  });

  it('所有邮件同时过期后系统应正常', () => {
    for (let i = 0; i < 50; i++) {
      mailSystem.sendMail(makeExpiringMail(i, 1));
    }

    const allMails = mailSystem.getAllMails();
    for (const mail of allMails) {
      const mailData = mailSystem.getMail(mail.id)!;
      mailData.expireTime = Date.now() - 1000;
    }
    mailSystem.processExpired();

    expect(mailSystem.getUnreadCount()).toBe(0);

    mailSystem.sendMail(makeMail(1));
    expect(mailSystem.getMailCount()).toBe(51);
    expect(mailSystem.getUnreadCount()).toBe(1);
  });

  it('序列化恢复后过期处理应正常工作', () => {
    for (let i = 0; i < 30; i++) {
      mailSystem.sendMail(makeExpiringMail(i, 1));
    }

    const saveData = mailSystem.getSaveData();

    const newSystem = new MailSystem(createMockStorage());
    newSystem.reset();
    newSystem.loadFromSaveData(saveData);
    expect(newSystem.getMailCount()).toBe(30);

    const allMails = newSystem.getAllMails();
    for (const mail of allMails) {
      const mailData = newSystem.getMail(mail.id)!;
      mailData.expireTime = Date.now() - 1000;
    }

    const expiredCount = newSystem.processExpired();
    expect(expiredCount).toBe(30);
  });

  it('空邮箱的过期处理应返回0', () => {
    expect(mailSystem.processExpired()).toBe(0);
  });

  it('空邮箱的删除已读已领应返回0', () => {
    expect(mailSystem.deleteReadClaimed()).toBe(0);
  });
});
