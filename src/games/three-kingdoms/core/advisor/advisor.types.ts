/**
 * 核心层 — 军师推荐系统类型定义
 *
 * 定义军师建议的触发条件、内容结构、展示规则等类型。
 * 规则：只有 interface/type/enum，零逻辑
 *
 * 功能覆盖：
 *   #14 建议触发规则 — 9种触发条件+优先级排序+冷却+每日15条上限
 *   #15 建议内容结构 — 标题≤20字+描述≤50字+行动按钮+置信度+过期时间
 *   #16 建议展示规则 — 最多3条+按优先级排序+执行后自动移除+关闭冷却30min
 *
 * @module core/advisor/advisor.types
 */

// ─────────────────────────────────────────────
// 1. 触发条件类型 (#14)
// ─────────────────────────────────────────────

/** 建议触发条件类型（9种） */
export type AdvisorTriggerType =
  | 'resource_overflow'    // 资源>80%上限 → "粮仓满载，建议升级"
  | 'resource_shortage'    // 资源<10% → "粮草告急，建议建造农田"
  | 'building_idle'        // 建筑队列空闲 → "建造队列空闲，建议升级"
  | 'hero_upgradeable'     // 武将可升级 → "武将{名}可升级"
  | 'tech_idle'            // 科技队列空闲 → "科技研究空闲"
  | 'army_full'            // 兵力满值 → "兵力已满，建议出征"
  | 'npc_leaving'          // 限时NPC<2h → "{NPC名}即将离开"
  | 'new_feature_unlock'   // 新功能解锁 → "点击了解{功能名}"
  | 'offline_overflow';    // 离线溢出>50% → "建议升级仓库"

/** 触发条件优先级（数值越大优先级越高） */
export const ADVISOR_TRIGGER_PRIORITY: Record<AdvisorTriggerType, number> = {
  resource_shortage: 90,     // 资源告急最紧急
  npc_leaving: 85,           // NPC即将离开有时间限制
  resource_overflow: 70,     // 资源溢出较重要
  hero_upgradeable: 60,      // 武将可升级
  army_full: 55,             // 兵力满
  building_idle: 50,         // 建筑空闲
  tech_idle: 45,             // 科技空闲
  new_feature_unlock: 40,    // 新功能
  offline_overflow: 35,      // 离线溢出
};

/** 触发条件配置 */
export interface AdvisorTriggerConfig {
  /** 触发类型 */
  type: AdvisorTriggerType;
  /** 优先级 */
  priority: number;
  /** 冷却时间（毫秒），同类型触发后的冷却 */
  cooldownMs: number;
  /** 描述模板 */
  descriptionTemplate: string;
}

// ─────────────────────────────────────────────
// 2. 建议内容结构 (#15)
// ─────────────────────────────────────────────

/** 建议置信度 */
export type AdvisorConfidence = 'high' | 'medium' | 'low';

/** 军师建议内容 */
export interface AdvisorSuggestion {
  /** 建议唯一ID */
  id: string;
  /** 触发类型 */
  triggerType: AdvisorTriggerType;
  /** 建议标题（≤20字） */
  title: string;
  /** 建议描述（≤50字） */
  description: string;
  /** 行动按钮文本 */
  actionLabel: string;
  /** 跳转目标（页面/功能ID） */
  actionTarget: string;
  /** 置信度 */
  confidence: AdvisorConfidence;
  /** 优先级（数值越大越优先） */
  priority: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 过期时间戳（null=不过期） */
  expiresAt: number | null;
}

// ─────────────────────────────────────────────
// 3. 建议展示规则 (#16)
// ─────────────────────────────────────────────

/** 最大同时展示建议数 */
export const ADVISOR_MAX_DISPLAY = 3;

/** 每日建议上限 */
export const ADVISOR_DAILY_LIMIT = 15;

/** 关闭冷却时间（毫秒）= 30分钟 */
export const ADVISOR_CLOSE_COOLDOWN_MS = 30 * 60 * 1000;

/** 建议冷却记录 */
export interface AdvisorCooldownRecord {
  /** 触发类型 */
  triggerType: AdvisorTriggerType;
  /** 冷却结束时间戳 */
  cooldownUntil: number;
}

/** 建议展示状态 */
export interface AdvisorDisplayState {
  /** 当前展示的建议列表 */
  displayedSuggestions: AdvisorSuggestion[];
  /** 今日已生成建议数 */
  dailyCount: number;
  /** 上次每日重置日期 */
  lastDailyReset: string;
  /** 冷却记录 */
  cooldowns: AdvisorCooldownRecord[];
}

// ─────────────────────────────────────────────
// 4. 军师系统状态
// ─────────────────────────────────────────────

/** 军师系统存档数据 */
export interface AdvisorSaveData {
  /** 版本号 */
  version: number;
  /** 冷却记录 */
  cooldowns: AdvisorCooldownRecord[];
  /** 今日已生成建议数 */
  dailyCount: number;
  /** 上次每日重置日期 */
  lastDailyReset: string;
}

/** 军师系统存档版本 */
export const ADVISOR_SAVE_VERSION = 1;
