/**
 * 核心层 — 事件系统类型定义
 *
 * 定义 v6.0 事件系统的所有核心类型：
 *   - 事件类型矩阵（随机/固定/连锁）
 *   - 急报横幅通知
 *   - 随机遭遇弹窗
 *   - 事件选项与后果
 *
 * @module core/event/event.types
 */

// ─────────────────────────────────────────────
// 1. 事件类型矩阵（#21）
// ─────────────────────────────────────────────

/** 事件唯一标识 */
export type EventId = string;

/** 事件触发类型 */
export type EventTriggerType =
  | 'random'     // 随机事件 — 概率触发
  | 'fixed'      // 固定事件 — 条件触发
  | 'chain';     // 连锁事件 — 前置事件完成触发

/** 事件紧急程度 */
export type EventUrgency = 'low' | 'medium' | 'high' | 'critical';

/** 事件状态 */
export type EventStatus = 'pending' | 'active' | 'resolved' | 'expired';

/** 事件作用域 */
export type EventScope = 'global' | 'region' | 'npc';

/** 事件条件定义 */
export interface EventCondition {
  /** 条件类型 */
  type: 'turn_range' | 'affinity_level' | 'resource_threshold' | 'building_level' | 'event_completed';
  /** 条件参数 */
  params: Record<string, unknown>;
}

/** 事件选项后果 */
export interface EventConsequence {
  /** 后果描述 */
  description: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 好感度变化 */
  affinityChanges?: Record<string, number>;
  /** 触发后续事件ID */
  triggerEventId?: EventId;
  /** 解锁内容 */
  unlockIds?: string[];
}

/** 事件选项 */
export interface EventOption {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description?: string;
  /** 所需条件（可选，不满足则选项不可用） */
  requiredConditions?: EventCondition[];
  /** 选择后的后果 */
  consequences: EventConsequence;
  /** 是否为默认选项 */
  isDefault?: boolean;
}

/** 事件定义（模板） */
export interface EventDef {
  /** 事件唯一ID */
  id: EventId;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 触发类型 */
  triggerType: EventTriggerType;
  /** 紧急程度 */
  urgency: EventUrgency;
  /** 作用域 */
  scope: EventScope;
  /** 触发条件（固定事件和连锁事件使用） */
  triggerConditions?: EventCondition[];
  /** 随机触发概率（0-1，随机事件使用） */
  triggerProbability?: number;
  /** 前置事件ID（连锁事件使用） */
  prerequisiteEventIds?: EventId[];
  /** 可选冷却回合数 */
  cooldownTurns?: number;
  /** 事件选项列表 */
  options: EventOption[];
  /** 自动过期回合数（null表示不过期） */
  expireAfterTurns?: number | null;
}

/** 事件实例（运行时） */
export interface EventInstance {
  /** 实例唯一ID */
  instanceId: string;
  /** 事件定义ID */
  eventDefId: EventId;
  /** 触发回合 */
  triggeredTurn: number;
  /** 过期回合（null表示不过期） */
  expireTurn: number | null;
  /** 当前状态 */
  status: EventStatus;
  /** 关联区域（scope=region时有效） */
  regionId?: string;
  /** 关联NPC ID（scope=npc时有效） */
  npcId?: string;
}

/** 事件触发结果 */
export interface EventTriggerResult {
  /** 是否成功触发 */
  triggered: boolean;
  /** 触发的事件实例（成功时有效） */
  instance?: EventInstance;
  /** 未触发原因（失败时有效） */
  reason?: string;
}

/** 事件选择结果 */
export interface EventChoiceResult {
  /** 事件实例ID */
  instanceId: string;
  /** 选择的选项ID */
  optionId: string;
  /** 后果 */
  consequences: EventConsequence;
  /** 后续触发的事件（连锁事件） */
  chainEventId?: EventId;
}

// ─────────────────────────────────────────────
// 2. 急报横幅系统（#22）
// ─────────────────────────────────────────────

/** 横幅通知ID */
export type BannerId = string;

/** 横幅通知类型 */
export type BannerType = 'info' | 'warning' | 'danger' | 'opportunity';

/** 急报横幅数据 */
export interface EventBanner {
  /** 横幅唯一ID */
  id: BannerId;
  /** 关联事件实例ID */
  eventInstanceId: string;
  /** 横幅标题 */
  title: string;
  /** 横幅描述 */
  description: string;
  /** 紧急程度 */
  urgency: EventUrgency;
  /** 横幅类型 */
  bannerType: BannerType;
  /** 显示优先级（数值越高越优先） */
  priority: number;
  /** 过期回合 */
  expireTurn: number | null;
  /** 是否已读 */
  read: boolean;
  /** 创建时间（回合数） */
  createdAt: number;
}

/** 横幅系统状态 */
export interface BannerState {
  /** 活跃横幅列表 */
  activeBanners: EventBanner[];
  /** 是否有未读横幅 */
  hasUnread: boolean;
  /** 未读数量 */
  unreadCount: number;
}

// ─────────────────────────────────────────────
// 3. 随机遭遇弹窗（#23）
// ─────────────────────────────────────────────

/** 遭遇弹窗ID */
export type EncounterId = string;

/** 遭遇弹窗数据 */
export interface EncounterPopup {
  /** 弹窗唯一ID */
  id: EncounterId;
  /** 关联事件实例ID */
  eventInstanceId: string;
  /** 遭遇标题 */
  title: string;
  /** 遭遇描述 */
  description: string;
  /** 场景图片标识 */
  sceneImageKey?: string;
  /** 可选选项列表 */
  options: EncounterOption[];
  /** 是否可关闭（不选择直接关闭） */
  dismissible: boolean;
  /** 紧急程度 */
  urgency: EventUrgency;
}

/** 遭遇选项（含后果预览） */
export interface EncounterOption {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description?: string;
  /** 后果预览（显示给玩家的简短提示） */
  consequencePreview: string;
  /** 是否可用 */
  available: boolean;
  /** 不可用原因 */
  unavailableReason?: string;
  /** 选择后实际后果 */
  consequences: EventConsequence;
}

/** 遭遇选择结果 */
export interface EncounterChoiceResult {
  /** 遭遇弹窗ID */
  encounterId: EncounterId;
  /** 选择的选项ID */
  optionId: string;
  /** 实际后果 */
  consequences: EventConsequence;
  /** 资源变化快捷访问 */
  resourceChanges?: Record<string, number>;
}

// ─────────────────────────────────────────────
// 4. 事件触发配置
// ─────────────────────────────────────────────

/** 事件触发配置 */
export interface EventTriggerConfig {
  /** 每回合随机事件触发概率 */
  randomEventProbability: number;
  /** 最大同时活跃事件数 */
  maxActiveEvents: number;
  /** 连锁事件自动触发延迟回合 */
  chainEventDelay: number;
  /** 横幅最大显示数量 */
  maxBannerCount: number;
  /** 横幅默认显示回合数 */
  bannerDisplayTurns: number;
}

/** 默认事件触发配置 */
export const DEFAULT_EVENT_TRIGGER_CONFIG: EventTriggerConfig = {
  randomEventProbability: 0.3,
  maxActiveEvents: 5,
  chainEventDelay: 1,
  maxBannerCount: 3,
  bannerDisplayTurns: 5,
} as const;

// ─────────────────────────────────────────────
// 5. 事件系统状态
// ─────────────────────────────────────────────

/** 事件系统状态 */
export interface EventSystemState {
  /** 所有事件定义 */
  eventDefs: Map<EventId, EventDef>;
  /** 活跃事件实例 */
  activeEvents: EventInstance[];
  /** 已完成事件ID集合 */
  completedEventIds: Set<EventId>;
  /** 横幅状态 */
  bannerState: BannerState;
}

/** 事件系统存档数据 */
export interface EventSystemSaveData {
  /** 活跃事件实例 */
  activeEvents: EventInstance[];
  /** 已完成事件ID列表 */
  completedEventIds: EventId[];
  /** 横幅数据 */
  banners: EventBanner[];
  /** 事件冷却 */
  cooldowns: Record<EventId, number>;
  /** 版本号 */
  version: number;
}
