/**
 * MailTemplateSystem 单元测试
 *
 * 覆盖：
 *   - 内置模板注册
 *   - 自定义模板注册
 *   - 变量插值
 *   - 从模板生成邮件
 *   - 自定义邮件创建
 *   - 附件生成
 *   - 过期时间计算
 */

import { MailTemplateSystem } from '../MailTemplateSystem';
import type { MailTemplate, MailCategory } from '../mail.types';

describe('MailTemplateSystem', () => {
  let system: MailTemplateSystem;

  beforeEach(() => {
    system = new MailTemplateSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 内置模板
  // ═══════════════════════════════════════════

  describe('内置模板', () => {
    it('应注册内置模板', () => {
      const templates = system.getAllTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(5);
    });

    it('包含离线收益模板', () => {
      const tpl = system.getTemplate('offline_reward');
      expect(tpl).toBeDefined();
      expect(tpl!.category).toBe('reward');
      expect(tpl!.titleTemplate).toContain('离线');
    });

    it('包含贸易完成模板', () => {
      const tpl = system.getTemplate('offline_trade_complete');
      expect(tpl).toBeDefined();
      expect(tpl!.category).toBe('trade');
    });

    it('包含升级奖励模板', () => {
      const tpl = system.getTemplate('level_up_reward');
      expect(tpl).toBeDefined();
    });

    it('包含建筑完成模板', () => {
      const tpl = system.getTemplate('building_complete');
      expect(tpl).toBeDefined();
    });

    it('包含战报模板', () => {
      const tpl = system.getTemplate('combat_report');
      expect(tpl).toBeDefined();
    });

    it('包含VIP特权模板', () => {
      const tpl = system.getTemplate('vip_benefit');
      expect(tpl).toBeDefined();
    });

    it('获取不存在的模板返回undefined', () => {
      expect(system.getTemplate('nonexistent')).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 自定义模板注册
  // ═══════════════════════════════════════════

  describe('自定义模板注册', () => {
    it('注册自定义模板', () => {
      const customTemplate: MailTemplate = {
        id: 'custom_test',
        category: 'system',
        titleTemplate: '自定义标题 {{name}}',
        bodyTemplate: '自定义正文 {{desc}}',
        sender: '测试',
        priority: 'normal',
        defaultExpireSeconds: 86400,
      };

      system.registerTemplate(customTemplate);
      expect(system.getTemplate('custom_test')).toBeDefined();
    });

    it('覆盖内置模板', () => {
      const override: MailTemplate = {
        id: 'offline_reward',
        category: 'reward',
        titleTemplate: '新标题',
        bodyTemplate: '新正文',
        sender: '新发送者',
        priority: 'urgent',
        defaultExpireSeconds: 0,
      };

      system.registerTemplate(override);
      const tpl = system.getTemplate('offline_reward')!;
      expect(tpl.titleTemplate).toBe('新标题');
    });

    it('getAllTemplates包含自定义模板', () => {
      system.registerTemplate({
        id: 'custom_1',
        category: 'social',
        titleTemplate: '自定义',
        bodyTemplate: '正文',
        sender: '测试',
        priority: 'low',
        defaultExpireSeconds: 3600,
      });

      const templates = system.getAllTemplates();
      expect(templates.find(t => t.id === 'custom_1')).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 3. 变量插值
  // ═══════════════════════════════════════════

  describe('变量插值', () => {
    it('从模板生成邮件应正确替换变量', () => {
      const mail = system.createFromTemplate('offline_reward', {
        hours: '8',
        grain: '1000',
        gold: '500',
        troops: '200',
        mandate: '50',
      });

      expect(mail.title).toBe('离线收益报告');
      expect(mail.body).toContain('8');
      expect(mail.body).toContain('1000');
      expect(mail.body).toContain('500');
    });

    it('未提供的变量保留占位符', () => {
      const mail = system.createFromTemplate('offline_reward', {
        hours: '8',
      });

      expect(mail.body).toContain('8');
      // 未提供的变量保留 {{var}}
      expect(mail.body).toContain('{{grain}}');
    });

    it('空变量不替换', () => {
      const mail = system.createFromTemplate('building_complete', {});
      expect(mail.body).toContain('{{building}}');
    });

    it('数字类型变量正确转换', () => {
      const mail = system.createFromTemplate('level_up_reward', {
        level: 10,
        reward: '铜钱×100',
      });
      expect(mail.body).toContain('10');
      expect(mail.body).toContain('铜钱×100');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 从模板生成邮件
  // ═══════════════════════════════════════════

  describe('从模板生成邮件', () => {
    it('生成的邮件初始状态为unread', () => {
      const mail = system.createFromTemplate('offline_reward', { hours: '1', grain: '0', gold: '0', troops: '0', mandate: '0' });
      expect(mail.status).toBe('unread');
      expect(mail.starred).toBe(false);
    });

    it('生成的邮件ID唯一', () => {
      const mail1 = system.createFromTemplate('offline_reward', { hours: '1', grain: '0', gold: '0', troops: '0', mandate: '0' });
      const mail2 = system.createFromTemplate('offline_reward', { hours: '2', grain: '0', gold: '0', troops: '0', mandate: '0' });
      expect(mail1.id).not.toBe(mail2.id);
    });

    it('过期时间正确计算', () => {
      const mail = system.createFromTemplate('offline_reward', { hours: '1', grain: '0', gold: '0', troops: '0', mandate: '0' });
      expect(mail.expireTime).toBeGreaterThan(mail.sendTime);
    });

    it('模板不存在时抛出错误', () => {
      expect(() => system.createFromTemplate('nonexistent')).toThrow('邮件模板不存在');
    });

    it('自定义附件覆盖模板默认附件', () => {
      const mail = system.createFromTemplate('offline_reward', {
        hours: '1', grain: '0', gold: '0', troops: '0', mandate: '0',
      }, [
        { type: 'resource', content: { grain: 100, gold: 0, troops: 0, mandate: 0 } },
      ]);

      expect(mail.attachments).toHaveLength(1);
      expect(mail.attachments[0].claimed).toBe(false);
    });

    it('无附件时生成空附件列表', () => {
      const mail = system.createFromTemplate('building_complete', {
        building: '农田', level: '5',
      });
      expect(mail.attachments).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 自定义邮件创建
  // ═══════════════════════════════════════════

  describe('自定义邮件创建', () => {
    it('创建基本自定义邮件', () => {
      const mail = system.createCustom('system', '测试标题', '测试正文', '管理员');
      expect(mail.category).toBe('system');
      expect(mail.title).toBe('测试标题');
      expect(mail.body).toBe('测试正文');
      expect(mail.sender).toBe('管理员');
      expect(mail.priority).toBe('normal');
    });

    it('自定义优先级', () => {
      const mail = system.createCustom('system', '标题', '正文', '系统', {
        priority: 'urgent',
      });
      expect(mail.priority).toBe('urgent');
    });

    it('自定义过期时间', () => {
      const mail = system.createCustom('system', '标题', '正文', '系统', {
        expireSeconds: 3600,
      });
      expect(mail.expireTime).toBeGreaterThan(mail.sendTime);
      expect(mail.expireTime - mail.sendTime).toBe(3600 * 1000);
    });

    it('带附件的自定义邮件', () => {
      const mail = system.createCustom('reward', '奖励', '恭喜', '系统', {
        attachments: [
          { type: 'resource', content: { grain: 500, gold: 100, troops: 0, mandate: 0 } },
        ],
      });
      expect(mail.attachments).toHaveLength(1);
      expect(mail.attachments[0].claimed).toBe(false);
    });
  });
});
