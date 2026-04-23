/**
 * 核心层 — v15.0 事件引擎核心类型（聚合导出）
 *
 * 包含：事件分类、权重系统、条件系统、加权选择、活动绑定、
 *       限时事件、奖励联动、存档数据
 *
 * 子模块：
 *   - event-encounter.types — 基础事件类型
 *   - event-activity.types — 活动/离线类型
 *   - event-chain.types — 连锁事件v15类型
 *   - event-offline.types — 离线事件处理类型
 *
 * @module core/event/event-engine.types
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
} from './event-encounter.types';

// NotificationPriority 是枚举（值），需要值导出
export { NotificationPriority } from './event-encounter.types';

// 重新导出活动/离线类型
export type {
  OfflineEventPile, AutoResolveResult,
  ShopItemRarity, TokenShopItem, TokenShopConfig,
  ActivityRankEntry, ActivityLeaderboardConfig, LeaderboardRewardTier,
  TimedActivityPhase, TimedActivityFlow,
  FestivalType, FestivalActivityDef,
  ActivityOfflineSummary,
} from './event-activity.types';

// 重新导出连锁事件类型
export type {
  ChainId,
  ChainNodeId,
  ChainMergePoint,
  ChainNodeDefV15,
  EventChainDefV15,
  ChainProgressV15,
  ChainAdvanceResultV15,
} from './event-chain.types';

// 重新导出离线事件处理类型
export type {
  OfflineEventEntry,
  AutoSelectStrategy,
  AutoProcessRule,
  OfflineEventProcessResult,
  EventRetrospectiveData,
} from './event-offline.types';

// 从离线类型子模块导入，用于本模块内引用
import type { OfflineEventEntry, AutoProcessRule } from './event-offline.types';

// 从共享基础模块导入（避免子模块循环依赖）
export type {
  EventCategory,
  EventCategoryMeta,
} from './event-shared.types';
export {
  EVENT_CATEGORY_META,
} from './event-shared.types';
export type {
  OptionConsequence,
  OptionSelectionResult,
} from './event-shared.types';

import type { EventCategory } from './event-shared.types';

// ─────────────────────────────────────────────
// 19. v15 事件系统状态扩展
// ─────────────────────────────────────────────

/** v15 事件系统状态扩展 */
export interface EventV15State {
  /** 遭遇事件冷却 */
  encounterCooldowns: Map<string, number>;
  /** 通知队列 */
  notifications: import('./event-encounter.types').EventNotification[];
  /** 离线事件堆积 */
  offlineEventPiles: import('./event-activity.types').OfflineEventPile[];
  /** 代币余额 */
  tokenBalance: number;
}

/** v15 事件系统存档 */
export interface EventV15SaveData {
  version: number;
  encounterCooldowns: Record<string, number>;
  notifications: import('./event-encounter.types').EventNotification[];
  offlineEventPiles: import('./event-activity.types').OfflineEventPile[];
  tokenBalance: number;
}

// ─────────────────────────────────────────────
// 20. 事件分类（5类）— 定义已移至 event-shared.types.ts
// ─────────────────────────────────────────────

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
// 25. 选项后果与选择结果 — 定义已移至 event-shared.types.ts
// ─────────────────────────────────────────────

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
