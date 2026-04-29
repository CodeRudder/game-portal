/**
 * MailPersistence 单元测试
 *
 * 覆盖：
 * 1. buildTemplateMail — 模板邮件生成
 * 2. buildSaveData / restoreSaveData — 存档操作
 * 3. loadFromStorage / persistToStorage / clearStorage — 持久化
 */

import {
  buildTemplateMail,
  buildSaveData,
  restoreSaveData,
  loadFromStorage,
  persistToStorage,
  clearStorage,
} from '../MailPersistence';

import type { MailData, MailSaveData } from '../mail.types';
import { MAIL_SAVE_VERSION } from '../mail.types';

describe('MailPersistence', () => {
  // ─── buildTemplateMail ────────────────────

  describe('buildTemplateMail', () => {
    it('应生成离线奖励邮件', () => {
      const mail = buildTemplateMail('offline_reward', { hours: 5, grain: 100, gold: 50, troops: 20, mandate: 5 });
      expect(mail).not.toBeNull();
      expect(mail!.category).toBe('reward');
      expect(mail!.title).toBe('离线收益报告');
      expect(mail!.content).toContain('5');
      expect(mail!.content).toContain('100');
    });

    it('应生成建筑完成邮件', () => {
      const mail = buildTemplateMail('building_complete', { buildingName: '主城' });
      expect(mail).not.toBeNull();
      expect(mail!.category).toBe('system');
      expect(mail!.content).toContain('主城');
    });

    it('应生成科技完成邮件', () => {
      const mail = buildTemplateMail('tech_complete', { techName: '铁匠铺' });
      expect(mail).not.toBeNull();
      expect(mail!.content).toContain('铁匠铺');
    });

    it('不存在的模板应返回 null', () => {
      expect(buildTemplateMail('nonexistent')).toBeNull();
    });

    it('应使用默认值处理缺失变量', () => {
      const mail = buildTemplateMail('offline_reward', {});
      expect(mail).not.toBeNull();
      expect(mail!.content).toContain('0');
    });
  });

  // ─── buildSaveData ────────────────────────

  describe('buildSaveData', () => {
    it('应构建存档数据', () => {
      const mails = new Map<string, MailData>();
      mails.set('mail_1', {
        id: 'mail_1', category: 'system', title: 'Test', content: '',
        sender: 'sys', status: 'unread', attachments: [], createdAt: 0,
      });
      const data = buildSaveData(mails, 2);
      expect(data.mails.length).toBe(1);
      expect(data.nextId).toBe(2);
      expect(data.version).toBe(MAIL_SAVE_VERSION);
    });

    it('空 Map 应返回空数组', () => {
      const data = buildSaveData(new Map(), 0);
      expect(data.mails).toEqual([]);
    });
  });

  // ─── restoreSaveData ──────────────────────

  describe('restoreSaveData', () => {
    it('版本匹配应正确恢复', () => {
      const data: MailSaveData = {
        mails: [{
          id: 'mail_1', category: 'system', title: 'Test', content: '',
          sender: 'sys', status: 'unread', attachments: [], createdAt: 0,
        }],
        nextId: 5,
        version: MAIL_SAVE_VERSION,
      };
      const result = restoreSaveData(data);
      expect(result).not.toBeNull();
      expect(result!.mails.size).toBe(1);
      expect(result!.nextId).toBe(5);
    });

    it('版本不匹配应返回 null', () => {
      const data: MailSaveData = {
        mails: [],
        nextId: 0,
        version: 999,
      };
      expect(restoreSaveData(data)).toBeNull();
    });
  });

  // ─── Storage 持久化 ───────────────────────

  describe('Storage 持久化', () => {
    let storage: Storage;

    beforeEach(() => {
      const store: Record<string, string> = {};
      storage = {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
        get length() { return Object.keys(store).length; },
        key: vi.fn(),
      };
    });

    it('loadFromStorage 应从 Storage 加载', () => {
      const data: MailSaveData = {
        mails: [], nextId: 0, version: MAIL_SAVE_VERSION,
      };
      (storage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(data));
      const result = loadFromStorage(storage);
      expect(result).not.toBeNull();
      expect(result!.version).toBe(MAIL_SAVE_VERSION);
    });

    it('空 Storage 应返回 null', () => {
      (storage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      expect(loadFromStorage(storage)).toBeNull();
    });

    it('损坏数据应返回 null', () => {
      (storage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('invalid json{{{');
      expect(loadFromStorage(storage)).toBeNull();
    });

    it('persistToStorage 应保存数据', () => {
      const data: MailSaveData = {
        mails: [], nextId: 0, version: MAIL_SAVE_VERSION,
      };
      persistToStorage(storage, data);
      expect(storage.setItem).toHaveBeenCalled();
    });

    it('clearStorage 应移除数据', () => {
      clearStorage(storage);
      expect(storage.removeItem).toHaveBeenCalled();
    });
  });
});
