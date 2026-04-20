/**
 * 核心层 — 事件模块统一导出
 *
 * @module core/events
 */

// EventBus
export { EventBus } from './EventBus';

// 原有事件类型
export {
  EngineEvents,
  ResourceEvents,
  BuildingEvents,
  SaveEvents,
  GameEvents,
  GeneralEvents,
  CampaignEvents,
  MapEvents,
  EconomyEvents,
  SocialEvents,
  VisualEvents,
} from './EventTypes';
export type { EventPayloadMap } from './EventTypes';

// v6.0 事件系统类型
export type {
  EventTriggerType,
  EventPriority,
  EventStatus,
  EventCategory,
  GameEventId,
  GameEventDef,
  EventOptionId,
  EventOption,
  EventConsequence,
  EventConsequenceType,
  EventBanner,
  EventBannerQueue,
  ActiveGameEvent,
  OfflineEventResult,
  OfflineEventDetail,
  EventSystemState,
  EventSystemSaveData,
} from './event-system.types';

// v6.0 事件系统配置
export {
  BANNER_DEFAULT_DURATION,
  BANNER_MAX_QUEUE_SIZE,
  BANNER_PRIORITY_WEIGHT,
  BANNER_ICONS,
  GLOBAL_EVENT_COOLDOWN,
  MAX_EVENTS_PER_TURN,
  MAX_OFFLINE_EVENTS,
  OFFLINE_TERRITORY_LOSS_CAP,
  DEFAULT_EVENT_DEFS,
  EVENT_REFUGEES,
  EVENT_MERCHANT_CARAVAN,
  EVENT_STORM,
  EVENT_HULAO_PASS,
  EVENT_SHADOW_PLOT_START,
  EVENT_SYSTEM_SAVE_VERSION,
} from './event-system-config';
