/**
 * 核心层 — 事件系统类型定义
 *
 * 定义 v6.0 事件系统的基础类型：
 *   - 事件类型矩阵（随机/固定/连锁）
 *   - 事件选项与后果
 *   - 急报横幅数据
 *   - 离线事件处理
 *
 * 零 engine/ 依赖，所有类型在本文件中定义。
 *
 * @module core/events/event-system.types
 */

// ─────────────────────────────────────────────
// 1. 事件类型矩阵（#21）
// ─────────────────────────────────────────────

/** 事件触发类型 */
export type EventTriggerType =
  | 'random'     // 随机事件 — 概率触发
  | 'fixed'      // 固定事件 — 条件触发（如占领特定领土）
  | 'chain';     // 连锁事件 — 前置事件完成后触发

/** 事件优先级 */
export type EventPriority = 'low' | 'normal' | 'high' | 'urgent';

/** 事件状态 */
export type EventStatus = 'pending' | 'active' | 'completed' | 'expired' | 'auto_resolved';

/** 事件分类标签 */
export type EventCategory =
  | 'military'    // 军事事件
  | 'diplomatic'  // 外交事件
  | 'economic'    // 经济事件
  | 'natural'     // 自然灾害
  | 'social'      // 社会事件
  | 'mystery';    // 神秘事件

/** 事件ID */
export type GameEventId = string;

/** 事件定义（模板） */
export interface GameEventDef {
  /** 事件唯一ID */
  id: GameEventId;
  /** 事件名称 */
  name: string;
  /** 事件描述 */
  description: string;
  /** 触发类型 */
  triggerType: EventTriggerType;
  /** 分类 */
  category: EventCategory;
  /** 优先级 */
  priority: EventPriority;
  /** 触发条件（百分比概率） */
  triggerProbability: number;
  /** 冷却时间（回合数） */
  cooldownTurns: number;
  /** 持续时间（回合数，0=即时） */
  durationTurns: number;
  /** 最低触发回合 */
  minTurn: number;
  /** 选项列表 */
  options: EventOption[];
  /** 是否为离线可处理 */
  offlineProcessable: boolean;
}

// ─────────────────────────────────────────────
// 2. 事件选项与后果（#23）
// ─────────────────────────────────────────────

/** 事件选项ID */
export type EventOptionId = string;

/** 事件选项 */
export interface EventOption {
  /** 选项ID */
  id: EventOptionId;
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description?: string;
  /** 选项后果 */
  consequences: EventConsequence[];
  /** 是否为默认选项（离线自动处理时选择） */
  isDefault?: boolean;
  /** AI评分权重（离线自动处理时参考） */
  aiWeight: number;
}

/** 事件后果 */
export interface EventConsequence {
  /** 后果类型 */
  type: EventConsequenceType;
  /** 目标（资源类型/NPC ID等） */
  target: string;
  /** 数值变化 */
  value: number;
  /** 描述文本 */
  description: string;
}

/** 后果类型 */
export type EventConsequenceType =
  | 'resource_change'    // 资源变化
  | 'affinity_change'    // NPC好感度变化
  | 'territory_effect'   // 领土效果
  | 'unlock_content'     // 解锁内容
  | 'trigger_chain'      // 触发连锁事件
  | 'military_effect';   // 军事效果

// ─────────────────────────────────────────────
// 3. 急报横幅（#22）
// ─────────────────────────────────────────────

/** 急报横幅数据 */
export interface EventBanner {
  /** 横幅唯一ID */
  id: string;
  /** 关联事件ID */
  eventId: GameEventId;
  /** 横幅标题 */
  title: string;
  /** 横幅内容 */
  content: string;
  /** 横幅图标 */
  icon: string;
  /** 优先级 */
  priority: EventPriority;
  /** 显示时间（毫秒） */
  displayDuration: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 是否已读 */
  read: boolean;
}

/** 急报横幅队列 */
export interface EventBannerQueue {
  /** 当前显示的横幅 */
  current: EventBanner | null;
  /** 排队中的横幅 */
  pending: EventBanner[];
  /** 已过期的横幅 */
  expired: EventBanner[];
}

// ─────────────────────────────────────────────
// 4. 活跃事件实例
// ─────────────────────────────────────────────

/** 活跃事件实例 */
export interface ActiveGameEvent {
  /** 实例唯一ID */
  instanceId: string;
  /** 事件定义ID */
  eventId: GameEventId;
  /** 事件名称 */
  name: string;
  /** 事件描述 */
  description: string;
  /** 触发类型 */
  triggerType: EventTriggerType;
  /** 分类 */
  category: EventCategory;
  /** 优先级 */
  priority: EventPriority;
  /** 状态 */
  status: EventStatus;
  /** 可用选项 */
  options: EventOption[];
  /** 触发回合 */
  triggeredAtTurn: number;
  /** 过期回合（0=不过期） */
  expiresAtTurn: number;
  /** 选择的选项ID */
  selectedOptionId: EventOptionId | null;
  /** 后果列表 */
  appliedConsequences: EventConsequence[];
}

// ─────────────────────────────────────────────
// 5. 离线事件处理（#24）
// ─────────────────────────────────────────────

/** 离线事件处理结果 */
export interface OfflineEventResult {
  /** 处理的事件数量 */
  processedCount: number;
  /** 处理详情 */
  details: OfflineEventDetail[];
  /** 总资源变化 */
  totalResourceChanges: Record<string, number>;
}

/** 离线事件处理详情 */
export interface OfflineEventDetail {
  /** 事件名称 */
  eventName: string;
  /** 选择的选项文本 */
  selectedOptionText: string;
  /** 应用的后果 */
  consequences: EventConsequence[];
}

// ─────────────────────────────────────────────
// 6. 事件系统状态
// ─────────────────────────────────────────────

/** 事件系统状态 */
export interface EventSystemState {
  /** 活跃事件列表 */
  activeEvents: ActiveGameEvent[];
  /** 急报横幅队列 */
  bannerQueue: EventBannerQueue;
  /** 事件冷却记录 */
  cooldowns: Record<GameEventId, number>;
  /** 累计触发次数 */
  totalTriggered: number;
  /** 累计完成次数 */
  totalCompleted: number;
}

/** 事件系统存档数据 */
export interface EventSystemSaveData {
  /** 已完成的事件ID列表 */
  completedEventIds: GameEventId[];
  /** 事件冷却记录 */
  cooldowns: Record<GameEventId, number>;
  /** 累计统计 */
  totalTriggered: number;
  totalCompleted: number;
  /** 版本号 */
  version: number;
}
