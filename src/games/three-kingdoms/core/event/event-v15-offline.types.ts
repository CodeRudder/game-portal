/**
 * 核心层 — 离线事件处理系统类型
 *
 * 包含：离线事件条目、自动处理策略/规则、离线处理结果、事件回溯数据
 *
 * @module core/event/event-v15-offline.types
 */

import type { EventId, EventDef } from './event.types';
import type { EventCategory, OptionConsequence } from './event-v15-shared.types';

// ─────────────────────────────────────────────
// 离线事件处理系统类型
// ─────────────────────────────────────────────

/** 离线事件条目（扩展版，供 OfflineEventSystem 使用） */
export interface OfflineEventEntry {
  /** 条目 ID */
  id: string;
  /** 事件 ID（兼容 OfflineEventHandler） */
  eventId: EventId;
  /** 事件定义 ID */
  eventDefId: EventId;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 紧急程度 */
  urgency: 'critical' | 'high' | 'medium' | 'low';
  /** 事件分类 */
  category: EventCategory;
  /** 触发时间（回合） */
  triggeredAt: number;
  /** 触发回合 */
  triggerTurn: number;
  /** 事件定义 */
  eventDef: EventDef;
  /** 自动处理结果（null=需玩家处理） */
  autoResult: import('./event-v15-activity.types').AutoResolveResult | null;
  /** 是否已自动处理 */
  autoProcessed: boolean;
  /** 自动处理规则 ID */
  autoRuleId?: string;
  /** 自动选择的选项 ID */
  autoSelectedOptionId?: string;
  /** 是否需要手动操作 */
  requiresManualAction: boolean;
}

/** 自动处理策略 */
export type AutoSelectStrategy =
  | 'default_option'
  | 'best_outcome'
  | 'safest'
  | 'weighted_random'
  | 'skip';

/** 自动处理规则 */
export interface AutoProcessRule {
  /** 规则 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（越高越先匹配） */
  priority: number;
  /** 紧急程度阈值（高于此值不自动处理） */
  urgencyThreshold: 'critical' | 'high' | 'medium' | 'low';
  /** 适用的分类列表（空=全部分类） */
  applicableCategories: EventCategory[];
  /** 适用的事件 ID 列表（空=全部事件） */
  applicableEventIds: EventId[];
  /** 选择策略 */
  strategy: AutoSelectStrategy;
}

/** 离线事件处理结果 */
export interface OfflineEventProcessResult {
  /** 自动处理数量 */
  autoProcessedCount: number;
  /** 需手动处理数量 */
  manualRequiredCount: number;
  /** 已处理条目列表 */
  processedEntries: Array<{
    entryId: string;
    eventDefId: EventId;
    selectedOptionId: string;
    consequences: OptionConsequence;
  }>;
  /** 待处理条目列表 */
  pendingEntries: OfflineEventEntry[];
  /** 事件回溯数据 */
  retrospectiveData: EventRetrospectiveData;
}

/** 事件回溯数据 */
export interface EventRetrospectiveData {
  /** 离线事件列表 */
  offlineEvents: OfflineEventEntry[];
  /** 资源变化汇总 */
  totalResourceChanges: Record<string, number>;
  /** 时间线 */
  timeline: Array<{
    timestamp: number;
    eventTitle: string;
    action: string;
    result: string;
  }>;
}
