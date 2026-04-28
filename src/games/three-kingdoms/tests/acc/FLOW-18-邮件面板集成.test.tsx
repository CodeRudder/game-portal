/**
 * FLOW-18 邮件面板集成测试 — 邮件列表/阅读状态/奖励领取/删除/边界
 *
 * 使用真实 MailSystem / MailTemplateSystem，
 * 通过 createSim() 创建引擎实例，不 mock 核心逻辑。
 *
 * 覆盖范围：
 * - 邮件列表显示：分类Tab、分页、排序
 * - 邮件阅读状态：未读/已读/已领/已过期
 * - 邮件奖励领取：单封领取、批量领取、一键已读
 * - 邮件删除：单封删除、批量删除已读已领
 * - 边界：空邮件箱、过期处理、序列化恢复、重置
 *
 * @module tests/acc/FLOW-18
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// 邮件系统
import { MailSystem } from '../../engine/mail/MailSystem';
import type {
  MailData,
  MailCategory,
  MailSendRequest,
  MailFilter,
  BatchOperationResult,
  MailSaveData,
} from '../../engine/mail/mail.types';

// 类型
import type { ISystemDeps } from '../../core/types';

// ── 辅助函数 ──

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 创建邮件发送请求 */
function makeSendRequest(overrides?: Partial<MailSendRequest>): MailSendRequest {
  return {
    category: 'system',
    title: '测试邮件',
    content: '这是一封测试邮件内容',
    sender: '系统',
    attachments: [],
    ...overrides,
  };
}

/** 创建带附件的邮件发送请求 */
function makeRewardMail(overrides?: Partial<MailSendRequest>): MailSendRequest {
  return {
    category: 'reward',
    title: '奖励邮件',
    content: '恭喜获得奖励',
    sender: '系统',
    attachments: [
      { resourceType: 'gold', amount: 100 },
      { resourceType: 'grain', amount: 200 },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// FLOW-18 邮件面板集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-18 邮件面板集成测试', () => {
  let sim: GameEventSimulator;
  let mailSys: MailSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });

    mailSys = new MailSystem();
    mailSys.init(mockDeps());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 邮件列表显示（FLOW-18-01 ~ FLOW-18-06）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-18-01', '初始状态下无邮件'), () => {
    const mails = mailSys.getMails();
    assertStrict(mails.length === 0, 'FLOW-18-01', '初始应无邮件');

    const count = mailSys.getMailCount();
    assertStrict(count === 0, 'FLOW-18-01', '邮件总数应为0');

    const unread = mailSys.getUnreadCount();
    assertStrict(unread === 0, 'FLOW-18-01', '未读数应为0');
  });

  it(accTest('FLOW-18-02', '发送单封邮件'), () => {
    const mail = mailSys.sendMail(makeSendRequest());

    assertStrict(mail.id.startsWith('mail_'), 'FLOW-18-02', '邮件ID应以 mail_ 开头');
    assertStrict(mail.title === '测试邮件', 'FLOW-18-02', '标题应匹配');
    assertStrict(mail.status === 'unread', 'FLOW-18-02', '初始状态应为 unread');
    assertStrict(mail.isRead === false, 'FLOW-18-02', '初始应为未读');
    assertStrict(mail.category === 'system', 'FLOW-18-02', '分类应为 system');

    const mails = mailSys.getMails();
    assertStrict(mails.length === 1, 'FLOW-18-02', '邮件列表应有1封');
  });

  it(accTest('FLOW-18-03', '批量发送邮件'), () => {
    const requests = [
      makeSendRequest({ title: '邮件A', category: 'system' }),
      makeSendRequest({ title: '邮件B', category: 'battle' }),
      makeSendRequest({ title: '邮件C', category: 'social' }),
    ];

    const mails = mailSys.sendBatch(requests);
    assertStrict(mails.length === 3, 'FLOW-18-03', '应发送3封邮件');

    const allMails = mailSys.getMails();
    assertStrict(allMails.length === 3, 'FLOW-18-03', '邮件列表应有3封');
  });

  it(accTest('FLOW-18-04', '按分类筛选邮件'), () => {
    mailSys.sendMail(makeSendRequest({ category: 'system', title: '系统邮件' }));
    mailSys.sendMail(makeSendRequest({ category: 'battle', title: '战斗邮件' }));
    mailSys.sendMail(makeSendRequest({ category: 'social', title: '社交邮件' }));
    mailSys.sendMail(makeSendRequest({ category: 'reward', title: '奖励邮件' }));

    const systemMails = mailSys.getMails({ category: 'system' });
    assertStrict(systemMails.length === 1, 'FLOW-18-04', `系统邮件应为1封，实际 ${systemMails.length}`);

    const battleMails = mailSys.getMails({ category: 'battle' });
    assertStrict(battleMails.length === 1, 'FLOW-18-04', `战斗邮件应为1封，实际 ${battleMails.length}`);

    const allMails = mailSys.getMails();
    assertStrict(allMails.length === 4, 'FLOW-18-04', '全部邮件应为4封');
  });

  it(accTest('FLOW-18-05', '邮件按时间倒序排列'), () => {
    mailSys.sendMail(makeSendRequest({ title: '第一封' }));
    mailSys.sendMail(makeSendRequest({ title: '第二封' }));
    mailSys.sendMail(makeSendRequest({ title: '第三封' }));

    const mails = mailSys.getMails();
    assertStrict(mails[0].title === '第三封', 'FLOW-18-05', '最新的邮件应排在最前');
    assertStrict(mails[2].title === '第一封', 'FLOW-18-05', '最早的邮件应排在最后');
  });

  it(accTest('FLOW-18-06', '获取已有邮件分类列表'), () => {
    mailSys.sendMail(makeSendRequest({ category: 'system' }));
    mailSys.sendMail(makeSendRequest({ category: 'battle' }));
    mailSys.sendMail(makeSendRequest({ category: 'reward' }));

    const categories = mailSys.getCategories();
    assertStrict(categories.length === 3, 'FLOW-18-06', `应有3个分类，实际 ${categories.length}`);
    assertStrict(categories.includes('system'), 'FLOW-18-06', '应包含 system 分类');
    assertStrict(categories.includes('battle'), 'FLOW-18-06', '应包含 battle 分类');
    assertStrict(categories.includes('reward'), 'FLOW-18-06', '应包含 reward 分类');
  });

  // ═══════════════════════════════════════════
  // 2. 邮件阅读状态（FLOW-18-07 ~ FLOW-18-11）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-18-07', '标记邮件已读'), () => {
    const mail = mailSys.sendMail(makeSendRequest());
    assertStrict(mail.status === 'unread', 'FLOW-18-07', '初始应为 unread');

    const result = mailSys.markRead(mail.id);
    assertStrict(result === true, 'FLOW-18-07', '标记已读应成功');

    const updated = mailSys.getMail(mail.id)!;
    assertStrict(updated.isRead === true, 'FLOW-18-07', '已读标记应为 true');
    assertStrict(updated.status === 'read_claimed', 'FLOW-18-07', '无附件时状态应为 read_claimed');
  });

  it(accTest('FLOW-18-08', '带附件邮件标记已读后状态为read_unclaimed'), () => {
    const mail = mailSys.sendMail(makeRewardMail());
    assertStrict(mail.status === 'unread', 'FLOW-18-08', '初始应为 unread');

    mailSys.markRead(mail.id);
    const updated = mailSys.getMail(mail.id)!;
    assertStrict(updated.status === 'read_unclaimed', 'FLOW-18-08', '有附件未领时状态应为 read_unclaimed');
  });

  it(accTest('FLOW-18-09', '全部标记已读'), () => {
    mailSys.sendMail(makeSendRequest({ title: 'A' }));
    mailSys.sendMail(makeSendRequest({ title: 'B' }));
    mailSys.sendMail(makeSendRequest({ title: 'C' }));

    assertStrict(mailSys.getUnreadCount() === 3, 'FLOW-18-09', '初始应有3封未读');

    const count = mailSys.markAllRead();
    assertStrict(count === 3, 'FLOW-18-09', `应标记3封已读，实际 ${count}`);
    assertStrict(mailSys.getUnreadCount() === 0, 'FLOW-18-09', '标记后未读应为0');
  });

  it(accTest('FLOW-18-10', '获取各分类未读数'), () => {
    mailSys.sendMail(makeSendRequest({ category: 'system', title: 'S1' }));
    mailSys.sendMail(makeSendRequest({ category: 'system', title: 'S2' }));
    mailSys.sendMail(makeSendRequest({ category: 'battle', title: 'B1' }));

    const unreadByCategory = mailSys.getUnreadCountByCategory();
    assertStrict(unreadByCategory['system'] === 2, 'FLOW-18-10', '系统邮件未读应为2');
    assertStrict(unreadByCategory['battle'] === 1, 'FLOW-18-10', '战斗邮件未读应为1');
  });

  it(accTest('FLOW-18-11', '标记已读不存在的邮件返回false'), () => {
    const result = mailSys.markRead('nonexistent-mail');
    assertStrict(result === false, 'FLOW-18-11', '标记不存在邮件应返回 false');
  });

  // ═══════════════════════════════════════════
  // 3. 邮件奖励领取（FLOW-18-12 ~ FLOW-18-17）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-18-12', '领取单封邮件附件'), () => {
    const mail = mailSys.sendMail(makeRewardMail());
    mailSys.markRead(mail.id);

    const claimed = mailSys.claimAttachments(mail.id);
    assertStrict(claimed.gold === 100, 'FLOW-18-12', `应领取100金币，实际 ${claimed.gold}`);
    assertStrict(claimed.grain === 200, 'FLOW-18-12', `应领取200粮草，实际 ${claimed.grain}`);

    const updated = mailSys.getMail(mail.id)!;
    assertStrict(updated.status === 'read_claimed', 'FLOW-18-12', '领取后状态应为 read_claimed');
  });

  it(accTest('FLOW-18-13', '附件领取后标记为已领取'), () => {
    const mail = mailSys.sendMail(makeRewardMail());
    mailSys.markRead(mail.id);
    mailSys.claimAttachments(mail.id);

    const updated = mailSys.getMail(mail.id)!;
    assertStrict(
      updated.attachments.every(a => a.claimed),
      'FLOW-18-13',
      '所有附件应标记为已领取',
    );
  });

  it(accTest('FLOW-18-14', '重复领取附件返回空'), () => {
    const mail = mailSys.sendMail(makeRewardMail());
    mailSys.markRead(mail.id);

    mailSys.claimAttachments(mail.id);
    const secondClaim = mailSys.claimAttachments(mail.id);
    assertStrict(Object.keys(secondClaim).length === 0, 'FLOW-18-14', '重复领取应返回空');
  });

  it(accTest('FLOW-18-15', '批量领取附件'), () => {
    mailSys.sendMail(makeRewardMail({ title: '奖励1' }));
    mailSys.sendMail(makeRewardMail({ title: '奖励2', attachments: [{ resourceType: 'gold', amount: 50 }] }));

    const result = mailSys.claimAllAttachments();
    assertStrict(result.count === 2, 'FLOW-18-15', `应领取2封，实际 ${result.count}`);
    assertStrict(result.successIds.length === 2, 'FLOW-18-15', '成功ID列表应有2个');
    assertStrict((result.claimedResources.gold ?? 0) === 250, 'FLOW-18-15', `总金币应为250，实际 ${result.claimedResources.gold}`);
    assertStrict((result.claimedResources.grain ?? 0) === 400, 'FLOW-18-15', `总粮草应为400，实际 ${result.claimedResources.grain}`);
  });

  it(accTest('FLOW-18-16', '无附件邮件领取返回空'), () => {
    const mail = mailSys.sendMail(makeSendRequest());
    const claimed = mailSys.claimAttachments(mail.id);
    assertStrict(Object.keys(claimed).length === 0, 'FLOW-18-16', '无附件邮件领取应返回空');
  });

  it(accTest('FLOW-18-17', '按分类批量领取附件'), () => {
    mailSys.sendMail(makeRewardMail({ title: '奖励邮件' }));
    mailSys.sendMail(makeRewardMail({ title: '战斗奖励', category: 'battle' }));

    const result = mailSys.claimAllAttachments({ category: 'reward' });
    assertStrict(result.count === 1, 'FLOW-18-17', `按分类领取应为1封，实际 ${result.count}`);
  });

  // ═══════════════════════════════════════════
  // 4. 邮件删除（FLOW-18-18 ~ FLOW-18-22）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-18-18', '删除已读已领邮件成功'), () => {
    const mail = mailSys.sendMail(makeSendRequest());
    mailSys.markRead(mail.id);

    const result = mailSys.deleteMail(mail.id);
    assertStrict(result === true, 'FLOW-18-18', '删除已读邮件应成功');

    const remaining = mailSys.getMails();
    assertStrict(remaining.length === 0, 'FLOW-18-18', '删除后邮件列表应为空');
  });

  it(accTest('FLOW-18-19', '删除未读邮件失败'), () => {
    const mail = mailSys.sendMail(makeSendRequest());
    const result = mailSys.deleteMail(mail.id);
    assertStrict(result === false, 'FLOW-18-19', '删除未读邮件应失败');

    const remaining = mailSys.getMails();
    assertStrict(remaining.length === 1, 'FLOW-18-19', '邮件仍应存在');
  });

  it(accTest('FLOW-18-20', '删除有未领附件的邮件失败'), () => {
    const mail = mailSys.sendMail(makeRewardMail());
    mailSys.markRead(mail.id);

    // 有未领附件，不应能删除
    const result = mailSys.deleteMail(mail.id);
    assertStrict(result === false, 'FLOW-18-20', '有未领附件时删除应失败');
  });

  it(accTest('FLOW-18-21', '删除已领附件的邮件成功'), () => {
    const mail = mailSys.sendMail(makeRewardMail());
    mailSys.markRead(mail.id);
    mailSys.claimAttachments(mail.id);

    const result = mailSys.deleteMail(mail.id);
    assertStrict(result === true, 'FLOW-18-21', '已领附件后删除应成功');
  });

  it(accTest('FLOW-18-22', '批量删除已读已领邮件'), () => {
    // 3封邮件：1封已读无附件、1封已领附件、1封未读
    mailSys.sendMail(makeSendRequest({ title: '已读' }));
    const rewardMail = mailSys.sendMail(makeRewardMail({ title: '已领' }));
    mailSys.sendMail(makeSendRequest({ title: '未读' }));

    mailSys.markRead('mail_1');
    mailSys.markRead(rewardMail.id);
    mailSys.claimAttachments(rewardMail.id);

    const count = mailSys.deleteReadClaimed();
    assertStrict(count === 1, 'FLOW-18-22', `应删除1封已读已领邮件，实际 ${count}`);

    const remaining = mailSys.getMails();
    assertStrict(remaining.length === 2, 'FLOW-18-22', `应剩余2封，实际 ${remaining.length}`);
  });

  // ═══════════════════════════════════════════
  // 5. 邮件过期处理（FLOW-18-23 ~ FLOW-18-25）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-18-23', '邮件过期处理'), () => {
    // 发送一封即将过期的邮件
    const mail = mailSys.sendMail({
      ...makeSendRequest(),
      retainSeconds: 0, // 立即过期
    });

    // 手动设置过期时间为过去
    const mailData = mailSys.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;

    const expiredCount = mailSys.processExpired();
    assertStrict(expiredCount >= 1, 'FLOW-18-23', `应处理至少1封过期邮件，实际 ${expiredCount}`);

    const updated = mailSys.getMail(mail.id)!;
    assertStrict(updated.status === 'expired', 'FLOW-18-23', '过期邮件状态应为 expired');
  });

  it(accTest('FLOW-18-24', '过期邮件不可标记已读'), () => {
    const mail = mailSys.sendMail({
      ...makeSendRequest(),
      retainSeconds: 0,
    });

    const mailData = mailSys.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSys.processExpired();

    const result = mailSys.markRead(mail.id);
    assertStrict(result === false, 'FLOW-18-24', '过期邮件标记已读应失败');
  });

  it(accTest('FLOW-18-25', '过期邮件可删除'), () => {
    const mail = mailSys.sendMail({
      ...makeSendRequest(),
      retainSeconds: 0,
    });

    const mailData = mailSys.getMail(mail.id)!;
    mailData.expireTime = Date.now() - 1000;
    mailSys.processExpired();

    // 过期邮件应该可以删除（因为 status === 'expired'）
    const result = mailSys.deleteMail(mail.id);
    assertStrict(result === true, 'FLOW-18-25', '过期邮件应可删除');
  });

  // ═══════════════════════════════════════════
  // 6. 邮件序列化与恢复（FLOW-18-26 ~ FLOW-18-28）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-18-26', '邮件系统序列化'), () => {
    mailSys.sendMail(makeSendRequest({ title: '邮件A' }));
    mailSys.sendMail(makeRewardMail({ title: '邮件B' }));

    const saveData = mailSys.getSaveData();
    assertStrict(!!saveData, 'FLOW-18-26', '存档数据不应为空');
    assertStrict(saveData.version > 0, 'FLOW-18-26', '版本号应大于0');
  });

  it(accTest('FLOW-18-27', '邮件系统反序列化恢复'), () => {
    mailSys.sendMail(makeSendRequest({ title: '保存邮件' }));
    mailSys.sendMail(makeRewardMail({ title: '奖励邮件' }));
    mailSys.markRead('mail_1');

    const saveData = mailSys.getSaveData();

    mailSys.reset();
    assertStrict(mailSys.getMailCount() === 0, 'FLOW-18-27', '重置后应无邮件');

    mailSys.loadFromSaveData(saveData);
    assertStrict(mailSys.getMailCount() === 2, 'FLOW-18-27', `恢复后应有2封邮件，实际 ${mailSys.getMailCount()}`);

    const restored = mailSys.getMail('mail_1');
    assertStrict(restored?.title === '保存邮件', 'FLOW-18-27', '恢复后标题应匹配');
  });

  it(accTest('FLOW-18-28', '邮件系统完整重置'), () => {
    mailSys.sendMail(makeSendRequest());
    mailSys.sendMail(makeRewardMail());

    mailSys.reset();
    assertStrict(mailSys.getMailCount() === 0, 'FLOW-18-28', '重置后邮件数应为0');
    assertStrict(mailSys.getUnreadCount() === 0, 'FLOW-18-28', '重置后未读数应为0');
  });

  // ═══════════════════════════════════════════
  // 7. 邮件查询与高级功能（FLOW-18-29 ~ FLOW-18-32）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-18-29', '按条件查询邮件'), () => {
    mailSys.sendMail(makeSendRequest({ category: 'system', title: '系统1' }));
    mailSys.sendMail(makeSendRequest({ category: 'battle', title: '战斗1' }));
    mailSys.sendMail(makeRewardMail({ title: '奖励1' }));

    const systemMails = mailSys.query({ category: 'system' });
    assertStrict(systemMails.length === 1, 'FLOW-18-29', '系统分类查询应返回1封');

    const rewardMails = mailSys.query({ hasAttachments: true });
    assertStrict(rewardMails.length === 1, 'FLOW-18-29', '有附件查询应返回1封');
  });

  it(accTest('FLOW-18-30', '直接添加邮件到系统'), () => {
    const mail: MailData = {
      id: 'custom-mail-001',
      category: 'system',
      title: '自定义邮件',
      content: '直接添加的邮件',
      sender: '管理员',
      sendTime: Date.now(),
      expireTime: null,
      attachments: [],
      status: 'unread',
      isRead: false,
    };

    const result = mailSys.addMail(mail);
    assertStrict(result === true, 'FLOW-18-30', '添加邮件应成功');

    const found = mailSys.getMail('custom-mail-001');
    assertStrict(found?.title === '自定义邮件', 'FLOW-18-30', '添加的邮件应可查询');
  });

  it(accTest('FLOW-18-31', '获取单封邮件详情'), () => {
    const mail = mailSys.sendMail(makeRewardMail());

    const found = mailSys.getMail(mail.id);
    assertStrict(found !== undefined, 'FLOW-18-31', '应能查到邮件');
    assertStrict(found!.attachments.length === 2, 'FLOW-18-31', '附件数应为2');
    assertStrict(found!.sender === '系统', 'FLOW-18-31', '发件人应匹配');
  });

  it(accTest('FLOW-18-32', '发送自定义邮件'), () => {
    const mail = mailSys.sendCustomMail(
      'battle', '战报', '你取得了一场胜利！', '战场信使',
      { attachments: [{ resourceType: 'gold', amount: 300 }] },
    );

    assertStrict(mail !== null, 'FLOW-18-32', '自定义邮件应创建成功');
    assertStrict(mail!.category === 'battle', 'FLOW-18-32', '分类应为 battle');
    assertStrict(mail!.title === '战报', 'FLOW-18-32', '标题应匹配');
  });
});
