/**
 * 邮件域 — 模板系统
 *
 * 职责：邮件模板管理、变量插值、邮件生成
 * 规则：纯计算，无状态
 *
 * @module engine/mail/MailTemplateSystem
 */

import type {
  MailCategory,
  MailData,
  MailAttachment,
  MailTemplate,
  MailTemplateVars,
  MailPriority,
} from './mail.types';
import {
  DEFAULT_MAIL_EXPIRE_DAYS,
} from './mail.types';

// ─────────────────────────────────────────────
// 内置模板
// ─────────────────────────────────────────────

/** 内置邮件模板 */
const BUILTIN_TEMPLATES: MailTemplate[] = [
  {
    id: 'offline_reward',
    category: 'reward',
    titleTemplate: '离线收益报告',
    bodyTemplate: '主公，您离线{{hours}}小时期间，各城池共产出：粮草{{grain}}，铜钱{{gold}}，兵力{{troops}}，天命{{mandate}}。',
    sender: '系统',
    priority: 'high',
    defaultExpireSeconds: 7 * 24 * 3600,
  },
  {
    id: 'offline_trade_complete',
    category: 'trade',
    titleTemplate: '贸易完成通知',
    bodyTemplate: '主公，前往{{city}}的商队已完成贸易，获得铜钱{{gold}}。',
    sender: '商队',
    priority: 'normal',
    defaultExpireSeconds: 3 * 24 * 3600,
  },
  {
    id: 'level_up_reward',
    category: 'reward',
    titleTemplate: '升级奖励',
    bodyTemplate: '恭喜主公升级到{{level}}级！获得奖励：{{reward}}。',
    sender: '系统',
    priority: 'high',
    defaultExpireSeconds: 30 * 24 * 3600,
  },
  {
    id: 'building_complete',
    category: 'system',
    titleTemplate: '建筑升级完成',
    bodyTemplate: '主公，{{building}}已升级到{{level}}级。',
    sender: '工部',
    priority: 'normal',
    defaultExpireSeconds: 3 * 24 * 3600,
  },
  {
    id: 'combat_report',
    category: 'combat',
    titleTemplate: '战报：{{result}}',
    bodyTemplate: '主公，{{battleType}}已结束。我方{{ourLosses}}人，敌方{{enemyLosses}}人。{{detail}}',
    sender: '军师',
    priority: 'high',
    defaultExpireSeconds: 7 * 24 * 3600,
  },
  {
    id: 'vip_benefit',
    category: 'system',
    titleTemplate: 'VIP特权提醒',
    bodyTemplate: '主公，您的VIP{{vipLevel}}特权今日可翻倍{{remaining}}次，请及时使用。',
    sender: '系统',
    priority: 'normal',
    defaultExpireSeconds: 1 * 24 * 3600,
  },
];

// ─────────────────────────────────────────────
// MailTemplateSystem
// ─────────────────────────────────────────────

/**
 * 邮件模板系统
 *
 * 管理邮件模板，支持变量插值和邮件生成。
 * 内置常用模板，支持自定义模板注册。
 */
export class MailTemplateSystem {

  /** 已注册的模板映射 */
  private templates: Map<string, MailTemplate> = new Map();

  /** 自增ID计数器 */
  private idCounter = 0;

  constructor() {
    // 注册内置模板
    for (const tpl of BUILTIN_TEMPLATES) {
      this.templates.set(tpl.id, { ...tpl });
    }
  }

  /**
   * 注册自定义模板
   *
   * @param template 模板定义
   */
  registerTemplate(template: MailTemplate): void {
    this.templates.set(template.id, { ...template });
  }

  /**
   * 获取模板
   *
   * @param templateId 模板ID
   * @returns 模板定义或undefined
   */
  getTemplate(templateId: string): MailTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): MailTemplate[] {
    return Array.from(this.templates.values()).map(t => ({ ...t }));
  }

  /**
   * 使用模板生成邮件
   *
   * 对模板中的 {{var}} 占位符进行变量插值。
   *
   * @param templateId 模板ID
   * @param vars 变量映射
   * @param attachments 附件（覆盖模板默认附件）
   * @returns 生成的邮件数据
   * @throws 模板不存在时抛出错误
   */
  createFromTemplate(
    templateId: string,
    vars: MailTemplateVars = {},
    attachments?: Omit<MailAttachment, 'id' | 'claimed'>[],
  ): MailData {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`邮件模板不存在: ${templateId}`);
    }

    const title = this.interpolate(template.titleTemplate, vars);
    const body = this.interpolate(template.bodyTemplate, vars);

    // 生成附件
    const attachmentDefs = attachments ?? template.defaultAttachments ?? [];
    const mailAttachments: MailAttachment[] = attachmentDefs.map(att => ({
      id: `att_${++this.idCounter}`,
      type: att.type,
      content: att.content,
      claimed: false,
    }));

    const now = Date.now();
    const expireTime = template.defaultExpireSeconds > 0
      ? now + template.defaultExpireSeconds * 1000
      : 0;

    return {
      id: `mail_${++this.idCounter}_${now}`,
      category: template.category,
      title,
      body,
      sender: template.sender,
      sendTime: now,
      expireTime,
      status: 'unread',
      priority: template.priority,
      attachments: mailAttachments,
      starred: false,
    };
  }

  /**
   * 创建自定义邮件（不使用模板）
   *
   * @param category 邮件类别
   * @param title 标题
   * @param body 正文
   * @param sender 发送者
   * @param options 可选参数
   * @returns 邮件数据
   */
  createCustom(
    category: MailCategory,
    title: string,
    body: string,
    sender: string,
    options?: {
      priority?: MailPriority;
      expireSeconds?: number;
      attachments?: Omit<MailAttachment, 'id' | 'claimed'>[];
    },
  ): MailData {
    const now = Date.now();
    const expireSeconds = options?.expireSeconds ?? DEFAULT_MAIL_EXPIRE_DAYS * 24 * 3600;
    const attachments: MailAttachment[] = (options?.attachments ?? []).map(att => ({
      id: `att_${++this.idCounter}`,
      type: att.type,
      content: att.content,
      claimed: false,
    }));

    return {
      id: `mail_${++this.idCounter}_${now}`,
      category,
      title,
      body,
      sender,
      sendTime: now,
      expireTime: expireSeconds > 0 ? now + expireSeconds * 1000 : 0,
      status: 'unread',
      priority: options?.priority ?? 'normal',
      attachments,
      starred: false,
    };
  }

  // ─────────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────────

  /**
   * 变量插值
   *
   * 将模板中的 {{var}} 替换为实际值。
   *
   * @param template 模板字符串
   * @param vars 变量映射
   * @returns 插值后的字符串
   */
  private interpolate(template: string, vars: MailTemplateVars): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const value = vars[key];
      return value !== undefined ? String(value) : match;
    });
  }
}
