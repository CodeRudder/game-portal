/**
 * MailFilterHelpers 单元测试
 *
 * 覆盖：
 * 1. filterMails — 邮件过滤
 * 2. getDefaultRetainSeconds — 默认保留时长
 */

import {
  filterMails,
  getDefaultRetainSeconds,
} from '../MailFilterHelpers';

import type { MailData, MailFilter } from '../mail.types';

describe('MailFilterHelpers', () => {
  const mails: MailData[] = [
    { id: '1', category: 'system', title: '系统', content: '', sender: 'sys', status: 'unread', attachments: [], createdAt: 0 },
    { id: '2', category: 'reward', title: '奖励', content: '', sender: 'sys', status: 'read', attachments: [{ type: 'gold', amount: 100 }], createdAt: 0 },
    { id: '3', category: 'system', title: '系统2', content: '', sender: 'sys', status: 'unread', attachments: [], createdAt: 0 },
  ];

  // ─── filterMails ──────────────────────────

  describe('filterMails', () => {
    it('无过滤条件应返回全部', () => {
      const result = filterMails(mails);
      expect(result.length).toBe(3);
    });

    it('应按分类过滤', () => {
      const filter: MailFilter = { category: 'system' };
      const result = filterMails(mails, filter);
      expect(result.length).toBe(2);
      expect(result.every(m => m.category === 'system')).toBe(true);
    });

    it('应按状态过滤', () => {
      const filter: MailFilter = { status: 'unread' };
      const result = filterMails(mails, filter);
      expect(result.length).toBe(2);
    });

    it('应按附件过滤', () => {
      const filter: MailFilter = { hasAttachment: true };
      const result = filterMails(mails, filter);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('category=all 应返回全部', () => {
      const filter: MailFilter = { category: 'all' };
      const result = filterMails(mails, filter);
      expect(result.length).toBe(3);
    });

    it('空列表应返回空', () => {
      const result = filterMails([]);
      expect(result).toEqual([]);
    });
  });

  // ─── getDefaultRetainSeconds ──────────────

  describe('getDefaultRetainSeconds', () => {
    const defaults = { system: 86400, reward: 3600, default_: 7200 };

    it('system 应返回对应值', () => {
      expect(getDefaultRetainSeconds('system', defaults)).toBe(86400);
    });

    it('reward 应返回对应值', () => {
      expect(getDefaultRetainSeconds('reward', defaults)).toBe(3600);
    });

    it('其他分类应返回默认值', () => {
      expect(getDefaultRetainSeconds('battle', defaults)).toBe(7200);
    });
  });
});
