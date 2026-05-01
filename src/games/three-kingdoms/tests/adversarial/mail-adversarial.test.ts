/**
 * 邮件模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: MailSystem（邮件发送/接收/已读/删除/批量操作/附件领取/过期清理）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/mail-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailSystem } from '../../engine/mail/MailSystem';
import {
  MAILBOX_CAPACITY,
  MAILS_PER_PAGE,
  MAIL_SAVE_VERSION,
} from '../../shared/mail-types';
import type {
  MailCategory,
  MailStatus,
  MailData,
  MailSendRequest,
  MailFilter,
  MailSaveData,
} from '../../shared/mail-types';
import type { ISystemDeps } from '../../core/types';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (extra?: Partial<ISystemDeps>): ISystemDeps =>
  ({
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
    ...extra,
  } as unknown as ISystemDeps);

const mockDepsWithResource = () => {
  const addResource = vi.fn();
  const deps = mockDeps({
    registry: { register: vi.fn(), get: vi.fn().mockReturnValue({ addResource }), getAll: vi.fn(), has: vi.fn().mockReturnValue(true), unregister: vi.fn() },
  } as unknown as Partial<ISystemDeps>);
  return { deps, addResource };
};

function createMailSystem(): MailSystem {
  const sys = new MailSystem();
  sys.init(mockDeps());
  return sys;
}

/** 不含欢迎邮件 */
function emptySys(): MailSystem { return new MailSystem(); }

const makeReq = (o: Partial<MailSendRequest> = {}): MailSendRequest => ({
  category: 'system', title: '测试邮件', content: '测试内容', sender: '系统', ...o,
});

function sendOne(sys: MailSystem, o: Partial<MailSendRequest> = {}): MailData {
  const mail = sys.sendMail(makeReq(o));
  if (!mail) throw new Error('sendMail returned null');
  return mail;
}

const rewardReq = (atts: Array<{ resourceType: string; amount: number }> = [{ resourceType: 'gold', amount: 100 }]): MailSendRequest =>
  makeReq({ category: 'reward', title: '奖励邮件', content: '恭喜获得奖励', sender: '系统', attachments: atts });

function mockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    clear: vi.fn(() => Object.keys(store).forEach(k => delete store[k])),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

function makeExpiredMail(id: string, status: MailStatus = 'unread', attachments: MailData['attachments'] = []): MailData {
  return { id, category: 'system', title: '过期', content: '内容', sender: '系统', sendTime: Date.now() - 100000, expireTime: Date.now() - 1000, status, isRead: status !== 'unread', attachments };
}

// ══════════════════════════════════════════════
// F-Normal: 正常流程
// ══════════════════════════════════════════════

describe('F-Normal: 邮件系统初始化', () => {
  it('init 后自动发送欢迎邮件', () => {
    const sys = createMailSystem();
    expect(sys.getMailCount()).toBeGreaterThanOrEqual(1);
    const welcome = sys.getAllMails().find(m => m.title.includes('欢迎'));
    expect(welcome).toBeDefined();
    expect(welcome!.attachments.length).toBeGreaterThan(0);
  });

  it('后续邮件 ID 不重复', () => {
    const sys = createMailSystem();
    const ids = new Set(sys.getAllMails().map(m => m.id));
    const m2 = sys.sendMail(makeReq({ title: '第二封' }));
    expect(ids.has(m2!.id)).toBe(false);
  });

  it('多次 init 不重复发送欢迎邮件', () => {
    const sys = new MailSystem();
    sys.init(mockDeps());
    const c1 = sys.getMailCount();
    sys.init(mockDeps());
    expect(sys.getMailCount()).toBe(c1);
  });
});

describe('F-Normal: 邮件发送', () => {
  it('发送系统邮件', () => {
    const mail = sendOne(createMailSystem(), { category: 'system', title: '系统通知' });
    expect(mail.category).toBe('system');
    expect(mail.status).toBe('unread');
    expect(mail.isRead).toBe(false);
  });

  it('发送奖励邮件含附件', () => {
    const mail = sendOne(createMailSystem(), rewardReq());
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].claimed).toBe(false);
  });

  it('发送多附件邮件', () => {
    const mail = sendOne(createMailSystem(), rewardReq([
      { resourceType: 'gold', amount: 500 }, { resourceType: 'grain', amount: 200 }, { resourceType: 'recruitToken', amount: 3 },
    ]));
    expect(mail.attachments).toHaveLength(3);
  });

  it('批量发送', () => {
    const sys = createMailSystem();
    const results = sys.sendBatch([makeReq({ title: 'A' }), makeReq({ title: 'B' }), makeReq({ title: 'C' })]);
    expect(results).toHaveLength(3);
    expect(results.every(r => r !== null)).toBe(true);
  });

  it('发送时间戳正确', () => {
    const before = Date.now();
    const mail = sendOne(createMailSystem());
    expect(mail.sendTime).toBeGreaterThanOrEqual(before);
    expect(mail.sendTime).toBeLessThanOrEqual(Date.now());
  });
});

describe('F-Normal: 邮件查询', () => {
  it('getMails 默认按时间倒序', () => {
    const sys = createMailSystem();
    sendOne(sys, { title: '旧邮件' });
    sendOne(sys, { title: '新邮件' });
    const titles = sys.getMails().filter(m => !m.title.includes('欢迎')).map(m => m.title);
    expect(titles[0]).toBe('新邮件');
  });

  it('按分类查询', () => {
    const sys = createMailSystem();
    sendOne(sys, { category: 'reward', title: '奖励' });
    sendOne(sys, { category: 'social', title: '社交' });
    expect(sys.getByCategory('reward').every(m => m.category === 'reward')).toBe(true);
  });

  it('分页查询', () => {
    const sys = emptySys();
    for (let i = 0; i < 25; i++) sys.sendMail(makeReq({ title: `邮件${i}` }));
    expect(sys.getMails(undefined, 1).length).toBe(MAILS_PER_PAGE);
    expect(sys.getMails(undefined, 2).length).toBe(5);
  });

  it('getUnreadCount 按分类统计', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ category: 'system' }));
    sys.sendMail(makeReq({ category: 'system' }));
    sys.sendMail(makeReq({ category: 'reward' }));
    expect(sys.getUnreadCount()).toBe(3);
    expect(sys.getUnreadCount('system')).toBe(2);
    expect(sys.getUnreadCount('reward')).toBe(1);
  });

  it('query 按条件查询', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ category: 'reward', attachments: [{ resourceType: 'gold', amount: 10 }] }));
    sys.sendMail(makeReq({ category: 'system' }));
    expect(sys.query({ hasAttachments: true }).every(m => m.attachments.length > 0)).toBe(true);
  });

  it('getCategories 返回已有分类', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ category: 'system' }));
    sys.sendMail(makeReq({ category: 'reward' }));
    expect(sys.getCategories()).toContain('system');
    expect(sys.getCategories()).toContain('reward');
  });
});

describe('F-Normal: 已读操作', () => {
  it('标记单封已读', () => {
    const sys = emptySys();
    const mail = sendOne(sys);
    expect(sys.markRead(mail.id)).toBe(true);
    expect(sys.getMail(mail.id)!.isRead).toBe(true);
  });

  it('无附件邮件已读 → read_claimed', () => {
    const sys = emptySys();
    const mail = sendOne(sys, { attachments: undefined });
    sys.markRead(mail.id);
    expect(sys.getMail(mail.id)!.status).toBe('read_claimed');
  });

  it('有附件未领邮件已读 → read_unclaimed', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq());
    sys.markRead(mail.id);
    expect(sys.getMail(mail.id)!.status).toBe('read_unclaimed');
  });

  it('全部标记已读', () => {
    const sys = emptySys();
    const ids = [sendOne(sys), sendOne(sys), sendOne(sys)].map(m => m.id);
    expect(sys.markAllRead()).toBe(3);
    ids.forEach(id => expect(sys.getMail(id)!.isRead).toBe(true));
  });

  it('全部标记已读支持过滤', () => {
    const sys = emptySys();
    sendOne(sys, { category: 'system' });
    sendOne(sys, { category: 'reward' });
    expect(sys.markAllRead({ category: 'system' })).toBe(1);
  });
});

describe('F-Normal: 附件领取', () => {
  it('领取单封附件', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq());
    expect(sys.claimAttachments(mail.id)).toEqual({ gold: 100 });
    expect(sys.getMail(mail.id)!.status).toBe('read_claimed');
  });

  it('领取多附件', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq([{ resourceType: 'gold', amount: 200 }, { resourceType: 'grain', amount: 300 }]));
    expect(sys.claimAttachments(mail.id)).toEqual({ gold: 200, grain: 300 });
  });

  it('重复领取返回空', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq());
    sys.claimAttachments(mail.id);
    expect(sys.claimAttachments(mail.id)).toEqual({});
  });

  it('批量领取附件', () => {
    const sys = emptySys();
    sendOne(sys, rewardReq([{ resourceType: 'gold', amount: 100 }]));
    sendOne(sys, rewardReq([{ resourceType: 'grain', amount: 200 }]));
    const result = sys.claimAllAttachments();
    expect(result.count).toBe(2);
    expect(result.claimedResources).toEqual({ gold: 100, grain: 200 });
  });
});

describe('F-Normal: 删除与过期', () => {
  it('删除已读已领邮件', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq());
    sys.claimAttachments(mail.id);
    expect(sys.deleteMail(mail.id)).toBe(true);
    expect(sys.getMail(mail.id)).toBeUndefined();
  });

  it('deleteReadClaimed 批量删除', () => {
    const sys = emptySys();
    [sendOne(sys, rewardReq()), sendOne(sys, rewardReq())].forEach(m => sys.claimAttachments(m.id));
    expect(sys.deleteReadClaimed()).toBe(2);
  });

  it('processExpired 标记过期邮件', () => {
    const sys = emptySys();
    sys.addMail(makeExpiredMail('mail_exp_1'));
    expect(sys.processExpired()).toBe(1);
    expect(sys.getMail('mail_exp_1')!.status).toBe('expired');
  });

  it('未过期邮件不受影响', () => {
    const sys = emptySys();
    const mail = sendOne(sys, { retainSeconds: 86400 });
    expect(sys.processExpired()).toBe(0);
    expect(sys.getMail(mail.id)!.status).toBe('unread');
  });
});

// ══════════════════════════════════════════════
// F-Error: 错误路径
// ══════════════════════════════════════════════

describe('F-Error: 无效 ID 操作', () => {
  it('不存在/空字符串 ID 操作安全', () => {
    const sys = createMailSystem();
    expect(sys.markRead('mail_nonexistent')).toBe(false);
    expect(sys.claimAttachments('mail_nonexistent')).toEqual({});
    expect(sys.deleteMail('mail_nonexistent')).toBe(false);
    expect(sys.getMail('mail_nonexistent')).toBeUndefined();
    expect(sys.markRead('')).toBe(false);
    expect(sys.claimAttachments('')).toEqual({});
    expect(sys.deleteMail('')).toBe(false);
    expect(sys.getMail('')).toBeUndefined();
  });
});

describe('F-Error: 状态限制', () => {
  it('不能删除未读邮件', () => {
    const sys = emptySys();
    const mail = sendOne(sys);
    expect(sys.deleteMail(mail.id)).toBe(false);
  });

  it('不能删除已读未领邮件', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq());
    sys.markRead(mail.id);
    expect(sys.deleteMail(mail.id)).toBe(false);
  });

  it('不能对已过期邮件标记已读', () => {
    const sys = emptySys();
    sys.addMail(makeExpiredMail('mail_exp', 'expired'));
    expect(sys.markRead('mail_exp')).toBe(false);
  });

  it('不能领取已过期邮件附件', () => {
    const sys = emptySys();
    sys.addMail({ ...makeExpiredMail('mail_exp2', 'expired'), attachments: [{ id: 'att_1', resourceType: 'gold', amount: 100, claimed: false }] });
    expect(sys.claimAttachments('mail_exp2')).toEqual({});
  });
});

describe('F-Error: 邮箱满', () => {
  it('邮箱满时发送返回 null', () => {
    const sys = emptySys();
    for (let i = 0; i < MAILBOX_CAPACITY; i++) sys.sendMail(makeReq({ title: `邮件${i}` }));
    expect(sys.sendMail(makeReq({ title: '溢出' }))).toBeNull();
  });

  it('批量发送部分成功部分失败', () => {
    const sys = emptySys();
    for (let i = 0; i < MAILBOX_CAPACITY - 1; i++) sys.sendMail(makeReq({ title: `邮件${i}` }));
    const results = sys.sendBatch([makeReq({ title: '最后1封' }), makeReq({ title: '溢出' })]);
    expect(results[0]).not.toBeNull();
    expect(results[1]).toBeNull();
  });
});

describe('F-Error: 无效模板与存档', () => {
  it('不存在的模板返回 null', () => {
    expect(createMailSystem().sendTemplateMail('nonexistent_template')).toBeNull();
  });

  it('null/undefined 存档不崩溃', () => {
    const sys = createMailSystem();
    expect(() => sys.loadFromSaveData(null as unknown as MailSaveData)).not.toThrow();
    expect(() => sys.loadFromSaveData(undefined as unknown as MailSaveData)).not.toThrow();
  });

  it('版本不匹配存档不崩溃', () => {
    const sys = createMailSystem();
    expect(() => sys.loadFromSaveData({ mails: [], nextId: 1, version: 999 } as MailSaveData)).not.toThrow();
  });
});

// ══════════════════════════════════════════════
// F-Boundary: 边界条件
// ══════════════════════════════════════════════

describe('F-Boundary: NaN / Infinity / 负数 / 零附件', () => {
  it('NaN 金额附件被过滤', () => {
    const mail = sendOne(emptySys(), { category: 'reward', attachments: [{ resourceType: 'gold', amount: NaN }, { resourceType: 'grain', amount: 100 }] });
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].resourceType).toBe('grain');
  });

  it('Infinity / -Infinity 附件被过滤', () => {
    const mail = sendOne(emptySys(), { category: 'reward', attachments: [{ resourceType: 'gold', amount: Infinity }, { resourceType: 'grain', amount: -Infinity }] });
    expect(mail.attachments).toHaveLength(0);
  });

  it('负数和零金额附件被过滤', () => {
    const mail = sendOne(emptySys(), { category: 'reward', attachments: [{ resourceType: 'gold', amount: -50 }, { resourceType: 'wood', amount: 0 }] });
    expect(mail.attachments).toHaveLength(0);
  });

  it('混合有效和无效附件只保留有效', () => {
    const mail = sendOne(emptySys(), { category: 'reward', attachments: [
      { resourceType: 'gold', amount: NaN }, { resourceType: 'grain', amount: 100 },
      { resourceType: 'wood', amount: 0 }, { resourceType: 'iron', amount: 50 }, { resourceType: 'stone', amount: -10 },
    ] });
    expect(mail.attachments).toHaveLength(2);
    expect(mail.attachments.map(a => a.resourceType)).toEqual(['grain', 'iron']);
  });
});

describe('F-Boundary: 空标题/超长内容', () => {
  it('空标题和内容可发送', () => {
    const sys = emptySys();
    expect(sendOne(sys, { title: '' }).title).toBe('');
    expect(sendOne(sys, { content: '' }).content).toBe('');
  });

  it('超长标题和内容可发送', () => {
    const sys = emptySys();
    expect(sendOne(sys, { title: 'A'.repeat(10000) }).title.length).toBe(10000);
    expect(sendOne(sys, { content: 'B'.repeat(100000) }).content.length).toBe(100000);
  });
});

describe('F-Boundary: 超大附件数量', () => {
  it('大量附件可正常发送和领取', () => {
    const sys = emptySys();
    const atts = Array.from({ length: 50 }, (_, i) => ({ resourceType: `res_${i}`, amount: i + 1 }));
    const mail = sendOne(sys, { category: 'reward', attachments: atts });
    expect(mail.attachments).toHaveLength(50);
    const claimed = sys.claimAttachments(mail.id);
    expect(Object.keys(claimed)).toHaveLength(50);
  });
});

describe('F-Boundary: 过期时间边界', () => {
  it('expireTime 恰好等于当前时间 → 被标记过期', () => {
    const sys = emptySys();
    const now = Date.now();
    sys.addMail({ id: 'mail_bd', category: 'system', title: '边界', content: '', sender: '系统', sendTime: now - 1000, expireTime: now, status: 'unread', isRead: false, attachments: [] });
    expect(sys.processExpired()).toBe(1);
  });

  it('expireTime 为 null → 永不过期', () => {
    const sys = emptySys();
    sys.addMail({ id: 'mail_ne', category: 'system', title: '永不过期', content: '', sender: '系统', sendTime: 0, expireTime: null, status: 'unread', isRead: false, attachments: [] });
    expect(sys.processExpired()).toBe(0);
  });

  it('retainSeconds 为 null → expireTime 为 null', () => {
    const mail = emptySys().sendMail(makeReq({ retainSeconds: null }));
    expect(mail!.expireTime).toBeNull();
  });
});

describe('F-Boundary: 分页边界', () => {
  it('空邮箱/第0页/负数页码返回空', () => {
    const sys = emptySys();
    expect(sys.getMails(undefined, 1)).toEqual([]);
    sys.sendMail(makeReq());
    expect(sys.getMails(undefined, 0)).toEqual([]);
    expect(sys.getMails(undefined, -1)).toEqual([]);
  });
});

// ══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ══════════════════════════════════════════════

describe('F-Cross: 邮件 → 资源系统', () => {
  it('领取附件时调用 resource.addResource', () => {
    const { deps, addResource } = mockDepsWithResource();
    const sys = new MailSystem(); sys.init(deps);
    const mail = sys.sendMail(rewardReq([{ resourceType: 'gold', amount: 500 }]));
    sys.claimAttachments(mail!.id);
    expect(addResource).toHaveBeenCalledWith('gold', 500);
  });

  it('批量领取时每封分别调用 addResource', () => {
    const { deps, addResource } = mockDepsWithResource();
    const sys = new MailSystem(); sys.init(deps);
    sys.sendMail(rewardReq([{ resourceType: 'gold', amount: 100 }]));
    sys.sendMail(rewardReq([{ resourceType: 'grain', amount: 200 }]));
    sys.claimAllAttachments();
    expect(addResource).toHaveBeenCalledWith('gold', 100);
    expect(addResource).toHaveBeenCalledWith('grain', 200);
  });

  it('资源系统不存在时静默跳过', () => {
    const deps = mockDeps({ registry: { get: vi.fn().mockReturnValue(undefined), has: vi.fn().mockReturnValue(false), register: vi.fn(), getAll: vi.fn(), unregister: vi.fn() } } as unknown as Partial<ISystemDeps>);
    const sys = new MailSystem(); sys.init(deps);
    const mail = sys.sendMail(rewardReq());
    expect(() => sys.claimAttachments(mail!.id)).not.toThrow();
  });
});

describe('F-Cross: 邮件 → 奖励 → 资源完整链路', () => {
  it('发送 → 已读 → 领取 → 资源到账', () => {
    const { deps, addResource } = mockDepsWithResource();
    const sys = new MailSystem(); sys.init(deps);
    const mail = sys.sendMail(rewardReq([{ resourceType: 'gold', amount: 1000 }, { resourceType: 'recruitToken', amount: 5 }]));
    expect(mail!.status).toBe('unread');
    sys.markRead(mail!.id);
    expect(sys.getMail(mail!.id)!.status).toBe('read_unclaimed');
    const claimed = sys.claimAttachments(mail!.id);
    expect(claimed).toEqual({ gold: 1000, recruitToken: 5 });
    expect(sys.getMail(mail!.id)!.status).toBe('read_claimed');
    expect(addResource).toHaveBeenCalledWith('gold', 1000);
    expect(addResource).toHaveBeenCalledWith('recruitToken', 5);
  });

  it('完整生命周期后删除邮件', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq());
    sys.markRead(mail.id);
    sys.claimAttachments(mail.id);
    expect(sys.deleteMail(mail.id)).toBe(true);
  });
});

describe('F-Cross: 过期 → 删除链路', () => {
  it('过期邮件可被单独删除', () => {
    const sys = emptySys();
    sys.addMail(makeExpiredMail('mail_exp_del', 'expired'));
    expect(sys.deleteMail('mail_exp_del')).toBe(true);
  });

  it('deleteReadClaimed 同时删除已过期邮件', () => {
    const sys = emptySys();
    const m = sendOne(sys, rewardReq());
    sys.claimAttachments(m.id);
    sys.addMail(makeExpiredMail('mail_exp_batch', 'expired'));
    expect(sys.deleteReadClaimed()).toBe(2);
  });
});

// ══════════════════════════════════════════════
// F-Lifecycle: 序列化 / 反序列化 / 持久化
// ══════════════════════════════════════════════

describe('F-Lifecycle: 序列化与反序列化', () => {
  it('getSaveData 返回完整数据', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ title: 'A' }));
    sys.sendMail(makeReq({ title: 'B' }));
    const save = sys.getSaveData();
    expect(save.version).toBe(MAIL_SAVE_VERSION);
    expect(save.mails).toHaveLength(2);
    expect(save.nextId).toBe(3);
  });

  it('序列化 → 反序列化数据一致', () => {
    const sys = emptySys();
    const mail = sendOne(sys, rewardReq());
    sys.markRead(mail.id);
    sys.claimAttachments(mail.id);
    const save = sys.getSaveData();
    const sys2 = emptySys();
    sys2.loadFromSaveData(save);
    const restored = sys2.getMail(mail.id)!;
    expect(restored.title).toBe(mail.title);
    expect(restored.status).toBe('read_claimed');
    expect(restored.attachments[0].claimed).toBe(true);
  });

  it('反序列化后可继续发送新邮件', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ title: '旧' }));
    const sys2 = emptySys();
    sys2.loadFromSaveData(sys.getSaveData());
    const newMail = sys2.sendMail(makeReq({ title: '新' }));
    expect(newMail).not.toBeNull();
    expect(newMail!.id).not.toBe(sys.getSaveData().mails[0].id);
  });

  it('空数据序列化/反序列化', () => {
    const save = emptySys().getSaveData();
    const sys2 = emptySys();
    sys2.loadFromSaveData(save);
    expect(sys2.getMailCount()).toBe(0);
  });
});

describe('F-Lifecycle: Storage 持久化', () => {
  it('发送后自动持久化', () => {
    const storage = mockStorage();
    const sys = new MailSystem(storage); sys.init(mockDeps());
    sys.sendMail(makeReq());
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('从 Storage 恢复邮件', () => {
    const storage = mockStorage();
    const sys1 = new MailSystem(storage); sys1.init(mockDeps());
    sys1.sendMail(makeReq({ title: '持久化测试' }));
    const sys2 = new MailSystem(storage); sys2.init(mockDeps());
    expect(sys2.getAllMails().find(m => m.title === '持久化测试')).toBeDefined();
  });

  it('reset 清除 Storage', () => {
    const storage = mockStorage();
    const sys = new MailSystem(storage); sys.init(mockDeps());
    sys.sendMail(makeReq());
    sys.reset();
    expect(sys.getMailCount()).toBe(0);
    expect(storage.removeItem).toHaveBeenCalled();
  });
});

describe('F-Lifecycle: addMail / sendCustomMail / 模板', () => {
  it('addMail 直接插入后可操作', () => {
    const sys = emptySys();
    sys.addMail({ id: 'mail_d', category: 'reward', title: '直接', content: '', sender: '系统', sendTime: Date.now(), expireTime: null, status: 'unread', isRead: false, attachments: [{ id: 'att_d', resourceType: 'gold', amount: 50, claimed: false }] });
    sys.markRead('mail_d');
    expect(sys.claimAttachments('mail_d')).toEqual({ gold: 50 });
  });

  it('sendCustomMail 带附件和保留时长', () => {
    const sys = emptySys();
    const mail = sys.sendCustomMail('social', '好友申请', '请求', '玩家B', { attachments: [{ resourceType: 'gold', amount: 10 }], retainSeconds: 86400 });
    expect(mail!.category).toBe('social');
    expect(mail!.attachments).toHaveLength(1);
    expect(mail!.expireTime).toBeGreaterThan(Date.now());
  });

  it('内置模板 offline_reward / building_complete 发送', () => {
    const sys = createMailSystem();
    const m1 = sys.sendTemplateMail('offline_reward', { hours: 8, grain: 500, gold: 200, troops: 100, mandate: 10 });
    expect(m1!.content).toContain('8');
    const m2 = sys.sendTemplateMail('building_complete', { buildingName: '铁匠铺' });
    expect(m2!.content).toContain('铁匠铺');
  });

  it('模板邮件可带附件', () => {
    const mail = createMailSystem().sendTemplateMail('offline_reward', {}, [{ resourceType: 'gold', amount: 100 }]);
    expect(mail!.attachments).toHaveLength(1);
  });
});

describe('F-Lifecycle: 辅助方法', () => {
  it('getUnreadCountByCategory 正确统计', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ category: 'system' }));
    sys.sendMail(makeReq({ category: 'system' }));
    sys.sendMail(makeReq({ category: 'reward' }));
    const counts = sys.getUnreadCountByCategory();
    expect(counts.system).toBe(2);
    expect(counts.reward).toBe(1);
  });

  it('已读邮件不计入未读数', () => {
    const sys = emptySys();
    const m1 = sendOne(sys, { category: 'system' });
    sendOne(sys, { category: 'system' });
    sys.markRead(m1.id);
    expect(sys.getUnreadCountByCategory().system).toBe(1);
  });

  it('getState 返回 mails 和 nextId', () => {
    const sys = emptySys();
    sys.sendMail(makeReq());
    const state = sys.getState() as { mails: unknown; nextId: number };
    expect(state.nextId).toBe(2);
    expect(state.mails).toBeDefined();
  });
});

describe('F-Lifecycle: 过滤条件组合', () => {
  it('按分类+状态过滤', () => {
    const sys = emptySys();
    sendOne(sys, { category: 'reward', attachments: [{ resourceType: 'gold', amount: 10 }] });
    sendOne(sys, { category: 'system' });
    const mails = sys.getMails({ category: 'reward', status: 'unread' });
    expect(mails).toHaveLength(1);
  });

  it('按附件过滤', () => {
    const sys = emptySys();
    sendOne(sys, { attachments: [{ resourceType: 'gold', amount: 10 }] });
    sendOne(sys, { attachments: undefined });
    expect(sys.getMails({ hasAttachment: true })).toHaveLength(1);
  });

  it('category=all 返回全部', () => {
    const sys = emptySys();
    sendOne(sys, { category: 'system' });
    sendOne(sys, { category: 'reward' });
    expect(sys.getMails({ category: 'all' })).toHaveLength(2);
  });
});

describe('F-Lifecycle: restoreSaveData 数据校验', () => {
  it('mails 含 null 条目时跳过', () => {
    const sys = emptySys();
    sys.loadFromSaveData({ mails: [null, undefined, { id: 'mail_ok', category: 'system', title: 'OK', content: 'ok', sender: 's', sendTime: 0, expireTime: null, status: 'unread' as MailStatus, isRead: false, attachments: [] }], nextId: 2, version: MAIL_SAVE_VERSION } as unknown as MailSaveData);
    expect(sys.getMailCount()).toBe(1);
  });

  it('nextId 为 NaN 时拒绝恢复', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ title: '原有' }));
    sys.loadFromSaveData({ mails: [], nextId: NaN, version: MAIL_SAVE_VERSION } as MailSaveData);
    expect(sys.getMailCount()).toBe(1);
  });

  it('mails 不是数组时拒绝恢复', () => {
    const sys = emptySys();
    sys.sendMail(makeReq({ title: '原有' }));
    sys.loadFromSaveData({ mails: 'not-array' as unknown as MailData[], nextId: 1, version: MAIL_SAVE_VERSION } as MailSaveData);
    expect(sys.getMailCount()).toBe(1);
  });
});
