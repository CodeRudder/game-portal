/**
 * 引擎层 — 事件模块统一导出
 *
 * @module engine/event
 */

export { EventTriggerSystem } from './EventTriggerSystem';
export { EventUINotification } from './EventUINotification';
export type { EncounterOptionDisplay, EncounterModalData } from './EventUINotification';
export { EventNotificationSystem } from './EventNotificationSystem';
export type { EventNotificationSaveData } from './EventNotificationSystem';
export { EventChainSystem } from './EventChainSystem';
export type {
  EventChain,
  EventChainNode,
  StoryEventDef,
  StoryLine,
  StoryChoice,
  EventLogEntry,
  ReturnAlert,
  EventChainSaveData,
} from './EventChainSystem';

// v7.0 Phase2 — 连锁事件深化
export { ChainEventSystem } from './ChainEventSystem';
export type {
  ChainId,
  ChainNodeId,
  ChainOptionId,
  EventChainDef,
  ChainNodeDef,
  ChainProgress,
  ChainAdvanceResult,
  ChainEventSaveData,
} from './ChainEventSystem';

// v7.0 Phase2 — 历史剧情事件
export { StoryEventSystem } from './StoryEventSystem';
export type {
  StoryEventId,
  StoryActId,
  StoryUrgency,
  StoryLine as StoryLineType,
  StoryChoice as StoryChoiceType,
  StoryActDef,
  StoryEventDef as StoryEventDefType,
  StoryProgress,
  StoryAdvanceResult,
  StoryEventSaveData,
} from './StoryEventSystem';

// v7.0 Phase2 — 事件日志 + 回归急报堆
export { EventLogSystem } from './EventLogSystem';
export type {
  LogId,
  AlertId,
  EventLogType,
  AlertUrgency,
  EventLogEntry as EventLogEntryType,
  ReturnAlert as ReturnAlertType,
  AlertStack,
  EventLogSaveData,
} from './EventLogSystem';

// v15.0 — 事件触发引擎（触发条件+概率+通知+冷却+分支）
export { EventTriggerEngine } from './EventTriggerEngine';

// v15.0 — 连锁事件引擎（分支追踪+快照）
export { ChainEventEngine } from './ChainEventEngine';
export type {
  ChainEngineId,
  ChainEngineNodeId,
  ChainEngineOptionId,
  ChainEventDefV15,
  ChainNodeDefV15,
  ChainNodeOption,
  ChainAdvanceResultV15,
  ChainEngineSaveData,
} from './ChainEventEngine';

// v15.0 — 离线事件堆积处理
export { OfflineEventHandler } from './OfflineEventHandler';
