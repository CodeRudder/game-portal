/**
 * 核心层 — v15.0 事件引擎核心类型
 *
 * 包含：事件分类、权重系统、条件系统、加权选择、活动绑定、
 *       限时事件、奖励联动、存档数据、连锁事件v15、离线事件处理
 *
 * 从子模块重新导出所有类型：
 *   - event-v15-event.types — 基础事件类型
 *   - event-v15-activity.types — 活动/离线类型
 *
 * @module core/event/event-v15.types
 */

import type { EventId, EventDef, EventConsequence, EventInstance } from './event.types';

// 重新导出 EventConsequence，供引擎层直接从本模块引用
export type { EventConsequence } from './event.types';

// 重新导出基础事件类型
export type {
  EncounterSubType, EncounterDifficulty, EncounterEnvironment,
  EncounterTemplate, EncounterTemplateOption,
  StoryEventDef, StoryEventOption,
  NpcEventDef, NpcEventOption,
  DisasterType, DisasterEventDef, DisasterEventOption,
  TimedOpportunityDef, TimedOpportunityOption,
  TriggerConditionGroup, TimeCondition, StateCondition,
  ProbabilityCondition, ProbabilityModifier,
  ProbabilityResult,
  EventNotification,
  CooldownRecord,
  BranchOption,
  ChainBranch, ChainSnapshot,
} from './event-v15-event.types';

// NotificationPriority 是枚举（值），需要值导出
export { NotificationPriority } from './event-v15-event.types';

// 重新导出活动/离线类型
export type {
  OfflineEventPile, AutoResolveResult,
  ShopItemRarity, TokenShopItem, TokenShopConfig,
  ActivityRankEntry, ActivityLeaderboardConfig, LeaderboardRewardTier,
  TimedActivityPhase, TimedActivityFlow,
  FestivalType, FestivalActivityDef,
  ActivityOfflineSummary,
} from './event-v15-activity.types';

// ─────────────────────────────────────────────
// 19. v15 事件系统状态扩展
// ─────────────────────────────────────────────

/** v15 事件系统状态扩展 */
export interface EventV15State {
  /** 遭遇事件冷却 */
  encounterCooldowns: Map<string, number>;
  /** 通知队列 */
  notifications: import('./event-v15-event.types').EventNotification[];
  /** 离线事件堆积 */
  offlineEventPiles: import('./event-v15-activity.types').OfflineEventPile[];
  /** 代币余额 */
  tokenBalance: number;
}

/** v15 事件系统存档 */
export interface EventV15SaveData {
  version: number;
  encounterCooldowns: Record<string, number>;
  notifications: import('./event-v15-event.types').EventNotification[];
  offlineEventPiles: import('./event-v15-activity.types').OfflineEventPile[];
  tokenBalance: number;
}

// ─────────────────────────────────────────────
// 20. 事件分类（5类）
// ─────────────────────────────────────────────

/** 事件分类（5类：剧情/随机/触发/连锁/世界） */
export type EventCategory = 'story' | 'random' | 'triggered' | 'chain' | 'world';

/** 事件分类元数据 */
export interface EventCategoryMeta {
  /** 分类名称 */
  label: string;
  /** 默认权重 */
  defaultWeight: number;
  /** 描述 */
  description: string;
}

/** 事件分类元数据常量 */
export const EVENT_CATEGORY_META: Record<EventCategory, EventCategoryMeta> = {
  story: { label: '剧情事件', defaultWeight: 80, description: '主线/支线剧情事件' },
  random: { label: '随机事件', defaultWeight: 50, description: '随机触发的事件' },
  triggered: { label: '触发事件', defaultWeight: 70, description: '满足条件触发的事件' },
  chain: { label: '连锁事件', defaultWeight: 60, description: '多步骤连锁事件' },
  world: { label: '世界事件', defaultWeight: 40, description: '全服世界事件' },
};

// ─────────────────────────────────────────────
// 21. 事件权重系统
// ─────────────────────────────────────────────

/** 事件权重修正 */
export interface EventWeightModifier {
  /** 修正来源标识 */
  source: string;
  /** 修正类型 */
  type: 'additive' | 'multiplicative';
  /** 修正值 */
  value: number;
}

/** 事件权重 */
export interface EventWeight {
  /** 事件定义ID */
  eventDefId: EventId;
  /** 基础权重 */
  baseWeight: number;
  /** 当前权重（含修正） */
  currentWeight: number;
  /** 权重修正列表 */
  modifiers: EventWeightModifier[];
}

// ─────────────────────────────────────────────
// 22. 事件冷却
// ─────────────────────────────────────────────

/** 事件冷却记录 */
export interface EventCooldown {
  /** 事件定义ID */
  eventDefId: EventId;
  /** 冷却开始回合 */
  startTurn: number;
  /** 冷却结束回合 */
  endTurn: number;
  /** 剩余回合 */
  remainingTurns: number;
}

// ─────────────────────────────────────────────
// 23. 扩展条件系统
// ─────────────────────────────────────────────

/** 扩展事件条件（支持嵌套子条件） */
export interface ExtendedEventCondition {
  /** 条件类型 */
  type: string;
  /** 条件参数 */
  params: Record<string, unknown>;
  /** 是否取反 */
  negate?: boolean;
  /** 子条件 */
  subConditions?: ExtendedEventCondition[];
  /** 逻辑运算符 */
  operator?: 'and' | 'or';
}

/** 条件上下文 */
export interface ConditionContext {
  /** 当前回合 */
  currentTurn: number;
  /** 资源映射 */
  resources?: Record<string, number>;
  /** 已完成事件ID集合 */
  completedEventIds?: Set<string>;
  /** 已招募武将ID集合 */
  recruitedHeroIds?: Set<string>;
  /** 领地数量 */
  territoryCount?: number;
  /** 战斗胜利次数 */
  battlesWon?: number;
  /** 活跃活动ID集合 */
  activeActivityIds?: Set<string>;
}

// ─────────────────────────────────────────────
// 24. 加权选择
// ─────────────────────────────────────────────

/** 加权选择结果 */
export interface WeightedSelectionResult {
  /** 选中事件ID */
  eventDefId: EventId;
  /** 选中权重 */
  selectedWeight: number;
  /** 总权重 */
  totalWeight: number;
  /** 候选列表 */
  candidates: Array<{ eventDefId: string; weight: number }>;
}

/** 加权事件选项 */
export interface WeightedEventOption {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description?: string;
  /** 权重 */
  weight: number;
  /** 后果 */
  consequences: EventConsequence;
}

// ─────────────────────────────────────────────
// 25. 选项后果与选择结果
// ─────────────────────────────────────────────

/** 选项后果（与 EventConsequence 对齐） */
export interface OptionConsequence {
  /** 描述 */
  description?: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 好感度变化 */
  affinityChanges?: Record<string, number>;
  /** 触发后续事件ID */
  triggerEventId?: string;
  /** 解锁ID列表 */
  unlockIds?: string[];
}

/** 选项选择结果 */
export interface OptionSelectionResult {
  /** 选择的选项ID */
  optionId: string;
  /** 是否自动选择 */
  isAuto: boolean;
  /** 后果 */
  consequences: OptionConsequence;
  /** 下一个事件ID */
  nextEventId?: string;
}

// ─────────────────────────────────────────────
// 26. 活动事件绑定
// ─────────────────────────────────────────────

/** 活动事件绑定 */
export interface ActivityEventBinding {
  /** 绑定ID */
  id: string;
  /** 活动ID */
  activityId: string;
  /** 关联事件定义ID列表 */
  eventDefIds: EventId[];
  /** 绑定类型 */
  bindingType: 'exclusive' | 'shared' | 'bonus' | 'trigger';
  /** 是否启用 */
  enabled: boolean;
}

// ─────────────────────────────────────────────
// 27. 限时事件配置
// ─────────────────────────────────────────────

/** 限时事件配置 */
export interface TimedEventConfig {
  /** 事件定义ID */
  eventDefId: EventId;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 奖励倍率 */
  rewardMultiplier: number;
  /** 是否活动专属 */
  isActivityExclusive?: boolean;
}

// ─────────────────────────────────────────────
// 28. 活动奖励联动
// ─────────────────────────────────────────────

/** 活动奖励联动 */
export interface ActivityRewardLink {
  /** 联动ID */
  id: string;
  /** 关联事件定义ID */
  eventDefId: EventId;
  /** 联动类型 */
  linkType: 'bonus_multiplier' | 'extra_reward';
  /** 联动参数 */
  params: Record<string, unknown>;
  /** 是否启用 */
  enabled: boolean;
}

// ─────────────────────────────────────────────
// 29. 事件引擎存档数据
// ─────────────────────────────────────────────

/** 事件引擎存档数据 */
export interface EventSaveDataV15 {
  /** 存档版本 */
  version: number;
  /** 事件权重列表 */
  eventWeights: Array<{
    eventDefId: EventId;
    baseWeight: number;
    currentWeight: number;
  }>;
  /** 冷却列表 */
  cooldowns: Array<{
    eventDefId: EventId;
    startTurn: number;
    endTurn: number;
  }>;
  /** 连锁事件进度 */
  chainProgresses: Array<{
    chainId: string;
    currentNodeId: string | null;
    completedNodeIds: string[];
    visitedBranches: string[];
    isCompleted: boolean;
    startedAtTurn: number;
    completedAtTurn: number | null;
    isTimedOut: boolean;
  }>;
  /** 离线事件队列 */
  offlineQueue: OfflineEventEntry[];
  /** 活动事件绑定列表 */
  activityBindings: Array<{
    id: string;
    activityId: string;
    eventDefIds: EventId[];
    bindingType: string;
    enabled: boolean;
  }>;
  /** 限时事件列表 */
  timedEvents: Array<{
    eventDefId: EventId;
    startTime: number;
    endTime: number;
    rewardMultiplier: number;
  }>;
  /** 自动处理规则 */
  autoProcessRules: AutoProcessRule[];
  /** 活跃事件列表 */
  activeEvents?: EventInstance[];
  /** 已完成事件ID列表 */
  completedEventIds?: EventId[];
  /** 实例计数器 */
  instanceCounter?: number;
}

// ─────────────────────────────────────────────
// 30. 连锁事件系统 v15 类型
// ─────────────────────────────────────────────

/** 连锁事件链 ID */
export type ChainId = string;

/** 连锁事件节点 ID */
export type ChainNodeId = string;

/** 连锁事件合并点 */
export interface ChainMergePoint {
  /** 合并目标节点 ID */
  mergeNodeId: ChainNodeId;
  /** 来源节点 ID 列表 */
  sourceNodeIds: ChainNodeId[];
  /** 是否需要所有来源都完成 */
  requireAll: boolean;
}

/** 连锁事件节点定义 v15 */
export interface ChainNodeDefV15 {
  /** 节点 ID */
  id: ChainNodeId;
  /** 关联事件定义 ID */
  eventDefId: EventId;
  /** 前序节点 ID */
  parentNodeId?: ChainNodeId;
  /** 前序选项 ID */
  parentOptionId?: string;
  /** 深度 */
  depth: number;
  /** 节点描述 */
  description?: string;
  /** 是否合并节点 */
  isMergeNode?: boolean;
  /** 合并来源节点 ID 列表 */
  mergeSourceIds?: ChainNodeId[];
}

/** 连锁事件链定义 v15 */
export interface EventChainDefV15 {
  /** 链 ID */
  id: ChainId;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 事件分类 */
  category: EventCategory;
  /** 最大深度 */
  maxDepth: number;
  /** 超时回合数（null=不超时） */
  timeoutTurns: number | null;
  /** 合并点列表 */
  mergePoints: ChainMergePoint[];
  /** 节点列表 */
  nodes: ChainNodeDefV15[];
}

/** 连锁事件进度 v15 */
export interface ChainProgressV15 {
  /** 链 ID */
  chainId: ChainId;
  /** 当前节点 ID */
  currentNodeId: ChainNodeId | null;
  /** 已完成节点 ID 集合 */
  completedNodeIds: Set<ChainNodeId>;
  /** 已访问分支路径 */
  visitedBranches: string[];
  /** 是否已完成 */
  isCompleted: boolean;
  /** 开始回合 */
  startedAtTurn: number;
  /** 完成回合 */
  completedAtTurn: number | null;
  /** 是否超时 */
  isTimedOut: boolean;
}

/** 连锁事件推进结果 v15 */
export interface ChainAdvanceResultV15 {
  /** 是否成功 */
  success: boolean;
  /** 前一个节点 ID */
  previousNodeId: ChainNodeId | null;
  /** 当前节点 */
  currentNode: ChainNodeDefV15 | null;
  /** 链是否已完成 */
  chainCompleted: boolean;
  /** 是否为合并推进 */
  isMerge: boolean;
  /** 是否超时 */
  isTimedOut: boolean;
  /** 失败原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 31. 离线事件处理系统类型
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
