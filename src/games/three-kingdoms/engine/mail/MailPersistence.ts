/**
 * 邮件域 — 存档与模板操作
 *
 * 从 MailSystem 中提取，保持主文件≤500行
 *
 * 职责：
 *   - 模板邮件发送（内置模板映射+变量插值）
 *   - 自定义邮件发送
 *   - 存档序列化/反序列化
 *   - localStorage 持久化
 *   - 系统重置
 *
 * @module engine/mail/MailPersistence
 */

import type {
  MailCategory,
  MailData,
  MailSaveData,
} from './mail.types';
import { MAIL_SAVE_VERSION } from './mail.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存储键 */
const MAIL_SAVE_KEY = 'three-kingdoms-mails';

// ─────────────────────────────────────────────
// 内置模板映射
// ─────────────────────────────────────────────

/** 内置模板定义 */
const BUILTIN_TEMPLATES: Record<string, { category: MailCategory; title: string; sender: string }> = {
  offline_reward: { category: 'reward', title: '离线收益报告', sender: '系统' },
  building_complete: { category: 'system', title: '建筑升级完成', sender: '工部' },
  tech_complete: { category: 'system', title: '科技研究完成', sender: '太学' },
  expedition_return: { category: 'battle', title: '远征归来', sender: '军师' },
};

// ─────────────────────────────────────────────
// 模板邮件
// ─────────────────────────────────────────────

/**
 * 使用内置模板生成邮件内容
 *
 * @param templateId 模板ID
 * @param vars 变量映射
 * @returns 邮件参数（category, title, content, sender），模板不存在返回null
 */
export function buildTemplateMail(
  templateId: string,
  vars: Record<string, string | number> = {},
): { category: MailCategory; title: string; content: string; sender: string } | null {
  const tpl = BUILTIN_TEMPLATES[templateId];
  if (!tpl) return null;

  let content = '主公，';
  if (templateId === 'offline_reward') {
    content = `主公，您离线${vars.hours ?? 0}小时期间，各城池共产出：粮草${vars.grain ?? 0}，铜钱${vars.gold ?? 0}，兵力${vars.troops ?? 0}，天命${vars.mandate ?? 0}。`;
  } else if (templateId === 'building_complete') {
    content = `主公，${vars.buildingName ?? '建筑'}已升级完成。`;
  } else if (templateId === 'tech_complete') {
    content = `主公，${vars.techName ?? '科技'}研究已完成。`;
  } else if (templateId === 'expedition_return') {
    content = `主公，远征军已归来，获得战利品若干。`;
  }

  return { category: tpl.category, title: tpl.title, content, sender: tpl.sender };
}

// ─────────────────────────────────────────────
// 存档操作
// ─────────────────────────────────────────────

/**
 * 构建存档数据
 *
 * @param mails 邮件Map
 * @param nextId 下一个ID计数器
 * @returns 存档数据
 */
export function buildSaveData(
  mails: Map<string, MailData>,
  nextId: number,
): MailSaveData {
  return {
    mails: Array.from(mails.values()),
    nextId,
    version: MAIL_SAVE_VERSION,
  };
}

/**
 * 从存档恢复邮件到Map
 *
 * @param data 存档数据
 * @returns 恢复后的 mails Map 和 nextId，版本不匹配返回null
 */
export function restoreSaveData(data: MailSaveData): { mails: Map<string, MailData>; nextId: number } | null {
  if (data.version !== MAIL_SAVE_VERSION) return null;

  const mails = new Map<string, MailData>();
  for (const mail of data.mails) {
    mails.set(mail.id, mail);
  }
  return { mails, nextId: data.nextId };
}

// ─────────────────────────────────────────────
// 持久化
// ─────────────────────────────────────────────

/**
 * 从Storage加载存档
 *
 * @param storage Storage实例
 * @returns 存档数据或null
 */
export function loadFromStorage(storage: Storage): MailSaveData | null {
  try {
    const raw = storage.getItem(MAIL_SAVE_KEY);
    if (raw) {
      return JSON.parse(raw) as MailSaveData;
    }
  } catch {
    // 存档损坏，使用默认值
  }
  return null;
}

/**
 * 持久化存档到Storage
 *
 * @param storage Storage实例
 * @param data 存档数据
 */
export function persistToStorage(storage: Storage, data: MailSaveData): void {
  try {
    storage.setItem(MAIL_SAVE_KEY, JSON.stringify(data));
  } catch {
    // 存储失败静默处理
  }
}

/**
 * 清除Storage中的邮件存档
 *
 * @param storage Storage实例
 */
export function clearStorage(storage: Storage): void {
  try {
    storage.removeItem(MAIL_SAVE_KEY);
  } catch {
    // 清除失败静默处理
  }
}
