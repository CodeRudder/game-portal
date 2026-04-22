/**
 * 引擎层 — 事件链系统类型定义
 *
 * 从 EventChainSystem.ts 中提取的类型定义。
 *
 * @module engine/event/event-chain.types
 */

import type { EventId, EventCondition } from '../../core/event';

// ─────────────────────────────────────────────
// 连锁事件类型
// ─────────────────────────────────────────────

/** 连锁事件链定义 */
export interface EventChain {
  /** 链唯一 ID */
  id: string;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 事件节点列表 */
  nodes: EventChainNode[];
  /** 最大深度（防止无限递归） */
  maxDepth: number;
}

/** 连锁事件节点 */
export interface EventChainNode {
  /** 节点 ID */
  id: string;
  /** 关联事件定义 ID */
  eventDefId: EventId;
  /** 前序节点 ID */
  parentNodeId?: string;
  /** 前序选项 ID（哪个选择触发此节点） */
  parentOptionId?: string;
  /** 深度 */
  depth: number;
}

/** 剧情事件定义 */
export interface StoryEventDef {
  /** 事件 ID */
  id: EventId;
  /** 标题 */
  title: string;
  /** 剧情文本列表 */
  storyLines: StoryLine[];
  /** 触发条件 */
  triggerConditions: EventCondition[];
  /** 背景图标识 */
  backgroundImage?: string;
  /** 角色立绘标识列表 */
  characterPortraits?: string[];
  /** 是否已触发 */
  triggered: boolean;
}

/** 剧情行 */
export interface StoryLine {
  /** 说话者 */
  speaker: string;
  /** 文本 */
  text: string;
  /** 玩家选项（如有） */
  choices?: StoryChoice[];
}

/** 剧情选项 */
export interface StoryChoice {
  /** 选项文本 */
  text: string;
  /** 后果描述 */
  consequence: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 触发后续事件 */
  triggerEventId?: EventId;
}

/** 事件日志条目 */
export interface EventLogEntry {
  /** 日志 ID */
  id: string;
  /** 事件定义 ID */
  eventDefId: EventId;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 玩家选择 */
  chosenOptionText?: string;
  /** 后果描述 */
  consequenceDescription?: string;
  /** 触发回合 */
  triggeredTurn: number;
  /** 解决回合 */
  resolvedTurn?: number;
  /** 时间戳 */
  timestamp: number;
  /** 事件类型标记 */
  eventType: 'random' | 'fixed' | 'chain' | 'story';
}

/** 回归急报条目 */
export interface ReturnAlert {
  /** 急报 ID */
  id: string;
  /** 关联事件实例 ID */
  eventInstanceId?: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 紧急程度 */
  urgency: 'low' | 'medium' | 'high' | 'critical';
  /** 发生时间 */
  timestamp: number;
  /** 是否已读 */
  read: boolean;
  /** 类型 */
  alertType: 'event' | 'story' | 'chain' | 'npc';
}

/** 事件深化系统存档 */
export interface EventChainSaveData {
  version: number;
  eventChains: Array<{
    id: string;
    currentNodeId: string | null;
    completedNodeIds: string[];
  }>;
  triggeredStoryEventIds: EventId[];
  eventLog: EventLogEntry[];
  returnAlerts: ReturnAlert[];
}
